const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASELINE_COMMIT = 'dc6f0becbd45c7676cccec2ac42b9374b8e61101';
const AUTHORIZATION = 'RST-007A,RST-004,RST-008,RST-009A';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256(fs.readFileSync(file));
const sortedLines = (value) => `${String(value).split('\n').filter(Boolean).sort().join('\n')}\n`;
const withoutInitDbLog = (value) => `${String(value).split('\n').filter((line) => line && !line.endsWith('/initdb.log')).sort().join('\n')}\n`;

async function runPhase1CutoverRehearsal(context) {
  const { plan, signal, repositoryRoot, runCommand, compose, waitUntilReady, expectComposeFailure, assertDisposableConfig } = context;
  const password = process.env.MYSQL_PASSWORD || 'poc_pwd';
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD || 'poc_root_pwd';
  const baselineRoot = path.join(plan.artifactRoot, 'pre-cutover-source');
  const sourceArchive = path.join(plan.artifactRoot, 'pre-cutover-source.tar');
  const baselineDump = path.join(plan.artifactRoot, 'pre-cutover-database.sql');
  const metadata = path.join(plan.artifactRoot, 'pre-cutover-schema-metadata.txt');
  const documentsManifest = path.join(plan.artifactRoot, 'pre-cutover-documents.txt');
  const documentsArchive = path.join(plan.artifactRoot, 'pre-cutover-documents.tar');
  fs.mkdirSync(baselineRoot, { recursive: true });
  await runCommand('git', ['archive', '--format=tar', `--output=${sourceArchive}`, BASELINE_COMMIT], { signal });
  await runCommand('tar', ['-xf', sourceArchive, '-C', baselineRoot], { signal });

  const resolved = await compose(plan, ['config', '--format', 'json'], { sourceRoot: baselineRoot, quiet: true, signal });
  assertDisposableConfig(JSON.parse(resolved), { ...plan, repositoryRoot: baselineRoot });
  await compose(plan, ['up', '-d'], { sourceRoot: baselineRoot, signal });
  await waitUntilReady(plan, signal);
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { sourceRoot: baselineRoot, quiet: true, signal });

  const databaseDump = () => compose(plan, ['exec', '-T', 'mariadb', 'mariadb-dump', '-udolidbuser', `-p${password}`, '--skip-comments', '--skip-extended-insert', '--order-by-primary', 'dolidb'], { quiet: true, signal });
  const metadataSql = [
    "SELECT TABLE_NAME,ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME",
    "SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COALESCE(COLUMN_DEFAULT,'<NULL>'),EXTRA,GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION",
    "SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,INDEX_TYPE,SEQ_IN_INDEX,COLUMN_NAME,COLLATION,COALESCE(SUB_PART,0) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX",
    "SELECT CONSTRAINT_NAME,TABLE_NAME,REFERENCED_TABLE_NAME,UPDATE_RULE,DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() ORDER BY CONSTRAINT_NAME",
    "SELECT CONSTRAINT_NAME,CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() ORDER BY CONSTRAINT_NAME",
    "SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,EVENT_OBJECT_TABLE,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY TRIGGER_NAME",
    "SELECT name,value,entity FROM llx_const WHERE name LIKE 'MAIN_MODULE_%' OR name LIKE 'MJL_%' ORDER BY name,entity",
  ].join('; ');
  const captureMetadata = () => compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', `-p${password}`, '-N', '-B', 'dolidb', '-e', metadataSql], { quiet: true, signal });
  const captureDocumentsManifest = async (sourceRoot) => sortedLines(await compose(plan, ['run', '--rm', '--no-deps', '--entrypoint=find', 'dolibarr', '/var/www/documents', '-type', 'f', '-exec', 'sha256sum', '{}', '+'], { sourceRoot, quiet: true, signal }));

  fs.writeFileSync(baselineDump, await databaseDump(), { mode: 0o600 });
  fs.writeFileSync(metadata, await captureMetadata(), { mode: 0o600 });
  fs.writeFileSync(documentsManifest, await captureDocumentsManifest(baselineRoot), { mode: 0o600 });
  fs.writeFileSync(documentsArchive, await compose(plan, ['exec', '-T', 'dolibarr', 'tar', '-C', '/var/www/documents', '-cf', '-', '.'], { sourceRoot: baselineRoot, quiet: true, binary: true, signal }), { mode: 0o600 });

  const artifact = (file) => ({ path: `/opt/mjl-evidence/${path.basename(file)}`, sha256: sha256File(file) });
  const manifestData = {
    baseline_commit: BASELINE_COMMIT,
    source: artifact(sourceArchive),
    database: artifact(baselineDump),
    schema_metadata: artifact(metadata),
    documents_manifest: artifact(documentsManifest),
    documents_archive: artifact(documentsArchive),
  };
  const evidenceManifest = path.join(plan.artifactRoot, 'cutover-evidence.json');
  fs.writeFileSync(evidenceManifest, `${JSON.stringify(manifestData, null, 2)}\n`, { mode: 0o600 });
  await compose(plan, ['stop', 'dolibarr'], { sourceRoot: baselineRoot, signal });
  try {
    const response = await fetch(plan.baseUrl, { signal: AbortSignal.timeout(2000) });
    throw new Error(`Application traffic remained available after stop (HTTP ${response.status}).`);
  } catch (error) {
    if (!/fetch failed|aborted|timeout/i.test(error.message)) throw error;
  }

  const manifestPath = '/opt/mjl-evidence/cutover-evidence.json';
  const manifestHash = sha256File(evidenceManifest);
  const resetArgs = (mode, extra = [], environment = []) => ['run', '--rm', '--no-deps', ...environment.flatMap((value) => ['-e', value]), '-e', 'MJL_RST_PHASE1_TRAFFIC_STOPPED=1', '--entrypoint=php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst_phase1_reset.php', `--mode=${mode}`, `--confirm=${AUTHORIZATION}`, `--evidence-manifest=${manifestPath}`, `--evidence-sha256=${manifestHash}`, ...extra];
  const sql = (statement) => compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', `-p${password}`, 'dolidb', '-e', statement], { quiet: true, signal });
  const activateArgs = (environment = []) => ['run', '--rm', '--no-deps', ...environment.flatMap((value) => ['-e', value]), '--entrypoint=php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'];
  const mustCompose = async (args, label) => {
    try {
      return await compose(plan, args, { quiet: true, signal });
    } catch (error) {
      throw new Error(`${label}: ${String(error.output || error.message).trim()}`);
    }
  };
  const mustFailWith = async (args, label, pattern) => {
    const output = await expectComposeFailure(plan, args, label, { signal });
    if (!pattern.test(output)) throw new Error(`${label} failed for the wrong reason: ${output.trim()}`);
  };

  const assertBaselineState = async (label) => {
    const restoredDump = await databaseDump();
    if (sha256(restoredDump) !== sha256File(baselineDump)) {
      fs.writeFileSync(path.join(plan.artifactRoot, `${label}-database-mismatch.sql`), restoredDump, { mode: 0o600 });
      throw new Error(`${label}: database fingerprint differs from the pre-cutover state.`);
    }
    if (sha256(await captureMetadata()) !== sha256File(metadata)) throw new Error(`${label}: schema/trigger/module metadata fingerprint differs from the pre-cutover state.`);
    if (sha256(await captureDocumentsManifest(repositoryRoot)) !== sha256File(documentsManifest)) throw new Error(`${label}: document fingerprint differs from the pre-cutover state.`);
    if (sha256File(sourceArchive) !== manifestData.source.sha256) throw new Error(`${label}: source archive fingerprint differs from the pre-cutover state.`);
  };

  const restoreBaseline = async (label) => {
    await compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '-uroot', `-p${rootPassword}`, '-e', "DROP DATABASE dolidb; CREATE DATABASE dolidb CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci; GRANT ALL PRIVILEGES ON dolidb.* TO 'dolidbuser'@'%'; FLUSH PRIVILEGES"], { quiet: true, signal });
    await compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '-udolidbuser', `-p${password}`, 'dolidb'], { input: fs.readFileSync(baselineDump), quiet: true, signal });
    // This named volume was already proved disposable before startup. Clear only
    // its explicit document mount so the archive restore is an exact replacement.
    await compose(plan, ['run', '--rm', '--no-deps', '--entrypoint=find', 'dolibarr', '/var/www/documents', '-mindepth', '1', '-delete'], { quiet: true, signal });
    await compose(plan, ['run', '--rm', '--no-deps', '--entrypoint=tar', 'dolibarr', '-C', '/var/www/documents', '-xf', '-'], { input: fs.readFileSync(documentsArchive), quiet: true, signal });
    await assertBaselineState(label);
  };

  await mustFailWith(['run', '--rm', '--no-deps', '-e', 'MJL_RST_PHASE1_TRAFFIC_STOPPED=1', '--entrypoint=php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst_phase1_reset.php', '--mode=apply', `--confirm=${AUTHORIZATION}`, `--evidence-manifest=${manifestPath}`, `--evidence-sha256=${'0'.repeat(64)}`], 'bad evidence', /evidence manifest checksum mismatch/i);
  await assertBaselineState('bad-evidence');

  await sql("INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_RST_PHASE1_FAILURE_INJECTION','1','chaine',0,'disposable rehearsal',0) ON DUPLICATE KEY UPDATE value='1'");
  await mustFailWith(resetArgs('apply', ['--failure-point=after-activity-alter'], ['MJL_DISPOSABLE_TEST_TENANT=1']), 'interrupted apply', /Injected disposable failure after Activity alteration/);
  await mustCompose(resetArgs('rollback'), 'interrupted-apply rollback failed');
  await restoreBaseline('interrupted-apply-restore');

  await compose(plan, resetArgs('apply'), { quiet: true, signal });
  await sql("INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_RST_PHASE1_ACTIVATION_FAILURE_INJECTION','1','chaine',0,'disposable rehearsal',0) ON DUPLICATE KEY UPDATE value='1'");
  await mustFailWith(activateArgs(['MJL_RST_PHASE1_INJECT_ACTIVATION_FAILURE=1']), 'activation failure', /Failed to activate modMjlFinancement/);
  await mustCompose(resetArgs('rollback'), 'activation-failure rollback failed');
  await restoreBaseline('activation-failure-restore');

  await compose(plan, resetArgs('apply'), { quiet: true, signal });
  await compose(plan, activateArgs(), { quiet: true, signal });
  await mustCompose(resetArgs('rollback'), 'post-activation rollback failed');
  await restoreBaseline('post-activation-restore');

  await compose(plan, resetArgs('apply'), { quiet: true, signal });
  await compose(plan, activateArgs(), { quiet: true, signal });
  await compose(plan, activateArgs(), { quiet: true, signal });
  await compose(plan, resetArgs('finalize'), { quiet: true, signal });
  await compose(plan, ['up', '-d', '--force-recreate', 'dolibarr'], { signal });
  await waitUntilReady(plan, signal);
  const finalDocuments = await captureDocumentsManifest(repositoryRoot);
  if (withoutInitDbLog(finalDocuments) !== withoutInitDbLog(fs.readFileSync(documentsManifest, 'utf8'))) throw new Error('Final document fingerprint changed outside the ratification-scoped initdb.log exception.');
}

module.exports = { runPhase1CutoverRehearsal };
