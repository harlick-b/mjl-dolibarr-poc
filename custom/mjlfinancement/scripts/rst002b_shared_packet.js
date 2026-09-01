#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { protectedTreeEvidence, sanitizedRuntimeEnvironment, SHARED_PROFILE, targetLockPaths, validateCustodyAncestors } = require('./rst005_shared_launcher.lib');
const { canonicalJson } = require('./rst002b_shared_operation.lib');

function invariant(value, message) { if (!value) throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function fsyncDirectory(directory) { const descriptor = fs.openSync(directory, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0)); try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); } }
function protectedDirectory(directory) { fs.mkdirSync(directory, { mode: 0o700 }); fs.chownSync(directory,0,0); fs.chmodSync(directory,0o700); fsyncDirectory(path.dirname(directory)); }
function protectedFile(file, bytes) { const descriptor = fs.openSync(file, fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY|fs.constants.O_NOFOLLOW,0o400); try { fs.writeFileSync(descriptor,bytes); fs.fsyncSync(descriptor); fs.fchownSync(descriptor,0,0); fs.fchmodSync(descriptor,0o400); } finally { fs.closeSync(descriptor); } fsyncDirectory(path.dirname(file)); }
function protectedExistingFile(file) { invariant(path.isAbsolute(file) && path.normalize(file) === file && fs.realpathSync(file) === file, 'Prior report path is invalid.'); validateCustodyAncestors(path.dirname(file),0); const descriptor=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW); try { const stat=fs.fstatSync(descriptor); invariant(stat.isFile() && stat.uid===0 && stat.nlink===1 && (stat.mode&0o7777)===0o400 && stat.size>0 && stat.size<=65536,'Prior report custody is invalid.'); return fs.readFileSync(descriptor); } finally { fs.closeSync(descriptor); } }
function parseArguments(argv) {
  const values = {};
  for (const argument of argv) { const match = argument.match(/^--(mode|output-root|prior-report|profile|failure-point)=(.+)$/); invariant(match && values[match[1]] === undefined, 'Packet arguments are invalid.'); values[match[1]] = match[2]; }
  invariant(['execute','rollback'].includes(values.mode) && path.isAbsolute(values['output-root']) && path.normalize(values['output-root']) === values['output-root'] && !fs.existsSync(values['output-root']), 'Packet target is invalid.');
  invariant(values.mode === 'rollback' ? path.isAbsolute(values['prior-report'] || '') : values['prior-report'] === undefined, 'Rollback requires one prior report; execute forbids it.');
  invariant(values.profile === undefined || values.profile === 'disposable-shared-shape','Packet profile is invalid.');
  invariant(values.profile === 'disposable-shared-shape' ? values['failure-point'] !== undefined : values['failure-point'] === undefined,'Failure injection requires the disposable shared-shape profile.'); return values;
}
function main() {
  invariant(typeof process.getuid === 'function' && process.getuid() === 0, 'Root operator required.'); const args = parseArguments(process.argv.slice(2)); const repositoryRoot = process.cwd(); const env = sanitizedRuntimeEnvironment(process.env,'shared');
  const rehearsal=args.profile==='disposable-shared-shape'; const composeProjectName=rehearsal?(process.env.COMPOSE_PROJECT_NAME||''):'mjl-dolibarr-poc';
  const git=(tail)=>execFileSync('/usr/bin/git',['-c',`safe.directory=${repositoryRoot}`,...tail],{cwd:repositoryRoot,encoding:'utf8',env});
  invariant((rehearsal ? /^\/tmp\/rst002b-launcher-[^/]+\/repository$/.test(repositoryRoot) && /^mjl-test-rst002b-shared-shape-[a-z0-9-]+$/.test(composeProjectName) : repositoryRoot === '/home/yoann/Documents/Projects/mjl-dolibarr-poc') && git(['status','--porcelain=v1','--untracked-files=all']) === '', 'Repository must be an exact clean approved root.');
  const commit = git(['rev-parse','--verify','HEAD']).trim(); const tree = protectedTreeEvidence(repositoryRoot); const composeFile = path.join(repositoryRoot,'docker-compose.yml');
  const compose = ['compose','--env-file','/dev/null','--project-directory',repositoryRoot,'-f',composeFile,'-p',composeProjectName]; const config = execFileSync('/usr/bin/docker',[...compose,'config','--format','json'],{cwd:repositoryRoot,env});
  const containers={}; for (const service of ['dolibarr','mariadb']) { containers[service]=execFileSync('/usr/bin/docker',[...compose,'ps','-a','-q',service],{cwd:repositoryRoot,encoding:'utf8',env}).trim(); invariant(/^[a-f0-9]{64}$/.test(containers[service]),`Shared ${service} container identity is invalid.`); }
  const plugins = JSON.parse(execFileSync('/usr/bin/docker',['info','--format','{{json .ClientInfo.Plugins}}'],{encoding:'utf8',env})) || [];
  const composePlugin = plugins.find((plugin) => plugin && plugin.Name === 'compose' && path.isAbsolute(plugin.Path)); invariant(composePlugin, 'Docker Compose plugin is unavailable.');
  const composePluginPath = fs.realpathSync(composePlugin.Path);
  const key = crypto.randomBytes(32); const operationId = crypto.randomBytes(16).toString('hex'); const nonce = crypto.randomBytes(16).toString('hex');
  const profile={target_profile:rehearsal?'disposable_shared_shape':'shared',repository_root:repositoryRoot,compose_project_name:composeProjectName,database_name:'dolidb',database_root:path.join(repositoryRoot,'data/mariadb'),document_root:path.join(repositoryRoot,'data/documents')};
  const hostNode=rehearsal?(process.env.MJL_RST002B_HOST_NODE||''):process.execPath; invariant(!rehearsal||path.isAbsolute(hostNode),'Rehearsal host Node binding is invalid.');
  const sharedLocks = targetLockPaths(profile); const targetLock = sharedLocks.target; const mutationLock = sharedLocks.mutation; const outputRoot = args['output-root']; const now = new Date();
  const approval = { version:1,unit:'RST-002B',mode:args.mode,operation_id:operationId,approved_commit:commit,complete_tree_sha256:tree.completeTreeSha256,complete_tree_manifest_sha256:tree.manifestSha256,
    ...profile,compose_config_sha256:sha256(config),compose_files:[{path:composeFile,sha256:sha256(fs.readFileSync(composeFile))}],containers,
    backup_root:path.join(outputRoot,'backups'),evidence_root:path.join(outputRoot,'evidence'),backup_key_sha256:sha256(key),nonce,target_lock_path:targetLock,mutation_lock_path:mutationLock,
    issued_at:now.toISOString(),expires_at:new Date(now.getTime()+3600000).toISOString(),images:{mariadb:JSON.parse(execFileSync('/usr/bin/docker',['image','inspect','mariadb:11'],{encoding:'utf8',env}))[0].Id,dolibarr:JSON.parse(execFileSync('/usr/bin/docker',['image','inspect','dolibarr/dolibarr:23.0.2'],{encoding:'utf8',env}))[0].Id} };
  if (rehearsal) { invariant(/^(?:every-(?:forward|rollback)-prefix-and-report|forward-(?:0[1-5]-(?:assignment-table-created|activity-old-guard-dropped|activity-column-cutover|activity-target-guard-created|scope-table-removed)|trigger-0[1-7])|rollback-(?:trigger-0[1-7]|scope-table-restored|activity-target-guard-dropped|activity-column-restored|activity-old-guard-restored|assignment-table-dropped))$/.test(args['failure-point']),'Rehearsal failure point is invalid.'); approval.failure_point=args['failure-point']; }
  if (args.mode === 'rollback') { const report = protectedExistingFile(args['prior-report']); const value=JSON.parse(report.toString('utf8')); const keys=['approved_commit','complete_tree_sha256','mode','operation_id','previous_sha256','status','unit','version'].sort(); invariant(report.toString('utf8')===`${canonicalJson(value)}\n` && Object.keys(value).sort().join('\n')===keys.join('\n') && value.version===1 && value.unit==='RST-002B' && value.mode==='execute' && value.status==='complete' && value.approved_commit===commit && value.complete_tree_sha256===tree.completeTreeSha256,'Prior execution report is invalid.'); approval.prior_execution_report = {path:args['prior-report'],sha256:sha256(report)}; }
  protectedDirectory(outputRoot); for (const name of ['approval','key','traffic','backups','evidence']) protectedDirectory(path.join(outputRoot,name));
  for (const lockPath of [targetLock,mutationLock]) { const descriptor = fs.openSync(lockPath,fs.constants.O_CREAT|fs.constants.O_RDWR|fs.constants.O_NOFOLLOW,0o600); try { fs.fchownSync(descriptor,0,0); fs.fchmodSync(descriptor,0o600); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); } }
  const approvalBytes = Buffer.from(`${canonicalJson(approval)}\n`); protectedFile(path.join(outputRoot,'approval/record'),approvalBytes); protectedFile(path.join(outputRoot,'key/bytes'),key); protectedFile(path.join(outputRoot,'protected-tree-manifest.json'),Buffer.from(`${canonicalJson(tree.manifest)}\n`));
  protectedFile(path.join(outputRoot,'traffic/template'),Buffer.from(`${canonicalJson({version:1,unit:'RST-002B',operation_id:operationId,approval_sha256:sha256(approvalBytes),exclusive_docker_administration:'REPLACE_WITH_TRUE',no_direct_host_writers:'REPLACE_WITH_TRUE',no_direct_database_writers:'REPLACE_WITH_TRUE',stopped_at:'REPLACE',expires_at:'REPLACE_WITHIN_15_MINUTES'})}\n`));
  const invocation = {version:1,unit:'RST-002B',status:rehearsal?'disposable-rehearsal-ready':'awaiting-traffic-stop-and-explicit-approval',mode:args.mode,
    argv:['/usr/bin/flock','--nonblock','--no-fork',targetLock,'/usr/bin/flock','--nonblock','--no-fork',mutationLock,'/opt/node','custom/mjlfinancement/scripts/rst002b_shared_launcher.js',`--mode=${args.mode}`],
    outer_argv:['/usr/bin/docker','run','--rm','--pull=never','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--tmpfs','/tmp:rw,noexec,nosuid,nodev,mode=1777','--tmpfs','/var/www/documents:rw,noexec,nosuid,nodev,mode=0700','--tmpfs','/var/www/html/custom:rw,noexec,nosuid,nodev,mode=0700','--workdir',repositoryRoot,
      '--volume',`${repositoryRoot}:${repositoryRoot}:ro`,'--volume',`${path.join(outputRoot,'approval')}:/run/mjl-rst002b/approval:ro`,'--volume',`${path.join(outputRoot,'key')}:/run/mjl-rst002b/key:ro`,'--volume',`${path.join(outputRoot,'traffic')}:/run/mjl-rst002b/traffic:ro`,
      '--volume',`${approval.backup_root}:${approval.backup_root}`,'--volume',`${approval.evidence_root}:${approval.evidence_root}`,...(args.mode==='rollback'?['--volume',`${args['prior-report']}:${args['prior-report']}:ro`]:[]),'--volume',`${targetLock}:${targetLock}`,'--volume',`${mutationLock}:${mutationLock}`,'--volume','/var/run/docker.sock:/var/run/docker.sock','--volume',`${hostNode}:/opt/node:ro`,'--volume','/usr/bin/git:/usr/bin/git:ro','--volume','/usr/bin/docker:/usr/bin/docker:ro','--volume','/usr/bin/flock:/usr/bin/flock:ro','--volume',`${composePluginPath}:${composePluginPath}:ro`,
      '--entrypoint','/usr/bin/flock',approval.images.dolibarr,'--nonblock','--no-fork',targetLock,'/usr/bin/flock','--nonblock','--no-fork',mutationLock,'/opt/node','custom/mjlfinancement/scripts/rst002b_shared_launcher.js',`--mode=${args.mode}`]};
  protectedFile(path.join(outputRoot,'invocation.json'),Buffer.from(`${canonicalJson(invocation)}\n`));
  key.fill(0); process.stdout.write(`${JSON.stringify({status:'awaiting-traffic-stop-and-explicit-approval',mode:args.mode,output_root:outputRoot,approved_commit:commit,complete_tree_sha256:approval.complete_tree_sha256})}\n`);
}
try { main(); } catch (_) { process.stderr.write('RST-002B packet generation failed closed.\n'); process.exitCode=1; }
