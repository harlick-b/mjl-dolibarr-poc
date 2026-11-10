import { test, expect } from '@playwright/test'
const list = { object: 'list', count: 0, data: [], next: null, previous: null }
const roles = {
  ADMIN_PLATEFORME: ['Tableau de bord', 'Utilisateurs', 'Historique'],
  AGENT_SAISIE: ['Tableau de bord', 'Prévisions (PTA)', 'Réalisation'],
  AGENT_VERIFICATEUR: ['Tableau de bord', 'Prévisions (PTA)', 'Réalisation'],
  VALIDATEUR_DEFINITIF: [
    'Tableau de bord',
    'Prévisions (PTA)',
    'Réalisation',
    'Partenaires',
    'Projets',
    'Historique',
  ],
  PARTENAIRE: ['Tableau de bord', 'Mes projets', 'Exports'],
}

async function session(page, role, extra = {}) {
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: list }))
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        state: 'verified',
        csrf: 'test',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: {
          id: 'role-user',
          email: 'john@example.test',
          full_name: 'John Doe',
          role,
          ...extra,
        },
      },
    }),
  )
}
for (const [role, links] of Object.entries(roles))
  test(`${role} defaults to Dashboard and sees only its pages`, async ({
    page,
  }) => {
    await session(page, role)
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole('heading', {
        name:
          role === 'ADMIN_PLATEFORME' ? 'Administration' : 'Tableau de bord',
      }),
    ).toBeVisible()
    await expect(page.locator('aside nav a')).toHaveText(links)
    await expect(
      page.getByRole('button', { name: 'Mon compte' }),
    ).toContainText('JD')
    if (role === 'ADMIN_PLATEFORME' || role === 'PARTENAIRE') {
      await page.goto('/planning')
      await expect(
        page.getByRole('heading', { name: 'Accès refusé' }),
      ).toBeVisible()
    }
  })
test('PTA entry pages load bounded selected project data and keep sidebar visible', async ({
  page,
}) => {
  await session(page, 'AGENT_SAISIE')
  await page.route('**/api/v1/projects', (route) =>
    route.fulfill({
      json: {
        ...list,
        count: 1,
        data: [
          {
            id: 'project-1',
            name: 'Projet de test',
            reference: 'PRJ-1',
            state: 'active',
            allowed_actions: ['read'],
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/projects/project-1/ptas', (route) =>
    route.fulfill({
      json: {
        ...list,
        count: 1,
        data: [{ id: 'pta-1', project_id: 'project-1', year: 2026 }],
      },
    }),
  )
  await page.route('**/api/v1/ptas', (route) =>
    route.fulfill({
      json: {
        ...list,
        count: 1,
        data: [
          {
            id: 'pta-1',
            project_id: 'project-1',
            project_name: 'Projet de test',
            partner_name: 'Partenaire test',
            project_state: 'active',
            name: 'PTA 2026',
            description: null,
            year: 2026,
            summary: {
              activities: 4,
              approved: 4,
              review: 0,
              correction: 0,
              approved_allocation: '100',
            },
          },
        ],
      },
    }),
  )
  await page.route('**/api/v1/ptas/pta-1/metrics', (route) =>
    route.fulfill({
      json: {
        physical: { closed_activities: 2, approved_activities: 4 },
        financial: { closed_spending: '25', approved_allocation: '100' },
      },
    }),
  )
  await page.route('**/api/v1/ptas/pta-1/dashboard', (route) =>
    route.fulfill({
      json: {
        pta_id: 'pta-1',
        as_of: '2026-11-09T12:00:00Z',
        physical: { closed_activities: 2, approved_activities: 4 },
        financial: { closed_spending: '25', approved_allocation: '100' },
        finance: {
          approved_allocation: '100',
          recorded_spending: '60',
          recorded_operations: 2,
          approved_operations: 4,
          closed_spending: '25',
          reversement_due: '15',
          reversement_confirmed: null,
        },
        attention: {
          count: 3,
          items: [
            {
              activity_id: 'activity-1',
              reference: 'ACT-001',
              name: 'Forums communaux d’accès au droit',
              reason: 'correction_requested',
              action: 'review_planning',
              destination: 'planning',
            },
            {
              activity_id: 'activity-2',
              reference: 'ACT-002',
              name: 'Campagne d’information communautaire',
              reason: 'draft_to_complete',
              action: 'review_planning',
              destination: 'planning',
            },
            {
              activity_id: 'activity-3',
              reference: 'ACT-003',
              name: 'Formation des acteurs de la justice des mineurs',
              reason: 'reversement_required',
              action: 'declare_reversement',
              destination: 'execution',
            },
          ],
        },
      },
    }),
  )
  await page.goto('/dashboard')
  await expect(page.getByText('50 %', { exact: true })).toBeVisible()
  await expect(page.getByText('25 %', { exact: true })).toBeVisible()
  const finance = page.getByRole('region', { name: 'Suivi financier' })
  await expect(finance.getByText('100 F CFA', { exact: true })).toBeVisible()
  await expect(finance.getByText('60 F CFA', { exact: true })).toBeVisible()
  await expect(finance.getByText('2 / 4 opérations')).toBeVisible()
  await expect(finance.getByText('15 F CFA', { exact: true })).toBeVisible()
  await expect(finance.getByText('-', { exact: true })).toBeVisible()
  const attention = page.getByRole('region', { name: 'À votre attention' })
  await expect(
    attention.getByText('Correction demandée', { exact: true }),
  ).toBeVisible()
  await expect(
    attention.getByRole('link', { name: 'Revoir la programmation' }).first(),
  ).toHaveAttribute('href', '/activities/activity-1')
  await expect(
    attention.getByRole('link', { name: 'Déclarer le reversement' }),
  ).toHaveAttribute('href', '/execution/activities/activity-3')
  await page.screenshot({
    path: '/tmp/mjl-dashboard-populated.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: '/tmp/mjl-dashboard-populated-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page
    .getByRole('link', { name: 'Prévisions (PTA)', exact: true })
    .click()
  await expect(page.getByRole('cell', { name: '2026' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Consulter' })).toHaveAttribute(
    'href',
    '/projects/project-1/ptas/2026',
  )
  await page.screenshot({ path: '/tmp/mjl-role-planning.png' })
  await page.getByRole('link', { name: 'Réalisation', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'PTA annuel' }),
  ).toContainText('2026')
  await expect(page.getByText('0 activité', { exact: true })).toBeVisible()
})
test('long identity stays contained and menu reveals full identity', async ({
  page,
}) => {
  const name = 'John ' + 'Long family name '.repeat(10) + 'Doe'
  const email = 'very.long.identity.' + 'x'.repeat(80) + '@example.test'
  await session(page, 'ADMIN_PLATEFORME', { full_name: name, email })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/dashboard')
  const trigger = page.getByRole('button', { name: 'Mon compte' })
  await expect(trigger).toContainText('JD')
  expect((await trigger.boundingBox()).width).toBeLessThan(256)
  await trigger.click()
  await expect(
    page.getByRole('menu').getByText(email, { exact: true }),
  ).toHaveAttribute('title', email)
  await page.screenshot({ path: '/tmp/mjl-role-account.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  const box = await page.getByRole('menu').boundingBox()
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(844)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
})
