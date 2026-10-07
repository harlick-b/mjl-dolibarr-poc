<?php

function mjl_scope_role_codes()
{
	return array(
		'AGENT_SAISIE',
		'AGENT_VERIFICATEUR',
		'VALIDATEUR_DEFINITIF',
		'ADMIN_PLATEFORME',
	);
}

function mjl_scope_role_labels()
{
	return array(
		'AGENT_SAISIE' => 'Agent de saisie',
		'AGENT_VERIFICATEUR' => 'Agent superviseur et prévalidateur',
		'VALIDATEUR_DEFINITIF' => 'Validateur définitif',
		'ADMIN_PLATEFORME' => 'Admin',
	);
}

function mjl_scope_role_label($roleCode)
{
	$labels = mjl_scope_role_labels();
	return isset($labels[$roleCode]) ? $labels[$roleCode] : 'Profil historique non résolu';
}

function mjl_scope_is_valid_role_code($roleCode)
{
	return in_array((string) $roleCode, mjl_scope_role_codes(), true);
}

function mjl_scope_is_valid_business_role_code($roleCode)
{
	return in_array((string) $roleCode, array('AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'), true);
}

function mjl_scope_active_role_row($userId, $entity = null)
{
	global $db, $conf;

	$userId = (int) $userId;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if ($userId <= 0 || $entity <= 0) {
		return array();
	}

	$sql = 'SELECT rowid, entity, fk_user, role_code, is_active, date_start, date_end, source, note';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_user_role';
	$sql .= ' WHERE entity = '.$entity.' AND fk_user = '.$userId.' AND is_active = 1';
	$sql .= ' ORDER BY rowid DESC LIMIT 2';
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		return array();
	}
	$row = (array) $obj;
	if ($db->fetch_object($resql)) {
		return array();
	}
	return $row;
}

function mjl_scope_active_role_code($userId, $entity = null)
{
	$row = mjl_scope_active_role_row($userId, $entity);
	return empty($row['role_code']) ? '' : (string) $row['role_code'];
}

function mjl_scope_effective_role_code(User $userObj, $entity = null)
{
	global $db, $conf;
	if (empty($userObj->id)) {
		return '';
	}
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	$sql = 'SELECT entity, admin, statut FROM '.$db->prefix().'user WHERE rowid = '.((int) $userObj->id).' LIMIT 1';
	$resql = $db->query($sql);
	$current = $resql ? $db->fetch_object($resql) : null;
	if (!$current || (int) $current->statut !== 1) return '';
	if (!empty($current->admin)) {
		return 'ADMIN_PLATEFORME';
	}
	if ((int) $current->entity !== $entity) return '';
	$roleCode = mjl_scope_active_role_code((int) $userObj->id, $entity);
	return mjl_scope_is_valid_role_code($roleCode) ? $roleCode : '';
}

function mjl_scope_user_has_role(User $userObj, $roleCode, $entity = null)
{
	return mjl_scope_effective_role_code($userObj, $entity) === (string) $roleCode;
}

function mjl_scope_user_has_active_business_role(User $userObj, $entity = null)
{
	$roleCode = mjl_scope_effective_role_code($userObj, $entity);
	return in_array($roleCode, array('AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'), true);
}

function mjl_scope_is_platform_admin($userObj, $entity = null)
{
	if (empty($userObj) || empty($userObj->id)) {
		return false;
	}
	return mjl_scope_effective_role_code($userObj, $entity) === 'ADMIN_PLATEFORME';
}

function mjl_scope_is_input_agent($userObj, $entity = null)
{
	return !empty($userObj->id) && mjl_scope_user_has_role($userObj, 'AGENT_SAISIE', $entity);
}

function mjl_scope_is_verifier($userObj, $entity = null)
{
	return !empty($userObj->id) && mjl_scope_user_has_role($userObj, 'AGENT_VERIFICATEUR', $entity);
}

function mjl_scope_is_final_validator($userObj, $entity = null)
{
	return !empty($userObj->id) && mjl_scope_user_has_role($userObj, 'VALIDATEUR_DEFINITIF', $entity);
}

function mjl_scope_can_apply_business_validation($userObj, $entity = null)
{
	return mjl_scope_is_verifier($userObj, $entity) || mjl_scope_is_final_validator($userObj, $entity);
}

function mjl_scope_business_role_can_write($userObj, $entity = null)
{
	return mjl_scope_is_input_agent($userObj, $entity);
}

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
