<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';

class MjlReport extends CommonObject
{
	public $module = 'mjlfinancement';
	public $element = 'mjlreport';
	public $TRIGGER_PREFIX = 'MJLFINANCEMENT_REPORT';
	public $table_element = 'mjlfinancement_report';
	public $picto = 'generic';
	public $isextrafieldmanaged = 0;
	public $ismultientitymanaged = 1;

	public $fields = array(
		'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'enabled' => 1, 'position' => 1, 'notnull' => 1, 'visible' => 0, 'noteditable' => 1, 'index' => 1),
		'entity' => array('type' => 'integer', 'label' => 'Entity', 'enabled' => 1, 'position' => 5, 'notnull' => 1, 'visible' => 0, 'default' => '1', 'index' => 1),
		'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'enabled' => 1, 'position' => 20, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'searchall' => 1, 'showoncombobox' => 1, 'validate' => 1),
		'name' => array('type' => 'varchar(255)', 'label' => 'Name', 'enabled' => 1, 'position' => 30, 'notnull' => 1, 'visible' => 1, 'searchall' => 1, 'validate' => 1),
		'scope' => array('type' => 'varchar(32)', 'label' => 'Scope', 'enabled' => 1, 'position' => 40, 'notnull' => 1, 'visible' => 1, 'validate' => 1),
		'expected_format' => array('type' => 'varchar(64)', 'label' => 'Format', 'enabled' => 1, 'position' => 50, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'filters' => array('type' => 'text', 'label' => 'Filters', 'enabled' => 1, 'position' => 60, 'notnull' => 0, 'visible' => 1, 'validate' => 1),
		'must_include' => array('type' => 'text', 'label' => 'MJLReportIncludes', 'enabled' => 1, 'position' => 70, 'notnull' => 0, 'visible' => 1, 'validate' => 1),
		'date_creation' => array('type' => 'datetime', 'label' => 'DateCreation', 'enabled' => 1, 'position' => 600, 'notnull' => 1, 'visible' => -2),
		'tms' => array('type' => 'timestamp', 'label' => 'DateModification', 'enabled' => 1, 'position' => 610, 'notnull' => 0, 'visible' => -2),
		'fk_user_creat' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserAuthor', 'enabled' => 1, 'position' => 620, 'notnull' => 1, 'visible' => -2),
		'fk_user_modif' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserModif', 'enabled' => 1, 'position' => 630, 'notnull' => -1, 'visible' => -2),
		'import_key' => array('type' => 'varchar(14)', 'label' => 'ImportId', 'enabled' => 1, 'position' => 1000, 'notnull' => -1, 'visible' => -2),
	);

	public $rowid;
	public $ref;
	public $name;
	public $scope;
	public $expected_format;
	public $filters;
	public $must_include;
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
