import { Urls } from '@/app/urls'
import { PTAModal } from '../components/PTAModal'
import { ActivityBriefModal } from '../components/ActivityBriefModal'
import { DatePicker } from '@/shared/ui/DatePicker'
import { strings as ptaStrings } from '@/locales/fr/PTAModal'
import { readCalendar } from '../lib/calendar'
import { PlanningActivities } from '../components/PlanningActivities'
import { PlanningSummary } from '../components/PlanningSummary'
import { ActivityTimeline } from '@/features/audit/ActivityTimeline'
import { activityStatusClass } from '../lib/activity-status'
import { CategoryCreator } from '../components/CategoryCreator'
import { Select } from '@/shared/ui/select'
import { EmptyContent, EmptyTable } from '@/shared/ui/EmptyContent'
import { businessActionClassName } from '@/shared/ui/button-variants'
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
import { ChevronDown, Download, Eye, Pencil, Plus, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { strings } from '@/locales/fr/PlanningView'
import { strings as common } from '@/locales/fr/common'
import { useAPI } from '@/shared/api/RestClientProvider'
import {
  addThreeMonths,
  formatDate,
  formatXof,
  localDateInput,
} from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { ProtectedDownload } from '@/shared/ui/ProtectedDownload'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Modal } from '@/shared/ui/BusinessModal'
import { useProtectedCleanup } from '@/features/auth/session/access-verification'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/components/AccessDeniedState'
import { AgentSearchPanel } from '@/shared/ui/AgentSearchPanel'

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

function workflowActivityId(path) {
  return path.match(
    /^\/activities\/([^/]+)\/(?:submissions|amendments(?:\/[^/]+\/cancellation)?|withdrawals(?:\/[^/]+\/cancellation)?|transfers(?:\/[^/]+\/cancellation)?|revisions\/[^/]+\/decisions)$/,
  )?.[1]
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
      if (variables.path !== '/operation-types')
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
      if (!variables.silentSuccess) toast.success(strings.saved)
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
    reviewerState && search.review !== 'all' && !search.state,
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
      ['operation-types', search.typeCursor],
      cursorPath('/operation-types', search.typeCursor),
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
          ? [context, ...(context.data?.pta?.id ? [list] : [])]
          : screen === 'activityNew'
            ? [types, context]
            : [activity, ...(historyActive ? [revisions] : [])]
  const loading = planningQueries.some(
    (query) => query.isFetching && query.fetchStatus !== 'idle',
  )
  const primaryPending =
    (screen === 'partners' && partners.isPending) ||
    (screen === 'projects' && projects.isPending) ||
    (screen === 'pta' && context.isPending) ||
    (screen === 'activityNew' &&
      (context.isPending ||
        (!authorization(session).can('ptaManagement') && types.isPending))) ||
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
          ? [context]
          : screen === 'activityNew'
            ? [types, context]
            : [activity]
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
      <Panel>
        <p>{ptaStrings.required}</p>
        <Link to={Urls.planning} className="text-primary">
          {ptaStrings.breadcrumb}
        </Link>
      </Panel>
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
            onEdit={(row, values) =>
              mutation.mutateAsync({
                path: `/partners/${row.id}`,
                method: 'PATCH',
                body: {
                  ...values,
                  expected: { name: row.name, description: row.description },
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
          onEdit={(row, name) =>
            mutation.mutateAsync({
              path: `/projects/${row.id}`,
              method: 'PATCH',
              body: { action: 'edit', name, expected_version: row.version },
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
      {screen === 'activityNew' && types.isPending && (
        <LoadingPlaceholder
          label={strings.formatString(common.pageLoading, {
            page: strings.newActivity,
          })}
          variant="form"
        />
      )}
      {screen === 'activityNew' && (
        <div hidden={types.isPending} className="grid gap-6">
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
            onCreateType={(body) =>
              mutation.mutateAsync({
                path: '/operation-types',
                body,
                silentSuccess: true,
              })
            }
            types={types.data?.data || []}
            typeResult={types.data}
            navigate={navigate}
            pending={mutation.isPending}
            onSubmit={async (body, intent) => {
              const row = await mutation.mutateAsync({
                path: `/projects/${projectId}/ptas/${year}/activities`,
                body,
                silentSuccess: intent === 'submit',
              })
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
  const [open, setOpen] = useState(false)
  const opener = useRef(null)
  const [editing, setEditing] = useState(null)
  const rows = result?.data || []
  return (
    <Panel as="div" className="border-0 bg-transparent p-0 gap-6">
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        {title === strings.partners ? (
          <h1 className="text-2xl font-semibold text-navy">{title}</h1>
        ) : (
          <h2>{title}</h2>
        )}
        {onSubmit && (
          <Button
            ref={opener}
            type="button"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus size={16} />{' '}
            {title === strings.partners ? strings.createPartner : strings.add}
          </Button>
        )}
      </div>
      {onSubmit && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          label={
            title === strings.partners
              ? editing
                ? strings.modifyPartner
                : strings.createPartner
              : strings.formatString(strings.addTo, title)
          }
          opener={opener}
        >
          <BusinessForm
            key={`${open}:${editing?.id || 'new'}`}
            onSubmit={async (event) => {
              if (editing) {
                const data = new FormData(event.currentTarget)
                await onEdit(editing, {
                  name: data.get('name'),
                  description: data.get('description') || null,
                })
              } else await onSubmit(event)
              setOpen(false)
            }}
          >
            <label>
              {inputLabel} *
              <input
                name={label}
                required
                maxLength="200"
                defaultValue={editing?.name}
              />
            </label>
            {title === strings.partners && (
              <label>
                {strings.description}
                <textarea
                  name="description"
                  maxLength={4000}
                  defaultValue={editing?.description || ''}
                />
              </label>
            )}
            <div data-ui="modal-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
                        <span className="rounded-card bg-selected px-2 py-1 text-xs text-primary">
                          {row.active
                            ? strings.activeProject
                            : strings.closedProject}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {row.allowed_actions?.includes('edit') && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              opener.current = event.currentTarget
                              setEditing(row)
                              setOpen(true)
                            }}
                          >
                            {strings.modify}
                          </Button>
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

function Projects({ result, canCreate, onSubmit, onEdit, onClose, navigate }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(null)
  const [editing, setEditing] = useState(null)
  const closeOpener = useRef(null)
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
        <h1 className="text-2xl font-semibold text-navy">{strings.projects}</h1>
        {canCreate && (
          <Button
            ref={opener}
            type="button"
            disabled={!partners.length}
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus size={16} /> {strings.createProject}
          </Button>
        )}
      </div>
      {canCreate && partnerChoices.isError && !open && (
        <RetryableError onRetry={() => void partnerChoices.refetch()}>
          {strings.unavailablePlanning}
        </RetryableError>
      )}
      {closing && (
        <Modal
          open
          onClose={() => setClosing(null)}
          label={strings.closeProjectTitle}
          opener={closeOpener}
        >
          <BusinessForm
            onSubmit={async () => {
              await onClose(closing)
              setClosing(null)
            }}
          >
            <p>
              {strings.formatString(strings.closeProjectPrompt, closing.name)}
            </p>
            <div data-ui="modal-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setClosing(null)}
              >
                {strings.cancel}
              </Button>
              <Button type="submit">{strings.close}</Button>
            </div>
          </BusinessForm>
        </Modal>
      )}
      {canCreate && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          label={editing ? strings.modifyProject : strings.createProject}
          opener={opener}
        >
          <BusinessForm
            key={`${open}:${editing?.id || 'new'}`}
            onSubmit={async (event) => {
              if (editing)
                await onEdit(
                  editing,
                  new FormData(event.currentTarget).get('name'),
                )
              else await onSubmit(event)
              setOpen(false)
            }}
          >
            {partnerChoices.isError && (
              <RetryableError onRetry={() => void partnerChoices.refetch()}>
                {strings.unavailablePlanning}
              </RetryableError>
            )}
            <label>
              {strings.name} *
              <input
                name="name"
                required
                maxLength="200"
                defaultValue={editing?.name}
              />
            </label>
            <label>
              {strings.partner} *
              <Select
                name="partner_id"
                required
                defaultValue={editing?.partner_id}
                disabled={Boolean(editing) || !partnerResult}
              >
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
                onClick={() => setOpen(false)}
              >
                {strings.cancel}
              </Button>
              <Button
                type="submit"
                disabled={
                  !editing &&
                  !partners.some((partner) => partner.active !== false)
                }
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
                    <span
                      className={
                        row.state === 'active'
                          ? 'rounded-card bg-selected px-2 py-1 text-xs text-primary'
                          : 'rounded-card bg-disabled px-2 py-1 text-xs text-muted-foreground'
                      }
                    >
                      {row.state === 'active'
                        ? strings.activeProject
                        : strings.closedProject}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {row.allowed_actions.includes('edit') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            opener.current = event.currentTarget
                            setEditing(row)
                            setOpen(true)
                          }}
                        >
                          {strings.modify}
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link to={Urls.planning} search={{ project: row.id }}>
                          {strings.viewPtas}
                        </Link>
                      </Button>
                      {row.allowed_actions.includes('close') && (
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            closeOpener.current = event.currentTarget
                            setClosing(row)
                          }}
                        >
                          {strings.close}
                        </Button>
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
            {context.pta?.name || `PTA ${context.year}`}
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
                <Plus size={16} />
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
                  <Plus size={16} />
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
        <Panel>
          <p>{ptaStrings.required}</p>
          <Link to={Urls.planning} className="text-primary">
            {ptaStrings.breadcrumb}
          </Link>
        </Panel>
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
              <Download size={16} />
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
  if (!result?.next && !result?.previous) return null
  const move = (link) =>
    navigate({
      search: (current) => ({ ...current, [cursorKey]: cursorFrom(link) }),
    })
  return (
    <nav className="flex gap-2 items-end flex-wrap" aria-label="Pagination">
      <Button
        type="button"
        variant="outline"
        disabled={!result.previous}
        onClick={() => move(result.previous)}
      >
        {common.previous}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!result.next}
        onClick={() => move(result.next)}
      >
        {common.next}
      </Button>
    </nav>
  )
}

export function ActivityForm({
  year,
  onCreateType,
  types,
  typeResult,
  navigate,
  pending,
  optionsUnavailable = false,
  initial,
  onSubmit,
  onCancel,
}) {
  const suggestedStart =
    !initial && Number(year) === new Date().getFullYear()
      ? localDateInput()
      : ''
  const suggestedEnd = addThreeMonths(suggestedStart)
  const [draftBase] = useState(initial)
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [dateError, setDateError] = useState(false)
  const [operationError, setOperationError] = useState(false)
  const [plannedAmount, setPlannedAmount] = useState(
    initial?.allocation ?? null,
  )
  const [start, setStart] = useState(initial?.planned_start || suggestedStart)
  const [end, setEnd] = useState(
    initial ? initial.planned_end || '' : suggestedEnd,
  )
  const [endWasEdited, setEndWasEdited] = useState(
    Boolean(initial?.planned_end),
  )
  const requestKey = useRef(initial ? null : crypto.randomUUID())
  const [operations, setOperations] = useState(
    initial?.operations || [{ type_id: '', name: '', allocation: '' }],
  )
  const strictPlan = [
    'amendment_draft',
    'returned_supervisor',
    'returned_validator',
  ].includes(initial?.state)
  const startedOperations = operations.filter((row) =>
    [row.type_id, row.name, row.allocation].some((value) =>
      String(value || '').trim(),
    ),
  )
  const startedOperationsComplete = startedOperations.every(
    (row) =>
      row.type_id && row.name.trim() && /^[1-9]\d*$/.test(row.allocation),
  )
  const availableTypes = [...types]
  for (const operation of operations)
    if (
      operation.type_id &&
      !availableTypes.some((type) => type.id === operation.type_id)
    )
      availableTypes.push({
        id: operation.type_id,
        label: operation.type_label || `Type ${operation.type_id}`,
      })
  const total = operations.reduce(
    (sum, row) =>
      sum + (/^[1-9]\d*$/.test(row.allocation) ? BigInt(row.allocation) : 0n),
    0n,
  )
  const allOperationAmounts =
    startedOperations.length > 0 &&
    startedOperations.every((row) => /^[1-9]\d*$/.test(row.allocation))
  const plannedAmountMatches =
    plannedAmount === null ||
    plannedAmount === '' ||
    (/^[1-9]\d*$/.test(plannedAmount) && BigInt(plannedAmount) === total)
  const submissionIssues = [
    !name.trim() && strings.submissionTitleMissing,
    !description.trim() && strings.submissionDescriptionMissing,
    (!start || !end || end < start) && strings.submissionDatesMissing,
    (startedOperations.length === 0 || !startedOperationsComplete) &&
      strings.submissionOperationsMissing,
    !plannedAmountMatches && strings.submissionBudgetMissing,
  ].filter(Boolean)
  return (
    <Panel
      as={BusinessForm}
      className="border-0 bg-transparent p-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px] items-start"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending || optionsUnavailable) return false
        const intent = event.nativeEvent.submitter?.value || 'draft'
        const requiresCompletePlan = strictPlan || intent === 'submit'
        if (!startedOperationsComplete) {
          setOperationError(true)
          return false
        }
        setOperationError(false)
        if (
          (start && end && end < start) ||
          (requiresCompletePlan && (!start || !end))
        ) {
          setDateError(true)
          event.currentTarget
            .querySelector('[data-date-invalid="true"]')
            ?.focus()
          return false
        }
        setDateError(false)
        const data = new FormData(event.currentTarget)
        return onSubmit(
          {
            name: data.get('name'),
            description: data.get('description'),
            planned_start: start || null,
            planned_end: end || null,
            allocation:
              startedOperations.length > 0
                ? (plannedAmount ?? total.toString())
                : null,
            operations: startedOperations.map((row) => ({
              id: row.id || undefined,
              type_id: row.type_id,
              name: row.name,
              allocation: row.allocation,
            })),
            ...(initial
              ? { expected_version: draftBase.version }
              : { request_key: requestKey.current }),
          },
          intent,
        )
      }}
    >
      <div className="grid min-w-0 gap-6">
        <section className="rounded-panel border border-border bg-white">
          <h2 className="border-b border-border px-5 py-4">
            {strings.generalInformation}
          </h2>
          <div className="grid gap-6 p-5">
            <label>
              {strings.activityName} *
              <input
                name="name"
                required
                maxLength="200"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              {strings.description}
              {strictPlan && ' *'}
              <textarea
                name="description"
                required={strictPlan}
                maxLength="4000"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>
        </section>
        <section className="rounded-panel border border-border bg-white">
          <h2 className="border-b border-border px-5 py-4">
            {strings.planningTitle}
          </h2>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label>
              {strings.start}
              {strictPlan && ' *'}
              <DatePicker
                label={strings.start}
                aria-invalid={dateError && !start}
                data-date-invalid={!start}
                value={start}
                min={year ? `${year}-01-01` : undefined}
                max={year ? `${year}-12-31` : undefined}
                onChange={(value) => {
                  setStart(value)
                  if (!endWasEdited) setEnd(addThreeMonths(value))
                }}
                optional={!strictPlan}
              />
            </label>
            <label>
              {strings.end}
              {strictPlan && ' *'}
              <DatePicker
                label={strings.end}
                aria-invalid={dateError && (!end || end < start)}
                data-date-invalid={!end || end < start}
                value={end}
                min={start || undefined}
                onChange={(value) => {
                  setEnd(value)
                  setEndWasEdited(true)
                }}
                optional={!strictPlan}
              />
            </label>
          </div>
          {dateError && (!start || !end || end < start) && (
            <p role="alert" className="px-5 pb-5 text-sm text-destructive">
              {strings.requiredDates}
            </p>
          )}
        </section>
        <section className="rounded-panel border border-border bg-white">
          <h2 className="border-b border-border px-5 py-4">
            {strings.operationsBudget}
          </h2>
          <div className="grid gap-5 p-5">
            <label className="max-w-80">
              {strings.plannedAmount}
              {strictPlan && ' *'}
              <input
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                value={
                  plannedAmount ?? (allOperationAmounts ? total.toString() : '')
                }
                onChange={(event) => setPlannedAmount(event.target.value)}
              />
            </label>
            <fieldset className="grid gap-4">
              <legend className="sr-only">{strings.operations}</legend>
              {operations.map((row, index) => {
                const rowStarted = [row.type_id, row.name, row.allocation].some(
                  (value) => String(value || '').trim(),
                )
                return (
                  <div
                    className="grid items-start gap-4 rounded-card border border-border p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]"
                    key={row.id || index}
                  >
                    <div className="flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-3">
                      <h3 className="font-semibold">
                        {strings.operation} {index + 1}
                      </h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={strings.formatString(
                          strings.operationRemoveNumber,
                          index + 1,
                        )}
                        data-edits-form
                        onClick={() =>
                          setOperations(
                            operations.filter((_, i) => i !== index),
                          )
                        }
                      >
                        {strings.remove}
                      </Button>
                    </div>
                    <label>
                      {strings.operationName}
                      {rowStarted && ' *'}
                      <input
                        aria-label={strings.formatString(
                          strings.operationNameNumber,
                          index + 1,
                        )}
                        maxLength="200"
                        value={row.name}
                        onChange={(e) =>
                          setOperations(
                            operations.map((item, i) =>
                              i === index
                                ? { ...item, name: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="grid gap-2">
                      <label>
                        {strings.activityOperationType}
                        {rowStarted && ' *'}
                        <Select
                          aria-label={strings.formatString(
                            strings.operationTypeNumber,
                            index + 1,
                          )}
                          value={row.type_id}
                          onChange={(e) =>
                            setOperations(
                              operations.map((item, i) =>
                                i === index
                                  ? { ...item, type_id: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="">Choisir</option>
                          {availableTypes.map((type) => (
                            <option value={type.id} key={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </Select>
                      </label>
                      {onCreateType && (
                        <CategoryCreator
                          onCreate={onCreateType}
                          disabled={pending || optionsUnavailable}
                          onCreated={(type) =>
                            setOperations((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      type_id: type.id,
                                      type_label: type.label,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      )}
                    </div>
                    <label>
                      {strings.operationAmount}
                      {rowStarted && ' *'}
                      <input
                        aria-label={strings.formatString(
                          strings.operationBudgetNumber,
                          index + 1,
                        )}
                        inputMode="numeric"
                        pattern="[1-9][0-9]*"
                        value={row.allocation}
                        onChange={(e) =>
                          setOperations(
                            operations.map((item, i) =>
                              i === index
                                ? { ...item, allocation: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                )
              })}
            </fieldset>
            {operationError && (
              <p role="alert" className="text-sm text-destructive">
                {strings.completeOrRemoveOperation}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              data-edits-form
              onClick={() =>
                setOperations([
                  ...operations,
                  { type_id: '', name: '', allocation: '' },
                ])
              }
            >
              <Plus size={16} />
              {strings.addOperation}
            </Button>
            {navigate && (
              <Pager
                result={typeResult}
                cursorKey="typeCursor"
                navigate={navigate}
              />
            )}
          </div>
        </section>
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="submit"
            name="intent"
            value="draft"
            aria-describedby={
              strictPlan && submissionIssues.length
                ? 'activity-submission-guidance'
                : undefined
            }
            disabled={
              pending ||
              optionsUnavailable ||
              !plannedAmountMatches ||
              (strictPlan && submissionIssues.length > 0)
            }
          >
            <Save size={16} /> {strings.saveDraft}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="submit"
            aria-describedby={
              submissionIssues.length
                ? 'activity-submission-guidance'
                : undefined
            }
            disabled={
              pending || optionsUnavailable || submissionIssues.length > 0
            }
          >
            {strings.submitReview}
          </Button>
          {submissionIssues.length > 0 && (
            <p
              id="activity-submission-guidance"
              className="basis-full text-right text-sm text-muted-foreground"
            >
              {strings.submissionMissing} {submissionIssues.join(' · ')}
            </p>
          )}
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onCancel}
            >
              {strings.cancelEditing}
            </Button>
          )}
        </div>
      </div>
      <aside className="rounded-panel border border-border bg-white lg:sticky lg:top-6">
        <h2 className="border-b border-border px-5 py-4">
          {strings.budgetDistribution}
        </h2>
        <dl className="grid gap-6 p-5">
          <div>
            <dt className="text-[0.8125rem] text-muted-foreground">
              {strings.plannedAmount}
            </dt>
            <dd className="mt-2 font-semibold">
              {formatXof(
                /^[1-9]\d*$/.test(plannedAmount || '')
                  ? plannedAmount
                  : allOperationAmounts
                    ? total
                    : null,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[0.8125rem] text-muted-foreground">
              {strings.operationTotal}
            </dt>
            <dd className="mt-2 font-semibold">
              {allOperationAmounts ? formatXof(total) : '—'}
            </dd>
          </div>
          <div role="status">
            <dt className="text-[0.8125rem] text-muted-foreground">
              {strings.budgetDifference}
            </dt>
            <dd
              className={`mt-2 font-semibold ${
                allOperationAmounts &&
                plannedAmount !== null &&
                /^[1-9]\d*$/.test(plannedAmount) &&
                BigInt(plannedAmount) !== total
                  ? 'text-warning'
                  : 'text-success'
              }`}
            >
              {allOperationAmounts &&
              plannedAmount !== null &&
              /^[1-9]\d*$/.test(plannedAmount) &&
              BigInt(plannedAmount) !== total
                ? formatXof(BigInt(plannedAmount) - total)
                : '—'}
            </dd>
          </div>
        </dl>
      </aside>
    </Panel>
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
            {value.planned_start} au {value.planned_end}
          </dd>
        </div>
        <div>
          <dt>{strings.budget}</dt>
          <dd>{formatXof(value.allocation)}</dd>
        </div>
      </dl>
      <ul
        className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
        data-ui="planning-list"
      >
        {value.operations.map((operation) => (
          <li key={operation.id}>
            {operation.type_label ? `${operation.type_label} — ` : ''}
            {operation.name}
            <span>{formatXof(operation.allocation)}</span>
          </li>
        ))}
      </ul>
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
            <ChevronDown size={16} aria-hidden="true" />
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
                    <LoadingPlaceholder
                      label={strings.coordinatedAgents}
                      variant="form"
                    />
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
                  {(choices.data?.previous || choices.data?.next) && (
                    <nav className="flex gap-2" aria-label="Pagination">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!choices.data.previous}
                        onClick={() =>
                          setCursor(cursorFrom(choices.data.previous))
                        }
                      >
                        {common.previous}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!choices.data.next}
                        onClick={() => setCursor(cursorFrom(choices.data.next))}
                      >
                        {common.next}
                      </Button>
                    </nav>
                  )}
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

function activityNextStep(item) {
  if (item.state === 'draft') return strings.nextStepDraft
  if (item.state?.startsWith('returned'))
    return item.transfer
      ? strings.nextStepTransferCorrection
      : item.withdrawal
        ? strings.nextStepWithdrawalCorrection
        : item.amendment
          ? strings.nextStepAmendmentCorrection
          : strings.nextStepActivityCorrection
  if (item.state === 'amendment_draft') return strings.nextStepAmendment
  const subject = item.transfer
    ? strings.transferSubject
    : item.withdrawal
      ? strings.withdrawalSubject
      : item.amendment
        ? strings.amendmentSubject
        : strings.activitySubject
  if (item.state === 'submitted')
    return strings.formatString(strings.nextStepSupervisor, { subject })
  if (item.state === 'prevalidated')
    return strings.formatString(strings.nextStepValidator, { subject })
  if (item.state === 'approved') return strings.nextStepExecution
  return ''
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
  const [decisionFile, setDecisionFile] = useState(null)
  const [decisionUpload, setDecisionUpload] = useState(null)
  const [transferTargetYear, setTransferTargetYear] = useState(
    item.transfer?.target_year || '',
  )
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
  const client = useQueryClient()
  const search = useSearch({ strict: false })
  const typeChoices = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['operation-types', search.typeCursor],
      cursorPath('/operation-types', search.typeCursor),
      onDenied,
    ),
    enabled: editing,
  })
  const types = typeChoices.data?.data || []
  const typeResult = typeChoices.data
  const closeDecision = () => {
    setDecisionUpload(null)
    setDecisionFile(null)
    setWorkflowAction('')
  }
  const refreshDecisionEvidence = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['planning', user.id, 'documents', item.id],
      }),
      client.invalidateQueries({
        queryKey: ['planning', user.id, 'activity-history', item.id],
      }),
      client.invalidateQueries({ queryKey: ['audit-history'] }),
    ])
  }
  const reconcileDecisionFile = async (attempt) => {
    try {
      setDecisionUpload({ ...attempt, status: 'checking' })
      const result = await api.request(
        `/api/v1/activities/${item.id}/documents?limit=60`,
      )
      const found = (result.data || []).some(
        (document) =>
          !attempt.baselineIds.includes(document.id) &&
          document.name === attempt.file.name &&
          document.size === attempt.file.size &&
          document.uploaded_by_id === user.id,
      )
      if (found) {
        await refreshDecisionEvidence()
        toast.success(strings.decisionAndAttachmentSaved)
        closeDecision()
        return
      }
      setDecisionUpload({ ...attempt, status: 'retry' })
    } catch (error) {
      if (error.status === 401) onDenied()
      else setDecisionUpload({ ...attempt, status: 'uncertain' })
    }
  }
  const uploadDecisionFile = async (file) => {
    let attempt
    try {
      const before = await api.request(
        `/api/v1/activities/${item.id}/documents?limit=60`,
      )
      attempt = {
        file,
        baselineIds: (before.data || []).map((document) => document.id),
      }
      setDecisionUpload({ ...attempt, status: 'uploading' })
      await api.request(`/api/v1/activities/${item.id}/documents`, {
        method: 'POST',
        csrf,
        rawBody: file,
        headers: { 'Content-Type': file.type, 'X-File-Name': file.name },
      })
      await refreshDecisionEvidence()
      toast.success(strings.decisionAndAttachmentSaved)
      closeDecision()
    } catch (error) {
      if (error.status === 401) {
        onDenied()
        return
      }
      if (
        attempt &&
        (['network', 'malformed'].includes(error.kind) || error.status >= 500)
      ) {
        await reconcileDecisionFile(attempt)
        return
      }
      setDecisionUpload({
        ...(attempt || { file, baselineIds: [] }),
        status: 'retry',
      })
    }
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
    const hasDecisionFile =
      ['prevalidate', 'approve'].includes(workflowAction) &&
      typeof decisionFile?.size === 'number' &&
      decisionFile.size > 0
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
      silentSuccess: hasDecisionFile,
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
    if (hasDecisionFile) {
      await uploadDecisionFile(decisionFile)
      return
    }
    closeDecision()
  }
  if (editing)
    return (
      <Panel as="div" className="border-0 bg-transparent p-0 gap-6">
        <nav
          aria-label={strings.breadcrumb}
          className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
        >
          <Link to={Urls.planning} className="text-primary">
            {strings.planningIndex}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            to={Urls.pta}
            params={{
              projectId: item.project_id,
              year: String(item.placement_year),
            }}
            className="text-primary"
          >
            {item.pta_name}
          </Link>
          <span aria-hidden="true">/</span>
          <span>{strings.programming}</span>
        </nav>
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-navy">
              {!item.planned_end || item.allocation === null
                ? strings.completeProgramming
                : strings.reviseProgramming}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {item.project_name} · {item.partner_name} · {item.pta_name}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(false)}
          >
            {strings.cancel}
          </Button>
        </header>
        {typeChoices.isError && (
          <RetryableError onRetry={() => void typeChoices.refetch()}>
            {strings.unavailablePlanning}
          </RetryableError>
        )}
        <ActivityForm
          onCreateType={(body) =>
            mutation.mutateAsync({
              path: '/operation-types',
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
          onSubmit={async (body, intent) => {
            const saved = await mutation.mutateAsync({
              path: `/activities/${item.id}`,
              method: 'PATCH',
              body,
              silentSuccess: intent === 'submit',
            })
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
        />
      </Panel>
    )
  const creatorName =
    item.creator?.full_name || item.creator?.email || strings.unknownActor
  const submitterName =
    item.current_submitter?.full_name ||
    item.current_submitter?.email ||
    creatorName
  const latestDecisionName =
    item.latest_decision_actor?.full_name ||
    item.latest_decision_actor?.email ||
    strings.unknownActor
  const programmingIncomplete =
    item.state === 'draft' &&
    (!item.description?.trim() ||
      !item.planned_start ||
      !item.planned_end ||
      item.allocation === null ||
      !item.operations.length)
  const nextStep = activityNextStep(item)
  return (
    <Panel as="div" className="border-0 bg-transparent p-0 gap-6">
      <nav
        aria-label={strings.breadcrumb}
        className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
      >
        <Link to={Urls.planning} className="text-primary">
          {strings.planningIndex}
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          to={Urls.pta}
          params={{
            projectId: item.project_id,
            year: String(item.placement_year),
          }}
          className="text-primary"
        >
          {item.pta_name}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{item.reference}</span>
      </nav>
      <div className="flex justify-between items-end gap-8 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <div className="grid gap-3">
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
            {item.reference}
          </p>
          <h1 className="text-[1.75rem] font-semibold leading-8 text-navy">
            {item.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {item.project_name} · {item.partner_name} · {item.pta_name}
          </p>
          {item.description?.trim() && (
            <div className="max-w-3xl">
              <p className="text-xs font-medium text-muted-foreground">
                {strings.activityPurpose}
              </p>
              <p className="mt-1 line-clamp-3 text-sm leading-6 text-foreground">
                {item.description}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            <span
              className={`w-fit rounded-card px-2 py-1 text-xs ${activityStatusClass(item.state)}`}
            >
              {strings[item.state] || item.state}
            </span>
            <span className="font-medium">
              {formatDate(item.planned_start)} {strings.until}{' '}
              {item.planned_end ? formatDate(item.planned_end) : '—'}
            </span>
            <span className="flex flex-wrap items-center gap-3">
              <span className="font-medium">
                {(item.agents || [])
                  .map((agent) => agent.full_name || agent.email)
                  .join(', ') || '—'}
              </span>
              {canAssign && (
                <Button
                  type="button"
                  variant="outline"
                  className="size-8 min-h-8 p-0"
                  aria-label={strings.changeOwners}
                  title={strings.changeOwners}
                  onClick={(event) => {
                    assignmentOpener.current = event.currentTarget
                    setAssignmentOpen(true)
                  }}
                >
                  <Pencil size={15} aria-hidden="true" />
                </Button>
              )}
            </span>
          </div>
          {nextStep && (
            <p className="max-w-3xl text-sm leading-6">
              <strong className="font-medium">{strings.nextStep}</strong>
              <span className="text-muted-foreground"> · {nextStep}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          {item.approved_revision_id && (
            <ProtectedDownload path={`/api/v1/activities/${item.id}/fiche.pdf`}>
              <Download aria-hidden="true" />
              {strings.downloadActivityFiche}
            </ProtectedDownload>
          )}
          {item.allowed_actions.includes('edit') && (
            <Button disabled={mutationBlocked} onClick={() => setEditing(true)}>
              {!item.planned_end || item.allocation === null
                ? strings.completeProgramming
                : strings.modify}
            </Button>
          )}
          {item.allowed_actions.includes('open_amendment') && (
            <Button
              disabled={mutationBlocked}
              onClick={(event) => {
                workflowOpener.current = event.currentTarget
                setWorkflowAction('open_amendment')
              }}
            >
              {strings.openAmendment}
            </Button>
          )}
          {item.allowed_actions.includes('cancel_amendment') && (
            <Button
              disabled={mutationBlocked}
              variant="outline"
              onClick={(event) => {
                workflowOpener.current = event.currentTarget
                setWorkflowAction('cancel_amendment')
              }}
            >
              {strings.cancelAmendment}
            </Button>
          )}
          {item.allowed_actions.includes('request_withdrawal') && (
            <Button
              disabled={mutationBlocked}
              variant="outline"
              onClick={(event) => {
                workflowOpener.current = event.currentTarget
                setWorkflowAction('request_withdrawal')
              }}
            >
              {item.withdrawal
                ? strings.correctWithdrawal
                : strings.requestWithdrawal}
            </Button>
          )}
          {item.allowed_actions.includes('cancel_withdrawal') && (
            <Button
              disabled={mutationBlocked}
              variant="outline"
              onClick={(event) => {
                workflowOpener.current = event.currentTarget
                setWorkflowAction('cancel_withdrawal')
              }}
            >
              {strings.cancelWithdrawal}
            </Button>
          )}
          {item.allowed_actions.includes('request_transfer') && (
            <Button
              disabled={mutationBlocked}
              variant="outline"
              onClick={(event) => {
                workflowOpener.current = event.currentTarget
                setWorkflowAction('request_transfer')
              }}
            >
              {item.transfer
                ? strings.correctTransfer
                : strings.requestTransfer}
            </Button>
          )}
          {item.allowed_actions.includes('cancel_transfer') && (
            <Button
              disabled={mutationBlocked}
              variant="outline"
              onClick={(event) => {
                workflowOpener.current = event.currentTarget
                setWorkflowAction('cancel_transfer')
              }}
            >
              {strings.cancelTransfer}
            </Button>
          )}
          {[
            ['submit', strings.submitReview],
            ['prevalidate', strings.prevalidate],
            ['approve', strings.approve],
            ['return', strings.returnCorrection],
          ].map(
            ([action, label]) =>
              item.allowed_actions.includes(action) &&
              !(action === 'submit' && programmingIncomplete) && (
                <Button
                  key={action}
                  disabled={mutationBlocked}
                  variant={action === 'return' ? 'outline' : 'default'}
                  onClick={(event) => {
                    workflowOpener.current = event.currentTarget
                    setWorkflowAction(action)
                  }}
                >
                  {label}
                </Button>
              ),
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
        className="flex flex-wrap gap-6 border-b border-border text-sm"
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
            className={`border-b-2 py-3 ${(search.tab || 'programming') === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            {label}
          </Link>
        ))}
        {item.approved_revision_id && (
          <Link
            className="border-b-2 border-transparent py-3 text-primary"
            to={Urls.executionActivity}
            params={{ activityId: item.id }}
          >
            {strings.financeTab}
          </Link>
        )}
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
            className={`border-b-2 py-3 ${(search.tab || 'programming') === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!item.approved_revision_id && (
        <p className="text-sm text-muted-foreground">
          {strings.financeAfterApproval}
        </p>
      )}
      <div hidden={search.tab && search.tab !== 'programming'}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <div className="grid gap-6">
            <section className="rounded-panel border border-border bg-white">
              <h2 className="border-b border-border px-5 py-4">
                {strings.programming}
              </h2>
              <div
                className={`grid p-5 ${programmingIncomplete ? 'gap-4' : 'gap-6'}`}
              >
                <p>{item.description}</p>
                {programmingIncomplete && (
                  <p className="text-sm text-muted-foreground">
                    {strings.programmingToComplete}
                  </p>
                )}
              </div>
            </section>
            {!programmingIncomplete && (
              <section className="rounded-panel border border-border bg-white">
                <h2 className="border-b border-border px-5 py-4">
                  {strings.operations}
                </h2>
                <div className="overflow-x-auto p-5">
                  <table className="w-full text-sm">
                    <thead className="bg-background">
                      <tr>
                        <th className="p-3 text-left font-medium">
                          {strings.operationType}
                        </th>
                        <th className="p-3 text-right font-medium">
                          {strings.budget}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.operations.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="p-3">
                            {row.name}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.type_label}
                            </p>
                          </td>
                          <td className="p-3 text-right">
                            {formatXof(row.allocation)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
          <aside className="rounded-panel border border-border bg-white">
            <h2 className="border-b border-border px-5 py-4">
              {programmingIncomplete ? strings.draft : strings.budgetValidation}
            </h2>
            {programmingIncomplete ? (
              <p className="p-5 text-sm text-muted-foreground">
                {strings.createdBy} {creatorName}.
              </p>
            ) : (
              <dl className="grid gap-6 p-5 text-sm">
                <div>
                  <dt className="text-muted-foreground">
                    {strings.assignedTo}
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {(item.agents || [])
                      .map((agent) => agent.full_name || agent.email)
                      .join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {item.state === 'draft'
                      ? strings.createdBy
                      : item.state === 'submitted'
                        ? strings.submittedBy
                        : strings.latestDecisionBy}
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {item.state === 'draft'
                      ? creatorName
                      : item.state === 'submitted'
                        ? submitterName
                        : latestDecisionName}
                  </dd>
                </div>
                {item.state === 'submitted' && (
                  <div>
                    <dt className="text-muted-foreground">
                      {strings.validation}
                    </dt>
                    <dd className="mt-2 font-semibold">
                      {strings.awaitingPrevalidation}
                    </dd>
                  </div>
                )}
                {item.state === 'prevalidated' && (
                  <div>
                    <dt className="text-muted-foreground">
                      {strings.validation}
                    </dt>
                    <dd className="mt-2 font-semibold">
                      {strings.awaitingFinalValidation}
                    </dd>
                  </div>
                )}
                {!programmingIncomplete && (
                  <>
                    <div>
                      <dt className="text-muted-foreground">
                        {strings.budget}
                      </dt>
                      <dd className="mt-2 font-semibold">
                        {formatXof(item.allocation)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        {strings.approvedBudget}
                      </dt>
                      <dd className="mt-2 font-semibold">
                        {item.approved_allocation
                          ? formatXof(item.approved_allocation)
                          : strings.notApproved}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            )}
          </aside>
        </div>
      </div>
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
          className="rounded-panel border border-border bg-white [&>h3]:border-b [&>h3]:border-border [&>h3]:p-5 [&>h3]:font-semibold"
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
        onClose={() => {
          if (['uploading', 'checking'].includes(decisionUpload?.status)) return
          closeDecision()
        }}
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
              <p>
                {strings.formatString(
                  workflowAction === 'prevalidate'
                    ? strings.prevalidationExplanation
                    : strings.approvalExplanation,
                  item.name,
                )}
              </p>
              <p className="border-b border-border pb-4 text-sm">
                <strong>{formatXof(item.allocation)}</strong>
              </p>
              <label>
                {strings.observation}
                <textarea
                  name="reason"
                  maxLength="4000"
                  disabled={Boolean(decisionUpload)}
                  autoFocus
                />
              </label>
              <div className="grid gap-[6px] text-[0.8125rem] font-medium">
                <span>{strings.decisionAttachment}</span>
                <div
                  data-ui="decision-file"
                  className="flex min-h-10 min-w-0 items-center gap-3 rounded-control border border-strong-border bg-white px-[11px] py-[6px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
                >
                  <label
                    htmlFor="decision-attachment"
                    className={`inline-flex min-h-8 shrink-0 items-center rounded-control border border-strong-border px-3 py-1.5 text-sm font-medium text-navy ${
                      decisionUpload
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:bg-selected'
                    }`}
                  >
                    {strings.chooseFile}
                  </label>
                  <span className="min-w-0 truncate text-sm font-normal text-muted-foreground">
                    {decisionFile?.name || strings.noFileSelected}
                  </span>
                  <input
                    id="decision-attachment"
                    className="sr-only"
                    aria-label={strings.decisionAttachment}
                    name="attachment"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    disabled={Boolean(decisionUpload)}
                    onChange={(event) =>
                      setDecisionFile(event.target.files?.[0] || null)
                    }
                  />
                </div>
              </div>
            </>
          )}
          {decisionUpload?.status === 'retry' && (
            <p role="alert" className="text-danger">
              {strings.decisionSavedUploadFailed}
            </p>
          )}
          {decisionUpload?.status === 'uncertain' && (
            <p role="alert" className="text-danger">
              {strings.decisionUploadUncertain}
            </p>
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
                    {item.operations.map((operation) => (
                      <li key={operation.id}>
                        {operation.name}
                        <span>{formatXof(operation.allocation)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-[repeat(auto-fit,_minmax(min(100%,_18rem),_1fr))] gap-4 my-5">
                    <label>
                      {strings.targetStart} *
                      <input
                        name="planned_start"
                        type="date"
                        required
                        onChange={(event) =>
                          setTransferTargetYear(
                            event.target.value
                              ? Number(event.target.value.slice(0, 4))
                              : '',
                          )
                        }
                      />
                    </label>
                    <label>
                      {strings.targetEnd} *
                      <input name="planned_end" type="date" required />
                    </label>
                  </div>
                </>
              )}
              {workflowAction === 'return' &&
                user.role === 'VALIDATEUR_DEFINITIF' &&
                !item.withdrawal &&
                !item.transfer && (
                  <label>
                    {strings.requestedAmount}
                    <input
                      name="requested_amount"
                      inputMode="numeric"
                      pattern="[1-9][0-9]*"
                    />
                  </label>
                )}
            </>
          )}
          <footer data-ui="modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={['uploading', 'checking'].includes(
                decisionUpload?.status,
              )}
              onClick={closeDecision}
            >
              {strings.cancel}
            </Button>
            {decisionUpload ? (
              <Button
                type="button"
                loading={['uploading', 'checking'].includes(
                  decisionUpload.status,
                )}
                disabled={decisionUpload.status === 'uploading'}
                onClick={() =>
                  decisionUpload.status === 'retry'
                    ? uploadDecisionFile(decisionUpload.file)
                    : reconcileDecisionFile(decisionUpload)
                }
              >
                {decisionUpload.status === 'retry'
                  ? strings.retryAttachment
                  : strings.verifyAttachments}
              </Button>
            ) : (
              <Button type="submit" disabled={mutationBlocked}>
                {workflowAction === 'prevalidate'
                  ? strings.prevalidateAndSend
                  : workflowAction === 'approve'
                    ? strings.approveActivity
                    : strings.confirm}
              </Button>
            )}
          </footer>
        </BusinessForm>
      </Modal>
    </Panel>
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
  const [preview, setPreview] = useState(null)
  const [deniedDocuments, setDeniedDocuments] = useState([])
  const [uploadUncertain, setUploadUncertain] = useState(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const [withdrawing, setWithdrawing] = useState(null)
  const [replacementCursor, setReplacementCursor] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const opener = useRef(null)
  const previewOpener = useRef(null)
  const withdrawalOpener = useRef(null)
  const previewController = useRef(null)
  const previewGeneration = useRef(0)
  const previewUrlRef = useRef('')
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
          closePreview()
          setWithdrawing(null)
          setOpen(false)
        }
        throw error
      }
    },
  })
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
    enabled: Boolean(withdrawing),
  })
  const reconcileUpload = async () => {
    const result = await documents.refetch()
    if (active.current && !result.isError) setOpen(false)
  }
  const reconcileAssignment = async () => {
    setOpen(false)
    setWithdrawing(null)
    await client.invalidateQueries({ queryKey: ['planning', user.id] })
    toast.error(strings.assignmentRequired)
  }
  const upload = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: ({ file }) =>
      api.request(`/api/v1/activities/${activityId}/documents`, {
        method: 'POST',
        csrf,
        rawBody: file,
        headers: {
          'Content-Type': file.type,
          'X-File-Name': file.name,
        },
      }),
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
      toast.success(strings.saved)
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
      setWithdrawing(null)
      setReplacementCursor('')
      toast.success(strings.saved)
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
        setWithdrawing(null)
        setReplacementCursor('')
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
      toast.success(strings.saved)
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
  const releasePreview = useCallback(() => {
    previewGeneration.current += 1
    previewController.current?.abort()
    previewController.current = null
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = ''
    setPreviewUrl('')
  }, [])
  useProtectedCleanup(releasePreview)
  useEffect(() => releasePreview, [releasePreview])
  const imagePreview = useMutation({
    retry: false,
    networkMode: 'always',
    gcTime: 0,
    mutationFn: async ({ document, generation }) => {
      const controller = new AbortController()
      previewController.current = controller
      const result = await api.download(
        `/api/v1/activities/${activityId}/documents/${document.id}/preview`,
        { signal: controller.signal },
      )
      if (generation !== previewGeneration.current)
        throw new DOMException('Stale authorization', 'AbortError')
      return result.blob
    },
    onSuccess: (blob, { generation }) => {
      if (generation !== previewGeneration.current) return
      const url = URL.createObjectURL(blob)
      previewUrlRef.current = url
      setPreviewUrl(url)
    },
    onError: (error, { document, generation }) => {
      if (generation !== previewGeneration.current) return
      if (error.name === 'AbortError') return
      if (error.status === 401) onDenied()
      if ([403, 404].includes(error.status)) void denyDocument(document.id)
    },
  })
  const closePreview = () => {
    releasePreview()
    imagePreview.reset()
    setPreview(null)
  }
  const denyDocument = async (id) => {
    if (preview?.id === id) closePreview()
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
        <h3 id="activity-documents-title">{strings.attachments}</h3>
        {canUpload && (
          <Button
            variant="outline"
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
              setOpen(true)
            }}
          >
            <Plus aria-hidden="true" /> {strings.addAttachment}
          </Button>
        )}
      </div>
      {!open && uploadNotice}
      {deniedDocuments.length > 0 && (
        <p role="alert">{strings.documentUnavailable}</p>
      )}
      {sharing.isError && <p role="alert">{strings.sharingFailed}</p>}
      {documents.isPending ? (
        <LoadingPlaceholder label={common.documentsLoading} />
      ) : documents.isError ? (
        <p role="alert">Les pièces sont indisponibles.</p>
      ) : !documents.data?.data.length ? (
        <EmptyContent kind="documents" />
      ) : (
        <ul
          className="grid gap-0 p-0 list-none [&_li]:min-h-13 [&_li]:border-t [&_li]:border-t-border [&_li]:flex [&_li]:items-center [&_li]:justify-between [&_li]:gap-4"
          data-ui="planning-list"
        >
          {documents.data.data
            .filter((document) => !deniedDocuments.includes(document.id))
            .map((document) => (
              <li key={document.id}>
                <span>
                  {document.name}
                  {document.partner_shared && (
                    <small> · {strings.sharedWithPartner}</small>
                  )}
                  <small>
                    {document.withdrawal
                      ? ` · ${strings.withdrawnAttachment} · ${document.withdrawal.reason}`
                      : ` · ${strings.currentAttachment}`}
                    {document.withdrawal?.replacement_document_name &&
                      ` · ${strings.replacedBy} ${document.withdrawal.replacement_document_name}`}
                  </small>
                </span>
                <div className="flex gap-2 items-end flex-wrap">
                  {!document.withdrawal &&
                    ['image/jpeg', 'image/png'].includes(
                      document.media_type,
                    ) && (
                      <Button
                        aria-label={`${common.preview} de ${document.name}`}
                        variant="outline"
                        onClick={(event) => {
                          previewOpener.current = event.currentTarget
                          releasePreview()
                          imagePreview.reset()
                          setPreview(document)
                          const generation = previewGeneration.current
                          imagePreview.mutate({ document, generation })
                        }}
                      >
                        <Eye aria-hidden="true" /> {common.preview}
                      </Button>
                    )}
                  {!document.withdrawal && (
                    <ProtectedDownload
                      path={`/api/v1/activities/${activityId}/documents/${document.id}/download`}
                      onDenied={() => void denyDocument(document.id)}
                      scope={deliveryScope}
                    >
                      <Download aria-hidden="true" /> {common.download}
                    </ProtectedDownload>
                  )}
                  {(document.allowed_actions?.includes('share') ||
                    document.allowed_actions?.includes('unshare')) && (
                    <Button
                      variant="outline"
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
                    <Button
                      variant="outline"
                      disabled={blocked || withdraw.isPending}
                      onClick={(event) => {
                        withdrawalOpener.current = event.currentTarget
                        setReplacementCursor('')
                        setWithdrawing(document)
                      }}
                    >
                      {strings.withdrawAttachment}
                    </Button>
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
        onClose={() => setOpen(false)}
        label={strings.addAttachment}
        opener={opener}
      >
        <BusinessForm
          onSubmit={(event) => {
            event.preventDefault()
            const file =
              event.currentTarget.querySelector('input[type="file"]')
                ?.files?.[0]
            if (
              file?.size > 0 &&
              !uploadUncertain &&
              !documents.isFetching &&
              !documents.isError
            )
              return upload.mutateAsync({ file })
            return false
          }}
        >
          {uploadNotice}
          <label>
            {strings.chooseAttachment} *
            <input
              name="attachment"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required
            />
          </label>
          <div data-ui="modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
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
      <Modal
        open={Boolean(withdrawing)}
        onClose={() => {
          setWithdrawing(null)
          setReplacementCursor('')
        }}
        label={strings.withdrawAttachment}
        opener={withdrawalOpener}
      >
        {withdrawing && (
          <BusinessForm
            onSubmit={(event) => {
              event.preventDefault()
              const values = new FormData(event.currentTarget)
              return withdraw.mutateAsync({
                documentId: withdrawing.id,
                reason: values.get('reason'),
                replacementDocumentId: values.get('replacement_document_id'),
              })
            }}
          >
            <h3>
              {strings.withdrawAttachment} — {withdrawing.name}
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
                      candidate.id !== withdrawing.id &&
                      !candidate.withdrawal &&
                      candidate.uploaded_at > withdrawing.uploaded_at,
                  )
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
              </Select>
            </label>
            <div
              className="flex flex-wrap justify-end gap-3"
              aria-label="Pages des pièces corrigées"
            >
              <Button
                type="button"
                variant="outline"
                disabled={!replacementDocuments.data?.previous}
                onClick={() =>
                  setReplacementCursor(
                    cursorFrom(replacementDocuments.data?.previous),
                  )
                }
              >
                {common.previous}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!replacementDocuments.data?.next}
                onClick={() =>
                  setReplacementCursor(
                    cursorFrom(replacementDocuments.data?.next),
                  )
                }
              >
                {common.next}
              </Button>
            </div>
            <div data-ui="modal-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setWithdrawing(null)
                  setReplacementCursor('')
                }}
              >
                {strings.cancel}
              </Button>
              <Button disabled={blocked || withdraw.isPending} type="submit">
                {strings.remove}
              </Button>
            </div>
          </BusinessForm>
        )}
      </Modal>
      <Modal
        open={Boolean(preview)}
        onClose={closePreview}
        label={preview ? `${common.preview} — ${preview.name}` : common.preview}
        opener={previewOpener}
        className="w-[min(900px,_calc(100vw_-_32px))] max-w-none border border-border rounded-panel p-0 [&::backdrop]:bg-[rgb(15_23_42_/_62%)]"
      >
        {preview && (
          <div className="grid gap-4 p-6 [&_img]:w-full [&_img]:max-h-[65vh] [&_img]:object-contain [&_img]:border [&_img]:border-border [&_img]:bg-background [&_[data-ui~='modal-actions']]:justify-end">
            <h3>{preview.name}</h3>
            {imagePreview.isPending ? (
              <LoadingPlaceholder
                label={common.previewLoading}
                variant="preview"
              />
            ) : imagePreview.isError ? (
              <p role="alert">
                {imagePreview.error?.kind === 'offline'
                  ? 'Connexion indisponible. Reconnectez-vous pour afficher l’aperçu.'
                  : 'L’aperçu est indisponible.'}
              </p>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt={`${common.preview} de ${preview.name}`}
              />
            ) : null}
            <div data-ui="modal-actions">
              <Button type="button" variant="outline" onClick={closePreview}>
                {common.dismiss}
              </Button>
              <ProtectedDownload
                className={businessActionClassName}
                path={`/api/v1/activities/${activityId}/documents/${preview.id}/download`}
                onDenied={() => void denyDocument(preview.id)}
                scope={deliveryScope}
              >
                <Download aria-hidden="true" /> {common.download}
              </ProtectedDownload>
            </div>
          </div>
        )}
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
