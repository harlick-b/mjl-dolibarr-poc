import { EmptyContent } from '@/shared/ui/EmptyContent'
import { businessActionClassName } from '@/shared/ui/button-variants'
import { Panel } from '@/shared/ui/layout'
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
    <section className="grid gap-6" aria-busy={result.isFetching}>
      <Helmet>
        <title>Historique — MJL</title>
      </Helmet>
      <div
        className="flex justify-between items-center gap-5 flex-wrap [&_h1]:text-navy [&_h1]:font-semibold [&_h1]:text-2xl [&_nav]:flex [&_nav]:gap-5 max-[641px]:items-start"
        data-ui="planning-heading"
      >
        <RefreshIndicator active={result.isFetching} />
        <div>
          <h1>Historique</h1>
        </div>
        <button
          className={businessActionClassName}
          disabled={download.isPending || result.data.count === 0}
          onClick={() => download.mutate()}
          type="button"
        >
          <Download aria-hidden="true" size={18} />
          {download.isPending ? 'Génération…' : 'Exporter le CSV'}
        </button>
      </div>
      <Panel as="div" className="overflow-x-auto p-0 gap-0">
        <div className="flex justify-between border-b border-border p-5 text-[0.8125rem]">
          <span>
            {result.data.count} {strings.events}
          </span>
          <span className="text-muted-foreground">{strings.newestFirst}</span>
        </div>
        {result.data.data.length === 0 ? (
          <EmptyContent kind="history" large />
        ) : (
          <table className="w-full text-left text-sm min-w-190 mt-4 mr-0 mb-6 ml-0 p-0 border-t border-t-border list-none [&_th]:bg-background [&_th]:font-medium [&_th]:p-3 [&_td]:p-3 [&_td]:border-b [&_td]:border-border [&_div]:grid [&_div]:gap-1 [&_time]:text-muted-foreground [&_time]:text-[0.82rem] [&_small]:text-muted-foreground [&_small]:text-[0.82rem]">
            <thead>
              <tr>
                <th>{strings.date}</th>
                <th>{strings.action}</th>
                <th>{strings.activity}</th>
                <th>{strings.author}</th>
              </tr>
            </thead>
            <tbody>
              {result.data.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <time dateTime={item.occurred_at}>
                      {new Intl.DateTimeFormat('fr-FR', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                      }).format(new Date(item.occurred_at))}
                    </time>
                  </td>
                  <td>
                    <div>
                      <strong>{item.label}</strong>
                      <small>
                        {outcomeLabels[item.outcome] || 'Résultat enregistré'}
                      </small>
                      {item.changes?.map((change) => (
                        <small key={change.field}>
                          {change.field} : {change.before ?? '—'} →{' '}
                          {change.after ?? '—'}
                        </small>
                      ))}
                    </div>
                  </td>
                  <td>
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
                        <span>{item.subject || '—'}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div>
                      {item.actor ? (
                        <>
                          <span>
                            {item.actor.full_name || item.actor.email}
                          </span>
                          {item.actor.full_name && (
                            <small>{item.actor.email}</small>
                          )}
                        </>
                      ) : (
                        <span>Système</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(result.data.previous || result.data.next) && (
          <nav
            className="flex gap-2 items-end flex-wrap"
            aria-label="Pages de l’historique"
          >
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
        )}
      </Panel>
    </section>
  )
}

export function HistoryLoading() {
  return <PageLoading title={strings.historyTitle} />
}
