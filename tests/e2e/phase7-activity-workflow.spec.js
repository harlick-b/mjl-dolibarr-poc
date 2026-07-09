const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
let createdActivityId = 0;
let otherActivityId = 0;
let submittedActivityId = 0;
let correctionActivityId = 0;
let entityTwoActivityId = 0;
let adminSubmittedActivityId = 0;

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

function seedPhase7Files() {
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_expense && rm -f /var/www/documents/ecm/mjlfinancement_expense/P7-*.pdf && printf "%s" "Phase 7 expense document" > /var/www/documents/ecm/mjlfinancement_expense/P7-EXP-DOC.pdf\'');
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

async function activityPostToken(page, activityId) {
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  const tokenInput = page.locator('input[name="token"]').first();
  if (await tokenInput.count()) {
    const token = await tokenInput.getAttribute('value');
    if (token) return token;
  }
  const metaToken = await page.locator('meta[name="anti-csrf-newtoken"]').getAttribute('content');
  expect(metaToken).toBeTruthy();
  return metaToken;
}

async function postActivityAction(page, activityId, action, comment) {
  const token = await activityPostToken(page, activityId);
  return page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: {
      token,
      action,
      id: String(activityId),
      comment
    },
    maxRedirects: 0
  });
}

async function expectOptionDisabled(page, selectName, optionText, disabled) {
  const isDisabled = await page.locator(`select[name="${selectName}"] option`, { hasText: optionText }).evaluate((option) => option.disabled);
  expect(isDisabled).toBe(disabled);
}

function cleanupPhase7Fixtures() {
  sql(`
    SET @phase7_ids = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'P7-%');
    SET @phase7_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase7.otheragent');
    DELETE FROM llx_ecm_files WHERE src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P7-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P7-%';
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@phase7_ids, ''));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P7-%';
    DELETE FROM llx_usergroup_user WHERE fk_user = @phase7_user;
    DELETE FROM llx_user WHERE rowid = @phase7_user;
  `);
}

function seedPhase7Fixtures() {
  sql(`
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase7.otheragent', 'Phase7', 'Autre', 'mjl.phase7.otheragent@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @other_agent = LAST_INSERT_ID();
    SET @agent_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL POC - Agent' AND entity = 1 LIMIT 1);
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @other_agent, @agent_group);
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @budget_line = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-JE-002' AND entity = 1 LIMIT 1);

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P7-OTHER-OWNED', 'Activite Phase 7 autre agent', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @other_agent, 'P7OTHER', 0),
      (1, 'P7-SUBMITTED', 'Activite Phase 7 a valider', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @agent, 'P7SUBMIT', 3),
      (1, 'P7-CORRECTION', 'Activite Phase 7 correction', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @agent, 'P7CORR', 3),
      (1, 'P7-ADMIN-SUBMITTED', 'Activite Phase 7 admin proprietaire', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @admin, 'P7ADMIN', 3),
      (2, 'P7-ENTITY-TWO', 'Activite Phase 7 autre entite', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @agent, 'P7ENT2', 3);

    SET @submitted = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P7-SUBMITTED' AND entity = 1);
    SET @correction = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P7-CORRECTION' AND entity = 1);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P7-EXP-DOC', @project, @convention, @submitted, @budget_line, 1000, '2026-06-24', 'Depense Phase 7 avec piece', 'P7-EXP-DOC.pdf', NOW(), @agent, 'P7EXPDOC', 1),
      (1, 'P7-EXP-MISS', @project, @convention, @submitted, @budget_line, 2000, '2026-06-24', 'Depense Phase 7 sans piece', NULL, NOW(), @agent, 'P7EXPMIS', 1);

    SET @expense_doc = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P7-EXP-DOC' AND entity = 1);
    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES ('P7-EXP-DOC-ECM', 'P7-EXP-DOC.pdf', 1, 'P7-EXP-DOC.pdf', 'mjlfinancement_expense', 'P7-EXP-DOC.pdf', 'Piece Phase 7 depense', 1, NOW(), @agent, 'mjlfinancement_expense', @expense_doc);
  `);
  otherActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P7-OTHER-OWNED' AND entity = 1`));
  submittedActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P7-SUBMITTED' AND entity = 1`));
  correctionActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P7-CORRECTION' AND entity = 1`));
  entityTwoActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P7-ENTITY-TWO' AND entity = 2`));
  adminSubmittedActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P7-ADMIN-SUBMITTED' AND entity = 1`));
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase7Fixtures();
  seedPhase7Fixtures();
  seedPhase7Files();
});

test.afterAll(() => {
  cleanupPhase7Fixtures();
});

test('Level 1 creates, opens, submits, and sees timeline updates', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.getByRole('heading', { name: 'Suivi des activites et decisions' })).toBeVisible();
  await expect(page.getByText('Mes activites')).toBeVisible();

  await page.getByLabel('Reference').fill('P7-UI-CREATE');
  await page.getByLabel('Libelle').fill('Activite Phase 7 creee par UI');
  await page.locator('select[name="fk_project"]').selectOption({ label: 'PRJ-JE-2026 - Projet Justice Enfants' });
  await page.locator('select[name="fk_convention"]').selectOption({ label: 'CONV-UNICEF-2026-001 - Convention UNICEF Justice Enfants 2026 (PRJ-JE-2026)' });
  await page.locator('input[name="date_start"]').fill('2026-06-20');
  await page.locator('input[name="date_end"]').fill('2026-07-28');
  await page.getByLabel('Execution physique (%)').fill('25');
  await page.locator('select[name="execution_status"]').selectOption('in_progress');
  await page.getByRole('button', { name: 'Creer l activite' }).click();

  await expect(page).toHaveURL(/activities\.php\?id=\d+/);
  createdActivityId = Number(new URL(page.url()).searchParams.get('id'));
  await expect(page.getByRole('heading', { name: /P7-UI-CREATE/ })).toBeVisible();
  await expect(page.getByText('Brouillon').first()).toBeVisible();
  await expect(page.getByText('25% - Partiellement exécutée')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historique de decision' })).toBeVisible();
  await expect(page.getByText('Activite creee', { exact: true })).toBeVisible();

  await page.getByLabel('Commentaire de soumission').fill('Soumission Phase 7');
  await page.getByRole('button', { name: 'Soumettre l activite' }).click();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await expect(page.getByText('Soumission', { exact: true })).toBeVisible();
  await expect(page.getByText('Soumission Phase 7')).toBeVisible();
});

test('Create form filters conventions and tasks by selected project', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');
  const justiceProjectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const redProjectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-RED-2026' AND entity = 1 LIMIT 1");

  await page.locator('select[name="fk_project"]').selectOption(justiceProjectId);
  await expectOptionDisabled(page, 'fk_convention', 'CONV-UNICEF-2026-001', false);
  await expectOptionDisabled(page, 'fk_convention', 'CONV-RED-2026-001', true);
  await expectOptionDisabled(page, 'fk_task', 'ACT-JE-001', false);
  await expectOptionDisabled(page, 'fk_task', 'ACT-RED-001', true);

  await page.locator('select[name="fk_project"]').selectOption(redProjectId);
  await expectOptionDisabled(page, 'fk_convention', 'CONV-UNICEF-2026-001', true);
  await expectOptionDisabled(page, 'fk_convention', 'CONV-RED-2026-001', false);
  await expectOptionDisabled(page, 'fk_task', 'ACT-JE-001', true);
  await expectOptionDisabled(page, 'fk_task', 'ACT-RED-001', false);
});

test('Tampered create POST with mismatched project and convention is rejected server-side', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');
  const token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const mismatchedConventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-RED-2026-001' AND entity = 1 LIMIT 1");

  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token,
      action: 'create',
      ref: 'P7-TAMPER-MISMATCH',
      label: 'Activite Phase 7 rattachement incoherent',
      fk_project: projectId,
      fk_convention: mismatchedConventionId,
      fk_task: '',
      date_start: '2026-06-20',
      date_end: '2026-06-28'
    },
    maxRedirects: 0
  });

  expect(response.status()).toBe(302);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE ref = 'P7-TAMPER-MISMATCH' AND entity = 1"))).toBe(0);
});

test('Invalid physical execution percentage is rejected server-side', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');
  const token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const conventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1");

  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token,
      action: 'create',
      ref: 'P7-INVALID-PERCENT',
      label: 'Activite Phase 7 pourcentage invalide',
      fk_project: projectId,
      fk_convention: conventionId,
      physical_execution_percent: '120',
      execution_status: 'in_progress'
    },
    maxRedirects: 0
  });

  expect(response.status()).toBe(302);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE ref = 'P7-INVALID-PERCENT' AND entity = 1"))).toBe(0);
});

test('Level 1 cannot open another operational user activity or another entity activity', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${otherActivityId}`);
  await expectAccessDenied(page);

  await page.goto(`/custom/mjlfinancement/activities.php?id=${entityTwoActivityId}`);
  await expectAccessDenied(page);
});

test('Level 2 prevalidates submitted activity, then final validator validates it', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${submittedActivityId}`);
  await expect(page.getByRole('heading', { name: /P7-SUBMITTED/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pieces justificatives des depenses liees' })).toBeVisible();
  await expect(page.getByText('1 avec piece')).toBeVisible();
  await expect(page.getByText('1 piece(s) manquante(s)')).toBeVisible();
  await expect(page.getByText('P7-EXP-DOC')).toBeVisible();
  await expect(page.getByText('P7-EXP-MISS')).toBeVisible();

  await page.getByLabel('Commentaire de prevalidation').fill('Prevalidation Phase 7');
  await page.getByRole('button', { name: 'Prevalider l activite' }).click();
  await expect(page.getByText('Prevalidee').first()).toBeVisible();
  await expect(page.getByText('Prevalidation Phase 7')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Validation definitive' })).toHaveCount(0);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${submittedActivityId}`);
  await page.getByLabel('Commentaire de validation definitive').fill('Validation definitive Phase 7');
  await page.getByRole('button', { name: 'Validation definitive' }).click();
  await expect(page.getByText('Validee definitivement').first()).toBeVisible();
  await expect(page.getByText('Validation definitive Phase 7')).toBeVisible();
});

test('Return for correction preserves previous decision through correction and resubmission', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${correctionActivityId}`);
  await page.getByLabel('Motif de correction').fill('Motif correction Phase 7');
  await page.getByRole('button', { name: 'Retourner pour correction' }).click();
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_activity WHERE rowid = ${correctionActivityId}`))).toBe(4);
  await expect(page.getByText('Correction demandee', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Motif correction Phase 7')).toBeVisible();

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${correctionActivityId}`);
  await expect(page.getByText('Correction demandee', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer la correction' })).toBeVisible();
  await page.locator('input[name="label"]').fill('Activite Phase 7 corrigee');
  await page.locator('input[name="comment"]').first().fill('Libelle corrige Phase 7');
  await page.getByRole('button', { name: 'Enregistrer la correction' }).click();
  await expect(page.getByText('Libelle corrige Phase 7')).toBeVisible();

  await page.getByLabel('Commentaire de correction').fill('Correction terminee Phase 7');
  await page.getByRole('button', { name: 'Marquer corrigee' }).click();
  await expect(page.getByText('Corrigee').first()).toBeVisible();

  await page.getByLabel('Commentaire de soumission').fill('Resoumission Phase 7');
  await page.getByRole('button', { name: 'Soumettre l activite' }).click();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await expect(page.getByText('Motif correction Phase 7')).toBeVisible();
  await expect(page.getByText('Resoumission Phase 7')).toBeVisible();
});

test('Self reviewer decisions are absent from UI and blocked server-side', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${adminSubmittedActivityId}`);
  await expect(page.getByRole('button', { name: 'Prevalider l activite' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Validation definitive' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Valider l activite' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retourner pour correction' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rejeter l activite' })).toHaveCount(0);

  for (const attempt of [
    { action: 'prevalidate', comment: 'Tentative auto-prevalidation Phase 7' },
    { action: 'final_validate', comment: 'Tentative auto-validation-definitive Phase 7' },
    { action: 'validate', comment: 'Tentative auto-validation Phase 7' },
    { action: 'request_correction', comment: 'Tentative auto-correction Phase 7' },
    { action: 'reject', comment: 'Tentative auto-rejet Phase 7' }
  ]) {
    const response = await postActivityAction(page, adminSubmittedActivityId, attempt.action, attempt.comment);
    expect(response.status()).toBe(403);
    expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_activity WHERE rowid = ${adminSubmittedActivityId}`))).toBe(3);
    expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${adminSubmittedActivityId} AND comment = '${attempt.comment}'`))).toBe(0);
  }
});

test('DPAF, Admin, and unresolved legacy reader visibility stays role-aware', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${submittedActivityId}`);
  await expect(page.getByRole('heading', { name: /P7-SUBMITTED/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Valider l activite' })).toHaveCount(0);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.getByText('Portefeuille MJL')).toBeVisible();

  await login(page, 'lecteur.audit');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expectAccessDenied(page);
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});
