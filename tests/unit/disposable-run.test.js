const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createRunPlan, getSuitePlan, sanitizeOutput } = require('../runner/disposable-run');

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
    },
    {
      projectName: 'mjl-test-20260803t123456-4321-a1b2c3d4',
      baseUrl: 'http://127.0.0.1:18123',
      port: 18123,
      databaseVolume: 'mjl-test-20260803t123456-4321-a1b2c3d4_mjl_test_db',
      documentVolume: 'mjl-test-20260803t123456-4321-a1b2c3d4_mjl_test_docs',
    },
  );
  assert.match(plan.composeFile, /tests\/fixtures\/disposable-compose\.override\.yml$/);
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
