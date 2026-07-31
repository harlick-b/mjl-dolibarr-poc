const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');
const zlib = require('zlib');
const { verifyDisposableComposeEnvironment } = require('../helpers/phase3d-prerequisite-isolation');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const fixtureLogin = 'mjl.phase3d.scoped';
let isolationVerified = false;

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

function phpEval(code) {
  const encoded = Buffer.from(code, 'utf8').toString('base64');
  return dockerExec(`dolibarr php -r "eval(base64_decode('${encoded}'));"`).toString().trim();
}

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

function xlsxEntry(buffer, entryName) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd).toBeGreaterThanOrEqual(0);
  const entries = buffer.readUInt16LE(eocd + 10);
  let position = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index++) {
    const method = buffer.readUInt16LE(position + 10);
    const compressedSize = buffer.readUInt32LE(position + 20);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const localOffset = buffer.readUInt32LE(position + 42);
    const name = buffer.subarray(position + 46, position + 46 + nameLength).toString('utf8');
    if (name === entryName) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const payload = buffer.subarray(start, start + compressedSize);
      return method === 8 ? zlib.inflateRawSync(payload).toString('utf8') : payload.toString('utf8');
    }
    position += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`Missing XLSX entry ${entryName}`);
}

function cleanupFixtures() {
  sql(`
    DROP TRIGGER IF EXISTS p3d_fail_workflow_audit;
    SET @fixture_user = (SELECT rowid FROM llx_user WHERE login = '${fixtureLogin}' AND entity = 1 LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'P3D-SEC-PROJECT' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P3D-SEC-CONVENTION' AND entity = 1 LIMIT 1);
    SET @receipt = (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'P3D-SEC-RECEIPT-B' AND entity = 1 LIMIT 1);
    DELETE FROM llx_ecm_files WHERE ref LIKE 'P3D-SEC-%' AND entity = 1;
    DELETE FROM llx_mjlfinancement_validation WHERE ref LIKE 'P3D-SEC-%' AND entity = 1;
    DELETE FROM llx_mjlfinancement_workflow_action WHERE (ref LIKE 'P3D-SEC-%' OR actor = @fixture_user) AND entity = 1;
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P3D-SEC-%' AND entity = 1;
    DELETE FROM llx_mjlfinancement_expense WHERE ref = 'P3D-SEC-EXPENSE-CROSS' AND entity = 2;
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'P3D-SEC-%' AND entity = 1;
    DELETE FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'P3D-SEC-%' AND entity = 1;
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'P3D-SEC-%' AND entity = 1;
    DELETE FROM llx_mjlfinancement_convention WHERE ref = 'P3D-SEC-CONVENTION-CROSS' AND entity = 2;
    DELETE FROM llx_projet WHERE ref = 'P3D-SEC-PROJECT' AND entity = 1;
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE fk_user = @fixture_user AND entity = 1;
    DELETE FROM llx_mjlfinancement_user_role WHERE fk_user = @fixture_user AND entity = 1;
    DELETE FROM llx_usergroup_user WHERE fk_user = @fixture_user AND entity = 1;
    DELETE FROM llx_user WHERE rowid = @fixture_user AND entity = 1;
  `);
  dockerExec("dolibarr sh -lc 'rm -f /var/www/documents/ecm/mjlfinancement_convention/P3D-SEC-CONVENTION-B.txt /var/www/documents/ecm/mjlfinancement_convention/P3D-SEC-CONVENTION-A.txt /var/www/documents/ecm/mjlfinancement_fund_receipt/P3D-SEC-RECEIPT-B.txt'");
}

function seedFixtures() {
  sql(`
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' AND entity IN (0, 1) LIMIT 1);
    SET @source_user = (SELECT rowid FROM llx_user WHERE login = 'dpaf.mjl' AND entity = 1 LIMIT 1);
    SET @partner_a = (SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1);
    SET @partner_b = (SELECT rowid FROM llx_societe WHERE nom = 'Programme Redevabilite' AND entity = 1 LIMIT 1);
    SET @project_a = (SELECT rowid FROM llx_projet WHERE entity = 1 AND fk_soc = @partner_a ORDER BY rowid LIMIT 1);
    SET @project_b = (SELECT rowid FROM llx_projet WHERE entity = 1 AND fk_soc = @partner_b ORDER BY rowid LIMIT 1);
    SET @convention_a = (SELECT rowid FROM llx_mjlfinancement_convention WHERE entity = 1 AND fk_soc = @partner_a ORDER BY rowid LIMIT 1);
    SET @convention_b = (SELECT rowid FROM llx_mjlfinancement_convention WHERE entity = 1 AND fk_soc = @partner_b ORDER BY rowid LIMIT 1);
    SET @budget_a = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE entity = 1 AND fk_convention = @convention_a ORDER BY rowid LIMIT 1);
    SET @budget_b = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE entity = 1 AND fk_convention = @convention_b ORDER BY rowid LIMIT 1);
    SET @activity_a = (SELECT rowid FROM llx_mjlfinancement_activity WHERE entity = 1 AND fk_convention = @convention_a ORDER BY rowid LIMIT 1);
    SET @activity_b = (SELECT rowid FROM llx_mjlfinancement_activity WHERE entity = 1 AND fk_convention = @convention_b ORDER BY rowid LIMIT 1);
    SET @receipt_a = (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE entity = 1 AND fk_soc = @partner_a ORDER BY rowid LIMIT 1);
    SET @report = (SELECT rowid FROM llx_mjlfinancement_report WHERE entity = 1 ORDER BY rowid LIMIT 1);

    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, '${fixtureLogin}', 'Phase3D', 'Scoped', 'phase3d-scoped@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE rowid = @source_user AND entity = 1;
    SET @fixture_user = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup)
    SELECT entity, @fixture_user, fk_usergroup FROM llx_usergroup_user WHERE fk_user = @source_user AND entity = 1;
    INSERT INTO llx_mjlfinancement_user_role
      (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
    VALUES (1, @fixture_user, 'VALIDATEUR_DEFINITIF', 1, NOW(), 'test', 'Phase 3D prerequisite', NOW(), @admin, 'P3DSECROLE');
    INSERT INTO llx_mjlfinancement_user_soc_scope
      (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
    VALUES (1, @fixture_user, @partner_a, 1, NOW(), 'test', 'Single partner fixture', NOW(), @admin, 'P3DSECSCOPE');

    INSERT INTO llx_mjlfinancement_convention
      (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, date_creation, fk_user_creat, import_key, status)
    VALUES (2, 'P3D-SEC-CONVENTION-CROSS', 'Cross-entity scope fixture', @partner_b, @project_b, '2026-01-01', '2026-12-31', 1, 'XOF', NOW(), @admin, 'P3DSECCONVX', 1);
    SET @convention_cross = LAST_INSERT_ID();

    SET FOREIGN_KEY_CHECKS = 0;
    INSERT INTO llx_mjlfinancement_expense
      (entity, ref, fk_project, fk_convention, fk_budget_line, amount, date_creation, fk_user_creat, status, import_key)
    VALUES
      (1, 'P3D-SEC-EXPENSE-A', @project_a, @convention_a, @budget_a, 1000, NOW(), @admin, 1, 'P3DSECEXPA'),
      (1, 'P3D-SEC-EXPENSE-B', @project_b, @convention_b, @budget_b, 2000, NOW(), @admin, 1, 'P3DSECEXPB'),
      (1, 'P3D-SEC-EXPENSE-NO-CONVENTION', @project_a, 99999998, @budget_a, 2500, NOW(), @admin, 1, 'P3DSECEXPNC'),
      (1, 'P3D-SEC-EXPENSE-PARENT-CROSS', @project_a, @convention_cross, @budget_a, 2750, NOW(), @admin, 1, 'P3DSECEXPPC'),
      (2, 'P3D-SEC-EXPENSE-CROSS', @project_a, @convention_a, @budget_a, 3000, NOW(), @admin, 1, 'P3DSECEXPC');
    SET FOREIGN_KEY_CHECKS = 1;
    SET @expense_a = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P3D-SEC-EXPENSE-A' AND entity = 1);
    SET @expense_b = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P3D-SEC-EXPENSE-B' AND entity = 1);
    SET @expense_no_convention = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P3D-SEC-EXPENSE-NO-CONVENTION' AND entity = 1);
    SET @expense_parent_cross = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P3D-SEC-EXPENSE-PARENT-CROSS' AND entity = 1);
    SET @expense_cross = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P3D-SEC-EXPENSE-CROSS' AND entity = 2);
    SET FOREIGN_KEY_CHECKS = 0;
    INSERT INTO llx_mjlfinancement_fund_receipt
      (entity, ref, fk_soc, fk_project, fk_convention, amount, reception_date, status, date_creation, fk_user_creat, import_key)
    VALUES
      (1, 'P3D-SEC-RECEIPT-NO-CONVENTION', @partner_a, @project_a, 99999998, 2600, '2026-06-02', 1, NOW(), @admin, 'P3DSECRECNC'),
      (1, 'P3D-SEC-RECEIPT-PARENT-CROSS', @partner_a, @project_a, @convention_cross, 2700, '2026-06-03', 1, NOW(), @admin, 'P3DSECRECPC');
    SET FOREIGN_KEY_CHECKS = 1;
    SET @receipt_no_convention = (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'P3D-SEC-RECEIPT-NO-CONVENTION' AND entity = 1);
    SET @receipt_parent_cross = (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'P3D-SEC-RECEIPT-PARENT-CROSS' AND entity = 1);
    INSERT INTO llx_mjlfinancement_validation
      (entity, ref, fk_expense, action, from_status, to_status, fk_user_action, actor_role, action_date, comment, date_creation, fk_user_creat)
    VALUES
      (1, 'P3D-SEC-VALIDATION-A', @expense_a, 'prevalidated', 'submitted', 'prevalidated', @admin, 'AGENT_VERIFICATEUR', NOW(), 'VISIBLE-PARTNER-A', NOW(), @admin),
      (1, 'P3D-SEC-VALIDATION-B', @expense_b, 'prevalidated', 'submitted', 'prevalidated', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-PARTNER-B', NOW(), @admin),
      (1, 'P3D-SEC-VALIDATION-CROSS', @expense_cross, 'prevalidated', 'submitted', 'prevalidated', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-CROSS-ENTITY', NOW(), @admin),
      (1, 'P3D-SEC-VALIDATION-NO-CONVENTION', @expense_no_convention, 'prevalidated', 'submitted', 'prevalidated', @admin, 'AGENT_VERIFICATEUR', NOW(), 'ADMIN-CONVENTION-MISSING', NOW(), @admin),
      (1, 'P3D-SEC-VALIDATION-PARENT-CROSS', @expense_parent_cross, 'prevalidated', 'submitted', 'prevalidated', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-CROSS-ENTITY-PARENT', NOW(), @admin);
    SET FOREIGN_KEY_CHECKS = 0;
    INSERT INTO llx_mjlfinancement_validation
      (entity, ref, fk_expense, action, from_status, to_status, fk_user_action, actor_role, action_date, comment, date_creation, fk_user_creat)
    VALUES
      (1, 'P3D-SEC-VALIDATION-ORPHAN', 99999999, 'prevalidated', 'submitted', 'prevalidated', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-ORPHAN', NOW(), @admin);
    SET FOREIGN_KEY_CHECKS = 1;

    INSERT INTO llx_mjlfinancement_workflow_action
      (entity, ref, object_type, object_id, action, actor, actor_role, action_date, comment, changes_json, date_creation, fk_user_creat)
    VALUES
      (1, 'P3D-SEC-WFA-A', 'mjlfinancement_expense', @expense_a, 'p3d_partner_a_action', @admin, 'AGENT_VERIFICATEUR', NOW(), 'VISIBLE-WFA-A', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-A-PROJECT', 'mjlfinancement_project', @project_a, 'p3d_partner_a_project', @admin, 'AGENT_VERIFICATEUR', NOW(), 'VISIBLE-WFA-A-PROJECT', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-A-ACTIVITY', 'mjlfinancement_activity', @activity_a, 'p3d_partner_a_activity', @admin, 'AGENT_VERIFICATEUR', NOW(), 'VISIBLE-WFA-A-ACTIVITY', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-A-CONVENTION', 'mjlfinancement_convention', @convention_a, 'p3d_partner_a_convention', @admin, 'AGENT_VERIFICATEUR', NOW(), 'VISIBLE-WFA-A-CONVENTION', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-A-BUDGET', 'mjlfinancement_budget_line', @budget_a, 'p3d_partner_a_budget', @admin, 'AGENT_VERIFICATEUR', NOW(), 'VISIBLE-WFA-A-BUDGET', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-A-RECEIPT', 'mjlfinancement_fund_receipt', @receipt_a, 'p3d_partner_a_receipt', @admin, 'AGENT_VERIFICATEUR', NOW(), 'VISIBLE-WFA-A-RECEIPT', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-B', 'mjlfinancement_expense', @expense_b, 'p3d_partner_b_secret', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-WFA-B', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-B-PROJECT', 'mjlfinancement_project', @project_b, 'p3d_partner_b_project_secret', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-WFA-B-PROJECT', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-B-ACTIVITY', 'mjlfinancement_activity', @activity_b, 'p3d_partner_b_activity_secret', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-WFA-B-ACTIVITY', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-B-CONVENTION', 'mjlfinancement_convention', @convention_b, 'p3d_partner_b_convention_secret', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-WFA-B-CONVENTION', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-B-BUDGET', 'mjlfinancement_budget_line', @budget_b, 'p3d_partner_b_budget_secret', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-WFA-B-BUDGET', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-CROSS', 'mjlfinancement_expense', @expense_cross, 'p3d_cross_entity_secret', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-WFA-CROSS-ENTITY', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-REPORT', 'mjlfinancement_report', @report, 'p3d_report_admin', @admin, 'AGENT_VERIFICATEUR', NOW(), 'ADMIN-WFA-REPORT', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-UNRESOLVED', 'mjlfinancement_expense', 99999999, 'p3d_unresolved_admin', @admin, 'AGENT_VERIFICATEUR', NOW(), 'ADMIN-WFA-UNRESOLVED', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-NO-CONVENTION', 'mjlfinancement_expense', @expense_no_convention, 'p3d_missing_parent_admin', @admin, 'AGENT_VERIFICATEUR', NOW(), 'ADMIN-WFA-MISSING-PARENT', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-PARENT-CROSS', 'mjlfinancement_expense', @expense_parent_cross, 'p3d_cross_parent_secret', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-WFA-CROSS-PARENT', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-RECEIPT-NO-CONVENTION', 'mjlfinancement_fund_receipt', @receipt_no_convention, 'p3d_receipt_missing_parent_admin', @admin, 'AGENT_VERIFICATEUR', NOW(), 'ADMIN-WFA-RECEIPT-MISSING-PARENT', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-RECEIPT-PARENT-CROSS', 'mjlfinancement_fund_receipt', @receipt_parent_cross, 'p3d_receipt_cross_parent_secret', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-WFA-RECEIPT-CROSS-PARENT', '{}', NOW(), @admin),
      (1, 'P3D-SEC-WFA-UNKNOWN', 'mjlfinancement_unknown', 99999997, 'p3d_unknown_admin', @admin, 'AGENT_VERIFICATEUR', NOW(), 'ADMIN-WFA-UNKNOWN', '{}', NOW(), @admin);

    INSERT INTO llx_projet (entity, fk_soc, datec, ref, title, fk_user_creat, public, fk_statut, import_key)
    VALUES (1, @partner_a, NOW(), 'P3D-SEC-PROJECT', '=2+3', @admin, 0, 1, 'P3DSECPROJ');
    SET @export_project = LAST_INSERT_ID();
    INSERT INTO llx_mjlfinancement_convention
      (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'P3D-SEC-CONVENTION', 'Export security convention', @partner_a, @export_project, '2026-01-01', '2026-12-31', -75000, 'XOF', NOW(), @admin, 'P3DSECCONV', 1);
    SET @export_convention = LAST_INSERT_ID();
    INSERT INTO llx_mjlfinancement_budget_line
      (entity, ref, label, fk_convention, initial_budget, revised_budget, fk_project, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'P3D-SEC-BUDGET', 'Numeric precision fixture', @export_convention, -75000.125, -75000.125, @export_project, NOW(), @admin, 'P3DSECBUD', 1);

    INSERT INTO llx_mjlfinancement_fund_receipt
      (entity, ref, fk_soc, fk_project, fk_convention, amount, reception_date, status, date_creation, fk_user_creat, import_key)
    VALUES (1, 'P3D-SEC-RECEIPT-B', @partner_b, @project_b, @convention_b, 2500, '2026-06-01', 1, NOW(), @admin, 'P3DSECRECB');
    SET @receipt_b = LAST_INSERT_ID();
    INSERT INTO llx_mjlfinancement_workflow_action
      (entity, ref, object_type, object_id, action, actor, actor_role, action_date, comment, changes_json, date_creation, fk_user_creat)
    VALUES
      (1, 'P3D-SEC-WFA-B-RECEIPT', 'mjlfinancement_fund_receipt', @receipt_b, 'p3d_partner_b_receipt_secret', @admin, 'AGENT_VERIFICATEUR', NOW(), 'SECRET-WFA-B-RECEIPT', '{}', NOW(), @admin);
    INSERT INTO llx_ecm_files
      (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES
      ('P3D-SEC-CONVENTION-B', 'P3D-SEC-CONVENTION-B.txt', 1, 'P3D-SEC-CONVENTION-B.txt', 'mjlfinancement_convention', 'P3D-SEC-CONVENTION-B.txt', 'Cross-scope convention', 1, NOW(), @admin, 'mjlfinancement_convention', @convention_b),
      ('P3D-SEC-CONVENTION-A', 'P3D-SEC-CONVENTION-A.txt', 1, 'P3D-SEC-CONVENTION-A.txt', 'mjlfinancement_convention', 'P3D-SEC-CONVENTION-A.txt', 'In-scope convention', 1, NOW(), @admin, 'mjlfinancement_convention', @convention_a),
      ('P3D-SEC-RECEIPT-B', 'P3D-SEC-RECEIPT-B.txt', 1, 'P3D-SEC-RECEIPT-B.txt', 'mjlfinancement_fund_receipt', 'P3D-SEC-RECEIPT-B.txt', 'Cross-scope receipt', 1, NOW(), @admin, 'mjlfinancement_fund_receipt', @receipt_b);
  `);
  dockerExec("dolibarr sh -lc 'mkdir -p /var/www/documents/ecm/mjlfinancement_convention /var/www/documents/ecm/mjlfinancement_fund_receipt && printf %s P3D-CONVENTION-B > /var/www/documents/ecm/mjlfinancement_convention/P3D-SEC-CONVENTION-B.txt && printf %s P3D-CONVENTION-A > /var/www/documents/ecm/mjlfinancement_convention/P3D-SEC-CONVENTION-A.txt && printf %s P3D-RECEIPT-B > /var/www/documents/ecm/mjlfinancement_fund_receipt/P3D-SEC-RECEIPT-B.txt'");
}

test.beforeAll(() => {
  verifyDisposableComposeEnvironment();
  isolationVerified = true;
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupFixtures();
  seedFixtures();
});

test.afterAll(() => {
  if (!isolationVerified) return;
  dockerExec('dolibarr chmod 1777 /tmp');
  cleanupFixtures();
});

test('non-admin validation and audit routes show only resolved assigned-partner records', async ({ page }) => {
  await login(page, fixtureLogin);
  await page.goto('/custom/mjlfinancement/validations.php');
  await expect(page.locator('body')).toContainText('VISIBLE-PARTNER-A');
  await expect(page.locator('body')).not.toContainText(/SECRET-PARTNER-B|SECRET-ORPHAN|SECRET-CROSS-ENTITY|ADMIN-CONVENTION-MISSING/);

  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.locator('body')).toContainText('VISIBLE-WFA-A');
  await expect(page.locator('body')).toContainText(/VISIBLE-WFA-A-PROJECT|VISIBLE-WFA-A-ACTIVITY|VISIBLE-WFA-A-CONVENTION|VISIBLE-WFA-A-BUDGET|VISIBLE-WFA-A-RECEIPT/);
  await expect(page.locator('body')).not.toContainText(/SECRET-WFA-B|SECRET-WFA-CROSS|SECRET-WFA-RECEIPT-CROSS|ADMIN-WFA|p3d_partner_b_secret|p3d_cross_entity_secret|p3d_report_admin|p3d_unresolved_admin|p3d_missing_parent_admin|p3d_receipt_missing_parent_admin|p3d_unknown_admin/);
});

test('Admin sees active-entity unresolved diagnostics but no cross-entity targets or parents', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/validations.php');
  await expect(page.locator('body')).toContainText('VISIBLE-PARTNER-A');
  await expect(page.locator('body')).toContainText('SECRET-PARTNER-B');
  await expect(page.locator('body')).toContainText('SECRET-ORPHAN');
  await expect(page.locator('body')).toContainText('ADMIN-CONVENTION-MISSING');
  await expect(page.locator('body')).not.toContainText(/SECRET-CROSS-ENTITY|SECRET-CROSS-ENTITY-PARENT/);

  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.locator('body')).toContainText('VISIBLE-WFA-A');
  await expect(page.locator('body')).toContainText('SECRET-WFA-B');
  await expect(page.locator('body')).toContainText(/ADMIN-WFA-REPORT|ADMIN-WFA-UNRESOLVED|ADMIN-WFA-MISSING-PARENT|ADMIN-WFA-RECEIPT-MISSING-PARENT|ADMIN-WFA-UNKNOWN/);
  await expect(page.locator('body')).not.toContainText(/SECRET-WFA-CROSS-ENTITY|SECRET-WFA-CROSS-PARENT|SECRET-WFA-RECEIPT-CROSS-PARENT/);
});

test('workflow audit filter options use the same visibility predicate as result rows', async ({ page }) => {
  await login(page, fixtureLogin);
  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_partner_a_action"]')).toHaveCount(1);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_partner_b_secret"]')).toHaveCount(0);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_unresolved_admin"]')).toHaveCount(0);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_receipt_missing_parent_admin"]')).toHaveCount(0);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_receipt_cross_parent_secret"]')).toHaveCount(0);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_unknown_admin"]')).toHaveCount(0);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_unresolved_admin"]')).toHaveCount(1);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_missing_parent_admin"]')).toHaveCount(1);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_receipt_missing_parent_admin"]')).toHaveCount(1);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_unknown_admin"]')).toHaveCount(1);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_cross_entity_secret"]')).toHaveCount(0);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_cross_parent_secret"]')).toHaveCount(0);
  await expect(page.locator('select[name="workflow_action"] option[value="p3d_receipt_cross_parent_secret"]')).toHaveCount(0);
});

test('validation-history query failures render a safe persistent state', async ({ page }) => {
  await login(page, fixtureLogin);
  sql('RENAME TABLE llx_mjlfinancement_validation TO llx_mjlfinancement_validation_p3d_failure');
  try {
    await page.goto('/custom/mjlfinancement/validations.php');
    await expect(page.getByText('Historique indisponible')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/SQLSTATE|MariaDB|mjlfinancement_validation_p3d_failure|doesn.t exist|Unknown table/i);
  } finally {
    sql('RENAME TABLE llx_mjlfinancement_validation_p3d_failure TO llx_mjlfinancement_validation');
  }
});

test('convention and fund-receipt downloads deny cross-scope IDs without audit rows', async ({ page }) => {
  await login(page, fixtureLogin);
  const conventionFile = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P3D-SEC-CONVENTION-B' AND entity = 1");
  const receiptFile = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P3D-SEC-RECEIPT-B' AND entity = 1");
  const before = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE ref LIKE 'WFA-DLD-%' AND action = 'document_downloaded' AND entity = 1"));

  expect((await page.request.get(`/custom/mjlfinancement/documentdownload.php?type=convention&id=${conventionFile}`)).status()).toBe(403);
  expect((await page.request.get(`/custom/mjlfinancement/documentdownload.php?type=fundreceipt&id=${receiptFile}`)).status()).toBe(403);
  const after = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE ref LIKE 'WFA-DLD-%' AND action = 'document_downloaded' AND entity = 1"));
  expect(after).toBe(before);
});

test('download delivery fails closed when its audit event cannot be persisted', async ({ page }) => {
  await login(page, fixtureLogin);
  const fileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P3D-SEC-CONVENTION-A' AND entity = 1");
  sql("CREATE TRIGGER p3d_fail_workflow_audit BEFORE INSERT ON llx_mjlfinancement_workflow_action FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced audit failure'");
  try {
    const response = await page.request.get(`/custom/mjlfinancement/documentdownload.php?type=convention&id=${fileId}`);
    expect(response.status()).toBe(503);
    expect(response.headers()['content-disposition']).toBeUndefined();
    expect(await response.text()).not.toContain('P3D-CONVENTION-A');
  } finally {
    sql('DROP TRIGGER IF EXISTS p3d_fail_workflow_audit');
  }
});

test('CSV neutralizes dangerous text while negative money stays numeric and XLSX emits typed cells', async ({ page }) => {
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'P3D-SEC-PROJECT' AND entity = 1");
  await login(page, fixtureLogin);
  const dangerousValues = ['=2+3', '+2+3', '-not-money', '@SUM(A1)', '\tcommand', '\rcommand', '\ncommand'];
  for (const value of dangerousValues) {
    const hexValue = Buffer.from(value, 'utf8').toString('hex');
    sql(`UPDATE llx_projet SET title = CONVERT(0x${hexValue} USING utf8mb4) WHERE rowid = ${projectId} AND entity = 1`);
    await page.goto(`/custom/mjlfinancement/reports.php?report=financial_execution_project&project_id=${projectId}`);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter le CSV' }).click();
    const csv = fs.readFileSync(await (await downloadPromise).path(), 'utf8');
    expect(csv).toContain(`'${value}`);
    expect(csv).toMatch(/;-75000\.1250*(?:[;,\r\n])/);
    expect(csv).not.toMatch(/;'-75000\.1250*(?:[;,\r\n])/);
  }

  sql(`UPDATE llx_mjlfinancement_budget_line SET revised_budget = 1234567890.125 WHERE ref = 'P3D-SEC-BUDGET' AND entity = 1`);
  sql(`UPDATE llx_projet SET title = '=2+3' WHERE rowid = ${projectId} AND entity = 1`);
  await page.goto(`/custom/mjlfinancement/reports.php?report=financial_execution_project&project_id=${projectId}`);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le fichier XLSX' }).click();
  const xlsx = fs.readFileSync(await (await downloadPromise).path());
  const sheet = xlsxEntry(xlsx, 'xl/worksheets/sheet1.xml');
  const strings = xlsxEntry(xlsx, 'xl/sharedStrings.xml');
  expect(sheet).toContain('<v>1234567890.125</v>');
  expect(sheet).not.toContain('<f>');
  expect(strings).toContain('=2+3');
});

test('CSV neutralizes textual money cells while XLSX rejects non-numeric money', () => {
  const result = phpEval(`
    define('NOLOGIN', 1);
    require '/var/www/html/main.inc.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_csv_export.lib.php';
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_xlsx_export.lib.php';
    $headers = array('amount' => 'Montant');
    $rows = array(array('amount' => '=1+1'));
    $csv = '/tmp/mjl-p3d-invalid-money.csv';
    $xlsx = '/tmp/mjl-p3d-invalid-money.xlsx';
    $result = array(
      'csv' => mjl_csv_export_generate_file($csv, $headers, $rows, array('amount')),
      'xlsx' => mjl_xlsx_export_generate_file($xlsx, $headers, $rows, array('amount')),
      'csv_exists' => is_file($csv),
      'xlsx_exists' => is_file($xlsx),
      'csv_content' => is_file($csv) ? file_get_contents($csv) : '',
    );
    @unlink($csv);
    @unlink($xlsx);
    echo json_encode($result);
  `);
  const parsed = JSON.parse(result);
  expect(parsed).toMatchObject({
    csv: true,
    xlsx: false,
    csv_exists: true,
    xlsx_exists: false,
  });
  expect(parsed.csv_content).toContain("'=1+1");
});

test('export generation and audit failures create no audit event and deliver no file', async ({ page }) => {
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'P3D-SEC-PROJECT' AND entity = 1");
  await login(page, fixtureLogin);
  await page.goto(`/custom/mjlfinancement/reports.php?report=financial_execution_project&project_id=${projectId}`);
  const token = await page.locator('form[action*="reports.php"] input[name="token"]').first().inputValue();
  const before = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE action = 'export_generated' AND entity = 1"));

  dockerExec('dolibarr chmod 0555 /tmp');
  try {
    const generationFailure = await page.request.post('/custom/mjlfinancement/reports.php', {
      form: { token, report: 'financial_execution_project', project_id: projectId, action: 'export_csv' },
    });
    expect(generationFailure.status()).toBe(503);
    expect(generationFailure.headers()['content-disposition']).toBeUndefined();
  } finally {
    dockerExec('dolibarr chmod 1777 /tmp');
  }
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE action = 'export_generated' AND entity = 1"))).toBe(before);

  sql("CREATE TRIGGER p3d_fail_workflow_audit BEFORE INSERT ON llx_mjlfinancement_workflow_action FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced audit failure'");
  try {
    const auditFailure = await page.request.post('/custom/mjlfinancement/reports.php', {
      form: { token, report: 'financial_execution_project', project_id: projectId, action: 'export_csv' },
    });
    expect(auditFailure.status()).toBe(503);
    expect(auditFailure.headers()['content-disposition']).toBeUndefined();
  } finally {
    sql('DROP TRIGGER IF EXISTS p3d_fail_workflow_audit');
  }
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE action = 'export_generated' AND entity = 1"))).toBe(before);
});
