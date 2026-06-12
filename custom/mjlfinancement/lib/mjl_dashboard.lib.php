<?php

function mjl_dashboard_count($table)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().$table.' WHERE entity = '.((int) $conf->entity);
	return (int) mjl_dashboard_scalar($sql);
}

function mjl_dashboard_fetch_id($table, $where)
{
	global $db, $conf;

	$sql = 'SELECT rowid FROM '.$db->prefix().$table.' WHERE '.$where;
	$sql .= ' AND entity = '.((int) $conf->entity);
	return (int) mjl_dashboard_scalar($sql, 'rowid');
}

function mjl_dashboard_project_summary($projectId)
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$projectId = (int) $projectId;
	$sql = 'SELECT p.ref AS project_ref, p.title AS project_title,';
	$sql .= ' COALESCE(SUM(bl.revised_budget), 0) AS budget_total,';
	$sql .= ' (SELECT COALESCE(SUM(fr.amount), 0) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = '.$entity.' AND fr.fk_project = '.$projectId.' AND fr.status = 1) AS funds_received,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.') AS total_expenses,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.' AND e.status = 2) AS validated_expenses,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.' AND e.status = 1) AS pending_expenses';
	$sql .= ' FROM '.$db->prefix().'projet p';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.fk_project = p.rowid AND bl.entity = '.$entity;
	$sql .= ' WHERE p.rowid = '.$projectId.' AND p.entity = '.$entity.' GROUP BY p.rowid, p.ref, p.title';
	return mjl_dashboard_fetch_row($sql);
}

function mjl_dashboard_convention_budget($conventionId)
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$conventionId = (int) $conventionId;
	$sql = 'SELECT bl.ref, bl.label, bl.initial_budget, bl.revised_budget, bl.status,';
	$sql .= ' COALESCE(SUM(CASE WHEN e.status = 2 THEN e.amount ELSE 0 END), 0) AS validated_expenses,';
	$sql .= ' COALESCE(SUM(CASE WHEN e.status = 1 THEN e.amount ELSE 0 END), 0) AS submitted_expenses,';
	$sql .= ' bl.revised_budget - COALESCE(SUM(CASE WHEN e.status = 2 THEN e.amount ELSE 0 END), 0) AS remaining_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.fk_budget_line = bl.rowid AND e.entity = '.$entity;
	$sql .= ' WHERE bl.entity = '.$entity.' AND bl.fk_convention = '.$conventionId;
	$sql .= ' GROUP BY bl.rowid, bl.ref, bl.label, bl.initial_budget, bl.revised_budget, bl.status';
	$sql .= ' ORDER BY bl.ref';
	return mjl_dashboard_fetch_rows($sql);
}

function mjl_dashboard_scalar($sql, $field = 'nb')
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_dashboard_error($db->lasterror());
		return 0;
	}

	$obj = $db->fetch_object($resql);
	return $obj && isset($obj->{$field}) ? $obj->{$field} : 0;
}

function mjl_dashboard_fetch_row($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_dashboard_error($db->lasterror());
		return array();
	}

	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_dashboard_fetch_rows($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_dashboard_error($db->lasterror());
		return array();
	}

	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}

function mjl_dashboard_error($message)
{
	if (function_exists('setEventMessages')) {
		setEventMessages($message, null, 'errors');
	}
}
