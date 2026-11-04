import { expect, test } from '@playwright/test'

test('an Agent adds an optional Activity attachment', async ({ page }) => {
  const empty = {
    object: 'list',
    count: 0,
    data: [],
    next: null,
    previous: null,
  }
  let documents = []
  let upload
  let previewed = 0
  let withdrawal
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/auth/session')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csrf',
          user: { id: 'agent', role: 'AGENT_SAISIE' },
          expires_at: new Date(Date.now() + 60000).toISOString(),
        },
      })
    if (path === '/api/v1/activities/activity-1')
      return route.fulfill({
        json: {
          id: 'activity-1',
          pta_id: 'pta-1',
          project_id: 'project-1',
          reference: 'ACT-000001',
          name: 'Atelier approuvé',
          description: 'Version approuvée',
          planned_start: '2027-01-10',
          planned_end: '2027-04-10',
          allocation: '100000',
          state: 'approved',
          version: 4,
          current_revision_id: 'revision-1',
          approved_revision_id: 'revision-1',
          approved_allocation: '100000',
          approved: {
            name: 'Atelier approuvé',
            description: 'Version approuvée',
            planned_start: '2027-01-10',
            planned_end: '2027-04-10',
            allocation: '100000',
            operations: [],
          },
          candidate: null,
          amendment: null,
          withdrawal: null,
          transfer: null,
          placement_year: 2027,
          execution_paused: false,
          operations: [],
          correction: null,
          agent_ids: [],
          allowed_actions: ['read'],
        },
      })
    if (path === '/api/v1/activities/activity-1/documents/document-1/preview') {
      previewed += 1
      return route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
          'base64',
        ),
        contentType: 'image/png',
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    if (
      path ===
        '/api/v1/activities/activity-1/documents/document-2/withdrawal' &&
      request.method() === 'POST'
    ) {
      withdrawal = request.postDataJSON()
      documents = documents.map((document) =>
        document.id === 'document-2'
          ? {
              ...document,
              withdrawal: {
                reason: withdrawal.reason,
                withdrawn_by_id: 'agent',
                withdrawn_at: '2027-01-02T11:00:00Z',
                replacement_document_id: withdrawal.replacement_document_id,
                replacement_document_name: 'preuve.png',
              },
              allowed_actions: [],
            }
          : document,
      )
      return route.fulfill({ status: 201, json: documents[1] })
    }
    if (path === '/api/v1/activities/activity-1/documents') {
      if (request.method() === 'POST') {
        upload = {
          csrf: request.headers()['x-csrf-token'],
          type: request.headers()['content-type'],
          name: request.headers()['x-file-name'],
          body: request.postDataBuffer(),
        }
        documents = [
          {
            id: 'document-1',
            activity_id: 'activity-1',
            name: 'preuve.png',
            media_type: 'image/png',
            size: upload.body.length,
            uploaded_by_id: 'agent',
            uploaded_at: '2027-01-02T10:00:00Z',
            withdrawal: null,
            allowed_actions: ['withdraw'],
          },
          {
            id: 'document-2',
            activity_id: 'activity-1',
            name: 'preuve.pdf',
            media_type: 'application/pdf',
            size: 3,
            uploaded_by_id: 'agent',
            uploaded_at: '2027-01-02T09:00:00Z',
            withdrawal: null,
            allowed_actions: ['withdraw'],
          },
        ]
        return route.fulfill({ status: 201, json: documents[0] })
      }
      return route.fulfill({
        json: { ...empty, count: documents.length, data: documents },
      })
    }
    return route.fulfill({ json: empty })
  })

  await page.goto('/activities/activity-1')
  await expect(page.getByText('Aucune pièce justificative.')).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter une pièce' }).click()
  await page.getByLabel('Choisir un fichier PDF, JPEG ou PNG').setInputFiles({
    name: 'preuve.png',
    mimeType: 'image/png',
    buffer: Buffer.from('synthetic PNG'),
  })
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Ajouter' })
    .click()

  await expect(page.getByText('preuve.png')).toBeVisible()
  const imageRow = page.getByRole('listitem').filter({ hasText: 'preuve.png' })
  await expect(
    imageRow.getByRole('link', { name: 'Télécharger', exact: true }),
  ).toHaveAttribute(
    'href',
    '/api/v1/activities/activity-1/documents/document-1/download',
  )
  await imageRow.getByRole('button', { name: 'Aperçu de preuve.png' }).click()
  const preview = page.getByRole('dialog', { name: 'Aperçu — preuve.png' })
  await expect(
    preview.getByRole('img', { name: 'Aperçu de preuve.png' }),
  ).toBeVisible()
  await expect.poll(() => previewed).toBe(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(preview).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true)
  await preview.getByRole('button', { name: 'Fermer' }).click()
  const pdfRow = page.getByRole('listitem').filter({ hasText: 'preuve.pdf' })
  await expect(pdfRow.getByRole('button', { name: /Aperçu/ })).toHaveCount(0)
  await pdfRow.getByRole('button', { name: 'Retirer la pièce' }).click()
  const withdrawalDialog = page.getByRole('dialog', {
    name: 'Retirer la pièce',
  })
  await withdrawalDialog
    .getByLabel('Motif du retrait')
    .fill('Pièce incorrecte.')
  await withdrawalDialog
    .getByLabel('Pièce corrigée (facultatif)')
    .selectOption('document-1')
  await withdrawalDialog.getByRole('button', { name: 'Retirer' }).click()
  await expect(pdfRow).toContainText('Pièce retirée')
  await expect(pdfRow).toContainText('Remplacée par preuve.png')
  await expect(pdfRow.getByRole('link', { name: 'Télécharger' })).toHaveCount(0)
  expect(withdrawal).toEqual({
    reason: 'Pièce incorrecte.',
    replacement_document_id: 'document-1',
  })
  expect(upload).toEqual({
    csrf: 'csrf',
    type: 'image/png',
    name: 'preuve.png',
    body: Buffer.from('synthetic PNG'),
  })
})
