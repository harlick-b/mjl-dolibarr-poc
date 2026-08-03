<?php

if (!defined('MJL_FORM_SUBMISSION_TTL')) define('MJL_FORM_SUBMISSION_TTL', 7200);
if (!defined('MJL_FORM_SUBMISSION_MAX_PENDING')) define('MJL_FORM_SUBMISSION_MAX_PENDING', 20);

/** Issue a one-use token bound to the authenticated form context. */
function mjl_form_submission_issue($context, &$reason = '')
{
	$reason = '';
	$context = mjl_form_submission_normalize_context($context);
	if ($context === null) {
		$reason = 'invalid_context';
		return '';
	}
	mjl_form_submission_prune();
	$store = mjl_form_submission_store();
	$userTokens = array();
	foreach ($store as $token => $entry) {
		if ((int) ($entry['context']['user_id'] ?? 0) === (int) $context['user_id']) {
			$userTokens[$token] = (int) ($entry['created_at'] ?? 0);
		}
	}
	asort($userTokens, SORT_NUMERIC);
	while (count($userTokens) >= MJL_FORM_SUBMISSION_MAX_PENDING) {
		$oldest = key($userTokens);
		unset($store[$oldest], $userTokens[$oldest]);
	}
	try {
		do {
			$token = bin2hex(random_bytes(16));
		} while (isset($store[$token]));
	} catch (Throwable $exception) {
		$reason = 'entropy_failure';
		return '';
	}
	$now = time();
	$store[$token] = array(
		'context' => $context,
		'created_at' => $now,
		'expires_at' => $now + MJL_FORM_SUBMISSION_TTL,
	);
	mjl_form_submission_set_store($store);
	$reason = 'issued';
	return $token;
}

/** Consume an exact-context token once. Mismatches do not destroy it. */
function mjl_form_submission_consume($token, $expectedContext, &$reason = '')
{
	$reason = '';
	$token = strtolower((string) $token);
	$expected = mjl_form_submission_normalize_context($expectedContext);
	if ($expected === null) {
		$reason = 'invalid_context';
		return false;
	}
	if (preg_match('/^[a-f0-9]{32}$/', $token) !== 1) {
		$reason = 'malformed_token';
		return false;
	}
	$store = mjl_form_submission_store();
	if (!isset($store[$token])) {
		mjl_form_submission_prune();
		$reason = 'missing_or_replayed';
		return false;
	}
	if ((int) ($store[$token]['expires_at'] ?? 0) <= time()) {
		unset($store[$token]);
		mjl_form_submission_set_store($store);
		$reason = 'expired';
		return false;
	}
	mjl_form_submission_prune();
	$store = mjl_form_submission_store();
	$actual = (array) ($store[$token]['context'] ?? array());
	if (!hash_equals(json_encode($actual), json_encode($expected))) {
		$reason = 'context_mismatch';
		return false;
	}
	unset($store[$token]);
	mjl_form_submission_set_store($store);
	$reason = 'accepted';
	return true;
}

function mjl_form_submission_prune()
{
	$store = mjl_form_submission_store();
	$now = time();
	foreach ($store as $token => $entry) {
		if ((int) ($entry['expires_at'] ?? 0) <= $now) unset($store[$token]);
	}
	mjl_form_submission_set_store($store);
}

function mjl_form_submission_normalize_context($context)
{
	$required = array('user_id', 'entity', 'route', 'form', 'action', 'object_id');
	foreach ($required as $field) {
		if (!array_key_exists($field, (array) $context)) return null;
	}
	foreach (array('route', 'form', 'action') as $nameField) {
		if (!is_string($context[$nameField]) || preg_match('/^[a-z][a-z0-9_-]{0,63}$/i', $context[$nameField]) !== 1) return null;
	}
	$normalized = array(
		'user_id' => (int) $context['user_id'],
		'entity' => (int) $context['entity'],
		'route' => $context['route'],
		'form' => $context['form'],
		'action' => $context['action'],
		'object_id' => (int) $context['object_id'],
	);
	if ($normalized['user_id'] <= 0 || $normalized['entity'] <= 0 || $normalized['route'] === '' || $normalized['form'] === '' || $normalized['action'] === '' || $normalized['object_id'] < 0) return null;
	return $normalized;
}

function mjl_form_submission_store()
{
	if (!isset($_SESSION) || !is_array($_SESSION)) $_SESSION = array();
	if (!isset($_SESSION['mjl_form_submissions']) || !is_array($_SESSION['mjl_form_submissions'])) $_SESSION['mjl_form_submissions'] = array();
	return $_SESSION['mjl_form_submissions'];
}

function mjl_form_submission_set_store($store)
{
	$_SESSION['mjl_form_submissions'] = (array) $store;
}
