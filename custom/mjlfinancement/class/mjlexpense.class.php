<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';

class MjlExpense extends CommonObject
{
	public $module = 'mjlfinancement';
	public $element = 'mjlexpense';
	public $TRIGGER_PREFIX = 'MJLFINANCEMENT_EXPENSE';
	public $table_element = 'mjlfinancement_expense';
	public $picto = 'expense';
	public $isextrafieldmanaged = 0;
	public $ismultientitymanaged = 1;

	const STATUS_DRAFT = 0;
	const STATUS_SUBMITTED = 1;
	const STATUS_VALIDATED = 2;
	const STATUS_CORRECTED = 3;
	const STATUS_REJECTED = 8;

	public $fields = array(
		'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'enabled' => 1, 'position' => 1, 'notnull' => 1, 'visible' => 0, 'noteditable' => 1, 'index' => 1),
		'entity' => array('type' => 'integer', 'label' => 'Entity', 'enabled' => 1, 'position' => 5, 'notnull' => 1, 'visible' => 0, 'default' => '1', 'index' => 1),
		'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'enabled' => 1, 'position' => 20, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'searchall' => 1, 'showoncombobox' => 1, 'validate' => 1),
		'fk_project' => array('type' => 'integer:Project:projet/class/project.class.php:1', 'label' => 'Project', 'picto' => 'project', 'enabled' => 'isModEnabled("project")', 'position' => 30, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_convention' => array('type' => 'integer:MjlConvention:mjlfinancement/class/mjlconvention.class.php:1', 'label' => 'MJLConvention', 'enabled' => 1, 'position' => 40, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_mjl_activity' => array('type' => 'integer:MjlActivity:mjlfinancement/class/mjlactivity.class.php:1', 'label' => 'MJLActivity', 'enabled' => 1, 'position' => 45, 'notnull' => -1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_budget_line' => array('type' => 'integer:MjlBudgetLine:mjlfinancement/class/mjlbudgetline.class.php:1', 'label' => 'MJLBudgetLine', 'enabled' => 1, 'position' => 50, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'amount' => array('type' => 'price', 'label' => 'Amount', 'enabled' => 1, 'position' => 60, 'notnull' => 1, 'visible' => 1, 'isameasure' => 1, 'validate' => 1),
		'expense_date' => array('type' => 'date', 'label' => 'MJLExpenseDate', 'enabled' => 1, 'position' => 70, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'description' => array('type' => 'text', 'label' => 'Description', 'enabled' => 1, 'position' => 80, 'notnull' => 0, 'visible' => 1, 'validate' => 1),
		'supporting_document' => array('type' => 'varchar(255)', 'label' => 'MJLSupportingDocument', 'enabled' => 1, 'position' => 90, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'fk_user_valid' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'MJLValidatedBy', 'enabled' => 1, 'position' => 100, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'validation_date' => array('type' => 'datetime', 'label' => 'MJLValidationDate', 'enabled' => 1, 'position' => 110, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'correction_reason' => array('type' => 'text', 'label' => 'MJLCorrectionReason', 'enabled' => 1, 'position' => 120, 'notnull' => 0, 'visible' => 1, 'validate' => 1),
		'submitted_at' => array('type' => 'datetime', 'label' => 'MJLSubmittedAt', 'enabled' => 1, 'position' => 125, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'note_public' => array('type' => 'html', 'label' => 'NotePublic', 'enabled' => 1, 'position' => 500, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'note_private' => array('type' => 'html', 'label' => 'NotePrivate', 'enabled' => 1, 'position' => 510, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'date_creation' => array('type' => 'datetime', 'label' => 'DateCreation', 'enabled' => 1, 'position' => 600, 'notnull' => 1, 'visible' => -2),
		'tms' => array('type' => 'timestamp', 'label' => 'DateModification', 'enabled' => 1, 'position' => 610, 'notnull' => 0, 'visible' => -2),
		'fk_user_creat' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserAuthor', 'enabled' => 1, 'position' => 130, 'notnull' => 1, 'visible' => 1),
		'fk_user_modif' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserModif', 'enabled' => 1, 'position' => 630, 'notnull' => -1, 'visible' => -2),
		'import_key' => array('type' => 'varchar(14)', 'label' => 'ImportId', 'enabled' => 1, 'position' => 1000, 'notnull' => -1, 'visible' => -2),
		'status' => array('type' => 'integer', 'label' => 'Status', 'enabled' => 1, 'position' => 2000, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'default' => '0', 'arrayofkeyval' => array(0 => 'Draft', 1 => 'MJLSubmitted', 2 => 'Validated', 3 => 'MJLCorrected', 8 => 'Rejected'), 'validate' => 1),
	);

	public $rowid;
	public $ref;
	public $fk_project;
	public $fk_convention;
	public $fk_mjl_activity;
	public $fk_budget_line;
	public $amount;
	public $expense_date;
	public $description;
	public $supporting_document;
	public $fk_user_valid;
	public $validation_date;
	public $correction_reason;
	public $submitted_at;
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
			$this->error = 'Expense entity does not match active entity';
			return -1;
		}
		if (mjl_expense_is_audited_status($this->status)) {
			$this->error = 'Audited expense statuses require an explicit workflow action';
			return -1;
		}
		if (mjl_assert_expense_links($this, $activeEntity) < 0) {
			$this->error = mjl_integrity_error();
			return -1;
		}

		$result = $this->createCommon($user, $notrigger);
		if ($result > 0 && mjl_recalculate_budget_line_amounts($this->fk_budget_line, $this->entity) < 0) {
			$this->error = mjl_integrity_error();
			return -1;
		}
		return $result;
	}

	public function fetch($id, $ref = null, $noextrafields = 0, $nolines = 0)
	{
		return $this->fetchCommon($id, $ref, '', $noextrafields);
	}

	public function update(User $user, $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing expense id';
			return -1;
		}

		$current = $this->fetchCurrentForIntegrity($id);
		if (empty($current)) {
			return -1;
		}

		$history = mjl_has_expense_validation_history($id, $current['entity']);
		if ($history < 0) {
			$this->error = mjl_integrity_error();
			return -1;
		}
		$currentStatus = (int) $current['status'];
		$incomingStatus = ($this->status === null || $this->status === '') ? $currentStatus : (int) $this->status;
		if ($incomingStatus !== $currentStatus) {
			$this->error = 'Expense status changes require an explicit workflow action';
			return -1;
		}
		if ((int) $current['fk_user_valid'] !== (int) $this->fk_user_valid || (string) $current['validation_date'] !== (string) $this->validation_date) {
			$this->error = 'Expense validation metadata cannot be changed through generic update';
			return -1;
		}
		if ($currentStatus === self::STATUS_SUBMITTED || $currentStatus === self::STATUS_VALIDATED || $currentStatus === self::STATUS_CORRECTED || ($history > 0 && $currentStatus !== self::STATUS_REJECTED)) {
			$this->error = 'Audited expenses cannot be modified through generic update';
			return -1;
		}
		if (empty($this->entity)) {
			$this->entity = $current['entity'];
		}
		if ((int) $this->entity !== (int) $current['entity']) {
			$this->error = 'Expense entity cannot be changed';
			return -1;
		}
		if (mjl_assert_expense_links($this, $current['entity']) < 0) {
			$this->error = mjl_integrity_error();
			return -1;
		}

		$result = $this->updateCommon($user, $notrigger);
		if ($result > 0) {
			$budgetLineIds = array($current['fk_budget_line'], $this->fk_budget_line);
			$entity = empty($this->entity) ? $current['entity'] : $this->entity;
			if (mjl_recalculate_budget_line_amounts($budgetLineIds, $entity) < 0) {
				$this->error = mjl_integrity_error();
				return -1;
			}
		}
		return $result;
	}

	public function delete(User $user, $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing expense id';
			return -1;
		}

		$current = $this->fetchCurrentForIntegrity($id);
		if (empty($current)) {
			return -1;
		}
		$history = mjl_has_expense_validation_history($id, $current['entity']);
		if ($history < 0) {
			$this->error = mjl_integrity_error();
			return -1;
		}
		if (mjl_expense_is_audited_status($current['status']) || $history > 0) {
			$this->error = 'Audited expenses cannot be deleted';
			return -1;
		}

		$result = $this->deleteCommon($user, $notrigger);
		if ($result > 0 && mjl_recalculate_budget_line_amounts($current['fk_budget_line'], $current['entity']) < 0) {
			$this->error = mjl_integrity_error();
			return -1;
		}
		return $result;
	}

	public function validate(User $user, $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing expense id';
			return -1;
		}
		if (!$this->canDo($user, 'expense', 'validate')) {
			$this->error = 'Permission denied for expense validation';
			return -1;
		}

		$validationDate = dol_now();
		$this->db->begin();

		$current = $this->fetchCurrentForIntegrity($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if ((int) $current['status'] === self::STATUS_VALIDATED) {
			$this->db->commit();
			return 0;
		}
		if ((int) $current['status'] !== self::STATUS_SUBMITTED) {
			$this->error = 'Only submitted expenses can be validated';
			$this->db->rollback();
			return -1;
		}
		if ((int) $current['fk_user_creat'] === (int) $user->id) {
			$this->error = 'A user cannot review their own expense';
			$this->db->rollback();
			return -1;
		}
		$hasDocument = mjl_expense_has_supporting_document($id, $current['entity'], $current['supporting_document']);
		if ($hasDocument < 0) {
			$this->error = mjl_integrity_error();
			$this->db->rollback();
			return -1;
		}
		if (!$hasDocument) {
			$this->error = 'Supporting document is required before validation';
			$this->db->rollback();
			return -1;
		}
		if (mjl_assert_no_budget_overspend_on_validation($id, $current['fk_budget_line'], $current['amount'], $current['entity']) < 0) {
			$this->error = mjl_integrity_error();
			$this->db->rollback();
			return -1;
		}

		$sql = 'UPDATE '.$this->db->prefix().$this->table_element;
		$sql .= ' SET status = '.self::STATUS_VALIDATED;
		$sql .= ', fk_user_valid = '.((int) $user->id);
		$sql .= ", validation_date = '".$this->db->idate($validationDate)."'";
		$sql .= ', fk_user_modif = '.((int) $user->id);
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);

		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			$this->db->rollback();
			return -1;
		}

		$this->entity = $current['entity'];
		$this->fk_budget_line = $current['fk_budget_line'];
		$this->amount = $current['amount'];
		$this->supporting_document = $current['supporting_document'];
		$this->import_key = $current['import_key'];
		$this->fk_user_valid = $user->id;
		$this->validation_date = $validationDate;
		$this->status = self::STATUS_VALIDATED;

		if (mjl_record_expense_validation_event($this, $current['status'], self::STATUS_VALIDATED, $user, $validationDate, 'validated') < 0) {
			$this->error = mjl_integrity_error();
			$this->status = $current['status'];
			$this->fk_user_valid = $current['fk_user_valid'];
			$this->validation_date = $current['validation_date'];
			$this->db->rollback();
			return -1;
		}

		if (mjl_recalculate_budget_line_amounts($current['fk_budget_line'], $current['entity']) < 0) {
			$this->error = mjl_integrity_error();
			$this->status = $current['status'];
			$this->fk_user_valid = $current['fk_user_valid'];
			$this->validation_date = $current['validation_date'];
			$this->db->rollback();
			return -1;
		}

		if (!$notrigger) {
			$result = $this->call_trigger('MJLFINANCEMENT_EXPENSE_VALIDATE', $user);
			if ($result < 0) {
				$this->status = $current['status'];
				$this->fk_user_valid = $current['fk_user_valid'];
				$this->validation_date = $current['validation_date'];
				$this->db->rollback();
				return -1;
			}
		}

		$this->db->commit();
		return 1;
	}

	public function submit(User $user, $comment = '', $notrigger = 0)
	{
		return $this->workflowTransition($user, array(self::STATUS_DRAFT, self::STATUS_CORRECTED), self::STATUS_SUBMITTED, 'submitted', $comment, array(
			'required_right' => array('expense', 'write'),
			'set_submitted_at' => true,
			'trigger' => 'MJLFINANCEMENT_EXPENSE_SUBMIT',
			'idempotent' => true,
			'notrigger' => $notrigger,
		));
	}

	public function reject(User $user, $reason, $notrigger = 0)
	{
		$reason = trim((string) $reason);
		if ($reason === '') {
			$this->error = 'Rejection reason is required';
			return -1;
		}
		return $this->workflowTransition($user, array(self::STATUS_SUBMITTED), self::STATUS_REJECTED, 'rejected', $reason, array(
			'required_right' => array('expense', 'validate'),
			'no_self_review' => true,
			'set_reason' => true,
			'clear_validation' => true,
			'trigger' => 'MJLFINANCEMENT_EXPENSE_REJECT',
			'notrigger' => $notrigger,
		));
	}

	public function correct(User $user, $reason, $notrigger = 0)
	{
		$reason = trim((string) $reason);
		if ($reason === '') {
			$this->error = 'Correction reason is required';
			return -1;
		}
		return $this->workflowTransition($user, array(self::STATUS_REJECTED), self::STATUS_CORRECTED, 'corrected', $reason, array(
			'required_right' => array('expense', 'write'),
			'set_reason' => true,
			'clear_validation' => true,
			'trigger' => 'MJLFINANCEMENT_EXPENSE_CORRECT',
			'notrigger' => $notrigger,
		));
	}

	private function workflowTransition(User $user, $fromStatuses, $toStatus, $action, $comment, $options)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing expense id';
			return -1;
		}
		if (!empty($options['required_right']) && !$this->canDo($user, $options['required_right'][0], $options['required_right'][1])) {
			$this->error = 'Permission denied for expense '.$action;
			return -1;
		}

		$actionDate = dol_now();
		$this->db->begin();
		$current = $this->fetchCurrentForIntegrity($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if (!empty($options['idempotent']) && (int) $current['status'] === (int) $toStatus) {
			$this->db->commit();
			return 0;
		}
		if (!in_array((int) $current['status'], array_map('intval', $fromStatuses), true)) {
			$this->error = 'Invalid expense workflow transition from '.mjl_expense_status_label($current['status']).' to '.mjl_expense_status_label($toStatus);
			$this->db->rollback();
			return -1;
		}
		if (!empty($options['no_self_review']) && (int) $current['fk_user_creat'] === (int) $user->id) {
			$this->error = 'A user cannot review their own expense';
			$this->db->rollback();
			return -1;
		}

		$sql = 'UPDATE '.$this->db->prefix().$this->table_element;
		$sql .= ' SET status = '.((int) $toStatus);
		$sql .= ', fk_user_modif = '.((int) $user->id);
		if (!empty($options['set_submitted_at'])) {
			$sql .= ", submitted_at = '".$this->db->idate($actionDate)."'";
		}
		if (!empty($options['set_reason'])) {
			$sql .= ', correction_reason = '.mjl_integrity_sql_string($comment);
		}
		if (!empty($options['clear_validation'])) {
			$sql .= ', fk_user_valid = NULL, validation_date = NULL';
		}
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);

		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			$this->db->rollback();
			return -1;
		}

		$this->entity = $current['entity'];
		$this->fk_budget_line = $current['fk_budget_line'];
		$this->amount = $current['amount'];
		$this->supporting_document = $current['supporting_document'];
		$this->import_key = $current['import_key'];
		$this->status = $toStatus;
		if (!empty($options['set_submitted_at'])) {
			$this->submitted_at = $actionDate;
		}
		if (!empty($options['set_reason'])) {
			$this->correction_reason = $comment;
			$this->fk_user_valid = null;
			$this->validation_date = null;
		}

		if (mjl_record_expense_validation_event($this, $current['status'], $toStatus, $user, $actionDate, $action, $comment) < 0) {
			$this->error = mjl_integrity_error();
			$this->status = $current['status'];
			$this->db->rollback();
			return -1;
		}

		if (mjl_recalculate_budget_line_amounts($current['fk_budget_line'], $current['entity']) < 0) {
			$this->error = mjl_integrity_error();
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

	private function canDo(User $user, $perms, $subperms)
	{
		return mjl_user_has_right($user, 'mjlfinancement', $perms, $subperms);
	}

	private function fetchCurrentForIntegrity($id, $forUpdate = false)
	{
		$entity = mjl_active_entity();
		$sql = 'SELECT rowid, entity, status, fk_project, fk_convention, fk_mjl_activity, fk_budget_line, amount, supporting_document, fk_user_valid, validation_date, fk_user_creat, import_key';
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
			$this->error = 'Expense not found';
			return array();
		}

		return array(
			'rowid' => (int) $obj->rowid,
			'entity' => (int) $obj->entity,
			'status' => (int) $obj->status,
			'fk_project' => (int) $obj->fk_project,
			'fk_convention' => (int) $obj->fk_convention,
			'fk_mjl_activity' => (int) $obj->fk_mjl_activity,
			'fk_budget_line' => (int) $obj->fk_budget_line,
			'amount' => (float) $obj->amount,
			'supporting_document' => (string) $obj->supporting_document,
			'fk_user_valid' => $obj->fk_user_valid,
			'validation_date' => $obj->validation_date,
			'fk_user_creat' => (int) $obj->fk_user_creat,
			'import_key' => $obj->import_key,
		);
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
