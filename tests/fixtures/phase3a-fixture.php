<?php

$sentinel=require '/opt/mjl-tests/fixtures/phase1-fixture-preflight.php';
define('NOLOGIN',1);require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';
$sentinelResult=$db->query("SELECT value FROM ".$db->prefix()."const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");$sentinelRow=$sentinelResult?$db->fetch_object($sentinelResult):null;if(!$sentinelRow||!hash_equals($sentinel,(string)$sentinelRow->value))exit(2);
$request=json_decode(stream_get_contents(STDIN),true);if(!is_array($request)||array_keys($request)!==array('entity','supervisorId','validatorId','activities')||!is_array($request['activities'])||count($request['activities'])>8)exit(3);$conf->entity=(int)$request['entity'];
$supervisor=new User($db);$validator=new User($db);if($supervisor->fetch((int)$request['supervisorId'])<=0||$validator->fetch((int)$request['validatorId'])<=0)exit(4);$result=array();
foreach($request['activities']as$item){if(!is_array($item)||array_keys($item)!==array('key','finalize','code','activity_id','version','revision_id')||isset($result[$item['key']]))exit(5);$outcome=$item;if($item['finalize']){$command=new MjlActivityCommand($db,function(){return'2026-09-04';},(int)$request['entity']);$pre=$command->reviewRevision((string)$item['activity_id'],(string)$item['revision_id'],(string)$item['version'],$supervisor,'PREVALIDATED');if(($pre['code']??'')!=='OK')exit(6);$outcome=$command->reviewRevision((string)$item['activity_id'],(string)$item['revision_id'],(string)$pre['version'],$validator,'FINAL_VALIDATED');if(($outcome['code']??'')!=='OK')exit(7);}$rows=array();$res=$db->query('SELECT rowid,status,spent_amount,observation,version FROM '.$db->prefix().'mjlfinancement_operation WHERE entity='.(int)$request['entity'].' AND fk_activity='.(int)$item['activity_id'].' AND date_removed IS NULL ORDER BY rowid');if(!$res)exit(8);while($row=$db->fetch_object($res))$rows[]=(array)$row;$outcome['operations']=$rows;$result[(string)$item['key']]=$outcome;}
print json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);

