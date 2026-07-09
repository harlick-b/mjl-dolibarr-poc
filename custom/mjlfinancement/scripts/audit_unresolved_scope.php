<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';

global $db;

$hasFindings = false;

reportRows(
	'project_without_partner',
	'SELECT rowid, ref, entity FROM '.$db->prefix().'projet WHERE entity > 0 AND (fk_soc IS NULL OR fk_soc <= 0)'
);
reportRows(
	'convention_without_partner',
	'SELECT rowid, ref, entity FROM '.$db->prefix().'mjlfinancement_convention WHERE fk_soc IS NULL OR fk_soc <= 0'
);
reportRows(
	'activity_without_resolvable_partner',
	'SELECT a.rowid, a.ref, a.entity, a.fk_convention FROM '.$db->prefix().'mjlfinancement_activity a LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE c.rowid IS NULL OR c.fk_soc IS NULL OR c.fk_soc <= 0'
);
reportRows(
	'expense_without_resolvable_partner',
	'SELECT e.rowid, e.ref, e.entity, e.fk_convention FROM '.$db->prefix().'mjlfinancement_expense e LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.rowid IS NULL OR c.fk_soc IS NULL OR c.fk_soc <= 0'
);
reportRows(
	'budget_line_without_resolvable_partner',
	'SELECT b.rowid, b.ref, b.entity, b.fk_convention FROM '.$db->prefix().'mjlfinancement_budget_line b LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = b.fk_convention AND c.entity = b.entity WHERE c.rowid IS NULL OR c.fk_soc IS NULL OR c.fk_soc <= 0'
);
reportRows(
	'fund_receipt_without_partner',
	'SELECT rowid, ref, entity FROM '.$db->prefix().'mjlfinancement_fund_receipt WHERE fk_soc IS NULL OR fk_soc <= 0'
);
reportRows(
	'workflow_action_without_positive_object',
	'SELECT rowid, ref, entity, object_type, object_id FROM '.$db->prefix().'mjlfinancement_workflow_action WHERE object_type IS NULL OR object_type = \'\' OR object_id IS NULL OR object_id <= 0'
);
reportRows(
	'exchange_log_without_positive_object',
	'SELECT rowid, ref, entity, object_type, object_id FROM '.$db->prefix().'mjlfinancement_exchange_log WHERE object_type IS NULL OR object_type = \'\' OR object_id IS NULL OR object_id <= 0'
);
reportRows(
	'document_without_positive_source',
	'SELECT rowid, ref, entity, src_object_type, src_object_id FROM '.$db->prefix().'ecm_files WHERE src_object_type LIKE \'mjlfinancement_%\' AND (src_object_id IS NULL OR src_object_id <= 0)'
);

if (!$hasFindings) {
	out('MJL unresolved scope audit: OK');
}

exit($hasFindings ? 1 : 0);

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
			finding($name);
		}
		$count++;
		out('  '.formatObject($obj));
	}
}

function finding($name)
{
	global $hasFindings;

	$hasFindings = true;
	out($name.':');
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
