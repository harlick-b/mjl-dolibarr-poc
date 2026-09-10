const {test,expect}=require('@playwright/test');
const cp=require('node:child_process');
const {createPhase3AFixtureSet,phase3ACommand}=require('../helpers/phase3a-fixture');
let fixture;
test.describe.configure({mode:'serial'});
async function login(page,key='agent') {
 await page.context().clearCookies(); await page.goto('/index.php');
 await page.getByLabel('Identifiant').fill(key==='admin'?'admin':fixture.users[key].login);
 await page.getByLabel('Mot de passe').fill(key==='admin'?(process.env.DOLI_ADMIN_PASSWORD||'Admin1234'):process.env.MJL_TEST_USER_PASSWORD);
 await page.getByRole('button',{name:'Connexion'}).click(); await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}
test.beforeAll(()=>{
 cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','install'],{env:process.env,stdio:'pipe'});
 fixture=createPhase3AFixtureSet({namespace:'phase3b.monitor',entity:1,
  users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'contributor',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'},{key:'norole',role:null}],
  references:{partners:[{key:'partner',label:'Partenaire suivi'}],projects:[{key:'project',label:'Projet suivi',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type suivi'}]},
  activities:[['owned','100'],['hidden','900']].map(([key,amount])=>({key,agentKey:key==='owned'?'agent':'other',partnerKey:'partner',projectKey:'project',name:'Suivi '+key,description:'Indicateurs du tableau de bord.',dateStart:'2026-09-05',dateEnd:'2032-09-30',authorizedAmount:amount,operations:[{name:'Opération '+key,typeKey:'type',authorizedAmount:amount}]}))});
});
test('Accueil leads with scoped financial indicators and distinguishes unknown spending',async({page})=>{
 await login(page); await page.goto('/custom/mjlfinancement/index.php');
 await expect(page.getByRole('heading',{name:'Situation financière',exact:true})).toBeVisible();
 const cards=page.locator('[aria-labelledby="mjl-financial-title"]');
 await expect(cards.locator('[data-metric="validated_amount"]')).toContainText('100 F CFA');
 await expect(cards.locator('[data-metric="total_spent_amount"]')).toContainText('Non renseigné');
 await expect(cards.locator('[data-metric="missing_spent_count"] .mjl-card-value')).toHaveText('1');
 await expect(page.locator('main')).not.toContainText('Suivi hidden');
});
test('business navigation agrees with direct guards and Admin remains technical',async({page})=>{
 for(const role of ['agent','supervisor','validator','admin','norole']) {
  await login(page,role); const response=await page.goto('/custom/mjlfinancement/index.php');
  if(role==='norole'){expect(response.status()).toBe(403);continue;}
  const nav=page.locator('#mjl-primary-navigation');
  for(const name of ['Alertes','Rapports','Demandes d’exception']) await expect(nav.getByRole('link',{name,exact:true})).toHaveCount(role==='admin'?0:1);
  await expect(nav.getByRole('link',{name:'Audit',exact:true})).toHaveCount(['admin','validator'].includes(role)?1:0);
  if(role==='admin') {await expect(page.getByRole('heading',{name:'Situation financière'})).toHaveCount(0);expect((await page.goto('/custom/mjlfinancement/alerts.php')).status()).toBe(403);}
  else {await page.goto('/custom/mjlfinancement/reports.php?report=portfolio');await expect(nav.getByRole('link',{name:'Rapports',exact:true})).toHaveAttribute('aria-current','page');}
 }
 await login(page,'validator');await page.goto('/custom/mjlfinancement/reports.php?report=audit');await expect(page.locator('#mjl-primary-navigation').getByRole('link',{name:'Audit',exact:true})).toHaveAttribute('aria-current','location');
 expect((await page.goto('/custom/mjlfinancement/dpafdashboard.php')).status()).toBe(403);
});
test('filtered browsing and report links preserve the complete parent selection',async({page})=>{
 await login(page); await page.goto('/custom/mjlfinancement/activities.php?q=Suivi&date_from=2032-09-30&date_to=2032-09-30');
 await expect(page.locator('[data-activity]')).toHaveCount(1); await expect(page.locator('[data-activity]')).toContainText('Suivi owned');
 const report=page.getByRole('link',{name:'Suivi des Activités et téléchargements'});
 expect(await report.getAttribute('href')).toContain('date_from=2032-09-30'); await report.click(); await expect(page.getByLabel('Période à partir du')).toHaveValue('2032-09-30');
 await page.goto('/custom/mjlfinancement/operations.php?activity_id='+fixture.activities.owned.activity_id+'&operation_status=TODO&type_id='+fixture.operationTypes.type);
 await expect(page.locator('.mjl-operation-card')).toHaveCount(1);await expect(page.locator('.mjl-operation-card')).toContainText('Projet suivi');await expect(page.locator('.mjl-operation-card')).toContainText('Montant autorisé validé');await expect(page.getByRole('link',{name:'Suivi des Opérations et téléchargements'})).toHaveAttribute('href',/operation_status=TODO/);
 await page.goto('/custom/mjlfinancement/index.php?q=absent');await expect(page.locator('[data-metric="validated_amount"]')).toContainText('Non renseigné');await expect(page.locator('[data-metric="missing_spent_count"] .mjl-card-value')).toHaveText('0');
 for(const suffix of ['q[]=x','page=0','date_from=2032-02-31','date_from=2032-09-30&date_to=2032-09-01','unexpected=x']) expect((await page.goto('/custom/mjlfinancement/alerts.php?'+suffix)).status()).toBe(400);
});
test('stale requests stay visible for closure without an approval control',async({page})=>{
 const a=fixture.activities.owned, o=a.operations[0];
 const r=phase3ACommand({entity:1,localDate:'2026-09-10',action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:o.rowid,expectedVersion:o.version,reason:'Demande de suivi'});expect(r.code).toBe('OK');
 const u=phase3ACommand({entity:1,localDate:'2026-09-10',action:'update',actorId:fixture.users.agent.id,activityId:a.activity_id,operationId:o.rowid,expectedVersion:o.version,input:{status:'IN_PROGRESS',spent_amount:'0',observation:'Aucune dépense'}});expect(u.code).toBe('OK');
 await login(page,'validator');await page.goto('/custom/mjlfinancement/index.php?q=Suivi');
 const item=page.locator('[data-work="CANCELLATION-'+r.request_id+'"]');await expect(item).toContainText('À clôturer');await item.getByRole('link',{name:'Ouvrir'}).click();
 await expect(page.locator('.mjl-operation-card')).toHaveCount(1);await expect(page.getByRole('button',{name:'Approuver',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Rejeter',exact:true})).toBeVisible();
 await login(page);await page.goto('/custom/mjlfinancement/operationrequests.php?type=CANCELLATION&request_id='+r.request_id);await page.getByRole('button',{name:'Retirer la demande',exact:true}).click();await expect(page.getByText('Décision enregistrée',{exact:true})).toBeVisible();
 await page.goto('/custom/mjlfinancement/index.php');await expect(page.locator('[data-metric="total_spent_amount"]')).toContainText('0 F CFA');await expect(page.locator('[data-metric="missing_spent_count"] .mjl-card-value')).toHaveText('0');
});
test('mobile monitoring works without JavaScript and with user contrast and motion preferences',async({browser},testInfo)=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},reducedMotion:'reduce',forcedColors:'active'});
 try {const page=await context.newPage();await login(page);await page.goto('/custom/mjlfinancement/index.php');
  await page.getByText('Filtrer la sélection',{exact:true}).click();await page.getByLabel('Recherche d’Activité',{exact:true}).fill('Suivi');await page.getByRole('button',{name:'Appliquer les filtres'}).click();
  await expect(page.getByRole('heading',{name:'Situation financière',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('dashboard-mobile-forced-colors.png'),fullPage:true});
  await page.getByRole('link',{name:/Voir toutes les alertes/}).click();await expect(page.getByRole('heading',{name:'Alertes',exact:true})).toBeVisible();
 }finally{await context.close();}
});
function sql(statement) {return cp.execFileSync('docker',['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','-N','-B','dolidb'],{env:process.env,encoding:'utf8',stdio:['pipe','pipe','pipe'],input:statement+'\n'}).trim();}
function createActivities(items) {return JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase2-fixture.php'],{env:process.env,encoding:'utf8',stdio:['pipe','pipe','pipe'],input:JSON.stringify({entity:1,activities:items.map(item=>({actorId:fixture.users.agent.id,partnerId:fixture.partners.partner,projectId:fixture.projects.project,description:'Suivi des échéances.',dateStart:'2032-09-05',dateEnd:'2032-09-30',authorizedAmount:'10',submit:true,operations:[{name:'Opération de suivi',typeId:fixture.operationTypes.type,authorizedAmount:'10'}],...item}))})}));}
test('workflow counts differ from permitted work and late review keeps correction frozen',async({page})=>{
 const created=createActivities([{key:'late',name:'Revue suivie tardive',dateStart:'2026-09-05'},{key:'future',name:'Revue suivie future'}]);
 await login(page,'supervisor');await page.goto('/custom/mjlfinancement/index.php?q=Revue%20suivie');
 await expect(page.locator('[aria-labelledby="mjl-workflow-title"]')).toContainText('Soumise : 2');await expect(page.locator('[data-work^="activity-"]')).toHaveCount(2);
 await page.locator('[data-work="activity-'+created.late.activity_id+'"]').getByRole('link',{name:'Ouvrir'}).click();
 await expect(page.getByRole('button',{name:'Prévalider',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Retourner en correction',exact:true})).toHaveCount(0);
 await page.goto('/custom/mjlfinancement/activities.php?id='+created.future.activity_id+'&action=review');await expect(page.getByRole('button',{name:'Retourner en correction',exact:true})).toBeVisible();
 await login(page,'validator');await page.goto('/custom/mjlfinancement/index.php?q=Revue%20suivie');await expect(page.locator('[aria-labelledby="mjl-workflow-title"]')).toContainText('Soumise : 2');await expect(page.locator('[data-work^="activity-"]')).toHaveCount(0);
});
test('a contributor who becomes Supervisor sees the stage count but cannot review their revision',async({page})=>{
 const activity=createActivities([{key:'contributor',name:'Contribution suivie',actorId:fixture.users.contributor.id}]).contributor;
 await login(page,'validator');await page.goto('/custom/mjlfinancement/activities.php?id='+activity.activity_id);
 const assignment=page.locator('form').filter({has:page.getByRole('button',{name:'Modifier l’affectation',exact:true})});
 await assignment.locator('[name="assignment_operation"]').selectOption('TRANSFER_PRIMARY');await assignment.locator('[name="target_agent_id"]').selectOption(String(fixture.users.agent.id));await assignment.getByLabel('Motif').fill('Relève avant changement de rôle');
 await assignment.getByRole('button',{name:'Modifier l’affectation',exact:true}).click();
 expect(sql('SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE entity=1 AND fk_user='+fixture.users.contributor.id+' AND date_end IS NULL')).toBe('0');
 sql("UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_VERIFICATEUR' WHERE entity=1 AND fk_user="+fixture.users.contributor.id+" AND is_active=1");
 try {
  await login(page,'contributor');await page.goto('/custom/mjlfinancement/index.php?activity_id='+activity.activity_id);
  await expect(page.locator('[aria-labelledby="mjl-workflow-title"]')).toContainText('Soumise : 1');await expect(page.locator('[data-work]')).toHaveCount(0);
  await page.goto('/custom/mjlfinancement/activities.php?id='+activity.activity_id+'&action=review');await expect(page.getByText('Décision indisponible',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Prévalider',exact:true})).toHaveCount(0);
 }finally{sql("UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_SAISIE' WHERE entity=1 AND fk_user="+fixture.users.contributor.id+" AND is_active=1");}
});
test('51-row browsing, queues and alerts keep stable order and preserve filters',async({page})=>{
 for(let start=0;start<51;start+=12) createActivities(Array.from({length:Math.min(12,51-start)},(_,i)=>({key:'p'+(start+i),name:'Pagination suivi '+String(start+i).padStart(2,'0'),dateStart:'2026-09-05'})));
 await login(page,'supervisor');
 for(const [route,selector,navName] of [['activities.php','[data-activity]','Pagination des Activités'],['index.php','[data-work]','Pagination des actions'],['alerts.php','[data-alert]','Pagination des alertes']]) {
  await page.goto('/custom/mjlfinancement/'+route+'?q=Pagination%20suivi&validation_status=SUBMITTED&project_id='+fixture.projects.project);
  await expect(page.locator(selector)).toHaveCount(50);const first=await page.locator(selector).allTextContents();
  await page.getByRole('navigation',{name:navName,exact:true}).getByRole('link',{name:'Suivant'}).click();await expect(page.locator(selector)).toHaveCount(1);
  const last=await page.locator(selector).textContent();expect(first).not.toContain(last);expect(new URL(page.url()).searchParams.get('q')).toBe('Pagination suivi');expect(new URL(page.url()).searchParams.get('validation_status')).toBe('SUBMITTED');
  await page.getByRole('navigation',{name:navName,exact:true}).getByRole('link',{name:'Précédent'}).click();expect(await page.locator(selector).allTextContents()).toEqual(first);
 }
});
test('reference filters retain inactive visible references and hide other entities',async({page})=>{
 const partnerLabel=sql('SELECT nom FROM llx_societe WHERE entity=1 AND rowid='+fixture.partners.partner);
 const projectLabel=sql('SELECT title FROM llx_projet WHERE entity=1 AND rowid='+fixture.projects.project);
 sql('UPDATE llx_societe SET status=0 WHERE rowid='+fixture.partners.partner+' AND entity=1');
 sql('UPDATE llx_projet SET fk_statut=0 WHERE rowid='+fixture.projects.project+' AND entity=1');
 try {
  await login(page);await page.goto('/custom/mjlfinancement/index.php');await page.getByText('Filtrer la sélection',{exact:true}).click();
  await expect(page.getByLabel('Partenaire',{exact:true}).locator('option[value="'+fixture.partners.partner+'"]')).toHaveText(partnerLabel);
  await expect(page.getByLabel('Projet',{exact:true}).locator('option[value="'+fixture.projects.project+'"]')).toHaveText(projectLabel);
  await page.getByLabel('Projet',{exact:true}).selectOption(String(fixture.projects.project));await page.getByRole('button',{name:'Appliquer les filtres'}).click();await expect(page.locator('[data-metric="validated_amount"]')).toContainText('100 F CFA');
 }finally{sql('UPDATE llx_societe SET status=1 WHERE rowid='+fixture.partners.partner+' AND entity=1');sql('UPDATE llx_projet SET fk_statut=1 WHERE rowid='+fixture.projects.project+' AND entity=1');}
});
test('source failure leaves financial data available and hides unverifiable action queues',async({page})=>{
 await login(page);await page.goto('/custom/mjlfinancement/index.php');
 const lock=cp.spawn('docker',['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','--unbuffered','-N','-B','dolidb'],{env:process.env,stdio:['pipe','pipe','pipe']});
 const ended=new Promise(resolve=>lock.once('close',resolve));
 const acquired=new Promise((resolve,reject)=>{let output='';lock.stdout.on('data',chunk=>{output+=chunk;if(output.includes('LOCKED'))resolve();});lock.once('error',reject);lock.once('close',code=>{if(!output.includes('LOCKED'))reject(new Error('Disposable lock failed: '+code));});});
 lock.stdin.end("LOCK TABLES llx_mjlfinancement_revision_contributor WRITE; SELECT 'LOCKED'; DO SLEEP(12); UNLOCK TABLES;\n");
 try {await acquired;await page.goto('/custom/mjlfinancement/index.php');await expect(page.getByText('Actions indisponibles',{exact:true})).toBeVisible();await expect(page.locator('[data-metric="validated_amount"]')).toContainText('100 F CFA');await expect(page.locator('[data-work]')).toHaveCount(0);await expect(page.locator('main')).not.toContainText('SELECT ');}finally{await ended;}
});
test('responsive navigation has one main landmark, current location and keyboard escape',async({browser},testInfo)=>{
 for(const width of [390,768,980,1024,1366]) {
  const context=await browser.newContext({viewport:{width,height:900}});
  try {const page=await context.newPage();await login(page);await page.goto('/custom/mjlfinancement/index.php?q=Suivi');await expect(page.getByRole('main')).toHaveCount(1);
   const trigger=page.getByRole('button',{name:'Ouvrir le menu principal',exact:true});
   if(await trigger.isVisible()){await trigger.focus();await page.keyboard.press('Enter');await expect(trigger).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');await expect(trigger).toHaveAttribute('aria-expanded','false');await expect(trigger).toBeFocused();}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('dashboard-'+width+'.png'),fullPage:true});
  }finally{await context.close();}
 }
});
test('general and request filters remain composed in both forms',async({page})=>{
 await login(page);await page.goto('/custom/mjlfinancement/operationrequests.php?type=CANCELLATION&status=WITHDRAWN');
 await page.getByText('Filtrer la sélection',{exact:true}).click();await page.getByLabel('Projet',{exact:true}).selectOption(String(fixture.projects.project));await page.getByRole('button',{name:'Appliquer les filtres'}).click();
 expect(new URL(page.url()).searchParams.get('status')).toBe('WITHDRAWN');expect(new URL(page.url()).searchParams.get('type')).toBe('CANCELLATION');await expect(page.locator('.mjl-operation-card')).toHaveCount(1);
 await page.getByRole('combobox',{name:'Type',exact:true}).selectOption('');await page.getByRole('button',{name:'Filtrer les demandes'}).click();expect(new URL(page.url()).searchParams.get('project_id')).toBe(String(fixture.projects.project));
});
test('past drafts retain abandonment, proposals stay explicit and future finalized work remains actionable',async({page})=>{
 const drafts=createActivities([{key:'past',name:'Brouillon périmé suivi',dateStart:'2026-09-05',submit:false},{key:'future',name:'Brouillon futur suivi',submit:false}]);
 await login(page);await page.goto('/custom/mjlfinancement/activities.php?id='+drafts.past.activity_id);await expect(page.getByRole('button',{name:'Abandonner le brouillon'})).toBeVisible();await expect(page.getByRole('button',{name:'Soumettre la révision'})).toHaveCount(0);await expect(page.getByRole('link',{name:'Modifier',exact:true})).toHaveCount(0);await expect(page.locator('main')).toContainText('Montant proposé courant');
 await page.goto('/custom/mjlfinancement/operations.php?activity_id='+drafts.future.activity_id);await expect(page.locator('.mjl-operation-card')).toContainText('Montant proposé');
 const future=createPhase3AFixtureSet({namespace:'phase3b.future',entity:1,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'p',label:'Partenaire futur'}],projects:[{key:'project',label:'Projet futur',partnerKey:'p'}],operationTypes:[{key:'t',label:'Type futur'}]},activities:[{key:'f',agentKey:'agent',partnerKey:'p',projectKey:'project',name:'Activité future validée',description:'Exécution permise après validation.',dateStart:'2032-09-05',dateEnd:'2032-09-30',authorizedAmount:'10',operations:[{name:'Opération future',typeKey:'t',authorizedAmount:'10'}]}]});
 const original=fixture;fixture=future;
 try {await login(page);await page.goto('/custom/mjlfinancement/index.php');await expect(page.locator('[data-work^="operation-"]')).toHaveCount(1);await expect(page.locator('[data-alert="SPENDING_MISSING"]')).toHaveCount(0);}finally{fixture=original;}
});
test('foreign selections and revoked current assignments reveal no business data',async({page})=>{
 const foreign=createPhase3AFixtureSet({namespace:'phase3b.monitor-ext',entity:2,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'p',label:'Partenaire étranger suivi'}],projects:[{key:'project',label:'Projet étranger suivi',partnerKey:'p'}],operationTypes:[{key:'t',label:'Type étranger suivi'}]},activities:[{key:'f',agentKey:'agent',partnerKey:'p',projectKey:'project',name:'Activité étrangère suivie',description:'Isolation.',dateStart:'2026-09-05',dateEnd:'2032-09-30',authorizedAmount:'10',operations:[{name:'Opération étrangère suivie',typeKey:'t',authorizedAmount:'10'}]}]});
 for(const role of ['agent','supervisor','validator']) {await login(page,role);for(const route of ['index.php','alerts.php','activities.php','operations.php']){await page.goto('/custom/mjlfinancement/'+route+'?activity_id='+foreign.activities.f.activity_id);await expect(page.locator('main')).not.toContainText('Activité étrangère suivie');await expect(page.locator('[data-work],[data-alert],[data-activity],.mjl-operation-card')).toHaveCount(0);}}
 const a=createActivities([{key:'revoke',name:'Suivi retrait immédiat',actorId:fixture.users.other.id,additionalAgentIds:[fixture.users.agent.id],assignmentActorId:fixture.users.validator.id}]).revoke;
 await login(page);await page.goto('/custom/mjlfinancement/activities.php?activity_id='+a.activity_id);await expect(page.locator('[data-activity]')).toHaveCount(1);
 const removed=JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-report-fixture.php','remove'],{env:process.env,encoding:'utf8',stdio:['pipe','pipe','pipe'],input:JSON.stringify({actorId:fixture.users.validator.id,activityId:a.activity_id,targetId:fixture.users.agent.id})+'\n'}));expect(removed.code).toBe('OK');
 for(const route of ['index.php','alerts.php','activities.php','operations.php','operationrequests.php']){await page.goto('/custom/mjlfinancement/'+route+'?activity_id='+a.activity_id);await expect(page.locator('[data-work],[data-alert],[data-activity],.mjl-operation-card')).toHaveCount(0);await expect(page.locator('main')).not.toContainText('Suivi retrait immédiat');}
 expect((await page.goto('/custom/mjlfinancement/activities.php?id='+a.activity_id)).status()).toBe(403);
});
test('predecessor hides new navigation and malformed target fails without fabricated metrics',async({page})=>{
 await login(page);
 sql('RENAME TABLE llx_mjlfinancement_export_record TO llx_mjlfinancement_export_record_monitor_test');
 try {await page.goto('/custom/mjlfinancement/index.php');await expect(page.getByRole('heading',{name:'Situation financière'})).toHaveCount(0);await expect(page.locator('#mjl-primary-navigation').getByRole('link',{name:'Alertes',exact:true})).toHaveCount(0);expect((await page.goto('/custom/mjlfinancement/alerts.php')).status()).toBe(403);}finally{sql('RENAME TABLE llx_mjlfinancement_export_record_monitor_test TO llx_mjlfinancement_export_record');}
 sql('ALTER TABLE llx_mjlfinancement_export_record ADD COLUMN monitoring_probe INT NULL');
 try {expect((await page.goto('/custom/mjlfinancement/index.php')).status()).toBe(503);await expect(page.getByText('Suivi indisponible',{exact:true})).toBeVisible();await expect(page.locator('[data-metric]')).toHaveCount(0);}finally{sql('ALTER TABLE llx_mjlfinancement_export_record DROP COLUMN monitoring_probe');}
 await page.goto('/custom/mjlfinancement/index.php');await expect(page.getByRole('heading',{name:'Situation financière'})).toBeVisible();
});
