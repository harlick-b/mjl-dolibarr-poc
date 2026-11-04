import { expect, test } from '@playwright/test'

test('current annual metrics remain visible on desktop and mobile', async ({
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
    if (path === '/api/v1/projects/project-1/ptas/2027')
      return route.fulfill({
        json: {
          project: {
            id: 'project-1',
            name: 'Protection de l’enfant',
            allowed_actions: ['read'],
          },
          year: 2027,
          pta: { id: 'pta-1' },
          allowed_actions: ['read'],
          approved_plan: { activity_count: 5, allocation: '9200000' },
        },
      })
    if (path === '/api/v1/ptas/pta-1/metrics')
      return route.fulfill({
        json: {
          pta_id: 'pta-1',
          as_of: '2027-10-30T10:00:00Z',
          physical: { closed_activities: 1, approved_activities: 5 },
          financial: {
            closed_spending: '1000000',
            approved_allocation: '9200000',
          },
        },
      })
    if (path === '/api/v1/ptas/pta-1/exports') {
      const format = route.request().postDataJSON().format
      expect(route.request().method()).toBe('POST')
      expect(route.request().headers()['x-csrf-token']).toBe('csrf')
      return route.fulfill({
        body:
          format === 'csv'
            ? '\ufeffIdentifiant export;test'
            : 'synthetic workbook bytes',
        headers: {
          'Content-Type':
            format === 'csv'
              ? 'text/csv; charset=utf-8'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="pta-2027-test.${format}"`,
        },
      })
    }
    return route.fulfill({ json: empty })
  })

  await page.goto('/projects/project-1/ptas/2027')
  const metrics = page.getByRole('region', { name: 'Indicateurs annuels' })
  await expect(metrics.getByText('20 %')).toBeVisible()
  await expect(metrics.getByText('10,9 %')).toBeVisible()
  await expect(metrics).toContainText('1 activité(s) clôturée(s) sur 5')
  await expect(metrics).toContainText('9 200 000 XOF')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le PTA en CSV' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('pta-2027-test.csv')

  const excel = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Rapport de travail Excel' }).click()
  expect((await excel).suggestedFilename()).toBe('pta-2027-test.xlsx')
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileExcel = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Rapport de travail Excel' }).click()
  expect((await mobileExcel).suggestedFilename()).toBe('pta-2027-test.xlsx')
  await expect(metrics.getByText('Exécution physique')).toBeVisible()
  await expect(metrics.getByText('Exécution financière')).toBeVisible()
})
