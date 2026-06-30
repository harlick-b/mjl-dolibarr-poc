<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';

function mjl_workspace_is_admin(User $targetUser)
{
	return !empty($targetUser->admin);
}

function mjl_workspace_is_level3(User $targetUser)
{
	return mjl_workspace_user_in_group($targetUser, 'MJL POC - DPAF');
}

function mjl_workspace_can_access_supervision(User $targetUser)
{
	return mjl_workspace_is_admin($targetUser) || mjl_workspace_is_level3($targetUser);
}

function mjl_workspace_require_supervision_access(User $targetUser)
{
	if (!mjl_workspace_can_access_supervision($targetUser)) {
		accessforbidden();
	}
}

function mjl_workspace_can_access_reference_data(User $targetUser, $right)
{
	$right = preg_replace('/[^A-Za-z0-9_]/', '', (string) $right);
	return $right !== ''
		&& mjl_workspace_can_access_supervision($targetUser)
		&& $targetUser->hasRight('mjlfinancement', $right, 'read');
}

function mjl_workspace_require_reference_data_access(User $targetUser, $right)
{
	if (!mjl_workspace_can_access_reference_data($targetUser, $right)) {
		accessforbidden();
	}
}

function mjl_workspace_can_access_validation_history(User $targetUser)
{
	$capabilities = mjl_workspace_capabilities($targetUser);
	return $capabilities['validation_read']
		&& ($capabilities['admin'] || $capabilities['reviewer'] || $capabilities['supervision'] || (!$capabilities['operational'] && !$capabilities['reviewer']));
}

function mjl_workspace_require_validation_history_access(User $targetUser)
{
	if (!mjl_workspace_can_access_validation_history($targetUser)) {
		accessforbidden();
	}
}

function mjl_workspace_can_access_advanced_traceability(User $targetUser, $right)
{
	$right = preg_replace('/[^A-Za-z0-9_]/', '', (string) $right);
	if ($right === '' || !$targetUser->hasRight('mjlfinancement', $right, 'read')) {
		return false;
	}
	$capabilities = mjl_workspace_capabilities($targetUser);
	return $capabilities['admin'] || $capabilities['supervision'] || (!$capabilities['operational'] && !$capabilities['reviewer']);
}

function mjl_workspace_require_advanced_traceability_access(User $targetUser, $right)
{
	if (!mjl_workspace_can_access_advanced_traceability($targetUser, $right)) {
		accessforbidden();
	}
}

function mjl_workspace_user_in_group(User $targetUser, $groupName)
{
	global $db, $conf;

	if (empty($targetUser->id)) {
		return false;
	}

	$sql = 'SELECT ug.rowid';
	$sql .= ' FROM '.$db->prefix().'usergroup_user ugu';
	$sql .= ' INNER JOIN '.$db->prefix().'usergroup ug ON ug.rowid = ugu.fk_usergroup';
	$sql .= ' WHERE ugu.entity = '.((int) $conf->entity);
	$sql .= ' AND ug.entity = '.((int) $conf->entity);
	$sql .= ' AND ugu.fk_user = '.((int) $targetUser->id);
	$sql .= " AND ug.nom = '".$db->escape($groupName)."'";
	$sql .= ' LIMIT 1';

	$resql = $db->query($sql);
	if (!$resql) {
		if (function_exists('setEventMessages')) {
			setEventMessages($db->lasterror(), null, 'errors');
		}
		return false;
	}

	return (bool) $db->fetch_object($resql);
}

function mjl_workspace_user_can_read(User $targetUser)
{
	$rights = array('convention', 'activity', 'budgetline', 'expense', 'fundreceipt', 'validation', 'workflowaction', 'exchangelog', 'report');
	foreach ($rights as $right) {
		if ($targetUser->hasRight('mjlfinancement', $right, 'read')) {
			return true;
		}
	}
	return false;
}

function mjl_workspace_capabilities(User $targetUser)
{
	return array(
		'admin' => mjl_workspace_is_admin($targetUser),
		'operational' => $targetUser->hasRight('mjlfinancement', 'activity', 'write') || $targetUser->hasRight('mjlfinancement', 'expense', 'write'),
		'reviewer' => $targetUser->hasRight('mjlfinancement', 'activity', 'validate') || $targetUser->hasRight('mjlfinancement', 'expense', 'validate'),
		'supervision' => mjl_workspace_can_access_supervision($targetUser),
		'readonly' => mjl_workspace_user_can_read($targetUser),
		'activity_read' => $targetUser->hasRight('mjlfinancement', 'activity', 'read'),
		'expense_read' => $targetUser->hasRight('mjlfinancement', 'expense', 'read'),
		'validation_read' => $targetUser->hasRight('mjlfinancement', 'validation', 'read'),
		'workflowaction_read' => $targetUser->hasRight('mjlfinancement', 'workflowaction', 'read'),
		'exchangelog_read' => $targetUser->hasRight('mjlfinancement', 'exchangelog', 'read'),
	);
}

function mjl_workspace_metrics(User $targetUser)
{
	$capabilities = mjl_workspace_capabilities($targetUser);
	$metrics = array(
		'own_activity_drafts' => mjl_workspace_own_activity_drafts($targetUser),
		'own_expenses_submitted' => mjl_workspace_own_expense_count($targetUser, array(MjlExpense::STATUS_SUBMITTED)),
		'own_missing_expense_documents' => mjl_workspace_own_missing_expense_document_count($targetUser),
		'activities_submitted' => 0,
		'expenses_submitted' => 0,
		'overdue_activities' => 0,
		'reports_available' => 0,
		'pending_invitations' => 0,
	);

	if ($capabilities['admin'] || $capabilities['reviewer'] || $capabilities['supervision']) {
		$metrics['activities_submitted'] = mjl_workspace_activity_count(array(MjlActivity::STATUS_SUBMITTED));
		$metrics['expenses_submitted'] = mjl_workspace_expense_review_count($targetUser);
		$metrics['overdue_activities'] = mjl_workspace_overdue_activity_count();
	}
	if ($capabilities['admin'] || $capabilities['supervision']) {
		$metrics['reports_available'] = mjl_workspace_count('mjlfinancement_report');
	}
	if ($capabilities['admin']) {
		$metrics['pending_invitations'] = mjl_workspace_pending_invitation_count();
	}

	return $metrics;
}

function mjl_workspace_own_activity_drafts(User $targetUser)
{
	global $db, $conf;

	$statuses = array(MjlActivity::STATUS_DRAFT, MjlActivity::STATUS_CORRECTION_REQUESTED, MjlActivity::STATUS_CORRECTED);
	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity';
	$sql .= ' WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND fk_user_creat = '.((int) $targetUser->id);
	$sql .= ' AND status IN ('.implode(',', array_map('intval', $statuses)).')';
	return mjl_workspace_scalar($sql);
}

function mjl_workspace_own_expense_count(User $targetUser, $statuses)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_expense';
	$sql .= ' WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND fk_user_creat = '.((int) $targetUser->id);
	$sql .= ' AND status IN ('.implode(',', array_map('intval', $statuses)).')';
	return mjl_workspace_scalar($sql);
}

function mjl_workspace_own_missing_expense_document_count(User $targetUser)
{
	global $db, $conf;

	$statuses = array(MjlExpense::STATUS_DRAFT, MjlExpense::STATUS_CORRECTED, MjlExpense::STATUS_SUBMITTED);
	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.fk_user_creat = '.((int) $targetUser->id);
	$sql .= ' AND e.status IN ('.implode(',', array_map('intval', $statuses)).')';
	$sql .= ' AND NOT '.mjl_expense_document_present_sql('e');
	return mjl_workspace_scalar($sql);
}

function mjl_workspace_activity_count($statuses)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity';
	$sql .= ' WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND status IN ('.implode(',', array_map('intval', $statuses)).')';
	return mjl_workspace_scalar($sql);
}

function mjl_workspace_expense_count($statuses)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_expense';
	$sql .= ' WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND status IN ('.implode(',', array_map('intval', $statuses)).')';
	return mjl_workspace_scalar($sql);
}

function mjl_workspace_expense_review_count(User $targetUser)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_expense';
	$sql .= ' WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND status = '.MjlExpense::STATUS_SUBMITTED;
	if (!mjl_workspace_can_access_supervision($targetUser) && $targetUser->hasRight('mjlfinancement', 'expense', 'validate')) {
		$sql .= ' AND fk_user_creat <> '.((int) $targetUser->id);
	}
	return mjl_workspace_scalar($sql);
}

function mjl_workspace_overdue_activity_count()
{
	global $db, $conf;

	$openStatuses = array(
		MjlActivity::STATUS_DRAFT,
		MjlActivity::STATUS_ONGOING,
		MjlActivity::STATUS_SUBMITTED,
		MjlActivity::STATUS_CORRECTION_REQUESTED,
		MjlActivity::STATUS_CORRECTED,
	);
	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity';
	$sql .= ' WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND status IN ('.implode(',', array_map('intval', $openStatuses)).')';
	$sql .= " AND date_end IS NOT NULL AND date_end < '".$db->escape(date('Y-m-d'))."'";
	return mjl_workspace_scalar($sql);
}

function mjl_workspace_count($table)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().$table.' WHERE entity = '.((int) $conf->entity);
	return mjl_workspace_scalar($sql);
}

function mjl_workspace_pending_invitation_count()
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix()."mjlfinancement_invitation WHERE entity = ".((int) $conf->entity)." AND status = 'sent'";
	return mjl_workspace_scalar($sql);
}

function mjl_workspace_scalar($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		if (function_exists('setEventMessages')) {
			setEventMessages($db->lasterror(), null, 'errors');
		}
		return 0;
	}

	$obj = $db->fetch_object($resql);
	return $obj && isset($obj->nb) ? (int) $obj->nb : 0;
}
