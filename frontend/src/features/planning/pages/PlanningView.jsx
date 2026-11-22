import { Urls } from '@/app/urls'
import { PTAModal } from '../components/PTAModal'
import { ActivityBriefModal } from '../components/ActivityBriefModal'
import { DatePicker } from '@/shared/ui/DatePicker'
import { ExactNumberInput } from '@/shared/ui/ExactNumberInput'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { strings as ptaStrings } from '@/locales/fr/PTAModal'
import { readCalendar } from '../lib/calendar'
import { PlanningActivities } from '../components/PlanningActivities'
import { PlanningSummary } from '../components/PlanningSummary'
import { ActivityTimeline } from '@/features/audit/ActivityTimeline'
import { activityStatusClass } from '../lib/activity-status'
import { Select } from '@/shared/ui/select'
import { EmptyContent, EmptyTable } from '@/shared/ui/EmptyContent'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/session/SessionProvider'
import { authorization } from '@/features/auth/session/authorization'
import { PageLoading, LoadingPlaceholder } from '@/shared/ui/PageLoading'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Navigate,
  Link,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { Folder, LoaderCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { strings } from '@/locales/fr/PlanningView'
import { strings as common } from '@/locales/fr/common'
import { useAPI } from '@/shared/api/RestClientProvider'
import { formatDate, formatDateTime, formatXof } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { ProtectedDownload } from '@/shared/ui/ProtectedDownload'
import { FileSelection } from '@/shared/ui/FileSelection'
import { CompactAllocationTable } from '../components/CompactAllocationTable'
import { strings as executionStrings } from '@/locales/fr/ExecutionView'
import { ExecutionView } from '@/features/execution/ExecutionView'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Modal } from '@/shared/ui/BusinessModal'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'
import { AgentSearchPanel } from '@/shared/ui/AgentSearchPanel'
import { ActivityForm } from '../components/ActivityForm'
import { physicalExecutionLabel } from '../lib/physical-execution'
import { administrativeReminderSchedule } from '../lib/administrative-reminder'
import { activitySubmissionProblems } from '../lib/activity-submission-validation'
import { Pagination } from '@/shared/ui/Pagination'
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs'
import { ProtectedFilePreview } from '@/shared/ui/ProtectedFilePreview'

export { ActivityForm } from '../components/ActivityForm'

const labels = {
  partners: strings.partners,
  projects: strings.projects,
  pta: strings.annualPlan,
  activityNew: strings.newActivity,
  activity: strings.activityDetail,
}

function planningQuery(api, user, key, path, onDenied, read) {
  return {
    queryKey: ['planning', user, ...key],
    queryFn: async ({ signal, client, queryKey }) => {
      try {
        return await (read
          ? read(signal)
          : api.request(`/api/v1${path}`, { signal }))
      } catch (error) {
        if ([403, 404].includes(error.status)) {
          if (key[0] === 'activity-history')
            client.setQueriesData(
              { queryKey: ['planning', user, 'activity-history', key[1]] },
              null,
            )
          else client.setQueryData(queryKey, null)
        }
        if (error.status === 401) onDenied?.()
        throw error
      }
    },
    retry: false,
  }
}

export function PlanningView({ screen }) {
  const params = useParams({ strict: false })
  const session = useSessionQuery()
  if (session.isPending) return <PlanningLoading screen={screen} />
  if (!authorization(session.data).can('business'))
    return <AccessDeniedState role={session.data?.user?.role} />
  return (
    <Workspace
      key={`${screen}:${params.activityId || params.projectId || ''}:${params.year || ''}`}
      screen={screen}
      session={session.data}
      onDenied={() => {}}
    />
  )
}

function cursorPath(path, token) {
  return token ? `${path}?cursor=${encodeURIComponent(token)}` : path
}

function cursorFrom(link) {
  return link ? new URL(link).searchParams.get('cursor') || '' : ''
}

function shiftTransferDate(value, dayDelta) {
  if (!value) return null
  const shifted = new Date(`${value}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + dayDelta)
  return shifted.toISOString().slice(0, 10)
}

function shiftedTransferTasks(tasks, sourceStart, targetStart) {
  if (!sourceStart || !targetStart) return []
  const dayDelta = Math.round(
    (Date.parse(`${targetStart}T00:00:00Z`) -
      Date.parse(`${sourceStart}T00:00:00Z`)) /
      86400000,
  )
  return (tasks || []).map((task) => ({
    id: task.id,
    planned_start: shiftTransferDate(task.planned_start, dayDelta),
    planned_end: shiftTransferDate(task.planned_end, dayDelta),
    subtasks: (task.subtasks || []).map((child) => ({
      id: child.id,
      planned_start: shiftTransferDate(child.planned_start, dayDelta),
      planned_end: shiftTransferDate(child.planned_end, dayDelta),
    })),
  }))
}

function workflowActivityId(path) {
  return path.match(
    /^\/activities\/([^/]+)\/(?:submissions|amendments(?:\/[^/]+\/cancellation)?|withdrawals(?:\/[^/]+\/cancellation)?|transfers(?:\/[^/]+\/cancellation)?|revisions\/[^/]+\/decisions)$/,
  )?.[1]
}

function planningSuccessMessage({ path, method = 'POST', body }) {
  if (path === '/partners') return strings.partnerCreated
  if (/^\/partners\/[^/]+$/.test(path)) return strings.partnerUpdated
  if (path === '/projects') return strings.projectCreated
  if (/^\/projects\/[^/]+$/.test(path))
    return body?.action === 'close'
      ? strings.projectClosed
      : strings.projectUpdated
  if (/\/ptas\/\d+\/activities$/.test(path)) return strings.activityDraftCreated
  if (/^\/activities\/[^/]+$/.test(path) && method === 'PATCH')
    return strings.activityDraftUpdated
  if (/\/submissions$/.test(path)) return strings.activitySubmitted
  if (/\/assignments$/.test(path)) return strings.activityAssignmentsUpdated
  if (/\/amendments\/[^/]+\/cancellation$/.test(path))
    return strings.amendmentCancelled
  if (/\/amendments$/.test(path)) return strings.amendmentOpened
  if (/\/withdrawals\/[^/]+\/cancellation$/.test(path))
    return strings.withdrawalCancelled
  if (/\/withdrawals$/.test(path)) return strings.withdrawalRequested
  if (/\/transfers\/[^/]+\/cancellation$/.test(path))
    return strings.transferCancelled
  if (/\/transfers$/.test(path)) return strings.transferRequested
  if (/\/decisions$/.test(path)) {
    if (body?.decision === 'prevalidate') return strings.activityPrevalidated
    if (body?.decision === 'approve') return strings.activityApproved
    if (body?.decision === 'return') return strings.activityReturned
  }
  return strings.saved
}

function Workspace({ screen, session, onDenied }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const user = session.user
  const [error, setError] = useState('')
  const [workflowReconciliation, setWorkflowReconciliation] = useState(null)
  const authGeneration = useRef(0)
  const mutationController = useRef(null)
  const exportController = useRef(null)
  const denyWorkspace = useCallback(() => {
    authGeneration.current += 1
    mutationController.current?.abort()
    exportController.current?.abort()
    onDenied()
  }, [onDenied])
  useEffect(
    () => () => {
      authGeneration.current += 1
      mutationController.current?.abort()
      exportController.current?.abort()
    },
    [],
  )
  const mutation = useMutation({
    retry: false,
    networkMode: 'always',
    meta: { localError: true },
    mutationFn: async ({ path, body, method }) => {
      const generation = authGeneration.current
      const controller = new AbortController()
      mutationController.current = controller
      const result = await api.request(`/api/v1${path}`, {
        body,
        method,
        csrf: session.csrf,
        signal: controller.signal,
      })
      if (generation !== authGeneration.current)
        throw new DOMException('Stale authorization', 'AbortError')
      return result
    },
    onError: async (problem, variables) => {
      if (problem.name === 'AbortError') return
      if (problem.status === 401) denyWorkspace()
      const uncertain =
        problem.code === 'activity_assignment_required' ||
        problem.status === 409 ||
        ['network', 'malformed'].includes(problem.kind)
      const activityId = workflowActivityId(variables.path)
      if (uncertain && activityId) {
        setWorkflowReconciliation({
          activityId,
          activityUpdatedAt: activity.dataUpdatedAt,
          revisionsUpdatedAt: revisions.dataUpdatedAt,
        })
      }
      if (uncertain) {
        await Promise.all([
          client.invalidateQueries({ queryKey: ['planning', user.id] }),
          ...(activityId
            ? [client.invalidateQueries({ queryKey: ['access'] })]
            : []),
        ])
      }
      if (variables.path !== '/task-categories')
        setError(
          problem.code === 'activity_assignment_required'
            ? strings.assignmentRequired
            : problem.code === 'pta_required'
              ? ptaStrings.required
              : problem.message,
        )
    },
    onSuccess: async (_result, variables) => {
      await client.invalidateQueries({ queryKey: ['audit-history'] })
      setError('')
      await Promise.all([
        client.invalidateQueries({ queryKey: ['planning', user.id] }),
        client.invalidateQueries({ queryKey: ['execution', user.id] }),
        client.invalidateQueries({ queryKey: ['notifications', user.id] }),
        ...(workflowActivityId(variables.path)
          ? [client.invalidateQueries({ queryKey: ['access'] })]
          : []),
      ])
      if (!variables.silentSuccess)
        toast.success(planningSuccessMessage(variables))
    },
  })
  const annualExport = useMutation({
    retry: false,
    networkMode: 'always',
    meta: { localError: true },
    mutationFn: async ({ ptaId, format }) => {
      const generation = authGeneration.current
      const controller = new AbortController()
      exportController.current = controller
      const { blob, filename } = await api.download(
        `/api/v1/ptas/${ptaId}/exports`,
        {
          method: 'POST',
          csrf: session.csrf,
          body: { format },
          signal: controller.signal,
        },
      )
      if (generation !== authGeneration.current)
        throw new DOMException('Stale authorization', 'AbortError')
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 0)
    },
    onError: (problem) => {
      if (problem.name === 'AbortError') return
      if (problem.status === 401) denyWorkspace()
      setError(
        problem.code === 'activity_assignment_required'
          ? strings.assignmentRequired
          : problem.message,
      )
    },
    onSuccess: async () => {
      setError('')
      await client.invalidateQueries({ queryKey: ['audit-history'] })
      toast.success(strings.ptaExported)
    },
  })
  const partners = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['partners', search.partnerCursor],
      cursorPath('/partners', search.partnerCursor),
      onDenied,
    ),
    enabled: screen === 'partners',
  })
  const projects = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['projects', search.projectCursor],
      cursorPath('/projects', search.projectCursor),
      onDenied,
    ),
    enabled: ['projects', 'pta'].includes(screen),
  })
  const projectId = params.projectId
  const year = Number(params.year)
  const context = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['pta', projectId, year],
      `/projects/${projectId}/ptas/${year}`,
      onDenied,
    ),
    enabled:
      ['pta', 'activityNew'].includes(screen) && Boolean(projectId && year),
  })
  const activity = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['activity', params.activityId],
      `/activities/${params.activityId}`,
      onDenied,
    ),
    enabled: Boolean(params.activityId),
  })
  const historyActive =
    screen === 'activity' &&
    Boolean(params.activityId) &&
    search.tab === 'history'
  const revisions = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['activity-history', params.activityId, search.revisionCursor],
      cursorPath(
        `/activities/${params.activityId}/history`,
        search.revisionCursor,
      ),
      onDenied,
    ),
    enabled: historyActive,
  })
  const reconciliationBlocked = Boolean(
    workflowReconciliation &&
    (activity.data?.id !== workflowReconciliation.activityId ||
      activity.isFetching ||
      activity.isError ||
      activity.dataUpdatedAt <= workflowReconciliation.activityUpdatedAt ||
      (historyActive &&
        (revisions.isFetching ||
          revisions.isError ||
          revisions.dataUpdatedAt <=
            workflowReconciliation.revisionsUpdatedAt))),
  )
  const calendarView = search.view === 'calendar'
  const reviewerState =
    user.role === 'AGENT_VERIFICATEUR'
      ? 'submitted'
      : user.role === 'VALIDATEUR_DEFINITIF'
        ? 'prevalidated'
        : ''
  const reviewMine = Boolean(
    reviewerState && search.review === 'mine' && !search.state,
  )
  const effectiveState = reviewMine ? reviewerState : search.state
  const effectiveAgent = search.agent
  const activityFilters = {
    ...search,
    state: effectiveState,
    review: reviewMine ? 'mine' : '',
    agent: effectiveAgent,
  }
  const displayedActivityFilters = {
    ...search,
    state: search.state || '',
    review: reviewMine ? 'mine' : '',
    agent: search.agent || '',
  }
  const list = useQuery({
    ...planningQuery(
      api,
      user.id,
      [
        'activities',
        context.data?.pta?.id,
        calendarView ? 'calendar' : search.activityCursor,
        search.q,
        effectiveState,
        reviewMine,
        effectiveAgent,
        search.from,
        search.to,
      ],
      `/ptas/${context.data?.pta?.id}/activities?${new URLSearchParams({
        ...(search.activityCursor ? { cursor: search.activityCursor } : {}),
        ...(search.q ? { q: search.q } : {}),
        ...(effectiveState ? { state: effectiveState } : {}),
        ...(reviewMine ? { review: 'mine' } : {}),
        ...(effectiveAgent ? { agent: effectiveAgent } : {}),
        ...(search.from ? { from: search.from } : {}),
        ...(search.to ? { to: search.to } : {}),
      })}`,
      onDenied,
      calendarView
        ? (signal) =>
            readCalendar(api, context.data.pta.id, activityFilters, signal)
        : undefined,
    ),
    enabled: screen === 'pta' && Boolean(context.data?.pta?.id),
  })
  const types = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['task-categories', search.typeCursor],
      cursorPath('/task-categories', search.typeCursor),
      onDenied,
    ),
    enabled:
      screen === 'activityNew' && !authorization(session).can('ptaManagement'),
  })
  const planningQueries =
    screen === 'partners'
      ? [partners]
      : screen === 'projects'
        ? [projects]
        : screen === 'pta'
          ? [projects, context, ...(context.data?.pta?.id ? [list] : [])]
          : screen === 'activityNew'
            ? [types, context]
            : [activity, ...(historyActive ? [revisions] : [])]
  const loading = planningQueries.some(
    (query) => query.isFetching && query.fetchStatus !== 'idle',
  )
  const primaryPending =
    (screen === 'partners' && partners.isPending) ||
    (screen === 'projects' && projects.isPending) ||
    (screen === 'pta' &&
      (projects.isPending ||
        context.isPending ||
        (Boolean(context.data?.pta?.id) && list.isPending))) ||
    (screen === 'activityNew' && context.isPending) ||
    (screen === 'activity' && activity.isPending)
  const submitSimple = async (event, path, field) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const form = event.currentTarget
    await mutation.mutateAsync({
      path,
      body: {
        [field]: data.get(field),
        ...(path === '/partners'
          ? { description: data.get('description') || null }
          : {}),
      },
    })
    form.reset()
  }
  const submitProject = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    return mutation.mutateAsync({
      path: '/projects',
      body: { name: data.get('name'), partner_id: data.get('partner_id') },
    })
  }
  const failedQueries = planningQueries.filter((query) => query.isError)
  const retryFailed = () =>
    void Promise.all(failedQueries.map((query) => query.refetch()))
  const primaryQueries =
    screen === 'partners'
      ? [partners]
      : screen === 'projects'
        ? [projects]
        : screen === 'pta'
          ? [projects, context, ...(context.data?.pta?.id ? [list] : [])]
          : screen === 'activityNew'
            ? [context]
            : [activity, ...(historyActive ? [revisions] : [])]
  if (
    primaryQueries.some(
      (query) =>
        query.isError &&
        (!query.data || [403, 404].includes(query.error?.status)),
    )
  )
    return (
      <RetryableError page onRetry={retryFailed}>
        {strings.unavailablePlanning}
      </RetryableError>
    )
  if (primaryPending) return <PageLoading title={labels[screen]} />
  if (screen === 'activityNew' && authorization(session).can('ptaManagement'))
    return (
      <Navigate
        to={Urls.pta}
        params={{ projectId, year: String(year) }}
        replace
      />
    )

  if (
    screen === 'activityNew' &&
    !context.data?.allowed_actions.includes('create_activity')
  )
    return (
      <p
        role="status"
        className="w-fit max-w-3xl border-l-4 border-l-primary bg-white px-4 py-3 text-sm"
      >
        {ptaStrings.required}
      </p>
    )
  return (
    <section
      data-ui="planning-stack"
      className="grid gap-6"
      aria-busy={loading}
    >
      <Helmet>
        <title>{`${labels[screen]} - MJL`}</title>
      </Helmet>
      {failedQueries.length > 0 && (
        <RetryableError onRetry={retryFailed}>
          {strings.unavailablePlanning}
        </RetryableError>
      )}
      {error && (
        <p role="alert" className="border-l-4 border-l-danger p-3 bg-white">
          {error}
        </p>
      )}
      {screen === 'partners' && (
        <>
          <ReferenceList
            title={strings.partners}
            result={partners.data}
            label="name"
            cursorKey="partnerCursor"
            navigate={navigate}
            onEdit={(row, values, expected) =>
              mutation.mutateAsync({
                path: `/partners/${row.id}`,
                method: 'PATCH',
                body: {
                  ...values,
                  expected,
                },
              })
            }
            onSubmit={
              user.role === 'VALIDATEUR_DEFINITIF'
                ? (e) => submitSimple(e, '/partners', 'name')
                : null
            }
          />
        </>
      )}
      {screen === 'projects' && (
        <Projects
          result={projects.data}
          canCreate={user.role === 'VALIDATEUR_DEFINITIF'}
          onSubmit={submitProject}
          navigate={navigate}
          onEdit={(row, name, expectedVersion) =>
            mutation.mutateAsync({
              path: `/projects/${row.id}`,
              method: 'PATCH',
              body: {
                action: 'edit',
                name,
                expected_version: expectedVersion,
              },
            })
          }
          onClose={(row) =>
            mutation.mutateAsync({
              path: `/projects/${row.id}`,
              method: 'PATCH',
              body: { expected_version: row.version, action: 'close' },
            })
          }
        />
      )}
      {screen === 'pta' && (
        <PTA
          activityFilters={displayedActivityFilters}
          reviewLabel={
            reviewMine
              ? user.role === 'AGENT_VERIFICATEUR'
                ? strings.awaitingPrevalidation
                : strings.awaitingFinalValidation
              : ''
          }
          onDenied={denyWorkspace}
          projects={projects}
          context={context.data}
          result={list.data}
          navigate={navigate}
          exportPending={annualExport.isPending}
          onExport={(format) =>
            annualExport.mutate({ ptaId: context.data?.pta?.id, format })
          }
        />
      )}
      {screen === 'activityNew' && (
        <div className="grid gap-6 [&:has(.activity-task-editor)>header]:hidden [&:has(.activity-task-editor)>nav]:hidden">
          <Breadcrumbs
            label={strings.breadcrumb}
            items={[
              { label: strings.planningIndex, to: Urls.planning },
              {
                label: `PTA ${year}`,
                to: Urls.pta,
                params: { projectId, year: String(year) },
              },
              { label: strings.newActivity },
            ]}
          />
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-navy">
                {strings.addActivityToPta}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {context.data?.project.name} · PTA {year}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to={Urls.pta} params={{ projectId, year: String(year) }}>
                {strings.cancel}
              </Link>
            </Button>
          </header>
          <ActivityForm
            year={context.data?.year}
            projectId={projectId}
            onCreateType={(body) =>
              mutation.mutateAsync({
                path: '/task-categories',
                body,
                silentSuccess: true,
              })
            }
            types={types.data?.data || []}
            typeResult={types.data}
            navigate={navigate}
            pending={mutation.isPending}
            optionsUnavailable={
              types.isFetching || !types.data || types.isError
            }
            onSubmit={async (body, intent, file) => {
              const row = await mutation.mutateAsync({
                path: `/projects/${projectId}/ptas/${year}/activities`,
                body,
                silentSuccess: intent === 'submit',
              })
              if (file) {
                try {
                  await api.request(`/api/v1/activities/${row.id}/documents`, {
                    method: 'POST',
                    csrf: session.csrf,
                    rawBody: file,
                    headers: {
                      'Content-Type': file.type,
                      'X-File-Name': file.name,
                    },
                  })
                } catch {
                  toast.error(strings.draftSavedUploadFailed)
                  await navigate({
                    to: Urls.activity,
                    params: { activityId: row.id },
                  })
                  return
                }
              }
              if (intent === 'submit') {
                try {
                  await mutation.mutateAsync({
                    path: `/activities/${row.id}/submissions`,
                    body: { expected_version: row.version },
                  })
                } finally {
                  await navigate({
                    to: Urls.activity,
                    params: { activityId: row.id },
                  })
                }
                return
              }
              await navigate({
                to: Urls.activity,
                params: { activityId: row.id },
              })
            }}
          />
        </div>
      )}
      {screen === 'activity' && !activity.data && (
        <LoadingPlaceholder
          label={strings.formatString(common.pageLoading, {
            page: strings.activityDetail,
          })}
          variant="detail"
        />
      )}
      {screen === 'activity' && activity.data && (
        <ActivityDetail
          item={activity.data}
          user={user}
          csrf={session.csrf}
          documentCursor={search.documentCursor}
          navigate={navigate}
          mutation={mutation}
          mutationBlocked={mutation.isPending || reconciliationBlocked}
          revisions={revisions.data}
          historyLoading={historyActive && revisions.isFetching}
          historyFailed={historyActive && revisions.isError && !revisions.data}
          onDenied={denyWorkspace}
        />
      )}
    </section>
  )
}

const PartnerEditAction = ({ partner, onEdit, focusFallback }) => {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const opener = useRef(null)
  const openRef = useRef(false)
  const expected = useRef(null)
  const close = () => {
    setOpen(false)
    setError('')
  }

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(
    () => () => {
      if (openRef.current) focusFallback.current?.focus()
    },
    [focusFallback],
  )

  return (
    <>
      <Button
        ref={opener}
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          expected.current = {
            name: partner.name,
            description: partner.description,
          }
          setError('')
          setOpen(true)
        }}
      >
        {strings.modify}
      </Button>
      {open && (
        <Modal
          open
          onClose={close}
          label={strings.modifyPartner}
          opener={opener}
        >
          <BusinessForm
            onSubmit={async (event) => {
              const data = new FormData(event.currentTarget)
              try {
                await onEdit(
                  partner,
                  {
                    name: data.get('name'),
                    description: data.get('description') || null,
                  },
                  expected.current,
                )
                close()
              } catch (problem) {
                setError(problem.message)
              }
            }}
          >
            {error && <p role="alert">{error}</p>}
            <label>
              {strings.name} *
              <input
                name="name"
                required
                maxLength="200"
                defaultValue={partner.name}
              />
            </label>
            <label>
              {strings.description}
              <textarea
                name="description"
                maxLength={4000}
                defaultValue={partner.description || ''}
              />
            </label>
            <div data-ui="modal-actions">
              <Button type="button" variant="outline" onClick={close}>
                {strings.cancel}
              </Button>
              <Button type="submit">{strings.save}</Button>
            </div>
          </BusinessForm>
        </Modal>
      )}
    </>
  )
}

function ReferenceList({
  title,
  result,
  label,
  inputLabel = strings.name,
  onEdit,
  onSubmit,
  cursorKey,
  navigate,
}) {
  const [creating, setCreating] = useState(false)
  const opener = useRef(null)
  const focusFallback = useRef(null)
  const rows = result?.data || []
  return (
    <Panel as="div" className="border-0 bg-transparent p-0 gap-6">
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        {title === strings.partners ? (
          <h1
            ref={focusFallback}
            tabIndex={-1}
            className="rounded-control text-2xl font-semibold text-navy focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {title}
          </h1>
        ) : (
          <h2>{title}</h2>
        )}
        {onSubmit && (
          <Button ref={opener} type="button" onClick={() => setCreating(true)}>
            {title === strings.partners ? strings.createPartner : strings.add}
          </Button>
        )}
      </div>
      {onSubmit && (
        <Modal
          open={creating}
          onClose={() => setCreating(false)}
          label={
            title === strings.partners
              ? strings.createPartner
              : strings.formatString(strings.addTo, title)
          }
          opener={opener}
        >
          <BusinessForm
            key={String(creating)}
            onSubmit={async (event) => {
              await onSubmit(event)
              setCreating(false)
            }}
          >
            <label>
              {inputLabel} *
              <input name={label} required maxLength="200" />
            </label>
            {title === strings.partners && (
              <label>
                {strings.description}
                <textarea name="description" maxLength={4000} />
              </label>
            )}
            <div data-ui="modal-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreating(false)}
              >
                {strings.cancel}
              </Button>
              <Button type="submit">{strings.save}</Button>
            </div>
          </BusinessForm>
        </Modal>
      )}
      {!result ? (
        <LoadingPlaceholder
          label={strings.formatString(common.pageLoading, { page: title })}
        />
      ) : rows.length ? (
        <div className="overflow-x-auto rounded-card border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="px-3 py-3 font-medium">{title}</th>
                {title === strings.partners && (
                  <>
                    <th className="px-3 py-3 font-medium">
                      {strings.projects}
                    </th>
                    <th className="px-3 py-3 font-medium">{strings.state}</th>
                    <th className="px-3 py-3 font-medium">{strings.actions}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-4">
                    <span className="font-medium">{row[label]}</span>
                    {row.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.description}
                      </p>
                    )}
                  </td>
                  {title === strings.partners && (
                    <>
                      <td className="px-3 py-4">{row.project_count ?? '—'}</td>
                      <td className="px-3 py-4">
                        <StatusBadge className="bg-selected text-primary">
                          {row.active
                            ? strings.activeProject
                            : strings.closedProject}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-4">
                        {row.allowed_actions?.includes('edit') && (
                          <PartnerEditAction
                            partner={row}
                            onEdit={onEdit}
                            focusFallback={focusFallback}
                          />
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : title === strings.partners ? (
        <EmptyTable
          kind="partners"
          columns={['partner', 'projectsColumn', 'state', 'actionsColumn']}
        />
      ) : (
        <EmptyContent kind="operationTypes" />
      )}
      <Pager result={result} cursorKey={cursorKey} navigate={navigate} />
    </Panel>
  )
}

const ProjectClosureAction = ({ project, onCloseProject, focusFallback }) => {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const opener = useRef(null)
  const openRef = useRef(false)
  const close = () => {
    setOpen(false)
    setError('')
  }

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(
    () => () => {
      if (openRef.current) focusFallback.current?.focus()
    },
    [focusFallback],
  )

  return (
    <>
      <Button
        ref={opener}
        variant="outline"
        onClick={() => {
          setError('')
          setOpen(true)
        }}
      >
        {strings.close}
      </Button>
      {open && (
        <Modal
          open
          onClose={close}
          label={strings.closeProjectTitle}
          opener={opener}
        >
          <BusinessForm
            onSubmit={async () => {
              setError('')
              try {
                await onCloseProject(project)
                close()
              } catch (problem) {
                setError(problem.message || strings.unavailablePlanning)
                throw problem
              }
            }}
          >
            {error && (
              <p role="alert" className="border-l-4 border-l-danger p-3">
                {error}
              </p>
            )}
            <p>
              {strings.formatString(strings.closeProjectPrompt, project.name)}
            </p>
            <div data-ui="modal-actions">
              <Button type="button" variant="outline" onClick={close}>
                {strings.cancel}
              </Button>
              <Button type="submit">{strings.close}</Button>
            </div>
          </BusinessForm>
        </Modal>
      )}
    </>
  )
}

const DocumentWithdrawalModal = ({
  document,
  activityId,
  user,
  blocked,
  pending,
  onDenied,
  onWithdraw,
  onClose,
  onCompleted,
  opener,
}) => {
  const { api } = useAPI()
  const [replacementCursor, setReplacementCursor] = useState('')
  const [error, setError] = useState('')
  const active = useRef(true)
  const replacementDocuments = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['documents', activityId, 'replacement-candidates', replacementCursor],
      `/activities/${activityId}/documents?limit=60${
        replacementCursor
          ? `&cursor=${encodeURIComponent(replacementCursor)}`
          : ''
      }`,
      onDenied,
    ),
  })

  useEffect(
    () => () => {
      active.current = false
    },
    [],
  )

  return (
    <Modal
      open
      onClose={onClose}
      label={strings.withdrawAttachment}
      opener={opener}
    >
      <BusinessForm
        onSubmit={async (event) => {
          const values = new FormData(event.currentTarget)
          setError('')
          try {
            await onWithdraw({
              documentId: document.id,
              reason: values.get('reason'),
              replacementDocumentId: values.get('replacement_document_id'),
            })
            if (active.current) onCompleted()
          } catch (problem) {
            if (active.current)
              setError(problem.message || strings.unavailablePlanning)
            throw problem
          }
        }}
      >
        {error && (
          <p role="alert" className="border-l-4 border-l-danger p-3">
            {error}
          </p>
        )}
        <h3>
          {strings.withdrawAttachment} — {document.name}
        </h3>
        <label>
          {strings.attachmentWithdrawalReason} *
          <textarea name="reason" required maxLength="4000" autoFocus />
        </label>
        <label>
          {strings.replacementAttachment}
          <Select name="replacement_document_id" defaultValue="">
            <option value="">{strings.noReplacementAttachment}</option>
            {(replacementDocuments.data?.data || [])
              .filter(
                (candidate) =>
                  candidate.id !== document.id &&
                  !candidate.withdrawal &&
                  candidate.uploaded_at > document.uploaded_at,
              )
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
          </Select>
        </label>
        <Pagination
          label="Pages des pièces corrigées"
          className="justify-end gap-3"
          canPrevious={Boolean(replacementDocuments.data?.previous)}
          canNext={Boolean(replacementDocuments.data?.next)}
          onPrevious={() =>
            setReplacementCursor(
              cursorFrom(replacementDocuments.data?.previous),
            )
          }
          onNext={() =>
            setReplacementCursor(cursorFrom(replacementDocuments.data?.next))
          }
        />
        <div data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={() => onClose()}>
            {strings.cancel}
          </Button>
          <Button disabled={blocked || pending} type="submit">
            {strings.remove}
          </Button>
        </div>
      </BusinessForm>
    </Modal>
  )
}

const DocumentWithdrawalAction = ({
  document,
  activityId,
  user,
  blocked,
  pending,
  onDenied,
  onWithdraw,
  focusFallback,
}) => {
  const [open, setOpen] = useState(false)
  const opener = useRef(null)
  const openRef = useRef(false)
  const close = (restoreFallback = false) => {
    setOpen(false)
    if (restoreFallback) {
      const target = focusFallback.current
      setTimeout(() => {
        if (!opener.current?.isConnected && target?.isConnected) target.focus()
      }, 0)
    }
  }

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(
    () => () => {
      if (openRef.current) {
        const target = focusFallback.current
        setTimeout(() => {
          if (target?.isConnected) target.focus()
        }, 0)
      }
    },
    [focusFallback],
  )

  return (
    <>
      <Button
        ref={opener}
        variant="outline"
        size="sm"
        disabled={blocked || pending}
        onClick={() => setOpen(true)}
      >
        {strings.withdrawAttachment}
      </Button>
      {open && (
        <DocumentWithdrawalModal
          document={document}
          activityId={activityId}
          user={user}
          blocked={blocked}
          pending={pending}
          onDenied={onDenied}
          onWithdraw={onWithdraw}
          onClose={() => close()}
          onCompleted={() => close(true)}
          opener={opener}
        />
      )}
    </>
  )
}

const ProjectEditAction = ({
  project,
  partners,
  partnerResult,
  navigate,
  onEdit,
  focusFallback,
}) => {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const opener = useRef(null)
  const openRef = useRef(false)
  const expectedVersion = useRef(null)
  const close = () => {
    setOpen(false)
    setError('')
  }

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(
    () => () => {
      if (openRef.current) focusFallback.current?.focus()
    },
    [focusFallback],
  )

  return (
    <>
      <Button
        ref={opener}
        variant="outline"
        size="sm"
        onClick={() => {
          expectedVersion.current = project.version
          setError('')
          setOpen(true)
        }}
      >
        {strings.modify}
      </Button>
      {open && (
        <Modal
          open
          onClose={close}
          label={strings.modifyProject}
          opener={opener}
        >
          <BusinessForm
            onSubmit={async (event) => {
              try {
                await onEdit(
                  project,
                  new FormData(event.currentTarget).get('name'),
                  expectedVersion.current,
                )
                close()
              } catch (problem) {
                setError(problem.message)
              }
            }}
          >
            {error && <p role="alert">{error}</p>}
            <label>
              {strings.name} *
              <input
                name="name"
                required
                maxLength="200"
                defaultValue={project.name}
              />
            </label>
            <label>
              {strings.partner} *
              <Select
                name="partner_id"
                required
                defaultValue={project.partner_id}
                disabled
              >
                {partners.map((partner) => (
                  <option value={partner.id} key={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </Select>
            </label>
            <Pager
              result={partnerResult}
              cursorKey="partnerCursor"
              navigate={navigate}
            />
            <div data-ui="modal-actions">
              <Button type="button" variant="outline" onClick={close}>
                {strings.cancel}
              </Button>
              <Button type="submit">{strings.save}</Button>
            </div>
          </BusinessForm>
        </Modal>
      )}
    </>
  )
}

function Projects({ result, canCreate, onSubmit, onEdit, onClose, navigate }) {
  const [creating, setCreating] = useState(false)
  const focusFallback = useRef(null)
  const { api } = useAPI()
  const session = useSessionQuery()
  const search = useSearch({ strict: false })
  const partnerChoices = useQuery({
    ...planningQuery(
      api,
      session.data.user.id,
      ['partners', search.partnerCursor],
      cursorPath('/partners', search.partnerCursor),
      () => {},
    ),
    enabled: canCreate,
  })
  const partnerResult = partnerChoices.data
  const partners = partnerResult?.data || []
  const opener = useRef(null)
  const rows = result?.data || []
  return (
    <Panel as="div" className="border-0 bg-transparent p-0 gap-6">
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <h1
          ref={focusFallback}
          tabIndex={-1}
          className="rounded-control text-2xl font-semibold text-navy focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          {strings.projects}
        </h1>
        {canCreate && (
          <Button
            ref={opener}
            type="button"
            disabled={!partners.length}
            onClick={() => setCreating(true)}
          >
            {strings.createProject}
          </Button>
        )}
      </div>
      {canCreate && partnerChoices.isError && !creating && (
        <RetryableError onRetry={() => void partnerChoices.refetch()}>
          {strings.unavailablePlanning}
        </RetryableError>
      )}
      {canCreate && (
        <Modal
          open={creating}
          onClose={() => setCreating(false)}
          label={strings.createProject}
          opener={opener}
        >
          <BusinessForm
            key={String(creating)}
            onSubmit={async (event) => {
              await onSubmit(event)
              setCreating(false)
            }}
          >
            {partnerChoices.isError && (
              <RetryableError onRetry={() => void partnerChoices.refetch()}>
                {strings.unavailablePlanning}
              </RetryableError>
            )}
            <label>
              {strings.name} *
              <input name="name" required maxLength="200" />
            </label>
            <label>
              {strings.partner} *
              <Select name="partner_id" required disabled={!partnerResult}>
                {!partnerResult && (
                  <option value="" disabled>
                    {common.loading}
                  </option>
                )}
                {partners.map((p) => (
                  <option value={p.id} key={p.id} disabled={p.active === false}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            <Pager
              result={partnerResult}
              cursorKey="partnerCursor"
              navigate={navigate}
            />
            <div data-ui="modal-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreating(false)}
              >
                {strings.cancel}
              </Button>
              <Button
                type="submit"
                disabled={!partners.some((partner) => partner.active !== false)}
              >
                {strings.save}
              </Button>
            </div>
          </BusinessForm>
        </Modal>
      )}
      {!result ? (
        <LoadingPlaceholder
          label={strings.formatString(common.pageLoading, {
            page: strings.projects,
          })}
        />
      ) : rows.length ? (
        <div className="overflow-x-auto rounded-panel border border-border bg-white">
          <table className="w-full text-left text-sm" data-ui="planning-list">
            <thead className="border-b border-border bg-background text-muted-foreground">
              <tr>
                <th className="p-4 font-medium">{strings.projects}</th>
                <th className="p-4 font-medium">{strings.partner}</th>
                <th className="p-4 font-medium">{strings.state}</th>
                <th className="p-4 font-medium">{strings.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="p-4">
                    <strong className="block font-medium text-navy">
                      {row.name}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {row.reference}
                    </span>
                  </td>
                  <td className="p-4">{row.partner_name || '—'}</td>
                  <td className="p-4">
                    <StatusBadge
                      className={
                        row.state === 'active'
                          ? 'bg-selected text-primary'
                          : 'bg-disabled text-muted-foreground'
                      }
                    >
                      {row.state === 'active'
                        ? strings.activeProject
                        : strings.closedProject}
                    </StatusBadge>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {row.allowed_actions.includes('edit') && (
                        <ProjectEditAction
                          project={row}
                          partners={partners}
                          partnerResult={partnerResult}
                          navigate={navigate}
                          onEdit={onEdit}
                          focusFallback={focusFallback}
                        />
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link to={Urls.planning} search={{ project: row.id }}>
                          {strings.viewPtas}
                        </Link>
                      </Button>
                      {row.allowed_actions.includes('close') && (
                        <ProjectClosureAction
                          project={row}
                          onCloseProject={onClose}
                          focusFallback={focusFallback}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyTable
          kind="projects"
          columns={['project', 'partner', 'state', 'actionsColumn']}
        />
      )}
      <Pager result={result} cursorKey="projectCursor" navigate={navigate} />
    </Panel>
  )
}

function PTA({
  activityFilters,
  reviewLabel,
  context,
  result,
  navigate,
  exportPending,
  onExport,
  projects,
  onDenied,
}) {
  const search = useSearch({ strict: false })
  const [editing, setEditing] = useState(false)
  const [creatingBrief, setCreatingBrief] = useState(null)
  const editPtaOpener = useRef(null)
  const briefOpener = useRef(null)
  const reviewer = authorization(useSessionQuery().data).can('ptaManagement')
  if (!context) return <PageLoading title={strings.annualPlan} />
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to={Urls.planning} className="text-xs text-muted-foreground">
            {ptaStrings.breadcrumb}
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-navy">
            {context.project.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            PTA {context.year}
            {context.pta?.description ? ` · ${context.pta.description}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {context.pta?.allowed_actions?.includes('edit') && (
            <Button
              ref={editPtaOpener}
              variant="outline"
              onClick={(event) => {
                editPtaOpener.current = event.currentTarget
                setEditing(true)
              }}
            >
              {ptaStrings.edit}
            </Button>
          )}
          {context.allowed_actions.includes('create_activity') &&
            (reviewer ? (
              <Button
                ref={briefOpener}
                onClick={(event) => {
                  briefOpener.current = event.currentTarget
                  setCreatingBrief({ open: true })
                }}
              >
                {strings.addActivityToPta}
              </Button>
            ) : (
              <Button asChild>
                <Link
                  to={Urls.newActivity}
                  params={{
                    projectId: context.project.id,
                    year: String(context.year),
                  }}
                >
                  {strings.addActivityToPta}
                </Link>
              </Button>
            ))}
        </div>
        {editing && (
          <PTAModal
            opener={editPtaOpener}
            onDenied={onDenied}
            pta={context.pta}
            project={context.project}
            onClose={() => {
              setEditing(false)
              setTimeout(() => editPtaOpener.current?.focus(), 0)
            }}
            onSaved={() => {
              setEditing(false)
              setTimeout(() => editPtaOpener.current?.focus(), 0)
            }}
          />
        )}
        {creatingBrief && (
          <ActivityBriefModal
            context={context}
            open={creatingBrief.open}
            opener={briefOpener}
            onClose={(retain) => {
              setCreatingBrief(retain ? { open: false } : null)
              setTimeout(() => briefOpener.current?.focus(), 0)
            }}
            onSaved={() => setCreatingBrief(null)}
            onDenied={onDenied}
          />
        )}
      </header>
      <Panel className="flex flex-wrap items-end gap-4 border-0 bg-transparent p-0">
        <label className="w-full max-w-120">
          {strings.project}
          <Select
            value={context.project.id}
            onChange={(event) =>
              navigate({
                to: Urls.pta,
                params: {
                  projectId: event.target.value,
                  year: String(context.year),
                },
              })
            }
          >
            {!projects.data?.data.some(
              (row) => row.id === context.project.id,
            ) && (
              <option value={context.project.id}>{context.project.name}</option>
            )}
            {projects.data?.data.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="max-w-40">
          {strings.year}
          <Select
            value={String(context.year)}
            onChange={(event) =>
              navigate({
                to: Urls.pta,
                params: {
                  projectId: context.project.id,
                  year: event.target.value,
                },
              })
            }
          >
            {Array.from({ length: 201 }, (_, i) => 2000 + i).map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </Select>
        </label>
        <p className="pb-2 text-[0.8125rem] text-primary">
          {context.project.partner_name}
        </p>
        <Pager
          result={projects.data}
          cursorKey="projectCursor"
          navigate={navigate}
        />
        {projects.isError && (
          <RetryableError onRetry={() => projects.refetch()}>
            {strings.unavailablePlanning}
          </RetryableError>
        )}
      </Panel>
      {!context.pta && (
        <p
          role="status"
          className="w-fit max-w-3xl border-l-4 border-l-primary bg-white px-4 py-3 text-sm"
        >
          {ptaStrings.required}
        </p>
      )}
      <PlanningSummary summary={context.summary} />
      {context.pta && !result ? (
        <PageLoading
          title={strings.annualPlan}
          className="min-h-45 rounded-panel border border-border bg-white"
        />
      ) : (
        <PlanningActivities
          result={result}
          year={context.year}
          ptaId={context.pta?.id}
          month={search.month}
          filters={activityFilters}
          reviewLabel={reviewLabel}
          onFilter={(values) =>
            navigate({
              search: (current) => ({
                ...current,
                ...values,
                activityCursor: '',
              }),
            })
          }
          view={search.view || 'table'}
          onView={(view) =>
            navigate({ search: (current) => ({ ...current, view }) })
          }
          onMonth={(month) =>
            navigate({ search: (current) => ({ ...current, month }) })
          }
        />
      )}
      {search.view !== 'calendar' && (
        <Pager result={result} cursorKey="activityCursor" navigate={navigate} />
      )}
      {context.pta && (
        <div className="flex flex-wrap gap-2">
          {['csv', 'xlsx', 'pdf'].map((format) => (
            <Button
              key={format}
              variant="outline"
              size="sm"
              disabled={exportPending}
              onClick={() => onExport(format)}
            >
              {
                strings[
                  {
                    csv: 'exportPtaCsv',
                    xlsx: 'exportPtaExcel',
                    pdf: 'exportPtaPdf',
                  }[format]
                ]
              }
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

function Pager({ result, cursorKey, navigate }) {
  const move = (link) =>
    navigate({
      search: (current) => ({ ...current, [cursorKey]: cursorFrom(link) }),
    })
  return (
    <Pagination
      label="Pagination"
      canPrevious={Boolean(result?.previous)}
      canNext={Boolean(result?.next)}
      onPrevious={() => move(result.previous)}
      onNext={() => move(result.next)}
    />
  )
}

function TaskHierarchy({ tasks }) {
  return (
    <CompactAllocationTable
      rows={tasks || []}
      nameHeader={strings.operation}
      amountHeader={strings.compactPlannedAmount}
      weightHeader={strings.weight}
      datesToComplete={strings.datesToComplete}
      categoryFor={(task) => task.type_label}
    />
  )
}

function PlanningVersion({ title, value }) {
  return (
    <section
      className="p-4 border border-border rounded-panel bg-white"
      aria-label={title}
    >
      <h3>{title}</h3>
      <p>
        <strong>{value.name}</strong>
      </p>
      <p>{value.description}</p>
      <dl className="flex gap-8 flex-wrap [&_dt]:text-muted-foreground [&_dt]:text-[0.8125rem]">
        <div>
          <dt>{strings.period}</dt>
          <dd>
            {value.planned_start && value.planned_end
              ? `${formatDate(value.planned_start)} au ${formatDate(value.planned_end)}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>{strings.budget}</dt>
          <dd>{formatXof(value.allocation)}</dd>
        </div>
      </dl>
      <TaskHierarchy tasks={value.tasks} />
    </section>
  )
}

function agentInitials(agent) {
  const source = agent?.full_name || agent?.email || ''
  const words = source.trim().split(/\s+/).filter(Boolean)
  return (
    words.length > 1
      ? words.map((word) => word[0]).join('')
      : source.slice(0, 2)
  )
    .slice(0, 2)
    .toUpperCase()
}

function AssignmentModal({
  open,
  item,
  user,
  blocked,
  draft,
  setDraft,
  opener,
  onClose,
  onDenied,
  onSave,
}) {
  const { api } = useAPI()
  const [query, setQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [cursor, setCursor] = useState('')
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(query)
      setCursor('')
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [query])
  const choices = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['assignment-agents', searchQuery, cursor],
      `/assignment-agents?${new URLSearchParams({
        ...(searchQuery ? { q: searchQuery } : {}),
        ...(cursor ? { cursor } : {}),
      })}`,
      onDenied,
    ),
    enabled: open,
  })
  const initialIds = item.agent_ids || []
  const selectedAgents = draft?.agents ?? item.agents ?? []
  const selectedIds = selectedAgents.map((agent) => agent.id)
  const availableChoices = (choices.data?.data || []).filter(
    (agent) => !selectedIds.includes(agent.id),
  )
  const knownAgents = new Map(
    [
      ...selectedAgents,
      ...(item.agents || []),
      ...(choices.data?.data || []),
    ].map((agent) => [agent.id, agent]),
  )
  const changed =
    selectedIds.length !== initialIds.length ||
    selectedIds.some((id) => !initialIds.includes(id))
  const added = selectedIds.filter((id) => !initialIds.includes(id))
  const removed = initialIds.filter((id) => !selectedIds.includes(id))
  const label = (id) => {
    const agent = knownAgents.get(id)
    return agent?.full_name || agent?.email || id
  }
  const update = (agent, checked) =>
    setDraft({
      version: draft?.version ?? item.version,
      agents: checked
        ? [...selectedAgents, agent].filter(
            (candidate, index, all) =>
              all.findIndex((row) => row.id === candidate.id) === index,
          )
        : selectedAgents.filter((value) => value.id !== agent.id),
    })
  return (
    <Modal
      open={open}
      onClose={onClose}
      label={strings.activityOwners}
      opener={opener}
    >
      <BusinessForm
        dirty={changed}
        className="grid gap-5 p-6"
        onSubmit={(event) => {
          event.preventDefault()
          return onSave(selectedIds, draft?.version ?? item.version)
        }}
      >
        <p className="font-medium">{item.name}</p>
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">{strings.currentOwners}</h3>
          <ul className="grid gap-2 p-0 list-none">
            {selectedIds.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between gap-3 py-1"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-selected text-xs font-semibold text-primary">
                    {agentInitials(knownAgents.get(id))}
                  </span>
                  <span className="min-w-0 truncate">{label(id)}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="size-8 min-h-8 shrink-0 p-0"
                  disabled={blocked}
                  onClick={() => update(knownAgents.get(id), false)}
                  aria-label={`${strings.remove} ${label(id)}`}
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">{strings.addOwner}</h3>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {strings.searchOwner}
          </Button>
          {expanded && (
            <AgentSearchPanel
              title={strings.assignedAgent}
              searchLabel={strings.searchOwner}
              value={query}
              onChange={setQuery}
              onClose={() => setExpanded(false)}
              className="w-full"
              footer={
                <>
                  {choices.isPending && (
                    <div
                      className="grid min-h-24 place-items-center rounded-panel border border-border bg-white"
                      role="status"
                      aria-label={strings.coordinatedAgents}
                      aria-busy="true"
                    >
                      <LoaderCircle
                        className="size-5 animate-spin text-primary"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  {choices.isError && (
                    <RetryableError onRetry={() => void choices.refetch()}>
                      {strings.unavailablePlanning}
                    </RetryableError>
                  )}
                  {!choices.isPending &&
                    !choices.isError &&
                    !availableChoices.length && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        {strings.noOwnerMatch}
                      </p>
                    )}
                  <Pagination
                    label="Pagination"
                    canPrevious={Boolean(choices.data?.previous)}
                    canNext={Boolean(choices.data?.next)}
                    onPrevious={() =>
                      setCursor(cursorFrom(choices.data.previous))
                    }
                    onNext={() => setCursor(cursorFrom(choices.data.next))}
                  />
                </>
              }
              listProps={{ 'aria-label': strings.coordinatedAgents }}
            >
              {availableChoices.map((agent) => (
                <Button
                  key={agent.id}
                  type="button"
                  variant="ghost"
                  role="option"
                  aria-selected="false"
                  className="h-auto justify-start px-2 py-2 text-left font-normal"
                  disabled={blocked}
                  onClick={() => update(agent, true)}
                >
                  <span>
                    <strong className="block">
                      {agent.full_name || agent.email}
                    </strong>
                    {agent.full_name && (
                      <span className="text-sm text-muted-foreground">
                        {agent.email}
                      </span>
                    )}
                  </span>
                </Button>
              ))}
            </AgentSearchPanel>
          )}
        </section>
        <section
          className="grid gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          {!added.length && !removed.length ? (
            <p>{strings.assignmentUnchanged}</p>
          ) : (
            <>
              <h3 className="font-semibold text-foreground">
                {strings.assignmentPreview}
              </h3>
              {!!added.length && (
                <p>
                  {strings.assignmentAdded} : {added.map(label).join(', ')}
                </p>
              )}
              {!!removed.length && (
                <>
                  <p>
                    {strings.assignmentRemoved} :{' '}
                    {removed.map(label).join(', ')}
                  </p>
                  <p>{strings.assignmentRemovalEffect}</p>
                </>
              )}
            </>
          )}
        </section>
        <p className="text-sm text-muted-foreground">
          {strings.ownerRequirement}
        </p>
        {!selectedIds.length && (
          <p className="text-danger" role="alert">
            {strings.assignmentNonempty}
          </p>
        )}
        <div data-ui="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {strings.cancel}
          </Button>
          <Button
            type="submit"
            disabled={
              blocked || !changed || !selectedIds.length || choices.isError
            }
          >
            {strings.saveAgents}
          </Button>
        </div>
      </BusinessForm>
    </Modal>
  )
}

function ActivityDetail({
  item,
  user,
  csrf,
  documentCursor,
  navigate,
  mutation,
  mutationBlocked,
  revisions,
  historyLoading,
  historyFailed,
  onDenied,
}) {
  const [editing, setEditing] = useState(false)
  const [workflowAction, setWorkflowAction] = useState('')
  const [transferTargetYear, setTransferTargetYear] = useState(
    item.transfer?.target_year || '',
  )
  const [transferStart, setTransferStart] = useState('')
  const [transferEnd, setTransferEnd] = useState('')
  const [transferTasks, setTransferTasks] = useState([])
  const [requestedAmount, setRequestedAmount] = useState('')
  const workflowOpener = useRef(null)
  const assignmentOpener = useRef(null)
  const [assignmentDraft, setAssignmentDraft] = useState(null)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const closeAssignment = () => {
    setAssignmentDraft(null)
    setAssignmentOpen(false)
    setTimeout(() => assignmentOpener.current?.focus(), 0)
  }
  const canAssign =
    ['AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'].includes(user.role) &&
    item.allowed_actions.includes('assign_agents')
  const { api } = useAPI()
  const search = useSearch({ strict: false })
  const executionSummary = useQuery({
    queryKey: ['execution', user.id, 'activity', item.id],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(`/api/v1/activities/${item.id}/execution`, {
          signal,
        })
      } catch (error) {
        if (error.status === 401) onDenied()
        throw error
      }
    },
    enabled: Boolean(item.approved_revision_id),
    retry: false,
  })
  const typeChoices = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['task-categories', search.typeCursor],
      cursorPath('/task-categories', search.typeCursor),
      onDenied,
    ),
    enabled: editing,
  })
  const types = typeChoices.data?.data || []
  const typeResult = typeChoices.data
  const closeDecision = () => {
    setTransferStart('')
    setTransferEnd('')
    setTransferTasks([])
    setRequestedAmount('')
    setWorkflowAction('')
  }
  const submitWorkflow = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const submission = workflowAction === 'submit'
    const opening = workflowAction === 'open_amendment'
    const cancellation = workflowAction === 'cancel_amendment'
    const withdrawal = workflowAction === 'request_withdrawal'
    const withdrawalCancellation = workflowAction === 'cancel_withdrawal'
    const transfer = workflowAction === 'request_transfer'
    const transferCancellation = workflowAction === 'cancel_transfer'
    await mutation.mutateAsync({
      path: opening
        ? `/activities/${item.id}/amendments`
        : cancellation
          ? `/activities/${item.id}/amendments/${item.amendment.id}/cancellation`
          : withdrawal
            ? `/activities/${item.id}/withdrawals`
            : withdrawalCancellation
              ? `/activities/${item.id}/withdrawals/${item.withdrawal.id}/cancellation`
              : transfer
                ? `/activities/${item.id}/transfers`
                : transferCancellation
                  ? `/activities/${item.id}/transfers/${item.transfer.id}/cancellation`
                  : submission
                    ? `/activities/${item.id}/submissions`
                    : `/activities/${item.id}/revisions/${item.current_revision_id}/decisions`,
      method: 'POST',
      body:
        opening ||
        cancellation ||
        withdrawal ||
        withdrawalCancellation ||
        transfer ||
        transferCancellation
          ? {
              expected_version: item.version,
              expected_approved_revision_id: item.approved_revision_id,
              reason: data.get('reason'),
              ...(withdrawal && item.withdrawal
                ? {
                    withdrawal_id: item.withdrawal.id,
                    expected_revision_id: item.current_revision_id,
                  }
                : {}),
              ...(withdrawalCancellation
                ? { expected_revision_id: item.current_revision_id }
                : {}),
              ...(transfer
                ? {
                    planned_start: data.get('planned_start'),
                    planned_end: data.get('planned_end'),
                    tasks: transferTasks,
                    ...(item.transfer
                      ? {
                          transfer_id: item.transfer.id,
                          expected_revision_id: item.current_revision_id,
                        }
                      : {}),
                  }
                : {}),
              ...(transferCancellation
                ? { expected_revision_id: item.current_revision_id }
                : {}),
            }
          : submission
            ? { expected_version: item.version }
            : {
                expected_version: item.version,
                decision: workflowAction,
                ...(data.get('reason') ? { reason: data.get('reason') } : {}),
                ...(workflowAction === 'return'
                  ? {
                      ...(data.get('requested_amount')
                        ? { requested_amount: data.get('requested_amount') }
                        : {}),
                    }
                  : {}),
              },
    })
    closeDecision()
  }
  const transferDatesValid = transferTasks.every((task) => {
    if (!task.planned_start && !task.planned_end)
      return task.subtasks.every(
        (child) => !child.planned_start && !child.planned_end,
      )
    if (
      !task.planned_start ||
      !task.planned_end ||
      task.planned_start < transferStart ||
      task.planned_end > transferEnd
    )
      return false
    return task.subtasks.every(
      (child) =>
        (!child.planned_start && !child.planned_end) ||
        (child.planned_start &&
          child.planned_end &&
          child.planned_start >= task.planned_start &&
          child.planned_end <= task.planned_end),
    )
  })
  if (editing)
    return (
      <Panel
        as="div"
        className="gap-6 border-0 bg-transparent p-0 [&:has(.activity-task-editor)>header]:hidden [&:has(.activity-task-editor)>nav]:hidden"
      >
        <Breadcrumbs
          label={strings.breadcrumb}
          items={[
            { label: strings.planningIndex, to: Urls.planning },
            {
              label: item.pta_name,
              to: Urls.pta,
              params: {
                projectId: item.project_id,
                year: String(item.placement_year),
              },
            },
            {
              label: item.reference,
              to: Urls.activity,
              params: { activityId: item.id },
            },
            { label: strings.modify },
          ]}
        />
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-navy">
              {!item.planned_end || item.allocation === null
                ? strings.completeProgramming
                : strings.reviseProgramming}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {item.project_name} · {item.partner_name} · PTA{' '}
              {item.placement_year}
            </p>
          </div>
        </header>
        {typeChoices.isError && (
          <RetryableError onRetry={() => void typeChoices.refetch()}>
            {strings.unavailablePlanning}
          </RetryableError>
        )}
        <ActivityForm
          onCreateType={(body) =>
            mutation.mutateAsync({
              path: '/task-categories',
              body,
              silentSuccess: true,
            })
          }
          types={types}
          typeResult={typeResult}
          navigate={navigate}
          pending={mutationBlocked}
          optionsUnavailable={
            typeChoices.isFetching || !typeResult || typeChoices.isError
          }
          initial={item}
          year={item.placement_year}
          onSubmit={async (body, intent, file) => {
            const saved = await mutation.mutateAsync({
              path: `/activities/${item.id}`,
              method: 'PATCH',
              body,
              silentSuccess: intent === 'submit',
            })
            if (file) {
              try {
                await api.request(`/api/v1/activities/${item.id}/documents`, {
                  method: 'POST',
                  csrf,
                  rawBody: file,
                  headers: {
                    'Content-Type': file.type,
                    'X-File-Name': file.name,
                  },
                })
              } catch {
                toast.error(strings.draftSavedUploadFailed)
                setEditing(false)
                return
              }
            }
            if (intent === 'submit') {
              try {
                await mutation.mutateAsync({
                  path: `/activities/${item.id}/submissions`,
                  body: { expected_version: saved.version },
                })
              } finally {
                setEditing(false)
              }
              return
            }
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </Panel>
    )
  const creatorName =
    item.creator?.full_name || item.creator?.email || strings.unknownActor
  const administrativeReminder = administrativeReminderSchedule(item)
  const programmingProblems =
    item.state === 'draft'
      ? activitySubmissionProblems({
          name: item.name,
          start: item.planned_start,
          end: item.planned_end,
          amount: item.allocation,
          tasks: item.tasks || [],
        })
      : []
  const programmingIncomplete = programmingProblems.length > 0
  const executionContext = search.origin === 'execution'
  const execution = executionSummary.data
  const administrativeSituation = execution?.closure
    ? executionStrings.closedLabel
    : execution?.pause_reason === 'funding_required'
      ? executionStrings.fundingStage
      : execution?.works_completed && execution?.closure_blockers?.length
        ? strings.pendingClosure
        : ''
  const administrativeActions = [
    ['open_amendment', strings.openAmendment],
    ['cancel_amendment', strings.cancelAmendment],
    [
      'request_withdrawal',
      item.withdrawal ? strings.correctWithdrawal : strings.requestWithdrawal,
    ],
    ['cancel_withdrawal', strings.cancelWithdrawal],
    [
      'request_transfer',
      item.transfer ? strings.correctTransfer : strings.requestTransfer,
    ],
    ['cancel_transfer', strings.cancelTransfer],
  ]
  return (
    <div className="grid gap-6">
      <Breadcrumbs
        label={strings.breadcrumb}
        items={
          executionContext
            ? [
                { label: executionStrings.listTitle, to: Urls.execution },
                { label: item.reference },
              ]
            : [
                { label: strings.planningIndex, to: Urls.planning },
                {
                  label: item.pta_name,
                  to: Urls.pta,
                  params: {
                    projectId: item.project_id,
                    year: String(item.placement_year),
                  },
                },
                { label: item.reference },
              ]
        }
      />
      <div
        data-ui="activity-header"
        className="flex flex-wrap items-end justify-between gap-8 [&_form]:flex [&_form]:flex-wrap [&_form]:items-end [&_form]:gap-3"
      >
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{item.reference}</p>
          <h1 className="mt-1 max-w-5xl break-words text-2xl font-semibold leading-8 text-navy">
            {item.name}
          </h1>
          <p className="mb-4 mt-2 break-words text-xs leading-5 text-muted-foreground">
            {item.project_name} · {item.partner_name} · PTA{' '}
            {item.placement_year}
          </p>
          {!item.approved_revision_id && (
            <div>
              <StatusBadge className={activityStatusClass(item.state)}>
                {item.state === 'submitted'
                  ? strings.detailSubmitted
                  : item.state === 'prevalidated'
                    ? strings.detailPrevalidated
                    : strings[item.state] || item.state}
              </StatusBadge>
            </div>
          )}
          {item.approved_revision_id && (
            <dl className="grid grid-cols-[repeat(4,minmax(140px,max-content))] gap-x-8 gap-y-3 text-xs max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {strings.programmingApproval}
                </dt>
                <dd className="mt-1 font-medium">
                  {strings.programmingApproved}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {strings.physicalExecution}
                </dt>
                <dd className="mt-1 font-medium">
                  {physicalExecutionLabel(execution)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {strings.realizationValidation}
                </dt>
                <dd className="mt-1 font-medium">
                  {execution
                    ? executionStrings.realizationValidationStates[
                        execution.realization_status
                      ] || strings.notSubmitted
                    : '—'}
                </dd>
              </div>
              {administrativeSituation && (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {strings.administrativeSituation}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {administrativeSituation}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {item.approved_revision_id && executionSummary.isError && (
            <RetryableError onRetry={() => void executionSummary.refetch()}>
              Le suivi de réalisation est temporairement indisponible.
            </RetryableError>
          )}
          <div className="mt-[1.125rem] grid gap-1 text-[0.8125rem]">
            <span className="text-xs text-muted-foreground">
              {strings.activityOwners}
            </span>
            <span className="flex flex-wrap items-center gap-3">
              <strong className="font-medium">
                {(item.agents || [])
                  .map((agent) => agent.full_name || agent.email)
                  .join(', ') || '—'}
              </strong>
              {canAssign && (
                <Button
                  type="button"
                  variant="activityHeader"
                  onClick={(event) => {
                    assignmentOpener.current = event.currentTarget
                    setAssignmentOpen(true)
                  }}
                >
                  {strings.assignments}
                </Button>
              )}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-[repeat(2,minmax(100px,max-content))] gap-7 text-xs max-[480px]:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                {strings.plannedStart}
              </dt>
              <dd className="mt-1 font-medium">
                {item.planned_start ? formatDate(item.planned_start) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {strings.plannedEnd}
              </dt>
              <dd className="mt-1 font-medium">
                {item.planned_end ? formatDate(item.planned_end) : '—'}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.approved_revision_id && (
            <ProtectedDownload
              path={`/api/v1/activities/${item.id}/fiche.pdf`}
              onDenied={onDenied}
              variant="activityHeader"
            >
              {strings.downloadActivityFiche}
            </ProtectedDownload>
          )}
        </div>
      </div>
      {item.execution_paused && (
        <div className="border-l-4 border-l-danger p-3 bg-white" role="status">
          <strong>
            {item.transfer
              ? strings.transferPending
              : item.withdrawal
                ? strings.withdrawalPending
                : strings.candidateVersion}
          </strong>
          <p>
            {item.transfer
              ? strings.transferPaused
              : item.withdrawal
                ? strings.withdrawalPaused
                : strings.executionPaused}
          </p>
          <p>
            {item.transfer?.reason ||
              item.withdrawal?.reason ||
              item.amendment?.reason}
          </p>
        </div>
      )}
      {item.amendment && item.approved && item.candidate && (
        <div className="grid grid-cols-[repeat(auto-fit,_minmax(min(100%,_18rem),_1fr))] gap-4 my-5">
          <PlanningVersion
            title={strings.approvedVersion}
            value={item.approved}
          />
          <PlanningVersion
            title={strings.candidateVersion}
            value={item.candidate}
          />
        </div>
      )}
      {item.correction && (
        <div className="border-l-4 border-l-danger p-3 bg-white" role="status">
          <strong>{strings.returned}</strong>
          <p>{item.correction.reason}</p>
          {item.correction.requested_amount && (
            <p>
              {strings.requestedAmount}:{' '}
              {formatXof(item.correction.requested_amount)}
            </p>
          )}
        </div>
      )}
      <nav
        aria-label={strings.activitySections}
        className="flex flex-wrap gap-5 border-b border-border text-sm"
      >
        {[['programming', strings.programming]].map(([tab, label]) => (
          <Link
            key={tab}
            to={Urls.activity}
            params={{ activityId: item.id }}
            search={(current) => ({
              ...current,
              tab,
              revision: undefined,
              amendment: undefined,
            })}
            activeOptions={{ exact: true, includeSearch: true }}
            className={`border-b-2 px-1 py-2.5 ${(search.tab || 'programming') === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            {label}
          </Link>
        ))}
        {item.approved_revision_id &&
          [
            ['realization', strings.realizationTab],
            ['finance', strings.financeTab],
          ].map(([tab, label]) => (
            <Link
              key={tab}
              className={`border-b-2 px-1 py-2.5 ${(search.tab || 'programming') === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
              to={Urls.activity}
              params={{ activityId: item.id }}
              search={(current) => ({
                ...current,
                tab,
                revision: undefined,
                amendment: undefined,
              })}
            >
              {label}
            </Link>
          ))}
        {[
          ['history', strings.historyTab],
          ['files', strings.filesTab],
        ].map(([tab, label]) => (
          <Link
            key={tab}
            to={Urls.activity}
            params={{ activityId: item.id }}
            search={(current) => ({
              ...current,
              tab,
              revision: undefined,
              amendment: undefined,
            })}
            activeOptions={{ exact: true, includeSearch: true }}
            className={`border-b-2 px-1 py-2.5 ${(search.tab || 'programming') === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div hidden={search.tab && search.tab !== 'programming'}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <div className="grid gap-6">
            <Panel className="gap-0 overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <h2>{strings.programming}</h2>
                {item.allowed_actions.includes('edit') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={mutationBlocked}
                    onClick={() => setEditing(true)}
                  >
                    {strings.editProgramming}
                  </Button>
                )}
              </div>
              <div className="grid gap-6 p-5">
                <div className="max-w-4xl text-sm leading-6">
                  <p className="text-xs text-muted-foreground">
                    {strings.activityPurpose}
                  </p>
                  <p className="mt-1">{item.description || '—'}</p>
                </div>
                {programmingIncomplete && (
                  <section
                    role="alert"
                    className="rounded-card border border-warning bg-warning-soft p-4 text-sm text-warning"
                  >
                    <strong>{strings.programmingToComplete}</strong>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {programmingProblems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </Panel>
            {item.tasks?.length > 0 && (
              <Panel className="gap-0 overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <h2>{strings.operations}</h2>
                  {item.allowed_actions.includes('edit') && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={mutationBlocked}
                      onClick={() => setEditing(true)}
                    >
                      {strings.organizeTasks}
                    </Button>
                  )}
                </div>
                <div className="p-5">
                  <TaskHierarchy tasks={item.tasks} />
                </div>
              </Panel>
            )}
          </div>
          <div className="grid gap-6">
            <Panel as="aside" className="gap-0 overflow-hidden p-0">
              <h2 className="border-b border-border px-5 py-4">
                {strings.budgetValidation}
              </h2>
              <dl className="grid gap-6 p-5 text-sm">
                <div>
                  <dt className="text-muted-foreground">
                    {strings.plannedAmountSummary}
                  </dt>
                  <dd className="mt-2 text-base font-semibold">
                    {formatXof(item.allocation)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {strings.currentAuthorizedAmount}
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {item.approved_allocation
                      ? formatXof(item.approved_allocation)
                      : strings.notProvided}
                  </dd>
                </div>
                <div className="border-t border-border pt-5">
                  <dt className="text-muted-foreground">
                    {strings.validation}
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {strings[item.state] || item.state}
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">{strings.requester}</dt>
                  <dd className="text-muted-foreground">
                    {strings.requester} : {creatorName}
                  </dd>
                </div>
              </dl>
              {['return', 'prevalidate', 'approve'].some((action) =>
                item.allowed_actions.includes(action),
              ) && (
                <div className="grid gap-3 border-t border-border p-5">
                  {item.allowed_actions.includes('return') && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={mutationBlocked}
                      onClick={(event) => {
                        workflowOpener.current = event.currentTarget
                        setWorkflowAction('return')
                      }}
                    >
                      {strings.returnCorrection}
                    </Button>
                  )}
                  {[
                    ['prevalidate', strings.prevalidate],
                    ['approve', strings.approve],
                  ].map(([action, label]) =>
                    item.allowed_actions.includes(action) ? (
                      <Button
                        type="button"
                        key={action}
                        disabled={mutationBlocked}
                        onClick={(event) => {
                          workflowOpener.current = event.currentTarget
                          setWorkflowAction(action)
                        }}
                      >
                        {label}
                      </Button>
                    ) : null,
                  )}
                </div>
              )}
              {!executionContext &&
                administrativeActions.some(([action]) =>
                  item.allowed_actions.includes(action),
                ) && (
                  <div className="grid gap-3 border-t border-border p-5">
                    {administrativeActions.map(([action, label]) =>
                      item.allowed_actions.includes(action) ? (
                        <Button
                          type="button"
                          key={action}
                          variant="outline"
                          disabled={mutationBlocked}
                          onClick={(event) => {
                            workflowOpener.current = event.currentTarget
                            setWorkflowAction(action)
                          }}
                        >
                          {label}
                        </Button>
                      ) : null,
                    )}
                  </div>
                )}
            </Panel>
            {administrativeReminder && (
              <Panel as="aside" className="gap-0 overflow-hidden p-0">
                <h2 className="border-b border-border px-5 py-4">
                  {strings.administrativeReminder}
                </h2>
                <div className="grid gap-5 p-5 text-sm">
                  <dl className="grid gap-5">
                    <div>
                      <dt className="text-muted-foreground">
                        {strings.deadline}
                      </dt>
                      <dd className="mt-2 font-semibold">
                        {formatDate(administrativeReminder.plannedEnd)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        {strings.concernedAgents}
                      </dt>
                      <dd className="mt-2 font-medium">
                        {(item.agents || [])
                          .map((agent) => agent.full_name || agent.email)
                          .join(', ') || strings.noAssignedAgent}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-muted-foreground">
                    {strings.formatString(strings.reminderPlanned, {
                      date: formatDate(administrativeReminder.dueOn),
                    })}
                  </p>
                </div>
              </Panel>
            )}
          </div>
        </div>
        {!executionContext &&
          item.allowed_actions.includes('submit') &&
          !programmingIncomplete && (
            <div className="mt-8 flex justify-end">
              <Button
                disabled={mutationBlocked}
                onClick={(event) => {
                  workflowOpener.current = event.currentTarget
                  setWorkflowAction('submit')
                }}
              >
                {strings.submitReview}
              </Button>
            </div>
          )}
      </div>
      {search.tab === 'realization' && (
        <ExecutionView screen="detail" embedded section="realization" />
      )}
      {search.tab === 'finance' && (
        <ExecutionView screen="detail" embedded section="finance" />
      )}
      {search.tab === 'files' && (
        <div>
          <ActivityDocuments
            activityId={item.id}
            assigned={item.agent_ids.includes(user.id)}
            user={user}
            csrf={csrf}
            cursor={documentCursor}
            navigate={navigate}
            blocked={mutationBlocked}
            onDenied={onDenied}
          />
        </div>
      )}
      {search.tab === 'history' && (
        <section
          aria-labelledby="activity-history-title"
          className="max-w-[86rem] rounded-panel border border-border bg-white [&>h3]:border-b [&>h3]:border-border [&>h3]:px-5 [&>h3]:py-4 [&>h3]:font-semibold"
        >
          <h3 id="activity-history-title">{strings.revisionHistory}</h3>
          {historyFailed ? null : historyLoading && !revisions ? (
            <LoadingPlaceholder label={strings.historyLoading} />
          ) : !revisions?.data?.length ? (
            <EmptyContent kind="activityHistory" />
          ) : (
            <ActivityTimeline events={revisions.data} />
          )}
          {revisions && (
            <Pager
              result={revisions}
              cursorKey="revisionCursor"
              navigate={navigate}
            />
          )}
        </section>
      )}
      <AssignmentModal
        open={assignmentOpen}
        item={item}
        user={user}
        blocked={mutationBlocked}
        draft={assignmentDraft}
        setDraft={setAssignmentDraft}
        opener={assignmentOpener}
        onClose={closeAssignment}
        onDenied={onDenied}
        onSave={(ids, version) =>
          mutation.mutateAsync(
            {
              path: `/activities/${item.id}/assignments`,
              method: 'PUT',
              body: { expected_version: version, agent_ids: ids },
            },
            {
              onSuccess: () => {
                closeAssignment()
              },
            },
          )
        }
      />
      <Modal
        open={Boolean(workflowAction)}
        className="[&>header]:sticky [&>header]:top-0 [&>header]:z-10 [&>header]:bg-white"
        onClose={closeDecision}
        label={
          workflowAction === 'prevalidate'
            ? strings.prevalidationConfirmation
            : workflowAction === 'approve'
              ? strings.approvalConfirmation
              : strings.workflowConfirmation
        }
        opener={workflowOpener}
      >
        <BusinessForm
          className="grid gap-4 min-w-[min(520px,_calc(100vw_-_40px))] p-6 [@media(min-height:601px)]:[&_footer]:sticky [@media(min-height:601px)]:[&_footer]:bottom-0 [&_footer]:z-10 [&_footer]:bg-white [&_footer]:flex [&_footer]:justify-end [&_footer]:gap-2"
          onSubmit={submitWorkflow}
        >
          {!['prevalidate', 'approve'].includes(workflowAction) && (
            <p>{strings.workflowExactRevision}</p>
          )}
          {['prevalidate', 'approve'].includes(workflowAction) && (
            <>
              <p className="font-medium">{item.name}</p>
              <div className="flex items-center justify-between gap-6 border-b border-border pb-4 text-sm">
                <span className="text-muted-foreground">
                  {strings.plannedAmountSummary}
                </span>
                <strong>{formatXof(item.allocation)}</strong>
              </div>
              <label>
                {strings.observation}
                <textarea name="reason" maxLength="4000" autoFocus />
              </label>
            </>
          )}
          {[
            'return',
            'open_amendment',
            'cancel_amendment',
            'request_withdrawal',
            'cancel_withdrawal',
            'request_transfer',
            'cancel_transfer',
          ].includes(workflowAction) && (
            <>
              {[
                'cancel_amendment',
                'cancel_withdrawal',
                'cancel_transfer',
              ].includes(workflowAction) && (
                <p>{strings.cancellationWarning}</p>
              )}
              <label>
                {workflowAction === 'open_amendment'
                  ? strings.amendmentReason
                  : [
                        'cancel_amendment',
                        'cancel_withdrawal',
                        'cancel_transfer',
                      ].includes(workflowAction)
                    ? strings.cancellationReason
                    : workflowAction === 'request_withdrawal'
                      ? strings.withdrawalReason
                      : workflowAction === 'request_transfer'
                        ? strings.transferReason
                        : strings.reason}
                {' *'}
                <textarea name="reason" required maxLength="4000" autoFocus />
              </label>
              {workflowAction === 'request_transfer' && (
                <>
                  <div className="flex gap-8 flex-wrap [&_dt]:text-muted-foreground [&_dt]:text-[0.8125rem]">
                    <div>
                      <strong>{strings.sourceAnnualPlan}</strong>{' '}
                      {item.placement_year}
                    </div>
                    <div>
                      <strong>{strings.targetAnnualPlan}</strong>{' '}
                      {transferTargetYear || strings.chooseStartDate}
                    </div>
                    <div>
                      <strong>{strings.unchangedBudget}</strong>{' '}
                      {formatXof(item.allocation)}
                    </div>
                  </div>
                  <p>{strings.unchangedOperations}</p>
                  <p className="text-sm text-muted-foreground">
                    {ptaStrings.required}
                  </p>
                  <ul
                    className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
                    data-ui="planning-list"
                  >
                    {(item.tasks || []).map((operation) => (
                      <li key={operation.id}>
                        {operation.name}
                        <span>{formatXof(operation.allocation)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-[repeat(auto-fit,_minmax(min(100%,_18rem),_1fr))] gap-4 my-5">
                    <label>
                      {strings.targetStart} *
                      <DatePicker
                        name="planned_start"
                        label={strings.targetStart}
                        value={transferStart}
                        onChange={(value) => {
                          setTransferStart(value)
                          setTransferTasks(
                            shiftedTransferTasks(
                              item.tasks,
                              item.planned_start,
                              value,
                            ),
                          )
                          setTransferTargetYear(
                            value ? Number(value.slice(0, 4)) : '',
                          )
                        }}
                      />
                      <input
                        type="hidden"
                        name="planned_start"
                        value={transferStart}
                      />
                    </label>
                    <label>
                      {strings.targetEnd} *
                      <DatePicker
                        label={strings.targetEnd}
                        value={transferEnd}
                        min={transferStart || undefined}
                        onChange={setTransferEnd}
                      />
                      <input
                        type="hidden"
                        name="planned_end"
                        value={transferEnd}
                      />
                    </label>
                  </div>
                  {transferStart && (
                    <ul className="grid gap-3 p-0 list-none">
                      {(item.tasks || []).map((task, taskIndex) => {
                        const dates = transferTasks[taskIndex]
                        return (
                          <li key={task.id} className="rounded-card border p-3">
                            <strong>{task.name}</strong>
                            <p className="text-sm text-muted-foreground">
                              {dates?.planned_start && dates?.planned_end
                                ? `${formatDate(dates.planned_start)} – ${formatDate(dates.planned_end)}`
                                : strings.dateUnknown}
                            </p>
                            {(task.subtasks || []).map((child, childIndex) => {
                              const childDates = dates?.subtasks[childIndex]
                              return (
                                <p key={child.id} className="text-sm">
                                  {child.name}:{' '}
                                  {childDates?.planned_start &&
                                  childDates?.planned_end
                                    ? `${formatDate(childDates.planned_start)} – ${formatDate(childDates.planned_end)}`
                                    : strings.dateUnknown}
                                </p>
                              )
                            })}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
              {workflowAction === 'return' &&
                user.role === 'VALIDATEUR_DEFINITIF' &&
                !item.withdrawal &&
                !item.transfer && (
                  <label>
                    {strings.requestedAmount}
                    <ExactNumberInput
                      name="requested_amount"
                      value={requestedAmount}
                      onChange={setRequestedAmount}
                      suffix="F CFA"
                    />
                  </label>
                )}
            </>
          )}
          <footer data-ui="modal-actions">
            <Button type="button" variant="outline" onClick={closeDecision}>
              {strings.cancel}
            </Button>
            <Button
              type="submit"
              disabled={
                mutationBlocked ||
                (workflowAction === 'request_transfer' &&
                  (!transferStart ||
                    !transferEnd ||
                    transferEnd < transferStart ||
                    !transferDatesValid))
              }
            >
              {workflowAction === 'prevalidate'
                ? strings.prevalidateAndSend
                : workflowAction === 'approve'
                  ? strings.approveActivity
                  : strings.confirm}
            </Button>
          </footer>
        </BusinessForm>
      </Modal>
    </div>
  )
}

export function ActivityDocuments({
  activityId,
  assigned = false,
  user,
  csrf,
  cursor,
  navigate,
  blocked,
  onDenied,
}) {
  const { api } = useAPI()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [deniedDocuments, setDeniedDocuments] = useState([])
  const [uploadUncertain, setUploadUncertain] = useState(false)
  const uploadAttempt = useRef(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const opener = useRef(null)
  const focusFallback = useRef(null)
  const deliveryScope = useRef(new AbortController())
  const documentsOptions = planningQuery(
    api,
    user.id,
    ['documents', activityId, cursor],
    cursorPath(`/activities/${activityId}/documents`, cursor),
    onDenied,
  )
  const documents = useQuery({
    ...documentsOptions,
    queryFn: async (context) => {
      try {
        return await documentsOptions.queryFn(context)
      } catch (error) {
        if ([403, 404].includes(error.status)) {
          client.setQueriesData(
            {
              queryKey: ['planning', user.id, 'documents', activityId],
            },
            () => ({ data: [], count: 0, next: null, previous: null }),
          )
          deliveryScope.current.abort()
          deliveryScope.current = new AbortController()
          setOpen(false)
        }
        throw error
      }
    },
  })
  const reconcileUpload = async () => {
    const result = await documents.refetch()
    if (!active.current || result.isError) return
    const attempt = uploadAttempt.current
    const saved = result.data?.data.some(
      (document) =>
        attempt &&
        !attempt.documentIds.has(document.id) &&
        document.name === attempt.name &&
        document.size === attempt.size &&
        document.uploaded_by_id === attempt.uploadedById,
    )
    setUploadUncertain(false)
    uploadAttempt.current = null
    if (saved) {
      setOpen(false)
      setUploadFile(null)
    }
  }
  const reconcileAssignment = async () => {
    setOpen(false)
    await client.invalidateQueries({ queryKey: ['planning', user.id] })
    toast.error(strings.assignmentRequired)
  }
  const upload = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: ({ file }) => {
      uploadAttempt.current = {
        documentIds: new Set(
          documents.data?.data.map((document) => document.id) || [],
        ),
        name: file.name,
        size: file.size,
        uploadedById: user.id,
      }
      return api.request(`/api/v1/activities/${activityId}/documents`, {
        method: 'POST',
        csrf,
        rawBody: file,
        headers: {
          'Content-Type': file.type,
          'X-File-Name': file.name,
        },
      })
    },
    onSuccess: async () => {
      if (!active.current) return
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['planning', user.id, 'documents', activityId],
        }),
        client.invalidateQueries({
          queryKey: ['planning', user.id, 'activity-history', activityId],
        }),
        client.invalidateQueries({ queryKey: ['audit-history'] }),
      ])
      setOpen(false)
      setUploadFile(null)
      uploadAttempt.current = null
      toast.success(strings.documentAdded)
    },
    onError: async (error) => {
      if (!active.current) return
      if (error.code === 'activity_assignment_required') {
        await reconcileAssignment()
        return
      }
      if (error.status === 401) {
        onDenied()
        return
      }
      if (
        ['network', 'malformed'].includes(error.kind) ||
        error.status >= 500
      ) {
        setUploadUncertain(true)
        await reconcileUpload()
      }
    },
  })
  const withdraw = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: ({ documentId, reason, replacementDocumentId }) =>
      api.request(
        `/api/v1/activities/${activityId}/documents/${documentId}/withdrawal`,
        {
          method: 'POST',
          csrf,
          body: {
            reason,
            replacement_document_id: replacementDocumentId || null,
          },
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['planning', user.id, 'documents', activityId],
        }),
        client.invalidateQueries({
          queryKey: ['planning', user.id, 'activity-history', activityId],
        }),
        client.invalidateQueries({ queryKey: ['audit-history'] }),
      ])
      toast.success(strings.documentWithdrawn)
    },
    onError: async (error) => {
      if (error.code === 'activity_assignment_required') {
        await reconcileAssignment()
        return
      }
      if (error.status === 401) onDenied()
      if (error.status === 409) {
        await client.invalidateQueries({
          queryKey: ['planning', user.id, 'documents', activityId],
        })
      }
    },
  })
  const sharing = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: (document) => {
      if (!navigator.onLine) throw new TypeError('Offline')
      return api.request(
        `/api/v1/activities/${activityId}/documents/${document.id}/sharing`,
        {
          method: 'PATCH',
          csrf,
          body: {
            shared: !document.partner_shared,
            expected_version: document.sharing_version,
          },
        },
      )
    },
    onSuccess: async (_result, document) => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['planning', user.id, 'documents', activityId],
        }),
        client.invalidateQueries({
          queryKey: ['planning', user.id, 'activity-history', activityId],
        }),
        client.invalidateQueries({ queryKey: ['audit-history'] }),
      ])
      toast.success(
        document.partner_shared
          ? strings.documentSharingStopped
          : strings.documentShared,
      )
    },
    onError: async (error) => {
      if (error.status === 401) onDenied()
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['planning', user.id, 'documents', activityId],
        }),
        client.invalidateQueries({
          queryKey: ['planning', user.id, 'activity-history', activityId],
        }),
        client.invalidateQueries({ queryKey: ['audit-history'] }),
      ])
    },
  })
  const denyDocument = async (id) => {
    setDeniedDocuments((ids) => [...ids, id])
    const queryKey = ['planning', user.id, 'documents', activityId]
    await client.cancelQueries({ queryKey })
    // Discard revoked projections; this does not predict a business mutation.
    client.setQueriesData(
      { queryKey },
      (page) =>
        page && {
          ...page,
          data: page.data.filter((document) => document.id !== id),
          count:
            page.count -
            Number(page.data.some((document) => document.id === id)),
        },
    )
  }
  const canUpload =
    user.role === 'AGENT_VERIFICATEUR' ||
    user.role === 'VALIDATEUR_DEFINITIF' ||
    (user.role === 'AGENT_SAISIE' && assigned)
  const uploadNotice = uploadUncertain && (
    <div role="alert">
      <p>{strings.uploadUncertain}</p>
      {documents.isError && (
        <Button
          type="button"
          disabled={documents.isFetching}
          onClick={reconcileUpload}
        >
          {strings.verifyAttachments}
        </Button>
      )}
    </div>
  )

  return (
    <Panel
      aria-labelledby="activity-documents-title"
      className="p-0 gap-0 [&>div:first-child]:border-b [&>div:first-child]:border-border [&>div:first-child]:p-5"
    >
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <h3
          id="activity-documents-title"
          ref={focusFallback}
          tabIndex={-1}
          className="rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          {strings.attachments}
        </h3>
        {canUpload && (
          <Button
            variant="outline"
            size="sm"
            disabled={
              blocked ||
              upload.isPending ||
              documents.isFetching ||
              documents.isError
            }
            onClick={async (event) => {
              opener.current = event.currentTarget
              if (cursor)
                await navigate({
                  search: (current) => ({ ...current, documentCursor: '' }),
                })
              setUploadUncertain(false)
              setUploadFile(null)
              uploadAttempt.current = null
              setOpen(true)
            }}
          >
            {strings.addAttachment}
          </Button>
        )}
      </div>
      {!open && uploadNotice}
      {deniedDocuments.length > 0 && (
        <p role="alert">{strings.documentUnavailable}</p>
      )}
      {sharing.isError && <p role="alert">{strings.sharingFailed}</p>}
      {documents.isError && <p role="alert">Les pièces sont indisponibles.</p>}
      {documents.isPending ? (
        <LoadingPlaceholder label={common.documentsLoading} />
      ) : !documents.data?.data.length ? (
        <EmptyContent kind="documents" />
      ) : (
        <ul
          className="grid list-none gap-0 p-0 [&_li]:flex [&_li]:min-h-18 [&_li]:items-center [&_li]:justify-between [&_li]:gap-4 [&_li]:border-t [&_li]:border-t-border [&_li]:px-5 [&_li]:py-4"
          data-ui="planning-list"
        >
          {documents.data.data
            .filter((document) => !deniedDocuments.includes(document.id))
            .map((document) => (
              <li key={document.id}>
                <span className="flex min-w-0 items-start gap-3">
                  <Folder
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <strong className="block break-words text-[0.8125rem] font-semibold">
                      {document.name}
                    </strong>
                    {document.partner_shared && (
                      <small className="text-muted-foreground">
                        {strings.sharedWithPartner} ·{' '}
                      </small>
                    )}
                    <small className="text-muted-foreground">
                      {document.withdrawal
                        ? `${strings.withdrawnAttachment} · ${document.withdrawal.reason}`
                        : formatDateTime(document.uploaded_at)}
                      {document.withdrawal?.replacement_document_name &&
                        ` · ${strings.replacedBy} ${document.withdrawal.replacement_document_name}`}
                    </small>
                  </span>
                </span>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!document.withdrawal &&
                    ['image/jpeg', 'image/png'].includes(
                      document.media_type,
                    ) && (
                      <ProtectedFilePreview
                        aria-label={`${common.preview} de ${document.name}`}
                        size="sm"
                        path={`/api/v1/activities/${activityId}/documents/${document.id}/preview`}
                        title={document.name}
                        download={false}
                        downloadPath={`/api/v1/activities/${activityId}/documents/${document.id}/download`}
                        errorMessage={(error) =>
                          error?.kind === 'offline'
                            ? 'Connexion indisponible. Reconnectez-vous pour afficher l’aperçu.'
                            : 'L’aperçu est indisponible.'
                        }
                        scope={deliveryScope}
                        onDenied={(status) => {
                          if (status === 401) onDenied()
                          else void denyDocument(document.id)
                        }}
                      >
                        {common.preview}
                      </ProtectedFilePreview>
                    )}
                  {!document.withdrawal && (
                    <ProtectedDownload
                      path={`/api/v1/activities/${activityId}/documents/${document.id}/download`}
                      onDenied={(status) => {
                        if (status === 401) onDenied()
                        else void denyDocument(document.id)
                      }}
                      scope={deliveryScope}
                      size="sm"
                    >
                      {common.download}
                    </ProtectedDownload>
                  )}
                  {(document.allowed_actions?.includes('share') ||
                    document.allowed_actions?.includes('unshare')) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        blocked ||
                        sharing.isPending ||
                        documents.isFetching ||
                        documents.isError
                      }
                      onClick={() => sharing.mutate(document)}
                    >
                      {document.partner_shared
                        ? strings.stopPartnerSharing
                        : strings.shareWithPartner}
                    </Button>
                  )}
                  {document.allowed_actions?.includes('withdraw') && (
                    <DocumentWithdrawalAction
                      document={document}
                      activityId={activityId}
                      user={user}
                      blocked={blocked}
                      pending={withdraw.isPending}
                      onDenied={onDenied}
                      onWithdraw={withdraw.mutateAsync}
                      focusFallback={focusFallback}
                    />
                  )}
                </div>
              </li>
            ))}
        </ul>
      )}
      <Pager
        result={documents.data}
        cursorKey="documentCursor"
        navigate={navigate}
      />
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          setUploadFile(null)
          uploadAttempt.current = null
        }}
        label={strings.addAttachment}
        opener={opener}
      >
        <BusinessForm
          onSubmit={(event) => {
            event.preventDefault()
            if (
              uploadFile?.size > 0 &&
              !uploadUncertain &&
              !documents.isFetching &&
              !documents.isError
            )
              return upload.mutateAsync({ file: uploadFile })
            return false
          }}
        >
          {uploadNotice}
          <FileSelection
            label={`${strings.chooseAttachment} *`}
            chooseLabel={strings.chooseFile}
            emptyLabel={strings.noFileSelected}
            file={uploadFile}
            name="attachment"
            accept="application/pdf,image/jpeg,image/png"
            required
            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
          />
          <div data-ui="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                setUploadFile(null)
                uploadAttempt.current = null
              }}
            >
              {strings.cancel}
            </Button>
            <Button
              disabled={
                blocked ||
                upload.isPending ||
                uploadUncertain ||
                documents.isFetching ||
                documents.isError
              }
              type="submit"
            >
              {strings.add}
            </Button>
          </div>
        </BusinessForm>
      </Modal>
    </Panel>
  )
}

export function PlanningLoading({ screen }) {
  return (
    <PageLoading
      title={labels[screen]}
      variant={
        screen === 'activityNew'
          ? 'form'
          : ['pta', 'activity'].includes(screen)
            ? 'detail'
            : 'table'
      }
    />
  )
}
