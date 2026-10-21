const {test,expect}=require('@playwright/test');
const cp=require('node:child_process');
const {createExecutionFixtureSet}=require('../helpers/execution-fixture');
const {composeExec,sql,registerSecret}=require('../helpers/mjl-test-runtime');
const root='/custom/mjlfinancement/api/index.php/v1';
let fixture,foreign,auditIds,auditBudgetIds,auditInvalidIds;
async function send(request,path,body,method='POST'){
 const session=(await(await request.get(root+'/auth/session')).json()).data;
 return request.fetch(root+path,{method,data:body,headers:{'X-CSRF-Token':session.csrf_token}});
}
async function login(request,key){
 const admin=key==='admin';expect((await send(request,'/auth/login',{email:admin?'reporting.admin@example.test':fixture.users[key].login+'@example.test',password:admin?(process.env.DOLI_ADMIN_PASSWORD||'Admin1234'):process.env.MJL_TEST_USER_PASSWORD})).status()).toBe(202);
 const code=JSON.parse(composeExec('dolibarr',['cat','/var/www/documents/mjlfinancement/email-test-outbox/latest-login_otp.json'],'utf8')).code;
 await registerSecret('login otp',code);expect((await send(request,'/auth/otp/verify',{code})).status()).toBe(200);
}
test.beforeAll(()=>{
 const definition=(namespace,entity)=>({namespace,entity,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'},{key:'norole',role:null}],references:{partners:[{key:'p',label:'Partenaire rapports REST'}],projects:[{key:'project',label:'Projet rapports REST',partnerKey:'p'}],operationTypes:[{key:'t',label:'Type rapports REST'}]},activities:[{key:'a',agentKey:'agent',partnerKey:'p',projectKey:'project',name:'Rapports REST',description:'Vérification des projections',dateStart:'2026-09-05',dateEnd:'2032-09-30',authorizedAmount:'100',operations:[{name:'Opération rapports REST',typeKey:'t',authorizedAmount:'100'}]},{key:'hidden',agentKey:'other',partnerKey:'p',projectKey:'project',name:'Rapport non affecté',description:'Isolation par affectation',dateStart:'2026-09-05',dateEnd:'2032-09-30',authorizedAmount:'50',operations:[{name:'Opération non affectée',typeKey:'t',authorizedAmount:'50'}]}]});
 const suffix=Date.now().toString(36);fixture=createExecutionFixtureSet(definition('apireport.'+suffix,1));foreign=createExecutionFixtureSet(definition('ar2.'+suffix,2));
 sql("DELETE FROM llx_mjlfinancement_audit_event WHERE entity=1 AND (object_ref LIKE 'AUDIT-PROBE-%' OR object_ref LIKE 'AUDIT-BUDGET-%' OR object_ref LIKE 'AUDIT-INVALID-%')");
 auditIds=JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/report-fixture.php','audit-fixtures'],{env:process.env,encoding:'utf8',input:JSON.stringify({actorId:fixture.users.validator.id,activityId:fixture.activities.a.activity_id})+'\n'}));
 auditBudgetIds=JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/report-fixture.php','audit-budget'],{env:process.env,encoding:'utf8',input:JSON.stringify({actorId:fixture.users.validator.id,activityId:fixture.activities.a.activity_id})+'\n'}));
 auditInvalidIds=JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/report-fixture.php','audit-invalid'],{env:process.env,encoding:'utf8',input:JSON.stringify({actorId:fixture.users.validator.id,activityId:fixture.activities.a.activity_id})+'\n'}));
 sql("UPDATE llx_user SET email='reporting.admin@example.test' WHERE entity=0 AND admin=1");
 sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_OTP_ENABLED',1,'1','chaine',0,'Disposable API verification'),('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'Disposable API verification') ON DUPLICATE KEY UPDATE value='1'");
});
test.afterAll(()=>sql("DELETE FROM llx_const WHERE name IN ('MJL_AUTH_OTP_ENABLED','MJL_AUTH_E2E_EXPOSE_TOKENS') AND entity=1"));

test('Reporting REST serves scoped dashboard previews audit and audited downloads',async({page,browser})=>{
 await login(page.request,'agent');
 const dashboard=await page.request.get(root+'/dashboard?q=Rapports%20REST');expect(dashboard.status(),await dashboard.text()).toBe(200);const d=(await dashboard.json()).data;expect(d.financial.activity_count).toBe(1);expect(d.work_count).not.toBeNull();expect(d.alert_count).toBeGreaterThanOrEqual(0);
 for(const path of ['/reports/activities?q=Rapports%20REST','/reports/operations?q=Rapports%20REST','/reports/activity_detail?activity_id='+fixture.activities.a.activity_id,'/reports/portfolio?q=Rapports%20REST']){const preview=await page.request.get(root+path);const body=await preview.json();expect(preview.status(),JSON.stringify(body)).toBe(200);expect(body.data.sections.length).toBeGreaterThan(0);}
 const business={activities:{q:'Rapports REST'},operations:{q:'Rapports REST'},activity_detail:{activity_id:String(fixture.activities.a.activity_id)},portfolio:{q:'Rapports REST'}};
 for(const [type,filters] of Object.entries(business))for(const format of ['pdf','xlsx','csv']){const exported=await send(page.request,'/reports/'+type+'/exports',{format,filters});expect(exported.status(),await exported.text()).toBe(200);expect(exported.headers()['content-disposition']).toContain('attachment; filename="mjl-');expect((await exported.body()).length).toBeGreaterThan(100);}
 await page.goto('/custom/mjlfinancement/index.php?q=Rapports%20REST');await expect(page.getByRole('heading',{name:'Tableau de bord'})).toBeVisible();await expect(page.getByRole('heading',{name:'Situation financière'})).toBeVisible();
 await expect(page.locator('[data-work]').first().getByRole('link',{name:'Ouvrir'})).toHaveAttribute('href',/operations\.php|activities\.php/);
 await expect(page.getByRole('heading',{name:'Avancement des Activités'})).toBeVisible();await expect(page.getByRole('heading',{name:'Étapes de validation'})).toBeVisible();await expect(page.locator('[data-dashboard-kpi="scope"] a')).toHaveAttribute('href',/q=Rapports/);
 await page.goto('/custom/mjlfinancement/reports.php?report=portfolio&q=Rapports%20REST');await expect(page.getByLabel('Regroupement')).toHaveValue('project');await expect(page.getByText('Lecture de la synthèse')).toBeVisible();
 await page.goto('/custom/mjlfinancement/reports.php?report=activity_detail&activity_id='+fixture.activities.a.activity_id);await expect(page.getByRole('link',{name:'Retour à l’Activité'})).toHaveAttribute('href',new RegExp('id='+fixture.activities.a.activity_id));
 const validator=await browser.newContext();try{await login(validator.request,'validator');const audit=await validator.request.get(root+'/audit-events');expect(audit.status(),await audit.text()).toBe(200);expect((await audit.json()).data.some(event=>event.action==='EXPORT_GENERATED')).toBe(true);for(const format of ['pdf','xlsx','csv']){const exported=await send(validator.request,'/reports/audit/exports',{format,filters:{audit_action:'EXPORT_GENERATED'}});expect(exported.status(),await exported.text()).toBe(200);expect((await exported.body()).length).toBeGreaterThan(100);}const auditPage=await validator.newPage();await auditPage.goto('/custom/mjlfinancement/workflowactions.php?audit_action=EXPORT_GENERATED');const firstEvent=auditPage.locator('[data-audit-event-id]').first();await expect(firstEvent).toBeVisible();await expect(firstEvent.getByText('Date et heure',{exact:true})).toBeVisible();await expect(firstEvent.getByText('Type d’objet',{exact:true})).toBeVisible();await expect(firstEvent.locator('time')).toHaveAttribute('datetime',/T\d{2}:\d{2}:\d{2}/);await firstEvent.getByText('Champs et valeurs enregistrés').click();await expect(firstEvent.getByText('Chemin du champ',{exact:true}).first()).toBeVisible();await expect(firstEvent.getByText('Type avant',{exact:true}).first()).toBeVisible();}finally{await validator.close();}
});

test('Reporting REST denies Agent audit access and invalid export CSRF',async({request})=>{
 await login(request,'agent');expect((await request.get(root+'/audit-events')).status()).toBe(403);
 expect((await request.post(root+'/reports/activities/exports',{data:{format:'csv',filters:{}},headers:{'X-CSRF-Token':'invalid'}})).status()).toBe(403);
});

test('Reporting REST enforces role, assignment and entity boundaries',async({browser})=>{
 const roleless=await browser.newContext();try{expect((await send(roleless.request,'/auth/login',{email:fixture.users.norole.login+'@example.test',password:process.env.MJL_TEST_USER_PASSWORD})).status()).toBe(401);}finally{await roleless.close();}
 const admin=await browser.newContext();try{await login(admin.request,'admin');expect((await admin.request.get(root+'/reports/activities')).status()).toBe(403);}finally{await admin.close();}
 const agent=await browser.newContext();try{await login(agent.request,'agent');expect((await agent.request.get(root+'/reports/activity_detail?activity_id='+fixture.activities.hidden.activity_id)).status()).toBe(404);expect((await agent.request.get(root+'/reports/activity_detail?activity_id='+foreign.activities.a.activity_id)).status()).toBe(404);}finally{await agent.close();}
});

test('Reporting REST rejects route-specific and paginated export filters',async({request})=>{
 await login(request,'agent');
 expect((await request.get(root+'/dashboard?object_type=activity')).status()).toBe(400);
 expect((await request.get(root+'/reports/activity_detail?activity_id='+fixture.activities.a.activity_id+'&type_id=')).status()).toBe(400);
 expect((await send(request,'/reports/activities/exports',{format:'csv',filters:{page:'1'}})).status()).toBe(400);
 expect((await send(request,'/reports/activities/exports',{format:'csv',filters:{grouping:'project'}})).status()).toBe(400);
 expect((await send(request,'/reports/activity_detail/exports',{format:'csv',filters:{activity_id:String(fixture.activities.a.activity_id),type_id:''}})).status()).toBe(400);
 expect((await send(request,'/reports/activity_detail/exports',{format:'csv',filters:{}})).status()).toBe(400);
 expect((await send(request,'/reports/activity_detail/exports',{format:'csv',filters:{activity_id:'999999999'}})).status()).toBe(404);
});

test('Reporting REST preserves verified totals when action loading fails',async({request})=>{
 await login(request,'agent');
 const lock=cp.spawn('docker',['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','--unbuffered','-N','-B','dolidb'],{env:process.env,stdio:['pipe','pipe','pipe']});
 const ended=new Promise(resolve=>lock.once('close',resolve));
 const acquired=new Promise((resolve,reject)=>{let output='';lock.stdout.on('data',chunk=>{output+=chunk;if(output.includes('LOCKED'))resolve();});lock.once('error',reject);lock.once('close',code=>{if(!output.includes('LOCKED'))reject(new Error('Disposable lock failed: '+code));});});
 lock.stdin.end("LOCK TABLES llx_mjlfinancement_revision_contributor WRITE; SELECT 'LOCKED'; DO SLEEP(8); UNLOCK TABLES;\n");
 try{await acquired;const response=await request.get(root+'/dashboard?q=Rapports%20REST');expect(response.status(),await response.text()).toBe(200);const data=(await response.json()).data;expect(data.financial.activity_count).toBe(1);expect(data.work_items).toBeNull();expect(data.work_count).toBeNull();expect(data.pagination).toBeNull();}finally{await ended;}
});

test('Reporting REST audit cursors stay scoped and historical text is redacted',async({request})=>{
 await login(request,'validator');
 const first=await request.get(root+'/audit-events?q=AUDIT-PROBE-&direction=asc');expect(first.status(),await first.text()).toBe(200);const firstBody=await first.json();expect(firstBody.data).toHaveLength(50);expect(firstBody.pagination.has_next).toBe(true);
 const second=await request.get(root+'/audit-events?q=AUDIT-PROBE-&direction=asc&cursor='+firstBody.pagination.next_cursor);const secondBody=await second.json();expect(second.status(),JSON.stringify(secondBody)).toBe(200);expect(secondBody.data,JSON.stringify({cursor:firstBody.pagination.next_cursor,first:firstBody.data.map(row=>row.id),second:secondBody.data.map(row=>row.id)})).toHaveLength(7);
 expect((await request.get(root+'/audit-events?q=AUDIT-PROBE-&cursor=999999999')).status()).toBe(400);
 const redacted=await request.get(root+'/audit-events?event_id='+auditIds[0]);const text=JSON.stringify(await redacted.json());expect(text).not.toMatch(/PRIVATE (AUDIT|ACTOR) VALUE/);expect(text).toContain('[REDACTED]');
 const budget=await request.get(root+'/audit-events?q=AUDIT-BUDGET-&direction=asc');expect(budget.status(),await budget.text()).toBe(200);const budgetRows=(await budget.json()).data;expect(budgetRows.map(row=>row.id)).toEqual(auditBudgetIds.map(String));expect(budgetRows[0].changes).toHaveLength(4004);expect(budgetRows[1].changes).toHaveLength(4004);expect(budgetRows[0].detail_status).toBe('available');expect(budgetRows[1].detail_status).toBe('available');expect(budgetRows[2].changes).toHaveLength(0);expect(budgetRows[2].detail_status).toBe('oversized');
});

test('Reporting REST blocks unsupported audit evidence without recording an export',async({request})=>{
 await login(request,'validator');const before=sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record');
 for(const id of auditInvalidIds){const preview=await request.get(root+'/audit-events?event_id='+id);expect(preview.status(),await preview.text()).toBe(200);expect(['unsupported','unavailable']).toContain((await preview.json()).data[0].detail_status);const exported=await send(request,'/reports/audit/exports',{format:'csv',filters:{event_id:String(id)}});expect(exported.status(),await exported.text()).toBe(422);}
 expect(sql('SELECT COUNT(*) FROM llx_mjlfinancement_export_record')).toBe(before);
});

test('Reporting REST pagination retains filters in APIs and screen links',async({page})=>{
 await login(page.request,'validator');
 const alerts=await page.request.get(root+'/alerts?q=Rapports%20REST&page=2');expect(alerts.status(),await alerts.text()).toBe(200);const alertBody=await alerts.json();expect(alertBody.pagination.page).toBe(2);expect(alertBody.pagination.page_size).toBe(50);
 await page.goto('/custom/mjlfinancement/workflowactions.php?q=AUDIT-PROBE-&direction=asc');const next=page.getByRole('navigation',{name:'Pagination du journal'}).getByRole('link',{name:'Suivant'});await expect(next).toHaveAttribute('href',/q=AUDIT-PROBE-/);await next.click();expect(new URL(page.url()).searchParams.get('q')).toBe('AUDIT-PROBE-');expect(new URL(page.url()).searchParams.get('direction')).toBe('asc');await expect(page.locator('[data-audit-event-id]')).toHaveCount(7);
});

test('Reporting REST screens retain mobile layout and JavaScript-required fallback',async({page,browser})=>{
 await login(page.request,'agent');await page.goto('/custom/mjlfinancement/index.php?q=Rapports%20REST');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('link',{name:'Consulter'}).first().focus();await expect(page.getByRole('link',{name:'Consulter'}).first()).toBeFocused();
 const state=await page.context().storageState();const noJs=await browser.newContext({javaScriptEnabled:false,storageState:state});try{const fallback=await noJs.newPage();await fallback.goto('/custom/mjlfinancement/index.php');await expect(fallback.getByText('JavaScript est nécessaire pour utiliser cet écran.')).toBeVisible();}finally{await noJs.close();}
});
