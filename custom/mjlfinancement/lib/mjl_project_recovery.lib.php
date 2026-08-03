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
		'create' => array('form' => 'project', 'fields' => array('ref', 'title', 'date_start', 'date_end', 'description', 'partner_scope', 'project_status')),
		'update' => array('form' => 'project', 'fields' => array('ref', 'title', 'date_start', 'date_end', 'description', 'partner_scope', 'project_status')),
		'add_note' => array('form' => 'comment', 'fields' => array('message')),
		'add_exchange' => array('form' => 'comment', 'fields' => array('message')),
	);
}

/**
 * Build project recovery values without retaining request-controlled IDs.
 *
 * The partner and status arguments must already have passed the route's
 * current entity/scope and enum validation.
 */
function mjl_project_recovery_prepare_values($request, $validatedPartnerId = null, $validatedStatus = null)
{
	$values = array();
	foreach (array('ref', 'title', 'date_start', 'date_end', 'description') as $field) {
		if (array_key_exists($field, (array) $request) && is_scalar($request[$field])) {
			$values[$field] = (string) $request[$field];
		}
	}
	if (is_int($validatedPartnerId) && $validatedPartnerId > 0) {
		$values['partner_scope'] = (string) $validatedPartnerId;
	}
	if (is_int($validatedStatus) && ($validatedStatus === 0 || $validatedStatus === 1)) {
		$values['project_status'] = (string) $validatedStatus;
	}
	return $values;
}

/**
 * Restore selection aliases after the route has revalidated current scope.
 */
function mjl_project_recovery_restore_values($storedValues, $partnerIsAccessible)
{
	$values = (array) $storedValues;
	$partner = isset($values['partner_scope']) ? (string) $values['partner_scope'] : '';
	$status = isset($values['project_status']) ? (string) $values['project_status'] : '';
	unset($values['partner_scope'], $values['project_status']);
	if ($partnerIsAccessible && preg_match('/^[1-9][0-9]*$/', $partner) === 1) {
		$values['fk_soc'] = $partner;
	}
	if ($status === '0' || $status === '1') {
		$values['fk_statut'] = $status;
	}
	return $values;
}

function mjl_project_recovery_config($action)
{
	return mjl_recovery_registry_config(mjl_project_recovery_registry(), $action);
}

function mjl_project_recovery_consume_allowlist()
{
	return mjl_recovery_registry_consume_allowlist(mjl_project_recovery_registry());
}
