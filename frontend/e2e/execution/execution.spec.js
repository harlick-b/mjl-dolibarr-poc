import { expect, test } from '@playwright/test'

test('PTA-7A Agent submits the zero-spending path without payment controls', async ({
  page,
}) => {
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  let declarations = empty
  let mutations = 0
  const detail = {
    id: 'activity-zero',
    pta_id: 'pta-1',
    project_id: 'project-1',
    reference: 'ACT-000100',
    name: 'Activité réalisée sans dépense',
    planned_start: '2026-10-01',
    planned_end: '2026-10-30',
    approved_allocation: '100000',
    approved_revision_id: '11111111-1111-4111-8111-111111111111',
    version: 7,
    state: 'approved',
    closure: null,
    closure_blockers: ['zero_spending_not_approved'],
    execution_paused: false,
    pause_reason: null,
    mutation_unavailable_reason: null,
    completed_operations: 1,
    operation_count: 1,
    works_completed: true,
    spending_total: '0',
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
        id: 'operation-1',
        type_id: 'type-1',
        type_label: 'Formation',
        name: 'Réaliser la formation',
        approved_allocation: '100000',
        position: 1,
        execution_started_at: '2026-10-01T09:00:00Z',
        execution_completed: true,
        actual_spent: '0',
        execution_observation: 'Moyens propres utilisés.',
        variance: '-100000',
        allowed_actions: ['record'],
      },
    ],
  }
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: {
            id: 'agent',
            email: 'user@example.test',
            role: 'AGENT_SAISIE',
          },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (
      path.endsWith('/zero-spending-declarations') &&
      request.method() === 'POST'
    ) {
      mutations += 1
      const body = request.postDataJSON()
      declarations = {
        ...empty,
        count: 1,
        data: [
          {
            id: 'zero-1',
            activity_id: detail.id,
            approved_revision_id: detail.approved_revision_id,
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
      return route.fulfill({
        json: { ...declarations.data[0], activity_version: 8 },
      })
    }
    if (path.endsWith('/zero-spending-declarations'))
      return route.fulfill({ json: declarations })
    if (path.endsWith('/activities/activity-zero/execution'))
      return route.fulfill({ json: detail })
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return route.fulfill({ json: empty })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/execution/activities/activity-zero')
  await expect(
    page.getByRole('heading', { name: 'Déclaration de dépense nulle' }),
  ).toBeVisible()
  await expect(page.getByText('Autorisation de décaissement')).toHaveCount(0)
  await page.getByLabel('Motif de l’absence de dépense').fill('Moyens propres.')
  await page.context().setOffline(true)
  await expect(
    page.getByRole('heading', { name: 'Vérification de l’accès' }),
  ).toBeVisible()
  expect(mutations).toBe(0)
  await page.context().setOffline(false)
  await page.reload()
  await page.getByLabel('Motif de l’absence de dépense').fill('Moyens propres.')
  await page.getByRole('button', { name: 'Soumettre la déclaration' }).click()
  await expect(page.getByText('Motif : Moyens propres.')).toBeVisible()
  expect(mutations).toBe(1)
})

test('PTA-3F eligible Agent closes and keeps terminal evidence', async ({
  page,
}) => {
  let closed = false
  let closureMutations = 0
  let role = 'AGENT_SAISIE'
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  const detail = () => ({
    id: 'activity-close',
    pta_id: 'pta-1',
    project_id: 'project-1',
    reference: 'ACT-000099',
    name: 'Activité prête à clôturer',
    planned_start: '2026-10-01',
    planned_end: '2026-10-30',
    approved_allocation: '100000',
    approved_revision_id: '11111111-1111-4111-8111-111111111111',
    version: closed ? 13 : 12,
    state: closed ? 'closed' : 'approved',
    closure: closed
      ? { closed_by_id: 'agent', closed_at: '2026-10-30T15:00:00Z' }
      : null,
    closure_blockers: [],
    execution_paused: closed,
    pause_reason: closed ? 'activity_closed' : null,
    mutation_unavailable_reason: closed ? 'activity_closed' : null,
    completed_operations: 1,
    operation_count: 1,
    works_completed: true,
    spending_total: '100000',
    virement_context: {
      disbursement_request_id: 'disbursement-1',
      amount: '100000',
      current_request_id: null,
      current_state: null,
      can_submit: false,
      unavailable_reason: 'virement_exists',
    },
    allowed_actions: closed ? ['read'] : ['read', 'close'],
    operations: [
      {
        id: 'operation-1',
        type_id: 'type-1',
        type_label: 'Formation',
        name: 'Réaliser la formation',
        approved_allocation: '100000',
        position: 1,
        execution_started_at: '2026-10-01T09:00:00Z',
        execution_completed: true,
        actual_spent: '100000',
        execution_observation: 'Terminée.',
        variance: '0',
        allowed_actions: [],
      },
    ],
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: {
            id: role === 'AGENT_SAISIE' ? 'agent' : 'reviewer',
            email: 'actor@example.test',
            role,
          },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (path.endsWith('/closure') && request.method() === 'POST') {
      closureMutations += 1
      expect(request.postDataJSON()).toEqual({ expected_version: 12 })
      closed = true
      return route.fulfill({ json: detail() })
    }
    if (path.endsWith('/activities/activity-close/execution'))
      return route.fulfill({ json: detail() })
    if (
      path.endsWith('/execution/history') ||
      path.endsWith('/disbursement-requests') ||
      path.endsWith('/virement-requests')
    )
      return route.fulfill({ json: empty })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/execution/activities/activity-close')
  await page.context().setOffline(true)
  await expect(
    page.getByRole('heading', { name: 'Vérification de l’accès' }),
  ).toBeVisible()
  expect(closureMutations).toBe(0)
  await page.context().setOffline(false)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Clôturer l’activité' }),
  ).toBeVisible()
  await page.waitForTimeout(100)
  expect(closureMutations).toBe(0)
  await page
    .getByLabel(/Je confirme que l’Activité est entièrement réalisée/)
    .check()
  await page.getByRole('button', { name: 'Clôturer l’activité' }).click()
  await expect(
    page.getByText('Activité clôturée', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Clôturer l’activité' }),
  ).toHaveCount(0)
  expect(closureMutations).toBe(1)
  role = 'AGENT_VERIFICATEUR'
  await page.reload()
  await expect(
    page.getByText('Activité clôturée', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Clôturer l’activité' }),
  ).toHaveCount(0)
  expect(closureMutations).toBe(1)
})

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
    virement_context: {
      disbursement_request_id: null,
      amount: null,
      current_request_id: null,
      current_state: null,
      can_submit: false,
      unavailable_reason: 'disbursement_required',
    },
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
          user: {
            id: 'agent',
            email: 'user@example.test',
            role: 'AGENT_SAISIE',
          },
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
    if (path.endsWith('/disbursement-requests'))
      return route.fulfill({
        json: {
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        },
      })
    if (path.endsWith('/virement-requests'))
      return route.fulfill({
        json: {
          object: 'list',
          count: 0,
          data: [],
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
          user: {
            id: 'reviewer',
            email: 'user@example.test',
            role: 'AGENT_VERIFICATEUR',
          },
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
            : 'http://127.0.0.1:4173/api/v1/activities/activity-1/execution/history?cursor=older',
          previous: second
            ? 'http://127.0.0.1:4173/api/v1/activities/activity-1/execution/history'
            : null,
        },
      })
    }
    if (url.pathname.endsWith('/disbursement-requests'))
      return route.fulfill({
        json: {
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        },
      })
    if (url.pathname.endsWith('/virement-requests'))
      return route.fulfill({
        json: {
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        },
      })
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

test('PTA-3B through PTA-3E administrative settlement journey', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let role = 'AGENT_SAISIE'
  let version = 7
  let request = null
  let requestNumber = 0
  let virement = null
  let returnedVirement = null
  let returnedDisbursement = null
  let virementNumber = 0
  let confirmations = []
  let confirmationMutationCount = 0
  let reversements = []
  let reversementMutationCount = 0
  const actions = () => {
    if (!request) return []
    if (
      role === 'AGENT_SAISIE' &&
      ['submitted', 'prevalidated'].includes(request.state)
    )
      return ['read', 'cancel']
    if (role === 'AGENT_VERIFICATEUR' && request.state === 'submitted')
      return ['read', 'prevalidate', 'return']
    if (role === 'VALIDATEUR_DEFINITIF' && request.state === 'prevalidated')
      return ['read', 'approve', 'return']
    return ['read']
  }
  const financial = () =>
    request
      ? { ...request, activity_version: version, allowed_actions: actions() }
      : null
  const virementActions = () => {
    if (!virement) return []
    if (
      role === 'AGENT_SAISIE' &&
      ['submitted', 'prevalidated'].includes(virement.state)
    )
      return ['read', 'cancel']
    if (role === 'AGENT_VERIFICATEUR' && virement.state === 'submitted')
      return ['read', 'prevalidate', 'return']
    if (role === 'VALIDATEUR_DEFINITIF' && virement.state === 'prevalidated')
      return ['read', 'approve', 'return']
    if (role === 'AGENT_SAISIE' && virement.state === 'approved') {
      if (reversements.length) return ['read']
      return [
        'read',
        confirmations.length ? 'correct_confirmation' : 'declare_confirmation',
      ]
    }
    return ['read']
  }
  const reversementResult = () => {
    if (!confirmations.length) return null
    const current = reversements[0] || null
    return {
      required_amount: '20000',
      declared_amount: current ? '20000' : '0',
      status: current ? 'declared' : 'required',
      current_declaration: current,
      allowed_actions:
        role === 'AGENT_SAISIE'
          ? ['read', current ? 'correct' : 'declare']
          : ['read'],
    }
  }
  const virementResult = () =>
    virement
      ? {
          ...virement,
          activity_version: version,
          allowed_actions: virementActions(),
          reversement: reversementResult(),
        }
      : null
  await page.route('**/api/v1/**', async (route) => {
    const incoming = route.request()
    const path = new URL(incoming.url()).pathname
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: { id: role, email: 'actor@example.test', role },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (path.endsWith('/execution/history'))
      return route.fulfill({
        json: {
          object: 'list',
          count: 0,
          data: [],
          next: null,
          previous: null,
        },
      })
    if (path.endsWith('/virement-requests') && incoming.method() === 'POST') {
      if (virement?.state === 'returned')
        returnedVirement = structuredClone(virementResult())
      version += 1
      virementNumber += 1
      virement = {
        id: `44444444-4444-4444-8444-${String(virementNumber).padStart(12, '4')}`,
        activity_id: 'activity-1',
        disbursement_request_id: request.id,
        approved_revision_id: '11111111-1111-4111-8111-111111111111',
        amount: '100000',
        state: 'submitted',
        submitter_id: 'agent',
        submitted_at: '2026-10-28T13:00:00Z',
        decisions: [],
        cancellation: null,
        current_confirmation: null,
      }
      return route.fulfill({ status: 201, json: virementResult() })
    }
    if (
      path.includes('/virement-requests/') &&
      path.endsWith('/decisions') &&
      incoming.method() === 'POST'
    ) {
      const body = incoming.postDataJSON()
      version += 1
      if (body.decision === 'prevalidate') {
        virement.state = 'prevalidated'
        virement.decisions.push({
          id: 'virement-supervisor',
          stage: 'supervisor',
          outcome: 'prevalidated',
          reason: null,
        })
      } else if (body.decision === 'approve') {
        virement.state = 'approved'
        virement.decisions.push({
          id: 'virement-validator',
          stage: 'validator',
          outcome: 'approved',
          reason: null,
        })
      } else {
        virement.state = 'returned'
        virement.decisions.push({
          id: `virement-return-${virementNumber}`,
          stage: role === 'AGENT_VERIFICATEUR' ? 'supervisor' : 'validator',
          outcome: 'returned',
          reason: body.reason,
        })
      }
      return route.fulfill({ status: 201, json: virementResult() })
    }
    if (
      virement &&
      path.endsWith(`/virement-requests/${virement.id}/confirmation`) &&
      incoming.method() === 'POST'
    ) {
      const body = incoming.postDataJSON()
      confirmationMutationCount += 1
      version += 1
      confirmations = [
        {
          id: 'confirmation-1',
          activity_id: 'activity-1',
          request_id: virement.id,
          revision: 1,
          amount: '100000',
          transfer_date: body.transfer_date,
          note: body.note,
          actor_id: 'agent',
          recorded_at: '2026-10-29T09:00:00Z',
          correction_reason: null,
        },
      ]
      virement.current_confirmation = confirmations[0]
      return route.fulfill({ status: 201, json: confirmations[0] })
    }
    if (
      virement &&
      path.endsWith(
        `/virement-requests/${virement.id}/confirmation/corrections`,
      ) &&
      incoming.method() === 'POST'
    ) {
      const body = incoming.postDataJSON()
      confirmationMutationCount += 1
      version += 1
      const corrected = {
        id: 'confirmation-2',
        activity_id: 'activity-1',
        request_id: virement.id,
        revision: 2,
        amount: '100000',
        transfer_date: body.transfer_date,
        note: body.note,
        actor_id: 'agent',
        recorded_at: '2026-10-29T10:00:00Z',
        correction_reason: body.reason,
      }
      confirmations = [corrected, ...confirmations]
      virement.current_confirmation = corrected
      return route.fulfill({ status: 201, json: corrected })
    }
    if (
      virement &&
      path.endsWith(`/virement-requests/${virement.id}/confirmation/history`)
    ) {
      const older = new URL(incoming.url()).searchParams.has('cursor')
      return route.fulfill({
        json: {
          object: 'list',
          count: confirmations.length,
          data: older ? confirmations.slice(1) : confirmations.slice(0, 1),
          next:
            !older && confirmations.length > 1
              ? `/api/v1/activities/activity-1/virement-requests/${virement.id}/confirmation/history?cursor=older`
              : null,
          previous:
            older && confirmations.length > 1
              ? `/api/v1/activities/activity-1/virement-requests/${virement.id}/confirmation/history?cursor=newer`
              : null,
        },
      })
    }
    if (
      virement &&
      path.endsWith(
        `/virement-requests/${virement.id}/reversement/corrections`,
      ) &&
      incoming.method() === 'POST'
    ) {
      const body = incoming.postDataJSON()
      reversementMutationCount += 1
      version += 1
      const corrected = {
        id: 'reversement-2',
        activity_id: 'activity-1',
        request_id: virement.id,
        confirmation_id: confirmations[0].id,
        revision: 2,
        returned_amount: '20000',
        return_date: body.return_date,
        note: body.note,
        actor_id: 'agent',
        recorded_at: '2026-10-29T12:00:00Z',
        correction_reason: body.reason,
      }
      reversements = [corrected, ...reversements]
      return route.fulfill({ status: 201, json: corrected })
    }
    if (
      virement &&
      path.endsWith(`/virement-requests/${virement.id}/reversement`) &&
      incoming.method() === 'POST'
    ) {
      const body = incoming.postDataJSON()
      reversementMutationCount += 1
      version += 1
      reversements = [
        {
          id: 'reversement-1',
          activity_id: 'activity-1',
          request_id: virement.id,
          confirmation_id: confirmations[0].id,
          revision: 1,
          returned_amount: '20000',
          return_date: body.return_date,
          note: body.note,
          actor_id: 'agent',
          recorded_at: '2026-10-29T11:00:00Z',
          correction_reason: null,
        },
      ]
      return route.fulfill({ status: 201, json: reversements[0] })
    }
    if (
      virement &&
      path.endsWith(`/virement-requests/${virement.id}/reversement/history`)
    ) {
      const older = new URL(incoming.url()).searchParams.has('cursor')
      return route.fulfill({
        json: {
          object: 'list',
          count: reversements.length,
          data: older ? reversements.slice(1) : reversements.slice(0, 1),
          next:
            !older && reversements.length > 1
              ? `/api/v1/activities/activity-1/virement-requests/${virement.id}/reversement/history?cursor=older`
              : null,
          previous:
            older && reversements.length > 1
              ? `/api/v1/activities/activity-1/virement-requests/${virement.id}/reversement/history?cursor=newer`
              : null,
        },
      })
    }
    if (
      path.includes('/virement-requests/') &&
      path.endsWith('/cancellation') &&
      incoming.method() === 'POST'
    ) {
      version += 1
      virement.state = 'cancelled'
      virement.cancellation = { reason: incoming.postDataJSON().reason }
      return route.fulfill({ status: 201, json: virementResult() })
    }
    if (
      virement &&
      path.endsWith(`/virement-requests/${virement.id}`) &&
      incoming.method() === 'GET'
    )
      return route.fulfill({ json: virementResult() })
    if (
      returnedVirement &&
      path.endsWith(`/virement-requests/${returnedVirement.id}`) &&
      incoming.method() === 'GET'
    )
      return route.fulfill({ json: returnedVirement })
    if (path.endsWith('/virement-requests')) {
      const historical = new URL(incoming.url()).searchParams.has('cursor')
      return route.fulfill({
        json: {
          object: 'list',
          count: virementNumber,
          data: historical
            ? returnedVirement
              ? [returnedVirement]
              : []
            : virement
              ? [virementResult()]
              : [],
          next:
            !historical && returnedVirement
              ? '/api/v1/activities/activity-1/virement-requests?cursor=older'
              : null,
          previous:
            historical && returnedVirement
              ? '/api/v1/activities/activity-1/virement-requests?cursor=newer'
              : null,
        },
      })
    }
    if (
      path.endsWith('/disbursement-requests') &&
      incoming.method() === 'POST'
    ) {
      if (request?.state === 'returned')
        returnedDisbursement = structuredClone(financial())
      version += 1
      requestNumber += 1
      request = {
        id: `33333333-3333-4333-8333-${String(requestNumber).padStart(12, '3')}`,
        activity_id: 'activity-1',
        amount: '100000',
        state: 'submitted',
        submitted_at: '2026-10-28T11:00:00Z',
        decisions: [],
        cancellation: null,
      }
      return route.fulfill({ status: 201, json: financial() })
    }
    if (path.endsWith('/decisions') && incoming.method() === 'POST') {
      const body = incoming.postDataJSON()
      version += 1
      if (body.decision === 'prevalidate') {
        request.state = 'prevalidated'
        request.decisions.push({
          id: 'decision-supervisor',
          stage: 'supervisor',
          outcome: 'prevalidated',
          reason: null,
        })
      } else if (body.decision === 'approve') {
        request.state = 'approved'
        request.decisions.push({
          id: 'decision-validator',
          stage: 'validator',
          outcome: 'approved',
          reason: null,
        })
      } else {
        request.state = 'returned'
        request.decisions.push({
          id: `decision-return-${requestNumber}`,
          stage: role === 'AGENT_VERIFICATEUR' ? 'supervisor' : 'validator',
          outcome: 'returned',
          reason: body.reason,
        })
      }
      return route.fulfill({ status: 201, json: financial() })
    }
    if (path.endsWith('/cancellation') && incoming.method() === 'POST') {
      const body = incoming.postDataJSON()
      version += 1
      request.state = 'cancelled'
      request.cancellation = { reason: body.reason }
      return route.fulfill({ status: 201, json: financial() })
    }
    if (
      path.endsWith('/disbursement-requests') &&
      new URL(incoming.url()).searchParams.get('cursor') === 'older'
    )
      return route.fulfill({
        json: {
          object: 'list',
          count: 2,
          data: returnedDisbursement ? [returnedDisbursement] : [],
          next: null,
          previous:
            'http://127.0.0.1:4173/api/v1/activities/activity-1/disbursement-requests?cursor=newer',
        },
      })
    if (path.endsWith('/disbursement-requests'))
      return route.fulfill({
        json: {
          object: 'list',
          count: request ? 2 : 0,
          data: request ? [financial()] : [],
          next: request
            ? 'http://127.0.0.1:4173/api/v1/activities/activity-1/disbursement-requests?cursor=older'
            : null,
          previous: null,
        },
      })
    if (path.endsWith('/activities/activity-1/execution'))
      return route.fulfill({
        json: {
          id: 'activity-1',
          pta_id: 'pta-1',
          project_id: 'project-1',
          reference: 'ACT-000001',
          name: 'Former les équipes',
          planned_start: '2026-10-28',
          planned_end: '2026-12-31',
          approved_allocation: '120000',
          approved_revision_id: '11111111-1111-4111-8111-111111111111',
          version,
          execution_paused: false,
          pause_reason: null,
          mutation_unavailable_reason:
            role === 'AGENT_SAISIE' ? null : 'reviewer_read_only',
          completed_operations: 1,
          operation_count: 1,
          works_completed: true,
          spending_total: '100000',
          virement_context: {
            disbursement_request_id:
              request?.state === 'approved' ? request.id : null,
            amount: request?.state === 'approved' ? request.amount : null,
            current_request_id:
              virement && !['returned', 'cancelled'].includes(virement.state)
                ? virement.id
                : null,
            current_state:
              virement && !['returned', 'cancelled'].includes(virement.state)
                ? virement.state
                : null,
            can_submit:
              role === 'AGENT_SAISIE' &&
              request?.state === 'approved' &&
              (!virement || ['returned', 'cancelled'].includes(virement.state)),
            unavailable_reason:
              virement && !['returned', 'cancelled'].includes(virement.state)
                ? 'virement_exists'
                : request?.state === 'approved'
                  ? role === 'AGENT_SAISIE'
                    ? null
                    : 'reviewer_read_only'
                  : 'disbursement_required',
          },
          allowed_actions: ['read'],
          operations: [
            {
              id: 'operation-1',
              type_id: 'type-1',
              type_label: 'Formation',
              name: 'Préparer la session',
              approved_allocation: '120000',
              position: 1,
              execution_started_at: '2026-10-28T09:00:00Z',
              execution_completed: true,
              actual_spent: '100000',
              execution_observation: 'Travaux terminés.',
              variance: '-20000',
              allowed_actions:
                role === 'AGENT_SAISIE' && !request ? ['record'] : [],
            },
          ],
        },
      })
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/execution/activities/activity-1')
  await page.getByRole('button', { name: /Soumettre.*100.*000 XOF/ }).click()
  await expect(page.getByText('Soumise au Superviseur').first()).toBeVisible()

  role = 'AGENT_VERIFICATEUR'
  await page.reload()
  await page.getByLabel('Motif obligatoire').fill('Préciser la dépense.')
  await page.getByRole('button', { name: 'Retourner' }).click()
  await expect(
    page.getByText('Retournée pour correction').first(),
  ).toBeVisible()

  role = 'AGENT_SAISIE'
  await page.reload()
  await expect(page.getByText(/Préciser la dépense/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Annuler la demande' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: /Soumettre.*100.*000 XOF/ }).click()
  await expect(page.getByText('Soumise au Superviseur').first()).toBeVisible()

  role = 'AGENT_VERIFICATEUR'
  await page.reload()
  await page.getByRole('button', { name: 'Prévalider' }).click()
  await expect(page.getByText(/attente du Validateur/).first()).toBeVisible()

  role = 'VALIDATEUR_DEFINITIF'
  await page.reload()
  await page.getByRole('button', { name: 'Autoriser' }).click()
  await expect(page.getByText('Autorisée').first()).toBeVisible()
  await expect(page.getByText(/paiement a été effectué/)).toBeVisible()
  await page.getByText('Historique des demandes (2)').click()
  await page
    .getByRole('navigation', { name: 'Pagination financière' })
    .getByRole('button', { name: 'Suivant' })
    .click()
  await expect(page).toHaveURL(/financeCursor=older/)
  await page.getByText('Historique des demandes (2)').click()
  await expect(
    page.getByRole('button', { name: /Retournée pour correction/ }),
  ).toBeVisible()

  role = 'AGENT_SAISIE'
  await page.reload()
  const virementSection = page.getByRole('region', {
    name: 'Autorisation de virement',
  })
  await virementSection
    .getByRole('button', { name: /Demander le virement de.*100.*000 XOF/ })
    .click()
  await expect(
    virementSection.getByText('Soumise au Superviseur', { exact: true }),
  ).toBeVisible()

  role = 'AGENT_VERIFICATEUR'
  await page.reload()
  await virementSection
    .getByLabel('Motif obligatoire')
    .fill('Compléter le dossier.')
  await virementSection.getByRole('button', { name: 'Retourner' }).click()
  await expect(
    virementSection.getByText('Retournée pour correction', { exact: true }),
  ).toBeVisible()

  role = 'AGENT_SAISIE'
  await page.reload()
  await expect(virementSection.getByText(/Compléter le dossier/)).toBeVisible()
  await expect(
    virementSection.getByRole('button', { name: 'Annuler la demande' }),
  ).toHaveCount(0)
  await virementSection
    .getByRole('button', { name: /Demander le virement de.*100.*000 XOF/ })
    .click()

  role = 'AGENT_VERIFICATEUR'
  await page.reload()
  await virementSection.getByRole('button', { name: 'Prévalider' }).click()
  role = 'VALIDATEUR_DEFINITIF'
  await page.reload()
  await virementSection.getByRole('button', { name: 'Autoriser' }).click()
  await expect(
    virementSection.getByText('Autorisée', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(/ne confirme pas qu’un virement externe/i),
  ).toBeVisible()

  role = 'AGENT_SAISIE'
  await page.reload()
  await virementSection
    .getByLabel('Date effective du virement')
    .fill('2026-10-28')
  await virementSection
    .getByLabel('Référence ou commentaire (facultatif)')
    .fill('BANQUE-001')
  await virementSection
    .getByLabel('Je confirme que ce montant a été viré.')
    .check()
  await virementSection
    .getByRole('button', { name: 'Enregistrer la déclaration' })
    .click()
  await expect(
    virementSection.getByRole('definition').filter({ hasText: 'BANQUE-001' }),
  ).toBeVisible()
  await expect(
    virementSection.getByRole('definition').filter({ hasText: /^agent$/ }),
  ).toBeVisible()

  await virementSection
    .getByLabel('Date effective du virement')
    .fill('2026-10-27')
  await virementSection
    .getByLabel('Référence ou commentaire (facultatif)')
    .fill('BANQUE-002')
  await virementSection
    .getByLabel('Motif de la correction')
    .fill('Date bancaire corrigée.')
  await virementSection
    .getByLabel('Je confirme que ce montant a été viré.')
    .check()
  await virementSection
    .getByRole('button', { name: 'Corriger la déclaration' })
    .click()
  await expect(
    virementSection.getByRole('definition').filter({ hasText: 'BANQUE-002' }),
  ).toBeVisible()
  await virementSection.getByText('Historique des déclarations (2)').click()
  await virementSection
    .getByRole('navigation', {
      name: 'Pagination des déclarations de virement',
    })
    .getByRole('button', { name: 'Suivant' })
    .click()
  await expect(page).toHaveURL(/confirmationCursor=older/)
  await virementSection.getByText('Historique des déclarations (2)').click()
  await expect(virementSection.getByText('BANQUE-001')).toBeVisible()
  await page.goBack()
  await expect(page).not.toHaveURL(/confirmationCursor=older/)

  await expect(
    virementSection.getByRole('button', { name: 'Corriger la déclaration' }),
  ).toBeVisible()
  expect(confirmationMutationCount).toBe(2)
  const reversementSection = virementSection.getByRole('region', {
    name: 'Reversement au Partenaire',
  })
  await expect(
    reversementSection.getByText('20 000 XOF', { exact: true }).first(),
  ).toBeVisible()
  await reversementSection
    .getByLabel('Date effective du reversement')
    .fill('2026-10-28')
  await reversementSection
    .getByLabel(/Référence ou commentaire du reversement/)
    .fill('REVERSEMENT-001')
  await reversementSection.getByLabel(/montant exact a été reversé/).check()
  await reversementSection
    .getByRole('button', { name: 'Enregistrer le reversement' })
    .click()
  await expect(
    reversementSection
      .getByRole('definition')
      .filter({ hasText: 'REVERSEMENT-001' }),
  ).toBeVisible()
  await expect(
    virementSection.getByRole('button', { name: 'Corriger la déclaration' }),
  ).toHaveCount(0)

  await reversementSection
    .getByLabel('Date effective du reversement')
    .fill('2026-10-29')
  await reversementSection
    .getByLabel(/Référence ou commentaire du reversement/)
    .fill('REVERSEMENT-002')
  await reversementSection
    .getByLabel('Motif de la correction du reversement')
    .fill('Date de reversement corrigée.')
  await reversementSection.getByLabel(/montant exact a été reversé/).check()
  await reversementSection
    .getByRole('button', { name: 'Corriger le reversement' })
    .click()
  await expect(
    reversementSection
      .getByRole('definition')
      .filter({ hasText: 'REVERSEMENT-002' }),
  ).toBeVisible()
  await reversementSection.getByText('Historique des reversements (2)').click()
  await reversementSection
    .getByRole('navigation', {
      name: 'Pagination des déclarations de reversement',
    })
    .getByRole('button', { name: 'Suivant' })
    .click()
  await expect(page).toHaveURL(/reversementCursor=older/)
  await reversementSection.getByText('Historique des reversements (2)').click()
  await expect(
    reversementSection
      .getByRole('listitem')
      .filter({ hasText: 'REVERSEMENT-001' }),
  ).toBeVisible()
  await page.goBack()
  await expect(page).not.toHaveURL(/reversementCursor=older/)
  expect(reversementMutationCount).toBe(2)

  await page.context().setOffline(true)
  await expect(
    page.getByRole('heading', { name: 'Vérification de l’accès' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Vérifier l’accès' }),
  ).toBeDisabled()
  expect(confirmationMutationCount).toBe(2)
  expect(reversementMutationCount).toBe(2)
  await page.context().setOffline(false)
  await page.reload()
  await expect(
    reversementSection.getByRole('button', { name: 'Corriger le reversement' }),
  ).toBeVisible()
  expect(confirmationMutationCount).toBe(2)
  expect(reversementMutationCount).toBe(2)

  role = 'AGENT_VERIFICATEUR'
  await page.reload()
  await expect(
    virementSection.getByRole('button', { name: 'Corriger la déclaration' }),
  ).toHaveCount(0)
  await expect(
    reversementSection.getByRole('button', { name: 'Corriger le reversement' }),
  ).toHaveCount(0)

  role = 'AGENT_SAISIE'
  await page.reload()
  await virementSection.getByText('Historique des demandes (2)').click()
  await virementSection
    .getByRole('navigation', { name: 'Pagination des virements' })
    .getByRole('button', { name: 'Suivant' })
    .click()
  await expect(page).toHaveURL(/virementCursor=older/)
  await virementSection.getByText('Historique des demandes (2)').click()
  await virementSection
    .getByRole('button', { name: /Retournée pour correction.*100.*000 XOF/ })
    .click()
  await expect(page).toHaveURL(
    new RegExp(`virementRequest=${returnedVirement.id}`),
  )
  await page.goBack()
  await expect(page).toHaveURL(/virementCursor=older/)
  await expect(page).not.toHaveURL(
    new RegExp(`virementRequest=${returnedVirement.id}`),
  )
  await page.goBack()
  await expect(page).not.toHaveURL(/virementCursor=older/)
  await page.goForward()
  await page.goForward()
  await expect(page).toHaveURL(
    new RegExp(`virementRequest=${returnedVirement.id}`),
  )
})
