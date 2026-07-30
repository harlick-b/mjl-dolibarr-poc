<?php

require_once __DIR__.'/mjl_recovery_registry.lib.php';

/**
 * Presentation recovery contract for the expenses route.
 *
 * Registry membership does not authorize a transition. Security, stale,
 * upload, and unknown failures intentionally have no recovery entry.
 */
function mjl_expense_recovery_registry()
{
	return array(
		'create' => array('form' => 'create', 'fields' => array('ref', 'amount', 'expense_date', 'description')),
		'update' => array('form' => 'correction', 'fields' => array('amount', 'expense_date', 'description')),
		'correct' => array('form' => 'correction', 'fields' => array('comment')),
		'submit' => array('form' => 'decision', 'fields' => array('comment')),
		'validate' => array('form' => 'decision', 'fields' => array()),
		'prevalidate' => array('form' => 'decision', 'fields' => array('comment')),
		'final_validate' => array('form' => 'decision', 'fields' => array('comment')),
		'disburse' => array('form' => 'decision', 'fields' => array('beneficiary_name', 'disbursement_date')),
		'reject' => array('form' => 'decision', 'fields' => array('comment')),
		'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
	);
}

function mjl_expense_recovery_config($action)
{
	return mjl_recovery_registry_config(mjl_expense_recovery_registry(), $action);
}

function mjl_expense_recovery_consume_allowlist()
{
	return mjl_recovery_registry_consume_allowlist(mjl_expense_recovery_registry());
}
