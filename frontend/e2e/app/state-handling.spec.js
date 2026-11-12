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
  agent_ids: [],
  operations: [
    {
      id: 'operation-1',
      type_id: 'type-1',
      name: 'Préparer',
      allocation: '100',
      position: 1,
    },
  ],
  allowed_actions: ['read', 'edit'],
}
const empty = { object: 'list', count: 0, data: [], next: null, previous: null }

async function fixture(
  page,
  override = async () => false,
  role = 'AGENT_SAISIE',
) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (await override(route, url)) return
    let body = empty
    if (url.pathname.endsWith('/auth/session'))
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
    else if (url.pathname.endsWith('/activities/state-activity'))
      body = activity
    else if (url.pathname.endsWith('/operation-types'))
      body = { ...empty, count: 1, data: [{ id: 'type-1', label: 'Atelier' }] }
    else if (url.pathname.endsWith('/partner-portal/profile'))
      body = { id: 'partner-1', name: 'Partenaire synthétique' }
    await route.fulfill({ json: body })
  })
}

test('uncertain upload from an older page can be reconciled inside the native dialog', async ({
  page,
}) => {
  let uploads = 0
  let readsAfterUpload = 0
  await fixture(page, async (route, url) => {
    if (!url.pathname.endsWith('/documents')) return false
    if (route.request().method() === 'POST') {
      uploads++
      await route.abort('failed')
    } else if (uploads) {
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
            count: 1,
            data: [
              {
                id: 'doc-1',
                name: 'preuve.png',
                media_type: 'image/png',
                byte_size: 3,
                allowed_actions: [],
              },
            ],
          },
        })
    } else await route.fulfill({ json: empty })
    return true
  })
  await page.goto('/activities/state-activity?documentCursor=older')
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
  ).toBeVisible()
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
  await fixture(page, async (route, url) => {
    if (url.pathname.endsWith('/auth/logout')) {
      signedOut = true
      await route.fulfill({ status: 204 })
      return true
    }
    if (signedOut && url.pathname.endsWith('/auth/session')) {
      await route.fulfill({
        json: { state: 'anonymous', csrf: 'fresh-after-update' },
      })
      return true
    }
    return false
  })
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
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page
    .getByLabel('Intitulé de l’activité *', { exact: true })
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
    await expect(
      page.getByText('Une nouvelle version est disponible.', { exact: false }),
    ).toHaveCount(0)
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
