const { test, expect } = require('@playwright/test');
const { createUserReferenceFixtureSet } = require('../helpers/user-reference-fixture');
const { login } = require('../helpers/mjl-test-runtime');

let fixture;

test.beforeAll(() => {
  fixture = createUserReferenceFixtureSet({
    namespace: 'vui04.planning', entity: 1,
    users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire VUI04' }, { key: 'partner2', label: 'Autre Partenaire VUI04' }],
      projects: [{ key: 'project', label: 'Projet VUI04', partnerKey: 'partner' }, { key: 'project2', label: 'Autre Projet VUI04', partnerKey: 'partner2' }],
      operationTypes: [{ key: 'type', label: 'Type VUI04' }],
    },
  });
});

async function openForm(page) {
  await login(page, fixture.users.agent.login, process.env.MJL_TEST_USER_PASSWORD);
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
}

async function chooseReference(page, id, value) {
  const label = await page.locator(`#${id} option[value="${value}"]`).textContent();
  await page.locator(`#${id} + .select2`).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

async function fillStructure(page, name) {
  await chooseReference(page, 'activity-partner', fixture.partners.partner);
  await chooseReference(page, 'activity-project', fixture.projects.project);
  await page.locator('[name="name"]').fill(name);
  await page.locator('[name="description"]').fill('Planification VUI04');
  await page.getByLabel('Date de début').fill('01/01/2032');
  await page.getByLabel('Date de fin incluse').fill('31/12/2032');
  await page.locator('[name="authorized_amount"]').fill('9007199254740993');
  await page.locator('[name="operation_name[]"]').first().fill('Opération principale');
  await page.locator('[name="operation_type_id[]"]').first().selectOption(String(fixture.operationTypes.type));
  await page.locator('[name="operation_amount[]"]').first().fill('9007199254740990');
}

test('visible selectors filter Projects and draft saves preserve imbalance until submission', async ({ page }, testInfo) => {
  await openForm(page);
  await expect(page.getByRole('heading', { name: 'Vérification budgétaire' })).toBeVisible();
  const project = page.locator('[name="project_id"]');
  await expect(project.locator(`option[value="${fixture.projects.project}"]`)).toHaveCount(0);
  await chooseReference(page, 'activity-partner', fixture.partners.partner);
  await expect(project.locator(`option[value="${fixture.projects.project}"]`)).toHaveCount(1);
  await expect(project.locator(`option[value="${fixture.projects.project2}"]`)).toHaveCount(0);
  await chooseReference(page, 'activity-project', fixture.projects.project);
  await chooseReference(page, 'activity-partner', fixture.partners.partner2);
  await expect(project).toHaveValue('');
  await expect(project.locator(`option[value="${fixture.projects.project2}"]`)).toHaveCount(1);
  await fillStructure(page, 'Planification VUI04 brouillon');
  await page.getByRole('button', { name: 'Ajouter une Opération' }).click();
  await expect(page.locator('[data-operation-row]')).toHaveCount(2);
  await page.locator('[name="operation_name[]"]').last().fill('Opération complémentaire');
  await page.locator('[name="operation_type_id[]"]').last().selectOption(String(fixture.operationTypes.type));
  await page.locator('[name="operation_amount[]"]').last().fill('2');
  await expect(page.locator('[data-difference]')).toHaveText('1 F CFA');
  await page.getByRole('button', { name: 'Soumettre pour prévalidation' }).click();
  await expect(page).toHaveURL(/action=create/);
  await expect(page.locator('[data-budget-guidance]')).toContainText('égal au total');
  await page.getByLabel('Date de fin incluse').fill('01/01/2031');
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect(page.getByLabel('Date de fin incluse')).toBeFocused();
  await page.getByLabel('Date de fin incluse').fill('31/12/2032');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('activity-planning-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect(page).toHaveURL(/result=OK/);
  await expect(page.locator('main')).toContainText('Planification VUI04 brouillon');
  const url = new URL(page.url());
  const id = url.searchParams.get('id');
  expect(id).toMatch(/^[1-9][0-9]*$/);
  await page.goto(`/custom/mjlfinancement/activities.php?id=${id}&action=edit`);
  await expect(page.locator('[data-operation-row]')).toHaveCount(2);
  await expect(page.locator('[data-difference]')).toHaveText('1 F CFA');
  await expect(page.locator('[name="project_id"]')).toHaveValue(String(fixture.projects.project));
  await expect(page.locator(`[name="project_id"] option[value="${fixture.projects.project}"]`)).toHaveCount(1);
  await page.locator('[data-operation-row]').last().getByRole('button', { name: 'Retirer' }).click();
  await expect(page.locator('[data-operation-row]')).toHaveCount(1);
  await expect(page.locator('[data-operation-number]')).toHaveText('Opération 1');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);
  await page.goto(`/custom/mjlfinancement/activities.php?id=${id}&action=edit`);
  await expect(page.locator('[data-difference]')).toHaveText('3 F CFA');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  await fillStructure(page, 'Planification VUI04 soumise');
  await page.locator('[name="operation_amount[]"]').fill('9007199254740993');
  await page.getByRole('button', { name: 'Soumettre pour prévalidation' }).click();
  await expect(page).toHaveURL(/result=OK/);
  await expect(page.locator('main')).toContainText('Planification VUI04 soumise');
  await expect(page.locator('main')).toContainText('Soumise');
});

test('narrow no-JavaScript form remains a usable native planning form', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
  try {
    const page = await context.newPage();
    await openForm(page);
    await expect(page.locator('[name="date_start"]')).toBeVisible();
    await expect(page.locator(`[name="project_id"] option[value="${fixture.projects.project}"]`)).toHaveCount(1);
    await expect(page.locator(`[name="project_id"] option[value="${fixture.projects.project2}"]`)).toHaveCount(1);
    await expect(page.locator('[data-operation-row]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('activity-planning-mobile-forced-colors.png'), fullPage: true });
  } finally {
    await context.close();
  }
});
