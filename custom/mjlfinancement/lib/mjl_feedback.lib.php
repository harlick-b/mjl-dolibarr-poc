<?php

/** Closed cross-request operation-feedback adapter. */
function mjl_feedback_registry()
{
	return array(
		'generic.error' => array('message' => 'L’action n’a pas pu être réalisée. Veuillez réessayer.', 'tone' => 'error', 'allowed_context' => array()),
		'generic.validation' => mjl_feedback_definition('Les informations saisies doivent être corrigées avant de continuer.', 'error'),
		'generic.database' => mjl_feedback_definition('Le service de données est temporairement indisponible. Veuillez réessayer.', 'error'),
		'generic.partial' => mjl_feedback_definition('Une partie des informations est temporairement indisponible.', 'error'),
		'generic.no_change' => mjl_feedback_definition('Aucune modification à enregistrer.', 'warning'),
		'generic.saved' => mjl_feedback_definition('Action enregistrée.', 'success'),
		'generic.recovery_unavailable' => mjl_feedback_definition('La récupération du formulaire est indisponible. Copiez vos informations avant de réessayer.', 'warning'),
		'project.created' => mjl_feedback_definition('Projet MJL créé.', 'success'),
		'project.updated' => mjl_feedback_definition('Projet MJL mis à jour.', 'success'),
		'project.comment_added' => mjl_feedback_definition('Commentaire ajouté au projet.', 'success'),
		'access.invitation_sent' => mjl_feedback_definition('Invitation envoyée.', 'success'),
		'access.profile_updated' => mjl_feedback_definition('Profil d’accès mis à jour.', 'success'),
		'access.deactivated' => mjl_feedback_definition('Accès désactivé.', 'success'),
		'access.self_deactivation_denied' => mjl_feedback_definition('Vous ne pouvez pas désactiver votre propre accès.', 'error'),
		'access.invitation_revoked' => mjl_feedback_definition('Invitation révoquée.', 'success'),
		'access.invitation_already_accepted' => mjl_feedback_definition('Cette invitation est déjà acceptée.', 'warning'),
		'access.invitation_already_revoked' => mjl_feedback_definition('Cette invitation est déjà révoquée.', 'warning'),
		'access.invitation_accepting' => mjl_feedback_definition('Cette invitation est en cours d’acceptation.', 'warning'),
		'access.invitation_cannot_revoke' => mjl_feedback_definition('Cette invitation ne peut pas être révoquée dans son état actuel.', 'warning'),
		'access.login_exists' => mjl_feedback_definition('Cet identifiant correspond déjà à un utilisateur existant.', 'error'),
		'access.email_in_use' => mjl_feedback_definition('Cette adresse e-mail est déjà utilisée.', 'error'),
	);
}

function mjl_feedback_definition($message, $tone, array $allowedContext = array())
{
	return array('message' => (string) $message, 'tone' => (string) $tone, 'allowed_context' => $allowedContext);
}

function mjl_feedback_reset_request_state()
{
	$GLOBALS['mjl_feedback_operations'] = array();
}

function mjl_feedback_add($operationKey, $messageKey, array $context = array())
{
	$operationKey = (string) $operationKey;
	$registry = mjl_feedback_registry();
	$validOperation = preg_match('/^[a-z0-9_.:-]{1,120}$/i', $operationKey) === 1;
	$validMessage = isset($registry[$messageKey]);
	$allowed = $validMessage ? $registry[$messageKey]['allowed_context'] : array();
	$validContext = !array_diff(array_keys($context), $allowed);
	foreach ($context as $value) if (!is_scalar($value) && $value !== null) $validContext = false;
	if (!$validOperation || !$validMessage || !$validContext) {
		mjl_feedback_log_invalid($operationKey, $messageKey);
		$operationKey = 'feedback-invalid:'.substr(hash('sha256', $operationKey.'|'.$messageKey), 0, 20);
		$messageKey = 'generic.error';
		$context = array();
	}
	if (!isset($GLOBALS['mjl_feedback_operations'])) $GLOBALS['mjl_feedback_operations'] = array();
	if (isset($GLOBALS['mjl_feedback_operations'][$operationKey])) return false;
	$GLOBALS['mjl_feedback_operations'][$operationKey] = true;

	$definition = $registry[$messageKey];
	$message = $definition['message'];
	foreach ($context as $name => $value) $message = str_replace('{'.$name.'}', (string) $value, $message);
	$marker = '<!--mjl-feedback-marker:'.mjl_feedback_random_marker().'-->';
	$style = $definition['tone'] === 'success' ? 'mesgs' : ($definition['tone'] === 'warning' ? 'warnings' : 'errors');
	setEventMessages($message.$marker, null, $style);
	return true;
}

function mjl_feedback_random_marker()
{
	try { return bin2hex(random_bytes(12)); } catch (Exception $exception) { return hash('sha256', uniqid('', true)); }
}

function mjl_feedback_log_invalid($operationKey, $messageKey)
{
	$context = array('route' => 'feedback', 'action' => 'invalid_contract');
	if (function_exists('mjl_ui_log_error')) mjl_ui_log_error('feedback', $context, 'invalid operation/message contract');
	else error_log('MJL_FEEDBACK '.json_encode(array('category' => 'invalid_contract', 'operation_hash' => substr(hash('sha256', (string) $operationKey), 0, 12), 'message_hash' => substr(hash('sha256', (string) $messageKey), 0, 12))));
}

function mjl_feedback_events()
{
	$stored = isset($_SESSION['dol_events']) ? $_SESSION['dol_events'] : array();
	$events = array();
	foreach ((array) $stored as $key => $entry) {
		if (is_array($entry) && isset($entry['mesg'])) {
			$events[] = array('style' => isset($entry['type']) ? $entry['type'] : 'mesgs', 'message' => $entry['mesg']);
			continue;
		}
		if (in_array($key, array('mesgs', 'warnings', 'errors'), true)) {
			foreach ((array) $entry as $message) $events[] = array('style' => $key, 'message' => $message);
		}
	}
	return $events;
}

function mjl_feedback_render_and_clear()
{
	$events = mjl_feedback_events();
	unset($_SESSION['dol_events']);
	$html = '';
	foreach ($events as $event) {
		$message = preg_replace('/<!--mjl-feedback-marker:[a-f0-9]+-->/', '', (string) $event['message']);
		$message = trim(strip_tags($message));
		if ($message === '') continue;
		$style = (string) $event['style'];
		$tone = $style === 'mesgs' ? 'success' : ($style === 'warnings' ? 'warning' : 'danger');
		$role = $tone === 'success' ? 'status' : 'alert';
		$live = $tone === 'success' ? ' aria-live="polite"' : '';
		$html .= '<div class="mjl-system-state mjl-system-state-'.$tone.'" role="'.$role.'"'.$live.'><p>'.htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'</p></div>';
	}
	return $html;
}
