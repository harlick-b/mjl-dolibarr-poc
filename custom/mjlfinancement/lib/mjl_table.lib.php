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

function mjl_table_query_string($normalized, $overrides = array())
{
	$values = array_merge(array(
		'status' => '',
		'partner' => 0,
		'project' => 0,
		'risk' => 'all',
		'sort' => 'priority',
		'page' => 1,
	), (array) $normalized, (array) $overrides);
	$query = array();
	foreach (array('status', 'partner', 'project', 'risk', 'sort', 'page') as $key) {
		$value = $values[$key];
		if (($key === 'status' && $value === '') || (in_array($key, array('partner', 'project'), true) && (int) $value === 0) || ($key === 'risk' && $value === 'all') || ($key === 'sort' && $value === 'priority') || ($key === 'page' && (int) $value === 1)) {
			continue;
		}
		$query[$key] = (string) $value;
	}
	return http_build_query($query, '', '&', PHP_QUERY_RFC3986);
}

function mjl_table_pagination($baseUrl, $normalized, $total, $hasPrevious, $hasNext)
{
	$page = max(1, (int) ($normalized['page'] ?? 1));
	$html = '<nav class="mjl-pagination" aria-label="Pagination des activités">';
	if ($hasPrevious) {
		$query = mjl_table_query_string($normalized, array('page' => $page - 1));
		$html .= '<a class="mjl-action mjl-action-secondary" rel="prev" href="'.mjl_table_escape($baseUrl.($query !== '' ? '?'.$query : '')).'">Page précédente</a>';
	}
	$html .= '<span>Page '.$page;
	if ($total !== null) {
		$pages = max(1, (int) ceil(max(0, (int) $total) / max(1, (int) $normalized['page_size'])));
		$html .= ' sur '.$pages.' — '.((int) $total).' activité(s)';
	} else {
		$html .= ' — total indisponible';
	}
	$html .= '</span>';
	if ($hasNext) {
		$query = mjl_table_query_string($normalized, array('page' => $page + 1));
		$html .= '<a class="mjl-action mjl-action-secondary" rel="next" href="'.mjl_table_escape($baseUrl.'?'.$query).'">Page suivante</a>';
	}
	return $html.'</nav>';
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
	$html .= '<span>Page '.$page;
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
