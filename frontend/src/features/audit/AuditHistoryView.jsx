import { useSessionQuery } from '@/features/auth/SessionProvider'
import { authorization } from '@/features/auth/authorization'
import { PageLoading, RefreshIndicator } from '@/shared/ui/PageLoading'
import { strings } from '@/locales/fr/AuditHistoryView'
import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import { cursorFrom } from '@/shared/lib/pagination'
import { useAPI } from '@/shared/api/RestClientProvider'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'

const historyRoot = ['audit-history']

const outcomeLabels = {
  ok: 'Succès',
  sent: 'Envoyé',
  failed: 'Échec enregistré',
  pending: 'En attente',
  limited: 'Limité',
}

export function AuditHistoryView() {
  const session = useSessionQuery()
  if (session.isPending) return <HistoryLoading />
  if (!authorization(session.data).can('audit'))
    return <AccessDeniedState role={session.data?.user?.role} />
  return <History session={session.data} onDenied={() => {}} />
}

function History({ session, onDenied }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const generation = useRef(0)
  const exportController = useRef(null)
  const cursor = search.cursor || ''
  const canOpenActivity = authorization(session).can('business')
  const result = useQuery({
    queryKey: [...historyRoot, session.user.id, cursor, 60],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(
          `/api/v1/audit-events${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
          { signal },
        )
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
      if (error.status === 401) onDenied()
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
      toast.success(strings.exported)
    },
  })
  if (result.isPending) return <HistoryLoading />
  if (result.isError)
    return (
      <RetryableError page onRetry={() => void result.refetch()}>
        {strings.unavailable}
      </RetryableError>
    )
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
