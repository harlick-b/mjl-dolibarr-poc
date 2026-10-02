const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { createUserReferenceFixtureSet } = require('../helpers/user-reference-fixture');
const { composeExec, registerSecret, scalar, sql } = require('../helpers/mjl-test-runtime');

let fixture;
const emails = Object.create(null);
const registeredCodes = new Set();
let searchableTextColumns = null;

test.describe.configure({ mode: 'serial' });

function outbox(type) {
  const raw = composeExec('dolibarr', ['cat', `/var/www/documents/mjlfinancement/email-test-outbox/latest-${type}.json`], 'utf8');
  return JSON.parse(raw);
}

async function registerOtp(code) {
  if (registeredCodes.has(code)) return;
  await registerSecret('login otp', code);
  registeredCodes.add(code);
}

async function registerLink(link) {
  const url = new URL(link, process.env.MJL_BASE_URL);
  const selector = url.searchParams.get('selector') || url.searchParams.get('mjlselector');
  const verifier = url.hash.slice('#verifier='.length);
  await registerSecret('auth selector', selector);
  await registerSecret('auth verifier', verifier);
  await registerSecret('auth token hash', crypto.createHash('sha256').update(verifier).digest('hex'));
}

async function openFragmentLink(page, link) {
  await page.goto(link);
  if (new URL(page.url()).hash) await page.reload();
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quotedIdentifier(value) {
  if (!/^[A-Za-z0-9_$]+$/.test(value)) throw new Error(`Unsafe database identifier: ${value}`);
  return `\`${value}\``;
}

function databasePlaintextHits(value) {
  if (searchableTextColumns === null) {
    searchableTextColumns = scalar("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND DATA_TYPE IN ('char','varchar','tinytext','text','mediumtext','longtext','enum','set','json') AND COLUMN_NAME NOT REGEXP '(hash|pass|token)' ORDER BY TABLE_NAME,ORDINAL_POSITION")
      .split('\n').filter(Boolean).map((line) => line.split('\t'));
  }
  const scans = searchableTextColumns.map(([table, column]) => `SELECT CONVERT(${quotedIdentifier(column)} USING utf8mb4) COLLATE utf8mb4_bin AS value FROM ${quotedIdentifier(table)}`);
  if (scans.length === 0) return '0';
  return scalar(`SELECT COUNT(*) FROM (${scans.join(' UNION ALL ')}) AS all_database_text WHERE INSTR(COALESCE(value,''),${sqlLiteral(value)}) > 0`);
}

async function issueInvitation(login, email) {
  const request = JSON.stringify({ operation: 'issue', login, email, barrier: '' });
  const result = JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/auth-parallel-worker.php'], { encoding: 'utf8', env: process.env, input: request }).trim());
  if (!Array.isArray(result) || typeof result[0] !== 'string' || !result[0].includes('#verifier=')) throw new Error('Invitation worker failed.');
  await registerLink(result[0]);
  return result[0];
}

async function startLogin(page, key, password = process.env.MJL_TEST_USER_PASSWORD) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Adresse email').fill(emails[key]);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Vérification' })).toBeVisible();
}

function staleLastSend(key) {
  sql(`UPDATE llx_mjlfinancement_login_otp SET date_last_send=DATE_SUB(NOW(), INTERVAL 61 SECOND) WHERE entity=1 AND fk_user=${fixture.users[key].id} AND status='pending'`);
}

test.beforeAll(({}, workerInfo) => {
  fixture = createUserReferenceFixtureSet({
    namespace: `auth.login${workerInfo.workerIndex}`,
    entity: 1,
    users: ['success', 'race', 'lock', 'resend', 'expired', 'changed', 'existing', 'policy'].map((key) => ({ key, role: 'AGENT_SAISIE' })),
    references: { partners: [], projects: [], operationTypes: [] },
  });
  for (const key of Object.keys(fixture.users)) emails[key] = `${fixture.users[key].login}@example.test`;
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_OTP_ENABLED',1,'1','chaine',0,'Disposable Auth verification'),('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'Disposable Auth verification'),('MAIN_LOGEVENTS_USER_LOGIN_FAILED',1,'1','chaine',0,'Disposable Auth verification') ON DUPLICATE KEY UPDATE value='1'");
});

test.afterAll(() => {
  sql("DELETE FROM llx_const WHERE name IN ('MJL_AUTH_OTP_ENABLED','MAIN_LOGEVENTS_USER_LOGIN_FAILED') AND entity=1");
});

test('password verification stays unauthenticated until a single-use email code succeeds', async ({ page }) => {
  const failedLoginsBefore = Number(scalar("SELECT COUNT(*) FROM llx_events WHERE type='USER_LOGIN_FAILED'"));
  await page.goto('/index.php');
  await page.getByLabel('Adresse email').fill(emails.success);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Incorrect1!');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByLabel('Adresse email')).toHaveValue(emails.success);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_events WHERE type='USER_LOGIN_FAILED'")) - failedLoginsBefore).toBe(1);
  await startLogin(page, 'success');
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Tableau de bord|Administration/ })).toHaveCount(0);
  const deniedPost = await page.context().request.post('/custom/mjlfinancement/workflowactions.php', { form: { action: 'export' }, maxRedirects: 0 });
  expect(deniedPost.status()).toBeGreaterThanOrEqual(300);
  await page.goto('/custom/mjlfinancement/auth.php');

  const code = outbox('login_otp').code;
  await registerOtp(code);
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel('Code de vérification').fill(code);
  await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(page).toHaveURL(/\/custom\/mjlfinancement\/index\.php$/);
  expect(scalar(`SELECT CONCAT(status,':',IFNULL(code_hash,'NULL')) FROM llx_mjlfinancement_login_otp WHERE fk_user=${fixture.users.success.id} ORDER BY rowid DESC LIMIT 1`)).toBe('verified:NULL');
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='login_otp_verified' AND object_id=${fixture.users.success.id}`)).toBe('1');

  await page.goto('/user/logout.php');
  await page.goto('/index.php');
  const token = await page.locator('input[name="token"]').inputValue();
  await page.context().request.post('/custom/mjlfinancement/auth.php', { form: { token, action: 'verify', code } });
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_login_otp WHERE fk_user=${fixture.users.success.id} AND status='verified'`)).toBe('1');
});

test('concurrent verification can consume a challenge only once', async ({ page }) => {
  await startLogin(page, 'race');
  const code = outbox('login_otp').code;
  await registerOtp(code);
  const token = await page.locator('form:has(input[name="action"][value="verify"]) input[name="token"]').inputValue();
  await Promise.all([
    page.context().request.post('/custom/mjlfinancement/auth.php', { form: { token, action: 'verify', code }, maxRedirects: 0 }),
    page.context().request.post('/custom/mjlfinancement/auth.php', { form: { token, action: 'verify', code }, maxRedirects: 0 }),
  ]);
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_login_otp WHERE fk_user=${fixture.users.race.id} AND status='verified'`)).toBe('1');
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='login_otp_verified' AND object_id=${fixture.users.race.id}`)).toBe('1');
});

test('wrong attempts and resend counters survive a password re-login and apply across browsers', async ({ browser }) => {
  const first = await browser.newPage();
  await startLogin(first, 'lock');
  const realCode = outbox('login_otp').code;
  await registerOtp(realCode);
  const wrong = realCode === '999999' ? '000000' : String(Number(realCode) + 1).padStart(6, '0');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await first.getByLabel('Code de vérification').fill(wrong);
    await first.getByRole('button', { name: 'Vérifier', exact: true }).click();
    await expect(first.getByText('Code incorrect.')).toBeVisible();
  }

  const second = await browser.newPage();
  await startLogin(second, 'lock');
  expect(scalar(`SELECT CONCAT(COUNT(*),':',MAX(attempt_count),':',MAX(resend_count)) FROM llx_mjlfinancement_login_otp WHERE fk_user=${fixture.users.lock.id} AND status='pending'`)).toBe('1:2:0');
  await first.goto('/custom/mjlfinancement/index.php');
  await expect(first.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await second.getByLabel('Code de vérification').fill(wrong);
    await second.getByRole('button', { name: 'Vérifier', exact: true }).click();
  }
  await expect(second.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  expect(scalar(`SELECT CONCAT(status,':',attempt_count) FROM llx_mjlfinancement_login_otp WHERE fk_user=${fixture.users.lock.id} ORDER BY rowid DESC LIMIT 1`)).toBe('locked:5');

  const third = await browser.newPage();
  await third.goto('/index.php');
  await third.getByLabel('Adresse email').fill(emails.lock);
  await third.getByLabel('Mot de passe', { exact: true }).fill(process.env.MJL_TEST_USER_PASSWORD);
  await third.getByRole('button', { name: 'Se connecter' }).click();
  await expect(third.getByText(/Trop de codes incorrects/)).toBeVisible();
  await first.context().close(); await second.context().close(); await third.context().close();
});

test('resend invalidates the prior code, keeps attempts, and stops after three sends', async ({ page }) => {
  await startLogin(page, 'resend');
  const firstCode = outbox('login_otp').code;
  await registerOtp(firstCode);
  staleLastSend('resend');
  await page.getByRole('button', { name: 'Renvoyer le code' }).click();
  const secondCode = outbox('login_otp').code;
  await registerOtp(secondCode);
  await page.getByLabel('Code de vérification').fill(firstCode);
  await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(page.getByText('Code incorrect.')).toBeVisible();

  for (let resend = 2; resend <= 3; resend += 1) {
    staleLastSend('resend');
    await page.getByRole('button', { name: 'Renvoyer le code' }).click();
    await registerOtp(outbox('login_otp').code);
  }
  staleLastSend('resend');
  await page.getByRole('button', { name: 'Renvoyer le code' }).click();
  await expect(page.getByText('Le renvoi est temporairement indisponible.')).toBeVisible();
  expect(scalar(`SELECT CONCAT(attempt_count,':',resend_count) FROM llx_mjlfinancement_login_otp WHERE fk_user=${fixture.users.resend.id} AND status='pending'`)).toBe('1:3');
});

test('an expired code keeps the OTP screen available and resend issues a usable replacement', async ({ page }) => {
  await startLogin(page, 'expired');
  const expiredCode = outbox('login_otp').code;
  await registerOtp(expiredCode);
  sql(`UPDATE llx_mjlfinancement_login_otp SET date_expiry=DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE entity=1 AND fk_user=${fixture.users.expired.id} AND status='pending'`);
  await page.getByLabel('Code de vérification').fill(expiredCode);
  await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(page.getByText('Ce code a expiré.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vérification' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Renvoyer le code' })).toBeVisible();

  staleLastSend('expired');
  await page.getByRole('button', { name: 'Renvoyer le code' }).click();
  const replacementCode = outbox('login_otp').code;
  await registerOtp(replacementCode);
  expect(replacementCode).not.toBe(expiredCode);
  await page.getByLabel('Code de vérification').fill(replacementCode);
  await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(page).toHaveURL(/\/custom\/mjlfinancement\/index\.php$/);
});

test('an account change during verification cancels the pending challenge', async ({ page }) => {
  await startLogin(page, 'changed');
  const code = outbox('login_otp').code;
  await registerOtp(code);
  sql(`UPDATE llx_user SET statut=0 WHERE rowid=${fixture.users.changed.id}`);
  try {
    await page.getByLabel('Code de vérification').fill(code);
    await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    expect(scalar(`SELECT status FROM llx_mjlfinancement_login_otp WHERE fk_user=${fixture.users.changed.id} ORDER BY rowid DESC LIMIT 1`)).toBe('cancelled');
  } finally {
    sql(`UPDATE llx_user SET statut=1 WHERE rowid=${fixture.users.changed.id}`);
  }
});

test('existing sessions, native login and native reset actions cannot bypass MJL authentication', async ({ page, request }) => {
  sql("UPDATE llx_const SET value='0' WHERE name='MJL_AUTH_OTP_ENABLED' AND entity=1");
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(fixture.users.existing.login);
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.MJL_TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
  sql("UPDATE llx_const SET value='1' WHERE name='MJL_AUTH_OTP_ENABLED' AND entity=1");
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();

  const nativeLogin = await request.post('/index.php', { form: { actionlogin: 'login', loginfunction: 'loginfunction', username: emails.existing, password: process.env.MJL_TEST_USER_PASSWORD }, maxRedirects: 0 });
  expect(nativeLogin.status()).not.toBe(302);
  const nativeProtected = await request.get('/custom/mjlfinancement/index.php', { maxRedirects: 0 });
  const nativeProtectedBody = await nativeProtected.text();
  expect(nativeProtected.status() >= 300 || nativeProtectedBody.includes('Connexion')).toBe(true);
  expect(nativeProtectedBody).not.toContain('Tableau de bord');
  const passBefore = scalar(`SELECT pass_crypted FROM llx_user WHERE rowid=${fixture.users.existing.id}`);
  for (const action of ['buildnewpassword', 'validatenewpassword']) {
    await page.goto('/user/passwordforgotten.php');
    const token = await page.locator('input[name="token"]').inputValue();
    const response = await page.context().request.post('/user/passwordforgotten.php', { form: { token, action, username: emails.existing, newpassword: 'Bypass1!' }, maxRedirects: 0 });
    expect([302, 303]).toContain(response.status());
    expect(response.headers().location).toContain('/user/passwordforgotten.php');
  }
  expect(scalar(`SELECT pass_crypted FROM llx_user WHERE rowid=${fixture.users.existing.id}`)).toBe(passBefore);
});

test('invitation and reset password rules match on client and server', async ({ page }) => {
  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse email').fill(emails.policy);
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  const link = outbox('password_reset').link;
  await registerLink(link);
  const invalidPasswords = ['Aa1!aaa', 'abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdef12'];
  for (const password of invalidPasswords) {
    await openFragmentLink(page, link);
    await expect(page.getByText(emails.policy, { exact: true })).toBeVisible();
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(password);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password);
    await expect(page.getByRole('button', { name: 'Réinitialiser le mot de passe' })).toBeDisabled();
    await page.evaluate(() => document.querySelector('#mjl-password-reset').submit());
    await expect(page.getByText('Le mot de passe ne respecte pas les critères requis.')).toBeVisible();
  }
  await openFragmentLink(page, link);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('Abcdef1!');
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill('Abcdef1?');
  await expect(page.getByText('Les mots de passe ne correspondent pas.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réinitialiser le mot de passe' })).toBeDisabled();
  await openFragmentLink(page, link);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('Abcdef1<');
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill('Abcdef1<');
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await page.getByLabel('Adresse email').fill(emails.policy);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Abcdef1<');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Vérification' })).toBeVisible();
  await registerOtp(outbox('login_otp').code);
});

test('accepting an invitation clears an existing authenticated session', async ({ page }) => {
  await startLogin(page, 'changed');
  const code = outbox('login_otp').code;
  await registerOtp(code);
  await page.getByLabel('Code de vérification').fill(code);
  await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(page).toHaveURL(/\/custom\/mjlfinancement\/index\.php$/);

  const invitationEmail = 'auth.invitation.session@example.test';
  const link = await issueInvitation('auth.invitation.session', invitationEmail);
  await openFragmentLink(page, link);
  await expect(page.getByText(invitationEmail, { exact: true })).toBeVisible();
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('Abcdef1!');
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill('Abcdef1!');
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
});

test('auth shell remains keyboard usable on desktop and reflows on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/index.php');
  await expect(page.locator('.mjl-auth-sidebar')).toBeVisible();
  expect(await page.locator('body').evaluate((node) => getComputedStyle(node).fontFamily)).toContain('Inter');
  await page.getByLabel('Adresse email').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('login-desktop.png'), fullPage: true });

  await startLogin(page, 'changed');
  const code = outbox('login_otp').code;
  await registerOtp(code);
  await page.getByLabel('Code de vérification').pressSequentially(code === '123456' ? '654321' : '123456');
  await expect(page.locator('.mjl-otp-slots span').filter({ hasText: /\d/ })).toHaveCount(6);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mjl-auth-sidebar')).toBeHidden();
  const panel = await page.locator('.mjl-auth-panel').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('otp-mobile.png'), fullPage: true });
});

test('OTP values remain confined to the disposable file outbox', async () => {
  for (const code of registeredCodes) {
    expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_login_otp WHERE code_hash='${code}' OR session_hash='${code}' OR credential_hash='${code}'`)).toBe('0');
    expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE context_json LIKE '%${code}%'`)).toBe('0');
    expect(scalar(`SELECT COUNT(*) FROM llx_const WHERE value LIKE '%${code}%' OR note LIKE '%${code}%'`)).toBe('0');
    expect(databasePlaintextHits(code)).toBe('0');
  }
  const logs = execFileSync('docker', ['compose', 'logs', '--no-color', 'dolibarr'], { encoding: 'utf8', env: process.env });
  for (const code of registeredCodes) expect(logs.includes(code)).toBe(false);
});
