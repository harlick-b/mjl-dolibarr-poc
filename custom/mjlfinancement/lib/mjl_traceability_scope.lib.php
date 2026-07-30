<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

/**
 * Return the fail-closed partner/programme predicate for workflow audit rows.
 *
 * The caller remains responsible for filtering the audit row itself by active
 * entity. Every target must resolve through an entity-matched supported
 * object. Non-admin targets must additionally resolve to one of the user's
 * active partner/programme scopes.
 */
function mjl_traceability_scope_sql($auditAlias, $userObj, $entity = null)
{
	global $db, $conf;

	$auditAlias = preg_replace('/[^A-Za-z0-9_]/', '', (string) $auditAlias);
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if ($auditAlias === '' || $entity <= 0) {
		return ' AND 1=0';
	}

	$scopeIds = mjl_scope_user_soc_ids($userObj, $entity);
	$isAdmin = $scopeIds === null;
	if (!$isAdmin && empty($scopeIds)) {
		return ' AND 1=0';
	}
	$scope = $isAdmin ? '' : implode(',', array_map('intval', $scopeIds));
	$scopeSql = $isAdmin ? '' : " AND %s IN ({$scope})";
	$prefix = $db->prefix();

	$clauses = array();
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_project' AND EXISTS (SELECT 1 FROM {$prefix}projet mjl_t_project WHERE mjl_t_project.rowid = {$auditAlias}.object_id AND mjl_t_project.entity = {$auditAlias}.entity AND mjl_t_project.entity = {$entity}".sprintf($scopeSql, 'mjl_t_project.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_activity' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_activity mjl_t_activity INNER JOIN {$prefix}mjlfinancement_convention mjl_t_activity_convention ON mjl_t_activity_convention.rowid = mjl_t_activity.fk_convention AND mjl_t_activity_convention.entity = mjl_t_activity.entity WHERE mjl_t_activity.rowid = {$auditAlias}.object_id AND mjl_t_activity.entity = {$auditAlias}.entity AND mjl_t_activity.entity = {$entity} AND mjl_t_activity_convention.entity = {$entity}".sprintf($scopeSql, 'mjl_t_activity_convention.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_expense' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_expense mjl_t_expense INNER JOIN {$prefix}mjlfinancement_convention mjl_t_expense_convention ON mjl_t_expense_convention.rowid = mjl_t_expense.fk_convention AND mjl_t_expense_convention.entity = mjl_t_expense.entity WHERE mjl_t_expense.rowid = {$auditAlias}.object_id AND mjl_t_expense.entity = {$auditAlias}.entity AND mjl_t_expense.entity = {$entity} AND mjl_t_expense_convention.entity = {$entity}".sprintf($scopeSql, 'mjl_t_expense_convention.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_convention' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_convention mjl_t_convention WHERE mjl_t_convention.rowid = {$auditAlias}.object_id AND mjl_t_convention.entity = {$auditAlias}.entity AND mjl_t_convention.entity = {$entity}".sprintf($scopeSql, 'mjl_t_convention.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_budget_line' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_budget_line mjl_t_budget INNER JOIN {$prefix}mjlfinancement_convention mjl_t_budget_convention ON mjl_t_budget_convention.rowid = mjl_t_budget.fk_convention AND mjl_t_budget_convention.entity = mjl_t_budget.entity WHERE mjl_t_budget.rowid = {$auditAlias}.object_id AND mjl_t_budget.entity = {$auditAlias}.entity AND mjl_t_budget.entity = {$entity} AND mjl_t_budget_convention.entity = {$entity}".sprintf($scopeSql, 'mjl_t_budget_convention.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_fund_receipt' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_fund_receipt mjl_t_receipt WHERE mjl_t_receipt.rowid = {$auditAlias}.object_id AND mjl_t_receipt.entity = {$auditAlias}.entity AND mjl_t_receipt.entity = {$entity}".sprintf($scopeSql, 'mjl_t_receipt.fk_soc').'))';
	if ($isAdmin) {
		$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_report' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_report mjl_t_report WHERE mjl_t_report.rowid = {$auditAlias}.object_id AND mjl_t_report.entity = {$auditAlias}.entity AND mjl_t_report.entity = {$entity}))";
	}

	return ' AND ('.implode(' OR ', $clauses).')';
}
