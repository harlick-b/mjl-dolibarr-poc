const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const forbiddenResponsePattern = /Acces refuse|Accès refusé|Access denied|Forbidden|Non autorise|Non autorisé|hors de votre perimetre|hors de votre périmètre/i;

test.describe.configure({ mode: 'serial' });

function dockerExec(command) {
  return execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
}

function sql(query) {
  dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`);
}

function scalar(query) {
  return execSync(`docker compose exec -T mariadb mariadb -udolidbuser -ppoc_pwd -N -B dolidb -e "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

async function expectCardValue(page, label, value) {
  const card = page.locator('.mjl-dashboard-card').filter({ hasText: label });
  await expect(card.locator('.mjl-card-value')).toHaveText(String(value));
}

function cleanupPhase10R() {
  sql(`
    SET @phase10r_activities = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'P10R-%');
    SET @phase10r_expenses = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_expense WHERE ref LIKE 'P10R-%');
    SET @phase10r_budget_lines = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'P10R-%');
    SET @phase10r_receipts = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'P10R-%');
    DELETE FROM llx_mjlfinancement_validation WHERE FIND_IN_SET(fk_expense, COALESCE(@phase10r_expenses, ''));
    DELETE FROM llx_mjlfinancement_workflow_action WHERE (object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@phase10r_activities, ''))) OR (object_type = 'mjlfinancement_expense' AND FIND_IN_SET(object_id, COALESCE(@phase10r_expenses, ''))) OR (object_type = 'mjlfinancement_budget_line' AND FIND_IN_SET(object_id, COALESCE(@phase10r_budget_lines, ''))) OR (object_type = 'mjlfinancement_fund_receipt' AND FIND_IN_SET(object_id, COALESCE(@phase10r_receipts, ''))) OR ref LIKE 'P10R-%';
    DELETE FROM llx_ecm_files WHERE ref LIKE 'P10R-%' OR (src_object_type = 'mjlfinancement_expense' AND FIND_IN_SET(src_object_id, COALESCE(@phase10r_expenses, '')));
    DELETE FROM llx_mjlfinancement_exchange_log WHERE ref LIKE 'P10R-%';
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P10R-%';
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P10R-%';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'P10R-%';
    DELETE FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'P10R-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'P10R-%';
    DELETE FROM llx_projet WHERE ref LIKE 'P10R-%';
  `);
}

function seedPhase10RFixtures() {
  sql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @verifier = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' LIMIT 1);
    SET @final = (SELECT rowid FROM llx_user WHERE login = 'dpaf.mjl' LIMIT 1);
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1);
    SET @unicef = (SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1);
    SET @redev = (SELECT rowid FROM llx_societe WHERE nom LIKE 'Programme Redev%' AND entity = 1 LIMIT 1);

    UPDATE llx_mjlfinancement_user_role SET is_active = 0 WHERE entity = 1 AND fk_user IN (@agent, @verifier, @final);
    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @agent, 'AGENT_SAISIE', 1, CURDATE(), 'phase10r', 'Phase 10R dashboards', NOW(), @admin),
           (1, @verifier, 'AGENT_VERIFICATEUR', 1, CURDATE(), 'phase10r', 'Phase 10R dashboards', NOW(), @admin),
           (1, @final, 'VALIDATEUR_DEFINITIF', 1, CURDATE(), 'phase10r', 'Phase 10R dashboards', NOW(), @admin);
    UPDATE llx_mjlfinancement_user_soc_scope SET is_active = 0 WHERE entity = 1 AND fk_user IN (@agent, @verifier, @final);
    INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @agent, @unicef, 1, CURDATE(), 'phase10r', 'Phase 10R dashboards', NOW(), @admin),
           (1, @verifier, @unicef, 1, CURDATE(), 'phase10r', 'Phase 10R dashboards', NOW(), @admin),
           (1, @final, @unicef, 1, CURDATE(), 'phase10r', 'Phase 10R dashboards', NOW(), @admin);

    INSERT INTO llx_projet (entity, ref, title, fk_soc, fk_statut, datec, fk_user_creat)
    VALUES (1, 'P10R-PRJ-UNICEF', 'Projet Phase 10R UNICEF', @unicef, 1, NOW(), @admin),
           (1, 'P10R-PRJ-RED', 'Projet Phase 10R autre programme', @redev, 1, NOW(), @admin);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'P10R-PRJ-UNICEF' AND entity = 1);
    SET @red_project = (SELECT rowid FROM llx_projet WHERE ref = 'P10R-PRJ-RED' AND entity = 1);

    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, status, date_creation, fk_user_creat, import_key)
    VALUES (1, 'P10R-CONV-UNICEF', 'Phase 10R enveloppe UNICEF', @unicef, @project, '2026-07-01', '2026-12-31', 2000000, 'XOF', 1, NOW(), @admin, 'P10RCONVUNI'),
           (1, 'P10R-CONV-RED', 'Phase 10R enveloppe autre programme', @redev, @red_project, '2026-07-01', '2026-12-31', 2000000, 'XOF', 1, NOW(), @admin, 'P10RCONVRED');
    SET @conv = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P10R-CONV-UNICEF' AND entity = 1);
    SET @red_conv = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P10R-CONV-RED' AND entity = 1);

    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, initial_budget, revised_budget, category, status, date_creation, fk_user_creat, import_key)
    VALUES (1, 'P10R-BL-UNICEF', 'Budget Phase 10R UNICEF', @project, @conv, 1000, 1000, 'phase10r', 1, NOW(), @admin, 'P10RBLUNI'),
           (1, 'P10R-BL-RED', 'Budget Phase 10R autre programme', @red_project, @red_conv, 999999, 999999, 'phase10r', 1, NOW(), @admin, 'P10RBLRED');
    SET @bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P10R-BL-UNICEF' AND entity = 1);
    SET @red_bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P10R-BL-RED' AND entity = 1);

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, physical_execution_percent, date_creation, fk_user_creat, fk_user_responsible, import_key, status)
    VALUES (1, 'P10R-ACT-SUB', 'Activite Phase 10R a prevalider', @project, @conv, '2026-07-02', '2026-07-10', 25, NOW(), @agent, @agent, 'P10RACTSUB', 3),
           (1, 'P10R-ACT-PRE', 'Activite Phase 10R a valider definitivement', @project, @conv, '2026-07-02', '2026-07-12', 50, NOW(), @agent, @agent, 'P10RACTPRE', 7),
           (1, 'P10R-ACT-OVER', 'Activite Phase 10R en retard', @project, @conv, '2026-06-01', '2026-06-15', 10, NOW(), @agent, @agent, 'P10RACTOVER', 1),
           (1, 'P10R-ACT-RED', 'Activite Phase 10R hors perimetre', @red_project, @red_conv, '2026-07-02', '2026-07-10', 80, NOW(), @admin, @admin, 'P10RACTRED', 3);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_budget_line, amount, prevalidated_amount, final_validated_amount, disbursed_amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'P10R-EXP-SUB', @project, @conv, @bl, 100, NULL, NULL, NULL, '2026-07-05', 'Depense Phase 10R a prevalider', NULL, NOW(), NOW(), @agent, 'P10REXPSUB', 1),
           (1, 'P10R-EXP-PRE', @project, @conv, @bl, 200, 200, NULL, NULL, '2026-07-06', 'Depense Phase 10R a valider definitivement', 'P10R-ok.pdf', NOW(), NOW(), @agent, 'P10REXPPRE', 4),
           (1, 'P10R-EXP-DISB', @project, @conv, @bl, 300, 300, 300, NULL, '2026-07-07', 'Depense Phase 10R a decaisser', 'P10R-ok.pdf', NOW(), NOW(), @agent, 'P10REXPDISB', 6),
           (1, 'P10R-EXP-RED', @red_project, @red_conv, @red_bl, 999999, NULL, NULL, NULL, '2026-07-05', 'Depense Phase 10R hors perimetre', NULL, NOW(), NOW(), @admin, 'P10REXPRED', 1);

    SET @expense_sub = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P10R-EXP-SUB' AND entity = 1);
    SET @expense_pre = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P10R-EXP-PRE' AND entity = 1);
    INSERT INTO llx_mjlfinancement_validation (entity, ref, fk_expense, action, from_status, to_status, fk_user_action, actor_role, action_date, comment, date_creation, fk_user_creat)
    VALUES (1, 'P10R-VAL-SUB', @expense_sub, 'submitted', 'Brouillon', 'Soumise', @agent, 'AGENT_SAISIE', '2026-07-05 10:00:00', 'Phase 10R soumission', NOW(), @agent),
           (1, 'P10R-VAL-PRE', @expense_pre, 'prevalidated', 'Soumise', 'Prévalidée', @verifier, 'AGENT_VERIFICATEUR', '2026-07-06 10:00:00', 'Phase 10R prevalidation', NOW(), @verifier);

    INSERT INTO llx_mjlfinancement_fund_receipt (entity, ref, fk_soc, fk_project, fk_convention, amount, reception_date, supporting_document, comment, status, date_creation, fk_user_creat, import_key)
    VALUES (1, 'P10R-FR-UNICEF', @unicef, @project, @conv, 500, '2026-07-08', NULL, 'Phase 10R fonds UNICEF', 1, NOW(), @admin, 'P10RFRUNI'),
           (1, 'P10R-FR-GLOBAL', @unicef, NULL, @conv, 600, '2026-07-08', NULL, 'Phase 10R fonds global', 1, NOW(), @admin, 'P10RFRGLOB'),
           (1, 'P10R-FR-RED', @redev, @red_project, @red_conv, 999999, '2026-07-08', NULL, 'Phase 10R fonds hors perimetre', 1, NOW(), @admin, 'P10RFRRED');

    INSERT INTO llx_mjlfinancement_workflow_action (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, comment, changes_json, date_creation, fk_user_creat, import_key)
    SELECT 1, 'P10R-WFA-ACT-SUB', 'mjlfinancement_activity', rowid, 'submitted', 'Brouillon', 'Soumise', @agent, 'AGENT_SAISIE', '2026-07-05 09:00:00', 'Phase 10R activity audit', '{}', NOW(), @agent, 'P10RWFA'
    FROM llx_mjlfinancement_activity WHERE ref = 'P10R-ACT-SUB' AND entity = 1;
    INSERT INTO llx_mjlfinancement_workflow_action (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, comment, changes_json, date_creation, fk_user_creat, import_key)
    VALUES (1, 'P10R-WFA-ORPHAN', 'mjlfinancement_activity', 99999991, 'orphan_phase10r', 'X', 'Y', @admin, 'ADMIN_PLATEFORME', NOW(), 'Phase 10R orphan diagnostic', '{}', NOW(), @admin, 'P10RWFAORPHAN');
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase10R();
  seedPhase10RFixtures();
});

test.afterAll(() => {
  cleanupPhase10R();
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
});

test('production role dashboards use role-specific sections and no legacy dashboard wording', async ({ page }) => {
  await login(page, 'agent.mjl');
  await expect(page.getByRole('heading', { name: 'Mes actions attendues' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Administration plateforme');
  await expect(page.locator('body')).not.toContainText(/DPAF|Level 1|Level 2|Level 3|N1|N2|Créer un compte|Register|Inscription publique/);

  await login(page, 'superviseur.n1');
  await expect(page.getByRole('heading', { name: 'File de validation' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Administration plateforme');
  await expect(page.locator('body')).not.toContainText(/DPAF|Level 1|Level 2|Level 3|N1|N2|Créer un compte|Register|Inscription publique/);

  await login(page, 'dpaf.mjl');
  await expect(page.getByRole('heading', { name: 'Supervision finance' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Administration plateforme');
  await expect(page.locator('body')).not.toContainText(/DPAF|Level 1|Level 2|Level 3|N1|N2|Créer un compte|Register|Inscription publique/);
  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.locator('.mjl-user-context')).toContainText('Validateur définitif');
  await expect(page.locator('body')).not.toContainText(/DPAF|Level 1|Level 2|Level 3|N1|N2|Créer un compte|Register|Inscription publique/);

  await login(page, 'admin.poc');
  await expect(page.getByRole('heading', { name: 'Administration plateforme' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Données à qualifier');
  await expect(page.locator('body')).not.toContainText(/DPAF|Level 1|Level 2|Level 3|N1|N2|Créer un compte|Register|Inscription publique/);
});

test('dashboard filters scope cards, queues, funds, budgets, and audit rows', async ({ page }) => {
  const unicef = scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1");
  const redev = scalar("SELECT rowid FROM llx_societe WHERE nom LIKE 'Programme Redev%' AND entity = 1 LIMIT 1");
  const project = scalar("SELECT rowid FROM llx_projet WHERE ref = 'P10R-PRJ-UNICEF' AND entity = 1 LIMIT 1");
  const redProject = scalar("SELECT rowid FROM llx_projet WHERE ref = 'P10R-PRJ-RED' AND entity = 1 LIMIT 1");

  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/index.php?fk_soc=${unicef}&fk_project=${project}&date_start=2026-07-01&date_end=2026-07-31&status_bucket=to_prevalidate`);
  await expectCardValue(page, 'Activites en revue', 1);
  await expectCardValue(page, 'Depenses en revue', 1);
  await page.goto(`/custom/mjlfinancement/index.php?fk_soc=${redev}`);
  await expect(page.locator('body')).toContainText('Partenaire / Programme hors périmètre');
  await expectCardValue(page, 'Activites en revue', 0);
  await expectCardValue(page, 'Depenses en revue', 0);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/dpafdashboard.php?fk_soc=${unicef}&fk_project=${project}&date_start=2026-07-01&date_end=2026-07-31&status_bucket=to_final_validate`);
  await expect(page.locator('body')).toContainText('P10R-ACT-PRE');
  await expect(page.locator('body')).toContainText('P10R-EXP-PRE');
  await expect(page.locator('body')).toContainText('P10R-FR-UNICEF');
  await expect(page.locator('body')).toContainText('P10R-ACT-SUB');
  await expect(page.locator('body')).not.toContainText('P10R-EXP-SUB');
  await expect(page.locator('body')).not.toContainText('P10R-FR-GLOBAL');
  await expect(page.locator('body')).not.toContainText('P10R-RED');
  await expect(page.locator('body')).not.toContainText('999999');
  await expect(page.locator('body')).not.toContainText('P10R-WFA-ORPHAN');

  await page.goto(`/custom/mjlfinancement/dpafdashboard.php?fk_soc=${unicef}&date_start=2026-07-01&date_end=2026-07-31&status_bucket=all`);
  await expect(page.locator('body')).toContainText('P10R-FR-GLOBAL');
  await expect(page.locator('body')).not.toContainText('P10R-FR-RED');

  await page.goto(`/custom/mjlfinancement/dpafdashboard.php?fk_project=${redProject}`);
  await expect(page.locator('body')).toContainText('Projet hors périmètre');
  await expect(page.locator('body')).not.toContainText('P10R-ACT-RED');
});

test('final validator and platform admin stay distinct on filtered supervision', async ({ page }) => {
  const unicef = scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/dpafdashboard.php?fk_soc=${unicef}&status_bucket=to_disburse`);
  await expect(page.locator('.mjl-user-context')).toContainText('Validateur définitif');
  await expect(page.locator('body')).toContainText('P10R-EXP-DISB');
  await expect(page.locator('body')).not.toContainText('Données à qualifier');
  await expect(page.locator('body')).not.toContainText('Administrateur plateforme');

  await login(page, 'admin.poc');
  await page.goto(`/custom/mjlfinancement/index.php?fk_soc=${unicef}`);
  await expect(page.locator('.mjl-user-context')).toContainText('Utilisateur');
  await expect(page.locator('body')).toContainText('Administration plateforme');
  await expect(page.locator('body')).toContainText('Données à qualifier');
  await expect(page.locator('body')).not.toContainText('Validateur définitif');
});

test('direct dashboard access remains guarded for non-supervision users', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.locator('body')).toContainText(forbiddenResponsePattern);
});
