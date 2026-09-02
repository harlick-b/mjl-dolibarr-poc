<?php

/**
 * Append-only audit module.
 *
 * Successful events may only be appended inside the caller's transaction.
 * Denied/failed outcomes, which have no committed business mutation, use the
 * standalone interface below.
 */

function mjl_audit_sensitive_key($key)
{
	return preg_match('/(?:password|passwd|token|secret|session|cookie|authorization|api[_-]?key|private[_-]?key)/i', (string) $key) === 1;
}

function mjl_audit_sanitize_value($value)
{
	if (is_string($value)) {
		$value = preg_replace('/([?#&](?:verifier|token|secret|password)=)[^&\s]*/i', '$1[REDACTED]', $value);
		$value = preg_replace('/(authorization\s*:\s*bearer\s+)[^\s]+/i', '$1[REDACTED]', $value);
		$value = preg_replace('/((?:password|passwd|token|secret|api[_-]?key)\s*[:=]\s*)[^\s;,]+/i', '$1[REDACTED]', $value);
		return $value;
	}
	if (!is_array($value)) {
		return $value;
	}
	$clean = array();
	foreach ($value as $key => $item) {
		if (mjl_audit_sensitive_key($key)) {
			continue;
		}
		$clean[$key] = mjl_audit_sanitize_value($item);
	}
	return $clean;
}

function mjl_audit_encode_json($value, &$ok)
{
	$ok = true;
	if ($value === null || $value === array()) {
		return null;
	}
	$json = json_encode(mjl_audit_sanitize_value($value), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	$ok = $json !== false && json_last_error() === JSON_ERROR_NONE;
	return $ok ? $json : null;
}

function mjl_audit_json($value)
{
	$ok = false;
	return mjl_audit_encode_json($value, $ok);
}

function mjl_audit_actor_snapshot($actor)
{
	if (!is_object($actor) || empty($actor->id)) {
		return array(null, 'Système', 'SYSTEM');
	}
	$name = trim(trim((string) $actor->firstname).' '.trim((string) $actor->lastname));
	if ($name === '') {
		$name = trim((string) $actor->login);
	}
	if ($name === '') {
		$name = 'Utilisateur '.$actor->id;
	}
	$role = function_exists('mjl_scope_effective_role_code') ? mjl_scope_effective_role_code($actor) : '';
	return array((int) $actor->id, $name, $role !== '' ? $role : 'SYSTEM');
}

function mjl_audit_sql_value(DoliDB $db, $value)
{
	return $value === null || $value === '' ? 'NULL' : "'".$db->escape((string) $value)."'";
}

function mjl_audit_append_in_transaction(DoliDB $db, array $event)
{
	if ($db->transaction_opened <= 0) {
		return -1;
	}
	$event['result'] = isset($event['result']) ? strtoupper((string) $event['result']) : 'SUCCESS';
	if (!in_array($event['result'], array('SUCCESS', 'DENIED', 'FAILED'), true)) {
		return -1;
	}
	return mjl_audit_insert($db, $event);
}

function mjl_audit_record_outcome(DoliDB $db, array $event)
{
	if ($db->transaction_opened > 0) return -1;
	$event['result'] = isset($event['result']) ? strtoupper((string) $event['result']) : 'FAILED';
	if (!in_array($event['result'], array('DENIED', 'FAILED'), true)) {
		return -1;
	}
	$db->begin('mjl standalone audit outcome');
	$id = mjl_audit_insert($db, $event);
	if ($id < 1) {
		$db->rollback('mjl standalone audit outcome failed');
		return -1;
	}
	if (!$db->commit('mjl standalone audit outcome')) {
		$db->rollback('mjl standalone audit outcome commit failed');
		return -1;
	}
	return $id;
}

function mjl_audit_insert(DoliDB $db, array $event)
{
	global $conf, $user;
	$entity = isset($event['entity']) ? (int) $event['entity'] : (isset($conf->entity) ? (int) $conf->entity : 0);
	$objectType = isset($event['object_type']) ? trim((string) $event['object_type']) : '';
	$action = isset($event['action']) ? trim((string) $event['action']) : '';
	$result = isset($event['result']) ? strtoupper((string) $event['result']) : '';
	if ($entity <= 0 || $objectType === '' || $action === '' || !in_array($result, array('SUCCESS', 'DENIED', 'FAILED'), true)) {
		return -1;
	}
	$actor = isset($event['actor']) ? $event['actor'] : (isset($user) ? $user : null);
	list($actorId, $actorName, $actorRole) = mjl_audit_actor_snapshot($actor);
	if (!empty($event['actor_name_snapshot'])) $actorName = (string) $event['actor_name_snapshot'];
	if (!empty($event['actor_role_snapshot'])) $actorRole = (string) $event['actor_role_snapshot'];
	$previousOk = $newOk = $contextOk = false;
	$previousJson = mjl_audit_encode_json(isset($event['previous_values']) ? $event['previous_values'] : null, $previousOk);
	$newJson = mjl_audit_encode_json(isset($event['new_values']) ? $event['new_values'] : null, $newOk);
	$contextJson = mjl_audit_encode_json(isset($event['context']) ? $event['context'] : null, $contextOk);
	if (!$previousOk || !$newOk || !$contextOk) return -1;
	$columns = array(
		'entity' => $entity,
		'object_type' => $objectType,
		'object_id' => empty($event['object_id']) ? null : (int) $event['object_id'],
		'object_ref' => isset($event['object_ref']) ? mjl_audit_sanitize_value((string) $event['object_ref']) : null,
		'activity_id' => empty($event['activity_id']) ? null : (int) $event['activity_id'],
		'operation_id' => empty($event['operation_id']) ? null : (int) $event['operation_id'],
		'revision_id' => empty($event['revision_id']) ? null : (int) $event['revision_id'],
		'actor_id' => $actorId,
		'actor_name_snapshot' => $actorName,
		'actor_role_snapshot' => $actorRole,
		'event_date' => $db->idate(dol_now()),
		'action' => $action,
		'previous_values_json' => $previousJson,
		'new_values_json' => $newJson,
		'reason' => isset($event['reason']) ? mjl_audit_sanitize_value((string) $event['reason']) : null,
		'state_before' => isset($event['state_before']) ? mjl_audit_sanitize_value((string) $event['state_before']) : null,
		'state_after' => isset($event['state_after']) ? mjl_audit_sanitize_value((string) $event['state_after']) : null,
		'target_version' => isset($event['target_version']) ? $event['target_version'] : null,
		'result' => $result,
		'context_json' => $contextJson,
		'date_creation' => $db->idate(dol_now()),
	);
	$names = array_keys($columns);
	$values = array();
	foreach ($columns as $name => $value) {
		if (in_array($name, array('entity', 'object_id', 'activity_id', 'operation_id', 'revision_id', 'actor_id', 'target_version'), true)) {
			$values[] = $value === null ? 'NULL' : (string) ((int) $value);
		} else {
			$values[] = mjl_audit_sql_value($db, $value);
		}
	}
	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_audit_event ('.implode(', ', $names).') VALUES ('.implode(', ', $values).')';
	if (!$db->query($sql)) {
		return -1;
	}
	return (int) $db->last_insert_id($db->prefix().'mjlfinancement_audit_event');
}
