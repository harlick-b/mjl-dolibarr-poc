const { test, expect } = require('@playwright/test');
const { createActivityFixtureSet } = require('../helpers/activity-fixture');
const { login } = require('../helpers/mjl-test-runtime');

let fixture;
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  fixture = createActivityFixtureSet({
    namespace: 'vui06.review', entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire VUI06' }],
      projects: [{ key: 'project', label: 'Projet VUI06', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type VUI06' }],
    },
    activities: [
      {
        key: 'submitted', agentKey: 'agent', submit: true,
        partnerKey: 'partner', projectKey: 'project',
        name: 'Révision VUI06 à examiner', description: 'Structure immuable pour la revue.',
        dateStart: '2032-01-01', dateEnd: '2032-12-31', authorizedAmount: '300',
        operations: [
          { name: 'Opération revue principale', typeKey: 'type', authorizedAmount: '200' },
          { name: 'Opération revue complémentaire', typeKey: 'type', authorizedAmount: '100' },
        ],
      },
      {
        key: 'cycle', agentKey: 'agent', submit: true,
        partnerKey: 'partner', projectKey: 'project',
        name: 'Cycle de correction VUI06', description: 'Première révision.',
        dateStart: '2033-01-01', dateEnd: '2033-12-31', authorizedAmount: '100',
        operations: [{ name: 'Opération cycle VUI06', typeKey: 'type', authorizedAmount: '100' }],
      },
      {
        key: 'validatorCycle', agentKey: 'agent', submit: true,
        partnerKey: 'partner', projectKey: 'project',
        name: 'Retour validateur VUI06', description: 'Première révision avant retour du Validateur.',
        dateStart: '2034-01-01', dateEnd: '2034-12-31', authorizedAmount: '100',
        operations: [{ name: 'Opération retour validateur', typeKey: 'type', authorizedAmount: '100' }],
      },
      {
        key: 'late', agentKey: 'agent', submit: true,
        partnerKey: 'partner', projectKey: 'project',
        name: 'Validation tardive VUI06', description: 'Révision inchangée après démarrage.',
        dateStart: '2026-09-05', dateEnd: '2032-12-31', authorizedAmount: '100',
        operations: [{ name: 'Opération tardive VUI06', typeKey: 'type', authorizedAmount: '100' }],
      },
    ],
  });
});

async function openReview(page, activityKey, userKey) {
  await login(page, fixture.users[userKey].login, process.env.MJL_TEST_USER_PASSWORD);
  await page.goto(`/custom/mjlfinancement/activities.php?id=${fixture.activities[activityKey].activity_id}&action=review`);
}

test('Supervisor reviews one immutable submitted revision and opens a reasoned correction dialog', async ({ page }, testInfo) => {
  await openReview(page, 'submitted', 'supervisor');
  await expect(page.getByRole('heading', { name: 'Révision 1 à examiner', exact: true })).toBeVisible();
  await expect(page.locator('[data-review-progress]')).toContainText('Soumise');
  await expect(page.getByText('Révision immuable', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Opération revue principale', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prévalider', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retourner en correction', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Modifier', exact: true })).toHaveCount(0);

  const trigger = page.getByRole('link', { name: 'Retourner en correction', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Retourner en correction' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmer le retour' }).click();
  await expect(dialog.getByLabel('Motif de correction')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('review-supervisor.png'), fullPage: true });
  await page.getByRole('button', { name: 'Prévalider', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);
});

test('Validator reviews the same prevalidated revision and reaches a read-only definitive state', async ({ page }, testInfo) => {
  await openReview(page, 'submitted', 'validator');
  await expect(page.locator('[data-review-progress]')).toContainText('Prévalidée');
  await expect(page.getByRole('heading', { name: 'Révision 1 à examiner', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Valider définitivement', exact: true })).toBeVisible();
  const trigger = page.getByRole('link', { name: 'Retourner en correction', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Retourner en correction' });
  await expect(dialog.getByLabel('Montant demandé (facultatif)')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Valider définitivement', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);

  await page.goto('/custom/mjlfinancement/activities.php?id=' + fixture.activities.submitted.activity_id + '&action=review');
  await expect(page.locator('[data-review-progress]')).toContainText('Validée définitivement');
  await expect(page.getByText('Décision indisponible', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Valider définitivement', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Retourner en correction', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('review-definitive-read-only.png'), fullPage: true });
});

test('structural correction produces a new immutable revision and restarts prevalidation', async ({ page }) => {
  await openReview(page, 'cycle', 'supervisor');
  await page.getByRole('link', { name: 'Retourner en correction', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Retourner en correction' });
  await dialog.getByLabel('Motif de correction').fill('Préciser la structure avant validation');
  await dialog.getByRole('button', { name: 'Confirmer le retour' }).click();
  await expect(page).toHaveURL(/result=OK/);
  await page.goto('/custom/mjlfinancement/activities.php?id=' + fixture.activities.cycle.activity_id + '&action=review');
  await expect(page.getByText('Retournée par le superviseur', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-review-progress] [aria-current="step"]')).toHaveCount(0);
  await expect(page.locator('[data-review-progress] .mjl-review-stage-complete')).toHaveCount(1);

  await login(page, fixture.users.agent.login, process.env.MJL_TEST_USER_PASSWORD);
  await page.goto('/custom/mjlfinancement/activities.php?id=' + fixture.activities.cycle.activity_id + '&action=edit');
  await page.locator('[name="description"]').fill('Deuxième révision après correction structurelle.');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);
  await page.getByRole('tab', { name: 'Validation et demandes', exact: true }).click();
  await page.getByRole('button', { name: 'Soumettre la révision', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);

  await openReview(page, 'cycle', 'supervisor');
  await expect(page.getByRole('heading', { name: 'Révision 2 à examiner', exact: true })).toBeVisible();
  await expect(page.getByText('Nouveau cycle de revue', { exact: true })).toBeVisible();
  await expect(page.getByText('Aucune décision enregistrée pour cette révision.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chronologie' })).toContainText('Préciser la structure avant validation');
  await expect(page.getByRole('button', { name: 'Prévalider', exact: true })).toBeVisible();
});

test('Validator return preserves its reason and requested amount through a fresh review cycle', async ({ page }) => {
  await openReview(page, 'validatorCycle', 'supervisor');
  await page.getByRole('button', { name: 'Prévalider', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);

  await openReview(page, 'validatorCycle', 'validator');
  await page.getByRole('link', { name: 'Retourner en correction', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Retourner en correction' });
  await dialog.getByLabel('Motif de correction').fill('Ajuster la structure et réexaminer le budget');
  await dialog.getByLabel('Montant demandé (facultatif)').fill('120');
  await dialog.getByRole('button', { name: 'Confirmer le retour' }).click();
  await expect(page).toHaveURL(/result=OK/);
  await page.goto('/custom/mjlfinancement/activities.php?id=' + fixture.activities.validatorCycle.activity_id + '&action=review');
  await expect(page.getByText('Retournée par le validateur', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-review-progress] [aria-current="step"]')).toHaveCount(0);
  await expect(page.locator('[data-review-progress] .mjl-review-stage-complete')).toHaveCount(2);
  const chronology = page.getByRole('region', { name: 'Chronologie' });
  await expect(chronology).toContainText('Ajuster la structure et réexaminer le budget');
  await expect(chronology).toContainText('Montant demandé : 120 F CFA');

  await login(page, fixture.users.agent.login, process.env.MJL_TEST_USER_PASSWORD);
  await page.goto('/custom/mjlfinancement/activities.php?id=' + fixture.activities.validatorCycle.activity_id + '&action=edit');
  await page.locator('[name="description"]').fill('Deuxième révision après retour du Validateur.');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);
  await page.getByRole('tab', { name: 'Validation et demandes', exact: true }).click();
  await page.getByRole('button', { name: 'Soumettre la révision', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);

  await openReview(page, 'validatorCycle', 'supervisor');
  await expect(page.getByRole('heading', { name: 'Révision 2 à examiner', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Prévalider', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);
  await openReview(page, 'validatorCycle', 'validator');
  await expect(page.getByRole('heading', { name: 'Révision 2 à examiner', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Valider définitivement', exact: true })).toBeVisible();
});

test('late unchanged revision completes review but cannot be returned for structural correction', async ({ page }) => {
  await openReview(page, 'late', 'supervisor');
  await expect(page.getByText('Validation tardive', { exact: true })).toBeVisible();
  await expect(page.getByText(/La révision inchangée peut encore être acceptée/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retourner en correction', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Prévalider', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);

  await openReview(page, 'late', 'validator');
  await expect(page.getByText('Validation tardive', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retourner en correction', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Valider définitivement', exact: true }).click();
  await expect(page).toHaveURL(/result=OK/);
});

test('narrow no-JavaScript review keeps immutable evidence and the correction form usable', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
  try {
    const page = await context.newPage();
    await openReview(page, 'cycle', 'supervisor');
    await expect(page.getByRole('heading', { name: 'Révision 2 à examiner', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Retourner en correction', exact: true })).toBeVisible();
    await expect(page.getByLabel('Motif de correction')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fermer' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('review-mobile-forced-colors.png'), fullPage: true });
  } finally {
    await context.close();
  }
});
