#!/usr/bin/env node

const fs = require('node:fs');
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
      stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
    });
    let output = '';

    const append = (chunk) => {
      const text = chunk.toString();
      output += text;
    };
    if (child.stdout) child.stdout.on('data', append);
    if (child.stderr) child.stderr.on('data', append);

    const abort = () => child.kill('SIGTERM');
    if (options.signal) {
      if (options.signal.aborted) abort();
      else options.signal.addEventListener('abort', abort, { once: true });
    }

    child.once('error', reject);
    child.once('close', (code, signal) => {
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

function composeEnvironment(plan) {
  return {
    ...process.env,
    COMPOSE_PROJECT_NAME: plan.projectName,
    COMPOSE_FILE: `${path.join(repositoryRoot, 'docker-compose.yml')}:${plan.composeFile}`,
    MJL_BASE_URL: plan.baseUrl,
    MJL_TEST_PORT: String(plan.port),
    MJL_REPOSITORY_ROOT: repositoryRoot,
    MJL_PLAYWRIGHT_OUTPUT_DIR: path.join(plan.artifactRoot, 'playwright'),
  };
}

async function compose(plan, args, options = {}) {
  return runCommand('docker', ['compose', ...args], {
    ...options,
    env: composeEnvironment(plan),
  });
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

const verificationScripts = [
  ['audit_schema_current.php', 'core_schema.php'],
  ['audit_schema_current.php', 'audit_schema.php'],
  ['audit_schema_current.php', 'role_scope_schema.php'],
  ['audit_schema_current.php', 'activity_status_integrity.php'],
  ['audit_schema_current.php', 'activity_execution_schema.php'],
  ['audit_schema_current.php', 'expense_workflow_schema.php'],
  ['audit_schema_current.php', 'relationship_integrity.php'],
  'verify_sample_data.php',
  ['verify_scope_integrity.php', 'access_model.php'],
  ['verify_scope_integrity.php', 'traceability_targets.php'],
  ['verify_scope_integrity.php', 'unresolved_scope.php'],
  'verify_activity_workflow.php',
  'verify_expense_workflow.php',
  'verify_traceability_exports.php',
  '/opt/mjl-tests/contracts/container/dashboard_resilience_test.php',
];

async function runVerification(plan, signal) {
  for (const entry of verificationScripts) {
    const [script, ...args] = Array.isArray(entry) ? entry : [entry];
    const scriptPath = script.startsWith('/') ? script : `/var/www/html/custom/mjlfinancement/scripts/${script}`;
    await compose(plan, ['exec', '-T', 'dolibarr', 'php', scriptPath, ...args], { signal });
  }
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
        await provision(plan, controller.signal);
      }
      if (layer === 'verify') await runVerification(plan, controller.signal);
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
