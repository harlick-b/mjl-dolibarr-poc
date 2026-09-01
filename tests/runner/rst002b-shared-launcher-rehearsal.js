#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { atomicRecord, canonicalJson, inspectForwardPrefix, pinnedOneOff, runRst002bOperation, runRst002bRecover, runRst002bRollback } = require('../../custom/mjlfinancement/scripts/rst002b_shared_operation.lib');

const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const emptyEvidence = () => ({
  admin_sha256:'a',documents_sha256:'b',ecm_sha256:'c',module_metadata_sha256:'d',restorable_database_definition_sha256:'e',
  disposable_control_count:0,disposable_file_sentinel_present:false,business_counts:{activities:0,activity_assignments:0},
  restorable_table_sha256:{},restorable_schema_object_sha256:{triggers:'before'},restorable_trigger_sha256:{},
});

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
    process.stdout.write('RST-002B shared launcher recovery/custody rehearsal: OK\n');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
main().catch((error)=>{ process.stderr.write(`${error.message}\n`); process.exitCode=1; });
