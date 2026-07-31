const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  validateDisposableComposeConfig,
} = require('../helpers/phase3d-prerequisite-isolation');

function disposableFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-phase3d-guard-'));
  const database = path.join(root, 'mariadb');
  const documents = path.join(root, 'documents');
  fs.mkdirSync(database);
  fs.mkdirSync(documents);
  return {
    root,
    config: {
      name: 'mjl-phase3d-prereq-test',
      services: {
        mariadb: {
          volumes: [{ type: 'bind', source: database, target: '/var/lib/mysql' }],
        },
        dolibarr: {
          environment: { DOLI_URL_ROOT: 'http://127.0.0.1:18081' },
          ports: [{ target: 80, published: '18081' }],
          volumes: [{ type: 'bind', source: documents, target: '/var/www/documents' }],
        },
      },
    },
    env: {
      MJL_BASE_URL: 'http://127.0.0.1:18081',
      COMPOSE_PROJECT_NAME: 'mjl-phase3d-prereq-test',
      MJL_E2E_TEMP_DIR: root,
    },
  };
}

test('accepts a matching disposable Compose environment', (t) => {
  const fixture = disposableFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const result = validateDisposableComposeConfig(fixture.config, fixture.env, process.cwd());
  assert.equal(result.temporaryRoot, fixture.root);
});

test('rejects the shared default browser URL', (t) => {
  const fixture = disposableFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  fixture.env.MJL_BASE_URL = 'http://127.0.0.1:8080';
  assert.throws(
    () => validateDisposableComposeConfig(fixture.config, fixture.env, process.cwd()),
    /shared default workspace/,
  );
});

test('rejects repository data binds', (t) => {
  const fixture = disposableFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  fixture.config.services.mariadb.volumes[0].source = path.join(process.cwd(), 'data', 'mariadb');
  assert.throws(
    () => validateDisposableComposeConfig(fixture.config, fixture.env, process.cwd()),
    /inside MJL_E2E_TEMP_DIR/,
  );
});

test('rejects a DOLI_URL_ROOT that differs from the browser URL', (t) => {
  const fixture = disposableFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  fixture.config.services.dolibarr.environment.DOLI_URL_ROOT = 'http://127.0.0.1:18082';
  assert.throws(
    () => validateDisposableComposeConfig(fixture.config, fixture.env, process.cwd()),
    /DOLI_URL_ROOT must match/,
  );
});

test('rejects a published port that differs from the browser URL', (t) => {
  const fixture = disposableFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  fixture.config.services.dolibarr.ports[0].published = '18082';
  assert.throws(
    () => validateDisposableComposeConfig(fixture.config, fixture.env, process.cwd()),
    /published port must match/,
  );
});
