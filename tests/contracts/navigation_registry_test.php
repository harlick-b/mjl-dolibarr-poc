<?php

require __DIR__.'/../../custom/mjlfinancement/lib/mjl_navigation_registry.lib.php';

function nav_assert($condition, $message) { if (!$condition) { fwrite(STDERR, 'FAIL: '.$message.PHP_EOL); exit(1); } }

$registry = mjl_navigation_registry();
nav_assert(array_column($registry, 'id') === array('espace', 'references', 'controle', 'administration'), 'Phase 1 category order');
$ids = array();
$paths = array();
$policies = array('workspace_enter', 'references_read', 'audit_read', 'admin');
foreach ($registry as $category) {
	nav_assert(!empty($category['items']), 'No empty category');
	foreach ($category['items'] as $item) {
		nav_assert(in_array($item['access_policy'], $policies, true), 'Closed Phase 1 policy set');
		nav_assert($item['active_paths'] === array($item['path']), 'Exact canonical active path');
		$ids[] = $item['id'];
		$paths[] = $item['path'];
	}
}
nav_assert($ids === array('home', 'partners', 'projects', 'operation_types', 'audit', 'access', 'technical'), 'Exact Phase 1 destinations');
nav_assert(count($paths) === count(array_unique($paths)), 'Unique routes');
nav_assert(mjl_navigation_active_item_id('/custom/mjlfinancement/workflowactions.php?x=1') === 'audit', 'Audit active state');
nav_assert(mjl_navigation_active_item_id('/custom/mjlfinancement/expenses.php') === '', 'Obsolete route has no active state');
$projected = mjl_navigation_project_registry(array('workspace_enter' => true, 'references_read' => true));
nav_assert(array_column($projected, 'id') === array('espace', 'references'), 'Projection removes inaccessible categories');
print 'MJL Phase 1 navigation registry: OK'.PHP_EOL;
