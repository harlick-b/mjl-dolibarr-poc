import { expect, test } from '@playwright/test'

test('validator reads the global history on desktop and mobile', async ({
  page,
}) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: {
            id: 'validator',
            email: 'user@example.test',
            role: 'VALIDATEUR_DEFINITIF',
          },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (path === '/api/v1/reports/audit/exports')
      return route.fulfill({
        body: '\ufeffIdentifiant export;test',
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="historique-audit-test.csv"',
        },
      })
    if (path === '/api/v1/audit-events')
      return route.fulfill({
        json: {
          object: 'list',
          count: 1,
          data: [
            {
              id: 42,
              occurred_at: '2028-02-08T09:00:00Z',
              action: 'activity.closed',
              label: 'Activité clôturée',
              outcome: 'ok',
              actor: {
                id: 'validator',
                email: 'validator@example.test',
              },
              activity: {
                id: 'activity-1',
                reference: 'ACT-001',
                name: 'Formation',
              },
            },
          ],
          next: null,
          previous: null,
        },
      })
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/history')
  await expect(page.getByRole('heading', { name: 'Historique' })).toBeVisible()
  await expect(page.getByText('Activité clôturée')).toBeVisible()
  await expect(page.getByRole('link', { name: /ACT-001/ })).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le CSV' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('historique-audit-test.csv')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('validator@example.test')).toBeVisible()
})

test('Agent reads Activity history changes on desktop and mobile', async ({
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
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (request.method() === 'GET' && path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: {
            id: 'agent',
            full_name: 'Agent de test',
            email: 'agent@example.test',
            role: 'AGENT_SAISIE',
          },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (request.method() === 'GET' && path === '/api/v1/activities/activity-1')
      return route.fulfill({
        json: {
          id: 'activity-1',
          reference: 'ACT-001',
          name: 'Formation',
          description: 'Activité de vérification',
          state: 'draft',
          version: 2,
          project_id: 'project-1',
          project_name: 'Projet test',
          partner_name: 'Partenaire test',
          pta_id: 'pta-1',
          pta_name: 'PTA 2027',
          placement_year: 2027,
          planned_start: '2027-01-10',
          planned_end: '2027-02-10',
          allocation: '1000',
          approved_allocation: null,
          tasks: [],
          agent_ids: ['agent'],
          agents: [
            {
              id: 'agent',
              full_name: 'Agent de test',
              email: 'agent@example.test',
            },
          ],
          allowed_actions: ['read'],
        },
      })
    if (
      request.method() === 'GET' &&
      path === '/api/v1/activities/activity-1/history'
    ) {
      return route.fulfill({
        json: {
          ...empty,
          count: 2,
          data: [
            {
              id: 2,
              action: 'activity.replace',
              label: 'Brouillon d’activité modifié',
              milestone: false,
              occurred_at: '2026-11-06T10:00:00Z',
              actor: { full_name: 'Agent de test' },
              reason: null,
              facts: [],
              changes: [
                {
                  field: 'Description',
                  before: 'Ancienne description',
                  after: 'Description corrigée',
                },
              ],
            },
            {
              id: 1,
              action: 'activity.create',
              label: 'Activité créée',
              milestone: true,
              occurred_at: '2026-11-06T09:00:00Z',
              actor: { full_name: 'Agent de test' },
              reason: null,
              facts: [],
              changes: [],
            },
          ],
        },
      })
    }
    if (
      request.method() === 'GET' &&
      path === '/api/v1/notifications' &&
      url.searchParams.get('state') === 'unread' &&
      url.searchParams.get('limit') === '1'
    )
      return route.fulfill({ json: empty })
    throw new Error(`Unexpected API request: ${request.method()} ${path}`)
  })
  await page.goto('/planning/activities/activity-1#history')
  const history = page.getByRole('region', { name: 'Historique de l’activité' })
  const events = history.getByRole('listitem')
  await expect(events).toHaveCount(2)
  await expect(events.nth(0)).toContainText('Brouillon d’activité modifié')
  await expect(events.nth(0)).toContainText('Responsable : Agent de test')
  await expect(
    events.nth(0).getByText('Description', { exact: true }),
  ).toBeVisible()
  await expect(events.nth(0).getByText('Avant')).toBeVisible()
  await expect(events.nth(0).getByText('Ancienne description')).toBeVisible()
  await expect(events.nth(0).getByText('Après')).toBeVisible()
  await expect(events.nth(0).getByText('Description corrigée')).toBeVisible()
  await expect(events.nth(1)).toContainText('Activité créée')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(events.nth(0)).toBeVisible()
  await expect(events.nth(0).getByText('Description corrigée')).toBeVisible()
})
