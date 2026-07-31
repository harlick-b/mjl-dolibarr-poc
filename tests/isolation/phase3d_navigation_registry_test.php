<?php

require __DIR__.'/../../custom/mjlfinancement/lib/mjl_navigation_registry.lib.php';

function mjl_phase3d_assert($condition, $message)
{
	if (!$condition) {
		fwrite(STDERR, 'FAIL: '.$message.PHP_EOL);
		exit(1);
	}
}

$registry = mjl_navigation_registry();
$constructedLeaf = mjl_navigation_leaf(
	'controle',
	'workflow_audit',
	'Historique / Audit',
	'/custom/mjlfinancement/workflowactions.php',
	30,
	'workflow_audit_read',
	array('/custom/mjlfinancement/exchangelogs.php', '/custom/mjlfinancement/workflowactions.php')
);
mjl_phase3d_assert(
	$constructedLeaf['active_paths'] === array(
		'/custom/mjlfinancement/workflowactions.php',
		'/custom/mjlfinancement/exchangelogs.php',
	),
	'leaf constructor owns canonical-first active-path deduplication'
);
$requiredCategoryKeys = array('id', 'items', 'label', 'order');
$requiredLeafKeys = array('access_policy', 'active_paths', 'category_id', 'id', 'label', 'order', 'path');
$allowedPolicies = array(
	'workspace_enter', 'alerts_read', 'supervision', 'projects_read',
	'activities_read', 'expenses_read', 'documents_read', 'conventions_read',
	'budget_lines_read', 'fund_receipts_read', 'validation_history_read',
	'workflow_audit_read', 'admin', 'roadmap_read',
);
mjl_phase3d_assert(
	array_column($registry, 'id') === array('pilotage', 'execution', 'financement', 'controle', 'administration'),
	'canonical category order'
);
$categoryIds = array();
$categoryOrders = array();
$leafIds = array();
$leafOrdersByCategory = array();
$canonicalPaths = array();
$allActivePaths = array();
foreach ($registry as $category) {
	$categoryKeys = array_keys($category);
	sort($categoryKeys);
	mjl_phase3d_assert($categoryKeys === $requiredCategoryKeys, 'category exposes the complete closed schema');
	mjl_phase3d_assert(is_string($category['id']) && $category['id'] !== '', 'category ID is a non-empty string');
	mjl_phase3d_assert(is_string($category['label']) && $category['label'] !== '', 'category label is a non-empty string');
	mjl_phase3d_assert(is_int($category['order']) && $category['order'] > 0, 'category order is a positive integer');
	mjl_phase3d_assert(is_array($category['items']) && $category['items'] !== array(), 'category has leaves');
	$categoryIds[] = $category['id'];
	$categoryOrders[] = $category['order'];
	$leafOrdersByCategory[$category['id']] = array();
	mjl_phase3d_assert(!isset($category['href']), 'categories are non-clickable');
	foreach ($category['items'] as $item) {
		$itemKeys = array_keys($item);
		sort($itemKeys);
		$expectedKeys = $requiredLeafKeys;
		if (isset($item['aliases'])) {
			$expectedKeys[] = 'aliases';
			sort($expectedKeys);
		}
		mjl_phase3d_assert($itemKeys === $expectedKeys, 'leaf exposes the complete closed schema');
		mjl_phase3d_assert(is_string($item['id']) && $item['id'] !== '', 'leaf ID is a non-empty string');
		mjl_phase3d_assert(preg_match('/^[a-z][a-z0-9_]*$/', $item['id']) === 1, 'leaf ID uses the stable identifier format');
		mjl_phase3d_assert(is_string($item['label']) && $item['label'] !== '', 'leaf label is a non-empty string');
		mjl_phase3d_assert(is_string($item['path']) && $item['path'] !== '', 'leaf path is a non-empty string');
		mjl_phase3d_assert(is_int($item['order']) && $item['order'] > 0, 'leaf order is a positive integer');
		mjl_phase3d_assert(is_string($item['access_policy']), 'leaf policy is a string');
		mjl_phase3d_assert(in_array($item['access_policy'], $allowedPolicies, true), 'leaf policy belongs to the closed set');
		mjl_phase3d_assert($item['category_id'] === $category['id'], 'leaf carries its stable category ID');
		mjl_phase3d_assert(isset($item['active_paths']) && is_array($item['active_paths']), 'leaf defines an exact active-path matcher');
		mjl_phase3d_assert($item['active_paths'][0] === $item['path'], 'active-path matcher starts with the canonical path');
		$aliases = isset($item['aliases']) ? $item['aliases'] : array();
		mjl_phase3d_assert(is_array($aliases), 'leaf aliases are an array when declared');
		mjl_phase3d_assert(count(array_unique($aliases)) === count($aliases), 'declared aliases are unique');
		mjl_phase3d_assert(!in_array($item['path'], $aliases, true), 'declared aliases do not repeat the canonical path');
		mjl_phase3d_assert($item['active_paths'] === array_values(array_unique(array_merge(array($item['path']), $aliases))), 'active paths are canonical-first and deduplicated');
		foreach ($item['active_paths'] as $activePath) {
			mjl_phase3d_assert(is_string($activePath) && preg_match('~^/[^?#]+$~', $activePath) === 1, 'active path is an exact absolute path without query or fragment');
			$allActivePaths[] = $activePath;
		}
		$leafIds[] = $item['id'];
		$canonicalPaths[] = $item['path'];
		$leafOrdersByCategory[$category['id']][] = $item['order'];
	}
}
mjl_phase3d_assert(count(array_unique($categoryIds)) === count($categoryIds), 'category IDs are globally unique');
foreach ($categoryIds as $categoryId) {
	mjl_phase3d_assert(preg_match('/^[a-z][a-z0-9_]*$/', $categoryId) === 1, 'category ID uses the stable identifier format');
}
mjl_phase3d_assert(count(array_unique($categoryOrders)) === count($categoryOrders), 'category orders are unique');
$sortedCategoryOrders = $categoryOrders;
sort($sortedCategoryOrders);
mjl_phase3d_assert($categoryOrders === $sortedCategoryOrders, 'category declaration order follows stable numeric order');
mjl_phase3d_assert(count(array_unique($leafIds)) === count($leafIds), 'leaf IDs are globally unique');
mjl_phase3d_assert(count(array_unique($canonicalPaths)) === count($canonicalPaths), 'canonical paths are globally unique');
mjl_phase3d_assert(count(array_unique($allActivePaths)) === count($allActivePaths), 'canonical and alias active paths are globally unique');
foreach ($leafOrdersByCategory as $orders) {
	mjl_phase3d_assert(count(array_unique($orders)) === count($orders), 'leaf orders are unique within a category');
	$sortedOrders = $orders;
	sort($sortedOrders);
	mjl_phase3d_assert($orders === $sortedOrders, 'leaf declaration order follows stable numeric order');
}

$leaves = array();
foreach ($registry as $category) {
	foreach ($category['items'] as $item) {
		$leaves[] = $item;
	}
}
mjl_phase3d_assert(
	array_column($leaves, 'id') === array(
		'dashboard',
		'alerts',
		'financial_supervision',
		'projects',
		'activities',
		'expenses',
		'documents',
		'funding_envelopes',
		'budget_lines',
		'fund_receipts',
		'validation_history',
		'reports',
		'workflow_audit',
		'partners',
		'access',
		'production_readiness',
	),
	'canonical leaf order'
);

$activeCases = array(
	array('/custom/mjlfinancement/reports.php?report=audit#results', '', 'reports'),
	array('/dolibarr/custom/mjlfinancement/activities.php?action=create', '/dolibarr', 'activities'),
	array('/custom/mjlfinancement/exchangelogs.php', '', 'workflow_audit'),
	array('/custom/mjlfinancement/nativeforbidden.php', '', ''),
	array('/custom/mjlfinancement/documentdownload.php?id=12', '', ''),
	array('/custom/mjlfinancement/reports.php/extra', '', ''),
);
foreach ($activeCases as $case) {
	mjl_phase3d_assert(
		mjl_navigation_active_item_id($case[0], $case[1]) === $case[2],
		'exact active path for '.$case[0]
	);
}
mjl_phase3d_assert(
	mjl_navigation_active_state('/custom/mjlfinancement/reports.php?report=audit', '') === array('id' => 'reports', 'current' => 'page'),
	'canonical route is the current page'
);
mjl_phase3d_assert(
	mjl_navigation_active_state('/custom/mjlfinancement/exchangelogs.php', '') === array('id' => 'workflow_audit', 'current' => 'location'),
	'contextual alias marks the canonical audit location'
);

$projected = mjl_navigation_project_registry(array(
	'workspace_enter' => true,
	'activities_read' => true,
	'expenses_read' => true,
));
mjl_phase3d_assert(
	array_column($projected, 'id') === array('pilotage', 'execution'),
	'empty categories are removed'
);
mjl_phase3d_assert(
	array_column($projected[1]['items'], 'id') === array('activities', 'expenses'),
	'permission projection preserves relative leaf order'
);

print 'Phase 3D navigation registry: OK'.PHP_EOL;
