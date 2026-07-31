<?php

/**
 * Pure presentation registry for the MJL primary navigation.
 *
 * Access policies are identifiers only. Their mapping to existing access
 * helpers belongs to mjl_navigation.lib.php.
 */
function mjl_navigation_leaf($categoryId, $id, $label, $path, $order, $accessPolicy, array $aliases = array())
{
	$activePaths = array_values(array_unique(array_merge(array($path), $aliases)));
	$leaf = array(
		'id' => $id,
		'category_id' => $categoryId,
		'label' => $label,
		'path' => $path,
		'order' => $order,
		'access_policy' => $accessPolicy,
		'active_paths' => $activePaths,
	);
	if (!empty($aliases)) {
		$leaf['aliases'] = $aliases;
	}
	return $leaf;
}

function mjl_navigation_registry()
{
	$registry = array(
		array(
			'id' => 'pilotage',
			'label' => 'Pilotage',
			'order' => 10,
			'items' => array(
				mjl_navigation_leaf('pilotage', 'dashboard', 'Tableau de bord', '/custom/mjlfinancement/index.php', 10, 'workspace_enter'),
				mjl_navigation_leaf('pilotage', 'alerts', 'Alertes', '/custom/mjlfinancement/alerts.php', 20, 'alerts_read'),
				mjl_navigation_leaf('pilotage', 'financial_supervision', 'Supervision financière', '/custom/mjlfinancement/dpafdashboard.php', 30, 'supervision'),
			),
		),
		array(
			'id' => 'execution',
			'label' => 'Exécution des projets',
			'order' => 20,
			'items' => array(
				mjl_navigation_leaf('execution', 'projects', 'Projets', '/custom/mjlfinancement/projects.php', 10, 'projects_read'),
				mjl_navigation_leaf('execution', 'activities', 'Activités', '/custom/mjlfinancement/activities.php', 20, 'activities_read'),
				mjl_navigation_leaf('execution', 'expenses', 'Dépenses / Décaissements', '/custom/mjlfinancement/expenses.php', 30, 'expenses_read'),
				mjl_navigation_leaf('execution', 'documents', 'Documents', '/custom/mjlfinancement/documents.php', 40, 'documents_read'),
			),
		),
		array(
			'id' => 'financement',
			'label' => 'Financement',
			'order' => 30,
			'items' => array(
				mjl_navigation_leaf('financement', 'funding_envelopes', 'Enveloppes de financement', '/custom/mjlfinancement/conventions.php', 10, 'conventions_read'),
				mjl_navigation_leaf('financement', 'budget_lines', 'Lignes budgétaires', '/custom/mjlfinancement/budgetlines.php', 20, 'budget_lines_read'),
				mjl_navigation_leaf('financement', 'fund_receipts', 'Fonds reçus', '/custom/mjlfinancement/fundreceipts.php', 30, 'fund_receipts_read'),
			),
		),
		array(
			'id' => 'controle',
			'label' => 'Contrôle et rapports',
			'order' => 40,
			'items' => array(
				mjl_navigation_leaf('controle', 'validation_history', 'Historique des validations', '/custom/mjlfinancement/validations.php', 10, 'validation_history_read'),
				mjl_navigation_leaf('controle', 'reports', 'Rapports', '/custom/mjlfinancement/reports.php', 20, 'supervision'),
				mjl_navigation_leaf('controle', 'workflow_audit', 'Historique / Audit', '/custom/mjlfinancement/workflowactions.php', 30, 'workflow_audit_read', array('/custom/mjlfinancement/exchangelogs.php')),
			),
		),
		array(
			'id' => 'administration',
			'label' => 'Administration',
			'order' => 50,
			'items' => array(
				mjl_navigation_leaf('administration', 'partners', 'Partenaires / Programmes', '/custom/mjlfinancement/partners.php', 10, 'admin'),
				mjl_navigation_leaf('administration', 'access', 'Utilisateurs et accès', '/custom/mjlfinancement/admin/access.php', 20, 'admin'),
				mjl_navigation_leaf('administration', 'production_readiness', 'Préparation production', '/custom/mjlfinancement/roadmap.php', 30, 'roadmap_read'),
			),
		),
	);
	return $registry;
}

function mjl_navigation_normalize_request_path($requestUri, $dolUrlRoot = '')
{
	$path = parse_url((string) $requestUri, PHP_URL_PATH);
	if (!is_string($path) || $path === '') {
		return '';
	}
	$root = rtrim((string) $dolUrlRoot, '/');
	if ($root !== '' && $root !== '/' && ($path === $root || strpos($path, $root.'/') === 0)) {
		$path = substr($path, strlen($root));
	}
	if ($path === '') {
		return '/';
	}
	return '/'.ltrim($path, '/');
}

function mjl_navigation_project_registry(array $allowedPolicies)
{
	$visible = array();
	foreach (mjl_navigation_registry() as $category) {
		$items = array();
		foreach ($category['items'] as $item) {
			if (!empty($allowedPolicies[$item['access_policy']])) {
				$items[] = $item;
			}
		}
		if (!empty($items)) {
			$category['items'] = $items;
			$visible[] = $category;
		}
	}
	return $visible;
}

function mjl_navigation_active_item_id($requestUri, $dolUrlRoot = '')
{
	$state = mjl_navigation_active_state($requestUri, $dolUrlRoot);
	return $state['id'];
}

function mjl_navigation_active_state($requestUri, $dolUrlRoot = '')
{
	$path = mjl_navigation_normalize_request_path($requestUri, $dolUrlRoot);
	foreach (mjl_navigation_registry() as $category) {
		foreach ($category['items'] as $item) {
			if (in_array($path, $item['active_paths'], true)) {
				return array('id' => $item['id'], 'current' => $path === $item['path'] ? 'page' : 'location');
			}
		}
	}
	return array('id' => '', 'current' => '');
}
