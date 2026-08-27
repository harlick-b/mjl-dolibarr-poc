'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const HEX_32 = /^[a-f0-9]{32}$/;
const HEX_40 = /^[a-f0-9]{40}$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const PROJECT = /^[a-z0-9][a-z0-9_-]{2,62}$/;
const DOCKER = '/usr/bin/docker';
const GIT = '/usr/bin/git';
const EMPTY_SHA256 = crypto.createHash('sha256').update('').digest('hex');
const PROTECTED_TREE_ROOTS = Object.freeze(['custom', 'docs', 'tests', 'AGENTS.md', 'CONTEXT.md', 'DESIGN.md', 'README.md', 'docker-compose.yml', 'package.json', 'package-lock.json', 'playwright.config.js']);
const SHARED_PROFILE = Object.freeze({
  repository_root: '/home/yoann/Documents/Projects/mjl-dolibarr-poc',
  compose_project_name: 'mjl-dolibarr-poc',
  database_name: 'dolidb',
  database_root: '/home/yoann/Documents/Projects/mjl-dolibarr-poc/data/mariadb',
  document_root: '/home/yoann/Documents/Projects/mjl-dolibarr-poc/data/documents',
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function isAbsoluteNormalized(value) {
  return typeof value === 'string' && path.isAbsolute(value) && path.normalize(value) === value;
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function parseInstant(value, label) {
  invariant(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), `${label} must be canonical UTC.`);
  const instant = new Date(value);
  invariant(Number.isFinite(instant.getTime()) && instant.toISOString() === value, `${label} is invalid.`);
  return instant;
}

function parseLauncherMode(argv) {
  invariant(Array.isArray(argv) && argv.length === 1 && /^--mode=(?:rehearse|execute|recover|rollback)$/.test(argv[0]), 'Exact launcher mode required.');
  return argv[0].slice('--mode='.length);
}

function approvalTargetIdentitySha256(record) {
  const identity = {
    target_profile: record.target_profile,
    compose_project_name: record.compose_project_name,
    database_name: record.database_name,
    database_root: record.database_root,
    document_root: record.document_root,
    repository_root: record.repository_root,
  };
  return crypto.createHash('sha256').update(canonicalJson(identity)).digest('hex');
}

function approvalExecutionIdentitySha256(record) {
  const identity = {
    version: 3,
    operation_id: record.operation_id,
    target_identity_sha256: approvalTargetIdentitySha256(record),
    approved_commit: record.approved_commit,
    complete_tree_sha256: record.complete_tree_sha256,
    complete_tree_manifest_sha256: record.complete_tree_manifest_sha256,
    backup_key_sha256: record.backup_key_sha256,
    backup_root: record.backup_root,
    evidence_root: record.evidence_root,
    compose_config_sha256: record.compose_config_sha256,
    compose_environment_sha256: record.compose_environment_sha256,
    compose_files: record.compose_files,
    docker_runtime: record.docker_runtime,
    database_runtime: record.database_runtime,
    recovery_policy: record.recovery_policy,
  };
  return crypto.createHash('sha256').update(canonicalJson(identity)).digest('hex');
}

function approvalRecordSha256(record) {
  return crypto.createHash('sha256').update(`${canonicalJson(record)}\n`).digest('hex');
}

function targetLockPaths(record) {
  const root = record.target_profile === 'shared' ? '/run/lock' : '/tmp';
  const stem = `mjl-rst005-${approvalTargetIdentitySha256(record)}`;
  return Object.freeze({ target: path.join(root, `${stem}.lock`), mutation: path.join(root, `${stem}.mutation.lock`) });
}

function validateApprovalRecord(record, context = {}) {
  invariant(record && typeof record === 'object' && !Array.isArray(record), 'Approval record must be an object.');
  const expectedKeys = [
    'approved_commit', 'backup_key_sha256', 'backup_root', 'complete_tree_manifest_sha256', 'complete_tree_sha256', 'compose_config_sha256', 'compose_environment_sha256', 'compose_files',
    'compose_project_name', 'database_name', 'database_root', 'database_runtime', 'document_root', 'evidence_root', 'execution_identity_sha256',
    'docker_runtime', 'expires_at', 'issued_at', 'mode', 'mutation_lock_path', 'nonce', 'operation_id', 'recovery_policy',
    'repository_root', 'target_identity_sha256', 'target_lock_path', 'target_profile', 'unit', 'version',
  ].sort();
  invariant(Object.keys(record).sort().join('\n') === expectedKeys.join('\n'), 'Approval record fields are not exact.');
  invariant(record.version === 3 && record.unit === 'RST-005', 'Approval record identity is invalid.');
  invariant(['rehearse', 'execute', 'rollback'].includes(record.mode), 'Approval mode is invalid.');
  invariant(context.expectedMode === 'recover' ? record.mode === 'execute' : record.mode === context.expectedMode, 'Approval mode does not match the requested launcher mode.');
  invariant(HEX_32.test(record.operation_id) && record.recovery_policy === 'containment_only_phase1', 'Approval recovery identity or policy is invalid.');
  invariant(['disposable', 'disposable_shared_shape', 'shared'].includes(record.target_profile), 'Approval target profile is invalid.');
  invariant(HEX_40.test(record.approved_commit), 'Approved commit must be an exact SHA-1 object id.');
  invariant(HEX_64.test(record.backup_key_sha256), 'Approved backup key digest is invalid.');
  invariant(HEX_64.test(record.complete_tree_sha256) && HEX_64.test(record.complete_tree_manifest_sha256), 'Protected-tree evidence is invalid.');
  invariant(HEX_64.test(record.compose_config_sha256), 'Resolved Compose digest is invalid.');
  invariant(HEX_64.test(record.compose_environment_sha256), 'Compose environment digest is invalid.');
  const runtimeKeys = ['daemon_id', 'images', 'server_version', 'tools'].sort();
  invariant(record.docker_runtime && Object.keys(record.docker_runtime).sort().join('\n') === runtimeKeys.join('\n')
    && typeof record.docker_runtime.daemon_id === 'string' && /^[A-Z0-9:.-]{8,128}$/i.test(record.docker_runtime.daemon_id)
    && typeof record.docker_runtime.server_version === 'string' && /^\d+\.\d+\.\d+(?:[-+._A-Za-z0-9]*)?$/.test(record.docker_runtime.server_version),
  'Docker daemon approval identity is invalid.');
  invariant(record.docker_runtime.images && Object.keys(record.docker_runtime.images).sort().join(',') === 'dolibarr,mariadb', 'Approved Docker images are not exact.');
  for (const [name, reference] of [['mariadb', 'mariadb:11'], ['dolibarr', 'dolibarr/dolibarr:23.0.2']]) {
    const image = record.docker_runtime.images[name];
    invariant(image && Object.keys(image).sort().join(',') === 'id,reference,repo_digests'
      && image.reference === reference && /^sha256:[a-f0-9]{64}$/.test(image.id)
      && Array.isArray(image.repo_digests) && image.repo_digests.every((digest) => typeof digest === 'string' && digest.includes('@sha256:'))
      && [...image.repo_digests].sort().join('\n') === image.repo_digests.join('\n'),
    `Approved ${name} image identity is invalid.`);
  }
  invariant(record.docker_runtime.tools && Object.keys(record.docker_runtime.tools).sort().join(',') === 'compose_plugin,docker,flock,git,node,php', 'Approved runtime tool inventory is not exact.');
  for (const [name, tool] of Object.entries(record.docker_runtime.tools)) {
    invariant(tool && Object.keys(tool).sort().join(',') === 'path,sha256,version'
      && isAbsoluteNormalized(tool.path) && HEX_64.test(tool.sha256)
      && typeof tool.version === 'string' && tool.version.length >= 2 && tool.version.length <= 256,
    `Approved ${name} runtime identity is invalid.`);
  }
  invariant(record.database_runtime && Object.keys(record.database_runtime).sort().join(',') === 'client_version,container_id,datadir,datadir_filesystem,image_id,server_identity_sha256,server_version'
    && /^[a-f0-9]{64}$/.test(record.database_runtime.container_id)
    && /^sha256:[a-f0-9]{64}$/.test(record.database_runtime.image_id)
    && record.database_runtime.image_id === record.docker_runtime.images.mariadb.id
    && record.database_runtime.datadir === '/var/lib/mysql/'
    && /^\d+:\d+$/.test(record.database_runtime.datadir_filesystem)
    && HEX_64.test(record.database_runtime.server_identity_sha256)
    && typeof record.database_runtime.client_version === 'string' && record.database_runtime.client_version.length >= 8
    && typeof record.database_runtime.server_version === 'string' && record.database_runtime.server_version.length >= 5,
  'Approved MariaDB runtime identity is invalid.');
  const databaseRuntimeIdentity = { ...record.database_runtime };
  delete databaseRuntimeIdentity.server_identity_sha256;
  invariant(crypto.createHash('sha256').update(canonicalJson(databaseRuntimeIdentity)).digest('hex') === record.database_runtime.server_identity_sha256,
    'Approved MariaDB runtime digest is invalid.');
  invariant(isAbsoluteNormalized(record.repository_root), 'Repository root must be an absolute normalized path.');
  invariant(PROJECT.test(record.compose_project_name), 'Compose project identity is invalid.');
  if (record.target_profile === 'shared') {
    for (const [key, value] of Object.entries(SHARED_PROFILE)) invariant(record[key] === value, `Shared target profile ${key} is not exact.`);
  } else {
    invariant(record.compose_project_name.startsWith('mjl-test-'), 'Disposable target project is invalid.');
    invariant(record.target_profile === 'disposable_shared_shape'
      ? /^\/tmp\/rst005-launcher-execute-rollback-[^/]+\/repository$/.test(record.repository_root)
      : record.mode === 'rehearse', 'Disposable shared-shape profile or mode is invalid.');
    invariant(record.repository_root !== SHARED_PROFILE.repository_root, 'Disposable profile cannot substitute the shared target.');
    if (record.target_profile === 'disposable') {
      invariant(record.database_root === `${record.compose_project_name}_mjl_test_db`
        && record.document_root === `${record.compose_project_name}_mjl_test_docs`, 'Disposable storage identity is not exact.');
    } else {
      invariant(record.database_root === path.join(record.repository_root, 'data/mariadb')
        && record.document_root === path.join(record.repository_root, 'data/documents'), 'Disposable shared-shape storage identity is not exact.');
    }
  }
  invariant(record.mode === 'rehearse' ? record.target_profile === 'disposable' : record.target_profile !== 'disposable', 'Launcher mode and target profile do not match.');
  invariant(record.database_name === 'dolidb', 'RST-005 approval must bind database dolidb.');
  invariant(record.target_identity_sha256 === approvalTargetIdentitySha256(record), 'Target identity digest is invalid.');
  invariant(record.execution_identity_sha256 === approvalExecutionIdentitySha256(record), 'Execution identity digest is invalid.');
  const lockPaths = targetLockPaths(record);
  invariant(record.target_lock_path === lockPaths.target && record.mutation_lock_path === lockPaths.mutation, 'Target lock paths are invalid.');
  for (const name of ['backup_root', 'evidence_root']) invariant(isAbsoluteNormalized(record[name]), `${name} must be an absolute normalized path.`);
  invariant(!isWithin(record.backup_root, record.repository_root) && !isWithin(record.repository_root, record.backup_root), 'Backup root must be outside the repository boundary.');
  invariant(!isWithin(record.evidence_root, record.repository_root) && !isWithin(record.repository_root, record.evidence_root), 'Evidence root must be outside the repository boundary.');
  invariant(!isWithin(record.backup_root, '/var/www') && !isWithin(record.evidence_root, '/var/www'), 'Backup and evidence roots must remain outside web roots.');
  if (record.target_profile !== 'disposable') {
    invariant(!isWithin(record.backup_root, record.document_root) && !isWithin(record.document_root, record.backup_root), 'Backup and document roots must be disjoint.');
    invariant(!isWithin(record.evidence_root, record.document_root) && !isWithin(record.document_root, record.evidence_root), 'Evidence and document roots must be disjoint.');
  }
  invariant(!isWithin(record.backup_root, record.evidence_root) && !isWithin(record.evidence_root, record.backup_root), 'Backup and evidence roots must be disjoint.');
  invariant(Array.isArray(record.compose_files) && record.compose_files.length >= 1 && record.compose_files.length <= 4, 'Approval must bind one to four Compose files.');
  const composePaths = new Set();
  for (const entry of record.compose_files) {
    invariant(entry && typeof entry === 'object' && Object.keys(entry).sort().join(',') === 'path,sha256', 'Compose file binding is invalid.');
    invariant(isAbsoluteNormalized(entry.path) && isWithin(entry.path, record.repository_root), 'Compose file must be inside the approved repository.');
    invariant(HEX_64.test(entry.sha256), 'Compose file digest is invalid.');
    invariant(!composePaths.has(entry.path), 'Compose file bindings must be unique.');
    composePaths.add(entry.path);
  }
  invariant(HEX_32.test(record.nonce), 'Approval nonce must be 16 random bytes encoded as lowercase hexadecimal.');
  const issued = parseInstant(record.issued_at, 'issued_at');
  const expires = parseInstant(record.expires_at, 'expires_at');
  const now = context.now instanceof Date ? context.now : new Date();
  invariant(issued.getTime() <= now.getTime() && (context.expectedMode === 'recover' || now.getTime() < expires.getTime()), 'Approval record is not currently valid.');
  invariant(expires.getTime() - issued.getTime() <= 24 * 60 * 60 * 1000, 'Approval validity may not exceed 24 hours.');
  return Object.freeze({ ...record, compose_files: Object.freeze(record.compose_files.map((entry) => Object.freeze({ ...entry }))) });
}

function mountAt(service, target) {
  const matches = (service.volumes || []).filter((mount) => mount.target === target);
  invariant(matches.length === 1, `Compose target ${target} must have exactly one mount.`);
  return matches[0];
}

function verifyComposeTarget(approval, config) {
  invariant(config && typeof config === 'object' && config.name === approval.compose_project_name, 'Resolved Compose project does not match approval.');
  invariant(Object.keys(config).every((key) => ['name', 'networks', 'services', 'volumes'].includes(key)), 'Resolved Compose contains an unapproved top-level capability.');
  invariant(config.services && Object.keys(config.services).sort().join(',') === 'dolibarr,mariadb', 'Resolved Compose services are not exact.');
  const mariadb = config.services.mariadb;
  const dolibarr = config.services.dolibarr;
  invariant(mariadb.image === 'mariadb:11' && dolibarr.image === 'dolibarr/dolibarr:23.0.2', 'Resolved Compose images are not exact.');
  const databaseEnvironment = mariadb.environment || {};
  const applicationEnvironment = dolibarr.environment || {};
  invariant(Object.keys(mariadb).every((key) => ['command', 'entrypoint', 'environment', 'image', 'networks', 'restart', 'tmpfs', 'volumes'].includes(key))
    && Object.keys(dolibarr).every((key) => ['command', 'depends_on', 'entrypoint', 'environment', 'image', 'networks', 'ports', 'restart', 'volumes'].includes(key))
    && mariadb.command == null && mariadb.entrypoint == null && dolibarr.command == null && dolibarr.entrypoint == null,
  'Resolved Compose service capabilities are not exactly allowlisted.');
  invariant(Object.keys(databaseEnvironment).sort().join(',') === 'MYSQL_DATABASE,MYSQL_PASSWORD,MYSQL_ROOT_PASSWORD,MYSQL_USER', 'MariaDB environment is not exact.');
  const sharedApplicationNames = ['DOLI_ADMIN_LOGIN', 'DOLI_ADMIN_PASSWORD', 'DOLI_COMPANY_COUNTRYCODE', 'DOLI_COMPANY_NAME', 'DOLI_DB_HOST', 'DOLI_DB_NAME', 'DOLI_DB_PASSWORD', 'DOLI_DB_USER', 'DOLI_URL_ROOT', 'MJL_POC_DEFAULT_PASSWORD', 'PHP_INI_DATE_TIMEZONE', 'PHP_INI_POST_MAX_SIZE', 'PHP_INI_UPLOAD_MAX_FILESIZE'];
  const disposableNames = [...sharedApplicationNames, 'MJL_DISPOSABLE_PROJECT_NAME', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_DISPOSABLE_TEST_TENANT', 'MJL_TEST_USER_PASSWORD'];
  invariant(Object.keys(applicationEnvironment).sort().join(',') === (approval.target_profile === 'disposable' ? disposableNames : sharedApplicationNames).sort().join(','), 'Dolibarr environment is not exact.');
  invariant(databaseEnvironment.MYSQL_DATABASE === approval.database_name
    && applicationEnvironment.DOLI_DB_NAME === approval.database_name
    && applicationEnvironment.DOLI_DB_HOST === 'mariadb'
    && typeof databaseEnvironment.MYSQL_USER === 'string' && databaseEnvironment.MYSQL_USER !== ''
    && typeof databaseEnvironment.MYSQL_PASSWORD === 'string' && databaseEnvironment.MYSQL_PASSWORD !== ''
    && applicationEnvironment.DOLI_DB_USER === databaseEnvironment.MYSQL_USER
    && applicationEnvironment.DOLI_DB_PASSWORD === databaseEnvironment.MYSQL_PASSWORD,
  'Resolved Compose database connection identity does not match the approved MariaDB service.');
  for (const [name, service] of Object.entries(config.services)) {
    invariant(service.privileged !== true && service.pid !== 'host' && service.ipc !== 'host' && service.network_mode !== 'host', `${name} has an unsafe host boundary.`);
    invariant(!Array.isArray(service.cap_add) || service.cap_add.length === 0, `${name} adds unapproved Linux capabilities.`);
    invariant(!Array.isArray(service.devices) || service.devices.length === 0, `${name} exposes unapproved devices.`);
    invariant(!Array.isArray(service.device_cgroup_rules) || service.device_cgroup_rules.length === 0, `${name} has unapproved device rules.`);
    invariant(service.userns_mode !== 'host', `${name} disables user namespace isolation.`);
    invariant(!(service.volumes || []).some((mount) => mount.source === '/var/run/docker.sock'), `${name} exposes the Docker control socket.`);
    invariant(Object.keys(service.networks || {}).join(',') === 'default' && service.networks.default === null,
      `${name} service network attachment options are not exact.`);
  }
  invariant(Object.keys(config.networks || {}).join(',') === 'default'
    && config.networks.default.name === `${approval.compose_project_name}_default`
    && Object.keys(config.networks.default).sort().join(',') === 'ipam,name'
    && config.networks.default.ipam && Object.keys(config.networks.default.ipam).length === 0,
  'Compose network topology is not exact.');
  invariant(!mariadb.ports || mariadb.ports.length === 0, 'MariaDB may not publish ports.');
  const databaseMount = mountAt(mariadb, '/var/lib/mysql');
  const documentMount = mountAt(dolibarr, '/var/www/documents');
  if (approval.target_profile === 'disposable') {
    invariant(canonicalJson(mariadb.tmpfs) === canonicalJson(['/run/mjl-test:size=1m,mode=0700,noexec,nosuid,nodev']),
      'Disposable MariaDB tmpfs is not exact.');
    invariant(mariadb.restart === 'no' && dolibarr.restart === 'no', 'Disposable services must not restart persistently.');
    invariant(databaseMount.type === 'volume' && databaseMount.source === 'mjl_test_db', 'Disposable database must use its run-scoped named volume.');
    invariant(documentMount.type === 'volume' && documentMount.source === 'mjl_test_docs', 'Disposable documents must use their run-scoped named volume.');
    const environment = dolibarr.environment || {};
    invariant(environment.MJL_DISPOSABLE_TEST_TENANT === '1' && environment.MJL_DISPOSABLE_PROJECT_NAME === approval.compose_project_name, 'Disposable service attestation does not match approval.');
    const ports = (dolibarr.ports || []).filter((port) => Number(port.target) === 80);
    invariant((dolibarr.ports || []).length === 1 && ports.length === 1 && Number(ports[0].published) !== 8080 && ports[0].host_ip === '127.0.0.1' && ports[0].protocol === 'tcp', 'Disposable browser target must use a non-shared loopback port.');
    invariant((mariadb.volumes || []).length === 1 && (dolibarr.volumes || []).length === 6, 'Disposable service mount inventory is not exact.');
    for (const [name, volume] of Object.entries(config.volumes || {})) invariant(volume.external !== true && volume.name === `${approval.compose_project_name}_${name}`, 'Disposable volume is not project-scoped.');
    for (const network of Object.values(config.networks || {})) invariant(network.external !== true && typeof network.name === 'string' && network.name.startsWith(`${approval.compose_project_name}_`), 'Disposable network is not project-scoped.');
  } else {
    invariant(mariadb.tmpfs == null, 'Shared MariaDB has an unapproved tmpfs mount.');
    invariant((dolibarr.environment || {}).MJL_DISPOSABLE_TEST_TENANT !== '1', 'Shared target may not carry a disposable marker.');
    invariant(databaseMount.type === 'bind' && fs.realpathSync(databaseMount.source) === path.join(approval.repository_root, 'data/mariadb'), 'Shared database storage does not match the approved repository tenant.');
    invariant(documentMount.type === 'bind' && fs.realpathSync(documentMount.source) === approval.document_root, 'Shared document storage does not match approval.');
    invariant((mariadb.volumes || []).length === 1, 'Shared MariaDB has an unexpected mount.');
    const customMount = mountAt(dolibarr, '/var/www/html/custom');
    const guardMount = mountAt(dolibarr, '/etc/apache2/conf-enabled/mjl-native-guard.conf');
    invariant((dolibarr.volumes || []).length === 3, 'Shared Dolibarr has an unexpected mount.');
    invariant(customMount.type === 'bind' && fs.realpathSync(customMount.source) === path.join(approval.repository_root, 'custom'), 'Shared custom source does not match the approved repository.');
    invariant(guardMount.type === 'bind' && guardMount.read_only === true
      && fs.realpathSync(guardMount.source) === path.join(approval.repository_root, 'custom/mjlfinancement/deployment/apache-native-guard.conf'),
    'Shared native guard mount does not match the approved repository.');
    const ports = (dolibarr.ports || []).filter((port) => Number(port.target) === 80);
    invariant((dolibarr.ports || []).length === 1 && ports.length === 1 && Number(ports[0].published) === 8080 && ports[0].protocol === 'tcp', 'Shared browser target must be the approved port 8080 service.');
    invariant(Object.keys(config.volumes || {}).length === 0, 'Shared target has an unexpected named volume.');
    const networks = Object.values(config.networks || {});
    invariant(networks.length === 1 && networks[0].external !== true
      && networks[0].name === `${approval.compose_project_name}_default`, 'Shared target network is not exact.');
  }
  return true;
}

function validateStoppedServices(services) {
  invariant(Array.isArray(services) && [...services].sort().join(',') === 'mariadb', 'Traffic stop requires MariaDB running and Dolibarr stopped.');
  return true;
}

function buildSharedAuthorization(approval, mode, evidenceManifestSha256) {
  invariant(approval && ['shared', 'disposable_shared_shape'].includes(approval.target_profile) && ['execute', 'rollback'].includes(approval.mode), 'Shared-path approval is required.');
  invariant(['apply', 'finalize', 'recover', 'rollback'].includes(mode), 'Shared mutation mode is invalid.');
  invariant(approval.mode === 'rollback' ? mode === 'rollback' : mode !== 'rollback', 'Shared authorization mode exceeds approval.');
  invariant(HEX_64.test(evidenceManifestSha256), 'Evidence manifest digest is invalid.');
  return Object.freeze({
    version: 3,
    unit: 'RST-005',
    mode,
    operation_id: approval.operation_id,
    recovery_policy: approval.recovery_policy,
    target_identity_sha256: approval.target_identity_sha256,
    execution_identity_sha256: approval.execution_identity_sha256,
    approved_commit: approval.approved_commit,
    complete_tree_sha256: approval.complete_tree_sha256,
    evidence_manifest_sha256: evidenceManifestSha256,
    approval_nonce: approval.nonce,
    approval_sha256: approvalRecordSha256(approval),
  });
}

function readProtectedFd(descriptor, label, options = {}) {
  invariant(Number.isInteger(descriptor) && descriptor >= 0, `${label} descriptor is invalid.`);
  const requiredUid = Number.isInteger(options.requiredUid) ? options.requiredUid : 0;
  const maximumBytes = Number.isInteger(options.maximumBytes) ? options.maximumBytes : 65536;
  const stat = fs.fstatSync(descriptor);
  invariant(stat.isFile() && stat.uid === requiredUid && (stat.mode & 0o7777) === 0o400 && stat.nlink === 1, `${label} descriptor custody is invalid.`);
  invariant(stat.size >= (options.allowEmpty === true ? 0 : 1) && stat.size <= maximumBytes, `${label} descriptor size is invalid.`);
  const descriptorPath = fs.readlinkSync(`/proc/self/fd/${descriptor}`);
  invariant(path.isAbsolute(descriptorPath), `${label} descriptor target is not an absolute path.`);
  const canonicalPath = fs.realpathSync(descriptorPath);
  invariant(canonicalPath === descriptorPath, `${label} descriptor target is not canonical.`);
  const targetStat = fs.lstatSync(canonicalPath);
  invariant(targetStat.isFile() && !targetStat.isSymbolicLink() && targetStat.dev === stat.dev && targetStat.ino === stat.ino, `${label} descriptor target changed.`);
  const custodyPath = path.dirname(canonicalPath);
  validateCustodyAncestors(custodyPath, requiredUid);
  const custodyStat = fs.lstatSync(custodyPath);
  invariant(custodyStat.isDirectory() && !custodyStat.isSymbolicLink() && custodyStat.uid === requiredUid && (custodyStat.mode & 0o7777) === 0o700, `${label} custody directory is invalid.`);
  const bytes = fs.readFileSync(descriptor);
  invariant(bytes.length === stat.size, `${label} descriptor changed while it was read.`);
  const after = fs.fstatSync(descriptor);
  invariant(after.dev === stat.dev && after.ino === stat.ino && after.size === stat.size && after.mtimeMs === stat.mtimeMs && after.ctimeMs === stat.ctimeMs, `${label} descriptor changed while it was read.`);
  return Object.freeze({ bytes, path: canonicalPath, stat });
}

function readProtectedPath(file, label, options = {}) {
  invariant(isAbsoluteNormalized(file), `${label} path is invalid.`);
  const requiredUid = Number.isInteger(options.requiredUid) ? options.requiredUid : 0;
  const maximumBytes = Number.isInteger(options.maximumBytes) ? options.maximumBytes : 65536;
  const parent = path.dirname(file);
  validateCustodyAncestors(parent, requiredUid);
  const parentStat = fs.lstatSync(parent);
  invariant(parentStat.isDirectory() && !parentStat.isSymbolicLink() && parentStat.uid === requiredUid
    && (parentStat.mode & 0o7777) === 0o700, `${label} custody directory is invalid.`);
  invariant(fs.realpathSync(parent) === parent, `${label} custody directory is not canonical.`);
  const before = fs.lstatSync(file);
  invariant(before.isFile() && !before.isSymbolicLink() && before.uid === requiredUid
    && (before.mode & 0o7777) === 0o400 && before.nlink === 1, `${label} path custody is invalid.`);
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const evidence = readProtectedFd(descriptor, label, { requiredUid, maximumBytes, allowEmpty: options.allowEmpty === true });
    invariant(evidence.path === file && evidence.stat.dev === before.dev && evidence.stat.ino === before.ino,
      `${label} path changed while it was opened.`);
    return evidence;
  } finally {
    fs.closeSync(descriptor);
  }
}

function verifyInheritedTargetLock(lockPath, options = {}) {
  const requiredUid = Number.isInteger(options.requiredUid) ? options.requiredUid : 0;
  invariant(isAbsoluteNormalized(lockPath), 'Target lock path is invalid.');
  const lockStat = fs.lstatSync(lockPath);
  invariant(lockStat.isFile() && !lockStat.isSymbolicLink() && lockStat.uid === requiredUid
    && (lockStat.mode & 0o7777) === 0o600, 'Inherited target lock custody is invalid.');
  const descriptors = fs.readdirSync('/proc/self/fd').filter((name) => /^\d+$/.test(name));
  const inherited = descriptors.find((name) => {
    try {
      const stat = fs.fstatSync(Number(name));
      return stat.dev === lockStat.dev && stat.ino === lockStat.ino;
    } catch (_) { return false; }
  });
  invariant(inherited !== undefined, 'Launcher must inherit the flock target descriptor.');
  const descriptor = Number(inherited);
  const descriptorInfo = fs.readFileSync(`/proc/self/fdinfo/${descriptor}`, 'utf8');
  invariant(/^lock:\s+\d+: FLOCK\s+ADVISORY\s+WRITE\s+\d+\s+[0-9a-f]+:[0-9a-f]+:\d+\s+0\s+EOF$/im.test(descriptorInfo),
    'Launcher inherited the target descriptor without an active exclusive flock.');
  const contender = spawnSync('/usr/bin/flock', ['--nonblock', lockPath, '/usr/bin/true'], {
    env: sanitizedRuntimeEnvironment({}, 'shared'), stdio: 'ignore',
  });
  invariant(contender.status === 1, 'Independent target-lock contention proof failed.');
  return descriptor;
}

function verifyMutationLeaseAvailable(lockPath, options = {}) {
  const requiredUid = Number.isInteger(options.requiredUid) ? options.requiredUid : 0;
  invariant(isAbsoluteNormalized(lockPath), 'Mutation lock path is invalid.');
  const stat = fs.lstatSync(lockPath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.uid === requiredUid
    && (stat.mode & 0o7777) === 0o600 && stat.nlink === 1, 'Mutation lock custody is invalid.');
  const probe = spawnSync('/usr/bin/flock', ['--nonblock', lockPath, '/usr/bin/true'], {
    env: sanitizedRuntimeEnvironment({}, 'shared'), stdio: 'ignore',
  });
  invariant(probe.status === 0, 'A prior RST-005 mutation lease is still active.');
  return true;
}

function validateCustodyAncestors(target, requiredUid = 0) {
  invariant(isAbsoluteNormalized(target), 'Custody ancestor target is invalid.');
  const filesystemRootUid = fs.lstatSync(path.parse(target).root).uid;
  let current = target;
  while (true) {
    const stat = fs.lstatSync(current);
    const mode = stat.mode & 0o7777;
    const trustedOwner = stat.uid === 0 || stat.uid === requiredUid || (requiredUid !== 0 && stat.uid === filesystemRootUid);
    const stickyRootDirectory = (stat.uid === 0 || (requiredUid !== 0 && stat.uid === filesystemRootUid)) && (mode & 0o1000) !== 0;
    invariant(stat.isDirectory() && !stat.isSymbolicLink() && trustedOwner
      && (((mode & 0o022) === 0) || stickyRootDirectory), 'Custody ancestor chain is replaceable.');
    invariant(fs.realpathSync(current) === current, 'Custody ancestor chain is not canonical.');
    if (current === path.parse(current).root) break;
    current = path.dirname(current);
  }
  return true;
}

function validateTrafficRecord(record, approval, now = new Date()) {
  invariant(record && typeof record === 'object' && !Array.isArray(record), 'Traffic-stop record must be an object.');
  const expectedKeys = ['approval_nonce', 'approval_sha256', 'approved_commit', 'compose_project_name', 'database_name', 'exclusive_docker_administration', 'execution_identity_sha256', 'expires_at', 'no_direct_database_writers', 'no_direct_host_writers', 'nonce', 'operation_id', 'operator', 'stopped_at', 'target_identity_sha256', 'unit', 'version'].sort();
  invariant(Object.keys(record).sort().join('\n') === expectedKeys.join('\n'), 'Traffic-stop record fields are not exact.');
  invariant(record.version === 3 && record.unit === 'RST-005', 'Traffic-stop record identity is invalid.');
  invariant(record.approved_commit === approval.approved_commit && record.compose_project_name === approval.compose_project_name && record.database_name === approval.database_name, 'Traffic-stop record does not bind the approved target.');
  invariant(record.operation_id === approval.operation_id
    && record.target_identity_sha256 === approval.target_identity_sha256
    && record.execution_identity_sha256 === approval.execution_identity_sha256
    && record.approval_sha256 === approvalRecordSha256(approval)
    && record.approval_nonce === approval.nonce, 'Traffic-stop record does not bind the approved operation package.');
  invariant(HEX_32.test(record.nonce) && record.nonce !== approval.nonce, 'Traffic-stop nonce is invalid.');
  invariant(typeof record.operator === 'string' && /^[A-Za-z0-9_.@-]{1,128}$/.test(record.operator), 'Traffic-stop operator identity is invalid.');
  invariant(record.exclusive_docker_administration === true && record.no_direct_host_writers === true && record.no_direct_database_writers === true,
    'Traffic-stop record lacks exclusive administration/writer attestations.');
  const stopped = parseInstant(record.stopped_at, 'stopped_at');
  const expires = parseInstant(record.expires_at, 'expires_at');
  const issued = parseInstant(approval.issued_at, 'approval issued_at');
  invariant(issued.getTime() <= stopped.getTime(), 'Traffic-stop attestation cannot predate approval issuance.');
  invariant(stopped.getTime() <= now.getTime() && now.getTime() < expires.getTime(), 'Traffic-stop attestation is not currently valid.');
  invariant(expires.getTime() - stopped.getTime() <= 15 * 60 * 1000, 'Traffic-stop attestation may not exceed 15 minutes.');
  return Object.freeze({ ...record });
}

function hashFileStreaming(file) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(65536);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    buffer.fill(0);
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function digestField(hash, type, value) {
  const bytes = Buffer.from(String(value));
  hash.update(`${type}:${bytes.length}:`);
  hash.update(bytes);
  hash.update('\n');
}

function protectedTreeEvidence(repositoryRoot) {
  const root = fs.realpathSync(repositoryRoot);
  invariant(root === repositoryRoot, 'Repository root must be canonical.');
  const hash = crypto.createHash('sha256');
  const entries = [];
  const add = (absolute, relative) => {
    const stat = fs.lstatSync(absolute);
    invariant(!stat.isSymbolicLink(), `Protected source refuses symbolic link: ${relative}`);
    if (stat.isDirectory()) {
      entries.push(Object.freeze({ path: relative, type: 'directory', mode: stat.mode & 0o7777, size: 0, sha256: null }));
      digestField(hash, 'directory-path', relative);
      digestField(hash, 'directory-mode', stat.mode & 0o7777);
      for (const name of fs.readdirSync(absolute).sort()) add(path.join(absolute, name), `${relative}/${name}`);
    } else {
      invariant(stat.isFile() && stat.nlink === 1, `Protected source refuses non-regular or linked file: ${relative}`);
      const fileSha256 = hashFileStreaming(absolute);
      entries.push(Object.freeze({ path: relative, type: 'file', mode: stat.mode & 0o7777, size: stat.size, sha256: fileSha256 }));
      digestField(hash, 'file-path', relative);
      digestField(hash, 'file-mode', stat.mode & 0o7777);
      digestField(hash, 'file-size', stat.size);
      digestField(hash, 'file-sha256', fileSha256);
    }
  };
  for (const relative of PROTECTED_TREE_ROOTS) {
    add(path.join(root, relative), relative);
  }
  const manifest = Object.freeze({ version: 3, unit: 'RST-005', entries: Object.freeze(entries) });
  return Object.freeze({
    manifest,
    manifestSha256: crypto.createHash('sha256').update(`${canonicalJson(manifest)}\n`).digest('hex'),
    completeTreeSha256: hash.digest('hex'),
  });
}

function protectedTreeDigest(repositoryRoot) {
  return protectedTreeEvidence(repositoryRoot).completeTreeSha256;
}

function gitOutput(root, arguments_) {
  return execFileSync(GIT, ['-c', `safe.directory=${root}`, ...arguments_], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function dockerRuntimeIdentity(options = {}) {
  const output = (args) => execFileSync(DOCKER, args, { encoding: 'utf8', env: sanitizedRuntimeEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const images = {};
  for (const [name, reference] of [['mariadb', 'mariadb:11'], ['dolibarr', 'dolibarr/dolibarr:23.0.2']]) {
    const inspected = JSON.parse(output(['image', 'inspect', reference]))[0];
    images[name] = Object.freeze({ reference, id: inspected.Id, repo_digests: Object.freeze([...(inspected.RepoDigests || [])].sort()) });
  }
  const tool = (executable, args) => Object.freeze({
    path: executable,
    sha256: hashFileStreaming(fs.realpathSync(executable)),
    version: execFileSync(executable, args, { encoding: 'utf8', env: sanitizedRuntimeEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0],
  });
  const plugins = JSON.parse(output(['info', '--format', '{{json .ClientInfo.Plugins}}'])) || [];
  const composePlugin = plugins.find((plugin) => plugin && plugin.Name === 'compose' && isAbsoluteNormalized(plugin.Path));
  invariant(composePlugin, 'Docker Compose plugin executable identity is unavailable.');
  const toolOverrides = options.toolOverrides || {};
  invariant(toolOverrides && typeof toolOverrides === 'object' && !Array.isArray(toolOverrides)
    && Object.keys(toolOverrides).every((name) => ['node', 'php'].includes(name)), 'Docker runtime tool overrides are not exact.');
  return Object.freeze({
    daemon_id: output(['info', '--format', '{{.ID}}']),
    server_version: output(['version', '--format', '{{.Server.Version}}']),
    images: Object.freeze(images),
    tools: Object.freeze({
      compose_plugin: tool(fs.realpathSync(composePlugin.Path), ['version']),
      docker: tool(DOCKER, ['--version']),
      flock: tool('/usr/bin/flock', ['--version']),
      git: tool(GIT, ['--version']),
      node: toolOverrides.node || tool(process.execPath, ['--version']),
      php: toolOverrides.php || tool('/usr/local/bin/php', ['--version']),
    }),
  });
}

function sanitizedRuntimeEnvironment(source = process.env, targetKind = 'shared') {
  invariant(['shared', 'disposable', 'disposable_shared_shape'].includes(targetKind), 'Runtime environment target profile is invalid.');
  const allowed = {};
  if (targetKind !== 'shared') {
    for (const name of ['MJL_BASE_URL', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_EVIDENCE_ROOT', 'MJL_REPOSITORY_ROOT', 'MJL_TEST_PORT', 'MJL_TEST_USER_PASSWORD']) {
      if (typeof source[name] === 'string') allowed[name] = source[name];
    }
  }
  return Object.freeze({
    ...allowed,
    HOME: '/root',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    DOCKER_HOST: 'unix:///var/run/docker.sock',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
  });
}

function verifyDockerRuntimeBinding(approval) {
  const live = dockerRuntimeIdentity();
  invariant(canonicalJson(live) === canonicalJson(approval.docker_runtime), 'Docker daemon or image identity does not match approval.');
  return live;
}

function verifyRepositoryBinding(approval) {
  const root = fs.realpathSync(approval.repository_root);
  invariant(root === approval.repository_root, 'Approved repository root is not canonical.');
  const commit = gitOutput(root, ['rev-parse', '--verify', 'HEAD']);
  invariant(commit === approval.approved_commit, 'Repository HEAD does not match the approved commit.');
  invariant(gitOutput(root, ['status', '--porcelain=v1', '--untracked-files=all']) === '', 'Repository must be clean before RST-005 launch.');
  const tree = protectedTreeEvidence(root);
  const completeTreeSha256 = tree.completeTreeSha256;
  invariant(completeTreeSha256 === approval.complete_tree_sha256 && tree.manifestSha256 === approval.complete_tree_manifest_sha256,
    'Protected repository tree or manifest digest does not match approval.');
  for (const compose of approval.compose_files) invariant(hashFileStreaming(compose.path) === compose.sha256, 'Compose file digest does not match approval.');
  return Object.freeze({ commit, completeTreeSha256 });
}

module.exports = {
  EMPTY_SHA256,
  PROTECTED_TREE_ROOTS,
  SHARED_PROFILE,
  approvalExecutionIdentitySha256,
  approvalRecordSha256,
  approvalTargetIdentitySha256,
  buildSharedAuthorization,
  canonicalJson,
  dockerRuntimeIdentity,
  parseLauncherMode,
  protectedTreeDigest,
  protectedTreeEvidence,
  readProtectedFd,
  readProtectedPath,
  sanitizedRuntimeEnvironment,
  validateApprovalRecord,
  validateStoppedServices,
  validateTrafficRecord,
  validateCustodyAncestors,
  verifyInheritedTargetLock,
  verifyMutationLeaseAvailable,
  targetLockPaths,
  verifyComposeTarget,
  verifyDockerRuntimeBinding,
  verifyRepositoryBinding,
};
