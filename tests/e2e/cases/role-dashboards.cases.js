const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
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

function cleanupRoleDashboard() {
  sql(`
    SET @role_dashboard_activities = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'DSH-%');
    SET @role_dashboard_expenses = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_expense WHERE ref LIKE 'DSH-%');
    SET @role_dashboard_budget_lines = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'DSH-%');
    SET @role_dashboard_receipts = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'DSH-%');
    DELETE FROM llx_mjlfinancement_validation WHERE FIND_IN_SET(fk_expense, COALESCE(@role_dashboard_expenses, ''));
    DELETE FROM llx_mjlfinancement_workflow_action WHERE (object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@role_dashboard_activities, ''))) OR (object_type = 'mjlfinancement_expense' AND FIND_IN_SET(object_id, COALESCE(@role_dashboard_expenses, ''))) OR (object_type = 'mjlfinancement_budget_line' AND FIND_IN_SET(object_id, COALESCE(@role_dashboard_budget_lines, ''))) OR (object_type = 'mjlfinancement_fund_receipt' AND FIND_IN_SET(object_id, COALESCE(@role_dashboard_receipts, ''))) OR ref LIKE 'DSH-%';
    DELETE FROM llx_ecm_files WHERE ref LIKE 'DSH-%' OR (src_object_type = 'mjlfinancement_expense' AND FIND_IN_SET(src_object_id, COALESCE(@role_dashboard_expenses, '')));
    DELETE FROM llx_mjlfinancement_exchange_log WHERE ref LIKE 'DSH-%';
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'DSH-%';
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'DSH-%';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'DSH-%';
    DELETE FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'DSH-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'DSH-%';
    DELETE FROM llx_projet WHERE ref LIKE 'DSH-%';
  `);
}

function seedRoleDashboardFixtures() {
  sql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @verifier = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' LIMIT 1);
    SET @final = (SELECT rowid FROM llx_user WHERE login = 'dpaf.mjl' LIMIT 1);
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1);
    SET @unicef = (SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1);
    SET @redev = (SELECT rowid FROM llx_societe WHERE nom LIKE 'Programme Redev%' AND entity = 1 LIMIT 1);

    UPDATE llx_mjlfinancement_user_role SET is_active = 0 WHERE entity = 1 AND fk_user IN (@agent, @verifier, @final);
    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @agent, 'AGENT_SAISIE', 1, CURDATE(), 'role_dashboard', 'Role dashboard dashboards', NOW(), @admin),
           (1, @verifier, 'AGENT_VERIFICATEUR', 1, CURDATE(), 'role_dashboard', 'Role dashboard dashboards', NOW(), @admin),
           (1, @final, 'VALIDATEUR_DEFINITIF', 1, CURDATE(), 'role_dashboard', 'Role dashboard dashboards', NOW(), @admin);
    UPDATE llx_mjlfinancement_user_soc_scope SET is_active = 0 WHERE entity = 1 AND fk_user IN (@agent, @verifier, @final);
    INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @agent, @unicef, 1, CURDATE(), 'role_dashboard', 'Role dashboard dashboards', NOW(), @admin),
           (1, @verifier, @unicef, 1, CURDATE(), 'role_dashboard', 'Role dashboard dashboards', NOW(), @admin),
           (1, @final, @unicef, 1, CURDATE(), 'role_dashboard', 'Role dashboard dashboards', NOW(), @admin);

    INSERT INTO llx_projet (entity, ref, title, fk_soc, fk_statut, datec, fk_user_creat)
    VALUES (1, 'DSH-PRJ-UNICEF', 'Projet Role dashboard UNICEF', @unicef, 1, NOW(), @admin),
           (1, 'DSH-PRJ-RED', 'Projet Role dashboard autre programme', @redev, 1, NOW(), @admin);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'DSH-PRJ-UNICEF' AND entity = 1);
    SET @red_project = (SELECT rowid FROM llx_projet WHERE ref = 'DSH-PRJ-RED' AND entity = 1);

    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, status, date_creation, fk_user_creat, import_key)
    VALUES (1, 'DSH-CONV-UNICEF', 'Role dashboard enveloppe UNICEF', @unicef, @project, '2026-07-01', '2026-12-31', 2000000, 'XOF', 1, NOW(), @admin, 'DSHCONVUNI'),
           (1, 'DSH-CONV-RED', 'Role dashboard enveloppe autre programme', @redev, @red_project, '2026-07-01', '2026-12-31', 2000000, 'XOF', 1, NOW(), @admin, 'DSHCONVRED');
    SET @conv = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'DSH-CONV-UNICEF' AND entity = 1);
    SET @red_conv = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'DSH-CONV-RED' AND entity = 1);

    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, initial_budget, revised_budget, category, status, date_creation, fk_user_creat, import_key)
    VALUES (1, 'DSH-BL-UNICEF', 'Budget Role dashboard UNICEF', @project, @conv, 1000, 1000, 'role_dashboard', 1, NOW(), @admin, 'DSHBLUNI'),
           (1, 'DSH-BL-RED', 'Budget Role dashboard autre programme', @red_project, @red_conv, 999999, 999999, 'role_dashboard', 1, NOW(), @admin, 'DSHBLRED');
    SET @bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'DSH-BL-UNICEF' AND entity = 1);
    SET @red_bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'DSH-BL-RED' AND entity = 1);

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, physical_execution_percent, date_creation, fk_user_creat, fk_user_responsible, import_key, status)
    VALUES (1, 'DSH-ACT-SUB', 'Activite Role dashboard a prevalider', @project, @conv, '2026-07-02', '2026-07-10', 25, NOW(), @agent, @agent, 'DSHACTSUB', 3),
           (1, 'DSH-ACT-PRE', 'Activite Role dashboard a valider definitivement', @project, @conv, '2026-07-02', '2026-07-12', 50, NOW(), @agent, @agent, 'DSHACTPRE', 7),
           (1, 'DSH-ACT-OVER', 'Activite Role dashboard en retard', @project, @conv, '2026-06-01', '2026-06-15', 10, NOW(), @agent, @agent, 'DSHACTOVER', 1),
           (1, 'DSH-ACT-RED', 'Activite Role dashboard hors perimetre', @red_project, @red_conv, '2026-07-02', '2026-07-10', 80, NOW(), @admin, @admin, 'DSHACTRED', 3);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_budget_line, amount, prevalidated_amount, final_validated_amount, disbursed_amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'DSH-EXP-SUB', @project, @conv, @bl, 100, NULL, NULL, NULL, '2026-07-05', 'Depense Role dashboard a prevalider', NULL, NOW(), NOW(), @agent, 'DSHEXPSUB', 1),
           (1, 'DSH-EXP-PRE', @project, @conv, @bl, 200, 200, NULL, NULL, '2026-07-06', 'Depense Role dashboard a valider definitivement', 'DSH-ok.pdf', NOW(), NOW(), @agent, 'DSHEXPPRE', 4),
           (1, 'DSH-EXP-DISB', @project, @conv, @bl, 300, 300, 300, NULL, '2026-07-07', 'Depense Role dashboard a decaisser', 'DSH-ok.pdf', NOW(), NOW(), @agent, 'DSHEXD', 6),
           (1, 'DSH-EXP-RED', @red_project, @red_conv, @red_bl, 999999, NULL, NULL, NULL, '2026-07-05', 'Depense Role dashboard hors perimetre', NULL, NOW(), NOW(), @admin, 'DSHEXPRED', 1);

    SET @expense_sub = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'DSH-EXP-SUB' AND entity = 1);
    SET @expense_pre = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'DSH-EXP-PRE' AND entity = 1);
    INSERT INTO llx_mjlfinancement_validation (entity, ref, fk_expense, action, from_status, to_status, fk_user_action, actor_role, action_date, comment, date_creation, fk_user_creat)
    VALUES (1, 'DSH-VAL-SUB', @expense_sub, 'submitted', 'Brouillon', 'Soumise', @agent, 'AGENT_SAISIE', '2026-07-05 10:00:00', 'Role dashboard soumission', NOW(), @agent),
           (1, 'DSH-VAL-PRE', @expense_pre, 'prevalidated', 'Soumise', 'Prévalidée', @verifier, 'AGENT_VERIFICATEUR', '2026-07-06 10:00:00', 'Role dashboard prevalidation', NOW(), @verifier);

    INSERT INTO llx_mjlfinancement_fund_receipt (entity, ref, fk_soc, fk_project, fk_convention, amount, reception_date, supporting_document, comment, status, date_creation, fk_user_creat, import_key)
    VALUES (1, 'DSH-FR-UNICEF', @unicef, @project, @conv, 500, '2026-07-08', NULL, 'Role dashboard fonds UNICEF', 1, NOW(), @admin, 'DSHFRUNI'),
           (1, 'DSH-FR-GLOBAL', @unicef, NULL, @conv, 600, '2026-07-08', NULL, 'Role dashboard fonds global', 1, NOW(), @admin, 'DSHFRGLOB'),
           (1, 'DSH-FR-RED', @redev, @red_project, @red_conv, 999999, '2026-07-08', NULL, 'Role dashboard fonds hors perimetre', 1, NOW(), @admin, 'DSHFRRED');

    INSERT INTO llx_mjlfinancement_workflow_action (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, comment, changes_json, date_creation, fk_user_creat, import_key)
    SELECT 1, 'DSH-WFA-ACT-SUB', 'mjlfinancement_activity', rowid, 'submitted', 'Brouillon', 'Soumise', @agent, 'AGENT_SAISIE', '2026-07-05 09:00:00', 'Role dashboard activity audit', '{}', NOW(), @agent, 'DSHWFA'
    FROM llx_mjlfinancement_activity WHERE ref = 'DSH-ACT-SUB' AND entity = 1;
    INSERT INTO llx_mjlfinancement_workflow_action (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, comment, changes_json, date_creation, fk_user_creat, import_key)
    VALUES (1, 'DSH-WFA-ORPHAN', 'mjlfinancement_activity', 99999991, 'orphan_role_dashboard', 'X', 'Y', @admin, 'ADMIN_PLATEFORME', NOW(), 'Role dashboard orphan diagnostic', '{}', NOW(), @admin, 'DSHWFAORPHAN');
  `);
}

test.beforeAll(() => {
  cleanupRoleDashboard();
  seedRoleDashboardFixtures();
});

test.afterAll(() => {
  cleanupRoleDashboard();
});

test('operational dashboard filters scoped review cards and rejects out-of-scope filters', async ({ page }) => {
  const unicef = scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1");
  const redev = scalar("SELECT rowid FROM llx_societe WHERE nom LIKE 'Programme Redev%' AND entity = 1 LIMIT 1");
  const project = scalar("SELECT rowid FROM llx_projet WHERE ref = 'DSH-PRJ-UNICEF' AND entity = 1 LIMIT 1");

  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/index.php?fk_soc=${unicef}&fk_project=${project}&date_start=2026-07-01&date_end=2026-07-31&status_bucket=to_prevalidate`);
  await expectCardValue(page, 'Activités en revue', 1);
  await expectCardValue(page, 'Dépenses en revue', 1);
  await page.goto(`/custom/mjlfinancement/index.php?fk_soc=${redev}`);
  await expect(page.locator('body')).toContainText('Partenaire / Programme hors périmètre');
  await expectCardValue(page, 'Activités en revue', 0);
  await expectCardValue(page, 'Dépenses en revue', 0);

});
