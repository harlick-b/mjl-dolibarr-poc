<?php

/**
 * Pure whole-registry validation, exact lookup, and form/action grouping.
 *
 * Route wrappers own their literal registries. This leaf never grants
 * permission, reads requests, or stores recovery state.
 */

function mjl_recovery_registry_config($registry, $action)
{
	if (!mjl_recovery_registry_is_valid($registry) || !is_string($action)) {
		return null;
	}
	return isset($registry[$action]) ? $registry[$action] : null;
}

function mjl_recovery_registry_consume_allowlist($registry)
{
	if (!mjl_recovery_registry_is_valid($registry)) {
		return array();
	}
	$forms = array();
	foreach ($registry as $action => $config) {
		$form = $config['form'];
		if (!isset($forms[$form])) {
			$forms[$form] = array();
		}
		$forms[$form][] = $action;
	}
	return $forms;
}

function mjl_recovery_registry_is_valid($registry)
{
	if (!is_array($registry)) {
		return false;
	}
	foreach ($registry as $action => $config) {
		if (!is_string($action) || !mjl_recovery_registry_valid_name($action) || mjl_recovery_registry_forbidden_action($action)) {
			return false;
		}
		if (!is_array($config)
			|| count($config) !== 2
			|| !array_key_exists('form', $config)
			|| !array_key_exists('fields', $config)
			|| !is_string($config['form'])
			|| !mjl_recovery_registry_valid_name($config['form'])
			|| !is_array($config['fields'])) {
			return false;
		}
		$seen = array();
		foreach ($config['fields'] as $field) {
			if (!is_string($field)
				|| !mjl_recovery_registry_valid_name($field)
				|| mjl_recovery_registry_forbidden_field($field)
				|| isset($seen[$field])) {
				return false;
			}
			$seen[$field] = true;
		}
	}
	return true;
}

function mjl_recovery_registry_valid_name($name)
{
	return is_string($name) && preg_match('/^[a-z][a-z0-9_]{0,63}$/', $name) === 1;
}

function mjl_recovery_registry_forbidden_action($action)
{
	return in_array($action, array('upload', 'delete', 'security', 'csrf', 'forbidden', 'stale', 'unknown'), true);
}

function mjl_recovery_registry_forbidden_field($field)
{
	if (strpos($field, 'fk_') === 0 || substr($field, -3) === '_id') {
		return true;
	}
	return in_array($field, array(
		'id',
		'rowid',
		'entity',
		'token',
		'mjl_recovery',
		'recovery_handle',
		'file',
		'filename',
		'filepath',
		'path',
		'supporting_document',
		'object_id',
		'user_id',
		'committed_amount',
		'spent_amount',
		'remaining_amount',
		'requested_amount',
		'prevalidated_amount',
		'final_validated_amount',
		'disbursed_amount',
	), true);
}
