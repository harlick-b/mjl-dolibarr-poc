<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation_registry.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once __DIR__.'/mjl_monitoring_access.lib.php';

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
	if ($policy === 'monitoring_read') return $business && mjl_monitoring_readiness() === 1;
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

function mjl_navigation_icon($id)
{
	$paths = array(
		'home' => 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
		'activities' => 'M5 4h14v17H5z M9 2h6v4H9z M8 10h8 M8 14h8 M8 18h4',
		'partners' => 'M3 21V8l8-4v17 M11 11l10-4v14 M1 21h22 M6 9v2 M6 14v2 M15 12v2 M18 11v2 M15 17v2 M18 16v3',
		'projects' => 'M3 7V4h6l3 3h9v13H3z',
		'access' => 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4',
		'audit' => 'M3 12a9 9 0 1 0 3-7 M3 3v5h5 M12 7v5l3 2',
	);
	if (!isset($paths[$id])) return '';
	return '<svg class="mjl-nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'.$paths[$id].'"></path></svg>';
}

function mjl_navigation_shell_start(User $targetUser)
{
	$active = mjl_navigation_current_state();
	$groups = mjl_navigation_shell_projection(mjl_navigation_sections($targetUser));
	$activeGroup = null;
	$activeSecondary = null;
	foreach ($groups as $group) {
		if ($group['id'] === $active['id']) $activeGroup = $group;
		foreach ($group['secondary'] as $secondary) if ($secondary['id'] === $active['id']) { $activeGroup = $group; $activeSecondary = $secondary; }
	}
	if ($activeGroup === null && $groups) $activeGroup = $groups[0];
	$name = trim(trim((string) $targetUser->firstname).' '.trim((string) $targetUser->lastname));
	if ($name === '') $name = (string) $targetUser->login;
	$role = mjl_scope_role_label(mjl_scope_effective_role_code($targetUser));
	print '<div class="mjl-module-shell"><a class="mjl-skip-link" href="#mjl-main-content">Aller au contenu principal</a>';
	print '<button class="mjl-navigation-backdrop" type="button" data-mjl-navigation-backdrop aria-label="Fermer le menu principal"></button>';
	print '<aside class="mjl-module-sidebar" id="mjl-primary-navigation" aria-label="Menu module MJL"><button class="mjl-navigation-close" type="button" data-mjl-navigation-close>Fermer le menu</button>';
	print '<div class="mjl-sidebar-title"><span class="mjl-brandmark" aria-hidden="true">M</span><strong>MJL</strong></div><nav class="mjl-sidebar-nav" aria-label="Navigation principale">';
	foreach ($groups as $group) {
		$inGroup = $activeGroup !== null && $activeGroup['id'] === $group['id'];
		$current = $active['id'] === $group['id'] && $activeSecondary === null ? ' aria-current="page"' : '';
		$class = 'mjl-sidebar-link'.($inGroup ? ' mjl-sidebar-link-active' : '');
		print '<div class="mjl-sidebar-group"><a class="'.$class.'" href="'.DOL_URL_ROOT.$group['path'].'"'.$current.'>'.mjl_navigation_icon($group['id']).'<span>'.dol_escape_htmltag($group['label']).'</span></a>';
		if ($inGroup && $group['secondary']) {
			print '<div class="mjl-sidebar-children">';
			foreach ($group['secondary'] as $secondary) {
				$selected = $active['id'] === $secondary['id'];
				print '<a class="mjl-sidebar-child-link'.($selected ? ' mjl-sidebar-child-link-active' : '').'" href="'.DOL_URL_ROOT.$secondary['path'].'"'.($selected ? ' aria-current="page"' : '').'>'.dol_escape_htmltag($secondary['label']).'</a>';
			}
			print '</div>';
		}
		print '</div>';
	}
	print '</nav><div class="mjl-sidebar-profile"><span class="mjl-profile-mark" aria-hidden="true">M</span><div><strong>'.dol_escape_htmltag($name).'</strong><small>'.dol_escape_htmltag($role).'</small></div></div></aside>';
	print '<div class="mjl-module-content"><header class="mjl-module-topbar"><button class="mjl-navigation-trigger" type="button" aria-controls="mjl-primary-navigation" aria-expanded="false">Ouvrir le menu principal</button><nav class="mjl-shell-breadcrumb" aria-label="Fil d’Ariane"><span>Ministère de la Justice</span>';
	if ($activeGroup !== null) {
		print '<span aria-hidden="true">/</span>';
		if ($activeSecondary !== null) print '<a href="'.DOL_URL_ROOT.$activeGroup['path'].'">'.dol_escape_htmltag($activeGroup['label']).'</a><span aria-hidden="true">/</span><strong aria-current="page">'.dol_escape_htmltag($activeSecondary['label']).'</strong>';
		else print '<strong aria-current="page">'.dol_escape_htmltag($activeGroup['label']).'</strong>';
	}
	print '</nav></header><main class="mjl-module-main" id="mjl-main-content" tabindex="-1">'.mjl_feedback_render_and_clear();
}

function mjl_navigation_shell_end()
{
	print mjl_feedback_render_and_clear().'<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_components.js"></script></main></div></div>';
}
