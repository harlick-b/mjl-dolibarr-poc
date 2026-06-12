<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_sample_data.lib.php';

global $conf, $db;

$entity = (int) $conf->entity;
$importKey = mjl_poc_import_key();
mjl_ensure_schema();

assertCount('ptfs', 3, 'societe', "import_key = '".$db->escape($importKey)."' AND nom IN ('UNICEF', 'Programme Redevabilité', 'PTF Test Extension')");
assertCount('projects', 3, 'projet', "import_key = '".$db->escape($importKey)."' AND ref IN ('PRJ-JE-2026', 'PRJ-RED-2026', 'PRJ-EXT-2026')");
assertCount('conventions', 3, 'mjlfinancement_convention', "import_key = '".$db->escape($importKey)."'");
assertCount('activities', 5, 'mjlfinancement_activity', "import_key = '".$db->escape($importKey)."'");
assertCount('budget_lines', 8, 'mjlfinancement_budget_line', "import_key = '".$db->escape($importKey)."'");
assertCount('fund_receipts', 4, 'mjlfinancement_fund_receipt', "import_key = '".$db->escape($importKey)."'");
assertCount('expenses', 7, 'mjlfinancement_expense', "import_key = '".$db->escape($importKey)."'");
assertCount('validation_events', 4, 'mjlfinancement_validation', "import_key = '".$db->escape($importKey)."'");
assertCount('reports', 3, 'mjlfinancement_report', "import_key = '".$db->escape($importKey)."'");

$docRows = count(mjl_csv_rows('supporting_documents.csv'));
assertSame('document CSV rows', 10, $docRows);
assertCount('ECM placeholder files', 9, 'ecm_files', "entity = ".$entity." AND filepath = 'mjlfinancement_sample'");

$ptf = requireId('societe', "nom = 'UNICEF'");
$project = requireId('projet', "ref = 'PRJ-JE-2026'");
$convention = requireId('mjlfinancement_convention', "ref = 'CONV-UNICEF-2026-001' AND fk_soc = ".$ptf." AND fk_project = ".$project);
$activity = requireId('mjlfinancement_activity', "ref = 'ACT-JE-001' AND fk_project = ".$project." AND fk_convention = ".$convention);
$budgetLine = requireId('mjlfinancement_budget_line', "ref = 'BL-JE-001' AND fk_mjl_activity = ".$activity." AND fk_convention = ".$convention);
$expense = requireId('mjlfinancement_expense', "ref = 'EXP-JE-001' AND fk_mjl_activity = ".$activity." AND fk_budget_line = ".$budgetLine." AND supporting_document = 'DOC-EXP-JE-001' AND status = 2");
requireId('ecm_files', "entity = ".$entity." AND filename = 'EXP-JE-001_facture-location-salle.txt' AND src_object_type = 'mjlfinancement_expense' AND src_object_id = ".$expense);
requireId('mjlfinancement_validation', "ref = 'VAL-001' AND fk_expense = ".$expense." AND action = 'validated'");
requireId('mjlfinancement_report', "ref = 'RPT-001'");

$funds = fetchAmount('SELECT COALESCE(SUM(amount), 0) AS amount FROM '.$db->prefix().'mjlfinancement_fund_receipt WHERE fk_convention = '.$convention.' AND status = 1');
assertSame('UNICEF funds received', 4000000.0, $funds);

$projectReport = mjl_report_project_summary($project);
assertSame('RPT-001 funds_received', 4000000.0, (float) $projectReport['funds_received']);
assertSame('RPT-001 validated_expenses', 950000.0, (float) $projectReport['validated_expenses']);
assertSame('RPT-001 pending_expenses', 420000.0, (float) $projectReport['pending_expenses']);

$budgetRows = mjl_report_convention_budget($convention);
assertSame('RPT-002 line count for UNICEF convention', 5, count($budgetRows));
$formation = findRow($budgetRows, 'ref', 'BL-JE-001');
assertSame('BL-JE-001 stored spent amount', 950000.0, fetchAmount('SELECT spent_amount AS amount FROM '.$db->prefix().'mjlfinancement_budget_line WHERE rowid = '.$budgetLine));
assertSame('BL-JE-001 stored remaining amount', 850000.0, fetchAmount('SELECT remaining_amount AS amount FROM '.$db->prefix().'mjlfinancement_budget_line WHERE rowid = '.$budgetLine));
assertSame('BL-JE-001 report remaining amount', 850000.0, (float) $formation['remaining_amount']);
$perDiem = findRow($budgetRows, 'ref', 'BL-JE-003');
assertSame('Rejected expense excluded from BL-JE-003 validated expenses', 0.0, (float) $perDiem['validated_expenses']);

$missingDocs = mjl_report_expense_documents(array('missing_document' => true));
$missing = findRow($missingDocs, 'expense_ref', 'EXP-JE-005');
assertSame('EXP-JE-005 document_present', 0, (int) $missing['document_present']);

assertExpenseStatus('EXP-JE-003', 8);
assertExpenseStatus('EXP-JE-004', 3);
assertExpenseStatus('EXP-JE-005', 0);
requireId('mjlfinancement_validation', "ref = 'VAL-004' AND action = 'validated' AND to_status = 'validated'");
requireId('mjlfinancement_convention', "ref = 'CONV-TEST-2026-001' AND status = 0");
$testFunds = fetchAmount("SELECT COALESCE(SUM(amount), 0) AS amount FROM ".$db->prefix()."mjlfinancement_fund_receipt WHERE ref = 'FR-TEST-001' AND status = 1");
assertSame('FR-TEST-001 recorded funds', 0.0, $testFunds);

assertLecteurRights();

mjl_out('MJL sample data acceptance checks completed.');

function assertCount($label, $expected, $table, $where)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().$table.' WHERE '.$where;
	assertSame($label.' count', $expected, mjl_scalar($sql));
}

function requireId($table, $where)
{
	global $db;

	$id = mjl_fetch_id($table, $where);
	if ($id <= 0) {
		fail('Missing required '.$table.' row: '.$where);
	}
	return $id;
}

function fetchAmount($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch amount: '.$db->lasterror());
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (float) $obj->amount : 0.0;
}

function findRow($rows, $column, $value)
{
	foreach ($rows as $row) {
		if ((string) $row[$column] === (string) $value) {
			return $row;
		}
	}
	fail('Unable to find row where '.$column.' = '.$value);
}

function assertExpenseStatus($ref, $expected)
{
	global $db;

	$status = mjl_scalar("SELECT status AS nb FROM ".$db->prefix()."mjlfinancement_expense WHERE ref = '".$db->escape($ref)."'");
	assertSame($ref.' status', $expected, $status);
}

function assertLecteurRights()
{
	global $db;

	$sql = 'SELECT r.module, r.perms, r.subperms FROM '.$db->prefix().'user u';
	$sql .= ' INNER JOIN '.$db->prefix().'usergroup_user gu ON gu.fk_user = u.rowid';
	$sql .= ' INNER JOIN '.$db->prefix().'usergroup_rights gr ON gr.fk_usergroup = gu.fk_usergroup';
	$sql .= ' INNER JOIN '.$db->prefix().'rights_def r ON r.id = gr.fk_id';
	$sql .= " WHERE u.login = 'lecteur.audit'";
	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch lecteur.audit rights: '.$db->lasterror());
	}

	$rights = array();
	while ($obj = $db->fetch_object($resql)) {
		$rights[] = $obj->module.'/'.$obj->perms.'/'.(string) $obj->subperms;
	}

	foreach (array('mjlfinancement/convention/read', 'mjlfinancement/report/read', 'mjlfinancement/expense/read') as $required) {
		if (!in_array($required, $rights, true)) {
			fail('lecteur.audit missing required read right '.$required);
		}
	}
	foreach ($rights as $right) {
		if (preg_match('#mjlfinancement/.+/(write|delete|validate)$#', $right) || $right === 'mjlfinancement/export/read' || $right === 'mjlfinancement/export/write') {
			fail('lecteur.audit has forbidden right '.$right);
		}
	}
}

function assertSame($label, $expected, $actual)
{
	if (is_float($expected) || is_float($actual)) {
		if (abs((float) $expected - (float) $actual) > 0.001) {
			fail($label.' expected '.$expected.' got '.$actual);
		}
		return;
	}

	if ($expected !== $actual) {
		fail($label.' expected '.$expected.' got '.$actual);
	}
}
