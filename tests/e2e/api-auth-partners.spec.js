const {test,expect}=require('@playwright/test');
const {execFileSync}=require('node:child_process');
const {createUserReferenceFixtureSet}=require('../helpers/user-reference-fixture');
const {composeExec,sql,scalar,registerSecret}=require('../helpers/mjl-test-runtime');
const nativeAdminPassword=process.env.DOLI_ADMIN_PASSWORD;
const root='/custom/mjlfinancement/api/index.php/v1';
let fixture,foreign;
const namespace='api.'+Date.now().toString(36);
function outbox(type='login_otp'){return JSON.parse(composeExec('dolibarr',['cat',`/var/www/documents/mjlfinancement/email-test-outbox/latest-${type}.json`],'utf8'));}
async function session(request){const r=await request.get(root+'/auth/session');expect(r.status()).toBe(200);return (await r.json()).data;}
async function send(request,path,body,method='POST',submission){const s=await session(request);return request.fetch(root+path,{method,data:body,headers:{'X-CSRF-Token':s.csrf_token,...(submission?{'X-MJL-Submission':submission}:{})}});}
async function otp(){const code=outbox().code;await registerSecret('login otp',code);return code;}
async function login(request,key='validator'){
 const r=await send(request,'/auth/login',{email:fixture.users[key].login+'@example.test',password:process.env.MJL_TEST_USER_PASSWORD});expect(r.status()).toBe(202);
 const v=await send(request,'/auth/otp/verify',{code:await otp()});expect(v.status()).toBe(200);
}
async function token(request,operation,id){const r=await send(request,'/submission-tokens',{operation_id:operation,path_parameters:id?{id:String(id)}:{}});expect(r.status()).toBe(200);return (await r.json()).data.token;}
async function alterClock(context,startedAgo,activeAgo){
 const cookie=(await context.cookies()).find(c=>c.name.startsWith('DOLSESSID'));
 await registerSecret('session cookie',cookie.value);
 const source="$r=json_decode(file_get_contents('php://stdin'),true); $_COOKIE[$r['name']]=$r['value']; define('NOLOGIN',1); require '/var/www/html/main.inc.php'; $_SESSION['mjl_authenticated_at']=time()-$r['started']; $_SESSION['mjl_last_activity_at']=time()-$r['active']; session_write_close();";
 execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','-r',source],{input:JSON.stringify({...cookie,started:startedAgo,active:activeAgo}),stdio:['pipe','pipe','pipe']});
}
test.beforeAll(()=>{
 fixture=createUserReferenceFixtureSet({namespace,entity:1,users:[{key:'validator',role:'VALIDATEUR_DEFINITIF'},{key:'agent',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'}],references:{partners:[{key:'parent',label:'API Parent'}],projects:[{key:'child',label:'API Projet',partnerKey:'parent'}],operationTypes:[]}});
 foreign=createUserReferenceFixtureSet({namespace:namespace+'x',entity:2,users:[{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'foreign',label:'API autre entité'}],projects:[{key:'foreignproject',label:'Projet autre entité',partnerKey:'foreign'}],operationTypes:[{key:'foreigntype',label:'Type autre entité'}]}});
 sql("INSERT INTO llx_const(name,entity,value,type,visible,note) VALUES('MJL_AUTH_OTP_ENABLED',1,'1','chaine',0,'Disposable API verification'),('MJL_AUTH_E2E_EXPOSE_TOKENS',1,'1','chaine',0,'Disposable API verification') ON DUPLICATE KEY UPDATE value='1'");
});
test.afterAll(()=>{sql("DELETE FROM llx_const WHERE name IN ('MJL_AUTH_OTP_ENABLED','MJL_AUTH_E2E_EXPOSE_TOKENS') AND entity=1; DROP TRIGGER IF EXISTS api_audit_failure;");});
test('JSON boundary rejects anonymous, malformed, bootstrap injection and cross-origin writes',async({request})=>{
 expect((await session(request)).state).toBe('anonymous');
 expect((await request.get(root+'/partners')).status()).toBe(401);
 expect((await request.get(root+'/auth/session?entity=2')).status()).toBe(400);
 expect((await request.post(root+'/auth/login',{data:{email:'x',password:'y'}})).status()).toBe(403);
 const s=await session(request);
 expect((await request.post(root+'/auth/login',{data:'{"email":"a","email":"b","password":"x"}',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrf_token}})).status()).toBe(400);
 expect((await request.post(root+'/auth/login',{data:{email:'x',password:'x'},headers:{Origin:'https://foreign.invalid','X-CSRF-Token':s.csrf_token}})).status()).toBe(403);
 const unknown=await request.get(root+'/unknown');expect(unknown.status()).toBe(404);expect(unknown.headers()['content-type']).toContain('application/json');
});
test('password failure is recorded; pending OTP cannot read data; verification rotates session and CSRF',async({request})=>{
 const before=Number(scalar("SELECT COUNT(*) FROM llx_events WHERE type='USER_LOGIN_FAILED'"));
 expect((await send(request,'/auth/login',{email:fixture.users.agent.login+'@example.test',password:'Incorrect1!'})).status()).toBe(401);
 expect(Number(scalar("SELECT COUNT(*) FROM llx_events WHERE type='USER_LOGIN_FAILED'"))).toBe(before+1);
 const initial=await session(request);
 expect((await send(request,'/auth/login',{email:fixture.users.agent.login+'@example.test',password:process.env.MJL_TEST_USER_PASSWORD})).status()).toBe(202);
 const pending=await session(request);expect(pending.state).toBe('otp_pending');expect(pending.csrf_token===initial.csrf_token).toBe(false);
 expect((await request.get(root+'/partners')).status()).toBe(401);
 const code=await otp(); expect((await send(request,'/auth/otp/verify',{code})).status()).toBe(200);
 expect((await session(request)).state).toBe('authenticated');
 expect((await send(request,'/auth/otp/verify',{code})).status()).toBe(401);
});
test('REST login UI and Partner UI create, rename, stale edit, cascade and reactivation',async({page,context})=>{
 await page.goto('/index.php');await page.getByLabel('Adresse email').fill(fixture.users.validator.login+'@example.test');await page.getByLabel('Mot de passe',{exact:true}).fill(process.env.MJL_TEST_USER_PASSWORD);await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Vérification',exact:true})).toBeVisible();await page.getByLabel('Code de vérification').fill(await otp());await page.getByRole('button',{name:'Vérifier',exact:true}).click();await expect(page).toHaveURL(/mjlfinancement\/index.php$/);
 await page.goto('/custom/mjlfinancement/partners.php?action=create');await page.getByLabel('Libellé').fill('Partenaire REST');
 const created=page.waitForResponse(r=>r.url().endsWith('/v1/partners')&&r.request().method()==='POST');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();expect((await created).status()).toBe(201);await expect(page).toHaveURL(/partners.php\?id=\d+$/);
 const id=new URL(page.url()).searchParams.get('id');const stale=await context.newPage();await stale.goto('/custom/mjlfinancement/partners.php?id='+id+'&action=edit');await expect(stale.getByLabel('Libellé')).toHaveValue('Partenaire REST');
 await page.getByRole('link',{name:'Modifier',exact:true}).click();await page.getByLabel('Libellé').fill('Partenaire renommé');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page).toHaveURL(/partners.php\?id=\d+$/);
 await stale.getByLabel('Libellé').fill('Valeur périmée');await stale.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(stale.getByRole('alert')).toContainText('modifiée');await expect(stale.getByLabel('Libellé')).toHaveValue('Valeur périmée');await stale.close({runBeforeUnload:false});
 await page.goto('/custom/mjlfinancement/partners.php?id='+fixture.partners.parent);await page.getByRole('button',{name:'Désactiver',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Projets actifs liés');await page.getByRole('button',{name:'Confirmer la désactivation',exact:true}).click();await expect(page.getByRole('button',{name:'Activer',exact:true})).toBeVisible();
 expect(scalar('SELECT fk_statut FROM llx_projet WHERE rowid='+fixture.projects.child)).toBe('2');
 await page.getByRole('button',{name:'Activer',exact:true}).click();await page.getByRole('button',{name:'Confirmer l’activation',exact:true}).click();await expect(page.getByRole('button',{name:'Désactiver',exact:true})).toBeVisible();expect(scalar('SELECT fk_statut FROM llx_projet WHERE rowid='+fixture.projects.child)).toBe('2');
});
test('Partner command authorization, entity scope, one-use tokens and audit rollback',async({request})=>{
 await login(request);
 expect((await request.get(root+'/partners/'+foreign.partners.foreign)).status()).toBe(404);
 const t=await token(request,'createPartner');expect((await send(request,'/partners',{label:'One use'},'POST',t)).status()).toBe(201);expect((await send(request,'/partners',{label:'Replay'},'POST',t)).status()).toBe(403);
 sql("CREATE TRIGGER api_audit_failure BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected audit failure'");
 try {const t2=await token(request,'createPartner');expect((await send(request,'/partners',{label:'Must rollback'},'POST',t2)).status()).toBe(503);expect(scalar("SELECT COUNT(*) FROM llx_societe WHERE nom='Must rollback'")).toBe('0');} finally {sql('DROP TRIGGER api_audit_failure');}
 expect((await request.post('/custom/mjlfinancement/partners.php',{form:{action:'create',label:'Legacy bypass'}})).status()).toBeGreaterThanOrEqual(400);
 await send(request,'/auth/session',undefined,'DELETE');await login(request,'agent');expect((await send(request,'/submission-tokens',{operation_id:'createPartner',path_parameters:{}})).status()).toBe(403);
});
test('idle and absolute expiry apply to API and HTML; logout removes access',async({page,context})=>{
 await login(page.request);
 const initial=await session(page.request);
 expect(Date.parse(initial.absolute_expires_at)-Date.parse(initial.authenticated_at)).toBe(86400000);
 await alterClock(context,32400,3600);
 expect((await page.request.get(root+'/partners')).status()).toBe(200);
 await alterClock(context,86401,86401);
 const expired=await page.request.get(root+'/partners');expect(expired.status()).toBe(401);expect((await expired.json()).error.code).toBe('session_expired');
 await login(page.request);await alterClock(context,86401,0);await page.goto('/custom/mjlfinancement/projects.php');await expect(page.getByRole('heading',{name:'Connexion',exact:true})).toBeVisible();
 await login(page.request);const before=await session(page.request);await new Promise(r=>setTimeout(r,1100));expect((await session(page.request)).idle_expires_at).toBe(before.idle_expires_at);
 expect((await send(page.request,'/auth/session',undefined,'DELETE')).status()).toBe(204);expect((await page.request.get(root+'/partners')).status()).toBe(401);
});
test('expired OTP can resend and recover, mail-disabled API fails closed',async({request})=>{
 await send(request,'/auth/login',{email:fixture.users.agent.login+'@example.test',password:process.env.MJL_TEST_USER_PASSWORD});
 sql(`UPDATE llx_mjlfinancement_login_otp SET date_expiry=DATE_SUB(NOW(),INTERVAL 1 SECOND),date_last_send=DATE_SUB(NOW(),INTERVAL 61 SECOND) WHERE fk_user=${fixture.users.agent.id} AND status='pending'`);
 expect((await send(request,'/auth/otp/resend',{})).status()).toBe(200);expect((await send(request,'/auth/otp/verify',{code:await otp()})).status()).toBe(200);
 sql("UPDATE llx_const SET value='0' WHERE name='MJL_AUTH_OTP_ENABLED' AND entity=1");
 try {expect((await request.get(root+'/partners')).status()).toBe(503);}finally{sql("UPDATE llx_const SET value='1' WHERE name='MJL_AUTH_OTP_ENABLED' AND entity=1");}
});
test('invitation proof is private, accepted through REST once, and clears an existing session',async({page})=>{
 const name=namespace+'.invited';
 const result=JSON.parse(execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/auth-parallel-worker.php'],{input:JSON.stringify({operation:'issue',login:name,email:name+'@example.test',barrier:''}),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 const link=new URL(result[0],process.env.MJL_BASE_URL);const proof={selector:link.searchParams.get('selector'),verifier:new URLSearchParams(link.hash.slice(1)).get('verifier')};
 await registerSecret('auth verifier',proof.verifier);await registerSecret('auth selector',proof.selector);
 expect((await (await send(page.request,'/auth/invitations/inspect',{...proof,verifier:'wrong'})).json()).data.valid).toBe(false);
 await page.goto(link.pathname+link.search);await expect(page.getByRole('alert')).toContainText('invalide');await expect(page.getByText(name+'@example.test',{exact:true})).toHaveCount(0);
 await login(page.request);
 await page.goto(link.toString());await expect(page.getByText(name+'@example.test',{exact:true})).toBeVisible();expect(new URL(page.url()).hash).toBe('');
 const password='Aa1!'+require('node:crypto').randomBytes(16).toString('hex');await registerSecret('test credential',password);
 await page.getByLabel('Nouveau mot de passe',{exact:true}).fill(password);await page.getByLabel('Confirmer le mot de passe',{exact:true}).fill(password);
 const accepted=page.waitForResponse(r=>r.url().endsWith('/auth/invitations/accept'));await page.getByRole('button',{name:'Enregistrer le mot de passe',exact:true}).click();expect((await accepted).status()).toBe(200);await expect(page.getByRole('heading',{name:'Connexion',exact:true})).toBeVisible();
 expect((await page.request.get(root+'/partners')).status()).toBe(401);
 expect((await send(page.request,'/auth/invitations/accept',{...proof,password,password_confirmation:password})).status()).toBe(422);
});
test('REST reset request/fragment UI replaces password, invalidates other sessions, and does not enumerate users',async({page,browser})=>{
 const other=await browser.newContext();try{
 await login(other.request,'agent');
 const unknown=await send(page.request,'/auth/password-resets',{email:'unknown@example.test'});expect(unknown.status()).toBe(202);
 await page.goto('/user/passwordforgotten.php');await page.getByLabel('Adresse email').fill(fixture.users.agent.login+'@example.test');await page.getByRole('button',{name:'Envoyer le lien',exact:true}).click();await expect(page.getByRole('heading',{name:'Consultez votre email'})).toBeVisible();
 const link=new URL(outbox('password_reset').link,process.env.MJL_BASE_URL);const proof={selector:link.searchParams.get('mjlselector'),verifier:new URLSearchParams(link.hash.slice(1)).get('verifier')};await registerSecret('auth verifier',proof.verifier);await registerSecret('auth selector',proof.selector);
 await page.goto(link.toString());await expect(page.getByLabel('Nouveau mot de passe',{exact:true})).toBeVisible();expect(new URL(page.url()).hash).toBe('');
 expect((await send(page.request,'/auth/password-resets/consume',{...proof,password:'weak',password_confirmation:'weak'})).status()).toBe(422);
 const password='Aa1!'+require('node:crypto').randomBytes(16).toString('hex');await registerSecret('test credential',password);await page.getByLabel('Nouveau mot de passe',{exact:true}).fill(password);await page.getByLabel('Confirmer le mot de passe',{exact:true}).fill(password);await page.getByRole('button',{name:'Réinitialiser le mot de passe',exact:true}).click();await expect(page.getByRole('heading',{name:'Connexion',exact:true})).toBeVisible();
 expect((await other.request.get(root+'/partners')).status()).toBe(401);
 expect((await (await send(page.request,'/auth/password-resets/inspect',proof)).json()).data.valid).toBe(false);
 }finally{await other.close();}
});
test('Admin cannot read business references; mobile Partner screen and REST logout remain usable',async({page,context,browser},testInfo)=>{
 const previousEmail=scalar("SELECT IF(email IS NULL,'NULL',CONCAT('0x',HEX(email))) FROM llx_user WHERE entity=0 AND admin=1");
 sql("UPDATE llx_user SET email='api.admin@example.test' WHERE entity=0 AND admin=1");
 try {
  expect((await send(page.request,'/auth/login',{email:'api.admin@example.test',password:nativeAdminPassword})).status()).toBe(202);
  expect((await send(page.request,'/auth/otp/verify',{code:await otp()})).status()).toBe(200);
  for (const path of ['/partners','/projects','/operation-types']) expect((await page.request.get(root+path)).status()).toBe(403);
  await send(page.request,'/auth/session',undefined,'DELETE');
  await login(page.request);
  const noJs=await browser.newContext({javaScriptEnabled:false,storageState:await context.storageState()});
  try {const fallback=await noJs.newPage();await fallback.goto(process.env.MJL_BASE_URL+'/custom/mjlfinancement/partners.php');await expect(fallback.locator('body')).toContainText('JavaScript est nécessaire pour utiliser cet écran.');await expect(fallback.getByRole('table')).toHaveCount(0);} finally {await noJs.close();}
  await page.setViewportSize({width:390,height:844});await page.goto('/custom/mjlfinancement/partners.php');await expect(page.getByRole('table',{name:'Partenaires',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('partners-mobile.png'),fullPage:true});
  const loggedOut=page.waitForResponse(r=>r.url().endsWith('/auth/session')&&r.request().method()==='DELETE');await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();expect((await loggedOut).status()).toBe(204);await expect(page.getByRole('heading',{name:'Connexion',exact:true})).toBeVisible();
 } finally {sql("UPDATE llx_user SET email="+(previousEmail==='0x'?"''":previousEmail)+" WHERE entity=0 AND admin=1");}
});
test('logout preserves the session and input when an unsaved-change warning is cancelled',async({page})=>{
 await login(page.request);await page.goto('/custom/mjlfinancement/partners.php?action=create');await page.getByLabel('Libellé').fill('Saisie non enregistrée');
 // Invoke the shared control directly while the Partner page dialog covers the header.
 await page.locator('[data-mjl-api-logout]').evaluate(button=>button.click());
 await expect(page.getByRole('heading',{name:'Modifications non enregistrées'})).toBeVisible();await page.getByRole('button',{name:'Continuer la saisie',exact:true}).click();
 expect((await session(page.request)).state).toBe('authenticated');await expect(page.getByLabel('Libellé')).toHaveValue('Saisie non enregistrée');
 await page.locator('[data-mjl-api-logout]').evaluate(button=>button.click());await page.getByRole('button',{name:'Quitter sans enregistrer',exact:true}).click();await expect(page.getByRole('heading',{name:'Connexion',exact:true})).toBeVisible();expect((await page.request.get(root+'/partners')).status()).toBe(401);
});

test('Project REST screen preserves immutable parent, lifecycle, filters and stale protection', async ({page}) => {
 await login(page.request);
 const parentToken=await token(page.request,'createPartner');
 const parentResponse=await send(page.request,'/partners',{label:'Parent du projet REST'},'POST',parentToken);
 const parentId=(await parentResponse.json()).data.id;
 await page.goto('/custom/mjlfinancement/projects.php?action=create');
 await page.getByLabel('Libellé').fill('Projet REST');
 await page.getByRole('combobox',{name:'Partenaire',exact:true}).selectOption(parentId);
 const created=page.waitForResponse(r=>r.url().endsWith('/projects')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
 const createResponse=await created;expect(createResponse.status()).toBe(201);
 await expect(page).toHaveURL(/projects.php\?id=\d+$/);
 const id=new URL(page.url()).searchParams.get('id');
 await expect(page.locator('.mjl-reference-detail')).toContainText('Parent du projet REST');
 const original=(await (await page.request.get(root+'/projects/'+id)).json()).data;
 expect(original.partner_id).toBe(parentId);expect(original.active).toBe(true);expect(original.ref).toBeTruthy();
 await page.getByRole('link',{name:'Modifier',exact:true}).click();
 await expect(page.locator('select[name=partner_id]')).toHaveCount(0);
 await page.getByLabel('Libellé').fill('Projet REST renommé');
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Projet REST renommé',exact:true})).toBeVisible();
 const row=(await (await page.request.get(root+'/projects/'+id)).json()).data;
 expect(row.partner_id).toBe(parentId);expect(row.ref).toBe(original.ref);
 const stale=await token(page.request,'renameProject',id);
 expect((await send(page.request,'/projects/'+id,{label:'Ancienne saisie',fingerprint:original.fingerprint},'PATCH',stale)).status()).toBe(409);
 const immutable=await token(page.request,'renameProject',id);
 expect((await send(page.request,'/projects/'+id,{label:'Déplacement interdit',partner_id:String(fixture.partners.parent),fingerprint:row.fingerprint},'PATCH',immutable)).status()).toBe(400);
 const filtered=(await (await page.request.get(root+'/projects?partner_id='+parentId)).json()).data;
 expect(filtered.map(p=>p.id)).toEqual([id]);
 await page.getByRole('button',{name:'Désactiver',exact:true}).click();
 await page.getByRole('button',{name:'Confirmer la désactivation',exact:true}).click();
 await expect(page.getByRole('button',{name:'Activer',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Activer',exact:true}).click();
 await page.getByRole('button',{name:'Confirmer l’activation',exact:true}).click();
 await expect(page.getByRole('button',{name:'Désactiver',exact:true})).toBeVisible();
 const parent=(await (await page.request.get(root+'/partners/'+parentId)).json()).data;
 const deactivateParent=await token(page.request,'setPartnerActive',parentId);
 expect((await send(page.request,'/partners/'+parentId+'/activation',{active:false,fingerprint:parent.fingerprint},'PUT',deactivateParent)).status()).toBe(200);
 const closed=(await (await page.request.get(root+'/projects/'+id)).json()).data;expect(closed.active).toBe(false);
 const reopen=await token(page.request,'setProjectActive',id);
 expect((await send(page.request,'/projects/'+id+'/activation',{active:true,fingerprint:closed.fingerprint},'PUT',reopen)).status()).toBe(422);
 const invalidParent=await token(page.request,'createProject');
 expect((await send(page.request,'/projects',{label:'Projet refusé',partner_id:parentId},'POST',invalidParent)).status()).toBe(422);
 expect((await page.request.post('/custom/mjlfinancement/projects.php',{form:{action:'create',label:'Bypass'}})).status()).toBeGreaterThanOrEqual(400);
});

test('Operation Type REST screen creates, renames and changes lifecycle with responsive and no-JS states', async ({page,context,browser},testInfo) => {
 await login(page.request);
 await page.goto('/custom/mjlfinancement/operationtypes.php?action=create');
 await page.getByLabel('Libellé').fill('Type REST');
 const created=page.waitForResponse(r=>r.url().endsWith('/operation-types')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
 const response=await created;expect(response.status()).toBe(201);
 await expect(page).toHaveURL(/operationtypes.php\?id=\d+$/);
 await page.getByRole('link',{name:'Modifier',exact:true}).click();
 await page.getByLabel('Libellé').fill('Type REST renommé');
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Type REST renommé',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Désactiver',exact:true}).click();
 await page.getByRole('button',{name:'Confirmer la désactivation',exact:true}).click();
 await expect(page.getByRole('button',{name:'Activer',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Activer',exact:true}).click();
 await page.getByRole('button',{name:'Confirmer l’activation',exact:true}).click();
 await expect(page.getByRole('button',{name:'Désactiver',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 for (const [route,title] of [['projects','Projets'],['operationtypes','Types d’Opération']]) {
  await page.goto('/custom/mjlfinancement/'+route+'.php');
  await expect(page.getByRole('table',{name:title,exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(route+'-mobile.png'),fullPage:true});
 }
 const noJs=await browser.newContext({javaScriptEnabled:false,storageState:await context.storageState()});
 try {
  const fallback=await noJs.newPage();
  for (const route of ['projects','operationtypes']) {
   await fallback.goto(process.env.MJL_BASE_URL+'/custom/mjlfinancement/'+route+'.php');
   await expect(fallback.locator('body')).toContainText('JavaScript est nécessaire pour utiliser cet écran.');
   await expect(fallback.getByRole('table')).toHaveCount(0);
  }
 } finally {await noJs.close();}
 expect((await page.request.post('/custom/mjlfinancement/operationtypes.php',{form:{action:'create',label:'Bypass'}})).status()).toBeGreaterThanOrEqual(400);
});
test('Reference REST additions enforce role/entity scope, token binding, stale writes and audit rollback', async ({request}) => {
 await login(request);
 const resources=[];
 for (const [path,operation,body] of [
  ['/projects','Project',{label:'Projet sécurité REST',partner_id:String(fixture.partners.parent)}],
  ['/operation-types','OperationType',{label:'Type sécurité REST'}]
 ]) {
  const crossToken=await token(request,'createPartner');
  expect((await send(request,path,body,'POST',crossToken)).status()).toBe(403);
  const t=await token(request,'create'+operation);
  const response=await send(request,path,body,'POST',t);expect(response.status()).toBe(201);
  const id=(await response.json()).data.id;
  expect((await send(request,path,body,'POST',t)).status()).toBe(403);
  const original=(await (await request.get(root+path+'/'+id)).json()).data;
  const rename=await token(request,'rename'+operation,id);
  expect((await send(request,path+'/'+id,{label:body.label+' modifié',fingerprint:original.fingerprint},'PATCH',rename)).status()).toBe(200);
  const stale=await token(request,'rename'+operation,id);
  expect((await send(request,path+'/'+id,{label:body.label,fingerprint:original.fingerprint},'PATCH',stale)).status()).toBe(409);
  sql("CREATE TRIGGER api_audit_failure BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected audit failure'");
  try {
   const current=(await (await request.get(root+path+'/'+id)).json()).data;
   const broken=await token(request,'rename'+operation,id);
   expect((await send(request,path+'/'+id,{label:'Must roll back',fingerprint:current.fingerprint},'PATCH',broken)).status()).toBe(503);
   expect((await (await request.get(root+path+'/'+id)).json()).data.label).toBe(body.label+' modifié');
  } finally {sql('DROP TRIGGER api_audit_failure');}
  const current=(await (await request.get(root+path+'/'+id)).json()).data;
  const deactivate=await token(request,'set'+operation+'Active',id);
  expect((await send(request,path+'/'+id+'/activation',{active:false,fingerprint:current.fingerprint},'PUT',deactivate)).status()).toBe(200);
  resources.push({path,operation,id});
 }
 expect((await request.get(root+'/projects/'+foreign.projects.foreignproject)).status()).toBe(404);
 expect((await request.get(root+'/operation-types/'+foreign.operationTypes.foreigntype)).status()).toBe(404);
 const foreignParent=await token(request,'createProject');
 expect((await send(request,'/projects',{label:'Cross entity',partner_id:String(foreign.partners.foreign)},'POST',foreignParent)).status()).toBe(422);
 await send(request,'/auth/session',undefined,'DELETE');
 for (const role of ['agent','supervisor']) {
  await login(request,role);
  for (const {path,operation,id} of resources) {
   expect((await request.get(root+path+'/'+id)).status()).toBe(404);
   const rows=(await (await request.get(root+path)).json()).data;
   expect(rows.every(row=>row.active&&row.id!==id)).toBe(true);
   expect((await send(request,'/submission-tokens',{operation_id:'create'+operation,path_parameters:{}})).status()).toBe(403);
   expect((await send(request,path,{label:'Forbidden'},'POST','not-a-token')).status()).toBe(403);
  }
  await send(request,'/auth/session',undefined,'DELETE');
 }
});
