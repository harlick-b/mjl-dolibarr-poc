'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { runCommand, encryptCommandOutput, verifyEncryptedBackups } = require('./rst005_shared_operation.lib');

function invariant(value, message) { if (!value) throw new Error(message); }
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function composeBase(approval) {
  return ['compose', '--env-file', '/dev/null', '--project-directory', approval.repository_root,
    ...approval.compose_files.flatMap((entry) => ['-f', entry.path]), '-p', approval.compose_project_name];
}
function atomicRecord(directory, name, value) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, name); const temporary = `${target}.new`;
  invariant(!fs.existsSync(target) && !fs.existsSync(temporary), 'Durable RST-002B record already exists.');
  const bytes = Buffer.from(`${canonicalJson(value)}\n`);
  const descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.renameSync(temporary, target); fs.chmodSync(target, 0o600);
  const directoryDescriptor = fs.openSync(directory, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0));
  try { fs.fsyncSync(directoryDescriptor); } finally { fs.closeSync(directoryDescriptor); }
  return sha256(bytes);
}
async function compose(approval, tail, options = {}) {
  return runCommand('/usr/bin/docker', [...composeBase(approval), ...tail], {
    cwd: approval.repository_root, env: options.env || process.env, input: options.input,
    signal: options.signal, label: options.label || 'RST-002B Compose command',
  });
}
async function evidence(approval, options = {}) {
  const bytes = await compose(approval, ['run', '--rm', '--no-deps', '-T', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '-v', `${approval.repository_root}/tests:/opt/mjl-tests:ro`, '--entrypoint', '/usr/local/bin/php', 'dolibarr', '/opt/mjl-tests/fixtures/database-evidence.php'], options);
  const value = JSON.parse(bytes.toString('utf8'));
  invariant(value.admin_count === 1 && value.business_counts.activities === 0 && value.business_counts.activity_assignments === 0, 'RST-002B shared evidence is not empty.');
  return value;
}
function installAuthorization(approval, mode) {
  const record = {
    approved_commit: approval.approved_commit,
    complete_tree_sha256: approval.complete_tree_sha256,
    mode, unit: 'RST-002B', version: 1,
  };
  const target = path.join(approval.evidence_root, 'rst002b-authorization.json');
  invariant(!fs.existsSync(target), 'RST-002B authorization already exists.');
  const descriptor = fs.openSync(target, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o400);
  try { fs.writeFileSync(descriptor, `${canonicalJson(record)}\n`); fs.fsyncSync(descriptor); fs.fchownSync(descriptor, 0, 0); fs.fchmodSync(descriptor, 0o400); } finally { fs.closeSync(descriptor); }
  return target;
}
function clearAuthorization(target) {
  if (!target) return;
  const stat = fs.lstatSync(target);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && stat.nlink === 1, 'RST-002B authorization cleanup custody changed.');
  fs.unlinkSync(target);
}
async function migration(approval, mode, options = {}) {
  const authorization = installAuthorization(approval, mode);
  try {
    return await compose(approval, ['run', '--rm', '--no-deps', '-T', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
      '-e', 'MJL_RST002B_SHARED_LAUNCHER=1', '-v', `${authorization}:/run/mjl-rst002b/authorization.json:ro`,
      '--entrypoint', '/usr/local/bin/php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', `--mode=${mode}`, '--confirm=RST-002B'], options);
  } finally { clearAuthorization(authorization); }
}
function backupPaths(approval) {
  return { schema: path.join(approval.backup_root, 'rst002b-schema.secretstream'), full: path.join(approval.backup_root, 'rst002b-full.secretstream') };
}
async function createAndVerifyBackups(approval, key, sourceEvidence, options = {}) {
  fs.mkdirSync(approval.backup_root, { recursive: true, mode: 0o700 });
  const paths = backupPaths(approval);
  const dump = [...composeBase(approval), 'exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb-dump -uroot --routines --events --triggers --skip-comments "$@" "$MYSQL_DATABASE"', 'rst002b-dump'];
  const schema = await encryptCommandOutput('/usr/bin/docker', [...dump, '--no-data'], key, paths.schema, { cwd: approval.repository_root, env: options.env, signal: options.signal });
  const full = await encryptCommandOutput('/usr/bin/docker', [...dump, '--order-by-primary'], key, paths.full, { cwd: approval.repository_root, env: options.env, signal: options.signal });
  const restored = await verifyEncryptedBackups({ approval, key, schemaPath: paths.schema, fullPath: paths.full,
    schemaPlaintextSha256: schema.plaintextSha256, fullPlaintextSha256: full.plaintextSha256,
    sourceEvidence, runtimeEnvironment: options.env, signal: options.signal });
  return { paths, schema, full, restored };
}
async function run(approval, key, mode, options = {}) {
  invariant(Buffer.isBuffer(key) && key.length === 32, 'RST-002B backup key is invalid.');
  invariant(['execute', 'recover', 'rollback'].includes(mode), 'RST-002B operation mode is invalid.');
  if (options.assertLiveBinding) await options.assertLiveBinding();
  const running = (await compose(approval, ['ps', '--status', 'running', '--services'], options)).toString('utf8').trim().split('\n').filter(Boolean).sort();
  invariant(running.join(',') === 'mariadb', 'RST-002B requires Dolibarr stopped and MariaDB running.');
  const before = await evidence(approval, options);
  let backups = null;
  if (mode !== 'rollback') backups = await createAndVerifyBackups(approval, key, before, options);
  const beforeSha = atomicRecord(approval.evidence_root, 'rst002b-00-before.json', { version: 1, unit: 'RST-002B', mode, before, backups });
  await migration(approval, mode === 'rollback' ? 'rollback' : 'apply', options);
  const after = await evidence(approval, options);
  for (const field of ['admin_sha256','documents_sha256','ecm_sha256','module_metadata_sha256']) invariant(after[field] === before[field], `RST-002B changed protected ${field}.`);
  invariant(after.admin_count === before.admin_count && after.business_counts.users_non_admin === before.business_counts.users_non_admin
    && after.business_counts.partners === before.business_counts.partners && after.business_counts.projects === before.business_counts.projects
    && after.business_counts.audit_events === before.business_counts.audit_events, 'RST-002B changed protected shared row counts.');
  const afterSha = atomicRecord(approval.evidence_root, 'rst002b-01-after.json', { version: 1, unit: 'RST-002B', mode, previous_sha256: beforeSha, after });
  if (options.assertLiveBinding) await options.assertLiveBinding();
  atomicRecord(approval.evidence_root, 'rst002b-launcher-report.json', { version: 1, unit: 'RST-002B', mode, status: 'complete', previous_sha256: afterSha, approved_commit: approval.approved_commit, complete_tree_sha256: approval.complete_tree_sha256 });
  return Object.freeze({ status: 'complete' });
}
const runRst002bOperation = (options) => run(options.approval, options.key, 'execute', options);
const runRst002bRecover = (options) => run(options.approval, options.key, 'recover', options);
const runRst002bRollback = (options) => run(options.approval, options.key, 'rollback', options);

module.exports = { atomicRecord, canonicalJson, runRst002bOperation, runRst002bRecover, runRst002bRollback };
