<?php

function mjl_table_normalize_request($raw, $allowedStatuses, $accessibleProjectIds, $total = null, $pageSize = 50, $accessiblePartnerIds = array())
{
	$raw = (array) $raw;
	$pageSize = max(1, min(200, (int) $pageSize));
	$result = array(
		'status' => '',
		'partner' => 0,
		'project' => 0,
		'risk' => 'all',
		'sort' => 'priority',
		'page' => 1,
		'page_size' => $pageSize,
		'fail_closed' => false,
	);
	$partner = trim((string) ($raw['partner'] ?? ''));
	if ($partner !== '') {
		if (!preg_match('/^[1-9][0-9]{0,9}$/', $partner)) {
			$result['fail_closed'] = true;
		} else {
			$result['partner'] = (int) $partner;
			if (!in_array((int) $partner, array_map('intval', (array) $accessiblePartnerIds), true)) {
				$result['fail_closed'] = true;
			}
		}
	}
	$status = trim((string) ($raw['status'] ?? ''));
	if ($status !== '') {
		if (!in_array($status, array_map('strval', (array) $allowedStatuses), true)) {
			$result['fail_closed'] = true;
		} else {
			$result['status'] = $status;
		}
	}
	$project = trim((string) ($raw['project'] ?? ''));
	if ($project !== '') {
		if (!preg_match('/^[1-9][0-9]{0,9}$/', $project)) {
			$result['fail_closed'] = true;
		} else {
			$result['project'] = (int) $project;
			if (!in_array((int) $project, array_map('intval', (array) $accessibleProjectIds), true)) {
				$result['fail_closed'] = true;
			}
		}
	}
	$risk = trim((string) ($raw['risk'] ?? ''));
	if ($risk === '') $risk = 'all';
	if (!in_array($risk, array('all', 'overdue', 'soon', 'none'), true)) {
		$result['fail_closed'] = true;
	} else {
		$result['risk'] = $risk;
	}
	$sort = trim((string) ($raw['sort'] ?? ''));
	if ($sort === '') $sort = 'priority';
	if (!in_array($sort, array('priority', 'recent', 'deadline'), true)) {
		$result['fail_closed'] = true;
	} else {
		$result['sort'] = $sort;
	}
	$page = trim((string) ($raw['page'] ?? ''));
	if ($page === '') $page = '1';
	if (!preg_match('/^[1-9][0-9]{0,8}$/', $page)) {
		$result['fail_closed'] = true;
	} else {
		$result['page'] = (int) $page;
	}
	if ($result['fail_closed']) {
		$result['page'] = 1;
		return $result;
	}
	if ($total !== null) {
		$maxPage = max(1, (int) ceil(max(0, (int) $total) / $pageSize));
		$result['page'] = min($result['page'], $maxPage);
	}
	return $result;
}

function mjl_table_escape($value)
{
	return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function mjl_table_normalize_generic($raw, $schema, $pageSize = 50, $total = null)
{
	$raw = (array) $raw;
	$result = array('page_size' => max(1, min(200, (int) $pageSize)), 'fail_closed' => false);
	foreach ((array) $schema as $key => $rule) {
		$key = preg_replace('/[^a-z0-9_]/i', '', (string) $key);
		if ($key === '') continue;
		$type = (string) ($rule['type'] ?? 'text');
		$default = $rule['default'] ?? '';
		$value = isset($raw[$key]) && is_scalar($raw[$key]) ? trim((string) $raw[$key]) : '';
		if ($value === '') {
			$result[$key] = $default;
			continue;
		}
		if ($type === 'page') {
			if (!preg_match('/^[1-9][0-9]{0,8}$/', $value)) $result['fail_closed'] = true;
			else $result[$key] = (int) $value;
		} elseif ($type === 'id') {
			if (!preg_match('/^[1-9][0-9]{0,9}$/', $value)) {
				$result['fail_closed'] = true;
			} else {
				$result[$key] = (int) $value;
				if (isset($rule['allowed']) && !in_array((int) $value, array_map('intval', (array) $rule['allowed']), true)) $result['fail_closed'] = true;
			}
		} elseif ($type === 'enum') {
			if (!in_array($value, array_map('strval', (array) ($rule['allowed'] ?? array())), true)) $result['fail_closed'] = true;
			else $result[$key] = $value;
		} else {
			$result[$key] = substr($value, 0, 120);
		}
		if (!array_key_exists($key, $result)) $result[$key] = $default;
	}
	if (!isset($result['page'])) $result['page'] = 1;
	if ($result['fail_closed']) {
		$result['page'] = 1;
		return $result;
	}
	if ($total !== null) {
		$maxPage = max(1, (int) ceil(max(0, (int) $total) / $result['page_size']));
		$result['page'] = min((int) $result['page'], $maxPage);
	}
	return $result;
}

function mjl_table_retained_query($normalized, $overrides = array())
{
	$values = array_merge((array) $normalized, (array) $overrides);
	$query = array();
	foreach ($values as $key => $value) {
		if (in_array($key, array('page_size', 'fail_closed'), true) || is_array($value) || is_object($value) || $value === '' || $value === null) continue;
		if (is_int($value) && $value === 0) continue;
		if ($key === 'page' && (int) $value === 1) continue;
		if (is_bool($value)) $value = $value ? '1' : '0';
		$query[preg_replace('/[^a-z0-9_]/i', '', (string) $key)] = (string) $value;
	}
	return http_build_query($query, '', '&', PHP_QUERY_RFC3986);
}

function mjl_table_count_or_null($database, $sql)
{
	$result = $database->query((string) $sql);
	if (!$result || !($row = $database->fetch_object($result))) return null;
	return isset($row->nb) ? (int) $row->nb : null;
}

function mjl_table_render_filter_bar($baseUrl, $resourceKey, $resourceLabel, $fields)
{
	$resourceKey = strtolower(preg_replace('/[^a-z0-9_-]/i', '', (string) $resourceKey));
	if ($resourceKey === '') $resourceKey = 'results';
	$resourceLabel = trim((string) $resourceLabel);
	if ($resourceLabel === '') $resourceLabel = 'résultats';
	$active = array();
	$html = '<form class="mjl-table-filters" method="GET" action="'.mjl_table_escape($baseUrl).'" data-mjl-table-filters="'.mjl_table_escape($resourceKey).'" aria-label="Filtres des '.mjl_table_escape($resourceLabel).'">';
	foreach ((array) $fields as $field) {
		$name = strtolower(preg_replace('/[^a-z0-9_]/i', '', (string) ($field['name'] ?? '')));
		if ($name === '') continue;
		$label = trim((string) ($field['label'] ?? $name));
		$options = (array) ($field['options'] ?? array());
		$value = (string) ($field['value'] ?? '');
		$default = (string) ($field['default'] ?? '');
		$optionLabels = array();
		foreach ($options as $optionValue => $optionLabel) {
			if (!is_scalar($optionLabel)) continue;
			$optionLabels[(string) $optionValue] = (string) $optionLabel;
		}
		if (!array_key_exists($value, $optionLabels)) $value = array_key_exists($default, $optionLabels) ? $default : (string) array_key_first($optionLabels);
		$id = 'mjl-filter-'.$resourceKey.'-'.$name;
		$html .= '<label for="'.mjl_table_escape($id).'">'.mjl_table_escape($label).'<select id="'.mjl_table_escape($id).'" name="'.mjl_table_escape($name).'">';
		foreach ($optionLabels as $optionValue => $optionLabel) {
			$optionValue = (string) $optionValue;
			$html .= '<option value="'.mjl_table_escape($optionValue).'"'.($value === $optionValue ? ' selected' : '').'>'.mjl_table_escape($optionLabel).'</option>';
		}
		$html .= '</select></label>';
		if ($value !== $default && isset($optionLabels[$value])) $active[] = $label.' : '.$optionLabels[$value];
	}
	$html .= '<button class="button mjl-action mjl-action-primary" type="submit">Appliquer</button>';
	$html .= '<a class="mjl-action mjl-action-secondary" href="'.mjl_table_escape($baseUrl).'">Réinitialiser</a>';
	$html .= '<p class="mjl-filter-summary" aria-live="polite">'.(!empty($active) ? '<strong>Filtres actifs :</strong> '.mjl_table_escape(implode(' · ', $active)) : 'Aucun filtre actif.').'</p>';
	return $html.'</form>';
}

function mjl_table_render_pagination($baseUrl, $normalized, $total, $hasPrevious, $hasNext, $resourceLabel)
{
	$page = max(1, (int) ($normalized['page'] ?? 1));
	$resourceLabel = trim(preg_replace('/[^[:alnum:]À-ÿ _-]/u', '', (string) $resourceLabel));
	if ($resourceLabel === '') $resourceLabel = 'résultats';
	$html = '<nav class="mjl-pagination" aria-label="Pagination des '.mjl_table_escape($resourceLabel).'">';
	if ($hasPrevious) {
		$query = mjl_table_retained_query($normalized, array('page' => $page - 1));
		$html .= '<a class="mjl-action mjl-action-secondary" rel="prev" href="'.mjl_table_escape($baseUrl.($query !== '' ? '?'.$query : '')).'">Page précédente</a>';
	}
	$html .= '<span aria-current="page">Page '.$page;
	if ($total !== null) {
		$pages = max(1, (int) ceil(max(0, (int) $total) / max(1, (int) ($normalized['page_size'] ?? 50))));
		$html .= ' sur '.$pages.' — '.((int) $total).' '.mjl_table_escape($resourceLabel);
	} else {
		$html .= ' — total indisponible';
	}
	$html .= '</span>';
	if ($hasNext) {
		$query = mjl_table_retained_query($normalized, array('page' => $page + 1));
		$html .= '<a class="mjl-action mjl-action-secondary" rel="next" href="'.mjl_table_escape($baseUrl.($query !== '' ? '?'.$query : '')).'">Page suivante</a>';
	}
	return $html.'</nav>';
}

/**
 * Render already-authorized secondary record links as an accessible menu.
 *
 * Authorization and action availability belong to the calling route. This
 * helper only validates descriptor shape, escapes presentation values, and
 * suppresses an empty trigger.
 */
function mjl_table_render_action_menu($recordLabel, $actions)
{
	$items = array();
	foreach ((array) $actions as $action) {
		if (!is_array($action) || !is_scalar($action['label'] ?? null) || !is_scalar($action['href'] ?? null)) continue;
		$label = trim((string) $action['label']);
		$href = trim((string) $action['href']);
		if ($label === '' || $href === '') continue;
		$tone = (string) ($action['tone'] ?? '');
		$items[] = array('label' => $label, 'href' => $href, 'tone' => in_array($tone, array('danger'), true) ? $tone : '');
	}
	if (empty($items)) return '';
	$recordLabel = trim((string) $recordLabel);
	if ($recordLabel === '') $recordLabel = 'cet enregistrement';
	$html = '<details class="mjl-table-action-menu" data-mjl-action-menu>';
	$html .= '<summary aria-label="Actions pour '.mjl_table_escape($recordLabel).'" aria-expanded="false">Actions</summary>';
	$html .= '<div class="mjl-table-action-menu-panel" role="menu">';
	foreach ($items as $item) {
		$class = 'mjl-table-action-menu-item'.($item['tone'] !== '' ? ' mjl-table-action-menu-item-'.$item['tone'] : '');
		$html .= '<a class="'.$class.'" role="menuitem" href="'.mjl_table_escape($item['href']).'">'.mjl_table_escape($item['label']).'</a>';
	}
	return $html.'</div></details>';
}
