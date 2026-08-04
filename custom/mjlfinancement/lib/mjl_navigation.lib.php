<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_alerts.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation_registry.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';

function mjl_navigation_policy_allows(User $targetUser, $policy)
{
	switch ((string) $policy) {
		case 'workspace_enter':
			return mjl_workspace_user_can_enter($targetUser);
		case 'alerts_read':
			return mjl_alerts_user_can_read($targetUser);
		case 'supervision':
			return mjl_workspace_can_access_supervision($targetUser);
		case 'projects_read':
			return mjl_workspace_can_access_projects($targetUser);
		case 'activities_read':
			return mjl_workspace_can_access_activity($targetUser);
		case 'expenses_read':
			return mjl_workspace_can_access_expense($targetUser);
		case 'documents_read':
			return mjl_workspace_can_access_documents($targetUser);
		case 'conventions_read':
			return mjl_workspace_can_access_reference_data($targetUser, 'convention');
		case 'budget_lines_read':
			return mjl_workspace_can_access_reference_data($targetUser, 'budgetline');
		case 'fund_receipts_read':
			return mjl_workspace_can_access_reference_data($targetUser, 'fundreceipt');
		case 'validation_history_read':
			return mjl_workspace_can_access_validation_history($targetUser);
		case 'workflow_audit_read':
			return mjl_workspace_can_access_advanced_traceability($targetUser, 'workflowaction');
		case 'admin':
			return mjl_workspace_is_admin($targetUser);
		case 'roadmap_read':
			return mjl_workspace_can_access_roadmap($targetUser);
	}
	return false;
}

function mjl_navigation_sections(User $targetUser)
{
	$allowedPolicies = array();
	foreach (mjl_navigation_registry() as $category) {
		foreach ($category['items'] as $item) {
			$policy = $item['access_policy'];
			if (!array_key_exists($policy, $allowedPolicies)) {
				$allowedPolicies[$policy] = mjl_navigation_policy_allows($targetUser, $policy);
			}
		}
	}
	return mjl_navigation_project_registry($allowedPolicies);
}

function mjl_navigation_items(User $targetUser)
{
	$items = array();
	foreach (mjl_navigation_sections($targetUser) as $category) {
		foreach ($category['items'] as $item) {
			$items[] = $item;
		}
	}
	return $items;
}

function mjl_navigation_request_uri()
{
	if (!empty($_SERVER['REQUEST_URI'])) {
		return (string) $_SERVER['REQUEST_URI'];
	}
	return isset($_SERVER['PHP_SELF']) ? (string) $_SERVER['PHP_SELF'] : '';
}

function mjl_navigation_current_state()
{
	return mjl_navigation_active_state(mjl_navigation_request_uri(), defined('DOL_URL_ROOT') ? DOL_URL_ROOT : '');
}

function mjl_navigation_shell_start(User $targetUser)
{
	$activeState = mjl_navigation_current_state();
	print '<div class="mjl-module-shell">';
	print '<a class="mjl-skip-link" href="#mjl-main-content">Aller au contenu principal</a>';
	print '<button class="mjl-navigation-trigger" type="button" aria-controls="mjl-primary-navigation" aria-expanded="false">Ouvrir le menu principal</button>';
	print '<button class="mjl-navigation-backdrop" type="button" data-mjl-navigation-backdrop aria-label="Fermer le menu principal"></button>';
	print '<aside class="mjl-module-sidebar" id="mjl-primary-navigation" aria-label="Menu module MJL">';
	print '<button class="mjl-navigation-close" type="button" data-mjl-navigation-close>Fermer le menu</button>';
	print '<div class="mjl-sidebar-title"><span>MJL Financement</span><strong>Espace de travail</strong></div>';
	print '<nav class="mjl-sidebar-nav">';
	foreach (mjl_navigation_sections($targetUser) as $category) {
		print '<section class="mjl-sidebar-section" aria-labelledby="mjl-nav-category-'.dol_escape_htmltag($category['id']).'">';
		print '<h2 class="mjl-sidebar-category" id="mjl-nav-category-'.dol_escape_htmltag($category['id']).'">'.dol_escape_htmltag($category['label']).'</h2>';
		print '<div class="mjl-sidebar-items">';
		foreach ($category['items'] as $item) {
			$classes = 'mjl-sidebar-link';
			$currentAttribute = '';
			if ($activeState['id'] !== '' && $activeState['id'] === $item['id']) {
				$classes .= ' mjl-sidebar-link-active';
				$currentAttribute = ' aria-current="'.dol_escape_htmltag($activeState['current']).'"';
			}
			print '<a class="'.$classes.'" href="'.mjl_dashboard_url($item['path']).'"'.$currentAttribute.'>';
			print '<span>'.dol_escape_htmltag($item['label']).'</span>';
			print '</a>';
		}
		print '</div>';
		print '</section>';
	}
	print '</nav>';
	print '</aside>';
	print '<main class="mjl-module-main" id="mjl-main-content" tabindex="-1">';
	print mjl_feedback_render_and_clear();
}

function mjl_navigation_shell_end()
{
	print mjl_feedback_render_and_clear();
	print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_components.js"></script>';
	print '</main>';
	print '</div>';
}
