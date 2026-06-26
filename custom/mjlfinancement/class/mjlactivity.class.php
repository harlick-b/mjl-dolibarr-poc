<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';

class MjlActivity extends CommonObject
{
	public $module = 'mjlfinancement';
	public $element = 'mjlactivity';
	public $TRIGGER_PREFIX = 'MJLFINANCEMENT_ACTIVITY';
	public $table_element = 'mjlfinancement_activity';
	public $picto = 'projecttask';
	public $isextrafieldmanaged = 0;
	public $ismultientitymanaged = 1;

	const STATUS_DRAFT = 0;
	const STATUS_ONGOING = 1;
	const STATUS_COMPLETED = 2;
	const STATUS_SUBMITTED = 3;
	const STATUS_CORRECTION_REQUESTED = 4;
	const STATUS_CORRECTED = 5;
	const STATUS_VALIDATED = 6;
	const STATUS_REJECTED = 8;
	const STATUS_CANCELLED = 9;

	public $fields = array(
		'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'enabled' => 1, 'position' => 1, 'notnull' => 1, 'visible' => 0, 'noteditable' => 1, 'index' => 1),
		'entity' => array('type' => 'integer', 'label' => 'Entity', 'enabled' => 1, 'position' => 5, 'notnull' => 1, 'visible' => 0, 'default' => '1', 'index' => 1),
		'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'enabled' => 1, 'position' => 20, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'searchall' => 1, 'showoncombobox' => 1, 'validate' => 1),
		'label' => array('type' => 'varchar(255)', 'label' => 'Label', 'enabled' => 1, 'position' => 30, 'notnull' => 1, 'visible' => 1, 'searchall' => 1, 'showoncombobox' => 2, 'validate' => 1),
		'fk_project' => array('type' => 'integer:Project:projet/class/project.class.php:1', 'label' => 'Project', 'picto' => 'project', 'enabled' => 'isModEnabled("project")', 'position' => 40, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_convention' => array('type' => 'integer:MjlConvention:mjlfinancement/class/mjlconvention.class.php:1', 'label' => 'MJLConvention', 'enabled' => 1, 'position' => 50, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_task' => array('type' => 'integer:Task:projet/class/task.class.php:1', 'label' => 'MJLProjectTask', 'picto' => 'projecttask', 'enabled' => 'isModEnabled("project")', 'position' => 60, 'notnull' => -1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'date_start' => array('type' => 'date', 'label' => 'DateStart', 'enabled' => 1, 'position' => 70, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'date_end' => array('type' => 'date', 'label' => 'DateEnd', 'enabled' => 1, 'position' => 80, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'note_public' => array('type' => 'html', 'label' => 'NotePublic', 'enabled' => 1, 'position' => 500, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'note_private' => array('type' => 'html', 'label' => 'NotePrivate', 'enabled' => 1, 'position' => 510, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'date_creation' => array('type' => 'datetime', 'label' => 'DateCreation', 'enabled' => 1, 'position' => 600, 'notnull' => 1, 'visible' => -2),
		'tms' => array('type' => 'timestamp', 'label' => 'DateModification', 'enabled' => 1, 'position' => 610, 'notnull' => 0, 'visible' => -2),
		'fk_user_creat' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserAuthor', 'enabled' => 1, 'position' => 620, 'notnull' => 1, 'visible' => -2),
		'fk_user_modif' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserModif', 'enabled' => 1, 'position' => 630, 'notnull' => -1, 'visible' => -2),
		'import_key' => array('type' => 'varchar(14)', 'label' => 'ImportId', 'enabled' => 1, 'position' => 1000, 'notnull' => -1, 'visible' => -2),
		'status' => array('type' => 'integer', 'label' => 'Status', 'enabled' => 1, 'position' => 2000, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'default' => '0', 'arrayofkeyval' => array(0 => 'MJLDraft', 1 => 'MJLOngoing', 2 => 'MJLCompleted', 3 => 'MJLSubmitted', 4 => 'MJLCorrectionRequested', 5 => 'MJLCorrected', 6 => 'MJLValidated', 8 => 'MJLRejected', 9 => 'MJLCancelled'), 'validate' => 1),
	);

	public $rowid;
	public $ref;
	public $label;
	public $fk_project;
	public $fk_convention;
	public $fk_task;
	public $date_start;
	public $date_end;
	public $status;
	public $note_public;
	public $note_private;
	public $fk_user_creat;
	public $fk_user_modif;
	public $import_key;

	public function __construct(DoliDB $db)
	{
		$this->db = $db;
		$this->filterDisabledFields();
	}

	public function create(User $user, $notrigger = 0)
	{
		$activeEntity = mjl_active_entity();
		if (empty($this->entity)) {
			$this->entity = $activeEntity;
		}
		if ((int) $this->entity !== $activeEntity) {
			$this->error = 'Activity entity does not match active entity';
			return -1;
		}
		if (!$this->assertLinks($activeEntity)) {
			return -1;
		}

		return $this->createCommon($user, $notrigger);
	}

	public function fetch($id, $ref = null, $noextrafields = 0, $nolines = 0)
	{
		return $this->fetchCommon($id, $ref, '', $noextrafields);
	}

	public function update(User $user, $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing activity id';
			return -1;
		}

		$current = $this->fetchCurrentForWorkflow($id);
		if (empty($current)) {
			return -1;
		}
		$currentStatus = (int) $current['status'];
		$incomingStatus = ($this->status === null || $this->status === '') ? $currentStatus : (int) $this->status;
		if ($incomingStatus !== $currentStatus) {
			$this->error = 'Activity status changes require an explicit workflow action';
			return -1;
		}
		if (empty($this->entity)) {
			$this->entity = $current['entity'];
		}
		if ((int) $this->entity !== (int) $current['entity']) {
			$this->error = 'Activity entity cannot be changed';
			return -1;
		}
		if (!$this->assertLinks($current['entity'])) {
			return -1;
		}

		return $this->updateCommon($user, $notrigger);
	}

	public function delete(User $user, $notrigger = 0)
	{
		return $this->deleteCommon($user, $notrigger);
	}

	public function updateImportantFields(User $user, $fields, $comment, $actorRole = 'AGENT', $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing activity id';
			return -1;
		}
		if (!$this->canDo($user, 'activity', 'write')) {
			$this->error = 'Permission denied for activity update';
			return -1;
		}
		$comment = trim((string) $comment);
		if ($comment === '') {
			$this->error = 'Update comment is required';
			return -1;
		}

		$this->db->begin();
		$current = $this->fetchCurrentForWorkflow($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if (!in_array((int) $current['status'], array(self::STATUS_DRAFT, self::STATUS_CORRECTION_REQUESTED), true)) {
			$this->error = 'Only draft or correction-requested activities can be edited through this action';
			$this->db->rollback();
			return -1;
		}

		$sets = array();
		$changes = array();
		if (array_key_exists('label', $fields)) {
			$value = trim((string) $fields['label']);
			if ($value !== '' && $value !== (string) $current['label']) {
				$sets[] = "label = '".$this->db->escape($value)."'";
				$changes['label'] = array('before' => (string) $current['label'], 'after' => $value);
				$this->label = $value;
			}
		}
		foreach (array('date_start', 'date_end') as $dateField) {
			if (array_key_exists($dateField, $fields)) {
				$value = $this->normalizeDateValue($fields[$dateField]);
				$currentValue = $this->normalizeDateValue($current[$dateField]);
				if ($value !== $currentValue) {
					$sets[] = $dateField.' = '.($value === null ? 'NULL' : "'".$this->db->escape($value)."'");
					$changes[$dateField] = array('before' => $currentValue, 'after' => $value);
					$this->{$dateField} = $value;
				}
			}
		}

		if (empty($changes)) {
			$this->db->commit();
			return 0;
		}

		$sets[] = 'fk_user_modif = '.((int) $user->id);
		$sql = 'UPDATE '.$this->db->prefix().$this->table_element.' SET '.implode(', ', $sets);
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel($current['status']), $user, $actorRole, dol_now(), 'field_changed', $comment, $changes) < 0) {
			$this->db->rollback();
			return -1;
		}
		if (empty($notrigger)) {
			$result = $this->call_trigger('MJLFINANCEMENT_ACTIVITY_FIELD_CHANGE', $user);
			if ($result < 0) {
				$this->db->rollback();
				return -1;
			}
		}

		$this->db->commit();
		return 1;
	}

	public function submit(User $user, $comment = '', $actorRole = 'AGENT', $notrigger = 0)
	{
		return $this->workflowTransition($user, array(self::STATUS_DRAFT, self::STATUS_CORRECTED), self::STATUS_SUBMITTED, 'submitted', $comment, $actorRole, array(
			'required_right' => array('activity', 'write'),
			'trigger' => 'MJLFINANCEMENT_ACTIVITY_SUBMIT',
			'idempotent' => true,
			'notrigger' => $notrigger,
		));
	}

	public function requestCorrection(User $user, $reason, $actorRole = 'SUPERVISEUR_N1', $notrigger = 0)
	{
		$reason = trim((string) $reason);
		if ($reason === '') {
			$this->error = 'Correction reason is required';
			return -1;
		}
		return $this->workflowTransition($user, array(self::STATUS_SUBMITTED), self::STATUS_CORRECTION_REQUESTED, 'correction_requested', $reason, $actorRole, array(
			'required_right' => array('activity', 'validate'),
			'no_self_review' => true,
			'trigger' => 'MJLFINANCEMENT_ACTIVITY_CORRECTION_REQUEST',
			'notrigger' => $notrigger,
		));
	}

	public function correct(User $user, $comment, $actorRole = 'AGENT', $notrigger = 0)
	{
		$comment = trim((string) $comment);
		if ($comment === '') {
			$this->error = 'Correction comment is required';
			return -1;
		}
		return $this->workflowTransition($user, array(self::STATUS_CORRECTION_REQUESTED), self::STATUS_CORRECTED, 'corrected', $comment, $actorRole, array(
			'required_right' => array('activity', 'write'),
			'trigger' => 'MJLFINANCEMENT_ACTIVITY_CORRECT',
			'notrigger' => $notrigger,
		));
	}

	public function validate(User $user, $comment = '', $actorRole = 'SUPERVISEUR_N1', $notrigger = 0)
	{
		return $this->workflowTransition($user, array(self::STATUS_SUBMITTED), self::STATUS_VALIDATED, 'validated', $comment, $actorRole, array(
			'required_right' => array('activity', 'validate'),
			'no_self_review' => true,
			'trigger' => 'MJLFINANCEMENT_ACTIVITY_VALIDATE',
			'idempotent' => true,
			'notrigger' => $notrigger,
		));
	}

	public function reject(User $user, $reason, $actorRole = 'SUPERVISEUR_N1', $notrigger = 0)
	{
		$reason = trim((string) $reason);
		if ($reason === '') {
			$this->error = 'Rejection reason is required';
			return -1;
		}
		return $this->workflowTransition($user, array(self::STATUS_SUBMITTED), self::STATUS_REJECTED, 'rejected', $reason, $actorRole, array(
			'required_right' => array('activity', 'validate'),
			'no_self_review' => true,
			'trigger' => 'MJLFINANCEMENT_ACTIVITY_REJECT',
			'notrigger' => $notrigger,
		));
	}

	private function workflowTransition(User $user, $fromStatuses, $toStatus, $action, $comment, $actorRole, $options)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing activity id';
			return -1;
		}
		if (!empty($options['required_right']) && !$this->canDo($user, $options['required_right'][0], $options['required_right'][1])) {
			$this->error = 'Permission denied for activity '.$action;
			return -1;
		}

		$actionDate = dol_now();
		$this->db->begin();
		$current = $this->fetchCurrentForWorkflow($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if (!empty($options['idempotent']) && (int) $current['status'] === (int) $toStatus) {
			$this->db->commit();
			return 0;
		}
		if (!in_array((int) $current['status'], array_map('intval', $fromStatuses), true)) {
			$this->error = 'Invalid activity workflow transition from '.$this->statusLabel($current['status']).' to '.$this->statusLabel($toStatus);
			$this->db->rollback();
			return -1;
		}
		if (!empty($options['no_self_review']) && (int) $current['fk_user_creat'] === (int) $user->id) {
			$this->error = 'A user cannot review their own activity';
			$this->db->rollback();
			return -1;
		}

		$sql = 'UPDATE '.$this->db->prefix().$this->table_element;
		$sql .= ' SET status = '.((int) $toStatus);
		$sql .= ', fk_user_modif = '.((int) $user->id);
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			$this->db->rollback();
			return -1;
		}

		$this->entity = $current['entity'];
		$this->fk_project = $current['fk_project'];
		$this->fk_convention = $current['fk_convention'];
		$this->fk_task = $current['fk_task'];
		$this->import_key = $current['import_key'];
		$this->status = $toStatus;

		if ($this->recordWorkflowAction($current, $toStatus, $user, $actorRole, $actionDate, $action, $comment) < 0) {
			$this->status = $current['status'];
			$this->db->rollback();
			return -1;
		}

		if (empty($options['notrigger']) && !empty($options['trigger'])) {
			$result = $this->call_trigger($options['trigger'], $user);
			if ($result < 0) {
				$this->status = $current['status'];
				$this->db->rollback();
				return -1;
			}
		}

		$this->db->commit();
		return 1;
	}

	private function recordWorkflowAction($current, $toStatus, User $user, $actorRole, $actionDate, $action, $comment)
	{
		$fromStatusLabel = $this->statusLabel($current['status']);
		$toStatusLabel = $this->statusLabel($toStatus);
		$changes = array(
			'status' => array(
				'before' => $fromStatusLabel,
				'after' => $toStatusLabel,
			),
		);
		return $this->insertWorkflowAction($current, $fromStatusLabel, $toStatusLabel, $user, $actorRole, $actionDate, $action, $comment, $changes);
	}

	private function insertWorkflowAction($current, $fromStatusLabel, $toStatusLabel, User $user, $actorRole, $actionDate, $action, $comment, $changes)
	{
		$id = (int) ($this->id ?: $this->rowid);
		$ref = 'WFA-ACT-'.$id.'-'.date('YmdHis', $actionDate).'-'.substr(str_replace('.', '', (string) microtime(true)), -6).'-'.((int) $user->id).'-'.strtoupper(substr(preg_replace('/[^a-z0-9]/i', '', $action), 0, 8));

		$sql = 'INSERT INTO '.$this->db->prefix().'mjlfinancement_workflow_action';
		$sql .= ' (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, reason, comment, changes_json, date_creation, fk_user_creat, import_key)';
		$sql .= ' VALUES (';
		$sql .= ((int) $current['entity']);
		$sql .= ", '".$this->db->escape($ref)."'";
		$sql .= ", 'mjlfinancement_activity'";
		$sql .= ', '.$id;
		$sql .= ", '".$this->db->escape($action)."'";
		$sql .= ", '".$this->db->escape($fromStatusLabel)."'";
		$sql .= ", '".$this->db->escape($toStatusLabel)."'";
		$sql .= ', '.((int) $user->id);
		$sql .= ", '".$this->db->escape((string) $actorRole)."'";
		$sql .= ", '".$this->db->idate($actionDate)."'";
		$sql .= ', '.mjl_integrity_sql_string($comment);
		$sql .= ', '.mjl_integrity_sql_string($comment);
		$sql .= ", '".$this->db->escape(json_encode($changes))."'";
		$sql .= ", '".$this->db->idate(dol_now())."'";
		$sql .= ', '.((int) $user->id);
		$sql .= ', '.mjl_integrity_sql_string($current['import_key']);
		$sql .= ')';

		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			return -1;
		}

		return (int) $this->db->last_insert_id($this->db->prefix().'mjlfinancement_workflow_action');
	}

	private function canDo(User $user, $perms, $subperms)
	{
		return mjl_user_has_right($user, 'mjlfinancement', $perms, $subperms);
	}

	private function assertLinks($entity)
	{
		$projectId = (int) $this->fk_project;
		$conventionId = (int) $this->fk_convention;
		if ($projectId <= 0 || $conventionId <= 0) {
			$this->error = 'Project and convention are required';
			return false;
		}

		$project = mjl_integrity_fetch_row('SELECT rowid FROM '.$this->db->prefix().'projet WHERE rowid = '.$projectId.' AND entity = '.((int) $entity));
		if (empty($project)) {
			$this->error = 'Project not found in active entity';
			return false;
		}
		$convention = mjl_integrity_fetch_row('SELECT rowid, fk_project FROM '.$this->db->prefix().'mjlfinancement_convention WHERE rowid = '.$conventionId.' AND entity = '.((int) $entity));
		if (empty($convention)) {
			$this->error = 'Convention not found in active entity';
			return false;
		}
		if (!empty($convention['fk_project']) && (int) $convention['fk_project'] !== $projectId) {
			$this->error = 'Convention does not belong to selected project';
			return false;
		}
		if ((int) $this->fk_task > 0) {
			$task = mjl_integrity_fetch_row('SELECT rowid, fk_projet FROM '.$this->db->prefix().'projet_task WHERE rowid = '.((int) $this->fk_task).' AND entity = '.((int) $entity));
			if (empty($task)) {
				$this->error = 'Project task not found in active entity';
				return false;
			}
			if ((int) $task['fk_projet'] !== $projectId) {
				$this->error = 'Project task does not belong to selected project';
				return false;
			}
		}

		return true;
	}

	private function fetchCurrentForWorkflow($id, $forUpdate = false)
	{
		$entity = mjl_active_entity();
		$sql = 'SELECT rowid, entity, ref, label, fk_project, fk_convention, fk_task, date_start, date_end, status, fk_user_creat, import_key';
		$sql .= ' FROM '.$this->db->prefix().$this->table_element;
		$sql .= ' WHERE rowid = '.((int) $id).' AND entity = '.$entity;
		if ($forUpdate) {
			$sql .= ' FOR UPDATE';
		}

		$resql = $this->db->query($sql);
		if (!$resql) {
			$this->error = $this->db->lasterror();
			return array();
		}
		$obj = $this->db->fetch_object($resql);
		if (!$obj) {
			$this->error = 'Activity not found';
			return array();
		}

		return array(
			'rowid' => (int) $obj->rowid,
			'entity' => (int) $obj->entity,
			'ref' => (string) $obj->ref,
			'label' => (string) $obj->label,
			'fk_project' => (int) $obj->fk_project,
			'fk_convention' => (int) $obj->fk_convention,
			'fk_task' => (int) $obj->fk_task,
			'date_start' => $obj->date_start,
			'date_end' => $obj->date_end,
			'status' => (int) $obj->status,
			'fk_user_creat' => (int) $obj->fk_user_creat,
			'import_key' => $obj->import_key,
		);
	}

	private function statusLabel($status)
	{
		$map = array(
			self::STATUS_DRAFT => 'draft',
			self::STATUS_ONGOING => 'ongoing',
			self::STATUS_COMPLETED => 'completed',
			self::STATUS_SUBMITTED => 'submitted',
			self::STATUS_CORRECTION_REQUESTED => 'correction_requested',
			self::STATUS_CORRECTED => 'corrected',
			self::STATUS_VALIDATED => 'validated',
			self::STATUS_REJECTED => 'rejected',
			self::STATUS_CANCELLED => 'cancelled',
		);
		$status = (int) $status;
		return isset($map[$status]) ? $map[$status] : (string) $status;
	}

	private function normalizeDateValue($value)
	{
		if ($value === null || $value === '') {
			return null;
		}
		if (is_numeric($value)) {
			return date('Y-m-d', (int) $value);
		}
		$timestamp = strtotime((string) $value);
		return $timestamp > 0 ? date('Y-m-d', $timestamp) : null;
	}

	private function filterDisabledFields()
	{
		foreach ($this->fields as $key => $val) {
			if (isset($val['enabled']) && empty($val['enabled'])) {
				unset($this->fields[$key]);
			}
		}
	}
}
