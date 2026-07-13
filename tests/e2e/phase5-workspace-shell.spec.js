const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const forbiddenResponsePattern = /Acces refuse|Accès refusé|Acc&egrave;s refus&eacute;|Acces non autorise|Access denied|Forbidden|Non autorise|Non autorisé|Non autoris&eacute;|pas autorise|pas autorisé|pas autoris&eacute;|not authorized|Not Found|\b404\b/i;

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

async function expectSidebar(page) {
  await expect(page.getByLabel('Menu module MJL')).toBeVisible();
  await expect(page.getByRole('link', { name: /Tableau de bord/ })).toBeVisible();
  await expect(page.getByLabel('Menu module MJL').getByRole('searchbox')).toHaveCount(0);
}

async function expectAccessDeniedForAll(page, paths) {
  for (const path of paths) {
    await expectAccessDenied(page, path);
  }
}

async function expectNativeWorkspaceBlocked(page, path) {
  const response = await page.goto(path);
  expect(response.status(), path).toBe(403);
  await expect(page.locator('body')).toContainText(/Acces non autorise|Retour au tableau de bord/);
  await expect(page.getByLabel('Menu module MJL')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Accueil|Rechercher|Mon tableau de bord|Configuration|Outils d'administration|Utilisateurs & Groupes|Espace RH|Module Builder|Espace facturation et paiement|Module Category not enabled|Not enough permissions|Accès refusé/);
}

async function expectNativeMenuLabelsHidden(page) {
  const labels = [
    'Tiers',
    'Projets',
    'Documents',
    'GRH',
    'Outils',
    'ModuleBuilder',
    'API',
    'Facturation',
    'Paiement',
    'Banques',
    'Comptabilité',
    'Comptabilite',
  ];
  for (const label of labels) {
    await expect(page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') })).toHaveCount(0);
  }
  await expect(page.locator('body')).not.toContainText(/Rechercher|Mon tableau de bord|Configuration|Outils d'administration|Utilisateurs & Groupes|Espace RH|Module Builder/);
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
  await expect(page.getByRole('link', { name: /Documents/ }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Supervision finance');
  await expect(page.locator('body')).not.toContainText('Administration');
  await expect(page.locator('body')).not.toContainText('Rapports disponibles');
  await expect(page.locator('body')).not.toContainText(/Preparation production|Préparation production/);
  await expect(page.locator('body')).not.toContainText('Échanges');

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

  await page.goto('/custom/mjlfinancement/projects.php');
  await expect(page.getByRole('heading', { name: 'Projets' })).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/documents.php');
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Lecture seule');
  await expect(page.getByRole('button', { name: /upload|televerser|téléverser/i })).toHaveCount(0);
});

test('Level 2 reviewer sees validation workspace and cannot access supervision pages', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'File de validation' })).toBeVisible();
  await expect(page.getByText('Activites en revue').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Supervision/ }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Supervision finance');
  await expect(page.locator('body')).not.toContainText('Administration');
  await expect(page.locator('body')).not.toContainText(/Preparation production|Préparation production/);
  await expect(page.locator('body')).not.toContainText('Échanges');

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
  await expect(page.getByText('Historique des validations').first()).toBeVisible();
  await expectSidebar(page);
  await expect(page.getByRole('link', { name: /Historique des validations/ })).toBeVisible();
});

test('Finance validator sees supervision workspace and can access finance reports', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'Supervision finance' })).toBeVisible();
  await expect(page.getByText('Rapports disponibles')).toBeVisible();
  await expect(page.getByRole('link', { name: /Supervision/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Financement/ }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Administration');
  await expect(page.locator('body')).not.toContainText(/Preparation production|Préparation production/);
  await expect(page.locator('body')).not.toContainText('Échanges');

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByText('Tableau de supervision finance').first()).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();
  await expectSidebar(page);

  await page.goto('/custom/mjlfinancement/conventions.php');
  await expect(page.getByText('Enveloppes de financement').first()).toBeVisible();
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
  await expect(page.getByText('Historique / Audit - recherche des echanges').first()).toBeVisible();
  await expectSidebar(page);
  await expect(page.getByLabel('Menu module MJL')).not.toContainText('Échanges');

  await expectAccessDenied(page, '/custom/mjlfinancement/roadmap.php');
});

test('Admin sees administration access and can access invitations plus supervision pages', async ({ page }) => {
  await login(page, 'admin.poc');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await expectSidebar(page);
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(page.getByText('Invitations en attente')).toBeVisible();
  await expect(page.getByLabel('Menu module MJL').getByRole('link', { name: /Administration/ })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Preparation production|Préparation production/);

  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.getByText('Gestion des acces MJL').first()).toBeVisible();
  await expectSidebar(page);
  await expect(page.getByRole('link', { name: /Acces utilisateurs/ }).first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByText('Tableau de supervision finance').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();

  await page.goto('/custom/mjlfinancement/conventions.php');
  await expect(page.getByText('Enveloppes de financement').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/budgetlines.php');
  await expect(page.getByText('Lignes budgetaires MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/fundreceipts.php');
  await expect(page.getByRole('heading', { name: 'Gestion des réceptions de fonds' })).toBeVisible();

  await page.goto('/custom/mjlfinancement/workflowactions.php');
  await expect(page.getByText('Actions workflow MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/exchangelogs.php');
  await expect(page.getByText('Historique / Audit - recherche des echanges').first()).toBeVisible();
  await expect(page.getByLabel('Menu module MJL')).not.toContainText('Échanges');

  await expectAccessDenied(page, '/custom/mjlfinancement/roadmap.php');
  sql("UPDATE llx_const SET value = '1' WHERE name = 'MJL_SHOW_INTERNAL_ROADMAP' AND entity = 1");
  await page.goto('/custom/mjlfinancement/roadmap.php');
  await expect(page.getByRole('heading', { name: /Preparation production|Préparation production/ })).toBeVisible();
  await expect(page.getByText('Ces elements ne sont pas encore implementes.')).toBeVisible();
  await expectSidebar(page);
  sql("UPDATE llx_const SET value = '0' WHERE name = 'MJL_SHOW_INTERNAL_ROADMAP' AND entity = 1");
});

test('Unresolved legacy reader fails closed', async ({ page }) => {
  await login(page, 'lecteur.audit');
  await expectAccessDeniedForAll(page, [
    '/custom/mjlfinancement/index.php',
    '/custom/mjlfinancement/activities.php',
    '/custom/mjlfinancement/expenses.php',
    '/custom/mjlfinancement/projects.php',
    '/custom/mjlfinancement/documents.php',
    '/custom/mjlfinancement/validations.php',
    '/custom/mjlfinancement/workflowactions.php',
    '/custom/mjlfinancement/exchangelogs.php',
    '/custom/mjlfinancement/dpafdashboard.php',
    '/custom/mjlfinancement/reports.php',
    '/custom/mjlfinancement/roadmap.php',
    '/custom/mjlfinancement/conventions.php',
    '/custom/mjlfinancement/budgetlines.php',
    '/custom/mjlfinancement/fundreceipts.php',
  ]);
});

test('Business roles do not see native Dolibarr workspaces as normal navigation', async ({ page }) => {
  for (const loginName of ['agent.mjl', 'superviseur.n1', 'superviseur.n2', 'dpaf.mjl']) {
    await login(page, loginName);
    await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
    await expectNativeMenuLabelsHidden(page);
  }
});

test('MJL users receive a branded 403 for direct native workspace URLs', async ({ page }) => {
  test.setTimeout(180000);

  const nativePaths = [
    '/projet/index.php',
    '/societe/index.php',
    '/ecm/index.php',
    '/comm/index.php',
    '/commande/list.php',
    '/fourn/index.php',
    '/expensereport/list.php',
    '/hrm/index.php',
    '/holiday/list.php',
    '/core/tools.php',
    '/admin/modules.php',
    '/admin/tools/index.php',
    '/admin/system/index.php',
    '/admin/dict.php',
    '/modulebuilder/index.php',
    '/api/index.php',
    '/compta/facture/list.php',
    '/tax/index.php',
    '/compta/paiement/list.php',
    '/banque/list.php',
    '/accountancy/index.php',
    '/admin/index.php',
    '/admin/company.php',
    '/user/list.php',
    '/user/card.php',
    '/user/group/list.php',
    '/categories/index.php',
    '/product/index.php',
    '/imports/index.php',
    '/ticket/index.php',
    '/don/index.php',
    '/contrat/index.php',
    '/fichinter/index.php',
    '/website/index.php',
  ];

  for (const loginName of ['agent.mjl', 'superviseur.n1', 'superviseur.n2', 'dpaf.mjl', 'admin.poc']) {
    await login(page, loginName);
    for (const nativePath of nativePaths) {
      await expectNativeWorkspaceBlocked(page, nativePath);
    }
  }
});

test('Required authentication helper routes stay reachable outside the native route block', async ({ page }) => {
  await page.goto('/user/logout.php').catch(() => {});

  await page.goto('/index.php');
  await expect(page.getByLabel('Identifiant')).toBeVisible();
  await expect(page.getByLabel('Mot de passe')).toBeVisible();

  await page.goto('/user/passwordforgotten.php');
  await expect(page.locator('body')).toContainText(/Mot de passe|Identifiant|Adresse/);
  await expect(page.locator('body')).not.toContainText(/Acces non autorise|Retour au tableau de bord/);
});

test('Native module state keeps only required Dolibarr support modules enabled', async () => {
  const disabledConstants = [
    'MAIN_MODULE_ACCOUNTING',
    'MAIN_MODULE_COMPTABILITE',
    'MAIN_MODULE_FACTURE',
    'MAIN_MODULE_BANQUE',
    'MAIN_MODULE_TAX',
    'MAIN_MODULE_EXPENSEREPORT',
    'MAIN_MODULE_HOLIDAY',
    'MAIN_MODULE_HRM',
    'MAIN_MODULE_MODULEBUILDER',
    'MAIN_MODULE_API',
  ];
  const requiredConstants = [
    'MAIN_MODULE_SOCIETE',
    'MAIN_MODULE_PROJET',
    'MAIN_MODULE_ECM',
    'MAIN_MODULE_EXPORT',
    'MAIN_MODULE_MJLFINANCEMENT',
  ];

  expect(scalar(`SELECT COUNT(*) FROM llx_const WHERE entity = 1 AND name IN (${disabledConstants.map((name) => `'${name}'`).join(',')}) AND value = '1'`)).toBe('0');
  expect(scalar(`SELECT COUNT(DISTINCT name) FROM llx_const WHERE entity = 1 AND name IN (${requiredConstants.map((name) => `'${name}'`).join(',')}) AND value = '1'`)).toBe(String(requiredConstants.length));
});

test('Narrow workflow-action reader without production role fails closed', async ({ page }) => {
  await login(page, 'mjl.phase5.workflowonly');
  await expectAccessDenied(page, '/custom/mjlfinancement/index.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/roadmap.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/exchangelogs.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/workflowactions.php');
});

test('Narrow activity reader without production role fails closed', async ({ page }) => {
  await login(page, 'mjl.phase5.activityonly');
  await expectAccessDeniedForAll(page, [
    '/custom/mjlfinancement/index.php',
    '/custom/mjlfinancement/activities.php',
    '/custom/mjlfinancement/roadmap.php',
    '/custom/mjlfinancement/conventions.php',
    '/custom/mjlfinancement/budgetlines.php',
    '/custom/mjlfinancement/fundreceipts.php',
    '/custom/mjlfinancement/validations.php',
    '/custom/mjlfinancement/workflowactions.php',
    '/custom/mjlfinancement/exchangelogs.php',
  ]);
});

test('Narrow reviewer without production role fails closed', async ({ page }) => {
  await login(page, 'mjl.phase5.reviewernovalidation');
  await expectAccessDenied(page, '/custom/mjlfinancement/index.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/activities.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/expenses.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/validations.php');
});

test('Narrow activity reviewer without production role fails closed', async ({ page }) => {
  await login(page, 'mjl.phase5.activityreviewer');
  await expectAccessDenied(page, '/custom/mjlfinancement/index.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/activities.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/expenses.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/validations.php');
});

test('Workspace keeps forbidden public registration labels out of the UI', async ({ page }) => {
  await login(page, 'admin.poc');
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});

test('Project detail exposes timeline notes and Reader cannot add notes', async ({ page }) => {
	const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");

  await login(page, 'admin.poc');
  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}`);
  await expect(page.getByRole('heading', { name: /Projet PRJ-JE-2026/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notes / Commentaires' })).toBeVisible();
  await page.getByLabel('Commentaire').fill('Commentaire projet phase 5');
  await page.getByRole('button', { name: 'Ajouter le commentaire' }).click();
  await expect(page.locator('body')).toContainText('Commentaire projet phase 5');

  await login(page, 'lecteur.audit');
  await expectAccessDenied(page, `/custom/mjlfinancement/projects.php?id=${projectId}`);
});

test('Every visible sidebar link opens for the role that sees it', async ({ page }) => {
  for (const loginName of ['agent.mjl', 'superviseur.n1', 'dpaf.mjl', 'admin.poc']) {
    await login(page, loginName);
    const hrefs = await page.getByLabel('Menu module MJL').locator('a').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')).filter(Boolean))]);
    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.locator('body')).not.toContainText(forbiddenResponsePattern);
    }
  }
});

test('Invitation surface does not render the authenticated module sidebar', async ({ page }) => {
  await page.goto('/custom/mjlfinancement/invitation.php');
  await expect(page.getByLabel('Menu module MJL')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});
