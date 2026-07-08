<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

class MjlBudgetLine extends CommonObject
{
	public $module = 'mjlfinancement';
	public $element = 'mjlbudgetline';
	public $TRIGGER_PREFIX = 'MJLFINANCEMENT_BUDGETLINE';
	public $table_element = 'mjlfinancement_budget_line';
	public $picto = 'accounting';
	public $isextrafieldmanaged = 0;
	public $ismultientitymanaged = 1;

	const STATUS_DRAFT = 0;
	const STATUS_ACTIVE = 1;

	public $fields = array(
		'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'enabled' => 1, 'position' => 1, 'notnull' => 1, 'visible' => 0, 'noteditable' => 1, 'index' => 1),
		'entity' => array('type' => 'integer', 'label' => 'Entity', 'enabled' => 1, 'position' => 5, 'notnull' => 1, 'visible' => 0, 'default' => '1', 'index' => 1),
		'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'enabled' => 1, 'position' => 20, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'searchall' => 1, 'showoncombobox' => 1, 'validate' => 1),
		'label' => array('type' => 'varchar(255)', 'label' => 'Label', 'enabled' => 1, 'position' => 30, 'notnull' => 0, 'visible' => 1, 'searchall' => 1, 'showoncombobox' => 2, 'validate' => 1),
		'fk_project' => array('type' => 'integer:Project:projet/class/project.class.php:1', 'label' => 'Project', 'picto' => 'project', 'enabled' => 'isModEnabled("project")', 'position' => 35, 'notnull' => -1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_convention' => array('type' => 'integer:MjlConvention:mjlfinancement/class/mjlconvention.class.php:1', 'label' => 'MJLConvention', 'enabled' => 1, 'position' => 40, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_mjl_activity' => array('type' => 'integer:MjlActivity:mjlfinancement/class/mjlactivity.class.php:1', 'label' => 'MJLActivity', 'enabled' => 1, 'position' => 45, 'notnull' => -1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_activity' => array('type' => 'integer:Task:projet/class/task.class.php:1', 'label' => 'MJLProjectTask', 'picto' => 'projecttask', 'enabled' => 'isModEnabled("project")', 'position' => 50, 'notnull' => -1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'initial_budget' => array('type' => 'price', 'label' => 'MJLInitialBudget', 'enabled' => 1, 'position' => 60, 'notnull' => 0, 'visible' => 1, 'isameasure' => 1, 'validate' => 1),
		'revised_budget' => array('type' => 'price', 'label' => 'MJLRevisedBudget', 'enabled' => 1, 'position' => 70, 'notnull' => 0, 'visible' => 1, 'isameasure' => 1, 'validate' => 1),
		'committed_amount' => array('type' => 'price', 'label' => 'MJLCommittedAmount', 'enabled' => 1, 'position' => 80, 'notnull' => 0, 'visible' => 1, 'noteditable' => 1, 'isameasure' => 1, 'validate' => 1),
		'spent_amount' => array('type' => 'price', 'label' => 'MJLSpentAmount', 'enabled' => 1, 'position' => 90, 'notnull' => 0, 'visible' => 1, 'noteditable' => 1, 'isameasure' => 1, 'validate' => 1),
		'remaining_amount' => array('type' => 'price', 'label' => 'MJLRemainingAmount', 'enabled' => 1, 'position' => 100, 'notnull' => 0, 'visible' => 1, 'noteditable' => 1, 'isameasure' => 1, 'validate' => 1),
		'category' => array('type' => 'varchar(64)', 'label' => 'Category', 'enabled' => 1, 'position' => 110, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'note_public' => array('type' => 'html', 'label' => 'NotePublic', 'enabled' => 1, 'position' => 500, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'note_private' => array('type' => 'html', 'label' => 'NotePrivate', 'enabled' => 1, 'position' => 510, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'date_creation' => array('type' => 'datetime', 'label' => 'DateCreation', 'enabled' => 1, 'position' => 600, 'notnull' => 1, 'visible' => -2),
		'tms' => array('type' => 'timestamp', 'label' => 'DateModification', 'enabled' => 1, 'position' => 610, 'notnull' => 0, 'visible' => -2),
		'fk_user_creat' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserAuthor', 'enabled' => 1, 'position' => 620, 'notnull' => 1, 'visible' => -2),
		'fk_user_modif' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserModif', 'enabled' => 1, 'position' => 630, 'notnull' => -1, 'visible' => -2),
		'import_key' => array('type' => 'varchar(14)', 'label' => 'ImportId', 'enabled' => 1, 'position' => 1000, 'notnull' => -1, 'visible' => -2),
		'status' => array('type' => 'integer', 'label' => 'Status', 'enabled' => 1, 'position' => 2000, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'default' => '0', 'arrayofkeyval' => array(0 => 'Draft', 1 => 'Active'), 'validate' => 1),
	);

	public $rowid;
	public $ref;
	public $label;
	public $fk_project;
	public $fk_convention;
	public $fk_mjl_activity;
	public $fk_activity;
	public $initial_budget;
	public $revised_budget;
	public $committed_amount;
	public $spent_amount;
	public $remaining_amount;
	public $category;
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
			$this->error = 'Permission denied for budget line creation';
			return -1;
		}
		if (empty($this->entity)) {
			$this->entity = $activeEntity;
		}
		if ((int) $this->entity !== $activeEntity) {
			$this->error = 'Budget line entity does not match active entity';
			return -1;
		}
		$this->status = self::STATUS_DRAFT;
		if (!$this->normalizeAmountsForCreate() || !$this->validateRequiredFields() || !$this->assertLinks($activeEntity, true)) {
			return -1;
		}
		$this->committed_amount = 0;
		$this->spent_amount = 0;
		$this->remaining_amount = (float) $this->revised_budget;

		$this->db->begin();
		$result = $this->createCommon($user, $notrigger);
		if ($result <= 0) {
			$this->db->rollback();
			return $result;
		}
		$this->id = $result;
		$this->rowid = $result;
		if ($this->recalculateAmounts($result, $this->entity) < 0) {
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction(array(
			'rowid' => $result,
			'entity' => (int) $this->entity,
			'status' => self::STATUS_DRAFT,
			'import_key' => $this->import_key,
		), null, $this->statusLabel(self::STATUS_DRAFT), $user, 'created', 'Ligne budgetaire creee', array(
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
			'label' => $this->label,
			'fk_project' => $this->fk_project,
			'fk_convention' => $this->fk_convention,
			'fk_mjl_activity' => $this->fk_mjl_activity,
			'fk_activity' => $this->fk_activity,
			'initial_budget' => $this->initial_budget,
			'revised_budget' => $this->revised_budget,
			'category' => $this->category,
			'note_public' => $this->note_public,
			'note_private' => $this->note_private,
		), 'Mise a jour ligne budgetaire', $notrigger);
	}

	public function delete(User $user, $notrigger = 0)
	{
		return $this->deleteIfUnlinkedDraft($user, $notrigger);
	}

	public function updateGovernedFields(User $user, $fields, $comment = '', $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing budget line id';
			return -1;
		}
		if (!$this->canManage($user)) {
			$this->error = 'Permission denied for budget line update';
			return -1;
		}

		$this->db->begin();
		$current = $this->fetchCurrentForGovernance($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		$normalized = $this->normalizeGovernedFields($fields);
		if ($normalized === false) {
			$this->db->rollback();
			return -1;
		}

		$incoming = array_merge($current, $normalized);
		if (!$this->assertLinksFromArray($incoming, (int) $current['entity'], true)) {
			$this->db->rollback();
			return -1;
		}

		$hasExpenses = $this->hasExpensesFromCurrent($current);
		$validatedSpent = $this->validatedSpentFromCurrent($current);
		$locked = $hasExpenses ? $this->lockedFieldsAfterExpenses() : array();
		$blocked = array();
		$changes = array();
		$sets = array();

		foreach ($normalized as $field => $value) {
			$currentValue = array_key_exists($field, $current) ? $current[$field] : null;
			if ($this->valuesEqual($field, $currentValue, $value)) {
				continue;
			}
			if (in_array($field, $locked, true)) {
				$blocked[] = $field;
				continue;
			}
			if ($field === 'revised_budget' && (float) $value + 0.001 < $validatedSpent) {
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
				'rejected_fields' => array_values(array_unique($blocked)),
				'reason' => $hasExpenses ? 'linked_expenses_or_spent_floor' : 'spent_floor',
			)) < 0) {
				$this->db->rollback();
				return -1;
			}
			$this->error = 'Budget line fields are locked or below spent floor: '.implode(', ', array_unique($blocked));
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
		if ($this->recalculateAmounts($id, $current['entity']) < 0) {
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel($current['status']), $user, 'field_changed', $comment, $changes) < 0) {
			$this->db->rollback();
			return -1;
		}
		if (empty($notrigger)) {
			$result = $this->call_trigger('MJLFINANCEMENT_BUDGETLINE_FIELD_CHANGE', $user);
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
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing budget line id';
			return -1;
		}
		if (!$this->canManage($user)) {
			$this->error = 'Permission denied for budget line activation';
			return -1;
		}
		$this->db->begin();
		$current = $this->fetchCurrentForGovernance($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if ((int) $current['status'] === self::STATUS_ACTIVE) {
			$this->db->commit();
			return 0;
		}
		if ((int) $current['status'] !== self::STATUS_DRAFT) {
			$this->error = 'Only draft budget lines can be activated';
			$this->db->rollback();
			return -1;
		}
		if (!$this->assertLinksFromArray($current, (int) $current['entity'], true)) {
			$this->db->rollback();
			return -1;
		}
		if ($this->recalculateAmounts($id, $current['entity']) < 0) {
			$this->db->rollback();
			return -1;
		}
		$refreshed = $this->fetchCurrentForGovernance($id, true);
		if ((float) $refreshed['revised_budget'] + 0.001 < (float) $refreshed['spent_amount']) {
			$this->error = 'Budget line revised budget cannot be below spent amount';
			$this->db->rollback();
			return -1;
		}
		$sql = 'UPDATE '.$this->db->prefix().$this->table_element;
		$sql .= ' SET status = '.self::STATUS_ACTIVE.', fk_user_modif = '.((int) $user->id);
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel(self::STATUS_ACTIVE), $user, 'activated', $comment, array(
			'status' => array('before' => $this->statusLabel($current['status']), 'after' => $this->statusLabel(self::STATUS_ACTIVE)),
		)) < 0) {
			$this->db->rollback();
			return -1;
		}
		if (empty($notrigger)) {
			$result = $this->call_trigger('MJLFINANCEMENT_BUDGETLINE_ACTIVATE', $user);
			if ($result < 0) {
				$this->db->rollback();
				return -1;
			}
		}
		$this->status = self::STATUS_ACTIVE;
		$this->db->commit();
		return 1;
	}

	public function deleteIfUnlinkedDraft(User $user, $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing budget line id';
			return -1;
		}
		if (!$this->canManage($user)) {
			$this->error = 'Permission denied for budget line deletion';
			return -1;
		}
		$this->db->begin();
		$current = $this->fetchCurrentForGovernance($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if ((int) $current['status'] !== self::STATUS_DRAFT) {
			$this->error = 'Only draft budget lines can be deleted';
			$this->db->rollback();
			return -1;
		}
		if ($this->hasExpensesFromCurrent($current)) {
			$this->error = 'Budget lines with expenses cannot be deleted';
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), 'deleted', $user, 'deleted', 'Ligne budgetaire supprimee', array(
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

	public function lockedFieldsAfterExpenses()
	{
		return array('ref', 'fk_project', 'fk_convention', 'fk_mjl_activity', 'fk_activity', 'initial_budget', 'category');
	}

	private function normalizeAmountsForCreate()
	{
		$this->initial_budget = $this->initial_budget === '' || $this->initial_budget === null ? 0 : price2num($this->initial_budget);
		$this->revised_budget = $this->revised_budget === '' || $this->revised_budget === null ? $this->initial_budget : price2num($this->revised_budget);
		if ((float) $this->initial_budget < 0 || (float) $this->revised_budget < 0) {
			$this->error = 'Budget amounts cannot be negative';
			return false;
		}
		return true;
	}

	private function validateRequiredFields()
	{
		if (trim((string) $this->ref) === '' || trim((string) $this->label) === '') {
			$this->error = 'Budget line reference and label are required';
			return false;
		}
		if ((int) $this->fk_project <= 0 || (int) $this->fk_convention <= 0) {
			$this->error = 'Project and convention are required';
			return false;
		}
		return true;
	}

	private function canManage(User $user)
	{
		return mjl_workspace_can_access_supervision($user) && mjl_user_has_right($user, 'mjlfinancement', 'budgetline', 'write');
	}

	private function fetchCurrentForGovernance($id, $forUpdate = false)
	{
		$sql = 'SELECT rowid, entity, ref, label, fk_project, fk_convention, fk_mjl_activity, fk_activity, initial_budget, revised_budget, committed_amount, spent_amount, remaining_amount, category, note_public, note_private, status, fk_user_creat, import_key';
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
			$this->error = 'Budget line not found';
			return array();
		}
		return (array) $obj;
	}

	private function normalizeGovernedFields($fields)
	{
		$allowed = array('ref', 'label', 'fk_project', 'fk_convention', 'fk_mjl_activity', 'fk_activity', 'initial_budget', 'revised_budget', 'category', 'note_public', 'note_private');
		$normalized = array();
		foreach ($allowed as $field) {
			if (!array_key_exists($field, $fields)) {
				continue;
			}
			$value = $fields[$field];
			if ($field === 'ref' || $field === 'label' || $field === 'category') {
				$value = trim((string) $value);
			} elseif (in_array($field, array('fk_project', 'fk_convention', 'fk_mjl_activity', 'fk_activity'), true)) {
				$value = (int) $value;
				if (in_array($field, array('fk_mjl_activity', 'fk_activity'), true) && $value <= 0) {
					$value = null;
				}
			} elseif ($field === 'initial_budget' || $field === 'revised_budget') {
				$value = $value === '' || $value === null ? 0 : price2num($value);
				if ((float) $value < 0) {
					$this->error = 'Budget amounts cannot be negative';
					return false;
				}
			} else {
				$value = (string) $value;
			}
			$normalized[$field] = $value;
		}
		if (isset($normalized['ref']) && $normalized['ref'] === '') {
			$this->error = 'Budget line reference is required';
			return false;
		}
		if (isset($normalized['label']) && $normalized['label'] === '') {
			$this->error = 'Budget line label is required';
			return false;
		}
		if (isset($normalized['fk_project']) && (int) $normalized['fk_project'] <= 0) {
			$this->error = 'Budget line project is required';
			return false;
		}
		if (isset($normalized['fk_convention']) && (int) $normalized['fk_convention'] <= 0) {
			$this->error = 'Budget line convention is required';
			return false;
		}
		return $normalized;
	}

	private function assertLinks($entity, $requireActiveConvention)
	{
		return $this->assertLinksFromArray(array(
			'fk_project' => $this->fk_project,
			'fk_convention' => $this->fk_convention,
			'fk_mjl_activity' => $this->fk_mjl_activity,
			'fk_activity' => $this->fk_activity,
		), $entity, $requireActiveConvention);
	}

	private function assertLinksFromArray($row, $entity, $requireActiveConvention)
	{
		$projectId = (int) $row['fk_project'];
		$conventionId = (int) $row['fk_convention'];
		$mjlActivityId = (int) ($row['fk_mjl_activity'] ?? 0);
		$taskId = (int) ($row['fk_activity'] ?? 0);
		if ($projectId <= 0 || $conventionId <= 0) {
			$this->error = 'Project and convention are required';
			return false;
		}
		$project = mjl_integrity_fetch_row('SELECT rowid FROM '.$this->db->prefix().'projet WHERE rowid = '.$projectId.' AND entity = '.((int) $entity));
		if (empty($project)) {
			$this->error = 'Project not found in active entity';
			return false;
		}
		$convention = mjl_integrity_fetch_row('SELECT rowid, fk_project, status FROM '.$this->db->prefix().'mjlfinancement_convention WHERE rowid = '.$conventionId.' AND entity = '.((int) $entity));
		if (empty($convention)) {
			$this->error = 'Convention not found in active entity';
			return false;
		}
		if ($requireActiveConvention && (int) $convention['status'] !== 1) {
			$this->error = 'Convention must be active for budget lines';
			return false;
		}
		if (!empty($convention['fk_project']) && (int) $convention['fk_project'] !== $projectId) {
			$this->error = 'Convention does not belong to selected project';
			return false;
		}
		if ($mjlActivityId > 0) {
			$activity = mjl_integrity_fetch_row('SELECT rowid, fk_project, fk_convention, fk_task FROM '.$this->db->prefix().'mjlfinancement_activity WHERE rowid = '.$mjlActivityId.' AND entity = '.((int) $entity));
			if (empty($activity)) {
				$this->error = 'Activity not found in active entity';
				return false;
			}
			if ((int) $activity['fk_project'] !== $projectId || (int) $activity['fk_convention'] !== $conventionId) {
				$this->error = 'Activity does not belong to selected project and convention';
				return false;
			}
			if ($taskId > 0 && (int) $activity['fk_task'] > 0 && (int) $activity['fk_task'] !== $taskId) {
				$this->error = 'Project task does not match selected MJL activity';
				return false;
			}
		}
		if ($taskId > 0) {
			$task = mjl_integrity_fetch_row('SELECT rowid, fk_projet FROM '.$this->db->prefix().'projet_task WHERE rowid = '.$taskId.' AND entity = '.((int) $entity));
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

	private function hasExpensesFromCurrent($current)
	{
		$sql = 'SELECT rowid FROM '.$this->db->prefix().'mjlfinancement_expense WHERE entity = '.((int) $current['entity']).' AND fk_budget_line = '.((int) $current['rowid']).' LIMIT 1';
		$resql = $this->db->query($sql);
		return $resql && (bool) $this->db->fetch_object($resql);
	}

	private function validatedSpentFromCurrent($current)
	{
		$sql = 'SELECT COALESCE(SUM('.mjl_expense_budget_amount_sql('e').'), 0) AS amount FROM '.$this->db->prefix().'mjlfinancement_expense e WHERE e.entity = '.((int) $current['entity']).' AND e.fk_budget_line = '.((int) $current['rowid']).' AND e.status IN ('.mjl_expense_status_sql_list(mjl_expense_budget_consuming_statuses()).')';
		$resql = $this->db->query($sql);
		$obj = $resql ? $this->db->fetch_object($resql) : null;
		return $obj ? (float) $obj->amount : 0.0;
	}

	private function recalculateAmounts($id, $entity)
	{
		if (mjl_recalculate_budget_line_amounts($id, $entity) < 0) {
			$this->error = mjl_integrity_error();
			return -1;
		}
		return 1;
	}

	private function insertWorkflowAction($current, $fromStatusLabel, $toStatusLabel, User $user, $action, $comment, $changes)
	{
		$id = (int) $current['rowid'];
		$actionDate = dol_now();
		$ref = 'WFA-BL-'.$id.'-'.date('YmdHis', $actionDate).'-'.substr(str_replace('.', '', (string) microtime(true)), -6).'-'.((int) $user->id).'-'.strtoupper(substr(preg_replace('/[^a-z0-9]/i', '', $action), 0, 8));
		$sql = 'INSERT INTO '.$this->db->prefix().'mjlfinancement_workflow_action';
		$sql .= ' (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, reason, comment, changes_json, date_creation, fk_user_creat, import_key)';
		$sql .= ' VALUES (';
		$sql .= ((int) $current['entity']);
		$sql .= ", '".$this->db->escape($ref)."'";
		$sql .= ", 'mjlfinancement_budget_line'";
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
		$map = array(self::STATUS_DRAFT => 'draft', self::STATUS_ACTIVE => 'active');
		$status = (int) $status;
		return isset($map[$status]) ? $map[$status] : (string) $status;
	}

	private function valuesEqual($field, $before, $after)
	{
		if (in_array($field, array('initial_budget', 'revised_budget'), true)) {
			return abs((float) $before - (float) $after) < 0.001;
		}
		return (string) $before === (string) $after;
	}

	private function sqlValueForField($field, $value)
	{
		if ($value === null || $value === '') {
			if (in_array($field, array('fk_mjl_activity', 'fk_activity', 'category', 'note_public', 'note_private'), true)) {
				return 'NULL';
			}
		}
		if (in_array($field, array('fk_project', 'fk_convention', 'fk_mjl_activity', 'fk_activity'), true)) {
			return $value === null ? 'NULL' : (string) ((int) $value);
		}
		if (in_array($field, array('initial_budget', 'revised_budget'), true)) {
			return (string) price2num($value);
		}
		return "'".$this->db->escape((string) $value)."'";
	}

	private function historyValue($field, $value)
	{
		if (in_array($field, array('initial_budget', 'revised_budget'), true)) {
			return $value === null ? null : (string) price2num($value);
		}
		if (in_array($field, array('fk_project', 'fk_convention', 'fk_mjl_activity', 'fk_activity'), true)) {
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
