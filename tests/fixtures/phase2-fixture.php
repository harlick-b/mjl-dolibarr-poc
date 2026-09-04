<?php

$sentinel = require '/opt/mjl-tests/fixtures/phase1-fixture-preflight.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivityassignment.class.php';

$sentinelResult=$db->query("SELECT value FROM ".$db->prefix()."const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");
$sentinelRow=$sentinelResult?$db->fetch_object($sentinelResult):null;
if(!$sentinelRow||!hash_equals($sentinel,(string)$sentinelRow->value)) exit(2);
$request = json_decode(stream_get_contents(STDIN), true);
if (!is_array($request) || array_keys($request) !== array('entity','activities') || !is_array($request['activities']) || count($request['activities']) > 12) exit(3);
$conf->entity = (int) $request['entity'];
$result = array();
foreach ($request['activities'] as $item) {
	if (!is_array($item) || empty($item['key']) || isset($result[$item['key']]) || empty($item['actorId'])) exit(4);
	$actor = new User($db); if ($actor->fetch((int) $item['actorId']) <= 0) exit(5);
	$operations = array();
	foreach ((array) ($item['operations'] ?? array()) as $index => $operation) $operations[] = array('client_key'=>'op-'.$index,'name'=>$operation['name'] ?? '','type_id'=>(string) ($operation['typeId'] ?? ''),'authorized_amount'=>(string) ($operation['authorizedAmount'] ?? ''));
	$structure = array('partner_id'=>(string)($item['partnerId'] ?? ''),'project_id'=>(string)($item['projectId'] ?? ''),'name'=>$item['name'] ?? '','description'=>$item['description'] ?? '','date_start'=>$item['dateStart'] ?? '','date_end'=>$item['dateEnd'] ?? '','authorized_amount'=>(string)($item['authorizedAmount'] ?? ''),'operations'=>$operations);
	$command = new MjlActivityCommand($db, function () { return '2026-09-04'; }, (int) $request['entity']);
	$outcome = !empty($item['submit']) ? $command->createAndSubmit($structure, $actor) : $command->createDraft($structure, $actor);
	if (($outcome['code'] ?? '') !== 'OK') exit(6);
	$additionalAgentIds=(array)($item['additionalAgentIds']??array());
	if($additionalAgentIds){$assignmentActor=new User($db);if(empty($item['assignmentActorId'])||$assignmentActor->fetch((int)$item['assignmentActorId'])<=0)exit(7);$assignment=new MjlActivityAssignment($db);foreach($additionalAgentIds as$agentId){$changed=$assignment->changeAssignment((int)$outcome['activity_id'],(int)$outcome['version'],$assignmentActor,MjlActivityAssignment::ADD_ADDITIONAL,(int)$agentId,'Fixture Phase 2');if(($changed['code']??'')!=='OK')exit(8);$outcome['version']=(int)$changed['version'];}}
	$result[(string) $item['key']] = $outcome;
}
print json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
