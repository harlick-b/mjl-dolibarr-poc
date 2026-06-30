<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';

function mjl_navigation_items(User $targetUser)
{
	$capabilities = mjl_workspace_capabilities($targetUser);
	$items = array();

	if (mjl_workspace_user_can_read($targetUser)) {
		$items[] = array(
			'key' => 'dashboard',
			'label' => 'Tableau de bord',
			'href' => '/custom/mjlfinancement/index.php',
			'description' => 'Vue de travail MJL',
			'primary' => true,
		);
	}
	if ($capabilities['activity_read']) {
		$items[] = array(
			'key' => 'activities',
			'label' => 'Activites',
			'href' => '/custom/mjlfinancement/activities.php',
			'description' => 'Suivi des activites et decisions',
			'primary' => true,
		);
	}
	if ($capabilities['activity_read'] || $capabilities['expense_read']) {
		$items[] = array(
			'key' => 'alerts',
			'label' => 'Alertes',
			'href' => '/custom/mjlfinancement/alerts.php',
			'description' => 'Risques et actions attendues',
			'primary' => true,
		);
	}
	if ($capabilities['expense_read']) {
		$items[] = array(
			'key' => 'expenses',
			'label' => 'Depenses',
			'href' => '/custom/mjlfinancement/expenses.php',
			'description' => 'Depenses et pieces justificatives',
			'primary' => true,
		);
	}
	if ($capabilities['validation_read'] && ($capabilities['reviewer'] || $capabilities['supervision'] || $capabilities['admin'] || !$capabilities['operational'])) {
		$items[] = array(
			'key' => 'validations',
			'label' => 'Validations',
			'href' => '/custom/mjlfinancement/validations.php',
			'description' => 'Trace des decisions sur depenses',
			'primary' => !$capabilities['operational'],
		);
	}
	if ($capabilities['supervision']) {
		$items[] = array(
			'key' => 'dpaf',
			'label' => 'Tableau DPAF',
			'href' => '/custom/mjlfinancement/dpafdashboard.php',
			'description' => 'Supervision et alertes globales',
			'primary' => true,
		);
		$items[] = array(
			'key' => 'reports',
			'label' => 'Exports',
			'href' => '/custom/mjlfinancement/reports.php',
			'description' => 'Exports et sorties officielles',
			'primary' => true,
		);
	}
	if ($capabilities['supervision'] && $targetUser->hasRight('mjlfinancement', 'convention', 'read')) {
		$items[] = array(
			'key' => 'conventions',
			'label' => 'Conventions',
			'href' => '/custom/mjlfinancement/conventions.php',
			'description' => 'Consultation des enveloppes de financement',
			'primary' => false,
		);
	}
	if ($capabilities['supervision'] && $targetUser->hasRight('mjlfinancement', 'budgetline', 'read')) {
		$items[] = array(
			'key' => 'budgetlines',
			'label' => 'Budgets',
			'href' => '/custom/mjlfinancement/budgetlines.php',
			'description' => 'Consultation des lignes budgetaires',
			'primary' => false,
		);
	}
	if ($capabilities['supervision'] && $targetUser->hasRight('mjlfinancement', 'fundreceipt', 'read')) {
		$items[] = array(
			'key' => 'fundreceipts',
			'label' => 'Fonds recus',
			'href' => '/custom/mjlfinancement/fundreceipts.php',
			'description' => 'Consultation des receptions de fonds',
			'primary' => false,
		);
	}
	if ($capabilities['workflowaction_read'] && ($capabilities['supervision'] || (!$capabilities['operational'] && !$capabilities['reviewer']))) {
		$items[] = array(
			'key' => 'workflowactions',
			'label' => 'Historique / Audit',
			'href' => '/custom/mjlfinancement/workflowactions.php',
			'description' => 'Audit avance des decisions',
			'primary' => !$capabilities['operational'],
		);
	}
	if ($capabilities['exchangelog_read'] && ($capabilities['supervision'] || (!$capabilities['operational'] && !$capabilities['reviewer']))) {
		$items[] = array(
			'key' => 'exchanges',
			'label' => 'Echanges',
			'href' => '/custom/mjlfinancement/exchangelogs.php',
			'description' => 'Journal des echanges',
			'primary' => !$capabilities['operational'],
		);
	}
	if ($capabilities['admin']) {
		$items[] = array(
			'key' => 'admin_access',
			'label' => 'Invitations',
			'href' => '/custom/mjlfinancement/admin/access.php',
			'description' => 'Gestion des acces invitation-only',
			'primary' => true,
		);
		$items[] = array(
			'key' => 'roadmap',
			'label' => 'Preparation production',
			'href' => '/custom/mjlfinancement/roadmap.php',
			'description' => 'Limites du POC et suite interne',
			'primary' => false,
		);
	}

	return $items;
}

function mjl_navigation_quick_items(User $targetUser)
{
	$items = array();
	foreach (mjl_navigation_items($targetUser) as $item) {
		if (empty($item['primary']) || $item['key'] === 'dashboard' || $item['key'] === 'roadmap') {
			continue;
		}
		$description = $item['description'];
		if ($item['key'] === 'workflowactions') {
			$description = 'Consultation avancee de l audit';
		}
		$items[] = array($item['label'], $item['href'], $description);
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
	foreach (mjl_navigation_items($targetUser) as $item) {
		$classes = 'mjl-sidebar-link';
		if ($activeKey !== '' && $activeKey === $item['key']) {
			$classes .= ' mjl-sidebar-link-active';
		}
		print '<a class="'.$classes.'" href="'.mjl_dashboard_url($item['href']).'">';
		print '<span>'.dol_escape_htmltag($item['label']).'</span>';
		print '<small>'.dol_escape_htmltag($item['description']).'</small>';
		print '</a>';
	}
	print '</nav>';
	print '</aside>';
	print '<main class="mjl-module-main">';
}

function mjl_navigation_shell_end()
{
	print '</main>';
	print '</div>';
}
