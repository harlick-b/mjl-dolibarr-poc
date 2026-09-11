const {test,expect}=require('@playwright/test');
const cp=require('node:child_process');
const {createPhase3AFixtureSet,phase3ACommand}=require('../helpers/phase3a-fixture');
const {createPhase2FixtureSet}=require('../helpers/phase2-fixture');
const {privilegedScalar}=require('../helpers/mjl-test-runtime');
let fixture,drafts;
test.describe.configure({mode:'serial'});
// Opt-in negative control: prove the real public runners discover this Phase 3B suite.
// Global setup still requires the guarded disposable environment before this hook runs.
test.beforeAll(()=>{
 if(process.env.MJL_PHASE3B_DISCOVERY_FAILURE==='1') throw new Error('MJL_PHASE3B_DISCOVERY_CONTROL: deliberate Phase 3B test failure');
});
const php=['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php'];
const database=['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','-N','-B','dolidb'];
function sql(statement){return cp.execFileSync('docker',database,{env:process.env,input:statement+'\n',encoding:'utf8'}).trim();}
function evidence(){return sql("SELECT (SELECT COUNT(*) FROM llx_mjlfinancement_export_record),(SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='EXPORT_GENERATED')").split('\t').map(Number);}
function request(mode='normal',set=fixture,key='owned'){return {actorId:set.users.agent.id,activityId:set.activities[key].activity_id,mode};}
function command(action,input){return JSON.parse(cp.execFileSync('docker',[...php,action],{env:process.env,input:JSON.stringify(input)+'\n',encoding:'utf8',timeout:45000}));}
function clean(){expect(command('spool-state',request())).toEqual([]);}
function success(result){
 expect(result.spool_descriptors).toBe(0);expect(result.lock_released).toBe(true);expect(result.code).toBe('SUCCESS');expect(result.transaction_opened).toBe(0);expect(result.budgets_restored).toBe(true);expect(result.final_commits).toBe(1);
 expect(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_export_record r JOIN llx_mjlfinancement_audit_event a ON a.rowid=r.fk_audit_event AND a.entity=r.entity AND a.object_ref=r.ref WHERE r.ref='${result.ref}' AND r.content_sha256='${result.sha256}' AND r.byte_count=${result.bytes} AND r.status='GENERATED' AND a.action='EXPORT_GENERATED' AND a.result='SUCCESS'`)).toBe('1');
}
function worker(args,input){
 const child=cp.spawn('docker',args,{env:process.env,stdio:['pipe','pipe','pipe']});let output='';let failure='';
 child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{failure+=chunk;});
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve({code,output,failure}));});
 child.stdin.write(input+'\n');
 return {child,done,async wait(marker='READY'){await expect.poll(()=>output,{timeout:15000}).toContain(marker+'\n');},go(){child.stdin.write('GO\n');},async finish(){child.stdin.end();const result=await done;expect(result.failure).toBe('');expect(result.code).toBe(0);return JSON.parse(result.output.trim().split('\n').at(-1));},async close(){if(child.exitCode===null){child.stdin.end('GO\nGO\n');await done;}}};
}
function activity(key,extra={}){return {key,agentKey:'other',additionalAgentKeys:['agent'],partnerKey:'partner',projectKey:'project',name:'Recovery '+key,description:'Couverture des courses et reprises',dateStart:'2026-09-05',dateEnd:'2032-12-31',authorizedAmount:'100',operations:[{name:'Opération '+key,typeKey:'type',authorizedAmount:'100'}],...extra};}
function definition(namespace,activities){return {namespace,entity:1,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'partner',label:'Partenaire reprise'}],projects:[{key:'project',label:'Projet reprise',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type reprise'}]},activities};}
test.beforeAll(()=>{
 cp.execFileSync('docker',[...php,'install'],{env:process.env,stdio:'pipe'});
 fixture=createPhase3AFixtureSet(definition('phase3b.recovery',[activity('owned'),activity('assignment-before'),activity('assignment-after'),activity('cancel-before'),activity('cancel-after')]));
 drafts=createPhase2FixtureSet(definition('phase3b.abandon',[activity('abandon-before',{submit:false}),activity('abandon-after',{submit:false})]));
});

for(const [mode,code] of Object.entries({open:'SPOOL_UNAVAILABLE',hash:'ARTIFACT_READ_FAILED',artifact:'ARTIFACT_LIMIT',unlink:'SPOOL_CLEANUP_FAILED',renderer:'INVALID_AMOUNT',rows:'REPORT_LIMIT','pdf-rows':'REPORT_LIMIT',bytes:'REPORT_LIMIT',cell:'UNSUPPORTED_RECORD',memory:'EXPORT_MEMORY_LIMIT',deadline:'EXPORT_DEADLINE'})) test(`${mode} failure rolls back, cleans the spool and permits a fresh export`,()=>{
 const before=evidence();const result=command('recovery',request(mode));
 expect(result).toMatchObject({code,delivered:0,transaction_opened:0,budgets_restored:true,spool_descriptors:0,lock_released:true,final_commits:0});
 expect(evidence()).toEqual(before);clean();success(command('recovery',request()));clean();
});
for(const mode of ['uncertain-uncommitted','uncertain-false','uncertain-throw','deadline-after-commit']) test(`${mode} withholds bytes without replaying or deleting committed evidence`,()=>{
 const before=evidence();const result=command('recovery',request(mode));
 expect(result).toEqual({code:mode==='deadline-after-commit'?'EXPORT_DEADLINE':'EXPORT_COMMIT_UNCERTAIN',delivered:0,transaction_opened:0,budgets_restored:true,spool_descriptors:0,lock_released:true,final_commits:1});
 const increment=mode==='uncertain-uncommitted'?0:1;expect(evidence()).toEqual(before.map(n=>n+increment));
 if(increment) expect(sql("SELECT COUNT(*) FROM llx_mjlfinancement_export_record r LEFT JOIN llx_mjlfinancement_audit_event a ON a.rowid=r.fk_audit_event AND a.entity=r.entity AND a.object_ref=r.ref AND a.action='EXPORT_GENERATED' AND a.result='SUCCESS' WHERE a.rowid IS NULL OR r.status<>'GENERATED'")).toBe('0');
 clean();
});
test('SIGKILL leaves a private orphan which the next real export sweeps',()=>{
 const before=evidence();const killed=cp.spawnSync('docker',[...php,'recovery'],{env:process.env,input:JSON.stringify(request('hard-crash'))+'\n',encoding:'utf8',timeout:15000});
 expect(killed.status).toBe(137);expect(killed.stdout).toBe('');expect(evidence()).toEqual(before);
 const entries=command('spool-state',request());expect(entries).toHaveLength(1);expect(entries[0]).toMatch(/^attempt-[a-f0-9]{32}$/);
 const modes=cp.execFileSync('docker',['compose','exec','-T','dolibarr','stat','-c','%a:%u',`/tmp/mjlfinancement-exports/${entries[0]}`,`/tmp/mjlfinancement-exports/${entries[0]}/artifact.csv`],{env:process.env,encoding:'utf8'}).trim();
 expect(modes).toBe('700:33\n600:33');success(command('recovery',request()));clean();
});

for(const order of ['before','after']) for(const change of ['assignment','deactivation','role','entity','native-admin','cancel','abandon']) test(`${change} ${order} export commit respects locked authorization and immutable bytes`,async()=>{
 const set=change==='abandon'?drafts:fixture;
 const key=['assignment','cancel','abandon'].includes(change)?`${change}-${order}`:'owned';
 const input=request(order==='before'?'snapshot':'before-commit',set,key);
 const accountChange=['deactivation','role','entity','native-admin'].includes(change);
 const actor=set.users[accountChange?'supervisor':'agent'].id;input.actorId=actor;const activityId=input.activityId;
 let mutationArgs,mutationInput,restore;
 if(change==='assignment'){mutationArgs=[...php,'remove'];mutationInput={actorId:set.users.validator.id,activityId,targetId:actor};}
 else if(change==='abandon'){mutationArgs=[...php,'abandon'];mutationInput={actorId:set.users.other.id,activityId};}
 else if(change==='cancel'){
  const pending=phase3ACommand({action:'request-cancel',entity:1,localDate:'2026-09-11',actorId:set.users.other.id,targetType:'ACTIVITY',targetId:activityId,expectedVersion:sql(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`),reason:'Clôture concurrente'});expect(pending.code).toBe('OK');
  mutationArgs=[...php.slice(0,-1),'/opt/mjl-tests/fixtures/phase3a-command.php'];mutationInput={action:'decide-cancel',entity:1,localDate:'2026-09-11',actorId:set.users.validator.id,requestId:pending.request_id,expectedVersion:pending.request_version,decision:'APPROVED',reason:'Clôture autorisée'};
 }else{
  const statements={deactivation:[`UPDATE llx_user SET statut=0 WHERE rowid=${actor}`,`UPDATE llx_user SET statut=1 WHERE rowid=${actor}`],role:[`UPDATE llx_mjlfinancement_user_role SET role_code='VALIDATEUR_DEFINITIF' WHERE entity=1 AND fk_user=${actor}`,`UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_VERIFICATEUR' WHERE entity=1 AND fk_user=${actor}`],entity:[`UPDATE llx_user SET entity=2 WHERE rowid=${actor}`,`UPDATE llx_user SET entity=1 WHERE rowid=${actor}`],'native-admin':[`START TRANSACTION; UPDATE llx_user SET statut=statut WHERE rowid=${actor}; UPDATE llx_mjlfinancement_user_role SET is_active=0 WHERE entity=1 AND fk_user=${actor}; UPDATE llx_user SET admin=1 WHERE rowid=${actor}; COMMIT`,`START TRANSACTION; UPDATE llx_user SET admin=0 WHERE rowid=${actor}; UPDATE llx_mjlfinancement_user_role SET is_active=1 WHERE entity=1 AND fk_user=${actor}; COMMIT`]};
  mutationArgs=database;mutationInput=statements[change][0]+`; SELECT '{"code":"OK"}';`;restore=statements[change][1];
 }
 const before=evidence();const exporting=worker([...php,'recovery'],JSON.stringify(input));let mutating;
 try{
  await exporting.wait();mutating=worker(mutationArgs,typeof mutationInput==='string'?mutationInput:JSON.stringify(mutationInput));mutating.child.stdin.end();
  if(order==='after'){
   // Observe a real InnoDB lock wait, rather than assuming the second process has started.
   await expect.poll(()=>Number(privilegedScalar('SELECT COUNT(*) FROM information_schema.INNODB_LOCK_WAITS')),{timeout:10000}).toBeGreaterThan(0);
   exporting.go();await exporting.wait('COMMITTED');
  }
  const changed=await mutating.done;expect(changed.code).toBe(0);expect(changed.failure).toBe('');expect(JSON.parse(changed.output).code).toBe('OK');
  exporting.go();const result=await exporting.finish();
  if(order==='before'){expect(['SCOPE_CHANGED','FORBIDDEN']).toContain(result.code);expect(result.delivered).toBe(0);expect(evidence()).toEqual(before);}
  else {success(result);expect(evidence()).toEqual(before.map(n=>n+1));}
  expect(result.transaction_opened).toBe(0);expect(result.budgets_restored).toBe(true);expect(result.spool_descriptors).toBe(0);expect(result.lock_released).toBe(true);clean();
  const fresh=command('recovery',{...request('normal',set,key),actorId:actor});
  if(['assignment','cancel','abandon'].includes(change)){
   success(fresh);expect(sql(`SELECT scope_json FROM llx_mjlfinancement_export_record WHERE ref='${fresh.ref}'`)).toBe('[]');
  }else if(change==='role')success(fresh);
  else expect(fresh.code).toBe('FORBIDDEN');
 }finally{await exporting.close();if(mutating)await mutating.done;if(restore)sql(restore);}
});

// Keep the intentionally oversized immutable audit payload out of entity 1's later report/benchmark selections.
test('source payload is rejected before audit rows are fetched',()=>{
 const source=createPhase2FixtureSet({...definition('phase3b.source',[activity('source',{submit:false})]),entity:2});
 const before=evidence();const result=command('recovery',{actorId:source.users.validator.id,activityId:source.activities.source.activity_id,mode:'source'});
 expect(result).toEqual({code:'SOURCE_LIMIT',delivered:0,transaction_opened:0,budgets_restored:true,spool_descriptors:0,lock_released:true,final_commits:0});expect(evidence()).toEqual(before);clean();success(command('recovery',request()));
});

test('a throttled client abort preserves GENERATED evidence and no named artifact',async({page})=>{
 await page.goto('/index.php');await page.getByLabel('Identifiant').fill(fixture.users.agent.login);await page.getByLabel('Mot de passe').fill(process.env.MJL_TEST_USER_PASSWORD);await page.getByRole('button',{name:'Connexion'}).click();
 await page.goto('/custom/mjlfinancement/reports.php');const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();
 const cookie=(await page.context().cookies()).map(c=>`${c.name}=${c.value}`).join('; ');const before=evidence();
 const config=`url = "${process.env.MJL_BASE_URL}/custom/mjlfinancement/reportexport.php"\ncookie = "${cookie}"\ndata = "${new URLSearchParams({token,format:'pdf',activity_id:String(fixture.activities.owned.activity_id)})}"\n`;
 // A PDF outlasts the five-second download allowance; the small POST uploads immediately.
 // Credentials remain on stdin; do not put session cookies in process arguments or artifacts.
 const result=cp.spawnSync('curl',['--config','-','--silent','--limit-rate','1024','--max-time','5','--output','/dev/null','--write-out','%{http_code} %{size_download} %{size_header}'],{input:config,encoding:'utf8',timeout:10000});
 expect(result.status).toBe(28);const [status,received]=result.stdout.trim().split(' ').map(Number);expect(status).toBe(200);expect(received).toBeGreaterThan(0);
 expect(evidence()).toEqual(before.map(n=>n+1));const [state,bytes]=sql('SELECT status,byte_count FROM llx_mjlfinancement_export_record ORDER BY rowid DESC LIMIT 1').split('\t');expect(state).toBe('GENERATED');expect(received).toBeLessThan(Number(bytes));clean();
});

