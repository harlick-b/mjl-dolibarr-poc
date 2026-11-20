import { expect, test } from '@playwright/test'

for (const kind of ['disbursement', 'virement']) {
  test(`${kind}: returned request permits a fresh submission and retains history`, async ({
    page,
  }) => {
    const empty = {
      object: 'list',
      pending: [],
      allowed_actions: [],
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    const returnedDecision = {
      id: 'decision-1',
      stage: 'supervisor',
      outcome: 'returned',
      actor_id: 'supervisor',
      actor_name: 'Superviseur test',
      actor_role: 'AGENT_VERIFICATEUR',
      decided_at: '2026-11-01T09:00:00Z',
      reason: 'Vérifier le dossier.',
      prevalidation_decision_id: null,
    }
    const returned = {
      id: 'returned-1',
      activity_id: 'activity-1',
      approved_revision_id: 'revision-1',
      ...(kind === 'virement' ? { disbursement_request_id: 'source-1' } : {}),
      state: 'returned',
      amount: '100000',
      submitter_id: 'agent',
      submitted_at: '2026-10-31T09:00:00Z',
      allowed_actions: ['read'],
      cancellation: null,
      decisions: [returnedDecision],
      ...(kind === 'virement'
        ? { current_confirmation: null, reversement: null }
        : {}),
    }
    const records = [returned]
    const approvedDisbursement = {
      id: 'source-1',
      activity_id: 'activity-1',
      approved_revision_id: 'revision-1',
      amount: '100000',
      state: 'approved',
      submitter_id: 'agent',
      submitted_at: '2026-10-29T09:00:00Z',
      cancellation: null,
      decisions: [
        {
          ...returnedDecision,
          id: 'source-supervisor',
          outcome: 'prevalidated',
          decided_at: '2026-10-29T10:00:00Z',
          reason: null,
        },
        {
          ...returnedDecision,
          id: 'source-validator',
          stage: 'validator',
          outcome: 'approved',
          actor_id: 'validator',
          actor_name: 'Validateur test',
          actor_role: 'VALIDATEUR_DEFINITIF',
          decided_at: '2026-10-30T09:00:00Z',
          reason: null,
          prevalidation_decision_id: 'source-supervisor',
        },
      ],
      allowed_actions: ['read'],
    }
    const detail = {
      id: 'activity-1',
      pta_id: 'pta-1',
      project_id: 'project-1',
      reference: 'ACT-1',
      name: 'Former les équipes',
      description: 'Former les équipes du projet.',
      planned_start: '2026-10-01',
      planned_end: '2026-12-31',
      project_name: 'Projet de test',
      partner_name: 'Partenaire de test',
      pta_name: 'PTA 2026',
      approved_revision_number: 1,
      agents: ['Agent test'],
      approved_allocation: '100000',
      approved_revision_id: 'revision-1',
      version: 7,
      state: 'approved',
      closure: null,
      closure_blockers: [
        kind === 'virement'
          ? 'virement_not_settled'
          : 'disbursement_not_settled',
      ],
      execution_paused: false,
      pause_reason: null,
      mutation_unavailable_reason:
        kind === 'virement' ? 'disbursement_frozen' : null,
      works_completed: true,
      spending_total: '100000',
      disbursement_remaining_amount: '100000',
      disbursement_can_submit: true,
      balance: '0',
      required_reversement: null,
      allowed_actions: ['read'],
      tasks: [
        {
          id: 'task-1',
          type_id: 'type-1',
          type_label: 'Formation',
          name: 'Préparer la session',
          description: 'Préparer les supports.',
          approved_allocation: '100000',
          weight: '100.00',
          planned_start: '2026-10-01',
          planned_end: '2026-12-31',
          progress: '100.00',
          position: 1,
          execution_started_at: '2026-10-20T09:00:00Z',
          execution_completed: true,
          actual_spent: '100000',
          execution_observation: 'Session terminée.',
          variance: '0',
          allowed_actions: [],
          subtasks: [],
        },
      ],
      task_count: 1,
      completed_tasks: 1,
      progress: '100.00',
      realization_status:
        kind === 'virement' ? 'validated' : 'completed_pending_validation',
      virement_context: {
        disbursement_request_id: kind === 'virement' ? 'source-1' : null,
        amount: kind === 'virement' ? '100000' : null,
        authorized_amount: kind === 'virement' ? '100000' : null,
        transferred_amount: null,
        current_request_id: null,
        current_state: null,
        can_submit: kind === 'virement',
        unavailable_reason: null,
        confirmation_revision: null,
      },
    }
    const planningTask = {
      id: 'task-1',
      type_id: 'type-1',
      type_label: 'Formation',
      name: 'Préparer la session',
      description: 'Préparer les supports.',
      allocation: '100000',
      weight: '100.00',
      planned_start: '2026-10-01',
      planned_end: '2026-12-31',
      position: 1,
      subtasks: [],
    }
    const activity = {
      id: 'activity-1',
      pta_id: 'pta-1',
      project_id: 'project-1',
      reference: 'ACT-1',
      name: 'Former les équipes',
      description: 'Former les équipes du projet.',
      planned_start: '2026-10-01',
      planned_end: '2026-12-31',
      allocation: '100000',
      current_revision_id: 'revision-1',
      approved_revision_id: 'revision-1',
      approved_allocation: '100000',
      approved: {
        name: 'Former les équipes',
        description: 'Former les équipes du projet.',
        planned_start: '2026-10-01',
        planned_end: '2026-12-31',
        allocation: '100000',
        tasks: [planningTask],
      },
      candidate: null,
      amendment: null,
      withdrawal: null,
      transfer: null,
      version: 7,
      state: 'approved',
      project_name: 'Projet de test',
      partner_name: 'Partenaire de test',
      pta_name: 'PTA 2026',
      placement_year: 2026,
      execution_paused: false,
      correction: null,
      tasks: [planningTask],
      agents: [],
      agent_ids: ['agent'],
      allowed_actions: [],
      closure: null,
      creator: {
        id: 'agent',
        email: 'user@example.test',
        full_name: 'Agent test',
      },
      current_revision_number: 1,
      current_submitter: null,
      latest_decision_actor: null,
    }
    const writes = []
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname
      const method = request.method()
      if (path === '/api/v1/auth/session' && method === 'GET')
        return route.fulfill({
          json: {
            state: 'verified',
            csrf: 'synthetic',
            user: {
              id: 'agent',
              email: 'user@example.test',
              role: 'AGENT_SAISIE',
            },
            expires_at: new Date(Date.now() + 600000).toISOString(),
          },
        })
      if (path === '/api/v1/notifications' && method === 'GET')
        return route.fulfill({ json: empty })
      if (path === '/api/v1/activities/activity-1' && method === 'GET')
        return route.fulfill({ json: activity })
      if (
        path === '/api/v1/activities/activity-1/execution' &&
        method === 'GET'
      )
        return route.fulfill({ json: detail })
      if (
        path === `/api/v1/activities/activity-1/${kind}-requests` &&
        method === 'POST'
      ) {
        writes.push(request.postDataJSON())
        const fresh = {
          ...returned,
          id: 'fresh-1',
          state: 'submitted',
          submitted_at: '2026-11-02T09:00:00Z',
          decisions: [],
          allowed_actions: ['read', 'cancel'],
        }
        records.unshift(fresh)
        activity.version = 8
        detail.version = 8
        detail.mutation_unavailable_reason = 'disbursement_frozen'
        if (kind === 'virement')
          Object.assign(detail.virement_context, {
            current_request_id: fresh.id,
            current_state: 'submitted',
            can_submit: false,
          })
        return route.fulfill({
          status: 201,
          json: { ...fresh, activity_version: 8 },
        })
      }
      if (
        path === `/api/v1/activities/activity-1/${kind}-requests` &&
        method === 'GET'
      )
        return route.fulfill({
          json: {
            ...empty,
            count: records.length,
            data: records,
          },
        })
      if (
        path === `/api/v1/activities/activity-1/${kind}-requests/returned-1` &&
        method === 'GET'
      )
        return route.fulfill({ json: returned })
      if (
        path === `/api/v1/activities/activity-1/${kind}-requests/fresh-1` &&
        method === 'GET'
      )
        return route.fulfill({ json: records[0] })
      if (
        [
          '/api/v1/activities/activity-1/funding-requests',
          '/api/v1/activities/activity-1/zero-spending-declarations',
          ...(kind === 'disbursement'
            ? ['/api/v1/activities/activity-1/virement-requests']
            : []),
        ].includes(path) &&
        method === 'GET'
      )
        return route.fulfill({ json: empty })
      if (
        kind === 'virement' &&
        path === '/api/v1/activities/activity-1/disbursement-requests' &&
        method === 'GET'
      )
        return route.fulfill({
          json: { ...empty, count: 1, data: [approvedDisbursement] },
        })
      throw new Error(`Unexpected API request: ${method} ${url.pathname}`)
    })
    const title =
      kind === 'virement'
        ? 'Autorisation de virement'
        : 'Autorisation de décaissement'
    const submitName = 'Faire la demande'
    await page.goto('/activities/activity-1?tab=finance&origin=execution')
    const requests = page.getByRole('region', { name: 'Demandes financières' })
    await requests.getByRole('button', { name: 'Reprendre' }).click()
    const section = page.getByRole('region', { name: title })
    await expect(section.getByText(/Vérifier le dossier/)).toBeVisible()
    const returnedAmount = section
      .getByText('Total demandé', { exact: true })
      .locator('..')
    await expect(returnedAmount).toContainText(/100.000 F CFA/)
    await expect(
      section.getByRole('button', { name: /Annuler la demande/ }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Fermer', exact: true }).click()
    await requests.getByRole('button', { name: 'Nouvelle demande' }).click()
    const chooser = page.getByRole('dialog', { name: 'Nouvelle demande' })
    await chooser
      .getByRole('button', { name: 'Créer' })
      .nth(kind === 'virement' ? 1 : 0)
      .click()
    await section.getByRole('button', { name: submitName }).click()
    await expect(
      requests.getByText('À prévalider', { exact: true }),
    ).toBeVisible()
    await expect(
      requests.getByText('À corriger', { exact: true }),
    ).toBeVisible()
    expect(writes).toEqual([
      {
        expected_version: 7,
        ...(kind === 'virement'
          ? { expected_disbursement_request_id: 'source-1' }
          : { expected_approved_revision_id: 'revision-1' }),
        amount: '100000',
        observation: '',
      },
    ])
    await requests.getByRole('button', { name: 'Reprendre' }).click()
    await expect(section.getByText(/Vérifier le dossier/)).toBeVisible()
  })
}
