#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repository = path.resolve(__dirname, '../../..');
const composeFile = path.join(repository, 'docker-compose.yml');
const project = path.basename(repository).toLowerCase();
const confirmation = '--confirm=RST-006B-FAST';
const backupDirectory = path.join(repository, 'data', 'backups', 'rst006b');
const configFile = path.join(backupDirectory, '.rst006b-conf.php');
const capabilityFile = path.join(backupDirectory, '.rst006b-cutover-capability');
const lockFile = path.join(backupDirectory, '.rst006b-cutover.lock');
const compose = ['compose', '--env-file', '/dev/null', '--project-directory', repository, '-f', composeFile, '-p', project];
let capability = '';

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exitCode = code;
}

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repository,
    encoding: options.binary ? null : 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  const detail = Buffer.isBuffer(result.stderr)
    ? result.stderr.toString('utf8').trim()
    : (result.stderr || result.stdout || '').trim();
  if (result.error || result.status !== 0) {
    throw new Error(`${options.label || path.basename(executable)} failed${detail ? `: ${detail}` : ''}.`);
  }
  return result.stdout || '';
}

function dc(args, options = {}) {
  return run('/usr/bin/docker', [...compose, ...args], options);
}

function git(args) {
  return String(run('/usr/bin/git', args, { label: 'Git source binding' })).trim();
}

function services() {
  return String(dc(['ps', '--status', 'running', '--services'])).trim().split('\n').filter(Boolean).sort();
}

function guardedPhp(script, args = [], label = 'Guarded PHP') {
  return dc([
    'run', '--rm', '--no-deps',
    '--env', 'MJL_RST006A_TRAFFIC_STOPPED=1',
    '--env', 'MJL_RST006B_SHARED_CUTOVER=1',
    '--env', `MJL_RST006B_CUTOVER_CAPABILITY=${capability}`,
    '--volume', `${configFile}:/var/www/html/conf/conf.php:ro`,
    '--volume', `${capabilityFile}:/run/mjl-rst006b-cutover-capability:ro`,
    '--entrypoint', '/usr/local/bin/php',
    'dolibarr', script, ...args,
  ], { label });
}

function migration(mode) {
  const args = [`--mode=${mode}`];
  if (mode === 'apply') args.push('--confirm=RST-006B');
  return guardedPhp('/var/www/html/custom/mjlfinancement/scripts/rst006b_execution.php', args, `RST-006B ${mode}`);
}

function validateEmptyEvidence(evidence) {
  const expectedZero = { non_admin_users: 0, partners: 0, projects: 0, mjl_business_rows: 0, ecm_files: 0 };
  invariant(
    evidence && evidence.admin && evidence.admin.rowid === 1 && evidence.admin.entity === 0
      && evidence.admin.login === 'admin' && evidence.admin.active === true
      && JSON.stringify(evidence.zero_row_invariants) === JSON.stringify(expectedZero),
    'Preserved Admin evidence is invalid.',
  );
  const zeros = evidence.zero_row_invariants;
  invariant(zeros && Object.keys(zeros).sort().join(',') === ['ecm_files', 'mjl_business_rows', 'non_admin_users', 'partners', 'projects'].sort().join(',')
    && Object.values(zeros).every((value) => value === 0), 'Empty-tenant evidence is invalid.');
  return evidence;
}

function emptyEvidence() {
  const output = guardedPhp('/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php', ['--mode=evidence'], 'Empty-tenant evidence');
  return validateEmptyEvidence(JSON.parse(String(output)));
}

function documentsEvidence() {
  const digest = String(guardedPhp('/var/www/html/custom/mjlfinancement/scripts/rst006b_documents_evidence.php', [], 'Business-document evidence')).trim();
  invariant(/^[a-f0-9]{64}$/.test(digest), 'Business-document checksum is invalid.');
  return digest;
}

function health() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      dc(['exec', '-T', 'dolibarr', 'curl', '--fail', '--silent', '--max-time', '3', '--output', '/dev/null', 'http://127.0.0.1/']);
      return;
    } catch (_) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
  throw new Error('Dolibarr did not become healthy within 60 seconds.');
}

function sqlScalar(statement) {
  return String(dc([
    'exec', '-T', 'mariadb', 'sh', '-ceu',
    `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -uroot -N -B "$MYSQL_DATABASE" -e ${JSON.stringify(statement)}`,
  ], { label: 'Shared invariant query' })).trim();
}

function ensureCustody() {
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  fs.chmodSync(backupDirectory, 0o700);
  const stat = fs.lstatSync(backupDirectory);
  invariant(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o700, 'Backup directory custody is invalid.');
}

function verifySource() {
  invariant(/^[a-f0-9]{40}$/.test(git(['rev-parse', 'HEAD'])), 'Reviewed source commit is invalid.');
  invariant(git(['status', '--porcelain']) === '', 'Cutover refuses uncommitted or untracked source changes.');
}

function execute() {
  verifySource();
  let stopped = false;
  let backup = '';
  let backupSha256 = '';
  let documentsSha256 = '';
  let published = false;
  let targetStartAttempted = false;
  try {
    capability = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(capabilityFile, capability, { mode: 0o400, flag: 'wx' });
    fs.chmodSync(capabilityFile, 0o400);
    invariant(JSON.stringify(services()) === JSON.stringify(['dolibarr', 'mariadb']), 'Dolibarr and MariaDB must both be running.');
    dc(['cp', 'dolibarr:/var/www/html/conf/conf.php', configFile], { label: 'Configuration copy' });
    fs.chmodSync(configFile, 0o600);
    dc(['stop', 'dolibarr'], { label: 'Dolibarr stop' });
    stopped = true;
    invariant(JSON.stringify(services()) === JSON.stringify(['mariadb']), 'Application traffic did not stop.');
    migration('verify-predecessor');
    emptyEvidence();
    documentsSha256 = documentsEvidence();

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backup = path.join(backupDirectory, `rst006b-before-${stamp}.sql`);
    const descriptor = fs.openSync(backup, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
    try {
      dc(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb-dump -uroot --routines --events --triggers --single-transaction --skip-comments "$MYSQL_DATABASE"'], {
        label: 'Private database backup',
        stdio: ['ignore', descriptor, 'inherit'],
      });
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    const backupStat = fs.lstatSync(backup);
    invariant(backupStat.isFile() && !backupStat.isSymbolicLink() && (backupStat.mode & 0o777) === 0o600 && backupStat.size > 0, 'Database backup verification failed.');
    backupSha256 = String(run('/usr/bin/sha256sum', [backup], { label: 'Database backup checksum' })).split(/\s+/)[0];
    invariant(/^[a-f0-9]{64}$/.test(backupSha256), 'Database backup checksum is invalid.');

    migration('apply');
    migration('verify');
    guardedPhp('/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php', [], 'Forced module initialization');
    guardedPhp('/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_execution_schema.php', [], 'Phase 3A schema verification');
    invariant(sqlScalar("SELECT COUNT(*) FROM llx_cronjob WHERE objectname='MjlExecutionReconciler' AND methodename='run' AND frequency=1 AND unitfrequency=3600 AND status=1") === '1', 'Exact enabled hourly reconciler job is missing.');
    emptyEvidence();
    invariant(documentsEvidence() === documentsSha256, 'Business documents changed during cutover.');

    targetStartAttempted = true;
    dc(['start', 'dolibarr'], { label: 'Dolibarr restart' });
    stopped = false;
    health();
    published = true;
    process.stdout.write(`RST-006B cutover complete. Backup: ${backup} SHA-256: ${backupSha256} Documents SHA-256: ${documentsSha256}\n`);
  } catch (error) {
    if (!published) {
      if (targetStartAttempted) try {
        dc(['stop', 'dolibarr'], { label: 'Failed-cutover traffic stop' });
        stopped = true;
      } catch (_) {}
      if (stopped) {
        try {
          migration('verify-predecessor');
          dc(['start', 'dolibarr'], { label: 'Verified-predecessor restart' });
          health();
          stopped = false;
        } catch (_) {}
      }
    }
    throw new Error(`${error.message}${stopped ? ' Dolibarr remains stopped because the complete target acceptance did not pass and the exact predecessor is no longer present; recover from the private backup.' : ''}`);
  } finally {
    if (backup !== '' && backupSha256 === '') try {
      const stat = fs.lstatSync(backup);
      if (stat.isFile() && !stat.isSymbolicLink()) fs.unlinkSync(backup);
    } catch (_) {}
    try { fs.unlinkSync(configFile); } catch (_) {}
    try { fs.chmodSync(capabilityFile, 0o600); fs.unlinkSync(capabilityFile); } catch (_) {}
  }
}

if (require.main === module) {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    process.stdout.write('Stop the local app, verify the empty tenant, create a private backup, migrate, initialize and verify schema/cron while stopped, restart, and health-check.\n');
  } else if (process.argv.length === 4 && process.argv[2] === confirmation && process.argv[3] === '--locked-child') {
    try { execute(); } catch (error) { fail(`RST-006B cutover stopped: ${error.message}`); }
  } else if (process.argv.length === 3 && process.argv[2] === confirmation) {
    ensureCustody();
    const descriptor = fs.openSync(lockFile, fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
    fs.closeSync(descriptor);
    fs.chmodSync(lockFile, 0o600);
    const result = spawnSync('/usr/bin/flock', ['--nonblock', '--conflict-exit-code', '75', lockFile, process.execPath, __filename, confirmation, '--locked-child'], {
      cwd: repository,
      env: process.env,
      stdio: 'inherit',
    });
    if (result.status === 75) fail('Another RST-006B cutover owns the lock.', 75);
    else if (result.status !== 0) fail('The locked RST-006B cutover failed.', result.status || 1);
  } else {
    fail('Use --confirm=RST-006B-FAST or --help.', 2);
  }
}

module.exports = { validateEmptyEvidence };
