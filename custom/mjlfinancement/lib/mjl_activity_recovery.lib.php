<?php

require_once __DIR__.'/mjl_recovery_registry.lib.php';

/**
 * Presentation recovery contract for the activity route.
 *
 * This registry does not grant permissions or determine available actions.
 */
function mjl_activity_recovery_registry()
{
	return array(
		'create' => array(
			'form' => 'create',
			'fields' => array('ref', 'label', 'project_scope', 'convention_scope', 'task_scope', 'responsible_scope', 'date_start', 'date_end', 'date_actual_start', 'date_actual_end', 'physical_execution_percent', 'execution_status', 'execution_comment'),
		),
		'update' => array(
			'form' => 'correction',
			'fields' => array('label', 'responsible_scope', 'date_start', 'date_end', 'comment'),
		),
		'correct' => array('form' => 'correction', 'fields' => array('comment')),
		'request_correction' => array('form' => 'correction', 'fields' => array('comment')),
		'update_execution' => array(
			'form' => 'execution',
			'fields' => array('date_actual_start', 'date_actual_end', 'physical_execution_percent', 'execution_status', 'execution_comment'),
		),
		'submit' => array('form' => 'decision', 'fields' => array('comment')),
		'prevalidate' => array('form' => 'decision', 'fields' => array('comment')),
		'final_validate' => array('form' => 'decision', 'fields' => array('comment')),
		'validate' => array('form' => 'decision', 'fields' => array('comment')),
		'reject' => array('form' => 'decision', 'fields' => array('comment')),
		'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
	);
}

function mjl_activity_recovery_alias_fields()
{
	return array('project_scope', 'convention_scope', 'task_scope', 'responsible_scope');
}

function mjl_activity_recovery_validated_create_aliases($project, $convention, $task, $responsible, $projectOptions, $conventionOptions, $taskOptions, $responsibleOptions)
{
	$aliases = array();
	if ($project > 0 && array_key_exists((int) $project, (array) $projectOptions)) {
		$aliases['project_scope'] = (string) $project;
	}
	if ($convention > 0 && isset($conventionOptions[(int) $convention])
		&& (int) ($conventionOptions[(int) $convention]['project_id'] ?? 0) === (int) $project) {
		$aliases['convention_scope'] = (string) $convention;
	}
	if ($task === 0 || (isset($taskOptions[(int) $task]) && (int) ($taskOptions[(int) $task]['project_id'] ?? 0) === (int) $project)) {
		$aliases['task_scope'] = (string) $task;
	}
	if ($responsible === 0 || array_key_exists((int) $responsible, (array) $responsibleOptions)) {
		$aliases['responsible_scope'] = (string) $responsible;
	}
	return $aliases;
}

function mjl_activity_recovery_validated_update_aliases($responsible, $responsibleOptions)
{
	if ($responsible === 0 || array_key_exists((int) $responsible, (array) $responsibleOptions)) {
		return array('responsible_scope' => (string) $responsible);
	}
	return array();
}

function mjl_activity_recovery_restore_create_values($storedValues, $projectOptions, $conventionOptions, $taskOptions, $responsibleOptions)
{
	$values = (array) $storedValues;
	$project = isset($values['project_scope']) ? (string) $values['project_scope'] : '';
	$convention = isset($values['convention_scope']) ? (string) $values['convention_scope'] : '';
	$task = isset($values['task_scope']) ? (string) $values['task_scope'] : '';
	$responsible = isset($values['responsible_scope']) ? (string) $values['responsible_scope'] : '';
	unset($values['project_scope'], $values['convention_scope'], $values['task_scope'], $values['responsible_scope']);
	if (preg_match('/^[1-9][0-9]*$/', $project) === 1 && array_key_exists((int) $project, (array) $projectOptions)) {
		$values['fk_project'] = $project;
	}
	if (preg_match('/^[1-9][0-9]*$/', $convention) === 1 && isset($conventionOptions[(int) $convention])
		&& (int) ($conventionOptions[(int) $convention]['project_id'] ?? 0) === (int) ($values['fk_project'] ?? 0)) {
		$values['fk_convention'] = $convention;
	}
	if ($task === '0' || (preg_match('/^[1-9][0-9]*$/', $task) === 1 && isset($taskOptions[(int) $task])
		&& (int) ($taskOptions[(int) $task]['project_id'] ?? 0) === (int) ($values['fk_project'] ?? 0))) {
		$values['fk_task'] = $task;
	}
	if ($responsible === '0' || (preg_match('/^[1-9][0-9]*$/', $responsible) === 1 && array_key_exists((int) $responsible, (array) $responsibleOptions))) {
		$values['fk_user_responsible'] = $responsible;
	}
	return $values;
}

function mjl_activity_recovery_restore_update_values($storedValues, $responsibleOptions)
{
	$values = (array) $storedValues;
	$responsible = isset($values['responsible_scope']) ? (string) $values['responsible_scope'] : '';
	unset($values['responsible_scope']);
	if ($responsible === '0' || (preg_match('/^[1-9][0-9]*$/', $responsible) === 1 && array_key_exists((int) $responsible, (array) $responsibleOptions))) {
		$values['fk_user_responsible'] = $responsible;
	}
	return $values;
}

function mjl_activity_recovery_config($action)
{
	return mjl_recovery_registry_config(mjl_activity_recovery_registry(), $action);
}

function mjl_activity_recovery_consume_allowlist()
{
	return mjl_recovery_registry_consume_allowlist(mjl_activity_recovery_registry());
}
