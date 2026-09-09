const { test, expect } = require('@playwright/test');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { createPhase3AFixtureSet, phase3ACommand } = require('../helpers/phase3a-fixture');
const { EXECUTION_TRANSITIONS, REQUEST_STATES } = require('./cases/activity-execution.cases');

function sql(statement) {
  return childProcess.execFileSync('docker', ['compose','exec','-T','mariadb','mariadb','--defaults-extra-file=/run/mjl-test/client.cnf','-N','-B','dolidb'], { encoding: 'utf8', env: process.env, input: `${statement}\n` }).trim();
}

let fixture;
let secondary;
let edge;
let matrix;
let validation;
const command = (request) => phase3ACommand({ entity: 1, ...request });

function planningCommand(actorId, expression) {
  const source = `<?php define('NOLOGIN',1);require '/var/www/html/main.inc.php';require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';$conf->entity=1;$actor=new User($db);if($actor->fetch(${Number(actorId)})<=0)exit(2);$command=new MjlActivityCommand($db,function(){return '2026-09-04';},1);echo json_encode(${expression},JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);`;
  return JSON.parse(childProcess.execFileSync('docker', ['compose','exec','-T','--user','www-data','dolibarr','php'], { encoding:'utf8', env:process.env, input:source }));
}

async function login(page, loginName) {
  await page.goto('/index.php');
  await page.getByLabel('Identifiant').fill(loginName);
  await page.getByLabel('Mot de passe').fill(loginName==='admin'?(process.env.DOLI_ADMIN_PASSWORD||'Admin1234'):process.env.MJL_TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByLabel('Identifiant')).toHaveCount(0);
}

function parallelCancellation(request) {
  return new Promise((resolve,reject)=>{const child=spawn('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/rst006a-parallel-worker.php'],{env:process.env,stdio:['pipe','pipe','pipe']});const stdout=[];const stderr=[];const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Phase 3A concurrency worker timed out.'));},15000);child.stdout.on('data',(chunk)=>stdout.push(Buffer.from(chunk)));child.stderr.on('data',(chunk)=>stderr.push(Buffer.from(chunk)));child.once('error',reject);child.once('close',(code)=>{clearTimeout(timer);if(code!==0)return reject(new Error(Buffer.concat(stderr).toString('utf8')));resolve(JSON.parse(Buffer.concat(stdout).toString('utf8').trim()));});child.stdin.end(JSON.stringify(request));});
}

test.beforeAll(() => {
  fixture = createPhase3AFixtureSet({
    namespace: 'phase3a.execution', entity: 1,
    users: [
      { key: 'agent', role: 'AGENT_SAISIE' }, { key: 'agent2', role: 'AGENT_SAISIE' },
      { key: 'career', role: 'AGENT_SAISIE' },
      { key: 'supervisor', role: 'AGENT_VERIFICATEUR' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' },
      { key: 'norole', role: null },
    ],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire Phase 3A' }],
      projects: [{ key: 'project', label: 'Projet Phase 3A', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Décaissement Phase 3A' }],
    },
    activities: [
      { key: 'execution', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Exécution explicite', description: 'Valeurs nulles et zéro.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '300', operations: [{ name: 'Opération zéro', typeKey: 'type', authorizedAmount: '100' }, { name: 'Opération égale', typeKey: 'type', authorizedAmount: '200' }] },
      { key: 'operation-cancel', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Annulation Opération', description: 'Demande versionnée.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération à annuler', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'activity-cancel', agentKey: 'agent', additionalAgentKeys: ['agent2'], partnerKey: 'partner', projectKey: 'project', name: 'Annulation Activité', description: 'Cascade atomique.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '200', operations: [{ name: 'Opération terminée', typeKey: 'type', authorizedAmount: '100' }, { name: 'Opération ouverte', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'career-decision', agentKey: 'agent', additionalAgentKeys: ['career'], partnerKey: 'partner', projectKey: 'project', name: 'Changement de rôle', description: 'Le rôle courant gouverne la décision.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération changement de rôle', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'prevalidation-cancel', finalize: false, agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Annulation avant validation', description: 'Exécution non démarrée.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération avant validation', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'stale-aggregate', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Agrégat devenu obsolète', description: 'Empreinte des conséquences.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération modifiée après demande', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'maximum', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Maximum entier', description: 'Borne BIGINT exacte.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '9223372036854775807', operations: [{ name: 'Opération au maximum', typeKey: 'type', authorizedAmount: '9223372036854775807' }] },
      { key: 'request-rules', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Règles des demandes', description: 'Motifs, versions et terminalité.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération des demandes', typeKey: 'type', authorizedAmount: '100' }] },
    ],
  });
  edge = createPhase3AFixtureSet({
    namespace: 'phase3a.edge', entity: 1,
    users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'agent2', role: 'AGENT_SAISIE' }, { key: 'supervisor', role: 'AGENT_VERIFICATEUR' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
    references: { partners: [{ key: 'partner', label: 'Partenaire limites Phase 3A' }], projects: [{ key: 'project', label: 'Projet limites Phase 3A', partnerKey: 'partner' }], operationTypes: [{ key: 'type', label: 'Type limites Phase 3A' }] },
    activities: [
      { key: 'cross-exception', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Exceptions croisées', description: 'Une seule exception en attente.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération exception croisée', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'cross-race', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Course exceptions croisées', description: 'Une seule demande concurrente.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération course croisée', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'cascade-rollback', agentKey: 'agent', additionalAgentKeys: ['agent2'], partnerKey: 'partner', projectKey: 'project', name: 'Retour arrière atomique', description: 'Injection de panne d’audit.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '200', operations: [{ name: 'Opération cascade 1', typeKey: 'type', authorizedAmount: '100' }, { name: 'Opération cascade 2', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'parent-race', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Course parent réouverture', description: 'L’annulation du parent gagne.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération à rouvrir', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'reconcile-race', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Réconciliation concurrente', description: 'Un seul événement dérivé.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération à réconcilier', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'removed-agent', agentKey: 'agent2', partnerKey: 'partner', projectKey: 'project', name: 'Agent retiré', description: 'Affectation terminée.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération hors affectation', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'completed-activity-cancel', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Annulation après achèvement', description: 'Priorité canonique de l’annulation.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '200', operations: [{ name: 'Opération achevée 1', typeKey: 'type', authorizedAmount: '100' }, { name: 'Opération achevée 2', typeKey: 'type', authorizedAmount: '100' }] },
      { key: 'missed-transition', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Transition calendaire manquée', description: 'Rattrapage avant mutation.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération après échéance', typeKey: 'type', authorizedAmount: '100' }] },
    ],
  });
  secondary = createPhase3AFixtureSet({
    namespace: 'phase3a.secondary', entity: 2,
    users: [{ key: 'agent', role: 'AGENT_SAISIE' }, { key: 'supervisor', role: 'AGENT_VERIFICATEUR' }, { key: 'validator', role: 'VALIDATEUR_DEFINITIF' }],
    references: {
      partners: [{ key: 'partner', label: 'Partenaire Phase 3A secondaire' }],
      projects: [{ key: 'project', label: 'Projet Phase 3A secondaire', partnerKey: 'partner' }],
      operationTypes: [{ key: 'type', label: 'Type Phase 3A secondaire' }],
    },
    activities: [{ key: 'execution', agentKey: 'agent', partnerKey: 'partner', projectKey: 'project', name: 'Exécution autre entité', description: 'Isolation.', dateStart: '2026-09-05', dateEnd: '2026-09-30', authorizedAmount: '100', operations: [{ name: 'Opération autre entité', typeKey: 'type', authorizedAmount: '100' }] }],
  });
  matrix=createPhase3AFixtureSet({namespace:'phase3a.matrix',entity:1,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'agent2',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'partner',label:'Partenaire matrice Phase 3A'}],projects:[{key:'project',label:'Projet matrice Phase 3A',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type matrice Phase 3A'}]},activities:[
    ...['TODO','IN_PROGRESS'].flatMap((from)=>['TODO','IN_PROGRESS','COMPLETED','CANCELLED'].map((to)=>({key:`${from}-${to}`.toLowerCase(),agentKey:'agent',partnerKey:'partner',projectKey:'project',name:`Transition ${from} vers ${to}`,description:'Matrice exhaustive des transitions.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'100',operations:[{name:`Opération ${from} vers ${to}`,typeKey:'type',authorizedAmount:'100'}]}))),
  ]});
  validation=createPhase3AFixtureSet({namespace:'phase3a.validation',entity:1,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'partner',label:'Partenaire validation Phase 3A'}],projects:[{key:'project',label:'Projet validation Phase 3A',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type validation Phase 3A'}]},activities:[{key:'rollback',finalize:false,agentKey:'agent',partnerKey:'partner',projectKey:'project',name:'Validation atomique Phase 3A',description:'Le premier événement dérivé est transactionnel.',dateStart:'2026-09-05',dateEnd:'2026-09-30',authorizedAmount:'100',operations:[{name:'Opération validation atomique',typeKey:'type',authorizedAmount:'100'}]}]});
});

test('definitive validation records one transactional execution baseline', () => {
  const activity=fixture.activities.maximum;
  const baseline=sql(`SELECT CONCAT(COUNT(*),'|',MIN(state_before),'|',MIN(state_after),'|',MIN(actor_id),'|',MIN(entity),'|',MIN(revision_id),'|',MIN(target_version),'|',MIN(JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.source')))) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED'`);
  expect(baseline).toBe(`1|NOT_STARTED|UPCOMING|${fixture.users.validator.id}|1|${activity.revision_id}|${activity.version}|FINAL_VALIDATION`);

  const pending=validation.activities.rollback;
  const prevalidated=planningCommand(validation.users.supervisor.id,`$command->reviewRevision('${pending.activity_id}','${pending.revision_id}','${pending.version}',$actor,'PREVALIDATED')`);
  expect(prevalidated.code).toBe('OK');
  sql('RENAME TABLE llx_mjlfinancement_audit_event TO llx_mjlfinancement_audit_event_unavailable');
  try {
    expect(planningCommand(validation.users.validator.id,`$command->reviewRevision('${pending.activity_id}','${pending.revision_id}','${prevalidated.version}',$actor,'FINAL_VALIDATED')`).code).toBe('FAILED');
  } finally {
    sql('RENAME TABLE llx_mjlfinancement_audit_event_unavailable TO llx_mjlfinancement_audit_event');
  }
  expect(sql(`SELECT CONCAT(validation_status,'|',version,'|',IF(latest_validated_amount IS NULL,'NULL',latest_validated_amount)) FROM llx_mjlfinancement_activity WHERE rowid=${pending.activity_id}`)).toBe(`PREVALIDATED|${prevalidated.version}|NULL`);
});

test('Assigned Agent preserves explicit zero and completed Operations lock', () => {
  const activity = fixture.activities.execution;
  const operation = activity.operations[0];
  const rejected = command({ action: 'update', actorId: fixture.users.agent.id, activityId: activity.activity_id, operationId: operation.rowid, expectedVersion: operation.version, input: { status: 'COMPLETED', spent_amount: '0', observation: null } });
  expect(rejected.code).toBe('CONFLICT');
  const completed = command({ action: 'update', actorId: fixture.users.agent.id, activityId: activity.activity_id, operationId: operation.rowid, expectedVersion: operation.version, input: { status: 'COMPLETED', spent_amount: '0', observation: 'Aucune dépense engagée' } });
  expect(completed.code).toBe('OK');
  expect(sql(`SELECT CONCAT(IF(spent_amount IS NULL,'NULL',spent_amount),'|',status,'|',observation) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('0|COMPLETED|Aucune dépense engagée');
  expect(sql(`SELECT target_version FROM llx_mjlfinancement_audit_event WHERE operation_id=${operation.rowid} AND action='OPERATION_EXECUTION_UPDATED' ORDER BY rowid DESC LIMIT 1`)).toBe(String(operation.version));
  const locked = command({ action: 'update', actorId: fixture.users.agent.id, activityId: activity.activity_id, operationId: operation.rowid, expectedVersion: completed.operation_version, input: { status: 'COMPLETED', spent_amount: '1', observation: 'Tentative' } });
  expect(locked.code).toBe('CONFLICT');
});

test('Phase 3A guards preserve version-only planning saves with inactive retained references', () => {
  const input = `array('partner_id'=>'${edge.partners.partner}','project_id'=>'${edge.projects.project}','name'=>'Planification_conservée','description'=>'Compatibilité Phase 2 sous garde Phase 3A','date_start'=>'2032-01-01','date_end'=>'2032-12-31','authorized_amount'=>'100','operations'=>array(array('client_key'=>'only','name'=>'Opération conservée','type_id'=>'${edge.operationTypes.type}','authorized_amount'=>'100')))`;
  const draft=planningCommand(edge.users.agent.id,`$command->createDraft(${input},$actor)`);expect(draft).toMatchObject({code:'OK',version:1});
  const operationId=sql(`SELECT rowid FROM llx_mjlfinancement_operation WHERE entity=1 AND fk_activity=${draft.activity_id}`);
  sql(`UPDATE llx_societe SET status=0 WHERE rowid=${edge.partners.partner};UPDATE llx_projet SET fk_statut=0 WHERE rowid=${edge.projects.project};UPDATE llx_mjlfinancement_operation_type SET is_active=0 WHERE rowid=${edge.operationTypes.type}`);
  try {
    const unchanged=`array('partner_id'=>'${edge.partners.partner}','project_id'=>'${edge.projects.project}','name'=>'Planification_conservée','description'=>'Compatibilité Phase 2 sous garde Phase 3A','date_start'=>'2032-01-01','date_end'=>'2032-12-31','authorized_amount'=>'100','operations'=>array(array('id'=>'${operationId}','expected_version'=>'1','client_key'=>'only','name'=>'Opération conservée','type_id'=>'${edge.operationTypes.type}','authorized_amount'=>'100')))`;
    expect(planningCommand(edge.users.agent.id,`$command->saveStructure('${draft.activity_id}','1',${unchanged},$actor)`)).toMatchObject({code:'OK',version:2});
  } finally {
    sql(`UPDATE llx_societe SET status=1 WHERE rowid=${edge.partners.partner};UPDATE llx_projet SET fk_statut=1 WHERE rowid=${edge.projects.project};UPDATE llx_mjlfinancement_operation_type SET is_active=1 WHERE rowid=${edge.operationTypes.type}`);
  }
  const abandoned=planningCommand(edge.users.agent.id,`$command->abandonDraft('${draft.activity_id}','2',$actor,'Abandon de compatibilité')`);expect(abandoned).toMatchObject({code:'OK',version:3});
  const restored=planningCommand(edge.users.validator.id,`$command->restoreDraft('${draft.activity_id}','3',$actor,'${edge.users.agent.id}','Restauration de compatibilité')`);expect(restored).toMatchObject({code:'OK',version:4});
});

test('execution accepts reordered exact input, overspend evidence, and the BIGINT maximum', () => {
  const maximum=fixture.activities.maximum;const operation=maximum.operations[0];
  const reordered=command({action:'update',actorId:fixture.users.agent.id,activityId:maximum.activity_id,operationId:operation.rowid,expectedVersion:operation.version,input:{observation:null,status:'IN_PROGRESS',spent_amount:null}});
  expect(reordered.code).toBe('OK');
  const unchanged=command({action:'update',actorId:fixture.users.agent.id,activityId:maximum.activity_id,operationId:operation.rowid,expectedVersion:reordered.operation_version,input:{status:'IN_PROGRESS',spent_amount:null,observation:null}});expect(unchanged.code).toBe('OK');
  expect(command({action:'update',actorId:fixture.users.agent.id,activityId:maximum.activity_id,operationId:operation.rowid,expectedVersion:unchanged.operation_version,input:{status:'TODO',spent_amount:null,observation:null}}).code).toBe('CONFLICT');
  const missingObservation=command({action:'update',actorId:fixture.users.agent.id,activityId:maximum.activity_id,operationId:operation.rowid,expectedVersion:unchanged.operation_version,input:{status:'COMPLETED',spent_amount:'9223372036854775806',observation:null}});
  expect(missingObservation.code).toBe('CONFLICT');
  const completed=command({action:'update',actorId:fixture.users.agent.id,activityId:maximum.activity_id,operationId:operation.rowid,expectedVersion:unchanged.operation_version,input:{status:'COMPLETED',spent_amount:'9223372036854775807',observation:null}});
  expect(completed.code).toBe('OK');
  expect(sql(`SELECT CONCAT(spent_amount,'|',status) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('9223372036854775807|COMPLETED');
});

test('Execution permissions and optimistic locking fail without audit', () => {
  const activity=fixture.activities.execution; const operation=activity.operations[1];
  const before=Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE operation_id=${operation.rowid}`));
  for(const key of ['agent2','supervisor','validator','norole']){
    const denied=command({ action:'update', actorId:fixture.users[key].id, activityId:activity.activity_id, operationId:operation.rowid, expectedVersion:operation.version, input:{status:'IN_PROGRESS',spent_amount:'200',observation:null} });
    expect(denied.code).toBe('FORBIDDEN');
  }
  const saved=command({ action:'update',actorId:fixture.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:operation.version,input:{status:'IN_PROGRESS',spent_amount:'200',observation:null} });
  expect(saved.code).toBe('OK');
  const stale=command({ action:'update',actorId:fixture.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:operation.version,input:{status:'IN_PROGRESS',spent_amount:'200',observation:null} });
  expect(stale.code).toBe('STALE_VERSION');
  expect(Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE operation_id=${operation.rowid}`))).toBe(before+1);
});

test('Cancellation and reopening decisions are version-bound and audited', () => {
  const activity=fixture.activities['operation-cancel'];const operation=activity.operations[0];
  const request=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:operation.rowid,expectedVersion:operation.version,reason:'Opération devenue inutile'});expect(request.code).toBe('OK');
  const duplicate=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:operation.rowid,expectedVersion:operation.version,reason:'Doublon'});expect(duplicate.code).toBe('CONFLICT');
  const approved=command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'APPROVED',reason:'Annulation justifiée'});expect(approved.code).toBe('OK');
  expect(sql(`SELECT status FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('CANCELLED');
  expect(sql(`SELECT GROUP_CONCAT(CONCAT(action,':',target_version) ORDER BY rowid SEPARATOR '|') FROM llx_mjlfinancement_audit_event WHERE operation_id=${operation.rowid} AND action IN ('CANCELLATION_REQUESTED','OPERATION_CANCELLED','CANCELLATION_APPROVED')`)).toBe(`CANCELLATION_REQUESTED:${operation.version}|OPERATION_CANCELLED:${operation.version}|CANCELLATION_APPROVED:${operation.version}`);
  const reopen=command({action:'request-reopen',actorId:fixture.users.agent.id,operationId:operation.rowid,expectedVersion:String(Number(operation.version)+1),reason:'Réouvrir'});expect(reopen.code).toBe('CONFLICT');
});

test('the maintained matrix executes every direct Operation source/target pair', () => {
  const outcomes=new Map();
  for(const from of ['TODO','IN_PROGRESS'])for(const to of ['TODO','IN_PROGRESS','COMPLETED','CANCELLED']){
    const activity=matrix.activities[`${from}-${to}`.toLowerCase()];const operation=activity.operations[0];let version=String(operation.version);
    if(from==='IN_PROGRESS'){const prepared=command({action:'update',actorId:matrix.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:version,input:{status:'IN_PROGRESS',spent_amount:'100',observation:null}});expect(prepared.code).toBe('OK');version=String(prepared.operation_version);}
    const result=command({action:'update',actorId:matrix.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:version,input:{status:to,spent_amount:'100',observation:null}});outcomes.set(`${from}->${to}`,result.code);
  }
  const completed=matrix.activities['todo-completed'];const completedOperation=completed.operations[0];const completedVersion=sql(`SELECT version FROM llx_mjlfinancement_operation WHERE rowid=${completedOperation.rowid}`);
  for(const to of ['TODO','IN_PROGRESS','COMPLETED','CANCELLED'])outcomes.set(`COMPLETED->${to}`,command({action:'update',actorId:matrix.users.agent.id,activityId:completed.activity_id,operationId:completedOperation.rowid,expectedVersion:completedVersion,input:{status:to,spent_amount:'100',observation:null}}).code);
  const cancelled=fixture.activities['operation-cancel'];const cancelledOperation=cancelled.operations[0];const cancelledVersion=sql(`SELECT version FROM llx_mjlfinancement_operation WHERE rowid=${cancelledOperation.rowid}`);
  for(const to of ['TODO','IN_PROGRESS','COMPLETED','CANCELLED'])outcomes.set(`CANCELLED->${to}`,command({action:'update',actorId:fixture.users.agent.id,activityId:cancelled.activity_id,operationId:cancelledOperation.rowid,expectedVersion:cancelledVersion,input:{status:to,spent_amount:'100',observation:null}}).code);
  for(const transition of EXECUTION_TRANSITIONS)expect(outcomes.get(`${transition.from}->${transition.to}`),`${transition.from}->${transition.to}`).toBe(transition.outcome);
});

test('reopening withdrawal enforces version, ownership, current assignment, audit, and terminality', () => {
  expect(REQUEST_STATES).toEqual(['PENDING','APPROVED','REJECTED','WITHDRAWN']);
  const activity=matrix.activities['todo-completed'];const operation=activity.operations[0];const operationVersion=sql(`SELECT version FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`);
  const first=command({action:'request-reopen',actorId:matrix.users.agent.id,operationId:operation.rowid,expectedVersion:operationVersion,reason:'Réouverture à retirer'});expect(first.code).toBe('OK');
  const beforeAudit=Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='REOPENING_WITHDRAWN'`));
  expect(command({action:'withdraw-reopen',actorId:matrix.users.agent.id,requestId:first.request_id,expectedVersion:'999'}).code).toBe('STALE_VERSION');
  expect(command({action:'withdraw-reopen',actorId:matrix.users.agent2.id,requestId:first.request_id,expectedVersion:first.request_version}).code).toBe('FORBIDDEN');
  const withdrawn=command({action:'withdraw-reopen',actorId:matrix.users.agent.id,requestId:first.request_id,expectedVersion:first.request_version});expect(withdrawn.code).toBe('OK');
  expect(sql(`SELECT CONCAT(status,'|',version) FROM llx_mjlfinancement_reopening_request WHERE rowid=${first.request_id}`)).toBe('WITHDRAWN|2');
  expect(sql(`SELECT GROUP_CONCAT(target_version ORDER BY rowid SEPARATOR '|') FROM llx_mjlfinancement_audit_event WHERE operation_id=${operation.rowid} AND action IN ('REOPENING_REQUESTED','REOPENING_WITHDRAWN')`)).toBe(`${operationVersion}|${operationVersion}`);
  expect(Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='REOPENING_WITHDRAWN'`))).toBe(beforeAudit+1);
  expect(command({action:'withdraw-reopen',actorId:matrix.users.agent.id,requestId:first.request_id,expectedVersion:'2'}).code).toBe('STALE_VERSION');
  const second=command({action:'request-reopen',actorId:matrix.users.agent.id,operationId:operation.rowid,expectedVersion:operationVersion,reason:'Affectation requise'});expect(second.code).toBe('OK');
  sql(`UPDATE llx_mjlfinancement_activity_assignment SET date_end=NOW() WHERE entity=1 AND fk_activity=${activity.activity_id} AND fk_user=${matrix.users.agent.id} AND date_end IS NULL`);
  expect(command({action:'withdraw-reopen',actorId:matrix.users.agent.id,requestId:second.request_id,expectedVersion:second.request_version}).code).toBe('FORBIDDEN');
  expect(command({action:'decide-reopen',actorId:matrix.users.validator.id,requestId:second.request_id,expectedVersion:second.request_version,decision:'REJECTED',reason:'Demande clôturée après retrait de l’affectation'}).code).toBe('OK');
});

test('request reasons, request versions, withdrawal, rejection, and terminal immutability fail closed', () => {
  const activity=fixture.activities['request-rules'];const operation=activity.operations[0];
  expect(command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:operation.rowid,expectedVersion:operation.version,reason:'   '}).code).toBe('INVALID_INPUT');
  expect(command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:operation.rowid,expectedVersion:'999',reason:'Version obsolète'}).code).toBe('STALE_VERSION');
  const first=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:operation.rowid,expectedVersion:operation.version,reason:'Demande à retirer'});expect(first.code).toBe('OK');
  expect(command({action:'withdraw-cancel',actorId:fixture.users.agent.id,requestId:first.request_id,expectedVersion:'999'}).code).toBe('STALE_VERSION');
  expect(command({action:'withdraw-cancel',actorId:fixture.users.agent2.id,requestId:first.request_id,expectedVersion:first.request_version}).code).toBe('FORBIDDEN');
  expect(command({action:'withdraw-cancel',actorId:fixture.users.agent.id,requestId:first.request_id,expectedVersion:first.request_version}).code).toBe('OK');
  expect(command({action:'withdraw-cancel',actorId:fixture.users.agent.id,requestId:first.request_id,expectedVersion:'2'}).code).toBe('STALE_VERSION');
  const second=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:operation.rowid,expectedVersion:operation.version,reason:'Demande à rejeter'});expect(second.code).toBe('OK');
  expect(command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:second.request_id,expectedVersion:second.request_version,decision:'REJECTED',reason:''}).code).toBe('INVALID_INPUT');
  const rejected=command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:second.request_id,expectedVersion:second.request_version,decision:'REJECTED',reason:'Motif documenté'});expect(rejected.code).toBe('OK');
  expect(sql(`SELECT GROUP_CONCAT(target_version ORDER BY rowid SEPARATOR '|') FROM llx_mjlfinancement_audit_event WHERE operation_id=${operation.rowid} AND action IN ('CANCELLATION_WITHDRAWN','CANCELLATION_REJECTED')`)).toBe(`${operation.version}|${operation.version}`);
  expect(command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:second.request_id,expectedVersion:rejected.request_version,decision:'APPROVED',reason:'Mutation terminale interdite'}).code).toBe('STALE_VERSION');
  expect(()=>sql(`UPDATE llx_mjlfinancement_cancellation_request SET reason='Altéré',version=version+1 WHERE rowid=${second.request_id}`)).toThrow();
});

test('a pending cancellation excludes a reopening request on the same Operation', () => {
  const activity=edge.activities['cross-exception'];const operation=activity.operations[0];
  const cancellation=command({action:'request-cancel',actorId:edge.users.agent.id,targetType:'OPERATION',targetId:operation.rowid,expectedVersion:operation.version,reason:'Exception encore en attente'});expect(cancellation.code).toBe('OK');
  const completed=command({action:'update',actorId:edge.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:operation.version,input:{status:'COMPLETED',spent_amount:'100',observation:null}});expect(completed.code).toBe('OK');
  expect(command({action:'request-reopen',actorId:edge.users.agent.id,operationId:operation.rowid,expectedVersion:completed.operation_version,reason:'Exception croisée'}).code).toBe('CONFLICT');
  expect(command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:cancellation.request_id,expectedVersion:cancellation.request_version,decision:'REJECTED',reason:'Cible terminée entre-temps'}).code).toBe('OK');
});

test('barrier-driven cancellation versus completion-and-reopening commits one pending exception', async () => {
  const activity=edge.activities['cross-race'];const operation=activity.operations[0];const barrier=crypto.randomBytes(16).toString('hex');
  const common={activity_id:String(activity.activity_id),operation_id:String(operation.rowid),version:String(operation.version),actor_id:String(edge.users.agent.id),reason:'Course entre exceptions',barrier,lock_wait_timeout:5};
  const beforeAudit=Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action IN ('CANCELLATION_REQUESTED','REOPENING_REQUESTED')`));
  const beforeExecutionAudit=Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='OPERATION_EXECUTION_UPDATED'`));
  const results=await Promise.all([parallelCancellation({operation:'request-cancel',...common}),parallelCancellation({operation:'complete-and-request-reopen',...common})]);
  const codes=results.map((result)=>result.code);expect(codes.filter((code)=>code==='OK')).toHaveLength(1);expect(['CONFLICT','STALE_VERSION']).toContain(codes.find((code)=>code!=='OK'));
  const composite=results.find((result)=>Object.hasOwn(result,'completion_code'));expect(composite.completion_code).toBe('OK');
  expect(sql(`SELECT CONCAT(status,'|',spent_amount,'|',version) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe(`COMPLETED|100|${Number(operation.version)+1}`);
  expect(Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='OPERATION_EXECUTION_UPDATED'`))).toBe(beforeExecutionAudit+1);
  expect(sql(`SELECT (SELECT COUNT(*) FROM llx_mjlfinancement_cancellation_request WHERE entity=1 AND target_type='OPERATION' AND target_id=${operation.rowid} AND status='PENDING')+(SELECT COUNT(*) FROM llx_mjlfinancement_reopening_request WHERE entity=1 AND fk_operation=${operation.rowid} AND status='PENDING')`)).toBe('1');
  expect(Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action IN ('CANCELLATION_REQUESTED','REOPENING_REQUESTED')`))).toBe(beforeAudit+1);
});

test('simultaneous cancellation requests commit exactly one pending request', async () => {
  const activity=fixture.activities.execution;const operation=activity.operations[1];const version=sql(`SELECT version FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`);const barrier=crypto.randomBytes(16).toString('hex');
  const base={operation:'request-cancel',activity_id:String(activity.activity_id),operation_id:String(operation.rowid),version,actor_id:String(fixture.users.agent.id),reason:'Demande simultanée',barrier,lock_wait_timeout:5};
  const results=await Promise.all([parallelCancellation(base),parallelCancellation(base)]);
  expect(results.map((result)=>result.code).sort()).toEqual(['CONFLICT','OK']);
  expect(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_cancellation_request WHERE entity=1 AND target_type='OPERATION' AND target_id=${operation.rowid} AND status='PENDING'`)).toBe('1');
  const winner=results.find((result)=>result.code==='OK');
  expect(command({action:'withdraw-cancel',actorId:fixture.users.agent.id,requestId:winner.request_id,expectedVersion:winner.request_version}).code).toBe('OK');
});

test('a former Agent who is now Validator may decide their own historic request', () => {
  const activity=fixture.activities['career-decision'];const operation=activity.operations[0];const request=command({action:'request-cancel',actorId:fixture.users.career.id,targetType:'OPERATION',targetId:operation.rowid,expectedVersion:operation.version,reason:'Demandée avant changement de fonction'});expect(request.code).toBe('OK');
  sql(`UPDATE llx_mjlfinancement_activity_assignment SET date_end=NOW() WHERE entity=1 AND fk_activity=${activity.activity_id} AND fk_user=${fixture.users.career.id} AND date_end IS NULL`);
  sql(`UPDATE llx_mjlfinancement_user_role SET role_code='VALIDATEUR_DEFINITIF',date_end=NULL,is_active=1 WHERE entity=1 AND fk_user=${fixture.users.career.id}`);
  const approved=command({action:'decide-cancel',actorId:fixture.users.career.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'APPROVED',reason:'Décision prise dans le rôle courant'});
  expect(approved.code).toBe('OK');
  expect(sql(`SELECT status FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('CANCELLED');
});

test('pre-validation Activity cancellation remains execution not started', () => {
  const activity=fixture.activities['prevalidation-cancel'];const request=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'ACTIVITY',targetId:activity.activity_id,expectedVersion:String(activity.version),reason:'Annulation avant validation définitive'});expect(request.code).toBe('OK');const approved=command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'APPROVED',reason:'Annulation confirmée avant validation'});expect(approved.code).toBe('OK');const projected=command({action:'reconcile',activityId:activity.activity_id,localDate:'2026-10-01'});expect(projected).toMatchObject({code:'OK',execution_status:'NOT_STARTED'});
});

test('Activity cancellation approval is stale after any Operation consequence changes', () => {
  const activity=fixture.activities['stale-aggregate'];const operation=activity.operations[0];const request=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'ACTIVITY',targetId:activity.activity_id,expectedVersion:String(activity.version),reason:'Demande liée à l’agrégat exact'});expect(request.code).toBe('OK');expect(command({action:'update',actorId:fixture.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:operation.version,input:{status:'IN_PROGRESS',spent_amount:'100',observation:null}}).code).toBe('OK');const stale=command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'APPROVED',reason:'Tentative sur agrégat modifié'});expect(stale.code).toBe('STALE_VERSION');expect(sql(`SELECT status FROM llx_mjlfinancement_cancellation_request WHERE rowid=${request.request_id}`)).toBe('PENDING');expect(command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'REJECTED',reason:'Rejet de la demande devenue obsolète'}).code).toBe('OK');
});

test('Activity cancellation preserves completed Operations and ends every assignment', () => {
  const activity=fixture.activities['activity-cancel'];const completedOperation=activity.operations[0];const unfinishedOperation=activity.operations[1];
  const complete=command({action:'update',actorId:fixture.users.agent.id,activityId:activity.activity_id,operationId:completedOperation.rowid,expectedVersion:completedOperation.version,input:{status:'COMPLETED',spent_amount:'100',observation:null}});expect(complete.code).toBe('OK');
  const childRequest=command({action:'request-cancel',actorId:fixture.users.agent2.id,targetType:'OPERATION',targetId:unfinishedOperation.rowid,expectedVersion:unfinishedOperation.version,reason:'Demande enfant à conserver'});expect(childRequest.code).toBe('OK');
  const currentVersion=sql(`SELECT version FROM llx_mjlfinancement_activity WHERE rowid=${activity.activity_id}`);
  const request=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'ACTIVITY',targetId:activity.activity_id,expectedVersion:currentVersion,reason:'Arrêt du financement'});expect(request.code).toBe('OK');
  const approved=command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'APPROVED',reason:'Arrêt confirmé'});expect(approved.code).toBe('OK');
  expect(sql(`SELECT target_version FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND operation_id IS NULL AND action='CANCELLATION_APPROVED'`)).toBe(currentVersion);
  expect(sql(`SELECT CONCAT(validation_status,'|',is_cancelled) FROM llx_mjlfinancement_activity WHERE rowid=${activity.activity_id}`)).toBe('CANCELLED|1');
  expect(sql(`SELECT GROUP_CONCAT(status ORDER BY rowid SEPARATOR '|') FROM llx_mjlfinancement_operation WHERE fk_activity=${activity.activity_id} AND date_removed IS NULL`)).toBe('COMPLETED|CANCELLED');
  expect(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment WHERE fk_activity=${activity.activity_id} AND date_end IS NULL`)).toBe('0');
  expect(sql(`SELECT status FROM llx_mjlfinancement_cancellation_request WHERE rowid=${childRequest.request_id}`)).toBe('PENDING');
  expect(command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:childRequest.request_id,expectedVersion:childRequest.request_version,decision:'REJECTED',reason:'Demande devenue obsolète après annulation globale'}).code).toBe('OK');
});

test('explicit Activity cancellation overrides an already completed Activity', () => {
  const activity=edge.activities['completed-activity-cancel'];
  for(const operation of activity.operations){
    const completed=command({action:'update',actorId:edge.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:operation.version,input:{status:'COMPLETED',spent_amount:'100',observation:null}});
    expect(completed.code).toBe('OK');
  }
  expect(command({action:'reconcile',activityId:activity.activity_id,localDate:'2026-09-05'})).toMatchObject({code:'OK',execution_status:'COMPLETED'});
  const request=command({action:'request-cancel',actorId:edge.users.agent.id,targetType:'ACTIVITY',targetId:activity.activity_id,expectedVersion:activity.version,reason:'Annulation explicite après achèvement'});
  expect(request.code).toBe('OK');
  expect(command({action:'decide-cancel',actorId:edge.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'APPROVED',reason:'Annulation explicite prioritaire'}).code).toBe('OK');
  expect(sql(`SELECT CONCAT(validation_status,'|',is_cancelled) FROM llx_mjlfinancement_activity WHERE rowid=${activity.activity_id}`)).toBe('CANCELLED|1');
  expect(sql(`SELECT GROUP_CONCAT(CONCAT(status,':',spent_amount) ORDER BY rowid SEPARATOR '|') FROM llx_mjlfinancement_operation WHERE fk_activity=${activity.activity_id}`)).toBe('COMPLETED:100|COMPLETED:100');
  expect(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='OPERATION_CANCELLED'`)).toBe('0');
  expect(sql(`SELECT state_after FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED' ORDER BY rowid DESC LIMIT 1`)).toBe('CANCELLED');
});

test('a mutation records a missed date transition before its own derived transition', () => {
  const activity=edge.activities['missed-transition'];const operation=activity.operations[0];
  const completed=command({action:'update',actorId:edge.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:operation.version,localDate:'2026-10-01',input:{status:'COMPLETED',spent_amount:'100',observation:null}});
  expect(completed.code).toBe('OK');
  expect(sql(`SELECT GROUP_CONCAT(CONCAT(state_before,'>',state_after,':',JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.source'))) ORDER BY rowid SEPARATOR '|') FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED'`)).toBe('NOT_STARTED>UPCOMING:FINAL_VALIDATION|UPCOMING>OVERDUE:MUTATION_CATCH_UP|OVERDUE>COMPLETED:OPERATION');
});

test('Activity cancellation rolls back request, Activity, Operations, assignments, and audits together', () => {
  const activity=edge.activities['cascade-rollback'];const request=command({action:'request-cancel',actorId:edge.users.agent.id,targetType:'ACTIVITY',targetId:activity.activity_id,expectedVersion:activity.version,reason:'Tester l’atomicité complète'});expect(request.code).toBe('OK');
  const snapshot=sql(`SELECT CONCAT(a.validation_status,'|',a.is_cancelled,'|',a.version,'|',(SELECT GROUP_CONCAT(CONCAT(o.status,':',o.version) ORDER BY o.rowid SEPARATOR ',') FROM llx_mjlfinancement_operation o WHERE o.fk_activity=a.rowid),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment aa WHERE aa.fk_activity=a.rowid AND aa.date_end IS NULL),'|',(SELECT CONCAT(r.status,':',r.version) FROM llx_mjlfinancement_cancellation_request r WHERE r.rowid=${request.request_id})) FROM llx_mjlfinancement_activity a WHERE a.rowid=${activity.activity_id}`);
  sql('RENAME TABLE llx_mjlfinancement_audit_event TO llx_mjlfinancement_audit_event_unavailable');
  try { expect(command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'APPROVED',reason:'La panne doit tout annuler'}).code).toBe('FAILED'); }
  finally { sql('RENAME TABLE llx_mjlfinancement_audit_event_unavailable TO llx_mjlfinancement_audit_event'); }
  expect(sql(`SELECT CONCAT(a.validation_status,'|',a.is_cancelled,'|',a.version,'|',(SELECT GROUP_CONCAT(CONCAT(o.status,':',o.version) ORDER BY o.rowid SEPARATOR ',') FROM llx_mjlfinancement_operation o WHERE o.fk_activity=a.rowid),'|',(SELECT COUNT(*) FROM llx_mjlfinancement_activity_assignment aa WHERE aa.fk_activity=a.rowid AND aa.date_end IS NULL),'|',(SELECT CONCAT(r.status,':',r.version) FROM llx_mjlfinancement_cancellation_request r WHERE r.rowid=${request.request_id})) FROM llx_mjlfinancement_activity a WHERE a.rowid=${activity.activity_id}`)).toBe(snapshot);
  expect(command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'REJECTED',reason:'Fermeture après preuve atomique'}).code).toBe('OK');
});

test('parent Activity cancellation makes a pending reopening stale', () => {
  const activity=edge.activities['parent-race'];const operation=activity.operations[0];
  const completed=command({action:'update',actorId:edge.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:operation.version,input:{status:'COMPLETED',spent_amount:'100',observation:null}});expect(completed.code).toBe('OK');
  const reopening=command({action:'request-reopen',actorId:edge.users.agent.id,operationId:operation.rowid,expectedVersion:completed.operation_version,reason:'Réouverture en attente'});expect(reopening.code).toBe('OK');
  const cancellation=command({action:'request-cancel',actorId:edge.users.agent.id,targetType:'ACTIVITY',targetId:activity.activity_id,expectedVersion:activity.version,reason:'Annulation du parent'});expect(cancellation.code).toBe('OK');
  expect(command({action:'decide-cancel',actorId:fixture.users.validator.id,requestId:cancellation.request_id,expectedVersion:cancellation.request_version,decision:'APPROVED',reason:'Le parent est annulé'}).code).toBe('OK');
  expect(command({action:'decide-reopen',actorId:fixture.users.validator.id,requestId:reopening.request_id,expectedVersion:reopening.request_version,decision:'APPROVED',reason:'Ne doit pas rouvrir'}).code).toBe('STALE_VERSION');
  expect(sql(`SELECT CONCAT(status,'|',spent_amount) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('COMPLETED|100');
  expect(command({action:'decide-reopen',actorId:fixture.users.validator.id,requestId:reopening.request_id,expectedVersion:reopening.request_version,decision:'REJECTED',reason:'Parent désormais annulé'}).code).toBe('OK');
});

test('Completed Operation reopening returns to in progress and recalculates once', () => {
  const activity=fixture.activities.execution;const operation=activity.operations[0];const version=sql(`SELECT version FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`);
  const request=command({action:'request-reopen',actorId:fixture.users.agent.id,operationId:operation.rowid,expectedVersion:version,reason:'Correction nécessaire'});expect(request.code).toBe('OK');
  const approved=command({action:'decide-reopen',actorId:fixture.users.validator.id,requestId:request.request_id,expectedVersion:request.request_version,decision:'APPROVED',reason:'Correction autorisée'});expect(approved.code).toBe('OK');
  expect(sql(`SELECT target_version FROM llx_mjlfinancement_audit_event WHERE operation_id=${operation.rowid} AND action='REOPENING_APPROVED' ORDER BY rowid DESC LIMIT 1`)).toBe(version);
  expect(sql(`SELECT status FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe('IN_PROGRESS');
  const before=sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED'`);
  expect(command({action:'reconcile',activityId:activity.activity_id,localDate:'2026-10-01'}).code).toBe('OK');
  const after=sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED'`);
  expect(command({action:'reconcile',activityId:activity.activity_id,localDate:'2026-10-01'}).code).toBe('OK');
  expect(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED'`)).toBe(after);
  expect(Number(after)).toBeGreaterThanOrEqual(Number(before));
});

test('entity isolation and audit failure both fail closed without business mutation', () => {
  const other=secondary.activities.execution;const otherOperation=other.operations[0];
  const isolated=command({action:'update',actorId:fixture.users.agent.id,activityId:other.activity_id,operationId:otherOperation.rowid,expectedVersion:otherOperation.version,input:{status:'IN_PROGRESS',spent_amount:'100',observation:null}});
  expect(isolated.code).toBe('NOT_FOUND');
  expect(sql(`SELECT CONCAT(status,'|',version) FROM llx_mjlfinancement_operation WHERE entity=2 AND rowid=${otherOperation.rowid}`)).toBe(`TODO|${otherOperation.version}`);

  const activity=fixture.activities.execution;const operation=activity.operations[1];const before=sql(`SELECT CONCAT(status,'|',spent_amount,'|',version) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`);const version=before.split('|')[2];
  sql('RENAME TABLE llx_mjlfinancement_audit_event TO llx_mjlfinancement_audit_event_unavailable');
  try {
    const failed=command({action:'update',actorId:fixture.users.agent.id,activityId:activity.activity_id,operationId:operation.rowid,expectedVersion:version,input:{status:'COMPLETED',spent_amount:'200',observation:null}});
    expect(failed.code).toBe('FAILED');
  } finally {
    sql('RENAME TABLE llx_mjlfinancement_audit_event_unavailable TO llx_mjlfinancement_audit_event');
  }
  expect(sql(`SELECT CONCAT(status,'|',spent_amount,'|',version) FROM llx_mjlfinancement_operation WHERE rowid=${operation.rowid}`)).toBe(before);
});

test('removed assignments, malformed identifiers, cross-parent targets, and foreign references are isolated', () => {
  const removed=edge.activities['removed-agent'];const removedOperation=removed.operations[0];
  sql(`UPDATE llx_mjlfinancement_activity_assignment SET date_end=NOW() WHERE entity=1 AND fk_activity=${removed.activity_id} AND fk_user=${edge.users.agent2.id} AND date_end IS NULL`);
  expect(command({action:'update',actorId:edge.users.agent2.id,activityId:removed.activity_id,operationId:removedOperation.rowid,expectedVersion:removedOperation.version,input:{status:'IN_PROGRESS',spent_amount:'100',observation:null}}).code).toBe('FORBIDDEN');
  expect(command({action:'update',actorId:edge.users.agent.id,activityId:'1x',operationId:removedOperation.rowid,expectedVersion:removedOperation.version,input:{status:'IN_PROGRESS',spent_amount:'100',observation:null}}).code).toBe('INVALID_INPUT');
  const other=fixture.activities.execution;
  expect(command({action:'update',actorId:fixture.users.agent.id,activityId:other.activity_id,operationId:removedOperation.rowid,expectedVersion:removedOperation.version,input:{status:'IN_PROGRESS',spent_amount:'100',observation:null}}).code).toBe('NOT_FOUND');
  expect(()=>sql(`INSERT INTO llx_mjlfinancement_operation (entity,fk_activity,fk_operation_type,name,authorized_amount,status,version,date_creation,fk_user_creat,fk_user_modif) VALUES (1,${other.activity_id},999999,'Référence étrangère',1,'TODO',1,NOW(),${edge.users.agent.id},${edge.users.agent.id})`)).toThrow();
});

test('simultaneous reconciliation emits one derived transition event', async () => {
  const activity=edge.activities['reconcile-race'];const before=Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED'`));const barrier=crypto.randomBytes(16).toString('hex');
  const base={operation:'reconcile',activity_id:String(activity.activity_id),version:String(activity.version),actor_id:String(edge.users.agent.id),local_date:'2026-10-01',barrier,lock_wait_timeout:5};
  const results=await Promise.all([parallelCancellation(base),parallelCancellation(base)]);
  expect(results.map((result)=>result.code)).toEqual(['OK','OK']);
  expect(Number(sql(`SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE activity_id=${activity.activity_id} AND action='ACTIVITY_EXECUTION_STATUS_CHANGED'`))).toBe(before+1);
});

test('database guards reject terminal bypass, unauthorised cancellation, and invalid financial shape', () => {
  const cancelled=fixture.activities['career-decision'].operations[0];
  expect(()=>sql(`UPDATE llx_mjlfinancement_operation SET status='IN_PROGRESS',version=version+1 WHERE rowid=${cancelled.rowid}`)).toThrow();
  const staleActivity=fixture.activities['stale-aggregate'];
  expect(()=>sql(`UPDATE llx_mjlfinancement_activity SET validation_status='CANCELLED',is_cancelled=1,version=version+1 WHERE rowid=${staleActivity.activity_id}`)).toThrow();
  const active=fixture.activities.execution.operations[1];
  expect(()=>sql(`UPDATE llx_mjlfinancement_operation SET spent_amount=201,observation=NULL,version=version+1 WHERE rowid=${active.rowid}`)).toThrow();
});

test('guarded execution and exception routes expose only role-appropriate controls', async ({ browser, request }) => {
  for (const route of ['/custom/mjlfinancement/operations.php', '/custom/mjlfinancement/operationrequests.php']) {
    const anonymous = await request.get(route);
    expect(anonymous.status()).toBe(403);
    expect(await anonymous.text()).toBe('Forbidden');
  }

  const agentContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  await login(agentPage, 'phase3a.execution.agent');
  const unexpectedActivityQuery=await agentContext.request.get('/custom/mjlfinancement/activities.php?unexpected=1');
  expect(unexpectedActivityQuery.status()).toBe(403);
  await agentPage.goto('/custom/mjlfinancement/operations.php');
  await expect(agentPage.locator('main')).toHaveCount(1);
  await expect(agentPage.getByRole('heading', { name: 'Opérations' })).toBeVisible();
  await expect(agentPage.getByText('Montant dépensé', { exact: true }).first()).toBeVisible();
  await expect(agentPage.getByText('Type d’Opération', { exact: true }).first()).toBeVisible();
  await expect(agentPage.getByText('Écart', { exact: true }).first()).toBeVisible();
  await expect(agentPage.getByText('Variance %', { exact: true }).first()).toBeVisible();
  await expect(agentPage.getByRole('button', { name: 'Enregistrer l’exécution' }).first()).toBeVisible();
  await expect(agentPage.getByRole('link', { name: 'Voir les demandes d’exception' }).first()).toBeVisible();
  const visibleRequestTarget=fixture.activities.execution.operations[1];
  const nullableForm=agentPage.locator(`form:has(input[name="operation_id"][value="${visibleRequestTarget.rowid}"]):has(input[name="action"][value="update_execution"])`);
  await nullableForm.locator('select[name="status"]').selectOption('IN_PROGRESS');
  await nullableForm.locator('input[name="spent_amount"]').fill('');
  await nullableForm.locator('textarea[name="observation"]').fill('');
  await nullableForm.getByRole('button',{name:'Enregistrer l’exécution'}).click();
  await expect(agentPage).toHaveURL(/result=OK/);
  expect(sql(`SELECT IF(spent_amount IS NULL,'NULL',spent_amount) FROM llx_mjlfinancement_operation WHERE rowid=${visibleRequestTarget.rowid}`)).toBe('NULL');
  const invalidSnapshot=sql(`SELECT CONCAT(status,'|',IF(spent_amount IS NULL,'NULL',spent_amount),'|',version,'|',(SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE operation_id=${visibleRequestTarget.rowid})) FROM llx_mjlfinancement_operation WHERE rowid=${visibleRequestTarget.rowid}`);
  for(const malformedAmount of ['abc','9223372036854775808']){
    const form=agentPage.locator(`form:has(input[name="operation_id"][value="${visibleRequestTarget.rowid}"]):has(input[name="action"][value="update_execution"])`);const value=async(name)=>form.locator(`input[name="${name}"]`).inputValue();
    const response=await agentContext.request.post('/custom/mjlfinancement/operations.php',{maxRedirects:0,form:{token:await value('token'),mjl_submission:await value('mjl_submission'),action:'update_execution',activity_id:await value('activity_id'),operation_id:await value('operation_id'),version:await value('version'),status:'IN_PROGRESS',spent_amount:malformedAmount,observation:'Ne doit pas muter'}});expect(response.status()).toBe(303);expect(response.headers().location).toContain('result=INVALID_INPUT');expect(sql(`SELECT CONCAT(status,'|',IF(spent_amount IS NULL,'NULL',spent_amount),'|',version,'|',(SELECT COUNT(*) FROM llx_mjlfinancement_audit_event WHERE operation_id=${visibleRequestTarget.rowid})) FROM llx_mjlfinancement_operation WHERE rowid=${visibleRequestTarget.rowid}`)).toBe(invalidSnapshot);await agentPage.reload();
  }
  const requestedTargetVersion=sql(`SELECT version FROM llx_mjlfinancement_operation WHERE rowid=${visibleRequestTarget.rowid}`);
  const visibleRequest=command({action:'request-cancel',actorId:fixture.users.agent.id,targetType:'OPERATION',targetId:visibleRequestTarget.rowid,expectedVersion:requestedTargetVersion,reason:'Libellé français visible'});expect(visibleRequest.code).toBe('OK');
  expect(command({action:'update',actorId:fixture.users.agent.id,activityId:fixture.activities.execution.activity_id,operationId:visibleRequestTarget.rowid,expectedVersion:requestedTargetVersion,input:{status:'IN_PROGRESS',spent_amount:null,observation:null}}).code).toBe('OK');
  await agentPage.goto('/custom/mjlfinancement/operationrequests.php?type=CANCELLATION&status=PENDING');
  await expect(agentPage.locator('main')).toHaveCount(1);
  await expect(agentPage.getByRole('heading', { name: 'Demandes d’exception' })).toBeVisible();
  await expect(agentPage.locator('article dd').filter({hasText:'En attente'}).first()).toBeVisible();
  const requestCard=agentPage.locator('article').filter({hasText:'Libellé français visible'});
  await expect(requestCard.getByText('Version ciblée',{exact:true}).locator('..')).toContainText(requestedTargetVersion);
  await expect(requestCard.getByText('Version actuelle de la cible',{exact:true}).locator('..')).toContainText(String(Number(requestedTargetVersion)+1));
  await expect(requestCard.getByText('Version actuelle de la cible',{exact:true}).locator('..')).toContainText('cible modifiée');
  await expect(agentPage.getByRole('button', { name: /Approuver|Rejeter/ })).toHaveCount(0);
  await requestCard.getByRole('button',{name:'Retirer la demande'}).click();
  await expect(agentPage).toHaveURL(/operationrequests\.php\?result=OK/);
  expect(sql(`SELECT status FROM llx_mjlfinancement_cancellation_request WHERE rowid=${visibleRequest.request_id}`)).toBe('WITHDRAWN');
  expect(command({action:'update',actorId:fixture.users.agent.id,activityId:fixture.activities.execution.activity_id,operationId:visibleRequestTarget.rowid,expectedVersion:String(Number(requestedTargetVersion)+1),input:{status:'IN_PROGRESS',spent_amount:'200',observation:null}}).code).toBe('OK');
  await agentPage.goto(`/custom/mjlfinancement/activities.php?id=${fixture.activities.execution.activity_id}`);
  await expect(agentPage.locator('main')).toHaveCount(1);
  for (const label of ['Montant autorisé actif','Montant autorisé annulé','Dépenses actives','Dépenses annulées','Montants dépensés manquants','Opérations annulées incomplètes']) await expect(agentPage.getByText(label,{exact:true})).toBeVisible();
  await expect(agentPage.getByText('Montant autorisé actif',{exact:true}).locator('..')).toContainText('300 F CFA');
  await expect(agentPage.getByText('Dépenses actives',{exact:true}).locator('..')).toContainText('200 F CFA');
  await expect(agentPage.getByText('Montants dépensés manquants',{exact:true}).locator('..')).toContainText('0');
  await expect(agentPage.getByText(/Opération zéro.*dépensé : 0 F CFA/)).toBeVisible();
  const target=fixture.activities.execution;const forged=await agentContext.request.post('/custom/mjlfinancement/operations.php',{form:{action:'update_execution',activity_id:String(target.activity_id),operation_id:String(target.operations[0].rowid),version:'1',status:'COMPLETED',spent_amount:'0',observation:'Forgé'}});expect(forged.status()).toBe(403);
  await agentContext.close();

  const supervisorContext = await browser.newContext();
  const supervisorPage = await supervisorContext.newPage();
  await login(supervisorPage, 'phase3a.execution.supervisor');
  await supervisorPage.goto('/custom/mjlfinancement/activities.php?q=Planification_');
  await expect(supervisorPage.locator('tbody tr')).toHaveCount(1);
  await expect(supervisorPage.getByText('Planification_conservée')).toBeVisible();
  await supervisorPage.goto('/custom/mjlfinancement/operations.php');
  await expect(supervisorPage.getByRole('button', { name: 'Enregistrer l’exécution' })).toHaveCount(0);
  await supervisorPage.goto('/custom/mjlfinancement/operationrequests.php');
  await expect(supervisorPage.getByRole('button', { name: /Approuver|Rejeter/ })).toHaveCount(0);
  await supervisorContext.close();

  const validatorContext = await browser.newContext();
  const validatorPage = await validatorContext.newPage();
  await login(validatorPage, 'phase3a.execution.validator');
  await validatorPage.goto('/custom/mjlfinancement/operations.php');
  await expect(validatorPage.getByRole('button', { name: 'Enregistrer l’exécution' })).toHaveCount(0);
  await validatorPage.goto('/custom/mjlfinancement/operationrequests.php?status=');
  await expect(validatorPage.getByRole('heading', { name: 'Demandes d’exception' })).toBeVisible();
  await validatorPage.goto(`/custom/mjlfinancement/activities.php?id=${fixture.activities['activity-cancel'].activity_id}`);
  for(const [label,value]of [['Complétude financière','Partiellement renseignée'],['Montant autorisé actif','100 F CFA'],['Montant autorisé annulé','100 F CFA'],['Dépenses actives','100 F CFA'],['Dépenses annulées','Non renseigné'],['Montants dépensés manquants','1'],['Opérations annulées incomplètes','1']])await expect(validatorPage.getByText(label,{exact:true}).locator('..')).toContainText(value);
  await validatorContext.close();

  const adminContext=await browser.newContext();const adminPage=await adminContext.newPage();await login(adminPage,'admin');for(const route of ['/custom/mjlfinancement/operations.php','/custom/mjlfinancement/operationrequests.php']){const response=await adminPage.goto(route);expect(response.status()).toBe(403);expect(await response.text()).toBe('Forbidden');}await adminContext.close();
});
