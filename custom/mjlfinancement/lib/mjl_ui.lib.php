<?php

require_once __DIR__.'/mjl_presentation.lib.php';
require_once __DIR__.'/mjl_feedback.lib.php';

/**
 * Presentation-only vocabulary and safe system states.
 *
 * This leaf intentionally has no dependency on page controllers, navigation,
 * dashboards, alerts, persistence helpers, or export formatters.
 */

function mjl_ui_activity_status($status)
{
	$states = array(
		'0' => array('label' => 'Brouillon', 'tone' => 'neutral'),
		'1' => array('label' => 'Active', 'tone' => 'success'),
		'2' => array('label' => 'Terminée', 'tone' => 'neutral'),
		'DRAFT' => array('label' => 'Brouillon', 'tone' => 'neutral'),
		'ABANDONED' => array('label' => 'Abandonnée', 'tone' => 'warning'),
		'SUBMITTED' => array('label' => 'Soumise', 'tone' => 'info'),
		'RETURNED_SUPERVISOR' => array('label' => 'Retournée par le superviseur', 'tone' => 'warning'),
		'PREVALIDATED' => array('label' => 'Prévalidée', 'tone' => 'info'),
		'RETURNED_VALIDATOR' => array('label' => 'Retournée par le validateur', 'tone' => 'warning'),
		'FINAL_VALIDATED' => array('label' => 'Validée définitivement', 'tone' => 'success'),
		'CANCELLED' => array('label' => 'Annulée', 'tone' => 'danger'),
	);
	return isset($states[(string) $status]) ? $states[(string) $status] : array('label' => 'Statut non reconnu', 'tone' => 'warning');
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
	$role = in_array($type, array('warning', 'danger', 'unavailable', 'permission', 'partial-error'), true) ? 'alert' : 'status';
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
	$href = !empty($options['href']) ? mjl_safe_internal_path($options['href']) : '';
	if ($href !== '' && !empty($options['action'])) {
		$html .= '<a class="mjl-action mjl-action-secondary" href="'.mjl_ui_escape($href).'">'.mjl_ui_escape($options['action']).'</a>';
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
