import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const mailbox = process.env.MJL_A1_MAILBOX
const container = process.env.MJL_A1_CONTAINER
const password = 'Synthetic!93'
const email = 'browser@example.test'

function message(kind) {
  const files = readdirSync(mailbox)
    .map((file) => path.join(mailbox, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  return files
    .map((file) => JSON.parse(readFileSync(file, 'utf8')))
    .find((mail) => mail.kind === kind).value
}

test('T01–T18 real first Admin browser journey, cache isolation and online-only security', async ({
  page,
  context,
}) => {
  test.skip(
    !mailbox || !container,
    'Requires the explicitly isolated A1 test environment',
  )
  test.setTimeout(90000)
  expect(container).toBe('mjl-a1-test-backend-1')
  expect(mailbox).toMatch(/^\/tmp\/mjl-a1-mail-/)
  const result = execFileSync(
    'docker',
    [
      'exec',
      container,
      'python',
      '-m',
      'app.auth.bootstrap',
      '--email',
      email,
      '--name',
      'Admin Navigateur',
    ],
    { encoding: 'utf8' },
  )
  expect(result).not.toContain('verifier=')
  await page.goto(message('invitation'))
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  expect(page.url()).not.toContain('verifier=')
  expect(page.url()).not.toContain('#')
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(password)
  await page
    .getByLabel('Confirmer le mot de passe', { exact: true })
    .fill(password)
  await page
    .getByRole('button', { name: 'Afficher le mot de passe' })
    .first()
    .click()
  await expect(
    page.getByLabel('Nouveau mot de passe', { exact: true }),
  ).toHaveAttribute('type', 'text')
  await page
    .getByRole('button', { name: 'Enregistrer le mot de passe' })
    .click()
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/auth/login') && r.status() === 202,
    ),
    page.getByRole('button', { name: 'Se connecter', exact: true }).click(),
  ])
  await expect(
    page.getByRole('heading', { name: 'Vérification' }),
  ).toBeVisible()
  await expect(
    page.getByText('b***@example.test', { exact: false }),
  ).toBeVisible()
  expect((await page.request.get('/api/v1/auth/session')).status()).toBe(200)
  const preauth = (await context.cookies()).find(
    (cookie) => cookie.name === 'mjl_local',
  ).value
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  const input = page.getByLabel('Code de vérification')
  await input.focus()
  await expect(input).toBeFocused()
  await input.fill(message('otp'))
  await expect(page).toHaveURL(/\/access\/users(\?|$)/)
  await page.goto('/identity')
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible()
  const session = (await context.cookies()).find(
    (cookie) => cookie.name === 'mjl_local',
  )
  expect(session.value).not.toBe(preauth)
  expect(session.httpOnly).toBe(true)
  expect(session.sameSite).toBe('Lax')
  const other = await context.newPage()
  await other.goto('/identity')
  await expect(other.getByText(email, { exact: true })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  const stored = await page.evaluate(async () => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    databases: await indexedDB.databases(),
    cache: (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map((r) => r.url),
        ),
      )
    ).flat(),
  }))
  expect(stored.local).toEqual({})
  expect(stored.session).toEqual({})
  expect(stored.databases).toEqual([])
  expect(
    stored.cache.every(
      (url) => !url.includes('/api/') && !url.includes('verifier='),
    ),
  ).toBe(true)
  await context.setOffline(true)
  await expect(
    page.getByRole('heading', { name: 'Connexion indisponible' }),
  ).toBeVisible()
  await expect(page.getByText(email, { exact: true })).toHaveCount(0)
  let replay = 0
  page.on('request', (request) => {
    if (request.method() === 'POST') replay++
  })
  await context.setOffline(false)
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible()
  expect(replay).toBe(0)
  await page
    .getByRole('button', { name: 'Se déconnecter', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  await expect(other.getByText(email, { exact: true })).toHaveCount(0)
  await expect(
    other.getByRole('heading', { name: 'Connexion', exact: true }),
  ).toBeVisible()
  const old = await page.request.get('/api/v1/auth/session', {
    headers: { Cookie: `mjl_local=${session.value}` },
  })
  expect(old.status()).toBe(401)
  await page.goto('/identity')
  await expect(page.getByText(email, { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Connexion', exact: true }),
  ).toBeVisible()
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  const workerPath = new URL('../../dist/sw.js', import.meta.url)
  const original = await readFile(workerPath, 'utf8')
  try {
    await writeFile(
      workerPath,
      `${original}\n// A1 dirty-form update fixture\n`,
    )
    await page.evaluate(async () =>
      (await navigator.serviceWorker.ready).update(),
    )
    await expect(
      page.getByText('Une nouvelle version est disponible.', { exact: false }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Actualiser l’application' }).click()
    await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue(
      password,
    )
    expect(
      await page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.ready).waiting),
      ),
    ).toBe(true)
  } finally {
    await writeFile(workerPath, original)
  }
})

function databaseFixture(source) {
  execFileSync(
    'docker',
    [
      'exec',
      container,
      'python',
      '-c',
      `from app.core.config import database_url\nfrom app.core.database import make_engine\nfrom sqlalchemy import text\nengine=make_engine(database_url())\nwith engine.begin() as db:\n ${source}`,
    ],
    { encoding: 'utf8' },
  )
}

async function signIn(page, identity) {
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill(identity)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/auth/login') && r.status() === 202,
    ),
    page.getByRole('button', { name: 'Se connecter', exact: true }).click(),
  ])
  await expect(page.getByLabel('Code de vérification')).toBeVisible()
  await page.getByLabel('Code de vérification').fill(message('otp'))
  await expect(page).toHaveURL(/\/(access\/users|projects|partner)(\?|$)/)
  await page.goto('/identity')
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible()
}

test('T13–T14 expiry timer, late previous identity, real account change and interrupted logout', async ({
  page,
  context,
}) => {
  test.skip(
    !mailbox || !container,
    'Requires the explicitly isolated A1 test environment',
  )
  test.setTimeout(90000)
  databaseFixture(
    'db.execute(text("UPDATE auth_user SET email=\'browser@example.test\',version=version+1")); db.execute(text("UPDATE auth_otp SET sent_at=sent_at-interval \'61 seconds\',resends=0"))',
  )
  await signIn(page, email)
  let nearExpiry = true
  let expiryReads = 0
  let releaseExpiry
  const expiryRead = new Promise((resolve) => {
    releaseExpiry = resolve
  })
  await page.route('**/api/v1/auth/session', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    if (nearExpiry && body.state === 'verified') {
      expiryReads++
      if (expiryReads === 1)
        body.expires_at = new Date(Date.now() + 1500).toISOString()
      else await expiryRead
    }
    await route.fulfill({ response, json: body })
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible()
  await expect(page.getByText(email, { exact: true })).toHaveCount(0)
  nearExpiry = false
  releaseExpiry()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await page.unroute('**/api/v1/auth/session')

  const other = await context.newPage()
  let release
  let fetched
  const captured = new Promise((resolve) => {
    fetched = resolve
  })
  const delayed = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/auth/session', async (route) => {
    const response = await route.fetch()
    fetched()
    await delayed
    await route.fulfill({ response }).catch(() => {})
  })
  const navigation = page.goto('/identity')
  await captured
  databaseFixture(
    'db.execute(text("UPDATE auth_user SET email=\'switched@example.test\',version=version+1")); db.execute(text("UPDATE auth_otp SET sent_at=sent_at-interval \'61 seconds\'"))',
  )
  await other.goto('/login')
  await other.getByLabel('Adresse e-mail').fill('switched@example.test')
  await other.getByLabel('Mot de passe', { exact: true }).fill(password)
  await Promise.all([
    other.waitForResponse(
      (r) => r.url().endsWith('/auth/login') && r.status() === 202,
    ),
    other.getByRole('button', { name: 'Se connecter', exact: true }).click(),
  ])
  await other.getByLabel('Code de vérification').fill(message('otp'))
  await expect(other).toHaveURL(/\/(access\/users|projects|partner)(\?|$)/)
  await other.goto('/identity')
  await expect(
    other.getByText('switched@example.test', { exact: true }),
  ).toBeVisible()
  release()
  await navigation
  await expect(page.getByText(email, { exact: true })).toHaveCount(0)
  await page.unroute('**/api/v1/auth/session')
  await expect(
    page.getByText('switched@example.test', { exact: true }),
  ).toBeVisible()

  let releaseLogout
  let logoutStarted
  const started = new Promise((resolve) => {
    logoutStarted = resolve
  })
  const held = new Promise((resolve) => {
    releaseLogout = resolve
  })
  await page.route('**/api/v1/auth/logout', async (route) => {
    logoutStarted()
    await held
    await route.abort().catch(() => {})
  })
  await page
    .getByRole('button', { name: 'Se déconnecter', exact: true })
    .click()
  await started
  await context.setOffline(true)
  releaseLogout()
  await expect(
    page.getByText('Déconnexion non confirmée.', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByText('switched@example.test', { exact: true }),
  ).toHaveCount(0)
  await context.setOffline(false)
  await page.unroute('**/api/v1/auth/logout')
  await page.getByRole('button', { name: 'Réessayer la déconnexion' }).click()
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
})
