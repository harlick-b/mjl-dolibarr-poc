#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repository = path.resolve(__dirname, '../../..');
const composeFile = path.join(repository, 'docker-compose.yml');
const project = 'mjl-dolibarr-poc';
const confirmation = '--confirm=RST-002B-FAST';
const compose = ['compose', '--env-file', '/dev/null', '--project-directory', repository, '-f', composeFile, '-p', project];

function fail(message, code = 1) { process.stderr.write(`${message}\n`); process.exitCode = code; }
function run(args, options = {}) {
  const result = spawnSync('/usr/bin/docker', args, { cwd: repository, encoding: 'utf8', stdio: options.stdio || ['ignore', 'pipe', 'pipe'] });
  const detail = (result.stderr || result.stdout || '').trim();
  if (result.error || result.status !== 0) throw new Error(`${options.label || 'Docker command'} failed.${detail ? ` ${detail}` : ''}`);
  return result.stdout || '';
}
function dc(args, options) { return run([...compose, ...args], options); }
function migration(mode, configFile) {
  dc(['run', '--rm', '--no-deps', '--volume', `${configFile}:/var/www/html/conf/conf.php:ro`, '-e', 'MJL_RST002B_SIMPLE_CUTOVER=1', '-e', `MJL_RST002B_SIMPLE_PROJECT=${project}`, '--entrypoint', '/usr/local/bin/php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', `--mode=${mode}`, '--confirm=RST-002B'], { label: `RST-002B ${mode}` });
}
function healthCheck() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { dc(['exec', '-T', 'dolibarr', '/usr/bin/curl', '--fail', '--silent', '--max-time', '3', '--output', '/dev/null', 'http://127.0.0.1/']); return; }
    catch (_) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); }
  }
  throw new Error('Dolibarr did not become healthy within 60 seconds.');
}

if (process.argv.length === 3 && process.argv[2] === '--help') {
  process.stdout.write('RST-002B fast cutover for the empty local POC: stop Dolibarr, create one local SQL backup, apply, verify, and restart.\nRun: npm run cutover:rst002b-fast -- --confirm=RST-002B-FAST\n');
} else if (process.argv.length !== 3 || process.argv[2] !== confirmation) {
  fail('Use --confirm=RST-002B-FAST or --help.', 2);
} else {
  const backupDirectory = path.join(repository, 'data', 'backups');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(backupDirectory, `rst002b-before-${stamp}.sql`);
  const configDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-rst002b-config-'));
  const configFile = path.join(configDirectory, 'conf.php');
  let stopped = false;
  let backupComplete = false;
  try {
    const running = dc(['ps', '--status', 'running', '--services']).trim().split('\n').filter(Boolean).sort();
    if (JSON.stringify(running) !== JSON.stringify(['dolibarr', 'mariadb'])) throw new Error('Expected the local Dolibarr and MariaDB services to be running.');
    dc(['cp', 'dolibarr:/var/www/html/conf/conf.php', configFile], { label: 'Dolibarr config copy' });
    fs.chmodSync(configFile, 0o600);
    const configStat = fs.lstatSync(configFile);
    if (!configStat.isFile() || configStat.isSymbolicLink() || configStat.size === 0) throw new Error('Dolibarr config copy is invalid.');
    dc(['stop', 'dolibarr'], { label: 'Dolibarr stop' }); stopped = true;
    fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
    const descriptor = fs.openSync(backup, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    try {
      dc(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb-dump -uroot --routines --events --triggers --single-transaction --skip-comments "$MYSQL_DATABASE"'], { label: 'Database backup', stdio: ['ignore', descriptor, 'inherit'] });
    } finally { fs.closeSync(descriptor); }
    if (fs.statSync(backup).size === 0) throw new Error('Database backup is empty.');
    backupComplete = true;
    migration('apply', configFile);
    migration('verify', configFile);
    dc(['start', 'dolibarr'], { label: 'Dolibarr restart' }); stopped = false;
    healthCheck();
    process.stdout.write(`RST-002B fast cutover complete. Backup: ${backup}\n`);
  } catch (error) {
    if (!backupComplete) { try { fs.unlinkSync(backup); } catch (_) {} }
    if (stopped) { try { dc(['start', 'dolibarr'], { label: 'Dolibarr restart after failure' }); } catch (_) {} }
    fail(`RST-002B fast cutover stopped: ${error.message}`);
  } finally {
    try { fs.unlinkSync(configFile); } catch (_) {}
    try { fs.rmdirSync(configDirectory); } catch (_) {}
  }
}
