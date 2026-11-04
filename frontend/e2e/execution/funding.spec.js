import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  for (const [role, action, label] of [
    ['AGENT_SAISIE', 'submit', 'Demander le financement complémentaire'],
    ['AGENT_VERIFICATEUR', 'prevalidate', 'Prévalider le complément'],
    ['VALIDATEUR_DEFINITIF', 'approve', 'Approuver le complément'],
  ]) {
    test(`funding ${action} at ${width}px reconciles the Activity`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      const empty = {
        object: 'list',
        count: 0,
        data: [],
        next: null,
        previous: null,
      }
      let detail = {
        id: 'activity-1',
        pta_id: 'pta-1',
        project_id: 'project-1',
        reference: 'ACT-000001',
        name: 'Activité à financer',
        planned_start: '2026-11-01',
        planned_end: '2027-02-01',
        approved_allocation: '120000',
        approved_revision_id: '11111111-1111-4111-8111-111111111111',
        version: 5,
        state: 'approved',
        closure: null,
        closure_blockers: ['funding_required'],
        execution_paused: true,
        pause_reason: 'funding_required',
        mutation_unavailable_reason: 'funding_required',
        completed_operations: 0,
        operation_count: 1,
        works_completed: false,
        spending_total: null,
        virement_context: {
          can_submit: false,
          unavailable_reason: 'disbursement_required',
        },
        allowed_actions: ['read'],
        operations: [],
      }
      const basis = {
        base_revision_id: 'old',
        approved_revision_id: detail.approved_revision_id,
        old_allocation: '100000',
        new_allocation: '120000',
        amount: '20000',
      }
      const request = {
        id: 'request-1',
        amount: '20000',
        snapshot: basis,
        submitted_at: '2026-11-04T09:00:00Z',
        state: action === 'approve' ? 'prevalidated' : 'submitted',
        decisions: [],
        cancellation: null,
        allowed_actions: ['read', action],
      }
      let funding = {
        ...empty,
        count: action === 'submit' ? 0 : 1,
        data: action === 'submit' ? [] : [request],
        pending: [basis],
        allowed_actions: action === 'submit' ? ['submit'] : [],
        activity_version: 5,
        approved_revision_id: detail.approved_revision_id,
      }
      const writes = []
      let refreshed = 0
      await page.route('**/api/v1/**', async (route) => {
        const http = route.request()
        const path = new URL(http.url()).pathname
        if (path.endsWith('/auth/session'))
          return route.fulfill({
            json: {
              state: 'verified',
              csrf: 'csrf',
              user: { id: 'actor', role },
              expires_at: new Date(Date.now() + 60000).toISOString(),
            },
          })
        if (http.method() === 'POST') {
          writes.push(http.postDataJSON())
          detail = {
            ...detail,
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
                ...request,
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
          return route.fulfill({
            status: 201,
            json: { ...request, activity_version: 6 },
          })
        }
        if (path.endsWith('/funding-requests'))
          return route.fulfill({ json: funding })
        if (path.endsWith('/execution')) {
          refreshed++
          return route.fulfill({ json: detail })
        }
        return route.fulfill({ json: empty })
      })
      await page.goto('/execution/activities/activity-1')
      const section = page.getByRole('region', {
        name: 'Financement complémentaire',
      })
      await expect(section).toContainText('20 000 XOF')
      await section.getByRole('button', { name: label }).click()
      await expect.poll(() => writes.length).toBe(1)
      expect(writes[0]).not.toHaveProperty('amount')
      expect(writes[0].expected_version).toBe(5)
      await expect.poll(() => refreshed).toBeGreaterThan(1)
      if (action === 'approve')
        await expect(
          page.getByText('La réalisation est suspendue', { exact: false }),
        ).toHaveCount(0)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy()
      await page.evaluate(() => window.dispatchEvent(new Event('offline')))
      await expect(page.getByRole('button', { name: label })).toHaveCount(0)
      expect(writes).toHaveLength(1)
    })
  }
}
