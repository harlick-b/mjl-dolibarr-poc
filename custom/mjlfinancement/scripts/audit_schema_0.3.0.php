<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';

global $db;

$hasFindings = false;

$requiredColumns = array(
	'mjlfinancement_convention' => array('rowid', 'entity', 'ref', 'title', 'fk_soc', 'fk_project', 'date_start', 'date_end', 'total_amount', 'currency_code', 'date_creation', 'fk_user_creat', 'status'),
	'mjlfinancement_activity' => array('rowid', 'entity', 'ref', 'label', 'fk_project', 'fk_convention', 'fk_task', 'date_creation', 'fk_user_creat', 'status'),
	'mjlfinancement_budget_line' => array('rowid', 'entity', 'ref', 'label', 'fk_project', 'fk_convention', 'fk_mjl_activity', 'fk_activity', 'initial_budget', 'revised_budget', 'committed_amount', 'spent_amount', 'remaining_amount', 'category', 'date_creation', 'fk_user_creat', 'status'),
	'mjlfinancement_fund_receipt' => array('rowid', 'entity', 'ref', 'fk_soc', 'fk_project', 'fk_convention', 'amount', 'reception_date', 'supporting_document', 'comment', 'date_creation', 'fk_user_creat', 'status'),
	'mjlfinancement_expense' => array('rowid', 'entity', 'ref', 'fk_project', 'fk_convention', 'fk_mjl_activity', 'fk_budget_line', 'amount', 'expense_date', 'description', 'supporting_document', 'fk_user_valid', 'validation_date', 'correction_reason', 'submitted_at', 'date_creation', 'fk_user_creat', 'status'),
	'mjlfinancement_validation' => array('rowid', 'entity', 'ref', 'fk_expense', 'action', 'from_status', 'to_status', 'fk_user_action', 'action_date', 'comment', 'date_creation', 'fk_user_creat'),
	'mjlfinancement_report' => array('rowid', 'entity', 'ref', 'name', 'scope', 'expected_format', 'filters', 'must_include', 'date_creation', 'fk_user_creat'),
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
	array('mjlfinancement_convention', 'uk_mjlfinancement_convention_ref_entity'),
	array('mjlfinancement_activity', 'uk_mjlfinancement_activity_ref_entity'),
	array('mjlfinancement_budget_line', 'uk_mjlfinancement_budget_line_ref_entity'),
	array('mjlfinancement_fund_receipt', 'uk_mjlfinancement_fund_receipt_ref_entity'),
	array('mjlfinancement_expense', 'uk_mjlfinancement_expense_ref_entity'),
	array('mjlfinancement_validation', 'uk_mjlfinancement_validation_ref_entity'),
	array('mjlfinancement_report', 'uk_mjlfinancement_report_ref_entity'),
	array('mjlfinancement_convention', 'idx_mjlfinancement_convention_entity'),
	array('mjlfinancement_convention', 'idx_mjlfinancement_convention_fk_soc'),
	array('mjlfinancement_convention', 'idx_mjlfinancement_convention_fk_project'),
	array('mjlfinancement_activity', 'idx_mjlfinancement_activity_entity'),
	array('mjlfinancement_activity', 'idx_mjlfinancement_activity_fk_project'),
	array('mjlfinancement_activity', 'idx_mjlfinancement_activity_fk_convention'),
	array('mjlfinancement_activity', 'idx_mjlfinancement_activity_fk_task'),
	array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_entity'),
	array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_fk_project'),
	array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_fk_convention'),
	array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_fk_mjl_activity'),
	array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_fk_activity'),
	array('mjlfinancement_fund_receipt', 'idx_mjlfinancement_fund_receipt_entity'),
	array('mjlfinancement_fund_receipt', 'idx_mjlfinancement_fund_receipt_fk_soc'),
	array('mjlfinancement_fund_receipt', 'idx_mjlfinancement_fund_receipt_fk_project'),
	array('mjlfinancement_fund_receipt', 'idx_mjlfinancement_fund_receipt_fk_convention'),
	array('mjlfinancement_expense', 'idx_mjlfinancement_expense_entity'),
	array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_project'),
	array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_convention'),
	array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_mjl_activity'),
	array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_budget_line'),
	array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_user_valid'),
	array('mjlfinancement_validation', 'idx_mjlfinancement_validation_entity'),
	array('mjlfinancement_validation', 'idx_mjlfinancement_validation_fk_expense'),
	array('mjlfinancement_validation', 'idx_mjlfinancement_validation_fk_user_action'),
	array('mjlfinancement_report', 'idx_mjlfinancement_report_entity'),
) as $index) {
	if (tableExists($index[0]) && !indexExists($index[0], $index[1])) {
		finding('missing_index', $index[0].'.'.$index[1]);
	}
}

foreach (array(
	array('mjlfinancement_convention', 'fk_mjlfinancement_convention_soc'),
	array('mjlfinancement_convention', 'fk_mjlfinancement_convention_project'),
	array('mjlfinancement_activity', 'fk_mjlfinancement_activity_project'),
	array('mjlfinancement_activity', 'fk_mjlfinancement_activity_convention'),
	array('mjlfinancement_activity', 'fk_mjlfinancement_activity_task'),
	array('mjlfinancement_budget_line', 'fk_mjlfinancement_budget_line_project'),
	array('mjlfinancement_budget_line', 'fk_mjlfinancement_budget_line_convention'),
	array('mjlfinancement_budget_line', 'fk_mjlfinancement_budget_line_mjl_activity'),
	array('mjlfinancement_budget_line', 'fk_mjlfinancement_budget_line_activity'),
	array('mjlfinancement_expense', 'fk_mjlfinancement_expense_project'),
	array('mjlfinancement_expense', 'fk_mjlfinancement_expense_convention'),
	array('mjlfinancement_expense', 'fk_mjlfinancement_expense_mjl_activity'),
	array('mjlfinancement_expense', 'fk_mjlfinancement_expense_budget_line'),
	array('mjlfinancement_expense', 'fk_mjlfinancement_expense_user_valid'),
	array('mjlfinancement_fund_receipt', 'fk_mjlfinancement_fund_receipt_soc'),
	array('mjlfinancement_fund_receipt', 'fk_mjlfinancement_fund_receipt_project'),
	array('mjlfinancement_fund_receipt', 'fk_mjlfinancement_fund_receipt_convention'),
	array('mjlfinancement_validation', 'fk_mjlfinancement_validation_expense'),
	array('mjlfinancement_validation', 'fk_mjlfinancement_validation_user_action'),
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
	array('convention_broken_fk_soc', 'mjlfinancement_convention', 'fk_soc', 'societe'),
	array('convention_broken_fk_project', 'mjlfinancement_convention', 'fk_project', 'projet'),
	array('activity_broken_fk_project', 'mjlfinancement_activity', 'fk_project', 'projet'),
	array('activity_broken_fk_convention', 'mjlfinancement_activity', 'fk_convention', 'mjlfinancement_convention'),
	array('budget_line_broken_fk_convention', 'mjlfinancement_budget_line', 'fk_convention', 'mjlfinancement_convention'),
	array('budget_line_broken_fk_mjl_activity', 'mjlfinancement_budget_line', 'fk_mjl_activity', 'mjlfinancement_activity'),
	array('expense_broken_fk_project', 'mjlfinancement_expense', 'fk_project', 'projet'),
	array('expense_broken_fk_convention', 'mjlfinancement_expense', 'fk_convention', 'mjlfinancement_convention'),
	array('expense_broken_fk_budget_line', 'mjlfinancement_expense', 'fk_budget_line', 'mjlfinancement_budget_line'),
	array('expense_broken_fk_user_valid', 'mjlfinancement_expense', 'fk_user_valid', 'user'),
	array('fund_receipt_broken_fk_soc', 'mjlfinancement_fund_receipt', 'fk_soc', 'societe'),
	array('fund_receipt_broken_fk_project', 'mjlfinancement_fund_receipt', 'fk_project', 'projet'),
	array('fund_receipt_broken_fk_convention', 'mjlfinancement_fund_receipt', 'fk_convention', 'mjlfinancement_convention'),
	array('validation_broken_fk_expense', 'mjlfinancement_validation', 'fk_expense', 'mjlfinancement_expense'),
	array('validation_broken_fk_user_action', 'mjlfinancement_validation', 'fk_user_action', 'user'),
) as $fk) {
	reportBrokenForeignKeys($fk[0], $fk[1], $fk[2], $fk[3]);
}

if (hasColumns('mjlfinancement_expense', array('rowid', 'ref', 'entity', 'status', 'fk_user_valid', 'validation_date'))) {
	reportRows(
		'validated_expense_missing_metadata',
		'SELECT rowid, ref, entity, fk_user_valid, validation_date FROM '.$db->prefix().'mjlfinancement_expense WHERE status = 2 AND (fk_user_valid IS NULL OR validation_date IS NULL)'
	);
}

if (hasColumns('mjlfinancement_expense', array('rowid', 'ref', 'entity', 'status')) && hasColumns('mjlfinancement_validation', array('rowid', 'entity', 'fk_expense', 'action', 'to_status'))) {
	reportRows(
		'validated_expense_missing_validation_event',
		'SELECT e.rowid, e.ref, e.entity, COUNT(v.rowid) AS validation_events FROM '.$db->prefix().'mjlfinancement_expense e LEFT JOIN '.$db->prefix().'mjlfinancement_validation v ON v.fk_expense = e.rowid AND v.entity = e.entity AND v.action = \'validated\' AND v.to_status = \'validated\' WHERE e.status = 2 GROUP BY e.rowid, e.ref, e.entity HAVING COUNT(v.rowid) = 0'
	);
	reportRows(
		'audited_expense_missing_matching_event',
		'SELECT e.rowid, e.ref, e.entity, e.status, COUNT(v.rowid) AS matching_events FROM '.$db->prefix().'mjlfinancement_expense e LEFT JOIN '.$db->prefix().'mjlfinancement_validation v ON v.fk_expense = e.rowid AND v.entity = e.entity AND ((e.status = 3 AND v.to_status = \'corrected\') OR (e.status = 8 AND v.to_status = \'rejected\')) WHERE e.status IN (3, 8) GROUP BY e.rowid, e.ref, e.entity, e.status HAVING COUNT(v.rowid) = 0'
	);
}

if (hasColumns('mjlfinancement_budget_line', array('rowid', 'ref', 'entity', 'revised_budget', 'spent_amount', 'remaining_amount')) && hasColumns('mjlfinancement_expense', array('entity', 'fk_budget_line', 'amount', 'status'))) {
	$sql = 'SELECT bl.rowid, bl.ref, bl.entity, COALESCE(bl.spent_amount, 0) AS stored_spent, COALESCE(x.computed_spent, 0) AS computed_spent, COALESCE(bl.remaining_amount, 0) AS stored_remaining, COALESCE(bl.revised_budget, 0) - COALESCE(x.computed_spent, 0) AS computed_remaining';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' LEFT JOIN (SELECT fk_budget_line, entity, COALESCE(SUM(CASE WHEN status IN ('.mjl_expense_status_sql_list(mjl_expense_budget_consuming_statuses()).') THEN '.mjl_expense_budget_amount_sql('e').' ELSE 0 END), 0) AS computed_spent FROM '.$db->prefix().'mjlfinancement_expense e GROUP BY fk_budget_line, entity) x ON x.fk_budget_line = bl.rowid AND x.entity = bl.entity';
	$sql .= ' WHERE ABS(COALESCE(bl.spent_amount, 0) - COALESCE(x.computed_spent, 0)) > 0.001 OR ABS(COALESCE(bl.remaining_amount, 0) - (COALESCE(bl.revised_budget, 0) - COALESCE(x.computed_spent, 0))) > 0.001';
	reportRows('budget_line_amount_mismatch', $sql);
}

foreach (array(
	array('expense_budget_line_entity_mismatch', 'mjlfinancement_expense', 'fk_budget_line', 'mjlfinancement_budget_line'),
	array('expense_convention_entity_mismatch', 'mjlfinancement_expense', 'fk_convention', 'mjlfinancement_convention'),
	array('validation_expense_entity_mismatch', 'mjlfinancement_validation', 'fk_expense', 'mjlfinancement_expense'),
	array('fund_receipt_convention_entity_mismatch', 'mjlfinancement_fund_receipt', 'fk_convention', 'mjlfinancement_convention'),
) as $entityLink) {
	reportEntityMismatch($entityLink[0], $entityLink[1], $entityLink[2], $entityLink[3]);
}

if (hasColumns('ecm_files', array('rowid', 'entity', 'filepath', 'filename', 'src_object_type', 'src_object_id')) && hasColumns('mjlfinancement_expense', array('rowid', 'entity')) && hasColumns('mjlfinancement_fund_receipt', array('rowid', 'entity'))) {
	$sql = 'SELECT f.rowid, f.entity, f.filepath, f.filename, f.src_object_type, f.src_object_id, e.entity AS expense_entity, fr.entity AS receipt_entity';
	$sql .= ' FROM '.$db->prefix().'ecm_files f';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON f.src_object_type = \'mjlfinancement_expense\' AND f.src_object_id = e.rowid';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON f.src_object_type = \'mjlfinancement_fund_receipt\' AND f.src_object_id = fr.rowid';
	$sql .= ' WHERE f.filepath = \'mjlfinancement_sample\' AND ((f.src_object_type = \'mjlfinancement_expense\' AND (e.rowid IS NULL OR e.entity <> f.entity)) OR (f.src_object_type = \'mjlfinancement_fund_receipt\' AND (fr.rowid IS NULL OR fr.entity <> f.entity)))';
	reportRows('ecm_source_entity_mismatch', $sql);
}

foreach (array(
	array('mjlfinancement_convention', 'label', "label IS NOT NULL AND label <> ''"),
	array('mjlfinancement_convention', 'amount', 'amount IS NOT NULL'),
	array('mjlfinancement_budget_line', 'amount_planned', 'amount_planned IS NOT NULL'),
	array('mjlfinancement_budget_line', 'amount_committed', 'amount_committed IS NOT NULL'),
	array('mjlfinancement_expense', 'label', "label IS NOT NULL AND label <> ''"),
	array('mjlfinancement_expense', 'fk_expensereport', 'fk_expensereport IS NOT NULL'),
) as $legacy) {
	if (tableExists($legacy[0]) && columnExists($legacy[0], $legacy[1])) {
		$count = scalar('SELECT COUNT(*) AS nb FROM '.$db->prefix().$legacy[0].' WHERE '.$legacy[2]);
		if ($count > 0) {
			finding('populated_legacy_column', $legacy[0].'.'.$legacy[1].' rows='.$count);
		} else {
			finding('empty_legacy_column_remaining', $legacy[0].'.'.$legacy[1]);
		}
	}
}

if (!$hasFindings) {
	out('MJL 0.3.0 schema audit: OK');
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

function reportEntityMismatch($name, $table, $column, $targetTable)
{
	global $db;

	if (!hasColumns($table, array('rowid', 'ref', 'entity', $column)) || !hasColumns($targetTable, array('rowid', 'entity'))) {
		return;
	}

	$sql = 'SELECT s.rowid, s.ref, s.entity, s.'.$column.' AS linked_id, t.entity AS linked_entity FROM '.$db->prefix().$table.' s';
	$sql .= ' INNER JOIN '.$db->prefix().$targetTable.' t ON t.rowid = s.'.$column;
	$sql .= ' WHERE s.'.$column.' IS NOT NULL AND s.entity <> t.entity';
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
