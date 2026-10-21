const { test, expect } = require('@playwright/test');
const { createExecutionFixtureSet, runExecutionFixtureCommand } = require('../helpers/execution-fixture');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { scalar, sql, composeExec, registerSecret } = require('../helpers/mjl-test-runtime');

let fixture;
let activity;
let operation;
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  fixture = createExecutionFixtureSet({
    namespace: 'spending.' + Date.now().toString(36), entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' }, { key: 'outsider', role: 'AGENT_SAISIE' },
      { key: 'career', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire dépenses' }],
      projects: [{ key: 'project', label: 'Projet dépenses', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type dépenses' }],
    },
    activities: [{
      key: 'expenses', agentKey: 'agent', additionalAgentKeys: ['career', 'outsider'], partnerKey: 'partner', projectKey: 'project',
      name: 'Dépenses approuvées', description: 'Écritures distinctes et corrections.',
      dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '300',
      operations: [{ name: 'Opération dépenses', typeKey: 'type', authorizedAmount: '100' }, { name: 'Opération zéro', typeKey: 'type', authorizedAmount: '100' }, { name: 'Opération contrôle', typeKey: 'type', authorizedAmount: '100' }],
    }],
  });
  activity = fixture.activities.expenses;
  operation = activity.operations[0];
  sql(`UPDATE llx_mjlfinancement_activity_assignment SET date_end=NOW() WHERE entity=1 AND fk_activity=${activity.activity_id} AND fk_user=${fixture.users.outsider.id} AND date_end IS NULL`);
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_OTP_ENABLED',1,'1','chaine',0,'Disposable API verification'),('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'Disposable API verification') ON DUPLICATE KEY UPDATE value='1'");
});

async function login(page, key) {
  await page.context().clearCookies();
  const session = await (await page.request.get('/custom/mjlfinancement/api/index.php/v1/auth/session')).json();
  const response = await page.request.post('/custom/mjlfinancement/api/index.php/v1/auth/login', { data: { email: fixture.users[key].login + '@example.test', password: process.env.MJL_TEST_USER_PASSWORD }, headers: { 'X-CSRF-Token': session.data.csrf_token } });
  expect([200, 202]).toContain(response.status());
  if (response.status() === 202) {
    const code = JSON.parse(composeExec('dolibarr', ['cat', '/var/www/documents/mjlfinancement/email-test-outbox/latest-login_otp.json'], 'utf8')).code;
    await registerSecret('login otp', code);
    const pending = await (await page.request.get('/custom/mjlfinancement/api/index.php/v1/auth/session')).json();
    expect((await page.request.post('/custom/mjlfinancement/api/index.php/v1/auth/otp/verify', { data: { code }, headers: { 'X-CSRF-Token': pending.data.csrf_token } })).status()).toBe(200);
  }
}

test('an expense needs independent approval before it affects totals or permits completion', async ({ page }) => {
  await login(page, 'agent');
  const response = await page.goto(`/custom/mjlfinancement/expenses.php?operation_id=${operation.rowid}`);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Dépenses de l’Opération' })).toBeVisible();
  await page.getByLabel('Libellé de la dépense').fill('Transport');
  await page.getByLabel('Date de la dépense').fill('2026-09-05');
  await page.getByLabel('Montant (F CFA)').fill('60');
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  expect(scalar(`SELECT spent_amount IS NULL FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('1');
  await page.getByRole('button', { name: 'Soumettre', exact: true }).click();
  const version = scalar(`SELECT version FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`);
  expect(runExecutionFixtureCommand({
    entity: 1, action: 'update', actorId: fixture.users.agent.id,
    activityId: activity.activity_id, operationId: operation.rowid, expectedVersion: version,
    input: { status: 'COMPLETED', observation: 'Économie réalisée.' },
  }).code).toBe('CONFLICT');
  await login(page, 'validator');
  await page.goto(`/custom/mjlfinancement/expenses.php?operation_id=${operation.rowid}`);
  await page.getByRole('button', { name: 'Approuver', exact: true }).click();
  expect(scalar(`SELECT spent_amount FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('60');
  await expect(page.getByText('Approuvée', { exact: true })).toBeVisible();
});

const command = (request) => runExecutionFixtureCommand({ entity: 1, ...request });
const operationVersion = (id) => scalar(`SELECT version FROM llx_mjlfinancement_operation WHERE rowid=${id}`);
const expenseVersion = (id) => scalar(`SELECT version FROM llx_mjlfinancement_expense WHERE rowid=${id}`);
function save(op, amount, author = 'agent', original = null) {
  return command({ action: 'expense-save', actorId: fixture.users[author].id, operationId: op.rowid,
    expenseId: '0', expectedVersion: operationVersion(op.rowid),
    input: { label: amount === '0' ? 'Aucune dépense' : 'Dépense de contrôle', expense_date: '2026-09-05', amount, original_id: original, reason: original ? 'Correction documentée du montant' : null } });
}
function transition(op, id, decision, actor = 'agent', reason = '') {
  return command({ action: 'expense-transition', actorId: fixture.users[actor].id, operationId: op.rowid, expenseId: String(id), expectedVersion: expenseVersion(id), decision, reason });
}
function complete(op, observation) {
  return command({ action: 'update', actorId: fixture.users.agent.id, activityId: activity.activity_id, operationId: op.rowid, expectedVersion: operationVersion(op.rowid), input: { status: 'COMPLETED', observation } });
}

test('a completed Operation keeps its status while a linked correction changes only approved totals', async ({ page }) => {
  expect(complete(operation, null).code).toBe('CONFLICT');
  expect(complete(operation, 'Économie sur le transport.').code).toBe('OK');
  const original = scalar(`SELECT rowid FROM llx_mjlfinancement_expense WHERE fk_operation=${operation.rowid} AND status='APPROVED'`);
  await login(page, 'agent');
  await page.goto(`/custom/mjlfinancement/expenses.php?operation_id=${operation.rowid}`);
  await page.getByText('Demander une correction', { exact: true }).click();
  await page.getByLabel('Montant (F CFA)').fill('80');
  await page.getByLabel('Motif de correction').fill('Facture corrigée après rapprochement.');
  await page.getByRole('button', { name: 'Enregistrer la correction' }).click();
  await page.getByRole('button', { name: 'Soumettre', exact: true }).click();
  const replacement = scalar(`SELECT rowid FROM llx_mjlfinancement_expense WHERE fk_original=${original} AND status='SUBMITTED'`);
  expect(scalar(`SELECT CONCAT(status,':',spent_amount) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('COMPLETED:60');
  sql('RENAME TABLE llx_mjlfinancement_audit_event TO llx_mjlfinancement_audit_event_unavailable');
  try { expect(transition(operation, replacement, 'APPROVED', 'validator').code).toBe('FAILED'); }
  finally { sql('RENAME TABLE llx_mjlfinancement_audit_event_unavailable TO llx_mjlfinancement_audit_event'); }
  expect(scalar(`SELECT CONCAT(status,':',spent_amount) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('COMPLETED:60');
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_expense WHERE fk_operation=${operation.rowid} AND kind='REVERSAL'`)).toBe('0');
  expect(transition(operation, replacement, 'APPROVED', 'validator').code).toBe('OK');
  expect(transition(operation, replacement, 'APPROVED', 'validator').code).toBe('CONFLICT');
  expect(scalar(`SELECT CONCAT(status,':',spent_amount) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('COMPLETED:80');
  expect(scalar(`SELECT amount FROM llx_mjlfinancement_expense WHERE rowid=${original}`)).toBe('60');
  expect(scalar(`SELECT amount FROM llx_mjlfinancement_expense WHERE fk_original=${original} AND kind='REVERSAL'`)).toBe('-60');
  expect(() => sql(`UPDATE llx_mjlfinancement_expense SET amount=61,version=version+1 WHERE rowid=${original}`)).toThrow();
  expect(() => sql(`DELETE FROM llx_mjlfinancement_expense WHERE rowid=${original}`)).toThrow();
  expect(save(operation, '90', 'agent', original).code).toBe('CONFLICT');
});

test('zero requires approval and pending expenses block completion', () => {
  const op = activity.operations[1];
  expect(complete(op, 'Aucune dépense.').code).toBe('CONFLICT');
  const zero = save(op, '0'); expect(zero.code).toBe('OK');
  expect(transition(op, zero.expense_id, 'SUBMITTED').code).toBe('OK');
  expect(transition(op, zero.expense_id, 'APPROVED', 'validator').code).toBe('OK');
  const pending = save(op, '10'); expect(pending.code).toBe('OK');
  expect(complete(op, 'Aucune dépense.').code).toBe('CONFLICT');
  expect(transition(op, pending.expense_id, 'WITHDRAWN').code).toBe('OK');
  expect(complete(op, null).code).toBe('CONFLICT');
  expect(complete(op, 'Aucune dépense.').code).toBe('OK');
  expect(scalar(`SELECT spent_amount FROM llx_mjlfinancement_operation WHERE rowid=${op.rowid}`)).toBe('0');
});

test('assignment, entity, submitted snapshots and contributor separation are enforced', async ({ page }) => {
  const op = activity.operations[2];
  expect(save(op, '10', 'outsider').code).toBe('FORBIDDEN');
  const entry = save(op, '100', 'career'); expect(entry.code).toBe('OK');
  expect(transition(op, entry.expense_id, 'SUBMITTED', 'career').code).toBe('OK');
  expect(() => sql(`UPDATE llx_mjlfinancement_expense SET amount=1,version=version+1 WHERE rowid=${entry.expense_id}`)).toThrow();
  expect(command({ entity: 2, action: 'expense-transition', actorId: fixture.users.validator.id, operationId: op.rowid, expenseId: String(entry.expense_id), expectedVersion: expenseVersion(entry.expense_id), decision: 'APPROVED', reason: '' }).code).toBe('NOT_FOUND');
  sql(`UPDATE llx_mjlfinancement_activity_assignment SET date_end=NOW() WHERE entity=1 AND fk_activity=${activity.activity_id} AND fk_user=${fixture.users.career.id} AND date_end IS NULL`);
  sql(`UPDATE llx_mjlfinancement_user_role SET role_code='VALIDATEUR_DEFINITIF' WHERE entity=1 AND fk_user=${fixture.users.career.id} AND is_active=1`);
  expect(transition(op, entry.expense_id, 'APPROVED', 'career').code).toBe('FORBIDDEN');
  expect(transition(op, entry.expense_id, 'REJECTED', 'validator', 'Montant non justifié.').code).toBe('OK');
  expect(scalar(`SELECT spent_amount IS NULL FROM llx_mjlfinancement_operation WHERE rowid=${op.rowid}`)).toBe('1');
  await login(page, 'outsider');
  expect((await page.goto(`/custom/mjlfinancement/expenses.php?operation_id=${op.rowid}`)).status()).toBe(403);
  await login(page, 'agent');
  const invalidPost = await page.context().request.post('/custom/mjlfinancement/expenses.php', { form: { action: 'transition', operation_id: String(op.rowid), expense_id: String(entry.expense_id), version: '1', decision: 'APPROVED' } });
  expect(invalidPost.status()).toBe(403);
});

test('cancelled Activity grants only correction access to Agents removed by its cancellation', async ({ page }) => {
  const request = command({ action: 'request-cancel', actorId: fixture.users.agent.id, targetType: 'ACTIVITY', targetId: activity.activity_id,
    expectedVersion: scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activity.activity_id}`), reason: 'Annulation du financement.' });
  expect(request.code).toBe('OK');
  expect(command({ action: 'decide-cancel', actorId: fixture.users.validator.id, requestId: request.request_id, expectedVersion: request.request_version,
    decision: 'APPROVED', reason: 'Annulation confirmée.' }).code).toBe('OK');
  await login(page, 'agent');
  expect((await page.goto(`/custom/mjlfinancement/activities.php?id=${activity.activity_id}`)).status()).toBe(403);
  expect((await page.goto(`/custom/mjlfinancement/expenses.php?operation_id=${operation.rowid}`)).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Nouvelle dépense' })).toHaveCount(0);
  expect(save(operation, '10').code).toBe('FORBIDDEN');
  const original = scalar(`SELECT rowid FROM llx_mjlfinancement_expense WHERE fk_operation=${operation.rowid} AND kind='EXPENSE' AND status='APPROVED' ORDER BY rowid DESC LIMIT 1`);
  const correction = save(operation, '90', 'agent', original); expect(correction.code).toBe('OK');
  expect(transition(operation, correction.expense_id, 'SUBMITTED').code).toBe('OK');
  expect(transition(operation, correction.expense_id, 'APPROVED', 'validator').code).toBe('OK');
  expect(scalar(`SELECT CONCAT(status,':',spent_amount) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('COMPLETED:90');
  await login(page, 'outsider');
  expect((await page.goto(`/custom/mjlfinancement/expenses.php?operation_id=${operation.rowid}`)).status()).toBe(403);
});

test('financial CSV uses approved totals and new expense events remain exportable', async ({ page }) => {
  execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/report-fixture.php', 'install'], { env: process.env, stdio: 'pipe' });
  if (scalar(`SELECT COALESCE(spent_amount,-1) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`) !== '90') {
    const first = save(operation, '60'); expect(first.code).toBe('OK'); expect(transition(operation, first.expense_id, 'SUBMITTED').code).toBe('OK'); expect(transition(operation, first.expense_id, 'APPROVED', 'validator').code).toBe('OK');
    expect(complete(operation, 'Économie sur le transport.').code).toBe('OK');
    const original = scalar(`SELECT rowid FROM llx_mjlfinancement_expense WHERE fk_operation=${operation.rowid} AND kind='EXPENSE' AND status='APPROVED' ORDER BY rowid DESC LIMIT 1`);
    const correction = save(operation, '90', 'agent', original); expect(correction.code).toBe('OK'); expect(transition(operation, correction.expense_id, 'SUBMITTED').code).toBe('OK'); expect(transition(operation, correction.expense_id, 'APPROVED', 'validator').code).toBe('OK');
  }
  await login(page, 'validator');
  await page.goto(`/custom/mjlfinancement/reports.php?report=operations&activity_id=${activity.activity_id}`);
  const download = page.waitForEvent('download');
  await page.getByLabel('Format').selectOption('csv');
  await page.getByRole('button', { name: 'Télécharger', exact: true }).click();
  const artifact = await download;
  const rows = JSON.parse(execFileSync('python3', ['-c', 'import csv,json,sys; print(json.dumps(list(csv.reader(sys.stdin,delimiter=";"))))'], { input: fs.readFileSync(await artifact.path()), encoding: 'utf8' }));
  const header = rows.findIndex((row) => row.includes('Montant dépensé (FCFA)'));
  expect(header).toBeGreaterThanOrEqual(0);
  const columns = rows[header];
  const data = rows.slice(header + 1).filter((row) => row.length === columns.length).map((row) => Object.fromEntries(columns.map((name, index) => [name, row[index]])));
  expect(data.map((row) => row['Montant dépensé (FCFA)'])).toContain('90');
  expect(data.map((row) => row['Montant dépensé (FCFA)'])).not.toContain('60');
  const probe = `<?php define('NOLOGIN',1); require '/var/www/html/main.inc.php'; require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit_projection.lib.php'; $res=$db->query("SELECT * FROM ".$db->prefix()."mjlfinancement_audit_event WHERE entity=1 AND activity_id=${activity.activity_id} AND action LIKE 'EXPENSE_%'"); $count=0;while($row=$db->fetch_array($res)){if(!mjl_audit_project_event($row))exit(1);$count++;}echo $count;`;
  expect(Number(composeExec('dolibarr', ['php'], 'utf8', probe))).toBeGreaterThan(5);
});
