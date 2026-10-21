<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

/** GET shells only. All execution, exception and expense data and writes use REST. */
function mjl_execution_http(User $actor,$screen)
{
 mjl_activity_access_require_read($actor);
 $titles=array('operations'=>'Opérations','requests'=>'Demandes d’exception','expenses'=>'Dépenses');
 llxHeader('',$titles[$screen]);mjl_navigation_shell_start($actor);
 print '<div class="mjl-workspace" id="mjl-execution-app" data-screen="'.$screen.'" data-base="'.dol_escape_htmltag(DOL_URL_ROOT.'/custom/mjlfinancement').'">';
 print '<p role="alert" data-mjl-js-required>JavaScript est nécessaire pour utiliser cet écran.</p><p role="status" data-loading hidden>Chargement…</p></div>';
 mjl_navigation_shell_end();
 if(!mjl_auth_otp_enabled())print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_api.js"></script>';
 print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_execution.js"></script>';
 llxFooter();
}
