#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  SHARED_PROFILE,
  approvalExecutionIdentitySha256,
  approvalRecordSha256,
  approvalTargetIdentitySha256,
  canonicalJson,
  dockerRuntimeIdentity,
  protectedTreeEvidence,
  sanitizedRuntimeEnvironment,
  validateApprovalRecord,
  verifyComposeTarget,
  verifyRepositoryBinding,
  targetLockPaths,
  validateCustodyAncestors,
} = require('./rst005_shared_launcher.lib');

function invariant(condition, message) { if (!condition) throw new Error(message); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function hostToolIdentity(source, approvedPath, args) {
  return Object.freeze({
    path: approvedPath,
    sha256: sha256(fs.readFileSync(fs.realpathSync(source))),
    version: execFileSync(source, args, { encoding: 'utf8', env: sanitizedRuntimeEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0],
  });
}
function immutableImagePhpIdentity(imageId) {
  const base = ['run', '--rm', '--pull=never', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true'];
  const digest = execFileSync('/usr/bin/docker', [...base, '--entrypoint', '/usr/bin/sha256sum', imageId, '/usr/local/bin/php'], {
    encoding: 'utf8', env: sanitizedRuntimeEnvironment(), stdio: ['ignore', 'pipe', 'pipe'],
  }).trim().split(/\s+/)[0];
  const version = execFileSync('/usr/bin/docker', [...base, '--entrypoint', '/usr/local/bin/php', imageId, '--version'], {
    encoding: 'utf8', env: sanitizedRuntimeEnvironment(), stdio: ['ignore', 'pipe', 'pipe'],
  }).trim().split('\n')[0];
  invariant(/^[a-f0-9]{64}$/.test(digest) && version.startsWith('PHP '), 'Immutable operator-image PHP identity is invalid.');
  return Object.freeze({ path: '/usr/local/bin/php', sha256: digest, version });
}
function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0));
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}
function protectedDirectory(directory) {
  fs.mkdirSync(directory, { mode: 0o700 });
  fs.chownSync(directory, 0, 0);
  fs.chmodSync(directory, 0o700);
  fsyncDirectory(path.dirname(directory));
}
function protectedFile(file, bytes) {
  const descriptor = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o400);
  try {
    let offset = 0;
    while (offset < bytes.length) offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
    fs.fsyncSync(descriptor);
    fs.fchownSync(descriptor, 0, 0);
    fs.fchmodSync(descriptor, 0o400);
    fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  fsyncDirectory(path.dirname(file));
}
function outputArgument(argv) {
  invariant(argv.length === 1 && argv[0].startsWith('--output-root='), 'Use exactly --output-root=/absolute/new/directory.');
  const result = argv[0].slice('--output-root='.length);
  invariant(path.isAbsolute(result) && path.normalize(result) === result && !fs.existsSync(result), 'Output root must be a new absolute normalized path.');
  return result;
}

function main() {
  invariant(typeof process.getuid === 'function' && process.getuid() === 0, 'Root operator required.');
  const outputRoot = outputArgument(process.argv.slice(2));
  validateCustodyAncestors(path.dirname(outputRoot), 0);
  const git = (arguments_) => execFileSync('/usr/bin/git', ['-c', `safe.directory=${SHARED_PROFILE.repository_root}`, ...arguments_], {
    cwd: SHARED_PROFILE.repository_root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const repository = { commit: git(['rev-parse', '--verify', 'HEAD']) };
  invariant(git(['status', '--porcelain=v1', '--untracked-files=all']) === '', 'Repository must be clean before packet generation.');
  const tree = protectedTreeEvidence(SHARED_PROFILE.repository_root);
  const composeFile = path.join(SHARED_PROFILE.repository_root, 'docker-compose.yml');
  const runtimeEnvironment = sanitizedRuntimeEnvironment();
  const resolvedBytes = execFileSync('/usr/bin/docker', ['compose', '--env-file', '/dev/null', '--project-directory', SHARED_PROFILE.repository_root,
    '-f', composeFile, '-p', SHARED_PROFILE.compose_project_name, 'config', '--format', 'json'], {
    cwd: SHARED_PROFILE.repository_root, env: runtimeEnvironment, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const databaseContainer = execFileSync('/usr/bin/docker', ['compose', '--env-file', '/dev/null', '--project-directory', SHARED_PROFILE.repository_root,
    '-f', composeFile, '-p', SHARED_PROFILE.compose_project_name, 'ps', '-q', 'mariadb'], {
    cwd: SHARED_PROFILE.repository_root, env: runtimeEnvironment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const databaseQuery = (arguments_) => execFileSync('/usr/bin/docker', ['compose', '--env-file', '/dev/null', '--project-directory', SHARED_PROFILE.repository_root,
    '-f', composeFile, '-p', SHARED_PROFILE.compose_project_name, 'exec', '-T', 'mariadb', ...arguments_], {
    cwd: SHARED_PROFILE.repository_root, env: runtimeEnvironment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const databaseRuntime = {
    container_id: databaseContainer,
    image_id: JSON.parse(execFileSync('/usr/bin/docker', ['container', 'inspect', databaseContainer], { encoding: 'utf8', env: runtimeEnvironment, stdio: ['ignore', 'pipe', 'pipe'] }))[0].Image,
    client_version: databaseQuery(['mariadb', '--version']),
    server_version: databaseQuery(['sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SELECT VERSION()"']),
    datadir: databaseQuery(['sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SELECT @@datadir"']),
    datadir_filesystem: databaseQuery(['stat', '-Lc', '%d:%i', '/var/lib/mysql']),
  };
  databaseRuntime.server_identity_sha256 = sha256(Buffer.from(canonicalJson(databaseRuntime)));
  const environmentBytes = Buffer.alloc(0);
  const key = crypto.randomBytes(32);
  const now = new Date();
  const dolibarrImageId = JSON.parse(execFileSync('/usr/bin/docker', ['image', 'inspect', 'dolibarr/dolibarr:23.0.2'], {
    encoding: 'utf8', env: runtimeEnvironment, stdio: ['ignore', 'pipe', 'pipe'],
  }))[0].Id;
  const runtimeIdentity = dockerRuntimeIdentity({ toolOverrides: {
    node: hostToolIdentity(process.execPath, '/opt/node', ['--version']),
    php: immutableImagePhpIdentity(dolibarrImageId),
  } });
  invariant(runtimeIdentity.images.dolibarr.id === dolibarrImageId, 'Operator image changed during runtime identity collection.');
  const approval = {
    version: 3, unit: 'RST-005', mode: 'execute', target_profile: 'shared',
    operation_id: crypto.randomBytes(16).toString('hex'), recovery_policy: 'containment_only_phase1',
    approved_commit: repository.commit, complete_tree_sha256: tree.completeTreeSha256,
    complete_tree_manifest_sha256: tree.manifestSha256, backup_key_sha256: sha256(key),
    ...SHARED_PROFILE, backup_root: path.join(outputRoot, 'backups'), evidence_root: path.join(outputRoot, 'evidence'),
    compose_config_sha256: sha256(resolvedBytes), compose_environment_sha256: sha256(environmentBytes),
    compose_files: [{ path: composeFile, sha256: sha256(fs.readFileSync(composeFile)) }],
    docker_runtime: runtimeIdentity, database_runtime: databaseRuntime,
    issued_at: now.toISOString(), expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  approval.target_identity_sha256 = approvalTargetIdentitySha256(approval);
  approval.execution_identity_sha256 = approvalExecutionIdentitySha256(approval);
  Object.assign(approval, { target_lock_path: targetLockPaths(approval).target, mutation_lock_path: targetLockPaths(approval).mutation });
  validateApprovalRecord(approval, { expectedMode: 'execute', now });
  verifyRepositoryBinding(approval);
  verifyComposeTarget(approval, JSON.parse(resolvedBytes));

  protectedDirectory(outputRoot);
  for (const name of ['approval', 'key', 'traffic', 'environment', 'backups', 'evidence']) protectedDirectory(path.join(outputRoot, name));
  for (const lockPath of [approval.target_lock_path, approval.mutation_lock_path]) {
    const descriptor = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
    try {
      const stat = fs.fstatSync(descriptor);
      invariant(stat.isFile() && stat.uid === 0 && stat.nlink === 1, 'Stable target lock custody is invalid.');
      fs.fchmodSync(descriptor, 0o600);
      fs.fsyncSync(descriptor);
    } finally { fs.closeSync(descriptor); }
    fsyncDirectory(path.dirname(lockPath));
  }
  fsyncDirectory(outputRoot);
  protectedFile(path.join(outputRoot, 'approval/record'), Buffer.from(`${canonicalJson(approval)}\n`));
  protectedFile(path.join(outputRoot, 'key/bytes'), key);
  protectedFile(path.join(outputRoot, 'environment/record'), environmentBytes);
  protectedFile(path.join(outputRoot, 'protected-tree-manifest.json'), Buffer.from(`${canonicalJson(tree.manifest)}\n`));
  const trafficTemplate = {
    version: 3, unit: 'RST-005', operation_id: approval.operation_id,
    target_identity_sha256: approval.target_identity_sha256, execution_identity_sha256: approval.execution_identity_sha256,
    approval_sha256: approvalRecordSha256(approval), approval_nonce: approval.nonce,
    approved_commit: approval.approved_commit, compose_project_name: approval.compose_project_name, database_name: approval.database_name,
    exclusive_docker_administration: 'REPLACE_WITH_TRUE_AFTER_TRAFFIC_STOP', no_direct_host_writers: 'REPLACE_WITH_TRUE_AFTER_TRAFFIC_STOP', no_direct_database_writers: 'REPLACE_WITH_TRUE_AFTER_TRAFFIC_STOP',
    operator: 'REPLACE_AFTER_TRAFFIC_STOP', stopped_at: 'REPLACE_AFTER_TRAFFIC_STOP', expires_at: 'REPLACE_WITHIN_15_MINUTES', nonce: 'REPLACE_WITH_32_HEX',
  };
  protectedFile(path.join(outputRoot, 'traffic-template.json'), Buffer.from(`${canonicalJson(trafficTemplate)}\n`));
  const invocation = {
    version: 3, unit: 'RST-005', status: 'awaiting-traffic-stop-and-explicit-approval',
    target_identity_sha256: approval.target_identity_sha256, execution_identity_sha256: approval.execution_identity_sha256,
    approval_sha256: approvalRecordSha256(approval), protected_tree_manifest_sha256: tree.manifestSha256,
    argv: ['/usr/bin/flock', '--nonblock', '--no-fork', approval.target_lock_path, '/opt/node', 'custom/mjlfinancement/scripts/rst005_shared_launcher.js', '--mode=execute'],
    outer_argv: [
      '/usr/bin/docker', 'run', '--rm', '--pull=never', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
      '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,mode=1777', '--tmpfs', '/var/www/documents:rw,noexec,nosuid,nodev,mode=0700',
      '--tmpfs', '/var/www/html/custom:rw,noexec,nosuid,nodev,mode=0700', '--workdir', approval.repository_root,
      '--volume', `${approval.repository_root}:${approval.repository_root}:ro`,
      '--volume', `${path.join(outputRoot, 'approval')}:/run/mjl-rst005/approval:ro`, '--volume', `${path.join(outputRoot, 'key')}:/run/mjl-rst005/key:ro`,
      '--volume', `${path.join(outputRoot, 'traffic')}:/run/mjl-rst005/traffic:ro`, '--volume', `${path.join(outputRoot, 'environment')}:/run/mjl-rst005/environment:ro`,
      '--volume', `${approval.backup_root}:${approval.backup_root}`, '--volume', `${approval.evidence_root}:${approval.evidence_root}`,
      '--volume', `${approval.target_lock_path}:${approval.target_lock_path}`, '--volume', `${approval.mutation_lock_path}:${approval.mutation_lock_path}`,
      '--volume', '/var/run/docker.sock:/var/run/docker.sock', '--volume', `${process.execPath}:/opt/node:ro`,
      '--volume', '/usr/bin/git:/usr/bin/git:ro', '--volume', '/usr/bin/docker:/usr/bin/docker:ro', '--volume', '/usr/bin/flock:/usr/bin/flock:ro',
      '--volume', `${approval.docker_runtime.tools.compose_plugin.path}:${approval.docker_runtime.tools.compose_plugin.path}:ro`,
      '--entrypoint', '/usr/bin/flock', approval.docker_runtime.images.dolibarr.id,
      '--nonblock', '--no-fork', approval.target_lock_path, '/opt/node', 'custom/mjlfinancement/scripts/rst005_shared_launcher.js', '--mode=execute',
    ],
  };
  protectedFile(path.join(outputRoot, 'invocation.json'), Buffer.from(`${canonicalJson(invocation)}\n`));
  key.fill(0);
  process.stdout.write(`${JSON.stringify({ status: invocation.status, output_root: outputRoot, target_identity_sha256: approval.target_identity_sha256, execution_identity_sha256: approval.execution_identity_sha256 })}\n`);
}

try { main(); } catch (_) {
  process.stderr.write('RST-005 packet generation failed closed.\n');
  process.exitCode = 1;
}
