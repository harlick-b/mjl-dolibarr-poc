<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

class MjlConvention extends CommonObject
{
	public $module = 'mjlfinancement';
	public $element = 'mjlconvention';
	public $TRIGGER_PREFIX = 'MJLFINANCEMENT_CONVENTION';
	public $table_element = 'mjlfinancement_convention';
	public $picto = 'contract';
	public $isextrafieldmanaged = 0;
	public $ismultientitymanaged = 1;

	const STATUS_DRAFT = 0;
	const STATUS_ACTIVE = 1;
	const STATUS_CLOSED = 2;

	public $fields = array(
		'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'enabled' => 1, 'position' => 1, 'notnull' => 1, 'visible' => 0, 'noteditable' => 1, 'index' => 1),
		'entity' => array('type' => 'integer', 'label' => 'Entity', 'enabled' => 1, 'position' => 5, 'notnull' => 1, 'visible' => 0, 'default' => '1', 'index' => 1),
		'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'enabled' => 1, 'position' => 20, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'searchall' => 1, 'showoncombobox' => 1, 'validate' => 1),
		'title' => array('type' => 'varchar(255)', 'label' => 'MJLTitle', 'enabled' => 1, 'position' => 30, 'notnull' => 1, 'visible' => 1, 'searchall' => 1, 'showoncombobox' => 2, 'validate' => 1),
		'fk_soc' => array('type' => 'integer:Societe:societe/class/societe.class.php:1:((status:=:1) AND (entity:IN:__SHARED_ENTITIES__))', 'label' => 'MJLPTFBailleur', 'picto' => 'company', 'enabled' => 'isModEnabled("societe")', 'position' => 40, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_project' => array('type' => 'integer:Project:projet/class/project.class.php:1', 'label' => 'Project', 'picto' => 'project', 'enabled' => 'isModEnabled("project")', 'position' => 50, 'notnull' => -1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'date_start' => array('type' => 'date', 'label' => 'DateStart', 'enabled' => 1, 'position' => 60, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'date_end' => array('type' => 'date', 'label' => 'DateEnd', 'enabled' => 1, 'position' => 70, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'total_amount' => array('type' => 'price', 'label' => 'MJLTotalAmount', 'enabled' => 1, 'position' => 80, 'notnull' => 0, 'visible' => 1, 'isameasure' => 1, 'validate' => 1),
		'currency_code' => array('type' => 'varchar(3)', 'label' => 'Currency', 'enabled' => 1, 'position' => 90, 'notnull' => 1, 'visible' => 1, 'default' => 'XOF', 'validate' => 1),
		'note_public' => array('type' => 'html', 'label' => 'NotePublic', 'enabled' => 1, 'position' => 500, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'note_private' => array('type' => 'html', 'label' => 'NotePrivate', 'enabled' => 1, 'position' => 510, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'date_creation' => array('type' => 'datetime', 'label' => 'DateCreation', 'enabled' => 1, 'position' => 600, 'notnull' => 1, 'visible' => -2),
		'tms' => array('type' => 'timestamp', 'label' => 'DateModification', 'enabled' => 1, 'position' => 610, 'notnull' => 0, 'visible' => -2),
		'fk_user_creat' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserAuthor', 'enabled' => 1, 'position' => 620, 'notnull' => 1, 'visible' => -2),
		'fk_user_modif' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserModif', 'enabled' => 1, 'position' => 630, 'notnull' => -1, 'visible' => -2),
		'import_key' => array('type' => 'varchar(14)', 'label' => 'ImportId', 'enabled' => 1, 'position' => 1000, 'notnull' => -1, 'visible' => -2),
		'status' => array('type' => 'integer', 'label' => 'Status', 'enabled' => 1, 'position' => 2000, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'default' => '0', 'arrayofkeyval' => array(0 => 'Draft', 1 => 'Active', 2 => 'Closed'), 'validate' => 1),
	);

	public $rowid;
	public $ref;
	public $title;
	public $fk_soc;
	public $socid;
	public $fk_project;
	public $date_start;
	public $date_end;
	public $total_amount;
	public $currency_code;
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
		if (!$this->canManage($user)) {
			$this->error = 'Permission denied for convention creation';
			return -1;
		}
		if (empty($this->entity)) {
			$this->entity = $activeEntity;
		}
		if ((int) $this->entity !== $activeEntity) {
			$this->error = 'Convention entity does not match active entity';
			return -1;
		}
		$this->status = self::STATUS_DRAFT;
		if (!$this->validateRequiredFields()) {
			return -1;
		}

		$this->db->begin();
		$result = $this->createCommon($user, $notrigger);
		if ($result <= 0) {
			$this->db->rollback();
			return $result;
		}
		$this->id = $result;
		$this->rowid = $result;
		if ($this->insertWorkflowAction(array(
			'rowid' => $result,
			'entity' => (int) $this->entity,
			'status' => self::STATUS_DRAFT,
			'import_key' => $this->import_key,
		), null, $this->statusLabel(self::STATUS_DRAFT), $user, 'created', 'Convention creee', array(
			'status' => array('before' => null, 'after' => $this->statusLabel(self::STATUS_DRAFT)),
		)) < 0) {
			$this->db->rollback();
			return -1;
		}
		$this->db->commit();
		return $result;
	}

	public function fetch($id, $ref = null, $noextrafields = 0, $nolines = 0)
	{
		return $this->fetchCommon($id, $ref, '', $noextrafields);
	}

	public function update(User $user, $notrigger = 0)
	{
		return $this->updateGovernedFields($user, array(
			'ref' => $this->ref,
			'title' => $this->title,
			'fk_soc' => $this->fk_soc,
			'fk_project' => $this->fk_project,
			'date_start' => $this->date_start,
			'date_end' => $this->date_end,
			'total_amount' => $this->total_amount,
			'currency_code' => $this->currency_code,
			'note_public' => $this->note_public,
			'note_private' => $this->note_private,
		), 'Mise a jour convention', $notrigger);
	}

	public function delete(User $user, $notrigger = 0)
	{
		return $this->deleteIfUnlinkedDraft($user, $notrigger);
	}

	public function updateGovernedFields(User $user, $fields, $comment = '', $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing convention id';
			return -1;
		}
		if (!$this->canManage($user)) {
			$this->error = 'Permission denied for convention update';
			return -1;
		}

		$this->db->begin();
		$current = $this->fetchCurrentForGovernance($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}

		$normalized = $this->normalizeGovernedFields($fields, $current);
		if ($normalized === false) {
			$this->db->rollback();
			return -1;
		}

		$changes = array();
		$sets = array();
		$linked = $this->hasLinkedRecordsFromCurrent($current);
		$locked = $linked ? $this->lockedFieldsAfterLinks() : array();
		$blocked = array();
		foreach ($normalized as $field => $value) {
			$currentValue = array_key_exists($field, $current) ? $current[$field] : null;
			if ($this->valuesEqual($field, $currentValue, $value)) {
				continue;
			}
			if (in_array($field, $locked, true)) {
				$blocked[] = $field;
				continue;
			}
			$sets[] = $field.' = '.$this->sqlValueForField($field, $value);
			$changes[$field] = array(
				'before' => $this->historyValue($field, $currentValue),
				'after' => $this->historyValue($field, $value),
			);
		}

		if (!empty($blocked)) {
			if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel($current['status']), $user, 'unsafe_edit_rejected', 'Modification refusee: champs verrouilles', array(
				'rejected_fields' => array_values($blocked),
				'reason' => 'linked_records',
			)) < 0) {
				$this->db->rollback();
				return -1;
			}
			$this->error = 'Convention fields are locked after linked records exist: '.implode(', ', $blocked);
			$this->db->commit();
			return -1;
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
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel($current['status']), $user, 'field_changed', $comment, $changes) < 0) {
			$this->db->rollback();
			return -1;
		}
		if (empty($notrigger)) {
			$result = $this->call_trigger('MJLFINANCEMENT_CONVENTION_FIELD_CHANGE', $user);
			if ($result < 0) {
				$this->db->rollback();
				return -1;
			}
		}
		$this->db->commit();
		return 1;
	}

	public function activate(User $user, $comment = '', $notrigger = 0)
	{
		return $this->transitionStatus($user, array(self::STATUS_DRAFT), self::STATUS_ACTIVE, 'activated', $comment, 'MJLFINANCEMENT_CONVENTION_ACTIVATE', $notrigger);
	}

	public function close(User $user, $comment = '', $notrigger = 0)
	{
		return $this->transitionStatus($user, array(self::STATUS_ACTIVE), self::STATUS_CLOSED, 'closed', $comment, 'MJLFINANCEMENT_CONVENTION_CLOSE', $notrigger, true);
	}

	public function deleteIfUnlinkedDraft(User $user, $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing convention id';
			return -1;
		}
		if (!$this->canManage($user)) {
			$this->error = 'Permission denied for convention deletion';
			return -1;
		}
		$this->db->begin();
		$current = $this->fetchCurrentForGovernance($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if ((int) $current['status'] !== self::STATUS_DRAFT) {
			$this->error = 'Only draft conventions can be deleted';
			$this->db->rollback();
			return -1;
		}
		if ($this->hasLinkedRecordsFromCurrent($current)) {
			$this->error = 'Linked conventions cannot be deleted';
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), 'deleted', $user, 'deleted', 'Convention supprimee', array(
			'status' => array('before' => $this->statusLabel($current['status']), 'after' => 'deleted'),
		)) < 0) {
			$this->db->rollback();
			return -1;
		}
		$result = $this->deleteCommon($user, $notrigger);
		if ($result < 0) {
			$this->db->rollback();
			return -1;
		}
		$this->db->commit();
		return $result;
	}

	public function hasLinkedRecords()
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			return false;
		}
		$current = $this->fetchCurrentForGovernance($id, false);
		return !empty($current) && $this->hasLinkedRecordsFromCurrent($current);
	}

	public function lockedFieldsAfterLinks()
	{
		return array('ref', 'fk_soc', 'fk_project', 'currency_code', 'total_amount');
	}

	private function transitionStatus(User $user, $fromStatuses, $toStatus, $action, $comment, $trigger, $notrigger = 0, $requireNoOpenLinkedRecords = false)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing convention id';
			return -1;
		}
		if (!$this->canManage($user)) {
			$this->error = 'Permission denied for convention status change';
			return -1;
		}
		$this->db->begin();
		$current = $this->fetchCurrentForGovernance($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if (!in_array((int) $current['status'], array_map('intval', $fromStatuses), true)) {
			$this->error = 'Invalid convention status transition';
			$this->db->rollback();
			return -1;
		}
		if ($requireNoOpenLinkedRecords && $this->hasOpenLinkedRecords($current)) {
			$this->error = 'Convention cannot be closed while linked records are still open';
			$this->db->rollback();
			return -1;
		}

		$sql = 'UPDATE '.$this->db->prefix().$this->table_element;
		$sql .= ' SET status = '.((int) $toStatus).', fk_user_modif = '.((int) $user->id);
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel($toStatus), $user, $action, $comment, array(
			'status' => array('before' => $this->statusLabel($current['status']), 'after' => $this->statusLabel($toStatus)),
		)) < 0) {
			$this->db->rollback();
			return -1;
		}
		if (empty($notrigger)) {
			$result = $this->call_trigger($trigger, $user);
			if ($result < 0) {
				$this->db->rollback();
				return -1;
			}
		}
		$this->status = $toStatus;
		$this->db->commit();
		return 1;
	}

	private function validateRequiredFields()
	{
		if (trim((string) $this->ref) === '' || trim((string) $this->title) === '') {
			$this->error = 'Convention reference and title are required';
			return false;
		}
		if ((int) $this->fk_soc <= 0) {
			$this->error = 'Convention PTF is required';
			return false;
		}
		if (trim((string) $this->currency_code) === '') {
			$this->currency_code = 'XOF';
		}
		return true;
	}

	private function canManage(User $user)
	{
		return mjl_workspace_can_access_supervision($user) && mjl_user_has_right($user, 'mjlfinancement', 'convention', 'write');
	}

	private function fetchCurrentForGovernance($id, $forUpdate = false)
	{
		$sql = 'SELECT rowid, entity, ref, title, fk_soc, fk_project, date_start, date_end, total_amount, currency_code, note_public, note_private, status, fk_user_creat, import_key';
		$sql .= ' FROM '.$this->db->prefix().$this->table_element;
		$sql .= ' WHERE rowid = '.((int) $id).' AND entity = '.mjl_active_entity();
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
			$this->error = 'Convention not found';
			return array();
		}
		return (array) $obj;
	}

	private function normalizeGovernedFields($fields, $current)
	{
		$allowed = array('ref', 'title', 'fk_soc', 'fk_project', 'date_start', 'date_end', 'total_amount', 'currency_code', 'note_public', 'note_private');
		$normalized = array();
		foreach ($allowed as $field) {
			if (!array_key_exists($field, $fields)) {
				continue;
			}
			$value = $fields[$field];
			if ($field === 'ref' || $field === 'title' || $field === 'currency_code') {
				$value = trim((string) $value);
			} elseif ($field === 'fk_soc' || $field === 'fk_project') {
				$value = (int) $value;
				if ($field === 'fk_project' && $value <= 0) {
					$value = null;
				}
			} elseif ($field === 'date_start' || $field === 'date_end') {
				$value = $this->normalizeDateValue($value);
			} elseif ($field === 'total_amount') {
				$value = $value === '' || $value === null ? null : price2num($value);
			} else {
				$value = (string) $value;
			}
			$normalized[$field] = $value;
		}
		if (isset($normalized['ref']) && $normalized['ref'] === '') {
			$this->error = 'Convention reference is required';
			return false;
		}
		if (isset($normalized['title']) && $normalized['title'] === '') {
			$this->error = 'Convention title is required';
			return false;
		}
		if (isset($normalized['fk_soc']) && (int) $normalized['fk_soc'] <= 0) {
			$this->error = 'Convention PTF is required';
			return false;
		}
		if (isset($normalized['currency_code']) && !preg_match('/^[A-Z]{3}$/', $normalized['currency_code'])) {
			$this->error = 'Convention currency must use a 3-letter code';
			return false;
		}
		return $normalized;
	}

	private function hasLinkedRecordsFromCurrent($current)
	{
		$id = (int) $current['rowid'];
		$entity = (int) $current['entity'];
		foreach (array('mjlfinancement_activity', 'mjlfinancement_budget_line', 'mjlfinancement_fund_receipt', 'mjlfinancement_expense') as $table) {
			$sql = 'SELECT rowid FROM '.$this->db->prefix().$table.' WHERE entity = '.$entity.' AND fk_convention = '.$id.' LIMIT 1';
			$resql = $this->db->query($sql);
			if ($resql && $this->db->fetch_object($resql)) {
				return true;
			}
		}
		return false;
	}

	private function hasOpenLinkedRecords($current)
	{
		$id = (int) $current['rowid'];
		$entity = (int) $current['entity'];
		$activityOpen = MjlActivity::openStatuses();
		$expenseOpen = array(MjlExpense::STATUS_DRAFT, MjlExpense::STATUS_SUBMITTED, MjlExpense::STATUS_CORRECTED, MjlExpense::STATUS_REJECTED);
		$queries = array(
			'SELECT rowid FROM '.$this->db->prefix().'mjlfinancement_activity WHERE entity = '.$entity.' AND fk_convention = '.$id.' AND status IN ('.implode(',', array_map('intval', $activityOpen)).') LIMIT 1',
			'SELECT rowid FROM '.$this->db->prefix().'mjlfinancement_expense WHERE entity = '.$entity.' AND fk_convention = '.$id.' AND status IN ('.implode(',', array_map('intval', $expenseOpen)).') LIMIT 1',
			'SELECT rowid FROM '.$this->db->prefix().'mjlfinancement_budget_line WHERE entity = '.$entity.' AND fk_convention = '.$id.' AND status = 0 LIMIT 1',
			'SELECT rowid FROM '.$this->db->prefix().'mjlfinancement_fund_receipt WHERE entity = '.$entity.' AND fk_convention = '.$id.' AND status = 0 LIMIT 1',
		);
		foreach ($queries as $sql) {
			$resql = $this->db->query($sql);
			if ($resql && $this->db->fetch_object($resql)) {
				return true;
			}
		}
		return false;
	}

	private function insertWorkflowAction($current, $fromStatusLabel, $toStatusLabel, User $user, $action, $comment, $changes)
	{
		$id = (int) $current['rowid'];
		$actionDate = dol_now();
		$ref = 'WFA-CONV-'.$id.'-'.date('YmdHis', $actionDate).'-'.substr(str_replace('.', '', (string) microtime(true)), -6).'-'.((int) $user->id).'-'.strtoupper(substr(preg_replace('/[^a-z0-9]/i', '', $action), 0, 8));
		$sql = 'INSERT INTO '.$this->db->prefix().'mjlfinancement_workflow_action';
		$sql .= ' (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, reason, comment, changes_json, date_creation, fk_user_creat, import_key)';
		$sql .= ' VALUES (';
		$sql .= ((int) $current['entity']);
		$sql .= ", '".$this->db->escape($ref)."'";
		$sql .= ", 'mjlfinancement_convention'";
		$sql .= ', '.$id;
		$sql .= ", '".$this->db->escape($action)."'";
		$sql .= ', '.mjl_integrity_sql_string($fromStatusLabel);
		$sql .= ', '.mjl_integrity_sql_string($toStatusLabel);
		$sql .= ', '.((int) $user->id);
		$sql .= ", '".$this->db->escape($this->actorRole($user))."'";
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

	private function actorRole(User $user)
	{
		return !empty($user->admin) ? 'ADMIN' : 'DPAF';
	}

	private function statusLabel($status)
	{
		$map = array(self::STATUS_DRAFT => 'draft', self::STATUS_ACTIVE => 'active', self::STATUS_CLOSED => 'closed');
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

	private function valuesEqual($field, $before, $after)
	{
		if ($field === 'date_start' || $field === 'date_end') {
			return $this->normalizeDateValue($before) === $this->normalizeDateValue($after);
		}
		if ($field === 'total_amount') {
			return abs((float) $before - (float) $after) < 0.001;
		}
		return (string) $before === (string) $after;
	}

	private function sqlValueForField($field, $value)
	{
		if ($value === null || $value === '') {
			if (in_array($field, array('fk_project', 'date_start', 'date_end', 'total_amount'), true)) {
				return 'NULL';
			}
		}
		if ($field === 'fk_soc' || $field === 'fk_project') {
			return (string) ((int) $value);
		}
		if ($field === 'total_amount') {
			return (string) price2num($value);
		}
		return "'".$this->db->escape((string) $value)."'";
	}

	private function historyValue($field, $value)
	{
		if ($field === 'total_amount') {
			return $value === null ? null : (string) price2num($value);
		}
		if ($field === 'fk_soc' || $field === 'fk_project') {
			return $value === null || $value === '' ? null : (int) $value;
		}
		return $value;
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
