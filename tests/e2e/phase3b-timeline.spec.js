const {test,expect}=require('@playwright/test');
const cp=require('node:child_process');
const {createPhase3AFixtureSet,phase3ACommand}=require('../helpers/phase3a-fixture');
let fixture,foreign,probes;
test.describe.configure({mode:'serial'});
function sql(statement){return cp.execFileSync('docker',['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','-N','-B','dolidb'],{env:process.env,encoding:'utf8',input:statement+'\n',stdio:['pipe','pipe','pipe']}).trim();}
function command(request){const r=phase3ACommand({entity:1,localDate:'2026-09-10',...request});expect(r.code).toBe('OK');return r;}
function version(table,id){return sql(`SELECT version FROM llx_mjlfinancement_${table} WHERE rowid=${id}`);}
function probe(action){return JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php',action],{env:process.env,encoding:'utf8',stdio:['pipe','pipe','pipe'],input:JSON.stringify({actorId:fixture.users.validator.id,activityId:fixture.activities.main.activity_id})+'\n'}));}
async function login(page,key='agent'){await page.goto('/index.php');await page.getByLabel('Identifiant').fill(key==='admin'?'admin':fixture.users[key].login);await page.getByLabel('Mot de passe').fill(key==='admin'?(process.env.DOLI_ADMIN_PASSWORD||'Admin1234'):process.env.MJL_TEST_USER_PASSWORD);await page.getByRole('button',{name:'Connexion'}).click();await expect(page.getByLabel('Identifiant')).toHaveCount(0);}
function url(id=fixture.activities.main.activity_id){return '/custom/mjlfinancement/activities.php?id='+id;}
const timeline=page=>page.locator('section[aria-labelledby="mjl-activity-chronology"]');
test.beforeAll(()=>{
 cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','install'],{env:process.env,stdio:'pipe'});
 const spec=(namespace,entity)=>({namespace,entity,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'},{key:'norole',role:null}],references:{partners:[{key:'partner',label:'Partenaire chronologie'}],projects:[{key:'project',label:'Projet chronologie',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type chronologie'}]},activities:['main','other'].map(key=>({key,agentKey:key==='main'?'agent':'other',partnerKey:'partner',projectKey:'project',name:'Chronologie '+key,description:'Historique contextualisé.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'100',operations:[{name:'Opération historique',typeKey:'type',authorizedAmount:'100'}]}))});
 fixture=createPhase3AFixtureSet(spec('phase3b.timeline',1));foreign=createPhase3AFixtureSet(spec('phase3b.timeline-ext',2));
 const a=fixture.activities.main,o=a.operations[0];
 command({action:'update',actorId:fixture.users.agent.id,activityId:a.activity_id,operationId:o.rowid,expectedVersion:version('operation',o.rowid),input:{status:'IN_PROGRESS',spent_amount:'0',observation:'Première ligne\nDeuxième ligne {"password":"PRIVATE CHRONOLOGY VALUE"}'}});
 const r=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:o.rowid,expectedVersion:version('operation',o.rowid),reason:'Motif chronologique'});
 command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:r.request_id,expectedVersion:r.request_version,decision:'REJECTED',reason:'Poursuite de l’exécution'});
});
test('ordinary chronology explains native execution and request changes without audit payloads',async({page})=>{
 await login(page);await page.goto(url());const t=timeline(page);await expect(t).toContainText('Exécution de l’Opération modifiée');await expect(t).toContainText('Montant dépensé : Non renseigné → 0 F CFA');await expect(t).toContainText('À faire → En cours');await expect(t).toContainText('Demande d’annulation rejetée');await expect(t).toContainText('Poursuite de l’exécution');expect(await t.innerText()).toContain('Première ligne\nDeuxième ligne');expect(await t.innerText()).not.toMatch(/PRIVATE CHRONOLOGY VALUE|target_operation_set_hash|previous_values_json|content_sha256/);
});
test('only genuinely single-Activity business exports appear in ordinary chronology',async({page})=>{
 await login(page,'validator');
 for(const query of ['report=activity_detail&activity_id='+fixture.activities.main.activity_id,'report=portfolio&q=Chronologie','report=audit&activity_id='+fixture.activities.main.activity_id]){
  await page.goto('/custom/mjlfinancement/reports.php?'+query);const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger CSV',exact:true}).click();await pending;
 }
 await page.goto(url());const t=timeline(page);await expect(t.getByText('Rapport généré',{exact:true})).toHaveCount(1);await expect(t).toContainText('Fiche Activité · CSV');await expect(t).not.toContainText('Synthèse du portefeuille');await expect(t).not.toContainText('Journal d’audit');
});
test('chronology cursor covers every event once, including equal timestamps and a newly appended event',async({page})=>{
 probes=probe('audit-fixtures');await login(page,'supervisor');await page.goto(url());await expect(timeline(page).locator('li[data-event-id]')).toHaveCount(50);
 const seen=await timeline(page).locator('li[data-event-id]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.eventId)));
 const a=fixture.activities.main,o=a.operations[0];command({action:'update',actorId:fixture.users.agent.id,activityId:a.activity_id,operationId:o.rowid,expectedVersion:version('operation',o.rowid),input:{status:'IN_PROGRESS',spent_amount:'1',observation:'Événement ajouté entre les pages'}});
 await page.getByRole('navigation',{name:'Pagination de la chronologie'}).getByRole('link',{name:'Suivant'}).click();
 const remaining=await timeline(page).locator('li[data-event-id]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.eventId)));
 expect(new Set([...seen,...remaining]).size).toBe(seen.length+remaining.length);for(const id of probes)expect([...seen,...remaining]).toContain(id);await expect(timeline(page)).toContainText('Événement ajouté entre les pages');
 await page.getByRole('link',{name:'Première page',exact:true}).click();await expect(timeline(page).locator('li[data-event-id]')).toHaveCount(50);
});
test('review chronology preserves its route and rejects malformed or foreign cursor anchors',async({page})=>{
 await login(page,'supervisor');await page.goto(url()+'&action=review');await page.getByRole('navigation',{name:'Pagination de la chronologie'}).getByRole('link',{name:'Suivant'}).click();expect(new URL(page.url()).searchParams.get('action')).toBe('review');
 for(const suffix of ['chronology_cursor[]=1','chronology_cursor=0','chronology_cursor=9223372036854775808','chronology_cursor='])expect((await page.goto(url()+'&'+suffix)).status()).toBe(400);
 const foreignEvent=sql(`SELECT MIN(rowid) FROM llx_mjlfinancement_audit_event WHERE activity_id=${foreign.activities.main.activity_id} AND entity=2`);await page.goto(url()+'&chronology_cursor='+foreignEvent);await expect(timeline(page)).toContainText('temporairement indisponible');await expect(timeline(page).locator('li[data-event-id]')).toHaveCount(0);
});
test('chronology stays available without JavaScript on mobile',async({browser},testInfo)=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});try{const page=await context.newPage();await login(page);await page.goto(url());await page.getByRole('navigation',{name:'Pagination de la chronologie'}).getByRole('link',{name:'Suivant'}).click();await expect(timeline(page)).toContainText('Événement ajouté entre les pages');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await timeline(page).screenshot({path:testInfo.outputPath('chronology-mobile.png')});}finally{await context.close();}
});
test('Admin, roleless and unassigned actors cannot use detail or review chronology',async({browser})=>{
 for(const role of ['admin','norole','other']){const context=await browser.newContext();try{const page=await context.newPage();await login(page,role);for(const suffix of ['','&action=review','&chronology_cursor='+probes[0]])expect((await page.goto(url()+suffix)).status()).toBe(403);}finally{await context.close();}}
});
test('unknown, malformed and oversized events show unavailable details while automatic causes stay readable',async({page})=>{
 const ids=probe('chronology-fixtures');await login(page,'validator');await page.goto(url()+'&chronology_cursor='+probes[56]);const t=timeline(page);await expect(t).toContainText('À venir → En retard');await expect(t).toContainText('automatiquement');for(const id of ids.slice(1))await expect(t.locator('li[data-event-id="'+id+'"]')).toContainText('Détails indisponibles.');expect(await t.innerText()).not.toContain('PRIVATE MALFORMED');
});
test('native Activity cancellation identifies ended assignments and immediately revokes Agent chronology access',async({page})=>{
 const a=fixture.activities.main;const r=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'ACTIVITY',targetId:a.activity_id,expectedVersion:version('activity',a.activity_id),reason:'Annulation de clôture'});command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:r.request_id,expectedVersion:r.request_version,decision:'APPROVED',reason:'Clôture autorisée'});
 await login(page,'supervisor');await page.goto(url()+'&chronology_cursor='+probes[56]);await expect(timeline(page)).toContainText('Affectation active → Affectation terminée');await expect(timeline(page)).toContainText('Agent n° '+fixture.users.agent.id);
 await page.context().clearCookies();await login(page);expect((await page.goto(url()+'&chronology_cursor='+probes[56])).status()).toBe(403);
});
