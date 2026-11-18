import { expect, test } from '@playwright/test'

const empty = {
  object: 'list',
  count: 0,
  data: [],
  next: null,
  previous: null,
  pending: [],
  allowed_actions: [],
}

const tasks = [
  {
    id: 'task-1',
    type_id: 'type-1',
    type_label: 'Formation',
    name: 'Atelier et missions de terrain',
    description: '',
    planned_start: '2026-07-19',
    planned_end: '2026-10-19',
    approved_allocation: '900000',
    allocation: '900000',
    weight: '60.00',
    progress: '40.00',
    position: 1,
    execution_started_at: '2026-07-19T09:00:00Z',
    execution_completed: false,
    actual_spent: '650000',
    execution_observation: 'Missions en cours.',
    allowed_actions: ['record'],
    subtasks: [],
  },
  {
    id: 'task-2',
    type_id: 'type-2',
    type_label: 'Production',
    name: 'Restitution et documentation',
    description: '',
    planned_start: '2026-07-19',
    planned_end: '2026-10-19',
    approved_allocation: '300000',
    allocation: '300000',
    weight: '40.00',
    progress: '0.00',
    position: 2,
    execution_started_at: null,
    execution_completed: false,
    actual_spent: null,
    execution_observation: '',
    allowed_actions: ['read'],
    subtasks: [
      {
        id: 'subtask-1',
        name: 'Préparation des supports communaux',
        description: '',
        planned_start: '2026-07-19',
        planned_end: '2026-08-19',
        approved_allocation: '100000',
        weight: '40.00',
        execution_started_at: null,
        execution_completed: false,
        actual_spent: null,
        execution_observation: '',
        allowed_actions: ['read'],
      },
      {
        id: 'subtask-2',
        name: 'Compte rendu des missions',
        description: '',
        planned_start: '2026-07-19',
        planned_end: '2026-10-19',
        approved_allocation: '200000',
        weight: '60.00',
        execution_started_at: null,
        execution_completed: false,
        actual_spent: null,
        execution_observation: '',
        allowed_actions: ['read'],
      },
    ],
  },
]

const execution = {
  id: 'activity-1',
  pta_id: 'pta-1',
  project_id: 'project-1',
  project_name: 'Protection de l’enfant et accès à la justice',
  partner_name: 'UNICEF',
  pta_name: 'PTA 2026',
  reference: 'MJL-A006',
  name: 'Suivi des points d’accès à la justice',
  description: 'Suivre les activités de terrain.',
  planned_start: '2026-07-19',
  planned_end: '2026-10-19',
  approved_allocation: '1200000',
  approved_revision_id: '11111111-1111-4111-8111-111111111111',
  version: 6,
  state: 'approved',
  closure: null,
  closure_blockers: ['execution_incomplete'],
  execution_paused: false,
  pause_reason: null,
  mutation_unavailable_reason: null,
  completed_tasks: 0,
  task_count: 2,
  progress: '20.00',
  works_completed: false,
  spending_total: '650000',
  balance: null,
  required_reversement: null,
  realization_status: 'in_progress',
  virement_context: {
    disbursement_request_id: null,
    amount: null,
    current_request_id: null,
    current_state: null,
    can_submit: false,
    unavailable_reason: 'disbursement_required',
  },
  allowed_actions: ['read'],
  tasks,
}

const activity = {
  ...execution,
  placement_year: 2026,
  allocation: execution.approved_allocation,
  agents: [
    {
      id: 'agent',
      full_name: 'Aïcha HOUNKPATIN',
      email: 'aicha@example.test',
    },
    {
      id: 'agent-2',
      full_name: 'Patrick ADJOVI',
      email: 'patrick@example.test',
    },
  ],
  agent_ids: ['agent', 'agent-2'],
  tasks,
  approved: null,
  candidate: null,
  amendment: null,
  withdrawal: null,
  transfer: null,
  correction: null,
  creator: { id: 'agent', full_name: 'Aïcha HOUNKPATIN' },
  allowed_actions: ['read'],
}

test('Activity realization and finance follow the approved detail composition', async ({
  page,
}) => {
  let financeRequests = empty
  let executionFails = false
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: {
            id: 'agent',
            full_name: 'Aïcha HOUNKPATIN',
            email: 'aicha@example.test',
            role: 'AGENT_SAISIE',
          },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (path === '/api/v1/activities/activity-1')
      return route.fulfill({ json: activity })
    if (path === '/api/v1/activities/activity-1/execution')
      return executionFails
        ? route.fulfill({ status: 503, json: {} })
        : route.fulfill({ json: execution })
    if (path === '/api/v1/activities/activity-1/disbursement-requests')
      return route.fulfill({ json: financeRequests })
    return route.fulfill({ json: empty })
  })

  await page.setViewportSize({ width: 1846, height: 970 })
  await page.goto('/activities/activity-1?tab=realization&origin=execution')
  await expect(page.getByRole('heading', { name: activity.name })).toBeVisible()
  await expect(page.getByText('Révision', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Avancement physique')).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Tâche / période' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Afficher' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await expect(
    page.getByRole('heading', { name: 'Validation de la réalisation' }),
  ).toBeVisible()
  const validation = page
    .getByRole('heading', { name: 'Validation de la réalisation' })
    .locator('..')
    .locator('..')
  await expect(validation.getByText('Consulter', { exact: true })).toBeVisible()
  await page.screenshot({
    path: '/tmp/mjl-activity-realization.png',
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Afficher' }).click()
  await expect(
    page.getByText('Préparation des supports communaux'),
  ).toBeVisible()
  await page.screenshot({
    path: '/tmp/mjl-activity-realization-subtasks.png',
    fullPage: true,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({
    path: '/tmp/mjl-activity-realization-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 1846, height: 970 })

  await page.getByRole('link', { name: 'Finance', exact: true }).click()
  for (const name of [
    'Situation financière',
    'Demandes financières',
    'Suivi administratif et clôture',
  ])
    await expect(page.getByRole('region', { name })).toBeVisible()
  await expect(page.getByText('Dépenses par tâche')).toBeVisible()
  await expect(page.getByText('Écart financier')).toHaveCount(0)
  const financialSituation = page.getByRole('region', {
    name: 'Situation financière',
  })
  await expect(
    financialSituation.getByText('Autorisation à obtenir'),
  ).toBeVisible()
  await page.screenshot({
    path: '/tmp/mjl-activity-finance.png',
    fullPage: true,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({
    path: '/tmp/mjl-activity-finance-mobile.png',
    fullPage: true,
  })

  financeRequests = {
    ...empty,
    count: 1,
    data: [
      {
        id: 'request-1',
        amount: '650000',
        state: 'submitted',
        submitted_at: '2026-09-28T10:00:00Z',
        decisions: [
          {
            id: 'decision-1',
            outcome: 'prevalidated',
            actor_name: 'Clarisse AKPON',
            decided_at: '2026-09-29T11:30:00Z',
          },
        ],
        allowed_actions: ['read'],
      },
    ],
  }
  await page.reload()
  await expect(
    financialSituation.getByText('Autorisation en cours'),
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Demande / date' }),
  ).toBeVisible()
  await expect(page.getByText(/Prévalidée · Clarisse AKPON/)).toBeVisible()
  await page.getByRole('button', { name: 'Consulter' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Autorisation de décaissement' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Fermer' }).click()

  financeRequests = {
    ...financeRequests,
    data: [{ ...financeRequests.data[0], state: 'approved' }],
  }
  await page.reload()
  await expect(
    financialSituation
      .getByText('Montant autorisé')
      .locator('..')
      .getByText('650 000 F CFA', { exact: true }),
  ).toBeVisible()

  executionFails = true
  await page.goto('/activities/activity-1?tab=programming&origin=execution')
  await expect(
    page.getByText('Le suivi de réalisation est temporairement indisponible.'),
  ).toBeVisible()
})
