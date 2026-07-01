const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
let expectedOwnSubmittedExpenses = 0;
let expectedOwnMissingDocuments = 0;
let expectedGlobalSubmittedExpenses = 0;

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

async function expectCardValue(page, label, value) {
  const card = page.locator('.mjl-dashboard-card').filter({ hasText: label });
  await expect(card.locator('.mjl-card-value')).toHaveText(String(value));
}

function resetExpenseScopeFixtures() {
  sql(`
    SET @mjl_scope_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase6.otheragent');
    DELETE FROM llx_mjlfinancement_expense WHERE ref IN ('EXP-P6-OWN-SUB', 'EXP-P6-OWN-UNAVAILABLE', 'EXP-P6-OTHER-SUB');
    DELETE FROM llx_usergroup_user WHERE fk_user = @mjl_scope_user;
    DELETE FROM llx_user WHERE rowid = @mjl_scope_user;
  `);
}

function seedExpenseScopeFixtures() {
  sql(`
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase6.otheragent', 'Phase6', 'Autre', 'mjl.phase6.otheragent@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @other_agent = LAST_INSERT_ID();
    SET @agent_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL POC - Agent' AND entity = 1 LIMIT 1);
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @other_agent, @agent_group);
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-JE-002' AND entity = 1 LIMIT 1);
    SET @budget_line = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-JE-002' AND entity = 1 LIMIT 1);
    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'EXP-P6-OWN-SUB', @project, @convention, @activity, @budget_line, 1000, '2026-06-24', 'Phase 6 scoped own submitted missing document', NULL, NOW(), NOW(), @agent, 'P6SCOPEOWN', 1),
      (1, 'EXP-P6-OWN-UNAVAILABLE', @project, @convention, @activity, @budget_line, 1500, '2026-06-24', 'Phase 6 scoped own unavailable document', 'EXP-P6-OWN-UNAVAILABLE.pdf', NOW(), NOW(), @agent, 'P6SCOPEUNAVAIL', 1),
      (1, 'EXP-P6-OTHER-SUB', @project, @convention, @activity, @budget_line, 2000, '2026-06-24', 'Phase 6 scoped other submitted missing document', NULL, NOW(), NOW(), @other_agent, 'P6SCOPEOTH', 1);
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  resetExpenseScopeFixtures();
  seedExpenseScopeFixtures();
  expectedOwnSubmittedExpenses = Number(scalar(`
    SELECT COUNT(*) FROM llx_mjlfinancement_expense e
    INNER JOIN llx_user u ON u.rowid = e.fk_user_creat
    WHERE e.entity = 1 AND u.login = 'agent.mjl' AND e.status = 1
  `));
  expectedOwnMissingDocuments = Number(scalar(`
    SELECT COUNT(*) FROM llx_mjlfinancement_expense e
    INNER JOIN llx_user u ON u.rowid = e.fk_user_creat
    WHERE e.entity = 1
      AND u.login = 'agent.mjl'
      AND e.status IN (0, 1, 3)
      AND NOT EXISTS (
        SELECT 1 FROM llx_ecm_files mjl_doc
        WHERE mjl_doc.entity = e.entity
          AND mjl_doc.src_object_type = 'mjlfinancement_expense'
          AND mjl_doc.src_object_id = e.rowid
      )
  `));
  expectedGlobalSubmittedExpenses = Number(scalar(`
    SELECT COUNT(*) FROM llx_mjlfinancement_expense e
    WHERE e.entity = 1 AND e.status = 1
  `));
});

test.afterAll(() => {
  resetExpenseScopeFixtures();
});

test('Level 1 dashboard focuses on operational next actions', async ({ page }) => {
  await login(page, 'agent.mjl');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);

  await expect(page.getByRole('heading', { name: 'Mes actions attendues' })).toBeVisible();
  await expect(page.getByText('Activites a finaliser')).toBeVisible();
  await expect(page.getByText('Depenses soumises')).toBeVisible();
  await expect(page.getByText('Pieces manquantes')).toBeVisible();
  await expectCardValue(page, 'Depenses soumises', expectedOwnSubmittedExpenses);
  await expectCardValue(page, 'Pieces manquantes', expectedOwnMissingDocuments);
  await expect(page.locator('body')).not.toContainText('Supervision DPAF');
  await expect(page.locator('body')).not.toContainText('Administration');

  await page.goto('/custom/mjlfinancement/expenses.php');
  await expect(page.locator('body')).toContainText('EXP-P6-OWN-SUB');
  await expect(page.locator('body')).not.toContainText('EXP-P6-OTHER-SUB');

  await expectAccessDenied(page, '/custom/mjlfinancement/dpafdashboard.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/reports.php');
});

test('Level 2 dashboard focuses on validation workload and delay risk', async ({ page }) => {
  await login(page, 'superviseur.n1');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);

  await expect(page.getByRole('heading', { name: 'File de validation' })).toBeVisible();
  await expect(page.getByText('Activites en revue')).toBeVisible();
  await expect(page.getByText('Depenses en revue')).toBeVisible();
  await expect(page.getByText('Risques echeance')).toBeVisible();
  await expectCardValue(page, 'Depenses en revue', expectedGlobalSubmittedExpenses);
  await expect(page.locator('body')).not.toContainText('Supervision DPAF');
  await expect(page.locator('body')).not.toContainText('Administration');

  await expectAccessDenied(page, '/custom/mjlfinancement/dpafdashboard.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/reports.php');
});

test('DPAF dashboard exposes supervision sections and actionable risk context', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);

  await expect(page.getByRole('heading', { name: 'Supervision DPAF' })).toBeVisible();
  await expect(page.getByText('Revues en attente')).toBeVisible();
  await expect(page.getByText('Risques echeance')).toBeVisible();
  await expect(page.getByText('Rapports disponibles')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Administration');

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByRole('heading', { name: 'Tableau de bord DPAF' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthese de supervision' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Risques echeance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revues en attente' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Budgets et dépenses' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dernières réceptions de fonds' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dernières actions auditées' })).toBeVisible();
  await expectCardValue(page, 'Depenses soumises', expectedGlobalSubmittedExpenses);
  await expect(page.locator('body')).toContainText(/Echeance proche|En retard|Aucun risque echeance/);
  await expect(page.getByText('Action attendue: examiner l activite').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/reports.php');
  await expect(page.getByRole('heading', { name: "Centre d'exports MJL" })).toBeVisible();
});

test('Admin dashboard is administration-first with supervision shortcuts', async ({ page }) => {
  await login(page, 'admin.poc');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);

  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await expect(page.getByText('Invitations en attente')).toBeVisible();
  await expect(page.getByText('Rapports disponibles')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Mes actions attendues');
  await expect(page.locator('body')).not.toContainText('File de validation');

  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.getByText('Gestion des acces MJL').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByRole('heading', { name: 'Tableau de bord DPAF' })).toBeVisible();
  await expectCardValue(page, 'Depenses soumises', expectedGlobalSubmittedExpenses);
});

test('Read-only user keeps consultation-only workspace', async ({ page }) => {
  await login(page, 'lecteur.audit');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);

  await expect(page.getByRole('heading', { name: 'Acces rapides' })).toBeVisible();
  await expect(page.getByText('Consultation avancée de l’audit')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Mes actions attendues');
  await expect(page.locator('body')).not.toContainText('File de validation');
  await expect(page.locator('body')).not.toContainText('Supervision DPAF');
  await expect(page.locator('body')).not.toContainText('Administration');

  await expectAccessDenied(page, '/custom/mjlfinancement/dpafdashboard.php');
  await expectAccessDenied(page, '/custom/mjlfinancement/reports.php');
});

test('Phase 6 dashboards keep forbidden public registration labels out', async ({ page }) => {
  await login(page, 'agent.mjl');
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);
});
