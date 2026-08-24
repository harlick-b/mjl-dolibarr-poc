#!/usr/bin/env node

const fs = require('node:fs');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { assertCleanupComplete, assertDisposableConfig } = require('./disposable-policy');
const { createRunPlan, getSuitePlan, sanitizeOutput } = require('./disposable-run');
const { scanArtifacts, streamTreeDigest } = require('./disposable-evidence');
const { runPhase1CutoverRehearsal: runPhase1Cutover } = require('./phase1-cutover-rehearsal');
const { runRst005CutoverRehearsal } = require('./rst005-cutover-rehearsal');
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
      if (code === 0) {
        resolve(output);
        return;
      }
      const error = new Error(timedOut ? `${command} timed out.` : `${command} failed with ${signal || `exit ${code}`}.`);
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
  await compose(plan, ['exec', '-T', 'mariadb', 'sh', '-ceu', 'umask 077; mkdir -p /run/mjl-test; target=/run/mjl-test/client.cnf; temporary=/run/mjl-test/client.cnf.new; printf "[client]\\nuser=%s\\npassword=%s\\n[client_root]\\nuser=root\\npassword=%s\\n" "$MYSQL_USER" "$MYSQL_PASSWORD" "$MYSQL_ROOT_PASSWORD" > "$temporary"; chmod 0600 "$temporary"; mv "$temporary" "$target"'], { quiet: true, signal });
  await compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', 'dolidb'], { quiet: true, signal, input: "INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_DISPOSABLE_FIXTURE_SENTINEL',UUID(),'chaine',0,'disposable fixture attestation',0); UPDATE llx_const SET value='" + plan.sentinel + "' WHERE name='MJL_DISPOSABLE_FIXTURE_SENTINEL' AND entity=0;\n" });
  await compose(plan, ['exec', '-T', 'dolibarr', 'sh', '-ceu', 'sentinel=/var/www/documents/.mjl-disposable-fixture-sentinel; umask 0222; printf %s "$MJL_DISPOSABLE_RUN_SENTINEL" > "$sentinel"; chown root:root "$sentinel"; chmod 0444 "$sentinel"; test "$(stat -c %u:%a "$sentinel")" = 0:444'], { quiet: true, signal });
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

const verificationScripts = ['verify_phase1_reset.php'];

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

async function runPhase1SchemaMutationRehearsal(plan, signal) {
  const verifier = ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verify_phase1_schema_exact.php'];
  const probes = [
    {
      label: 'engine mutation',
      mutate: 'ALTER TABLE llx_mjlfinancement_audit_event ENGINE=Aria',
      restore: 'ALTER TABLE llx_mjlfinancement_audit_event ENGINE=InnoDB',
    },
    {
      label: 'index mutation',
      mutate: 'ALTER TABLE llx_mjlfinancement_invitation DROP INDEX idx_mjl_invitation_status, ADD INDEX idx_mjl_invitation_status (entity,status(8))',
      restore: 'ALTER TABLE llx_mjlfinancement_invitation DROP INDEX idx_mjl_invitation_status, ADD INDEX idx_mjl_invitation_status (entity,status)',
    },
    {
      label: 'foreign-key mutation',
      mutate: 'ALTER TABLE llx_mjlfinancement_password_reset DROP FOREIGN KEY fk_mjl_reset_target_user',
      restore: 'ALTER TABLE llx_mjlfinancement_password_reset ADD CONSTRAINT fk_mjl_reset_target_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid) ON DELETE RESTRICT ON UPDATE RESTRICT',
    },
    {
      label: 'check mutation',
      mutate: 'ALTER TABLE llx_mjlfinancement_invitation DROP CONSTRAINT chk_mjl_invitation_terminal_date',
      restore: "ALTER TABLE llx_mjlfinancement_invitation ADD CONSTRAINT chk_mjl_invitation_terminal_date CHECK ((status IN ('pending_send','sent') AND date_accepted IS NULL AND date_revoked IS NULL) OR (status='accepted' AND date_accepted IS NOT NULL) OR (status IN ('revoked','send_failed') AND date_revoked IS NOT NULL))",
    },
    {
      label: 'generated-column mutation',
      mutate: "ALTER TABLE llx_mjlfinancement_password_reset DROP INDEX uk_mjl_reset_live_user, MODIFY live_user_id INTEGER AS (CASE WHEN status='sent' THEN fk_user ELSE NULL END) PERSISTENT, ADD UNIQUE INDEX uk_mjl_reset_live_user (entity,live_user_id)",
      restore: "ALTER TABLE llx_mjlfinancement_password_reset DROP INDEX uk_mjl_reset_live_user, MODIFY live_user_id INTEGER AS (CASE WHEN status IN ('pending_send','sent') THEN fk_user ELSE NULL END) PERSISTENT, ADD UNIQUE INDEX uk_mjl_reset_live_user (entity,live_user_id)",
    },
    {
      label: 'collation mutation',
      mutate: 'ALTER TABLE llx_mjlfinancement_audit_event MODIFY object_type VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL',
      restore: 'ALTER TABLE llx_mjlfinancement_audit_event MODIFY object_type VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL',
    },
    {
      label: 'trigger mutation',
      mutate: "CREATE OR REPLACE TRIGGER llx_mjlfinancement_audit_event_bu BEFORE UPDATE ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='mutated'",
      restore: "CREATE OR REPLACE TRIGGER llx_mjlfinancement_audit_event_bu BEFORE UPDATE ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL audit events are append-only'",
    },
    {
      label: 'unexpected-trigger mutation',
      mutate: 'CREATE TRIGGER phase1_unexpected_trigger AFTER INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SET @phase1_unexpected_trigger=1',
      restore: 'DROP TRIGGER phase1_unexpected_trigger',
    },
  ];
  for (const probe of probes) {
    await databaseSql(plan, probe.mutate, { quiet: true, signal });
    try {
      await expectComposeFailure(plan, verifier, probe.label, { signal });
    } finally {
      await databaseSql(plan, probe.restore, { quiet: true, signal });
    }
    await compose(plan, verifier, { quiet: true, signal });
  }
}

async function runPhase1FailpointConstantRehearsal(plan, signal) {
  const verifier = ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verify_phase1_reset.php'];
  const probes = [
    ['MJL_RST_PHASE1_FAILURE_INJECTION', 0],
    ['MJL_RST_PHASE1_ACTIVATION_FAILURE_INJECTION', 7],
  ];
  for (const [name, entity] of probes) {
    await databaseSql(plan, `INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('${name}','1','chaine',0,'disposable verifier mutation',${entity})`, { quiet: true, signal });
    try {
      const output = await expectComposeFailure(plan, verifier, `${name} survival mutation`, { signal });
      if (!/failure-injection constant remains/i.test(output)) throw new Error(`${name} verifier mutation failed for the wrong reason: ${output.trim()}`);
    } finally {
      await databaseSql(plan, `DELETE FROM llx_const WHERE name='${name}'`, { quiet: true, signal });
    }
    await compose(plan, verifier, { quiet: true, signal });
  }
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

async function runProductionReadiness(plan, signal) {
  await compose(plan, [
    'exec',
    '-T',
    'dolibarr',
    'php',
    '/var/www/html/custom/mjlfinancement/scripts/check_production_readiness.php',
  ], { signal });
}

async function runPlaywright(plan, target, signal) {
  const args = ['playwright', 'test'];
  if (target === 'e2e') {
    args.push('--config=playwright.config.js');
  } else if (target === 'rst003') {
    args.push('tests/e2e/partners-projects.spec.js', '--config=playwright.config.js');
  } else if (target === 'phase1-all') {
	args.push('tests/e2e/phase1-reset.spec.js', 'tests/e2e/auth-concurrency.spec.js', 'tests/e2e/document-containment.spec.js', '--config=playwright.config.js');
  } else if (target === 'rst010a') {
	args.push('tests/e2e/document-containment.spec.js', '--config=playwright.config.js');
  } else if (target === 'rst014a') {
    args.push('tests/e2e/fixture-isolation.spec.js', 'tests/e2e/phase1-reset.spec.js', 'tests/e2e/auth-concurrency.spec.js', 'tests/e2e/partners-projects.spec.js', 'tests/e2e/document-containment.spec.js', '--config=playwright.config.js');
  } else if (target === 'rst013a') {
    args.push('tests/e2e/phase1-reset.spec.js', '--config=playwright.config.js', '--grep', '\\[RST-013A\\]');
  } else if (target === 'rst005') {
    args.push('tests/e2e/rst005-activity-foundation.spec.js', 'tests/e2e/document-containment.spec.js', '--config=playwright.config.js');
  } else if (['rst007a', 'rst004', 'rst008', 'rst009a'].includes(target)) {
	args.push('tests/e2e/phase1-reset.spec.js', ...(target === 'rst008' ? ['tests/e2e/auth-concurrency.spec.js'] : []), '--config=playwright.config.js');
    const tags = { rst007a: 'RST-007A', rst004: 'RST-004', rst008: 'RST-008', rst009a: 'RST-009A' };
    args.push('--grep', `\\[${tags[target]}\\]`);
  } else if (target === 'characterization') {
    args.push('--config=tests/characterization/playwright.config.js');
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
  const shouldRetain = failure && environment.MJL_TEST_RETAIN === '1' && runMode !== 'phase1-reset'
	&& !runMode.startsWith('rst005')
    && !runMode.startsWith('rst013a')
    && !runMode.startsWith('rst014a');
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
  let provisionAttempted = false;
  let failure = null;
  let sharedBefore = null;
  let secretRegistry = null;
  const parentRegistry = (process.env.MJL_SECRET_REGISTRY_PORT || process.env.MJL_SECRET_REGISTRY_CAPABILITY)
    ? { port: process.env.MJL_SECRET_REGISTRY_PORT, capability: process.env.MJL_SECRET_REGISTRY_CAPABILITY }
    : null;
  try {
    if (mode === 'rst005' || mode === 'rst013a' || mode === 'rst014a') sharedBefore = await captureSharedEvidence(controller.signal);
    if (needsTenant) {
      plan = createRunPlan({ repositoryRoot, port: await allocatePort() });
      fs.mkdirSync(plan.artifactRoot, { recursive: true, mode: 0o700 });
      const initialSecrets = [
        ['disposable credential', plan.testUserPassword],
        ['disposable sentinel', plan.sentinel],
        ['secret registry capability', plan.secretRegistryCapability],
        ...plan.lifecyclePasswords.map((password) => ['lifecycle credential', password]),
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
        } else if (mode === 'phase1-reset') {
          await runPhase1Cutover({
            plan,
            signal: controller.signal,
            repositoryRoot,
            runCommand,
            compose,
            waitUntilReady,
            expectComposeFailure,
            assertDisposableConfig,
          });
          await runRst005CutoverRehearsal({ plan, signal: controller.signal, repositoryRoot, compose, databaseSql });
          await provisionDisposableFixtureControls(plan, controller.signal);
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
      else if (['rst007a', 'rst004', 'rst008', 'rst009a'].includes(layer)) {
        await runPhase1Verification(plan, controller.signal);
		if (mode === 'phase1-reset' && layer === 'rst007a') await runPhase1SchemaMutationRehearsal(plan, controller.signal);
		if (mode === 'phase1-reset' && layer === 'rst007a') await runPhase1FailpointConstantRehearsal(plan, controller.signal);
		if (mode !== 'phase1-reset') await runPlaywright(plan, layer, controller.signal);
      }
      else if (layer === 'rst010a') {
        await runPhase1Verification(plan, controller.signal);
        await runPlaywright(plan, mode === 'phase1-reset' ? 'phase1-all' : layer, controller.signal);
      }
      else if (layer === 'rst014a') {
        await runPhase1Verification(plan, controller.signal);
        await runPlaywright(plan, layer, controller.signal);
      }
      else if (layer === 'rst013a') {
        await runPhase1Verification(plan, controller.signal);
        await runPlaywright(plan, layer, controller.signal);
      }
      else if (layer === 'rst005') {
        await runRst005CutoverRehearsal({ plan, signal: controller.signal, repositoryRoot, compose, databaseSql });
        await runPhase1Verification(plan, controller.signal);
        await runPlaywright(plan, layer, controller.signal);
      }
      else if (layer === 'production-readiness') await runProductionReadiness(plan, controller.signal);
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
    if ((mode === 'rst005' || mode === 'rst013a' || mode === 'rst014a') && sharedBefore && plan) {
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
