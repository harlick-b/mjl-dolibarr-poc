<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';

global $db;

$hasFindings = false;

$expenseColumns = array(
	'prevalidated_amount',
	'final_validated_amount',
	'disbursed_amount',
	'fk_user_prevalidated',
	'fk_user_final_valid',
	'fk_user_disbursed',
	'prevalidation_date',
	'final_validation_date',
	'disbursement_date',
	'beneficiary_name',
);
foreach ($expenseColumns as $column) {
	if (!columnExists('mjlfinancement_expense', $column)) {
		finding('missing_expense_column', $column);
	}
}
if (!columnExists('mjlfinancement_validation', 'actor_role')) {
	finding('missing_validation_column', 'actor_role');
}
if (columnExists('mjlfinancement_fund_receipt', 'fk_project') && !columnNullable('mjlfinancement_fund_receipt', 'fk_project')) {
	finding('fund_receipt_fk_project_not_nullable', 'Run update_0.11.0.sql before using global funding envelopes.');
}

if (columnExists('mjlfinancement_expense', 'status')) {
	reportRows(
		'expense_invalid_phase5_status',
		'SELECT rowid, ref, entity, status FROM '.$db->prefix().'mjlfinancement_expense WHERE status NOT IN (0, 1, 2, 3, 4, 6, 7, 8)'
	);
}

if (columnExists('mjlfinancement_expense', 'final_validated_amount')) {
	reportRows(
		'final_validated_expense_missing_amount_or_actor',
		'SELECT rowid, ref, entity, status, final_validated_amount, fk_user_final_valid, final_validation_date FROM '.$db->prefix().'mjlfinancement_expense WHERE status IN (6, 7) AND (final_validated_amount IS NULL OR final_validated_amount <= 0 OR fk_user_final_valid IS NULL OR final_validation_date IS NULL)'
	);
	reportRows(
		'legacy_validated_expense_not_backfilled',
		'SELECT rowid, ref, entity, status, final_validated_amount, fk_user_final_valid, final_validation_date FROM '.$db->prefix().'mjlfinancement_expense WHERE status = 2 AND (final_validated_amount IS NULL OR fk_user_final_valid IS NULL OR final_validation_date IS NULL)'
	);
}

if (columnExists('mjlfinancement_expense', 'disbursed_amount')) {
	reportRows(
		'disbursed_expense_missing_payment_metadata',
		'SELECT rowid, ref, entity, disbursed_amount, final_validated_amount, fk_user_disbursed, disbursement_date, beneficiary_name FROM '.$db->prefix().'mjlfinancement_expense WHERE status = 7 AND (disbursed_amount IS NULL OR final_validated_amount IS NULL OR ABS(disbursed_amount - final_validated_amount) > 0.001 OR fk_user_disbursed IS NULL OR disbursement_date IS NULL OR beneficiary_name IS NULL OR beneficiary_name = \'\')'
	);
}

if (columnExists('mjlfinancement_validation', 'actor_role')) {
	reportRows(
		'expense_workflow_event_missing_actor_role',
		'SELECT rowid, ref, entity, action FROM '.$db->prefix().'mjlfinancement_validation WHERE action IN (\'prevalidated\', \'final_validated\', \'disbursed\') AND (actor_role IS NULL OR actor_role = \'\')'
	);
}

if (!$hasFindings) {
	out('MJL 0.10.0 expense disbursement schema audit: OK');
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

function columnNullable($table, $column)
{
	global $db;

	$sql = 'SELECT IS_NULLABLE AS nullable_flag FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND COLUMN_NAME = '".$db->escape($column)."'";
	$resql = $db->query($sql);
	if (!$resql) fail('Unable to inspect column nullability: '.$db->lasterror());
	$obj = $db->fetch_object($resql);
	return $obj && strtoupper((string) $obj->nullable_flag) === 'YES';
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
		if ($count === 0) finding($name, '');
		$count++;
		out('  '.formatObject($obj));
	}
}

function scalar($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) fail('Unable to fetch scalar: '.$db->lasterror().' SQL='.$sql);
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
