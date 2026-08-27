const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  EMPTY_SHA256,
  SHARED_PROFILE,
  approvalExecutionIdentitySha256,
  approvalRecordSha256,
  approvalTargetIdentitySha256,
  buildSharedAuthorization,
  parseLauncherMode,
  protectedTreeDigest,
  protectedTreeEvidence,
  readProtectedFd,
  readProtectedPath,
  sanitizedRuntimeEnvironment,
  validateApprovalRecord,
  validateStoppedServices,
  validateTrafficRecord,
  verifyComposeTarget,
  verifyRepositoryBinding,
  targetLockPaths,
} = require('../../custom/mjlfinancement/scripts/rst005_shared_launcher.lib');
const {
  cleanupIsolatedRestoreResources,
  cleanupNamedContainers,
  classifyDatabaseTruth,
  durableRecordChain,
  decryptFileToCommand,
  encryptCommandOutput,
  isolatedRestoreNames,
  writeDurableRecord,
  validateRollbackReport,
} = require('../../custom/mjlfinancement/scripts/rst005_shared_operation.lib');

function approvedRecord(overrides = {}) {
  const record = {
    version: 3,
    unit: 'RST-005',
    operation_id: '0'.repeat(32),
    recovery_policy: 'containment_only_phase1',
    mode: 'rehearse',
    target_profile: 'disposable',
    approved_commit: 'a'.repeat(40),
    backup_key_sha256: '9'.repeat(64),
    complete_tree_sha256: 'b'.repeat(64),
    complete_tree_manifest_sha256: '7'.repeat(64),
    docker_runtime: {
      daemon_id: 'RST005-DAEMON-01',
      server_version: '28.4.0',
      images: {
        dolibarr: { reference: 'dolibarr/dolibarr:23.0.2', id: `sha256:${'d'.repeat(64)}`, repo_digests: [`dolibarr/dolibarr@sha256:${'e'.repeat(64)}`] },
        mariadb: { reference: 'mariadb:11', id: `sha256:${'f'.repeat(64)}`, repo_digests: [`mariadb@sha256:${'1'.repeat(64)}`] },
      },
      tools: {
        compose_plugin: { path: '/usr/libexec/docker/cli-plugins/docker-compose', sha256: '2'.repeat(64), version: 'Docker Compose version v2.35.1' },
        docker: { path: '/usr/bin/docker', sha256: '2'.repeat(64), version: 'Docker version 28.4.0' },
        flock: { path: '/usr/bin/flock', sha256: '8'.repeat(64), version: 'flock from util-linux 2.41' },
        git: { path: '/usr/bin/git', sha256: '3'.repeat(64), version: 'git version 2.34.1' },
        node: { path: '/usr/bin/node', sha256: '4'.repeat(64), version: 'v22.22.0' },
        php: { path: '/usr/local/bin/php', sha256: '5'.repeat(64), version: 'PHP 8.4.0' },
      },
    },
    database_runtime: { container_id: '6'.repeat(64), client_version: 'mariadb  Ver 15.1 Distrib 11.8.2-MariaDB', server_version: '11.8.2-MariaDB', image_id: `sha256:${'f'.repeat(64)}`, datadir: '/var/lib/mysql/', datadir_filesystem: '1:2', server_identity_sha256: '' },
    repository_root: '/workspace/mjl-dolibarr-poc',
    compose_project_name: 'mjl-test-20260824-1234-abcdef12',
    compose_config_sha256: '1'.repeat(64),
    compose_environment_sha256: EMPTY_SHA256,
    compose_files: [
      { path: '/workspace/mjl-dolibarr-poc/docker-compose.yml', sha256: 'c'.repeat(64) },
      { path: '/workspace/mjl-dolibarr-poc/tests/fixtures/disposable-compose.override.yml', sha256: 'd'.repeat(64) },
    ],
    database_name: 'dolidb',
    database_root: 'mjl-test-20260824-1234-abcdef12_mjl_test_db',
    document_root: 'mjl-test-20260824-1234-abcdef12_mjl_test_docs',
    backup_root: '/var/lib/mjl-rst005/backups',
    evidence_root: '/var/lib/mjl-rst005/evidence',
    issued_at: '2026-08-24T15:00:00.000Z',
    expires_at: '2026-08-25T15:00:00.000Z',
    nonce: 'e'.repeat(32),
    ...overrides,
  };
  const databaseIdentity = { ...record.database_runtime };
  delete databaseIdentity.server_identity_sha256;
  record.database_runtime.server_identity_sha256 = crypto.createHash('sha256').update(require('../../custom/mjlfinancement/scripts/rst005_shared_launcher.lib').canonicalJson(databaseIdentity)).digest('hex');
  if (!Object.hasOwn(overrides, 'target_identity_sha256')) record.target_identity_sha256 = approvalTargetIdentitySha256(record);
  if (!Object.hasOwn(overrides, 'execution_identity_sha256')) record.execution_identity_sha256 = approvalExecutionIdentitySha256(record);
  const locks = targetLockPaths(record);
  if (!Object.hasOwn(overrides, 'target_lock_path')) record.target_lock_path = locks.target;
  if (!Object.hasOwn(overrides, 'mutation_lock_path')) record.mutation_lock_path = locks.mutation;
  return record;
}

test('approval record binds one exact RST-005 launcher target', () => {
  const result = validateApprovalRecord(approvedRecord(), {
    now: new Date('2026-08-24T16:00:00.000Z'),
    expectedMode: 'rehearse',
  });

  assert.deepEqual(result, approvedRecord());
});

test('launcher modes separate incomplete recovery from approved rollback', () => {
  for (const mode of ['rehearse', 'execute', 'recover', 'rollback']) {
    assert.equal(parseLauncherMode([`--mode=${mode}`]), mode);
  }
  assert.throws(() => parseLauncherMode(['--mode=resume']));
});

test('shared runtime environment suppresses ambient Compose and test variables', () => {
  const source = {
    COMPOSE_FILE: '/tmp/substitute.yml', COMPOSE_PROJECT_NAME: 'substitute',
    MJL_TEST_PORT: '49999', MJL_TEST_USER_PASSWORD: 'must-not-cross',
    MJL_BASE_URL: 'http://substitute', DOCKER_HOST: 'tcp://substitute:2375',
    PATH: '/tmp/substitute', HOME: '/tmp/substitute', LANG: 'fr_FR.UTF-8',
  };
  assert.deepEqual(sanitizedRuntimeEnvironment(source, 'shared'), {
    HOME: '/root', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    DOCKER_HOST: 'unix:///var/run/docker.sock', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8',
  });
  const disposable = sanitizedRuntimeEnvironment(source, 'disposable');
  assert.equal(disposable.MJL_TEST_PORT, '49999');
  assert.equal(disposable.MJL_TEST_USER_PASSWORD, 'must-not-cross');
  assert.equal(disposable.COMPOSE_FILE, undefined);
  assert.equal(disposable.COMPOSE_PROJECT_NAME, undefined);
});

test('durable operation records are immutable, fsync-backed, and exactly hash chained', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-record-chain-'));
  fs.chmodSync(root, 0o700);
  try {
    const binding = { operationId: '0123456789abcdef0123456789abcdef', targetIdentitySha256: 'a'.repeat(64), executionIdentitySha256: 'e'.repeat(64) };
    const first = writeDurableRecord(root, { ...binding, sequence: 0, kind: 'manifest-before', previousSha256: null, payload: { phase: 'before' } }, { requiredUid: process.getuid() });
    const second = writeDurableRecord(root, { ...binding, sequence: 1, kind: 'checkpoint-before-apply', previousSha256: first.sha256, payload: { next_mutation: 'apply' } }, { requiredUid: process.getuid() });
    assert.deepEqual(durableRecordChain(root, binding, { requiredUid: process.getuid() }).map((record) => record.kind), ['manifest-before', 'checkpoint-before-apply']);
    assert.equal(fs.statSync(first.path).mode & 0o7777, 0o400);
    assert.throws(() => writeDurableRecord(root, { ...binding, sequence: 1, kind: 'checkpoint-before-apply', previousSha256: first.sha256, payload: {} }, { requiredUid: process.getuid() }), /already exists|sequence/i);
    fs.chmodSync(second.path, 0o600);
    fs.appendFileSync(second.path, 'corruption');
    fs.chmodSync(second.path, 0o400);
    assert.throws(() => durableRecordChain(root, binding, { requiredUid: process.getuid() }), /digest|canonical|corrupt/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('durable operation packages reject missing, reordered, and copied records', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-record-replay-'));
  const copied = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-record-copy-'));
  fs.chmodSync(root, 0o700);
  fs.chmodSync(copied, 0o700);
  const binding = { operationId: '1234567890abcdef1234567890abcdef', targetIdentitySha256: 'b'.repeat(64), executionIdentitySha256: 'e'.repeat(64) };
  try {
    const first = writeDurableRecord(root, { ...binding, sequence: 0, kind: 'manifest-before', previousSha256: null, payload: { phase: 1 } }, { requiredUid: process.getuid() });
    const second = writeDurableRecord(root, { ...binding, sequence: 1, kind: 'checkpoint-before-apply', previousSha256: first.sha256, payload: { phase: 2 } }, { requiredUid: process.getuid() });
    fs.copyFileSync(second.path, path.join(copied, path.basename(second.path)));
    fs.chmodSync(path.join(copied, path.basename(second.path)), 0o400);
    assert.throws(() => durableRecordChain(copied, binding, { requiredUid: process.getuid() }), /reordered|contradictory/i);
    fs.unlinkSync(first.path);
    assert.throws(() => durableRecordChain(root, binding, { requiredUid: process.getuid() }), /reordered|contradictory/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(copied, { recursive: true, force: true });
  }
});

test('launcher lock ownership is inherited and has no child sleep holder', () => {
  const launcher = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_shared_launcher.js'), 'utf8');
  const operation = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_shared_operation.lib.js'), 'utf8');
  assert.match(launcher, /verifyInheritedTargetLock/);
  assert.doesNotMatch(operation, /acquireTargetLock|2147483647/);
});

test('recovery classifies database truth independently and never guesses unknown state', () => {
  assert.equal(classifyDatabaseTruth({ schema: 'phase1', temporary_tables: [], finalized: false }), 'exact_phase1');
  assert.equal(classifyDatabaseTruth({ schema: 'phase1', temporary_tables: ['llx_mjlfinancement_activity_rst005_target'], finalized: false }), 'guarded_transitional');
  assert.equal(classifyDatabaseTruth({ schema: 'target', temporary_tables: ['llx_mjlfinancement_activity_rst005_phase1_quarantine'], finalized: false }), 'target_pre_finalization');
  assert.equal(classifyDatabaseTruth({ schema: 'target', temporary_tables: [], finalized: true }), 'finalized_target');
  assert.equal(classifyDatabaseTruth({ schema: 'target', temporary_tables: [], finalized: false }), 'unknown');
  assert.equal(classifyDatabaseTruth({ schema: 'other', temporary_tables: [], finalized: false }), 'unknown');
});

test('approval record rejects substitution, unsafe roots, and stale authority', () => {
  const context = { now: new Date('2026-08-24T16:00:00.000Z'), expectedMode: 'rehearse' };
  for (const record of [
    approvedRecord({ unit: 'RST-006A' }),
    approvedRecord({ mode: 'execute' }),
    approvedRecord({ approved_commit: 'a'.repeat(39) }),
    approvedRecord({ complete_tree_sha256: 'B'.repeat(64) }),
    approvedRecord({ docker_runtime: { ...approvedRecord().docker_runtime, daemon_id: '' } }),
    approvedRecord({ docker_runtime: { ...approvedRecord().docker_runtime, tools: { ...approvedRecord().docker_runtime.tools, php: { ...approvedRecord().docker_runtime.tools.php, sha256: 'x'.repeat(64) } } } }),
    approvedRecord({ database_runtime: { ...approvedRecord().database_runtime, container_id: '6'.repeat(63) } }),
    approvedRecord({ compose_environment: { COMPOSE_FILE: '/tmp/substitute.yml' } }),
    approvedRecord({ repository_root: 'relative/repository' }),
    approvedRecord({ compose_project_name: 'mjl-dolibarr-poc' }),
    approvedRecord({ target_kind: 'shared' }),
    approvedRecord({ database_name: 'otherdb' }),
    approvedRecord({ backup_root: '/workspace/mjl-dolibarr-poc/backups' }),
    approvedRecord({ evidence_root: '/var/www/html/evidence' }),
    approvedRecord({ expires_at: '2026-08-24T15:30:00.000Z' }),
    approvedRecord({ expires_at: '2026-08-26T15:00:00.000Z' }),
    approvedRecord({ nonce: 'not-random' }),
  ]) {
    assert.throws(() => validateApprovalRecord(record, context));
  }
});

test('recover accepts only the original incomplete execute packet after expiry', () => {
  const execute = approvedRecord({
    mode: 'execute', target_profile: 'shared', ...SHARED_PROFILE,
    compose_files: [{ path: `${SHARED_PROFILE.repository_root}/docker-compose.yml`, sha256: 'c'.repeat(64) }],
    issued_at: '2026-08-24T15:00:00.000Z', expires_at: '2026-08-24T16:00:00.000Z',
  });
  assert.equal(validateApprovalRecord(execute, {
    now: new Date('2026-08-25T16:00:00.000Z'), expectedMode: 'recover',
  }).operation_id, execute.operation_id);
  assert.throws(() => validateApprovalRecord({ ...execute, mode: 'rollback' }, {
    now: new Date('2026-08-25T16:00:00.000Z'), expectedMode: 'recover',
  }));
  assert.throws(() => validateApprovalRecord({ ...execute, recovery_policy: 'continue_forward' }, {
    now: new Date('2026-08-25T16:00:00.000Z'), expectedMode: 'recover',
  }));
});

function disposableComposeConfig(approval) {
  const mariadbEnvironment = { MYSQL_DATABASE: 'dolidb', MYSQL_USER: 'dolidbuser', MYSQL_PASSWORD: 'local-test-value', MYSQL_ROOT_PASSWORD: 'local-root-value' };
  const dolibarrEnvironment = Object.fromEntries(['DOLI_ADMIN_LOGIN', 'DOLI_ADMIN_PASSWORD', 'DOLI_COMPANY_COUNTRYCODE', 'DOLI_COMPANY_NAME', 'DOLI_DB_HOST', 'DOLI_DB_NAME', 'DOLI_DB_PASSWORD', 'DOLI_DB_USER', 'DOLI_URL_ROOT', 'MJL_POC_DEFAULT_PASSWORD', 'PHP_INI_DATE_TIMEZONE', 'PHP_INI_POST_MAX_SIZE', 'PHP_INI_UPLOAD_MAX_FILESIZE', 'MJL_DISPOSABLE_PROJECT_NAME', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_DISPOSABLE_TEST_TENANT', 'MJL_TEST_USER_PASSWORD'].map((name) => [name, 'fixture']));
  Object.assign(dolibarrEnvironment, { DOLI_DB_NAME: 'dolidb', DOLI_DB_HOST: 'mariadb', DOLI_DB_USER: 'dolidbuser', DOLI_DB_PASSWORD: 'local-test-value', MJL_DISPOSABLE_TEST_TENANT: '1', MJL_DISPOSABLE_PROJECT_NAME: approval.compose_project_name });
  return {
    name: approval.compose_project_name,
    services: {
      mariadb: {
        image: 'mariadb:11',
        restart: 'no',
        environment: mariadbEnvironment, networks: { default: null }, tmpfs: ['/run/mjl-test'],
        volumes: [{ type: 'volume', source: 'mjl_test_db', target: '/var/lib/mysql' }],
      },
      dolibarr: {
        image: 'dolibarr/dolibarr:23.0.2',
        restart: 'no',
        environment: dolibarrEnvironment, networks: { default: null },
        ports: [{ target: 80, published: '43123', host_ip: '127.0.0.1', protocol: 'tcp' }],
        volumes: [
          { type: 'volume', source: 'mjl_test_docs', target: '/var/www/documents' },
          { type: 'volume', source: 'mjl_test_conf', target: '/var/www/html/conf' },
          { type: 'bind', source: '/workspace/custom', target: '/var/www/html/custom', read_only: true },
          { type: 'bind', source: '/workspace/guard', target: '/etc/apache2/conf-enabled/mjl-native-guard.conf', read_only: true },
          { type: 'bind', source: '/workspace/tests', target: '/opt/mjl-tests', read_only: true },
          { type: 'bind', source: '/workspace/evidence', target: '/opt/mjl-evidence', read_only: true },
        ],
      },
    },
    volumes: {
      mjl_test_db: { name: `${approval.compose_project_name}_mjl_test_db` },
      mjl_test_docs: { name: `${approval.compose_project_name}_mjl_test_docs` },
      mjl_test_conf: { name: `${approval.compose_project_name}_mjl_test_conf` },
    },
    networks: { default: { name: `${approval.compose_project_name}_default` } },
  };
}

test('resolved disposable topology is project-scoped and never targets shared storage or port', () => {
  const approval = approvedRecord();
  const config = disposableComposeConfig(approval);
  assert.equal(verifyComposeTarget(approval, config), true);
  assert.throws(() => verifyComposeTarget(approval, { ...config, name: 'substitute' }));
  const sharedPort = structuredClone(config);
  sharedPort.services.dolibarr.ports[0].published = '8080';
  assert.throws(() => verifyComposeTarget(approval, sharedPort));
  const sharedBind = structuredClone(config);
  sharedBind.services.mariadb.volumes[0] = { type: 'bind', source: '/workspace/data/mariadb', target: '/var/lib/mysql' };
  assert.throws(() => verifyComposeTarget(approval, sharedBind));
  for (const mutation of [
    (candidate) => { candidate.services.dolibarr.cap_add = ['SYS_ADMIN']; },
    (candidate) => { candidate.services.dolibarr.devices = ['/dev/sda:/dev/sda']; },
    (candidate) => { candidate.services.dolibarr.userns_mode = 'host'; },
  ]) {
    const unsafe = structuredClone(config);
    mutation(unsafe);
    assert.throws(() => verifyComposeTarget(approval, unsafe));
  }
  for (const [field, value] of [['DOLI_DB_HOST', 'alternate-db'], ['DOLI_DB_USER', 'substitute'], ['DOLI_DB_PASSWORD', 'substitute']]) {
    const substitutedConnection = structuredClone(config);
    substitutedConnection.services.dolibarr.environment[field] = value;
    assert.throws(() => verifyComposeTarget(approval, substitutedConnection));
  }
  assert.equal(validateStoppedServices(['mariadb']), true);
  assert.throws(() => validateStoppedServices(['dolibarr', 'mariadb']));
  assert.throws(() => validateStoppedServices([]));
});

test('resolved shared topology binds exact images, storage, guard, and mount inventory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-shared-topology-'));
  for (const directory of ['data/mariadb', 'data/documents', 'custom/mjlfinancement/deployment']) fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.writeFileSync(path.join(root, 'custom/mjlfinancement/deployment/apache-native-guard.conf'), 'deny\n');
  const approval = approvedRecord({
    mode: 'execute', target_profile: 'disposable_shared_shape', compose_project_name: 'mjl-test-rst005-shared-shape-unit', repository_root: root,
    database_root: path.join(root, 'data/mariadb'),
    document_root: path.join(root, 'data/documents'), backup_root: `${root}-backups`, evidence_root: `${root}-evidence`,
    compose_files: [{ path: path.join(root, 'docker-compose.yml'), sha256: 'c'.repeat(64) }],
  });
  const config = {
    name: approval.compose_project_name,
    networks: { default: { name: `${approval.compose_project_name}_default` } },
    services: {
      mariadb: { image: 'mariadb:11', restart: 'unless-stopped', networks: { default: null }, environment: { MYSQL_DATABASE: 'dolidb', MYSQL_USER: 'dolidbuser', MYSQL_PASSWORD: 'local-test-value', MYSQL_ROOT_PASSWORD: 'local-root-value' }, volumes: [{ type: 'bind', source: path.join(root, 'data/mariadb'), target: '/var/lib/mysql' }] },
      dolibarr: {
        image: 'dolibarr/dolibarr:23.0.2', restart: 'unless-stopped', networks: { default: null }, environment: Object.assign(Object.fromEntries(['DOLI_ADMIN_LOGIN', 'DOLI_ADMIN_PASSWORD', 'DOLI_COMPANY_COUNTRYCODE', 'DOLI_COMPANY_NAME', 'DOLI_DB_HOST', 'DOLI_DB_NAME', 'DOLI_DB_PASSWORD', 'DOLI_DB_USER', 'DOLI_URL_ROOT', 'MJL_POC_DEFAULT_PASSWORD', 'PHP_INI_DATE_TIMEZONE', 'PHP_INI_POST_MAX_SIZE', 'PHP_INI_UPLOAD_MAX_FILESIZE'].map((name) => [name, 'fixture'])), { DOLI_DB_NAME: 'dolidb', DOLI_DB_HOST: 'mariadb', DOLI_DB_USER: 'dolidbuser', DOLI_DB_PASSWORD: 'local-test-value' }), ports: [{ target: 80, published: '8080', host_ip: '0.0.0.0', protocol: 'tcp' }],
        volumes: [
          { type: 'bind', source: path.join(root, 'data/documents'), target: '/var/www/documents' },
          { type: 'bind', source: path.join(root, 'custom'), target: '/var/www/html/custom' },
          { type: 'bind', source: path.join(root, 'custom/mjlfinancement/deployment/apache-native-guard.conf'), target: '/etc/apache2/conf-enabled/mjl-native-guard.conf', read_only: true },
        ],
      },
    },
  };
  try {
    assert.equal(verifyComposeTarget(approval, config), true);
    const extraMount = structuredClone(config);
    extraMount.services.dolibarr.volumes.push({ type: 'bind', source: root, target: '/unexpected' });
    assert.throws(() => verifyComposeTarget(approval, extraMount));
    const wrongImage = structuredClone(config);
    wrongImage.services.mariadb.image = 'mariadb:latest';
    assert.throws(() => verifyComposeTarget(approval, wrongImage));
    const externalNetwork = structuredClone(config);
    externalNetwork.networks.default.external = true;
    assert.throws(() => verifyComposeTarget(approval, externalNetwork));
    const substitutedCustom = structuredClone(config);
    substitutedCustom.services.dolibarr.volumes[1].source = root;
    assert.throws(() => verifyComposeTarget(approval, substitutedCustom));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('protected descriptors require a regular 0400 file inside a 0700 custody directory', () => {
  const custody = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-custody-'));
  fs.chmodSync(custody, 0o700);
  const recordPath = path.join(custody, 'approval.json');
  fs.writeFileSync(recordPath, '{"ok":true}\n', { mode: 0o400 });
  const descriptor = fs.openSync(recordPath, 'r');
  try {
    const result = readProtectedFd(descriptor, 'approval', { requiredUid: process.getuid(), maximumBytes: 1024 });
    assert.equal(result.bytes.toString('utf8'), '{"ok":true}\n');
    assert.equal(result.path, recordPath);
  } finally {
    fs.closeSync(descriptor);
    fs.rmSync(custody, { recursive: true, force: true });
  }
});

test('protected descriptors reject writable files, links, and weak custody directories', () => {
  for (const mutation of ['writable', 'hardlink', 'weak-directory']) {
    const custody = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-custody-'));
    fs.chmodSync(custody, mutation === 'weak-directory' ? 0o755 : 0o700);
    const original = path.join(custody, 'record.json');
    fs.writeFileSync(original, '{}', { mode: mutation === 'writable' ? 0o600 : 0o400 });
    let target = original;
    if (mutation === 'hardlink') {
      fs.linkSync(original, path.join(custody, 'second-link.json'));
    }
    const descriptor = fs.openSync(target, 'r');
    try {
      assert.throws(() => readProtectedFd(descriptor, 'record', { requiredUid: process.getuid(), maximumBytes: 1024 }));
    } finally {
      fs.closeSync(descriptor);
      fs.rmSync(custody, { recursive: true, force: true });
    }
  }
});

test('protected launcher paths reject a true symlink origin with O_NOFOLLOW', () => {
  const custody = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-path-custody-'));
  fs.chmodSync(custody, 0o700);
  const original = path.join(custody, 'original');
  const link = path.join(custody, 'record');
  fs.writeFileSync(original, '{}\n', { mode: 0o400 });
  fs.symlinkSync('original', link);
  try {
    assert.throws(() => readProtectedPath(link, 'record', { requiredUid: process.getuid(), maximumBytes: 1024 }));
  } finally {
    fs.rmSync(custody, { recursive: true, force: true });
  }
});

test('traffic-stop record is short-lived and bound to the approved target', () => {
  const approval = approvedRecord();
  const traffic = {
    version: 3,
    unit: 'RST-005',
    operation_id: approval.operation_id,
    target_identity_sha256: approval.target_identity_sha256,
    execution_identity_sha256: approval.execution_identity_sha256,
    approval_sha256: approvalRecordSha256(approval),
    approval_nonce: approval.nonce,
    approved_commit: approval.approved_commit,
    compose_project_name: approval.compose_project_name,
    database_name: 'dolidb',
    stopped_at: '2026-08-24T15:55:00.000Z',
    expires_at: '2026-08-24T16:05:00.000Z',
    nonce: 'f'.repeat(32),
    operator: 'mjl-operator@example.test',
    exclusive_docker_administration: true,
    no_direct_host_writers: true,
    no_direct_database_writers: true,
  };
  assert.deepEqual(validateTrafficRecord(traffic, approval, new Date('2026-08-24T16:00:00.000Z')), traffic);
  assert.throws(() => validateTrafficRecord({ ...traffic, compose_project_name: 'mjl-test-substitute' }, approval, new Date('2026-08-24T16:00:00.000Z')));
  assert.throws(() => validateTrafficRecord({ ...traffic, expires_at: '2026-08-24T16:30:00.000Z' }, approval, new Date('2026-08-24T16:00:00.000Z')));
  assert.throws(() => validateTrafficRecord(traffic, approval, new Date('2026-08-24T16:06:00.000Z')));
});

function createProtectedRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-repository-'));
  for (const directory of ['custom', 'docs', 'tests']) fs.mkdirSync(path.join(root, directory));
  fs.writeFileSync(path.join(root, 'custom', 'module.php'), '<?php echo "sealed";\n');
  fs.writeFileSync(path.join(root, 'docs', 'strategy.md'), 'approved\n');
  fs.writeFileSync(path.join(root, 'tests', 'gate.js'), 'assert(true);\n');
  for (const file of ['AGENTS.md', 'CONTEXT.md', 'DESIGN.md', 'README.md', 'docker-compose.yml', 'package.json', 'package-lock.json', 'playwright.config.js']) {
    fs.writeFileSync(path.join(root, file), `${file}\n`);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'rst005@example.test'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'RST-005 Test'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'sealed'], { cwd: root });
  return root;
}

test('repository binding requires the exact clean commit and complete protected tree', () => {
  const root = createProtectedRepository();
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const tree = protectedTreeEvidence(root);
    const digest = tree.completeTreeSha256;
    const approval = approvedRecord({
      approved_commit: commit,
      complete_tree_sha256: digest,
      complete_tree_manifest_sha256: tree.manifestSha256,
      repository_root: root,
      compose_files: [{ path: path.join(root, 'docker-compose.yml'), sha256: '4740170d246a123d28311697027f4e1e9373b07f0369d419f37225bd52750440' }],
      backup_root: `${root}-backups`,
      evidence_root: `${root}-evidence`,
    });
    assert.deepEqual(verifyRepositoryBinding(approval), { commit, completeTreeSha256: digest });
    fs.writeFileSync(path.join(root, 'docs', 'strategy.md'), 'substituted\n');
    assert.throws(() => verifyRepositoryBinding(approval), /clean/);
    execFileSync('git', ['checkout', '--', 'docs/strategy.md'], { cwd: root });
    fs.writeFileSync(path.join(root, 'docs', '.ignored'), 'hidden substitution\n');
    fs.writeFileSync(path.join(root, '.gitignore'), 'docs/.ignored\n');
    execFileSync('git', ['add', '.gitignore'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'ignore marker'], { cwd: root });
    const newCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const ignoredApproval = { ...approval, approved_commit: newCommit };
    assert.throws(() => verifyRepositoryBinding(ignoredApproval), /digest/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('launcher CLI accepts only one exact mode argument and is secret-silent', () => {
  const launcher = path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_shared_launcher.js');
  for (const mode of ['rehearse', 'execute', 'recover', 'rollback']) assert.equal(parseLauncherMode([`--mode=${mode}`]), mode);
  for (const args of [
    [],
    ['rehearse'],
    ['--mode=rehearse', '--mode=rollback'],
    ['--mode=rehearse', '--approval=/tmp/forbidden'],
    ['--mode=unknown'],
    ['--mode=rollback', 'extra'],
  ]) {
    assert.throws(() => parseLauncherMode(args));
    const result = spawnSync(process.execPath, [launcher, ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'RST-005 shared launcher failed closed.\n');
  }
  const source = fs.readFileSync(launcher, 'utf8');
  assert.match(source, /process\.getuid\(\) !== 0/);
  assert.match(source, /readProtectedPath\(PROTECTED_INPUTS\.approval,/);
  assert.match(source, /readProtectedPath\(PROTECTED_INPUTS\.key,/);
  assert.match(source, /readProtectedPath\(PROTECTED_INPUTS\.traffic,/);
  assert.match(source, /readProtectedPath\(PROTECTED_INPUTS\.environment,/);
  assert.doesNotMatch(source, /approval(?:Path|File)|key(?:Path|File)|traffic(?:Path|File)/i);
  assert.match(source, /for \(const evidence of \[keyEvidence, approvalEvidence, trafficEvidence, environmentEvidence\]\)/);
  assert.match(source, /validateApprovalRecord\(parseCanonicalRecord\(freshApproval\.bytes, 'Approval'\), \{ expectedMode: mode \}\)/);
  assert.match(source, /validateTrafficRecord\(traffic, approval\)/);
});

test('every backup and mutation rechecks the complete live launcher binding', () => {
  const operation = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_shared_operation.lib.js'), 'utf8');
  assert.match(operation, /const requireLiveBinding = async/);
  assert.ok((operation.match(/await requireLiveBinding\(\)/g) || []).length >= 9);
  assert.match(operation, /RST-005 rollback traffic-stop recheck/);
  assert.match(operation, /await assertLiveBinding\(\)/);
  assert.match(operation, /'container', 'create', '--pull=never'/);
  assert.match(operation, /'container', 'inspect'/);
  assert.match(operation, /'start', '--attach'/);
  const launcher = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_shared_launcher.js'), 'utf8');
  assert.match(launcher, /verifyRepositoryBinding\(approval\)/);
  assert.match(launcher, /verifyComposeTarget\(approval,/);
  assert.match(launcher, /sameProtectedFile\(freshKey, keyEvidence\)/);
  assert.match(launcher, /verifyInheritedTargetLock\(approval\.target_lock_path\)/);
  assert.doesNotMatch(launcher, /acquireTargetLock|targetLock\.release/);
  assert.match(operation, /protectedTreeDigest\(runtimeRoot\) === approval\.complete_tree_sha256/);
  assert.match(operation, /--env-file', environmentFile/);
  assert.match(operation, /runRst005Recover/);
});

test('shared one-offs use a root-only allowlisted ephemeral configuration and read-only data mounts', () => {
  const bootstrap = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_oneoff_bootstrap.php'), 'utf8');
  const operation = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_shared_operation.lib.js'), 'utf8');
  assert.match(bootstrap, /PHP_SAPI !== 'cli'/);
  assert.match(bootstrap, /posix_geteuid\(\) !== 0/);
  assert.match(bootstrap, /in_array\(\$script, \$allowed, true\)/);
  assert.match(bootstrap, /\/tmp\/rst005-oneoff-data/);
  assert.match(bootstrap, /register_shutdown_function/);
  assert.match(bootstrap, /@unlink\(\$configurationPath\)/);
  assert.match(bootstrap, /\$argc = count\(\$argv\)/);
  assert.doesNotMatch(bootstrap, /poc_pwd|poc_root_pwd|Admin1234/);
  assert.match(operation, /\$\{approval\.document_root\}:\/var\/www\/documents:ro/);
  assert.match(operation, /rst005_oneoff_bootstrap\.php/);
});

test('shared migration authorization binds launcher approval, operation, and evidence manifest', () => {
  const approval = approvedRecord({
    mode: 'execute',
    target_profile: 'disposable_shared_shape',
  });
  const record = buildSharedAuthorization(approval, 'apply', '2'.repeat(64));
  assert.deepEqual(record, {
    version: 3,
    unit: 'RST-005',
    mode: 'apply',
    operation_id: approval.operation_id,
    recovery_policy: 'containment_only_phase1',
    target_identity_sha256: approval.target_identity_sha256,
    execution_identity_sha256: approval.execution_identity_sha256,
    approved_commit: approval.approved_commit,
    complete_tree_sha256: approval.complete_tree_sha256,
    evidence_manifest_sha256: '2'.repeat(64),
    approval_nonce: approval.nonce,
    approval_sha256: approvalRecordSha256(approval),
  });
  assert.throws(() => buildSharedAuthorization(approval, 'verify', '2'.repeat(64)));
  assert.throws(() => buildSharedAuthorization(approval, 'apply', '2'.repeat(63)));
  const migration = fs.readFileSync(path.resolve(__dirname, '../../custom/mjlfinancement/scripts/rst005_activity_foundation.php'), 'utf8');
  assert.match(migration, /rst005_require_shared_launcher_authorization/);
  assert.match(migration, /\/run\/mjl-rst005\/authorization\.json/);
  assert.match(migration, /MJL_RST005_SHARED_LAUNCHER/);
});

test('backup transport encrypts and restores by streaming with an FD-only key', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-secretstream-'));
  fs.chmodSync(root, 0o700);
  const cipher = path.join(root, 'backup.secretstream');
  const restored = path.join(root, 'restored.txt');
  const key = Buffer.from('0123456789abcdef0123456789abcdef');
  try {
    const encrypted = await encryptCommandOutput(process.execPath, ['-e', 'process.stdout.write("sealed backup\\n")'], key, cipher);
    assert.match(encrypted.plaintextSha256, /^[a-f0-9]{64}$/);
    assert.match(encrypted.ciphertextSha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.statSync(cipher).mode & 0o7777, 0o600);
    await decryptFileToCommand(cipher, key, process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(restored)}, require('node:fs').readFileSync(0))`]);
    assert.equal(fs.readFileSync(restored, 'utf8'), 'sealed backup\n');
  } finally {
    key.fill(0);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('backup transport preserves a payload spanning multiple full pipe chunks', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst005-secretstream-large-'));
  fs.chmodSync(root, 0o700);
  const cipher = path.join(root, 'backup.secretstream');
  const restored = path.join(root, 'restored.bin');
  const key = Buffer.from('abcdef0123456789abcdef0123456789');
  const expectedBytes = 1024 * 1024 + 137;
  try {
    await encryptCommandOutput(process.execPath, ['-e', `process.stdout.write(Buffer.alloc(${expectedBytes}, 0x5a))`], key, cipher);
    await decryptFileToCommand(cipher, key, process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(restored)}, require('node:fs').readFileSync(0))`]);
    const restoredBytes = fs.readFileSync(restored);
    assert.equal(restoredBytes.length, expectedBytes);
    assert.equal(crypto.createHash('sha256').update(restoredBytes).digest('hex'), crypto.createHash('sha256').update(Buffer.alloc(expectedBytes, 0x5a)).digest('hex'));
  } finally {
    key.fill(0);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('isolated restore resource names are approval-scoped and injection-safe', () => {
  assert.deepEqual(isolatedRestoreNames('abcdef0123456789abcdef0123456789'), {
    databaseContainer: 'mjl-rst005-db-abcdef0123456789abcdef0123456789',
    evidenceContainer: 'mjl-rst005-evidence-abcdef0123456789abcdef0123456789',
    network: 'mjl-rst005-net-abcdef0123456789abcdef0123456789',
    databaseVolume: 'mjl-rst005-dbvol-abcdef0123456789abcdef0123456789',
    documentVolume: 'mjl-rst005-docvol-abcdef0123456789abcdef0123456789',
  });
  assert.throws(() => isolatedRestoreNames('abcdef;docker'));
});

test('isolated restore cleanup covers ambiguous creates and retries transient removals', async () => {
  const names = isolatedRestoreNames('abcdef0123456789abcdef0123456789');
  let generation = 0;
  const removals = [];
  const execute = async (_command, args) => {
    if (args[0] === 'rm' || (args[0] === 'network' && args[1] === 'rm') || (args[0] === 'volume' && args[1] === 'rm')) {
      removals.push(args.join(' '));
      if (generation === 0) { const error = new Error('simulated ambiguous/transient Docker response'); error.rst005Reason = 'conflict'; throw error; }
      return Buffer.alloc(0);
    }
    if (args[0] === 'ps') return Buffer.from(generation === 0 ? 'container-id\n' : '');
    if (args[0] === 'network' && args[1] === 'ls') return Buffer.from(generation === 0 ? 'network-id\n' : '');
    if (args[0] === 'volume' && args[1] === 'ls') {
      const result = Buffer.from(generation === 0 ? 'volume-id\n' : '');
      if (args.some((entry) => entry.includes(names.documentVolume))) generation += 1;
      return result;
    }
    throw new Error(`Unexpected fake Docker command: ${args.join(' ')}`);
  };
  assert.equal(await cleanupIsolatedRestoreResources(names, execute), true);
  for (const name of Object.values(names)) assert.ok(removals.some((commandLine) => commandLine.includes(name)));
  assert.ok(removals.length >= 8, 'every exact resource should be retried after the transient failure');
});

test('one-off cleanup retries exact containers after transient Docker failures', async () => {
  const names = ['mjl-rst005-test-oneoff-1', 'mjl-rst005-test-oneoff-2'];
  let generation = 0;
  const removals = [];
  const execute = async (_command, args) => {
    if (args[0] === 'rm') {
      removals.push(args.at(-1));
      if (generation === 0) { const error = new Error('simulated transient removal failure'); error.rst005Reason = 'conflict'; throw error; }
      return Buffer.alloc(0);
    }
    if (args[0] === 'ps') {
      const result = Buffer.from(generation === 0 ? 'container-id\n' : '');
      if (args.at(-1).includes(names.at(-1))) generation += 1;
      return result;
    }
    throw new Error(`Unexpected fake Docker command: ${args.join(' ')}`);
  };
  assert.equal(await cleanupNamedContainers(names, execute), true);
  for (const name of names) assert.ok(removals.filter((removed) => removed === name).length >= 2);
});

test('rollback accepts only the retained finalized report for the approved execution tree', () => {
  const approval = approvedRecord({ mode: 'rollback', target_profile: 'disposable_shared_shape' });
  const manifestSha256 = '4'.repeat(64);
  const report = {
    version: 3,
    unit: 'RST-005',
    mode: 'execute',
    operation_id: approval.operation_id,
    target_identity_sha256: approval.target_identity_sha256,
    execution_identity_sha256: approval.execution_identity_sha256,
    status: 'executed_target_finalized',
    approved_commit: approval.approved_commit,
    complete_tree_sha256: approval.complete_tree_sha256,
    manifest_sha256: manifestSha256,
    source_sha256: '5'.repeat(64),
    database_delta: {
      finalized_tables: ['llx_const', 'llx_menu', 'llx_mjlfinancement_activity', 'llx_user_rights'],
      finalized_schema_objects: ['triggers'],
      rollback_tables: null,
      rollback_schema_objects: null,
    },
    activity_evidence: {
      phase1_oracle_sha256: 'db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2',
      target_oracle_sha256: '8eb99ee99c6dc748bd368e925e9938ccf086291d264e3812ac6320c8ec06b745',
      before: { schema: 'phase1', oracle_sha256: 'db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2', rows: 0, columns: 14, table_sha256: '1'.repeat(64), temporary_tables: [], audit_rows: 0, audit_sha256: '2'.repeat(64), trigger_schema_sha256: '4'.repeat(64) },
      finalized: { schema: 'target', oracle_sha256: '8eb99ee99c6dc748bd368e925e9938ccf086291d264e3812ac6320c8ec06b745', rows: 0, columns: 20, table_sha256: '3'.repeat(64), temporary_tables: [], audit_rows: 0, audit_sha256: '2'.repeat(64), trigger_schema_sha256: '5'.repeat(64) },
      rollback: null,
    },
    before: {
      database_sha256: '1'.repeat(64), protected_tables_sha256: '2'.repeat(64), documents_sha256: '3'.repeat(64),
      ecm_sha256: '4'.repeat(64), admin_sha256: '5'.repeat(64), module_metadata_sha256: '6'.repeat(64),
      compose_resources: { sha256: '7'.repeat(64), counts: { containers: 1, networks: 1, volumes: 0 } },
    },
    finalized: {
      database_sha256: '6'.repeat(64),
      protected_tables_sha256: '7'.repeat(64),
      documents_sha256: '8'.repeat(64),
      ecm_sha256: '9'.repeat(64),
      admin_sha256: 'a'.repeat(64),
      module_metadata_sha256: 'b'.repeat(64),
      compose_resources: { sha256: 'c'.repeat(64), counts: { containers: 2, networks: 1, volumes: 3 } },
      business_counts: { activities: 0, audit_events: 0 },
    },
    rollback: null,
    backup_restore: { schemaPlaintextSha256: 'd'.repeat(64), fullPlaintextSha256: 'e'.repeat(64), restorableDatabaseSha256: 'f'.repeat(64) },
  };
  assert.equal(validateRollbackReport(report, approval, manifestSha256), true);
  for (const mutation of [
    { approved_commit: '9'.repeat(40) },
    { complete_tree_sha256: '8'.repeat(64) },
    { manifest_sha256: '7'.repeat(64) },
    { mode: 'rehearse' },
    { status: 'rehearsed_and_containment_restored' },
    { finalized: { ...report.finalized, business_counts: null } },
    { activity_evidence: { ...report.activity_evidence, finalized: { ...report.activity_evidence.finalized, temporary_tables: ['llx_mjlfinancement_activity_rst005_phase1_quarantine'] } } },
  ]) assert.throws(() => validateRollbackReport({ ...report, ...mutation }, approval, manifestSha256));
});
