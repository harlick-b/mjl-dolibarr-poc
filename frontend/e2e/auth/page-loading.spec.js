import { test, expect } from '@playwright/test'

const pages = [
  ['/partners', 'Partenaires', 'VALIDATEUR_DEFINITIF'],
  ['/projects', 'Projets', 'AGENT_SAISIE'],
  ['/projects/project/ptas/2026', 'Plan de travail annuel', 'AGENT_SAISIE'],
  [
    '/projects/project/ptas/2026/activities/new',
    'Nouvelle activité',
    'AGENT_SAISIE',
  ],
  ['/activities/activity', 'Détail de l’activité', 'AGENT_SAISIE'],
  ['/execution/pta', 'Réalisations', 'AGENT_SAISIE'],
  [
    '/execution/activities/activity',
    'Détail de la réalisation',
    'AGENT_SAISIE',
  ],
  ['/partner', 'Espace Partenaire', 'PARTENAIRE'],
  ['/notifications', 'Notifications', 'AGENT_SAISIE'],
  ['/history', 'Historique', 'ADMIN_PLATEFORME'],
]

for (const [path, title, role] of pages) {
  test(`${path} shows its layout through slow session and data requests`, async ({
    page,
  }) => {
    let releaseSession
    let first = true
    let dataReads = 0
    await page.route('**/api/v1/**', async (route) => {
      if (new URL(route.request().url()).pathname === '/api/v1/auth/session') {
        if (first) {
          first = false
          await new Promise((resolve) => {
            releaseSession = resolve
          })
        }
        await route.fulfill({
          json: {
            state: 'verified',
            csrf: 'test',
            user: { id: 'fixture', email: 'private@example.test', role },
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          },
        })
      } else {
        dataReads += 1
        await new Promise(() => {})
      }
    })
    await page.goto(path)
    const accessCheck = page.getByRole('status', {
      name: 'Vérification de votre accès',
    })
    await expect(accessCheck).toBeVisible()
    await expect(accessCheck).toHaveAttribute('aria-busy', 'true')
    releaseSession()
    const loading = page.getByRole('status', { name: `Chargement : ${title}` })
    await expect(loading).toBeVisible()
    await expect(loading).toHaveClass(/page-loading/)
    await expect(page.locator('.loading-placeholder')).toHaveCount(0)
    await expect(loading).toHaveAttribute('aria-busy', 'true')
    await expect.poll(() => dataReads).toBeGreaterThan(0)
    await expect(loading).toBeVisible()
    await expect(
      page.getByText(
        /Aucun projet\.|Aucune notification pour le moment\.|Aucun événement enregistré\./,
      ),
    ).toHaveCount(0)
    if (
      [
        '/projects',
        '/projects/project/ptas/2026/activities/new',
        '/execution/activities/activity',
      ].includes(path)
    )
      await page.screenshot({
        path: `/tmp/mjl-loading-${title.replaceAll(' ', '-')}.png`,
      })
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(loading).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}

for (const path of ['/invitation', '/reset-password']) {
  test(`${path} shows the minimal auth loader during its route loader`, async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/session', () => new Promise(() => {}))
    await page.goto(path)
    await expect(page.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    await expect(page.locator('.auth-card')).toBeVisible()
  })
}

test('PTA waits for its activities after context arrives instead of claiming it is empty', async ({
  page,
}) => {
  let releaseActivities
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = { data: [], count: 0, next: null, previous: null }
    if (path.endsWith('/auth/session'))
      body = {
        state: 'verified',
        csrf: 'test',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: { id: 'agent', email: 'user@example.test', role: 'AGENT_SAISIE' },
      }
    if (path === '/api/v1/projects/project/ptas/2026')
      body = {
        project: { id: 'project', name: 'Projet test' },
        year: 2026,
        pta: { id: 'pta' },
        allowed_actions: [],
      }
    if (path === '/api/v1/ptas/pta/metrics')
      body = {
        physical: { closed_activities: '0', approved_activities: '0' },
        financial: { closed_spending: '0', approved_allocation: '0' },
      }
    if (path === '/api/v1/ptas/pta/activities')
      await new Promise((resolve) => {
        releaseActivities = resolve
      })
    await route.fulfill({ json: body })
  })
  await page.goto('/projects/project/ptas/2026')
  await expect(page.getByRole('heading', { name: 'Projet test' })).toBeVisible()
  await expect(
    page.getByText('Aucune activité pour cet exercice.'),
  ).toHaveCount(0)
  await expect(
    page
      .getByRole('status', { name: 'Chargement : Plan de travail annuel' })
      .first(),
  ).toBeVisible()
  await expect.poll(() => Boolean(releaseActivities)).toBe(true)
  releaseActivities()
  await expect(
    page.getByText('Aucune activité pour cet exercice.'),
  ).toBeVisible()
})

test('project draft survives loading the next page of partner choices', async ({
  page,
}) => {
  let releasePartners
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let body = { data: [], count: 0, next: null, previous: null }
    if (url.pathname.endsWith('/auth/session'))
      body = {
        state: 'verified',
        csrf: 'test',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: {
          id: 'validator',
          email: 'user@example.test',
          role: 'VALIDATEUR_DEFINITIF',
        },
      }
    if (url.pathname === '/api/v1/partners') {
      if (url.searchParams.has('cursor'))
        await new Promise((resolve) => {
          releasePartners = resolve
        })
      body = {
        data: [{ id: 'partner', name: 'Partenaire test' }],
        count: 1,
        next: url.searchParams.has('cursor')
          ? null
          : 'http://127.0.0.1:4173/api/v1/partners?cursor=next',
        previous: null,
      }
    }
    await route.fulfill({ json: body })
  })
  await page.goto('/projects')
  await expect(page.getByText('Aucun projet.')).toBeVisible()
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Créer un projet' })
  await dialog.getByLabel('Nom', { exact: true }).fill('Projet en brouillon')
  await dialog.getByRole('button', { name: 'Suivant', exact: true }).click()
  await expect.poll(() => Boolean(releasePartners)).toBe(true)
  await expect(dialog.getByLabel('Nom', { exact: true })).toHaveValue(
    'Projet en brouillon',
  )
  await expect(
    dialog.getByRole('combobox', { name: 'Partenaire', exact: true }),
  ).toBeDisabled()
  releasePartners()
  await expect(
    dialog.getByRole('combobox', { name: 'Partenaire', exact: true }),
  ).toBeEnabled()
  await expect(dialog.getByLabel('Nom', { exact: true })).toHaveValue(
    'Projet en brouillon',
  )
})
