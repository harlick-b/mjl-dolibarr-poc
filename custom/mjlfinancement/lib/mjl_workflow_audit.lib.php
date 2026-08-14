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
	$map = array(
		'AGENT' => 'AGENT_SAISIE',
		'SUPERVISEUR_N1' => 'AGENT_VERIFICATEUR',
		'SUPERVISEUR_N2' => 'AGENT_VERIFICATEUR',
		'DPAF' => 'VALIDATEUR_DEFINITIF',
		'ADMIN' => 'ADMIN_PLATEFORME',
	);
	$actorRole = (string) $actorRole;
	return isset($map[$actorRole]) ? $map[$actorRole] : $actorRole;
}
