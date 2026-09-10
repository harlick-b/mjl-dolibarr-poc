<?php

require_once __DIR__.'/mjl_monitoring.lib.php';

function mjl_monitoring_dashboard_totals(array $activities)
{
	$result = mjl_monitoring_totals($activities);
	$result += array('pending_draft_amount'=>null, 'pending_submitted_amount'=>null);
	foreach ($activities as $activity) if (isset($activity['pending_amount'])) {
		$key = in_array($activity['validation_status'], array('SUBMITTED','PREVALIDATED'), true) ? 'pending_submitted_amount' : 'pending_draft_amount';
		$result[$key] = mjl_execution_decimal_add($result[$key] ?? '0', $activity['pending_amount']);
	}
	return $result;
}

/** Read-time eligibility; transaction owners still recheck every submitted command. */
function mjl_monitoring_activity_actions(array $activity, $role, $actorId, $date)
{
	$assigned = in_array((string)$actorId, array_map('strval', array_column($activity['assignments'] ?? array(), 'fk_user')), true);
	$future = $date < $activity['date_start'];
	$status = $activity['validation_status'];
	$agent = $role === 'AGENT_SAISIE' && $assigned;
	$review = !empty($activity['fk_current_revision'])
		&& (($role === 'AGENT_VERIFICATEUR' && $status === 'SUBMITTED') || ($role === 'VALIDATEUR_DEFINITIF' && $status === 'PREVALIDATED'))
		&& !in_array((string)$actorId, array_map('strval', $activity['contributors'] ?? array()), true);
	if ($role === 'VALIDATEUR_DEFINITIF' && (empty($activity['prevalidator_id']) || (string)$activity['prevalidator_id'] === (string)$actorId)) $review = false;
	return array(
		'edit'=>$agent && $future && in_array($status, array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'), true),
		'review'=>$review,
		'abandon'=>$agent && $status === 'DRAFT' && empty($activity['fk_current_revision']),
		'return'=>$review && $future,
		'restore'=>$role === 'VALIDATEUR_DEFINITIF' && $status === 'ABANDONED' && $future && empty($activity['assignments']),
		'execution'=>$agent && $status === 'FINAL_VALIDATED' && empty($activity['is_cancelled']),
	);
}

function mjl_monitoring_operation_set_hash(array $operations)
{
	$rows = array();
	foreach ($operations as $operation) $rows[] = array('id'=>(string)$operation['rowid'], 'version'=>(string)$operation['version'], 'status'=>(string)$operation['status']);
	return hash('sha256', json_encode($rows, JSON_UNESCAPED_SLASHES));
}

function mjl_monitoring_request_actions(array $request, array $activity, array $operations, $role, $actorId)
{
	$pending = $request['status'] === 'PENDING';
	$current = empty($activity['is_cancelled']) && (string)$activity['fk_current_revision'] === (string)$request['fk_target_revision'];
	$isActivity = $request['request_type'] === 'CANCELLATION' && $request['target_type'] === 'ACTIVITY';
	if ($isActivity) {
		$current = $current && (string)$activity['version'] === (string)$request['target_version']
			&& hash_equals((string)$request['target_operation_set_hash'], mjl_monitoring_operation_set_hash($operations));
	} else {
		$id = $request['request_type'] === 'REOPENING' ? $request['fk_operation'] : $request['target_id'];
		$target = null;
		foreach ($operations as $operation) if ((string)$operation['rowid'] === (string)$id) $target = $operation;
		$states = $request['request_type'] === 'REOPENING' ? array('COMPLETED') : array('TODO','IN_PROGRESS');
		$current = $current && $target && (string)$target['version'] === (string)$request['target_version'] && in_array($target['status'], $states, true);
	}
	$assigned = in_array((string)$actorId, array_map('strval', array_column($activity['assignments'] ?? array(), 'fk_user')), true);
	return array('approve'=>$pending && $current && $role === 'VALIDATEUR_DEFINITIF',
		'reject'=>$pending && $role === 'VALIDATEUR_DEFINITIF',
		'withdraw'=>$pending && $role === 'AGENT_SAISIE' && $assigned && (string)$request['fk_requester'] === (string)$actorId,
		'stale'=>$pending && !$current);
}
