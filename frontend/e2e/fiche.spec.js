import { expect, test } from '@playwright/test'

test('an approved Activity exposes its guarded Fiche download on mobile', async ({
  page,
}) => {
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: { id: 'agent', role: 'AGENT_SAISIE' },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (path === '/api/v1/activities/activity-1')
      return route.fulfill({
        json: {
          id: 'activity-1',
          pta_id: 'pta-1',
          project_id: 'project-1',
          reference: 'ACT-000001',
          name: 'Atelier approuvé',
          description: 'Version approuvée',
          planned_start: '2027-01-10',
          planned_end: '2027-04-10',
          allocation: '100000',
          state: 'approved',
          version: 4,
          current_revision_id: 'revision-1',
          approved_revision_id: 'revision-1',
          approved_allocation: '100000',
          approved: {
            name: 'Atelier approuvé',
            description: 'Version approuvée',
            planned_start: '2027-01-10',
            planned_end: '2027-04-10',
            allocation: '100000',
            operations: [],
          },
          candidate: null,
          amendment: null,
          withdrawal: null,
          transfer: null,
          placement_year: 2027,
          execution_paused: false,
          operations: [],
          correction: null,
          agent_ids: [],
          allowed_actions: ['read'],
        },
      })
    if (path === '/api/v1/activities/activity-1/fiche.pdf')
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: {
          'Content-Disposition': 'attachment; filename="fiche-ACT-000001.pdf"',
        },
        body: '%PDF-1.4\n%%EOF',
      })
    return route.fulfill({ json: empty })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/activities/activity-1')
  const action = page.getByRole('link', {
    name: 'Télécharger la fiche PDF',
  })
  await expect(action).toBeVisible()
  await expect(action).toHaveAttribute('download', '')
  const binary = await page.evaluate(async () => {
    const response = await fetch('/api/v1/activities/activity-1/fiche.pdf')
    return {
      contentType: response.headers.get('content-type'),
      prefix: await response.text(),
    }
  })
  expect(binary.contentType).toBe('application/pdf')
  expect(binary.prefix).toContain('%PDF-1.4')
})
