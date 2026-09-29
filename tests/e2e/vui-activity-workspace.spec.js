const { test, expect } = require('@playwright/test');
const { createExecutionFixtureSet } = require('../helpers/execution-fixture');
const { login } = require('../helpers/mjl-test-runtime');

let fixture;
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  fixture = createExecutionFixtureSet({
    namespace: 'vui05.workspace', entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'additional', role: 'AGENT_SAISIE' },
      { key: 'replacement', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire VUI05' }],
      projects: [{ key: 'project', label: 'Projet VUI05', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type VUI05' }],
    },
    activities: [{
      key: 'workspace', agentKey: 'agent', additionalAgentKeys: ['additional'],
      partnerKey: 'partner', projectKey: 'project',
      name: 'Espace Activité VUI05', description: 'Contexte central de l’Activité.',
      dateStart: '2026-09-05', dateEnd: '2026-10-31', authorizedAmount: '300',
      operations: [
        { name: 'Opération principale VUI05', typeKey: 'type', authorizedAmount: '200' },
        { name: 'Opération complémentaire VUI05', typeKey: 'type', authorizedAmount: '100' },
      ],
    }],
  });
});

async function openWorkspace(page, userKey = 'validator') {
  await login(page, fixture.users[userKey].login, process.env.MJL_TEST_USER_PASSWORD);
  await page.goto(`/custom/mjlfinancement/activities.php?id=${fixture.activities.workspace.activity_id}`);
}

test('Activity workspace groups financial facts, assignments and Operations behind accessible tabs', async ({ page }, testInfo) => {
  await openWorkspace(page);
  await expect(page.getByRole('heading', { name: 'Espace Activité VUI05', exact: false })).toBeVisible();
  await expect(page.locator('[data-activity-financial-strip]')).toContainText('Montant autorisé validé');
  await expect(page.locator('[data-activity-financial-strip]')).toContainText('Complétude financière');
  await expect(page.getByRole('tab', { name: 'Vue d’ensemble' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.mjl-assignment-list').getByText('Agent Fixture', { exact: true })).toBeVisible();
  await expect(page.locator('.mjl-assignment-list').getByText('Additional Fixture', { exact: true })).toBeVisible();

  const overviewTab = page.getByRole('tab', { name: 'Vue d’ensemble' });
  await overviewTab.focus();
  await overviewTab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Opérations \(2\)/ })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Opérations', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Consulter les Opérations' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Opération principale VUI05', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Opération complémentaire VUI05', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Validation et demandes' }).click();
  await expect(page.getByText('Modification réservée', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Vue d’ensemble' }).click();
  await page.screenshot({ path: testInfo.outputPath('activity-workspace-desktop.png'), fullPage: true });

  await openWorkspace(page, 'agent');
  await expect(page.getByRole('link', { name: 'Gérer les affectations' })).toHaveCount(0);
  await expect(page.locator('#mjl-assignment-dialog')).toHaveCount(0);
});

test('Validator performs one existing assignment action through the modal with a required reason', async ({ page }) => {
  await openWorkspace(page);
  const trigger = page.getByRole('link', { name: 'Gérer les affectations' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Gérer les affectations' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel('Opération d’affectation').selectOption('ADD_ADDITIONAL');
  await expect(dialog.getByLabel('Agent concerné').locator('option[value="' + fixture.users.agent.id + '"]')).toHaveCount(0);
  await dialog.getByLabel('Agent concerné').selectOption(String(fixture.users.replacement.id));
  await dialog.getByRole('button', { name: 'Modifier l’affectation' }).click();
  await expect(dialog.getByLabel('Motif')).toBeFocused();
  await dialog.getByLabel('Motif').fill('Renfort temporaire pour la mise en œuvre');
  await dialog.getByRole('button', { name: 'Modifier l’affectation' }).click();
  await expect(page).toHaveURL(/result=OK/);
  await expect(page.locator('.mjl-assignment-list').getByText('Replacement Fixture', { exact: true })).toBeVisible();
});

test('narrow no-JavaScript workspace keeps all sections and the assignment form usable', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
  try {
    const page = await context.newPage();
    await openWorkspace(page);
    await expect(page.getByRole('heading', { name: 'Opérations', exact: true })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Opérations \(2\)/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gérer les affectations', exact: true })).toBeVisible();
    await expect(page.getByLabel('Motif')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('activity-workspace-mobile-forced-colors.png'), fullPage: true });
  } finally {
    await context.close();
  }
});
