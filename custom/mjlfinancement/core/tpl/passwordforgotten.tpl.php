<?php
if (empty($conf) || !is_object($conf)) { print "Error, template page can't be called as URL"; exit(1); }
require_once DOL_DOCUMENT_ROOT.'/core/lib/functions2.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth_ui.lib.php';
$requested = (bool) GETPOST('mjl_reset_requested', 'int');
mjl_auth_ui_start('Mot de passe oublié · MJL', $requested ? 'Consultez votre email' : 'Mot de passe oublié', $requested ? 'Si un compte correspond à cette adresse, vous recevrez un lien de réinitialisation.' : 'Recevez un lien pour réinitialiser votre mot de passe.', 'mjl-forgot-title');
if ($requested) {
	print '<a class="mjl-auth-button" href="'.DOL_URL_ROOT.'/index.php">Retour à la connexion</a>';
} else {
	print '<form id="mjl-password-request" method="post" action="'.DOL_URL_ROOT.'/user/passwordforgotten.php" data-mjl-auth-form>';
	print '<input type="hidden" name="token" value="'.newToken().'"><input type="hidden" name="action" value="mjl_build_password_reset">';
	print '<div class="mjl-auth-field"><label for="email">Adresse email</label><input type="email" id="email" name="email" autocomplete="email" required autofocus></div>';
	print '<button type="submit" class="mjl-auth-button">Envoyer le lien</button><a class="mjl-auth-link mjl-auth-return" href="'.DOL_URL_ROOT.'/index.php">Retour à la connexion</a></form>';
}
mjl_auth_ui_end();
