import { Select } from '@/shared/ui/select'
import { ListFilters } from '@/shared/ui/ListFilters'
import { QueryFilterSelect } from '@/shared/ui/QueryFilterSelect'
import { strings as filterText } from '@/locales/fr/ListFilters'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/SessionProvider'
import { authorization } from '@/features/auth/authorization'
import {
  PageLoading,
  RefreshIndicator,
  LoadingPlaceholder,
} from '@/shared/ui/PageLoading'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { strings } from '@/locales/fr/ExecutionView'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import {
  CheckCircle2,
  CircleDollarSign,
  Play,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/button'
import { formatXof, formatDate } from '@/shared/lib/format'
import { cursorFrom } from '@/shared/lib/pagination'
import { useAPI } from '@/shared/api/RestClientProvider'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'

function cursorPath(path, cursor) {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path
}

function executionQuery(api, userId, key, path, onDenied) {
  return {
    queryKey: ['execution', userId, ...key],
    queryFn: async ({ signal, client, queryKey }) => {
      try {
        return await api.request(`/api/v1${path}`, { signal })
      } catch (error) {
        if ([403, 404].includes(error.status))
          client.setQueryData(queryKey, null)
        if (error.status === 401) onDenied()
        throw error
      }
    },
    retry: false,
  }
}

export function ExecutionView({ screen }) {
  const session = useSessionQuery()
  if (session.isPending) return <ExecutionLoading screen={screen} />
  if (!authorization(session.data).can('business'))
    return <AccessDeniedState role={session.data?.user?.role} />
  return (
    <ExecutionWorkspace
      screen={screen}
      session={session.data}
      onDenied={() => {}}
    />
  )
}

function ExecutionWorkspace({ screen, session, onDenied }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const generation = useRef(0)
  const controller = useRef(null)
  const detail = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['activity', params.activityId],
      `/activities/${params.activityId}/execution`,
      onDenied,
    ),
    enabled: screen === 'detail' && Boolean(params.activityId),
  })
  const virementRequestId =
    search.virementRequest || detail.data?.virement_context?.current_request_id
  const history = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['history', params.activityId, search.historyCursor],
      cursorPath(
        `/activities/${params.activityId}/execution/history`,
        search.historyCursor,
      ),
      onDenied,
    ),
    enabled: screen === 'detail' && Boolean(params.activityId),
  })
  const funding = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['funding', params.activityId, search.fundingCursor],
      cursorPath(
        `/activities/${params.activityId}/funding-requests`,
        search.fundingCursor,
      ),
      onDenied,
    ),
    enabled: screen === 'detail' && Boolean(params.activityId),
  })
  const finance = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['finance', params.activityId, search.financeCursor],
      cursorPath(
        `/activities/${params.activityId}/disbursement-requests`,
        search.financeCursor,
      ),
      onDenied,
    ),
    enabled: screen === 'detail' && Boolean(params.activityId),
  })
  const zeroSpending = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['zero-spending', params.activityId, search.zeroSpendingCursor],
      cursorPath(
        `/activities/${params.activityId}/zero-spending-declarations`,
        search.zeroSpendingCursor,
      ),
      onDenied,
    ),
    enabled:
      screen === 'detail' &&
      Boolean(params.activityId) &&
      detail.data?.works_completed &&
      detail.data?.spending_total === '0',
  })
  const selectedFinance = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['finance-detail', params.activityId, search.financeRequest],
      `/activities/${params.activityId}/disbursement-requests/${search.financeRequest}`,
      onDenied,
    ),
    enabled:
      screen === 'detail' &&
      Boolean(params.activityId) &&
      Boolean(search.financeRequest),
  })
  const virements = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['virements', params.activityId, search.virementCursor],
      cursorPath(
        `/activities/${params.activityId}/virement-requests`,
        search.virementCursor,
      ),
      onDenied,
    ),
    enabled: screen === 'detail' && Boolean(params.activityId),
  })
  const selectedVirement = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['virement-detail', params.activityId, virementRequestId],
      `/activities/${params.activityId}/virement-requests/${virementRequestId}`,
      onDenied,
    ),
    enabled:
      screen === 'detail' &&
      Boolean(params.activityId) &&
      Boolean(virementRequestId),
  })
  const confirmationHistory = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      [
        'confirmation-history',
        params.activityId,
        virementRequestId,
        search.confirmationCursor,
      ],
      cursorPath(
        `/activities/${params.activityId}/virement-requests/${virementRequestId}/confirmation/history`,
        search.confirmationCursor,
      ),
      onDenied,
    ),
    enabled:
      screen === 'detail' &&
      Boolean(params.activityId) &&
      Boolean(virementRequestId) &&
      selectedVirement.data?.state === 'approved',
  })
  const reversementHistory = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      [
        'reversement-history',
        params.activityId,
        virementRequestId,
        search.reversementCursor,
      ],
      cursorPath(
        `/activities/${params.activityId}/virement-requests/${virementRequestId}/reversement/history`,
        search.reversementCursor,
      ),
      onDenied,
    ),
    enabled:
      screen === 'detail' &&
      Boolean(params.activityId) &&
      Boolean(virementRequestId) &&
      Boolean(selectedVirement.data?.reversement),
  })
  const filters = Object.fromEntries(
    ['q', 'state', 'agent']
      .filter((key) => search[key])
      .map((key) => [key, search[key]]),
  )
  const listParams = new URLSearchParams({
    ...filters,
    ...(search.cursor ? { cursor: search.cursor } : {}),
  }).toString()
  const list = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['list', params.ptaId, listParams],
      `/ptas/${params.ptaId}/execution${listParams ? '?' + listParams : ''}`,
      onDenied,
    ),
    enabled: screen === 'list' && Boolean(params.ptaId),
  })
  useEffect(
    () => () => {
      generation.current += 1
      controller.current?.abort()
    },
    [],
  )
  const mutation = useMutation({
    retry: false,
    networkMode: 'always',
    meta: { localError: true },
    mutationFn: async ({ operationId, body }) => {
      const activeGeneration = generation.current
      const requestController = new AbortController()
      controller.current = requestController
      const result = await api.request(
        `/api/v1/activities/${params.activityId}/operations/${operationId}/execution`,
        {
          method: 'PATCH',
          body,
          csrf: session.csrf,
          signal: requestController.signal,
        },
      )
      if (activeGeneration !== generation.current)
        throw new DOMException('Stale authorization', 'AbortError')
      return result
    },
    onSuccess: async (result) => {
      client.setQueryData(
        ['execution', session.user.id, 'activity', params.activityId],
        result,
      )
      await Promise.all([
        client.invalidateQueries({
          queryKey: [
            'execution',
            session.user.id,
            'history',
            params.activityId,
          ],
        }),
        client.invalidateQueries({
          queryKey: ['execution', session.user.id, 'list'],
        }),
        client.invalidateQueries({
          queryKey: [
            'execution',
            session.user.id,
            'funding',
            params.activityId,
          ],
        }),
        client.invalidateQueries({ queryKey: ['planning', session.user.id] }),
        client.invalidateQueries({ queryKey: ['audit-history'] }),
      ])
      setError('')
      toast.success('Réalisation enregistrée.')
    },
    onError: async (problem) => {
      if (problem.name === 'AbortError') return
      if (problem.status === 401) onDenied()
      if (
        problem.code === 'activity_assignment_required' ||
        problem.status === 409 ||
        ['network', 'malformed'].includes(problem.kind)
      )
        await Promise.all([
          client.invalidateQueries({
            queryKey: ['execution', session.user.id],
          }),
          client.invalidateQueries({
            queryKey: ['planning', session.user.id],
          }),
        ])
      setError(
        problem.code === 'activity_assignment_required'
          ? strings.assignmentRequired
          : problem.message,
      )
    },
  })
  const financeMutation = useMutation({
    retry: false,
    networkMode: 'always',
    meta: { localError: true },
    mutationFn: async ({ path, body }) => {
      const activeGeneration = generation.current
      const requestController = new AbortController()
      controller.current = requestController
      const result = await api.request(
        `/api/v1/activities/${params.activityId}${path}`,
        {
          method: 'POST',
          body,
          csrf: session.csrf,
          signal: requestController.signal,
        },
      )
      if (activeGeneration !== generation.current)
        throw new DOMException('Stale authorization', 'AbortError')
      return result
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['execution', session.user.id],
        }),
        client.invalidateQueries({ queryKey: ['planning', session.user.id] }),
        client.invalidateQueries({ queryKey: ['audit-history'] }),
      ])
      if (
        variables.path === '/disbursement-requests' ||
        (variables.path.endsWith('/cancellation') &&
          variables.path.startsWith('/disbursement-requests'))
      )
        await navigate({
          search: (current) => ({ ...current, financeRequest: '' }),
        })
      if (
        variables.path === '/virement-requests' ||
        (variables.path.endsWith('/cancellation') &&
          variables.path.startsWith('/virement-requests'))
      )
        await navigate({
          search: (current) => ({ ...current, virementRequest: '' }),
        })
      setError('')
      toast.success(
        variables.path === '/closure'
          ? 'Activité clôturée.'
          : 'Suivi financier mis à jour.',
      )
    },
    onError: async (problem) => {
      if (problem.name === 'AbortError') return
      if (problem.status === 401) onDenied()
      if (
        problem.code === 'activity_assignment_required' ||
        problem.status === 409 ||
        ['network', 'malformed'].includes(problem.kind)
      )
        await Promise.all([
          client.invalidateQueries({
            queryKey: ['execution', session.user.id],
          }),
          client.invalidateQueries({ queryKey: ['planning', session.user.id] }),
          client.invalidateQueries({ queryKey: ['audit-history'] }),
        ])
      setError(
        problem.code === 'activity_assignment_required'
          ? strings.assignmentRequired
          : problem.message,
      )
    },
  })
  const relevant =
    screen === 'list'
      ? [list]
      : [
          detail,
          history,
          finance,
          funding,
          ...(detail.data?.works_completed &&
          detail.data?.spending_total === '0'
            ? [zeroSpending]
            : []),
          virements,
          ...(search.financeRequest ? [selectedFinance] : []),
          ...(virementRequestId ? [selectedVirement] : []),
          ...(selectedVirement.data?.state === 'approved'
            ? [confirmationHistory]
            : []),
          ...(selectedVirement.data?.reversement ? [reversementHistory] : []),
        ]
  const failedQueries = relevant.filter((query) => query.isError)
  const retryFailed = () =>
    void Promise.all(failedQueries.map((query) => query.refetch()))
  const primary = screen === 'list' ? list : detail
  if (
    primary.isError &&
    (!primary.data || [403, 404].includes(primary.error?.status))
  )
    return (
      <RetryableError page onRetry={retryFailed}>
        {strings.unavailableExecution}
      </RetryableError>
    )
  if (primary.isPending) return <ExecutionLoading screen={screen} />
  const readError = failedQueries.length > 0 && (
    <RetryableError onRetry={retryFailed}>
      {strings.unavailableExecution}
    </RetryableError>
  )
  const missingRead = (query) =>
    query.isError ? (
      <RetryableError onRetry={() => void query.refetch()}>
        {strings.unavailableExecution}
      </RetryableError>
    ) : (
      <LoadingPlaceholder label={strings.executionDataLoading} />
    )
  if (screen === 'list')
    return (
      <>
        <RefreshIndicator active={list.isFetching} />
        {readError}
        <ExecutionList
          ptaId={params.ptaId}
          filters={filters}
          onFilterChange={(values) =>
            navigate({ search: { ...search, ...values, cursor: '' } })
          }
          result={list.data}
          onPage={(link) =>
            navigate({
              search: (current) => ({
                ...current,
                cursor: cursorFrom(link, `/ptas/${params.ptaId}/execution`),
              }),
            })
          }
        />
      </>
    )
  return (
    <>
      <RefreshIndicator active={relevant.some((query) => query.isFetching)} />
      {readError}
      <ExecutionDetail
        detail={detail.data}
        sectionFallbacks={{
          history: missingRead(history),
          funding: missingRead(funding),
          finance: missingRead(finance),
          virements: missingRead(virements),
          zeroSpending: missingRead(zeroSpending),
        }}
        history={history.data}
        finance={finance.data}
        funding={funding.data}
        onFundingPage={(link) =>
          navigate({
            search: (current) => ({
              ...current,
              fundingCursor: cursorFrom(
                link,
                `/activities/${params.activityId}/funding-requests`,
              ),
            }),
          })
        }
        zeroSpending={zeroSpending.data}
        selectedFinance={selectedFinance.data}
        virements={virements.data}
        selectedVirement={selectedVirement.data}
        confirmationHistory={confirmationHistory.data}
        reversementHistory={reversementHistory.data}
        role={session.user.role}
        financeHistoryPage={Boolean(search.financeCursor)}
        virementHistoryPage={Boolean(search.virementCursor)}
        virementSelectedBySearch={Boolean(search.virementRequest)}
        error={error}
        pending={
          relevant.some((query) => query.isError || query.isPending) ||
          mutation.isPending ||
          financeMutation.isPending ||
          detail.isFetching ||
          history.isFetching ||
          finance.isFetching ||
          zeroSpending.isFetching ||
          selectedFinance.isFetching ||
          virements.isFetching ||
          selectedVirement.isFetching ||
          confirmationHistory.isFetching ||
          reversementHistory.isFetching
        }
        mutate={(operationId, body) =>
          mutation.mutateAsync({ operationId, body }).catch(() => false)
        }
        mutateFinance={(path, body) =>
          financeMutation.mutateAsync({ path, body }).catch(() => false)
        }
        onHistoryPage={(link) =>
          navigate({
            search: (current) => ({
              ...current,
              historyCursor: cursorFrom(
                link,
                `/activities/${params.activityId}/execution/history`,
              ),
            }),
          })
        }
        onFinancePage={(link) =>
          navigate({
            search: (current) => ({
              ...current,
              financeCursor: cursorFrom(
                link,
                `/activities/${params.activityId}/disbursement-requests`,
              ),
            }),
          })
        }
        onFinanceSelect={(requestId) =>
          navigate({
            search: (current) => ({ ...current, financeRequest: requestId }),
          })
        }
        onZeroSpendingPage={(link) =>
          navigate({
            search: (current) => ({
              ...current,
              zeroSpendingCursor: cursorFrom(
                link,
                `/activities/${params.activityId}/zero-spending-declarations`,
              ),
            }),
          })
        }
        onVirementPage={(link) =>
          navigate({
            search: (current) => ({
              ...current,
              virementCursor: cursorFrom(
                link,
                `/activities/${params.activityId}/virement-requests`,
              ),
            }),
          })
        }
        onVirementSelect={(requestId) =>
          navigate({
            search: (current) => ({ ...current, virementRequest: requestId }),
          })
        }
        onConfirmationPage={(link) =>
          navigate({
            search: (current) => ({
              ...current,
              confirmationCursor: cursorFrom(
                link,
                `/activities/${params.activityId}/virement-requests/${virementRequestId}/confirmation/history`,
              ),
            }),
          })
        }
        onReversementPage={(link) =>
          navigate({
            search: (current) => ({
              ...current,
              reversementCursor: cursorFrom(
                link,
                `/activities/${params.activityId}/virement-requests/${virementRequestId}/reversement/history`,
              ),
            }),
          })
        }
      />
    </>
  )
}

export function ExecutionList({
  result,
  onPage,
  embedded = false,
  filters = {},
  onFilterChange,
  ptaId,
}) {
  const reset = () => onFilterChange?.({ q: '', state: '', agent: '' })
  const filtered = Boolean(filters.q || filters.state || filters.agent)
  const rows = result?.data || []
  return (
    <section className="grid gap-6">
      <Helmet>
        <title>{`${strings.listTitle} — MJL`}</title>
      </Helmet>
      {!embedded && (
        <h1 className="text-2xl font-semibold text-navy">
          {strings.listTitle}
        </h1>
      )}
      <div className="overflow-x-auto rounded-card border border-border bg-white">
        <ListFilters
          value={filters.q || ''}
          onSearch={(q) => onFilterChange?.({ q })}
          label={filterText.searchActivity}
          active={Boolean(filters.state || filters.agent)}
          onReset={reset}
          disabled={!ptaId}
        >
          <label>
            {filterText.state}
            <Select
              value={filters.state || ''}
              onChange={(event) =>
                onFilterChange?.({ state: event.target.value })
              }
            >
              <option value="">{filterText.all}</option>
              {['ongoing', 'physical', 'closed'].map((value) => (
                <option key={value} value={value}>
                  {filterText[value]}
                </option>
              ))}
            </Select>
          </label>
          {ptaId && (
            <QueryFilterSelect
              kind="agent"
              path={`/ptas/${ptaId}/execution/agents`}
              value={filters.agent}
              onChange={(agent) => onFilterChange?.({ agent })}
            />
          )}
        </ListFilters>
        <p className="border-b border-border px-5 py-4 text-sm">
          {strings.formatString(
            (result?.count ?? rows.length) > 1
              ? strings.activitiesCountPlural
              : strings.activitiesCount,
            {
              count: result?.count ?? rows.length,
            },
          )}
        </p>
        <table className="w-full text-left text-sm">
          {rows.length > 0 && (
            <thead className="bg-background border-b border-border">
              <tr>
                {strings.listColumns.map((label) => (
                  <th key={label} className="px-3 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-4">
                    <Link
                      className="font-medium text-primary"
                      to="/execution/activities/$activityId"
                      params={{ activityId: row.id }}
                    >
                      {row.name}
                    </Link>
                    <small className="block mt-1 text-muted-foreground">
                      {row.reference}
                      {row.project_name ? ` · ${row.project_name}` : ''}
                    </small>
                  </td>
                  <td className="px-3 py-4">
                    {formatDate(row.planned_start)}
                    <small className="block mt-1 text-muted-foreground">
                      {formatDate(row.planned_end)}
                    </small>
                  </td>
                  <td className="px-3 py-4">
                    {row.works_completed
                      ? strings.completedLabel
                      : strings.ongoingLabel}
                    <small className="block mt-1 text-muted-foreground">
                      {row.spending_total === null
                        ? '—'
                        : formatXof(row.spending_total)}{' '}
                      · {row.completed_operations}/{row.operation_count}{' '}
                      {strings.operationsCount}
                    </small>
                  </td>
                  <td className="px-3 py-4">{row.agents?.join(', ') || '—'}</td>
                  <td className="px-3 py-4">
                    <span
                      className={
                        row.closure
                          ? 'rounded-card bg-success-badge text-success px-2 py-1 text-xs'
                          : row.works_completed || row.execution_paused
                            ? 'rounded-card bg-warning-soft text-warning px-2 py-1 text-xs'
                            : 'rounded-card bg-selected text-primary px-2 py-1 text-xs'
                      }
                    >
                      {executionStage(row)}
                    </span>
                    {row.approved_revision_number && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {strings.revision} {row.approved_revision_number}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/execution/activities/$activityId"
                        params={{ activityId: row.id }}
                      >
                        {strings.followUp}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <EmptyContent
                    kind={
                      filtered
                        ? 'search'
                        : ptaId
                          ? 'execution'
                          : 'executionNoPta'
                    }
                    large
                    action={
                      filtered ? (
                        <Button variant="outline" onClick={reset}>
                          {filterText.reset}
                        </Button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(result?.previous || result?.next) && (
        <nav
          className="flex gap-2 items-end flex-wrap"
          aria-label={strings.listPagination}
        >
          <Button
            variant="outline"
            disabled={!result.previous}
            onClick={() => onPage(result.previous)}
          >
            {strings.previousPage}
          </Button>
          <Button
            variant="outline"
            disabled={!result.next}
            onClick={() => onPage(result.next)}
          >
            {strings.nextPage}
          </Button>
        </nav>
      )}
    </section>
  )
}

function ExecutionDetail({
  sectionFallbacks,
  detail,
  history,
  finance,
  funding,
  onFundingPage,
  zeroSpending,
  selectedFinance,
  virements,
  selectedVirement,
  confirmationHistory,
  reversementHistory,
  role,
  financeHistoryPage,
  virementHistoryPage,
  virementSelectedBySearch,
  error,
  pending,
  mutate,
  mutateFinance,
  onHistoryPage,
  onFinancePage,
  onFinanceSelect,
  onZeroSpendingPage,
  onVirementPage,
  onVirementSelect,
  onConfirmationPage,
  onReversementPage,
}) {
  const unavailableLabels = {
    project_inactive: 'le Projet est inactif',
    activity_withdrawn: 'l’Activité a été retirée',
    activity_closed: 'l’Activité est clôturée',
    funding_required: strings.fundingRequired,
    amendment_pending: 'une modification est en cours',
    withdrawal_pending: 'une demande de retrait est en cours',
    transfer_pending: 'un transfert est en cours',
    activity_not_approved: 'l’Activité n’est pas approuvée',
    reviewer_read_only: 'votre rôle permet uniquement la consultation',
    activity_assignment_required: strings.assignmentRequired,
    before_planned_start: 'la date de début planifiée n’est pas atteinte',
    disbursement_frozen: 'une autorisation de décaissement est en cours',
    zero_spending_frozen: 'une déclaration sans dépense est en cours',
  }
  const historyLabels = {
    'operation.execution_started': 'Opération démarrée',
    'operation.execution_recorded': 'Réalisation enregistrée',
    'operation.execution_corrected': 'Réalisation corrigée',
  }
  return (
    <section className="grid gap-6">
      <Helmet>
        <title>{`${detail.name} — Réalisation MJL`}</title>
      </Helmet>
      <header
        className="flex justify-between items-center gap-5 flex-wrap [&_h1]:text-navy [&_h1]:font-semibold [&_h1]:text-[1.75rem] [&_nav]:flex [&_nav]:gap-5 max-[641px]:items-start"
        data-ui="planning-heading"
      >
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
            {detail.reference}
          </p>
          <h1>{detail.name}</h1>
        </div>
        <Link to="/execution/$ptaId" params={{ ptaId: detail.pta_id }}>
          Retour aux réalisations
        </Link>
      </header>
      {error && (
        <p role="alert" className="border-l-4 border-l-danger p-3 bg-white">
          {error}
        </p>
      )}
      {detail.execution_paused && (
        <p
          role="status"
          className="border-l-4 border-l-primary bg-background py-3 px-4"
        >
          La réalisation est suspendue :{' '}
          {unavailableLabels[detail.pause_reason] || detail.pause_reason}.
        </p>
      )}
      {!detail.execution_paused && detail.mutation_unavailable_reason && (
        <p
          role="status"
          className="border-l-4 border-l-primary bg-background py-3 px-4"
        >
          Modification indisponible :{' '}
          {unavailableLabels[detail.mutation_unavailable_reason] ||
            detail.mutation_unavailable_reason}
          .
        </p>
      )}
      <Panel
        as="dl"
        className="grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] [&_dd]:mt-1 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-lg [&_dd]:font-semibold [&_dd]:text-navy"
      >
        <div>
          <dt>Avancement</dt>
          <dd>
            {detail.completed_operations}/{detail.operation_count} Opérations
          </dd>
        </div>
        <div>
          <dt>Dépenses enregistrées</dt>
          <dd>
            {detail.spending_total === null
              ? 'Information incomplète'
              : formatXof(detail.spending_total)}
          </dd>
        </div>
        <div>
          <dt>État des travaux</dt>
          <dd>{detail.works_completed ? 'Travaux terminés' : 'En cours'}</dd>
        </div>
      </Panel>
      <div className="grid gap-4">
        {detail.operations.map((operation) => (
          <OperationCard
            key={operation.id}
            activity={detail}
            operation={operation}
            pending={pending}
            mutate={mutate}
          />
        ))}
      </div>
      {detail.works_completed && detail.spending_total === '0' && (
        <ZeroSpendingSection
          fallback={sectionFallbacks.zeroSpending}
          detail={detail}
          result={zeroSpending}
          role={role}
          pending={pending}
          mutate={mutateFinance}
          onPage={onZeroSpendingPage}
        />
      )}
      {(detail.spending_total !== '0' || finance?.count > 0) && (
        <>
          <DisbursementSection
            fallback={sectionFallbacks.finance}
            detail={detail}
            result={finance}
            selected={selectedFinance}
            role={role}
            historicalPage={financeHistoryPage}
            pending={pending}
            mutate={mutateFinance}
            onPage={onFinancePage}
            onSelect={onFinanceSelect}
          />
          {detail.spending_total !== '0' && (
            <VirementSection
              fallback={sectionFallbacks.virements}
              detail={detail}
              result={virements}
              selected={selectedVirement}
              confirmationHistory={confirmationHistory}
              reversementHistory={reversementHistory}
              selectedBySearch={virementSelectedBySearch}
              role={role}
              historicalPage={virementHistoryPage}
              pending={pending}
              mutate={mutateFinance}
              onPage={onVirementPage}
              onSelect={onVirementSelect}
              onConfirmationPage={onConfirmationPage}
              onReversementPage={onReversementPage}
            />
          )}
        </>
      )}
      <FundingSection
        fallback={sectionFallbacks.funding}
        detail={detail}
        result={funding}
        pending={pending}
        mutate={mutateFinance}
        onPage={onFundingPage}
      />
      <ClosureSection
        detail={detail}
        pending={pending}
        mutate={mutateFinance}
      />
      <Panel aria-labelledby="execution-history-title">
        <h2 id="execution-history-title">Historique de réalisation</h2>
        {!history ? (
          sectionFallbacks.history
        ) : history.data.length ? (
          <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
            {history.data.map((event) => (
              <li key={event.id}>
                <strong>{historyLabels[event.action] || event.action}</strong>{' '}
                <time dateTime={event.occurred_at}>{event.occurred_at}</time>
                {event.correction_reason && <p>{event.correction_reason}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyContent kind="activityHistory" />
        )}
        {(history?.previous || history?.next) && (
          <nav
            className="flex gap-2 items-end flex-wrap"
            aria-label="Pagination de l’historique"
          >
            <Button
              variant="outline"
              disabled={!history.previous}
              onClick={() => onHistoryPage(history.previous)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              disabled={!history.next}
              onClick={() => onHistoryPage(history.next)}
            >
              Suivant
            </Button>
          </nav>
        )}
      </Panel>
    </section>
  )
}

function ZeroSpendingSection({
  fallback,
  detail,
  result,
  role,
  pending,
  mutate,
  onPage,
}) {
  if (!result) return fallback
  const declarations = result.data
  const current = declarations.find((row) => row.state !== 'returned')
  const currentIsOnNewerPage =
    !current &&
    Boolean(result?.previous) &&
    detail.mutation_unavailable_reason === 'zero_spending_frozen'
  const stateLabels = {
    submitted: 'Soumise au Superviseur',
    prevalidated: 'Prévalidée, en attente du Validateur',
    returned: 'Retournée pour correction',
    approved: 'Validée',
  }
  const version = current?.activity_version || detail.version
  return (
    <Panel aria-labelledby="zero-spending-title">
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
            Clôture sans dépense
          </p>
          <h2 id="zero-spending-title">Déclaration de dépense nulle</h2>
        </div>
        {current && <strong>{stateLabels[current.state]}</strong>}
      </div>
      <p>
        Confirmez pourquoi toutes les Opérations ont été réalisées sans dépense.
        Cette déclaration remplace le parcours de décaissement uniquement après
        la validation du Superviseur et du Validateur.
      </p>
      {current ? (
        <>
          <p className="border-l-4 border-l-primary bg-background py-3 px-4">
            Motif : {current.reason}
          </p>
          <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
            {current.decisions.map((decision) => (
              <li key={decision.id}>
                <strong>
                  {decision.stage === 'supervisor'
                    ? 'Superviseur'
                    : 'Validateur'}{' '}
                  · {stateLabels[decision.outcome] || decision.outcome}
                </strong>
                {decision.reason && <p>{decision.reason}</p>}
              </li>
            ))}
          </ol>
          <div className="flex gap-2 items-end flex-wrap">
            {current.allowed_actions.includes('prevalidate') && (
              <Button
                disabled={pending || !navigator.onLine}
                onClick={() =>
                  mutate(
                    `/zero-spending-declarations/${current.id}/decisions`,
                    { expected_version: version, decision: 'prevalidate' },
                  )
                }
              >
                <ShieldCheck size={16} /> Prévalider
              </Button>
            )}
            {current.allowed_actions.includes('approve') && (
              <Button
                disabled={pending || !navigator.onLine}
                onClick={() =>
                  mutate(
                    `/zero-spending-declarations/${current.id}/decisions`,
                    { expected_version: version, decision: 'approve' },
                  )
                }
              >
                <ShieldCheck size={16} /> Valider
              </Button>
            )}
          </div>
          {current.allowed_actions.includes('return') && (
            <BusinessForm
              className="[&_>_label]:w-full"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                return mutate(
                  `/zero-spending-declarations/${current.id}/decisions`,
                  {
                    expected_version: version,
                    decision: 'return',
                    reason: String(data.get('reason') || ''),
                  },
                )
              }}
            >
              <label>
                Motif du retour
                <textarea name="reason" required maxLength="4000" />
              </label>
              <Button
                type="submit"
                variant="outline"
                disabled={pending || !navigator.onLine}
              >
                Retourner
              </Button>
            </BusinessForm>
          )}
        </>
      ) : currentIsOnNewerPage ? (
        <div className="flex gap-2 items-end flex-wrap">
          <p>La déclaration en cours se trouve sur une page plus récente.</p>
          <Button variant="outline" onClick={() => onPage(null)}>
            Revenir à la déclaration en cours
          </Button>
        </div>
      ) : role === 'AGENT_SAISIE' &&
        detail.mutation_unavailable_reason !==
          'activity_assignment_required' ? (
        <BusinessForm
          className="[&_>_label]:w-full"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            return mutate('/zero-spending-declarations', {
              expected_version: detail.version,
              expected_approved_revision_id: detail.approved_revision_id,
              reason: String(data.get('reason') || ''),
            })
          }}
        >
          <label>
            Motif de l’absence de dépense
            <textarea name="reason" required maxLength="4000" />
          </label>
          <Button type="submit" disabled={pending || !navigator.onLine}>
            Soumettre la déclaration
          </Button>
        </BusinessForm>
      ) : (
        <p>Aucune déclaration sans dépense n’est en attente.</p>
      )}
      {declarations.some((row) => row.state === 'returned') && (
        <details>
          <summary>Déclarations retournées</summary>
          <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
            {declarations
              .filter((row) => row.state === 'returned')
              .map((row) => (
                <li key={row.id}>
                  {stateLabels[row.state]} · {row.reason}
                </li>
              ))}
          </ol>
        </details>
      )}
      {(result?.previous || result?.next) && (
        <nav
          className="flex gap-2 items-end flex-wrap"
          aria-label="Pagination des déclarations sans dépense"
        >
          <Button
            variant="outline"
            disabled={!result.previous}
            onClick={() => onPage(result.previous)}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            disabled={!result.next}
            onClick={() => onPage(result.next)}
          >
            Suivant
          </Button>
        </nav>
      )}
    </Panel>
  )
}

function ClosureSection({ detail, pending, mutate }) {
  const blockerLabels = {
    planning_not_approved:
      'L’Activité doit être approuvée sans demande en cours.',
    execution_ineligible:
      'Les Opérations approuvées ne peuvent pas être vérifiées.',
    execution_incomplete:
      'Toutes les Opérations doivent être terminées et chiffrées.',
    execution_history_unverified: 'L’historique de réalisation est incomplet.',
    spending_ineligible: 'Le total final des dépenses ne peut pas être réglé.',
    disbursement_not_settled: 'Le décaissement exact doit être approuvé.',
    virement_not_settled: 'Le virement exact doit être approuvé.',
    virement_confirmation_required: 'Le virement externe doit être confirmé.',
    reversement_not_settled: 'Le reversement exact doit être enregistré.',
    financial_insufficiency_unresolved:
      'Les dépenses dépassent le montant approuvé.',
    zero_spending_not_approved:
      'La déclaration sans dépense doit être validée.',
  }
  const blockers = detail.closure_blockers || []
  return (
    <Panel aria-labelledby="closure-title">
      <h2 id="closure-title">Clôture de l’activité</h2>
      {detail.closure ? (
        <>
          <p className="border-l-4 border-l-primary bg-background py-3 px-4">
            <CheckCircle2 size={16} aria-hidden="true" /> Activité clôturée
          </p>
          <dl className="grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] [&_dd]:mt-1 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-lg [&_dd]:font-semibold [&_dd]:text-navy">
            <div>
              <dt>Clôturée par</dt>
              <dd>{detail.closure.closed_by_id}</dd>
            </div>
            <div>
              <dt>Clôturée le</dt>
              <dd>
                <time dateTime={detail.closure.closed_at}>
                  {detail.closure.closed_at}
                </time>
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <p>
            La clôture confirme que les travaux et le règlement applicable sont
            terminés.
          </p>
          {blockers.length > 0 && (
            <ul>
              {blockers.map((blocker) => (
                <li key={blocker}>{blockerLabels[blocker] || blocker}</li>
              ))}
            </ul>
          )}
          {detail.allowed_actions?.includes('close') && (
            <BusinessForm
              className="[&_>_label]:w-full"
              onSubmit={(event) => {
                event.preventDefault()
                return mutate('/closure', { expected_version: detail.version })
              }}
            >
              <label>
                <input type="checkbox" required /> Je confirme que l’Activité
                est entièrement réalisée et réglée.
              </label>
              <Button type="submit" disabled={pending || !navigator.onLine}>
                Clôturer l’activité
              </Button>
            </BusinessForm>
          )}
        </>
      )}
    </Panel>
  )
}

function DisbursementSection({
  fallback,
  detail,
  result,
  selected,
  role,
  historicalPage,
  pending,
  mutate,
  onPage,
  onSelect,
}) {
  if (!result) return fallback
  const requests = result.data
  const active = requests.find(
    (request) => !['returned', 'cancelled'].includes(request.state),
  )
  const current =
    selected ||
    active ||
    (!historicalPage && requests[0]?.state === 'returned' ? requests[0] : null)
  const stateLabels = {
    submitted: 'Soumise au Superviseur',
    prevalidated: 'Prévalidée, en attente du Validateur',
    returned: 'Retournée pour correction',
    approved: 'Autorisée',
    cancelled: 'Annulée',
  }
  const canSubmit =
    role === 'AGENT_SAISIE' &&
    !historicalPage &&
    !active &&
    (!selected || ['returned', 'cancelled'].includes(selected.state)) &&
    !detail.mutation_unavailable_reason &&
    detail.works_completed &&
    Number(detail.spending_total) > 0
  const version = current?.activity_version || detail.version
  return (
    <Panel aria-labelledby="disbursement-title">
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
            Suivi administratif
          </p>
          <h2 id="disbursement-title">Autorisation de décaissement</h2>
        </div>
        {current && <strong>{stateLabels[current.state]}</strong>}
      </div>
      <p>
        Cette étape autorise administrativement le montant final. Elle ne
        signifie pas que le paiement a été effectué.
      </p>
      {current ? (
        <>
          <p className="border-l-4 border-l-primary bg-background py-3 px-4">
            Montant soumis : <strong>{formatXof(current.amount)}</strong>.{' '}
            {current.state === 'returned'
              ? strings.disbursementReturned
              : current.state === 'cancelled'
                ? strings.financialCancelled
                : current.state === 'approved'
                  ? strings.disbursementApproved
                  : strings.disbursementPending}
          </p>
          {selected && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onSelect('')}
            >
              Fermer le détail
            </Button>
          )}
          <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
            {current.decisions.map((decision) => (
              <li key={decision.id}>
                <strong>
                  {decision.stage === 'supervisor'
                    ? 'Superviseur'
                    : 'Validateur'}{' '}
                  · {stateLabels[decision.outcome] || decision.outcome}
                </strong>
                {decision.reason && <p>{decision.reason}</p>}
              </li>
            ))}
          </ol>
          <div className="flex gap-2 items-end flex-wrap">
            {current.allowed_actions.includes('prevalidate') && (
              <Button
                disabled={pending || !navigator.onLine}
                onClick={() =>
                  mutate(`/disbursement-requests/${current.id}/decisions`, {
                    expected_version: version,
                    decision: 'prevalidate',
                  })
                }
              >
                <ShieldCheck size={16} /> Prévalider
              </Button>
            )}
            {current.allowed_actions.includes('approve') && (
              <Button
                disabled={pending || !navigator.onLine}
                onClick={() =>
                  mutate(`/disbursement-requests/${current.id}/decisions`, {
                    expected_version: version,
                    decision: 'approve',
                  })
                }
              >
                <ShieldCheck size={16} /> Autoriser
              </Button>
            )}
          </div>
          {(current.allowed_actions.includes('return') ||
            current.allowed_actions.includes('cancel')) && (
            <BusinessForm
              className="[&_>_label]:w-full"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const reason = String(data.get('reason') || '')
                const cancellation =
                  event.nativeEvent.submitter?.value === 'cancel'
                return mutate(
                  `/disbursement-requests/${current.id}/${
                    cancellation ? 'cancellation' : 'decisions'
                  }`,
                  cancellation
                    ? { expected_version: version, reason }
                    : {
                        expected_version: version,
                        decision: 'return',
                        reason,
                      },
                )
              }}
            >
              <label>
                Motif obligatoire
                <textarea name="reason" required maxLength="4000" />
              </label>
              <div className="flex gap-2 items-end flex-wrap">
                {current.allowed_actions.includes('return') && (
                  <Button
                    type="submit"
                    value="return"
                    variant="outline"
                    disabled={pending || !navigator.onLine}
                  >
                    Retourner
                  </Button>
                )}
                {current.allowed_actions.includes('cancel') && (
                  <Button
                    type="submit"
                    value="cancel"
                    variant="outline"
                    disabled={pending || !navigator.onLine}
                  >
                    <XCircle size={16} /> Annuler la demande
                  </Button>
                )}
              </div>
            </BusinessForm>
          )}
        </>
      ) : null}
      {(!current || ['returned', 'cancelled'].includes(current.state)) &&
        (role === 'AGENT_SAISIE' &&
        !historicalPage &&
        detail.spending_total !== '0' ? (
          <Button
            disabled={!canSubmit || pending || !navigator.onLine}
            onClick={() =>
              mutate('/disbursement-requests', {
                expected_version: detail.version,
                expected_approved_revision_id: detail.approved_revision_id,
              })
            }
          >
            <CircleDollarSign size={16} /> Soumettre{' '}
            {formatXof(detail.spending_total)}
          </Button>
        ) : (
          <p>Consultez l’état et l’historique de l’autorisation.</p>
        ))}
      {requests.length > 0 && (
        <details>
          <summary>Historique des demandes ({result.count})</summary>
          <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
            {requests.map((request) => (
              <li key={request.id}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSelect(request.id)}
                >
                  {stateLabels[request.state]} · {formatXof(request.amount)}
                </Button>
                {request.cancellation?.reason && (
                  <p>{request.cancellation.reason}</p>
                )}
              </li>
            ))}
          </ol>
          {(result.previous || result.next) && (
            <nav
              className="flex gap-2 items-end flex-wrap"
              aria-label="Pagination financière"
            >
              <Button
                variant="outline"
                disabled={!result.previous}
                onClick={() => onPage(result.previous)}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                disabled={!result.next}
                onClick={() => onPage(result.next)}
              >
                Suivant
              </Button>
            </nav>
          )}
        </details>
      )}
    </Panel>
  )
}

function VirementSection({
  fallback,
  detail,
  result,
  selected,
  selectedBySearch,
  confirmationHistory,
  reversementHistory,
  role,
  historicalPage,
  pending,
  mutate,
  onPage,
  onSelect,
  onConfirmationPage,
  onReversementPage,
}) {
  if (!result) return fallback
  const requests = result.data
  const current =
    selected ||
    (!historicalPage &&
    !detail.virement_context.current_request_id &&
    requests[0]?.state === 'returned'
      ? requests[0]
      : null)
  const context = detail.virement_context
  const stateLabels = {
    submitted: 'Soumise au Superviseur',
    prevalidated: 'Prévalidée, en attente du Validateur',
    returned: 'Retournée pour correction',
    approved: 'Autorisée',
    cancelled: 'Annulée',
  }
  const version = current?.activity_version || detail.version
  return (
    <Panel aria-labelledby="virement-title">
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
            Suivi administratif
          </p>
          <h2 id="virement-title">Autorisation de virement</h2>
        </div>
        {current && <strong>{stateLabels[current.state]}</strong>}
      </div>
      <p>
        Cette autorisation porte sur le montant de décaissement déjà approuvé.
        Elle ne confirme pas qu’un virement externe a été effectué.
      </p>
      {current?.state === 'returned' && <p>{strings.virementReturned}</p>}
      {current ? (
        <>
          <p className="border-l-4 border-l-primary bg-background py-3 px-4">
            Montant verrouillé : <strong>{formatXof(current.amount)}</strong>.
            L’autorisation de décaissement et les dépenses restent figées, même
            si cette demande est annulée.
          </p>
          {selectedBySearch && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onSelect('')}
            >
              Fermer le détail
            </Button>
          )}
          <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
            {current.decisions.map((decision) => (
              <li key={decision.id}>
                <strong>
                  {decision.stage === 'supervisor'
                    ? 'Superviseur'
                    : 'Validateur'}{' '}
                  · {stateLabels[decision.outcome] || decision.outcome}
                </strong>
                {decision.reason && <p>{decision.reason}</p>}
              </li>
            ))}
          </ol>
          <div className="flex gap-2 items-end flex-wrap">
            {current.allowed_actions.includes('prevalidate') && (
              <Button
                disabled={pending || !navigator.onLine}
                onClick={() =>
                  mutate(`/virement-requests/${current.id}/decisions`, {
                    expected_version: version,
                    decision: 'prevalidate',
                  })
                }
              >
                <ShieldCheck size={16} /> Prévalider
              </Button>
            )}
            {current.allowed_actions.includes('approve') && (
              <Button
                disabled={pending || !navigator.onLine}
                onClick={() =>
                  mutate(`/virement-requests/${current.id}/decisions`, {
                    expected_version: version,
                    decision: 'approve',
                  })
                }
              >
                <ShieldCheck size={16} /> Autoriser
              </Button>
            )}
          </div>
          {current.state === 'approved' && (
            <Panel as="div">
              <h3>Virement externe déclaré</h3>
              <p>
                MJL enregistre la déclaration de l’Agent sans vérifier le
                mouvement bancaire. Le montant doit correspondre exactement à{' '}
                <strong>{formatXof(current.amount)}</strong>.
              </p>
              {current.current_confirmation && (
                <dl className="grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] [&_dd]:mt-1 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-lg [&_dd]:font-semibold [&_dd]:text-navy">
                  <div>
                    <dt>Date effective</dt>
                    <dd>{current.current_confirmation.transfer_date}</dd>
                  </div>
                  <div>
                    <dt>Référence ou commentaire</dt>
                    <dd>{current.current_confirmation.note || '—'}</dd>
                  </div>
                  <div>
                    <dt>Déclaré par</dt>
                    <dd>{current.current_confirmation.actor_id}</dd>
                  </div>
                  <div>
                    <dt>Enregistré le</dt>
                    <dd>
                      <time dateTime={current.current_confirmation.recorded_at}>
                        {current.current_confirmation.recorded_at}
                      </time>
                    </dd>
                  </div>
                </dl>
              )}
              {(current.allowed_actions.includes('declare_confirmation') ||
                current.allowed_actions.includes('correct_confirmation')) && (
                <BusinessForm
                  key={current.current_confirmation?.revision || 'initial'}
                  className="[&_>_label]:w-full"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const data = new FormData(event.currentTarget)
                    const correcting = Boolean(current.current_confirmation)
                    return mutate(
                      `/virement-requests/${current.id}/confirmation${
                        correcting ? '/corrections' : ''
                      }`,
                      {
                        expected_version: version,
                        transfer_date: String(data.get('transfer_date') || ''),
                        note: String(data.get('note') || ''),
                        ...(correcting
                          ? { reason: String(data.get('reason') || '') }
                          : {}),
                      },
                    )
                  }}
                >
                  <label>
                    Date effective du virement
                    <input
                      type="date"
                      name="transfer_date"
                      required
                      defaultValue={current.current_confirmation?.transfer_date}
                    />
                  </label>
                  <label>
                    Référence ou commentaire (facultatif)
                    <textarea
                      name="note"
                      maxLength="4000"
                      defaultValue={current.current_confirmation?.note || ''}
                    />
                  </label>
                  {current.current_confirmation && (
                    <label>
                      Motif de la correction
                      <textarea name="reason" required maxLength="4000" />
                    </label>
                  )}
                  <label>
                    <input type="checkbox" required /> Je confirme que ce
                    montant a été viré.
                  </label>
                  <Button type="submit" disabled={pending || !navigator.onLine}>
                    {current.current_confirmation
                      ? 'Corriger la déclaration'
                      : 'Enregistrer la déclaration'}
                  </Button>
                </BusinessForm>
              )}
              {confirmationHistory?.data?.length > 0 && (
                <details>
                  <summary>
                    Historique des déclarations ({confirmationHistory.count})
                  </summary>
                  <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
                    {confirmationHistory.data.map((entry) => (
                      <li key={entry.id}>
                        <strong>
                          Version {entry.revision} · {formatXof(entry.amount)} ·{' '}
                          {entry.transfer_date}
                        </strong>
                        {entry.note && <p>{entry.note}</p>}
                        <p>
                          Déclaré par {entry.actor_id} ·{' '}
                          <time dateTime={entry.recorded_at}>
                            {entry.recorded_at}
                          </time>
                        </p>
                        {entry.correction_reason && (
                          <p>Motif : {entry.correction_reason}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                  {(confirmationHistory.previous ||
                    confirmationHistory.next) && (
                    <nav
                      className="flex gap-2 items-end flex-wrap"
                      aria-label="Pagination des déclarations de virement"
                    >
                      <Button
                        variant="outline"
                        disabled={!confirmationHistory.previous}
                        onClick={() =>
                          onConfirmationPage(confirmationHistory.previous)
                        }
                      >
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!confirmationHistory.next}
                        onClick={() =>
                          onConfirmationPage(confirmationHistory.next)
                        }
                      >
                        Suivant
                      </Button>
                    </nav>
                  )}
                </details>
              )}
              {current.reversement && (
                <Panel aria-labelledby="reversement-title">
                  <h3 id="reversement-title">Reversement au Partenaire</h3>
                  <p>
                    Montant autorisé :{' '}
                    <strong>{formatXof(detail.approved_allocation)}</strong> ·
                    montant dépensé :{' '}
                    <strong>{formatXof(current.amount)}</strong>.
                  </p>
                  <dl className="grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] [&_dd]:mt-1 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-lg [&_dd]:font-semibold [&_dd]:text-navy">
                    <div>
                      <dt>Montant à reverser</dt>
                      <dd>{formatXof(current.reversement.required_amount)}</dd>
                    </div>
                    <div>
                      <dt>Montant déclaré reversé</dt>
                      <dd>{formatXof(current.reversement.declared_amount)}</dd>
                    </div>
                  </dl>
                  {current.reversement.status === 'not_required' && (
                    <p className="border-l-4 border-l-primary bg-background py-3 px-4">
                      <CheckCircle2 size={16} aria-hidden="true" /> Aucun
                      reversement requis.
                    </p>
                  )}
                  {current.reversement.current_declaration && (
                    <dl className="grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] [&_dd]:mt-1 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-lg [&_dd]:font-semibold [&_dd]:text-navy">
                      <div>
                        <dt>Date effective du reversement</dt>
                        <dd>
                          {current.reversement.current_declaration.return_date}
                        </dd>
                      </div>
                      <div>
                        <dt>Référence ou commentaire</dt>
                        <dd>
                          {current.reversement.current_declaration.note || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Déclaré par</dt>
                        <dd>
                          {current.reversement.current_declaration.actor_id}
                        </dd>
                      </div>
                      <div>
                        <dt>Enregistré le</dt>
                        <dd>
                          <time
                            dateTime={
                              current.reversement.current_declaration
                                .recorded_at
                            }
                          >
                            {
                              current.reversement.current_declaration
                                .recorded_at
                            }
                          </time>
                        </dd>
                      </div>
                    </dl>
                  )}
                  {(current.reversement.allowed_actions.includes('declare') ||
                    current.reversement.allowed_actions.includes(
                      'correct',
                    )) && (
                    <BusinessForm
                      key={
                        current.reversement.current_declaration?.revision ||
                        'initial'
                      }
                      className="[&_>_label]:w-full"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const data = new FormData(event.currentTarget)
                        const correcting = Boolean(
                          current.reversement.current_declaration,
                        )
                        return mutate(
                          `/virement-requests/${current.id}/reversement${
                            correcting ? '/corrections' : ''
                          }`,
                          {
                            expected_version: version,
                            return_date: String(data.get('return_date') || ''),
                            note: String(data.get('reversement_note') || ''),
                            ...(correcting
                              ? {
                                  reason: String(
                                    data.get('reversement_reason') || '',
                                  ),
                                }
                              : {}),
                          },
                        )
                      }}
                    >
                      <label>
                        Date effective du reversement
                        <input
                          type="date"
                          name="return_date"
                          required
                          defaultValue={
                            current.reversement.current_declaration?.return_date
                          }
                        />
                      </label>
                      <label>
                        Référence ou commentaire du reversement (facultatif)
                        <textarea
                          name="reversement_note"
                          maxLength="4000"
                          defaultValue={
                            current.reversement.current_declaration?.note || ''
                          }
                        />
                      </label>
                      {current.reversement.current_declaration && (
                        <label>
                          Motif de la correction du reversement
                          <textarea
                            name="reversement_reason"
                            required
                            maxLength="4000"
                          />
                        </label>
                      )}
                      <label>
                        <input type="checkbox" required /> Je confirme que ce
                        montant exact a été reversé au Partenaire.
                      </label>
                      <Button
                        type="submit"
                        disabled={pending || !navigator.onLine}
                      >
                        {current.reversement.current_declaration
                          ? 'Corriger le reversement'
                          : 'Enregistrer le reversement'}
                      </Button>
                    </BusinessForm>
                  )}
                  {reversementHistory?.data?.length > 0 && (
                    <details>
                      <summary>
                        Historique des reversements ({reversementHistory.count})
                      </summary>
                      <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
                        {reversementHistory.data.map((entry) => (
                          <li key={entry.id}>
                            <strong>
                              Version {entry.revision} ·{' '}
                              {formatXof(entry.returned_amount)} ·{' '}
                              {entry.return_date}
                            </strong>
                            {entry.note && <p>{entry.note}</p>}
                            <p>
                              Déclaré par {entry.actor_id} ·{' '}
                              <time dateTime={entry.recorded_at}>
                                {entry.recorded_at}
                              </time>
                            </p>
                            {entry.correction_reason && (
                              <p>Motif : {entry.correction_reason}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                      {(reversementHistory.previous ||
                        reversementHistory.next) && (
                        <nav
                          className="flex gap-2 items-end flex-wrap"
                          aria-label="Pagination des déclarations de reversement"
                        >
                          <Button
                            variant="outline"
                            disabled={!reversementHistory.previous}
                            onClick={() =>
                              onReversementPage(reversementHistory.previous)
                            }
                          >
                            Précédent
                          </Button>
                          <Button
                            variant="outline"
                            disabled={!reversementHistory.next}
                            onClick={() =>
                              onReversementPage(reversementHistory.next)
                            }
                          >
                            Suivant
                          </Button>
                        </nav>
                      )}
                    </details>
                  )}
                </Panel>
              )}
            </Panel>
          )}
          {(current.allowed_actions.includes('return') ||
            current.allowed_actions.includes('cancel')) && (
            <BusinessForm
              className="[&_>_label]:w-full"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const reason = String(data.get('reason') || '')
                const cancellation =
                  event.nativeEvent.submitter?.value === 'cancel'
                return mutate(
                  `/virement-requests/${current.id}/${
                    cancellation ? 'cancellation' : 'decisions'
                  }`,
                  cancellation
                    ? { expected_version: version, reason }
                    : {
                        expected_version: version,
                        decision: 'return',
                        reason,
                      },
                )
              }}
            >
              <label>
                Motif obligatoire
                <textarea name="reason" required maxLength="4000" />
              </label>
              <div className="flex gap-2 items-end flex-wrap">
                {current.allowed_actions.includes('return') && (
                  <Button
                    type="submit"
                    value="return"
                    variant="outline"
                    disabled={pending || !navigator.onLine}
                  >
                    Retourner
                  </Button>
                )}
                {current.allowed_actions.includes('cancel') && (
                  <Button
                    type="submit"
                    value="cancel"
                    variant="outline"
                    disabled={pending || !navigator.onLine}
                  >
                    <XCircle size={16} /> Annuler la demande
                  </Button>
                )}
              </div>
            </BusinessForm>
          )}
        </>
      ) : null}
      {(!current || ['returned', 'cancelled'].includes(current.state)) &&
        (role === 'AGENT_SAISIE' && !historicalPage ? (
          <Button
            disabled={!context.can_submit || pending || !navigator.onLine}
            onClick={() =>
              mutate('/virement-requests', {
                expected_version: detail.version,
                expected_disbursement_request_id:
                  context.disbursement_request_id,
              })
            }
          >
            <CircleDollarSign size={16} /> Demander le virement de{' '}
            {context.amount ? formatXof(context.amount) : '—'}
          </Button>
        ) : (
          <p>
            {context.unavailable_reason === 'disbursement_required'
              ? 'L’autorisation de décaissement doit être approuvée auparavant.'
              : 'Consultez l’état et l’historique de l’autorisation.'}
          </p>
        ))}
      {requests.length > 0 && (
        <details>
          <summary>Historique des demandes ({result.count})</summary>
          <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
            {requests.map((request) => (
              <li key={request.id}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSelect(request.id)}
                >
                  {stateLabels[request.state]} · {formatXof(request.amount)}
                </Button>
                {request.cancellation?.reason && (
                  <p>{request.cancellation.reason}</p>
                )}
              </li>
            ))}
          </ol>
          {(result.previous || result.next) && (
            <nav
              className="flex gap-2 items-end flex-wrap"
              aria-label="Pagination des virements"
            >
              <Button
                variant="outline"
                disabled={!result.previous}
                onClick={() => onPage(result.previous)}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                disabled={!result.next}
                onClick={() => onPage(result.next)}
              >
                Suivant
              </Button>
            </nav>
          )}
        </details>
      )}
    </Panel>
  )
}

function OperationCard({ activity, operation, pending, mutate }) {
  const draftBasis = useRef(null)
  const formRef = useRef(null)
  useEffect(() => {
    if (!draftBasis.current) formRef.current?.reset()
  }, [
    operation.actual_spent,
    operation.execution_completed,
    operation.execution_observation,
  ])
  const correction =
    operation.actual_spent !== null ||
    operation.execution_observation ||
    operation.execution_completed
  return (
    <Panel
      as="article"
      className="[&_>_p]:flex [&_>_p]:items-center [&_>_p]:gap-2"
    >
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
            {operation.type_label}
          </p>
          <h2>{operation.name}</h2>
        </div>
        <span>{formatXof(operation.approved_allocation)} autorisés</span>
      </div>
      {operation.execution_started_at ? (
        <p>
          <Play size={16} aria-hidden="true" /> Démarrée le{' '}
          {new Date(operation.execution_started_at).toLocaleString('fr-FR')}
        </p>
      ) : (
        operation.allowed_actions.includes('start') && (
          <Button
            disabled={pending || !navigator.onLine}
            onClick={() =>
              mutate(operation.id, {
                action: 'start',
                expected_version: activity.version,
                expected_approved_revision_id: activity.approved_revision_id,
              })
            }
          >
            <Play size={16} /> Démarrer
          </Button>
        )
      )}
      {operation.variance !== null && (
        <p>Écart avec le montant autorisé : {formatXof(operation.variance)}</p>
      )}
      {operation.allowed_actions.includes('record') && (
        <BusinessForm
          formRef={formRef}
          className="[&_>_label]:w-full"
          onChangeCapture={() => {
            draftBasis.current ??= {
              version: activity.version,
              revision: activity.approved_revision_id,
            }
          }}
          onReset={() => {
            draftBasis.current = null
          }}
          onSubmit={async (event) => {
            event.preventDefault()
            const form = event.currentTarget
            const data = new FormData(form)
            const amount = String(data.get('actual_spent') || '')
            const body = {
              action: 'record',
              expected_version: draftBasis.current?.version ?? activity.version,
              expected_approved_revision_id:
                draftBasis.current?.revision ?? activity.approved_revision_id,
              actual_spent: amount || null,
              execution_completed: data.get('execution_completed') === 'on',
              execution_observation: String(
                data.get('execution_observation') || '',
              ),
            }
            const reason = String(data.get('correction_reason') || '')
            if (reason) body.correction_reason = reason
            const result = await mutate(operation.id, body)
            if (result !== false) {
              draftBasis.current = null
              form.reset()
            }
            return result
          }}
        >
          <div className="flex gap-3 items-end flex-wrap">
            <label>
              {strings.actualSpent}
              <input
                name="actual_spent"
                inputMode="numeric"
                pattern="(0|[1-9][0-9]*)"
                defaultValue={operation.actual_spent ?? ''}
              />
            </label>
            <label className="grid-cols-[auto_1fr] items-center min-h-11 [&_input]:min-h-auto [&_input]:w-5 [&_input]:h-5">
              <input
                name="execution_completed"
                type="checkbox"
                defaultChecked={operation.execution_completed}
              />
              Opération terminée
            </label>
          </div>
          <label>
            Observation
            <textarea
              name="execution_observation"
              maxLength="4000"
              defaultValue={operation.execution_observation}
            />
          </label>
          {correction && (
            <label>
              Motif de la correction
              <textarea name="correction_reason" maxLength="4000" />
            </label>
          )}
          <Button type="submit" disabled={pending || !navigator.onLine}>
            {operation.execution_completed ? (
              <CheckCircle2 size={16} />
            ) : (
              <CircleDollarSign size={16} />
            )}
            Enregistrer
          </Button>
          <Button type="reset" variant="outline" disabled={pending}>
            {strings.cancelEntry}
          </Button>
        </BusinessForm>
      )}
    </Panel>
  )
}

function FundingSection({ detail, result, pending, mutate, onPage, fallback }) {
  if (!result) return fallback
  const basis = result.pending[0]
  const currentSnapshot = result.activity_version === detail.version
  const states = {
    submitted: strings.fundingSubmitted,
    prevalidated: strings.fundingPrevalidated,
    approved: strings.fundingApproved,
    returned: strings.fundingReturned,
    cancelled: strings.fundingCancelled,
  }
  return (
    <Panel aria-labelledby="funding-title">
      <h2 id="funding-title">{strings.fundingTitle}</h2>
      <p>{strings.fundingExplanation}</p>
      {detail.pause_reason === 'funding_required' && (
        <p>{strings.fundingCorrection}</p>
      )}
      {basis && (
        <p>
          {strings.fundingOldBudget} : {formatXof(basis.old_allocation)} ·{' '}
          {strings.fundingNewBudget} : {formatXof(basis.new_allocation)} ·{' '}
          {strings.fundingIncrement} :{' '}
          <strong>{formatXof(basis.amount)}</strong>
        </p>
      )}
      {result.allowed_actions.includes('submit') && (
        <Button
          disabled={pending || !currentSnapshot}
          onClick={() =>
            mutate('/funding-requests', {
              expected_version: result.activity_version,
              expected_approved_revision_id: result.approved_revision_id,
            })
          }
        >
          {strings.fundingSubmit}
        </Button>
      )}
      {!basis && !result.count && <p>{strings.fundingEmpty}</p>}
      {result.data.map((row) => (
        <FundingRequest
          key={`${row.id}:${row.state}`}
          row={row}
          version={result.activity_version}
          enabled={currentSnapshot && detail.state === 'approved'}
          pending={pending}
          mutate={mutate}
          states={states}
        />
      ))}
      {(result.previous || result.next) && (
        <nav
          className="flex gap-2 items-end flex-wrap"
          aria-label={strings.fundingPagination}
        >
          <Button
            variant="outline"
            disabled={!result.previous}
            onClick={() => onPage(result.previous)}
          >
            {strings.fundingPrevious}
          </Button>
          <Button
            variant="outline"
            disabled={!result.next}
            onClick={() => onPage(result.next)}
          >
            {strings.fundingNext}
          </Button>
        </nav>
      )}
    </Panel>
  )
}

function FundingRequest({ row, version, enabled, pending, mutate, states }) {
  const [reason, setReason] = useState('')
  const [editVersion, setEditVersion] = useState(version)
  const disabled = pending || !enabled || editVersion !== version
  const actions = row.allowed_actions
  const send = (action) =>
    mutate(
      `/funding-requests/${row.id}/${action === 'cancel' ? 'cancellation' : 'decisions'}`,
      {
        expected_version: editVersion,
        ...(action === 'cancel'
          ? { reason: reason.trim() }
          : {
              decision: action,
              ...(['return'].includes(action) ? { reason: reason.trim() } : {}),
            }),
      },
    )
  return (
    <article className="border-l-4 border-l-primary bg-background py-3 px-4">
      <h3>
        {formatXof(row.amount)} — {states[row.state]}
      </h3>
      <p>
        {strings.fundingBudget} : {formatXof(row.snapshot.old_allocation)} →{' '}
        {formatXof(row.snapshot.new_allocation)}
      </p>
      <time dateTime={row.submitted_at}>{row.submitted_at}</time>
      <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
        {row.decisions.map((decision) => (
          <li key={decision.id}>
            {decision.stage === 'supervisor'
              ? strings.fundingSupervisor
              : strings.fundingValidator}{' '}
            :{' '}
            {decision.outcome === 'returned'
              ? strings.fundingReturnedDecision
              : decision.outcome === 'approved'
                ? strings.fundingApprovedDecision
                : strings.fundingPrevalidatedDecision}
            <time dateTime={decision.decided_at}> · {decision.decided_at}</time>
            {decision.reason && <p>{decision.reason}</p>}
          </li>
        ))}
      </ol>
      {row.cancellation && (
        <p>
          {strings.fundingCancellationReason} : {row.cancellation.reason}
        </p>
      )}
      {(actions.includes('cancel') || actions.includes('return')) && (
        <label>
          {strings.fundingReason}
          <textarea
            maxLength={4000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={disabled}
          />
        </label>
      )}
      {actions.includes('prevalidate') && (
        <Button disabled={disabled} onClick={() => send('prevalidate')}>
          {strings.fundingPrevalidate}
        </Button>
      )}
      {actions.includes('approve') && (
        <Button disabled={disabled} onClick={() => send('approve')}>
          {strings.fundingApprove}
        </Button>
      )}
      {actions.includes('return') && (
        <Button
          variant="outline"
          disabled={disabled || !reason.trim()}
          onClick={() => send('return')}
        >
          {strings.fundingReturn}
        </Button>
      )}
      {actions.includes('cancel') && (
        <Button
          variant="outline"
          disabled={disabled || !reason.trim()}
          onClick={() => send('cancel')}
        >
          {strings.fundingCancel}
        </Button>
      )}
      {editVersion !== version && (
        <p>
          {strings.fundingStale}{' '}
          <Button
            variant="outline"
            onClick={() => {
              setReason('')
              setEditVersion(version)
            }}
          >
            {strings.fundingReload}
          </Button>
        </p>
      )}
    </article>
  )
}

export function ExecutionLoading({ screen }) {
  return (
    <PageLoading
      title={
        screen === 'list'
          ? strings.executionTitle
          : strings.executionDetailTitle
      }
      variant={screen === 'list' ? 'table' : 'detail'}
    />
  )
}

function executionStage(row) {
  if (row.closure) return strings.closedLabel
  if (
    row.pause_reason === 'funding_required' ||
    row.closure_blockers?.includes('financial_insufficiency_unresolved')
  )
    return strings.fundingStage
  if (row.execution_paused) return strings.pausedLabel
  if (row.closure_blockers?.includes('reversement_not_settled'))
    return strings.returnStage
  if (row.works_completed)
    return row.closure_blockers?.length
      ? strings.financialStage
      : strings.readyToClose
  return strings.ongoingStage
}
