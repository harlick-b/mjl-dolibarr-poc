import { useSessionQuery } from '@/features/auth/SessionProvider'
import { authorization } from '@/features/auth/authorization'
import { PageLoading, RefreshIndicator } from '@/shared/ui/PageLoading'
import { strings } from '@/locales/fr/NotificationView'
import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Bell, Check } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import { cursorFrom } from '@/shared/lib/pagination'
import { useAPI } from '@/shared/api/RestClientProvider'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'

const notificationRoot = ['notifications']

export function NotificationView() {
  const session = useSessionQuery()
  if (session.isPending) return <NotificationsLoading />
  if (!authorization(session.data).can('notifications'))
    return <AccessDeniedState role={session.data?.user?.role} />
  return <NotificationWorkspace session={session.data} onDenied={() => {}} />
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
        if (error.status === 401) onDenied()
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
      if (error.status === 401) onDenied()
    },
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: [...notificationRoot, session.user.id],
      })
      toast.success(strings.markedRead)
    },
  })

  if (notifications.isPending) return <NotificationsLoading />
  if (notifications.isError)
    return (
      <RetryableError page onRetry={() => void notifications.refetch()}>
        {strings.unavailable}
      </RetryableError>
    )

  const move = (link) =>
    navigate({
      to: '/notifications',
      search: { cursor: cursorFrom(link, '/notifications') },
    })
  return (
    <section className="planning-stack" aria-busy={notifications.isFetching}>
      <Helmet>
        <title>Notifications — MJL</title>
      </Helmet>
      <div className="planning-heading">
        <RefreshIndicator active={notifications.isFetching} />
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

export function NotificationsLoading() {
  return <PageLoading title={strings.notificationsTitle} />
}
