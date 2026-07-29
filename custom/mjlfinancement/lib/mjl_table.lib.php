<?php

function mjl_table_normalize_request($raw, $allowedStatuses, $accessibleProjectIds, $total = null, $pageSize = 50)
{
	$raw = (array) $raw;
	$pageSize = max(1, min(200, (int) $pageSize));
	$result = array(
		'status' => '',
		'project' => 0,
		'risk' => 'all',
		'sort' => 'priority',
		'page' => 1,
		'page_size' => $pageSize,
		'fail_closed' => false,
	);
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
		'project' => 0,
		'risk' => 'all',
		'sort' => 'priority',
		'page' => 1,
	), (array) $normalized, (array) $overrides);
	$query = array();
	foreach (array('status', 'project', 'risk', 'sort', 'page') as $key) {
		$value = $values[$key];
		if (($key === 'status' && $value === '') || ($key === 'project' && (int) $value === 0) || ($key === 'risk' && $value === 'all') || ($key === 'sort' && $value === 'priority') || ($key === 'page' && (int) $value === 1)) {
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
