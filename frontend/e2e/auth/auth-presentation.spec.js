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
  ['PARTENAIRE', '/dashboard'],
  ['AGENT_SAISIE', '/dashboard'],
  ['AGENT_VERIFICATEUR', '/dashboard'],
  ['VALIDATEUR_DEFINITIF', '/dashboard'],
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

test('a cross-tab role change moves the user to the matching workspace', async ({
  page,
}) => {
  let role = 'ADMIN_PLATEFORME'
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: { object: 'list', count: 0, data: [], next: null, previous: null },
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
  await page.goto('/access/users')
  await expect(page).toHaveURL(/\/access\/users$/)

  role = 'PARTENAIRE'
  await page.evaluate(() => {
    const channel = new BroadcastChannel('mjl-auth')
    channel.postMessage({ type: 'changed', source: 'another-tab' })
    channel.close()
  })

  await expect(page).toHaveURL((url) => url.pathname === '/dashboard')
})

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
  await expect(
    page.getByRole('status', { name: 'Chargement : Connexion' }),
  ).toBeVisible()
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
  await expect(page.getByLabel('Adresse e-mail')).toHaveValue(
    'invited@example.test',
  )
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue('')
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
      json: { items: [], total: 0, page: 1, size: 20 },
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
    page.getByRole('button', { name: 'Réessayer la connexion', exact: true }),
  ).toHaveCount(0)
  await page.unroute('**/api/v1/auth/session')
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ json: { state: 'anonymous', csrf: 'fresh' } }),
  )
  await page.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({ status: 204 }),
  )
  await page.reload()
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
  const resendForm = page
    .getByRole('button', { name: 'Renvoyer le code' })
    .locator('..')
  await expect(resendForm).toHaveCSS('display', 'flex')
  await expect(resendForm).toHaveCSS('gap', '8px')
  await expect(resendForm).toHaveCSS('margin-top', '16px')
  await expect(
    page.getByRole('button', { name: 'Retour à la connexion' }).locator('..'),
  ).toHaveCSS('margin-top', '0px')
  const firstDigit = page.getByLabel('Code de vérification', { exact: true })
  await expect(firstDigit).toHaveCSS('height', '48px')
  await expect(firstDigit).toHaveCSS('font-size', '24px')
  await expect(firstDigit).toHaveCSS('padding', '4px')
  await expect(firstDigit).toHaveCSS('outline-width', '2px')
  await expect(firstDigit).toHaveCSS('outline-offset', '4px')
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
  await page.goto('/dashboard')
  await expect(
    page.locator('aside').getByText('person@example.test', { exact: true }),
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
    page.getByRole('status', { name: 'Vérification de votre accès' }),
  ).toBeVisible()
  await page.evaluate(() => {
    const channel = new BroadcastChannel('mjl-auth')
    channel.postMessage('changed')
    channel.close()
  })
  release()
  await expect(
    page.locator('aside').getByText('person@example.test', { exact: true }),
  ).toBeVisible()
  let logoutCalls = 0
  const logoutCsrf = []
  await page.route('**/api/v1/auth/logout', async (route) => {
    logoutCalls++
    logoutCsrf.push(route.request().headers()['x-csrf-token'])
    if (logoutCalls === 1) await route.abort()
    else {
      session = { state: 'anonymous', csrf: 'fresh' }
      await route.fulfill({ status: 204 })
    }
  })
  await page.getByRole('button', { name: 'Mon compte', exact: true }).click()
  await page
    .getByRole('menuitem', { name: 'Se déconnecter', exact: true })
    .click()
  await expect(
    page.getByText('person@example.test', { exact: true }),
  ).toHaveCount(0)
  await expect(page).toHaveURL(/\/login$/)
  expect(logoutCalls).toBe(2)
  expect(logoutCsrf).toEqual(['test', 'test'])
})

test('login keeps the recovery link close and shows progress inside the CTA', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ json: { state: 'anonymous', csrf: 'test' } }),
  )
  await page.route('**/api/v1/auth/login', () => new Promise(() => {}))
  await page.goto('/login')
  const password = page.getByLabel('Mot de passe', { exact: true })
  await password.fill('Synthetic!93')
  await page.getByLabel('Adresse e-mail').fill('actor@example.test')
  const fieldBox = await password.boundingBox()
  const linkBox = await page
    .getByRole('link', { name: 'Mot de passe oublié ?' })
    .boundingBox()
  expect(linkBox.y - (fieldBox.y + fieldBox.height)).toBeLessThanOrEqual(8)
  const button = page.getByRole('button', { name: 'Se connecter' })
  await button.click()
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('aria-busy', 'true')
  await expect(button.locator('svg')).toBeVisible()
  await expect(button.locator('svg')).toHaveCSS('animation-duration', '1s')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(button.locator('svg')).toHaveCSS('animation-duration', '0s')
  await page.emulateMedia({ forcedColors: 'active' })
  await expect(button).toHaveCSS('border-top-width', '1px')

  await expect(
    page.getByText('Traitement en cours', { exact: false }),
  ).toHaveCount(0)
})

test('a real cross-tab authentication change revalidates even while hidden', async ({
  page,
}) => {
  let reads = 0
  await page.route('**/api/v1/auth/session', async (route) => {
    reads++
    await route.fulfill({
      json: {
        state: 'verified',
        csrf: 'test',
        user: {
          id: 'agent',
          email: 'hidden@example.test',
          role: 'AGENT_SAISIE',
        },
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    })
  })
  await page.goto('/dashboard')
  await expect(
    page.locator('aside').getByText('hidden@example.test', { exact: true }),
  ).toBeVisible()
  const before = reads
  await page.evaluate(async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((resolve) => {
      const observer = new BroadcastChannel('mjl-auth')
      observer.onmessage = () => {
        observer.close()
        resolve()
      }
      const sender = new BroadcastChannel('mjl-auth')
      sender.postMessage({ type: 'changed', source: 'another-tab' })
      sender.close()
    })
  })
  await expect.poll(() => reads).toBe(before + 1)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(
    page.locator('aside').getByText('hidden@example.test', { exact: true }),
  ).toBeVisible()
  expect(reads).toBe(before + 1)
})
