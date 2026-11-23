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
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { ExecutionTaskAction, ExecutionTasks } from './ExecutionOperations'
import { strings } from '@/locales/fr/ExecutionView'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/button'
import {
  formatXof,
  formatDate,
  formatDateTime,
  formatExactPercentage,
} from '@/shared/lib/format'
import { cursorFrom } from '@/shared/lib/pagination'
import { activityLocation } from '@/shared/lib/activity-navigation'
import { useAPI } from '@/shared/api/RestClientProvider'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'
import { AgentNames } from '@/shared/ui/AgentNames'
import { FileSelection } from '@/shared/ui/FileSelection'
import { Pagination } from '@/shared/ui/Pagination'
import { CorrectionNotice } from '@/shared/ui/CorrectionNotice'
import { useScopedPagination } from '@/shared/hooks/useScopedPagination'
import {
  FinancialCancellationForm,
  FinancialDecisionHistory,
  FinancialRequestApplicantDetails,
  FinancialRequestCreationContext,
  FinancialRequestCreateForm,
  FinancialRequestSummary,
} from './FinancialRequestDetails'

function cursorPath(path, cursor) {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path
}

function activeCorrection(request) {
  if (request?.state !== 'returned') return null
  const decision = [...(request.decisions || [])]
    .reverse()
    .find((entry) => entry.outcome === 'returned' && entry.reason)
  return decision
    ? {
        ...decision,
        actor_name: decision.actor_name,
        actor_role: decision.actor_role,
      }
    : null
}

function submitFinancialRequest(mutate, path, body, file) {
  if (!file) return mutate(path, body)
  const metadata = new TextEncoder().encode(
    JSON.stringify({
      name: file.name,
      observation: body.observation || null,
    }),
  )
  const headers = {
    'Content-Type': file.type,
    'X-Request-Metadata-Length': String(metadata.byteLength),
    'X-Expected-Version': String(body.expected_version),
    'X-Request-Amount': String(body.amount),
    ...(body.expected_approved_revision_id
      ? {
          'X-Expected-Approved-Revision-Id': body.expected_approved_revision_id,
        }
      : {}),
    ...(body.expected_disbursement_request_id
      ? {
          'X-Expected-Disbursement-Request-Id':
            body.expected_disbursement_request_id,
        }
      : {}),
  }
  return mutate(`${path}/with-attachment`, undefined, {
    rawBody: new Blob([metadata, file], { type: file.type }),
    headers,
  })
}

const administrativeStates = strings.administrativeStates

function closureBlockerLabel(blocker) {
  return strings.closureBlockers[blocker] || strings.closureBlockers.fallback
}

function administrativeStateClass(state) {
  if (state === 'approved') return 'bg-success-badge text-success'
  if (state === 'returned' || state === 'cancelled')
    return 'bg-warning-soft text-warning'
  return 'bg-selected text-primary'
}

function FinancialDecisionForm({
  request,
  version,
  pending,
  path,
  mutate,
  onCancel,
}) {
  const [error, setError] = useState('')
  const draftVersion = useRef(null)
  const actions = request.allowed_actions || []
  const canDecide = actions.some((action) =>
    ['prevalidate', 'approve', 'return'].includes(action),
  )
  if (!canDecide) return null
  return (
    <BusinessForm
      className="order-last grid gap-5"
      onChangeCapture={() => {
        draftVersion.current ??= version
        setError('')
      }}
      onSubmit={async (event) => {
        const decision = event.nativeEvent.submitter?.value
        if (!['prevalidate', 'approve', 'return'].includes(decision))
          return false
        const data = new FormData(event.currentTarget)
        const reason = String(data.get('reason') || '').trim()
        if (decision === 'return' && !reason) {
          setError(strings.financialReturnReasonRequired)
          return false
        }
        const result = await mutate(`${path}/${request.id}/decisions`, {
          expected_version: draftVersion.current ?? version,
          decision,
          ...(reason ? { reason } : {}),
        })
        if (result !== false) onCancel()
        return result
      }}
    >
      <label>
        {strings.financialDecisionObservation}
        <textarea name="reason" maxLength="4000" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div data-ui="modal-actions" className="order-last">
        <Button type="button" variant="outline" onClick={onCancel}>
          {strings.cancelEntry}
        </Button>
        {actions.includes('return') && (
          <Button
            type="submit"
            value="return"
            variant="outline"
            disabled={pending || !navigator.onLine}
          >
            {strings.returnForCorrection}
          </Button>
        )}
        {actions.includes('prevalidate') && (
          <Button
            type="submit"
            value="prevalidate"
            disabled={pending || !navigator.onLine}
          >
            {strings.prevalidate}
          </Button>
        )}
        {actions.includes('approve') && (
          <Button
            type="submit"
            value="approve"
            disabled={pending || !navigator.onLine}
          >
            {strings.authorize}
          </Button>
        )}
      </div>
    </BusinessForm>
  )
}

function resolveCurrentVirement(detail, result, selected, historicalPage) {
  if (selected) return selected
  const firstRequest = result?.data?.[0]
  return !historicalPage &&
    !detail.virement_context.current_request_id &&
    firstRequest?.state === 'returned'
    ? firstRequest
    : null
}

function AdministrativeStep({
  id,
  title,
  modalLabel,
  description,
  completed = false,
  actionLabel = 'Consulter',
  actionTo,
  secondaryActionLabel,
  onSecondaryAction,
  error,
  clearError,
  children,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const opener = useRef(null)
  const close = () => {
    clearError?.()
    setIsOpen(false)
  }
  const open = () => {
    clearError?.()
    setIsOpen(true)
  }
  return (
    <section
      id={id}
      data-administrative-state={completed ? 'complete' : 'pending'}
      className="border-t border-border first:border-t-0"
    >
      <div className="flex min-h-20 flex-wrap items-center gap-4 px-5 py-4 max-[480px]:items-stretch">
        <span className="min-w-0 flex-1">
          <strong className="block text-sm text-navy">{title}</strong>
          {description && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        <span className="flex flex-wrap gap-3 max-[480px]:w-full">
          {actionLabel &&
            (actionTo ? (
              <Button asChild variant="link" size="sm">
                <Link
                  to={actionTo.to}
                  params={actionTo.params}
                  search={actionTo.search}
                >
                  {actionLabel}
                </Link>
              </Button>
            ) : (
              <Button
                ref={opener}
                type="button"
                variant="outline"
                size="sm"
                onClick={open}
              >
                {actionLabel}
              </Button>
            ))}
          {secondaryActionLabel && (
            <Button type="button" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </span>
      </div>
      <Modal
        open={isOpen && !actionTo}
        onClose={close}
        label={modalLabel || title}
        opener={opener}
        variant="dialog"
        className="w-[min(560px,calc(100%-32px))]"
      >
        <div className="grid gap-5 p-6 [&>[data-ui='planning-card']]:rounded-none [&>[data-ui='planning-card']]:border-0 [&>[data-ui='planning-card']]:bg-transparent [&>[data-ui='planning-card']]:p-0 [&>[data-ui='planning-card']]:shadow-none">
          {error && (
            <p role="alert" className="border-l-4 border-l-danger bg-white p-3">
              {error}
            </p>
          )}
          {typeof children === 'function' ? children(close) : children}
        </div>
      </Modal>
    </section>
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

export function ExecutionView({
  screen,
  embedded = false,
  section = 'combined',
}) {
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
      section={section}
      session={session.data}
      onDenied={() => {}}
    />
  )
}

function ExecutionWorkspace({
  screen,
  session,
  onDenied,
  embedded = false,
  section = 'combined',
}) {
  const { api } = useAPI()
  const client = useQueryClient()
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [reversementFile, setReversementFile] = useState(null)
  const [reversementUploadError, setReversementUploadError] = useState(null)
  const [uploadPending, setUploadPending] = useState(false)
  const [cursors, setCursors] = useState({
    funding: '',
    finance: '',
    zeroSpending: '',
    virement: '',
    reversement: '',
  })
  const moveCursor = (key, link, path) =>
    setCursors((current) => ({
      ...current,
      [key]: cursorFrom(link, path),
    }))
  const financeSection = section !== 'realization'
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
  const virementRequestId = detail.data?.virement_context?.current_request_id
  const funding = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['funding', params.activityId, cursors.funding],
      cursorPath(
        `/activities/${params.activityId}/funding-requests`,
        cursors.funding,
      ),
      onDenied,
    ),
    enabled:
      financeSection && screen === 'detail' && Boolean(params.activityId),
  })
  const finance = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      [
        'finance',
        params.activityId,
        financeSection ? cursors.finance : undefined,
      ],
      cursorPath(
        `/activities/${params.activityId}/disbursement-requests`,
        financeSection ? cursors.finance : undefined,
      ),
      onDenied,
    ),
    enabled: screen === 'detail' && Boolean(params.activityId),
  })
  const zeroSpending = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      [
        'zero-spending',
        params.activityId,
        financeSection ? cursors.zeroSpending : undefined,
      ],
      cursorPath(
        `/activities/${params.activityId}/zero-spending-declarations`,
        financeSection ? cursors.zeroSpending : undefined,
      ),
      onDenied,
    ),
    enabled:
      screen === 'detail' &&
      Boolean(params.activityId) &&
      (section === 'realization' ||
        (detail.data?.works_completed && detail.data?.spending_total === '0')),
  })
  const virements = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['virements', params.activityId, cursors.virement],
      cursorPath(
        `/activities/${params.activityId}/virement-requests`,
        cursors.virement,
      ),
      onDenied,
    ),
    enabled:
      financeSection && screen === 'detail' && Boolean(params.activityId),
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
      financeSection &&
      screen === 'detail' &&
      Boolean(params.activityId) &&
      Boolean(virementRequestId),
  })
  const reversementRequestId =
    selectedVirement.data?.reversement?.current_declaration?.request_id ||
    virementRequestId
  const reversementHistory = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      [
        'reversement-history',
        params.activityId,
        reversementRequestId,
        cursors.reversement,
      ],
      cursorPath(
        `/activities/${params.activityId}/virement-requests/${reversementRequestId}/reversement/history`,
        cursors.reversement,
      ),
      onDenied,
    ),
    enabled:
      financeSection &&
      screen === 'detail' &&
      Boolean(params.activityId) &&
      Boolean(reversementRequestId) &&
      Boolean(selectedVirement.data?.reversement),
  })
  const filters = Object.fromEntries(
    ['q', 'state', 'agent', 'from', 'to']
      .filter((key) => search[key])
      .map((key) => [key, search[key]]),
  )
  const listScope = `${params.ptaId || ''}?${new URLSearchParams(filters)}`
  const [listCursor, setListCursor] = useScopedPagination(listScope, '')
  const listParams = new URLSearchParams({
    ...filters,
    ...(listCursor ? { cursor: listCursor } : {}),
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
    mutationFn: async ({ taskId, subtaskId, body }) => {
      const activeGeneration = generation.current
      const requestController = new AbortController()
      controller.current = requestController
      const result = await api.request(
        `/api/v1/activities/${params.activityId}/tasks/${taskId}${subtaskId ? `/subtasks/${subtaskId}` : ''}/execution`,
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
      toast.success(strings.executionSaved)
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
    mutationFn: async ({ path, body, rawBody, headers }) => {
      const activeGeneration = generation.current
      const requestController = new AbortController()
      controller.current = requestController
      const result = await api.request(
        `/api/v1/activities/${params.activityId}${path}`,
        {
          method: 'POST',
          body,
          rawBody,
          headers,
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
      setError('')
      const submittedDisbursement = [
        '/disbursement-requests',
        '/disbursement-requests/with-attachment',
      ].includes(variables.path)
      const submittedVirement = [
        '/virement-requests',
        '/virement-requests/with-attachment',
      ].includes(variables.path)
      toast.success(
        variables.path === '/closure'
          ? strings.activityClosed
          : submittedDisbursement
            ? strings.disbursementSent
            : submittedVirement
              ? strings.virementSent
              : strings.financeUpdated,
      )
    },
    onError: async (problem, variables) => {
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
          : variables.path === '/zero-spending-declarations' &&
              problem.status === 422
            ? strings.zeroSpendingRejected
            : problem.message,
      )
    },
  })
  const relevant =
    screen === 'list'
      ? [list]
      : financeSection
        ? [
            detail,
            finance,
            funding,
            ...(detail.data?.works_completed &&
            detail.data?.spending_total === '0'
              ? [zeroSpending]
              : []),
            virements,
            ...(virementRequestId ? [selectedVirement] : []),
            ...(selectedVirement.data?.reversement ? [reversementHistory] : []),
          ]
        : [detail]
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
          onFilterChange={(values) => {
            setListCursor('')
            return navigate({ search: { ...search, ...values } })
          }}
          result={list.data}
          onPage={(link) =>
            setListCursor(cursorFrom(link, `/ptas/${params.ptaId}/execution`))
          }
        />
      </>
    )
  return (
    <>
      {readError}
      <ExecutionDetail
        section={section}
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
          moveCursor(
            'funding',
            link,
            `/activities/${params.activityId}/funding-requests`,
          )
        }
        onFinancePage={(link) =>
          moveCursor(
            'finance',
            link,
            `/activities/${params.activityId}/disbursement-requests`,
          )
        }
        onVirementPage={(link) =>
          moveCursor(
            'virement',
            link,
            `/activities/${params.activityId}/virement-requests`,
          )
        }
        zeroSpending={zeroSpending.data}
        fundingBusy={funding.isFetching}
        financeBusy={finance.isFetching}
        virementBusy={virements.isFetching}
        zeroSpendingBusy={zeroSpending.isFetching}
        virements={virements.data}
        selectedVirement={selectedVirement.data}
        reversementHistory={reversementHistory.data}
        role={session.user.role}
        financeHistoryPage={Boolean(cursors.finance)}
        virementHistoryPage={Boolean(cursors.virement)}
        error={error}
        clearError={() => setError('')}
        pending={
          relevant.some((query) => query.isError || query.isPending) ||
          mutation.isPending ||
          financeMutation.isPending ||
          uploadPending ||
          detail.isFetching ||
          finance.isFetching ||
          zeroSpending.isFetching ||
          virements.isFetching ||
          selectedVirement.isFetching ||
          reversementHistory.isFetching
        }
        mutate={async (taskId, subtaskId, body) => {
          const result = await mutation
            .mutateAsync({ taskId, subtaskId, body })
            .catch(() => false)
          return result
        }}
        mutateFinance={async (path, body, options = {}) => {
          const activeGeneration = generation.current
          const result = await financeMutation
            .mutateAsync({ path, body, ...options })
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
        onZeroSpendingPage={(link) =>
          moveCursor(
            'zeroSpending',
            link,
            `/activities/${params.activityId}/zero-spending-declarations`,
          )
        }
        onReversementPage={(link) =>
          moveCursor(
            'reversement',
            link,
            `/activities/${params.activityId}/virement-requests/${reversementRequestId}/reversement/history`,
          )
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
                      {...activityLocation(row, 'realization')}
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
                      {row.completed_tasks ?? 0} / {row.task_count ?? 0}{' '}
                      {(row.task_count ?? 0) > 1
                        ? 'tâches terminées'
                        : 'tâche terminée'}
                    </small>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <strong>
                      {row.spending_total === null
                        ? strings.notProvided
                        : formatXof(row.spending_total)}
                    </strong>
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
                    <StatusBadge
                      className={
                        row.closure
                          ? 'bg-success-badge text-success'
                          : row.works_completed || row.execution_paused
                            ? 'bg-warning-soft text-warning'
                            : 'bg-selected text-primary'
                      }
                    >
                      {executionStage(row)}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="min-w-24 whitespace-nowrap"
                    >
                      <Link {...activityLocation(row, 'realization')}>
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
      <Pagination
        label={strings.listPagination}
        canPrevious={Boolean(result?.previous)}
        canNext={Boolean(result?.next)}
        previousLabel={strings.previousPage}
        nextLabel={strings.nextPage}
        onPrevious={() => onPage(result.previous)}
        onNext={() => onPage(result.next)}
      />
    </section>
  )
}

function FinancialRequestTableRow({
  request,
  detail,
  result,
  role,
  authorizedAmount,
  historicalPage,
  pending,
  mutate,
  error,
  clearError,
}) {
  const [open, setOpen] = useState(false)
  const opener = useRef(null)
  const close = () => {
    clearError()
    setOpen(false)
  }
  const actions = request.allowed_actions || []
  const actionLabel = actions.some((action) =>
    ['prevalidate', 'approve'].includes(action),
  )
    ? 'Examiner'
    : request.state === 'returned' && role === 'AGENT_SAISIE'
      ? 'Reprendre'
      : 'Consulter'
  const modalLabel =
    request.drawer === 'virement'
      ? strings.virementRequest
      : request.drawer === 'funding'
        ? strings.fundingTitle
        : request.drawer === 'zero'
          ? strings.zeroSpendingDeclaration
          : strings.disbursementRequest
  const correction =
    !result?.previous && result?.data?.[0]?.id === request.id
      ? activeCorrection(request)
      : null
  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="p-3">
          <strong className="block text-navy">{request.kind}</strong>
          <span className="text-xs text-muted-foreground">
            {request.submitted_at
              ? `${request.kind.toLocaleLowerCase('fr')} · ${formatDate(request.submitted_at)}`
              : 'Date non renseignée'}
          </span>
        </td>
        <td className="p-3 text-right font-medium">
          {formatXof(request.amount)}
        </td>
        <td className="p-3">
          <StatusBadge className={administrativeStateClass(request.state)}>
            {administrativeStates[request.state] || request.state}
          </StatusBadge>
        </td>
        <td className="p-3 text-right">
          <Button
            ref={opener}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              clearError()
              setOpen(true)
            }}
          >
            {actionLabel}
          </Button>
        </td>
      </tr>
      {open &&
        createPortal(
          <Modal
            open
            onClose={close}
            label={modalLabel}
            opener={opener}
            variant="dialog"
            size="standard"
          >
            <div className="p-6 [&>[data-ui='planning-card']]:rounded-none [&>[data-ui='planning-card']]:border-0 [&>[data-ui='planning-card']]:bg-transparent [&>[data-ui='planning-card']]:p-0 [&>[data-ui='planning-card']]:shadow-none">
              <CorrectionNotice
                title={strings.returnedRequestTitle}
                correction={correction}
                className="mb-5"
              />
              {error && (
                <p
                  role="alert"
                  className="mb-4 border-l-4 border-l-danger bg-white p-3"
                >
                  {error}
                </p>
              )}
              {request.drawer === 'funding' ? (
                <FundingSection
                  fallback={null}
                  detail={detail}
                  result={result}
                  current={request}
                  pending={pending}
                  mutate={mutate}
                  onCancel={close}
                  activeCorrectionId={correction?.id}
                />
              ) : request.drawer === 'disbursement' ? (
                <DisbursementSection
                  fallback={null}
                  detail={detail}
                  result={result}
                  selected={request}
                  role={role}
                  authorizedAmount={authorizedAmount}
                  historicalPage={historicalPage}
                  pending={pending}
                  mutate={mutate}
                  onCancel={close}
                  activeCorrectionId={correction?.id}
                />
              ) : request.drawer === 'virement' ? (
                <VirementSection
                  fallback={null}
                  detail={detail}
                  result={result}
                  current={request}
                  role={role}
                  authorizedAmount={authorizedAmount}
                  historicalPage={historicalPage}
                  pending={pending}
                  mutate={mutate}
                  onCancel={close}
                  activeCorrectionId={correction?.id}
                />
              ) : (
                <ZeroSpendingSection
                  fallback={null}
                  detail={detail}
                  result={result}
                  current={request}
                  role={role}
                  pending={pending}
                  mutate={mutate}
                  onCancel={close}
                  activeCorrectionId={correction?.id}
                />
              )}
            </div>
          </Modal>,
          document.body,
        )}
    </>
  )
}

function ExecutionDetail({
  section,
  sectionFallbacks,
  detail,
  finance,
  funding,
  onFundingPage,
  onFinancePage,
  onVirementPage,
  zeroSpending,
  fundingBusy,
  financeBusy,
  virementBusy,
  zeroSpendingBusy,
  virements,
  selectedVirement,
  reversementHistory,
  role,
  financeHistoryPage,
  virementHistoryPage,
  error,
  clearError,
  pending,
  mutate,
  mutateFinance,
  uploadReversementEvidence,
  reversementFile,
  setReversementFile,
  reversementUploadError,
  setReversementUploadError,
  onZeroSpendingPage,
  onReversementPage,
}) {
  const tasks = detail.tasks ?? []
  const taskDetail = {
    ...detail,
    tasks,
    task_count: detail.task_count ?? tasks.length,
    completed_tasks: detail.completed_tasks ?? 0,
    progress: detail.progress ?? null,
  }
  const [financialModal, setFinancialModal] = useState(null)
  const financialModalOpener = useRef(null)
  const closeFinancialModal = () => {
    clearError()
    setFinancialModal(null)
  }
  const recordedTasks = tasks.filter(
    (task) => task.actual_spent !== null,
  ).length
  const plannedAmount = BigInt(detail.approved_allocation)
  const recordedAmount =
    detail.spending_total === null ? null : BigInt(detail.spending_total)
  const acceptedAmount =
    detail.realization_status === 'validated' ? recordedAmount : null
  const virementContext = detail.virement_context
  const authorizedAmount = virementContext?.authorized_amount ?? null
  const authorizationPending = ['submitted', 'prevalidated'].includes(
    virementContext?.disbursement_state,
  )
  const approvedVirementAmount = virementContext?.transferred_amount ?? null
  const financialVariance =
    recordedAmount !== null && recordedAmount > plannedAmount
      ? recordedAmount - plannedAmount
      : null
  const unusedBalance =
    acceptedAmount !== null && acceptedAmount <= plannedAmount
      ? plannedAmount - acceptedAmount
      : null
  const currentVirement = resolveCurrentVirement(
    detail,
    virements,
    selectedVirement,
    virementHistoryPage,
  )
  const realizationRequest = [finance?.data?.[0], zeroSpending?.data?.[0]]
    .filter(Boolean)
    .sort((left, right) =>
      `${right.submitted_at}:${right.id}`.localeCompare(
        `${left.submitted_at}:${left.id}`,
      ),
    )[0]
  const realizationCorrection = activeCorrection(realizationRequest)
  const validationLabel = realizationCorrection
    ? strings.correctionState
    : strings.realizationValidationStates[detail.realization_status] ||
      strings.realizationValidationStates.not_started
  const incompleteTasks = tasks.filter((task) => !task.execution_completed)
  const readinessGroups = [
    {
      kind: 'task',
      tasks: incompleteTasks.filter((task) => !task.subtasks.length),
    },
    {
      kind: 'subtask',
      tasks: incompleteTasks.filter((task) => task.subtasks.length),
    },
  ].filter((group) => group.tasks.length)
  const financialRequests = [
    ...(finance?.data || []).map((request) => ({
      ...request,
      kind: strings.disbursementKind,
      drawer: 'disbursement',
    })),
    ...(virements?.data || []).map((request) => ({
      ...request,
      kind: strings.virementKind,
      drawer: 'virement',
    })),
    ...(funding?.data || []).map((request) => ({
      ...request,
      kind: strings.fundingTitle,
      drawer: 'funding',
    })),
    ...(zeroSpending?.data || []).map((request) => ({
      ...request,
      amount: '0',
      kind: strings.zeroSpendingDeclaration,
      drawer: 'zero',
    })),
  ]
  const financialPages = [
    {
      key: 'funding',
      label: 'Financements complémentaires',
      result: funding,
      onPage: onFundingPage,
      busy: fundingBusy,
    },
    {
      key: 'disbursement',
      label: 'Décaissements',
      result: finance,
      onPage: onFinancePage,
      busy: financeBusy,
    },
    {
      key: 'virement',
      label: 'Virements',
      result: virements,
      onPage: onVirementPage,
      busy: virementBusy,
    },
    {
      key: 'zero',
      label: 'Déclarations sans dépense',
      result: zeroSpending,
      onPage: onZeroSpendingPage,
      busy: zeroSpendingBusy,
    },
  ].filter(({ result }) => result?.previous || result?.next)
  const newFinancialRequest =
    role === 'AGENT_SAISIE' &&
    detail.works_completed &&
    detail.spending_total === '0' &&
    !zeroSpending?.count
      ? 'zero'
      : role === 'AGENT_SAISIE' && detail.virement_context?.can_submit
        ? 'virement'
        : funding?.allowed_actions?.includes('submit')
          ? 'funding'
          : role === 'AGENT_SAISIE' && detail.disbursement_can_submit
            ? 'disbursement'
            : null
  const financialModalLabels = {
    disbursement: strings.disbursementAuthorization,
    virement: strings.virementAuthorization,
    funding: strings.fundingTitle,
    zero: strings.zeroSpendingDeclaration,
  }
  const financialModalLabel =
    financialModal === 'chooser'
      ? strings.newFinancialRequest
      : financialModal === 'virement'
        ? strings.virementRequest
        : financialModal === 'disbursement'
          ? strings.disbursementRequest
          : financialModalLabels[financialModal] || strings.financialRequest
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
    zero_spending_frozen: 'une déclaration sans dépense est en cours',
  }
  return (
    <section className="grid gap-6">
      {section === 'realization' && (
        <CorrectionNotice
          title={strings.returnedRealizationTitle}
          correction={realizationCorrection}
        />
      )}
      {error && (
        <p role="alert" className="border-l-4 border-l-danger p-3 bg-white">
          {error}
        </p>
      )}
      {!detail.execution_paused &&
        detail.mutation_unavailable_reason &&
        !['reviewer_read_only', 'disbursement_frozen'].includes(
          detail.mutation_unavailable_reason,
        ) && (
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
      {section !== 'finance' && (
        <>
          <Panel className="gap-0 overflow-hidden p-0">
            <dl className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-6 px-6 py-5 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Avancement physique
                </dt>
                <dd className="mt-1 text-lg font-semibold text-navy">
                  {detail.progress === null
                    ? '—'
                    : formatExactPercentage(detail.progress)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Tâches terminées
                </dt>
                <dd className="mt-1 text-lg font-semibold text-navy">
                  {taskDetail.completed_tasks} / {taskDetail.task_count}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Dépenses enregistrées
                </dt>
                <dd className="mt-1 text-lg font-semibold text-navy">
                  {formatXof(detail.spending_total)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Validation de la réalisation
                </dt>
                <dd className="mt-1 text-lg font-semibold text-navy">
                  {validationLabel}
                </dd>
              </div>
            </dl>
            <ExecutionTasks
              key={detail.works_completed ? 'completed' : 'in-progress'}
              embedded
              detail={taskDetail}
              pending={pending}
              mutate={mutate}
              error={error}
              clearError={clearError}
            />
            <section className="border-t border-border px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2>{strings.realizationValidation}</h2>
                <span className="text-sm text-muted-foreground">
                  {validationLabel}
                </span>
              </div>
              <div className="mt-4 divide-y divide-border text-sm">
                {!detail.works_completed &&
                  readinessGroups.map((group) => {
                    const task = group.tasks[0]
                    const subtask = task.subtasks.find(
                      (child) => !child.execution_completed,
                    )
                    const target = group.kind === 'subtask' ? subtask : task
                    const canRecord =
                      target?.allowed_actions?.includes('record')
                    const count = group.tasks.length
                    return (
                      <div
                        key={group.kind}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                      >
                        <span>
                          {count === 1
                            ? `Terminez la tâche « ${task.name} ».`
                            : `${count} tâches à terminer.`}
                        </span>
                        <ExecutionTaskAction
                          activity={detail}
                          task={task}
                          target={target}
                          isSubtask={group.kind === 'subtask'}
                          variant="link"
                          size="sm"
                          pending={pending}
                          mutate={mutate}
                          error={error}
                          clearError={clearError}
                          label={
                            canRecord
                              ? group.kind === 'subtask'
                                ? 'Renseigner les sous-tâches'
                                : 'Renseigner la tâche'
                              : 'Consulter'
                          }
                        />
                      </div>
                    )
                  })}
                {detail.works_completed &&
                  detail.realization_status !== 'validated' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                      <span>
                        Une autorisation de décaissement ou une déclaration sans
                        dépense est requise.
                      </span>
                      <Link
                        {...activityLocation(detail, 'finance')}
                        className="font-medium text-primary hover:underline"
                      >
                        Consulter la demande
                      </Link>
                    </div>
                  )}
                {detail.realization_status === 'validated' && (
                  <p className="py-3 first:pt-0 text-muted-foreground">
                    Les dépenses finales ont été acceptées par le parcours
                    financier en vigueur.
                  </p>
                )}
              </div>
            </section>
          </Panel>
        </>
      )}
      {section !== 'realization' && (
        <Panel
          aria-labelledby="financial-situation-title"
          className="gap-0 overflow-hidden p-0"
        >
          <header className="border-b border-border px-6 py-5">
            <h2 id="financial-situation-title">{strings.financialSituation}</h2>
          </header>
          <dl
            className={`grid gap-6 px-6 py-5 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1 ${
              unusedBalance === null
                ? 'grid-cols-4 max-[1000px]:grid-cols-2'
                : 'grid-cols-[repeat(5,minmax(0,1fr))] max-[1100px]:grid-cols-3'
            }`}
          >
            <div>
              <dt className="text-xs text-muted-foreground">
                {strings.plannedAmount}
              </dt>
              <dd className="mt-1 font-semibold text-navy">
                {formatXof(detail.approved_allocation)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Montant autorisé
              </dt>
              <dd className="mt-1 font-semibold text-navy">
                {authorizedAmount !== null
                  ? formatXof(authorizedAmount)
                  : authorizationPending
                    ? 'Autorisation en cours'
                    : 'Autorisation à obtenir'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Dépenses enregistrées
              </dt>
              <dd className="mt-1 font-semibold text-navy">
                {recordedAmount === null
                  ? strings.notProvided
                  : `${formatXof(String(recordedAmount))}${
                      recordedTasks < taskDetail.task_count
                        ? ' · partielles'
                        : ''
                    }`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Dépenses acceptées
              </dt>
              <dd className="mt-1 font-semibold text-navy">
                {acceptedAmount === null
                  ? detail.realization_status === 'returned'
                    ? 'Réalisation à corriger'
                    : ['submitted', 'prevalidated'].includes(
                          detail.realization_status,
                        )
                      ? 'En attente de validation'
                      : 'Réalisation à soumettre'
                  : formatXof(String(acceptedAmount))}
              </dd>
            </div>
            {unusedBalance !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">
                  {strings.unusedFinancialBalance}
                </dt>
                <dd className="mt-1 font-semibold text-navy">
                  {formatXof(String(unusedBalance))}
                </dd>
              </div>
            )}
          </dl>
          {financialVariance !== null && (
            <div className="mx-6 flex flex-wrap items-center gap-5 border-y border-border py-4 text-xs">
              <span className="text-muted-foreground">
                {strings.financialDifference}
              </span>
              <strong className="font-semibold text-navy">
                {strings.formatString(strings.overspending, {
                  amount: formatXof(String(financialVariance)),
                })}
              </strong>
            </div>
          )}
        </Panel>
      )}
      {section !== 'realization' && (
        <>
          <Panel
            aria-labelledby="administrative-title"
            className="gap-0 overflow-hidden p-0"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
              <h2 id="administrative-title" className="font-semibold text-navy">
                {strings.financialRequests}
              </h2>
              {newFinancialRequest && (
                <Button
                  type="button"
                  size="sm"
                  onClick={(event) => {
                    clearError()
                    financialModalOpener.current = event.currentTarget
                    setFinancialModal('chooser')
                  }}
                >
                  {strings.newFinancialRequest}
                </Button>
              )}
            </header>
            {financialRequests.length > 0 ? (
              <div className="overflow-x-auto border-t border-border px-3 py-2">
                <table className="w-full min-w-180 text-left text-[0.8125rem]">
                  <thead className="border-b border-border bg-background">
                    <tr>
                      <th className="p-3 font-medium">
                        {strings.requestAndDate}
                      </th>
                      <th className="p-3 text-right font-medium">
                        {strings.totalAmount}
                      </th>
                      <th className="p-3 font-medium">{strings.status}</th>
                      <th className="p-3 font-medium">
                        <span className="sr-only">{strings.action}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialRequests.map((request) => (
                      <FinancialRequestTableRow
                        key={`${request.kind}:${request.id}`}
                        request={request}
                        detail={detail}
                        result={
                          request.drawer === 'funding'
                            ? funding
                            : request.drawer === 'disbursement'
                              ? finance
                              : request.drawer === 'virement'
                                ? virements
                                : request.drawer === 'zero'
                                  ? zeroSpending
                                  : null
                        }
                        role={role}
                        authorizedAmount={
                          request.drawer === 'virement'
                            ? approvedVirementAmount
                            : authorizedAmount
                        }
                        historicalPage={
                          request.drawer === 'virement'
                            ? virementHistoryPage
                            : financeHistoryPage
                        }
                        pending={pending}
                        mutate={mutateFinance}
                        error={error}
                        clearError={clearError}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="border-t border-border px-6 py-5 text-sm text-muted-foreground">
                Aucune demande financière.
              </p>
            )}
            {financialPages.length > 0 && (
              <div className="grid gap-3 border-t border-border px-6 py-4">
                {financialPages.map(({ key, label, result, onPage, busy }) => (
                  <div
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                    <Pagination
                      label={`Pagination — ${label}`}
                      canPrevious={Boolean(result.previous)}
                      canNext={Boolean(result.next)}
                      busy={busy}
                      size="sm"
                      onPrevious={() => onPage(result.previous)}
                      onNext={() => onPage(result.next)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Modal
            open={Boolean(financialModal)}
            onClose={closeFinancialModal}
            label={financialModalLabel}
            opener={financialModalOpener}
            variant="dialog"
            size="standard"
          >
            <div className="p-6 [&>[data-ui='planning-card']]:rounded-none [&>[data-ui='planning-card']]:border-0 [&>[data-ui='planning-card']]:bg-transparent [&>[data-ui='planning-card']]:p-0 [&>[data-ui='planning-card']]:shadow-none">
              {error && (
                <p
                  role="alert"
                  className="mb-4 border-l-4 border-l-danger bg-white p-3"
                >
                  {error}
                </p>
              )}
              {financialModal === 'chooser' && (
                <div className="grid gap-0">
                  {[
                    {
                      key: 'disbursement',
                      label: strings.disbursementAuthorization,
                      hidden: !['disbursement', 'virement'].includes(
                        newFinancialRequest,
                      ),
                      disabled: !detail.disbursement_can_submit,
                      detail:
                        authorizedAmount === null
                          ? null
                          : `${strings.currentAuthorizedTotal} : ${formatXof(authorizedAmount)}`,
                    },
                    {
                      key: 'virement',
                      label: strings.virementAuthorization,
                      hidden: !detail.virement_context?.can_submit,
                    },
                    {
                      key: 'funding',
                      label: strings.fundingTitle,
                      hidden: newFinancialRequest !== 'funding',
                    },
                    {
                      key: 'zero',
                      label: strings.zeroSpendingDeclaration,
                      hidden: newFinancialRequest !== 'zero',
                    },
                  ].map((option) =>
                    option.hidden ? null : (
                      <div
                        key={option.key}
                        className="flex min-h-16 items-center justify-between gap-5 border-b border-border py-4 last:border-b-0"
                      >
                        <div>
                          <strong className="text-sm font-semibold">
                            {option.label}
                          </strong>
                          {option.detail && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {option.detail}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Créer — ${option.label}`}
                          disabled={option.disabled}
                          onClick={() => {
                            clearError()
                            setFinancialModal(option.key)
                          }}
                        >
                          Créer
                        </Button>
                      </div>
                    ),
                  )}
                </div>
              )}
              {financialModal === 'zero' && (
                <ZeroSpendingSection
                  fallback={sectionFallbacks.zeroSpending}
                  detail={detail}
                  result={zeroSpending}
                  current={null}
                  role={role}
                  pending={pending}
                  mutate={mutateFinance}
                  onCancel={closeFinancialModal}
                />
              )}
              {financialModal === 'disbursement' &&
                (detail.works_completed ? (
                  <DisbursementSection
                    fallback={sectionFallbacks.finance}
                    detail={detail}
                    result={finance}
                    selected={null}
                    role={role}
                    authorizedAmount={authorizedAmount}
                    historicalPage={financeHistoryPage}
                    pending={pending}
                    mutate={mutateFinance}
                    onCancel={closeFinancialModal}
                  />
                ) : (
                  <p>{strings.previousStepsIncomplete}</p>
                ))}
              {financialModal === 'virement' &&
                (detail.works_completed ? (
                  <VirementSection
                    fallback={sectionFallbacks.virements}
                    detail={detail}
                    result={virements}
                    current={null}
                    role={role}
                    authorizedAmount={approvedVirementAmount}
                    historicalPage={virementHistoryPage}
                    pending={pending}
                    mutate={mutateFinance}
                    onCancel={closeFinancialModal}
                  />
                ) : (
                  <p>{strings.previousStepsIncomplete}</p>
                ))}
              {financialModal === 'funding' && (
                <FundingSection
                  fallback={sectionFallbacks.funding}
                  detail={detail}
                  result={funding}
                  pending={pending}
                  mutate={mutateFinance}
                  onCancel={closeFinancialModal}
                />
              )}
            </div>
          </Modal>
        </>
      )}
      {section !== 'realization' && (
        <Panel
          aria-labelledby="administrative-closure-title"
          className="gap-0 overflow-hidden p-0"
        >
          <header className="px-6 py-5">
            <h2
              id="administrative-closure-title"
              className="font-semibold text-navy"
            >
              Suivi administratif et clôture
            </h2>
          </header>
          <div>
            {(!detail.works_completed || detail.spending_total !== '0') &&
              (currentVirement?.state === 'approved' ? (
                <>
                  <ExternalTransferStep
                    activityName={detail.name}
                    current={currentVirement}
                    pending={pending}
                    mutate={mutateFinance}
                    error={error}
                    clearError={clearError}
                  />
                  {currentVirement.reversement && (
                    <ReversementStep
                      detail={detail}
                      current={currentVirement}
                      history={reversementHistory}
                      pending={pending}
                      mutate={mutateFinance}
                      error={error}
                      clearError={clearError}
                      uploadEvidence={uploadReversementEvidence}
                      file={reversementFile}
                      setFile={setReversementFile}
                      uploadError={reversementUploadError}
                      setUploadError={setReversementUploadError}
                      onPage={onReversementPage}
                    />
                  )}
                </>
              ) : (
                <AdministrativeStep
                  title={strings.externalTransfer}
                  description={strings.notConfirmed}
                  actionLabel={null}
                >
                  <p>{strings.previousStepsIncomplete}</p>
                </AdministrativeStep>
              ))}
            <AdministrativeStep
              key={`closure:${Boolean(detail.closure)}:${detail.allowed_actions?.includes('close')}`}
              title={strings.activityClosure}
              description={
                detail.closure
                  ? strings.closureConfirmation
                  : detail.works_completed && detail.closure_blockers?.length
                    ? closureBlockerLabel(detail.closure_blockers[0])
                    : detail.works_completed
                      ? strings.closureConfirmation
                      : strings.finishRealization
              }
              completed={Boolean(detail.closure)}
              actionLabel={
                !detail.closure && detail.allowed_actions?.includes('close')
                  ? strings.closeActivity
                  : null
              }
            >
              {(close) =>
                detail.works_completed ? (
                  <ClosureSection
                    detail={detail}
                    pending={pending}
                    mutate={mutateFinance}
                    onCancel={close}
                  />
                ) : (
                  <p>{strings.finishRealization}</p>
                )
              }
            </AdministrativeStep>
          </div>
        </Panel>
      )}
    </section>
  )
}

function ZeroSpendingSection({
  fallback,
  detail,
  result,
  current,
  role,
  pending,
  mutate,
  onCancel,
  activeCorrectionId,
}) {
  const draftBasis = useRef(null)
  if (!result) return fallback
  const declarations = result.data
  const active = current || declarations.find((row) => row.state !== 'returned')
  const stateLabels = strings.zeroSpendingStates
  const version = active?.activity_version || detail.version
  const captureDraftBasis = () => {
    draftBasis.current ??= {
      version,
      approvedRevisionId: detail.approved_revision_id,
    }
  }
  const submit = async (path, body) => {
    const response = await mutate(path, body)
    if (response !== false) onCancel()
    return response
  }
  return (
    <Panel
      aria-labelledby="zero-spending-title"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
            {strings.closureWithoutSpending}
          </p>
          <h2 id="zero-spending-title">{strings.zeroSpendingTitle}</h2>
        </div>
        {active && <strong>{stateLabels[active.state]}</strong>}
      </div>
      <p>{strings.zeroSpendingExplanation}</p>
      {active ? (
        <>
          <p className="border-l-4 border-l-primary bg-background py-3 px-4">
            {strings.formatString(strings.reasonValue, {
              reason: active.reason,
            })}
          </p>
          <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
            {active.decisions.map((decision) => (
              <li key={decision.id}>
                <strong>
                  {decision.stage === 'supervisor'
                    ? 'Superviseur'
                    : 'Validateur'}{' '}
                  · {stateLabels[decision.outcome] || decision.outcome}
                </strong>
                {decision.reason && decision.id !== activeCorrectionId && (
                  <p>{decision.reason}</p>
                )}
              </li>
            ))}
          </ol>
          <div data-ui="modal-actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            {active.allowed_actions.includes('prevalidate') && (
              <Button
                disabled={pending || !navigator.onLine}
                onClick={() =>
                  submit(`/zero-spending-declarations/${active.id}/decisions`, {
                    expected_version: version,
                    decision: 'prevalidate',
                  })
                }
              >
                Prévalider
              </Button>
            )}
            {active.allowed_actions.includes('approve') && (
              <Button
                disabled={pending || !navigator.onLine}
                onClick={() =>
                  submit(`/zero-spending-declarations/${active.id}/decisions`, {
                    expected_version: version,
                    decision: 'approve',
                  })
                }
              >
                Valider
              </Button>
            )}
          </div>
          {active.allowed_actions.includes('return') && (
            <BusinessForm
              className="grid gap-5 [&_>_label]:w-full"
              onChangeCapture={captureDraftBasis}
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                return submit(
                  `/zero-spending-declarations/${active.id}/decisions`,
                  {
                    expected_version: draftBasis.current?.version ?? version,
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
      ) : role === 'AGENT_SAISIE' &&
        detail.mutation_unavailable_reason !==
          'activity_assignment_required' ? (
        <BusinessForm
          className="grid gap-5 [&_>_label]:w-full"
          onChangeCapture={captureDraftBasis}
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            return submit('/zero-spending-declarations', {
              expected_version: draftBasis.current?.version ?? detail.version,
              expected_approved_revision_id:
                draftBasis.current?.approvedRevisionId ??
                detail.approved_revision_id,
              reason: String(data.get('reason') || ''),
            })
          }}
        >
          <label>
            Motif de l’absence de dépense *
            <textarea name="reason" required maxLength="4000" />
          </label>
          <div data-ui="modal-actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !navigator.onLine}>
              Soumettre la déclaration
            </Button>
          </div>
        </BusinessForm>
      ) : (
        <p>{strings.noPendingZeroSpending}</p>
      )}
      {declarations.some((row) => row.state === 'returned') && (
        <details>
          <summary>{strings.returnedDeclarations}</summary>
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
    </Panel>
  )
}

function ClosureSection({ detail, pending, mutate, onCancel }) {
  const blockers = detail.closure_blockers || []
  return (
    <section aria-labelledby="closure-title" className="grid gap-5">
      <h2 id="closure-title">{strings.activityClosure}</h2>
      {detail.closure ? (
        <>
          <p className="border-l-4 border-l-primary bg-background py-3 px-4">
            <CheckCircle2 size={16} aria-hidden="true" /> Activité clôturée
          </p>
          <dl className="grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] [&_dd]:mt-1 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-lg [&_dd]:font-semibold [&_dd]:text-navy">
            <div>
              <dt>{strings.closedOn}</dt>
              <dd>
                <time dateTime={detail.closure.closed_at}>
                  {formatDateTime(detail.closure.closed_at)}
                </time>
              </dd>
            </div>
            <div>
              <dt>{strings.closedBy}</dt>
              <dd>{detail.closure.closed_by_name}</dd>
            </div>
          </dl>
          <Button asChild variant="link" className="w-fit px-0">
            <Link {...activityLocation(detail, 'history')}>
              Ouvrir l’historique
            </Link>
          </Button>
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
                <li key={blocker}>{closureBlockerLabel(blocker)}</li>
              ))}
            </ul>
          )}
          {detail.allowed_actions?.includes('close') && (
            <BusinessForm
              className="grid gap-5 [&_>_label]:w-full"
              onSubmit={(event) => {
                event.preventDefault()
                return mutate('/closure', { expected_version: detail.version })
              }}
            >
              <label className="grid grid-cols-[auto_1fr] items-center gap-2 [&_input]:size-5">
                <input type="checkbox" required /> Je confirme que l’Activité
                est entièrement réalisée et réglée. *
              </label>
              <div data-ui="modal-actions">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Annuler
                </Button>
                <Button type="submit" disabled={pending || !navigator.onLine}>
                  Confirmer la clôture
                </Button>
              </div>
            </BusinessForm>
          )}
        </>
      )}
    </section>
  )
}

function DisbursementSection({
  fallback,
  detail,
  result,
  selected,
  role,
  authorizedAmount,
  historicalPage,
  pending,
  mutate,
  onCancel,
  activeCorrectionId,
}) {
  if (!result) return fallback
  const requests = result.data
  const active = requests.find((request) =>
    ['submitted', 'prevalidated'].includes(request.state),
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
    detail.disbursement_can_submit
  const version = current?.activity_version || detail.version
  return (
    <Panel
      aria-label={strings.disbursementAuthorization}
      className="flex min-h-0 flex-1 flex-col"
    >
      <p className="text-sm text-muted-foreground">
        {detail.name}
        {current ? ` · ${detail.reference}` : ''}
      </p>
      {current ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge className={administrativeStateClass(current.state)}>
              {administrativeStates[current.state] || current.state}
            </StatusBadge>
            <span>décaissement · {formatDate(current.submitted_at)}</span>
          </div>
          <FinancialRequestSummary
            requested={current.amount}
            authorized={authorizedAmount}
            budget={detail.approved_allocation}
            spending={detail.spending_total}
            requestedLabel={strings.requestedTotal}
            authorizedLabel={strings.currentAuthorizedTotal}
            unavailableLabel={strings.notProvided}
          />
          <FinancialRequestApplicantDetails request={current} />
          <FinancialDecisionHistory
            decisions={current.decisions}
            stateLabels={stateLabels}
            hiddenReasonDecisionId={activeCorrectionId}
          />
          <FinancialDecisionForm
            request={current}
            version={version}
            pending={pending}
            path="/disbursement-requests"
            mutate={mutate}
            onCancel={onCancel}
          />
          <FinancialCancellationForm
            request={current}
            version={version}
            path="/disbursement-requests"
            pending={pending}
            mutate={mutate}
            onSuccess={onCancel}
            className="order-last [&_>_label]:w-full"
          />
        </>
      ) : null}
      {!current && (
        <FinancialRequestCreationContext
          authorized={authorizedAmount}
          budget={detail.approved_allocation}
        />
      )}
      {(!current || ['returned', 'cancelled'].includes(current.state)) &&
        (role === 'AGENT_SAISIE' &&
        !historicalPage &&
        detail.disbursement_remaining_amount !== '0' ? (
          <FinancialRequestCreateForm
            maximumAmount={detail.disbursement_remaining_amount}
            pending={!canSubmit || pending}
            onCancel={onCancel}
            onSubmit={async (values, file) => {
              const result = await submitFinancialRequest(
                mutate,
                '/disbursement-requests',
                {
                  expected_version: detail.version,
                  expected_approved_revision_id: detail.approved_revision_id,
                  ...values,
                },
                file,
              )
              if (result !== false) onCancel()
              return result
            }}
          />
        ) : (
          <p>{strings.authorizationHelp}</p>
        ))}
    </Panel>
  )
}

function ExternalTransferStep({
  activityName,
  current,
  pending,
  mutate,
  error,
  clearError,
}) {
  const version = current.activity_version
  const [transferDate, setTransferDate] = useState(
    current.current_confirmation?.transfer_date || '',
  )
  return (
    <AdministrativeStep
      key={`confirmation:${Boolean(current.current_confirmation)}`}
      title={strings.externalTransfer}
      modalLabel={
        current.current_confirmation
          ? strings.editVirement
          : strings.confirmVirement
      }
      description={
        current.current_confirmation
          ? `${formatXof(current.current_confirmation.amount)} · ${formatDate(current.current_confirmation.transfer_date)}`
          : strings.notRecorded
      }
      completed={Boolean(current.current_confirmation)}
      error={error}
      clearError={clearError}
      actionLabel={
        current.current_confirmation
          ? current.allowed_actions.includes('correct_confirmation')
            ? strings.editVirementAction
            : strings.consultVirement
          : current.allowed_actions.includes('declare_confirmation')
            ? strings.recordVirement
            : null
      }
    >
      {(close) => (
        <>
          {!current.current_confirmation && (
            <div className="grid gap-1">
              <h3 className="text-sm font-medium text-navy">{activityName}</h3>
              <p className="text-sm text-muted-foreground">
                {strings.externalVirementDeclaration}
              </p>
            </div>
          )}
          {current.current_confirmation && (
            <section
              aria-label={strings.recordedVirement}
              className="grid gap-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-navy">{activityName}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {strings.declaredExternalVirement}
                  </p>
                </div>
                <StatusBadge className="bg-success-badge text-success">
                  {strings.recorded}
                </StatusBadge>
              </div>
              <div className="rounded-card border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {strings.transferredAmount}
                </p>
                <p className="mt-1 text-xl font-semibold text-navy">
                  {formatXof(current.current_confirmation.amount)}
                </p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2 [&_dd]:mt-1 [&_dd]:font-medium [&_dd]:text-navy [&_dt]:text-xs [&_dt]:text-muted-foreground">
                <div className="rounded-card border border-border p-4">
                  <dt>{strings.effectiveDate}</dt>
                  <dd>
                    {formatDate(current.current_confirmation.transfer_date)}
                  </dd>
                </div>
                <div className="min-w-0 rounded-card border border-border p-4">
                  <dt>{strings.referenceOrComment}</dt>
                  <dd className="break-words">
                    {current.current_confirmation.note || strings.noReference}
                  </dd>
                </div>
              </dl>
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                {strings.recordedOn}{' '}
                <time
                  className="font-medium text-foreground"
                  dateTime={current.current_confirmation.recorded_at}
                >
                  {formatDateTime(current.current_confirmation.recorded_at)}
                </time>
              </p>
            </section>
          )}
          {(current.allowed_actions.includes('declare_confirmation') ||
            current.allowed_actions.includes('correct_confirmation')) && (
            <BusinessForm
              key={current.current_confirmation?.revision || 'initial'}
              className="grid gap-5 [&_>_label]:w-full"
              onSubmit={async (event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const correcting = Boolean(current.current_confirmation)
                const saved = await mutate(
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
                if (saved !== false) close()
              }}
            >
              <label>
                {strings.actuallyTransferredAmount}
                <input
                  value={formatXof(current.amount).replace(' F CFA', '')}
                  readOnly
                  aria-readonly="true"
                />
              </label>
              <label>
                {strings.virementEffectiveDateRequired}
                <DatePicker
                  label={strings.virementEffectiveDate}
                  value={transferDate}
                  onChange={setTransferDate}
                />
                <input
                  type="hidden"
                  name="transfer_date"
                  value={transferDate}
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
              <label className="grid grid-cols-[auto_1fr] items-center gap-2 [&_input]:size-5">
                <input type="checkbox" required /> Je confirme que ce montant a
                été viré. *
              </label>
              <div data-ui="modal-actions">
                <Button type="button" variant="outline" onClick={close}>
                  Annuler
                </Button>
                <Button type="submit" disabled={pending || !navigator.onLine}>
                  {current.current_confirmation
                    ? 'Corriger la déclaration'
                    : 'Confirmer la déclaration'}
                </Button>
              </div>
            </BusinessForm>
          )}
        </>
      )}
    </AdministrativeStep>
  )
}

function ReversementStep({
  detail,
  current,
  history: reversementHistory,
  pending,
  mutate,
  error,
  clearError,
  uploadEvidence: uploadReversementEvidence,
  file: reversementFile,
  setFile: setReversementFile,
  uploadError: reversementUploadError,
  setUploadError: setReversementUploadError,
  onPage: onReversementPage,
}) {
  const reversementRequestId =
    current.reversement.current_declaration?.request_id || current.id
  const [reversementDate, setReversementDate] = useState(
    current.reversement.current_declaration?.return_date || '',
  )
  const version = current.activity_version
  return (
    <AdministrativeStep
      title={strings.unusedFundsReturn}
      description={`${formatXof(current.reversement.required_amount)} · ${current.reversement.status === 'not_required' ? strings.noReturnRequired : strings.returnRequired}`}
      completed={
        Boolean(current.reversement.current_declaration) ||
        current.reversement.status === 'not_required'
      }
      error={error}
      clearError={clearError}
      actionLabel={
        current.reversement.current_declaration
          ? current.reversement.allowed_actions.includes('correct')
            ? 'Modifier le reversement'
            : 'Consulter le reversement'
          : current.reversement.allowed_actions.includes('declare')
            ? 'Enregistrer le reversement'
            : null
      }
    >
      {(close) => (
        <>
          <h3 id="reversement-title">{strings.partnerReversement}</h3>
          {reversementUploadError && reversementFile && (
            <div
              role="alert"
              className="grid gap-3 border-l-4 border-l-danger p-3"
            >
              <p>
                {reversementUploadError === 'uncertain'
                  ? strings.reversementUploadUncertain
                  : reversementUploadError === 'forbidden'
                    ? strings.reversementUploadForbidden
                    : strings.reversementUploadFailed}
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
                      toast.success(strings.evidenceAdded)
                      close()
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
                  {strings.retryEvidence}
                </Button>
              )}
            </div>
          )}
          <p>
            {strings.formatString(strings.reversementBasis, {
              authorized: formatXof(detail.approved_allocation),
              spent: formatXof(detail.spending_total),
            })}
          </p>
          <dl className="grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] [&_dd]:mt-1 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-lg [&_dd]:font-semibold [&_dd]:text-navy">
            <div>
              <dt>{strings.amountToReverse}</dt>
              <dd>{formatXof(current.reversement.required_amount)}</dd>
            </div>
            <div>
              <dt>{strings.declaredReversement}</dt>
              <dd>{formatXof(current.reversement.declared_amount)}</dd>
            </div>
          </dl>
          {current.reversement.status === 'not_required' && (
            <p className="border-l-4 border-l-primary bg-background py-3 px-4">
              <CheckCircle2 size={16} aria-hidden="true" />{' '}
              {strings.noReversementRequired}
            </p>
          )}
          {current.reversement.current_declaration && (
            <dl className="grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] [&_dd]:mt-1 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-lg [&_dd]:font-semibold [&_dd]:text-navy">
              <div>
                <dt>{strings.reversementEffectiveDate}</dt>
                <dd>
                  {formatDate(
                    current.reversement.current_declaration.return_date,
                  )}
                </dd>
              </div>
              <div>
                <dt>{strings.referenceOrComment}</dt>
                <dd>{current.reversement.current_declaration.note || '—'}</dd>
              </div>
              <div>
                <dt>{strings.recordedOn}</dt>
                <dd>
                  <time
                    dateTime={
                      current.reversement.current_declaration.recorded_at
                    }
                  >
                    {formatDateTime(
                      current.reversement.current_declaration.recorded_at,
                    )}
                  </time>
                </dd>
              </div>
            </dl>
          )}
          {(current.reversement.allowed_actions.includes('declare') ||
            current.reversement.allowed_actions.includes('correct')) && (
            <BusinessForm
              key={
                current.reversement.current_declaration?.revision || 'initial'
              }
              className="grid gap-5 [&_>_label]:w-full"
              onSubmit={async (event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const correcting = Boolean(
                  current.reversement.current_declaration,
                )
                const saved = await mutate(
                  `/virement-requests/${reversementRequestId}/reversement${
                    correcting ? '/corrections' : ''
                  }`,
                  {
                    expected_version: version,
                    return_date: String(data.get('return_date') || ''),
                    note: String(data.get('reversement_note') || ''),
                    ...(correcting
                      ? {
                          reason: String(data.get('reversement_reason') || ''),
                        }
                      : {}),
                  },
                )
                if (!saved) {
                  return
                }
                if (reversementFile) {
                  try {
                    await uploadReversementEvidence(reversementFile)
                    toast.success(strings.reversementWithEvidenceSaved)
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
                close()
              }}
            >
              <p className="border-l-4 border-l-primary bg-background py-3 px-4">
                {strings.exactReversement} :{' '}
                <strong>
                  {formatXof(current.reversement.required_amount)}
                </strong>
              </p>
              <div className="grid gap-[6px] text-[0.8125rem] font-medium">
                <span>{strings.reversementDateRequired}</span>
                <DatePicker
                  label={strings.reversementEffectiveDate}
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
                {strings.reversementNote}
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
                  {strings.reversementCorrectionReason}
                  <textarea
                    name="reversement_reason"
                    required
                    maxLength="4000"
                  />
                </label>
              )}
              <FileSelection
                label={strings.reversementAttachment}
                chooseLabel={strings.chooseFile}
                emptyLabel={strings.noFileSelected}
                file={reversementFile}
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) => {
                  setReversementFile(event.target.files?.[0] || null)
                  setReversementUploadError(null)
                }}
              />
              <label className="grid grid-cols-[auto_1fr] items-center gap-2 [&_input]:size-5">
                <input type="checkbox" required />{' '}
                {strings.exactReversementConfirmation}
              </label>
              <div data-ui="modal-actions">
                <Button type="button" variant="outline" onClick={close}>
                  {strings.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={!reversementDate || pending || !navigator.onLine}
                >
                  {current.reversement.current_declaration
                    ? strings.correctReversement
                    : strings.saveReversement}
                </Button>
              </div>
            </BusinessForm>
          )}
          {reversementHistory?.data?.length > 0 && (
            <details>
              <summary>
                {strings.formatString(strings.reversementHistory, {
                  count: reversementHistory.count,
                })}
              </summary>
              <ol className="border-l border-l-border grid gap-4 ml-2 pl-6 [&_li::marker]:text-primary [&_button]:text-primary [&_button]:font-semibold [&_button]:text-left [&_button]:underline">
                {reversementHistory.data.map((entry) => (
                  <li key={entry.id}>
                    <strong>
                      {entry.correction_reason
                        ? strings.correctedReversement
                        : strings.initialReversement}
                    </strong>
                    <p>
                      {formatXof(entry.returned_amount)} · Date effective :{' '}
                      {formatDate(entry.return_date)}
                    </p>
                    {entry.note && <p>{entry.note}</p>}
                    <p>Déclaré par {entry.actor_name}</p>
                    <p>
                      <time dateTime={entry.recorded_at}>
                        Enregistré le {formatDateTime(entry.recorded_at)}
                      </time>
                    </p>
                    {entry.correction_reason && (
                      <p>Motif : {entry.correction_reason}</p>
                    )}
                  </li>
                ))}
              </ol>
              <Pagination
                label={strings.reversementPagination}
                canPrevious={Boolean(reversementHistory.previous)}
                canNext={Boolean(reversementHistory.next)}
                onPrevious={() =>
                  onReversementPage(reversementHistory.previous)
                }
                onNext={() => onReversementPage(reversementHistory.next)}
              />
            </details>
          )}
        </>
      )}
    </AdministrativeStep>
  )
}

function VirementSection({
  fallback,
  detail,
  result,
  current,
  role,
  authorizedAmount,
  historicalPage,
  pending,
  mutate,
  onCancel,
  activeCorrectionId,
}) {
  if (!result) return fallback
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
    <Panel
      aria-label={strings.virementAuthorization}
      className="flex min-h-0 flex-1 flex-col"
    >
      <p className="text-sm text-muted-foreground">
        {detail.name}
        {current ? ` · ${detail.reference}` : ''}
      </p>
      {current && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <StatusBadge className={administrativeStateClass(current.state)}>
            {administrativeStates[current.state] || current.state}
          </StatusBadge>
          <span>virement · {formatDate(current.submitted_at)}</span>
        </div>
      )}
      {current ? (
        <FinancialRequestSummary
          requested={current.amount}
          authorized={authorizedAmount ?? '0'}
          budget={detail.approved_allocation}
          spending={detail.spending_total}
          requestedLabel={strings.requestedTotal}
          authorizedLabel={strings.authorizedVirementsTotal}
          unavailableLabel={strings.notProvided}
        />
      ) : (
        <FinancialRequestCreationContext
          authorized={authorizedAmount ?? '0'}
          authorizedLabel={strings.authorizedVirementsTotal}
          budget={detail.approved_allocation}
        />
      )}
      {current?.state === 'returned' && <p>{strings.virementReturned}</p>}
      {current ? (
        <>
          <FinancialRequestApplicantDetails request={current} />
          <FinancialDecisionHistory
            decisions={current.decisions}
            stateLabels={stateLabels}
            hiddenReasonDecisionId={activeCorrectionId}
          />
          <FinancialDecisionForm
            request={current}
            version={version}
            pending={pending}
            path="/virement-requests"
            mutate={mutate}
            onCancel={onCancel}
          />
          <FinancialCancellationForm
            request={current}
            version={version}
            path="/virement-requests"
            pending={pending}
            mutate={mutate}
            onSuccess={onCancel}
            className="[&_>_label]:w-full"
          />
        </>
      ) : null}
      {(!current || ['returned', 'cancelled'].includes(current.state)) &&
        (role === 'AGENT_SAISIE' && !historicalPage ? (
          <FinancialRequestCreateForm
            maximumAmount={context.amount}
            pending={!context.can_submit || pending}
            onCancel={onCancel}
            onSubmit={async (values, file) => {
              const result = await submitFinancialRequest(
                mutate,
                '/virement-requests',
                {
                  expected_version: detail.version,
                  expected_disbursement_request_id:
                    context.disbursement_request_id,
                  ...values,
                },
                file,
              )
              if (result !== false) onCancel()
              return result
            }}
          />
        ) : (
          <p>
            {context.unavailable_reason === 'disbursement_required'
              ? 'L’autorisation de décaissement doit être approuvée auparavant.'
              : 'Consultez l’état et l’historique de l’autorisation.'}
          </p>
        ))}
    </Panel>
  )
}

function FundingSection({
  detail,
  result,
  current = null,
  pending,
  mutate,
  fallback,
  onCancel,
  activeCorrectionId,
}) {
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
    <Panel
      aria-labelledby={current ? undefined : 'funding-title'}
      className="flex min-h-0 flex-1 flex-col"
    >
      {!current && <h2 id="funding-title">{strings.fundingTitle}</h2>}
      <p>{strings.fundingExplanation}</p>
      {detail.pause_reason === 'funding_required' && (
        <p>{strings.fundingCorrection}</p>
      )}
      {!current && basis && (
        <p>
          {strings.fundingOldBudget} : {formatXof(basis.old_allocation)} ·{' '}
          {strings.fundingNewBudget} : {formatXof(basis.new_allocation)} ·{' '}
          {strings.fundingIncrement} :{' '}
          <strong>{formatXof(basis.amount)}</strong>
        </p>
      )}
      {!current && result.allowed_actions.includes('submit') && (
        <div data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            disabled={pending || !currentSnapshot}
            onClick={async () => {
              const submitted = await mutate('/funding-requests', {
                expected_version: result.activity_version,
                expected_approved_revision_id: result.approved_revision_id,
              })
              if (submitted !== false) onCancel()
            }}
          >
            {strings.fundingSubmit}
          </Button>
        </div>
      )}
      {!current && !basis && !result.count && <p>{strings.fundingEmpty}</p>}
      {current && (
        <FundingRequest
          row={current}
          version={result.activity_version}
          enabled={currentSnapshot && detail.state === 'approved'}
          pending={pending}
          mutate={mutate}
          states={states}
          onCancel={onCancel}
          onSuccess={onCancel}
          activeCorrectionId={activeCorrectionId}
        />
      )}
    </Panel>
  )
}

function FundingRequest({
  row,
  version,
  enabled,
  pending,
  mutate,
  states,
  onCancel,
  onSuccess,
  activeCorrectionId,
}) {
  const [reason, setReason] = useState('')
  const [editVersion, setEditVersion] = useState(version)
  const disabled = pending || !enabled || editVersion !== version
  const actions = row.allowed_actions
  const hasActions = ['prevalidate', 'approve', 'return', 'cancel'].some(
    (action) => actions.includes(action),
  )
  const send = async (action) => {
    const result = await mutate(
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
    if (result !== false) onSuccess()
  }
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
            {decision.reason && decision.id !== activeCorrectionId && (
              <p>{decision.reason}</p>
            )}
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
      {hasActions && (
        <div data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
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
        </div>
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
