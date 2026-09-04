<?php

function mjl_navigation_leaf($categoryId, $id, $label, $path, $order, $accessPolicy, array $aliases = array())
{
	$leaf = array(
		'id' => $id,
		'category_id' => $categoryId,
		'label' => $label,
		'path' => $path,
		'order' => $order,
		'access_policy' => $accessPolicy,
		'active_paths' => array_values(array_unique(array_merge(array($path), $aliases))),
	);
	if (!empty($aliases)) $leaf['aliases'] = $aliases;
	return $leaf;
}

function mjl_navigation_registry()
{
	return array(
		array('id' => 'espace', 'label' => 'Espace MJL', 'order' => 10, 'items' => array(
			mjl_navigation_leaf('espace', 'home', 'Accueil', '/custom/mjlfinancement/index.php', 10, 'workspace_enter'),
		)),
		array('id' => 'references', 'label' => 'Références', 'order' => 20, 'items' => array(
			mjl_navigation_leaf('references', 'partners', 'Partenaires', '/custom/mjlfinancement/partners.php', 10, 'references_read'),
			mjl_navigation_leaf('references', 'projects', 'Projets', '/custom/mjlfinancement/projects.php', 20, 'references_read'),
			mjl_navigation_leaf('references', 'operation_types', 'Types d’opération', '/custom/mjlfinancement/operationtypes.php', 30, 'references_read'),
		)),
		array('id' => 'planification', 'label' => 'Planification', 'order' => 25, 'items' => array(
			mjl_navigation_leaf('planification', 'activities', 'Activités', '/custom/mjlfinancement/activities.php', 10, 'planning_read'),
			mjl_navigation_leaf('planification', 'operations', 'Opérations', '/custom/mjlfinancement/operations.php', 20, 'planning_read'),
		)),
		array('id' => 'controle', 'label' => 'Contrôle', 'order' => 30, 'items' => array(
			mjl_navigation_leaf('controle', 'audit', 'Audit', '/custom/mjlfinancement/workflowactions.php', 10, 'audit_read'),
		)),
		array('id' => 'administration', 'label' => 'Administration', 'order' => 40, 'items' => array(
			mjl_navigation_leaf('administration', 'access', 'Utilisateurs et accès', '/custom/mjlfinancement/admin/access.php', 10, 'admin'),
			mjl_navigation_leaf('administration', 'technical', 'Administration technique', '/admin/modules.php', 20, 'admin'),
		)),
	);
}

function mjl_navigation_normalize_request_path($requestUri, $dolUrlRoot = '')
{
	$path = parse_url((string) $requestUri, PHP_URL_PATH);
	if (!is_string($path) || $path === '') return '';
	$root = rtrim((string) $dolUrlRoot, '/');
	if ($root !== '' && $root !== '/' && ($path === $root || strpos($path, $root.'/') === 0)) $path = substr($path, strlen($root));
	return $path === '' ? '/' : '/'.ltrim($path, '/');
}

function mjl_navigation_project_registry(array $allowedPolicies)
{
	$visible = array();
	foreach (mjl_navigation_registry() as $category) {
		$items = array();
		foreach ($category['items'] as $item) if (!empty($allowedPolicies[$item['access_policy']])) $items[] = $item;
		if (!empty($items)) { $category['items'] = $items; $visible[] = $category; }
	}
	return $visible;
}

function mjl_navigation_active_state($requestUri, $dolUrlRoot = '')
{
	$path = mjl_navigation_normalize_request_path($requestUri, $dolUrlRoot);
	foreach (mjl_navigation_registry() as $category) foreach ($category['items'] as $item) {
		if (in_array($path, $item['active_paths'], true)) return array('id' => $item['id'], 'current' => $path === $item['path'] ? 'page' : 'location');
	}
	return array('id' => '', 'current' => '');
}

function mjl_navigation_active_item_id($requestUri, $dolUrlRoot = '')
{
	$state = mjl_navigation_active_state($requestUri, $dolUrlRoot);
	return $state['id'];
}
