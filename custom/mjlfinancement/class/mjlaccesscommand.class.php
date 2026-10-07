<?php

/** Deep command module for MJL access writes. */
class MjlAccessCommand
{
	private $db;
	private $entity;

	public function __construct($db, $entity)
	{
		$this->db = $db;
		$this->entity = (int) $entity;
	}

	public function assignProfile($userId, $roleCode, User $actor, $source = 'manual', $note = '')
	{
		list($target, $error) = $this->profileTarget($userId, $roleCode, $actor);
		if (!$target) return array(-1, $error);
		$this->db->begin('mjl access profile');
		$result = $this->applyProfile((int) $userId, (string) $roleCode, $actor, (string) $source, (string) $note);
		if ($result[0] < 0) {
			$this->db->rollback('mjl access profile failed');
			return $result;
		}
		if (!$this->db->commit('mjl access profile')) return array(-1, $this->db->lasterror());
		return $result;
	}

	public function assignProfileInTransaction($userId, $roleCode, User $actor, $source = 'manual', $note = '')
	{
		list($target, $error) = $this->profileTarget($userId, $roleCode, $actor);
		if (!$target) return array(-1, $error);
		return $this->applyProfile((int) $userId, (string) $roleCode, $actor, (string) $source, (string) $note);
	}

	public function deactivate($userId, User $actor)
	{
		$userId = (int) $userId;
		if (!mjl_scope_is_platform_admin($actor, $this->entity)) return array(-1, 'Action interdite.');
		if ($userId <= 0 || $this->entity <= 0) return array(-1, 'Utilisateur invalide.');
		if ((int) $actor->id === $userId) return array(-1, 'Vous ne pouvez pas desactiver votre propre accès.');
		$target = new User($this->db);
		if ($target->fetch($userId) <= 0 || (int) $target->entity !== $this->entity) return array(-1, 'Utilisateur introuvable dans cette entite.');
		if (mjl_scope_is_platform_admin($target, $this->entity) && $this->activePlatformAdminCount($userId) <= 0) return array(-1, 'Au moins un administrateur plateforme actif doit rester.');

		$this->db->begin('mjl deactivate access');
		$result = $this->applyDeactivation($userId, $actor);
		if ($result[0] < 0) {
			$this->db->rollback('mjl deactivate access failed');
			return $result;
		}
		if (!$this->db->commit('mjl deactivate access')) return array(-1, $this->db->lasterror());
		return $result;
	}

	private function profileTarget($userId, $roleCode, User $actor)
	{
		$userId = (int) $userId;
		$roleCode = (string) $roleCode;
		if (!mjl_scope_is_platform_admin($actor, $this->entity)) return array(null, 'Action interdite.');
		if ($userId <= 0 || $this->entity <= 0 || !mjl_scope_is_valid_business_role_code($roleCode)) return array(null, 'Profil de production invalide.');
		list($target, $targetError) = $this->roleAssignmentTarget($userId);
		if (!$target) return array(null, $targetError);
		$wasPlatformAdmin = mjl_scope_is_platform_admin($target, $this->entity);
		$willPlatformAdmin = !empty($target->admin);
		if ((int) $actor->id === $userId && $wasPlatformAdmin && !$willPlatformAdmin) return array(null, 'Vous ne pouvez pas retirer votre propre autorite administrateur.');
		if ($wasPlatformAdmin && !$willPlatformAdmin && $this->activePlatformAdminCount($userId) <= 0) return array(null, 'Au moins un administrateur plateforme actif doit rester.');
		return array($target, '');
	}

	private function applyProfile($userId, $roleCode, User $actor, $source, $note)
	{
		$locked = $this->lockUserAndActiveRole($userId);
		if (!$locked || (int) $locked['user']['entity'] !== $this->entity || (int) $locked['user']['admin'] !== 0) return array(-1, 'Utilisateur introuvable dans cette entite.');
		$hasAssignment = $this->hasCurrentActivityAssignment($userId);
		if ($hasAssignment === null) return array(-1, 'La vérification des affectations a échoué.');
		if ($roleCode !== 'AGENT_SAISIE' && $hasAssignment) return array(-1, 'Les affectations d’Activité doivent d’abord être retirées ou transférées.');
		if (!$this->replaceRoleRows($userId, $roleCode, (int) $actor->id, $source, $note)) return array(-1, $this->db->lasterror());
		if (!$this->replaceRoleRights($userId, $roleCode)) return array(-1, $this->db->lasterror());
		if ($this->audit('access_profile_assigned', $userId, $actor, 'role='.$roleCode.';source='.$source) < 1) return array(-1, 'La journalisation de la modification des accès a échoué.');
		$sql = 'UPDATE '.$this->db->prefix()."mjlfinancement_invitation SET status='revoked', token_hash=NULL, date_revoked=NOW(), fk_user_revoked=".((int) $actor->id).' WHERE entity='.$this->entity.' AND fk_user='.$userId." AND status IN ('pending_send','sent') AND role_code <> '".$this->db->escape($roleCode)."'";
		if (!$this->db->query($sql)) return array(-1, $this->db->lasterror());
		$sql = 'UPDATE '.$this->db->prefix()."mjlfinancement_password_reset SET status='revoked', token_hash=NULL, date_consumed=NOW(), fk_user_modif=".((int) $actor->id).' WHERE entity='.$this->entity.' AND fk_user='.$userId." AND status IN ('pending_send','sent')";
		if (!$this->db->query($sql)) return array(-1, $this->db->lasterror());
		return array(1, 'Profil enregistré.');
	}

	private function applyDeactivation($userId, User $actor)
	{
		$locked = $this->lockUserAndActiveRole($userId);
		if (!$locked || (int) $locked['user']['entity'] !== $this->entity || (int) $locked['user']['admin'] !== 0) return array(-1, 'Utilisateur introuvable dans cette entite.');
		$hasAssignment = $this->hasCurrentActivityAssignment($userId);
		if ($hasAssignment === null) return array(-1, 'La vérification des affectations a échoué.');
		if ($hasAssignment) return array(-1, 'Les affectations d’Activité doivent d’abord être retirées ou transférées.');
		$sql = 'UPDATE '.$this->db->prefix().'user SET statut = 0 WHERE rowid = '.$userId.' AND entity = '.$this->entity.' AND admin = 0';
		if (!$this->db->query($sql)) return array(-1, $this->db->lasterror());
		$sql = 'UPDATE '.$this->db->prefix().'mjlfinancement_user_role SET is_active = 0, date_end = COALESCE(date_end, NOW()), fk_user_modif = '.((int) $actor->id);
		$sql .= ' WHERE entity = '.$this->entity.' AND fk_user = '.$userId.' AND is_active = 1';
		if (!$this->db->query($sql)) return array(-1, $this->db->lasterror());
		if (!$this->db->query('UPDATE '.$this->db->prefix()."mjlfinancement_invitation SET status='revoked', token_hash=NULL, date_revoked=NOW(), fk_user_revoked=".((int) $actor->id).' WHERE entity='.$this->entity.' AND fk_user='.$userId." AND status IN ('pending_send','sent')")
			|| !$this->db->query('UPDATE '.$this->db->prefix()."mjlfinancement_password_reset SET status='revoked', token_hash=NULL, date_consumed=NOW(), fk_user_modif=".((int) $actor->id).' WHERE entity='.$this->entity.' AND fk_user='.$userId." AND status IN ('pending_send','sent')")) return array(-1, $this->db->lasterror());
		if (!$this->replaceRoleRights($userId, '')) return array(-1, $this->db->lasterror());
		if ($this->audit('access_deactivated', $userId, $actor, 'source=admin_access') < 1) return array(-1, 'La journalisation de la désactivation a échoué.');
		return array(1, 'Acces desactive.');
	}

	private function audit($event, $targetUserId, User $actor, $context)
	{
		if (!function_exists('mjl_audit_append_in_transaction')) return -1;
		return mjl_audit_append_in_transaction($this->db, array(
			'entity' => $this->entity,
			'object_type' => 'mjlfinancement_user',
			'object_id' => (int) $targetUserId,
			'actor' => $actor,
			'action' => (string) $event,
			'result' => 'SUCCESS',
			'context' => array('detail' => (string) $context),
		));
	}

	private function roleAssignmentTarget($userId)
	{
		$target = new User($this->db);
		if ($target->fetch((int) $userId) <= 0 || (int) $target->entity !== $this->entity) return array(null, 'Utilisateur introuvable dans cette entite.');
		if (!empty($target->admin)) return array(null, 'Un administrateur Dolibarr natif ne peut pas recevoir un rôle métier MJL.');
		return array($target, '');
	}

	private function activePlatformAdminCount($excludeUserId = 0)
	{
		if ($this->entity <= 0) return 0;
		$sql = 'SELECT COUNT(DISTINCT u.rowid) AS nb FROM '.$this->db->prefix().'user u';
		$sql .= ' WHERE u.entity = '.$this->entity.' AND u.statut = 1 AND u.admin = 1';
		if ((int) $excludeUserId > 0) $sql .= ' AND u.rowid <> '.((int) $excludeUserId);
		$resql = $this->db->query($sql);
		if (!$resql) return 0;
		$obj = $this->db->fetch_object($resql);
		return $obj ? (int) $obj->nb : 0;
	}

	private function lockUserAndActiveRole($userId)
	{
		$userId = (int) $userId;
		$sql = 'SELECT rowid,entity,admin,statut FROM '.$this->db->prefix().'user WHERE rowid='.$userId.' ORDER BY rowid FOR UPDATE';
		$resql = $this->db->query($sql);
		$userRow = $resql ? $this->db->fetch_object($resql) : null;
		if (!$userRow) return array();
		$sql = 'SELECT rowid,role_code FROM '.$this->db->prefix().'mjlfinancement_user_role WHERE entity='.$this->entity.' AND fk_user='.$userId.' AND is_active=1 ORDER BY rowid FOR UPDATE';
		$resql = $this->db->query($sql);
		if (!$resql) return array();
		$roleRows = array();
		while ($row = $this->db->fetch_object($resql)) $roleRows[] = (array) $row;
		if (count($roleRows) > 1) return array();
		return array('user' => (array) $userRow, 'role' => empty($roleRows) ? array() : $roleRows[0]);
	}

	private function hasCurrentActivityAssignment($userId)
	{
		$table = $this->db->prefix().'mjlfinancement_activity_assignment';
		$sql = "SELECT COUNT(*) AS nb FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$this->db->escape($table)."'";
		$resql = $this->db->query($sql);
		if (!$resql || !($row = $this->db->fetch_object($resql))) return null;
		if ((int) $row->nb === 0) return false;
		if ((int) $row->nb !== 1) return null;
		$sql = 'SELECT COUNT(*) AS nb FROM '.$table.' WHERE entity='.$this->entity.' AND fk_user='.(int) $userId.' AND date_end IS NULL';
		$resql = $this->db->query($sql);
		$row = $resql ? $this->db->fetch_object($resql) : null;
		return $row ? (int) $row->nb > 0 : null;
	}

	private function replaceRoleRows($userId, $roleCode, $actorId, $source, $note)
	{
		$sql = 'UPDATE '.$this->db->prefix().'mjlfinancement_user_role';
		$sql .= ' SET is_active = 0, date_end = COALESCE(date_end, NOW()), fk_user_modif = '.((int) $actorId);
		$sql .= ' WHERE entity = '.$this->entity.' AND fk_user = '.((int) $userId).' AND is_active = 1';
		if (!$this->db->query($sql)) return false;
		$sql = 'INSERT INTO '.$this->db->prefix().'mjlfinancement_user_role';
		$sql .= ' (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat)';
		$sql .= ' VALUES ('.$this->entity.', '.((int) $userId).", '".$this->db->escape($roleCode)."', 1, NOW(), ".$this->sqlString($source).', '.$this->sqlString($note).', NOW(), '.((int) $actorId).')';
		return (bool) $this->db->query($sql);
	}

	private function sqlString($value)
	{
		return $value === null || $value === '' ? 'NULL' : "'".$this->db->escape((string) $value)."'";
	}

	private function rightsForRole($roleCode)
	{
		$rights = array(
			'AGENT_SAISIE' => array(array('reference', 'read'), array('activity', 'read')),
			'AGENT_VERIFICATEUR' => array(array('reference', 'read'), array('activity', 'read')),
			'VALIDATEUR_DEFINITIF' => array(array('reference', 'read'), array('reference', 'write'), array('activity', 'read'), array('audit', 'read')),
		);
		return isset($rights[$roleCode]) ? $rights[$roleCode] : array();
	}

	private function replaceRoleRights($userId, $roleCode)
	{
		$sql = 'DELETE ur FROM '.$this->db->prefix().'user_rights ur';
		$sql .= ' INNER JOIN '.$this->db->prefix()."rights_def rd ON rd.id = ur.fk_id AND rd.module = 'mjlfinancement'";
		$sql .= ' WHERE ur.entity = '.$this->entity.' AND ur.fk_user = '.((int) $userId);
		if (!$this->db->query($sql)) return false;
		foreach ($this->rightsForRole($roleCode) as $right) {
			$sql = 'SELECT id FROM '.$this->db->prefix().'rights_def';
			$sql .= " WHERE module = 'mjlfinancement' AND perms = '".$this->db->escape($right[0])."'";
			$sql .= " AND subperms = '".$this->db->escape($right[1])."'";
			$sql .= ' AND entity IN (0, '.$this->entity.') ORDER BY entity DESC, id ASC LIMIT 1';
			$resql = $this->db->query($sql);
			$obj = $resql ? $this->db->fetch_object($resql) : null;
			if (!$obj) return false;
			$sql = 'INSERT INTO '.$this->db->prefix().'user_rights (entity, fk_user, fk_id)';
			$sql .= ' VALUES ('.$this->entity.', '.((int) $userId).', '.((int) $obj->id).')';
			if (!$this->db->query($sql)) return false;
		}
		return true;
	}
}
