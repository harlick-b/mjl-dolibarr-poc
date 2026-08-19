const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createRunPlan, getSuitePlan, sanitizeOutput } = require('../runner/disposable-run');
const os = require('node:os');
const net = require('node:net');
const { finalizeDisposableRun, protectedSourceDigest, runCommand, startSecretRegistry, verifyArtifacts } = require('../runner/run-suite');

const repositoryRoot = path.resolve(__dirname, '../..');

test('creates a unique loopback run plan with stable scoped resource names', () => {
  const plan = createRunPlan({
    repositoryRoot: '/workspace/mjl',
    port: 18123,
    now: new Date('2026-08-03T12:34:56.000Z'),
    randomHex: 'a1b2c3d4',
    processId: 4321,
  });

  assert.deepEqual(
    {
      projectName: plan.projectName,
      baseUrl: plan.baseUrl,
      port: plan.port,
      databaseVolume: plan.databaseVolume,
      documentVolume: plan.documentVolume,
      configVolume: plan.configVolume,
      sentinel: plan.sentinel,
      testUserPassword: plan.testUserPassword,
      lifecyclePasswords: plan.lifecyclePasswords,
    },
    {
      projectName: 'mjl-test-20260803t123456-4321-a1b2c3d4',
      baseUrl: 'http://127.0.0.1:18123',
      port: 18123,
      databaseVolume: 'mjl-test-20260803t123456-4321-a1b2c3d4_mjl_test_db',
      documentVolume: 'mjl-test-20260803t123456-4321-a1b2c3d4_mjl_test_docs',
      configVolume: 'mjl-test-20260803t123456-4321-a1b2c3d4_mjl_test_conf',
      sentinel: plan.sentinel,
      testUserPassword: plan.testUserPassword,
      lifecyclePasswords: plan.lifecyclePasswords,
    },
  );
  assert.match(plan.composeFile, /tests\/fixtures\/disposable-compose\.override\.yml$/);
  assert.match(plan.sentinel, /^[a-f0-9]{32}$/);
  assert.match(plan.testUserPassword, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(plan.lifecyclePasswords.length, 3);
  assert.equal(new Set(plan.lifecyclePasswords).size, 3);
  for (const password of plan.lifecyclePasswords) {
    assert.match(password, /^[A-Z][a-z][0-9]![A-Za-z0-9_-]{32}$/);
  }
  assert.match(plan.secretRegistryCapability, /^[a-f0-9]{32}$/);
});

test('rejects the shared app port and invalid repository roots', () => {
  assert.throws(
    () => createRunPlan({ repositoryRoot: '/workspace/mjl', port: 8080 }),
    /8080/,
  );
  assert.throws(
    () => createRunPlan({ repositoryRoot: '', port: 18123 }),
    /repository root/i,
  );
});

test('sanitizes credentials, tokens, and connection strings in retained diagnostics', () => {
  const raw = [
    'MYSQL_ROOT_PASSWORD=local-root-secret',
    'DOLI_ADMIN_PASSWORD: local-admin-secret',
    'Authorization: Bearer abc.def.ghi',
    'mysql://user:password@mariadb/dolidb',
  ].join('\n');

  const sanitized = sanitizeOutput(raw, ['local-root-secret', 'local-admin-secret']);
  assert.doesNotMatch(sanitized, /local-root-secret|local-admin-secret|abc\.def\.ghi|user:password/);
  assert.match(sanitized, /\[REDACTED\]/);
});

test('maps each public command to explicit durable layers without phase-era targets', () => {
  assert.deepEqual(getSuitePlan('all'), ['unit', 'verify', 'e2e']);
  assert.deepEqual(getSuitePlan('unit'), ['unit']);
  assert.deepEqual(getSuitePlan('verify'), ['verify']);
  assert.deepEqual(getSuitePlan('e2e'), ['e2e']);
  assert.deepEqual(getSuitePlan('rst003'), ['rst003']);
  assert.deepEqual(getSuitePlan('rst014a'), ['rst014a']);
  assert.deepEqual(getSuitePlan('characterization'), ['characterization']);
  assert.deepEqual(getSuitePlan('manual-accessibility'), ['manual-accessibility']);
  assert.deepEqual(getSuitePlan('production-readiness'), ['production-readiness']);
  assert.ok(!getSuitePlan('all').includes('production-readiness'));
  assert.throws(() => getSuitePlan('phase3'), /unknown test mode/i);
});

test('provisioning restores web-user ownership only inside disposable document storage', () => {
  const runner = fs.readFileSync(path.join(repositoryRoot, 'tests/runner/run-suite.js'), 'utf8');
  assert.match(runner, /'chown', '-R', 'www-data:www-data', '\/var\/www\/documents'/);
  assert.doesNotMatch(runner, /chown[^\n]*(?:repositoryRoot|\/var\/www\/html\/custom)/);
});

test('diagnostics failures cannot bypass teardown and all failures remain inspectable', async () => {
  const executionError = new Error('execution failed');
  let cleanupCalled = false;
  const result = await finalizeDisposableRun({
    plan: { projectName: 'mjl-test-finalizer' },
    provisionAttempted: true,
    failure: executionError,
    runMode: 'phase1-reset',
    environment: { MJL_TEST_RETAIN: '1' },
    capture: async () => { throw new Error('diagnostics failed'); },
    remove: async () => { cleanupCalled = true; throw new Error('cleanup failed'); },
    retain: () => { throw new Error('Phase 1 must never retain.'); },
  });
  assert.equal(cleanupCalled, true);
  assert.ok(result instanceof AggregateError);
  assert.deepEqual(result.errors.map((error) => error.message), ['execution failed', 'diagnostics failed', 'cleanup failed']);
});

test('RST-014A never retains a failed tenant', async () => {
  let removed = false;
  let retained = false;
  await finalizeDisposableRun({
    plan: { projectName: 'mjl-test-finalizer' },
    provisionAttempted: true,
    failure: new Error('expected'),
    runMode: 'rst014a',
    environment: { MJL_TEST_RETAIN: '1' },
    capture: async () => {},
    remove: async () => { removed = true; },
    retain: () => { retained = true; },
  });
  assert.equal(removed, true);
  assert.equal(retained, false);
});

test('never-resolving diagnostics are bounded and cannot bypass teardown', async () => {
  let removed = false;
  const result = await finalizeDisposableRun({
    plan: { projectName: 'mjl-test-finalizer' },
    provisionAttempted: true,
    failure: null,
    runMode: 'rst014a',
    capture: async (_plan, signal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    }),
    remove: async () => { removed = true; },
    diagnosticsTimeoutMs: 10,
  });
  assert.equal(removed, true);
  assert.match(result.message, /diagnostics capture timed out/i);
});

test('diagnostics acknowledge cancellation before a delayed artifact writer can run', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-late-writer-'));
  let removed = false;
  const result = await finalizeDisposableRun({
    plan: { projectName: 'mjl-test-finalizer', artifactRoot: root },
    provisionAttempted: true,
    failure: null,
    runMode: 'rst014a',
    diagnosticsTimeoutMs: 10,
    capture: async (_plan, signal) => new Promise((resolve) => {
      signal.addEventListener('abort', () => setTimeout(() => {
        if (!signal.aborted) fs.writeFileSync(path.join(root, 'late.log'), 'secret');
        resolve();
      }, 10), { once: true });
    }),
    remove: async () => { removed = true; },
  });
  assert.equal(removed, true);
  assert.match(result.message, /timed out/i);
  assert.equal(fs.existsSync(path.join(root, 'late.log')), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('cancellable subprocess deadlines terminate and await the child', async () => {
  const started = Date.now();
  await assert.rejects(
    runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { quiet: true, timeoutMs: 30 }),
    /timed out/i,
  );
  assert.ok(Date.now() - started < 2500);
});

test('every reachable outcome discards a secret-bearing artifact before reporting', () => {
  for (const outcome of ['success', 'ordinary-failure', 'setup-failure', 'diagnostics-timeout', 'sigint', 'sigterm']) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `mjl-${outcome}-`));
    fs.writeFileSync(path.join(root, `${outcome}.log`), 'dynamic-secret-value', { mode: 0o600 });
    assert.throws(() => verifyArtifacts(root, [{ category: 'injected secret', value: 'dynamic-secret-value' }]), /contaminated artifacts/i);
    assert.equal(fs.existsSync(root), false);
  }
});

test('protected source evidence encodes root type and rejects top-level symlinks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-source-root-'));
  try {
    fs.writeFileSync(path.join(root, 'entry'), 'same');
    const fileDigest = protectedSourceDigest(root, ['entry']);
    fs.rmSync(path.join(root, 'entry'));
    fs.mkdirSync(path.join(root, 'entry'));
    fs.writeFileSync(path.join(root, 'entry', 'content'), 'same');
    assert.notEqual(protectedSourceDigest(root, ['entry']), fileDigest);
    fs.rmSync(path.join(root, 'entry'), { recursive: true });
    fs.symlinkSync('/tmp', path.join(root, 'entry'));
    assert.throws(() => protectedSourceDigest(root, ['entry']), /symbolic link/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('secret registry shutdown destroys a silent partial client within its bound', async () => {
  const registry = await startSecretRegistry({ secretRegistryCapability: 'a'.repeat(32) });
  const client = net.createConnection({ host: '127.0.0.1', port: registry.port });
  await new Promise((resolve, reject) => {
    client.once('connect', () => { client.write('{"capability":'); resolve(); });
    client.once('error', reject);
  });
  const closed = new Promise((resolve) => client.once('close', resolve));
  await registry.close();
  await closed;
  assert.equal(client.destroyed, true);
});

test('every Playwright surface installs the disposable guard with no shared URL fallback', () => {
  for (const relative of ['playwright.config.js', 'tests/characterization/playwright.config.js', 'tests/manual/playwright.config.js']) {
    const config = fs.readFileSync(path.join(repositoryRoot, relative), 'utf8');
    assert.match(config, /globalSetup/);
    assert.doesNotMatch(config, /127\.0\.0\.1:8080|localhost:8080/);
  }
});

test('maintained fixture markers fit the 14-character import-key boundary', () => {
  for (const relative of ['tests/e2e/cases', 'tests/characterization/cases']) {
    const directory = path.join(repositoryRoot, relative);
    for (const filename of fs.readdirSync(directory).filter((entry) => entry.endsWith('.js'))) {
      const source = fs.readFileSync(path.join(directory, filename), 'utf8');
      assert.doesNotMatch(
        source,
        /'[A-Z][A-Z0-9]{14,}'/,
        `${relative}/${filename} contains a compact fixture marker that cannot fit import_key`,
      );
      assert.doesNotMatch(source, /DOL_DOC_ROOT|[A-Z0-9]+-Final validator|[A-Z0-9]+Final validator/);
    }
  }
});
