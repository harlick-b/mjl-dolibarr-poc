const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
let validateActivityId = 0;

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

function seedPhase8Files() {
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_expense && rm -f /var/www/documents/ecm/mjlfinancement_expense/P8-*.pdf && printf "%s" "Phase 8 submitted expense document" > /var/www/documents/ecm/mjlfinancement_expense/P8-SUBMITTED-EXP.pdf\'');
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

function cleanupPhase8Fixtures() {
  sql(`
    SET @phase8_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase8.otheragent');
    SET @phase8_workflow_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase8.workflowonly');
    SET @phase8_workflow_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL Phase 8 - Workflow Read' AND entity = 1);
    SET @phase8_activity_ids = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'P8-%');
    DELETE FROM llx_ecm_files WHERE src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P8-%');
    DELETE FROM llx_mjlfinancement_validation WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P8-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P8-%';
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@phase8_activity_ids, ''));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P8-%';
    DELETE FROM llx_usergroup_user WHERE fk_user IN (@phase8_user, @phase8_workflow_user) OR fk_usergroup = @phase8_workflow_group;
    DELETE FROM llx_usergroup_rights WHERE fk_usergroup = @phase8_workflow_group;
    DELETE FROM llx_user WHERE rowid IN (@phase8_user, @phase8_workflow_user);
    DELETE FROM llx_usergroup WHERE rowid = @phase8_workflow_group;
  `);
}

function seedPhase8Fixtures() {
  sql(`
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase8.otheragent', 'Phase8', 'Autre', 'mjl.phase8.otheragent@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @other_agent = LAST_INSERT_ID();
    SET @agent_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL POC - Agent' AND entity = 1 LIMIT 1);
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @other_agent, @agent_group);

    INSERT INTO llx_usergroup (entity, nom, note) VALUES (1, 'MJL Phase 8 - Workflow Read', 'Phase 8 alert visibility E2E');
    SET @workflow_group = LAST_INSERT_ID();
    SET @workflow_right = (SELECT id FROM llx_rights_def WHERE module = 'mjlfinancement' AND perms = 'workflowaction' AND subperms = 'read' AND entity IN (0, 1) ORDER BY entity DESC LIMIT 1);
    INSERT INTO llx_usergroup_rights (entity, fk_usergroup, fk_id) VALUES (1, @workflow_group, @workflow_right);
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase8.workflowonly', 'Phase8', 'Workflow', 'mjl.phase8.workflowonly@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @workflow_user = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @workflow_user, @workflow_group);

    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @budget_line = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-JE-002' AND entity = 1 LIMIT 1);

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P8-OWN-DUE', 'Alerte Phase 8 agent', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), NOW(), @agent, 'P8OWNDUE', 0),
      (1, 'P8-OTHER-DUE', 'Alerte Phase 8 autre agent', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 DAY), NOW(), @other_agent, 'P8OTHDUE', 0),
      (1, 'P8-SUBMITTED-ACT', 'Alerte Phase 8 a valider', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 DAY), NOW(), @agent, 'P8SUBACT', 3),
      (1, 'P8-VALIDATE-ME', 'Alerte Phase 8 disparition', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 DAY), NOW(), @agent, 'P8VALME', 3),
      (2, 'P8-ENTITY-TWO', 'Alerte Phase 8 autre entite', @project, @convention, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 DAY), NOW(), @agent, 'P8ENT2', 0);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P8-OWN-MISS-DOC', @project, @convention, NULL, @budget_line, 1000, CURDATE(), 'Piece Phase 8 manquante agent', NULL, NULL, NOW(), @agent, 'P8OWNDOC', 0),
      (1, 'P8-OTHER-MISS-DOC', @project, @convention, NULL, @budget_line, 2000, CURDATE(), 'Piece Phase 8 manquante autre agent', NULL, NULL, NOW(), @other_agent, 'P8OTHDOC', 0),
      (1, 'P8-SUBMITTED-EXP', @project, @convention, NULL, @budget_line, 3000, CURDATE(), 'Depense Phase 8 a valider', 'P8-SUBMITTED-EXP.pdf', NOW(), NOW(), @agent, 'P8SUBEXP', 1),
      (2, 'P8-ENTITY-EXP', @project, @convention, NULL, @budget_line, 4000, CURDATE(), 'Depense Phase 8 autre entite', NULL, NULL, NOW(), @agent, 'P8ENTEXP', 0);

    SET @expense_doc = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P8-SUBMITTED-EXP' AND entity = 1);
    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES ('P8-SUBMITTED-EXP-ECM', 'P8-SUBMITTED-EXP.pdf', 1, 'P8-SUBMITTED-EXP.pdf', 'mjlfinancement_expense', 'P8-SUBMITTED-EXP.pdf', 'Piece Phase 8 depense soumise', 1, NOW(), @agent, 'mjlfinancement_expense', @expense_doc);
  `);
  validateActivityId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P8-VALIDATE-ME' AND entity = 1"));
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase8Fixtures();
  seedPhase8Fixtures();
  seedPhase8Files();
});

test.afterAll(() => {
  cleanupPhase8Fixtures();
});

test('Level 1 sees only own operational alerts', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByText('Alertes actives')).toBeVisible();
  await page.goto('/custom/mjlfinancement/alerts.php');

  await expect(page.getByRole('heading', { name: 'Alertes MJL' })).toBeVisible();
  await expect(page.getByText('Mes actions')).toBeVisible();
  await expect(page.getByText('P8-OWN-DUE')).toBeVisible();
  await expect(page.getByText('P8-OWN-MISS-DOC')).toBeVisible();
  await expect(page.getByText('Piece manquante')).toBeVisible();
  await expect(page.getByText('Echeance proche').first()).toBeVisible();
  await expect(page.locator('article', { hasText: 'P8-OWN-DUE' })).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  await expect(page.locator('article', { hasText: 'P8-OWN-DUE' })).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await expect(page.locator('body')).not.toContainText('P8-OTHER-DUE');
  await expect(page.locator('body')).not.toContainText('P8-OTHER-MISS-DOC');
  await expect(page.locator('body')).not.toContainText('P8-ENTITY-TWO');
  await expect(page.locator('body')).not.toContainText('P8-ENTITY-EXP');
});

test('Level 2 sees validation alerts with actionable links', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto('/custom/mjlfinancement/alerts.php');

  await expect(page.getByText('File de validation')).toBeVisible();
  await expect(page.getByText('P8-SUBMITTED-ACT').first()).toBeVisible();
  await expect(page.getByText('P8-SUBMITTED-EXP').first()).toBeVisible();
  await expect(page.getByText('Decision attendue').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('P8-OWN-MISS-DOC');
  await expect(page.locator('body')).not.toContainText('P8-OTHER-DUE');

  const activityLink = page.locator('article', { hasText: 'P8-SUBMITTED-ACT' }).getByRole('link', { name: 'Ouvrir l objet concerne' }).first();
  await expect(activityLink).toHaveAttribute('href', /activities\.php\?id=\d+/);
});

test('DPAF and Admin see portfolio alerts', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.getByText('Portefeuille MJL')).toBeVisible();
  await expect(page.getByText('P8-OTHER-DUE').first()).toBeVisible();
  await expect(page.getByText('P8-OTHER-MISS-DOC').first()).toBeVisible();
  await expect(page.getByText('P8-SUBMITTED-ACT').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  const riskLink = page.locator('article', { hasText: 'P8-SUBMITTED-ACT' }).getByRole('link', { name: 'Ouvrir l activite' });
  await expect(riskLink).toHaveAttribute('href', /activities\.php\?id=\d+/);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.getByText('Portefeuille MJL')).toBeVisible();
  await expect(page.getByText('P8-SUBMITTED-EXP').first()).toBeVisible();
});

test('Activity alert disappears from verifier queue after prevalidation', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.getByText('P8-VALIDATE-ME').first()).toBeVisible();

  await page.goto(`/custom/mjlfinancement/activities.php?id=${validateActivityId}`);
  await page.getByLabel('Commentaire de prevalidation').fill('Prevalidation Phase 8');
  await page.getByRole('button', { name: 'Prevalider l activite' }).click();
  await expect(page.getByText('Prevalidee').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.locator('body')).not.toContainText('P8-VALIDATE-ME');
});

test('Read-only users keep bounded visibility and workflow-only users are blocked', async ({ page }) => {
  await login(page, 'lecteur.audit');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.getByText('Consultation')).toBeVisible();
  await expect(page.locator('body')).toContainText(/P8-OWN-DUE|P8-OTHER-DUE|Aucune alerte active/);
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);

  await login(page, 'mjl.phase8.workflowonly');
  await page.goto('/custom/mjlfinancement/alerts.php');
  await expectAccessDenied(page);
});
