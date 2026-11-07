import { PTAModal } from './PTAModal'
import { strings as ptaStrings } from '@/locales/fr/PTAModal'
import { readCalendar } from './calendar'
import { PlanningActivities } from './PlanningActivities'
import { PlanningSummary } from './PlanningSummary'
import { ActivityTimeline } from '@/features/audit/ActivityTimeline'
import { CategoryCreator } from './CategoryCreator'
import { Select } from '@/shared/ui/select'
import { EmptyContent, EmptyTable } from '@/shared/ui/EmptyContent'
import { businessActionClassName } from '@/shared/ui/button-variants'
import { Panel } from '@/shared/ui/layout'
import { useSessionQuery } from '@/features/auth/SessionProvider'
import { authorization } from '@/features/auth/authorization'
import { PageLoading, LoadingPlaceholder } from '@/shared/ui/PageLoading'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { Download, Eye, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { strings } from '@/locales/fr/PlanningView'
import { strings as common } from '@/locales/fr/common'
import { useAPI } from '@/shared/api/RestClientProvider'
import { addThreeMonths, formatDate, formatXof } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Modal } from '@/shared/ui/BusinessModal'
import { useProtectedCleanup } from '@/features/auth/access-verification'
import { RetryableError } from '@/shared/ui/RetryableError'
import { AccessDeniedState } from '@/features/auth/AccessDeniedState'

const labels = {
  partners: strings.partners,
  projects: strings.projects,
  pta: strings.annualPlan,
  activityNew: strings.newActivity,
  activity: strings.activityDetail,
}

function ProtectedDownload({ path, children, className, onDenied, scope }) {
  const { api } = useAPI()
  const controller = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  const download = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async () => {
      const scopeSignal = scope?.current.signal
      controller.current = new AbortController()
      const current = controller.current
      const abort = () => current.abort()
      if (scopeSignal?.aborted) abort()
      scopeSignal?.addEventListener('abort', abort, { once: true })
      try {
        const result = await api.download(path, { signal: current.signal })
        if (current.signal.aborted)
          throw new DOMException('Cancelled download', 'AbortError')
        return { ...result, deliverySignal: current.signal, scopeSignal }
      } finally {
        scopeSignal?.removeEventListener('abort', abort)
      }
    },
    onError: (error) => {
      if ([403, 404].includes(error.status)) onDenied?.()
    },
    onSuccess: ({
      blob,
      filename,
      deliverySignal,
      scopeSignal: requestScope,
    }) => {
      if (deliverySignal.aborted || requestScope?.aborted) return
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 0)
    },
  })
  return (
    <Button
      className={className}
      disabled={download.isPending}
      onClick={() => download.mutate()}
      type="button"
      variant="outline"
    >
      {children}
    </Button>
  )
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
        ...(workflowActivityId(variables.path)
          ? [client.invalidateQueries({ queryKey: ['access'] })]
          : []),
      ])
      toast.success(strings.saved)
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
    enabled: Boolean(params.activityId),
  })
  const selectedRevision = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['activity-revision', params.activityId, search.revision],
      `/activities/${params.activityId}/revisions/${search.revision}`,
      onDenied,
    ),
    enabled: Boolean(params.activityId && search.revision),
  })
  const selectedAmendment = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['activity-amendment', params.activityId, search.amendment],
      `/activities/${params.activityId}/amendments/${search.amendment}`,
      onDenied,
    ),
    enabled: Boolean(params.activityId && search.amendment),
  })
  const currentRevision = useQuery({
    ...planningQuery(
      api,
      user.id,
      [
        'activity-revision',
        params.activityId,
        activity.data?.current_revision_id,
      ],
      `/activities/${params.activityId}/revisions/${activity.data?.current_revision_id}`,
      onDenied,
    ),
    enabled: Boolean(params.activityId && activity.data?.current_revision_id),
  })
  const reconciliationBlocked = Boolean(
    workflowReconciliation &&
    (activity.data?.id !== workflowReconciliation.activityId ||
      activity.isFetching ||
      activity.isError ||
      activity.dataUpdatedAt <= workflowReconciliation.activityUpdatedAt ||
      revisions.isFetching ||
      revisions.isError ||
      revisions.dataUpdatedAt <= workflowReconciliation.revisionsUpdatedAt ||
      (activity.data.current_revision_id &&
        (currentRevision.isFetching ||
          currentRevision.isError ||
          !currentRevision.data))),
  )
  const calendarView = search.view === 'calendar'
  const list = useQuery({
    ...planningQuery(
      api,
      user.id,
      [
        'activities',
        context.data?.pta?.id,
        calendarView ? 'calendar' : search.activityCursor,
        search.q,
        search.state,
      ],
      `/ptas/${context.data?.pta?.id}/activities?${new URLSearchParams({
        ...(search.activityCursor ? { cursor: search.activityCursor } : {}),
        ...(search.q ? { q: search.q } : {}),
        ...(search.state ? { state: search.state } : {}),
      })}`,
      onDenied,
      calendarView
        ? (signal) => readCalendar(api, context.data.pta.id, search, signal)
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
    enabled: screen === 'activityNew',
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
            : [
                activity,
                revisions,
                ...(search.revision ? [selectedRevision] : []),
                ...(search.amendment ? [selectedAmendment] : []),
                ...(activity.data?.current_revision_id
                  ? [currentRevision]
                  : []),
              ]
  const loading = planningQueries.some(
    (query) => query.isFetching && query.fetchStatus !== 'idle',
  )
  const primaryPending =
    (screen === 'partners' && partners.isPending) ||
    (screen === 'projects' && projects.isPending) ||
    (screen === 'pta' && context.isPending) ||
    (screen === 'activityNew' && (types.isPending || context.isPending)) ||
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
  if (
    screen === 'activityNew' &&
    !context.data?.allowed_actions.includes('create_activity')
  )
    return (
      <Panel>
        <p>{ptaStrings.required}</p>
        <Link to="/planning" className="text-primary">
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
        <title>{`${labels[screen]} — MJL`}</title>
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
              <Link
                to="/projects/$projectId/ptas/$year"
                params={{ projectId, year: String(year) }}
              >
                {strings.cancel}
              </Link>
            </Button>
          </header>
          <ActivityForm
            onCreateType={(label) =>
              mutation.mutateAsync({
                path: '/operation-types',
                body: { label },
              })
            }
            types={types.data?.data || []}
            typeResult={types.data}
            navigate={navigate}
            pending={mutation.isPending}
            onSubmit={(body) =>
              mutation.mutateAsync(
                {
                  path: `/projects/${projectId}/ptas/${year}/activities`,
                  body,
                },
                {
                  onSuccess: (row) =>
                    navigate({
                      to: '/activities/$activityId',
                      params: { activityId: row.id },
                    }),
                },
              )
            }
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
          historyLoading={
            revisions.isFetching ||
            selectedRevision.isFetching ||
            selectedAmendment.isFetching ||
            currentRevision.isFetching
          }
          selectedRevision={selectedRevision.data}
          selectedAmendment={selectedAmendment.data}
          currentRevision={currentRevision.data}
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
              {inputLabel}
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
              {strings.name}
              <input
                name="name"
                required
                maxLength="200"
                defaultValue={editing?.name}
              />
            </label>
            <label>
              {strings.partner}
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
                        <Link to="/planning" search={{ project: row.id }}>
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
  if (!context) return <PageLoading title={strings.annualPlan} />
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/planning" className="text-xs text-muted-foreground">
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
        {context.pta?.allowed_actions?.includes('edit') && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            {ptaStrings.edit}
          </Button>
        )}
        {editing && (
          <PTAModal
            onDenied={onDenied}
            pta={context.pta}
            project={context.project}
            onClose={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        )}
        {context.allowed_actions.includes('create_activity') && (
          <Button asChild>
            <Link
              to="/projects/$projectId/ptas/$year/activities/new"
              params={{
                projectId: context.project.id,
                year: String(context.year),
              }}
            >
              <Plus size={16} />
              {strings.addActivityToPta}
            </Link>
          </Button>
        )}
      </header>
      <Panel className="flex flex-wrap items-end gap-4 border-0 bg-transparent p-0">
        <label className="w-full max-w-120">
          {strings.project}
          <Select
            value={context.project.id}
            onChange={(event) =>
              navigate({
                to: '/projects/$projectId/ptas/$year',
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
                to: '/projects/$projectId/ptas/$year',
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
          <Link to="/planning" className="text-primary">
            {ptaStrings.breadcrumb}
          </Link>
        </Panel>
      )}
      <PlanningSummary summary={context.summary} />
      {context.pta && !result ? (
        <PageLoading title={strings.annualPlan} />
      ) : (
        <PlanningActivities
          result={result}
          year={context.year}
          filters={search}
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
  const [draftBase] = useState(initial)
  const [plannedAmount, setPlannedAmount] = useState(null)
  const [start, setStart] = useState(initial?.planned_start || '')
  const [end, setEnd] = useState(initial?.planned_end || '')
  const [endWasEdited, setEndWasEdited] = useState(Boolean(initial))
  const requestKey = useRef(initial ? null : crypto.randomUUID())
  const [operations, setOperations] = useState(
    initial?.operations || [{ type_id: '', name: '', allocation: '' }],
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
  return (
    <Panel
      as={BusinessForm}
      className="border-0 bg-transparent p-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px] items-start"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending || optionsUnavailable) return
        const data = new FormData(event.currentTarget)
        return onSubmit({
          name: data.get('name'),
          description: data.get('description'),
          planned_start: start,
          planned_end: end,
          allocation: plannedAmount ?? total.toString(),
          operations: operations.map((row) => ({
            id: row.id || undefined,
            type_id: row.type_id,
            name: row.name,
            allocation: row.allocation,
          })),
          ...(initial
            ? { expected_version: draftBase.version }
            : { request_key: requestKey.current }),
        })
      }}
    >
      <div className="grid min-w-0 gap-6">
        <section className="rounded-panel border border-border bg-white">
          <h2 className="border-b border-border px-5 py-4">
            {strings.generalInformation}
          </h2>
          <div className="grid gap-6 p-5">
            <label>
              {strings.name}
              <input
                name="name"
                required
                maxLength="200"
                defaultValue={draftBase?.name}
              />
            </label>
            <label>
              {strings.description}
              <textarea
                name="description"
                required
                maxLength="4000"
                defaultValue={draftBase?.description}
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
              <input
                type="date"
                required
                value={start}
                onChange={(e) => {
                  setStart(e.target.value)
                  if (!endWasEdited) setEnd(addThreeMonths(e.target.value))
                }}
              />
            </label>
            <label>
              {strings.end}
              <input
                type="date"
                required
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value)
                  setEndWasEdited(true)
                }}
              />
            </label>
          </div>
        </section>
        <section className="rounded-panel border border-border bg-white">
          <h2 className="border-b border-border px-5 py-4">
            {strings.operationsBudget}
          </h2>
          <div className="grid gap-5 p-5">
            <label className="max-w-80">
              {strings.plannedAmount}
              <input
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                required
                value={plannedAmount ?? (total ? total.toString() : '')}
                onChange={(event) => setPlannedAmount(event.target.value)}
              />
            </label>
            <fieldset className="grid gap-4">
              <legend className="sr-only">{strings.operations}</legend>
              {operations.map((row, index) => (
                <div
                  className="grid items-end gap-4 rounded-card border border-border p-4 sm:grid-cols-2"
                  key={row.id || index}
                >
                  <h3 className="font-semibold sm:col-span-2">
                    {strings.operation} {index + 1}
                  </h3>
                  <label>
                    {strings.operationType}
                    <Select
                      aria-label={strings.formatString(
                        strings.operationTypeNumber,
                        index + 1,
                      )}
                      required
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
                  <label>
                    {strings.operationName}
                    <input
                      aria-label={strings.formatString(
                        strings.operationNameNumber,
                        index + 1,
                      )}
                      required
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
                  <label>
                    {strings.budget}
                    <input
                      aria-label={strings.formatString(
                        strings.operationBudgetNumber,
                        index + 1,
                      )}
                      inputMode="numeric"
                      required
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
                  <Button
                    type="button"
                    size="sm"
                    className="justify-self-start"
                    variant="outline"
                    disabled={operations.length === 1}
                    aria-label={strings.formatString(
                      strings.operationRemoveNumber,
                      index + 1,
                    )}
                    data-edits-form
                    onClick={() =>
                      setOperations(operations.filter((_, i) => i !== index))
                    }
                  >
                    {strings.remove}
                  </Button>
                </div>
              ))}
            </fieldset>
            <Button
              type="button"
              variant="outline"
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
            disabled={
              pending ||
              optionsUnavailable ||
              (plannedAmount !== null &&
                (!/^[1-9]\d*$/.test(plannedAmount) ||
                  BigInt(plannedAmount) !== total))
            }
          >
            <Save size={16} /> {strings.save}
          </Button>
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
                /^[1-9]\d*$/.test(plannedAmount || '') ? plannedAmount : total,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[0.8125rem] text-muted-foreground">
              {strings.operationTotal}
            </dt>
            <dd className="mt-2 font-semibold">{formatXof(total)}</dd>
          </div>
          {plannedAmount !== null &&
            /^[1-9]\d*$/.test(plannedAmount) &&
            BigInt(plannedAmount) !== total && (
              <div role="status">
                <dt>{strings.budgetDifference}</dt>
                <dd className="mt-2 text-warning">
                  {formatXof(BigInt(plannedAmount) - total)}
                </dd>
              </div>
            )}
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
  selectedRevision,
  selectedAmendment,
  currentRevision,
  onDenied,
}) {
  const [editing, setEditing] = useState(false)
  const [workflowAction, setWorkflowAction] = useState('')
  const [transferTargetYear, setTransferTargetYear] = useState(
    item.transfer?.target_year || '',
  )
  const workflowOpener = useRef(null)
  const [assignmentDraft, setAssignmentDraft] = useState(null)
  const selectedAgentIds = assignmentDraft?.ids ?? item.agent_ids
  const canAssign =
    ['AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'].includes(user.role) &&
    item.allowed_actions.includes('assign_agents')
  const { api } = useAPI()
  const search = useSearch({ strict: false })
  const agentChoices = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['agents', search.agentCursor],
      cursorPath('/assignment-agents', search.agentCursor),
      onDenied,
    ),
    enabled: canAssign && !editing,
  })
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
  const agents = agentChoices.data?.data || []
  const agentResult = agentChoices.data
  const types = typeChoices.data?.data || []
  const typeResult = typeChoices.data
  const submitWorkflow = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const submission = workflowAction === 'submit'
    const opening = workflowAction === 'open_amendment'
    const cancellation = workflowAction === 'cancel_amendment'
    const withdrawal = workflowAction === 'request_withdrawal'
    const withdrawalCancellation = workflowAction === 'cancel_withdrawal'
    const transfer = workflowAction === 'request_transfer'
    const transferCancellation = workflowAction === 'cancel_transfer'
    return mutation.mutateAsync(
      {
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
                  ...(workflowAction === 'return'
                    ? {
                        reason: data.get('reason'),
                        ...(data.get('requested_amount')
                          ? { requested_amount: data.get('requested_amount') }
                          : {}),
                      }
                    : {}),
                },
      },
      { onSuccess: () => setWorkflowAction('') },
    )
  }
  if (editing)
    return (
      <>
        {typeChoices.isError && (
          <RetryableError onRetry={() => void typeChoices.refetch()}>
            {strings.unavailablePlanning}
          </RetryableError>
        )}
        <ActivityForm
          onCreateType={(label) =>
            mutation.mutateAsync({ path: '/operation-types', body: { label } })
          }
          types={types}
          typeResult={typeResult}
          navigate={navigate}
          pending={mutationBlocked}
          optionsUnavailable={
            typeChoices.isFetching || !typeResult || typeChoices.isError
          }
          initial={item}
          onCancel={() => setEditing(false)}
          onSubmit={(body) =>
            mutation.mutateAsync(
              { path: `/activities/${item.id}`, method: 'PATCH', body },
              { onSuccess: () => setEditing(false) },
            )
          }
        />
      </>
    )
  return (
    <Panel as="div" className="border-0 bg-transparent p-0 gap-6">
      <div className="flex justify-between items-center gap-5 flex-wrap [&_form]:flex [&_form]:gap-3 [&_form]:items-end [&_form]:flex-wrap">
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">
            {item.reference}
          </p>
          <h1 className="text-2xl font-semibold text-navy">{item.name}</h1>
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
              {strings.modify}
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
              item.allowed_actions.includes(action) && (
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
      <div
        className="flex flex-wrap items-center gap-2 text-sm"
        aria-label={strings.reviewProgress}
      >
        <strong>{strings.status}: </strong>
        <span
          className={`rounded-card px-2 py-1 text-xs ${['approved', 'closed'].includes(item.state) ? 'bg-success-badge text-success' : item.state.startsWith('returned') ? 'bg-warning-soft text-warning' : 'bg-selected text-primary'}`}
        >
          {strings[item.state] || item.state}
        </span>
        {item.current_revision_id && currentRevision?.revision_number && (
          <span> · Révision {currentRevision.revision_number}</span>
        )}
      </div>
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
        {[
          ['programming', strings.programming],
          ['history', strings.historyTab],
          ['files', strings.filesTab],
        ].map(([tab, label]) => (
          <Link
            key={tab}
            to="/activities/$activityId"
            params={{ activityId: item.id }}
            search={(current) => ({ ...current, tab })}
            activeOptions={{ exact: true, includeSearch: true }}
            className={`border-b-2 py-3 ${(search.tab || 'programming') === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            {label}
          </Link>
        ))}
        {item.approved_revision_id && (
          <Link
            className="py-3 text-primary"
            to="/execution/activities/$activityId"
            params={{ activityId: item.id }}
          >
            {strings.financeTab}
          </Link>
        )}
      </nav>
      <div hidden={search.tab && search.tab !== 'programming'}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <div className="grid gap-6">
            <section className="rounded-panel border border-border bg-white">
              <h2 className="border-b border-border px-5 py-4">
                {strings.programming}
              </h2>
              <div className="grid gap-6 p-5">
                <p>{item.description}</p>
                <dl className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-[0.8125rem] text-muted-foreground">
                      {strings.start}
                    </dt>
                    <dd className="mt-2">{formatDate(item.planned_start)}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.8125rem] text-muted-foreground">
                      {strings.end}
                    </dt>
                    <dd className="mt-2">{formatDate(item.planned_end)}</dd>
                  </div>
                </dl>
              </div>
            </section>
            <Link
              to="/projects/$projectId/ptas/$year"
              params={{
                projectId: item.project_id,
                year: String(item.placement_year),
              }}
            >
              {strings.openCurrentAnnualPlan}
            </Link>
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
          </div>
          <aside className="rounded-panel border border-border bg-white">
            <h2 className="border-b border-border px-5 py-4">
              {strings.budgetValidation}
            </h2>
            <dl className="grid gap-6 p-5 text-sm">
              <div>
                <dt className="text-muted-foreground">{strings.budget}</dt>
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
            </dl>
          </aside>
        </div>
      </div>
      <div hidden={search.tab !== 'files'}>
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
      <section
        hidden={
          search.tab !== 'history' && !search.revision && !search.amendment
        }
        aria-labelledby="activity-history-title"
        className="rounded-panel border border-border bg-white [&>h3]:border-b [&>h3]:border-border [&>h3]:p-5 [&>h3]:font-semibold"
      >
        <h3 id="activity-history-title">{strings.revisionHistory}</h3>
        {!revisions?.data?.length ? (
          <EmptyContent kind="activityHistory" />
        ) : (
          <ActivityTimeline events={revisions.data} navigate={navigate} />
        )}
        {historyLoading && (
          <LoadingPlaceholder label={strings.historyLoading} />
        )}
        {selectedRevision?.snapshot && (
          <div className="border border-border rounded-card mt-4 p-4">
            <h4>Révision {selectedRevision.revision_number}</h4>
            <p>
              {selectedRevision.snapshot.partner.name} ·{' '}
              {selectedRevision.snapshot.project.reference} —{' '}
              {selectedRevision.snapshot.project.name} · PTA{' '}
              {selectedRevision.snapshot.pta.year} ·{' '}
              {selectedRevision.snapshot.activity.reference}
            </p>
            {selectedRevision.snapshot.withdrawal && (
              <p>
                <strong>{strings.withdrawalReason} :</strong>{' '}
                {selectedRevision.snapshot.withdrawal.reason}
              </p>
            )}
            {selectedRevision.snapshot.transfer && (
              <p>
                <strong>{strings.transferReason} :</strong>{' '}
                {selectedRevision.snapshot.transfer.reason} · PTA{' '}
                {selectedRevision.snapshot.transfer.source_pta.year} vers PTA{' '}
                {selectedRevision.snapshot.transfer.target_year}
              </p>
            )}
            <p>
              {selectedRevision.snapshot.name} ·{' '}
              {selectedRevision.snapshot.planned_start} au{' '}
              {selectedRevision.snapshot.planned_end}
            </p>
            <p>{selectedRevision.snapshot.description}</p>
            <p>{formatXof(selectedRevision.snapshot.allocation)}</p>
            <h5>{strings.operations}</h5>
            <ol>
              {selectedRevision.snapshot.operations.map((operation) => (
                <li key={operation.id}>
                  {operation.type_label} — {operation.name} ·{' '}
                  {formatXof(operation.allocation)}
                </li>
              ))}
            </ol>
            <p>
              Soumise par {selectedRevision.snapshot.submitter.email} le{' '}
              {selectedRevision.snapshot.submitted_at}
            </p>
            <p>
              Agents coordonnés :{' '}
              {selectedRevision.snapshot.agents
                .map((row) => row.email)
                .join(', ') || 'Aucun'}
            </p>
            <p>
              Contributeurs :{' '}
              {selectedRevision.snapshot.contributors
                .map((row) => `${row.email} (${row.role})`)
                .join(', ')}
            </p>
            <h5>Décisions</h5>
            {!selectedRevision.decisions.length ? (
              <p>Aucune décision.</p>
            ) : (
              <ol>
                {selectedRevision.decisions.map((decision) => (
                  <li key={decision.id}>
                    {strings[decision.outcome] || decision.outcome} —{' '}
                    {decision.actor_role} · {decision.decided_at}
                    {decision.reason ? ` — ${decision.reason}` : ''}
                    {decision.requested_amount
                      ? ` — ${formatXof(decision.requested_amount)}`
                      : ''}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {selectedAmendment && (
          <div className="border border-border rounded-card mt-4 p-4">
            <h4>
              {selectedAmendment.status === 'cancelled'
                ? 'Modification annulée'
                : selectedAmendment.status === 'approved'
                  ? 'Modification approuvée'
                  : 'Modification en cours'}
            </h4>
            <p>{selectedAmendment.reason}</p>
            <p>
              Ouverte par {selectedAmendment.opened_by_id} le{' '}
              {selectedAmendment.opened_at}
            </p>
            <PlanningVersion
              title={strings.candidateVersion}
              value={selectedAmendment.candidate}
            />
            {selectedAmendment.cancellation && (
              <p>
                Annulée par {selectedAmendment.cancellation.actor_id} le{' '}
                {selectedAmendment.cancellation.occurred_at} —{' '}
                {selectedAmendment.cancellation.reason}
              </p>
            )}
          </div>
        )}
        {revisions && (
          <Pager
            result={revisions}
            cursorKey="revisionCursor"
            navigate={navigate}
          />
        )}
      </section>
      {canAssign && (
        <BusinessForm
          dirty={Boolean(assignmentDraft)}
          onSubmit={(event) => {
            event.preventDefault()
            return mutation.mutateAsync(
              {
                path: `/activities/${item.id}/assignments`,
                method: 'PUT',
                body: {
                  expected_version: assignmentDraft?.version ?? item.version,
                  agent_ids: selectedAgentIds,
                },
              },
              { onSuccess: () => setAssignmentDraft(null) },
            )
          }}
        >
          <fieldset>
            <legend>{strings.coordinatedAgents}</legend>
            {agentChoices.isError && (
              <RetryableError onRetry={() => void agentChoices.refetch()}>
                {strings.unavailablePlanning}
              </RetryableError>
            )}
            {agentChoices.isPending && (
              <LoadingPlaceholder
                label={strings.coordinatedAgents}
                variant="form"
              />
            )}
            {agents.map((agent) => (
              <label key={agent.id}>
                <input
                  type="checkbox"
                  disabled={mutationBlocked}
                  name="agents"
                  value={agent.id}
                  checked={selectedAgentIds.includes(agent.id)}
                  onChange={(event) =>
                    setAssignmentDraft({
                      version: assignmentDraft?.version ?? item.version,
                      ids: event.target.checked
                        ? [...new Set([...selectedAgentIds, agent.id])]
                        : selectedAgentIds.filter(
                            (identifier) => identifier !== agent.id,
                          ),
                    })
                  }
                />{' '}
                {agent.email}
              </label>
            ))}
          </fieldset>
          <Pager
            result={agentResult}
            cursorKey="agentCursor"
            navigate={navigate}
          />
          <Button
            type="submit"
            disabled={
              mutationBlocked ||
              selectedAgentIds.length === 0 ||
              !agentResult ||
              agentChoices.isFetching ||
              agentChoices.isError
            }
          >
            {strings.saveAgents}
          </Button>
          {assignmentDraft && (
            <Button
              type="button"
              variant="outline"
              disabled={mutationBlocked}
              onClick={() => setAssignmentDraft(null)}
            >
              {strings.cancelAssignmentChanges}
            </Button>
          )}
        </BusinessForm>
      )}
      <Modal
        open={Boolean(workflowAction)}
        onClose={() => setWorkflowAction('')}
        label={strings.workflowConfirmation}
        opener={workflowOpener}
      >
        <BusinessForm
          className="grid gap-4 min-w-[min(520px,_calc(100vw_-_40px))] p-6 [&_footer]:flex [&_footer]:justify-end [&_footer]:gap-2"
          onSubmit={submitWorkflow}
        >
          <p>{strings.workflowExactRevision}</p>
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
                      {strings.targetStart}
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
                      {strings.targetEnd}
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
              onClick={() => setWorkflowAction('')}
            >
              {strings.cancel}
            </Button>
            <Button type="submit" disabled={mutationBlocked}>
              {strings.confirm}
            </Button>
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
            {strings.chooseAttachment}
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
              {strings.attachmentWithdrawalReason}
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
