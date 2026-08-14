<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';

if (!mjl_navigation_policy_allows($user, 'workspace_enter')) { http_response_code(403); accessforbidden(); }
$role = mjl_scope_effective_role_code($user, (int) $conf->entity);
$admin = $role === 'ADMIN_PLATEFORME';
llxHeader('', 'Accueil');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render('Accueil', array(
	'breadcrumb' => array(array('label' => 'MJL')),
	'description' => $admin ? 'Administration technique, gestion des accès et audit.' : 'Références actives pour le suivi des projets.',
	'context' => array('label' => 'Rôle', 'value' => mjl_scope_role_label($role)),
));
print mjl_ui_system_state('empty', $admin ? 'Espace d’administration' : 'Fondation Phase 1', $admin ? 'Utilisez le menu pour gérer les accès ou consulter l’audit.' : 'Les Activités et Opérations seront ouvertes par les phases suivantes.');
print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();
