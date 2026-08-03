const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const { verifyDisposableComposeEnvironment } = require('../helpers/phase3d-prerequisite-isolation');
const { assertNoHorizontalOverflow } = require('../helpers/responsive-shell');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

test.describe.configure({ mode: 'serial' });

function dockerCompose(args) {
  return execFileSync('docker', ['compose', ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function scalar(sql) {
  return dockerCompose(['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-N', '-e', sql]).trim();
}

function executeSql(sql) {
  dockerCompose(['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e', sql]);
}

function cleanupEmptyListUser() {
  executeSql(`
    SET @empty_list_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase3d.empty' AND entity = 1 LIMIT 1);
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE entity = 1 AND fk_user = @empty_list_user;
    DELETE FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = @empty_list_user;
    DELETE FROM llx_usergroup_user WHERE entity = 1 AND fk_user = @empty_list_user;
    DELETE FROM llx_user WHERE entity = 1 AND rowid = @empty_list_user;
  `);
}

function seedEmptyListUser() {
  cleanupEmptyListUser();
  executeSql(`
    SET @agent_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL POC - Agent' AND entity = 1 LIMIT 1);
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' AND entity = 1 LIMIT 1);
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase3d.empty', 'Vide', 'Phase3D', 'mjl.phase3d.empty@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1;
    SET @empty_list_user = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup)
    VALUES (1, @empty_list_user, @agent_group);
    INSERT INTO llx_mjlfinancement_user_role
      (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @empty_list_user, 'AGENT_SAISIE', 1, CURDATE(), 'phase3d_e2e', 'Listes initialement vides', NOW(), @admin);
  `);
}

function cleanupActivityActionFixture() {
  executeSql(`
    SET @activity_action_id = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P3D-ACTION-STATE' AND entity = 1 LIMIT 1);
    DELETE FROM llx_mjlfinancement_workflow_action WHERE entity = 1 AND object_type = 'mjlfinancement_activity' AND object_id = @activity_action_id;
    DELETE FROM llx_mjlfinancement_activity WHERE entity = 1 AND rowid = @activity_action_id;
  `);
}

function cleanupScopedActivityReviewer() {
  executeSql(`
    SET @scoped_reviewer = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase3d.reviewer' AND entity = 1 LIMIT 1);
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE entity = 1 AND fk_user = @scoped_reviewer;
    DELETE FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = @scoped_reviewer;
    DELETE FROM llx_usergroup_user WHERE entity = 1 AND fk_user = @scoped_reviewer;
    DELETE FROM llx_user WHERE entity = 1 AND rowid = @scoped_reviewer;
  `);
}

function seedScopedActivityReviewer() {
  cleanupScopedActivityReviewer();
  executeSql(`
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' AND entity = 1 LIMIT 1);
    SET @source_reviewer = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' AND entity = 1 LIMIT 1);
    SET @unicef = (SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1);
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase3d.reviewer', 'Périmètre', 'Phase3D', 'mjl.phase3d.reviewer@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE rowid = @source_reviewer AND entity = 1;
    SET @scoped_reviewer = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup)
    SELECT entity, @scoped_reviewer, fk_usergroup FROM llx_usergroup_user WHERE entity = 1 AND fk_user = @source_reviewer;
    INSERT INTO llx_mjlfinancement_user_role
      (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @scoped_reviewer, 'AGENT_VERIFICATEUR', 1, CURDATE(), 'phase3d_e2e', 'Relecteur mono-périmètre', NOW(), @admin);
    INSERT INTO llx_mjlfinancement_user_soc_scope
      (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat)
    VALUES (1, @scoped_reviewer, @unicef, 1, CURDATE(), 'phase3d_e2e', 'UNICEF uniquement', NOW(), @admin);
  `);
}

function seedActivityActionFixture() {
  cleanupActivityActionFixture();
  executeSql(`
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1);
    INSERT INTO llx_mjlfinancement_activity
      (entity, ref, label, fk_project, fk_convention, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P3D-ACTION-STATE', 'Décision gardée Phase 3D', @project, @convention, NOW(), @agent, 'P3DACTION', 3);
  `);
  return Number(scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P3D-ACTION-STATE' AND entity = 1 LIMIT 1"));
}

function restoreExpenseDecisionSample() {
  executeSql(`
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-JE-002' AND entity = 1 LIMIT 1);
    SET @budget_line = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-JE-002' AND entity = 1 LIMIT 1);
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1);
    UPDATE llx_mjlfinancement_expense
    SET status = 1, prevalidated_amount = NULL, final_validated_amount = NULL, disbursed_amount = NULL,
      fk_user_prevalidated = NULL, fk_user_final_valid = NULL, fk_user_valid = NULL, fk_user_disbursed = NULL,
      prevalidation_date = NULL, final_validation_date = NULL, validation_date = NULL,
      disbursement_date = NULL, beneficiary_name = NULL, fk_project = @project, fk_convention = @convention,
      fk_mjl_activity = @activity, fk_budget_line = @budget_line, fk_user_creat = @agent
    WHERE entity = 1 AND ref = 'EXP-JE-002';
  `);
}

async function login(page, username) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

test.beforeAll(() => {
  verifyDisposableComposeEnvironment();
  dockerCompose(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php']);
  dockerCompose(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php']);
});

test.afterEach(() => {
  cleanupEmptyListUser();
  cleanupActivityActionFixture();
  cleanupScopedActivityReviewer();
  restoreExpenseDecisionSample();
});

test('project creation uses an authorized dedicated presentation state', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php');

  const listHeader = page.locator('header.mjl-page-header');
  const createAction = listHeader.getByRole('link', { name: 'Créer un projet' });
  await expect(createAction).toBeVisible();
  await expect(createAction).toHaveAttribute('href', '/custom/mjlfinancement/projects.php?action=create');
  await expect(page.locator('form[data-mjl-form="project-create"]')).toHaveCount(0);

  await createAction.click();
  await expect(page).toHaveURL(/projects\.php\?action=create$/);
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Créer un projet');
  await expect(page.locator('form[data-mjl-form="project-create"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', '/custom/mjlfinancement/projects.php');

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/projects.php');
  await expect(page.locator('header.mjl-page-header').getByRole('link', { name: 'Créer un projet' })).toHaveCount(0);
  const denied = await page.goto('/custom/mjlfinancement/projects.php?action=create');
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="project-create"]')).toHaveCount(0);
  await expect(page.locator('select[name="fk_soc"]')).toHaveCount(0);
});

test('activity creation uses an authorized dedicated presentation state', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');

  const listHeader = page.locator('header.mjl-page-header');
  const createAction = listHeader.getByRole('link', { name: 'Créer une activité' });
  await expect(createAction).toBeVisible();
  await expect(createAction).toHaveAttribute('href', '/custom/mjlfinancement/activities.php?action=create');
  await expect(page.locator('form[data-mjl-form="activity-create"]')).toHaveCount(0);

  await createAction.click();
  await expect(page).toHaveURL(/activities\.php\?action=create$/);
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Créer une activité');
  const form = page.locator('form[data-mjl-form="activity-create"]');
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute('data-mjl-substantive', '');
  await expect(form).toHaveAttribute('data-mjl-validate', '');
  await expect(form.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', '/custom/mjlfinancement/activities.php');
  for (const width of [390, 768, 1024, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await assertNoHorizontalOverflow(page, { label: `activity create state at ${width}px` });
  }
  await form.locator('input[name="ref"]').fill('Brouillon navigation');
  await form.getByRole('link', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog', { name: 'Modifications non enregistrées' })).toBeVisible();
});

test('activity editing uses an authorized dedicated presentation state', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 0 WHERE entity = 1 AND rowid = ${activityId}`);

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);

  const detailHeader = page.locator('header.mjl-page-header');
  const editAction = detailHeader.getByRole('link', { name: 'Modifier l’activité' });
  await expect(editAction).toBeVisible();
  await expect(editAction).toHaveAttribute('href', `/custom/mjlfinancement/activities.php?id=${activityId}&action=edit`);
  await expect(page.locator('form[data-mjl-form="activity-correction"]')).toHaveCount(0);

  await editAction.click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${activityId}&action=edit$`));
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Modifier l’activité P3D-ACTION-STATE');
  await expect(page.locator('header.mjl-page-header')).toContainText('Brouillon');
  const form = page.locator('form[data-mjl-form="activity-update"]');
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute('data-mjl-substantive', '');
  await expect(form).toHaveAttribute('data-mjl-validate', '');
  await expect(form.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', `/custom/mjlfinancement/activities.php?id=${activityId}`);
  for (const width of [390, 768, 1024, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await assertNoHorizontalOverflow(page, { label: `activity edit state at ${width}px` });
  }
});

test('activity supporting-document upload uses an authorized dedicated presentation state', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 0 WHERE entity = 1 AND rowid = ${activityId}`);
  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);

  await expect(page.locator('form[data-mjl-form="activity-upload"]')).toHaveCount(0);
  const uploadAction = page.getByRole('link', { name: 'Ajouter un document' });
  await expect(uploadAction).toHaveAttribute('href', `/custom/mjlfinancement/activities.php?id=${activityId}&action=upload`);
  await uploadAction.click();

  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${activityId}&action=upload$`));
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Ajouter un document à l’activité P3D-ACTION-STATE');
  await expect(page.locator('header.mjl-page-header')).toContainText('Brouillon');
  const form = page.locator('form[data-mjl-form="activity-upload"]');
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute('data-mjl-substantive', '');
  await expect(form.locator('input[name="supporting_document"]')).toHaveAttribute('required', '');
  await expect(form.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', `/custom/mjlfinancement/activities.php?id=${activityId}`);
  for (const width of [390, 768, 1024, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await assertNoHorizontalOverflow(page, { label: `activity document upload state at ${width}px` });
  }
});

test('expense supporting-document upload uses an authorized dedicated presentation state', async ({ page }) => {
  restoreExpenseDecisionSample();
  const expenseId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-002' AND entity = 1 LIMIT 1"));
  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}`);

  await expect(page.locator('form[data-mjl-form="expense-upload"]')).toHaveCount(0);
  const uploadAction = page.getByRole('link', { name: 'Ajouter une pièce justificative' });
  await expect(uploadAction).toHaveAttribute('href', `/custom/mjlfinancement/expenses.php?id=${expenseId}&action=upload`);
  await uploadAction.click();

  await expect(page).toHaveURL(new RegExp(`expenses\\.php\\?id=${expenseId}&action=upload$`));
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Ajouter une pièce justificative à la dépense EXP-JE-002');
  await expect(page.locator('header.mjl-page-header')).toContainText('Soumise');
  const form = page.locator('form[data-mjl-form="expense-upload"]');
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute('data-mjl-substantive', '');
  await expect(form.locator('input[name="supporting_document"]')).toHaveAttribute('required', '');
  await expect(form.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', `/custom/mjlfinancement/expenses.php?id=${expenseId}`);
  for (const width of [390, 768, 1024, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await assertNoHorizontalOverflow(page, { label: `expense document upload state at ${width}px` });
  }
});

test('supporting-document upload states deny the wrong role and retain failures without recovery handles', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 0 WHERE entity = 1 AND rowid = ${activityId}`);
  restoreExpenseDecisionSample();
  const expenseId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-002' AND entity = 1 LIMIT 1"));

  await login(page, 'superviseur.n1');
  let denied = await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=upload`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('form[data-mjl-form="activity-upload"]')).toHaveCount(0);
  await expect(page.locator('input[name="supporting_document"]')).toHaveCount(0);
  denied = await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}&action=upload`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('form[data-mjl-form="expense-upload"]')).toHaveCount(0);
  await expect(page.locator('input[name="supporting_document"]')).toHaveCount(0);

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=upload`);
  let form = page.locator('form[data-mjl-form="activity-upload"]');
  let response = await page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'upload',
      id: String(activityId),
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(response.headers().location || '').toMatch(new RegExp(`activities\\.php\\?id=${activityId}&action=upload&mjl_document_state=upload-failed$`));
  expect(response.headers().location || '').not.toContain('mjl_recovery=');
  await page.goto(response.headers().location);
  await expect(page.locator('form[data-mjl-form="activity-upload"]')).toBeVisible();
  await expect(page.getByText('Échec de l’ajout').first()).toBeVisible();

  await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}&action=upload`);
  form = page.locator('form[data-mjl-form="expense-upload"]');
  response = await page.request.post(`/custom/mjlfinancement/expenses.php?id=${expenseId}`, {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'upload',
      id: String(expenseId),
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(response.headers().location || '').toMatch(new RegExp(`expenses\\.php\\?id=${expenseId}&action=upload&mjl_document_state=upload-failed$`));
  expect(response.headers().location || '').not.toContain('mjl_recovery=');
  await page.goto(response.headers().location);
  await expect(page.locator('form[data-mjl-form="expense-upload"]')).toBeVisible();
  await expect(page.getByText('Échec de l ajout').first()).toBeVisible();
});

test('activity create and edit presentation guards deny the wrong role before rendering options', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 0 WHERE entity = 1 AND rowid = ${activityId}`);
  await login(page, 'superviseur.n1');

  let denied = await page.goto('/custom/mjlfinancement/activities.php?action=create');
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="activity-create"]')).toHaveCount(0);
  await expect(page.locator('select[name="fk_project"]')).toHaveCount(0);

  denied = await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=edit`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="activity-update"]')).toHaveCount(0);
  await expect(page.locator('select[name="fk_user_responsible"]')).toHaveCount(0);
});

test('activity creation recovery returns to the guarded state and is consumed once', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  let form = page.locator('form[data-mjl-form="activity-create"]');
  const conventionOption = form.locator('select[name="fk_convention"] option:not([value=""])').first();
  const convention = await conventionOption.getAttribute('value');
  const project = await conventionOption.getAttribute('data-project-id');
  const task = await form.locator(`select[name="fk_task"] option[data-project-id="${project}"]`).first().getAttribute('value');
  const responsible = await form.locator('select[name="fk_user_responsible"] option:not([value=""])').first().getAttribute('value');
  expect(project).toMatch(/^[1-9][0-9]*$/);
  expect(task).toMatch(/^[1-9][0-9]*$/);
  expect(responsible).toMatch(/^[1-9][0-9]*$/);
  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: 'P3D-ACTIVITY-RECOVERY',
      label: '',
      fk_project: project,
      fk_convention: convention,
      fk_task: task,
      fk_user_responsible: responsible,
      physical_execution_percent: '25',
    },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  const location = response.headers().location || '';
  expect(location).toMatch(/activities\.php\?action=create&mjl_recovery=[a-f0-9]{32}$/);
  await page.goto(location);
  form = page.locator('form[data-mjl-form="activity-create"]');
  await expect(form).toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('[data-mjl-error-summary]')).toBeFocused();
  await expect(form.locator('input[name="ref"]')).toHaveValue('P3D-ACTIVITY-RECOVERY');
  await expect(form.locator('select[name="fk_project"]')).toHaveValue(project);
  await expect(form.locator('select[name="fk_convention"]')).toHaveValue(convention);
  await expect(form.locator('select[name="fk_task"]')).toHaveValue(task);
  await expect(form.locator('select[name="fk_user_responsible"]')).toHaveValue(responsible);
  await expect(form.locator('input[name="physical_execution_percent"]')).toHaveValue('25');

  await page.reload();
  await expect(form).not.toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('input[name="ref"]')).toHaveValue('');
  await expect(form.locator('select[name="fk_project"]')).toHaveValue('');
  await expect(form.locator('select[name="fk_task"]')).toHaveValue('');
  await expect(form.locator('select[name="fk_user_responsible"]')).toHaveValue('');
});

test('activity creation recovery rejects request-controlled selection aliases', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  let form = page.locator('form[data-mjl-form="activity-create"]');
  const injectedProject = await form.locator('select[name="fk_project"] option:not([value=""])').first().getAttribute('value');
  const injectedConvention = await form.locator('select[name="fk_convention"] option:not([value=""])').first().getAttribute('value');
  const injectedTask = await form.locator('select[name="fk_task"] option:not([value=""])').first().getAttribute('value');
  const injectedResponsible = await form.locator('select[name="fk_user_responsible"] option:not([value=""])').first().getAttribute('value');
  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: 'P3D-ACTIVITY-ALIAS-INJECTION',
      label: '',
      fk_project: '',
      fk_convention: '',
      project_scope: injectedProject,
      convention_scope: injectedConvention,
      task_scope: injectedTask,
      responsible_scope: injectedResponsible,
    },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  await page.goto(response.headers().location);
  form = page.locator('form[data-mjl-form="activity-create"]');
  await expect(form.locator('input[name="ref"]')).toHaveValue('P3D-ACTIVITY-ALIAS-INJECTION');
  await expect(form.locator('select[name="fk_project"]')).toHaveValue('');
  await expect(form.locator('select[name="fk_convention"]')).toHaveValue('');
  await expect(form.locator('select[name="fk_task"]')).toHaveValue('');
  await expect(form.locator('select[name="fk_user_responsible"]')).toHaveValue('');
});

test('activity edit recovery returns to the guarded state and is consumed once', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 0 WHERE entity = 1 AND rowid = ${activityId}`);
  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=edit`);
  let form = page.locator('form[data-mjl-form="activity-update"]');
  const responsible = await form.locator('select[name="fk_user_responsible"] option:not([value=""])').first().getAttribute('value');
  expect(responsible).toMatch(/^[1-9][0-9]*$/);
  const response = await page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'update',
      id: String(activityId),
      label: 'Libellé récupération Phase 3D',
      fk_user_responsible: responsible,
      date_start: '2026-08-10',
      date_end: '2026-08-01',
      comment: '',
    },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  const location = response.headers().location || '';
  expect(location).toMatch(new RegExp(`activities\\.php\\?id=${activityId}&action=edit&mjl_recovery=[a-f0-9]{32}$`));

  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 3 WHERE entity = 1 AND rowid = ${activityId}`);
  const denied = await page.goto(location);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('form[data-mjl-form="activity-update"]')).toHaveCount(0);
  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 0 WHERE entity = 1 AND rowid = ${activityId}`);
  await page.goto(location);
  form = page.locator('form[data-mjl-form="activity-update"]');
  await expect(form).toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('[data-mjl-error-summary]')).toBeFocused();
  await expect(form.locator('input[name="label"]')).toHaveValue('Libellé récupération Phase 3D');
  await expect(form.locator('select[name="fk_user_responsible"]')).toHaveValue(responsible);
  await expect(form.locator('textarea[name="comment"]')).toHaveAttribute('aria-invalid', 'true');

  await page.reload();
  await expect(form).not.toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('input[name="label"]')).toHaveValue('Décision gardée Phase 3D');
  await expect(form.locator('select[name="fk_user_responsible"]')).toHaveValue('');
  await expect(form.locator('textarea[name="comment"]')).toHaveValue('');
});

test('project editing uses an authorized dedicated presentation state', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php');

  const projectLink = page.getByRole('link', { name: 'PRJ-JE-2026' }).first();
  const projectHref = await projectLink.getAttribute('href');
  expect(projectHref).toMatch(/^\/custom\/mjlfinancement\/projects\.php\?id=\d+$/);
  await projectLink.click();

  const detailHeader = page.locator('header.mjl-page-header');
  const editAction = detailHeader.getByRole('link', { name: 'Modifier le projet' });
  await expect(editAction).toBeVisible();
  await expect(editAction).toHaveAttribute('href', `${projectHref}&action=edit`);
  await expect(page.locator('form[data-mjl-form="project-update"]')).toHaveCount(0);

  await editAction.click();
  await expect(page).toHaveURL(new RegExp(`${projectHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}&action=edit$`));
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Modifier le projet PRJ-JE-2026');
  await expect(page.locator('header.mjl-page-header')).toContainText('Statut actuel');
  await expect(page.locator('header.mjl-page-header')).toContainText('Ouvert');
  await expect(page.locator('form[data-mjl-form="project-update"]')).toBeVisible();
  await expect(page.getByLabel('Référence')).toBeVisible();
  await expect(page.getByLabel('Intitulé')).toBeVisible();
  await expect(page.locator('form[data-mjl-form="project-update"]')).toHaveAttribute('data-mjl-substantive', '');
  await expect(page.locator('form[data-mjl-form="project-update"]')).toHaveAttribute('data-mjl-validate', '');
  await expect(page.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', projectHref);

  await login(page, 'agent.mjl');
  await page.goto(projectHref);
  await expect(page.locator('header.mjl-page-header').getByRole('link', { name: 'Modifier le projet' })).toHaveCount(0);
  const denied = await page.goto(`${projectHref}&action=edit`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="project-update"]')).toHaveCount(0);
  await expect(page.locator('select[name="fk_soc"]')).toHaveCount(0);
});

test('project edit recovery stays on the guarded edit state and is consumed once', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php');

  const projectHref = await page.getByRole('link', { name: 'PRJ-JE-2026' }).first().getAttribute('href');
  await page.goto(`${projectHref}&action=edit`);
  const form = page.locator('form[data-mjl-form="project-update"]');
  const originalTitle = await form.locator('input[name="title"]').inputValue();
  const response = await page.request.post(projectHref, {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
      action: 'update',
      id: await form.locator('input[name="id"]').inputValue(),
      ref: await form.locator('input[name="ref"]').inputValue(),
      title: '',
      fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
      fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
      description: 'Phase 3D edit recovery',
    },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  const location = response.headers().location || '';
  expect(location).toContain('action=edit');
  expect(location).toMatch(/mjl_recovery=[a-f0-9]{32}/);

  await page.goto(location);
  await expect(form.locator('textarea[name="description"]')).toHaveValue('Phase 3D edit recovery');
  await expect(form.locator('select[name="fk_soc"]')).not.toHaveValue('');
  await expect(form.locator('select[name="fk_statut"]')).toHaveValue('1');
  await expect(form).toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('Corrigez');
  await expect(form.locator('a[href="#mjl-project-update-title"]')).toBeVisible();

  await form.getByRole('link', { name: 'Annuler' }).click();
  const unsavedDialog = page.getByRole('dialog', { name: 'Modifications non enregistrées' });
  await expect(unsavedDialog).toBeVisible();
  await unsavedDialog.getByRole('button', { name: 'Continuer la saisie' }).click();

  await page.reload();
  await expect(form.locator('input[name="title"]')).toHaveValue(originalTitle);
  await expect(form.locator('textarea[name="description"]')).not.toHaveValue('Phase 3D edit recovery');
});

test('project recovery rejects injected aliases and invalid or stale selections', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  let form = page.locator('form[data-mjl-form="project-create"]');
  const partnerOptions = form.locator('select[name="fk_soc"] option:not([value=""])');
  const validPartner = await partnerOptions.first().getAttribute('value');
  const injectedPartner = await partnerOptions.nth(1).getAttribute('value');
  let response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
      action: 'create',
      ref: 'P3D-ALIAS-INJECTION',
      title: '',
      fk_soc: validPartner,
      fk_statut: '0',
      partner_scope: injectedPartner,
      project_status: '1',
    },
    maxRedirects: 0,
  });
  await page.goto(response.headers().location);
  form = page.locator('form[data-mjl-form="project-create"]');
  await expect(form.locator('select[name="fk_soc"]')).toHaveValue(validPartner);
  await expect(form.locator('select[name="fk_statut"]')).toHaveValue('0');

  response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
      action: 'create',
      ref: 'P3D-INVALID-ENUM',
      title: '',
      fk_soc: validPartner,
      fk_statut: '2',
    },
    maxRedirects: 0,
  });
  await page.goto(response.headers().location);
  form = page.locator('form[data-mjl-form="project-create"]');
  await expect(form.locator('[data-mjl-form-errors]')).toContainText('Le statut sélectionné n’est pas reconnu.');
  await expect(form.locator('select[name="fk_statut"]')).toHaveValue('1');

  response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
      action: 'create',
      ref: 'P3D-STALE-PARTNER',
      title: '',
      fk_soc: validPartner,
      fk_statut: '0',
    },
    maxRedirects: 0,
  });
  try {
    executeSql(`UPDATE llx_societe SET status = 0 WHERE entity = 1 AND rowid = ${Number(validPartner)}`);
    await page.goto(response.headers().location);
    form = page.locator('form[data-mjl-form="project-create"]');
    await expect(form.locator('input[name="ref"]')).toHaveValue('P3D-STALE-PARTNER');
    await expect(form.locator('select[name="fk_soc"]')).toHaveValue('');
    await expect(form.locator('select[name="fk_statut"]')).toHaveValue('0');
  } finally {
    executeSql(`UPDATE llx_societe SET status = 1 WHERE entity = 1 AND rowid = ${Number(validPartner)}`);
  }
});

test('substantive project forms focus invalid input, warn on dirty navigation, and lock duplicate submits', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.addInitScript(() => {
    const nativeAdd = window.addEventListener;
    const nativeRemove = window.removeEventListener;
    window.__mjlBeforeUnload = { added: 0, removed: 0 };
    window.addEventListener = function (type, listener, options) {
      if (type === 'beforeunload') window.__mjlBeforeUnload.added += 1;
      return nativeAdd.call(this, type, listener, options);
    };
    window.removeEventListener = function (type, listener, options) {
      if (type === 'beforeunload') window.__mjlBeforeUnload.removed += 1;
      return nativeRemove.call(this, type, listener, options);
    };
  });
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  const form = page.locator('form[data-mjl-form="project-create"]');
  await expect(form.getByRole('button', { name: 'Créer le projet' })).toBeVisible();

  await form.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(form.locator('[data-mjl-error-summary]')).toBeFocused();
  expect(await page.evaluate(() => window.__mjlBeforeUnload)).toEqual({ added: 0, removed: 0 });

  const title = form.getByLabel('Intitulé');
  await title.fill('Brouillon temporaire');
  await form.locator('a[href="#mjl-project-create-ref"]').click();
  await expect(page.getByRole('dialog', { name: 'Modifications non enregistrées' })).toBeHidden();
  expect((await page.evaluate(() => window.__mjlBeforeUnload)).added).toBe(1);
  await form.getByRole('link', { name: 'Annuler' }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifications non enregistrées' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Continuer la saisie' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Quitter sans enregistrer' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Continuer la saisie' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(form.getByRole('link', { name: 'Annuler' })).toBeFocused();

  await form.getByRole('link', { name: 'Annuler' }).click();
  await dialog.getByRole('button', { name: 'Continuer la saisie' }).click();

  await title.fill('');
  expect((await page.evaluate(() => window.__mjlBeforeUnload)).removed).toBe(1);
  await form.getByRole('link', { name: 'Annuler' }).click();
  await expect(page).toHaveURL(/projects\.php$/);

  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  const leaveForm = page.locator('form[data-mjl-form="project-create"]');
  await leaveForm.getByLabel('Intitulé').fill('Quitter explicitement');
  await leaveForm.evaluate((element) => {
    ['download', 'new-tab', 'modified'].forEach((kind) => {
      const link = document.createElement('a');
      link.href = '/custom/mjlfinancement/projects.php';
      link.textContent = kind;
      link.dataset.testLink = kind;
      if (kind === 'download') link.setAttribute('download', 'test.txt');
      if (kind === 'new-tab') link.target = '_blank';
      link.addEventListener('click', (event) => event.preventDefault());
      element.appendChild(link);
    });
  });
  await leaveForm.locator('[data-test-link="download"]').click();
  await leaveForm.locator('[data-test-link="new-tab"]').click();
  await leaveForm.locator('[data-test-link="modified"]').click({ modifiers: ['Control'] });
  await expect(page.getByRole('dialog', { name: 'Modifications non enregistrées' })).toBeHidden();
  await leaveForm.getByRole('link', { name: 'Annuler' }).click();
  await dialog.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
  await expect(page).toHaveURL(/projects\.php$/);

  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  const validForm = page.locator('form[data-mjl-form="project-create"]');
  await validForm.getByLabel('Référence').fill('P3D-DUPLICATE-LOCK');
  await validForm.getByLabel('Intitulé').fill('Protection double soumission');
  await validForm.locator('select[name="fk_soc"]').selectOption({ index: 1 });
  let releasePost;
  let markPostStarted;
  const postStarted = new Promise((resolve) => { markPostStarted = resolve; });
  const heldPost = new Promise((resolve) => { releasePost = resolve; });
  let reportLockState;
  const lockObserved = new Promise((resolve) => { reportLockState = resolve; });
  await page.exposeFunction('__mjlReportSubmitLock', reportLockState);
  await validForm.evaluate((element) => {
    element.addEventListener('submit', () => {
      const submit = element.querySelector('[type="submit"]');
      window.__mjlReportSubmitLock({
        disabled: submit.disabled,
        formBusy: element.getAttribute('aria-busy'),
        submitBusy: submit.getAttribute('aria-busy'),
      });
      window.setTimeout(() => element.requestSubmit(), 0);
    });
  });
  let emittedPosts = 0;
  await page.route('**/custom/mjlfinancement/projects.php*', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    emittedPosts += 1;
    markPostStarted();
    await heldPost;
    return route.abort();
  });
  const firstSubmit = validForm.getByRole('button', { name: 'Créer le projet' }).click({ noWaitAfter: true }).catch(() => {});
  const [, lockState] = await Promise.all([postStarted, lockObserved]);
  expect(lockState).toEqual({ disabled: true, formBusy: 'true', submitBusy: 'true' });
  await expect.poll(() => emittedPosts).toBe(1);
  releasePost();
  await firstSubmit;
  await page.unroute('**/custom/mjlfinancement/projects.php*');

  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.locator('form[data-mjl-substantive]')).toHaveCount(0);
  await page.goto('/custom/mjlfinancement/projects.php');
  const projectHref = await page.getByRole('link', { name: 'PRJ-JE-2026' }).first().getAttribute('href');
  await page.goto(projectHref);
  await expect(page.locator('form[data-mjl-form="contextual-comment"][data-mjl-substantive]')).toHaveCount(0);
});

test('project submission tokens prevent replay and unchanged updates create no audit', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  let form = page.locator('form[data-mjl-form="project-create"]');
  const createRef = `P3D-NONCE-${Date.now()}`;
  const createPayload = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'create',
    ref: createRef,
    title: 'Création protégée contre le rejeu',
    fk_soc: await form.locator('select[name="fk_soc"] option:not([value=""])').first().getAttribute('value'),
    fk_statut: '1',
  };
  const created = await page.request.post('/custom/mjlfinancement/projects.php', { form: createPayload, maxRedirects: 0 });
  expect(created.status()).toBe(302);
  const createdId = new URL(created.headers().location, 'http://localhost').searchParams.get('id');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE entity = 1 AND ref = '${createRef}'`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${createdId} AND action = 'created'`))).toBe(1);
  const createReplay = await page.request.post('/custom/mjlfinancement/projects.php', { form: createPayload, maxRedirects: 0 });
  expect(createReplay.status()).toBe(302);
  expect(createReplay.headers().location || '').toMatch(/action=create.*mjl_recovery=/);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE entity = 1 AND ref = '${createRef}'`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${createdId} AND action = 'created'`))).toBe(1);

  await page.goto('/custom/mjlfinancement/projects.php');
  const projectHref = await page.getByRole('link', { name: 'PRJ-JE-2026' }).first().getAttribute('href');
  const projectId = new URL(projectHref, 'http://localhost').searchParams.get('id');
  await page.goto(`${projectHref}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const payload = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'update',
    id: projectId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: await form.locator('input[name="title"]').inputValue(),
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
    date_start: await form.locator('input[name="date_start"]').inputValue(),
    date_end: await form.locator('input[name="date_end"]').inputValue(),
    description: `Nonce replay ${Date.now()}`,
  };
  const auditBefore = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'field_changed'`));
  const accepted = await page.request.post(projectHref, { form: payload, maxRedirects: 0 });
  expect(accepted.status()).toBe(302);
  const auditAfterAccepted = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'field_changed'`));
  expect(auditAfterAccepted).toBe(auditBefore + 1);

  const replayed = await page.request.post(projectHref, { form: payload, maxRedirects: 0 });
  expect(replayed.status()).toBe(302);
  expect(replayed.headers().location || '').toMatch(/action=edit.*mjl_recovery=/);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'field_changed'`))).toBe(auditAfterAccepted);
  await page.goto(replayed.headers().location);
  await expect(page.locator('[data-mjl-form-errors]')).toContainText('Ce formulaire n’est plus valide');

  await page.goto(`${projectHref}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const unchanged = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'update',
    id: projectId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: await form.locator('input[name="title"]').inputValue(),
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
    date_start: await form.locator('input[name="date_start"]').inputValue(),
    date_end: await form.locator('input[name="date_end"]').inputValue(),
    description: await form.locator('textarea[name="description"]').inputValue(),
  };
  const noOpResponse = await page.request.post(projectHref, { form: unchanged, maxRedirects: 0 });
  expect(noOpResponse.status()).toBe(302);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'field_changed'`))).toBe(auditAfterAccepted);
});

test('project tokens reject missing and mismatched contexts while concurrent effects stay singular', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  let form = page.locator('form[data-mjl-form="project-create"]');
  const missingRef = `P3D-MISSING-${Date.now()}`;
  const partner = await form.locator('select[name="fk_soc"] option:not([value=""])').first().getAttribute('value');
  const missingResponse = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'create',
      ref: missingRef,
      title: 'Nonce absent',
      fk_soc: partner,
      fk_statut: '1',
    },
    maxRedirects: 0,
  });
  expect(missingResponse.headers().location || '').toMatch(/action=create.*mjl_recovery=/);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE entity = 1 AND ref = '${missingRef}'`))).toBe(0);
  const createContextNonce = await form.locator('input[name="mjl_submission"]').inputValue();

  await page.goto('/custom/mjlfinancement/projects.php');
  const projectHrefs = await page.locator('a.mjl-table-link[href*="projects.php?id="]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))].slice(0, 2));
  expect(projectHrefs).toHaveLength(2);
  const firstId = new URL(projectHrefs[0], 'http://localhost').searchParams.get('id');
  await page.goto(`${projectHrefs[0]}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const firstTitle = await form.locator('input[name="title"]').inputValue();
  const crossActionPayload = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: createContextNonce,
    action: 'update',
    id: firstId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: 'CROSS-ACTION-MUST-NOT-WRITE',
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
  };
  const crossAction = await page.request.post(projectHrefs[0], { form: crossActionPayload, maxRedirects: 0 });
  expect(crossAction.headers().location || '').toMatch(/action=edit.*mjl_recovery=/);
  expect(scalar(`SELECT title FROM llx_projet WHERE entity = 1 AND rowid = ${firstId}`)).toBe(firstTitle);

  const firstObjectNonce = await form.locator('input[name="mjl_submission"]').inputValue();
  const secondId = new URL(projectHrefs[1], 'http://localhost').searchParams.get('id');
  await page.goto(`${projectHrefs[1]}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const secondTitle = await form.locator('input[name="title"]').inputValue();
  const crossObjectPayload = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: firstObjectNonce,
    action: 'update',
    id: secondId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: 'CROSS-OBJECT-MUST-NOT-WRITE',
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
  };
  const crossObject = await page.request.post(projectHrefs[1], { form: crossObjectPayload, maxRedirects: 0 });
  expect(crossObject.headers().location || '').toMatch(/action=edit.*mjl_recovery=/);
  expect(scalar(`SELECT title FROM llx_projet WHERE entity = 1 AND rowid = ${secondId}`)).toBe(secondTitle);

  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  form = page.locator('form[data-mjl-form="project-create"]');
  const concurrentRef = `P3D-CONCURRENT-${Date.now()}`;
  const concurrentCreate = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'create',
    ref: concurrentRef,
    title: 'Création concurrente unique',
    fk_soc: partner,
    fk_statut: '1',
  };
  const createResponses = await Promise.all([
    page.request.post('/custom/mjlfinancement/projects.php', { form: concurrentCreate, maxRedirects: 0 }),
    page.request.post('/custom/mjlfinancement/projects.php', { form: concurrentCreate, maxRedirects: 0 }),
  ]);
  expect(createResponses.every((response) => response.status() === 302)).toBeTruthy();
  const concurrentId = scalar(`SELECT rowid FROM llx_projet WHERE entity = 1 AND ref = '${concurrentRef}'`);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE entity = 1 AND ref = '${concurrentRef}'`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${concurrentId} AND action = 'created'`))).toBe(1);

  await page.goto(`${projectHrefs[0]}&action=edit`);
  form = page.locator('form[data-mjl-form="project-update"]');
  const concurrentDescription = `Concurrent update ${Date.now()}`;
  const concurrentUpdate = {
    token: await form.locator('input[name="token"]').inputValue(),
    mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
    action: 'update',
    id: firstId,
    ref: await form.locator('input[name="ref"]').inputValue(),
    title: await form.locator('input[name="title"]').inputValue(),
    fk_soc: await form.locator('select[name="fk_soc"]').inputValue(),
    fk_statut: await form.locator('select[name="fk_statut"]').inputValue(),
    date_start: await form.locator('input[name="date_start"]').inputValue(),
    date_end: await form.locator('input[name="date_end"]').inputValue(),
    description: concurrentDescription,
  };
  const updateAuditBefore = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${firstId} AND action = 'field_changed'`));
  const updateResponses = await Promise.all([
    page.request.post(projectHrefs[0], { form: concurrentUpdate, maxRedirects: 0 }),
    page.request.post(projectHrefs[0], { form: concurrentUpdate, maxRedirects: 0 }),
  ]);
  expect(updateResponses.every((response) => response.status() === 302)).toBeTruthy();
  expect(scalar(`SELECT description FROM llx_projet WHERE entity = 1 AND rowid = ${firstId}`)).toBe(concurrentDescription);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${firstId} AND action = 'field_changed'`))).toBe(updateAuditBefore + 1);
});

test('recovered project error summary receives focus without JavaScript', async ({ page, browser }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  const form = page.locator('form[data-mjl-form="project-create"]');
  const response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      mjl_submission: await form.locator('input[name="mjl_submission"]').inputValue(),
      action: 'create',
      ref: 'P3D-NOSCRIPT-FOCUS',
      title: '',
      fk_soc: await form.locator('select[name="fk_soc"] option:not([value=""])').first().getAttribute('value'),
      fk_statut: '1',
    },
    maxRedirects: 0,
  });
  const noScriptContext = await browser.newContext({
    baseURL: process.env.MJL_BASE_URL,
    javaScriptEnabled: false,
  });
  await noScriptContext.addCookies(await page.context().cookies());
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto(response.headers().location);
  await expect(noScriptPage.locator('[data-mjl-error-summary]')).toBeFocused();
  await noScriptContext.close();
});

test('project filters use the shared presentation and retain applied state', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/projects.php');

  const filters = page.locator('form[data-mjl-table-filters="projects"]');
  await expect(filters).toHaveAttribute('aria-label', 'Filtres des projets');
  await expect(filters.locator('.mjl-filter-summary')).toHaveText('Aucun filtre actif.');
  await filters.getByLabel('Partenaire / Programme').selectOption({ label: 'UNICEF' });
  await filters.getByLabel('Statut').selectOption('1');
  await filters.getByLabel('Trier par').selectOption('recent');
  await filters.getByRole('button', { name: 'Appliquer' }).click();

  await expect(page).toHaveURL(/projects\.php\?partner=\d+&status=1&sort=recent$/);
  await expect(filters.getByLabel('Partenaire / Programme')).toHaveValue(/^[1-9]\d*$/);
  await expect(filters.getByLabel('Statut')).toHaveValue('1');
  await expect(filters.getByLabel('Trier par')).toHaveValue('recent');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Partenaire / Programme : UNICEF');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Statut : Ouvert');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Trier par : Plus récents');
  await expect(filters.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', '/custom/mjlfinancement/projects.php');

  await expect(page.locator('nav[aria-label="Pagination des projets"] [aria-current="page"]')).toHaveText(/Page 1/);
});

test('project list remains a semantic table at 1366px/1024px and labeled cards at 768px/390px', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/projects.php');

  const table = page.getByRole('table', { name: 'Projets du périmètre' });
  const firstRow = table.locator('tbody tr').first();

  for (const width of [1366, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(table.locator('thead')).toHaveCSS('position', 'static');
    await expect(table.getByRole('columnheader').first()).toHaveText('Projet');
    await expect(table.getByRole('columnheader').nth(1)).toHaveText('Statut');
    await expect(table.getByRole('columnheader').last()).toHaveText('Ouvrir');
    await expect(firstRow.locator('td[data-label="Ouvrir"]')).toHaveCSS('display', 'table-cell');
  }

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator('td[data-label="Projet"]')).toHaveCSS('display', 'grid');
    await expect(firstRow.locator('td[data-label="Statut"]')).toBeVisible();
    await expect(firstRow.locator('td[data-label="Partenaire / Programme"]')).toBeVisible();
    await expect(firstRow.locator('td[data-label="Ouvrir"] a')).toHaveText('Ouvrir');
  }

  await assertNoHorizontalOverflow(page, {
    label: 'project list',
    afterResize: async () => expect(table).toBeVisible(),
  });
});

test('activity filters and pagination use the same shared presentation', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');

  const filters = page.locator('form[data-mjl-table-filters="activities"]');
  await expect(filters).toHaveAttribute('aria-label', 'Filtres des activités');
  await expect(filters.locator('.mjl-filter-summary')).toHaveText('Aucun filtre actif.');
  await filters.getByLabel('Risque échéance').selectOption('overdue');
  await filters.getByLabel('Trier par').selectOption('recent');
  await filters.getByRole('button', { name: 'Appliquer' }).click();

  const appliedUrl = new URL(page.url());
  expect(appliedUrl.searchParams.get('risk')).toBe('overdue');
  expect(appliedUrl.searchParams.get('sort')).toBe('recent');
  await expect(filters.getByLabel('Risque échéance')).toHaveValue('overdue');
  await expect(filters.getByLabel('Trier par')).toHaveValue('recent');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Risque échéance : En retard');
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Trier par : Plus récentes');
  await expect(filters.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', '/custom/mjlfinancement/activities.php');

  await expect(page.locator('nav[aria-label="Pagination des activités"] [aria-current="page"]')).toHaveText(/Page 1/);
});

test('expense filters and pagination use the same shared presentation', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/expenses.php');

  const filters = page.locator('form[data-mjl-table-filters="expenses"]');
  await expect(filters).toHaveAttribute('aria-label', 'Filtres des dépenses');
  await expect(filters.locator('.mjl-filter-summary')).toHaveText('Aucun filtre actif.');
  const projectValue = await filters.getByLabel('Projet').locator('option', { hasText: 'PRJ-JE-2026' }).getAttribute('value');
  await filters.getByLabel('Projet').selectOption(projectValue);
  await filters.getByLabel('Trier par').selectOption('amount');
  await filters.getByRole('button', { name: 'Appliquer' }).click();

  const appliedUrl = new URL(page.url());
  expect(appliedUrl.searchParams.get('project')).toMatch(/^[1-9]\d*$/);
  expect(appliedUrl.searchParams.get('sort')).toBe('amount');
  await expect(filters.getByLabel('Projet')).toHaveValue(/^[1-9]\d*$/);
  await expect(filters.getByLabel('Trier par')).toHaveValue('amount');
  await expect(filters.locator('.mjl-filter-summary')).toContainText(/Projet : .*PRJ-JE-2026/);
  await expect(filters.locator('.mjl-filter-summary')).toContainText('Trier par : Montant décroissant');
  await expect(filters.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', '/custom/mjlfinancement/expenses.php');

  await expect(page.locator('nav[aria-label="Pagination des dépenses"] [aria-current="page"]')).toHaveText(/Page 1/);
});

test('expense list remains a semantic table at 1366px/1024px and labeled cards at 768px/390px', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/expenses.php');

  const table = page.getByRole('table', { name: 'Dépenses du périmètre' });
  const firstRow = table.locator('tbody tr').first();

  for (const width of [1366, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(table.locator('thead')).toHaveCSS('position', 'static');
    await expect(table.getByRole('columnheader').first()).toHaveText('Dépense');
    await expect(table.getByRole('columnheader').nth(1)).toHaveText('Statut');
    await expect(table.getByRole('columnheader').last()).toHaveText('Ouvrir');
    await expect(firstRow.locator('td[data-label="Ouvrir"]')).toHaveCSS('display', 'table-cell');
  }

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator('td[data-label="Dépense"]')).toHaveCSS('display', 'grid');
    await expect(firstRow.locator('td[data-label="Statut"]')).toBeVisible();
    await expect(firstRow.locator('td[data-label="Action attendue"]')).toBeVisible();
    await expect(firstRow.locator('td[data-label="Ouvrir"] a')).toHaveText('Ouvrir');
  }

  await assertNoHorizontalOverflow(page, {
    label: 'expense list',
    afterResize: async () => expect(table).toBeVisible(),
  });
});

test('project and expense lists distinguish initial, filtered, and unavailable shared states', async ({ page }) => {
  seedEmptyListUser();
  await login(page, 'mjl.phase3d.empty');

  for (const [route, emptyMessage] of [
    ['/custom/mjlfinancement/projects.php', 'Aucun projet dans votre périmètre pour le moment.'],
    ['/custom/mjlfinancement/expenses.php', 'Aucune dépense dans votre périmètre pour le moment.'],
  ]) {
    await page.goto(route);
    await expect(page.locator('.mjl-system-state-initial-empty')).toContainText(emptyMessage);
    await expect(page.locator('[data-mjl-scoped-count]')).toHaveText('0');
  }

  await login(page, 'agent.mjl');
  for (const route of ['/custom/mjlfinancement/projects.php', '/custom/mjlfinancement/expenses.php']) {
    await page.goto(`${route}?partner=999999999`);
    const state = page.locator('.mjl-system-state-filtered-empty');
    await expect(state).toContainText('Aucun résultat');
    await expect(state.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', route);
    await expect(page.locator('[data-mjl-scoped-count]')).toHaveText('0');
  }

  executeSql('RENAME TABLE llx_mjlfinancement_budget_line TO llx_mjlfinancement_budget_line_p3d_list_failure');
  try {
    for (const route of ['/custom/mjlfinancement/projects.php', '/custom/mjlfinancement/expenses.php']) {
      await page.goto(route);
      const state = page.locator('.mjl-system-state-unavailable');
      await expect(state).toContainText('Liste indisponible');
      await expect(state).toContainText('Le service de données est temporairement indisponible.');
      await expect(page.locator('body')).not.toContainText(/SQLSTATE|SELECT |Unknown table|doesn.t exist/i);
    }
  } finally {
    executeSql('RENAME TABLE llx_mjlfinancement_budget_line_p3d_list_failure TO llx_mjlfinancement_budget_line');
  }
});

test('activity correction review uses an authorized same-route action state', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);

  const correctionForm = page.locator('form[data-mjl-form="activity-decision"]', {
    has: page.locator('input[name="action"][value="request_correction"]'),
  });
  await expect(correctionForm).toHaveCount(0);

  const actionLink = page.getByRole('link', { name: 'Retourner pour correction' });
  await expect(actionLink).toHaveAttribute('href', `/custom/mjlfinancement/activities.php?id=${activityId}&action=request_correction`);
  await actionLink.click();

  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${activityId}&action=request_correction$`));
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Retourner l’activité pour correction');
  await expect(correctionForm).toBeVisible();
  await expect(correctionForm.locator('textarea[name="comment"]')).toHaveAttribute('required', '');
  await expect(page.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', `/custom/mjlfinancement/activities.php?id=${activityId}`);
  await assertNoHorizontalOverflow(page, { label: 'activity correction action state' });

  await login(page, 'agent.mjl');
  const denied = await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=request_correction`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('textarea[name="comment"]')).toHaveCount(0);
});

test('activity correction review recovery returns to the guarded substantive state', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=request_correction`);

  const form = page.locator('form[data-mjl-form="activity-decision"]');
  await expect(form).toHaveAttribute('data-mjl-substantive', '');
  const response = await page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'request_correction',
      id: String(activityId),
      comment: '',
    },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  const location = response.headers().location || '';
  expect(location).toMatch(new RegExp(`activities\\.php\\?id=${activityId}&action=request_correction&mjl_recovery=[a-f0-9]{32}$`));
  await page.goto(location);

  await expect(form).toHaveAttribute('data-mjl-recovered', 'true');
  const summary = form.locator('[data-mjl-error-summary]');
  await expect(summary).toContainText('Corrigez les champs indiqués');
  await expect(summary).toBeFocused();
  await expect(form.locator('textarea[name="comment"]')).toHaveAttribute('aria-invalid', 'true');

  await page.getByRole('link', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog', { name: 'Modifications non enregistrées' })).toBeVisible();
});

test('activity verifier decisions leave the default detail and enter guarded action states', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);

  for (const [action, label] of [
    ['prevalidate', 'Prévalider l’activité'],
    ['validate', 'Valider l’activité'],
    ['reject', 'Rejeter l’activité'],
  ]) {
    await expect(page.locator(`form[data-mjl-form="activity-decision"] input[name="action"][value="${action}"]`)).toHaveCount(0);
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', `/custom/mjlfinancement/activities.php?id=${activityId}&action=${action}`);
  }

  await page.getByRole('link', { name: 'Prévalider l’activité' }).click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${activityId}&action=prevalidate$`));
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Prévalider l’activité');
  const form = page.locator('form[data-mjl-form="activity-decision"]');
  await expect(form.locator('input[name="action"]')).toHaveValue('prevalidate');
  await expect(form).toHaveAttribute('data-mjl-substantive', '');
});

test('activity final-validator decisions use guarded action states and reject the verifier role', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 7 WHERE entity = 1 AND rowid = ${activityId}`);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);

  for (const [action, label] of [
    ['final_validate', 'Valider définitivement l’activité'],
    ['validate', 'Valider l’activité'],
    ['reject', 'Rejeter l’activité'],
  ]) {
    await expect(page.locator(`form[data-mjl-form="activity-decision"] input[name="action"][value="${action}"]`)).toHaveCount(0);
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', `/custom/mjlfinancement/activities.php?id=${activityId}&action=${action}`);
  }

  await page.getByRole('link', { name: 'Valider définitivement l’activité' }).click();
  await expect(page).toHaveURL(new RegExp(`activities\\.php\\?id=${activityId}&action=final_validate$`));
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Valider définitivement l’activité');
  await expect(page.locator('form[data-mjl-form="activity-decision"] input[name="action"]')).toHaveValue('final_validate');

  await login(page, 'superviseur.n1');
  const denied = await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=final_validate`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="activity-decision"]')).toHaveCount(0);
});

test('activity guarded review states fail closed for self-review and cross-scope access', async ({ page }) => {
  let activityId = seedActivityActionFixture();
  executeSql(`
    SET @verifier = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' AND entity = 1 LIMIT 1);
    UPDATE llx_mjlfinancement_activity SET fk_user_creat = @verifier WHERE entity = 1 AND rowid = ${activityId};
  `);

  await login(page, 'superviseur.n1');
  let denied = await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=prevalidate`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="activity-decision"]')).toHaveCount(0);

  activityId = seedActivityActionFixture();
  seedScopedActivityReviewer();
  executeSql(`
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-RED-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-RED-2026-001' AND entity = 1 LIMIT 1);
    UPDATE llx_mjlfinancement_activity SET fk_project = @project, fk_convention = @convention WHERE entity = 1 AND rowid = ${activityId};
  `);

  await login(page, 'mjl.phase3d.reviewer');
  denied = await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=prevalidate`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="activity-decision"]')).toHaveCount(0);
});

test('stale activity review denies before recovery consumption and recovery remains one-use', async ({ page }) => {
  const activityId = seedActivityActionFixture();
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}&action=request_correction`);
  const form = page.locator('form[data-mjl-form="activity-decision"]');
  const response = await page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'request_correction',
      id: String(activityId),
      comment: '',
    },
    maxRedirects: 0,
  });
  const recoveryLocation = response.headers().location || '';
  expect(response.status()).toBe(302);
  expect(recoveryLocation).toMatch(/action=request_correction&mjl_recovery=[a-f0-9]{32}$/);

  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 6 WHERE entity = 1 AND rowid = ${activityId}`);
  const denied = await page.goto(recoveryLocation);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('form[data-mjl-form="activity-decision"]')).toHaveCount(0);

  executeSql(`UPDATE llx_mjlfinancement_activity SET status = 3 WHERE entity = 1 AND rowid = ${activityId}`);
  await page.goto(recoveryLocation);
  await expect(form).toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('textarea[name="comment"]')).toHaveAttribute('aria-invalid', 'true');

  await page.goto(recoveryLocation);
  await expect(form).not.toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('textarea[name="comment"]')).not.toHaveAttribute('aria-invalid', 'true');
});

test('expense verifier decisions leave the default detail for a guarded action state', async ({ page }) => {
  const expenseId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-002' AND entity = 1 LIMIT 1"));
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}`);

  for (const [action, label] of [
    ['prevalidate', 'Prévalider la dépense'],
    ['reject', 'Rejeter la dépense'],
  ]) {
    await expect(page.locator(`form input[name="action"][value="${action}"]`)).toHaveCount(0);
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', `/custom/mjlfinancement/expenses.php?id=${expenseId}&action=${action}`);
  }

  await page.getByRole('link', { name: 'Prévalider la dépense' }).click();
  await expect(page).toHaveURL(new RegExp(`expenses\\.php\\?id=${expenseId}&action=prevalidate$`));
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Prévalider la dépense');
  const form = page.locator('form[data-mjl-form="expense-decision"]');
  await expect(form.locator('input[name="action"]')).toHaveValue('prevalidate');
  await expect(form.locator('input[name="expected_status"]')).toHaveValue('1');
  await expect(form).toHaveAttribute('data-mjl-substantive', '');
  await expect(form).not.toHaveAttribute('data-mjl-confirm');
  await expect(page.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', `/custom/mjlfinancement/expenses.php?id=${expenseId}`);
  await assertNoHorizontalOverflow(page, { label: 'expense verifier action state' });
  await form.locator('input[name="prevalidated_amount"]').fill('400000');
  await page.getByRole('link', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog', { name: 'Modifications non enregistrées' })).toBeVisible();
});

test('expense final validation and disbursement use guarded no-modal action states', async ({ page }) => {
  const expenseId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-002' AND entity = 1 LIMIT 1"));
  executeSql(`UPDATE llx_mjlfinancement_expense SET status = 4, prevalidated_amount = amount WHERE entity = 1 AND rowid = ${expenseId}`);

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}`);
  await expect(page.locator('form input[name="action"][value="final_validate"]')).toHaveCount(0);
  const finalLink = page.getByRole('link', { name: 'Valider définitivement la dépense' });
  await expect(finalLink).toHaveAttribute('href', `/custom/mjlfinancement/expenses.php?id=${expenseId}&action=final_validate`);
  await finalLink.click();

  let form = page.locator('form[data-mjl-form="expense-decision"]');
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Valider définitivement la dépense');
  await expect(form.locator('input[name="final_validated_amount"]')).toHaveValue('420000.00000000');
  await expect(form.locator('[data-mjl-consequence]')).toContainText('ne signifie pas que les fonds ont été décaissés');
  await expect(form).not.toHaveAttribute('data-mjl-confirm');

  executeSql(`UPDATE llx_mjlfinancement_expense SET status = 6, final_validated_amount = amount WHERE entity = 1 AND rowid = ${expenseId}`);
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}`);
  await expect(page.locator('form input[name="action"][value="disburse"]')).toHaveCount(0);
  const disburseLink = page.getByRole('link', { name: 'Enregistrer le décaissement' });
  await expect(disburseLink).toHaveAttribute('href', `/custom/mjlfinancement/expenses.php?id=${expenseId}&action=disburse`);
  await disburseLink.click();

  form = page.locator('form[data-mjl-form="expense-decision"]');
  await expect(page.locator('header.mjl-page-header h1')).toHaveText('Enregistrer le décaissement');
  await expect(form.locator('input[name="beneficiary_name"]')).toHaveAttribute('required', '');
  await expect(form.locator('input[name="disbursement_date"]')).toHaveAttribute('required', '');
  await expect(form.locator('[data-mjl-consequence]')).toContainText('confirme que les fonds ont effectivement été versés');
  await expect(form).not.toHaveAttribute('data-mjl-confirm');

  executeSql(`UPDATE llx_mjlfinancement_expense SET status = 1, prevalidated_amount = NULL, final_validated_amount = NULL WHERE entity = 1 AND rowid = ${expenseId}`);
});

test('expense review recovery is guarded before consumption and remains one-use', async ({ page }) => {
  const expenseId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-002' AND entity = 1 LIMIT 1"));
  await login(page, 'superviseur.n1');
  await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}&action=reject`);
  const form = page.locator('form[data-mjl-form="expense-decision"]');
  const response = await page.request.post(`/custom/mjlfinancement/expenses.php?id=${expenseId}`, {
    form: {
      token: await form.locator('input[name="token"]').inputValue(),
      action: 'reject',
      id: String(expenseId),
      expected_status: '1',
      comment: '',
    },
    maxRedirects: 0,
  });
  const recoveryLocation = response.headers().location || '';
  expect(response.status()).toBe(302);
  expect(recoveryLocation).toMatch(new RegExp(`expenses\\.php\\?id=${expenseId}&action=reject&mjl_recovery=[a-f0-9]{32}$`));

  executeSql(`UPDATE llx_mjlfinancement_expense SET status = 4, prevalidated_amount = amount WHERE entity = 1 AND rowid = ${expenseId}`);
  const denied = await page.goto(recoveryLocation);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('form[data-mjl-form="expense-decision"]')).toHaveCount(0);

  restoreExpenseDecisionSample();
  await page.goto(recoveryLocation);
  await expect(form).toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('[data-mjl-error-summary]')).toBeFocused();
  await expect(form.locator('textarea[name="comment"]')).toHaveAttribute('aria-invalid', 'true');

  await page.goto(recoveryLocation);
  await expect(form).not.toHaveAttribute('data-mjl-recovered', 'true');
  await expect(form.locator('textarea[name="comment"]')).not.toHaveAttribute('aria-invalid', 'true');

  await login(page, 'agent.mjl');
  const wrongRole = await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}&action=reject`);
  expect([200, 403]).toContain(wrongRole.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="expense-decision"]')).toHaveCount(0);
});

test('expense guarded action states fail closed for self-review and cross-scope access', async ({ page }) => {
  const expenseId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE ref = 'EXP-JE-002' AND entity = 1 LIMIT 1"));
  executeSql(`
    SET @verifier = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' AND entity = 1 LIMIT 1);
    UPDATE llx_mjlfinancement_expense SET fk_user_creat = @verifier WHERE entity = 1 AND rowid = ${expenseId};
  `);

  await login(page, 'superviseur.n1');
  let denied = await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}&action=prevalidate`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="expense-decision"]')).toHaveCount(0);

  restoreExpenseDecisionSample();
  seedScopedActivityReviewer();
  executeSql(`
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-RED-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-RED-2026-001' AND entity = 1 LIMIT 1);
    SET @activity = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'ACT-RED-002' AND entity = 1 LIMIT 1);
    SET @budget_line = (SELECT rowid FROM llx_mjlfinancement_budget_line WHERE ref = 'BL-RED-002' AND entity = 1 LIMIT 1);
    UPDATE llx_mjlfinancement_expense
    SET fk_project = @project, fk_convention = @convention, fk_mjl_activity = @activity, fk_budget_line = @budget_line
    WHERE entity = 1 AND rowid = ${expenseId};
  `);

  await login(page, 'mjl.phase3d.reviewer');
  denied = await page.goto(`/custom/mjlfinancement/expenses.php?id=${expenseId}&action=prevalidate`);
  expect([200, 403]).toContain(denied.status());
  await expect(page.locator('body')).toContainText(/Access denied|Accès refusé/);
  await expect(page.locator('form[data-mjl-form="expense-decision"]')).toHaveCount(0);
});

test('shared operational filters reflow without local overflow at review widths', async ({ page }) => {
  await login(page, 'agent.mjl');
  for (const [route, resource] of [
    ['/custom/mjlfinancement/projects.php', 'projects'],
    ['/custom/mjlfinancement/activities.php', 'activities'],
    ['/custom/mjlfinancement/expenses.php', 'expenses'],
  ]) {
    await page.goto(route);
    const filters = page.locator(`form[data-mjl-table-filters="${resource}"]`);
    for (const width of [390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(filters).toBeVisible();
      const geometry = await filters.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(geometry.scrollWidth, `${resource} filters at ${width}px`).toBeLessThanOrEqual(geometry.clientWidth);
      await expect(filters.locator('.mjl-filter-summary')).toBeVisible();
    }
  }
});
