const { test, expect } = require('@playwright/test');
const { createExecutionFixtureSet, runExecutionFixtureCommand } = require('../helpers/execution-fixture');
const { login, scalar } = require('../helpers/mjl-test-runtime');

let fixture;
let activityCancellationRequestId;
let operationCancellationRequestId;
let reopeningRequestId;
let staleRequestId;
test.describe.configure({ mode: 'serial' });

function command(request) {
  return runExecutionFixtureCommand({ entity: 1, localDate: '2026-09-29', ...request });
}

test.beforeAll(() => {
  fixture = createExecutionFixtureSet({
    namespace: 'vui08.exceptions',
    entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire VUI08' }],
      projects: [{ key: 'project', label: 'Projet VUI08', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type VUI08' }],
    },
    activities: [
      {
        key: 'activity-cancel', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project',
        name: 'Annulation Activité VUI08', description: 'Préservation financière contrôlée.',
        dateStart: '2026-09-05', dateEnd: '2032-12-31', authorizedAmount: '200',
        operations: [
          { name: 'Opération terminée préservée VUI08', typeKey: 'type', authorizedAmount: '100' },
          { name: 'Opération active annulée VUI08', typeKey: 'type', authorizedAmount: '100' },
        ],
      },
      {
        key: 'reopen', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project',
        name: 'Réouverture VUI08', description: 'Réouverture contrôlée.',
        dateStart: '2026-09-05', dateEnd: '2032-12-31', authorizedAmount: '100',
        operations: [{ name: 'Opération terminée à rouvrir VUI08', typeKey: 'type', authorizedAmount: '100' }],
      },
      {
        key: 'operation-cancel', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project',
        name: 'Annulation Opération VUI08', description: 'Annulation ciblée et retrait.',
        dateStart: '2026-09-05', dateEnd: '2032-12-31', authorizedAmount: '100',
        operations: [{ name: 'Opération active à annuler VUI08', typeKey: 'type', authorizedAmount: '100' }],
      },
      {
        key: 'cancelled', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project',
        name: 'Annulée VUI08', description: 'Aucune réouverture autorisée.',
        dateStart: '2026-09-05', dateEnd: '2032-12-31', authorizedAmount: '100',
        operations: [{ name: 'Opération annulée verrouillée VUI08', typeKey: 'type', authorizedAmount: '100' }],
      },
      {
        key: 'stale', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project',
        name: 'Demande obsolète VUI08', description: 'Clôture contrôlée.',
        dateStart: '2026-09-05', dateEnd: '2032-12-31', authorizedAmount: '100',
        operations: [{ name: 'Opération demande obsolète VUI08', typeKey: 'type', authorizedAmount: '100' }],
      },
      {
        key: 'fallback', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project',
        name: 'Fallback VUI08', description: 'Formulaire sans JavaScript.',
        dateStart: '2026-09-05', dateEnd: '2032-12-31', authorizedAmount: '100',
        operations: [{ name: 'Opération fallback VUI08', typeKey: 'type', authorizedAmount: '100' }],
      },
    ],
  });

  const cancellation = fixture.activities['activity-cancel'];
  let result = command({
    action: 'update', actorId: fixture.users.agent.id, activityId: cancellation.activity_id,
    operationId: cancellation.operations[0].rowid, expectedVersion: cancellation.operations[0].version,
    input: { status: 'COMPLETED', spent_amount: '80', observation: 'Dépense finale conservée' },
  });
  if (result.code !== 'OK') throw new Error('VUI-08 completed Operation setup failed.');
  result = command({
    action: 'update', actorId: fixture.users.agent.id, activityId: cancellation.activity_id,
    operationId: cancellation.operations[1].rowid, expectedVersion: cancellation.operations[1].version,
    input: { status: 'IN_PROGRESS', spent_amount: '50', observation: 'Dépense active conservée' },
  });
  if (result.code !== 'OK') throw new Error('VUI-08 active Operation setup failed.');

  const reopening = fixture.activities.reopen;
  result = command({
    action: 'update', actorId: fixture.users.agent.id, activityId: reopening.activity_id,
    operationId: reopening.operations[0].rowid, expectedVersion: reopening.operations[0].version,
    input: { status: 'COMPLETED', spent_amount: '75', observation: 'Montant à préserver' },
  });
  if (result.code !== 'OK') throw new Error('VUI-08 reopening setup failed.');

  const operationCancellation = fixture.activities['operation-cancel'];
  result = command({
    action: 'update', actorId: fixture.users.agent.id, activityId: operationCancellation.activity_id,
    operationId: operationCancellation.operations[0].rowid, expectedVersion: operationCancellation.operations[0].version,
    input: { status: 'IN_PROGRESS', spent_amount: '25', observation: 'Montant ciblé conservé' },
  });
  if (result.code !== 'OK') throw new Error('VUI-08 Operation cancellation setup failed.');

  const cancelled = fixture.activities.cancelled;
  const cancelRequest = command({
    action: 'request-cancel', actorId: fixture.users.agent.id, targetType: 'OPERATION',
    targetId: cancelled.operations[0].rowid, expectedVersion: cancelled.operations[0].version,
    reason: 'Annulation définitive de contrôle',
  });
  const cancelDecision = command({
    action: 'decide-cancel', actorId: fixture.users.validator.id,
    requestId: cancelRequest.request_id, expectedVersion: cancelRequest.request_version,
    decision: 'APPROVED', reason: 'Annulation approuvée',
  });
  if (cancelRequest.code !== 'OK' || cancelDecision.code !== 'OK') throw new Error('VUI-08 cancelled Operation setup failed.');

  const stale = fixture.activities.stale;
  const staleRequest = command({
    action: 'request-cancel', actorId: fixture.users.agent.id, targetType: 'OPERATION',
    targetId: stale.operations[0].rowid, expectedVersion: stale.operations[0].version,
    reason: 'Demande rendue obsolète',
  });
  const staleUpdate = command({
    action: 'update', actorId: fixture.users.agent.id, activityId: stale.activity_id,
    operationId: stale.operations[0].rowid, expectedVersion: stale.operations[0].version,
    input: { status: 'IN_PROGRESS', spent_amount: '0', observation: 'Version modifiée' },
  });
  if (staleRequest.code !== 'OK' || staleUpdate.code !== 'OK') throw new Error('VUI-08 stale request setup failed.');
  staleRequestId = staleRequest.request_id;
});

async function signIn(page, key) {
  await login(page, fixture.users[key].login, process.env.MJL_TEST_USER_PASSWORD);
}

test('Agent uses the shared dialog for Activity cancellation and Operation reopening without duplicated forms', async ({ page }, testInfo) => {
  await signIn(page, 'agent');
  const activity = fixture.activities['activity-cancel'];
  await page.goto('/custom/mjlfinancement/activities.php?id=' + activity.activity_id);
  await page.getByRole('tab', { name: 'Validation et demandes', exact: true }).click();

  const activityForms = page.locator('form').filter({ has: page.locator('input[name="action"][value="request_cancellation"]') });
  await expect(activityForms).toHaveCount(1);
  await page.getByRole('link', { name: 'Demander l’annulation', exact: true }).click();
  const activityDialog = page.getByRole('dialog', { name: 'Demander l’annulation de l’Activité' });
  await expect(activityDialog).toBeVisible();
  await expect(activityDialog).toContainText('Les montants autorisés et dépensés restent conservés');
  await expect(activityForms).toHaveCount(1);
  const activityReason = activityDialog.getByLabel('Motif de la demande d’annulation');
  await activityReason.fill('Arrêt justifié de l’Activité VUI08');
  await page.keyboard.press('Escape');
  await expect(activityDialog).toBeHidden();
  await expect(page.getByRole('link', { name: 'Demander l’annulation', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Demander l’annulation', exact: true }).click();
  await expect(activityDialog.getByLabel('Motif de la demande d’annulation')).toHaveValue('Arrêt justifié de l’Activité VUI08');
  await activityDialog.getByRole('button', { name: 'Demander l’annulation', exact: true }).click();
  await expect(page.getByText('Opération enregistrée', { exact: true })).toBeVisible();
  activityCancellationRequestId = scalar(`SELECT rowid FROM llx_mjlfinancement_cancellation_request WHERE target_type='ACTIVITY' AND target_id=${activity.activity_id} AND status='PENDING'`);

  const operationCancellation = fixture.activities['operation-cancel'];
  await page.goto('/custom/mjlfinancement/operations.php?activity_id=' + operationCancellation.activity_id);
  const operationCancellationForms = page.locator('form').filter({ has: page.locator('input[name="action"][value="request_cancellation"]') });
  await expect(operationCancellationForms).toHaveCount(1);
  await page.getByRole('link', { name: 'Demander l’annulation', exact: true }).click();
  const operationCancellationDialog = page.getByRole('dialog', { name: 'Demander l’annulation de l’Opération' });
  await expect(operationCancellationDialog).toContainText('Les montants autorisés et dépensés restent conservés');
  await operationCancellationDialog.getByLabel('Motif de la demande d’annulation').fill('Première demande à retirer');
  await operationCancellationDialog.getByRole('button', { name: 'Demander l’annulation', exact: true }).click();
  await expect(page.getByText('Action enregistrée', { exact: true })).toBeVisible();
  const withdrawnRequestId = scalar(`SELECT rowid FROM llx_mjlfinancement_cancellation_request WHERE target_type='OPERATION' AND target_id=${operationCancellation.operations[0].rowid} AND status='PENDING'`);

  await page.goto('/custom/mjlfinancement/operationrequests.php?type=CANCELLATION&request_id=' + withdrawnRequestId);
  await page.getByRole('link', { name: 'Retirer la demande', exact: true }).click();
  const withdrawalDialog = page.getByRole('dialog', { name: 'Retirer la demande d’annulation' });
  await expect(withdrawalDialog.getByRole('button', { name: 'Retirer la demande', exact: true })).toBeFocused();
  await withdrawalDialog.getByRole('button', { name: 'Retirer la demande', exact: true }).click();
  await expect(page.getByText('Décision enregistrée', { exact: true })).toBeVisible();
  expect(scalar(`SELECT status FROM llx_mjlfinancement_cancellation_request WHERE rowid=${withdrawnRequestId}`)).toBe('WITHDRAWN');

  await page.goto('/custom/mjlfinancement/operations.php?activity_id=' + operationCancellation.activity_id);
  await page.getByRole('link', { name: 'Demander l’annulation', exact: true }).click();
  const secondCancellationDialog = page.getByRole('dialog', { name: 'Demander l’annulation de l’Opération' });
  await secondCancellationDialog.getByLabel('Motif de la demande d’annulation').fill('Annulation ciblée à décider');
  await secondCancellationDialog.getByRole('button', { name: 'Demander l’annulation', exact: true }).click();
  operationCancellationRequestId = scalar(`SELECT rowid FROM llx_mjlfinancement_cancellation_request WHERE target_type='OPERATION' AND target_id=${operationCancellation.operations[0].rowid} AND status='PENDING'`);

  const reopening = fixture.activities.reopen;
  await page.goto('/custom/mjlfinancement/operations.php?activity_id=' + reopening.activity_id);
  const reopenForms = page.locator('form').filter({ has: page.locator('input[name="action"][value="request_reopening"]') });
  await expect(reopenForms).toHaveCount(1);
  await page.getByRole('link', { name: 'Demander la réouverture', exact: true }).click();
  const reopenDialog = page.getByRole('dialog', { name: 'Demander la réouverture de l’Opération' });
  await expect(reopenDialog).toContainText('revient à « En cours »');
  await expect(reopenForms).toHaveCount(1);
  await reopenDialog.getByLabel('Motif de la demande de réouverture').fill('Correction nécessaire après clôture');
  await reopenDialog.getByRole('button', { name: 'Demander la réouverture', exact: true }).click();
  await expect(page.getByText('Action enregistrée', { exact: true })).toBeVisible();
  reopeningRequestId = scalar(`SELECT rowid FROM llx_mjlfinancement_reopening_request WHERE fk_operation=${reopening.operations[0].rowid} AND status='PENDING'`);

  const cancelled = fixture.activities.cancelled;
  await page.goto('/custom/mjlfinancement/operations.php?activity_id=' + cancelled.activity_id);
  await expect(page.getByRole('link', { name: 'Demander la réouverture', exact: true })).toHaveCount(0);
  await expect(page.getByText('Cette Opération est annulée et verrouillée.', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('exception-agent-dialogs.png'), fullPage: true });
});

test('Validator decisions preserve financial facts, completed Operations, and derived execution status', async ({ page }, testInfo) => {
  await signIn(page, 'validator');

  await page.goto('/custom/mjlfinancement/operationrequests.php?type=CANCELLATION&request_id=' + activityCancellationRequestId);
  const cancellationCard = page.locator('article').filter({ hasText: 'Arrêt justifié de l’Activité VUI08' });
  await expect(cancellationCard).toContainText('En attente');
  await cancellationCard.getByRole('link', { name: 'Approuver', exact: true }).click();
  const cancellationDialog = page.getByRole('dialog', { name: 'Approuver la demande d’annulation' });
  await expect(cancellationDialog).toContainText('ne réécrit pas une Opération déjà terminée');
  await cancellationDialog.getByLabel('Motif de décision').fill('Fermeture validée avec conservation des montants');
  await cancellationDialog.getByRole('button', { name: 'Approuver', exact: true }).click();
  await expect(page.getByText('Décision enregistrée', { exact: true })).toBeVisible();

  const activity = fixture.activities['activity-cancel'];
  expect(scalar(`SELECT CONCAT(is_cancelled,'|',draft_authorized_amount) FROM llx_mjlfinancement_activity WHERE rowid=${activity.activity_id}`)).toBe('1|200');
  expect(scalar(`SELECT GROUP_CONCAT(CONCAT(status,':',spent_amount,':',authorized_amount) ORDER BY rowid SEPARATOR '|') FROM llx_mjlfinancement_operation WHERE fk_activity=${activity.activity_id}`)).toBe('COMPLETED:80:100|CANCELLED:50:100');

  await page.goto('/custom/mjlfinancement/operationrequests.php?type=CANCELLATION&request_id=' + operationCancellationRequestId);
  const operationCancellationCard = page.locator('article').filter({ hasText: 'Annulation ciblée à décider' });
  await operationCancellationCard.getByRole('link', { name: 'Approuver', exact: true }).click();
  const operationDecisionDialog = page.getByRole('dialog', { name: 'Approuver la demande d’annulation' });
  await expect(operationDecisionDialog).toContainText('ne réécrit pas une Opération déjà terminée');
  await operationDecisionDialog.getByLabel('Motif de décision').fill('Annulation ciblée approuvée');
  await operationDecisionDialog.getByRole('button', { name: 'Approuver', exact: true }).click();
  const operationCancellation = fixture.activities['operation-cancel'];
  expect(scalar(`SELECT CONCAT(status,'|',spent_amount,'|',authorized_amount) FROM llx_mjlfinancement_operation WHERE rowid=${operationCancellation.operations[0].rowid}`)).toBe('CANCELLED|25|100');

  await page.goto('/custom/mjlfinancement/operationrequests.php?type=REOPENING&request_id=' + reopeningRequestId);
  const reopeningCard = page.locator('article').filter({ hasText: 'Correction nécessaire après clôture' });
  await reopeningCard.getByRole('link', { name: 'Approuver', exact: true }).click();
  const reopeningDialog = page.getByRole('dialog', { name: 'Approuver la demande de réouverture' });
  await reopeningDialog.getByLabel('Motif de décision').fill('Réouverture approuvée pour correction');
  await reopeningDialog.getByRole('button', { name: 'Approuver', exact: true }).click();
  await expect(page.getByText('Décision enregistrée', { exact: true })).toBeVisible();

  const reopening = fixture.activities.reopen;
  expect(scalar(`SELECT CONCAT(status,'|',spent_amount,'|',authorized_amount) FROM llx_mjlfinancement_operation WHERE rowid=${reopening.operations[0].rowid}`)).toBe('IN_PROGRESS|75|100');
  await page.goto('/custom/mjlfinancement/activities.php?id=' + reopening.activity_id);
  await expect(page.locator('.mjl-activity-statusline')).toContainText('En cours');

  await page.goto('/custom/mjlfinancement/operationrequests.php?type=CANCELLATION&request_id=' + staleRequestId);
  await expect(page.getByText('À clôturer', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Approuver', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Rejeter', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('exception-validator-decisions.png'), fullPage: true });

  await signIn(page, 'supervisor');
  await page.goto('/custom/mjlfinancement/operationrequests.php?type=CANCELLATION&request_id=' + staleRequestId);
  await expect(page.getByRole('link', { name: /Approuver|Rejeter/ })).toHaveCount(0);
  await expect(page.locator('form[method="POST"]')).toHaveCount(0);

  await signIn(page, 'validator');
  await page.goto('/custom/mjlfinancement/operationrequests.php?type=CANCELLATION&request_id=' + staleRequestId);
  await page.getByRole('link', { name: 'Rejeter', exact: true }).click();
  const rejectionDialog = page.getByRole('dialog', { name: 'Rejeter la demande d’annulation' });
  await rejectionDialog.getByLabel('Motif de décision').fill('Demande obsolète clôturée');
  await rejectionDialog.getByRole('button', { name: 'Rejeter', exact: true }).click();
  await expect(page.getByText('Décision enregistrée', { exact: true })).toBeVisible();
  expect(scalar(`SELECT status FROM llx_mjlfinancement_cancellation_request WHERE rowid=${staleRequestId}`)).toBe('REJECTED');
});

test('narrow no-JavaScript mode keeps the guarded Activity cancellation form available', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
  try {
    const page = await context.newPage();
    await signIn(page, 'agent');
    const fallback = fixture.activities.fallback;
    await page.goto('/custom/mjlfinancement/activities.php?id=' + fallback.activity_id + '#mjl-activity-decisions');
    const form = page.locator('form').filter({ has: page.locator('input[name="action"][value="request_cancellation"]') });
    await expect(form).toBeVisible();
    await expect(form.getByLabel('Motif de la demande d’annulation')).toBeVisible();
    const hiddenTrigger = page.getByRole('link', { name: 'Demander l’annulation', exact: true, includeHidden: true });
    await expect(hiddenTrigger).toHaveCount(1);
    await expect(hiddenTrigger).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('exception-no-js-mobile.png'), fullPage: true });
  } finally {
    await context.close();
  }
});


test('narrow forced-colors mode opens and closes the live exception dialog without overflow', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' });
  try {
    const page = await context.newPage();
    await signIn(page, 'agent');
    const fallback = fixture.activities.fallback;
    await page.goto('/custom/mjlfinancement/activities.php?id=' + fallback.activity_id);
    await page.getByRole('tab', { name: 'Validation et demandes', exact: true }).click();
    const trigger = page.getByRole('link', { name: 'Demander l’annulation', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Demander l’annulation de l’Activité' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/mjl-dialog-enhanced/);
    await expect(dialog.getByLabel('Motif de la demande d’annulation')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('exception-dialog-mobile-forced-colors.png'), fullPage: true });
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  } finally {
    await context.close();
  }
});
