<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst006a_schema.lib.php';

/** Deep aggregate module for every RST-006A Activity mutation. */
class MjlActivityCommand
{
	const OUTCOMES = array('OK','INVALID_INPUT','FORBIDDEN','NOT_FOUND','STALE_VERSION','CONFLICT','RETRYABLE_CONFLICT','MIGRATION_REQUIRED','FAILED');
	private $db;
	private $calendar;
	private $entity;
	private $contributorProfiles = array();

	public function __construct(DoliDB $db, callable $calendar = null, $entity = null)
	{
		global $conf;
		$this->db = $db;
		$this->entity = $entity === null ? (int) $conf->entity : (int) $entity;
		$this->calendar = $calendar ?: function () {
			return (new DateTimeImmutable('now', new DateTimeZone('Africa/Porto-Novo')))->format('Y-m-d');
		};
	}

	public function createDraft(array $input, User $actor) { return $this->create($input, $actor, false); }
	public function createAndSubmit(array $input, User $actor) { return $this->create($input, $actor, true); }

	public function saveStructure($activityId, $expectedVersion, array $input, User $actor)
	{
		if (!$this->decimalId($activityId) || !$this->decimalId($expectedVersion) || !$this->validStructure($input, false)) return $this->outcome('INVALID_INPUT');
		return $this->transaction(function () use ($activityId, $expectedVersion, $input, $actor) {
			$premiseActivity = $this->readActivity($activityId);
			$premiseOperations = $this->readOperations($activityId);
			if (!$premiseActivity || $premiseOperations === false) return $this->reject($premiseActivity === false ? 'FAILED' : 'NOT_FOUND');
			$auth = $this->lockActor($actor);
			if (!$auth || $auth['role'] !== 'AGENT_SAISIE') return $this->reject('FORBIDDEN');
			if (!$this->lockReferences($input, $premiseActivity, $premiseOperations)) return $this->reject('INVALID_INPUT');
			$a = $this->lockActivity($activityId);
			if ($a === false) return $this->reject('FAILED');
			if (!$a) return $this->reject('NOT_FOUND');
			if ((string) $a['version'] !== (string) $expectedVersion) return $this->reject('STALE_VERSION');
			$assignments = $this->lockAssignments($activityId);
			if ($assignments === false || !$this->containsAssignment($assignments, $auth['id']) || !in_array($a['validation_status'], array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'), true)) return $this->reject('FORBIDDEN');
			if (!$this->future($a['date_start']) || !$this->future($input['date_start'])) return $this->reject('CONFLICT');
			$currentOps = $this->lockOperations($activityId);
			if ($currentOps === false || !$this->lockReferences($input, $a, $currentOps, false)) return $this->reject('INVALID_INPUT');
			if (!$this->writeOperations($a, $input['operations'], $auth['id'])) return $this->reject('CONFLICT');
			$newVersion = ((int) $a['version']) + 1;
			if (!$this->updateActivityStructure($a, $input, $auth['id'], $newVersion)) return $this->reject('STALE_VERSION');
			if (!$this->audit($a, $actor, 'ACTIVITY_STRUCTURE_SAVED', $a['validation_status'], $a['validation_status'], array('candidate_revision' => $this->nextRevisionNumber($activityId)))) return $this->reject('FAILED');
			return $this->accept($activityId, $newVersion);
		});
	}

	public function submitRevision($activityId, $expectedVersion, User $actor)
	{
		if (!$this->decimalId($activityId) || !$this->decimalId($expectedVersion)) return $this->outcome('INVALID_INPUT');
		return $this->transaction(function () use ($activityId, $expectedVersion, $actor) {
			$premiseActivity = $this->readActivity($activityId);
			$premiseOperations = $this->readOperations($activityId);
			if (!$premiseActivity || $premiseOperations === false) return $this->reject($premiseActivity === false ? 'FAILED' : 'NOT_FOUND');
			$contributorIds = $this->readContributorIds($premiseActivity, (int) $actor->id);
			if ($contributorIds === false) return $this->reject('FAILED');
			$auth = $this->lockActor($actor, $contributorIds);
			if (!$auth || $auth['role'] !== 'AGENT_SAISIE') return $this->reject('FORBIDDEN');
			$referenceInput = $this->structureFromRows($premiseActivity, $premiseOperations);
			if (!$this->lockReferences($referenceInput, $premiseActivity, $premiseOperations)) return $this->reject('CONFLICT');
			$a = $this->lockActivity($activityId);
			if ($a === false) return $this->reject('FAILED');
			if (!$a) return $this->reject('NOT_FOUND');
			if ((string) $a['version'] !== (string) $expectedVersion) return $this->reject('STALE_VERSION');
			$assignments = $this->lockAssignments($activityId);
			if ($assignments === false || !$this->containsAssignment($assignments, $auth['id']) || !in_array($a['validation_status'], array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'), true)) return $this->reject('FORBIDDEN');
			if (!$this->future($a['date_start'])) return $this->reject('CONFLICT');
			$ops = $this->lockOperations($activityId);
			if ($ops === false || !$this->lockReferences($this->structureFromRows($a, $ops), $a, $ops, false) || !$this->balanced($a, $ops)) return $this->reject('CONFLICT');
			$revisionNumber = $this->nextRevisionNumber($activityId);
			$contributorIds = $this->contributorIds($a, $revisionNumber, $auth['id']);
			$snapshot = $this->snapshot($a, $ops, $auth, $contributorIds);
			if ($snapshot === false) return $this->reject('FAILED');
			$structuralHash = hash('sha256', $this->structuralJson($a, $ops));
			if ($revisionNumber > 1) {
				$prior = $this->currentRevision($a);
				if (!$prior || hash_equals($prior['structural_hash'], $structuralHash)) return $this->reject('CONFLICT');
				if ($a['validation_status'] === 'RETURNED_SUPERVISOR' && (string) $prior['proposed_amount'] !== (string) $a['draft_authorized_amount']) return $this->reject('CONFLICT');
				if ($a['validation_status'] === 'RETURNED_VALIDATOR' && !$this->validatorReturnAllowsAmount($prior, $a['draft_authorized_amount'])) return $this->reject('CONFLICT');
			}
			$newVersion = ((int) $a['version']) + 1;
			$revisionId = $this->insertRevision($a, $revisionNumber, $newVersion, $snapshot, $structuralHash, $auth);
			if (!$revisionId || !$this->insertContributors($a, $revisionId, $contributorIds)) return $this->reject('FAILED');
			$first = $revisionNumber === 1 ? (string) $a['draft_authorized_amount'] : (string) $a['first_submitted_amount'];
			$sql = 'UPDATE '.$this->table('activity')." SET validation_status='SUBMITTED',fk_current_revision=".$revisionId.',first_submitted_amount='.$first.',version='.$newVersion.',fk_user_modif='.$auth['id'].' WHERE entity='.$this->entity.' AND rowid='.(int) $activityId.' AND version='.(int) $expectedVersion;
			$res = $this->db->query($sql);
			if (!$res || $this->db->affected_rows($res) !== 1) return $this->reject('STALE_VERSION');
			if (!$this->audit($a, $actor, 'ACTIVITY_REVISION_SUBMITTED', $a['validation_status'], 'SUBMITTED', array('revision_id' => $revisionId, 'revision_number' => $revisionNumber))) return $this->reject('FAILED');
			return $this->accept($activityId, $newVersion, $revisionId);
		});
	}

	public function abandonDraft($activityId, $expectedVersion, User $actor, $reason)
	{
		if (!$this->decimalId($activityId) || !$this->decimalId($expectedVersion) || !$this->text($reason, 2000, true)) return $this->outcome('INVALID_INPUT');
		return $this->transaction(function () use ($activityId, $expectedVersion, $actor, $reason) {
			$auth = $this->lockActor($actor); $a = $this->lockActivity($activityId);
			if (!$auth || $auth['role'] !== 'AGENT_SAISIE') return $this->reject('FORBIDDEN');
			if (!$a) return $this->reject($a === false ? 'FAILED' : 'NOT_FOUND');
			if ((string) $a['version'] !== (string) $expectedVersion) return $this->reject('STALE_VERSION');
			if ($a['validation_status'] !== 'DRAFT' || !empty($a['fk_current_revision']) || !$this->isAssigned($activityId, $auth['id'])) return $this->reject('FORBIDDEN');
			if (!$this->endAllAssignments($activityId)) return $this->reject('FAILED');
			$newVersion = ((int) $a['version']) + 1;
			if (!$this->simpleActivityUpdate($a, $newVersion, $auth['id'], "validation_status='ABANDONED'")) return $this->reject('STALE_VERSION');
			if (!$this->audit($a, $actor, 'ACTIVITY_ABANDONED', 'DRAFT', 'ABANDONED', array(), $reason)) return $this->reject('FAILED');
			return $this->accept($activityId, $newVersion);
		});
	}

	public function restoreDraft($activityId, $expectedVersion, User $actor, $primaryAgentId, $reason)
	{
		if (!$this->decimalId($activityId) || !$this->decimalId($expectedVersion) || !$this->decimalId($primaryAgentId) || !$this->text($reason, 2000, true)) return $this->outcome('INVALID_INPUT');
		return $this->transaction(function () use ($activityId, $expectedVersion, $actor, $primaryAgentId, $reason) {
			$auth = $this->lockActor($actor, array((int) $primaryAgentId)); $a = $this->lockActivity($activityId);
			if (!$auth || $auth['role'] !== 'VALIDATEUR_DEFINITIF') return $this->reject('FORBIDDEN');
			if (!$a) return $this->reject($a === false ? 'FAILED' : 'NOT_FOUND');
			if ((string) $a['version'] !== (string) $expectedVersion) return $this->reject('STALE_VERSION');
			if ($a['validation_status'] !== 'ABANDONED' || !$this->future($a['date_start']) || $this->currentAssignmentCount($activityId) !== 0 || !$this->eligibleAgent($primaryAgentId)) return $this->reject('CONFLICT');
			if (!$this->insertAssignment($activityId, $primaryAgentId, true, $auth['id'], $reason)) return $this->reject('FAILED');
			$newVersion = ((int) $a['version']) + 1;
			if (!$this->simpleActivityUpdate($a, $newVersion, $auth['id'], "validation_status='DRAFT'")) return $this->reject('STALE_VERSION');
			if (!$this->audit($a, $actor, 'ACTIVITY_RESTORED', 'ABANDONED', 'DRAFT', array('primary_agent_id' => (int) $primaryAgentId), $reason)) return $this->reject('FAILED');
			return $this->accept($activityId, $newVersion);
		});
	}

	public function reviewRevision($activityId, $revisionId, $expectedVersion, User $actor, $decision, $reason = '', $requestedAmount = null)
	{
		$allowed = array('PREVALIDATED','RETURNED_SUPERVISOR','FINAL_VALIDATED','RETURNED_VALIDATOR');
		if (!$this->decimalId($activityId) || !$this->decimalId($revisionId) || !$this->decimalId($expectedVersion) || !in_array($decision, $allowed, true)
			|| ($reason !== '' && !$this->text($reason, 2000, false)) || ($requestedAmount !== null && !$this->decimalAmount($requestedAmount, false))) return $this->outcome('INVALID_INPUT');
		return $this->transaction(function () use ($activityId, $revisionId, $expectedVersion, $actor, $decision, $reason, $requestedAmount) {
			$auth = $this->lockActor($actor); $a = $this->lockActivity($activityId);
			if (!$auth) return $this->reject('FORBIDDEN');
			if (!$a) return $this->reject($a === false ? 'FAILED' : 'NOT_FOUND');
			if ((string) $a['version'] !== (string) $expectedVersion || (string) $a['fk_current_revision'] !== (string) $revisionId) return $this->reject('STALE_VERSION');
			$revision = $this->lockRevision($activityId, $revisionId);
			if (!$revision || !$this->verifyRevision($revision)) return $this->reject('CONFLICT');
			$isSupervisor = in_array($decision, array('PREVALIDATED','RETURNED_SUPERVISOR'), true);
			if (($isSupervisor && ($auth['role'] !== 'AGENT_VERIFICATEUR' || $a['validation_status'] !== 'SUBMITTED')) || (!$isSupervisor && ($auth['role'] !== 'VALIDATEUR_DEFINITIF' || $a['validation_status'] !== 'PREVALIDATED'))) return $this->reject('FORBIDDEN');
			if ($this->isContributor($revisionId, $auth['id'])) return $this->reject('FORBIDDEN');
			if (strpos($decision, 'RETURNED_') === 0 && (!$this->text($reason, 2000, true) || !$this->future($a['date_start']))) return $this->reject('CONFLICT');
			if ($decision !== 'RETURNED_VALIDATOR' && $requestedAmount !== null) return $this->reject('INVALID_INPUT');
			$prevalidationId = null;
			if ($decision === 'FINAL_VALIDATED') {
				$prevalidation = $this->prevalidation($revisionId);
				if (!$prevalidation || (int) $prevalidation['fk_actor'] === $auth['id']) return $this->reject('FORBIDDEN');
				$prevalidationId = (int) $prevalidation['rowid'];
			}
			$stage = $isSupervisor ? 'SUPERVISOR' : 'VALIDATOR';
			$after = $decision;
			$decisionId = $this->insertDecision($a, $revision, $auth, $stage, $decision, $reason, $requestedAmount, $prevalidationId);
			if (!$decisionId) return $this->reject('CONFLICT');
			$newVersion = ((int) $a['version']) + 1;
			$extra = "validation_status='".$this->db->escape($after)."'";
			if ($decision === 'FINAL_VALIDATED') $extra .= ',latest_validated_amount='.(string) $revision['proposed_amount'];
			if (!$this->simpleActivityUpdate($a, $newVersion, $auth['id'], $extra)) return $this->reject('STALE_VERSION');
			if (!$this->audit($a, $actor, 'ACTIVITY_REVIEW_DECIDED', $a['validation_status'], $after, array('revision_id' => (int) $revisionId, 'decision_id' => $decisionId), $reason)) return $this->reject('FAILED');
			return $this->accept($activityId, $newVersion, $revisionId);
		});
	}

	private function create(array $input, User $actor, $submit)
	{
		if (!$this->validStructure($input, (bool) $submit)) return $this->outcome('INVALID_INPUT');
		return $this->transaction(function () use ($input, $actor, $submit) {
			$auth = $this->lockActor($actor);
			if (!$auth || $auth['role'] !== 'AGENT_SAISIE') return $this->reject('FORBIDDEN');
			if (!$this->future($input['date_start']) || !$this->lockReferences($input)) return $this->reject('CONFLICT');
			$ref = $this->allocateReference();
			if ($ref === false) return $this->reject('FAILED');
			$sql = 'INSERT INTO '.$this->table('activity').' (entity,ref,fk_partner,fk_project,name,description,date_start,date_end,draft_authorized_amount,first_submitted_amount,latest_validated_amount,fk_current_revision,validation_status,is_cancelled,version,date_creation,fk_user_creat,fk_user_modif) VALUES (';
			$sql .= $this->entity.", '".$this->db->escape($ref)."', ".(int) $input['partner_id'].', '.(int) $input['project_id'].", '".$this->db->escape($this->normalized($input['name']))."', '".$this->db->escape($this->normalized($input['description']))."', '".$input['date_start']."', '".$input['date_end']."', ".$input['authorized_amount'].", NULL,NULL,NULL,'DRAFT',0,1,NOW(),".$auth['id'].','.$auth['id'].')';
			if (!$this->db->query($sql)) return $this->reject('FAILED');
			$id = (int) $this->db->last_insert_id($this->table('activity'));
			$a = $this->lockActivity($id);
			if (!$a || !$this->insertAssignment($id, $auth['id'], true, $auth['id'], 'Créateur de l’Activité') || !$this->writeOperations($a, $input['operations'], $auth['id'])) return $this->reject('FAILED');
			if (!$this->audit($a, $actor, 'ACTIVITY_CREATED', '', 'DRAFT', array('reference' => $ref))) return $this->reject('FAILED');
			if (!$submit) return $this->accept($id, 1);
			$ops = $this->lockOperations($id);
			if (!$this->balanced($a, $ops)) return $this->reject('CONFLICT');
			$snapshot = $this->snapshot($a, $ops, $auth, array($auth['id']));
			if ($snapshot === false) return $this->reject('FAILED');
			$revisionId = $this->insertRevision($a, 1, 2, $snapshot, hash('sha256', $this->structuralJson($a, $ops)), $auth);
			if (!$revisionId || !$this->insertContributors($a, $revisionId, array($auth['id']))) return $this->reject('FAILED');
			$res = $this->db->query('UPDATE '.$this->table('activity')." SET validation_status='SUBMITTED',fk_current_revision=$revisionId,first_submitted_amount=".$a['draft_authorized_amount'].',version=2 WHERE entity='.$this->entity.' AND rowid='.$id.' AND version=1');
			if (!$res || !$this->audit($a, $actor, 'ACTIVITY_REVISION_SUBMITTED', 'DRAFT', 'SUBMITTED', array('revision_id' => $revisionId, 'revision_number' => 1))) return $this->reject('FAILED');
			return $this->accept($id, 2, $revisionId);
		});
	}

	private function transaction(callable $work)
	{
		try { mjl_rst006a_require_target($this->db); }
		catch (Throwable $e) { return $this->outcome($e->getMessage() === 'MIGRATION_REQUIRED' ? 'MIGRATION_REQUIRED' : 'FAILED'); }
		if ($this->entity <= 0 || $this->db->transaction_opened > 0) return $this->outcome('CONFLICT');
		if (!$this->db->query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')) return $this->outcome($this->databaseFailureOutcome());
		if (!$this->db->begin('mjl RST-006A aggregate')) return $this->outcome($this->databaseFailureOutcome());
		try {
			$result = $work();
			if (!empty($result['_rollback'])) {
				$databaseOutcome = $this->databaseFailureOutcome();
				$this->db->rollback('mjl RST-006A database failure');
				unset($result['_rollback']);
				return $databaseOutcome === 'RETRYABLE_CONFLICT' ? $this->outcome($databaseOutcome) : $result;
			}
			if (!$this->db->commit('mjl RST-006A aggregate')) {
				$databaseOutcome = $this->databaseFailureOutcome();
				$this->db->rollback('mjl RST-006A database failure');
				return $this->outcome($databaseOutcome);
			}
			return $result;
		} catch (Throwable $e) {
			$outcome = $this->databaseFailureOutcome($e);
			$this->db->rollback('mjl RST-006A database failure');
			return $this->outcome($outcome);
		}
	}

	private function databaseFailureOutcome(Throwable $exception = null)
	{
		$codes = array();
		foreach (array('lasterrno','errno') as $method) if (method_exists($this->db, $method)) {
			try { $codes[] = (int) $this->db->{$method}(); } catch (Throwable $ignored) {}
		}
		foreach (array('lasterrno','errno') as $property) if (isset($this->db->{$property})) $codes[] = (int) $this->db->{$property};
		$message = strtolower((string) $this->db->lasterror().' '.($exception ? $exception->getMessage() : ''));
		if (in_array(1205, $codes, true) || in_array(1213, $codes, true)
			|| preg_match('/(?:^|[^0-9])(1205|1213)(?:[^0-9]|$)/', $message)
			|| strpos($message, 'deadlock') !== false || strpos($message, 'lock wait timeout') !== false) return 'RETRYABLE_CONFLICT';
		return 'FAILED';
	}

	private function lockActor(User $actor, array $extraIds = array())
	{
		$ids = array_values(array_unique(array_merge(array((int) $actor->id), array_map('intval', $extraIds)))); sort($ids, SORT_NUMERIC);
		if (!$ids || $ids[0] <= 0) return false;
		$res = $this->db->query('SELECT rowid,entity,login,firstname,lastname,admin,statut FROM '.$this->db->prefix().'user WHERE rowid IN ('.implode(',', $ids).') ORDER BY rowid FOR UPDATE');
		if (!$res) return false; $users = array(); while ($row = $this->db->fetch_object($res)) $users[(int) $row->rowid] = (array) $row;
		$res = $this->db->query('SELECT fk_user,role_code FROM '.$this->table('user_role').' WHERE entity='.$this->entity.' AND fk_user IN ('.implode(',', $ids).') AND is_active=1 ORDER BY fk_user,rowid FOR UPDATE');
		if (!$res) return false; $roles = array(); while ($row = $this->db->fetch_object($res)) { if (isset($roles[(int) $row->fk_user])) return false; $roles[(int) $row->fk_user] = $row->role_code; }
		$id = (int) $actor->id;
		if (!isset($users[$id]) || (int) $users[$id]['entity'] !== $this->entity || (int) $users[$id]['admin'] !== 0 || (int) $users[$id]['statut'] !== 1 || !isset($roles[$id])) return false;
		$name = trim(trim($users[$id]['firstname']).' '.trim($users[$id]['lastname'])); if ($name === '') $name = $users[$id]['login'];
		return array('id' => $id, 'role' => $roles[$id], 'name' => $name);
	}

	private function lockActivity($id)
	{
		$res = $this->db->query('SELECT * FROM '.$this->table('activity').' WHERE entity='.$this->entity.' AND rowid='.(int) $id.' FOR UPDATE');
		if (!$res) return false; $row = $this->db->fetch_object($res); return $row ? (array) $row : array();
	}

	private function readActivity($id)
	{
		$res = $this->db->query('SELECT * FROM '.$this->table('activity').' WHERE entity='.$this->entity.' AND rowid='.(int) $id);
		if (!$res) return false; $row = $this->db->fetch_object($res); return $row ? (array) $row : array();
	}

	private function readOperations($activityId)
	{
		$res = $this->db->query('SELECT o.*,t.label AS type_label FROM '.$this->table('operation').' o INNER JOIN '.$this->table('operation_type').' t ON t.rowid=o.fk_operation_type AND t.entity=o.entity WHERE o.entity='.$this->entity.' AND o.fk_activity='.(int)$activityId.' AND o.date_removed IS NULL ORDER BY o.rowid');
		if (!$res) return false; $rows=array(); while($row=$this->db->fetch_object($res))$rows[]=(array)$row; return $rows;
	}

	private function readContributorIds(array $activity, $submitterId)
	{
		$ids=array((int)$activity['fk_user_creat'],(int)$submitterId);
		$res=$this->db->query('SELECT DISTINCT fk_user FROM '.$this->table('revision_contributor').' WHERE entity='.$this->entity.' AND fk_activity='.(int)$activity['rowid']);if(!$res)return false;while($row=$this->db->fetch_object($res))$ids[]=(int)$row->fk_user;
		$res=$this->db->query('SELECT DISTINCT actor_id FROM '.$this->table('audit_event')." WHERE entity=".$this->entity." AND activity_id=".(int)$activity['rowid']." AND action='ACTIVITY_STRUCTURE_SAVED' AND actor_id IS NOT NULL");if(!$res)return false;while($row=$this->db->fetch_object($res))$ids[]=(int)$row->actor_id;
		$ids=array_values(array_unique($ids));sort($ids,SORT_NUMERIC);return $ids;
	}

	private function structureFromRows(array $activity, array $operations)
	{
		$rows=array();foreach($operations as$operation)$rows[]=array('id'=>(string)$operation['rowid'],'expected_version'=>(string)$operation['version'],'client_key'=>'op-'.(string)$operation['rowid'],'name'=>(string)$operation['name'],'type_id'=>(string)$operation['fk_operation_type'],'authorized_amount'=>(string)$operation['authorized_amount']);
		return array('partner_id'=>(string)$activity['fk_partner'],'project_id'=>(string)$activity['fk_project'],'name'=>(string)$activity['name'],'description'=>(string)$activity['description'],'date_start'=>(string)$activity['date_start'],'date_end'=>(string)$activity['date_end'],'authorized_amount'=>(string)$activity['draft_authorized_amount'],'operations'=>$rows);
	}

	private function lockReferences(array $input, array $activity = array(), array $currentOps = array(), $forUpdate = true)
	{
		$lock = $forUpdate ? ' FOR UPDATE' : '';
		$unchangedParent = $activity && (string)$activity['fk_partner']===(string)$input['partner_id'] && (string)$activity['fk_project']===(string)$input['project_id'];
		$res=$this->db->query('SELECT rowid,status FROM '.$this->db->prefix().'societe WHERE entity='.$this->entity.' AND rowid='.(int)$input['partner_id'].$lock);$partner=$res?$this->db->fetch_object($res):null;if(!$partner||(!$unchangedParent&&(int)$partner->status!==1))return false;
		$res=$this->db->query('SELECT rowid,fk_soc,fk_statut FROM '.$this->db->prefix().'projet WHERE entity='.$this->entity.' AND rowid='.(int)$input['project_id'].$lock);$project=$res?$this->db->fetch_object($res):null;if(!$project||(string)$project->fk_soc!==(string)$input['partner_id']||(!$unchangedParent&&(int)$project->fk_statut!==1))return false;
		$typeIds = array(); foreach ($input['operations'] as $op) $typeIds[] = (int) $op['type_id']; $typeIds = array_values(array_unique($typeIds)); sort($typeIds, SORT_NUMERIC);
		if (!$typeIds) return true;
		$allowedInactive=array(); foreach($currentOps as $op)$allowedInactive[(string)$op['rowid']]=(string)$op['fk_operation_type'];
		$res = $this->db->query('SELECT rowid,is_active FROM '.$this->table('operation_type').' WHERE entity='.$this->entity.' AND rowid IN ('.implode(',', $typeIds).') ORDER BY rowid'.$lock);
		if(!$res||$this->db->num_rows($res)!==count($typeIds))return false;$states=array();while($row=$this->db->fetch_object($res))$states[(string)$row->rowid]=(int)$row->is_active;
		foreach($input['operations'] as $op)if(empty($states[(string)$op['type_id']])&&(!isset($op['id'])||!isset($allowedInactive[(string)$op['id']])||$allowedInactive[(string)$op['id']]!==(string)$op['type_id']))return false;
		return true;
	}

	private function allocateReference()
	{
		$table = $this->table('activity_reference_sequence');
		if (!$this->db->query('INSERT IGNORE INTO '.$table.' (entity,next_value,date_creation) VALUES ('.$this->entity.',1,NOW())')) return false;
		$res = $this->db->query('SELECT next_value FROM '.$table.' WHERE entity='.$this->entity.' FOR UPDATE'); $row = $res ? $this->db->fetch_object($res) : null;
		if (!$row || !$this->decimalAmount((string) $row->next_value, false) || !$this->db->query('UPDATE '.$table.' SET next_value=next_value+1 WHERE entity='.$this->entity)) return false;
		return 'ACT-'.str_pad((string) $row->next_value, 6, '0', STR_PAD_LEFT);
	}

	private function writeOperations(array $activity, array $submitted, $actorId)
	{
		$current = $this->lockOperations($activity['rowid']); if ($current === false) return false;
		$byId = array(); foreach ($current as $row) $byId[(string) $row['rowid']] = $row; $seen = array();
		foreach ($submitted as $op) {
			$id = isset($op['id']) ? (string) $op['id'] : '';
			if ($id === '') {
				$sql = 'INSERT INTO '.$this->table('operation').' (entity,fk_activity,fk_operation_type,name,authorized_amount,status,spent_amount,observation,version,date_creation,fk_user_creat,fk_user_modif) VALUES ('.$this->entity.','.(int) $activity['rowid'].','.(int) $op['type_id'].",'".$this->db->escape($this->normalized($op['name']))."',".$op['authorized_amount'].",'TODO',NULL,NULL,1,NOW(),".(int) $actorId.','.(int) $actorId.')';
				if (!$this->db->query($sql)) return false;
			} else {
				if (!isset($byId[$id]) || isset($seen[$id]) || !isset($op['expected_version']) || (string) $byId[$id]['version'] !== (string) $op['expected_version']) return false; $seen[$id] = true;
				$res = $this->db->query('UPDATE '.$this->table('operation').' SET fk_operation_type='.(int) $op['type_id'].",name='".$this->db->escape($this->normalized($op['name']))."',authorized_amount=".$op['authorized_amount'].',version=version+1,fk_user_modif='.(int) $actorId.' WHERE entity='.$this->entity.' AND rowid='.(int) $id.' AND version='.(int) $op['expected_version'].' AND date_removed IS NULL');
				if (!$res || $this->db->affected_rows($res) !== 1) return false;
			}
		}
		foreach ($byId as $id => $row) if (!isset($seen[$id])) {
			if (!empty($activity['fk_current_revision'])) return false;
			$res = $this->db->query('UPDATE '.$this->table('operation').' SET date_removed=NOW(),fk_user_removed='.(int) $actorId.',version=version+1,fk_user_modif='.(int) $actorId.' WHERE rowid='.(int) $id.' AND entity='.$this->entity.' AND date_removed IS NULL');
			if (!$res) return false;
		}
		return true;
	}

	private function lockOperations($activityId)
	{
		$res = $this->db->query('SELECT o.*,t.label AS type_label FROM '.$this->table('operation').' o INNER JOIN '.$this->table('operation_type').' t ON t.rowid=o.fk_operation_type AND t.entity=o.entity WHERE o.entity='.$this->entity.' AND o.fk_activity='.(int) $activityId.' AND o.date_removed IS NULL ORDER BY o.rowid FOR UPDATE');
		if (!$res) return false; $rows = array(); while ($row = $this->db->fetch_object($res)) $rows[] = (array) $row; return $rows;
	}

	private function lockAssignments($activityId)
	{
		$res=$this->db->query('SELECT * FROM '.$this->table('activity_assignment').' WHERE entity='.$this->entity.' AND fk_activity='.(int)$activityId.' AND date_end IS NULL ORDER BY fk_user,rowid FOR UPDATE');
		if(!$res)return false;$rows=array();while($row=$this->db->fetch_object($res))$rows[]=(array)$row;return $rows;
	}

	private function containsAssignment(array $assignments,$userId)
	{
		foreach($assignments as$assignment)if((string)$assignment['fk_user']===(string)$userId)return true;return false;
	}

	private function updateActivityStructure(array $a, array $input, $actorId, $newVersion)
	{
		$sql = 'UPDATE '.$this->table('activity').' SET fk_partner='.(int) $input['partner_id'].',fk_project='.(int) $input['project_id'].",name='".$this->db->escape($this->normalized($input['name']))."',description='".$this->db->escape($this->normalized($input['description']))."',date_start='".$input['date_start']."',date_end='".$input['date_end']."',draft_authorized_amount=".$input['authorized_amount'].',version='.(int) $newVersion.',fk_user_modif='.(int) $actorId.' WHERE entity='.$this->entity.' AND rowid='.(int) $a['rowid'].' AND version='.(int) $a['version'];
		$res = $this->db->query($sql); return $res && $this->db->affected_rows($res) === 1;
	}

	private function snapshot(array $a, array $ops, array $submitter, array $contributors)
	{
		$parentRes=$this->db->query('SELECT s.nom AS partner_label,p.ref AS project_ref,p.title AS project_label FROM '.$this->db->prefix().'societe s INNER JOIN '.$this->db->prefix().'projet p ON p.rowid='.(int)$a['fk_project'].' AND p.entity=s.entity AND p.fk_soc=s.rowid WHERE s.entity='.$this->entity.' AND s.rowid='.(int)$a['fk_partner'].' FOR UPDATE');$parents=$parentRes?$this->db->fetch_object($parentRes):null;if(!$parents)return false;
		$assignments = array(); $res = $this->db->query('SELECT aa.fk_user,aa.is_primary,u.login,u.firstname,u.lastname,r.role_code FROM '.$this->table('activity_assignment').' aa INNER JOIN '.$this->db->prefix().'user u ON u.rowid=aa.fk_user LEFT JOIN '.$this->table('user_role').' r ON r.entity=aa.entity AND r.fk_user=aa.fk_user AND r.is_active=1 WHERE aa.entity='.$this->entity.' AND aa.fk_activity='.(int) $a['rowid'].' AND aa.date_end IS NULL ORDER BY aa.fk_user FOR UPDATE'); if (!$res) return false;
		while ($row = $this->db->fetch_object($res)) {$name=trim(trim($row->firstname).' '.trim($row->lastname));if($name==='')$name=$row->login;$assignments[] = array('user_id' => (string) $row->fk_user, 'name'=>$this->normalized($name),'role'=>(string)$row->role_code,'primary' => (string) $row->is_primary);}
		$operationRows = array(); foreach ($ops as $op) $operationRows[] = array('id'=>(string)$op['rowid'],'type_id'=>(string)$op['fk_operation_type'],'type_label'=>$this->normalized($op['type_label']),'name'=>$this->normalized($op['name']),'authorized_amount'=>(string)$op['authorized_amount']);
		$contributorRows=$this->loadContributorProfiles($contributors);if($contributorRows===false)return false;
		$snapshot = array('schema_version'=>'1','activity'=>array('id'=>(string)$a['rowid'],'reference'=>$a['ref'],'partner_id'=>(string)$a['fk_partner'],'partner_label'=>$this->normalized($parents->partner_label),'project_id'=>(string)$a['fk_project'],'project_reference'=>$this->normalized($parents->project_ref),'project_label'=>$this->normalized($parents->project_label),'name'=>$this->normalized($a['name']),'description'=>$this->normalized($a['description']),'date_start'=>$a['date_start'],'date_end'=>$a['date_end'],'authorized_amount'=>(string)$a['draft_authorized_amount']),'operations'=>$operationRows,'assignments'=>$assignments,'submitter'=>array('user_id'=>(string)$submitter['id'],'name'=>$this->normalized($submitter['name']),'role'=>$submitter['role']),'contributors'=>$contributorRows);
		$json = json_encode($snapshot, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); return $json !== false && json_last_error() === JSON_ERROR_NONE ? $json : false;
	}

	private function structuralJson(array $a, array $ops)
	{
		$rows = array(); foreach ($ops as $op) $rows[] = array('id'=>(string)$op['rowid'],'type_id'=>(string)$op['fk_operation_type'],'name'=>$this->normalized($op['name']),'authorized_amount'=>(string)$op['authorized_amount']);
		return json_encode(array('partner_id'=>(string)$a['fk_partner'],'project_id'=>(string)$a['fk_project'],'name'=>$this->normalized($a['name']),'description'=>$this->normalized($a['description']),'date_start'=>$a['date_start'],'date_end'=>$a['date_end'],'authorized_amount'=>(string)$a['draft_authorized_amount'],'operations'=>$rows), JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
	}

	private function insertRevision(array $a, $number, $activityVersion, $snapshot, $structuralHash, array $auth)
	{
		$sql = 'INSERT INTO '.$this->table('activity_revision').' (entity,fk_activity,revision_number,activity_version,schema_version,snapshot_json,structural_hash,integrity_hash,proposed_amount,fk_submitter,submitter_name_snapshot,submitter_role_snapshot,date_submitted) VALUES ('.$this->entity.','.(int)$a['rowid'].','.(int)$number.','.(int)$activityVersion.",1,'".$this->db->escape($snapshot)."','".$structuralHash."','".hash('sha256',$snapshot)."',".$a['draft_authorized_amount'].','.$auth['id'].",'".$this->db->escape($auth['name'])."','".$auth['role']."',NOW())";
		return $this->db->query($sql) ? (int) $this->db->last_insert_id($this->table('activity_revision')) : 0;
	}

	private function contributorIds(array $a, $number, $submitterId)
	{
		$ids = array((int)$a['fk_user_creat'],(int)$submitterId);
		$res = $this->db->query('SELECT DISTINCT c.fk_user FROM '.$this->table('revision_contributor').' c INNER JOIN '.$this->table('activity_revision').' r ON r.rowid=c.fk_revision AND r.entity=c.entity WHERE c.entity='.$this->entity.' AND c.fk_activity='.(int)$a['rowid'].' FOR UPDATE'); if ($res) while ($row=$this->db->fetch_object($res)) $ids[]=(int)$row->fk_user;
		$res = $this->db->query('SELECT DISTINCT actor_id FROM '.$this->table('audit_event')." WHERE entity=".$this->entity." AND activity_id=".(int)$a['rowid']." AND action='ACTIVITY_STRUCTURE_SAVED' AND actor_id IS NOT NULL FOR UPDATE"); if ($res) while ($row=$this->db->fetch_object($res)) $ids[]=(int)$row->actor_id;
		$ids=array_values(array_unique($ids)); sort($ids,SORT_NUMERIC); return $ids;
	}

	private function insertContributors(array $a, $revisionId, array $ids)
	{
		$profiles=$this->loadContributorProfiles($ids);if($profiles===false)return false;
		foreach ($profiles as $profile) {
			if(!$this->db->query('INSERT INTO '.$this->table('revision_contributor').' (entity,fk_activity,fk_revision,fk_user,user_name_snapshot,role_snapshot,date_creation) VALUES ('.$this->entity.','.(int)$a['rowid'].','.(int)$revisionId.','.(int)$profile['user_id'].",'".$this->db->escape($profile['name'])."','".$this->db->escape($profile['role'])."',NOW())"))return false;
		} return true;
	}

	private function loadContributorProfiles(array $ids)
	{
		sort($ids,SORT_NUMERIC);$key=implode(',',$ids);if(isset($this->contributorProfiles[$key]))return $this->contributorProfiles[$key];if(!$ids)return array();
		$res=$this->db->query('SELECT u.rowid,u.login,u.firstname,u.lastname,r.role_code FROM '.$this->db->prefix().'user u LEFT JOIN '.$this->table('user_role').' r ON r.entity='.$this->entity.' AND r.fk_user=u.rowid AND r.is_active=1 WHERE u.rowid IN ('.implode(',',$ids).') ORDER BY u.rowid FOR UPDATE');if(!$res)return false;$profiles=array();while($row=$this->db->fetch_object($res)){$name=trim(trim($row->firstname).' '.trim($row->lastname));if($name==='')$name=$row->login;$profiles[]=array('user_id'=>(string)$row->rowid,'name'=>$this->normalized($name),'role'=>(string)($row->role_code?:'ROLE_HISTORIQUE'));}if(count($profiles)!==count($ids))return false;$this->contributorProfiles[$key]=$profiles;return $profiles;
	}

	private function verifyRevision(array $revision)
	{
		if (!hash_equals($revision['integrity_hash'], hash('sha256', $revision['snapshot_json']))) return false;
		$data=json_decode($revision['snapshot_json'],true); if(!is_array($data)||json_last_error()!==JSON_ERROR_NONE)return false;
		$expected=array(); foreach((array)($data['contributors']??array()) as $c)$expected[]=array('user_id'=>(string)($c['user_id']??''),'name'=>(string)($c['name']??''),'role'=>(string)($c['role']??''));
		$actual=array(); $res=$this->db->query('SELECT fk_user,user_name_snapshot,role_snapshot FROM '.$this->table('revision_contributor').' WHERE entity='.$this->entity.' AND fk_revision='.(int)$revision['rowid'].' ORDER BY fk_user FOR UPDATE'); if(!$res)return false; while($row=$this->db->fetch_object($res))$actual[]=array('user_id'=>(string)$row->fk_user,'name'=>(string)$row->user_name_snapshot,'role'=>(string)$row->role_snapshot);
		return $expected===$actual;
	}

	private function insertDecision(array $a,array $r,array $auth,$stage,$decision,$reason,$requested,$prevalidation)
	{
		$sql='INSERT INTO '.$this->table('review_decision').' (entity,fk_activity,fk_revision,stage,decision_type,fk_actor,actor_name_snapshot,actor_role_snapshot,reason,requested_amount,fk_prevalidation_decision,state_before,state_after,date_decision) VALUES ('.$this->entity.','.(int)$a['rowid'].','.(int)$r['rowid'].",'$stage','$decision',".$auth['id'].",'".$this->db->escape($auth['name'])."','".$auth['role']."',".$this->nullableText($reason).','.($requested===null?'NULL':(string)$requested).','.($prevalidation===null?'NULL':(int)$prevalidation).",'".$this->db->escape($a['validation_status'])."','$decision',NOW())";
		return $this->db->query($sql)?(int)$this->db->last_insert_id($this->table('review_decision')):0;
	}

	private function validStructure(array $input, $requireOperation)
	{
		$keys=array('partner_id','project_id','name','description','date_start','date_end','authorized_amount','operations'); if(array_keys($input)!==$keys)return false;
		if(!$this->decimalId($input['partner_id'])||!$this->decimalId($input['project_id'])||!$this->text($input['name'],255,true)||!$this->text($input['description'],4000,true)||!$this->date($input['date_start'])||!$this->date($input['date_end'])||$input['date_end']<$input['date_start']||!$this->decimalAmount($input['authorized_amount'],false)||!is_array($input['operations'])||count($input['operations'])>50||($requireOperation&&!count($input['operations'])))return false;
		$keysSeen=array(); foreach($input['operations'] as $op){if(!is_array($op))return false;$allowed=isset($op['id'])?array('id','expected_version','client_key','name','type_id','authorized_amount'):array('client_key','name','type_id','authorized_amount');if(array_keys($op)!==$allowed||!$this->text($op['client_key'],64,true)||isset($keysSeen[$op['client_key']])||!$this->text($op['name'],255,true)||!$this->decimalId($op['type_id'])||!$this->decimalAmount($op['authorized_amount'],false))return false;if(isset($op['id'])&&(!$this->decimalId($op['id'])||!$this->decimalId($op['expected_version'])))return false;$keysSeen[$op['client_key']]=true;} return true;
	}

	private function decimalId($v){return is_string($v)&&preg_match('/^[1-9][0-9]*$/',$v)===1&&strlen($v)<=19&&(strlen($v)<19||strcmp($v,'9223372036854775807')<=0);}
	private function decimalAmount($v,$zero=true){return is_string($v)&&preg_match($zero?'/^(0|[1-9][0-9]*)$/':'/^[1-9][0-9]*$/',$v)===1&&strlen($v)<=19&&(strlen($v)<19||strcmp($v,'9223372036854775807')<=0);}
	private function text($v,$max,$required){return is_string($v)&&preg_match('//u',$v)===1&&!preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/',$v)&&mb_strlen($v,'UTF-8')<=$max&&(!$required||trim($v)!=='');}
	private function normalized($v){return class_exists('Normalizer')?Normalizer::normalize($v,Normalizer::FORM_C):$v;}
	private function date($v){if(!is_string($v)||preg_match('/^\d{4}-\d{2}-\d{2}$/',$v)!==1)return false;$d=DateTimeImmutable::createFromFormat('!Y-m-d',$v,new DateTimeZone('Africa/Porto-Novo'));return $d&&$d->format('Y-m-d')===$v;}
	private function future($date){$calendar=$this->calendar;return (string)$calendar()<(string)$date;}
	private function balanced(array $a,array $ops){if(!count($ops)||!$this->decimalAmount((string)$a['draft_authorized_amount'],false))return false;$sum='0';foreach($ops as $op){if(!$this->decimalAmount((string)$op['authorized_amount'],false))return false;$sum=$this->decimalAdd($sum,(string)$op['authorized_amount']);if($sum===false)return false;}return $sum===(string)$a['draft_authorized_amount'];}
	private function decimalAdd($a,$b){$carry=0;$out='';$i=strlen($a)-1;$j=strlen($b)-1;while($i>=0||$j>=0||$carry){$n=($i>=0?(int)$a[$i--]:0)+($j>=0?(int)$b[$j--]:0)+$carry;$out=($n%10).$out;$carry=intdiv($n,10);}return strlen($out)>19||(strlen($out)===19&&strcmp($out,'9223372036854775807')>0)?false:$out;}
	private function table($suffix){return $this->db->prefix().'mjlfinancement_'.$suffix;}
	private function isAssigned($activity,$user){return (int)mjl_rst005_scalar($this->db,'SELECT COUNT(*) FROM '.$this->table('activity_assignment').' WHERE entity='.$this->entity.' AND fk_activity='.(int)$activity.' AND fk_user='.(int)$user.' AND date_end IS NULL')===1;}
	private function currentAssignmentCount($activity){return (int)mjl_rst005_scalar($this->db,'SELECT COUNT(*) FROM '.$this->table('activity_assignment').' WHERE entity='.$this->entity.' AND fk_activity='.(int)$activity.' AND date_end IS NULL');}
	private function eligibleAgent($id){return (int)mjl_rst005_scalar($this->db,'SELECT COUNT(*) FROM '.$this->db->prefix().'user u INNER JOIN '.$this->table('user_role')." r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code='AGENT_SAISIE' WHERE u.rowid=".(int)$id.' AND u.entity='.$this->entity.' AND u.statut=1 AND u.admin=0')===1;}
	private function insertAssignment($activity,$agent,$primary,$actor,$reason){return (bool)$this->db->query('INSERT INTO '.$this->table('activity_assignment').' (entity,fk_activity,fk_user,is_primary,date_start,date_end,fk_user_assign,reason,date_creation) VALUES ('.$this->entity.','.(int)$activity.','.(int)$agent.','.($primary?1:0).',NOW(),NULL,'.(int)$actor.",'".$this->db->escape($reason)."',NOW())");}
	private function endAllAssignments($activity){return (bool)$this->db->query('UPDATE '.$this->table('activity_assignment').' SET date_end=NOW() WHERE entity='.$this->entity.' AND fk_activity='.(int)$activity.' AND date_end IS NULL');}
	private function nextRevisionNumber($activity){return 1+(int)mjl_rst005_scalar($this->db,'SELECT COALESCE(MAX(revision_number),0) FROM '.$this->table('activity_revision').' WHERE entity='.$this->entity.' AND fk_activity='.(int)$activity.' FOR UPDATE');}
	private function currentRevision(array $a){if(empty($a['fk_current_revision']))return array();return $this->lockRevision($a['rowid'],$a['fk_current_revision']);}
	private function lockRevision($activity,$revision){$res=$this->db->query('SELECT * FROM '.$this->table('activity_revision').' WHERE entity='.$this->entity.' AND fk_activity='.(int)$activity.' AND rowid='.(int)$revision.' FOR UPDATE');$row=$res?$this->db->fetch_object($res):null;return $row?(array)$row:array();}
	private function isContributor($revision,$user){return (int)mjl_rst005_scalar($this->db,'SELECT COUNT(*) FROM '.$this->table('revision_contributor').' WHERE entity='.$this->entity.' AND fk_revision='.(int)$revision.' AND fk_user='.(int)$user)===1;}
	private function prevalidation($revision){$res=$this->db->query('SELECT rowid,fk_actor FROM '.$this->table('review_decision')." WHERE entity=".$this->entity.' AND fk_revision='.(int)$revision." AND stage='SUPERVISOR' AND decision_type='PREVALIDATED' FOR UPDATE");$row=$res?$this->db->fetch_object($res):null;return $row?(array)$row:array();}
	private function validatorReturnAllowsAmount(array $prior,$amount){$res=$this->db->query('SELECT requested_amount FROM '.$this->table('review_decision')." WHERE entity=".$this->entity.' AND fk_revision='.(int)$prior['rowid']." AND decision_type='RETURNED_VALIDATOR' FOR UPDATE");$row=$res?$this->db->fetch_object($res):null;return $row&&($row->requested_amount!==null||(string)$prior['proposed_amount']===(string)$amount);}
	private function simpleActivityUpdate(array $a,$version,$actor,$set){$res=$this->db->query('UPDATE '.$this->table('activity').' SET '.$set.',version='.(int)$version.',fk_user_modif='.(int)$actor.' WHERE entity='.$this->entity.' AND rowid='.(int)$a['rowid'].' AND version='.(int)$a['version']);return $res&&$this->db->affected_rows($res)===1;}
	private function audit(array $a,User $actor,$action,$before,$after,array $context=array(),$reason=''){return mjl_audit_append_in_transaction($this->db,array('entity'=>$this->entity,'object_type'=>'activity','object_id'=>(int)$a['rowid'],'object_ref'=>$a['ref'],'activity_id'=>(int)$a['rowid'],'actor'=>$actor,'action'=>$action,'state_before'=>$before,'state_after'=>$after,'reason'=>$reason?:null,'target_version'=>(int)$a['version'],'result'=>'SUCCESS','context'=>$context))>0;}
	private function nullableText($v){return $v===''?'NULL':"'".$this->db->escape($v)."'";}
	private function reject($code){$r=$this->outcome($code);$r['_rollback']=true;return $r;}
	private function accept($id,$version,$revision=null){return array('code'=>'OK','activity_id'=>(int)$id,'version'=>(int)$version,'revision_id'=>$revision===null?null:(int)$revision);}
	private function outcome($code){return array('code'=>in_array($code,self::OUTCOMES,true)?$code:'FAILED','activity_id'=>null,'version'=>null,'revision_id'=>null);}
}
