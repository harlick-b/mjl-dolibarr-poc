const test = require('node:test');
const assert = require('node:assert/strict');

const { assertCleanupComplete, assertDisposableConfig } = require('../runner/disposable-policy');

const expected = {
  projectName: 'mjl-test-20260803-1234-a1b2c3',
  baseUrl: 'http://127.0.0.1:18123',
  port: 18123,
  repositoryRoot: '/workspace/mjl',
  evidenceRoot: '/workspace/mjl/test-results/runs/test-evidence',
  sentinel: '0123456789abcdef0123456789abcdef',
  testUserPassword: '0123456789abcdef0123456789ABCDEF',
};

function validConfig() {
  return {
    name: expected.projectName,
    services: {
      mariadb: {
        restart: 'no',
        tmpfs: ['/run/mjl-test:size=1m,mode=0700,noexec,nosuid,nodev'],
        volumes: [{ type: 'volume', source: 'mjl_test_db', target: '/var/lib/mysql' }],
      },
      dolibarr: {
        restart: 'no',
        environment: {
          DOLI_URL_ROOT: expected.baseUrl,
          MJL_DISPOSABLE_TEST_TENANT: '1',
          MJL_DISPOSABLE_PROJECT_NAME: expected.projectName,
          MJL_DISPOSABLE_RUN_SENTINEL: expected.sentinel,
          MJL_TEST_USER_PASSWORD: expected.testUserPassword,
        },
        ports: [{ target: 80, published: String(expected.port), protocol: 'tcp', host_ip: '127.0.0.1' }],
        volumes: [
          { type: 'volume', source: 'mjl_test_docs', target: '/var/www/documents' },
          { type: 'volume', source: 'mjl_test_conf', target: '/var/www/html/conf' },
          { type: 'bind', source: '/workspace/mjl/custom', target: '/var/www/html/custom', read_only: true },
          {
            type: 'bind',
            source: '/workspace/mjl/custom/mjlfinancement/deployment/apache-native-guard.conf',
            target: '/etc/apache2/conf-enabled/mjl-native-guard.conf',
            read_only: true,
          },
          { type: 'bind', source: '/workspace/mjl/tests', target: '/opt/mjl-tests', read_only: true },
          { type: 'bind', source: expected.evidenceRoot, target: '/opt/mjl-evidence', read_only: true },
        ],
      },
    },
    volumes: {
      mjl_test_db: { name: `${expected.projectName}_mjl_test_db` },
      mjl_test_docs: { name: `${expected.projectName}_mjl_test_docs` },
      mjl_test_conf: { name: `${expected.projectName}_mjl_test_conf` },
    },
    networks: {
      default: { name: `${expected.projectName}_default` },
    },
  };
}

test('accepts an isolated project with named storage and read-only application mounts', () => {
  assert.doesNotThrow(() => assertDisposableConfig(validConfig(), expected));
});

test('rejects shared or mismatched project identity and browser destinations', () => {
  const shared = validConfig();
  shared.name = 'mjl';
  assert.throws(() => assertDisposableConfig(shared, expected), /project name/i);

  const defaultPort = validConfig();
  defaultPort.services.dolibarr.ports[0].published = '8080';
  assert.throws(() => assertDisposableConfig(defaultPort, expected), /port/i);

  const wrongRoot = validConfig();
  wrongRoot.services.dolibarr.environment.DOLI_URL_ROOT = 'http://127.0.0.1:18124';
  assert.throws(() => assertDisposableConfig(wrongRoot, expected), /DOLI_URL_ROOT/);
});

test('rejects repository data binds, writable application code, and external storage', () => {
  const repositoryData = validConfig();
  repositoryData.services.mariadb.volumes[0] = {
    type: 'bind',
    source: '/workspace/mjl/data/mariadb',
    target: '/var/lib/mysql',
  };
  assert.throws(() => assertDisposableConfig(repositoryData, expected), /named volume/i);

  const writableCode = validConfig();
  writableCode.services.dolibarr.volumes.find((volume) => volume.target === '/var/www/html/custom').read_only = false;
  assert.throws(() => assertDisposableConfig(writableCode, expected), /read-only/i);

  const writableTests = validConfig();
  writableTests.services.dolibarr.volumes.find((volume) => volume.target === '/opt/mjl-tests').read_only = false;
  assert.throws(() => assertDisposableConfig(writableTests, expected), /read-only/i);

  const external = validConfig();
  external.volumes.mjl_test_db.external = true;
  assert.throws(() => assertDisposableConfig(external, expected), /external/i);
});

test('rejects persistent restart policies and undeclared or shared volume names', () => {
  const restarting = validConfig();
  restarting.services.dolibarr.restart = 'unless-stopped';
  assert.throws(() => assertDisposableConfig(restarting, expected), /restart/i);

  const sharedVolume = validConfig();
  sharedVolume.volumes.mjl_test_docs.name = 'shared_documents';
  assert.throws(() => assertDisposableConfig(sharedVolume, expected), /project-scoped/i);
});

test('rejects missing immutable identity, credential, or tmpfs controls', () => {
  for (const key of ['MJL_DISPOSABLE_TEST_TENANT', 'MJL_DISPOSABLE_PROJECT_NAME', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_TEST_USER_PASSWORD']) {
    const config = validConfig();
    delete config.services.dolibarr.environment[key];
    assert.throws(() => assertDisposableConfig(config, expected), /environment|sentinel|password|project/i);
  }
  const config = validConfig();
  config.services.mariadb.tmpfs = [];
  assert.throws(() => assertDisposableConfig(config, expected), /tmpfs/i);
});

test('rejects non-loopback publishing, extra repository data mounts, and shared networks', () => {
  const publicPort = validConfig();
  publicPort.services.dolibarr.ports[0].host_ip = '0.0.0.0';
  assert.throws(() => assertDisposableConfig(publicPort, expected), /loopback/i);

  const extraDataBind = validConfig();
  extraDataBind.services.dolibarr.volumes.push({
    type: 'bind',
    source: '/workspace/mjl/data/documents',
    target: '/unintended-backup',
    read_only: true,
  });
  assert.throws(() => assertDisposableConfig(extraDataBind, expected), /repository data/i);

  const sharedNetwork = validConfig();
  sharedNetwork.networks.default.name = 'shared_default';
  assert.throws(() => assertDisposableConfig(sharedNetwork, expected), /project-scoped network/i);
});

test('rejects extra services, unapproved host mounts, and privileged host sharing', () => {
  const extraService = validConfig();
  extraService.services.observer = { restart: 'no' };
  assert.throws(() => assertDisposableConfig(extraService, expected), /only the mariadb and dolibarr/i);

  const hostMount = validConfig();
  hostMount.services.dolibarr.volumes.push({
    type: 'bind',
    source: '/var/run/docker.sock',
    target: '/var/run/docker.sock',
    read_only: true,
  });
  assert.throws(() => assertDisposableConfig(hostMount, expected), /unapproved bind/i);

  for (const unsafe of [
    { privileged: true },
    { network_mode: 'host' },
    { pid: 'host' },
    { ipc: 'host' },
    { devices: ['/dev/null:/dev/null'] },
  ]) {
    const config = validConfig();
    Object.assign(config.services.dolibarr, unsafe);
    assert.throws(() => assertDisposableConfig(config, expected), /privileged|host|devices/i);
  }
});

test('accepts only cleanup evidence with no surviving project resources', () => {
  assert.doesNotThrow(() => assertCleanupComplete({ containers: [], networks: [], volumes: [] }, expected.projectName));
  assert.throws(
    () => assertCleanupComplete({ containers: ['container-1'], networks: [], volumes: [] }, expected.projectName),
    /container-1/,
  );
  assert.throws(
    () => assertCleanupComplete({ containers: [], networks: ['network-1'], volumes: ['volume-1'] }, expected.projectName),
    /network-1.*volume-1/s,
  );
});
