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
  await expect(
    page.getByRole('link', { name: 'Télécharger', exact: true }),
  ).toHaveAttribute(
    'href',
    '/api/v1/activities/activity-1/documents/document-1/download',
  )
  expect(upload).toEqual({
    csrf: 'csrf',
    type: 'image/png',
    name: 'preuve.png',
    body: Buffer.from('synthetic PNG'),
  })
})
