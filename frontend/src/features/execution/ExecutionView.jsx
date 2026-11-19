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
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { ExecutionTasks, TaskEditor } from './ExecutionOperations'
import { strings } from '@/locales/fr/ExecutionView'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import {
  CheckCircle2,
  CircleDollarSign,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/button'
import {
  formatXof,
  formatDate,
  formatDateTime,
  formatExactPercentage,
} from '@/shared/lib/format'
import { cursorFrom } from '@/shared/lib/pagination'
import { useAPI } from '@/shared/api/RestClientProvider'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'
import { AgentNames } from '@/shared/ui/AgentNames'
import { FileSelection } from '@/shared/ui/FileSelection'

function cursorPath(path, cursor) {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path
}

const administrativeStates = {
  submitted: 'À prévalider',
  prevalidated: 'À valider',
  returned: 'À corriger',
  approved: 'Approuvée',
  cancelled: 'Annulée',
}

const administrativeDecisionLabels = {
  prevalidated: 'Prévalidation',
  approved: 'Autorisation définitive',
  returned: 'Retournée',
  cancelled: 'Annulée',
}

const closureBlockerLabels = {
  planning_not_approved:
    'L’Activité doit être approuvée sans demande en cours.',
  execution_ineligible: 'Les tâches approuvées ne peuvent pas être vérifiées.',
  execution_incomplete:
    'Toutes les tâches doivent être terminées et chiffrées.',
  execution_history_unverified: 'L’historique de réalisation est incomplet.',
  spending_ineligible: 'Le total final des dépenses ne peut pas être réglé.',
  disbursement_not_settled: 'Le décaissement exact doit être approuvé.',
  virement_not_settled: 'Le virement exact doit être approuvé.',
  virement_confirmation_required: 'Le virement externe doit être confirmé.',
  reversement_not_settled: 'Le reversement exact doit être enregistré.',
  financial_insufficiency_unresolved:
    'Les dépenses dépassent le montant approuvé.',
  zero_spending_not_approved: 'La déclaration sans dépense doit être validée.',
}

function closureBlockerLabel(blocker) {
  return (
    closureBlockerLabels[blocker] ||
    'Une étape administrative reste à terminer.'
  )
}

function administrativeStateClass(state) {
  if (state === 'approved') return 'bg-success-badge text-success'
  if (state === 'returned' || state === 'cancelled')
    return 'bg-warning-soft text-warning'
  return 'bg-selected text-primary'
}

function latestAdministrativeDecision(request) {
  return (request.decisions || []).reduce((latest, decision) => {
    if (!latest) return decision
    return new Date(decision.decided_at || 0) > new Date(latest.decided_at || 0)
      ? decision
      : latest
  }, null)
}

function administrativeDecisionActor(decision) {
  return (
    decision?.actor_name ||
    decision?.actor_display_name ||
    decision?.actor_email ||
    (decision ? 'Utilisateur indisponible' : null)
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
  description,
  completed = false,
  actionLabel = 'Consulter',
  actionTo,
  secondaryActionLabel,
  onSecondaryAction,
  modalVariant = 'drawer',
  children,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const opener = useRef(null)
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
                onClick={() => setIsOpen(true)}
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
        onClose={() => setIsOpen(false)}
        label={title}
        opener={opener}
        variant={modalVariant}
        className={
          modalVariant === 'drawer'
            ? 'w-[min(640px,100%)]'
            : 'w-[min(560px,calc(100%-32px))]'
        }
      >
        <div className="grid gap-5 p-6 [&>[data-ui='planning-card']]:rounded-none [&>[data-ui='planning-card']]:border-0 [&>[data-ui='planning-card']]:bg-transparent [&>[data-ui='planning-card']]:p-0 [&>[data-ui='planning-card']]:shadow-none">
          {typeof children === 'function'
            ? children(() => setIsOpen(false))
            : children}
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
    enabled:
      financeSection && screen === 'detail' && Boolean(params.activityId),
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
    enabled:
      financeSection && screen === 'detail' && Boolean(params.activityId),
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
      financeSection &&
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
      financeSection &&
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
      financeSection &&
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
      financeSection &&
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
            ...(search.financeRequest ? [selectedFinance] : []),
            ...(virementRequestId ? [selectedVirement] : []),
            ...(selectedVirement.data?.state === 'approved'
              ? [confirmationHistory]
              : []),
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
        mutate={async (taskId, subtaskId, body) => {
          const result = await mutation
            .mutateAsync({ taskId, subtaskId, body })
            .catch(() => false)
          return result
        }}
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
                      search={{ tab: 'realization', origin: 'execution' }}
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
                      <Link
                        to={Urls.activity}
                        params={{ activityId: row.id }}
                        search={{ tab: 'realization', origin: 'execution' }}
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
  section,
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
  const tasks = detail.tasks ?? []
  const taskDetail = {
    ...detail,
    tasks,
    task_count: detail.task_count ?? tasks.length,
    completed_tasks: detail.completed_tasks ?? 0,
    progress: detail.progress ?? null,
  }
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [selectedSubtaskId, setSelectedSubtaskId] = useState(null)
  const [selectedZeroSpendingId, setSelectedZeroSpendingId] = useState(null)
  const [financialDrawer, setFinancialDrawer] = useState(
    selectedFinance
      ? 'disbursement'
      : virementSelectedBySearch && selectedVirement
        ? 'virement'
        : null,
  )
  const [financialModalMode, setFinancialModalMode] = useState(
    selectedFinance || (virementSelectedBySearch && selectedVirement)
      ? 'request'
      : 'new',
  )
  const taskOpener = useRef(null)
  const financialDrawerOpener = useRef(null)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)
  const selectedTarget = selectedSubtaskId
    ? selectedTask?.subtasks.find((child) => child.id === selectedSubtaskId)
    : selectedTask
  const recordedTasks = tasks.filter(
    (task) => task.actual_spent !== null,
  ).length
  const plannedAmount = BigInt(detail.approved_allocation)
  const recordedAmount =
    detail.spending_total === null ? null : BigInt(detail.spending_total)
  const acceptedAmount =
    detail.realization_status === 'validated' ? recordedAmount : null
  const approvedDisbursement = finance?.data?.find(
    (request) => request.state === 'approved',
  )
  const authorizedAmount =
    approvedDisbursement?.amount ??
    (detail.virement_context?.disbursement_request_id
      ? detail.virement_context.amount
      : null)
  const authorizationPending = finance?.data?.some((request) =>
    ['submitted', 'prevalidated'].includes(request.state),
  )
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
  const validationLabel =
    strings.realizationValidationStates[detail.realization_status] ||
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
      kind: 'Décaissement',
      drawer: 'disbursement',
    })),
    ...(virements?.data || []).map((request) => ({
      ...request,
      kind: 'Virement',
      drawer: 'virement',
    })),
    ...(funding?.data || []).map((request) => ({
      ...request,
      kind: 'Financement complémentaire',
      drawer: 'funding',
    })),
    ...(zeroSpending?.data || []).map((request) => ({
      ...request,
      amount: '0',
      kind: 'Déclaration sans dépense',
      drawer: 'zero',
    })),
  ]
  const closureRequestDrawers = {
    zero_spending_not_approved: 'zero',
    disbursement_not_settled: 'disbursement',
    virement_not_settled: 'virement',
    financial_insufficiency_unresolved: 'funding',
  }
  const closureRequestDrawer = detail.closure_blockers
    ?.map((blocker) => closureRequestDrawers[blocker])
    .find(Boolean)
  const closureRequest = closureRequestDrawer
    ? financialRequests.find(
        (request) =>
          request.drawer === closureRequestDrawer &&
          ['submitted', 'prevalidated', 'returned'].includes(request.state),
      )
    : null
  const closureRequestOwner = closureRequest
    ? {
        submitted: 'Agent superviseur',
        prevalidated: 'Validateur définitif',
        returned: 'Agent de saisie',
      }[closureRequest.state]
    : null
  const openFinancialRequest = (request, trigger) => {
    financialDrawerOpener.current = trigger
    setFinancialModalMode('request')
    if (request.drawer === 'disbursement') onFinanceSelect(request.id)
    if (request.drawer === 'virement') onVirementSelect(request.id)
    if (request.drawer === 'zero') setSelectedZeroSpendingId(request.id)
    setFinancialDrawer(request.drawer)
  }
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
          : role === 'AGENT_SAISIE' &&
              detail.works_completed &&
              Number(detail.spending_total) > 0 &&
              !finance?.data?.some(
                (row) => !['returned', 'cancelled'].includes(row.state),
              )
            ? 'disbursement'
            : null
  const financialDrawerLabels = {
    disbursement: 'Autorisation de décaissement',
    virement: 'Autorisation de virement',
    funding: 'Financement complémentaire',
    zero: 'Déclaration sans dépense',
  }
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
      {error && (
        <p role="alert" className="border-l-4 border-l-danger p-3 bg-white">
          {error}
        </p>
      )}
      {detail.execution_paused &&
        detail.pause_reason !== 'disbursement_frozen' && (
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
              onSelect={(taskId, subtaskId, opener) => {
                taskOpener.current = opener
                setSelectedTaskId(taskId)
                setSelectedSubtaskId(subtaskId)
              }}
            />
            <section className="border-t border-border px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2>Validation de la réalisation</h2>
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
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={(event) => {
                            taskOpener.current = event.currentTarget
                            setSelectedTaskId(task.id)
                            setSelectedSubtaskId(
                              group.kind === 'subtask' ? subtask?.id : null,
                            )
                          }}
                        >
                          {canRecord
                            ? group.kind === 'subtask'
                              ? 'Renseigner les sous-tâches'
                              : 'Renseigner la tâche'
                            : 'Consulter'}
                        </Button>
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
                        to={Urls.activity}
                        params={{ activityId: detail.id }}
                        search={(current) => ({ ...current, tab: 'finance' })}
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
          <Modal
            open={Boolean(selectedTarget)}
            onClose={() => {
              setSelectedTaskId(null)
              setSelectedSubtaskId(null)
            }}
            label={selectedTarget?.name || 'Tâche'}
            opener={taskOpener}
            className="w-[min(560px,calc(100%-32px))]"
          >
            {selectedTask && selectedTarget && (
              <TaskEditor
                activity={detail}
                task={selectedTask}
                target={selectedTarget}
                isSubtask={Boolean(selectedSubtaskId)}
                pending={pending}
                onCancel={() => {
                  setSelectedTaskId(null)
                  setSelectedSubtaskId(null)
                }}
                mutate={async (...args) => {
                  const result = await mutate(...args)
                  if (result !== false) {
                    setSelectedTaskId(null)
                    setSelectedSubtaskId(null)
                  }
                  return result
                }}
              />
            )}
          </Modal>
        </>
      )}
      {section !== 'realization' && (
        <Panel
          aria-labelledby="financial-situation-title"
          className="gap-0 overflow-hidden p-0"
        >
          <header className="border-b border-border px-6 py-5">
            <h2 id="financial-situation-title">Situation financière</h2>
          </header>
          <dl className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-6 px-6 py-5 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1">
            <div>
              <dt className="text-xs text-muted-foreground">Montant prévu</dt>
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
            {recordedAmount !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">
                  Dépenses enregistrées
                </dt>
                <dd className="mt-1 font-semibold text-navy">
                  {formatXof(String(recordedAmount))}
                  {recordedTasks < taskDetail.task_count ? ' · partielles' : ''}
                </dd>
              </div>
            )}
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
                  Solde non utilisé
                </dt>
                <dd className="mt-1 font-semibold text-navy">
                  {formatXof(String(unusedBalance))}
                </dd>
              </div>
            )}
          </dl>
          {financialVariance !== null && (
            <div className="mx-6 flex flex-wrap items-center gap-5 border-y border-border py-4 text-xs">
              <span className="text-muted-foreground">Écart financier</span>
              <strong className="font-semibold text-navy">
                Dépassement de {formatXof(String(financialVariance))}
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
                Demandes financières
              </h2>
              {newFinancialRequest && (
                <Button
                  type="button"
                  size="sm"
                  onClick={(event) => {
                    financialDrawerOpener.current = event.currentTarget
                    setSelectedZeroSpendingId(null)
                    setFinancialModalMode('new')
                    setFinancialDrawer('chooser')
                  }}
                >
                  Nouvelle demande
                </Button>
              )}
            </header>
            {financialRequests.length > 0 ? (
              <div className="overflow-x-auto border-t border-border px-3 py-2">
                <table className="w-full min-w-180 text-left text-[0.8125rem]">
                  <thead className="border-b border-border bg-background">
                    <tr>
                      <th className="p-3 font-medium">Demande / date</th>
                      <th className="p-3 text-right font-medium">
                        Montant total
                      </th>
                      <th className="p-3 font-medium">Statut</th>
                      <th className="p-3 font-medium">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialRequests.map((request) => {
                      const actions = request.allowed_actions || []
                      const actionLabel = actions.some((action) =>
                        ['prevalidate', 'approve'].includes(action),
                      )
                        ? 'Examiner'
                        : request.state === 'returned' &&
                            role === 'AGENT_SAISIE'
                          ? 'Reprendre'
                          : 'Consulter'
                      const latestDecision =
                        latestAdministrativeDecision(request)
                      const decisionActor =
                        administrativeDecisionActor(latestDecision)
                      return (
                        <tr
                          key={`${request.kind}:${request.id}`}
                          className="border-b border-border last:border-0"
                        >
                          <td className="p-3">
                            <strong className="block text-navy">
                              {request.kind}
                            </strong>
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
                            <StatusBadge
                              className={administrativeStateClass(
                                request.state,
                              )}
                            >
                              {administrativeStates[request.state] ||
                                request.state}
                            </StatusBadge>
                            {latestDecision && (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {administrativeDecisionLabels[
                                  latestDecision.outcome
                                ] || latestDecision.outcome}
                                {decisionActor ? ` · ${decisionActor}` : ''}
                                {latestDecision.decided_at
                                  ? ` · ${formatDateTime(latestDecision.decided_at)}`
                                  : ''}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                openFinancialRequest(
                                  request,
                                  event.currentTarget,
                                )
                              }}
                            >
                              {actionLabel}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="border-t border-border px-6 py-5 text-sm text-muted-foreground">
                Aucune demande financière.
              </p>
            )}
          </Panel>
          <Modal
            open={Boolean(financialDrawer)}
            onClose={() => {
              setFinancialDrawer(null)
              setSelectedZeroSpendingId(null)
            }}
            label={
              financialModalMode === 'new'
                ? 'Nouvelle demande'
                : financialDrawerLabels[financialDrawer] || 'Demande financière'
            }
            opener={financialDrawerOpener}
            variant="dialog"
          >
            <div className="p-6 [&>[data-ui='planning-card']]:rounded-none [&>[data-ui='planning-card']]:border-0 [&>[data-ui='planning-card']]:bg-transparent [&>[data-ui='planning-card']]:p-0 [&>[data-ui='planning-card']]:shadow-none">
              {financialDrawer === 'chooser' && (
                <div className="grid gap-0">
                  {[
                    {
                      key: 'disbursement',
                      label: 'Autorisation de décaissement',
                      detail: `Total actuellement autorisé : ${authorizedAmount === null ? strings.notProvided : formatXof(authorizedAmount)}`,
                    },
                    {
                      key: 'virement',
                      label: 'Autorisation de virement',
                    },
                    {
                      key: 'funding',
                      label: 'Financement complémentaire',
                      hidden: newFinancialRequest !== 'funding',
                    },
                    {
                      key: 'zero',
                      label: 'Déclaration sans dépense',
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
                          disabled={newFinancialRequest !== option.key}
                          onClick={() => {
                            setFinancialModalMode('request')
                            setFinancialDrawer(option.key)
                          }}
                        >
                          Créer
                        </Button>
                      </div>
                    ),
                  )}
                </div>
              )}
              {financialDrawer === 'zero' && (
                <ZeroSpendingSection
                  fallback={sectionFallbacks.zeroSpending}
                  detail={detail}
                  result={zeroSpending}
                  selectedId={selectedZeroSpendingId}
                  role={role}
                  pending={pending}
                  mutate={mutateFinance}
                  onPage={onZeroSpendingPage}
                  onCancel={() => setFinancialDrawer(null)}
                />
              )}
              {financialDrawer === 'disbursement' &&
                (detail.works_completed ? (
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
                    onCancel={() => setFinancialDrawer(null)}
                  />
                ) : (
                  <p>{strings.previousStepsIncomplete}</p>
                ))}
              {financialDrawer === 'virement' &&
                (detail.works_completed ? (
                  <VirementSection
                    fallback={sectionFallbacks.virements}
                    detail={detail}
                    result={virements}
                    current={currentVirement}
                    selectedBySearch={virementSelectedBySearch}
                    role={role}
                    historicalPage={virementHistoryPage}
                    pending={pending}
                    mutate={mutateFinance}
                    onPage={onVirementPage}
                    onSelect={onVirementSelect}
                    onCancel={() => setFinancialDrawer(null)}
                  />
                ) : (
                  <p>{strings.previousStepsIncomplete}</p>
                ))}
              {financialDrawer === 'funding' && (
                <FundingSection
                  fallback={sectionFallbacks.funding}
                  detail={detail}
                  result={funding}
                  pending={pending}
                  mutate={mutateFinance}
                  onPage={onFundingPage}
                  onCancel={() => setFinancialDrawer(null)}
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
                    current={currentVirement}
                    history={confirmationHistory}
                    pending={pending}
                    mutate={mutateFinance}
                    onPage={onConfirmationPage}
                  />
                  {currentVirement.reversement && (
                    <ReversementStep
                      detail={detail}
                      current={currentVirement}
                      history={reversementHistory}
                      pending={pending}
                      mutate={mutateFinance}
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
                  status="À venir"
                  actionLabel={null}
                >
                  <p>{strings.previousStepsIncomplete}</p>
                </AdministrativeStep>
              ))}
            <AdministrativeStep
              key={`closure:${Boolean(detail.closure)}:${detail.allowed_actions?.includes('close')}`}
              title="Clôture de l’activité"
              description={
                detail.closure
                  ? 'Confirmer que l’activité et son règlement sont terminés.'
                  : detail.works_completed && detail.closure_blockers?.length
                    ? `${closureBlockerLabel(detail.closure_blockers[0])}${
                        closureRequestOwner
                          ? ` Responsable : ${closureRequestOwner}.`
                          : ''
                      }`
                    : detail.works_completed
                      ? 'Confirmer que l’activité et son règlement sont terminés.'
                      : strings.finishRealization
              }
              status={detail.closure ? 'Terminée' : 'À venir'}
              completed={Boolean(detail.closure)}
              defaultOpen={detail.allowed_actions?.includes('close')}
              actionLabel={
                detail.closure
                  ? 'Consulter'
                  : detail.allowed_actions?.includes('close')
                    ? 'Clôturer l’activité'
                    : !detail.works_completed
                      ? 'Renseigner la réalisation'
                      : 'Consulter'
              }
              actionTo={
                !detail.closure && !detail.works_completed
                  ? {
                      to: Urls.activity,
                      params: { activityId: detail.id },
                      search: (current) => ({
                        ...current,
                        tab: 'realization',
                      }),
                    }
                  : undefined
              }
              secondaryActionLabel={
                closureRequest
                  ? closureRequest.allowed_actions?.some((action) =>
                      ['prevalidate', 'approve'].includes(action),
                    )
                    ? 'Examiner la demande'
                    : 'Ouvrir la demande'
                  : undefined
              }
              onSecondaryAction={(event) =>
                openFinancialRequest(closureRequest, event.currentTarget)
              }
              modalVariant="dialog"
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
  selectedId,
  role,
  pending,
  mutate,
  onPage,
  onCancel,
}) {
  if (!result) return fallback
  const declarations = result.data
  const selected = selectedId
    ? declarations.find((row) => row.id === selectedId)
    : null
  const current =
    selected || declarations.find((row) => row.state !== 'returned')
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
    <Panel
      aria-labelledby="zero-spending-title"
      className="flex min-h-0 flex-1 flex-col"
    >
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
        Confirmez pourquoi toutes les tâches ont été réalisées sans dépense.
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
          <div data-ui="modal-actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
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
              className="grid gap-5 [&_>_label]:w-full"
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
          className="grid gap-5 [&_>_label]:w-full"
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

function ClosureSection({ detail, pending, mutate, onCancel }) {
  const blockers = detail.closure_blockers || []
  return (
    <section aria-labelledby="closure-title" className="grid gap-5">
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
            <div>
              <dt>Clôturée par</dt>
              <dd>{detail.closure.closed_by_name}</dd>
            </div>
          </dl>
          <Button asChild variant="link" className="w-fit px-0">
            <Link
              to={Urls.activity}
              params={{ activityId: detail.id }}
              search={(current) => ({ ...current, tab: 'history' })}
            >
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
  historicalPage,
  pending,
  mutate,
  onPage,
  onSelect,
  onCancel,
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
    <Panel
      aria-label="Autorisation de décaissement"
      className="flex min-h-0 flex-1 flex-col"
    >
      <p className="text-sm text-muted-foreground">
        {detail.name} · {detail.reference}
      </p>
      {current ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge className={administrativeStateClass(current.state)}>
              {administrativeStates[current.state] || current.state}
            </StatusBadge>
            <span>décaissement · {formatDate(current.submitted_at)}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-border pb-5 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Total demandé</dt>
              <dd className="mt-1 text-base font-medium">
                {formatXof(current.amount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Budget prévu</dt>
              <dd className="mt-1 text-base font-medium">
                {formatXof(detail.approved_allocation)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Dépenses enregistrées
              </dt>
              <dd className="mt-1 text-base font-medium">
                {formatXof(detail.spending_total)}
              </dd>
            </div>
          </dl>
          <section className="grid gap-3 border-b border-border pb-5">
            <h3 className="font-semibold">Décisions</h3>
            {current.decisions.length ? (
              <ol className="grid gap-3">
                {current.decisions.map((decision) => (
                  <li key={decision.id} className="text-sm">
                    <strong>
                      {decision.stage === 'supervisor'
                        ? 'Superviseur'
                        : 'Validateur'}{' '}
                      · {stateLabels[decision.outcome] || decision.outcome}
                    </strong>
                    <span className="mt-1 block text-muted-foreground">
                      {decision.actor_name} ·{' '}
                      {formatDateTime(decision.decided_at)}
                    </span>
                    {decision.reason && (
                      <p className="mt-1">{decision.reason}</p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune décision.</p>
            )}
          </section>
          <BusinessForm
            className="order-last grid gap-5"
            onSubmit={async (event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const result = await mutate(
                `/disbursement-requests/${current.id}/decisions`,
                {
                  expected_version: version,
                  decision: 'return',
                  reason: String(data.get('reason') || ''),
                },
              )
              if (result !== false) onCancel()
              return result
            }}
          >
            {current.allowed_actions.includes('return') && (
              <label>
                Observation / motif du retour *
                <textarea name="reason" required maxLength="4000" />
              </label>
            )}
            <div data-ui="modal-actions" className="order-last">
              <Button type="button" variant="outline" onClick={onCancel}>
                Annuler
              </Button>
              {current.allowed_actions.includes('return') && (
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending || !navigator.onLine}
                >
                  Retourner en correction
                </Button>
              )}
              {current.allowed_actions.includes('prevalidate') && (
                <Button
                  type="button"
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
                  type="button"
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
          </BusinessForm>
          {current.allowed_actions.includes('cancel') && (
            <BusinessForm
              className="order-last [&_>_label]:w-full"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const reason = String(data.get('reason') || '')
                return mutate(
                  `/disbursement-requests/${current.id}/cancellation`,
                  { expected_version: version, reason },
                )
              }}
            >
              <label>
                Motif *
                <textarea name="reason" required maxLength="4000" />
              </label>
              <Button
                type="submit"
                variant="outline"
                disabled={pending || !navigator.onLine}
              >
                <XCircle size={16} /> Annuler la demande
              </Button>
            </BusinessForm>
          )}
        </>
      ) : null}
      {!current && (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-border pb-5 text-sm max-[520px]:grid-cols-1">
          <div>
            <dt className="text-xs text-muted-foreground">Budget prévu</dt>
            <dd className="mt-1 text-base font-medium">
              {formatXof(detail.approved_allocation)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Dépenses enregistrées
            </dt>
            <dd className="mt-1 text-base font-medium">
              {formatXof(detail.spending_total)}
            </dd>
          </div>
        </dl>
      )}
      {(!current || ['returned', 'cancelled'].includes(current.state)) &&
        (role === 'AGENT_SAISIE' &&
        !historicalPage &&
        detail.spending_total !== '0' ? (
          <div data-ui="modal-actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={!canSubmit || pending || !navigator.onLine}
              onClick={() =>
                mutate('/disbursement-requests', {
                  expected_version: detail.version,
                  expected_approved_revision_id: detail.approved_revision_id,
                })
              }
            >
              <CircleDollarSign size={16} /> Soumettre la demande
            </Button>
          </div>
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

function ExternalTransferStep({
  current,
  history: confirmationHistory,
  pending,
  mutate,
  onPage: onConfirmationPage,
}) {
  const version = current.activity_version
  const [transferDate, setTransferDate] = useState(
    current.current_confirmation?.transfer_date || '',
  )
  return (
    <AdministrativeStep
      key={`confirmation:${Boolean(current.current_confirmation)}`}
      title={strings.externalTransfer}
      description={
        current.current_confirmation
          ? `${formatXof(current.current_confirmation.amount)} · ${formatDate(current.current_confirmation.transfer_date)}`
          : 'Non enregistré'
      }
      status={current.current_confirmation ? 'Confirmé' : 'À confirmer'}
      completed={Boolean(current.current_confirmation)}
      actionLabel={
        current.current_confirmation
          ? current.allowed_actions.includes('correct_confirmation')
            ? 'Modifier le virement'
            : 'Consulter le virement'
          : current.allowed_actions.includes('declare_confirmation')
            ? 'Enregistrer le virement'
            : null
      }
      defaultOpen={
        !current.current_confirmation ||
        current.allowed_actions.some((action) =>
          ['declare_confirmation', 'correct_confirmation'].includes(action),
        ) ||
        current.reversement?.allowed_actions?.some((action) =>
          ['declare', 'correct'].includes(action),
        )
      }
      modalVariant="dialog"
    >
      {(close) => (
        <>
          <h3>Virement externe déclaré</h3>
          <p>
            MJL enregistre la déclaration de l’Agent sans vérifier le mouvement
            bancaire. Le montant doit correspondre exactement à{' '}
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
                    {formatDateTime(current.current_confirmation.recorded_at)}
                  </time>
                </dd>
              </div>
            </dl>
          )}
          {(current.allowed_actions.includes('declare_confirmation') ||
            current.allowed_actions.includes('correct_confirmation')) && (
            <BusinessForm
              key={current.current_confirmation?.revision || 'initial'}
              className="grid gap-5 [&_>_label]:w-full"
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
                <DatePicker
                  label="Date effective du virement"
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
              {(confirmationHistory.previous || confirmationHistory.next) && (
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
                    onClick={() => onConfirmationPage(confirmationHistory.next)}
                  >
                    Suivant
                  </Button>
                </nav>
              )}
            </details>
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
  uploadEvidence: uploadReversementEvidence,
  file: reversementFile,
  setFile: setReversementFile,
  uploadError: reversementUploadError,
  setUploadError: setReversementUploadError,
  onPage: onReversementPage,
}) {
  const [reversementDate, setReversementDate] = useState(
    current.reversement.current_declaration?.return_date || '',
  )
  const version = current.activity_version
  return (
    <AdministrativeStep
      title={strings.unusedFundsReturn}
      description={`${formatXof(current.reversement.required_amount)} · ${current.reversement.status === 'not_required' ? strings.noReturnRequired : strings.returnRequired}`}
      status={
        current.reversement.current_declaration ||
        current.reversement.status === 'not_required'
          ? strings.completedMasculine
          : 'À confirmer'
      }
      completed={
        Boolean(current.reversement.current_declaration) ||
        current.reversement.status === 'not_required'
      }
      actionLabel={
        current.reversement.current_declaration
          ? current.reversement.allowed_actions.includes('correct')
            ? 'Modifier le reversement'
            : 'Consulter le reversement'
          : current.reversement.allowed_actions.includes('declare')
            ? 'Enregistrer le reversement'
            : null
      }
      defaultOpen={current.reversement.allowed_actions.some((action) =>
        ['declare', 'correct'].includes(action),
      )}
      modalVariant="dialog"
    >
      {(close) => (
        <>
          <h3 id="reversement-title">Reversement au Partenaire</h3>
          {reversementUploadError && reversementFile && (
            <div
              role="alert"
              className="grid gap-3 border-l-4 border-l-danger p-3"
            >
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
          <p>
            Montant autorisé :{' '}
            <strong>{formatXof(detail.approved_allocation)}</strong> · montant
            dépensé : <strong>{formatXof(current.amount)}</strong>.
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
              <CheckCircle2 size={16} aria-hidden="true" /> Aucun reversement
              requis.
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
                <dd>{current.reversement.current_declaration.note || '—'}</dd>
              </div>
              <div>
                <dt>Enregistré le</dt>
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
                  `/virement-requests/${current.id}/reversement${
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
                    current.reversement.current_declaration?.note || ''
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
              <FileSelection
                label="Pièce justificative du reversement"
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
                <input type="checkbox" required /> Je confirme que ce montant
                exact a été reversé au Partenaire. *
              </label>
              <div data-ui="modal-actions">
                <Button type="button" variant="outline" onClick={close}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={!reversementDate || pending || !navigator.onLine}
                >
                  {current.reversement.current_declaration
                    ? 'Corriger le reversement'
                    : 'Enregistrer le reversement'}
                </Button>
              </div>
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
                      {entry.correction_reason
                        ? 'Reversement corrigé'
                        : 'Reversement initial'}
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
              {(reversementHistory.previous || reversementHistory.next) && (
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
                    onClick={() => onReversementPage(reversementHistory.next)}
                  >
                    Suivant
                  </Button>
                </nav>
              )}
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
  selectedBySearch,
  role,
  historicalPage,
  pending,
  mutate,
  onPage,
  onSelect,
  onCancel,
}) {
  if (!result) return fallback
  const requests = result.data
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
      aria-label="Autorisation de virement"
      className="flex min-h-0 flex-1 flex-col"
    >
      <p className="text-sm text-muted-foreground">
        {detail.name} · {detail.reference}
      </p>
      <div className="flex justify-end items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        {current && <strong>{stateLabels[current.state]}</strong>}
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-border pb-5 text-sm max-[520px]:grid-cols-1">
        <div>
          <dt className="text-xs text-muted-foreground">Budget prévu</dt>
          <dd className="mt-1 text-base font-medium">
            {formatXof(detail.approved_allocation)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Total actuellement autorisé
          </dt>
          <dd className="mt-1 text-base font-medium">
            {(current?.amount ?? context.amount)
              ? formatXof(current?.amount ?? context.amount)
              : strings.notProvided}
          </dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
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
          <div data-ui="modal-actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            {current.allowed_actions.includes('prevalidate') && (
              <Button
                type="button"
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
                type="button"
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
          <div data-ui="modal-actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={!context.can_submit || pending || !navigator.onLine}
              onClick={() =>
                mutate('/virement-requests', {
                  expected_version: detail.version,
                  expected_disbursement_request_id:
                    context.disbursement_request_id,
                })
              }
            >
              <CircleDollarSign size={16} /> Soumettre la demande
            </Button>
          </div>
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

function FundingSection({
  detail,
  result,
  pending,
  mutate,
  onPage,
  fallback,
  onCancel,
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
      aria-labelledby="funding-title"
      className="flex min-h-0 flex-1 flex-col"
    >
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
        <div data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
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
        </div>
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
