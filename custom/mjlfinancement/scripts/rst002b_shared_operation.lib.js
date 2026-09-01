'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { runCommand, encryptCommandOutput, verifyEncryptedBackups, cleanupNamedContainers } = require('./rst005_shared_operation.lib');

function invariant(value, message) { if (!value) throw new Error(message); }
function delegated(options, name, fallback, ...args) { return options.testHooks && typeof options.testHooks[name] === 'function' ? options.testHooks[name](...args) : fallback(...args); }
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function composeBase(approval) { return ['compose', '--env-file', '/dev/null', '--project-directory', approval.repository_root, ...approval.compose_files.flatMap((entry) => ['-f', entry.path]), '-p', approval.compose_project_name]; }
function fsyncDirectory(directory) { const descriptor = fs.openSync(directory, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0)); try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); } }
function atomicRecord(directory, name, value, options = {}) {
  const requiredUid = Number.isInteger(options.requiredUid) ? options.requiredUid : 0;
  const directoryStat = fs.lstatSync(directory);
  invariant(directoryStat.isDirectory() && !directoryStat.isSymbolicLink() && directoryStat.uid === requiredUid && (directoryStat.mode & 0o7777) === 0o700, 'RST-002B durable record root custody is invalid.');
  const target = path.join(directory, name); const temporary = `${target}.new`;
  invariant(!fs.existsSync(target), 'Durable RST-002B record already exists.');
  if (fs.existsSync(temporary)) {
    const stale = fs.lstatSync(temporary); invariant(stale.isFile() && !stale.isSymbolicLink() && stale.uid === requiredUid && stale.nlink === 1 && [0o400,0o600].includes(stale.mode & 0o7777), 'RST-002B temporary record custody is invalid.');
    fs.unlinkSync(temporary); fsyncDirectory(directory);
  }
  const bytes = Buffer.from(`${canonicalJson(value)}\n`); const descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  try {
    const stat = fs.fstatSync(descriptor); invariant(stat.isFile() && stat.uid === requiredUid && stat.nlink === 1, 'RST-002B temporary record custody is invalid.');
    fs.writeFileSync(descriptor, bytes); fs.fchmodSync(descriptor, 0o400); fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  fs.renameSync(temporary, target); fsyncDirectory(directory); return sha256(bytes);
}
function readRecord(directory, name, options = {}) {
  const requiredUid = Number.isInteger(options.requiredUid) ? options.requiredUid : 0;
  const descriptor = fs.openSync(path.join(directory, name), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(descriptor); invariant(stat.isFile() && !stat.isSymbolicLink() && stat.uid === requiredUid && stat.nlink === 1 && (stat.mode & 0o7777) === 0o400, 'RST-002B durable record custody is invalid.');
    const bytes = fs.readFileSync(descriptor); const value = JSON.parse(bytes.toString('utf8')); invariant(bytes.toString('utf8') === `${canonicalJson(value)}\n`, 'RST-002B durable record is not canonical.');
    return { value, sha256: sha256(bytes) };
  } finally { fs.closeSync(descriptor); }
}
function recordExists(directory, name) { return fs.existsSync(path.join(directory, name)); }
async function compose(approval, tail, options = {}) { return runCommand('/usr/bin/docker', [...composeBase(approval), ...tail], { cwd: approval.repository_root, env: options.env || process.env, input: options.input, signal: options.signal, label: options.label || 'RST-002B Compose command' }); }
function oneOffNames(approval) { invariant(/^[a-f0-9]{32}$/.test(approval.nonce), 'RST-002B nonce is unsafe.'); return { evidence: `mjl-rst002b-evidence-${approval.nonce}`, migration: `mjl-rst002b-migration-${approval.nonce}` }; }
async function runtimeConfig(approval, options = {}) {
  const target=path.join(approval.evidence_root,'rst002b-runtime-conf.php');
  if (fs.existsSync(target)) { const stale=fs.lstatSync(target); invariant(stale.isFile() && !stale.isSymbolicLink() && stale.uid===0 && stale.nlink===1 && [0o400,0o600,0o644].includes(stale.mode&0o7777),'RST-002B runtime configuration custody is invalid.'); fs.unlinkSync(target); fsyncDirectory(approval.evidence_root); }
  const container=(await compose(approval,['ps','-a','-q','dolibarr'],options)).toString('utf8').trim(); invariant(container===approval.containers.dolibarr,'RST-002B stopped Dolibarr container identity is invalid.');
  const inspected=JSON.parse((await runCommand('/usr/bin/docker',['container','inspect',container],{env:options.env,signal:options.signal,label:'RST-002B stopped Dolibarr inspection'})).toString('utf8'))[0];
  invariant(inspected.Image===approval.images.dolibarr && inspected.State.Running===false && inspected.Name===`/${approval.compose_project_name}-dolibarr-1`,'RST-002B stopped Dolibarr container binding changed.');
  await runCommand('/usr/bin/docker',['cp',`${container}:/var/www/html/conf/conf.php`,target],{env:options.env,signal:options.signal,label:'RST-002B protected runtime configuration capture'});
  const stat=fs.lstatSync(target); invariant(stat.isFile() && !stat.isSymbolicLink() && stat.uid===0 && stat.nlink===1,'RST-002B captured runtime configuration custody is invalid.'); fs.chmodSync(target,0o400); fsyncDirectory(approval.evidence_root); return target;
}
function clearRuntimeConfig(target) { if (!target || !fs.existsSync(target)) return; const stat=fs.lstatSync(target); invariant(stat.isFile() && !stat.isSymbolicLink() && stat.uid===0 && stat.nlink===1 && [0o400,0o600,0o644].includes(stat.mode&0o7777),'RST-002B runtime configuration cleanup custody changed.'); fs.unlinkSync(target); fsyncDirectory(path.dirname(target)); }
async function pinnedOneOff(approval, name, specification, options = {}) {
  invariant(['evidence','migration'].includes(specification.kind),'RST-002B one-off kind is invalid.');
  const network=`${approval.compose_project_name}_default`; const common=['container','create','--pull=never','--rm','--name',name,'--network',network,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--tmpfs','/tmp:rw,noexec,nosuid,nodev,mode=1777'];
  if (specification.kind==='evidence') common.push('--cap-add','DAC_READ_SEARCH');
  const mountTargets=new Set(specification.mounts.map((mount)=>mount.target));
  if (!mountTargets.has('/var/www/documents')) common.push('--tmpfs','/var/www/documents:rw,noexec,nosuid,nodev,mode=0700');
  if (!mountTargets.has('/var/www/html/custom')) common.push('--tmpfs','/var/www/html/custom:rw,noexec,nosuid,nodev,mode=0700');
  for (const mount of specification.mounts) common.push('--volume',`${mount.source}:${mount.target}:${mount.readOnly?'ro':'rw'}`);
  common.push('--entrypoint','/usr/local/bin/php',approval.images.dolibarr,...specification.command);
  const created=(await runCommand('/usr/bin/docker',common,{env:options.env,signal:options.signal,label:`RST-002B ${specification.kind} container create`})).toString('utf8').trim();
  const inspected=JSON.parse((await runCommand('/usr/bin/docker',['container','inspect',created],{env:options.env,signal:options.signal,label:`RST-002B ${specification.kind} container inspect`})).toString('utf8'))[0];
  const actualMounts=(inspected.Mounts||[]).filter((mount)=>mount.Type==='bind').map((mount)=>`${mount.Source}>${mount.Destination}:${mount.RW?'rw':'ro'}`).sort(); const expectedMounts=specification.mounts.map((mount)=>`${mount.source}>${mount.target}:${mount.readOnly?'ro':'rw'}`).sort();
  invariant(inspected.State.Status==='created' && inspected.Image===approval.images.dolibarr && inspected.HostConfig.NetworkMode===network && inspected.HostConfig.AutoRemove===true && inspected.HostConfig.ReadonlyRootfs===true,'RST-002B immutable one-off identity inspection failed.');
  invariant((inspected.HostConfig.CapDrop||[]).join(',')==='ALL' && (specification.kind==='evidence' ? (inspected.HostConfig.CapAdd||[]).join(',')==='CAP_DAC_READ_SEARCH' : (inspected.HostConfig.CapAdd||[]).length===0) && (inspected.HostConfig.SecurityOpt||[]).includes('no-new-privileges:true'),'RST-002B immutable one-off privilege inspection failed.');
  invariant(Array.isArray(inspected.Config.Entrypoint) && inspected.Config.Entrypoint.join(',')==='/usr/local/bin/php','RST-002B immutable one-off entrypoint inspection failed.');
  invariant(canonicalJson(actualMounts)===canonicalJson(expectedMounts),'RST-002B immutable one-off mount inspection failed.');
  invariant(inspected.HostConfig.Tmpfs && inspected.HostConfig.Tmpfs['/tmp']==='rw,noexec,nosuid,nodev,mode=1777' && (mountTargets.has('/var/www/documents') || inspected.HostConfig.Tmpfs['/var/www/documents']==='rw,noexec,nosuid,nodev,mode=0700') && (mountTargets.has('/var/www/html/custom') || inspected.HostConfig.Tmpfs['/var/www/html/custom']==='rw,noexec,nosuid,nodev,mode=0700'),'RST-002B immutable one-off tmpfs inspection failed.');
  return runCommand('/usr/bin/docker',['start','--attach',created],{env:options.env,signal:options.signal,label:`RST-002B ${specification.kind} container start`});
}
async function evidence(approval, options = {}) {
  const names = oneOffNames(approval); await cleanupNamedContainers([names.evidence], undefined, options.env); let config;
  try {
    config=await runtimeConfig(approval,options); const wrapper="$file='/var/www/html/conf/conf.php';require $file;putenv('DOLI_DB_HOST='.$dolibarr_main_db_host);putenv('DOLI_DB_NAME='.$dolibarr_main_db_name);putenv('DOLI_DB_USER='.$dolibarr_main_db_user);putenv('DOLI_DB_PASSWORD='.$dolibarr_main_db_pass);require '/opt/mjl-tests/fixtures/database-evidence.php';";
    const bytes = await pinnedOneOff(approval,names.evidence,{kind:'evidence',mounts:[{source:config,target:'/var/www/html/conf/conf.php',readOnly:true},{source:`${approval.repository_root}/tests`,target:'/opt/mjl-tests',readOnly:true},{source:`${approval.repository_root}/data/documents`,target:'/var/www/documents',readOnly:true}],command:['-r',wrapper]},options);
    const value = JSON.parse(bytes.toString('utf8'));
    invariant(value.admin_count === 1 && value.disposable_control_count === 0 && value.disposable_file_sentinel_present === false
      && value.business_counts && Object.values(value.business_counts).every((count) => count === 0), 'RST-002B shared evidence is not empty.'); return value;
  } finally { await cleanupNamedContainers([names.evidence], undefined, options.env); clearRuntimeConfig(config); }
}
function approvalDigest(approval) { return sha256(Buffer.from(`${canonicalJson(approval)}\n`)); }
function installAuthorization(approval, mode, checkpointSha256) {
  const record = { version: 1, unit: 'RST-002B', operation_id: approval.operation_id, approved_commit: approval.approved_commit, complete_tree_sha256: approval.complete_tree_sha256, approval_sha256: approvalDigest(approval), checkpoint_sha256: checkpointSha256, mode };
  const target = path.join(approval.evidence_root, 'rst002b-authorization.json'); invariant(!fs.existsSync(target), 'RST-002B authorization already exists.');
  const descriptor = fs.openSync(target, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o400);
  try { fs.writeFileSync(descriptor, `${canonicalJson(record)}\n`); fs.fsyncSync(descriptor); fs.fchownSync(descriptor, 0, 0); fs.fchmodSync(descriptor, 0o400); } finally { fs.closeSync(descriptor); }
  fsyncDirectory(approval.evidence_root); return target;
}
function clearAuthorization(target) { if (!target) return; const stat = fs.lstatSync(target); invariant(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && stat.nlink === 1 && (stat.mode & 0o7777) === 0o400, 'RST-002B authorization cleanup custody changed.'); fs.unlinkSync(target); fsyncDirectory(path.dirname(target)); }
async function migration(approval, mode, checkpointSha256, options = {}) {
  const names = oneOffNames(approval); await cleanupNamedContainers([names.migration], undefined, options.env); const authorizationTarget=path.join(approval.evidence_root,'rst002b-authorization.json');
  if (fs.existsSync(authorizationTarget)) clearAuthorization(authorizationTarget);
  const authorization = installAuthorization(approval, mode, checkpointSha256); let config;
  try {
    config=await runtimeConfig(approval,options); const wrapper="putenv('MJL_RST002B_SHARED_LAUNCHER=1');require '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php';";
    return await pinnedOneOff(approval,names.migration,{kind:'migration',mounts:[{source:config,target:'/var/www/html/conf/conf.php',readOnly:true},{source:`${approval.repository_root}/custom`,target:'/var/www/html/custom',readOnly:true},{source:`${approval.repository_root}/data/documents`,target:'/var/www/documents',readOnly:true},{source:authorization,target:'/run/mjl-rst002b/authorization.json',readOnly:true}],command:['-r',wrapper,'--',`--mode=${mode}`,'--confirm=RST-002B']},options);
  } finally { clearAuthorization(authorization); await cleanupNamedContainers([names.migration], undefined, options.env); clearRuntimeConfig(config); }
}
function backupPaths(approval) { return { schema: path.join(approval.backup_root, 'rst002b-schema.secretstream'), full: path.join(approval.backup_root, 'rst002b-full.secretstream') }; }
function backupVerificationApproval(approval) {
  return {
    ...approval,
    target_profile: 'shared',
    docker_runtime: {
      images: {
        mariadb: { id: approval.images.mariadb },
        dolibarr: { id: approval.images.dolibarr },
      },
    },
  };
}
async function createAndVerifyBackups(approval, key, sourceEvidence, options = {}) {
  fs.mkdirSync(approval.backup_root, { recursive: true, mode: 0o700 }); const paths = backupPaths(approval);
  const dump = [...composeBase(approval), 'exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb-dump -uroot --routines --events --triggers --skip-comments "$@" "$MYSQL_DATABASE"', 'rst002b-dump'];
  const schema = await encryptCommandOutput('/usr/bin/docker', [...dump, '--no-data'], key, paths.schema, { cwd: approval.repository_root, env: options.env, signal: options.signal });
  const full = await encryptCommandOutput('/usr/bin/docker', [...dump, '--order-by-primary'], key, paths.full, { cwd: approval.repository_root, env: options.env, signal: options.signal });
  const restored = await verifyEncryptedBackups({ approval: backupVerificationApproval(approval), key, schemaPath: paths.schema, fullPath: paths.full, schemaPlaintextSha256: schema.plaintextSha256, fullPlaintextSha256: full.plaintextSha256, sourceEvidence, runtimeEnvironment: options.env, signal: options.signal });
  return { paths, schema, full, restored };
}
async function verifyRetainedBackups(approval, key, before, options) {
  const backups = before.value.backups; invariant(backups && backups.paths && backups.schema && backups.full, 'RST-002B backup manifest is incomplete.');
  await verifyEncryptedBackups({ approval: backupVerificationApproval(approval), key, schemaPath: backups.paths.schema, fullPath: backups.paths.full, schemaPlaintextSha256: backups.schema.plaintextSha256, fullPlaintextSha256: backups.full.plaintextSha256, sourceEvidence: before.value.before, runtimeEnvironment: options.env, signal: options.signal });
}
function compareMapExcept(before, after, excluded, label) { for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) if (!excluded.has(key)) invariant(canonicalJson(before[key]) === canonicalJson(after[key]), `RST-002B changed protected ${label} ${key}.`); }
function assertProtectedEvidence(before, after) {
  for (const field of ['admin_sha256','documents_sha256','ecm_sha256','module_metadata_sha256','restorable_database_definition_sha256','disposable_control_count','disposable_file_sentinel_present']) invariant(canonicalJson(after[field]) === canonicalJson(before[field]), `RST-002B changed protected ${field}.`);
  compareMapExcept(before.business_counts, after.business_counts, new Set(), 'business count');
  compareMapExcept(before.restorable_table_sha256, after.restorable_table_sha256, new Set(['llx_mjlfinancement_activity','llx_mjlfinancement_activity_assignment','llx_mjlfinancement_user_soc_scope']), 'table');
  compareMapExcept(before.restorable_schema_object_sha256, after.restorable_schema_object_sha256, new Set(['triggers']), 'schema-object class');
  compareMapExcept(before.restorable_trigger_sha256, after.restorable_trigger_sha256, new Set([
    'llx_mjl_activity_rst005_bu','llx_mjl_activity_rst002b_bu',
    'llx_mjl_activity_assignment_bi','llx_mjl_activity_assignment_bu','llx_mjl_activity_assignment_bd',
    'llx_mjlfinancement_user_role_bi','llx_mjlfinancement_user_role_bu','llx_mjlfinancement_user_role_bd',
    'llx_mjlfinancement_user_admin_bu',
  ]), 'trigger');
}
async function startAndHealthCheck(approval, options) {
  await compose(approval, ['up', '-d', 'dolibarr'], options); const deadline = Date.now() + 120000;
  while (Date.now() < deadline) { try { await compose(approval, ['exec', '-T', 'dolibarr', 'php', '-r', "$body=@file_get_contents('http://127.0.0.1/'); if ($body===false) exit(1);"], options); return; } catch (_) {} await new Promise((resolve) => setTimeout(resolve, 1000)); }
  throw new Error('RST-002B local HTTP health check failed.');
}
async function runningServices(approval, options) {
  return (await compose(approval, ['ps', '--status', 'running', '--services'], options)).toString('utf8').trim().split('\n').filter(Boolean).sort();
}
async function requireStoppedServices(approval, options) {
  const running = await runningServices(approval, options);
  invariant(canonicalJson(running) === canonicalJson(['mariadb']), 'RST-002B requires Dolibarr stopped and MariaDB running.');
}
function validateChainRecord(record, approval, mode, previous) { invariant(record.value.version === 1 && record.value.unit === 'RST-002B' && record.value.operation_id === approval.operation_id && record.value.mode === mode && record.value.previous_sha256 === previous, 'RST-002B durable chain is invalid.'); }
function inspectForwardPrefix(directory, approval, options = {}) {
  const names = ['rst002b-00-intent.json','rst002b-01-before.json','rst002b-02-checkpoint.json','rst002b-03-after.json','rst002b-launcher-report.json'];
  const present = names.map((name) => recordExists(directory,name));
  for (let index=1; index<present.length; index+=1) invariant(!present[index] || present[index-1], 'RST-002B durable prefix has a gap.');
  const unexpected = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => name.startsWith('rst002b-') && !names.includes(name) && !['rst002b-authorization.json','rst002b-runtime-conf.php'].includes(name)) : [];
  invariant(unexpected.length === 0, 'RST-002B durable prefix contains an unexpected record.');
  let previous = null;
  for (let index=0; index<4 && present[index]; index+=1) { const record = readRecord(directory,names[index],options); validateChainRecord(record,approval,'execute',previous); previous=record.sha256; }
  if (present[4]) { const report=readRecord(directory,names[4],options); invariant(report.value.version===1 && report.value.unit==='RST-002B' && report.value.operation_id===approval.operation_id && report.value.mode==='execute' && report.value.previous_sha256===previous && report.value.status==='complete' && report.value.approved_commit===approval.approved_commit && report.value.complete_tree_sha256===approval.complete_tree_sha256,'RST-002B final report is invalid.'); }
  return present.filter(Boolean).length;
}
async function runForward(approval, key, recover, options) {
  const names = ['rst002b-00-intent.json','rst002b-01-before.json','rst002b-02-checkpoint.json','rst002b-03-after.json','rst002b-launcher-report.json'];
  const recordOptions=options.recordOptions||{}; inspectForwardPrefix(approval.evidence_root,approval,recordOptions);
  if (!recover) for (const name of names) invariant(!recordExists(approval.evidence_root, name), 'RST-002B execute evidence already exists.');
  let intent;
  if (recordExists(approval.evidence_root,names[0])) { invariant(recover,'RST-002B execute cannot reuse durable evidence.'); intent=readRecord(approval.evidence_root,names[0],recordOptions); validateChainRecord(intent,approval,'execute',null); }
  else { const value={version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:null,state:'backup-authorized'}; intent={value,sha256:atomicRecord(approval.evidence_root,names[0],value,recordOptions)}; }
  let before;
  if (recordExists(approval.evidence_root, names[1])) { before = readRecord(approval.evidence_root, names[1],recordOptions); validateChainRecord(before, approval, 'execute', intent.sha256); await delegated(options,'verifyRetainedBackups',verifyRetainedBackups,approval,key,before,options); }
  else {
    for (const file of Object.values(backupPaths(approval))) if (fs.existsSync(file)) { invariant(recover && fs.lstatSync(file).isFile(), 'Unexpected RST-002B backup path.'); fs.unlinkSync(file); }
    const source = await delegated(options,'evidence',evidence,approval,options); const backups = await delegated(options,'createAndVerifyBackups',createAndVerifyBackups,approval,key,source,options); const value = { version: 1, unit: 'RST-002B', operation_id: approval.operation_id, mode: 'execute', previous_sha256: null, before: source, backups };
    value.previous_sha256=intent.sha256; before = { value, sha256: atomicRecord(approval.evidence_root, names[1], value,recordOptions) };
  }
  let checkpoint;
  if (recordExists(approval.evidence_root, names[2])) { checkpoint = readRecord(approval.evidence_root, names[2],recordOptions); validateChainRecord(checkpoint, approval, 'execute', before.sha256); }
  else { const value = { version: 1, unit: 'RST-002B', operation_id: approval.operation_id, mode: 'execute', previous_sha256: before.sha256, state: 'mutation-authorized' }; checkpoint = { value, sha256: atomicRecord(approval.evidence_root, names[2], value,recordOptions) }; }
  if (!recordExists(approval.evidence_root, names[3])) {
    if (options.assertLiveBinding) await options.assertLiveBinding('stopped'); await delegated(options,'requireStoppedServices',requireStoppedServices,approval,options); await delegated(options,'migration',migration,approval,'apply',checkpoint.sha256,options); const afterEvidence = await delegated(options,'evidence',evidence,approval,options); assertProtectedEvidence(before.value.before, afterEvidence);
    const value = { version: 1, unit: 'RST-002B', operation_id: approval.operation_id, mode: 'execute', previous_sha256: checkpoint.sha256, after: afterEvidence }; atomicRecord(approval.evidence_root, names[3], value,recordOptions);
  }
  const after = readRecord(approval.evidence_root, names[3],recordOptions); validateChainRecord(after, approval, 'execute', checkpoint.sha256); assertProtectedEvidence(before.value.before, after.value.after);
  const services = await delegated(options,'runningServices',runningServices,approval,options);
  if (canonicalJson(services) === canonicalJson(['mariadb'])) { assertProtectedEvidence(before.value.before, await delegated(options,'evidence',evidence,approval,options)); await delegated(options,'startAndHealthCheck',startAndHealthCheck,approval,options); }
  else invariant(canonicalJson(services) === canonicalJson(['dolibarr','mariadb']), 'RST-002B completed-prefix service state is invalid.');
  if (options.assertLiveBinding) await options.assertLiveBinding('running');
  if (!recordExists(approval.evidence_root, names[4])) atomicRecord(approval.evidence_root, names[4], { version: 1, unit: 'RST-002B', operation_id: approval.operation_id, mode: 'execute', previous_sha256: after.sha256, status: 'complete', approved_commit: approval.approved_commit, complete_tree_sha256: approval.complete_tree_sha256 },recordOptions);
  return Object.freeze({ status: 'complete' });
}
async function runRollback(approval, options) {
  invariant(approval.prior_execution_report && /^[a-f0-9]{64}$/.test(approval.prior_execution_report.sha256), 'RST-002B rollback lacks the retained execution report binding.'); const prior = fs.readFileSync(approval.prior_execution_report.path); invariant(sha256(prior) === approval.prior_execution_report.sha256, 'RST-002B prior execution report changed.');
  const names=['rst002b-rollback-00-before.json','rst002b-rollback-01-checkpoint.json','rst002b-rollback-02-after.json','rst002b-rollback-report.json']; const present=names.map((name)=>recordExists(approval.evidence_root,name));
  for (let index=1;index<present.length;index+=1) invariant(!present[index]||present[index-1],'RST-002B rollback durable prefix has a gap.');
  const unexpected=fs.readdirSync(approval.evidence_root).filter((name)=>name.startsWith('rst002b-')&&!names.includes(name)&&name!=='rst002b-authorization.json'); invariant(unexpected.length===0,'RST-002B rollback durable prefix contains an unexpected record.');
  const recordOptions=options.recordOptions||{}; let beforeRecord;
  if (present[0]) { beforeRecord=readRecord(approval.evidence_root,names[0],recordOptions); validateChainRecord(beforeRecord,approval,'rollback',null); }
  else { const before=await delegated(options,'evidence',evidence,approval,options); const value={version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'rollback',previous_sha256:null,before}; beforeRecord={value,sha256:atomicRecord(approval.evidence_root,names[0],value,recordOptions)}; }
  let checkpoint;
  if (present[1]) { checkpoint=readRecord(approval.evidence_root,names[1],recordOptions); validateChainRecord(checkpoint,approval,'rollback',beforeRecord.sha256); }
  else { const value={version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'rollback',previous_sha256:beforeRecord.sha256,state:'rollback-authorized'}; checkpoint={value,sha256:atomicRecord(approval.evidence_root,names[1],value,recordOptions)}; }
  if (!present[2]) { if (options.assertLiveBinding) await options.assertLiveBinding('stopped'); await delegated(options,'requireStoppedServices',requireStoppedServices,approval,options); await delegated(options,'migration',migration,approval,'rollback',checkpoint.sha256,options); const after=await delegated(options,'evidence',evidence,approval,options); assertProtectedEvidence(beforeRecord.value.before,after); atomicRecord(approval.evidence_root,names[2],{version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'rollback',previous_sha256:checkpoint.sha256,after},recordOptions); }
  const afterRecord=readRecord(approval.evidence_root,names[2],recordOptions); validateChainRecord(afterRecord,approval,'rollback',checkpoint.sha256); assertProtectedEvidence(beforeRecord.value.before,afterRecord.value.after);
  const services=await delegated(options,'runningServices',runningServices,approval,options);
  if (canonicalJson(services)===canonicalJson(['mariadb'])) { assertProtectedEvidence(beforeRecord.value.before,await delegated(options,'evidence',evidence,approval,options)); await delegated(options,'startAndHealthCheck',startAndHealthCheck,approval,options); }
  else invariant(canonicalJson(services)===canonicalJson(['dolibarr','mariadb']),'RST-002B completed rollback service state is invalid.');
  if (options.assertLiveBinding) await options.assertLiveBinding('running');
  if (!present[3]) atomicRecord(approval.evidence_root,names[3],{version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'rollback',previous_sha256:afterRecord.sha256,status:'complete'},recordOptions);
  else { const report=readRecord(approval.evidence_root,names[3],recordOptions); invariant(report.value.version===1&&report.value.unit==='RST-002B'&&report.value.operation_id===approval.operation_id&&report.value.mode==='rollback'&&report.value.previous_sha256===afterRecord.sha256&&report.value.status==='complete','RST-002B rollback report is invalid.'); }
  return Object.freeze({ status: 'complete' });
}
async function run(options, mode) {
  const { approval, key } = options; invariant(Buffer.isBuffer(key) && key.length === 32, 'RST-002B backup key is invalid.');
  const completed = mode === 'rollback' ? recordExists(approval.evidence_root,'rst002b-rollback-02-after.json') : mode === 'recover' && recordExists(approval.evidence_root,'rst002b-03-after.json');
  if (options.assertLiveBinding) await options.assertLiveBinding(completed ? 'completed' : 'stopped');
  if (!completed) await delegated(options,'requireStoppedServices',requireStoppedServices,approval,options);
  const staleConfig=path.join(approval.evidence_root,'rst002b-runtime-conf.php'); if (fs.existsSync(staleConfig)) clearRuntimeConfig(staleConfig);
  return mode === 'rollback' ? runRollback(approval, options) : runForward(approval, key, mode === 'recover', options);
}
const runRst002bOperation = (options) => run(options, 'execute');
const runRst002bRecover = (options) => run(options, 'recover');
const runRst002bRollback = (options) => run(options, 'rollback');

module.exports = { atomicRecord, backupVerificationApproval, canonicalJson, pinnedOneOff, readRecord, inspectForwardPrefix, assertProtectedEvidence, runRst002bOperation, runRst002bRecover, runRst002bRollback };
