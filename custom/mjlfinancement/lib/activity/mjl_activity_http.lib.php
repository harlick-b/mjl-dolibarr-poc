<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_operation_consultation.lib.php';

/** HTML shell only; Activity data and every mutation go through REST. */
function mjl_activity_http_handle(User $user)
{
 mjl_activity_access_require_read($user);
 llxHeader('', 'Activités MJL');
 mjl_navigation_shell_start($user);
 print '<div class="mjl-workspace" id="mjl-activities-app" data-base="'.dol_escape_htmltag(DOL_URL_ROOT.'/custom/mjlfinancement').'"><p role="alert" data-mjl-js-required>JavaScript est nécessaire pour utiliser cet écran.</p><p role="status" data-loading hidden>Chargement des Activités…</p></div>';
 print '<template id="mjl-activity-drawer">'.mjl_operation_consultation_drawer().'</template>';
 mjl_navigation_shell_end();
 if (!mjl_auth_otp_enabled()) print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_api.js"></script>';
 foreach (array('mjl_financial_preview','mjl_form_controls','activities','mjl_activities') as $script) print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/'.$script.'.js"></script>';
 llxFooter();
}
