const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { verifyDisposableEnvironment } = require('../helpers/verify-disposable-environment');
const { login, scalar, sql } = require('../helpers/mjl-test-runtime');

const actorLogin = 'mjl.characterization.c2';
const assigned = 'C2-ASSIGNED';
const outside = 'C2-OUTSIDE';

function cleanup() {
  sql(`
    SET @user = (SELECT rowid FROM llx_user WHERE login = '${actorLogin}');
    DELETE FROM llx_mjlfinancement_exchange_log WHERE ref LIKE 'C2-%' OR actor = @user;
    DELETE FROM llx_mjlfinancement_workflow_action WHERE ref LIKE 'C2-%' OR actor = @user;
    DELETE FROM llx_mjlfinancement_validation WHERE ref LIKE 'C2-%' OR fk_user_action = @user;
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'C2-%';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'C2-%';
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'C2-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'C2-%';
    DELETE FROM llx_projet WHERE ref LIKE 'C2-%';
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE fk_user = @user;
    DELETE FROM llx_mjlfinancement_user_role WHERE fk_user = @user;
    DELETE FROM llx_usergroup_user WHERE fk_user = @user;
    DELETE FROM llx_user WHERE rowid = @user;
    DELETE FROM llx_societe WHERE nom IN ('${assigned}', '${outside}');
  `);
}

function seed() {
  sql(`
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1);
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, '${actorLogin}', 'Characterization', 'C2', '${actorLogin}@mjl-poc.local', pass_crypted, 1, 0, NOW() FROM llx_user WHERE login = 'dpaf.mjl' LIMIT 1;
    SET @actor = LAST_INSERT_ID();
    SET @group = (SELECT ugu.fk_usergroup FROM llx_usergroup_user ugu JOIN llx_user u ON u.rowid = ugu.fk_user WHERE ugu.entity = 1 AND u.login = 'dpaf.mjl' LIMIT 1);
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @actor, @group);
    INSERT INTO llx_societe (entity, nom, client, fournisseur, datec, fk_user_creat, import_key, status) VALUES
      (1, '${assigned}', 0, 0, NOW(), @admin, 'C2ASOC', 1),
      (1, '${outside}', 0, 0, NOW(), @admin, 'C2XSOC', 1);
    SET @assigned_partner = (SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = '${assigned}');
    SET @outside_partner = (SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = '${outside}');
    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
    VALUES (1, @actor, 'VALIDATEUR_DEFINITIF', 1, NOW(), 'characterization_c2', 'current route admission only', NOW(), @admin, 'C2ROLE');
    INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
    VALUES (1, @actor, @assigned_partner, 1, NOW(), 'characterization_c2', 'one assigned partner', NOW(), @admin, 'C2SCOPE');
    INSERT INTO llx_projet (entity, fk_soc, datec, ref, title, fk_user_creat, public, fk_statut, import_key) VALUES
      (1, @assigned_partner, NOW(), 'C2-ASSIGNED-PROJECT', 'C2-ASSIGNED-PROJECT', @admin, 0, 1, 'C2APROJ'),
      (1, @outside_partner, NOW(), 'C2-OUTSIDE-PROJECT', 'C2-OUTSIDE-PROJECT', @admin, 0, 1, 'C2XPROJ');
    SET @assigned_project = (SELECT rowid FROM llx_projet WHERE ref = 'C2-ASSIGNED-PROJECT' AND entity = 1);
    SET @outside_project = (SELECT rowid FROM llx_projet WHERE ref = 'C2-OUTSIDE-PROJECT' AND entity = 1);
    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, date_creation, fk_user_creat, import_key, status) VALUES
      (1, 'C2-ASSIGNED-CONVENTION', 'C2-ASSIGNED-CONVENTION', @assigned_partner, @assigned_project, '2026-01-01', '2026-12-31', 1000, 'XOF', NOW(), @admin, 'C2ACONV', 1),
      (1, 'C2-OUTSIDE-CONVENTION', 'C2-OUTSIDE-CONVENTION', @outside_partner, @outside_project, '2026-01-01', '2026-12-31', 1000, 'XOF', NOW(), @admin, 'C2XCONV', 1);
    SET @assigned_convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'C2-ASSIGNED-CONVENTION' AND entity = 1);
    SET @outside_convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'C2-OUTSIDE-CONVENTION' AND entity = 1);
    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status) VALUES
      (1, 'C2-ASSIGNED-ACTIVITY', 'C2-ASSIGNED-ACTIVITY', @assigned_project, @assigned_convention, '2026-01-01', '2026-01-02', NOW(), @admin, 'C2AACT', 1),
      (1, 'C2-OUTSIDE-ACTIVITY', 'C2-OUTSIDE-ACTIVITY', @outside_project, @outside_convention, '2026-01-01', '2026-01-02', NOW(), @admin, 'C2XACT', 1);
    SET @assigned_activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'C2-ASSIGNED-ACTIVITY' AND entity = 1);
    SET @outside_activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'C2-OUTSIDE-ACTIVITY' AND entity = 1);
    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, fk_mjl_activity, initial_budget, revised_budget, category, date_creation, fk_user_creat, import_key, status) VALUES
      (1, 'C2-ASSIGNED-BUDGET', 'C2-ASSIGNED-BUDGET', @assigned_project, @assigned_convention, @assigned_activity, 1000, 1000, 'characterization_c2', NOW(), @admin, 'C2ABUD', 1),
      (1, 'C2-OUTSIDE-BUDGET', 'C2-OUTSIDE-BUDGET', @outside_project, @outside_convention, @outside_activity, 1000, 1000, 'characterization_c2', NOW(), @admin, 'C2XBUD', 1);
    SET @assigned_budget = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'C2-ASSIGNED-BUDGET' AND entity = 1);
    SET @outside_budget = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'C2-OUTSIDE-BUDGET' AND entity = 1);
    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, date_creation, fk_user_creat, import_key, status) VALUES
      (1, 'C2-ASSIGNED-EXPENSE', @assigned_project, @assigned_convention, @assigned_activity, @assigned_budget, 100, '2026-01-02', 'C2-ASSIGNED-EXPENSE', NOW(), @admin, 'C2AEXP', 1),
      (1, 'C2-OUTSIDE-EXPENSE', @outside_project, @outside_convention, @outside_activity, @outside_budget, 100, '2026-01-02', 'C2-OUTSIDE-EXPENSE', NOW(), @admin, 'C2XEXP', 1);
    SET @assigned_expense = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'C2-ASSIGNED-EXPENSE' AND entity = 1);
    SET @outside_expense = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'C2-OUTSIDE-EXPENSE' AND entity = 1);
    INSERT INTO llx_mjlfinancement_validation (entity, ref, fk_expense, action, from_status, to_status, fk_user_action, actor_role, action_date, comment, date_creation, fk_user_creat) VALUES
      (1, 'C2-ASSIGNED-VALIDATION', @assigned_expense, 'submitted', '0', '1', @admin, 'AGENT_SAISIE', NOW(), 'C2-ASSIGNED-VALIDATION', NOW(), @admin),
      (1, 'C2-OUTSIDE-VALIDATION', @outside_expense, 'submitted', '0', '1', @admin, 'AGENT_SAISIE', NOW(), 'C2-OUTSIDE-VALIDATION', NOW(), @admin);
    INSERT INTO llx_mjlfinancement_workflow_action (entity, ref, object_type, object_id, action, actor, actor_role, action_date, comment, changes_json, date_creation, fk_user_creat, import_key) VALUES
      (1, 'C2-ASSIGNED-WORKFLOW', 'mjlfinancement_expense', @assigned_expense, 'submitted', @admin, 'AGENT_SAISIE', NOW(), 'C2-ASSIGNED-WORKFLOW', '{}', NOW(), @admin, 'C2AWFA'),
      (1, 'C2-OUTSIDE-WORKFLOW', 'mjlfinancement_expense', @outside_expense, 'submitted', @admin, 'AGENT_SAISIE', NOW(), 'C2-OUTSIDE-WORKFLOW', '{}', NOW(), @admin, 'C2XWFA');
    INSERT INTO llx_mjlfinancement_exchange_log (entity, ref, object_type, object_id, exchange_date, actor, actor_role, channel, subject, message, date_creation, fk_user_creat, import_key) VALUES
      (1, 'C2-ASSIGNED-EXCHANGE', 'mjlfinancement_expense', @assigned_expense, NOW(), @admin, 'AGENT_SAISIE', 'comment', 'C2-ASSIGNED-EXCHANGE', 'C2-ASSIGNED-EXCHANGE', NOW(), @admin, 'C2AEXCH'),
      (1, 'C2-OUTSIDE-EXCHANGE', 'mjlfinancement_expense', @outside_expense, NOW(), @admin, 'AGENT_SAISIE', 'comment', 'C2-OUTSIDE-EXCHANGE', 'C2-OUTSIDE-EXCHANGE', NOW(), @admin, 'C2XEXCH');
  `);
}

test.beforeAll(() => {
  verifyDisposableEnvironment();
  cleanup();
  seed();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_role r JOIN llx_user u ON u.rowid = r.fk_user WHERE u.login = '${actorLogin}' AND r.is_active = 1`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope s JOIN llx_user u ON u.rowid = s.fk_user WHERE u.login = '${actorLogin}' AND s.is_active = 1`))).toBe(1);
});

test.afterAll(() => {
  cleanup();
  const residual = Number(scalar(`
    SELECT
      (SELECT COUNT(*) FROM llx_user WHERE login = '${actorLogin}') +
      (SELECT COUNT(*) FROM llx_societe WHERE nom IN ('${assigned}', '${outside}')) +
      (SELECT COUNT(*) FROM llx_projet WHERE ref LIKE 'C2-%') +
      (SELECT COUNT(*) FROM llx_mjlfinancement_convention WHERE ref LIKE 'C2-%') +
      (SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE ref LIKE 'C2-%') +
      (SELECT COUNT(*) FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'C2-%') +
      (SELECT COUNT(*) FROM llx_mjlfinancement_expense WHERE ref LIKE 'C2-%') +
      (SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE ref LIKE 'C2-%') +
      (SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE ref LIKE 'C2-%') +
      (SELECT COUNT(*) FROM llx_mjlfinancement_exchange_log WHERE ref LIKE 'C2-%')
  `));
  expect(residual).toBe(0);
});

test.describe('CHARACTERIZATION — current advanced-route permissions pending product authority (registry C2)', () => {
  test.beforeEach(async ({ page }) => login(page, actorLogin));

  for (const [route, positive, negative] of [
    ['/custom/mjlfinancement/dpafdashboard.php', assigned, outside],
    ['/custom/mjlfinancement/reports.php?report=activities_tracking', assigned, outside],
    ['/custom/mjlfinancement/validations.php', 'C2-ASSIGNED-VALIDATION', 'C2-OUTSIDE-VALIDATION'],
    ['/custom/mjlfinancement/workflowactions.php', 'C2-ASSIGNED-WORKFLOW', 'C2-OUTSIDE-WORKFLOW'],
    ['/custom/mjlfinancement/exchangelogs.php', 'C2-ASSIGNED-EXCHANGE', 'C2-OUTSIDE-EXCHANGE'],
  ]) {
    test(`${route} admet actuellement le validateur final et filtre son périmètre`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response.status()).toBe(200);
      await expect(page.locator('body')).toContainText(positive);
      await expect(page.locator('body')).not.toContainText(negative);
    });
  }

  test('la création et la modification de projet restent actuellement admises pour le validateur final', async ({ page }) => {
    const partnerId = scalar(`SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = '${assigned}'`);
    await page.goto('/custom/mjlfinancement/projects.php');
    await page.getByRole('link', { name: 'Créer un projet' }).click();
    await page.getByLabel('Référence').first().fill('C2-CHAR-PROJECT');
    await page.getByLabel('Intitulé').first().fill('C2 projet caractérisé');
    await page.locator('select[name="fk_soc"]').first().selectOption(partnerId);
    await page.getByRole('button', { name: 'Créer le projet' }).click();
    await expect(page).toHaveURL(/projects\.php\?id=\d+/);
    const projectId = scalar("SELECT rowid FROM llx_projet WHERE entity = 1 AND ref = 'C2-CHAR-PROJECT'");
    expect(projectId).not.toBe('');
    expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE entity = 1 AND object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'created' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBe(1);

    await page.getByRole('link', { name: 'Modifier le projet' }).click();
    await page.getByLabel('Intitulé').fill('C2 projet caractérisé modifié');
    await page.getByRole('button', { name: 'Enregistrer le projet' }).click();
    expect(scalar(`SELECT title FROM llx_projet WHERE rowid = ${projectId}`)).toBe('C2 projet caractérisé modifié');
  });

  test('l’export CSV actuel reste admis et filtré pour le validateur final', async ({ page }) => {
    const partnerId = scalar(`SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = '${assigned}'`);
    await page.goto(`/custom/mjlfinancement/reports.php?report=activities_tracking&fk_soc=${partnerId}`);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter le CSV' }).click();
    const download = await downloadPromise;
    const content = fs.readFileSync(await download.path(), 'utf8');
    expect(content).toContain('C2-ASSIGNED-PROJECT');
    expect(content).not.toContain('C2-OUTSIDE-PROJECT');
  });
});
