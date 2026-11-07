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
test('Partners no longer loads operation categories', async ({ page }) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  let reads = 0
  await page.route('**/api/v1/operation-types*', (route) => {
    reads += 1
    return route.fulfill({ json: empty })
  })
  await page.goto('/partners')
  await expect(
    page.getByRole('heading', { name: 'Aucun partenaire', exact: true }),
  ).toBeVisible()
  expect(reads).toBe(0)
  await expect(
    page.getByText('Types d’opération', { exact: true }),
  ).not.toBeVisible()
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
          {
            id: 'project-1',
            reference: 'PRJ-1',
            name: 'Projet autorisé',
            state: 'active',
          },
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
  await page
    .getByRole('button', { name: 'Ajouter une activité au PTA' })
    .click()
  await page.getByRole('combobox', { name: 'Projet', exact: true }).click()
  await page.getByRole('option', { name: 'Projet autorisé' }).click()
  await page.getByLabel('Exercice du PTA').fill('2027')
  await page.getByRole('button', { name: 'Continuer' }).click()
  await expect(page).toHaveURL(
    /\/projects\/project-1\/ptas\/2027\/activities\/new(?:\?|$)/,
  )
  await expect(
    page.getByRole('heading', { name: 'Informations générales' }),
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

test('project creation requires a partner and pages have a browser title', async ({
  page,
}) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  await page.goto('/projects')
  await expect(
    page.getByRole('heading', { name: 'Aucun projet', exact: true }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Projets — MJL')
  await expect(
    page.getByRole('button', { name: 'Créer un projet', exact: true }),
  ).toBeDisabled()
})

test('partner dialog has a heading, close control and dismisses outside', async ({
  page,
}) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  await page.goto('/partners')
  await page
    .getByRole('button', { name: 'Créer un partenaire', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', { name: 'Créer un partenaire' }),
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Fermer', exact: true }),
  ).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Créer un partenaire', exact: true }),
  ).toBeFocused()
})

test('failed partner loading can be retried from Projects', async ({
  page,
}) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  let failed = true
  await page.route('**/api/v1/partners', (route) =>
    route.fulfill(
      failed
        ? { status: 503, json: { code: 'unavailable' } }
        : {
            json: {
              ...empty,
              count: 1,
              data: [
                { id: 'partner', name: 'Partenaire disponible', active: true },
              ],
            },
          },
    ),
  )
  await page.goto('/projects')
  await expect(
    page.getByRole('button', { name: 'Créer un projet', exact: true }),
  ).toBeDisabled()
  failed = false
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Créer un projet', exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('button', { name: 'Créer un projet', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('combobox')).toContainText(
    'Partenaire disponible',
  )
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click()
  await expect(dialog).not.toBeVisible()
})

test('project partner select skips inactive partners', async ({ page }) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  await page.route('**/api/v1/partners*', (route) =>
    route.fulfill({
      json: {
        ...empty,
        count: 2,
        data: [
          { id: 'inactive', name: 'Partenaire inactif', active: false },
          { id: 'active', name: 'Partenaire actif', active: true },
        ],
      },
    }),
  )
  await page.goto('/projects')
  await page
    .getByRole('button', { name: 'Créer un projet', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom', { exact: true }).fill('Nouveau projet')
  await expect(dialog.getByRole('combobox')).toContainText('Partenaire actif')
  await dialog.getByRole('combobox').click()
  await expect(
    page.getByRole('option', { name: 'Partenaire inactif', exact: true }),
  ).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Nom', { exact: true })).toHaveValue(
    'Nouveau projet',
  )
  await page.screenshot({ path: '/tmp/mjl-project-modal-updated.png' })
})

test('History search and dates reach the API and reset the URL', async ({
  page,
}) => {
  await setup(page, 'ADMIN_PLATEFORME')
  const requests = []
  await page.route('**/api/v1/audit-events*', (route) => {
    requests.push(route.request().url())
    return route.fulfill({ json: empty })
  })
  await page.goto('/history')
  await page.getByRole('searchbox').fill('Coopération')
  await expect
    .poll(() =>
      requests.some(
        (url) => new URL(url).searchParams.get('q') === 'Coopération',
      ),
    )
    .toBe(true)
  await expect(
    page.getByRole('button', { name: 'Exporter le CSV' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Filtres', exact: true }).click()
  await page
    .getByLabel('Date de début de période', { exact: true })
    .fill('2026-01-01')
  await expect
    .poll(() =>
      requests.some(
        (url) => new URL(url).searchParams.get('date_from') === '2026-01-01',
      ),
    )
    .toBe(true)
  await page
    .getByRole('button', { name: 'Réinitialiser', exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByRole('searchbox')).toHaveValue('')
})

test('Partner description is saved from a mobile-sized modal', async ({
  page,
}) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  let submitted
  await page.route('**/api/v1/partners', (route) => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        json: { id: 'partner-new', ...submitted },
      })
    }
    return route.fulfill({ json: empty })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/partners')
  await page
    .getByRole('button', { name: 'Créer un partenaire', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Créer un partenaire' })
  await dialog.getByLabel('Nom', { exact: true }).fill('Partenaire de test')
  await dialog.getByLabel('Description').fill('Description du partenaire')
  expect((await dialog.boundingBox()).width).toBeLessThanOrEqual(358)
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect
    .poll(() => submitted?.description)
    .toBe('Description du partenaire')
  await expect(dialog).not.toBeVisible()
})

test('Execution search reaches the API and a PTA switch hides the previous rows', async ({
  page,
}) => {
  await setup(page, 'AGENT_SAISIE')
  await page.route('**/api/v1/projects', (route) =>
    route.fulfill({
      json: {
        ...empty,
        count: 1,
        data: [{ id: 'project-1', name: 'Projet test' }],
      },
    }),
  )
  await page.route('**/api/v1/projects/project-1/ptas', (route) =>
    route.fulfill({
      json: {
        ...empty,
        count: 2,
        data: [
          { id: 'pta-1', year: 2026 },
          { id: 'pta-2', year: 2027 },
        ],
      },
    }),
  )
  const requests = []
  let release
  await page.route('**/api/v1/ptas/*/execution*', async (route) => {
    requests.push(route.request().url())
    if (route.request().url().includes('/pta-2/'))
      await new Promise((resolve) => {
        release = resolve
      })
    return route.fulfill({
      json: route.request().url().includes('/pta-2/')
        ? empty
        : {
            ...empty,
            count: 1,
            data: [
              {
                id: 'activity-1',
                name: 'Activité de 2026',
                reference: 'ACT-1',
                project_name: 'Projet test',
                approved_revision_number: 2,
                planned_start: '2026-01-01',
                planned_end: '2026-12-31',
                spending_total: null,
                completed_operations: 0,
                operation_count: 1,
              },
            ],
          },
    })
  })
  await page.goto('/execution')
  await expect(
    page.getByRole('link', { name: 'Activité de 2026' }),
  ).toBeVisible()
  await expect(page.getByText('Révision 2', { exact: true })).toBeVisible()
  await page.screenshot({
    path: '/tmp/mjl-design-execution.png',
    fullPage: true,
  })
  await page.getByRole('searchbox').fill('Justice')
  await expect
    .poll(() =>
      requests.some((url) => new URL(url).searchParams.get('q') === 'Justice'),
    )
    .toBe(true)
  await page.getByRole('combobox', { name: 'PTA annuel' }).click()
  await page.getByRole('option', { name: '2027', exact: true }).click()
  await expect.poll(() => Boolean(release)).toBe(true)
  await expect(
    page.getByRole('link', { name: 'Activité de 2026' }),
  ).not.toBeVisible()
  release()
  await expect(page.getByRole('searchbox')).toBeVisible()
})

test('Project closure uses the shared dismissible confirmation modal', async ({
  page,
}) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  let writes = 0
  await page.route('**/api/v1/projects**', (route) => {
    if (route.request().method() === 'PATCH') {
      writes += 1
      return route.fulfill({ json: {} })
    }
    return route.fulfill({
      json: {
        ...empty,
        count: 1,
        data: [
          {
            id: 'project-1',
            name: 'Projet actif',
            state: 'active',
            version: 1,
            allowed_actions: ['close'],
            partner_name: 'Partenaire',
          },
        ],
      },
    })
  })
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Clôturer', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Clore le projet' })
  await expect(
    dialog.getByRole('heading', { name: 'Clore le projet' }),
  ).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(dialog).not.toBeVisible()
  expect(writes).toBe(0)
  await page.getByRole('button', { name: 'Clôturer', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Clôturer', exact: true })
    .click()
  await expect.poll(() => writes).toBe(1)
  await expect(dialog).not.toBeVisible()
})

test('Agent creates and selects a category without submitting or losing the activity draft', async ({
  page,
}) => {
  await setup(page, 'AGENT_SAISIE')
  await page.route('**/api/v1/projects/project-1/ptas/2027', (route) =>
    route.fulfill({
      json: {
        project: { id: 'project-1', name: 'Projet autorisé' },
        year: 2027,
        pta: null,
        allowed_actions: ['create_activity'],
      },
    }),
  )
  let categories = []
  let activityWrites = 0
  let attempts = 0
  await page.route('**/api/v1/operation-types*', (route) => {
    if (route.request().method() === 'POST') {
      attempts += 1
      if (attempts === 1)
        return route.fulfill({ status: 503, json: { code: 'unavailable' } })
      const row = {
        id: 'category-1',
        label: route.request().postDataJSON().label,
        active: true,
      }
      categories = [row]
      return route.fulfill({ status: 201, json: row })
    }
    return route.fulfill({
      json: { ...empty, count: categories.length, data: categories },
    })
  })
  await page.route(
    '**/api/v1/projects/project-1/ptas/2027/activities',
    (route) => {
      activityWrites += 1
      return route.fulfill({ status: 201, json: { id: 'activity-1' } })
    },
  )
  await page.goto('/projects/project-1/ptas/2027/activities/new')
  await page.getByLabel('Nom', { exact: true }).fill('Activité en préparation')
  await page
    .getByRole('button', { name: 'Créer une catégorie', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Créer une catégorie' })
  await dialog.getByRole('textbox').fill('Formation')
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox')).toHaveValue('Formation')
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(
    'Activité en préparation',
  )
  await expect(page.getByRole('combobox').first()).toContainText('Formation')
  expect(activityWrites).toBe(0)
  await page.screenshot({ path: '/tmp/mjl-category-created.png' })
})

test('PTA detail selects only its owning sidebar page', async ({ page }) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  await page.route('**/api/v1/projects/project-1/ptas/2027', (route) =>
    route.fulfill({
      json: {
        project: { id: 'project-1', name: 'Projet autorisé' },
        year: 2027,
        pta: null,
        allowed_actions: ['read'],
        approved_plan: { activity_count: 0, allocation: '0' },
      },
    }),
  )
  await page.goto('/projects/project-1/ptas/2027')
  const active = page.locator('aside nav a[aria-current="page"]')
  await expect(active).toHaveCount(1)
  await expect(active).toHaveText('Prévisions (PTA)')
})
