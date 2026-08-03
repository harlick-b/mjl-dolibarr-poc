<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';

global $db;

$checks = array(
	'conventions_missing_fk_soc' => 'SELECT rowid, ref, fk_soc FROM '.$db->prefix().'mjlfinancement_convention WHERE fk_soc IS NULL',
	'budget_lines_missing_fk_convention' => 'SELECT rowid, ref, fk_convention FROM '.$db->prefix().'mjlfinancement_budget_line WHERE fk_convention IS NULL',
	'expenses_missing_fk_project' => 'SELECT rowid, ref, fk_budget_line, fk_convention, fk_project FROM '.$db->prefix().'mjlfinancement_expense WHERE fk_project IS NULL',
	'expenses_missing_fk_convention' => 'SELECT rowid, ref, fk_budget_line, fk_convention, fk_project FROM '.$db->prefix().'mjlfinancement_expense WHERE fk_convention IS NULL',
	'expenses_missing_fk_budget_line' => 'SELECT rowid, ref, fk_budget_line, fk_convention, fk_project FROM '.$db->prefix().'mjlfinancement_expense WHERE fk_budget_line IS NULL',
	'fund_receipts_missing_fk_soc' => 'SELECT rowid, ref, fk_soc, fk_convention FROM '.$db->prefix().'mjlfinancement_fund_receipt WHERE fk_soc IS NULL',
	'fund_receipts_missing_fk_convention' => 'SELECT rowid, ref, fk_soc, fk_convention FROM '.$db->prefix().'mjlfinancement_fund_receipt WHERE fk_convention IS NULL',
);

$hasFindings = false;
foreach ($checks as $name => $sql) {
	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to run '.$name.': '.$db->lasterror());
	}

	$count = 0;
	while ($obj = $db->fetch_object($resql)) {
		if ($count === 0) {
			out($name.':');
		}
		$count++;
		$hasFindings = true;
		out('  '.formatRow($obj));
	}

	if ($count === 0) {
		out($name.': OK');
	}
}

exit($hasFindings ? 1 : 0);

function nullable($value)
{
	return $value === null ? 'NULL' : $value;
}

function formatRow($obj)
{
	$parts = array('rowid='.$obj->rowid, 'ref='.$obj->ref);
	foreach (array('fk_soc', 'fk_project', 'fk_convention', 'fk_budget_line') as $field) {
		if (property_exists($obj, $field)) {
			$parts[] = $field.'='.nullable($obj->{$field});
		}
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
