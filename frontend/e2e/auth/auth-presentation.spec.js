import { test, expect } from '@playwright/test'

test('OTP boxes accept pointer and keyboard entry including a leading zero', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: { state: 'pending', csrf: 'test', email: 'a***@example.test' },
    }),
  )
  await page.route('**/api/v1/auth/otp/verify', () => new Promise(() => {}))
  await page.goto('/verification')
  const input = page.getByLabel('Code de vérification')
  await input.click()
  await page.keyboard.type('012345')
  await expect(input).toHaveValue('0')
  await expect(page.getByLabel('Chiffre 6 du code')).toHaveValue('5')
  await expect(
    page.getByRole('button', { name: 'Vérifier le code' }),
  ).toBeDisabled()
  await expect(input).toHaveCSS('opacity', '1')
})

test('OTP supports paste, corrections and submits the exact six digits', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: { state: 'pending', csrf: 'test', email: 'a***@example.test' },
    }),
  )
  let submitted
  await page.route('**/api/v1/auth/otp/verify', async (route) => {
    submitted = route.request().postDataJSON()
    await route.fulfill({ status: 400, json: { code: 'invalid_otp' } })
  })
  await page.goto('/verification')
  await page.getByLabel('Code de vérification', { exact: true }).fill('01234')
  await page.getByLabel('Chiffre 3 du code').click()
  await page.keyboard.press('Backspace')
  await expect(
    page.getByRole('button', { name: 'Vérifier le code' }),
  ).toBeDisabled()
  await page.keyboard.type('9')
  await page.getByLabel('Chiffre 6 du code').fill('5')
  await expect.poll(() => submitted).toEqual({ code: '019345' })
  await expect(page.getByRole('alert')).toContainText('Vérification refusée')
})

for (const [role, destination] of [
  ['ADMIN_PLATEFORME', '/access/users'],
  ['PARTENAIRE', '/partner'],
  ['AGENT_SAISIE', '/projects'],
  ['AGENT_VERIFICATEUR', '/projects'],
  ['VALIDATEUR_DEFINITIF', '/projects'],
]) {
  test(`verified ${role} goes straight to their workspace`, async ({
    page,
  }) => {
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({
        json: {
          count: 0,
          data: [],
          next: null,
          previous: null,
          object: 'list',
        },
      }),
    )
    await page.route('**/api/v1/auth/session', (route) =>
      route.fulfill({
        json: {
          state: 'verified',
          csrf: 'test',
          user: { id: 'fixture', role, email: 'person@example.test' },
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
      }),
    )
    await page.goto('/')
    await expect(page).toHaveURL((url) => url.pathname === destination)
    await page.goto('/login')
    await expect(page).toHaveURL((url) => url.pathname === destination)
  })
}

test('login has a quiet loading state and anonymous home redirects', async ({
  page,
}) => {
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/auth/session', async (route) => {
    await held
    await route.fulfill({ json: { state: 'anonymous', csrf: 'test' } })
  })
  await page.goto('/')
  await expect(page.getByRole('status', { name: 'Chargement…' })).toBeVisible()
  await expect(page.getByText('Vérification de la session…')).toHaveCount(0)
  release()
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('heading', { name: 'Connexion', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Une gestion rigoureuse.', { exact: false }),
  ).toHaveCount(0)
  await page.screenshot({ path: '/tmp/mjl-auth-login-desktop.png' })
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: '/tmp/mjl-auth-login-mobile.png' })
})

test('reconnection rechecks automatically without replaying writes', async ({
  page,
  context,
}) => {
  let writes = 0
  await page.route('**/api/v1/auth/**', (route) => {
    if (route.request().method() === 'POST') writes++
    return route.fulfill({
      json: { state: 'pending', csrf: 'test', email: 'a***@example.test' },
    })
  })
  await page.goto('/verification')
  await page.getByLabel('Code de vérification', { exact: true }).fill('01234')
  await context.setOffline(true)
  await expect(
    page.getByRole('heading', { name: 'Connexion indisponible' }),
  ).toBeVisible()
  await context.setOffline(false)
  await expect(
    page.getByRole('heading', { name: 'Vérification', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByLabel('Code de vérification', { exact: true }),
  ).toHaveValue('')
  expect(writes).toBe(0)
  await expect(page.getByText('Session à vérifier')).toHaveCount(0)
})

test('invitation matches the auth layout, preserves proof handling and validates password', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ json: { state: 'anonymous', csrf: 'test' } }),
  )
  await page.route('**/api/v1/auth/invitations/inspect', (route) =>
    route.fulfill({ json: { email: 'invited@example.test' } }),
  )
  let releaseSave
  const saving = new Promise((resolve) => {
    releaseSave = resolve
  })
  await page.route('**/api/v1/auth/invitations/accept', async (route) => {
    await saving
    await route.fulfill({ json: { state: 'accepted' } })
  })
  await page.goto('/invitation#selector=fixture&verifier=fixture')
  await expect(
    page.getByText('invited@example.test', { exact: true }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/invitation$/)
  await expect(
    page.getByRole('button', { name: 'Enregistrer le mot de passe' }),
  ).toBeDisabled()
  await page
    .getByLabel('Nouveau mot de passe', { exact: true })
    .fill('Synthetic!93')
  await page.getByLabel('Confirmer le mot de passe').fill('Synthetic!93')
  await expect(
    page.getByRole('button', { name: 'Enregistrer le mot de passe' }),
  ).toBeEnabled()
  await page.screenshot({ path: '/tmp/mjl-auth-invitation.png' })
  await page.setViewportSize({ width: 320, height: 700 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await expect(
    page.getByRole('link', { name: 'Retour à la connexion' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Enregistrer le mot de passe' })
    .click()
  await expect(
    page.getByLabel('Nouveau mot de passe', { exact: true }),
  ).toBeDisabled()
  await expect(page.getByLabel('Confirmer le mot de passe')).toBeDisabled()
  releaseSave()
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('heading', { name: 'Connexion', exact: true }),
  ).toBeVisible()
})

test('password then OTP opens the workspace without an intermediate session screen', async ({
  page,
}) => {
  let state = 'anonymous'
  const user = {
    id: 'fixture',
    role: 'ADMIN_PLATEFORME',
    email: 'person@example.test',
  }
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: { count: 0, data: [], next: null, previous: null, object: 'list' },
    }),
  )
  await page.route('**/api/v1/auth/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname
    if (endpoint.endsWith('/login')) state = 'pending'
    if (endpoint.endsWith('/otp/verify')) {
      expect(route.request().postDataJSON()).toEqual({ code: '012345' })
      expect(route.request().headers()['x-csrf-token']).toBe('test')
      state = 'verified'
    }
    await route.fulfill({
      json: {
        state,
        csrf: 'test',
        email: 'p***@example.test',
        ...(state === 'verified'
          ? { user, expires_at: new Date(Date.now() + 3600000).toISOString() }
          : {}),
      },
    })
  })
  await page.goto('/')
  await page.getByLabel('Adresse e-mail').fill(user.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill('Synthetic!93')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Vérification', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Code de vérification', { exact: true }).fill('012345')
  await expect(page).toHaveURL((url) => url.pathname === '/access/users')
  await expect(
    page.getByRole('heading', { name: 'Utilisateurs', exact: true }),
  ).toBeVisible()
})

test('expired cookies recover to login and service failures offer a retry', async ({
  page,
}) => {
  let calls = 0
  await page.route('**/api/v1/auth/session', (route) => {
    calls++
    return route.fulfill(
      calls === 1
        ? { status: 401, json: { code: 'session_expired' } }
        : { json: { state: 'anonymous', csrf: 'fresh' } },
    )
  })
  await page.goto('/identity')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible()
  await page.unroute('**/api/v1/auth/session')
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ status: 503, json: {} }),
  )
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Réessayer', exact: true }),
  ).toBeVisible()
  await page.unroute('**/api/v1/auth/session')
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ json: { state: 'anonymous', csrf: 'fresh' } }),
  )
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible()
})

test('OTP fields reflow and retain visible keyboard focus at narrow widths', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: { state: 'pending', csrf: 'test', email: 'p***@example.test' },
    }),
  )
  await page.route('**/api/v1/auth/otp/verify', () => new Promise(() => {}))
  await page.goto('/verification')
  await expect(
    page.getByRole('heading', { name: 'Vérification', exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-auth-otp-desktop.png' })
  await page.setViewportSize({ width: 320, height: 700 })
  await expect(
    page.getByLabel('Code de vérification', { exact: true }),
  ).toBeFocused()
  await page.keyboard.type('012345')
  await expect(page.getByLabel('Chiffre 6 du code')).toBeDisabled()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: '/tmp/mjl-auth-otp-mobile.png' })
})

test('account revalidation masks stale identity and an interrupted logout stays masked', async ({
  page,
}) => {
  const verified = {
    state: 'verified',
    csrf: 'test',
    user: {
      id: 'fixture',
      role: 'ADMIN_PLATEFORME',
      email: 'person@example.test',
    },
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  }
  let session = verified
  let hold = false
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/auth/session', async (route) => {
    if (hold) await held
    await route.fulfill({ json: session })
  })
  await page.goto('/identity')
  await expect(
    page.getByText('person@example.test', { exact: true }),
  ).toBeVisible()
  hold = true
  await page.evaluate(() => {
    const channel = new BroadcastChannel('mjl-auth')
    channel.postMessage('changed')
    channel.close()
  })
  await expect(
    page.getByText('person@example.test', { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('status', { name: 'Chargement du compte' }),
  ).toBeVisible()
  await page.evaluate(() => {
    const channel = new BroadcastChannel('mjl-auth')
    channel.postMessage('changed')
    channel.close()
  })
  release()
  await expect(
    page.getByText('person@example.test', { exact: true }),
  ).toBeVisible()
  let logoutCalls = 0
  await page.route('**/api/v1/auth/logout', async (route) => {
    logoutCalls++
    if (logoutCalls === 1) await route.abort()
    else {
      session = { state: 'anonymous', csrf: 'fresh' }
      await route.fulfill({ status: 204 })
    }
  })
  await page
    .getByRole('button', { name: 'Se déconnecter', exact: true })
    .click()
  await expect(
    page.getByText('person@example.test', { exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText(
    'Déconnexion non confirmée',
  )
  await expect(
    page.getByRole('button', { name: 'Réessayer la déconnexion' }),
  ).toBeEnabled()
  expect(logoutCalls).toBe(1)
  await page.getByRole('button', { name: 'Réessayer la déconnexion' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(logoutCalls).toBe(2)
})
