const {test,expect}=require('@playwright/test');
const cp=require('node:child_process');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {createPhase3AFixtureSet,phase3ACommand}=require('../helpers/phase3a-fixture');
let fixture,foreign;
test.describe.configure({mode:'serial'});
function sql(statement){return cp.execFileSync('docker',['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','-N','-B','dolidb'],{env:process.env,encoding:'utf8',input:statement+'\n',stdio:['pipe','pipe','pipe']}).trim();}
async function login(page,key='agent'){
 await page.context().clearCookies();
 await page.goto('/index.php');await page.getByLabel('Identifiant').fill(key==='admin'?'admin':fixture.users[key].login);
 await page.getByLabel('Mot de passe').fill(key==='admin'?(process.env.DOLI_ADMIN_PASSWORD||'Admin1234'):process.env.MJL_TEST_USER_PASSWORD);
 await page.getByRole('button',{name:'Connexion'}).click();await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}
function command(request){const result=phase3ACommand({entity:1,localDate:'2026-09-09',...request});expect(result.code).toBe('OK');return result;}
async function download(page,format='CSV'){const pending=page.waitForEvent('download');await page.getByRole('button',{name:`Télécharger ${format}`,exact:true}).click();const file=await pending;return {file,bytes:fs.readFileSync(await file.path())};}
function evidence(bytes){const hash=crypto.createHash('sha256').update(bytes).digest('hex');return sql(`SELECT CONCAT(r.report_type,'|',r.scope_json,'|',r.body_row_count) FROM llx_mjlfinancement_export_record r JOIN llx_mjlfinancement_audit_event a ON a.rowid=r.fk_audit_event AND a.entity=r.entity AND a.object_ref=r.ref WHERE r.content_sha256='${hash}' AND r.byte_count=${bytes.length} AND a.action='EXPORT_GENERATED' AND a.result='SUCCESS'`);}
let probes,executionEvent;
function fixtureAction(action){return JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php',action],{env:process.env,encoding:'utf8',stdio:['pipe','pipe','pipe'],input:JSON.stringify({actorId:fixture.users.validator.id,activityId:fixture.activities.main.activity_id})+'\n'}));}
function version(table,id){return sql(`SELECT version FROM llx_mjlfinancement_${table} WHERE rowid=${id}`);}
test.beforeAll(()=>{
 cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','install'],{env:process.env,stdio:'pipe'});
 const specification=(namespace,entity)=>({namespace,entity,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'},{key:'norole',role:null}],references:{partners:[{key:'partner',label:'Partenaire audit'}],projects:[{key:'project',label:'Projet audit',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type audit'}]},activities:[{key:'main',agentKey:'agent',partnerKey:'partner',projectKey:'project',name:'Activité audit',description:'Audit des transitions.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'100',operations:[{name:'Opération à annuler',typeKey:'type',authorizedAmount:'40'},{name:'Opération à rouvrir',typeKey:'type',authorizedAmount:'60'}]}]});
 fixture=createPhase3AFixtureSet(specification('phase3b.audit',1));foreign=createPhase3AFixtureSet(specification('phase3b.audit-ext',2));
 const a=fixture.activities.main;const update=(op,status,spent)=>command({action:'update',actorId:fixture.users.agent.id,activityId:a.activity_id,operationId:op.rowid,expectedVersion:version('operation',op.rowid),input:{status,spent_amount:spent,observation:spent==='0'?'Aucune dépense engagée':null}});
 update(a.operations[0],'IN_PROGRESS','0');executionEvent=Number(sql(`SELECT MAX(rowid) FROM llx_mjlfinancement_audit_event WHERE activity_id=${a.activity_id} AND action='OPERATION_EXECUTION_UPDATED'`));update(a.operations[1],'COMPLETED','60');
 for(const decision of ['WITHDRAWN','REJECTED','APPROVED']){
 const r=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:a.operations[0].rowid,expectedVersion:version('operation',a.operations[0].rowid),reason:'Demande documentée'});
 command({action:decision==='WITHDRAWN'?'withdraw-cancel':'decide-cancel',actorId:fixture.users[decision==='WITHDRAWN'?'agent':'validator'].id,requestId:r.request_id,expectedVersion:r.request_version,...(decision==='WITHDRAWN'?{}:{decision,reason:'Décision documentée'})});
 }
 for(const decision of ['WITHDRAWN','REJECTED','APPROVED']){
 const r=command({action:'request-reopen',actorId:fixture.users.agent.id,operationId:a.operations[1].rowid,expectedVersion:version('operation',a.operations[1].rowid),reason:'Réouverture documentée'});
 command({action:decision==='WITHDRAWN'?'withdraw-reopen':'decide-reopen',actorId:fixture.users[decision==='WITHDRAWN'?'agent':'validator'].id,requestId:r.request_id,expectedVersion:r.request_version,...(decision==='WITHDRAWN'?{}:{decision,reason:'Décision documentée'})});
 }
 const r=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'ACTIVITY',targetId:a.activity_id,expectedVersion:version('activity',a.activity_id),reason:'Clôture de l’Activité'});command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:r.request_id,expectedVersion:r.request_version,decision:'APPROVED',reason:'Annulation documentée'});
 probes=fixtureAction('audit-fixtures');
});
const url='/custom/mjlfinancement/reports.php?report=audit';
function records(bytes){const rows=JSON.parse(cp.execFileSync('python3',['-c','import csv,json,sys;print(json.dumps(list(csv.reader(sys.stdin,delimiter=";"))))'],{encoding:'utf8',input:bytes}));const i=rows.findIndex(r=>r.includes('Chemin du champ'));return rows.slice(i+1).filter(r=>r.length===rows[i].length).map(r=>Object.fromEntries(rows[i].map((h,k)=>[h,r[k]])));}
test('Validator enters complete audit from existing menu and exports all supported current history',async({page})=>{
 await login(page,'validator');await page.goto('/custom/mjlfinancement/workflowactions.php');await expect(page.getByRole('heading',{name:'Journal d’audit',exact:true})).toBeVisible();const {bytes}=await download(page);const rows=records(bytes);expect(rows.length).toBeGreaterThan(57);for(const action of ['CANCELLATION_WITHDRAWN','CANCELLATION_REJECTED','CANCELLATION_APPROVED','REOPENING_WITHDRAWN','REOPENING_REJECTED','REOPENING_APPROVED','ASSIGNMENT_REMOVED','ACTIVITY_CANCELLED'])expect(rows.some(r=>r['Code action']===action)).toBe(true);expect(evidence(bytes)).toBe(`audit|[]|${rows.length}`);
});
for(const format of ['CSV','XLSX','PDF']) test(`Admin audit ${format} preserves captured operation changes and excludes its own generation event`,async({page},testInfo)=>{
 await login(page,'admin');await page.goto(url+'&event_id='+executionEvent);const {file,bytes}=await download(page,format);expect(file.suggestedFilename()).toMatch(/^mjl-journal-audit-.*\.(csv|xlsx|pdf)$/);expect(evidence(bytes)).toMatch(/^audit\|\[\]\|[1-9]/);
 if(format==='CSV'){const r=records(bytes);expect(r.every(x=>x['Identifiant événement']===String(executionEvent))).toBe(true);const spending=r.find(x=>x['Chemin du champ']==='spent_amount');expect(spending['Type avant']).toBe('Non renseigné');expect(spending['Valeur après']).toBe('0');expect(r.some(x=>x['Code action']==='EXPORT_GENERATED')).toBe(false);}
 if(format==='PDF'){const text=cp.execFileSync('pdftotext',[await file.path(),'-'],{encoding:'utf8'});expect(text).toContain('Montant dépensé');expect(text).toContain('Valeur après : 0');await file.saveAs(testInfo.outputPath('audit-report.pdf'));}
 if(format==='XLSX'){const xml=cp.execFileSync('python3',['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.read("xl/sharedStrings.xml").decode());print(z.read("xl/worksheets/sheet2.xml").decode())',await file.path()],{encoding:'utf8'});expect(xml).toContain('Montant dépensé');expect(xml).toContain('Non renseigné');expect(xml).not.toContain('<f>');}
});
test('audit cursor pages preserve historical filters and downloads include all matching pages',async({page})=>{
 await login(page,'validator');await page.goto(url+'&q=AUDIT-PROBE-&direction=asc');await expect(page.locator('article.mjl-activity-panel')).toHaveCount(50);await page.getByRole('navigation',{name:'Pagination du journal'}).getByRole('link',{name:'Suivant'}).click();await expect(page.locator('article.mjl-activity-panel')).toHaveCount(7);expect(new URL(page.url()).searchParams.get('cursor')).toBe(String(probes[49]));const r=records((await download(page)).bytes);expect(new Set(r.map(x=>x['Identifiant événement'])).size).toBe(57);await page.getByRole('link',{name:'Première page',exact:true}).click();await expect(page.locator('article.mjl-activity-panel')).toHaveCount(50);
});
test('audit redacts quoted historical credentials before continuation splitting in UI and CSV',async({page})=>{
 await login(page,'admin');await page.goto(url+'&event_id='+probes[0]);await page.getByText('Champs et valeurs enregistrés',{exact:true}).click();expect(await page.locator('body').innerText()).not.toMatch(/PRIVATE (AUDIT|ACTOR) VALUE/);const {bytes}=await download(page);const r=records(bytes);const reason=r.filter(x=>x['Chemin du champ']==='reason');expect(reason.length).toBeGreaterThan(1);expect(reason.map(x=>x['Valeur après']).join('')).toContain('[REDACTED]');expect(bytes.toString()).not.toMatch(/PRIVATE (AUDIT|ACTOR) VALUE/);expect(r[0]['Nom historique de l’acteur']).toContain('Historique');
});
for(const key of ['agent','supervisor','norole']) test(`${key} cannot read or export complete audit`,async({page})=>{await login(page,key);expect((await page.goto(url)).status()).toBe(403);expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{report:'audit',format:'csv'}})).status()).toBe(403);});
test('audit filters active entity and historical identifiers; malformed cursors never generate evidence',async({page})=>{
 const eventDate=sql(`SELECT DATE(event_date) FROM llx_mjlfinancement_audit_event WHERE entity=1 AND rowid=${probes[1]}`);
 await login(page,'admin');await page.goto(url+'&activity_id='+foreign.activities.main.activity_id);expect(records((await download(page)).bytes)).toHaveLength(0);await page.goto(url+'&event_id='+probes[1]+'&actor_id='+fixture.users.validator.id+'&audit_action=ACTIVITY_CREATED&result=SUCCESS&date_from='+eventDate+'&date_to='+eventDate);expect(new Set(records((await download(page)).bytes).map(x=>x['Identifiant événement']))).toEqual(new Set([String(probes[1])]));
 const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();const before=sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record');
 for(const filters of [{'cursor[]':'1'},{direction:''},{page:'2'},{date_from:'2026-09-10',date_to:'2026-09-09'}])expect((await page.goto(url+'&'+new URLSearchParams(filters))).status()).toBe(400);
 expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{report:'audit',format:'csv',token,cursor:String(probes[1])}})).status()).toBe(400);expect(sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record')).toBe(before);
});
test('audit metadata and details are usable on mobile without JavaScript',async({browser},testInfo)=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});try{const page=await context.newPage();await login(page,'admin');await page.goto(url+'&event_id='+executionEvent);await page.getByText('Champs et valeurs enregistrés',{exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.mouse.move(0,0);await page.screenshot({path:testInfo.outputPath('audit-mobile.png'),fullPage:true});expect(records((await download(page)).bytes).length).toBeGreaterThan(0);}finally{await context.close();}
});
test('unknown and malformed audit details stay visible as unavailable and block complete export without evidence',async({page})=>{
 const ids=fixtureAction('audit-invalid');await login(page,'admin');for(const id of ids){await page.goto(url+'&event_id='+id);await expect(page.getByText(/^Détails indisponibles/)).toBeVisible();const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();const before=sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record');const response=await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{report:'audit',format:'csv',token,event_id:String(id)}});expect(response.status()).toBe(422);expect(response.headers()['content-disposition']).toBeUndefined();expect(sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record')).toBe(before);}
});
