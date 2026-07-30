<?php

/**
 * Closed presentation feedback contracts for finance routes.
 *
 * Raw class and database errors are accepted only for strict, in-memory policy
 * comparison. They are never returned, logged, or stored in recovery state.
 */

function mjl_finance_feedback_domain_policy()
{
	return array(
		'conventions' => array(
			'create' => array(
				'Convention reference and title are required' => array('_form' => 'La référence et l’intitulé sont obligatoires.'),
				'Convention PTF is required' => array('_form' => 'Un Partenaire / Programme est obligatoire.'),
			),
			'update' => array(
				'Convention reference is required' => array('ref' => 'La référence est obligatoire.'),
				'Convention title is required' => array('title' => 'L’intitulé est obligatoire.'),
				'Convention PTF is required' => array('_form' => 'Un Partenaire / Programme est obligatoire.'),
				'Convention currency must use a 3-letter code' => array('currency_code' => 'La devise doit comporter exactement trois lettres.'),
				'Update comment is required' => array('comment' => 'Le motif de modification est obligatoire.'),
			),
		),
		'budgetlines' => array(
			'create' => array(
				'Budget amounts cannot be negative' => array('_form' => 'Les montants budgétaires ne peuvent pas être négatifs.'),
				'Budget line reference and label are required' => array('_form' => 'La référence et le libellé sont obligatoires.'),
				'Project and convention are required' => array('_form' => 'Le projet et l’enveloppe active sont obligatoires.'),
			),
			'update' => array(
				'Budget amounts cannot be negative' => array('_form' => 'Les montants budgétaires ne peuvent pas être négatifs.'),
				'Budget line reference is required' => array('ref' => 'La référence est obligatoire.'),
				'Budget line label is required' => array('label' => 'Le libellé est obligatoire.'),
				'Budget line project is required' => array('_form' => 'Le projet est obligatoire.'),
				'Budget line convention is required' => array('_form' => 'L’enveloppe active est obligatoire.'),
				'Project and convention are required' => array('_form' => 'Le projet et l’enveloppe active sont obligatoires.'),
				'Update comment is required' => array('comment' => 'Le motif de modification est obligatoire.'),
			),
			'activate' => array(
				'Budget line revised budget cannot be below final validated amount' => array('_form' => 'Le budget révisé ne peut pas être inférieur au montant déjà validé définitivement.'),
			),
		),
		'fundreceipts' => array(
			'create' => array(
				'La référence de réception est obligatoire' => array('ref' => 'La référence est obligatoire.'),
				'Une enveloppe active avec partenaire est obligatoire' => array('_form' => 'Une enveloppe active rattachée à un Partenaire / Programme est obligatoire.'),
				'Le montant de réception ne peut pas être négatif' => array('amount' => 'Le montant ne peut pas être négatif.'),
			),
			'update' => array(
				'La référence de réception est obligatoire' => array('ref' => 'La référence est obligatoire.'),
				'Une convention active est obligatoire' => array('_form' => 'Une enveloppe active est obligatoire.'),
				'Le montant de réception ne peut pas être négatif' => array('amount' => 'Le montant ne peut pas être négatif.'),
				'Update comment is required' => array('change_comment' => 'Le motif de modification est obligatoire.'),
			),
			'received' => array(
				'Le montant doit être supérieur à zéro avant de marquer les fonds comme reçus' => array('_form' => 'Le montant doit être supérieur à zéro.'),
				'La date de réception est obligatoire avant de marquer les fonds comme reçus' => array('_form' => 'La date de réception est obligatoire.'),
				'Une preuve documentaire téléchargeable est obligatoire avant de marquer les fonds comme reçus' => array('_form' => 'Une preuve documentaire téléchargeable est obligatoire.'),
			),
			'not_received' => array(
				'Un motif est obligatoire pour marquer les fonds comme non reçus' => array('status_comment' => 'Le motif est obligatoire.'),
			),
		),
	);
}

function mjl_finance_feedback_domain($route, $action, $objectId, $rawError)
{
	$policy = mjl_finance_feedback_domain_policy();
	$route = (string) $route;
	$action = (string) $action;
	$errors = isset($policy[$route][$action][(string) $rawError]) ? $policy[$route][$action][(string) $rawError] : array();
	$category = empty($errors) ? 'unknown' : 'validation';
	$feedback = mjl_finance_feedback_envelope($category, $errors);
	mjl_finance_feedback_log($category, $route, $action, $objectId);
	return $feedback;
}

function mjl_finance_source_query($db, $sql, $route, $source, $objectId = 0)
{
	$result = $db->query($sql);
	if ($result) {
		return array('result' => $result, 'feedback' => null);
	}
	$route = (string) $route;
	$source = (string) $source;
	if (!in_array($route, array('conventions', 'budgetlines', 'fundreceipts'), true) || !in_array($source, array('list', 'fetch_detail', 'timeline'), true)) {
		$feedback = mjl_finance_feedback_envelope('unknown');
		mjl_finance_feedback_log('unknown', $route, $source, 0);
		return array('result' => false, 'feedback' => $feedback);
	}
	$feedback = mjl_finance_feedback_envelope($source === 'timeline' ? 'timeline' : 'database');
	mjl_finance_feedback_log('database', $route, $source, $objectId);
	return array('result' => false, 'feedback' => $feedback);
}

function mjl_finance_feedback_validate_domain($route, $action, $candidate)
{
	$unknown = mjl_finance_feedback_envelope('unknown');
	if (!is_array($candidate) || array_keys($candidate) !== array('category', 'public_message', 'errors')) {
		return $unknown;
	}
	if ($candidate['category'] === 'unknown'
		&& $candidate['public_message'] === $unknown['public_message']
		&& mjl_finance_feedback_has_empty_errors($candidate['errors'])) {
		return $unknown;
	}
	if ($candidate['category'] !== 'validation' || $candidate['public_message'] !== mjl_ui_safe_error_message('validation') || !is_array($candidate['errors'])) {
		return $unknown;
	}
	$policy = mjl_finance_feedback_domain_policy();
	$route = (string) $route;
	$action = (string) $action;
	if (!isset($policy[$route][$action])) {
		return $unknown;
	}
	foreach ($policy[$route][$action] as $errors) {
		if ($candidate['errors'] === $errors) {
			return mjl_finance_feedback_envelope('validation', $errors);
		}
	}
	return $unknown;
}

function mjl_finance_feedback_validate_source($route, $source, $candidate)
{
	$unknown = mjl_finance_feedback_envelope('unknown');
	if (!is_array($candidate)
		|| array_keys($candidate) !== array('category', 'public_message', 'errors')
		|| !mjl_finance_feedback_has_empty_errors($candidate['errors'])) {
		return $unknown;
	}
	$route = (string) $route;
	$source = (string) $source;
	if (!in_array($route, array('conventions', 'budgetlines', 'fundreceipts'), true) || !in_array($source, array('list', 'fetch_detail', 'timeline'), true)) {
		return $unknown;
	}
	$category = $source === 'timeline' ? 'timeline' : 'database';
	$expected = mjl_finance_feedback_envelope($category);
	if ($candidate['category'] !== $expected['category'] || $candidate['public_message'] !== $expected['public_message']) {
		return $unknown;
	}
	return $expected;
}

function mjl_finance_feedback_has_empty_errors($errors)
{
	return ($errors instanceof stdClass && count(get_object_vars($errors)) === 0) || $errors === array();
}

function mjl_finance_feedback_domain_message($route, $action, $candidate)
{
	$feedback = mjl_finance_feedback_validate_domain($route, $action, $candidate);
	return $feedback['public_message'];
}

function mjl_finance_feedback_source_message($route, $source, $candidate)
{
	$feedback = mjl_finance_feedback_validate_source($route, $source, $candidate);
	return $feedback['public_message'];
}

function mjl_finance_feedback_recovery_errors($route, $action, $candidate, $allowedFields)
{
	$feedback = mjl_finance_feedback_validate_domain($route, $action, $candidate);
	if ($feedback['category'] !== 'validation') {
		return array('_form' => $feedback['public_message']);
	}
	$allowed = array('_form' => true);
	foreach ((array) $allowedFields as $field) {
		if (is_string($field) && preg_match('/^[a-z0-9_]+$/', $field)) {
			$allowed[$field] = true;
		}
	}
	$errors = array();
	foreach ($feedback['errors'] as $field => $message) {
		if (isset($allowed[$field])) {
			$errors[$field] = $message;
		}
	}
	return empty($errors) ? array('_form' => mjl_ui_safe_error_message('unknown')) : $errors;
}

function mjl_finance_feedback_envelope($category, $errors = array())
{
	$category = in_array((string) $category, array('validation', 'database', 'timeline', 'unknown'), true) ? (string) $category : 'unknown';
	return array(
		'category' => $category,
		'public_message' => mjl_ui_safe_error_message($category),
		'errors' => $category === 'validation' ? (array) $errors : new stdClass(),
	);
}

function mjl_finance_feedback_log($category, $route, $action, $objectId)
{
	global $conf, $user;

	$routes = array(
		'conventions' => 'mjlfinancement_convention',
		'budgetlines' => 'mjlfinancement_budget_line',
		'fundreceipts' => 'mjlfinancement_fund_receipt',
	);
	$allowedActions = array(
		'conventions' => array('create', 'update', 'activate', 'close', 'delete', 'upload', 'add_exchange', 'list', 'fetch_detail', 'timeline'),
		'budgetlines' => array('create', 'update', 'activate', 'add_exchange', 'list', 'fetch_detail', 'timeline'),
		'fundreceipts' => array('create', 'update', 'upload', 'received', 'not_received', 'add_exchange', 'list', 'fetch_detail', 'timeline'),
	);
	$route = (string) $route;
	$action = (string) $action;
	if (!isset($routes[$route]) || !in_array($action, $allowedActions[$route], true)) {
		$route = 'finance';
		$action = 'unknown';
		$objectType = 'mjlfinancement_unknown';
		$objectId = 0;
		$category = 'unknown';
	} else {
		$objectType = $routes[$route];
		$category = in_array((string) $category, array('validation', 'database', 'timeline', 'unknown'), true) ? (string) $category : 'unknown';
	}
	mjl_ui_log_error($category, array(
		'route' => $route,
		'action' => $action,
		'entity' => isset($conf->entity) ? (int) $conf->entity : 0,
		'user_id' => isset($user->id) ? (int) $user->id : 0,
		'object_type' => $objectType,
		'object_id' => max(0, (int) $objectId),
	));
}
