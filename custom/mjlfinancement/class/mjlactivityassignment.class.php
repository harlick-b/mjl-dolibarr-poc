<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/activity_schema_installer.lib.php';

/**
 * Deep RST-002B assignment module.
 *
 * Callers provide identities and intent only. The module reloads and locks all
 * authoritative state, owns the transaction, version bump, and audit append.
 */
class MjlActivityAssignment
{
	const ADD_ADDITIONAL = 'ADD_ADDITIONAL';
	const REMOVE_ADDITIONAL = 'REMOVE_ADDITIONAL';
	const TRANSFER_PRIMARY = 'TRANSFER_PRIMARY';

	private $db;

	public function __construct(DoliDB $db)
	{
		$this->db = $db;
	}

	public function changeAssignment($activityId, $expectedVersion, User $authenticatedActor, $operation, $targetAgentId, $reason)
	{
		global $conf;
		$activityId = (int) $activityId;
		$expectedVersion = (int) $expectedVersion;
		$targetAgentId = (int) $targetAgentId;
		$actorId = (int) $authenticatedActor->id;
		$entity = isset($conf->entity) ? (int) $conf->entity : 0;
		$operation = (string) $operation;
		$reason = trim((string) $reason);
		if ($activityId <= 0 || $expectedVersion <= 0 || $targetAgentId <= 0 || $actorId <= 0 || $entity <= 0
			|| !in_array($operation, array(self::ADD_ADDITIONAL, self::REMOVE_ADDITIONAL, self::TRANSFER_PRIMARY), true)
			|| $reason === '') {
			return $this->outcome('INVALID_INPUT');
		}
		if (!$this->hasCompleteTargetSchema()) return $this->outcome('FAILED');

		// The required pre-lock assignment snapshot must be refreshed after a
		// competing transaction commits. MariaDB's default REPEATABLE READ can
		// otherwise raise ER_CHECKREAD while acquiring the later Activity lock
		// instead of letting us return the closed STALE_VERSION outcome.
		if (!$this->db->query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')) return $this->outcome('FAILED');
		$this->db->begin('mjl RST-002B assignment');
		try {
			$snapshot = $this->loadAssignments($entity, $activityId, false);
			if ($snapshot === false) return $this->rollbackOutcome('FAILED');
			$userIds = array($actorId, $targetAgentId);
			foreach ($snapshot as $row) $userIds[] = (int) $row['fk_user'];
			$userIds = array_values(array_unique($userIds));
			sort($userIds, SORT_NUMERIC);
			$users = $this->lockUsers($userIds);
			$roles = $this->lockActiveRoles($entity, $userIds);
			if ($users === false || $roles === false) return $this->rollbackOutcome('FAILED');
			if (!$this->eligibleActor($users, $roles, $actorId, $entity)) return $this->rollbackOutcome('FORBIDDEN');
			if (!$this->eligibleAgent($users, $roles, $targetAgentId, $entity)) return $this->rollbackOutcome('FORBIDDEN');

			$activity = $this->lockActivity($entity, $activityId);
			if ($activity === false) return $this->rollbackOutcome('FAILED');
			if (!$activity) return $this->rollbackOutcome('NOT_FOUND');
			$current = $this->loadAssignments($entity, $activityId, true);
			if ($current === false) return $this->rollbackOutcome('FAILED');
			if ($this->assignmentIdentity($snapshot) !== $this->assignmentIdentity($current)) return $this->rollbackOutcome('STALE_VERSION');
			if ((int) $activity['version'] !== $expectedVersion) return $this->rollbackOutcome('STALE_VERSION');
			foreach ($current as $row) {
				if (!$this->eligibleAgent($users, $roles, (int) $row['fk_user'], $entity)) return $this->rollbackOutcome('FAILED');
			}

			$before = $this->auditAssignments($current);
			$action = '';
			if ($operation === self::ADD_ADDITIONAL) {
				if ($this->findAssignment($current, $targetAgentId)) return $this->rollbackOutcome('CONFLICT');
				if (!$this->insertAssignment($entity, $activityId, $targetAgentId, false, $actorId, $reason)) return $this->rollbackOutcome('FAILED');
				$action = 'ASSIGNMENT_ADDED';
			} elseif ($operation === self::REMOVE_ADDITIONAL) {
				$target = $this->findAssignment($current, $targetAgentId);
				if (!$target || !empty($target['is_primary'])) return $this->rollbackOutcome('CONFLICT');
				if (!$this->endAssignment((int) $target['rowid'])) return $this->rollbackOutcome('FAILED');
				$action = 'ASSIGNMENT_REMOVED';
			} else {
				$primary = $this->primaryAssignment($current);
				if (!$primary || (int) $primary['fk_user'] === $targetAgentId) return $this->rollbackOutcome('CONFLICT');
				if (!$this->endAssignment((int) $primary['rowid'])) return $this->rollbackOutcome('FAILED');
				$target = $this->findAssignment($current, $targetAgentId);
				if ($target && !$this->endAssignment((int) $target['rowid'])) return $this->rollbackOutcome('FAILED');
				if (!$this->insertAssignment($entity, $activityId, $targetAgentId, true, $actorId, $reason)) return $this->rollbackOutcome('FAILED');
				$action = 'PRIMARY_TRANSFERRED';
			}

			$newVersion = $expectedVersion + 1;
			$sql = 'UPDATE '.$this->db->prefix().'mjlfinancement_activity SET version=version+1, fk_user_modif='.$actorId;
			$sql .= ' WHERE rowid='.$activityId.' AND entity='.$entity.' AND version='.$expectedVersion;
			$updateResult = $this->db->query($sql);
			if (!$updateResult || $this->db->affected_rows($updateResult) !== 1) return $this->rollbackOutcome('STALE_VERSION');
			$afterRows = $this->loadAssignments($entity, $activityId, true);
			if ($afterRows === false) return $this->rollbackOutcome('FAILED');
			$actorName = trim(trim((string) $users[$actorId]['firstname']).' '.trim((string) $users[$actorId]['lastname']));
			if ($actorName === '') $actorName = (string) $users[$actorId]['login'];
			$event = array(
				'entity' => $entity,
				'object_type' => 'activity_assignment',
				'object_id' => $activityId,
				'object_ref' => (string) $activity['ref'],
				'activity_id' => $activityId,
				'actor' => $authenticatedActor,
				'actor_name_snapshot' => $actorName,
				'actor_role_snapshot' => 'VALIDATEUR_DEFINITIF',
				'action' => $action,
				'previous_values' => array('assignments' => $before, 'version' => $expectedVersion),
				'new_values' => array('assignments' => $this->auditAssignments($afterRows), 'version' => $newVersion),
				'reason' => $reason,
				'target_version' => $expectedVersion,
				'result' => 'SUCCESS',
				'context' => array('operation' => $operation, 'target_agent_id' => $targetAgentId),
			);
			if (mjl_audit_append_in_transaction($this->db, $event) < 1) return $this->rollbackOutcome('FAILED');
			if (!$this->db->commit('mjl RST-002B assignment')) {
				$this->db->rollback('mjl RST-002B assignment commit failed');
				return $this->outcome('FAILED');
			}
			return $this->outcome('OK', $newVersion);
		} catch (Throwable $exception) {
			$this->db->rollback('mjl RST-002B assignment exception');
			return $this->outcome('FAILED');
		}
	}

	private function hasCompleteTargetSchema()
	{
		try { mjl_rst002b_require_target_objects($this->db); return true; }
		catch (Throwable $exception) { return false; }
	}

	private function lockUsers(array $ids)
	{
		$sql = 'SELECT rowid,entity,login,firstname,lastname,admin,statut FROM '.$this->db->prefix().'user WHERE rowid IN ('.implode(',', $ids).') ORDER BY rowid FOR UPDATE';
		$resql = $this->db->query($sql);
		if (!$resql) return false;
		$rows = array();
		while ($row = $this->db->fetch_object($resql)) $rows[(int) $row->rowid] = (array) $row;
		return $rows;
	}

	private function lockActiveRoles($entity, array $ids)
	{
		$sql = 'SELECT rowid,fk_user,role_code FROM '.$this->db->prefix().'mjlfinancement_user_role WHERE entity='.$entity.' AND fk_user IN ('.implode(',', $ids).') AND is_active=1 ORDER BY fk_user,rowid FOR UPDATE';
		$resql = $this->db->query($sql);
		if (!$resql) return false;
		$rows = array();
		while ($row = $this->db->fetch_object($resql)) {
			$id = (int) $row->fk_user;
			if (isset($rows[$id])) return false;
			$rows[$id] = (string) $row->role_code;
		}
		return $rows;
	}

	private function eligibleActor(array $users, array $roles, $id, $entity)
	{
		return isset($users[$id], $roles[$id]) && (int) $users[$id]['entity'] === $entity && (int) $users[$id]['statut'] === 1
			&& (int) $users[$id]['admin'] === 0 && $roles[$id] === 'VALIDATEUR_DEFINITIF';
	}

	private function eligibleAgent(array $users, array $roles, $id, $entity)
	{
		return isset($users[$id], $roles[$id]) && (int) $users[$id]['entity'] === $entity && (int) $users[$id]['statut'] === 1
			&& (int) $users[$id]['admin'] === 0 && $roles[$id] === 'AGENT_SAISIE';
	}

	private function lockActivity($entity, $activityId)
	{
		$sql = 'SELECT rowid,ref,version FROM '.$this->db->prefix().'mjlfinancement_activity WHERE entity='.$entity.' AND rowid='.$activityId.' FOR UPDATE';
		$resql = $this->db->query($sql);
		if (!$resql) return false;
		$row = $this->db->fetch_object($resql);
		return $row ? (array) $row : array();
	}

	private function loadAssignments($entity, $activityId, $lock)
	{
		$sql = 'SELECT rowid,fk_user,is_primary FROM '.$this->db->prefix().'mjlfinancement_activity_assignment WHERE entity='.$entity.' AND fk_activity='.$activityId.' AND date_end IS NULL ORDER BY fk_user,rowid';
		if ($lock) $sql .= ' FOR UPDATE';
		$resql = $this->db->query($sql);
		if (!$resql) return false;
		$rows = array();
		while ($row = $this->db->fetch_object($resql)) $rows[] = (array) $row;
		return $rows;
	}

	private function assignmentIdentity(array $rows)
	{
		$identity = array();
		foreach ($rows as $row) $identity[] = ((int) $row['fk_user']).':'.((int) $row['is_primary']);
		sort($identity, SORT_STRING);
		return implode(',', $identity);
	}

	private function findAssignment(array $rows, $userId)
	{
		foreach ($rows as $row) if ((int) $row['fk_user'] === (int) $userId) return $row;
		return array();
	}

	private function primaryAssignment(array $rows)
	{
		foreach ($rows as $row) if ((int) $row['is_primary'] === 1) return $row;
		return array();
	}

	private function insertAssignment($entity, $activityId, $agentId, $primary, $actorId, $reason)
	{
		$sql = 'INSERT INTO '.$this->db->prefix().'mjlfinancement_activity_assignment (entity,fk_activity,fk_user,is_primary,date_start,date_end,fk_user_assign,reason,date_creation) VALUES (';
		$sql .= $entity.','.$activityId.','.$agentId.','.($primary ? '1' : '0').',NOW(),NULL,'.$actorId.", '".$this->db->escape($reason)."', NOW())";
		return (bool) $this->db->query($sql);
	}

	private function endAssignment($rowId)
	{
		return (bool) $this->db->query('UPDATE '.$this->db->prefix().'mjlfinancement_activity_assignment SET date_end=NOW() WHERE rowid='.(int) $rowId.' AND date_end IS NULL');
	}

	private function auditAssignments(array $rows)
	{
		$result = array();
		foreach ($rows as $row) $result[] = array('agent_id' => (int) $row['fk_user'], 'is_primary' => (int) $row['is_primary']);
		return $result;
	}

	private function rollbackOutcome($code)
	{
		$this->db->rollback('mjl RST-002B assignment rejected');
		return $this->outcome($code);
	}

	private function outcome($code, $version = null)
	{
		return array('code' => (string) $code, 'version' => $version === null ? null : (int) $version);
	}
}
