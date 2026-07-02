<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_expense_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';

function mjl_expense_document_download_rows($expenseId)
{
	global $db, $conf, $user;

	if ((int) $expenseId <= 0 || !$user->hasRight('mjlfinancement', 'expense', 'read')) {
		return array();
	}

	$expense = mjl_expense_document_fetch_expense_for_access((int) $expenseId);
	if (empty($expense) || !mjl_expenses_can_open($expense)) {
		return array();
	}

	return mjl_expense_downloadable_document_rows((int) $expenseId, (int) $conf->entity);
}

function mjl_expense_document_fetch_expense_for_access($expenseId)
{
	global $db, $conf;

	if ((int) $expenseId <= 0) {
		return array();
	}
	$sql = 'SELECT rowid, entity, fk_user_creat, status';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense';
	$sql .= ' WHERE entity = '.((int) $conf->entity).' AND rowid = '.((int) $expenseId);
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_expense_document_fetch_download_row($fileId)
{
	global $db, $conf, $user;

	if ((int) $fileId <= 0 || !$user->hasRight('mjlfinancement', 'expense', 'read')) {
		return array();
	}
	$sql = 'SELECT f.rowid, f.entity, f.filename, f.filepath, f.fullpath_orig, f.description, f.date_c, f.fk_user_c, f.src_object_type, f.src_object_id,';
	$sql .= ' e.rowid AS expense_rowid, e.fk_user_creat, e.status';
	$sql .= ' FROM '.$db->prefix().'ecm_files f';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = f.src_object_id AND e.entity = f.entity';
	$sql .= ' WHERE f.rowid = '.((int) $fileId);
	$sql .= ' AND f.entity = '.((int) $conf->entity);
	$sql .= " AND f.src_object_type = 'mjlfinancement_expense'";
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		return array();
	}

	$row = (array) $obj;
	$expense = array(
		'rowid' => (int) $row['expense_rowid'],
		'entity' => (int) $row['entity'],
		'fk_user_creat' => (int) $row['fk_user_creat'],
		'status' => (int) $row['status'],
	);
	if (!mjl_expenses_can_open($expense)) {
		return array();
	}
	return $row;
}

function mjl_expense_document_resolve_path($fileRow)
{
	return mjl_expense_document_resolved_path_for_row($fileRow);
}

function mjl_expense_document_display_filename($fileRow)
{
	$raw = trim((string) ($fileRow['fullpath_orig'] ?? ''));
	if ($raw === '') {
		$raw = (string) ($fileRow['filename'] ?? 'document');
	}
	$name = basename(str_replace('\\', '/', $raw));
	$name = preg_replace('/[\x00-\x1F\x7F"<>|\\\\\/]+/', '_', $name);
	$name = trim($name, " ._\t\n\r\0\x0B");
	if ($name === '') {
		$name = 'document';
	}
	if (function_exists('dol_sanitizeFileName')) {
		$name = dol_sanitizeFileName($name);
	}
	return $name === '' ? 'document' : $name;
}

function mjl_expense_document_safe_filename($filename)
{
	return mjl_expense_document_safe_filename_for_storage($filename);
}

function mjl_expense_document_safe_relative_path($path)
{
	return mjl_expense_document_safe_relative_path_for_storage($path);
}

function mjl_activity_document_download_rows($activityId)
{
	global $conf, $user;

	if ((int) $activityId <= 0 || !$user->hasRight('mjlfinancement', 'activity', 'read')) {
		return array();
	}
	$activity = mjl_activity_document_fetch_activity_for_access((int) $activityId);
	if (empty($activity) || !mjl_activities_can_open($activity)) {
		return array();
	}
	return mjl_activity_downloadable_document_rows((int) $activityId, (int) $conf->entity);
}

function mjl_activity_document_fetch_activity_for_access($activityId)
{
	global $db, $conf;

	if ((int) $activityId <= 0) {
		return array();
	}
	$sql = 'SELECT rowid, entity, fk_user_creat, status';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity';
	$sql .= ' WHERE entity = '.((int) $conf->entity).' AND rowid = '.((int) $activityId);
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_activity_document_fetch_download_row($fileId)
{
	global $db, $conf, $user;

	if ((int) $fileId <= 0 || !$user->hasRight('mjlfinancement', 'activity', 'read')) {
		return array();
	}
	$sql = 'SELECT f.rowid, f.entity, f.filename, f.filepath, f.fullpath_orig, f.description, f.date_c, f.fk_user_c, f.src_object_type, f.src_object_id,';
	$sql .= ' a.rowid AS activity_rowid, a.fk_user_creat, a.status';
	$sql .= ' FROM '.$db->prefix().'ecm_files f';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = f.src_object_id AND a.entity = f.entity';
	$sql .= ' WHERE f.rowid = '.((int) $fileId);
	$sql .= ' AND f.entity = '.((int) $conf->entity);
	$sql .= " AND f.src_object_type = 'mjlfinancement_activity'";
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		return array();
	}
	$row = (array) $obj;
	$activity = array(
		'rowid' => (int) $row['activity_rowid'],
		'entity' => (int) $row['entity'],
		'fk_user_creat' => (int) $row['fk_user_creat'],
		'status' => (int) $row['status'],
	);
	if (!mjl_activities_can_open($activity)) {
		return array();
	}
	return $row;
}

function mjl_activity_document_resolve_path($fileRow)
{
	return mjl_expense_document_resolved_path_for_row($fileRow);
}

function mjl_activity_document_display_filename($fileRow)
{
	return mjl_expense_document_display_filename($fileRow);
}

function mjl_activity_document_present_sql($activityAlias = 'a')
{
	global $db;
	$alias = preg_replace('/[^A-Za-z0-9_]/', '', $activityAlias);
	return "(EXISTS (SELECT 1 FROM ".$db->prefix()."ecm_files mjl_doc WHERE mjl_doc.entity = ".$alias.".entity AND mjl_doc.src_object_type = 'mjlfinancement_activity' AND mjl_doc.src_object_id = ".$alias.".rowid))";
}

function mjl_activity_evidence_state($activityId, $entity)
{
	$rows = mjl_activity_downloadable_document_rows($activityId, $entity);
	if (!empty($rows)) {
		return 'downloadable';
	}
	$referencedRows = mjl_activity_document_candidate_rows($activityId, $entity);
	return !empty($referencedRows) ? 'unavailable' : 'missing';
}

function mjl_activity_document_candidate_rows($activityId, $entity)
{
	return mjl_document_candidate_rows('mjlfinancement_activity', $activityId, $entity);
}

function mjl_activity_downloadable_document_rows($activityId, $entity)
{
	return mjl_document_downloadable_rows('mjlfinancement_activity', $activityId, $entity);
}

function mjl_convention_document_download_rows($conventionId)
{
	global $conf, $user;

	if ((int) $conventionId <= 0 || !mjl_workspace_can_access_reference_data($user, 'convention')) {
		return array();
	}
	$convention = mjl_convention_document_fetch_convention_for_access((int) $conventionId);
	if (empty($convention)) {
		return array();
	}
	return mjl_convention_downloadable_document_rows((int) $conventionId, (int) $conf->entity);
}

function mjl_convention_document_fetch_convention_for_access($conventionId)
{
	global $db, $conf;

	if ((int) $conventionId <= 0) {
		return array();
	}
	$sql = 'SELECT rowid, entity, status';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention';
	$sql .= ' WHERE entity = '.((int) $conf->entity).' AND rowid = '.((int) $conventionId);
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_convention_document_fetch_download_row($fileId)
{
	global $db, $conf, $user;

	if ((int) $fileId <= 0 || !mjl_workspace_can_access_reference_data($user, 'convention')) {
		return array();
	}
	$sql = 'SELECT f.rowid, f.entity, f.filename, f.filepath, f.fullpath_orig, f.description, f.date_c, f.fk_user_c, f.src_object_type, f.src_object_id,';
	$sql .= ' c.rowid AS convention_rowid, c.status';
	$sql .= ' FROM '.$db->prefix().'ecm_files f';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = f.src_object_id AND c.entity = f.entity';
	$sql .= ' WHERE f.rowid = '.((int) $fileId);
	$sql .= ' AND f.entity = '.((int) $conf->entity);
	$sql .= " AND f.src_object_type = 'mjlfinancement_convention'";
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_convention_document_resolve_path($fileRow)
{
	return mjl_expense_document_resolved_path_for_row($fileRow);
}

function mjl_convention_document_display_filename($fileRow)
{
	return mjl_expense_document_display_filename($fileRow);
}

function mjl_convention_document_present_sql($conventionAlias = 'c')
{
	global $db;
	$alias = preg_replace('/[^A-Za-z0-9_]/', '', $conventionAlias);
	return "(EXISTS (SELECT 1 FROM ".$db->prefix()."ecm_files mjl_doc WHERE mjl_doc.entity = ".$alias.".entity AND mjl_doc.src_object_type = 'mjlfinancement_convention' AND mjl_doc.src_object_id = ".$alias.".rowid))";
}

function mjl_convention_evidence_state($conventionId, $entity)
{
	$rows = mjl_convention_downloadable_document_rows($conventionId, $entity);
	if (!empty($rows)) {
		return 'downloadable';
	}
	$referencedRows = mjl_convention_document_candidate_rows($conventionId, $entity);
	return !empty($referencedRows) ? 'unavailable' : 'missing';
}

function mjl_convention_document_candidate_rows($conventionId, $entity)
{
	return mjl_document_candidate_rows('mjlfinancement_convention', $conventionId, $entity);
}

function mjl_convention_downloadable_document_rows($conventionId, $entity)
{
	return mjl_document_downloadable_rows('mjlfinancement_convention', $conventionId, $entity);
}

function mjl_fund_receipt_document_download_rows($receiptId)
{
	global $db, $conf, $user;

	if ((int) $receiptId <= 0 || !mjl_workspace_can_access_reference_data($user, 'fundreceipt')) {
		return array();
	}

	$receipt = mjl_fund_receipt_document_fetch_receipt_for_access((int) $receiptId);
	if (empty($receipt)) {
		return array();
	}

	return mjl_fund_receipt_downloadable_document_rows((int) $receiptId, (int) $conf->entity);
}

function mjl_fund_receipt_document_fetch_receipt_for_access($receiptId)
{
	global $db, $conf;

	if ((int) $receiptId <= 0) {
		return array();
	}
	$sql = 'SELECT rowid, entity, status';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_fund_receipt';
	$sql .= ' WHERE entity = '.((int) $conf->entity).' AND rowid = '.((int) $receiptId);
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_fund_receipt_document_fetch_download_row($fileId)
{
	global $db, $conf, $user;

	if ((int) $fileId <= 0 || !mjl_workspace_can_access_reference_data($user, 'fundreceipt')) {
		return array();
	}
	$sql = 'SELECT f.rowid, f.entity, f.filename, f.filepath, f.fullpath_orig, f.description, f.date_c, f.fk_user_c, f.src_object_type, f.src_object_id,';
	$sql .= ' fr.rowid AS receipt_rowid, fr.status';
	$sql .= ' FROM '.$db->prefix().'ecm_files f';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = f.src_object_id AND fr.entity = f.entity';
	$sql .= ' WHERE f.rowid = '.((int) $fileId);
	$sql .= ' AND f.entity = '.((int) $conf->entity);
	$sql .= " AND f.src_object_type = 'mjlfinancement_fund_receipt'";
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_fund_receipt_document_resolve_path($fileRow)
{
	return mjl_fund_receipt_document_resolved_path_for_row($fileRow);
}

function mjl_fund_receipt_document_display_filename($fileRow)
{
	return mjl_expense_document_display_filename($fileRow);
}

function mjl_fund_receipt_public_document_label($receiptId, $entity, $storedSupportingDocument = '')
{
	$receiptId = (int) $receiptId;
	$entity = (int) $entity;
	if ($receiptId <= 0 || $entity <= 0) {
		return '';
	}

	$downloadableRows = mjl_fund_receipt_downloadable_document_rows($receiptId, $entity);
	if (!empty($downloadableRows)) {
		return mjl_fund_receipt_document_display_filename($downloadableRows[0]);
	}

	$candidateRows = mjl_fund_receipt_document_candidate_rows($receiptId, $entity);
	if (!empty($candidateRows)) {
		return mjl_fund_receipt_document_display_filename($candidateRows[0]);
	}

	return trim((string) $storedSupportingDocument);
}

function mjl_document_candidate_rows($objectType, $objectId, $entity)
{
	global $db;

	$allowed = array('mjlfinancement_activity', 'mjlfinancement_convention');
	if (!in_array((string) $objectType, $allowed, true) || (int) $objectId <= 0 || (int) $entity <= 0) {
		return array();
	}
	$sql = 'SELECT rowid, entity, filename, filepath, fullpath_orig, description, date_c, fk_user_c, src_object_type, src_object_id';
	$sql .= ' FROM '.$db->prefix().'ecm_files';
	$sql .= ' WHERE entity = '.((int) $entity);
	$sql .= " AND src_object_type = '".$db->escape((string) $objectType)."'";
	$sql .= ' AND src_object_id = '.((int) $objectId);
	$sql .= ' ORDER BY date_c DESC, rowid DESC';
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}

function mjl_document_downloadable_rows($objectType, $objectId, $entity)
{
	$rows = array();
	foreach (mjl_document_candidate_rows($objectType, $objectId, $entity) as $row) {
		if (mjl_expense_document_resolved_path_for_row($row) !== '') {
			$rows[] = $row;
		}
	}
	return $rows;
}

function mjl_document_upload_to_ecm($objectType, $objectId, $entity, $fileField, $storageFolder, $refPrefix, $description, &$error)
{
	global $db, $conf, $user;

	$error = '';
	if ((int) $objectId <= 0 || (int) $entity <= 0) {
		$error = 'Objet documentaire invalide';
		return array();
	}
	if (empty($_FILES[$fileField]['tmp_name']) || !is_uploaded_file($_FILES[$fileField]['tmp_name'])) {
		$error = 'Fichier manquant';
		return array();
	}
	if (empty($conf->ecm->dir_output)) {
		$error = 'Repertoire ECM non configure';
		return array();
	}

	$original = preg_replace('/[^A-Za-z0-9_.-]/', '_', basename($_FILES[$fileField]['name']));
	$original = trim($original, '._-');
	if ($original === '') {
		$original = 'document';
	}
	$filename = preg_replace('/[^A-Za-z0-9_.-]/', '_', strtolower((string) $refPrefix)).'-'.((int) $objectId).'-'.date('YmdHis').'-'.bin2hex(random_bytes(6)).'-'.$original;
	$filepath = (string) $storageFolder;
	if (!mjl_expense_document_safe_filename_for_storage($filename) || !mjl_expense_document_safe_relative_path_for_storage($filepath)) {
		$error = 'Nom ou chemin documentaire invalide';
		return array();
	}

	$targetDir = rtrim($conf->ecm->dir_output, '/').'/'.$filepath;
	if (!is_dir($targetDir)) {
		$mkdir = function_exists('dol_mkdir') ? dol_mkdir($targetDir) >= 0 : mkdir($targetDir, 0775, true);
		if (!$mkdir) {
			$error = 'Impossible de creer le repertoire ECM';
			return array();
		}
	}
	if (!is_dir($targetDir)) {
		$error = 'Impossible de creer le repertoire ECM';
		return array();
	}
	$target = $targetDir.'/'.$filename;
	if (file_exists($target)) {
		$error = 'Un fichier de meme nom existe deja';
		return array();
	}
	if (!move_uploaded_file($_FILES[$fileField]['tmp_name'], $target)) {
		$error = 'Impossible de deplacer le fichier upload';
		return array();
	}

	$sql = 'INSERT INTO '.$db->prefix().'ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)';
	$sql .= ' VALUES (';
	$sql .= "'".$db->escape($refPrefix.'-'.$objectId.'-'.$filename)."'";
	$sql .= ", '".$db->escape($filename)."'";
	$sql .= ', '.((int) $entity);
	$sql .= ", '".$db->escape($filename)."'";
	$sql .= ", '".$db->escape($filepath)."'";
	$sql .= ", '".$db->escape($original)."'";
	$sql .= ', '.mjl_integrity_sql_string($description);
	$sql .= ', 1';
	$sql .= ", '".$db->idate(dol_now())."'";
	$sql .= ', '.((int) $user->id);
	$sql .= ", '".$db->escape((string) $objectType)."'";
	$sql .= ', '.((int) $objectId);
	$sql .= ')';
	if (!$db->query($sql)) {
		@unlink($target);
		$error = $db->lasterror();
		return array();
	}

	return array(
		'rowid' => (int) $db->last_insert_id($db->prefix().'ecm_files'),
		'filename' => $filename,
		'original' => $original,
		'filepath' => $filepath,
	);
}
