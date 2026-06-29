const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
let ownDraftId = 0;
let submittedDocId = 0;
let submittedMissingId = 0;
let correctionId = 0;
let selfSubmittedId = 0;
let otherOwnedId = 0;
let entityTwoId = 0;
let ecmOnlyId = 0;

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

async function postExpenseAction(page, expenseId, action, comment = '') {
  const token = await expensePostToken(page, expenseId);
  return page.request.post(`/custom/mjlfinancement/expenses.php?id=${expenseId}`, {
    form: {
      token,
      action,
      id: String(expenseId),
      comment
    },
    maxRedirects: 0
  });
}

function cleanupPhase11Fixtures() {
  sql(`
    SET @phase11_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase11.otheragent');
    DELETE FROM llx_ecm_files WHERE src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P11-%');
    DELETE FROM llx_mjlfinancement_validation WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P11-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P11-%';
    DELETE FROM llx_usergroup_user WHERE fk_user = @phase11_user;
    DELETE FROM llx_user WHERE rowid = @phase11_user;
  `);
}

function seedPhase11Fixtures() {
  sql(`
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase11.otheragent', 'Phase11', 'Autre', 'mjl.phase11.otheragent@mjl-poc.local', pass_crypted, 1, 0, NOW()
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
      (1, 'P11-OWN-DRAFT', @project, @convention, @activity, @budget_line, 1000, '2026-06-24', 'Depense Phase 11 brouillon', NULL, NULL, NOW(), @agent, 'P11OWNDRAFT', 0),
      (1, 'P11-SUBMITTED-DOC', @project, @convention, @activity, @budget_line, 1100, '2026-06-24', 'Depense Phase 11 avec piece', 'P11-SUBMITTED-DOC.pdf', NOW(), NOW(), @agent, 'P11SUBDOC', 1),
      (1, 'P11-SUBMITTED-MISS', @project, @convention, @activity, @budget_line, 1200, '2026-06-24', 'Depense Phase 11 sans piece', NULL, NOW(), NOW(), @agent, 'P11SUBMISS', 1),
      (1, 'P11-CORRECTION', @project, @convention, @activity, @budget_line, 1300, '2026-06-24', 'Depense Phase 11 correction', 'P11-CORRECTION.pdf', NOW(), NOW(), @agent, 'P11CORR', 1),
      (1, 'P11-SELF-SUBMITTED', @project, @convention, @activity, @budget_line, 1400, '2026-06-24', 'Depense Phase 11 admin proprietaire', 'P11-SELF-SUBMITTED.pdf', NOW(), NOW(), @admin, 'P11SELF', 1),
      (1, 'P11-OTHER-OWNED', @project, @convention, @activity, @budget_line, 1500, '2026-06-24', 'Depense Phase 11 autre agent', NULL, NULL, NOW(), @other_agent, 'P11OTHER', 0),
      (2, 'P11-ENTITY-TWO', @project, @convention, @activity, @budget_line, 1600, '2026-06-24', 'Depense Phase 11 autre entite', NULL, NULL, NOW(), @agent, 'P11ENT2', 0),
      (1, 'P11-ECM-ONLY', @project, @convention, @activity, @budget_line, 1700, '2026-06-24', 'Depense Phase 11 ECM seule', '', NOW(), NOW(), @agent, 'P11ECM', 1);

    SET @ecm_expense = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P11-ECM-ONLY' AND entity = 1);
    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES ('P11-ECM-ONLY-DOC', 'P11-ECM-ONLY.pdf', 1, 'P11-ECM-ONLY.pdf', 'mjlfinancement_expense', 'P11-ECM-ONLY.pdf', 'Piece Phase 11 ECM', 1, NOW(), @admin, 'mjlfinancement_expense', @ecm_expense);
  `);
  ownDraftId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P11-OWN-DRAFT' AND entity = 1"));
  submittedDocId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P11-SUBMITTED-DOC' AND entity = 1"));
  submittedMissingId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P11-SUBMITTED-MISS' AND entity = 1"));
  correctionId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P11-CORRECTION' AND entity = 1"));
  selfSubmittedId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P11-SELF-SUBMITTED' AND entity = 1"));
  otherOwnedId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P11-OTHER-OWNED' AND entity = 1"));
  entityTwoId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P11-ENTITY-TWO' AND entity = 2"));
  ecmOnlyId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P11-ECM-ONLY' AND entity = 1"));
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase11Fixtures();
  seedPhase11Fixtures();
  fs.writeFileSync('/tmp/p11-supporting-document.txt', 'Phase 11 supporting document');
});

test.afterAll(() => {
  cleanupPhase11Fixtures();
});

test('Level 1 opens own expense detail, uploads document, submits, and loses missing-document alert', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.getByText('P11-OWN-DRAFT')).toBeVisible();

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${ownDraftId}`);
  await expect(page.getByRole('heading', { name: 'P11-OWN-DRAFT' })).toBeVisible();
  await expect(page.getByText('Piece justificative manquante')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historique de decision' })).toBeVisible();

  await page.setInputFiles('input[name="supporting_document"]', '/tmp/p11-supporting-document.txt');
  await page.getByRole('button', { name: 'Ajouter la piece' }).click();
  await expect(page.getByText('Piece justificative presente')).toBeVisible();

  await page.getByLabel('Commentaire de soumission').fill('Soumission Phase 11');
  await page.getByRole('button', { name: 'Soumettre la depense' }).click();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await expect(page.getByText('Soumission Phase 11')).toBeVisible();

  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.locator('body')).not.toContainText('P11-OWN-DRAFT');
});

test('Level 1 cannot open another operational user expense or another entity expense', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${otherOwnedId}`);
  await expectAccessDenied(page);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${entityTwoId}`);
  await expectAccessDenied(page);
});

test('Level 2 validates submitted expense with document and sees ECM-only document fallback', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${submittedDocId}`);
  await expect(page.getByRole('heading', { name: 'P11-SUBMITTED-DOC' })).toBeVisible();
  await expect(page.getByText('Piece justificative presente')).toBeVisible();
  await page.getByRole('button', { name: 'Valider la depense' }).click();
  await expect(page.getByText('Validee').first()).toBeVisible();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${submittedDocId} AND action = 'validated'`))).toBe(1);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${ecmOnlyId}`);
  await expect(page.getByText('P11-ECM-ONLY.pdf')).toBeVisible();
  await expect(page.getByText('Piece justificative presente')).toBeVisible();
});

test('Missing document blocks validation UI and direct POST', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${submittedMissingId}`);
  await expect(page.getByText('Validation bloquee tant que la piece justificative manque.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Valider la depense' })).toHaveCount(0);

  const response = await postExpenseAction(page, submittedMissingId, 'validate');
  expect(response.status()).toBe(403);
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${submittedMissingId}`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${submittedMissingId} AND action = 'validated'`))).toBe(0);
});

test('Reject, correct, and resubmit preserves decision comments', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${correctionId}`);
  await page.getByLabel('Motif de rejet').fill('Motif rejet Phase 11');
  await page.getByRole('button', { name: 'Rejeter la depense' }).click();
  await expect(page.getByText('Rejetee').first()).toBeVisible();
  await expect(page.getByText('Motif rejet Phase 11')).toBeVisible();

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${correctionId}`);
  await page.getByLabel('Montant').fill('1250');
  await page.getByRole('button', { name: 'Enregistrer la correction' }).click();
  await page.getByLabel('Motif de correction').fill('Correction Phase 11');
  await page.getByRole('button', { name: 'Marquer corrigee' }).click();
  await expect(page.getByText('Corrigee').first()).toBeVisible();
  await page.getByLabel('Commentaire de soumission').fill('Resoumission Phase 11');
  await page.getByRole('button', { name: 'Soumettre la depense' }).click();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await expect(page.getByText('Motif rejet Phase 11')).toBeVisible();
  await expect(page.getByText('Correction Phase 11')).toBeVisible();
  await expect(page.getByText('Resoumission Phase 11')).toBeVisible();
});

test('Self reviewer decisions are absent from UI and blocked server-side', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${selfSubmittedId}`);
  await expect(page.getByRole('button', { name: 'Valider la depense' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rejeter la depense' })).toHaveCount(0);

  for (const attempt of [
    { action: 'validate', comment: 'Tentative auto-validation Phase 11' },
    { action: 'reject', comment: 'Tentative auto-rejet Phase 11' }
  ]) {
    const response = await postExpenseAction(page, selfSubmittedId, attempt.action, attempt.comment);
    expect(response.status()).toBe(403);
    expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${selfSubmittedId}`))).toBe(1);
    expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${selfSubmittedId} AND comment = '${attempt.comment}'`))).toBe(0);
  }
});

test('Tampered create POST with mismatched project and convention is rejected server-side', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/expenses.php');
  const token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const mismatchedConventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-RED-2026-001' AND entity = 1 LIMIT 1");
  const budgetLineId = scalar("SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-JE-002' AND entity = 1 LIMIT 1");

  const response = await page.request.post('/custom/mjlfinancement/expenses.php', {
    form: {
      token,
      action: 'create',
      ref: 'P11-TAMPER-MISMATCH',
      fk_project: projectId,
      fk_convention: mismatchedConventionId,
      fk_budget_line: budgetLineId,
      amount: '1000',
      expense_date: '2026-06-24',
      description: 'Depense Phase 11 rattachement incoherent'
    },
    maxRedirects: 0
  });

  expect(response.status()).toBe(302);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_expense WHERE ref = 'P11-TAMPER-MISMATCH' AND entity = 1"))).toBe(0);
});

test('DPAF, Admin, and read-only visibility stays role-aware', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${submittedMissingId}`);
  await expect(page.getByRole('heading', { name: 'P11-SUBMITTED-MISS' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Valider la depense' })).toHaveCount(0);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/expenses.php');
  await expect(page.getByText('Portefeuille MJL')).toBeVisible();

  await login(page, 'lecteur.audit');
  await page.goto('/custom/mjlfinancement/expenses.php');
  await expect(page.getByText('Consultation')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});
