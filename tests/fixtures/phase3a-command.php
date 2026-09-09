<?php

$sentinel=require '/opt/mjl-tests/fixtures/phase1-fixture-preflight.php';
define('NOLOGIN',1);require '/var/www/html/main.inc.php';require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';
$sentinelResult=$db->query("SELECT value FROM ".$db->prefix()."const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");$sentinelRow=$sentinelResult?$db->fetch_object($sentinelResult):null;if(!$sentinelRow||!hash_equals($sentinel,(string)$sentinelRow->value))exit(2);
$request=json_decode(stream_get_contents(STDIN),true);if(!is_array($request)||count($request)>10||empty($request['action'])||empty($request['entity']))exit(3);$conf->entity=(int)$request['entity'];$command=new MjlActivityCommand($db,function()use($request){return isset($request['localDate'])?(string)$request['localDate']:'2026-09-04';},(int)$request['entity']);$actor=null;if(!empty($request['actorId'])){$actor=new User($db);if($actor->fetch((int)$request['actorId'])<=0)exit(4);}
switch($request['action']){
case'update':$out=$command->updateOperationExecution((string)($request['activityId']??''),(string)($request['operationId']??''),(string)($request['expectedVersion']??''),(array)($request['input']??array()),$actor);break;
case'request-cancel':$out=$command->requestCancellation((string)($request['targetType']??''),(string)($request['targetId']??''),(string)($request['expectedVersion']??''),(string)($request['reason']??''),$actor);break;
case'withdraw-cancel':$out=$command->withdrawCancellation((string)($request['requestId']??''),(string)($request['expectedVersion']??''),$actor);break;
case'decide-cancel':$out=$command->decideCancellation((string)($request['requestId']??''),(string)($request['expectedVersion']??''),(string)($request['decision']??''),(string)($request['reason']??''),$actor);break;
case'request-reopen':$out=$command->requestReopening((string)($request['operationId']??''),(string)($request['expectedVersion']??''),(string)($request['reason']??''),$actor);break;
case'withdraw-reopen':$out=$command->withdrawReopening((string)($request['requestId']??''),(string)($request['expectedVersion']??''),$actor);break;
case'decide-reopen':$out=$command->decideReopening((string)($request['requestId']??''),(string)($request['expectedVersion']??''),(string)($request['decision']??''),(string)($request['reason']??''),$actor);break;
case'reconcile':$out=$command->reconcileExecutionStatus((string)($request['activityId']??''),null);break;
default:exit(5);
}
print json_encode($out,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);

