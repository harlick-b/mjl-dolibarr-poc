const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

function cleanupDocumentLifecycleFixtures() {
  sql(`
    SET @document_lifecycle_user = (SELECT rowid FROM llx_user WHERE login = 'mjl.document_lifecycle.otheragent');
    SET @document_lifecycle_activities = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_activity WHERE ref LIKE 'DOC-%');
    SET @document_lifecycle_conventions = (SELECT GROUP_CONCAT(rowid) FROM llx_mjlfinancement_convention WHERE ref LIKE 'DOC-%');
    DELETE FROM llx_ecm_files WHERE ref LIKE 'DOC-%' OR (src_object_type = 'mjlfinancement_activity' AND FIND_IN_SET(src_object_id, COALESCE(@document_lifecycle_activities, ''))) OR (src_object_type = 'mjlfinancement_convention' AND FIND_IN_SET(src_object_id, COALESCE(@document_lifecycle_conventions, '')));
    DELETE FROM llx_mjlfinancement_workflow_action WHERE (object_type = 'mjlfinancement_activity' AND FIND_IN_SET(object_id, COALESCE(@document_lifecycle_activities, ''))) OR (object_type = 'mjlfinancement_convention' AND FIND_IN_SET(object_id, COALESCE(@document_lifecycle_conventions, '')));
    DELETE FROM llx_mjlfinancement_activity WHERE ref LIKE 'DOC-%';
    DELETE FROM llx_mjlfinancement_convention WHERE ref LIKE 'DOC-%';
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE fk_user = @document_lifecycle_user;
    DELETE FROM llx_mjlfinancement_user_role WHERE fk_user = @document_lifecycle_user;
    DELETE FROM llx_usergroup_user WHERE fk_user = @document_lifecycle_user;
    DELETE FROM llx_user WHERE rowid = @document_lifecycle_user;
  `);
}

function seedDocumentLifecycleFixtures() {
  sql(`
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
    SELECT 1, 'mjl.document_lifecycle.otheragent', 'DocumentLifecycle', 'Autre', 'mjl.document_lifecycle.otheragent@mjl-poc.local', pass_crypted, 1, 0, NOW()
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
      (1, 'DOC-ACT-OWNER', 'Activite document agent', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'DOCACTOWNER', 0),
      (1, 'DOC-ACT-FINAL', 'Activite document Final validator', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'DOCACTFINAL', 0),
      (1, 'DOC-ACT-READY', 'Activite document disponible', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'DOCACTREADY', 0),
      (1, 'DOC-ACT-UNAVAILABLE', 'Activite document indisponible', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'DOCACTUNAV', 0),
      (1, 'DOC-ACT-MISSING', 'Activite document manquant', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'DOCACTMISS', 0),
      (2, 'DOC-ACT-CROSS', 'Activite autre entite', @project, @convention, '2026-07-01', '2026-07-15', NOW(), @agent, 'DOCACTCROSS', 0);

    INSERT INTO llx_mjlfinancement_convention (entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, date_creation, fk_user_creat, import_key, status)
    VALUES
      (1, 'DOC-CONV-UPLOAD', 'Convention document upload', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'DOCCONVUP', 1),
      (1, 'DOC-CONV-READY', 'Convention document disponible', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'DOCCONVREADY', 1),
      (1, 'DOC-CONV-UNAVAILABLE', 'Convention document indisponible', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'DOCCONVUNAV', 1),
      (1, 'DOC-CONV-MISSING', 'Convention document manquant', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'DOCCONVMISS', 1),
      (1, 'DOC-CONV-CLOSED', 'Convention document cloturee', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'DOCCONVCLOSE', 2),
      (2, 'DOC-CONV-CROSS', 'Convention autre entite', @ptf, @project, '2026-07-01', '2026-12-31', 100000, 'XOF', NOW(), @admin, 'DOCCONVCROSS', 1);

    SET @act_ready = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'DOC-ACT-READY' AND entity = 1);
    SET @act_unavailable = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'DOC-ACT-UNAVAILABLE' AND entity = 1);
    SET @act_cross = (SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'DOC-ACT-CROSS' AND entity = 2);
    SET @conv_ready = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'DOC-CONV-READY' AND entity = 1);
    SET @conv_unavailable = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'DOC-CONV-UNAVAILABLE' AND entity = 1);
    SET @conv_cross = (SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'DOC-CONV-CROSS' AND entity = 2);

    INSERT INTO llx_ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)
    VALUES
      ('DOC-ACT-READY', 'DOC-ACT-READY.txt', 1, 'DOC-ACT-READY.txt', 'mjlfinancement_activity', 'DOC-ACT-READY.txt', 'Document activite Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_activity', @act_ready),
      ('DOC-ACT-UNAVAILABLE', 'DOC-ACT-UNAVAILABLE.txt', 1, 'DOC-ACT-UNAVAILABLE.txt', 'mjlfinancement_activity', 'DOC-ACT-UNAVAILABLE.txt', 'Document activite absent Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_activity', @act_unavailable),
      ('DOC-ACT-CROSS', 'DOC-ACT-CROSS.txt', 2, 'DOC-ACT-CROSS.txt', 'mjlfinancement_activity', 'DOC-ACT-CROSS.txt', 'Document autre entite Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_activity', @act_cross),
      ('DOC-ACT-ORPHAN', 'DOC-ACT-ORPHAN.txt', 1, 'DOC-ACT-ORPHAN.txt', 'mjlfinancement_activity', 'DOC-ACT-ORPHAN.txt', 'Document orphelin Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_activity', 99999999),
      ('DOC-ACT-POISON', 'DOC-ACT-POISON.txt', 1, '../DOC-ACT-POISON.txt', 'mjlfinancement_activity', 'DOC-ACT-POISON.txt', 'Document chemin refuse Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_activity', @act_ready),
      ('DOC-CONV-READY', 'DOC-CONV-READY.txt', 1, 'DOC-CONV-READY.txt', 'mjlfinancement_convention', 'DOC-CONV-READY.txt', 'Document convention Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_convention', @conv_ready),
      ('DOC-CONV-UNAVAILABLE', 'DOC-CONV-UNAVAILABLE.txt', 1, 'DOC-CONV-UNAVAILABLE.txt', 'mjlfinancement_convention', 'DOC-CONV-UNAVAILABLE.txt', 'Document convention absent Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_convention', @conv_unavailable),
      ('DOC-CONV-CROSS', 'DOC-CONV-CROSS.txt', 2, 'DOC-CONV-CROSS.txt', 'mjlfinancement_convention', 'DOC-CONV-CROSS.txt', 'Document convention autre entite Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_convention', @conv_cross),
      ('DOC-CONV-ORPHAN', 'DOC-CONV-ORPHAN.txt', 1, 'DOC-CONV-ORPHAN.txt', 'mjlfinancement_convention', 'DOC-CONV-ORPHAN.txt', 'Document convention orphelin Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_convention', 99999999),
      ('DOC-CONV-POISON', 'DOC-CONV-POISON.txt', 1, '../DOC-CONV-POISON.txt', 'mjlfinancement_convention', 'DOC-CONV-POISON.txt', 'Document convention chemin refuse Document lifecycle', 1, NOW(), @admin, 'mjlfinancement_convention', @conv_ready);
  `);
  dockerExec('dolibarr sh -lc \'mkdir -p /var/www/documents/ecm/mjlfinancement_activity /var/www/documents/ecm/mjlfinancement_convention && chmod 0777 /var/www/documents/ecm/mjlfinancement_activity /var/www/documents/ecm/mjlfinancement_convention && printf "%s" "Document lifecycle activity ready" > /var/www/documents/ecm/mjlfinancement_activity/DOC-ACT-READY.txt && printf "%s" "Document lifecycle activity cross" > /var/www/documents/ecm/mjlfinancement_activity/DOC-ACT-CROSS.txt && printf "%s" "Document lifecycle convention ready" > /var/www/documents/ecm/mjlfinancement_convention/DOC-CONV-READY.txt && printf "%s" "Document lifecycle convention cross" > /var/www/documents/ecm/mjlfinancement_convention/DOC-CONV-CROSS.txt && chmod 0666 /var/www/documents/ecm/mjlfinancement_activity/DOC-ACT-READY.txt /var/www/documents/ecm/mjlfinancement_activity/DOC-ACT-CROSS.txt /var/www/documents/ecm/mjlfinancement_convention/DOC-CONV-READY.txt /var/www/documents/ecm/mjlfinancement_convention/DOC-CONV-CROSS.txt\'');
}

test.beforeAll(() => {
  cleanupDocumentLifecycleFixtures();
  seedDocumentLifecycleFixtures();
});

test.afterAll(() => {
  cleanupDocumentLifecycleFixtures();
});

test('Activity creator uploads and downloads a direct activity document', async ({ page }) => {
  const activityId = scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'DOC-ACT-OWNER' AND entity = 1");
  const tmpFile = path.join(os.tmpdir(), `document-activity-owner-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Document lifecycle creator activity document');

  await login(page, 'agent.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  await expect(page.getByRole('heading', { name: 'Documents de l’activité' })).toBeVisible();
  await expect(page.getByText('Manquante').first()).toBeVisible();

  await page.getByRole('link', { name: 'Ajouter un document' }).click();
  await expect(page.locator('body')).not.toContainText('Ajoutéz');
  await page.setInputFiles('input[name="supporting_document"]', tmpFile);
  await page.getByRole('button', { name: 'Ajouter le document' }).click();
  await expect(page.getByText('Disponible').first()).toBeVisible();
  await expect(page.getByText('Document ajouté à l’activité')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Brouillon vers Brouillon');
  const href = await page.getByRole('link', { name: 'Telecharger le document' }).first().getAttribute('href');
  await expectDownload(page, href, 'Document lifecycle creator activity document');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'document_uploaded'`))).toBe(1);
  expect(scalar(`SELECT CONCAT(from_status, '|', to_status, '|', actor_role) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'document_uploaded' ORDER BY rowid DESC LIMIT 1`)).toBe('Brouillon|Brouillon|AGENT_SAISIE');
  expect(scalar(`SELECT comment FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'document_uploaded' ORDER BY rowid DESC LIMIT 1`)).toMatch(/^Document ajoute: /);
  expect(scalar(`SELECT description FROM llx_ecm_files WHERE entity = 1 AND src_object_type = 'mjlfinancement_activity' AND src_object_id = ${activityId} ORDER BY rowid DESC LIMIT 1`)).toBe('Document activite MJL');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'document_downloaded' AND actor_role = 'AGENT_SAISIE'`))).toBe(1);
});

test('Final validator uploads and downloads an activity document without activity write', async ({ page }) => {
  const activityId = scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = 'DOC-ACT-FINAL' AND entity = 1");
  const tmpFile = path.join(os.tmpdir(), `document-activity-final-validator-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Document lifecycle Final validator activity document');

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  await page.getByRole('link', { name: 'Ajouter un document' }).click();
  await page.setInputFiles('input[name="supporting_document"]', tmpFile);
  await page.getByRole('button', { name: 'Ajouter le document' }).click();
  await expect(page.getByText('Disponible').first()).toBeVisible();
  const href = await page.getByRole('link', { name: 'Telecharger le document' }).first().getAttribute('href');
  await expectDownload(page, href, 'Document lifecycle Final validator activity document');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_activity' AND object_id = ${activityId} AND action = 'document_uploaded' AND actor_role = 'VALIDATEUR_DEFINITIF'`))).toBe(1);
});

test('Activity direct downloads deny unrelated Data-entry agent, cross-entity, orphan, and path-tampered ECM rows', async ({ page }) => {
  const readyFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'DOC-ACT-READY' AND entity = 1");
  const crossFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'DOC-ACT-CROSS' AND entity = 2");
  const orphanFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'DOC-ACT-ORPHAN' AND entity = 1");
  const poisonFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'DOC-ACT-POISON' AND entity = 1");

  await login(page, 'mjl.document_lifecycle.otheragent');
  await expectForbiddenDownload(page, `/custom/mjlfinancement/documentdownload.php?type=activity&id=${readyFileId}`);

  await login(page, 'dpaf.mjl');
  for (const fileId of [crossFileId, orphanFileId, poisonFileId]) {
    await expectForbiddenDownload(page, `/custom/mjlfinancement/documentdownload.php?type=activity&id=${fileId}`);
  }
});

test('Activity document states show available, unavailable, and missing labels', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  for (const [ref, label] of [
    ['DOC-ACT-READY', 'Disponible'],
    ['DOC-ACT-UNAVAILABLE', 'Référence indisponible'],
    ['DOC-ACT-MISSING', 'Manquante'],
  ]) {
    const activityId = scalar(`SELECT rowid FROM llx_mjlfinancement_activity WHERE ref = '${ref}' AND entity = 1`);
    await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
    const panel = page.getByRole('heading', { name: 'Documents de l’activité' }).locator('xpath=ancestor::section[1]');
    await expect(panel).toContainText(label);
  }
});

test('Final validator uploads and downloads convention documents; normal users are denied direct convention downloads', async ({ page }) => {
  const conventionId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'DOC-CONV-UPLOAD' AND entity = 1");
  const tmpFile = path.join(os.tmpdir(), `document-convention-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Document lifecycle convention document');

  await login(page, 'dpaf.mjl');
  await page.goto(`/custom/mjlfinancement/conventions.php?id=${conventionId}`);
  await page.getByRole('link', { name: 'Ajouter un document' }).click();
  await page.setInputFiles('input[name="supporting_document"]', tmpFile);
  await page.getByRole('button', { name: 'Ajouter le document' }).click();
  await expect(page.getByText('Disponible').first()).toBeVisible();
  await expect(page.getByText('Document ajouté à l’enveloppe')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Active vers Active');
  await page.reload();
  const fileId = scalar(`SELECT rowid FROM llx_ecm_files WHERE entity = 1 AND src_object_type = 'mjlfinancement_convention' AND src_object_id = ${conventionId} ORDER BY rowid DESC LIMIT 1`);
  const href = `/custom/mjlfinancement/documentdownload.php?type=convention&id=${fileId}`;
  await expectDownload(page, href, 'Document lifecycle convention document');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_convention' AND object_id = ${conventionId} AND action = 'document_uploaded'`))).toBe(1);
  expect(scalar(`SELECT CONCAT(from_status, '|', to_status, '|', actor_role) FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_convention' AND object_id = ${conventionId} AND action = 'document_uploaded' ORDER BY rowid DESC LIMIT 1`)).toBe('Active|Active|VALIDATEUR_DEFINITIF');
  expect(scalar(`SELECT comment FROM llx_mjlfinancement_workflow_action WHERE object_type = 'mjlfinancement_convention' AND object_id = ${conventionId} AND action = 'document_uploaded' ORDER BY rowid DESC LIMIT 1`)).toMatch(/^Document ajoute: /);

  await login(page, 'agent.mjl');
  await expectForbiddenDownload(page, href);
});

test('Convention direct downloads deny cross-entity, orphan, and path-tampered ECM rows', async ({ page }) => {
  const crossFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'DOC-CONV-CROSS' AND entity = 2");
  const orphanFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'DOC-CONV-ORPHAN' AND entity = 1");
  const poisonFileId = scalar("SELECT rowid FROM llx_ecm_files WHERE ref = 'DOC-CONV-POISON' AND entity = 1");

  await login(page, 'dpaf.mjl');
  for (const fileId of [crossFileId, orphanFileId, poisonFileId]) {
    await expectForbiddenDownload(page, `/custom/mjlfinancement/documentdownload.php?type=convention&id=${fileId}`);
  }
});

test('Convention document states show available, unavailable, and missing labels; closed conventions block uploads', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  for (const [ref, label] of [
    ['DOC-CONV-READY', 'Disponible'],
    ['DOC-CONV-UNAVAILABLE', 'Référence indisponible'],
    ['DOC-CONV-MISSING', 'Manquante'],
  ]) {
    const conventionId = scalar(`SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = '${ref}' AND entity = 1`);
    await page.goto(`/custom/mjlfinancement/conventions.php?id=${conventionId}`);
    const panel = page.getByRole('heading', { name: 'Documents enveloppe' }).locator('xpath=ancestor::section[1]');
    await expect(panel).toContainText(label);
  }

  const closedId = scalar("SELECT rowid FROM llx_mjlfinancement_convention WHERE ref = 'DOC-CONV-CLOSED' AND entity = 1");
  await page.goto(`/custom/mjlfinancement/conventions.php?id=${closedId}`);
  await expect(page.locator('input[name="supporting_document"]')).toHaveCount(0);
});

test('Workflow audit, Final validator dashboard, and reports label document uploads explicitly', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/workflowactions.php?workflow_action=document_uploaded');
  await expect(page.getByRole('cell', { name: 'Document ajouté', exact: true }).first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/dpafdashboard.php');
  await expect(page.getByRole('cell', { name: 'Document ajouté', exact: true }).first()).toBeVisible();

  await page.goto('/custom/mjlfinancement/reports.php?report=workflow_actions');
  await expect(page.getByRole('cell', { name: 'Document ajouté', exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('document_uploaded');
});
