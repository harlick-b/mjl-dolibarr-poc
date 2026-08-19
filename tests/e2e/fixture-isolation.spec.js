const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { scalar, sql } = require('../helpers/mjl-test-runtime');

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
    child.stdin.end(JSON.stringify(value));
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

test('[RST-014A] streaming database evidence detects and restores trigger mutations', () => {
  const before = databaseEvidence().database_sha256;
  sql("CREATE TRIGGER rst014a_evidence_probe AFTER INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SET @rst014a_evidence_probe=1");
  try {
    expect(databaseEvidence().database_sha256).not.toBe(before);
  } finally {
    sql('DROP TRIGGER rst014a_evidence_probe');
  }
  expect(databaseEvidence().database_sha256).toBe(before);
});

async function runLifecycleSignalProbe(signal) {
  const child = spawn(process.execPath, ['tests/runner/run-suite.js', 'rst014a-lifecycle-probe'], {
    cwd: repositoryRoot,
    env: { ...process.env, MJL_TEST_RETAIN: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const deadline = Date.now() + 90000;
  while (!output.includes('RST-014A lifecycle probe ready.')) {
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
  child.kill(signal);
  await new Promise((resolve) => setTimeout(resolve, 250));
  child.kill(signal);
  await closed;
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
    await runLifecycleSignalProbe(signal);
  });
}

test('[RST-014A] sentinel ownership and mode fail closed before database access', () => {
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
  expect(() => execFileSync('docker', ['compose', 'exec', '-T', '--user', 'root', 'dolibarr', 'php', '/opt/mjl-tests/fixtures/phase1-fixture.php'], {
    env: process.env, input: JSON.stringify(request('rst014a-root-user')), stdio: ['pipe', 'pipe', 'pipe'],
  })).toThrow();
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
