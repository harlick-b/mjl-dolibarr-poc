<?php

if (!defined('NOTOKENRENEWAL')) define('NOTOKENRENEWAL', '1');
if (!defined('NOREQUIREMENU')) define('NOREQUIREMENU', '1');
if (!defined('NOREQUIREHTML')) define('NOREQUIREHTML', '1');
if (!defined('NOREQUIREAJAX')) define('NOREQUIREAJAX', '1');

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/files.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';

$type = GETPOST('type', 'alphanohtml');
if ($type === '') {
	$type = 'expense';
}

$fileId = GETPOSTINT('id');
if ($type === 'fundreceipt') {
	$fileRow = mjl_fund_receipt_document_fetch_download_row($fileId);
} elseif ($type === 'activity') {
	$fileRow = mjl_activity_document_fetch_download_row($fileId);
} elseif ($type === 'convention') {
	$fileRow = mjl_convention_document_fetch_download_row($fileId);
} elseif ($type === 'expense') {
	if (!$user->hasRight('mjlfinancement', 'expense', 'read')) {
		mjl_document_download_forbidden();
	}
	$fileRow = mjl_expense_document_fetch_download_row($fileId);
} else {
	mjl_document_download_forbidden();
}
if (empty($fileRow)) {
	mjl_document_download_forbidden();
}

$fullpath = mjl_document_download_resolve_path($type, $fileRow);
if ($fullpath === '') {
	mjl_document_download_forbidden();
}

$downloadName = mjl_document_download_display_filename($type, $fileRow);
mjl_document_download_audit($type, $fileRow, $downloadName);
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

function mjl_document_download_resolve_path($type, $fileRow)
{
	if ($type === 'fundreceipt') return mjl_fund_receipt_document_resolve_path($fileRow);
	if ($type === 'activity') return mjl_activity_document_resolve_path($fileRow);
	if ($type === 'convention') return mjl_convention_document_resolve_path($fileRow);
	return mjl_expense_document_resolve_path($fileRow);
}

function mjl_document_download_display_filename($type, $fileRow)
{
	if ($type === 'fundreceipt') return mjl_fund_receipt_document_display_filename($fileRow);
	if ($type === 'activity') return mjl_activity_document_display_filename($fileRow);
	if ($type === 'convention') return mjl_convention_document_display_filename($fileRow);
	return mjl_expense_document_display_filename($fileRow);
}

function mjl_document_download_audit($type, $fileRow, $downloadName)
{
	global $conf, $user;

	$map = array(
		'fundreceipt' => array('object_type' => 'mjlfinancement_fund_receipt', 'id_key' => 'receipt_rowid'),
		'activity' => array('object_type' => 'mjlfinancement_activity', 'id_key' => 'activity_rowid'),
		'convention' => array('object_type' => 'mjlfinancement_convention', 'id_key' => 'convention_rowid'),
		'expense' => array('object_type' => 'mjlfinancement_expense', 'id_key' => 'expense_rowid'),
	);
	if (empty($map[$type]) || empty($fileRow[$map[$type]['id_key']])) {
		return;
	}
	$changes = array(
		'file_id' => (int) ($fileRow['rowid'] ?? 0),
		'filename' => (string) $downloadName,
	);
	$id = mjl_workflow_audit_insert($map[$type]['object_type'], (int) $fileRow[$map[$type]['id_key']], (int) $conf->entity, 'Document telecharge', $user, mjl_document_download_actor_role(), 'document_downloaded', 'Document telecharge: '.$downloadName, $changes, 'WFA-DLD');
	if ($id <= 0 && function_exists('dol_syslog')) {
		dol_syslog('MJL document download audit failed for file '.((int) ($fileRow['rowid'] ?? 0)), LOG_WARNING);
	}
}

function mjl_document_download_actor_role()
{
	global $user;
	if (mjl_scope_is_platform_admin($user)) return 'ADMIN_PLATEFORME';
	if (mjl_scope_is_final_validator($user)) return 'VALIDATEUR_DEFINITIF';
	if (mjl_scope_is_verifier($user)) return 'AGENT_VERIFICATEUR';
	if (mjl_scope_is_input_agent($user)) return 'AGENT_SAISIE';
	return 'PROFIL_NON_RESOLU';
}
