<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';

global $db;

$hasFindings = false;

$requiredColumns = array(
	'mjlfinancement_workflow_action' => array('rowid', 'entity', 'ref', 'object_type', 'object_id', 'action', 'from_status', 'to_status', 'actor', 'actor_role', 'action_date', 'reason', 'comment', 'changes_json', 'date_creation', 'fk_user_creat'),
	'mjlfinancement_exchange_log' => array('rowid', 'entity', 'ref', 'object_type', 'object_id', 'exchange_date', 'actor', 'actor_role', 'channel', 'subject', 'message', 'date_creation', 'fk_user_creat'),
);

foreach ($requiredColumns as $table => $columns) {
	if (!tableExists($table)) {
		finding('missing_table', $table);
		continue;
	}
	foreach ($columns as $column) {
		if (!columnExists($table, $column)) {
			finding('missing_column', $table.'.'.$column);
		}
	}
}

foreach (array(
	array('mjlfinancement_workflow_action', 'uk_mjlfinancement_workflow_action_ref_entity'),
	array('mjlfinancement_workflow_action', 'idx_mjlfinancement_workflow_action_entity'),
	array('mjlfinancement_workflow_action', 'idx_mjlfinancement_workflow_action_object'),
	array('mjlfinancement_workflow_action', 'idx_mjlfinancement_workflow_action_actor'),
	array('mjlfinancement_workflow_action', 'idx_mjlfinancement_workflow_action_action_date'),
	array('mjlfinancement_exchange_log', 'uk_mjlfinancement_exchange_log_ref_entity'),
	array('mjlfinancement_exchange_log', 'idx_mjlfinancement_exchange_log_entity'),
	array('mjlfinancement_exchange_log', 'idx_mjlfinancement_exchange_log_object'),
	array('mjlfinancement_exchange_log', 'idx_mjlfinancement_exchange_log_actor'),
	array('mjlfinancement_exchange_log', 'idx_mjlfinancement_exchange_log_exchange_date'),
) as $index) {
	if (tableExists($index[0]) && !indexExists($index[0], $index[1])) {
		finding('missing_index', $index[0].'.'.$index[1]);
	}
}

foreach (array(
	array('mjlfinancement_workflow_action', 'fk_mjlfinancement_workflow_action_actor'),
	array('mjlfinancement_exchange_log', 'fk_mjlfinancement_exchange_log_actor'),
) as $constraint) {
	if (tableExists($constraint[0]) && !constraintExists($constraint[0], $constraint[1])) {
		finding('missing_constraint', $constraint[0].'.'.$constraint[1]);
	}
}

foreach (array_keys($requiredColumns) as $table) {
	if (tableExists($table) && columnExists($table, 'ref') && columnExists($table, 'entity')) {
		reportRows('duplicate_ref_entity_'.$table, 'SELECT ref, entity, COUNT(*) AS nb FROM '.$db->prefix().$table.' GROUP BY ref, entity HAVING COUNT(*) > 1');
	}
}

foreach (array(
	array('workflow_action_broken_actor', 'mjlfinancement_workflow_action', 'actor', 'user'),
	array('exchange_log_broken_actor', 'mjlfinancement_exchange_log', 'actor', 'user'),
) as $fk) {
	reportBrokenForeignKeys($fk[0], $fk[1], $fk[2], $fk[3]);
}

if (hasColumns('mjlfinancement_workflow_action', array('rowid', 'ref', 'entity', 'changes_json'))) {
	reportRows(
		'workflow_action_missing_changes_json',
		'SELECT rowid, ref, entity FROM '.$db->prefix().'mjlfinancement_workflow_action WHERE changes_json IS NULL OR changes_json = \'\''
	);
}

if (!$hasFindings) {
	out('MJL 0.4.0 workflow foundation audit: OK');
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

function hasColumns($table, $columns)
{
	if (!tableExists($table)) {
		return false;
	}
	foreach ($columns as $column) {
		if (!columnExists($table, $column)) {
			return false;
		}
	}
	return true;
}

function indexExists($table, $index)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND INDEX_NAME = '".$db->escape($index)."'";
	return scalar($sql) > 0;
}

function constraintExists($table, $constraint)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND CONSTRAINT_NAME = '".$db->escape($constraint)."'";
	return scalar($sql) > 0;
}

function reportBrokenForeignKeys($name, $table, $column, $targetTable)
{
	global $db;

	if (!tableExists($table) || !tableExists($targetTable) || !columnExists($table, $column)) {
		return;
	}

	$sql = 'SELECT s.rowid, s.ref, s.'.$column.' AS broken_id FROM '.$db->prefix().$table.' s';
	$sql .= ' LEFT JOIN '.$db->prefix().$targetTable.' t ON t.rowid = s.'.$column;
	$sql .= ' WHERE s.'.$column.' IS NOT NULL AND t.rowid IS NULL';
	reportRows($name, $sql);
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
