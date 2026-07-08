<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';

global $conf, $db, $user;

$entity = (int) $conf->entity;
$adminUser = loadUser('admin');
$user = $adminUser;
$agent = loadUser('agent.mjl');
$validator = loadUser('superviseur.n1');
$finalValidator = loadUser('dpaf.mjl');
$projectId = requireId('projet', "ref = 'PRJ-JE-2026' AND entity = ".$entity);
$conventionId = requireId('mjlfinancement_convention', "ref = 'CONV-UNICEF-2026-001' AND entity = ".$entity);
$ref = 'SMOKE-ACT-WF';

cleanupSmokeRows($ref, $entity);

$activity = new MjlActivity($db);
$activity->entity = $entity;
$activity->ref = $ref;
$activity->label = 'Smoke activity workflow';
$activity->fk_project = $projectId;
$activity->fk_convention = $conventionId;
$activity->date_start = dol_mktime(0, 0, 0, 6, 17, 2026);
$activity->date_end = dol_mktime(0, 0, 0, 6, 30, 2026);
$activity->physical_execution_percent = 40;
$activity->execution_status = 'in_progress';
$activity->status = MjlActivity::STATUS_DRAFT;
$activity->import_key = 'smoke_act_wf';

$activityId = $activity->create($agent, 1);
if ($activityId <= 0) {
	fail('Unable to create smoke activity: '.$activity->error.' '.$db->lasterror());
}
$activity->id = $activityId;
$activity->rowid = $activityId;

if ($activity->updateImportantFields($agent, array('label' => 'Smoke activity workflow updated'), 'Smoke field edit', 'AGENT', 1) <= 0) {
	fail('Unable to audit field edit: '.$activity->error);
}

if ($activity->submit($agent, 'Smoke submit', 'AGENT', 1) <= 0) {
	fail('Unable to submit smoke activity: '.$activity->error);
}

$selfValidation = $activity->prevalidate($agent, 'Self prevalidation should fail', 'AGENT_VERIFICATEUR', 1);
if ($selfValidation >= 0) {
	fail('Self-prevalidation unexpectedly succeeded.');
}

$selfCorrectionRequest = $activity->requestCorrection($agent, 'Self correction request should fail', 'SUPERVISEUR_N1', 1);
if ($selfCorrectionRequest >= 0) {
	fail('Self-correction request unexpectedly succeeded.');
}

$selfRejection = $activity->reject($agent, 'Self rejection should fail', 'SUPERVISEUR_N1', 1);
if ($selfRejection >= 0) {
	fail('Self-rejection unexpectedly succeeded.');
}

$selfReviewCount = scalar('SELECT COUNT(*) AS nb FROM '.$db->prefix()."mjlfinancement_workflow_action WHERE entity = ".$entity." AND object_type = 'mjlfinancement_activity' AND object_id = ".$activityId." AND actor = ".$agent->id." AND action IN ('validated', 'correction_requested', 'rejected')");
if ($selfReviewCount > 0) {
	fail('Self-review workflow action was unexpectedly recorded.');
}

if ($activity->prevalidate($validator, 'Smoke prevalidation', 'AGENT_VERIFICATEUR', 1) <= 0) {
	fail('Verifier could not prevalidate smoke activity: '.$activity->error);
}

$prevalidatedStatus = scalar('SELECT status AS nb FROM '.$db->prefix().'mjlfinancement_activity WHERE rowid = '.$activityId.' AND entity = '.$entity);
if ($prevalidatedStatus !== MjlActivity::STATUS_PREVALIDATED) {
	fail('Smoke activity is not prevalidated.');
}

if ($activity->finalValidate($validator, 'Verifier final validation should fail', 'AGENT_VERIFICATEUR', 1) >= 0) {
	fail('Verifier unexpectedly performed final validation.');
}

if ($activity->finalValidate($finalValidator, 'Smoke final validation', 'VALIDATEUR_DEFINITIF', 1) <= 0) {
	fail('Final validator could not validate smoke activity: '.$activity->error);
}

$workflowCount = scalar('SELECT COUNT(*) AS nb FROM '.$db->prefix()."mjlfinancement_workflow_action WHERE entity = ".$entity." AND object_type = 'mjlfinancement_activity' AND object_id = ".$activityId);
if ($workflowCount < 2) {
	fail('Expected at least 2 workflow actions, got '.$workflowCount);
}

$validatedStatus = scalar('SELECT status AS nb FROM '.$db->prefix().'mjlfinancement_activity WHERE rowid = '.$activityId.' AND entity = '.$entity);
if ($validatedStatus !== MjlActivity::STATUS_VALIDATED) {
	fail('Smoke activity is not finally validated.');
}

$fieldAuditCount = scalar('SELECT COUNT(*) AS nb FROM '.$db->prefix()."mjlfinancement_workflow_action WHERE entity = ".$entity." AND object_type = 'mjlfinancement_activity' AND object_id = ".$activityId." AND action = 'field_changed' AND changes_json LIKE '%label%'");
if ($fieldAuditCount < 1) {
	fail('Expected audited field change for smoke activity.');
}

$sampleCompleted = scalar('SELECT status AS nb FROM '.$db->prefix()."mjlfinancement_activity WHERE entity = ".$entity." AND ref = 'ACT-JE-001'");
if ($sampleCompleted !== MjlActivity::STATUS_COMPLETED) {
	fail('Sample completed activity no longer has completed status.');
}

$sampleOngoing = scalar('SELECT status AS nb FROM '.$db->prefix()."mjlfinancement_activity WHERE entity = ".$entity." AND ref = 'ACT-JE-003'");
if ($sampleOngoing !== MjlActivity::STATUS_ONGOING) {
	fail('Sample ongoing activity no longer has ongoing status.');
}

print 'MJL activity workflow smoke test completed.'.PHP_EOL;
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
