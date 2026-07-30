<?php

/**
 * Presentation recovery contract for the projects route.
 *
 * Registry membership never grants permission to execute an action.
 */
function mjl_project_recovery_registry()
{
	return array(
		'create' => array('form' => 'project', 'fields' => array('ref', 'title', 'fk_soc', 'date_start', 'date_end', 'fk_statut', 'description')),
		'update' => array('form' => 'project', 'fields' => array('ref', 'title', 'fk_soc', 'date_start', 'date_end', 'fk_statut', 'description')),
		'add_note' => array('form' => 'comment', 'fields' => array('message')),
		'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
	);
}

function mjl_project_recovery_config($action)
{
	$registry = mjl_project_recovery_registry();
	$action = (string) $action;
	return $registry[$action] ?? null;
}

function mjl_project_recovery_consume_allowlist()
{
	$forms = array();
	foreach (mjl_project_recovery_registry() as $action => $config) {
		$form = (string) $config['form'];
		if (!isset($forms[$form])) $forms[$form] = array();
		$forms[$form][] = (string) $action;
	}
	return $forms;
}
