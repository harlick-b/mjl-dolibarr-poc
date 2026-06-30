const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test.describe.configure({ mode: 'serial' });

function dockerExec(command) {
  return execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
}

function sql(query) {
  dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`);
}

function seedPhase9Files() {
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_expense && rm -f /var/www/documents/ecm/mjlfinancement_expense/P9-*.pdf && printf "%s" "Phase 9 submitted expense document" > /var/www/documents/ecm/mjlfinancement_expense/P9-EXP-SUBMITTED.pdf\'');
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

function cleanupPhase9Fixtures() {
  sql(`
    SET @phase9_workflow_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase9.workflowonly');
    SET @phase9_workflow_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL Phase 9 - Workflow Read' AND entity = 1);
    SET @phase9_activity_ids = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'P9-%');
    DELETE FROM llx_ecm_files WHERE src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P9-%');
    DELETE FROM llx_mjlfinancement_validation WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'P9-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P9-%';
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@phase9_activity_ids, ''));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P9-%';
    DELETE FROM llx_usergroup_user WHERE fk_user = @phase9_workflow_user OR fk_usergroup = @phase9_workflow_group;
    DELETE FROM llx_usergroup_rights WHERE fk_usergroup = @phase9_workflow_group;
    DELETE FROM llx_user WHERE rowid = @phase9_workflow_user;
    DELETE FROM llx_usergroup WHERE rowid = @phase9_workflow_group;
  `);
}

function seedPhase9Fixtures() {
  sql(`
    INSERT INTO llx_usergroup (entity, nom, note) VALUES (1, 'MJL Phase 9 - Workflow Read', 'Phase 9 reports access E2E');
    SET @workflow_group = LAST_INSERT_ID();
    SET @workflow_right = (SELECT id FROM llx_rights_def WHERE module = 'mjlfinancement' AND perms = 'workflowaction' AND subperms = 'read' AND entity IN (0, 1) ORDER BY entity DESC LIMIT 1);
    INSERT INTO llx_usergroup_rights (entity, fk_usergroup, fk_id) VALUES (1, @workflow_group, @workflow_right);
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase9.workflowonly', 'Phase9', 'Workflow', 'mjl.phase9.workflowonly@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @workflow_user = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @workflow_user, @workflow_group);

    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @budget_line = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-JE-002' AND entity = 1 LIMIT 1);

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P9-ACT-SUBMITTED', 'Activite Phase 9 export', @project, @convention, '2026-06-10', '2026-06-20', NOW(), @agent, 'P9ACTSUB', 3),
      (2, 'P9-ENTITY-ACT', 'Activite Phase 9 autre entite', @project, @convention, '2026-06-10', '2026-06-20', NOW(), @agent, 'P9ENTACT', 3);
    SET @activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P9-ACT-SUBMITTED' AND entity = 1);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P9-EXP-SUBMITTED', @project, @convention, @activity, @budget_line, 123456, '2026-06-11', 'Depense Phase 9 export', 'P9-EXP-SUBMITTED.pdf', NOW(), NOW(), @agent, 'P9EXPSUB', 1),
      (2, 'P9-ENTITY-EXP', @project, @convention, NULL, @budget_line, 654321, '2026-06-11', 'Depense Phase 9 autre entite', NULL, NOW(), NOW(), @agent, 'P9ENTEXP', 1);

    SET @expense_doc = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P9-EXP-SUBMITTED' AND entity = 1);
    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES ('P9-EXP-SUBMITTED-ECM', 'P9-EXP-SUBMITTED.pdf', 1, 'P9-EXP-SUBMITTED.pdf', 'mjlfinancement_expense', 'P9-EXP-SUBMITTED.pdf', 'Piece Phase 9 depense export', 1, NOW(), @agent, 'mjlfinancement_expense', @expense_doc);
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase9Fixtures();
  seedPhase9Fixtures();
  seedPhase9Files();
});

test.afterAll(() => {
  cleanupPhase9Fixtures();
});

test('reports access stays limited to DPAF and Admin', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/reports.php');
  await expectAccessDenied(page);

  await login(page, 'superviseur.n1');
  await page.goto('/custom/mjlfinancement/reports.php');
  await expectAccessDenied(page);

  await login(page, 'lecteur.audit');
  await page.goto('/custom/mjlfinancement/reports.php');
  await expectAccessDenied(page);

  await login(page, 'mjl.phase9.workflowonly');
  await page.goto('/custom/mjlfinancement/reports.php');
  await expectAccessDenied(page);

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();
});

test('report metadata, required filters, and unsupported filters are explicit', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/reports.php');

  await expect(page.getByText('Comparer budget, fonds recus et depenses pour un projet selectionne.')).toBeVisible();
  await expect(page.getByText('CSV compatible Excel')).toBeVisible();
  await expect(page.getByText('Selection requise avant export: Projet.')).toBeVisible();
  await expect(page.locator('select[name="project_id"]')).toHaveCount(1);
  await expect(page.locator('select[name="convention_id"]')).toHaveCount(0);
  await expect(page.locator('select[name="status"]')).toHaveCount(0);

  await page.goto('/custom/mjlfinancement/reports.php?report=convention_budget');
  await expect(page.getByText('Selection requise avant export: Convention.')).toBeVisible();
  await expect(page.locator('select[name="convention_id"]')).toHaveCount(1);
  await expect(page.locator('select[name="status"]')).toHaveCount(0);

  await page.goto('/custom/mjlfinancement/reports.php?report=workflow_actions');
  await expect(page.getByText('Exporter les decisions et transitions auditees')).toBeVisible();
  await expect(page.locator('select[name="project_id"]')).toHaveCount(0);
  await expect(page.locator('select[name="convention_id"]')).toHaveCount(0);
  await expect(page.locator('select[name="status"]')).toHaveCount(0);
  await expect(page.locator('input[name="date_start"]')).toHaveCount(1);
});

test('filtered activity preview and CSV export share filters, filename, and entity scope', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/reports.php?report=activities&status=3&date_start=2026-06-01&date_end=2026-06-30');

  await expect(page.getByText('Exporter les activites, leur statut')).toBeVisible();
  await expect(page.getByText('Statut: Soumise')).toBeVisible();
  await expect(page.getByText('Debut: 01/06/2026')).toBeVisible();
  await expect(page.getByText('Fin: 30/06/2026')).toBeVisible();
  const activityRow = page.locator('tr', { hasText: 'P9-ACT-SUBMITTED' });
  await expect(activityRow).toBeVisible();
  await expect(activityRow).toContainText('Soumise');
  await expect(page.locator('body')).not.toContainText('P9-ENTITY-ACT');
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);

  const previewFilename = (await page.getByTestId('mjl-report-filename').innerText()).trim();
  expect(previewFilename).toBe('mjl_suivi_activites_2026-06-01_2026-06-30_statut-3.csv');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(previewFilename);

  const path = await download.path();
  const csv = fs.readFileSync(path);
  expect(csv.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
  const text = csv.toString('utf8');
  expect(text).toContain('Reference activite');
  expect(text).toContain('Titre activite');
  expect(text).toContain('P9-ACT-SUBMITTED');
  expect(text).toContain('Soumise');
  expect(text).not.toContain('P9-ENTITY-ACT');
  expect(text).toContain(';');
});

test('expense report exports French-readable statuses and document flags', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/reports.php?report=expense_documents&status=1&date_start=2026-06-01&date_end=2026-06-30');

  const expenseRow = page.locator('tr', { hasText: 'P9-EXP-SUBMITTED' });
  await expect(expenseRow).toBeVisible();
  await expect(expenseRow).toContainText('Soumise');
  await expect(expenseRow).toContainText('Oui');
  await expect(page.locator('body')).not.toContainText('P9-ENTITY-EXP');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le CSV' }).click();
  const download = await downloadPromise;
  const csv = fs.readFileSync(await download.path()).toString('utf8');
  expect(csv).toContain('P9-EXP-SUBMITTED');
  expect(csv).toContain('Soumise');
  expect(csv).toContain('Oui');
  expect(csv).not.toContain('P9-ENTITY-EXP');
});

test('forced export without required filters is refused server-side', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  const downloadPromise = page.waitForEvent('download', { timeout: 1500 }).then(() => 'downloaded').catch(() => 'no-download');
  await page.goto('/custom/mjlfinancement/reports.php?report=project_summary&action=export_csv').catch(() => {});
  await expect(page.locator('body')).toContainText(/Selection requise avant export|Acces refuse|Accès refusé|Access denied|Forbidden/);
  expect(await downloadPromise).toBe('no-download');
});
