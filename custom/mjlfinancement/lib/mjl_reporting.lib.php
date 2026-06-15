<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';

function mjl_report_project_summary($projectId, $filters = array())
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$projectId = (int) $projectId;
	$sql = 'SELECT p.ref AS project_ref, p.title AS project_title,';
	$sql .= ' COALESCE(SUM(bl.revised_budget), 0) AS budget_total,';
	$sql .= ' (SELECT COALESCE(SUM(fr.amount), 0) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = '.$entity.' AND fr.fk_project = '.$projectId.' AND fr.status = 1) AS funds_received,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.mjl_report_expense_filter_sql('e', $filters, false).') AS total_expenses,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.' AND e.status = 2'.mjl_report_expense_filter_sql('e', $filters, false).') AS validated_expenses,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.' AND e.status = 1'.mjl_report_expense_filter_sql('e', $filters, false).') AS pending_expenses';
	$sql .= ' FROM '.$db->prefix().'projet p';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.fk_project = p.rowid AND bl.entity = '.$entity;
	$sql .= ' WHERE p.rowid = '.$projectId.' AND p.entity = '.$entity.' GROUP BY p.rowid, p.ref, p.title';
	return mjl_report_fetch_row($sql);
}

function mjl_report_convention_budget($conventionId, $filters = array())
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$conventionId = (int) $conventionId;
	$sql = 'SELECT bl.ref, bl.label, bl.initial_budget, bl.revised_budget, bl.status,';
	$sql .= ' COALESCE(SUM(CASE WHEN e.status = 2 THEN e.amount ELSE 0 END), 0) AS validated_expenses,';
	$sql .= ' COALESCE(SUM(CASE WHEN e.status = 1 THEN e.amount ELSE 0 END), 0) AS submitted_expenses,';
	$sql .= ' bl.revised_budget - COALESCE(SUM(CASE WHEN e.status = 2 THEN e.amount ELSE 0 END), 0) AS remaining_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.fk_budget_line = bl.rowid AND e.entity = '.$entity.mjl_report_expense_filter_sql('e', $filters, true);
	$sql .= ' WHERE bl.entity = '.$entity.' AND bl.fk_convention = '.$conventionId;
	$sql .= ' GROUP BY bl.rowid, bl.ref, bl.label, bl.initial_budget, bl.revised_budget, bl.status';
	$sql .= ' ORDER BY bl.ref';
	return mjl_report_fetch_rows($sql);
}

function mjl_report_expense_documents($filters = array())
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$sql = 'SELECT e.ref AS expense_ref, e.expense_date, bl.ref AS budget_line, e.amount, e.status,';
	$sql .= ' CASE WHEN '.mjl_expense_document_present_sql('e').' THEN 1 ELSE 0 END AS document_present,';
	$sql .= ' '.mjl_expense_supporting_document_sql('e').' AS supporting_document,';
	$sql .= ' u.login AS validator, e.correction_reason';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = e.fk_user_valid';
	$sql .= ' WHERE e.entity = '.$entity;
	$sql .= mjl_report_expense_filter_sql('e', $filters, false);
	if (isset($filters['missing_document'])) {
		$sql .= !empty($filters['missing_document']) ? ' AND NOT '.mjl_expense_document_present_sql('e') : ' AND '.mjl_expense_document_present_sql('e');
	}
	$sql .= ' ORDER BY e.ref';
	return mjl_report_fetch_rows($sql);
}

function mjl_report_expense_filter_sql($alias, $filters, $joinClause)
{
	global $db;

	$sql = '';
	if (!empty($filters['project_id'])) {
		$sql .= ' AND '.$alias.'.fk_project = '.((int) $filters['project_id']);
	}
	if (!empty($filters['convention_id'])) {
		$sql .= ' AND '.$alias.'.fk_convention = '.((int) $filters['convention_id']);
	}
	if (isset($filters['status']) && $filters['status'] !== '') {
		$sql .= ' AND '.$alias.'.status = '.((int) $filters['status']);
	}
	if (!empty($filters['date_start'])) {
		$sql .= " AND ".$alias.".expense_date >= '".$db->escape($filters['date_start'])."'";
	}
	if (!empty($filters['date_end'])) {
		$sql .= " AND ".$alias.".expense_date <= '".$db->escape($filters['date_end'])."'";
	}
	return $sql;
}

function mjl_report_fetch_row($sql)
{
	$rows = mjl_report_fetch_rows($sql);
	return empty($rows) ? array() : $rows[0];
}

function mjl_report_fetch_rows($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_report_error('Unable to fetch report rows: '.$db->lasterror());
		return array();
	}

	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}

function mjl_report_error($message)
{
	if (function_exists('setEventMessages')) {
		setEventMessages($message, null, 'errors');
		return;
	}
	if (function_exists('fail')) {
		fail($message);
	}
}
