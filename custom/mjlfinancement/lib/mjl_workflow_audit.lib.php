<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';

function mjl_workflow_audit_insert($objectType, $objectId, $entity, $statusLabel, User $user, $actorRole, $action, $comment, $changes = array(), $refPrefix = 'WFA-DOC', $importKey = null)
{
	global $db;

	$objectType = (string) $objectType;
	$objectId = (int) $objectId;
	$entity = (int) $entity;
	if ($objectType === '' || $objectId <= 0 || $entity <= 0) {
		return -1;
	}
	$actionDate = dol_now();
	$ref = $refPrefix.'-'.$objectId.'-'.date('YmdHis', $actionDate).'-'.substr(str_replace('.', '', (string) microtime(true)), -6).'-'.((int) $user->id).'-'.strtoupper(substr(preg_replace('/[^a-z0-9]/i', '', (string) $action), 0, 8));

	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_workflow_action';
	$sql .= ' (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, reason, comment, changes_json, date_creation, fk_user_creat, import_key)';
	$sql .= ' VALUES (';
	$sql .= $entity;
	$sql .= ", '".$db->escape($ref)."'";
	$sql .= ", '".$db->escape($objectType)."'";
	$sql .= ', '.$objectId;
	$sql .= ", '".$db->escape((string) $action)."'";
	$sql .= ', '.mjl_integrity_sql_string($statusLabel);
	$sql .= ', '.mjl_integrity_sql_string($statusLabel);
	$sql .= ', '.((int) $user->id);
	$sql .= ", '".$db->escape((string) $actorRole)."'";
	$sql .= ", '".$db->idate($actionDate)."'";
	$sql .= ', '.mjl_integrity_sql_string($comment);
	$sql .= ', '.mjl_integrity_sql_string($comment);
	$sql .= ", '".$db->escape(json_encode($changes))."'";
	$sql .= ", '".$db->idate(dol_now())."'";
	$sql .= ', '.((int) $user->id);
	$sql .= ', '.mjl_integrity_sql_string($importKey);
	$sql .= ')';

	if (!$db->query($sql)) {
		return -1;
	}
	return (int) $db->last_insert_id($db->prefix().'mjlfinancement_workflow_action');
}
