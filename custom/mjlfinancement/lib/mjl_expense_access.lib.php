<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

function mjl_expenses_can_open($expense)
{
	global $user;

	$row = is_array($expense) ? $expense : (array) $expense;
	if (!mjl_scope_can_access_object($user, 'mjlfinancement_expense', (int) $row['rowid'])) {
		return false;
	}
	if (mjl_workspace_can_access_supervision($user) || mjl_expenses_is_readonly_consultation()) {
		return true;
	}
	if (mjl_expenses_is_level1_operational()) {
		return (int) $row['fk_user_creat'] === (int) $user->id;
	}
	if ($user->hasRight('mjlfinancement', 'expense', 'validate')) {
		$reviewStatuses = mjl_scope_is_final_validator($user) ? array_merge(mjl_expense_pending_final_validator_statuses(), array(MjlExpense::STATUS_FINAL_VALIDATED, MjlExpense::STATUS_VALIDATED)) : mjl_expense_pending_verifier_statuses();
		return in_array((int) $row['status'], $reviewStatuses, true) || mjl_expenses_user_has_validation_history((int) $row['rowid']);
	}
	return true;
}

function mjl_expenses_scope_sql($alias)
{
	global $db, $user;

	$a = preg_replace('/[^A-Za-z0-9_]/', '', $alias);
	if (mjl_workspace_can_access_supervision($user) || mjl_expenses_is_readonly_consultation()) {
		return mjl_scope_partner_sql_filter('c.fk_soc', $user);
	}
	$scopeFilter = mjl_scope_partner_sql_filter('c.fk_soc', $user);
	if (mjl_expenses_is_level1_operational()) {
		return $scopeFilter.' AND '.$a.'.fk_user_creat = '.((int) $user->id);
	}
	if ($user->hasRight('mjlfinancement', 'expense', 'validate')) {
		$reviewStatuses = mjl_scope_is_final_validator($user) ? array_merge(mjl_expense_pending_final_validator_statuses(), array(MjlExpense::STATUS_FINAL_VALIDATED, MjlExpense::STATUS_VALIDATED)) : mjl_expense_pending_verifier_statuses();
		return $scopeFilter.' AND ('.$a.'.status IN ('.mjl_expense_status_sql_list($reviewStatuses).') OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_validation vscope WHERE vscope.entity = '.$a.'.entity AND vscope.fk_expense = '.$a.'.rowid AND vscope.fk_user_action = '.((int) $user->id).'))';
	}
	return $scopeFilter;
}

function mjl_expenses_requires_own_scope(User $targetUser)
{
	$capabilities = mjl_workspace_capabilities($targetUser);
	return $capabilities['operational']
		&& !mjl_workspace_can_apply_expense_validation($targetUser)
		&& !$capabilities['supervision']
		&& !$capabilities['admin'];
}

function mjl_expenses_is_level1_operational()
{
	global $user;
	return mjl_workspace_can_apply_expense_write($user) && !mjl_workspace_can_apply_expense_validation($user) && !mjl_workspace_can_access_supervision($user);
}

function mjl_expenses_is_readonly_consultation()
{
	global $user;
	return !mjl_workspace_can_apply_expense_write($user) && !mjl_workspace_can_apply_expense_validation($user);
}

function mjl_expenses_user_has_validation_history($expenseId)
{
	global $db, $conf, $user;
	$sql = 'SELECT rowid FROM '.$db->prefix().'mjlfinancement_validation';
	$sql .= ' WHERE entity = '.((int) $conf->entity).' AND fk_expense = '.((int) $expenseId).' AND fk_user_action = '.((int) $user->id).' LIMIT 1';
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_expenses_scope_label()
{
	global $user;
	if (mjl_workspace_can_access_supervision($user)) return 'Portefeuille MJL';
	if (mjl_expenses_is_level1_operational()) return 'Mes depenses';
	if (mjl_workspace_can_apply_expense_validation($user)) return 'File de validation';
	return 'Consultation';
}
