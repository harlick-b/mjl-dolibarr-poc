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
import {
  CheckCircle2,
  CircleDollarSign,
  Play,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { sessionKey, sessionQuery } from './auth'
import { Button } from './components/ui/button'
import { formatXof } from './planning'
import { cursorFrom } from './pagination'
import { useAPI } from './RestClientProvider'

function cursorPath(path, cursor) {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path
}

function executionQuery(api, userId, key, path, onDenied) {
  return {
    queryKey: ['execution', userId, ...key],
    queryFn: async ({ signal }) => {
      try {
        return await api.request(`/api/v1${path}`, { signal })
      } catch (error) {
        if (error.status === 401 || error.status === 403) onDenied()
        throw error
      }
    },
    retry: false,
    gcTime: 0,
  }
}

export function ExecutionView({ screen }) {
  const session = useQuery(sessionQuery)
  const client = useQueryClient()
  const [blocked, setBlocked] = useState(!navigator.onLine)
  const deny = useCallback(() => {
    setBlocked(true)
    void client.cancelQueries({ queryKey: ['execution'] })
    client.removeQueries({ queryKey: ['execution'] })
    client.getMutationCache().clear()
    client.removeQueries({ queryKey: sessionKey, exact: true })
  }, [client])
  useEffect(() => {
    const clear = () => deny()
    const channel = new BroadcastChannel('mjl-auth')
    channel.onmessage = clear
    window.addEventListener('offline', clear)
    const timer = session.data?.expires_at
      ? setTimeout(
          clear,
          Math.max(0, Date.parse(session.data.expires_at) - Date.now()),
        )
      : undefined
    return () => {
      channel.close()
      window.removeEventListener('offline', clear)
      clearTimeout(timer)
    }
  }, [deny, session.data?.expires_at])
  if (blocked)
    return (
      <section>
        <h1>Vérification de l’accès</h1>
        <p>Reconnectez-vous au service pour continuer.</p>
        <Button
          disabled={!navigator.onLine}
          onClick={async () => {
            await session.refetch()
            setBlocked(false)
          }}
        >
          Vérifier l’accès
        </Button>
      </section>
    )
  if (session.isPending) return <p role="status">Vérification de l’accès…</p>
  if (session.error?.status === 401 || session.data?.state === 'anonymous')
    return <Navigate to="/login" replace />
  if (session.data?.state === 'pending')
    return <Navigate to="/verification" replace />
  if (session.isError) return <p role="alert">L’identité est indisponible.</p>
  if (session.data.user.role === 'ADMIN_PLATEFORME')
    return <p role="alert">Cet espace est réservé aux rôles métier.</p>
  return (
    <ExecutionWorkspace
      screen={screen}
      session={session.data}
      onDenied={deny}
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
  const list = useQuery({
    ...executionQuery(
      api,
      session.user.id,
      ['list', params.ptaId, search.cursor],
      cursorPath(`/ptas/${params.ptaId}/execution`, search.cursor),
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
        client.invalidateQueries({ queryKey: ['planning', session.user.id] }),
      ])
      setError('')
      toast.success('Réalisation enregistrée.')
    },
    onError: async (problem) => {
      if (problem.name === 'AbortError') return
      if (problem.status === 401 || problem.status === 403) onDenied()
      if (
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
      setError(problem.message)
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
      ])
      if (
        variables.path.endsWith('/cancellation') &&
        variables.path.startsWith('/disbursement-requests')
      )
        await navigate({
          search: (current) => ({ ...current, financeRequest: '' }),
        })
      if (
        variables.path.endsWith('/cancellation') &&
        variables.path.startsWith('/virement-requests')
      )
        await navigate({
          search: (current) => ({ ...current, virementRequest: '' }),
        })
      setError('')
      toast.success('Suivi financier mis à jour.')
    },
    onError: async (problem) => {
      if (problem.name === 'AbortError') return
      if (problem.status === 401 || problem.status === 403) onDenied()
      if (
        problem.status === 409 ||
        ['network', 'malformed'].includes(problem.kind)
      )
        await Promise.all([
          client.invalidateQueries({
            queryKey: ['execution', session.user.id],
          }),
          client.invalidateQueries({ queryKey: ['planning', session.user.id] }),
        ])
      setError(problem.message)
    },
  })
  const relevant =
    screen === 'list'
      ? [list]
      : [
          detail,
          history,
          finance,
          virements,
          ...(search.financeRequest ? [selectedFinance] : []),
          ...(virementRequestId ? [selectedVirement] : []),
        ]
  if (relevant.some((query) => query.isError))
    return <p role="alert">Les données de réalisation sont indisponibles.</p>
  if (relevant.some((query) => query.isPending))
    return <p role="status">Chargement des réalisations…</p>
  if (screen === 'list')
    return (
      <ExecutionList
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
    )
  return (
    <ExecutionDetail
      detail={detail.data}
      history={history.data}
      finance={finance.data}
      selectedFinance={selectedFinance.data}
      virements={virements.data}
      selectedVirement={selectedVirement.data}
      role={session.user.role}
      financeHistoryPage={Boolean(search.financeCursor)}
      virementHistoryPage={Boolean(search.virementCursor)}
      virementSelectedBySearch={Boolean(search.virementRequest)}
      error={error}
      pending={
        mutation.isPending ||
        financeMutation.isPending ||
        detail.isFetching ||
        history.isFetching ||
        finance.isFetching ||
        selectedFinance.isFetching ||
        virements.isFetching ||
        selectedVirement.isFetching
      }
      mutate={(operationId, body) => mutation.mutate({ operationId, body })}
      mutateFinance={(path, body) => financeMutation.mutate({ path, body })}
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
    />
  )
}

function ExecutionList({ result, onPage }) {
  const rows = result?.data || []
  return (
    <section className="planning-stack">
      <Helmet>
        <title>Réalisation des activités — MJL</title>
      </Helmet>
      <header className="planning-heading">
        <div>
          <p className="eyebrow">Réalisation d’activités</p>
          <h1>Activités approuvées</h1>
        </div>
      </header>
      <div className="execution-list">
        {rows.length ? (
          rows.map((row) => (
            <article className="planning-card" key={row.id}>
              <div className="planning-title">
                <div>
                  <p className="eyebrow">{row.reference}</p>
                  <h2>{row.name}</h2>
                </div>
                <Link
                  className="planning-button"
                  to="/execution/activities/$activityId"
                  params={{ activityId: row.id }}
                >
                  Ouvrir
                </Link>
              </div>
              <p>
                {row.completed_operations}/{row.operation_count} Opérations
                terminées ·{' '}
                {row.spending_total === null
                  ? 'Dépenses incomplètes'
                  : formatXof(row.spending_total)}
              </p>
              {row.execution_paused && (
                <p className="planning-error">Réalisation suspendue.</p>
              )}
            </article>
          ))
        ) : (
          <p>Aucune activité approuvée à réaliser.</p>
        )}
      </div>
      {(result?.previous || result?.next) && (
        <nav className="planning-actions" aria-label="Pagination">
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
    </section>
  )
}

function ExecutionDetail({
  detail,
  history,
  finance,
  selectedFinance,
  virements,
  selectedVirement,
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
  onVirementPage,
  onVirementSelect,
}) {
  const unavailableLabels = {
    project_inactive: 'le Projet est inactif',
    activity_withdrawn: 'l’Activité a été retirée',
    amendment_pending: 'une modification est en cours',
    withdrawal_pending: 'une demande de retrait est en cours',
    transfer_pending: 'un transfert est en cours',
    activity_not_approved: 'l’Activité n’est pas approuvée',
    reviewer_read_only: 'votre rôle permet uniquement la consultation',
    before_planned_start: 'la date de début planifiée n’est pas atteinte',
    disbursement_frozen: 'une autorisation de décaissement est en cours',
  }
  const historyLabels = {
    'operation.execution_started': 'Opération démarrée',
    'operation.execution_recorded': 'Réalisation enregistrée',
    'operation.execution_corrected': 'Réalisation corrigée',
  }
  return (
    <section className="planning-stack">
      <Helmet>
        <title>{detail.name} — Réalisation MJL</title>
      </Helmet>
      <header className="planning-heading">
        <div>
          <p className="eyebrow">{detail.reference}</p>
          <h1>{detail.name}</h1>
        </div>
        <Link to="/execution/$ptaId" params={{ ptaId: detail.pta_id }}>
          Retour aux réalisations
        </Link>
      </header>
      {error && (
        <p role="alert" className="planning-error">
          {error}
        </p>
      )}
      {detail.execution_paused && (
        <p role="status" className="review-progress">
          La réalisation est suspendue :{' '}
          {unavailableLabels[detail.pause_reason] || detail.pause_reason}.
        </p>
      )}
      {!detail.execution_paused && detail.mutation_unavailable_reason && (
        <p role="status" className="review-progress">
          Modification indisponible :{' '}
          {unavailableLabels[detail.mutation_unavailable_reason] ||
            detail.mutation_unavailable_reason}
          .
        </p>
      )}
      <dl className="planning-card execution-summary">
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
      </dl>
      <div className="execution-list">
        {detail.operations.map((operation) => (
          <OperationCard
            key={`${operation.id}:${operation.actual_spent}:${operation.execution_completed}`}
            activity={detail}
            operation={operation}
            pending={pending}
            mutate={mutate}
          />
        ))}
      </div>
      <DisbursementSection
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
      <VirementSection
        detail={detail}
        result={virements}
        selected={selectedVirement}
        selectedBySearch={virementSelectedBySearch}
        role={role}
        historicalPage={virementHistoryPage}
        pending={pending}
        mutate={mutateFinance}
        onPage={onVirementPage}
        onSelect={onVirementSelect}
      />
      <section
        className="planning-card"
        aria-labelledby="execution-history-title"
      >
        <h2 id="execution-history-title">Historique de réalisation</h2>
        {history.data.length ? (
          <ol className="review-timeline">
            {history.data.map((event) => (
              <li key={event.id}>
                <strong>{historyLabels[event.action] || event.action}</strong>{' '}
                <time dateTime={event.occurred_at}>{event.occurred_at}</time>
                {event.correction_reason && <p>{event.correction_reason}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p>Aucun événement de réalisation.</p>
        )}
        {(history.previous || history.next) && (
          <nav
            className="planning-actions"
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
      </section>
    </section>
  )
}

function DisbursementSection({
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
  const requests = result?.data || []
  const active = requests.find((request) => request.state !== 'cancelled')
  const current = selected || active
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
    !selected &&
    detail.works_completed &&
    Number(detail.spending_total) > 0
  const version = current?.activity_version || detail.version
  return (
    <section className="planning-card" aria-labelledby="disbursement-title">
      <div className="planning-title">
        <div>
          <p className="eyebrow">Suivi administratif</p>
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
          <p className="review-progress">
            Montant soumis : <strong>{formatXof(current.amount)}</strong>. Les
            {current.state === 'cancelled'
              ? ' dépenses et les modifications ont été libérées à l’annulation de cette demande.'
              : ' dépenses et les modifications de planification restent figées '}
            {current.state === 'approved'
              ? 'définitivement pour cette première version.'
              : current.state === 'cancelled'
                ? ''
                : 'tant que cette demande n’est pas annulée.'}
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
          <ol className="review-timeline">
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
          <div className="planning-actions">
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
            <form
              className="planning-form"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const reason = String(data.get('reason') || '')
                const cancellation =
                  event.nativeEvent.submitter?.value === 'cancel'
                mutate(
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
              <div className="planning-actions">
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
            </form>
          )}
        </>
      ) : role === 'AGENT_SAISIE' && !historicalPage ? (
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
      )}
      {requests.length > 0 && (
        <details>
          <summary>Historique des demandes ({result.count})</summary>
          <ol className="review-timeline">
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
              className="planning-actions"
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
    </section>
  )
}

function VirementSection({
  detail,
  result,
  selected,
  selectedBySearch,
  role,
  historicalPage,
  pending,
  mutate,
  onPage,
  onSelect,
}) {
  const requests = result?.data || []
  const current = selected
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
    <section className="planning-card" aria-labelledby="virement-title">
      <div className="planning-title">
        <div>
          <p className="eyebrow">Suivi administratif</p>
          <h2 id="virement-title">Autorisation de virement</h2>
        </div>
        {current && <strong>{stateLabels[current.state]}</strong>}
      </div>
      <p>
        Cette autorisation porte sur le montant de décaissement déjà approuvé.
        Elle ne confirme pas qu’un virement externe a été effectué.
      </p>
      {current ? (
        <>
          <p className="review-progress">
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
          <ol className="review-timeline">
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
          <div className="planning-actions">
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
          {(current.allowed_actions.includes('return') ||
            current.allowed_actions.includes('cancel')) && (
            <form
              className="planning-form"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const reason = String(data.get('reason') || '')
                const cancellation =
                  event.nativeEvent.submitter?.value === 'cancel'
                mutate(
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
              <div className="planning-actions">
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
            </form>
          )}
        </>
      ) : role === 'AGENT_SAISIE' && !historicalPage ? (
        <Button
          disabled={!context.can_submit || pending || !navigator.onLine}
          onClick={() =>
            mutate('/virement-requests', {
              expected_version: detail.version,
              expected_disbursement_request_id: context.disbursement_request_id,
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
      )}
      {requests.length > 0 && (
        <details>
          <summary>Historique des demandes ({result.count})</summary>
          <ol className="review-timeline">
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
              className="planning-actions"
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
    </section>
  )
}

function OperationCard({ activity, operation, pending, mutate }) {
  const correction =
    operation.actual_spent !== null ||
    operation.execution_observation ||
    operation.execution_completed
  return (
    <article className="planning-card execution-operation">
      <div className="planning-title">
        <div>
          <p className="eyebrow">{operation.type_label}</p>
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
        <form
          className="planning-form"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const amount = String(data.get('actual_spent') || '')
            const body = {
              action: 'record',
              expected_version: activity.version,
              expected_approved_revision_id: activity.approved_revision_id,
              actual_spent: amount || null,
              execution_completed: data.get('execution_completed') === 'on',
              execution_observation: String(
                data.get('execution_observation') || '',
              ),
            }
            const reason = String(data.get('correction_reason') || '')
            if (reason) body.correction_reason = reason
            mutate(operation.id, body)
          }}
        >
          <div className="planning-grid">
            <label>
              Montant dépensé (XOF)
              <input
                name="actual_spent"
                inputMode="numeric"
                pattern="(0|[1-9][0-9]*)"
                defaultValue={operation.actual_spent ?? ''}
              />
            </label>
            <label className="execution-check">
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
        </form>
      )}
    </article>
  )
}
