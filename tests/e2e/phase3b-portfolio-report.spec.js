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
test.beforeAll(()=>{
 cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','install'],{env:process.env,stdio:'pipe'});
 const specification=(namespace,entity)=>({namespace,entity,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'},{key:'norole',role:null}],references:{partners:[{key:'partner',label:'Partenaire portefeuille'}],projects:[{key:'large',label:'Projet grands montants',partnerKey:'partner'},{key:'mixed',label:'Projet dépenses partielles',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type portefeuille'}]},activities:[['large1','large','9223372036854775807'],['large2','large','9223372036854775807'],['zero','mixed','100'],['proposal','mixed','10'],['hidden','mixed','30']].map(([key,projectKey,amount])=>({key,agentKey:key==='hidden'?'other':'agent',partnerKey:'partner',projectKey,name:'Portefeuille '+key,description:'Synthèse courante.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:amount,finalize:key!=='proposal',operations:[{name:'Opération '+key,typeKey:'type',authorizedAmount:amount}]}))});
 fixture=createPhase3AFixtureSet(specification('phase3b.portfolio',1));foreign=createPhase3AFixtureSet(specification('phase3b.portfolio-ext',2));
 const draft=JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase2-fixture.php'],{env:process.env,encoding:'utf8',stdio:['pipe','pipe','pipe'],input:JSON.stringify({entity:1,activities:[{key:'draft',actorId:fixture.users.agent.id,partnerId:fixture.partners.partner,projectId:fixture.projects.mixed,name:'Portefeuille brouillon',description:'Non soumis.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'20',submit:false,operations:[{name:'Opération brouillon',typeId:fixture.operationTypes.type,authorizedAmount:'20'}]}]})})).draft;
 fixture={...fixture,activities:{...fixture.activities,draft}};
 const a=fixture.activities.zero;command({action:'update',actorId:fixture.users.agent.id,activityId:a.activity_id,operationId:a.operations[0].rowid,expectedVersion:a.operations[0].version,input:{status:'IN_PROGRESS',spent_amount:'0',observation:'Aucune dépense engagée'}});
});
const url='/custom/mjlfinancement/reports.php?report=portfolio';
function rows(bytes){const data=JSON.parse(cp.execFileSync('python3',['-c','import csv,json,sys; print(json.dumps(list(csv.reader(sys.stdin,delimiter=";"))))'],{input:bytes,encoding:'utf8'}));const i=data.findIndex(row=>row.includes('Activités')&&row.includes('Opérations'));return data.slice(i+1).filter(row=>row.length===data[i].length).map(row=>Object.fromEntries(data[i].map((name,k)=>[name,row[k]])));}
function scope(keys){return keys.map(key=>fixture.activities[key].activity_id).sort((a,b)=>a-b).join(',');}
test('portfolio defaults to one row per visible Project and retains every contributing Activity in evidence',async({page})=>{
 await login(page);await page.goto('/custom/mjlfinancement/reports.php');await page.getByRole('link',{name:'Portefeuille',exact:true}).click();await expect(page.getByRole('heading',{name:'Synthèse du portefeuille',exact:true})).toBeVisible();await expect(page.getByLabel('Regrouper par')).toHaveValue('project');
 const {bytes}=await download(page);const r=rows(bytes);expect(r).toHaveLength(2);expect(r.map(x=>x.Activités)).toEqual(['2','3']);expect(r[0]['Montants validés, annulations incluses (FCFA)']).toBe('18446744073709551614');expect(r[0]['Dépenses renseignées (FCFA)']).toBe('');expect(r[0]['Montants dépensés non renseignés']).toBe('2');expect(r[1]['Dépenses renseignées (FCFA)']).toBe('0');expect(r[1]['Propositions courantes non validées (FCFA)']).toBe('30');expect(r[1]['Propositions en brouillon ou retournées (FCFA)']).toBe('20');expect(r[1]['Propositions soumises ou prévalidées (FCFA)']).toBe('10');expect(evidence(bytes)).toBe(`portfolio|[${scope(['large1','large2','zero','proposal','draft'])}]|2`);
});
for(const format of ['CSV','XLSX','PDF']) test(`portfolio ${format} has one Partner row, exact total and no mixed subtotals`,async({page},testInfo)=>{
 await login(page);await page.goto(url);await page.getByLabel('Regrouper par').selectOption('partner');await page.getByRole('button',{name:'Appliquer les filtres'}).click();const {file,bytes}=await download(page,format);expect(file.suggestedFilename()).toMatch(/^mjl-synthese-portefeuille-.*\.(csv|xlsx|pdf)$/);expect(evidence(bytes)).toBe(`portfolio|[${scope(['large1','large2','zero','proposal','draft'])}]|1`);
 if(format==='CSV'){const r=rows(bytes);expect(r).toHaveLength(1);expect(r[0].Activités).toBe('5');expect(r[0].Opérations).toBe('5');expect(r[0]['Montants validés, annulations incluses (FCFA)']).toBe('18446744073709551714');expect(r[0]['Dépenses renseignées (FCFA)']).toBe('0');expect(r[0].Projet).toBeUndefined();}
 if(format==='PDF'){const text=cp.execFileSync('pdftotext',[await file.path(),'-'],{encoding:'utf8'});expect(text).toContain('18 446 744 073 709 551 714');expect(text).toContain('Par Partenaire');await file.saveAs(testInfo.outputPath('portfolio-report.pdf'));}
 if(format==='XLSX'){
 const data=JSON.parse(cp.execFileSync('python3',['-c',`import zipfile,xml.etree.ElementTree as E,json,sys
z=zipfile.ZipFile(sys.argv[1]);n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
s=[''.join(t.text or '' for t in x.findall('.//m:t',n)) for x in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',n)]
r=E.fromstring(z.read('xl/worksheets/sheet2.xml')).findall('.//m:sheetData/m:row',n)
def val(c):
 v=c.find('m:v',n);v=v.text if v is not None else None
 return s[int(v)] if c.get('t')=='s' and v is not None else v
h={''.join(filter(str.isalpha,c.get('r'))):val(c) for c in r[0]}
print(json.dumps({'rows':len(r)-1,'cells':{h[''.join(filter(str.isalpha,c.get('r')))]:[val(c),c.get('t','n')] for c in r[1]}}))`,await file.path()],{encoding:'utf8'}));expect(data.rows).toBe(1);expect(data.cells['Montants validés, annulations incluses (FCFA)']).toEqual(['18446744073709551714','s']);expect(data.cells.Activités).toEqual(['5','n']);expect(data.cells['Dépenses renseignées (FCFA)']).toEqual(['0','n']);
 }
});
test('portfolio filters complete Activities before grouping and preserves grouping in downloads and reset',async({page})=>{
 await login(page,'supervisor');await page.goto(url+'&q=Portefeuille%20&grouping=partner&validation_status=FINAL_VALIDATED');let r=rows((await download(page)).bytes);expect(r[0].Activités).toBe('4');expect(r[0]['Propositions courantes non validées (FCFA)']).toBe('');
 await page.getByLabel('Complétude des dépenses de l’Activité',{exact:true}).selectOption('COMPLETE');await page.getByRole('button',{name:'Appliquer les filtres'}).click();r=rows((await download(page)).bytes);expect(r).toHaveLength(1);expect(r[0].Activités).toBe('1');expect(r[0]['Montants validés, annulations incluses (FCFA)']).toBe('100');
 await page.getByRole('link',{name:'Réinitialiser',exact:true}).click();expect(new URL(page.url()).searchParams.get('report')).toBe('portfolio');await expect(page.getByLabel('Regrouper par')).toHaveValue('project');
});
test('portfolio denies Admin and roleless users and excludes foreign and unassigned Activities',async({page})=>{
 for(const key of ['admin','norole']){await login(page,key);expect((await page.goto(url)).status()).toBe(403);expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{report:'portfolio',format:'csv'}})).status()).toBe(403);}
 await login(page);await page.goto(url+'&activity_id='+fixture.activities.hidden.activity_id);expect(rows((await download(page)).bytes)).toHaveLength(0);
 await login(page,'validator');await page.goto(url+'&activity_id='+foreign.activities.zero.activity_id);const {bytes}=await download(page);expect(rows(bytes)).toHaveLength(0);expect(evidence(bytes)).toBe('portfolio|[]|0');
});
test('portfolio rejects unsupported grouping and child filters without export evidence',async({page})=>{
 await login(page);await page.goto(url);const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();const before=sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record');
 for(const filters of [{grouping:''},{grouping:'both'},{'grouping[]':'project'},{operation_status:'TODO'},{type_id:String(fixture.operationTypes.type)}]){
 expect((await page.goto(url+'&'+new URLSearchParams(filters))).status()).toBe(400);expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{report:'portfolio',format:'csv',token,...filters}})).status()).toBe(400);
 }expect(sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record')).toBe(before);
});
test('portfolio mobile grouping works without JavaScript and downloads are independent of preview page',async({browser},testInfo)=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 try{const page=await context.newPage();await login(page);await page.goto(url);await page.getByLabel('Regrouper par').selectOption('partner');await page.getByRole('button',{name:'Appliquer les filtres'}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.mouse.move(0,0);await page.screenshot({path:testInfo.outputPath('portfolio-mobile.png'),fullPage:true});await page.goto(url+'&grouping=partner&page=2');await expect(page.locator('article.mjl-activity-panel')).toHaveCount(0);expect(rows((await download(page)).bytes)).toHaveLength(1);}finally{await context.close();}
});
