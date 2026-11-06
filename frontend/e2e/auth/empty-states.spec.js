import { test, expect } from '@playwright/test'
const empty = { object: 'list', count: 0, data: [], next: null, previous: null }
async function setup(page, role) {
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: empty }))
  await page.route('**/api/v1/access/**', (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, size: 20 } }),
  )
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        state: 'verified',
        csrf: 'fixture',
        user: {
          id: 'empty-user',
          full_name: 'John Doe',
          email: 'john@example.test',
          role,
        },
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    }),
  )
}
test('operation-type failure stays inside its secondary section on Partners', async ({
  page,
}) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  let reads = 0
  await page.route('**/api/v1/operation-types*', (route) => {
    reads += 1
    return route.fulfill({ status: 503, json: { code: 'unavailable' } })
  })
  await page.goto('/partners')
  await expect(
    page.getByRole('heading', { name: 'Aucun partenaire', exact: true }),
  ).toBeVisible()
  expect(reads).toBe(0)
  await page.locator('summary').click()
  await expect(
    page.locator('details').getByRole('button', { name: 'Réessayer' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Aucun partenaire', exact: true }),
  ).toBeVisible()
  await page.locator('summary').click()
  await expect(page.locator('details')).not.toHaveAttribute('open', '')
})
for (const [path, role, title] of [
  ['/projects', 'VALIDATEUR_DEFINITIF', 'Aucun projet'],
  ['/partners', 'VALIDATEUR_DEFINITIF', 'Aucun partenaire'],
  ['/planning', 'AGENT_SAISIE', 'Aucun PTA'],
  ['/access/users', 'ADMIN_PLATEFORME', 'Aucun utilisateur'],
  ['/history', 'ADMIN_PLATEFORME', 'Aucun événement'],
  ['/execution', 'AGENT_SAISIE', 'Aucune activité'],
  ['/dashboard', 'AGENT_SAISIE', 'Aucune action en attente'],
])
  test(`${path} uses the centered empty block`, async ({ page }) => {
    await setup(page, role)
    await page.setViewportSize({ width: 1846, height: 970 })
    await page.goto(path)
    const heading = page.getByRole('heading', { name: title, exact: true })
    await expect(heading).toBeVisible()
    const block = heading.locator('..')
    await expect(block).toHaveCSS('text-align', 'center')
    const content = await block.boundingBox(),
      text = await heading.boundingBox()
    expect(
      Math.abs(content.x + content.width / 2 - text.x - text.width / 2),
    ).toBeLessThan(2)
    await page.screenshot({
      path: `/tmp/mjl-empty-${path.replaceAll('/', '-')}.png`,
    })
  })
test('reminders open in a dialog without changing the page and center the empty message', async ({
  page,
}) => {
  await setup(page, 'AGENT_SAISIE')
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Relances', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Relances administratives' })
  await expect(
    dialog.getByText('Aucune notification pour le moment.'),
  ).toBeVisible()
  await expect(dialog.locator('[data-ui="empty-content"]')).toHaveCSS(
    'text-align',
    'center',
  )
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.screenshot({ path: '/tmp/mjl-empty-reminders.png' })
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Relances', exact: true }),
  ).toBeFocused()
})
test('Agent can open a year with no PTA and reach first activity creation', async ({
  page,
}) => {
  await setup(page, 'AGENT_SAISIE')
  await page.route('**/api/v1/projects', (route) =>
    route.fulfill({
      json: {
        ...empty,
        count: 1,
        data: [
          { id: 'project-1', reference: 'PRJ-1', name: 'Projet autorisé' },
        ],
      },
    }),
  )
  await page.route('**/api/v1/projects/project-1/ptas/2027', (route) =>
    route.fulfill({
      json: {
        project: { id: 'project-1', name: 'Projet autorisé' },
        year: 2027,
        pta: null,
        allowed_actions: ['read', 'create_activity'],
        approved_plan: { activity_count: 0, allocation: '0' },
      },
    }),
  )
  await page.goto('/planning')
  await expect(
    page.getByRole('heading', { name: 'Aucun PTA', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Année du PTA').fill('')
  await page.getByLabel('Année du PTA').pressSequentially('2027')
  await expect(page.getByLabel('Année du PTA')).toHaveValue('2027')
  await page
    .getByRole('button', { name: 'Ouvrir le PTA de cette année' })
    .click()
  await expect(page).toHaveURL(/\/projects\/project-1\/ptas\/2027$/)
  const create = page.locator(
    'a[href="/projects/project-1/ptas/2027/activities/new"]',
  )
  await expect(create).toBeVisible()
  await create.click()
  await expect(
    page.getByRole('heading', { name: 'Planification complète' }),
  ).toBeVisible()
})
test('Partner Exports loads only scoped selection data and uses protected CSV', async ({
  page,
}) => {
  await setup(page, 'PARTENAIRE')
  const requests = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) requests.push(request.url())
  })
  await page.route('**/api/v1/partner-portal/profile', (route) =>
    route.fulfill({ json: { name: 'Partenaire autorisé' } }),
  )
  await page.route('**/api/v1/partner-portal/projects?*', (route) =>
    route.fulfill({
      json: {
        ...empty,
        count: 1,
        data: [{ id: 'project-1', name: 'Projet autorisé' }],
      },
    }),
  )
  await page.route(
    '**/api/v1/partner-portal/projects/project-1/ptas?*',
    (route) =>
      route.fulfill({
        json: {
          ...empty,
          count: 1,
          data: [
            {
              id: 'pta-1',
              year: 2026,
              metrics: { physical: { approved_activities: 2 } },
            },
          ],
        },
      }),
  )
  await page.route('**/api/v1/partner-portal/ptas/pta-1/exports', (route) =>
    route.fulfill({
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="pta.csv"',
      },
      body: 'Activité;Budget\n',
    }),
  )
  await page.goto('/partner/exports')
  const download = page.getByRole('button', {
    name: 'Télécharger le récapitulatif CSV',
  })
  await expect(download).toBeEnabled()
  expect(requests.some((url) => url.includes('/activities'))).toBe(false)
  const downloaded = page.waitForEvent('download')
  await download.click()
  expect((await downloaded).suggestedFilename()).toBe('pta.csv')
  await page.screenshot({ path: '/tmp/mjl-partner-exports.png' })
})
