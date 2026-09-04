const { test, expect } = require('@playwright/test');
const { createPhase2FixtureSet } = require('../helpers/phase2-fixture');
const { composeExec, scalar } = require('../helpers/mjl-test-runtime');

const password = process.env.MJL_TEST_USER_PASSWORD;
const adminPassword = process.env.DOLI_ADMIN_PASSWORD || 'Admin1234';
let fixture;
let crossEntityFixture;

async function login(page, login, loginPassword = login === 'admin' ? adminPassword : password) {
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(login);
  await page.getByLabel('Mot de passe').fill(loginPassword);
  await page.getByRole('button', { name: 'Connexion' }).click();
}

function command(actorId, expression) {
  const source = "<?php define('NOLOGIN',1);require '/var/www/html/main.inc.php';require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';$conf->entity=1;$actor=new User($db);if($actor->fetch(" + Number(actorId) + ")<=0)exit(2);$command=new MjlActivityCommand($db,function(){return '2026-09-04';},1);echo json_encode(" + expression + ",JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);";
  return JSON.parse(composeExec('dolibarr', ['php'], 'utf8', source));
}

function assignmentCommand(actorId, activityId, version, operation, targetId) {
  const source = "<?php define('NOLOGIN',1);require '/var/www/html/main.inc.php';require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivityassignment.class.php';$conf->entity=1;$actor=new User($db);if($actor->fetch(" + Number(actorId) + ")<=0)exit(2);echo json_encode((new MjlActivityAssignment($db))->changeAssignment(" + Number(activityId) + "," + Number(version) + ",$actor,'" + operation + "'," + Number(targetId) + ",'Couverture Phase 2'),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);";
  return JSON.parse(composeExec('dolibarr', ['php'], 'utf8', source));
}

test.beforeAll(() => {
  const bulkOperations = Array.from({ length: 47 }, (_, index) => ({ name: `Opération pagination ${String(index + 1).padStart(2, '0')}`, typeKey: 'type', authorizedAmount: '100' }));
  fixture = createPhase2FixtureSet({
    namespace: 'phase2.acceptance', entity: 1,
    users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'additional', role: 'AGENT_SAISIE' }, { key: 'other', role: 'AGENT_SAISIE' }, { key: 'supervisor', role: 'AGENT_VERIFICATEUR' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire Phase 2' }],
      projects: [{ key: 'project', label: 'Projet Phase 2', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type Phase 2' }],
    },
    activities: [
      { key: 'pagination47', agentKey: 'agent', submit: false, partnerKey: 'partner', projectKey: 'project', name: 'Activité pagination Phase 2', description: 'Cohorte de pagination', dateStart: '2031-01-01', dateEnd: '2031-12-31', authorizedAmount: '4700', operations: bulkOperations },
      { key: 'pagination48', agentKey: 'agent', submit: false, partnerKey: 'partner', projectKey: 'project', name: 'Activité pagination complément Phase 2', description: 'Cohorte de pagination', dateStart: '2031-01-01', dateEnd: '2031-12-31', authorizedAmount: '100', operations: [{ name: 'Opération pagination 48', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'draft', agentKey: 'agent', additionalAgentKeys: ['additional'], submit: false, partnerKey: 'partner', projectKey: 'project', name: 'Activité Phase 2', description: 'Couverture Phase 2', dateStart: '2032-01-01', dateEnd: '2032-12-31', authorizedAmount: '1000', operations: [{ name: 'Opération Phase 2', typeKey: 'type', authorizedAmount: '1000' }] },
      { key: 'submitted', agentKey: 'agent', submit: true, partnerKey: 'partner', projectKey: 'project', name: 'Activité soumise Phase 2', description: 'Chronologie de revue', dateStart: '2033-01-01', dateEnd: '2033-12-31', authorizedAmount: '2000', operations: [{ name: 'Opération soumise Phase 2', typeKey: 'type', authorizedAmount: '2000' }] },
    ],
  });
  crossEntityFixture = createPhase2FixtureSet({
    namespace: 'phase2.cross', entity: 2,
    users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire autre entité' }],
      projects: [{ key: 'project', label: 'Projet autre entité', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type autre entité' }],
    },
    activities: [
      { key: 'cross', agentKey: 'agent', submit: false, partnerKey: 'partner', projectKey: 'project', name: 'Activité autre entité', description: 'Canari isolation', dateStart: '2034-01-01', dateEnd: '2034-12-31', authorizedAmount: '100', operations: [{ name: 'Opération autre entité', typeKey: 'type', authorizedAmount: '100' }] },
    ],
  });
});

test('Planification navigation, operation list, and chronology are human-readable and scoped', async ({ browser }) => {
  const operationId = scalar('SELECT rowid FROM llx_mjlfinancement_operation WHERE fk_activity=' + fixture.activities.draft.activity_id);
  const edited = command(fixture.users.agent.id, `$command->saveStructure('${fixture.activities.draft.activity_id}','${fixture.activities.draft.version}',array('partner_id'=>'${fixture.partners.partner}','project_id'=>'${fixture.projects.project}','name'=>'Activité Phase 2 modifiée','description'=>'Couverture Phase 2','date_start'=>'2032-01-01','date_end'=>'2032-12-31','authorized_amount'=>'1000','operations'=>array(array('id'=>'${operationId}','expected_version'=>'1','client_key'=>'existing','name'=>'Opération Phase 2','type_id'=>'${fixture.operationTypes.type}','authorized_amount'=>'400'),array('client_key'=>'new','name'=>'Opération Phase 2 complément','type_id'=>'${fixture.operationTypes.type}','authorized_amount'=>'600'))),$actor)`);
  expect(edited.code).toBe('OK');
  const removedOperationId = scalar('SELECT rowid FROM llx_mjlfinancement_operation WHERE fk_activity=' + fixture.activities.pagination48.activity_id);
  const replaced = command(fixture.users.agent.id, `$command->saveStructure('${fixture.activities.pagination48.activity_id}','${fixture.activities.pagination48.version}',array('partner_id'=>'${fixture.partners.partner}','project_id'=>'${fixture.projects.project}','name'=>'Activité pagination complément Phase 2','description'=>'Cohorte de pagination','date_start'=>'2031-01-01','date_end'=>'2031-12-31','authorized_amount'=>'100','operations'=>array(array('client_key'=>'replacement','name'=>'Opération active remplacement','type_id'=>'${fixture.operationTypes.type}','authorized_amount'=>'100'))),$actor)`);
  expect(replaced.code).toBe('OK');
  expect(Number(scalar('SELECT COUNT(*) FROM llx_mjlfinancement_operation WHERE rowid=' + removedOperationId + ' AND date_removed IS NOT NULL'))).toBe(1);
  const prevalidated = command(fixture.users.supervisor.id, `$command->reviewRevision('${fixture.activities.submitted.activity_id}','${fixture.activities.submitted.revision_id}','${fixture.activities.submitted.version}',$actor,'PREVALIDATED')`);
  expect(prevalidated.code).toBe('OK');
  const returned = command(fixture.users.validator.id, `$command->reviewRevision('${fixture.activities.submitted.activity_id}','${fixture.activities.submitted.revision_id}','${prevalidated.version}',$actor,'RETURNED_VALIDATOR','Ajuster le montant','2500')`);
  expect(returned.code).toBe('OK');

  const agent = await browser.newContext(); const page = await agent.newPage(); await login(page, fixture.users.agent.login);
  await page.goto('/custom/mjlfinancement/operations.php');
  await expect(page.getByRole('heading', { name: 'Opérations' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Opération Phase 2', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'À faire' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Partenaire Phase 2' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: /Projet Phase 2/ }).first()).toBeVisible();
  await expect(page.getByText('Opération pagination 48', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Opération autre entité', { exact: true })).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await page.getByRole('link', { name: 'Suivant' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Précédent' })).toBeVisible();
  await expect(page.locator('#mjl-primary-navigation').getByRole('link', { name: 'Activités' })).toBeVisible();
  await page.goto('/custom/mjlfinancement/activities.php?id=' + fixture.activities.draft.activity_id);
  await expect(page.getByRole('heading', { name: 'Chronologie' })).toBeVisible();
  await expect(page.getByText('Activité créée')).toBeVisible();
  await expect(page.getByText('Structure mise à jour')).toBeVisible();
  await expect(page.getByText(/Activité : nom.*Opérations : 1 → 2/)).toBeVisible();
  await agent.close();

  const other = await browser.newContext(); const otherPage = await other.newPage(); await login(otherPage, fixture.users.other.login);
  await otherPage.goto('/custom/mjlfinancement/operations.php');
  await expect(otherPage.getByRole('cell', { name: 'Opération Phase 2', exact: true })).toHaveCount(0);
  await expect(otherPage.getByText('Aucune Opération active n’est enregistrée.')).toBeVisible();
  await other.close();

  const additional = await browser.newContext(); const additionalPage = await additional.newPage(); await login(additionalPage, fixture.users.additional.login);
  await additionalPage.goto('/custom/mjlfinancement/activities.php?id=' + fixture.activities.draft.activity_id);
  await expect(additionalPage.getByText('Agent ajouté')).toBeVisible();
  const removedAssignment = assignmentCommand(fixture.users.validator.id, fixture.activities.draft.activity_id, edited.version, 'REMOVE_ADDITIONAL', fixture.users.additional.id);
  expect(removedAssignment.code).toBe('OK');
  await additionalPage.goto('/custom/mjlfinancement/operations.php');
  await expect(additionalPage.getByRole('cell', { name: 'Opération Phase 2', exact: true })).toHaveCount(0);
  await expect(additionalPage.getByText('Aucune Opération active n’est enregistrée.')).toBeVisible();
  await additional.close();

  for (const role of ['supervisor', 'validator']) {
    const reviewer = await browser.newContext(); const reviewerPage = await reviewer.newPage(); await login(reviewerPage, fixture.users[role].login);
    await reviewerPage.goto('/custom/mjlfinancement/operations.php');
    await expect(reviewerPage.getByRole('cell', { name: 'Opération Phase 2', exact: true })).toBeVisible();
    await reviewerPage.goto('/custom/mjlfinancement/activities.php?action=review&id=' + fixture.activities.submitted.activity_id);
    await expect(reviewerPage.getByRole('heading', { name: 'Chronologie' })).toBeVisible();
    await expect(reviewerPage.getByText('Révision soumise')).toBeVisible();
    await expect(reviewerPage.getByText(/Montant demandé : 2 500 F CFA/)).toBeVisible();
    await reviewer.close();
  }

  const administrator = await browser.newContext(); const adminPage = await administrator.newPage(); await login(adminPage, 'admin');
  expect((await adminPage.goto('/custom/mjlfinancement/operations.php')).status()).toBe(403);
  await administrator.close();

  const anonymous = await browser.newContext();
  expect((await anonymous.request.get('/custom/mjlfinancement/operations.php')).status()).toBe(403);
  expect((await anonymous.request.post('/custom/mjlfinancement/operations.php')).status()).toBe(403);
  await anonymous.close();
});
