const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASELINE_COMMIT = 'dc6f0becbd45c7676cccec2ac42b9374b8e61101';
const AUTHORIZATION = 'RST-007A,RST-004,RST-008,RST-009A';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256(fs.readFileSync(file));
const sortedLines = (value) => `${String(value).split('\n').filter(Boolean).sort().join('\n')}\n`;
const withoutInitDbLog = (value) => `${String(value).split('\n').filter((line) => line && !line.endsWith('/initdb.log')).sort().join('\n')}\n`;

function sourceTreeFingerprint(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isSymbolicLink()) entries.push(`link|${stat.mode & 0o777}|${relative}|${fs.readlinkSync(absolute)}`);
      else entries.push(`file|${stat.mode & 0o777}|${relative}|${sha256File(absolute)}`);
    }
  };
  visit(root);
  return sha256(`${entries.sort().join('\n')}\n`);
}

async function runPhase1CutoverRehearsal(context) {
  const { plan, signal, repositoryRoot, runCommand, compose, waitUntilReady, expectComposeFailure, assertDisposableConfig } = context;
  const baselineRoot = path.join(plan.artifactRoot, 'pre-cutover-source');
  const sourceArchive = path.join(plan.artifactRoot, 'pre-cutover-source.tar');
  const remediationArchive = path.join(plan.artifactRoot, 'remediation-source.tar');
  const baselineDump = path.join(plan.artifactRoot, 'pre-cutover-database.sql');
  const metadata = path.join(plan.artifactRoot, 'pre-cutover-schema-metadata.txt');
  const documentsManifest = path.join(plan.artifactRoot, 'pre-cutover-documents.txt');
  const documentsArchive = path.join(plan.artifactRoot, 'pre-cutover-documents.tar');

  const replaceSourceTree = async (archive) => {
    if (path.dirname(baselineRoot) !== plan.artifactRoot) throw new Error('Temporary source root escaped the disposable artifact directory.');
    fs.rmSync(baselineRoot, { recursive: true, force: true });
    fs.mkdirSync(baselineRoot, { recursive: true });
    await runCommand('tar', ['-xf', archive, '-C', baselineRoot], { signal });
  };

  try {
    const dirty = await runCommand('git', ['status', '--porcelain'], { quiet: true, signal });
    if (dirty.trim() !== '') throw new Error('Phase 1 cutover rehearsal requires a clean worktree so the deployed remediation source is exact.');
    await runCommand('git', ['archive', '--format=tar', `--output=${sourceArchive}`, BASELINE_COMMIT], { signal });
    await runCommand('git', ['archive', '--format=tar', `--output=${remediationArchive}`, 'HEAD'], { signal });
    await replaceSourceTree(sourceArchive);
    const baselineSourceFingerprint = sourceTreeFingerprint(baselineRoot);

    const resolved = await compose(plan, ['config', '--format', 'json'], { sourceRoot: baselineRoot, quiet: true, signal });
    assertDisposableConfig(JSON.parse(resolved), { ...plan, repositoryRoot: baselineRoot });
    await compose(plan, ['up', '-d'], { sourceRoot: baselineRoot, signal });
    await waitUntilReady(plan, signal);
    await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { sourceRoot: baselineRoot, quiet: true, signal });

    const atSource = (args, options = {}) => compose(plan, args, { ...options, sourceRoot: baselineRoot, signal });
    await atSource(['exec', '-T', 'mariadb', 'sh', '-ceu', 'umask 077; mkdir -p /run/mjl-test; target=/run/mjl-test/client.cnf; temporary=/run/mjl-test/client.cnf.new; printf "[client]\\nuser=%s\\npassword=%s\\n[client_root]\\nuser=root\\npassword=%s\\n" "$MYSQL_USER" "$MYSQL_PASSWORD" "$MYSQL_ROOT_PASSWORD" > "$temporary"; chmod 0600 "$temporary"; mv "$temporary" "$target"'], { quiet: true });
    const databaseDump = () => atSource(['exec', '-T', 'mariadb', 'mariadb-dump', '--defaults-extra-file=/run/mjl-test/client.cnf', '--skip-comments', '--skip-extended-insert', '--order-by-primary', 'dolidb'], { quiet: true });
    const databaseSql = (statement, options = {}) => atSource(['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', ...(options.root ? ['--defaults-group-suffix=_root'] : []), ...(options.scalar ? ['-N', '-B'] : []), ...(options.database === false ? [] : ['dolidb'])], { quiet: true, input: `${statement}\n` });
    const metadataSql = [
      "SELECT TABLE_NAME,ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME",
      "SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COALESCE(COLUMN_DEFAULT,'<NULL>'),EXTRA,GENERATION_EXPRESSION,CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION",
      "SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,INDEX_TYPE,SEQ_IN_INDEX,COLUMN_NAME,COLLATION,COALESCE(SUB_PART,0) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX",
      "SELECT CONSTRAINT_NAME,TABLE_NAME,REFERENCED_TABLE_NAME,UPDATE_RULE,DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() ORDER BY CONSTRAINT_NAME",
      "SELECT CONSTRAINT_NAME,CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() ORDER BY CONSTRAINT_NAME",
      "SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,EVENT_OBJECT_TABLE,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY TRIGGER_NAME",
      "SELECT name,value,entity FROM llx_const WHERE name LIKE 'MAIN_MODULE_%' OR name LIKE 'MJL_%' ORDER BY name,entity",
    ].join('; ');
    const captureMetadata = () => databaseSql(metadataSql, { scalar: true });
    const captureDocumentsManifest = async (sourceRoot) => sortedLines(await compose(plan, ['run', '--rm', '--no-deps', '--entrypoint=find', 'dolibarr', '/var/www/documents', '-type', 'f', '-exec', 'sha256sum', '{}', '+'], { sourceRoot, quiet: true, signal }));
    const assertPreCaptureBaseline = async () => {
      const adminCounts = (await databaseSql("SELECT COUNT(*),SUM(rowid=1 AND entity=0 AND login='admin' AND admin=1 AND statut=1),SUM(admin=1) FROM llx_user", { scalar: true })).trim();
      if (adminCounts !== '1\t1\t1') throw new Error(`Pre-capture administrator invariant failed: ${adminCounts}`);
      const nativeBusinessCounts = (await databaseSql('SELECT (SELECT COUNT(*) FROM llx_societe),(SELECT COUNT(*) FROM llx_projet),(SELECT COUNT(*) FROM llx_ecm_files)', { scalar: true })).trim();
      if (nativeBusinessCounts !== '0\t0\t0') throw new Error(`Pre-capture native business state is not empty: ${nativeBusinessCounts}`);
      const customTables = (await databaseSql("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME LIKE 'llx\\_mjlfinancement\\_%' ORDER BY TABLE_NAME", { scalar: true })).trim().split('\n').filter(Boolean);
      for (const table of customTables) {
        if (!/^llx_mjlfinancement_[a-z0-9_]+$/.test(table)) throw new Error(`Unexpected custom table name in baseline: ${table}`);
        const count = (await databaseSql(`SELECT COUNT(*) FROM ${table}`, { scalar: true })).trim();
        if (count !== '0') throw new Error(`Pre-capture custom business table is not empty: ${table}=${count}`);
      }
    };

    await assertPreCaptureBaseline();

    fs.writeFileSync(baselineDump, await databaseDump(), { mode: 0o600 });
    fs.writeFileSync(metadata, await captureMetadata(), { mode: 0o600 });
    fs.writeFileSync(documentsManifest, await captureDocumentsManifest(baselineRoot), { mode: 0o600 });
    fs.writeFileSync(documentsArchive, await atSource(['exec', '-T', 'dolibarr', 'tar', '-C', '/var/www/documents', '-cf', '-', '.'], { quiet: true, binary: true }), { mode: 0o600 });

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
    await atSource(['stop', 'dolibarr']);
    try {
      const response = await fetch(plan.baseUrl, { signal: AbortSignal.timeout(2000) });
      throw new Error(`Application traffic remained available after stop (HTTP ${response.status}).`);
    } catch (error) {
      if (!/fetch failed|aborted|timeout/i.test(error.message)) throw error;
    }
    await replaceSourceTree(remediationArchive);
    const remediationSourceFingerprint = sourceTreeFingerprint(baselineRoot);

    const manifestPath = '/opt/mjl-evidence/cutover-evidence.json';
    const manifestHash = sha256File(evidenceManifest);
    const resetArgs = (mode, extra = [], environment = []) => ['run', '--rm', '--no-deps', ...environment.flatMap((value) => ['-e', value]), '-e', 'MJL_RST_PHASE1_TRAFFIC_STOPPED=1', '--entrypoint=php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst_phase1_reset.php', `--mode=${mode}`, `--confirm=${AUTHORIZATION}`, `--evidence-manifest=${manifestPath}`, `--evidence-sha256=${manifestHash}`, ...extra];
    const sql = (statement) => databaseSql(statement);
    const activateArgs = (environment = []) => ['run', '--rm', '--no-deps', ...environment.flatMap((value) => ['-e', value]), '--entrypoint=php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'];
    const mustCompose = async (args, label) => {
      try { return await atSource(args, { quiet: true }); }
      catch (error) { throw new Error(`${label}: ${String(error.output || error.message).trim()}`); }
    };
    const mustFailWith = async (args, label, pattern) => {
      const output = await expectComposeFailure(plan, args, label, { sourceRoot: baselineRoot, signal });
      if (!pattern.test(output)) throw new Error(`${label} failed for the wrong reason: ${output.trim()}`);
    };
    const assertRejectedWithoutMutation = async (label) => {
      if (sha256(await databaseDump()) !== sha256File(baselineDump)) throw new Error(`${label}: rejected preflight mutated the database.`);
      if (sha256(await captureMetadata()) !== sha256File(metadata)) throw new Error(`${label}: rejected preflight mutated schema or module metadata.`);
      if (sha256(await captureDocumentsManifest(baselineRoot)) !== sha256File(documentsManifest)) throw new Error(`${label}: rejected preflight mutated documents.`);
      if (sourceTreeFingerprint(baselineRoot) !== remediationSourceFingerprint) throw new Error(`${label}: rejected preflight mutated deployed source.`);
    };
    const assertBaselineState = async (label) => {
      const restoredDump = await databaseDump();
      if (sha256(restoredDump) !== sha256File(baselineDump)) {
        fs.writeFileSync(path.join(plan.artifactRoot, `${label}-database-mismatch.sql`), restoredDump, { mode: 0o600 });
        throw new Error(`${label}: database fingerprint differs from the pre-cutover state.`);
      }
      if (sha256(await captureMetadata()) !== sha256File(metadata)) throw new Error(`${label}: schema/trigger/module metadata fingerprint differs from the pre-cutover state.`);
      if (sha256(await captureDocumentsManifest(baselineRoot)) !== sha256File(documentsManifest)) throw new Error(`${label}: document fingerprint differs from the pre-cutover state.`);
      if (sourceTreeFingerprint(baselineRoot) !== baselineSourceFingerprint) throw new Error(`${label}: restored source tree differs from the pre-cutover state.`);
    };
    const restoreBaseline = async (label) => {
      await replaceSourceTree(sourceArchive);
      await databaseSql("DROP DATABASE dolidb; CREATE DATABASE dolidb CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci; GRANT ALL PRIVILEGES ON dolidb.* TO 'dolidbuser'@'%'; FLUSH PRIVILEGES", { root: true, database: false });
      await databaseSql(fs.readFileSync(baselineDump));
      await atSource(['run', '--rm', '--no-deps', '--entrypoint=find', 'dolibarr', '/var/www/documents', '-mindepth', '1', '-delete'], { quiet: true });
      await atSource(['run', '--rm', '--no-deps', '--entrypoint=tar', 'dolibarr', '-C', '/var/www/documents', '-xf', '-'], { input: fs.readFileSync(documentsArchive), quiet: true });
      await assertBaselineState(label);
    };
    const scenario = async (label, action) => {
      let actionFailure = null;
      try { await action(); } catch (error) { actionFailure = error; }
      try { await restoreBaseline(`${label}-restore`); }
      catch (restoreFailure) {
        throw new Error(`${label} cleanup failed${actionFailure ? ` after ${actionFailure.message}` : ''}: ${restoreFailure.message}`);
      }
      await replaceSourceTree(remediationArchive);
      if (actionFailure) throw actionFailure;
    };

    await scenario('bad-evidence', async () => {
      await mustFailWith(['run', '--rm', '--no-deps', '-e', 'MJL_RST_PHASE1_TRAFFIC_STOPPED=1', '--entrypoint=php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst_phase1_reset.php', '--mode=apply', `--confirm=${AUTHORIZATION}`, `--evidence-manifest=${manifestPath}`, `--evidence-sha256=${'0'.repeat(64)}`], 'bad evidence', /evidence manifest checksum mismatch/i);
      await assertRejectedWithoutMutation('bad evidence');
    });
    await scenario('missing-evidence-manifest', async () => {
      await mustFailWith(['run', '--rm', '--no-deps', '-e', 'MJL_RST_PHASE1_TRAFFIC_STOPPED=1', '--entrypoint=php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst_phase1_reset.php', '--mode=apply', `--confirm=${AUTHORIZATION}`, `--evidence-sha256=${manifestHash}`], 'missing evidence manifest', /checksummed cutover evidence manifest is required/i);
      await assertRejectedWithoutMutation('missing evidence manifest');
    });
    await scenario('missing-evidence-checksum', async () => {
      await mustFailWith(['run', '--rm', '--no-deps', '-e', 'MJL_RST_PHASE1_TRAFFIC_STOPPED=1', '--entrypoint=php', 'dolibarr', '/var/www/html/custom/mjlfinancement/scripts/rst_phase1_reset.php', '--mode=apply', `--confirm=${AUTHORIZATION}`, `--evidence-manifest=${manifestPath}`], 'missing evidence checksum', /checksummed cutover evidence manifest is required/i);
      await assertRejectedWithoutMutation('missing evidence checksum');
    });
    await scenario('missing-evidence-artifact', async () => {
      const originalManifest = fs.readFileSync(evidenceManifest);
      try {
        const missingArtifactManifest = JSON.parse(originalManifest.toString('utf8'));
        missingArtifactManifest.source.path = '/opt/mjl-evidence/intentionally-missing-source.tar';
        fs.writeFileSync(evidenceManifest, `${JSON.stringify(missingArtifactManifest, null, 2)}\n`, { mode: 0o600 });
        await mustFailWith(resetArgs('apply').map((argument) => argument.startsWith('--evidence-sha256=') ? `--evidence-sha256=${sha256File(evidenceManifest)}` : argument), 'missing evidence artifact', /missing readable source artifact metadata/i);
        await assertRejectedWithoutMutation('missing evidence artifact');
      } finally {
        fs.writeFileSync(evidenceManifest, originalManifest, { mode: 0o600 });
      }
    });
    await scenario('interrupted-apply', async () => {
      await sql("INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_RST_PHASE1_FAILURE_INJECTION','1','chaine',0,'disposable rehearsal',0) ON DUPLICATE KEY UPDATE value='1'");
      await mustFailWith(resetArgs('apply', ['--failure-point=after-activity-alter'], ['MJL_DISPOSABLE_TEST_TENANT=1']), 'interrupted apply', /Injected disposable failure after Activity alteration/);
      await mustCompose(resetArgs('rollback'), 'interrupted-apply rollback failed');
    });
    await scenario('activation-failure', async () => {
      await atSource(resetArgs('apply'), { quiet: true });
      await sql("INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_RST_PHASE1_ACTIVATION_FAILURE_INJECTION','1','chaine',0,'disposable rehearsal',0) ON DUPLICATE KEY UPDATE value='1'");
      await mustFailWith(activateArgs(['MJL_RST_PHASE1_INJECT_ACTIVATION_FAILURE=1']), 'activation failure', /Failed to activate modMjlFinancement/);
      await mustCompose(resetArgs('rollback'), 'activation-failure rollback failed');
    });
    await scenario('post-activation', async () => {
      await atSource(resetArgs('apply'), { quiet: true });
      await atSource(activateArgs(), { quiet: true });
      await mustCompose(resetArgs('rollback'), 'post-activation rollback failed');
    });

    await atSource(resetArgs('apply'), { quiet: true });
    await atSource(activateArgs(), { quiet: true });
    await atSource(activateArgs(), { quiet: true });
    await atSource(resetArgs('finalize'), { quiet: true });
    await compose(plan, ['up', '-d', '--force-recreate', 'dolibarr'], { sourceRoot: repositoryRoot, signal });
    await waitUntilReady(plan, signal);
    const finalDocuments = await captureDocumentsManifest(repositoryRoot);
    if (withoutInitDbLog(finalDocuments) !== withoutInitDbLog(fs.readFileSync(documentsManifest, 'utf8'))) throw new Error('Final document fingerprint changed outside the ratification-scoped initdb.log exception.');
  } finally {
    if (path.dirname(baselineRoot) === plan.artifactRoot) fs.rmSync(baselineRoot, { recursive: true, force: true });
    fs.rmSync(remediationArchive, { force: true });
  }
}

module.exports = { runPhase1CutoverRehearsal };
