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
function records(bytes){const rows=JSON.parse(cp.execFileSync('python3',['-c','import csv,json,sys; print(json.dumps(list(csv.reader(sys.stdin,delimiter=";"))))'],{input:bytes,encoding:'utf8'}));const index=rows.findIndex(row=>row.includes('Nature du montant autorisé'));return rows.slice(index+1).filter(row=>row.length===rows[index].length).map(row=>Object.fromEntries(rows[index].map((name,i)=>[name,row[i]])));}
async function download(page,format='CSV'){const pending=page.waitForEvent('download');await page.getByRole('button',{name:`Télécharger ${format}`,exact:true}).click();const file=await pending;return {file,bytes:fs.readFileSync(await file.path())};}
function evidence(bytes){const hash=crypto.createHash('sha256').update(bytes).digest('hex');return sql(`SELECT CONCAT(r.report_type,'|',r.scope_json,'|',r.body_row_count) FROM llx_mjlfinancement_export_record r JOIN llx_mjlfinancement_audit_event a ON a.rowid=r.fk_audit_event AND a.entity=r.entity AND a.object_ref=r.ref WHERE r.content_sha256='${hash}' AND r.byte_count=${bytes.length} AND a.action='EXPORT_GENERATED' AND a.result='SUCCESS'`);}
test.beforeAll(()=>{
 cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','install'],{env:process.env,stdio:'pipe'});
 const activity=(key,name,amount,operations,extra={})=>({key,name,agentKey:'agent',partnerKey:'partner',projectKey:'project',description:'Rapport des Opérations.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:amount,operations,...extra});
 fixture=createPhase3AFixtureSet({namespace:'phase3b.operations',entity:1,
 users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'},{key:'norole',role:null}],
 references:{partners:[{key:'partner',label:'Partenaire Opérations'}],projects:[{key:'project',label:'Projet Opérations',partnerKey:'partner'}],operationTypes:[{key:'known',label:'Type renseigné'},{key:'missing',label:'Type incomplet'}]},
 activities:[
 activity('mixed','Activité aux dépenses partielles','100',[{name:'Dépense explicitement nulle',typeKey:'known',authorizedAmount:'40'},{name:'Dépense non renseignée',typeKey:'missing',authorizedAmount:'60'}]),
 activity('maximum','Activité de précision','9223372036854775807',[{name:'Écart d’un franc',typeKey:'known',authorizedAmount:'9223372036854775807'}]),
 activity('proposal','Activité proposée','10',[{name:'Montant proposé',typeKey:'known',authorizedAmount:'10'}],{finalize:false,dateStart:'2032-01-01',dateEnd:'2032-01-31'}),
 activity('cancelled','Activité annulée à conserver','100',[{name:'Achevée avant annulation',typeKey:'known',authorizedAmount:'40'},{name:'Annulée sans dépense',typeKey:'missing',authorizedAmount:'60'}]),
 activity('pages','Activité paginée principale','50',Array.from({length:50},(_,i)=>({name:`Opération paginée ${String(i+1).padStart(2,'0')}`,typeKey:'known',authorizedAmount:'1'}))),
 activity('pages_more','Activité paginée complémentaire','1',[{name:'Opération paginée 51',typeKey:'known',authorizedAmount:'1'}]),
 activity('hidden','Activité réservée à un autre Agent','30',[{name:'Opération hors affectation',typeKey:'known',authorizedAmount:'30'}],{agentKey:'other'}),
 ]});
 for(const [key,spent,status,observation] of [['mixed','0','IN_PROGRESS','Aucune dépense engagée'],['maximum','9223372036854775806','IN_PROGRESS','=SUM(1,2)\nÉcart justifié'],['cancelled','40','COMPLETED',null]]){
 const parent=fixture.activities[key],operation=parent.operations[0];command({action:'update',actorId:fixture.users.agent.id,activityId:parent.activity_id,operationId:operation.rowid,expectedVersion:operation.version,input:{status,spent_amount:spent,observation}});
 }
 const parent=fixture.activities.cancelled;
 const request=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'ACTIVITY',targetId:parent.activity_id,expectedVersion:sql(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${parent.activity_id}`),reason:'Annulation conservant les travaux achevés'});
 command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'APPROVED',reason:'Arrêt confirmé'});
 foreign=createPhase3AFixtureSet({namespace:'phase3b.ops-foreign',entity:2,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'partner',label:'Partenaire étranger Opérations'}],projects:[{key:'project',label:'Projet étranger Opérations',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type étranger Opérations'}]},activities:[{key:'foreign',agentKey:'agent',partnerKey:'partner',projectKey:'project',name:'Activité étrangère Opérations',description:'Isolation.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'10',operations:[{name:'Opération étrangère interdite',typeKey:'type',authorizedAmount:'10'}]}]});
});
test('Agent filters Operations after complete parent calculation and exports only matching rows',async({page})=>{
 await login(page);await page.goto('/custom/mjlfinancement/operations.php');await page.getByRole('link',{name:'Suivi des Opérations et téléchargements'}).click();
 await expect(page.getByRole('heading',{name:'Suivi des Opérations',exact:true})).toBeVisible();
 await page.getByLabel('Recherche d’Activité',{exact:true}).fill('Activité aux dépenses partielles');
 await page.getByLabel('Complétude des dépenses de l’Activité',{exact:true}).selectOption('PARTIAL');
 await page.getByLabel('Type d’opération',{exact:true}).selectOption(String(fixture.operationTypes.known));
 await page.getByRole('button',{name:'Appliquer les filtres'}).click();
 await expect(page.getByRole('heading',{name:'Dépense explicitement nulle',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Dépense non renseignée',exact:true})).toHaveCount(0);
 const {bytes}=await download(page);const rows=records(bytes);expect(rows).toHaveLength(1);expect(rows[0]['Montant dépensé (FCFA)']).toBe('0');expect(rows[0]['Écart (FCFA)']).toBe('-40');expect(rows[0]['Variation (%)']).toBe("'-100,00 %");
 expect(evidence(bytes)).toBe(`operations|[${fixture.activities.mixed.activity_id}]|1`);
});
for(const format of ['CSV','XLSX','PDF']) test(`Operations ${format} preserves exact amounts, signed tiny variance and text observation`,async({page},testInfo)=>{
 await login(page);await page.goto(`/custom/mjlfinancement/reports.php?report=operations&activity_id=${fixture.activities.maximum.activity_id}`);
 expect(await page.locator('article.mjl-activity-panel p').filter({hasText:'Écart justifié'}).innerText()).toContain('=SUM(1,2)\nÉcart justifié');
 const {file,bytes}=await download(page,format);expect(file.suggestedFilename()).toMatch(/^mjl-operations-.*\.(csv|xlsx|pdf)$/);expect(evidence(bytes)).toBe(`operations|[${fixture.activities.maximum.activity_id}]|1`);
 if(format==='CSV'){const [row]=records(bytes);expect(row['Montant autorisé (FCFA)']).toBe('9223372036854775807');expect(row['Montant dépensé (FCFA)']).toBe('9223372036854775806');expect(row['Écart (FCFA)']).toBe('-1');expect(row['Variation (%)']).toBe("'-0,00 %");expect(row.Observation).toBe("'=SUM(1,2)\nÉcart justifié");}
 if(format==='PDF'){const text=cp.execFileSync('pdftotext',[await file.path(),'-'],{encoding:'utf8'});expect(text).toContain('9 223 372 036 854 775 807');expect(text).toContain('-0,00 %');expect(text).toContain('Écart justifié');await file.saveAs(testInfo.outputPath('operations-report.pdf'));}
 if(format==='XLSX'){
 const row=JSON.parse(cp.execFileSync('python3',['-c',`import zipfile,xml.etree.ElementTree as E,json,sys
z=zipfile.ZipFile(sys.argv[1]);n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
shared=[''.join(t.text or '' for t in s.findall('.//m:t',n)) for s in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',n)]
rows=E.fromstring(z.read('xl/worksheets/sheet2.xml')).findall('.//m:sheetData/m:row',n)
def value(c):
 v=c.find('m:v',n);v=v.text if v is not None else None
 return shared[int(v)] if c.get('t')=='s' and v is not None else v
headers={''.join(filter(str.isalpha,c.get('r'))):value(c) for c in rows[0]}
print(json.dumps({headers[''.join(filter(str.isalpha,c.get('r')))]:{'value':value(c),'type':c.get('t','n'),'formula':c.find('m:f',n) is not None} for c in rows[1]}))`,await file.path()],{encoding:'utf8'}));
 expect(row['Montant autorisé (FCFA)']).toMatchObject({value:'9223372036854775807',type:'s'});expect(row['Écart (FCFA)']).toMatchObject({value:'-1',type:'n'});expect(row['Variation (%)']).toMatchObject({value:'-0,00 %',type:'s'});expect(row.Observation).toEqual({value:'=SUM(1,2)\nÉcart justifié',type:'s',formula:false});
 }
});
test('Supervisor report preserves completed children and validated amounts inside cancelled Activities',async({page})=>{
 await login(page,'supervisor');await page.goto(`/custom/mjlfinancement/reports.php?report=operations&activity_id=${fixture.activities.cancelled.activity_id}`);
 let result=await download(page);let rows=records(result.bytes);expect(rows).toHaveLength(2);
 expect(rows.map(row=>row['Nature du montant autorisé'])).toEqual(['Validée','Validée']);expect(rows.map(row=>row['État de l’Opération'])).toEqual(['Terminée','Annulée']);expect(rows.map(row=>row['Montant dépensé (FCFA)'])).toEqual(['40','']);expect(rows[1]['Variation (%)']).toBe('');
 await page.getByLabel('État de l’Opération',{exact:true}).selectOption('CANCELLED');await page.getByRole('button',{name:'Appliquer les filtres'}).click();result=await download(page);rows=records(result.bytes);expect(rows).toHaveLength(1);expect(rows[0]['Opération']).toBe('Annulée sans dépense');expect(evidence(result.bytes)).toBe(`operations|[${fixture.activities.cancelled.activity_id}]|1`);
});
test('pending proposal and missing spending retain their distinct meaning',async({page})=>{
 await login(page);await page.goto(`/custom/mjlfinancement/reports.php?report=operations&activity_id=${fixture.activities.proposal.activity_id}`);
 const rows=records((await download(page)).bytes);expect(rows).toHaveLength(1);expect(rows[0]['Nature du montant autorisé']).toBe('Proposée');expect(rows[0]['Montant autorisé (FCFA)']).toBe('10');expect(rows[0]['Montant dépensé (FCFA)']).toBe('');expect(rows[0]['Écart (FCFA)']).toBe('');expect(rows[0]['Variation (%)']).toBe('');
});
test('pagination preserves Operations filters and exports all pages',async({page})=>{
 await login(page);await page.goto(`/custom/mjlfinancement/reports.php?report=operations&q=${encodeURIComponent('Activité paginée')}&operation_status=TODO`);
 await expect(page.locator('article.mjl-activity-panel')).toHaveCount(50);await page.getByRole('navigation',{name:'Pagination du rapport'}).getByRole('link',{name:'Suivant'}).click();
 await expect(page.locator('article.mjl-activity-panel')).toHaveCount(1);await expect(page.getByRole('heading',{name:'Opération paginée 50',exact:true})).toBeVisible();expect(new URL(page.url()).searchParams.get('report')).toBe('operations');expect(new URL(page.url()).searchParams.get('operation_status')).toBe('TODO');
 const {bytes}=await download(page);expect(records(bytes)).toHaveLength(51);expect(evidence(bytes)).toBe(`operations|[${fixture.activities.pages.activity_id},${fixture.activities.pages_more.activity_id}]|51`);
});
for(const key of ['admin','norole']) test(`${key} cannot read or export Operations`,async({page})=>{
 await login(page,key);expect((await page.goto('/custom/mjlfinancement/reports.php?report=operations')).status()).toBe(403);expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{report:'operations',format:'csv'}})).status()).toBe(403);
});
test('Operations report rejects unsupported report keys, malformed filters and foreign scope',async({page})=>{
 await login(page);await page.goto('/custom/mjlfinancement/reports.php?report=operations');const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();
 const before=sql("SELECT COUNT(*) FROM llx_mjlfinancement_export_record");
 for(const form of [{report:'unsupported'},{report:'../operations'},{'report[]':'operations',report:undefined},{'type_id[]':'1'},{operation_status:'FINAL_VALIDATED'}]){const body={report:'operations',format:'csv',token,...form};for(const key of Object.keys(body))if(body[key]===undefined)delete body[key];expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:body})).status()).toBe(400);}
 expect(sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record')).toBe(before);
 await page.goto(`/custom/mjlfinancement/reports.php?report=operations&activity_id=${fixture.activities.hidden.activity_id}`);await expect(page.getByRole('status').getByText('Aucune Opération',{exact:true})).toBeVisible();expect(records((await download(page)).bytes)).toHaveLength(0);
 await login(page,'supervisor');await page.goto(`/custom/mjlfinancement/reports.php?report=operations&activity_id=${foreign.activities.foreign.activity_id}`);await expect(page.getByRole('status').getByText('Aucune Opération',{exact:true})).toBeVisible();const {bytes}=await download(page);expect(records(bytes)).toHaveLength(0);expect(evidence(bytes)).toBe('operations|[]|0');
});
test('inactive operation types remain filterable on mobile without JavaScript',async({browser},testInfo)=>{
 sql(`UPDATE llx_mjlfinancement_operation_type SET is_active=0 WHERE rowid=${fixture.operationTypes.known}`);
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 try {const page=await context.newPage();await login(page);await page.goto(`/custom/mjlfinancement/reports.php?report=operations&activity_id=${fixture.activities.mixed.activity_id}`);
 await page.getByLabel('Type d’opération',{exact:true}).selectOption(String(fixture.operationTypes.known));await page.getByRole('button',{name:'Appliquer les filtres'}).click();await expect(page.getByRole('heading',{name:'Dépense explicitement nulle',exact:true})).toBeVisible();await page.mouse.move(0,0);await page.screenshot({path:testInfo.outputPath('operations-report-mobile.png'),fullPage:true});
 const {bytes}=await download(page);expect(records(bytes)).toHaveLength(1);
 } finally {await context.close();sql(`UPDATE llx_mjlfinancement_operation_type SET is_active=1 WHERE rowid=${fixture.operationTypes.known}`);}
});
test('Operations XLSX keeps actual zero variance numeric with a dash number format',async({page})=>{
 await login(page,'supervisor');await page.goto(`/custom/mjlfinancement/reports.php?report=operations&activity_id=${fixture.activities.cancelled.activity_id}&operation_status=COMPLETED`);
 const {file}=await download(page,'XLSX');
 const cell=JSON.parse(cp.execFileSync('python3',['-c',`import zipfile,xml.etree.ElementTree as E,json,sys
z=zipfile.ZipFile(sys.argv[1]);n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
c=E.fromstring(z.read('xl/worksheets/sheet2.xml')).find('.//m:c[@r="M2"]',n)
s=E.fromstring(z.read('xl/styles.xml'));xf=s.find('m:cellXfs',n)[int(c.get('s','0'))];fmt=next(f.get('formatCode') for f in s.find('m:numFmts',n) if f.get('numFmtId')==xf.get('numFmtId'))
print(json.dumps({'type':c.get('t','n'),'value':c.find('m:v',n).text,'format':fmt}))`,await file.path()],{encoding:'utf8'}));
 expect(cell.type).toBe('n');expect(cell.value).toBe('0');expect(cell.format.split(';')[2]).toBe('"-"');
});
