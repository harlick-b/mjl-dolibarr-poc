import { expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'

export const connectedPlanning = {
  mailbox: process.env.MJL_CONNECTED_PLANNING_MAILBOX,
  container: process.env.MJL_CONNECTED_PLANNING_CONTAINER,
  database: process.env.MJL_CONNECTED_PLANNING_DATABASE,
  required: process.env.MJL_REQUIRE_CONNECTED_PLANNING === '1',
}

export function checkConnectedPlanningEnvironment() {
  const { mailbox, container, database, required } = connectedPlanning
  const missing = Object.entries({ mailbox, container, database })
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (required && missing.length)
    throw new Error(
      `Connected planning journey is required; missing ${missing.join(', ')}`,
    )
  if (missing.length) return false
  expect(container).toMatch(/^mjl-[a-z0-9-]+-backend-1$/)
  expect(database).toMatch(/^mjl_test_[a-z0-9_]+$/)
  expect(mailbox).toMatch(/^\/tmp\/mjl-a1-mail-[a-z0-9-]+$/)
  return true
}

export function inBackend(...args) {
  return execFileSync(
    'docker',
    ['exec', connectedPlanning.container, ...args],
    {
      encoding: 'utf8',
      timeout: 15000,
    },
  ).trim()
}

export function preparePlanningContext() {
  inBackend(
    'python',
    '-c',
    `import os,sys
from app.auth.policy import load_policy
from app.core.config import database_url
url=database_url()
policy=load_policy(url)
assert os.environ.get('MJL_AUTH_MODE') == 'synthetic'
assert os.environ.get('MJL_ENVIRONMENT') == 'isolated-test'
assert url.database == sys.argv[1]
assert policy.fixture == 'a1-synthetic-v1'
assert policy.lifecycle_database == sys.argv[1]
assert str(policy.mailbox) == sys.argv[2]
assert policy.planning_lifecycle_fixture == 'SYNTHETIC_EXECUTION_TEST_ONLY'`,
    connectedPlanning.database,
    connectedPlanning.mailbox,
  )
  inBackend(
    'python',
    '-m',
    'app.planning.core.provision',
    '--reason',
    'Connected Activity submission journey',
  )
  inBackend(
    'python',
    '-m',
    'app.auth.bootstrap',
    '--email',
    'submission-admin@example.test',
    '--name',
    'Admin submission',
  )
}

export function clearSharedIpBucket() {
  inBackend(
    'python',
    '-c',
    `import os,sys
from sqlalchemy import create_engine,text
e=create_engine(os.environ['DATABASE_URL'])
assert e.url.database == sys.argv[1]
with e.begin() as db: db.execute(text("DELETE FROM auth_abuse"))
e.dispose()`,
    connectedPlanning.database,
  )
}

function mail(email, kind) {
  return (
    inBackend(
      'python',
      '-c',
      `import json,sys
from pathlib import Path
box=Path(sys.argv[1])
items=[]
for item in box.glob('*.json'):
    message=json.loads(item.read_text())
    if message.get('recipient') == sys.argv[2] and message.get('kind') == sys.argv[3]:
        items.append((item.stat().st_mtime_ns,message.get('value','')))
print(max(items,default=(0,''))[1])`,
      connectedPlanning.mailbox,
      email,
      kind,
    ) || undefined
  )
}

async function waitForMail(email, kind) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = mail(email, kind)
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Missing synthetic ${kind} for ${email}`)
}

export async function acceptInvitation(page, email) {
  clearSharedIpBucket()
  await page.goto(await waitForMail(email, 'invitation'))
  const password = page.getByLabel(/^Nouveau mot de passe/)
  await expect(password).toBeVisible({ timeout: 10000 })
  await password.fill('Synthetic!93')
  await page.getByLabel(/^Confirmer le mot de passe/).fill('Synthetic!93')
  await page
    .getByRole('button', { name: 'Enregistrer le mot de passe' })
    .click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Adresse e-mail').fill(email)
  const loginPassword = page.getByLabel(/^Mot de passe/)
  await expect(loginPassword).toBeVisible({ timeout: 10000 })
  await loginPassword.fill('Synthetic!93')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await page
    .getByLabel(/^Code de vérification/)
    .fill(await waitForMail(email, 'otp'))
  await expect(page).toHaveURL(
    /\/(access\/users|dashboard|projects|partner)(\?|$)/,
  )
}

export async function api(page, route, method = 'GET', body) {
  return page.evaluate(
    async ({ route, method, body }) => {
      const session = await fetch('/api/v1/auth/session', {
        cache: 'no-store',
      }).then((response) => response.json())
      const response = await fetch(`/api/v1${route}`, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: body
          ? { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf }
          : {},
        body: body ? JSON.stringify(body) : undefined,
      })
      return { status: response.status, body: await response.json() }
    },
    { route, method, body },
  )
}
