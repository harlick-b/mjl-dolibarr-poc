import { Urls } from '@/app/urls'
import { EventDetails } from './EventDetails'
import { formatDateTime } from '@/shared/lib/format'
import { ListFilters } from '@/shared/ui/ListFilters'
import { QueryFilterSelect } from '@/shared/ui/QueryFilterSelect'
import { strings as filtersText } from '@/locales/fr/ListFilters'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { Button } from '@/shared/ui/button'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/session/SessionProvider'
import { authorization } from '@/features/auth/session/authorization'
import { PageLoading, RefreshIndicator } from '@/shared/ui/PageLoading'
import { strings } from '@/locales/fr/AuditHistoryView'
import { useEffect, useRef, useState } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import { cursorFrom } from '@/shared/lib/pagination'
import { useAPI } from '@/shared/api/RestClientProvider'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'

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
  const [denied, setDenied] = useState(false)
  const handleDenied = (error) => {
    if (![401, 403, 404].includes(error.status)) return
    generation.current += 1
    exportController.current?.abort()
    setDenied(true)
    const scope = {
      predicate: ({ queryKey }) =>
        queryKey[0] === 'audit-history' ||
        (queryKey[0] === 'filter-options' &&
          queryKey[2] === '/audit-events/filter-options'),
    }
    void client.cancelQueries(scope)
    client.removeQueries(scope)
    onDenied()
  }
  const cursor = search.cursor || ''
  const filters = Object.fromEntries(
    ['q', 'action', 'actor', 'activity', 'project', 'date_from', 'date_to']
      .filter((key) => search[key])
      .map((key) => [key, search[key]]),
  )
  const filterQuery = new URLSearchParams(filters).toString()
  const changeFilters = (values) =>
    navigate({ to: Urls.history, search: { ...search, ...values, cursor: '' } })
  const resetFilters = () => navigate({ to: Urls.history, search: {} })
  const canOpenActivity = authorization(session).can('business')
  const result = useQuery({
    enabled: !denied,
    placeholderData: keepPreviousData,
    queryKey: [...historyRoot, session.user.id, cursor, 60, filterQuery],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(
          `/api/v1/audit-events${filterQuery || cursor ? '?' + new URLSearchParams({ ...filters, ...(cursor ? { cursor } : {}) }) : ''}`,
          { signal },
        )
      } catch (error) {
        handleDenied(error)
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
      const file = await api.download(
        `/api/v1/reports/audit/exports${filterQuery ? '?' + filterQuery : ''}`,
        {
          method: 'POST',
          csrf: session.csrf,
          body: { format: 'csv' },
          signal: controller.signal,
        },
      )
      if (current !== generation.current)
        throw new DOMException('Stale authorization', 'AbortError')
      return file
    },
    onError: (error) => {
      handleDenied(error)
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
  if (denied) return <AccessDeniedState role={session.user.role} />
  if (result.isPending) return <HistoryLoading />
  if (result.isError)
    return (
      <RetryableError page onRetry={() => void result.refetch()}>
        {strings.unavailable}
        {filterQuery && (
          <Button variant="outline" onClick={resetFilters}>
            {filtersText.reset}
          </Button>
        )}
      </RetryableError>
    )
  const move = (link) =>
    navigate({
      to: Urls.history,
      search: { ...search, cursor: cursorFrom(link, '/audit-events') },
    })
  return (
    <section className="grid gap-6" aria-busy={result.isFetching}>
      <Helmet>
        <title>Historique - MJL</title>
      </Helmet>
      <div
        className="flex justify-between items-center gap-5 flex-wrap [&_h1]:text-navy [&_h1]:font-semibold [&_h1]:text-2xl [&_nav]:flex [&_nav]:gap-5 max-[641px]:items-start"
        data-ui="planning-heading"
      >
        <RefreshIndicator active={result.isFetching} />
        <div>
          <h1>Historique</h1>
        </div>
        <Button
          loading={download.isPending}
          disabled={download.isPending || result.data.count === 0}
          onClick={() => download.mutate()}
          type="button"
        >
          <Download aria-hidden="true" size={18} />
          Exporter le CSV
        </Button>
      </div>
      <Panel as="div" className="overflow-x-auto p-0 gap-0">
        <ListFilters
          value={search.q || ''}
          onSearch={(q) => changeFilters({ q })}
          label={filtersText.searchHistory}
          active={Object.keys(filters).some((key) => key !== 'q')}
          onReset={resetFilters}
        >
          {['activity', 'actor', 'action', 'project'].map((kind) => (
            <QueryFilterSelect
              key={kind}
              kind={kind}
              onDenied={handleDenied}
              value={search[kind]}
              onChange={(value) => changeFilters({ [kind]: value })}
            />
          ))}
          <label>
            {filtersText.from}
            <input
              aria-label="Date de début de période"
              type="date"
              value={search.date_from || ''}
              max={search.date_to || undefined}
              onChange={(event) =>
                changeFilters({ date_from: event.target.value })
              }
            />
          </label>
          <label>
            {filtersText.to}
            <input
              aria-label="Date de fin de période"
              type="date"
              value={search.date_to || ''}
              min={search.date_from || undefined}
              onChange={(event) =>
                changeFilters({ date_to: event.target.value })
              }
            />
          </label>
        </ListFilters>
        <div className="flex justify-between border-b border-border px-5 py-3.5 text-[0.8125rem]">
          <span>
            {result.data.count}{' '}
            {result.data.count > 1
              ? strings.eventsPlural
              : strings.eventsSingular}
          </span>
          <span className="text-muted-foreground">{strings.newestFirst}</span>
        </div>
        {result.data.data.length === 0 ? (
          <EmptyContent
            kind={filterQuery ? 'search' : 'history'}
            large
            action={
              filterQuery ? (
                <Button variant="outline" onClick={resetFilters}>
                  {filtersText.reset}
                </Button>
              ) : undefined
            }
          />
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
                      {formatDateTime(item.occurred_at)}
                    </time>
                  </td>
                  <td>
                    <div>
                      <strong>{item.label}</strong>
                      <small>
                        {outcomeLabels[item.outcome] || 'Résultat enregistré'}
                      </small>
                      <EventDetails event={item} />
                    </div>
                  </td>
                  <td>
                    <div>
                      {item.activity && canOpenActivity ? (
                        <Link
                          to={Urls.activity}
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
