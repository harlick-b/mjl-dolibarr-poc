import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const mailbox = process.env.MJL_A22_MAILBOX
const container = process.env.MJL_A22_CONTAINER
const password = 'Synthetic!93'
const lifecycleEmail = `lifecycle-${Date.now()}@example.test`
function mail(email, kind) {
  return readdirSync(mailbox)
    .map((f) => path.join(mailbox, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    .map((f) => JSON.parse(readFileSync(f, 'utf8')))
    .find((m) => m.recipient === email && m.kind === kind).value
}
function sql(statement) {
  execFileSync('docker', [
    'exec',
    container,
    'python',
    '-c',
    `import os
from sqlalchemy import create_engine,text
e=create_engine(os.environ['DATABASE_URL'])
assert e.url.database=='mjl_test_a22'
with e.begin() as db:
 db.execute(text(${JSON.stringify(statement)}))
e.dispose()`,
  ])
}
async function login(page, email) {
  await page.goto('/login')
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByLabel('Code de vérification')).toBeVisible()
  await page.getByLabel('Code de vérification').fill(mail(email, 'otp'))
  await page.getByRole('button', { name: 'Vérifier le code' }).click()
  await expect(
    page.getByRole('heading', { name: 'Session vérifiée' }),
  ).toBeVisible()
}

test('L13–L14 restricted lifecycle, conflicts, Query refresh and offline non-replay', async ({
  page,
  browser,
  context,
}) => {
  test.skip(!mailbox || !container, 'Requires isolated A2.2 environment')
  test.setTimeout(120000)
  expect(container).toBe('mjl-a22-test-backend-1')
  expect(mailbox).toMatch(/^\/tmp\/mjl-a1-mail-/)
  // access.spec.js established this isolated Admin; only advance consumed OTP cooldown.
  sql(
    "UPDATE auth_otp SET sent_at=clock_timestamp()-interval '61 seconds' WHERE user_id=(SELECT id FROM auth_user WHERE email='admin-browser@example.test') AND state='consumed'",
  )
  await login(page, 'admin-browser@example.test')
  await page.getByRole('link', { name: 'Gérer les utilisateurs' }).click()
  await page.getByRole('button', { name: 'Inviter un utilisateur' }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Adresse e-mail')
    .fill(lifecycleEmail)
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const recipient = await browser.newContext()
  const other = await recipient.newPage()
  await other.goto(mail(lifecycleEmail, 'invitation'))
  await expect(other.getByLabel('Adresse e-mail')).toHaveValue(lifecycleEmail)
  await other.getByLabel('Mot de passe', { exact: true }).fill(password)
  await other.getByLabel('Confirmer le mot de passe').fill(password)
  await other.getByRole('button', { name: 'Définir mon mot de passe' }).click()
  await login(other, lifecycleEmail)
  await page.reload()
  const row = page
    .getByRole('table', { name: 'Comptes utilisateurs' })
    .getByRole('row')
    .filter({ hasText: lifecycleEmail })
  await row.getByRole('button', { name: 'Modifier le rôle' }).click()
  await page.getByRole('dialog').press('Shift+Tab')
  expect(
    await page
      .getByRole('dialog')
      .evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true)
  await page.getByRole('dialog').press('Escape')
  await expect(
    row.getByRole('button', { name: 'Modifier le rôle' }),
  ).toBeFocused()
  await row.getByRole('button', { name: 'Modifier le rôle' }).click()
  await page.getByRole('button', { name: 'Confirmer le rôle' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Rôle inchangé.' }),
  ).toBeVisible()
  await other.reload()
  await expect(
    other.getByRole('heading', { name: 'Session vérifiée' }),
  ).toBeVisible()
  await row.getByRole('button', { name: 'Modifier le rôle' }).click()
  await page.getByLabel('Nouveau rôle').selectOption('VALIDATEUR_DEFINITIF')
  await page.getByRole('button', { name: 'Confirmer le rôle' }).click()
  await expect(row).toContainText('Validateur définitif')
  await expect(page.getByRole('status')).toContainText('Rôle modifié')
  const invitationRow = page
    .getByRole('table', { name: 'Invitations des utilisateurs' })
    .getByRole('row')
    .filter({ hasText: lifecycleEmail })
  await expect(invitationRow).toContainText('Validateur définitif')
  const revoked = other.waitForResponse((r) =>
    r.url().endsWith('/auth/session'),
  )
  await other.reload()
  expect((await revoked).status()).toBe(401)
  await expect(
    other.getByRole('heading', { name: 'Session indisponible' }),
  ).toBeVisible()
  await other.getByRole('button', { name: 'Réessayer' }).click()
  await other.getByRole('link', { name: 'Continuer la connexion' }).click()
  await expect(
    other.getByRole('heading', { name: 'Connexion à votre espace' }),
  ).toBeVisible()

  sql(
    `UPDATE auth_otp SET sent_at=clock_timestamp()-interval '61 seconds' WHERE user_id=(SELECT id FROM auth_user WHERE email='${lifecycleEmail}') AND state='consumed'`,
  )
  await login(other, lifecycleEmail)
  await expect(
    other.getByText('Validateur définitif', { exact: true }),
  ).toBeVisible()

  // A stale open dialog must refetch on 409, not retry its version automatically.
  await row.getByRole('button', { name: 'Modifier le rôle' }).click()
  sql(`UPDATE auth_user SET version=version+1 WHERE email='${lifecycleEmail}'`)
  await page.getByLabel('Nouveau rôle').selectOption('AGENT_VERIFICATEUR')
  await page.getByRole('button', { name: 'Confirmer le rôle' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'L’état a changé' }),
  ).toBeVisible()
  await expect(row).toContainText('Validateur définitif')

  // A real unknown schema makes the backend fail closed, then restores clean fixture.
  sql('CREATE TABLE public.unverified_obligation (id integer)')
  try {
    await row.getByRole('button', { name: 'Désactiver', exact: true }).click()
    await page
      .getByRole('button', { name: 'Confirmer la désactivation' })
      .click()
    await expect(
      page.getByRole('status').filter({ hasText: 'éligibilité' }),
    ).toBeVisible()
    await expect(row).toContainText('Actif')
  } finally {
    sql('DROP TABLE public.unverified_obligation')
  }

  await page.setViewportSize({ width: 375, height: 812 })
  await row.getByRole('button', { name: 'Désactiver', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-a22-mobile.png', fullPage: true })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  let patches = 0
  page.on('request', (request) => {
    if (request.method() === 'PATCH') patches++
  })
  await context.setOffline(true)
  await expect(
    page.getByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Vérifier mon accès' }).click()
  await expect(row).toContainText('Actif')
  expect(patches).toBe(0)
  // Unknown outcome: no automatic replay; authoritative reload reveals actual state.
  await page.route('**/api/v1/access/users/*', async (route) => {
    if (route.request().method() === 'PATCH') await route.abort('failed')
    else await route.continue()
  })
  await row.getByRole('button', { name: 'Désactiver', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmer la désactivation' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Résultat non confirmé' }),
  ).toBeVisible()
  await expect(row).toContainText('Actif')
  expect(patches).toBe(1)
  await page.unroute('**/api/v1/access/users/*')
  await row.getByRole('button', { name: 'Désactiver', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmer la désactivation' }).click()
  await expect(row).toContainText('Inactif')
  await expect(row.getByRole('button')).toHaveCount(0)
  expect(patches).toBe(2)
  const deactivated = other.waitForResponse((r) =>
    r.url().endsWith('/auth/session'),
  )
  await other.reload()
  expect((await deactivated).status()).toBe(401)
  await expect(
    other.getByRole('heading', { name: 'Session vérifiée' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /réactiver|réinviter/i }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 })
  await recipient.close()
})
