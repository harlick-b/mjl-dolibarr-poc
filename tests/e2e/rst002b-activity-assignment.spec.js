const { test, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { composeExec, scalar, sql } = require('../helpers/mjl-test-runtime');

const password = process.env.MJL_TEST_USER_PASSWORD;
const adminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
let primary;
let secondary;
let activityId;

test.describe.configure({ mode: 'serial' });

async function login(page, loginName, credential = password) {
  await page.goto('/user/logout.php').catch(() => {});
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(loginName);
  await page.getByLabel('Mot de passe').fill(credential);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

function phpBody(body) {
  return `<?php define('NOLOGIN',1); require '/var/www/html/main.inc.php'; ${body}`;
}

function moduleCall({ activity = activityId, actor, operation, target, version, reason = 'Motif RST-002B vérifié' }) {
  const source = phpBody(`
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivityassignment.class.php';
    $conf->entity=1; $actor=new User($db); if ($actor->fetch(${Number(actor)})<=0) exit(2);
    $module=new MjlActivityAssignment($db);
    echo json_encode($module->changeAssignment(${Number(activity)},${Number(version)},$actor,'${operation}',${Number(target)},'${reason.replaceAll("'", "\\'")}'));
  `);
  return JSON.parse(composeExec('dolibarr', ['php'], 'utf8', source));
}

function serverCanRead(userId) {
  const source = phpBody(`
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
    $conf->entity=1; $reader=new User($db); if ($reader->fetch(${Number(userId)})<=0) exit(2);
    echo mjl_activity_access_can_read_activity($reader,${activityId}) ? '1' : '0';
  `);
  return composeExec('dolibarr', ['php'], 'utf8', source).trim() === '1';
}

function targetVerifierPasses() {
  const source = phpBody(`
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst006a_schema.lib.php';
    try {
      mjl_rst006a_require_target($db);
      $expected=mjl_rst002b_expected_trigger_map(mjl_rst002b_role_invariant_trigger_statements($db,true));
      $role=[]; $user=[]; foreach($expected as $name=>$definition) { if ($name===$db->prefix().'mjlfinancement_user_admin_bu') $user[$name]=$definition; else $role[$name]=$definition; }
      if (!mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db,$db->prefix().'mjlfinancement_user_role'),$role) || !mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db,$db->prefix().'user'),$user)) throw new RuntimeException('role drift');
      echo 'OK';
    } catch (Throwable $exception) { echo 'REJECTED'; }
  `);
  return composeExec('dolibarr', ['php'], 'utf8', source).trim() === 'OK';
}

function restoreTargetTriggers() {
  const source = phpBody(`
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst006a_schema.lib.php';
    mjl_rst006a_install_guards($db); mjl_rst002b_install_role_invariant_triggers($db,true); echo 'OK';
  `);
  expect(composeExec('dolibarr', ['php'], 'utf8', source).trim()).toBe('OK');
}

function asyncModuleCall(options) {
  const source = phpBody(`
    require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivityassignment.class.php';
    $conf->entity=1; $actor=new User($db); if ($actor->fetch(${Number(options.actor)})<=0) exit(2);
    $result=(new MjlActivityAssignment($db))->changeAssignment(${activityId},${Number(options.version)},$actor,'${options.operation}',${Number(options.target)},'Concurrence RST-002B');
    echo json_encode($result); if (($result['code'] ?? '')==='FAILED') file_put_contents('php://stderr',$db->lasterror());
  `);
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', 'exec', '-T', 'dolibarr', 'php'], { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let error = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { error += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) { reject(new Error(error || `php exited ${code}`)); return; }
      const result = JSON.parse(output); if (error.trim() !== '') result.diagnostic = error.trim(); resolve(result);
    });
    child.stdin.end(source);
  });
}

function asyncMutation(statement) {
  const source = phpBody(`$ok=$db->query('${statement.replaceAll("'", "\\'")}'); echo json_encode(array('code'=>$ok?'OK':'FAILED'));`);
  return new Promise((resolve, reject) => {
    const child=spawn('docker',['compose','exec','-T','dolibarr','php'],{env:process.env,stdio:['pipe','pipe','pipe']}); let output=''; let error='';
    child.stdout.setEncoding('utf8').on('data',(chunk)=>{output+=chunk;}); child.stderr.setEncoding('utf8').on('data',(chunk)=>{error+=chunk;}); child.once('error',reject);
    child.once('close',(code)=>code===0?resolve(JSON.parse(output)):reject(new Error(error||`php exited ${code}`))); child.stdin.end(source);
  });
}

test.beforeAll(() => {
  primary = createPhase1FixtureSet({
    namespace: 'rst002b.primary', entity: 1,
    users: [
      { key: 'agent1', role: 'AGENT_SAISIE' },
      { key: 'agent2', role: 'AGENT_SAISIE' },
      { key: 'inactive-agent', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
      { key: 'norole', role: null },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire RST-002B' }],
      projects: [{ key: 'project', label: 'Projet RST-002B', partnerKey: 'partner' }],
      operationTypes: [],
    },
  });
  secondary = createPhase1FixtureSet({
    namespace: 'rst002b.secondary', entity: 2,
    users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire RST-002B entité 2' }],
      projects: [{ key: 'project', label: 'Projet RST-002B entité 2', partnerKey: 'partner' }],
      operationTypes: [],
    },
  });
  sql(`INSERT INTO llx_mjlfinancement_activity (entity,ref,fk_partner,fk_project,name,description,date_start,date_end,draft_authorized_amount,first_submitted_amount,latest_validated_amount,validation_status,is_cancelled,version,date_creation,fk_user_creat,fk_user_modif) VALUES (1,'ACT-900001',${primary.partners.partner},${primary.projects.project},'Activité affectée RST-002B','Description RST-002B','2032-01-01','2032-12-31',100,NULL,NULL,'DRAFT',0,1,NOW(),${primary.users.validator.id},NULL)`);
  activityId = Number(scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE entity=1 AND ref='ACT-900001'"));
	sql(`UPDATE llx_user SET statut=0 WHERE rowid=${primary.users['inactive-agent'].id}`);
  sql(`INSERT INTO llx_mjlfinancement_activity_assignment (entity,fk_activity,fk_user,is_primary,date_start,date_end,fk_user_assign,reason,date_creation) VALUES (1,${activityId},${primary.users.agent1.id},1,NOW(),NULL,${primary.users.validator.id},'Affectation principale initiale',NOW())`);
  sql(`INSERT INTO llx_mjlfinancement_activity (entity,ref,fk_partner,fk_project,name,description,date_start,date_end,draft_authorized_amount,first_submitted_amount,latest_validated_amount,validation_status,is_cancelled,version,date_creation,fk_user_creat,fk_user_modif) VALUES (2,'ACT-900002',${secondary.partners.partner},${secondary.projects.project},'RST002B_OTHER_ENTITY','Description autre entité','2032-01-01','2032-12-31',100,NULL,NULL,'DRAFT',0,1,NOW(),${secondary.users.validator.id},NULL)`);
});

test('Agent rows are current-assignment filtered while reviewers see all and Admin remains excluded', async ({ browser }) => {
  const cases = [
    ['rst002b.primary.agent1', password, 200, true],
    ['rst002b.primary.agent2', password, 200, false],
    ['rst002b.primary.supervisor', password, 200, true],
    ['rst002b.primary.validator', password, 200, true],
    ['rst002b.primary.norole', password, 403, false],
    ['admin', adminPassword, 403, false],
  ];
  for (const [loginName, credential, status, seesActivity] of cases) {
    const context = await browser.newContext(); const page = await context.newPage();
    await login(page, loginName, credential);
    const response = await page.request.get('/custom/mjlfinancement/activities.php');
    expect(response.status(), loginName).toBe(status);
    const body = await response.text();
    expect(body.includes('ACT-900001'), loginName).toBe(seesActivity);
    expect(body).not.toContain('RST002B_OTHER_ENTITY');
    const post = await page.request.post('/custom/mjlfinancement/activities.php', { form: { action: 'assign', entity: 2 } });
    expect(post.status()).toBe(403);
    await context.close();
  }
  expect(serverCanRead(primary.users.agent1.id)).toBe(true);
  expect(serverCanRead(primary.users.agent2.id)).toBe(false);
});

test('the module adds, removes, and transfers with one version and audit increment', () => {
  expect(moduleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent2.id, version: 1 })).toEqual({ code: 'OK', version: 2 });
  expect(moduleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent2.id, version: 2 }).code).toBe('CONFLICT');
  expect(moduleCall({ actor: primary.users.validator.id, operation: 'REMOVE_ADDITIONAL', target: primary.users.agent2.id, version: 1 }).code).toBe('STALE_VERSION');
  expect(moduleCall({ actor: primary.users.validator.id, operation: 'REMOVE_ADDITIONAL', target: primary.users.agent2.id, version: 2 })).toEqual({ code: 'OK', version: 3 });
  expect(moduleCall({ actor: primary.users.validator.id, operation: 'TRANSFER_PRIMARY', target: primary.users.agent2.id, version: 3 })).toEqual({ code: 'OK', version: 4 });
  expect(Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`))).toBe(4);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE entity=1 AND object_type='activity_assignment' AND activity_id=${activityId}`))).toBe(3);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE entity=1 AND fk_activity=${activityId} AND date_end IS NULL AND is_primary=1 AND fk_user=${primary.users.agent2.id}`))).toBe(1);
});

test('removal is effective on the next server authorization check', async ({ browser }) => {
  expect(serverCanRead(primary.users.agent1.id)).toBe(false);
  expect(serverCanRead(primary.users.agent2.id)).toBe(true);
  const context = await browser.newContext(); const page = await context.newPage();
  await login(page, 'rst002b.primary.agent1');
  const body = await (await page.request.get('/custom/mjlfinancement/activities.php')).text();
  expect(body).not.toContain('ACT-900001');
  await context.close();
});

test('invalid actors, targets, direct history writes, and assigned-user changes fail closed', () => {
  const version = Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`));
  for (const probe of [
    moduleCall({ actor: primary.users.supervisor.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent1.id, version }),
    moduleCall({ actor: secondary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent1.id, version }),
    moduleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: secondary.users.agent.id, version }),
    moduleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.supervisor.id, version }),
	moduleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users['inactive-agent'].id, version }),
  ]) expect(probe.code).toBe('FORBIDDEN');
	expect(moduleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent1.id, version, reason: '   ' }).code).toBe('INVALID_INPUT');
	expect(() => sql(`INSERT INTO llx_mjlfinancement_activity_assignment (entity,fk_activity,fk_user,is_primary,date_start,date_end,fk_user_assign,reason,date_creation) VALUES (1,${activityId},${primary.users.agent1.id},0,'2000-01-01','2000-01-02',${primary.users.validator.id},'Ligne terminée forgée','2000-01-01')`)).toThrow();
	sql(`INSERT INTO llx_mjlfinancement_activity (entity,ref,fk_partner,fk_project,name,description,date_start,date_end,draft_authorized_amount,first_submitted_amount,latest_validated_amount,validation_status,is_cancelled,version,date_creation,fk_user_creat,fk_user_modif) VALUES (1,'ACT-900003',${primary.partners.partner},${primary.projects.project},'Activité sans responsable','Contrôle invariant primaire','2032-01-01','2032-12-31',100,NULL,NULL,'DRAFT',0,1,NOW(),${primary.users.validator.id},NULL)`);
	const orphanId=Number(scalar("SELECT rowid FROM llx_mjlfinancement_activity WHERE entity=1 AND ref='ACT-900003'"));
	expect(moduleCall({ activity: orphanId, actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent1.id, version:1 }).code).toBe('FAILED');
  expect(() => sql(`UPDATE llx_mjlfinancement_activity_assignment SET reason='altéré' WHERE entity=1 AND fk_activity=${activityId} AND date_end IS NULL`)).toThrow();
  expect(() => sql(`DELETE FROM llx_mjlfinancement_activity_assignment WHERE entity=1 AND fk_activity=${activityId}`)).toThrow();
  expect(() => sql(`UPDATE llx_user SET statut=0 WHERE rowid=${primary.users.agent2.id}`)).toThrow();
  expect(() => sql(`UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_VERIFICATEUR' WHERE entity=1 AND fk_user=${primary.users.agent2.id} AND is_active=1`)).toThrow();
  expect(Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`))).toBe(version);
});

test('same-named trigger and index drift keep reads and assignment commands fail-closed', () => {
  const version = Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`));
  sql('DROP TRIGGER llx_mjl_activity_assignment_bi');
  sql("CREATE TRIGGER llx_mjl_activity_assignment_bi BEFORE INSERT ON llx_mjlfinancement_activity_assignment FOR EACH ROW SET @rst002b_noop=1");
  expect(targetVerifierPasses()).toBe(false);
  expect(moduleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent1.id, version }).code).toBe('FAILED');
  restoreTargetTriggers();

  sql('ALTER TABLE llx_mjlfinancement_activity_assignment DROP INDEX idx_mjl_activity_assignment_current_agent, ADD INDEX idx_mjl_activity_assignment_current_agent (entity,fk_user)');
  expect(targetVerifierPasses()).toBe(false);
  expect(moduleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent1.id, version }).code).toBe('FAILED');
  sql('ALTER TABLE llx_mjlfinancement_activity_assignment DROP INDEX idx_mjl_activity_assignment_current_agent, ADD INDEX idx_mjl_activity_assignment_current_agent (entity,fk_user,date_end)');

  sql('DROP TRIGGER llx_mjlfinancement_user_admin_bu');
  sql("CREATE TRIGGER llx_mjlfinancement_user_admin_bu BEFORE UPDATE ON llx_user FOR EACH ROW SET @rst002b_noop=1");
  expect(targetVerifierPasses()).toBe(false);
  restoreTargetTriggers();
  expect(targetVerifierPasses()).toBe(true);
  expect(Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`))).toBe(version);
});

test('audit insertion failure rolls back assignment and Activity version', () => {
  const version = Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`));
  const assignmentCount = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE entity=1 AND fk_activity=${activityId}`));
  sql("CREATE TRIGGER rst002b_test_audit_failure BEFORE INSERT ON llx_mjlfinancement_audit_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected audit failure'");
  try {
    expect(moduleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent1.id, version }).code).toBe('FAILED');
  } finally {
    sql('DROP TRIGGER rst002b_test_audit_failure');
  }
  expect(Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`))).toBe(version);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE entity=1 AND fk_activity=${activityId}`))).toBe(assignmentCount);
});

test('parallel commands serialize and only one stale snapshot can commit', async () => {
  for (let cycle = 0; cycle < 8; cycle += 1) {
    const version = Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`));
    const calls = await Promise.all([
      asyncModuleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent1.id, version }),
      asyncModuleCall({ actor: primary.users.validator.id, operation: 'ADD_ADDITIONAL', target: primary.users.agent1.id, version }),
    ]);
    const diagnostic = `cycle=${cycle};calls=${JSON.stringify(calls)}`;
    expect(calls.filter((result) => result.code === 'OK'), diagnostic).toHaveLength(1);
    expect(calls.filter((result) => ['STALE_VERSION', 'CONFLICT'].includes(result.code)), diagnostic).toHaveLength(1);
    expect(moduleCall({ actor: primary.users.validator.id, operation: 'REMOVE_ADDITIONAL', target: primary.users.agent1.id, version: version + 1 }), diagnostic).toEqual({ code: 'OK', version: version + 2 });
  }
});

test('target role/deactivation and actor deactivation races preserve locked authorization premises', async () => {
  let version=Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`));
  let [command,mutation]=await Promise.all([
    asyncModuleCall({actor:primary.users.validator.id,operation:'ADD_ADDITIONAL',target:primary.users.agent1.id,version}),
    asyncMutation(`UPDATE llx_user SET statut=0 WHERE rowid=${primary.users.agent1.id}`),
  ]);
  expect(command.code==='OK' ? mutation.code : command.code).toMatch(/^(FAILED|FORBIDDEN)$/);
  if (command.code==='OK') { version=command.version; expect(moduleCall({actor:primary.users.validator.id,operation:'REMOVE_ADDITIONAL',target:primary.users.agent1.id,version}).code).toBe('OK'); }
  sql(`UPDATE llx_user SET statut=1 WHERE rowid=${primary.users.agent1.id}`);

  version=Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`));
  [command,mutation]=await Promise.all([
    asyncModuleCall({actor:primary.users.validator.id,operation:'ADD_ADDITIONAL',target:primary.users.agent1.id,version}),
    asyncMutation(`UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_VERIFICATEUR' WHERE entity=1 AND fk_user=${primary.users.agent1.id} AND is_active=1`),
  ]);
  expect(command.code==='OK' ? mutation.code : command.code).toMatch(/^(FAILED|FORBIDDEN)$/);
  if (command.code==='OK') { version=command.version; expect(moduleCall({actor:primary.users.validator.id,operation:'REMOVE_ADDITIONAL',target:primary.users.agent1.id,version}).code).toBe('OK'); }
  sql(`UPDATE llx_mjlfinancement_user_role SET role_code='AGENT_SAISIE' WHERE entity=1 AND fk_user=${primary.users.agent1.id} AND is_active=1`);

  version=Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`));
  [command,mutation]=await Promise.all([
    asyncModuleCall({actor:primary.users.validator.id,operation:'ADD_ADDITIONAL',target:primary.users.agent1.id,version}),
    asyncMutation(`UPDATE llx_user SET statut=0 WHERE rowid=${primary.users.validator.id}`),
  ]);
  expect(['OK','FORBIDDEN','STALE_VERSION']).toContain(command.code); expect(mutation.code).toBe('OK');
  sql(`UPDATE llx_user SET statut=1 WHERE rowid=${primary.users.validator.id}`);
  if (command.code==='OK') expect(moduleCall({actor:primary.users.validator.id,operation:'REMOVE_ADDITIONAL',target:primary.users.agent1.id,version:command.version}).code).toBe('OK');
});

test('rollback refuses populated RST-002B state without changing it', () => {
  const version = Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`));
  const assignments = Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE entity=1 AND fk_activity=${activityId}`));
  expect(() => composeExec('dolibarr', ['php', '/var/www/html/custom/mjlfinancement/scripts/rst002b_activity_assignment.php', '--mode=rollback', '--confirm=RST-002B'], 'utf8')).toThrow();
  expect(Number(scalar(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activityId}`))).toBe(version);
  expect(Number(scalar(`SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE entity=1 AND fk_activity=${activityId}`))).toBe(assignments);
});
