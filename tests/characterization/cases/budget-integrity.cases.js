const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const forbiddenResponsePattern = /Acces refuse|Accès refusé|Acc&egrave;s refus&eacute;|Access denied|Forbidden|Non autorise|Non autorisé|Non autoris&eacute;/;

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

async function expectAccessDenied(page) {
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

function cleanupBudgetIntegrityFixtures() {
  sql(`
    SET @budget_integrity_budget_lines = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'BGT-%');
    DELETE FROM llx_ecm_files WHERE src_object_type = 'mjlfinancement_expense' AND src_object_id IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'BGT-%');
    DELETE FROM llx_mjlfinancement_validation WHERE fk_expense IN (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref LIKE 'BGT-%');
    DELETE FROM llx_mjlfinancement_expense WHERE ref LIKE 'BGT-%';
    DELETE FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_budget_line' AND FIND_IN_SET(object_id, COALESCE(@budget_integrity_budget_lines, ''));
    DELETE FROM llx_mjlfinancement_budget_line WHERE ref LIKE 'BGT-%';
    UPDATE llx_mjlfinancement_budget_line SET label = 'Formation', initial_budget = 1800000, revised_budget = 1800000, category = 'formation', fk_user_modif = NULL WHERE ref = 'BL-JE-001' AND entity = 1;
    UPDATE llx_mjlfinancement_budget_line bl SET spent_amount = (SELECT COALESCE(SUM(e.amount), 0) FROM llx_mjlfinancement_expense e WHERE e.fk_budget_line = bl.rowid AND e.entity = bl.entity AND e.status = 2), remaining_amount = COALESCE(bl.revised_budget, 0) - (SELECT COALESCE(SUM(e.amount), 0) FROM llx_mjlfinancement_expense e WHERE e.fk_budget_line = bl.rowid AND e.entity = bl.entity AND e.status = 2) WHERE bl.ref = 'BL-JE-001' AND bl.entity = 1;
  `);
}

function seedBudgetIntegrityFixtures() {
  sql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-JE-002' AND entity = 1 LIMIT 1);

    INSERT INTO llx_mjlfinancement_budget_line (entity, ref, label, fk_project, fk_convention, fk_mjl_activity, initial_budget, revised_budget, committed_amount, spent_amount, remaining_amount, category, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'BGT-INACTIVE-BL', 'Ligne inactive Budget integrity', @project, @convention, @activity, 500000, 500000, 0, 0, 500000, 'test', NOW(), @admin, 'BGTINACTIVE', 0),
      (1, 'BGT-ACTIVE-BL', 'Ligne active Budget integrity', @project, @convention, @activity, 700000, 700000, 0, 0, 700000, 'test', NOW(), @admin, 'BGTACTIVE', 1);
    SET @inactive_bl = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BGT-INACTIVE-BL' AND entity = 1);

    INSERT INTO llx_mjlfinancement_expense (entity, ref, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, expense_date, description, supporting_document, submitted_at, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'BGT-INACTIVE-DRAFT', @project, @convention, @activity, @inactive_bl, 1000, '2026-07-01', 'Depense brouillon ligne inactive', NULL, NULL, NOW(), @agent, 'BGTDRAFT', 0),
      (1, 'BGT-INACTIVE-SUBMITTED', @project, @convention, @activity, @inactive_bl, 1100, '2026-07-01', 'Depense soumise ligne inactive', 'BGT-INACTIVE-SUBMITTED.pdf', NOW(), NOW(), @agent, 'BGTSUBMIT', 1);
    SET @submitted = (SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'BGT-INACTIVE-SUBMITTED' AND entity = 1);
    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES ('BGT-INACTIVE-SUBMITTED-ECM', 'BGT-INACTIVE-SUBMITTED.pdf', 1, 'BGT-INACTIVE-SUBMITTED.pdf', 'mjlfinancement_expense', 'BGT-INACTIVE-SUBMITTED.pdf', 'Piece Budget integrity inactive', 1, NOW(), @admin, 'mjlfinancement_expense', @submitted);
  `);
}

function seedBudgetIntegrityFiles() {
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_expense && printf "%s" "Budget integrity inactive submitted document" > /var/www/documents/ecm/mjlfinancement_expense/BGT-INACTIVE-SUBMITTED.pdf\'');
}

test.beforeAll(() => {
  cleanupBudgetIntegrityFixtures();
  seedBudgetIntegrityFixtures();
  seedBudgetIntegrityFiles();
});

test.afterAll(() => {
  cleanupBudgetIntegrityFixtures();
});

test('Current final-validator fixture receives budget-line write without routine operation rights', async () => {
  expect(Number(scalar(`
    SELECT COUNT(*) FROM llx_user u
    INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity = 1
    INNER JOIN llx_usergroup_rights ugr ON ugr.fk_usergroup = ugu.fk_usergroup AND ugr.entity = 1
    INNER JOIN llx_rights_def rd ON rd.id = ugr.fk_id
    WHERE u.login = 'dpaf.mjl' AND rd.module = 'mjlfinancement' AND rd.perms = 'budgetline' AND rd.subperms = 'write'
  `))).toBe(1);
  expect(Number(scalar(`
    SELECT COUNT(*) FROM llx_user u
    INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity = 1
    INNER JOIN llx_usergroup_rights ugr ON ugr.fk_usergroup = ugu.fk_usergroup AND ugr.entity = 1
    INNER JOIN llx_rights_def rd ON rd.id = ugr.fk_id
    WHERE u.login = 'dpaf.mjl' AND rd.module = 'mjlfinancement' AND ((rd.perms = 'activity' AND rd.subperms IN ('write', 'validate')) OR (rd.perms = 'expense' AND rd.subperms = 'write'))
  `))).toBe(0);
});

test('Current final-validator fixture creates, edits, activates, filters, and views budget-line history', async ({ page }) => {
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const conventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1");
  const activityId = scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-JE-002' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/budgetlines.php');
  await expect(page.getByRole('heading', { name: 'Gestion des lignes budgétaires' })).toBeVisible();
  await expect(page.locator('form input[name="action"][value="create"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Créer une ligne budgétaire' }).click();
  await expect(page.locator('form[data-mjl-form="budgetline-create"]')).toHaveAttribute('data-mjl-substantive', '');

  await page.getByLabel('Référence').fill('BGT-UI-BL');
  await page.getByLabel('Libellé').fill('Budget Budget integrity UI');
  await page.locator('select[name="fk_project"]').selectOption(projectId);
  await page.locator('select[name="fk_convention"]').selectOption(conventionId);
  await page.locator('select[name="fk_mjl_activity"]').selectOption(activityId);
  await page.getByLabel('Budget initial').fill('600000');
  await page.getByLabel('Budget révisé').fill('650000');
  await page.getByLabel('Catégorie').fill('budget_integrity');
  await page.getByRole('button', { name: 'Créer la ligne' }).click();

  await expect(page).toHaveURL(/budgetlines\.php\?id=\d+/);
  await expect(page.getByRole('heading', { name: /BGT-UI-BL/ })).toBeVisible();
  await expect(page.getByText('Brouillon').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historique de la ligne budgétaire' })).toBeVisible();

  await expect(page.locator('form input[name="action"][value="update"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Modifier la ligne' }).click();
  await expect(page.locator('form[data-mjl-form="budgetline-edit"]')).toHaveAttribute('data-mjl-substantive', '');
  await page.getByLabel('Libellé').fill('Budget Budget integrity modifie');
  await page.getByLabel('Motif de modification').fill('Correction libelle Budget integrity');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: /Budget Budget integrity modifie/ })).toBeVisible();
  await expect(page.getByText('Correction libelle Budget integrity')).toBeVisible();

  await page.getByRole('link', { name: 'Activer la ligne' }).click();
  await expect(page.locator('form[data-mjl-form="budgetline-activate"]')).toHaveAttribute('data-mjl-substantive', '');
  await page.getByRole('button', { name: 'Activer la ligne' }).click();
  await expect(page.getByText('Active').first()).toBeVisible();
  await expect(page.getByText('Activation', { exact: true })).toBeVisible();

  await page.goto(`/custom/mjlfinancement/budgetlines.php?project_id=${projectId}&convention_id=${conventionId}&activity_id=${activityId}&status=1`);
  const row = page.locator('tr', { hasText: 'BGT-UI-BL' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Budget Budget integrity modifie');
});

test('Admin can open management, while Agent direct URL and POST are blocked', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/budgetlines.php');
  await expect(page.getByRole('heading', { name: 'Gestion des lignes budgétaires' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Créer une ligne budgétaire' })).toBeVisible();

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/budgetlines.php');
  await expectAccessDenied(page);

  await page.goto('/custom/mjlfinancement/index.php');
  const token = await sessionToken(page);
  const before = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_budget_line WHERE ref = 'BGT-FORBIDDEN-BL' AND entity = 1"));
  const response = await page.request.post('/custom/mjlfinancement/budgetlines.php', {
    form: {
      token,
      action: 'create',
      ref: 'BGT-FORBIDDEN-BL',
      label: 'Ligne interdite',
      fk_project: scalar("SELECT rowid FROM llx_projet WHERE entity = 1 LIMIT 1"),
      fk_convention: scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE status = 1 AND entity = 1 LIMIT 1"),
      initial_budget: '1000',
      revised_budget: '1000'
    },
    maxRedirects: 0
  });
  expect(await response.text()).toMatch(forbiddenResponsePattern);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_budget_line WHERE ref = 'BGT-FORBIDDEN-BL' AND entity = 1"))).toBe(before);
});

test('Draft convention is unavailable and rejected for budget-line creation', async ({ page }) => {
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-EXT-2026' AND entity = 1 LIMIT 1");
  const draftConventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-TEST-2026-001' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/budgetlines.php?action=create');
  await expect(page.locator('select[name="fk_convention"] option', { hasText: 'CONV-TEST-2026-001' })).toHaveCount(0);
  const token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  const response = await page.request.post('/custom/mjlfinancement/budgetlines.php', {
    form: {
      token,
      action: 'create',
      ref: 'BGT-DRAFT-CONV-BL',
      label: 'Ligne convention brouillon',
      fk_project: projectId,
      fk_convention: draftConventionId,
      initial_budget: '100000',
      revised_budget: '100000'
    },
    maxRedirects: 0
  });
  expect([302, 403]).toContain(response.status());
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_budget_line WHERE ref = 'BGT-DRAFT-CONV-BL' AND entity = 1"))).toBe(0);
});

test('Locked edits, revised-budget floor, and computed amount tampering are rejected or recalculated', async ({ page }) => {
  const budgetLineId = scalar("SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-JE-001' AND entity = 1 LIMIT 1");
  const projectId = scalar(`SELECT fk_project FROM llx_mjlfinancement_budget_line WHERE rowid = ${budgetLineId}`);
  const conventionId = scalar(`SELECT fk_convention FROM llx_mjlfinancement_budget_line WHERE rowid = ${budgetLineId}`);
  const activityId = scalar(`SELECT fk_mjl_activity FROM llx_mjlfinancement_budget_line WHERE rowid = ${budgetLineId}`);
  const taskId = scalar(`SELECT COALESCE(fk_activity, '') FROM llx_mjlfinancement_budget_line WHERE rowid = ${budgetLineId}`);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/budgetlines.php?id=${budgetLineId}`);
  const token = await sessionToken(page);
  let response = await page.request.post(`/custom/mjlfinancement/budgetlines.php?id=${budgetLineId}`, {
    form: {
      token,
      action: 'update',
      id: budgetLineId,
      ref: 'BGT-TAMPER-LOCKED',
      label: 'Formation',
      fk_project: projectId,
      fk_convention: conventionId,
      fk_mjl_activity: activityId,
      fk_activity: taskId,
      initial_budget: '1',
      revised_budget: '900000',
      category: 'tamper',
      spent_amount: '1',
      remaining_amount: '999999999',
      comment: 'Tentative verrouillee Budget integrity'
    },
    maxRedirects: 0
  });
  expect([302, 403]).toContain(response.status());
  expect(scalar(`SELECT ref FROM llx_mjlfinancement_budget_line WHERE rowid = ${budgetLineId}`)).toBe('BL-JE-001');
  expect(Number(scalar(`
    SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action
    WHERE object_type = 'mjlfinancement_budget_line'
    AND object_id = ${budgetLineId}
    AND action = 'unsafe_edit_rejected'
    AND changes_json LIKE '%rejected_fields%'
    AND changes_json NOT LIKE '%BGT-TAMPER-LOCKED%'
    AND changes_json NOT LIKE '%999999999%'
  `))).toBeGreaterThan(0);

  await page.goto(`/custom/mjlfinancement/budgetlines.php?id=${budgetLineId}`);
  const token2 = await sessionToken(page);
  response = await page.request.post(`/custom/mjlfinancement/budgetlines.php?id=${budgetLineId}`, {
    form: {
      token: token2,
      action: 'update',
      id: budgetLineId,
      ref: 'BL-JE-001',
      label: 'Formation Budget integrity',
      fk_project: projectId,
      fk_convention: conventionId,
      fk_mjl_activity: activityId,
      fk_activity: taskId,
      initial_budget: '1800000',
      revised_budget: '1900000',
      category: 'formation',
      spent_amount: '1',
      remaining_amount: '999999999',
      comment: 'Revision autorisee Budget integrity'
    },
    maxRedirects: 0
  });
  expect([302, 403]).toContain(response.status());
  expect(scalar(`SELECT label FROM llx_mjlfinancement_budget_line WHERE rowid = ${budgetLineId}`)).toBe('Formation Budget integrity');
  expect(Number(scalar(`SELECT ROUND(committed_amount) FROM llx_mjlfinancement_budget_line WHERE rowid = ${budgetLineId}`))).toBe(950000);
  expect(Number(scalar(`SELECT ROUND(spent_amount) FROM llx_mjlfinancement_budget_line WHERE rowid = ${budgetLineId}`))).toBe(0);
  expect(Number(scalar(`SELECT ROUND(remaining_amount) FROM llx_mjlfinancement_budget_line WHERE rowid = ${budgetLineId}`))).toBe(950000);
});

test('Inactive budget lines cannot be used by expense create, submit, or validate', async ({ page }) => {
  const inactiveBudgetLineId = scalar("SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BGT-INACTIVE-BL' AND entity = 1 LIMIT 1");
  const activeBudgetLineId = scalar("SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BGT-ACTIVE-BL' AND entity = 1 LIMIT 1");
  const projectId = scalar("SELECT fk_project FROM llx_mjlfinancement_budget_line WHERE rowid = " + inactiveBudgetLineId);
  const conventionId = scalar("SELECT fk_convention FROM llx_mjlfinancement_budget_line WHERE rowid = " + inactiveBudgetLineId);
  const activityId = scalar("SELECT fk_mjl_activity FROM llx_mjlfinancement_budget_line WHERE rowid = " + inactiveBudgetLineId);
  const draftExpenseId = scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'BGT-INACTIVE-DRAFT' AND entity = 1 LIMIT 1");
  const submittedExpenseId = scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'BGT-INACTIVE-SUBMITTED' AND entity = 1 LIMIT 1");

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/expenses.php?action=create');
  await expect(page.locator('select[name="fk_budget_line"] option', { hasText: 'BGT-INACTIVE-BL' })).toHaveCount(0);
  await expect(page.locator('select[name="fk_budget_line"] option', { hasText: 'BGT-ACTIVE-BL' })).toHaveCount(1);

  let token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  let response = await page.request.post('/custom/mjlfinancement/expenses.php', {
    form: {
      token,
      action: 'create',
      ref: 'BGT-INACTIVE-CREATE',
      fk_project: projectId,
      fk_convention: conventionId,
      fk_mjl_activity: activityId,
      fk_budget_line: inactiveBudgetLineId,
      amount: '1000',
      expense_date: '2026-07-01',
      description: 'Creation ligne inactive'
    },
    maxRedirects: 0
  });
  expect([302, 403]).toContain(response.status());
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_expense WHERE ref = 'BGT-INACTIVE-CREATE' AND entity = 1"))).toBe(0);

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${draftExpenseId}`);
  token = await sessionToken(page);
  response = await page.request.post(`/custom/mjlfinancement/expenses.php?id=${draftExpenseId}`, {
    form: { token, action: 'submit', id: draftExpenseId, comment: 'Soumission inactive Budget integrity' },
    maxRedirects: 0
  });
  expect(response.status()).toBe(302);
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${draftExpenseId}`))).toBe(0);

  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${submittedExpenseId}`);
  token = await sessionToken(page);
  response = await page.request.post(`/custom/mjlfinancement/expenses.php?id=${submittedExpenseId}`, {
    form: { token, action: 'validate', id: submittedExpenseId },
    maxRedirects: 0
  });
  expect(response.status()).toBe(302);
  expect(Number(scalar(`SELECT status FROM llx_mjlfinancement_expense WHERE rowid = ${submittedExpenseId}`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_validation WHERE fk_expense = ${submittedExpenseId} AND action = 'validated'`))).toBe(0);
  expect(Number(activeBudgetLineId)).toBeGreaterThan(0);
});
