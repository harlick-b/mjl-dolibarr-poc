import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { Download, Eye, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { sessionKey, sessionQuery } from '@/features/auth/auth'
import { strings } from '@/shared/i18n'
import { useAPI } from '@/shared/api/RestClientProvider'
import {
  addThreeMonths,
  formatPercentage,
  formatXof,
} from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { BusinessForm } from '@/shared/ui/BusinessForm'
import { Modal } from '@/shared/ui/BusinessModal'

const labels = {
  partners: strings.partners,
  projects: strings.projects,
  pta: strings.annualPlan,
  activityNew: strings.newActivity,
  activity: strings.activityDetail,
}

function planningQuery(api, user, key, path, onDenied) {
  return {
    queryKey: ['planning', user, ...key],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(`/api/v1${path}`, { signal })
      } catch (error) {
        if (error.status === 401 || error.status === 403) onDenied?.()
        throw error
      }
    },
    retry: false,
    gcTime: 0,
  }
}

export function PlanningView({ screen }) {
  const params = useParams({ strict: false })
  const session = useQuery(sessionQuery)
  const client = useQueryClient()
  const [blocked, setBlocked] = useState(!navigator.onLine)
  const expiry = session.data?.expires_at
  const deny = useCallback(() => {
    setBlocked(true)
    void client.cancelQueries({ queryKey: ['planning'] })
    client.removeQueries({ queryKey: ['planning'] })
    client.removeQueries({ queryKey: sessionKey, exact: true })
  }, [client])
  useEffect(() => {
    const clear = () => {
      deny()
    }
    const channel = new BroadcastChannel('mjl-auth')
    channel.onmessage = clear
    window.addEventListener('offline', clear)
    const timer = expiry
      ? setTimeout(clear, Math.max(0, Date.parse(expiry) - Date.now()))
      : undefined
    return () => {
      channel.close()
      window.removeEventListener('offline', clear)
      clearTimeout(timer)
    }
  }, [client, deny, expiry])
  useEffect(() => {
    if (session.isError || session.data?.state !== 'verified') {
      void client.cancelQueries({ queryKey: ['planning'] })
      client.removeQueries({ queryKey: ['planning'] })
    }
  }, [client, session.data?.state, session.isError])
  if (blocked)
    return (
      <section>
        <h1>{strings.accessCheck}</h1>
        <p>{strings.accessCheckPrompt}</p>
        <Button
          disabled={!navigator.onLine}
          onClick={async () => {
            await session.refetch()
            setBlocked(false)
          }}
        >
          {strings.verifyAccess}
        </Button>
      </section>
    )
  if (session.isPending) return <p role="status">{strings.checkingAccess}</p>
  if (session.error?.status === 401 || session.data?.state === 'anonymous')
    return <Navigate to="/login" replace />
  if (session.data?.state === 'pending')
    return <Navigate to="/verification" replace />
  if (session.isError) return <p role="alert">{strings.identityUnavailable}</p>
  if (session.data.user.role === 'ADMIN_PLATEFORME')
    return <p role="alert">{strings.businessRolesOnly}</p>
  return (
    <Workspace
      key={`${screen}:${params.activityId || params.projectId || ''}:${params.year || ''}`}
      screen={screen}
      session={session.data}
      onDenied={deny}
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
      if (problem.status === 401 || problem.status === 403) denyWorkspace()
      const uncertain =
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
      setError(problem.message)
    },
    onSuccess: async (_result, variables) => {
      setError('')
      await Promise.all([
        client.invalidateQueries({ queryKey: ['planning', user.id] }),
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
      if (problem.status === 401 || problem.status === 403) denyWorkspace()
      setError(problem.message)
    },
    onSuccess: async () => {
      setError('')
      await client.invalidateQueries({ queryKey: ['audit-history'] })
      toast.success(strings.ptaExported)
    },
  })
  const partners = useQuery(
    planningQuery(
      api,
      user.id,
      ['partners', search.partnerCursor],
      cursorPath('/partners', search.partnerCursor),
      onDenied,
    ),
  )
  const projects = useQuery(
    planningQuery(
      api,
      user.id,
      ['projects', search.projectCursor],
      cursorPath('/projects', search.projectCursor),
      onDenied,
    ),
  )
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
    enabled: Boolean(projectId && year),
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
      ['activity-revisions', params.activityId, search.revisionCursor],
      cursorPath(
        `/activities/${params.activityId}/revisions`,
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
        'activity-current-revision',
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
  const list = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['activities', context.data?.pta?.id, search.activityCursor],
      cursorPath(
        `/ptas/${context.data?.pta?.id}/activities`,
        search.activityCursor,
      ),
      onDenied,
    ),
    enabled: Boolean(context.data?.pta?.id),
  })
  const metrics = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['pta-metrics', context.data?.pta?.id],
      `/ptas/${context.data?.pta?.id}/metrics`,
      onDenied,
    ),
    enabled: Boolean(context.data?.pta?.id),
  })
  const agents = useQuery({
    ...planningQuery(
      api,
      user.id,
      ['agents', search.agentCursor],
      cursorPath('/assignment-agents', search.agentCursor),
      onDenied,
    ),
    enabled: ['AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'].includes(user.role),
  })
  const types = useQuery(
    planningQuery(
      api,
      user.id,
      ['operation-types', search.typeCursor],
      cursorPath('/operation-types', search.typeCursor),
      onDenied,
    ),
  )
  const loading = [
    partners,
    projects,
    context,
    activity,
    revisions,
    selectedRevision,
    selectedAmendment,
    currentRevision,
    list,
    metrics,
    types,
  ].some((query) => query.isFetching && query.fetchStatus !== 'idle')
  const submitSimple = async (event, path, field) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const form = event.currentTarget
    await mutation.mutateAsync({ path, body: { [field]: data.get(field) } })
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
  if (
    [
      partners,
      projects,
      context,
      activity,
      revisions,
      selectedRevision,
      selectedAmendment,
      currentRevision,
      list,
      metrics,
      types,
    ].some((query) => query.isError)
  )
    return <p role="alert">{strings.unavailablePlanning}</p>
  return (
    <section className="planning-stack" aria-busy={loading}>
      <Helmet>
        <title>{labels[screen]} — MJL</title>
      </Helmet>
      <header className="planning-heading">
        <div>
          <p className="eyebrow">{strings.planningTitle}</p>
          <h1>{labels[screen]}</h1>
        </div>
        <nav aria-label={strings.planningTitle}>
          <Link to="/partners">{strings.partners}</Link>
          <Link to="/projects">{strings.projects}</Link>
        </nav>
      </header>
      {error && (
        <p role="alert" className="planning-error">
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
            onSubmit={
              user.role === 'VALIDATEUR_DEFINITIF'
                ? (e) => submitSimple(e, '/partners', 'name')
                : null
            }
          />
          <ReferenceList
            title={strings.operationTypes}
            result={types.data}
            label="label"
            inputLabel={strings.operationLabel}
            cursorKey="typeCursor"
            navigate={navigate}
            onSubmit={
              user.role === 'VALIDATEUR_DEFINITIF'
                ? (e) => submitSimple(e, '/operation-types', 'label')
                : null
            }
          />
        </>
      )}
      {screen === 'projects' && (
        <Projects
          result={projects.data}
          partnerResult={partners.data}
          partners={partners.data?.data}
          canCreate={user.role === 'VALIDATEUR_DEFINITIF'}
          onSubmit={submitProject}
          navigate={navigate}
          onClose={(row) => {
            if (
              window.confirm(
                strings.formatString(strings.closeProjectPrompt, row.name),
              )
            )
              mutation.mutate({
                path: `/projects/${row.id}`,
                method: 'PATCH',
                body: { expected_version: row.version, action: 'close' },
              })
          }}
        />
      )}
      {screen === 'pta' && (
        <PTA
          context={context.data}
          metrics={metrics.data}
          result={list.data}
          navigate={navigate}
          exportPending={annualExport.isPending}
          onExport={(format) =>
            annualExport.mutate({ ptaId: context.data?.pta?.id, format })
          }
        />
      )}
      {screen === 'activityNew' && (
        <ActivityForm
          types={types.data?.data || []}
          typeResult={types.data}
          navigate={navigate}
          pending={mutation.isPending}
          onSubmit={(body) =>
            mutation.mutateAsync(
              { path: `/projects/${projectId}/ptas/${year}/activities`, body },
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
      )}
      {screen === 'activity' && activity.data && (
        <ActivityDetail
          item={activity.data}
          user={user}
          csrf={session.csrf}
          documentCursor={search.documentCursor}
          agents={agents.data?.data || []}
          agentResult={agents.data}
          types={types.data?.data || []}
          typeResult={types.data}
          navigate={navigate}
          mutation={mutation}
          mutationBlocked={mutation.isPending || reconciliationBlocked}
          revisions={revisions.data}
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
  onSubmit,
  cursorKey,
  navigate,
}) {
  const [open, setOpen] = useState(false)
  const opener = useRef(null)
  const rows = result?.data || []
  return (
    <div className="planning-card">
      <div className="planning-title">
        <h2>{title}</h2>
        {onSubmit && (
          <Button ref={opener} type="button" onClick={() => setOpen(true)}>
            <Plus size={16} /> {strings.add}
          </Button>
        )}
      </div>
      {onSubmit && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          label={strings.formatString(strings.addTo, title)}
          opener={opener}
        >
          <BusinessForm
            onSubmit={async (event) => {
              await onSubmit(event)
              setOpen(false)
            }}
          >
            <label>
              {inputLabel}
              <input name={label} required maxLength="200" />
            </label>
            <div className="planning-actions">
              <Button type="submit">{strings.add}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {strings.cancel}
              </Button>
            </div>
          </BusinessForm>
        </Modal>
      )}
      {rows.length ? (
        <ul className="planning-list">
          {rows.map((row) => (
            <li key={row.id}>{row[label]}</li>
          ))}
        </ul>
      ) : (
        <p>{strings.noItem}</p>
      )}
      <Pager result={result} cursorKey={cursorKey} navigate={navigate} />
    </div>
  )
}

function Projects({
  result,
  partnerResult,
  partners = [],
  canCreate,
  onSubmit,
  onClose,
  navigate,
}) {
  const [open, setOpen] = useState(false)
  const opener = useRef(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const rows = result?.data || []
  return (
    <div className="planning-card">
      <div className="planning-title">
        <h2>{strings.projects}</h2>
        {canCreate && (
          <Button ref={opener} type="button" onClick={() => setOpen(true)}>
            <Plus size={16} /> {strings.create}
          </Button>
        )}
      </div>
      {canCreate && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          label={strings.createProject}
          opener={opener}
        >
          <BusinessForm
            onSubmit={async (event) => {
              await onSubmit(event)
              setOpen(false)
            }}
          >
            <label>
              {strings.partner}
              <select name="partner_id" required>
                {partners.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {strings.name}
              <input name="name" required maxLength="200" />
            </label>
            <div className="planning-actions">
              <Button type="submit">{strings.create}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {strings.cancel}
              </Button>
            </div>
            <Pager
              result={partnerResult}
              cursorKey="partnerCursor"
              navigate={navigate}
            />
          </BusinessForm>
        </Modal>
      )}
      <label>
        {strings.year}
        <input
          type="number"
          min="2000"
          max="2200"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        />
      </label>
      {rows.length ? (
        <ul className="planning-list">
          {rows.map((row) => (
            <li key={row.id}>
              <strong>{row.reference}</strong> — {row.name}
              <Link
                to="/projects/$projectId/ptas/$year"
                params={{
                  projectId: row.id,
                  year: String(year),
                }}
              >
                {strings.openAnnualPlan}
              </Link>
              {row.allowed_actions.includes('close') && (
                <Button variant="outline" onClick={() => onClose(row)}>
                  {strings.close}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>{strings.noProject}</p>
      )}
      <Pager result={result} cursorKey="projectCursor" navigate={navigate} />
    </div>
  )
}

function PTA({ context, metrics, result, navigate, exportPending, onExport }) {
  if (!context) return <p role="status">Chargement…</p>
  const activities = result?.data || []
  return (
    <div className="planning-card">
      <div className="planning-title">
        <div>
          <h2>{context.project.name}</h2>
          <p>Exercice {context.year}</p>
        </div>
        <div className="planning-actions">
          {context.pta && (
            <Button
              variant="outline"
              disabled={exportPending}
              onClick={() => onExport('csv')}
            >
              <Download size={16} />
              {exportPending ? strings.exportingPta : strings.exportPtaCsv}
            </Button>
          )}
          {context.pta && (
            <Button
              variant="outline"
              disabled={exportPending}
              onClick={() => onExport('xlsx')}
            >
              <Download size={16} />
              {strings.exportPtaExcel}
            </Button>
          )}
          {context.pta && (
            <Button
              variant="outline"
              disabled={exportPending}
              onClick={() => onExport('pdf')}
            >
              <Download size={16} />
              {strings.exportPtaPdf}
            </Button>
          )}
          {context.allowed_actions.includes('create_activity') && (
            <Link
              className="planning-button"
              to="/projects/$projectId/ptas/$year/activities/new"
              params={{
                projectId: context.project.id,
                year: String(context.year),
              }}
            >
              <Plus size={16} /> {strings.newActivity}
            </Link>
          )}
        </div>
        {context.pta && (
          <Link
            className="planning-button"
            to="/execution/$ptaId"
            params={{ ptaId: context.pta.id }}
          >
            Réalisation
          </Link>
        )}
      </div>
      {metrics && (
        <section className="annual-metrics" aria-label="Indicateurs annuels">
          <article>
            <h3>{strings.physicalExecution}</h3>
            <strong>
              {formatPercentage(
                metrics.physical.closed_activities,
                metrics.physical.approved_activities,
              )}
            </strong>
            <p>
              {strings.formatString(
                strings.closedActivitiesMetric,
                metrics.physical.closed_activities,
                metrics.physical.approved_activities,
              )}
            </p>
          </article>
          <article>
            <h3>{strings.financialExecution}</h3>
            <strong>
              {formatPercentage(
                metrics.financial.closed_spending,
                metrics.financial.approved_allocation,
              )}
            </strong>
            <p>
              {strings.formatString(
                strings.closedSpendingMetric,
                formatXof(metrics.financial.closed_spending),
                formatXof(metrics.financial.approved_allocation),
              )}
            </p>
          </article>
        </section>
      )}
      {activities.length ? (
        <ul className="planning-list">
          {activities.map((row) => (
            <li key={row.id}>
              <Link
                to="/activities/$activityId"
                params={{ activityId: row.id }}
              >
                {row.reference} — {row.name}
              </Link>
              <span>{formatXof(row.allocation)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{strings.noActivity}</p>
      )}
      <Pager result={result} cursorKey="activityCursor" navigate={navigate} />
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
    <nav className="planning-actions" aria-label="Pagination">
      <Button
        type="button"
        variant="outline"
        disabled={!result.previous}
        onClick={() => move(result.previous)}
      >
        {strings.previous}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!result.next}
        onClick={() => move(result.next)}
      >
        {strings.next}
      </Button>
    </nav>
  )
}

export function ActivityForm({
  types,
  typeResult,
  navigate,
  pending,
  initial,
  onSubmit,
  onCancel,
}) {
  const [draftBase] = useState(initial)
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
        label: `Type ${operation.type_id}`,
      })
  const total = operations.reduce(
    (sum, row) =>
      sum + (/^[1-9]\d*$/.test(row.allocation) ? BigInt(row.allocation) : 0n),
    0n,
  )
  return (
    <BusinessForm
      className="planning-card planning-form"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        return onSubmit({
          name: data.get('name'),
          description: data.get('description'),
          planned_start: start,
          planned_end: end,
          allocation: total.toString(),
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
      <h2>{strings.completePlanning}</h2>
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
      <div className="planning-grid">
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
      <fieldset>
        <legend>{strings.operations}</legend>
        {operations.map((row, index) => (
          <div className="operation-row" key={row.id || index}>
            <select
              aria-label={strings.formatString(
                strings.operationTypeNumber,
                index + 1,
              )}
              required
              value={row.type_id}
              onChange={(e) =>
                setOperations(
                  operations.map((item, i) =>
                    i === index ? { ...item, type_id: e.target.value } : item,
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
            </select>
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
                    i === index ? { ...item, name: e.target.value } : item,
                  ),
                )
              }
            />
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
            <Button
              type="button"
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
        {strings.addOperation}
      </Button>
      {navigate && (
        <Pager result={typeResult} cursorKey="typeCursor" navigate={navigate} />
      )}
      <p>
        <strong>Total : {formatXof(total)}</strong>
      </p>
      <Button type="submit" disabled={pending}>
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
    </BusinessForm>
  )
}

function PlanningVersion({ title, value }) {
  return (
    <section className="planning-version" aria-label={title}>
      <h3>{title}</h3>
      <p>
        <strong>{value.name}</strong>
      </p>
      <p>{value.description}</p>
      <dl className="planning-facts">
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
      <ul className="planning-list">
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
  agents,
  agentResult,
  types,
  typeResult,
  navigate,
  mutation,
  mutationBlocked,
  revisions,
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
      <ActivityForm
        types={types}
        typeResult={typeResult}
        navigate={navigate}
        pending={mutationBlocked}
        initial={item}
        onCancel={() => setEditing(false)}
        onSubmit={(body) =>
          mutation.mutateAsync(
            { path: `/activities/${item.id}`, method: 'PATCH', body },
            { onSuccess: () => setEditing(false) },
          )
        }
      />
    )
  return (
    <div className="planning-card">
      <div className="planning-title">
        <div>
          <p className="eyebrow">{item.reference}</p>
          <h2>{item.name}</h2>
        </div>
        <div className="planning-actions">
          {item.approved_revision_id && (
            <Button asChild variant="outline">
              <a href={`/api/v1/activities/${item.id}/fiche.pdf`} download>
                <Download aria-hidden="true" />
                {strings.downloadActivityFiche}
              </a>
            </Button>
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
        <div className="planning-error" role="status">
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
        <div className="planning-version-grid">
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
      <div className="review-progress" aria-label={strings.reviewProgress}>
        <strong>{strings.status}: </strong>
        {strings[item.state] || item.state}
        {item.current_revision_id && currentRevision?.revision_number && (
          <span> · Révision {currentRevision.revision_number}</span>
        )}
      </div>
      {item.correction && (
        <div className="planning-error" role="status">
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
      <p>{item.description}</p>
      <dl className="planning-facts">
        <div>
          <dt>{strings.period}</dt>
          <dd>
            {item.planned_start} au {item.planned_end}
          </dd>
        </div>
        <div>
          <dt>{strings.budget}</dt>
          <dd>{formatXof(item.allocation)}</dd>
        </div>
        <div>
          <dt>{strings.approvedBudget}</dt>
          <dd>
            {item.approved_allocation
              ? formatXof(item.approved_allocation)
              : strings.notApproved}
          </dd>
        </div>
      </dl>
      <Link
        to="/projects/$projectId/ptas/$year"
        params={{
          projectId: item.project_id,
          year: String(item.placement_year),
        }}
      >
        {strings.openCurrentAnnualPlan}
      </Link>
      <h3>{strings.operations}</h3>
      <ul className="planning-list">
        {item.operations.map((row) => (
          <li key={row.id}>
            {row.name}
            <span>{formatXof(row.allocation)}</span>
          </li>
        ))}
      </ul>
      <ActivityDocuments
        activityId={item.id}
        user={user}
        csrf={csrf}
        cursor={documentCursor}
        navigate={navigate}
        blocked={mutationBlocked}
        onDenied={onDenied}
      />
      <section aria-labelledby="activity-history-title">
        <h3 id="activity-history-title">{strings.revisionHistory}</h3>
        {!revisions?.data?.length ? (
          <p>{strings.noRevision}</p>
        ) : (
          <ol className="review-timeline">
            {revisions.data.map((entry) => (
              <li key={entry.id}>
                {!entry.kind || entry.kind === 'revision' ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          search: (current) => ({
                            ...current,
                            revision: entry.id,
                            amendment: undefined,
                          }),
                        })
                      }
                    >
                      Révision {entry.revision_number} · {entry.submitted_at}
                    </button>
                    {entry.decisions.map((decision) => (
                      <p key={decision.id}>
                        {strings[decision.outcome] || decision.outcome}
                        {decision.reason ? ` — ${decision.reason}` : ''}
                      </p>
                    ))}
                  </>
                ) : ['withdrawal_cancel', 'transfer_cancel'].includes(
                    entry.kind,
                  ) ? (
                  <p>
                    {entry.kind === 'transfer_cancel'
                      ? 'Demande de transfert annulée'
                      : 'Demande de retrait annulée'}{' '}
                    · {entry.occurred_at} — {entry.reason}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      navigate({
                        search: (current) => ({
                          ...current,
                          amendment: entry.amendment_id,
                          revision: undefined,
                        }),
                      })
                    }
                  >
                    {entry.kind === 'amendment_open'
                      ? 'Modification ouverte'
                      : 'Modification annulée'}{' '}
                    · {entry.occurred_at} — {entry.reason}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {selectedRevision?.snapshot && (
          <div className="revision-snapshot">
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
          <div className="revision-snapshot">
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
          <Button type="submit" disabled={mutationBlocked}>
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
        <BusinessForm className="review-dialog" onSubmit={submitWorkflow}>
          <h2>{strings.workflowConfirmation}</h2>
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
                  <div className="planning-facts">
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
                  <ul className="planning-list">
                    {item.operations.map((operation) => (
                      <li key={operation.id}>
                        {operation.name}
                        <span>{formatXof(operation.allocation)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="planning-version-grid">
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
          <footer>
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
    </div>
  )
}

export function ActivityDocuments({
  activityId,
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
  const documents = useQuery(
    planningQuery(
      api,
      user.id,
      ['documents', activityId, cursor],
      cursorPath(`/activities/${activityId}/documents`, cursor),
      onDenied,
    ),
  )
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
      await client.invalidateQueries({
        queryKey: ['planning', user.id, 'documents', activityId],
      })
      setOpen(false)
      toast.success(strings.saved)
    },
    onError: async (error) => {
      if (!active.current) return
      if (error.status === 401 || error.status === 403) {
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
      await client.invalidateQueries({
        queryKey: ['planning', user.id, 'documents', activityId],
      })
      setWithdrawing(null)
      setReplacementCursor('')
      toast.success(strings.saved)
    },
    onError: async (error) => {
      if (error.status === 401 || error.status === 403) onDenied()
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
      await client.invalidateQueries({
        queryKey: ['planning', user.id, 'documents', activityId],
      })
      toast.success(strings.saved)
    },
    onError: async (error) => {
      if (error.status === 401 || error.status === 403) onDenied()
      await client.invalidateQueries({
        queryKey: ['planning', user.id, 'documents', activityId],
      })
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
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      previewUrlRef.current = url
      setPreviewUrl(url)
    },
    onError: (error) => {
      if (error.name === 'AbortError') return
      if (error.status === 401 || error.status === 403) onDenied()
    },
  })
  const closePreview = () => {
    releasePreview()
    imagePreview.reset()
    setPreview(null)
  }
  const canUpload = ['AGENT_SAISIE', 'VALIDATEUR_DEFINITIF'].includes(user.role)
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
    <section
      aria-labelledby="activity-documents-title"
      className="planning-card"
    >
      <div className="planning-title">
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
      {sharing.isError && <p role="alert">{strings.sharingFailed}</p>}
      {documents.isPending ? (
        <p role="status">Chargement…</p>
      ) : documents.isError ? (
        <p role="alert">Les pièces sont indisponibles.</p>
      ) : !documents.data?.data.length ? (
        <p>{strings.noAttachment}</p>
      ) : (
        <ul className="planning-list">
          {documents.data.data.map((document) => (
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
              <div className="planning-actions">
                {!document.withdrawal &&
                  ['image/jpeg', 'image/png'].includes(document.media_type) && (
                    <Button
                      aria-label={`${strings.preview} de ${document.name}`}
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
                      <Eye aria-hidden="true" /> {strings.preview}
                    </Button>
                  )}
                {!document.withdrawal && (
                  <a
                    href={`/api/v1/activities/${activityId}/documents/${document.id}/download`}
                    download
                  >
                    <Download aria-hidden="true" /> {strings.download}
                  </a>
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
          <div className="modal-actions">
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
              <select name="replacement_document_id" defaultValue="">
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
              </select>
            </label>
            <div
              className="modal-actions"
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
                {strings.previous}
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
                {strings.next}
              </Button>
            </div>
            <div className="modal-actions">
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
        label={
          preview ? `${strings.preview} — ${preview.name}` : strings.preview
        }
        opener={previewOpener}
        className="document-preview-dialog"
      >
        {preview && (
          <div className="document-preview">
            <h3>{preview.name}</h3>
            {imagePreview.isPending ? (
              <p role="status">Chargement de l’aperçu…</p>
            ) : imagePreview.isError ? (
              <p role="alert">
                {imagePreview.error?.kind === 'offline'
                  ? 'Connexion indisponible. Reconnectez-vous pour afficher l’aperçu.'
                  : 'L’aperçu est indisponible.'}
              </p>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt={`${strings.preview} de ${preview.name}`}
              />
            ) : null}
            <div className="modal-actions">
              <Button type="button" variant="outline" onClick={closePreview}>
                {strings.dismiss}
              </Button>
              <a
                className="planning-button"
                href={`/api/v1/activities/${activityId}/documents/${preview.id}/download`}
                download
              >
                <Download aria-hidden="true" /> {strings.download}
              </a>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
