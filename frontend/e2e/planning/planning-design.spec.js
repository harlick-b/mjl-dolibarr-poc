import { test, expect } from '@playwright/test'

const empty = { object: 'list', count: 0, data: [], next: null, previous: null }
const project = {
  id: 'project-1',
  name: 'Protection de l’enfant et accès à la justice',
  reference: 'PRJ-001',
  partner_id: 'partner-1',
  partner_name: 'UNICEF',
  state: 'active',
  version: 1,
  allowed_actions: ['read', 'edit', 'close'],
}
const summary = {
  activities: 1,
  approved: 0,
  review: 0,
  correction: 0,
  draft: 1,
  approved_allocation: '0',
}
const activity = {
  id: 'activity-1',
  project_id: project.id,
  pta_id: 'pta-1',
  placement_year: 2027,
  reference: 'ACT-001',
  name: 'Formation des acteurs de la justice des mineurs',
  description:
    'Renforcer l’accès à la justice et la coordination des acteurs de terrain.',
  planned_start: '2027-01-10',
  planned_end: '2027-03-10',
  allocation: '3000000',
  state: 'draft',
  version: 1,
  operations: [
    {
      id: 'op-1',
      type_id: 'type-1',
      type_label: 'Formation',
      name: 'Atelier et missions de terrain',
      allocation: '3000000',
    },
  ],
  operation_count: 1,
  agents: ['Agent de test'],
  agent_ids: [],
  allowed_actions: ['read', 'edit', 'submit'],
}
async function setup(page, role = 'AGENT_SAISIE') {
  let pta = {
    id: 'pta-1',
    project_id: project.id,
    year: 2027,
    name: 'PTA 2027 — Protection de l’enfant et accès à la justice',
    description: 'Programme annuel de coopération UNICEF / MJL.',
    version: 1,
    allowed_actions: role === 'AGENT_SAISIE' ? ['read'] : ['read', 'edit'],
  }
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname
    let json = empty
    if (path.endsWith('/auth/session'))
      json = {
        state: 'verified',
        csrf: 'fixture',
        user: {
          id: 'test',
          full_name: 'Agent de test',
          email: 'test@example.test',
          role,
        },
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }
    else if (
      ['POST', 'PATCH'].includes(route.request().method()) &&
      (path === '/api/v1/projects/project-1/ptas' ||
        path === '/api/v1/ptas/pta-1')
    ) {
      pta = {
        ...pta,
        ...route.request().postDataJSON(),
        version: pta.version + 1,
      }
      json = pta
    } else if (path === '/api/v1/projects')
      json = { ...empty, count: 1, data: [project] }
    else if (path === '/api/v1/partners')
      json = {
        ...empty,
        count: 1,
        data: [
          {
            id: 'partner-1',
            name: 'UNICEF',
            description: 'Programme de protection de l’enfant.',
            project_count: 1,
            active: true,
            allowed_actions: ['read', 'edit'],
          },
        ],
      }
    else if (
      path === '/api/v1/ptas' ||
      path === '/api/v1/projects/project-1/ptas'
    )
      json = {
        ...empty,
        count: 1,
        data: [
          {
            ...pta,
            project_id: project.id,
            project_name: project.name,
            partner_name: 'UNICEF',
            year: 2027,
            summary,
          },
        ],
      }
    else if (/\/projects\/project-1\/ptas\/\d{4}$/.test(path))
      json = {
        project,
        year: pta.year,
        pta,
        summary,
        allowed_actions: ['read', 'create_activity'],
        approved_plan: { activity_count: 0, allocation: '0' },
      }
    else if (path === '/api/v1/ptas/pta-1/activities')
      json = { ...empty, count: 1, data: [activity] }
    else if (path === '/api/v1/activities/activity-1') json = activity
    else if (path === '/api/v1/operation-types')
      json = {
        ...empty,
        count: 1,
        data: [{ id: 'type-1', label: 'Formation' }],
      }
    return route.fulfill({ json })
  })
}
test('planning references: index, table, calendar, form and detail tabs', async ({
  page,
}) => {
  await setup(page)
  await page.setViewportSize({ width: 1846, height: 970 })
  await page.goto('/planning')
  await expect(
    page.getByRole('columnheader', { name: 'Budget approuvé' }),
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-design-index.png' })
  await page.getByRole('link', { name: 'Consulter le PTA' }).click()
  await expect(
    page.getByRole('region', { name: 'Synthèse du PTA' }),
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Agents affectés' }),
  ).toBeVisible()
  await expect(page.locator('aside nav a[aria-current="page"]')).toHaveCount(1)
  await page.screenshot({ path: '/tmp/mjl-design-pta.png' })
  await page.getByRole('button', { name: 'Calendrier', exact: true }).click()
  await expect(page.getByRole('heading', { name: /janvier/i })).toBeVisible()
  await expect(page.getByRole('link', { name: activity.name })).toHaveCount(3)
  await page.screenshot({
    path: '/tmp/mjl-design-calendar.png',
    fullPage: true,
  })
  await page.getByRole('link', { name: 'Ajouter une activité au PTA' }).click()
  await expect(
    page.getByRole('heading', { name: 'Informations générales' }),
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-design-create.png', fullPage: true })
  await page.goto('/activities/activity-1')
  await expect(
    page.getByRole('heading', { name: 'Budget et validation' }),
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-design-detail.png', fullPage: true })
  await page.getByRole('link', { name: 'Historique', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Aucun événement' }),
  ).toBeVisible()
  await page
    .getByRole('link', { name: 'Pièces justificatives', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Aucune pièce justificative' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: '/tmp/mjl-design-detail-mobile.png',
    fullPage: true,
  })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
})
test('project and partner actions use editing and project PTA navigation', async ({
  page,
}) => {
  await setup(page, 'VALIDATEUR_DEFINITIF')
  await page.goto('/partners')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Modifier le partenaire' }),
  ).toBeVisible()
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('UNICEF')
  await page.getByLabel('Nom', { exact: true }).fill('Unsaved change')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('UNICEF')
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Créer un partenaire', exact: true })
    .click()
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.getByLabel('Nom', { exact: true }).fill('UNICEF revised')
  const saved = page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' &&
      request.url().endsWith('/partners/partner-1'),
  )
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  expect((await saved).postDataJSON()).toEqual({
    name: 'UNICEF revised',
    description: 'Programme de protection de l’enfant.',
    expected: {
      name: 'UNICEF',
      description: 'Programme de protection de l’enfant.',
    },
  })
  await page.goto('/projects')
  await expect(
    page.getByRole('button', { name: 'Modifier', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Exercice du PTA')).toHaveCount(0)
  await page.getByRole('link', { name: 'Voir les PTA' }).click()
  await expect(page).toHaveURL(/planning\?project=project-1/)
  await expect(page.locator('aside nav a[aria-current="page"]')).toHaveCount(1)
})

test('PTA metadata modals follow the reference and keep immutable fields on edit', async ({
  page,
}) => {
  await setup(page, 'AGENT_VERIFICATEUR')
  await page.setViewportSize({ width: 1837, height: 965 })
  await page.goto('/planning')
  await expect(
    page.getByText('Programme annuel de coopération UNICEF / MJL.'),
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/pta-metadata-index.png' })
  await page.getByRole('button', { name: 'Créer un PTA', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('combobox', { name: 'Projet' })).toContainText(
    project.name,
  )
  await page.screenshot({ path: '/tmp/pta-metadata-create.png' })
  await dialog.getByLabel('Nom du PTA').fill('Programme annuel de coopération')
  await dialog.getByLabel('Description').fill('Priorités de terrain')
  await dialog
    .getByRole('button', { name: 'Créer le PTA', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'Programme annuel de coopération',
      level: 1,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Modifier le PTA' }).click()
  await expect(dialog.getByLabel('Nom du PTA')).toHaveValue(
    'Programme annuel de coopération',
  )
  await expect(dialog.getByRole('combobox')).toHaveCount(0)
  await page.screenshot({ path: '/tmp/pta-metadata-edit.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '/tmp/pta-metadata-mobile.png' })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'Modifier le PTA' }).click()
  await page.mouse.click(2, 2)
  await expect(dialog).toHaveCount(0)
})

test('reviewer brief uses nested calendars, searchable assignment and retained same-key recovery', async ({
  page,
}) => {
  await setup(page, 'AGENT_VERIFICATEUR')
  const sent = []
  await page.route('**/api/v1/assignment-agents*', (route) =>
    route.fulfill({
      json: {
        ...empty,
        count: 1,
        data: [
          {
            id: 'agent-1',
            full_name: 'Aïcha HOUNKPATIN',
            email: 'a@example.test',
          },
        ],
      },
    }),
  )
  await page.route(
    '**/api/v1/projects/project-1/ptas/2027/activities',
    (route) => {
      sent.push(route.request().postDataJSON())
      return sent.length === 1
        ? route.abort('failed')
        : route.fulfill({ json: { ...activity, id: 'created' } })
    },
  )
  await page.setViewportSize({ width: 1837, height: 965 })
  // Legacy direct creation URLs take reviewers back to their own interaction.
  await page.goto('/projects/project-1/ptas/2027/activities/new')
  await expect(page).toHaveURL(/\/projects\/project-1\/ptas\/2027(?:\?|$)/)
  const opener = page.getByRole('button', {
    name: 'Ajouter une activité au PTA',
  })
  await opener.click()
  const modal = page.getByRole('dialog', {
    name: 'Créer et affecter une activité',
  })
  await expect(modal).toBeVisible()
  await page.screenshot({ path: '/tmp/brief-reference.png' })
  await modal
    .getByLabel('Intitulé de l’activité')
    .fill('Concertation communale')
  await modal.getByRole('button', { name: /Date de début/ }).click()
  await expect(page.getByRole('grid')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modal).toBeVisible()
  await expect(
    modal.getByRole('button', { name: /Date de début/ }),
  ).toBeFocused()
  await modal.getByRole('button', { name: /Date de début/ }).click()
  await page.getByRole('button', { name: /vendredi 1 janvier 2027/i }).click()
  await modal.getByRole('button', { name: 'Sélectionner des Agents' }).click()
  await modal.getByRole('option', { name: 'Aïcha HOUNKPATIN' }).click()
  await page.screenshot({ path: '/tmp/brief-selection.png' })
  await modal
    .getByRole('button', { name: 'Créer et affecter', exact: true })
    .click()
  await expect(modal.getByRole('alert')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()
  await opener.click()
  await expect(modal.getByLabel('Intitulé de l’activité')).toHaveValue(
    'Concertation communale',
  )
  await expect(modal.getByLabel('Intitulé de l’activité')).toBeDisabled()
  await modal.getByRole('button', { name: 'Vérifier l’enregistrement' }).click()
  await expect(modal).toHaveCount(0)
  expect(sent).toHaveLength(2)
  expect(sent[1]).toEqual(sent[0])
  expect(sent[0].planned_end).toBeNull()
  expect(sent[0]).not.toHaveProperty('allocation')
  await opener.click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '/tmp/brief-mobile.png' })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await modal.getByRole('button', { name: /Date de début/ }).click()
  await page.screenshot({ path: '/tmp/brief-mobile-calendar.png' })
  await page.keyboard.press('Escape')
  await page.mouse.click(2, 2)
  await expect(modal).toHaveCount(0)
  await page.setViewportSize({ width: 918, height: 482 })
  await opener.click()
  await page.screenshot({ path: '/tmp/brief-reflow.png' })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 918)
  await modal.getByRole('button', { name: 'Annuler', exact: true }).click()
  await expect(modal).toHaveCount(0)
  await expect(opener).toBeFocused()
})
