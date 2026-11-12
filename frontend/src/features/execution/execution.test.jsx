import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router.jsx'
import { cursorFrom } from '@/shared/lib/pagination'
import { ExecutionView } from './ExecutionView'

function makeExecutionRouter(history) {
  return makeRouter(history, {
    execution: (screen) => <ExecutionView screen={screen} />,
  })
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete HTMLDialogElement.prototype.showModal
  delete HTMLDialogElement.prototype.close
})

function detail({ started = false, completed = false } = {}) {
  return {
    id: 'activity-1',
    pta_id: 'pta-1',
    project_id: 'project-1',
    project_name: 'Justice des mineurs',
    partner_name: 'UNICEF',
    pta_name: 'PTA 2026',
    approved_revision_number: 1,
    agents: ['Agent de test'],
    reference: 'ACT-000001',
    name: 'Former les équipes',
    description: 'Renforcer les pratiques des équipes de terrain.',
    planned_start: '2026-10-28',
    planned_end: '2026-12-31',
    approved_allocation: '100000',
    approved_revision_id: '11111111-1111-4111-8111-111111111111',
    version: started ? (completed ? 7 : 6) : 5,
    state: 'approved',
    closure: null,
    closure_blockers: ['execution_incomplete'],
    execution_paused: false,
    pause_reason: null,
    completed_operations: completed ? 1 : 0,
    operation_count: 1,
    works_completed: completed,
    spending_total: completed ? '100000' : null,
    balance: completed ? '0' : null,
    required_reversement: null,
    realization_status: completed
      ? 'completed_pending_validation'
      : started
        ? 'in_progress'
        : 'not_started',
    virement_context: {
      disbursement_request_id: null,
      amount: null,
      current_request_id: null,
      current_state: null,
      can_submit: false,
      unavailable_reason: 'disbursement_required',
    },
    allowed_actions: ['read'],
    operations: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        type_id: 'type-1',
        type_label: 'Formation',
        name: 'Préparer la session',
        approved_allocation: '100000',
        position: 1,
        execution_started_at: started ? '2026-10-28T09:00:00Z' : null,
        execution_completed: completed,
        actual_spent: completed ? '100000' : null,
        execution_observation: completed ? 'Session terminée.' : '',
        variance: completed ? '0' : null,
        allowed_actions: ['record'],
      },
    ],
  }
}

test('legacy execution detail URLs enter the canonical activity shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (String(url).includes('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'agent@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      return new Response(JSON.stringify({}))
    }),
  )
  const router = makeRouter(
    createMemoryHistory({
      initialEntries: [
        '/execution/activities/activity-1?financeRequest=request-1&financeCursor=older',
      ],
    }),
    { planning: () => <p>Canonical activity shell</p> },
  )
  render(<App router={router} />)

  expect(await screen.findByText('Canonical activity shell')).toBeVisible()
  expect(router.state.location.pathname).toBe('/activities/activity-1')
  expect(router.state.location.search).toMatchObject({
    tab: 'finance',
    origin: 'execution',
    financeRequest: 'request-1',
    financeCursor: 'older',
  })
})

test('activity tabs keep one header and preserve the execution sidebar context', async () => {
  const user = userEvent.setup()
  const createObjectURL = vi.fn(() => 'blob:activity-fiche')
  const revokeObjectURL = vi.fn()
  const anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
  const NativeURL = URL
  class DownloadURL extends NativeURL {}
  DownloadURL.createObjectURL = createObjectURL
  DownloadURL.revokeObjectURL = revokeObjectURL
  vi.stubGlobal('URL', DownloadURL)
  const execution = detail({ started: true, completed: true })
  const activity = {
    ...execution,
    allocation: '100000',
    placement_year: 2026,
    agents: [
      {
        id: 'agent',
        email: 'agent@example.test',
        full_name: 'Agent de test',
      },
    ],
    agent_ids: ['agent'],
    operations: execution.operations.map((operation) => ({
      ...operation,
      allocation: operation.approved_allocation,
    })),
    approved: {
      name: execution.name,
      description: execution.description,
      planned_start: execution.planned_start,
      planned_end: execution.planned_end,
      allocation: execution.approved_allocation,
      operations: execution.operations,
    },
    candidate: null,
    amendment: null,
    withdrawal: null,
    transfer: null,
    correction: null,
    allowed_actions: [
      'read',
      'open_amendment',
      'request_withdrawal',
      'request_transfer',
    ],
  }
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
    pending: [],
    allowed_actions: [],
    activity_version: execution.version,
    approved_revision_id: execution.approved_revision_id,
  }
  const historicalRequest = {
    id: 'finance-returned',
    amount: '100000',
    state: 'returned',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read'],
    activity_version: execution.version,
  }
  const requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      requests.push(path)
      if (path.includes('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'agent@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (path.endsWith('/activities/activity-1/fiche.pdf'))
        return new Response('pdf', {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="ACT-000001.pdf"',
          },
        })
      if (path.endsWith('/activities/activity-1/execution'))
        return new Response(JSON.stringify(execution))
      if (path.endsWith('/activities/activity-1'))
        return new Response(JSON.stringify(activity))
      if (path.endsWith('/disbursement-requests/finance-returned'))
        return new Response(JSON.stringify(historicalRequest))
      if (path.includes('/disbursement-requests?cursor=older'))
        return new Response(
          JSON.stringify({
            ...empty,
            count: 1,
            data: [historicalRequest],
            previous: '/api/v1/activities/activity-1/disbursement-requests',
          }),
        )
      if (path.endsWith('/disbursement-requests'))
        return new Response(
          JSON.stringify({
            ...empty,
            count: 1,
            data: [historicalRequest],
            next: '/api/v1/activities/activity-1/disbursement-requests?cursor=older',
          }),
        )
      return new Response(JSON.stringify(empty))
    }),
  )
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: [
            '/activities/activity-1?tab=finance&origin=execution',
          ],
        }),
      )}
    />,
  )

  const header = await screen.findByRole(
    'heading',
    { name: 'Former les équipes' },
    { timeout: 5000 },
  )
  expect(screen.getByRole('link', { name: 'Réalisation' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(await screen.findByText('Budget autorisé actuel')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Demander une modification' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Retirer l’activité' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Transférer vers un autre PTA' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Fiche récapitulative' }))
  await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce())
  expect(
    screen.queryByRole('dialog', { name: 'Fiche récapitulative' }),
  ).not.toBeInTheDocument()
  expect(createObjectURL).toHaveBeenCalledOnce()
  await waitFor(() =>
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:activity-fiche'),
  )
  await user.click(screen.getByText('Historique des demandes (1)'))
  await user.click(
    screen.getByRole('button', { name: /Retournée pour correction/ }),
  )
  await waitFor(() =>
    expect(
      requests.some((path) =>
        path.endsWith('/disbursement-requests/finance-returned'),
      ),
    ).toBe(true),
  )
  await user.click(screen.getByRole('button', { name: 'Suivant', exact: true }))
  await waitFor(() =>
    expect(
      requests.some((path) =>
        path.includes('/disbursement-requests?cursor=older'),
      ),
    ).toBe(true),
  )

  await user.click(screen.getByRole('link', { name: 'Programmation' }))
  expect(screen.getByRole('heading', { name: 'Former les équipes' })).toBe(
    header,
  )
  expect(screen.getByRole('link', { name: 'Réalisation' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(screen.queryByText('Budget autorisé actuel')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Demander une modification' }),
  ).toBeVisible()

  await user.click(screen.getByRole('link', { name: 'Réalisation & finances' }))
  expect(screen.getByRole('heading', { name: 'Former les équipes' })).toBe(
    header,
  )
  expect(await screen.findByText('Budget autorisé actuel')).toBeVisible()
})

test('agent records operations before the collapsed financial workflow', async () => {
  const user = userEvent.setup()
  let current = detail()
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
    pending: [],
    allowed_actions: [],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'agent@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return new Response(JSON.stringify(current))
      return new Response(JSON.stringify(empty))
    }),
  )
  const router = makeExecutionRouter(
    createMemoryHistory({
      initialEntries: ['/execution/activities/activity-1'],
    }),
  )
  render(<App router={router} />)

  expect(await screen.findByText('Budget autorisé actuel')).toBeVisible()
  expect(screen.getByText('Montant dépensé · partiel')).toBeVisible()
  expect(screen.getByText('Montant à reverser')).toBeVisible()
  expect(screen.getAllByText('Non renseigné')).toHaveLength(3)
  expect(screen.getByText('Réalisation', { selector: 'dt' })).not.toBeVisible()
  expect(screen.getByText('Solde non dépensé')).not.toBeVisible()
  expect(screen.getByText('0 / 1 dépense renseignée')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Renseigner Préparer la session' }),
  ).toBeVisible()

  const administration = within(
    screen.getByRole('region', { name: 'Suivi administratif' }),
  )
  expect(
    administration.getByText('Réalisation en cours', { exact: true }),
  ).toBeVisible()
  expect(
    administration.getAllByText('Autorisation de décaissement', {
      exact: true,
    })[0],
  ).toBeVisible()
  const disbursementTitle = administration.getAllByText(
    'Autorisation de décaissement',
    { exact: true },
  )[0]
  await user.click(disbursementTitle.closest('summary'))
  expect(
    administration.getAllByText('Étapes précédentes non terminées.')[0],
  ).toBeVisible()
  expect(
    administration.queryByRole('button', { name: /Soumettre/ }),
  ).not.toBeInTheDocument()

  current = {
    ...current,
    spending_total: '0',
    operations: current.operations.map((operation) => ({
      ...operation,
      actual_spent: '0',
    })),
  }
  await act(async () =>
    router.options.context.queryClient.setQueryData(
      ['execution', 'agent', 'activity', 'activity-1'],
      current,
    ),
  )
  expect(
    administration.getAllByText('Autorisation de décaissement', {
      exact: true,
    })[0],
  ).toBeVisible()
  expect(administration.queryByText('Déclaration sans dépense')).toBeNull()
})

test('execution detail stays in page loading until all first-view reads are ready', async () => {
  let resolveFinance
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
    pending: [],
    allowed_actions: [],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'agent@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return new Response(JSON.stringify(detail({ started: true })))
      if (path.includes('/disbursement-requests'))
        return new Promise((resolve) => {
          resolveFinance = resolve
        })
      return new Response(JSON.stringify(empty))
    }),
  )
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )

  await waitFor(() => expect(resolveFinance).toBeTypeOf('function'))
  expect(
    screen.getByRole('status', {
      name: 'Chargement : Détail de la réalisation',
    }),
  ).toBeVisible()
  expect(screen.queryByText('Budget autorisé actuel')).toBeNull()

  resolveFinance(new Response(JSON.stringify(empty)))
  expect(await screen.findByText('Budget autorisé actuel')).toBeVisible()
})

test('execution explorer searches assigned Agents and shows readable active filters', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      let body = {
        object: 'list',
        count: 0,
        data: [],
        next: null,
        previous: null,
      }
      if (path.includes('/auth/session'))
        body = {
          state: 'verified',
          csrf: 'csrf',
          user: {
            id: 'validator',
            email: 'validator@example.test',
            role: 'VALIDATEUR_DEFINITIF',
          },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        }
      else if (path.includes('/execution/agents'))
        body = {
          ...body,
          count: 1,
          data: [{ id: 'agent-1', label: 'Agent de test' }],
        }
      else if (path.includes('/ptas/pta-1/execution'))
        body = {
          ...body,
          count: 1,
          data: [
            {
              ...detail({ started: true, completed: true }),
              project_name: 'Justice des mineurs',
              approved_revision_number: 1,
              agents: ['Agent de test'],
            },
          ],
        }
      return new Response(JSON.stringify(body))
    }),
  )
  const router = makeExecutionRouter(
    createMemoryHistory({ initialEntries: ['/execution/pta-1'] }),
  )
  render(<App router={router} />)

  expect(
    await screen.findByRole('columnheader', { name: 'Réalisation physique' }),
  ).toBeVisible()
  expect(
    screen.getByRole('columnheader', { name: 'Exécution financière' }),
  ).toBeVisible()
  expect(
    screen.getByRole('columnheader', { name: 'Suivi administratif' }),
  ).toBeVisible()
  expect(screen.getByText('1 / 1 opérations terminées')).toBeVisible()
  expect(screen.getByText('sur 100 000 F CFA autorisés')).toBeVisible()
  expect(screen.queryByText(/Révision 1/)).not.toBeInTheDocument()
  expect(
    screen.getByRole('searchbox', {
      name: 'Rechercher par intitulé ou référence…',
    }),
  ).toBeVisible()

  const agent = await screen.findByLabelText('Agent affecté · 0')
  await user.click(screen.getByRole('button', { name: 'Filtres' }))
  expect(screen.getByText('Période de l’activité')).toBeVisible()
  expect(
    screen.getByText('Activités dont les dates croisent cette période.'),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Du : Choisir une date' }),
  ).toHaveClass('min-h-9')
  expect(
    screen.queryByRole('button', { name: 'Voir les résultats' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Fermer' }))
  await user.click(agent)
  await user.click(screen.getByRole('option', { name: 'Agent de test' }))
  expect(
    await screen.findByRole('button', {
      name: 'Retirer le filtre Agent affecté',
    }),
  ).toHaveTextContent('Agent de test')
  await user.click(
    screen.getByRole('button', { name: 'Autorisation à examiner' }),
  )
  expect(
    screen.getByRole('button', { name: 'Retirer le filtre Réalisation' }),
  ).toHaveTextContent('Autorisation à examiner')
})

test('execution explorer keeps the selected activity period in its API request', async () => {
  const requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      requests.push(String(url))
      const body = String(url).includes('/auth/session')
        ? {
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'agent@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }
        : { object: 'list', count: 0, data: [], next: null, previous: null }
      return new Response(JSON.stringify(body))
    }),
  )
  const router = makeExecutionRouter(
    createMemoryHistory({
      initialEntries: ['/execution/pta-1?from=2026-07-01&to=2026-09-30'],
    }),
  )
  render(<App router={router} />)

  await screen.findByText('0 activité')
  expect(screen.getByText('Aucune activité trouvée')).toBeVisible()
  expect(
    screen.getByText(
      'Aucune activité ne correspond à votre recherche ou aux filtres appliqués.',
    ),
  ).toBeVisible()
  expect(screen.getAllByRole('button', { name: 'Réinitialiser' })).toHaveLength(
    1,
  )
  expect(
    requests.some(
      (url) =>
        url.includes('/ptas/pta-1/execution') &&
        url.includes('from=2026-07-01') &&
        url.includes('to=2026-09-30'),
    ),
  ).toBe(true)
})

test('an observation draft keeps its version across refresh and can be explicitly reset', async () => {
  const user = userEvent.setup()
  let current = detail({ started: true, completed: true })
  const writes = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url)
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
            pending: [],
            allowed_actions: [],
            activity_version: 0,
            approved_revision_id: null,
          }),
        )
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
            pending: [],
            allowed_actions: [],
            activity_version: 0,
            approved_revision_id: null,
          }),
        )
      if (options.method === 'PATCH') {
        writes.push(JSON.parse(options.body))
        if (writes.length === 1)
          return new Response(JSON.stringify({ code: 'activity_stale' }), {
            status: 409,
          })
        return new Response(JSON.stringify({ ...current, version: 9 }))
      }
      let body = {
        object: 'list',
        count: 0,
        data: [],
        next: null,
        previous: null,
      }
      if (path.includes('/auth/session'))
        body = {
          state: 'verified',
          csrf: 'csrf',
          user: {
            id: 'agent',
            email: 'user@example.test',
            role: 'AGENT_SAISIE',
          },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        }
      else if (path.endsWith('/activities/activity-1/execution')) body = current
      return new Response(JSON.stringify(body))
    }),
  )
  const router = makeExecutionRouter(
    createMemoryHistory({
      initialEntries: ['/execution/activities/activity-1'],
    }),
  )
  render(<App router={router} />)
  expect(await screen.findByText('Budget autorisé actuel')).toBeVisible()
  expect(screen.getByText('Montant dépensé · final')).toBeVisible()
  await user.click(screen.getByText('Autorisations et montants confirmés'))
  expect(screen.getByText('Terminée, en attente de validation')).toBeVisible()
  expect(screen.getByText('Solde non dépensé')).toBeVisible()
  expect(screen.getByText('Montant à reverser')).toBeVisible()
  const administration = within(
    screen.getByRole('region', { name: 'Suivi administratif' }),
  )
  expect(
    administration.getByRole('heading', {
      name: 'Autorisation de décaissement',
    }),
  ).toBeVisible()
  expect(
    administration.getAllByText('Clôture de l’activité', { exact: true })[0],
  ).toBeVisible()
  expect(
    administration.queryByRole('link', {
      name: 'Consulter les pièces justificatives',
    }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Renseigner Préparer la session' }),
  )
  expect(
    screen.getByRole('dialog', { name: 'Préparer la session' }),
  ).toHaveTextContent('ACT-000001 · Former les équipes')
  expect(
    screen.getByRole('dialog', { name: 'Préparer la session' }),
  ).toHaveTextContent('Type : Formation')
  expect(
    screen.getByRole('dialog', { name: 'Préparer la session' }),
  ).toHaveTextContent('Montant autorisé')
  expect(screen.getByLabelText('Montant dépensé final (F CFA)')).toBeVisible()
  expect(screen.getByLabelText('Opération physiquement terminée')).toBeVisible()
  expect(
    screen.getByText(
      'Saisissez 0 uniquement si aucune dépense n’a été engagée.',
    ),
  ).toBeVisible()
  expect(
    within(
      screen.getByRole('dialog', { name: 'Préparer la session' }),
    ).queryByText('Pièces justificatives'),
  ).not.toBeInTheDocument()
  await user.type(
    await screen.findByLabelText('Observation'),
    ' Précision locale.',
  )
  await user.type(
    screen.getByLabelText('Motif de la correction *'),
    'Préciser le compte rendu.',
  )
  current = {
    ...current,
    version: 8,
    operations: [
      {
        ...current.operations[0],
        actual_spent: '110000',
        execution_completed: false,
        execution_observation: 'Correction distante.',
      },
    ],
  }
  await act(async () =>
    router.options.context.queryClient.setQueryData(
      ['execution', 'agent', 'activity', 'activity-1'],
      current,
    ),
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer', exact: true }),
  )
  await waitFor(() =>
    expect(writes[0]).toEqual(
      expect.objectContaining({
        expected_version: 7,
        execution_observation: 'Session terminée. Précision locale.',
      }),
    ),
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Annuler la saisie' }),
    ).toBeEnabled(),
  )
  await user.click(screen.getByRole('button', { name: 'Annuler la saisie' }))
  expect(screen.getByLabelText('Observation')).toHaveValue(
    'Correction distante.',
  )
  expect(screen.getByLabelText('Montant dépensé final (F CFA)')).toHaveValue(
    '110000',
  )
  expect(
    screen.getByLabelText('Opération physiquement terminée'),
  ).not.toBeChecked()
  await user.type(screen.getByLabelText('Observation'), ' Complément.')
  await user.type(
    screen.getByLabelText('Motif de la correction *'),
    'Compléter.',
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer', exact: true }),
  )
  await waitFor(() =>
    expect(writes[1]).toEqual(expect.objectContaining({ expected_version: 8 })),
  )
})

test('Agent confirms eligible Activity closure and sees terminal evidence', async () => {
  const user = userEvent.setup()
  let current = {
    ...detail({ started: true, completed: true }),
    version: 11,
    closure_blockers: [],
    allowed_actions: ['read', 'close'],
  }
  const emptyList = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/closure') && options.method === 'POST') {
      current = {
        ...current,
        state: 'closed',
        version: 12,
        closure: {
          closed_by_id: 'agent',
          closed_at: '2026-10-30T15:00:00Z',
        },
        allowed_actions: ['read'],
      }
      return Promise.resolve(new Response(JSON.stringify(current)))
    }
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(current)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(emptyList)))
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  const button = await screen.findByRole('button', {
    name: 'Clôturer l’activité',
  })
  const confirmation = screen.getByLabelText(
    /Je confirme que l’Activité est entièrement réalisée/,
  )
  expect(
    button
      .closest('details')
      .querySelector('[data-administrative-state="pending"]'),
  ).toBeInTheDocument()
  expect(confirmation).not.toBeChecked()
  await user.click(confirmation)
  await user.click(button)
  await waitFor(() =>
    expect(
      screen
        .getAllByText('Clôture de l’activité', { exact: true })[0]
        .closest('details')
        .querySelector('[data-administrative-state="complete"]'),
    ).toBeInTheDocument(),
  )
  expect(
    screen.queryByRole('button', { name: 'Clôturer l’activité' }),
  ).toBeNull()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/closure',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ expected_version: 11 }),
    }),
  )
})

test.each([
  ['submitted', 'À examiner'],
  ['returned', 'À corriger'],
])(
  'an older approved funding request does not mark a newer %s request as complete',
  async (currentState, expectedStatus) => {
    const current = detail({ started: true, completed: true })
    const funding = {
      object: 'list',
      count: 2,
      data: [
        {
          id: 'funding-new',
          amount: '25000',
          state: currentState,
          snapshot: { old_allocation: '100000', new_allocation: '125000' },
          submitted_at: '2026-11-02T09:00:00Z',
          decisions: [],
          cancellation: null,
          allowed_actions: ['read'],
        },
        {
          id: 'funding-old',
          amount: '10000',
          state: 'approved',
          snapshot: { old_allocation: '90000', new_allocation: '100000' },
          submitted_at: '2026-10-20T09:00:00Z',
          decisions: [],
          cancellation: null,
          allowed_actions: ['read'],
        },
      ],
      next: null,
      previous: null,
      pending: [],
      allowed_actions: [],
      activity_version: current.version,
      approved_revision_id: current.approved_revision_id,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const path = String(url)
        if (path.includes('/auth/session'))
          return new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: {
                id: 'supervisor',
                email: 'supervisor@example.test',
                role: 'AGENT_VERIFICATEUR',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          )
        if (path.endsWith('/funding-requests'))
          return new Response(JSON.stringify(funding))
        if (path.endsWith('/activities/activity-1/execution'))
          return new Response(JSON.stringify(current))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        )
      }),
    )
    render(
      <App
        router={makeExecutionRouter(
          createMemoryHistory({
            initialEntries: ['/execution/activities/activity-1'],
          }),
        )}
      />,
    )

    const step = (
      await screen.findAllByText('Financement complémentaire', { exact: true })
    )[0].closest('details')
    expect(within(step).getByText(expectedStatus)).toBeVisible()
    expect(
      step.querySelector('[data-administrative-state="pending"]'),
    ).toBeInTheDocument()
    expect(
      step.querySelector('[data-administrative-state="complete"]'),
    ).not.toBeInTheDocument()
  },
)

test('Agent submits a zero-spending declaration without financial requests', async () => {
  const user = userEvent.setup()
  const current = {
    ...detail({ started: true, completed: true }),
    spending_total: '0',
    balance: '100000',
    required_reversement: '0',
    realization_status: 'completed_pending_validation',
    closure_blockers: ['zero_spending_not_approved'],
    operations: [
      {
        ...detail({ started: true, completed: true }).operations[0],
        actual_spent: '0',
        variance: '-100000',
      },
    ],
  }
  let declarations = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  const emptyList = { ...declarations }
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (
      path.endsWith('/zero-spending-declarations') &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      declarations = {
        ...declarations,
        count: 1,
        data: [
          {
            id: 'zero-1',
            activity_id: current.id,
            approved_revision_id: current.approved_revision_id,
            snapshot: { total: '0', operations: [] },
            reason: body.reason,
            state: 'submitted',
            submitter_id: 'agent',
            submitted_at: '2026-11-03T10:00:00Z',
            decisions: [],
            allowed_actions: ['read'],
          },
        ],
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ ...declarations.data[0], activity_version: 8 }),
        ),
      )
    }
    if (path.endsWith('/zero-spending-declarations'))
      return Promise.resolve(new Response(JSON.stringify(declarations)))
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(current)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(emptyList)))
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  expect(
    await screen.findByRole('heading', {
      name: 'Déclaration de dépense nulle',
    }),
  ).toBeVisible()
  expect(screen.queryByText('Autorisation de décaissement')).toBeNull()
  expect(screen.queryByText('Autorisation de virement')).toBeNull()
  await user.click(screen.getByText('Autorisations et montants confirmés'))
  expect(screen.getByText('Solde non dépensé')).toBeVisible()
  expect(screen.getByText('Montant à reverser')).toBeVisible()
  expect(
    within(screen.getByText('Montant à reverser').parentElement).getByText(
      '0 F CFA',
    ),
  ).toBeVisible()
  await user.type(
    screen.getByLabelText('Motif de l’absence de dépense *'),
    'Les moyens propres ont suffi.',
  )
  await user.click(
    screen.getByRole('button', { name: 'Soumettre la déclaration' }),
  )
  expect(
    await screen.findByText('Motif : Les moyens propres ont suffi.'),
  ).toBeVisible()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/zero-spending-declarations',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 7,
        expected_approved_revision_id: current.approved_revision_id,
        reason: 'Les moyens propres ont suffi.',
      }),
    }),
  )
})

test.each([
  [
    'AGENT_VERIFICATEUR',
    'submitted',
    'prevalidate',
    'Prévalider',
    'Prévalidée, en attente du Validateur',
  ],
  ['VALIDATEUR_DEFINITIF', 'prevalidated', 'approve', 'Valider', 'Validée'],
])(
  '%s performs the projected zero-spending review action',
  async (role, initialState, decision, buttonLabel, finalLabel) => {
    const user = userEvent.setup()
    const current = {
      ...detail({ started: true, completed: true }),
      spending_total: '0',
      mutation_unavailable_reason: 'zero_spending_frozen',
      closure_blockers: ['zero_spending_not_approved'],
    }
    let declaration = {
      id: 'zero-1',
      activity_id: current.id,
      approved_revision_id: current.approved_revision_id,
      snapshot: { total: '0', operations: [] },
      reason: 'Les moyens propres ont suffi.',
      state: initialState,
      submitter_id: 'agent',
      submitted_at: '2026-11-03T10:00:00Z',
      decisions:
        initialState === 'prevalidated'
          ? [
              {
                id: 'decision-1',
                stage: 'supervisor',
                outcome: 'prevalidated',
                actor_id: 'supervisor',
                actor_role: 'AGENT_VERIFICATEUR',
                decided_at: '2026-11-03T11:00:00Z',
                reason: null,
                prevalidation_decision_id: null,
              },
            ]
          : [],
      allowed_actions: [decision, 'return'],
      activity_version: 7,
    }
    const emptyList = {
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    const fetch = vi.fn((url) => {
      const path = String(url)
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
            pending: [],
            allowed_actions: [],
            activity_version: 0,
            approved_revision_id: null,
          }),
        )
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
            pending: [],
            allowed_actions: [],
            activity_version: 0,
            approved_revision_id: null,
          }),
        )
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: { id: 'reviewer', email: 'reviewer@example.test', role },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/zero-spending-declarations/zero-1/decisions')) {
        declaration = {
          ...declaration,
          state: decision === 'approve' ? 'approved' : 'prevalidated',
          allowed_actions: ['read'],
          activity_version: 8,
        }
        if (decision === 'approve') {
          current.closure_blockers = []
          current.allowed_actions = ['read', 'close']
        }
        return Promise.resolve(new Response(JSON.stringify(declaration)))
      }
      if (path.endsWith('/zero-spending-declarations'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 1,
              data: [declaration],
              next: null,
              previous: null,
            }),
          ),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return Promise.resolve(new Response(JSON.stringify(current)))
      if (
        path.endsWith('/execution/history') ||
        path.endsWith('/disbursement-requests') ||
        path.endsWith('/virement-requests')
      )
        return Promise.resolve(new Response(JSON.stringify(emptyList)))
      return Promise.resolve(new Response('{}', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetch)
    render(
      <App
        router={makeExecutionRouter(
          createMemoryHistory({
            initialEntries: ['/execution/activities/activity-1'],
          }),
        )}
      />,
    )
    if (decision === 'prevalidate') {
      expect(await screen.findByLabelText('Motif du retour *')).toBeVisible()
    }
    await user.click(await screen.findByRole('button', { name: buttonLabel }))
    if (decision === 'approve') {
      await waitFor(() =>
        expect(
          screen
            .getByText('Déclaration sans dépense', { exact: true })
            .closest('details')
            .querySelector('[data-administrative-state="complete"]'),
        ).toBeInTheDocument(),
      )
    } else {
      expect(await screen.findByText(finalLabel)).toBeVisible()
    }
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/zero-spending-declarations/zero-1/decisions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expected_version: 7, decision }),
      }),
    )
    if (decision === 'approve') {
      expect(
        await screen.findByRole('button', { name: 'Clôturer l’activité' }),
      ).toBeVisible()
    }
  },
)

test('historical zero-spending page points to the active declaration', async () => {
  const user = userEvent.setup()
  const current = {
    ...detail({ started: true, completed: true }),
    spending_total: '0',
    mutation_unavailable_reason: 'zero_spending_frozen',
    closure_blockers: ['zero_spending_not_approved'],
  }
  const active = {
    id: 'zero-current',
    activity_id: current.id,
    approved_revision_id: current.approved_revision_id,
    snapshot: { total: '0', operations: [] },
    reason: 'Déclaration active.',
    state: 'submitted',
    submitter_id: 'agent',
    submitted_at: '2026-11-03T12:00:00Z',
    decisions: [],
    allowed_actions: ['read'],
    activity_version: 8,
  }
  const returned = {
    ...active,
    id: 'zero-returned',
    reason: 'Ancienne déclaration.',
    state: 'returned',
  }
  const emptyList = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  const fetch = vi.fn((url) => {
    const path = String(url)
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.includes('/zero-spending-declarations?cursor=older'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [returned],
            next: null,
            previous:
              '/api/v1/activities/activity-1/zero-spending-declarations?cursor=newer',
          }),
        ),
      )
    if (path.endsWith('/zero-spending-declarations'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [active],
            next: '/api/v1/activities/activity-1/zero-spending-declarations?cursor=older',
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(current)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(emptyList)))
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: [
            '/execution/activities/activity-1?zeroSpendingCursor=older',
          ],
        }),
      )}
    />,
  )
  expect(
    await screen.findByText(
      'La déclaration en cours se trouve sur une page plus récente.',
    ),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Soumettre la déclaration' }),
  ).toBeNull()
  await user.click(screen.getByText('Déclarations retournées'))
  expect(
    screen.getByText('Retournée pour correction · Ancienne déclaration.'),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Revenir à la déclaration en cours' }),
  )
  expect(await screen.findByText('Motif : Déclaration active.')).toBeVisible()
})

test.each(['AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'])(
  '%s sees closed evidence without closure controls',
  async (role) => {
    const current = {
      ...detail({ started: true, completed: true }),
      state: 'closed',
      version: 12,
      closure: {
        closed_by_id: 'agent',
        closed_at: '2026-10-30T15:00:00Z',
      },
      closure_blockers: [],
      allowed_actions: ['read'],
    }
    const emptyList = {
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    const fetch = vi.fn((url) => {
      const path = String(url)
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
            pending: [],
            allowed_actions: [],
            activity_version: 0,
            approved_revision_id: null,
          }),
        )
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
            pending: [],
            allowed_actions: [],
            activity_version: 0,
            approved_revision_id: null,
          }),
        )
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: { id: 'reviewer', email: 'reviewer@example.test', role },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return Promise.resolve(new Response(JSON.stringify(current)))
      if (
        path.endsWith('/execution/history') ||
        path.endsWith('/disbursement-requests') ||
        path.endsWith('/virement-requests')
      )
        return Promise.resolve(new Response(JSON.stringify(emptyList)))
      return Promise.resolve(new Response('{}', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetch)
    render(
      <App
        router={makeExecutionRouter(
          createMemoryHistory({
            initialEntries: ['/execution/activities/activity-1'],
          }),
        )}
      />,
    )
    expect(
      (await screen.findAllByText('Clôture de l’activité', { exact: true }))[0]
        .closest('details')
        .querySelector('[data-administrative-state="complete"]'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Activité clôturée')).not.toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Clôturer l’activité' }),
    ).toBeNull()
  },
)

test('Agent records an Operation and its start in one submission', async () => {
  const user = userEvent.setup()
  let current = detail()
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/execution/history'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/disbursement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/virement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.includes('/operations/') && options.method === 'PATCH') {
      current = detail({ started: true, completed: true })
      return Promise.resolve(new Response(JSON.stringify(current)))
    }
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(current)))
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  expect(await screen.findByText('Budget autorisé actuel')).toBeVisible()
  expect(screen.getByText('Non commencée')).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Renseigner Préparer la session' }),
  )
  expect(screen.queryByRole('button', { name: 'Démarrer' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(
    screen.getByText(
      'Renseignez un montant ou une observation avant d’enregistrer.',
    ),
  ).toBeVisible()
  expect(
    await screen.findByLabelText('Montant dépensé final (F CFA)'),
  ).toBeVisible()
  await user.type(
    screen.getByLabelText('Montant dépensé final (F CFA)'),
    '100000',
  )
  await user.type(screen.getByLabelText('Observation'), 'Session terminée.')
  await user.click(screen.getByLabelText('Opération physiquement terminée'))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/operations/22222222-2222-4222-8222-222222222222/execution',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          action: 'record',
          expected_version: 5,
          expected_approved_revision_id: '11111111-1111-4111-8111-111111111111',
          actual_spent: '100000',
          execution_completed: true,
          execution_observation: 'Session terminée.',
        }),
      }),
    ),
  )
})

test.each(['disbursement', 'virement', 'zero-spending'])(
  'returned history stays readable and permits eligible submission: %s',
  async (flow) => {
    const kind = flow === 'zero-spending' ? 'disbursement' : flow
    const user = userEvent.setup()
    const current = detail({ started: true, completed: true })
    if (flow === 'zero-spending') current.spending_total = '0'
    const source = 'source-1'
    const returned = {
      id: 'returned-1',
      state: 'returned',
      amount: '100000',
      activity_version: current.version,
      allowed_actions: ['read'],
      cancellation: null,
      decisions: [
        {
          id: 'decision-1',
          stage: 'supervisor',
          outcome: 'returned',
          reason: 'Vérifier le dossier.',
        },
      ],
    }
    const requests = [returned]
    if (kind === 'virement')
      current.virement_context = {
        disbursement_request_id: source,
        amount: '100000',
        current_request_id: null,
        current_state: null,
        can_submit: true,
        unavailable_reason: null,
      }
    const writes = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const path = String(url)
        if (path.includes('/funding-requests'))
          return new Response(
            JSON.stringify({
              object: 'list',
              count: 0,
              data: [],
              next: null,
              previous: null,
              pending: [],
              allowed_actions: [],
              activity_version: 0,
              approved_revision_id: null,
            }),
          )
        if (path.includes('/funding-requests'))
          return new Response(
            JSON.stringify({
              object: 'list',
              count: 0,
              data: [],
              next: null,
              previous: null,
              pending: [],
              allowed_actions: [],
              activity_version: 0,
              approved_revision_id: null,
            }),
          ).split('?')[0]
        let body = {
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        }
        if (path.includes('/auth/session'))
          body = {
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }
        else if (path.endsWith('/execution')) body = current
        else if (
          path.endsWith(`/${kind}-requests`) &&
          options.method === 'POST'
        ) {
          writes.push({ path, body: JSON.parse(options.body) })
          const fresh = {
            ...returned,
            id: 'fresh-1',
            state: 'submitted',
            decisions: [],
            allowed_actions: ['read', 'cancel'],
          }
          requests.unshift(fresh)
          if (kind === 'virement')
            current.virement_context = {
              ...current.virement_context,
              current_request_id: fresh.id,
              can_submit: false,
            }
          body = fresh
        } else if (path.endsWith(`/${kind}-requests`))
          body = { ...body, count: requests.length, data: requests }
        else if (path.endsWith(`/${kind}-requests/returned-1`)) body = returned
        else if (path.endsWith(`/${kind}-requests/fresh-1`)) body = requests[0]
        return new Response(JSON.stringify(body))
      }),
    )
    const search = kind === 'virement' ? 'virementRequest' : 'financeRequest'
    render(
      <App
        router={makeExecutionRouter(
          createMemoryHistory({
            initialEntries: [
              `/execution/activities/activity-1?${search}=returned-1`,
            ],
          }),
        )}
      />,
    )
    expect(await screen.findByText('Vérifier le dossier.')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Annuler la demande' }),
    ).not.toBeInTheDocument()
    if (flow === 'zero-spending') {
      expect(
        screen.getByRole('heading', { name: 'Déclaration de dépense nulle' }),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: /Soumettre 0/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Autorisation de virement' }),
      ).not.toBeInTheDocument()
      expect(writes).toHaveLength(0)
      return
    }
    await user.click(
      screen.getByRole('button', {
        name: kind === 'virement' ? /Demander le virement de/ : /Soumettre 100/,
      }),
    )
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].body).toEqual(
      kind === 'virement'
        ? {
            expected_version: current.version,
            expected_disbursement_request_id: source,
          }
        : {
            expected_version: current.version,
            expected_approved_revision_id: current.approved_revision_id,
          },
    )
    expect(requests[1]).toBe(returned)
    expect(returned.state).toBe('returned')
  },
)

test('Agent submits finalized spending for disbursement authorization', async () => {
  const user = userEvent.setup()
  let requests = []
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/execution/history'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/disbursement-requests') && options.method === 'POST') {
      requests = [
        {
          id: '33333333-3333-4333-8333-333333333333',
          activity_id: 'activity-1',
          amount: '100000',
          state: 'submitted',
          activity_version: 8,
          decisions: [],
          cancellation: null,
          allowed_actions: ['read', 'cancel'],
        },
      ]
      return Promise.resolve(new Response(JSON.stringify(requests[0])))
    }
    if (path.endsWith('/cancellation') && options.method === 'POST') {
      requests[0] = {
        ...requests[0],
        state: 'cancelled',
        activity_version: 9,
        cancellation: { reason: 'Corriger les montants.' },
        allowed_actions: ['read'],
      }
      return Promise.resolve(new Response(JSON.stringify(requests[0])))
    }
    if (path.includes('/disbursement-requests/'))
      return Promise.resolve(new Response(JSON.stringify(requests[0])))
    if (path.endsWith('/disbursement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: requests.length,
            data: requests,
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/virement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(
        new Response(
          JSON.stringify(detail({ started: true, completed: true })),
        ),
      )
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  await user.click(
    await screen.findByRole('button', {
      name: /Soumettre 100.*000 F CFA/,
    }),
  )
  expect(
    (await screen.findAllByText('Soumise au Superviseur'))[0],
  ).toBeVisible()
  expect(
    screen.getByText(/ne signifie pas que le paiement a été effectué/i),
  ).toBeVisible()
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/disbursement-requests',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expected_version: 7,
          expected_approved_revision_id: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    ),
  )
  await user.click(
    screen.getByRole('button', {
      name: /Soumise au Superviseur.*100.*000 F CFA/,
    }),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/disbursement-requests/33333333-3333-4333-8333-333333333333',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ),
  )
  await user.type(screen.getByLabelText('Motif *'), 'Corriger les montants.')
  await user.click(screen.getByRole('button', { name: 'Annuler la demande' }))
  expect(
    await screen.findByRole('button', { name: /Soumettre 100.*000 F CFA/ }),
  ).toBeVisible()
})

test.each([
  ['décaissement', '/disbursement-requests', /Soumettre 100.*000 F CFA/],
  ['virement', '/virement-requests', /Demander le virement de 100.*000 F CFA/],
])(
  'offline invalidation aborts and clears a pending %s mutation',
  async (_label, mutationPath, buttonName) => {
    const user = userEvent.setup()
    let mutationSignal
    const execution = detail({ started: true, completed: true })
    if (mutationPath === '/virement-requests')
      execution.virement_context = {
        disbursement_request_id: '33333333-3333-4333-8333-333333333333',
        amount: '100000',
        current_request_id: null,
        current_state: null,
        can_submit: true,
        unavailable_reason: null,
        confirmation_revision: null,
      }
    const fetch = vi.fn((url, options = {}) => {
      const path = String(url)
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
            pending: [],
            allowed_actions: [],
            activity_version: 0,
            approved_revision_id: null,
          }),
        )
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
            pending: [],
            allowed_actions: [],
            activity_version: 0,
            approved_revision_id: null,
          }),
        )
      if (path.includes('/auth/session'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: {
                id: 'agent',
                email: 'user@example.test',
                role: 'AGENT_SAISIE',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          ),
        )
      if (path.endsWith('/execution/history'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 0,
              data: [],
              next: null,
              previous: null,
            }),
          ),
        )
      if (path.endsWith(mutationPath) && options.method === 'POST') {
        mutationSignal = options.signal
        return new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        )
      }
      if (path.endsWith('/disbursement-requests'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 0,
              data: [],
              next: null,
              previous: null,
            }),
          ),
        )
      if (path.endsWith('/virement-requests'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              object: 'list',
              count: 0,
              data: [],
              next: null,
              previous: null,
            }),
          ),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return Promise.resolve(new Response(JSON.stringify(execution)))
      return Promise.resolve(new Response('{}', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetch)
    const router = makeExecutionRouter(
      createMemoryHistory({
        initialEntries: ['/execution/activities/activity-1'],
      }),
    )
    render(<App router={router} />)
    await user.click(await screen.findByRole('button', { name: buttonName }))
    await waitFor(() => expect(mutationSignal).toBeDefined())
    window.dispatchEvent(new Event('offline'))
    expect(
      await screen.findByRole('heading', { name: 'Connexion indisponible' }),
    ).toBeVisible()
    await waitFor(() => expect(mutationSignal.aborted).toBe(true))
    expect(
      router.options.context.queryClient.getMutationCache().getAll(),
    ).toEqual([])
    window.dispatchEvent(new Event('online'))
  },
)

test('Agent submits the locked disbursement amount for virement authorization', async () => {
  const user = userEvent.setup()
  const sourceId = '33333333-3333-4333-8333-333333333333'
  const requestId = '44444444-4444-4444-8444-444444444444'
  let virement = null
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    disbursement_request_id: sourceId,
    amount: '100000',
    current_request_id: null,
    current_state: null,
    can_submit: true,
    unavailable_reason: null,
  }
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/execution/history'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/disbursement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 1,
            data: [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/virement-requests') && options.method === 'POST') {
      virement = {
        id: requestId,
        activity_id: 'activity-1',
        disbursement_request_id: sourceId,
        approved_revision_id: execution.approved_revision_id,
        amount: '100000',
        state: 'submitted',
        submitter_id: 'agent',
        submitted_at: new Date().toISOString(),
        cancellation: null,
        decisions: [],
        allowed_actions: ['read', 'cancel'],
        activity_version: 8,
      }
      execution.version = 8
      execution.virement_context = {
        ...execution.virement_context,
        current_request_id: requestId,
        current_state: 'submitted',
        can_submit: false,
        unavailable_reason: 'virement_exists',
      }
      return Promise.resolve(new Response(JSON.stringify(virement)))
    }
    if (path.endsWith(`/virement-requests/${requestId}`))
      return Promise.resolve(new Response(JSON.stringify(virement)))
    if (path.endsWith('/virement-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: virement ? 1 : 0,
            data: virement ? [virement] : [],
            next: null,
            previous: null,
          }),
        ),
      )
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(execution)))
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  await user.click(
    await screen.findByRole('button', {
      name: /Demander le virement de 100.*000 F CFA/,
    }),
  )
  expect(
    (await screen.findAllByText('Soumise au Superviseur'))[0],
  ).toBeVisible()
  expect(
    screen.getByText(/ne confirme pas qu’un virement externe/i),
  ).toBeVisible()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/virement-requests',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 7,
        expected_disbursement_request_id: sourceId,
      }),
    }),
  )
})

test('Agent declares the fixed approved virement amount without retyping it', async () => {
  const user = userEvent.setup()
  const requestId = '44444444-4444-4444-8444-444444444444'
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '100000',
    current_request_id: requestId,
    current_state: 'approved',
    can_submit: false,
    unavailable_reason: 'virement_exists',
    confirmation_revision: null,
  }
  let virement = {
    id: requestId,
    activity_id: 'activity-1',
    amount: '100000',
    state: 'approved',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read', 'declare_confirmation'],
    current_confirmation: null,
    activity_version: 7,
  }
  let confirmations = []
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (
      path.endsWith(
        `/virement-requests/${requestId}/confirmation/corrections`,
      ) &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      const revision = confirmations.length + 1
      const corrected = {
        id: `confirmation-${revision}`,
        revision,
        amount: '100000',
        transfer_date: body.transfer_date,
        note: body.note,
        actor_id: 'agent',
        actor_name: 'Yoann Agent',
        recorded_at: `2026-10-29T1${revision}:00:00Z`,
        correction_reason: body.reason,
      }
      confirmations = [corrected, ...confirmations]
      virement = {
        ...virement,
        current_confirmation: corrected,
        activity_version: 7 + revision,
      }
      execution.version = 7 + revision
      return Promise.resolve(new Response(JSON.stringify(corrected)))
    }
    if (
      path.endsWith(`/virement-requests/${requestId}/confirmation`) &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      const declared = {
        id: 'confirmation-1',
        revision: 1,
        amount: '100000',
        transfer_date: body.transfer_date,
        note: body.note,
        actor_id: 'agent',
        actor_name: 'Yoann Agent',
        recorded_at: '2026-10-29T10:00:00Z',
        correction_reason: null,
      }
      confirmations = [declared]
      virement = {
        ...virement,
        current_confirmation: declared,
        allowed_actions: ['read', 'correct_confirmation'],
        activity_version: 8,
      }
      execution.version = 8
      return Promise.resolve(
        new Response(JSON.stringify(virement.current_confirmation)),
      )
    }
    if (path.endsWith(`/virement-requests/${requestId}/confirmation/history`))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...empty,
            count: confirmations.length,
            data: confirmations,
          }),
        ),
      )
    if (path.endsWith(`/virement-requests/${requestId}`))
      return Promise.resolve(new Response(JSON.stringify(virement)))
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(execution)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(empty)))
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  expect(
    await screen.findByText(/MJL enregistre la déclaration/i),
  ).toBeVisible()
  await user.type(
    screen.getByLabelText('Date effective du virement *'),
    '2026-10-28',
  )
  await user.type(screen.getByLabelText(/Référence ou commentaire/), 'TEST-001')
  await user.click(screen.getByLabelText(/Je confirme que ce montant/))
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer la déclaration' }),
  )
  expect(fetch).toHaveBeenCalledWith(
    `/api/v1/activities/activity-1/virement-requests/${requestId}/confirmation`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 7,
        transfer_date: '2026-10-28',
        note: 'TEST-001',
      }),
    }),
  )
  await screen.findByRole('button', { name: 'Corriger la déclaration' })
  const virementPanel = within(
    screen.getByText('Virement externe', { exact: true }).closest('details'),
  )
  await user.clear(virementPanel.getByLabelText('Date effective du virement *'))
  await user.type(
    virementPanel.getByLabelText('Date effective du virement *'),
    '2026-10-27',
  )
  await user.clear(virementPanel.getByLabelText(/Référence ou commentaire/))
  await user.type(
    virementPanel.getByLabelText(/Référence ou commentaire/),
    'TEST-002',
  )
  await user.type(
    virementPanel.getByLabelText('Motif de la correction *'),
    'Première correction.',
  )
  await user.click(virementPanel.getByLabelText(/Je confirme que ce montant/))
  await user.click(
    virementPanel.getByRole('button', { name: 'Corriger la déclaration' }),
  )
  await waitFor(() =>
    expect(
      virementPanel.getByLabelText('Motif de la correction *'),
    ).toHaveValue(''),
  )
  expect(
    virementPanel.getByLabelText('Date effective du virement *'),
  ).toHaveValue('2026-10-27')
  await user.type(
    virementPanel.getByLabelText('Motif de la correction *'),
    'Deuxième correction.',
  )
  await user.clear(virementPanel.getByLabelText(/Référence ou commentaire/))
  await user.type(
    virementPanel.getByLabelText(/Référence ou commentaire/),
    'TEST-003',
  )
  await user.click(virementPanel.getByLabelText(/Je confirme que ce montant/))
  await user.click(
    virementPanel.getByRole('button', { name: 'Corriger la déclaration' }),
  )
  await waitFor(() =>
    expect(
      virementPanel.getByLabelText(/Référence ou commentaire/),
    ).toHaveValue('TEST-003'),
  )
  await waitFor(() =>
    expect(screen.getByText('Virement externe', { exact: true })).toBeVisible(),
  )
  const confirmationDetails = screen
    .getByText('Virement externe', { exact: true })
    .closest('details')
  if (!confirmationDetails.open)
    await user.click(screen.getByText('Virement externe', { exact: true }))
  await waitFor(() =>
    expect(
      virementPanel.getByText('Historique des déclarations (3)'),
    ).toBeVisible(),
  )
  await user.click(virementPanel.getByText('Historique des déclarations (3)'))
  expect(virementPanel.getAllByText('Déclaration corrigée')).toHaveLength(2)
  expect(virementPanel.getByText('Déclaration initiale')).toBeVisible()
  expect(virementPanel.getAllByText(/Yoann Agent/)).toHaveLength(3)
  expect(virementPanel.queryByText(/^Version /)).not.toBeInTheDocument()
})

test('Agent records the exact reversement and preserves reasoned corrections', async () => {
  const user = userEvent.setup()
  const requestId = '44444444-4444-4444-8444-444444444444'
  const execution = detail({ started: true, completed: true })
  execution.approved_allocation = '300000'
  execution.spending_total = '200000'
  execution.virement_context = {
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '200000',
    current_request_id: requestId,
    current_state: 'approved',
    can_submit: false,
    unavailable_reason: 'virement_exists',
  }
  const confirmation = {
    id: 'confirmation-1',
    revision: 1,
    amount: '200000',
    transfer_date: '2026-10-27',
    note: 'VIREMENT-001',
    actor_id: 'agent',
    actor_name: 'Yoann Agent',
    recorded_at: '2026-10-27T10:00:00Z',
    correction_reason: null,
  }
  let declarations = []
  let reversementEvidence = []
  let reversementUploadAttempts = 0
  let resolveEvidenceUpload
  let virement = {
    id: requestId,
    activity_id: 'activity-1',
    amount: '200000',
    state: 'approved',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read', 'correct_confirmation'],
    current_confirmation: confirmation,
    reversement: {
      required_amount: '100000',
      declared_amount: '0',
      status: 'required',
      current_declaration: null,
      allowed_actions: ['read', 'declare'],
    },
    activity_version: 8,
  }
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.endsWith('/activities/activity-1/documents?limit=100'))
      return Promise.resolve(
        new Response(JSON.stringify({ ...empty, data: reversementEvidence })),
      )
    if (
      path.endsWith('/activities/activity-1/documents') &&
      options.method === 'POST'
    ) {
      reversementUploadAttempts += 1
      if (reversementUploadAttempts === 1)
        return Promise.resolve(
          new Response(JSON.stringify({ code: 'temporary_failure' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      reversementEvidence = [
        {
          id: 'reversement-proof-1',
          name: 'preuve-reversement.pdf',
          size: options.body.size,
          uploaded_by_id: 'agent',
        },
      ]
      return new Promise((resolve) => {
        resolveEvidenceUpload = () =>
          resolve(
            new Response(JSON.stringify(reversementEvidence[0]), {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
      })
    }
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (
      path.endsWith(`/virement-requests/${requestId}/reversement`) &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      const declared = {
        id: 'reversement-1',
        revision: 1,
        returned_amount: '100000',
        return_date: body.return_date,
        note: body.note,
        actor_id: 'agent',
        actor_name: 'Yoann Agent',
        recorded_at: '2026-10-28T10:00:00Z',
        correction_reason: null,
        activity_version: 9,
      }
      declarations = [declared]
      virement = {
        ...virement,
        activity_version: 9,
        allowed_actions: ['read'],
        reversement: {
          ...virement.reversement,
          declared_amount: '100000',
          status: 'declared',
          current_declaration: declared,
          allowed_actions: ['read', 'correct'],
        },
      }
      execution.version = 9
      return Promise.resolve(new Response(JSON.stringify(declared)))
    }
    if (
      path.endsWith(
        `/virement-requests/${requestId}/reversement/corrections`,
      ) &&
      options.method === 'POST'
    ) {
      const body = JSON.parse(options.body)
      const corrected = {
        ...declarations[0],
        id: 'reversement-2',
        revision: 2,
        return_date: body.return_date,
        note: body.note,
        correction_reason: body.reason,
        recorded_at: '2026-10-29T10:00:00Z',
        activity_version: 10,
      }
      declarations = [corrected, ...declarations]
      virement = {
        ...virement,
        activity_version: 10,
        reversement: {
          ...virement.reversement,
          current_declaration: corrected,
        },
      }
      execution.version = 10
      return Promise.resolve(new Response(JSON.stringify(corrected)))
    }
    if (path.endsWith(`/virement-requests/${requestId}/reversement/history`))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...empty,
            count: declarations.length,
            data: declarations,
          }),
        ),
      )
    if (path.endsWith(`/virement-requests/${requestId}/confirmation/history`))
      return Promise.resolve(new Response(JSON.stringify(empty)))
    if (path.endsWith(`/virement-requests/${requestId}`))
      return Promise.resolve(new Response(JSON.stringify(virement)))
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(execution)))
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(new Response(JSON.stringify(empty)))
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )

  const title = await screen.findByRole('heading', {
    name: 'Reversement au Partenaire',
  })
  const panel = within(title.closest('section'))
  expect(
    within(panel.getByText('Montant à reverser').parentElement).getByText(
      '100 000 F CFA',
      { exact: true },
    ),
  ).toBeVisible()
  await user.click(
    panel.getByRole('button', { name: 'Renseigner le reversement' }),
  )
  const dialog = within(
    screen.getByRole('dialog', { name: 'Enregistrer le reversement' }),
  )
  expect(dialog.getByText('100 000 F CFA', { exact: true })).toBeVisible()
  expect(dialog.queryByRole('textbox', { name: /montant/i })).toBeNull()
  await user.click(
    dialog.getByRole('button', {
      name: /Date effective du reversement : Choisir une date/,
    }),
  )
  await user.click(
    within(dialog.getByRole('grid')).getByRole('button', {
      name: /mercredi 28 octobre 2026/i,
    }),
  )
  await user.type(
    dialog.getByLabelText(/Référence ou commentaire du reversement/),
    'REVERSEMENT-001',
  )
  const evidence = new File(['preuve'], 'preuve-reversement.pdf', {
    type: 'application/pdf',
  })
  await user.upload(
    dialog.getByLabelText(/Pièce justificative du reversement/),
    evidence,
  )
  await user.click(dialog.getByLabelText(/montant exact a été reversé/))
  await user.click(
    dialog.getByRole('button', { name: 'Enregistrer le reversement' }),
  )
  expect(fetch).toHaveBeenCalledWith(
    `/api/v1/activities/activity-1/virement-requests/${requestId}/reversement`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 8,
        return_date: '2026-10-28',
        note: 'REVERSEMENT-001',
      }),
    }),
  )
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/documents',
    expect.objectContaining({ method: 'POST', body: evidence }),
  )
  expect(
    await screen.findByText(
      'Le reversement est enregistré, mais la pièce n’a pas pu être ajoutée.',
    ),
  ).toBeVisible()
  expect(
    fetch.mock.calls.filter(
      ([path, options]) =>
        String(path).endsWith(`/virement-requests/${requestId}/reversement`) &&
        options.method === 'POST',
    ),
  ).toHaveLength(1)
  await user.click(
    screen.getByRole('button', { name: 'Réessayer l’ajout de la pièce' }),
  )
  await waitFor(() => expect(resolveEvidenceUpload).toBeTypeOf('function'))
  const retryEvidence = screen.getByRole('button', {
    name: 'Réessayer l’ajout de la pièce',
  })
  expect(retryEvidence).toBeDisabled()
  await user.click(retryEvidence)
  expect(reversementUploadAttempts).toBe(2)
  await act(async () => resolveEvidenceUpload())
  await screen.findByText('Pièce justificative ajoutée.')
  expect(
    screen.queryByText(
      'Le reversement est enregistré, mais la pièce n’a pas pu être ajoutée.',
    ),
  ).not.toBeInTheDocument()
  expect(reversementEvidence).toHaveLength(1)
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Enregistrer le reversement' }),
    ).not.toBeInTheDocument(),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Corriger le reversement' }),
  )
  const correctionDialog = within(
    screen.getByRole('dialog', { name: 'Corriger le reversement' }),
  )
  await user.click(
    correctionDialog.getByRole('button', {
      name: /Date effective du reversement : 28 octobre 2026/,
    }),
  )
  await user.click(
    within(correctionDialog.getByRole('grid')).getByRole('button', {
      name: /jeudi 29 octobre 2026/i,
    }),
  )
  await user.type(
    correctionDialog.getByLabelText('Motif de la correction du reversement *'),
    'Date corrigée.',
  )
  await user.click(
    correctionDialog.getByLabelText(/montant exact a été reversé/),
  )
  const correctButton = correctionDialog.getByRole('button', {
    name: 'Corriger le reversement',
  })
  await waitFor(() => expect(correctButton).toBeEnabled())
  await user.click(correctButton)
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Corriger le reversement' }),
    ).not.toBeInTheDocument(),
  )
  expect(fetch).toHaveBeenCalledWith(
    `/api/v1/activities/activity-1/virement-requests/${requestId}/reversement/corrections`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        expected_version: 9,
        return_date: '2026-10-29',
        note: 'REVERSEMENT-001',
        reason: 'Date corrigée.',
      }),
    }),
  )
  await user.click(await screen.findByText('Historique des reversements (2)'))
  expect(screen.getByText('Reversement corrigé')).toBeVisible()
  expect(screen.getByText('Reversement initial')).toBeVisible()
  expect(screen.getAllByText(/Yoann Agent/)).toHaveLength(2)
  expect(screen.queryByText(/^Version /)).not.toBeInTheDocument()
}, 15000)

test('zero reversement displays settlement without a declaration form', async () => {
  const requestId = '44444444-4444-4444-8444-444444444444'
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '100000',
    current_request_id: requestId,
    current_state: 'approved',
    can_submit: false,
    unavailable_reason: 'virement_exists',
  }
  const virement = {
    id: requestId,
    amount: '100000',
    state: 'approved',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read', 'correct_confirmation'],
    current_confirmation: {
      id: 'confirmation-1',
      revision: 1,
      amount: '100000',
      transfer_date: '2026-10-27',
      note: null,
      actor_id: 'agent',
      recorded_at: '2026-10-27T10:00:00Z',
      correction_reason: null,
    },
    reversement: {
      required_amount: '0',
      declared_amount: '0',
      status: 'not_required',
      current_declaration: null,
      allowed_actions: ['read'],
    },
    activity_version: 8,
  }
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  vi.stubGlobal('fetch', (url) => {
    const path = String(url)
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith(`/virement-requests/${requestId}`))
      return Promise.resolve(new Response(JSON.stringify(virement)))
    if (path.endsWith('/activities/activity-1/execution'))
      return Promise.resolve(new Response(JSON.stringify(execution)))
    return Promise.resolve(new Response(JSON.stringify(empty)))
  })
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  const confirmationStep = (
    await screen.findByText('Virement externe', { exact: true })
  ).closest('details')
  expect(
    confirmationStep.querySelector('[data-administrative-state="complete"]'),
  ).toBeInTheDocument()
  expect(within(confirmationStep).getByText('Confirmé')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Enregistrer le reversement' }),
  ).not.toBeInTheDocument()
})

test('an uncertain virement submission stays blocked until reconciliation succeeds', async () => {
  const user = userEvent.setup()
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '100000',
    current_request_id: null,
    current_state: null,
    can_submit: true,
    unavailable_reason: null,
  }
  let executionCalls = 0
  let finishReconciliation
  const list = new Response(
    JSON.stringify({
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }),
  )
  const fetch = vi.fn((url, options = {}) => {
    const path = String(url)
    if (path.includes('/funding-requests'))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
          pending: [],
          allowed_actions: [],
          activity_version: 0,
          approved_revision_id: null,
        }),
      )
    if (path.includes('/auth/session'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        ),
      )
    if (path.endsWith('/virement-requests') && options.method === 'POST')
      return Promise.reject(new TypeError('Synthetic uncertain response'))
    if (path.endsWith('/activities/activity-1/execution')) {
      executionCalls += 1
      if (executionCalls === 1)
        return Promise.resolve(new Response(JSON.stringify(execution)))
      return new Promise((resolve) => {
        finishReconciliation = () =>
          resolve(new Response(JSON.stringify(execution)))
      })
    }
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return Promise.resolve(list.clone())
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  const submit = await screen.findByRole('button', {
    name: /Demander le virement de 100.*000 F CFA/,
  })
  await user.click(submit)
  await waitFor(() => expect(finishReconciliation).toBeDefined())
  expect(submit).toBeDisabled()
  finishReconciliation()
  await waitFor(() => expect(submit).toBeEnabled())
})

test('realization cursors reject foreign and malformed links', () => {
  expect(
    cursorFrom(
      'http://localhost:3000/api/v1/activities/activity-1/virement-requests?cursor=next',
      '/activities/activity-1/virement-requests',
    ),
  ).toBe('next')
  expect(
    cursorFrom(
      'https://example.test/api/v1/activities/activity-1/virement-requests?cursor=forged',
      '/activities/activity-1/virement-requests',
    ),
  ).toBe('')
  expect(
    cursorFrom('not a valid URL', '/activities/activity-1/virement-requests'),
  ).toBe('')
})

test.each([
  ['AGENT_SAISIE', 'submit', 'Demander le financement complémentaire'],
  ['AGENT_VERIFICATEUR', 'prevalidate', 'Prévalider le complément'],
  ['VALIDATEUR_DEFINITIF', 'approve', 'Approuver le complément'],
])(
  'funding %s uses the exact basis and reconciles execution',
  async (role, action, label) => {
    const user = userEvent.setup()
    let current = {
      ...detail(),
      execution_paused: true,
      pause_reason: 'funding_required',
      mutation_unavailable_reason: 'funding_required',
      operations: detail().operations.map((row) => ({
        ...row,
        allowed_actions: [],
      })),
    }
    const basis = {
      base_revision_id: 'old',
      approved_revision_id: current.approved_revision_id,
      old_allocation: '100000',
      new_allocation: '120000',
      amount: '20000',
    }
    const row = {
      id: 'funding-1',
      amount: '20000',
      snapshot: basis,
      submitted_at: '2026-11-04T09:00:00Z',
      state: action === 'approve' ? 'prevalidated' : 'submitted',
      decisions: [],
      cancellation: null,
      allowed_actions: ['read', action],
    }
    let funding = {
      object: 'list',
      count: action === 'submit' ? 0 : 1,
      data: action === 'submit' ? [] : [row],
      next: null,
      previous: null,
      pending: [basis],
      allowed_actions: action === 'submit' ? ['submit'] : [],
      activity_version: current.version,
      approved_revision_id: current.approved_revision_id,
    }
    const writes = []
    let refreshes = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const path = String(url)
        if (path.includes('/auth/session'))
          return new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: { id: 'actor', email: 'actor@example.test', role },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          )
        if (options.method === 'POST') {
          writes.push({ path, body: JSON.parse(options.body) })
          current = {
            ...current,
            version: 6,
            execution_paused: action !== 'approve',
            pause_reason: action === 'approve' ? null : 'funding_required',
          }
          funding = {
            ...funding,
            activity_version: 6,
            allowed_actions: [],
            data: [
              {
                ...row,
                state:
                  action === 'submit'
                    ? 'submitted'
                    : action === 'approve'
                      ? 'approved'
                      : 'prevalidated',
                allowed_actions: ['read'],
              },
            ],
            count: 1,
          }
          return new Response(JSON.stringify({ ...row, activity_version: 6 }), {
            status: 201,
          })
        }
        if (path.includes('/funding-requests'))
          return new Response(JSON.stringify(funding))
        if (path.endsWith('/execution')) {
          refreshes++
          return new Response(JSON.stringify(current))
        }
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        )
      }),
    )
    render(
      <App
        router={makeExecutionRouter(
          createMemoryHistory({
            initialEntries: ['/execution/activities/activity-1'],
          }),
        )}
      />,
    )
    await user.click(await screen.findByRole('button', { name: label }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].body.expected_version).toBe(5)
    expect(writes[0].body).not.toHaveProperty('amount')
    if (action === 'submit')
      expect(writes[0].body.expected_approved_revision_id).toBe(
        current.approved_revision_id,
      )
    else expect(writes[0].body.decision).toBe(action)
    await waitFor(() => expect(refreshes).toBeGreaterThan(1))
    await act(async () => window.dispatchEvent(new Event('offline')))
    expect(
      screen.queryByRole('button', { name: label }),
    ).not.toBeInTheDocument()
    expect(writes).toHaveLength(1)
    await act(async () => window.dispatchEvent(new Event('online')))
  },
)

test('a reasoned execution correction refreshes the funding version without releasing the pause', async () => {
  const user = userEvent.setup()
  let current = {
    ...detail({ started: true, completed: true }),
    execution_paused: true,
    pause_reason: 'funding_required',
    mutation_unavailable_reason: 'funding_required',
  }
  let fundingReads = 0
  const writes = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (options.method === 'PATCH') {
        writes.push(JSON.parse(options.body))
        current = {
          ...current,
          version: 8,
          operations: current.operations.map((row) => ({
            ...row,
            actual_spent: '90000',
          })),
        }
        return new Response(JSON.stringify(current))
      }
      if (path.endsWith('/funding-requests')) {
        fundingReads++
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
            pending: [
              {
                old_allocation: '100000',
                new_allocation: '120000',
                amount: '20000',
              },
            ],
            allowed_actions: ['submit'],
            activity_version: current.version,
            approved_revision_id: current.approved_revision_id,
          }),
        )
      }
      if (path.endsWith('/execution'))
        return new Response(JSON.stringify(current))
      return new Response(
        JSON.stringify({
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        }),
      )
    }),
  )
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: ['/execution/activities/activity-1'],
        }),
      )}
    />,
  )
  await user.click(
    await screen.findByRole('button', {
      name: 'Renseigner Préparer la session',
    }),
  )
  const amount = await screen.findByLabelText('Montant dépensé final (F CFA)')
  await user.clear(amount)
  await user.type(amount, '90000')
  await user.type(
    screen.getByLabelText('Motif de la correction *'),
    'Montant rectifié après vérification.',
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer', exact: true }),
  )
  await waitFor(() => expect(writes).toHaveLength(1))
  await waitFor(() => expect(fundingReads).toBeGreaterThan(1))
  await waitFor(() =>
    expect(
      screen.getByRole('button', {
        name: 'Demander le financement complémentaire',
      }),
    ).toBeEnabled(),
  )
  expect(screen.getByText(/La réalisation est suspendue/)).toBeInTheDocument()
})

test.each([503, 403, 404])(
  'a funding refresh failure %s preserves the operation draft and discards only denied data',
  async (status) => {
    const user = userEvent.setup()
    let failFunding = false
    const funding = {
      object: 'list',
      count: 1,
      data: [
        {
          id: 'funding-background',
          amount: '77777',
          snapshot: {
            old_allocation: '100000',
            new_allocation: '177777',
          },
          submitted_at: '2026-11-04T09:00:00Z',
          state: 'submitted',
          decisions: [],
          cancellation: null,
          allowed_actions: ['read'],
        },
      ],
      next: null,
      previous: null,
      pending: [],
      allowed_actions: [],
      activity_version: 7,
      approved_revision_id: '11111111-1111-4111-8111-111111111111',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const path = String(url)
        if (path.includes('/auth/session'))
          return new Response(
            JSON.stringify({
              state: 'verified',
              csrf: 'csrf',
              user: {
                id: 'agent',
                email: 'user@example.test',
                role: 'AGENT_SAISIE',
              },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          )
        if (path.endsWith('/execution'))
          return new Response(
            JSON.stringify(detail({ started: true, completed: true })),
          )
        if (path.endsWith('/funding-requests'))
          return failFunding
            ? new Response('{}', { status })
            : new Response(JSON.stringify(funding))
        return new Response(
          JSON.stringify({
            object: 'list',
            count: 0,
            data: [],
            next: null,
            previous: null,
          }),
        )
      }),
    )
    const router = makeExecutionRouter(
      createMemoryHistory({
        initialEntries: ['/execution/activities/activity-1'],
      }),
    )
    render(<App router={router} />)
    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Renseigner Préparer la session' },
        { timeout: 3000 },
      ),
    )
    await user.type(
      await screen.findByLabelText('Observation'),
      ' Brouillon local.',
    )
    expect(
      (await screen.findAllByText(/77.*777 F CFA/)).length,
    ).toBeGreaterThan(0)

    failFunding = true
    await act(async () =>
      router.options.context.queryClient.invalidateQueries({
        queryKey: ['execution', 'agent', 'funding'],
      }),
    )

    await waitFor(() =>
      expect(
        router.options.context.queryClient.getQueryCache().find({
          queryKey: ['execution', 'agent', 'funding'],
          exact: false,
        })?.state.status,
      ).toBe('error'),
    )
    expect(screen.getByLabelText('Observation')).toHaveValue(
      'Session terminée. Brouillon local.',
    )
    const cached = router.options.context.queryClient.getQueryCache().find({
      queryKey: ['execution', 'agent', 'funding'],
      exact: false,
    })?.state.data
    if (status === 503) expect(cached).toEqual(funding)
    else expect(cached).toBeNull()
  },
)
