#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repository = path.resolve(__dirname, '../../..');
const composeFile = path.join(repository, 'docker-compose.yml');
const project = 'mjl-dolibarr-poc';
const compose = ['compose', '--env-file', '/dev/null', '--project-directory', repository, '-f', composeFile, '-p', project];

function fail(message, code = 1) { process.stderr.write(`${message}\n`); process.exitCode = code; }
function run(args, options = {}) {
  const result = spawnSync('/usr/bin/docker', args, { cwd: repository, encoding: options.encoding === false ? null : 'utf8', stdio: options.stdio || ['ignore', 'pipe', 'pipe'] });
  const detail = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8').trim() : (result.stderr || result.stdout || '').trim();
  const acceptedStatuses = options.acceptedStatuses || [0];
  if (result.error || !acceptedStatuses.includes(result.status)) throw new Error(`${options.label || 'Docker command'} failed.${detail ? ` ${detail}` : ''}`);
  return result.stdout || '';
}
function dc(args, options) { return run([...compose, ...args], options); }
function migration(mode, configFile) {
  return dc(['run', '--rm', '--no-deps', '--volume', `${configFile}:/var/www/html/conf/conf.php:ro`, '--entrypoint', '/usr/local/bin/php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php', `--mode=${mode}`, ...(mode === 'detect' ? [] : ['--confirm=RST-006A'])], { label: `RST-006A ${mode}`, acceptedStatuses: mode === 'detect' ? [0, 2] : [0] });
}
function schemaDigest() {
  const schema = dc(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb-dump -uroot --no-data --routines --events --triggers --skip-comments "$MYSQL_DATABASE"'], { label: 'Schema digest' });
  return crypto.createHash('sha256').update(schema).digest('hex');
}
function healthCheck() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { dc(['exec', '-T', 'dolibarr', '/usr/bin/curl', '--fail', '--silent', '--max-time', '3', '--output', '/dev/null', 'http://127.0.0.1/']); return; }
    catch (_) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); }
  }
  throw new Error('Dolibarr did not become healthy within 60 seconds.');
}

if (process.argv.length === 3 && process.argv[2] === '--help') {
  process.stdout.write('RST-006A cutover for the empty local tenant: stop Dolibarr, record the predecessor digest, create a private SQL backup, apply, verify, record the target digest, and restart.\nRun: npm run cutover:rst006a-fast -- --confirm=RST-006A-FAST\n');
} else if (process.argv.length !== 3 || process.argv[2] !== '--confirm=RST-006A-FAST') {
  fail('Use --confirm=RST-006A-FAST or --help.', 2);
} else {
  const backupDirectory = path.join(repository, 'data', 'backups');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(backupDirectory, `rst006a-before-${stamp}.sql`);
  const evidence = path.join(backupDirectory, `rst006a-cutover-${stamp}.json`);
  const configDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-rst006a-config-'));
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
    if (dc(['ps', '--status', 'running', '--services']).trim() !== 'mariadb') throw new Error('Traffic-stop verification failed.');
    const beforeState = migration('detect', configFile).trim();
    if (beforeState !== 'rst002b_target') throw new Error(`Exact empty predecessor required; detected ${beforeState || 'no state'}.`);
    const beforeDigest = schemaDigest();
    fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
    const descriptor = fs.openSync(backup, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    try {
      dc(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb-dump -uroot --routines --events --triggers --single-transaction --skip-comments "$MYSQL_DATABASE"'], { label: 'Database backup', stdio: ['ignore', descriptor, 'inherit'] });
    } finally { fs.closeSync(descriptor); }
    if (fs.statSync(backup).size === 0) throw new Error('Database backup is empty.');
    backupComplete = true;
    migration('apply', configFile);
    const afterState = migration('detect', configFile).trim();
    if (afterState !== 'rst006a_target') throw new Error(`Target verification failed: ${afterState || 'no state'}.`);
    const record = { unit: 'RST-006A', status: 'cutover-complete', traffic_stopped: true, before_state: beforeState, before_schema_sha256: beforeDigest, backup_path: backup, backup_sha256: crypto.createHash('sha256').update(fs.readFileSync(backup)).digest('hex'), after_state: afterState, after_schema_sha256: schemaDigest(), completed_at: new Date().toISOString() };
    fs.writeFileSync(evidence, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    dc(['start', 'dolibarr'], { label: 'Dolibarr restart' }); stopped = false;
    healthCheck();
    process.stdout.write(`RST-006A cutover complete. Backup: ${backup}\nEvidence: ${evidence}\n`);
  } catch (error) {
    if (!backupComplete) { try { fs.unlinkSync(backup); } catch (_) {} }
    if (stopped) { try { dc(['start', 'dolibarr'], { label: 'Dolibarr restart after failure' }); } catch (_) {} }
    fail(`RST-006A cutover stopped: ${error.message}`);
  } finally {
    try { fs.unlinkSync(configFile); } catch (_) {}
    try { fs.rmdirSync(configDirectory); } catch (_) {}
  }
}
