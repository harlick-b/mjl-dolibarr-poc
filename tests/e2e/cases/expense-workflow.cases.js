const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');
const { verifyDisposableEnvironment } = require('../../helpers/verify-disposable-environment');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
let ownDraftId = 0;
let submittedDocId = 0;
let submittedMissingId = 0;
let correctionId = 0;
let selfSubmittedId = 0;
let otherOwnedId = 0;
let entityTwoId = 0;
let ecmOnlyId = 0;
let unavailableId = 0;
let ecmOnlyDocFileId = 0;
let otherOwnedDocFileId = 0;
let crossEntityDocFileId = 0;
let fundReceiptDocFileId = 0;
let orphanDocFileId = 0;
let poisonedDocFileId = 0;

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

async function submitDecision(page, buttonName) {
	await page.getByRole('button', { name: buttonName }).click();
}

async function expectAccessDenied(page) {
  await expect(page.locator('body')).toContainText(/Acces refuse|Accès refusé|Access denied|Forbidden|Non autorise|Non autorisé/);
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

async function postExpenseAction(page, expenseId, action, comment = '', extraForm = {}) {
  const token = await expensePostToken(page, expenseId);
  return page.request.post(`/custom/mjlfinancement/expenses.php?id=${expenseId}`, {
    form: {
      token,
      action,
      id: String(expenseId),
      comment,
      ...extraForm
    },
    maxRedirects: 0
  });
}

function cleanupExpenseWorkflowFixtures() {
  sql(`
    SET @expense_workflow_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.expense_workflow.otheragent');
    DELETE FROM llx_ecm_files WHERE ref LIKE 'EXPW-%' OR (src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'EXPW-%'));
    DELETE FROM llx_mjlfinancement_validation WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'EXPW-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'EXPW-%';
    DELETE FROM llx_usergroup_user WHERE fk_user = @expense_workflow_user;
    DELETE FROM llx_user WHERE rowid = @expense_workflow_user;
  `);
}

function seedExpenseWorkflowFixtures() {
  sql(`
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.expense_workflow.otheragent', 'ExpenseWorkflow', 'Autre', 'mjl.expense_workflow.otheragent@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @other_agent = LAST_INSERT_ID();
    SET @agent_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL POC - Agent' AND entity = 1 LIMIT 1);
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @other_agent, @agent_group);

    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-JE-002' AND entity = 1 LIMIT 1);
    SET @budget_line = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-JE-002' AND entity = 1 LIMIT 1);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'EXPW-OWN-DRAFT', @project, @convention, @activity, @budget_line, 1000, '2026-06-24', 'Depense Expense workflow brouillon', NULL, NULL, NOW(), @agent, 'EXPWOWNDRAFT', 0),
      (1, 'EXPW-SUBMITTED-DOC', @project, @convention, @activity, @budget_line, 1100, '2026-06-24', 'Depense Expense workflow avec piece', 'EXPW-SUBMITTED-DOC.pdf', NOW(), NOW(), @agent, 'EXPWSUBDOC', 1),
      (1, 'EXPW-SUBMITTED-MISS', @project, @convention, @activity, @budget_line, 1200, '2026-06-24', 'Depense Expense workflow sans piece', NULL, NOW(), NOW(), @agent, 'EXPWSUBMISS', 1),
      (1, 'EXPW-CORRECTION', @project, @convention, @activity, @budget_line, 1300, '2026-06-24', 'Depense Expense workflow correction', 'EXPW-CORRECTION.pdf', NOW(), NOW(), @agent, 'EXPWCORR', 1),
      (1, 'EXPW-SELF-SUBMITTED', @project, @convention, @activity, @budget_line, 1400, '2026-06-24', 'Depense Expense workflow admin proprietaire', 'EXPW-SELF-SUBMITTED.pdf', NOW(), NOW(), @admin, 'EXPWSELF', 1),
      (1, 'EXPW-OTHER-OWNED', @project, @convention, @activity, @budget_line, 1500, '2026-06-24', 'Depense Expense workflow autre agent', NULL, NULL, NOW(), @other_agent, 'EXPWOTHER', 0),
      (2, 'EXPW-ENTITY-TWO', @project, @convention, @activity, @budget_line, 1600, '2026-06-24', 'Depense Expense workflow autre entite', NULL, NULL, NOW(), @agent, 'EXPWENT2', 0),
      (1, 'EXPW-ECM-ONLY', @project, @convention, @activity, @budget_line, 1700, '2026-06-24', 'Depense Expense workflow ECM seule', '', NOW(), NOW(), @agent, 'EXPWECM', 1),
      (1, 'EXPW-UNAVAILABLE', @project, @convention, @activity, @budget_line, 1750, '2026-06-24', 'Depense Expense workflow piece indisponible', 'EXPW-UNAVAILABLE.pdf', NOW(), NOW(), @agent, 'EXPWUNAVAIL', 1),
      (1, 'EXPW-POISONED', @project, @convention, @activity, @budget_line, 1800, '2026-06-24', 'Depense Expense workflow chemin refuse', '', NULL, NOW(), @agent, 'EXPWPOISON', 0);

    SET @submitted_doc = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-SUBMITTED-DOC' AND entity = 1);
    SET @correction = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-CORRECTION' AND entity = 1);
    SET @self_submitted = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-SELF-SUBMITTED' AND entity = 1);
    SET @ecm_expense = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-ECM-ONLY' AND entity = 1);
    SET @other_owned = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-OTHER-OWNED' AND entity = 1);
    SET @entity_two = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-ENTITY-TWO' AND entity = 2);
    SET @poisoned = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-POISONED' AND entity = 1);
    SET @fund_receipt = (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE entity = 1 LIMIT 1);
    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES
      ('EXPW-SUBMITTED-DOC-ECM', 'EXPW-SUBMITTED-DOC.pdf', 1, 'EXPW-SUBMITTED-DOC.pdf', 'mjlfinancement_expense', 'EXPW-SUBMITTED-DOC.pdf', 'Piece Expense workflow soumise', 1, NOW(), @admin, 'mjlfinancement_expense', @submitted_doc),
      ('EXPW-CORRECTION-ECM', 'EXPW-CORRECTION.pdf', 1, 'EXPW-CORRECTION.pdf', 'mjlfinancement_expense', 'EXPW-CORRECTION.pdf', 'Piece Expense workflow correction', 1, NOW(), @admin, 'mjlfinancement_expense', @correction),
      ('EXPW-SELF-SUBMITTED-ECM', 'EXPW-SELF-SUBMITTED.pdf', 1, 'EXPW-SELF-SUBMITTED.pdf', 'mjlfinancement_expense', 'EXPW-SELF-SUBMITTED.pdf', 'Piece Expense workflow self', 1, NOW(), @admin, 'mjlfinancement_expense', @self_submitted),
      ('EXPW-ECM-ONLY-DOC', 'EXPW-ECM-ONLY.pdf', 1, 'EXPW-ECM-ONLY.pdf', 'mjlfinancement_expense', 'EXPW-ECM-ONLY.pdf', 'Piece Expense workflow ECM', 1, NOW(), @admin, 'mjlfinancement_expense', @ecm_expense),
      ('EXPW-OTHER-OWNED-DOC', 'EXPW-OTHER-OWNED.txt', 1, 'EXPW-OTHER-OWNED.txt', 'mjlfinancement_expense', 'EXPW-OTHER-OWNED.txt', 'Piece autre agent Expense workflow', 1, NOW(), @admin, 'mjlfinancement_expense', @other_owned),
      ('EXPW-CROSS-ENTITY-DOC', 'EXPW-CROSS-ENTITY.txt', 2, 'EXPW-CROSS-ENTITY.txt', 'mjlfinancement_expense', 'EXPW-CROSS-ENTITY.txt', 'Piece autre entite Expense workflow', 1, NOW(), @admin, 'mjlfinancement_expense', @entity_two),
      ('EXPW-FND-RECEIPT-DOC', 'EXPW-FND-RECEIPT.txt', 1, 'EXPW-FND-RECEIPT.txt', 'mjlfinancement_fund_receipt', 'EXPW-FND-RECEIPT.txt', 'Piece fonds Expense workflow', 1, NOW(), @admin, 'mjlfinancement_fund_receipt', @fund_receipt),
      ('EXPW-ORPHAN-DOC', 'EXPW-ORPHAN.txt', 1, 'EXPW-ORPHAN.txt', 'mjlfinancement_expense', 'EXPW-ORPHAN.txt', 'Piece orpheline Expense workflow', 1, NOW(), @admin, 'mjlfinancement_expense', 99999999),
      ('EXPW-POISON-DOC', 'EXPW-POISON.txt', 1, 'EXPW-POISON.txt', '../mjlfinancement_expense', 'EXPW-POISON.txt', 'Piece chemin refuse Expense workflow', 1, NOW(), @admin, 'mjlfinancement_expense', @poisoned);
  `);
  ownDraftId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-OWN-DRAFT' AND entity = 1"));
  submittedDocId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-SUBMITTED-DOC' AND entity = 1"));
  submittedMissingId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-SUBMITTED-MISS' AND entity = 1"));
  correctionId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-CORRECTION' AND entity = 1"));
  selfSubmittedId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-SELF-SUBMITTED' AND entity = 1"));
  otherOwnedId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-OTHER-OWNED' AND entity = 1"));
  entityTwoId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-ENTITY-TWO' AND entity = 2"));
  ecmOnlyId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-ECM-ONLY' AND entity = 1"));
  unavailableId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-UNAVAILABLE' AND entity = 1"));
  ecmOnlyDocFileId = Number(scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'EXPW-ECM-ONLY-DOC'"));
  otherOwnedDocFileId = Number(scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'EXPW-OTHER-OWNED-DOC'"));
  crossEntityDocFileId = Number(scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'EXPW-CROSS-ENTITY-DOC'"));
  fundReceiptDocFileId = Number(scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'EXPW-FND-RECEIPT-DOC'"));
  orphanDocFileId = Number(scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'EXPW-ORPHAN-DOC'"));
  poisonedDocFileId = Number(scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'EXPW-POISON-DOC'"));
}

function seedExpenseWorkflowFiles() {
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_expense /var/www/documents/ecm/mjlfinancement_fund_receipt && chown 33:33 /var/www/documents/ecm/mjlfinancement_expense /var/www/documents/ecm/mjlfinancement_fund_receipt && chmod 0770 /var/www/documents/ecm/mjlfinancement_expense /var/www/documents/ecm/mjlfinancement_fund_receipt && printf "%s" "Expense workflow submitted document" > /var/www/documents/ecm/mjlfinancement_expense/EXPW-SUBMITTED-DOC.pdf && printf "%s" "Expense workflow correction document" > /var/www/documents/ecm/mjlfinancement_expense/EXPW-CORRECTION.pdf && printf "%s" "Expense workflow self submitted document" > /var/www/documents/ecm/mjlfinancement_expense/EXPW-SELF-SUBMITTED.pdf && printf "%s" "Expense workflow ECM only document" > /var/www/documents/ecm/mjlfinancement_expense/EXPW-ECM-ONLY.pdf && printf "%s" "Expense workflow other owned document" > /var/www/documents/ecm/mjlfinancement_expense/EXPW-OTHER-OWNED.txt && printf "%s" "Expense workflow cross entity document" > /var/www/documents/ecm/mjlfinancement_expense/EXPW-CROSS-ENTITY.txt && printf "%s" "Expense workflow fund receipt document" > /var/www/documents/ecm/mjlfinancement_fund_receipt/EXPW-FND-RECEIPT.txt && printf "%s" "Expense workflow orphan document" > /var/www/documents/ecm/mjlfinancement_expense/EXPW-ORPHAN.txt && printf "%s" "Expense workflow poisoned document" > /var/www/documents/ecm/mjlfinancement_expense/EXPW-POISON.txt\'');
}

async function expectDownloadResponse(page, href, expectedText) {
  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-disposition']).toContain('attachment');
  expect(await response.text()).toContain(expectedText);
}

async function expectForbiddenDownload(page, fileId) {
  const response = await page.request.get(`/custom/mjlfinancement/documentdownload.php?id=${fileId}`);
  expect(response.status()).toBe(403);
}

test.beforeAll(() => {
  verifyDisposableEnvironment();
  cleanupExpenseWorkflowFixtures();
  seedExpenseWorkflowFixtures();
  seedExpenseWorkflowFiles();
  fs.writeFileSync('/tmp/expflow-supporting-document.txt', 'Expense workflow supporting document');
});

test.afterAll(() => {
  cleanupExpenseWorkflowFixtures();
});

test('Data-entry agent opens own expense detail, uploads document, submits, and loses missing-document alert', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.getByText('EXPW-OWN-DRAFT')).toBeVisible();

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${ownDraftId}`);
  await expect(page.getByRole('heading', { name: 'EXPW-OWN-DRAFT' })).toBeVisible();
  await expect(page.getByText('Piece manquante').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historique de decision' })).toBeVisible();

  await page.getByRole('link', { name: 'Ajouter une pièce justificative' }).click();
  await page.setInputFiles('input[name="supporting_document"]', '/tmp/expflow-supporting-document.txt');
  await page.getByRole('button', { name: 'Ajouter la pièce' }).click();
  await expect(page.getByText('Piece disponible').first()).toBeVisible();
  const uploadedHref = await page.getByRole('link', { name: 'Télécharger la pièce' }).first().getAttribute('href');
  expect(uploadedHref).toBeTruthy();
  await expectDownloadResponse(page, uploadedHref, 'Expense workflow supporting document');

  await page.getByLabel('Commentaire de soumission').fill('Soumission Expense workflow');
  await page.getByRole('button', { name: 'Soumettre la depense' }).click();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await expect(page.getByText('Soumission Expense workflow')).toBeVisible();

  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.locator('body')).not.toContainText('EXPW-OWN-DRAFT');
});

test('Data-entry agent cannot open another operational user expense or another entity expense', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${otherOwnedId}`);
  await expectAccessDenied(page);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${entityTwoId}`);
  await expectAccessDenied(page);
});

test('Verifier prevalidates submitted expense, Final validator final-validates it, and ECM-only document fallback remains available', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${submittedDocId}`);
  await expect(page.getByRole('heading', { name: 'EXPW-SUBMITTED-DOC' })).toBeVisible();
  await expect(page.getByText('Piece disponible').first()).toBeVisible();
  await expect(page.getByText('BL-JE-002').first()).toBeVisible();
  await expect(page.getByText('agent.mjl').first()).toBeVisible();
  await expect(page.getByText('Non validee').first()).toBeVisible();
  await page.getByRole('link', { name: 'Prévalider la dépense' }).click();
  await page.getByLabel('Montant prévalidé').fill('1100');
  await page.getByLabel('Commentaire de prévalidation').fill('Prevalidation Expense workflow');
  await page.getByRole('button', { name: 'Prévalider la dépense' }).click();
  await expect(page.getByText('Prévalidée').first()).toBeVisible();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${submittedDocId} AND action = 'prevalidated' AND actor_role = 'AGENT_VERIFICATEUR'`))).toBe(1);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${submittedDocId}`);
  await page.getByRole('link', { name: 'Valider définitivement la dépense' }).click();
  await page.getByLabel('Montant validé définitivement').fill('1100');
  await page.getByLabel('Commentaire de validation définitive').fill('Validation definitive Expense workflow');
  await submitDecision(page, 'Valider définitivement la dépense');
  await expect(page.getByText('Validée définitivement').first()).toBeVisible();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${submittedDocId} AND action = 'final_validated' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBe(1);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${ecmOnlyId}`);
  await expect(page.getByText('EXPW-ECM-ONLY.pdf').first()).toBeVisible();
  await expect(page.getByText('Piece disponible').first()).toBeVisible();
  const ecmOnlyHref = await page.getByRole('link', { name: 'Télécharger la pièce' }).first().getAttribute('href');
  expect(ecmOnlyHref).toBe(`/custom/mjlfinancement/documentdownload.php?id=${ecmOnlyDocFileId}`);
  await expectDownloadResponse(page, ecmOnlyHref, 'Expense workflow ECM only document');
});

test('Direct document downloads reject unauthorized or unsafe ECM rows', async ({ page }) => {
  await login(page, 'agent.mjl');

  for (const fileId of [
    otherOwnedDocFileId,
    crossEntityDocFileId,
    fundReceiptDocFileId,
    orphanDocFileId,
    poisonedDocFileId,
  ]) {
    await expectForbiddenDownload(page, fileId);
  }
});

test('Missing document blocks validation UI and direct POST', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${submittedMissingId}`);
  await expect(page.getByText('Validation bloquée tant que la pièce justificative manque.').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Prévalider la dépense' })).toHaveCount(0);

  const response = await postExpenseAction(page, submittedMissingId, 'prevalidate', '', { prevalidated_amount: '1200' });
  expect(response.status()).toBe(403);
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${submittedMissingId}`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${submittedMissingId} AND action = 'prevalidated'`))).toBe(0);
});

test('Unavailable referenced document blocks validation and stays visible in alerts', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${unavailableId}`);
  await expect(page.getByText('Piece referencee indisponible').first()).toBeVisible();
  await expect(page.getByText('EXPW-UNAVAILABLE.pdf').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Télécharger la pièce' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Prévalider la dépense' })).toHaveCount(0);

  const response = await postExpenseAction(page, unavailableId, 'prevalidate', '', { prevalidated_amount: '1750' });
  expect(response.status()).toBe(403);
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${unavailableId}`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${unavailableId} AND action = 'prevalidated'`))).toBe(0);

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.getByText('EXPW-UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('Piece indisponible').first()).toBeVisible();
});

test('Reject, correct, and resubmit preserves decision comments', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${correctionId}`);
  await page.getByRole('link', { name: 'Rejeter la dépense' }).click();
  await page.getByLabel('Motif de rejet').fill('Motif rejet Expense workflow');
  await submitDecision(page, 'Rejeter la dépense');
  await expect(page.getByText('Rejetée').first()).toBeVisible();
  await expect(page.getByText('Motif rejet Expense workflow')).toBeVisible();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${correctionId} AND action = 'rejected'`))).toBe(1);
  const replay = await postExpenseAction(page, correctionId, 'reject', 'Motif rejet Expense workflow duplique');
  expect(replay.status()).toBe(403);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${correctionId} AND action = 'rejected'`))).toBe(1);

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${correctionId}`);
  await page.getByRole('link', { name: 'Modifier la dépense' }).click();
  await page.getByLabel('Montant').fill('1250');
  await page.getByRole('button', { name: 'Enregistrer la correction' }).click();
  await page.getByLabel('Motif de correction').fill('Correction Expense workflow');
  await page.getByRole('button', { name: 'Marquer corrigee' }).click();
  await expect(page.getByText('Corrigée').first()).toBeVisible();
  await page.getByLabel('Commentaire de soumission').fill('Resoumission Expense workflow');
  await page.getByRole('button', { name: 'Soumettre la depense' }).click();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await expect(page.getByText('Motif rejet Expense workflow')).toBeVisible();
  await expect(page.getByText('Correction Expense workflow')).toBeVisible();
  await expect(page.getByText('Resoumission Expense workflow')).toBeVisible();
});

test('Self reviewer decisions are absent from UI and blocked server-side', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${selfSubmittedId}`);
  await expect(page.getByRole('link', { name: 'Prévalider la dépense' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Rejeter la dépense' })).toHaveCount(0);

  for (const attempt of [
    { action: 'prevalidate', comment: 'Tentative auto-validation Expense workflow', extraForm: { prevalidated_amount: '1400' } },
    { action: 'reject', comment: 'Tentative auto-rejet Expense workflow' }
  ]) {
    const response = await postExpenseAction(page, selfSubmittedId, attempt.action, attempt.comment, attempt.extraForm || {});
    expect(response.status()).toBe(403);
    expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${selfSubmittedId}`))).toBe(1);
    expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${selfSubmittedId} AND comment = '${attempt.comment}'`))).toBe(0);
  }
});

test('Tampered create POST with mismatched project and convention is rejected server-side', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/expenses.php?action=create');
  const token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const mismatchedConventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-RED-2026-001' AND entity = 1 LIMIT 1");
  const budgetLineId = scalar("SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-JE-002' AND entity = 1 LIMIT 1");

  const response = await page.request.post('/custom/mjlfinancement/expenses.php', {
    form: {
      token,
      action: 'create',
      ref: 'EXPW-TAMPER-MISMATCH',
      fk_project: projectId,
      fk_convention: mismatchedConventionId,
      fk_budget_line: budgetLineId,
      amount: '1000',
      expense_date: '2026-06-24',
      description: 'Depense Expense workflow rattachement incoherent'
    },
    maxRedirects: 0
  });

  expect([302, 403]).toContain(response.status());
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_expense WHERE ref = 'EXPW-TAMPER-MISMATCH' AND entity = 1"))).toBe(0);
});

test('Final validator, Admin, and unresolved legacy reader visibility stays role-aware', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${submittedMissingId}`);
  await expect(page.getByRole('heading', { name: 'EXPW-SUBMITTED-MISS' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Valider définitivement la dépense' })).toHaveCount(0);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/expenses.php');
  await expect(page.getByText('Portefeuille MJL')).toBeVisible();

  await login(page, 'lecteur.audit');
  await page.goto('/custom/mjlfinancement/expenses.php');
  await expectAccessDenied(page);
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});
