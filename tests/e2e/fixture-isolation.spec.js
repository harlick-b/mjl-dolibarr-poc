const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { registerSecret, scalar, sql } = require('../helpers/mjl-test-runtime');

const repositoryRoot = path.resolve(__dirname, '../..');

function adminDigest() {
  return databaseEvidence().admin_sha256;
}

function databaseEvidence() {
  return JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/database-evidence.php'], {
    env: process.env, encoding: 'utf8', input: '', stdio: ['pipe', 'pipe', 'pipe'],
  }));
}

function request(namespace = 'rst014a-e2e', entity = 1) {
  return {
    namespace,
    entity,
    users: [
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'norole', role: null },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire RST-014A' }],
      projects: [{ key: 'project', label: 'Projet RST-014A', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type RST-014A' }],
    },
  };
}

test.describe.configure({ mode: 'serial' });

test('[RST-014A] factory creates only the bounded allowlisted graph and preserves Admin', () => {
  const before = adminDigest();
  const result = createPhase1FixtureSet(request());
  expect(result.users.agent.login).toBe('rst014a-e2e.agent');
  expect(scalar("SELECT CONCAT(admin,':',entity,':',pass IS NULL,':',pass_temp IS NULL) FROM llx_user WHERE login='rst014a-e2e.agent'" )).toBe('0:1:1:1');
  expect(scalar(`SELECT COUNT(*) FROM llx_projet WHERE rowid=${result.projects.project} AND entity=1 AND fk_soc=${result.partners.partner}`)).toBe('1');
  expect(adminDigest()).toBe(before);
});

test('[RST-014A] namespace replay and cross-entity reuse fail atomically', () => {
  const beforeAdmin = adminDigest();
  const beforeUsers = scalar("SELECT COUNT(*) FROM llx_user WHERE login LIKE 'rst014a-e2e.%'");
  expect(() => createPhase1FixtureSet(request())).toThrow(/failed/i);
  expect(() => createPhase1FixtureSet(request('rst014a-e2e', 2))).toThrow(/failed/i);
  expect(scalar("SELECT COUNT(*) FROM llx_user WHERE login LIKE 'rst014a-e2e.%'")).toBe(beforeUsers);
  expect(adminDigest()).toBe(beforeAdmin);
});

async function directFactory(value, user = 'www-data') {
  const before = adminDigest();
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', 'exec', '-T', '--user', user, 'dolibarr', 'php', '/opt/mjl-tests/fixtures/phase1-fixture.php'], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.once('error', reject);
    child.once('close', (code) => {
      const after = adminDigest();
      if (after !== before) return reject(new Error('Concurrent fixture changed the native administrator.'));
      if (code === 0) resolve({ stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
      else reject(new Error('Concurrent disposable fixture call failed.'));
    });
    child.stdin.end(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  });
}

test('[RST-014A] concurrent identical, disjoint, and cross-entity namespaces serialize globally', async () => {
  test.setTimeout(180000);
  const beforeAdmin = adminDigest();
  for (const [namespace, left, right] of [
    ['rst014a-concurrent', request('rst014a-concurrent', 1), request('rst014a-concurrent', 1)],
    ['rst014a-disjoint', request('rst014a-disjoint', 1), { ...request('rst014a-disjoint', 1), users: [{ key: 'other', role: null }], references: { partners: [], projects: [], operationTypes: [] } }],
    ['rst014a-two-entity', request('rst014a-two-entity', 1), request('rst014a-two-entity', 2)],
  ]) {
    const outcomes = await Promise.allSettled([directFactory(left), directFactory(right)]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled'), namespace).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected'), namespace).toHaveLength(1);
    expect(scalar(`SELECT COUNT(*) FROM llx_const WHERE entity=0 AND name='MJL_TEST_FIXTURE_NAMESPACE_${require('node:crypto').createHash('sha256').update(namespace).digest('hex')}'`)).toBe('1');
  }
  expect(adminDigest()).toBe(beforeAdmin);
});

test('[RST-014A] streaming evidence detects trigger, database, routine-signature, and sequence mutations', () => {
  const assertDetectedAndRestored = (mutate, restore) => {
    const before = databaseEvidence().database_sha256;
    sql(mutate);
    try { expect(databaseEvidence().database_sha256).not.toBe(before); }
    finally { sql(restore); }
    expect(databaseEvidence().database_sha256).toBe(before);
  };
  assertDetectedAndRestored(
    "CREATE TRIGGER rst014a_evidence_probe AFTER INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SET @rst014a_evidence_probe=1",
    'DROP TRIGGER rst014a_evidence_probe',
  );
  const collation = scalar("SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='dolidb'");
  const alternate = collation === 'utf8mb4_bin' ? 'utf8mb4_unicode_ci' : 'utf8mb4_bin';
  assertDetectedAndRestored(`ALTER DATABASE dolidb COLLATE ${alternate}`, `ALTER DATABASE dolidb COLLATE ${collation}`);
  assertDetectedAndRestored(
    'CREATE PROCEDURE rst014a_evidence_routine(IN probe_value INT) SELECT probe_value',
    'DROP PROCEDURE rst014a_evidence_routine',
  );
  assertDetectedAndRestored(
    'CREATE SEQUENCE rst014a_evidence_sequence START WITH 10',
    'DROP SEQUENCE rst014a_evidence_sequence',
  );
  const documentMode = execFileSync('docker', ['compose', 'exec', '-T', '--user', 'root', 'dolibarr', 'stat', '-c', '%a', '/var/www/documents'], { env: process.env, encoding: 'utf8' }).trim();
  const alternateDocumentMode = documentMode === '755' ? '750' : '755';
  const beforeDocuments = databaseEvidence().documents_sha256;
  execFileSync('docker', ['compose', 'exec', '-T', '--user', 'root', 'dolibarr', 'chmod', alternateDocumentMode, '/var/www/documents'], { env: process.env });
  try { expect(databaseEvidence().documents_sha256).not.toBe(beforeDocuments); }
  finally { execFileSync('docker', ['compose', 'exec', '-T', '--user', 'root', 'dolibarr', 'chmod', documentMode, '/var/www/documents'], { env: process.env }); }
  expect(databaseEvidence().documents_sha256).toBe(beforeDocuments);
});

test('[RST-014A] direct PHP rejects noncanonical input with independent Admin attestation', async () => {
  await expect(directFactory(` ${JSON.stringify(request('rst014a-noncanonical'))}`)).rejects.toThrow(/failed/i);
  const edgeWhitespace = request('rst014a-edge-space');
  edgeWhitespace.references.partners[0].label = '\ufeffPartenaire';
  await expect(directFactory(edgeWhitespace)).rejects.toThrow(/failed/i);
  const canonical = JSON.stringify(request('rst014a-duplicate-member'));
  await expect(directFactory(canonical.replace('{', '{"namespace":"duplicate",'))).rejects.toThrow(/failed/i);
  await expect(directFactory(Buffer.from([0xff, 0xfe, 0xfd]))).rejects.toThrow(/failed/i);
  await expect(directFactory(`${'['.repeat(9)}0${']'.repeat(9)}`)).rejects.toThrow(/failed/i);
});

test('[RST-014A] exact sentinel content, database value, and special-bit mode fail closed', async () => {
  const sentinelPath = '/var/www/documents/.mjl-disposable-fixture-sentinel';
  const expected = process.env.MJL_DISPOSABLE_RUN_SENTINEL;
  const invoke = (namespace) => directFactory(request(namespace));
  execFileSync('docker', ['compose', 'exec', '-T', '--user', 'root', 'dolibarr', 'chmod', '2444', sentinelPath], { env: process.env });
  try { await expect(invoke('rst014a-special-mode')).rejects.toThrow(/failed/i); }
  finally { execFileSync('docker', ['compose', 'exec', '-T', '--user', 'root', 'dolibarr', 'chmod', '0444', sentinelPath], { env: process.env }); }
  execFileSync('docker', ['compose', 'exec', '-T', '--user', 'root', 'dolibarr', 'sh', '-ceu', 'printf "%s\\n" "$MJL_DISPOSABLE_RUN_SENTINEL" > /var/www/documents/.mjl-disposable-fixture-sentinel; chmod 0444 /var/www/documents/.mjl-disposable-fixture-sentinel'], { env: process.env });
  try { await expect(invoke('rst014a-content-space')).rejects.toThrow(/failed/i); }
  finally { execFileSync('docker', ['compose', 'exec', '-T', '--user', 'root', 'dolibarr', 'sh', '-ceu', 'printf %s "$MJL_DISPOSABLE_RUN_SENTINEL" > /var/www/documents/.mjl-disposable-fixture-sentinel; chmod 0444 /var/www/documents/.mjl-disposable-fixture-sentinel'], { env: process.env }); }
  sql("UPDATE llx_const SET value='00000000000000000000000000000000' WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");
  try { await expect(invoke('rst014a-db-mismatch')).rejects.toThrow(/failed/i); }
  finally { sql(`UPDATE llx_const SET value='${expected}' WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'`); }
});

test('[RST-014A] post-reservation failure rolls back the complete fixture transaction', () => {
  const namespace = 'rst014a-rollback';
  const reservation = require('node:crypto').createHash('sha256').update(namespace).digest('hex');
  sql("CREATE TRIGGER rst014a_fixture_rollback BEFORE INSERT ON llx_user FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture rollback probe'");
  try {
    expect(() => createPhase1FixtureSet(request(namespace))).toThrow(/failed/i);
  } finally {
    sql('DROP TRIGGER rst014a_fixture_rollback');
  }
  expect(scalar(`SELECT COUNT(*) FROM llx_const WHERE entity=0 AND name='MJL_TEST_FIXTURE_NAMESPACE_${reservation}'`)).toBe('0');
  expect(scalar("SELECT COUNT(*) FROM llx_user WHERE login LIKE 'rst014a-rollback.%'")).toBe('0');
});

test('[RST-014A] every permitted role and role-less user stay entity-local', () => {
  for (const entity of [1, 2]) {
    const result = createPhase1FixtureSet({
      namespace: `rst014a-roles-${entity}`, entity,
      users: [
        { key: 'agent', role: 'AGENT_SAISIE' },
        { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
        { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
        { key: 'norole', role: null },
      ],
      references: { partners: [], projects: [], operationTypes: [] },
    });
    for (const user of Object.values(result.users)) {
      expect(scalar(`SELECT entity FROM llx_user WHERE rowid=${user.id}`)).toBe(String(entity));
    }
  }
});

test('[RST-014A] complete factory fails before DB access when the file sentinel is absent', async () => {
  const canary = '/var/www/documents/rst014a-guard-canary.txt';
  sql("INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_RST014A_GUARD_CANARY','unchanged','chaine',0,'synthetic guard canary',0)");
  execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'sh', '-ceu', `printf unchanged > ${canary}; mv /var/www/documents/.mjl-disposable-fixture-sentinel /var/www/documents/.mjl-disposable-fixture-sentinel.disabled`], { env: process.env });
  try {
    await expect(directFactory(request('rst014a-no-sentinel'))).rejects.toThrow(/failed/i);
    expect(scalar("SELECT value FROM llx_const WHERE entity=0 AND name='MJL_RST014A_GUARD_CANARY'")).toBe('unchanged');
    expect(execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'cat', canary], { env: process.env, encoding: 'utf8' })).toBe('unchanged');
  } finally {
    execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'sh', '-ceu', `mv /var/www/documents/.mjl-disposable-fixture-sentinel.disabled /var/www/documents/.mjl-disposable-fixture-sentinel; rm -f ${canary}`], { env: process.env });
    sql("DELETE FROM llx_const WHERE entity=0 AND name='MJL_RST014A_GUARD_CANARY'");
  }
});

async function runLifecycleProbe({ signal = null, outcome = 'signal' }) {
  const injectedSecret = `lifecycle-${require('node:crypto').randomBytes(16).toString('hex')}`;
  await registerSecret('injected lifecycle secret', injectedSecret);
  const child = spawn(process.execPath, ['tests/runner/run-suite.js', 'rst014a-lifecycle-probe'], {
    cwd: repositoryRoot,
    env: { ...process.env, MJL_TEST_RETAIN: '1', MJL_RST014A_PROBE_OUTCOME: outcome, MJL_RST014A_PROBE_FAILURE: outcome, MJL_RST014A_INJECT_SECRET: injectedSecret },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const deadline = Date.now() + 90000;
  const needsReady = outcome !== 'setup';
  while (!/Disposable MJL project: mjl-test-/.test(output) || (needsReady && !output.includes('RST-014A lifecycle probe ready.'))) {
    if (child.exitCode !== null) throw new Error(`Lifecycle probe exited before readiness: ${output}`);
    if (Date.now() > deadline) { child.kill('SIGKILL'); throw new Error('Lifecycle probe readiness timed out.'); }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const project = output.match(/Disposable MJL project: (mjl-test-[^\n]+)/)?.[1];
  expect(project).toBeTruthy();
  const closed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Lifecycle probe cleanup timed out.')), 130000);
    child.once('close', () => { clearTimeout(timer); resolve(); });
  });
  if (signal) {
    child.kill(signal);
    await new Promise((resolve) => setTimeout(resolve, 250));
    child.kill(signal);
  }
  await closed;
  expect(output).not.toContain(injectedSecret);
  if (outcome === 'success') process.stdout.write(`${injectedSecret}\n`);
  expect(fs.existsSync(path.join(repositoryRoot, 'test-results', 'runs', project))).toBe(false);
  const filter = `label=com.docker.compose.project=${project}`;
  for (const [kind, args, format] of [
    ['container', ['ps', '-a'], '{{.Names}}'], ['network', ['network', 'ls'], '{{.Name}}'], ['volume', ['volume', 'ls'], '{{.Name}}'],
  ]) {
    const remaining = execFileSync('docker', [...args, '--filter', filter, '--format', format], { encoding: 'utf8' }).trim();
    expect(remaining, `${kind} survived ${signal}`).toBe('');
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`[RST-014A] repeated ${signal} runs the real runner teardown`, async () => {
    test.setTimeout(180000);
    await runLifecycleProbe({ signal });
  });
}

for (const outcome of ['success', 'setup', 'test', 'diagnostics-failure', 'diagnostics-timeout']) {
  test(`[RST-014A] real runner ${outcome} path scans secrets and tears down`, async () => {
    test.setTimeout(180000);
    await runLifecycleProbe({ outcome });
  });
}

test('[RST-014A] sentinel ownership and mode fail closed before database access', async () => {
  const beforeAdmin = adminDigest();
  const beforeReservations = scalar("SELECT COUNT(*) FROM llx_const WHERE entity=0 AND name LIKE 'MJL_TEST_FIXTURE_NAMESPACE_%'");
  execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'chmod', '0644', '/var/www/documents/.mjl-disposable-fixture-sentinel'], { env: process.env });
  try {
    expect(() => createPhase1FixtureSet(request('rst014a-bad-mode'))).toThrow(/failed/i);
  } finally {
    execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'chmod', '0444', '/var/www/documents/.mjl-disposable-fixture-sentinel'], { env: process.env });
  }
  expect(scalar("SELECT COUNT(*) FROM llx_const WHERE entity=0 AND name LIKE 'MJL_TEST_FIXTURE_NAMESPACE_%'")).toBe(beforeReservations);
  expect(adminDigest()).toBe(beforeAdmin);

  execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'chown', 'www-data:www-data', '/var/www/documents/.mjl-disposable-fixture-sentinel'], { env: process.env });
  try {
    expect(() => createPhase1FixtureSet(request('rst014a-bad-owner'))).toThrow(/failed/i);
  } finally {
    execFileSync('docker', ['compose', 'exec', '-T', 'dolibarr', 'chown', 'root:root', '/var/www/documents/.mjl-disposable-fixture-sentinel'], { env: process.env });
  }
  await expect(directFactory(request('rst014a-root-user'), 'root')).rejects.toThrow(/failed/i);
});

test('[RST-014A] shared-container guard-only preflight cannot enter fixture creation', () => {
  const source = fs.readFileSync(path.join(repositoryRoot, 'tests/fixtures/phase1-fixture-preflight.php'));
  const sharedEnvironment = { ...process.env };
  for (const key of ['COMPOSE_PROJECT_NAME', 'COMPOSE_FILE', 'MJL_BASE_URL', 'MJL_TEST_PORT', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_TEST_USER_PASSWORD']) delete sharedEnvironment[key];
  expect(() => execFileSync('docker', ['compose', '-f', path.join(repositoryRoot, 'docker-compose.yml'), 'exec', '-T', '--user', 'www-data', 'dolibarr', 'php'], {
    cwd: repositoryRoot,
    env: sharedEnvironment,
    input: source,
    stdio: ['pipe', 'pipe', 'pipe'],
  })).toThrow();
});
