<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

function mjl_workspace_is_admin(User $targetUser)
{
	return mjl_scope_is_platform_admin($targetUser);
}

function mjl_workspace_is_level3(User $targetUser)
{
	return mjl_scope_is_final_validator($targetUser);
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
		&& mjl_workspace_user_has_production_access($targetUser)
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
		&& ($capabilities['admin'] || $capabilities['reviewer'] || $capabilities['supervision']);
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
	return $capabilities['admin'] || $capabilities['supervision'];
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
	if (!mjl_workspace_user_has_production_access($targetUser)) {
		return false;
	}
	$rights = array('convention', 'activity', 'budgetline', 'expense', 'fundreceipt', 'validation', 'workflowaction', 'exchangelog', 'report', 'export');
	foreach ($rights as $right) {
		if ($targetUser->hasRight('mjlfinancement', $right, 'read')) {
			return true;
		}
	}
	return false;
}

function mjl_workspace_user_can_enter(User $targetUser)
{
	return mjl_workspace_user_has_production_access($targetUser) && mjl_workspace_user_can_read($targetUser);
}

function mjl_workspace_can_access_projects(User $targetUser)
{
	return mjl_workspace_user_has_production_access($targetUser)
		&& ($targetUser->hasRight('mjlfinancement', 'activity', 'read')
		|| $targetUser->hasRight('mjlfinancement', 'expense', 'read')
		|| $targetUser->hasRight('mjlfinancement', 'convention', 'read')
		|| $targetUser->hasRight('mjlfinancement', 'budgetline', 'read')
		|| $targetUser->hasRight('mjlfinancement', 'fundreceipt', 'read'));
}

function mjl_workspace_can_access_partners(User $targetUser)
{
	return mjl_workspace_user_has_production_access($targetUser)
		&& ($targetUser->hasRight('mjlfinancement', 'activity', 'read')
		|| $targetUser->hasRight('mjlfinancement', 'expense', 'read')
		|| $targetUser->hasRight('mjlfinancement', 'convention', 'read')
		|| $targetUser->hasRight('mjlfinancement', 'budgetline', 'read')
		|| $targetUser->hasRight('mjlfinancement', 'fundreceipt', 'read'));
}

function mjl_workspace_require_partners_access(User $targetUser)
{
	if (!mjl_workspace_can_access_partners($targetUser)) {
		accessforbidden();
	}
}

function mjl_workspace_require_projects_access(User $targetUser)
{
	if (!mjl_workspace_can_access_projects($targetUser)) {
		accessforbidden();
	}
}

function mjl_workspace_can_access_documents(User $targetUser)
{
	return mjl_workspace_user_has_production_access($targetUser)
		&& ($targetUser->hasRight('mjlfinancement', 'activity', 'read')
		|| $targetUser->hasRight('mjlfinancement', 'expense', 'read')
		|| mjl_workspace_can_access_reference_data($targetUser, 'convention')
		|| mjl_workspace_can_access_reference_data($targetUser, 'fundreceipt'));
}

function mjl_workspace_require_documents_access(User $targetUser)
{
	if (!mjl_workspace_can_access_documents($targetUser)) {
		accessforbidden();
	}
}

function mjl_workspace_show_internal_roadmap()
{
	if (function_exists('getDolGlobalString')) {
		return getDolGlobalString('MJL_SHOW_INTERNAL_ROADMAP') === '1';
	}
	global $conf;
	return !empty($conf->global->MJL_SHOW_INTERNAL_ROADMAP) && (string) $conf->global->MJL_SHOW_INTERNAL_ROADMAP === '1';
}

function mjl_workspace_can_access_roadmap(User $targetUser)
{
	return mjl_workspace_is_admin($targetUser) && mjl_workspace_show_internal_roadmap();
}

function mjl_workspace_require_roadmap_access(User $targetUser)
{
	if (!mjl_workspace_can_access_roadmap($targetUser)) {
		if (function_exists('http_response_code')) {
			http_response_code(404);
		}
		accessforbidden();
	}
}

function mjl_workspace_capabilities(User $targetUser)
{
	$hasProductionAccess = mjl_workspace_user_has_production_access($targetUser);
	$isAdmin = mjl_workspace_is_admin($targetUser);
	$isInputAgent = mjl_scope_is_input_agent($targetUser);
	$isBusinessValidator = mjl_scope_can_apply_business_validation($targetUser);
	$isFinalValidator = mjl_scope_is_final_validator($targetUser);
	return array(
		'admin' => $isAdmin,
		'operational' => $hasProductionAccess && $isInputAgent && ($targetUser->hasRight('mjlfinancement', 'activity', 'write') || $targetUser->hasRight('mjlfinancement', 'expense', 'write')),
		'reviewer' => $hasProductionAccess && $isBusinessValidator && ($targetUser->hasRight('mjlfinancement', 'activity', 'validate') || $targetUser->hasRight('mjlfinancement', 'expense', 'validate')),
		'supervision' => $hasProductionAccess && ($isAdmin || $isFinalValidator),
		'readonly' => $hasProductionAccess && mjl_workspace_user_can_read($targetUser),
		'activity_read' => $hasProductionAccess && $targetUser->hasRight('mjlfinancement', 'activity', 'read') && ($isAdmin || $isInputAgent || $isBusinessValidator || $isFinalValidator),
		'expense_read' => $hasProductionAccess && $targetUser->hasRight('mjlfinancement', 'expense', 'read') && ($isAdmin || $isInputAgent || $isBusinessValidator || $isFinalValidator),
		'validation_read' => $hasProductionAccess && $targetUser->hasRight('mjlfinancement', 'validation', 'read') && ($isAdmin || $isBusinessValidator || $isFinalValidator),
		'workflowaction_read' => $hasProductionAccess && $targetUser->hasRight('mjlfinancement', 'workflowaction', 'read') && ($isAdmin || $isBusinessValidator || $isFinalValidator),
		'exchangelog_read' => $hasProductionAccess && $targetUser->hasRight('mjlfinancement', 'exchangelog', 'read') && ($isAdmin || $isFinalValidator),
		'partners_read' => mjl_workspace_can_access_partners($targetUser),
		'projects_read' => mjl_workspace_can_access_projects($targetUser),
		'documents_read' => mjl_workspace_can_access_documents($targetUser),
		'roadmap_read' => mjl_workspace_can_access_roadmap($targetUser),
	);
}

function mjl_workspace_user_has_production_access(User $targetUser)
{
	if (empty($targetUser->id)) {
		return false;
	}
	return mjl_scope_is_platform_admin($targetUser) || mjl_scope_user_has_active_business_role((int) $targetUser->id);
}

function mjl_workspace_can_access_activity(User $targetUser)
{
	return mjl_workspace_capabilities($targetUser)['activity_read'];
}

function mjl_workspace_can_access_expense(User $targetUser)
{
	return mjl_workspace_capabilities($targetUser)['expense_read'];
}

function mjl_workspace_can_apply_activity_write(User $targetUser)
{
	return mjl_scope_business_role_can_write($targetUser) && $targetUser->hasRight('mjlfinancement', 'activity', 'write');
}

function mjl_workspace_can_apply_expense_write(User $targetUser)
{
	return mjl_scope_business_role_can_write($targetUser) && $targetUser->hasRight('mjlfinancement', 'expense', 'write');
}

function mjl_workspace_can_apply_activity_validation(User $targetUser)
{
	return (mjl_scope_is_verifier($targetUser) && $targetUser->hasRight('mjlfinancement', 'activity', 'validate')) || mjl_scope_is_final_validator($targetUser);
}

function mjl_workspace_can_apply_expense_validation(User $targetUser)
{
	return mjl_scope_can_apply_business_validation($targetUser) && $targetUser->hasRight('mjlfinancement', 'expense', 'validate');
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
		$metrics['activities_submitted'] = mjl_workspace_activity_count(mjl_scope_is_final_validator($targetUser) ? MjlActivity::finalReviewStatuses() : MjlActivity::verifierReviewStatuses());
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
	$sql = 'SELECT e.rowid, e.entity, e.supporting_document FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' AND e.fk_user_creat = '.((int) $targetUser->id);
	$sql .= ' AND e.status IN ('.implode(',', array_map('intval', $statuses)).')';
	$resql = $db->query($sql);
	if (!$resql) {
		return 0;
	}
	$count = 0;
	while ($row = $db->fetch_object($resql)) {
		if (mjl_expense_evidence_state((int) $row->rowid, (int) $row->entity, $row->supporting_document) !== 'downloadable') {
			$count++;
		}
	}
	return $count;
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

	$openStatuses = MjlActivity::openStatuses();
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
