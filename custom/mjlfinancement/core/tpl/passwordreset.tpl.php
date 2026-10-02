<?php
if (empty($conf) || !is_object($conf)) { print "Error, template page can't be called as URL"; exit(1); }
require_once DOL_DOCUMENT_ROOT.'/core/lib/functions2.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth_ui.lib.php';
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');

$selector = GETPOST('mjlselector', 'alphanohtml');
$status = mjl_auth_reset_status($selector);
$email = $status === 'valid' ? mjl_auth_reset_email($selector) : '';
$error = empty($_SESSION['mjl_reset_error']) ? '' : $_SESSION['mjl_reset_error'];
unset($_SESSION['mjl_reset_error']);

$usable = $status === 'valid' && $email !== '';
mjl_auth_ui_start('Nouveau mot de passe · MJL', $usable ? 'Réinitialiser mon mot de passe' : 'Lien indisponible', $usable ? 'Choisissez un nouveau mot de passe.' : '', 'mjl-reset-title');
if (!$usable) {
	mjl_auth_ui_unusable_link();
} else {
	if ($error !== '') print '<div class="mjl-auth-message mjl-auth-error" role="alert" aria-live="assertive">'.dol_escape_htmltag($error).'</div>';
	mjl_auth_ui_password_form('mjl-password-reset', DOL_URL_ROOT.'/user/passwordforgotten.php', array('action' => 'mjl_validate_password_reset', 'mjlselector' => $selector), $email, 'Réinitialiser le mot de passe');
}
mjl_auth_ui_end();
