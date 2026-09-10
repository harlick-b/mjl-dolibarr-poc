const {test,expect}=require('@playwright/test');
const cp=require('node:child_process');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {createPhase3AFixtureSet,phase3ACommand}=require('../helpers/phase3a-fixture');
let fixture,foreign;
test.describe.configure({mode:'serial'});
function evidence() {return sql("SELECT (SELECT COUNT(*) FROM llx_mjlfinancement_export_record),(SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE action='EXPORT_GENERATED')");}
function sql(statement) {return cp.execFileSync('docker',['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','-N','-B','dolidb'],{encoding:'utf8',env:process.env,input:statement+'\n'}).trim();}
async function login(page,key='agent') {
 await page.goto('/index.php');await page.getByLabel('Identifiant').fill(key==='admin'?'admin':fixture.users[key].login);
 await page.getByLabel('Mot de passe').fill(key==='admin'?(process.env.DOLI_ADMIN_PASSWORD||'Admin1234'):process.env.MJL_TEST_USER_PASSWORD);
 await page.getByRole('button',{name:'Connexion'}).click();await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}
test.beforeAll(()=>{
 cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','install'],{env:process.env,stdio:'pipe'});
 fixture=createPhase3AFixtureSet({namespace:'phase3b.reports',entity:1,
 users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'},{key:'norole',role:null}],
 references:{partners:[{key:'partner',label:'Partenaire rapports'}],projects:[{key:'project',label:'Projet rapports',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type rapports'}]},
 activities:[
 {key:'owned',agentKey:'agent',partnerKey:'partner',projectKey:'project',name:'Activité rapport visible',description:'Montants exacts.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'9223372036854775807',operations:[{name:'Opération exacte',typeKey:'type',authorizedAmount:'9223372036854775807'}]},
 {key:'hidden',agentKey:'other',partnerKey:'partner',projectKey:'project',name:'Activité hors affectation',description:'Ne doit pas être divulguée.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'100',operations:[{name:'Autre opération',typeKey:'type',authorizedAmount:'100'}]},
 {key:'race',agentKey:'other',additionalAgentKeys:['agent'],partnerKey:'partner',projectKey:'project',name:'Activité retrait concurrent',description:'Retrait pendant la capture.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'100',operations:[{name:'Opération concurrente',typeKey:'type',authorizedAmount:'100'}]},
 ]});
 foreign=createPhase3AFixtureSet({namespace:'phase3b.foreign',entity:2,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'partner',label:'Partenaire étranger'}],projects:[{key:'project',label:'Projet étranger',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type étranger'}]},activities:[{key:'foreign',agentKey:'agent',partnerKey:'partner',projectKey:'project',name:'Activité autre entité',description:'Isolation du rapport.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'100',operations:[{name:'Opération étrangère',typeKey:'type',authorizedAmount:'100'}]}]});
});
test('assigned Agent exports exact scoped Activities CSV with matching immutable evidence',async({page})=>{
 await login(page); await page.goto('/custom/mjlfinancement/activities.php');await page.getByRole('link',{name:'Suivi des Activités et téléchargements'}).click();
 await expect(page.getByRole('heading',{name:'Suivi des Activités',exact:true})).toBeVisible();
 await expect(page.getByText('Activité rapport visible',{exact:true})).toBeVisible();
 await expect(page.getByText('Activité hors affectation',{exact:true})).toHaveCount(0);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger CSV',exact:true}).click();const download=await pending;
 expect(download.suggestedFilename()).toMatch(/^mjl-activites-.*\.csv$/);
 const bytes=fs.readFileSync(await download.path());expect(bytes.subarray(0,3)).toEqual(Buffer.from([0xef,0xbb,0xbf]));
 const content=bytes.toString('utf8');expect(content).toContain('9223372036854775807');expect(content).not.toContain('Activité hors affectation');
 const digest=crypto.createHash('sha256').update(bytes).digest('hex');
 expect(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_export_record r JOIN llx_mjlfinancement_audit_event a ON a.rowid=r.fk_audit_event WHERE r.content_sha256='${digest}' AND r.entity=a.entity AND r.ref=a.object_ref AND a.actor_id=r.fk_generator AND a.action='EXPORT_GENERATED' AND a.result='SUCCESS'`)).toBe('1');
});
for (const format of ['PDF','XLSX']) test(`Activities ${format} download matches audited bytes`,async({page},testInfo)=>{
 await login(page);await page.goto('/custom/mjlfinancement/reports.php');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:`Télécharger ${format}`,exact:true}).click();
 const download=await pending;const bytes=fs.readFileSync(await download.path());
 expect(bytes.subarray(0,format==='PDF'?4:2).toString()).toBe(format==='PDF'?'%PDF':'PK');
 if(format==='PDF'){const content=cp.execFileSync('pdftotext',[await download.path(),'-'],{encoding:'utf8'});expect(content).toContain('Activité rapport visible');expect(content).not.toContain('Activité hors affectation');await download.saveAs(testInfo.outputPath('activities-report.pdf'));}
 const digest=crypto.createHash('sha256').update(bytes).digest('hex');
 expect(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_export_record WHERE content_sha256='${digest}'`)).toBe('1');
});
for (const role of ['admin','norole']) test(`${role} cannot open or generate a business report`,async({page})=>{
 await login(page,role);expect((await page.goto('/custom/mjlfinancement/reports.php')).status()).toBe(403);
 expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{format:'csv'}})).status()).toBe(403);
});
test('download rejects invalid methods, tokens and filter shapes without evidence',async({page})=>{
 await login(page);await page.goto('/custom/mjlfinancement/reports.php');
 const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();
 const before=evidence();
 expect((await page.request.get('/custom/mjlfinancement/reportexport.php')).status()).toBe(405);
 expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{format:'csv'}})).status()).toBe(403);
 for (const extra of [{format:'exe'},{unexpected:'1'},{'q[]':'x'}]) expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{token,format:'csv',...extra}})).status()).toBe(400);
 expect(evidence()).toBe(before);
});
test('Supervisor sees the portfolio and mobile Agent can filter without JavaScript',async({page,browser},testInfo)=>{
 await login(page,'supervisor');await page.goto('/custom/mjlfinancement/reports.php');
 await expect(page.getByText('Activité hors affectation',{exact:true})).toBeVisible();
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 try {const mobile=await context.newPage();await login(mobile);await mobile.goto('/custom/mjlfinancement/reports.php');
 await mobile.getByLabel('Recherche',{exact:true}).fill('aucun résultat');await mobile.getByRole('button',{name:'Appliquer les filtres'}).click();
 await expect(mobile.getByRole('status').getByText('Aucune Activité',{exact:true})).toBeVisible();
 await mobile.screenshot({path:testInfo.outputPath('activities-report-mobile.png'),fullPage:true});
 } finally {await context.close();}
});
test('audit insertion failure delivers no attachment and rolls back export evidence',async({page})=>{
 await login(page);await page.goto('/custom/mjlfinancement/reports.php');
 const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();
 const before=evidence();
 sql("CREATE TRIGGER phase3b_test_audit_failure BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test audit failure'");
 try {const response=await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{token,format:'csv'}});
 expect(response.status()).toBe(503);expect(response.headers()['content-disposition']).toBeUndefined();
 expect(evidence()).toBe(before);
 } finally {sql('DROP TRIGGER phase3b_test_audit_failure');}
});
for (const race of ['assignment','deactivation']) test(`generation lock rejects overlap and ${race} change prevents delivery`,async({page})=>{
 await login(page);await page.goto('/custom/mjlfinancement/reports.php');
 const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();
 const before=evidence();
 const args=['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php'];
 const worker=cp.spawn('docker',[...args,'worker'],{env:process.env,stdio:['pipe','pipe','pipe']});
 let output='';let readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 worker.stdout.on('data',chunk=>{output+=chunk.toString();if(output.includes('READY\n'))readyResolve();});
 worker.stderr.resume();worker.on('error',readyReject);
 const done=new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('exit',code=>{if(!output.includes('READY\n'))readyReject(new Error('Export worker did not reach barrier'));resolve(code);});});
 const timer=setTimeout(()=>{readyReject(new Error('Export barrier timed out'));worker.kill('SIGTERM');},15000);
 worker.stdin.write(JSON.stringify({actorId:fixture.users[race==='assignment'?'agent':'supervisor'].id,activityId:fixture.activities[race==='assignment'?'race':'owned'].activity_id})+'\n');
 try {
  await ready;
  expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{token,format:'csv'}})).status()).toBe(409);
  if (race==='deactivation') sql(`UPDATE llx_user SET statut=0 WHERE rowid=${fixture.users.supervisor.id}`);
  else { const removal=JSON.parse(cp.execFileSync('docker',[...args,'remove'],{env:process.env,encoding:'utf8',input:JSON.stringify({actorId:fixture.users.validator.id,activityId:fixture.activities.race.activity_id,targetId:fixture.users.agent.id})+'\n',stdio:['pipe','pipe','pipe']}));
  expect(removal.code).toBe('OK'); }
  worker.stdin.end('GO\n');expect(await done).toBe(0);
  expect(['SCOPE_CHANGED','FORBIDDEN']).toContain(JSON.parse(output.trim().split('\n').at(-1)).code);
  expect(evidence()).toBe(before);
 } finally {if(race==='deactivation')sql(`UPDATE llx_user SET statut=1 WHERE rowid=${fixture.users.supervisor.id}`);clearTimeout(timer);if(worker.exitCode===null){worker.stdin.end('GO\n');await done;}}
});
test('export-record collision rolls back the already inserted success audit',async({page})=>{
 await login(page);await page.goto('/custom/mjlfinancement/reports.php');
 const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();const before=evidence();
 sql(`CREATE TRIGGER phase3b_test_record_collision AFTER INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW
 INSERT INTO llx_mjlfinancement_export_record (entity,ref,report_type,projection_version,format,status,fk_generator,generator_name_snapshot,generator_role_snapshot,date_snapshot,date_generation,filters_json,scope_json,body_row_count,byte_count,content_sha256,fk_audit_event)
 SELECT NEW.entity,NEW.object_ref,'activities',1,'csv','GENERATED',NEW.actor_id,'Test','AGENT_SAISIE',NOW(),NOW(),'{}','[]',0,1,REPEAT('0',64),NEW.rowid WHERE NEW.action='EXPORT_GENERATED'`);
 try {const response=await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{token,format:'csv'}});
 expect(response.status()).toBe(503);expect(response.headers()['content-disposition']).toBeUndefined();expect(evidence()).toBe(before);
 const probe=JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','generate'],{env:process.env,encoding:'utf8',input:JSON.stringify({actorId:fixture.users.agent.id,activityId:fixture.activities.owned.activity_id})+'\n',stdio:['pipe','pipe','pipe']}));
 expect(probe.code).toBe('EXPORT_DATABASE_FAILED');expect(evidence()).toBe(before);
 } finally {sql('DROP TRIGGER phase3b_test_record_collision');}
});
test('incidental buffered output cannot change delivered artifact bytes',async()=>{
 const bytes=cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','delivery'],{env:process.env,input:JSON.stringify({actorId:fixture.users.agent.id,activityId:fixture.activities.owned.activity_id})+'\n',stdio:['pipe','pipe','pipe']});
 expect(bytes.subarray(0,3)).toEqual(Buffer.from([0xef,0xbb,0xbf]));expect(bytes.toString()).not.toContain('INCIDENTAL_DIAGNOSTIC');
 const digest=crypto.createHash('sha256').update(bytes).digest('hex');expect(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_export_record WHERE content_sha256='${digest}' AND byte_count=${bytes.length}`)).toBe('1');
});
test('blocked preview fails within budget and a fresh request recovers',async({page})=>{
 await login(page);
 const lock=cp.spawn('docker',['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','-N','-B','--unbuffered','dolidb'],{env:process.env,stdio:['pipe','pipe','pipe']});
 let out='';let readyResolve,readyReject;const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 lock.stdout.on('data',data=>{out+=data.toString();if(out.includes('READY'))readyResolve();});lock.stderr.resume();lock.on('error',readyReject);
 const done=new Promise(resolve=>lock.on('exit',resolve));const timer=setTimeout(()=>{readyReject(new Error('Preview lock timed out'));lock.kill('SIGTERM');},15000);
 try {lock.stdin.write("LOCK TABLES llx_mjlfinancement_activity WRITE; SELECT 'READY';\n");await ready;
 const start=Date.now();const response=await page.goto('/custom/mjlfinancement/reports.php');expect(response.status()).toBe(503);expect(Date.now()-start).toBeLessThan(10000);
 await expect(page.getByRole('alert').getByText('Rapport indisponible',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Télécharger CSV'})).toHaveCount(0);
 } finally {lock.stdin.end('UNLOCK TABLES;\n');await done;clearTimeout(timer);}
 expect((await page.goto('/custom/mjlfinancement/reports.php')).status()).toBe(200);
});
test('download distinguishes unknown spending from explicit zero',async({page})=>{
 await login(page);const activity=fixture.activities.owned;const operation=activity.operations[0];
 async function row(){await page.goto(`/custom/mjlfinancement/reports.php?activity_id=${activity.activity_id}`);const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger CSV',exact:true}).click();
 const bytes=fs.readFileSync(await (await pending).path());
 const rows=JSON.parse(cp.execFileSync('python3',['-c','import csv,json,sys; print(json.dumps(list(csv.reader(sys.stdin,delimiter=";"))))'],{input:bytes,encoding:'utf8'}));
 const headers=rows.find(r=>r[0]==='Référence Activité');const record=rows.find(r=>r[1]==='Activité rapport visible');return Object.fromEntries(headers.map((key,i)=>[key,record[i]]));}
 const unknown=await row();
 const result=phase3ACommand({action:'update',entity:1,actorId:fixture.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:operation.version,localDate:'2026-09-09',input:{status:'IN_PROGRESS',spent_amount:'0',observation:'Aucune dépense engagée'}});expect(result.code).toBe('OK');
 const zero=await row();
 expect(unknown['Dépenses renseignées (FCFA)']).not.toBe('0');expect(zero['Dépenses renseignées (FCFA)']).toBe('0');
});

test('success and failure leave no named report artifacts',()=>{
 const state=JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','spool-state'],{env:process.env,encoding:'utf8',input:JSON.stringify({actorId:fixture.users.agent.id,activityId:fixture.activities.owned.activity_id})+'\n',stdio:['pipe','pipe','pipe']}));expect(state).toEqual([]);
});

test('Supervisor cannot discover or export an Activity from another entity',async({page})=>{
 await login(page,'supervisor');await page.goto('/custom/mjlfinancement/reports.php');
 await expect(page.getByText('Activité autre entité',{exact:true})).toHaveCount(0);
 await page.goto(`/custom/mjlfinancement/reports.php?activity_id=${foreign.activities.foreign.activity_id}`);
 await expect(page.getByRole('status').getByText('Aucune Activité',{exact:true})).toBeVisible();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger CSV',exact:true}).click();const bytes=fs.readFileSync(await(await pending).path());expect(bytes.toString()).not.toContain('Activité autre entité');
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');expect(sql(`SELECT scope_json FROM llx_mjlfinancement_export_record WHERE content_sha256='${hash}'`)).toBe('[]');
});
