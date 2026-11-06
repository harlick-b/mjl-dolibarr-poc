import { test, expect } from '@playwright/test'

test('invitation Select supports keyboard, required validation and FormData inside the dialog', async ({
  page,
}) => {
  await adminFixture(page)
  let sent
  let finish
  await page.route('**/api/v1/partners*', (route) =>
    route.fulfill({
      json: {
        data: [{ id: 'partner', name: 'Partenaire test', active: true }],
        count: 1,
        next: null,
        previous: null,
      },
    }),
  )
  await page.route('**/api/v1/access/invitations', async (route) => {
    sent = route.request().postDataJSON()
    await new Promise((resolve) => {
      finish = resolve
    })
    await route.fulfill({ status: 201, json: { id: 'invitation', version: 1 } })
  })
  await page.goto('/access/users')
  await expect(page.getByRole('table')).toHaveCount(1)
  await page
    .getByRole('button', { name: 'Inviter un utilisateur', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Prénom', { exact: true }).fill('Anne')
  await dialog.getByLabel('Nom de famille').fill('Martin')
  await dialog.getByLabel('Adresse e-mail').fill('anne@example.test')
  const first = await dialog.getByLabel('Prénom', { exact: true }).boundingBox()
  const last = await dialog.getByLabel('Nom de famille').boundingBox()
  expect(first.y).toBe(last.y)
  await dialog.getByRole('combobox', { name: 'Rôle', exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await page.getByRole('option', { name: 'Partenaire', exact: true }).click()
  const submit = dialog.getByRole('button', { name: 'Envoyer l’invitation' })
  await expect(
    dialog.getByRole('combobox', { name: 'Partenaire', exact: true }),
  ).toBeEnabled()
  await submit.click()
  expect(sent).toBeUndefined()
  await dialog
    .getByRole('combobox', { name: 'Partenaire', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Partenaire test', exact: true })
    .click()
  await submit.click()
  await expect.poll(() => sent?.partner_id).toBe('partner')
  expect(sent.role).toBe('PARTENAIRE')
  await expect(submit).toBeDisabled()
  await expect(submit.locator('svg')).toBeVisible()
  finish()
  await expect(dialog).toHaveCount(0)
})

async function adminFixture(page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let body = {
      count: 0,
      data: [],
      next: null,
      previous: null,
      object: 'list',
    }
    if (url.pathname === '/api/v1/auth/session')
      body = {
        state: 'verified',
        csrf: 'test',
        user: {
          id: 'admin',
          email: 'admin@example.test',
          role: 'ADMIN_PLATEFORME',
        },
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }
    if (url.pathname === '/api/v1/auth/profile')
      body = {
        full_name: 'Admin Test',
        first_name: 'Admin',
        last_name: 'Test',
        email: 'admin@example.test',
        role: 'ADMIN_PLATEFORME',
      }
    if (url.pathname === '/api/v1/access/users')
      body = {
        items: url.searchParams.has('email')
          ? []
          : [
              {
                id: 'admin',
                full_name: 'Admin Test',
                email: 'admin@example.test',
                role: 'ADMIN_PLATEFORME',
                state: 'active',
                version: 1,
              },
              {
                id: 'agent',
                full_name: 'Agent Test',
                email: 'agent@example.test',
                role: 'AGENT_SAISIE',
                state: 'active',
                version: 1,
              },
            ],
        total: url.searchParams.has('email') ? 0 : 2,
        page: 1,
        size: 20,
      }
    if (url.pathname === '/api/v1/access/invitations')
      body = { items: [], total: 0, page: 1, size: 20 }
    await route.fulfill({ json: body })
  })
}

test('Admin lands on a clean URL and filters remain shareable with browser history', async ({
  page,
}) => {
  await adminFixture(page)
  await page.goto('/')
  await expect(page).toHaveURL('http://127.0.0.1:4173/dashboard')
  await page
    .locator('aside')
    .getByRole('link', { name: 'Utilisateurs', exact: true })
    .click()
  await expect(page).toHaveURL('http://127.0.0.1:4173/access/users')
  await expect(
    page.getByRole('table', { name: 'Comptes utilisateurs' }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('navigation', { name: 'Administration' })
      .getByRole('link', { name: 'Historique' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Utilisateurs', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('columnheader', { name: 'Rattachement' }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Utilisateurs')
  await page.setViewportSize({ width: 1850, height: 969 })
  await page.screenshot({ path: '/tmp/mjl-admin-users.png', fullPage: true })
  await page.getByText('Filtrer les utilisateurs', { exact: true }).click()
  await page.getByLabel('Rechercher par e-mail').fill('absent@example.test')
  await page.getByRole('button', { name: 'Filtrer', exact: true }).click()
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/access/users' &&
      url.searchParams.size === 1 &&
      url.searchParams.get('email') === 'absent@example.test',
  )
  await expect(
    page.getByRole('heading', { name: 'Aucun résultat' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Effacer les filtres' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:4173/access/users')
  await page.goBack()
  await expect(page.getByLabel('Rechercher par e-mail')).toHaveValue(
    'absent@example.test',
  )
  await page.goForward()
  await expect(page).toHaveURL('http://127.0.0.1:4173/access/users')
})

test('Admin account and history retain the same navigation and invitation dialog reflows', async ({
  page,
}) => {
  await adminFixture(page)
  await page.goto('/access/users')
  await page
    .getByRole('button', { name: 'Inviter un utilisateur', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-admin-invite.png', fullPage: true })
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await page.getByRole('button', { name: 'Mon compte', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Mon profil', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Mon profil', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Administration' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Historique', exact: true }).click()
  await expect(page).toHaveURL('http://127.0.0.1:4173/history')
  await expect(
    page.getByRole('navigation', { name: 'Administration' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Planification', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('link', { name: 'Utilisateurs', exact: true }).click()
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(
    page.getByRole('table', { name: 'Comptes utilisateurs' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page
    .getByRole('button', { name: 'Inviter un utilisateur', exact: true })
    .click()
  await expect(page.getByRole('dialog').getByLabel('Prénom')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: '/tmp/mjl-admin-invite-mobile.png',
    fullPage: true,
  })
})

test('Admin history masks the sidebar identity on offline and cross-tab invalidation', async ({
  page,
  context,
}) => {
  await adminFixture(page)
  let hold = false
  let release
  await page.route('**/api/v1/auth/session', async (route) => {
    if (hold)
      await new Promise((resolve) => {
        release = resolve
      })
    await route.fulfill({
      json: {
        state: 'verified',
        csrf: 'test',
        user: {
          id: 'admin',
          email: 'admin@example.test',
          role: 'ADMIN_PLATEFORME',
        },
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    })
  })
  await page.goto('/history')
  await expect(
    page.getByRole('button', { name: 'Mon compte', exact: true }),
  ).toBeVisible()
  await context.setOffline(true)
  await expect(
    page.getByRole('button', { name: 'Mon compte', exact: true }),
  ).toHaveCount(0)
  await context.setOffline(false)
  await expect(
    page.getByRole('button', { name: 'Mon compte', exact: true }),
  ).toBeVisible()
  hold = true
  await page.evaluate(() => {
    const channel = new BroadcastChannel('mjl-auth')
    channel.postMessage('changed')
    channel.close()
  })
  await expect(
    page.getByRole('button', { name: 'Mon compte', exact: true }),
  ).toHaveCount(0)
  await expect.poll(() => typeof release).toBe('function')
  release()
  await expect(
    page.getByRole('button', { name: 'Mon compte', exact: true }),
  ).toBeVisible()
})

test('users loading covers the route wait and failed-session retry', async ({
  page,
}) => {
  let respond
  let reads = 0
  let retrying = false
  await adminFixture(page)
  await page.route('**/api/v1/auth/session', async (route) => {
    reads += 1
    if (reads === 1 || retrying)
      await new Promise((resolve) => {
        respond = resolve
      })
    await route.fulfill(
      retrying
        ? {
            json: {
              state: 'verified',
              csrf: 'test',
              user: {
                id: 'admin',
                email: 'admin@example.test',
                role: 'ADMIN_PLATEFORME',
              },
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            },
          }
        : { status: 503, json: {} },
    )
  })
  await page.goto('/access/users')
  await expect(
    page.getByRole('status', { name: 'Vérification de votre accès' }),
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-users-loading.png' })
  respond()
  await expect(
    page.getByRole('heading', {
      name: 'Impossible de vérifier votre accès',
    }),
  ).toBeVisible()
  retrying = true
  await page.getByRole('button', { name: 'Réessayer' }).click()
  await expect(
    page.getByRole('status', { name: 'Vérification de votre accès' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Impossible de vérifier votre accès',
    }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Mon compte', exact: true }),
  ).toHaveCount(0)
  respond()
  await expect(
    page.getByRole('table', { name: 'Comptes utilisateurs' }),
  ).toBeVisible()
})

test('history shows the minimal page loader while its data loads', async ({
  page,
}) => {
  await adminFixture(page)
  let finish
  await page.route('**/api/v1/audit-events*', async (route) => {
    await new Promise((resolve) => {
      finish = resolve
    })
    await route.fulfill({
      json: { count: 0, data: [], next: null, previous: null },
    })
  })
  await page.goto('/history')
  await expect(
    page.getByRole('status', { name: 'Chargement : Historique' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Historique', exact: true }),
  ).toHaveCount(0)
  await expect.poll(() => typeof finish).toBe('function')
  finish()
  await expect(
    page.getByRole('heading', { name: 'Aucun événement' }),
  ).toBeVisible()
})

test('account hides identity behind access verification during its session check', async ({
  page,
}) => {
  await adminFixture(page)
  let finish
  await page.route('**/api/v1/auth/session', async (route) => {
    await new Promise((resolve) => {
      finish = resolve
    })
    await route.fulfill({
      json: {
        state: 'verified',
        csrf: 'test',
        user: {
          id: 'admin',
          email: 'admin@example.test',
          role: 'ADMIN_PLATEFORME',
        },
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    })
  })
  await page.goto('/identity')
  await expect(
    page.getByRole('status', { name: 'Vérification de votre accès' }),
  ).toBeVisible()
  await expect(
    page.getByText('admin@example.test', { exact: true }),
  ).toHaveCount(0)
  finish()
  await expect(
    page.getByRole('heading', { name: 'Mon profil', exact: true }),
  ).toBeVisible()
})

test('hiding a protected tab preserves the invitation draft and sidebar', async ({
  page,
}) => {
  await adminFixture(page)
  await page.goto('/access/users')
  await page
    .getByRole('button', { name: 'Inviter un utilisateur', exact: true })
    .click()
  await page.getByRole('dialog').getByLabel('Prénom').fill('Brouillon conservé')
  let reads = 0
  await page.route('**/api/v1/auth/session', (route) => {
    reads++
    return route.abort()
  })
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await expect(page.getByRole('dialog').getByLabel('Prénom')).toHaveValue(
    'Brouillon conservé',
  )
  await expect(
    page
      .getByRole('navigation', { name: 'Administration' })
      .getByRole('link', { name: 'Historique' }),
  ).toBeVisible()
  expect(reads).toBe(0)
})

test('correcting the first name clears combined-name validation', async ({
  page,
}) => {
  await adminFixture(page)
  let sent
  await page.route('**/api/v1/access/invitations', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    sent = route.request().postDataJSON()
    await route.fulfill({ status: 201, json: { id: 'invitation', version: 1 } })
  })
  await page.goto('/access/users')
  await page
    .getByRole('button', { name: 'Inviter un utilisateur', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Prénom', { exact: true }).fill('   ')
  await dialog.getByLabel('Nom de famille', { exact: true }).fill('Martin')
  await dialog.getByLabel('Adresse e-mail').fill('new@example.test')
  await dialog.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  expect(sent).toBeUndefined()
  expect(
    await dialog
      .getByLabel('Nom de famille')
      .evaluate((node) => node.validity.customError),
  ).toBe(true)
  await dialog.getByLabel('Prénom', { exact: true }).fill('Anne')
  await dialog.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  await expect.poll(() => sent?.full_name).toBe('Anne Martin')
})
