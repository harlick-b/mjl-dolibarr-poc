const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

let flowId = 0;
let missingDocId = 0;
let overBudgetId = 0;
let selfPrevalidateId = 0;
let selfFinalId = 0;
let selfDisburseId = 0;
let raceId = 0;

function dockerExec(command) {
  return execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
}

function sql(query) {
  dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`);
}

function scalar(query) {
  return dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -N -B -e "${query.replace(/"/g, '\\"')}"`).toString().trim();
}

async function login(page, username, userPassword = password) {
	await page.goto('/user/logout.php').catch(() => {});
	await page.goto('/index.php');
	await page.getByLabel('Identifiant').fill(username);
	await page.getByLabel('Mot de passe').fill(userPassword);
	await page.getByRole('button', { name: 'Connexion' }).click();
}

async function submitDecision(page, buttonName) {
	await page.getByRole('button', { name: buttonName }).click();
}

async function expensePostToken(page, expenseId) {
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}`);
  const tokenInput = page.locator('input[name="token"]').first();
  if (await tokenInput.count()) {
    const token = await tokenInput.getAttribute('value');
    if (token) return token;
  }
  const metaToken = await page.locator('meta[name="anti-csrf-newtoken"]').getAttribute('content');
  expect(metaToken).toBeTruthy();
  return metaToken;
}

async function postExpenseAction(page, expenseId, form) {
  const token = await expensePostToken(page, expenseId);
  return page.request.post(`/custom/mjlfinancement/expenses.php?id=${expenseId}`, {
    form: {
      token,
      id: String(expenseId),
      ...form
    },
    maxRedirects: 0
  });
}

function cleanupExpenseDisbursementFixtures() {
  sql(`
    DELETE FROM llx_ecm_files WHERE ref LIKE 'EXD-%' OR (src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'EXD-%'));
    DELETE FROM llx_mjlfinancement_validation WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'EXD-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'EXD-%';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'EXD-%';
  `);
}

function seedExpenseDisbursementFixtures() {
  sql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @verifier = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' LIMIT 1);
    SET @final = (SELECT rowid FROM llx_user WHERE login = 'dpaf.mjl' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-JE-002' AND entity = 1 LIMIT 1);

    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, fk_mjl_activity, initial_budget, revised_budget, committed_amount, spent_amount, remaining_amount, category, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'EXD-BL', 'Expense disbursement decaissement', @project, @convention, @activity, 10000, 10000, 0, 0, 10000, 'Expense disbursement', NOW(), @final, 'EXDBL', 1);
    SET @budget_line = LAST_INSERT_ID();
    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, fk_mjl_activity, initial_budget, revised_budget, committed_amount, spent_amount, remaining_amount, category, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'EXD-GUARD-BL', 'Expense disbursement controles', @project, @convention, @activity, 10000, 10000, 0, 0, 10000, 'Expense disbursement', NOW(), @final, 'EXDGUARDBL', 1);
    SET @guard_budget_line = LAST_INSERT_ID();

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status, prevalidated_amount, final_validated_amount, disbursed_amount, fk_user_prevalidated, fk_user_final_valid, fk_user_disbursed, prevalidation_date, final_validation_date, disbursement_date, beneficiary_name)
    VALUES
      (1, 'EXD-FLOW', @project, @convention, @activity, @budget_line, 1000, '2026-07-01', 'Workflow complet Expense disbursement', 'EXD-FLOW.pdf', NOW(), NOW(), @agent, 'EXDFLOW', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'EXD-MISSING', @project, @convention, @activity, @guard_budget_line, 900, '2026-07-01', 'Justificatif manquant Expense disbursement', NULL, NOW(), NOW(), @agent, 'EXDMISS', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'EXD-OVER', @project, @convention, @activity, @budget_line, 12000, '2026-07-01', 'Depassement budget Expense disbursement', 'EXD-OVER.pdf', NOW(), NOW(), @agent, 'EXDOVER', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'EXD-SELF-PRE', @project, @convention, @activity, @guard_budget_line, 800, '2026-07-01', 'Auto prevalidation Expense disbursement', 'EXD-SELF-PRE.pdf', NOW(), NOW(), @verifier, 'EXDSELFPR', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'EXD-SELF-FINAL', @project, @convention, @activity, @guard_budget_line, 700, '2026-07-01', 'Auto validation definitive Expense disbursement', 'EXD-SELF-FINAL.pdf', NOW(), NOW(), @final, 'EXDSELFFI', 4, 700, NULL, NULL, @verifier, NULL, NULL, NOW(), NULL, NULL, NULL),
      (1, 'EXD-SELF-DISB', @project, @convention, @activity, @guard_budget_line, 600, '2026-07-01', 'Auto decaissement Expense disbursement', 'EXD-SELF-DISB.pdf', NOW(), NOW(), @final, 'EXDSELFDI', 6, 600, 600, NULL, @verifier, @final, NULL, NOW(), NOW(), NULL, 'Beneficiaire Expense disbursement'),
      (1, 'EXD-RACE', @project, @convention, @activity, @guard_budget_line, 500, '2026-07-01', 'Validation concurrente', 'EXD-RACE.pdf', NOW(), NOW(), @agent, 'EXDRACE', 4, 500, NULL, NULL, @verifier, NULL, NULL, NOW(), NULL, NULL, NULL);

    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    SELECT CONCAT(e.ref, '-ECM'), CONCAT(e.ref, '.pdf'), 1, CONCAT(e.ref, '.pdf'), 'mjlfinancement_expense', CONCAT(e.ref, '.pdf'), 'Piece Expense disbursement', 1, NOW(), @final, 'mjlfinancement_expense', e.rowid
    FROM llx_mjlfinancement_expense e
    WHERE e.ref IN ('EXD-FLOW', 'EXD-OVER', 'EXD-SELF-PRE', 'EXD-SELF-FINAL', 'EXD-SELF-DISB', 'EXD-RACE') AND e.entity = 1;
  `);
  flowId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXD-FLOW' AND entity = 1"));
  missingDocId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXD-MISSING' AND entity = 1"));
  overBudgetId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXD-OVER' AND entity = 1"));
  selfPrevalidateId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXD-SELF-PRE' AND entity = 1"));
  selfFinalId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXD-SELF-FINAL' AND entity = 1"));
  selfDisburseId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXD-SELF-DISB' AND entity = 1"));
  raceId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXD-RACE' AND entity = 1"));
}

function seedExpenseDisbursementFiles() {
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_expense && for ref in EXD-FLOW EXD-OVER EXD-SELF-PRE EXD-SELF-FINAL EXD-SELF-DISB EXD-RACE; do printf "%s" "Document ${ref}" > "/var/www/documents/ecm/mjlfinancement_expense/${ref}.pdf"; done\'');
}

test.beforeAll(() => {
  cleanupExpenseDisbursementFixtures();
  seedExpenseDisbursementFixtures();
  seedExpenseDisbursementFiles();
});

test.afterAll(() => {
  cleanupExpenseDisbursementFixtures();
});

test('expense moves through prevalidation, final validation, and disbursement with audited amounts', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${flowId}`);
  await expect(page.getByRole('heading', { name: 'EXD-FLOW' })).toBeVisible();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await page.getByRole('link', { name: 'Prévalider la dépense' }).click();
  await page.getByLabel('Montant prévalidé').fill('1000');
  await page.getByLabel('Commentaire de prévalidation').fill('Prevalidation Expense disbursement');
  await page.getByRole('button', { name: 'Prévalider la dépense' }).click();
  await expect(page.getByText('Prévalidée').first()).toBeVisible();
  await expect(page.getByText('Prevalidation Expense disbursement')).toBeVisible();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'prevalidated'`))).toBe(1);
  let replay = await postExpenseAction(page, flowId, { action: 'prevalidate', prevalidated_amount: '1000', comment: 'Prevalidation Expense disbursement dupliquee' });
  expect(replay.status()).toBe(403);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'prevalidated'`))).toBe(1);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${flowId}`);
  await page.getByRole('link', { name: 'Valider définitivement la dépense' }).click();
  await page.getByLabel('Montant validé définitivement').fill('1000');
  await page.getByLabel('Commentaire de validation définitive').fill('Validation definitive Expense disbursement');
  await submitDecision(page, 'Valider définitivement la dépense');
  await expect(page.getByText('Validée définitivement').first()).toBeVisible();
  await expect(page.getByText('Validation definitive Expense disbursement')).toBeVisible();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'final_validated'`))).toBe(1);
  replay = await postExpenseAction(page, flowId, { action: 'final_validate', final_validated_amount: '1000', comment: 'Validation definitive Expense disbursement dupliquee' });
  expect(replay.status()).toBe(403);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'final_validated'`))).toBe(1);
  expect(Number(scalar("SELECT ROUND(committed_amount) FROM llx_mjlfinancement_budget_line WHERE ref = 'EXD-BL' AND entity = 1"))).toBe(1000);
  expect(Number(scalar("SELECT ROUND(spent_amount) FROM llx_mjlfinancement_budget_line WHERE ref = 'EXD-BL' AND entity = 1"))).toBe(0);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${flowId}`);
  await page.getByRole('link', { name: 'Enregistrer le décaissement' }).click();
  await page.getByLabel('Beneficiaire').fill('Cabinet Expense disbursement');
  await page.getByLabel('Date decaissement').fill('2026-07-08');
  await submitDecision(page, 'Enregistrer le décaissement');
  await expect(page.getByText('Décaissée').first()).toBeVisible();
  await expect(page.getByText('Cabinet Expense disbursement')).toBeVisible();
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${flowId}`))).toBe(7);
  expect(Number(scalar("SELECT ROUND(spent_amount) FROM llx_mjlfinancement_budget_line WHERE ref = 'EXD-BL' AND entity = 1"))).toBe(1000);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'disbursed' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBe(1);
  replay = await postExpenseAction(page, flowId, { action: 'disburse', beneficiary_name: 'Cabinet Expense disbursement duplique', disbursement_date: '2026-07-08' });
  expect(replay.status()).toBe(403);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'disbursed'`))).toBe(1);
});

test('missing document and overspend block final approval paths', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${missingDocId}`);
  await expect(page.getByRole('link', { name: 'Prévalider la dépense' })).toHaveCount(0);
  let response = await postExpenseAction(page, missingDocId, { action: 'prevalidate', prevalidated_amount: '900', comment: 'Tentative sans piece' });
  expect(response.status()).toBe(403);
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${missingDocId}`))).toBe(1);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${overBudgetId}`);
  await page.getByRole('link', { name: 'Prévalider la dépense' }).click();
  await page.getByLabel('Montant prévalidé').fill('12000');
  await page.getByRole('button', { name: 'Prévalider la dépense' }).click();
  await expect(page.getByText('Prévalidée').first()).toBeVisible();
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${overBudgetId}`))).toBe(4);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${overBudgetId}`);
  await page.getByRole('link', { name: 'Valider définitivement la dépense' }).click();
  await page.getByLabel('Montant validé définitivement').fill('12000');
  await submitDecision(page, 'Valider définitivement la dépense');
  await expect(page.getByText(/exceeds|depasse|dépasse|budget/i).first()).toBeVisible();
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${overBudgetId}`))).toBe(4);
});

test('wrong role and self-action direct POST attempts are rejected', async ({ page }) => {
  await login(page, 'superviseur.n1');
  let response = await postExpenseAction(page, flowId, { action: 'final_validate', final_validated_amount: '1000', comment: 'Mauvais role' });
  expect(response.status()).toBe(403);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${selfPrevalidateId}`);
  await expect(page.getByRole('link', { name: 'Prévalider la dépense' })).toHaveCount(0);
  response = await postExpenseAction(page, selfPrevalidateId, { action: 'prevalidate', prevalidated_amount: '800', comment: 'Auto prevalidation' });
  expect(response.status()).toBe(403);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${selfFinalId}`);
  await expect(page.getByRole('link', { name: 'Valider définitivement la dépense' })).toHaveCount(0);
  response = await postExpenseAction(page, selfFinalId, { action: 'final_validate', final_validated_amount: '700', comment: 'Auto validation definitive' });
  expect(response.status()).toBe(403);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${selfDisburseId}`);
  await expect(page.getByRole('link', { name: 'Enregistrer le décaissement' })).toHaveCount(0);
  response = await postExpenseAction(page, selfDisburseId, { action: 'disburse', beneficiary_name: 'Auto beneficiaire', disbursement_date: '2026-07-08' });
  expect(response.status()).toBe(403);
});

test('near-simultaneous final decisions create exactly one effect', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    await Promise.all(pages.map((page) => login(page, 'dpaf.mjl')));
    const tokens = await Promise.all(pages.map((page) => expensePostToken(page, raceId)));
    const responses = await Promise.all(pages.map((page, index) => page.request.post(
      `/custom/mjlfinancement/expenses.php?id=${raceId}`,
      {
        form: {
          token: tokens[index],
          id: String(raceId),
          action: 'final_validate',
          final_validated_amount: '500',
          comment: `Concurrent decision ${index + 1}`,
        },
        maxRedirects: 0,
      },
    )));

    expect(responses.some((response) => response.status() === 302)).toBe(true);
    expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${raceId}`))).toBe(6);
    expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${raceId} AND action = 'final_validated'`))).toBe(1);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
