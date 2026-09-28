const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { createExecutionFixtureSet, runExecutionFixtureCommand } = require('../helpers/execution-fixture');
const { login } = require('../helpers/mjl-test-runtime');

let fixture;

test.beforeAll(() => {
  execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/report-fixture.php', 'install'], { env: process.env, stdio: 'pipe' });
  fixture = createExecutionFixtureSet({
    namespace: 'vui03.list', entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'other', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire VUI03' }],
      projects: [{ key: 'project', label: 'Projet VUI03', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type VUI03' }],
    },
    activities: [
      { key: 'owned', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Liste VUI03 validée', description: 'Suivi de liste.', dateStart: '2026-09-05', dateEnd: '2032-09-30', authorizedAmount: '100', operations: [{ name: 'Première Opération', typeKey: 'type', authorizedAmount: '60' }, { name: 'Seconde Opération', typeKey: 'type', authorizedAmount: '40' }] },
      { key: 'pending', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Liste VUI03 proposée', description: 'Suivi de liste.', dateStart: '2032-09-05', dateEnd: '2032-09-30', authorizedAmount: '50', finalize: false, operations: [{ name: 'Opération proposée', typeKey: 'type', authorizedAmount: '50' }] },
      { key: 'hidden', agentKey: 'other', partnerKey: 'partner', projectKey: 'project', name: 'Liste VUI03 autre Agent', description: 'Suivi de liste.', dateStart: '2026-09-05', dateEnd: '2032-09-30', authorizedAmount: '900', operations: [{ name: 'Opération autre', typeKey: 'type', authorizedAmount: '900' }] },
    ],
  });
  const operation = fixture.activities.owned.operations[0];
  const result = runExecutionFixtureCommand({ entity: 1, localDate: '2026-09-10', action: 'update', actorId: fixture.users.agent.id, activityId: fixture.activities.owned.activity_id, operationId: operation.rowid, expectedVersion: operation.version, input: { status: 'IN_PROGRESS', spent_amount: '0', observation: 'Dépense nulle\nMontant confirmé' } });
  expect(result.code).toBe('OK');
});

async function signIn(page, key) {
  await login(page, fixture.users[key].login, process.env.MJL_TEST_USER_PASSWORD);
}

test('assigned Agent sees separate states, partial spending, and guarded read-only Operations', async ({ page }, testInfo) => {
  await signIn(page, 'agent');
  await page.goto('/custom/mjlfinancement/activities.php?q=Liste%20VUI03');
  await expect(page.locator('.mjl-form-grid')).toHaveCSS('display', 'grid');
  await expect(page.locator('[data-activity]')).toHaveCount(2);
  await expect(page.locator('.mjl-activity-list-heading')).toContainText('2 Activités dans la sélection');
  await expect(page.locator('.mjl-activity-filter-details')).toHaveAttribute('open', '');
  const validated = page.locator(`[data-activity="${fixture.activities.owned.activity_id}"]`);
  await expect(validated).toContainText('Validée définitivement');
  await expect(validated).toContainText('En cours');
  await expect(validated).toContainText('Dépenses partielles');
  await expect(validated).toContainText('0 F CFA');
  await expect(validated).toContainText('1 / 2 Opérations renseignées');
  const proposed = page.locator(`[data-activity="${fixture.activities.pending.activity_id}"]`);
  await expect(proposed).toContainText('Proposé');
  await expect(proposed).toContainText('Non renseigné');
  await expect(page.locator('main')).not.toContainText('Liste VUI03 autre Agent');
  const expansion = validated.locator('xpath=following-sibling::tr[1]');
  await expansion.locator('summary').click();
  await expect(expansion).toContainText('Première Opération');
  expect(await expansion.locator('.mjl-activity-observation').first().textContent()).toBe('Dépense nulle\nMontant confirmé');
  const operationLink = expansion.getByRole('link', { name: 'Consulter' }).first();
  await expect(operationLink).toHaveAttribute('href', /operations\.php\?activity_id=\d+#operation-\d+$/);
  await page.screenshot({ path: testInfo.outputPath('activities-list-desktop.png'), fullPage: true });
});

test('supported filters, exact counts, pagination, reset, and browser back stay aligned', async ({ page }) => {
  await signIn(page, 'supervisor');
  await page.goto('/custom/mjlfinancement/activities.php?q=Liste%20VUI03');
  await expect(page.locator('[data-activity]')).toHaveCount(3);
  await expect(page.locator('.mjl-activity-list-heading')).toContainText('3 Activités dans la sélection');
  await page.getByLabel('État de validation').selectOption('FINAL_VALIDATED');
  await page.getByRole('button', { name: 'Appliquer les filtres' }).click();
  await expect(page.locator('[data-activity]')).toHaveCount(2);
  await expect(page.locator('.mjl-activity-filter-details')).toContainText('Filtres (2)');
  expect(new URL(page.url()).searchParams.get('validation_status')).toBe('FINAL_VALIDATED');
  await page.goto('/custom/mjlfinancement/activities.php?q=Liste%20VUI03&page=2');
  await expect(page.locator('[data-activity]')).toHaveCount(0);
  await expect(page.locator('.mjl-activity-list-heading')).toContainText('Résultats 0–0 sur 3');
  await page.getByRole('navigation', { name: 'Pagination des Activités' }).getByRole('link', { name: 'Précédent' }).click();
  await expect(page.locator('[data-activity]')).toHaveCount(3);
  expect(new URL(page.url()).searchParams.get('q')).toBe('Liste VUI03');
  await page.goBack();
  await expect(page.locator('[data-activity]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Réinitialiser' }).click();
  expect(new URL(page.url()).searchParams.get('q')).toBe(null);
});


test('narrow no-JavaScript list reflows and expands Operations', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
  try {
    const page = await context.newPage();
    await signIn(page, 'agent');
    await page.goto('/custom/mjlfinancement/activities.php?q=Liste%20VUI03');
    await expect(page.locator('[data-activity]')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const expansion = page.locator(`[data-activity="${fixture.activities.owned.activity_id}"]`).locator('xpath=following-sibling::tr[1]');
    await expansion.locator('summary').click();
    await expect(expansion).toContainText('Première Opération');
    await page.screenshot({ path: testInfo.outputPath('activities-list-mobile-forced-colors.png'), fullPage: true });
  } finally {
    await context.close();
  }
});
