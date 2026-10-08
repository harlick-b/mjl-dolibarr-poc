const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const { createUserReferenceFixtureSet } = require('../helpers/user-reference-fixture');
const { composeExec, registerSecret, scalar, sql } = require('../helpers/mjl-test-runtime');

let fixture;
const emails = Object.create(null);
const registeredCodes = new Set();
let searchableTextColumns = null;
const adminEmail = 'auth.technical-admin@example.test';
let adminId;

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

function issueInvitationResult(login, email) {
  const request = JSON.stringify({ operation: 'issue', login, email, barrier: '' });
  return JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/auth-parallel-worker.php'], { encoding: 'utf8', env: process.env, input: request }).trim());
}

function requestResetResult(email) {
  const request = JSON.stringify({ operation: 'reset', email, barrier: '' });
  return JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/auth-parallel-worker.php'], { encoding: 'utf8', env: process.env, input: request }).trim());
}

async function ownedSessionKeys(page) {
  const cookie = (await page.context().cookies()).find((candidate) => candidate.name.includes('DOLSESSID'));
  if (!cookie) return [];
  const source = "$_COOKIE[$argv[1]]=$argv[2]; define('NOLOGIN',1); require '/var/www/html/main.inc.php'; echo json_encode(array_values(array_filter(array_keys($_SESSION), function ($key) { return in_array($key, array('dol_login','dol_logindate','dol_authmode','dol_entity','dol_loginmesg'), true) || strpos($key, 'mjl_otp_') === 0; })));";
  return JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '-r', source, cookie.name, cookie.value], { encoding: 'utf8', env: process.env }).trim());
}

async function issueInvitation(login, email) {
  const result = issueInvitationResult(login, email);
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
  adminId = Number(scalar('SELECT rowid FROM llx_user WHERE entity=0 AND admin=1 AND statut=1 ORDER BY rowid'));
  if (!Number.isSafeInteger(adminId) || adminId <= 0) throw new Error('The retained technical Admin is unavailable.');
  sql(`UPDATE llx_user SET email=${sqlLiteral(adminEmail)} WHERE rowid=${adminId} AND entity=0 AND admin=1`);
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
	await page.reload();
	await expect(page.getByLabel('Adresse email')).toHaveValue('');
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

test('invitation and reset mutations reject direct GET requests without changing credentials', async ({ page }) => {
  const invitationEmail = 'auth.method.invitation@example.test';
  const invitationLink = await issueInvitation('auth.method.invitation', invitationEmail);
  const invitationUrl = new URL(invitationLink, process.env.MJL_BASE_URL);
  const invitationSelector = invitationUrl.searchParams.get('selector');
  const invitationVerifier = invitationUrl.hash.slice('#verifier='.length);
  await openFragmentLink(page, invitationLink);
  const invitationToken = await page.locator('#mjl-invitation-accept input[name="token"]').inputValue();
  const invitationGet = new URL('/custom/mjlfinancement/invitation.php', process.env.MJL_BASE_URL);
  for (const [key, value] of Object.entries({ action: 'accept', selector: invitationSelector, verifier: invitationVerifier, newpass1: 'Abcdef1!', newpass2: 'Abcdef1!', token: invitationToken })) invitationGet.searchParams.set(key, value);
  const invitationResponse = await page.context().request.get(invitationGet.href, { maxRedirects: 0 });
  expect(invitationResponse.status()).toBe(200);
  expect(scalar("SELECT CONCAT(u.statut,':',i.status,':',IF(i.token_hash IS NULL,'NULL','HASH')) FROM llx_user u JOIN llx_mjlfinancement_invitation i ON i.fk_user=u.rowid WHERE u.login='auth.method.invitation' ORDER BY i.rowid DESC LIMIT 1")).toBe('0:sent:HASH');

  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse email').fill(emails.existing);
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  const resetLink = outbox('password_reset').link;
  await registerLink(resetLink);
  const resetUrl = new URL(resetLink, process.env.MJL_BASE_URL);
  const resetSelector = resetUrl.searchParams.get('mjlselector');
  const resetVerifier = resetUrl.hash.slice('#verifier='.length);
  await openFragmentLink(page, resetLink);
  const resetToken = await page.locator('#mjl-password-reset input[name="token"]').inputValue();
  const passBefore = scalar(`SELECT pass_crypted FROM llx_user WHERE rowid=${fixture.users.existing.id}`);
  const resetGet = new URL('/user/passwordforgotten.php', process.env.MJL_BASE_URL);
  for (const [key, value] of Object.entries({ setnewpassword: '1', action: 'mjl_validate_password_reset', mjlselector: resetSelector, verifier: resetVerifier, newpass1: 'Abcdef1!', newpass2: 'Abcdef1!', token: resetToken })) resetGet.searchParams.set(key, value);
  const resetResponse = await page.context().request.get(resetGet.href, { maxRedirects: 0 });
  expect([200, 302, 303]).toContain(resetResponse.status());
  expect(scalar(`SELECT CONCAT(status,':',IF(token_hash IS NULL,'NULL','HASH')) FROM llx_mjlfinancement_password_reset WHERE entity=1 AND fk_user=${fixture.users.existing.id} ORDER BY rowid DESC LIMIT 1`)).toBe('sent:HASH');
  expect(scalar(`SELECT pass_crypted FROM llx_user WHERE rowid=${fixture.users.existing.id}`)).toBe(passBefore);
});

test('a reset selector alone exposes the current full email until privacy behavior is separately authorized', async ({ page }) => {
  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse email').fill(emails.changed);
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  const resetUrl = new URL(outbox('password_reset').link, process.env.MJL_BASE_URL);
  await page.goto(`/user/passwordforgotten.php?setnewpassword=1&mjlselector=${encodeURIComponent(resetUrl.searchParams.get('mjlselector'))}`);
  await expect(page.getByText(emails.changed, { exact: true })).toBeVisible();
});

test('delivery capture failure and post-send result persistence failure retain their distinct states', async () => {
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_FAIL_AUTH_OUTBOX',1,'1','chaine',0,'W4 capture failure') ON DUPLICATE KEY UPDATE value='1'");
  try {
    const captureFailure = issueInvitationResult('auth.delivery.capture', 'auth.delivery.capture@example.test');
    expect(captureFailure[0]).toBe('');
    expect(scalar("SELECT CONCAT(i.status,':',IFNULL(i.token_hash,'NULL')) FROM llx_mjlfinancement_invitation i JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login='auth.delivery.capture' ORDER BY i.rowid DESC LIMIT 1")).toBe('send_failed:NULL');
	const resetCaptureFailure = requestResetResult(emails.lock);
	expect(resetCaptureFailure[0]).toBeNull();
	expect(scalar(`SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_password_reset WHERE entity=1 AND fk_user=${fixture.users.lock.id} ORDER BY rowid DESC LIMIT 1`)).toBe('send_failed:NULL');
  } finally {
    sql("DELETE FROM llx_const WHERE name='MJL_AUTH_E2E_FAIL_AUTH_OUTBOX' AND entity=1");
  }

  sql("CREATE TRIGGER llx_mjl_w4_invitation_result_fail BEFORE UPDATE ON llx_mjlfinancement_invitation FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected post-send result failure'");
  try {
    const resultFailure = issueInvitationResult('auth.delivery.result', 'auth.delivery.result@example.test');
    expect(resultFailure[0]).toBe('');
    expect(resultFailure[1]).toContain('résultat de l’envoi');
    expect(scalar("SELECT CONCAT(i.status,':',IF(i.token_hash IS NULL,'NULL','HASH')) FROM llx_mjlfinancement_invitation i JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login='auth.delivery.result' ORDER BY i.rowid DESC LIMIT 1")).toBe('pending_send:HASH');
    expect(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_audit_event a JOIN llx_user u ON u.rowid=a.object_id WHERE u.login='auth.delivery.result' AND a.action='invitation_issued'")).toBe('1');
  } finally {
    sql('DROP TRIGGER IF EXISTS llx_mjl_w4_invitation_result_fail');
  }

  sql("CREATE TRIGGER llx_mjl_w4_reset_result_fail BEFORE UPDATE ON llx_mjlfinancement_password_reset FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected post-send result failure'");
  try {
	const resetResultFailure = requestResetResult(emails.resend);
	expect(resetResultFailure[0]).toBeNull();
	expect(scalar(`SELECT CONCAT(status,':',IF(token_hash IS NULL,'NULL','HASH')) FROM llx_mjlfinancement_password_reset WHERE entity=1 AND fk_user=${fixture.users.resend.id} ORDER BY rowid DESC LIMIT 1`)).toBe('pending_send:HASH');
	expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='mjlfinancement_user' AND object_id=${fixture.users.resend.id} AND action='password_reset_requested'`)).toBe('1');
  } finally {
	sql('DROP TRIGGER IF EXISTS llx_mjl_w4_reset_result_fail');
  }
});

test('OTP persistence commits before a failed session completion and authentication stays closed', async ({ page }) => {
  await startLogin(page, 'changed');
  const code = outbox('login_otp').code;
  await registerOtp(code);
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_FAIL_SESSION_COMPLETION',1,'1','chaine',0,'W4 ordering proof') ON DUPLICATE KEY UPDATE value='1'");
  try {
    await page.getByLabel('Code de vérification').fill(code);
    await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    expect(scalar(`SELECT CONCAT(status,':',IFNULL(code_hash,'NULL')) FROM llx_mjlfinancement_login_otp WHERE fk_user=${fixture.users.changed.id} ORDER BY rowid DESC LIMIT 1`)).toBe('verified:NULL');
    await page.goto('/custom/mjlfinancement/index.php');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  } finally {
    sql("DELETE FROM llx_const WHERE name='MJL_AUTH_E2E_FAIL_SESSION_COMPLETION' AND entity=1");
  }
});

test('credential changes invalidate a verified session through the native hook', async ({ page }) => {
  await startLogin(page, 'policy');
  const code = outbox('login_otp').code;
  await registerOtp(code);
  await page.getByLabel('Code de vérification').fill(code);
  await page.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(page).toHaveURL(/\/custom\/mjlfinancement\/index\.php$/);
	expect((await ownedSessionKeys(page)).sort()).toEqual([
	  'dol_authmode', 'dol_entity', 'dol_login', 'dol_logindate', 'mjl_otp_binding',
	  'mjl_otp_verified_challenge_id', 'mjl_otp_verified_user_id',
	].sort());
  const cookieBefore = (await page.context().cookies()).find((cookie) => cookie.name.includes('DOLSESSID'));
  sql(`UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_VERIFICATEUR' WHERE entity=1 AND fk_user=${fixture.users.policy.id} AND is_active=1`);
  await page.goto('/custom/mjlfinancement/index.php');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  const cookieAfter = (await page.context().cookies()).find((cookie) => cookie.name.includes('DOLSESSID'));
  expect(cookieAfter && cookieBefore && cookieAfter.value).not.toBe(cookieBefore.value);
	expect(await ownedSessionKeys(page)).toEqual(['dol_loginmesg']);
});

test('weakened OTP schema is refused without runtime repair', async ({ page }) => {
  sql('ALTER TABLE llx_mjlfinancement_login_otp DROP INDEX uk_mjl_login_otp_live_user');
  try {
    await page.goto('/index.php');
    await expect(page.getByText('La connexion est temporairement indisponible.')).toBeVisible();
    expect(scalar("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='llx_mjlfinancement_login_otp' AND INDEX_NAME='uk_mjl_login_otp_live_user'")).toBe('0');
  } finally {
    sql('ALTER TABLE llx_mjlfinancement_login_otp ADD UNIQUE INDEX uk_mjl_login_otp_live_user (entity,live_user_id)');
  }

  sql('ALTER TABLE llx_mjlfinancement_login_otp DROP CONSTRAINT chk_mjl_login_otp_counts, ADD CONSTRAINT chk_mjl_login_otp_counts CHECK (attempt_count BETWEEN 0 AND 6 AND resend_count BETWEEN 0 AND 3)');
  try {
	await page.goto('/index.php');
	await expect(page.getByText('La connexion est temporairement indisponible.')).toBeVisible();
	expect(scalar("SELECT CHECK_CLAUSE LIKE '%BETWEEN 0 AND 6%' FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='llx_mjlfinancement_login_otp' AND CONSTRAINT_NAME='chk_mjl_login_otp_counts'")).toBe('1');
  } finally {
	sql('ALTER TABLE llx_mjlfinancement_login_otp DROP CONSTRAINT chk_mjl_login_otp_counts, ADD CONSTRAINT chk_mjl_login_otp_counts CHECK (attempt_count BETWEEN 0 AND 5 AND resend_count BETWEEN 0 AND 3)');
  }
});

test('the retained technical Admin can complete an active-entity password reset', async ({ page }) => {
  const password = process.env.MJL_AUTH_PASSWORD_1;
  await page.goto('/user/passwordforgotten.php');
  await page.getByLabel('Adresse email').fill(adminEmail);
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  const link = outbox('password_reset').link;
  await registerLink(link);
  expect(scalar(`SELECT CONCAT(entity,':',fk_user,':',status) FROM llx_mjlfinancement_password_reset WHERE fk_user=${adminId} ORDER BY rowid DESC LIMIT 1`)).toBe(`1:${adminId}:sent`);

  await openFragmentLink(page, link);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(password);
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();
  expect(scalar(`SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_password_reset WHERE entity=1 AND fk_user=${adminId} ORDER BY rowid DESC LIMIT 1`)).toBe('consumed:NULL');
  expect(scalar(`SELECT pass IS NULL FROM llx_user WHERE rowid=${adminId}`)).toBe('1');

  await page.getByLabel('Adresse email').fill(adminEmail);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Vérification' })).toBeVisible();
  await registerOtp(outbox('login_otp').code);
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

test('invitation audit failure after role assignment rolls back the complete preparation', async () => {
  const login = 'auth.invitation.rollback';
  sql("CREATE TRIGGER llx_mjlfinancement_audit_event_fail_insert BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected post-role audit failure'");
  try {
    const result = issueInvitationResult(login, 'auth.invitation.rollback@example.test');
    expect(result[0]).toBe('');
    expect(scalar(`SELECT COUNT(*) FROM llx_user WHERE login=${sqlLiteral(login)}`)).toBe('0');
    expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_user_role r JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login=${sqlLiteral(login)}`)).toBe('0');
    expect(scalar(`SELECT COUNT(*) FROM llx_user_rights r JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login=${sqlLiteral(login)}`)).toBe('0');
    expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_invitation i JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login=${sqlLiteral(login)}`)).toBe('0');
    expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event a JOIN llx_user u ON u.rowid=a.object_id WHERE u.login=${sqlLiteral(login)}`)).toBe('0');
  } finally {
    sql('DROP TRIGGER IF EXISTS llx_mjlfinancement_audit_event_fail_insert');
  }
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
  expect(scalar("SELECT pass IS NULL FROM llx_user WHERE login='auth.invitation.session' AND entity=1")).toBe('1');
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
