<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';

global $db;

$hasFindings = false;

$requiredColumns = array(
	'fk_user_responsible',
	'date_actual_start',
	'date_actual_end',
	'physical_execution_percent',
	'execution_status',
	'execution_comment',
);
foreach ($requiredColumns as $column) {
	if (!columnExists('mjlfinancement_activity', $column)) {
		finding('missing_column', 'mjlfinancement_activity.'.$column);
	}
}

if (!indexExists('mjlfinancement_activity', 'idx_mjlfinancement_activity_fk_user_responsible')) {
	finding('missing_index', 'mjlfinancement_activity.idx_mjlfinancement_activity_fk_user_responsible');
}

reportRows(
	'activity_invalid_physical_execution_percent',
	'SELECT rowid, entity, ref, physical_execution_percent FROM '.$db->prefix().'mjlfinancement_activity WHERE physical_execution_percent IS NOT NULL AND (physical_execution_percent < 0 OR physical_execution_percent > 100)'
);

reportRows(
	'activity_invalid_execution_status',
	'SELECT rowid, entity, ref, execution_status FROM '.$db->prefix()."mjlfinancement_activity WHERE execution_status IS NOT NULL AND execution_status NOT IN ('not_started', 'in_progress', 'completed', 'blocked')"
);

reportRows(
	'activity_orphan_responsible_user',
	'SELECT a.rowid, a.entity, a.ref, a.fk_user_responsible FROM '.$db->prefix().'mjlfinancement_activity a LEFT JOIN '.$db->prefix().'user u ON u.rowid = a.fk_user_responsible WHERE a.fk_user_responsible IS NOT NULL AND u.rowid IS NULL'
);

reportRows(
	'activity_unknown_status',
	'SELECT rowid, entity, ref, status FROM '.$db->prefix().'mjlfinancement_activity WHERE status NOT IN (0,1,2,3,4,5,6,7,8,9)'
);

if (!$hasFindings) {
	out('MJL 0.9.0 activity workflow schema audit: OK');
}

exit($hasFindings ? 1 : 0);

function columnExists($table, $column)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND COLUMN_NAME = '".$db->escape($column)."'";
	return scalar($sql) > 0;
}

function indexExists($table, $index)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND INDEX_NAME = '".$db->escape($index)."'";
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
