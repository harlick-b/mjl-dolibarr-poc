<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

if (!mjl_scope_is_platform_admin($user)) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');

llxHeader('', 'Administration technique MJL');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render(
	'Administration technique MJL',
	array(
		'description' => 'Point d’entrée temporaire RST-002A pour l’administration des accès et les diagnostics autorisés.',
		'context' => array('label' => 'Accès', 'value' => 'Administration technique'),
	)
);

$links = array(
	array('label' => 'Utilisateurs et accès', 'href' => '/custom/mjlfinancement/admin/access.php'),
	array('label' => 'Historique des validations', 'href' => '/custom/mjlfinancement/validations.php'),
	array('label' => 'Historique des actions', 'href' => '/custom/mjlfinancement/workflowactions.php'),
	array('label' => 'Historique des échanges', 'href' => '/custom/mjlfinancement/exchangelogs.php'),
);
print '<section class="mjl-workspace-section">';
print '<div class="mjl-section-heading"><h2>Outils techniques autorisés</h2><p>Les fonctionnalités métier restent indisponibles pendant la transition RST-002A.</p></div>';
print '<ul class="mjl-technical-links">';
foreach ($links as $link) {
	print '<li><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.dol_escape_htmltag($link['href']).'">'.dol_escape_htmltag($link['label']).'</a></li>';
}
print '</ul>';
print '</section>';
print '</div>';
mjl_navigation_shell_end();

llxFooter();
$db->close();
