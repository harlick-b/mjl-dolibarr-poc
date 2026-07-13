<?php

define('NOREDIRECTBYMAINTOLOGIN', 1);

http_response_code(403);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

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

$canEnterMjl = !empty($user) && !empty($user->id) && mjl_workspace_user_can_enter($user);

llxHeader('', 'Acces refuse');

if ($canEnterMjl) {
	mjl_navigation_shell_start($user, 'dashboard');
}

print '<div class="mjl-workspace">';
print '<section class="mjl-workspace-header">';
print '<div><p class="mjl-kicker">Acces refuse</p>';
print '<h1>Acces non autorise</h1>';
print '<p class="mjl-header-copy">Cette adresse ne fait pas partie de l espace MJL autorise. Utilisez le tableau de bord pour continuer votre travail.</p></div>';
print '</section>';
print '<section class="mjl-workspace-section">';
print '<div class="mjl-empty-state mjl-empty-state-warning">';
print '<p>Les ecrans natifs Dolibarr de configuration, administration technique ou modules non exposes sont bloques dans le navigateur.</p>';
if ($canEnterMjl) {
	print '<p><a class="button" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/index.php">Retour au tableau de bord</a></p>';
}
print '</div>';
print '</section>';
print '</div>';

if ($canEnterMjl) {
	mjl_navigation_shell_end();
}

llxFooter();
$db->close();
