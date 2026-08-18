#!/usr/bin/env node

const fs = require('node:fs');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { assertCleanupComplete, assertDisposableConfig } = require('./disposable-policy');
const { createRunPlan, getSuitePlan, sanitizeOutput } = require('./disposable-run');

const repositoryRoot = path.resolve(__dirname, '../..');
const mode = process.argv[2] || 'all';
const layers = getSuitePlan(mode);
const needsTenant = layers.some((layer) => layer !== 'unit');
const retainedSecrets = [
  process.env.MJL_POC_DEFAULT_PASSWORD,
  process.env.DOLI_ADMIN_PASSWORD,
  process.env.MYSQL_ROOT_PASSWORD,
  process.env.MYSQL_PASSWORD,
].filter(Boolean);

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
    const outputChunks = [];

    const append = (chunk) => {
      outputChunks.push(Buffer.from(chunk));
    };
    if (child.stdout) child.stdout.on('data', append);
    if (child.stderr) child.stderr.on('data', append);
    if (child.stdin) child.stdin.end(options.input);

    const abort = () => child.kill('SIGTERM');
    if (options.signal) {
      if (options.signal.aborted) abort();
      else options.signal.addEventListener('abort', abort, { once: true });
    }

    child.once('error', reject);
    child.once('close', (code, signal) => {
      const output = Buffer.concat(outputChunks).toString('utf8');
      if (options.signal) options.signal.removeEventListener('abort', abort);
      if (code === 0) {
        resolve(output);
        return;
      }
      const error = new Error(`${command} ${args.join(' ')} failed with ${signal || `exit ${code}`}.`);
      error.exitCode = code;
      error.output = output;
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
    MJL_PLAYWRIGHT_OUTPUT_DIR: path.join(plan.artifactRoot, 'playwright'),
  };
}

async function compose(plan, args, options = {}) {
  return runCommand('docker', ['compose', ...args], {
    ...options,
    env: composeEnvironment(plan, options.sourceRoot),
  });
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function databaseDump(plan, signal) {
  const password = process.env.MYSQL_PASSWORD || 'poc_pwd';
  return compose(plan, ['exec', '-T', 'mariadb', 'mariadb-dump', '-udolidbuser', `-p${password}`, '--skip-comments', '--skip-extended-insert', '--order-by-primary', 'dolidb'], { quiet: true, signal });
}

async function runPhase1CutoverRehearsal(plan, signal) {
  const baselineCommit = 'dc6f0becbd45c7676cccec2ac42b9374b8e61101';
  const baselineRoot = path.join(plan.artifactRoot, 'pre-cutover-source');
  const sourceArchive = path.join(plan.artifactRoot, 'pre-cutover-source.tar');
  fs.mkdirSync(baselineRoot, { recursive: true });
  await runCommand('git', ['archive', '--format=tar', `--output=${sourceArchive}`, baselineCommit], { signal });
  await runCommand('tar', ['-xf', sourceArchive, '-C', baselineRoot], { signal });

  await compose(plan, ['up', '-d'], { sourceRoot: baselineRoot, signal });
  await waitUntilReady(plan, signal);
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { sourceRoot: baselineRoot, quiet: true, signal });

  const baselineDump = path.join(plan.artifactRoot, 'pre-cutover-database.sql');
  const metadata = path.join(plan.artifactRoot, 'pre-cutover-schema-metadata.txt');
  const documentsManifest = path.join(plan.artifactRoot, 'pre-cutover-documents.txt');
  fs.writeFileSync(baselineDump, await databaseDump(plan, signal), { mode: 0o600 });
  const password = process.env.MYSQL_PASSWORD || 'poc_pwd';
  const metadataSql = "SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COALESCE(COLUMN_DEFAULT,'<NULL>'),EXTRA,GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION; SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,EVENT_OBJECT_TABLE,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY TRIGGER_NAME; SELECT name,value,entity FROM llx_const WHERE name LIKE 'MAIN_MODULE_%' OR name LIKE 'MJL_%' ORDER BY name,entity";
  fs.writeFileSync(metadata, await compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', `-p${password}`, '-N', '-B', 'dolidb', '-e', metadataSql], { sourceRoot: baselineRoot, quiet: true, signal }), { mode: 0o600 });
  fs.writeFileSync(documentsManifest, await compose(plan, ['exec', '-T', 'dolibarr', 'find', '/var/www/documents', '-type', 'f', '-printf', '%P\t%s\n'], { sourceRoot: baselineRoot, quiet: true, signal }), { mode: 0o600 });

  await compose(plan, ['exec', '-T', 'dolibarr', 'mkdir', '-p', '/var/www/documents/rst-phase1-evidence'], { sourceRoot: baselineRoot, quiet: true, signal });
  const evidenceFiles = [sourceArchive, baselineDump, metadata, documentsManifest];
  for (const file of evidenceFiles) await compose(plan, ['cp', file, `dolibarr:/var/www/documents/rst-phase1-evidence/${path.basename(file)}`], { sourceRoot: baselineRoot, quiet: true, signal });
  const artifact = (file) => ({ path: `/var/www/documents/rst-phase1-evidence/${path.basename(file)}`, sha256: sha256File(file) });
  const manifestData = {
    baseline_commit: baselineCommit,
    source: artifact(sourceArchive),
    database: artifact(baselineDump),
    schema_metadata: artifact(metadata),
    documents_manifest: artifact(documentsManifest),
  };
  const evidenceManifest = path.join(plan.artifactRoot, 'cutover-evidence.json');
  fs.writeFileSync(evidenceManifest, `${JSON.stringify(manifestData, null, 2)}\n`, { mode: 0o600 });
  await compose(plan, ['cp', evidenceManifest, 'dolibarr:/var/www/documents/rst-phase1-evidence/cutover-evidence.json'], { sourceRoot: baselineRoot, quiet: true, signal });
  await compose(plan, ['cp', baselineDump, 'mariadb:/tmp/rst-phase1-baseline.sql'], { sourceRoot: baselineRoot, quiet: true, signal });
  await compose(plan, ['stop', 'dolibarr'], { sourceRoot: baselineRoot, signal });

  const manifestPath = '/var/www/documents/rst-phase1-evidence/cutover-evidence.json';
  const manifestHash = sha256File(evidenceManifest);
  const authorization = 'RST-007A,RST-004,RST-008,RST-009A';
  const resetArgs = (modeName, extra = [], environment = []) => ['run', '--rm', '--no-deps', ...environment.flatMap((value) => ['-e', value]), '-e', 'MJL_RST_PHASE1_TRAFFIC_STOPPED=1', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst_phase1_reset.php', `--mode=${modeName}`, `--confirm=${authorization}`, `--evidence-manifest=${manifestPath}`, `--evidence-sha256=${manifestHash}`, ...extra];
  const sql = async (statement) => compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', `-p${password}`, 'dolidb', '-e', statement], { quiet: true, signal });
  const restoreBaseline = async () => {
    const rootPassword = process.env.MYSQL_ROOT_PASSWORD || 'poc_root_pwd';
    await compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '-uroot', `-p${rootPassword}`, '-e', "DROP DATABASE dolidb; CREATE DATABASE dolidb CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci; GRANT ALL PRIVILEGES ON dolidb.* TO 'dolidbuser'@'%'; FLUSH PRIVILEGES"], { quiet: true, signal });
    await compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', `-p${password}`, 'dolidb'], { input: fs.readFileSync(baselineDump), quiet: true, signal });
    const restored = await databaseDump(plan, signal);
    if (crypto.createHash('sha256').update(restored).digest('hex') !== sha256File(baselineDump)) {
      fs.writeFileSync(path.join(plan.artifactRoot, 'restore-mismatch.sql'), restored, { mode: 0o600 });
      throw new Error('Full backup restore did not reproduce the pre-cutover database exactly.');
    }
  };
  const activateCurrent = async () => compose(plan, ['run', '--rm', '--no-deps', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { quiet: true, signal });

  await expectComposeFailure(plan, ['run', '--rm', '--no-deps', '-e', 'MJL_RST_PHASE1_TRAFFIC_STOPPED=1', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/rst_phase1_reset.php', '--mode=apply', `--confirm=${authorization}`, `--evidence-manifest=${manifestPath}`, `--evidence-sha256=${'0'.repeat(64)}`], 'bad evidence', { signal });
  const afterBadEvidence = await databaseDump(plan, signal);
  if (crypto.createHash('sha256').update(afterBadEvidence).digest('hex') !== sha256File(baselineDump)) {
    fs.writeFileSync(path.join(plan.artifactRoot, 'bad-evidence-mismatch.sql'), afterBadEvidence, { mode: 0o600 });
    throw new Error('Bad evidence mutated the database.');
  }

  await sql("INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_RST_PHASE1_FAILURE_INJECTION','1','chaine',0,'disposable rehearsal',0) ON DUPLICATE KEY UPDATE value='1'");
  await expectComposeFailure(plan, resetArgs('apply', ['--failure-point=after-activity-alter'], ['MJL_DISPOSABLE_TEST_TENANT=1']), 'interrupted apply', { signal });
  await compose(plan, resetArgs('rollback'), { signal });
  await restoreBaseline();

  await compose(plan, resetArgs('apply'), { quiet: true, signal });
  await compose(plan, resetArgs('rollback'), { signal });
  await restoreBaseline();

  await compose(plan, resetArgs('apply'), { quiet: true, signal });
  await activateCurrent();
  await compose(plan, resetArgs('rollback'), { signal });
  await restoreBaseline();

  await compose(plan, resetArgs('apply'), { quiet: true, signal });
  await activateCurrent();
  await activateCurrent();
  await compose(plan, resetArgs('finalize'), { quiet: true, signal });
  await compose(plan, ['up', '-d', '--force-recreate', 'dolibarr'], { signal });
  await waitUntilReady(plan, signal);
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
  const password = process.env.MYSQL_PASSWORD || 'poc_pwd';
  const client = ['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', `-p${password}`, 'dolidb', '-e'];
  const verifier = ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/verify_phase1_schema_exact.php'];
  const probes = [
    {
      label: 'index mutation',
      mutate: 'ALTER TABLE llx_mjlfinancement_invitation DROP INDEX idx_mjl_invitation_status',
      restore: 'ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjl_invitation_status (entity,status)',
    },
    {
      label: 'foreign-key mutation',
      mutate: 'ALTER TABLE llx_mjlfinancement_password_reset DROP FOREIGN KEY fk_mjl_reset_target_user',
      restore: 'ALTER TABLE llx_mjlfinancement_password_reset ADD CONSTRAINT fk_mjl_reset_target_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid)',
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
      label: 'trigger mutation',
      mutate: "CREATE OR REPLACE TRIGGER llx_mjlfinancement_audit_event_bu BEFORE UPDATE ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='mutated'",
      restore: "CREATE OR REPLACE TRIGGER llx_mjlfinancement_audit_event_bu BEFORE UPDATE ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL audit events are append-only'",
    },
  ];
  for (const probe of probes) {
    await compose(plan, [...client, probe.mutate], { quiet: true, signal });
    try {
      await expectComposeFailure(plan, verifier, probe.label, { signal });
    } finally {
      await compose(plan, [...client, probe.restore], { quiet: true, signal });
    }
    await compose(plan, verifier, { quiet: true, signal });
  }
}

async function runRst003RollbackRehearsal(plan, signal) {
  const password = process.env.MYSQL_PASSWORD || 'poc_pwd';
  const client = ['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', `-p${password}`, 'dolidb', '-e'];
  let renamed = false;
  try {
    await compose(plan, [...client, 'RENAME TABLE llx_mjlfinancement_operation_type TO llx_mjlfinancement_operation_type_rst003_rollback'], { quiet: true, signal });
    renamed = true;
    const absent = await compose(plan, [...client, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='llx_mjlfinancement_operation_type'"], { quiet: true, signal });
    if (!/\b0\b/.test(absent)) throw new Error('RST-003 rollback rehearsal did not remove the target table boundary.');
  } finally {
    if (renamed) await compose(plan, [...client, 'RENAME TABLE llx_mjlfinancement_operation_type_rst003_rollback TO llx_mjlfinancement_operation_type'], { quiet: true, signal });
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
	args.push('tests/e2e/phase1-reset.spec.js', 'tests/e2e/auth-concurrency.spec.js', '--config=playwright.config.js');
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
  await compose(plan, ['down', '-v', '--remove-orphans']);
  assertCleanupComplete(await projectResources(plan), plan.projectName);
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
    `  cleanup: COMPOSE_PROJECT_NAME=${plan.projectName} COMPOSE_FILE=${composeFiles} docker compose down -v --remove-orphans`,
    '',
  ].join('\n'));
}

async function main() {
  const started = Date.now();
  const controller = new AbortController();
  let interrupted = null;
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(signal, () => {
      interrupted = signal;
      controller.abort();
    });
  }

  let plan = null;
  let provisionAttempted = false;
  let failure = null;
  try {
    if (needsTenant) {
      plan = createRunPlan({ repositoryRoot, port: await allocatePort() });
      fs.mkdirSync(plan.artifactRoot, { recursive: true });
      process.stdout.write(`Disposable MJL project: ${plan.projectName}\nURL: ${plan.baseUrl}\n`);
    }

    for (const layer of layers) {
      if (layer === 'unit') {
        await runUnit(controller.signal);
        continue;
      }
      if (!provisionAttempted) {
        provisionAttempted = true;
        if (mode === 'phase1-reset') await runPhase1CutoverRehearsal(plan, controller.signal);
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
		if (mode === 'phase1-reset') {
			if (layer === 'rst009a') await runPlaywright(plan, 'phase1-all', controller.signal);
		} else {
			await runPlaywright(plan, layer, controller.signal);
		}
      }
      else if (layer === 'production-readiness') await runProductionReadiness(plan, controller.signal);
      else await runPlaywright(plan, layer, controller.signal);
    }
  } catch (error) {
    failure = error;
  } finally {
    if (plan && provisionAttempted) {
      await captureDiagnostics(plan);
      if (failure && process.env.MJL_TEST_RETAIN === '1') {
        printRetainedRun(plan);
      } else {
        try {
          await cleanup(plan);
        } catch (cleanupError) {
          failure = failure || cleanupError;
          if (failure !== cleanupError) process.stderr.write(`${cleanupError.stack || cleanupError}\n`);
        }
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

main().catch((error) => {
  process.stderr.write(`${sanitizeOutput(error.stack || error.message, retainedSecrets)}\n`);
  process.exitCode = error.exitCode || 1;
});
