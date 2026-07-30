<?php

require_once __DIR__.'/mjl_recovery_registry.lib.php';

/**
 * Presentation recovery contract for the projects route.
 *
 * Registry membership never grants permission to execute an action.
 */
function mjl_project_recovery_registry()
{
	return array(
		'create' => array('form' => 'project', 'fields' => array('ref', 'title', 'date_start', 'date_end', 'description')),
		'update' => array('form' => 'project', 'fields' => array('ref', 'title', 'date_start', 'date_end', 'description')),
		'add_note' => array('form' => 'comment', 'fields' => array('message')),
		'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
	);
}

function mjl_project_recovery_config($action)
{
	return mjl_recovery_registry_config(mjl_project_recovery_registry(), $action);
}

function mjl_project_recovery_consume_allowlist()
{
	return mjl_recovery_registry_consume_allowlist(mjl_project_recovery_registry());
}
