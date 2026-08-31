'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { finished } = require('node:stream/promises');
const { approvalRecordSha256, canonicalJson, protectedTreeDigest, validateCustodyAncestors } = require('./rst005_shared_launcher.lib');

const DOCKER = '/usr/bin/docker';
const isSharedPath = (approval) => ['shared', 'disposable_shared_shape'].includes(approval.target_profile);
const isDisposable = (approval) => approval.target_profile === 'disposable';

const encryptScript = String.raw`function allwrite($h,$v){$o=0;$n=strlen($v);while($o<$n){$w=fwrite($h,substr($v,$o));if($w===false||$w===0)exit(90);$o+=$w;}}$key=stream_get_contents(fopen('php://fd/3','rb'));if(strlen($key)!==SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_KEYBYTES)exit(91);[$state,$header]=sodium_crypto_secretstream_xchacha20poly1305_init_push($key);allwrite(STDOUT,$header);while(!feof(STDIN)){$plain=fread(STDIN,65536);if($plain===false)exit(92);if($plain==='')continue;$cipher=sodium_crypto_secretstream_xchacha20poly1305_push($state,$plain,'',SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_MESSAGE);allwrite(STDOUT,pack('N',strlen($cipher)).$cipher);sodium_memzero($plain);}$final=sodium_crypto_secretstream_xchacha20poly1305_push($state,'','',SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL);allwrite(STDOUT,pack('N',strlen($final)).$final);sodium_memzero($key);`;
const decryptScript = String.raw`function exact($h,$n){$v='';while(strlen($v)<$n&&!feof($h)){$c=fread($h,$n-strlen($v));if($c===false)exit(92);$v.=$c;}return strlen($v)===$n?$v:false;}function allwrite($h,$v){$o=0;$n=strlen($v);while($o<$n){$w=fwrite($h,substr($v,$o));if($w===false||$w===0)exit(90);$o+=$w;}}$key=stream_get_contents(fopen('php://fd/3','rb'));$header=exact(STDIN,SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_HEADERBYTES);if(strlen($key)!==SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_KEYBYTES||$header===false)exit(91);$state=sodium_crypto_secretstream_xchacha20poly1305_init_pull($header,$key);$final=false;while(!feof(STDIN)){$len=exact(STDIN,4);if($len===false)break;$size=unpack('N',$len)[1];if($size<17||$size>65553)exit(93);$cipher=exact(STDIN,$size);if($cipher===false)exit(94);$result=sodium_crypto_secretstream_xchacha20poly1305_pull($state,$cipher);if($result===false||$final)exit(95);allwrite(STDOUT,$result[0]);$final=$result[1]===SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL;}if(!$final)exit(96);sodium_memzero($key);`;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isolatedRestoreNames(nonce) {
  invariant(/^[a-f0-9]{32}$/.test(nonce), 'Isolated restore nonce is invalid.');
  const suffix = nonce;
  return Object.freeze({
    databaseContainer: `mjl-rst005-db-${suffix}`,
    evidenceContainer: `mjl-rst005-evidence-${suffix}`,
    network: `mjl-rst005-net-${suffix}`,
    databaseVolume: `mjl-rst005-dbvol-${suffix}`,
    documentVolume: `mjl-rst005-docvol-${suffix}`,
  });
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(65536);
  try {
    let count;
    do {
      count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count > 0) hash.update(buffer.subarray(0, count));
    } while (count > 0);
  } finally {
    buffer.fill(0);
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function moduleTreeSha(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        if (relative !== 'scripts/rst005_activity_foundation.php') entries.push(`file|${relative}|${sha256File(absolute)}`);
      } else throw new Error('RST-005 module source contains a non-file entry.');
    }
  };
  visit(root);
  return crypto.createHash('sha256').update(`${entries.sort().join('\n')}\n`).digest('hex');
}

function custodyDirectory(root, allowExisting) {
  const canonical = fs.realpathSync(root);
  invariant(canonical === root, 'Custody root must be canonical.');
  validateCustodyAncestors(root, 0);
  const stat = fs.lstatSync(root);
  invariant(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0 && (stat.mode & 0o7777) === 0o700, 'Custody root must be root-owned mode 0700.');
  if (!allowExisting) invariant(fs.readdirSync(root).length === 0, 'New RST-005 custody root must be empty.');
}

function writeProtectedJson(file, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    invariant(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && stat.nlink === 1, 'Protected JSON target custody is invalid.');
    fs.chmodSync(file, 0o600);
  }
  fs.writeFileSync(file, bytes, { mode: 0o600, flag: fs.existsSync(file) ? 'w' : 'wx' });
  fs.chmodSync(file, 0o400);
  return sha256File(file);
}

function writeImmutableJson(file, value) {
  invariant(!fs.existsSync(file), 'Immutable JSON record already exists.');
  const parent = path.dirname(file);
  const bytes = Buffer.from(`${canonicalJson(value)}\n`);
  const temporaryPath = path.join(parent, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
    let offset = 0;
    while (offset < bytes.length) offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
    fs.fsyncSync(descriptor);
    fs.fchmodSync(descriptor, 0o400);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    invariant(!fs.existsSync(file), 'Immutable JSON record appeared before publication.');
    fs.renameSync(temporaryPath, file);
    fsyncDirectory(parent);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporaryPath); } catch (_) {}
    throw error;
  } finally { bytes.fill(0); }
  return sha256File(file);
}

function durableRecordName(sequence, kind, sha256) {
  invariant(Number.isInteger(sequence) && sequence >= 0 && sequence <= 9999, 'Durable record sequence is invalid.');
  invariant(/^[a-z][a-z0-9-]{1,63}$/.test(kind), 'Durable record kind is invalid.');
  invariant(/^[a-f0-9]{64}$/.test(sha256), 'Durable record digest is invalid.');
  return `${String(sequence).padStart(4, '0')}-${kind}-${sha256}.json`;
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0));
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function writeDurableRecord(root, input, options = {}) {
  const requiredUid = Number.isInteger(options.requiredUid) ? options.requiredUid : 0;
  const rootStat = fs.lstatSync(root);
  invariant(rootStat.isDirectory() && !rootStat.isSymbolicLink() && rootStat.uid === requiredUid
    && (rootStat.mode & 0o7777) === 0o700, 'Durable record custody is invalid.');
  const {
    operationId, targetIdentitySha256, executionIdentitySha256, sequence, kind, previousSha256, payload,
  } = input || {};
  invariant(/^[a-f0-9]{32}$/.test(operationId), 'Durable record operation identity is invalid.');
  invariant(/^[a-f0-9]{64}$/.test(targetIdentitySha256), 'Durable record target identity is invalid.');
  invariant(/^[a-f0-9]{64}$/.test(executionIdentitySha256), 'Durable record execution identity is invalid.');
  invariant(previousSha256 === null || /^[a-f0-9]{64}$/.test(previousSha256), 'Durable record previous digest is invalid.');
  invariant(payload && typeof payload === 'object' && !Array.isArray(payload), 'Durable record payload is invalid.');
  const sequencePrefix = `${String(sequence).padStart(4, '0')}-`;
  invariant(!fs.readdirSync(root).some((name) => name.startsWith(sequencePrefix)), 'Durable record sequence already exists.');
  const record = Object.freeze({
    version: 3,
    unit: 'RST-005',
    operation_id: operationId,
    target_identity_sha256: targetIdentitySha256,
    execution_identity_sha256: executionIdentitySha256,
    sequence,
    kind,
    previous_sha256: previousSha256,
    payload,
  });
  const bytes = Buffer.from(`${canonicalJson(record)}\n`);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const finalPath = path.join(root, durableRecordName(sequence, kind, sha256));
  invariant(!fs.existsSync(finalPath), 'Durable record already exists.');
  const temporaryPath = path.join(root, `.${sequencePrefix}${process.pid}-${crypto.randomBytes(8).toString('hex')}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
    let offset = 0;
    while (offset < bytes.length) offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
    fs.fsyncSync(descriptor);
    fs.fchmodSync(descriptor, 0o400);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    invariant(!fs.existsSync(finalPath), 'Durable record appeared before atomic publication.');
    fs.renameSync(temporaryPath, finalPath);
    fsyncDirectory(root);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporaryPath); } catch (_) {}
    throw error;
  } finally {
    bytes.fill(0);
  }
  return Object.freeze({ path: finalPath, sha256, record });
}

function durableRecordChain(root, binding, options = {}) {
  const requiredUid = Number.isInteger(options.requiredUid) ? options.requiredUid : 0;
  const names = fs.readdirSync(root).filter((name) => /^\d{4}-[a-z][a-z0-9-]{1,63}-[a-f0-9]{64}\.json$/.test(name)).sort();
  invariant(names.length > 0, 'Durable record chain is missing.');
  const records = [];
  let previousSha256 = null;
  for (let sequence = 0; sequence < names.length; sequence += 1) {
    const name = names[sequence];
    const file = path.join(root, name);
    const stat = fs.lstatSync(file);
    invariant(stat.isFile() && !stat.isSymbolicLink() && stat.uid === requiredUid
      && (stat.mode & 0o7777) === 0o400 && stat.nlink === 1, 'Durable record custody is corrupt.');
    const bytes = fs.readFileSync(file);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    invariant(name.endsWith(`-${sha256}.json`), 'Durable record digest is corrupt.');
    let record;
    try { record = JSON.parse(bytes.toString('utf8')); } catch (_) { throw new Error('Durable record canonical JSON is corrupt.'); }
    invariant(bytes.toString('utf8') === `${canonicalJson(record)}\n`, 'Durable record is not canonical.');
    const exactKeys = ['execution_identity_sha256', 'kind', 'operation_id', 'payload', 'previous_sha256', 'sequence', 'target_identity_sha256', 'unit', 'version'].sort();
    invariant(Object.keys(record).sort().join(',') === exactKeys.join(',')
      && record.version === 3 && record.unit === 'RST-005'
      && record.operation_id === binding.operationId
      && record.target_identity_sha256 === binding.targetIdentitySha256
      && record.execution_identity_sha256 === binding.executionIdentitySha256
      && record.sequence === sequence && record.previous_sha256 === previousSha256
      && name === durableRecordName(sequence, record.kind, sha256),
    'Durable record chain is reordered, copied, replayed, or contradictory.');
    if (options.validateGrammar) {
      const transitions = Object.freeze({
        START: ['manifest-before'],
        'manifest-before': ['checkpoint-before-apply', 'manifest-recovery'],
        'checkpoint-before-apply': ['checkpoint-before-activation', 'manifest-recovery'],
        'checkpoint-before-activation': ['manifest-target', 'manifest-recovery'],
        'manifest-target': ['checkpoint-before-finalize', 'manifest-recovery'],
        'checkpoint-before-finalize': ['checkpoint-before-rehearsal-rollback', 'completed-report', 'manifest-recovery'],
        'checkpoint-before-rehearsal-rollback': ['completed-report'],
        'completed-report': ['checkpoint-before-approved-rollback'],
        'checkpoint-before-approved-rollback': ['completed-rollback-report'],
        'manifest-recovery': ['checkpoint-before-recovery'],
        'checkpoint-before-recovery': ['completed-recovery-report'],
        'completed-recovery-report': [],
        'completed-rollback-report': [],
      });
      const previousKind = sequence === 0 ? 'START' : records[sequence - 1].kind;
      invariant(Object.hasOwn(transitions, previousKind) && transitions[previousKind].includes(record.kind),
        `Durable record grammar rejects ${previousKind} -> ${record.kind}.`);
    }
    records.push(Object.freeze({ ...record, path: file, sha256 }));
    previousSha256 = sha256;
  }
  return Object.freeze(records);
}

function classifyDatabaseTruth(evidence) {
  if (!evidence || !['phase1', 'target'].includes(evidence.schema)
    || !Array.isArray(evidence.temporary_tables) || typeof evidence.finalized !== 'boolean') return 'unknown';
  const temporary = evidence.temporary_tables;
  if (evidence.schema === 'phase1' && temporary.length === 0 && !evidence.finalized) return 'exact_phase1';
  if (evidence.schema === 'phase1' && temporary.length > 0 && !evidence.finalized) return 'guarded_transitional';
  if (evidence.schema === 'target' && temporary.length > 0 && !evidence.finalized) return 'target_pre_finalization';
  if (evidence.schema === 'target' && temporary.length === 0 && evidence.finalized) return 'finalized_target';
  return 'unknown';
}

function composeBase(approval, runtimeRoot = approval.repository_root) {
  const files = approval.compose_files.map((entry) => path.join(runtimeRoot, path.relative(approval.repository_root, entry.path)));
  const environmentFile = path.join(runtimeRoot, '.rst005-compose.env');
  return ['compose', '--env-file', environmentFile, '--project-directory', approval.repository_root, ...files.flatMap((file) => ['-f', file]), '-p', approval.compose_project_name];
}

function parseEnvironmentEntries(entries) {
  const result = {};
  for (const entry of entries) {
    const separator = entry.indexOf('=');
    invariant(separator > 0 && /^[A-Z][A-Z0-9_]{1,63}$/.test(entry.slice(0, separator)), 'One-off environment entry is invalid.');
    result[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return result;
}

async function approvedOneOffEnvironment(approval, runtimeRoot, runtimeEnvironment, signal) {
  const bytes = await runCommand(DOCKER, [...composeBase(approval, runtimeRoot), 'config', '--format', 'json'], {
    cwd: approval.repository_root, env: runtimeEnvironment, signal, label: 'RST-005 one-off environment resolution',
  });
  const config = JSON.parse(bytes.toString('utf8'));
  const source = config.services && config.services.dolibarr && config.services.dolibarr.environment;
  const names = ['DOLI_DB_HOST', 'DOLI_DB_NAME', 'DOLI_DB_PASSWORD', 'DOLI_DB_USER', 'DOLI_URL_ROOT'];
  invariant(source && names.every((name) => typeof source[name] === 'string' && source[name] !== ''), 'Approved one-off database environment is incomplete.');
  const optionalDisposable = ['MJL_DISPOSABLE_PROJECT_NAME', 'MJL_DISPOSABLE_RUN_SENTINEL', 'MJL_DISPOSABLE_TEST_TENANT'];
  return Object.fromEntries([...names, ...optionalDisposable.filter((name) => typeof source[name] === 'string' && source[name] !== '')].map((name) => [name, source[name]]));
}

async function runApprovedOneOff(options) {
  const { approval, runtimeRoot, runtimeEnvironment, name, script } = options;
  const signal = options.signal;
  const mutation = options.mutation === true;
  const environment = { ...(await approvedOneOffEnvironment(approval, runtimeRoot, runtimeEnvironment, signal)), ...parseEnvironmentEntries(options.environment || []) };
  if (mutation && approval.target_profile !== 'shared' && /^([1-9]|[12][0-9]|30)$/.test(process.env.MJL_RST005_MUTATION_HOLD_SECONDS || '')) environment.MJL_RST005_MUTATION_HOLD_SECONDS = process.env.MJL_RST005_MUTATION_HOLD_SECONDS;
  const volumes = [
    `${runtimeRoot}/tests:/opt/mjl-tests:ro`, `${runtimeRoot}/custom:/var/www/html/custom:ro`,
    `${approval.document_root}:/var/www/documents:ro`, ...(options.volumes || []),
  ];
  if (mutation) volumes.push(`${approval.mutation_lock_path}:${approval.mutation_lock_path}`, '/usr/bin/flock:/usr/bin/flock:ro');
  const phpCommand = ['/var/www/html/custom/mjlfinancement/scripts/rst005_oneoff_bootstrap.php', script, ...(options.args || [])];
  const command = mutation
    ? ['--nonblock', '--no-fork', approval.mutation_lock_path, '/usr/local/bin/php', ...phpCommand]
    : phpCommand;
  const createArgs = [
    'container', 'create', '--pull=never', '--rm', '--name', name, '--network', `${approval.compose_project_name}_default`,
    '--read-only', '--cap-drop', 'ALL', '--cap-add', 'DAC_READ_SEARCH', '--security-opt', 'no-new-privileges:true',
    '--tmpfs', '/var/www/html/conf:rw,noexec,nosuid,nodev,mode=0700', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,mode=1777',
    ...Object.entries(environment).sort(([left], [right]) => left.localeCompare(right)).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
    ...volumes.flatMap((volume) => ['--volume', volume]), '--entrypoint', mutation ? '/usr/bin/flock' : '/usr/local/bin/php',
    approval.docker_runtime.images.dolibarr.id, ...command,
  ];
  const created = (await runCommand(DOCKER, createArgs, { env: runtimeEnvironment, signal, label: 'RST-005 immutable one-off creation' })).toString('utf8').trim();
  invariant(/^[a-f0-9]{64}$/.test(created), 'RST-005 immutable one-off creation returned an invalid identity.');
  const inspected = JSON.parse((await runCommand(DOCKER, ['container', 'inspect', created], { env: runtimeEnvironment, signal, label: 'RST-005 immutable one-off inspection' })).toString('utf8'))[0];
  const expectedMounts = volumes.map((volume) => {
    const fields = volume.split(':');
    return { destination: fields[1], rw: fields[2] !== 'ro' };
  }).sort((left, right) => left.destination.localeCompare(right.destination));
  const actualMounts = (inspected.Mounts || []).map((mount) => ({ destination: mount.Destination, rw: mount.RW })).sort((left, right) => left.destination.localeCompare(right.destination));
  invariant(inspected.Id === created && inspected.Image === approval.docker_runtime.images.dolibarr.id
    && inspected.State.Status === 'created' && inspected.HostConfig.ReadonlyRootfs === true
    && inspected.HostConfig.AutoRemove === true && canonicalJson(actualMounts) === canonicalJson(expectedMounts)
    && (inspected.HostConfig.CapDrop || []).join(',') === 'ALL'
    && (inspected.HostConfig.CapAdd || []).join(',') === 'CAP_DAC_READ_SEARCH'
    && (inspected.HostConfig.SecurityOpt || []).includes('no-new-privileges:true')
    && inspected.HostConfig.NetworkMode === `${approval.compose_project_name}_default`
    && inspected.Config.Entrypoint.join(',') === (mutation ? '/usr/bin/flock' : '/usr/local/bin/php'),
  'RST-005 immutable one-off inspection rejected the created container.');
  const running = runCommand(DOCKER, ['start', '--attach', created], {
    cwd: approval.repository_root, env: runtimeEnvironment, signal, label: options.label || 'RST-005 approved one-off', isolatedDiagnostics: approval.target_profile !== 'shared',
  });
  if (mutation && typeof options.onMutationStarted === 'function') {
    let active = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const state = (await runCommand(DOCKER, ['container', 'inspect', '--format', '{{.State.Running}}', created], { env: runtimeEnvironment, label: 'RST-005 mutation lease start inspection' })).toString('utf8').trim();
        if (state === 'true') { active = true; break; }
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    invariant(active, 'RST-005 mutation container never entered its inspected running state.');
    options.onMutationStarted();
  }
  return running;
}

async function composeResourceEvidence(approval, runtimeRoot = approval.repository_root, runtimeEnvironment = process.env) {
  const output = async (args) => (await runCommand(DOCKER, args, { label: 'RST-005 Compose resource evidence', env: runtimeEnvironment })).toString('utf8').trim();
  const containerIds = (await output([...composeBase(approval, runtimeRoot), 'ps', '-a', '-q'])).split('\n').filter(Boolean).sort();
  const networkIds = (await output(['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${approval.compose_project_name}`])).split('\n').filter(Boolean).sort();
  const volumeNames = (await output(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${approval.compose_project_name}`])).split('\n').filter(Boolean).sort();
  const inspect = async (kind, identities) => identities.length === 0 ? [] : JSON.parse(await output([kind, 'inspect', ...identities]));
  const containers = (await inspect('container', containerIds)).map((entry) => ({
    id: entry.Id,
    name: String(entry.Name || '').replace(/^\//, ''),
    image: entry.Config.Image,
    state: entry.State.Status,
    mounts: (entry.Mounts || []).map((mount) => ({ type: mount.Type, name: mount.Name || '', source: mount.Source, destination: mount.Destination, rw: mount.RW })).sort((a, b) => a.destination.localeCompare(b.destination)),
    networks: Object.keys((entry.NetworkSettings || {}).Networks || {}).sort(),
  })).sort((a, b) => a.name.localeCompare(b.name));
  const networks = (await inspect('network', networkIds)).map((entry) => ({
    id: entry.Id, name: entry.Name, driver: entry.Driver, internal: entry.Internal,
    containers: Object.values(entry.Containers || {}).map((container) => container.Name).sort(),
  })).sort((a, b) => a.name.localeCompare(b.name));
  const volumes = (await inspect('volume', volumeNames)).map((entry) => ({ name: entry.Name, driver: entry.Driver, mountpoint: entry.Mountpoint })).sort((a, b) => a.name.localeCompare(b.name));
  const manifest = { containers, networks, volumes };
  return Object.freeze({ sha256: crypto.createHash('sha256').update(canonicalJson(manifest)).digest('hex'), counts: { containers: containers.length, networks: networks.length, volumes: volumes.length } });
}

async function hostMountRelation(approval, candidate, runtimeEnvironment, signal) {
  invariant(typeof candidate === 'string' && path.isAbsolute(candidate) && !/[,\r\n\0]/.test(candidate), 'Host mount identity candidate is invalid.');
  const suffix = crypto.createHash('sha256').update(candidate).digest('hex').slice(0, 16);
  const name = `${approval.compose_project_name}-rst005-${approval.nonce}-mount-${suffix}`;
  const targets = [candidate, approval.database_root, approval.document_root];
  const destinations = ['/probe/candidate', '/probe/database', '/probe/documents'];
  await cleanupNamedContainers([name], undefined, runtimeEnvironment);
  const php = String.raw`$wanted=['/probe/candidate','/probe/database','/probe/documents'];$out=[];foreach(file('/proc/self/mountinfo',FILE_IGNORE_NEW_LINES) as $line){$f=explode(' ',$line);$point=str_replace(['\\040','\\011','\\012','\\134'],[' ',"\t","\n",'\\'],$f[4]);if(in_array($point,$wanted,true))$out[$point]=['device'=>$f[2],'root'=>str_replace(['\\040','\\011','\\012','\\134'],[' ',"\t","\n",'\\'],$f[3])];}ksort($out);echo json_encode($out,JSON_UNESCAPED_SLASHES);`;
  try {
    const createArgs = ['container', 'create', '--pull=never', '--rm', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges:true', '--tmpfs', '/var/www/documents:rw,noexec,nosuid,nodev,mode=0700',
      '--tmpfs', '/var/www/html/custom:rw,noexec,nosuid,nodev,mode=0700',
      ...targets.flatMap((source, index) => ['--mount', `type=bind,src=${source},dst=${destinations[index]},readonly,bind-nonrecursive`]),
      '--entrypoint', '/usr/local/bin/php', approval.docker_runtime.images.dolibarr.id, '-r', php];
    const created = (await runCommand(DOCKER, createArgs, { env: runtimeEnvironment, signal, label: 'RST-005 host mount identity creation' })).toString('utf8').trim();
    const inspected = JSON.parse((await runCommand(DOCKER, ['container', 'inspect', created], { env: runtimeEnvironment, signal, label: 'RST-005 host mount identity inspection' })).toString('utf8'))[0];
    invariant(inspected.State.Status === 'created' && inspected.Image === approval.docker_runtime.images.dolibarr.id
      && inspected.HostConfig.AutoRemove === true && inspected.HostConfig.ReadonlyRootfs === true
      && inspected.HostConfig.NetworkMode === 'none' && (inspected.HostConfig.CapDrop || []).join(',') === 'ALL'
      && (inspected.HostConfig.SecurityOpt || []).includes('no-new-privileges:true')
      && inspected.HostConfig.Tmpfs['/var/www/documents'] === 'rw,noexec,nosuid,nodev,mode=0700'
      && inspected.HostConfig.Tmpfs['/var/www/html/custom'] === 'rw,noexec,nosuid,nodev,mode=0700'
      && (inspected.Mounts || []).length === 3 && (inspected.Mounts || []).every((mount) => mount.RW === false),
    'RST-005 host mount identity probe inspection failed.');
    const output = await runCommand(DOCKER, ['start', '--attach', created], { env: runtimeEnvironment, signal, label: 'RST-005 host mount identity probe' });
    const identities = JSON.parse(output.toString('utf8'));
    invariant(Object.keys(identities).sort().join(',') === [...destinations].sort().join(','), 'Host mount identities are incomplete.');
    const overlaps = (left, right) => left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
    return Object.freeze({
      database: identities['/probe/candidate'].device === identities['/probe/database'].device
        && overlaps(identities['/probe/candidate'].root, identities['/probe/database'].root),
      documents: identities['/probe/candidate'].device === identities['/probe/documents'].device
        && overlaps(identities['/probe/candidate'].root, identities['/probe/documents'].root),
    });
  } finally {
    await cleanupNamedContainers([name], undefined, runtimeEnvironment);
  }
}

function copyTreeNoFollow(source, destination) {
  const before = fs.lstatSync(source);
  invariant(!before.isSymbolicLink(), `RST-005 snapshot refuses symbolic link: ${source}`);
  if (before.isDirectory()) {
    fs.mkdirSync(destination, { mode: before.mode & 0o7777 });
    for (const name of fs.readdirSync(source).sort()) copyTreeNoFollow(path.join(source, name), path.join(destination, name));
    fs.chmodSync(destination, before.mode & 0o7777);
    fsyncDirectory(destination);
    const after = fs.lstatSync(source);
    invariant(after.dev === before.dev && after.ino === before.ino && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, 'RST-005 source directory changed during snapshot.');
    return;
  }
  invariant(before.isFile() && before.nlink === 1, `RST-005 snapshot refuses non-regular or linked source: ${source}`);
  const sourceDescriptor = fs.openSync(source, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  const destinationDescriptor = fs.openSync(destination, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, before.mode & 0o7777);
  const buffer = Buffer.allocUnsafe(65536);
  try {
    const opened = fs.fstatSync(sourceDescriptor);
    invariant(opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size, 'RST-005 source changed before snapshot copy.');
    let count;
    do {
      count = fs.readSync(sourceDescriptor, buffer, 0, buffer.length, null);
      let offset = 0;
      while (offset < count) offset += fs.writeSync(destinationDescriptor, buffer, offset, count - offset);
    } while (count > 0);
    fs.fsyncSync(destinationDescriptor);
    fs.fchmodSync(destinationDescriptor, before.mode & 0o7777);
    fs.fsyncSync(destinationDescriptor);
    const after = fs.fstatSync(sourceDescriptor);
    invariant(after.dev === opened.dev && after.ino === opened.ino && after.size === opened.size
      && after.mtimeMs === opened.mtimeMs && after.ctimeMs === opened.ctimeMs,
    'RST-005 source changed during snapshot copy.');
  } finally {
    buffer.fill(0);
    fs.closeSync(destinationDescriptor);
    fs.closeSync(sourceDescriptor);
  }
}

function runtimeSnapshot(approval, create, onStage = () => {}, runtimeEnvironment = {}) {
  const snapshotRoot = path.join(approval.evidence_root, 'source-snapshot');
  if (create) {
    invariant(!fs.existsSync(snapshotRoot), 'RST-005 source snapshot already exists.');
    fs.mkdirSync(snapshotRoot, { mode: 0o700 });
    for (const relative of ['custom', 'docs', 'tests', 'AGENTS.md', 'CONTEXT.md', 'DESIGN.md', 'README.md', 'docker-compose.yml', 'package.json', 'package-lock.json', 'playwright.config.js']) {
      copyTreeNoFollow(path.join(approval.repository_root, relative), path.join(snapshotRoot, relative));
    }
    fsyncDirectory(snapshotRoot);
    onStage(174);
  }
  const stat = fs.lstatSync(snapshotRoot);
  invariant(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0 && (stat.mode & 0o7777) === 0o700, 'RST-005 source snapshot custody is invalid.');
  onStage(175);
  validateCustodyAncestors(snapshotRoot, 0);
  onStage(176);
  invariant(protectedTreeDigest(snapshotRoot) === approval.complete_tree_sha256, 'RST-005 immutable source snapshot differs from approval.');
  const environmentFile = path.join(snapshotRoot, '.rst005-compose.env');
  if (create) {
    const descriptor = fs.openSync(environmentFile, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o400);
    try {
      const bytes = Buffer.alloc(0);
      fs.fsyncSync(descriptor);
      bytes.fill(0);
    } finally { fs.closeSync(descriptor); }
    fsyncDirectory(snapshotRoot);
  }
  const environmentStat = fs.lstatSync(environmentFile);
  invariant(environmentStat.isFile() && !environmentStat.isSymbolicLink() && environmentStat.uid === 0
    && (environmentStat.mode & 0o7777) === 0o400 && environmentStat.nlink === 1,
  'RST-005 canonical Compose environment file custody is invalid.');
  return snapshotRoot;
}

function changedEvidenceKeys(before, after, field) {
  const left = before[field] || {};
  const right = after[field] || {};
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((key) => left[key] !== right[key]).sort();
}

async function assertExclusiveDatabaseBoundary(approval, runtimeRoot, runtimeEnvironment, signal) {
  const compose = (tail) => runCommand(DOCKER, [...composeBase(approval, runtimeRoot), ...tail], { cwd: approval.repository_root, env: runtimeEnvironment, signal, label: 'RST-005 exclusive database boundary' });
  const databaseContainer = (await compose(['ps', '-q', 'mariadb'])).toString('utf8').trim();
  invariant(/^[a-f0-9]{64}$/.test(databaseContainer), 'Approved MariaDB container identity is unavailable.');
  invariant(databaseContainer === approval.database_runtime.container_id, 'MariaDB container identity differs from approval.');
  const network = JSON.parse((await runCommand(DOCKER, ['network', 'inspect', `${approval.compose_project_name}_default`], { env: runtimeEnvironment, signal, label: 'RST-005 network boundary' })).toString('utf8'))[0];
  const members = Object.keys(network.Containers || {}).sort();
  invariant(members.length === 1 && members[0] === databaseContainer, 'Unapproved container remains attached to the database network.');
  const databaseInspect = JSON.parse((await runCommand(DOCKER, ['container', 'inspect', databaseContainer], { env: runtimeEnvironment, signal, label: 'RST-005 database container boundary' })).toString('utf8'))[0];
  invariant(databaseInspect.Image === approval.database_runtime.image_id, 'MariaDB immutable image identity differs from approval.');
  invariant(Object.keys(databaseInspect.NetworkSettings.Networks || {}).join(',') === `${approval.compose_project_name}_default`, 'MariaDB has an unapproved network attachment.');
  invariant(Object.values(databaseInspect.NetworkSettings.Ports || {}).every((bindings) => bindings === null), 'MariaDB exposes an unapproved host port.');
  const sessions = (await compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE ID <> CONNECTION_ID() AND USER NOT IN (\'system user\',\'event_scheduler\') AND COMMAND <> \'Daemon\'"'])).toString('utf8').trim();
  invariant(sessions === '0', 'Unapproved database client session remains active.');
  const enabledEvents = (await compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM information_schema.EVENTS WHERE STATUS=\'ENABLED\'"'])).toString('utf8').trim();
  const replicas = (await compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SHOW ALL REPLICAS STATUS"'])).toString('utf8').trim();
  const cluster = (await compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SHOW GLOBAL STATUS LIKE \'wsrep_connected\'"'])).toString('utf8').trim();
  invariant(enabledEvents === '0' && replicas === '' && (cluster === '' || /\tOFF$/i.test(cluster)), 'MariaDB event, replication, or cluster writers are active.');
  const clientVersion = (await compose(['exec', '-T', 'mariadb', 'mariadb', '--version'])).toString('utf8').trim();
  const serverVersion = (await compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SELECT VERSION()"'])).toString('utf8').trim();
  const datadir = (await compose(['exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SELECT @@datadir"'])).toString('utf8').trim();
  const datadirFilesystem = (await compose(['exec', '-T', 'mariadb', 'stat', '-Lc', '%d:%i', '/var/lib/mysql'])).toString('utf8').trim();
  invariant(clientVersion === approval.database_runtime.client_version && serverVersion === approval.database_runtime.server_version
    && datadir === approval.database_runtime.datadir && datadirFilesystem === approval.database_runtime.datadir_filesystem,
  'MariaDB client, server, datadir, or filesystem identity differs from approval.');
  const runningContainers = (await runCommand(DOCKER, ['ps', '-q'], { env: runtimeEnvironment, signal, label: 'RST-005 filesystem writer enumeration' })).toString('utf8').trim().split('\n').filter(Boolean);
  if (isSharedPath(approval) && runningContainers.length > 0) {
    const inspected = JSON.parse((await runCommand(DOCKER, ['container', 'inspect', ...runningContainers], { env: runtimeEnvironment, signal, label: 'RST-005 filesystem writer inspection' })).toString('utf8'));
    const selfPrefix = fs.readFileSync('/etc/hostname', 'utf8').trim();
    const operator = inspected.find((container) => container.Id.startsWith(selfPrefix));
    invariant(operator && operator.Id !== databaseContainer, 'RST-005 operator container identity is unavailable.');
    invariant(inspected.some((container) => container.Id === databaseContainer), 'Approved MariaDB is absent from the running-container inventory.');
    const databaseRoot = fs.realpathSync(approval.database_root);
    const documentRoot = fs.realpathSync(approval.document_root);
    const overlaps = (left, right) => left === right || left.startsWith(`${right}${path.sep}`) || right.startsWith(`${left}${path.sep}`);
    const databaseWrites = (databaseInspect.Mounts || []).filter((mount) => mount.RW);
    invariant(databaseWrites.length === 1 && databaseWrites[0].Destination === '/var/lib/mysql'
      && fs.realpathSync(databaseWrites[0].Source) === databaseRoot,
    'Approved MariaDB runtime mount inventory is not exact.');
    for (const container of inspected) {
      for (const mount of container.Mounts || []) {
        if (!mount.RW || !['bind', 'volume'].includes(mount.Type)) continue;
        if (container.Id === operator.Id) {
          const allowedOperatorTargets = new Set([approval.backup_root, approval.evidence_root, approval.target_lock_path, approval.mutation_lock_path, '/var/run/docker.sock']);
          invariant(allowedOperatorTargets.has(mount.Destination), 'Operator container has an unapproved writable mount.');
        }
        const candidates = [mount.Source];
        if (mount.Type === 'volume' && mount.Name) {
          const volume = JSON.parse((await runCommand(DOCKER, ['volume', 'inspect', mount.Name], { env: runtimeEnvironment, signal, label: 'RST-005 volume writer inspection' })).toString('utf8'))[0];
          candidates.push(volume.Mountpoint, volume.Options && volume.Options.device);
        }
        for (const candidate of candidates.filter((value) => typeof value === 'string' && path.isAbsolute(value))) {
          const relation = await hostMountRelation(approval, candidate, runtimeEnvironment, signal);
          if (relation.database) invariant(container.Id === databaseContainer, 'Foreign filesystem writer aliases MariaDB storage.');
          invariant(!relation.documents, 'A running container retains aliased write access to MJL documents.');
          const lexicalSource = path.resolve(candidate);
          if (overlaps(lexicalSource, databaseRoot)) invariant(container.Id === databaseContainer, 'Foreign filesystem writer lexically overlaps MariaDB storage.');
          invariant(!overlaps(lexicalSource, documentRoot), 'A running container retains lexical write access overlapping MJL documents.');
          if (!fs.existsSync(lexicalSource)) continue;
          const source = fs.realpathSync(lexicalSource);
          if (overlaps(source, databaseRoot)) invariant(container.Id === databaseContainer, 'Foreign filesystem writer overlaps MariaDB storage.');
          invariant(!overlaps(source, documentRoot), 'A running container retains overlapping write access to MJL documents.');
        }
      }
    }
  }
  return true;
}

function retainedActivityEvidence(snapshot, schema) {
  const table = 'llx_mjlfinancement_activity';
  const audit = 'llx_mjlfinancement_audit_event';
  const temporaryTables = Object.keys(snapshot.table_counts || {}).filter((name) => name.startsWith(`${table}_rst005_`)).sort();
  const tableSha256 = snapshot.restorable_table_sha256 && snapshot.restorable_table_sha256[table];
  const auditSha256 = snapshot.restorable_table_sha256 && snapshot.restorable_table_sha256[audit];
  const triggerSchemaSha256 = snapshot.restorable_schema_object_sha256 && snapshot.restorable_schema_object_sha256.triggers;
  const missing = [];
  if (!['phase1', 'target'].includes(schema)) missing.push('schema');
  if (!/^[a-f0-9]{64}$/.test(tableSha256)) missing.push('activity-table-digest');
  if (!/^[a-f0-9]{64}$/.test(auditSha256)) missing.push('audit-table-digest');
  if (!/^[a-f0-9]{64}$/.test(triggerSchemaSha256)) missing.push('trigger-schema-digest');
  if (!Number.isInteger(snapshot.table_counts && snapshot.table_counts[table])) missing.push('activity-row-count');
  if (!Number.isInteger(snapshot.schema_column_counts && snapshot.schema_column_counts[table])) missing.push('activity-column-count');
  if (!Number.isInteger(snapshot.table_counts && snapshot.table_counts[audit])) missing.push('audit-row-count');
  invariant(missing.length === 0, `RST-005 Activity/audit evidence is incomplete: ${missing.join(',')}.`);
  return Object.freeze({
    schema,
    oracle_sha256: schema === 'phase1' ? 'db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2' : '8eb99ee99c6dc748bd368e925e9938ccf086291d264e3812ac6320c8ec06b745',
    rows: snapshot.table_counts[table],
    columns: snapshot.schema_column_counts[table],
    table_sha256: tableSha256,
    temporary_tables: temporaryTables,
    audit_rows: snapshot.table_counts[audit],
    audit_sha256: auditSha256,
    trigger_schema_sha256: triggerSchemaSha256,
  });
}

function recoveryCheckpoint(approval, state, manifestSha256, sourceSha256, before, preflight, composeResources, previousSha256 = null) {
  invariant(['prepared', 'ready_to_activate', 'ready_to_finalize', 'ready_to_rehearsal_rollback'].includes(state), 'RST-005 recovery checkpoint state is invalid.');
  return Object.freeze({
    version: 2,
    unit: 'RST-005',
    state,
    approved_commit: approval.approved_commit,
    complete_tree_sha256: approval.complete_tree_sha256,
    approval_nonce: approval.nonce,
    target_identity_sha256: approval.target_identity_sha256,
    execution_identity_sha256: approval.execution_identity_sha256,
    manifest_sha256: manifestSha256,
    previous_sha256: previousSha256,
    source_sha256: sourceSha256,
    before: {
      database_sha256: before.database_sha256,
      protected_tables_sha256: preflight.protected_tables_sha256,
      documents_sha256: before.documents_sha256,
      ecm_sha256: before.ecm_sha256,
      admin_sha256: before.admin_sha256,
      module_metadata_sha256: before.module_metadata_sha256,
      business_counts: before.business_counts,
      activity: retainedActivityEvidence(before, 'phase1'),
      compose_resources: composeResources,
    },
    database_runtime: approval.database_runtime,
    recovery_policy: approval.recovery_policy,
  });
}

function validateRecoveryCheckpoint(checkpoint, approval, manifestSha256, sourceSha256, expectedState, previousSha256) {
  const keys = ['approval_nonce', 'approved_commit', 'before', 'complete_tree_sha256', 'database_runtime', 'execution_identity_sha256', 'manifest_sha256', 'previous_sha256', 'recovery_policy', 'source_sha256', 'state', 'target_identity_sha256', 'unit', 'version'].sort();
  const beforeKeys = ['activity', 'admin_sha256', 'business_counts', 'compose_resources', 'database_sha256', 'documents_sha256', 'ecm_sha256', 'module_metadata_sha256', 'protected_tables_sha256'].sort();
  invariant(checkpoint && Object.keys(checkpoint).sort().join('\n') === keys.join('\n')
    && checkpoint.version === 2 && checkpoint.unit === 'RST-005' && checkpoint.state === expectedState
    && checkpoint.approved_commit === approval.approved_commit
    && checkpoint.complete_tree_sha256 === approval.complete_tree_sha256
    && checkpoint.approval_nonce === approval.nonce
    && checkpoint.target_identity_sha256 === approval.target_identity_sha256
    && checkpoint.execution_identity_sha256 === approval.execution_identity_sha256
    && checkpoint.manifest_sha256 === manifestSha256
    && checkpoint.previous_sha256 === previousSha256
    && checkpoint.source_sha256 === sourceSha256
    && canonicalJson(checkpoint.database_runtime) === canonicalJson(approval.database_runtime)
    && checkpoint.recovery_policy === 'containment_only_phase1'
    && checkpoint.before && Object.keys(checkpoint.before).sort().join('\n') === beforeKeys.join('\n')
    && ['database_sha256', 'documents_sha256', 'ecm_sha256', 'admin_sha256', 'module_metadata_sha256', 'protected_tables_sha256'].every((field) => /^[a-f0-9]{64}$/.test(checkpoint.before[field]))
    && checkpoint.before.activity && checkpoint.before.activity.schema === 'phase1'
    && checkpoint.before.activity.rows === 0 && checkpoint.before.activity.temporary_tables.length === 0
    && checkpoint.before.business_counts && checkpoint.before.business_counts.activities === 0
    && checkpoint.before.compose_resources && /^[a-f0-9]{64}$/.test(checkpoint.before.compose_resources.sha256),
  'RST-005 recovery checkpoint is incomplete or does not bind the approved execution.');
  return checkpoint;
}

async function runRst005Operation(options) {
  const { approval, key, buildSharedAuthorization } = options;
  const signal = options.signal;
  const runtimeEnvironment = options.runtimeEnvironment || process.env;
  const onStage = typeof options.onStage === 'function' ? options.onStage : () => {};
  const assertLiveBinding = typeof options.assertLiveBinding === 'function' ? options.assertLiveBinding : () => true;
  invariant(Buffer.isBuffer(key) && key.length === 32, 'RST-005 operation key is invalid.');
  invariant(['rehearse', 'execute'].includes(approval.mode), 'RST-005 cutover operation mode is invalid.');
  custodyDirectory(approval.backup_root, false);
  custodyDirectory(approval.evidence_root, false);
  onStage(171);
  const runtimeRoot = runtimeSnapshot(approval, true, onStage, runtimeEnvironment);
  onStage(172);
  const throwIfAborted = () => { if (signal) signal.throwIfAborted(); };
  const compose = (tail, commandOptions = {}) => runCommand(DOCKER, [...composeBase(approval, runtimeRoot), ...tail], { cwd: approval.repository_root, env: runtimeEnvironment, label: commandOptions.label || 'RST-005 Compose command', input: commandOptions.input, signal: commandOptions.cleanup ? undefined : signal });
  const requireLiveBinding = async () => {
    onStage(180);
    await assertLiveBinding();
    onStage(181);
    invariant(protectedTreeDigest(runtimeRoot) === approval.complete_tree_sha256, 'RST-005 immutable runtime snapshot changed.');
    onStage(182);
    const services = (await compose(['ps', '--status', 'running', '--services'], { label: 'RST-005 traffic-stop recheck' })).toString('utf8').trim().split('\n').filter(Boolean).sort();
    invariant(services.join(',') === 'mariadb', 'RST-005 traffic stop no longer holds.');
    onStage(183);
    await assertExclusiveDatabaseBoundary(approval, runtimeRoot, runtimeEnvironment, signal);
    onStage(184);
  };
  const moduleRoot = path.join(runtimeRoot, 'custom/mjlfinancement');
  const sourceSha256 = moduleTreeSha(moduleRoot);
  onStage(173);
  const manifestBeforeHost = path.join(approval.evidence_root, 'rst005-evidence-00-before.json');
  const manifestTargetHost = path.join(approval.evidence_root, 'rst005-evidence-01-target.json');
  const authorizationHost = path.join(approval.evidence_root, 'authorization.json');
  const reportHost = path.join(approval.evidence_root, 'rst005-launcher-report.json');
  const schemaHost = path.join(approval.backup_root, 'schema.secretstream');
  const fullHost = path.join(approval.backup_root, 'full.secretstream');
  const recordBinding = Object.freeze({ operationId: approval.operation_id, targetIdentitySha256: approval.target_identity_sha256, executionIdentitySha256: approval.execution_identity_sha256 });
  let recordSequence = 0;
  let recordTail = null;
  const persistRecord = (kind, payload) => {
    const result = writeDurableRecord(approval.evidence_root, {
      ...recordBinding, sequence: recordSequence, kind, previousSha256: recordTail, payload,
    });
    recordSequence += 1;
    recordTail = result.sha256;
    return result;
  };
  const oneOffNames = new Set();
  let oneOffSequence = 0;
  const phpRun = async (script, args = [], environment = [], extraVolumes = [], mutation = false) => {
    throwIfAborted();
    oneOffSequence += 1;
    const oneOffName = `${approval.compose_project_name}-rst005-${approval.nonce}-${oneOffSequence}`;
    oneOffNames.add(oneOffName);
    try {
      return await runApprovedOneOff({ approval, runtimeRoot, runtimeEnvironment, name: oneOffName, script, args, environment, volumes: extraVolumes, mutation, signal, onMutationStarted: mutation ? () => onStage(190) : undefined, label: 'RST-005 one-off PHP command' });
    } catch (error) {
      const stages = { permission: 211, configuration: 212, missing: 213, access: 214, schema: 218, source: 219, admin: 226, guard: 227, conflict: 228, other: 215 };
      onStage(stages[error.rst005Reason] || stages.other);
      throw error;
    }
  };
  const parseJsonEvidence = (bytes, stage) => {
    try { return JSON.parse(bytes.toString('utf8')); } catch (error) { onStage(stage); throw error; }
  };
  const captureEvidence = async () => parseJsonEvidence(await phpRun('/opt/mjl-tests/fixtures/database-evidence.php'), 217);
  const runMigration = async (mode, manifestPath, manifestSha256, authorizationMode = mode) => {
    const environment = ['MJL_RST005_TRAFFIC_STOPPED=1'];
    const volumes = [`${approval.evidence_root}:/run/mjl-rst005/evidence:ro`, `${approval.backup_root}:/run/mjl-rst005/backups:ro`];
    if (isSharedPath(approval) && ['apply', 'finalize', 'rollback'].includes(mode)) {
      invariant(typeof buildSharedAuthorization === 'function', 'Shared authorization builder is unavailable.');
      writeProtectedJson(authorizationHost, buildSharedAuthorization(approval, authorizationMode, manifestSha256));
      environment.push('MJL_RST005_SHARED_LAUNCHER=1');
      volumes.push(`${authorizationHost}:/run/mjl-rst005/authorization.json:ro`);
    }
    const args = [`--mode=${mode}`];
    if (['apply', 'finalize', 'rollback'].includes(mode)) {
      invariant(typeof manifestPath === 'string' && path.dirname(manifestPath) === approval.evidence_root, 'RST-005 evidence manifest path is invalid.');
      args.push('--confirm=RST-005', `--evidence-manifest=/run/mjl-rst005/evidence/${path.basename(manifestPath)}`, `--evidence-sha256=${manifestSha256}`);
    }
    const output = await phpRun('/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php', args, environment, volumes, ['apply', 'finalize', 'rollback'].includes(mode));
    return parseJsonEvidence(output, 216);
  };
  try {
    throwIfAborted();
    await requireLiveBinding();
    const composeBefore = await composeResourceEvidence(approval, runtimeRoot, runtimeEnvironment);
    onStage(20);
    const preflight = await runMigration('preflight', null, null);
    onStage(21);
    const before = await captureEvidence();
    onStage(22);
    await requireLiveBinding();
    const dumpBase = [...composeBase(approval, runtimeRoot), 'exec', '-T', 'mariadb', 'sh', '-ceu', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb-dump -uroot --routines --events --triggers --skip-comments "$@" "$MYSQL_DATABASE"', 'rst005-dump'];
    onStage(23);
    await requireLiveBinding();
    const schemaBackup = await encryptCommandOutput(DOCKER, [...dumpBase, '--no-data'], key, schemaHost, { cwd: approval.repository_root, env: runtimeEnvironment, signal });
    await requireLiveBinding();
    const fullBackup = await encryptCommandOutput(DOCKER, [...dumpBase, '--order-by-primary'], key, fullHost, { cwd: approval.repository_root, env: runtimeEnvironment, signal });
    onStage(24);
    const restore = await verifyEncryptedBackups({
      approval,
      key,
      onStage,
      schemaPath: schemaHost,
      fullPath: fullHost,
      schemaPlaintextSha256: schemaBackup.plaintextSha256,
      fullPlaintextSha256: fullBackup.plaintextSha256,
      sourceEvidence: before,
      signal,
      runtimeEnvironment,
      runtimeRoot,
    });
    const artifact = (host, encrypted) => ({
      path: `/run/mjl-rst005/backups/${path.basename(host)}`,
      sha256: encrypted.ciphertextSha256,
      plaintext_sha256: encrypted.plaintextSha256,
      encryption: 'libsodium-secretstream-xchacha20poly1305',
      mode: '0600',
    });
    onStage(25);
    let manifest = {
      version: 3,
      operation_id: approval.operation_id,
      target_identity_sha256: recordBinding.targetIdentitySha256,
      execution_identity_sha256: recordBinding.executionIdentitySha256,
      approved_commit: approval.approved_commit,
      complete_tree_sha256: approval.complete_tree_sha256,
      recovery_policy: approval.recovery_policy,
      approval_nonce: approval.nonce,
      approval_sha256: approvalRecordSha256(approval),
      runtime: { docker: approval.docker_runtime, database: approval.database_runtime },
      source: { sha256: sourceSha256, kind: 'mjl-dependent-module-tree-v2' },
      schema: { sha256: 'db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2', kind: 'rst005-phase1-logical-oracle-v1' },
      database: { sha256: before.database_sha256 },
      protected_tables: { sha256: preflight.protected_tables_sha256, kind: 'rst005-non-activity-database-v2' },
      documents: { sha256: before.documents_sha256 },
      ecm: { sha256: before.ecm_sha256 },
      backup_schema: artifact(schemaHost, schemaBackup),
      backup_full: artifact(fullHost, fullBackup),
      backup_restore: { sha256: crypto.createHash('sha256').update(`${restore.schemaPlaintextSha256}:${restore.fullPlaintextSha256}:fresh-process-verified`).digest('hex'), verified: true, schema_sha256: restore.schemaPlaintextSha256, full_sha256: restore.fullPlaintextSha256, fresh_process: true },
      checkpoint: { sha256: crypto.createHash('sha256').update('preflight-pre-activation').digest('hex'), kind: 'preflight-pre-activation' },
    };
    let manifestHost = manifestBeforeHost;
    let manifestSha256 = writeImmutableJson(manifestHost, manifest);
    persistRecord('manifest-before', { manifest_path: path.basename(manifestHost), manifest_sha256: manifestSha256 });
    onStage(224);
    persistRecord('checkpoint-before-apply', recoveryCheckpoint(approval, 'prepared', manifestSha256, sourceSha256, before, preflight, composeBefore, recordTail));
    onStage(26);
    await requireLiveBinding();
    await runMigration('apply', manifestHost, manifestSha256);
    onStage(27);
    persistRecord('checkpoint-before-activation', recoveryCheckpoint(approval, 'ready_to_activate', manifestSha256, sourceSha256, before, preflight, composeBefore, recordTail));
    onStage(261);
    await requireLiveBinding();
    await phpRun('/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php', [], [], [], true);
    onStage(262);
    await requireLiveBinding();
    await phpRun('/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php', [], [], [], true);
    onStage(263);
    onStage(28);
    const verified = await runMigration('verify', null, null);
    onStage(33);
    onStage(34);
    await phpRun('/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_foundation.php', ['--allow-quarantine']);
    onStage(35);
    const target = await captureEvidence();
    onStage(36);
    const targetTableDelta = changedEvidenceKeys(before, target, 'restorable_table_sha256');
    const targetSchemaObjectDelta = changedEvidenceKeys(before, target, 'restorable_schema_object_sha256');
    if (isDisposable(approval) && process.env.MJL_RST005_STAGE_TRACE === '1') process.stdout.write(`${JSON.stringify({
      rst005_evidence_delta: {
        tables: targetTableDelta,
        schema_objects: targetSchemaObjectDelta,
      },
    })}\n`);
    for (const field of ['documents_sha256', 'ecm_sha256', 'admin_sha256']) invariant(target[field] === before[field], `Protected ${field} changed during RST-005 cutover.`);
    invariant(target.business_counts.activities === 0 && target.business_counts.audit_events === before.business_counts.audit_events, 'RST-005 created business or audit rows.');
    invariant(targetTableDelta.join(',') === 'llx_const,llx_menu,llx_mjlfinancement_activity,llx_mjlfinancement_activity_rst005_phase1_quarantine,llx_user_rights'
      && targetSchemaObjectDelta.join(',') === 'triggers',
    'RST-005 complete schema/data delta exceeds the Activity table foundation.');
    manifest = {
      ...manifest,
      database: { sha256: target.database_sha256 },
      protected_tables: { sha256: verified.protected_tables_sha256, kind: 'rst005-non-activity-database-v2' },
      checkpoint: { sha256: crypto.createHash('sha256').update('post-activation-pre-finalization').digest('hex'), kind: 'post-activation-pre-finalization' },
    };
    manifestHost = manifestTargetHost;
    manifestSha256 = writeImmutableJson(manifestHost, manifest);
    persistRecord('manifest-target', { manifest_path: path.basename(manifestHost), manifest_sha256: manifestSha256 });
    onStage(225);
    persistRecord('checkpoint-before-finalize', recoveryCheckpoint(approval, 'ready_to_finalize', manifestSha256, sourceSha256, before, preflight, composeBefore, recordTail));
    onStage(29);
    await requireLiveBinding();
    await runMigration('finalize', manifestHost, manifestSha256);
    onStage(32);
    await phpRun('/var/www/html/custom/mjlfinancement/scripts/verification/schema/activity_foundation.php');
    const finalized = await captureEvidence();
    const finalVerification = await runMigration('verify', null, null);
    invariant(finalVerification.protected_tables_sha256 === verified.protected_tables_sha256, 'Protected database projection changed during RST-005 finalization.');
    for (const field of ['documents_sha256', 'ecm_sha256', 'admin_sha256']) invariant(finalized[field] === before[field], `Protected ${field} changed during RST-005 finalization.`);
    invariant(finalized.business_counts.activities === 0 && finalized.business_counts.audit_events === before.business_counts.audit_events, 'RST-005 finalization created business or audit rows.');
    const finalizedTableDelta = changedEvidenceKeys(before, finalized, 'restorable_table_sha256');
    const finalizedSchemaObjectDelta = changedEvidenceKeys(before, finalized, 'restorable_schema_object_sha256');
    invariant(finalizedTableDelta.join(',') === 'llx_const,llx_menu,llx_mjlfinancement_activity,llx_user_rights'
      && finalizedSchemaObjectDelta.join(',') === 'triggers',
    'RST-005 finalized database delta exceeds Activity foundation and deterministic module activation metadata.');
    let rollback = null;
    let rollbackTableDelta = null;
    let rollbackSchemaObjectDelta = null;
    if (approval.mode === 'rehearse') {
      persistRecord('checkpoint-before-rehearsal-rollback', recoveryCheckpoint(approval, 'ready_to_rehearsal_rollback', manifestSha256, sourceSha256, before, preflight, composeBefore, recordTail));
      onStage(30);
      await requireLiveBinding();
      await runMigration('rollback', manifestHost, manifestSha256);
      const rollbackPreflight = await runMigration('preflight', null, null);
      rollback = await captureEvidence();
      invariant(rollbackPreflight.protected_tables_sha256 === verified.protected_tables_sha256, 'Containment rollback changed the protected database projection.');
      for (const field of ['documents_sha256', 'ecm_sha256', 'admin_sha256']) invariant(rollback[field] === before[field], `Containment rollback changed ${field}.`);
      invariant(rollback.business_counts.activities === 0 && rollback.business_counts.audit_events === before.business_counts.audit_events, 'Containment rollback created business or audit rows.');
      rollbackTableDelta = changedEvidenceKeys(before, rollback, 'restorable_table_sha256');
      rollbackSchemaObjectDelta = changedEvidenceKeys(before, rollback, 'restorable_schema_object_sha256');
      invariant(rollbackTableDelta.join(',') === 'llx_const,llx_menu,llx_user_rights'
        && rollbackSchemaObjectDelta.length === 0
        && rollback.module_metadata_sha256 === finalized.module_metadata_sha256,
      'Containment rollback exceeded the retained target module metadata while restoring the complete Phase 1 Activity schema.');
    }
    const composeAfter = await composeResourceEvidence(approval, runtimeRoot, runtimeEnvironment);
    invariant(composeAfter.sha256 === composeBefore.sha256, 'RST-005 changed the approved Compose resource manifest.');
    onStage(31);
    const report = {
      version: 3,
      unit: 'RST-005',
      mode: approval.mode,
      operation_id: approval.operation_id,
      target_identity_sha256: recordBinding.targetIdentitySha256,
      execution_identity_sha256: recordBinding.executionIdentitySha256,
      approved_commit: approval.approved_commit,
      complete_tree_sha256: approval.complete_tree_sha256,
      source_sha256: sourceSha256,
      manifest_sha256: manifestSha256,
      database_delta: { finalized_tables: finalizedTableDelta, finalized_schema_objects: finalizedSchemaObjectDelta, rollback_tables: rollbackTableDelta, rollback_schema_objects: rollbackSchemaObjectDelta },
      activity_evidence: {
        phase1_oracle_sha256: 'db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2',
        target_oracle_sha256: '8eb99ee99c6dc748bd368e925e9938ccf086291d264e3812ac6320c8ec06b745',
        before: retainedActivityEvidence(before, preflight.schema),
        finalized: retainedActivityEvidence(finalized, finalVerification.schema),
        rollback: rollback ? retainedActivityEvidence(rollback, 'phase1') : null,
      },
      before: { database_sha256: before.database_sha256, protected_tables_sha256: preflight.protected_tables_sha256, documents_sha256: before.documents_sha256, ecm_sha256: before.ecm_sha256, admin_sha256: before.admin_sha256, module_metadata_sha256: before.module_metadata_sha256, compose_resources: composeBefore },
      finalized: { database_sha256: finalized.database_sha256, protected_tables_sha256: finalVerification.protected_tables_sha256, documents_sha256: finalized.documents_sha256, ecm_sha256: finalized.ecm_sha256, admin_sha256: finalized.admin_sha256, module_metadata_sha256: finalized.module_metadata_sha256, business_counts: finalized.business_counts, compose_resources: composeAfter },
      rollback: rollback ? { database_sha256: rollback.database_sha256, documents_sha256: rollback.documents_sha256, ecm_sha256: rollback.ecm_sha256, admin_sha256: rollback.admin_sha256, module_metadata_sha256: rollback.module_metadata_sha256, business_counts: rollback.business_counts, compose_resources: composeAfter } : null,
      backup_restore: restore,
      status: approval.mode === 'rehearse' ? 'rehearsed_and_containment_restored' : 'executed_target_finalized',
    };
    persistRecord('completed-report', report);
    writeImmutableJson(reportHost, report);
    return Object.freeze(report);
  } finally {
    await cleanupNamedContainers(oneOffNames, undefined, runtimeEnvironment);
  }
}

async function runRst005Recover(options) {
  const { approval, buildSharedAuthorization } = options;
  const signal = options.signal;
  const runtimeEnvironment = options.runtimeEnvironment || process.env;
  const onStage = typeof options.onStage === 'function' ? options.onStage : () => {};
  const assertLiveBinding = typeof options.assertLiveBinding === 'function' ? options.assertLiveBinding : () => true;
  invariant(approval.mode === 'execute' && isSharedPath(approval)
    && approval.recovery_policy === 'containment_only_phase1', 'Original incomplete execute package is required for recovery.');
  custodyDirectory(approval.backup_root, true);
  custodyDirectory(approval.evidence_root, true);
  const runtimeRoot = runtimeSnapshot(approval, false, onStage, runtimeEnvironment);
  const binding = { operationId: approval.operation_id, targetIdentitySha256: approval.target_identity_sha256, executionIdentitySha256: approval.execution_identity_sha256 };
  const chain = durableRecordChain(approval.evidence_root, binding, { validateGrammar: true });
  for (const [fileName, kind] of [['rst005-launcher-report.json', 'completed-report'], ['rst005-recovery-report.json', 'completed-recovery-report'], ['rst005-rollback-report.json', 'completed-rollback-report']]) {
    const file = path.join(approval.evidence_root, fileName);
    if (!fs.existsSync(file)) continue;
    const durable = chain.find((record) => record.kind === kind);
    invariant(durable && canonicalJson(JSON.parse(fs.readFileSync(file, 'utf8'))) === canonicalJson(durable.payload),
      'Raw report copy contradicts or predates its durable record.');
  }
  invariant(!chain.some((record) => ['completed-report', 'completed-recovery-report', 'completed-rollback-report'].includes(record.kind)), 'Recovery is disabled after a durable completed report.');
  const operationCheckpointKinds = new Set(['checkpoint-before-apply', 'checkpoint-before-activation', 'checkpoint-before-finalize']);
  const checkpoint = [...chain].reverse().find((record) => operationCheckpointKinds.has(record.kind));
  const manifestRecord = [...chain].reverse().find((record) => ['manifest-before', 'manifest-target'].includes(record.kind));
  invariant(manifestRecord, 'Incomplete operation package lacks its durable manifest.');
  let manifestName = manifestRecord.payload.manifest_path;
  let manifestSha256 = manifestRecord.payload.manifest_sha256;
  invariant(/^rst005-evidence-0[01]-(?:before|target)\.json$/.test(manifestName) && /^[a-f0-9]{64}$/.test(manifestSha256), 'Recovery manifest binding is invalid.');
  const manifestHost = path.join(approval.evidence_root, manifestName);
  const manifestStat = fs.lstatSync(manifestHost);
  invariant(manifestStat.isFile() && !manifestStat.isSymbolicLink() && manifestStat.uid === 0
    && (manifestStat.mode & 0o7777) === 0o400 && manifestStat.nlink === 1
    && sha256File(manifestHost) === manifestSha256,
  'Recovery manifest custody or digest is invalid.');
  const sourceSha256 = moduleTreeSha(path.join(runtimeRoot, 'custom/mjlfinancement'));
  const checkpointStates = {
    'checkpoint-before-apply': 'prepared',
    'checkpoint-before-activation': 'ready_to_activate',
    'checkpoint-before-finalize': 'ready_to_finalize',
    'checkpoint-before-rehearsal-rollback': 'ready_to_rehearsal_rollback',
  };
  if (checkpoint) {
    validateRecoveryCheckpoint(checkpoint.payload, approval, checkpoint.payload.manifest_sha256, sourceSha256, checkpointStates[checkpoint.kind], checkpoint.previous_sha256);
    const checkpointManifest = chain.find((record) => ['manifest-before', 'manifest-target'].includes(record.kind)
      && record.payload.manifest_sha256 === checkpoint.payload.manifest_sha256);
    invariant(checkpointManifest && checkpointManifest.sequence < checkpoint.sequence, 'Recovery checkpoint does not bind an earlier durable manifest.');
  }
  let sequence = chain.length;
  let tail = chain.at(-1).sha256;
  const persist = (kind, payload) => {
    const result = writeDurableRecord(approval.evidence_root, { ...binding, sequence, kind, previousSha256: tail, payload });
    sequence += 1;
    tail = result.sha256;
    return result;
  };
  const authorizationHost = path.join(approval.evidence_root, 'authorization.json');
  const recoveryReportHost = path.join(approval.evidence_root, 'rst005-recovery-report.json');
  const oneOffNames = new Set();
  let oneOffSequence = 0;
  const nextName = () => {
    oneOffSequence += 1;
    const name = `${approval.compose_project_name}-rst005-${approval.nonce}-recover-${oneOffSequence}`;
    oneOffNames.add(name);
    return name;
  };
  const oneOff = (script, args = [], environment = [], volumes = [], mutation = false) => runApprovedOneOff({
    approval, runtimeRoot, runtimeEnvironment, name: nextName(), script, args, environment, volumes, mutation, signal,
    label: 'RST-005 fresh-process recovery evidence',
  });
  try {
    if (signal) signal.throwIfAborted();
    await assertLiveBinding();
    invariant(protectedTreeDigest(runtimeRoot) === approval.complete_tree_sha256, 'Recovery runtime snapshot changed.');
    const running = (await runCommand(DOCKER, [...composeBase(approval, runtimeRoot), 'ps', '--status', 'running', '--services'], { cwd: approval.repository_root, env: runtimeEnvironment, signal, label: 'RST-005 recovery traffic-stop recheck' })).toString('utf8').trim().split('\n').filter(Boolean).sort();
    invariant(running.join(',') === 'mariadb', 'RST-005 recovery traffic stop no longer holds.');
    await assertExclusiveDatabaseBoundary(approval, runtimeRoot, runtimeEnvironment, signal);
    const currentBeforeRecovery = JSON.parse((await oneOff('/opt/mjl-tests/fixtures/database-evidence.php')).toString('utf8'));
    const truth = JSON.parse((await oneOff('/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php', ['--mode=classify'])).toString('utf8'));
    invariant(['exact_phase1', 'guarded_transitional', 'target_pre_finalization', 'finalized_target', 'unknown'].includes(truth.classification), 'Recovery database classification is invalid.');
    invariant(truth.classification !== 'unknown', 'Recovery refuses unknown database truth; manual backup restoration is required.');
    invariant(checkpoint || truth.classification === 'exact_phase1', 'Manifest-only recovery refuses a mutated database without a durable checkpoint.');
    invariant(/^[a-f0-9]{64}$/.test(truth.protected_tables_sha256), 'Recovery protected-table evidence is invalid.');
    const composeAtRecovery = await composeResourceEvidence(approval, runtimeRoot, runtimeEnvironment);
    const originalManifest = JSON.parse(fs.readFileSync(manifestHost, 'utf8'));
    const existingRecoveryManifestRecord = chain.find((record) => record.kind === 'manifest-recovery');
    manifestName = 'rst005-evidence-02-recovery.json';
    const recoveryManifestHost = path.join(approval.evidence_root, manifestName);
    let recoveryManifest;
    if (existingRecoveryManifestRecord) {
      manifestSha256 = existingRecoveryManifestRecord.payload.manifest_sha256;
      invariant(existingRecoveryManifestRecord.payload.manifest_path === manifestName && sha256File(recoveryManifestHost) === manifestSha256,
        'Published recovery manifest is missing or contradictory.');
      recoveryManifest = JSON.parse(fs.readFileSync(recoveryManifestHost, 'utf8'));
    } else {
      recoveryManifest = {
        ...originalManifest,
        version: 3,
        database: { sha256: currentBeforeRecovery.database_sha256 },
        documents: { sha256: currentBeforeRecovery.documents_sha256 },
        ecm: { sha256: currentBeforeRecovery.ecm_sha256 },
        protected_tables: { sha256: truth.protected_tables_sha256, kind: 'rst005-non-activity-database-v2' },
        recovery: {
          classification: truth.classification, captured_at: new Date().toISOString(), original_manifest_sha256: manifestSha256,
          target_identity_sha256: binding.targetIdentitySha256, execution_identity_sha256: binding.executionIdentitySha256,
          before: currentBeforeRecovery, compose_resources: composeAtRecovery,
        },
      };
      manifestSha256 = writeImmutableJson(recoveryManifestHost, recoveryManifest);
      persist('manifest-recovery', { manifest_path: manifestName, manifest_sha256: manifestSha256 });
    }
    const beforeRecovery = recoveryManifest.recovery.before;
    invariant(beforeRecovery && recoveryManifest.recovery.compose_resources && /^[a-f0-9]{64}$/.test(recoveryManifest.recovery.compose_resources.sha256),
      'Recovery manifest lacks complete current protected-surface evidence.');
    if (!chain.some((record) => record.kind === 'checkpoint-before-recovery')) persist('checkpoint-before-recovery', { classification: recoveryManifest.recovery.classification, manifest_sha256: manifestSha256, before_database_sha256: beforeRecovery.database_sha256 });
    if (truth.classification !== 'exact_phase1') {
      await assertLiveBinding();
      invariant(protectedTreeDigest(runtimeRoot) === approval.complete_tree_sha256, 'Recovery runtime snapshot changed before mutation.');
      await assertExclusiveDatabaseBoundary(approval, runtimeRoot, runtimeEnvironment, signal);
      writeProtectedJson(authorizationHost, buildSharedAuthorization(approval, 'recover', manifestSha256));
      await runRst005RollbackCommand(approval, authorizationHost, manifestSha256, { mode: 'recover', manifestName, signal, name: nextName(), runtimeRoot, runtimeEnvironment, onMutationStarted: () => onStage(190) });
    }
    onStage(51);
    const finalTruth = JSON.parse((await oneOff('/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php', ['--mode=classify'])).toString('utf8'));
    invariant(finalTruth.classification === 'exact_phase1', 'Recovery did not converge to exact Phase 1 containment.');
    invariant(finalTruth.protected_tables_sha256 === recoveryManifest.protected_tables.sha256, 'Recovery changed the protected non-Activity database projection.');
    const after = JSON.parse((await oneOff('/opt/mjl-tests/fixtures/database-evidence.php')).toString('utf8'));
    onStage(211);
    const activity = retainedActivityEvidence(after, 'phase1');
    onStage(212);
    const originalActivity = checkpoint ? checkpoint.payload.before.activity : retainedActivityEvidence(beforeRecovery, 'phase1');
    invariant(activity.rows === 0 && activity.temporary_tables.length === 0
      && activity.table_sha256 === originalActivity.table_sha256,
    'Recovery did not restore the exact empty Phase 1 Activity foundation.');
    for (const field of ['documents_sha256', 'ecm_sha256', 'admin_sha256', 'module_metadata_sha256']) invariant(after[field] === beforeRecovery[field], `Recovery changed ${field}.`);
    onStage(213);
    const recoveryBeforeActivity = retainedActivityEvidence(beforeRecovery, recoveryManifest.recovery.classification.startsWith('target') || recoveryManifest.recovery.classification === 'finalized_target' ? 'target' : 'phase1');
    invariant(after.business_counts.audit_events === beforeRecovery.business_counts.audit_events
      && activity.audit_sha256 === recoveryBeforeActivity.audit_sha256,
    'Recovery changed audit history.');
    const changedTables = changedEvidenceKeys(beforeRecovery, after, 'restorable_table_sha256');
    const changedSchemaObjects = changedEvidenceKeys(beforeRecovery, after, 'restorable_schema_object_sha256');
    invariant(changedTables.every((table) => table.startsWith('llx_mjlfinancement_activity')) && changedSchemaObjects.every((kind) => kind === 'triggers'),
      'Recovery database delta exceeds exact Activity containment restoration.');
    const composeAfter = await composeResourceEvidence(approval, runtimeRoot, runtimeEnvironment);
    invariant(composeAfter.sha256 === recoveryManifest.recovery.compose_resources.sha256, 'Recovery changed Compose resources.');
    const result = {
      version: 3, unit: 'RST-005', mode: 'recover', status: recoveryManifest.recovery.classification === 'exact_phase1' ? 'already_phase1_containment' : 'phase1_containment_restored',
      operation_id: approval.operation_id, approved_commit: approval.approved_commit, complete_tree_sha256: approval.complete_tree_sha256,
      target_identity_sha256: binding.targetIdentitySha256, execution_identity_sha256: binding.executionIdentitySha256, classification_before: recoveryManifest.recovery.classification,
      manifest_sha256: manifestSha256, before_database_sha256: beforeRecovery.database_sha256,
      after_database_sha256: after.database_sha256, activity, recovery_policy: approval.recovery_policy,
      protected_tables_sha256: finalTruth.protected_tables_sha256, compose_resources: composeAfter,
      database_delta: { tables: changedTables, schema_objects: changedSchemaObjects },
    };
    persist('completed-recovery-report', result);
    writeImmutableJson(recoveryReportHost, result);
    return Object.freeze(result);
  } finally {
    await cleanupNamedContainers(oneOffNames, undefined, runtimeEnvironment);
  }
}

async function runRst005Rollback(options) {
  const { approval, buildSharedAuthorization } = options;
  const signal = options.signal;
  const runtimeEnvironment = options.runtimeEnvironment || process.env;
  const onStage = typeof options.onStage === 'function' ? options.onStage : () => {};
  const assertLiveBinding = typeof options.assertLiveBinding === 'function' ? options.assertLiveBinding : () => true;
  invariant(approval.mode === 'rollback' && isSharedPath(approval), 'Shared rollback approval is required.');
  custodyDirectory(approval.backup_root, true);
  custodyDirectory(approval.evidence_root, true);
  const runtimeRoot = runtimeSnapshot(approval, false, onStage, runtimeEnvironment);
  const manifestHost = path.join(approval.evidence_root, 'rst005-evidence-01-target.json');
  const rollbackManifestHost = path.join(approval.evidence_root, 'rst005-evidence-03-rollback.json');
  const reportHost = path.join(approval.evidence_root, 'rst005-launcher-report.json');
  const rollbackReportHost = path.join(approval.evidence_root, 'rst005-rollback-report.json');
  const authorizationHost = path.join(approval.evidence_root, 'authorization.json');
  for (const file of [manifestHost]) {
    const stat = fs.lstatSync(file);
    invariant(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && (stat.mode & 0o7777) === 0o400 && stat.nlink === 1, 'Rollback evidence custody is invalid.');
  }
  const targetManifestSha256 = sha256File(manifestHost);
  const sourceSha256 = moduleTreeSha(path.join(runtimeRoot, 'custom/mjlfinancement'));
  const recordBinding = { operationId: approval.operation_id, targetIdentitySha256: approval.target_identity_sha256, executionIdentitySha256: approval.execution_identity_sha256 };
  const chain = durableRecordChain(approval.evidence_root, recordBinding, { validateGrammar: true });
  invariant(!chain.some((record) => record.kind === 'completed-rollback-report'), 'Completed rollback package cannot be replayed.');
  const completedRecord = [...chain].reverse().find((record) => record.kind === 'completed-report');
  invariant(completedRecord, 'Post-completion rollback requires the durable completed execution report.');
  const report = completedRecord.payload;
  validateRollbackReport(report, approval, targetManifestSha256, sourceSha256);
  if (fs.existsSync(reportHost)) {
    const reportStat = fs.lstatSync(reportHost);
    invariant(reportStat.isFile() && !reportStat.isSymbolicLink() && reportStat.uid === 0
      && (reportStat.mode & 0o7777) === 0o400 && reportStat.nlink === 1
      && canonicalJson(JSON.parse(fs.readFileSync(reportHost, 'utf8'))) === canonicalJson(report),
    'Rollback report copy contradicts its durable completed record.');
  }
  const expected = report.finalized;
  const phase1Activity = report.activity_evidence.before;
  let recordSequence = chain.length;
  let recordTail = chain.at(-1).sha256;
  const persistRecord = (kind, payload) => {
    const result = writeDurableRecord(approval.evidence_root, { ...recordBinding, sequence: recordSequence, kind, previousSha256: recordTail, payload });
    recordSequence += 1;
    recordTail = result.sha256;
    return result;
  };
  let rollbackManifestSha256;
  if (fs.existsSync(rollbackManifestHost)) rollbackManifestSha256 = sha256File(rollbackManifestHost);
  else {
    const rollbackManifest = {
      ...JSON.parse(fs.readFileSync(manifestHost, 'utf8')),
      approval_nonce: approval.nonce,
      approval_sha256: approvalRecordSha256(approval),
      rollback: { original_manifest_sha256: targetManifestSha256, captured_at: new Date().toISOString() },
    };
    rollbackManifestSha256 = writeImmutableJson(rollbackManifestHost, rollbackManifest);
  }
  if (!chain.some((record) => record.kind === 'checkpoint-before-approved-rollback')) persistRecord('checkpoint-before-approved-rollback', { manifest_sha256: rollbackManifestSha256, original_manifest_sha256: targetManifestSha256, completed_report_sha256: completedRecord.sha256 });
  writeProtectedJson(authorizationHost, buildSharedAuthorization(approval, 'rollback', rollbackManifestSha256));
  const oneOffNames = new Set();
  let sequence = 0;
  const nextName = () => {
    sequence += 1;
    const name = `${approval.compose_project_name}-rst005-${approval.nonce}-rollback-${sequence}`;
    oneOffNames.add(name);
    return name;
  };
  try {
    if (signal) signal.throwIfAborted();
    onStage(40);
    await assertLiveBinding();
    const running = (await runCommand(DOCKER, [...composeBase(approval, runtimeRoot), 'ps', '--status', 'running', '--services'], { cwd: approval.repository_root, env: runtimeEnvironment, label: 'RST-005 rollback traffic-stop recheck', signal })).toString('utf8').trim().split('\n').filter(Boolean).sort();
    invariant(running.join(',') === 'mariadb', 'RST-005 rollback traffic stop no longer holds.');
    await assertExclusiveDatabaseBoundary(approval, runtimeRoot, runtimeEnvironment, signal);
    const composeBefore = await composeResourceEvidence(approval, runtimeRoot, runtimeEnvironment);
    const evidenceOneOff = async (script, args = []) => runApprovedOneOff({ approval, runtimeRoot, runtimeEnvironment, name: nextName(), script, args, signal, label: 'RST-005 rollback evidence' });
    const rollbackBefore = JSON.parse((await evidenceOneOff('/opt/mjl-tests/fixtures/database-evidence.php')).toString('utf8'));
    await runRst005RollbackCommand(approval, authorizationHost, rollbackManifestSha256, { signal, name: nextName(), runtimeRoot, runtimeEnvironment, manifestName: path.basename(rollbackManifestHost), onMutationStarted: () => onStage(190) });
    onStage(41);
    const preflight = JSON.parse((await evidenceOneOff('/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php', ['--mode=preflight'])).toString('utf8'));
    const after = JSON.parse((await evidenceOneOff('/opt/mjl-tests/fixtures/database-evidence.php')).toString('utf8'));
    const afterActivity = retainedActivityEvidence(after, 'phase1');
    invariant(preflight.status === 'ready' && preflight.schema === 'phase1'
      && preflight.protected_tables_sha256 === expected.protected_tables_sha256,
    'Standalone rollback did not restore the approved containment projection.');
    for (const field of ['documents_sha256', 'ecm_sha256', 'admin_sha256', 'module_metadata_sha256']) invariant(after[field] === rollbackBefore[field], `Standalone rollback changed ${field}.`);
    invariant(after.business_counts.activities === 0
      && after.business_counts.audit_events === rollbackBefore.business_counts.audit_events,
    'Standalone rollback changed business or audit row counts.');
    invariant(afterActivity.table_sha256 === phase1Activity.table_sha256
      && afterActivity.columns === phase1Activity.columns
      && afterActivity.audit_sha256 === retainedActivityEvidence(rollbackBefore, rollbackBefore.restorable_table_sha256.llx_mjlfinancement_activity === phase1Activity.table_sha256 ? 'phase1' : 'target').audit_sha256
      && afterActivity.audit_rows === rollbackBefore.business_counts.audit_events
      && afterActivity.temporary_tables.length === 0,
    'Standalone rollback lacks exact restored Activity/audit/temporary-object evidence.');
    const changedTables = changedEvidenceKeys(rollbackBefore, after, 'restorable_table_sha256');
    const changedSchemaObjects = changedEvidenceKeys(rollbackBefore, after, 'restorable_schema_object_sha256');
    invariant(changedTables.every((table) => table.startsWith('llx_mjlfinancement_activity')) && changedSchemaObjects.every((kind) => kind === 'triggers'), 'Standalone rollback database delta exceeds Activity containment restoration.');
    const composeAfter = await composeResourceEvidence(approval, runtimeRoot, runtimeEnvironment);
    invariant(composeAfter.sha256 === composeBefore.sha256, 'Standalone rollback changed Compose resources.');
    const rollbackResult = {
      version: 3, unit: 'RST-005', status: 'containment_restored', approved_commit: approval.approved_commit,
      operation_id: approval.operation_id, target_identity_sha256: recordBinding.targetIdentitySha256,
      execution_identity_sha256: recordBinding.executionIdentitySha256,
      complete_tree_sha256: approval.complete_tree_sha256, manifest_sha256: rollbackManifestSha256, original_manifest_sha256: targetManifestSha256,
      source: 'finalized-report',
      before: { database_sha256: rollbackBefore.database_sha256, documents_sha256: rollbackBefore.documents_sha256, ecm_sha256: rollbackBefore.ecm_sha256, admin_sha256: rollbackBefore.admin_sha256, module_metadata_sha256: rollbackBefore.module_metadata_sha256, compose_resources: composeBefore },
      after: { database_sha256: after.database_sha256, documents_sha256: after.documents_sha256, ecm_sha256: after.ecm_sha256, admin_sha256: after.admin_sha256, module_metadata_sha256: after.module_metadata_sha256, protected_tables_sha256: preflight.protected_tables_sha256, activity: afterActivity, compose_resources: composeAfter },
      database_delta: { tables: changedTables, schema_objects: changedSchemaObjects },
    };
    persistRecord('completed-rollback-report', rollbackResult);
    writeImmutableJson(rollbackReportHost, rollbackResult);
    return Object.freeze(rollbackResult);
  } finally {
    await cleanupNamedContainers(oneOffNames, undefined, runtimeEnvironment);
  }
}

function validateRollbackReport(report, approval, manifestSha256, sourceSha256 = report && report.source_sha256) {
  const expectedKeys = ['activity_evidence', 'approved_commit', 'backup_restore', 'before', 'complete_tree_sha256', 'database_delta', 'execution_identity_sha256', 'finalized', 'manifest_sha256', 'mode', 'operation_id', 'rollback', 'source_sha256', 'status', 'target_identity_sha256', 'unit', 'version'].sort();
  invariant(report && Object.keys(report).sort().join('\n') === expectedKeys.join('\n')
    && report.version === 3 && report.unit === 'RST-005' && report.mode === 'execute'
    && report.status === 'executed_target_finalized'
    && report.approved_commit === approval.approved_commit
    && report.complete_tree_sha256 === approval.complete_tree_sha256
    && report.operation_id === approval.operation_id
    && report.target_identity_sha256 === approval.target_identity_sha256
    && report.execution_identity_sha256 === approval.execution_identity_sha256
    && report.manifest_sha256 === manifestSha256
    && report.source_sha256 === sourceSha256 && /^[a-f0-9]{64}$/.test(report.source_sha256)
    && report.rollback === null,
  'Rollback evidence does not bind the approved execution tree and manifest.');
  const composeKeys = ['counts', 'sha256'].sort().join('\n');
  const composeCountKeys = ['containers', 'networks', 'volumes'].sort().join('\n');
  const validCompose = (value) => value && Object.keys(value).sort().join('\n') === composeKeys
    && /^[a-f0-9]{64}$/.test(value.sha256) && value.counts
    && Object.keys(value.counts).sort().join('\n') === composeCountKeys
    && Object.values(value.counts).every(Number.isInteger);
  const beforeKeys = ['admin_sha256', 'compose_resources', 'database_sha256', 'documents_sha256', 'ecm_sha256', 'module_metadata_sha256', 'protected_tables_sha256'].sort();
  invariant(report.before && Object.keys(report.before).sort().join('\n') === beforeKeys.join('\n')
    && beforeKeys.filter((field) => field !== 'compose_resources').every((field) => /^[a-f0-9]{64}$/.test(report.before[field]))
    && validCompose(report.before.compose_resources), 'Rollback report lacks exact before evidence.');
  const finalKeys = ['admin_sha256', 'business_counts', 'compose_resources', 'database_sha256', 'documents_sha256', 'ecm_sha256', 'module_metadata_sha256', 'protected_tables_sha256'].sort();
  invariant(report.finalized && Object.keys(report.finalized).sort().join('\n') === finalKeys.join('\n')
    && ['admin_sha256', 'database_sha256', 'documents_sha256', 'ecm_sha256', 'module_metadata_sha256', 'protected_tables_sha256'].every((field) => /^[a-f0-9]{64}$/.test(report.finalized[field]))
    && validCompose(report.finalized.compose_resources)
    && report.finalized.business_counts && Number.isInteger(report.finalized.business_counts.activities)
    && Number.isInteger(report.finalized.business_counts.audit_events),
  'Rollback report lacks exact finalized containment evidence.');
  invariant(report.database_delta && Array.isArray(report.database_delta.finalized_tables)
    && Object.keys(report.database_delta).sort().join('\n') === ['finalized_schema_objects', 'finalized_tables', 'rollback_schema_objects', 'rollback_tables'].sort().join('\n')
    && report.database_delta.finalized_tables.join(',') === 'llx_const,llx_menu,llx_mjlfinancement_activity,llx_user_rights'
    && Array.isArray(report.database_delta.finalized_schema_objects)
    && report.database_delta.finalized_schema_objects.join(',') === 'triggers',
  'Rollback report lacks the exact approved database delta.');
  invariant(report.database_delta.rollback_tables === null && report.database_delta.rollback_schema_objects === null, 'Executed report contains unexpected embedded rollback evidence.');
  const restoreKeys = ['fullPlaintextSha256', 'restorableDatabaseSha256', 'schemaPlaintextSha256'].sort().join('\n');
  invariant(report.backup_restore && Object.keys(report.backup_restore).sort().join('\n') === restoreKeys
    && Object.values(report.backup_restore).every((value) => /^[a-f0-9]{64}$/.test(value)), 'Rollback report lacks exact backup restore evidence.');
  const activity = report.activity_evidence;
  const activityKeys = ['audit_rows', 'audit_sha256', 'columns', 'oracle_sha256', 'rows', 'schema', 'table_sha256', 'temporary_tables', 'trigger_schema_sha256'].sort().join('\n');
  invariant(activity && activity.phase1_oracle_sha256 === 'db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2'
    && activity.target_oracle_sha256 === '8eb99ee99c6dc748bd368e925e9938ccf086291d264e3812ac6320c8ec06b745'
    && Object.keys(activity).sort().join('\n') === ['before', 'finalized', 'phase1_oracle_sha256', 'rollback', 'target_oracle_sha256'].sort().join('\n')
    && activity.before && activity.finalized && activity.rollback === null
    && Object.keys(activity.before).sort().join('\n') === activityKeys
    && Object.keys(activity.finalized).sort().join('\n') === activityKeys
    && activity.before.schema === 'phase1' && activity.finalized.schema === 'target'
    && activity.before.oracle_sha256 === activity.phase1_oracle_sha256
    && activity.finalized.oracle_sha256 === activity.target_oracle_sha256
    && activity.before.rows === 0 && activity.finalized.rows === 0
    && activity.before.audit_rows === activity.finalized.audit_rows
    && activity.before.audit_sha256 === activity.finalized.audit_sha256
    && activity.finalized.temporary_tables.length === 0
    && /^[a-f0-9]{64}$/.test(activity.before.table_sha256)
    && /^[a-f0-9]{64}$/.test(activity.finalized.table_sha256)
    && /^[a-f0-9]{64}$/.test(activity.before.trigger_schema_sha256)
    && /^[a-f0-9]{64}$/.test(activity.finalized.trigger_schema_sha256),
  'Rollback report lacks explicit immutable Activity, audit, and temporary-object evidence.');
  return true;
}

async function runRst005RollbackCommand(approval, authorizationHost, manifestSha256, options = {}) {
  const operationMode = options.mode || 'rollback';
  const manifestName = options.manifestName || 'rst005-evidence-01-target.json';
  await runApprovedOneOff({
    approval, runtimeRoot: options.runtimeRoot, runtimeEnvironment: options.runtimeEnvironment, name: options.name,
    script: '/var/www/html/custom/mjlfinancement/scripts/rst005_activity_foundation.php', mutation: true, signal: options.signal,
    environment: ['MJL_RST005_TRAFFIC_STOPPED=1', 'MJL_RST005_SHARED_LAUNCHER=1'],
    volumes: [`${approval.evidence_root}:/run/mjl-rst005/evidence:ro`, `${approval.backup_root}:/run/mjl-rst005/backups:ro`, `${authorizationHost}:/run/mjl-rst005/authorization.json:ro`],
    args: [`--mode=${operationMode}`, '--confirm=RST-005', `--evidence-manifest=/run/mjl-rst005/evidence/${manifestName}`, `--evidence-sha256=${manifestSha256}`],
    onMutationStarted: options.onMutationStarted,
    label: 'RST-005 containment rollback',
  });
}

function waitChild(child, label) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else {
        const error = new Error(`${label} failed closed.`);
        error.rst005Child = label;
        error.rst005Code = code;
        reject(error);
      }
    });
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      signal: options.signal,
      stdio: options.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    });
    const chunks = [];
    const errorChunks = [];
    let errorBytes = 0;
    child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => {
      if (errorBytes < 65536) {
        errorChunks.push(Buffer.from(chunk).subarray(0, 65536 - errorBytes));
        errorBytes += chunk.length;
      }
    });
    if (child.stdin) child.stdin.end(options.input);
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) return resolve(Buffer.concat(chunks));
      const stderrDiagnostic = Buffer.concat(errorChunks).toString('utf8');
      const diagnostic = options.isolatedDiagnostics ? `${stderrDiagnostic}\n${Buffer.concat(chunks).toString('utf8')}` : stderrDiagnostic;
      const error = new Error(`${options.label || command} failed closed.`);
      error.rst005Code = code;
      error.rst005Reason = /permission denied|operation not permitted|read-only file system|\bEACCES\b|\bEPERM\b/i.test(diagnostic) ? 'permission'
        : /conf\.php|configuration/i.test(diagnostic) ? 'configuration'
          : /no such (?:file|volume|container|network)|not found/i.test(diagnostic) ? 'missing'
            : /access denied/i.test(diagnostic) ? 'access' : 'other';
      if (error.rst005Reason === 'other') {
        error.rst005Reason = /already in use|conflict/i.test(diagnostic) ? 'conflict'
          : /phase 1|schema/i.test(diagnostic) ? 'schema'
            : /source|dependent/i.test(diagnostic) ? 'source'
              : /administrator/i.test(diagnostic) ? 'admin'
                : /root|cli/i.test(diagnostic) ? 'guard' : 'other';
      }
      if (options.isolatedDiagnostics) {
        const safeDiagnostic = diagnostic.replace(/[A-Za-z0-9+/=_-]{24,}/g, '[redacted]').slice(0, 1000).trim();
        if (safeDiagnostic) error.message += ` ${safeDiagnostic}`;
      }
      for (const chunk of errorChunks) chunk.fill(0);
      reject(error);
    });
  });
}

function feedKey(child, key) {
  const copy = Buffer.from(key);
  child.stdio[3].write(copy, (error) => {
    copy.fill(0);
    if (error) child.stdio[3].destroy(error);
    else child.stdio[3].destroy();
  });
}

async function encryptCommandOutput(command, args, key, destinationPath, options = {}) {
  invariant(Buffer.isBuffer(key) && key.length === 32, 'Encryption key must be 32 bytes.');
  const descriptor = fs.openSync(destinationPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  const destination = fs.createWriteStream(destinationPath, { fd: descriptor, autoClose: true });
  const source = spawn(command, args, { cwd: options.cwd, env: options.env || process.env, signal: options.signal, stdio: ['ignore', 'pipe', 'ignore'] });
  const encrypt = spawn('php', ['-r', encryptScript], { env: options.env || process.env, signal: options.signal, stdio: ['pipe', 'pipe', 'ignore', 'pipe'] });
  feedKey(encrypt, key);
  const plaintext = crypto.createHash('sha256');
  const ciphertext = crypto.createHash('sha256');
  const destinationFinished = finished(destination);
  source.stdout.on('data', (chunk) => plaintext.update(chunk));
  encrypt.stdout.on('data', (chunk) => ciphertext.update(chunk));
  encrypt.stdin.on('error', (error) => { if (error.code !== 'EPIPE') encrypt.stdin.destroy(error); });
  source.stdout.pipe(encrypt.stdin);
  encrypt.stdout.pipe(destination);
  try {
    await Promise.all([
      waitChild(source, 'Backup source'),
      waitChild(encrypt, 'Backup encryption'),
      destinationFinished,
    ]);
  } catch (error) {
    source.kill('SIGTERM');
    encrypt.kill('SIGTERM');
    destination.destroy();
    try { fs.unlinkSync(destinationPath); } catch (_) {}
    throw error;
  }
  invariant((fs.statSync(destinationPath).mode & 0o7777) === 0o600 && fs.statSync(destinationPath).size > 0, 'Encrypted backup custody is invalid.');
  const durableDescriptor = fs.openSync(destinationPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(durableDescriptor); } finally { fs.closeSync(durableDescriptor); }
  fsyncDirectory(path.dirname(destinationPath));
  return Object.freeze({ plaintextSha256: plaintext.digest('hex'), ciphertextSha256: ciphertext.digest('hex') });
}

async function decryptFileToCommand(sourcePath, key, command, args, options = {}) {
  invariant(Buffer.isBuffer(key) && key.length === 32, 'Decryption key must be 32 bytes.');
  const stat = fs.lstatSync(sourcePath);
  invariant(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o7777) === 0o600 && stat.nlink === 1 && stat.size > 0, 'Encrypted backup source custody is invalid.');
  const decrypt = spawn('php', ['-r', decryptScript], { env: options.env || process.env, signal: options.signal, stdio: ['pipe', 'pipe', 'ignore', 'pipe'] });
  const destination = spawn(command, args, { cwd: options.cwd, env: options.env || process.env, signal: options.signal, stdio: ['pipe', 'pipe', 'pipe'] });
  const destinationErrors = [];
  let destinationErrorBytes = 0;
  const captureDestination = (chunk) => {
    if (destinationErrorBytes < 65536) {
      destinationErrors.push(Buffer.from(chunk).subarray(0, 65536 - destinationErrorBytes));
      destinationErrorBytes += chunk.length;
    }
  };
  destination.stdout.on('data', captureDestination);
  destination.stderr.on('data', captureDestination);
  feedKey(decrypt, key);
  fs.createReadStream(sourcePath).pipe(decrypt.stdin);
  destination.stdin.on('error', (error) => { if (error.code !== 'EPIPE') destination.stdin.destroy(error); });
  decrypt.stdout.pipe(destination.stdin);
  try {
    await Promise.all([waitChild(decrypt, 'Backup decryption'), waitChild(destination, 'Backup restore')]);
  } catch (error) {
    decrypt.kill('SIGTERM');
    destination.kill('SIGTERM');
    if (error.rst005Child === 'Backup restore') {
      const diagnostic = Buffer.concat(destinationErrors).toString('utf8');
      error.rst005Reason = /access denied/i.test(diagnostic) ? 'access'
        : /unknown database/i.test(diagnostic) ? 'database'
          : /foreign key constraint/i.test(diagnostic) ? 'foreign-key'
            : /syntax/i.test(diagnostic) ? 'syntax' : 'other';
      for (const chunk of destinationErrors) chunk.fill(0);
    }
    throw error;
  }
  return true;
}

async function commandOutputSha256(command, args, options = {}) {
  const child = spawn(command, args, { cwd: options.cwd, env: options.env || process.env, signal: options.signal, stdio: ['ignore', 'pipe', 'ignore'] });
  const hash = crypto.createHash('sha256');
  child.stdout.on('data', (chunk) => hash.update(chunk));
  child.stdout.resume();
  await waitChild(child, options.label || 'Digest command');
  return hash.digest('hex');
}

async function verifyEncryptedBackups(options) {
  const { approval, key, schemaPath, fullPath, schemaPlaintextSha256, fullPlaintextSha256, sourceEvidence } = options;
  const onStage = typeof options.onStage === 'function' ? options.onStage : () => {};
  const signal = options.signal;
  const names = isolatedRestoreNames(approval.nonce);
  const exactNames = Object.values(names);
  for (const name of exactNames) invariant(/^mjl-rst005-(?:db|evidence|net|dbvol|docvol)-[a-f0-9]{32}$/.test(name), 'Unsafe isolated restore resource name.');
  const runtimeEnvironment = options.runtimeEnvironment || process.env;
  const docker = (...args) => runCommand(DOCKER, args, { label: 'Isolated restore Docker command', signal, env: runtimeEnvironment });
  try {
    if (signal) signal.throwIfAborted();
    // A fresh, approval-bound launcher owns these nonce-derived names and may
    // reap only its own prior abrupt-loss resources before recreating them.
    await cleanupIsolatedRestoreResources(names, undefined, runtimeEnvironment);
    for (const container of [names.databaseContainer, names.evidenceContainer]) {
      const existing = await runCommand(DOCKER, ['ps', '-aq', '--filter', `name=^/${container}$`], { label: 'Isolated restore collision check', env: runtimeEnvironment });
      invariant(existing.toString('utf8').trim() === '', 'Isolated restore container name already exists.');
    }
    await docker('network', 'create', '--internal', names.network);
    const restoreLifetimeSeconds = approval.target_profile === 'shared' ? '900' : '30';
    const databaseCreated = (await docker(
      'container', 'create', '--pull=never', '--rm', '--name', names.databaseContainer, '--network', names.network, '--restart', 'no',
      '--read-only', '--security-opt', 'no-new-privileges:true',
      '--tmpfs', '/var/lib/mysql:rw,noexec,nosuid,nodev,mode=0700', '--tmpfs', '/run/mysqld:rw,noexec,nosuid,nodev,mode=0755',
      '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,mode=1777', '-e', 'MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1',
      '--entrypoint', '/usr/bin/timeout', approval.docker_runtime.images.mariadb.id,
      '--signal=KILL', '--kill-after=10', restoreLifetimeSeconds, '/usr/local/bin/docker-entrypoint.sh', 'mariadbd',
    )).toString('utf8').trim();
    const databaseCreatedInspect = JSON.parse((await docker('container', 'inspect', databaseCreated)).toString('utf8'))[0];
    invariant(databaseCreatedInspect.State.Status === 'created' && databaseCreatedInspect.Image === approval.docker_runtime.images.mariadb.id
      && databaseCreatedInspect.HostConfig.NetworkMode === names.network && databaseCreatedInspect.HostConfig.RestartPolicy.Name === 'no'
      && databaseCreatedInspect.HostConfig.AutoRemove === true && databaseCreatedInspect.HostConfig.ReadonlyRootfs === true
      && (databaseCreatedInspect.HostConfig.SecurityOpt || []).includes('no-new-privileges:true')
      && databaseCreatedInspect.Config.Entrypoint.join(',') === '/usr/bin/timeout'
      && databaseCreatedInspect.Config.Cmd.join(',') === `--signal=KILL,--kill-after=10,${restoreLifetimeSeconds},/usr/local/bin/docker-entrypoint.sh,mariadbd`
      && databaseCreatedInspect.HostConfig.Tmpfs['/var/lib/mysql'] === 'rw,noexec,nosuid,nodev,mode=0700',
    'Isolated restore database immutable-image inspection failed.');
    await docker('start', databaseCreated);
    onStage(246);
    if (signal) signal.throwIfAborted();
    onStage(220);
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      try {
        await docker('exec', names.databaseContainer, 'mariadb-admin', '-h127.0.0.1', '-uroot', 'ping', '--silent');
        ready = true;
        break;
      } catch (_) {
        if (signal) signal.throwIfAborted();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    invariant(ready, 'Isolated restore database did not become ready.');
    onStage(221);
    const createDatabase = async () => {
      await docker('exec', names.databaseContainer, 'mariadb', '-uroot', '-e', 'DROP DATABASE IF EXISTS dolidb; CREATE DATABASE dolidb CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;');
    };
    await createDatabase();
    onStage(241);
    try {
      await decryptFileToCommand(schemaPath, key, DOCKER, ['exec', '-i', names.databaseContainer, 'mariadb', '-uroot', 'dolidb'], { signal, env: runtimeEnvironment });
      onStage(222);
    } catch (error) {
      const reasonStage = { access: 249, database: 250, 'foreign-key': 251, syntax: 252, other: 253 };
      let stage = error.rst005Child === 'Backup decryption' ? 247 : (reasonStage[error.rst005Reason] || 248);
      if (error.rst005Child === 'Backup restore' && Number.isInteger(error.rst005Code) && error.rst005Code >= 1 && error.rst005Code <= 9) stage = 230 + error.rst005Code;
      try {
        const running = await runCommand(DOCKER, ['inspect', '-f', '{{.State.Running}}:{{.State.OOMKilled}}:{{.State.ExitCode}}', names.databaseContainer], { label: 'Restore database state inspection', env: runtimeEnvironment });
        if (!running.toString('utf8').startsWith('true:false:0')) stage = 254;
      } catch (_) { stage = 254; }
      onStage(stage);
      throw error;
    }
    const dumpBase = ['exec', names.databaseContainer, 'mariadb-dump', '-uroot', '--routines', '--events', '--triggers', '--skip-comments'];
    onStage(242);
    const schemaDigest = await commandOutputSha256(DOCKER, [...dumpBase, '--no-data', 'dolidb'], { label: 'Isolated schema redump', signal, env: runtimeEnvironment });
    invariant(schemaDigest === schemaPlaintextSha256, 'Encrypted schema backup did not round-trip exactly.');
    await createDatabase();
    onStage(243);
    await decryptFileToCommand(fullPath, key, DOCKER, ['exec', '-i', names.databaseContainer, 'mariadb', '-uroot', 'dolidb'], { signal, env: runtimeEnvironment });
    onStage(223);
    onStage(244);
    const fullDigest = await commandOutputSha256(DOCKER, [...dumpBase, '--order-by-primary', 'dolidb'], { label: 'Isolated full redump', signal, env: runtimeEnvironment });
    invariant(fullDigest === fullPlaintextSha256, 'Encrypted full backup did not round-trip exactly.');
    const evidenceCreated = (await docker(
      'container', 'create', '--pull=never', '--rm', '--name', names.evidenceContainer, '--network', names.network,
      '--read-only', '--cap-drop', 'ALL', '--cap-add', 'DAC_READ_SEARCH', '--security-opt', 'no-new-privileges:true',
      '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,mode=1777',
      '-e', `DOLI_DB_HOST=${names.databaseContainer}`, '-e', 'DOLI_DB_NAME=dolidb', '-e', 'DOLI_DB_USER=root', '-e', 'DOLI_DB_PASSWORD=',
      '-v', `${options.runtimeRoot || approval.repository_root}/tests:/opt/mjl-tests:ro`, '--tmpfs', '/var/www/documents:rw,noexec,nosuid,nodev,mode=0700',
      '--entrypoint', '/usr/local/bin/php', approval.docker_runtime.images.dolibarr.id, '/opt/mjl-tests/fixtures/database-evidence.php',
    )).toString('utf8').trim();
    const evidenceCreatedInspect = JSON.parse((await docker('container', 'inspect', evidenceCreated)).toString('utf8'))[0];
    invariant(evidenceCreatedInspect.State.Status === 'created' && evidenceCreatedInspect.Image === approval.docker_runtime.images.dolibarr.id
      && evidenceCreatedInspect.HostConfig.NetworkMode === names.network && evidenceCreatedInspect.HostConfig.AutoRemove === true
      && evidenceCreatedInspect.HostConfig.ReadonlyRootfs === true
      && (evidenceCreatedInspect.HostConfig.CapDrop || []).join(',') === 'ALL'
      && (evidenceCreatedInspect.HostConfig.CapAdd || []).join(',') === 'CAP_DAC_READ_SEARCH'
      && (evidenceCreatedInspect.HostConfig.SecurityOpt || []).includes('no-new-privileges:true')
      && evidenceCreatedInspect.HostConfig.Tmpfs && evidenceCreatedInspect.HostConfig.Tmpfs['/tmp'] === 'rw,noexec,nosuid,nodev,mode=1777',
    'Isolated restore evidence immutable-image inspection failed.');
    const evidenceRun = docker('start', '--attach', evidenceCreated);
    onStage(255);
    if (signal) signal.throwIfAborted();
    const evidenceBytes = await evidenceRun;
    const restoredEvidence = JSON.parse(evidenceBytes.toString('utf8'));
    invariant(restoredEvidence.restorable_database_sha256 === sourceEvidence.restorable_database_sha256, 'Isolated restored logical database evidence does not match preflight.');
    return Object.freeze({ schemaPlaintextSha256, fullPlaintextSha256, restorableDatabaseSha256: restoredEvidence.restorable_database_sha256 });
  } finally {
    await cleanupIsolatedRestoreResources(names, undefined, runtimeEnvironment);
  }
}

async function cleanupIsolatedRestoreResources(names, execute = runCommand, runtimeEnvironment = process.env) {
  const maximumAttempts = 300;
  const convergenceDelayMs = 100;
  const remove = async (...arguments_) => {
    try { return await execute(...arguments_); } catch (error) {
      if (error && (['access', 'permission'].includes(error.rst005Reason) || ['EACCES', 'EPERM'].includes(error.code))) throw new Error('SECURITY/ACCESS-BLOCKED — DO NOT RETRY: isolated restore cleanup permission denied.');
      if (error && ['missing', 'conflict'].includes(error.rst005Reason)) return null;
      throw error;
    }
  };
  const observe = async (...arguments_) => {
    try { return await execute(...arguments_); } catch (error) {
      if (error && (['access', 'permission'].includes(error.rst005Reason) || ['EACCES', 'EPERM'].includes(error.code))) throw new Error('SECURITY/ACCESS-BLOCKED — DO NOT RETRY: isolated restore observation permission denied.');
      throw error;
    }
  };
  let survivors = [];
  for (let retry = 0; retry < maximumAttempts; retry += 1) {
    for (const container of [names.evidenceContainer, names.databaseContainer]) await remove(DOCKER, ['rm', '-f', container], { label: 'Isolated restore container cleanup', env: runtimeEnvironment });
    survivors = [];
    for (const container of [names.evidenceContainer, names.databaseContainer]) if ((await observe(DOCKER, ['ps', '-aq', '--filter', `name=^/${container}$`], { label: 'Container cleanup check', env: runtimeEnvironment })).toString('utf8').trim()) survivors.push(`container:${container}`);
    if (survivors.length === 0) break;
    if (retry + 1 < maximumAttempts) await new Promise((resolve) => setTimeout(resolve, convergenceDelayMs));
  }
  if (survivors.length > 0) throw new Error(`Isolated restore resources survived cleanup: ${survivors.join(',')}`);
  for (let retry = 0; retry < maximumAttempts; retry += 1) {
    await remove(DOCKER, ['network', 'rm', names.network], { label: 'Isolated restore network cleanup', env: runtimeEnvironment });
    for (const volume of [names.databaseVolume, names.documentVolume]) await remove(DOCKER, ['volume', 'rm', volume], { label: 'Isolated restore volume cleanup', env: runtimeEnvironment });
    survivors = [];
    if ((await observe(DOCKER, ['network', 'ls', '-q', '--filter', `name=^${names.network}$`], { label: 'Network cleanup check', env: runtimeEnvironment })).toString('utf8').trim()) survivors.push('network');
    for (const volume of [names.databaseVolume, names.documentVolume]) if ((await observe(DOCKER, ['volume', 'ls', '-q', '--filter', `name=^${volume}$`], { label: 'Volume cleanup check', env: runtimeEnvironment })).toString('utf8').trim()) survivors.push(`volume:${volume}`);
    if (survivors.length === 0) return true;
    if (retry + 1 < maximumAttempts) await new Promise((resolve) => setTimeout(resolve, convergenceDelayMs));
  }
  throw new Error(`Isolated restore resources survived cleanup: ${survivors.join(',')}`);
}

async function cleanupNamedContainers(names, execute = runCommand, runtimeEnvironment = process.env) {
  const exactNames = [...names];
  for (const name of exactNames) invariant(/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(name), 'Unsafe RST-005 one-off container name.');
  let survivors = [];
  const cleanup = async (...arguments_) => {
    try { return await execute(...arguments_); } catch (error) {
      if (error && (['access', 'permission'].includes(error.rst005Reason) || ['EACCES', 'EPERM'].includes(error.code))) throw new Error('SECURITY/ACCESS-BLOCKED — DO NOT RETRY: one-off cleanup permission denied.');
      if (error && ['missing', 'conflict'].includes(error.rst005Reason)) return null;
      throw error;
    }
  };
  for (let retry = 0; retry < 3; retry += 1) {
    for (const name of exactNames) await cleanup(DOCKER, ['rm', '-f', name], { label: 'RST-005 one-off cleanup', env: runtimeEnvironment });
    survivors = [];
    for (const name of exactNames) if (((await cleanup(DOCKER, ['ps', '-aq', '--filter', `name=^/${name}$`], { label: 'RST-005 one-off cleanup check', env: runtimeEnvironment })) || Buffer.alloc(0)).toString('utf8').trim()) survivors.push(name);
    if (survivors.length === 0) return true;
  }
  throw new Error(`RST-005 one-off containers survived cleanup: ${survivors.join(',')}`);
}

module.exports = {
  classifyDatabaseTruth,
  cleanupIsolatedRestoreResources,
  cleanupNamedContainers,
  composeResourceEvidence,
  decryptFileToCommand,
  durableRecordChain,
  encryptCommandOutput,
  isolatedRestoreNames,
  moduleTreeSha,
  runCommand,
  runRst005Operation,
  runRst005Recover,
  runRst005Rollback,
  writeDurableRecord,
  validateRollbackReport,
  verifyEncryptedBackups,
};
