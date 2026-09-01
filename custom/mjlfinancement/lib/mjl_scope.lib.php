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

function mjl_scope_assign_access_profile($userId, $roleCode, User $actor, $entity = null, $source = 'manual', $note = '')
{
	global $db, $conf;

	$userId = (int) $userId;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	$roleCode = (string) $roleCode;
	if (!mjl_scope_is_platform_admin($actor, $entity)) return array(-1, 'Action interdite.');
	if ($userId <= 0 || $entity <= 0 || !mjl_scope_is_valid_business_role_code($roleCode)) {
		return array(-1, 'Profil de production invalide.');
	}

	list($target, $targetError) = mjl_scope_role_assignment_target($userId, $roleCode, $entity);
	if (!$target) {
		return array(-1, $targetError);
	}

	$wasPlatformAdmin = mjl_scope_is_platform_admin($target, $entity);
	$willPlatformAdmin = !empty($target->admin);
	if ((int) $actor->id === $userId && $wasPlatformAdmin && !$willPlatformAdmin) {
		return array(-1, 'Vous ne pouvez pas retirer votre propre autorite administrateur.');
	}
	if ($wasPlatformAdmin && !$willPlatformAdmin && mjl_scope_active_platform_admin_count($entity, $userId) <= 0) {
		return array(-1, 'Au moins un administrateur plateforme actif doit rester.');
	}

	$db->begin('mjl access profile');
	$locked = mjl_scope_lock_user_and_active_role($userId, $entity);
	if (!$locked || (int) $locked['user']['entity'] !== $entity || (int) $locked['user']['admin'] !== 0) {
		$db->rollback('mjl access target changed');
		return array(-1, 'Utilisateur introuvable dans cette entite.');
	}
	if ($roleCode !== 'AGENT_SAISIE' && mjl_scope_has_current_activity_assignment($userId, $entity)) {
		$db->rollback('mjl access assignment guard');
		return array(-1, 'Les affectations d’Activité doivent d’abord être retirées ou transférées.');
	}
	if (!mjl_scope_replace_role_rows($userId, $roleCode, (int) $actor->id, $entity, $source, $note)) {
		$db->rollback('mjl access role failed');
		return array(-1, $db->lasterror());
	}
	if (!mjl_scope_replace_role_rights($userId, $roleCode, $entity)) {
		$db->rollback('mjl access rights failed');
		return array(-1, $db->lasterror());
	}
	if (!function_exists('mjl_auth_record_event') || mjl_auth_record_event('access_profile_assigned', $userId, (int) $actor->id, 'role='.$roleCode.';source='.$source) < 1) {
		$db->rollback('mjl access audit failed');
		return array(-1, 'La journalisation de la modification des accès a échoué.');
	}
	$sql = 'UPDATE '.$db->prefix()."mjlfinancement_invitation SET status='revoked', token_hash=NULL, date_revoked=NOW(), fk_user_revoked=".((int) $actor->id).' WHERE entity='.$entity.' AND fk_user='.$userId." AND status IN ('pending_send','sent') AND role_code <> '".$db->escape($roleCode)."'";
	if (!$db->query($sql)) {
		$db->rollback('mjl access credential revocation failed');
		return array(-1, $db->lasterror());
	}
	$sql = 'UPDATE '.$db->prefix()."mjlfinancement_password_reset SET status='revoked', token_hash=NULL, date_consumed=NOW(), fk_user_modif=".((int) $actor->id).' WHERE entity='.$entity.' AND fk_user='.$userId." AND status IN ('pending_send','sent')";
	if (!$db->query($sql)) {
		$db->rollback('mjl reset credential revocation failed');
		return array(-1, $db->lasterror());
	}
	if (!$db->commit('mjl access profile')) {
		return array(-1, $db->lasterror());
	}
	return array(1, 'Profil enregistré.');
}

function mjl_scope_deactivate_access($userId, User $actor, $entity = null)
{
	global $db, $conf;

	$userId = (int) $userId;
	$entity = $entity === null ? (int) $conf->entity : (int) $entity;
	if (!mjl_scope_is_platform_admin($actor, $entity)) return array(-1, 'Action interdite.');
	if ($userId <= 0 || $entity <= 0) {
		return array(-1, 'Utilisateur invalide.');
	}
	if ((int) $actor->id === $userId) {
		return array(-1, 'Vous ne pouvez pas desactiver votre propre accès.');
	}
	$target = new User($db);
	if ($target->fetch($userId) <= 0 || (int) $target->entity !== $entity) {
		return array(-1, 'Utilisateur introuvable dans cette entite.');
	}
	if (mjl_scope_is_platform_admin($target, $entity) && mjl_scope_active_platform_admin_count($entity, $userId) <= 0) {
		return array(-1, 'Au moins un administrateur plateforme actif doit rester.');
	}

	$db->begin('mjl deactivate access');
	$locked = mjl_scope_lock_user_and_active_role($userId, $entity);
	if (!$locked || (int) $locked['user']['entity'] !== $entity || (int) $locked['user']['admin'] !== 0) {
		$db->rollback('mjl deactivate target changed');
		return array(-1, 'Utilisateur introuvable dans cette entite.');
	}
	if (mjl_scope_has_current_activity_assignment($userId, $entity)) {
		$db->rollback('mjl deactivate assignment guard');
		return array(-1, 'Les affectations d’Activité doivent d’abord être retirées ou transférées.');
	}
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
	if (!$db->query('UPDATE '.$db->prefix()."mjlfinancement_invitation SET status='revoked', token_hash=NULL, date_revoked=NOW(), fk_user_revoked=".((int) $actor->id).' WHERE entity='.$entity.' AND fk_user='.$userId." AND status IN ('pending_send','sent')")
		|| !$db->query('UPDATE '.$db->prefix()."mjlfinancement_password_reset SET status='revoked', token_hash=NULL, date_consumed=NOW(), fk_user_modif=".((int) $actor->id).' WHERE entity='.$entity.' AND fk_user='.$userId." AND status IN ('pending_send','sent')")) {
		$db->rollback('mjl deactivate credentials failed');
		return array(-1, $db->lasterror());
	}
	if (!mjl_scope_replace_role_rights($userId, '', $entity)) {
		$db->rollback('mjl deactivate rights failed');
		return array(-1, $db->lasterror());
	}
	if (!function_exists('mjl_auth_record_event') || mjl_auth_record_event('access_deactivated', $userId, (int) $actor->id, 'source=admin_access') < 1) {
		$db->rollback('mjl deactivate audit failed');
		return array(-1, 'La journalisation de la désactivation a échoué.');
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
	if ($userId <= 0 || $entity <= 0 || !mjl_scope_is_valid_business_role_code($roleCode)) {
		return -1;
	}
	list($target) = mjl_scope_role_assignment_target($userId, $roleCode, $entity);
	if (!$target) {
		return -1;
	}

	$db->begin();
	$locked = mjl_scope_lock_user_and_active_role($userId, $entity);
	if (!$locked || (int) $locked['user']['entity'] !== $entity || (int) $locked['user']['admin'] !== 0
		|| ($roleCode !== 'AGENT_SAISIE' && mjl_scope_has_current_activity_assignment($userId, $entity))) {
		$db->rollback();
		return -1;
	}
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
	if (!mjl_scope_replace_role_rights($userId, $roleCode, $entity)) {
		$db->rollback();
		return -1;
	}
	if (!$db->commit()) {
		$db->rollback();
		return -1;
	}
	return $id;
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

function mjl_scope_role_assignment_target($userId, $roleCode, $entity)
{
	global $db;

	$target = new User($db);
	if ($target->fetch((int) $userId) <= 0 || (int) $target->entity !== (int) $entity) {
		return array(null, 'Utilisateur introuvable dans cette entite.');
	}
	if (!empty($target->admin)) {
		return array(null, 'Un administrateur Dolibarr natif ne peut pas recevoir un rôle métier MJL.');
	}
	return array($target, '');
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

function mjl_scope_lock_user_and_active_role($userId, $entity)
{
	global $db;
	$userId = (int) $userId;
	$entity = (int) $entity;
	$sql = 'SELECT rowid,entity,admin,statut FROM '.$db->prefix().'user WHERE rowid='.$userId.' ORDER BY rowid FOR UPDATE';
	$resql = $db->query($sql);
	$userRow = $resql ? $db->fetch_object($resql) : null;
	if (!$userRow) return array();
	$sql = 'SELECT rowid,role_code FROM '.$db->prefix().'mjlfinancement_user_role WHERE entity='.$entity.' AND fk_user='.$userId.' AND is_active=1 ORDER BY rowid FOR UPDATE';
	$resql = $db->query($sql);
	if (!$resql) return array();
	$roleRows = array();
	while ($row = $db->fetch_object($resql)) $roleRows[] = (array) $row;
	if (count($roleRows) > 1) return array();
	return array('user' => (array) $userRow, 'role' => empty($roleRows) ? array() : $roleRows[0]);
}

function mjl_scope_has_current_activity_assignment($userId, $entity)
{
	global $db;
	$table = $db->prefix().'mjlfinancement_activity_assignment';
	$sql = "SELECT COUNT(*) AS nb FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."'";
	$resql = $db->query($sql);
	$row = $resql ? $db->fetch_object($resql) : null;
	if (!$row || (int) $row->nb !== 1) return false;
	$sql = 'SELECT COUNT(*) AS nb FROM '.$table.' WHERE entity='.(int) $entity.' AND fk_user='.(int) $userId.' AND date_end IS NULL';
	$resql = $db->query($sql);
	$row = $resql ? $db->fetch_object($resql) : null;
	return $row && (int) $row->nb > 0;
}

function mjl_scope_rights_for_role($roleCode)
{
	$rights = array(
		'AGENT_SAISIE' => array(
			array('reference', 'read'),
			array('activity', 'read'),
		),
		'AGENT_VERIFICATEUR' => array(
			array('reference', 'read'),
			array('activity', 'read'),
		),
		'VALIDATEUR_DEFINITIF' => array(
			array('reference', 'read'),
			array('reference', 'write'),
			array('activity', 'read'),
			array('audit', 'read'),
		),
	);
	return isset($rights[$roleCode]) ? $rights[$roleCode] : array();
}

function mjl_scope_replace_role_rights($userId, $roleCode, $entity)
{
	global $db;

	$sql = 'DELETE ur FROM '.$db->prefix().'user_rights ur';
	$sql .= ' INNER JOIN '.$db->prefix()."rights_def rd ON rd.id = ur.fk_id AND rd.module = 'mjlfinancement'";
	$sql .= ' WHERE ur.entity = '.((int) $entity).' AND ur.fk_user = '.((int) $userId);
	if (!$db->query($sql)) {
		return false;
	}
	foreach (mjl_scope_rights_for_role($roleCode) as $right) {
		$sql = 'SELECT id FROM '.$db->prefix().'rights_def';
		$sql .= " WHERE module = 'mjlfinancement' AND perms = '".$db->escape($right[0])."'";
		$sql .= " AND subperms = '".$db->escape($right[1])."'";
		$sql .= ' AND entity IN (0, '.((int) $entity).') ORDER BY entity DESC, id ASC LIMIT 1';
		$resql = $db->query($sql);
		$obj = $resql ? $db->fetch_object($resql) : null;
		if (!$obj) {
			return false;
		}
		$sql = 'INSERT INTO '.$db->prefix().'user_rights (entity, fk_user, fk_id)';
		$sql .= ' VALUES ('.((int) $entity).', '.((int) $userId).', '.((int) $obj->id).')';
		if (!$db->query($sql)) {
			return false;
		}
	}
	return true;
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
	$sql .= ' WHERE u.entity = '.$entity.' AND u.statut = 1 AND u.admin = 1';
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
