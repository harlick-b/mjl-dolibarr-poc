import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { Bell, Check } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import { sessionKey, sessionQuery } from './auth'
import { cursorFrom } from './pagination'
import { useAPI } from './RestClientProvider'

const notificationRoot = ['notifications']

export function NotificationView() {
  const client = useQueryClient()
  const session = useQuery(sessionQuery)
  const [blocked, setBlocked] = useState(!navigator.onLine)
  const deny = useCallback(() => {
    setBlocked(true)
    void client.cancelQueries({ queryKey: notificationRoot })
    client.removeQueries({ queryKey: notificationRoot })
    client.getMutationCache().clear()
    client.removeQueries({ queryKey: sessionKey, exact: true })
  }, [client])
  useEffect(() => {
    const clear = () => deny()
    const channel = new BroadcastChannel('mjl-auth')
    channel.onmessage = clear
    window.addEventListener('offline', clear)
    const timer = session.data?.expires_at
      ? setTimeout(
          clear,
          Math.max(0, Date.parse(session.data.expires_at) - Date.now()),
        )
      : undefined
    return () => {
      channel.close()
      window.removeEventListener('offline', clear)
      clearTimeout(timer)
    }
  }, [deny, session.data?.expires_at])
  useEffect(() => {
    if (session.isError || session.data?.state !== 'verified') {
      void client.cancelQueries({ queryKey: notificationRoot })
      client.removeQueries({ queryKey: notificationRoot })
    }
  }, [client, session.data?.state, session.isError])

  if (blocked)
    return (
      <section>
        <h1>Vérification de l’accès</h1>
        <p>Reconnectez-vous au service pour consulter vos notifications.</p>
        <button
          className="planning-button"
          disabled={!navigator.onLine}
          onClick={async () => {
            await session.refetch()
            setBlocked(false)
          }}
          type="button"
        >
          Vérifier l’accès
        </button>
      </section>
    )
  if (session.isPending) return <p role="status">Vérification de l’accès…</p>
  if (session.error?.status === 401 || session.data?.state === 'anonymous')
    return <Navigate to="/login" replace />
  if (session.data?.state === 'pending')
    return <Navigate to="/verification" replace />
  if (session.isError) return <p role="alert">L’identité est indisponible.</p>
  if (session.data.user.role === 'ADMIN_PLATEFORME')
    return <p role="alert">Cet espace est réservé aux rôles métier.</p>
  return <NotificationWorkspace session={session.data} onDenied={deny} />
}

function NotificationWorkspace({ session, onDenied }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const generation = useRef(0)
  const mutationController = useRef(null)
  const cursor = search.cursor || ''
  const path = `/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
  const notifications = useQuery({
    queryKey: [...notificationRoot, session.user.id, 'all', cursor, 60],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(`/api/v1${path}`, { signal })
      } catch (error) {
        if (error.status === 401 || error.status === 403) onDenied()
        throw error
      }
    },
    gcTime: 0,
  })
  useEffect(
    () => () => {
      generation.current += 1
      mutationController.current?.abort()
    },
    [],
  )
  const read = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async (item) => {
      const current = generation.current
      const controller = new AbortController()
      mutationController.current = controller
      const result = await api.request(`/api/v1/notifications/${item.id}`, {
        method: 'PATCH',
        csrf: session.csrf,
        body: { expected_version: item.version },
        signal: controller.signal,
      })
      if (current !== generation.current)
        throw new DOMException('Stale authorization', 'AbortError')
      return result
    },
    onError: (error) => {
      if (error.status === 401 || error.status === 403) onDenied()
    },
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: [...notificationRoot, session.user.id],
      })
      toast.success('Notification marquée comme lue.')
    },
  })

  if (notifications.isPending)
    return <p role="status">Chargement des notifications…</p>
  if (notifications.isError)
    return (
      <p role="alert">Les notifications sont momentanément indisponibles.</p>
    )

  const move = (link) =>
    navigate({
      to: '/notifications',
      search: { cursor: cursorFrom(link, '/notifications') },
    })
  return (
    <section className="planning-stack">
      <Helmet>
        <title>Notifications — MJL</title>
      </Helmet>
      <div className="planning-heading">
        <div>
          <p className="eyebrow">Suivi administratif</p>
          <h1>Notifications</h1>
        </div>
      </div>
      <div className="planning-card">
        {notifications.data.data.length === 0 ? (
          <p>Aucune notification pour le moment.</p>
        ) : (
          <ul className="notification-list">
            {notifications.data.data.map((item) => (
              <li key={item.id} className={item.read_at ? '' : 'is-unread'}>
                <Bell aria-hidden="true" size={20} />
                <div>
                  <Link
                    to="/activities/$activityId"
                    params={{ activityId: item.activity_id }}
                  >
                    {item.activity_reference} — {item.activity_name}
                  </Link>
                  <p>
                    Échéance le{' '}
                    {new Intl.DateTimeFormat('fr-FR').format(
                      new Date(`${item.planned_end}T00:00:00`),
                    )}
                  </p>
                  <small>
                    Courriel :{' '}
                    {{
                      delivered: 'envoyé',
                      failed: 'échec enregistré',
                      skipped: 'non envoyé',
                      unconfirmed: 'résultat non confirmé',
                    }[item.email_status] || item.email_status}
                  </small>
                </div>
                {!item.read_at && (
                  <button
                    className="planning-button"
                    disabled={read.isPending}
                    onClick={() => read.mutate(item)}
                    type="button"
                  >
                    <Check aria-hidden="true" size={18} /> Marquer comme lue
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <nav className="planning-actions" aria-label="Pages de notifications">
          <button
            type="button"
            disabled={!notifications.data.previous}
            onClick={() => move(notifications.data.previous)}
          >
            Précédent
          </button>
          <button
            type="button"
            disabled={!notifications.data.next}
            onClick={() => move(notifications.data.next)}
          >
            Suivant
          </button>
        </nav>
      </div>
    </section>
  )
}
