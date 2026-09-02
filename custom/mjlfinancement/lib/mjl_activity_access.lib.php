<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/activity_schema_installer.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst006a_schema.lib.php';

function mjl_activity_access_assignment_schema_ready()
{
	global $db;
	try {
		if (mjl_rst006a_detect_schema($db) === RST006A_SCHEMA_TARGET) mjl_rst006a_require_target($db);
		else mjl_rst002b_require_target_objects($db);
		return true;
	}
	catch (Throwable $exception) { return false; }
}

function mjl_activity_access_can_enter_list(User $targetUser)
{
	global $conf;
	$entity = (int) $conf->entity;
	if ($entity <= 0 || (int) $targetUser->entity !== $entity) return false;
	if (mjl_scope_is_verifier($targetUser, $entity) || mjl_scope_is_final_validator($targetUser, $entity)) return true;
	return mjl_scope_is_input_agent($targetUser, $entity) && mjl_activity_access_assignment_schema_ready();
}

function mjl_activity_access_can_read_activity(User $targetUser, $activityId)
{
	global $db, $conf;
	$activityId = (int) $activityId;
	$entity = (int) $conf->entity;
	if ($activityId <= 0 || !mjl_activity_access_can_enter_list($targetUser)) return false;
	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().'mjlfinancement_activity a';
	if (mjl_scope_is_input_agent($targetUser, $entity)) {
		$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_activity_assignment aa ON aa.entity=a.entity AND aa.fk_activity=a.rowid';
		$sql .= ' AND aa.fk_user='.((int) $targetUser->id).' AND aa.date_end IS NULL';
	}
	$sql .= ' WHERE a.entity='.$entity.' AND a.rowid='.$activityId;
	$resql = $db->query($sql);
	$row = $resql ? $db->fetch_object($resql) : null;
	return $row && (int) $row->nb === 1;
}

function mjl_activity_access_require_read(User $targetUser)
{
	if (!mjl_activity_access_can_enter_list($targetUser)) {
		http_response_code(403);
		accessforbidden();
	}
}

function mjl_activity_access_can_read(User $targetUser, $entity = null)
{
	global $conf;
	if ($entity !== null && (int) $entity !== (int) $conf->entity) return false;
	return mjl_activity_access_can_enter_list($targetUser);
}

function mjl_activity_access_can_mutate(User $targetUser, $entity = null)
{
	global $conf;
	if ($entity !== null && (int) $entity !== (int) $conf->entity) return false;
	return mjl_scope_is_input_agent($targetUser, (int) $conf->entity) || mjl_scope_is_verifier($targetUser, (int) $conf->entity) || mjl_scope_is_final_validator($targetUser, (int) $conf->entity);
}
function mjl_activity_access_require_mutation(User $targetUser, $entity = null) { if (!mjl_activity_access_can_mutate($targetUser, $entity)) { http_response_code(403); accessforbidden(); } }
