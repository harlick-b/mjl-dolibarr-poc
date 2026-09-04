<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation_registry.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';

function mjl_navigation_policy_allows(User $targetUser, $policy)
{
	global $conf;
	$entity = (int) $conf->entity;
	$role = mjl_scope_effective_role_code($targetUser, $entity);
	$business = in_array($role, array('AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'), true);
	if ((int) $targetUser->statut !== 1 || (empty($targetUser->admin) && (int) $targetUser->entity !== $entity)) return false;
	if ($policy === 'workspace_enter') return $business || $role === 'ADMIN_PLATEFORME';
	if ($policy === 'references_read') return $business;
	if ($policy === 'planning_read') return $business;
	if ($policy === 'audit_read') return in_array($role, array('VALIDATEUR_DEFINITIF', 'ADMIN_PLATEFORME'), true);
	if ($policy === 'admin') return $role === 'ADMIN_PLATEFORME';
	return false;
}

function mjl_navigation_sections(User $targetUser)
{
	$policies = array();
	foreach (mjl_navigation_registry() as $category) foreach ($category['items'] as $item) {
		$policies[$item['access_policy']] = mjl_navigation_policy_allows($targetUser, $item['access_policy']);
	}
	return mjl_navigation_project_registry($policies);
}

function mjl_navigation_user_can_enter(User $targetUser)
{
	return mjl_navigation_policy_allows($targetUser, 'workspace_enter');
}

function mjl_navigation_items(User $targetUser)
{
	$items = array();
	foreach (mjl_navigation_sections($targetUser) as $category) foreach ($category['items'] as $item) $items[] = $item;
	return $items;
}

function mjl_navigation_current_state()
{
	$uri = !empty($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : (isset($_SERVER['PHP_SELF']) ? $_SERVER['PHP_SELF'] : '');
	return mjl_navigation_active_state($uri, defined('DOL_URL_ROOT') ? DOL_URL_ROOT : '');
}

function mjl_navigation_shell_start(User $targetUser)
{
	$active = mjl_navigation_current_state();
	print '<div class="mjl-module-shell"><a class="mjl-skip-link" href="#mjl-main-content">Aller au contenu principal</a>';
	print '<button class="mjl-navigation-trigger" type="button" aria-controls="mjl-primary-navigation" aria-expanded="false">Ouvrir le menu principal</button>';
	print '<button class="mjl-navigation-backdrop" type="button" data-mjl-navigation-backdrop aria-label="Fermer le menu principal"></button>';
	print '<aside class="mjl-module-sidebar" id="mjl-primary-navigation" aria-label="Menu module MJL"><button class="mjl-navigation-close" type="button" data-mjl-navigation-close>Fermer le menu</button>';
	print '<div class="mjl-sidebar-title"><span>MJL</span><strong>Suivi des projets</strong></div><nav class="mjl-sidebar-nav">';
	foreach (mjl_navigation_sections($targetUser) as $category) {
		print '<section class="mjl-sidebar-section" aria-labelledby="mjl-nav-'.$category['id'].'"><h2 class="mjl-sidebar-category" id="mjl-nav-'.$category['id'].'">'.dol_escape_htmltag($category['label']).'</h2><div class="mjl-sidebar-items">';
		foreach ($category['items'] as $item) {
			$current = $active['id'] === $item['id'] ? ' aria-current="'.$active['current'].'"' : '';
			$class = 'mjl-sidebar-link'.($current !== '' ? ' mjl-sidebar-link-active' : '');
			print '<a class="'.$class.'" href="'.DOL_URL_ROOT.$item['path'].'"'.$current.'><span>'.dol_escape_htmltag($item['label']).'</span></a>';
		}
		print '</div></section>';
	}
	print '</nav></aside><main class="mjl-module-main" id="mjl-main-content" tabindex="-1">'.mjl_feedback_render_and_clear();
}

function mjl_navigation_shell_end()
{
	print mjl_feedback_render_and_clear().'<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_components.js"></script></main></div>';
}
