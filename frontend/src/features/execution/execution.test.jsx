import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App, makeRouter } from '@/app/router.jsx'
import { cursorFrom } from '@/shared/lib/pagination'
import { ExecutionView } from './ExecutionView'
import { TaskEditor } from './ExecutionOperations'

function makeExecutionRouter(history) {
  return makeRouter(history, {
    execution: (screen) => <ExecutionView screen={screen} />,
  })
}

async function openFinancialDrawer(
  user,
  action = 'Nouvelle demande',
  expectedAuthorized = null,
  virementAvailable = null,
  requestType = null,
  disbursementAvailable = true,
) {
  const requests = await screen.findByRole('region', {
    name: 'Demandes financières',
  })
  await user.click(
    await within(requests).findByRole('button', { name: action }),
  )
  const dialog = await screen.findByRole('dialog')
  if (action === 'Nouvelle demande') {
    expect(dialog).toHaveAccessibleName('Nouvelle demande')
    expect(dialog).not.toHaveClass('h-dvh')
    if (virementAvailable === true) {
      expect(
        within(dialog).getByText('Autorisation de décaissement'),
      ).toBeVisible()
      expect(within(dialog).getByText('Autorisation de virement')).toBeVisible()
      const disbursementAction = within(dialog).getByRole('button', {
        name: 'Créer — Autorisation de décaissement',
      })
      if (disbursementAvailable) expect(disbursementAction).toBeEnabled()
      else expect(disbursementAction).toBeDisabled()
      expect(
        within(dialog).getByRole('button', {
          name: 'Créer — Autorisation de virement',
        }),
      ).toBeEnabled()
    }
    if (virementAvailable === false) {
      expect(
        within(dialog).getByText('Autorisation de décaissement'),
      ).toBeVisible()
      expect(
        within(dialog).queryByText('Autorisation de virement'),
      ).not.toBeInTheDocument()
    }
    if (expectedAuthorized && expectedAuthorized !== 'Non renseigné')
      expect(
        within(dialog).getByText(
          `Total actuellement autorisé : ${expectedAuthorized}`,
        ),
      ).toBeVisible()
  }
  const create = requestType
    ? within(dialog).queryByRole('button', {
        name: `Créer — ${requestType}`,
      })
    : within(dialog).queryByRole('button', {
        name: 'Créer — Autorisation de virement',
      }) ||
      within(dialog)
        .queryAllByRole('button', { name: /^Créer/ })
        .find((button) => !button.disabled)
  if (create) {
    await user.click(create)
    await waitFor(() =>
      expect(dialog).not.toHaveAccessibleName('Nouvelle demande'),
    )
  }
  return screen.findByRole('dialog')
}

async function openAdministrativeDrawer(user, action, label) {
  await user.click(await screen.findByRole('button', { name: action }))
  return screen.findByRole('dialog', { name: label })
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
    completed_tasks: completed ? 1 : 0,
    task_count: 1,
    progress: completed ? '100.00' : started ? '0.00' : null,
    works_completed: completed,
    spending_total: completed ? '100000' : null,
    disbursement_remaining_amount: completed ? '100000' : null,
    disbursement_can_submit: completed,
    balance: completed ? '0' : null,
    required_reversement: null,
    realization_status: completed
      ? 'completed_pending_validation'
      : started
        ? 'in_progress'
        : 'not_started',
    virement_context: {
      disbursement_request_id: null,
      disbursement_state: null,
      amount: null,
      authorized_amount: null,
      transferred_amount: null,
      current_request_id: null,
      current_state: null,
      can_submit: false,
      unavailable_reason: 'disbursement_required',
    },
    allowed_actions: ['read'],
    tasks: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        type_id: 'type-1',
        type_label: 'Formation',
        name: 'Préparer la session',
        description: '',
        approved_allocation: '100000',
        weight: '100.00',
        progress: completed ? '100.00' : started ? '0.00' : null,
        position: 1,
        execution_started_at: started ? '2026-10-28T09:00:00Z' : null,
        execution_completed: completed,
        actual_spent: completed ? '100000' : null,
        execution_observation: completed ? 'Session terminée.' : '',
        variance: completed ? '0' : null,
        allowed_actions: ['record'],
        subtasks: [],
      },
    ],
  }
}

test('a spending correction preserves completion for a legacy unweighted Task', async () => {
  const user = userEvent.setup()
  const mutate = vi.fn().mockResolvedValue({})
  const activity = detail({ started: true, completed: true })
  const task = {
    ...activity.tasks[0],
    weight: null,
    progress: null,
  }
  render(
    <TaskEditor
      activity={activity}
      task={task}
      target={task}
      isSubtask={false}
      pending={false}
      mutate={mutate}
    />,
  )
  expect(screen.getByLabelText('Tâche physiquement terminée')).toBeChecked()
  expect(screen.getByLabelText('Observation')).not.toBeRequired()
  const amount = screen.getByLabelText('Dépense enregistrée (F CFA)')
  await user.clear(amount)
  await user.type(amount, '90000')
  await user.type(
    screen.getByLabelText('Motif de la correction *'),
    'Montant corrigé.',
  )
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(mutate).toHaveBeenCalledWith(
    task.id,
    null,
    expect.objectContaining({
      actual_spent: '90000',
      execution_completed: true,
      correction_reason: 'Montant corrigé.',
    }),
  )
  expect(mutate.mock.calls[0][2]).not.toHaveProperty('progress')
})

test('the Task editor shows its localized planned period', () => {
  const activity = detail({ started: true })
  const task = {
    ...activity.tasks[0],
    planned_start: '2026-10-28',
    planned_end: '2026-12-31',
  }

  render(
    <TaskEditor
      activity={activity}
      task={task}
      target={task}
      isSubtask={false}
      pending={false}
      mutate={vi.fn()}
      onCancel={() => {}}
    />,
  )

  const period = screen.getByText(/28 octobre 2026.*31 décembre 2026/)
  expect(period).toBeVisible()
})

test.each([
  ['Task', false],
  ['Subtask', true],
])(
  'an observation-only %s correction requires and submits its reason',
  async (_, isSubtask) => {
    const user = userEvent.setup()
    const mutate = vi.fn().mockResolvedValue({})
    const activity = detail({ started: true, completed: true })
    const task = {
      ...activity.tasks[0],
      actual_spent: '90000',
      execution_observation: 'Justification initiale.',
    }
    const target = isSubtask
      ? {
          ...task,
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Réserver la salle',
          weight: '100.00',
        }
      : task

    render(
      <TaskEditor
        activity={activity}
        task={task}
        target={target}
        isSubtask={isSubtask}
        pending={false}
        mutate={mutate}
        onCancel={() => {}}
      />,
    )

    expect(
      screen.queryByLabelText('Motif de la correction *'),
    ).not.toBeInTheDocument()
    const observation = screen.getByLabelText('Observation')
    await user.clear(observation)
    await user.type(observation, 'Justification corrigée.')
    await user.type(
      screen.getByLabelText('Motif de la correction *'),
      'Préciser la justification.',
    )
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(mutate).toHaveBeenCalledWith(
      task.id,
      isSubtask ? target.id : null,
      expect.objectContaining({
        execution_observation: 'Justification corrigée.',
        correction_reason: 'Préciser la justification.',
      }),
    )
  },
)

test('equivalent progress formatting does not require a correction reason', async () => {
  const user = userEvent.setup()
  const activity = detail({ started: true })
  const task = activity.tasks[0]
  render(
    <TaskEditor
      activity={activity}
      task={task}
      target={task}
      isSubtask={false}
      pending={false}
      mutate={vi.fn()}
      onCancel={() => {}}
    />,
  )

  const progress = screen.getByLabelText('Avancement physique (%)')
  await user.clear(progress)
  await user.type(progress, '0')

  expect(
    screen.queryByLabelText('Motif de la correction *'),
  ).not.toBeInTheDocument()
})

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
        '/execution/activities/activity-1?financeRequest=request-1&virementRequest=virement-1&financeCursor=older',
      ],
    }),
    { planning: () => <p>Canonical activity shell</p> },
  )
  render(<App router={router} />)

  expect(await screen.findByText('Canonical activity shell')).toBeVisible()
  expect(router.state.location.pathname).toBe('/activities/activity-1')
  expect(router.state.location.search).toMatchObject({
    tab: 'realization',
    origin: 'execution',
    financeCursor: 'older',
  })
  expect(router.state.location.search.financeRequest).toBeUndefined()
  expect(router.state.location.search.virementRequest).toBeUndefined()
})

test('financial summary keeps the current authorization state on older history pages', async () => {
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    ...execution.virement_context,
    disbursement_state: 'submitted',
  }
  const oldReturnedRequest = {
    id: 'old-returned-request',
    amount: '90000',
    state: 'returned',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read'],
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
        return new Response(JSON.stringify(execution))
      if (path.includes('/disbursement-requests?cursor=older'))
        return new Response(
          JSON.stringify({
            ...empty,
            count: 1,
            data: [oldReturnedRequest],
            previous: '/api/v1/activities/activity-1/disbursement-requests',
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
            '/execution/activities/activity-1?financeCursor=older',
          ],
        }),
      )}
    />,
  )

  const situation = within(
    await screen.findByRole('region', { name: 'Situation financière' }),
  )
  expect(
    within(situation.getByText('Montant autorisé').parentElement).getByText(
      'Autorisation en cours',
    ),
  ).toBeVisible()
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
    tasks: execution.tasks.map((operation) => ({
      ...operation,
      allocation: operation.approved_allocation,
    })),
    approved: {
      name: execution.name,
      description: execution.description,
      planned_start: execution.planned_start,
      planned_end: execution.planned_end,
      allocation: execution.approved_allocation,
      tasks: execution.tasks,
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
      if (path.endsWith('/funding-requests'))
        return new Response('{}', { status: 503 })
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
  const router = makeExecutionRouter(
    createMemoryHistory({
      initialEntries: ['/activities/activity-1?tab=finance&origin=execution'],
    }),
  )
  render(<App router={router} />)

  const header = await screen.findByRole(
    'heading',
    { name: 'Former les équipes' },
    { timeout: 5000 },
  )
  const activityHeader = header.closest('[data-ui="activity-header"]')
  expect(await within(activityHeader).findByText('Terminée')).toBeVisible()
  expect(within(activityHeader).queryByText('100 %')).toBeNull()
  expect(
    within(
      screen.getByRole('navigation', { name: 'Espace de travail' }),
    ).getByRole('link', { name: 'Réalisation' }),
  ).toHaveAttribute('aria-current', 'page')
  expect(await screen.findByText('Montant autorisé')).toBeVisible()
  const financialRequests = screen.getByRole('region', {
    name: 'Demandes financières',
  })
  expect(
    within(financialRequests).getByRole('button', { name: 'Suivant' }),
  ).toBeEnabled()
  await user.click(
    within(financialRequests).getByRole('button', { name: 'Suivant' }),
  )
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/activities/activity-1')
    expect(router.state.location.search.tab).toBe('finance')
    expect(router.state.location.search.financeCursor).toBe('older')
  })
  expect(
    await screen.findByRole('region', { name: 'Demandes financières' }),
  ).toBeVisible()
  const financialFacts = within(
    screen.getByRole('region', { name: 'Situation financière' }),
  )
  for (const label of [
    'Montant prévu',
    'Montant autorisé',
    'Dépenses enregistrées',
    'Dépenses acceptées',
  ])
    expect(financialFacts.getByText(label)).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Demander une modification' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Retirer l’activité' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Transférer vers un autre PTA' }),
  ).not.toBeInTheDocument()
  const activitySheet = screen.getByRole('button', {
    name: 'Fiche récapitulative',
  })
  expect(activitySheet).toBeVisible()
  await user.click(activitySheet)
  await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce())
  expect(
    screen.queryByRole('dialog', { name: 'Fiche récapitulative' }),
  ).not.toBeInTheDocument()
  expect(createObjectURL).toHaveBeenCalledOnce()
  await waitFor(() =>
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:activity-fiche'),
  )
  await openFinancialDrawer(user, 'Reprendre')
  expect(screen.queryByText(/Historique des demandes/)).toBeNull()

  await user.click(screen.getByRole('link', { name: 'Programmation' }))
  expect(screen.getByRole('heading', { name: 'Former les équipes' })).toBe(
    header,
  )
  expect(
    within(
      screen.getByRole('navigation', { name: 'Espace de travail' }),
    ).getByRole('link', { name: 'Réalisation' }),
  ).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByText('Montant autorisé')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Demander une modification' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Retirer l’activité' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Transférer vers un autre PTA' }),
  ).not.toBeInTheDocument()

  for (const tab of ['Historique', 'Pièces justificatives', 'Programmation']) {
    await user.click(screen.getByRole('link', { name: tab }))
    expect(screen.getByRole('heading', { name: 'Former les équipes' })).toBe(
      header,
    )
    const breadcrumb = screen.getByRole('navigation', {
      name: 'Fil d’Ariane de l’activité',
    })
    expect(
      within(breadcrumb).getByRole('link', { name: 'Réalisation' }),
    ).toHaveAttribute('href', '/execution')
    expect(
      within(breadcrumb).queryByText('Prévisions (PTA)'),
    ).not.toBeInTheDocument()
    for (const name of [
      'Demander une modification',
      'Retirer l’activité',
      'Transférer vers un autre PTA',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  }

  await user.click(screen.getByRole('link', { name: 'Finance' }))
  expect(screen.getByRole('heading', { name: 'Former les équipes' })).toBe(
    header,
  )
  expect(await screen.findByText('Montant autorisé')).toBeVisible()
})

test('agent records tasks before the collapsed financial workflow', async () => {
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

  expect(await screen.findByText('Montant autorisé')).toBeVisible()
  expect(screen.getByText('Dépenses acceptées')).toBeVisible()
  const financialSituation = within(
    screen.getByRole('region', { name: 'Situation financière' }),
  )
  expect(
    within(
      financialSituation.getByText('Dépenses enregistrées').parentElement,
    ).getByText('Non renseigné'),
  ).toBeVisible()
  expect(
    within(screen.getByText('Dépenses acceptées').parentElement).getByText(
      'Réalisation à soumettre',
    ),
  ).toBeVisible()
  expect(
    screen.queryByText('Autorisations et montants confirmés'),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Renseigner Préparer la session' }),
  ).toBeVisible()

  const administration = within(
    screen.getByRole('region', { name: 'Demandes financières' }),
  )
  expect(
    administration.getByRole('heading', { name: 'Demandes financières' }),
  ).toBeVisible()
  expect(administration.getByText('Aucune demande financière.')).toBeVisible()
  expect(
    administration.queryByRole('button', { name: /Soumettre/ }),
  ).not.toBeInTheDocument()

  current = {
    ...current,
    spending_total: '0',
    tasks: current.tasks.map((operation) => ({
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
  expect(administration.getByText('Aucune demande financière.')).toBeVisible()
  expect(administration.queryByText('Déclaration sans dépense')).toBeNull()
})

test('agent completes a subtask and keeps the draft after a failed save', async () => {
  const user = userEvent.setup()
  let attempts = 0
  let current = {
    ...detail({ started: true }),
    progress: '0.00',
    tasks: [
      {
        ...detail({ started: true }).tasks[0],
        description: 'Préparation générale',
        weight: '100.00',
        progress: '0.00',
        actual_spent: null,
        execution_completed: false,
        subtasks: [
          {
            id: 'subtask-1',
            name: 'Réserver la salle',
            description: 'Confirmer la réservation.',
            weight: '50.00',
            approved_allocation: '50000',
            execution_started_at: null,
            execution_completed: false,
            actual_spent: null,
            execution_observation: '',
            allowed_actions: ['record'],
          },
          {
            id: 'subtask-2',
            name: 'Préparer les supports',
            description: '',
            weight: '50.00',
            approved_allocation: '50000',
            execution_started_at: null,
            execution_completed: false,
            actual_spent: null,
            execution_observation: '',
            allowed_actions: ['record'],
          },
        ],
      },
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
  }
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
              email: 'agent@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (options.method === 'PATCH' && path.includes('/subtasks/subtask-1')) {
        attempts += 1
        if (attempts === 1)
          return new Response(JSON.stringify({ code: 'activity_stale' }), {
            status: 409,
          })
        current = {
          ...current,
          version: 7,
          progress: '50.00',
          spending_total: null,
          tasks: [
            {
              ...current.tasks[0],
              progress: '50.00',
              subtasks: current.tasks[0].subtasks.map((child) =>
                child.id === 'subtask-1'
                  ? {
                      ...child,
                      execution_started_at: '2026-11-13T09:00:00Z',
                      execution_completed: true,
                      actual_spent: '45000',
                      execution_observation: 'Salle confirmée.',
                    }
                  : child,
              ),
            },
          ],
        }
        return new Response(JSON.stringify(current))
      }
      if (path.endsWith('/activities/activity-1/execution'))
        return new Response(JSON.stringify(current))
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

  await user.click(await screen.findByRole('button', { name: 'Développer' }))
  await user.click(
    await screen.findByRole('button', { name: 'Renseigner Réserver la salle' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Réserver la salle' })
  expect(dialog).toHaveTextContent('Former les équipes · Préparer la session')
  await user.click(
    within(dialog).getByLabelText('Sous-tâche physiquement terminée'),
  )
  await user.type(
    within(dialog).getByLabelText('Dépense enregistrée (F CFA)'),
    '45000',
  )
  await user.type(
    within(dialog).getByLabelText('Observation'),
    'Salle confirmée.',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(attempts).toBe(1))
  expect(
    screen.getByRole('dialog', { name: 'Réserver la salle' }),
  ).toBeVisible()
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Vérification refusée. Vérifiez les informations saisies.',
  )
  expect(screen.getByLabelText('Dépense enregistrée (F CFA)')).toHaveValue(
    '45 000',
  )
  expect(
    screen.getByLabelText('Sous-tâche physiquement terminée'),
  ).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Réserver la salle' }),
    ).not.toBeInTheDocument(),
  )
  const parentRow = screen.getAllByText('Préparer la session')[0].closest('tr')
  expect(within(parentRow).getByText('50 %')).toBeVisible()
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
  expect(screen.queryByText('Montant autorisé')).toBeNull()

  resolveFinance(new Response(JSON.stringify(empty)))
  expect(await screen.findByText('Montant autorisé')).toBeVisible()
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
  expect(screen.getByText('1 / 1 tâche terminée')).toBeVisible()
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

test('an execution correction keeps its version across refresh and closing restores server values', async () => {
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
  expect(await screen.findByText('Montant autorisé')).toBeVisible()
  expect(screen.getAllByText('Dépenses enregistrées')[0]).toBeVisible()
  expect(screen.getByText('Dépenses acceptées')).toBeVisible()
  const administration = within(
    screen.getByRole('region', { name: 'Demandes financières' }),
  )
  const financialDialog = await openFinancialDrawer(
    user,
    'Nouvelle demande',
    'Non renseigné',
    false,
  )
  expect(financialDialog).toHaveAccessibleName('Demande de décaissement')
  expect(
    within(
      screen.getByRole('region', {
        name: 'Suivi administratif et clôture',
      }),
    ).getAllByText('Clôture de l’activité', { exact: true })[0],
  ).toBeVisible()
  expect(
    administration.queryByRole('link', {
      name: 'Consulter les pièces justificatives',
    }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', {
      name: 'Modifier la réalisation Préparer la session',
    }),
  )
  expect(
    screen.getByRole('dialog', { name: 'Préparer la session' }),
  ).toHaveTextContent('Former les équipes')
  expect(
    screen.getByRole('dialog', { name: 'Préparer la session' }),
  ).toHaveTextContent('Montant prévu')
  expect(screen.getByLabelText('Dépense enregistrée (F CFA)')).toBeVisible()
  expect(screen.getByLabelText('Avancement physique (%)')).toBeVisible()
  expect(
    within(
      screen.getByRole('dialog', { name: 'Préparer la session' }),
    ).queryByText('Pièces justificatives'),
  ).not.toBeInTheDocument()
  await user.clear(screen.getByLabelText('Dépense enregistrée (F CFA)'))
  await user.type(
    screen.getByLabelText('Dépense enregistrée (F CFA)'),
    '115000',
  )
  await user.type(
    await screen.findByLabelText('Motif de la correction *'),
    'Corriger la dépense.',
  )
  current = {
    ...current,
    version: 8,
    tasks: [
      {
        ...current.tasks[0],
        actual_spent: '110000',
        progress: '0.00',
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
        actual_spent: '115000',
      }),
    ),
  )
  const editor = screen.getByRole('dialog', { name: 'Préparer la session' })
  await waitFor(() =>
    expect(
      within(editor).getByRole('button', { name: 'Annuler' }),
    ).toBeEnabled(),
  )
  await user.click(within(editor).getByRole('button', { name: 'Annuler' }))
  await user.click(
    screen.getByRole('button', {
      name: 'Modifier la réalisation Préparer la session',
    }),
  )
  expect(screen.getByLabelText('Dépense enregistrée (F CFA)')).toHaveValue(
    '110 000',
  )
  expect(screen.getByLabelText('Avancement physique (%)')).toHaveValue('0,00')
  await user.clear(screen.getByLabelText('Dépense enregistrée (F CFA)'))
  await user.type(
    screen.getByLabelText('Dépense enregistrée (F CFA)'),
    '120000',
  )
  await user.type(
    await screen.findByLabelText('Motif de la correction *'),
    'Compléter.',
  )
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer', exact: true }),
  )
  await waitFor(() =>
    expect(writes[1]).toEqual(
      expect.objectContaining({ expected_version: 8, actual_spent: '120000' }),
    ),
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
          closed_by_name: 'Agent de test',
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
  const closureStep = button.closest('section')
  expect(closureStep).toHaveAttribute('data-administrative-state', 'pending')
  await user.click(button)
  const dialog = screen.getByRole('dialog', { name: 'Clôture de l’activité' })
  const confirmation = within(dialog).getByLabelText(
    /Je confirme que l’Activité est entièrement réalisée/,
  )
  expect(confirmation).not.toBeChecked()
  await user.click(confirmation)
  await user.click(
    within(dialog).getByRole('button', { name: 'Confirmer la clôture' }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Clôturer l’activité' }),
    ).toBeNull(),
  )
  const completedClosureStep = screen
    .getByText('Clôture de l’activité', { exact: true, selector: 'strong' })
    .closest('section')
  expect(completedClosureStep).toHaveAttribute(
    'data-administrative-state',
    'complete',
  )
  expect(within(completedClosureStep).queryByRole('button')).toBeNull()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/closure',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ expected_version: 11 }),
    }),
  )
})

test.each([
  ['submitted', 'À prévalider'],
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

    const requests = await screen.findByRole('region', {
      name: 'Demandes financières',
    })
    expect(within(requests).getByText(expectedStatus)).toBeVisible()
    expect(
      within(requests).getAllByText('Financement complémentaire', {
        exact: true,
      }),
    ).toHaveLength(2)
  },
)

test('a funding row opens only that current request without another read', async () => {
  const user = userEvent.setup()
  const current = detail({ started: true, completed: true })
  const funding = {
    object: 'list',
    count: 2,
    data: [
      {
        id: 'funding-new',
        amount: '25000',
        state: 'submitted',
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
    next: '/api/v1/activities/activity-1/funding-requests?cursor=older-funding',
    previous: null,
    pending: [],
    allowed_actions: [],
    activity_version: current.version,
    approved_revision_id: current.approved_revision_id,
  }
  const fundingReads = []
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
      if (path.includes('/funding-requests')) {
        fundingReads.push(path)
        return new Response(JSON.stringify(funding))
      }
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
  const router = makeExecutionRouter(
    createMemoryHistory({
      initialEntries: ['/execution/activities/activity-1'],
    }),
  )
  render(<App router={router} />)

  const requests = await screen.findByRole('region', {
    name: 'Demandes financières',
  })
  const fundingPagination = within(requests).getByRole('navigation', {
    name: 'Pagination — Financements complémentaires',
  })
  await user.click(
    within(fundingPagination).getByRole('button', { name: 'Suivant' }),
  )
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(
      '/execution/activities/activity-1',
    )
    expect(router.state.location.search.fundingCursor).toBe('older-funding')
  })
  const currentRequests = await screen.findByRole('region', {
    name: 'Demandes financières',
  })
  await user.click(
    within(currentRequests).getAllByRole('button', { name: 'Consulter' })[0],
  )

  const dialog = await screen.findByRole('dialog', {
    name: 'Financement complémentaire',
  })
  expect(
    within(dialog).getByRole('heading', { name: /25.*000.*À prévalider/ }),
  ).toBeVisible()
  expect(
    within(dialog).queryByRole('heading', { name: /10.*000.*Approuvé/ }),
  ).toBeNull()
  expect(
    within(dialog).queryByRole('navigation', {
      name: 'Pagination — Financements complémentaires',
    }),
  ).toBeNull()
  expect(fundingReads).toHaveLength(2)
  expect(fundingReads).toEqual([
    expect.stringMatching(/\/funding-requests$/),
    expect.stringMatching(/\/funding-requests\?cursor=older-funding$/),
  ])
})

test('Agent submits a zero-spending declaration without financial requests', async () => {
  const user = userEvent.setup()
  let current = {
    ...detail({ started: true, completed: true }),
    spending_total: '0',
    balance: '100000',
    required_reversement: '0',
    realization_status: 'completed_pending_validation',
    closure_blockers: ['zero_spending_not_approved'],
    tasks: [
      {
        ...detail({ started: true, completed: true }).tasks[0],
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
  let submissionAttempts = 0
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
      submissionAttempts += 1
      if (submissionAttempts === 1)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              detail: {
                code: 'zero_spending_invalid',
                message: 'La déclaration doit être corrigée.',
              },
            }),
            { status: 422 },
          ),
        )
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
  const router = makeExecutionRouter(
    createMemoryHistory({
      initialEntries: ['/execution/activities/activity-1'],
    }),
  )
  render(<App router={router} />)
  await openFinancialDrawer(user)
  expect(
    await screen.findByRole('heading', {
      name: 'Déclaration de dépense nulle',
    }),
  ).toBeVisible()
  expect(screen.queryByText('Autorisation de décaissement')).toBeNull()
  expect(screen.queryByText('Autorisation de virement')).toBeNull()
  expect(
    screen.getByRole('heading', { name: 'Situation financière' }),
  ).toBeVisible()
  expect(screen.queryByText(/^Réalisation\s*:/)).not.toBeInTheDocument()
  expect(screen.queryByText('Écart financier')).not.toBeInTheDocument()
  expect(
    within(screen.getByText('Dépenses acceptées').parentElement).getByText(
      'Réalisation à soumettre',
    ),
  ).toBeVisible()
  await user.type(
    screen.getByLabelText('Motif de l’absence de dépense *'),
    'Les moyens propres ont suffi.',
  )
  current = { ...current, version: 8 }
  await act(async () =>
    router.options.context.queryClient.setQueryData(
      ['execution', 'agent', 'activity', 'activity-1'],
      current,
    ),
  )
  await user.click(
    screen.getByRole('button', { name: 'Soumettre la déclaration' }),
  )
  const dialog = screen.getByRole('dialog')
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Déclaration refusée. Vérifiez le motif saisi.',
  )
  expect(
    within(dialog).getByLabelText('Motif de l’absence de dépense *'),
  ).toHaveValue('Les moyens propres ont suffi.')
  await user.click(
    within(dialog).getByRole('button', { name: 'Soumettre la déclaration' }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
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
  ['AGENT_VERIFICATEUR', 'submitted', 'prevalidate', 'Prévalider', null],
  ['VALIDATEUR_DEFINITIF', 'prevalidated', 'approve', 'Valider', null],
  [
    'AGENT_VERIFICATEUR',
    'submitted',
    'return',
    'Retourner',
    'Précisez le motif.',
  ],
])(
  '%s performs the projected zero-spending review action',
  async (role, initialState, decision, buttonLabel, returnReason) => {
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
    const router = makeExecutionRouter(
      createMemoryHistory({
        initialEntries: ['/execution/activities/activity-1'],
      }),
    )
    render(<App router={router} />)
    await openFinancialDrawer(
      user,
      decision === 'return' ? 'Consulter' : 'Examiner',
    )
    if (decision === 'prevalidate') {
      expect(await screen.findByLabelText('Motif du retour *')).toBeVisible()
    }
    if (decision === 'return') {
      await user.type(
        await screen.findByLabelText('Motif du retour *'),
        returnReason,
      )
      declaration = { ...declaration, activity_version: 9 }
      const zeroQuery = router.options.context.queryClient
        .getQueryCache()
        .getAll()
        .find((query) => query.queryKey[2] === 'zero-spending')
      await act(async () =>
        router.options.context.queryClient.setQueryData(zeroQuery.queryKey, {
          object: 'list',
          count: 1,
          data: [declaration],
          next: null,
          previous: null,
        }),
      )
    }
    await user.click(await screen.findByRole('button', { name: buttonLabel }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    if (decision === 'approve') {
      await waitFor(() =>
        expect(
          within(
            screen.getByRole('region', { name: 'Demandes financières' }),
          ).getByText('Approuvée'),
        ).toBeVisible(),
      )
    }
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/zero-spending-declarations/zero-1/decisions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expected_version: 7,
          decision,
          ...(returnReason ? { reason: returnReason } : {}),
        }),
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
    if (
      path.endsWith('/zero-spending-declarations') ||
      path.includes('/zero-spending-declarations?cursor=newer')
    )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            object: 'list',
            count: 2,
            data: [active, returned],
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
  await openFinancialDrawer(user, 'Reprendre')
  expect(await screen.findByText('Motif : Ancienne déclaration.')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Soumettre la déclaration' }),
  ).toBeNull()
  await user.click(screen.getByText('Déclarations retournées'))
  expect(
    screen.getByText('Retournée pour correction · Ancienne déclaration.'),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Précédent' }))
  await openFinancialDrawer(user, 'Reprendre')
  expect(await screen.findByText('Motif : Ancienne déclaration.')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Fermer' }))
  await openFinancialDrawer(user, 'Consulter')
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
        closed_by_name: 'Agent de test',
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
    const closureRow = (
      await screen.findByText('Clôture de l’activité', {
        exact: true,
        selector: 'strong',
      })
    ).closest('section')
    expect(closureRow).toHaveAttribute('data-administrative-state', 'complete')
    expect(within(closureRow).queryByRole('button')).toBeNull()
  },
)

test('completed work exposes the financial blocker without a closure action', async () => {
  const current = {
    ...detail({ started: true, completed: true }),
    closure_blockers: ['zero_spending_not_approved'],
  }
  const emptyList = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
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
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            ...emptyList,
            pending: [],
            allowed_actions: [],
            activity_version: current.version,
            approved_revision_id: current.approved_revision_id,
          }),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return new Response(JSON.stringify(current))
      return new Response(JSON.stringify(emptyList))
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

  const closureRow = (
    await screen.findByText('Clôture de l’activité', {
      exact: true,
      selector: 'strong',
    })
  ).closest('section')
  expect(closureRow).toHaveTextContent(
    'La déclaration sans dépense doit être validée.',
  )
  expect(within(closureRow).queryByRole('button')).toBeNull()
})

test.each([
  ['AGENT_VERIFICATEUR', 'submitted', 'prevalidate'],
  ['VALIDATEUR_DEFINITIF', 'prevalidated', 'approve'],
])(
  '%s opens a pending request from Finance without a closure action',
  async (role, state, action) => {
    const user = userEvent.setup()
    const current = {
      ...detail({ started: true, completed: true }),
      spending_total: '0',
      closure_blockers: ['zero_spending_not_approved'],
    }
    const emptyList = {
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    const declaration = {
      id: 'zero-pending',
      activity_id: current.id,
      approved_revision_id: current.approved_revision_id,
      snapshot: { total: '0', operations: [] },
      reason: 'Les moyens propres ont suffi.',
      state,
      submitter_id: 'agent',
      submitted_at: '2026-11-03T10:00:00Z',
      decisions: [],
      allowed_actions: [action, 'return'],
      activity_version: current.version,
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
              user: { id: 'reviewer', email: 'reviewer@example.test', role },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            }),
          )
        if (path.includes('/funding-requests'))
          return new Response(
            JSON.stringify({
              ...emptyList,
              pending: [],
              allowed_actions: [],
              activity_version: current.version,
              approved_revision_id: current.approved_revision_id,
            }),
          )
        if (path.endsWith('/zero-spending-declarations'))
          return new Response(
            JSON.stringify({ ...emptyList, count: 1, data: [declaration] }),
          )
        if (path.endsWith('/activities/activity-1/execution'))
          return new Response(JSON.stringify(current))
        return new Response(JSON.stringify(emptyList))
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

    const closureRow = (
      await screen.findByText('Clôture de l’activité', {
        exact: true,
        selector: 'strong',
      })
    ).closest('section')
    expect(closureRow).toHaveTextContent(
      'La déclaration sans dépense doit être validée.',
    )
    expect(within(closureRow).queryByRole('button')).toBeNull()
    await user.click(
      within(
        screen.getByRole('region', { name: 'Demandes financières' }),
      ).getByRole('button', {
        name: 'Examiner',
      }),
    )
    const requestDialog = screen.getByRole('dialog', {
      name: 'Déclaration sans dépense',
    })
    expect(
      within(requestDialog).getByText('Motif : Les moyens propres ont suffi.'),
    ).toBeVisible()
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
    if (path.includes('/tasks/') && options.method === 'PATCH') {
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
  expect(await screen.findByText('Montant autorisé')).toBeVisible()
  expect(screen.getByText('Non commencée')).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Renseigner Préparer la session' }),
  )
  expect(screen.queryByRole('button', { name: 'Démarrer' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(
    screen.getByText(
      'Renseignez l’avancement ou la dépense avant d’enregistrer.',
    ),
  ).toBeVisible()
  expect(
    await screen.findByLabelText('Dépense enregistrée (F CFA)'),
  ).toBeVisible()
  await user.type(
    screen.getByLabelText('Dépense enregistrée (F CFA)'),
    '100000',
  )
  await user.clear(screen.getByLabelText('Avancement physique (%)'))
  await user.type(screen.getByLabelText('Avancement physique (%)'), '100')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/tasks/22222222-2222-4222-8222-222222222222/execution',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          action: 'record',
          expected_version: 5,
          expected_approved_revision_id: '11111111-1111-4111-8111-111111111111',
          actual_spent: '100000',
          execution_completed: true,
          execution_observation: '',
          progress: '100',
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
    render(
      <App
        router={makeExecutionRouter(
          createMemoryHistory({
            initialEntries: ['/execution/activities/activity-1'],
          }),
        )}
      />,
    )
    if (flow === 'zero-spending') {
      await openFinancialDrawer(user, 'Reprendre')
      expect(await screen.findByText('Vérifier le dossier.')).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Fermer' }))
      await openFinancialDrawer(user)
    } else {
      await openFinancialDrawer(user, 'Reprendre')
      expect(await screen.findByText('Vérifier le dossier.')).toBeVisible()
    }
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
        name: 'Faire la demande',
      }),
    )
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].body).toEqual(
      kind === 'virement'
        ? {
            expected_version: current.version,
            expected_disbursement_request_id: source,
            amount: '100000',
            observation: '',
          }
        : {
            expected_version: current.version,
            expected_approved_revision_id: current.approved_revision_id,
            amount: '100000',
            observation: '',
          },
    )
    expect(requests[1]).toBe(returned)
    expect(returned.state).toBe('returned')
  },
)

test('Agent submits finalized spending for disbursement authorization', async () => {
  const user = userEvent.setup()
  let requests = []
  let cancellationAttempts = 0
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
      cancellationAttempts += 1
      if (cancellationAttempts === 1)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              detail: {
                code: 'version_conflict',
                message: 'La demande a changé. Réessayez.',
              },
            }),
            { status: 409 },
          ),
        )
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
  await openFinancialDrawer(user)
  await user.click(
    await screen.findByRole('button', {
      name: 'Faire la demande',
    }),
  )
  await waitFor(() =>
    expect(
      within(
        screen.getByRole('region', { name: 'Demandes financières' }),
      ).getByText('À prévalider'),
    ).toBeVisible(),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/activities/activity-1/disbursement-requests',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expected_version: 7,
          expected_approved_revision_id: '11111111-1111-4111-8111-111111111111',
          amount: '100000',
          observation: '',
        }),
      }),
    ),
  )
  await user.click(
    screen.getByRole('button', {
      name: 'Consulter',
    }),
  )
  expect(
    await screen.findByRole('dialog', { name: 'Demande de décaissement' }),
  ).toBeVisible()
  expect(fetch).not.toHaveBeenCalledWith(
    '/api/v1/activities/activity-1/disbursement-requests/33333333-3333-4333-8333-333333333333',
    expect.anything(),
  )
  await user.type(screen.getByLabelText('Motif *'), 'Corriger les montants.')
  await user.click(screen.getByRole('button', { name: 'Annuler la demande' }))
  const cancellationDialog = screen.getByRole('dialog', {
    name: 'Demande de décaissement',
  })
  expect(
    await within(cancellationDialog).findByRole('alert'),
  ).toHaveTextContent(
    'Vérification refusée. Vérifiez les informations saisies.',
  )
  expect(within(cancellationDialog).getByLabelText('Motif *')).toHaveValue(
    'Corriger les montants.',
  )
  await user.click(
    within(cancellationDialog).getByRole('button', {
      name: 'Annuler la demande',
    }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Demande de décaissement' }),
    ).toBeNull(),
  )
  expect(
    screen.getByRole('region', { name: 'Demandes financières' }),
  ).toBeVisible()
})

test('financial review opens as a local modal without replacing the Activity page', async () => {
  const user = userEvent.setup()
  let decisionBody = null
  let decisionAttempts = 0
  let request = {
    id: '33333333-3333-4333-8333-333333333333',
    activity_id: 'activity-1',
    amount: '100000',
    state: 'submitted',
    submitted_at: '2026-10-29T09:00:00Z',
    activity_version: 7,
    decisions: [],
    cancellation: null,
    allowed_actions: ['read', 'prevalidate', 'return'],
  }
  const olderRequest = {
    ...request,
    id: '22222222-2222-4222-8222-222222222222',
    amount: '50000',
    state: 'cancelled',
    submitted_at: '2026-10-20T09:00:00Z',
    allowed_actions: ['read'],
  }
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
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
              id: 'supervisor',
              email: 'supervisor@example.test',
              role: 'AGENT_VERIFICATEUR',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (
        path.endsWith(`/disbursement-requests/${request.id}/decisions`) &&
        options.method === 'POST'
      ) {
        decisionAttempts += 1
        decisionBody = JSON.parse(options.body)
        if (decisionAttempts === 1)
          return new Response(
            JSON.stringify({
              detail: {
                code: 'version_conflict',
                message: 'La demande a changé. Réessayez.',
              },
            }),
            { status: 409 },
          )
        request = {
          ...request,
          state: 'prevalidated',
          activity_version: 8,
          allowed_actions: ['read'],
          decisions: [
            {
              id: 'decision-1',
              stage: 'supervisor',
              outcome: 'prevalidated',
              actor_name: 'Superviseur',
              decided_at: '2026-10-30T09:00:00Z',
              reason: 'Dossier vérifié.',
            },
          ],
        }
        return new Response(JSON.stringify(request))
      }
      if (path.endsWith(`/disbursement-requests/${request.id}`))
        return new Response(JSON.stringify(request))
      if (path.includes('/disbursement-requests?cursor=older'))
        return new Response(
          JSON.stringify({
            ...empty,
            count: 2,
            data: [olderRequest],
            previous: '/api/v1/activities/activity-1/disbursement-requests',
          }),
        )
      if (path.endsWith('/disbursement-requests'))
        return new Response(
          JSON.stringify({
            ...empty,
            count: 2,
            data: [request],
            next: '/api/v1/activities/activity-1/disbursement-requests?cursor=older',
          }),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return new Response(
          JSON.stringify(detail({ started: true, completed: true })),
        )
      return new Response(JSON.stringify(empty))
    }),
  )

  const history = createMemoryHistory({
    initialEntries: ['/execution/activities/activity-1'],
  })
  const router = makeExecutionRouter(history)
  render(<App router={router} />)

  const financialRequests = await screen.findByRole('region', {
    name: 'Demandes financières',
  })
  await user.click(
    within(financialRequests).getByRole('button', { name: 'Suivant' }),
  )
  await waitFor(() =>
    expect(history.location.search).toContain('financeCursor=older'),
  )
  const olderFinancialRequests = await screen.findByRole('region', {
    name: 'Demandes financières',
  })
  expect(
    await within(olderFinancialRequests).findByText('50 000 F CFA'),
  ).toBeVisible()
  await user.click(
    within(olderFinancialRequests).getByRole('button', { name: 'Précédent' }),
  )
  const currentFinancialRequests = await screen.findByRole('region', {
    name: 'Demandes financières',
  })
  expect(
    await within(currentFinancialRequests).findByText('100 000 F CFA'),
  ).toBeVisible()

  const dialog = await openFinancialDrawer(user, 'Examiner')
  expect(dialog).toHaveAccessibleName('Demande de décaissement')
  expect(dialog).not.toHaveClass('h-dvh')
  expect(history.location.search).toBe('')
  expect(currentFinancialRequests).toBeInTheDocument()
  expect(within(dialog).queryByLabelText(/montant/i)).toBeNull()
  expect(within(dialog).queryByLabelText(/pièce|fichier/i)).toBeNull()
  expect(within(dialog).queryByText('Pièces justificatives')).toBeNull()
  expect(within(dialog).queryByText(/Historique des demandes/)).toBeNull()
  const refreshedRequest = {
    ...request,
    state: 'prevalidated',
    allowed_actions: ['read'],
    decisions: [
      {
        id: 'remote-decision',
        stage: 'supervisor',
        outcome: 'prevalidated',
        actor_name: 'Autre Superviseur',
        decided_at: '2026-10-30T08:00:00Z',
        reason: 'Décision distante.',
      },
    ],
  }
  const financeQueryKey = router.options.context.queryClient
    .getQueryCache()
    .getAll()
    .find((query) => query.queryKey[2] === 'finance')?.queryKey
  expect(financeQueryKey).toBeDefined()
  await act(async () =>
    router.options.context.queryClient.setQueryData(financeQueryKey, {
      ...empty,
      count: 1,
      data: [refreshedRequest],
    }),
  )
  expect(await within(dialog).findByText('Décision distante.')).toBeVisible()
  expect(
    within(dialog).queryByRole('button', { name: 'Prévalider' }),
  ).toBeNull()
  await act(async () =>
    router.options.context.queryClient.setQueryData(financeQueryKey, {
      ...empty,
      count: 1,
      data: [request],
    }),
  )
  await user.type(
    await within(dialog).findByLabelText('Observation / motif du retour'),
    'Dossier vérifié.',
  )
  await act(async () =>
    router.options.context.queryClient.setQueryData(financeQueryKey, {
      ...empty,
      count: 1,
      data: [{ ...request, activity_version: 9 }],
    }),
  )
  await user.click(within(dialog).getByRole('button', { name: 'Prévalider' }))

  await waitFor(() => expect(decisionAttempts).toBe(1))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Vérification refusée. Vérifiez les informations saisies.',
  )
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(
    within(dialog).getByLabelText('Observation / motif du retour'),
  ).toHaveValue('Dossier vérifié.')
  await user.click(within(dialog).getByRole('button', { name: 'Prévalider' }))

  await waitFor(() =>
    expect(decisionBody).toEqual({
      expected_version: 7,
      decision: 'prevalidate',
      reason: 'Dossier vérifié.',
    }),
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    within(currentFinancialRequests).queryByText(
      /^Prévalidation · Superviseur/,
    ),
  ).not.toBeInTheDocument()

  await act(async () =>
    history.push(
      `/execution/activities/activity-1?financeRequest=${request.id}`,
    ),
  )
  await waitFor(() =>
    expect(history.location.search.financeRequest).toBeUndefined(),
  )
  expect(screen.queryByRole('dialog')).toBeNull()
})

test.each([
  ['AGENT_VERIFICATEUR', 'submitted', ['read'], 'Consulter', null],
  [
    'VALIDATEUR_DEFINITIF',
    'prevalidated',
    ['read', 'approve', 'return'],
    'Examiner',
    'Autoriser',
  ],
])(
  '%s opens the current disbursement locally and sees the projected decision',
  async (role, state, allowedActions, rowAction, decisionAction) => {
    const user = userEvent.setup()
    const request = {
      id: '33333333-3333-4333-8333-333333333333',
      activity_id: 'activity-1',
      amount: '100000',
      state,
      submitted_at: '2026-10-29T09:00:00Z',
      activity_version: 7,
      decisions:
        state === 'prevalidated'
          ? [
              {
                id: 'decision-1',
                stage: 'supervisor',
                outcome: 'prevalidated',
                actor_name: 'Superviseur',
                decided_at: '2026-10-30T09:00:00Z',
                reason: 'Dossier vérifié.',
              },
            ]
          : [],
      cancellation: null,
      allowed_actions: allowedActions,
    }
    const empty = {
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    const fetch = vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/auth/session'))
        return new Response(
          JSON.stringify({
            state: 'verified',
            csrf: 'csrf',
            user: {
              id: role === 'AGENT_VERIFICATEUR' ? 'supervisor' : 'validator',
              email: 'reviewer@example.test',
              role,
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return new Response(
          JSON.stringify(detail({ started: true, completed: true })),
        )
      if (path.endsWith('/disbursement-requests'))
        return new Response(
          JSON.stringify({ ...empty, count: 1, data: [request] }),
        )
      if (path.includes('/funding-requests'))
        return new Response(
          JSON.stringify({
            ...empty,
            pending: [],
            allowed_actions: [],
            activity_version: 7,
            approved_revision_id: null,
          }),
        )
      return new Response(JSON.stringify(empty))
    })
    vi.stubGlobal('fetch', fetch)
    const history = createMemoryHistory({
      initialEntries: ['/execution/activities/activity-1'],
    })
    render(<App router={makeExecutionRouter(history)} />)

    const requests = await screen.findByRole('region', {
      name: 'Demandes financières',
    })
    await user.click(
      await within(requests).findByRole('button', { name: rowAction }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Demande de décaissement',
    })
    expect(dialog).toBeVisible()
    expect(dialog).not.toHaveClass('h-dvh')
    expect(history.location.pathname).toBe('/execution/activities/activity-1')
    expect(history.location.search).toBe('')
    expect(fetch).not.toHaveBeenCalledWith(
      `/api/v1/activities/activity-1/disbursement-requests/${request.id}`,
      expect.anything(),
    )
    if (decisionAction)
      expect(
        within(dialog).getByRole('button', { name: decisionAction }),
      ).toBeVisible()
  },
)

test('virement review uses the shared decision composition and submits its observation', async () => {
  const user = userEvent.setup()
  const requestId = '44444444-4444-4444-8444-444444444444'
  let decisionBody = null
  let request = {
    id: requestId,
    activity_id: 'activity-1',
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '100000',
    state: 'submitted',
    submitted_at: '2026-10-29T09:00:00Z',
    activity_version: 7,
    decisions: [],
    cancellation: null,
    allowed_actions: ['read', 'prevalidate', 'return'],
  }
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    disbursement_request_id: request.disbursement_request_id,
    amount: request.amount,
    current_request_id: request.id,
    current_state: request.state,
    can_submit: false,
    unavailable_reason: 'virement_exists',
  }
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
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
              id: 'supervisor',
              email: 'supervisor@example.test',
              role: 'AGENT_VERIFICATEUR',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (
        path.endsWith(`/virement-requests/${requestId}/decisions`) &&
        options.method === 'POST'
      ) {
        decisionBody = JSON.parse(options.body)
        request = {
          ...request,
          state: 'prevalidated',
          activity_version: 8,
          allowed_actions: ['read'],
        }
        return new Response(JSON.stringify(request))
      }
      if (path.endsWith(`/virement-requests/${requestId}`))
        return new Response(JSON.stringify(request))
      if (path.endsWith('/virement-requests'))
        return new Response(
          JSON.stringify({ ...empty, count: 1, data: [request] }),
        )
      if (path.endsWith('/activities/activity-1/execution'))
        return new Response(JSON.stringify(execution))
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

  const dialog = await openFinancialDrawer(user, 'Examiner')
  expect(dialog).toHaveAccessibleName('Demande de virement')
  expect(dialog).not.toHaveClass('h-dvh')
  expect(within(dialog).getByText('À prévalider')).toBeVisible()
  expect(within(dialog).getByText('virement · 29 octobre 2026')).toBeVisible()
  expect(
    within(dialog).getByRole('heading', { name: 'Décisions' }),
  ).toBeVisible()
  expect(within(dialog).getByText('Aucune décision.')).toBeVisible()
  expect(within(dialog).queryByText(/Historique des demandes/)).toBeNull()
  await user.type(
    within(dialog).getByLabelText('Observation / motif du retour'),
    'Virement vérifié.',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Prévalider' }))

  await waitFor(() =>
    expect(decisionBody).toEqual({
      expected_version: 7,
      decision: 'prevalidate',
      reason: 'Virement vérifié.',
    }),
  )
})

test.each([
  ['décaissement', '/disbursement-requests', 'Faire la demande'],
  ['virement', '/virement-requests', 'Faire la demande'],
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
    await openFinancialDrawer(user)
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

test('virement review displays the total of previously authorized virements', async () => {
  const execution = detail({ started: true, completed: true })
  execution.virement_context = {
    ...execution.virement_context,
    authorized_amount: '100000',
    transferred_amount: '25000',
  }
  const request = {
    id: 'virement-missing',
    activity_version: execution.version,
    amount: null,
    state: 'submitted',
    decisions: [],
    allowed_actions: ['read'],
  }
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
        return new Response(JSON.stringify(execution))
      if (path.endsWith('/virement-requests'))
        return new Response(
          JSON.stringify({ ...empty, count: 1, data: [request] }),
        )
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

  await userEvent
    .setup()
    .click(await screen.findByRole('button', { name: 'Consulter' }))
  const dialog = await screen.findByRole('dialog', {
    name: 'Demande de virement',
  })
  expect(
    within(
      within(dialog).getByText('Virements déjà autorisés').parentElement,
    ).getByText('25 000 F CFA'),
  ).toBeVisible()
})

test('Agent sees the next partial-virement form while the approved one remains confirmable', async () => {
  const user = userEvent.setup()
  const sourceId = '33333333-3333-4333-8333-333333333333'
  const requestId = '44444444-4444-4444-8444-444444444444'
  const approvedRequestId = '44444444-4444-4444-8444-444444444443'
  const approvedVirement = {
    id: approvedRequestId,
    activity_id: 'activity-1',
    disbursement_request_id: sourceId,
    amount: '25000',
    state: 'approved',
    submitter_id: 'agent',
    submitted_at: '2026-10-28T09:00:00Z',
    cancellation: null,
    decisions: [],
    allowed_actions: ['read', 'declare_confirmation'],
    current_confirmation: null,
    activity_version: 7,
  }
  let virement = approvedVirement
  const execution = detail({ started: true, completed: true })
  execution.disbursement_can_submit = false
  execution.virement_context = {
    disbursement_request_id: sourceId,
    amount: '100000',
    transferred_amount: '25000',
    current_request_id: approvedRequestId,
    current_state: 'approved',
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
    if (
      path.endsWith(
        `/virement-requests/${approvedRequestId}/confirmation/history`,
      )
    )
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
    if (path.endsWith(`/virement-requests/${approvedRequestId}`))
      return Promise.resolve(new Response(JSON.stringify(approvedVirement)))
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
  const requestDialog = await openFinancialDrawer(
    user,
    'Nouvelle demande',
    null,
    true,
    'Autorisation de virement',
    false,
  )
  expect(within(requestDialog).getByText('Budget prévu')).toBeVisible()
  expect(
    within(requestDialog).getByText('Virements déjà autorisés'),
  ).toBeVisible()
  expect(
    within(
      within(requestDialog).getByText('Virements déjà autorisés').parentElement,
    ).getByText('25 000 F CFA'),
  ).toBeVisible()
  expect(
    within(requestDialog).getByRole('textbox', {
      name: 'Montant total demandé (F CFA)',
    }),
  ).toHaveValue('100\u202f000')
  await waitFor(() =>
    expect(
      within(requestDialog).getByRole('button', { name: 'Faire la demande' }),
    ).toBeEnabled(),
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
  let confirmationAttempts = 0
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
      confirmationAttempts += 1
      if (confirmationAttempts === 1)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              detail: {
                code: 'version_conflict',
                message: 'La demande a changé. Réessayez.',
              },
            }),
            { status: 409 },
          ),
        )
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
  const virementDialog = within(
    await openAdministrativeDrawer(
      user,
      'Enregistrer le virement',
      'Confirmer le virement effectué',
    ),
  )
  expect(await virementDialog.findByText('Former les équipes')).toBeVisible()
  expect(
    virementDialog.getByLabelText('Montant réellement viré (F CFA)'),
  ).toHaveValue('100 000')
  expect(
    virementDialog.getByLabelText('Montant réellement viré (F CFA)'),
  ).toHaveAttribute('readonly')
  await user.click(
    virementDialog.getByRole('button', {
      name: /Date effective du virement/,
    }),
  )
  fireEvent.change(
    virementDialog.getByLabelText('Date effective du virement'),
    {
      target: { value: '2026-10-28' },
    },
  )
  await user.type(
    virementDialog.getByLabelText(/Référence ou commentaire/),
    'TEST-001',
  )
  await user.click(virementDialog.getByLabelText(/Je confirme que ce montant/))
  await user.click(
    virementDialog.getByRole('button', {
      name: 'Confirmer la déclaration',
    }),
  )
  await waitFor(() =>
    expect(
      virementDialog.getByRole('button', {
        name: 'Confirmer la déclaration',
      }),
    ).toBeEnabled(),
  )
  expect(await virementDialog.findByRole('alert')).toHaveTextContent(
    'Vérification refusée. Vérifiez les informations saisies.',
  )
  expect(
    screen.getByRole('dialog', { name: 'Confirmer le virement effectué' }),
  ).toBeVisible()
  expect(
    virementDialog.getByRole('button', {
      name: 'Date effective du virement : 28 octobre 2026',
    }),
  ).toBeVisible()
  expect(virementDialog.getByLabelText(/Référence ou commentaire/)).toHaveValue(
    'TEST-001',
  )
  await user.click(
    virementDialog.getByRole('button', {
      name: 'Confirmer la déclaration',
    }),
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
  let virementPanel = within(
    await openAdministrativeDrawer(
      user,
      'Modifier le virement',
      'Modifier le virement effectué',
    ),
  )
  await virementPanel.findByRole('button', {
    name: 'Corriger la déclaration',
  })
  await user.click(
    virementPanel.getByRole('button', { name: /Date effective du virement/ }),
  )
  fireEvent.change(screen.getByLabelText('Date effective du virement'), {
    target: { value: '2026-10-27' },
  })
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
      screen.queryByRole('dialog', { name: 'Modifier le virement effectué' }),
    ).not.toBeInTheDocument(),
  )
  virementPanel = within(
    await openAdministrativeDrawer(
      user,
      'Modifier le virement',
      'Modifier le virement effectué',
    ),
  )
  expect(
    virementPanel.getByRole('button', {
      name: 'Date effective du virement : 27 octobre 2026',
    }),
  ).toBeVisible()
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
      screen.queryByRole('dialog', { name: 'Modifier le virement effectué' }),
    ).not.toBeInTheDocument(),
  )
  virementPanel = within(
    await openAdministrativeDrawer(
      user,
      'Modifier le virement',
      'Modifier le virement effectué',
    ),
  )
  const recordedTransfer = within(
    await virementPanel.findByRole('region', { name: 'Virement enregistré' }),
  )
  expect(recordedTransfer.getByText(/100.*000 F CFA/)).toBeVisible()
  expect(recordedTransfer.getByText('27 octobre 2026')).toBeVisible()
  expect(recordedTransfer.getByText('TEST-003')).toBeVisible()
  expect(
    virementPanel.queryByText(/Historique des déclarations/),
  ).not.toBeInTheDocument()
  expect(virementPanel.queryByText(/^Version /)).not.toBeInTheDocument()
}, 15000)

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
  let reversementDeclarationAttempts = 0
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
      reversementDeclarationAttempts += 1
      if (reversementDeclarationAttempts === 1)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              detail: {
                code: 'version_conflict',
                message: 'La demande a changé. Réessayez.',
              },
            }),
            { status: 409 },
          ),
        )
      const body = JSON.parse(options.body)
      const declared = {
        id: 'reversement-1',
        request_id: requestId,
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

  const rowAction = await screen.findByRole('button', {
    name: 'Enregistrer le reversement',
  })
  const reversementRow = rowAction.closest('section')
  expect(reversementRow).toHaveTextContent('100 000 F CFA')
  const reversementDialog = within(
    await openAdministrativeDrawer(
      user,
      'Enregistrer le reversement',
      'Reversement des fonds non utilisés',
    ),
  )
  const title = await reversementDialog.findByRole('heading', {
    name: 'Reversement au Partenaire',
  })
  const panel = within(title.closest('section'))
  expect(
    within(panel.getByText('Montant à reverser').parentElement).getByText(
      '100 000 F CFA',
      { exact: true },
    ),
  ).toBeVisible()
  const dialog = reversementDialog
  expect(dialog.getAllByText('100 000 F CFA', { exact: true })).toHaveLength(2)
  expect(dialog.getByText(/montant dépensé/i)).toHaveTextContent(
    '200 000 F CFA',
  )
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
  await waitFor(() =>
    expect(
      dialog.getByRole('button', { name: 'Enregistrer le reversement' }),
    ).toBeEnabled(),
  )
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'Vérification refusée. Vérifiez les informations saisies.',
  )
  expect(
    screen.getByRole('dialog', {
      name: 'Reversement des fonds non utilisés',
    }),
  ).toBeVisible()
  expect(
    dialog.getByRole('button', {
      name: 'Date effective du reversement : 28 octobre 2026',
    }),
  ).toBeVisible()
  expect(
    dialog.getByLabelText(/Référence ou commentaire du reversement/),
  ).toHaveValue('REVERSEMENT-001')
  expect(
    dialog.getByLabelText(/Pièce justificative du reversement/).files[0],
  ).toBe(evidence)
  await user.click(
    dialog.getByRole('button', { name: 'Enregistrer le reversement' }),
  )
  await waitFor(() =>
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
    ),
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
  ).toHaveLength(2)
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
      screen.queryByRole('dialog', {
        name: 'Reversement des fonds non utilisés',
      }),
    ).not.toBeInTheDocument(),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Modifier le reversement' }),
  )
  const correctionDialog = within(
    screen.getByRole('dialog', {
      name: 'Reversement des fonds non utilisés',
    }),
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
    ),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: 'Reversement des fonds non utilisés',
      }),
    ).not.toBeInTheDocument(),
  )
  const historyDialog = within(
    await openAdministrativeDrawer(
      user,
      'Modifier le reversement',
      'Reversement des fonds non utilisés',
    ),
  )
  await user.click(
    await historyDialog.findByText('Historique des reversements (2)'),
  )
  expect(historyDialog.getByText('Reversement corrigé')).toBeVisible()
  expect(historyDialog.getByText('Reversement initial')).toBeVisible()
  expect(historyDialog.getAllByText(/Yoann Agent/)).toHaveLength(2)
  expect(historyDialog.queryByText(/^Version /)).not.toBeInTheDocument()
}, 15000)

test('a related virement uses the Activity reversement owner for history and correction', async () => {
  const user = userEvent.setup()
  const activityId = 'activity-owner-routing'
  const selectedId = '44444444-4444-4444-8444-444444444444'
  const ownerId = '55555555-5555-4555-8555-555555555555'
  const execution = detail({ started: true, completed: true })
  execution.id = activityId
  execution.approved_allocation = '300000'
  execution.spending_total = '200000'
  execution.virement_context = {
    disbursement_request_id: '33333333-3333-4333-8333-333333333333',
    amount: '200000',
    current_request_id: selectedId,
    current_state: 'approved',
    can_submit: false,
    unavailable_reason: 'virement_exists',
  }
  const declaration = {
    id: 'reversement-1',
    request_id: ownerId,
    revision: 1,
    returned_amount: '100000',
    return_date: '2026-10-28',
    note: 'REVERSEMENT-001',
    actor_id: 'agent',
    actor_name: 'Yoann Agent',
    recorded_at: '2026-10-28T10:00:00Z',
    correction_reason: null,
  }
  const virement = {
    id: selectedId,
    amount: '100000',
    state: 'approved',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read'],
    current_confirmation: {
      id: 'confirmation-2',
      revision: 1,
      amount: '100000',
      transfer_date: '2026-10-27',
      note: null,
      actor_id: 'agent',
      recorded_at: '2026-10-27T10:00:00Z',
      correction_reason: null,
    },
    reversement: {
      required_amount: '100000',
      declared_amount: '100000',
      status: 'declared',
      current_declaration: declaration,
      allowed_actions: ['read', 'correct'],
    },
    activity_version: 9,
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
    if (path.endsWith(`/virement-requests/${selectedId}`))
      return Promise.resolve(new Response(JSON.stringify(virement)))
    if (path.endsWith(`/virement-requests/${ownerId}/reversement/history`))
      return Promise.resolve(new Response(JSON.stringify(empty)))
    if (
      path.endsWith(`/virement-requests/${ownerId}/reversement/corrections`) &&
      options.method === 'POST'
    )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...declaration,
            revision: 2,
            correction_reason: 'Date vérifiée.',
            activity_version: 10,
          }),
        ),
      )
    if (path.endsWith(`/activities/${activityId}/execution`))
      return Promise.resolve(new Response(JSON.stringify(execution)))
    if (path.includes('/funding-requests'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...empty,
            pending: [],
            allowed_actions: [],
            activity_version: 0,
            approved_revision_id: null,
          }),
        ),
      )
    return Promise.resolve(new Response(JSON.stringify(empty)))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <App
      router={makeExecutionRouter(
        createMemoryHistory({
          initialEntries: [`/execution/activities/${activityId}`],
        }),
      )}
    />,
  )

  const dialog = within(
    await openAdministrativeDrawer(
      user,
      'Modifier le reversement',
      'Reversement des fonds non utilisés',
    ),
  )
  expect(dialog.getByText(/montant dépensé/i)).toHaveTextContent(
    '200 000 F CFA',
  )
  expect(fetch).toHaveBeenCalledWith(
    `/api/v1/activities/${activityId}/virement-requests/${ownerId}/reversement/history`,
    expect.objectContaining({ method: 'GET' }),
  )
  await user.type(
    dialog.getByLabelText('Motif de la correction du reversement *'),
    'Date vérifiée.',
  )
  await user.click(dialog.getByLabelText(/montant exact a été reversé/))
  await user.click(
    dialog.getByRole('button', { name: 'Corriger le reversement' }),
  )
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/activities/${activityId}/virement-requests/${ownerId}/reversement/corrections`,
      expect.objectContaining({ method: 'POST' }),
    ),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', {
        name: 'Reversement des fonds non utilisés',
      }),
    ).not.toBeInTheDocument(),
  )
})

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
    await screen.findByRole('button', { name: 'Modifier le virement' })
  ).closest('section')
  expect(confirmationStep).toHaveAttribute(
    'data-administrative-state',
    'complete',
  )
  expect(confirmationStep).toHaveTextContent('100 000 F CFA')
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
  await openFinancialDrawer(user)
  const submit = await screen.findByRole('button', {
    name: 'Faire la demande',
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
      tasks: detail().tasks.map((row) => ({
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
    await openFinancialDrawer(
      user,
      action === 'submit' ? 'Nouvelle demande' : 'Examiner',
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

test('a funding review can cancel and keeps a rejected return reason for retry', async () => {
  const user = userEvent.setup()
  const current = {
    ...detail(),
    execution_paused: true,
    pause_reason: 'funding_required',
    mutation_unavailable_reason: 'funding_required',
  }
  const request = {
    id: 'funding-return',
    amount: '20000',
    snapshot: {
      old_allocation: '100000',
      new_allocation: '120000',
    },
    submitted_at: '2026-11-04T09:00:00Z',
    state: 'submitted',
    decisions: [],
    cancellation: null,
    allowed_actions: ['read', 'prevalidate', 'return'],
  }
  const funding = {
    object: 'list',
    count: 1,
    data: [request],
    next: null,
    previous: null,
    pending: [],
    allowed_actions: [],
    activity_version: current.version,
    approved_revision_id: current.approved_revision_id,
  }
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
              id: 'supervisor',
              email: 'supervisor@example.test',
              role: 'AGENT_VERIFICATEUR',
            },
            expires_at: new Date(Date.now() + 60000).toISOString(),
          }),
        )
      if (
        path.endsWith(`/funding-requests/${request.id}/decisions`) &&
        options.method === 'POST'
      ) {
        writes.push(JSON.parse(options.body))
        if (writes.length === 1)
          return new Response(
            JSON.stringify({
              detail: {
                code: 'funding_return_invalid',
                message: 'Précisez le motif du retour.',
              },
            }),
            { status: 422 },
          )
        return new Response(JSON.stringify({ ...request, state: 'returned' }), {
          status: 201,
        })
      }
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

  let dialog = await openFinancialDrawer(user, 'Examiner')
  await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
  expect(screen.queryByRole('dialog')).toBeNull()

  dialog = await openFinancialDrawer(user, 'Examiner')
  const reason = within(dialog).getByLabelText('Motif')
  await user.type(reason, 'La hausse doit être justifiée.')
  await user.click(
    within(dialog).getByRole('button', { name: 'Retourner le complément' }),
  )

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Vérification refusée. Vérifiez les informations saisies.',
  )
  expect(reason).toHaveValue('La hausse doit être justifiée.')
  expect(writes[0]).toEqual({
    expected_version: 5,
    decision: 'return',
    reason: 'La hausse doit être justifiée.',
  })

  await user.click(
    within(dialog).getByRole('button', { name: 'Retourner le complément' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(writes).toHaveLength(2)
})

test('a reasoned execution correction refreshes funding without a redundant pause banner', async () => {
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
          tasks: current.tasks.map((row) => ({
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
      name: 'Modifier la réalisation Préparer la session',
    }),
  )
  const amount = await screen.findByLabelText('Dépense enregistrée (F CFA)')
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
  await openFinancialDrawer(user)
  await waitFor(() =>
    expect(
      screen.getByRole('button', {
        name: 'Demander le financement complémentaire',
      }),
    ).toBeEnabled(),
  )
  expect(screen.queryByText(/La réalisation est suspendue/)).toBeNull()
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
        { name: 'Modifier la réalisation Préparer la session' },
        { timeout: 3000 },
      ),
    )
    await user.clear(screen.getByLabelText('Dépense enregistrée (F CFA)'))
    await user.type(
      screen.getByLabelText('Dépense enregistrée (F CFA)'),
      '110000',
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
