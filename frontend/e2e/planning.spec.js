import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const mailbox = process.env.MJL_PTA2A_MAILBOX || process.env.MJL_PTA1_MAILBOX
const container =
  process.env.MJL_PTA2A_CONTAINER || process.env.MJL_PTA1_CONTAINER
const password = 'Synthetic!93'

function mail(email, kind) {
  if (process.env.MJL_PTA2A_CONTAINER) {
    const value = execFileSync(
      'docker',
      [
        'exec',
        container,
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
        mailbox,
        email,
        kind,
      ],
      { encoding: 'utf8' },
    ).trim()
    return value || undefined
  }
  return readdirSync(mailbox)
    .map((file) => path.join(mailbox, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    .map((file) => JSON.parse(readFileSync(file, 'utf8')))
    .find((message) => message.recipient === email && message.kind === kind)
    ?.value
}

function clearSharedIpBucket() {
  execFileSync('docker', [
    'exec',
    container,
    'python',
    '-c',
    `import os
from sqlalchemy import create_engine,text
e=create_engine(os.environ['DATABASE_URL'])
assert e.url.database == 'mjl_test_pta2a'
with e.begin() as db: db.execute(text("DELETE FROM auth_abuse"))
e.dispose()`,
  ])
}

async function waitForMail(email, kind) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = mail(email, kind)
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Missing synthetic ${kind} for ${email}`)
}

async function accept(page, email) {
  clearSharedIpBucket()
  await page.goto(await waitForMail(email, 'invitation'))
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByLabel('Confirmer le mot de passe').fill(password)
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await page
    .getByLabel('Code de vérification')
    .fill(await waitForMail(email, 'otp'))
  await page.getByRole('button', { name: 'Vérifier le code' }).click()
  await expect(
    page.getByRole('heading', { name: 'Session vérifiée' }),
  ).toBeVisible()
}

async function api(page, route, method = 'GET', body) {
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

test('V19 planning, correction and final approval browser journey', async ({
  page,
  browser,
}) => {
  test.skip(!mailbox || !container, 'Requires isolated PTA-1 environment')
  test.setTimeout(180000)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(container).toBe('mjl-pta2a-test-backend-1')
  expect(mailbox).toMatch(/^\/tmp\/mjl-a1-mail-/)
  execFileSync('docker', [
    'exec',
    container,
    'python',
    '-m',
    'app.planning.provision',
    '--reason',
    'PTA-1 Playwright journey',
  ])
  execFileSync('docker', [
    'exec',
    container,
    'python',
    '-m',
    'app.auth.bootstrap',
    '--email',
    'pta-admin@example.test',
  ])
  await accept(page, 'pta-admin@example.test')
  for (const [email, role] of [
    ['pta-validator@example.test', 'VALIDATEUR_DEFINITIF'],
    ['pta-agent@example.test', 'AGENT_SAISIE'],
    ['pta-supervisor@example.test', 'AGENT_VERIFICATEUR'],
  ]) {
    const result = await api(page, '/access/invitations', 'POST', {
      email,
      role,
    })
    expect(result.status).toBe(201)
  }

  const validatorContext = await browser.newContext()
  const validator = await validatorContext.newPage()
  await accept(validator, 'pta-validator@example.test')

  const loadingPage = await validatorContext.newPage()
  let releaseLoading
  let reportLoading
  const loadingStarted = new Promise((resolve) => {
    reportLoading = resolve
  })
  const loadingRelease = new Promise((resolve) => {
    releaseLoading = resolve
  })
  await loadingPage.route('**/api/v1/partners*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    reportLoading()
    await loadingRelease
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        object: 'list',
        count: 0,
        data: [],
        next: null,
        previous: null,
      }),
    })
  })
  const loadingNavigation = loadingPage.goto(
    '/partners?partnerCursor=loading-oracle',
  )
  await loadingStarted
  await expect(loadingPage.locator('section.planning-stack')).toHaveAttribute(
    'aria-busy',
    'true',
  )
  await expect(loadingPage.getByText('Partenaire navigateur')).toHaveCount(0)
  releaseLoading()
  await loadingNavigation
  await expect(loadingPage.getByText('Aucun élément.').first()).toBeVisible()
  await loadingPage.close()

  await validator.goto('/partners')
  await expect(
    validator.getByRole('heading', { name: 'Partenaires', level: 1 }),
  ).toBeVisible()
  const partnerCard = validator
    .getByRole('heading', { name: 'Partenaires', level: 2 })
    .locator('..')
    .locator('..')
  const partnerOpener = partnerCard.getByRole('button', { name: 'Ajouter' })
  await partnerOpener.click()
  await validator.keyboard.press('Escape')
  await expect(partnerCard.getByRole('dialog')).toBeHidden()
  await expect(partnerOpener).toBeFocused()
  await partnerOpener.click()
  const partnerDialog = partnerCard.getByRole('dialog')
  await partnerDialog.getByLabel('Nom').fill('Partenaire navigateur')
  await partnerDialog.getByRole('button', { name: 'Ajouter' }).click()
  await expect(partnerCard.getByText('Partenaire navigateur')).toBeVisible()
  const typeCard = validator
    .getByRole('heading', { name: 'Types d’opération' })
    .locator('..')
    .locator('..')
  await typeCard.getByRole('button', { name: 'Ajouter' }).click()
  const typeDialog = typeCard.getByRole('dialog')
  await typeDialog.getByLabel('Libellé').fill('Atelier')
  await typeDialog.getByRole('button', { name: 'Ajouter' }).click()
  await expect(typeCard.getByText('Atelier')).toBeVisible()
  await validator.goto('/projects')
  await validator.getByRole('button', { name: 'Créer' }).click()
  const projectDialog = validator.getByRole('dialog')
  await projectDialog
    .getByLabel('Partenaire')
    .selectOption({ label: 'Partenaire navigateur' })
  await projectDialog.getByLabel('Nom').fill('Projet navigateur')
  await projectDialog.getByRole('button', { name: 'Créer' }).click()
  await expect(validator.getByText('Projet navigateur')).toBeVisible()
  const project = (await api(validator, '/projects')).body.data[0]

  const errorPage = await validatorContext.newPage()
  await errorPage.route('**/api/v1/projects*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'service_unavailable' }),
    })
  })
  await errorPage.goto('/projects?projectCursor=error-oracle')
  await expect(errorPage.getByRole('alert')).toHaveText(
    'Les données de planification sont indisponibles.',
  )
  await expect(errorPage.getByText('Projet navigateur')).toHaveCount(0)
  await errorPage.close()

  const agentContext = await browser.newContext()
  const agent = await agentContext.newPage()
  await accept(agent, 'pta-agent@example.test')
  await agent.goto(`/projects/${project.id}/ptas/2027`)
  await agent.getByRole('link', { name: 'Nouvelle activité' }).click()
  await agent.getByLabel('Nom', { exact: true }).fill('Activité navigateur')
  await agent
    .getByLabel('Description')
    .fill('Planification synthétique complète')
  await agent.getByLabel('Début').fill('2027-11-30')
  await expect(agent.getByLabel('Fin')).toHaveValue('2028-02-29')
  await agent
    .getByLabel('Type d’opération 1')
    .selectOption({ label: 'Atelier' })
  await agent.getByLabel('Nom de l’opération 1').fill('Préparer l’atelier')
  await agent.getByLabel('Budget de l’opération 1').fill('300000')
  await agent.getByRole('button', { name: 'Ajouter une opération' }).click()
  await expect(agent.getByLabel('Nom de l’opération 2')).toBeVisible()
  await agent.getByRole('button', { name: 'Retirer l’opération 2' }).click()
  await expect(agent.getByLabel('Nom de l’opération 2')).toHaveCount(0)
  let firstRequestKey
  let lostResponse = false
  await agent.route('**/api/v1/projects/*/ptas/*/activities', async (route) => {
    if (route.request().method() !== 'POST' || lostResponse)
      return route.continue()
    firstRequestKey = route.request().postDataJSON().request_key
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    lostResponse = true
    await route.abort('connectionreset')
  })
  await agent.getByRole('button', { name: 'Enregistrer' }).click()
  await expect.poll(() => lostResponse).toBe(true)
  await agent.route('**/api/v1/projects/*/ptas/*/activities', async (route) => {
    if (route.request().method() === 'POST')
      expect(route.request().postDataJSON().request_key).toBe(firstRequestKey)
    await route.continue()
  })
  await agent.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(
    agent.getByRole('heading', { name: 'Activité navigateur' }),
  ).toBeVisible()
  await expect(agent.getByText(/300[\s\u202f]?000 XOF/).first()).toBeVisible()
  await expect(
    agent.getByRole('heading', { name: 'Historique des révisions' }),
  ).toBeVisible()
  await expect(agent.getByText('Aucune révision soumise.')).toBeVisible()
  const activity = (
    await api(
      agent,
      `/ptas/${(await api(agent, `/projects/${project.id}/ptas/2027`)).body.pta.id}/activities`,
    )
  ).body.data[0]
  expect(
    (
      await api(
        agent,
        `/ptas/${(await api(agent, `/projects/${project.id}/ptas/2027`)).body.pta.id}/activities`,
      )
    ).body.count,
  ).toBe(1)
  const planningPaths = [
    '/partners',
    '/operation-types',
    '/projects',
    `/projects/${project.id}`,
    `/projects/${project.id}/ptas`,
    `/projects/${project.id}/ptas/2027`,
    `/ptas/${activity.pta_id}/activities`,
    `/activities/${activity.id}`,
    '/assignment-agents',
  ]
  // The synthetic browser identities share loopback. Reset only this owned
  // test database's shared-IP bucket before the complete denial matrix.
  execFileSync('docker', [
    'exec',
    container,
    'python',
    '-c',
    `import os
from sqlalchemy import create_engine,text
e=create_engine(os.environ['DATABASE_URL'])
assert e.url.database == 'mjl_test_pta2a'
with e.begin() as db: db.execute(text("DELETE FROM auth_abuse"))
e.dispose()`,
  ])
  const anonymousContext = await browser.newContext()
  const anonymous = await anonymousContext.newPage()
  await anonymous.goto('/')
  for (const route of planningPaths)
    expect((await api(anonymous, route)).status).toBe(401)
  for (const route of planningPaths)
    expect((await api(page, route)).status).toBe(403)
  await anonymousContext.close()

  const supervisorContext = await browser.newContext()
  const supervisor = await supervisorContext.newPage()
  await accept(supervisor, 'pta-supervisor@example.test')
  // Synthetic identities share loopback. Clear only the isolated shared-IP
  // bucket before loading the final role's business requests.
  execFileSync('docker', [
    'exec',
    container,
    'python',
    '-c',
    `import os
from sqlalchemy import create_engine,text
e=create_engine(os.environ['DATABASE_URL'])
assert e.url.database == 'mjl_test_pta2a'
with e.begin() as db: db.execute(text("DELETE FROM auth_abuse"))
e.dispose()`,
  ])
  await supervisor.goto(`/activities/${activity.id}`)
  await supervisor.getByLabel('pta-agent@example.test').check()
  await supervisor
    .getByRole('button', { name: 'Enregistrer les agents' })
    .click()
  await expect(
    supervisor.getByText('Modifications enregistrées.'),
  ).toBeVisible()
  // The four synthetic identities share loopback. Clear only that test-only
  // shared-IP bucket before the final direct verification.
  execFileSync('docker', [
    'exec',
    container,
    'python',
    '-c',
    `import os
from sqlalchemy import create_engine,text
e=create_engine(os.environ['DATABASE_URL'])
assert e.url.database == 'mjl_test_pta2a'
with e.begin() as db: db.execute(text("DELETE FROM auth_abuse"))
e.dispose()`,
  ])
  expect(
    (await api(agent, `/activities/${activity.id}`)).body.agent_ids,
  ).toHaveLength(1)

  let writes = 0
  await agent.route('**/api/v1/activities/*', (route) => {
    if (route.request().method() === 'PATCH') writes += 1
    return route.continue()
  })
  await agent.getByRole('button', { name: 'Modifier' }).click()
  await agent.evaluate(() =>
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    }),
  )
  await agent.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(agent.getByRole('alert')).toBeVisible()
  expect(writes).toBe(0)
  await agent.evaluate(() =>
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    }),
  )
  await agentContext.setOffline(true)
  await expect(
    agent.getByRole('heading', { name: 'Accès à vérifier' }),
  ).toBeVisible()
  await agentContext.setOffline(false)
  expect(writes).toBe(0)
  const cached = await agent.evaluate(async () => {
    const urls = []
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        urls.push(request.url)
    return urls
  })
  expect(cached.some((url) => url.includes('/api/'))).toBe(false)

  clearSharedIpBucket()
  await agent.goto(`/activities/${activity.id}`)
  await agent
    .getByRole('button', { name: 'Soumettre pour prévalidation' })
    .click()
  await agent
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer' })
    .click()
  await expect(agent.getByLabel('Progression de la validation')).toContainText(
    'Soumise pour prévalidation',
  )

  await supervisor.goto(`/activities/${activity.id}`)
  await supervisor
    .getByRole('button', { name: 'Demander une correction' })
    .click()
  await supervisor
    .getByRole('dialog')
    .getByLabel('Motif de correction')
    .fill('Préciser le résultat attendu.')
  await supervisor
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer' })
    .click()
  await expect(
    supervisor.getByLabel('Progression de la validation'),
  ).toContainText('Correction demandée par le Superviseur')

  await agent.goto(`/activities/${activity.id}`)
  await agent.getByRole('button', { name: 'Modifier' }).click()
  await agent
    .getByLabel('Description')
    .fill('Planification corrigée après retour du Superviseur')
  await agent.getByRole('button', { name: 'Enregistrer' }).click()
  await agent
    .getByRole('button', { name: 'Soumettre pour prévalidation' })
    .click()
  await agent
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer' })
    .click()

  clearSharedIpBucket()
  await supervisor.goto(`/activities/${activity.id}`)
  await supervisor.getByRole('button', { name: 'Prévalider' }).click()
  await supervisor
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer' })
    .click()
  await expect(
    supervisor.getByLabel('Progression de la validation'),
  ).toContainText('Prévalidée — validation définitive attendue')

  await validator.goto(`/activities/${activity.id}`)
  await validator
    .getByRole('button', { name: 'Demander une correction' })
    .click()
  const validatorReturn = validator.getByRole('dialog')
  await validatorReturn
    .getByLabel('Motif de correction')
    .fill('Ajuster le budget proposé.')
  await validatorReturn
    .getByLabel('Montant indicatif demandé (facultatif)')
    .fill('350000')
  await validatorReturn.getByRole('button', { name: 'Confirmer' }).click()
  await expect(
    validator.getByLabel('Progression de la validation'),
  ).toContainText('Correction demandée par le Validateur définitif')

  await agent.goto(`/activities/${activity.id}`)
  await expect(agent.getByText(/350[\s\u202f]?000 XOF/)).toBeVisible()
  await agent.getByRole('button', { name: 'Modifier' }).click()
  await agent.getByLabel('Budget de l’opération 1').fill('360000')
  await agent.getByLabel('Description').fill('Budget final révisé')
  await agent.getByRole('button', { name: 'Enregistrer' }).click()
  await agent
    .getByRole('button', { name: 'Soumettre pour prévalidation' })
    .click()
  await agent
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer' })
    .click()

  clearSharedIpBucket()
  await supervisor.goto(`/activities/${activity.id}`)
  await supervisor.getByRole('button', { name: 'Prévalider' }).click()
  await supervisor
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer' })
    .click()
  await expect(
    supervisor.getByLabel('Progression de la validation'),
  ).toContainText('Prévalidée — validation définitive attendue')
  clearSharedIpBucket()
  await validator.goto(`/activities/${activity.id}`)
  await validator
    .getByRole('button', { name: 'Valider définitivement' })
    .click()
  await validator
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirmer' })
    .click()
  await expect(
    validator.getByLabel('Progression de la validation'),
  ).toContainText('Validée définitivement')
  await expect(
    validator
      .getByText('Budget approuvé')
      .locator('..')
      .getByText(/360[\s\u202f]?000 XOF/),
  ).toBeVisible()
  await expect(
    validator.getByRole('heading', { name: 'Historique des révisions' }),
  ).toBeVisible()
  await expect(
    validator.getByRole('button', { name: /Révision 3/ }),
  ).toBeVisible()
  await validator.getByRole('button', { name: /Révision 1/ }).click()
  const frozenRevision = validator
    .getByRole('heading', { name: 'Révision 1' })
    .locator('..')
  await expect(frozenRevision).toContainText('Partenaire navigateur')
  await expect(frozenRevision).toContainText('Projet navigateur')
  await expect(frozenRevision).toContainText('Atelier — Préparer l’atelier')
  await expect(frozenRevision).toContainText('pta-agent@example.test')
  await expect(frozenRevision).toContainText('Préciser le résultat attendu.')

  const historyError = await validatorContext.newPage()
  await historyError.route(
    `**/api/v1/activities/${activity.id}/revisions*`,
    async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'service_unavailable' }),
      })
    },
  )
  await historyError.goto(`/activities/${activity.id}?revisionCursor=failure`)
  await expect(historyError.getByRole('alert')).toHaveText(
    'Les données de planification sont indisponibles.',
  )
  await expect(historyError.getByText('Aucune révision soumise.')).toHaveCount(
    0,
  )
  await historyError.close()
  await supervisorContext.close()
  await agentContext.close()
  await validatorContext.close()
})
