#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { protectedTreeEvidence, sanitizedRuntimeEnvironment, SHARED_PROFILE, targetLockPaths, validateCustodyAncestors, verifyInheritedTargetLock } = require('./rst005_shared_launcher.lib');
const { runRst002bOperation, runRst002bRecover, runRst002bRollback, canonicalJson, inspectForwardPrefix } = require('./rst002b_shared_operation.lib');

function invariant(value, message) { if (!value) throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readProtected(file, maximum, allowEmpty = false) {
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(descriptor); invariant(stat.isFile() && stat.uid === 0 && stat.nlink === 1 && (stat.mode & 0o7777) === 0o400 && stat.size <= maximum && (allowEmpty || stat.size > 0), 'Protected input custody is invalid.');
    return { bytes: fs.readFileSync(descriptor), stat: { dev: stat.dev, ino: stat.ino, size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs } };
  } finally { fs.closeSync(descriptor); }
}
function sameInput(left, right) { return canonicalJson(left.stat) === canonicalJson(right.stat) && left.bytes.length === right.bytes.length && crypto.timingSafeEqual(left.bytes, right.bytes); }
function parseCanonical(input, label) { const value = JSON.parse(input.bytes.toString('utf8')); invariant(input.bytes.toString('utf8') === `${canonicalJson(value)}\n`, `${label} is not canonical.`); return value; }
function parseMode() { invariant(process.argv.length === 3 && /^--mode=(execute|recover|rollback)$/.test(process.argv[2]), 'Use one exact launcher mode.'); return process.argv[2].slice(7); }
function isWithin(candidate, parent) { const relative = path.relative(parent, candidate); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); }
function validateCustodyRoot(directory, repositoryRoot) {
  invariant(path.isAbsolute(directory) && path.normalize(directory) === directory && !isWithin(directory, repositoryRoot)
    && !isWithin(repositoryRoot, directory) && !isWithin(directory, '/var/www'), 'Artifact root boundary is invalid.');
  validateCustodyAncestors(directory, 0);
  const stat = fs.lstatSync(directory);
  invariant(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0 && (stat.mode & 0o7777) === 0o700, 'Artifact root custody is invalid.');
}
function composeArgs(approval, tail) { return ['compose','--env-file','/dev/null','--project-directory',approval.repository_root,...approval.compose_files.flatMap((entry) => ['-f',entry.path]),'-p',approval.compose_project_name,...tail]; }
let disposableDiagnostics = false;
function validateApproval(value, mode) {
  const base = ['approved_commit','backup_key_sha256','backup_root','complete_tree_manifest_sha256','complete_tree_sha256','compose_config_sha256','compose_files','compose_project_name','containers','database_name','database_root','document_root','evidence_root','expires_at','issued_at','mode','mutation_lock_path','nonce','operation_id','repository_root','target_lock_path','target_profile','unit','version','images'];
  if(value && value.target_profile==='disposable_shared_shape' && value.failure_point!==undefined) base.push('failure_point');
  const expected = value.mode === 'rollback' ? [...base,'prior_execution_report'].sort() : base.sort();
  invariant(value && Object.keys(value).sort().join('\n') === expected.join('\n'), 'Approval fields are not exact.');
  invariant(value.version === 1 && value.unit === 'RST-002B' && value.mode === (mode === 'recover' ? 'execute' : mode), 'Approval mode or unit is invalid.');
  invariant(/^[a-f0-9]{40}$/.test(value.approved_commit) && /^[a-f0-9]{64}$/.test(value.complete_tree_sha256) && /^[a-f0-9]{64}$/.test(value.complete_tree_manifest_sha256) && /^[a-f0-9]{64}$/.test(value.compose_config_sha256) && /^[a-f0-9]{64}$/.test(value.backup_key_sha256) && /^[a-f0-9]{32}$/.test(value.operation_id) && /^[a-f0-9]{32}$/.test(value.nonce), 'Approval identities are invalid.');
  invariant(value.database_name === 'dolidb' && ['shared','disposable_shared_shape'].includes(value.target_profile),'Target profile is invalid.');
  if(value.target_profile==='shared') invariant(value.repository_root===SHARED_PROFILE.repository_root&&value.compose_project_name===SHARED_PROFILE.compose_project_name&&value.database_root===SHARED_PROFILE.database_root&&value.document_root===SHARED_PROFILE.document_root,'Shared target identity is invalid.');
  else invariant(/^\/tmp\/rst002b-launcher-[^/]+\/repository$/.test(value.repository_root)&&/^mjl-test-rst002b-shared-shape-[a-z0-9-]+$/.test(value.compose_project_name)&&value.database_root===path.join(value.repository_root,'data/mariadb')&&value.document_root===path.join(value.repository_root,'data/documents'),'Disposable shared-shape target identity is invalid.');
  if(value.failure_point!==undefined) invariant(value.target_profile==='disposable_shared_shape'&&/^(?:forward-|rollback-)/.test(value.failure_point),'Failure injection is restricted to the disposable shared-shape profile.');
  invariant(Date.parse(value.issued_at) <= Date.now() && (mode === 'recover' || Date.parse(value.expires_at) > Date.now()) && Date.parse(value.expires_at) - Date.parse(value.issued_at) <= 86400000, 'Approval validity is invalid.');
  invariant(Array.isArray(value.compose_files) && value.compose_files.length === 1 && Object.keys(value.compose_files[0]).sort().join(',')==='path,sha256' && value.compose_files[0].path === `${value.repository_root}/docker-compose.yml` && /^[a-f0-9]{64}$/.test(value.compose_files[0].sha256), 'Compose binding is invalid.');
  const sharedLocks = targetLockPaths(value.target_profile==='shared'?{target_profile:'shared',...SHARED_PROFILE}:value); invariant(value.target_lock_path === sharedLocks.target && value.mutation_lock_path === sharedLocks.mutation, 'Lock binding is invalid.');
  invariant(value.images && Object.keys(value.images).sort().join(',')==='dolibarr,mariadb' && /^sha256:[a-f0-9]{64}$/.test(value.images.mariadb) && /^sha256:[a-f0-9]{64}$/.test(value.images.dolibarr), 'Image binding is invalid.');
  invariant(value.containers && Object.keys(value.containers).sort().join(',')==='dolibarr,mariadb' && /^[a-f0-9]{64}$/.test(value.containers.mariadb) && /^[a-f0-9]{64}$/.test(value.containers.dolibarr), 'Container binding is invalid.');
  if (value.mode === 'rollback') invariant(value.prior_execution_report && Object.keys(value.prior_execution_report).sort().join(',')==='path,sha256' && path.isAbsolute(value.prior_execution_report.path) && path.normalize(value.prior_execution_report.path)===value.prior_execution_report.path && /^[a-f0-9]{64}$/.test(value.prior_execution_report.sha256), 'Rollback report binding is invalid.');
  return value;
}
async function main() {
  invariant(typeof process.getuid === 'function' && process.getuid() === 0, 'Root operator required.'); const mode = parseMode(); const env = sanitizedRuntimeEnvironment(process.env, 'shared');
  const initial = { approval: readProtected('/run/mjl-rst002b/approval/record',65536), key: readProtected('/run/mjl-rst002b/key/bytes',32), traffic: readProtected('/run/mjl-rst002b/traffic/record',16384) };
  invariant(initial.key.bytes.length === 32, 'Backup key length is invalid.'); const approval = validateApproval(parseCanonical(initial.approval,'Approval'), mode); disposableDiagnostics = approval.target_profile === 'disposable_shared_shape'; invariant(sha256(initial.key.bytes) === approval.backup_key_sha256, 'Backup key mismatch.');
  validateCustodyRoot(approval.backup_root, approval.repository_root); validateCustodyRoot(approval.evidence_root, approval.repository_root);
  invariant(!isWithin(approval.backup_root, approval.evidence_root) && !isWithin(approval.evidence_root, approval.backup_root), 'Artifact roots must be disjoint.');
  if (approval.mode==='rollback') { validateCustodyAncestors(path.dirname(approval.prior_execution_report.path),0); const prior=readProtected(approval.prior_execution_report.path,65536); const value=parseCanonical(prior,'Prior execution report'); const keys=['approved_commit','complete_tree_sha256','mode','operation_id','previous_sha256','status','unit','version'].sort(); invariant(Object.keys(value).sort().join('\n')===keys.join('\n') && sha256(prior.bytes)===approval.prior_execution_report.sha256 && value.version===1 && value.unit==='RST-002B' && value.mode==='execute' && value.status==='complete' && value.approved_commit===approval.approved_commit && value.complete_tree_sha256===approval.complete_tree_sha256,'Prior execution report binding is invalid.'); }
  const traffic = parseCanonical(initial.traffic,'Traffic-stop'); const trafficKeys=['approval_sha256','exclusive_docker_administration','expires_at','no_direct_database_writers','no_direct_host_writers','operation_id','stopped_at','unit','version'].sort();
  invariant(Object.keys(traffic).sort().join('\n')===trafficKeys.join('\n') && traffic.version === 1 && traffic.unit === 'RST-002B' && traffic.operation_id === approval.operation_id && traffic.approval_sha256 === sha256(initial.approval.bytes) && traffic.exclusive_docker_administration === true && traffic.no_direct_host_writers === true && traffic.no_direct_database_writers === true && Date.parse(traffic.stopped_at) >= Date.parse(approval.issued_at) && Date.parse(traffic.expires_at) > Date.now() && Date.parse(traffic.expires_at) <= Date.parse(traffic.stopped_at) + 900000, 'Traffic-stop record is invalid.');
  if (mode === 'recover') invariant(inspectForwardPrefix(approval.evidence_root, approval) > 0, 'Recovery requires an existing approval-bound durable operation prefix.');
  verifyInheritedTargetLock(approval.target_lock_path); verifyInheritedTargetLock(approval.mutation_lock_path);
  const assertLiveBinding = async (serviceState = 'stopped') => {
    const fresh = { approval: readProtected('/run/mjl-rst002b/approval/record',65536), key: readProtected('/run/mjl-rst002b/key/bytes',32), traffic: readProtected('/run/mjl-rst002b/traffic/record',16384) };
    invariant(sameInput(initial.approval,fresh.approval) && sameInput(initial.key,fresh.key) && sameInput(initial.traffic,fresh.traffic), 'Protected launcher input identity changed.');
    invariant(Date.parse(traffic.expires_at)>Date.now(), 'Traffic-stop authority expired before mutation completion.');
    const git = (tail) => execFileSync('/usr/bin/git',['-c',`safe.directory=${approval.repository_root}`,...tail],{cwd:approval.repository_root,encoding:'utf8',env});
    invariant(git(['rev-parse','--verify','HEAD']).trim() === approval.approved_commit && git(['status','--porcelain=v1','--untracked-files=all']) === '', 'Repository binding changed.');
    const tree = protectedTreeEvidence(approval.repository_root); invariant(tree.completeTreeSha256 === approval.complete_tree_sha256 && tree.manifestSha256 === approval.complete_tree_manifest_sha256, 'Protected tree binding changed.');
    invariant(sha256(fs.readFileSync(approval.compose_files[0].path)) === approval.compose_files[0].sha256, 'Compose source binding changed.');
    const config = execFileSync('/usr/bin/docker',composeArgs(approval,['config','--format','json']),{cwd:approval.repository_root,env}); invariant(sha256(config) === approval.compose_config_sha256, 'Resolved Compose binding changed.');
    for (const [name,reference] of [['mariadb','mariadb:11'],['dolibarr','dolibarr/dolibarr:23.0.2']]) invariant(JSON.parse(execFileSync('/usr/bin/docker',['image','inspect',reference],{encoding:'utf8',env}))[0].Id === approval.images[name], `${name} image binding changed.`);
    for (const service of ['dolibarr','mariadb']) { const id=execFileSync('/usr/bin/docker',composeArgs(approval,['ps','-a','-q',service]),{cwd:approval.repository_root,encoding:'utf8',env}).trim(); invariant(id===approval.containers[service] && JSON.parse(execFileSync('/usr/bin/docker',['container','inspect',id],{encoding:'utf8',env}))[0].Image===approval.images[service],`${service} container binding changed.`); }
    const running=execFileSync('/usr/bin/docker',composeArgs(approval,['ps','--status','running','--services']),{cwd:approval.repository_root,encoding:'utf8',env}).trim().split('\n').filter(Boolean).sort();
    const expected=serviceState==='running' ? [['dolibarr','mariadb']] : serviceState==='completed' ? [['mariadb'],['dolibarr','mariadb']] : [['mariadb']];
    invariant(expected.some((candidate)=>canonicalJson(running)===canonicalJson(candidate)),'Shared service state changed.');
  };
  const controller = new AbortController(); for (const signal of ['SIGINT','SIGTERM','SIGHUP']) process.once(signal, () => controller.abort(new Error(`RST-002B interrupted by ${signal}.`)));
  const completedPrefix = (mode==='recover' && fs.existsSync(path.join(approval.evidence_root,'rst002b-03-after.json')))
    || (mode==='rollback' && fs.existsSync(path.join(approval.evidence_root,'rst002b-rollback-02-after.json')));
  await assertLiveBinding(completedPrefix ? 'completed' : 'stopped'); const options = { approval, key: initial.key.bytes, assertLiveBinding, env, signal: controller.signal };
  const result = mode === 'rollback' ? await runRst002bRollback(options) : mode === 'recover' ? await runRst002bRecover(options) : await runRst002bOperation(options);
  initial.key.bytes.fill(0); process.stdout.write(`${JSON.stringify({status:result.status,mode,commit:approval.approved_commit,complete_tree_sha256:approval.complete_tree_sha256})}\n`);
}
main().catch((error) => { process.stderr.write(disposableDiagnostics ? `RST-002B disposable launcher failed closed: ${error.message}\n` : 'RST-002B shared launcher failed closed.\n'); process.exitCode = 1; });
