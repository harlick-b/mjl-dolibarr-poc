import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

const activity = {
  id: 'state-activity',
  project_id: 'project-1',
  pta_id: 'pta-1',
  reference: 'ACT-1',
  name: 'Atelier synthétique',
  description: 'Description',
  state: 'draft',
  version: 1,
  placement_year: 2027,
  planned_start: '2027-01-01',
  planned_end: '2027-04-01',
  allocation: '100',
  current_revision_id: null,
  approved_revision_id: null,
  approved_allocation: null,
  approved: null,
  candidate: null,
  amendment: null,
  withdrawal: null,
  transfer: null,
  execution_paused: false,
  correction: null,
  agent_ids: ['user-1'],
  tasks: [
    {
      id: 'operation-1',
      type_id: 'type-1',
      type_label: 'Atelier',
      name: 'Préparer',
      description: '',
      allocation: '100',
      weight: '100.00',
      planned_start: '2027-01-01',
      planned_end: '2027-04-01',
      position: 1,
      subtasks: [],
    },
  ],
  closure: null,
  agents: [
    {
      id: 'user-1',
      email: 'person@example.test',
      full_name: 'Personne synthétique',
    },
  ],
  creator: {
    id: 'user-1',
    email: 'person@example.test',
    full_name: 'Personne synthétique',
  },
  current_revision_number: null,
  current_submitter: null,
  latest_decision_actor: null,
  project_name: 'Projet synthétique',
  partner_name: 'Partenaire synthétique',
  pta_name: 'PTA synthétique',
  allowed_actions: ['read', 'edit', 'submit'],
}
const empty = { object: 'list', count: 0, data: [], next: null, previous: null }

async function fixture(
  page,
  override = async () => false,
  role = 'AGENT_SAISIE',
  strict = false,
) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (await override(route, url)) return
    const method = route.request().method()
    let body = empty
    if (method === 'GET' && url.pathname === '/api/v1/auth/session')
      body = {
        state: 'verified',
        csrf: 'synthetic',
        user: {
          id: 'user-1',
          email: 'person@example.test',
          role,
          partner_id: role === 'PARTENAIRE' ? 'partner-1' : undefined,
        },
        expires_at: new Date(Date.now() + 600000).toISOString(),
      }
    else if (
      method === 'GET' &&
      url.pathname === '/api/v1/activities/state-activity'
    )
      body = activity
    else if (method === 'GET' && url.pathname === '/api/v1/task-categories')
      body = {
        ...empty,
        count: 1,
        data: [
          {
            id: 'type-1',
            label: 'Atelier',
            description: null,
            active: true,
            allowed_actions: ['read', 'create'],
          },
        ],
      }
    else if (method === 'GET' && url.pathname === '/api/v1/notifications')
      body = empty
    else if (
      method === 'GET' &&
      url.pathname === '/api/v1/partner-portal/profile'
    )
      body = { id: 'partner-1', name: 'Partenaire synthétique' }
    else if (strict)
      throw new Error(`Unexpected API request: ${method} ${url.pathname}`)
    await route.fulfill({ json: body })
  })
}

test('uncertain upload from an older page can be reconciled inside the native dialog', async ({
  page,
}) => {
  let uploads = 0
  let readsAfterUpload = 0
  const existingDocument = {
    id: 'doc-existing',
    activity_id: 'state-activity',
    name: 'preuve.png',
    media_type: 'image/png',
    size: 3,
    uploaded_by_id: 'user-1',
    uploaded_at: '2027-01-01T00:00:00Z',
    withdrawal: null,
    partner_shared: false,
    sharing_version: 1,
    allowed_actions: [],
  }
  await fixture(
    page,
    async (route, url) => {
      if (url.pathname !== '/api/v1/activities/state-activity/documents')
        return false
      const method = route.request().method()
      if (method === 'POST') {
        uploads++
        await route.abort('failed')
      } else if (method === 'GET' && uploads) {
        expect(url.searchParams.has('cursor')).toBe(false)
        readsAfterUpload++
        if (readsAfterUpload === 1)
          await route.fulfill({
            status: 503,
            json: { code: 'service_unavailable' },
          })
        else
          await route.fulfill({
            json: {
              ...empty,
              count: 2,
              data: [
                existingDocument,
                {
                  ...existingDocument,
                  id: 'doc-1',
                },
              ],
            },
          })
      } else if (method === 'GET')
        await route.fulfill({
          json: { ...empty, count: 1, data: [existingDocument] },
        })
      else throw new Error(`Unexpected document request: ${method}`)
      return true
    },
    'AGENT_SAISIE',
    true,
  )
  await page.goto('/activities/state-activity?documentCursor=older')
  await page.getByRole('link', { name: 'Pièces justificatives' }).click()
  await page.getByRole('button', { name: 'Ajouter une pièce' }).click()
  await expect(page).not.toHaveURL(/documentCursor=older/)
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' })
  await dialog.getByLabel('Choisir un fichier PDF, JPEG ou PNG').setInputFiles({
    name: 'preuve.png',
    mimeType: 'image/png',
    buffer: Buffer.from('png'),
  })
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: 'Ajouter', exact: true }),
  ).toBeDisabled()
  await dialog
    .getByRole('button', { name: 'Vérifier les pièces jointes' })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Aperçu de preuve.png' }),
  ).toHaveCount(2)
  expect(uploads).toBe(1)
})

test('Partner access is verified again after a temporary offline interruption', async ({
  page,
  context,
}) => {
  await fixture(page, undefined, 'PARTENAIRE')
  await page.goto('/partner')
  await expect(page.getByText('Bonjour, Partenaire synthétique')).toBeVisible()
  await context.setOffline(true)
  await expect(
    page.getByText('Bonjour, Partenaire synthétique'),
  ).not.toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('Bonjour, Partenaire synthétique')).toBeVisible()
})

test('a waiting application update replaces an unsaved screen and opens login', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  let signedOut = false
  await fixture(
    page,
    async (route, url) => {
      const method = route.request().method()
      if (method === 'POST' && url.pathname === '/api/v1/auth/logout') {
        signedOut = true
        await route.fulfill({ status: 204 })
        return true
      }
      if (
        signedOut &&
        method === 'GET' &&
        url.pathname === '/api/v1/auth/session'
      ) {
        await route.fulfill({
          json: { state: 'anonymous', csrf: 'fresh-after-update' },
        })
        return true
      }
      return false
    },
    'AGENT_SAISIE',
    true,
  )
  await page.goto('/activities/state-activity')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Modifier la programmation' }).click()
  await page
    .getByLabel('Intitulé de l’activité', { exact: true })
    .fill('Modification non enregistrée')
  const workerPath = new URL('../../dist/sw.js', import.meta.url)
  const original = await readFile(workerPath, 'utf8')
  try {
    await writeFile(
      workerPath,
      `${original}\n// state handling update fixture ${Date.now()}\n`,
    )
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration()).update(),
    )
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel('Adresse e-mail')).toBeVisible()
    expect(signedOut).toBe(true)
    await expect
      .poll(() =>
        page.evaluate(async () =>
          Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
        ),
      )
      .toBe(false)
  } finally {
    await writeFile(workerPath, original)
  }
})
