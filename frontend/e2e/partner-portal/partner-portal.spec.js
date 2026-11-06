import { expect, test } from '@playwright/test'

test('Partner portfolio stays read-only on desktop and mobile', async ({
  page,
}) => {
  const list = (data) => ({
    object: 'list',
    count: data.length,
    data,
    next: null,
    previous: null,
  })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/session')
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
    if (path === '/api/v1/partner-portal/ptas/pta-1/exports') {
      expect(route.request().method()).toBe('POST')
      expect(route.request().headers()['x-csrf-token']).toBe('csv-csrf')
      expect(route.request().postDataJSON()).toEqual({ format: 'csv' })
      return route.fulfill({
        body: '\ufeffNom;Budget\nActivité;120000',
        contentType: 'text/csv',
        headers: {
          'Content-Disposition':
            'attachment; filename="pta-partenaire-2027.csv"',
        },
      })
    }
    if (path === '/api/v1/partner-portal/profile')
      return route.fulfill({
        json: { id: 'partner-1', name: 'Partenaire Démo' },
      })
    if (path === '/api/v1/partner-portal/projects')
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
    if (path === '/api/v1/partner-portal/projects/project-1/ptas')
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
    if (path === '/api/v1/partner-portal/ptas/pta-1/activities')
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
    if (path === '/api/v1/partner-portal/activities/activity-1')
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
          context: {
            partner: 'Partenaire Démo',
            project_reference: 'PRJ-2027-001',
            project: 'Projet Santé',
            year: 2027,
          },
          operations: [
            {
              name: 'Consultations',
              description: 'Trois journées réalisées.',
              allocation: '120000',
              final_spending: '90000',
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
    if (path === '/api/v1/partner-portal/activities/activity-1/documents')
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
      path ===
        '/api/v1/partner-portal/activities/activity-1/documents/file-1/preview' ||
      path ===
        '/api/v1/partner-portal/activities/activity-1/documents/file-1/download'
    )
      return route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1kAAAAASUVORK5CYII=',
          'base64',
        ),
        contentType: 'image/png',
        headers: { 'Content-Disposition': 'attachment; filename="photo.png"' },
      })
    if (path === '/api/v1/partner-portal/activities/activity-1/fiche.pdf')
      return route.fulfill({
        body: Buffer.from('%PDF-1.4 synthetic'),
        contentType: 'application/pdf',
        headers: {
          'Content-Disposition':
            'attachment; filename="fiche-partenaire-ACT-001.pdf"',
        },
      })
    return route.fulfill({ status: 404, json: {} })
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
  await page.screenshot({
    path: '/tmp/mjl-tailwind-partner-desktop.png',
    fullPage: true,
  })
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
  await expect(page.getByText(/30.000 XOF/).first()).toBeVisible()
  await expect(page.getByText(/pièce jointe/i)).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger la fiche PDF' }).click()
  await expect((await download).suggestedFilename()).toBe(
    'fiche-partenaire-ACT-001.pdf',
  )

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
  const mobileCsv = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Télécharger le récapitulatif CSV' })
    .click()
  expect((await mobileCsv).suggestedFilename()).toBe('pta-partenaire-2027.csv')
  await expect(
    page.getByRole('navigation', { name: 'Espace Partenaire' }),
  ).toBeVisible()
  await expect(page.getByText('1 activité clôturée sur 2')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Campagne de santé', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Résultat financier')).toBeVisible()
  await expect(page.getByText(/13 mars 2027/)).toBeVisible()
  await page.getByRole('button', { name: 'Aperçu', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.screenshot({
    path: '/tmp/mjl-tailwind-partner-preview-mobile.png',
    fullPage: true,
  })
  const bounds = await dialog.boundingBox()
  expect(bounds.width).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
})
