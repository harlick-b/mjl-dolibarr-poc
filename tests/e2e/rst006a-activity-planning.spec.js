const { test, expect } = require('@playwright/test');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { composeExec, privilegedScalar, scalar, sql } = require('../helpers/mjl-test-runtime');
const { LIST_PAGE_CASES, INVALID_FILTER_CASES, LITERAL_SEARCH_CASES } = require('./cases/rst006a.cases');

const password = process.env.MJL_TEST_USER_PASSWORD;
let fixture;
let secondary;
let created;

test.describe.configure({ mode: 'serial' });

function phpBody(body) {
  return "<?php define('NOLOGIN',1); require '/var/www/html/main.inc.php'; " + body;
}

function commandAt(actorId, date, expression) {
  const source = phpBody(
    "require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';" +
    '$conf->entity=1; $actor=new User($db); if ($actor->fetch(' + Number(actorId) + ')<=0) exit(2);' +
    `$command=new MjlActivityCommand($db, function(){ return '${date}'; }, 1);` +
    'echo json_encode(' + expression + ', JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);'
  );
  return JSON.parse(composeExec('dolibarr', ['php'], 'utf8', source));
}
function command(actorId, expression) { return commandAt(actorId, '2026-09-02', expression); }

function activityWorker(request) {
  const canonical = JSON.stringify(request);
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/rst006a-parallel-worker.php'], { env: process.env, stdio: ['pipe','pipe','pipe'] });
    const stdout=[];const stderr=[];
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('RST-006A worker exceeded its bounded deadline.'));},15000);
    child.stdout.on('data',(chunk)=>stdout.push(Buffer.from(chunk)));child.stderr.on('data',(chunk)=>stderr.push(Buffer.from(chunk)));
    child.once('error',(error)=>{clearTimeout(timer);reject(error);});
    child.once('close',(code)=>{clearTimeout(timer);if(code!==0)return reject(new Error(`RST-006A worker failed: ${Buffer.concat(stderr).toString('utf8').trim()}`));try{resolve(JSON.parse(Buffer.concat(stdout).toString('utf8').trim()));}catch(_){reject(new Error('RST-006A worker returned invalid JSON.'));}});
    child.stdin.end(canonical);
  });
}

async function concurrentActivityWorkers(first, second) {
  const barrier=crypto.randomBytes(16).toString('hex');
  return Promise.all([activityWorker({...first,barrier,lock_wait_timeout:5}),activityWorker({...second,barrier,lock_wait_timeout:5})]);
}

function expectOneWinner(results) {
  expect(results.map((result)=>result.code).sort()).toEqual(['OK','STALE_VERSION']);
}

async function expectNoOpenTransactions() {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (privilegedScalar('SELECT COUNT(*) FROM information_schema.INNODB_TRX') === '0') return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  expect(privilegedScalar('SELECT COUNT(*) FROM information_schema.INNODB_TRX')).toBe('0');
}

function structure(name = 'Activité RST-006A') {
  return "array(" +
    "'partner_id'=>'" + fixture.partners.partner + "'," +
    "'project_id'=>'" + fixture.projects.project + "'," +
    "'name'=>'" + name + "'," +
    "'description'=>'Planification vérifiée de bout en bout'," +
    "'date_start'=>'2032-01-01','date_end'=>'2032-12-31','authorized_amount'=>'1000'," +
    "'operations'=>array(" +
      "array('client_key'=>'op-1','name'=>'Préparation','type_id'=>'" + fixture.operationTypes.type + "','authorized_amount'=>'400')," +
      "array('client_key'=>'op-2','name'=>'Réalisation','type_id'=>'" + fixture.operationTypes.type + "','authorized_amount'=>'600')" +
    '))';
}
function oneOperationStructure(name, amount, dateStart = '2032-01-01') {
  return "array(" +
    "'partner_id'=>'" + fixture.partners.partner + "','project_id'=>'" + fixture.projects.project + "'," +
    "'name'=>'" + name + "','description'=>'Contrat de frontière RST-006A'," +
    "'date_start'=>'" + dateStart + "','date_end'=>'2032-12-31','authorized_amount'=>'" + amount + "'," +
    "'operations'=>array(array('client_key'=>'only','name'=>'Opération unique','type_id'=>'" + fixture.operationTypes.type + "','authorized_amount'=>'" + amount + "')))";
}

async function login(page, loginName) {
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(loginName);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

test.beforeAll(() => {
  fixture = createPhase1FixtureSet({
    namespace: 'rst006a.primary',
    entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' },
      { key: 'agent2', role: 'AGENT_SAISIE' },
      { key: 'former', role: 'AGENT_SAISIE' },
      { key: 'successor', role: 'AGENT_SAISIE' },
      { key: 'norole', role: null },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire RST-006A' }],
      projects: [{ key: 'project', label: 'Projet RST-006A', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type RST-006A' }],
    },
  });
  secondary = createPhase1FixtureSet({
    namespace: 'rst006a.secondary', entity: 2,
    users: [{ key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire autre entité' }],
      projects: [{ key: 'project', label: 'Projet autre entité', partnerKey: 'partner' }],
      operationTypes: [],
    },
  });
});

test('create-and-submit allocates the canonical reference, primary assignment, balance, and immutable revision atomically', () => {
  created = command(fixture.users.agent.id, '$command->createAndSubmit(' + structure() + ',$actor)');
  expect(created.code).toBe('OK');
  expect(created.version).toBe(2);
  expect(scalar('SELECT ref FROM llx_mjlfinancement_activity WHERE rowid=' + created.activity_id)).toBe('ACT-000001');
  expect(Number(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE fk_activity=' + created.activity_id + ' AND fk_user=' + fixture.users.agent.id + ' AND is_primary=1 AND date_end IS NULL'))).toBe(1);
  expect(Number(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_activity_revision WHERE rowid=' + created.revision_id + ' AND revision_number=1'))).toBe(1);
  expect(Number(scalar('SELECT SUM(authorized_amount) FROM llx_mjlfinancement_operation WHERE fk_activity=' + created.activity_id + ' AND date_removed IS NULL'))).toBe(1000);
});

test('separation of duties and exact revision review produce a terminal final validation', () => {
  expect(command(fixture.users.agent.id, "$command->reviewRevision('" + created.activity_id + "','" + created.revision_id + "','2',$actor,'PREVALIDATED')").code).toBe('FORBIDDEN');
  const prevalidated = command(fixture.users.supervisor.id, "$command->reviewRevision('" + created.activity_id + "','" + created.revision_id + "','2',$actor,'PREVALIDATED')");
  expect(prevalidated).toMatchObject({ code: 'OK', version: 3 });
  const final = command(fixture.users.validator.id, "$command->reviewRevision('" + created.activity_id + "','" + created.revision_id + "','3',$actor,'FINAL_VALIDATED')");
  expect(final).toMatchObject({ code: 'OK', version: 4 });
  expect(scalar('SELECT validation_status FROM llx_mjlfinancement_activity WHERE rowid=' + created.activity_id)).toBe('FINAL_VALIDATED');
  expect(command(fixture.users.validator.id, "$command->reviewRevision('" + created.activity_id + "','" + created.revision_id + "','4',$actor,'FINAL_VALIDATED')").code).toBe('FORBIDDEN');
});

test('guarded Activity UI is French-first, assignment-scoped, and uses one route-owned script', async ({ browser, request }) => {
  const anonymous = await request.get('/custom/mjlfinancement/activities.php');
  expect(anonymous.status()).toBe(403);
  expect(await anonymous.text()).toBe('Forbidden');
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.agent');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.getByRole('heading', { name: 'Activités' })).toBeVisible();
  await expect(page.getByText('ACT-000001')).toBeVisible();
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  await expect(page.getByRole('group', { name: '1. Informations générales' })).toBeVisible();
  await expect(page.getByRole('group', { name: '4. Vérification' })).toBeVisible();
  await expect(page.locator('script[src*="activities.js"]')).toHaveCount(1);
  await context.close();
});

test('strict decimal and unexpected structures fail without consuming a reference', () => {
  const before = scalar('SELECT next_value FROM llx_mjlfinancement_activity_reference_sequence WHERE entity=1');
  const invalid = command(fixture.users.agent.id, "$command->createDraft(array('partner_id'=>'+1'),$actor)");
  expect(invalid.code).toBe('INVALID_INPUT');
  expect(scalar('SELECT next_value FROM llx_mjlfinancement_activity_reference_sequence WHERE entity=1')).toBe(before);
});

test('signed BIGINT maximum succeeds while arithmetic overflow rolls back without consuming a reference', () => {
  const maximum='9223372036854775807';
  const accepted=command(fixture.users.agent.id,`$command->createDraft(${oneOperationStructure('Maximum BIGINT',maximum)},$actor)`);
  expect(accepted).toMatchObject({code:'OK',version:1});
  expect(scalar(`SELECT CAST(draft_authorized_amount AS CHAR) FROM llx_mjlfinancement_activity WHERE rowid=${accepted.activity_id}`)).toBe(maximum);
  const before=scalar('SELECT next_value FROM llx_mjlfinancement_activity_reference_sequence WHERE entity=1');
  const overflowing="array('partner_id'=>'"+fixture.partners.partner+"','project_id'=>'"+fixture.projects.project+"','name'=>'Somme BIGINT invalide','description'=>'Contrat de frontière RST-006A','date_start'=>'2032-01-01','date_end'=>'2032-12-31','authorized_amount'=>'"+maximum+"','operations'=>array(array('client_key'=>'maximum','name'=>'Maximum','type_id'=>'"+fixture.operationTypes.type+"','authorized_amount'=>'"+maximum+"'),array('client_key'=>'extra','name'=>'Dépassement','type_id'=>'"+fixture.operationTypes.type+"','authorized_amount'=>'1')))";
  expect(command(fixture.users.agent.id,`$command->createAndSubmit(${overflowing},$actor)`).code).toBe('CONFLICT');
  expect(scalar('SELECT next_value FROM llx_mjlfinancement_activity_reference_sequence WHERE entity=1')).toBe(before);
});

test('deactivated references reject new use without reference allocation but remain valid when unchanged', () => {
  const draft=command(fixture.users.agent.id,`$command->createDraft(${oneOperationStructure('Références désactivées','1000')},$actor)`);
  const operationId=scalar(`SELECT rowid FROM llx_mjlfinancement_operation WHERE fk_activity=${draft.activity_id}`);
  sql(`UPDATE llx_societe SET status=0 WHERE rowid=${fixture.partners.partner};UPDATE llx_projet SET fk_statut=0 WHERE rowid=${fixture.projects.project};UPDATE llx_mjlfinancement_operation_type SET is_active=0 WHERE rowid=${fixture.operationTypes.type}`);
  try {
    const before=scalar('SELECT next_value FROM llx_mjlfinancement_activity_reference_sequence WHERE entity=1');
    expect(command(fixture.users.agent.id,`$command->createDraft(${oneOperationStructure('Nouvel usage désactivé','1000')},$actor)`).code).toBe('CONFLICT');
    expect(scalar('SELECT next_value FROM llx_mjlfinancement_activity_reference_sequence WHERE entity=1')).toBe(before);
    const unchanged="array('partner_id'=>'"+fixture.partners.partner+"','project_id'=>'"+fixture.projects.project+"','name'=>'Références désactivées conservées','description'=>'Contrat de frontière RST-006A','date_start'=>'2032-01-01','date_end'=>'2032-12-31','authorized_amount'=>'1000','operations'=>array(array('id'=>'"+operationId+"','expected_version'=>'1','client_key'=>'only','name'=>'Opération unique','type_id'=>'"+fixture.operationTypes.type+"','authorized_amount'=>'1000')))";
    expect(command(fixture.users.agent.id,`$command->saveStructure('${draft.activity_id}','1',${unchanged},$actor)`)).toMatchObject({code:'OK',version:2});
  } finally {
    sql(`UPDATE llx_societe SET status=1 WHERE rowid=${fixture.partners.partner};UPDATE llx_projet SET fk_statut=1 WHERE rowid=${fixture.projects.project};UPDATE llx_mjlfinancement_operation_type SET is_active=1 WHERE rowid=${fixture.operationTypes.type}`);
  }
});

test('start-date freeze forbids structural return while unchanged submitted review can finish', () => {
  const activity=commandAt(fixture.users.agent.id,'2026-09-02',`$command->createAndSubmit(${oneOperationStructure('Gel après démarrage','1000','2026-09-03')},$actor)`);
  expect(commandAt(fixture.users.supervisor.id,'2026-09-04',`$command->reviewRevision('${activity.activity_id}','${activity.revision_id}','2',$actor,'RETURNED_SUPERVISOR','Retour trop tardif')`).code).toBe('CONFLICT');
  expect(commandAt(fixture.users.supervisor.id,'2026-09-04',`$command->reviewRevision('${activity.activity_id}','${activity.revision_id}','2',$actor,'PREVALIDATED')`)).toMatchObject({code:'OK',version:3});
  expect(commandAt(fixture.users.validator.id,'2026-09-04',`$command->reviewRevision('${activity.activity_id}','${activity.revision_id}','3',$actor,'FINAL_VALIDATED')`)).toMatchObject({code:'OK',version:4});
});

test('an assigned Agent abandons an unsubmitted draft and a Validator restores one primary assignment before start', () => {
  const draft = command(fixture.users.agent.id, '$command->createDraft(' + structure('Brouillon abandonné') + ',$actor)');
  expect(draft).toMatchObject({ code: 'OK', version: 1 });
  const abandoned = command(fixture.users.agent.id, "$command->abandonDraft('" + draft.activity_id + "','1',$actor,'Activité créée par erreur')");
  expect(abandoned).toMatchObject({ code: 'OK', version: 2 });
  expect(scalar('SELECT validation_status FROM llx_mjlfinancement_activity WHERE rowid=' + draft.activity_id)).toBe('ABANDONED');
  expect(Number(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE fk_activity=' + draft.activity_id + ' AND date_end IS NULL'))).toBe(0);
  const restored = command(fixture.users.validator.id, "$command->restoreDraft('" + draft.activity_id + "','2',$actor,'" + fixture.users.agent.id + "','Restauration approuvée')");
  expect(restored).toMatchObject({ code: 'OK', version: 3 });
  expect(Number(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE fk_activity=' + draft.activity_id + ' AND is_primary=1 AND date_end IS NULL'))).toBe(1);
});

test('a returned Activity requires a structural change before resubmission and preserves its total', () => {
  const returned = command(fixture.users.agent.id, '$command->createAndSubmit(' + structure('Cycle de correction') + ',$actor)');
  const decision = command(fixture.users.supervisor.id, "$command->reviewRevision('" + returned.activity_id + "','" + returned.revision_id + "','2',$actor,'RETURNED_SUPERVISOR','Préciser la préparation')");
  expect(decision).toMatchObject({ code: 'OK', version: 3 });
  expect(command(fixture.users.agent.id, "$command->submitRevision('" + returned.activity_id + "','3',$actor)").code).toBe('CONFLICT');
  const firstId = scalar('SELECT MIN(rowid) FROM llx_mjlfinancement_operation WHERE fk_activity=' + returned.activity_id);
  const secondId = scalar('SELECT MAX(rowid) FROM llx_mjlfinancement_operation WHERE fk_activity=' + returned.activity_id);
  const update = "array('partner_id'=>'" + fixture.partners.partner + "','project_id'=>'" + fixture.projects.project +
    "','name'=>'Cycle de correction précisé','description'=>'Planification vérifiée de bout en bout'," +
    "'date_start'=>'2032-01-01','date_end'=>'2032-12-31','authorized_amount'=>'1000','operations'=>array(" +
    "array('id'=>'" + firstId + "','expected_version'=>'1','client_key'=>'op-1','name'=>'Préparation détaillée','type_id'=>'" + fixture.operationTypes.type + "','authorized_amount'=>'400')," +
    "array('id'=>'" + secondId + "','expected_version'=>'1','client_key'=>'op-2','name'=>'Réalisation','type_id'=>'" + fixture.operationTypes.type + "','authorized_amount'=>'600')))";
  expect(command(fixture.users.agent.id, "$command->saveStructure('" + returned.activity_id + "','3'," + update + ',$actor)')).toMatchObject({ code: 'OK', version: 4 });
  expect(command(fixture.users.agent.id, "$command->submitRevision('" + returned.activity_id + "','4',$actor)")).toMatchObject({ code: 'OK', version: 5 });
  expect(Number(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_activity_revision WHERE fk_activity=' + returned.activity_id))).toBe(2);
});

test('audit insertion failure rolls back business data and reference allocation', () => {
  const activities = Number(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_activity'));
  const next = scalar('SELECT next_value FROM llx_mjlfinancement_activity_reference_sequence WHERE entity=1');
  sql("CREATE TRIGGER rst006a_test_audit_failure BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected audit failure'");
  try {
    expect(command(fixture.users.agent.id, '$command->createDraft(' + structure('Échec audit') + ',$actor)').code).toBe('FAILED');
  } finally {
    sql('DROP TRIGGER rst006a_test_audit_failure');
  }
  expect(Number(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_activity'))).toBe(activities);
  expect(scalar('SELECT next_value FROM llx_mjlfinancement_activity_reference_sequence WHERE entity=1')).toBe(next);
});

test('contributors remain cumulative and truthfully snapshotted after a prior contributor changes role', () => {
  const activity = command(fixture.users.former.id, '$command->createAndSubmit(' + structure('Contributeurs cumulatifs') + ',$actor)');
  expect(command(fixture.users.supervisor.id, "$command->reviewRevision('" + activity.activity_id + "','" + activity.revision_id + "','2',$actor,'RETURNED_SUPERVISOR','Compléter la structure')")).toMatchObject({ code: 'OK', version: 3 });
  const transferSource = phpBody(
    "require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivityassignment.class.php';" +
    '$conf->entity=1; $actor=new User($db); $actor->fetch(' + Number(fixture.users.validator.id) + ');' +
    "$result=(new MjlActivityAssignment($db))->changeAssignment('" + activity.activity_id + "','3',$actor,'TRANSFER_PRIMARY','" + fixture.users.successor.id + "','Relève de saisie');echo json_encode($result);"
  );
  expect(JSON.parse(composeExec('dolibarr', ['php'], 'utf8', transferSource))).toMatchObject({ code: 'OK', version: 4 });
  sql(`UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_VERIFICATEUR' WHERE entity=1 AND fk_user=${fixture.users.former.id} AND is_active=1`);
  const firstId = scalar('SELECT MIN(rowid) FROM llx_mjlfinancement_operation WHERE fk_activity=' + activity.activity_id);
  const secondId = scalar('SELECT MAX(rowid) FROM llx_mjlfinancement_operation WHERE fk_activity=' + activity.activity_id);
  const update = "array('partner_id'=>'" + fixture.partners.partner + "','project_id'=>'" + fixture.projects.project +
    "','name'=>'Contributeurs cumulatifs précisés','description'=>'Planification vérifiée de bout en bout'," +
    "'date_start'=>'2032-01-01','date_end'=>'2032-12-31','authorized_amount'=>'1000','operations'=>array(" +
    "array('id'=>'" + firstId + "','expected_version'=>'1','client_key'=>'op-1','name'=>'Préparation enrichie','type_id'=>'" + fixture.operationTypes.type + "','authorized_amount'=>'400')," +
    "array('id'=>'" + secondId + "','expected_version'=>'1','client_key'=>'op-2','name'=>'Réalisation','type_id'=>'" + fixture.operationTypes.type + "','authorized_amount'=>'600')))";
  expect(command(fixture.users.successor.id, "$command->saveStructure('" + activity.activity_id + "','4'," + update + ',$actor)')).toMatchObject({ code: 'OK', version: 5 });
  const submitted = command(fixture.users.successor.id, "$command->submitRevision('" + activity.activity_id + "','5',$actor)");
  expect(submitted).toMatchObject({ code: 'OK', version: 6 });
  expect(scalar(`SELECT role_snapshot FROM llx_mjlfinancement_revision_contributor WHERE fk_revision=${submitted.revision_id} AND fk_user=${fixture.users.former.id}`)).toBe('AGENT_VERIFICATEUR');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_revision_contributor WHERE fk_revision=${submitted.revision_id}`))).toBe(2);
});

test('concurrent submit and abandon commands commit one version and one audit event', async () => {
  const draft=command(fixture.users.agent.id,'$command->createDraft('+structure('Concurrence soumission abandon')+',$actor)');
  const beforeAudit=Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='activity' AND object_id=${draft.activity_id}`));
  const results=await concurrentActivityWorkers(
    {operation:'submit',activity_id:String(draft.activity_id),version:'1',actor_id:String(fixture.users.agent.id)},
    {operation:'abandon',activity_id:String(draft.activity_id),version:'1',actor_id:String(fixture.users.agent.id),reason:'Choix concurrent'},
  );
  expectOneWinner(results);
  expect(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${draft.activity_id}`)).toBe('2');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='activity' AND object_id=${draft.activity_id}`))).toBe(beforeAudit+1);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_activity_revision WHERE fk_activity=${draft.activity_id}`))).toBe(results.find((result)=>result.code==='OK').revision_id?1:0);
  await expectNoOpenTransactions();
});

test('concurrent Supervisor decisions preserve one exact revision decision', async () => {
  const activity=command(fixture.users.agent.id,'$command->createAndSubmit('+structure('Concurrence superviseur')+',$actor)');
  const beforeAudit=Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='activity' AND object_id=${activity.activity_id}`));
  const base={activity_id:String(activity.activity_id),revision_id:String(activity.revision_id),version:'2',actor_id:String(fixture.users.supervisor.id)};
  const results=await concurrentActivityWorkers(
    {operation:'review',...base,decision:'PREVALIDATED',reason:''},
    {operation:'review',...base,decision:'RETURNED_SUPERVISOR',reason:'Correction concurrente'},
  );
  expectOneWinner(results);
  expect(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activity.activity_id}`)).toBe('3');
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_review_decision WHERE fk_revision=${activity.revision_id}`)).toBe('1');
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='activity' AND object_id=${activity.activity_id}`))).toBe(beforeAudit+1);
  await expectNoOpenTransactions();
});

test('concurrent Validator decisions preserve separation and one terminal choice', async () => {
  const activity=command(fixture.users.agent.id,'$command->createAndSubmit('+structure('Concurrence validateur')+',$actor)');
  expect(command(fixture.users.supervisor.id,`$command->reviewRevision('${activity.activity_id}','${activity.revision_id}','2',$actor,'PREVALIDATED')`).code).toBe('OK');
  const base={activity_id:String(activity.activity_id),revision_id:String(activity.revision_id),version:'3',actor_id:String(fixture.users.validator.id)};
  const results=await concurrentActivityWorkers(
    {operation:'review',...base,decision:'FINAL_VALIDATED',reason:''},
    {operation:'review',...base,decision:'RETURNED_VALIDATOR',reason:'Révision concurrente'},
  );
  expectOneWinner(results);
  expect(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activity.activity_id}`)).toBe('4');
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_review_decision WHERE fk_revision=${activity.revision_id} AND stage='VALIDATOR'`)).toBe('1');
  await expectNoOpenTransactions();
});

test('real MariaDB lock timeout returns RETRYABLE_CONFLICT and releases all work', async () => {
  const draft=command(fixture.users.agent.id,'$command->createDraft('+structure('Timeout réel')+',$actor)');
  const beforeVersion=scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${draft.activity_id}`);
  const beforeAudit=scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='activity' AND object_id=${draft.activity_id}`);
  const holder=spawn('docker',['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','-N','-B','--unbuffered','dolidb'],{env:process.env,stdio:['pipe','pipe','pipe']});
  let holderOutput='';holder.stdout.setEncoding('utf8');holder.stdout.on('data',(chunk)=>{holderOutput+=chunk;});
  holder.stdin.write(`START TRANSACTION; SELECT rowid FROM llx_mjlfinancement_activity WHERE rowid=${draft.activity_id} FOR UPDATE; SELECT 'RST006A_LOCKED';\n`);
  const deadline=Date.now()+5000;
  while(!holderOutput.includes('RST006A_LOCKED')&&Date.now()<deadline)await new Promise((resolve)=>setTimeout(resolve,20));
  expect(holderOutput).toContain('RST006A_LOCKED');
  const result=await activityWorker({operation:'submit',activity_id:String(draft.activity_id),version:'1',actor_id:String(fixture.users.agent.id),barrier:'',lock_wait_timeout:1});
  holder.stdin.end('ROLLBACK;\n');
  await new Promise((resolve,reject)=>{holder.once('close',(code)=>code===0?resolve():reject(new Error('Lock holder failed.')));holder.once('error',reject);});
  expect(result.code).toBe('RETRYABLE_CONFLICT');
  expect(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${draft.activity_id}`)).toBe(beforeVersion);
  expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='activity' AND object_id=${draft.activity_id}`)).toBe(beforeAudit);
  await expectNoOpenTransactions();
});

test('real MariaDB deadlock returns RETRYABLE_CONFLICT with complete rollback', async () => {
  const draft=command(fixture.users.agent.id,'$command->createDraft('+structure('Deadlock réel')+',$actor)');
  const beforeVersion=scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${draft.activity_id}`);
  const beforeAudit=scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='activity' AND object_id=${draft.activity_id}`);
  sql('CREATE TABLE rst006a_test_deadlock (rowid INT PRIMARY KEY, touched INT NOT NULL) ENGINE=InnoDB; INSERT INTO rst006a_test_deadlock SELECT seq,0 FROM seq_1_to_100');
  const holder=spawn('docker',['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','-N','-B','--unbuffered','dolidb'],{env:process.env,stdio:['pipe','pipe','pipe']});
  let holderOutput='';holder.stdout.setEncoding('utf8');holder.stdout.on('data',(chunk)=>{holderOutput+=chunk;});
  try {
    holder.stdin.write(`START TRANSACTION; UPDATE rst006a_test_deadlock SET touched=touched+1; SELECT rowid FROM llx_mjlfinancement_activity WHERE rowid=${draft.activity_id} FOR UPDATE; SELECT 'RST006A_DEADLOCK_READY';\n`);
    let deadline=Date.now()+5000;
    while(!holderOutput.includes('RST006A_DEADLOCK_READY')&&Date.now()<deadline)await new Promise((resolve)=>setTimeout(resolve,20));
    expect(holderOutput).toContain('RST006A_DEADLOCK_READY');
    const pending=activityWorker({operation:'abandon',activity_id:String(draft.activity_id),version:'1',actor_id:String(fixture.users.agent.id),reason:'Collision contrôlée',barrier:'',lock_wait_timeout:5});
    deadline=Date.now()+5000;
    while(Number(privilegedScalar('SELECT COUNT(*) FROM information_schema.INNODB_LOCK_WAITS'))<1&&Date.now()<deadline)await new Promise((resolve)=>setTimeout(resolve,20));
    expect(Number(privilegedScalar('SELECT COUNT(*) FROM information_schema.INNODB_LOCK_WAITS'))).toBeGreaterThanOrEqual(1);
    holder.stdin.write(`SELECT rowid FROM llx_user WHERE rowid=${fixture.users.agent.id} FOR UPDATE; SELECT 'RST006A_DEADLOCK_RESOLVED';\n`);
    const result=await pending;
    expect(result.code).toBe('RETRYABLE_CONFLICT');
    holder.stdin.end('ROLLBACK;\n');
    await new Promise((resolve,reject)=>{holder.once('close',(code)=>code===0?resolve():reject(new Error('Deadlock holder failed.')));holder.once('error',reject);});
    expect(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${draft.activity_id}`)).toBe(beforeVersion);
    expect(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE object_type='activity' AND object_id=${draft.activity_id}`)).toBe(beforeAudit);
    await expectNoOpenTransactions();
  } finally {
    if (!holder.killed) holder.kill('SIGKILL');
    sql('DROP TABLE IF EXISTS rst006a_test_deadlock');
  }
});

test('list fixture creates exact pagination cohorts and literal wildcard canaries through aggregate commands', () => {
  const source = phpBody(
    "require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';" +
    `$conf->entity=1;$actor=new User($db);$actor->fetch(${Number(fixture.users.agent.id)});$command=new MjlActivityCommand($db);` +
    `$base=array('partner_id'=>'${fixture.partners.partner}','project_id'=>'${fixture.projects.project}','name'=>'','description'=>'Pagination stable','date_start'=>'2032-01-01','date_end'=>'2032-12-31','authorized_amount'=>'1','operations'=>array(array('client_key'=>'only','name'=>'Opération','type_id'=>'${fixture.operationTypes.type}','authorized_amount'=>'1')));` +
    "$results=array();for($index=1;$index<=101;$index++){$base['name']='Pagination '.str_pad((string)$index,3,'0',STR_PAD_LEFT);$results[]=$command->createDraft($base,$actor)['code'];}" +
    "foreach(array(1,50,51) as $size){for($index=1;$index<=$size;$index++){$base['name']='Cardinalité '.$size.($size===1?' unique':' item '.str_pad((string)$index,3,'0',STR_PAD_LEFT));$results[]=$command->createDraft($base,$actor)['code'];}}" +
    "foreach(array('Recherche % littérale','Recherche _ littérale','<script>window.mjlInjected=true</script>') as $name){$base['name']=$name;$results[]=$command->createDraft($base,$actor)['code'];}echo json_encode($results);"
  );
  const results = JSON.parse(composeExec('dolibarr', ['php'], 'utf8', source));
  expect(results).toHaveLength(206);
  expect(new Set(results)).toEqual(new Set(['OK']));
});

for (const scenario of LIST_PAGE_CASES) test(scenario.name, async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.supervisor');
  const query = new URLSearchParams({ q: scenario.query, ...(scenario.page > 1 ? { page: String(scenario.page) } : {}) });
  await page.goto(`/custom/mjlfinancement/activities.php?${query}`);
  await expect(page.locator('tbody tr')).toHaveCount(scenario.count);
  await expect(page.getByRole('link', { name: 'Précédent' })).toHaveCount(scenario.previous ? 1 : 0);
  await expect(page.getByRole('link', { name: 'Suivant' })).toHaveCount(scenario.next ? 1 : 0);
  const references = await page.locator('tbody tr td:first-child').allTextContents();
  expect(references).toEqual([...references].sort().reverse());
  await context.close();
});

for (const scenario of INVALID_FILTER_CASES) test(scenario.name, async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.supervisor');
  const response = await page.goto(`/custom/mjlfinancement/activities.php?${scenario.query}`);
  expect(response.status()).toBe(scenario.status || 400);
  if (!scenario.status) expect(await response.text()).toBe('Requête non valide');
  await context.close();
});

for (const scenario of LITERAL_SEARCH_CASES) test(scenario.name, async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.supervisor');
  await page.goto(`/custom/mjlfinancement/activities.php?q=${encodeURIComponent(scenario.query)}`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText(`Recherche ${scenario.query} littérale`)).toBeVisible();
  await context.close();
});

test('unrelated presentation parameters are ignored while filters remain effective', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.supervisor');
  const response = await page.goto('/custom/mjlfinancement/activities.php?q=Pagination&mainmenu=project&leftmenu=ignored');
  expect(response.status()).toBe(200);
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await context.close();
});

test('Previous and Next preserve the typed status and Project filters', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.supervisor');
  await page.goto(`/custom/mjlfinancement/activities.php?q=Pagination&status=DRAFT&project_id=${fixture.projects.project}&page=2`);
  for (const name of ['Précédent', 'Suivant']) {
    const url = new URL(await page.getByRole('link', { name }).getAttribute('href'), 'http://example.test');
    expect(url.searchParams.get('q')).toBe('Pagination');
    expect(url.searchParams.get('status')).toBe('DRAFT');
    expect(url.searchParams.get('project_id')).toBe(String(fixture.projects.project));
  }
  await context.close();
});

test('cross-entity Project filters disclose no Project or Activity existence', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.supervisor');
  await page.goto(`/custom/mjlfinancement/activities.php?project_id=${secondary.projects.project}`);
  await expect(page.getByRole('status').getByText('Aucune Activité', { exact: true })).toBeVisible();
  await expect(page.getByText('Projet autre entité')).toHaveCount(0);
  await context.close();
});

test('Activity list and create page remain usable when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await login(page, 'rst006a.primary.agent');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.getByRole('heading', { name: 'Activités' })).toBeVisible();
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  await expect(page.getByRole('button', { name: 'Enregistrer le brouillon' })).toBeVisible();
  await context.close();
});

test('no-role, inactive, unassigned, and Admin actors cannot cross Activity access boundaries', async ({ browser }) => {
  for (const loginName of ['rst006a.primary.norole', 'admin']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/index.php');
    await page.getByLabel('Identifiant').fill(loginName);
    await page.getByLabel('Mot de passe').fill(loginName === 'admin' ? (process.env.DOLI_ADMIN_PASSWORD || 'Admin1234') : password);
    await page.getByRole('button', { name: 'Connexion' }).click();
    const response = await page.goto('/custom/mjlfinancement/activities.php');
    expect(response.status()).toBe(403);
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.agent2');
  await page.goto('/custom/mjlfinancement/activities.php');
  await expect(page.getByRole('status').getByText('Aucune Activité', { exact: true })).toBeVisible();
  expect((await page.goto(`/custom/mjlfinancement/activities.php?id=${created.activity_id}`)).status()).toBe(403);
  sql(`UPDATE llx_user SET statut=0 WHERE rowid=${fixture.users.agent2.id}`);
  try {
    const response = await page.goto('/custom/mjlfinancement/activities.php');
    expect([200, 302, 403]).toContain(response.status());
    await expect(page.getByRole('heading', { name: 'Activités' })).toHaveCount(0);
  } finally { sql(`UPDATE llx_user SET statut=1 WHERE rowid=${fixture.users.agent2.id}`); }
  await context.close();
});

test('oversized and mass-assigned Activity requests fail before mutation', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.agent');
  const before = scalar('SELECT COUNT(*) FROM llx_mjlfinancement_activity');
  const oversized = await page.request.post('/custom/mjlfinancement/activities.php', { form: { padding: 'x'.repeat(70000) } });
  expect(oversized.status()).toBe(403);
  const massAssigned = await page.request.post('/custom/mjlfinancement/activities.php', { form: { action: 'create_draft', admin: '1' } });
  expect(massAssigned.status()).toBe(403);
  expect(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_activity')).toBe(before);
  await context.close();
});

test('missing CSRF and replayed contextual submissions fail with exact mutation counts', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.agent');
  await page.goto('/custom/mjlfinancement/activities.php?action=create');
  await page.selectOption('[name="partner_id"]', String(fixture.partners.partner));
  await page.selectOption('[name="project_id"]', String(fixture.projects.project));
  await page.fill('[name="name"]', 'Preuve CSRF et rejeu');
  await page.fill('[name="description"]', 'Soumission contextuelle à usage unique');
  await page.fill('[name="date_start"]', '2032-01-01');
  await page.fill('[name="date_end"]', '2032-12-31');
  await page.fill('[name="authorized_amount"]', '1000');
  await page.fill('[name="operation_name[]"]', 'Opération contextuelle');
  await page.selectOption('[name="operation_type_id[]"]', String(fixture.operationTypes.type));
  await page.fill('[name="operation_amount[]"]', '1000');
  const before = Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE name='Preuve CSRF et rejeu'"));
  const original = new URLSearchParams(await page.locator('.mjl-activity-form').evaluate((form) => new URLSearchParams(new FormData(form)).toString()));
  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('result') === 'OK'),
    page.locator('.mjl-activity-form button[type="submit"]').first().click(),
  ]);
  const accepted = { status: 200, url: page.url() };
  const freshToken = await page.locator('input[name="token"]').first().getAttribute('value');
  const replayBody = new URLSearchParams(original); replayBody.set('token', freshToken);
  const replay = await context.request.post('/custom/mjlfinancement/activities.php', { data: replayBody.toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, maxRedirects: 0 });
  const missingBody = new URLSearchParams(replayBody); missingBody.delete('token');
  const missing = await context.request.post('/custom/mjlfinancement/activities.php', { data: missingBody.toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, maxRedirects: 0 });
  const outcomes = { accepted, replay: { status: replay.status() }, missing: { status: missing.status() } };
  expect(outcomes.missing.status).toBe(403);
  expect(outcomes.accepted.status).toBe(200);
  expect(new URL(outcomes.accepted.url).searchParams.get('result')).toBe('OK');
  expect(outcomes.replay.status).toBe(403);
  expect(Number(scalar("SELECT COUNT(*) FROM llx_mjlfinancement_activity WHERE name='Preuve CSRF et rejeu'"))).toBe(before + 1);
  await context.close();
});

test('Activity search output escapes stored HTML', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'rst006a.primary.supervisor');
  await page.goto('/custom/mjlfinancement/activities.php?q=window.mjlInjected');
  await expect(page.getByText('<script>window.mjlInjected=true</script>')).toBeVisible();
  expect(await page.evaluate(() => window.mjlInjected)).toBeUndefined();
  await context.close();
});
