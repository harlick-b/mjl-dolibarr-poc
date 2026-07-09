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
	'workflow_action_without_resolvable_target',
	'SELECT w.rowid, w.ref, w.entity, w.object_type, w.object_id FROM '.$db->prefix().'mjlfinancement_workflow_action w'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = w.object_id AND w.object_type = \'mjlfinancement_expense\' AND e.entity = w.entity'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = w.object_id AND w.object_type = \'mjlfinancement_convention\' AND c.entity = w.entity'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = w.object_id AND w.object_type = \'mjlfinancement_budget_line\' AND bl.entity = w.entity'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = w.object_id AND w.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = w.entity'
	.' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = w.object_id AND w.object_type = \'mjlfinancement_project\' AND p.entity = w.entity'
	.' WHERE w.object_type IS NOT NULL AND w.object_type <> \'\' AND w.object_id > 0 AND COALESCE(a.rowid, e.rowid, c.rowid, bl.rowid, fr.rowid, p.rowid) IS NULL'
);
reportRows(
	'exchange_log_without_positive_object',
	'SELECT rowid, ref, entity, object_type, object_id FROM '.$db->prefix().'mjlfinancement_exchange_log WHERE object_type IS NULL OR object_type = \'\' OR object_id IS NULL OR object_id <= 0'
);
reportRows(
	'exchange_log_without_resolvable_target',
	'SELECT x.rowid, x.ref, x.entity, x.object_type, x.object_id FROM '.$db->prefix().'mjlfinancement_exchange_log x'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = x.object_id AND x.object_type = \'mjlfinancement_activity\' AND a.entity = x.entity'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = x.object_id AND x.object_type = \'mjlfinancement_expense\' AND e.entity = x.entity'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = x.object_id AND x.object_type = \'mjlfinancement_convention\' AND c.entity = x.entity'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = x.object_id AND x.object_type = \'mjlfinancement_budget_line\' AND bl.entity = x.entity'
	.' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = x.object_id AND x.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = x.entity'
	.' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = x.object_id AND x.object_type = \'mjlfinancement_project\' AND p.entity = x.entity'
	.' WHERE x.object_type IS NOT NULL AND x.object_type <> \'\' AND x.object_id > 0 AND COALESCE(a.rowid, e.rowid, c.rowid, bl.rowid, fr.rowid, p.rowid) IS NULL'
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
