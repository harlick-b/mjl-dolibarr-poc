const { test, expect } = require('@playwright/test');
const { verifyDisposableEnvironment } = require('../helpers/verify-disposable-environment');
const { composeExec, login, scalar, sql } = require('../helpers/mjl-test-runtime');

const actorLogin = 'mjl.inventory.agent';
const noRoleLogin = 'mjl.inventory.no-role';
const entityOneUser = 'mjl.inventory.entity-one';
const entityTwoUser = 'mjl.inventory.entity-two';
const fixtureSource = 'inventory_e2e';

const applicationScreens = Object.freeze([
  ['tableau de bord', '/custom/mjlfinancement/index.php', 'Tableau de bord MJL', 'Tableau de bord MJL'],
  ['Partenaires / Programmes', '/custom/mjlfinancement/partners.php', 'Partenaires / Programmes', 'Partenaires / Programmes MJL'],
  ['projets', '/custom/mjlfinancement/projects.php', 'Projets', 'Projets MJL'],
  ['activités', '/custom/mjlfinancement/activities.php', 'Suivi des activités et décisions', 'Activités MJL'],
  ['dépenses', '/custom/mjlfinancement/expenses.php', 'Dépenses et pièces justificatives', 'Dépenses MJL'],
  ['documents', '/custom/mjlfinancement/documents.php', 'Documents', 'Documents MJL'],
  ['enveloppes de financement', '/custom/mjlfinancement/conventions.php', 'Gestion des enveloppes de financement', 'Enveloppes de financement MJL'],
  ['lignes budgétaires', '/custom/mjlfinancement/budgetlines.php', 'Gestion des lignes budgétaires', 'Lignes budgétaires MJL'],
  ['fonds reçus', '/custom/mjlfinancement/fundreceipts.php', 'Gestion des réceptions de fonds', 'Réceptions de fonds MJL'],
  ['alertes', '/custom/mjlfinancement/alerts.php', 'Alertes MJL', 'Alertes MJL'],
  ['supervision', '/custom/mjlfinancement/dpafdashboard.php', 'Tableau de supervision financière', 'Tableau de supervision finance'],
  ['rapports', '/custom/mjlfinancement/reports.php', 'Centre d’exports MJL', "Centre d'exports MJL"],
  ['historique des validations', '/custom/mjlfinancement/validations.php', 'Historique des validations', 'Historique des validations'],
  ['historique des actions', '/custom/mjlfinancement/workflowactions.php', 'Historique des actions', 'Historique des actions'],
  ['historique des échanges', '/custom/mjlfinancement/exchangelogs.php', 'Recherche dans l’historique des échanges', 'Historique / Audit MJL'],
  ['administration des accès', '/custom/mjlfinancement/admin/access.php', 'Gestion des accès MJL', 'Gestion des accès MJL'],
]);

const scopedRouteDescriptors = Object.freeze([
  { route: '/custom/mjlfinancement/partners.php', positive: 'INV-A1-PARTNER', outside: 'INV-X1-PARTNER', entityTwo: 'INV-E2-PARTNER' },
  { route: '/custom/mjlfinancement/projects.php', positive: 'INV-A1-PROJECT', outside: 'INV-X1-PROJECT', entityTwo: 'INV-E2-PROJECT' },
  { route: '/custom/mjlfinancement/activities.php', positive: 'INV-A1-ACTIVITY', outside: 'INV-X1-ACTIVITY', entityTwo: 'INV-E2-ACTIVITY' },
  { route: '/custom/mjlfinancement/expenses.php', positive: 'INV-A1-EXPENSE', outside: 'INV-X1-EXPENSE', entityTwo: 'INV-E2-EXPENSE' },
  { route: '/custom/mjlfinancement/documents.php', positive: 'INV-A1-DOCUMENT.txt', outside: 'INV-X1-DOCUMENT.txt', entityTwo: 'INV-E2-DOCUMENT.txt' },
  { route: '/custom/mjlfinancement/alerts.php', positive: 'INV-A1-ACTIVITY', outside: 'INV-X1-ACTIVITY', entityTwo: 'INV-E2-ACTIVITY' },
]);

const forbiddenResponsePattern = /Acces refuse|Accès refusé|Access denied|Forbidden|Non autorise|Non autorisé/i;
const diagnosticPattern = /SQLSTATE|Fatal error|Stack trace|Call to undefined|Warning:\s+(?:require|include)/i;

function cleanupInventoryFixture() {
  sql(`
    SET @fixture_users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'mjl.inventory.%');
    DELETE FROM llx_ecm_files WHERE ref LIKE 'INV-%';
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'INV-%';
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'INV-%';
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'INV-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'INV-%';
    DELETE FROM llx_projet WHERE ref LIKE 'INV-%';
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE source = '${fixtureSource}' OR FIND_IN_SET(fk_user, COALESCE(@fixture_users, ''));
    DELETE FROM llx_mjlfinancement_user_role WHERE source = '${fixtureSource}' OR FIND_IN_SET(fk_user, COALESCE(@fixture_users, ''));
    DELETE FROM llx_usergroup_user WHERE FIND_IN_SET(fk_user, COALESCE(@fixture_users, ''));
    DELETE FROM llx_user WHERE FIND_IN_SET(rowid, COALESCE(@fixture_users, ''));
    DELETE FROM llx_societe WHERE nom LIKE 'INV-%-PARTNER';
  `);
  composeExec('dolibarr', ['sh', '-lc', 'rm -f /var/www/documents/ecm/mjlfinancement_expense/INV-A1-DOCUMENT.txt /var/www/documents/ecm/mjlfinancement_expense/INV-X1-DOCUMENT.txt /var/www/documents/ecm/mjlfinancement_expense/INV-E2-DOCUMENT.txt']);
}

function seedInventoryFixture() {
  sql(`
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' AND entity IN (0, 1) LIMIT 1);
    SET @agent_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL POC - Agent' AND entity = 1 LIMIT 1);

    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, '${actorLogin}', 'Inventory', 'Agent', '${actorLogin}@mjl-poc.local', pass_crypted, 1, 0, NOW() FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @actor = LAST_INSERT_ID();
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, '${noRoleLogin}', 'Inventory', 'SansRole', '${noRoleLogin}@mjl-poc.local', pass_crypted, 1, 0, NOW() FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @no_role = LAST_INSERT_ID();
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, '${entityOneUser}', 'Inventory', 'EntityOne', '${entityOneUser}@mjl-poc.local', pass_crypted, 1, 0, NOW() FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @entity_one_user = LAST_INSERT_ID();
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 2, '${entityTwoUser}', 'Inventory', 'EntityTwo', '${entityTwoUser}@mjl-poc.local', pass_crypted, 1, 0, NOW() FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @entity_two_user = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @actor, @agent_group), (1, @no_role, @agent_group);

    INSERT INTO llx_societe (entity, nom, client, fournisseur, datec, fk_user_creat, import_key, status) VALUES
      (1, 'INV-A1-PARTNER', 0, 0, NOW(), @admin, 'INVA1SOC', 1),
      (1, 'INV-X1-PARTNER', 0, 0, NOW(), @admin, 'INVX1SOC', 1),
      (2, 'INV-E2-PARTNER', 0, 0, NOW(), @admin, 'INVE2SOC', 1);
    SET @entity_two_partner = LAST_INSERT_ID();
    SET @assigned_partner = (SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = 'INV-A1-PARTNER');
    SET @outside_partner = (SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = 'INV-X1-PARTNER');

    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
    VALUES
      (1, @actor, 'AGENT_SAISIE', 1, NOW(), '${fixtureSource}', 'one current role', NOW(), @admin, 'INVA1ROLE'),
      (1, @entity_one_user, 'AGENT_SAISIE', 1, NOW(), '${fixtureSource}', 'admin entity sentinel', NOW(), @admin, 'INVE1ROLE'),
      (2, @entity_two_user, 'AGENT_SAISIE', 1, NOW(), '${fixtureSource}', 'admin entity sentinel', NOW(), @admin, 'INVE2ROLE');
    INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
    VALUES
      (1, @actor, @assigned_partner, 1, NOW(), '${fixtureSource}', 'one assigned partner', NOW(), @admin, 'INVA1SCOPE'),
      (1, @entity_one_user, @assigned_partner, 1, NOW(), '${fixtureSource}', 'admin entity sentinel', NOW(), @admin, 'INVE1SCOPE'),
      (2, @entity_two_user, @entity_two_partner, 1, NOW(), '${fixtureSource}', 'admin entity sentinel', NOW(), @admin, 'INVE2SCOPE');

    SET FOREIGN_KEY_CHECKS = 0;
    INSERT INTO llx_projet (entity, fk_soc, datec, ref, title, fk_user_creat, public, fk_statut, import_key) VALUES
      (1, @assigned_partner, NOW(), 'INV-A1-PROJECT', 'INV-A1-PROJECT', @actor, 0, 1, 'INVA1PROJ'),
      (1, @outside_partner, NOW(), 'INV-X1-PROJECT', 'INV-X1-PROJECT', @actor, 0, 1, 'INVX1PROJ'),
      (2, @entity_two_partner, NOW(), 'INV-E2-PROJECT', 'INV-E2-PROJECT', @actor, 0, 1, 'INVE2PROJ');
    SET @assigned_project = (SELECT rowid FROM llx_projet WHERE entity = 1 AND ref = 'INV-A1-PROJECT');
    SET @outside_project = (SELECT rowid FROM llx_projet WHERE entity = 1 AND ref = 'INV-X1-PROJECT');
    SET @entity_two_project = (SELECT rowid FROM llx_projet WHERE entity = 2 AND ref = 'INV-E2-PROJECT');
    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, date_creation, fk_user_creat, import_key, status) VALUES
      (1, 'INV-A1-CONVENTION', 'INV-A1-CONVENTION', @assigned_partner, @assigned_project, '2025-01-01', '2027-12-31', 10000, 'XOF', NOW(), @actor, 'INVA1CONV', 1),
      (1, 'INV-X1-CONVENTION', 'INV-X1-CONVENTION', @outside_partner, @outside_project, '2025-01-01', '2027-12-31', 10000, 'XOF', NOW(), @actor, 'INVX1CONV', 1),
      (2, 'INV-E2-CONVENTION', 'INV-E2-CONVENTION', @entity_two_partner, @entity_two_project, '2025-01-01', '2027-12-31', 10000, 'XOF', NOW(), @actor, 'INVE2CONV', 1);
    SET @assigned_convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE entity = 1 AND ref = 'INV-A1-CONVENTION');
    SET @outside_convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE entity = 1 AND ref = 'INV-X1-CONVENTION');
    SET @entity_two_convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE entity = 2 AND ref = 'INV-E2-CONVENTION');
    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status) VALUES
      (1, 'INV-A1-ACTIVITY', 'INV-A1-ACTIVITY', @assigned_project, @assigned_convention, '2025-01-01', '2025-01-02', NOW(), @actor, 'INVA1ACT', 0),
      (1, 'INV-X1-ACTIVITY', 'INV-X1-ACTIVITY', @outside_project, @outside_convention, '2025-01-01', '2025-01-02', NOW(), @actor, 'INVX1ACT', 0),
      (2, 'INV-E2-ACTIVITY', 'INV-E2-ACTIVITY', @entity_two_project, @entity_two_convention, '2025-01-01', '2025-01-02', NOW(), @actor, 'INVE2ACT', 0);
    SET @assigned_activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE entity = 1 AND ref = 'INV-A1-ACTIVITY');
    SET @outside_activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE entity = 1 AND ref = 'INV-X1-ACTIVITY');
    SET @entity_two_activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE entity = 2 AND ref = 'INV-E2-ACTIVITY');
    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, fk_mjl_activity, initial_budget, revised_budget, category, date_creation, fk_user_creat, import_key, status) VALUES
      (1, 'INV-A1-BUDGET', 'INV-A1-BUDGET', @assigned_project, @assigned_convention, @assigned_activity, 10000, 10000, 'inventory', NOW(), @actor, 'INVA1BUD', 1),
      (1, 'INV-X1-BUDGET', 'INV-X1-BUDGET', @outside_project, @outside_convention, @outside_activity, 10000, 10000, 'inventory', NOW(), @actor, 'INVX1BUD', 1),
      (2, 'INV-E2-BUDGET', 'INV-E2-BUDGET', @entity_two_project, @entity_two_convention, @entity_two_activity, 10000, 10000, 'inventory', NOW(), @actor, 'INVE2BUD', 1);
    SET @assigned_budget = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE entity = 1 AND ref = 'INV-A1-BUDGET');
    SET @outside_budget = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE entity = 1 AND ref = 'INV-X1-BUDGET');
    SET @entity_two_budget = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE entity = 2 AND ref = 'INV-E2-BUDGET');
    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, date_creation, fk_user_creat, import_key, status) VALUES
      (1, 'INV-A1-EXPENSE', @assigned_project, @assigned_convention, @assigned_activity, @assigned_budget, 100, '2025-01-02', 'INV-A1-EXPENSE', 'INV-A1-DOCUMENT.txt', NOW(), @actor, 'INVA1EXP', 1),
      (1, 'INV-X1-EXPENSE', @outside_project, @outside_convention, @outside_activity, @outside_budget, 100, '2025-01-02', 'INV-X1-EXPENSE', 'INV-X1-DOCUMENT.txt', NOW(), @actor, 'INVX1EXP', 1),
      (2, 'INV-E2-EXPENSE', @entity_two_project, @entity_two_convention, @entity_two_activity, @entity_two_budget, 100, '2025-01-02', 'INV-E2-EXPENSE', 'INV-E2-DOCUMENT.txt', NOW(), @actor, 'INVE2EXP', 1);
    SET @assigned_expense = (SELECT rowid FROM llx_mjlfinancement_expense WHERE entity = 1 AND ref = 'INV-A1-EXPENSE');
    SET @outside_expense = (SELECT rowid FROM llx_mjlfinancement_expense WHERE entity = 1 AND ref = 'INV-X1-EXPENSE');
    SET @entity_two_expense = (SELECT rowid FROM llx_mjlfinancement_expense WHERE entity = 2 AND ref = 'INV-E2-EXPENSE');
    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id) VALUES
      ('INV-A1-DOC', 'INV-A1-DOCUMENT.txt', 1, 'INV-A1-DOCUMENT.txt', 'mjlfinancement_expense', 'INV-A1-DOCUMENT.txt', 'INV-A1-DOCUMENT.txt', 1, NOW(), @actor, 'mjlfinancement_expense', @assigned_expense),
      ('INV-X1-DOC', 'INV-X1-DOCUMENT.txt', 1, 'INV-X1-DOCUMENT.txt', 'mjlfinancement_expense', 'INV-X1-DOCUMENT.txt', 'INV-X1-DOCUMENT.txt', 1, NOW(), @actor, 'mjlfinancement_expense', @outside_expense),
      ('INV-E2-DOC', 'INV-E2-DOCUMENT.txt', 2, 'INV-E2-DOCUMENT.txt', 'mjlfinancement_expense', 'INV-E2-DOCUMENT.txt', 'INV-E2-DOCUMENT.txt', 1, NOW(), @actor, 'mjlfinancement_expense', @entity_two_expense);
    SET FOREIGN_KEY_CHECKS = 1;
  `);
  composeExec('dolibarr', ['sh', '-lc', 'mkdir -p /var/www/documents/ecm/mjlfinancement_expense && printf %s INV-A1 > /var/www/documents/ecm/mjlfinancement_expense/INV-A1-DOCUMENT.txt && printf %s INV-X1 > /var/www/documents/ecm/mjlfinancement_expense/INV-X1-DOCUMENT.txt && printf %s INV-E2 > /var/www/documents/ecm/mjlfinancement_expense/INV-E2-DOCUMENT.txt']);
}

function fixtureResidualCount() {
  return Number(scalar(`SELECT
    (SELECT COUNT(*) FROM llx_user WHERE login LIKE 'mjl.inventory.%') +
    (SELECT COUNT(*) FROM llx_societe WHERE nom LIKE 'INV-%-PARTNER') +
    (SELECT COUNT(*) FROM llx_projet WHERE ref LIKE 'INV-%') +
    (SELECT COUNT(*) FROM llx_mjlfinancement_convention WHERE ref LIKE 'INV-%') +
    (SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE ref LIKE 'INV-%') +
    (SELECT COUNT(*) FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'INV-%') +
    (SELECT COUNT(*) FROM llx_mjlfinancement_expense WHERE ref LIKE 'INV-%') +
    (SELECT COUNT(*) FROM llx_ecm_files WHERE ref LIKE 'INV-%')`));
}

async function expectSafeMjlScreen(page, route, expectedHeading, expectedDocumentTitle) {
  const response = await page.goto(route);
  expect(response.status(), route).toBe(200);
  await expect(page.locator('main#mjl-main-content')).toHaveCount(1);
  await expect(page.locator('main#mjl-main-content')).toBeVisible();
  await expect(page.getByLabel('Menu module MJL')).toBeVisible();
  await expect(page.locator('header.mjl-page-header h1')).toHaveCount(1);
  await expect(page.locator('header.mjl-page-header h1')).toHaveText(expectedHeading);
  await expect(page).toHaveTitle(new RegExp(expectedDocumentTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('body')).not.toContainText(diagnosticPattern);
  await expect(page.locator('body')).not.toContainText(/INV-E2-/);
}

async function expectDenied(page, route) {
  const response = await page.goto(route);
  expect([200, 403], route).toContain(response.status());
  await expect(page.locator('body'), route).toContainText(forbiddenResponsePattern);
  await expect(page.locator('body'), route).not.toContainText(diagnosticPattern);
}

function dashboardCard(page, label) {
  return page.locator('.mjl-dashboard-card', { has: page.getByText(label, { exact: true }) });
}

test.beforeAll(() => {
  verifyDisposableEnvironment();
  cleanupInventoryFixture();
  expect(fixtureResidualCount()).toBe(0);
  seedInventoryFixture();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_role r JOIN llx_user u ON u.rowid = r.fk_user WHERE u.login = '${actorLogin}' AND r.entity = 1 AND r.is_active = 1`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope s JOIN llx_user u ON u.rowid = s.fk_user WHERE u.login = '${actorLogin}' AND s.entity = 1 AND s.is_active = 1`))).toBe(1);
});

test.afterAll(() => {
  cleanupInventoryFixture();
  expect(fixtureResidualCount()).toBe(0);
});

test.describe('inventaire actif des écrans MJL', () => {
  test.beforeEach(async ({ page }) => login(page, 'admin.poc'));

  for (const [name, route, expectedHeading, expectedDocumentTitle] of applicationScreens) {
    test(`${name} reste rendu dans le shell MJL et isolé de l’entité 2`, async ({ page }) => {
      await expectSafeMjlScreen(page, route, expectedHeading, expectedDocumentTitle);
    });
  }

  test('admin/access.php liste la sentinelle entity 1 et exclut la sentinelle entity 2', async ({ page }) => {
    await page.goto('/custom/mjlfinancement/admin/access.php');
    await expect(page.getByText(entityOneUser, { exact: true })).toBeVisible();
    await expect(page.getByText(entityTwoUser, { exact: true })).toHaveCount(0);
  });

  test('la bibliothèque Documents reste globale et strictement en lecture seule', async ({ page }) => {
    await expectSafeMjlScreen(page, '/custom/mjlfinancement/documents.php', 'Documents', 'Documents MJL');
    await expect(page.getByText('Bibliothèque globale en lecture seule.')).toBeVisible();
    await expect(page.locator('input[type="file"], form[enctype*="multipart"]')).toHaveCount(0);
  });

  test('la roadmap interne reste masquée et inaccessible sans le feature flag', async ({ page }) => {
    await expect(page.getByLabel('Menu module MJL').getByRole('link', { name: 'Préparation production' })).toHaveCount(0);
    const response = await page.goto('/custom/mjlfinancement/roadmap.php');
    expect([403, 404]).toContain(response.status());
  });

  test('le téléchargement sans objet résolu échoue sans exposer de diagnostic', async ({ page }) => {
    const response = await page.goto('/custom/mjlfinancement/documentdownload.php?type=activity&id=0');
    expect([400, 403, 404]).toContain(response.status());
    await expect(page.locator('body')).not.toContainText(diagnosticPattern);
  });
});

test('les sept routes opérationnelles prouvent présence assignée et exclusions hors périmètre/entity 2', async ({ page }) => {
  await login(page, actorLogin);
  for (const descriptor of scopedRouteDescriptors) {
    const response = await page.goto(descriptor.route);
    expect(response.status(), descriptor.route).toBe(200);
    await expect(page.locator('body'), `${descriptor.route}: positive control`).toContainText(descriptor.positive);
    await expect(page.locator('body'), `${descriptor.route}: same-entity outside scope`).not.toContainText(descriptor.outside);
    await expect(page.locator('body'), `${descriptor.route}: entity 2`).not.toContainText(descriptor.entityTwo);
    await expect(page.locator('body'), descriptor.route).not.toContainText(diagnosticPattern);
  }

  await page.goto('/custom/mjlfinancement/index.php');
  const actorId = scalar(`SELECT rowid FROM llx_user WHERE login = '${actorLogin}' AND entity = 1`);
  const assignedPartnerId = scalar("SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = 'INV-A1-PARTNER'");
  const expectedDrafts = scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_activity a JOIN llx_mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE a.entity = 1 AND a.fk_user_creat = ${actorId} AND a.status IN (0, 3, 5) AND c.fk_soc = ${assignedPartnerId}`);
  const expectedSubmittedExpenses = scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_expense e JOIN llx_mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE e.entity = 1 AND e.fk_user_creat = ${actorId} AND e.status IN (1, 4) AND c.fk_soc = ${assignedPartnerId}`);
  await expect(dashboardCard(page, 'Activités a finaliser').locator('.mjl-card-value')).toHaveText(expectedDrafts);
  await expect(dashboardCard(page, 'Dépenses soumises').locator('.mjl-card-value')).toHaveText(expectedSubmittedExpenses);
  await expect(page.locator('body')).not.toContainText(/INV-(?:X1|E2)-/);
});

test('un utilisateur authentifié sans rôle MJL est refusé par URL directe', async ({ page }) => {
  await login(page, noRoleLogin);
  for (const route of ['/custom/mjlfinancement/index.php', '/custom/mjlfinancement/projects.php', '/custom/mjlfinancement/reports.php']) {
    await expectDenied(page, route);
  }
});

test('les routes publiques auxiliaires et scripts opérationnels échouent de manière sûre', async ({ page }) => {
  await page.goto('/user/logout.php').catch(() => {});
  const invitation = await page.goto('/custom/mjlfinancement/invitation.php');
  expect(invitation.status()).toBe(200);
  await expect(page.locator('body')).not.toContainText(diagnosticPattern);

  const registration = await page.goto('/custom/mjlfinancement/register.php');
  expect([403, 404]).toContain(registration.status());

  for (const script of ['audit_schema_current.php', 'bootstrap_poc.php', 'check_production_readiness.php', 'verify_scope_integrity.php']) {
    const response = await page.goto(`/custom/mjlfinancement/scripts/${script}`);
    expect(response.status(), script).toBe(403);
    await expect(page.locator('body')).not.toContainText(/module_version|access_role_table|production_secrets/i);
  }
});
