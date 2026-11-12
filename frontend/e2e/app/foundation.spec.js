import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

async function controlledPage(page) {
  await page.goto('/health')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  await expect(
    page.getByText('Service disponible', { exact: true }),
  ).toBeVisible()
}

test('real frontend/backend proxy, routes, responsive shell and design tokens', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Espace MJL' })).toBeVisible()
  await page.getByRole('link', { name: 'État du service', exact: true }).click()
  await expect(
    page.getByText('Service disponible', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(async () => (await fetch('/api/health/ready')).json()),
  ).toEqual({ status: 'ok' })
  await expect(
    page.getByRole('button', { name: 'Vérifier maintenant' }),
  ).toHaveCSS('background-color', 'rgb(22, 79, 122)')
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(245, 247, 248)',
  )
  await page.getByRole('button', { name: 'Vérifier maintenant' }).focus()
  await expect(
    page.getByRole('button', { name: 'Vérifier maintenant' }),
  ).toBeFocused()
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.goto('/absent')
  await expect(
    page.getByRole('heading', { name: 'Page introuvable' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Retour à mon espace' }).click()
  await expect(page.getByRole('heading', { name: 'Espace MJL' })).toBeVisible()
  expect(errors).toEqual([])
})

test('installable shell caches static assets only and never replays offline API requests', async ({
  page,
  context,
}) => {
  await controlledPage(page)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Page.enable')
  const manifest = await cdp.send('Page.getAppManifest')
  expect(manifest.errors).toEqual([])
  const data = JSON.parse(manifest.data)
  expect(data.display).toBe('standalone')
  expect(data.icons.map(({ sizes, purpose }) => ({ sizes, purpose }))).toEqual([
    { sizes: '192x192', purpose: 'any' },
    { sizes: '512x512', purpose: 'any' },
    { sizes: '512x512', purpose: 'maskable' },
  ])
  expect(
    (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors,
  ).toEqual([])
  await page.evaluate(async () => {
    await fetch('/api/health/ready', { cache: 'no-store' })
    await fetch('/api/health/live', { method: 'POST' })
    await fetch('/api/auth/session') // absent, never an app-shell fallback
  })
  const cached = await page.evaluate(async () => {
    const urls = []
    for (const name of await caches.keys())
      for (const r of await (await caches.open(name)).keys()) urls.push(r.url)
    return urls
  })
  expect(cached.some((url) => url.includes('/assets/'))).toBe(true)
  expect(cached.every((url) => !url.includes('/api/'))).toBe(true)
  let onlinePosts = 0
  page.on('request', (request) => {
    if (request.method() === 'POST') onlinePosts++
  })
  await context.setOffline(true)
  await expect(
    page.getByText('Hors connexion — service indisponible'),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'État du service' }),
  ).toBeVisible()
  await expect(
    page.getByText('Service disponible', { exact: true }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(async () => {
      try {
        await fetch('/api/health/live', { method: 'POST' })
        return 'unexpected'
      } catch {
        return 'failed'
      }
    }),
  ).toBe('failed')
  const offlinePosts = onlinePosts
  // No registrations means no Background Sync queue. No business IndexedDB store.
  expect(
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready
      if (!('sync' in r)) return []
      try {
        return await r.sync.getTags()
      } catch (error) {
        // Chromium disables Background Sync in this isolated browser context.
        if (error.message === 'Background Sync is disabled.') return []
        throw error
      }
    }),
  ).toEqual([])
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Vérifier maintenant' }).click()
  await expect(
    page.getByText('Service disponible', { exact: true }),
  ).toBeVisible()
  expect(onlinePosts).toBe(offlinePosts)
  expect(
    await page.evaluate(async () =>
      (await indexedDB.databases()).map((d) => d.name),
    ),
  ).toEqual([])
})

test('service-worker update activates and reopens the application on login', async ({
  page,
}) => {
  await page.route('**/api/health/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  )
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ state: 'anonymous', csrf: 'test-csrf' }),
    }),
  )
  await page.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({ status: 204 }),
  )
  await controlledPage(page)
  const path = new URL('../../dist/sw.js', import.meta.url)
  const original = await readFile(path, 'utf8')
  try {
    await writeFile(path, `${original}\n// disposable update verification\n`)
    await page.evaluate(async () =>
      (await navigator.serviceWorker.ready).update(),
    )
    await expect(
      page.getByText('Une nouvelle version est disponible.', { exact: false }),
    ).toHaveCount(0)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel('Adresse e-mail')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(async () =>
          Boolean((await navigator.serviceWorker.ready).waiting),
        ),
      )
      .toBe(false)
  } finally {
    await writeFile(path, original)
  }
})
