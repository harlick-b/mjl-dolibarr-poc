import { expect, test } from '@playwright/test'

test('Partner reads public portfolio facts and protected downloads without internal controls on desktop and mobile', async ({
  page,
}) => {
  const list = (data) => ({
    object: 'list',
    count: data.length,
    data,
    next: null,
    previous: null,
  })
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    if (path === '/api/v1/auth/session' && method === 'GET')
      return route.fulfill({
        json: {
          state: 'verified',
          csrf: 'csv-csrf',
          user: {
            id: 'partner-user',
            email: 'user@example.test',
            role: 'PARTENAIRE',
            partner_id: 'partner-1',
          },
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      })
    if (
      path === '/api/v1/partner-portal/ptas/pta-1/exports' &&
      method === 'POST'
    ) {
      expect(request.headers()['x-csrf-token']).toBe('csv-csrf')
      expect(request.postDataJSON()).toEqual({ format: 'csv' })
      return route.fulfill({
        body: '\ufeffNom;Budget\nActivité;120000',
        contentType: 'text/csv',
        headers: {
          'Content-Disposition':
            'attachment; filename="pta-partenaire-2027.csv"',
        },
      })
    }
    if (path === '/api/v1/partner-portal/profile' && method === 'GET')
      return route.fulfill({
        json: { id: 'partner-1', name: 'Partenaire Démo' },
      })
    if (path === '/api/v1/partner-portal/projects' && method === 'GET')
      return route.fulfill({
        json: list([
          {
            id: 'project-1',
            reference: 'PRJ-2027-001',
            name: 'Projet Santé',
            state: 'active',
          },
        ]),
      })
    if (
      path === '/api/v1/partner-portal/projects/project-1/ptas' &&
      method === 'GET'
    )
      return route.fulfill({
        json: list([
          {
            id: 'pta-1',
            year: 2027,
            metrics: {
              pta_id: 'pta-1',
              as_of: '2027-10-30T10:00:00Z',
              physical: { closed_activities: 1, approved_activities: 2 },
              financial: {
                closed_spending: '90000',
                approved_allocation: '120000',
              },
            },
          },
        ]),
      })
    if (
      path === '/api/v1/partner-portal/ptas/pta-1/activities' &&
      method === 'GET'
    )
      return route.fulfill({
        json: list([
          {
            id: 'activity-1',
            reference: 'ACT-001',
            name: 'Campagne de santé',
            planned_start: '2027-01-10',
            planned_end: '2027-03-10',
            allocation: '120000',
            state: 'closed',
            approved_revision: 1,
          },
        ]),
      })
    if (
      path === '/api/v1/partner-portal/activities/activity-1' &&
      method === 'GET'
    )
      return route.fulfill({
        json: {
          id: 'activity-1',
          reference: 'ACT-001',
          name: 'Campagne de santé',
          description: 'Consultations communautaires approuvées.',
          planned_start: '2027-01-10',
          planned_end: '2027-03-10',
          allocation: '120000',
          state: 'closed',
          approved_revision: 1,
          progress: '100',
          context: {
            partner: 'Partenaire Démo',
            project_reference: 'PRJ-2027-001',
            project: 'Projet Santé',
            year: 2027,
          },
          tasks: [
            {
              name: 'Consultations',
              description: 'Trois journées réalisées.',
              allocation: '120000',
              weight: '100',
              planned_start: '2027-01-10',
              planned_end: '2027-03-10',
              final_spending: '90000',
              progress: '100',
              subtasks: [],
            },
          ],
          decisions: [
            {
              kind: 'initial',
              revision: 1,
              decided_at: '2027-01-05T10:00:00Z',
            },
          ],
          finance: {
            approved_allocation: '120000',
            final_spending: '90000',
            zero_spending: false,
            confirmed_transfer_amount: '90000',
            confirmed_transfer_date: '2027-03-11',
            reversement_required: '30000',
            reversement_amount: '30000',
            reversement_date: '2027-03-12',
            closed_at: '2027-03-13T10:00:00Z',
          },
        },
      })
    if (
      path === '/api/v1/partner-portal/activities/activity-1/documents' &&
      method === 'GET'
    )
      return route.fulfill({
        json: list([
          {
            id: 'file-1',
            name: 'photo.png',
            media_type: 'image/png',
            size: 68,
          },
        ]),
      })
    if (
      (path ===
        '/api/v1/partner-portal/activities/activity-1/documents/file-1/preview' ||
        path ===
          '/api/v1/partner-portal/activities/activity-1/documents/file-1/download') &&
      method === 'GET'
    )
      return route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1kAAAAASUVORK5CYII=',
          'base64',
        ),
        contentType: 'image/png',
        headers: {
          'Content-Disposition': 'attachment; filename="photo.png"',
        },
      })
    if (
      path === '/api/v1/partner-portal/activities/activity-1/fiche.pdf' &&
      method === 'GET'
    )
      return route.fulfill({
        body: Buffer.from(
          'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjIwMgolJUVPRgo=',
          'base64',
        ),
        contentType: 'application/pdf',
        headers: {
          'Content-Disposition':
            'attachment; filename="fiche-partenaire-ACT-001.pdf"',
        },
      })
    throw new Error(`Unexpected API request: ${method} ${path}`)
  })

  await page.goto('/partner')
  await expect(
    page.getByRole('heading', { name: 'Bonjour, Partenaire Démo' }),
  ).toBeVisible()
  await expect(page.getByText('Projet Santé')).toBeVisible()
  await expect(page.getByText('Campagne de santé')).toBeVisible()
  await expect(
    page.getByText('Espace Partenaire · Lecture seule'),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Utilisateurs' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Planification' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Historique' })).toHaveCount(0)
  const csvDownload = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Télécharger le récapitulatif CSV' })
    .click()
  expect((await csvDownload).suggestedFilename()).toBe(
    'pta-partenaire-2027.csv',
  )
  await page.getByRole('button', { name: 'Voir le détail' }).click()
  await expect(
    page.getByRole('heading', { name: 'Campagne de santé', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Trois journées réalisées.')).toBeVisible()
  await expect(page.getByText(/30.000 F CFA/).first()).toBeVisible()
  await expect(page.getByText(/pièce jointe/i)).toHaveCount(0)
  await page.getByRole('button', { name: 'Consulter la fiche PDF' }).click()
  const ficheDialog = page.getByRole('dialog', {
    name: 'Fiche de suivi de l’activité',
  })
  await expect(ficheDialog).toBeVisible()
  await expect(
    ficheDialog.getByTitle('Fiche de suivi de l’activité — Aperçu'),
  ).toBeVisible()
  const download = page.waitForEvent('download')
  await ficheDialog.getByRole('button', { name: 'Télécharger' }).click()
  expect((await download).suggestedFilename()).toBe(
    'fiche-partenaire-ACT-001.pdf',
  )
  await ficheDialog.getByText('Fermer', { exact: true }).click()

  await expect(
    page
      .getByRole('region', { name: 'Documents partagés' })
      .getByText(/photo\.png/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Aperçu', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'Aperçu de photo.png' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Aperçu', exact: true }),
  ).toBeFocused()
  const attachmentDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger', exact: true }).click()
  expect((await attachmentDownload).suggestedFilename()).toBe('photo.png')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Aperçu', exact: true }).click()
  const mobileDialog = page.getByRole('dialog')
  await expect(mobileDialog).toBeVisible()
  const mobileBounds = await mobileDialog.boundingBox()
  expect(mobileBounds.width).toBeLessThanOrEqual(390)
  await mobileDialog.getByText('Fermer', { exact: true }).click()
})
