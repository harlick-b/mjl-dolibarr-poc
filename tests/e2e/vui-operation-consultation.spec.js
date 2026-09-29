const { test, expect } = require('@playwright/test');
const { createExecutionFixtureSet, runExecutionFixtureCommand } = require('../helpers/execution-fixture');
const { login } = require('../helpers/mjl-test-runtime');

let fixture;
const longOperationName = 'Opération non renseignée VUI07 ' + 'X'.repeat(180);
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  fixture = createExecutionFixtureSet({
    namespace: 'vui07.operation', entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire VUI07' }],
      projects: [{ key: 'project', label: 'Projet VUI07', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type VUI07' }],
    },
    activities: [{
      key: 'consultation', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project',
      name: 'Consultation VUI07', description: 'Consultation contextuelle des Opérations.',
      dateStart: '2026-09-05', dateEnd: '2032-12-31', authorizedAmount: '400',
      operations: [
        { name: 'Opération suivie VUI07', typeKey: 'type', authorizedAmount: '200' },
        { name: longOperationName, typeKey: 'type', authorizedAmount: '100' },
        { name: 'Opération à zéro VUI07', typeKey: 'type', authorizedAmount: '100' },
      ],
    }],
  });
  const activity = fixture.activities.consultation;
  const operation = activity.operations[0];
  const result = runExecutionFixtureCommand({
    entity: 1, localDate: '2026-09-29', action: 'update',
    actorId: fixture.users.agent.id, activityId: activity.activity_id,
    operationId: operation.rowid, expectedVersion: operation.version,
    input: { status: 'IN_PROGRESS', spent_amount: '125', observation: 'Mission réalisée\nJustificatifs contrôlés' },
  });
  if (result.code !== 'OK') throw new Error('VUI-07 execution fixture update failed.');
  const zeroOperation = activity.operations[2];
  const zeroResult = runExecutionFixtureCommand({
    entity: 1, localDate: '2026-09-29', action: 'update',
    actorId: fixture.users.agent.id, activityId: activity.activity_id,
    operationId: zeroOperation.rowid, expectedVersion: zeroOperation.version,
    input: { status: 'IN_PROGRESS', spent_amount: '0', observation: 'Aucune dépense engagée' },
  });
  if (zeroResult.code !== 'OK') throw new Error('VUI-07 zero execution fixture update failed.');
});

async function openActivity(page, userKey) {
  await login(page, fixture.users[userKey].login, process.env.MJL_TEST_USER_PASSWORD);
  await page.goto('/custom/mjlfinancement/activities.php?id=' + fixture.activities.consultation.activity_id);
  const tab = page.getByRole('tab', { name: /Opérations \(3\)/ });
  if (await tab.count()) await tab.click();
}

test('assigned Agent consults exact Operation facts in a read-only drawer and reaches existing execution', async ({ page }, testInfo) => {
  await openActivity(page, 'agent');
  const row = page.getByRole('row').filter({ hasText: 'Opération suivie VUI07' });
  const trigger = row.getByRole('link', { name: 'Consulter', exact: true });
  await trigger.click();

  const drawer = page.getByRole('dialog', { name: 'Opération suivie VUI07' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Consultation VUI07', { exact: true })).toBeVisible();
  await expect(drawer.getByText('En cours', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Montant autorisé validé', { exact: true }).locator('..')).toContainText('200 F CFA');
  await expect(drawer.getByText('Montant dépensé', { exact: true }).locator('..')).toContainText('125 F CFA');
  await expect(drawer.getByText('Écart', { exact: true }).locator('..')).toContainText('-75 F CFA');
  await expect(drawer.getByText('Variance', { exact: true }).locator('..')).toContainText('-37,50 %');
  await expect(drawer).toContainText('Mission réalisée\nJustificatifs contrôlés');
  await expect(drawer.locator('form, input, select, textarea')).toHaveCount(0);
  await expect(drawer.getByRole('link', { name: 'Renseigner l’exécution', exact: true })).toHaveAttribute('href', /operations\.php\?activity_id=\d+#operation-\d+$/);
  await page.screenshot({ path: testInfo.outputPath('operation-drawer-agent.png'), fullPage: true });

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Supervisor reuses the drawer from the Activity list without receiving an execution action', async ({ page }) => {
  await login(page, fixture.users.supervisor.login, process.env.MJL_TEST_USER_PASSWORD);
  await page.goto('/custom/mjlfinancement/activities.php?q=Consultation%20VUI07');
  const activity = page.locator('[data-activity="' + fixture.activities.consultation.activity_id + '"]');
  const expansion = activity.locator('xpath=following-sibling::tr[1]');
  await expansion.locator('summary').click();
  await expansion.getByRole('link', { name: 'Consulter', exact: true }).first().click();

  const drawer = page.getByRole('dialog', { name: 'Opération suivie VUI07' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Type VUI07', { exact: false })).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'Renseigner l’exécution', exact: true })).toHaveCount(0);
  await expect(drawer.locator('form')).toHaveCount(0);
});

test('narrow forced-colors drawer preserves missing and explicit-zero facts without overflow', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
  try {
    const page = await context.newPage();
    await openActivity(page, 'agent');

    const missingRow = page.getByRole('row').filter({ hasText: longOperationName });
    const missingTrigger = missingRow.getByRole('link', { name: 'Consulter', exact: true });
    await missingTrigger.click();
    const drawer = page.getByRole('dialog', { name: longOperationName });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Montant dépensé', { exact: true }).locator('..')).toContainText('Non renseigné');
    await expect(drawer.getByText('Écart', { exact: true }).locator('..')).toContainText('Non renseigné');
    await expect(drawer.getByText('Variance', { exact: true }).locator('..')).toContainText('Non renseigné');
    await expect(drawer.getByRole('link', { name: 'Renseigner l’exécution', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await drawer.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(missingTrigger).toBeFocused();

    const zeroRow = page.getByRole('row').filter({ hasText: 'Opération à zéro VUI07' });
    const zeroTrigger = zeroRow.getByRole('link', { name: 'Consulter', exact: true });
    await zeroTrigger.click();
    const zeroDrawer = page.getByRole('dialog', { name: 'Opération à zéro VUI07' });
    await expect(zeroDrawer.getByText('Montant dépensé', { exact: true }).locator('..')).toContainText('0 F CFA');
    await expect(zeroDrawer.getByText('Écart', { exact: true }).locator('..')).toContainText('-100 F CFA');
    await expect(zeroDrawer.getByText('Variance', { exact: true }).locator('..')).toContainText('-100,00 %');
    await page.screenshot({ path: testInfo.outputPath('operation-drawer-mobile-forced-colors.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(zeroDrawer).toBeHidden();
    await expect(zeroTrigger).toBeFocused();
  } finally {
    await context.close();
  }
});

test('narrow no-JavaScript consultation keeps ordinary navigation to the guarded execution route', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
  try {
    const page = await context.newPage();
    await openActivity(page, 'agent');
    const row = page.getByRole('row').filter({ hasText: 'Opération suivie VUI07' });
    const link = row.getByRole('link', { name: 'Consulter', exact: true });
    await expect(link).toHaveAttribute('href', /operations\.php\?activity_id=\d+#operation-\d+$/);
    await link.click();
    await expect(page).toHaveURL(/operations\.php\?activity_id=\d+#operation-\d+$/);
    const card = page.locator('article.mjl-operation-card').filter({ hasText: 'Opération suivie VUI07' });
    await expect(card.getByRole('button', { name: 'Enregistrer l’exécution' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('operation-fallback-mobile.png'), fullPage: true });
  } finally {
    await context.close();
  }
});
