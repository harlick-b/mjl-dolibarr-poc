const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test.describe.configure({ mode: 'serial' });

function dockerExec(command) {
  execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
}

function sql(query) {
  dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`);
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
  await expect(page.locator('body')).toContainText(/Acces refuse|Accès refusé|Access denied|Forbidden|Non autorise|Non autorisé/);
}

function cleanupNarrowUsers() {
  sql(`
    SET @mjl_narrow_users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'mjl.phase5.%');
    SET @mjl_narrow_groups = (SELECT GROUP_CONCAT(rowid) FROM llx_usergroup WHERE nom LIKE 'MJL Phase 5 - %');
    DELETE FROM llx_usergroup_user WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_narrow_users, '')) OR FIND_IN_SET(fk_usergroup, COALESCE(@mjl_narrow_groups, ''));
    DELETE FROM llx_usergroup_rights WHERE FIND_IN_SET(fk_usergroup, COALESCE(@mjl_narrow_groups, ''));
    DELETE FROM llx_user WHERE FIND_IN_SET(rowid, COALESCE(@mjl_narrow_users, ''));
    DELETE FROM llx_usergroup WHERE FIND_IN_SET(rowid, COALESCE(@mjl_narrow_groups, ''));
  `);
}

function createNarrowUser(loginName, groupName, rightPerms, rightSubperms) {
  const email = `${loginName}@mjl-poc.local`;
  sql(`
    INSERT INTO llx_usergroup (entity, nom, note) VALUES (1, '${groupName}', 'Phase 5 narrow-right E2E');
    SET @group_id = LAST_INSERT_ID();
    SET @right_id = (SELECT id FROM llx_rights_def WHERE module = 'mjlfinancement' AND perms = '${rightPerms}' AND subperms = '${rightSubperms}' AND entity IN (0, 1) ORDER BY entity DESC LIMIT 1);
    INSERT INTO llx_usergroup_rights (entity, fk_usergroup, fk_id) VALUES (1, @group_id, @right_id);
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec) SELECT 1, '${loginName}', 'Phase5', 'E2E', '${email}', pass_crypted, 1, 0, NOW() FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @user_id = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @user_id, @group_id);
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupNarrowUsers();
  createNarrowUser('mjl.phase5.workflowonly', 'MJL Phase 5 - Workflow Read', 'workflowaction', 'read');
  createNarrowUser('mjl.phase5.activityonly', 'MJL Phase 5 - Activity Read', 'activity', 'read');
});

test.afterAll(() => {
  cleanupNarrowUsers();
});

test('Level 1 user sees operational workspace and cannot access supervision pages', async ({ page }) => {
  await login(page, 'agent.mjl');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expect(page.getByRole('heading', { name: 'Mes actions attendues' })).toBeVisible();
  await expect(page.getByText('Activites a finaliser')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Supervision DPAF');
  await expect(page.locator('body')).not.toContainText('Administration');
  await expect(page.locator('body')).not.toContainText('Rapports disponibles');

  await expectAccessDenied(page, '/custom/mjlfinancement/dpafdashboard.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/reports.php');
});

test('Level 2 reviewer sees validation workspace and cannot access supervision pages', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expect(page.getByRole('heading', { name: 'File de validation' })).toBeVisible();
  await expect(page.getByText('Activites en revue').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Supervision DPAF');
  await expect(page.locator('body')).not.toContainText('Administration');

  await expectAccessDenied(page, '/custom/mjlfinancement/dpafdashboard.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/reports.php');
});

test('DPAF user sees supervision workspace and can access DPAF reports', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expect(page.getByRole('heading', { name: 'Supervision DPAF' })).toBeVisible();
  await expect(page.getByText('Rapports disponibles')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Administration');

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByText('Tableau de bord DPAF').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();
});

test('Admin sees administration access and can access invitations plus supervision pages', async ({ page }) => {
  await login(page, 'admin.poc');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(page.getByText('Invitations en attente')).toBeVisible();

  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.getByText('Gestion des acces MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByText('Tableau de bord DPAF').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();
});

test('Read-only audit user gets consultation workspace only', async ({ page }) => {
  await login(page, 'lecteur.audit');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expect(page.getByRole('heading', { name: 'Acces rapides' })).toBeVisible();
  await expect(page.getByText('Consultation avancee de l audit')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Mes actions attendues');
  await expect(page.locator('body')).not.toContainText('File de validation');
  await expect(page.locator('body')).not.toContainText('Supervision DPAF');
  await expect(page.locator('body')).not.toContainText('Administration');

  await expectAccessDenied(page, '/custom/mjlfinancement/dpafdashboard.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/reports.php');
});

test('Narrow workflow-action reader only sees matching audit quick link', async ({ page }) => {
  await login(page, 'mjl.phase5.workflowonly');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expect(page.getByText('Consultation avancee de l audit')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Suivi des activites et decisions');
  await expect(page.locator('body')).not.toContainText('Depenses et pieces justificatives');
  await expect(page.locator('body')).not.toContainText('Trace des decisions sur depenses');
});

test('Narrow activity reader only sees activity quick link', async ({ page }) => {
  await login(page, 'mjl.phase5.activityonly');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expect(page.getByText('Suivi des activites et decisions')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Depenses et pieces justificatives');
  await expect(page.locator('body')).not.toContainText('Trace des decisions sur depenses');
  await expect(page.locator('body')).not.toContainText('Consultation avancee de l audit');
});

test('Workspace keeps forbidden public registration labels out of the UI', async ({ page }) => {
  await login(page, 'agent.mjl');
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});
