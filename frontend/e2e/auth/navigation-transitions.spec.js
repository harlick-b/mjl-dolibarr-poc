import { test, expect } from '@playwright/test'
const list = { object: 'list', count: 0, data: [], next: null, previous: null }
const user = {
  id: 'transition-agent',
  role: 'AGENT_SAISIE',
  email: 'agent@example.test',
}

test('login errors and late responses do not follow navigation to password recovery', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ json: { state: 'anonymous', csrf: 'fixture' } }),
  )
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({ status: 401, json: { code: 'credentials_invalid' } }),
  )
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill('actor@example.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('Synthetic!93')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click()
  await expect(
    page.getByRole('heading', { name: 'Mot de passe oublié ?' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('link', { name: 'Retour à la connexion' }).click()
  let release
  await page.route('**/api/v1/auth/login', async (route) => {
    await new Promise((resolve) => {
      release = resolve
    })
    await route
      .fulfill({ status: 401, json: { code: 'credentials_invalid' } })
      .catch(() => {})
  })
  await page.getByLabel('Adresse e-mail').fill('actor@example.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('Synthetic!93')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect.poll(() => Boolean(release)).toBe(true)
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click()
  release()
  await expect(
    page.getByRole('heading', { name: 'Mot de passe oublié ?' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('login holds its CTA until OTP context is ready and Agent reaches Dashboard', async ({
  page,
}) => {
  let state = 'anonymous'
  let release
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: list }))
  await page.route('**/api/v1/auth/session', async (route) => {
    if (state === 'pending')
      await new Promise((resolve) => {
        release = resolve
      })
    await route.fulfill({
      json: {
        state,
        csrf: 'fixture',
        email: 'a***@example.test',
        ...(state === 'verified'
          ? { user, expires_at: new Date(Date.now() + 3600000).toISOString() }
          : {}),
      },
    })
  })
  await page.route('**/api/v1/auth/login', async (route) => {
    state = 'pending'
    await route.fulfill({ json: {} })
  })
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    state = 'verified'
    await route.fulfill({ json: {} })
  })
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill(user.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill('ValidPass1!')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect.poll(() => Boolean(release)).toBe(true)
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('button', { name: 'Se connecter' }),
  ).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  await expect(page.getByLabel('Adresse e-mail')).toHaveValue(user.email)
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue(
    'ValidPass1!',
  )
  release()
  await page.getByLabel('Code de vérification', { exact: true }).fill('012345')
  await expect(
    page.getByRole('heading', { name: 'Tableau de bord', level: 1 }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('Accès refusé')).toHaveCount(0)
})

test('account menu logs out through one loader then returns to ready login', async ({
  page,
}) => {
  let state = 'verified'
  let releaseLogout
  let releaseSession
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: list }))
  await page.route('**/api/v1/auth/session', async (route) => {
    if (state === 'anonymous')
      await new Promise((resolve) => {
        releaseSession = resolve
      })
    await route.fulfill({
      json: {
        state,
        csrf: 'fixture',
        email: 'a***@example.test',
        ...(state === 'verified'
          ? { user, expires_at: new Date(Date.now() + 3600000).toISOString() }
          : {}),
      },
    })
  })
  await page.route('**/api/v1/auth/logout', async (route) => {
    await new Promise((resolve) => {
      releaseLogout = resolve
    })
    state = 'anonymous'
    await route.fulfill({ status: 204 })
  })
  await page.goto('/notifications')
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page).toHaveURL(/\/notifications$/)
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click()
  await expect(page.locator('[data-ui="logout-screen"]')).toBeVisible()
  await expect(page.getByText(user.email)).toHaveCount(0)
  await expect.poll(() => Boolean(releaseLogout)).toBe(true)
  releaseLogout()
  await expect.poll(() => Boolean(releaseSession)).toBe(true)
  await expect(page.locator('[data-ui="logout-screen"]')).toBeVisible()
  await expect(page.locator('[data-ui="auth-layout"]')).toHaveCount(0)
  releaseSession()
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled()
  await expect(page).toHaveURL(/\/login$/)
  await page.route('**/api/v1/auth/login', async (route) => {
    state = 'pending'
    await route.fulfill({ json: {} })
  })
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    state = 'verified'
    await route.fulfill({ json: {} })
  })
  await page.getByLabel('Adresse e-mail').fill(user.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill('ValidPass1!')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByLabel('Code de vérification', { exact: true }).fill('012345')
  await expect(page).toHaveURL(/\/notifications$/)
})

test('account menu keyboard focus, mobile containment, and denied content centering', async ({
  page,
}) => {
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: list }))
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        state: 'verified',
        csrf: 'fixture',
        user,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    }),
  )
  await page.setViewportSize({ width: 1846, height: 970 })
  await page.goto('/projects')
  const trigger = page.getByRole('button', { name: 'Mon compte' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Mon profil' })).toBeFocused()
  await page.keyboard.press('End')
  await expect(
    page.getByRole('menuitem', { name: 'Se déconnecter' }),
  ).toBeFocused()
  await page.screenshot({ path: '/tmp/mjl-account-menu-desktop.png' })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByRole('menuitem', { name: 'Mon profil' })).toBeFocused()
  await page.keyboard.press('Escape')
  await page.goto('/access/users')
  const denied = page.getByRole('heading', { name: 'Accès refusé' })
  await expect(denied).toBeVisible()
  const main = await page.locator('[data-ui="workspace-main"]').boundingBox()
  const heading = await denied.boundingBox()
  expect(
    Math.abs(heading.x + heading.width / 2 - (main.x + main.width / 2)),
  ).toBeLessThan(2)
  await page.screenshot({ path: '/tmp/mjl-access-denied-centered.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await trigger.click()
  const menu = await page.getByRole('menu').boundingBox()
  expect(menu.x).toBeGreaterThanOrEqual(0)
  expect(menu.x + menu.width).toBeLessThanOrEqual(390)
  expect(menu.y).toBeGreaterThanOrEqual(0)
  await page.screenshot({ path: '/tmp/mjl-account-menu-mobile.png' })
})

test('password criteria use the approved blue badge pair', async ({ page }) => {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ json: { state: 'anonymous', csrf: 'fixture' } }),
  )
  await page.route('**/api/v1/auth/invitations/inspect', (route) =>
    route.fulfill({ json: { email: 'invited@example.test' } }),
  )
  await page.goto('/invitation#selector=test&verifier=fixture')
  await page
    .getByLabel('Nouveau mot de passe', { exact: true })
    .fill('ValidPass1!')
  const criterion = page.getByText('✓ 8 caractères minimum', { exact: true })
  await expect(criterion).toHaveCSS('color', 'rgb(22, 79, 122)')
  await expect(criterion).toHaveCSS('background-color', 'rgb(234, 243, 248)')
  await page.screenshot({ path: '/tmp/mjl-password-criteria.png' })
})

test('logout session-check failure returns to login without restoring identity', async ({
  page,
}) => {
  let signedOut = false
  let failCheck = true
  let logoutCalls = 0
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: list }))
  await page.route('**/api/v1/auth/session', (route) => {
    if (signedOut && failCheck)
      return route.fulfill({
        status: 503,
        json: { code: 'service_unavailable', message: 'Indisponible' },
      })
    return route.fulfill({
      json: signedOut
        ? { state: 'anonymous', csrf: 'fresh' }
        : {
            state: 'verified',
            csrf: 'fixture',
            user,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          },
    })
  })
  await page.route('**/api/v1/auth/logout', (route) => {
    logoutCalls++
    signedOut = true
    return route.fulfill({ status: 204 })
  })
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click()
  await expect(
    page.getByRole('button', { name: 'Réessayer la connexion' }),
  ).toBeEnabled()
  await expect(page.getByText(user.email)).toHaveCount(0)
  expect(logoutCalls).toBe(1)
  failCheck = false
  await page.getByRole('button', { name: 'Réessayer la connexion' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
