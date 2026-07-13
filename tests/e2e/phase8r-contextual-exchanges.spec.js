const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const forbiddenResponsePattern = /Acces refuse|Accès refusé|Acc&egrave;s refus&eacute;|Access denied|Forbidden|Non autorise|Non autorisé|Non autoris&eacute;/i;

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

function cleanupPhase8RFixtures() {
  sql(`
    SET @phase8r_users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'mjl.phase8r.%');
    SET @phase8r_groups = (SELECT GROUP_CONCAT(rowid) FROM llx_usergroup WHERE nom LIKE 'MJL Phase 8R - %');
    DELETE FROM llx_mjlfinancement_exchange_log WHERE ref LIKE 'EXC-%' AND message LIKE 'Phase 8R %';
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE FIND_IN_SET(fk_user, COALESCE(@phase8r_users, ''));
    DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user, COALESCE(@phase8r_users, ''));
    DELETE FROM llx_usergroup_user WHERE FIND_IN_SET(fk_user, COALESCE(@phase8r_users, '')) OR FIND_IN_SET(fk_usergroup, COALESCE(@phase8r_groups, ''));
    DELETE FROM llx_usergroup_rights WHERE FIND_IN_SET(fk_usergroup, COALESCE(@phase8r_groups, ''));
    DELETE FROM llx_user WHERE FIND_IN_SET(rowid, COALESCE(@phase8r_users, ''));
    DELETE FROM llx_usergroup WHERE FIND_IN_SET(rowid, COALESCE(@phase8r_groups, ''));
  `);
}

function createPhase8RUser(loginName, groupName, roleCode, rights, partnerName) {
  const email = `${loginName}@mjl-poc.local`;
  const rightStatements = rights.map(([rightPerms, rightSubperms]) => `
    SET @right_id = (SELECT id FROM llx_rights_def WHERE module = 'mjlfinancement' AND perms = '${rightPerms}' AND subperms = '${rightSubperms}' AND entity IN (0, 1) ORDER BY entity DESC LIMIT 1);
    INSERT INTO llx_usergroup_rights (entity, fk_usergroup, fk_id) SELECT 1, @group_id, @right_id WHERE @right_id IS NOT NULL;
  `).join('\n');
  sql(`
    SET @partner_id = (SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = '${partnerName}' LIMIT 1);
    INSERT INTO llx_usergroup (entity, nom, note) VALUES (1, '${groupName}', 'Phase 8R contextual exchange E2E');
    SET @group_id = LAST_INSERT_ID();
    ${rightStatements}
    INSERT INTO llx_user (entity, login, lastname, firstname, email, pass_crypted, statut, admin, datec) SELECT 1, '${loginName}', 'Phase8R', 'E2E', '${email}', pass_crypted, 1, 0, NOW() FROM llx_user WHERE login = 'agent.mjl' LIMIT 1;
    SET @user_id = LAST_INSERT_ID();
    INSERT INTO llx_usergroup_user (entity, fk_user, fk_usergroup) VALUES (1, @user_id, @group_id);
    INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, date_creation, fk_user_creat) VALUES (1, @user_id, '${roleCode}', 1, NOW(), 'phase8r_e2e', NOW(), 1);
    INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, date_creation, fk_user_creat) VALUES (1, @user_id, @partner_id, 1, NOW(), 'phase8r_e2e', NOW(), 1);
  `);
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupPhase8RFixtures();
  createPhase8RUser('mjl.phase8r.readonly', 'MJL Phase 8R - Read Only', 'AGENT_SAISIE', [
    ['activity', 'read'],
    ['expense', 'read'],
    ['exchangelog', 'read'],
  ], 'UNICEF');
  createPhase8RUser('mjl.phase8r.writer', 'MJL Phase 8R - Writer', 'AGENT_SAISIE', [
    ['activity', 'read'],
    ['activity', 'write'],
    ['expense', 'read'],
    ['expense', 'write'],
    ['exchangelog', 'read'],
    ['exchangelog', 'write'],
  ], 'UNICEF');
});

test.afterAll(() => {
  cleanupPhase8RFixtures();
});

test('authorized user adds contextual comments across object timelines and aggregate views stay scoped', async ({ page }) => {
  const activityId = scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE entity = 1 AND ref = 'ACT-JE-001' LIMIT 1");
  const expenseId = scalar("SELECT rowid FROM llx_mjlfinancement_expense WHERE entity = 1 AND ref = 'EXP-JE-001' LIMIT 1");
  const projectId = scalar("SELECT rowid FROM llx_projet WHERE entity = 1 AND ref = 'PRJ-JE-2026' LIMIT 1");
  const budgetLineId = scalar("SELECT bl.rowid FROM llx_mjlfinancement_budget_line bl INNER JOIN llx_mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE bl.entity = 1 AND c.ref = 'CONV-UNICEF-2026-001' LIMIT 1");
  const partnerId = scalar("SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = 'UNICEF' LIMIT 1");
  const otherPartnerId = scalar("SELECT rowid FROM llx_societe WHERE entity = 1 AND nom <> 'UNICEF' LIMIT 1");

  await login(page, 'dpaf.mjl');

  for (const [path, message] of [
    [`/custom/mjlfinancement/activities.php?id=${activityId}`, 'Phase 8R activity comment'],
    [`/custom/mjlfinancement/expenses.php?id=${expenseId}`, 'Phase 8R expense comment'],
    [`/custom/mjlfinancement/projects.php?id=${projectId}`, 'Phase 8R project comment'],
    [`/custom/mjlfinancement/budgetlines.php?id=${budgetLineId}`, 'Phase 8R budget comment'],
  ]) {
    await page.goto(path);
    await expect(page.locator('body')).toContainText(/Historique|Commentaires/);
    await page.locator('textarea[name="message"]').first().fill(message);
    await page.getByRole('button', { name: 'Ajouter le commentaire' }).click();
    await expect(page.locator('body')).toContainText(message);
  }

  await page.goto(`/custom/mjlfinancement/partners.php?id=${partnerId}`);
  await expect(page.locator('body')).toContainText('Phase 8R activity comment');
  await expect(page.locator('body')).toContainText('Phase 8R budget comment');

  if (otherPartnerId) {
    await page.goto(`/custom/mjlfinancement/partners.php?id=${otherPartnerId}`);
    await expect(page.locator('body')).not.toContainText('Phase 8R activity comment');
    await expect(page.locator('body')).not.toContainText('Phase 8R budget comment');
  }
});

test('readonly user sees contextual history without a comment form', async ({ page }) => {
  const activityId = scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE entity = 1 AND ref = 'ACT-JE-001' LIMIT 1");

  await login(page, 'mjl.phase8r.readonly');
  await page.goto(`/custom/mjlfinancement/activities.php?id=${activityId}`);
  await expect(page.getByRole('heading', { name: /Historique de decision/ })).toBeVisible();
  await expect(page.locator('textarea[name="message"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ajouter le commentaire' })).toHaveCount(0);
});

test('direct contextual POST fails closed when route-specific access denies the object', async ({ page }) => {
  const samePartnerUnauthorizedActivityId = scalar(`
    SELECT a.rowid FROM llx_mjlfinancement_activity a
    INNER JOIN llx_mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity
    INNER JOIN llx_societe s ON s.rowid = c.fk_soc AND s.entity = a.entity
    WHERE a.entity = 1 AND s.nom = 'UNICEF' AND a.ref = 'ACT-JE-001'
    LIMIT 1
  `);
  const crossPartnerActivityId = scalar(`
    SELECT a.rowid FROM llx_mjlfinancement_activity a
    INNER JOIN llx_mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity
    INNER JOIN llx_societe s ON s.rowid = c.fk_soc AND s.entity = a.entity
    WHERE a.entity = 1 AND s.nom <> 'UNICEF'
    LIMIT 1
  `);

  await login(page, 'mjl.phase8r.writer');
  await page.goto('/custom/mjlfinancement/index.php');
  const token = await sessionToken(page);

  for (const id of [samePartnerUnauthorizedActivityId, crossPartnerActivityId]) {
    if (!id) continue;
    const before = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_exchange_log WHERE object_type = 'mjlfinancement_activity' AND object_id = ${id} AND message = 'Phase 8R forbidden post'`));
    const response = await page.request.post(`/custom/mjlfinancement/activities.php?id=${id}`, {
      form: {
        token,
        action: 'add_exchange',
        id,
        message: 'Phase 8R forbidden post',
      },
      maxRedirects: 0,
    });
    expect(await response.text()).toMatch(forbiddenResponsePattern);
    expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_exchange_log WHERE object_type = 'mjlfinancement_activity' AND object_id = ${id} AND message = 'Phase 8R forbidden post'`))).toBe(before);
  }
});

test('global exchanges route is advanced audit only and absent from primary navigation', async ({ page }) => {
  await login(page, 'dpaf.mjl');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByLabel('Menu module MJL')).not.toContainText('Échanges');

  await page.goto('/custom/mjlfinancement/exchangelogs.php');
  await expect(page.getByText('Historique / Audit - recherche des echanges').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);
  await expect(page.locator('textarea[name="message"]')).toHaveCount(0);
  await expect(page.locator('select[name="object_type"]')).toContainText('Projet');
  await expect(page.locator('select[name="object_type"]')).toContainText('Ligne budgetaire');
});
