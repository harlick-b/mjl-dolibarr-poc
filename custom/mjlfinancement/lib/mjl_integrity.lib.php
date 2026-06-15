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

function mjl_user_has_right(User $user, $module, $perms, $subperms)
{
	if (!empty($user->admin)) {
		return true;
	}
	if (method_exists($user, 'hasRight')) {
		return $user->hasRight($module, $perms, $subperms);
	}
	return !empty($user->rights->{$module}->{$perms}->{$subperms});
}

function mjl_active_entity()
{
	global $conf;

	$entity = (int) $conf->entity;
	return $entity > 0 ? $entity : 1;
}

function mjl_assert_expense_links($expense, $entity = null)
{
	global $db;

	$entity = $entity === null ? mjl_active_entity() : (int) $entity;
	$projectId = (int) $expense->fk_project;
	$conventionId = (int) $expense->fk_convention;
	$activityId = (int) $expense->fk_mjl_activity;
	$budgetLineId = (int) $expense->fk_budget_line;

	if ($projectId <= 0 || $conventionId <= 0 || $budgetLineId <= 0) {
		return mjl_integrity_set_error('Project, convention and budget line are required');
	}

	$project = mjl_integrity_fetch_row('SELECT rowid FROM '.$db->prefix().'projet WHERE rowid = '.$projectId.' AND entity = '.$entity);
	if (empty($project)) {
		return mjl_integrity_set_error('Project not found in active entity');
	}

	$convention = mjl_integrity_fetch_row('SELECT rowid, fk_project FROM '.$db->prefix().'mjlfinancement_convention WHERE rowid = '.$conventionId.' AND entity = '.$entity);
	if (empty($convention)) {
		return mjl_integrity_set_error('Convention not found in active entity');
	}
	if (!empty($convention['fk_project']) && (int) $convention['fk_project'] !== $projectId) {
		return mjl_integrity_set_error('Convention does not belong to selected project');
	}

	$budgetLine = mjl_integrity_fetch_row('SELECT rowid, fk_project, fk_convention FROM '.$db->prefix().'mjlfinancement_budget_line WHERE rowid = '.$budgetLineId.' AND entity = '.$entity);
	if (empty($budgetLine)) {
		return mjl_integrity_set_error('Budget line not found in active entity');
	}
	if ((int) $budgetLine['fk_project'] !== $projectId || (int) $budgetLine['fk_convention'] !== $conventionId) {
		return mjl_integrity_set_error('Budget line does not belong to selected project and convention');
	}

	if ($activityId > 0) {
		$activity = mjl_integrity_fetch_row('SELECT rowid, fk_project, fk_convention FROM '.$db->prefix().'mjlfinancement_activity WHERE rowid = '.$activityId.' AND entity = '.$entity);
		if (empty($activity)) {
			return mjl_integrity_set_error('Activity not found in active entity');
		}
		if ((int) $activity['fk_project'] !== $projectId || (int) $activity['fk_convention'] !== $conventionId) {
			return mjl_integrity_set_error('Activity does not belong to selected project and convention');
		}
	}

	return 1;
}

function mjl_expense_document_present_sql($expenseAlias = 'e')
{
	global $db;

	$alias = preg_replace('/[^A-Za-z0-9_]/', '', $expenseAlias);
	return "((".$alias.".supporting_document IS NOT NULL AND ".$alias.".supporting_document <> '') OR EXISTS (SELECT 1 FROM ".$db->prefix()."ecm_files mjl_doc WHERE mjl_doc.entity = ".$alias.".entity AND mjl_doc.src_object_type = 'mjlfinancement_expense' AND mjl_doc.src_object_id = ".$alias.".rowid))";
}

function mjl_expense_supporting_document_sql($expenseAlias = 'e')
{
	global $db;

	$alias = preg_replace('/[^A-Za-z0-9_]/', '', $expenseAlias);
	return "COALESCE(NULLIF(".$alias.".supporting_document, ''), (SELECT MAX(mjl_doc.filename) FROM ".$db->prefix()."ecm_files mjl_doc WHERE mjl_doc.entity = ".$alias.".entity AND mjl_doc.src_object_type = 'mjlfinancement_expense' AND mjl_doc.src_object_id = ".$alias.".rowid))";
}

function mjl_expense_has_supporting_document($expenseId, $entity, $supportingDocument)
{
	global $db;

	if (trim((string) $supportingDocument) !== '') {
		return 1;
	}

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'ecm_files';
	$sql .= ' WHERE entity = '.((int) $entity);
	$sql .= " AND src_object_type = 'mjlfinancement_expense'";
	$sql .= ' AND src_object_id = '.((int) $expenseId);
	$resql = $db->query($sql);
	if (!$resql) {
		return mjl_integrity_set_error($db->lasterror());
	}

	$obj = $db->fetch_object($resql);
	return $obj && (int) $obj->nb > 0 ? 1 : 0;
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

function mjl_integrity_fetch_row($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_integrity_set_error($db->lasterror());
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_record_expense_validation_event($expense, $fromStatus, $toStatus, User $user, $actionDate, $action = null, $comment = '')
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

	if ($action === null || $action === '') {
		$action = mjl_expense_status_label($toStatus);
	}
	$ref = 'VAL-EXP-'.$expenseId.'-'.date('YmdHis', $actionDate).'-'.substr(str_replace('.', '', (string) microtime(true)), -6).'-'.((int) $user->id).'-'.strtoupper(substr(preg_replace('/[^a-z0-9]/i', '', $action), 0, 8));
	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_validation';
	$sql .= ' (entity, ref, fk_expense, action, from_status, to_status, fk_user_action, action_date, comment, date_creation, fk_user_creat, import_key)';
	$sql .= ' VALUES (';
	$sql .= $entity;
	$sql .= ", '".$db->escape($ref)."'";
	$sql .= ', '.$expenseId;
	$sql .= ", '".$db->escape($action)."'";
	$sql .= ", '".$db->escape(mjl_expense_status_label($fromStatus))."'";
	$sql .= ", '".$db->escape(mjl_expense_status_label($toStatus))."'";
	$sql .= ', '.((int) $user->id);
	$sql .= ", '".$db->idate($actionDate)."'";
	$sql .= ', '.mjl_integrity_sql_string($comment);
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
