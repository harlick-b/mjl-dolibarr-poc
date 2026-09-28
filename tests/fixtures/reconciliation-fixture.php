<?php

$sentinel = require '/opt/mjl-tests/fixtures/disposable-fixture-preflight.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexecutionreconciler.class.php';

$res = $db->query("SELECT value FROM ".$db->prefix()."const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");
$row = $res ? $db->fetch_object($res) : null;
if (!$row || !hash_equals($sentinel, (string) $row->value)) exit(2);

$action = $argv[1] ?? '';
$entity = isset($argv[2]) ? (int) $argv[2] : 1;
if ($entity < 1) exit(3);
$conf->entity = $entity;
if ($action === 'reconcile') {
	$adapter = new MjlExecutionReconciler($db);
	$result = $adapter->run();
	print json_encode(array('result' => $result, 'output' => $adapter->output, 'error' => $adapter->error), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).PHP_EOL;
	exit($result === 0 ? 0 : 1);
}
if ($action === 'reconcile-at') {
	try { $date = mjl_execution_porto_novo_date($argv[3] ?? ''); }
	catch (Throwable $exception) { exit(3); }
	$activity = isset($argv[4]) ? (int) $argv[4] : 0;
	$command = new MjlActivityCommand($db, function () use ($date) { return $date; }, $entity);
	$result = $command->reconcileExecutionStatus((string) $activity, null);
	print json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).PHP_EOL;
	exit(($result['code'] ?? '') === 'OK' ? 0 : 1);
}
if ($action === 'scheduled-count') {
	$activity = isset($argv[3]) ? (int) $argv[3] : 0;
	$sql = "SELECT COUNT(*) FROM ".$db->prefix()."mjlfinancement_audit_event WHERE entity=".$entity." AND action='ACTIVITY_EXECUTION_STATUS_CHANGED' AND JSON_UNQUOTE(JSON_EXTRACT(context_json,'$.source'))='SCHEDULED'".($activity > 0 ? ' AND activity_id='.$activity : '');
	print (int) mjl_rst005_scalar($db, $sql).PHP_EOL;
	exit;
}
exit(3);
