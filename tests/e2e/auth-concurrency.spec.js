const { test, expect } = require('@playwright/test');
const { execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

function sql(statement) {
  return execFileSync('docker', ['compose', 'exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', 'dolidb', '-e', statement], { encoding: 'utf8', env: process.env });
}
function scalar(statement) {
  return execFileSync('docker', ['compose', 'exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', '-ppoc_pwd', '-N', '-B', 'dolidb', '-e', statement], { encoding: 'utf8', env: process.env }).trim();
}
function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
async function worker(...args) {
  const { stdout } = await execFileAsync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/auth-parallel-worker.php', ...args], { encoding: 'utf8', env: process.env });
  return JSON.parse(stdout.trim());
}
async function expectLockContention() {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (Number(scalar("SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE DB='dolidb' AND INFO LIKE 'SELECT GET_LOCK%'")) >= 1) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Concurrent auth workers never produced an observed GET_LOCK waiter.');
}
async function concurrentWorkers(first, second) {
  const pending = [worker(...first), worker(...second)];
  await expectLockContention();
  return Promise.all(pending);
}
function tokenParts(link) {
  const url = new URL(link, 'http://example.test');
  return [url.searchParams.get('selector') || url.searchParams.get('mjlselector'), url.hash.slice('#verifier='.length)];
}
function assertNeutralLoser(result, selector, verifier) {
	expect(result).toMatch(/invalide|expir|concurrente|en cours/i);
  expect(result).not.toContain(selector);
  expect(result).not.toContain(verifier);
  expect(result).not.toMatch(/SQLSTATE|SELECT |INSERT |UPDATE |DELETE |MariaDB/i);
}
async function assertNoVerifierLeak(page, link) {
  const [serverPath, verifier = ''] = link.split('#verifier=');
  expect(verifier).not.toBe('');
  const variants = [...new Set([verifier, encodeURIComponent(verifier), Buffer.from(verifier, 'utf8').toString('base64')])];
  const serverUrl = new URL(serverPath, process.env.MJL_BASE_URL);
  const thirdPartyRequests = [];
  const observeRequest = (request) => {
    if (new URL(request.url()).origin !== serverUrl.origin) thirdPartyRequests.push({ url: request.url(), headers: request.headers(), postData: request.postData() });
  };
  page.on('request', observeRequest);
  for (const variant of variants) {
    expect(serverUrl.search).not.toContain(variant);
    expect(decodeURIComponent(serverUrl.search)).not.toContain(variant);
  }
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await page.goto(`${serverUrl.href}#verifier=${verifier}`, { waitUntil: 'domcontentloaded' });
      break;
    } catch (error) {
      if (attempt === 2 || !/socket hang up|ECONNRESET/i.test(error.message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const responseBody = await response.text();
  const responseUrl = response.url();
  for (const variant of variants) {
    expect(responseBody).not.toContain(variant);
    expect(responseUrl).not.toContain(variant);
  }
  const thirdPartyUrl = `http://third-party.invalid/mjl-auth-probe-${Date.now()}`;
  await page.route(thirdPartyUrl, async (route) => {
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
  });
  try {
    await page.evaluate(async (url) => { await fetch(url, { mode: 'cors' }); }, thirdPartyUrl);
  } finally {
    await page.unroute(thirdPartyUrl);
	page.off('request', observeRequest);
  }
  expect(thirdPartyRequests.some((request) => request.url === thirdPartyUrl)).toBe(true);
  const thirdPartyEvidence = JSON.stringify(thirdPartyRequests);
  for (const variant of variants) expect(thirdPartyEvidence).not.toContain(variant);
  const needles = variants.map(sqlLiteral);
  const absentFrom = (expression) => needles.map((needle) => `INSTR(${expression},${needle}) > 0`).join(' OR ');
  const databaseHits = scalar(`SELECT
    (SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE ${absentFrom("CONCAT_WS('|',object_type,COALESCE(object_ref,''),actor_name_snapshot,actor_role_snapshot,action,COALESCE(previous_values_json,''),COALESCE(new_values_json,''),COALESCE(reason,''),COALESCE(context_json,''))")})
    + (SELECT COUNT(*) FROM llx_user WHERE ${absentFrom("CONCAT_WS('|',login,COALESCE(email,''),COALESCE(firstname,''),COALESCE(lastname,''),COALESCE(pass_crypted,''))")})
    + (SELECT COUNT(*) FROM llx_societe WHERE ${absentFrom("CONCAT_WS('|',nom,COALESCE(email,''),COALESCE(note_private,''),COALESCE(note_public,''))")})
    + (SELECT COUNT(*) FROM llx_const WHERE ${absentFrom("CONCAT_WS('|',name,COALESCE(value,''),COALESCE(note,''))")})
    + (SELECT COUNT(*) FROM llx_mjlfinancement_invitation WHERE ${absentFrom("CONCAT_WS('|',token_selector,COALESCE(token_hash,''))")})
    + (SELECT COUNT(*) FROM llx_mjlfinancement_password_reset WHERE ${absentFrom("CONCAT_WS('|',token_selector,COALESCE(token_hash,''))")})`);
  expect(databaseHits).toBe('0');
  const logs = execFileSync('docker', ['compose', 'logs', '--no-color', 'dolibarr', 'mariadb'], { encoding: 'utf8', env: process.env });
  for (const variant of variants) expect(logs).not.toContain(variant);
}
function cleanup() {
  sql("SET @ids=(SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'phase1.parallel.%'); DELETE FROM llx_mjlfinancement_password_reset WHERE FIND_IN_SET(fk_user,COALESCE(@ids,'')); DELETE FROM llx_mjlfinancement_invitation WHERE FIND_IN_SET(fk_user,COALESCE(@ids,'')); DELETE FROM llx_user_rights WHERE FIND_IN_SET(fk_user,COALESCE(@ids,'')); DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user,COALESCE(@ids,'')); DELETE FROM llx_user WHERE FIND_IN_SET(rowid,COALESCE(@ids,'')); DELETE FROM llx_const WHERE name IN ('MJL_AUTH_E2E_EXPOSE_TOKENS','MJL_AUTH_E2E_FAIL_AUTH_OUTBOX','MJL_AUTH_E2E_LOCK_HOLD_SECONDS') AND entity=1;");
}

test.beforeAll(() => {
  cleanup();
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'parallel disposable auth') ON DUPLICATE KEY UPDATE value='1'");
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_LOCK_HOLD_SECONDS',1,'1','chaine',0,'parallel lock observation') ON DUPLICATE KEY UPDATE value='1'");
});
test.afterAll(cleanup);

test('[RST-008] parallel identity collisions leave one user and one live invitation', async ({ page }) => {
  const loginCollision = await concurrentWorkers(
    ['issue', 'phase1.parallel.same-login', 'phase1.parallel.a@example.test'],
    ['issue', 'phase1.parallel.same-login', 'phase1.parallel.b@example.test'],
  );
  const loginWinners = loginCollision.filter((result) => typeof result[0] === 'string' && result[0].includes('#verifier='));
  expect(loginWinners).toHaveLength(1);
  const loginLoser = loginCollision.find((result) => result !== loginWinners[0]);
  const loginToken = tokenParts(loginWinners[0][0]);
  assertNeutralLoser(JSON.stringify(loginLoser), loginToken[0], loginToken[1]);
  await assertNoVerifierLeak(page, loginWinners[0][0]);
  expect(scalar("SELECT COUNT(*) FROM llx_user WHERE login='phase1.parallel.same-login'" )).toBe('1');
  expect(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_invitation i JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login='phase1.parallel.same-login' AND i.status='sent'")).toBe('1');
  expect(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_audit_event a JOIN llx_user u ON u.rowid=a.object_id WHERE a.action='invitation_sent' AND u.login='phase1.parallel.same-login'")).toBe('1');

  const emailCollision = await concurrentWorkers(
    ['issue', 'phase1.parallel.email-a', 'phase1.parallel.same@example.test'],
    ['issue', 'phase1.parallel.email-b', 'phase1.parallel.same@example.test'],
  );
  const emailWinners = emailCollision.filter((result) => typeof result[0] === 'string' && result[0].includes('#verifier='));
  expect(emailWinners).toHaveLength(1);
  const emailLoser = emailCollision.find((result) => result !== emailWinners[0]);
  const emailToken = tokenParts(emailWinners[0][0]);
  assertNeutralLoser(JSON.stringify(emailLoser), emailToken[0], emailToken[1]);
  await assertNoVerifierLeak(page, emailWinners[0][0]);
  expect(scalar("SELECT COUNT(*) FROM llx_user WHERE email='phase1.parallel.same@example.test'" )).toBe('1');
  expect(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_invitation i JOIN llx_user u ON u.rowid=i.fk_user WHERE u.email='phase1.parallel.same@example.test' AND i.status='sent'")).toBe('1');
  expect(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_audit_event a JOIN llx_user u ON u.rowid=a.object_id WHERE a.action='invitation_sent' AND u.email='phase1.parallel.same@example.test'")).toBe('1');
});

test('[RST-008] parallel invitation and reset consumption is single-use', async ({ page }) => {
  const issued = await worker('issue', 'phase1.parallel.lifecycle', 'phase1.parallel.lifecycle@example.test');
  expect(issued[0]).toContain('#verifier=');
  await assertNoVerifierLeak(page, issued[0]);
  const invitation = tokenParts(issued[0]);
  const userId = scalar("SELECT rowid FROM llx_user WHERE login='phase1.parallel.lifecycle'");
  const acceptedAuditBefore = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='invitation_accepted' AND object_id=${userId}`));
  const accepted = await concurrentWorkers(
    ['accept', invitation[0], invitation[1], 'Parallel-password-1!'],
    ['accept', invitation[0], invitation[1], 'Parallel-password-2!'],
  );
  expect(accepted.filter((result) => result[0] === '')).toHaveLength(1);
  assertNeutralLoser(accepted.find((result) => result[0] !== '')[0], invitation[0], invitation[1]);
  expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_invitation WHERE token_selector='" + invitation[0] + "'")).toBe('accepted:NULL');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='invitation_accepted' AND object_id=${userId}`)) - acceptedAuditBefore).toBe(1);

  const sentAuditBefore = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='password_reset_sent' AND object_id=${userId}`));
  const resets = await concurrentWorkers(
    ['reset', 'phase1.parallel.lifecycle@example.test'],
    ['reset', 'phase1.parallel.lifecycle@example.test'],
  );
  const resetWinners = resets.filter((result) => typeof result[0] === 'string' && result[0].includes('#verifier='));
  expect(resetWinners).toHaveLength(1);
  expect(resets.filter((result) => result[0] === null)).toHaveLength(1);
  await assertNoVerifierLeak(page, resetWinners[0][0]);
  expect(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_password_reset r JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login='phase1.parallel.lifecycle' AND r.status='sent'")).toBe('1');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='password_reset_sent' AND object_id=${userId}`)) - sentAuditBefore).toBe(1);
  const liveSelector = scalar("SELECT r.token_selector FROM llx_mjlfinancement_password_reset r JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login='phase1.parallel.lifecycle' AND r.status='sent'");
  const liveLink = resets.flat().find((link) => typeof link === 'string' && link.includes(liveSelector));
  expect(liveLink).toBeTruthy();
  const reset = tokenParts(liveLink);
  const completedAuditBefore = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='password_reset_completed' AND object_id=${userId}`));
  const consumed = await concurrentWorkers(
    ['consume', reset[0], reset[1], 'Parallel-reset-1!'],
    ['consume', reset[0], reset[1], 'Parallel-reset-2!'],
  );
  expect(consumed.filter((result) => result[0] === '')).toHaveLength(1);
  assertNeutralLoser(consumed.find((result) => result[0] !== '')[0], reset[0], reset[1]);
  expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_password_reset WHERE token_selector='" + reset[0] + "'")).toBe('consumed:NULL');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='password_reset_completed' AND object_id=${userId}`)) - completedAuditBefore).toBe(1);
});

test('[RST-008] audit failure rolls back new and existing identity mutations', async ({ page }) => {
  const existing = await worker('issue', 'phase1.parallel.audit-existing', 'phase1.parallel.audit-old@example.test');
  expect(existing[0]).toContain('#verifier=');
  await assertNoVerifierLeak(page, existing[0]);
  const existingId = scalar("SELECT rowid FROM llx_user WHERE login='phase1.parallel.audit-existing'");
  const snapshot = () => scalar(`SELECT CONCAT_WS('|',u.login,u.email,u.firstname,u.lastname,u.statut,u.admin,COALESCE(u.pass_crypted,''),
    (SELECT GROUP_CONCAT(CONCAT(role_code,':',is_active) ORDER BY rowid) FROM llx_mjlfinancement_user_role WHERE entity=1 AND fk_user=u.rowid),
    (SELECT GROUP_CONCAT(fk_id ORDER BY fk_id) FROM llx_user_rights WHERE entity=1 AND fk_user=u.rowid),
    (SELECT GROUP_CONCAT(CONCAT(status,':',COALESCE(token_hash,'NULL')) ORDER BY rowid) FROM llx_mjlfinancement_invitation WHERE entity=1 AND fk_user=u.rowid),
    (SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='mjlfinancement_user' AND object_id=u.rowid)) FROM llx_user u WHERE u.rowid=${existingId}`);
  const before = snapshot();
  sql("CREATE TRIGGER llx_mjlfinancement_audit_event_fail_insert BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected audit failure'");
  try {
    const result = await worker('issue', 'phase1.parallel.audit-fail', 'phase1.parallel.audit-fail@example.test');
    expect(result[0]).toBe('');
    expect(scalar("SELECT COUNT(*) FROM llx_user WHERE login='phase1.parallel.audit-fail'")).toBe('0');
    const existingResult = await worker('issue', 'phase1.parallel.audit-existing', 'phase1.parallel.audit-new@example.test');
    expect(existingResult[0]).toBe('');
    expect(snapshot()).toBe(before);
  } finally {
    sql('DROP TRIGGER IF EXISTS llx_mjlfinancement_audit_event_fail_insert');
  }
});

test('[RST-008] partial test delivery clears credentials and retry succeeds', async ({ page }) => {
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_FAIL_AUTH_OUTBOX',1,'1','chaine',0,'injected partial delivery') ON DUPLICATE KEY UPDATE value='1'");
  try {
    const failed = await worker('issue', 'phase1.parallel.delivery', 'phase1.parallel.delivery@example.test');
    expect(failed[0]).toBe('');
    const deliveryUserId = scalar("SELECT rowid FROM llx_user WHERE login='phase1.parallel.delivery'");
    expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_invitation i JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login='phase1.parallel.delivery' ORDER BY i.rowid DESC LIMIT 1")).toBe('send_failed:NULL');
    expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='invitation_send_failed' AND object_id=${deliveryUserId}`)).toBe('1');
    const rawOutboxLink = JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'cat', '/var/www/documents/mjlfinancement/email-test-outbox/latest-invitation.json'], { encoding: 'utf8', env: process.env })).link;
    await assertNoVerifierLeak(page, rawOutboxLink);
    const stale = tokenParts(rawOutboxLink);
    expect((await worker('accept', stale[0], stale[1], 'Never-accepted-1!'))[0]).toContain('invalide ou expirée');
  } finally {
    sql("DELETE FROM llx_const WHERE name='MJL_AUTH_E2E_FAIL_AUTH_OUTBOX' AND entity=1");
  }
  const retried = await worker('issue', 'phase1.parallel.delivery', 'phase1.parallel.delivery@example.test');
  expect(retried[0]).toContain('#verifier=');
  await assertNoVerifierLeak(page, retried[0]);
  const deliveryUserId = scalar("SELECT rowid FROM llx_user WHERE login='phase1.parallel.delivery'");
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='invitation_sent' AND object_id=${deliveryUserId}`)).toBe('1');

  const resetIdentity = await worker('issue', 'phase1.parallel.reset-delivery', 'phase1.parallel.reset-delivery@example.test');
  await assertNoVerifierLeak(page, resetIdentity[0]);
  const resetInvitation = tokenParts(resetIdentity[0]);
  expect((await worker('accept', resetInvitation[0], resetInvitation[1], 'Reset-delivery-1!'))[0]).toBe('');
  const resetUserId = scalar("SELECT rowid FROM llx_user WHERE login='phase1.parallel.reset-delivery'");
  const failedResetAuditBefore = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='password_reset_send_failed' AND object_id=${resetUserId}`));
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_FAIL_AUTH_OUTBOX',1,'1','chaine',0,'injected partial reset delivery') ON DUPLICATE KEY UPDATE value='1'");
  try {
    const failedReset = await worker('reset', 'phase1.parallel.reset-delivery@example.test');
    expect(failedReset[0]).toBeNull();
    expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_password_reset r JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login='phase1.parallel.reset-delivery' ORDER BY r.rowid DESC LIMIT 1")).toBe('send_failed:NULL');
    expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='password_reset_send_failed' AND object_id=${resetUserId}`)) - failedResetAuditBefore).toBe(1);
    const rawResetLink = JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'cat', '/var/www/documents/mjlfinancement/email-test-outbox/latest-password_reset.json'], { encoding: 'utf8', env: process.env })).link;
    await assertNoVerifierLeak(page, rawResetLink);
    const staleReset = tokenParts(rawResetLink);
    expect((await worker('consume', staleReset[0], staleReset[1], 'Never-reset-1!'))[0]).toContain('invalide ou expiré');
  } finally {
    sql("DELETE FROM llx_const WHERE name='MJL_AUTH_E2E_FAIL_AUTH_OUTBOX' AND entity=1");
  }
  const sentResetAuditBefore = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='password_reset_sent' AND object_id=${resetUserId}`));
  const retriedReset = await worker('reset', 'phase1.parallel.reset-delivery@example.test');
  expect(retriedReset[0]).toContain('#verifier=');
  await assertNoVerifierLeak(page, retriedReset[0]);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='password_reset_sent' AND object_id=${resetUserId}`)) - sentResetAuditBefore).toBe(1);
});
