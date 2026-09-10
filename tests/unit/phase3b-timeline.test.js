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
