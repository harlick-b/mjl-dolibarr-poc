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
  project_name: project.name,
  partner_name: 'UNICEF',
  pta_name: 'PTA 2027 — Protection de l’enfant et accès à la justice',
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
  agent_ids: ['test'],
  creator: {
    id: 'test',
    full_name: 'Agent de test',
    email: 'test@example.test',
  },
  agents: [
    {
      id: 'test',
      full_name: 'Agent de test',
      email: 'test@example.test',
    },
  ],
  current_revision_id: null,
  current_revision_number: null,
  current_submitter: null,
  latest_decision_actor: null,
  approved_revision_id: null,
  approved_allocation: null,
  correction: null,
  amendment: null,
  withdrawal: null,
  transfer: null,
  execution_paused: false,
  allowed_actions: ['read', 'edit', 'submit'],
}
async function setup(page, role = 'AGENT_SAISIE', detail = {}) {
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
      json = {
        ...empty,
        count: 1,
        data: [{ ...activity, agents: ['Agent de test'] }],
      }
    else if (path === '/api/v1/ptas/pta-1/activity-agents')
      json = {
        ...empty,
        count: 1,
        data: [{ id: 'agent-1', label: 'Agent de test' }],
      }
    else if (path === '/api/v1/activities/activity-1')
      json = {
        ...activity,
        planned_end: null,
        allocation: null,
        operations: [],
        operation_count: 0,
        ...detail,
      }
    else if (path === '/api/v1/assignment-agents')
      json = url.searchParams.get('q')
        ? empty
        : {
            ...empty,
            count: 3,
            data: [
              {
                id: 'agent-1',
                full_name: 'Aïcha HOUNKPATIN',
                email: 'aicha@example.test',
              },
              {
                id: 'agent-2',
                full_name: 'Patrick ADJOVI',
                email: 'patrick@example.test',
              },
              {
                id: 'agent-3',
                full_name: 'Clarisse KIKI',
                email: 'clarisse@example.test',
              },
            ],
          }
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
  await page.getByRole('button', { name: 'Filtres' }).click()
  await expect(page.getByRole('combobox', { name: 'Validation' })).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-design-pta.png' })
  await page.getByRole('button', { name: 'Calendrier', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'janv.', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Sélectionnez un mois pour voir les dates.'),
  ).toBeVisible()
  await expect(
    page.getByText('Période planifiée', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: activity.name, exact: true }),
  ).toHaveCount(1)
  await page.screenshot({
    path: '/tmp/mjl-design-calendar.png',
    fullPage: true,
  })
  const timelineBar = page.getByRole('button', {
    name: /Formation des acteurs.*Afficher les dates/i,
  })
  await timelineBar.focus()
  await expect(page.getByRole('tooltip')).toContainText('Agent de test')
  await timelineBar.press('Enter')
  const inspection = page.getByRole('dialog')
  await expect(inspection).toContainText('Début')
  await page.keyboard.press('Escape')
  await expect(timelineBar).toBeFocused()
  await page.getByRole('button', { name: 'janv.', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Vue annuelle' })).toBeVisible()
  await page.screenshot({
    path: '/tmp/mjl-design-calendar-month.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 918, height: 970 })
  await expect(page.getByRole('button', { name: 'Filtres' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vue annuelle' })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1846, height: 970 })
  await page.getByRole('link', { name: 'Ajouter une activité au PTA' }).click()
  await expect(
    page.getByRole('heading', { name: 'Informations générales' }),
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-design-create.png', fullPage: true })
  await page.goto('/activities/activity-1')
  await expect(
    page.getByRole('heading', { name: 'Programmation' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Soumettre pour prévalidation' }),
  ).toHaveCount(0)
  await page.screenshot({ path: '/tmp/mjl-design-detail.png', fullPage: true })
  await page.getByRole('button', { name: 'Compléter la programmation' }).click()
  await expect(
    page.getByRole('heading', { name: 'Compléter la programmation', level: 1 }),
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/mjl-design-edit.png', fullPage: true })
  await page.getByRole('button', { name: 'Annuler', exact: true }).click()
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
  await page.setViewportSize({ width: 1846, height: 970 })
  await page.goto('/execution/pta-1')
  await page.getByRole('button', { name: 'Filtres' }).click()
  const executionAgentFilter = page
    .locator('label')
    .filter({ hasText: 'Agent affecté' })
  await expect(executionAgentFilter.getByRole('button')).toBeVisible()
  await page.screenshot({
    path: '/tmp/mjl-design-execution-filters.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 918, height: 970 })
  await expect(executionAgentFilter.getByRole('button')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
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
  const createOpener = page.getByRole('button', {
    name: 'Créer un PTA',
    exact: true,
  })
  await createOpener.click()
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
  await expect(
    page.getByRole('button', { name: 'Modifier le PTA' }),
  ).toBeFocused()
  const editOpener = page.getByRole('button', { name: 'Modifier le PTA' })
  await editOpener.click()
  await page.mouse.click(2, 2)
  await expect(dialog).toHaveCount(0)
  await expect(editOpener).toBeFocused()
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
    name: 'Créer une activité',
  })
  await expect(modal).toBeVisible()
  await page.screenshot({ path: '/tmp/brief-reference.png' })
  await modal
    .getByLabel('Intitulé de l’activité *')
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
    .getByRole('button', { name: 'Créer l’activité', exact: true })
    .click()
  await expect(modal.getByRole('alert')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()
  await opener.click()
  await expect(modal.getByLabel('Intitulé de l’activité *')).toHaveValue(
    'Concertation communale',
  )
  await expect(modal.getByLabel('Intitulé de l’activité *')).toBeDisabled()
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

test('assignment and both planning decisions match their governing dialogs', async ({
  browser,
}) => {
  const reviewActivity = {
    state: 'submitted',
    version: 2,
    planned_end: '2027-04-01',
    allocation: '1500000',
    operations: [
      {
        id: 'op-1',
        type_id: 'type-1',
        type_label: 'Formation',
        name: 'Atelier et missions de terrain',
        allocation: '1500000',
      },
    ],
    operation_count: 1,
    agent_ids: ['agent-1', 'agent-2'],
    agents: [
      {
        id: 'agent-1',
        full_name: 'Aïcha HOUNKPATIN',
        email: 'aicha@example.test',
      },
      {
        id: 'agent-2',
        full_name: 'Patrick ADJOVI',
        email: 'patrick@example.test',
      },
    ],
    current_revision_id: 'revision-1',
    current_revision_number: 1,
    current_submitter: {
      id: 'agent-1',
      full_name: 'Aïcha HOUNKPATIN',
      email: 'aicha@example.test',
    },
    allowed_actions: ['read', 'assign_agents', 'prevalidate'],
  }
  const supervisorContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1837, height: 964 },
  })
  const supervisor = await supervisorContext.newPage()
  await setup(supervisor, 'AGENT_VERIFICATEUR', reviewActivity)
  await supervisor.goto('/activities/activity-1')
  const assignmentOpener = supervisor.getByRole('button', {
    name: 'Modifier les responsables',
  })
  await assignmentOpener.click()
  const assignment = supervisor.getByRole('dialog', {
    name: 'Responsables de l’activité',
  })
  await supervisor.keyboard.press('Escape')
  await expect(assignment).toHaveCount(0)
  await expect(assignmentOpener).toBeFocused()
  await assignmentOpener.click()
  await supervisor.mouse.click(2, 2)
  await expect(assignment).toHaveCount(0)
  await expect(assignmentOpener).toBeFocused()
  await assignmentOpener.click()
  await assignment
    .getByRole('button', { name: 'Rechercher et ajouter un Agent' })
    .click()
  await assignment
    .getByRole('searchbox', { name: 'Rechercher et ajouter un Agent' })
    .fill('personne')
  await expect(
    assignment.getByText('Aucun Agent ne correspond à votre recherche.'),
  ).toBeVisible()
  await assignment
    .getByRole('searchbox', { name: 'Rechercher et ajouter un Agent' })
    .fill('')
  await assignment.getByRole('button', { name: /Clarisse KIKI/ }).click()
  await assignment
    .getByRole('button', { name: /Retirer Patrick ADJOVI/ })
    .click()
  await expect(
    assignment.getByRole('heading', { name: 'Modifications à enregistrer' }),
  ).toBeVisible()
  await supervisor.screenshot({ path: '/tmp/mjl-design-assignment.png' })
  await supervisor.setViewportSize({ width: 918, height: 482 })
  await expect(supervisor.locator('body')).toHaveJSProperty('scrollWidth', 918)
  await supervisor.screenshot({ path: '/tmp/mjl-design-assignment-reflow.png' })
  await assignment.getByRole('button', { name: 'Annuler' }).click()
  await expect(assignment).toHaveCount(0)
  await expect(assignmentOpener).toBeFocused()
  await supervisor.setViewportSize({ width: 1837, height: 964 })
  const prevalidateOpener = supervisor.getByRole('button', {
    name: 'Prévalider',
  })
  await prevalidateOpener.click()
  const prevalidation = supervisor.getByRole('dialog', { name: 'Prévalider' })
  await expect(prevalidation).toBeVisible()
  await expect(
    prevalidation.getByRole('button', { name: 'Fermer' }),
  ).toBeVisible()
  await expect(prevalidation.getByText(activity.name)).toBeVisible()
  await supervisor.screenshot({ path: '/tmp/mjl-design-prevalidate.png' })
  await supervisor.setViewportSize({ width: 918, height: 482 })
  await expect(supervisor.locator('body')).toHaveJSProperty('scrollWidth', 918)
  await expect(
    prevalidation.getByRole('button', { name: 'Fermer' }),
  ).toBeVisible()
  await supervisor.screenshot({
    path: '/tmp/mjl-design-prevalidate-reflow.png',
  })
  const decisionFile = prevalidation.getByLabel(
    'Pièce justificative (facultative)',
  )
  await prevalidation.getByLabel('Observation (facultative)').focus()
  await supervisor.keyboard.press('Tab')
  await expect(decisionFile).toBeFocused()
  const decisionFileField = prevalidation.locator('[data-ui~="decision-file"]')
  await expect
    .poll(() =>
      decisionFileField.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      ),
    )
    .not.toBe('none')
  const fileBox = await decisionFileField.boundingBox()
  const footerBox = await prevalidation
    .locator('[data-ui~="modal-actions"]')
    .boundingBox()
  expect(fileBox).not.toBeNull()
  expect(footerBox).not.toBeNull()
  expect((fileBox?.y ?? 0) + (fileBox?.height ?? 0)).toBeLessThanOrEqual(
    footerBox?.y ?? 0,
  )
  await supervisor.screenshot({
    path: '/tmp/mjl-design-prevalidate-reflow-file-focus.png',
  })
  const confirmPrevalidation = prevalidation.getByRole('button', {
    name: 'Confirmer la décision',
  })
  await confirmPrevalidation.scrollIntoViewIfNeeded()
  await expect(confirmPrevalidation).toBeVisible()
  await expect(
    prevalidation.getByRole('button', { name: 'Annuler' }),
  ).toBeVisible()
  await expect(
    prevalidation.getByRole('heading', { name: 'Prévalider' }),
  ).toBeVisible()
  await expect(
    prevalidation.getByRole('button', { name: 'Fermer' }),
  ).toBeVisible()
  await supervisor.screenshot({
    path: '/tmp/mjl-design-prevalidate-reflow-footer.png',
  })
  await prevalidation.getByRole('button', { name: 'Annuler' }).click()
  await expect(prevalidation).toHaveCount(0)
  await expect(prevalidateOpener).toBeFocused()
  await prevalidateOpener.click()
  await supervisor.keyboard.press('Escape')
  await expect(prevalidation).toHaveCount(0)
  await expect(prevalidateOpener).toBeFocused()
  await prevalidateOpener.click()
  await supervisor.mouse.click(2, 2)
  await expect(
    supervisor.getByRole('dialog', { name: 'Prévalider' }),
  ).toHaveCount(0)
  await expect(prevalidateOpener).toBeFocused()
  await supervisorContext.close()

  const validatorContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1837, height: 964 },
  })
  const validator = await validatorContext.newPage()
  await setup(validator, 'VALIDATEUR_DEFINITIF', {
    ...reviewActivity,
    state: 'prevalidated',
    latest_decision_actor: {
      id: 'supervisor',
      full_name: 'Jean DOSSOU',
      email: 'jean@example.test',
    },
    allowed_actions: ['read', 'assign_agents', 'approve'],
  })
  await validator.goto('/activities/activity-1')
  const approveOpener = validator.getByRole('button', {
    name: 'Valider définitivement',
  })
  await approveOpener.click()
  await expect(
    validator.getByRole('dialog', { name: 'Autoriser' }),
  ).toBeVisible()
  await validator.screenshot({ path: '/tmp/mjl-design-authorize.png' })
  await validator.setViewportSize({ width: 918, height: 482 })
  await expect(validator.locator('body')).toHaveJSProperty('scrollWidth', 918)
  await validator.screenshot({ path: '/tmp/mjl-design-authorize-reflow.png' })
  await validator.keyboard.press('Escape')
  await expect(
    validator.getByRole('dialog', { name: 'Autoriser' }),
  ).toHaveCount(0)
  await expect(approveOpener).toBeFocused()
  await approveOpener.click()
  await validator.mouse.click(2, 2)
  await expect(
    validator.getByRole('dialog', { name: 'Autoriser' }),
  ).toHaveCount(0)
  await expect(approveOpener).toBeFocused()
  await validatorContext.close()
})

test('complete activity editing matches the populated desktop and reflow references', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1837, height: 964 },
  })
  const page = await context.newPage()
  await setup(page, 'AGENT_SAISIE', {
    planned_end: activity.planned_end,
    operations: [
      ...activity.operations,
      {
        id: 'op-2',
        type_id: 'type-1',
        type_label: 'Formation',
        name: 'Missions de suivi dans les juridictions',
        allocation: '1000000',
      },
    ],
    operation_count: 2,
    allocation: '4000000',
  })
  await page.goto('/activities/activity-1')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Réviser la programmation', level: 1 }),
  ).toBeVisible()
  await page.screenshot({
    path: '/tmp/mjl-design-edit-complete.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 918, height: 482 })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 918)
  await page.screenshot({
    path: '/tmp/mjl-design-edit-complete-reflow.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({
    path: '/tmp/mjl-design-edit-complete-mobile.png',
    fullPage: true,
  })
  await context.close()
})
