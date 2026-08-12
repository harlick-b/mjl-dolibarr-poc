<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

function mjl_activities_can_open($activity)
{
	global $user;

	$row = is_array($activity) ? $activity : (array) $activity;
	return mjl_workspace_can_access_activity($user)
		&& mjl_activities_has_consistent_active_entity_parents(mjl_activities_row_id($row));
}

function mjl_activities_can_apply_action($activity, $action)
{
	return false;
}

function mjl_activities_scope_sql($alias)
{
	global $user;

	if (!mjl_workspace_can_access_activity($user)) {
		return ' AND 1=0';
	}
	return mjl_activities_integrity_sql($alias);
}

function mjl_activities_integrity_sql($alias)
{
	global $db;

	$a = preg_replace('/[^A-Za-z0-9_]/', '', (string) $alias);
	if ($a === '') return ' AND 1=0';
	$sql = ' AND EXISTS (SELECT 1 FROM '.$db->prefix().'projet mjl_activity_project';
	$sql .= ' INNER JOIN '.$db->prefix().'societe mjl_activity_partner ON mjl_activity_partner.rowid = mjl_activity_project.fk_soc AND mjl_activity_partner.entity = mjl_activity_project.entity';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention mjl_activity_convention ON mjl_activity_convention.rowid = '.$a.'.fk_convention AND mjl_activity_convention.entity = '.$a.'.entity';
	$sql .= ' AND mjl_activity_convention.fk_project = '.$a.'.fk_project AND mjl_activity_convention.fk_soc = mjl_activity_project.fk_soc';
	$sql .= ' WHERE mjl_activity_project.rowid = '.$a.'.fk_project AND mjl_activity_project.entity = '.$a.'.entity)';
	$sql .= ' AND ('.$a.'.fk_task IS NULL OR '.$a.'.fk_task = 0 OR EXISTS (SELECT 1 FROM '.$db->prefix().'projet_task mjl_activity_task';
	$sql .= ' WHERE mjl_activity_task.rowid = '.$a.'.fk_task AND mjl_activity_task.entity = '.$a.'.entity AND mjl_activity_task.fk_projet = '.$a.'.fk_project))';
	return $sql;
}

function mjl_activities_has_consistent_active_entity_parents($activityId)
{
	global $db, $conf;

	$activityId = (int) $activityId;
	if ($activityId <= 0) return false;
	$sql = 'SELECT a.rowid FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' WHERE a.rowid = '.$activityId.' AND a.entity = '.((int) $conf->entity);
	$sql .= mjl_activities_integrity_sql('a').' LIMIT 1';
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_activities_is_level1_operational()
{
	return false;
}

function mjl_activities_is_readonly_consultation()
{
	global $user;
	return mjl_workspace_can_access_activity($user);
}

function mjl_activities_is_final_status($status)
{
	return in_array((int) $status, MjlActivity::finalStatuses(), true);
}

function mjl_activities_user_owns_or_responsible($activity, User $targetUser)
{
	return false;
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
	return false;
}
