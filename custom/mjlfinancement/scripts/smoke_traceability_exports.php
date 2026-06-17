<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexchangelog.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_csv_export.lib.php';

global $conf, $db, $user;

$entity = (int) $conf->entity;
$adminUser = loadUser('admin');
$user = $adminUser;
$agent = loadUser('agent.mjl');
$projectId = requireId('projet', "ref = 'PRJ-JE-2026' AND entity = ".$entity);
$conventionId = requireId('mjlfinancement_convention', "ref = 'CONV-UNICEF-2026-001' AND entity = ".$entity);
$ref = 'SMOKE-TRACE';

cleanupSmokeRows($ref, $entity);

$activity = new MjlActivity($db);
$activity->entity = $entity;
$activity->ref = $ref;
$activity->label = 'Smoke traceability activity';
$activity->fk_project = $projectId;
$activity->fk_convention = $conventionId;
$activity->date_start = dol_mktime(0, 0, 0, 6, 17, 2026);
$activity->date_end = dol_mktime(0, 0, 0, 6, 24, 2026);
$activity->status = MjlActivity::STATUS_DRAFT;
$activity->import_key = 'smoke_trace';
$activityId = $activity->create($agent, 1);
if ($activityId <= 0) {
	fail('Unable to create traceability activity: '.$activity->error.' '.$db->lasterror());
}

$exchange = new MjlExchangeLog($db);
$exchange->entity = $entity;
$exchange->ref = 'EXC-'.$ref;
$exchange->object_type = 'mjlfinancement_activity';
$exchange->object_id = $activityId;
$exchange->exchange_date = dol_now();
$exchange->actor = $agent->id;
$exchange->actor_role = 'AGENT';
$exchange->channel = 'email';
$exchange->subject = 'Smoke exchange';
$exchange->message = 'Smoke exchange message';
$exchange->fk_user_creat = $agent->id;
if ($exchange->create($agent, 1) <= 0) {
	fail('Unable to create exchange log: '.$exchange->error.' '.$db->lasterror());
}

$exchangeCount = scalar('SELECT COUNT(*) AS nb FROM '.$db->prefix()."mjlfinancement_exchange_log WHERE entity = ".$entity." AND object_type = 'mjlfinancement_activity' AND object_id = ".$activityId);
if ($exchangeCount !== 1) {
	fail('Expected 1 exchange log, got '.$exchangeCount);
}

$dashboardCount = scalar('SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity WHERE entity = '.$entity.' AND date_end IS NOT NULL');
if ($dashboardCount < 1) {
	fail('DPAF dashboard activity query returned no rows.');
}

ob_start();
mjl_csv_export_output('smoke.csv', array('partner' => 'Partenaire', 'activity_ref' => 'Référence activité', 'deadline_alert' => 'Alerte échéance'), array(array('partner' => 'A', 'activity_ref' => 'B', 'deadline_alert' => 'En retard')));
$csv = ob_get_clean();
if (substr($csv, 0, 3) !== "\xEF\xBB\xBF" || strpos($csv, ';') === false || strpos($csv, 'Partenaire') === false || strpos($csv, 'Référence activité') === false || strpos($csv, 'Alerte échéance') === false) {
	fail('CSV export helper did not produce UTF-8 BOM semicolon CSV.');
}

print 'MJL traceability/export smoke test completed.'.PHP_EOL;
exit(0);

function loadUser($login)
{
	global $db;

	$user = new User($db);
	if ($user->fetch(0, $login) <= 0) {
		fail('Unable to load user '.$login.'. Run bootstrap_poc.php first.');
	}
	if (method_exists($user, 'loadRights')) {
		$user->loadRights();
	}
	return $user;
}

function requireId($table, $where)
{
	global $db;

	$sql = 'SELECT rowid FROM '.$db->prefix().$table.' WHERE '.$where;
	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to query '.$table.': '.$db->lasterror());
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		fail('Missing required '.$table.' row for '.$where.'. Run seed_sample_data.php first.');
	}
	return (int) $obj->rowid;
}

function cleanupSmokeRows($ref, $entity)
{
	global $db;

	$activityId = scalar('SELECT rowid AS nb FROM '.$db->prefix()."mjlfinancement_activity WHERE entity = ".((int) $entity)." AND ref = '".$db->escape($ref)."'");
	if ($activityId > 0) {
		query('DELETE FROM '.$db->prefix()."mjlfinancement_exchange_log WHERE entity = ".((int) $entity)." AND object_type = 'mjlfinancement_activity' AND object_id = ".$activityId);
		query('DELETE FROM '.$db->prefix()."mjlfinancement_workflow_action WHERE entity = ".((int) $entity)." AND object_type = 'mjlfinancement_activity' AND object_id = ".$activityId);
		query('DELETE FROM '.$db->prefix().'mjlfinancement_activity WHERE entity = '.((int) $entity).' AND rowid = '.$activityId);
	}
}

function scalar($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch scalar: '.$db->lasterror().' SQL='.$sql);
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (int) $obj->nb : 0;
}

function query($sql)
{
	global $db;

	if (!$db->query($sql)) {
		fail('Query failed: '.$db->lasterror().' SQL='.$sql);
	}
}

function fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(1);
}
