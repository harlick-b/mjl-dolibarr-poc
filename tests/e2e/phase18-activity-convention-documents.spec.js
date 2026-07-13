const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const forbiddenResponsePattern = /Acces refuse|Accès refusé|Acc&egrave;s refus&eacute;|Access denied|Forbidden|Non autorise|Non autorisé|Non autoris&eacute;/;

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

async function expectAccessDenied(page) {
  await expect(page.locator('body')).toContainText(forbiddenResponsePattern);
}

async function expectDownload(page, href, expectedText) {
  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-disposition']).toContain('attachment');
  expect(await response.text()).toContain(expectedText);
}

async function expectForbiddenDownload(page, href) {
  const response = await page.request.get(href);
  expect(response.status()).toBe(403);
}

function cleanupPhase18Fixtures() {
  sql(`
    SET @phase18_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.phase18.otheragent');
    SET @phase18_activities = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'P18-%');
    SET @phase18_conventions = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_convention WHERE ref LIKE 'P18-%');
    DELETE FROM llx_ecm_files WHERE ref LIKE 'P18-%' OR (src_object_type = 'mjlfinancement_activity' AND FIND_IN_SET(src_object_id, COALESCE(@phase18_activities, ''))) OR (src_object_type = 'mjlfinancement_convention' AND FIND_IN_SET(src_object_id, COALESCE(@phase18_conventions, '')));
    DELETE FROM llx_mjlfinancement_workflow_action WHERE (object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@phase18_activities, ''))) OR (object_type = 'mjlfinancement_convention' AND FIND_IN_SET(object_id, COALESCE(@phase18_conventions, '')));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'P18-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'P18-%';
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE fk_user = @phase18_user;
    DELETE FROM llx_mjlfinancement_user_role WHERE fk_user = @phase18_user;
    DELETE FROM llx_usergroup_user WHERE fk_user = @phase18_user;
    DELETE FROM llx_user WHERE rowid = @phase18_user;
  `);
}

function seedPhase18Fixtures() {
  sql(`
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.phase18.otheragent', 'Phase18', 'Autre', 'mjl.phase18.otheragent@mjl-poc.local', pass_crypted, 1, 0, NOW()
    FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @other_agent = LAST_INSERT_ID();
    SET @agent_group = (SELECT rowid FROM llx_usergroup WHERE nom = 'MJL POC - Agent' AND entity = 1 LIMIT 1);
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @other_agent, @agent_group);

    SET @agent = (SELECT rowid FROM llx_user WHERE login = 'agent.mjl' LIMIT 1);
    SET @admin = (SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1);
    SET @project = (SELECT rowid FROM llx_projet WHERE ref = 'PRJ-JE-2026' AND entity = 1 LIMIT 1);
    SET @convention = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'CONV-UNICEF-2026-001' AND entity = 1 LIMIT 1);
    SET @ptf = (SELECT fk_soc FROM llx_mjlfinancement_convention WHERE rowid = @convention);

    INSERT INTO llx_mjlfinancement_activity (entity, ref, label, fk_project, fk_convention, date_start, date_end, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P18-ACT-OWNER', 'Activite document agent', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'P18ACTOWNER', 0),
      (1, 'P18-ACT-DPAF', 'Activite document DPAF', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'P18ACTDPAF', 0),
      (1, 'P18-ACT-READY', 'Activite document disponible', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'P18ACTREADY', 0),
      (1, 'P18-ACT-UNAVAILABLE', 'Activite document indisponible', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'P18ACTUNAV', 0),
      (1, 'P18-ACT-MISSING', 'Activite document manquant', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'P18ACTMISS', 0),
      (2, 'P18-ACT-CROSS', 'Activite autre entite', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'P18ACTCROSS', 0);

    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'P18-CONV-UPLOAD', 'Convention document upload', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'P18CONVUP', 1),
      (1, 'P18-CONV-READY', 'Convention document disponible', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'P18CONVREADY', 1),
      (1, 'P18-CONV-UNAVAILABLE', 'Convention document indisponible', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'P18CONVUNAV', 1),
      (1, 'P18-CONV-MISSING', 'Convention document manquant', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'P18CONVMISS', 1),
      (1, 'P18-CONV-CLOSED', 'Convention document cloturee', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'P18CONVCLOSE', 2),
      (2, 'P18-CONV-CROSS', 'Convention autre entite', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'P18CONVCROSS', 1);

    SET @act_ready = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P18-ACT-READY' AND entity = 1);
    SET @act_unavailable = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P18-ACT-UNAVAILABLE' AND entity = 1);
    SET @act_cross = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P18-ACT-CROSS' AND entity = 2);
    SET @conv_ready = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P18-CONV-READY' AND entity = 1);
    SET @conv_unavailable = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P18-CONV-UNAVAILABLE' AND entity = 1);
    SET @conv_cross = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P18-CONV-CROSS' AND entity = 2);

    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES
      ('P18-ACT-READY', 'P18-ACT-READY.txt', 1, 'P18-ACT-READY.txt', 'mjlfinancement_activity', 'P18-ACT-READY.txt', 'Document activite Phase 18', 1, NOW(), @admin, 'mjlfinancement_activity', @act_ready),
      ('P18-ACT-UNAVAILABLE', 'P18-ACT-UNAVAILABLE.txt', 1, 'P18-ACT-UNAVAILABLE.txt', 'mjlfinancement_activity', 'P18-ACT-UNAVAILABLE.txt', 'Document activite absent Phase 18', 1, NOW(), @admin, 'mjlfinancement_activity', @act_unavailable),
      ('P18-ACT-CROSS', 'P18-ACT-CROSS.txt', 2, 'P18-ACT-CROSS.txt', 'mjlfinancement_activity', 'P18-ACT-CROSS.txt', 'Document autre entite Phase 18', 1, NOW(), @admin, 'mjlfinancement_activity', @act_cross),
      ('P18-ACT-ORPHAN', 'P18-ACT-ORPHAN.txt', 1, 'P18-ACT-ORPHAN.txt', 'mjlfinancement_activity', 'P18-ACT-ORPHAN.txt', 'Document orphelin Phase 18', 1, NOW(), @admin, 'mjlfinancement_activity', 99999999),
      ('P18-ACT-POISON', 'P18-ACT-POISON.txt', 1, '../P18-ACT-POISON.txt', 'mjlfinancement_activity', 'P18-ACT-POISON.txt', 'Document chemin refuse Phase 18', 1, NOW(), @admin, 'mjlfinancement_activity', @act_ready),
      ('P18-CONV-READY', 'P18-CONV-READY.txt', 1, 'P18-CONV-READY.txt', 'mjlfinancement_convention', 'P18-CONV-READY.txt', 'Document convention Phase 18', 1, NOW(), @admin, 'mjlfinancement_convention', @conv_ready),
      ('P18-CONV-UNAVAILABLE', 'P18-CONV-UNAVAILABLE.txt', 1, 'P18-CONV-UNAVAILABLE.txt', 'mjlfinancement_convention', 'P18-CONV-UNAVAILABLE.txt', 'Document convention absent Phase 18', 1, NOW(), @admin, 'mjlfinancement_convention', @conv_unavailable),
      ('P18-CONV-CROSS', 'P18-CONV-CROSS.txt', 2, 'P18-CONV-CROSS.txt', 'mjlfinancement_convention', 'P18-CONV-CROSS.txt', 'Document convention autre entite Phase 18', 1, NOW(), @admin, 'mjlfinancement_convention', @conv_cross),
      ('P18-CONV-ORPHAN', 'P18-CONV-ORPHAN.txt', 1, 'P18-CONV-ORPHAN.txt', 'mjlfinancement_convention', 'P18-CONV-ORPHAN.txt', 'Document convention orphelin Phase 18', 1, NOW(), @admin, 'mjlfinancement_convention', 99999999),
      ('P18-CONV-POISON', 'P18-CONV-POISON.txt', 1, '../P18-CONV-POISON.txt', 'mjlfinancement_convention', 'P18-CONV-POISON.txt', 'Document convention chemin refuse Phase 18', 1, NOW(), @admin, 'mjlfinancement_convention', @conv_ready);
  `);
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_activity /var/www/documents/ecm/mjlfinancement_convention && chmod 0777 /var/www/documents/ecm/mjlfinancement_activity /var/www/documents/ecm/mjlfinancement_convention && printf "%s" "Phase 18 activity ready" > /var/www/documents/ecm/mjlfinancement_activity/P18-ACT-READY.txt && printf "%s" "Phase 18 activity cross" > /var/www/documents/ecm/mjlfinancement_activity/P18-ACT-CROSS.txt && printf "%s" "Phase 18 convention ready" > /var/www/documents/ecm/mjlfinancement_convention/P18-CONV-READY.txt && printf "%s" "Phase 18 convention cross" > /var/www/documents/ecm/mjlfinancement_convention/P18-CONV-CROSS.txt && chmod 0666 /var/www/documents/ecm/mjlfinancement_activity/P18-ACT-READY.txt /var/www/documents/ecm/mjlfinancement_activity/P18-ACT-CROSS.txt /var/www/documents/ecm/mjlfinancement_convention/P18-CONV-READY.txt /var/www/documents/ecm/mjlfinancement_convention/P18-CONV-CROSS.txt\'');
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase18Fixtures();
  seedPhase18Fixtures();
});

test.afterAll(() => {
  cleanupPhase18Fixtures();
});

test('Activity creator uploads and downloads a direct activity document', async ({ page }) => {
  const activityId = scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P18-ACT-OWNER' AND entity = 1");
  const tmpFile = path.join(os.tmpdir(), `p18-activity-owner-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Phase 18 creator activity document');

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  await expect(page.getByRole('heading', { name: 'Documents de l activite' })).toBeVisible();
  await expect(page.getByText('Manquante').first()).toBeVisible();

  await page.setInputFiles('input[name="supporting_document"]', tmpFile);
  await page.getByRole('button', { name: 'Ajouter le document' }).click();
  await expect(page.getByText('Disponible').first()).toBeVisible();
  await expect(page.getByText('Document ajoute a l activite')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Brouillon vers Brouillon');
  const href = await page.getByRole('link', { name: 'Telecharger le document' }).first().getAttribute('href');
  await expectDownload(page, href, 'Phase 18 creator activity document');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'document_uploaded'`))).toBe(1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'document_downloaded' AND actor_role = 'AGENT_SAISIE'`))).toBe(1);
});

test('DPAF uploads and downloads an activity document without activity write', async ({ page }) => {
  const activityId = scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'P18-ACT-DPAF' AND entity = 1");
  const tmpFile = path.join(os.tmpdir(), `p18-activity-dpaf-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Phase 18 DPAF activity document');

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  await page.setInputFiles('input[name="supporting_document"]', tmpFile);
  await page.getByRole('button', { name: 'Ajouter le document' }).click();
  await expect(page.getByText('Disponible').first()).toBeVisible();
  const href = await page.getByRole('link', { name: 'Telecharger le document' }).first().getAttribute('href');
  await expectDownload(page, href, 'Phase 18 DPAF activity document');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'document_uploaded' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBe(1);
});

test('Activity direct downloads deny unrelated Level 1, cross-entity, orphan, and path-tampered ECM rows', async ({ page }) => {
  const readyFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P18-ACT-READY' AND entity = 1");
  const crossFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P18-ACT-CROSS' AND entity = 2");
  const orphanFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P18-ACT-ORPHAN' AND entity = 1");
  const poisonFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P18-ACT-POISON' AND entity = 1");

  await login(page, 'mjl.phase18.otheragent');
  await expectForbiddenDownload(page, `/custom/mjlfinancement/documentdownload.php?type=activity&id=${readyFileId}`);

  await login(page, 'dpaf.mjl');
  for (const fileId of [crossFileId, orphanFileId, poisonFileId]) {
    await expectForbiddenDownload(page, `/custom/mjlfinancement/documentdownload.php?type=activity&id=${fileId}`);
  }
});

test('Activity document states show available, unavailable, and missing labels', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  for (const [ref, label] of [
    ['P18-ACT-READY', 'Disponible'],
    ['P18-ACT-UNAVAILABLE', 'Référence indisponible'],
    ['P18-ACT-MISSING', 'Manquante'],
  ]) {
    const activityId = scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = '${ref}' AND entity = 1`);
    await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
    const panel = page.getByRole('heading', { name: 'Documents de l activite' }).locator('xpath=ancestor::section[1]');
    await expect(panel).toContainText(label);
  }
});

test('DPAF uploads and downloads convention documents; normal users are denied direct convention downloads', async ({ page }) => {
  const conventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P18-CONV-UPLOAD' AND entity = 1");
  const tmpFile = path.join(os.tmpdir(), `p18-convention-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Phase 18 convention document');

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/conventions.php?id=${conventionId}`);
  await page.setInputFiles('input[name="supporting_document"]', tmpFile);
  await page.getByRole('button', { name: 'Ajouter le document' }).click();
  await expect(page.getByText('Disponible').first()).toBeVisible();
  await expect(page.getByText('Document ajoute a l enveloppe')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Active vers Active');
  await page.reload();
  const fileId = scalar(`SELECT rowid FROM llx_ecm_files WHERE entity = 1 AND src_object_type = 'mjlfinancement_convention' AND src_object_id = ${conventionId} ORDER BY rowid DESC LIMIT 1`);
  const href = `/custom/mjlfinancement/documentdownload.php?type=convention&id=${fileId}`;
  await expectDownload(page, href, 'Phase 18 convention document');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_convention' AND object_id = ${conventionId} AND action = 'document_uploaded'`))).toBe(1);

  await login(page, 'agent.mjl');
  await expectForbiddenDownload(page, href);
});

test('Convention direct downloads deny cross-entity, orphan, and path-tampered ECM rows', async ({ page }) => {
  const crossFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P18-CONV-CROSS' AND entity = 2");
  const orphanFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P18-CONV-ORPHAN' AND entity = 1");
  const poisonFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'P18-CONV-POISON' AND entity = 1");

  await login(page, 'dpaf.mjl');
  for (const fileId of [crossFileId, orphanFileId, poisonFileId]) {
    await expectForbiddenDownload(page, `/custom/mjlfinancement/documentdownload.php?type=convention&id=${fileId}`);
  }
});

test('Convention document states show available, unavailable, and missing labels; closed conventions block uploads', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  for (const [ref, label] of [
    ['P18-CONV-READY', 'Disponible'],
    ['P18-CONV-UNAVAILABLE', 'Référence indisponible'],
    ['P18-CONV-MISSING', 'Manquante'],
  ]) {
    const conventionId = scalar(`SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = '${ref}' AND entity = 1`);
    await page.goto(`/custom/mjlfinancement/conventions.php?id=${conventionId}`);
    const panel = page.getByRole('heading', { name: 'Documents enveloppe' }).locator('xpath=ancestor::section[1]');
    await expect(panel).toContainText(label);
  }

  const closedId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'P18-CONV-CLOSED' AND entity = 1");
  await page.goto(`/custom/mjlfinancement/conventions.php?id=${closedId}`);
  await expect(page.locator('input[name="supporting_document"]')).toHaveCount(0);
});

test('Workflow audit, DPAF dashboard, and reports label document uploads explicitly', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/workflowactions.php?workflow_action=document_uploaded');
  await expect(page.getByText('Document ajoute').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByText('Document ajouté').first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/reports.php?report=workflow_actions');
  await expect(page.getByText('Document ajoute').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('document_uploaded');
});
