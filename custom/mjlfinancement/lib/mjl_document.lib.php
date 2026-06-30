<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_expense_access.lib.php';

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

	$sql = 'SELECT f.rowid, f.filename, f.filepath, f.fullpath_orig, f.description, f.date_c';
	$sql .= ' FROM '.$db->prefix().'ecm_files f';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = f.src_object_id AND e.entity = f.entity';
	$sql .= ' WHERE f.entity = '.((int) $conf->entity);
	$sql .= " AND f.src_object_type = 'mjlfinancement_expense'";
	$sql .= ' AND f.src_object_id = '.((int) $expenseId);
	$sql .= ' ORDER BY f.date_c DESC, f.rowid DESC';
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return array();
	}

	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
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
	$sql = 'SELECT f.rowid, f.entity, f.filename, f.filepath, f.fullpath_orig, f.description, f.src_object_type, f.src_object_id,';
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
	global $conf;

	if (empty($conf->ecm->dir_output)) {
		return '';
	}
	$base = realpath($conf->ecm->dir_output);
	if ($base === false || !is_dir($base)) {
		return '';
	}

	$filename = (string) ($fileRow['filename'] ?? '');
	$filepath = (string) ($fileRow['filepath'] ?? '');
	if (!mjl_expense_document_safe_filename($filename) || !mjl_expense_document_safe_relative_path($filepath)) {
		return '';
	}

	$candidate = $base.'/'.$filepath.'/'.$filename;
	$real = realpath($candidate);
	if ($real === false || !is_file($real) || !is_readable($real)) {
		return '';
	}
	$basePrefix = rtrim($base, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR;
	if (strpos($real, $basePrefix) !== 0) {
		return '';
	}
	return $real;
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
	$filename = (string) $filename;
	if ($filename === '' || basename($filename) !== $filename) {
		return false;
	}
	return !preg_match('/\.\.|[\x00-\x1F\x7F<>|\\\\\/]/', $filename);
}

function mjl_expense_document_safe_relative_path($path)
{
	$path = trim((string) $path);
	if ($path === '' || $path[0] === '/' || preg_match('/^[A-Za-z]:/', $path)) {
		return false;
	}
	return !preg_match('/\.\.|[\x00-\x1F\x7F<>|\\\\]/', $path);
}
