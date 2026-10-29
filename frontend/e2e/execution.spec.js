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

test('PTA-3B and PTA-3C two-stage financial authorizations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let role = 'AGENT_SAISIE'
  let version = 7
  let request = null
  let requestNumber = 0
  let virement = null
  let cancelledVirement = null
  let virementNumber = 0
  const actions = () => {
    if (!request) return []
    if (
      role === 'AGENT_SAISIE' &&
      !['approved', 'cancelled'].includes(request.state)
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
      !['approved', 'cancelled'].includes(virement.state)
    )
      return ['read', 'cancel']
    if (role === 'AGENT_VERIFICATEUR' && virement.state === 'submitted')
      return ['read', 'prevalidate', 'return']
    if (role === 'VALIDATEUR_DEFINITIF' && virement.state === 'prevalidated')
      return ['read', 'approve', 'return']
    return ['read']
  }
  const virementResult = () =>
    virement
      ? {
          ...virement,
          activity_version: version,
          allowed_actions: virementActions(),
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
          user: { id: role, role },
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
      path.includes('/virement-requests/') &&
      path.endsWith('/cancellation') &&
      incoming.method() === 'POST'
    ) {
      version += 1
      virement.state = 'cancelled'
      virement.cancellation = { reason: incoming.postDataJSON().reason }
      cancelledVirement = structuredClone(virementResult())
      return route.fulfill({ status: 201, json: virementResult() })
    }
    if (
      virement &&
      path.endsWith(`/virement-requests/${virement.id}`) &&
      incoming.method() === 'GET'
    )
      return route.fulfill({ json: virementResult() })
    if (
      cancelledVirement &&
      path.endsWith(`/virement-requests/${cancelledVirement.id}`) &&
      incoming.method() === 'GET'
    )
      return route.fulfill({ json: cancelledVirement })
    if (path.endsWith('/virement-requests')) {
      const historical = new URL(incoming.url()).searchParams.has('cursor')
      return route.fulfill({
        json: {
          object: 'list',
          count: virementNumber,
          data: historical
            ? cancelledVirement
              ? [cancelledVirement]
              : []
            : virement
              ? [virementResult()]
              : [],
          next:
            !historical && cancelledVirement
              ? '/api/v1/activities/activity-1/virement-requests?cursor=older'
              : null,
          previous:
            historical && cancelledVirement
              ? '/api/v1/activities/activity-1/virement-requests?cursor=newer'
              : null,
        },
      })
    }
    if (
      path.endsWith('/disbursement-requests') &&
      incoming.method() === 'POST'
    ) {
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
          data: [
            {
              ...financial(),
              id: 'request-cancelled-history',
              state: 'cancelled',
              cancellation: { reason: 'Correction historique.' },
              decisions: [],
              allowed_actions: ['read'],
            },
          ],
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
          approved_allocation: '100000',
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
              virement && virement.state !== 'cancelled' ? virement.id : null,
            current_state:
              virement && virement.state !== 'cancelled'
                ? virement.state
                : null,
            can_submit:
              role === 'AGENT_SAISIE' &&
              request?.state === 'approved' &&
              (!virement || virement.state === 'cancelled'),
            unavailable_reason:
              virement && virement.state !== 'cancelled'
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
              approved_allocation: '100000',
              position: 1,
              execution_started_at: '2026-10-28T09:00:00Z',
              execution_completed: true,
              actual_spent: '100000',
              execution_observation: 'Travaux terminés.',
              variance: '0',
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
  await page.getByLabel('Motif obligatoire').fill('Correction de la saisie.')
  await page.getByRole('button', { name: 'Annuler la demande' }).click()
  await expect(page.getByText('Annulée').first()).toBeVisible()
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
  await expect(page.getByText('Annulée').first()).toBeVisible()

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
  await virementSection
    .getByLabel('Motif obligatoire')
    .fill('Nouvelle demande de virement.')
  await virementSection
    .getByRole('button', { name: 'Annuler la demande' })
    .click()
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
  await virementSection.getByText('Historique des demandes (2)').click()
  await virementSection
    .getByRole('navigation', { name: 'Pagination des virements' })
    .getByRole('button', { name: 'Suivant' })
    .click()
  await expect(page).toHaveURL(/virementCursor=older/)
  await virementSection.getByText('Historique des demandes (2)').click()
  await virementSection
    .getByRole('button', { name: /Annulée.*100.*000 XOF/ })
    .click()
  await expect(page).toHaveURL(
    new RegExp(`virementRequest=${cancelledVirement.id}`),
  )
  await page.goBack()
  await expect(page).toHaveURL(/virementCursor=older/)
  await expect(page).not.toHaveURL(
    new RegExp(`virementRequest=${cancelledVirement.id}`),
  )
  await page.goBack()
  await expect(page).not.toHaveURL(/virementCursor=older/)
  await page.goForward()
  await page.goForward()
  await expect(page).toHaveURL(
    new RegExp(`virementRequest=${cancelledVirement.id}`),
  )
})
