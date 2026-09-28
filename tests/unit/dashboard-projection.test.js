const test = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const lib = path.resolve(__dirname, '../../custom/mjlfinancement/lib/mjl_monitoring_work.lib.php');
function project(expression) {
  return JSON.parse(execFileSync('php', ['-r', `require '${lib}'; echo json_encode(${expression});`], {encoding:'utf8'}));
}
test('dashboard separates proposal stages and retains unknown spending', () => {
  const r=project("mjl_monitoring_dashboard_totals([['validation_status'=>'DRAFT','pending_amount'=>'20'],['validation_status'=>'SUBMITTED','pending_amount'=>'10'],['validation_status'=>'CANCELLED','validated_amount'=>'100','total_spent_amount'=>null]])");
  assert.equal(r.pending_draft_amount,'20'); assert.equal(r.pending_submitted_amount,'10');
  assert.equal(r.pending_amount,'30'); assert.equal(r.validated_amount,'100'); assert.equal(r.total_spent_amount,null);
});
test('review eligibility respects contributors and allows late unchanged approval but not correction', () => {
  const r=project("[mjl_monitoring_activity_actions(['validation_status'=>'SUBMITTED','fk_current_revision'=>3,'date_start'=>'2032-01-01','contributors'=>[7]],'AGENT_VERIFICATEUR',7,'2032-01-02'), mjl_monitoring_activity_actions(['validation_status'=>'SUBMITTED','fk_current_revision'=>3,'date_start'=>'2032-01-01','contributors'=>[8]],'AGENT_VERIFICATEUR',7,'2032-01-02'), mjl_monitoring_activity_actions(['validation_status'=>'PREVALIDATED','fk_current_revision'=>3,'date_start'=>'2032-01-10','prevalidator_id'=>7],'VALIDATEUR_DEFINITIF',7,'2032-01-02')]");
  assert.equal(r[0].review,false); assert.equal(r[1].review,true); assert.equal(r[1].return,false); assert.equal(r[2].review,false);
});
test('stale exception approval stays unavailable while rejection and own withdrawal remain possible', () => {
  const r=project("(function(){ $a=['version'=>4,'fk_current_revision'=>9,'assignments'=>[['fk_user'=>7]]]; $o=[['rowid'=>2,'version'=>3,'status'=>'TODO']]; $r=['request_type'=>'CANCELLATION','target_type'=>'OPERATION','target_id'=>2,'rowid'=>1,'status'=>'PENDING','target_version'=>2,'fk_target_revision'=>9,'fk_requester'=>7]; return [mjl_monitoring_request_actions($r,$a,$o,'VALIDATEUR_DEFINITIF',8),mjl_monitoring_request_actions($r,$a,$o,'AGENT_SAISIE',7),mjl_monitoring_request_actions(array_merge($r,['target_version'=>3]),$a,$o,'VALIDATEUR_DEFINITIF',8)]; })()");
  assert.equal(r[0].approve,false); assert.equal(r[0].reject,true); assert.equal(r[0].stale,true);
  assert.equal(r[1].withdraw,true); assert.equal(r[2].approve,true);
});
test('monitoring navigation projects business additions and keeps complete audit separate',()=>{
 const file=path.resolve(__dirname,'../../custom/mjlfinancement/lib/mjl_navigation_registry.lib.php');
 const r=JSON.parse(execFileSync('php',['-r',`require '${file}'; echo json_encode([mjl_navigation_project_registry(['workspace_enter'=>true,'monitoring_read'=>true]),mjl_navigation_active_state('/erp/custom/mjlfinancement/reports.php?report=audit','/erp'),mjl_navigation_active_state('/custom/mjlfinancement/reports.php?report=portfolio')]);`],{encoding:'utf8'}));
 assert.deepEqual(r[0].flatMap(x=>x.items.map(y=>y.id)),['home','alerts','requests','reports']);
 assert.equal(r[1].id,'audit'); assert.equal(r[2].id,'reports');
});
test('an assigned Agent may abandon a draft after structural editing freezes',()=>{
 const r=project("mjl_monitoring_activity_actions(['validation_status'=>'DRAFT','fk_current_revision'=>null,'date_start'=>'2032-01-01','assignments'=>[['fk_user'=>7]]],'AGENT_SAISIE',7,'2032-01-02')");
 assert.equal(r.edit,false); assert.equal(r.abandon,true);
});

test('structural permissions freeze on the start date while unchanged review stays eligible',()=>{
 const r=project("(function(){ $a=['validation_status'=>'DRAFT','fk_current_revision'=>null,'date_start'=>'2032-01-02','assignments'=>[['fk_user'=>7]]]; return [mjl_monitoring_activity_actions($a,'AGENT_SAISIE',7,'2032-01-01'),mjl_monitoring_activity_actions($a,'AGENT_SAISIE',7,'2032-01-02'),mjl_monitoring_activity_actions(array_merge($a,['validation_status'=>'SUBMITTED','fk_current_revision'=>9]),'AGENT_VERIFICATEUR',8,'2032-01-02')]; })()");
 assert.equal(r[0].edit,true);assert.equal(r[1].edit,false);assert.equal(r[2].review,true);assert.equal(r[2].return,false);
});
test('Activity cancellation becomes stale when its exact Operation set changes',()=>{
 const r=project("(function(){ $ops=[['rowid'=>1,'version'=>2,'status'=>'TODO']]; $a=['version'=>3,'fk_current_revision'=>4]; $r=['request_type'=>'CANCELLATION','target_type'=>'ACTIVITY','status'=>'PENDING','target_version'=>3,'fk_target_revision'=>4,'target_operation_set_hash'=>mjl_monitoring_operation_set_hash($ops)]; return [mjl_monitoring_request_actions($r,$a,$ops,'VALIDATEUR_DEFINITIF',8),mjl_monitoring_request_actions($r,$a,array_merge($ops,[['rowid'=>2,'version'=>1,'status'=>'TODO']]),'VALIDATEUR_DEFINITIF',8)]; })()");
 assert.equal(r[0].approve,true);assert.equal(r[1].approve,false);assert.equal(r[1].stale,true);assert.equal(r[1].reject,true);
});
