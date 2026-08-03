<?php

define('MJL_FORM_RECOVERY_TTL', 600);
define('MJL_FORM_RECOVERY_MAX_PENDING', 10);
define('MJL_FORM_RECOVERY_MAX_BYTES', 65536);

function mjl_form_recovery_store($context, $values, $allowedFields, &$reason = '', $errors = array())
{
	$reason = '';
	mjl_form_recovery_prune();
	$context = mjl_form_recovery_normalize_context($context);
	if ($context === null) {
		$reason = 'invalid_context';
		return '';
	}
	$safeValues = array();
	foreach ((array) $allowedFields as $field) {
		$field = preg_replace('/[^a-z0-9_]/i', '', (string) $field);
		if ($field === '' || !array_key_exists($field, (array) $values) || !is_scalar($values[$field])) {
			continue;
		}
		$safeValues[$field] = substr((string) $values[$field], 0, 16384);
	}
	$safeErrors = array();
	foreach ((array) $errors as $field => $message) {
		$field = preg_replace('/[^a-z0-9_]/i', '', (string) $field);
		if ($field !== '' && is_scalar($message)) {
			$safeErrors[$field] = substr((string) $message, 0, 500);
		}
	}
	$entry = array(
		'context' => $context,
		'values' => $safeValues,
		'errors' => $safeErrors,
		'created_at' => time(),
		'expires_at' => time() + MJL_FORM_RECOVERY_TTL,
	);
	$store = mjl_form_recovery_store_ref();
	$userEntries = array();
	foreach ($store as $handle => $candidate) {
		if ((int) ($candidate['context']['user_id'] ?? 0) === (int) $context['user_id']) {
			$userEntries[$handle] = (int) ($candidate['created_at'] ?? 0);
		}
	}
	asort($userEntries, SORT_NUMERIC);
	while (count($userEntries) >= MJL_FORM_RECOVERY_MAX_PENDING) {
		$oldest = key($userEntries);
		unset($store[$oldest], $userEntries[$oldest]);
	}
	$userBytes = 0;
	foreach ($store as $candidate) {
		if ((int) ($candidate['context']['user_id'] ?? 0) === (int) $context['user_id']) {
			$userBytes += strlen(serialize($candidate));
		}
	}
	if ($userBytes + strlen(serialize($entry)) > MJL_FORM_RECOVERY_MAX_BYTES) {
		$reason = 'capacity';
		mjl_form_recovery_set_store($store);
		return '';
	}
	do {
		$handle = bin2hex(random_bytes(16));
	} while (isset($store[$handle]));
	$store[$handle] = $entry;
	mjl_form_recovery_set_store($store);
	return $handle;
}

function mjl_form_recovery_consume($handle, $expectedContext)
{
	mjl_form_recovery_prune();
	$handle = strtolower((string) $handle);
	if (!preg_match('/^[a-f0-9]{32}$/', $handle)) {
		return null;
	}
	$expected = mjl_form_recovery_normalize_context($expectedContext);
	$store = mjl_form_recovery_store_ref();
	if ($expected === null || !isset($store[$handle])) {
		return null;
	}
	$entry = $store[$handle];
	if (!hash_equals(json_encode($entry['context']), json_encode($expected))) {
		return null;
	}
	unset($store[$handle]);
	mjl_form_recovery_set_store($store);
	return $entry;
}

function mjl_form_recovery_consume_route($handle, $baseContext, $allowedForms)
{
	mjl_form_recovery_prune();
	$handle = strtolower((string) $handle);
	$store = mjl_form_recovery_store_ref();
	if (!preg_match('/^[a-f0-9]{32}$/', $handle) || !isset($store[$handle])) {
		return null;
	}
	$entry = $store[$handle];
	$context = $entry['context'] ?? array();
	foreach (array('user_id', 'entity', 'route', 'object_id') as $key) {
		$expected = in_array($key, array('user_id', 'entity', 'object_id'), true) ? (int) ($baseContext[$key] ?? 0) : (string) ($baseContext[$key] ?? '');
		$actual = in_array($key, array('user_id', 'entity', 'object_id'), true) ? (int) ($context[$key] ?? 0) : (string) ($context[$key] ?? '');
		if ($actual !== $expected) {
			return null;
		}
	}
	$form = (string) ($context['form'] ?? '');
	$action = (string) ($context['action'] ?? '');
	if (!isset($allowedForms[$form]) || !in_array($action, (array) $allowedForms[$form], true)) {
		return null;
	}
	unset($store[$handle]);
	mjl_form_recovery_set_store($store);
	return $entry;
}

function mjl_form_recovery_discard($handle)
{
	$handle = strtolower((string) $handle);
	$store = mjl_form_recovery_store_ref();
	if (preg_match('/^[a-f0-9]{32}$/', $handle) && isset($store[$handle])) {
		unset($store[$handle]);
		mjl_form_recovery_set_store($store);
	}
}

function mjl_form_recovery_pending_count()
{
	mjl_form_recovery_prune();
	return count(mjl_form_recovery_store_ref());
}

function mjl_form_recovery_prune()
{
	$store = mjl_form_recovery_store_ref();
	$now = time();
	foreach ($store as $handle => $entry) {
		if ((int) ($entry['expires_at'] ?? 0) <= $now) {
			unset($store[$handle]);
		}
	}
	mjl_form_recovery_set_store($store);
}

function mjl_form_recovery_normalize_context($context)
{
	$required = array('user_id', 'entity', 'route', 'form', 'action', 'object_id');
	foreach ($required as $key) {
		if (!array_key_exists($key, (array) $context)) {
			return null;
		}
	}
	return array(
		'user_id' => (int) $context['user_id'],
		'entity' => (int) $context['entity'],
		'route' => substr(preg_replace('/[^a-z0-9_-]/i', '', (string) $context['route']), 0, 64),
		'form' => substr(preg_replace('/[^a-z0-9_-]/i', '', (string) $context['form']), 0, 64),
		'action' => substr(preg_replace('/[^a-z0-9_-]/i', '', (string) $context['action']), 0, 64),
		'object_id' => (int) $context['object_id'],
	);
}

function mjl_form_recovery_store_ref()
{
	if (!isset($_SESSION) || !is_array($_SESSION)) {
		$_SESSION = array();
	}
	if (!isset($_SESSION['mjl_form_recovery']) || !is_array($_SESSION['mjl_form_recovery'])) {
		$_SESSION['mjl_form_recovery'] = array();
	}
	return $_SESSION['mjl_form_recovery'];
}

function mjl_form_recovery_set_store($store)
{
	$_SESSION['mjl_form_recovery'] = (array) $store;
}

function mjl_form_error_summary($errors, $title = 'Corrigez les champs indiqués', $idPrefix = 'mjl-field-', $autofocus = false)
{
	if (empty($errors)) {
		return '';
	}
	$idPrefix = mjl_form_id_prefix($idPrefix);
	$html = '<div class="mjl-form-error-summary" role="alert" tabindex="-1" data-mjl-error-summary'.($autofocus ? ' autofocus' : '').'>';
	$html .= '<strong>'.mjl_form_escape($title).'</strong><ul>';
	foreach ((array) $errors as $field => $message) {
		if ((string) $field === '_form') {
			$html .= '<li><span>'.mjl_form_escape($message).'</span></li>';
		} else {
			$id = $idPrefix.preg_replace('/[^a-z0-9_-]/i', '', (string) $field);
			$html .= '<li><a href="#'.mjl_form_escape($id).'">'.mjl_form_escape($message).'</a></li>';
		}
	}
	return $html.'</ul></div>';
}

function mjl_form_field($name, $label, $controlHtml, $required = false, $description = '', $error = '', $idPrefix = 'mjl-field-')
{
	$id = mjl_form_id_prefix($idPrefix).preg_replace('/[^a-z0-9_-]/i', '', (string) $name);
	$descriptionId = $id.'-description';
	$errorId = $id.'-error';
	$describedBy = array();
	if ($description !== '') $describedBy[] = $descriptionId;
	if ($error !== '') $describedBy[] = $errorId;
	$attributes = ' id="'.$id.'"';
	if (!empty($describedBy)) $attributes .= ' aria-describedby="'.implode(' ', $describedBy).'"';
	if ($error !== '') $attributes .= ' aria-invalid="true"';
	$controlHtml = preg_replace('/<(input|select|textarea)\\b/', '<$1'.$attributes, $controlHtml, 1);
	$html = '<div class="mjl-form-field'.($error !== '' ? ' mjl-form-field-error' : '').'">';
	$html .= '<label for="'.$id.'">'.mjl_form_escape($label).' <span class="mjl-field-requirement">'.($required ? '(obligatoire)' : '(facultatif)').'</span></label>';
	if ($description !== '') $html .= '<p id="'.$descriptionId.'" class="mjl-field-description">'.mjl_form_escape($description).'</p>';
	$html .= $controlHtml;
	if ($error !== '') $html .= '<p id="'.$errorId.'" class="mjl-field-error-message">'.mjl_form_escape($error).'</p>';
	return $html.'</div>';
}

function mjl_form_id_prefix($prefix)
{
	$prefix = preg_replace('/[^a-z0-9_-]/i', '', (string) $prefix);
	return $prefix === '' ? 'mjl-field-' : $prefix;
}

function mjl_form_translate_domain_error($message)
{
	$map = array(
		'Activity physical execution percent must be between 0 and 100' => array('physical_execution_percent' => 'Le taux d’exécution doit être compris entre 0 et 100.'),
		'Physical execution percentage must be numeric' => array('physical_execution_percent' => 'Le taux d’exécution doit être un nombre.'),
		'Physical execution percentage must be between 0 and 100' => array('physical_execution_percent' => 'Le taux d’exécution doit être compris entre 0 et 100.'),
		'Invalid activity execution status' => array('execution_status' => 'Le statut d’exécution sélectionné n’est pas reconnu.'),
		'Completed execution with a percentage other than 100 requires an execution comment' => array('execution_comment' => 'Un commentaire est obligatoire lorsqu’une activité exécutée n’est pas renseignée à 100 %.'),
		'Not-started execution with progress greater than 0 requires an execution comment' => array('execution_comment' => 'Un commentaire est obligatoire lorsqu’une activité planifiée comporte déjà un avancement.'),
		'Responsible user must be active in the active entity' => array('fk_user_responsible' => 'Le responsable sélectionné n’est pas disponible.'),
		'Responsible user is not scoped to the selected Partenaire / Programme' => array('fk_user_responsible' => 'Le responsable sélectionné n’appartient pas au périmètre du projet.'),
		'Activity end date cannot be before start date' => array('date_end' => 'La date de fin doit être postérieure ou égale à la date de début.'),
		'Update comment is required' => array('comment' => 'Le motif de modification est obligatoire.'),
		'Correction reason is required' => array('comment' => 'Le motif de correction est obligatoire.'),
		'Correction comment is required' => array('comment' => 'Le commentaire de correction est obligatoire.'),
		'Rejection reason is required' => array('comment' => 'Le motif de rejet est obligatoire.'),
		'Beneficiary is required before disbursement' => array('beneficiary_name' => 'Le bénéficiaire est obligatoire.'),
		'Disbursement date is required' => array('disbursement_date' => 'La date de décaissement est obligatoire.'),
		'Expense amount must be greater than zero' => array('amount' => 'Le montant doit être supérieur à zéro.'),
		'Expense stage amount exceeds authorized amount' => array('amount' => 'Le montant dépasse le montant autorisé à cette étape.'),
		'Expense amount exceeds available budget line balance' => array('final_validated_amount' => 'Le montant dépasse le solde disponible de la ligne budgétaire.'),
	);
	return isset($map[(string) $message]) ? $map[(string) $message] : array();
}

function mjl_form_escape($value)
{
	return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
