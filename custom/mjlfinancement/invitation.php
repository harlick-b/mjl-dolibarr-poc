<?php

define('NOLOGIN', 1);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth_ui.lib.php';

header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');

$selector = GETPOST('selector', 'alphanohtml');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); header('Allow: GET'); exit; }
mjl_auth_ui_start('Invitation · MJL', 'Définir mon mot de passe', 'Définissez le mot de passe de votre compte.', 'mjl-invitation-title');
mjl_auth_ui_password_form('mjl-invitation-accept', DOL_URL_ROOT.'/custom/mjlfinancement/invitation.php', array('action' => 'accept', 'selector' => $selector), '', 'Enregistrer le mot de passe');
mjl_auth_ui_end();
$db->close();
