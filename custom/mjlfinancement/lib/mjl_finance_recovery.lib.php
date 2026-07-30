<?php

/**
 * Exact presentation-recovery contracts for finance reference routes.
 *
 * Registry membership never authorizes an action. Uploads, deletes, security
 * failures, unknown actions, identifiers, tokens, and computed amounts are
 * intentionally excluded.
 */
function mjl_finance_recovery_registry($route)
{
	$registries = array(
		'conventions' => array(
			'create' => array('form' => 'create', 'fields' => array('ref', 'title', 'date_start', 'date_end', 'total_amount', 'currency_code', 'note_public', 'note_private')),
			'update' => array('form' => 'edit', 'fields' => array('ref', 'title', 'date_start', 'date_end', 'total_amount', 'currency_code', 'note_public', 'note_private', 'comment')),
			'activate' => array('form' => 'decision', 'fields' => array('comment')),
			'close' => array('form' => 'decision', 'fields' => array('comment')),
			'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
		),
		'budgetlines' => array(
			'create' => array('form' => 'create', 'fields' => array('ref', 'label', 'initial_budget', 'revised_budget', 'category', 'note_public', 'note_private')),
			'update' => array('form' => 'edit', 'fields' => array('ref', 'label', 'initial_budget', 'revised_budget', 'category', 'note_public', 'note_private', 'comment')),
			'activate' => array('form' => 'decision', 'fields' => array('comment')),
			'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
		),
		'fundreceipts' => array(
			'create' => array('form' => 'create', 'fields' => array('ref', 'amount', 'reception_date', 'comment', 'note_public', 'note_private')),
			'update' => array('form' => 'edit', 'fields' => array('ref', 'amount', 'reception_date', 'comment', 'note_public', 'note_private', 'change_comment')),
			'received' => array('form' => 'decision', 'fields' => array('status_comment')),
			'not_received' => array('form' => 'decision', 'fields' => array('status_comment')),
			'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
		),
	);
	return $registries[(string) $route] ?? array();
}

function mjl_finance_recovery_config($route, $action)
{
	$registry = mjl_finance_recovery_registry($route);
	return $registry[(string) $action] ?? null;
}

function mjl_finance_recovery_consume_allowlist($route)
{
	$forms = array();
	foreach (mjl_finance_recovery_registry($route) as $action => $config) {
		$form = (string) $config['form'];
		if (!isset($forms[$form])) $forms[$form] = array();
		$forms[$form][] = (string) $action;
	}
	return $forms;
}

function mjl_finance_recovery_values($recovery, $form)
{
	if (!is_array($recovery) || (string) ($recovery['context']['form'] ?? '') !== (string) $form) return array();
	return (array) ($recovery['values'] ?? array());
}

/**
 * Keep class/database diagnostics out of the browser while retaining a
 * normalized, redacted server-side trace.
 */
function mjl_finance_record_failure($route, $action, $objectId, $error)
{
	global $conf, $user;

	mjl_ui_log_error('validation', array(
		'route' => (string) $route,
		'action' => (string) $action,
		'entity' => (int) $conf->entity,
		'user_id' => (int) $user->id,
		'object_type' => 'mjlfinancement_'.$route,
		'object_id' => (int) $objectId,
	), (string) $error);
	return mjl_ui_safe_error_message('validation');
}
