<?php

if (!defined('NOTOKENRENEWAL')) define('NOTOKENRENEWAL', '1');
if (!defined('NOREQUIREMENU')) define('NOREQUIREMENU', '1');
if (!defined('NOREQUIREHTML')) define('NOREQUIREHTML', '1');
if (!defined('NOREQUIREAJAX')) define('NOREQUIREAJAX', '1');

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/files.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';

if (!$user->hasRight('mjlfinancement', 'expense', 'read')) {
	mjl_document_download_forbidden();
}

$fileId = GETPOSTINT('id');
$fileRow = mjl_expense_document_fetch_download_row($fileId);
if (empty($fileRow)) {
	mjl_document_download_forbidden();
}

$fullpath = mjl_expense_document_resolve_path($fileRow);
if ($fullpath === '') {
	mjl_document_download_forbidden();
}

$downloadName = mjl_expense_document_display_filename($fileRow);
$mime = function_exists('dol_mimetype') ? dol_mimetype($downloadName, 'application/octet-stream') : 'application/octet-stream';
if (function_exists('top_httphead')) {
	top_httphead($mime);
} else {
	header('Content-Type: '.$mime);
}
header('Content-Description: File Transfer');
header('Content-Disposition: attachment; filename="'.$downloadName.'"');
header('Cache-Control: private, no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('Content-Length: '.filesize($fullpath));
if (is_object($db)) {
	$db->close();
}
if (function_exists('readfileLowMemory')) {
	readfileLowMemory($fullpath);
} else {
	readfile($fullpath);
}
exit;

function mjl_document_download_forbidden()
{
	if (function_exists('http_response_code')) {
		http_response_code(403);
	} else {
		header('HTTP/1.1 403 Forbidden');
	}
	accessforbidden();
}
