<?php

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
			'fields' => array('ref', 'label', 'fk_project', 'fk_convention', 'fk_task', 'fk_user_responsible', 'date_start', 'date_end', 'date_actual_start', 'date_actual_end', 'physical_execution_percent', 'execution_status', 'execution_comment'),
		),
		'update' => array(
			'form' => 'correction',
			'fields' => array('label', 'fk_user_responsible', 'date_start', 'date_end', 'comment'),
		),
		'correct' => array('form' => 'correction', 'fields' => array('comment')),
		'request_correction' => array('form' => 'correction', 'fields' => array('comment')),
		'update_execution' => array(
			'form' => 'execution',
			'fields' => array('fk_user_responsible', 'date_actual_start', 'date_actual_end', 'physical_execution_percent', 'execution_status', 'execution_comment'),
		),
		'submit' => array('form' => 'decision', 'fields' => array('comment')),
		'prevalidate' => array('form' => 'decision', 'fields' => array('comment')),
		'final_validate' => array('form' => 'decision', 'fields' => array('comment')),
		'validate' => array('form' => 'decision', 'fields' => array('comment')),
		'reject' => array('form' => 'decision', 'fields' => array('comment')),
		'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
	);
}

function mjl_activity_recovery_config($action)
{
	$registry = mjl_activity_recovery_registry();
	$action = (string) $action;
	return isset($registry[$action]) ? $registry[$action] : null;
}

function mjl_activity_recovery_consume_allowlist()
{
	$forms = array();
	foreach (mjl_activity_recovery_registry() as $action => $config) {
		$form = (string) $config['form'];
		if (!isset($forms[$form])) $forms[$form] = array();
		$forms[$form][] = (string) $action;
	}
	return $forms;
}
