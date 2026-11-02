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
    return route.fulfill({ json: empty })
  })

  await page.goto('/projects/project-1/ptas/2027')
  const metrics = page.getByRole('region', { name: 'Indicateurs annuels' })
  await expect(metrics.getByText('20 %')).toBeVisible()
  await expect(metrics.getByText('10,9 %')).toBeVisible()
  await expect(metrics).toContainText('1 activité(s) clôturée(s) sur 5')
  await expect(metrics).toContainText('9 200 000 XOF')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(metrics.getByText('Exécution physique')).toBeVisible()
  await expect(metrics.getByText('Exécution financière')).toBeVisible()
})
