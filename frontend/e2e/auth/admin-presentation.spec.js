import { test, expect } from '@playwright/test'

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
    page.getByText('Aucun utilisateur.', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Rechercher par e-mail').fill('')
  await page.getByRole('button', { name: 'Filtrer', exact: true }).click()
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
  await page.getByRole('link', { name: 'Mon compte', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Mon compte', exact: true }),
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
  await expect(page.getByRole('dialog').getByLabel('Nom complet')).toBeVisible()
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
  await page.goto('/history')
  await expect(
    page.getByRole('link', { name: 'Mon compte', exact: true }),
  ).toBeVisible()
  await context.setOffline(true)
  await expect(
    page.getByRole('link', { name: 'Mon compte', exact: true }),
  ).toHaveCount(0)
  await context.setOffline(false)
  await page
    .getByRole('button', { name: 'Vérifier mon accès', exact: true })
    .click()
  await expect(
    page.getByRole('link', { name: 'Mon compte', exact: true }),
  ).toBeVisible()
  await page.evaluate(() => {
    const channel = new BroadcastChannel('mjl-auth')
    channel.postMessage('changed')
    channel.close()
  })
  await expect(
    page.getByRole('link', { name: 'Mon compte', exact: true }),
  ).toHaveCount(0)
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
    page.getByRole('status', { name: 'Chargement des utilisateurs' }),
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-users-loading.png' })
  respond()
  await expect(
    page.getByRole('heading', { name: 'Service indisponible' }),
  ).toBeVisible()
  retrying = true
  await page.getByRole('button', { name: 'Réessayer' }).click()
  await expect(
    page.getByRole('status', { name: 'Chargement des utilisateurs' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Service indisponible' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Mon compte', exact: true }),
  ).toHaveCount(0)
  respond()
  await expect(
    page.getByRole('table', { name: 'Comptes utilisateurs' }),
  ).toBeVisible()
})

test('history shows a page skeleton while its data loads', async ({ page }) => {
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
  ).toBeVisible()
  finish()
  await expect(page.getByText('Aucun événement enregistré.')).toBeVisible()
})

test('account hides identity and shows form placeholders during its session check', async ({
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
      },
    })
  })
  await page.goto('/identity')
  await expect(
    page.getByRole('status', { name: 'Chargement du compte' }),
  ).toBeVisible()
  await expect(
    page.getByText('admin@example.test', { exact: true }),
  ).toHaveCount(0)
  finish()
  await expect(
    page.getByRole('heading', { name: 'Mon compte', exact: true }),
  ).toBeVisible()
})

test('an invitation draft survives background session loading', async ({
  page,
}) => {
  await adminFixture(page)
  await page.goto('/access/users')
  await page
    .getByRole('button', { name: 'Inviter un utilisateur', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByLabel('Nom complet')
    .fill('Brouillon conservé')
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
      },
    })
  })
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    window.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    window.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(
    page.getByRole('status', { name: 'Chargement des utilisateurs' }),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  finish()
  await expect(page.getByRole('dialog').getByLabel('Nom complet')).toHaveValue(
    'Brouillon conservé',
  )
})
