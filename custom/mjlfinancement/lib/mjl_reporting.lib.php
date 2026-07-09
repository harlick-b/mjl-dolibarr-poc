<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_finance_metrics.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

function mjl_report_project_summary($projectId, $filters = array())
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$projectId = (int) $projectId;
	$sql = 'SELECT p.ref AS project_ref, p.title AS project_title,';
	$sql .= ' COALESCE(SUM(bl.revised_budget), 0) AS budget_total,';
	$sql .= ' (SELECT COALESCE(SUM(fr.amount), 0) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = '.$entity.' AND fr.fk_project = '.$projectId.' AND fr.status = 1'.mjl_report_partner_scope_sql('fr.fk_soc').') AS funds_received,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.mjl_report_expense_filter_sql('e', $filters, false).') AS total_expenses,';
	$sql .= ' (SELECT COALESCE(SUM('.mjl_finance_final_validated_amount_sql('e').'), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.mjl_report_expense_filter_sql('e', $filters, false).') AS validated_expenses,';
	$sql .= ' (SELECT COALESCE(SUM('.mjl_finance_disbursed_amount_sql('e').'), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.mjl_report_expense_filter_sql('e', $filters, false).') AS disbursed_expenses,';
	$sql .= ' (SELECT COALESCE(SUM('.mjl_finance_submitted_amount_sql('e').'), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.mjl_report_expense_filter_sql('e', $filters, false).') AS pending_expenses';
	$sql .= ' FROM '.$db->prefix().'projet p';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.fk_project = p.rowid AND bl.entity = '.$entity;
	$sql .= ' WHERE p.rowid = '.$projectId.' AND p.entity = '.$entity.mjl_report_partner_scope_sql('p.fk_soc').' GROUP BY p.rowid, p.ref, p.title';
	return mjl_report_fetch_row($sql);
}

function mjl_report_convention_budget($conventionId, $filters = array())
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$conventionId = (int) $conventionId;
	$sql = 'SELECT bl.ref, bl.label, bl.initial_budget, bl.revised_budget, bl.status,';
	$sql .= ' COALESCE(SUM('.mjl_finance_final_validated_amount_sql('e').'), 0) AS validated_expenses,';
	$sql .= ' COALESCE(SUM('.mjl_finance_disbursed_amount_sql('e').'), 0) AS disbursed_expenses,';
	$sql .= ' COALESCE(SUM('.mjl_finance_submitted_amount_sql('e').'), 0) AS submitted_expenses,';
	$sql .= ' COALESCE(SUM('.mjl_finance_prevalidated_amount_sql('e').'), 0) AS prevalidated_expenses,';
	$sql .= ' bl.revised_budget - COALESCE(SUM('.mjl_finance_final_validated_amount_sql('e').'), 0) AS remaining_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.fk_budget_line = bl.rowid AND e.entity = '.$entity.mjl_report_expense_filter_sql('e', $filters, true);
	$sql .= ' WHERE bl.entity = '.$entity.' AND bl.fk_convention = '.$conventionId;
	$sql .= ' AND EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_convention cscope WHERE cscope.entity = bl.entity AND cscope.rowid = bl.fk_convention'.mjl_report_partner_scope_sql('cscope.fk_soc').')';
	$sql .= ' GROUP BY bl.rowid, bl.ref, bl.label, bl.initial_budget, bl.revised_budget, bl.status';
	$sql .= ' ORDER BY bl.ref';
	return mjl_report_fetch_rows($sql);
}

function mjl_report_expense_documents($filters = array())
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$sql = 'SELECT e.rowid, e.entity AS evidence_entity, s.nom AS partner, p.ref AS project, e.ref AS expense_ref, e.expense_date, bl.ref AS budget_line, e.amount, e.prevalidated_amount, e.final_validated_amount, e.disbursed_amount, e.status, e.supporting_document AS stored_supporting_document,';
	$sql .= ' CASE WHEN '.mjl_expense_document_present_sql('e').' THEN 1 ELSE 0 END AS document_present,';
	$sql .= ' '.mjl_expense_supporting_document_sql('e').' AS supporting_document,';
	$sql .= ' u.login AS validator, e.correction_reason';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention cscope ON cscope.rowid = e.fk_convention AND cscope.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = cscope.fk_soc AND s.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = e.fk_user_valid';
	$sql .= ' WHERE e.entity = '.$entity;
	if (!empty($filters['fk_soc'])) {
		$sql .= ' AND cscope.fk_soc = '.((int) $filters['fk_soc']);
	} else {
		$sql .= mjl_report_partner_scope_sql('cscope.fk_soc');
	}
	$sql .= mjl_report_expense_filter_sql('e', $filters, false);
	$sql .= ' ORDER BY e.ref';
	$rows = mjl_report_fetch_rows($sql);
	$result = array();
	foreach ($rows as $row) {
		$state = mjl_expense_evidence_state((int) $row['rowid'], (int) $row['evidence_entity'], $row['stored_supporting_document']);
		if (isset($filters['missing_document'])) {
			if (!empty($filters['missing_document']) && $state === 'downloadable') continue;
			if (empty($filters['missing_document']) && $state !== 'downloadable') continue;
		}
		$row['document_present'] = $state === 'downloadable' ? 1 : 0;
		$row['document_state'] = $state;
		unset($row['rowid'], $row['evidence_entity'], $row['stored_supporting_document']);
		$result[] = $row;
	}
	return $result;
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

function mjl_report_partner_scope_sql($column)
{
	if (empty($GLOBALS['user']) || empty($GLOBALS['user']->id)) {
		return '';
	}
	return mjl_scope_partner_sql_filter($column, $GLOBALS['user']);
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
