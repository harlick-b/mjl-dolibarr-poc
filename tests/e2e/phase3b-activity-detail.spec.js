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
 const specification=(namespace,entity)=>({namespace,entity,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'},{key:'norole',role:null}],references:{partners:[{key:'partner',label:'Partenaire Fiche'}],projects:[{key:'project',label:'Projet Fiche',partnerKey:'partner'}],operationTypes:[{key:'known',label:'Type courant'},{key:'missing',label:'Type complémentaire'}]},activities:[{key:'mixed',agentKey:'agent',partnerKey:'partner',projectKey:'project',name:'Activité complète pour la fiche',description:'Description détaillée\n<script>texte non exécutable</script>',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'100',operations:[{name:'Dépense explicitement nulle',typeKey:'known',authorizedAmount:'40'},{name:'Dépense non renseignée',typeKey:'missing',authorizedAmount:'60'}]},{key:'proposal',agentKey:'agent',partnerKey:'partner',projectKey:'project',name:'Proposition pour la fiche',description:'Proposition encore soumise.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'10',finalize:false,operations:[{name:'Opération proposée',typeKey:'known',authorizedAmount:'10'}]}]});
 fixture=createPhase3AFixtureSet(specification('phase3b.detail',1));foreign=createPhase3AFixtureSet(specification('phase3b.detail-foreign',2));
 const a=fixture.activities.mixed;command({action:'update',actorId:fixture.users.agent.id,activityId:a.activity_id,operationId:a.operations[0].rowid,expectedVersion:a.operations[0].version,input:{status:'IN_PROGRESS',spent_amount:'0',observation:'=SUM(1,2)\nAucune dépense engagée'}});
});
const detailUrl=key=>`/custom/mjlfinancement/reports.php?report=activity_detail&activity_id=${fixture.activities[key].activity_id}`;
function csvSections(bytes){const rows=JSON.parse(cp.execFileSync('python3',['-c','import csv,json,sys; print(json.dumps(list(csv.reader(sys.stdin,delimiter=";"))))'],{input:bytes,encoding:'utf8'}));return ['Informations générales et affectations','Synthèse financière','Opérations courantes complètes'].map(title=>{const i=rows.findIndex(row=>row.length===1&&row[0]===title);expect(i).toBeGreaterThan(-1);const headers=rows[i+1],values=[];for(let j=i+2;j<rows.length&&rows[j].length===headers.length;j++)values.push(Object.fromEntries(headers.map((h,k)=>[h,rows[j][k]])));return values;});}
test('Fiche contextual entry shows complete information, assignments and all Operations',async({page})=>{
 await login(page);await page.goto(`/custom/mjlfinancement/activities.php?id=${fixture.activities.mixed.activity_id}`);await page.getByRole('link',{name:'Fiche Activité et téléchargements',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Fiche Activité',exact:true})).toBeVisible();await expect(page.getByText('Dépense explicitement nulle',{exact:true})).toBeVisible();await expect(page.getByText('Dépense non renseignée',{exact:true})).toBeVisible();await expect(page.getByText('Description détaillée\n<script>texte non exécutable</script>',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Appliquer les filtres'})).toHaveCount(0);await page.getByRole('link',{name:'Retour à l’Activité'}).click();await expect(page).toHaveURL(new RegExp(`activities.php\\?id=${fixture.activities.mixed.activity_id}$`));
});
for(const format of ['CSV','XLSX','PDF']) test(`Fiche ${format} contains all three sections and one-Activity audit evidence`,async({page},testInfo)=>{
 await login(page);await page.goto(detailUrl('mixed'));const {file,bytes}=await download(page,format);expect(file.suggestedFilename()).toMatch(/^mjl-fiche-activite-.*\.(csv|xlsx|pdf)$/);expect(evidence(bytes)).toBe(`activity_detail|[${fixture.activities.mixed.activity_id}]|4`);
 if(format==='CSV'){
 const [general,summary,operations]=csvSections(bytes);expect(general).toHaveLength(1);expect(general[0]['Révision courante']).toBe('1');expect(general[0]['Identifiant de la révision courante']).toBe(String(fixture.activities.mixed.revision_id));expect(general[0]['Agents affectés']).toContain('(principal)');expect(general[0].Description).toContain('<script>texte non exécutable</script>');expect(summary[0]['Montants validés, annulations incluses (FCFA)']).toBe('100');expect(summary[0]['Dépenses renseignées (FCFA)']).toBe('0');expect(summary[0]['Montants dépensés non renseignés']).toBe('1');expect(operations).toHaveLength(2);expect(operations.map(r=>r['Montant dépensé (FCFA)'])).toEqual(['0','']);expect(operations[0].Observation).toBe("'=SUM(1,2)\nAucune dépense engagée");
 }
 if(format==='PDF'){const text=cp.execFileSync('pdftotext',[await file.path(),'-'],{encoding:'utf8'});for(const phrase of ['Synthèse financière','Opérations courantes complètes','Dépense explicitement nulle','Dépense non renseignée','Description détaillée','Révision courante'])expect(text).toContain(phrase);await file.saveAs(testInfo.outputPath('activity-detail.pdf'));}
 if(format==='XLSX'){
 const data=JSON.parse(cp.execFileSync('python3',['-c',`import zipfile,xml.etree.ElementTree as E,json,sys
z=zipfile.ZipFile(sys.argv[1]);n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
shared=[''.join(t.text or '' for t in s.findall('.//m:t',n)) for s in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',n)]
def rows(i):
 result=[]
 for r in E.fromstring(z.read('xl/worksheets/sheet%d.xml'%i)).findall('.//m:sheetData/m:row',n):
  vals={}
  for c in r:
   v=c.find('m:v',n);v=v.text if v is not None else None
   vals[''.join(filter(str.isalpha,c.get('r')))]=[shared[int(v)] if c.get('t')=='s' and v is not None else v,c.get('t','n'),c.find('m:f',n) is not None]
  result.append(vals)
 return result
print(json.dumps({'sheets':len(E.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',n)),'general':rows(2),'money':rows(3),'ops':rows(4)}))`,await file.path()],{encoding:'utf8'}));
 expect(data.sheets).toBe(4);expect(data.general).toHaveLength(2);expect(data.money).toHaveLength(2);expect(data.ops).toHaveLength(3);expect(data.ops[1].J).toEqual(['0','n',false]);expect(data.ops[2].J?.[0]??null).toBeNull();expect(data.ops[1].K).toEqual(['=SUM(1,2)\nAucune dépense engagée','s',false]);
 }
});
test('Fiche proposal keeps pending and validated amounts distinct',async({page})=>{
 await login(page,'supervisor');await page.goto(detailUrl('proposal'));const [general,money,ops]=csvSections((await download(page)).bytes);expect(general[0]['Révision courante']).toBe('1');expect(money[0]['Propositions courantes non validées (FCFA)']).toBe('10');expect(money[0]['Montants validés, annulations incluses (FCFA)']).toBe('');expect(ops[0]['Nature du montant autorisé']).toBe('Proposée');
});
test('Fiche rejects missing selection and child filtering on GET and POST without evidence',async({page})=>{
 await login(page);await page.goto(detailUrl('mixed'));const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();const before=sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record');
 for(const filters of [{},{activity_id:String(fixture.activities.mixed.activity_id),type_id:String(fixture.operationTypes.known)},{activity_id:String(fixture.activities.mixed.activity_id),operation_status:'IN_PROGRESS'},{'activity_id[]':'1'}]){
 expect((await page.goto('/custom/mjlfinancement/reports.php?'+new URLSearchParams({report:'activity_detail',...filters}))).status()).toBe(400);
 expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{report:'activity_detail',format:'csv',token,...filters}})).status()).toBe(400);
 }
 expect(sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record')).toBe(before);
});
test('Fiche denies unassigned, foreign, absent, Admin and roleless scope without generating evidence',async({page})=>{
 const before=sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record');
 for(const key of ['other','supervisor','admin','norole']){
 await login(page,key);const id=key==='supervisor'?foreign.activities.mixed.activity_id:fixture.activities.mixed.activity_id;
 let token='';if(key==='other'||key==='supervisor'){await page.goto('/custom/mjlfinancement/reports.php');token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();}
 expect((await page.goto(`/custom/mjlfinancement/reports.php?report=activity_detail&activity_id=${id}`)).status()).toBe(403);await expect(page.getByRole('button',{name:'Télécharger CSV'})).toHaveCount(0);
 expect((await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{report:'activity_detail',activity_id:String(id),format:'csv',token}})).status()).toBe(403);
 }
 await login(page,'validator');expect((await page.goto('/custom/mjlfinancement/reports.php?report=activity_detail&activity_id=2147483647')).status()).toBe(403);expect(sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record')).toBe(before);
});
test('Fiche stays complete and usable on mobile without JavaScript',async({browser},testInfo)=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 try {const page=await context.newPage();await login(page,'validator');await page.goto(detailUrl('mixed'));await expect(page.getByText('Dépense non renseignée',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.mouse.move(0,0);await page.screenshot({path:testInfo.outputPath('activity-detail-mobile.png'),fullPage:true});expect(csvSections((await download(page)).bytes)[2]).toHaveLength(2);}finally{await context.close();}
});
