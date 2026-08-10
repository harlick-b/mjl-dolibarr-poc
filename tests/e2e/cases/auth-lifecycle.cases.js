const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';
const nativeAdminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';

test.describe.configure({ mode: 'serial' });

function dockerExec(command) {
  execSync(`docker compose exec -T ${command}`, { stdio: 'pipe' });
}

function sql(query) {
  dockerExec(`mariadb mariadb -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`);
}

function sqlScalar(query) {
  return execSync(`docker compose exec -T mariadb mariadb -N -B -udolidbuser -ppoc_pwd dolidb -e "${query.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}

function tokenFromLink(link, param) {
  return new URL(link, 'http://localhost:8080').searchParams.get(param);
}

function invitationIdForLogin(loginName) {
  return sqlScalar(`SELECT i.rowid FROM llx_mjlfinancement_invitation i INNER JOIN llx_user u ON u.rowid = i.fk_user WHERE u.login = '${loginName}' ORDER BY i.rowid DESC LIMIT 1`);
}

function exactMjlRights(userId) {
  const result = sqlScalar(`
    SELECT GROUP_CONCAT(CONCAT(rd.perms, '.', rd.subperms) ORDER BY rd.perms, rd.subperms SEPARATOR ',')
    FROM llx_user_rights ur
    INNER JOIN llx_rights_def rd ON rd.id = ur.fk_id AND rd.entity = ur.entity
    WHERE ur.entity = 1 AND ur.fk_user = ${userId} AND rd.module = 'mjlfinancement'
  `);
  return result === 'NULL' ? '' : result;
}

function cleanupTestState() {
  sql(`
    DROP TRIGGER IF EXISTS authe2e_fail_access_audit;
    SET @mjl_e2e_users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'mjl.e2e.%' OR login LIKE 'invite.%');
    DELETE FROM llx_const WHERE entity = 1 AND name LIKE 'MJL_AUTH_E2E_%';
    DELETE FROM llx_usergroup_user WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_invitation WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_password_reset WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_access_audit WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, '')) OR FIND_IN_SET(fk_actor, COALESCE(@mjl_e2e_users, '')) OR context LIKE '%mjl.e2e.%' OR context LIKE '%invite.%' OR context LIKE '%delivery=e2e%';
    DELETE FROM llx_user_rights WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_user WHERE FIND_IN_SET(rowid, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_societe WHERE entity = 1 AND nom = 'RST001 Test Partenaire';
  `);
  dockerExec("dolibarr sh -lc 'rm -rf /var/www/documents/mjlfinancement/auth-test-outbox'");
}

function enableE2eTokens() {
  sql("INSERT INTO llx_const (name, entity, value, type, visible, note) VALUES ('MJL_AUTH_E2E_EXPOSE_TOKENS', 1, '1', 'chaine', 0, 'E2E')");
}

function latestLink(type) {
  const name = `MJL_AUTH_E2E_LAST_${type.toUpperCase()}_LINK`;
  return sqlScalar(`SELECT value FROM llx_const WHERE name = '${name}' AND entity = 1 ORDER BY rowid DESC LIMIT 1`);
}

async function login(page, username, userPassword = username === 'admin' ? nativeAdminPassword : password) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(userPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

async function inviteUser(page, suffix, roleCode = 'AGENT_SAISIE') {
  const loginName = `mjl.e2e.${suffix}`;
  const email = `${loginName}@mjl-poc.local`;

  await login(page, 'admin');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.getByText('Gestion des accès MJL').first()).toBeVisible();
  await page.locator('#mjl-login').fill(loginName);
  await page.locator('#mjl-firstname').fill('E2E');
  await page.locator('#mjl-lastname').fill('MJL');
  await page.locator('#mjl-email').fill(email);
  await page.locator('select[name="role_code"]').first().selectOption(roleCode);
  const firstScope = await page.locator('select[name="scope_soc_ids[]"] option').first().getAttribute('value');
  await page.locator('select[name="scope_soc_ids[]"]').first().selectOption(firstScope);
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
  const linkOutput = page.locator('code').filter({ hasText: '/custom/mjlfinancement/invitation.php?invite=' });
  await expect(linkOutput).toBeVisible();
  const invitationLink = await linkOutput.textContent();

  return { loginName, email, invitationLink: invitationLink.trim(), firstScope };
}

test.beforeAll(() => {
  cleanupTestState();
  enableE2eTokens();
});

test.afterAll(() => {
  cleanupTestState();
});

test('effective-role assignment stays singular and rejects business roles for native admins', async ({ page }) => {
  sql(`
    INSERT INTO llx_societe (entity, nom, client, fournisseur, datec)
    SELECT 1, 'RST001 Test Partenaire', 0, 0, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM llx_societe WHERE entity = 1 AND nom = 'RST001 Test Partenaire');
  `);

  await login(page, 'admin');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  const failedLogin = `mjl.e2e.rst001.failed.${Date.now()}`;
  const failedToken = await page.locator('input[name="token"]').first().getAttribute('value');
  const failedInviteResponse = await page.request.post('/custom/mjlfinancement/admin/access.php', {
    form: {
      token: failedToken,
      action: 'invite',
      login: failedLogin,
      firstname: 'E2E',
      lastname: 'Failure',
      email: `${failedLogin}@mjl-poc.local`,
      role_code: 'ROLE_INVALIDE',
    },
  });
  expect(failedInviteResponse.ok()).toBeTruthy();
  expect(sqlScalar(`SELECT COUNT(*) FROM llx_user WHERE login = '${failedLogin}'`)).toBe('0');

  const blockedLogin = `mjl.e2e.rst001.blocked.${Date.now()}`;
  sql("CREATE TRIGGER rst001_block_failed_invitee_delete BEFORE DELETE ON llx_user FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RST001 injected deletion failure'");
  sql("CREATE TRIGGER rst001_block_recovery_audit BEFORE INSERT ON llx_mjlfinancement_access_audit FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RST001 injected audit failure'");
  let blockedInviteResponse;
  try {
    await page.goto('/custom/mjlfinancement/admin/access.php');
    const blockedToken = await page.locator('input[name="token"]').first().getAttribute('value');
    blockedInviteResponse = await page.request.post('/custom/mjlfinancement/admin/access.php', {
      form: {
        token: blockedToken,
        action: 'invite',
        login: blockedLogin,
        firstname: 'E2E',
        lastname: 'Blocked recovery',
        email: `${blockedLogin}@mjl-poc.local`,
        role_code: 'ROLE_INVALIDE',
      },
    });
  } finally {
    sql('DROP TRIGGER IF EXISTS rst001_block_failed_invitee_delete');
    sql('DROP TRIGGER IF EXISTS rst001_block_recovery_audit');
  }
  const blockedUserId = sqlScalar(`SELECT rowid FROM llx_user WHERE login = '${blockedLogin}'`);
  expect(blockedUserId).not.toBe('');
  expect(sqlScalar(`SELECT statut FROM llx_user WHERE rowid = ${blockedUserId}`)).toBe('0');
  expect(sqlScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_role WHERE fk_user = ${blockedUserId}`)).toBe('0');
  expect(sqlScalar(`SELECT COUNT(*) FROM llx_user_rights WHERE fk_user = ${blockedUserId}`)).toBe('0');
  expect(sqlScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_invitation WHERE fk_user = ${blockedUserId}`)).toBe('0');
  expect(sqlScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_access_audit WHERE fk_user = ${blockedUserId} AND event = 'invite_compensation_failed'`)).toBe('0');
  expect(await blockedInviteResponse.text()).toContain('R&eacute;cup&eacute;ration administrative requise');

  await page.goto('/custom/mjlfinancement/admin/access.php');
  const recoveryToken = await page.locator('input[name="token"]').first().getAttribute('value');
  const recoveryScope = sqlScalar("SELECT rowid FROM llx_societe WHERE entity = 1 AND nom = 'RST001 Test Partenaire' LIMIT 1");
  const recoveredInviteResponse = await page.request.post('/custom/mjlfinancement/admin/access.php', {
    form: {
      token: recoveryToken,
      action: 'invite',
      login: blockedLogin,
      firstname: 'E2E',
      lastname: 'Blocked recovery',
      email: `${blockedLogin}@mjl-poc.local`,
      role_code: 'AGENT_SAISIE',
      'scope_soc_ids[]': recoveryScope,
    },
  });
  const recoveredInviteBody = await recoveredInviteResponse.text();
  expect(recoveredInviteResponse.ok()).toBeTruthy();
  expect(recoveredInviteBody).not.toContain('R&eacute;cup&eacute;ration administrative requise');
  expect(sqlScalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = ${blockedUserId} AND is_active = 1`)).toBe('AGENT_SAISIE');
  expect(exactMjlRights(blockedUserId)).toBe('activity.read,activity.write');
  expect(sqlScalar(`SELECT status FROM llx_mjlfinancement_invitation WHERE entity = 1 AND fk_user = ${blockedUserId} ORDER BY rowid DESC LIMIT 1`)).toBe('sent');

  const invited = await inviteUser(page, `rst001.${Date.now()}`, 'AGENT_VERIFICATEUR');
  const targetId = sqlScalar(`SELECT rowid FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`);
  expect(sqlScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1`)).toBe('1');
  expect(exactMjlRights(targetId)).toBe('activity.read,activity.validate,validation.read,workflowaction.read');

  sql("UPDATE llx_rights_def SET perms = 'activity_rst001_missing' WHERE entity = 1 AND module = 'mjlfinancement' AND perms = 'activity' AND subperms = 'validate'");
  try {
    await page.goto('/custom/mjlfinancement/admin/access.php');
    const rollbackToken = await page.locator('input[name="token"]').first().getAttribute('value');
    const rollbackResponse = await page.request.post('/custom/mjlfinancement/admin/access.php', {
      form: {
        token: rollbackToken,
        action: 'update_profile',
        user_id: targetId,
        role_code: 'VALIDATEUR_DEFINITIF',
        'scope_soc_ids[]': invited.firstScope,
      },
    });
    expect(rollbackResponse.ok()).toBeTruthy();
  } finally {
    sql("UPDATE llx_rights_def SET perms = 'activity' WHERE entity = 1 AND module = 'mjlfinancement' AND perms = 'activity_rst001_missing' AND subperms = 'validate'");
  }
  expect(sqlScalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1`)).toBe('AGENT_VERIFICATEUR');
  expect(exactMjlRights(targetId)).toBe('activity.read,activity.validate,validation.read,workflowaction.read');

  await page.goto('/custom/mjlfinancement/admin/access.php');
  const token = await page.locator('input[name="token"]').first().getAttribute('value');
  const response = await page.request.post('/custom/mjlfinancement/admin/access.php', {
    form: {
      token,
      action: 'update_profile',
      user_id: targetId,
      role_code: 'VALIDATEUR_DEFINITIF',
      'scope_soc_ids[]': invited.firstScope,
    },
  });
  expect(response.ok()).toBeTruthy();
  expect(sqlScalar(`SELECT GROUP_CONCAT(role_code ORDER BY rowid) FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1`)).toBe('VALIDATEUR_DEFINITIF');
  expect(exactMjlRights(targetId)).toBe('activity.read,activity.validate,budgetline.read,budgetline.write,convention.read,convention.write,exchangelog.read,exchangelog.write,export.read,export.write,fundreceipt.read,fundreceipt.write,report.read,validation.read,validation.write,workflowaction.read,workflowaction.write');

  expect(() => sql(`
    INSERT INTO llx_mjlfinancement_user_role
      (entity, fk_user, role_code, is_active, date_start, source, date_creation)
    VALUES (1, ${targetId}, 'AGENT_SAISIE', 1, NOW(), 'rst001_duplicate_probe', NOW());
  `)).toThrow();
  expect(() => sql(`
    INSERT INTO llx_mjlfinancement_user_role
      (entity, fk_user, role_code, is_active, date_start, source, date_creation)
    VALUES (1, ${targetId}, 'ROLE_INVALIDE', 0, NOW(), 'rst001_invalid_role_probe', NOW());
  `)).toThrow();
  expect(() => sql(`
    INSERT INTO llx_mjlfinancement_user_role
      (entity, fk_user, role_code, is_active, date_start, source, date_creation)
    VALUES (2, ${targetId}, 'AGENT_SAISIE', 1, NOW(), 'rst001_cross_entity_probe', NOW());
  `)).toThrow();

  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('MjlRst0012026!!');
  await page.locator('#newpass2').fill('MjlRst0012026!!');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();
  await login(page, invited.loginName, 'MjlRst0012026!!');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('heading', { name: 'Tableau de bord MJL' })).toBeVisible();

  sql(`
    UPDATE llx_mjlfinancement_user_role SET is_active = 0, date_end = NOW() WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1;
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE entity = 1 AND fk_user = ${targetId};
  `);
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.locator('body')).toContainText(/Accès refusé|Access denied|Forbidden|Non autorisé/);

  await login(page, 'admin');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  const reassignmentToken = await page.locator('input[name="token"]').first().getAttribute('value');
  const reassignmentResponse = await page.request.post('/custom/mjlfinancement/admin/access.php', {
    form: {
      token: reassignmentToken,
      action: 'update_profile',
      user_id: targetId,
      role_code: 'VALIDATEUR_DEFINITIF',
      'scope_soc_ids[]': invited.firstScope,
    },
  });
  expect(reassignmentResponse.ok()).toBeTruthy();
  expect(() => sql(`UPDATE llx_user SET admin = 1 WHERE rowid = ${targetId}`)).toThrow();
  expect(sqlScalar(`SELECT admin FROM llx_user WHERE rowid = ${targetId}`)).toBe('0');
  sql(`
    UPDATE llx_mjlfinancement_user_role SET is_active = 0, date_end = NOW() WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1;
    UPDATE llx_user SET admin = 1 WHERE rowid = ${targetId};
  `);

  await page.goto('/custom/mjlfinancement/admin/access.php');
  const nativeAdminForm = page.locator(`form:has(input[name="user_id"][value="${targetId}"])`).first();
  await expect(nativeAdminForm.locator('select[name="role_code"]')).toHaveCount(0);
  await expect(nativeAdminForm.locator('input[name="role_code"][value="ADMIN_PLATEFORME"]')).toHaveCount(1);
  const nativeToken = await page.locator('input[name="token"]').first().getAttribute('value');
  const nativeResponse = await page.request.post('/custom/mjlfinancement/admin/access.php', {
    form: {
      token: nativeToken,
      action: 'update_profile',
      user_id: targetId,
      role_code: 'AGENT_SAISIE',
      'scope_soc_ids[]': invited.firstScope,
    },
  });
  expect(await nativeResponse.text()).toContain('L’action n’a pas pu être réalisée. Veuillez réessayer.');
  expect(sqlScalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1`)).toBe('0');

  const preservedAdminId = sqlScalar("SELECT rowid FROM llx_user WHERE login = 'admin' AND admin = 1 LIMIT 1");
  expect(() => sql(`
    INSERT INTO llx_mjlfinancement_user_role
      (entity, fk_user, role_code, is_active, date_start, source, date_creation)
    VALUES (0, ${preservedAdminId}, 'AGENT_SAISIE', 1, NOW(), 'rst001_native_probe', NOW());
  `)).toThrow();
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  await expect(page.locator('body')).toContainText(/Accès refusé|Access denied|Forbidden|Non autorisé/);
  expect(() => dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_current.php role_scope_schema.php')).not.toThrow();

  const agent = await inviteUser(page, `rst001.agent.${Date.now()}`);
  const agentId = sqlScalar(`SELECT rowid FROM llx_user WHERE login = '${agent.loginName}' LIMIT 1`);
  await page.goto('/custom/mjlfinancement/admin/access.php');
  const agentToken = await page.locator('input[name="token"]').first().getAttribute('value');
  await page.request.post('/custom/mjlfinancement/admin/access.php', {
    form: {
      token: agentToken,
      action: 'update_profile',
      user_id: agentId,
      role_code: 'AGENT_VERIFICATEUR',
      'scope_soc_ids[]': agent.firstScope,
    },
  });
  expect(sqlScalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = ${agentId} AND is_active = 1`)).toBe('AGENT_SAISIE');
  expect(exactMjlRights(agentId)).toBe('activity.read,activity.write');

  await page.goto('/custom/mjlfinancement/admin/access.php');
  const deactivateToken = await page.locator('input[name="token"]').first().getAttribute('value');
  const deactivateResponse = await page.request.post('/custom/mjlfinancement/admin/access.php', {
    form: {
      token: deactivateToken,
      action: 'deactivate',
      user_id: agentId,
    },
  });
  expect(deactivateResponse.ok()).toBeTruthy();
  expect(await deactivateResponse.text()).not.toContain('R&eacute;cup&eacute;ration administrative requise');
  expect(exactMjlRights(agentId)).toBe('');
});

test('MJL login and forgotten-password pages replace raw native auth UI', async ({ page }) => {
  await page.goto('/index.php');
  await expect(page.getByRole('heading', { name: 'MJL Financement' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mot de passe oublié' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);

  await page.goto('/user/passwordforgotten.php');
  await expect(page.getByRole('heading', { name: 'Mot de passe oublié' })).toBeVisible();
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Identifiant|Code sécurité|Register|Sign up|Créer un compte|Inscription/);
});

test('Admin invitation flow, landing page, and non-admin access blocking', async ({ page }) => {
  const invited = await inviteUser(page, `invite.${Date.now()}`);
  const invitedUserId = sqlScalar(`SELECT rowid FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`);
  expect(sqlScalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE fk_user = ${invitedUserId} AND is_active = 1 ORDER BY rowid DESC LIMIT 1`)).toBe('AGENT_SAISIE');
  expect(sqlScalar(`SELECT fk_soc FROM llx_mjlfinancement_user_soc_scope WHERE fk_user = ${invitedUserId} AND is_active = 1 ORDER BY rowid DESC LIMIT 1`)).toBe(invited.firstScope);

  await page.goto(invited.invitationLink);
  await expect(page.getByRole('heading', { name: 'Invitation MJL' })).toBeVisible();
  await page.locator('#newpass1').fill('MjlInvite2026!!');
  await page.locator('#newpass2').fill('MjlInvite2026!!');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();

  await login(page, invited.loginName, 'MjlInvite2026!!');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);

  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.locator('body')).toContainText(/Accès refusé|Access denied|Forbidden|Non autorisé/);
});

test('Admin assignment UI blocks self-deactivation and unresolved legacy access fails closed', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.getByText('Profil historique non résolu').first()).toBeVisible();

  const adminId = sqlScalar("SELECT rowid FROM llx_user WHERE login = 'admin.poc' LIMIT 1");
  await page.evaluate((userId) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/custom/mjlfinancement/admin/access.php';
    for (const [name, value] of Object.entries({ action: 'deactivate', user_id: userId, token: document.querySelector('input[name="token"]').value })) {
      const input = document.createElement('input');
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }, adminId);
  await expect(page.getByText('Vous ne pouvez pas désactiver votre propre accès.')).toBeVisible();

  await login(page, 'lecteur.audit');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.locator('body')).toContainText(/Accès refusé|Access denied|Forbidden|Non autorisé/);
});

test('access profile and deactivation mutations roll back when audit persistence fails', async ({ page }) => {
  const targetId = sqlScalar("SELECT rowid FROM llx_user WHERE login = 'agent.mjl' AND entity = 1 LIMIT 1");
  const originalStatus = sqlScalar(`SELECT statut FROM llx_user WHERE rowid = ${targetId}`);
  const originalRole = sqlScalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1 ORDER BY rowid DESC LIMIT 1`);
  const originalScopes = sqlScalar(`SELECT GROUP_CONCAT(fk_soc ORDER BY fk_soc) FROM llx_mjlfinancement_user_soc_scope WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1`);
  const scopeId = sqlScalar("SELECT rowid FROM llx_societe WHERE entity = 1 ORDER BY rowid LIMIT 1");

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  sql("CREATE TRIGGER authe2e_fail_access_audit BEFORE INSERT ON llx_mjlfinancement_access_audit FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced access audit failure'");
  try {
    let token = await page.locator('input[name="token"]').first().getAttribute('value');
    let response = await page.request.post('/custom/mjlfinancement/admin/access.php', {
      form: { token, action: 'update_profile', user_id: targetId, role_code: 'AGENT_VERIFICATEUR', 'scope_soc_ids[]': scopeId },
    });
    expect(await response.text()).not.toMatch(/SQLSTATE|forced access audit failure/i);
    expect(sqlScalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1 ORDER BY rowid DESC LIMIT 1`)).toBe(originalRole);
    expect(sqlScalar(`SELECT GROUP_CONCAT(fk_soc ORDER BY fk_soc) FROM llx_mjlfinancement_user_soc_scope WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1`)).toBe(originalScopes);

    await page.reload();
    token = await page.locator('input[name="token"]').first().getAttribute('value');
    response = await page.request.post('/custom/mjlfinancement/admin/access.php', {
      form: { token, action: 'deactivate', user_id: targetId },
    });
    expect(await response.text()).not.toMatch(/SQLSTATE|forced access audit failure/i);
    expect(sqlScalar(`SELECT statut FROM llx_user WHERE rowid = ${targetId}`)).toBe(originalStatus);
    expect(sqlScalar(`SELECT role_code FROM llx_mjlfinancement_user_role WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1 ORDER BY rowid DESC LIMIT 1`)).toBe(originalRole);
    expect(sqlScalar(`SELECT GROUP_CONCAT(fk_soc ORDER BY fk_soc) FROM llx_mjlfinancement_user_soc_scope WHERE entity = 1 AND fk_user = ${targetId} AND is_active = 1`)).toBe(originalScopes);
  } finally {
    sql('DROP TRIGGER IF EXISTS authe2e_fail_access_audit');
  }
});

test('double-submit invitation acceptance cannot disable an activated user', async ({ browser }) => {
  const setupPage = await browser.newPage();
  const invited = await inviteUser(setupPage, `double.${Date.now()}`);
  await setupPage.close();

  const contextOne = await browser.newContext();
  const contextTwo = await browser.newContext();
  const pageOne = await contextOne.newPage();
  const pageTwo = await contextTwo.newPage();
  await Promise.all([
    pageOne.goto(invited.invitationLink),
    pageTwo.goto(invited.invitationLink)
  ]);
  await Promise.all([
    pageOne.locator('#newpass1').fill('MjlDouble2026!!'),
    pageTwo.locator('#newpass1').fill('MjlDouble2026!!')
  ]);
  await Promise.all([
    pageOne.locator('#newpass2').fill('MjlDouble2026!!'),
    pageTwo.locator('#newpass2').fill('MjlDouble2026!!')
  ]);
  await Promise.allSettled([
    pageOne.getByRole('button', { name: 'Définir mon mot de passe' }).click(),
    pageTwo.getByRole('button', { name: 'Définir mon mot de passe' }).click()
  ]);
  await contextOne.close();
  await contextTwo.close();

  expect(sqlScalar(`SELECT statut FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`)).toBe('1');
  expect(sqlScalar(`SELECT status FROM llx_mjlfinancement_invitation i INNER JOIN llx_user u ON u.rowid = i.fk_user WHERE u.login = '${invited.loginName}' ORDER BY i.rowid DESC LIMIT 1`)).toBe('accepted');

  const verifyPage = await browser.newPage();
  await login(verifyPage, invited.loginName, 'MjlDouble2026!!');
  await expect(verifyPage).toHaveURL(/custom\/mjlfinancement\/index\.php/);
  await verifyPage.close();
});

test('stale revoke cannot overwrite an accepted invitation or deactivate user', async ({ page }) => {
  const invited = await inviteUser(page, `stalerevoke.${Date.now()}`);
  const invitationId = invitationIdForLogin(invited.loginName);

  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('MjlStaleRevoke2026!!');
  await page.locator('#newpass2').fill('MjlStaleRevoke2026!!');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await page.evaluate((id) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/custom/mjlfinancement/admin/access.php';
    for (const [name, value] of Object.entries({ action: 'revoke', id, token: document.querySelector('input[name="token"]').value })) {
      const input = document.createElement('input');
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }, invitationId);
  await expect(page.getByText('Cette invitation est déjà acceptée.')).toBeVisible();

  expect(sqlScalar(`SELECT statut FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`)).toBe('1');
  expect(sqlScalar(`SELECT status FROM llx_mjlfinancement_invitation WHERE rowid = ${invitationId}`)).toBe('accepted');
});

test('revoked invitation link cannot be accepted later', async ({ page }) => {
  const invited = await inviteUser(page, `revoked.${Date.now()}`);
  const invitationId = invitationIdForLogin(invited.loginName);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await page.locator(`form:has(input[name="id"][value="${invitationId}"]) button`, { hasText: 'Révoquer' }).click();
  await expect(page.getByText('Invitation révoquée.')).toBeVisible();

  await page.goto(invited.invitationLink);
  await expect(page.getByText('Cette invitation a été révoquée')).toBeVisible();
  expect(sqlScalar(`SELECT statut FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`)).toBe('0');
  expect(sqlScalar(`SELECT status FROM llx_mjlfinancement_invitation WHERE rowid = ${invitationId}`)).toBe('revoked');
});

test('forgotten password uses neutral response and does not mutate sample users', async ({ page }) => {
  const invited = await inviteUser(page, `reset.${Date.now()}`);
  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('MjlBeforeReset2026!!');
  await page.locator('#newpass2').fill('MjlBeforeReset2026!!');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();

  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse e-mail').fill('missing-user@mjl-poc.local');
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  const missingResponse = await page.locator('main').innerText();

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse e-mail').fill(invited.email);
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  const existingResponse = await page.locator('main').innerText();
  expect(existingResponse).toBe(missingResponse);

  await page.goto(latestLink('password_reset'));
  await expect(page.getByRole('heading', { name: 'Définir un nouveau mot de passe' })).toBeVisible();
  await page.locator('#newpass1').fill('MjlReset2026!!');
  await page.locator('#newpass2').fill('MjlReset2026!!');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();

  await login(page, invited.loginName, 'MjlReset2026!!');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
});

test('password reset lifecycle invalidates old and pending links', async ({ page }) => {
  const invited = await inviteUser(page, `resetlife.${Date.now()}`);
  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('MjlResetLife2026!!');
  await page.locator('#newpass2').fill('MjlResetLife2026!!');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse e-mail').fill(invited.email);
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  const firstLink = latestLink('password_reset');

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse e-mail').fill(invited.email);
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  const secondLink = latestLink('password_reset');
  expect(secondLink).not.toBe(firstLink);

  await page.goto(firstLink);
  await expect(page.getByText('Ce lien de réinitialisation est invalide ou expiré')).toBeVisible();

  const pendingToken = `pending-${Date.now()}`;
  const userId = sqlScalar(`SELECT rowid FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`);
  sql(`INSERT INTO llx_mjlfinancement_password_reset (entity, fk_user, status, token_hash, date_expiry, date_creation, fk_user_creat) VALUES (1, ${userId}, 'pending_send', SHA2('${pendingToken}', 256), DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW(), ${userId})`);
  await page.goto(`/user/passwordforgotten.php?setnewpassword=1&mjlreset=${pendingToken}`);
  await expect(page.getByText('Ce lien de réinitialisation est invalide ou expiré')).toBeVisible();

  await page.goto(secondLink);
  await page.locator('#newpass1').fill('MjlResetLifeNew2026!!');
  await page.locator('#newpass2').fill('MjlResetLifeNew2026!!');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();

  await page.goto(secondLink);
  await expect(page.getByText('Ce lien de réinitialisation est invalide ou expiré')).toBeVisible();
});

test('unsafe invitation targets are rejected without changing existing users', async ({ page }) => {
  const before = sqlScalar("SELECT CONCAT(admin, ':', statut, ':', email) FROM llx_user WHERE login = 'admin.poc' ORDER BY entity DESC LIMIT 1");

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await page.locator('#mjl-login').fill('admin.poc');
  await page.locator('#mjl-firstname').fill('Admin');
  await page.locator('#mjl-lastname').fill('Duplicate');
  await page.locator('#mjl-email').fill('admin.poc@mjl-poc.local');
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
  await expect(page.getByText('Cet identifiant correspond déjà à un utilisateur existant.')).toBeVisible();

  const after = sqlScalar("SELECT CONCAT(admin, ':', statut, ':', email) FROM llx_user WHERE login = 'admin.poc' ORDER BY entity DESC LIMIT 1");
  expect(after).toBe(before);

  await page.locator('#mjl-login').fill(`mjl.e2e.duplicate.${Date.now()}`);
  await page.locator('#mjl-firstname').fill('Duplicate');
  await page.locator('#mjl-lastname').fill('Email');
  await page.locator('#mjl-email').fill('agent.mjl@mjl-poc.local');
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
  await expect(page.getByText('Cette adresse e-mail est déjà utilisée.')).toBeVisible();
});

test('bad invitation password does not activate user and invalid links are safe', async ({ page }) => {
  const invited = await inviteUser(page, `badpass.${Date.now()}`);

  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('short');
  await page.locator('#newpass2').fill('short');
  await page.getByRole('button', { name: 'Définir mon mot de passe' }).click();
  await expect(page.locator('.mjl-auth-error[role="alert"][aria-live="assertive"]').getByText('Le mot de passe doit contenir au moins 10 caractères')).toBeVisible();
  expect(sqlScalar(`SELECT statut FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`)).toBe('0');

  await page.goto('/custom/mjlfinancement/invitation.php?invite=invalid-token');
  await expect(page.locator('[role="alert"][aria-live="assertive"]').getByText('Cette invitation est invalide')).toBeVisible();

  const pending = await inviteUser(page, `pending.${Date.now()}`);
  const pendingToken = tokenFromLink(pending.invitationLink, 'invite');
  sql(`UPDATE llx_mjlfinancement_invitation SET status = 'pending_send' WHERE token_hash = SHA2('${pendingToken}', 256)`);
  await page.goto(pending.invitationLink);
  await expect(page.getByText('Cette invitation est invalide')).toBeVisible();
});

test('password reset POST without a valid CSRF token is ignored safely', async ({ request }) => {
  const beforeLink = sqlScalar("SELECT COALESCE(MAX(value), '') FROM llx_const WHERE name = 'MJL_AUTH_E2E_LAST_PASSWORD_RESET_LINK' AND entity = 1");
  const beforeRows = sqlScalar("SELECT COUNT(*) FROM llx_mjlfinancement_password_reset");
  const response = await request.post('/user/passwordforgotten.php', {
    form: {
      action: 'mjl_build_password_reset',
      token: 'invalid-token',
      email: 'agent.mjl@mjl-poc.local'
    },
    maxRedirects: 0
  });
  expect([200, 302, 303]).toContain(response.status());
  expect(sqlScalar("SELECT COALESCE(MAX(value), '') FROM llx_const WHERE name = 'MJL_AUTH_E2E_LAST_PASSWORD_RESET_LINK' AND entity = 1")).toBe(beforeLink);
  expect(sqlScalar("SELECT COUNT(*) FROM llx_mjlfinancement_password_reset")).toBe(beforeRows);
});
