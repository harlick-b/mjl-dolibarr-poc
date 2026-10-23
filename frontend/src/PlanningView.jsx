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
import { Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { sessionKey, sessionQuery } from './auth'
import { strings } from './i18n'
import { useAPI } from './RestClientProvider'
import { addThreeMonths, formatXof } from './planning'
import { Button } from './components/ui/button'

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
  return <Workspace screen={screen} session={session.data} onDenied={deny} />
}

function cursorPath(path, token) {
  return token ? `${path}?cursor=${encodeURIComponent(token)}` : path
}

function cursorFrom(link) {
  return link ? new URL(link).searchParams.get('cursor') || '' : ''
}

function Workspace({ screen, session, onDenied }) {
  const { api } = useAPI()
  const client = useQueryClient()
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const user = session.user
  const [error, setError] = useState('')
  const authGeneration = useRef(0)
  const mutationController = useRef(null)
  const denyWorkspace = useCallback(() => {
    authGeneration.current += 1
    mutationController.current?.abort()
    onDenied()
  }, [onDenied])
  useEffect(
    () => () => {
      authGeneration.current += 1
      mutationController.current?.abort()
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
    onError: (problem) => {
      if (problem.name === 'AbortError') return
      if (problem.status === 401 || problem.status === 403) denyWorkspace()
      setError(problem.message)
    },
    onSuccess: async () => {
      setError('')
      await client.invalidateQueries({ queryKey: ['planning', user.id] })
      toast.success(strings.saved)
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
  const loading = [partners, projects, context, activity, list, types].some(
    (query) => query.isFetching && query.fetchStatus !== 'idle',
  )
  const submitSimple = (event, path, field) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    mutation.mutate({ path, body: { [field]: data.get(field) } })
    event.currentTarget.reset()
  }
  const submitProject = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    mutation.mutate({
      path: '/projects',
      body: { name: data.get('name'), partner_id: data.get('partner_id') },
    })
  }
  if (
    [partners, projects, context, activity, list, types].some(
      (query) => query.isError,
    )
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
        <PTA context={context.data} result={list.data} navigate={navigate} />
      )}
      {screen === 'activityNew' && (
        <ActivityForm
          types={types.data?.data || []}
          typeResult={types.data}
          navigate={navigate}
          pending={mutation.isPending}
          onSubmit={(body) =>
            mutation.mutate(
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
          agents={agents.data?.data || []}
          agentResult={agents.data}
          types={types.data?.data || []}
          typeResult={types.data}
          navigate={navigate}
          mutation={mutation}
        />
      )}
    </section>
  )
}

function Modal({ open, onClose, label, children, opener }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={onClose}
      onClose={() => {
        onClose()
        opener.current?.focus()
      }}
    >
      {children}
    </dialog>
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
          <form
            onSubmit={(event) => {
              onSubmit(event)
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
          </form>
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
          <form
            onSubmit={(event) => {
              onSubmit(event)
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
          </form>
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

function PTA({ context, result, navigate }) {
  if (!context) return <p role="status">Chargement…</p>
  const activities = result?.data || []
  return (
    <div className="planning-card">
      <div className="planning-title">
        <div>
          <h2>{context.project.name}</h2>
          <p>Exercice {context.year}</p>
        </div>
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
}) {
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
    <form
      className="planning-card planning-form"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onSubmit({
          name: data.get('name'),
          description: data.get('description'),
          planned_start: start,
          planned_end: end,
          allocation: total.toString(),
          operations: operations.map((row) => ({
            ...row,
            id: row.id || undefined,
          })),
          ...(initial
            ? { expected_version: initial.version }
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
          defaultValue={initial?.name}
        />
      </label>
      <label>
        {strings.description}
        <textarea
          name="description"
          required
          maxLength="4000"
          defaultValue={initial?.description}
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
    </form>
  )
}

function ActivityDetail({
  item,
  user,
  agents,
  agentResult,
  types,
  typeResult,
  navigate,
  mutation,
}) {
  const [editing, setEditing] = useState(false)
  const [selectedAgentIds, setSelectedAgentIds] = useState(item.agent_ids)
  const canAssign = ['AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'].includes(
    user.role,
  )
  if (editing)
    return (
      <ActivityForm
        types={types}
        typeResult={typeResult}
        navigate={navigate}
        pending={mutation.isPending}
        initial={item}
        onSubmit={(body) =>
          mutation.mutate(
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
        {item.allowed_actions.includes('edit') && (
          <Button onClick={() => setEditing(true)}>{strings.modify}</Button>
        )}
      </div>
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
      </dl>
      <h3>{strings.operations}</h3>
      <ul className="planning-list">
        {item.operations.map((row) => (
          <li key={row.id}>
            {row.name}
            <span>{formatXof(row.allocation)}</span>
          </li>
        ))}
      </ul>
      {canAssign && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate({
              path: `/activities/${item.id}/assignments`,
              method: 'PUT',
              body: {
                expected_version: item.version,
                agent_ids: selectedAgentIds,
              },
            })
          }}
        >
          <fieldset>
            <legend>{strings.coordinatedAgents}</legend>
            {agents.map((agent) => (
              <label key={agent.id}>
                <input
                  type="checkbox"
                  name="agents"
                  value={agent.id}
                  checked={selectedAgentIds.includes(agent.id)}
                  onChange={(event) =>
                    setSelectedAgentIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, agent.id])]
                        : current.filter(
                            (identifier) => identifier !== agent.id,
                          ),
                    )
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
          <Button type="submit">{strings.saveAgents}</Button>
        </form>
      )}
    </div>
  )
}
