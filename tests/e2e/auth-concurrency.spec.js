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
function cleanup() {
  sql("SET @ids=(SELECT GROUP_CONCAT(rowid) FROM llx_user WHERE login LIKE 'phase1.parallel.%'); DELETE FROM llx_mjlfinancement_password_reset WHERE FIND_IN_SET(fk_user,COALESCE(@ids,'')); DELETE FROM llx_mjlfinancement_invitation WHERE FIND_IN_SET(fk_user,COALESCE(@ids,'')); DELETE FROM llx_user_rights WHERE FIND_IN_SET(fk_user,COALESCE(@ids,'')); DELETE FROM llx_mjlfinancement_user_role WHERE FIND_IN_SET(fk_user,COALESCE(@ids,'')); DELETE FROM llx_user WHERE FIND_IN_SET(rowid,COALESCE(@ids,'')); DELETE FROM llx_const WHERE name IN ('MJL_AUTH_E2E_FAIL_AUTH_OUTBOX','MJL_AUTH_E2E_LOCK_HOLD_SECONDS') AND entity=1;");
}

test.beforeAll(() => {
  cleanup();
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'parallel disposable auth') ON DUPLICATE KEY UPDATE value='1'");
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_LOCK_HOLD_SECONDS',1,'1','chaine',0,'parallel lock observation') ON DUPLICATE KEY UPDATE value='1'");
});
test.afterAll(cleanup);

test('[RST-008] parallel identity collisions leave one user and one live invitation', async () => {
  await concurrentWorkers(
    ['issue', 'phase1.parallel.same-login', 'phase1.parallel.a@example.test'],
    ['issue', 'phase1.parallel.same-login', 'phase1.parallel.b@example.test'],
  );
  expect(scalar("SELECT COUNT(*) FROM llx_user WHERE login='phase1.parallel.same-login'" )).toBe('1');
  expect(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_invitation i JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login='phase1.parallel.same-login' AND i.status IN ('pending_send','sent')")).toBe('1');

  await concurrentWorkers(
    ['issue', 'phase1.parallel.email-a', 'phase1.parallel.same@example.test'],
    ['issue', 'phase1.parallel.email-b', 'phase1.parallel.same@example.test'],
  );
  expect(scalar("SELECT COUNT(*) FROM llx_user WHERE email='phase1.parallel.same@example.test'" )).toBe('1');
  expect(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_invitation i JOIN llx_user u ON u.rowid=i.fk_user WHERE u.email='phase1.parallel.same@example.test' AND i.status IN ('pending_send','sent')")).toBe('1');
});

test('[RST-008] parallel invitation and reset consumption is single-use', async () => {
  const issued = await worker('issue', 'phase1.parallel.lifecycle', 'phase1.parallel.lifecycle@example.test');
  expect(issued[0]).toContain('#verifier=');
  const invitation = tokenParts(issued[0]);
  const accepted = await concurrentWorkers(
    ['accept', invitation[0], invitation[1], 'Parallel-password-1!'],
    ['accept', invitation[0], invitation[1], 'Parallel-password-2!'],
  );
  expect(accepted.filter((result) => result[0] === '')).toHaveLength(1);
  expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_invitation WHERE token_selector='" + invitation[0] + "'")).toBe('accepted:NULL');

  const resets = await concurrentWorkers(
    ['reset', 'phase1.parallel.lifecycle@example.test'],
    ['reset', 'phase1.parallel.lifecycle@example.test'],
  );
  expect(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_password_reset r JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login='phase1.parallel.lifecycle' AND r.status='sent'")).toBe('1');
  const liveSelector = scalar("SELECT r.token_selector FROM llx_mjlfinancement_password_reset r JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login='phase1.parallel.lifecycle' AND r.status='sent'");
  const liveLink = resets.flat().find((link) => typeof link === 'string' && link.includes(liveSelector));
  expect(liveLink).toBeTruthy();
  const reset = tokenParts(liveLink);
  const consumed = await concurrentWorkers(
    ['consume', reset[0], reset[1], 'Parallel-reset-1!'],
    ['consume', reset[0], reset[1], 'Parallel-reset-2!'],
  );
  expect(consumed.filter((result) => result[0] === '')).toHaveLength(1);
  expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_password_reset WHERE token_selector='" + reset[0] + "'")).toBe('consumed:NULL');
});

test('[RST-008] audit failure rolls back identity creation', async () => {
  sql("CREATE TRIGGER llx_mjlfinancement_audit_event_fail_insert BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected audit failure'");
  try {
    const result = await worker('issue', 'phase1.parallel.audit-fail', 'phase1.parallel.audit-fail@example.test');
    expect(result[0]).toBe('');
    expect(scalar("SELECT COUNT(*) FROM llx_user WHERE login='phase1.parallel.audit-fail'")).toBe('0');
  } finally {
    sql('DROP TRIGGER IF EXISTS llx_mjlfinancement_audit_event_fail_insert');
  }
});

test('[RST-008] partial test delivery clears credentials and retry succeeds', async () => {
  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_FAIL_AUTH_OUTBOX',1,'1','chaine',0,'injected partial delivery') ON DUPLICATE KEY UPDATE value='1'");
  try {
    const failed = await worker('issue', 'phase1.parallel.delivery', 'phase1.parallel.delivery@example.test');
    expect(failed[0]).toBe('');
    expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_invitation i JOIN llx_user u ON u.rowid=i.fk_user WHERE u.login='phase1.parallel.delivery' ORDER BY i.rowid DESC LIMIT 1")).toBe('send_failed:NULL');
    const rawOutboxLink = JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'cat', '/var/www/documents/mjlfinancement/email-test-outbox/latest-invitation.json'], { encoding: 'utf8', env: process.env })).link;
    const stale = tokenParts(rawOutboxLink);
    expect((await worker('accept', stale[0], stale[1], 'Never-accepted-1!'))[0]).toContain('invalide ou expirée');
  } finally {
    sql("DELETE FROM llx_const WHERE name='MJL_AUTH_E2E_FAIL_AUTH_OUTBOX' AND entity=1");
  }
  const retried = await worker('issue', 'phase1.parallel.delivery', 'phase1.parallel.delivery@example.test');
  expect(retried[0]).toContain('#verifier=');

  sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_E2E_FAIL_AUTH_OUTBOX',1,'1','chaine',0,'injected partial reset delivery') ON DUPLICATE KEY UPDATE value='1'");
  try {
    const failedReset = await worker('reset', 'phase1.parallel.lifecycle@example.test');
    expect(failedReset[0]).toBeNull();
    expect(scalar("SELECT CONCAT(status,':',IFNULL(token_hash,'NULL')) FROM llx_mjlfinancement_password_reset r JOIN llx_user u ON u.rowid=r.fk_user WHERE u.login='phase1.parallel.lifecycle' ORDER BY r.rowid DESC LIMIT 1")).toBe('send_failed:NULL');
    const rawResetLink = JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'cat', '/var/www/documents/mjlfinancement/email-test-outbox/latest-password_reset.json'], { encoding: 'utf8', env: process.env })).link;
    const staleReset = tokenParts(rawResetLink);
    expect((await worker('consume', staleReset[0], staleReset[1], 'Never-reset-1!'))[0]).toContain('invalide ou expiré');
  } finally {
    sql("DELETE FROM llx_const WHERE name='MJL_AUTH_E2E_FAIL_AUTH_OUTBOX' AND entity=1");
  }
  expect((await worker('reset', 'phase1.parallel.lifecycle@example.test'))[0]).toContain('#verifier=');
});
