#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repository = path.resolve(__dirname, '../../..');
const composeFile = path.join(repository, 'docker-compose.yml');
const project = path.basename(repository).toLowerCase();
const confirmation = '--confirm=RST-012-FAST';
const backupDirectory = path.join(repository, 'data', 'backups', 'rst012');
const configFile = path.join(backupDirectory, '.rst012-conf.php');
const capabilityFile = path.join(backupDirectory, '.rst012-cutover-capability');
const lockFile = path.join(backupDirectory, '.rst012-cutover.lock');
const compose = ['compose', '--env-file', '/dev/null', '--project-directory', repository, '-f', composeFile, '-p', project];
let capability = '';

function fail(message, code = 1) {
  process.stderr.write(`RST-012 cutover stopped: ${message}\n`);
  process.exitCode = code;
}

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repository,
    encoding: 'utf8',
    env: options.env || process.env,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });
  const detail = String(result.stderr || result.stdout || '').trim();
  if (result.error || result.status !== 0) throw new Error(`${options.label || path.basename(executable)} failed${detail ? `: ${detail}` : ''}.`);
  return result.stdout || '';
}

function dc(args, options = {}) {
  return run('/usr/bin/docker', [...compose, ...args], options);
}

function services() {
  return String(dc(['ps', '--status', 'running', '--services'])).trim().split('\n').filter(Boolean).sort();
}

function guardedScript(script, args, label) {
  const disposable = process.env.MJL_DISPOSABLE_TEST_TENANT === '1' ? [
    '--env', 'MJL_DISPOSABLE_TEST_TENANT=1',
    '--env', `MJL_DISPOSABLE_PROJECT_NAME=${process.env.MJL_DISPOSABLE_PROJECT_NAME || ''}`,
    '--env', `MJL_DISPOSABLE_RUN_SENTINEL=${process.env.MJL_DISPOSABLE_RUN_SENTINEL || ''}`,
  ] : [];
  return dc([
    'run', '--rm', '--no-deps',
    '--env', 'MJL_RST012_TRAFFIC_STOPPED=1',
    '--env', 'MJL_RST012_SHARED_CUTOVER=1',
    '--env', `MJL_RST012_CUTOVER_CAPABILITY=${capability}`,
    ...disposable,
    '--volume', `${configFile}:/var/www/html/conf/conf.php:ro`,
    '--volume', `${capabilityFile}:/run/mjl-rst012-cutover-capability:ro`,
    '--entrypoint', '/usr/local/bin/php',
    'dolibarr', script, ...args,
  ], { label });
}

function guardedPhp(mode) {
  const args = [`--mode=${mode}`];
  if (mode === 'apply') args.push('--confirm=RST-012');
  return guardedScript('/var/www/html/custom/mjlfinancement/scripts/rst012_export_schema.php', args, `RST-012 ${mode}`);
}

function documentEvidence(running = false) {
  const script = '/var/www/html/custom/mjlfinancement/scripts/rst006b_documents_evidence.php';
  const output = running
    ? dc(['exec', '-T', 'dolibarr', 'php', script], { label: 'Post-restart document evidence' })
    : guardedScript(script, [], 'Document evidence');
  const digest = String(output).trim();
  invariant(/^[a-f0-9]{64}$/.test(digest), 'Document evidence checksum is invalid.');
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

function ensureCustody() {
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  fs.chmodSync(backupDirectory, 0o700);
  const stat = fs.lstatSync(backupDirectory);
  invariant(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o700, 'Backup directory custody is invalid.');
}

function verifySource() {
  const commit = String(run('/usr/bin/git', ['rev-parse', 'HEAD'], { label: 'Git source binding' })).trim();
  invariant(/^[a-f0-9]{40}$/.test(commit), 'Reviewed source commit is invalid.');
  invariant(String(run('/usr/bin/git', ['status', '--porcelain'], { label: 'Git source binding' })).trim() === '', 'Cutover refuses uncommitted source changes.');
}

function verifyInheritedLock() {
  const lock = fs.lstatSync(lockFile);
  const inherited = fs.readdirSync('/proc/self/fd').some((name) => {
    try {
      const descriptor = Number(name);
      if (!Number.isInteger(descriptor)) return false;
      const stat = fs.fstatSync(descriptor);
      return stat.dev === lock.dev && stat.ino === lock.ino;
    } catch (_) {
      return false;
    }
  });
  invariant(inherited, 'Cutover process did not inherit the exclusive lock.');
  const contender = spawnSync('/usr/bin/flock', ['--nonblock', lockFile, '/usr/bin/true'], { stdio: 'ignore' });
  invariant(contender.status === 1, 'Cutover process did not inherit a held exclusive lock.');
}

function execute() {
  verifySource();
  let backup = '';
  let backupSha256 = '';
  let stopped = false;
  let targetStartAttempted = false;
  let documentsSha256 = '';
  try {
    invariant(JSON.stringify(services()) === JSON.stringify(['dolibarr', 'mariadb']), 'Dolibarr and MariaDB must both be running.');
    dc(['cp', 'dolibarr:/var/www/html/conf/conf.php', configFile], { label: 'Configuration copy' });
    fs.chmodSync(configFile, 0o600);
    capability = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(capabilityFile, capability, { mode: 0o400, flag: 'wx' });
    fs.chmodSync(capabilityFile, 0o400);

    dc(['stop', 'dolibarr'], { label: 'Dolibarr stop' });
    stopped = true;
    invariant(JSON.stringify(services()) === JSON.stringify(['mariadb']), 'Application traffic did not stop.');
    guardedPhp('verify-predecessor');
    guardedPhp('verify-empty');
    documentsSha256 = documentEvidence();

    backup = path.join(backupDirectory, `rst012-before-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
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

    guardedPhp('apply');
    guardedPhp('verify');
    guardedPhp('verify-empty');
    dc(['run', '--rm', '--no-deps', '--volume', `${configFile}:/var/www/html/conf/conf.php:ro`, '--entrypoint', '/usr/local/bin/php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { label: 'Forced module initialization' });
    guardedPhp('verify');
    guardedPhp('verify-empty');
    invariant(documentEvidence() === documentsSha256, 'Business documents changed during cutover.');

    targetStartAttempted = true;
    dc(['start', 'dolibarr'], { label: 'Dolibarr restart' });
    stopped = false;
    health();
    if (process.env.MJL_RST012_REHEARSAL_FAIL_POST_RESTART === '1') {
      invariant(path.dirname(repository) === path.resolve(os.tmpdir()) && /^mjl-rst012-wrapper-[A-Za-z0-9]+$/.test(path.basename(repository)), 'Post-restart failure injection is restricted to disposable wrapper tenants.');
      throw new Error('Injected RST-012 post-restart verification failure.');
    }
    dc(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst012_export_schema.php', '--mode=verify'], { label: 'Post-restart target verification' });
    dc(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst012_export_schema.php', '--mode=verify-empty'], { label: 'Post-restart empty-tenant verification' });
    invariant(documentEvidence(true) === documentsSha256, 'Business documents changed after restart.');
    process.stdout.write(`RST-012 cutover complete. Backup: ${backup} SHA-256: ${backupSha256} Documents SHA-256: ${documentsSha256}\n`);
  } catch (error) {
    let containmentFailed = false;
    if (targetStartAttempted) {
      try {
        dc(['stop', 'dolibarr'], { label: 'Failed target verification stop' });
        invariant(JSON.stringify(services()) === JSON.stringify(['mariadb']), 'Failed target verification traffic-stop check failed.');
        stopped = true;
      } catch (_) {
        stopped = false;
        containmentFailed = true;
      }
    }
    if (stopped) {
      try {
        guardedPhp('verify-predecessor');
        dc(['start', 'dolibarr'], { label: 'Verified-predecessor restart' });
        health();
        stopped = false;
      } catch (_) {}
    }
    throw new Error(`${error.message}${containmentFailed ? ' Traffic shutdown could not be confirmed; stop Dolibarr immediately.' : stopped ? ' Dolibarr remains stopped because the exact predecessor could not be verified; recover from the private backup if one was created.' : ''}`);
  } finally {
    if (backup !== '' && backupSha256 === '') try { fs.unlinkSync(backup); } catch (_) {}
    try { fs.unlinkSync(configFile); } catch (_) {}
    try { fs.chmodSync(capabilityFile, 0o600); fs.unlinkSync(capabilityFile); } catch (_) {}
  }
}

if (require.main === module) {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    process.stdout.write('Guarded additive RST-012 cutover: verify committed source and the empty predecessor, stop traffic, create a private backup, install and verify the target, restart, and health-check.\n');
  } else if (process.argv.length === 4 && process.argv[2] === confirmation && process.argv[3] === '--locked-child') {
    try { verifyInheritedLock(); execute(); } catch (error) { fail(error.message); }
  } else if (process.argv.length === 3 && process.argv[2] === confirmation) {
    ensureCustody();
    const descriptor = fs.openSync(lockFile, fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
    fs.closeSync(descriptor);
    fs.chmodSync(lockFile, 0o600);
    const result = spawnSync('/usr/bin/flock', ['--nonblock', '--conflict-exit-code', '75', lockFile, process.execPath, __filename, confirmation, '--locked-child'], { cwd: repository, env: process.env, stdio: 'inherit' });
    if (result.status === 75) fail('Another RST-012 cutover owns the lock.', 75);
    else if (result.status !== 0) fail('The locked RST-012 cutover failed.', result.status || 1);
  } else fail('Use --confirm=RST-012-FAST or --help.', 2);
}

module.exports = { execute };
