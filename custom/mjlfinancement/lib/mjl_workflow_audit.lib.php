<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit.lib.php';

function mjl_workflow_audit_insert($objectType, $objectId, $entity, $statusLabel, User $user, $actorRole, $action, $comment, $changes = array(), $refPrefix = 'WFA-DOC', $importKey = null)
{
	global $db;

	$objectType = (string) $objectType;
	$objectId = (int) $objectId;
	$entity = (int) $entity;
	if ($objectType === '' || $objectId <= 0 || $entity <= 0) {
		return -1;
	}
	$actorRole = mjl_workflow_audit_actor_role_code($actorRole);
	return mjl_audit_append_in_transaction($db, array(
		'entity' => $entity,
		'object_type' => $objectType,
		'object_id' => $objectId,
		'actor' => $user,
		'actor_role_snapshot' => $actorRole,
		'action' => (string) $action,
		'state_before' => (string) $statusLabel,
		'state_after' => (string) $statusLabel,
		'reason' => (string) $comment,
		'new_values' => $changes,
		'result' => 'SUCCESS',
		'context' => array('legacy_ref_prefix' => $refPrefix, 'import_key' => $importKey),
	));
}

function mjl_workflow_audit_actor_role_code($actorRole)
{
	$actorRole = (string) $actorRole;
	$allowed = array('AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF', 'ADMIN_PLATEFORME');
	return in_array($actorRole, $allowed, true) ? $actorRole : 'SYSTEM';
}
