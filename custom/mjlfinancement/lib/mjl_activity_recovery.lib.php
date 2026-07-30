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
			'fields' => array('ref', 'label', 'date_start', 'date_end', 'date_actual_start', 'date_actual_end', 'physical_execution_percent', 'execution_status', 'execution_comment'),
		),
		'update' => array(
			'form' => 'correction',
			'fields' => array('label', 'date_start', 'date_end', 'comment'),
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

function mjl_activity_recovery_config($action)
{
	return mjl_recovery_registry_config(mjl_activity_recovery_registry(), $action);
}

function mjl_activity_recovery_consume_allowlist()
{
	return mjl_recovery_registry_consume_allowlist(mjl_activity_recovery_registry());
}
