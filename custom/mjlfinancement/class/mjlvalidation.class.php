<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';

class MjlValidation extends CommonObject
{
	public $module = 'mjlfinancement';
	public $element = 'mjlvalidation';
	public $TRIGGER_PREFIX = 'MJLFINANCEMENT_VALIDATION';
	public $table_element = 'mjlfinancement_validation';
	public $picto = 'check';
	public $isextrafieldmanaged = 0;
	public $ismultientitymanaged = 1;

	public $fields = array(
		'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'enabled' => 1, 'position' => 1, 'notnull' => 1, 'visible' => 0, 'noteditable' => 1, 'index' => 1),
		'entity' => array('type' => 'integer', 'label' => 'Entity', 'enabled' => 1, 'position' => 5, 'notnull' => 1, 'visible' => 0, 'default' => '1', 'index' => 1),
		'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'enabled' => 1, 'position' => 20, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'searchall' => 1, 'showoncombobox' => 1, 'validate' => 1),
		'fk_expense' => array('type' => 'integer:MjlExpense:mjlfinancement/class/mjlexpense.class.php:1', 'label' => 'MJLExpense', 'enabled' => 1, 'position' => 30, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'action' => array('type' => 'varchar(32)', 'label' => 'Action', 'enabled' => 1, 'position' => 40, 'notnull' => 1, 'visible' => 1, 'validate' => 1),
		'from_status' => array('type' => 'varchar(32)', 'label' => 'MJLFromStatus', 'enabled' => 1, 'position' => 50, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'to_status' => array('type' => 'varchar(32)', 'label' => 'MJLToStatus', 'enabled' => 1, 'position' => 60, 'notnull' => 1, 'visible' => 1, 'validate' => 1),
		'fk_user_action' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'User', 'enabled' => 1, 'position' => 70, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'action_date' => array('type' => 'datetime', 'label' => 'Date', 'enabled' => 1, 'position' => 80, 'notnull' => 1, 'visible' => 1, 'validate' => 1),
		'comment' => array('type' => 'text', 'label' => 'Comment', 'enabled' => 1, 'position' => 90, 'notnull' => 0, 'visible' => 1, 'validate' => 1),
		'date_creation' => array('type' => 'datetime', 'label' => 'DateCreation', 'enabled' => 1, 'position' => 600, 'notnull' => 1, 'visible' => -2),
		'tms' => array('type' => 'timestamp', 'label' => 'DateModification', 'enabled' => 1, 'position' => 610, 'notnull' => 0, 'visible' => -2),
		'fk_user_creat' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserAuthor', 'enabled' => 1, 'position' => 620, 'notnull' => 1, 'visible' => -2),
		'fk_user_modif' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserModif', 'enabled' => 1, 'position' => 630, 'notnull' => -1, 'visible' => -2),
		'import_key' => array('type' => 'varchar(14)', 'label' => 'ImportId', 'enabled' => 1, 'position' => 1000, 'notnull' => -1, 'visible' => -2),
	);

	public $rowid;
	public $ref;
	public $fk_expense;
	public $action;
	public $from_status;
	public $to_status;
	public $fk_user_action;
	public $action_date;
	public $comment;
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
		return $this->createCommon($user, $notrigger);
	}

	public function fetch($id, $ref = null, $noextrafields = 0, $nolines = 0)
	{
		return $this->fetchCommon($id, $ref, '', $noextrafields);
	}

	public function update(User $user, $notrigger = 0)
	{
		return $this->updateCommon($user, $notrigger);
	}

	public function delete(User $user, $notrigger = 0)
	{
		return $this->deleteCommon($user, $notrigger);
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
