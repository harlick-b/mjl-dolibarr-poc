import { expect, test } from '@playwright/test'

test('Partner portfolio stays read-only on desktop and mobile', async ({
  page,
}) => {
  const list = (data) => ({
    object: 'list',
    count: data.length,
    data,
    next: null,
    previous: null,
  })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          user: {
            id: 'partner-user',
            role: 'PARTENAIRE',
            partner_id: 'partner-1',
          },
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      })
    if (path === '/api/v1/partner-portal/profile')
      return route.fulfill({
        json: { id: 'partner-1', name: 'Partenaire Démo' },
      })
    if (path === '/api/v1/partner-portal/projects')
      return route.fulfill({
        json: list([
          {
            id: 'project-1',
            reference: 'PRJ-2027-001',
            name: 'Projet Santé',
            state: 'active',
          },
        ]),
      })
    if (path === '/api/v1/partner-portal/projects/project-1/ptas')
      return route.fulfill({
        json: list([
          {
            id: 'pta-1',
            year: 2027,
            metrics: {
              pta_id: 'pta-1',
              as_of: '2027-10-30T10:00:00Z',
              physical: { closed_activities: 1, approved_activities: 2 },
              financial: {
                closed_spending: '90000',
                approved_allocation: '120000',
              },
            },
          },
        ]),
      })
    if (path === '/api/v1/partner-portal/ptas/pta-1/activities')
      return route.fulfill({
        json: list([
          {
            id: 'activity-1',
            reference: 'ACT-001',
            name: 'Campagne de santé',
            planned_start: '2027-01-10',
            planned_end: '2027-03-10',
            allocation: '120000',
            state: 'closed',
            approved_revision: 1,
          },
        ]),
      })
    return route.fulfill({ status: 404, json: {} })
  })

  await page.goto('/partner')
  await expect(
    page.getByRole('heading', { name: 'Bonjour, Partenaire Démo' }),
  ).toBeVisible()
  await expect(page.getByText('Projet Santé')).toBeVisible()
  await expect(page.getByText('Campagne de santé')).toBeVisible()
  await expect(
    page.getByText('Espace Partenaire · Lecture seule'),
  ).toBeVisible()
  await expect(page.getByRole('button')).toHaveCount(0)
  await expect(page.getByText(/export/i)).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole('navigation', { name: 'Espace Partenaire' }),
  ).toBeVisible()
  await expect(page.getByText('1 activité clôturée sur 2')).toBeVisible()
})
