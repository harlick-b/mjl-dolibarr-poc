<?php

function mjl_integrity_set_error($message)
{
	global $mjl_integrity_error;

	$mjl_integrity_error = $message;
	return -1;
}

function mjl_integrity_error()
{
	global $mjl_integrity_error;

	return empty($mjl_integrity_error) ? '' : $mjl_integrity_error;
}

function mjl_expense_status_label($status)
{
	$map = array(
		0 => 'draft',
		1 => 'submitted',
		2 => 'validated',
		3 => 'corrected',
		8 => 'rejected',
	);
	$status = (int) $status;
	return isset($map[$status]) ? $map[$status] : (string) $status;
}

function mjl_expense_is_audited_status($status)
{
	return in_array((int) $status, array(2, 3, 8), true);
}

function mjl_has_expense_validation_history($expenseId, $entity = null)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_validation';
	$sql .= ' WHERE fk_expense = '.((int) $expenseId);
	if ($entity !== null) {
		$sql .= ' AND entity = '.((int) $entity);
	}

	$resql = $db->query($sql);
	if (!$resql) {
		return mjl_integrity_set_error($db->lasterror());
	}

	$obj = $db->fetch_object($resql);
	return $obj && (int) $obj->nb > 0 ? 1 : 0;
}

function mjl_record_expense_validation_event($expense, $fromStatus, $toStatus, User $user, $actionDate)
{
	global $db;

	$expenseId = (int) ($expense->id ?: $expense->rowid);
	if ($expenseId <= 0) {
		return mjl_integrity_set_error('Missing expense id for validation event');
	}

	$entity = (int) $expense->entity;
	if ($entity <= 0) {
		return mjl_integrity_set_error('Missing expense entity for validation event');
	}

	$ref = 'VAL-EXP-'.$expenseId.'-'.date('YmdHis', $actionDate).'-'.((int) $user->id);
	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_validation';
	$sql .= ' (entity, ref, fk_expense, action, from_status, to_status, fk_user_action, action_date, date_creation, fk_user_creat, import_key)';
	$sql .= ' VALUES (';
	$sql .= $entity;
	$sql .= ", '".$db->escape($ref)."'";
	$sql .= ', '.$expenseId;
	$sql .= ", 'validated'";
	$sql .= ", '".$db->escape(mjl_expense_status_label($fromStatus))."'";
	$sql .= ", '".$db->escape(mjl_expense_status_label($toStatus))."'";
	$sql .= ', '.((int) $user->id);
	$sql .= ", '".$db->idate($actionDate)."'";
	$sql .= ", '".$db->idate(dol_now())."'";
	$sql .= ', '.((int) $user->id);
	$sql .= ', '.mjl_integrity_sql_string($expense->import_key);
	$sql .= ')';

	if (!$db->query($sql)) {
		return mjl_integrity_set_error($db->lasterror());
	}

	return (int) $db->last_insert_id($db->prefix().'mjlfinancement_validation');
}

function mjl_assert_no_budget_overspend_on_validation($expenseId, $budgetLineId, $amount, $entity)
{
	global $db;

	$sql = 'SELECT bl.revised_budget, COALESCE(SUM(CASE WHEN e.status = 2 AND e.rowid <> '.((int) $expenseId).' THEN e.amount ELSE 0 END), 0) AS spent_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.fk_budget_line = bl.rowid AND e.entity = bl.entity';
	$sql .= ' WHERE bl.rowid = '.((int) $budgetLineId).' AND bl.entity = '.((int) $entity);
	$sql .= ' GROUP BY bl.rowid, bl.revised_budget';

	$resql = $db->query($sql);
	if (!$resql) {
		return mjl_integrity_set_error($db->lasterror());
	}

	$obj = $db->fetch_object($resql);
	if (!$obj) {
		return mjl_integrity_set_error('Budget line not found for validation');
	}

	$available = (float) $obj->revised_budget - (float) $obj->spent_amount;
	if ((float) $amount - $available > 0.001) {
		return mjl_integrity_set_error('Expense amount exceeds available budget line balance');
	}

	return 1;
}

function mjl_recalculate_budget_line_amounts($budgetLineIds, $entity = null)
{
	global $db;

	if (!is_array($budgetLineIds)) {
		$budgetLineIds = array($budgetLineIds);
	}
	$ids = array();
	foreach ($budgetLineIds as $budgetLineId) {
		$budgetLineId = (int) $budgetLineId;
		if ($budgetLineId > 0) {
			$ids[$budgetLineId] = $budgetLineId;
		}
	}
	if (empty($ids)) {
		return 1;
	}

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_budget_line bl SET';
	$sql .= ' spent_amount = (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.fk_budget_line = bl.rowid AND e.entity = bl.entity AND e.status = 2)';
	$sql .= ', remaining_amount = COALESCE(bl.revised_budget, 0) - (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.fk_budget_line = bl.rowid AND e.entity = bl.entity AND e.status = 2)';
	$sql .= ' WHERE bl.rowid IN ('.implode(',', $ids).')';
	if ($entity !== null) {
		$sql .= ' AND bl.entity = '.((int) $entity);
	}

	if (!$db->query($sql)) {
		return mjl_integrity_set_error($db->lasterror());
	}

	return 1;
}

function mjl_integrity_sql_string($value)
{
	global $db;

	if ($value === null || $value === '') {
		return 'NULL';
	}

	return "'".$db->escape((string) $value)."'";
}
