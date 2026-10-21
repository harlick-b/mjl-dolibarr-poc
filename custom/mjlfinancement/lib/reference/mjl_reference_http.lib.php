<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reference.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

/** Render a shell only: all reference reads and writes use REST. */
function mjl_reference_http_handle($kind, User $actor)
{
	if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
		http_response_code(405);
		header('Allow: GET');
		return;
	}
	mjl_reference_require_read($actor);
	$config = mjl_reference_config($kind);
	llxHeader('', $config['title'].' MJL');
	mjl_navigation_shell_start($actor);
	print '<div class="mjl-workspace" id="mjl-references-app" data-kind="'.$kind.'" data-reference="'.dol_escape_htmltag(json_encode($config)).'" data-base="'.dol_escape_htmltag(DOL_URL_ROOT.'/custom/mjlfinancement').'">';
	print '<p role="alert" data-mjl-js-required>JavaScript est nécessaire pour utiliser cet écran.</p><p role="status" data-loading hidden>Chargement des références…</p></div>';
	mjl_navigation_shell_end();
	if (!mjl_auth_otp_enabled()) print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_api.js"></script>';
	print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_references.js"></script>';
	llxFooter();
}
