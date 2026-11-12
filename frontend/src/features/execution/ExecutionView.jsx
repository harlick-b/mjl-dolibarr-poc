import { Urls } from '@/app/urls'
import { ActivityExplorerFilters } from '@/shared/ui/ActivityExplorerFilters'
import { strings as filterText } from '@/locales/fr/ListFilters'
import { EmptyContent } from '@/shared/ui/EmptyContent'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/session/SessionProvider'
import { authorization } from '@/features/auth/session/authorization'
import {
  PageLoading,
  RefreshIndicator,
  LoadingPlaceholder,
} from '@/shared/ui/PageLoading'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Modal } from '@/shared/ui/BusinessModal'
import { DatePicker } from '@/shared/ui/DatePicker'
import { ExecutionOperations, OperationEditor } from './ExecutionOperations'
import { strings } from '@/locales/fr/ExecutionView'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/button'
import { formatXof, formatDate, formatDateTime } from '@/shared/lib/format'
import { cursorFrom } from '@/shared/lib/pagination'
import { useAPI } from '@/shared/api/RestClientProvider'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'
import { AgentNames } from '@/shared/ui/AgentNames'

function cursorPath(path, cursor) {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path
}

const administrativeStates = {
  submitted: 'À examiner',
  prevalidated: 'Décision attendue',
  returned: 'À corriger',
  approved: 'Terminée',
  cancelled: 'Annulée',
}

function currentAdministrativeRow(result) {
  const current = result?.data?.find((row) => row.state !== 'cancelled')
  return current || result?.data?.[0]
}

function administrativeStatus(result, fallback = 'À venir') {
  const latest = currentAdministrativeRow(result)
  return latest ? administrativeStates[latest.state] || fallback : fallback
}

function hasAdministrativeAction(result) {
  const hasAction = (actions = []) =>
    actions.some((action) => action !== 'read')
  return (
    hasAction(result?.allowed_actions) ||
    result?.data?.some((row) => hasAction(row.allowed_actions))
  )
}

function hasUnresolvedAdministrativeStep(result) {
  return result?.data?.some(
    (row) => !['approved', 'cancelled'].includes(row.state),
  )
}

function administrativeStepCompleted(result) {
  return currentAdministrativeRow(result)?.state === 'approved'
}

function hasVirementFollowUp(result, selected) {
  const rows = [selected, ...(result?.data || [])].filter(Boolean)
  return rows.some(
    (row) =>
      (row.state === 'approved' && !row.current_confirmation) ||
      row.reversement?.allowed_actions?.some((action) =>
        ['declare', 'correct'].includes(action),
      ),
  )
}

function AdministrativeStep({
  title,
  description,
  status,
  completed = false,
  defaultOpen = false,
  children,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <details
      className="group border-t border-border first:border-t-0"
      open={isOpen}
    >
      <summary
        className="flex min-h-20 cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden"
        onClick={(event) => {
          event.preventDefault()
          setIsOpen((current) => !current)
        }}
      >
        <span
          className="grid size-6 shrink-0 place-items-center rounded-full border border-primary text-xs font-semibold text-primary"
          data-administrative-state={completed ? 'complete' : 'pending'}
          aria-hidden="true"
        >
          {completed ? '✓' : '•'}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm text-navy">{title}</strong>
          {description && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        <span className="rounded-md bg-background px-2.5 py-1 text-xs text-navy">
          {status}
        </span>
        <ChevronDown
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          size={18}
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-border bg-white px-5 pb-5 pt-1 [&>[data-ui='planning-card']]:rounded-none [&>[data-ui='planning-card']]:border-0 [&>[data-ui='planning-card']]:bg-transparent [&>[data-ui='planning-card']]:p-0 [&>[data-ui='planning-card']]:pt-4 [&>[data-ui='planning-card']]:shadow-none">
        {children}
      </div>
    </details>
  )
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

export function ExecutionView({ screen, embedded = false }) {
  const session = useSessionQuery()
  const params = useParams({ strict: false })
  if (session.isPending) return <ExecutionLoading screen={screen} />
  if (!authorization(session.data).can('business'))
    return <AccessDeniedState role={session.data?.user?.role} />
  return (
    <ExecutionWorkspace
      key={`${session.data.user.id}:${screen}:${params.activityId || params.ptaId || ''}`}
      screen={screen}
      embedded={embedded}
      session={session.data}
      onDenied={() => {}}
    />
  )
}

function ExecutionWorkspace({ screen, session, onDenied, embedded = false }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [reversementFile, setReversementFile] = useState(null)
  const [reversementUploadError, setReversementUploadError] = useState(null)
  const [uploadPending, setUploadPending] = useState(false)
  const uploadController = useRef(null)
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
    ['q', 'state', 'agent', 'from', 'to']
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
      uploadController.current?.abort()
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
        client.invalidateQueries({
          queryKey: ['notifications', session.user.id],
        }),
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
  if (primary.isPending)
    return embedded ? (
      <LoadingPlaceholder label={strings.executionDataLoading} />
    ) : (
      <ExecutionLoading screen={screen} />
    )
  if (relevant.some((query) => query.isPending && query.fetchStatus !== 'idle'))
    return embedded ? (
      <LoadingPlaceholder label={strings.executionDataLoading} />
    ) : (
      <ExecutionLoading screen={screen} />
    )
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
      {readError}
      <ExecutionDetail
        detail={detail.data}
        sectionFallbacks={{
          funding: missingRead(funding),
          finance: missingRead(finance),
          virements: missingRead(virements),
          zeroSpending: missingRead(zeroSpending),
        }}
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
          uploadPending ||
          detail.isFetching ||
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
        mutateFinance={async (path, body) => {
          const activeGeneration = generation.current
          const result = await financeMutation
            .mutateAsync({ path, body })
            .catch(() => false)
          return activeGeneration === generation.current ? result : false
        }}
        uploadReversementEvidence={async (file) => {
          if (uploadController.current)
            throw new DOMException('Upload pending', 'AbortError')
          const requestController = new AbortController()
          const activeGeneration = generation.current
          uploadController.current = requestController
          setUploadPending(true)
          const ensureCurrent = () => {
            if (
              requestController.signal.aborted ||
              activeGeneration !== generation.current
            )
              throw new DOMException('Cancelled upload', 'AbortError')
          }
          try {
            const path = `/api/v1/activities/${params.activityId}/documents`
            const before = await api.request(`${path}?limit=100`, {
              signal: requestController.signal,
            })
            const baseline = new Set(
              (before.data || []).map((document) => document.id),
            )
            ensureCurrent()
            try {
              await api.request(path, {
                method: 'POST',
                signal: requestController.signal,
                csrf: session.csrf,
                rawBody: file,
                headers: {
                  'Content-Type': file.type,
                  'X-File-Name': file.name,
                },
              })
            } catch (error) {
              ensureCurrent()
              if (
                !['network', 'malformed'].includes(error.kind) &&
                !(error.status >= 500)
              )
                throw error
              let after
              try {
                after = await api.request(`${path}?limit=100`, {
                  signal: requestController.signal,
                })
              } catch {
                ensureCurrent()
                const uncertain = new Error('reversement_upload_uncertain')
                uncertain.kind = 'uncertain_upload'
                throw uncertain
              }
              ensureCurrent()
              const recorded = (after.data || []).some(
                (document) =>
                  !baseline.has(document.id) &&
                  document.name === file.name &&
                  document.size === file.size &&
                  document.uploaded_by_id === session.user.id,
              )
              if (!recorded) throw error
            }
            ensureCurrent()
            await client.invalidateQueries({
              queryKey: ['planning', session.user.id, 'activity'],
            })
            ensureCurrent()
          } finally {
            uploadController.current = null
            if (activeGeneration === generation.current) setUploadPending(false)
          }
        }}
        reversementFile={reversementFile}
        setReversementFile={setReversementFile}
        reversementUploadError={reversementUploadError}
        setReversementUploadError={setReversementUploadError}
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
  const filtered = Boolean(
    filters.q || filters.state || filters.agent || filters.from || filters.to,
  )
  const rows = result?.data || []
  const stateOptions = [
    ['', filterText.all],
    ['ongoing', filterText.ongoing],
    ['physical', filterText.physical],
    ['review', filterText.review],
    ['transfer', filterText.transfer],
    ['reversal', filterText.reversal],
    ['ready', filterText.ready],
    ['closed', filterText.closed],
  ].map(([value, label]) => ({ value, label }))
  const quickStates = ['ongoing', 'review', 'reversal'].map((value) => ({
    value,
    label: filterText[value],
  }))
  return (
    <section className="grid gap-5">
      <Helmet>
        <title>{`${strings.listTitle} - MJL`}</title>
      </Helmet>
      {!embedded && (
        <h1 className="text-2xl font-semibold text-navy">
          {strings.listTitle}
        </h1>
      )}
      <div className="overflow-x-auto rounded-card border border-border bg-white">
        <ActivityExplorerFilters
          value={filters}
          onChange={(values) => onFilterChange?.(values)}
          agentPath={ptaId ? `/ptas/${ptaId}/execution/agents` : undefined}
          searchLabel={filterText.searchActivity}
          stateLabel={filterText.state}
          stateOptions={stateOptions}
          filterStates={stateOptions.filter((option) => option.value)}
          quickStates={quickStates}
          dates
          disabled={!ptaId}
        />
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
        <table className="w-full min-w-280 table-fixed text-left text-[0.8125rem] leading-5">
          <colgroup>
            <col className="w-[25%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
          </colgroup>
          {rows.length > 0 && (
            <thead className="bg-background border-b border-border">
              <tr>
                {strings.listColumns.map((label) => (
                  <th key={label} className="px-3 py-3 align-top font-medium">
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
                  className="border-b border-border align-top last:border-0"
                >
                  <td className="min-w-0 px-3 py-3">
                    <Link
                      className="block break-words font-medium text-primary"
                      to={Urls.activity}
                      params={{ activityId: row.id }}
                      search={{ tab: 'finance', origin: 'execution' }}
                      title={row.name}
                    >
                      {row.name}
                    </Link>
                    <small className="mt-1 block break-words text-muted-foreground">
                      {row.reference}
                      {row.project_name ? ` · ${row.project_name}` : ''}
                    </small>
                  </td>
                  <td className="px-3 py-3">
                    {formatDate(row.planned_start)}
                    <small className="block mt-1 text-muted-foreground">
                      au {formatDate(row.planned_end)}
                    </small>
                  </td>
                  <td className="px-3 py-3">
                    <strong>
                      {row.works_completed
                        ? strings.completedLabel
                        : strings.ongoingLabel}
                    </strong>
                    <small className="block mt-1 text-muted-foreground">
                      {row.completed_operations} / {row.operation_count}{' '}
                      {strings.operationsCompleted}
                    </small>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <strong>{formatXof(row.spending_total)}</strong>
                    <small className="block mt-1 text-muted-foreground">
                      {strings.formatString(strings.authorizedAmount, {
                        amount: formatXof(row.approved_allocation),
                      })}
                    </small>
                    {!row.works_completed && (
                      <small className="block mt-1 text-muted-foreground">
                        {strings.partialSpending}
                      </small>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <AgentNames activityId={row.id} names={row.agents} />
                  </td>
                  <td className="px-3 py-3">
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
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="min-w-24 whitespace-nowrap"
                    >
                      <Link
                        to={Urls.activity}
                        params={{ activityId: row.id }}
                        search={{ tab: 'finance', origin: 'execution' }}
                      >
                        {strings.followUp}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <EmptyContent
                    kind={
                      filtered
                        ? 'activitySearch'
                        : ptaId
                          ? 'execution'
                          : 'executionNoPta'
                    }
                    large
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
  uploadReversementEvidence,
  reversementFile,
  setReversementFile,
  reversementUploadError,
  setReversementUploadError,
  onFinancePage,
  onFinanceSelect,
  onZeroSpendingPage,
  onVirementPage,
  onVirementSelect,
  onConfirmationPage,
  onReversementPage,
}) {
  const [selectedOperationId, setSelectedOperationId] = useState(null)
  const operationOpener = useRef(null)
  const selectedOperation = detail.operations.find(
    (operation) => operation.id === selectedOperationId,
  )
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
  return (
    <section className="grid gap-6">
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
          {unavailableLabels[detail.pause_reason] ||
            'une action préalable reste nécessaire'}
          .
        </p>
      )}
      {!detail.execution_paused &&
        detail.mutation_unavailable_reason &&
        detail.mutation_unavailable_reason !== 'reviewer_read_only' && (
          <p
            role="status"
            className="border-l-4 border-l-primary bg-background py-3 px-4"
          >
            Modification indisponible :{' '}
            {unavailableLabels[detail.mutation_unavailable_reason] ||
              'une action préalable reste nécessaire'}
            .
          </p>
        )}
      <Panel
        as="dl"
        className="grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] [&_dd]:mt-1 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-xl [&_dd]:font-semibold [&_dd]:text-navy"
      >
        <div>
          <dt>{strings.currentBudget}</dt>
          <dd>{formatXof(detail.approved_allocation)}</dd>
        </div>
        <div>
          <dt>{strings.realization}</dt>
          <dd>{strings.realizationStates[detail.realization_status] || '—'}</dd>
        </div>
        <div>
          <dt>
            {strings.spentAmount} ·{' '}
            {detail.works_completed
              ? strings.finalAmount
              : strings.partialAmount}
          </dt>
          <dd>{formatXof(detail.spending_total)}</dd>
          <small className="text-muted-foreground">
            {detail.completed_operations} / {detail.operation_count}{' '}
            {strings.operationsCount}
          </small>
        </div>
        <div>
          <dt>{strings.unusedBalance}</dt>
          <dd>{formatXof(detail.balance)}</dd>
        </div>
        <div>
          <dt>{strings.requiredReversement}</dt>
          <dd>{formatXof(detail.required_reversement)}</dd>
        </div>
      </Panel>
      <ExecutionOperations
        detail={detail}
        onSelect={(operationId, opener) => {
          operationOpener.current = opener
          setSelectedOperationId(operationId)
        }}
      />
      <Modal
        open={Boolean(selectedOperation)}
        onClose={() => setSelectedOperationId(null)}
        label={selectedOperation?.name || 'Opération'}
        opener={operationOpener}
        className="w-[min(640px,calc(100%-32px))]"
      >
        {selectedOperation && (
          <OperationEditor
            activity={detail}
            operation={selectedOperation}
            pending={pending}
            mutate={mutate}
          />
        )}
      </Modal>
      <section
        aria-labelledby="administrative-title"
        className="overflow-hidden rounded-panel border border-border bg-white"
      >
        <header className="px-6 py-5">
          <h2 id="administrative-title" className="font-semibold text-navy">
            {strings.administrativeFollowUp}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {executionStage(detail)}
          </p>
        </header>
        <div>
          {detail.works_completed && detail.spending_total === '0' && (
            <AdministrativeStep
              key={`zero:${administrativeStatus(zeroSpending, 'À déclarer')}`}
              title="Déclaration sans dépense"
              description="Confirmer qu’aucune dépense n’a été engagée."
              status={administrativeStatus(zeroSpending, 'À déclarer')}
              completed={administrativeStepCompleted(zeroSpending)}
              defaultOpen={
                hasAdministrativeAction(zeroSpending) ||
                hasUnresolvedAdministrativeStep(zeroSpending) ||
                (role === 'AGENT_SAISIE' && !zeroSpending?.count)
              }
            >
              <ZeroSpendingSection
                fallback={sectionFallbacks.zeroSpending}
                detail={detail}
                result={zeroSpending}
                role={role}
                pending={pending}
                mutate={mutateFinance}
                onPage={onZeroSpendingPage}
              />
            </AdministrativeStep>
          )}
          {(detail.spending_total !== '0' || finance?.count > 0) && (
            <>
              <AdministrativeStep
                key={`disbursement:${administrativeStatus(finance, 'À demander')}`}
                title="Autorisation de décaissement"
                description="Faire approuver le montant final à décaisser."
                status={administrativeStatus(finance, 'À demander')}
                completed={administrativeStepCompleted(finance)}
                defaultOpen={
                  hasAdministrativeAction(finance) ||
                  hasUnresolvedAdministrativeStep(finance) ||
                  (role === 'AGENT_SAISIE' &&
                    detail.works_completed &&
                    Number(detail.spending_total) > 0 &&
                    !finance?.data?.some(
                      (row) => !['returned', 'cancelled'].includes(row.state),
                    ))
                }
              >
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
              </AdministrativeStep>
              {detail.spending_total !== '0' && (
                <AdministrativeStep
                  key={`virement:${administrativeStatus(virements, 'À venir')}:${Boolean(detail.virement_context?.can_submit)}:${selectedVirement?.id || ''}:${Boolean(selectedVirement?.current_confirmation)}:${selectedVirement?.reversement?.allowed_actions?.join(',') || ''}`}
                  title="Autorisation de virement"
                  description="Faire autoriser le virement du montant approuvé."
                  status={administrativeStatus(virements, 'À venir')}
                  completed={administrativeStepCompleted(virements)}
                  defaultOpen={
                    hasAdministrativeAction(virements) ||
                    hasUnresolvedAdministrativeStep(virements) ||
                    hasVirementFollowUp(virements, selectedVirement) ||
                    (role === 'AGENT_SAISIE' &&
                      detail.virement_context?.can_submit)
                  }
                >
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
                    uploadReversementEvidence={uploadReversementEvidence}
                    reversementFile={reversementFile}
                    setReversementFile={setReversementFile}
                    reversementUploadError={reversementUploadError}
                    setReversementUploadError={setReversementUploadError}
                    onPage={onVirementPage}
                    onSelect={onVirementSelect}
                    onConfirmationPage={onConfirmationPage}
                    onReversementPage={onReversementPage}
                  />
                </AdministrativeStep>
              )}
            </>
          )}
          {(detail.pause_reason === 'funding_required' ||
            funding?.count > 0 ||
            funding?.pending?.length > 0) && (
            <AdministrativeStep
              key={`funding:${administrativeStatus(funding, 'À traiter')}`}
              title="Financement complémentaire"
              description="Traiter l’écart entre le budget et la dépense finale."
              status={administrativeStatus(funding, 'À traiter')}
              completed={administrativeStepCompleted(funding)}
              defaultOpen={
                detail.pause_reason === 'funding_required' ||
                hasAdministrativeAction(funding) ||
                hasUnresolvedAdministrativeStep(funding)
              }
            >
              <FundingSection
                fallback={sectionFallbacks.funding}
                detail={detail}
                result={funding}
                pending={pending}
                mutate={mutateFinance}
                onPage={onFundingPage}
              />
            </AdministrativeStep>
          )}
          <AdministrativeStep
            key={`closure:${Boolean(detail.closure)}:${detail.allowed_actions?.includes('close')}`}
            title="Clôture de l’activité"
            description="Confirmer que l’activité et son règlement sont terminés."
            status={detail.closure ? 'Terminée' : 'À venir'}
            completed={Boolean(detail.closure)}
            defaultOpen={detail.allowed_actions?.includes('close')}
          >
            <ClosureSection
              detail={detail}
              pending={pending}
              mutate={mutateFinance}
            />
          </AdministrativeStep>
        </div>
      </section>
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
                Motif du retour *
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
            Motif de l’absence de dépense *
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
              <dt>Clôturée le</dt>
              <dd>
                <time dateTime={detail.closure.closed_at}>
                  {formatDateTime(detail.closure.closed_at)}
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
                <li key={blocker}>
                  {blockerLabels[blocker] ||
                    'Une étape administrative reste à terminer.'}
                </li>
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
                est entièrement réalisée et réglée. *
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
                Motif *
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
  uploadReversementEvidence,
  reversementFile,
  setReversementFile,
  reversementUploadError,
  setReversementUploadError,
  onPage,
  onSelect,
  onConfirmationPage,
  onReversementPage,
}) {
  const [reversementOpen, setReversementOpen] = useState(false)
  const [reversementDate, setReversementDate] = useState('')
  const reversementOpener = useRef(null)
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
          <h2 id="virement-title">Autorisation de virement</h2>
        </div>
        {current && <strong>{stateLabels[current.state]}</strong>}
      </div>
      <p>
        Cette autorisation porte sur le montant de décaissement déjà approuvé.
        Elle ne confirme pas qu’un virement externe a été effectué.
      </p>
      {current?.state === 'returned' && <p>{strings.virementReturned}</p>}
      {reversementUploadError && reversementFile && (
        <div role="alert" className="grid gap-3 border-l-4 border-l-danger p-3">
          <p>
            {reversementUploadError === 'uncertain'
              ? 'Le reversement est enregistré. La réponse de l’ajout est incertaine : vérifiez les pièces justificatives avant tout nouvel essai.'
              : reversementUploadError === 'forbidden'
                ? 'Le reversement est enregistré, mais votre affectation ou la clôture ne permet plus d’ajouter cette pièce.'
                : 'Le reversement est enregistré, mais la pièce n’a pas pu être ajoutée.'}
          </p>
          {reversementUploadError === 'retry' && (
            <Button
              type="button"
              variant="outline"
              disabled={pending || !navigator.onLine}
              onClick={async () => {
                try {
                  await uploadReversementEvidence(reversementFile)
                  setReversementUploadError(null)
                  setReversementFile(null)
                  setReversementOpen(false)
                  toast.success('Pièce justificative ajoutée.')
                } catch (error) {
                  if (error.name === 'AbortError') return
                  setReversementUploadError(
                    error.kind === 'uncertain_upload'
                      ? 'uncertain'
                      : [403, 409].includes(error.status)
                        ? 'forbidden'
                        : 'retry',
                  )
                }
              }}
            >
              Réessayer l’ajout de la pièce
            </Button>
          )}
        </div>
      )}
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
            <AdministrativeStep
              key={`confirmation:${Boolean(current.current_confirmation)}`}
              title="Confirmation du virement externe"
              description="Enregistrer la date et la référence du virement effectué."
              status={current.current_confirmation ? 'Confirmé' : 'À confirmer'}
              completed={Boolean(current.current_confirmation)}
              defaultOpen={
                !current.current_confirmation ||
                current.allowed_actions.some((action) =>
                  ['declare_confirmation', 'correct_confirmation'].includes(
                    action,
                  ),
                ) ||
                current.reversement?.allowed_actions?.some((action) =>
                  ['declare', 'correct'].includes(action),
                )
              }
            >
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
                    <dd>
                      {formatDate(current.current_confirmation.transfer_date)}
                    </dd>
                  </div>
                  <div>
                    <dt>Référence ou commentaire</dt>
                    <dd>{current.current_confirmation.note || '—'}</dd>
                  </div>
                  <div>
                    <dt>Enregistré le</dt>
                    <dd>
                      <time dateTime={current.current_confirmation.recorded_at}>
                        {formatDateTime(
                          current.current_confirmation.recorded_at,
                        )}
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
                    Date effective du virement *
                    <input
                      type="date"
                      name="transfer_date"
                      required
                      defaultValue={current.current_confirmation?.transfer_date}
                    />
                  </label>
                  <label>
                    Référence ou commentaire
                    <textarea
                      name="note"
                      maxLength="4000"
                      defaultValue={current.current_confirmation?.note || ''}
                    />
                  </label>
                  {current.current_confirmation && (
                    <label>
                      Motif de la correction *
                      <textarea name="reason" required maxLength="4000" />
                    </label>
                  )}
                  <label>
                    <input type="checkbox" required /> Je confirme que ce
                    montant a été viré. *
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
                          {entry.correction_reason
                            ? 'Déclaration corrigée'
                            : 'Déclaration initiale'}
                        </strong>
                        <p>
                          {formatXof(entry.amount)} · Date effective :{' '}
                          {formatDate(entry.transfer_date)}
                        </p>
                        {entry.note && <p>{entry.note}</p>}
                        <p>Déclarée par {entry.actor_name}</p>
                        <p>
                          <time dateTime={entry.recorded_at}>
                            Enregistrée le {formatDateTime(entry.recorded_at)}
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
                          {formatDate(
                            current.reversement.current_declaration.return_date,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Référence ou commentaire</dt>
                        <dd>
                          {current.reversement.current_declaration.note || '—'}
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
                            {formatDateTime(
                              current.reversement.current_declaration
                                .recorded_at,
                            )}
                          </time>
                        </dd>
                      </div>
                    </dl>
                  )}
                  {(current.reversement.allowed_actions.includes('declare') ||
                    current.reversement.allowed_actions.includes(
                      'correct',
                    )) && (
                    <>
                      <Button
                        ref={reversementOpener}
                        type="button"
                        onClick={() => {
                          setReversementDate(
                            current.reversement.current_declaration
                              ?.return_date || '',
                          )
                          setReversementOpen(true)
                        }}
                      >
                        {current.reversement.current_declaration
                          ? 'Corriger le reversement'
                          : strings.recordReversement}
                      </Button>
                      <Modal
                        open={reversementOpen}
                        onClose={() => setReversementOpen(false)}
                        label={
                          current.reversement.current_declaration
                            ? 'Corriger le reversement'
                            : 'Enregistrer le reversement'
                        }
                        opener={reversementOpener}
                      >
                        <BusinessForm
                          key={
                            current.reversement.current_declaration?.revision ||
                            'initial'
                          }
                          className="[&_>_label]:w-full"
                          onSubmit={async (event) => {
                            event.preventDefault()
                            const data = new FormData(event.currentTarget)
                            const correcting = Boolean(
                              current.reversement.current_declaration,
                            )
                            setReversementOpen(false)
                            const saved = await mutate(
                              `/virement-requests/${current.id}/reversement${
                                correcting ? '/corrections' : ''
                              }`,
                              {
                                expected_version: version,
                                return_date: String(
                                  data.get('return_date') || '',
                                ),
                                note: String(
                                  data.get('reversement_note') || '',
                                ),
                                ...(correcting
                                  ? {
                                      reason: String(
                                        data.get('reversement_reason') || '',
                                      ),
                                    }
                                  : {}),
                              },
                            )
                            if (!saved) {
                              setReversementOpen(true)
                              return
                            }
                            if (reversementFile) {
                              try {
                                await uploadReversementEvidence(reversementFile)
                                toast.success(
                                  'Reversement et pièce justificative enregistrés.',
                                )
                                setReversementFile(null)
                              } catch (error) {
                                if (error.name === 'AbortError') return
                                setReversementUploadError(
                                  error.kind === 'uncertain_upload'
                                    ? 'uncertain'
                                    : [403, 409].includes(error.status)
                                      ? 'forbidden'
                                      : 'retry',
                                )
                                return
                              }
                            }
                          }}
                        >
                          <p className="border-l-4 border-l-primary bg-background py-3 px-4">
                            {strings.exactReversement} :{' '}
                            <strong>
                              {formatXof(current.reversement.required_amount)}
                            </strong>
                          </p>
                          <div className="grid gap-[6px] text-[0.8125rem] font-medium">
                            <span>Date effective du reversement *</span>
                            <DatePicker
                              label="Date effective du reversement"
                              value={reversementDate}
                              onChange={setReversementDate}
                            />
                            <input
                              type="hidden"
                              name="return_date"
                              value={reversementDate}
                            />
                          </div>
                          <label>
                            Référence ou commentaire du reversement
                            <textarea
                              name="reversement_note"
                              maxLength="4000"
                              defaultValue={
                                current.reversement.current_declaration?.note ||
                                ''
                              }
                            />
                          </label>
                          {current.reversement.current_declaration && (
                            <label>
                              Motif de la correction du reversement *
                              <textarea
                                name="reversement_reason"
                                required
                                maxLength="4000"
                              />
                            </label>
                          )}
                          <label>
                            Pièce justificative du reversement (facultative)
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png"
                              onChange={(event) => {
                                setReversementFile(
                                  event.target.files?.[0] || null,
                                )
                                setReversementUploadError(null)
                              }}
                            />
                          </label>
                          <label>
                            <input type="checkbox" required /> Je confirme que
                            ce montant exact a été reversé au Partenaire. *
                          </label>
                          <div data-ui="modal-actions">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setReversementOpen(false)}
                            >
                              Annuler
                            </Button>
                            <Button
                              type="submit"
                              disabled={
                                !reversementDate || pending || !navigator.onLine
                              }
                            >
                              {current.reversement.current_declaration
                                ? 'Corriger le reversement'
                                : 'Enregistrer le reversement'}
                            </Button>
                          </div>
                        </BusinessForm>
                      </Modal>
                    </>
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
                              {entry.correction_reason
                                ? 'Reversement corrigé'
                                : 'Reversement initial'}
                            </strong>
                            <p>
                              {formatXof(entry.returned_amount)} · Date
                              effective : {formatDate(entry.return_date)}
                            </p>
                            {entry.note && <p>{entry.note}</p>}
                            <p>Déclaré par {entry.actor_name}</p>
                            <p>
                              <time dateTime={entry.recorded_at}>
                                Enregistré le{' '}
                                {formatDateTime(entry.recorded_at)}
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
            </AdministrativeStep>
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
                Motif *
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
      <time dateTime={row.submitted_at}>
        {formatDateTime(row.submitted_at)}
      </time>
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
            <time dateTime={decision.decided_at}>
              {' '}
              · {formatDateTime(decision.decided_at)}
            </time>
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
