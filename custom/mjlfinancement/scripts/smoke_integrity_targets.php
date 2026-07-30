<?php

define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';

global $db, $conf;

$entity = (int) $conf->entity;
$marker = 'P3V2-INTEGRITY-'.bin2hex(random_bytes(4));
$db->begin();

$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_report (entity, ref, name, scope, expected_format, filters, must_include, date_creation, fk_user_creat, import_key)';
$sql .= " VALUES (".$entity.", '".$db->escape($marker)."', 'Phase 3 integrity smoke', 'Audit', 'CSV/XLSX', '', '', NOW(), 1, 'P3V2INT')";
assertQuery($sql, 'create report fixture');
$reportId = (int) $db->last_insert_id($db->prefix().'mjlfinancement_report');

assertQuery(workflowInsertSql($marker.'-VALID', $entity, $reportId), 'create valid audit anchor');
assertQuery(workflowInsertSql($marker.'-MISSING', $entity, $reportId + 1000000), 'create missing audit anchor');

$base = ' FROM '.$db->prefix().'mjlfinancement_workflow_action w WHERE w.ref LIKE \''.$db->escape($marker)."%'";
$valid = scalar('SELECT COUNT(*) AS nb'.$base.' AND w.ref = \''.$db->escape($marker.'-VALID').'\' AND '.mjl_integrity_unresolved_target_sql('w'));
$missing = scalar('SELECT COUNT(*) AS nb'.$base.' AND w.ref = \''.$db->escape($marker.'-MISSING').'\' AND '.mjl_integrity_unresolved_target_sql('w'));
$registry = mjl_integrity_supported_target_registry();

$db->rollback();

if ($valid !== 0 || $missing !== 1 || ($registry['mjlfinancement_report'] ?? '') !== 'mjlfinancement_report') {
	fwrite(STDERR, 'Integrity target smoke failed: valid='.$valid.' missing='.$missing.PHP_EOL);
	exit(1);
}

print 'MJL integrity target smoke: OK'.PHP_EOL;

function workflowInsertSql($ref, $entity, $objectId)
{
	global $db;
	return 'INSERT INTO '.$db->prefix().'mjlfinancement_workflow_action (entity, ref, object_type, object_id, action, actor, actor_role, action_date, changes_json, date_creation, fk_user_creat)'
		." VALUES (".((int) $entity).", '".$db->escape($ref)."', 'mjlfinancement_report', ".((int) $objectId).", 'export_generated', 1, 'ADMIN_PLATEFORME', NOW(), '{}', NOW(), 1)";
}

function assertQuery($sql, $label)
{
	global $db;
	if (!$db->query($sql)) {
		$db->rollback();
		fwrite(STDERR, 'Unable to '.$label.': '.$db->lasterror().PHP_EOL);
		exit(2);
	}
}

function scalar($sql)
{
	global $db;
	$resql = $db->query($sql);
	if (!$resql || !($row = $db->fetch_object($resql))) {
		$db->rollback();
		fwrite(STDERR, 'Unable to query integrity fixture: '.$db->lasterror().PHP_EOL);
		exit(2);
	}
	return (int) $row->nb;
}
