#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const sourceRoot = path.resolve(__dirname, '../..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mjl-rst006a-wrapper-'));
const project = path.basename(temporaryRoot).toLowerCase();
const sentinel = crypto.randomBytes(16).toString('hex');
const compose = ['compose', '--env-file', '/dev/null', '--project-directory', temporaryRoot, '-f', path.join(temporaryRoot, 'docker-compose.yml'), '-p', project];
const wrapperTranscripts = [];

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: options.cwd || temporaryRoot, encoding: 'utf8', env: options.env || process.env, input: options.input, stdio: options.stdio || ['pipe','pipe','pipe'] });
  if (result.error || (!options.accept || !options.accept.includes(result.status)) && result.status !== 0) {
    const error = new Error(`${options.label || path.basename(executable)} failed (${result.status}). ${(result.stderr || result.stdout || '').trim()}`);
    error.status = result.status; error.output = `${result.stdout || ''}${result.stderr || ''}`; throw error;
  }
  return result.stdout || '';
}
function dc(args, options) { return run('/usr/bin/docker', [...compose, ...args], options); }
function wrapper(options = {}) {
  try { const output=run(process.execPath, ['custom/mjlfinancement/scripts/rst006a_fast_cutover.js','--confirm=RST-006A-FAST'], { ...options, label: options.label || 'RST-006A wrapper' });wrapperTranscripts.push(output);return output; }
  catch(error){wrapperTranscripts.push(error.output || error.message || '');throw error;}
}
function assert(condition, message) { if (!condition) throw new Error(message); }
async function freePort() { return new Promise((resolve, reject) => { const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close((error)=>error?reject(error):resolve(port));}); }); }
async function ready(port) { const deadline=Date.now()+360000;while(Date.now()<deadline){try{const response=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(2500)});if(response.status<500)return;}catch(_){}await new Promise((resolve)=>setTimeout(resolve,2000));}throw new Error('Wrapper rehearsal tenant did not become ready.'); }
function serviceSet() { return dc(['ps','--status','running','--services']).trim().split('\n').filter(Boolean).sort(); }
async function waitForUnlocked(lock) {
  for(let attempt=0;attempt<100;attempt+=1){const result=spawnSync('/usr/bin/flock',['--nonblock',lock,'/usr/bin/true'],{stdio:'ignore'});if(result.status===0)return;await new Promise((resolve)=>setTimeout(resolve,50));}
  throw new Error('Disposable wrapper lock was not released.');
}
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function activePaths(custody) { return { journal:path.join(custody,'rst006a-active-journal.json'), config:path.join(custody,'.rst006a-active-conf.php') }; }
function completionFiles(custody) { return fs.readdirSync(custody).filter((name)=>/^rst006a-cutover-[a-f0-9]{64}\.json$/.test(name)); }
function filesRecursively(directory) {
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap((entry)=>{const target=path.join(directory,entry.name);return entry.isDirectory()?filesRecursively(target):[target];});
}
function assertNoKnownSecrets(custody) {
  const candidates=[...wrapperTranscripts.map((value)=>Buffer.from(String(value))),...filesRecursively(custody).filter((file)=>fs.lstatSync(file).isFile()).map((file)=>fs.readFileSync(file))];
  for(const secret of ['poc_root_pwd','poc_pwd','Admin1234','MjlPoc2026!!'])assert(!candidates.some((bytes)=>bytes.includes(Buffer.from(secret))),`Wrapper output or custody artifact exposed known secret ${secret}.`);
}
async function resetToPredecessor(custody, port) {
  const prep=path.join(custody,'predecessor-conf.php');
  dc(['cp','dolibarr:/var/www/html/conf/conf.php',prep]);fs.chmodSync(prep,0o600);
  dc(['stop','dolibarr']);
  dc(['run','--rm','--no-deps','--entrypoint','/bin/sh','dolibarr','-ceu','target=/var/www/documents/.mjl-disposable-fixture-sentinel; printf %s "$MJL_DISPOSABLE_RUN_SENTINEL" > "$target"; chown root:root "$target"; chmod 0444 "$target"']);
  dc(['run','--rm','--no-deps','--volume',`${prep}:/var/www/html/conf/conf.php:ro`,'-e','MJL_RST006A_TRAFFIC_STOPPED=1','-e','MJL_DISPOSABLE_TEST_TENANT=1','-e',`MJL_DISPOSABLE_PROJECT_NAME=${project}`,'-e',`MJL_DISPOSABLE_RUN_SENTINEL=${sentinel}`,'--entrypoint','/usr/local/bin/php','dolibarr','/var/www/html/custom/mjlfinancement/scripts/rst006a_activity_planning.php','--mode=rollback','--confirm=RST-006A']);
  fs.unlinkSync(prep);dc(['start','dolibarr']);await ready(port);
}
function writeActiveJournal(custody, completion, backupPath, expectedBackupSha, configPath) {
  const value = {
    version:1,unit:'RST-006A',kind:'active',source_commit:completion.source_commit,
    predecessor_schema_sha256:completion.predecessor_schema_sha256,
    empty_evidence_sha256:completion.empty_evidence_sha256,backup_path:backupPath,
    backup_sha256:expectedBackupSha,config_sha256:sha256(configPath),
    detected_ddl_prefix:'forward-043',updated_at:new Date().toISOString(),
  };
  const journal=activePaths(custody).journal;fs.writeFileSync(journal,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});fs.chmodSync(journal,0o600);
}

async function main() {
  const port = await freePort();
  fs.cpSync(path.join(sourceRoot, 'custom'), path.join(temporaryRoot, 'custom'), { recursive: true });
  let composeSource = fs.readFileSync(path.join(sourceRoot, 'docker-compose.yml'), 'utf8');
  composeSource = composeSource.replace('      - "8080:80"', `      - "127.0.0.1:${port}:80"`);
  composeSource = composeSource.replace('      DOLI_DB_PASSWORD: poc_pwd', `      DOLI_DB_PASSWORD: poc_pwd\n      MJL_DISPOSABLE_TEST_TENANT: "1"\n      MJL_DISPOSABLE_PROJECT_NAME: ${project}\n      MJL_DISPOSABLE_RUN_SENTINEL: ${sentinel}`);
  fs.writeFileSync(path.join(temporaryRoot, 'docker-compose.yml'), composeSource);
  fs.mkdirSync(path.join(temporaryRoot, 'data/documents'), { recursive: true });
  run('/usr/bin/git',['init','--quiet']);run('/usr/bin/git',['config','user.email','rst006a-wrapper@example.test']);run('/usr/bin/git',['config','user.name','RST-006A Wrapper Rehearsal']);run('/usr/bin/git',['add','docker-compose.yml','custom']);run('/usr/bin/git',['commit','--quiet','-m','RST-006A wrapper rehearsal snapshot']);
  dc(['up','-d']); await ready(port);
  dc(['exec','-T','dolibarr','php','/var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php']);
  dc(['exec','-T','mariadb','sh','-ceu','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -uroot "$MYSQL_DATABASE"'], { input:`INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES('MJL_DISPOSABLE_FIXTURE_SENTINEL','${sentinel}','chaine',0,'RST-006A wrapper rehearsal',0);\n` });
  dc(['exec','-T','dolibarr','sh','-ceu','target=/var/www/documents/.mjl-disposable-fixture-sentinel; printf %s "$MJL_DISPOSABLE_RUN_SENTINEL" > "$target"; chown root:root "$target"; chmod 0444 "$target"']);
  const custody=path.join(temporaryRoot,'data/backups/rst006a');fs.mkdirSync(custody,{recursive:true,mode:0o700});fs.chmodSync(custody,0o700);
  await resetToPredecessor(custody,port);
  const output=wrapper();assert(output.includes('RST-006A cutover complete.'),'Wrapper did not report completion.');
  assert(JSON.stringify(serviceSet())===JSON.stringify(['dolibarr','mariadb']),'Wrapper did not restore both services.');
  assert(completionFiles(custody).length===1,'Wrapper did not seal exactly one completion record.');
  const active=activePaths(custody);
  assert(!fs.existsSync(active.journal)&&!fs.existsSync(active.config),'Wrapper left active attempt state after success.');

  fs.appendFileSync(path.join(temporaryRoot,'custom/mjlfinancement/scripts/rst006a_fast_cutover.js'),'\n');
  let refused=false;try{wrapper();}catch(error){refused=/tracked source changes/.test(error.output); }assert(refused,'Wrapper did not refuse tracked source drift.');
  run('/usr/bin/git',['checkout','--','custom/mjlfinancement/scripts/rst006a_fast_cutover.js']);

  fs.writeFileSync(active.journal,'not-json\n',{mode:0o600});fs.chmodSync(active.journal,0o600);
  refused=false;try{wrapper();}catch(error){refused=/journal is malformed/.test(error.output);}assert(refused,'Wrapper did not refuse a malformed journal.');fs.unlinkSync(active.journal);

  const lock=path.join(custody,'.rst006a-cutover.lock');
  const holder=spawn('/usr/bin/flock',['--nonblock',lock,'/usr/bin/sleep','20'],{stdio:'ignore',detached:true});await new Promise((resolve)=>setTimeout(resolve,100));
  try{refused=false;try{wrapper();}catch(error){refused=/owns the process lock/.test(error.output);}assert(refused,'Wrapper lock allowed a contender.');}finally{try{process.kill(-holder.pid,'SIGKILL');}catch(_){}await waitForUnlocked(lock);}

  for (const point of ['pre-apply','partial-ddl','target-before-restart','restart-before-evidence']) {
    await resetToPredecessor(custody,port);
    const before=completionFiles(custody).length;
    let interrupted=false;
    try{wrapper({env:{...process.env,MJL_RST006A_REHEARSAL_INTERRUPT:point}});}catch(error){interrupted=error.status!==0;}
    assert(interrupted,`Wrapper did not interrupt at ${point}.`);
    await waitForUnlocked(lock);
    if(point==='partial-ddl'){
      const journalBytes=fs.readFileSync(active.journal);fs.unlinkSync(active.journal);
      refused=false;try{wrapper();}catch(error){refused=/unjournaled non-predecessor schema[\s\S]*remains stopped/i.test(error.output);}
      assert(refused,'Wrapper did not refuse a known partial schema whose active journal was missing.');
      assert(JSON.stringify(serviceSet())===JSON.stringify(['mariadb']),'Missing-journal partial schema did not remain stopped.');
      fs.writeFileSync(active.journal,journalBytes,{mode:0o600});fs.chmodSync(active.journal,0o600);
    }
    const resumed=wrapper();assert(resumed.includes('RST-006A cutover complete.'),`Wrapper did not resume ${point}.`);
    assert(JSON.stringify(serviceSet())===JSON.stringify(['dolibarr','mariadb']),`Wrapper did not restore services after ${point}.`);
    assert(completionFiles(custody).length===before+1,`Wrapper did not seal one completion record after ${point}.`);
    assert(!fs.existsSync(active.journal)&&!fs.existsSync(active.config),`Wrapper left active state after ${point}.`);
  }

  const completionName=completionFiles(custody).sort().at(-1);
  const completion=JSON.parse(fs.readFileSync(path.join(custody,completionName),'utf8'));
  dc(['cp','dolibarr:/var/www/html/conf/conf.php',active.config]);fs.chmodSync(active.config,0o600);
  const missingBackup=path.join(custody,'rst006a-before-2099-01-01T00-00-00-000Z.sql');
  writeActiveJournal(custody,completion,missingBackup,'0'.repeat(64),active.config);
  refused=false;try{wrapper();}catch(error){refused=/ENOENT|no such file/i.test(error.output);}assert(refused,'Wrapper did not refuse a missing journal backup.');
  if(fs.existsSync(active.journal))fs.unlinkSync(active.journal);if(fs.existsSync(active.config))fs.unlinkSync(active.config);

  dc(['cp','dolibarr:/var/www/html/conf/conf.php',active.config]);fs.chmodSync(active.config,0o600);
  const corruptBackup=path.join(custody,'rst006a-before-2099-01-02T00-00-00-000Z.sql');
  fs.copyFileSync(completion.backup_path,corruptBackup);fs.chmodSync(corruptBackup,0o600);const expectedBackupSha=sha256(corruptBackup);fs.appendFileSync(corruptBackup,'corrupt');
  writeActiveJournal(custody,completion,corruptBackup,expectedBackupSha,active.config);
  refused=false;try{wrapper();}catch(error){refused=/checksum is corrupt/.test(error.output);}assert(refused,'Wrapper did not refuse a corrupt journal backup.');
  if(fs.existsSync(active.journal))fs.unlinkSync(active.journal);if(fs.existsSync(active.config))fs.unlinkSync(active.config);fs.unlinkSync(corruptBackup);

  await resetToPredecessor(custody,port);
  dc(['exec','-T','mariadb','sh','-ceu','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -uroot "$MYSQL_DATABASE" -e "ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_rst006a_rehearsal_unknown (entity)"']);
  refused=false;try{wrapper();}catch(error){refused=/remains stopped/.test(error.output);}assert(refused,'Wrapper did not contain an unknown schema state.');
  assert(JSON.stringify(serviceSet())===JSON.stringify(['mariadb']),'Unknown schema state did not remain stopped.');
  dc(['exec','-T','mariadb','sh','-ceu','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mariadb -uroot "$MYSQL_DATABASE" -e "ALTER TABLE llx_mjlfinancement_activity DROP INDEX idx_rst006a_rehearsal_unknown"']);
  if(fs.existsSync(active.config))fs.unlinkSync(active.config);dc(['start','dolibarr']);await ready(port);
  assertNoKnownSecrets(custody);
  process.stdout.write('RST-006A fast-wrapper shared-shaped rehearsal passed.\n');
}

let failure;
main().catch((error)=>{failure=error;process.stderr.write(`${error.stack || error.message}\n`);process.exitCode=1;}).finally(()=>{
  try{dc(['stop'],{accept:[0,1]});}catch(_){}
  try{dc(['run','--rm','--no-deps','--entrypoint','/bin/chmod','dolibarr','-R','0777','/var/www/documents'],{accept:[0,1]});}catch(_){}
  try{dc(['run','--rm','--no-deps','--entrypoint','/bin/chmod','mariadb','-R','0777','/var/lib/mysql'],{accept:[0,1]});}catch(_){}
  try{dc(['down','--volumes','--remove-orphans'],{accept:[0,1]});}catch(error){if(!failure){process.stderr.write(`${error.message}\n`);process.exitCode=1;}}
  fs.rmSync(temporaryRoot,{recursive:true,force:true});
});
