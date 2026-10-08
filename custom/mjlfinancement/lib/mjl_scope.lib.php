<?php

require_once __DIR__.'/access/mjl_access_policy.lib.php';

function mjl_scope_sanitized_sql_identifier($identifier)
{
	$identifier = (string) $identifier;
	if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/', $identifier)) {
		return $identifier;
	}
	return '';
}

function mjl_scope_sql_string($value)
{
	global $db;

	if ($value === null || $value === '') {
		return 'NULL';
	}
	return "'".$db->escape((string) $value)."'";
}

function mjl_scope_scalar_int($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		return null;
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		return null;
	}
	foreach ($obj as $value) {
		return $value === null ? null : (int) $value;
	}
	return null;
}

function mjl_scope_object_pointer($table, $objectId, $entity)
{
	global $db;

	$sql = 'SELECT object_type, object_id FROM '.$db->prefix().$table.' WHERE entity = '.((int) $entity).' AND rowid = '.((int) $objectId);
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_scope_document_pointer($fileId, $entity)
{
	global $db;

	$sql = 'SELECT src_object_type, src_object_id FROM '.$db->prefix().'ecm_files WHERE entity = '.((int) $entity).' AND rowid = '.((int) $fileId);
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}
