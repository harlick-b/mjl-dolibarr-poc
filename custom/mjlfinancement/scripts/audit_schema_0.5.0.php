<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';

global $db;

$hasFindings = false;

if (tableExists('mjlfinancement_activity') && columnExists('mjlfinancement_activity', 'status')) {
	reportRows(
		'activity_invalid_status',
		'SELECT rowid, ref, entity, status FROM '.$db->prefix().'mjlfinancement_activity WHERE status NOT IN (0, 1, 2, 3, 4, 5, 6, 8, 9)'
	);
	reportRows(
		'activity_submitted_status_not_migrated',
		'SELECT a.rowid, a.ref, a.entity, a.status FROM '.$db->prefix().'mjlfinancement_activity a WHERE a.status = 1 AND (SELECT w.to_status FROM '.$db->prefix().'mjlfinancement_workflow_action w WHERE w.entity = a.entity AND w.object_type = \'mjlfinancement_activity\' AND w.object_id = a.rowid ORDER BY w.action_date DESC, w.rowid DESC LIMIT 1) = \'submitted\''
	);
	reportRows(
		'activity_validated_status_not_migrated',
		'SELECT a.rowid, a.ref, a.entity, a.status FROM '.$db->prefix().'mjlfinancement_activity a WHERE a.status = 2 AND (SELECT w.to_status FROM '.$db->prefix().'mjlfinancement_workflow_action w WHERE w.entity = a.entity AND w.object_type = \'mjlfinancement_activity\' AND w.object_id = a.rowid ORDER BY w.action_date DESC, w.rowid DESC LIMIT 1) = \'validated\''
	);
	reportRows(
		'activity_status_1_with_ambiguous_workflow',
		'SELECT a.rowid, a.ref, a.entity, a.status, latest.to_status AS latest_workflow_status FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN (SELECT w1.entity, w1.object_id, w1.to_status FROM '.$db->prefix().'mjlfinancement_workflow_action w1 INNER JOIN (SELECT entity, object_id, MAX(CONCAT(LPAD(UNIX_TIMESTAMP(action_date), 20, \'0\'), LPAD(rowid, 20, \'0\'))) AS latest_key FROM '.$db->prefix().'mjlfinancement_workflow_action WHERE object_type = \'mjlfinancement_activity\' GROUP BY entity, object_id) wm ON wm.entity = w1.entity AND wm.object_id = w1.object_id AND wm.latest_key = CONCAT(LPAD(UNIX_TIMESTAMP(w1.action_date), 20, \'0\'), LPAD(w1.rowid, 20, \'0\')) WHERE w1.object_type = \'mjlfinancement_activity\') latest ON latest.entity = a.entity AND latest.object_id = a.rowid WHERE a.status = 1 AND latest.to_status <> \'submitted\''
	);
	reportRows(
		'activity_status_2_with_ambiguous_workflow',
		'SELECT a.rowid, a.ref, a.entity, a.status, latest.to_status AS latest_workflow_status FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN (SELECT w1.entity, w1.object_id, w1.to_status FROM '.$db->prefix().'mjlfinancement_workflow_action w1 INNER JOIN (SELECT entity, object_id, MAX(CONCAT(LPAD(UNIX_TIMESTAMP(action_date), 20, \'0\'), LPAD(rowid, 20, \'0\'))) AS latest_key FROM '.$db->prefix().'mjlfinancement_workflow_action WHERE object_type = \'mjlfinancement_activity\' GROUP BY entity, object_id) wm ON wm.entity = w1.entity AND wm.object_id = w1.object_id AND wm.latest_key = CONCAT(LPAD(UNIX_TIMESTAMP(w1.action_date), 20, \'0\'), LPAD(w1.rowid, 20, \'0\')) WHERE w1.object_type = \'mjlfinancement_activity\') latest ON latest.entity = a.entity AND latest.object_id = a.rowid WHERE a.status = 2 AND latest.to_status <> \'validated\''
	);
}

if (tableExists('mjlfinancement_workflow_action') && tableExists('mjlfinancement_activity')) {
	reportRows(
		'workflow_action_activity_cross_entity_or_missing_object',
		'SELECT w.rowid, w.ref, w.entity, w.object_id FROM '.$db->prefix().'mjlfinancement_workflow_action w LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND a.entity = w.entity WHERE w.object_type = \'mjlfinancement_activity\' AND a.rowid IS NULL'
	);
}

if (tableExists('mjlfinancement_exchange_log') && tableExists('mjlfinancement_activity')) {
	reportRows(
		'exchange_log_activity_cross_entity_or_missing_object',
		'SELECT x.rowid, x.ref, x.entity, x.object_id FROM '.$db->prefix().'mjlfinancement_exchange_log x LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = x.object_id AND a.entity = x.entity WHERE x.object_type = \'mjlfinancement_activity\' AND a.rowid IS NULL'
	);
}

if (!$hasFindings) {
	out('MJL 0.5.0 activity status audit: OK');
}

exit($hasFindings ? 1 : 0);

function tableExists($table)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	return scalar($sql) > 0;
}

function columnExists($table, $column)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND COLUMN_NAME = '".$db->escape($column)."'";
	return scalar($sql) > 0;
}

function reportRows($name, $sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to run '.$name.': '.$db->lasterror());
	}

	$count = 0;
	while ($obj = $db->fetch_object($resql)) {
		if ($count === 0) {
			finding($name, '');
		}
		$count++;
		out('  '.formatObject($obj));
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

function finding($name, $detail)
{
	global $hasFindings;

	$hasFindings = true;
	out($detail === '' ? $name.':' : $name.': '.$detail);
}

function formatObject($obj)
{
	$parts = array();
	foreach ($obj as $key => $value) {
		$parts[] = $key.'='.($value === null ? 'NULL' : $value);
	}
	return implode(' ', $parts);
}

function out($message)
{
	print $message.PHP_EOL;
}

function fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(2);
}
