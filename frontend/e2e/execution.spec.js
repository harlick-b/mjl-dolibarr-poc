import { expect, test } from '@playwright/test'

test('PTA-3A start, spending, completion and correction browser journey', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let version = 5
  let started = false
  let completed = false
  let corrected = false
  let mutationCount = 0
  const operation = () => ({
    id: '22222222-2222-4222-8222-222222222222',
    type_id: 'type-1',
    type_label: 'Formation',
    name: 'Préparer la session',
    approved_allocation: '100000',
    position: 1,
    execution_started_at: started ? '2026-10-28T09:00:00Z' : null,
    execution_completed: completed,
    actual_spent: completed ? '120000' : null,
    execution_observation: completed ? 'Écart expliqué.' : '',
    variance: completed ? '20000' : null,
    allowed_actions: started ? ['record'] : ['start'],
  })
  const detail = () => ({
    id: 'activity-1',
    pta_id: 'pta-1',
    project_id: 'project-1',
    reference: 'ACT-000001',
    name: 'Former les équipes',
    planned_start: '2026-10-28',
    planned_end: '2026-12-31',
    approved_allocation: '100000',
    approved_revision_id: '11111111-1111-4111-8111-111111111111',
    version,
    execution_paused: false,
    pause_reason: null,
    mutation_unavailable_reason: null,
    completed_operations: completed ? 1 : 0,
    operation_count: 1,
    works_completed: completed,
    spending_total: completed ? '120000' : null,
    allowed_actions: ['read'],
    operations: [operation()],
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: { id: 'agent', role: 'AGENT_SAISIE' },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (path.endsWith('/execution/history'))
      return route.fulfill({
        json: {
          object: 'list',
          count: corrected ? 3 : 0,
          data: corrected
            ? [
                {
                  id: '3',
                  action: 'operation.execution_corrected',
                  actor_id: 'agent',
                  occurred_at: '2026-10-28T10:00:00Z',
                  operation_id: operation().id,
                  approved_revision_id: '11111111-1111-4111-8111-111111111111',
                  approved_allocation: '100000',
                  before: {},
                  after: {},
                  correction_reason: 'Fin enregistrée trop tôt.',
                },
              ]
            : [],
          next: null,
          previous: null,
        },
      })
    if (path.includes('/operations/') && request.method() === 'PATCH') {
      mutationCount += 1
      const body = request.postDataJSON()
      version += 1
      if (body.action === 'start') started = true
      else if (body.correction_reason) {
        completed = false
        corrected = true
      } else completed = true
      return route.fulfill({ json: detail() })
    }
    if (path.endsWith('/activities/activity-1/execution'))
      return route.fulfill({ json: detail() })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/execution/activities/activity-1')
  await expect(
    page.getByRole('heading', { name: 'Former les équipes' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await page.getByLabel('Montant dépensé (XOF)').fill('120000')
  await page.getByLabel('Observation').fill('Écart expliqué.')
  await page.getByLabel('Opération terminée').check()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Travaux terminés')).toBeVisible()
  await page.getByLabel('Opération terminée').uncheck()
  await page.getByLabel('Montant dépensé (XOF)').fill('')
  await page.getByLabel('Observation').fill('')
  await page
    .getByLabel('Motif de la correction')
    .fill('Fin enregistrée trop tôt.')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Fin enregistrée trop tôt.')).toBeVisible()
  expect(mutationCount).toBe(3)
  await page.context().setOffline(true)
  await expect(
    page.getByRole('heading', { name: 'Vérification de l’accès' }),
  ).toBeVisible()
  await page.waitForTimeout(100)
  expect(mutationCount).toBe(3)
  await page.context().setOffline(false)
})

test('reviewer sees pause, resume and paginated history without mutation controls', async ({
  page,
}) => {
  let paused = true
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: { id: 'reviewer', role: 'AGENT_VERIFICATEUR' },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (url.pathname.endsWith('/execution/history')) {
      const second = Boolean(url.searchParams.get('cursor'))
      return route.fulfill({
        json: {
          object: 'list',
          count: 2,
          data: [
            {
              id: second ? 'older' : 'newer',
              action: 'operation.execution_started',
              actor_id: 'agent',
              occurred_at: second
                ? '2026-10-27T09:00:00Z'
                : '2026-10-28T09:00:00Z',
              operation_id: 'operation-1',
              approved_revision_id: 'revision-1',
              approved_allocation: '100000',
              before: {},
              after: {},
              correction_reason: null,
            },
          ],
          next: second
            ? null
            : 'http://testserver/api/v1/activities/activity-1/execution/history?cursor=older',
          previous: second
            ? 'http://testserver/api/v1/activities/activity-1/execution/history'
            : null,
        },
      })
    }
    if (url.pathname.endsWith('/activities/activity-1/execution'))
      return route.fulfill({
        json: {
          id: 'activity-1',
          pta_id: 'pta-1',
          project_id: 'project-1',
          reference: 'ACT-000001',
          name: 'Former les équipes',
          planned_start: '2026-10-28',
          planned_end: '2026-12-31',
          approved_allocation: '100000',
          approved_revision_id: 'revision-1',
          version: 5,
          execution_paused: paused,
          pause_reason: paused ? 'amendment_pending' : null,
          mutation_unavailable_reason: paused
            ? 'amendment_pending'
            : 'reviewer_read_only',
          completed_operations: 0,
          operation_count: 1,
          works_completed: false,
          spending_total: null,
          allowed_actions: ['read'],
          operations: [
            {
              id: 'operation-1',
              type_id: 'type-1',
              type_label: 'Formation',
              name: 'Préparer la session',
              approved_allocation: '100000',
              position: 1,
              execution_started_at: null,
              execution_completed: false,
              actual_spent: null,
              execution_observation: '',
              variance: null,
              allowed_actions: [],
            },
          ],
        },
      })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/execution/activities/activity-1')
  await expect(page.getByText(/une modification est en cours/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Démarrer' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Suivant' }).click()
  await expect(page.getByText('2026-10-27T09:00:00Z')).toBeVisible()
  paused = false
  await page.reload()
  await expect(page.getByText(/uniquement la consultation/)).toBeVisible()
  await page.evaluate(() => {
    const channel = new BroadcastChannel('mjl-auth')
    channel.postMessage('revoked')
    channel.close()
  })
  await expect(
    page.getByRole('heading', { name: 'Vérification de l’accès' }),
  ).toBeVisible()
})
