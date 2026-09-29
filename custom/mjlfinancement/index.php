<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard_ui.lib.php';

if (!mjl_navigation_policy_allows($user, 'workspace_enter')) { http_response_code(403); accessforbidden(); }
$role = mjl_scope_effective_role_code($user, (int) $conf->entity);
$admin = $role === 'ADMIN_PLATEFORME';
require_once __DIR__.'/lib/mjl_monitoring_access.lib.php';
if (!$admin && mjl_monitoring_readiness()!==0) {
	require_once __DIR__.'/lib/mjl_monitoring_route.lib.php';
	mjl_monitoring_page('home'); $db->close(); exit;
}
llxHeader('', $admin ? 'Administration' : 'Tableau de bord');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render($admin ? 'Administration' : 'Tableau de bord', array(
	'breadcrumb' => array(array('label' => 'MJL')),
	'description' => $admin ? 'Gestion des accès, audit et configuration technique.' : 'Références actives pour le suivi des projets.',
	'context' => array('label' => 'Rôle', 'value' => mjl_scope_role_label($role)),
));
if ($admin) print mjl_dashboard_admin_cards();
else print mjl_ui_system_state('unavailable', 'Suivi indisponible', 'Les données du tableau de bord ne sont pas disponibles avec cette version du module.');
print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();
