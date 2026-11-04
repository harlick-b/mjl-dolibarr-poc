import { PageLoading, RefreshIndicator } from '@/shared/ui/PageLoading'
import { strings } from '@/shared/i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import { sessionKey, sessionQuery } from '@/features/auth/auth'
import { cursorFrom } from '@/shared/lib/pagination'
import { useAPI } from '@/shared/api/RestClientProvider'
import { AccessRecovery } from '@/features/auth/AccessRecovery'

const historyRoot = ['audit-history']

const outcomeLabels = {
  ok: 'Succès',
  sent: 'Envoyé',
  failed: 'Échec enregistré',
  pending: 'En attente',
  limited: 'Limité',
}

export function AuditHistoryView() {
  const client = useQueryClient()
  const session = useQuery(sessionQuery)
  const [blocked, setBlocked] = useState(!navigator.onLine)
  const deny = useCallback(() => {
    setBlocked(true)
    void client.cancelQueries({ queryKey: historyRoot })
    client.removeQueries({ queryKey: historyRoot })
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
      void client.cancelQueries({ queryKey: historyRoot })
      client.removeQueries({ queryKey: historyRoot })
    }
  }, [client, session.data?.state, session.isError])
  if (blocked)
    return (
      <section>
        <h1>Vérification de l’accès</h1>
        <p>Reconnectez-vous au service pour consulter l’historique.</p>
        <AccessRecovery
          session={session}
          onVerified={() => setBlocked(false)}
        />
      </section>
    )
  if (session.isPending) return <HistoryLoading />
  if (session.error?.status === 401 || session.data?.state === 'anonymous')
    return <Navigate to="/login" replace />
  if (session.data?.state === 'pending')
    return <Navigate to="/verification" replace />
  if (session.isError) return <p role="alert">L’identité est indisponible.</p>
  if (
    !['ADMIN_PLATEFORME', 'VALIDATEUR_DEFINITIF'].includes(
      session.data.user.role,
    )
  )
    return <p role="alert">Vous n’avez pas accès à l’historique global.</p>
  return <History session={session.data} onDenied={deny} />
}

function History({ session, onDenied }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const generation = useRef(0)
  const exportController = useRef(null)
  const cursor = search.cursor || ''
  const canOpenActivity = session.user.role === 'VALIDATEUR_DEFINITIF'
  const result = useQuery({
    queryKey: [...historyRoot, session.user.id, cursor, 60],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(
          `/api/v1/audit-events${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
          { signal },
        )
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
      exportController.current?.abort()
    },
    [],
  )
  const download = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async () => {
      const current = generation.current
      const controller = new AbortController()
      exportController.current = controller
      const file = await api.download('/api/v1/reports/audit/exports', {
        method: 'POST',
        csrf: session.csrf,
        body: { format: 'csv' },
        signal: controller.signal,
      })
      if (current !== generation.current)
        throw new DOMException('Stale authorization', 'AbortError')
      return file
    },
    onError: (error) => {
      if (error.status === 401 || error.status === 403) onDenied()
    },
    onSuccess: async ({ blob, filename }) => {
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 0)
      await client.invalidateQueries({ queryKey: historyRoot })
      toast.success('Export CSV généré.')
    },
  })
  if (result.isPending) return <HistoryLoading />
  if (result.isError)
    return <p role="alert">L’historique est momentanément indisponible.</p>
  const move = (link) =>
    navigate({
      to: '/history',
      search: { cursor: cursorFrom(link, '/audit-events') },
    })
  return (
    <section className="planning-stack" aria-busy={result.isFetching}>
      <Helmet>
        <title>Historique — MJL</title>
      </Helmet>
      <div className="planning-heading">
        <RefreshIndicator active={result.isFetching} />
        <div>
          <p className="eyebrow">Traçabilité</p>
          <h1>Historique</h1>
        </div>
        <button
          className="planning-button"
          disabled={download.isPending}
          onClick={() => download.mutate()}
          type="button"
        >
          <Download aria-hidden="true" size={18} />
          {download.isPending ? 'Génération…' : 'Exporter le CSV'}
        </button>
      </div>
      <div className="planning-card audit-history-card">
        <p>
          <strong>{result.data.count}</strong> événements
        </p>
        {result.data.data.length === 0 ? (
          <p>Aucun événement enregistré.</p>
        ) : (
          <ol className="audit-history-list">
            {result.data.data.map((item) => (
              <li key={item.id}>
                <time dateTime={item.occurred_at}>
                  {new Intl.DateTimeFormat('fr-FR', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  }).format(new Date(item.occurred_at))}
                </time>
                <div>
                  <strong>{item.label}</strong>
                  <small>
                    {outcomeLabels[item.outcome] || 'Résultat enregistré'}
                  </small>
                </div>
                <div>
                  {item.activity && canOpenActivity ? (
                    <Link
                      to="/activities/$activityId"
                      params={{ activityId: item.activity.id }}
                    >
                      {item.activity.reference} — {item.activity.name}
                    </Link>
                  ) : item.activity ? (
                    <span>
                      {item.activity.reference} — {item.activity.name}
                    </span>
                  ) : (
                    <span>Événement général</span>
                  )}
                </div>
                <div>
                  {item.actor ? (
                    <span>{item.actor.email}</span>
                  ) : (
                    <span>Système</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        <nav className="planning-actions" aria-label="Pages de l’historique">
          <button
            type="button"
            disabled={!result.data.previous}
            onClick={() => move(result.data.previous)}
          >
            Précédent
          </button>
          <button
            type="button"
            disabled={!result.data.next}
            onClick={() => move(result.data.next)}
          >
            Suivant
          </button>
        </nav>
      </div>
    </section>
  )
}

export function HistoryLoading() {
  return <PageLoading title={strings.historyTitle} />
}
