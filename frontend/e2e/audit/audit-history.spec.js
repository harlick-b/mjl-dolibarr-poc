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
