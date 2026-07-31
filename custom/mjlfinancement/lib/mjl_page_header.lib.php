<?php

/**
 * Render the general MJL page header.
 *
 * Authorization stays with the caller. This presentation helper preserves the
 * order of already-authorized actions and performs no role or scope checks.
 *
 * @param string $title Required page title.
 * @param array<string, mixed> $options Optional breadcrumb, description,
 *        primary_action, secondary_actions, and context values.
 * @return string Escaped page-header HTML.
 */
function mjl_page_header_render($title, $options = array())
{
	$title = trim((string) $title);
	if ($title === '') {
		throw new InvalidArgumentException('A page header title is required.');
	}

	$description = trim((string) (isset($options['description']) ? $options['description'] : ''));
	$breadcrumb = isset($options['breadcrumb']) && is_array($options['breadcrumb']) ? $options['breadcrumb'] : array();
	$primaryAction = isset($options['primary_action']) && is_array($options['primary_action']) ? $options['primary_action'] : array();
	$secondaryActions = isset($options['secondary_actions']) && is_array($options['secondary_actions']) ? $options['secondary_actions'] : array();
	$context = isset($options['context']) && is_array($options['context']) ? $options['context'] : array();

	$html = '<header class="mjl-page-header" aria-labelledby="mjl-page-title">';
	if (!empty($breadcrumb)) {
		$items = array();
		foreach ($breadcrumb as $item) {
			if (!is_array($item) || trim((string) (isset($item['label']) ? $item['label'] : '')) === '') {
				continue;
			}
			$items[] = $item;
		}
		if (!empty($items)) {
			$html .= '<nav class="mjl-page-header-breadcrumb" aria-label="Fil d’Ariane"><ol>';
			$lastIndex = count($items) - 1;
			foreach ($items as $index => $item) {
				$label = mjl_page_header_escape($item['label']);
				$html .= '<li>';
				if ($index === $lastIndex) {
					$html .= '<span aria-current="page">'.$label.'</span>';
				} elseif (trim((string) (isset($item['href']) ? $item['href'] : '')) !== '') {
					$html .= '<a href="'.mjl_page_header_escape($item['href']).'">'.$label.'</a>';
				} else {
					$html .= '<span>'.$label.'</span>';
				}
				$html .= '</li>';
			}
			$html .= '</ol></nav>';
		}
	}

	$html .= '<div class="mjl-page-header-layout"><div class="mjl-page-header-content">';
	$html .= '<h1 id="mjl-page-title">'.mjl_page_header_escape($title).'</h1>';
	if ($description !== '') {
		$html .= '<p class="mjl-page-header-description">'.mjl_page_header_escape($description).'</p>';
	}
	if (trim((string) (isset($context['label']) ? $context['label'] : '')) !== '' || trim((string) (isset($context['value']) ? $context['value'] : '')) !== '') {
		$html .= '<dl class="mjl-page-header-context"><div><dt>'.mjl_page_header_escape(isset($context['label']) ? $context['label'] : '').'</dt>';
		$html .= '<dd>'.mjl_page_header_escape(isset($context['value']) ? $context['value'] : '').'</dd></div></dl>';
	}
	$html .= '</div>';

	$actionsHtml = '';
	if (mjl_page_header_action_is_renderable($primaryAction)) {
		$actionsHtml .= mjl_page_header_render_action($primaryAction, 'primary');
	}
	foreach ($secondaryActions as $action) {
		if (is_array($action) && mjl_page_header_action_is_renderable($action)) {
			$actionsHtml .= mjl_page_header_render_action($action, 'secondary');
		}
	}
	if ($actionsHtml !== '') {
		$html .= '<div class="mjl-page-header-actions">'.$actionsHtml.'</div>';
	}
	$html .= '</div></header>';

	return $html;
}

function mjl_page_header_action_is_renderable($action)
{
	return trim((string) (isset($action['label']) ? $action['label'] : '')) !== ''
		&& trim((string) (isset($action['href']) ? $action['href'] : '')) !== '';
}

function mjl_page_header_render_action($action, $priority)
{
	return '<a class="mjl-action mjl-action-'.mjl_page_header_escape($priority).' mjl-page-header-action-'.mjl_page_header_escape($priority).'" href="'.mjl_page_header_escape($action['href']).'">'.mjl_page_header_escape($action['label']).'</a>';
}

function mjl_page_header_escape($value)
{
	return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
