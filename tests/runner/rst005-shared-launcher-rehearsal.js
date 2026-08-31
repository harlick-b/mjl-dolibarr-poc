#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const { canonicalJson } = require('../../custom/mjlfinancement/scripts/rst005_shared_launcher.lib');
const { isolatedRestoreNames, moduleTreeSha, writeDurableRecord } = require('../../custom/mjlfinancement/scripts/rst005_shared_operation.lib');

const sourceRoot = path.resolve(__dirname, '../..');
const hostNode = process.execPath;
const signalController = new AbortController();
let receivedSignal = null;
let activeSecretCanary = '';
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {
  if (receivedSignal === null) receivedSignal = signal;
  signalController.abort(new Error(`RST-005 rehearsal received ${signal}.`));
});

function command(commandName, args, options = {}) {
  try {
    const output = execFileSync(commandName, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      encoding: options.encoding === null ? null : 'utf8',
      input: options.input,
      stdio: options.quiet ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
    });
    if (activeSecretCanary && options.quiet && Buffer.from(output || '').includes(Buffer.from(activeSecretCanary))) {
      throw new Error(`Secret canary reached captured ${commandName} ${args.slice(0, 2).join(' ') || 'command'} output.`);
    }
    return output;
  } catch (error) {
    if (activeSecretCanary && [error.stdout, error.stderr].some((value) => value && Buffer.from(value).includes(Buffer.from(activeSecretCanary)))) {
      throw new Error(`Secret canary reached captured ${commandName} ${args.slice(0, 2).join(' ') || 'command'} failure output.`);
    }
    const diagnostic = `${error.message || ''}\n${error.stdout || ''}\n${error.stderr || ''}`;
    if (/permission denied|operation not permitted|\bEACCES\b|\bEPERM\b/i.test(diagnostic)) {
      throw new Error('SECURITY/ACCESS-BLOCKED — DO NOT RETRY: rehearsal command permission denied.');
    }
    throw error;
  }
}

function commandAsync(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: options.signal,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => {
      stdout.push(Buffer.from(chunk));
      if (options.onStdout) options.onStdout(chunk.toString('utf8'));
    });
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.once('error', reject);
    child.once('close', (code, signal) => {
      const stdoutText = Buffer.concat(stdout).toString('utf8');
      const stderrText = Buffer.concat(stderr).toString('utf8');
      if (activeSecretCanary && (stdoutText.includes(activeSecretCanary) || stderrText.includes(activeSecretCanary))) {
        reject(new Error('Secret canary reached captured asynchronous output.'));
      } else if (code === 0) resolve(stdoutText);
      else {
        const error = new Error(`${options.label || commandName} failed closed.`);
        error.status = code;
        error.signal = signal;
        error.stdout = stdoutText;
        error.stderr = stderrText;
        reject(error);
      }
    });
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitReady(baseUrl) {
  const deadline = Date.now() + 360000;
  while (Date.now() < deadline) {
    signalController.signal.throwIfAborted();
    try {
      const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(3000) });
      if (response.status < 500) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Disposable launcher tenant did not become ready.');
}

function copySnapshot(destination) {
  for (const relative of ['custom', 'docs', 'tests', '.gitignore', 'AGENTS.md', 'CONTEXT.md', 'DESIGN.md', 'README.md', 'docker-compose.yml', 'package.json', 'package-lock.json', 'playwright.config.js']) {
    fs.cpSync(path.join(sourceRoot, relative), path.join(destination, relative), { recursive: true, preserveTimestamps: true });
  }
  const migration = path.join(destination, 'custom/mjlfinancement/scripts/rst005_activity_foundation.php');
  const sourceHash = moduleTreeSha(path.join(destination, 'custom/mjlfinancement'));
  fs.writeFileSync(migration, fs.readFileSync(migration, 'utf8').replace(/const RST005_DEPENDENT_SOURCE_SHA256 = '[a-f0-9]{64}';/, `const RST005_DEPENDENT_SOURCE_SHA256 = '${sourceHash}';`));
  command('git', ['init', '-q'], { cwd: destination, quiet: true });
  command('git', ['config', 'user.email', 'rst005-launcher@example.test'], { cwd: destination, quiet: true });
  command('git', ['config', 'user.name', 'RST-005 Launcher Rehearsal'], { cwd: destination, quiet: true });
  command('git', ['add', '.'], { cwd: destination, quiet: true });
  command('git', ['commit', '-qm', 'sealed launcher rehearsal'], { cwd: destination, quiet: true });
}

function exactDockerResources(projectName, restoreNames, operatorNames) {
  const survivors = [];
  const listed = (args) => command('docker', args, { quiet: true }).trim();
  for (const name of operatorNames) if (listed(['ps', '-aq', '--filter', `name=^/${name}$`])) survivors.push(`container:${name}`);
  if (restoreNames) {
    if (listed(['ps', '-aq', '--filter', `name=^/${restoreNames.databaseContainer}$`])) survivors.push(`container:${restoreNames.databaseContainer}`);
    if (listed(['ps', '-aq', '--filter', `name=^/${restoreNames.evidenceContainer}$`])) survivors.push(`container:${restoreNames.evidenceContainer}`);
    if (listed(['network', 'ls', '-q', '--filter', `name=^${restoreNames.network}$`])) survivors.push(`network:${restoreNames.network}`);
    for (const volume of [restoreNames.databaseVolume, restoreNames.documentVolume]) if (listed(['volume', 'ls', '-q', '--filter', `name=^${volume}$`])) survivors.push(`volume:${volume}`);
  }
  for (const kind of ['container', 'network', 'volume']) {
    const args = kind === 'container'
      ? ['ps', '-aq', '--filter', `label=com.docker.compose.project=${projectName}`]
      : [kind, 'ls', '-q', '--filter', `label=com.docker.compose.project=${projectName}`];
    if (listed(args)) survivors.push(`${kind}:compose-project`);
  }
  if (survivors.length) throw new Error(`RST-005 teardown left resources: ${survivors.join(',')}`);
}

function removeExactResources(projectName, restoreNames, operatorNames, compose) {
  const attempt = (args) => {
    try { command('docker', args, { quiet: true }); } catch (error) {
      const diagnostic = `${error.message || ''}\n${error.stdout || ''}\n${error.stderr || ''}`;
      if (/no such|not found|already in use|conflict/i.test(diagnostic)) return;
      throw error;
    }
  };
  let lastError;
  for (let retry = 0; retry < 3; retry += 1) {
    for (const name of operatorNames) attempt(['rm', '-f', name]);
    if (restoreNames) {
      attempt(['rm', '-f', restoreNames.evidenceContainer]);
      attempt(['rm', '-f', restoreNames.databaseContainer]);
      attempt(['network', 'rm', restoreNames.network]);
      attempt(['volume', 'rm', restoreNames.databaseVolume]);
      attempt(['volume', 'rm', restoreNames.documentVolume]);
    }
    try { compose(['down', '-v', '--remove-orphans'], { quiet: true }); } catch (error) {
      const diagnostic = `${error.message || ''}\n${error.stdout || ''}\n${error.stderr || ''}`;
      if (!/no such|not found|already in use|conflict/i.test(diagnostic)) throw error;
    }
    try {
      exactDockerResources(projectName, restoreNames, operatorNames);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function assertNoCanaryInTrees(roots, canary) {
  const visit = (entry) => {
    if (!fs.existsSync(entry)) return;
    const stat = fs.lstatSync(entry);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) { for (const name of fs.readdirSync(entry)) visit(path.join(entry, name)); return; }
    if (stat.isFile() && fs.readFileSync(entry).includes(Buffer.from(canary))) throw new Error(`Secret canary reached retained artifact ${entry}.`);
  };
  for (const root of roots) visit(root);
}

async function runScenario(scenario) {
  const sharedShape = ['execute-rollback', 'mutation-sigkill', 'restore-sigkill', 'durable-corruption', 'foreign-filesystem-writer'].includes(scenario);
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), sharedShape ? `rst005-launcher-execute-rollback-${scenario}-` : `rst005-launcher-${scenario}-`));
  const custodyBase = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-rst005-custody-'));
  const repositoryRoot = path.join(runRoot, 'repository');
  const runnerEvidence = path.join(runRoot, 'runner-evidence');
  const custody = Object.fromEntries(['approval', 'key', 'traffic', 'environment', 'backups', 'evidence', 'lock'].map((name) => [name, path.join(custodyBase, name)]));
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(runnerEvidence);
  for (const directory of Object.values(custody)) fs.mkdirSync(directory, { mode: 0o700 });
  for (const label of ['after-manifest-before', 'before-apply', 'after-apply', 'after-activation-1', 'after-activation-2', 'after-manifest-target', 'before-finalize', 'after-finalize', 'complete', 'during-apply', 'during-recover', 'during-rollback', 'restore-sigkill', 'durable-corruption']) for (const kind of ['backups', 'evidence']) fs.mkdirSync(path.join(custodyBase, `${kind}-${label}`), { mode: 0o700 });
  copySnapshot(repositoryRoot);
  const port = await freePort();
  const projectName = `${sharedShape ? 'mjl-test-rst005-shared-shape' : 'mjl-test-rst005-launcher'}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  const operatorNames = new Set();
  let restoreNames = null;
  const sentinel = crypto.randomBytes(16).toString('hex');
  // Use the exact 32-byte backup key as the canary. The disposable tenant
  // password is intentionally represented in the resolved Compose model, so
  // conflating it with this no-output secret would make the probe circular.
  const secretCanary = crypto.randomBytes(16).toString('hex');
  activeSecretCanary = secretCanary;
  const composeFiles = sharedShape
    ? [path.join(repositoryRoot, 'docker-compose.yml')]
    : [path.join(repositoryRoot, 'docker-compose.yml'), path.join(repositoryRoot, 'tests/fixtures/disposable-compose.override.yml')];
  const environment = {
    ...process.env,
    COMPOSE_PROJECT_NAME: projectName,
    COMPOSE_FILE: composeFiles.join(':'),
    MJL_BASE_URL: `http://127.0.0.1:${port}`,
    MJL_TEST_PORT: String(port),
    MJL_REPOSITORY_ROOT: repositoryRoot,
    MJL_EVIDENCE_ROOT: runnerEvidence,
    MJL_DISPOSABLE_RUN_SENTINEL: sentinel,
    MJL_TEST_USER_PASSWORD: `Rst005Disposable-${crypto.randomBytes(8).toString('hex')}`,
  };
  const compose = (args, options = {}) => command('docker', ['compose', ...args], { cwd: repositoryRoot, env: environment, quiet: options.quiet, input: options.input });
  let provisioned = false;
  let approval = null;
  let cleanupError = null;
  try {
    compose(['config', '--format', 'json'], { quiet: true });
    provisioned = true;
    if (sharedShape) {
      fs.mkdirSync(path.join(repositoryRoot, 'data/mariadb'), { recursive: true });
      fs.mkdirSync(path.join(repositoryRoot, 'data/documents'), { recursive: true });
      compose(['up', '-d', 'mariadb']);
      const provisioner = `${projectName}-provisioner`;
      operatorNames.add(provisioner);
      compose(['run', '-d', '--name', provisioner, '--no-deps', 'dolibarr'], { quiet: true });
      const deadline = Date.now() + 360000;
      let installed = false;
      while (Date.now() < deadline) {
        try {
          const adminCount = compose(['exec', '-T', 'mariadb', 'sh', '-ceu', `mariadb -N -s -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM llx_user WHERE rowid=1 AND entity=0 AND login='admin' AND admin=1 AND statut=1"`], { quiet: true }).trim();
          if (adminCount === '1') {
            installed = true;
            break;
          }
        } catch (_) { await new Promise((resolve) => setTimeout(resolve, 2000)); }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!installed) throw new Error('Shared-shaped disposable tenant did not install.');
      command('docker', ['exec', provisioner, 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { quiet: true });
      command('docker', ['rm', '-f', provisioner], { quiet: true });
    } else {
      compose(['up', '-d']);
      await waitReady(environment.MJL_BASE_URL);
      compose(['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { quiet: true });
    }
    compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'umask 077; mkdir -p /run/mjl-test; printf "[client]\nuser=root\npassword=%s\n" "$MYSQL_ROOT_PASSWORD" > /run/mjl-test/client.cnf; chmod 0600 /run/mjl-test/client.cnf'], { quiet: true });
    const phase1Oracle = fs.readFileSync(path.join(repositoryRoot, 'docs/mjl-rst-005-phase1-activity-schema.sql'), 'utf8');
    compose(['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', 'dolidb'], { quiet: true, input: `DROP TABLE llx_mjlfinancement_activity;\n${phase1Oracle}\n` });
    if (!sharedShape) {
      compose(['exec', '-T', 'dolibarr', 'sh', '-ceu', 'sentinel=/var/www/documents/.mjl-disposable-fixture-sentinel; umask 0222; printf %s "$MJL_DISPOSABLE_RUN_SENTINEL" > "$sentinel"; chown root:root "$sentinel"; chmod 0444 "$sentinel"'], { quiet: true });
      compose(['stop', 'dolibarr'], { quiet: true });
    } else {
      const diagnosticName = `${projectName}-bootstrap-diagnostic`;
      operatorNames.add(diagnosticName);
      const bootstrapPreflight = JSON.parse(compose(['run', '--no-deps', '--name', diagnosticName, '--rm', '-T', '--interactive=false',
        '-v', `${repositoryRoot}/tests:/opt/mjl-tests:ro`, '-v', `${repositoryRoot}/custom:/var/www/html/custom:ro`, '-v', `${repositoryRoot}/data/documents:/var/www/documents:ro`,
        '--entrypoint', 'php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst005_oneoff_bootstrap.php', '/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php', '--mode=preflight'], { quiet: true }));
      if (bootstrapPreflight.status !== 'ready' || bootstrapPreflight.schema !== 'phase1') throw new Error('Shared-shaped one-off bootstrap did not expose the Phase 1 schema.');
    }

    if (scenario === 'harness-signal') {
      process.stdout.write(`RST-005 harness signal probe ready for ${projectName}.\n`);
      await new Promise((resolve, reject) => signalController.signal.addEventListener('abort', () => reject(signalController.signal.reason), { once: true }));
    }

    const launcherLib = require(path.join(repositoryRoot, 'custom/mjlfinancement/scripts/rst005_shared_launcher.lib.js'));
    const commit = command('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, quiet: true }).trim();
    const resolved = compose(['config', '--format', 'json'], { quiet: true });
    const now = new Date();
    const runtimeIdentity = JSON.parse(command('docker', [
      'run', '--rm', '-v', `${repositoryRoot}:${repositoryRoot}:ro`, '-v', '/var/run/docker.sock:/var/run/docker.sock',
      '-v', `${hostNode}:/opt/node:ro`, '-v', '/usr/bin/git:/usr/bin/git:ro', '-v', '/usr/bin/docker:/usr/bin/docker:ro',
      '-v', '/usr/bin/flock:/usr/bin/flock:ro',
      '-v', '/usr/libexec/docker/cli-plugins/docker-compose:/usr/libexec/docker/cli-plugins/docker-compose:ro',
      '--entrypoint', '/opt/node', 'dolibarr/dolibarr:23.0.2', '-e',
      `process.stdout.write(JSON.stringify(require(${JSON.stringify(path.join(repositoryRoot, 'custom/mjlfinancement/scripts/rst005_shared_launcher.lib.js'))}).dockerRuntimeIdentity()))`,
    ], { quiet: true }));
    const databaseRuntime = {
      container_id: compose(['ps', '-q', 'mariadb'], { quiet: true }).trim(),
      client_version: compose(['exec', '-T', 'mariadb', 'mariadb', '--version'], { quiet: true }).trim(),
      server_version: compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SELECT VERSION()"'], { quiet: true }).trim(),
      datadir: compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SELECT @@datadir"'], { quiet: true }).trim(),
      datadir_filesystem: compose(['exec', '-T', 'mariadb', 'stat', '-Lc', '%d:%i', '/var/lib/mysql'], { quiet: true }).trim(),
    };
    databaseRuntime.image_id = JSON.parse(command('docker', ['container', 'inspect', databaseRuntime.container_id], { quiet: true }))[0].Image;
    databaseRuntime.server_identity_sha256 = crypto.createHash('sha256').update(canonicalJson(databaseRuntime)).digest('hex');
    const operationKey = Buffer.from(secretCanary, 'utf8');
    const protectedTree = launcherLib.protectedTreeEvidence(repositoryRoot);
    const approvedEnvironment = Object.fromEntries(Object.entries(environment).filter(([key]) => ['MJL_BASE_URL', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_EVIDENCE_ROOT', 'MJL_REPOSITORY_ROOT', 'MJL_TEST_PORT', 'MJL_TEST_USER_PASSWORD'].includes(key)));
    const environmentBytes = Buffer.from(`${canonicalJson(approvedEnvironment)}\n`);
    approval = {
      version: 3, unit: 'RST-005', operation_id: crypto.randomBytes(16).toString('hex'), recovery_policy: 'containment_only_phase1',
      mode: sharedShape ? 'execute' : 'rehearse', target_profile: sharedShape ? 'disposable_shared_shape' : 'disposable', approved_commit: commit,
      complete_tree_sha256: protectedTree.completeTreeSha256, complete_tree_manifest_sha256: protectedTree.manifestSha256, repository_root: repositoryRoot,
      backup_key_sha256: crypto.createHash('sha256').update(operationKey).digest('hex'),
      docker_runtime: runtimeIdentity, database_runtime: databaseRuntime,
      compose_project_name: projectName, compose_config_sha256: crypto.createHash('sha256').update(resolved).digest('hex'),
      compose_files: composeFiles.map((file) => ({ path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })),
      compose_environment_sha256: crypto.createHash('sha256').update(environmentBytes).digest('hex'),
      database_name: 'dolidb', database_root: sharedShape ? path.join(repositoryRoot, 'data/mariadb') : `${projectName}_mjl_test_db`, document_root: sharedShape ? path.join(repositoryRoot, 'data/documents') : `${projectName}_mjl_test_docs`, backup_root: custody.backups,
      evidence_root: custody.evidence, issued_at: now.toISOString(), expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), nonce: crypto.randomBytes(16).toString('hex'),
    };
    approval.target_identity_sha256 = launcherLib.approvalTargetIdentitySha256(approval);
    approval.execution_identity_sha256 = launcherLib.approvalExecutionIdentitySha256(approval);
    {
      const locks = launcherLib.targetLockPaths(approval);
      approval.target_lock_path = locks.target;
      approval.mutation_lock_path = locks.mutation;
      for (const lockPath of Object.values(locks)) if (!fs.existsSync(lockPath)) fs.writeFileSync(lockPath, '', { mode: 0o600 });
    }
    launcherLib.validateApprovalRecord(approval, { expectedMode: approval.mode });
    launcherLib.verifyRepositoryBinding(approval);
    launcherLib.verifyComposeTarget(approval, JSON.parse(resolved));
    let stoppedServicesReady = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const services = compose(['ps', '--status', 'running', '--services'], { quiet: true }).trim().split('\n').filter(Boolean).sort();
      if (services.join(',') === 'mariadb') {
        launcherLib.validateStoppedServices(services);
        stoppedServicesReady = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!stoppedServicesReady) throw new Error('Disposable traffic-stop state did not stabilize.');
    restoreNames = isolatedRestoreNames(approval.nonce);
    const trafficNow = new Date();
    const traffic = {
      version: 3, unit: 'RST-005', operation_id: approval.operation_id, target_identity_sha256: approval.target_identity_sha256, execution_identity_sha256: approval.execution_identity_sha256,
      approval_sha256: launcherLib.approvalRecordSha256(approval), approval_nonce: approval.nonce, approved_commit: commit, compose_project_name: projectName, database_name: 'dolidb',
      exclusive_docker_administration: true, no_direct_host_writers: true, no_direct_database_writers: true,
      stopped_at: trafficNow.toISOString(), expires_at: new Date(trafficNow.getTime() + 15 * 60 * 1000).toISOString(),
      nonce: crypto.randomBytes(16).toString('hex'), operator: 'disposable-rehearsal',
    };
    fs.writeFileSync(path.join(custody.approval, 'record'), `${canonicalJson(approval)}\n`, { mode: 0o400 });
    fs.writeFileSync(path.join(custody.key, 'bytes'), operationKey, { mode: 0o400 });
    fs.writeFileSync(path.join(custody.traffic, 'record'), `${canonicalJson(traffic)}\n`, { mode: 0o400 });
    fs.writeFileSync(path.join(custody.environment, 'record'), environmentBytes, { mode: 0o400 });
    command('docker', ['run', '--rm', '-v', `${custodyBase}:${custodyBase}`, '-v', `${approval.target_lock_path}:${approval.target_lock_path}`, '-v', `${approval.mutation_lock_path}:${approval.mutation_lock_path}`, '--entrypoint', 'sh', 'dolibarr/dolibarr:23.0.2', '-ceu', `chown -R 0:0 ${custodyBase}; chown 0:0 ${approval.target_lock_path} ${approval.mutation_lock_path}; chmod 0600 ${approval.target_lock_path} ${approval.mutation_lock_path}; chmod 0700 ${custodyBase} ${custody.approval} ${custody.key} ${custody.traffic} ${custody.environment} ${custody.backups} ${custody.evidence}; chmod 0400 ${custody.approval}/record ${custody.key}/bytes ${custody.traffic}/record ${custody.environment}/record`], { quiet: true });

    const operatorArgs = (name, additions = [], launcherMode = approval.mode) => [
      'run', '--name', name, '--rm', '-w', repositoryRoot,
      '--tmpfs', '/var/www/documents:rw,noexec,nosuid,nodev,mode=0700', '--tmpfs', '/var/www/html/custom:rw,noexec,nosuid,nodev,mode=0700',
      '-v', `${repositoryRoot}:${repositoryRoot}:ro`,
      '-v', `${approval.backup_root}:${approval.backup_root}`, '-v', `${approval.evidence_root}:${approval.evidence_root}`,
      '-v', `${approval.target_lock_path}:${approval.target_lock_path}`, '-v', `${approval.mutation_lock_path}:${approval.mutation_lock_path}`,
      '-v', `${custody.approval}:/run/mjl-rst005/approval:ro`, '-v', `${custody.key}:/run/mjl-rst005/key:ro`, '-v', `${custody.traffic}:/run/mjl-rst005/traffic:ro`,
      '-v', `${custody.environment}:/run/mjl-rst005/environment:ro`,
      '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', `${hostNode}:/opt/node:ro`,
      '-v', '/usr/bin/git:/usr/bin/git:ro', '-v', '/usr/bin/docker:/usr/bin/docker:ro',
      '-v', '/usr/bin/flock:/usr/bin/flock:ro',
      '-v', '/usr/libexec/docker/cli-plugins/docker-compose:/usr/libexec/docker/cli-plugins/docker-compose:ro',
      // The protected environment record is the launcher's sole source for
      // approved Compose substitutions. Never duplicate its values in Docker
      // container metadata, where `docker inspect` would expose secrets.
      '-e', 'MJL_RST005_ISOLATED_DIAGNOSTICS=1',
      ...additions,
      '--entrypoint', '/usr/bin/flock', 'dolibarr/dolibarr:23.0.2', '--nonblock', '--no-fork', approval.target_lock_path,
      '/opt/node', 'custom/mjlfinancement/scripts/rst005_shared_launcher.js', `--mode=${launcherMode}`,
    ];
    const runOperator = async (suffix, additions = [], options = {}) => {
      const name = `${projectName}-operator-${suffix}`;
      operatorNames.add(name);
      return commandAsync('docker', operatorArgs(name, additions, options.launcherMode), { label: `RST-005 exact launcher ${suffix}`, signal: options.signal, onStdout: options.onStdout });
    };

    const custodyOwner = (uid, gid, directoryMode = '0700') => command('docker', [
      'run', '--rm', '-v', `${custodyBase}:${custodyBase}`, '--entrypoint', 'sh', 'dolibarr/dolibarr:23.0.2', '-ceu',
      `chmod ${uid === 0 ? '0700' : '0711'} ${custodyBase}; chown -R ${uid}:${gid} ${custody.approval} ${custody.key} ${custody.traffic} ${custody.environment}; chmod ${directoryMode} ${custody.approval} ${custody.key} ${custody.traffic} ${custody.environment}`,
    ], { quiet: true });
    const writeInputs = (approvalValue = approval, trafficValue = traffic, keyValue = operationKey, missing = null, symlinkKey = false) => {
      custodyOwner(process.getuid(), process.getgid());
      for (const file of [path.join(custody.approval, 'record'), path.join(custody.key, 'bytes'), path.join(custody.key, 'real-bytes'), path.join(custody.traffic, 'record'), path.join(custody.environment, 'record')]) {
        if (fs.existsSync(file) || fs.lstatSync(path.dirname(file)).isDirectory()) {
          try { fs.rmSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
      }
      if (missing !== 'approval') fs.writeFileSync(path.join(custody.approval, 'record'), `${canonicalJson(approvalValue)}\n`, { mode: 0o400 });
      if (missing !== 'key') {
        if (symlinkKey) {
          fs.writeFileSync(path.join(custody.key, 'real-bytes'), keyValue, { mode: 0o400 });
          fs.symlinkSync('real-bytes', path.join(custody.key, 'bytes'));
        } else fs.writeFileSync(path.join(custody.key, 'bytes'), keyValue, { mode: 0o400 });
      }
      if (missing !== 'traffic') fs.writeFileSync(path.join(custody.traffic, 'record'), `${canonicalJson(trafficValue)}\n`, { mode: 0o400 });
      if (missing !== 'environment') fs.writeFileSync(path.join(custody.environment, 'record'), environmentBytes, { mode: 0o400 });
      custodyOwner(0, 0);
    };
    const expectRejected = async (suffix) => {
      try {
        await runOperator(`reject-${suffix}`);
      } catch (error) {
        if (suffix === 'lock-contention' && error.status === 1 && error.stderr === '') return;
        if (error.stderr === 'RST-005 shared launcher failed closed.\n') return;
        if (!error.stderr.startsWith('RST-005 shared launcher failed closed.\nRST-005 isolated diagnostic: ')) throw new Error(`Exact launcher ${suffix} rejection leaked or changed diagnostics.`);
        return;
      }
      throw new Error(`Exact launcher ${suffix} negative seam unexpectedly succeeded.`);
    };

    if (scenario.startsWith('launcher-interrupt-')) {
      const launcherSignal = scenario.slice('launcher-interrupt-'.length);
      if (!['SIGHUP', 'SIGINT', 'SIGTERM'].includes(launcherSignal)) throw new Error('Unknown launcher interruption signal.');
      let killed = false;
      try {
        await runOperator('interrupt', ['-e', 'MJL_RST005_STAGE_TRACE=1'], { onStdout: (chunk) => {
          if (!killed && chunk.includes('RST005_STAGE=255')) {
            killed = true;
            command('docker', ['kill', `--signal=${launcherSignal}`, `${projectName}-operator-interrupt`], { quiet: true });
          }
        } });
        throw new Error('Interrupted exact launcher unexpectedly succeeded.');
      } catch (error) {
        if (!killed) throw error;
        const expectedStatus = 128 + ({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[launcherSignal]);
        if (error.status !== expectedStatus) throw new Error(`Interrupted launcher exited ${error.status}; expected ${expectedStatus}.`);
      }
      const listed = (args) => command('docker', args, { quiet: true }).trim();
      let restoreSurvivors = [];
      for (let attempt = 0; attempt < 300; attempt += 1) {
        restoreSurvivors = [];
        if (listed(['ps', '-aq', '--filter', `name=^/${restoreNames.databaseContainer}$`])) restoreSurvivors.push('database-container');
        if (listed(['ps', '-aq', '--filter', `name=^/${restoreNames.evidenceContainer}$`])) restoreSurvivors.push('evidence-container');
        if (listed(['network', 'ls', '-q', '--filter', `name=^${restoreNames.network}$`])) restoreSurvivors.push('network');
        if (listed(['volume', 'ls', '-q', '--filter', `name=^${restoreNames.databaseVolume}$`])) restoreSurvivors.push('database-volume');
        if (listed(['volume', 'ls', '-q', '--filter', `name=^${restoreNames.documentVolume}$`])) restoreSurvivors.push('document-volume');
        if (restoreSurvivors.length === 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (restoreSurvivors.length > 0) throw new Error(`Interrupted launcher left isolated restore resources: ${restoreSurvivors.join(',')}.`);
      const leakedOneOffs = command('docker', ['ps', '-aq', '--filter', `name=${projectName}-rst005-`], { quiet: true }).trim();
      if (leakedOneOffs) throw new Error('Interrupted launcher left a deterministic one-off container.');
      compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'test ! -e /run/mjl-rst005/client.cnf; test ! -e /run/mjl-rst005/client.cnf.new'], { quiet: true });
      process.stdout.write(`RST-005 exact launcher interruption failed closed for ${projectName}.\n`);
      return;
    }

    if (scenario === 'source-mutation-during' || scenario === 'source-mutation-after') {
      const mutationStage = scenario === 'source-mutation-during' ? 171 : 174;
      const mutationPath = path.join(repositoryRoot, 'docs/mjl-rst-005-activity-foundation-strategy.md');
      const original = fs.readFileSync(mutationPath);
      let mutated = false;
      writeInputs();
      try {
        await runOperator(scenario, ['-e', 'MJL_RST005_STAGE_TRACE=1'], { onStdout: (chunk) => {
          if (!mutated && chunk.includes(`RST005_STAGE=${mutationStage}`)) {
            mutated = true;
            fs.appendFileSync(mutationPath, '\nsource mutation probe\n');
          }
        } });
        throw new Error(`${scenario} unexpectedly succeeded.`);
      } catch (error) {
        if (!mutated || error.status === 0) throw error;
      } finally {
        fs.writeFileSync(mutationPath, original);
      }
      process.stdout.write(`RST-005 ${scenario} failed closed for ${projectName}.\n`);
      return;
    }

    if (scenario === 'input-replacement') {
      let replaced = false;
      writeInputs();
      try {
        await runOperator('input-replacement', ['-e', 'MJL_RST005_STAGE_TRACE=1'], { onStdout: (chunk) => {
          if (!replaced && chunk.includes('RST005_STAGE=171')) {
            replaced = true;
            writeInputs();
          }
        } });
        throw new Error('Protected-input replacement unexpectedly succeeded.');
      } catch (error) {
        if (!replaced || error.status === 0) throw error;
      }
      process.stdout.write(`RST-005 protected-input replacement failed closed for ${projectName}.\n`);
      return;
    }

    if (scenario === 'lock-contention') {
      writeInputs();
      let releaseReady;
      const ready = new Promise((resolve) => { releaseReady = resolve; });
      const first = runOperator('lock-holder', ['-e', 'MJL_RST005_STAGE_TRACE=1'], { onStdout: (chunk) => {
        if (chunk.includes('RST005_STAGE=171')) releaseReady();
      } });
      await ready;
      await expectRejected('lock-contention');
      command('docker', ['kill', '--signal=TERM', `${projectName}-operator-lock-holder`], { quiet: true });
      try { await first; throw new Error('Lock holder unexpectedly completed.'); }
      catch (error) { if (error.status !== 143) throw error; }
      process.stdout.write(`RST-005 target lock contention failed closed for ${projectName}.\n`);
      return;
    }

    if (scenario === 'foreign-network-peer') {
      writeInputs();
      const peer = `${projectName}-foreign-peer`;
      operatorNames.add(peer);
      command('docker', ['run', '-d', '--name', peer, '--network', `${projectName}_default`, '--entrypoint', '/usr/bin/sleep', 'mariadb:11', '120'], { quiet: true });
      await expectRejected('foreign-network-peer');
      process.stdout.write(`RST-005 foreign network peer failed closed for ${projectName}.\n`);
      return;
    }

    if (scenario === 'alternate-database-network') {
      writeInputs();
      const network = `${projectName}-unapproved-network`;
      const databaseContainer = compose(['ps', '-q', 'mariadb'], { quiet: true }).trim();
      command('docker', ['network', 'create', network], { quiet: true });
      try {
        command('docker', ['network', 'connect', network, databaseContainer], { quiet: true });
        await expectRejected('alternate-database-network');
      } finally {
        try { command('docker', ['network', 'disconnect', '-f', network, databaseContainer], { quiet: true }); } catch (_) {}
        try { command('docker', ['network', 'rm', network], { quiet: true }); } catch (_) {}
      }
      process.stdout.write(`RST-005 alternate database network failed closed for ${projectName}.\n`);
      return;
    }

    if (scenario === 'foreign-filesystem-writer') {
      writeInputs();
      const writer = `${projectName}-foreign-writer`;
      operatorNames.add(writer);
      command('docker', ['run', '-d', '--name', writer, '-v', `${runRoot}:/unapproved-write`, '--entrypoint', '/usr/bin/sleep', 'mariadb:11', '120'], { quiet: true });
      await expectRejected('foreign-filesystem-writer');
      process.stdout.write(`RST-005 ancestor filesystem writer failed closed for ${projectName}.\n`);
      return;
    }

    if (scenario === 'enabled-database-event') {
      writeInputs();
      compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -uroot "$MYSQL_DATABASE" -e "CREATE EVENT rst005_unapproved_writer ON SCHEDULE EVERY 1 DAY DO SET @rst005_probe=1"'], { quiet: true });
      try { await expectRejected('enabled-database-event'); }
      finally {
        compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -uroot "$MYSQL_DATABASE" -e "DROP EVENT IF EXISTS rst005_unapproved_writer"'], { quiet: true });
      }
      process.stdout.write(`RST-005 enabled database event failed closed for ${projectName}.\n`);
      return;
    }

    if (scenario === 'foreign-database-session') {
      writeInputs();
      compose(['exec', '-d', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -uroot "$MYSQL_DATABASE" -e "SELECT SLEEP(120)"'], { quiet: true });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await expectRejected('foreign-database-session');
      process.stdout.write(`RST-005 foreign database session failed closed for ${projectName}.\n`);
      return;
    }

    if (['execute-rollback', 'mutation-sigkill', 'restore-sigkill', 'durable-corruption'].includes(scenario)) {
      const refreshTraffic = () => {
        const instant = new Date();
        return { ...traffic, operation_id: approval.operation_id, target_identity_sha256: approval.target_identity_sha256,
          execution_identity_sha256: approval.execution_identity_sha256, approval_sha256: launcherLib.approvalRecordSha256(approval), approval_nonce: approval.nonce,
          stopped_at: instant.toISOString(), expires_at: new Date(instant.getTime() + 15 * 60 * 1000).toISOString(), nonce: crypto.randomBytes(16).toString('hex') };
      };
      const refreshApproval = (mode, label) => {
        const instant = new Date();
        const backupRoot = path.join(custodyBase, `backups-${label}`);
        const evidenceRoot = path.join(custodyBase, `evidence-${label}`);
        approval = { ...approval, mode, operation_id: crypto.randomBytes(16).toString('hex'), backup_root: backupRoot, evidence_root: evidenceRoot, issued_at: instant.toISOString(), expires_at: new Date(instant.getTime() + 60 * 60 * 1000).toISOString(), nonce: crypto.randomBytes(16).toString('hex') };
        approval.target_identity_sha256 = launcherLib.approvalTargetIdentitySha256(approval);
        approval.execution_identity_sha256 = launcherLib.approvalExecutionIdentitySha256(approval);
        {
          const locks = launcherLib.targetLockPaths(approval);
          approval.target_lock_path = locks.target;
          approval.mutation_lock_path = locks.mutation;
        }
        restoreNames = isolatedRestoreNames(approval.nonce);
      };
      const rollbackCurrent = async (label) => {
        const instant = new Date();
        const rollbackApproval = { ...approval, mode: 'rollback', issued_at: instant.toISOString(), expires_at: new Date(instant.getTime() + 60 * 60 * 1000).toISOString(), nonce: crypto.randomBytes(16).toString('hex') };
        writeInputs(rollbackApproval, { ...refreshTraffic(), approval_sha256: launcherLib.approvalRecordSha256(rollbackApproval), approval_nonce: rollbackApproval.nonce });
        const rollbackOutput = await runOperator(`${label}-rollback`, [], { launcherMode: 'rollback' });
        const rollbackResult = JSON.parse(rollbackOutput.trim().split('\n').at(-1));
        if (rollbackResult.status !== 'containment_restored') throw new Error(`${label} standalone rollback did not restore containment.`);
      };
      const interruptAndRecover = async (stage, label) => {
        let killed = false;
        writeInputs(approval, refreshTraffic());
        try {
          await runOperator(`${label}-execute`, ['-e', 'MJL_RST005_STAGE_TRACE=1'], { launcherMode: 'execute', onStdout: (chunk) => {
            if (!killed && chunk.includes(`RST005_STAGE=${stage}`)) {
              killed = true;
              command('docker', ['kill', '--signal=KILL', `${projectName}-operator-${label}-execute`], { quiet: true });
            }
          } });
          throw new Error(`${label} interrupted execute unexpectedly succeeded.`);
        } catch (error) {
          if (!killed || error.status !== 137) throw error;
        }
        writeInputs(approval, refreshTraffic());
        const recoveryOutput = await runOperator(`${label}-recover`, ['-e', 'MJL_RST005_STAGE_TRACE=1'], { launcherMode: 'recover' });
        const recoveryLine = recoveryOutput.trim().split('\n').at(-1);
        let recoveryResult;
        try { recoveryResult = JSON.parse(recoveryLine); } catch (_) {
          const lastStage = recoveryOutput.match(/RST005_STAGE=\d+/g)?.at(-1) || 'no-stage';
          throw new Error(`${label} recovery returned malformed or empty result evidence after ${lastStage}.`);
        }
        if (!['phase1_containment_restored', 'already_phase1_containment'].includes(recoveryResult.status)) throw new Error(`${label} fresh-process recovery did not restore containment.`);
      };
      const interruptExecuteOnly = async (stage, label) => {
        let killed = false;
        writeInputs(approval, refreshTraffic());
        try {
          await runOperator(`${label}-execute`, ['-e', 'MJL_RST005_STAGE_TRACE=1'], { launcherMode: 'execute', onStdout: (chunk) => {
            if (!killed && chunk.includes(`RST005_STAGE=${stage}`)) { killed = true; command('docker', ['kill', '--signal=KILL', `${projectName}-operator-${label}-execute`], { quiet: true }); }
          } });
          throw new Error(`${label} interrupted execute unexpectedly succeeded.`);
        } catch (error) { if (!killed || error.status !== 137) throw error; }
      };
      const killDuringMutation = async (mode, label) => {
        let killed = false;
        try {
          await runOperator(label, ['-e', 'MJL_RST005_STAGE_TRACE=1', '-e', 'MJL_RST005_MUTATION_HOLD_SECONDS=8'], { launcherMode: mode, onStdout: (chunk) => {
            if (!killed && chunk.includes('RST005_STAGE=190')) { killed = true; command('docker', ['kill', '--signal=KILL', `${projectName}-operator-${label}`], { quiet: true }); }
          } });
          throw new Error(`${label} mutation SIGKILL unexpectedly succeeded.`);
        } catch (error) { if (!killed || error.status !== 137) throw error; }
        try {
          await runOperator(`${label}-lease-probe`, [], { launcherMode: mode });
          throw new Error(`${label} mutation lease allowed a concurrent launcher.`);
        } catch (error) { if (error.status === 0) throw error; }
        await new Promise((resolve) => setTimeout(resolve, 9000));
      };
      if (scenario === 'restore-sigkill') {
        refreshApproval('execute', 'restore-sigkill');
        writeInputs(approval, refreshTraffic());
        let killed = false;
        try {
          await runOperator('restore-sigkill', ['-e', 'MJL_RST005_STAGE_TRACE=1'], { launcherMode: 'execute', onStdout: (chunk) => {
            if (!killed && chunk.includes('RST005_STAGE=223')) {
              killed = true;
              command('docker', ['kill', '--signal=KILL', `${projectName}-operator-restore-sigkill`], { quiet: true });
            }
          } });
          throw new Error('Restore SIGKILL unexpectedly succeeded.');
        } catch (error) { if (!killed || error.status !== 137) throw error; }
        await new Promise((resolve) => setTimeout(resolve, 32000));
        const listed = (args) => command('docker', args, { quiet: true }).trim();
        if (listed(['ps', '-aq', '--filter', `name=^/${restoreNames.databaseContainer}$`])
          || listed(['volume', 'ls', '-q', '--filter', `name=^${restoreNames.databaseVolume}$`])) {
          throw new Error('Restore SIGKILL left a plaintext database container or volume past its daemon lifetime.');
        }
        writeInputs(approval, refreshTraffic());
        try { await runOperator('restore-sigkill-reaper', [], { launcherMode: 'recover' }); } catch (error) {
          if ((error.stderr || '').includes('SECURITY/ACCESS-BLOCKED')) throw error;
          if (!Number.isInteger(error.status) || error.status === 0) throw error;
        }
        if (listed(['network', 'ls', '-q', '--filter', `name=^${restoreNames.network}$`])) throw new Error('Fresh launcher did not reap the exact orphan restore network.');
        process.stdout.write(`RST-005 restore SIGKILL lifetime and fresh-launch reaping passed for ${projectName}.\n`);
        return;
      }
      if (scenario === 'durable-corruption') {
        refreshApproval('execute', 'durable-corruption');
        await interruptExecuteOnly(26, 'durable-corruption-seed');
        const durablePattern = /^\d{4}-[a-z][a-z0-9-]{1,63}-[a-f0-9]{64}\.json$/;
        const makeWritable = () => command('docker', ['run', '--rm', '-v', `${custodyBase}:${custodyBase}`, '--entrypoint', 'sh', 'dolibarr/dolibarr:23.0.2', '-ceu', `chmod 0711 ${custodyBase}; chown -R ${process.getuid()}:${process.getgid()} ${approval.evidence_root}; chmod 0700 ${approval.evidence_root}; find ${approval.evidence_root} -maxdepth 1 -type f -exec chmod 0600 {} +`], { quiet: true });
        const makeProtected = () => command('docker', ['run', '--rm', '-v', `${custodyBase}:${custodyBase}`, '--entrypoint', 'sh', 'dolibarr/dolibarr:23.0.2', '-ceu', `chown -R 0:0 ${approval.evidence_root}; chmod 0700 ${approval.evidence_root}; find ${approval.evidence_root} -maxdepth 1 -type f -exec chmod 0400 {} +; chmod 0700 ${custodyBase}`], { quiet: true });
        makeWritable();
        const durableNames = fs.readdirSync(approval.evidence_root).filter((name) => durablePattern.test(name)).sort();
        const baseline = new Map(fs.readdirSync(approval.evidence_root).filter((name) => fs.lstatSync(path.join(approval.evidence_root, name)).isFile())
          .map((name) => [name, fs.readFileSync(path.join(approval.evidence_root, name))]));
        const restore = () => {
          // Restore the exact seed file set. A mutation that unexpectedly gets
          // past chain validation may publish a recovery manifest before a
          // later invariant rejects it; that file must not contaminate the
          // next independent corruption probe.
          for (const name of fs.readdirSync(approval.evidence_root)) {
            const entry = path.join(approval.evidence_root, name);
            if (fs.lstatSync(entry).isFile()) fs.rmSync(entry);
          }
          for (const [name, bytes] of baseline) fs.writeFileSync(path.join(approval.evidence_root, name), bytes, { mode: 0o600 });
        };
        const rejectMutation = async (label, mutate) => {
          restore();
          mutate();
          makeProtected();
          writeInputs(approval, refreshTraffic());
          try { await runOperator(`corrupt-${label}`, [], { launcherMode: 'recover' }); throw new Error(`${label} durable corruption unexpectedly succeeded.`); }
          catch (error) { if (!Number.isInteger(error.status) || error.status === 0) throw error; }
          makeWritable();
        };
        // Removing the final checkpoint is a valid manifest-only crash prefix;
        // remove the chain head instead so the retained sequence is genuinely
        // incomplete and must fail closed.
        await rejectMutation('missing', () => fs.unlinkSync(path.join(approval.evidence_root, durableNames[0])));
        await rejectMutation('duplicate', () => fs.copyFileSync(path.join(approval.evidence_root, durableNames[1]), path.join(approval.evidence_root, `0002-checkpoint-before-apply-${durableNames[1].match(/[a-f0-9]{64}/)[0]}.json`)));
        await rejectMutation('reordered', () => { const left = path.join(approval.evidence_root, durableNames[0]); const right = path.join(approval.evidence_root, durableNames[1]); const temporary = `${left}.swap`; fs.renameSync(left, temporary); fs.renameSync(right, path.join(approval.evidence_root, durableNames[0].replace(/^0000-/, '0000-'))); fs.renameSync(temporary, path.join(approval.evidence_root, durableNames[1].replace(/^0001-/, '0001-'))); });
        await rejectMutation('truncated', () => { const file = path.join(approval.evidence_root, durableNames[1]); const bytes = fs.readFileSync(file); fs.writeFileSync(file, bytes.subarray(0, Math.floor(bytes.length / 2))); });
        await rejectMutation('corrupt', () => { const file = path.join(approval.evidence_root, durableNames[1]); const bytes = fs.readFileSync(file); bytes[Math.floor(bytes.length / 2)] ^= 1; fs.writeFileSync(file, bytes); });
        await rejectMutation('copied-replayed', () => writeDurableRecord(approval.evidence_root, { operationId: 'f'.repeat(32), targetIdentitySha256: approval.target_identity_sha256, executionIdentitySha256: approval.execution_identity_sha256, sequence: 2, kind: 'manifest-recovery', previousSha256: durableNames[1].match(/[a-f0-9]{64}/)[0], payload: {} }, { requiredUid: process.getuid() }));
        await rejectMutation('contradictory-raw-copy', () => fs.writeFileSync(path.join(approval.evidence_root, 'rst005-launcher-report.json'), `${canonicalJson({ status: 'contradictory' })}\n`, { mode: 0o400 }));
        restore();
        makeProtected();
        writeInputs(approval, refreshTraffic());
        await runOperator('durable-corruption-recover', [], { launcherMode: 'recover' });
        process.stdout.write(`RST-005 operational durable-corruption matrix passed for ${projectName}.\n`);
        return;
      }
      if (scenario === 'mutation-sigkill') {
        refreshApproval('execute', 'during-apply');
        writeInputs(approval, refreshTraffic());
        await killDuringMutation('execute', 'during-apply');
        writeInputs(approval, refreshTraffic());
        await runOperator('during-apply-recover', [], { launcherMode: 'recover' });

        refreshApproval('execute', 'during-recover');
        await interruptExecuteOnly(27, 'during-recover-seed');
        writeInputs(approval, refreshTraffic());
        await killDuringMutation('recover', 'during-recover');
        writeInputs(approval, refreshTraffic());
        await runOperator('during-recover-resume', [], { launcherMode: 'recover' });

        refreshApproval('execute', 'during-rollback');
        writeInputs(approval, refreshTraffic());
        const completedOutput = await runOperator('during-rollback-execute', [], { launcherMode: 'execute' });
        if (JSON.parse(completedOutput.trim().split('\n').at(-1)).status !== 'executed_target_finalized') throw new Error('Mutation SIGKILL rollback seed did not finalize.');
        const instant = new Date();
        approval = { ...approval, mode: 'rollback', issued_at: instant.toISOString(), expires_at: new Date(instant.getTime() + 60 * 60 * 1000).toISOString(), nonce: crypto.randomBytes(16).toString('hex') };
        writeInputs(approval, refreshTraffic());
        await killDuringMutation('rollback', 'during-rollback');
        writeInputs(approval, refreshTraffic());
        const resumedRollback = await runOperator('during-rollback-resume', [], { launcherMode: 'rollback' });
        if (JSON.parse(resumedRollback.trim().split('\n').at(-1)).status !== 'containment_restored') throw new Error('Interrupted rollback did not resume to containment.');
        process.stdout.write(`RST-005 mutation-lifetime SIGKILL matrix passed for ${projectName}.\n`);
        return;
      }
      const allCrashBoundaries = [
        [224, 'after-manifest-before'], [26, 'before-apply'], [27, 'after-apply'], [262, 'after-activation-1'],
        [263, 'after-activation-2'], [225, 'after-manifest-target'], [29, 'before-finalize'], [32, 'after-finalize'],
      ];
      const selectedCrashStage = process.env.MJL_RST005_CRASH_STAGE;
      const crashBoundaries = selectedCrashStage
        ? allCrashBoundaries.filter(([stage]) => String(stage) === selectedCrashStage)
        : (process.env.MJL_RST005_SINGLE_CRASH === '1' ? [allCrashBoundaries[0]] : allCrashBoundaries);
      if (crashBoundaries.length === 0) throw new Error('Requested RST-005 crash stage is not in the exact matrix.');
      for (const [stage, label] of crashBoundaries) {
        refreshApproval('execute', label);
        await interruptAndRecover(stage, label);
      }
      refreshApproval('execute', 'complete');
      writeInputs(approval, refreshTraffic());
      const executeOutput = await runOperator('shared-shape-execute');
      const executeResult = JSON.parse(executeOutput.trim().split('\n').at(-1));
      if (executeResult.status !== 'executed_target_finalized') throw new Error('Shared-shaped execute did not finalize the target.');
      await rollbackCurrent('shared-shape');
      const phase1 = JSON.parse(compose(['run', '--no-deps', '--rm', '-T', '--interactive=false', '--entrypoint', 'php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst005_oneoff_bootstrap.php', '/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php', '--mode=preflight'], { quiet: true }));
      if (phase1.status !== 'ready' || phase1.schema !== 'phase1') throw new Error('Standalone rollback did not restore the exact Phase 1 schema.');
      process.stdout.write(`RST-005 shared-shaped execute and standalone rollback passed for ${projectName}.\n`);
      return;
    }

    if (scenario !== 'success') throw new Error('Unknown RST-005 launcher rehearsal scenario.');
    for (const missing of ['approval', 'key', 'traffic', 'environment']) {
      writeInputs(approval, traffic, crypto.randomBytes(32), missing);
      await expectRejected(`missing-${missing}`);
    }
    writeInputs(approval, traffic, crypto.randomBytes(31));
    await expectRejected('short-key');
    writeInputs(approval, traffic, crypto.randomBytes(32), null, true);
    await expectRejected('symlink-key');
    writeInputs();
    command('docker', ['run', '--rm', '-v', `${custodyBase}:${custodyBase}`, '--entrypoint', 'chmod', 'dolibarr/dolibarr:23.0.2', '0755', custody.key], { quiet: true });
    await expectRejected('weak-custody');
    writeInputs({ ...approval, approved_commit: '0'.repeat(40) });
    await expectRejected('wrong-commit');
    writeInputs({ ...approval, complete_tree_sha256: '0'.repeat(64) });
    await expectRejected('protected-manifest');
    writeInputs({ ...approval, compose_config_sha256: '0'.repeat(64) });
    await expectRejected('compose-manifest');
    writeInputs({ ...approval, compose_project_name: `${projectName}-substitute` });
    await expectRejected('target-substitution');
    writeInputs({ ...approval, mode: 'execute', target_kind: 'shared', compose_project_name: 'mjl-dolibarr-poc' });
    await expectRejected('shared-target');
    const stale = new Date(Date.now() - 20 * 60 * 1000);
    writeInputs(approval, { ...traffic, stopped_at: new Date(stale.getTime() - 60 * 1000).toISOString(), expires_at: stale.toISOString() });
    await expectRejected('stale-traffic');
    writeInputs();
    const dirtyPath = path.join(repositoryRoot, 'docs', '.rst005-launcher-dirty-probe');
    fs.writeFileSync(dirtyPath, 'dirty\n');
    await expectRejected('dirty-tree');
    fs.rmSync(dirtyPath);
    writeInputs();
    const output = await runOperator('success', ['-e', 'MJL_RST005_STAGE_TRACE=1']);
    const result = JSON.parse(output.trim().split('\n').at(-1));
    if (result.status !== 'rehearsed_and_containment_restored' || result.commit !== commit) throw new Error('Exact launcher rehearsal returned unexpected evidence.');
    const phase1 = JSON.parse(compose(['run', '--no-deps', '--rm', '-T', '--entrypoint', 'php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php', '--mode=preflight'], { quiet: true }));
    if (phase1.status !== 'ready' || phase1.schema !== 'phase1') throw new Error('Launcher rehearsal did not restore the exact Phase 1 containment schema.');
    process.stdout.write(`RST-005 exact launcher rehearsal passed for ${projectName}.\n`);
  } finally {
    try {
      command('docker', ['run', '--rm', '-v', `${custodyBase}:${custodyBase}`, '--entrypoint', 'sh', 'dolibarr/dolibarr:23.0.2', '-ceu', `chown -R ${process.getuid()}:${process.getgid()} ${custodyBase}; chmod 0711 ${custodyBase}`], { quiet: true });
      assertNoCanaryInTrees([custody.backups, custody.evidence, runnerEvidence], secretCanary);
      const orphanOneOffs = command('docker', ['ps', '-aq', '--filter', `name=${projectName}-rst005-`], { quiet: true }).trim().split('\n').filter(Boolean);
      if (orphanOneOffs.length > 0) {
        const metadata = command('docker', ['container', 'inspect', ...orphanOneOffs], { quiet: true });
        const logs = orphanOneOffs.map((container) => { try { return command('docker', ['logs', container], { quiet: true }); } catch (_) { return ''; } }).join('');
        if (metadata.includes(secretCanary) || logs.includes(secretCanary)) throw new Error('Secret canary reached an orphaned RST-005 one-off container.');
      }
      if (provisioned) removeExactResources(projectName, restoreNames, [...operatorNames], compose);
      command('docker', ['run', '--rm', '-v', `${runRoot}:${runRoot}`, '--entrypoint', 'sh', 'dolibarr/dolibarr:23.0.2', '-ceu', `chown -R ${process.getuid()}:${process.getgid()} ${runRoot}`], { quiet: true });
      fs.rmSync(runRoot, { recursive: true, force: false });
      if (fs.existsSync(runRoot)) throw new Error('RST-005 custody root survived teardown.');
      command('docker', ['run', '--rm', '-v', `${custodyBase}:${custodyBase}`, '--entrypoint', 'sh', 'dolibarr/dolibarr:23.0.2', '-ceu', `chown -R ${process.getuid()}:${process.getgid()} ${custodyBase}`], { quiet: true });
      fs.rmSync(custodyBase, { recursive: true, force: false });
      if (fs.existsSync(custodyBase)) throw new Error('RST-005 protected custody base survived teardown.');
      if (approval && fs.existsSync(approval.target_lock_path) && fs.existsSync(approval.mutation_lock_path)) {
        command('docker', ['run', '--rm', '-v', `${approval.target_lock_path}:${approval.target_lock_path}`, '-v', `${approval.mutation_lock_path}:${approval.mutation_lock_path}`, '--entrypoint', 'sh', 'dolibarr/dolibarr:23.0.2', '-ceu', `chown ${process.getuid()}:${process.getgid()} ${approval.target_lock_path} ${approval.mutation_lock_path}`], { quiet: true });
        fs.unlinkSync(approval.target_lock_path);
        fs.unlinkSync(approval.mutation_lock_path);
      }
    } catch (error) {
      cleanupError = error;
    }
    activeSecretCanary = '';
    if (cleanupError) throw cleanupError;
  }
}

async function orchestrate() {
  for (const harnessSignal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
    const child = spawn(process.execPath, [__filename, '--scenario=harness-signal'], { stdio: ['ignore', 'pipe', 'inherit'] });
    let ready = false;
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      if (!ready && chunk.toString('utf8').includes('signal probe ready')) {
        ready = true;
        child.kill(harnessSignal);
      }
    });
    const code = await new Promise((resolve, reject) => child.once('error', reject).once('close', resolve));
    const expected = 128 + ({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[harnessSignal]);
    if (!ready || code !== expected) throw new Error(`Harness ${harnessSignal} teardown probe did not fail closed with exact cleanup.`);
  }
  for (const launcherSignal of ['SIGHUP', 'SIGINT', 'SIGTERM']) await runScenario(`launcher-interrupt-${launcherSignal}`);
  await runScenario('source-mutation-during');
  await runScenario('source-mutation-after');
  await runScenario('input-replacement');
  await runScenario('lock-contention');
  await runScenario('foreign-network-peer');
  await runScenario('alternate-database-network');
  await runScenario('foreign-filesystem-writer');
  await runScenario('enabled-database-event');
  await runScenario('foreign-database-session');
  await runScenario('success');
  await runScenario('execute-rollback');
  await runScenario('mutation-sigkill');
  await runScenario('restore-sigkill');
  await runScenario('durable-corruption');
}

const scenarioArgument = process.argv.find((argument) => argument.startsWith('--scenario='));
(scenarioArgument ? runScenario(scenarioArgument.slice('--scenario='.length)) : orchestrate()).then(() => {
  if (receivedSignal) process.exitCode = 128 + ({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[receivedSignal]);
}).catch((error) => {
  process.stderr.write(`RST-005 launcher rehearsal failed${Number.isInteger(error.status) ? ` at closed stage ${error.status}` : ''}: ${error.message}\n`);
  if (typeof error.stderr === 'string' && error.stderr.includes('RST-005 isolated diagnostic:')) process.stderr.write(error.stderr);
  if (error.stdout && error.stdout.includes('rst005_evidence_delta')) process.stderr.write(error.stdout);
  process.exitCode = receivedSignal ? 128 + ({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[receivedSignal]) : 1;
});
