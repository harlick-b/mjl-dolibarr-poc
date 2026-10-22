import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const mailbox = process.env.MJL_A21_MAILBOX
const container = process.env.MJL_A21_CONTAINER
const password = 'Synthetic!93'
function mail(email, kind) {
  return readdirSync(mailbox)
    .map((f) => path.join(mailbox, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    .map((f) => JSON.parse(readFileSync(f, 'utf8')))
    .find((m) => m.recipient === email && m.kind === kind).value
}
async function accept(page, email) {
  await page.goto(mail(email, 'invitation'))
  await expect(page.getByLabel('Adresse e-mail')).toHaveValue(email)
  await expect(page.getByLabel('Adresse e-mail')).toHaveAttribute(
    'readonly',
    '',
  )
  expect(page.url()).not.toContain('verifier')
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByLabel('Confirmer le mot de passe').fill(password)
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click()
  await expect(
    page.getByRole('heading', { name: 'Connexion à votre espace' }),
  ).toBeVisible()
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Vérifiez votre identité' }),
  ).toBeVisible()
  await page.getByLabel('Code de vérification').fill(mail(email, 'otp'))
  await page.getByRole('button', { name: 'Vérifier le code' }).click()
  await expect(
    page.getByRole('heading', { name: 'Session vérifiée' }),
  ).toBeVisible()
}

test('C12–C14 Admin invitation journey, focus, denials, cache and online-only behavior', async ({
  page,
  context,
  browser,
}) => {
  test.skip(!mailbox || !container, 'Requires isolated A2.1 environment')
  test.setTimeout(120000)
  expect(container).toBe('mjl-a21-test-backend-1')
  expect(mailbox).toMatch(/^\/tmp\/mjl-a1-mail-/)
  execFileSync('docker', [
    'exec',
    container,
    'python',
    '-m',
    'app.auth.bootstrap',
    '--email',
    'admin-browser@example.test',
  ])
  await accept(page, 'admin-browser@example.test')
  await page.getByRole('link', { name: 'Gérer les utilisateurs' }).click()
  await expect(
    page.getByRole('heading', { name: 'Utilisateurs', exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('cell', { name: 'admin-browser@example.test', exact: true })
      .first(),
  ).toBeVisible()
  const invite = page.getByRole('button', { name: 'Inviter un utilisateur' })
  await invite.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').press('Shift+Tab')
  expect(
    await page
      .getByRole('dialog')
      .evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true)
  await page.getByRole('dialog').press('Tab')
  expect(
    await page
      .getByRole('dialog')
      .evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true)
  await page.getByRole('dialog').press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(invite).toBeFocused()
  await invite.click()
  await page
    .getByRole('dialog')
    .getByLabel('Adresse e-mail')
    .fill('agent-browser@example.test')
  await page
    .getByRole('dialog')
    .getByLabel('Rôle')
    .selectOption('AGENT_VERIFICATEUR')
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  let posts = 0
  await page.route('**/api/v1/access/invitations', async (route) => {
    if (route.request().method() === 'POST') {
      posts++
      await gate
    }
    await route.continue()
  })
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  await expect(page.getByRole('status')).toContainText('Traitement en cours')
  // Query's real focus manager revalidates identity without losing the request/form.
  const refreshed = page.waitForResponse((r) =>
    r.url().endsWith('/auth/session'),
  )
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await refreshed
  await expect(page.getByRole('dialog')).toBeAttached()
  release()
  await expect(
    page.getByText('Invitation envoyée.', { exact: true }),
  ).toBeVisible()
  expect(posts).toBe(1)
  await page.unroute('**/api/v1/access/invitations')
  const invitedRow = page
    .getByRole('table', { name: 'Invitations des utilisateurs' })
    .getByRole('row')
    .filter({ hasText: 'agent-browser@example.test' })
  await expect(invitedRow).toContainText('Agent superviseur et prévalidateur')
  await invitedRow.getByRole('button', { name: 'Renvoyer' }).click()
  await page.getByRole('button', { name: 'Confirmer le renvoi' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const recipient = await browser.newContext()
  const recipientPage = await recipient.newPage()
  await accept(recipientPage, 'agent-browser@example.test')
  await expect(
    recipientPage.getByText('Agent superviseur et prévalidateur', {
      exact: true,
    }),
  ).toBeVisible()
  await recipientPage.goto('/access/users')
  await expect(
    recipientPage.getByRole('heading', { name: 'Accès refusé' }),
  ).toBeVisible()
  expect(
    (await recipientPage.request.get('/api/v1/access/users')).status(),
  ).toBe(403)
  await recipient.close()
  await invite.click()
  await page
    .getByRole('dialog')
    .getByLabel('Adresse e-mail')
    .fill('agent-browser@example.test')
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'ce compte existe déjà' }),
  ).toBeVisible()

  await invite.click()
  await page
    .getByRole('dialog')
    .getByLabel('Adresse e-mail')
    .fill('revoke-browser@example.test')
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  const revokeRow = page
    .getByRole('table', { name: 'Invitations des utilisateurs' })
    .getByRole('row')
    .filter({ hasText: 'revoke-browser@example.test' })
  await revokeRow.getByRole('button', { name: 'Révoquer' }).click()
  await page.getByRole('button', { name: 'Confirmer la révocation' }).click()
  await expect(revokeRow).toContainText('Révoquée')
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: '/tmp/mjl-a21-users-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({
    path: '/tmp/mjl-a21-users-desktop.png',
    fullPage: true,
  })

  await page.getByLabel('Rechercher par e-mail').fill('absent@example.test')
  await page.getByRole('button', { name: 'Filtrer', exact: true }).click()
  await expect(page.getByText('Aucun utilisateur.')).toBeVisible()
  await expect(page.getByText('Aucune invitation.')).toBeVisible()
  await page.getByLabel('Rechercher par e-mail').fill('')
  await page.getByRole('button', { name: 'Filtrer', exact: true }).click()
  await expect(revokeRow).toBeVisible()
  await page.route('**/api/v1/access/invitations', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'invitation_delivery_failed' }),
    }),
  )
  await invite.click()
  await page
    .getByRole('dialog')
    .getByLabel('Adresse e-mail')
    .fill('failed-browser@example.test')
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'envoi échoué' }),
  ).toBeVisible()
  await page.unroute('**/api/v1/access/invitations')

  // In-flight transport loss has no success claim and no reconnect replay.
  let mutations = 0
  await page.route('**/api/v1/access/invitations', (route) => {
    mutations++
    return route.abort('connectionreset')
  })
  await invite.click()
  await page
    .getByRole('dialog')
    .getByLabel('Adresse e-mail')
    .fill('lost-browser@example.test')
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Résultat non confirmé' }),
  ).toBeVisible()
  expect(mutations).toBe(1)
  await context.setOffline(true)
  await expect(
    page.getByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Vérifier mon accès' }).click()
  await expect(
    page.getByRole('heading', { name: 'Utilisateurs', exact: true }),
  ).toBeVisible()
  expect(mutations).toBe(1)
  await page.unroute('**/api/v1/access/invitations')
  const cached = await page.evaluate(async () => {
    const urls = []
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        urls.push(request.url)
    return {
      urls,
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }
  })
  expect(cached.urls.some((url) => url.includes('/api/'))).toBe(false)
  expect(cached.local).toEqual([])
  expect(cached.session).toEqual([])

  // Another tab logs out; the Admin page clears all sensitive data immediately.
  const second = await context.newPage()
  await second.goto('/identity')
  await second.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(
    page.getByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  expect((await page.request.get('/api/v1/access/users')).status()).toBe(401)
  await second.close()
  // Move only the synthetic consumed OTP timestamp past its cooldown for this fixture.
  execFileSync('docker', [
    'exec',
    container,
    'python',
    '-c',
    `import os
from sqlalchemy import create_engine,text
e=create_engine(os.environ['DATABASE_URL'])
assert e.url.database=='mjl_test_a21'
with e.begin() as db:
 db.execute(text("UPDATE auth_otp SET sent_at=clock_timestamp()-interval '61 seconds' WHERE user_id=(SELECT id FROM auth_user WHERE email='agent-browser@example.test')"))
e.dispose()`,
  ])
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill('agent-browser@example.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Vérifiez votre identité' }),
  ).toBeVisible()
  await page
    .getByLabel('Code de vérification')
    .fill(mail('agent-browser@example.test', 'otp'))
  await page.getByRole('button', { name: 'Vérifier le code' }).click()
  await expect(
    page.getByText('Agent superviseur et prévalidateur', { exact: true }),
  ).toBeVisible()
  await page.goto('/access/users')
  await expect(
    page.getByRole('heading', { name: 'Accès refusé' }),
  ).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})
