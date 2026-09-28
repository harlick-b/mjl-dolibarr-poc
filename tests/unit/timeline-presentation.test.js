const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const library=path.resolve(__dirname,'../../custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php');
function present(event){return JSON.parse(execFileSync('php',['-r',`require '${library}'; echo json_encode(mjl_timeline_present_event(json_decode(stream_get_contents(STDIN),true)));`],{input:JSON.stringify(event),encoding:'utf8'}));}
test('chronology describes execution changes with null, zero and a sanitized observation',()=>{
 const row={action:'OPERATION_EXECUTION_UPDATED',operation_id:12,previous_values_json:JSON.stringify({status:'TODO',spent_amount:null,observation:null}),new_values_json:JSON.stringify({status:'IN_PROGRESS',spent_amount:'0',observation:'Ligne 1\n{"password":"PRIVATE VALUE"}'})};
 const event=present(row);
 assert.equal(event.title,'Exécution de l’Opération modifiée');
 assert.match(event.detail,/Opération n° 12/);
 assert.match(event.detail,/À faire → En cours/);
 assert.match(event.detail,/Non renseigné → 0 F CFA/);
 assert.match(event.detail,/Ligne 1\n/);
 assert.doesNotMatch(event.detail,/PRIVATE VALUE|spent_amount/);
});
test('chronology names automatic date transitions and refuses unrecognized causes',()=>{
 const row={action:'ACTIVITY_EXECUTION_STATUS_CHANGED',state_before:'UPCOMING',state_after:'OVERDUE',context_json:JSON.stringify({source:'SCHEDULED'})};
 const event=present(row);
 assert.match(event.title,/automatiquement/);
 assert.match(event.detail,/À venir → En retard/);
 assert.equal(present({...row,context_json:'{"source":"UNKNOWN"}'}).detail,'Détails indisponibles.');
});
test('chronology keeps request decisions contextual and excludes technical payload details',()=>{
 const event=present({action:'CANCELLATION_REJECTED',operation_id:7,state_before:'PENDING',state_after:'REJECTED',context_json:'{"request_id":23}',previous_values_json:'{"target_operation_set_hash":"INTERNAL_HASH"}',reason:'Motif documenté {"token":"PRIVATE VALUE"}',actor_name_snapshot:'Nom {"password":"PRIVATE ACTOR"}'});
 assert.equal(event.title,'Demande d’annulation rejetée');
 assert.match(event.detail,/En attente → Rejetée.*Demande n° 23.*Opération n° 7.*Motif documenté/);
 assert.doesNotMatch(JSON.stringify(event),/PRIVATE|INTERNAL_HASH|target_operation_set_hash/);
 for(const payload of ['{invalid','{"observation":{"secret":"PRIVATE"}}']) assert.equal(present({action:'OPERATION_EXECUTION_UPDATED',new_values_json:payload}).detail,'Détails indisponibles.');
 assert.equal(present({action:'UNKNOWN',context_json:'{"requested_amount":"500"}'}).detail,'Détails indisponibles.');
});
test('chronology identifies cancellation-driven assignment removal from its captured identifier',()=>{
 const event=present({action:'ASSIGNMENT_REMOVED',state_before:'CURRENT',state_after:'ENDED',context_json:'{"request_id":3,"target_agent_id":42}'});
 assert.match(event.detail,/Affectation active → Affectation terminée/);
 assert.match(event.detail,/Agent n° 42/);
});

test('chronology renders creation, review, and assignment without raw payloads', () => {
 const created = present({action:'ACTIVITY_CREATED',actor_name_snapshot:'Awa',actor_role_snapshot:'AGENT_SAISIE',event_date:'2026-09-04 10:00:00',state_after:'DRAFT'});
 assert.equal(created.title,'Activité créée');
 assert.equal(created.actor,'Awa');
 assert.equal(created.role,'Agent de saisie');
 assert.match(created.date,/^04\/09\/2026/);
 const malformed = present({action:'ACTIVITY_CREATED',actor_name_snapshot:'Awa',event_date:'2026-09-04 10:01:00',context_json:'{malformed'});
 assert.equal(malformed.title,'Événement enregistré');
 assert.doesNotMatch(JSON.stringify(malformed),/malformed|context_json|ACTIVITY_CREATED/);
 const unknown = present({action:'UNKNOWN_EVENT',actor_name_snapshot:'Awa',event_date:'2026-09-04 10:02:00',context_json:'{"secret":"x"}'});
 assert.equal(unknown.title,'Événement enregistré');
 assert.doesNotMatch(JSON.stringify(unknown),/secret|UNKNOWN_EVENT/);
 const review = present({action:'ACTIVITY_REVIEW_DECIDED',actor_name_snapshot:'Bio',actor_role_snapshot:'VALIDATEUR_DEFINITIF',event_date:'2026-09-04 10:03:00',context_json:'{"revision_number":2,"decision":"RETURNED_VALIDATOR","requested_amount":"2500"}'});
 assert.match(review.detail,/Révision 2.*Retour en correction.*2 500 F CFA/);
 const structure = present({action:'ACTIVITY_STRUCTURE_SAVED',actor_name_snapshot:'Awa',event_date:'2026-09-04 10:04:00',previous_values_json:'{"activity":{"name":"Avant"},"operations":[{"name":"A"}]}',new_values_json:'{"activity":{"name":"Après"},"operations":[{"name":"A"},{"name":"B"}]}'});
 assert.match(structure.detail,/nom.*Opérations : 1 → 2/);
 const assignment = present({action:'ASSIGNMENT_ADDED',actor_name_snapshot:'Awa',event_date:'2026-09-04 10:02:00',context_json:'{"target_agent_name":"Moussa Bio"}'});
 assert.match(assignment.detail,/Moussa Bio/);
 const label = execFileSync('php',['-r',`require '${library}'; echo mjl_timeline_state_label('FUTURE_STATE');`],{encoding:'utf8'});
 assert.equal(label,'Statut non reconnu');
});

test('money formatter preserves the signed integer maximum and normalizes negative zero', () => {
 const presentation = path.resolve(__dirname,'../../custom/mjlfinancement/lib/mjl_presentation.lib.php');
 for (const [amount,expected] of [
  ['9223372036854775807','9 223 372 036 854 775 807 F CFA'],
  ['-0','0 F CFA'],
 ]) {
  const output = execFileSync('php',['-r',`require '${presentation}'; echo mjl_format_money(stream_get_contents(STDIN));`],{input:amount,encoding:'utf8'});
  assert.equal(output,expected);
 }
});
