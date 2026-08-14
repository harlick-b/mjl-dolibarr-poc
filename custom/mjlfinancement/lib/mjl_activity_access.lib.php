<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

function mjl_activity_access_can_read(User $targetUser, $entity = null)
{
	global $conf;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	return $entity > 0
		&& (int) $targetUser->entity === $entity
		&& (mjl_scope_is_verifier($targetUser, $entity) || mjl_scope_is_final_validator($targetUser, $entity));
}

function mjl_activity_access_require_read(User $targetUser, $entity = null)
{
	if (!mjl_activity_access_can_read($targetUser, $entity)) {
		http_response_code(403);
		accessforbidden();
	}
}

function mjl_activity_access_can_mutate(User $targetUser, $entity = null) { return false; }
function mjl_activity_access_require_mutation(User $targetUser, $entity = null) { http_response_code(403); accessforbidden(); }
