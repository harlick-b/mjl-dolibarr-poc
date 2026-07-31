<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

/**
 * Return the fail-closed partner/programme predicate for workflow audit rows.
 *
 * The caller remains responsible for filtering the audit row itself by active
 * entity. Admin can diagnose missing or unknown targets, but known targets and
 * required convention parents in another entity are always excluded.
 * Non-admin targets must resolve through an entity-matched supported object
 * and one of the user's active partner/programme scopes.
 */
function mjl_traceability_scope_sql($auditAlias, $userObj, $entity = null)
{
	global $db, $conf;

	$auditAlias = preg_replace('/[^A-Za-z0-9_]/', '', (string) $auditAlias);
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if ($auditAlias === '' || $entity <= 0) {
		return ' AND 1=0';
	}

	$isAdmin = mjl_scope_is_platform_admin($userObj, $entity);
	$prefix = $db->prefix();
	if ($isAdmin) {
		$crossEntity = array();
		$crossEntity[] = "({$auditAlias}.object_type = 'mjlfinancement_project' AND EXISTS (SELECT 1 FROM {$prefix}projet mjl_x_project WHERE mjl_x_project.rowid = {$auditAlias}.object_id AND mjl_x_project.entity <> {$auditAlias}.entity))";
		$crossEntity[] = "({$auditAlias}.object_type = 'mjlfinancement_activity' AND (EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_activity mjl_x_activity WHERE mjl_x_activity.rowid = {$auditAlias}.object_id AND mjl_x_activity.entity <> {$auditAlias}.entity) OR EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_activity mjl_x_activity INNER JOIN {$prefix}mjlfinancement_convention mjl_x_activity_convention ON mjl_x_activity_convention.rowid = mjl_x_activity.fk_convention WHERE mjl_x_activity.rowid = {$auditAlias}.object_id AND mjl_x_activity.entity = {$auditAlias}.entity AND mjl_x_activity_convention.entity <> {$auditAlias}.entity)))";
		$crossEntity[] = "({$auditAlias}.object_type = 'mjlfinancement_expense' AND (EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_expense mjl_x_expense WHERE mjl_x_expense.rowid = {$auditAlias}.object_id AND mjl_x_expense.entity <> {$auditAlias}.entity) OR EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_expense mjl_x_expense INNER JOIN {$prefix}mjlfinancement_convention mjl_x_expense_convention ON mjl_x_expense_convention.rowid = mjl_x_expense.fk_convention WHERE mjl_x_expense.rowid = {$auditAlias}.object_id AND mjl_x_expense.entity = {$auditAlias}.entity AND mjl_x_expense_convention.entity <> {$auditAlias}.entity)))";
		$crossEntity[] = "({$auditAlias}.object_type = 'mjlfinancement_convention' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_convention mjl_x_convention WHERE mjl_x_convention.rowid = {$auditAlias}.object_id AND mjl_x_convention.entity <> {$auditAlias}.entity))";
		$crossEntity[] = "({$auditAlias}.object_type = 'mjlfinancement_budget_line' AND (EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_budget_line mjl_x_budget WHERE mjl_x_budget.rowid = {$auditAlias}.object_id AND mjl_x_budget.entity <> {$auditAlias}.entity) OR EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_budget_line mjl_x_budget INNER JOIN {$prefix}mjlfinancement_convention mjl_x_budget_convention ON mjl_x_budget_convention.rowid = mjl_x_budget.fk_convention WHERE mjl_x_budget.rowid = {$auditAlias}.object_id AND mjl_x_budget.entity = {$auditAlias}.entity AND mjl_x_budget_convention.entity <> {$auditAlias}.entity)))";
		$crossEntity[] = "({$auditAlias}.object_type = 'mjlfinancement_fund_receipt' AND (EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_fund_receipt mjl_x_receipt WHERE mjl_x_receipt.rowid = {$auditAlias}.object_id AND mjl_x_receipt.entity <> {$auditAlias}.entity) OR EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_fund_receipt mjl_x_receipt INNER JOIN {$prefix}mjlfinancement_convention mjl_x_receipt_convention ON mjl_x_receipt_convention.rowid = mjl_x_receipt.fk_convention WHERE mjl_x_receipt.rowid = {$auditAlias}.object_id AND mjl_x_receipt.entity = {$auditAlias}.entity AND mjl_x_receipt_convention.entity <> {$auditAlias}.entity)))";
		$crossEntity[] = "({$auditAlias}.object_type = 'mjlfinancement_report' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_report mjl_x_report WHERE mjl_x_report.rowid = {$auditAlias}.object_id AND mjl_x_report.entity <> {$auditAlias}.entity))";
		return ' AND NOT ('.implode(' OR ', $crossEntity).')';
	}

	$scopeIds = mjl_scope_user_soc_ids($userObj, $entity);
	if (empty($scopeIds)) {
		return ' AND 1=0';
	}
	$scope = implode(',', array_map('intval', $scopeIds));
	$scopeSql = " AND %s IN ({$scope})";

	$clauses = array();
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_project' AND EXISTS (SELECT 1 FROM {$prefix}projet mjl_t_project WHERE mjl_t_project.rowid = {$auditAlias}.object_id AND mjl_t_project.entity = {$auditAlias}.entity AND mjl_t_project.entity = {$entity}".sprintf($scopeSql, 'mjl_t_project.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_activity' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_activity mjl_t_activity INNER JOIN {$prefix}mjlfinancement_convention mjl_t_activity_convention ON mjl_t_activity_convention.rowid = mjl_t_activity.fk_convention AND mjl_t_activity_convention.entity = mjl_t_activity.entity WHERE mjl_t_activity.rowid = {$auditAlias}.object_id AND mjl_t_activity.entity = {$auditAlias}.entity AND mjl_t_activity.entity = {$entity} AND mjl_t_activity_convention.entity = {$entity}".sprintf($scopeSql, 'mjl_t_activity_convention.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_expense' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_expense mjl_t_expense INNER JOIN {$prefix}mjlfinancement_convention mjl_t_expense_convention ON mjl_t_expense_convention.rowid = mjl_t_expense.fk_convention AND mjl_t_expense_convention.entity = mjl_t_expense.entity WHERE mjl_t_expense.rowid = {$auditAlias}.object_id AND mjl_t_expense.entity = {$auditAlias}.entity AND mjl_t_expense.entity = {$entity} AND mjl_t_expense_convention.entity = {$entity}".sprintf($scopeSql, 'mjl_t_expense_convention.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_convention' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_convention mjl_t_convention WHERE mjl_t_convention.rowid = {$auditAlias}.object_id AND mjl_t_convention.entity = {$auditAlias}.entity AND mjl_t_convention.entity = {$entity}".sprintf($scopeSql, 'mjl_t_convention.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_budget_line' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_budget_line mjl_t_budget INNER JOIN {$prefix}mjlfinancement_convention mjl_t_budget_convention ON mjl_t_budget_convention.rowid = mjl_t_budget.fk_convention AND mjl_t_budget_convention.entity = mjl_t_budget.entity WHERE mjl_t_budget.rowid = {$auditAlias}.object_id AND mjl_t_budget.entity = {$auditAlias}.entity AND mjl_t_budget.entity = {$entity} AND mjl_t_budget_convention.entity = {$entity}".sprintf($scopeSql, 'mjl_t_budget_convention.fk_soc').'))';
	$clauses[] = "({$auditAlias}.object_type = 'mjlfinancement_fund_receipt' AND EXISTS (SELECT 1 FROM {$prefix}mjlfinancement_fund_receipt mjl_t_receipt INNER JOIN {$prefix}mjlfinancement_convention mjl_t_receipt_convention ON mjl_t_receipt_convention.rowid = mjl_t_receipt.fk_convention AND mjl_t_receipt_convention.entity = mjl_t_receipt.entity WHERE mjl_t_receipt.rowid = {$auditAlias}.object_id AND mjl_t_receipt.entity = {$auditAlias}.entity AND mjl_t_receipt.entity = {$entity} AND mjl_t_receipt_convention.entity = {$entity}".sprintf($scopeSql, 'mjl_t_receipt_convention.fk_soc').'))';
	return ' AND ('.implode(' OR ', $clauses).')';
}
