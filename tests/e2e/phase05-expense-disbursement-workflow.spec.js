const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

let flowId = 0;
let missingDocId = 0;
let overBudgetId = 0;
let selfPrevalidateId = 0;
let selfFinalId = 0;
let selfDisburseId = 0;

test.describe.configure({ mode: 'serial' });

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

function cleanupPhase05Fixtures() {
  sql(`
    DELETE FROM llx_ecm_files WHERE ref LIKE 'P5D-%' OR (src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P5D-%'));
    DELETE FROM llx_mjlfinancement_validation WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P5D-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P5D-%';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'P5D-%';
  `);
}

function seedPhase05Fixtures() {
  sql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @verifier = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' LIMIT 1);
    SET @final = (SELECT rowid FROM llx_user WHERE login = 'dpaf.mjl' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-JE-002' AND entity = 1 LIMIT 1);

    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, fk_mjl_activity, initial_budget, revised_budget, committed_amount, spent_amount, remaining_amount, category, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'P5D-BL', 'Phase 5 decaissement', @project, @convention, @activity, 10000, 10000, 0, 0, 10000, 'Phase 5', NOW(), @final, 'P5DBL', 1);
    SET @budget_line = LAST_INSERT_ID();
    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, fk_mjl_activity, initial_budget, revised_budget, committed_amount, spent_amount, remaining_amount, category, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'P5D-GUARD-BL', 'Phase 5 controles', @project, @convention, @activity, 10000, 10000, 0, 0, 10000, 'Phase 5', NOW(), @final, 'P5DGUARDBL', 1);
    SET @guard_budget_line = LAST_INSERT_ID();

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status, prevalidated_amount, final_validated_amount, disbursed_amount, fk_user_prevalidated, fk_user_final_valid, fk_user_disbursed, prevalidation_date, final_validation_date, disbursement_date, beneficiary_name)
    VALUES
      (1, 'P5D-FLOW', @project, @convention, @activity, @budget_line, 1000, '2026-07-01', 'Workflow complet Phase 5', 'P5D-FLOW.pdf', NOW(), NOW(), @agent, 'P5DFLOW', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'P5D-MISSING', @project, @convention, @activity, @guard_budget_line, 900, '2026-07-01', 'Justificatif manquant Phase 5', NULL, NOW(), NOW(), @agent, 'P5DMISS', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'P5D-OVER', @project, @convention, @activity, @budget_line, 12000, '2026-07-01', 'Depassement budget Phase 5', 'P5D-OVER.pdf', NOW(), NOW(), @agent, 'P5DOVER', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'P5D-SELF-PRE', @project, @convention, @activity, @guard_budget_line, 800, '2026-07-01', 'Auto prevalidation Phase 5', 'P5D-SELF-PRE.pdf', NOW(), NOW(), @verifier, 'P5DSELFPR', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      (1, 'P5D-SELF-FINAL', @project, @convention, @activity, @guard_budget_line, 700, '2026-07-01', 'Auto validation definitive Phase 5', 'P5D-SELF-FINAL.pdf', NOW(), NOW(), @final, 'P5DSELFFI', 4, 700, NULL, NULL, @verifier, NULL, NULL, NOW(), NULL, NULL, NULL),
      (1, 'P5D-SELF-DISB', @project, @convention, @activity, @guard_budget_line, 600, '2026-07-01', 'Auto decaissement Phase 5', 'P5D-SELF-DISB.pdf', NOW(), NOW(), @final, 'P5DSELFDI', 6, 600, 600, NULL, @verifier, @final, NULL, NOW(), NOW(), NULL, 'Beneficiaire Phase 5');

    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    SELECT CONCAT(e.ref, '-ECM'), CONCAT(e.ref, '.pdf'), 1, CONCAT(e.ref, '.pdf'), 'mjlfinancement_expense', CONCAT(e.ref, '.pdf'), 'Piece Phase 5', 1, NOW(), @final, 'mjlfinancement_expense', e.rowid
    FROM llx_mjlfinancement_expense e
    WHERE e.ref IN ('P5D-FLOW', 'P5D-OVER', 'P5D-SELF-PRE', 'P5D-SELF-FINAL', 'P5D-SELF-DISB') AND e.entity = 1;
  `);
  flowId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P5D-FLOW' AND entity = 1"));
  missingDocId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P5D-MISSING' AND entity = 1"));
  overBudgetId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P5D-OVER' AND entity = 1"));
  selfPrevalidateId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P5D-SELF-PRE' AND entity = 1"));
  selfFinalId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P5D-SELF-FINAL' AND entity = 1"));
  selfDisburseId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P5D-SELF-DISB' AND entity = 1"));
}

function seedPhase05Files() {
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_expense && for ref in P5D-FLOW P5D-OVER P5D-SELF-PRE P5D-SELF-FINAL P5D-SELF-DISB; do printf "%s" "Document ${ref}" > "/var/www/documents/ecm/mjlfinancement_expense/${ref}.pdf"; done\'');
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase05Fixtures();
  seedPhase05Fixtures();
  seedPhase05Files();
});

test.afterAll(() => {
  cleanupPhase05Fixtures();
});

test('expense moves through prevalidation, final validation, and disbursement with audited amounts', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${flowId}`);
  await expect(page.getByRole('heading', { name: 'P5D-FLOW' })).toBeVisible();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await page.getByLabel('Montant prevalide').fill('1000');
  await page.getByLabel('Commentaire de prevalidation').fill('Prevalidation Phase 5');
  await page.getByRole('button', { name: 'Prevalider la depense' }).click();
  await expect(page.getByText('Prevalidee').first()).toBeVisible();
  await expect(page.getByText('Prevalidation Phase 5')).toBeVisible();

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${flowId}`);
  await page.getByLabel('Montant valide definitivement').fill('1000');
  await page.getByLabel('Commentaire de validation definitive').fill('Validation definitive Phase 5');
  await page.getByRole('button', { name: 'Valider definitivement' }).click();
  await expect(page.getByText('Validee definitivement').first()).toBeVisible();
  await expect(page.getByText('Validation definitive Phase 5')).toBeVisible();
  expect(Number(scalar("SELECT ROUND(spent_amount) FROM llx_mjlfinancement_budget_line WHERE ref = 'P5D-BL' AND entity = 1"))).toBe(1000);

  await page.getByLabel('Beneficiaire').fill('Cabinet Phase 5');
  await page.getByLabel('Date decaissement').fill('2026-07-08');
  await page.getByRole('button', { name: 'Enregistrer le decaissement' }).click();
  await expect(page.getByText('Decaissee').first()).toBeVisible();
  await expect(page.getByText('Cabinet Phase 5')).toBeVisible();
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${flowId}`))).toBe(7);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${flowId} AND action = 'disbursed' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBe(1);
});

test('missing document and overspend block final approval paths', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${missingDocId}`);
  await expect(page.getByRole('button', { name: 'Prevalider la depense' })).toHaveCount(0);
  let response = await postExpenseAction(page, missingDocId, { action: 'prevalidate', prevalidated_amount: '900', comment: 'Tentative sans piece' });
  expect(response.status()).toBe(403);
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${missingDocId}`))).toBe(1);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${overBudgetId}`);
  await page.getByLabel('Montant prevalide').fill('12000');
  await page.getByRole('button', { name: 'Prevalider la depense' }).click();
  await expect(page.getByText(/exceeds|depasse|dépasse|budget/i).first()).toBeVisible();
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${overBudgetId}`))).toBe(1);
});

test('wrong role and self-action direct POST attempts are rejected', async ({ page }) => {
  await login(page, 'superviseur.n1');
  let response = await postExpenseAction(page, flowId, { action: 'final_validate', final_validated_amount: '1000', comment: 'Mauvais role' });
  expect(response.status()).toBe(403);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${selfPrevalidateId}`);
  await expect(page.getByRole('button', { name: 'Prevalider la depense' })).toHaveCount(0);
  response = await postExpenseAction(page, selfPrevalidateId, { action: 'prevalidate', prevalidated_amount: '800', comment: 'Auto prevalidation' });
  expect(response.status()).toBe(403);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${selfFinalId}`);
  await expect(page.getByRole('button', { name: 'Valider definitivement' })).toHaveCount(0);
  response = await postExpenseAction(page, selfFinalId, { action: 'final_validate', final_validated_amount: '700', comment: 'Auto validation definitive' });
  expect(response.status()).toBe(403);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${selfDisburseId}`);
  await expect(page.getByRole('button', { name: 'Enregistrer le decaissement' })).toHaveCount(0);
  response = await postExpenseAction(page, selfDisburseId, { action: 'disburse', beneficiary_name: 'Auto beneficiaire', disbursement_date: '2026-07-08' });
  expect(response.status()).toBe(403);
});
