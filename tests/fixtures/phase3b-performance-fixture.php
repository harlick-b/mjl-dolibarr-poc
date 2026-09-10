<?php

$sentinel=require '/opt/mjl-tests/fixtures/phase1-fixture-preflight.php';
define('NOLOGIN',1);require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivityassignment.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexport.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst012_schema.lib.php';
$res=$db->query("SELECT value FROM ".$db->prefix()."const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");
$row=$res?$db->fetch_object($res):null;if(!$row||!hash_equals($sentinel,(string)$row->value))exit(2);
$request=json_decode(stream_get_contents(STDIN),true);if(!is_array($request)||count($request)>8)exit(3);
$conf->entity=1;
function bench_actor($id){global $db;$u=new User($db);if($u->fetch((int)$id)<=0)throw new RuntimeException('Missing benchmark actor');return $u;}
function bench_ok($result){if(($result['code']??'')!=='OK')throw new RuntimeException('Benchmark command failed: '.($result['code']??'unknown'));return $result;}
if(($request['action']??'')==='build'){
 if(array_keys($request)!==array('action','agent','other','supervisor','validator','partner','project','type'))exit(3);
 mjl_rst012_install($db);
 $agent=bench_actor($request['agent']);$other=bench_actor($request['other']);$supervisor=bench_actor($request['supervisor']);$validator=bench_actor($request['validator']);
 if((int)mjl_rst005_scalar($db,"SELECT COUNT(*) FROM ".$db->prefix()."mjlfinancement_activity WHERE entity=1 AND name LIKE 'BENCH %'")!==0)throw new RuntimeException('Benchmark cohort already exists');
 $command=new MjlActivityCommand($db,function(){return '2026-09-04';},1);$assignment=new MjlActivityAssignment($db);$first=null;
 for($i=0;$i<1000;$i++){
  $ops=array();for($j=0;$j<10;$j++)$ops[]=array('client_key'=>'op-'.$j,'name'=>'Opération de mesure '.$j,'type_id'=>(string)$request['type'],'authorized_amount'=>'100000');
  $input=array('partner_id'=>(string)$request['partner'],'project_id'=>(string)$request['project'],'name'=>sprintf('BENCH %04d',$i),'description'=>'Mesure du portefeuille MJL.','date_start'=>'2026-09-05','date_end'=>'2032-12-31','authorized_amount'=>'1000000','operations'=>$ops);
  $r=bench_ok($i%5===0?$command->createDraft($input,$agent):$command->createAndSubmit($input,$agent));$id=$r['activity_id'];if($first===null)$first=$id;
  if($i%5>=2)$r=bench_ok($command->reviewRevision((string)$id,(string)$r['revision_id'],(string)$r['version'],$supervisor,'PREVALIDATED'));
  if($i%5>=3)$r=bench_ok($command->reviewRevision((string)$id,(string)$r['revision_id'],(string)$r['version'],$validator,'FINAL_VALIDATED'));
  if($i%5===4){
   $res=$db->query('SELECT rowid,version FROM '.$db->prefix().'mjlfinancement_operation WHERE entity=1 AND fk_activity='.(int)$id.' ORDER BY rowid');if(!$res)throw new RuntimeException('Benchmark children unavailable');$children=array();while($o=$db->fetch_object($res))$children[]=$o;
   foreach($children as$j=>$o)if($j>=5)bench_ok($command->updateOperationExecution((string)$id,(string)$o->rowid,(string)$o->version,array('status'=>$j>=8?'COMPLETED':'IN_PROGRESS','spent_amount'=>$j>=8?'100000':'0','observation'=>$j>=8?null:'Aucune dépense'),$agent));
   $cancel=bench_ok($command->requestCancellation('OPERATION',(string)$children[7]->rowid,'2','Mesure des montants annulés',$agent));bench_ok($command->decideCancellation((string)$cancel['request_id'],'1','APPROVED','Annulation de mesure',$validator));
  }
  if($i%5===0)bench_ok($assignment->changeAssignment((string)$id,(string)$r['version'],$validator,'ADD_ADDITIONAL',(string)$other->id,'Double affectation de mesure'));
 }
 $existing=(int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_audit_event WHERE entity=1');
 $padding=max(0,50000-$existing);
 for($start=0;$start<$padding;$start+=500){if(!$db->begin())throw new RuntimeException('Benchmark audit transaction failed');try{for($i=$start;$i<min($start+500,$padding);$i++){
   $event=array('entity'=>1,'object_type'=>'activity','object_ref'=>sprintf('BENCH-AUDIT-%05d',$i),'activity_id'=>$first,'actor'=>$agent,'action'=>'ACTIVITY_CREATED','result'=>'SUCCESS','context'=>array('reference'=>'Activité de mesure'));
   if(mjl_audit_append_in_transaction($db,$event)<1)throw new RuntimeException('Benchmark audit append failed');
  }if(!$db->commit())throw new RuntimeException('Benchmark audit commit failed');}catch(Throwable $e){$db->rollback();throw $e;}}
 print json_encode(array('activity_id'=>$first,'activities'=>(int)mjl_rst005_scalar($db,"SELECT COUNT(*) FROM ".$db->prefix()."mjlfinancement_activity WHERE entity=1 AND name LIKE 'BENCH %'"),'operations'=>(int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_operation WHERE entity=1 AND fk_activity IN (SELECT rowid FROM '.$db->prefix()."mjlfinancement_activity WHERE entity=1 AND name LIKE 'BENCH %')"),'audit_events'=>(int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_audit_event WHERE entity=1'),'added_audit_events'=>$padding,'php_version'=>PHP_VERSION,'memory_limit'=>ini_get('memory_limit')));exit;
}
if(($request['action']??'')==='export'){
 if(array_keys($request)!==array('action','actor','report','format','filters'))exit(3);
 $builders=array('activities'=>'mjl_report_build_activities','operations'=>'mjl_report_build_operations','activity_detail'=>'mjl_report_build_activity_detail','portfolio'=>'mjl_report_build_portfolio','audit'=>'mjl_report_build_audit');
 if(!isset($builders[$request['report']])||!in_array($request['format'],array('pdf','xlsx','csv'),true)||!is_array($request['filters']))exit(3);
 $actor=bench_actor($request['actor']);if(function_exists('memory_reset_peak_usage'))memory_reset_peak_usage();$start=hrtime(true);
 $artifact=(new MjlExport($db,$actor,1,'/tmp/mjlfinancement-exports'))->generate($request['report'],$request['format'],$request['filters'],$builders[$request['report']]);
 try{
  $hash=hash_init('sha256');hash_update_stream($hash,$artifact['stream']);if(!hash_equals($artifact['sha256'],hash_final($hash)))throw new RuntimeException('Benchmark descriptor mismatch');
  $elapsed=(hrtime(true)-$start)/1000000;$peak=memory_get_peak_usage(true);
  $res=$db->query('SELECT body_row_count,content_sha256 FROM '.$db->prefix()."mjlfinancement_export_record WHERE entity=1 AND ref='".$db->escape($artifact['ref'])."'");
  $record=$res?$db->fetch_object($res):null;
  if(!$record||!hash_equals($artifact['sha256'],$record->content_sha256))throw new RuntimeException('Benchmark evidence mismatch');
  print json_encode(array('milliseconds'=>$elapsed,'peak_bytes'=>$peak,'memory_limit'=>ini_get('memory_limit'),'body_rows'=>(int)$record->body_row_count,'bytes'=>$artifact['bytes'],'sha256'=>$artifact['sha256']));
 }finally{fclose($artifact['stream']);}exit;
}
exit(3);
