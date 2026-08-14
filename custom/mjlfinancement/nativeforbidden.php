<?php

define('NOREDIRECTBYMAINTOLOGIN', 1);

http_response_code(403);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';

global $conf, $db, $user;

if (empty($user) || empty($user->id)) {
	$sessionLogin = isset($_SESSION['dol_login']) ? (string) $_SESSION['dol_login'] : '';
	if ($sessionLogin !== '') {
		$sessionUser = new User($db);
		if ($sessionUser->fetch(0, $sessionLogin) > 0) {
			$user = $sessionUser;
		}
	}
}

$conf->dol_hide_topmenu = 1;
$conf->dol_hide_leftmenu = 1;

$canEnterMjl = !empty($user) && !empty($user->id) && mjl_navigation_user_can_enter($user);

llxHeader('', 'Accès refusé');

if ($canEnterMjl) {
	mjl_navigation_shell_start($user);
}

print '<div class="mjl-workspace">';
print mjl_page_header_render(
	'Accès non autorisé',
	array(
		'description' => 'Cette adresse ne fait pas partie de l’espace MJL autorisé. Utilisez le tableau de bord pour continuer votre travail.',
	)
);
print '<section class="mjl-workspace-section">';
print '<div class="mjl-empty-state mjl-empty-state-warning">';
print '<p>Les écrans natifs Dolibarr de configuration, administration technique ou modules non exposés sont bloqués dans le navigateur.</p>';
if ($canEnterMjl) {
	print '<p><a class="mjl-action mjl-action-primary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/index.php">Retour au tableau de bord</a></p>';
}
print '</div>';
print '</section>';
print '</div>';

if ($canEnterMjl) {
	mjl_navigation_shell_end();
}

llxFooter();
$db->close();
