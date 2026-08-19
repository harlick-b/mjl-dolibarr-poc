const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');

const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { scalar } = require('../helpers/mjl-test-runtime');

const repositoryRoot = path.resolve(__dirname, '../..');
const execFileAsync = promisify(execFile);

function adminDigest() {
  return scalar("SELECT SHA2(CONCAT_WS(0x1f,rowid,entity,login,COALESCE(pass,''),COALESCE(pass_crypted,''),COALESCE(pass_temp,''),admin,statut),256) FROM llx_user WHERE admin=1");
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
  return execFileAsync('docker', ['compose', 'exec', '-T', '--user', user, 'dolibarr', 'php', '/opt/mjl-tests/fixtures/phase1-fixture.php'], {
    encoding: 'utf8', env: process.env, input: JSON.stringify(value), maxBuffer: 1024 * 1024,
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
