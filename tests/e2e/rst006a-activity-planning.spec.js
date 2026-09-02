const { test, expect } = require('@playwright/test');
const { createPhase1FixtureSet } = require('../helpers/phase1-fixture');
const { composeExec, scalar, sql } = require('../helpers/mjl-test-runtime');

const password = process.env.MJL_TEST_USER_PASSWORD;
let fixture;
let created;

test.describe.configure({ mode: 'serial' });

function phpBody(body) {
  return "<?php define('NOLOGIN',1); require '/var/www/html/main.inc.php'; " + body;
}

function command(actorId, expression) {
  const source = phpBody(
    "require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';" +
    '$conf->entity=1; $actor=new User($db); if ($actor->fetch(' + Number(actorId) + ')<=0) exit(2);' +
    "$command=new MjlActivityCommand($db, function(){ return '2026-09-02'; }, 1);" +
    'echo json_encode(' + expression + ', JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);'
  );
  return JSON.parse(composeExec('dolibarr', ['php'], 'utf8', source));
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
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' },
      { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire RST-006A' }],
      projects: [{ key: 'project', label: 'Projet RST-006A', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type RST-006A' }],
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
