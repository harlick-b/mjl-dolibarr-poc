#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repository = path.resolve(__dirname, '../../..');
const composeFile = path.join(repository, 'docker-compose.yml');
const project = path.basename(repository).toLowerCase();
const confirmation = '--confirm=RST-006A-FAST';
const compose = ['compose', '--env-file', '/dev/null', '--project-directory', repository, '-f', composeFile, '-p', project];
const backupDirectory = path.join(repository, 'data', 'backups', 'rst006a');
const journalPath = path.join(backupDirectory, 'rst006a-active-journal.json');
const configPath = path.join(backupDirectory, '.rst006a-active-conf.php');
const lockPath = path.join(backupDirectory, '.rst006a-cutover.lock');

function fail(message, code = 1) { process.stderr.write(`RST-006A cutover stopped: ${message}\n`); process.exitCode = code; }
function invariant(condition, message) { if (!condition) throw new Error(message); }
function sha256Bytes(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function sha256File(file) { return sha256Bytes(fs.readFileSync(file)); }
function runExecutable(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: repository, encoding: options.encoding === false ? null : 'utf8', stdio: options.stdio || ['ignore', 'pipe', 'pipe'], env: options.env || process.env });
  const detail = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8').trim() : (result.stderr || result.stdout || '').trim();
  const acceptedStatuses = options.acceptedStatuses || [0];
  if (result.error || !acceptedStatuses.includes(result.status)) throw new Error(`${options.label || path.basename(executable)} failed.${detail ? ` ${detail}` : ''}`);
  return result.stdout || '';
}
function run(args, options) { return runExecutable('/usr/bin/docker', args, options); }
function dc(args, options) { return run([...compose, ...args], options); }
function git(args) { return String(runExecutable('/usr/bin/git', args, { label: 'Git source binding' })).trim(); }
function checkedFile(file, mode = 0o600) {
  const stat = fs.lstatSync(file);
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && (stat.mode & 0o777) === mode, `Private file custody is invalid: ${path.basename(file)}.`);
  return stat;
}
function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  invariant(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o700, 'Backup custody directory must be a private real directory.');
}
function verifyInheritedLock() {
  checkedFile(lockPath);
  const lock = fs.lstatSync(lockPath);
  const descriptor = fs.readdirSync('/proc/self/fd').filter((name) => /^\d+$/.test(name)).find((name) => {
    try { const stat = fs.fstatSync(Number(name)); return stat.dev === lock.dev && stat.ino === lock.ino; } catch (_) { return false; }
  });
  invariant(descriptor !== undefined, 'Cutover process did not inherit the flock descriptor.');
  const info = fs.readFileSync(`/proc/self/fdinfo/${descriptor}`, 'utf8');
  invariant(/^lock:\s+\d+: FLOCK\s+ADVISORY\s+WRITE\s+\d+\s+[0-9a-f]+:[0-9a-f]+:\d+\s+0\s+EOF$/im.test(info), 'Inherited cutover descriptor is not exclusively locked.');
  const contender = spawnSync('/usr/bin/flock', ['--nonblock', lockPath, '/usr/bin/true'], { stdio: 'ignore', env: process.env });
  invariant(contender.status === 1, 'Independent cutover lock contention proof failed.');
}
function atomicPrivateJson(file, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
    fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = undefined;
    fs.renameSync(temporary, file);
    const directory = fs.openSync(path.dirname(file), fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0));
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch (_) {}
    bytes.fill(0);
  }
}
function sourceBinding() {
  const commit = git(['rev-parse', 'HEAD']);
  invariant(/^[a-f0-9]{40}$/.test(commit), 'Reviewed source commit is invalid.');
  invariant(git(['status', '--porcelain', '--untracked-files=no']) === '', 'Cutover refuses tracked source changes; review and commit the source again.');
  return commit;
}
function rehearsalInterruption(point) {
  if (process.env.MJL_RST006A_REHEARSAL_INTERRUPT !== point) return false;
  const temporaryRoot = path.resolve(require('node:os').tmpdir());
  invariant(
    path.dirname(repository) === temporaryRoot && /^mjl-rst006a-wrapper-[A-Za-z0-9]+$/.test(path.basename(repository)),
    'Rehearsal interruption hooks are restricted to disposable wrapper tenants.'
  );
  return true;
}
function hardRehearsalInterruption(point) {
  if (rehearsalInterruption(point)) process.kill(process.pid, 'SIGKILL');
}
function migration(mode, failurePoint = '') {
  const readOnlyModes = ['detect','prefix','verify','verify-predecessor','evidence'];
  return String(dc(['run', '--rm', '--no-deps', '--volume', `${configPath}:/var/www/html/conf/conf.php:ro`, '-e', 'MJL_RST006A_TRAFFIC_STOPPED=1', '--entrypoint', '/usr/local/bin/php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php', `--mode=${mode}`, ...(failurePoint ? [`--failure-point=${failurePoint}`] : []), ...(readOnlyModes.includes(mode) ? [] : ['--confirm=RST-006A'])], { label: `RST-006A ${mode}`, acceptedStatuses: mode === 'detect' ? [0, 2] : [0] })).trim();
}
function emptyEvidenceDigest() { return sha256Bytes(Buffer.from(`${migration('evidence')}\n`)); }
function schemaDigest() {
  const schema = dc(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb-dump -uroot --no-data --routines --events --triggers --skip-comments "$MYSQL_DATABASE"'], { label: 'Schema digest' });
  return sha256Bytes(schema);
}
function services() { return dc(['ps', '--status', 'running', '--services']).trim().split('\n').filter(Boolean).sort(); }
function healthCheck() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { dc(['exec', '-T', 'dolibarr', '/usr/bin/curl', '--fail', '--silent', '--max-time', '3', '--output', '/dev/null', 'http://127.0.0.1/']); return; }
    catch (_) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); }
  }
  throw new Error('Dolibarr did not become healthy within 60 seconds.');
}
function readJournal(commit) {
  checkedFile(journalPath);
  let journal;
  try { journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')); } catch (_) { throw new Error('Active cutover journal is malformed.'); }
  const keys = ['version','unit','kind','source_commit','predecessor_schema_sha256','empty_evidence_sha256','backup_path','backup_sha256','config_sha256','detected_ddl_prefix','updated_at'];
  invariant(JSON.stringify(Object.keys(journal)) === JSON.stringify(keys), 'Active cutover journal has an invalid shape.');
  invariant(journal.version === 1 && journal.unit === 'RST-006A' && journal.kind === 'active' && journal.source_commit === commit, 'Active cutover journal is stale or belongs to another source commit.');
  invariant(path.dirname(journal.backup_path) === backupDirectory && /^rst006a-before-[0-9TZ-]+\.sql$/.test(path.basename(journal.backup_path)), 'Active cutover backup path is invalid.');
  checkedFile(journal.backup_path); checkedFile(configPath);
  invariant(sha256File(journal.backup_path) === journal.backup_sha256 && sha256File(configPath) === journal.config_sha256, 'Active cutover journal backup or configuration checksum is corrupt.');
  invariant(/^[a-f0-9]{64}$/.test(journal.empty_evidence_sha256) && emptyEvidenceDigest() === journal.empty_evidence_sha256, 'Active cutover empty-tenant evidence has drifted.');
  invariant(/^forward-(?:0(?:0[0-9]|[1-3][0-9])|04[0-3])$/.test(journal.detected_ddl_prefix), 'Active cutover journal records an unknown DDL prefix.');
  const actualPrefix = migration('prefix');
  if (actualPrefix === 'forward-000') invariant(schemaDigest() === journal.predecessor_schema_sha256, 'Active cutover predecessor schema digest has drifted.');
  return journal;
}
function updateJournal(journal, state) {
  const next = { ...journal, detected_ddl_prefix: state, updated_at: new Date().toISOString() };
  atomicPrivateJson(journalPath, next);
  return next;
}
function prepareAttempt(commit) {
  invariant(JSON.stringify(services()) === JSON.stringify(['dolibarr','mariadb']), 'A new cutover requires Dolibarr and MariaDB to be running.');
  ensurePrivateDirectory(backupDirectory);
  invariant(!fs.existsSync(journalPath) && !fs.existsSync(configPath), 'An active cutover journal or configuration already exists.');
  dc(['cp', 'dolibarr:/var/www/html/conf/conf.php', configPath], { label: 'Dolibarr config copy' });
  fs.chmodSync(configPath, 0o600); checkedFile(configPath);
  dc(['stop', 'dolibarr'], { label: 'Dolibarr stop' });
  invariant(JSON.stringify(services()) === JSON.stringify(['mariadb']), 'Traffic-stop verification failed.');
  const predecessor = migration('detect');
  invariant(predecessor === 'rst002b_target', `Exact empty predecessor required; detected ${predecessor || 'no state'}.`);
  migration('verify-predecessor');
  hardRehearsalInterruption('pre-apply');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(backupDirectory, `rst006a-before-${stamp}.sql`);
  const descriptor = fs.openSync(backup, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  try {
    dc(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb-dump -uroot --routines --events --triggers --single-transaction --skip-comments "$MYSQL_DATABASE"'], { label: 'Database backup', stdio: ['ignore', descriptor, 'inherit'] });
  } finally { fs.closeSync(descriptor); }
  checkedFile(backup); invariant(fs.statSync(backup).size > 0, 'Database backup is empty.');
  const journal = {
    version: 1, unit: 'RST-006A', kind: 'active', source_commit: commit,
    predecessor_schema_sha256: schemaDigest(), empty_evidence_sha256: emptyEvidenceDigest(), backup_path: backup, backup_sha256: sha256File(backup),
    config_sha256: sha256File(configPath), detected_ddl_prefix: migration('prefix'), updated_at: new Date().toISOString(),
  };
  atomicPrivateJson(journalPath, journal);
  return journal;
}
function sealCompletion(journal) {
  const record = {
    version: 1, unit: 'RST-006A', kind: 'completed', source_commit: journal.source_commit,
    predecessor_schema_sha256: journal.predecessor_schema_sha256, backup_path: journal.backup_path,
    backup_sha256: journal.backup_sha256, target_schema_sha256: schemaDigest(),
    target_state: 'rst006a_target', empty_evidence_sha256: emptyEvidenceDigest(), empty_tenant_verified: true, health_verified: true,
    completed_at: new Date().toISOString(),
  };
  const digest = sha256Bytes(Buffer.from(`${JSON.stringify(record)}\n`));
  const evidence = path.join(backupDirectory, `rst006a-cutover-${digest}.json`);
  atomicPrivateJson(evidence, record);
  fs.unlinkSync(journalPath); fs.unlinkSync(configPath);
  return evidence;
}

function main() {
  const commit = sourceBinding();
  let journal;
  let stopped = false;
  try {
    if (!fs.existsSync(journalPath) && fs.existsSync(configPath)) {
      checkedFile(configPath);
      const interruptedServices = services();
      invariant(
        JSON.stringify(interruptedServices) === JSON.stringify(['mariadb']) || JSON.stringify(interruptedServices) === JSON.stringify(['dolibarr','mariadb']),
        'Unjournaled pre-apply recovery found an unsafe service topology.'
      );
      const interruptedState = migration('detect');
      invariant(interruptedState === 'rst002b_target', 'An unjournaled non-predecessor schema cannot be resumed; Dolibarr remains stopped.');
      migration('verify-predecessor');
      if (!interruptedServices.includes('dolibarr')) {
        stopped = true;
        dc(['start', 'dolibarr'], { label: 'Dolibarr restart after pre-apply interruption' });
        healthCheck();
        stopped = false;
      }
      fs.unlinkSync(configPath);
    }
    journal = fs.existsSync(journalPath) ? readJournal(commit) : prepareAttempt(commit);
    const running = services();
    invariant(JSON.stringify(running) === JSON.stringify(['mariadb']) || JSON.stringify(running) === JSON.stringify(['dolibarr','mariadb']), 'Resume requires MariaDB and no unrelated service.');
    if (running.includes('dolibarr')) dc(['stop', 'dolibarr'], { label: 'Dolibarr stop for resume' });
    stopped = true;
    invariant(JSON.stringify(services()) === JSON.stringify(['mariadb']), 'Traffic-stop verification failed.');
    const detected = migration('detect');
    invariant(['rst002b_target','rst006a_partial','rst006a_target'].includes(detected), 'Unknown schema state; Dolibarr remains stopped. Follow the recorded-backup recovery instructions.');
    const exactPrefix = migration('prefix');
    invariant(Number(exactPrefix.slice(8)) >= Number(journal.detected_ddl_prefix.slice(8)), 'Detected DDL prefix contradicts the active journal.');
    journal = updateJournal(journal, exactPrefix);
    if (detected !== 'rst006a_target') {
      if (rehearsalInterruption('partial-ddl')) migration('apply', 'forward-020');
      else migration('apply');
      journal = updateJournal(journal, migration('prefix'));
    }
    invariant(journal.detected_ddl_prefix === 'forward-043', 'Unknown schema state; Dolibarr remains stopped. Follow the recorded-backup recovery instructions.');
    migration('verify');
    hardRehearsalInterruption('target-before-restart');
    dc(['start', 'dolibarr'], { label: 'Dolibarr restart' }); stopped = false;
    healthCheck();
    migration('verify');
    hardRehearsalInterruption('restart-before-evidence');
    const evidence = sealCompletion(journal);
    process.stdout.write(`RST-006A cutover complete. Backup: ${journal.backup_path}\nEvidence: ${evidence}\n`);
  } catch (error) {
    let recoveryError = null;
    try {
      if (fs.existsSync(configPath)) {
        if (services().includes('dolibarr')) dc(['stop', 'dolibarr'], { label: 'Dolibarr containment stop' });
        stopped = true;
        const state = migration('detect');
        if (state === 'rst002b_target') migration('verify-predecessor');
        else if (state === 'rst006a_target') migration('verify');
        else throw new Error('Schema is partial or unknown.');
        dc(['start', 'dolibarr'], { label: 'Dolibarr restart after verified safe-state failure' });
        healthCheck();
        stopped = false;
      }
    } catch (caught) { recoveryError = caught; }
    if (!journal && !stopped) { try { fs.unlinkSync(configPath); } catch (_) {} }
    if (recoveryError || stopped) fail(`${error.message} ${recoveryError ? recoveryError.message : ''} Dolibarr remains stopped. Recovery uses ${journal ? journal.backup_path : 'the separately recorded backup'}.`.replace(/\s+/g, ' ').trim());
    else fail(error.message);
  }
}

if (require.main === module) {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    process.stdout.write('RST-006A guarded resumable cutover for the empty local tenant. It binds a clean reviewed commit, predecessor digest, private backup checksum, and exact DDL prefix; unknown states remain stopped.\nRun: npm run cutover:rst006a-fast -- --confirm=RST-006A-FAST\n');
  } else if ((process.argv.length !== 3 && process.argv.length !== 4) || process.argv[2] !== confirmation || (process.argv.length === 4 && process.argv[3] !== '--locked-child')) {
    fail('Use --confirm=RST-006A-FAST or --help.', 2);
  } else if (process.argv[3] === '--locked-child') {
    try { verifyInheritedLock(); main(); } catch (error) { fail(error.message); }
  }
  else {
    ensurePrivateDirectory(backupDirectory);
    const descriptor = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
    fs.closeSync(descriptor); fs.chmodSync(lockPath, 0o600); checkedFile(lockPath);
    const result = spawnSync('/usr/bin/flock', ['--nonblock', '--conflict-exit-code', '75', lockPath, process.execPath, __filename, confirmation, '--locked-child'], {
      cwd: repository,
      env: process.env,
      stdio: 'inherit',
    });
    if (result.error) fail(`Cutover lock failed. ${result.error.message}`);
    else if (result.status === 75) fail('Another RST-006A cutover owns the process lock.', 75);
    else if (result.status !== 0) fail('The exclusively locked RST-006A cutover child failed.', result.status || 1);
  }
}

module.exports = { atomicPrivateJson, sourceBinding };
