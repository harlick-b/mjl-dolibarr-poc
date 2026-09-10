const test = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const lib = path.resolve(__dirname, '../../custom/mjlfinancement/lib/mjl_monitoring.lib.php');
function project(a, operations) {
  const input = Buffer.from(JSON.stringify([a, operations])).toString('base64');
  return JSON.parse(execFileSync('php', ['-r', `require '${lib}'; [$a,$o]=json_decode(base64_decode('${input}'),true); echo json_encode(mjl_monitoring_activity_projection($a,$o,'2032-06-10'));`], {encoding:'utf8'}));
}
const base = {rowid:1, validation_status:'FINAL_VALIDATED', first_submitted_amount:'90', latest_validated_amount:'100', draft_authorized_amount:'100', is_cancelled:0, date_start:'2032-06-01', date_end:'2032-06-10'};
test('monitoring retains validated cancellation and separates missing spending', () => {
 const r=project({...base,is_cancelled:1,validation_status:'CANCELLED'},[{status:'COMPLETED',authorized_amount:'40',spent_amount:'40'},{status:'CANCELLED',authorized_amount:'60',spent_amount:null}]);
 assert.equal(r.validated_amount,'100'); assert.equal(r.active_authorized_amount,'40'); assert.equal(r.cancelled_authorized_amount,'60'); assert.equal(r.active_spent_amount,'40'); assert.equal(r.cancelled_spent_amount,null); assert.equal(r.completeness,'PARTIAL'); assert.equal(r.execution_status,'CANCELLED');
});
test('unvalidated proposals never enter validated financial buckets', () => {
 const r=project({...base,latest_validated_amount:null,validation_status:'PREVALIDATED'},[{status:'TODO',authorized_amount:'100',spent_amount:null}]);
 assert.equal(r.pending_amount,'100');assert.equal(r.validated_amount,null);assert.equal(r.active_authorized_amount,null);assert.equal(r.missing_spent_count,0);assert.equal(r.execution_status,'NOT_STARTED');
});
test('drafts have no initial submission and removed children do not count', () => {
 const r=project({...base,first_submitted_amount:null,latest_validated_amount:null,validation_status:'DRAFT'},[{status:'TODO',authorized_amount:'100',spent_amount:null,date_removed:'2032-01-01'}]);
 assert.equal(r.initial_amount,null);assert.equal(r.operation_count,0);assert.equal(r.completeness,'NOT_STARTED');
});
test('monitoring totals remain exact above native integer bounds', () => {
 const out=execFileSync('php',['-r',`require '${lib}'; echo json_encode(mjl_monitoring_totals([['validated_amount'=>'9223372036854775807'],['validated_amount'=>'9223372036854775807']]));`],{encoding:'utf8'});
 assert.equal(JSON.parse(out).validated_amount,'18446744073709551614');
});
test('variance distinguishes adjacent amounts beyond native integer precision', () => {
 const out=execFileSync('php',['-r',`require '${lib}'; echo json_encode(mjl_monitoring_variance('18446744073709551614','18446744073709551615'));`],{encoding:'utf8'});
 const r=JSON.parse(out); assert.equal(r.difference,'-1'); assert.equal(r.percent,'-0.00'); assert.equal(r.display,'-0,00 %');
});
test('deadline alerts use inclusive seven-day boundaries and terminal exclusions', () => {
 const input=Buffer.from(JSON.stringify(base)).toString('base64');
 const out=execFileSync('php',['-r',`require '${lib}'; $a=json_decode(base64_decode('${input}'),true); $o=[['rowid'=>2,'status'=>'TODO','authorized_amount'=>'100','spent_amount'=>null]]; echo json_encode([mjl_monitoring_deadline_alerts($a,$o,'2032-06-03',true),mjl_monitoring_deadline_alerts($a,$o,'2032-06-11',true),mjl_monitoring_deadline_alerts(array_merge($a,['is_cancelled'=>1]),$o,'2032-06-03',true)]);`],{encoding:'utf8'});
 const r=JSON.parse(out); assert.deepEqual(r[0].map(x=>x.code),['COMPLETION_DUE','SPENDING_MISSING']); assert.deepEqual(r[1].map(x=>x.code),['COMPLETION_OVERDUE','SPENDING_MISSING']); assert.deepEqual(r[2].map(x=>x.code),['SPENDING_INFORMATION']);
});
test('report contract rejects child filters for complete activity detail', () => {
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}'; try { mjl_report_validate_request('activity_detail','csv',['activity_id'=>'1','type_id'=>'2']); echo 'accepted'; } catch (InvalidArgumentException $e) { echo $e->getMessage(); }`],{encoding:'utf8'});
 assert.equal(out,'INVALID_REPORT_FILTER');
});
test('portfolio grouping sums each full Activity once and preserves unknown spending', () => {
 const rows=[{rowid:1,fk_project:2,fk_partner:3,project_name:'Projet',partner_name:'Partenaire',validated_amount:'10',total_spent_amount:null,operation_count:1},{rowid:2,fk_project:2,fk_partner:3,project_name:'Projet',partner_name:'Partenaire',validated_amount:'20',total_spent_amount:'0',operation_count:1}];
 const input=Buffer.from(JSON.stringify(rows)).toString('base64');
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}'; echo json_encode(mjl_report_portfolio(json_decode(base64_decode('${input}'),true),'project'));`],{encoding:'utf8'});
 const r=JSON.parse(out); assert.equal(r.length,1); assert.equal(r[0].validated_amount,'30'); assert.equal(r[0].total_spent_amount,'0'); assert.equal(r[0].activity_count,2);
});
test('variance handles numeric zero and unknown authorization without division', () => {
 const out=execFileSync('php',['-r',`require '${lib}'; echo json_encode([mjl_monitoring_variance('1',0),mjl_monitoring_variance('1',null)]);`],{encoding:'utf8',timeout:2000});
 const r=JSON.parse(out); assert.equal(r[0].difference,'1'); assert.equal(r[0].ratio,null); assert.equal(r[1].difference,null);
});
test('Activities report preserves full rows and separates pending from validated money', () => {
 const rows=[{...base,ref:'ACT-1',name:'Validée',partner_name:'Partenaire',project_name:'Projet',assignments:[],operations:[],initial_amount:'90',pending_amount:null,validated_amount:'100',execution_status:'UPCOMING',completeness:'NOT_STARTED'}, {...base,rowid:2,ref:'ACT-2',name:'Proposition',partner_name:'Partenaire',project_name:'Projet',assignments:[],operations:[],initial_amount:'50',pending_amount:'50',validated_amount:null,validation_status:'SUBMITTED',execution_status:'NOT_STARTED',completeness:'NOT_STARTED'}];
 const input=Buffer.from(JSON.stringify(rows)).toString('base64');
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}'; echo json_encode(mjl_report_activities_document(json_decode(base64_decode('${input}'),true)));`],{encoding:'utf8'});
 const d=JSON.parse(out); assert.deepEqual(d.activity_ids,[1,2]); const table=d.document.sections[0];assert.equal(table.rows.length,2);
 const v=table.headers.indexOf('Montants validés, annulations incluses (FCFA)');const p=table.headers.indexOf('Propositions courantes non validées (FCFA)');
 assert.equal(table.rows[0][v].value,'100');assert.equal(table.rows[1][v].value,null);assert.equal(table.rows[1][p].value,'50');assert.equal(table.rows[0][v].currency,'XOF');
});
test('Operations report preserves signed variance, missing spending and captured parent scope', () => {
 const rows=[
 {rowid:10,activity_id:2,activity_ref:'ACT-2',activity_name:'Parent annulé',partner_name:'Partenaire',project_name:'Projet',name:'Achevée',type_label:'Type',status:'COMPLETED',authorization_kind:'Validée',authorized_amount:'9223372036854775807',spent_amount:'9223372036854775806',observation:'Écart justifié'},
 {rowid:11,activity_id:2,activity_ref:'ACT-2',activity_name:'Parent annulé',name:'Annulée',status:'CANCELLED',authorization_kind:'Validée',authorized_amount:'0',spent_amount:null,observation:null},
 {rowid:12,activity_id:3,activity_ref:'ACT-3',activity_name:'Proposition',name:'À faire',status:'TODO',authorization_kind:'Proposée',authorized_amount:'20',spent_amount:null,observation:null},
 ];
 const input=Buffer.from(JSON.stringify(rows)).toString('base64');
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}'; echo json_encode(mjl_report_operations_document(json_decode(base64_decode('${input}'),true)));`],{encoding:'utf8'});
 const doc=JSON.parse(out);assert.deepEqual(doc.activity_ids,[2,3]);const table=doc.document.sections[0];const cell=(n,label)=>table.rows[n][table.headers.indexOf(label)];
 assert.equal(cell(0,'Écart (FCFA)').value,'-1');assert.equal(cell(0,'Écart (FCFA)').currency,'XOF');assert.equal(cell(0,'Variation (%)').value.display,'-0,00 %');assert.ok(cell(0,'Variation (%)').value.ratio<0);
 assert.equal(cell(1,'Montant dépensé (FCFA)').value,null);assert.equal(cell(1,'Écart (FCFA)').value,null);assert.equal(cell(1,'État de l’Opération').value,'Annulée');assert.equal(cell(0,'État de l’Opération').value,'Terminée');assert.equal(cell(2,'Nature du montant autorisé').value,'Proposée');
});
test('Operations unavailable variation is blank in machine-readable formats',()=>{
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}'; require_once '${lib.replace('mjl_monitoring.lib.php','mjl_report_format.lib.php')}'; $d=mjl_report_operations_document([['activity_id'=>1,'status'=>'TODO','authorized_amount'=>'0','spent_amount'=>null]]);$cell=$d['document']['sections'][0]['rows'][0][12];echo json_encode([mjl_report_csv_cell($cell),mjl_report_xlsx_cell($cell)]);`],{encoding:'utf8'});
 const values=JSON.parse(out);assert.equal(values[0],'');assert.deepEqual(values[1],{type:'null',value:null,format:'General'});
});
test('Operations typed expansion fails catchably before exhausting PHP memory',()=>{
 const out=execFileSync('php',['-d','memory_limit=32M','-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}';try {$rows=array_fill(0,10000,['activity_id'=>1,'status'=>'TODO','authorized_amount'=>'1','spent_amount'=>null]);mjl_report_operations_document($rows);echo 'accepted';}catch(RuntimeException $e){echo $e->getMessage();}`],{encoding:'utf8'});
 assert.equal(out,'EXPORT_MEMORY_LIMIT');
});
test('Activity detail contains general information, financial summary and every current Operation',()=>{
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}'; $a=['rowid'=>7,'ref'=>'ACT-7','name'=>'Activité','description'=>'Description complète','validation_status'=>'FINAL_VALIDATED','execution_status'=>'IN_PROGRESS','completeness'=>'PARTIAL','assignments'=>[],'revision_number'=>'2','fk_current_revision'=>'11','validated_amount'=>'100','total_spent_amount'=>'0']; $ops=[['activity_id'=>7,'name'=>'Nulle','status'=>'IN_PROGRESS','authorized_amount'=>'40','spent_amount'=>'0'],['activity_id'=>7,'name'=>'Manquante','status'=>'TODO','authorized_amount'=>'60','spent_amount'=>null]]; echo json_encode(mjl_report_activity_detail_document([$a],$ops));`],{encoding:'utf8'});
 const d=JSON.parse(out);assert.deepEqual(d.activity_ids,[7]);assert.equal(d.document.sections.length,3);assert.equal(d.document.sections[2].rows.length,2);
 const general=d.document.sections[0],money=d.document.sections[1],ops=d.document.sections[2];
 assert.equal(general.rows[0][general.headers.indexOf('Description')].value,'Description complète');assert.equal(general.rows[0][general.headers.indexOf('Identifiant de la révision courante')].value,'11');
 assert.equal(money.rows[0][money.headers.indexOf('Dépenses renseignées (FCFA)')].value,'0');assert.equal(ops.rows[0][9].value,'0');assert.equal(ops.rows[1][9].value,null);
});
test('Activity detail refuses missing or ambiguous scope instead of producing an empty fiche',()=>{
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}'; foreach([[],[['rowid'=>1],['rowid'=>2]]] as $a) {try {mjl_report_activity_detail_document($a,[]);echo 'accepted';}catch(RuntimeException $e){echo $e->getMessage()."\\n";}}`],{encoding:'utf8'});
 assert.equal(out,'FORBIDDEN\nFORBIDDEN\n');
});
test('portfolio document has one grouping level, exact totals and every contributing Activity in scope',()=>{
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}';$a=[['rowid'=>4,'fk_project'=>2,'fk_partner'=>9,'project_name'=>'Projet','partner_name'=>'Partenaire','validated_amount'=>'9223372036854775807','total_spent_amount'=>null,'operation_count'=>2],['rowid'=>5,'fk_project'=>2,'fk_partner'=>9,'project_name'=>'Projet','partner_name'=>'Partenaire','validated_amount'=>'9223372036854775807','total_spent_amount'=>'0','operation_count'=>1]];echo json_encode(mjl_report_portfolio_document($a,'project'));`],{encoding:'utf8'});
 const d=JSON.parse(out);assert.deepEqual(d.activity_ids,[4,5]);assert.equal(d.document.sections.length,1);const t=d.document.sections[0];assert.equal(t.rows.length,1);const v=h=>t.rows[0][t.headers.indexOf(h)].value;assert.equal(v('Projet'),'Projet');assert.equal(v('Activités'),2);assert.equal(v('Opérations'),3);assert.equal(v('Montants validés, annulations incluses (FCFA)'),'18446744073709551614');assert.equal(v('Dépenses renseignées (FCFA)'),'0');
});
test('portfolio rejects empty or unsupported grouping before generation',()=>{
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}';foreach(['','both'] as $g){try{mjl_report_validate_request('portfolio','csv',['grouping'=>$g]);echo 'accepted';}catch(InvalidArgumentException $e){echo 'rejected';}}`],{encoding:'utf8'});assert.equal(out,'rejectedrejected');
});
test('portfolio distinguishes draft and returned proposals from submitted and prevalidated amounts',()=>{
 const out=execFileSync('php',['-r',`require '${lib.replace('mjl_monitoring.lib.php','mjl_report_data.lib.php')}';$a=[];foreach(['DRAFT'=>'20','RETURNED_SUPERVISOR'=>'30','SUBMITTED'=>'40','PREVALIDATED'=>'50'] as $state=>$amount)$a[]=['fk_project'=>2,'project_name'=>'Projet','validation_status'=>$state,'pending_amount'=>$amount];echo json_encode(mjl_report_portfolio($a,'project'));`],{encoding:'utf8'});const r=JSON.parse(out)[0];assert.equal(r.pending_amount,'140');assert.equal(r.draft_pending_amount,'50');assert.equal(r.submitted_pending_amount,'90');
});
