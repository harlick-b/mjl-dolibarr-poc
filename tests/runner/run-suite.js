#!/usr/bin/env node

const fs = require('node:fs');
const crypto = require('node:crypto');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const { assertCleanupComplete, assertDisposableConfig } = require('./disposable-policy');
const { createRunPlan, getSuitePlan, sanitizeOutput } = require('./disposable-run');
const { scanArtifacts, streamTreeDigest } = require('./disposable-evidence');
const { registerSecretAt } = require('../helpers/mjl-test-runtime');

const repositoryRoot = path.resolve(__dirname, '../..');
const mode = require.main === module ? (process.argv[2] || 'all') : 'unit';
const layers = getSuitePlan(mode);
const needsTenant = layers.some((layer) => layer !== 'unit');
const retainedSecrets = [
  process.env.MJL_POC_DEFAULT_PASSWORD || 'MjlPoc2026!!',
  process.env.DOLI_ADMIN_PASSWORD || 'Admin1234',
  process.env.MYSQL_ROOT_PASSWORD || 'poc_root_pwd',
  process.env.MYSQL_PASSWORD || 'poc_pwd',
].filter(Boolean);
const dynamicSecrets = new Map();
let activeSecretRegistryPort = '';

function registerRunnerSecret(category, value) {
  if (typeof value === 'string' && value !== '') dynamicSecrets.set(value, category);
}

function allSecretValues() {
  return [...retainedSecrets, ...dynamicSecrets.keys()];
}

function secretEntries() {
  return [
    ...retainedSecrets.map((value) => ({ category: 'configured credential', value })),
    ...[...dynamicSecrets].map(([value, category]) => ({ category, value })),
  ];
}

async function startSecretRegistry(plan, enroll = registerRunnerSecret) {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setTimeout(2000, () => socket.destroy());
    socket.once('close', () => sockets.delete(socket));
    let input = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      input += chunk;
      if (Buffer.byteLength(input, 'utf8') > 4096) socket.destroy();
    });
    socket.on('end', () => {
      try {
        const request = JSON.parse(input.trim());
        if (Object.keys(request).join(',') !== 'capability,category,value'
          || !crypto.timingSafeEqual(Buffer.from(request.capability || ''), Buffer.from(plan.secretRegistryCapability))
          || typeof request.category !== 'string' || !/^[a-z][a-z ]{1,39}$/.test(request.category)
          || typeof request.value !== 'string' || request.value.length < 8 || request.value.length > 512) throw new Error('invalid');
        enroll(request.category, request.value);
        socket.end('OK\n');
      } catch (_) {
        socket.end('ERROR\n');
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, resolve);
  });
  const address = server.address();
  activeSecretRegistryPort = String(address.port);
  return {
    port: address.port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      let timer;
      try {
        await Promise.race([
          new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Secret registry shutdown timed out.')), 2000); }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      activeSecretRegistryPort = '';
    },
  };
}

async function runWithDeadline(operation, milliseconds, label) {
  const controller = new AbortController();
  let timer;
  const task = Promise.resolve().then(() => operation(controller.signal));
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`${label} timed out.`));
        }, milliseconds);
      }),
    ]);
  } catch (error) {
    controller.abort();
    await task.catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function hardenArtifactPermissions(root) {
  if (!fs.existsSync(root)) return;
  fs.chmodSync(root, 0o700);
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Artifact trees must not contain symbolic links.');
      if (entry.isDirectory()) {
        fs.chmodSync(absolute, 0o700);
        visit(absolute);
      } else if (entry.isFile()) fs.chmodSync(absolute, 0o600);
      else throw new Error('Artifact trees contain an unsupported file type.');
    }
  };
  visit(root);
}

function verifyArtifacts(root, secrets) {
  try {
    hardenArtifactPermissions(root);
    const hits = scanArtifacts(root, secrets);
    if (hits.length) throw new Error(`Contaminated artifacts were removed: ${hits.map((hit) => `${hit.path} (${hit.category})`).join(', ')}`);
  } catch (error) {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
    throw error;
  }
}

function protectedSourceDigest(root, protectedPaths) {
  const sourceHash = crypto.createHash('sha256');
  for (const relative of protectedPaths) {
    const absolute = path.join(root, relative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Protected source root must not be a symbolic link: ${relative}`);
    const type = stat.isDirectory() ? 'directory' : (stat.isFile() ? 'file' : 'unsupported');
    if (type === 'unsupported') throw new Error(`Protected source root has an unsupported type: ${relative}`);
    sourceHash.update(`${relative}\0${type}\0${stat.mode & 0o7777}\0`);
    if (type === 'directory') sourceHash.update(streamTreeDigest(absolute));
    else sourceHash.update(fs.readFileSync(absolute));
  }
  return sourceHash.digest('hex');
}

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repositoryRoot,
      env: options.env || process.env,
      detached: process.platform !== 'win32',
      stdio: options.input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks = [];
    const stderrChunks = [];

    if (child.stdout) child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    if (child.stderr) child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)));
    if (child.stdin) child.stdin.end(options.input);

    let terminationTimer;
    let timedOut = false;
    const terminate = () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
      } catch (_) {}
      terminationTimer = setTimeout(() => {
        try {
          if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch (_) {}
      }, 2000);
      terminationTimer.unref();
    };
    const abort = () => terminate();
    if (options.signal) {
      if (options.signal.aborted) abort();
      else options.signal.addEventListener('abort', abort, { once: true });
    }

    child.once('error', reject);
    let deadlineTimer;
    if (options.timeoutMs) {
      deadlineTimer = setTimeout(() => { timedOut = true; terminate(); }, options.timeoutMs);
      deadlineTimer.unref();
    }
    child.once('close', (code, signal) => {
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      const output = options.binary ? stdout : stdout.toString('utf8');
      if (options.signal) options.signal.removeEventListener('abort', abort);
      clearTimeout(deadlineTimer);
      clearTimeout(terminationTimer);
      if (!options.quiet) {
        if (stdout.length) process.stdout.write(sanitizeOutput(stdout.toString('utf8'), allSecretValues()));
        if (stderr.length) process.stderr.write(sanitizeOutput(stderr.toString('utf8'), allSecretValues()));
      }
      if (code === 0 && !(options.rejectStderr && stderr.length)) {
        resolve(output);
        return;
      }
	  const error = new Error(timedOut ? `${command} timed out.` : (code === 0 ? `${command} wrote unexpected stderr.` : `${command} failed with ${signal || `exit ${code}`}.`));
      error.exitCode = code;
      error.output = Buffer.concat([stdout, stderr]).toString('utf8');
      error.stderr = stderr.toString('utf8');
      reject(error);
    });
  });
}

function composeEnvironment(plan, sourceRoot = repositoryRoot) {
  return {
    ...process.env,
    COMPOSE_PROJECT_NAME: plan.projectName,
    COMPOSE_FILE: `${path.join(repositoryRoot, 'docker-compose.yml')}:${plan.composeFile}`,
    MJL_BASE_URL: plan.baseUrl,
    MJL_TEST_PORT: String(plan.port),
    MJL_REPOSITORY_ROOT: sourceRoot,
    MJL_EVIDENCE_ROOT: plan.evidenceRoot,
    MJL_PLAYWRIGHT_OUTPUT_DIR: path.join(plan.artifactRoot, 'playwright'),
    MJL_TEST_MODE: mode,
    MJL_DISPOSABLE_RUN_SENTINEL: plan.sentinel,
    MJL_TEST_USER_PASSWORD: plan.testUserPassword,
    MJL_AUTH_PASSWORD_1: plan.lifecyclePasswords[0],
    MJL_AUTH_PASSWORD_2: plan.lifecyclePasswords[1],
    MJL_AUTH_STALE_PASSWORD: plan.lifecyclePasswords[2],
    MJL_SECRET_REGISTRY_PORT: activeSecretRegistryPort,
    MJL_SECRET_REGISTRY_CAPABILITY: plan.secretRegistryCapability,
  };
}

async function compose(plan, args, options = {}) {
  return runCommand('docker', ['compose', ...args], {
    ...options,
    env: composeEnvironment(plan, options.sourceRoot),
  });
}

async function expectComposeFailure(plan, args, label, options = {}) {
  try {
    await compose(plan, args, { ...options, quiet: true });
  } catch (error) {
    return error.output || error.message;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
}

async function waitUntilReady(plan, signal) {
  const deadline = Date.now() + 6 * 60 * 1000;
  let lastFailure = 'no response';
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error('Disposable readiness interrupted.');
    try {
      const response = await fetch(`${plan.baseUrl}/`, { signal: AbortSignal.timeout(3000) });
      if (response.status >= 200 && response.status < 500) return;
      lastFailure = `HTTP ${response.status}`;
    } catch (error) {
      lastFailure = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Disposable Dolibarr did not become ready within 6 minutes: ${lastFailure}`);
}

async function provisionDisposableFixtureControls(plan, signal) {
  await compose(plan, ['exec', '-T', 'dolibarr', 'chown', '-R', 'www-data:www-data', '/var/www/documents'], { quiet: true, signal });
	await provisionDisposableDatabaseClient(plan, signal);
	await compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', 'dolidb'], { quiet: true, signal, input: "INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_DISPOSABLE_FIXTURE_SENTINEL',UUID(),'chaine',0,'disposable fixture attestation',0); UPDATE llx_const SET value='" + plan.sentinel + "' WHERE name='MJL_DISPOSABLE_FIXTURE_SENTINEL' AND entity=0; INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MAIN_LANG_DEFAULT','fr_FR','chaine',0,'disposable canonical language',1),('MAIN_MONNAIE','XOF','chaine',0,'disposable canonical currency',1) ON DUPLICATE KEY UPDATE value=VALUES(value),type=VALUES(type),note=VALUES(note);\n" });
	await compose(plan, ['exec', '-T', 'dolibarr', 'sh', '-ceu', 'sentinel=/var/www/documents/.mjl-disposable-fixture-sentinel; umask 0222; printf %s "$MJL_DISPOSABLE_RUN_SENTINEL" > "$sentinel"; chown root:root "$sentinel"; chmod 0444 "$sentinel"; test "$(stat -c %u:%a "$sentinel")" = 0:444'], { quiet: true, signal });
}

async function provisionDisposableDatabaseClient(plan, signal) {
  await compose(plan, ['exec', '-T', 'mariadb', 'sh', '-ceu', 'umask 077; mkdir -p /run/mjl-test; target=/run/mjl-test/client.cnf; temporary=/run/mjl-test/client.cnf.new; printf "[client]\\nuser=%s\\npassword=%s\\n[client_root]\\nuser=root\\npassword=%s\\n" "$MYSQL_USER" "$MYSQL_PASSWORD" "$MYSQL_ROOT_PASSWORD" > "$temporary"; chmod 0600 "$temporary"; mv "$temporary" "$target"'], { quiet: true, signal });
}

async function provision(plan, signal) {
  const resolved = await compose(plan, ['config', '--format', 'json'], { quiet: true, signal });
  assertDisposableConfig(JSON.parse(resolved), plan);
  await compose(plan, ['up', '-d'], { signal });
  await waitUntilReady(plan, signal);
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { quiet: true, signal });
  await provisionDisposableFixtureControls(plan, signal);
}

async function databaseSql(plan, statement, options = {}) {
  return compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', ...(options.scalar ? ['-N', '-B'] : []), 'dolidb'], { ...options, input: `${statement}\n` });
}

async function captureDisposableEvidence(plan, signal, applicationRunning = true) {
	const args = applicationRunning
		? ['exec', '-T', 'dolibarr', 'php']
		: ['run', '--rm', '--no-deps', '--entrypoint', 'php', 'dolibarr'];
	return JSON.parse(await compose(plan, args, {
		quiet: true, signal, input: fs.readFileSync(path.join(repositoryRoot, 'tests/fixtures/database-evidence.php')),
	}));
}

async function waitUntilDatabaseReady(plan, signal) {
	const deadline = Date.now() + 2 * 60 * 1000;
	while (Date.now() < deadline) {
		try {
			await compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', '-e', 'SELECT 1'], { quiet: true, signal, timeoutMs: 3000 });
			return;
		} catch (_) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}
	throw new Error('Disposable MariaDB did not become ready within 2 minutes.');
}

async function rst006aStructuralCounts(plan, signal) {
  return (await databaseSql(plan, "SELECT CONCAT((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()),':',(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()),':',(SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()),':',(SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()),':',(SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()))", { scalar: true, signal })).trim();
}

function filesIn(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter(predicate)
    .sort()
    .map((name) => path.join(directory, name));
}

async function runUnit(signal) {
  const nodeTests = filesIn(path.join(repositoryRoot, 'tests/unit'), (name) => name.endsWith('.test.js'));
  await runCommand(process.execPath, ['--test', ...nodeTests], { signal });

  const phpContracts = filesIn(path.join(repositoryRoot, 'tests/contracts'), (name) => name.endsWith('_test.php'));
  for (const contract of phpContracts) {
    await runCommand('php', [contract], { signal });
  }
}

const verificationScripts = ['verification/schema/activity_assignment.php', 'verification/schema/activity_execution_schema.php'];

async function runVerification(plan, signal) {
  for (const entry of verificationScripts) {
    const [script, ...args] = Array.isArray(entry) ? entry : [entry];
    const scriptPath = script.startsWith('/') ? script : `/var/www/html/custom/mjlfinancement/scripts/${script}`;
    await compose(plan, ['exec', '-T', 'dolibarr', 'php', scriptPath, ...args], { signal });
  }
}

async function runRst003Verification(plan, signal) {
	await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verification/schema/reference_foundation.php'], { signal });
}

async function runPhase1Verification(plan, signal) {
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verify_phase1_reset.php'], { signal });
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verify_phase1_schema_exact.php'], { signal });
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verify_phase1_behavior.php'], { signal });
}

async function runRst003RollbackRehearsal(plan, signal) {
  let renamed = false;
  try {
    await databaseSql(plan, 'RENAME TABLE llx_mjlfinancement_operation_type TO llx_mjlfinancement_operation_type_rst003_rollback', { quiet: true, signal });
    renamed = true;
    const absent = await databaseSql(plan, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='llx_mjlfinancement_operation_type'", { quiet: true, signal, scalar: true });
    if (!/\b0\b/.test(absent)) throw new Error('RST-003 rollback rehearsal did not remove the target table boundary.');
  } finally {
    if (renamed) await databaseSql(plan, 'RENAME TABLE llx_mjlfinancement_operation_type_rst003_rollback TO llx_mjlfinancement_operation_type', { quiet: true, signal });
  }
  await runRst003Verification(plan, signal);
}

async function runPhase3cRestoreRehearsal(sourcePlan, destination, signal) {
  const custody = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-phase3c-restore-'));
  const sourceDocuments = path.join(custody, 'documents');
  const sourceConfiguration = path.join(custody, 'configuration');
  const restoredDocuments = path.join(custody, 'restored-documents');
  const restoredConfiguration = path.join(custody, 'restored-configuration');
	const adaptedDocuments = path.join(custody, 'adapted-documents');
	const adaptedConfiguration = path.join(custody, 'adapted-configuration');
  let destinationProvisioned = false;
  const dumpArgs = ['exec', '-T', 'mariadb', 'mariadb-dump', '--defaults-extra-file=/run/mjl-test/client.cnf', '--single-transaction', '--routines', '--triggers', '--events', '--hex-blob', '--skip-comments', 'dolidb'];
	const constantDumpArgs = [...dumpArgs.slice(0, -1), '--no-create-info', '--skip-triggers', "--where=NOT (entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL')", 'dolidb', 'llx_const'];
  const resetDatabase = () => compose(destination, ['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf'], { quiet: true, signal, input: 'DROP DATABASE dolidb; CREATE DATABASE dolidb CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;\n' });
  const restoreSql = (statement) => compose(destination, ['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', 'dolidb'], { quiet: true, signal, input: `${statement}\n`, timeoutMs: 120000 });
  const restoreFull = async (statement) => {
    try { await restoreSql(statement); }
    catch (_) { throw new Error('Phase 3C full database restore failed.'); }
  };
  let restoreFailure = null;
	try {
	await compose(sourcePlan, ['exec', '-T', 'dolibarr', 'sh', '-ceu', 'umask 077; printf phase3c-storage-canary > /var/www/documents/.mjl-phase3c-storage-canary; chown www-data:www-data /var/www/documents/.mjl-phase3c-storage-canary; chmod 0600 /var/www/documents/.mjl-phase3c-storage-canary'], { quiet: true, signal });
    await compose(sourcePlan, ['stop', 'dolibarr'], { quiet: true, signal });
    const sourceDump = await compose(sourcePlan, dumpArgs, { quiet: true, signal, timeoutMs: 120000 });
    fs.mkdirSync(sourceDocuments, { mode: 0o700 });
    fs.mkdirSync(sourceConfiguration, { mode: 0o700 });
    await compose(sourcePlan, ['cp', 'dolibarr:/var/www/documents/.', sourceDocuments], { quiet: true, signal });
    await compose(sourcePlan, ['cp', 'dolibarr:/var/www/html/conf/.', sourceConfiguration], { quiet: true, signal });

    const resolved = await compose(destination, ['config', '--format', 'json'], { quiet: true, signal });
    assertDisposableConfig(JSON.parse(resolved), destination);
    fs.mkdirSync(destination.artifactRoot, { recursive: true, mode: 0o700 });
    destinationProvisioned = true;
	await compose(destination, ['up', '-d', 'mariadb'], { signal });
	await provisionDisposableDatabaseClient(destination, signal);
	await waitUntilDatabaseReady(destination, signal);
	await compose(destination, ['create', 'dolibarr'], { quiet: true, signal });

	await resetDatabase();
    await restoreFull(sourceDump);
    const restoredDump = await compose(destination, dumpArgs, { quiet: true, signal, timeoutMs: 120000 });
    if (crypto.createHash('sha256').update(restoredDump).digest('hex') !== crypto.createHash('sha256').update(sourceDump).digest('hex')) throw new Error('Phase 3C restored database differs before destination adaptation.');

    await compose(destination, ['run', '--rm', '--no-deps', '--entrypoint', 'sh', 'dolibarr', '-ceu', 'find /var/www/documents -mindepth 1 -delete; find /var/www/html/conf -mindepth 1 -delete'], { quiet: true, signal });
    await compose(destination, ['cp', `${sourceDocuments}/.`, 'dolibarr:/var/www/documents'], { quiet: true, signal });
    await compose(destination, ['cp', `${sourceConfiguration}/.`, 'dolibarr:/var/www/html/conf'], { quiet: true, signal });
    fs.mkdirSync(restoredDocuments, { mode: 0o700 });
    fs.mkdirSync(restoredConfiguration, { mode: 0o700 });
    await compose(destination, ['cp', 'dolibarr:/var/www/documents/.', restoredDocuments], { quiet: true, signal });
    await compose(destination, ['cp', 'dolibarr:/var/www/html/conf/.', restoredConfiguration], { quiet: true, signal });
    if (streamTreeDigest(sourceDocuments) !== streamTreeDigest(restoredDocuments)) throw new Error('Phase 3C restored document storage differs before adaptation.');
    if (streamTreeDigest(sourceConfiguration) !== streamTreeDigest(restoredConfiguration)) throw new Error('Phase 3C restored configuration differs before adaptation.');
	const preAdaptationConstants = await compose(destination, constantDumpArgs, { quiet: true, signal, timeoutMs: 120000 });

	const adaptedRows = await databaseSql(destination, "UPDATE llx_const SET value='"+destination.sentinel+"' WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'; SELECT ROW_COUNT();", { quiet: true, scalar: true, signal });
	if (adaptedRows.trim() !== '1') throw new Error('Phase 3C destination sentinel adaptation did not change exactly one row.');
    await compose(destination, ['run', '--rm', '--no-deps', '--entrypoint', 'sh', 'dolibarr', '-ceu', 'printf %s "$MJL_DISPOSABLE_RUN_SENTINEL" > /var/www/documents/.mjl-disposable-fixture-sentinel; chown root:root /var/www/documents/.mjl-disposable-fixture-sentinel; chmod 0444 /var/www/documents/.mjl-disposable-fixture-sentinel'], { quiet: true, signal });
    await compose(destination, ['run', '--rm', '--no-deps', '--entrypoint', 'sh', 'dolibarr', '-ceu', 'sed -i "s|$1|$DOLI_URL_ROOT|g" /var/www/html/conf/conf.php', '--', sourcePlan.baseUrl], { quiet: true, signal });
	fs.mkdirSync(adaptedDocuments, { mode: 0o700 });
	fs.mkdirSync(adaptedConfiguration, { mode: 0o700 });
	await compose(destination, ['cp', 'dolibarr:/var/www/documents/.', adaptedDocuments], { quiet: true, signal });
	await compose(destination, ['cp', 'dolibarr:/var/www/html/conf/.', adaptedConfiguration], { quiet: true, signal });
	const sourceConf = path.join(sourceConfiguration, 'conf.php');
	const adaptedConf = path.join(adaptedConfiguration, 'conf.php');
	const sourceConfStat = fs.statSync(sourceConf);
	const adaptedConfStat = fs.statSync(adaptedConf);
	if ((sourceConfStat.mode & 0o7777) !== (adaptedConfStat.mode & 0o7777)) throw new Error('Phase 3C destination adaptation changed configuration mode.');
	if (fs.readFileSync(sourceConf, 'utf8').split(sourcePlan.baseUrl).join('MJL_RESTORED_BASE_URL') !== fs.readFileSync(adaptedConf, 'utf8').split(destination.baseUrl).join('MJL_RESTORED_BASE_URL')) throw new Error('Phase 3C destination adaptation changed configuration beyond the base URL.');
	fs.unlinkSync(sourceConf);
	fs.unlinkSync(adaptedConf);
	if (streamTreeDigest(sourceConfiguration) !== streamTreeDigest(adaptedConfiguration)) throw new Error('Phase 3C destination adaptation changed configuration beyond the base URL.');
	const sourceSentinel = path.join(sourceDocuments, '.mjl-disposable-fixture-sentinel');
	const adaptedSentinel = path.join(adaptedDocuments, '.mjl-disposable-fixture-sentinel');
	const sourceSentinelStat = fs.statSync(sourceSentinel);
	const adaptedSentinelStat = fs.statSync(adaptedSentinel);
	if ((sourceSentinelStat.mode & 0o7777) !== (adaptedSentinelStat.mode & 0o7777) || fs.readFileSync(sourceSentinel, 'utf8') !== sourcePlan.sentinel || fs.readFileSync(adaptedSentinel, 'utf8') !== destination.sentinel) throw new Error('Phase 3C destination sentinel adaptation changed document mode or content shape.');
	fs.unlinkSync(sourceSentinel);
	fs.unlinkSync(adaptedSentinel);
	if (streamTreeDigest(sourceDocuments) !== streamTreeDigest(adaptedDocuments)) throw new Error('Phase 3C destination adaptation changed document storage beyond the disposable sentinel.');
    await compose(destination, ['up', '-d', 'dolibarr'], { signal });
    await waitUntilReady(destination, signal);
    await waitUntilDatabaseReady(destination, signal);
    await compose(destination, ['exec', '-T', 'dolibarr', 'sh', '-ceu', 'grep -F "$DOLI_URL_ROOT" /var/www/html/conf/conf.php >/dev/null'], { quiet: true, signal });
	const postAdaptationConstants = await compose(destination, constantDumpArgs, { quiet: true, signal, timeoutMs: 120000 });
	if (preAdaptationConstants !== postAdaptationConstants) throw new Error('Phase 3C destination adaptation changed configuration constants beyond the sentinel.');
    await compose(destination, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst012_export_schema.php', '--mode=verify'], { signal });
    const representative = await databaseSql(destination, "SELECT CONCAT((SELECT COUNT(*) FROM llx_mjlfinancement_activity),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_activity_revision),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_audit_event),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_export_record),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_cancellation_request)+(SELECT COUNT(*) FROM llx_mjlfinancement_reopening_request))", { scalar: true, signal });
    const counts = representative.trim().split('|').map(Number);
	if (counts.length !== 5 || counts.some((count) => count < 1)) throw new Error('Phase 3C restored representative business evidence is incomplete.');
    await compose(destination, ['exec', '-T', 'dolibarr', 'test', '-f', '/var/www/documents/.mjl-phase3c-storage-canary'], { quiet: true, signal });
	await compose(destination, ['exec', '-T', '--user', 'www-data', 'dolibarr', 'sh', '-ceu', 'test -r /var/www/documents/.mjl-phase3c-storage-canary; probe=/var/www/documents/.mjl-phase3c-write-probe; printf ok > "$probe"; test "$(cat "$probe")" = ok; rm -f "$probe"'], { quiet: true, signal });
	await verifyRestoredApplicationAccess(destination, sourcePlan.testUserPassword, signal);
	} catch (error) {
		restoreFailure = error;
  } finally {
	const cleanupFailures = [];
	if (destinationProvisioned && destination) {
		try { await cleanup(destination); } catch (error) { cleanupFailures.push(error); }
	}
	if (destination) {
		try { fs.rmSync(destination.artifactRoot, { recursive: true, force: true }); } catch (error) { cleanupFailures.push(error); }
	}
	try { fs.rmSync(custody, { recursive: true, force: true }); } catch (error) { cleanupFailures.push(error); }
	if (fs.existsSync(custody)) cleanupFailures.push(new Error('Phase 3C backup custody remains after teardown.'));
	for (const cleanupFailure of cleanupFailures) restoreFailure = combineFailures(restoreFailure, cleanupFailure, 'Phase 3C restore and cleanup failed.');
	if (restoreFailure) throw restoreFailure;
  }
}

async function verifyRestoredApplicationAccess(plan, sourcePassword, signal) {
	const activityIds = (await databaseSql(plan, "SELECT CONCAT((SELECT rowid FROM llx_mjlfinancement_activity WHERE entity=1 AND name='Réconciliation Phase 3C 0-0' LIMIT 1),'|',(SELECT rowid FROM llx_mjlfinancement_activity WHERE entity=2 AND name='Isolation Phase 3C' LIMIT 1))", { scalar: true, signal })).trim().split('|');
	if (activityIds.length !== 2 || activityIds.some((id) => !/^\d+$/.test(id))) throw new Error('Phase 3C restored access sentinels are missing.');
	const browser = await chromium.launch({ headless: true });
	try {
		const context = await browser.newContext({ baseURL: plan.baseUrl });
		const page = await context.newPage();
		await page.goto('/index.php');
		await page.getByLabel('Identifiant').fill('p3c-b00.agent');
		await page.getByLabel('Mot de passe').fill(sourcePassword);
		await page.getByRole('button', { name: 'Connexion' }).click();
		if ((await page.goto(`/custom/mjlfinancement/activities.php?id=${activityIds[0]}`)).status() !== 200) throw new Error('Restored authorized Activity read failed.');
		if ((await page.goto(`/custom/mjlfinancement/activities.php?id=${activityIds[1]}`)).status() !== 403) throw new Error('Restored cross-entity Activity read was not denied.');
		await context.clearCookies();
		await page.goto('/index.php');
		await page.getByLabel('Identifiant').fill('p3c-b00.norole');
		await page.getByLabel('Mot de passe').fill(sourcePassword);
		await page.getByRole('button', { name: 'Connexion' }).click();
		if ((await page.goto(`/custom/mjlfinancement/activities.php?id=${activityIds[0]}`)).status() !== 403) throw new Error('Restored no-role Activity read was not denied.');
		await context.close();
	} finally {
		await browser.close();
	}
}

async function runPlaywright(plan, target, signal) {
  const args = ['playwright', 'test'];
  if (target === 'e2e') {
    const batches = [
      ['tests/e2e/activity-execution.spec.js','tests/e2e/document-containment.spec.js'],
      ['tests/e2e/auth-concurrency.spec.js','tests/e2e/partner-project.spec.js'],
      ['tests/e2e/fixture-isolation.spec.js'],
      ['tests/e2e/activity-assignment.spec.js','tests/e2e/activity-planning.spec.js','tests/e2e/planning-navigation.spec.js'],
      ['tests/e2e/activities-report.spec.js','tests/e2e/export-recovery.spec.js','tests/e2e/operations-report.spec.js','tests/e2e/activity-detail.spec.js','tests/e2e/portfolio-report.spec.js','tests/e2e/audit-report.spec.js','tests/e2e/timeline.spec.js','tests/e2e/monitoring.spec.js'],
    ];
    for (const batch of batches) {
      // Activate monitoring only after predecessor-surface regressions finish.
      if (batch[0] === 'tests/e2e/activities-report.spec.js') {
        await compose(plan, ['exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/export-integrity-probe.php'], { signal });
      }
      await runCommand('npx', ['playwright','test',...batch,'--config=playwright.config.js'], { env: composeEnvironment(plan), signal, timeoutMs: 15 * 60 * 1000 });
    }
    return;
  } else if (target === 'rst003') {
    args.push('tests/e2e/partner-project.spec.js', '--config=playwright.config.js');
  } else if (target === 'rst010a') {
	args.push('tests/e2e/document-containment.spec.js', '--config=playwright.config.js');
  } else if (target === 'rst014a') {
    args.push('tests/e2e/fixture-isolation.spec.js', 'tests/e2e/reset-boundaries.spec.js', 'tests/e2e/auth-concurrency.spec.js', 'tests/e2e/partner-project.spec.js', 'tests/e2e/document-containment.spec.js', '--config=playwright.config.js');
  } else if (target === 'rst013a') {
    args.push('tests/e2e/reset-boundaries.spec.js', '--config=playwright.config.js', '--grep', '\\[RST-013A\\]');
  } else if (target === 'rst002b') {
    args.push('tests/e2e/activity-assignment.spec.js', '--config=playwright.config.js');
  } else if (target === 'rst006a') {
    args.push('tests/e2e/activity-planning.spec.js', '--config=playwright.config.js');
  } else if (target === 'phase2') {
    args.push('tests/e2e/activity-planning.spec.js', 'tests/e2e/planning-navigation.spec.js', '--config=playwright.config.js');
  } else if (target === 'vui03') {
    args.push('tests/e2e/vui-activities-list.spec.js', '--config=playwright.config.js');
  } else if (target === 'vui04') {
    args.push('tests/e2e/vui-activity-planning.spec.js', '--config=playwright.config.js');
  } else if (target === 'vui05') {
    args.push('tests/e2e/vui-activity-workspace.spec.js', '--config=playwright.config.js');
  } else if (target === 'vui06') {
    args.push('tests/e2e/vui-review-workflow.spec.js', '--config=playwright.config.js');
  } else if (target === 'vui07') {
    args.push('tests/e2e/vui-operation-consultation.spec.js', '--config=playwright.config.js');
  } else if (target === 'vui08') {
    args.push('tests/e2e/vui-exception-dialogs.spec.js', '--config=playwright.config.js');
  } else if (target === 'phase3b') {
    args.push('tests/e2e/activities-report.spec.js','tests/e2e/export-recovery.spec.js','tests/e2e/operations-report.spec.js','tests/e2e/activity-detail.spec.js','tests/e2e/portfolio-report.spec.js','tests/e2e/audit-report.spec.js','tests/e2e/timeline.spec.js','tests/e2e/monitoring.spec.js','--config=playwright.config.js');
  } else if (target === 'phase3a') {
    args.push('tests/e2e/activity-execution.spec.js', 'tests/e2e/document-containment.spec.js', '--config=playwright.config.js');
	} else if (target === 'phase3c') {
	args.push('tests/e2e/reconciliation-restore.spec.js', '--config=playwright.config.js');
  } else if (['rst007a', 'rst004', 'rst008', 'rst009a'].includes(target)) {
	args.push('tests/e2e/reset-boundaries.spec.js', ...(target === 'rst008' ? ['tests/e2e/auth-concurrency.spec.js'] : []), '--config=playwright.config.js');
    const tags = { rst007a: 'RST-007A', rst004: 'RST-004', rst008: 'RST-008', rst009a: 'RST-009A' };
    args.push('--grep', `\\[${tags[target]}\\]`);
  } else {
    args.push('--config=tests/manual/playwright.config.js', '--debug');
  }
  await runCommand('npx', args, { env: composeEnvironment(plan), signal, timeoutMs: 15 * 60 * 1000 });
}

async function captureDiagnosticsInline(plan, signal, workerSecrets = []) {
  if (process.env.MJL_RST014A_DIAGNOSTICS_STUB === 'failure') throw new Error('Injected diagnostics failure.');
  if (process.env.MJL_RST014A_DIAGNOSTICS_STUB === 'never') {
    await new Promise(() => {});
  }
  fs.mkdirSync(plan.artifactRoot, { recursive: true });
  const chunks = [];
  for (const args of [['ps', '-a'], ['logs', '--no-color', '--timestamps']]) {
    if (signal.aborted) throw new Error('Diagnostics capture cancelled.');
    try {
      chunks.push(await runCommand('docker', ['compose', ...args], { quiet: true, signal, timeoutMs: 4000 }));
    } catch (error) {
      chunks.push(error.output || error.message);
    }
  }
  if (signal.aborted) throw new Error('Diagnostics capture cancelled.');
  fs.writeFileSync(
    path.join(plan.artifactRoot, 'compose.log'),
    sanitizeOutput(chunks.join('\n'), [
      ...allSecretValues(),
      ...workerSecrets,
      process.env.MJL_DISPOSABLE_RUN_SENTINEL,
      process.env.MJL_TEST_USER_PASSWORD,
      process.env.MJL_AUTH_PASSWORD_1,
      process.env.MJL_AUTH_PASSWORD_2,
      process.env.MJL_AUTH_STALE_PASSWORD,
      process.env.MJL_SECRET_REGISTRY_CAPABILITY,
    ].filter(Boolean)),
    { mode: 0o600 },
  );
}

async function captureDiagnostics(plan, signal) {
  const environment = {
    ...composeEnvironment(plan),
    MJL_DIAGNOSTICS_WORKER_PROJECT: plan.projectName,
    MJL_DIAGNOSTICS_WORKER_ARTIFACT_ROOT: plan.artifactRoot,
  };
  await runCommand(process.execPath, [__filename, 'diagnostics-worker'], {
    env: environment,
    input: JSON.stringify({
      projectName: plan.projectName,
      artifactRoot: plan.artifactRoot,
      secrets: allSecretValues(),
    }),
    quiet: true,
    signal,
  });
}

async function diagnosticsWorkerMain() {
  const raw = fs.readFileSync(0, 'utf8');
  if (Buffer.byteLength(raw, 'utf8') > 128 * 1024) throw new Error('Diagnostics worker request is oversized.');
  const request = JSON.parse(raw);
  if (Object.keys(request).join(',') !== 'projectName,artifactRoot,secrets'
    || !Array.isArray(request.secrets) || request.secrets.length > 256
    || request.secrets.some((secret) => typeof secret !== 'string' || secret.length < 1 || secret.length > 512)
    || JSON.stringify(request) !== raw) throw new Error('Invalid diagnostics worker request.');
  const { projectName, artifactRoot } = request;
  const runsRoot = path.join(repositoryRoot, 'test-results', 'runs');
  const expectedArtifactRoot = path.join(runsRoot, projectName || '');
  if (!/^mjl-test-[a-z0-9-]+$/.test(projectName || '')
    || artifactRoot !== expectedArtifactRoot
    || process.env.MJL_DIAGNOSTICS_WORKER_PROJECT !== projectName
    || process.env.MJL_DIAGNOSTICS_WORKER_ARTIFACT_ROOT !== artifactRoot) {
    throw new Error('Invalid diagnostics worker boundary.');
  }
  for (const allowedDirectory of [path.join(repositoryRoot, 'test-results'), runsRoot, expectedArtifactRoot]) {
    const stat = fs.lstatSync(allowedDirectory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Invalid diagnostics worker boundary.');
  }
  if (fs.realpathSync(runsRoot) !== runsRoot || path.dirname(fs.realpathSync(expectedArtifactRoot)) !== runsRoot) {
    throw new Error('Invalid diagnostics worker boundary.');
  }
  await captureDiagnosticsInline({ projectName, artifactRoot }, AbortSignal.timeout(30000), request.secrets);
}

async function captureSharedEvidence(signal = AbortSignal.timeout(60000)) {
  const source = fs.readFileSync(path.join(repositoryRoot, 'tests/fixtures/database-evidence.php'));
  const sharedEnvironment = { ...process.env };
  for (const key of ['COMPOSE_PROJECT_NAME', 'COMPOSE_FILE', 'MJL_BASE_URL', 'MJL_TEST_PORT', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_TEST_USER_PASSWORD']) delete sharedEnvironment[key];
  const database = JSON.parse(await runCommand('docker', ['compose', '-f', path.join(repositoryRoot, 'docker-compose.yml'), 'exec', '-T', 'dolibarr', 'php'], {
    quiet: true,
    input: source,
    env: sharedEnvironment,
    signal,
    timeoutMs: 30000,
  }));
  if (database.disposable_control_count !== 0 || database.disposable_file_sentinel_present) throw new Error('Shared tenant contains disposable fixture controls.');
  const expectedAdmin = [{ rowid: 1, entity: 0, login: 'admin', admin: 1, statut: 1 }];
  if (database.admin_count !== 1 || JSON.stringify(database.admin_identity) !== JSON.stringify(expectedAdmin)) {
    throw new Error('Shared tenant does not contain the exact preserved native administrator baseline.');
  }
  if (Object.values(database.business_counts || {}).some((count) => count !== 0)) {
    throw new Error('Shared tenant contains business or sample rows.');
  }
  const protectedPaths = ['custom', 'docs', 'tests', 'AGENTS.md', 'CONTEXT.md', 'DESIGN.md', 'README.md', 'docker-compose.yml', 'package.json', 'package-lock.json', 'playwright.config.js'];
  const project = path.basename(repositoryRoot);
  const filter = `label=com.docker.compose.project=${project}`;
  const [containers, networks, volumes] = await Promise.all([
    runCommand('docker', ['ps', '-a', '--filter', filter, '--format', '{{.Names}}'], { quiet: true, signal, timeoutMs: 10000 }),
    runCommand('docker', ['network', 'ls', '--filter', filter, '--format', '{{.Name}}'], { quiet: true, signal, timeoutMs: 10000 }),
    runCommand('docker', ['volume', 'ls', '--filter', filter, '--format', '{{.Name}}'], { quiet: true, signal, timeoutMs: 10000 }),
  ]);
  const names = (value) => value.split('\n').map((entry) => entry.trim()).filter(Boolean).sort();
  return Object.freeze({
    protected_source_sha256: protectedSourceDigest(repositoryRoot, protectedPaths),
    documents_sha256: database.documents_sha256,
    database,
    resources: { containers: names(containers), networks: names(networks), volumes: names(volumes) },
  });
}

async function projectResources(plan, signal) {
  const filter = `label=com.docker.compose.project=${plan.projectName}`;
  const [containers, networks, volumes] = await Promise.all([
    runCommand('docker', ['ps', '-a', '--filter', filter, '--format', '{{.Names}}'], { quiet: true, signal, timeoutMs: 10000 }),
    runCommand('docker', ['network', 'ls', '--filter', filter, '--format', '{{.Name}}'], { quiet: true, signal, timeoutMs: 10000 }),
    runCommand('docker', ['volume', 'ls', '--filter', filter, '--format', '{{.Name}}'], { quiet: true, signal, timeoutMs: 10000 }),
  ]);
  const lines = (value) => value.split('\n').map((line) => line.trim()).filter(Boolean);
  return { containers: lines(containers), networks: lines(networks), volumes: lines(volumes) };
}

async function cleanup(plan) {
  const cleanupSignal = AbortSignal.timeout(120000);
  let lastFailure;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await compose(plan, ['exec', '-T', 'mariadb', 'sh', '-c', 'rm -f /run/mjl-test/client.cnf'], { quiet: true, signal: cleanupSignal, timeoutMs: 5000 }).catch(() => {});
      await compose(plan, ['down', '-v', '--remove-orphans'], { signal: cleanupSignal, timeoutMs: 30000 });
      assertCleanupComplete(await projectResources(plan, cleanupSignal), plan.projectName);
      return;
    } catch (error) {
      lastFailure = error;
    }
  }
  throw lastFailure;
}

function printRetainedRun(plan) {
  const composeFiles = `${path.join(repositoryRoot, 'docker-compose.yml')}:${plan.composeFile}`;
  process.stderr.write([
    '',
    'Disposable project retained after failure:',
    `  project: ${plan.projectName}`,
    `  URL: ${plan.baseUrl}`,
    `  database volume: ${plan.databaseVolume}`,
    `  document volume: ${plan.documentVolume}`,
    `  config volume: ${plan.configVolume}`,
    `  cleanup: COMPOSE_PROJECT_NAME=${plan.projectName} COMPOSE_FILE=${composeFiles} docker compose down -v --remove-orphans`,
    '',
  ].join('\n'));
}

function combineFailures(primary, secondary, label) {
  if (!primary) return secondary;
  const errors = primary instanceof AggregateError ? [...primary.errors, secondary] : [primary, secondary];
  const combined = new AggregateError(errors, label);
  combined.exitCode = primary.exitCode || secondary.exitCode;
  return combined;
}

async function finalizeDisposableRun({ plan, provisionAttempted, failure, runMode = mode, environment = process.env, capture = captureDiagnostics, remove = cleanup, retain = printRetainedRun, diagnosticsTimeoutMs = 10000 }) {
  if (!plan || !provisionAttempted) return failure;
  try {
    await runWithDeadline((signal) => capture(plan, signal), diagnosticsTimeoutMs, 'Diagnostics capture');
  } catch (diagnosticsError) {
    failure = combineFailures(failure, diagnosticsError, 'Test execution and diagnostics capture failed.');
  }
  const shouldRetain = failure && environment.MJL_TEST_RETAIN === '1'
    && !runMode.startsWith('rst013a')
    && !runMode.startsWith('rst014a')
    && !['phase3b', 'phase3c', 'vui03', 'vui04', 'vui05', 'vui06', 'vui07', 'vui08', 'all', 'verify', 'e2e', 'manual-accessibility'].includes(runMode);
  try {
    if (shouldRetain) retain(plan);
  } finally {
    if (!shouldRetain) {
      try {
        await remove(plan);
      } catch (cleanupError) {
        failure = combineFailures(failure, cleanupError, 'Disposable test execution and teardown failed.');
      }
    }
  }
  return failure;
}

async function main() {
  const started = Date.now();
  const controller = new AbortController();
  let interrupted = null;
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      interrupted = signal;
      controller.abort();
    });
  }

  let plan = null;
  let restorePlan = null;
  let provisionAttempted = false;
  let failure = null;
  let sharedBefore = null;
  let secretRegistry = null;
  const parentRegistry = (process.env.MJL_SECRET_REGISTRY_PORT || process.env.MJL_SECRET_REGISTRY_CAPABILITY)
    ? { port: process.env.MJL_SECRET_REGISTRY_PORT, capability: process.env.MJL_SECRET_REGISTRY_CAPABILITY }
    : null;
  try {
    if (mode === 'all' || mode === 'e2e' || mode === 'verify' || mode === 'rst002b' || mode === 'rst006a' || mode === 'phase2' || mode === 'phase3b' || mode === 'phase3c' || mode === 'vui03' || mode === 'vui04' || mode === 'vui05' || mode === 'vui06' || mode === 'vui07' || mode === 'vui08' || mode === 'phase3a' || mode === 'rst013a' || mode === 'rst014a') sharedBefore = await captureSharedEvidence(controller.signal);
    if (needsTenant) {
      plan = createRunPlan({ repositoryRoot, port: await allocatePort() });
      if (mode === 'phase3c') {
        let restorePort = await allocatePort();
        while (restorePort === plan.port) restorePort = await allocatePort();
        restorePlan = createRunPlan({ repositoryRoot, port: restorePort });
        const identities = [plan.projectName, restorePlan.projectName, plan.baseUrl, restorePlan.baseUrl, plan.databaseVolume, restorePlan.databaseVolume, plan.documentVolume, restorePlan.documentVolume, plan.configVolume, restorePlan.configVolume, plan.sentinel, restorePlan.sentinel];
        if (new Set(identities).size !== identities.length) throw new Error('Phase 3C disposable source and restore identities must be distinct.');
      }
      fs.mkdirSync(plan.artifactRoot, { recursive: true, mode: 0o700 });
      const initialSecrets = [
        ['disposable credential', plan.testUserPassword],
        ['disposable sentinel', plan.sentinel],
        ['secret registry capability', plan.secretRegistryCapability],
        ...plan.lifecyclePasswords.map((password) => ['lifecycle credential', password]),
        ...(restorePlan ? [
          ['phase three c destination credential', restorePlan.testUserPassword],
          ['phase three c destination sentinel', restorePlan.sentinel],
          ...restorePlan.lifecyclePasswords.map((password) => ['phase three c destination credential', password]),
        ] : []),
      ];
      for (const [category, value] of initialSecrets) {
        registerRunnerSecret(category, value);
        if (parentRegistry) await registerSecretAt(parentRegistry, category, value);
      }
      secretRegistry = await startSecretRegistry(plan);
      const injectedLifecycleSecret = mode === 'rst013a-lifecycle-probe'
        ? process.env.MJL_RST013A_INJECT_SECRET
        : process.env.MJL_RST014A_INJECT_SECRET;
      if ((mode === 'rst013a-lifecycle-probe' || mode === 'rst014a-lifecycle-probe') && injectedLifecycleSecret) {
        registerRunnerSecret('injected lifecycle secret', injectedLifecycleSecret);
        if (parentRegistry) await registerSecretAt(parentRegistry, 'injected lifecycle secret', injectedLifecycleSecret);
        fs.writeFileSync(path.join(plan.artifactRoot, 'injected-secret.log'), injectedLifecycleSecret, { mode: 0o600 });
      }
      process.stdout.write(`Disposable MJL project: ${plan.projectName}\nURL: ${plan.baseUrl}\n`);
    }

    for (const layer of layers) {
      if (layer === 'unit') {
        await runUnit(controller.signal);
        continue;
      }
      if (!provisionAttempted) {
        provisionAttempted = true;
        if (layer === 'rst013a-lifecycle-probe' || layer === 'rst014a-lifecycle-probe') {
          const resolved = await compose(plan, ['config', '--format', 'json'], { quiet: true, signal: controller.signal, timeoutMs: 10000 });
          assertDisposableConfig(JSON.parse(resolved), plan);
          const setupFailure = layer === 'rst013a-lifecycle-probe'
            ? process.env.MJL_RST013A_PROBE_FAILURE
            : process.env.MJL_RST014A_PROBE_FAILURE;
          if (setupFailure === 'setup') throw new Error('Injected lifecycle setup failure.');
          await compose(plan, ['up', '-d', 'mariadb'], { quiet: true, signal: controller.signal, timeoutMs: 60000 });
          process.stdout.write(`${layer === 'rst013a-lifecycle-probe' ? 'RST-013A' : 'RST-014A'} lifecycle probe ready.\n`);
        }
        else await provision(plan, controller.signal);
      }
      if (layer === 'rst013a-lifecycle-probe' || layer === 'rst014a-lifecycle-probe') {
        const outcome = (layer === 'rst013a-lifecycle-probe'
          ? process.env.MJL_RST013A_PROBE_OUTCOME
          : process.env.MJL_RST014A_PROBE_OUTCOME) || 'signal';
        if (outcome === 'test') throw new Error('Injected lifecycle test failure.');
        if (outcome === 'diagnostics-failure') process.env.MJL_RST014A_DIAGNOSTICS_STUB = 'failure';
        if (outcome === 'diagnostics-timeout') process.env.MJL_RST014A_DIAGNOSTICS_STUB = 'never';
        if (['success', 'diagnostics-failure', 'diagnostics-timeout'].includes(outcome)) continue;
        await new Promise((resolve) => {
          if (controller.signal.aborted) resolve();
          else controller.signal.addEventListener('abort', resolve, { once: true });
        });
        continue;
      }
      if (layer === 'verify') await runVerification(plan, controller.signal);
      else if (layer === 'rst003') {
        await runRst003Verification(plan, controller.signal);
        await runRst003RollbackRehearsal(plan, controller.signal);
        await runPlaywright(plan, layer, controller.signal);
      }
      else if (['rst007a', 'rst004', 'rst008', 'rst009a', 'rst010a', 'rst014a', 'rst013a'].includes(layer)) {
        await runPhase1Verification(plan, controller.signal);
        await runPlaywright(plan, layer, controller.signal);
      }
      else if (layer === 'rst002b') {
        await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_assignment.php'], { signal: controller.signal });
        for (const failurePoint of [
          'forward-01-assignment-table-created','forward-02-activity-old-guard-dropped','forward-03-activity-column-cutover',
          'forward-04-activity-target-guard-created','forward-05-scope-table-removed',
          ...Array.from({length:7},(_,index)=>`forward-trigger-${String(index+1).padStart(2,'0')}`),
        ]) {
          await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=rollback', '--confirm=RST-002B'], { signal: controller.signal });
          const output = await expectComposeFailure(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=apply', '--confirm=RST-002B', `--failure-point=${failurePoint}`], `RST-002B ${failurePoint}`, { signal: controller.signal });
          if (!output.includes(`Injected failure after ${failurePoint}`)) throw new Error(`RST-002B ${failurePoint} failed for the wrong reason.`);
          await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=apply', '--confirm=RST-002B'], { signal: controller.signal });
          await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_assignment.php'], { signal: controller.signal });
        }
		for (const failurePoint of [
		  ...Array.from({length:7},(_,index)=>`rollback-trigger-${String(index+1).padStart(2,'0')}`),
		  'rollback-scope-table-restored','rollback-activity-target-guard-dropped','rollback-activity-column-restored',
		  'rollback-activity-old-guard-restored','rollback-assignment-table-dropped',
		]) {
		  const output = await expectComposeFailure(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=rollback', '--confirm=RST-002B', `--failure-point=${failurePoint}`], `RST-002B ${failurePoint}`, { signal: controller.signal });
		  if (!output.includes(`Injected failure after ${failurePoint}`)) throw new Error(`RST-002B ${failurePoint} failed for the wrong reason.`);
		  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=rollback', '--confirm=RST-002B'], { signal: controller.signal });
		  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=apply', '--confirm=RST-002B'], { signal: controller.signal });
		}
		await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=rollback', '--confirm=RST-002B'], { signal: controller.signal });
		await expectComposeFailure(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=apply', '--confirm=RST-002B', '--failure-point=assignment-table-created'], 'RST-002B malformed-prefix setup', { signal: controller.signal });
		await databaseSql(plan, 'ALTER TABLE llx_mjlfinancement_activity_assignment DROP CONSTRAINT chk_mjl_activity_assignment_entity_positive, ADD CONSTRAINT chk_mjl_activity_assignment_entity_positive CHECK (entity >= 0)', { signal: controller.signal });
		const malformedPrefix = await expectComposeFailure(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=apply', '--confirm=RST-002B'], 'RST-002B malformed prefix', { signal: controller.signal });
		if (!malformedPrefix.includes('Unknown RST-002B schema state')) throw new Error('RST-002B malformed prefix was not classified as unknown.');
		await databaseSql(plan, 'ALTER TABLE llx_mjlfinancement_activity_assignment DROP CONSTRAINT chk_mjl_activity_assignment_entity_positive, ADD CONSTRAINT chk_mjl_activity_assignment_entity_positive CHECK (entity > 0)', { signal: controller.signal });
		await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=apply', '--confirm=RST-002B'], { signal: controller.signal });
		await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_assignment.php'], { signal: controller.signal });
        await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=rollback', '--confirm=RST-002B'], { signal: controller.signal });
        await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=apply', '--confirm=RST-002B'], { signal: controller.signal });
        await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_assignment.php'], { signal: controller.signal });
        await runPlaywright(plan, layer, controller.signal);
      }
      else if (layer === 'phase2') {
        await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst012_export_schema.php','--mode=verify'], { signal: controller.signal });
        await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst012_export_schema.php','--mode=verify-empty'], { signal: controller.signal });
        await runPlaywright(plan, layer, controller.signal);
      }
	  else if (layer === 'vui03' || layer === 'vui04' || layer === 'vui05' || layer === 'vui06' || layer === 'vui07' || layer === 'vui08') {
		await compose(plan, ['exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/export-integrity-probe.php'], {signal: controller.signal});
		await runPlaywright(plan,layer,controller.signal);
	  }
	  else if (layer === 'phase3b') {
		await compose(plan, ['exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/export-integrity-probe.php'], {signal: controller.signal});
		await runPlaywright(plan,layer,controller.signal);
	  }
	  else if (layer === 'phase3a') {
		await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_execution_schema.php'], { signal: controller.signal });
		const cronCount=(await databaseSql(plan,"SELECT COUNT(*) FROM llx_cronjob WHERE objectname='MjlExecutionReconciler' AND methodename='run' AND frequency=1 AND unitfrequency=3600 AND status=1",{scalar:true,signal:controller.signal})).trim();
		if(cronCount!=='1')throw new Error(`Phase 3A hourly reconciler registration mismatch: ${cronCount}.`);
		const migration='/var/www/html/custom/mjlfinancement/scripts/rst006b_execution.php';
		const failurePoints=['operation-checks','activity-checks',...Array.from({length:4},(_,index)=>`cancellation_request-fk-${String(index+1).padStart(2,'0')}`),'cancellation_request',...Array.from({length:5},(_,index)=>`reopening_request-fk-${String(index+1).padStart(2,'0')}`),'reopening_request','guards'];
		const unguardedShared=await expectComposeFailure(plan,['exec','-T','-e','MJL_DISPOSABLE_TEST_TENANT=0','dolibarr','php',migration,'--mode=apply','--confirm=RST-006B'],'RST-006B unguarded shared apply',{signal:controller.signal});
		if(!unguardedShared.includes('guarded cutover'))throw new Error('RST-006B raw shared apply was not refused by the cutover capability guard.');
		const unguardedRollback=await expectComposeFailure(plan,['exec','-T','-e','MJL_DISPOSABLE_TEST_TENANT=0','dolibarr','php',migration,'--mode=rollback','--confirm=RST-006B'],'RST-006B shared rollback',{signal:controller.signal});
		if(!unguardedRollback.includes('disposable tenant'))throw new Error('RST-006B shared rollback was not refused.');
		await compose(plan,['exec','-T','dolibarr','php',migration,'--mode=rollback','--confirm=RST-006B'],{signal:controller.signal});
		for(const failurePoint of failurePoints){const output=await expectComposeFailure(plan,['exec','-T','dolibarr','php',migration,'--mode=apply','--confirm=RST-006B',`--failure-point=${failurePoint}`],`RST-006B ${failurePoint}`,{signal:controller.signal});if(!output.includes(`Injected RST-006B interruption after ${failurePoint}`))throw new Error(`RST-006B ${failurePoint} failed for the wrong reason.`);await compose(plan,['exec','-T','dolibarr','php',migration,'--mode=apply','--confirm=RST-006B'],{signal:controller.signal});await compose(plan,['exec','-T','dolibarr','php',migration,'--mode=verify'],{signal:controller.signal});await compose(plan,['exec','-T','dolibarr','php',migration,'--mode=rollback','--confirm=RST-006B'],{signal:controller.signal});}
		const malformed=await expectComposeFailure(plan,['exec','-T','dolibarr','php',migration,'--mode=apply','--confirm=RST-006B','--failure-point=cancellation_request'],'RST-006B malformed-prefix setup',{signal:controller.signal});if(!malformed.includes('Injected RST-006B interruption'))throw new Error('RST-006B malformed-prefix setup failed for the wrong reason.');
		await databaseSql(plan,'ALTER TABLE llx_mjlfinancement_cancellation_request ADD COLUMN malformed_probe INT NULL',{signal:controller.signal});
		const refused=await expectComposeFailure(plan,['exec','-T','dolibarr','php',migration,'--mode=apply','--confirm=RST-006B'],'RST-006B unknown schema refusal',{signal:controller.signal});if(!refused.includes('unknown predecessor state'))throw new Error('RST-006B malformed prefix was not refused as unknown.');
		await databaseSql(plan,'ALTER TABLE llx_mjlfinancement_cancellation_request DROP COLUMN malformed_probe',{signal:controller.signal});
		await compose(plan,['exec','-T','dolibarr','php',migration,'--mode=apply','--confirm=RST-006B'],{signal:controller.signal});
		await compose(plan,['exec','-T','dolibarr','php',migration,'--mode=apply','--confirm=RST-006B'],{signal:controller.signal});
		const verifier=['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_execution_schema.php'];
		await compose(plan,verifier,{signal:controller.signal});
		const mutations=[
		  ['column default','ALTER TABLE llx_mjlfinancement_reopening_request MODIFY status VARCHAR(16) NOT NULL DEFAULT \'APPROVED\'','ALTER TABLE llx_mjlfinancement_reopening_request MODIFY status VARCHAR(16) NOT NULL DEFAULT \'PENDING\''],
		  ['unique pending index','ALTER TABLE llx_mjlfinancement_cancellation_request DROP INDEX uk_mjl_cancellation_pending, ADD INDEX uk_mjl_cancellation_pending (entity,pending_target_key)','ALTER TABLE llx_mjlfinancement_cancellation_request DROP INDEX uk_mjl_cancellation_pending, ADD UNIQUE INDEX uk_mjl_cancellation_pending (entity,pending_target_key)'],
		  ['foreign-key contract','ALTER TABLE llx_mjlfinancement_reopening_request DROP FOREIGN KEY fk_mjl_reopening_requester','ALTER TABLE llx_mjlfinancement_reopening_request ADD CONSTRAINT fk_mjl_reopening_requester FOREIGN KEY (fk_requester) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT'],
		  ['retained execution check',"ALTER TABLE llx_mjlfinancement_operation DROP CONSTRAINT chk_mjl_operation_execution_status, ADD CONSTRAINT chk_mjl_operation_execution_status CHECK (status IN ('TODO','IN_PROGRESS','COMPLETED','CANCELLED','BROKEN'))","ALTER TABLE llx_mjlfinancement_operation DROP CONSTRAINT chk_mjl_operation_execution_status, ADD CONSTRAINT chk_mjl_operation_execution_status CHECK (status IN ('TODO','IN_PROGRESS','COMPLETED','CANCELLED'))"],
		  ['unexpected trigger',"CREATE TRIGGER llx_mjl_rst006b_unexpected BEFORE DELETE ON llx_mjlfinancement_reopening_request FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='unexpected'",'DROP TRIGGER llx_mjl_rst006b_unexpected'],
		  ['table collation','ALTER TABLE llx_mjlfinancement_reopening_request CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_bin','ALTER TABLE llx_mjlfinancement_reopening_request CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci'],
		];
		for(const [category,mutate,restore]of mutations){await databaseSql(plan,mutate,{signal:controller.signal});await expectComposeFailure(plan,verifier,`RST-006B exact ${category}`,{signal:controller.signal});await databaseSql(plan,restore,{signal:controller.signal});await compose(plan,verifier,{signal:controller.signal});}
		await runPlaywright(plan, layer, controller.signal);
	  }
      else if (layer === 'rst006a') {
        await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_planning.php'], { signal: controller.signal });
        const allForwardDdlPoints = Array.from({ length: 43 }, (_, index) => `forward-${String(index + 1).padStart(3, '0')}`);
        const allRollbackDdlPoints = Array.from({ length: 43 }, (_, index) => `rollback-${String(index + 1).padStart(3, '0')}`);
        const selectedDdlPoint = process.env.MJL_RST006A_BOUNDARY || '';
        const postDdlOnly = process.env.MJL_RST006A_POST_DDL_ONLY === '1';
        if (selectedDdlPoint && postDdlOnly) throw new Error('MJL_RST006A_BOUNDARY and MJL_RST006A_POST_DDL_ONLY cannot be combined.');
        if (selectedDdlPoint && ![...allForwardDdlPoints, ...allRollbackDdlPoints].includes(selectedDdlPoint)) {
          throw new Error(`Unknown MJL_RST006A_BOUNDARY: ${selectedDdlPoint}`);
        }
        const forwardDdlPoints = postDdlOnly ? [] : selectedDdlPoint ? allForwardDdlPoints.filter((point) => point === selectedDdlPoint) : allForwardDdlPoints;
        const rollbackDdlPoints = postDdlOnly ? [] : selectedDdlPoint ? allRollbackDdlPoints.filter((point) => point === selectedDdlPoint) : allRollbackDdlPoints;
        for (const failurePoint of forwardDdlPoints) {
		  process.stdout.write(`RST-006A boundary ${failurePoint}\n`);
          await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A'], { signal: controller.signal });
          const output = await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A',`--failure-point=${failurePoint}`], `RST-006A ${failurePoint}`, { signal: controller.signal });
          if (!output.includes(`Injected interruption after ${failurePoint}`)) throw new Error(`RST-006A ${failurePoint} failed for the wrong reason.`);
          await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], { signal: controller.signal });
          await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_planning.php'], { signal: controller.signal });
        }
		for (const failurePoint of rollbackDdlPoints) {
		  process.stdout.write(`RST-006A boundary ${failurePoint}\n`);
		  const output = await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A',`--failure-point=${failurePoint}`], `RST-006A ${failurePoint}`, { signal: controller.signal });
		  if (!output.includes(`Injected interruption after ${failurePoint}`)) throw new Error(`RST-006A ${failurePoint} failed for the wrong reason.`);
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A'], { signal: controller.signal });
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=verify-predecessor'], { signal: controller.signal });
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], { signal: controller.signal });
		}
		if (!selectedDdlPoint && !postDdlOnly) {
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A'], { signal: controller.signal });
		  await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A','--failure-point=forward-020'], 'RST-006A assignment-prefix setup', { signal: controller.signal });
		  await databaseSql(plan, 'ALTER TABLE llx_mjlfinancement_activity_assignment ADD INDEX idx_rst006a_unexpected_assignment (reason(8))', { signal: controller.signal });
		  const assignmentRefusal = await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], 'RST-006A malformed assignment forward prefix', { signal: controller.signal });
		  if (!assignmentRefusal.includes('unknown predecessor state')) throw new Error('RST-006A malformed assignment forward prefix was not refused before mutation.');
		  await databaseSql(plan, 'ALTER TABLE llx_mjlfinancement_activity_assignment DROP INDEX idx_rst006a_unexpected_assignment', { signal: controller.signal });
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], { signal: controller.signal });

		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A'], { signal: controller.signal });
		  await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A','--failure-point=forward-020'], 'RST-006A retained-trigger setup', { signal: controller.signal });
		  await databaseSql(plan, 'DROP TRIGGER llx_mjl_activity_rst005_bd', { signal: controller.signal });
		  const missingTriggerBefore = await rst006aStructuralCounts(plan, controller.signal);
		  const missingTriggerRefusal = await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], 'RST-006A missing retained trigger', { signal: controller.signal });
		  if (!missingTriggerRefusal.includes('unknown predecessor state') || await rst006aStructuralCounts(plan, controller.signal) !== missingTriggerBefore) throw new Error('RST-006A missing retained trigger was not refused before mutation.');
		  await databaseSql(plan, "CREATE TRIGGER llx_mjl_activity_rst005_bd BEFORE DELETE ON llx_mjlfinancement_activity FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity deletion is dormant in RST-005'", { signal: controller.signal });
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], { signal: controller.signal });

		  await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A','--failure-point=rollback-001'], 'RST-006A Activity rollback-prefix setup', { signal: controller.signal });
		  await databaseSql(plan, 'ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_rst006a_unexpected_rollback (name)', { signal: controller.signal });
		  const rollbackRefusal = await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A'], 'RST-006A malformed Activity rollback prefix', { signal: controller.signal });
		  if (!rollbackRefusal.includes('Rollback requires the exact target or a known rollback prefix')) throw new Error('RST-006A malformed Activity rollback prefix failed for the wrong reason.');
		  const rollbackUntouched = (await databaseSql(plan, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='llx_mjl_activity_rst006a_bi'; SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='llx_mjl_activity_rst006a_bu'; SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='llx_mjlfinancement_activity' AND INDEX_NAME='idx_rst006a_unexpected_rollback'", { scalar: true, signal: controller.signal })).trim().split(/\s+/);
		  if (JSON.stringify(rollbackUntouched) !== JSON.stringify(['0','1','1'])) throw new Error('RST-006A malformed Activity rollback prefix mutated the schema before refusal.');
		  await databaseSql(plan, 'ALTER TABLE llx_mjlfinancement_activity DROP INDEX idx_rst006a_unexpected_rollback', { signal: controller.signal });
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A'], { signal: controller.signal });
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], { signal: controller.signal });

		  for (const missingBase of [
		    { label:'index', drop:'ALTER TABLE llx_mjlfinancement_activity DROP INDEX idx_mjl_activity_entity_validation', restore:'ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjl_activity_entity_validation (entity,validation_status)' },
		    { label:'foreign key', drop:'ALTER TABLE llx_mjlfinancement_activity DROP FOREIGN KEY fk_mjl_activity_target_modifier', restore:'ALTER TABLE llx_mjlfinancement_activity ADD CONSTRAINT fk_mjl_activity_target_modifier FOREIGN KEY (fk_user_modif) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT' },
		  ]) {
		    await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A','--failure-point=rollback-001'], `RST-006A missing base ${missingBase.label} setup`, { signal: controller.signal });
		    await databaseSql(plan, missingBase.drop, { signal: controller.signal });
		    const beforeRefusal = await rst006aStructuralCounts(plan, controller.signal);
		    const refusal = await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A'], `RST-006A missing base ${missingBase.label}`, { signal: controller.signal });
		    if (!refusal.includes('Rollback requires the exact target or a known rollback prefix') || await rst006aStructuralCounts(plan, controller.signal) !== beforeRefusal) throw new Error(`RST-006A missing base ${missingBase.label} was not refused before mutation.`);
		    await databaseSql(plan, missingBase.restore, { signal: controller.signal });
		    await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A'], { signal: controller.signal });
		    await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], { signal: controller.signal });
		  }
		}
		const malformedPrefixes = selectedDdlPoint ? [] : [
		  { label: 'table-options', mutate: 'ALTER TABLE llx_mjlfinancement_activity_reference_sequence ENGINE=MyISAM', recover: 'ALTER TABLE llx_mjlfinancement_activity_reference_sequence ENGINE=InnoDB' },
		  { label: 'column-definition', mutate: 'ALTER TABLE llx_mjlfinancement_activity_reference_sequence MODIFY next_value BIGINT UNSIGNED NOT NULL', recover: 'ALTER TABLE llx_mjlfinancement_activity_reference_sequence MODIFY next_value BIGINT NOT NULL' },
		  { label: 'missing-index', mutate: 'ALTER TABLE llx_mjlfinancement_activity_reference_sequence DROP PRIMARY KEY', recover: 'ALTER TABLE llx_mjlfinancement_activity_reference_sequence ADD PRIMARY KEY (entity)' },
		  { label: 'check-body', mutate: 'ALTER TABLE llx_mjlfinancement_activity_reference_sequence DROP CONSTRAINT chk_mjl_activity_sequence_next, ADD CONSTRAINT chk_mjl_activity_sequence_next CHECK (next_value>=0)', recover: 'ALTER TABLE llx_mjlfinancement_activity_reference_sequence DROP CONSTRAINT chk_mjl_activity_sequence_next, ADD CONSTRAINT chk_mjl_activity_sequence_next CHECK (next_value>0)' },
		  { label: 'foreign-key-rule', mutate: 'ALTER TABLE llx_mjlfinancement_operation DROP FOREIGN KEY fk_mjl_operation_modifier; ALTER TABLE llx_mjlfinancement_operation ADD CONSTRAINT fk_mjl_operation_modifier FOREIGN KEY (fk_user_modif) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE CASCADE', recover: 'ALTER TABLE llx_mjlfinancement_operation DROP FOREIGN KEY fk_mjl_operation_modifier; ALTER TABLE llx_mjlfinancement_operation ADD CONSTRAINT fk_mjl_operation_modifier FOREIGN KEY (fk_user_modif) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT' },
		  { label: 'unexpected-index', mutate: 'ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_rst006a_unexpected (name)', recover: 'ALTER TABLE llx_mjlfinancement_activity DROP INDEX idx_rst006a_unexpected' },
		  { label: 'trigger-body', mutate: "DROP TRIGGER llx_mjl_operation_rst006a_bd; CREATE TRIGGER llx_mjl_operation_rst006a_bd BEFORE DELETE ON llx_mjlfinancement_operation FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='weakened'", recover: "DROP TRIGGER llx_mjl_operation_rst006a_bd; CREATE TRIGGER llx_mjl_operation_rst006a_bd BEFORE DELETE ON llx_mjlfinancement_operation FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL Operations are never physically deleted'" },
		];
		for (const scenario of malformedPrefixes) {
		  await databaseSql(plan, scenario.mutate, { signal: controller.signal });
		  const refusal = await expectComposeFailure(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], `RST-006A malformed ${scenario.label}`, { signal: controller.signal });
		  if (!refusal.includes('unknown predecessor state')) throw new Error(`RST-006A malformed ${scenario.label} was not refused before mutation.`);
		  await databaseSql(plan, scenario.recover, { signal: controller.signal });
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=apply','--confirm=RST-006A'], { signal: controller.signal });
		  await compose(plan, ['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_planning.php'], { signal: controller.signal });
		}
		if (!selectedDdlPoint) await runPlaywright(plan, layer, controller.signal);
      }
      else if (layer === 'phase3c') {
		await compose(plan, ['exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/export-integrity-probe.php'], {signal: controller.signal});
		await runPlaywright(plan, layer, controller.signal);
		await runPhase3cRestoreRehearsal(plan, restorePlan, controller.signal);
	  }
      else await runPlaywright(plan, layer, controller.signal);
    }
  } catch (error) {
    failure = error;
  } finally {
    failure = await finalizeDisposableRun({ plan, provisionAttempted, failure });
    if (secretRegistry) {
      try { await secretRegistry.close(); } catch (registryError) {
        failure = combineFailures(failure, registryError, 'Secret registry cleanup failed.');
      }
    }
    if ((mode === 'all' || mode === 'e2e' || mode === 'verify' || mode === 'rst002b' || mode === 'rst006a' || mode === 'phase2' || mode === 'phase3b' || mode === 'phase3c' || mode === 'vui03' || mode === 'vui04' || mode === 'vui05' || mode === 'vui06' || mode === 'vui07' || mode === 'vui08' || mode === 'phase3a' || mode === 'rst013a' || mode === 'rst014a') && sharedBefore && plan) {
      try {
        const sharedAfter = await captureSharedEvidence();
        const unit = mode.toUpperCase();
        if (JSON.stringify(sharedAfter) !== JSON.stringify(sharedBefore)) throw new Error(`${unit} changed shared filesystem, ECM, Admin, audit, schema, or database state.`);
        fs.writeFileSync(path.join(plan.artifactRoot, `${mode}-shared-evidence.json`), `${JSON.stringify({ before: sharedBefore, after: sharedAfter }, null, 2)}\n`, { mode: 0o600 });
      } catch (evidenceError) {
        failure = combineFailures(failure, evidenceError, `${mode.toUpperCase()} shared-state verification failed.`);
      }
      try {
        verifyArtifacts(plan.artifactRoot, secretEntries());
      } catch (scanError) {
        failure = combineFailures(failure, scanError, `${mode.toUpperCase()} artifact verification failed.`);
      }
    }
    if ((mode === 'rst013a-lifecycle-probe' || mode === 'rst014a-lifecycle-probe') && plan) {
      try { verifyArtifacts(plan.artifactRoot, secretEntries()); } catch (scanError) {
        failure = combineFailures(failure, scanError, `${mode.toUpperCase()} lifecycle artifact verification failed.`);
      }
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  process.stdout.write(`MJL ${mode} duration: ${seconds}s\n`);
  if (failure) throw failure;
  if (interrupted) {
    process.exitCode = interrupted === 'SIGINT' ? 130 : 143;
  }
}

if (require.main === module) {
  const entrypoint = process.argv[2] === 'diagnostics-worker' ? diagnosticsWorkerMain : main;
  entrypoint().catch((error) => {
    const details = error instanceof AggregateError
      ? `${error.stack || error.message}\n${error.errors.map((entry) => `${entry.stack || entry.message}${entry.output ? `\n${entry.output}` : ''}`).join('\n')}`
      : `${error.stack || error.message}${error.output ? `\n${error.output}` : ''}`;
    process.stderr.write(`${sanitizeOutput(details, allSecretValues())}\n`);
    process.exitCode = error.exitCode || 1;
  });
}

module.exports = { combineFailures, finalizeDisposableRun, protectedSourceDigest, runCommand, startSecretRegistry, verifyArtifacts };
