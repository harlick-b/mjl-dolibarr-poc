<?php

define('NOLOGIN', 1);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth_ui.lib.php';

header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');

$selector = GETPOST('selector', 'alphanohtml');
$action = GETPOST('action', 'aZ09');
$error = '';
if ($action === 'accept') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		$error = 'Le jeton de sécurité est invalide. Veuillez recharger la page.';
	} else {
		$error = mjl_auth_accept_invitation($selector, GETPOST('verifier', 'restricthtml'), GETPOST('newpass1', 'password'), GETPOST('newpass2', 'password'));
		if ($error === '') {
			mjl_auth_clear_native_session();
			mjl_auth_otp_clear_pending_session();
			session_regenerate_id(true);
			$_SESSION['dol_loginmesg'] = 'Votre mot de passe a été défini. Vous pouvez vous connecter.';
			header('Location: '.DOL_URL_ROOT.'/index.php');
			exit;
		}
	}
}

$status = mjl_auth_invitation_status($selector);
$email = $status === 'valid' ? mjl_auth_invitation_email($selector) : '';
$usable = $status === 'valid' && $email !== '';
mjl_auth_ui_start('Invitation · MJL', $usable ? 'Définir mon mot de passe' : 'Lien indisponible', $usable ? 'Définissez le mot de passe de votre compte.' : '', 'mjl-invitation-title');
if (!$usable) {
	mjl_auth_ui_unusable_link();
} else {
	if ($error !== '') print '<div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive">'.dol_escape_htmltag($error).'</div>';
	mjl_auth_ui_password_form('mjl-invitation-accept', DOL_URL_ROOT.'/custom/mjlfinancement/invitation.php', array('action' => 'accept', 'selector' => $selector), $email, 'Enregistrer le mot de passe');
}
mjl_auth_ui_end();
$db->close();
