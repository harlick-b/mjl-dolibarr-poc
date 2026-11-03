import { expect, test } from '@playwright/test'

for (const kind of ['disbursement', 'virement']) {
  test(`${kind}: returned history permits fresh submission on mobile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const empty = {
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    const returned = {
      id: 'returned-1',
      state: 'returned',
      amount: '100000',
      activity_version: 7,
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
    const records = [returned]
    const detail = {
      id: 'activity-1',
      pta_id: 'pta-1',
      project_id: 'project-1',
      reference: 'ACT-1',
      name: 'Former les équipes',
      planned_start: '2026-10-01',
      planned_end: '2026-12-31',
      approved_allocation: '100000',
      approved_revision_id: 'revision-1',
      version: 7,
      state: 'approved',
      closure: null,
      closure_blockers: ['disbursement_not_approved'],
      execution_paused: false,
      pause_reason: null,
      mutation_unavailable_reason:
        kind === 'virement' ? 'disbursement_frozen' : null,
      completed_operations: 1,
      operation_count: 1,
      works_completed: true,
      spending_total: '100000',
      allowed_actions: ['read'],
      operations: [],
      virement_context: {
        disbursement_request_id: kind === 'virement' ? 'source-1' : null,
        amount: kind === 'virement' ? '100000' : null,
        current_request_id: null,
        current_state: null,
        can_submit: kind === 'virement',
        unavailable_reason: null,
      },
    }
    const writes = []
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname
      let body = empty
      if (path.endsWith('/auth/session'))
        body = {
          state: 'verified',
          csrf: 'synthetic',
          user: { id: 'agent', role: 'AGENT_SAISIE' },
          expires_at: new Date(Date.now() + 600000).toISOString(),
        }
      else if (path.endsWith('/execution')) body = detail
      else if (
        path.endsWith(`/${kind}-requests`) &&
        request.method() === 'POST'
      ) {
        writes.push(request.postDataJSON())
        const fresh = {
          ...returned,
          id: 'fresh-1',
          state: 'submitted',
          decisions: [],
          activity_version: 8,
          allowed_actions: ['read', 'cancel'],
        }
        records.unshift(fresh)
        detail.version = 8
        detail.mutation_unavailable_reason = 'disbursement_frozen'
        if (kind === 'virement')
          Object.assign(detail.virement_context, {
            current_request_id: fresh.id,
            current_state: 'submitted',
            can_submit: false,
          })
        body = fresh
      } else if (path.endsWith(`/${kind}-requests`))
        body = {
          ...empty,
          count: records.length,
          data: records,
          previous: url.searchParams.has('cursor')
            ? `/api/v1/activities/activity-1/${kind}-requests`
            : null,
        }
      else if (path.endsWith(`/${kind}-requests/returned-1`)) body = returned
      else if (path.endsWith(`/${kind}-requests/fresh-1`)) body = records[0]
      await route.fulfill({ json: body })
    })
    const selection = kind === 'virement' ? 'virementRequest' : 'financeRequest'
    const cursor = kind === 'virement' ? 'virementCursor' : 'financeCursor'
    const title =
      kind === 'virement'
        ? 'Autorisation de virement'
        : 'Autorisation de décaissement'
    const submitName =
      kind === 'virement' ? /Demander le virement de/ : /^Soumettre/
    // An old cursor page cannot infer that no current request exists.
    await page.goto(
      `/execution/activities/activity-1?${selection}=returned-1&${cursor}=older`,
    )
    const section = page.getByRole('region', { name: title })
    await expect(section.getByText(/Vérifier le dossier/)).toBeVisible()
    await expect(section.getByRole('button', { name: submitName })).toHaveCount(
      0,
    )
    // The latest page displays the return reason without requiring history selection.
    await page.goto('/execution/activities/activity-1')
    await expect(section.getByText(/Vérifier le dossier/)).toBeVisible()
    await expect(
      section.getByRole('button', { name: /Annuler la demande/ }),
    ).toHaveCount(0)
    await section.getByRole('button', { name: submitName }).click()
    await expect(
      section.getByText('Soumise au Superviseur', { exact: true }),
    ).toBeVisible()
    expect(writes).toEqual([
      {
        expected_version: 7,
        ...(kind === 'virement'
          ? { expected_disbursement_request_id: 'source-1' }
          : { expected_approved_revision_id: 'revision-1' }),
      },
    ])
    await section.getByText('Historique des demandes (2)').click()
    await section
      .getByRole('button', { name: /Retournée pour correction/ })
      .click()
    await expect(section.getByText(/Vérifier le dossier/)).toBeVisible()
    await expect(
      section.getByRole('button', { name: submitName }),
    ).toBeDisabled()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}
