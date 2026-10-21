<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

/** GET-only page shell. Business data and report generation use REST. */
function mjl_reporting_shell(User $actor, $screen, array $query=array())
{
	$role=mjl_scope_effective_role_code($actor,(int)$GLOBALS['conf']->entity);
	if($screen==='home'&&$role==='ADMIN_PLATEFORME'){
		llxHeader('','Administration');mjl_navigation_shell_start($actor);print '<div class="mjl-workspace"><h1>Administration</h1>'.mjl_dashboard_admin_cards().'</div>';mjl_navigation_shell_end();llxFooter();return;
	}
	$audit=$screen==='audit'||($screen==='reports'&&($query['report']??'')==='audit');
	$allowed=$audit?array('VALIDATEUR_DEFINITIF','ADMIN_PLATEFORME'):array('AGENT_SAISIE','AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF');
	if(!in_array($role,$allowed,true)){http_response_code(403);accessforbidden();}
	$titles=array('home'=>'Tableau de bord','alerts'=>'Alertes','reports'=>'Rapports','audit'=>'Journal d’audit');$title=$titles[$screen];
	llxHeader('',$title);mjl_navigation_shell_start($actor);
	print '<div class="mjl-workspace" id="mjl-reporting-app" data-screen="'.dol_escape_htmltag($screen).'" data-base="'.dol_escape_htmltag(DOL_URL_ROOT.'/custom/mjlfinancement').'">';
	print '<p role="alert" data-mjl-js-required>JavaScript est nécessaire pour utiliser cet écran.</p><p role="status" data-loading hidden>Chargement…</p></div>';
	mjl_navigation_shell_end();
	if(!mjl_auth_otp_enabled())print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_api.js"></script>';
	print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_reporting.js"></script>';llxFooter();
}
