<?php

/**
 * Presentation recovery contract for the expenses route.
 *
 * Registry membership does not authorize a transition. Security, stale,
 * upload, and unknown failures intentionally have no recovery entry.
 */
function mjl_expense_recovery_registry()
{
	return array(
		'create' => array('form' => 'create', 'fields' => array('ref', 'fk_project', 'fk_convention', 'fk_mjl_activity', 'fk_budget_line', 'amount', 'expense_date', 'description')),
		'update' => array('form' => 'correction', 'fields' => array('amount', 'expense_date', 'description')),
		'correct' => array('form' => 'correction', 'fields' => array('comment')),
		'submit' => array('form' => 'decision', 'fields' => array('comment')),
		'validate' => array('form' => 'decision', 'fields' => array()),
		'prevalidate' => array('form' => 'decision', 'fields' => array('prevalidated_amount', 'comment')),
		'final_validate' => array('form' => 'decision', 'fields' => array('final_validated_amount', 'comment')),
		'disburse' => array('form' => 'decision', 'fields' => array('beneficiary_name', 'disbursement_date')),
		'reject' => array('form' => 'decision', 'fields' => array('comment')),
		'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
	);
}

function mjl_expense_recovery_config($action)
{
	$registry = mjl_expense_recovery_registry();
	$action = (string) $action;
	return $registry[$action] ?? null;
}

function mjl_expense_recovery_consume_allowlist()
{
	$forms = array();
	foreach (mjl_expense_recovery_registry() as $action => $config) {
		$form = (string) $config['form'];
		if (!isset($forms[$form])) $forms[$form] = array();
		$forms[$form][] = (string) $action;
	}
	return $forms;
}
