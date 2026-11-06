import { test, expect } from '@playwright/test'
const user = {
  id: 'recovery-agent',
  role: 'AGENT_SAISIE',
  email: 'agent@example.test',
  full_name: 'Aminata Dossou',
}
const verified = {
  state: 'verified',
  csrf: 'fixture',
  user,
  expires_at: new Date(Date.now() + 3600000).toISOString(),
}

test('session outage returns to login and surviving cookie requires server logout before fresh sign-in', async ({
  page,
}) => {
  let unavailable = true
  let signedOut = false
  let reads = 0
  let logouts = 0
  await page.route('**/api/v1/auth/session', (route) => {
    reads++
    return route.fulfill(
      unavailable
        ? { status: 502, json: { code: 'service_unavailable' } }
        : {
            json: signedOut ? { state: 'anonymous', csrf: 'fresh' } : verified,
          },
    )
  })
  await page.route('**/api/v1/auth/logout', (route) => {
    logouts++
    signedOut = true
    return route.fulfill({ status: 204 })
  })
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toContainText(
    'momentanément indisponible',
  )
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Réessayer la connexion' }),
  ).toBeVisible()
  expect(reads).toBe(1)
  unavailable = false
  await page.getByRole('button', { name: 'Réessayer la connexion' }).click()
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible()
  expect(logouts).toBe(1)
  await expect(page.locator('[data-ui="access-sidebar"]')).toHaveCount(0)
})

for (const connected of [false, true]) {
  test(`not found uses ${connected ? 'application' : 'auth'} sidebar`, async ({
    page,
  }) => {
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({
        json: { data: [], count: 0, next: null, previous: null },
      }),
    )
    await page.route('**/api/v1/auth/session', (route) =>
      route.fulfill({
        json: connected ? verified : { state: 'anonymous', csrf: 'fixture' },
      }),
    )
    await page.goto('/unknown-address')
    await expect(
      page.getByRole('heading', { name: 'Page introuvable' }),
    ).toBeVisible()
    await expect(
      page.locator(
        connected ? '[data-ui="access-sidebar"]' : '[data-ui="auth-layout"]',
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'État du service' }),
    ).toHaveCount(0)
  })
}

test('direct logout clears server session and returns ready login', async ({
  page,
}) => {
  let signedOut = false
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: signedOut ? { state: 'anonymous', csrf: 'fresh' } : verified,
    }),
  )
  await page.route('**/api/v1/auth/logout', (route) => {
    signedOut = true
    return route.fulfill({ status: 204 })
  })
  await page.goto('/logout')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible()
  expect(signedOut).toBe(true)
})

for (const pendingStage of ['patch', 'refresh']) {
  test(`Relances closes safely during ${pendingStage}`, async ({ page }) => {
    let release
    let patched = false
    const item = {
      id: 'reminder-one',
      activity_id: 'activity-one',
      activity_reference: 'ACT-2026-001',
      activity_name: 'Formation des équipes',
      planned_end: '2026-10-19',
      pta_year: 2026,
      created_at: '2026-09-28T08:00:00Z',
      read_at: null,
      version: 1,
    }
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({
        json: { data: [], count: 0, next: null, previous: null },
      }),
    )
    await page.route('**/api/v1/auth/session', (route) =>
      route.fulfill({ json: verified }),
    )
    await page.route('**/api/v1/notifications**', async (route) => {
      if (route.request().method() === 'PATCH') {
        if (pendingStage === 'patch')
          await new Promise((resolve) => {
            release = resolve
          })
        patched = true
        return route
          .fulfill({
            json: { ...item, read_at: '2026-10-01T08:00:00Z', version: 2 },
          })
          .catch(() => {})
      }
      if (pendingStage === 'refresh' && patched)
        await new Promise((resolve) => {
          release = resolve
        })
      return route
        .fulfill({
          json: { data: [item], count: 1, next: null, previous: null },
        })
        .catch(() => {})
    })
    await page.goto('/unknown-address')
    await page.getByRole('button', { name: /Relances/ }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Relances administratives',
    })
    await expect(dialog.getByText('ACT-2026-001 · PTA 2026')).toBeVisible()
    if (pendingStage === 'patch')
      await page.screenshot({ path: '/tmp/mjl-relances-modal.png' })
    await dialog.getByRole('link', { name: 'Ouvrir l’activité' }).click()
    await expect.poll(() => Boolean(release)).toBe(true)
    await dialog.getByRole('button', { name: 'Fermer' }).click()
    release()
    await expect(dialog).not.toBeVisible()
    await expect(page).toHaveURL(/\/unknown-address$/)
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
  })
}
