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
		if (mjl_expense_is_audited_status($this->status)) {
			$this->error = 'Audited expense statuses require an explicit workflow action';
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
		if (mjl_expense_is_audited_status($current['status']) || $history > 0) {
			$this->error = 'Audited expenses cannot be modified through generic update';
			return -1;
		}
		if (mjl_expense_is_audited_status($this->status)) {
			$this->error = 'Audited expense statuses require an explicit workflow action';
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
		if (trim($current['supporting_document']) === '') {
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
		$sql .= ' WHERE rowid = '.$id;

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

		if (mjl_record_expense_validation_event($this, $current['status'], self::STATUS_VALIDATED, $user, $validationDate) < 0) {
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

	private function fetchCurrentForIntegrity($id, $forUpdate = false)
	{
		$sql = 'SELECT rowid, entity, status, fk_budget_line, amount, supporting_document, fk_user_valid, validation_date, import_key';
		$sql .= ' FROM '.$this->db->prefix().$this->table_element;
		$sql .= ' WHERE rowid = '.((int) $id);
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
			'fk_budget_line' => (int) $obj->fk_budget_line,
			'amount' => (float) $obj->amount,
			'supporting_document' => (string) $obj->supporting_document,
			'fk_user_valid' => $obj->fk_user_valid,
			'validation_date' => $obj->validation_date,
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
