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

async function expectSidebar(page) {
  await expect(page.getByLabel('Menu module MJL')).toBeVisible();
  await expect(page.getByRole('link', { name: /Tableau de bord/ })).toBeVisible();
}

async function expectAccessDeniedForAll(page, paths) {
  for (const path of paths) {
    await expectAccessDenied(page, path);
  }
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

function createNarrowUser(loginName, groupName, rights) {
  const email = `${loginName}@mjl-poc.local`;
  const rightStatements = rights.map(([rightPerms, rightSubperms]) => `
    SET @right_id = (SELECT id FROM llx_rights_def WHERE module = 'mjlfinancement' AND perms = '${rightPerms}' AND subperms = '${rightSubperms}' AND entity IN (0, 1) ORDER BY entity DESC LIMIT 1);
    INSERT INTO llx_usergroup_rights (entity, fk_usergroup, fk_id) SELECT 1, @group_id, @right_id WHERE @right_id IS NOT NULL;
  `).join('\n');
  sql(`
    INSERT INTO llx_usergroup (entity, nom, note) VALUES (1, '${groupName}', 'Phase 5 narrow-right E2E');
    SET @group_id = LAST_INSERT_ID();
    ${rightStatements}
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec) SELECT 1, '${loginName}', 'Phase5', 'E2E', '${email}', pass_crypted, 1, 0, NOW() FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @user_id = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @user_id, @group_id);
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupNarrowUsers();
  createNarrowUser('mjl.phase5.workflowonly', 'MJL Phase 5 - Workflow Read', [['workflowaction', 'read']]);
  createNarrowUser('mjl.phase5.activityonly', 'MJL Phase 5 - Activity Read', [['activity', 'read']]);
  createNarrowUser('mjl.phase5.reviewernovalidation', 'MJL Phase 5 - Reviewer No Validation', [
    ['activity', 'read'],
    ['expense', 'read'],
    ['activity', 'validate'],
    ['expense', 'validate'],
  ]);
  createNarrowUser('mjl.phase5.activityreviewer', 'MJL Phase 5 - Activity Reviewer', [
    ['activity', 'read'],
    ['activity', 'validate'],
  ]);
});

test.afterAll(() => {
  cleanupNarrowUsers();
});

test('Level 1 user sees operational workspace and cannot access supervision pages', async ({ page }) => {
  await login(page, 'agent.mjl');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'Mes actions attendues' })).toBeVisible();
  await expect(page.getByText('Activites a finaliser')).toBeVisible();
  await expect(page.getByRole('link', { name: /Activités/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Dépenses/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Alertes/ }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Supervision DPAF');
  await expect(page.locator('body')).not.toContainText('Administration');
  await expect(page.locator('body')).not.toContainText('Rapports disponibles');
  await expect(page.locator('body')).not.toContainText('Preparation production');

  await expectAccessDeniedForAll(page, [
    '/custom/mjlfinancement/dpafdashboard.php',
    '/custom/mjlfinancement/reports.php',
    '/custom/mjlfinancement/roadmap.php',
    '/custom/mjlfinancement/conventions.php',
    '/custom/mjlfinancement/budgetlines.php',
    '/custom/mjlfinancement/fundreceipts.php',
    '/custom/mjlfinancement/validations.php',
    '/custom/mjlfinancement/workflowactions.php',
    '/custom/mjlfinancement/exchangelogs.php',
  ]);
});

test('Level 2 reviewer sees validation workspace and cannot access supervision pages', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'File de validation' })).toBeVisible();
  await expect(page.getByText('Activites en revue').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Validations/ }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Supervision DPAF');
  await expect(page.locator('body')).not.toContainText('Administration');
  await expect(page.locator('body')).not.toContainText('Preparation production');

  await expectAccessDeniedForAll(page, [
    '/custom/mjlfinancement/dpafdashboard.php',
    '/custom/mjlfinancement/reports.php',
    '/custom/mjlfinancement/roadmap.php',
    '/custom/mjlfinancement/conventions.php',
    '/custom/mjlfinancement/budgetlines.php',
    '/custom/mjlfinancement/fundreceipts.php',
    '/custom/mjlfinancement/workflowactions.php',
    '/custom/mjlfinancement/exchangelogs.php',
  ]);

  await page.goto('/custom/mjlfinancement/validations.php');
  await expect(page.getByText('Historique validations MJL').first()).toBeVisible();
  await expectSidebar(page);
});

test('DPAF user sees supervision workspace and can access DPAF reports', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'Supervision DPAF' })).toBeVisible();
  await expect(page.getByText('Rapports disponibles')).toBeVisible();
  await expect(page.getByRole('link', { name: /Tableau DPAF/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Exports/ }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Administration');
  await expect(page.locator('body')).not.toContainText('Preparation production');

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByText('Tableau de bord DPAF').first()).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/conventions.php');
  await expect(page.getByText('Conventions MJL').first()).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/budgetlines.php');
  await expect(page.getByText('Lignes budgetaires MJL').first()).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/fundreceipts.php');
  await expect(page.getByRole('heading', { name: 'Gestion des réceptions de fonds' })).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.getByText('Actions workflow MJL').first()).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/exchangelogs.php');
  await expect(page.getByText('Echanges MJL').first()).toBeVisible();
  await expectSidebar(page);

  await expectAccessDenied(page, '/custom/mjlfinancement/roadmap.php');
});

test('Admin sees administration access and can access invitations plus supervision pages', async ({ page }) => {
  await login(page, 'admin.poc');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(page.getByText('Invitations en attente')).toBeVisible();
  await expect(page.getByRole('link', { name: /Invitations/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Preparation production/ })).toBeVisible();

  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.getByText('Gestion des acces MJL').first()).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByText('Tableau de bord DPAF').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();

  await page.goto('/custom/mjlfinancement/conventions.php');
  await expect(page.getByText('Conventions MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/budgetlines.php');
  await expect(page.getByText('Lignes budgetaires MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/fundreceipts.php');
  await expect(page.getByRole('heading', { name: 'Gestion des réceptions de fonds' })).toBeVisible();

  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.getByText('Actions workflow MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/exchangelogs.php');
  await expect(page.getByText('Echanges MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/roadmap.php');
  await expect(page.getByRole('heading', { name: /Preparation production|Préparation production/ })).toBeVisible();
  await expect(page.getByText('Ces elements ne sont pas encore implementes.')).toBeVisible();
  await expectSidebar(page);
});

test('Read-only audit user gets consultation workspace only', async ({ page }) => {
  await login(page, 'lecteur.audit');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'Acces rapides' })).toBeVisible();
  await expect(page.getByText('Consultation avancée de l’audit')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Mes actions attendues');
  await expect(page.locator('body')).not.toContainText('File de validation');
  await expect(page.locator('body')).not.toContainText('Supervision DPAF');
  await expect(page.locator('body')).not.toContainText('Administration');
  await expect(page.locator('body')).not.toContainText('Preparation production');

  await page.goto('/custom/mjlfinancement/validations.php');
  await expect(page.getByText('Historique validations MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.getByText('Actions workflow MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/exchangelogs.php');
  await expect(page.getByText('Echanges MJL').first()).toBeVisible();

  await expectAccessDeniedForAll(page, [
    '/custom/mjlfinancement/dpafdashboard.php',
    '/custom/mjlfinancement/reports.php',
    '/custom/mjlfinancement/roadmap.php',
    '/custom/mjlfinancement/conventions.php',
    '/custom/mjlfinancement/budgetlines.php',
    '/custom/mjlfinancement/fundreceipts.php',
  ]);
});

test('Narrow workflow-action reader only sees matching audit quick link', async ({ page }) => {
  await login(page, 'mjl.phase5.workflowonly');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByText('Consultation avancée de l’audit')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Suivi des activités et décisions');
  await expect(page.locator('body')).not.toContainText('Dépenses et pièces justificatives');
  await expect(page.locator('body')).not.toContainText('Trace des décisions sur dépenses');
  await expect(page.locator('body')).not.toContainText('Preparation production');
  await expectAccessDenied(page, '/custom/mjlfinancement/roadmap.php');

  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.getByText('Actions workflow MJL').first()).toBeVisible();
  await expectAccessDenied(page, '/custom/mjlfinancement/exchangelogs.php');
});

test('Narrow activity reader only sees activity quick link', async ({ page }) => {
  await login(page, 'mjl.phase5.activityonly');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('main').getByText('Suivi des activités et décisions')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Dépenses et pièces justificatives');
  await expect(page.locator('body')).not.toContainText('Trace des décisions sur dépenses');
  await expect(page.locator('body')).not.toContainText('Consultation avancée de l’audit');
  await expect(page.locator('body')).not.toContainText('Preparation production');
  await expectAccessDeniedForAll(page, [
    '/custom/mjlfinancement/roadmap.php',
    '/custom/mjlfinancement/conventions.php',
    '/custom/mjlfinancement/budgetlines.php',
    '/custom/mjlfinancement/fundreceipts.php',
    '/custom/mjlfinancement/validations.php',
    '/custom/mjlfinancement/workflowactions.php',
    '/custom/mjlfinancement/exchangelogs.php',
  ]);
});

test('Narrow reviewer without validation history right has no validation dead link', async ({ page }) => {
  await login(page, 'mjl.phase5.reviewernovalidation');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'File de validation' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Activités/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Dépenses/ }).first()).toBeVisible();
  await expect(page.locator('a[href$="/validations.php"]')).toHaveCount(0);

  await expectAccessDenied(page, '/custom/mjlfinancement/validations.php');
});

test('Narrow activity reviewer gets no expense or validation dead links', async ({ page }) => {
  await login(page, 'mjl.phase5.activityreviewer');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'File de validation' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Activites soumises a decision')).toBeVisible();
  await expect(page.locator('a[href$="/expenses.php"]')).toHaveCount(0);
  await expect(page.locator('a[href$="/validations.php"]')).toHaveCount(0);

  await expectAccessDenied(page, '/custom/mjlfinancement/expenses.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/validations.php');
});

test('Workspace keeps forbidden public registration labels out of the UI', async ({ page }) => {
  await login(page, 'agent.mjl');
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});

test('Invitation surface does not render the authenticated module sidebar', async ({ page }) => {
  await page.goto('/custom/mjlfinancement/invitation.php');
  await expect(page.getByLabel('Menu module MJL')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});
