import { test, expect } from '@playwright/test'

async function fixture(page, role = 'AGENT_SAISIE') {
  const calls = []
  let profile = {
    full_name: 'Jean Paul de Souza',
    first_name: 'Jean Paul',
    last_name: 'de Souza',
    email: 'actor@example.test',
    role,
  }
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    calls.push(url.pathname)
    let body = {
      object: 'list',
      count: 0,
      data: [],
      next: null,
      previous: null,
    }
    if (url.pathname === '/api/v1/auth/session')
      body = {
        state: 'verified',
        csrf: 'fixture',
        user: { id: 'actor', ...profile },
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }
    if (url.pathname === '/api/v1/auth/profile') {
      if (request.method() === 'PATCH') {
        const input = request.postDataJSON()
        expect(input.expected.full_name).toBe(profile.full_name)
        profile = {
          ...profile,
          first_name: input.first_name,
          last_name: input.last_name,
          full_name: `${input.first_name} ${input.last_name}`,
        }
      }
      body = profile
    }
    if (url.pathname === '/api/v1/access/users')
      body = {
        items: [{ id: 'actor', ...profile, state: 'active', version: 1 }],
        total: url.searchParams.get('state') === 'pending' ? 0 : 1,
        page: 1,
        size: 20,
      }
    if (url.pathname === '/api/v1/access/invitations')
      body = { items: [], total: 0, page: 1, size: 20 }
    await route.fulfill({ json: body })
  })
  return calls
}

test('Dashboard and planning share cached projects, and tab changes preserve the workspace', async ({
  page,
}) => {
  const calls = await fixture(page)
  await page.goto('/dashboard')
  await expect(page.getByText('0 %', { exact: true })).toHaveCount(2)
  await page
    .getByRole('link', { name: 'Prévisions (PTA)', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Aucun PTA' })).toBeVisible()
  await page.getByRole('link', { name: 'Tableau de bord', exact: true }).click()
  await expect(page.getByText('0 %', { exact: true })).toHaveCount(2)
  const before = calls.length
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pageshow'))
  })
  await expect(page.getByText('0 %', { exact: true })).toHaveCount(2)
  expect(calls.length).toBe(before)
  expect(calls.filter((path) => path === '/api/v1/projects')).toHaveLength(1)
})

test('legacy identity redirects to centered editable profile and saves exact names', async ({
  page,
}) => {
  await fixture(page)
  await page.setViewportSize({ width: 1848, height: 974 })
  await page.goto('/identity')
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByLabel('Prénoms')).toHaveValue('Jean Paul')
  await expect(page.getByLabel('Adresse email')).toHaveAttribute('readonly', '')
  const form = page.locator('form')
  const box = await form.boundingBox()
  expect(
    Math.abs(box.x + box.width / 2 - (256 + (1848 - 256) / 2)),
  ).toBeLessThan(2)
  await page.getByLabel('Nom', { exact: true }).fill('de Souza Martin')
  await page
    .getByRole('button', { name: 'Enregistrer les modifications' })
    .click()
  await expect(page.getByText('Votre profil a été mis à jour.')).toBeVisible()
  await expect(
    page
      .locator('aside')
      .getByText('Jean Paul de Souza Martin', { exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: '/tmp/mjl-profile-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: '/tmp/mjl-profile-mobile.png', fullPage: true })
})

test('Admin overview loads only account summaries and invitation action opens the form', async ({
  page,
}) => {
  const calls = await fixture(page, 'ADMIN_PLATEFORME')
  await page.setViewportSize({ width: 1848, height: 974 })
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { name: 'Administration', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Comptes actifs', { exact: true })).toBeVisible()
  expect(calls).not.toContain('/api/v1/projects')
  await page.screenshot({
    path: '/tmp/mjl-admin-dashboard.png',
    fullPage: true,
  })
  await page.getByRole('link', { name: 'Inviter un utilisateur' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await expect(
    page
      .getByRole('table', { name: 'Comptes utilisateurs' })
      .getByRole('columnheader'),
  ).toHaveCount(5)
  await page.screenshot({
    path: '/tmp/mjl-admin-users-current.png',
    fullPage: true,
  })
})
