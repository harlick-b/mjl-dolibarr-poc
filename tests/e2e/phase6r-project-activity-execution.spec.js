const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const deniedPattern = /Acces refuse|Accès refusé|Access denied|Forbidden|Non autorise|Non autorisé|hors de votre perimetre|hors de votre périmètre/i;

test.describe.configure({ mode: 'serial' });

function dockerExec(command) {
  return execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
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

async function pageToken(page) {
  const tokenInput = page.locator('input[name="token"]').first();
  if (await tokenInput.count()) {
    const token = await tokenInput.getAttribute('value');
    if (token) return token;
  }
  const metaToken = await page.locator('meta[name="anti-csrf-newtoken"]').getAttribute('content');
  expect(metaToken).toBeTruthy();
  return metaToken;
}

async function postActivity(page, activityId, form) {
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  const token = await pageToken(page);
  return page.request.post(`/custom/mjlfinancement/activities.php?id=${activityId}`, {
    form: { token, id: String(activityId), ...form },
    maxRedirects: 0,
  });
}

async function expectOptionDisabled(page, selectName, text) {
  const disabled = await page.locator(`select[name="${selectName}"] option`, { hasText: text }).evaluate((option) => option.disabled);
  expect(disabled).toBe(true);
}

function cleanupPhase6R() {
  sql(`
    SET @p6r_activities = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'P6R-%');
    SET @p6r_projects = (SELECT GROUP_CONCAT(rowid) FROM llx_projet WHERE ref LIKE 'P6R-%');
    DELETE FROM llx_mjlfinancement_workflow_action WHERE (object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@p6r_activities, ''))) OR (object_type = 'mjlfinancement_project' AND FIND_IN_SET(object_id, COALESCE(@p6r_projects, '')));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P6R-%';
    DELETE FROM llx_projet WHERE ref LIKE 'P6R-%';
  `);
}

function seedPhase6R() {
  sql(`
    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @verifier = (SELECT rowid FROM llx_user WHERE login = 'superviseur.n1' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P6R-EXEC', 'Activite Phase 6R execution', @project, @convention, '2026-06-20', '2026-07-20', NOW(), @agent, 'P6REXEC', 0),
      (1, 'P6R-LATE', 'Activite Phase 6R en retard', @project, @convention, '2026-06-20', '2026-07-01', NOW(), @agent, 'P6RLATE', 0),
      (1, 'P6R-SELF', 'Activite Phase 6R no self', @project, @convention, '2026-06-20', '2026-07-15', NOW(), @verifier, 'P6RSELF', 3);
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase6R();
  seedPhase6R();
});

test.afterAll(() => {
  cleanupPhase6R();
});

test('P6R project create/edit is allowed for admin and final validator but denied to agent', async ({ page }) => {
  const unicef = scalar("SELECT rowid FROM llx_societe WHERE nom = 'UNICEF' AND entity = 1 LIMIT 1");

  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/projects.php');
  await page.getByLabel('Reference').first().fill('P6R-DPAF-PROJ');
  await page.getByLabel('Intitule').first().fill('Projet Phase 6R DPAF');
  await page.locator('select[name="fk_soc"]').first().selectOption(unicef);
  await page.getByRole('button', { name: 'Creer le projet' }).click();
  await expect(page).toHaveURL(/projects\.php\?id=\d+/);
  const projectId = Number(new URL(page.url()).searchParams.get('id'));
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_project' AND object_id = ${projectId} AND action = 'created' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBe(1);

  await page.getByLabel('Intitule').fill('Projet Phase 6R DPAF modifie');
  await page.getByRole('button', { name: 'Enregistrer le projet' }).click();
  expect(scalar(`SELECT title FROM llx_projet WHERE rowid = ${projectId}`)).toBe('Projet Phase 6R DPAF modifie');

  await login(page, 'admin.poc');
  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}`);
  await page.getByLabel('Reference').fill('P6R-ADMIN-PROJ');
  await page.getByRole('button', { name: 'Enregistrer le projet' }).click();
  expect(scalar(`SELECT ref FROM llx_projet WHERE rowid = ${projectId}`)).toBe('P6R-ADMIN-PROJ');

  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/projects.php');
  await expect(page.getByRole('button', { name: 'Creer le projet' })).toHaveCount(0);
  const token = await pageToken(page);
  const response = await page.request.post('/custom/mjlfinancement/projects.php', {
    form: { token, action: 'create', ref: 'P6R-FORBIDDEN', title: 'Projet interdit', fk_soc: unicef },
  });
  expect(await response.text()).toMatch(deniedPattern);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_projet WHERE ref = 'P6R-FORBIDDEN' AND entity = 1"))).toBe(0);
});

test('P6R activity options are scoped and mismatched project/convention POST is rejected', async ({ page }) => {
  await login(page, 'agent.mjl');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.locator('select[name="fk_project"]')).toContainText('PRJ-JE-2026');
  await expect(page.locator('select[name="fk_convention"]')).toContainText('CONV-UNICEF-2026-001');
  await page.locator('select[name="fk_project"]').selectOption(scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1"));
  await expectOptionDisabled(page, 'fk_convention', 'CONV-RED-2026-001');
  await expectOptionDisabled(page, 'fk_task', 'ACT-RED-001');

  const token = await page.locator('form:has(input[name="action"][value="create"]) input[name="token"]').getAttribute('value');
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const redConvention = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-RED-2026-001' AND entity = 1 LIMIT 1");
  const response = await page.request.post('/custom/mjlfinancement/activities.php', {
    form: { token, action: 'create', ref: 'P6R-TAMPER', label: 'Activite Phase 6R incoherente', fk_project: projectId, fk_convention: redConvention },
    maxRedirects: 0,
  });
  expect([302, 403]).toContain(response.status());
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE ref = 'P6R-TAMPER' AND entity = 1"))).toBe(0);
});

test('P6R update_execution updates only execution fields and writes production audit role', async ({ page }) => {
  const activityId = scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P6R-EXEC' AND entity = 1 LIMIT 1");
  const beforeStatus = scalar(`SELECT status FROM llx_mjlfinancement_activity WHERE rowid = ${activityId}`);

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  await page.getByLabel('Execution physique (%)').fill('80');
  await page.locator('select[name="execution_status"]').selectOption('in_progress');
  await page.getByLabel('Commentaire execution').fill('Avancement Phase 6R');
  await page.getByRole('button', { name: 'Mettre a jour l execution' }).click();

  await expect(page.locator('body')).toContainText('80% - Partiellement exécutée');
  expect(scalar(`SELECT status FROM llx_mjlfinancement_activity WHERE rowid = ${activityId}`)).toBe(beforeStatus);
  expect(scalar(`SELECT physical_execution_percent FROM llx_mjlfinancement_activity WHERE rowid = ${activityId}`)).toBe('80');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'execution_updated' AND actor_role = 'AGENT_SAISIE'`))).toBe(1);

  await postActivity(page, activityId, { action: 'update_execution', physical_execution_percent: '150', execution_status: 'in_progress', execution_comment: 'bad' });
  expect(scalar(`SELECT physical_execution_percent FROM llx_mjlfinancement_activity WHERE rowid = ${activityId}`)).toBe('80');

  await postActivity(page, activityId, { action: 'update_execution', physical_execution_percent: '80', execution_status: 'completed', execution_comment: '' });
  expect(scalar(`SELECT execution_status FROM llx_mjlfinancement_activity WHERE rowid = ${activityId}`)).toBe('in_progress');

  await postActivity(page, activityId, { action: 'update_execution', physical_execution_percent: '10', execution_status: 'not_started', execution_comment: '' });
  expect(scalar(`SELECT execution_status FROM llx_mjlfinancement_activity WHERE rowid = ${activityId}`)).toBe('in_progress');
});

test('P6R project and dashboard execution KPIs reflect execution update and late alert is visible', async ({ page }) => {
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1");
  const projectKpi = scalar(`SELECT ROUND(COALESCE(AVG(physical_execution_percent), 0)) FROM llx_mjlfinancement_activity WHERE entity = 1 AND fk_project = ${projectId} AND physical_execution_percent IS NOT NULL`);
  const dashboardKpi = scalar("SELECT ROUND(COALESCE(AVG(physical_execution_percent), 0)) FROM llx_mjlfinancement_activity WHERE entity = 1 AND physical_execution_percent IS NOT NULL");

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}`);
  await expect(page.locator('body')).toContainText('Execution physique');
  await expect(page.locator('body')).toContainText(`${projectKpi}%`);
  await expect(page.locator('body')).toContainText('P6R-LATE');
  await expect(page.locator('body')).toContainText('En retard');

  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.locator('body')).toContainText('Execution physique');
  await expect(page.locator('body')).toContainText(`${dashboardKpi}%`);

  await page.goto('/custom/mjlfinancement/alerts.php');
  await expect(page.locator('body')).toContainText('P6R-LATE');
  await expect(page.locator('body')).toContainText('En retard');
});

test('P6R no-self-prevalidation still holds after execution work', async ({ page }) => {
  const activityId = scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P6R-SELF' AND entity = 1 LIMIT 1");
  await login(page, 'superviseur.n1');
  const response = await postActivity(page, activityId, { action: 'prevalidate', comment: 'Tentative no self Phase 6R' });
  expect([302, 403]).toContain(response.status());
  expect(scalar(`SELECT status FROM llx_mjlfinancement_activity WHERE rowid = ${activityId}`)).toBe('3');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'prevalidated'`))).toBe(0);
});
