<?php
if (empty($conf) || !is_object($conf)) { print "Error, template page can't be called as URL"; exit(1); }
require_once DOL_DOCUMENT_ROOT.'/core/lib/functions2.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth_ui.lib.php';
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');

$mjlResetView = isset($GLOBALS['mjl_auth_reset_view']) && is_array($GLOBALS['mjl_auth_reset_view']) ? $GLOBALS['mjl_auth_reset_view'] : array();
$selector = isset($mjlResetView['selector']) ? (string) $mjlResetView['selector'] : '';
mjl_auth_ui_start('Nouveau mot de passe · MJL', 'Réinitialiser mon mot de passe', 'Choisissez un nouveau mot de passe.', 'mjl-reset-title');
mjl_auth_ui_password_form('mjl-password-reset', DOL_URL_ROOT.'/user/passwordforgotten.php', array('action' => 'mjl_validate_password_reset', 'mjlselector' => $selector), '', 'Réinitialiser le mot de passe');
mjl_auth_ui_end();
