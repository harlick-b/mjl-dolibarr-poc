const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function moduleTreeSha(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        if (relative !== 'scripts/rst005_activity_foundation.php') entries.push(`file|${relative}|${sha256(fs.readFileSync(absolute))}`);
      } else throw new Error(`RST-005 source fingerprint refuses non-file entry: ${relative}`);
    }
  };
  visit(root);
  return sha256(`${entries.sort().join('\n')}\n`);
}

const encryptScript = String.raw`$key=stream_get_contents(fopen('php://fd/3','rb'));if(strlen($key)!==SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_KEYBYTES)exit(91);[$state,$header]=sodium_crypto_secretstream_xchacha20poly1305_init_push($key);fwrite(STDOUT,$header);while(!feof(STDIN)){ $plain=fread(STDIN,65536);if($plain===false)exit(92);if($plain==='')continue;$cipher=sodium_crypto_secretstream_xchacha20poly1305_push($state,$plain,'',SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_MESSAGE);fwrite(STDOUT,pack('N',strlen($cipher)).$cipher);sodium_memzero($plain);} $final=sodium_crypto_secretstream_xchacha20poly1305_push($state,'','',SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL);fwrite(STDOUT,pack('N',strlen($final)).$final);sodium_memzero($key);`;
const decryptScript = String.raw`function exact($h,$n){$v='';while(strlen($v)<$n&&!feof($h)){$c=fread($h,$n-strlen($v));if($c===false)exit(92);$v.=$c;}return strlen($v)===$n?$v:false;}$key=stream_get_contents(fopen('php://fd/3','rb'));$header=exact(STDIN,SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_HEADERBYTES);if(strlen($key)!==SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_KEYBYTES||$header===false)exit(91);$state=sodium_crypto_secretstream_xchacha20poly1305_init_pull($header,$key);$final=false;while(!feof(STDIN)){ $len=exact(STDIN,4);if($len===false)break;$size=unpack('N',$len)[1];if($size<17||$size>65553)exit(93);$cipher=exact(STDIN,$size);if($cipher===false)exit(94);$result=sodium_crypto_secretstream_xchacha20poly1305_pull($state,$cipher);if($result===false||$final)exit(95);fwrite(STDOUT,$result[0]);$final=$result[1]===SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL;}if(!$final)exit(96);sodium_memzero($key);`;

function composeSpawnEnvironment(plan, repositoryRoot) {
  return {
    ...process.env,
    COMPOSE_PROJECT_NAME: plan.projectName,
    COMPOSE_FILE: `${path.join(repositoryRoot, 'docker-compose.yml')}:${plan.composeFile}`,
    MJL_BASE_URL: plan.baseUrl,
    MJL_TEST_PORT: String(plan.port),
    MJL_REPOSITORY_ROOT: repositoryRoot,
    MJL_EVIDENCE_ROOT: plan.evidenceRoot,
    MJL_DISPOSABLE_RUN_SENTINEL: plan.sentinel,
    MJL_TEST_USER_PASSWORD: plan.testUserPassword,
  };
}

function waitChild(child, label) {
  return new Promise((resolve, reject) => {
    const errors = [];
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${label} failed (${code}): ${Buffer.concat(errors)}`)));
  });
}

async function waitPipeline(children) {
  const pending = children.map(([child, label]) => waitChild(child, label));
  try {
    await Promise.all(pending);
  } catch (error) {
    for (const [child] of children) if (child.exitCode === null) child.kill('SIGTERM');
    await Promise.allSettled(pending);
    throw error;
  }
}

async function streamEncryptedDump(plan, repositoryRoot, keyPath, cipherPath, schemaOnly, signal) {
  const args = ['compose', 'exec', '-T', 'mariadb', 'mariadb-dump', '--defaults-extra-file=/run/mjl-test/client.cnf', '--routines', '--events', '--triggers', ...(schemaOnly ? ['--no-data'] : ['--order-by-primary']), '--skip-comments', 'dolidb'];
  const dump = spawn('docker', args, { env: composeSpawnEnvironment(plan, repositoryRoot), stdio: ['ignore', 'pipe', 'pipe'], signal });
  const keyFd = fs.openSync(keyPath, 'r');
  const encrypt = spawn('php', ['-r', encryptScript], { stdio: ['pipe', 'pipe', 'pipe', keyFd], signal });
  fs.closeSync(keyFd);
  const destination = fs.createWriteStream(cipherPath, { mode: 0o600 });
  const digest = crypto.createHash('sha256');
  dump.stdout.on('data', (chunk) => digest.update(chunk));
  dump.stdout.pipe(encrypt.stdin);
  encrypt.stdout.pipe(destination);
  await Promise.all([waitPipeline([[dump, 'mariadb-dump'], [encrypt, 'secretstream encryption']]), new Promise((resolve, reject) => destination.once('finish', resolve).once('error', reject))]);
  return digest.digest('hex');
}

async function streamRestore(plan, repositoryRoot, keyPath, cipherPath, database, signal) {
  const keyFd = fs.openSync(keyPath, 'r');
  const decrypt = spawn('php', ['-r', decryptScript], { stdio: ['pipe', 'pipe', 'pipe', keyFd], signal });
  fs.closeSync(keyFd);
  const restore = spawn('docker', ['compose', 'exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', '--defaults-group-suffix=_root', database], { env: composeSpawnEnvironment(plan, repositoryRoot), stdio: ['pipe', 'ignore', 'pipe'], signal });
  fs.createReadStream(cipherPath).pipe(decrypt.stdin);
  decrypt.stdout.pipe(restore.stdin);
  await waitPipeline([[decrypt, 'fresh-process secretstream restore'], [restore, 'isolated database restore']]);
}

async function streamDumpHash(plan, repositoryRoot, database, schemaOnly, signal) {
  const child = spawn('docker', ['compose', 'exec', '-T', 'mariadb', 'mariadb-dump', '--defaults-extra-file=/run/mjl-test/client.cnf', '--defaults-group-suffix=_root', '--routines', '--events', '--triggers', ...(schemaOnly ? ['--no-data'] : ['--order-by-primary']), '--skip-comments', database], { env: composeSpawnEnvironment(plan, repositoryRoot), stdio: ['ignore', 'pipe', 'pipe'], signal });
  const digest = crypto.createHash('sha256');
  child.stdout.on('data', (chunk) => digest.update(chunk));
  child.stdout.resume();
  await waitChild(child, 'restored database dump');
  return digest.digest('hex');
}

async function runRst005CutoverRehearsal(context) {
  const { plan, signal, repositoryRoot, compose, databaseSql } = context;
  let backupDirectory = null;
  let keyDirectory = null;
  try {
  const phase1Oracle = fs.readFileSync(path.join(repositoryRoot, 'docs/mjl-rst-005-phase1-activity-schema.sql'), 'utf8');
  const targetOracle = fs.readFileSync(path.join(repositoryRoot, 'docs/mjl-rst-005-target-activity-schema.sql'), 'utf8');
  const php = '/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php';
  const verifier = '/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_foundation.php';
  const evidenceScript = '/opt/mjl-tests/fixtures/database-evidence.php';
  const runPhp = (args, environment = []) => compose(plan, ['exec', '-T', ...environment.flatMap((entry) => ['-e', entry]), 'dolibarr', 'php', php, ...args], { quiet: true, signal });
  const rootSql = (sql, database) => compose(plan, ['exec', '-T', 'mariadb', 'mariadb', '--defaults-extra-file=/run/mjl-test/client.cnf', '--defaults-group-suffix=_root', ...(database ? [database] : [])], { quiet: true, signal, input: sql });
  const captureEvidence = async () => JSON.parse(await compose(plan, ['exec', '-T', '--user', 'www-data', 'dolibarr', 'php', evidenceScript], { quiet: true, signal }));
  const captureRestoreEvidence = async (database) => JSON.parse(await compose(plan, ['exec', '-T', '-e', `DOLI_DB_NAME=${database}`, '-e', 'MJL_RST005_RESTORE_EVIDENCE=1', '--user', 'www-data', 'dolibarr', 'php', evidenceScript], { quiet: true, signal }));
  const captureStableEvidence = async () => {
    let previous = await captureEvidence();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await captureEvidence();
      if (JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
    }
    throw new Error('RST-005 complete evidence did not stabilize.');
  };

  const prefixProbe = String.raw`class DoliDB{private $v;function __construct($v){$this->v=$v;}function prefix(){return $this->v;}}require $argv[1];$suffix='mjlfinancement_activity_rst005_phase1_quarantine';$boundary='p'.str_repeat('x',64-strlen($suffix)-1);$ok=array(mjl_rst005_prefix(new DoliDB('tenant7_')),mjl_rst005_prefix(new DoliDB($boundary)));$rejected=0;foreach(array('llx_;DROP_TABLE',$boundary.'x','pré_') as $p){try{mjl_rst005_prefix(new DoliDB($p));}catch(RuntimeException $e){$rejected++;}}try{mjl_rst005_validate_derived_identifiers(array('duplicate','duplicate'));}catch(RuntimeException $e){$rejected++;}$a=mjl_rst005_lock_name_from_parts('db-a','tenant7_');$b=mjl_rst005_lock_name_from_parts('db-b','tenant7_');if($ok[0]!=='tenant7_'||strlen($ok[1].$suffix)!==64||$rejected!==4||$a===$b||strlen($a)>64)exit(97);echo 'prefix-probes-ok';`;
  const prefixResult = await compose(plan, ['exec', '-T', 'dolibarr', 'php', '-r', prefixProbe, '/var/www/html/custom/mjlfinancement/scripts/activity_schema_installer.lib.php'], { quiet: true, signal });
  if (prefixResult.trim() !== 'prefix-probes-ok') throw new Error('RST-005 prefix/identifier probes did not pass.');
  const alternatePrefix = 'tenant7_';
  const prefixDatabase = 'rst005_prefix_probe';
  try {
    await rootSql(`DROP DATABASE IF EXISTS ${prefixDatabase}; CREATE DATABASE ${prefixDatabase} CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci; GRANT SELECT, SHOW VIEW, TRIGGER ON ${prefixDatabase}.* TO 'dolidbuser'@'%';`);
    await rootSql(`CREATE TABLE ${alternatePrefix}societe(rowid int(11) NOT NULL PRIMARY KEY,entity int(11)); CREATE TABLE ${alternatePrefix}user(rowid int(11) NOT NULL PRIMARY KEY,entity int(11)); CREATE TABLE ${alternatePrefix}projet(rowid int(11) NOT NULL PRIMARY KEY,entity int(11),fk_soc int(11));`, prefixDatabase);
    await rootSql(targetOracle.replaceAll('llx_', alternatePrefix), prefixDatabase);
    const physicalOutput = (await rootSql(`SELECT CONCAT((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='${alternatePrefix}mjlfinancement_activity'),':',(SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='${alternatePrefix}mjlfinancement_activity'),':',(SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='${alternatePrefix}mjlfinancement_activity'));`, prefixDatabase)).trim();
    const physical = physicalOutput.split('\n').at(-1);
    if (physical !== '20:9:3') throw new Error(`RST-005 alternate-prefix physical oracle mismatch: ${physical}`);
    const alternateVerifier = String.raw`define('NOLOGIN',1);require '/var/www/html/main.inc.php';require_once '/var/www/html/custom/mjlfinancement/scripts/activity_schema_installer.lib.php';if(!$db->select_db($argv[1]))exit(91);$db->prefix_db=$argv[2];mjl_rst005_require_target_objects($db,$argv[2].'mjlfinancement_activity');echo 'alternate-prefix-exact';`;
    const alternateResult = await compose(plan, ['exec', '-T', 'dolibarr', 'php', '-r', alternateVerifier, prefixDatabase, alternatePrefix], { quiet: true, signal });
    if (alternateResult.trim() !== 'alternate-prefix-exact') throw new Error('RST-005 alternate-prefix exhaustive structured verifier failed.');
  } finally {
    const prefixCleanupOutput = await rootSql(`GRANT SELECT, SHOW VIEW, TRIGGER ON ${prefixDatabase}.* TO 'dolidbuser'@'%'; REVOKE SELECT, SHOW VIEW, TRIGGER ON ${prefixDatabase}.* FROM 'dolidbuser'@'%'; DROP DATABASE IF EXISTS ${prefixDatabase}; SELECT (SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${prefixDatabase}')+(SELECT COUNT(*) FROM mysql.db WHERE User='dolidbuser' AND Db='${prefixDatabase}');`);
    if (prefixCleanupOutput.trim().split('\n').at(-1) !== '0') throw new Error('RST-005 alternate-prefix database or grant survived cleanup.');
  }

  await databaseSql(plan, 'DROP TABLE llx_mjlfinancement_activity', { quiet: true, signal });
  await databaseSql(plan, phase1Oracle, { quiet: true, signal });
  await runPhp(['--mode=preflight']);

  const parsed = await captureStableEvidence();
  backupDirectory = fs.mkdtempSync('/tmp/mjl-rst005-backup-');
  fs.chmodSync(backupDirectory, 0o700);
  keyDirectory = fs.mkdtempSync('/tmp/mjl-rst005-key-');
  fs.chmodSync(keyDirectory, 0o700);
  const keyPath = path.join(keyDirectory, 'custodied.key');
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  key.fill(0);
  const schemaCipherPath = path.join(backupDirectory, 'schema.secretstream');
  const fullCipherPath = path.join(backupDirectory, 'full.secretstream');
  let schemaPlainSha;
  let fullPlainSha;
  const restoreSuffix = plan.sentinel.slice(0, 12);
  const schemaDatabase = `rst005_schema_restore_${restoreSuffix}`;
  const fullDatabase = `rst005_full_restore_${restoreSuffix}`;
  try {
    schemaPlainSha = await streamEncryptedDump(plan, repositoryRoot, keyPath, schemaCipherPath, true, signal);
    fullPlainSha = await streamEncryptedDump(plan, repositoryRoot, keyPath, fullCipherPath, false, signal);
    await rootSql(`DROP DATABASE IF EXISTS ${schemaDatabase}; CREATE DATABASE ${schemaDatabase} CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci; GRANT SELECT, SHOW VIEW, TRIGGER, EXECUTE, EVENT ON ${schemaDatabase}.* TO 'dolidbuser'@'%';`);
    await streamRestore(plan, repositoryRoot, keyPath, schemaCipherPath, schemaDatabase, signal);
    await rootSql(`DROP DATABASE IF EXISTS ${fullDatabase}; CREATE DATABASE ${fullDatabase} CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci; GRANT SELECT, SHOW VIEW, TRIGGER, EXECUTE, EVENT ON ${fullDatabase}.* TO 'dolidbuser'@'%';`);
    await streamRestore(plan, repositoryRoot, keyPath, fullCipherPath, fullDatabase, signal);
    if (await streamDumpHash(plan, repositoryRoot, schemaDatabase, true, signal) !== schemaPlainSha) throw new Error('RST-005 encrypted schema backup restore digest mismatch.');
    if (await streamDumpHash(plan, repositoryRoot, fullDatabase, false, signal) !== fullPlainSha) throw new Error('RST-005 encrypted full backup restore digest mismatch.');
    let restoreBoundaryRejected = false;
    try {
      await compose(plan, ['exec', '-T', '-e', `DOLI_DB_NAME=${fullDatabase}`, '-e', 'MJL_RST005_RESTORE_EVIDENCE=1', '-e', 'MJL_DISPOSABLE_TEST_TENANT=0', '--user', 'www-data', 'dolibarr', 'php', evidenceScript], { quiet: true, signal });
    } catch (error) { restoreBoundaryRejected = /Database evidence capture failed/i.test(String(error.output || error.message)); }
    if (!restoreBoundaryRejected) throw new Error('RST-005 restored-database evidence accepted a non-disposable caller.');
    const restoredFullEvidence = await captureRestoreEvidence(fullDatabase);
    if (restoredFullEvidence.restorable_database_sha256 !== parsed.restorable_database_sha256) {
      const differingTables = Object.keys(parsed.restorable_table_sha256).filter((table) => parsed.restorable_table_sha256[table] !== restoredFullEvidence.restorable_table_sha256[table]);
      const differingObjects = Object.keys(parsed.restorable_schema_object_sha256).filter((kind) => parsed.restorable_schema_object_sha256[kind] !== restoredFullEvidence.restorable_schema_object_sha256[kind]);
      const databaseDefinitionDiffers = parsed.restorable_database_definition_sha256 !== restoredFullEvidence.restorable_database_definition_sha256;
      throw new Error(`RST-005 restored full backup does not match complete preflight restorable-logical database evidence (database_definition=${databaseDefinitionDiffers}; tables=${differingTables.join(',') || 'none'}; schema_objects=${differingObjects.join(',') || 'none'}).`);
    }
  } finally {
    const cleanupOutput = await rootSql(`GRANT SELECT, SHOW VIEW, TRIGGER, EXECUTE, EVENT ON ${schemaDatabase}.* TO 'dolidbuser'@'%'; GRANT SELECT, SHOW VIEW, TRIGGER, EXECUTE, EVENT ON ${fullDatabase}.* TO 'dolidbuser'@'%'; REVOKE SELECT, SHOW VIEW, TRIGGER, EXECUTE, EVENT ON ${schemaDatabase}.* FROM 'dolidbuser'@'%'; REVOKE SELECT, SHOW VIEW, TRIGGER, EXECUTE, EVENT ON ${fullDatabase}.* FROM 'dolidbuser'@'%'; DROP DATABASE IF EXISTS ${schemaDatabase}; DROP DATABASE IF EXISTS ${fullDatabase}; SELECT (SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN ('${schemaDatabase}','${fullDatabase}'))+(SELECT COUNT(*) FROM mysql.db WHERE User='dolidbuser' AND Db IN ('${schemaDatabase}','${fullDatabase}'));`);
    if (cleanupOutput.trim().split('\n').at(-1) !== '0') throw new Error('RST-005 restored databases or grants survived cleanup.');
  }
  await compose(plan, ['exec', '-T', 'dolibarr', 'sh', '-ceu', 'umask 077; mkdir -p /tmp/rst005-evidence; chmod 0700 /tmp/rst005-evidence'], { quiet: true, signal });
  await compose(plan, ['cp', schemaCipherPath, 'dolibarr:/tmp/rst005-evidence/schema.secretstream'], { quiet: true, signal });
  await compose(plan, ['cp', fullCipherPath, 'dolibarr:/tmp/rst005-evidence/full.secretstream'], { quiet: true, signal });
  await compose(plan, ['exec', '-T', 'dolibarr', 'chmod', '0600', '/tmp/rst005-evidence/schema.secretstream', '/tmp/rst005-evidence/full.secretstream'], { quiet: true, signal });
  const sealedPreflight = JSON.parse(await runPhp(['--mode=preflight']));
  const artifact = (file) => ({ path: `/tmp/rst005-evidence/${path.basename(file)}`, sha256: sha256(fs.readFileSync(file)), encryption: 'libsodium-secretstream-xchacha20poly1305', mode: '0600' });
  let manifest = {
    source: { sha256: moduleTreeSha(path.join(repositoryRoot, 'custom/mjlfinancement')), kind: 'mjl-dependent-module-tree-v2' },
    schema: { sha256: 'db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2', kind: 'rst005-phase1-logical-oracle-v1' },
    database: { sha256: parsed.database_sha256 },
    protected_tables: { sha256: sealedPreflight.protected_tables_sha256, kind: 'rst005-non-activity-database-v2' },
    documents: { sha256: parsed.documents_sha256 },
    ecm: { sha256: parsed.ecm_sha256 },
    backup_schema: { ...artifact(schemaCipherPath), plaintext_sha256: schemaPlainSha },
    backup_full: { ...artifact(fullCipherPath), plaintext_sha256: fullPlainSha },
    backup_restore: { sha256: sha256(`${schemaPlainSha}:${fullPlainSha}:fresh-process-verified`), verified: true, schema_sha256: schemaPlainSha, full_sha256: fullPlainSha, fresh_process: true },
    checkpoint: { sha256: sha256('preflight-pre-activation'), kind: 'preflight-pre-activation' },
  };
  const manifestPath = path.join(plan.artifactRoot, 'rst005-cutover-evidence.json');
  let evidenceArgs;
  const sealManifest = () => {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    evidenceArgs = [`--confirm=RST-005`, `--evidence-manifest=/opt/mjl-evidence/${path.basename(manifestPath)}`, `--evidence-sha256=${sha256(fs.readFileSync(manifestPath))}`];
  };
  sealManifest();
  const environment = ['MJL_RST005_TRAFFIC_STOPPED=1', 'MJL_DISPOSABLE_TEST_TENANT=1'];
  let sharedMutationRejected = false;
  try { await runPhp(['--mode=apply', ...evidenceArgs], ['MJL_RST005_TRAFFIC_STOPPED=1', 'MJL_DISPOSABLE_TEST_TENANT=0']); }
  catch (error) { sharedMutationRejected = /shared mutation is disabled pending separate approval/i.test(String(error.output || error.message)); }
  if (!sharedMutationRejected) throw new Error('RST-005 mutating orchestrator accepted a non-disposable caller.');

  const restartDatabase = async () => {
    await compose(plan, ['restart', 'mariadb'], { quiet: true, signal });
    await compose(plan, ['exec', '-T', 'mariadb', 'sh', '-ceu', 'umask 077; mkdir -p /run/mjl-test; target=/run/mjl-test/client.cnf; temporary=/run/mjl-test/client.cnf.new; printf "[client]\\nuser=%s\\npassword=%s\\n[client_root]\\nuser=root\\npassword=%s\\n" "$MYSQL_USER" "$MYSQL_PASSWORD" "$MYSQL_ROOT_PASSWORD" > "$temporary"; chmod 0600 "$temporary"; mv "$temporary" "$target"'], { quiet: true, signal });
    await compose(plan, ['exec', '-T', 'mariadb', 'sh', '-ceu', 'attempt=0; until mariadb-admin --defaults-extra-file=/run/mjl-test/client.cnf ping --silent; do attempt=$((attempt+1)); test "$attempt" -lt 60; sleep 1; done'], { quiet: true, signal });
  };
  const failpoint = async (name, pattern) => {
    let rejected = false;
    try { await runPhp(['--mode=apply', ...evidenceArgs, `--failure-point=${name}`], environment); }
    catch (error) { rejected = pattern.test(String(error.output || error.message)); }
    if (!rejected) throw new Error(`RST-005 ${name} failpoint did not fail safely.`);
    await restartDatabase();
  };

  for (const point of [
    'after-table-checks',
    ...Array.from({ length: 8 }, (_, index) => `after-index-${index + 1}`),
    ...Array.from({ length: 4 }, (_, index) => `after-foreign-key-${index + 1}`),
    ...Array.from({ length: 3 }, (_, index) => `after-trigger-${index + 1}`),
  ]) await failpoint(point, /Injected RST-005 failure after target (?:table\/check group|index|foreign key|trigger)/i);
  await failpoint('after-target-create', /Injected RST-005 failure after target creation/i);
  await runPhp(['--mode=apply', ...evidenceArgs], environment);
  await runPhp(['--mode=apply', ...evidenceArgs], environment);
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', verifier, '--allow-quarantine'], { quiet: true, signal });
  await runPhp(['--mode=rollback', ...evidenceArgs], environment);
  await runPhp(['--mode=rollback', ...evidenceArgs], environment);
  if (JSON.stringify(await captureStableEvidence()) !== JSON.stringify(parsed)) throw new Error('RST-005 pre-finalization rollback did not restore complete database/filesystem/ECM evidence.');
  await runPhp(['--mode=preflight']);
  await failpoint('after-cutover-guard', /Injected RST-005 failure after cutover guard/i);
  let writerRejected = false;
  try {
    await databaseSql(plan, "INSERT INTO llx_mjlfinancement_activity(entity,ref,label,fk_project,date_creation,fk_user_creat,status) VALUES(1,'RST005-DIRECT-WRITER','blocked',1,NOW(),1,0)", { quiet: true, signal });
  } catch (error) { writerRejected = /cutover containment is active/i.test(String(error.output || error.message)); }
  if (!writerRejected) throw new Error('RST-005 guarded boundary admitted a competing direct writer.');
  await runPhp(['--mode=apply', ...evidenceArgs], environment);
  await runPhp(['--mode=rollback', ...evidenceArgs], environment);
  if (JSON.stringify(await captureStableEvidence()) !== JSON.stringify(parsed)) throw new Error('RST-005 guarded-state rollback did not restore complete database/filesystem/ECM evidence.');
  await failpoint('after-locked-recheck', /Injected RST-005 failure after locked recheck/i);
  await runPhp(['--mode=apply', ...evidenceArgs], environment);
  await runPhp(['--mode=rollback', ...evidenceArgs], environment);
  if (JSON.stringify(await captureStableEvidence()) !== JSON.stringify(parsed)) throw new Error('RST-005 locked-boundary rollback did not restore complete database/filesystem/ECM evidence.');
  await failpoint('after-atomic-rename', /Injected RST-005 failure after atomic rename/i);
  await runPhp(['--mode=apply', ...evidenceArgs], environment);
  let verificationFailed = false;
  try { await runPhp(['--mode=verify', '--failure-point=during-verification'], ['MJL_DISPOSABLE_TEST_TENANT=1']); }
  catch (error) { verificationFailed = /Injected RST-005 failure during verification/i.test(String(error.output || error.message)); }
  if (!verificationFailed) throw new Error('RST-005 verification failpoint did not fail safely.');
  await restartDatabase();
  await databaseSql(plan, "INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_RST005_ACTIVATION_FAILURE_INJECTION','1','chaine',0,'disposable RST-005 rehearsal',0)", { quiet: true, signal });
  let activationFailed = false;
  try { await compose(plan, ['exec', '-T', '-e', 'MJL_RST005_INJECT_ACTIVATION_FAILURE=1', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { quiet: true, signal }); }
  catch (error) { activationFailed = /Failed to activate modMjlFinancement/i.test(String(error.output || error.message)); }
  if (!activationFailed) throw new Error('RST-005 activation failpoint did not fail safely.');
  await databaseSql(plan, "DELETE FROM llx_const WHERE name='MJL_RST005_ACTIVATION_FAILURE_INJECTION' AND entity=0", { quiet: true, signal });
  await restartDatabase();
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { quiet: true, signal });
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', '/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php'], { quiet: true, signal });
  const postActivationEvidence = await captureStableEvidence();
  const postActivationVerification = JSON.parse(await runPhp(['--mode=verify']));
  manifest = {
    ...manifest,
    database: { sha256: postActivationEvidence.database_sha256 },
    protected_tables: { sha256: postActivationVerification.protected_tables_sha256, kind: 'rst005-non-activity-database-v2' },
    documents: { sha256: postActivationEvidence.documents_sha256 },
    ecm: { sha256: postActivationEvidence.ecm_sha256 },
    checkpoint: { sha256: sha256('post-activation-pre-finalization'), kind: 'post-activation-pre-finalization' },
  };
  sealManifest();
  let beforeFinalizeFailed = false;
  try { await runPhp(['--mode=finalize', ...evidenceArgs, '--failure-point=before-finalize-drop'], environment); }
  catch (error) { beforeFinalizeFailed = /Injected RST-005 failure before finalization drop/i.test(String(error.output || error.message)); }
  if (!beforeFinalizeFailed) throw new Error('RST-005 pre-finalization failpoint did not fail safely.');
  await restartDatabase();
  let afterFinalizeFailed = false;
  try { await runPhp(['--mode=finalize', ...evidenceArgs, '--failure-point=after-finalize-drop'], environment); }
  catch (error) { afterFinalizeFailed = /Injected RST-005 failure after finalization drop/i.test(String(error.output || error.message)); }
  if (!afterFinalizeFailed) throw new Error('RST-005 post-finalization failpoint did not fail safely.');
  await restartDatabase();
  await runPhp(['--mode=finalize', ...evidenceArgs], environment);
  await runPhp(['--mode=finalize', ...evidenceArgs], environment);
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', verifier], { quiet: true, signal });
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', verifier], { quiet: true, signal });
  await runPhp(['--mode=rollback', ...evidenceArgs], environment);
  await runPhp(['--mode=rollback', ...evidenceArgs], environment);
  const reconstructionEvidence = await captureStableEvidence();
  const reconstructionPreflight = JSON.parse(await runPhp(['--mode=preflight']));
  if (reconstructionPreflight.protected_tables_sha256 !== postActivationVerification.protected_tables_sha256
    || reconstructionEvidence.documents_sha256 !== postActivationEvidence.documents_sha256
    || reconstructionEvidence.ecm_sha256 !== postActivationEvidence.ecm_sha256) throw new Error('RST-005 post-finalization reconstruction rollback changed protected database/filesystem/ECM evidence.');
  await runPhp(['--mode=apply', ...evidenceArgs], environment);
  await runPhp(['--mode=verify']);
  await runPhp(['--mode=finalize', ...evidenceArgs], environment);
  await compose(plan, ['exec', '-T', 'dolibarr', 'php', verifier], { quiet: true, signal });
  } finally {
    if (backupDirectory) fs.rmSync(backupDirectory, { recursive: true, force: true });
    if (keyDirectory) fs.rmSync(keyDirectory, { recursive: true, force: true });
  }
}

module.exports = { runRst005CutoverRehearsal };
