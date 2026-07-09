const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const forbiddenResponsePattern = /Acces refuse|Accès refusé|Access denied|Forbidden|Non autorise|Non autorisé|pas autorise|pas autorisé|introuvable ou hors de votre perimetre|introuvable ou hors de votre périmètre|Not Found|404/i;

test.describe.configure({ mode: 'serial' });

function dockerExec(command) {
  execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
}

function sql(query) {
  dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`);
}

function scalar(query) {
  return execSync(`docker compose exec -T mariadb mariadb -udolidbuser -ppoc_pwd -N -B dolidb -e "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

async function login(page, username, userPassword = password) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(userPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

async function expectAccessDenied(page, path) {
  await page.goto(path);
  await expect(page.locator('body')).toContainText(forbiddenResponsePattern);
}

async function sessionToken(page) {
  const tokenInput = page.locator('input[name="token"]').first();
  if (await tokenInput.count()) {
    const token = await tokenInput.getAttribute('value');
    if (token) return token;
  }
  const metaToken = await page.locator('meta[name="anti-csrf-newtoken"]').getAttribute('content');
  expect(metaToken).toBeTruthy();
  return metaToken;
}

function cleanupPhase3() {
  sql(`
    SET @phase3_activities = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'P3-%');
    SET @phase3_expenses = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_expense WHERE ref LIKE 'P3-%');
    SET @phase3_budget_lines = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'P3-%');
    SET @phase3_fund_receipts = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'P3-%');
    SET @phase3_users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'mjl.phase3.%');
    SET @phase3_groups = (SELECT GROUP_CONCAT(rowid) FROM llx_usergroup WHERE nom LIKE 'MJL Phase 3 - %');
    DELETE FROM llx_ecm_files WHERE ref LIKE 'P3-%' OR (src_object_type = 'mjlfinancement_activity' AND FIND_IN_SET(src_object_id, COALESCE(@phase3_activities, ''))) OR (src_object_type = 'mjlfinancement_expense' AND FIND_IN_SET(src_object_id, COALESCE(@phase3_expenses, ''))) OR (src_object_type = 'mjlfinancement_fund_receipt' AND FIND_IN_SET(src_object_id, COALESCE(@phase3_fund_receipts, '')));
    DELETE FROM llx_mjlfinancement_validation WHERE FIND_IN_SET(fk_expense, COALESCE(@phase3_expenses, ''));
    DELETE FROM llx_mjlfinancement_workflow_action WHERE (object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@phase3_activities, ''))) OR (object_type = 'mjlfinancement_expense' AND FIND_IN_SET(object_id, COALESCE(@phase3_expenses, ''))) OR (object_type = 'mjlfinancement_budget_line' AND FIND_IN_SET(object_id, COALESCE(@phase3_budget_lines, ''))) OR (object_type = 'mjlfinancement_fund_receipt' AND FIND_IN_SET(object_id, COALESCE(@phase3_fund_receipts, '')));
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'P3-%';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'P3-%';
    DELETE FROM llx_mjlfinancement_fund_receipt WHERE ref LIKE 'P3-%';
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P3-%';
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE FIND_IN_SET(fk_user, COALESCE(@phase3_users, ''));
    DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user, COALESCE(@phase3_users, ''));
    DELETE FROM llx_usergroup_user WHERE FIND_IN_SET(fk_user, COALESCE(@phase3_users, '')) OR FIND_IN_SET(fk_usergroup, COALESCE(@phase3_groups, ''));
    DELETE FROM llx_usergroup_rights WHERE FIND_IN_SET(fk_usergroup, COALESCE(@phase3_groups, ''));
    DELETE FROM llx_user WHERE FIND_IN_SET(rowid, COALESCE(@phase3_users, ''));
    DELETE FROM llx_usergroup WHERE FIND_IN_SET(rowid, COALESCE(@phase3_groups, ''));
    DELETE FROM llx_projet WHERE ref LIKE 'P3-%';
  `);
}

function seedCrossScopeFixtures() {
  sql(`
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @redev = (SELECT rowid FROM llx_societe WHERE nom = 'Programme Redevabilité' AND entity = 1 LIMIT 1);
    SET @redev_convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-RED-2026-001' AND entity = 1 LIMIT 1);
    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'P3-CROSS-ACT', 'Activite Phase 3 hors perimetre', @project, @redev_convention, '2026-07-01', '2026-07-02', NOW(), @admin, 'P3CROSS', 2);
    SET @activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P3-CROSS-ACT' AND entity = 1);
    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, fk_mjl_activity, initial_budget, revised_budget, committed_amount, spent_amount, remaining_amount, category, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'P3-CROSS-BL', 'Budget Phase 3 hors perimetre', @project, @redev_convention, @activity, 999999999, 999999999, 0, 0, 999999999, 'phase3', NOW(), @admin, 'P3CROSS', 1);
    SET @budget_line = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'P3-CROSS-BL' AND entity = 1);
    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES (1, 'P3-CROSS-EXP', @project, @redev_convention, @activity, @budget_line, 999999999, '2026-07-03', 'Depense Phase 3 hors perimetre', 'P3-CROSS-EXP.pdf', NOW(), NOW(), @admin, 'P3CROSS', 2);
    INSERT INTO llx_mjlfinancement_fund_receipt (entity, ref, fk_soc, fk_project, fk_convention, amount, reception_date, supporting_document, comment, status, date_creation, fk_user_creat, import_key)
    VALUES (1, 'P3-CROSS-FR', @redev, @project, @redev_convention, 999999999, '2026-07-04', 'P3-CROSS-FR.pdf', 'Fonds Phase 3 hors perimetre', 1, NOW(), @admin, 'P3CROSS');
    SET @expense = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'P3-CROSS-EXP' AND entity = 1);
    SET @receipt = (SELECT rowid FROM llx_mjlfinancement_fund_receipt WHERE ref = 'P3-CROSS-FR' AND entity = 1);
    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES
      ('P3-CROSS-ACT-ECM', 'P3-CROSS-ACT.pdf', 1, 'P3-CROSS-ACT.pdf', 'mjlfinancement_activity', 'P3-CROSS-ACT.pdf', 'Piece Phase 3 activite hors perimetre', 1, NOW(), @admin, 'mjlfinancement_activity', @activity),
      ('P3-CROSS-EXP-ECM', 'P3-CROSS-EXP.pdf', 1, 'P3-CROSS-EXP.pdf', 'mjlfinancement_expense', 'P3-CROSS-EXP.pdf', 'Piece Phase 3 depense hors perimetre', 1, NOW(), @admin, 'mjlfinancement_expense', @expense),
      ('P3-CROSS-FR-ECM', 'P3-CROSS-FR.pdf', 1, 'P3-CROSS-FR.pdf', 'mjlfinancement_fund_receipt', 'P3-CROSS-FR.pdf', 'Piece Phase 3 fonds hors perimetre', 1, NOW(), @admin, 'mjlfinancement_fund_receipt', @receipt);
  `);
}

function createScopedUser(loginName, groupName, roleCode, partnerName, rights) {
  const rightStatements = rights.map(([rightPerms, rightSubperms]) => `
    SET @right_id = (SELECT id FROM llx_rights_def WHERE module = 'mjlfinancement' AND perms = '${rightPerms}' AND subperms = '${rightSubperms}' AND entity IN (0, 1) ORDER BY entity DESC LIMIT 1);
    INSERT INTO llx_usergroup_rights (entity, fk_usergroup, fk_id) SELECT 1, @group_id, @right_id WHERE @right_id IS NOT NULL;
  `).join('\n');
  sql(`
    INSERT INTO llx_usergroup (entity, nom, note) VALUES (1, '${groupName}', 'Phase 3 scoped E2E');
    SET @group_id = LAST_INSERT_ID();
    ${rightStatements}
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec) SELECT 1, '${loginName}', 'Phase3', 'E2E', '${loginName}@mjl-poc.local', pass_crypted, 1, 0, NOW() FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @user_id = LAST_INSERT_ID();
    SET @partner_id = (SELECT rowid FROM llx_societe WHERE nom = '${partnerName}' AND entity = 1 LIMIT 1);
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @user_id, @group_id);
    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, date_creation, fk_user_creat, import_key) VALUES (1, @user_id, '${roleCode}', 1, NOW(), 'phase3_e2e', NOW(), NULL, 'P3E2E');
    INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, date_creation, fk_user_creat, import_key) VALUES (1, @user_id, @partner_id, 1, NOW(), 'phase3_e2e', NOW(), NULL, 'P3E2E');
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase3();
  seedCrossScopeFixtures();
  createScopedUser('mjl.phase3.unicef', 'MJL Phase 3 - UNICEF Read', 'AGENT_VERIFICATEUR', 'UNICEF', [
    ['convention', 'read'], ['budgetline', 'read'], ['fundreceipt', 'read'], ['activity', 'read'], ['expense', 'read'],
  ]);
  createScopedUser('mjl.phase3.redev', 'MJL Phase 3 - Redev Read', 'AGENT_VERIFICATEUR', 'Programme Redevabilité', [
    ['convention', 'read'], ['budgetline', 'read'], ['fundreceipt', 'read'], ['activity', 'read'], ['expense', 'read'],
  ]);
});

test.afterAll(() => {
  cleanupPhase3();
});

test('partner list/detail stay inside assigned partner scope and finance reference pages are blocked', async ({ page }) => {
  const redevPartner = scalar("SELECT rowid FROM llx_societe WHERE nom = 'Programme Redevabilité' AND entity = 1 LIMIT 1");
  const redevConvention = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-RED-2026-001' AND entity = 1 LIMIT 1");

  await login(page, 'mjl.phase3.unicef');
  await page.goto('/custom/mjlfinancement/partners.php');
  await expect(page.getByRole('heading', { name: 'Partenaires / Programmes' })).toBeVisible();
  await expect(page.locator('body')).toContainText('UNICEF');
  await expect(page.locator('body')).not.toContainText('Programme Redevabilité');
  await expectAccessDenied(page, `/custom/mjlfinancement/partners.php?id=${redevPartner}`);
  await expectAccessDenied(page, `/custom/mjlfinancement/conventions.php?id=${redevConvention}`);

  await expectAccessDenied(page, '/custom/mjlfinancement/conventions.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/budgetlines.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/fundreceipts.php');
});

test('UNICEF project detail excludes cross-scope related rows and aggregates', async ({ page }) => {
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");

  await login(page, 'mjl.phase3.unicef');
  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}`);
  await expect(page.getByRole('heading', { name: 'Projet PRJ-JE-2026' })).toBeVisible();
  await expect(page.locator('body')).toContainText('ACT-JE-001');
  await expect(page.locator('body')).toContainText('EXP-JE-001');
  await expect(page.locator('body')).not.toContainText(/Erreur SQL|SQL syntax|You have an error in your SQL syntax/i);
  await expect(page.locator('body')).not.toContainText('P3-CROSS-');
  await expect(page.locator('body')).not.toContainText('999 999 999');
});

test('admin sees all partners and final validator can create and edit projects while lower roles cannot', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/partners.php');
  await expect(page.locator('body')).toContainText('UNICEF');
  await expect(page.locator('body')).toContainText('Programme Redevabilité');

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/projects.php');
  await page.getByLabel('Reference').first().fill('P3-DPAF-PROJ');
  await page.getByLabel('Intitule').first().fill('Projet Phase 3 DPAF');
  await page.locator('select[name="fk_soc"]').first().selectOption(scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1"));
  await page.getByRole('button', { name: 'Creer le projet' }).click();
  await expect(page).toHaveURL(/projects\.php\?id=\d+/);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_projet WHERE ref = 'P3-DPAF-PROJ' AND entity = 1 AND fk_soc IS NOT NULL"))).toBe(1);
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'P3-DPAF-PROJ' AND entity = 1 LIMIT 1");
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'created' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBe(1);

  await page.getByLabel('Intitule').fill('Projet Phase 3 DPAF modifie');
  await page.getByRole('button', { name: 'Enregistrer le projet' }).click();
  await expect(page).toHaveURL(/projects\.php\?id=\d+/);
  expect(scalar(`SELECT title FROM llx_projet WHERE rowid = ${projectId}`)).toBe('Projet Phase 3 DPAF modifie');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'field_changed' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBeGreaterThanOrEqual(1);

  await login(page, 'admin.poc');
  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}`);
  await page.getByLabel('Reference').fill('P3-ADMIN-PROJ');
  await page.getByRole('button', { name: 'Enregistrer le projet' }).click();
  expect(scalar(`SELECT ref FROM llx_projet WHERE rowid = ${projectId}`)).toBe('P3-ADMIN-PROJ');

  await login(page, 'mjl.phase3.unicef');
  await page.goto('/custom/mjlfinancement/projects.php');
  await expect(page.getByRole('heading', { name: 'Projets' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Creer le projet' })).toHaveCount(0);
  const before = Number(scalar("SELECT COUNT(*) FROM llx_projet WHERE ref = 'P3-FORBIDDEN' AND entity = 1"));
  const token = await sessionToken(page);
  const response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: { token, action: 'create', ref: 'P3-FORBIDDEN', title: 'Projet interdit', fk_soc: scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1") },
  });
  expect(await response.text()).toMatch(forbiddenResponsePattern);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_projet WHERE ref = 'P3-FORBIDDEN' AND entity = 1"))).toBe(before);

  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}`);
  await expect(page.getByRole('button', { name: 'Enregistrer le projet' })).toHaveCount(0);
  const editToken = await sessionToken(page);
  const editResponse = await page.request.post(`/custom/mjlfinancement/projects.php?id=${projectId}`, {
    form: { token: editToken, action: 'update', id: projectId, ref: 'P3-FORBIDDEN-EDIT', title: 'Projet modification interdite', fk_soc: scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1") },
  });
  expect(await editResponse.text()).toMatch(forbiddenResponsePattern);
  expect(scalar(`SELECT ref FROM llx_projet WHERE rowid = ${projectId}`)).toBe('P3-ADMIN-PROJ');
});

test('public registration remains absent', async ({ page }) => {
  await page.goto('/user/create.php').catch(() => {});
  await expect(page.locator('body')).not.toContainText(/Créer un compte|Creer un compte|Register|Inscription publique/i);
});
