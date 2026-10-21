<?php
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reference_route.lib.php';
// This migrated route renders a shell only. All reference data and mutations use REST.
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); header('Allow: GET'); exit; }
mjl_reference_require_read($user);
llxHeader('', 'Partenaires MJL');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace" id="mjl-partners-app" data-base="'.dol_escape_htmltag(DOL_URL_ROOT.'/custom/mjlfinancement').'">';
print '<p role="alert" data-mjl-js-required>JavaScript est nécessaire pour utiliser cet écran.</p><p role="status" data-loading hidden>Chargement des Partenaires…</p></div>';
mjl_navigation_shell_end();
if (!mjl_auth_otp_enabled()) print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_api.js"></script>';
print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_partners.js"></script>';
llxFooter();
$db->close();
