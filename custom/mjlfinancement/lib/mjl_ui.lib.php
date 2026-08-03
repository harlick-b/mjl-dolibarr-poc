<?php

/**
 * Presentation-only vocabulary and safe system states.
 *
 * This leaf intentionally has no dependency on page controllers, navigation,
 * dashboards, alerts, persistence helpers, or export formatters.
 */

function mjl_ui_activity_status($status)
{
	$map = array(
		'0' => array('label' => 'Brouillon', 'tone' => 'neutral'),
		'1' => array('label' => 'En cours', 'tone' => 'info'),
		'2' => array('label' => 'Terminée', 'tone' => 'success'),
		'3' => array('label' => 'Soumise', 'tone' => 'warning'),
		'4' => array('label' => 'Correction demandée', 'tone' => 'danger'),
		'5' => array('label' => 'Corrigée', 'tone' => 'warning'),
		'6' => array('label' => 'Validée définitivement', 'tone' => 'success'),
		'7' => array('label' => 'Prévalidée', 'tone' => 'warning'),
		'8' => array('label' => 'Rejetée', 'tone' => 'danger'),
		'9' => array('label' => 'Annulée', 'tone' => 'neutral'),
		'draft' => array('label' => 'Brouillon', 'tone' => 'neutral'),
		'ongoing' => array('label' => 'En cours', 'tone' => 'info'),
		'completed' => array('label' => 'Terminée', 'tone' => 'success'),
		'submitted' => array('label' => 'Soumise', 'tone' => 'warning'),
		'correction_requested' => array('label' => 'Correction demandée', 'tone' => 'danger'),
		'corrected' => array('label' => 'Corrigée', 'tone' => 'warning'),
		'validated' => array('label' => 'Validée définitivement', 'tone' => 'success'),
		'final_validated' => array('label' => 'Validée définitivement', 'tone' => 'success'),
		'prevalidated' => array('label' => 'Prévalidée', 'tone' => 'warning'),
		'rejected' => array('label' => 'Rejetée', 'tone' => 'danger'),
		'cancelled' => array('label' => 'Annulée', 'tone' => 'neutral'),
	);
	$key = (string) $status;
	return isset($map[$key]) ? $map[$key] : array('label' => 'Statut non reconnu', 'tone' => 'neutral');
}

function mjl_ui_expense_status($status)
{
	$map = array(
		'0' => array('label' => 'Brouillon', 'tone' => 'neutral'),
		'1' => array('label' => 'Soumise', 'tone' => 'warning'),
		'2' => array('label' => 'Validée définitivement', 'tone' => 'success'),
		'3' => array('label' => 'Corrigée', 'tone' => 'warning'),
		'4' => array('label' => 'Prévalidée', 'tone' => 'warning'),
		'6' => array('label' => 'Validée définitivement', 'tone' => 'success'),
		'7' => array('label' => 'Décaissée', 'tone' => 'success'),
		'8' => array('label' => 'Rejetée', 'tone' => 'danger'),
		'draft' => array('label' => 'Brouillon', 'tone' => 'neutral'),
		'submitted' => array('label' => 'Soumise', 'tone' => 'warning'),
		'legacy_validated' => array('label' => 'Validée définitivement', 'tone' => 'success'),
		'validated' => array('label' => 'Validée définitivement', 'tone' => 'success'),
		'corrected' => array('label' => 'Corrigée', 'tone' => 'warning'),
		'prevalidated' => array('label' => 'Prévalidée', 'tone' => 'warning'),
		'final_validated' => array('label' => 'Validée définitivement', 'tone' => 'success'),
		'disbursed' => array('label' => 'Décaissée', 'tone' => 'success'),
		'rejected' => array('label' => 'Rejetée', 'tone' => 'danger'),
	);
	$key = (string) $status;
	return isset($map[$key]) ? $map[$key] : array('label' => 'Statut non reconnu', 'tone' => 'neutral');
}

function mjl_ui_escape($value)
{
	return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function mjl_ui_status_badge($status)
{
	$label = isset($status['label']) ? $status['label'] : 'Statut non reconnu';
	$tone = isset($status['tone']) && in_array($status['tone'], array('neutral', 'info', 'success', 'warning', 'danger'), true) ? $status['tone'] : 'neutral';
	return '<span class="mjl-status-pill mjl-status-'.$tone.'">'.mjl_ui_escape($label).'</span>';
}

function mjl_ui_system_state($type, $title, $message, $options = array())
{
	$allowed = array('info', 'success', 'warning', 'danger', 'unavailable', 'initial-empty', 'filtered-empty', 'permission', 'loading', 'partial-error');
	$type = in_array((string) $type, $allowed, true) ? (string) $type : 'info';
	$role = in_array($type, array('danger', 'unavailable', 'permission', 'partial-error'), true) ? 'alert' : 'status';
	$html = '<div class="mjl-system-state mjl-system-state-'.$type.'" role="'.$role.'"';
	if ($type === 'loading') {
		$html .= ' aria-live="polite" aria-busy="true"';
	}
	$html .= '>';
	if ((string) $title !== '') {
		$html .= '<strong>'.mjl_ui_escape($title).'</strong>';
	}
	if ((string) $message !== '') {
		$html .= '<p>'.mjl_ui_escape($message).'</p>';
	}
	if (!empty($options['href']) && !empty($options['action'])) {
		$html .= '<a class="mjl-action mjl-action-secondary" href="'.mjl_ui_escape($options['href']).'">'.mjl_ui_escape($options['action']).'</a>';
	}
	return $html.'</div>';
}

function mjl_ui_safe_error_message($category = 'unknown')
{
	$messages = array(
		'database' => 'Le service de données est temporairement indisponible. Veuillez réessayer.',
		'options' => 'Les options nécessaires ne peuvent pas être chargées pour le moment.',
		'timeline' => 'Une partie de l’historique ne peut pas être chargée pour le moment.',
		'alerts' => 'Une partie des alertes ne peut pas être chargée pour le moment.',
		'validation' => 'Les informations saisies doivent être corrigées avant de continuer.',
	);
	return isset($messages[$category]) ? $messages[$category] : 'L’action n’a pas pu être réalisée. Veuillez réessayer.';
}

function mjl_ui_log_error($category, $context = array(), $driverMessage = '')
{
	$allowedContext = array('route', 'action', 'entity', 'user_id', 'object_type', 'object_id');
	$normalized = array('category' => preg_replace('/[^a-z0-9_-]/i', '', (string) $category));
	foreach ($allowedContext as $key) {
		if (!isset($context[$key])) {
			continue;
		}
		if (in_array($key, array('entity', 'user_id', 'object_id'), true)) {
			$normalized[$key] = (int) $context[$key];
		} else {
			$normalized[$key] = substr(preg_replace('/[^a-z0-9_\\/-]/i', '', (string) $context[$key]), 0, 80);
		}
	}
	$message = preg_replace('/\\bSQLSTATE\\b.*$/i', '[database diagnostic redacted]', (string) $driverMessage);
	$message = preg_replace('/(?:select|insert|update|delete|replace|alter|drop|create)\\b.*$/i', '[sql redacted]', $message);
	$message = preg_replace('/(?:\\/[^\\s:]+)+/', '[path]', $message);
	$message = preg_replace('/[A-Za-z]:\\\\[^\\s]+/', '[path]', $message);
	$message = preg_replace('/\\b(token|password|comment|reason)\\s*[=:]\\s*\\S+/i', '$1=[redacted]', $message);
	$message = preg_replace('/(["\']).*?\\1/', '[value]', $message);
	$message = preg_replace('/`[^`]+`/', '[identifier]', $message);
	$message = trim(substr(preg_replace('/[\\r\\n\\t]+/', ' ', $message), 0, 160));
	if ($message !== '') {
		$normalized['driver'] = $message;
	}
	error_log('MJL_UI '.json_encode($normalized));
}
