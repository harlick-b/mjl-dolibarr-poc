const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');

const nativeAdminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
const marker = 'RST003-E2E';

test.describe.configure({ mode: 'serial' });

function composeExec(service, ...args) {
  return execFileSync('docker', ['compose', 'exec', '-T', service, ...args], { encoding: 'utf8', env: process.env });
}

function sql(statement) {
  return composeExec('mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e', statement);
}

function scalar(statement) {
  return composeExec('mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', '-N', '-B', 'dolidb', '-e', statement).trim();
}

async function waitForDatabaseSleep() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (Number(scalar("SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE ID <> CONNECTION_ID() AND STATE = 'User sleep'")) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the deterministic database lock barrier.');
}

async function login(page, loginName, userPassword = nativeAdminPassword) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(loginName);
  await page.getByLabel('Mot de passe').fill(userPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
  await expect(page.locator('a[href*="logout.php"]')).not.toHaveCount(0);
}

async function expectDenied(page, url) {
  const response = await page.goto(url);
  expect(response.status()).toBeGreaterThanOrEqual(400);
  await expect(page.locator('body')).toContainText(/Accès|Access|Forbidden|non autorisé/i);
}

async function createReference(page, route, label, partnerId = '') {
  await page.goto(`/custom/mjlfinancement/${route}.php?action=create`);
  await page.getByLabel('Libellé').fill(label);
  if (partnerId) await page.getByLabel('Partenaire').selectOption(String(partnerId));
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(new RegExp(`${route}\\.php\\?id=\\d+`));
}

function cleanup() {
  sql(`
    DROP TRIGGER IF EXISTS rst003_project_insert_barrier;
    DROP TRIGGER IF EXISTS rst003_partner_update_barrier;
    SET @users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'rst003.e2e.%');
    DELETE FROM llx_mjlfinancement_workflow_action WHERE ref LIKE 'WFA-RST003-%';
    DELETE FROM llx_projet WHERE title LIKE '${marker}%';
    DELETE FROM llx_societe_commerciaux WHERE fk_soc IN (SELECT rowid FROM llx_societe WHERE nom LIKE '${marker}%');
    DELETE FROM llx_societe WHERE nom LIKE '${marker}%';
    DELETE FROM llx_mjlfinancement_operation_type WHERE label LIKE '${marker}%';
    DELETE FROM llx_user_rights WHERE FIND_IN_SET(fk_user, COALESCE(@users, ''));
    DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user, COALESCE(@users, ''));
    DELETE FROM llx_user WHERE FIND_IN_SET(rowid, COALESCE(@users, ''));
  `);
}

test.beforeAll(() => {
  cleanup();
  sql(`
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
      SELECT 1, 'rst003.e2e.validator', 'RST003', 'Validateur', 'rst003.validator@example.test', pass_crypted, 1, 0, NOW() FROM llx_user WHERE admin = 1 ORDER BY rowid LIMIT 1;
    SET @validator = LAST_INSERT_ID();
    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, date_creation)
      VALUES (1, @validator, 'VALIDATEUR_DEFINITIF', 1, NOW(), 'rst003_e2e', NOW());
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
      SELECT 1, 'rst003.e2e.agent', 'RST003', 'Agent', 'rst003.agent@example.test', pass_crypted, 1, 0, NOW() FROM llx_user WHERE admin = 1 ORDER BY rowid LIMIT 1;
    SET @agent = LAST_INSERT_ID();
    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, date_creation)
      VALUES (1, @agent, 'AGENT_SAISIE', 1, NOW(), 'rst003_e2e', NOW());
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
      SELECT 1, 'rst003.e2e.supervisor', 'RST003', 'Superviseur', 'rst003.supervisor@example.test', pass_crypted, 1, 0, NOW() FROM llx_user WHERE admin = 1 ORDER BY rowid LIMIT 1;
    SET @supervisor = LAST_INSERT_ID();
    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, date_creation)
      VALUES (1, @supervisor, 'AGENT_VERIFICATEUR', 1, NOW(), 'rst003_e2e', NOW());
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec)
      SELECT 1, 'rst003.e2e.norole', 'RST003', 'SansRole', 'rst003.norole@example.test', pass_crypted, 1, 0, NOW() FROM llx_user WHERE admin = 1 ORDER BY rowid LIMIT 1;
  `);
});

test.afterAll(() => cleanup());

test('Validateur creates all reference types and several Projets under one Partenaire', async ({ page }) => {
  await login(page, 'rst003.e2e.validator');
  await createReference(page, 'partners', `${marker} Partenaire A`);
  const partnerId = scalar(`SELECT rowid FROM llx_societe WHERE entity=1 AND nom='${marker} Partenaire A'`);
  await createReference(page, 'projects', `${marker} Projet 1`, partnerId);
  await createReference(page, 'projects', `${marker} Projet 2`, partnerId);
  await createReference(page, 'operationtypes', `${marker} Type A`);

  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE entity=1 AND fk_soc=${partnerId} AND fk_statut=1 AND ref LIKE 'MJL-PROJET-%'`))).toBe(2);
  expect(scalar(`SELECT MIN(CHAR_LENGTH(ref)) FROM llx_projet WHERE fk_soc=${partnerId}`)).toBe('43');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_operation_type WHERE entity=1 AND label='${marker} Type A' AND is_active=1`))).toBe(1);
});

test('Projet ownership and technical reference stay immutable while its label changes', async ({ page }) => {
  const projectId = scalar(`SELECT rowid FROM llx_projet WHERE entity=1 AND title='${marker} Projet 1'`);
  const before = scalar(`SELECT CONCAT(ref, ':', fk_soc) FROM llx_projet WHERE rowid=${projectId}`);
  await login(page, 'rst003.e2e.validator');
  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}&action=edit`);
  await expect(page.locator('input[name="ref"], select[name="partner_id"]')).toHaveCount(0);
  await page.getByLabel('Libellé').fill(`${marker} Projet 1 renommé`);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  expect(scalar(`SELECT CONCAT(ref, ':', fk_soc) FROM llx_projet WHERE rowid=${projectId}`)).toBe(before);
});

test('Partenaire deactivation closes active Projets and reactivation does not reopen them', async ({ page }) => {
  const partnerId = scalar(`SELECT rowid FROM llx_societe WHERE entity=1 AND nom='${marker} Partenaire A'`);
  await login(page, 'rst003.e2e.validator');
  await page.goto(`/custom/mjlfinancement/partners.php?id=${partnerId}`);
  await page.getByRole('button', { name: 'Désactiver' }).click();
  expect(scalar(`SELECT status FROM llx_societe WHERE rowid=${partnerId}`)).toBe('0');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE fk_soc=${partnerId} AND fk_statut=1`))).toBe(0);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE fk_soc=${partnerId} AND fk_statut=2`))).toBe(2);
  await page.getByRole('button', { name: 'Activer' }).click();
  expect(scalar(`SELECT status FROM llx_societe WHERE rowid=${partnerId}`)).toBe('1');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE fk_soc=${partnerId} AND fk_statut=1`))).toBe(0);
});

test('creation after deactivation fails and stale edit cannot overwrite current data', async ({ page, context }) => {
  await login(page, 'rst003.e2e.validator');
  await createReference(page, 'partners', `${marker} Partenaire B`);
  const partnerId = scalar(`SELECT rowid FROM llx_societe WHERE entity=1 AND nom='${marker} Partenaire B'`);
  const stalePage = await context.newPage();
  await stalePage.goto(`/custom/mjlfinancement/partners.php?id=${partnerId}&action=edit`);
  await page.goto(`/custom/mjlfinancement/partners.php?id=${partnerId}&action=edit`);
  await page.getByLabel('Libellé').fill(`${marker} Partenaire B courant`);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await stalePage.getByLabel('Libellé').fill(`${marker} Partenaire B périmé`);
  await stalePage.getByRole('button', { name: 'Enregistrer' }).click();
  expect(scalar(`SELECT nom FROM llx_societe WHERE rowid=${partnerId}`)).toBe(`${marker} Partenaire B courant`);

  const pendingProject = await context.newPage();
  await pendingProject.goto('/custom/mjlfinancement/projects.php?action=create');
  await pendingProject.getByLabel('Libellé').fill(`${marker} Projet concurrence`);
  await pendingProject.getByLabel('Partenaire').selectOption(String(partnerId));
  await page.goto(`/custom/mjlfinancement/partners.php?id=${partnerId}`);
  await page.getByRole('button', { name: 'Désactiver' }).click();
  await pendingProject.getByRole('button', { name: 'Enregistrer' }).click();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE title='${marker} Projet concurrence'`))).toBe(0);
  await page.goto('/custom/mjlfinancement/projects.php?action=create');
  await expect(page.locator(`option[value="${partnerId}"]`)).toHaveCount(0);
  const before = Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE fk_soc=${partnerId}`));
  const response = await page.request.post('/custom/mjlfinancement/projects.php', { form: { action: 'create', label: `${marker} Projet interdit`, partner_id: partnerId } });
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE fk_soc=${partnerId}`))).toBe(before);
});

test('parent and child mutations serialize in both real lock-contention orderings', async ({ page, context }) => {
  await login(page, 'rst003.e2e.validator');

  await createReference(page, 'partners', `${marker} Partenaire création-première`);
  const creationFirstPartner = scalar(`SELECT rowid FROM llx_societe WHERE nom='${marker} Partenaire création-première'`);
  const createPage = await context.newPage();
  await createPage.goto('/custom/mjlfinancement/projects.php?action=create');
  await createPage.getByLabel('Libellé').fill(`${marker} Projet création-première`);
  await createPage.getByLabel('Partenaire').selectOption(creationFirstPartner);
  const deactivatePage = await context.newPage();
  await deactivatePage.goto(`/custom/mjlfinancement/partners.php?id=${creationFirstPartner}`);
  sql('CREATE TRIGGER rst003_project_insert_barrier BEFORE INSERT ON llx_projet FOR EACH ROW DO SLEEP(3)');
  try {
    const createClick = createPage.getByRole('button', { name: 'Enregistrer' }).click();
    await waitForDatabaseSleep();
    const deactivateClick = deactivatePage.getByRole('button', { name: 'Désactiver' }).click();
    await Promise.all([createClick, deactivateClick]);
  } finally {
    sql('DROP TRIGGER IF EXISTS rst003_project_insert_barrier');
  }
  expect(scalar(`SELECT status FROM llx_societe WHERE rowid=${creationFirstPartner}`)).toBe('0');
  expect(scalar(`SELECT fk_statut FROM llx_projet WHERE title='${marker} Projet création-première'`)).toBe('2');

  await createReference(page, 'partners', `${marker} Partenaire désactivation-première`);
  const deactivationFirstPartner = scalar(`SELECT rowid FROM llx_societe WHERE nom='${marker} Partenaire désactivation-première'`);
  const pendingCreate = await context.newPage();
  await pendingCreate.goto('/custom/mjlfinancement/projects.php?action=create');
  await pendingCreate.getByLabel('Libellé').fill(`${marker} Projet désactivation-première`);
  await pendingCreate.getByLabel('Partenaire').selectOption(deactivationFirstPartner);
  const firstDeactivate = await context.newPage();
  await firstDeactivate.goto(`/custom/mjlfinancement/partners.php?id=${deactivationFirstPartner}`);
  sql('CREATE TRIGGER rst003_partner_update_barrier BEFORE UPDATE ON llx_societe FOR EACH ROW DO SLEEP(3)');
  try {
    const deactivateClick = firstDeactivate.getByRole('button', { name: 'Désactiver' }).click();
    await waitForDatabaseSleep();
    const createClick = pendingCreate.getByRole('button', { name: 'Enregistrer' }).click();
    await Promise.all([deactivateClick, createClick]);
  } finally {
    sql('DROP TRIGGER IF EXISTS rst003_partner_update_barrier');
  }
  expect(scalar(`SELECT status FROM llx_societe WHERE rowid=${deactivationFirstPartner}`)).toBe('0');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_projet WHERE title='${marker} Projet désactivation-première'`))).toBe(0);
});

test('Projet lifecycle requires an active parent and preserves identity across reactivation', async ({ page }) => {
  await login(page, 'rst003.e2e.validator');
  await createReference(page, 'partners', `${marker} Partenaire cycle Projet`);
  const partnerId = scalar(`SELECT rowid FROM llx_societe WHERE nom='${marker} Partenaire cycle Projet'`);
  await createReference(page, 'projects', `${marker} Projet cycle`, partnerId);
  const projectId = scalar(`SELECT rowid FROM llx_projet WHERE title='${marker} Projet cycle'`);
  const identity = scalar(`SELECT CONCAT(rowid, ':', ref, ':', fk_soc) FROM llx_projet WHERE rowid=${projectId}`);

  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}`);
  await page.getByRole('button', { name: 'Désactiver' }).click();
  expect(scalar(`SELECT fk_statut FROM llx_projet WHERE rowid=${projectId}`)).toBe('2');
  await page.goto(`/custom/mjlfinancement/partners.php?id=${partnerId}`);
  await page.getByRole('button', { name: 'Désactiver' }).click();
  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}`);
  await page.getByRole('button', { name: 'Activer' }).click();
  expect(scalar(`SELECT fk_statut FROM llx_projet WHERE rowid=${projectId}`)).toBe('2');

  await page.goto(`/custom/mjlfinancement/partners.php?id=${partnerId}`);
  await page.getByRole('button', { name: 'Activer' }).click();
  await page.goto(`/custom/mjlfinancement/projects.php?id=${projectId}`);
  await page.getByRole('button', { name: 'Activer' }).click();
  expect(scalar(`SELECT fk_statut FROM llx_projet WHERE rowid=${projectId}`)).toBe('1');
  expect(scalar(`SELECT CONCAT(rowid, ':', ref, ':', fk_soc) FROM llx_projet WHERE rowid=${projectId}`)).toBe(identity);
});

test('Type lifecycle, duplicate labels, one-use tokens, escaping, and mobile containment are enforced', async ({ page, context }) => {
  await login(page, 'rst003.e2e.validator');
  const typeId = scalar(`SELECT rowid FROM llx_mjlfinancement_operation_type WHERE entity=1 AND label='${marker} Type A'`);
  await page.goto(`/custom/mjlfinancement/operationtypes.php?id=${typeId}`);
  const staleLifecycle = await context.newPage();
  await staleLifecycle.goto(`/custom/mjlfinancement/operationtypes.php?id=${typeId}`);
  await page.getByRole('button', { name: 'Désactiver' }).click();
  await staleLifecycle.getByRole('button', { name: 'Désactiver' }).click();
  expect(scalar(`SELECT is_active FROM llx_mjlfinancement_operation_type WHERE rowid=${typeId}`)).toBe('0');
  await page.goto(`/custom/mjlfinancement/operationtypes.php?id=${typeId}`);
  await page.getByRole('button', { name: 'Activer' }).click();

  await page.goto('/custom/mjlfinancement/operationtypes.php?action=create');
  await page.getByLabel('Libellé').fill(`${marker} Type A`);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_operation_type WHERE entity=1 AND label='${marker} Type A'`))).toBe(1);
  await expect(page.locator('.mjl-form-error-summary')).toBeFocused();

  await page.goto('/custom/mjlfinancement/operationtypes.php?action=create');
  await page.getByLabel('Libellé').fill(`${marker} Jeton unique`);
  const replayForm = await page.locator('form').evaluate((form) => Object.fromEntries(new FormData(form).entries()));
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  const replay = await page.request.post('/custom/mjlfinancement/operationtypes.php', { form: replayForm });
  expect(replay.status()).toBe(403);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_operation_type WHERE label='${marker} Jeton unique'`))).toBe(1);

  const escaped = `${marker} <script>alert(1)</script>`;
  sql(`INSERT INTO llx_societe (entity,nom,status,client,fournisseur,datec) VALUES (1,'${escaped}',1,0,0,NOW())`);
  await page.goto('/custom/mjlfinancement/partners.php');
  await expect(page.locator('body')).toContainText(escaped);
  await expect(page.locator('script', { hasText: 'alert(1)' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/custom/mjlfinancement/partners.php');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 720 });
  await createReference(page, 'partners', `${marker} Partenaire lecteur`);
  const readerPartner = scalar(`SELECT rowid FROM llx_societe WHERE nom='${marker} Partenaire lecteur'`);
  await createReference(page, 'projects', `${marker} Projet lecteur`, readerPartner);
});

test('Agent and Supervisor read active references while inactive, no-role, anonymous, and Admin access fail closed', async ({ page, browser }) => {
  sql(`INSERT INTO llx_mjlfinancement_operation_type (entity,label,is_active,date_creation,fk_user_creat) SELECT 1,'${marker} Type inactif',0,NOW(),rowid FROM llx_user WHERE admin=1 ORDER BY rowid LIMIT 1`);
  const activeProject = scalar(`SELECT rowid FROM llx_projet WHERE title='${marker} Projet lecteur'`);
  const inactivePartner = scalar(`SELECT rowid FROM llx_societe WHERE nom='${marker} Partenaire B courant'`);
  const inactiveProject = scalar(`SELECT rowid FROM llx_projet WHERE title='${marker} Projet 1 renommé'`);
  const inactiveType = scalar(`SELECT rowid FROM llx_mjlfinancement_operation_type WHERE label='${marker} Type inactif'`);
  sql(`INSERT INTO llx_projet (entity,ref,title,fk_soc,fk_statut,datec,fk_user_creat) VALUES (1,'RST003-POISON-PROJECT','${marker} Projet parent inactif',${inactivePartner},1,NOW(),1)`);
  const poisonProject = scalar("SELECT rowid FROM llx_projet WHERE ref='RST003-POISON-PROJECT'");
  for (const loginName of ['rst003.e2e.agent', 'rst003.e2e.supervisor']) {
    await login(page, loginName);
    for (const [route, expected] of [['partners', `${marker} Partenaire lecteur`], ['projects', `${marker} Projet lecteur`], ['operationtypes', `${marker} Type A`]]) {
      await page.goto(`/custom/mjlfinancement/${route}.php`);
      await expect(page.locator('body')).toContainText(expected);
      await expectDenied(page, `/custom/mjlfinancement/${route}.php?action=create`);
    }
    await expectDenied(page, `/custom/mjlfinancement/projects.php?id=${poisonProject}`);
    await expectDenied(page, `/custom/mjlfinancement/partners.php?id=${inactivePartner}`);
    await expectDenied(page, `/custom/mjlfinancement/projects.php?id=${inactiveProject}`);
    await expectDenied(page, `/custom/mjlfinancement/operationtypes.php?id=${inactiveType}`);
    await page.goto('/custom/mjlfinancement/operationtypes.php');
    await expect(page.locator('body')).not.toContainText(`${marker} Type inactif`);
    await page.goto(`/custom/mjlfinancement/projects.php?id=${activeProject}`);
    await expect(page.locator('body')).toContainText(`${marker} Projet lecteur`);
  }
  await login(page, 'rst003.e2e.norole');
  await expectDenied(page, '/custom/mjlfinancement/partners.php');
  await login(page, 'admin');
  await expectDenied(page, '/custom/mjlfinancement/partners.php');

  const anonymous = await browser.newPage();
  await anonymous.goto('/custom/mjlfinancement/partners.php');
  await expect(anonymous.getByLabel('Identifiant')).toBeVisible();
  await anonymous.close();
});

test('delete actions, cross-entity objects, missing CSRF, and native routes fail closed', async ({ page }) => {
  await login(page, 'rst003.e2e.validator');
  const partnerId = scalar(`SELECT rowid FROM llx_societe WHERE entity=1 AND nom LIKE '${marker} Partenaire%' ORDER BY rowid LIMIT 1`);
  const projectId = scalar(`SELECT rowid FROM llx_projet WHERE entity=1 AND title LIKE '${marker}%' ORDER BY rowid LIMIT 1`);
  const typeId = scalar(`SELECT rowid FROM llx_mjlfinancement_operation_type WHERE entity=1 AND label LIKE '${marker}%' ORDER BY rowid LIMIT 1`);
  for (const [route, id] of [['partners', partnerId], ['projects', projectId], ['operationtypes', typeId]]) {
    await expectDenied(page, `/custom/mjlfinancement/${route}.php?id=${id}&action=delete`);
    const deletePost = await page.request.post(`/custom/mjlfinancement/${route}.php?id=${id}`, { form: { action: 'delete', id } });
    expect(deletePost.status()).toBe(403);
    const wrongMethod = await page.request.fetch(`/custom/mjlfinancement/${route}.php`, { method: 'PUT' });
    expect(wrongMethod.status()).toBe(403);
    await expectDenied(page, `/custom/mjlfinancement/${route}.php?id=forged`);

    await page.goto(`/custom/mjlfinancement/${route}.php?action=create`);
    await page.getByLabel('Libellé').fill(`${marker} Identifiant forgé ${route}`);
    if (route === 'projects') {
      const activePartner = scalar(`SELECT rowid FROM llx_societe WHERE entity=1 AND status=1 AND nom LIKE '${marker}%' ORDER BY rowid LIMIT 1`);
      await page.getByLabel('Partenaire').selectOption(activePartner);
    }
    const forgedCreate = await page.locator('form').evaluate((form) => Object.fromEntries(new FormData(form).entries()));
    forgedCreate.id = String(id);
    const forgedResponse = await page.request.post(`/custom/mjlfinancement/${route}.php?id=${id}`, { form: forgedCreate });
    expect(forgedResponse.status()).toBe(403);
  }
  expect(Number(scalar(`SELECT (SELECT COUNT(*) FROM llx_societe WHERE nom LIKE '${marker} Identifiant forgé%') + (SELECT COUNT(*) FROM llx_projet WHERE title LIKE '${marker} Identifiant forgé%') + (SELECT COUNT(*) FROM llx_mjlfinancement_operation_type WHERE label LIKE '${marker} Identifiant forgé%')`))).toBe(0);
  const response = await page.request.post(`/custom/mjlfinancement/partners.php?id=${partnerId}`, { form: { action: 'update', id: partnerId, label: 'forged' } });
  expect(response.status()).toBeGreaterThanOrEqual(400);
  sql(`INSERT INTO llx_societe (entity,nom,status,client,fournisseur,datec) VALUES (2,'${marker} Cross entity',1,0,0,NOW())`);
  const crossId = scalar(`SELECT rowid FROM llx_societe WHERE entity=2 AND nom='${marker} Cross entity'`);
  await expectDenied(page, `/custom/mjlfinancement/partners.php?id=${crossId}`);
  sql(`INSERT INTO llx_projet (entity,ref,title,fk_soc,fk_statut,datec,fk_user_creat) VALUES (2,'RST003-CROSS-PROJECT','${marker} Cross Project',${crossId},1,NOW(),1)`);
  const crossProject = scalar("SELECT rowid FROM llx_projet WHERE ref='RST003-CROSS-PROJECT'");
  sql(`INSERT INTO llx_mjlfinancement_operation_type (entity,label,is_active,date_creation,fk_user_creat) SELECT 2,'${marker} Cross Type',1,NOW(),rowid FROM llx_user WHERE admin=1 ORDER BY rowid LIMIT 1`);
  const crossType = scalar(`SELECT rowid FROM llx_mjlfinancement_operation_type WHERE entity=2 AND label='${marker} Cross Type'`);
  await expectDenied(page, `/custom/mjlfinancement/projects.php?id=${crossProject}`);
  await expectDenied(page, `/custom/mjlfinancement/operationtypes.php?id=${crossType}`);
  for (const route of ['/societe/card.php?action=create', '/projet/card.php?action=create', '/api/index.php', '/imports/import.php', '/admin/index.php']) {
    const native = await page.goto(route);
    expect(native.status()).toBe(403);
  }
  sql(`DELETE FROM llx_projet WHERE entity=2 AND ref='RST003-CROSS-PROJECT'; DELETE FROM llx_mjlfinancement_operation_type WHERE entity=2 AND label='${marker} Cross Type'; DELETE FROM llx_societe WHERE entity=2 AND nom='${marker} Cross entity'`);
});
