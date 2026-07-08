const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

const password = process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!';

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

function cleanupTestState() {
  sql(`
    SET @mjl_e2e_users = (SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'mjl.e2e.%' OR login LIKE 'invite.%');
    DELETE FROM llx_const WHERE entity = 1 AND name LIKE 'MJL_AUTH_E2E_%';
    DELETE FROM llx_usergroup_user WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_user_soc_scope WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_invitation WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_password_reset WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, ''));
    DELETE FROM llx_mjlfinancement_access_audit WHERE FIND_IN_SET(fk_user, COALESCE(@mjl_e2e_users, '')) OR FIND_IN_SET(fk_actor, COALESCE(@mjl_e2e_users, '')) OR context LIKE '%mjl.e2e.%' OR context LIKE '%invite.%' OR context LIKE '%delivery=e2e%';
    DELETE FROM llx_user WHERE FIND_IN_SET(rowid, COALESCE(@mjl_e2e_users, ''));
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

async function login(page, username, userPassword = password) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(username);
  await page.getByLabel('Mot de passe').fill(userPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

async function inviteUser(page, suffix) {
  const loginName = `mjl.e2e.${suffix}`;
  const email = `${loginName}@mjl-poc.local`;

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.getByText('Gestion des acces MJL').first()).toBeVisible();
  await page.locator('#mjl-login').fill(loginName);
  await page.locator('#mjl-firstname').fill('E2E');
  await page.locator('#mjl-lastname').fill('MJL');
  await page.locator('#mjl-email').fill(email);
  const firstScope = await page.locator('select[name="scope_soc_ids[]"] option').first().getAttribute('value');
  await page.locator('select[name="scope_soc_ids[]"]').first().selectOption(firstScope);
  await page.getByRole('button', { name: 'Envoyer l invitation' }).click();
  await expect(page.getByText('Invitation envoyee')).toBeVisible();
  const invitationLink = await page.locator('code').filter({ hasText: '/custom/mjlfinancement/invitation.php?invite=' }).textContent();

  return { loginName, email, invitationLink: invitationLink.trim(), firstScope };
}

test.beforeAll(() => {
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php');
  dockerExec('dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php');
  cleanupTestState();
  enableE2eTokens();
});

test.afterAll(() => {
  cleanupTestState();
});

test('MJL login and forgotten-password pages replace raw native auth UI', async ({ page }) => {
  await page.goto('/index.php');
  await expect(page.getByRole('heading', { name: 'MJL Financement' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mot de passe oublie' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Register|Sign up|Créer un compte|Inscription/);

  await page.goto('/user/passwordforgotten.php');
  await expect(page.getByRole('heading', { name: 'Mot de passe oublie' })).toBeVisible();
  await expect(page.getByLabel('Adresse email')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Identifiant|Code sécurité|Register|Sign up|Créer un compte|Inscription/);
});

test('phase 4 auth schema exposes reset lifecycle status', async () => {
  expect(sqlScalar("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_password_reset' AND COLUMN_NAME = 'status'")).toBe('1');
  expect(sqlScalar("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_password_reset' AND INDEX_NAME = 'idx_mjlfinancement_password_reset_status'")).toBe('1');
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
  await page.getByRole('button', { name: 'Definir mon mot de passe' }).click();
  await expect(page.getByText('Votre acces est active')).toBeVisible();

  await login(page, invited.loginName, 'MjlInvite2026!!');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);

  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.locator('body')).toContainText(/Accès refusé|Access denied|Forbidden|Non autorisé/);
});

test('Admin assignment UI blocks self-deactivation and unresolved legacy access fails closed', async ({ page }) => {
  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await expect(page.getByText('Profil legacy non resolu').first()).toBeVisible();

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
  await expect(page.getByText('Vous ne pouvez pas desactiver votre propre acces')).toBeVisible();

  await login(page, 'lecteur.audit');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.locator('body')).toContainText(/Accès refusé|Access denied|Forbidden|Non autorisé/);
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
    pageOne.getByRole('button', { name: 'Definir mon mot de passe' }).click(),
    pageTwo.getByRole('button', { name: 'Definir mon mot de passe' }).click()
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
  await page.getByRole('button', { name: 'Definir mon mot de passe' }).click();
  await expect(page.getByText('Votre acces est active')).toBeVisible();

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
  await expect(page.getByText('Cette invitation est deja acceptee')).toBeVisible();

  expect(sqlScalar(`SELECT statut FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`)).toBe('1');
  expect(sqlScalar(`SELECT status FROM llx_mjlfinancement_invitation WHERE rowid = ${invitationId}`)).toBe('accepted');
});

test('revoked invitation link cannot be accepted later', async ({ page }) => {
  const invited = await inviteUser(page, `revoked.${Date.now()}`);
  const invitationId = invitationIdForLogin(invited.loginName);

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await page.locator(`form:has(input[name="id"][value="${invitationId}"]) button`, { hasText: 'Revoquer' }).click();
  await expect(page.getByText('Invitation revoquee')).toBeVisible();

  await page.goto(invited.invitationLink);
  await expect(page.getByText('Cette invitation a ete revoquee')).toBeVisible();
  expect(sqlScalar(`SELECT statut FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`)).toBe('0');
  expect(sqlScalar(`SELECT status FROM llx_mjlfinancement_invitation WHERE rowid = ${invitationId}`)).toBe('revoked');
});

test('forgotten password uses neutral response and does not mutate sample users', async ({ page }) => {
  const invited = await inviteUser(page, `reset.${Date.now()}`);
  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('MjlBeforeReset2026!!');
  await page.locator('#newpass2').fill('MjlBeforeReset2026!!');
  await page.getByRole('button', { name: 'Definir mon mot de passe' }).click();

  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse email').fill('missing-user@mjl-poc.local');
  await page.getByRole('button', { name: 'Reinitialiser le mot de passe' }).click();
  await expect(page.getByText('Si un compte correspond a cette adresse')).toBeVisible();

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse email').fill(invited.email);
  await page.getByRole('button', { name: 'Reinitialiser le mot de passe' }).click();
  await expect(page.getByText('Si un compte correspond a cette adresse')).toBeVisible();

  await page.goto(latestLink('password_reset'));
  await expect(page.getByRole('heading', { name: 'Definir un nouveau mot de passe' })).toBeVisible();
  await page.locator('#newpass1').fill('MjlReset2026!!');
  await page.locator('#newpass2').fill('MjlReset2026!!');
  await page.getByRole('button', { name: 'Definir mon mot de passe' }).click();
  await expect(page.getByText('Votre mot de passe a ete mis a jour')).toBeVisible();

  await login(page, invited.loginName, 'MjlReset2026!!');
  await expect(page).toHaveURL(/custom\/mjlfinancement\/index\.php/);
});

test('password reset lifecycle invalidates old and pending links', async ({ page }) => {
  const invited = await inviteUser(page, `resetlife.${Date.now()}`);
  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('MjlResetLife2026!!');
  await page.locator('#newpass2').fill('MjlResetLife2026!!');
  await page.getByRole('button', { name: 'Definir mon mot de passe' }).click();

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse email').fill(invited.email);
  await page.getByRole('button', { name: 'Reinitialiser le mot de passe' }).click();
  const firstLink = latestLink('password_reset');

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse email').fill(invited.email);
  await page.getByRole('button', { name: 'Reinitialiser le mot de passe' }).click();
  const secondLink = latestLink('password_reset');
  expect(secondLink).not.toBe(firstLink);

  await page.goto(firstLink);
  await expect(page.getByText('Ce lien de reinitialisation est invalide ou expire')).toBeVisible();

  const pendingToken = `pending-${Date.now()}`;
  const userId = sqlScalar(`SELECT rowid FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`);
  sql(`INSERT INTO llx_mjlfinancement_password_reset (entity, fk_user, status, token_hash, date_expiry, date_creation, fk_user_creat) VALUES (1, ${userId}, 'pending_send', SHA2('${pendingToken}', 256), DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW(), ${userId})`);
  await page.goto(`/user/passwordforgotten.php?setnewpassword=1&mjlreset=${pendingToken}`);
  await expect(page.getByText('Ce lien de reinitialisation est invalide ou expire')).toBeVisible();

  await page.goto(secondLink);
  await page.locator('#newpass1').fill('MjlResetLifeNew2026!!');
  await page.locator('#newpass2').fill('MjlResetLifeNew2026!!');
  await page.getByRole('button', { name: 'Definir mon mot de passe' }).click();
  await expect(page.getByText('Votre mot de passe a ete mis a jour')).toBeVisible();

  await page.goto(secondLink);
  await expect(page.getByText('Ce lien de reinitialisation est invalide ou expire')).toBeVisible();
});

test('unsafe invitation targets are rejected without changing existing users', async ({ page }) => {
  const before = sqlScalar("SELECT CONCAT(admin, ':', statut, ':', email) FROM llx_user WHERE login = 'admin.poc' ORDER BY entity DESC LIMIT 1");

  await login(page, 'admin.poc');
  await page.goto('/custom/mjlfinancement/admin/access.php');
  await page.locator('#mjl-login').fill('admin.poc');
  await page.locator('#mjl-firstname').fill('Admin');
  await page.locator('#mjl-lastname').fill('Duplicate');
  await page.locator('#mjl-email').fill('admin.poc@mjl-poc.local');
  await page.getByRole('button', { name: 'Envoyer l invitation' }).click();
  await expect(page.getByText('Cet identifiant correspond deja a un utilisateur existant')).toBeVisible();

  const after = sqlScalar("SELECT CONCAT(admin, ':', statut, ':', email) FROM llx_user WHERE login = 'admin.poc' ORDER BY entity DESC LIMIT 1");
  expect(after).toBe(before);

  await page.locator('#mjl-login').fill(`mjl.e2e.duplicate.${Date.now()}`);
  await page.locator('#mjl-firstname').fill('Duplicate');
  await page.locator('#mjl-lastname').fill('Email');
  await page.locator('#mjl-email').fill('agent.mjl@mjl-poc.local');
  await page.getByRole('button', { name: 'Envoyer l invitation' }).click();
  await expect(page.getByText('Cette adresse email est deja utilisee')).toBeVisible();
});

test('bad invitation password does not activate user and invalid links are safe', async ({ page }) => {
  const invited = await inviteUser(page, `badpass.${Date.now()}`);

  await page.goto(invited.invitationLink);
  await page.locator('#newpass1').fill('short');
  await page.locator('#newpass2').fill('short');
  await page.getByRole('button', { name: 'Definir mon mot de passe' }).click();
  await expect(page.locator('.mjl-auth-error').getByText('Le mot de passe doit contenir au moins 10 caracteres')).toBeVisible();
  expect(sqlScalar(`SELECT statut FROM llx_user WHERE login = '${invited.loginName}' LIMIT 1`)).toBe('0');

  await page.goto('/custom/mjlfinancement/invitation.php?invite=invalid-token');
  await expect(page.getByText('Cette invitation est invalide')).toBeVisible();

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
