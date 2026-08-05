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

function relativeDate(daysFromToday) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function seedActivityWorkflowFiles() {
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_expense && rm -f /var/www/documents/ecm/mjlfinancement_expense/ACTW-*.pdf && printf "%s" "Activity workflow expense document" > /var/www/documents/ecm/mjlfinancement_expense/ACTW-EXP-DOC.pdf\'');
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

function cleanupActivityWorkflowFixtures() {
  sql(`
    SET @activity_workflow_ids = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'ACTW-%');
    SET @activity_workflow_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.activity_workflow.otheragent');
    DELETE FROM llx_ecm_files WHERE src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'ACTW-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'ACTW-%';
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@activity_workflow_ids, ''));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'ACTW-%';
    DELETE FROM llx_usergroup_user WHERE fk_user = @activity_workflow_user;
    DELETE FROM llx_user WHERE rowid = @activity_workflow_user;
  `);
}

function seedActivityWorkflowFixtures() {
  sql(`
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.activity_workflow.otheragent', 'ActivityWorkflow', 'Autre', 'mjl.activity_workflow.otheragent@mjl-poc.local', pass_crypted, 1, 0, NOW()
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
      (1, 'ACTW-OTHER-OWNED', 'Activite Activity workflow autre agent', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @other_agent, 'ACTWOTHER', 0),
      (1, 'ACTW-SUBMITTED', 'Activite Activity workflow a valider', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @agent, 'ACTWSUBMIT', 3),
      (1, 'ACTW-CORRECTION', 'Activite Activity workflow correction', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @agent, 'ACTWCORR', 3),
      (1, 'ACTW-ADMIN-SUBMITTED', 'Activite Activity workflow admin proprietaire', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @admin, 'ACTWADMIN', 3),
      (2, 'ACTW-ENTITY-TWO', 'Activite Activity workflow autre entite', @project, @convention, '2026-06-20', '2026-06-28', NOW(), @agent, 'ACTWENT2', 3);

    SET @submitted = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACTW-SUBMITTED' AND entity = 1);
    SET @correction = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACTW-CORRECTION' AND entity = 1);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'ACTW-EXP-DOC', @project, @convention, @submitted, @budget_line, 1000, '2026-06-24', 'Depense Activity workflow avec piece', 'ACTW-EXP-DOC.pdf', NOW(), @agent, 'ACTWEXPDOC', 1),
      (1, 'ACTW-EXP-MISS', @project, @convention, @submitted, @budget_line, 2000, '2026-06-24', 'Depense Activity workflow sans piece', NULL, NOW(), @agent, 'ACTWEXPMIS', 1);

    SET @expense_doc = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'ACTW-EXP-DOC' AND entity = 1);
    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES ('ACTW-EXP-DOC-ECM', 'ACTW-EXP-DOC.pdf', 1, 'ACTW-EXP-DOC.pdf', 'mjlfinancement_expense', 'ACTW-EXP-DOC.pdf', 'Piece Activity workflow depense', 1, NOW(), @agent, 'mjlfinancement_expense', @expense_doc);
  `);
  otherActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACTW-OTHER-OWNED' AND entity = 1`));
  submittedActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACTW-SUBMITTED' AND entity = 1`));
  correctionActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACTW-CORRECTION' AND entity = 1`));
  entityTwoActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACTW-ENTITY-TWO' AND entity = 2`));
  adminSubmittedActivityId = Number(scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACTW-ADMIN-SUBMITTED' AND entity = 1`));
}

test.beforeAll(() => {
  cleanupActivityWorkflowFixtures();
  seedActivityWorkflowFixtures();
  seedActivityWorkflowFiles();
});

test.afterAll(() => {
  cleanupActivityWorkflowFixtures();
});

test('Data-entry agent creates, opens, submits, and sees timeline updates', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.getByRole('heading', { name: 'Suivi des activités et décisions' })).toBeVisible();
  await expect(page.getByText('Mes activités')).toBeVisible();
  await page.getByRole('link', { name: 'Créer une activité' }).click();

  await page.getByLabel('Référence').fill('ACTW-UI-CREATE');
  await page.getByLabel('Libellé').fill('Activite Activity workflow creee par UI');
  await page.locator('select[name="fk_project"]').selectOption({ label: 'PRJ-JE-2026 - Projet Justice Enfants' });
  await page.locator('select[name="fk_convention"]').selectOption({ label: 'CONV-UNICEF-2026-001 - Convention UNICEF Justice Enfants 2026 (PRJ-JE-2026)' });
  await page.locator('input[name="date_start"]').fill('2026-06-20');
  await page.locator('input[name="date_end"]').fill(relativeDate(14));
  await page.getByLabel('Exécution physique (%)').fill('25');
  await page.locator('select[name="execution_status"]').selectOption('in_progress');
  await page.getByRole('button', { name: 'Créer l’activité' }).click();

  await expect(page).toHaveURL(/activities\.php\?id=\d+/);
  createdActivityId = Number(new URL(page.url()).searchParams.get('id'));
  await expect(page.getByRole('heading', { name: /ACTW-UI-CREATE/ })).toBeVisible();
  await expect(page.getByText('Brouillon').first()).toBeVisible();
  await expect(page.getByText('25% - Partiellement exécutée')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historique de décision' })).toBeVisible();
  await expect(page.getByText('Activité créée', { exact: true })).toBeVisible();

  await page.getByLabel('Commentaire de soumission').fill('Soumission Activity workflow');
  await page.getByRole('button', { name: 'Soumettre l activité' }).click();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await expect(page.getByText('Soumission', { exact: true })).toBeVisible();
  await expect(page.getByText('Soumission Activity workflow')).toBeVisible();
});

test('Create form filters conventions and tasks by selected project', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
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

test('JavaScript-disabled create recovers a server-invalid date relationship with ASCII form keys', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await login(page, 'agent.mjl');
    await page.goto('/custom/mjlfinancement/activities.php?action=create');
    await page.getByLabel('Référence').fill('ACTW-NOJS-DATE');
    await page.getByLabel('Libellé').fill('Activité sans JavaScript avec dates invalides');
    await page.locator('select[name="fk_project"]').selectOption(scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1"));
    await page.locator('select[name="fk_convention"]').selectOption(scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1"));
    await page.locator('input[name="date_start"]').fill('2026-08-20');
    await page.locator('input[name="date_end"]').fill('2026-08-19');
    await page.getByRole('button', { name: 'Créer l’activité' }).click();
    await expect(page).toHaveURL(/activities\.php\?action=create&mjl_recovery=/);
    await expect(page.locator('#mjl-field-date_end-error')).toHaveText('La date de fin doit être postérieure ou égale à la date de début.');
    await expect(page.locator('input[name="ref"]')).toHaveValue('ACTW-NOJS-DATE');
    await expect(page.locator('form[data-mjl-form="activity-create"]')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Ajoutéz|Depensé/);
    await expect(page.locator('[name*="é"], [data-mjl-form*="é"]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('activity aggregate failures stay unavailable instead of becoming zero or operation feedback', async ({ page }) => {
  await login(page, 'agent.mjl');
  sql('RENAME TABLE llx_mjlfinancement_budget_line TO llx_mjlfinancement_budget_line_actw_failure');
  try {
    await page.goto(`/custom/mjlfinancement/activities.php?id=${submittedActivityId}`);
    await expect(page.getByText('Budget rattaché').locator('xpath=..')).toContainText('Indisponible');
    await expect(page.locator('body')).not.toContainText('0 ligne(s), 0 F CFA');
    await expect(page.locator('body')).not.toContainText('Action enregistrée');
  } finally {
    sql('RENAME TABLE llx_mjlfinancement_budget_line_actw_failure TO llx_mjlfinancement_budget_line');
  }

  sql('RENAME TABLE llx_mjlfinancement_expense TO llx_mjlfinancement_expense_actw_failure');
  try {
    await page.goto(`/custom/mjlfinancement/activities.php?id=${submittedActivityId}`);
    await expect(page.getByText('Documents liés indisponibles')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('0 dépense(s) liée(s)');
  } finally {
    sql('RENAME TABLE llx_mjlfinancement_expense_actw_failure TO llx_mjlfinancement_expense');
  }
});

test('Tampered create POST with mismatched project and convention is rejected server-side', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  const token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const mismatchedConventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-RED-2026-001' AND entity = 1 LIMIT 1");

  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token,
      action: 'create',
      ref: 'ACTW-TAMPER-MISMATCH',
      label: 'Activite Activity workflow rattachement incoherent',
      fk_project: projectId,
      fk_convention: mismatchedConventionId,
      fk_task: '',
      date_start: '2026-06-20',
      date_end: '2026-06-28'
    },
    maxRedirects: 0
  });

  expect(response.status()).toBe(302);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE ref = 'ACTW-TAMPER-MISMATCH' AND entity = 1"))).toBe(0);
});

test('Invalid physical execution percentage is rejected server-side', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  const token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const conventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1");

  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token,
      action: 'create',
      ref: 'ACTW-INVALID-PERCENT',
      label: 'Activite Activity workflow pourcentage invalide',
      fk_project: projectId,
      fk_convention: conventionId,
      physical_execution_percent: '120',
      execution_status: 'in_progress'
    },
    maxRedirects: 0
  });

  expect(response.status()).toBe(302);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE ref = 'ACTW-INVALID-PERCENT' AND entity = 1"))).toBe(0);
});

test('Data-entry agent cannot open another operational user activity or another entity activity', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${otherActivityId}`);
  await expectAccessDenied(page);

  await page.goto(`/custom/mjlfinancement/activities.php?id=${entityTwoActivityId}`);
  await expectAccessDenied(page);
});

test('Verifier prevalidates submitted activity, then final validator validates it', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${submittedActivityId}`);
  await expect(page.getByRole('heading', { name: /ACTW-SUBMITTED/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pièces justificatives des dépenses liées' })).toBeVisible();
  await expect(page.getByText('1 avec pièce')).toBeVisible();
  await expect(page.getByText('1 pièce(s) manquante(s)')).toBeVisible();
  await expect(page.getByText('ACTW-EXP-DOC')).toBeVisible();
  await expect(page.getByText('ACTW-EXP-MISS')).toBeVisible();

  await page.getByRole('link', { name: 'Prévalider l’activité' }).click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${submittedActivityId}&action=prevalidate$`));
  await page.getByLabel('Commentaire de prévalidation').fill('Prevalidation Activity workflow');
  await page.getByRole('button', { name: 'Prévalider l’activité' }).click();
  await expect(page.getByText('Prévalidée').first()).toBeVisible();
  await expect(page.getByText('Prevalidation Activity workflow')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Valider définitivement l’activité', exact: true })).toHaveCount(0);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${submittedActivityId}`);
  await page.getByRole('link', { name: 'Valider définitivement l’activité' }).click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${submittedActivityId}&action=final_validate$`));
  await page.getByLabel('Commentaire de validation définitive').fill('Validation definitive Activity workflow');
  await page.getByRole('button', { name: 'Valider définitivement l’activité' }).click();
  await expect(page.getByText('Validée définitivement').first()).toBeVisible();
  await expect(page.getByText('Validation definitive Activity workflow')).toBeVisible();
});

test('Return for correction preserves previous decision through correction and resubmission', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${correctionActivityId}`);
  await page.getByRole('link', { name: 'Retourner pour correction' }).click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${correctionActivityId}&action=request_correction$`));
  await page.getByLabel('Motif de correction').fill('Motif correction Activity workflow');
  await page.getByRole('button', { name: 'Retourner pour correction' }).click();
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_activity WHERE rowid = ${correctionActivityId}`))).toBe(4);
  await expect(page.getByText('Correction demandée', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Motif correction Activity workflow')).toBeVisible();

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${correctionActivityId}`);
  await expect(page.getByText('Correction demandée', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Modifier l’activité' }).click();
  await expect(page.getByRole('button', { name: 'Enregistrer la correction' })).toBeVisible();
  await page.getByLabel('Libellé').fill('Activite Activity workflow corrigee');
  await page.getByLabel('Motif de modification').fill('Libelle corrige Activity workflow');
  await page.getByRole('button', { name: 'Enregistrer la correction' }).click();
  await expect(page.getByText('Libelle corrige Activity workflow')).toBeVisible();

  await page.getByLabel('Commentaire de correction').fill('Correction terminee Activity workflow');
  await page.getByRole('button', { name: 'Marquer corrigee' }).click();
  await expect(page.getByText('Corrigée').first()).toBeVisible();

  await page.getByLabel('Commentaire de soumission').fill('Resoumission Activity workflow');
  await page.getByRole('button', { name: 'Soumettre l activité' }).click();
  await expect(page.getByText('Soumise').first()).toBeVisible();
  await expect(page.getByText('Motif correction Activity workflow')).toBeVisible();
  await expect(page.getByText('Resoumission Activity workflow')).toBeVisible();
});

test('Self reviewer decisions are absent from UI and blocked server-side', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${adminSubmittedActivityId}`);
  for (const label of [
    'Prévalider l’activité',
    'Valider définitivement l’activité',
    'Valider l’activité',
    'Retourner pour correction',
    'Rejeter l’activité',
  ]) {
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  }

  for (const attempt of [
    { action: 'prevalidate', comment: 'Tentative auto-prevalidation Activity workflow' },
    { action: 'final_validate', comment: 'Tentative auto-validation-definitive Activity workflow' },
    { action: 'validate', comment: 'Tentative auto-validation Activity workflow' },
    { action: 'request_correction', comment: 'Tentative auto-correction Activity workflow' },
    { action: 'reject', comment: 'Tentative auto-rejet Activity workflow' }
  ]) {
    const response = await postActivityAction(page, adminSubmittedActivityId, attempt.action, attempt.comment);
    expect(response.status()).toBe(403);
    expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_activity WHERE rowid = ${adminSubmittedActivityId}`))).toBe(3);
    expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${adminSubmittedActivityId} AND comment = '${attempt.comment}'`))).toBe(0);
  }
});

test('Final validator, Admin, and unresolved legacy reader visibility stays role-aware', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${submittedActivityId}`);
  await expect(page.getByRole('heading', { name: /ACTW-SUBMITTED/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Valider l’activité', exact: true })).toHaveCount(0);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.getByText('Portefeuille MJL')).toBeVisible();

  await login(page, 'lecteur.audit');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expectAccessDenied(page);
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});
