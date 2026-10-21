const {test,expect}=require('@playwright/test');
const {createUserReferenceFixtureSet}=require('../helpers/user-reference-fixture');
const {composeExec,sql,registerSecret}=require('../helpers/mjl-test-runtime');
const root='/custom/mjlfinancement/api/index.php/v1';
let fixture;
test.use({actionTimeout:10000});
async function send(request,path,body,method='POST',submission){
 const s=(await (await request.get(root+'/auth/session')).json()).data;
 return request.fetch(root+path,{method,data:body,headers:{'X-CSRF-Token':s.csrf_token,...(submission?{'X-MJL-Submission':submission}:{})}});
}
async function login(request,key){
 expect((await send(request,'/auth/login',{email:fixture.users[key].login+'@example.test',password:process.env.MJL_TEST_USER_PASSWORD})).status()).toBe(202);
 const code=JSON.parse(composeExec('dolibarr',['cat','/var/www/documents/mjlfinancement/email-test-outbox/latest-login_otp.json'],'utf8')).code;
 await registerSecret('login otp',code);
 expect((await send(request,'/auth/otp/verify',{code})).status()).toBe(200);
}
async function mutate(request,operation,path,body,method='POST',id,revision){
 const t=await send(request,'/submission-tokens',{operation_id:operation,path_parameters:id?{activity_id:id,...(revision?{revision_id:revision}:{})}:{},...(body.expected_version?{expected_version:body.expected_version}:{})});
 expect(t.status(),await t.text()).toBe(200);
 return send(request,path,body,method,(await t.json()).data.token);
}
function structure(name='Activité REST'){
 const day=new Date();day.setUTCDate(day.getUTCDate()+30);const start=day.toISOString().slice(0,10);day.setUTCDate(day.getUTCDate()+5);
 return {partner_id:String(fixture.partners.parent),project_id:String(fixture.projects.child),name,description:'Planification par REST',date_start:start,date_end:day.toISOString().slice(0,10),authorized_amount:'1000',operations:[{client_key:'op1',name:'Formation REST',type_id:String(fixture.operationTypes.type),authorized_amount:'1000'}]};
}
test.beforeAll(()=>{
 fixture=createUserReferenceFixtureSet({namespace:'apia.'+Date.now().toString(36),entity:1,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'contributor',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'parent',label:'Activités Parent'}],projects:[{key:'child',label:'Activités Projet',partnerKey:'parent'}],operationTypes:[{key:'type',label:'Formation'}]}});
 sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_OTP_ENABLED',1,'1','chaine',0,'Disposable API verification'),('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'Disposable API verification') ON DUPLICATE KEY UPDATE value='1'");
});
test.afterAll(()=>sql("DELETE FROM llx_const WHERE name IN ('MJL_AUTH_OTP_ENABLED','MJL_AUTH_E2E_EXPOSE_TOKENS') AND entity=1"));
test('Activity REST creates scoped planning with exact money and rejects ambiguous fields',async({request,browser})=>{
 await login(request,'agent');
 const created=await mutate(request,'createActivity','/activities',{submit:false,...structure()});expect(created.status(),await created.text()).toBe(201);
 const id=(await created.json()).data.id;
 const detail=await request.get(root+'/activities/'+id);expect(detail.status()).toBe(200);const a=(await detail.json()).data;
 expect(a.draft_authorized_amount).toBe('1000');expect(a.operations[0].authorized_amount).toBe('1000');expect(a.allowed_actions).toContain('replaceActivityStructure');expect(a).not.toHaveProperty('fk_user_creat');
 const list=(await (await request.get(root+'/activities?q=Activit%C3%A9%20REST')).json());expect(list.data.map(a=>a.id)).toContain(id);expect(list.totals.activity_count).toBeGreaterThan(0);
 const other=await browser.newContext();try{await login(other.request,'other');expect((await other.request.get(root+'/activities/'+id)).status()).toBe(404);}finally{await other.close();}
 expect((await send(request,'/activities',{...structure(),submit:false,entity:'2'})).status()).toBe(400);
});
test('Activity REST UI plans, submits, reviews exact revisions and displays chronology',async({page,browser})=>{
 await login(page.request,'agent');const data=structure('Parcours Activité REST');
 await page.goto('/custom/mjlfinancement/activities.php?action=create');
 await page.locator('#activity-partner + .select2').click();await page.getByRole('option',{name:await page.locator('#activity-partner option[value="'+data.partner_id+'"]').textContent(),exact:true}).click();await page.locator('#activity-project + .select2').click();await page.getByRole('option',{name:await page.locator('#activity-project option[value="'+data.project_id+'"]').textContent(),exact:true}).click();
 await page.getByLabel('Nom de l’Activité').fill(data.name);await page.getByRole('textbox',{name:'Description',exact:true}).fill(data.description);
 await page.getByLabel('Date de début').fill(data.date_start.split('-').reverse().join('/'));await page.getByLabel('Date de fin incluse').fill(data.date_end.split('-').reverse().join('/'));await page.locator('[name=authorized_amount]').fill('1000');
 await page.getByLabel('Nom de l’Opération').fill('Formation REST');await page.locator('[data-operation-row] .select2').click();await page.getByRole('option',{name:await page.locator('[name="operation_type_id[]"] option[value="'+data.operations[0].type_id+'"]').textContent(),exact:true}).click();await page.getByLabel('Montant autorisé (F CFA)',{exact:true}).fill('1000');
 const created=page.waitForResponse(r=>r.url().endsWith('/v1/activities')&&r.request().method()==='POST');await page.getByRole('button',{name:'Enregistrer le brouillon'}).click();expect((await created).status()).toBe(201);await expect(page).toHaveURL(/activities.php\?id=\d+$/);const id=new URL(page.url()).searchParams.get('id');
 await expect(page.getByRole('heading',{name:'Informations de l’Activité'})).toBeVisible();
 await page.getByRole('tab',{name:'Opérations (1)',exact:true}).click();await page.getByRole('link',{name:'Consulter',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Formation REST');await page.getByRole('button',{name:'Fermer',exact:true}).click();
 await page.getByRole('tab',{name:'Validation et demandes',exact:true}).click();await page.getByRole('button',{name:'Soumettre la révision',exact:true}).click();await expect(page.getByText('Soumise',{exact:true})).toBeVisible();
 const supervisor=await browser.newContext(),validator=await browser.newContext();try{
  await login(supervisor.request,'supervisor');const sp=await supervisor.newPage();await sp.goto('/custom/mjlfinancement/activities.php?id='+id+'&action=review');await expect(sp.getByRole('heading',{name:'Structure soumise'})).toBeVisible();
  await sp.getByRole('link',{name:'Retourner en correction',exact:true}).click();await sp.getByLabel('Motif de correction').fill('Préciser la description');await sp.getByRole('button',{name:'Confirmer le retour',exact:true}).click();await expect(sp).toHaveURL(new RegExp('activities.php\\?id='+id+'$'));await expect(sp.getByText('Retournée par le superviseur',{exact:true})).toBeVisible();
  await page.reload();await page.getByRole('link',{name:'Modifier',exact:true}).click();await page.getByRole('textbox',{name:'Description',exact:true}).fill('Description corrigée pour la revue');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page).toHaveURL(new RegExp('activities.php\\?id='+id+'$'));await page.getByRole('tab',{name:'Validation et demandes',exact:true}).click();await page.getByRole('button',{name:'Soumettre la révision',exact:true}).click();await expect(page.getByText('Soumise',{exact:true})).toBeVisible();
  await sp.goto('/custom/mjlfinancement/activities.php?id='+id+'&action=review');await expect(sp.getByRole('heading',{name:'Révision 2 à examiner'})).toBeVisible();await sp.getByRole('button',{name:'Prévalider',exact:true}).click();await expect(sp.getByText('Prévalidée',{exact:true})).toBeVisible();
  await login(validator.request,'validator');const vp=await validator.newPage();await vp.goto('/custom/mjlfinancement/activities.php?id='+id+'&action=review');await vp.getByRole('button',{name:'Valider définitivement',exact:true}).click();await expect(vp.getByText('Validée définitivement',{exact:true})).toBeVisible();
  await page.reload();await page.getByRole('tab',{name:'Historique',exact:true}).click();await expect(page.getByRole('heading',{name:'Chronologie',exact:true})).toBeVisible();await expect(page.locator('[data-timeline]')).toContainText('Structure mise à jour');
  const review=(await (await validator.request.get(root+'/activities/'+id+'/review')).json()).data;expect(review.snapshot.description).toBe('Description corrigée pour la revue');expect(review.snapshot).not.toHaveProperty('contributors');expect(review.allowed_decisions).toEqual([]);
  await page.setViewportSize({width:390,height:844});await page.goto('/custom/mjlfinancement/activities.php?q=Parcours');await expect(page.getByRole('link',{name:'Parcours Activité REST',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect((await page.request.post('/custom/mjlfinancement/activities.php',{form:{action:'submit_revision',id,version:'1'}})).status()).toBe(405);
 }finally{await supervisor.close().catch(()=>{});await validator.close().catch(()=>{});}
});
test('Activity REST assignment lifecycle revokes access and restores an abandoned draft',async({page,browser})=>{
 await login(page.request,'agent');const a=(await (await mutate(page.request,'createActivity','/activities',{...structure('Affectations REST'),submit:false})).json()).data;
 const validator=await browser.newContext(),other=await browser.newContext();try{
  await login(validator.request,'validator');await login(other.request,'other');const vp=await validator.newPage();await vp.goto('/custom/mjlfinancement/activities.php?id='+a.id);
  await expect(vp.locator('[data-mjl-tabs]')).toHaveClass(/mjl-tabs-enhanced/);await vp.getByRole('link',{name:'Gérer les affectations',exact:true}).click();await vp.getByLabel('Agent concerné').selectOption(String(fixture.users.other.id));await vp.getByLabel('Motif',{exact:true}).fill('Appui à la préparation');await vp.getByRole('button',{name:'Modifier l’affectation',exact:true}).click();await expect(vp.locator('#mjl-assignment-dialog')).toBeHidden();expect((await other.request.get(root+'/activities/'+a.id)).status()).toBe(200);
  let row=(await (await validator.request.get(root+'/activities/'+a.id)).json()).data;
  expect((await mutate(validator.request,'changeAssignment','/activities/'+a.id+'/assignment-changes',{expected_version:row.version,reason:'Fin de l’appui',operation:'REMOVE_ADDITIONAL',target_agent_id:String(fixture.users.other.id)},'POST',a.id)).status()).toBe(200);
  expect((await other.request.get(root+'/activities/'+a.id)).status()).toBe(404);
  row=(await (await validator.request.get(root+'/activities/'+a.id)).json()).data;
  expect((await mutate(validator.request,'changeAssignment','/activities/'+a.id+'/assignment-changes',{expected_version:row.version,reason:'Transfert de coordination',operation:'TRANSFER_PRIMARY',target_agent_id:String(fixture.users.other.id)},'POST',a.id)).status()).toBe(200);
  expect((await page.request.get(root+'/activities/'+a.id)).status()).toBe(404);row=(await (await other.request.get(root+'/activities/'+a.id)).json()).data;expect(row.assignments.filter(a=>a.primary).map(a=>a.user_id)).toEqual([String(fixture.users.other.id)]);
  expect((await mutate(other.request,'abandonActivity','/activities/'+a.id+'/abandonment',{expected_version:row.version,reason:'Brouillon abandonné'},'POST',a.id)).status()).toBe(200);expect((await other.request.get(root+'/activities/'+a.id)).status()).toBe(404);
  await vp.reload();await vp.getByRole('tab',{name:'Validation et demandes',exact:true}).click();await vp.getByRole('combobox',{name:'Agent principal',exact:true}).selectOption(String(fixture.users.agent.id));await vp.getByLabel('Motif de restauration').fill('Reprise de la planification');await vp.getByRole('button',{name:'Restaurer le brouillon'}).click();await expect(vp.getByText('Brouillon',{exact:true})).toBeVisible();expect((await page.request.get(root+'/activities/'+a.id)).status()).toBe(200);
 }finally{await validator.close().catch(()=>{});await other.close().catch(()=>{});}
});
test('Activity REST stale versions, exact revision, replay and audit failure do not mutate planning',async({request,browser})=>{
 await login(request,'agent');const input=structure('Intégrité REST');
 const result=await mutate(request,'createActivity','/activities',{...input,submit:false});const id=(await result.json()).data.id;
 let row=(await (await request.get(root+'/activities/'+id)).json()).data;
 const saved={...input,expected_version:row.version,operations:row.operations.map((o,i)=>({...input.operations[i],id:o.id,expected_version:o.version})),description:'Modifiée une fois'};
 const issued=await send(request,'/submission-tokens',{operation_id:'replaceActivityStructure',path_parameters:{activity_id:id},expected_version:row.version});const proof=(await issued.json()).data.token;
 expect((await send(request,'/activities/'+id+'/structure',saved,'PUT',proof)).status()).toBe(200);
 expect((await send(request,'/activities/'+id+'/structure',saved,'PUT',proof)).status()).toBe(403);
 expect((await send(request,'/submission-tokens',{operation_id:'submitActivity',path_parameters:{activity_id:id},expected_version:row.version})).status()).toBe(409);
 row=(await (await request.get(root+'/activities/'+id)).json()).data;
 expect((await mutate(request,'replaceActivityStructure','/activities/'+id+'/structure',{...saved,expected_version:row.version},'PUT',id)).status()).toBe(409);
 expect((await send(request,'/activities/'+id+'/structure',{...saved,expected_version:row.version,operations:[{...input.operations[0],id:null,expected_version:null}]},'PUT')).status()).toBe(400);
 sql("CREATE TRIGGER api_activity_audit_failure BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected audit failure'");
 try{const failed=await mutate(request,'replaceActivityStructure','/activities/'+id+'/structure',{...saved,expected_version:row.version,operations:row.operations.map((o,i)=>({...input.operations[i],id:o.id,expected_version:o.version})),description:'Ne doit pas être conservée'},'PUT',id);expect(failed.status()).toBe(503);}finally{sql('DROP TRIGGER api_activity_audit_failure');}
 const unchanged=(await (await request.get(root+'/activities/'+id)).json()).data;expect(unchanged.version).toBe(row.version);expect(unchanged.description).toBe('Modifiée une fois');
 expect((await mutate(request,'submitActivity','/activities/'+id+'/submissions',{expected_version:row.version},'POST',id)).status()).toBe(200);
 row=(await (await request.get(root+'/activities/'+id)).json()).data;expect((await request.get(root+'/activities/'+id+'/review')).status()).toBe(403);
 const supervisor=await browser.newContext();try{
  await login(supervisor.request,'supervisor');const revision=row.current_revision_id;
  expect((await send(supervisor.request,'/submission-tokens',{operation_id:'reviewActivity',path_parameters:{activity_id:id,revision_id:String(BigInt(revision)+100n)},expected_version:row.version})).status()).toBe(409);
  expect((await send(supervisor.request,'/submission-tokens',{operation_id:'reviewActivity',path_parameters:{activity_id:id,revision_id:revision},expected_version:row.version,revision_id:String(BigInt(revision)+1n)})).status()).toBe(400);
  expect((await mutate(supervisor.request,'reviewActivity','/activities/'+id+'/revisions/'+revision+'/decisions',{expected_version:row.version,decision:'FINAL_VALIDATED'},'POST',id,revision)).status()).toBe(403);
 }finally{await supervisor.close();}
 const cancel=await mutate(request,'requestActivityCancellation','/activities/'+id+'/cancellation-requests',{expected_version:row.version,reason:'Annulation demandée par REST'},'POST',id);expect(cancel.status()).toBe(200);expect((await cancel.json()).data.request_id).toMatch(/^[1-9][0-9]*$/);
 const timeline=(await (await request.get(root+'/activities/'+id+'/timeline')).json()).data;expect(timeline.some(e=>e.label==='Annulation demandée')).toBe(true);expect(timeline.every(e=>!('context_json' in e))).toBe(true);
 expect((await request.get(root+'/activities/'+id+'/timeline?cursor=9223372036854775807')).status()).toBe(400);
 const nojs=await browser.newContext({javaScriptEnabled:false});try{await login(nojs.request,'agent');const p=await nojs.newPage();await p.goto('/custom/mjlfinancement/activities.php');await expect(p.getByText('JavaScript est nécessaire pour utiliser cet écran.')).toBeVisible();}finally{await nojs.close();}
});
test('Activity REST hides foreign records and excludes a contributor after a role change',async({request})=>{
 const {createActivityFixtureSet}=require('../helpers/activity-fixture');
 const foreign=createActivityFixtureSet({namespace:'apif.'+Date.now().toString(36),entity:2,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'parent',label:'Étranger'}],projects:[{key:'child',label:'Projet étranger',partnerKey:'parent'}],operationTypes:[{key:'type',label:'Type étranger'}]},activities:[{key:'foreign',agentKey:'agent',partnerKey:'parent',projectKey:'child',name:'Activité étrangère',description:'Autre entité',dateStart:'2032-01-01',dateEnd:'2032-02-01',authorizedAmount:'1000',operations:[{name:'Opération étrangère',typeKey:'type',authorizedAmount:'1000'}]}]});
 await login(request,'contributor');const foreignId=String(foreign.activities.foreign.activity_id);
 for(const suffix of ['','/review','/timeline'])expect((await request.get(root+'/activities/'+foreignId+suffix)).status()).toBe(404);
 expect((await request.get(root+'/assignment-agents')).status()).toBe(403);
 const created=await mutate(request,'createActivity','/activities',{...structure('Contributeur REST'),submit:true});expect(created.status()).toBe(201);const id=(await created.json()).data.id;
 await send(request,'/auth/session',undefined,'DELETE');
 await login(request,'validator');
 const current=(await (await request.get(root+'/activities/'+id)).json()).data;
 expect((await mutate(request,'changeAssignment','/activities/'+id+'/assignment-changes',{expected_version:current.version,reason:'Transfert avant changement de rôle',operation:'TRANSFER_PRIMARY',target_agent_id:String(fixture.users.other.id)},'POST',id)).status()).toBe(200);
 const timeline=(await (await request.get(root+'/activities/'+id+'/timeline')).json()).data;
 expect(Math.abs(Date.now()-Date.parse(timeline[0].date))).toBeLessThan(60000);
 await send(request,'/auth/session',undefined,'DELETE');
 sql("UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_VERIFICATEUR' WHERE entity=1 AND fk_user="+fixture.users.contributor.id+" AND is_active=1");
 try{
  await login(request,'contributor');const review=(await (await request.get(root+'/activities/'+id+'/review')).json()).data;expect(review.allowed_decisions).toEqual([]);
  expect((await send(request,'/submission-tokens',{operation_id:'reviewActivity',path_parameters:{activity_id:id,revision_id:review.revision_id},expected_version:review.activity_version})).status()).toBe(403);
  const choices=(await (await request.get(root+'/monitoring-options')).json()).data;expect(choices.partner_id.map(p=>p.id)).not.toContain(String(foreign.partners.parent));
 }finally{sql("UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_SAISIE' WHERE entity=1 AND fk_user="+fixture.users.contributor.id+" AND is_active=1");}
});
