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
		'AGENT_VERIFICATEUR' => 'Agent verificateur',
		'VALIDATEUR_DEFINITIF' => 'Validateur definitif',
		'ADMIN_PLATEFORME' => 'Administrateur plateforme',
	);
}

function mjl_scope_role_label($roleCode)
{
	$labels = mjl_scope_role_labels();
	return isset($labels[$roleCode]) ? $labels[$roleCode] : 'Profil legacy non resolu';
}

function mjl_scope_legacy_group_name_for_role($roleCode)
{
	$map = array(
		'AGENT_SAISIE' => 'MJL POC - Agent',
		'AGENT_VERIFICATEUR' => 'MJL POC - Superviseur N1',
		'VALIDATEUR_DEFINITIF' => 'MJL POC - DPAF',
		'ADMIN_PLATEFORME' => 'MJL POC - Administrateur',
	);
	return isset($map[$roleCode]) ? $map[$roleCode] : '';
}

function mjl_scope_is_valid_role_code($roleCode)
{
	return in_array((string) $roleCode, mjl_scope_role_codes(), true);
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

function mjl_scope_user_has_role($userId, $roleCode, $entity = null)
{
	if (is_object($userId) && !empty($userId->id)) {
		$userId = (int) $userId->id;
	}
	return mjl_scope_active_role_code($userId, $entity) === (string) $roleCode;
}

function mjl_scope_user_has_active_business_role($userId, $entity = null)
{
	return mjl_scope_active_role_code($userId, $entity) !== '';
}

function mjl_scope_is_platform_admin($userObj, $entity = null)
{
	if (empty($userObj) || empty($userObj->id)) {
		return false;
	}
	if (!empty($userObj->admin)) {
		return true;
	}
	return mjl_scope_user_has_role((int) $userObj->id, 'ADMIN_PLATEFORME', $entity);
}

function mjl_scope_is_input_agent($userObj, $entity = null)
{
	return !empty($userObj->id) && mjl_scope_user_has_role((int) $userObj->id, 'AGENT_SAISIE', $entity);
}

function mjl_scope_is_verifier($userObj, $entity = null)
{
	return !empty($userObj->id) && mjl_scope_user_has_role((int) $userObj->id, 'AGENT_VERIFICATEUR', $entity);
}

function mjl_scope_is_final_validator($userObj, $entity = null)
{
	return !empty($userObj->id) && mjl_scope_user_has_role((int) $userObj->id, 'VALIDATEUR_DEFINITIF', $entity);
}

function mjl_scope_can_apply_business_validation($userObj, $entity = null)
{
	return mjl_scope_is_verifier($userObj, $entity) || mjl_scope_is_final_validator($userObj, $entity);
}

function mjl_scope_business_role_can_write($userObj, $entity = null)
{
	return mjl_scope_is_input_agent($userObj, $entity);
}

function mjl_scope_assign_access_profile($userId, $roleCode, array $fkSocIds, User $actor, $entity = null, $source = 'manual', $note = '')
{
	global $db, $conf;

	$userId = (int) $userId;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	$roleCode = (string) $roleCode;
	if ($userId <= 0 || $entity <= 0 || !mjl_scope_is_valid_role_code($roleCode)) {
		return array(-1, 'Profil de production invalide.');
	}

	$target = new User($db);
	if ($target->fetch($userId) <= 0 || (int) $target->entity !== $entity) {
		return array(-1, 'Utilisateur introuvable dans cette entite.');
	}

	$cleanSocIds = array();
	foreach ($fkSocIds as $fkSoc) {
		$fkSoc = (int) $fkSoc;
		if ($fkSoc <= 0) {
			continue;
		}
		if (mjl_scope_scalar_int('SELECT rowid FROM '.$db->prefix().'societe WHERE rowid = '.$fkSoc.' AND entity = '.$entity) === null) {
			return array(-1, 'Perimetre partenaire invalide.');
		}
		$cleanSocIds[$fkSoc] = $fkSoc;
	}
	$cleanSocIds = array_values($cleanSocIds);
	if ($roleCode !== 'ADMIN_PLATEFORME' && empty($cleanSocIds)) {
		return array(-1, 'Selectionnez au moins un partenaire ou programme.');
	}

	$wasPlatformAdmin = mjl_scope_is_platform_admin($target, $entity);
	$willPlatformAdmin = !empty($target->admin) || $roleCode === 'ADMIN_PLATEFORME';
	if ((int) $actor->id === $userId && $wasPlatformAdmin && !$willPlatformAdmin) {
		return array(-1, 'Vous ne pouvez pas retirer votre propre autorite administrateur.');
	}
	if ($wasPlatformAdmin && !$willPlatformAdmin && mjl_scope_active_platform_admin_count($entity, $userId) <= 0) {
		return array(-1, 'Au moins un administrateur plateforme actif doit rester.');
	}

	$db->begin('mjl access profile');
	if (!mjl_scope_replace_role_rows($userId, $roleCode, (int) $actor->id, $entity, $source, $note)) {
		$db->rollback('mjl access role failed');
		return array(-1, $db->lasterror());
	}
	if (!mjl_scope_replace_scope_rows($userId, $cleanSocIds, (int) $actor->id, $entity, $source, $note)) {
		$db->rollback('mjl access scope failed');
		return array(-1, $db->lasterror());
	}
	if (!mjl_scope_replace_legacy_group($userId, $roleCode, $entity)) {
		$db->rollback('mjl access group failed');
		return array(-1, $db->lasterror());
	}
	if (function_exists('mjl_auth_record_event')) {
		mjl_auth_record_event('access_profile_assigned', $userId, (int) $actor->id, 'role='.$roleCode.';scopes='.implode(',', $cleanSocIds).';source='.$source);
	}
	if (!$db->commit('mjl access profile')) {
		return array(-1, $db->lasterror());
	}
	return array(1, 'Profil et perimetre enregistres.');
}

function mjl_scope_deactivate_access($userId, User $actor, $entity = null)
{
	global $db, $conf;

	$userId = (int) $userId;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if ($userId <= 0 || $entity <= 0) {
		return array(-1, 'Utilisateur invalide.');
	}
	if ((int) $actor->id === $userId) {
		return array(-1, 'Vous ne pouvez pas desactiver votre propre acces.');
	}
	$target = new User($db);
	if ($target->fetch($userId) <= 0 || (int) $target->entity !== $entity) {
		return array(-1, 'Utilisateur introuvable dans cette entite.');
	}
	if (mjl_scope_is_platform_admin($target, $entity) && mjl_scope_active_platform_admin_count($entity, $userId) <= 0) {
		return array(-1, 'Au moins un administrateur plateforme actif doit rester.');
	}

	$db->begin('mjl deactivate access');
	$sql = 'UPDATE '.$db->prefix().'user SET statut = 0 WHERE rowid = '.$userId.' AND entity = '.$entity.' AND admin = 0';
	if (!$db->query($sql)) {
		$db->rollback('mjl deactivate user failed');
		return array(-1, $db->lasterror());
	}
	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_user_role SET is_active = 0, date_end = COALESCE(date_end, NOW()), fk_user_modif = '.((int) $actor->id);
	$sql .= ' WHERE entity = '.$entity.' AND fk_user = '.$userId.' AND is_active = 1';
	if (!$db->query($sql)) {
		$db->rollback('mjl deactivate role failed');
		return array(-1, $db->lasterror());
	}
	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_user_soc_scope SET is_active = 0, date_end = COALESCE(date_end, NOW()), fk_user_modif = '.((int) $actor->id);
	$sql .= ' WHERE entity = '.$entity.' AND fk_user = '.$userId.' AND is_active = 1';
	if (!$db->query($sql)) {
		$db->rollback('mjl deactivate scope failed');
		return array(-1, $db->lasterror());
	}
	if (function_exists('mjl_auth_record_event')) {
		mjl_auth_record_event('access_deactivated', $userId, (int) $actor->id, 'source=admin_access');
	}
	if (!$db->commit('mjl deactivate access')) {
		return array(-1, $db->lasterror());
	}
	return array(1, 'Acces desactive.');
}

function mjl_scope_assign_active_role($userId, $roleCode, $actorId = null, $entity = null, $source = 'manual', $note = '', $importKey = null)
{
	global $db, $conf;

	$userId = (int) $userId;
	$actorId = $actorId === null ? null : (int) $actorId;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	$roleCode = (string) $roleCode;
	if ($userId <= 0 || $entity <= 0 || !mjl_scope_is_valid_role_code($roleCode)) {
		return -1;
	}

	$db->begin();
	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_user_role';
	$sql .= ' SET is_active = 0, date_end = COALESCE(date_end, NOW())';
	$sql .= ', fk_user_modif = '.($actorId === null ? 'NULL' : $actorId);
	$sql .= ' WHERE entity = '.$entity.' AND fk_user = '.$userId.' AND is_active = 1';
	if (!$db->query($sql)) {
		$db->rollback();
		return -1;
	}

	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_user_role';
	$sql .= ' (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)';
	$sql .= ' VALUES ('.$entity.', '.$userId.", '".$db->escape($roleCode)."', 1, NOW(), ".mjl_scope_sql_string($source).', '.mjl_scope_sql_string($note).', NOW(), '.($actorId === null ? 'NULL' : $actorId).', '.mjl_scope_sql_string($importKey).')';
	if (!$db->query($sql)) {
		$db->rollback();
		return -1;
	}
	$id = (int) $db->last_insert_id($db->prefix().'mjlfinancement_user_role');
	$db->commit();
	return $id;
}

function mjl_scope_assign_soc_scope($userId, $fkSoc, $actorId = null, $entity = null, $source = 'manual', $note = '', $importKey = null)
{
	global $db, $conf;

	$userId = (int) $userId;
	$fkSoc = (int) $fkSoc;
	$actorId = $actorId === null ? null : (int) $actorId;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if ($userId <= 0 || $fkSoc <= 0 || $entity <= 0) {
		return -1;
	}
	if (mjl_scope_scalar_int('SELECT rowid FROM '.$db->prefix().'societe WHERE rowid = '.$fkSoc.' AND entity = '.$entity) === null) {
		return -1;
	}

	$sql = 'SELECT rowid FROM '.$db->prefix().'mjlfinancement_user_soc_scope';
	$sql .= ' WHERE entity = '.$entity.' AND fk_user = '.$userId.' AND fk_soc = '.$fkSoc.' AND is_active = 1';
	$sql .= ' ORDER BY rowid DESC LIMIT 1';
	$resql = $db->query($sql);
	if (!$resql) {
		return -1;
	}
	$obj = $db->fetch_object($resql);
	if ($obj) {
		return (int) $obj->rowid;
	}

	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_user_soc_scope';
	$sql .= ' (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)';
	$sql .= ' VALUES ('.$entity.', '.$userId.', '.$fkSoc.', 1, NOW(), '.mjl_scope_sql_string($source).', '.mjl_scope_sql_string($note).', NOW(), '.($actorId === null ? 'NULL' : $actorId).', '.mjl_scope_sql_string($importKey).')';
	if (!$db->query($sql)) {
		return -1;
	}
	return (int) $db->last_insert_id($db->prefix().'mjlfinancement_user_soc_scope');
}

function mjl_scope_user_soc_ids($userObj, $entity = null)
{
	global $db, $conf;

	// Existing SQL builders rely on null meaning unrestricted platform admin.
	if (mjl_scope_is_platform_admin($userObj, $entity)) {
		return null;
	}
	if (empty($userObj) || empty($userObj->id)) {
		return array();
	}
	if (!mjl_scope_user_has_active_business_role((int) $userObj->id, $entity)) {
		return array();
	}
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if ($entity <= 0) {
		return array();
	}

	$sql = 'SELECT DISTINCT fk_soc FROM '.$db->prefix().'mjlfinancement_user_soc_scope';
	$sql .= ' WHERE entity = '.$entity.' AND fk_user = '.((int) $userObj->id).' AND is_active = 1';
	$sql .= ' ORDER BY fk_soc';
	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}
	$ids = array();
	while ($obj = $db->fetch_object($resql)) {
		$ids[] = (int) $obj->fk_soc;
	}
	return $ids;
}

function mjl_scope_partner_sql_filter($column, $userObj, $entity = null)
{
	$column = mjl_scope_sanitized_sql_identifier($column);
	if ($column === '') {
		return ' AND 1=0';
	}
	$scopeIds = mjl_scope_user_soc_ids($userObj, $entity);
	if ($scopeIds === null) {
		return '';
	}
	if (empty($scopeIds)) {
		return ' AND 1=0';
	}
	return ' AND '.$column.' IN ('.implode(',', array_map('intval', $scopeIds)).')';
}

function mjl_scope_programme_sql_filter($column, $userObj, $entity = null)
{
	return mjl_scope_partner_sql_filter($column, $userObj, $entity);
}

function mjl_scope_partner_ids_for_sql($userObj, $entity = null)
{
	return mjl_scope_user_soc_ids($userObj, $entity);
}

function mjl_scope_programme_ids_for_sql($userObj, $entity = null)
{
	return mjl_scope_user_soc_ids($userObj, $entity);
}

function mjl_scope_can_access_fk_soc($userObj, $fkSoc, $entity = null)
{
	$fkSoc = (int) $fkSoc;
	if ($fkSoc <= 0) {
		return false;
	}
	$scopeIds = mjl_scope_user_soc_ids($userObj, $entity);
	if ($scopeIds === null) {
		return true;
	}
	return in_array($fkSoc, $scopeIds, true);
}

function mjl_scope_object_fk_soc($objectType, $objectId, $entity = null, $depth = 0)
{
	global $db, $conf;

	$objectType = (string) $objectType;
	$objectId = (int) $objectId;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if ($objectType === '' || $objectId <= 0 || $entity <= 0 || $depth > 4) {
		return null;
	}

	if ($objectType === 'mjlfinancement_convention') {
		return mjl_scope_scalar_int('SELECT fk_soc FROM '.$db->prefix().'mjlfinancement_convention WHERE entity = '.$entity.' AND rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_fund_receipt') {
		return mjl_scope_scalar_int('SELECT fk_soc FROM '.$db->prefix().'mjlfinancement_fund_receipt WHERE entity = '.$entity.' AND rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_activity') {
		return mjl_scope_scalar_int('SELECT c.fk_soc FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE a.entity = '.$entity.' AND a.rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_expense') {
		return mjl_scope_scalar_int('SELECT c.fk_soc FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE e.entity = '.$entity.' AND e.rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_budget_line') {
		return mjl_scope_scalar_int('SELECT c.fk_soc FROM '.$db->prefix().'mjlfinancement_budget_line b INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = b.fk_convention AND c.entity = b.entity WHERE b.entity = '.$entity.' AND b.rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_validation') {
		return mjl_scope_scalar_int('SELECT c.fk_soc FROM '.$db->prefix().'mjlfinancement_validation v INNER JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = v.fk_expense AND e.entity = v.entity INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE v.entity = '.$entity.' AND v.rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_project_note') {
		return mjl_scope_scalar_int('SELECT p.fk_soc FROM '.$db->prefix().'mjlfinancement_project_note n INNER JOIN '.$db->prefix().'projet p ON p.rowid = n.fk_project AND p.entity = n.entity WHERE n.entity = '.$entity.' AND n.rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_project') {
		return mjl_scope_scalar_int('SELECT fk_soc FROM '.$db->prefix().'projet WHERE entity = '.$entity.' AND rowid = '.$objectId);
	}
	if ($objectType === 'projet' || $objectType === 'project') {
		return mjl_scope_scalar_int('SELECT fk_soc FROM '.$db->prefix().'projet WHERE entity = '.$entity.' AND rowid = '.$objectId);
	}
	if ($objectType === 'mjlfinancement_workflow_action' || $objectType === 'mjlfinancement_exchange_log') {
		$table = $objectType === 'mjlfinancement_workflow_action' ? 'mjlfinancement_workflow_action' : 'mjlfinancement_exchange_log';
		$row = mjl_scope_object_pointer($table, $objectId, $entity);
		return empty($row) ? null : mjl_scope_object_fk_soc($row['object_type'], (int) $row['object_id'], $entity, $depth + 1);
	}
	if ($objectType === 'ecm_files' || $objectType === 'document') {
		$row = mjl_scope_document_pointer($objectId, $entity);
		return empty($row) ? null : mjl_scope_object_fk_soc($row['src_object_type'], (int) $row['src_object_id'], $entity, $depth + 1);
	}

	return null;
}

function mjl_scope_can_access_object($userObj, $objectType, $objectId, $entity = null)
{
	if (mjl_scope_is_platform_admin($userObj, $entity)) {
		return true;
	}
	$fkSoc = mjl_scope_object_fk_soc($objectType, $objectId, $entity);
	if ($fkSoc === null) {
		return false;
	}
	return mjl_scope_can_access_fk_soc($userObj, $fkSoc, $entity);
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

function mjl_scope_replace_role_rows($userId, $roleCode, $actorId, $entity, $source, $note)
{
	global $db;

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_user_role';
	$sql .= ' SET is_active = 0, date_end = COALESCE(date_end, NOW()), fk_user_modif = '.((int) $actorId);
	$sql .= ' WHERE entity = '.((int) $entity).' AND fk_user = '.((int) $userId).' AND is_active = 1';
	if (!$db->query($sql)) {
		return false;
	}
	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_user_role';
	$sql .= ' (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat)';
	$sql .= ' VALUES ('.((int) $entity).', '.((int) $userId).", '".$db->escape($roleCode)."', 1, NOW(), ".mjl_scope_sql_string($source).', '.mjl_scope_sql_string($note).', NOW(), '.((int) $actorId).')';
	return (bool) $db->query($sql);
}

function mjl_scope_replace_scope_rows($userId, array $fkSocIds, $actorId, $entity, $source, $note)
{
	global $db;

	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_user_soc_scope';
	$sql .= ' SET is_active = 0, date_end = COALESCE(date_end, NOW()), fk_user_modif = '.((int) $actorId);
	$sql .= ' WHERE entity = '.((int) $entity).' AND fk_user = '.((int) $userId).' AND is_active = 1';
	if (!$db->query($sql)) {
		return false;
	}
	foreach ($fkSocIds as $fkSoc) {
		$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_user_soc_scope';
		$sql .= ' (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat)';
		$sql .= ' VALUES ('.((int) $entity).', '.((int) $userId).', '.((int) $fkSoc).', 1, NOW(), '.mjl_scope_sql_string($source).', '.mjl_scope_sql_string($note).', NOW(), '.((int) $actorId).')';
		if (!$db->query($sql)) {
			return false;
		}
	}
	return true;
}

function mjl_scope_replace_legacy_group($userId, $roleCode, $entity)
{
	global $db;

	$sql = 'DELETE FROM '.$db->prefix().'usergroup_user WHERE entity = '.((int) $entity).' AND fk_user = '.((int) $userId);
	$sql .= ' AND fk_usergroup IN (SELECT rowid FROM '.$db->prefix().'usergroup WHERE entity = '.((int) $entity)." AND nom LIKE 'MJL POC - %')";
	if (!$db->query($sql)) {
		return false;
	}
	$groupName = mjl_scope_legacy_group_name_for_role($roleCode);
	if ($groupName === '') {
		return true;
	}
	$groupId = mjl_scope_legacy_group_id($groupName, $entity);
	if ($groupId <= 0) {
		return true;
	}
	$sql = 'INSERT INTO '.$db->prefix().'usergroup_user (entity, fk_user, fk_usergroup)';
	$sql .= ' VALUES ('.((int) $entity).', '.((int) $userId).', '.$groupId.')';
	return (bool) $db->query($sql);
}

function mjl_scope_legacy_group_id($groupName, $entity)
{
	global $db;

	$sql = 'SELECT rowid FROM '.$db->prefix().'usergroup';
	$sql .= ' WHERE entity = '.((int) $entity).' AND nom = '.mjl_scope_sql_string($groupName);
	$resql = $db->query($sql);
	if (!$resql) {
		return 0;
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (int) $obj->rowid : 0;
}

function mjl_scope_active_platform_admin_count($entity = null, $excludeUserId = 0)
{
	global $db, $conf;

	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	$excludeUserId = (int) $excludeUserId;
	if ($entity <= 0) {
		return 0;
	}
	$sql = 'SELECT COUNT(DISTINCT u.rowid) AS nb FROM '.$db->prefix().'user u';
	$sql .= ' LEFT JOIN '.$db->prefix()."mjlfinancement_user_role r ON r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1 AND r.role_code = 'ADMIN_PLATEFORME'";
	$sql .= ' WHERE u.entity = '.$entity.' AND u.statut = 1 AND (u.admin = 1 OR r.rowid IS NOT NULL)';
	if ($excludeUserId > 0) {
		$sql .= ' AND u.rowid <> '.$excludeUserId;
	}
	$resql = $db->query($sql);
	if (!$resql) {
		return 0;
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (int) $obj->nb : 0;
}
