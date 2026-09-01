#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { atomicRecord, canonicalJson, inspectForwardPrefix, pinnedOneOff, runRst002bOperation, runRst002bRecover, runRst002bRollback } = require('../../custom/mjlfinancement/scripts/rst002b_shared_operation.lib');
const { isolatedRestoreNames } = require('../../custom/mjlfinancement/scripts/rst005_shared_operation.lib');

const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const emptyEvidence = () => ({
  admin_sha256:'a',documents_sha256:'b',ecm_sha256:'c',module_metadata_sha256:'d',restorable_database_definition_sha256:'e',
  disposable_control_count:0,disposable_file_sentinel_present:false,business_counts:{activities:0,activity_assignments:0},
  restorable_table_sha256:{},restorable_schema_object_sha256:{triggers:'before'},restorable_trigger_sha256:{},
});

function run(command,args,options={}) { return execFileSync(command,args,{cwd:options.cwd,env:options.env||process.env,encoding:options.binary?null:'utf8',input:options.input,stdio:options.capture===false?'inherit':['pipe','pipe','pipe']}); }
function dockerRead(file) { return run('/usr/bin/docker',['run','--rm','--pull=never','--volume',`${file}:${file}:ro`,'--entrypoint','/bin/cat','dolibarr/dolibarr:23.0.2',file],{binary:true}); }
function writeProtected(file,bytes) {
  const temporary=path.join(os.tmpdir(),`rst002b-input-${crypto.randomBytes(8).toString('hex')}`); fs.writeFileSync(temporary,bytes,{mode:0o600});
  try { run('/usr/bin/docker',['run','--rm','--pull=never','--volume',`${temporary}:/source:ro`,'--volume',`${path.dirname(file)}:/target`,'--entrypoint','/bin/sh','dolibarr/dolibarr:23.0.2','-ceu',`cp /source /target/${path.basename(file)}.new; chown 0:0 /target/${path.basename(file)}.new; chmod 0400 /target/${path.basename(file)}.new; mv /target/${path.basename(file)}.new /target/${path.basename(file)}`]); }
  finally { fs.rmSync(temporary,{force:true}); }
}
function exactInvocation(outputRoot) { return JSON.parse(dockerRead(path.join(outputRoot,'invocation.json')).toString('utf8')).outer_argv; }
function writeTraffic(outputRoot,approvalBytes,approval,valid=true) {
  const now=new Date(); const record={version:1,unit:'RST-002B',operation_id:approval.operation_id,approval_sha256:valid?digest(approvalBytes):'0'.repeat(64),exclusive_docker_administration:true,no_direct_host_writers:true,no_direct_database_writers:true,stopped_at:now.toISOString(),expires_at:new Date(now.getTime()+15*60*1000).toISOString()};
  writeProtected(path.join(outputRoot,'traffic/record'),Buffer.from(`${canonicalJson(record)}\n`));
}
function invoke(argv,mode) { const actual=[...argv]; actual[actual.length-1]=`--mode=${mode}`; return run(actual[0],actual.slice(1),{binary:true}); }
function assertNoOneOffSurvivors(approvals) {
  for(const approval of approvals) {
    const restore=isolatedRestoreNames(approval.nonce);
    for(const name of [`mjl-rst002b-evidence-${approval.nonce}`,`mjl-rst002b-migration-${approval.nonce}`,restore.databaseContainer,restore.evidenceContainer]) assert.equal(run('/usr/bin/docker',['ps','-aq','--filter',`name=^/${name}$`]).trim(),'');
    assert.equal(run('/usr/bin/docker',['network','ls','-q','--filter',`name=^${restore.network}$`]).trim(),'');
    for(const volume of [restore.databaseVolume,restore.documentVolume]) assert.equal(run('/usr/bin/docker',['volume','ls','-q','--filter',`name=^${volume}$`]).trim(),'');
  }
}
function copySnapshot(destination,port) {
  for(const relative of ['custom','docs','tests','.gitignore','AGENTS.md','CONTEXT.md','DESIGN.md','README.md','docker-compose.yml','package.json','package-lock.json','playwright.config.js']) fs.cpSync(path.resolve(__dirname,'../..',relative),path.join(destination,relative),{recursive:true,preserveTimestamps:true});
  const compose=path.join(destination,'docker-compose.yml'); fs.writeFileSync(compose,fs.readFileSync(compose,'utf8').replace('"8080:80"',`"127.0.0.1:${port}:80"`));
  run('/usr/bin/git',['init','-q'],{cwd:destination}); run('/usr/bin/git',['config','user.email','rst002b-launcher@example.test'],{cwd:destination}); run('/usr/bin/git',['config','user.name','RST-002B Launcher Rehearsal'],{cwd:destination}); run('/usr/bin/git',['add','.'],{cwd:destination}); run('/usr/bin/git',['commit','-qm','sealed RST-002B launcher rehearsal'],{cwd:destination});
}
async function freePort() { return new Promise((resolve,reject)=>{ const server=require('node:net').createServer(); server.once('error',reject); server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close((error)=>error?reject(error):resolve(port));}); }); }
async function runRealLauncherScenario() {
  const runRoot=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-launcher-')); const repository=path.join(runRoot,'repository'); fs.mkdirSync(repository); const port=await freePort(); copySnapshot(repository,port);
  const nonce=crypto.randomBytes(4).toString('hex'); const project=`mjl-test-rst002b-shared-shape-${nonce}`; const compose=['compose','--env-file','/dev/null','--project-directory',repository,'-f',path.join(repository,'docker-compose.yml'),'-p',project]; const env={...process.env,COMPOSE_PROJECT_NAME:project};
  const executeRoot=path.join(os.tmpdir(),`mjl-rst002b-execute-${nonce}`); const rollbackRoot=path.join(os.tmpdir(),`mjl-rst002b-rollback-${nonce}`); const operatorNames=[]; let approval; let secret;
  const dc=(tail,options={})=>run('/usr/bin/docker',[...compose,...tail],{cwd:repository,env,input:options.input,binary:options.binary});
  try {
    fs.mkdirSync(path.join(repository,'data/mariadb'),{recursive:true}); fs.mkdirSync(path.join(repository,'data/documents'),{recursive:true}); dc(['up','-d']);
    let ready=false; for(let attempt=0;attempt<120;attempt+=1){ try { if(dc(['exec','-T','mariadb','sh','-ceu','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mariadb -N -s -uroot "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM llx_user WHERE rowid=1 AND login=\'admin\' AND admin=1"']).trim()==='1'){ready=true;break;} } catch(_){} await new Promise((resolve)=>setTimeout(resolve,2000)); }
    assert.ok(ready,'shared-shaped tenant did not install'); dc(['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php']);
    const sentinel=crypto.randomBytes(16).toString('hex'); dc(['exec','-T','-e','MJL_DISPOSABLE_TEST_TENANT=1','-e',`MJL_DISPOSABLE_PROJECT_NAME=${project}`,'-e',`MJL_DISPOSABLE_RUN_SENTINEL=${sentinel}`,'dolibarr','sh','-ceu',`printf %s '${sentinel}' > /var/www/documents/.mjl-disposable-fixture-sentinel; php /var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php --mode=rollback --confirm=RST-002B; rm /var/www/documents/.mjl-disposable-fixture-sentinel`]);
    dc(['stop','dolibarr']);
    const plugin=JSON.parse(run('/usr/bin/docker',['info','--format','{{json .ClientInfo.Plugins}}'])).find((entry)=>entry&&entry.Name==='compose').Path; const hostNode=process.execPath;
    const packet=(mode,output,prior,failure)=>{
      const args=['run','--rm','--pull=never','--volume','/tmp:/tmp','--volume','/var/run/docker.sock:/var/run/docker.sock','--volume',`${hostNode}:/opt/node:ro`,'--volume','/usr/bin/git:/usr/bin/git:ro','--volume','/usr/bin/docker:/usr/bin/docker:ro','--volume','/usr/bin/flock:/usr/bin/flock:ro','--volume',`${plugin}:${plugin}:ro`,'--workdir',repository,'--env',`COMPOSE_PROJECT_NAME=${project}`,'--env',`MJL_RST002B_HOST_NODE=${hostNode}`,'--entrypoint','/opt/node','dolibarr/dolibarr:23.0.2','custom/mjlfinancement/scripts/rst002b_shared_packet.js',`--mode=${mode}`,`--output-root=${output}`,'--profile=disposable-shared-shape'];
      if(prior) args.push(`--prior-report=${prior}`); if(failure) args.push(`--failure-point=${failure}`); run('/usr/bin/docker',args,{cwd:repository,env});
    };
    packet('execute',executeRoot,null,'forward-trigger-04'); const approvalBytes=dockerRead(path.join(executeRoot,'approval/record')); approval=JSON.parse(approvalBytes.toString('utf8')); secret=dockerRead(path.join(executeRoot,'key/bytes')); const invocation=exactInvocation(executeRoot);
    writeTraffic(executeRoot,approvalBytes,approval,false); assert.throws(()=>invoke(invocation,'execute'));
    writeTraffic(executeRoot,approvalBytes,approval,true);
    writeProtected(path.join(executeRoot,'key/bytes'),Buffer.alloc(32,9)); assert.throws(()=>invoke(invocation,'execute')); writeProtected(path.join(executeRoot,'key/bytes'),secret);
    const substitutedApproval={...approval,operation_id:'0'.repeat(32)}; writeProtected(path.join(executeRoot,'approval/record'),Buffer.from(`${canonicalJson(substitutedApproval)}\n`)); assert.throws(()=>invoke(invocation,'execute')); writeProtected(path.join(executeRoot,'approval/record'),approvalBytes);
    const holder=`${project}-lock-holder`; operatorNames.push(holder); run('/usr/bin/docker',['run','-d','--name',holder,'--rm','--volume',`${approval.target_lock_path}:${approval.target_lock_path}`,'--entrypoint','/usr/bin/flock','dolibarr/dolibarr:23.0.2','--exclusive',approval.target_lock_path,'/bin/sleep','30']); assert.throws(()=>invoke(invocation,'execute')); run('/usr/bin/docker',['rm','-f',holder]);
    assert.throws(()=>invoke(invocation,'execute')); writeTraffic(executeRoot,approvalBytes,approval,true); const recovered=invoke(invocation,'recover'); assert.match(recovered.toString('utf8'),/"status":"complete"/); assert.ok(!recovered.includes(secret));
    const prior=path.join(executeRoot,'evidence/rst002b-launcher-report.json'); dc(['stop','dolibarr']); packet('rollback',rollbackRoot,prior,'rollback-trigger-04'); const rollbackApprovalBytes=dockerRead(path.join(rollbackRoot,'approval/record')); const rollbackApproval=JSON.parse(rollbackApprovalBytes.toString('utf8')); writeTraffic(rollbackRoot,rollbackApprovalBytes,rollbackApproval,true); const rollbackInvocation=exactInvocation(rollbackRoot); assert.throws(()=>invoke(rollbackInvocation,'rollback')); writeTraffic(rollbackRoot,rollbackApprovalBytes,rollbackApproval,true); assert.match(invoke(rollbackInvocation,'rollback').toString('utf8'),/"status":"complete"/);
    assertNoOneOffSurvivors([approval,rollbackApproval]);
  } finally {
    for(const name of operatorNames) try{run('/usr/bin/docker',['rm','-f',name]);}catch(_){} try{dc(['down','-v','--remove-orphans']);}catch(_){}
    for(const root of [executeRoot,rollbackRoot,runRoot]) if(fs.existsSync(root)) run('/usr/bin/docker',['run','--rm','--pull=never','--volume',`${root}:${root}`,'--entrypoint','/bin/sh','dolibarr/dolibarr:23.0.2','-ceu',`chown -R ${process.getuid()}:${process.getgid()} '${root}'`]);
    for(const root of [executeRoot,rollbackRoot,runRoot]) fs.rmSync(root,{recursive:true,force:true});
    if(approval) for(const lock of [approval.target_lock_path,approval.mutation_lock_path]) if(fs.existsSync(lock)){run('/usr/bin/docker',['run','--rm','--volume',`${lock}:${lock}`,'--entrypoint','/bin/chown','dolibarr/dolibarr:23.0.2',`${process.getuid()}:${process.getgid()}`,lock]);fs.rmSync(lock,{force:true});}
  }
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-launcher-'));
  try {
    fs.chmodSync(root,0o700);
    const custody={requiredUid:process.getuid()};
    const approval = { operation_id:'a'.repeat(32), approved_commit:'b'.repeat(40), complete_tree_sha256:'c'.repeat(64) };
    assert.equal(inspectForwardPrefix(root,approval,custody),0);
    const intent=atomicRecord(root,'rst002b-00-intent.json',{version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:null,state:'backup-authorized'},custody); assert.equal(inspectForwardPrefix(root,approval,custody),1);
    const beforeValue={version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:intent,before:{},backups:{}};
    const before=atomicRecord(root,'rst002b-01-before.json',beforeValue,custody); assert.equal(inspectForwardPrefix(root,approval,custody),2);
    const checkpointValue={version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:before,state:'mutation-authorized'};
    const checkpoint=atomicRecord(root,'rst002b-02-checkpoint.json',checkpointValue,custody); assert.equal(inspectForwardPrefix(root,approval,custody),3);
    const after=atomicRecord(root,'rst002b-03-after.json',{version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:checkpoint,after:{}},custody); assert.equal(inspectForwardPrefix(root,approval,custody),4);
    atomicRecord(root,'rst002b-launcher-report.json',{version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:after,status:'complete',approved_commit:approval.approved_commit,complete_tree_sha256:approval.complete_tree_sha256},custody);
    assert.equal(inspectForwardPrefix(root,approval,custody),5);
    assert.equal(fs.statSync(path.join(root,'rst002b-00-intent.json')).mode&0o777,0o400);
    assert.throws(()=>atomicRecord(root,'rst002b-00-intent.json',{replaced:true},custody));
    assert.equal(canonicalJson({b:2,a:1}),'{"a":1,"b":2}');

    const gap=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-gap-')); fs.chmodSync(gap,0o700); atomicRecord(gap,'rst002b-02-checkpoint.json',checkpointValue,custody); assert.throws(()=>inspectForwardPrefix(gap,approval,custody),/gap/); fs.rmSync(gap,{recursive:true,force:true});
    const substitution=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-substitution-')); fs.chmodSync(substitution,0o700); atomicRecord(substitution,'rst002b-00-intent.json',{version:1,unit:'RST-002B',operation_id:'d'.repeat(32),mode:'execute',previous_sha256:null,state:'backup-authorized'},custody); assert.throws(()=>inspectForwardPrefix(substitution,approval,custody),/chain/); fs.rmSync(substitution,{recursive:true,force:true});
    const unexpected=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-unexpected-')); fs.writeFileSync(path.join(unexpected,'rst002b-evil.json'),'{}\n',{mode:0o600}); assert.throws(()=>inspectForwardPrefix(unexpected,approval),/unexpected/); fs.rmSync(unexpected,{recursive:true,force:true});

    const operation=fs.readFileSync(path.resolve(__dirname,'../../custom/mjlfinancement/scripts/rst002b_shared_operation.lib.js'),'utf8');
    const runner=fs.readFileSync(path.resolve(__dirname,'run-suite.js'),'utf8');
    for (const seam of ['verifyRetainedBackups','cleanupNamedContainers','startAndHealthCheck','rst002b-00-intent.json']) assert.match(operation,new RegExp(seam));
    for (const prefix of ['forward-01-assignment-table-created','forward-04-activity-target-guard-created','forward-trigger-','rollback-assignment-table-dropped']) assert.match(runner,new RegExp(prefix));
    assert.match(runner,/length:7/);
    assert.doesNotMatch(operation,/console\.(?:log|error).*key|process\.stdout.*key/);
    const operationRoot=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-operation-')); fs.chmodSync(operationRoot,0o700);
    const backupRoot=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-backups-')); fs.chmodSync(backupRoot,0o700);
    let serviceState='stopped'; let migrationAttempts=0; let retainedBackupChecks=0; const bindingStates=[];
    const operationApproval={operation_id:'1'.repeat(32),approved_commit:'2'.repeat(40),complete_tree_sha256:'3'.repeat(64),evidence_root:operationRoot,backup_root:backupRoot,nonce:'4'.repeat(32)};
    const hooks={
      evidence:async()=>emptyEvidence(),
      createAndVerifyBackups:async()=>({paths:{schema:path.join(backupRoot,'schema'),full:path.join(backupRoot,'full')},schema:{plaintextSha256:'5'.repeat(64)},full:{plaintextSha256:'6'.repeat(64)},restored:{status:'verified'}}),
      verifyRetainedBackups:async()=>{retainedBackupChecks+=1;},
      requireStoppedServices:async()=>assert.equal(serviceState,'stopped'),
      migration:async(_approval,mode)=>{assert.equal(mode,'apply'); migrationAttempts+=1; if(migrationAttempts===1) throw new Error('injected migration interruption');},
      runningServices:async()=>serviceState==='stopped'?['mariadb']:['dolibarr','mariadb'],
      startAndHealthCheck:async()=>{serviceState='running';},
    };
    const operationOptions={approval:operationApproval,key:Buffer.alloc(32,7),recordOptions:custody,testHooks:hooks,assertLiveBinding:async(state)=>bindingStates.push(state)};
    await assert.rejects(runRst002bOperation(operationOptions),/injected migration interruption/);
    assert.equal(inspectForwardPrefix(operationRoot,operationApproval,custody),3);
    assert.equal((await runRst002bRecover(operationOptions)).status,'complete');
    assert.equal(inspectForwardPrefix(operationRoot,operationApproval,custody),5);
    assert.equal(retainedBackupChecks,1); assert.deepEqual(bindingStates.slice(-3),['stopped','stopped','running']);
    const executionReport=path.join(operationRoot,'rst002b-launcher-report.json');
    const rollbackRoot=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-rollback-')); fs.chmodSync(rollbackRoot,0o700); serviceState='stopped';
    const rollbackApproval={...operationApproval,operation_id:'8'.repeat(32),evidence_root:rollbackRoot,prior_execution_report:{path:executionReport,sha256:digest(fs.readFileSync(executionReport))}};
    const rollbackHooks={...hooks,migration:async(_approval,mode)=>assert.equal(mode,'rollback')};
    assert.equal((await runRst002bRollback({...operationOptions,approval:rollbackApproval,testHooks:rollbackHooks})).status,'complete');
    assert.ok(fs.existsSync(path.join(rollbackRoot,'rst002b-rollback-report.json')));
    fs.rmSync(operationRoot,{recursive:true,force:true}); fs.rmSync(backupRoot,{recursive:true,force:true}); fs.rmSync(rollbackRoot,{recursive:true,force:true});
    const nonce=crypto.randomBytes(16).toString('hex'); const project=`mjl-test-rst002b-${nonce}`; const network=`${project}_default`; const container=`mjl-rst002b-evidence-${nonce}`; const secret='rst002b-secret-canary'; const secretFile=path.join(root,'secret'); fs.writeFileSync(secretFile,secret,{mode:0o400});
    const dockerEnv={HOME:process.env.HOME||os.homedir(),PATH:'/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',DOCKER_HOST:'unix:///var/run/docker.sock',LANG:'C.UTF-8',LC_ALL:'C.UTF-8'};
    let networkCreated=false;
    try {
      execFileSync('/usr/bin/docker',['network','create','--internal',network],{env:dockerEnv,stdio:'ignore'});
      networkCreated=true;
      const image=JSON.parse(execFileSync('/usr/bin/docker',['image','inspect','dolibarr/dolibarr:23.0.2'],{encoding:'utf8',env:dockerEnv}))[0].Id;
      const output=await pinnedOneOff({compose_project_name:project,images:{dolibarr:image}},container,{kind:'evidence',mounts:[{source:secretFile,target:'/opt/probe-secret',readOnly:true}],command:['-r','fwrite(STDOUT,"PINNED_OK\\n");']},{env:dockerEnv});
      assert.equal(output.toString('utf8'),'PINNED_OK\n'); assert.doesNotMatch(output.toString('utf8'),new RegExp(secret));
      assert.equal(execFileSync('/usr/bin/docker',['ps','-aq','--filter',`name=^/${container}$`],{encoding:'utf8',env:dockerEnv}).trim(),'');
    } finally {
      try { execFileSync('/usr/bin/docker',['rm','-f',container],{env:dockerEnv,stdio:'ignore'}); } catch (_) {}
      if (networkCreated) execFileSync('/usr/bin/docker',['network','rm',network],{env:dockerEnv,stdio:'ignore'});
    assert.equal(execFileSync('/usr/bin/docker',['network','ls','-q','--filter',`name=^${network}$`],{encoding:'utf8',env:dockerEnv}).trim(),'');
    }
    await runRealLauncherScenario();
    process.stdout.write('RST-002B shared launcher recovery/custody rehearsal: OK\n');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
main().catch((error)=>{ process.stderr.write(`${error.message}\n`); process.exitCode=1; });
