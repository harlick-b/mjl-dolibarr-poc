import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import path from 'node:path'

const mailbox = process.env.MJL_A3_MAILBOX
const container = process.env.MJL_A3_CONTAINER
const email = 'recovery-browser@example.test'
const oldPassword = 'Synthetic!93'
const newPassword = 'Recovered!94'

function message(kind) {
  const files = readdirSync(mailbox)
    .map((file) => path.join(mailbox, file))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
  return files
    .map((file) => JSON.parse(readFileSync(file, 'utf8')))
    .find((mail) => mail.kind === kind)?.value
}

function seedOrdinary() {
  for (const file of readdirSync(mailbox)) unlinkSync(path.join(mailbox, file))
  execFileSync(
    'docker',
    [
      'exec',
      container,
      'python',
      '-c',
      `from argon2 import PasswordHasher\nfrom app.config import database_url\nfrom app.database import make_engine\nfrom sqlalchemy import text\nfrom uuid import uuid4\nengine=make_engine(database_url())\nwith engine.begin() as db:\n db.execute(text("TRUNCATE auth_recovery,auth_otp,auth_context,auth_invitation,auth_audit,auth_abuse,auth_user RESTART IDENTITY CASCADE"))\n db.execute(text("INSERT INTO auth_user(id,email,role,state,password_hash,version) VALUES (:id,:email,'AGENT_SAISIE','active',:password,1)"), {'id':str(uuid4()),'email':'${email}','password':PasswordHasher().hash('${oldPassword}')})`,
    ],
    { encoding: 'utf8' },
  )
}

test('A3 ordinary recovery scrubs proof, resets password and requires fresh OTP', async ({
  page,
}) => {
  test.skip(!mailbox || !container, 'Requires the isolated A3 test environment')
  test.setTimeout(90000)
  expect(container).toBe('mjl-a3-test-backend-1')
  expect(mailbox).toMatch(/^\/tmp\/mjl-a1-mail-a3-/)
  seedOrdinary()

  await page.goto('/forgot-password')
  await expect(
    page.getByRole('heading', { name: 'Récupérer votre accès' }),
  ).toBeVisible()
  await page.getByLabel('Adresse e-mail').fill(email)
  await page
    .getByRole('button', { name: 'Envoyer le lien de récupération' })
    .click()
  await expect(
    page.getByText('Si ce compte peut être récupéré, vous recevrez un lien.'),
  ).toBeVisible()

  await expect
    .poll(() => message('password_recovery'), { timeout: 5000 })
    .toContain('/reset-password#')
  await page.context().addCookies([
    {
      name: 'mjl_local',
      value: 'expired-session-evidence',
      url: 'http://127.0.0.1:4173',
    },
  ])
  await page.goto(message('password_recovery'))
  await expect(page).toHaveURL(/\/reset-password$/)
  await expect(page.getByLabel('Adresse e-mail')).toHaveValue(email)
  await page.getByLabel('Nouveau mot de passe').fill(newPassword)
  const confirmation = page.getByLabel('Confirmer le mot de passe')
  const submit = page.getByRole('button', {
    name: 'Réinitialiser le mot de passe',
  })
  await confirmation.fill('Different!95')
  await expect(
    page.getByText('Les mots de passe ne correspondent pas.'),
  ).toBeVisible()
  await expect(submit).toBeDisabled()
  await confirmation.fill(newPassword)
  await confirmation.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Afficher le mot de passe' }).last(),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(submit).toBeFocused()
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await submit.click()
  await expect(
    page.getByText('Votre mot de passe a été réinitialisé.'),
  ).toBeVisible()
  expect(message('password_reset_notice')).not.toContain('verifier=')

  await page.getByRole('link', { name: 'Retour à la connexion' }).click()
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(oldPassword)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Vérification refusée')
  await page.getByRole('button', { name: 'Vérifier ma session' }).click()
  await expect(
    page.getByRole('heading', { name: 'Connexion à votre espace' }),
  ).toBeVisible()
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByLabel('Code de vérification')).toBeVisible()
  await page.getByLabel('Code de vérification').fill(message('otp'))
  await page.getByRole('button', { name: 'Vérifier le code' }).click()
  await expect(
    page.getByRole('heading', { name: 'Session vérifiée' }),
  ).toBeVisible()
})

test('A3 recovery stays online-only without reconnect replay', async ({
  page,
  context,
}) => {
  test.skip(!mailbox || !container, 'Requires the isolated A3 test environment')
  await page.goto('/forgot-password')
  let posts = 0
  page.on('request', (request) => {
    if (request.method() === 'POST') posts += 1
  })
  await context.setOffline(true)
  await expect(
    page.getByRole('heading', { name: 'Connexion indisponible' }),
  ).toBeVisible()
  await context.setOffline(false)
  await expect(
    page.getByRole('heading', { name: 'Session à vérifier' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Vérifier ma session' }).click()
  await expect(
    page.getByRole('heading', { name: 'Récupérer votre accès' }),
  ).toBeVisible()
  expect(posts).toBe(0)
})

test('A3 invalid recovery link is scrubbed and keyboard reachable', async ({
  page,
}) => {
  await page.goto('/reset-password#selector=unknown&verifier=unknown')
  await expect(page).toHaveURL(/\/reset-password$/)
  await expect(page.getByRole('alert')).toContainText(
    'Ce lien est invalide ou a expiré.',
  )
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Demander un nouveau lien' }),
  ).toBeFocused()
})
