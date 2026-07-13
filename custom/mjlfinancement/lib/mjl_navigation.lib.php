<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_alerts.lib.php';

function mjl_navigation_items(User $targetUser)
{
	$items = array();
	foreach (mjl_navigation_sections($targetUser) as $section) {
		if (!empty($section['href'])) {
			$items[] = array(
				'key' => $section['key'],
				'label' => $section['label'],
				'href' => $section['href'],
				'description' => $section['description'],
				'primary' => true,
				'section' => $section['key'],
			);
		}
		foreach ($section['children'] as $child) {
			$child['primary'] = false;
			$child['section'] = $section['key'];
			$items[] = $child;
		}
	}

	return $items;
}

function mjl_navigation_sections(User $targetUser)
{
	$capabilities = mjl_workspace_capabilities($targetUser);
	$sections = array();

	if (mjl_workspace_user_can_enter($targetUser)) {
		$sections[] = array(
			'key' => 'dashboard',
			'label' => 'Tableau de bord',
			'href' => '/custom/mjlfinancement/index.php',
			'description' => 'Vue de travail MJL',
			'children' => array(),
		);
	}
	if ($capabilities['partners_read']) {
		$sections[] = array(
			'key' => 'partners',
			'label' => 'Partenaires / Programmes',
			'href' => '/custom/mjlfinancement/partners.php',
			'description' => 'Perimetres et donnees rattachees',
			'children' => array(
				array('key' => 'partners_list', 'label' => 'Liste des partenaires', 'href' => '/custom/mjlfinancement/partners.php', 'description' => 'Consultation des perimetres'),
			),
		);
	}
	if ($capabilities['projects_read']) {
		$sections[] = array(
			'key' => 'projects',
			'label' => 'Projets',
			'href' => '/custom/mjlfinancement/projects.php',
			'description' => 'Portefeuille et notes projet',
			'children' => array(
				array('key' => 'projects_list', 'label' => 'Liste des projets', 'href' => '/custom/mjlfinancement/projects.php', 'description' => 'Vue MJL des projets'),
			),
		);
	}
	if ($capabilities['activity_read']) {
		$children = array(
			array('key' => 'activities_list', 'label' => 'Liste des activités', 'href' => '/custom/mjlfinancement/activities.php', 'description' => 'Activités et décisions'),
		);
		if (mjl_alerts_user_can_read($targetUser)) {
			$children[] = array('key' => 'activity_alerts', 'label' => 'Alertes activités', 'href' => '/custom/mjlfinancement/alerts.php?scope=activities', 'description' => 'Risques sur activités');
		}
		$sections[] = array(
			'key' => 'activities',
			'label' => 'Activités',
			'href' => '/custom/mjlfinancement/activities.php',
			'description' => 'Suivi des activités et décisions',
			'children' => $children,
		);
	}
	if ($capabilities['expense_read']) {
		$children = array(
			array('key' => 'expenses_list', 'label' => 'Liste des dépenses', 'href' => '/custom/mjlfinancement/expenses.php', 'description' => 'Dépenses et justificatifs'),
		);
		if (mjl_alerts_user_can_read($targetUser)) {
			$children[] = array('key' => 'expense_alerts', 'label' => 'Alertes dépenses', 'href' => '/custom/mjlfinancement/alerts.php?scope=expenses', 'description' => 'Risques sur dépenses');
		}
		$sections[] = array(
			'key' => 'expenses',
			'label' => 'Dépenses',
			'href' => '/custom/mjlfinancement/expenses.php',
			'description' => 'Dépenses et pièces justificatives',
			'children' => $children,
		);
	}
	if ($capabilities['documents_read']) {
		$sections[] = array(
			'key' => 'documents',
			'label' => 'Documents',
			'href' => '/custom/mjlfinancement/documents.php',
			'description' => 'Bibliothèque documentaire',
			'children' => array(
				array('key' => 'documents_library', 'label' => 'Bibliothèque', 'href' => '/custom/mjlfinancement/documents.php', 'description' => 'Consultation et téléchargement'),
			),
		);
	}
	$financeChildren = array();
	if (mjl_workspace_can_access_reference_data($targetUser, 'convention')) {
		$financeChildren[] = array('key' => 'conventions', 'label' => 'Enveloppes de financement', 'href' => '/custom/mjlfinancement/conventions.php', 'description' => 'Financements');
	}
	if (mjl_workspace_can_access_reference_data($targetUser, 'budgetline')) {
		$financeChildren[] = array('key' => 'budgetlines', 'label' => 'Budgets', 'href' => '/custom/mjlfinancement/budgetlines.php', 'description' => 'Lignes budgétaires');
	}
	if (mjl_workspace_can_access_reference_data($targetUser, 'fundreceipt')) {
		$financeChildren[] = array('key' => 'fundreceipts', 'label' => 'Fonds reçus', 'href' => '/custom/mjlfinancement/fundreceipts.php', 'description' => 'Réceptions de fonds');
	}
	if (!empty($financeChildren)) {
		$sections[] = array(
			'key' => 'finance',
			'label' => 'Financement',
			'href' => $financeChildren[0]['href'],
			'description' => 'Enveloppes, budgets et fonds',
			'children' => $financeChildren,
		);
	}
	$supervisionChildren = array();
	if ($capabilities['supervision']) {
		$supervisionChildren[] = array('key' => 'dpaf', 'label' => 'Supervision finance', 'href' => '/custom/mjlfinancement/dpafdashboard.php', 'description' => 'Supervision globale');
	}
	if (mjl_workspace_can_access_validation_history($targetUser)) {
		$supervisionChildren[] = array('key' => 'validations', 'label' => 'Historique des validations', 'href' => '/custom/mjlfinancement/validations.php', 'description' => 'Décisions sur dépenses');
	}
	if (mjl_alerts_user_can_read($targetUser)) {
		$supervisionChildren[] = array('key' => 'alerts', 'label' => 'Alertes globales', 'href' => '/custom/mjlfinancement/alerts.php', 'description' => 'Risques et actions attendues');
	}
	if ($capabilities['supervision']) {
		$supervisionChildren[] = array('key' => 'reports', 'label' => 'Rapports / Exports', 'href' => '/custom/mjlfinancement/reports.php', 'description' => 'Sorties officielles');
	}
	if ($capabilities['workflowaction_read'] && ($capabilities['supervision'] || (!$capabilities['operational'] && !$capabilities['reviewer']))) {
		$supervisionChildren[] = array('key' => 'workflowactions', 'label' => 'Historique / Audit', 'href' => '/custom/mjlfinancement/workflowactions.php', 'description' => 'Audit avancé');
	}
	if (!empty($supervisionChildren)) {
		$sections[] = array(
			'key' => 'supervision',
			'label' => 'Supervision',
			'href' => $supervisionChildren[0]['href'],
			'description' => 'Contrôle et historique',
			'children' => $supervisionChildren,
		);
	}
	$adminChildren = array();
	if ($capabilities['admin']) {
		$adminChildren[] = array('key' => 'admin_access', 'label' => 'Acces utilisateurs', 'href' => '/custom/mjlfinancement/admin/access.php', 'description' => 'Roles et perimetres');
		if ($capabilities['roadmap_read']) {
			$adminChildren[] = array('key' => 'roadmap', 'label' => 'Préparation production', 'href' => '/custom/mjlfinancement/roadmap.php', 'description' => 'Pilotage interne');
		}
	}
	if (!empty($adminChildren)) {
		$sections[] = array(
			'key' => 'administration',
			'label' => 'Administration',
			'href' => $adminChildren[0]['href'],
			'description' => 'Accès et configuration',
			'children' => $adminChildren,
		);
	}

	return $sections;
}

function mjl_navigation_quick_items(User $targetUser)
{
	$items = array();
	foreach (mjl_navigation_sections($targetUser) as $section) {
		if ($section['key'] === 'dashboard' || $section['key'] === 'administration') {
			continue;
		}
		$items[] = array($section['label'], $section['href'], $section['description']);
	}
	return $items;
}

function mjl_navigation_render_quick_section(User $targetUser)
{
	mjl_dashboard_render_link_section(
		'Acces rapides',
		'Les liens affiches respectent le profil temporaire et les droits actifs.',
		mjl_navigation_quick_items($targetUser)
	);
}

function mjl_navigation_shell_start(User $targetUser, $activeKey = '')
{
	print '<div class="mjl-module-shell">';
	print '<aside class="mjl-module-sidebar" aria-label="Menu module MJL">';
	print '<div class="mjl-sidebar-title"><span>MJL-Financement</span><strong>Espace de travail</strong></div>';
	print '<nav class="mjl-sidebar-nav">';
	foreach (mjl_navigation_sections($targetUser) as $section) {
		$isActive = mjl_navigation_section_is_active($section, $activeKey);
		$classes = 'mjl-sidebar-link mjl-sidebar-section-link';
		if ($isActive) {
			$classes .= ' mjl-sidebar-link-active';
		}
		print '<a class="'.$classes.'" href="'.mjl_dashboard_url($section['href']).'">';
		print '<span>'.dol_escape_htmltag($section['label']).'</span>';
		print '<small>'.dol_escape_htmltag($section['description']).'</small>';
		print '</a>';
		if ($isActive && !empty($section['children'])) {
			print '<div class="mjl-sidebar-children">';
			foreach ($section['children'] as $child) {
				$childClasses = 'mjl-sidebar-child-link';
				if ($activeKey !== '' && $activeKey === $child['key']) {
					$childClasses .= ' mjl-sidebar-child-link-active';
				}
				print '<a class="'.$childClasses.'" href="'.mjl_dashboard_url($child['href']).'">'.dol_escape_htmltag($child['label']).'</a>';
			}
			print '</div>';
		}
	}
	print '</nav>';
	print '</aside>';
	print '<main class="mjl-module-main">';
}

function mjl_navigation_section_is_active($section, $activeKey)
{
	if ($activeKey !== '' && $activeKey === $section['key']) {
		return true;
	}
	foreach ($section['children'] as $child) {
		if ($activeKey !== '' && $activeKey === $child['key']) {
			return true;
		}
	}
	return false;
}

function mjl_navigation_shell_end()
{
	print '</main>';
	print '</div>';
}
