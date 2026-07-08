<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

function mjl_activities_can_open($activity)
{
	global $user;

	$row = is_array($activity) ? $activity : (array) $activity;
	$activityId = mjl_activities_row_id($row);
	if (!mjl_scope_can_access_object($user, 'mjlfinancement_activity', $activityId)) {
		return false;
	}
	if (mjl_workspace_can_access_supervision($user) || mjl_activities_is_readonly_consultation()) {
		return true;
	}
	if (mjl_activities_is_level1_operational()) {
		return mjl_activities_user_owns_or_responsible($row, $user);
	}
	if (mjl_workspace_can_apply_activity_validation($user)) {
		return mjl_activities_is_review_status_for_user((int) $row['status'], $user) || mjl_activities_user_has_workflow_history($activityId);
	}
	return true;
}

function mjl_activities_can_apply_action($activity, $action)
{
	global $user;

	$row = is_array($activity) ? $activity : (array) $activity;
	$status = (int) $row['status'];
	if (!mjl_scope_can_access_object($user, 'mjlfinancement_activity', mjl_activities_row_id($row))) {
		return false;
	}
	if ($action === 'upload') {
		if (mjl_activities_is_final_status($status)) return false;
		if (mjl_workspace_can_access_supervision($user)) {
			return mjl_workspace_can_apply_activity_write($user);
		}
		return mjl_workspace_can_apply_activity_write($user) && mjl_activities_user_owns_or_responsible($row, $user);
	}
	if (in_array($action, array('update', 'submit', 'correct'), true)) {
		if (!mjl_workspace_can_apply_activity_write($user) || !mjl_activities_user_owns_or_responsible($row, $user)) return false;
		if ($action === 'update') return in_array($status, MjlActivity::editableStatuses(), true);
		if ($action === 'submit') return in_array($status, MjlActivity::submitStatuses(), true);
		return $status === MjlActivity::STATUS_CORRECTION_REQUESTED;
	}
	if (in_array($action, array('prevalidate', 'final_validate', 'validate', 'reject', 'request_correction'), true)) {
		if (!mjl_workspace_can_apply_activity_validation($user) || !mjl_activities_is_review_status_for_user($status, $user)) return false;
		if (mjl_activities_user_owns_or_responsible($row, $user)) return false;
		if ($action === 'prevalidate') return mjl_scope_is_verifier($user) && $status === MjlActivity::STATUS_SUBMITTED;
		if ($action === 'final_validate') return mjl_scope_is_final_validator($user) && $status === MjlActivity::STATUS_PREVALIDATED;
		if ($action === 'validate') return ($status === MjlActivity::STATUS_SUBMITTED && mjl_scope_is_verifier($user)) || ($status === MjlActivity::STATUS_PREVALIDATED && mjl_scope_is_final_validator($user));
		return true;
	}
	return false;
}

function mjl_activities_scope_sql($alias)
{
	global $db, $user;

	$a = preg_replace('/[^A-Za-z0-9_]/', '', $alias);
	if (mjl_workspace_can_access_supervision($user) || mjl_activities_is_readonly_consultation()) {
		return mjl_scope_partner_sql_filter('c.fk_soc', $user);
	}
	$scopeFilter = mjl_scope_partner_sql_filter('c.fk_soc', $user);
	if (mjl_activities_is_level1_operational()) {
		return $scopeFilter.' AND ('.$a.'.fk_user_creat = '.((int) $user->id).' OR '.$a.'.fk_user_responsible = '.((int) $user->id).')';
	}
	if (mjl_workspace_can_apply_activity_validation($user)) {
		$reviewStatuses = mjl_scope_is_final_validator($user) ? MjlActivity::finalReviewStatuses() : MjlActivity::verifierReviewStatuses();
		return $scopeFilter.' AND ('.$a.'.status IN ('.implode(',', array_map('intval', $reviewStatuses)).') OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_workflow_action wscope WHERE wscope.entity = '.$a.'.entity AND wscope.object_type = \'mjlfinancement_activity\' AND wscope.object_id = '.$a.'.rowid AND wscope.actor = '.((int) $user->id).'))';
	}
	return $scopeFilter;
}

function mjl_activities_is_level1_operational()
{
	global $user;
	return mjl_workspace_can_apply_activity_write($user) && !$user->hasRight('mjlfinancement', 'activity', 'validate') && !mjl_workspace_can_access_supervision($user);
}

function mjl_activities_is_readonly_consultation()
{
	global $user;
	return !mjl_workspace_can_apply_activity_write($user) && !mjl_workspace_can_apply_activity_validation($user);
}

function mjl_activities_user_has_workflow_history($activityId)
{
	global $db, $conf, $user;
	$sql = 'SELECT rowid FROM '.$db->prefix().'mjlfinancement_workflow_action';
	$sql .= ' WHERE entity = '.((int) $conf->entity).' AND object_type = \'mjlfinancement_activity\' AND object_id = '.((int) $activityId).' AND actor = '.((int) $user->id).' LIMIT 1';
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_activities_is_final_status($status)
{
	return in_array((int) $status, MjlActivity::finalStatuses(), true);
}

function mjl_activities_user_owns_or_responsible($activity, User $targetUser)
{
	$row = is_array($activity) ? $activity : (array) $activity;
	return (int) $row['fk_user_creat'] === (int) $targetUser->id || (!empty($row['fk_user_responsible']) && (int) $row['fk_user_responsible'] === (int) $targetUser->id);
}

function mjl_activities_row_id($activity)
{
	$row = is_array($activity) ? $activity : (array) $activity;
	if (!empty($row['rowid'])) return (int) $row['rowid'];
	if (!empty($row['id'])) return (int) $row['id'];
	return 0;
}

function mjl_activities_is_review_status_for_user($status, User $targetUser)
{
	$status = (int) $status;
	if (mjl_scope_is_final_validator($targetUser)) {
		return in_array($status, MjlActivity::finalReviewStatuses(), true);
	}
	if (mjl_scope_is_verifier($targetUser)) {
		return in_array($status, MjlActivity::verifierReviewStatuses(), true);
	}
	return false;
}
