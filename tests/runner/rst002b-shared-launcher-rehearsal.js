#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { atomicRecord, canonicalJson, inspectForwardPrefix, pinnedOneOff } = require('../../custom/mjlfinancement/scripts/rst002b_shared_operation.lib');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-launcher-'));
  try {
    fs.chmodSync(root,0o700);
    const custody={requiredUid:process.getuid()};
    const approval = { operation_id:'a'.repeat(32), approved_commit:'b'.repeat(40), complete_tree_sha256:'c'.repeat(64) };
    assert.equal(inspectForwardPrefix(root,approval,custody),0);
    const beforeValue={version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:null,before:{},backups:{}};
    const before=atomicRecord(root,'rst002b-00-before.json',beforeValue,custody); assert.equal(inspectForwardPrefix(root,approval,custody),1);
    const checkpointValue={version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:before,state:'mutation-authorized'};
    const checkpoint=atomicRecord(root,'rst002b-01-checkpoint.json',checkpointValue,custody); assert.equal(inspectForwardPrefix(root,approval,custody),2);
    const after=atomicRecord(root,'rst002b-02-after.json',{version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:checkpoint,after:{}},custody); assert.equal(inspectForwardPrefix(root,approval,custody),3);
    atomicRecord(root,'rst002b-launcher-report.json',{version:1,unit:'RST-002B',operation_id:approval.operation_id,mode:'execute',previous_sha256:after,status:'complete',approved_commit:approval.approved_commit,complete_tree_sha256:approval.complete_tree_sha256},custody); assert.equal(inspectForwardPrefix(root,approval,custody),4);
    assert.equal(fs.statSync(path.join(root,'rst002b-00-before.json')).mode&0o777,0o400);
    assert.throws(()=>atomicRecord(root,'rst002b-00-before.json',{replaced:true},custody));
    assert.equal(canonicalJson({b:2,a:1}),'{"a":1,"b":2}');

    const gap=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-gap-')); fs.chmodSync(gap,0o700); atomicRecord(gap,'rst002b-01-checkpoint.json',checkpointValue,custody); assert.throws(()=>inspectForwardPrefix(gap,approval,custody),/gap/); fs.rmSync(gap,{recursive:true,force:true});
    const substitution=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-substitution-')); fs.chmodSync(substitution,0o700); atomicRecord(substitution,'rst002b-00-before.json',{...beforeValue,operation_id:'d'.repeat(32)},custody); assert.throws(()=>inspectForwardPrefix(substitution,approval,custody),/chain/); fs.rmSync(substitution,{recursive:true,force:true});
    const unexpected=fs.mkdtempSync(path.join(os.tmpdir(),'rst002b-unexpected-')); fs.writeFileSync(path.join(unexpected,'rst002b-evil.json'),'{}\n',{mode:0o600}); assert.throws(()=>inspectForwardPrefix(unexpected,approval),/unexpected/); fs.rmSync(unexpected,{recursive:true,force:true});

    const operation=fs.readFileSync(path.resolve(__dirname,'../../custom/mjlfinancement/scripts/rst002b_shared_operation.lib.js'),'utf8');
    const runner=fs.readFileSync(path.resolve(__dirname,'run-suite.js'),'utf8');
    for (const seam of ['verifyRetainedBackups','cleanupNamedContainers','startAndHealthCheck','rst002b-01-checkpoint.json']) assert.match(operation,new RegExp(seam));
    for (const prefix of ['assignment-table-created','activity-guard-cutover','scope-table-removed']) assert.match(runner,new RegExp(prefix));
    assert.doesNotMatch(operation,/console\.(?:log|error).*key|process\.stdout.*key/);
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
