<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

function mjl_activities_can_open($activity)
{
	global $user;

	$row = is_array($activity) ? $activity : (array) $activity;
	if (mjl_workspace_can_access_supervision($user) || mjl_activities_is_readonly_consultation()) {
		return true;
	}
	if (mjl_activities_is_level1_operational()) {
		return (int) $row['fk_user_creat'] === (int) $user->id;
	}
	if ($user->hasRight('mjlfinancement', 'activity', 'validate')) {
		return (int) $row['status'] === MjlActivity::STATUS_SUBMITTED || mjl_activities_user_has_workflow_history((int) $row['rowid']);
	}
	return true;
}

function mjl_activities_can_apply_action($activity, $action)
{
	global $user;

	$row = is_array($activity) ? $activity : (array) $activity;
	$status = (int) $row['status'];
	if ($action === 'upload') {
		if (mjl_activities_is_final_status($status)) return false;
		if (mjl_workspace_can_access_supervision($user)) {
			return $user->hasRight('mjlfinancement', 'activity', 'read');
		}
		return $user->hasRight('mjlfinancement', 'activity', 'write') && (int) $row['fk_user_creat'] === (int) $user->id;
	}
	if (in_array($action, array('update', 'submit', 'correct'), true)) {
		if (!$user->hasRight('mjlfinancement', 'activity', 'write') || (int) $row['fk_user_creat'] !== (int) $user->id) return false;
		if ($action === 'update') return in_array($status, array(MjlActivity::STATUS_DRAFT, MjlActivity::STATUS_CORRECTION_REQUESTED), true);
		if ($action === 'submit') return in_array($status, array(MjlActivity::STATUS_DRAFT, MjlActivity::STATUS_CORRECTED), true);
		return $status === MjlActivity::STATUS_CORRECTION_REQUESTED;
	}
	if (in_array($action, array('validate', 'reject', 'request_correction'), true)) {
		if (!$user->hasRight('mjlfinancement', 'activity', 'validate') || $status !== MjlActivity::STATUS_SUBMITTED) return false;
		if ((int) $row['fk_user_creat'] === (int) $user->id) return false;
		return true;
	}
	return false;
}

function mjl_activities_scope_sql($alias)
{
	global $db, $user;

	$a = preg_replace('/[^A-Za-z0-9_]/', '', $alias);
	if (mjl_workspace_can_access_supervision($user) || mjl_activities_is_readonly_consultation()) {
		return '';
	}
	if (mjl_activities_is_level1_operational()) {
		return ' AND '.$a.'.fk_user_creat = '.((int) $user->id);
	}
	if ($user->hasRight('mjlfinancement', 'activity', 'validate')) {
		return ' AND ('.$a.'.status = '.MjlActivity::STATUS_SUBMITTED.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_workflow_action wscope WHERE wscope.entity = '.$a.'.entity AND wscope.object_type = \'mjlfinancement_activity\' AND wscope.object_id = '.$a.'.rowid AND wscope.actor = '.((int) $user->id).'))';
	}
	return '';
}

function mjl_activities_is_level1_operational()
{
	global $user;
	return $user->hasRight('mjlfinancement', 'activity', 'write') && !$user->hasRight('mjlfinancement', 'activity', 'validate') && !mjl_workspace_can_access_supervision($user);
}

function mjl_activities_is_readonly_consultation()
{
	global $user;
	return !$user->hasRight('mjlfinancement', 'activity', 'write') && !$user->hasRight('mjlfinancement', 'activity', 'validate');
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
	return in_array((int) $status, array(MjlActivity::STATUS_COMPLETED, MjlActivity::STATUS_VALIDATED, MjlActivity::STATUS_REJECTED, MjlActivity::STATUS_CANCELLED), true);
}
