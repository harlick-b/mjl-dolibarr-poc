const {test,expect}=require('@playwright/test');
const {createExecutionFixtureSet}=require('../helpers/execution-fixture');
const {composeExec,sql,registerSecret}=require('../helpers/mjl-test-runtime');
const root='/custom/mjlfinancement/api/index.php/v1';
let fixture;
test.use({actionTimeout:10000});
async function send(request,path,body,method='POST',submission){
 const s=(await (await request.get(root+'/auth/session')).json()).data;
 return request.fetch(root+path,{method,data:body,headers:{'X-CSRF-Token':s.csrf_token,...(submission?{'X-MJL-Submission':submission}:{})}});
}
async function login(request,key,users=fixture.users){
 expect((await send(request,'/auth/login',{email:users[key].login+'@example.test',password:process.env.MJL_TEST_USER_PASSWORD})).status()).toBe(202);
 const code=JSON.parse(composeExec('dolibarr',['cat','/var/www/documents/mjlfinancement/email-test-outbox/latest-login_otp.json'],'utf8')).code;
 await registerSecret('login otp',code);
 expect((await send(request,'/auth/otp/verify',{code})).status()).toBe(200);
}
async function mutate(request,operation,path,body,parameters,method='POST'){
 const t=await send(request,'/submission-tokens',{operation_id:operation,path_parameters:parameters,expected_version:body.expected_version});
 expect(t.status(),await t.text()).toBe(200);
 return send(request,path,body,method,(await t.json()).data.token);
}
async function clickMutation(page,control,suffix,status=200){
 const done=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(suffix)&&r.request().method()!=='GET');
 await control.click();expect((await done).status()).toBe(status);
}
let op;
test.beforeAll(()=>{
 fixture=createExecutionFixtureSet({namespace:'apiex.'+Date.now().toString(36),entity:1,
 users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],
 references:{partners:[{key:'p',label:'Parent exécution REST'}],projects:[{key:'project',label:'Projet exécution REST',partnerKey:'p'}],operationTypes:[{key:'t',label:'Type exécution REST'}]},
 activities:[{key:'a',agentKey:'agent',partnerKey:'p',projectKey:'project',name:'Exécution REST',description:'Dépenses par REST',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'300',operations:[{name:'Transport REST',typeKey:'t',authorizedAmount:'100'},{name:'Zéro REST',typeKey:'t',authorizedAmount:'100'},{name:'Annulation REST',typeKey:'t',authorizedAmount:'100'}]}]});
 op=String(fixture.activities.a.operations[0].rowid);
 sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_OTP_ENABLED',1,'1','chaine',0,'Disposable API verification'),('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'Disposable API verification') ON DUPLICATE KEY UPDATE value='1'");
});
test.afterAll(()=>sql("DELETE FROM llx_const WHERE name IN ('MJL_AUTH_OTP_ENABLED','MJL_AUTH_E2E_EXPOSE_TOKENS') AND entity=1"));
test('Execution REST spending requires approval and preserves linked corrections after completion',async({page,browser})=>{
 test.setTimeout(90000);
 await login(page.request,'agent');
 const response=await page.request.get(root+'/operations/'+op);expect(response.status()).toBe(200);
 const operation=(await response.json()).data;expect(operation.spent_amount).toBeNull();
 await page.goto('/custom/mjlfinancement/expenses.php?operation_id='+op);
 await page.getByLabel('Libellé de la dépense').fill('Transport');await page.getByLabel('Date de la dépense').fill('2026-09-05');await page.getByLabel('Montant (F CFA)').fill('60');
 const created=page.waitForResponse(r=>r.url().endsWith('/operations/'+op+'/expenses')&&r.request().method()==='POST');await page.getByRole('button',{name:'Enregistrer le brouillon',exact:true}).click();expect((await created).status()).toBe(201);await expect(page.locator('[data-expense-id]')).toHaveCount(1);
 await clickMutation(page,page.getByRole('button',{name:'Soumettre',exact:true}),'/submission');await expect(page.locator('[data-expense-id]')).toContainText('Soumise');
 expect((await mutate(page.request,'updateExecution','/operations/'+op+'/execution',{expected_version:operation.version,status:'COMPLETED',observation:'Économie réalisée'},{operation_id:op},'PUT')).status()).toBe(409);
 const validator=await browser.newContext();try{
  await login(validator.request,'validator');const vp=await validator.newPage();await vp.goto('/custom/mjlfinancement/expenses.php?operation_id='+op);await clickMutation(vp,vp.getByRole('button',{name:'Approuver',exact:true}),'/decisions');await expect(vp.locator('[data-expense-id]')).toContainText('Approuvée');
  await page.goto('/custom/mjlfinancement/operations.php?activity_id='+fixture.activities.a.activity_id);
  const card=page.locator('#operation-'+op);await card.getByRole('combobox',{name:'Statut',exact:true}).selectOption('COMPLETED');await card.getByLabel('Observation',{exact:true}).fill('Économie sur le transport.');await clickMutation(page,card.getByRole('button',{name:'Enregistrer l’exécution'}),'/execution');await expect(card).toContainText('Cette Opération est terminée');
  await page.goto('/custom/mjlfinancement/expenses.php?operation_id='+op);await page.getByText('Demander une correction',{exact:true}).click();await page.getByLabel('Montant (F CFA)').fill('80');await page.getByLabel('Motif de correction').fill('Facture corrigée.');await clickMutation(page,page.getByRole('button',{name:'Enregistrer la correction'}),'/expenses',201);await expect(page.locator('[data-expense-id]')).toHaveCount(2);await clickMutation(page,page.getByRole('button',{name:'Soumettre',exact:true}),'/submission');
  await expect(page.locator('[data-expense-id]').first()).toContainText('Soumise');
  let ledger=(await(await page.request.get(root+'/operations/'+op+'/expenses')).json()).data;expect(ledger.operation.spent_amount).toBe('60');expect(ledger.operation.status).toBe('COMPLETED');
  await vp.reload();await clickMutation(vp,vp.getByRole('button',{name:'Approuver',exact:true}),'/decisions');await expect(vp.locator('[data-expense-id]')).toHaveCount(3);
  ledger=(await(await page.request.get(root+'/operations/'+op+'/expenses')).json()).data;expect(ledger.operation.spent_amount).toBe('80');expect(ledger.operation.status).toBe('COMPLETED');expect(ledger.entries.map(e=>e.amount).sort()).toEqual(['-60','60','80']);expect(ledger.entries.every(e=>e.allowed_actions.length===0||e.amount==='80')).toBe(true);
 }finally{await validator.close().catch(()=>{});}
});
async function get(request,path){const r=await request.get(root+path);expect(r.status(),await r.text()).toBe(200);return (await r.json()).data;}
async function expense(request,id,amount,original=null){const ledger=await get(request,'/operations/'+id+'/expenses');const r=await mutate(request,'createExpense','/operations/'+id+'/expenses',{expected_version:ledger.operation.version,label:amount==='0'?'Aucune dépense':'Dépense REST',expense_date:'2026-09-05',amount,original_id:original,reason:original?'Correction documentée':null},{operation_id:id});expect(r.status(),await r.text()).toBe(201);return (await r.json()).data;}
async function transition(request,id,entry,action,extra={}){const r=await mutate(request,action,'/operations/'+id+'/expenses/'+entry.expense_id+'/'+({submitExpense:'submission',withdrawExpense:'withdrawal',decideExpense:'decisions'}[action]),{expected_version:String(entry.expense_version),...extra},{operation_id:id,expense_id:entry.expense_id});expect(r.status(),await r.text()).toBe(200);return (await r.json()).data;}
test('Execution REST zero declaration and exception decisions preserve target versions',async({page,browser})=>{
 const id=String(fixture.activities.a.operations[1].rowid),params={operation_id:id};await login(page.request,'agent');
 const validator=await browser.newContext();try{
  await login(validator.request,'validator');let e=await expense(page.request,id,'0');e=await transition(page.request,id,e,'submitExpense');await transition(validator.request,id,e,'decideExpense',{decision:'APPROVED'});
  let row=await get(page.request,'/operations/'+id);expect(row.spent_amount).toBe('0');
  expect((await mutate(page.request,'updateExecution','/operations/'+id+'/execution',{expected_version:row.version,status:'COMPLETED',observation:null},params,'PUT')).status()).toBe(409);
  expect((await mutate(page.request,'updateExecution','/operations/'+id+'/execution',{expected_version:row.version,status:'COMPLETED',observation:'Aucune dépense nécessaire.'},params,'PUT')).status()).toBe(200);
  await page.goto('/custom/mjlfinancement/operations.php?activity_id='+fixture.activities.a.activity_id);const card=page.locator('#operation-'+id);await card.getByRole('link',{name:'Demander la réouverture',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Motif de la demande').fill('Reprendre le contrôle.');const sent=page.waitForResponse(r=>r.url().endsWith('/operations/'+id+'/reopening-requests')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Demander la réouverture',exact:true}).click();expect((await sent).status()).toBe(200);
  await expect(page).toHaveURL(/result=OK/);const requests=await get(validator.request,'/exception-requests?type=REOPENING&activity_id='+fixture.activities.a.activity_id);const request= requests.find(r=>r.operation_id===id);expect(request.allowed_decisions).toEqual(['APPROVED','REJECTED']);
  const vp=await validator.newPage();await vp.goto('/custom/mjlfinancement/operationrequests.php?type=REOPENING&request_id='+request.id);await vp.getByRole('link',{name:'Approuver la demande',exact:true}).click();await vp.getByRole('dialog').getByLabel('Motif de décision').fill('Reprise autorisée.');await vp.getByRole('dialog').getByRole('button',{name:'Approuver',exact:true}).click();await expect(vp).toHaveURL(/result=OK/);
  row=await get(page.request,'/operations/'+id);expect(row.status).toBe('IN_PROGRESS');expect(row.spent_amount).toBe('0');
  const cancellation=await mutate(page.request,'requestOperationCancellation','/operations/'+id+'/cancellation-requests',{expected_version:row.version,reason:'Annulation proposée.'},params);expect(cancellation.status()).toBe(200);const req=(await cancellation.json()).data;
  expect((await mutate(page.request,'updateExecution','/operations/'+id+'/execution',{expected_version:row.version,status:'IN_PROGRESS',observation:'Cible modifiée.'},params,'PUT')).status()).toBe(200);
  let listed=await get(validator.request,'/exception-requests?type=CANCELLATION&request_id='+req.request_id);expect(listed[0].stale).toBe(true);expect(listed[0].allowed_decisions).toEqual(['REJECTED']);
  expect((await mutate(validator.request,'decideCancellation','/cancellation-requests/'+req.request_id+'/decisions',{expected_version:req.request_version,decision:'APPROVED',reason:'Cible obsolète'},{request_id:req.request_id})).status()).toBe(409);
  expect((await mutate(page.request,'withdrawCancellation','/cancellation-requests/'+req.request_id+'/withdrawal',{expected_version:req.request_version},{request_id:req.request_id})).status()).toBe(200);
  listed=await get(validator.request,'/exception-requests?type=CANCELLATION&status=WITHDRAWN&request_id='+req.request_id);expect(listed[0].allowed_actions).toEqual([]);
  await vp.setViewportSize({width:390,height:844});await vp.reload();expect(await vp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }finally{await validator.close().catch(()=>{});}
});
test('Execution REST enforces scope replay rollback and correction-only access after Activity cancellation',async({request,browser})=>{
 await login(request,'agent');const id=String(fixture.activities.a.operations[2].rowid),params={operation_id:id};const validator=await browser.newContext(),other=await browser.newContext();
 try{
  await login(validator.request,'validator');await login(other.request,'other');expect((await other.request.get(root+'/operations/'+id)).status()).toBe(404);expect((await other.request.get(root+'/operations/'+id+'/expenses')).status()).toBe(404);
  let row=await get(request,'/operations/'+id);expect((await send(request,'/operations/'+id+'/execution',{expected_version:row.version,status:'IN_PROGRESS',observation:null,spent_amount:'999'},'PUT')).status()).toBe(400);
  const context={operation_id:'createExpense',path_parameters:params,expected_version:row.version};const issued=await send(request,'/submission-tokens',context);expect(issued.status()).toBe(200);const token=(await issued.json()).data.token;const body={expected_version:row.version,label:'Intégrité',expense_date:'2026-09-05',amount:'45',original_id:null,reason:null};
  const saved=await send(request,'/operations/'+id+'/expenses',body,'POST',token);expect(saved.status()).toBe(201);let e=(await saved.json()).data;expect((await send(request,'/operations/'+id+'/expenses',body,'POST',token)).status()).toBe(403);
  e=await transition(request,id,e,'submitExpense');
  const proof=await send(validator.request,'/submission-tokens',{operation_id:'decideExpense',path_parameters:{operation_id:id,expense_id:e.expense_id},expected_version:e.expense_version});expect(proof.status()).toBe(200);
  sql("CREATE TRIGGER api_execution_audit_failure BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected audit failure'");
  try{expect((await send(validator.request,'/operations/'+id+'/expenses/'+e.expense_id+'/decisions',{expected_version:e.expense_version,decision:'APPROVED'},'POST',(await proof.json()).data.token)).status()).toBe(503);}finally{sql('DROP TRIGGER api_execution_audit_failure');}
  let ledger=await get(request,'/operations/'+id+'/expenses');expect(ledger.operation.spent_amount).toBeNull();expect(ledger.entries[0].status).toBe('SUBMITTED');
  e=await transition(validator.request,id,e,'decideExpense',{decision:'APPROVED'});expect((await send(validator.request,'/submission-tokens',{operation_id:'decideExpense',path_parameters:{operation_id:id,expense_id:e.expense_id},expected_version:'1'})).status()).toBe(409);
  const activity=await get(request,'/activities/'+fixture.activities.a.activity_id);const at=await send(request,'/submission-tokens',{operation_id:'requestActivityCancellation',path_parameters:{activity_id:activity.id},expected_version:activity.version});expect(at.status()).toBe(200);const cancelled=await send(request,'/activities/'+activity.id+'/cancellation-requests',{expected_version:activity.version,reason:'Arrêt de l’Activité'},'POST',(await at.json()).data.token);expect(cancelled.status()).toBe(200);const req=(await cancelled.json()).data;
  expect((await mutate(validator.request,'decideCancellation','/cancellation-requests/'+req.request_id+'/decisions',{expected_version:req.request_version,decision:'APPROVED',reason:'Arrêt approuvé.'},{request_id:req.request_id})).status()).toBe(200);
  expect((await request.get(root+'/activities/'+activity.id)).status()).toBe(404);expect((await request.get(root+'/operations/'+id)).status()).toBe(404);
  ledger=await get(request,'/operations/'+id+'/expenses');expect(ledger.correction_only).toBe(true);expect(ledger.allowed_actions).toEqual([]);expect(ledger.entries[0].allowed_actions).toContain('createExpense');
  expect((await mutate(request,'createExpense','/operations/'+id+'/expenses',{...body,expected_version:ledger.operation.version},params)).status()).toBe(403);
  const correction=await expense(request,id,'55',e.expense_id);const submitted=await transition(request,id,correction,'submitExpense');await transition(validator.request,id,submitted,'decideExpense',{decision:'APPROVED'});
  ledger=await get(request,'/operations/'+id+'/expenses');expect(ledger.operation.status).toBe('CANCELLED');expect(ledger.operation.spent_amount).toBe('55');
  expect((await request.get(root+'/exception-requests')).status()).toBe(200);expect((await get(request,'/exception-requests')).length).toBe(0);
  for(const screen of ['operations','expenses','operationrequests'])expect((await request.post('/custom/mjlfinancement/'+screen+'.php',{form:{action:'save'}})).status()).toBe(405);
 }finally{await validator.close().catch(()=>{});await other.close().catch(()=>{});}
});
test('Execution REST denies foreign entities Admin and expense self-approval after role change',async({request,browser})=>{
 const {createActivityFixtureSet}=require('../helpers/activity-fixture');
 const foreign=createActivityFixtureSet({namespace:'exforeign.'+Date.now().toString(36),entity:2,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'parent',label:'Étranger'}],projects:[{key:'child',label:'Projet étranger',partnerKey:'parent'}],operationTypes:[{key:'type',label:'Type étranger'}]},activities:[{key:'a',agentKey:'agent',partnerKey:'parent',projectKey:'child',name:'Étranger',description:'Autre entité',dateStart:'2032-01-01',dateEnd:'2032-02-01',authorizedAmount:'100',operations:[{name:'Étrangère',typeKey:'type',authorizedAmount:'100'}]}]});
 const {scalar}=require('../helpers/mjl-test-runtime');const foreignId=scalar('SELECT rowid FROM llx_mjlfinancement_operation WHERE entity=2 AND fk_activity='+foreign.activities.a.activity_id);
 await login(request,'validator');for(const suffix of ['','/expenses'])expect((await request.get(root+'/operations/'+foreignId+suffix)).status()).toBe(404);
 expect((await send(request,'/submission-tokens',{operation_id:'createExpense',path_parameters:{operation_id:foreignId},expected_version:'1'})).status()).toBe(404);
 const own=createExecutionFixtureSet({namespace:'exself.'+Date.now().toString(36),entity:1,users:[{key:'career',role:'AGENT_SAISIE'},{key:'next',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'parent',label:'Indépendance'}],projects:[{key:'child',label:'Projet indépendance',partnerKey:'parent'}],operationTypes:[{key:'type',label:'Contrôle'}]},activities:[{key:'a',agentKey:'career',partnerKey:'parent',projectKey:'child',name:'Indépendance',description:'Séparation des fonctions',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'100',operations:[{name:'Contrôle',typeKey:'type',authorizedAmount:'100'}]}]});
 const career=await browser.newContext();try{
  await login(career.request,'career',own.users);const id=String(own.activities.a.operations[0].rowid);let e=await expense(career.request,id,'10');e=await transition(career.request,id,e,'submitExpense');await send(career.request,'/auth/session',undefined,'DELETE');
  const a=await get(request,'/activities/'+own.activities.a.activity_id);const token=await send(request,'/submission-tokens',{operation_id:'changeAssignment',path_parameters:{activity_id:a.id},expected_version:a.version});expect(token.status()).toBe(200);expect((await send(request,'/activities/'+a.id+'/assignment-changes',{expected_version:a.version,operation:'TRANSFER_PRIMARY',target_agent_id:String(own.users.next.id),reason:'Changement de fonction'},'POST',(await token.json()).data.token)).status()).toBe(200);
  sql("UPDATE llx_mjlfinancement_user_role SET role_code='VALIDATEUR_DEFINITIF' WHERE entity=1 AND fk_user="+own.users.career.id+" AND is_active=1");
  try{await login(career.request,'career',own.users);const ledger=await get(career.request,'/operations/'+id+'/expenses');expect(ledger.entries[0].allowed_decisions).toEqual([]);expect((await send(career.request,'/submission-tokens',{operation_id:'decideExpense',path_parameters:{operation_id:id,expense_id:e.expense_id},expected_version:e.expense_version})).status()).toBe(403);}finally{await send(career.request,'/auth/session',undefined,'DELETE');sql("UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_SAISIE' WHERE entity=1 AND fk_user="+own.users.career.id+" AND is_active=1");}
  const previousEmail=scalar("SELECT IF(email IS NULL,'NULL',CONCAT('0x',HEX(email))) FROM llx_user WHERE entity=0 AND admin=1");
  sql("UPDATE llx_user SET email='execution.admin@example.test' WHERE entity=0 AND admin=1");
  try{
   expect((await send(career.request,'/auth/login',{email:'execution.admin@example.test',password:process.env.DOLI_ADMIN_PASSWORD})).status()).toBe(202);
   const code=JSON.parse(composeExec('dolibarr',['cat','/var/www/documents/mjlfinancement/email-test-outbox/latest-login_otp.json'],'utf8')).code;await registerSecret('login otp',code);expect((await send(career.request,'/auth/otp/verify',{code})).status()).toBe(200);
   for(const path of ['/operations','/operations/'+id,'/operations/'+id+'/expenses','/spending-operations','/exception-requests'])expect((await career.request.get(root+path)).status()).toBe(403);
  }finally{sql("UPDATE llx_user SET email="+(previousEmail==='0x'?"''":previousEmail)+" WHERE entity=0 AND admin=1");}
  const nojs=await browser.newContext({javaScriptEnabled:false,storageState:await request.storageState()});try{const p=await nojs.newPage();await p.goto('/custom/mjlfinancement/operations.php');await expect(p.getByText('JavaScript est nécessaire pour utiliser cet écran.',{exact:true})).toBeVisible();}finally{await nojs.close();}
 }finally{await career.close().catch(()=>{});}
});
