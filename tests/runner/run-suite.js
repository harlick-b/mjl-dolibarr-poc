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

function bounded(promise, milliseconds, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out.`)), milliseconds); }),
  ]).finally(() => clearTimeout(timer));
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
      stdio: options.input !== undefined ? ['pipe', options.quiet ? 'pipe' : 'inherit', options.quiet ? 'pipe' : 'inherit'] : (options.quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit']),
    });
    const stdoutChunks = [];
    const stderrChunks = [];

    if (child.stdout) child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    if (child.stderr) child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)));
    if (child.stdin) child.stdin.end(options.input);

    const abort = () => child.kill('SIGTERM');
    if (options.signal) {
      if (options.signal.aborted) abort();
      else options.signal.addEventListener('abort', abort, { once: true });
    }

    child.once('error', reject);
    child.once('close', (code, signal) => {
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      const output = options.binary ? stdout : stdout.toString('utf8');
      if (options.signal) options.signal.removeEventListener('abort', abort);
      if (code === 0) {
        resolve(output);
        return;
      }
      const error = new Error(`${command} ${args.join(' ')} failed with ${signal || `exit ${code}`}.`);
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
    MJL_DISPOSABLE_RUN_SENTINEL: plan.sentinel,
    MJL_TEST_USER_PASSWORD: plan.testUserPassword,
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

async function provision(plan, signal) {
  const resolved = await compose(plan, ['config', '--format', 'json'], { quiet: true, signal });
  assertDisposableConfig(JSON.parse(resolved), plan);
  await compose(plan, ['up', '-d'], { signal });
  await waitUntilReady(plan, signal);
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { quiet: true, signal });
  await compose(plan, ['exec', '-T', 'dolibarr', 'chown', '-R', 'www-data:www-data', '/var/www/documents'], { quiet: true, signal });
  await compose(plan, ['exec', '-T', 'mariadb', 'sh', '-ceu', 'umask 077; mkdir -p /run/mjl-test; target=/run/mjl-test/client.cnf; temporary=/run/mjl-test/client.cnf.new; printf "[client]\\nuser=%s\\npassword=%s\\n[client_root]\\nuser=root\\npassword=%s\\n" "$MYSQL_USER" "$MYSQL_PASSWORD" "$MYSQL_ROOT_PASSWORD" > "$temporary"; chmod 0600 "$temporary"; mv "$temporary" "$target"'], { quiet: true, signal });
  await compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', 'dolidb'], { quiet: true, signal, input: "INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_DISPOSABLE_FIXTURE_SENTINEL',UUID(),'chaine',0,'disposable fixture attestation',0); UPDATE llx_const SET value='" + plan.sentinel + "' WHERE name='MJL_DISPOSABLE_FIXTURE_SENTINEL' AND entity=0;\n" });
  await compose(plan, ['exec', '-T', 'dolibarr', 'sh', '-ceu', 'sentinel=/var/www/documents/.mjl-disposable-fixture-sentinel; umask 0222; printf %s "$MJL_DISPOSABLE_RUN_SENTINEL" > "$sentinel"; chown root:root "$sentinel"; chmod 0444 "$sentinel"; test "$(stat -c %u:%a "$sentinel")" = 0:444'], { quiet: true, signal });
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
  } else if (['rst007a', 'rst004', 'rst008', 'rst009a'].includes(target)) {
	args.push('tests/e2e/phase1-reset.spec.js', ...(target === 'rst008' ? ['tests/e2e/auth-concurrency.spec.js'] : []), '--config=playwright.config.js');
    const tags = { rst007a: 'RST-007A', rst004: 'RST-004', rst008: 'RST-008', rst009a: 'RST-009A' };
    args.push('--grep', `\\[${tags[target]}\\]`);
  } else if (target === 'characterization') {
    args.push('--config=tests/characterization/playwright.config.js');
  } else {
    args.push('--config=tests/manual/playwright.config.js', '--debug');
  }
  await runCommand('npx', args, { env: composeEnvironment(plan), signal });
}

async function captureDiagnostics(plan) {
  fs.mkdirSync(plan.artifactRoot, { recursive: true });
  const chunks = [];
  for (const args of [['ps', '-a'], ['logs', '--no-color', '--timestamps']]) {
    try {
      chunks.push(await compose(plan, args, { quiet: true }));
    } catch (error) {
      chunks.push(error.output || error.message);
    }
  }
  fs.writeFileSync(
    path.join(plan.artifactRoot, 'compose.log'),
    sanitizeOutput(chunks.join('\n'), retainedSecrets),
    { mode: 0o600 },
  );
}

async function captureSharedEvidence(signal) {
  const source = fs.readFileSync(path.join(repositoryRoot, 'tests/fixtures/database-evidence.php'));
  const sharedEnvironment = { ...process.env };
  for (const key of ['COMPOSE_PROJECT_NAME', 'COMPOSE_FILE', 'MJL_BASE_URL', 'MJL_TEST_PORT', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_TEST_USER_PASSWORD']) delete sharedEnvironment[key];
  const database = JSON.parse(await runCommand('docker', ['compose', '-f', path.join(repositoryRoot, 'docker-compose.yml'), 'exec', '-T', 'dolibarr', 'php'], {
    quiet: true,
    input: source,
    env: sharedEnvironment,
    signal,
  }));
  if (database.disposable_control_count !== 0 || database.disposable_file_sentinel_present) throw new Error('Shared tenant contains disposable fixture controls.');
  const protectedPaths = ['custom', 'docs', 'tests', 'AGENTS.md', 'CONTEXT.md', 'DESIGN.md', 'README.md', 'docker-compose.yml', 'package.json', 'package-lock.json', 'playwright.config.js'];
  const sourceHash = crypto.createHash('sha256');
  for (const relative of protectedPaths) {
    const absolute = path.join(repositoryRoot, relative);
    const stat = fs.lstatSync(absolute);
    sourceHash.update(`${relative}\0${stat.mode & 0o7777}\0`);
    if (stat.isDirectory()) sourceHash.update(streamTreeDigest(absolute));
    else sourceHash.update(fs.readFileSync(absolute));
  }
  const project = path.basename(repositoryRoot);
  const filter = `label=com.docker.compose.project=${project}`;
  const [containers, networks, volumes] = await Promise.all([
    runCommand('docker', ['ps', '-a', '--filter', filter, '--format', '{{.Names}}'], { quiet: true, signal }),
    runCommand('docker', ['network', 'ls', '--filter', filter, '--format', '{{.Name}}'], { quiet: true, signal }),
    runCommand('docker', ['volume', 'ls', '--filter', filter, '--format', '{{.Name}}'], { quiet: true, signal }),
  ]);
  const names = (value) => value.split('\n').map((entry) => entry.trim()).filter(Boolean).sort();
  return Object.freeze({
    protected_source_sha256: sourceHash.digest('hex'),
    documents_sha256: database.documents_sha256,
    database,
    resources: { containers: names(containers), networks: names(networks), volumes: names(volumes) },
  });
}

async function projectResources(plan) {
  const filter = `label=com.docker.compose.project=${plan.projectName}`;
  const [containers, networks, volumes] = await Promise.all([
    runCommand('docker', ['ps', '-a', '--filter', filter, '--format', '{{.Names}}'], { quiet: true }),
    runCommand('docker', ['network', 'ls', '--filter', filter, '--format', '{{.Name}}'], { quiet: true }),
    runCommand('docker', ['volume', 'ls', '--filter', filter, '--format', '{{.Name}}'], { quiet: true }),
  ]);
  const lines = (value) => value.split('\n').map((line) => line.trim()).filter(Boolean);
  return { containers: lines(containers), networks: lines(networks), volumes: lines(volumes) };
}

async function cleanup(plan) {
  let lastFailure;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await compose(plan, ['exec', '-T', 'mariadb', 'sh', '-c', 'rm -f /run/mjl-test/client.cnf'], { quiet: true }).catch(() => {});
      await bounded(compose(plan, ['down', '-v', '--remove-orphans']), 30000, 'Disposable teardown');
      assertCleanupComplete(await bounded(projectResources(plan), 10000, 'Disposable resource enumeration'), plan.projectName);
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

async function finalizeDisposableRun({ plan, provisionAttempted, failure, runMode = mode, environment = process.env, capture = captureDiagnostics, remove = cleanup, retain = printRetainedRun }) {
  if (!plan || !provisionAttempted) return failure;
  try {
    await bounded(capture(plan), 10000, 'Diagnostics capture');
  } catch (diagnosticsError) {
    failure = combineFailures(failure, diagnosticsError, 'Test execution and diagnostics capture failed.');
  }
  const shouldRetain = failure && environment.MJL_TEST_RETAIN === '1' && !['phase1-reset', 'rst014a'].includes(runMode);
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
  try {
    if (mode === 'rst014a') sharedBefore = await captureSharedEvidence(controller.signal);
    if (needsTenant) {
      plan = createRunPlan({ repositoryRoot, port: await allocatePort() });
      fs.mkdirSync(plan.artifactRoot, { recursive: true, mode: 0o700 });
      process.stdout.write(`Disposable MJL project: ${plan.projectName}\nURL: ${plan.baseUrl}\n`);
    }

    for (const layer of layers) {
      if (layer === 'unit') {
        await runUnit(controller.signal);
        continue;
      }
      if (!provisionAttempted) {
        provisionAttempted = true;
        if (mode === 'phase1-reset') await runPhase1Cutover({
          plan,
          signal: controller.signal,
          repositoryRoot,
          runCommand,
          compose,
          waitUntilReady,
          expectComposeFailure,
          assertDisposableConfig,
        });
        else await provision(plan, controller.signal);
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
      else if (layer === 'production-readiness') await runProductionReadiness(plan, controller.signal);
      else await runPlaywright(plan, layer, controller.signal);
    }
  } catch (error) {
    failure = error;
  } finally {
    failure = await finalizeDisposableRun({ plan, provisionAttempted, failure });
    if (mode === 'rst014a' && sharedBefore && plan) {
      try {
        const sharedAfter = await captureSharedEvidence();
        if (JSON.stringify(sharedAfter) !== JSON.stringify(sharedBefore)) throw new Error('RST-014A changed shared filesystem, ECM, Admin, audit, schema, or database state.');
        fs.writeFileSync(path.join(plan.artifactRoot, 'rst014a-shared-evidence.json'), `${JSON.stringify({ before: sharedBefore, after: sharedAfter }, null, 2)}\n`, { mode: 0o600 });
      } catch (evidenceError) {
        failure = combineFailures(failure, evidenceError, 'RST-014A shared-state verification failed.');
      }
      try {
        hardenArtifactPermissions(plan.artifactRoot);
        const secrets = [
          ...retainedSecrets.map((value) => ({ category: 'configured credential', value })),
          { category: 'disposable credential', value: plan.testUserPassword },
          { category: 'disposable sentinel', value: plan.sentinel },
        ];
        const hits = scanArtifacts(plan.artifactRoot, secrets);
        if (hits.length) throw new Error(`Contaminated artifacts were removed: ${hits.map((hit) => `${hit.path} (${hit.category})`).join(', ')}`);
      } catch (scanError) {
        try { fs.rmSync(plan.artifactRoot, { recursive: true, force: true }); } catch (_) {}
        failure = combineFailures(failure, scanError, 'RST-014A artifact verification failed.');
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
  main().catch((error) => {
    const details = error instanceof AggregateError ? `${error.stack || error.message}\n${error.errors.map((entry) => entry.stack || entry.message).join('\n')}` : (error.stack || error.message);
    process.stderr.write(`${sanitizeOutput(details, retainedSecrets)}\n`);
    process.exitCode = error.exitCode || 1;
  });
}

module.exports = { combineFailures, finalizeDisposableRun };
