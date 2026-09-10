<?php

$sentinel=require '/opt/mjl-tests/fixtures/phase1-fixture-preflight.php';
define('NOLOGIN',1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst012_schema.lib.php';
$row=$db->query("SELECT value FROM ".$db->prefix()."const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");
$row=$row?$db->fetch_object($row):null;
if (!$row || !hash_equals($sentinel,(string)$row->value)) exit(2);
$action=$argv[1]??'';
if ($action==='install') { mjl_rst012_install($db); print "OK\n"; exit; }
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexport.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivityassignment.class.php';
$request=json_decode(fgets(STDIN,4096),true);
if (!is_array($request) || count($request)>4 || empty($request['actorId']) || empty($request['activityId'])) exit(3);
$conf->entity=1;
$user=new User($db); if ($user->fetch((int)$request['actorId'])<=0) exit(4);
if (in_array($action,array('audit-fixtures','audit-invalid'),true)) {
 $ids=array(); if (!$db->begin('disposable audit fixture')) exit(7);
 $count=$action==='audit-fixtures'?57:2;
 for ($i=0;$i<$count;$i++) {
  $event=array('entity'=>1,'object_type'=>'activity','object_ref'=>($action==='audit-fixtures'?'AUDIT-PROBE-':'AUDIT-INVALID-').$i,'activity_id'=>(int)$request['activityId'],'actor'=>$user,'actor_name_snapshot'=>'Acteur historique d’audit','action'=>'ACTIVITY_CREATED','result'=>'SUCCESS','context'=>array('reference'=>'Référence historique '.$i));
  if ($action==='audit-fixtures' && $i===0) { $event['reason']=str_repeat('é',3990).' {"password":"PRIVATE AUDIT VALUE"} '.str_repeat('suite',1000); $event['actor_name_snapshot']='Historique {"token":"PRIVATE ACTOR VALUE"}'; }
  if ($action==='audit-invalid') { if ($i===0) $event['action']='UNKNOWN_AUDIT_ACTION'; else $event['context']=array('reference'=>array('unsupported'=>'payload')); }
  $id=mjl_audit_append_in_transaction($db,$event); if ($id<1) {$db->rollback();exit(8);} $ids[]=$id;
 }
 if (!$db->commit('disposable audit fixture')) exit(9); print json_encode($ids);exit;
}
if ($action==='chronology-fixtures') {
 $events=array(
  array('action'=>'ACTIVITY_EXECUTION_STATUS_CHANGED','state_before'=>'UPCOMING','state_after'=>'OVERDUE','previous_values'=>array('execution_status'=>'UPCOMING'),'new_values'=>array('execution_status'=>'OVERDUE'),'context'=>array('source'=>'SCHEDULED')),
  array('action'=>'UNKNOWN_CHRONOLOGY_ACTION','context'=>array('requested_amount'=>'PRIVATE MALFORMED')),
  array('action'=>'OPERATION_EXECUTION_UPDATED','new_values'=>array('observation'=>array('private'=>'PRIVATE MALFORMED'))),
  array('action'=>'ACTIVITY_CREATED','context'=>array('reference'=>str_repeat('x',66000))),
 );
 $ids=array(); if (!$db->begin('disposable chronology fixture')) exit(7);
 foreach ($events as $event) {
  $event+=array('entity'=>1,'object_type'=>'activity','object_ref'=>'CHRONOLOGY-PROBE','activity_id'=>(int)$request['activityId'],'actor'=>$user,'action'=>'ACTIVITY_CREATED','result'=>'SUCCESS');
  $id=mjl_audit_append_in_transaction($db,$event);if($id<1){$db->rollback();exit(8);}$ids[]=$id;
 }
 if (!$db->commit('disposable chronology fixture')) exit(9);print json_encode($ids);exit;
}
if ($action==='spool-state') {print json_encode(array_values(array_diff(scandir('/tmp/mjlfinancement-exports'),array('.','..','generation.lock'))));exit;}
if ($action==='delivery') {
 require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_report_route.lib.php';
 $_SESSION['token']=newToken();
 $_SERVER['REQUEST_METHOD']='POST';$_FILES=array();$_POST=array('token'=>currentToken(),'format'=>'csv','activity_id'=>(string)$request['activityId']);
 ob_start();print 'INCIDENTAL_DIAGNOSTIC';mjl_report_export_http();exit;
}
if ($action==='remove') {
 $res=$db->query('SELECT version FROM '.$db->prefix().'mjlfinancement_activity WHERE entity=1 AND rowid='.(int)$request['activityId']);
 $row=$res?$db->fetch_object($res):null;if (!$row) exit(5);
 $result=(new MjlActivityAssignment($db))->changeAssignment((int)$request['activityId'],(int)$row->version,$user,MjlActivityAssignment::REMOVE_ADDITIONAL,(int)($request['targetId']??0),'Test de retrait concurrent');
 print json_encode($result)."\n";exit;
}
if (!in_array($action,array('worker','generate'),true)) exit(6);
try {
 $owner=new MjlExport($db,$user,1,'/tmp/mjlfinancement-exports');
 $artifact=$owner->generate('activities','csv',array('activity_id'=>(string)$request['activityId']),function($reader,$filters)use($action){
  $data=mjl_report_build_activities($reader,$filters);if ($action==='generate') return $data;print "READY\n";flush();
  $read=array(STDIN);$write=null;$except=null;
  if (stream_select($read,$write,$except,10)!==1 || trim(fgets(STDIN,32))!=='GO') throw new RuntimeException('TEST_BARRIER_TIMEOUT');
  return $data;
 });
 fclose($artifact['stream']);print json_encode(array('code'=>'SUCCESS'))."\n";
} catch (Throwable $e) {print json_encode(array('code'=>$e->getMessage()))."\n";}
