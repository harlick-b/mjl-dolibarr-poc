<?php

/**
 * Dependency-leaf renderers for journey summaries and document states.
 *
 * Callers must pass already-authorized actions. This module performs no
 * database, permission, workflow, or route lookup.
 */

function mjl_journey_render_summary(array $model): string
{
	$title = mjl_journey_escape($model['title'] ?? 'Synthèse');
	$description = mjl_journey_escape($model['description'] ?? '');
	$html = '<section class="mjl-workspace-section mjl-journey-summary">';
	$html .= '<div class="mjl-section-heading"><h2>'.$title.'</h2>';
	if ($description !== '') $html .= '<p>'.$description.'</p>';
	$html .= '</div><dl class="mjl-activity-meta">';
	foreach ((array) ($model['items'] ?? array()) as $item) {
		if (!is_array($item)) continue;
		$label = mjl_journey_escape($item['label'] ?? '');
		$value = mjl_journey_escape($item['value'] ?? '');
		if ($label === '') continue;
		$html .= '<div><dt>'.$label.'</dt><dd>';
		if (array_key_exists('tone', $item)) {
			$tone = mjl_journey_tone($item['tone']);
			$html .= '<span class="mjl-status-pill mjl-status-'.$tone.'">'.$value.'</span>';
		} else {
			$html .= '<span class="mjl-journey-value">'.$value.'</span>';
		}
		$html .= '</dd></div>';
	}
	return $html.'</dl></section>';
}

function mjl_journey_render_document_panel(array $model): string
{
	$states = array('missing', 'downloadable', 'unavailable', 'upload-failed', 'forbidden', 'read-only');
	$state = in_array((string) ($model['state'] ?? ''), $states, true) ? (string) $model['state'] : 'unavailable';
	$title = mjl_journey_escape($model['title'] ?? 'Documents');
	$description = mjl_journey_escape($model['description'] ?? '');
	$stateLabel = mjl_journey_escape($model['state_label'] ?? mjl_journey_document_state_label($state));
	$linkLabel = mjl_journey_escape($model['link_label'] ?? 'Telecharger le document');
	$html = '<section class="mjl-workspace-section mjl-journey-documents">';
	$html .= '<div class="mjl-section-heading"><h2>'.$title.'</h2>';
	if ($description !== '') $html .= '<p>'.$description.'</p>';
	$html .= '</div>';
	$html .= '<div class="mjl-document-summary mjl-document-summary-'.$state.'"><span>'.$stateLabel.'</span></div>';
	$documents = array();
	foreach ((array) ($model['documents'] ?? array()) as $document) {
		if (!is_array($document)) continue;
		$url = mjl_journey_guarded_document_url($document['url'] ?? '');
		$label = mjl_journey_escape($document['label'] ?? 'Document');
		if ($label === '') continue;
		$documents[] = array('label' => $label, 'url' => mjl_journey_escape($url));
	}
	if (!empty($documents)) {
		$html .= '<div class="mjl-document-list">';
		foreach ($documents as $document) {
			$html .= '<div class="mjl-document-row"><span>'.$document['label'].'</span>';
			if ($document['url'] !== '') $html .= '<a class="mjl-table-link" href="'.$document['url'].'">'.$linkLabel.'</a>';
			$html .= '</div>';
		}
		$html .= '</div>';
	}
	if (!empty($model['action']) && is_array($model['action'])) {
		$actionUrl = mjl_journey_local_url($model['action']['url'] ?? '');
		$actionLabel = mjl_journey_escape($model['action']['label'] ?? '');
		if ($actionUrl !== '' && $actionLabel !== '') {
			$html .= '<p><a class="mjl-action mjl-action-secondary" href="'.mjl_journey_escape($actionUrl).'">'.$actionLabel.'</a></p>';
		}
	}
	return $html.'</section>';
}

function mjl_journey_document_state_label($state)
{
	$labels = array(
		'missing' => 'Pièce manquante',
		'downloadable' => 'Pièce disponible',
		'unavailable' => 'Pièce indisponible',
		'upload-failed' => 'Échec de l’ajout',
		'forbidden' => 'Accès interdit',
		'read-only' => 'Consultation uniquement',
	);
	return $labels[$state] ?? $labels['unavailable'];
}

function mjl_journey_tone($tone)
{
	$allowed = array('neutral', 'info', 'success', 'warning', 'danger');
	return in_array((string) $tone, $allowed, true) ? (string) $tone : 'neutral';
}

function mjl_journey_guarded_document_url($url)
{
	$url = mjl_journey_local_url($url);
	if ($url === '') return '';
	$path = (string) parse_url($url, PHP_URL_PATH);
	return $path === '/custom/mjlfinancement/documentdownload.php' ? $url : '';
}

function mjl_journey_local_url($url)
{
	$url = trim((string) $url);
	if ($url === '' || $url[0] !== '/' || substr($url, 0, 2) === '//') return '';
	return $url;
}

function mjl_journey_escape($value)
{
	return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
