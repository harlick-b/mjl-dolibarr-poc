<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';

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
	const STATUS_VALIDATED = 1;
	const STATUS_CLOSED = 2;
	const STATUS_CANCELED = 9;

	public $fields = array(
		'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'enabled' => 1, 'position' => 1, 'notnull' => 1, 'visible' => 0, 'noteditable' => 1, 'index' => 1),
		'entity' => array('type' => 'integer', 'label' => 'Entity', 'enabled' => 1, 'position' => 5, 'notnull' => 1, 'visible' => 0, 'default' => '1', 'index' => 1),
		'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'enabled' => 1, 'position' => 20, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'searchall' => 1, 'showoncombobox' => 1, 'validate' => 1),
		'label' => array('type' => 'varchar(255)', 'label' => 'Label', 'enabled' => 1, 'position' => 30, 'notnull' => 0, 'visible' => 1, 'searchall' => 1, 'showoncombobox' => 2, 'validate' => 1),
		'fk_soc' => array('type' => 'integer:Societe:societe/class/societe.class.php:1:((status:=:1) AND (entity:IN:__SHARED_ENTITIES__))', 'label' => 'ThirdParty', 'picto' => 'company', 'enabled' => 'isModEnabled("societe")', 'position' => 40, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_project' => array('type' => 'integer:Project:projet/class/project.class.php:1', 'label' => 'Project', 'picto' => 'project', 'enabled' => 'isModEnabled("project")', 'position' => 50, 'notnull' => -1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'amount' => array('type' => 'price', 'label' => 'Amount', 'enabled' => 1, 'position' => 60, 'notnull' => 0, 'visible' => 1, 'isameasure' => 1, 'validate' => 1),
		'date_start' => array('type' => 'date', 'label' => 'DateStart', 'enabled' => 1, 'position' => 70, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'date_end' => array('type' => 'date', 'label' => 'DateEnd', 'enabled' => 1, 'position' => 80, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'note_public' => array('type' => 'html', 'label' => 'NotePublic', 'enabled' => 1, 'position' => 500, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'note_private' => array('type' => 'html', 'label' => 'NotePrivate', 'enabled' => 1, 'position' => 510, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'date_creation' => array('type' => 'datetime', 'label' => 'DateCreation', 'enabled' => 1, 'position' => 600, 'notnull' => 1, 'visible' => -2),
		'tms' => array('type' => 'timestamp', 'label' => 'DateModification', 'enabled' => 1, 'position' => 610, 'notnull' => 0, 'visible' => -2),
		'fk_user_creat' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserAuthor', 'enabled' => 1, 'position' => 620, 'notnull' => 1, 'visible' => -2),
		'fk_user_modif' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserModif', 'enabled' => 1, 'position' => 630, 'notnull' => -1, 'visible' => -2),
		'import_key' => array('type' => 'varchar(14)', 'label' => 'ImportId', 'enabled' => 1, 'position' => 1000, 'notnull' => -1, 'visible' => -2),
		'status' => array('type' => 'integer', 'label' => 'Status', 'enabled' => 1, 'position' => 2000, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'default' => '0', 'arrayofkeyval' => array(0 => 'Draft', 1 => 'Validated', 2 => 'Closed', 9 => 'Canceled'), 'validate' => 1),
	);

	public $rowid;
	public $ref;
	public $label;
	public $fk_soc;
	public $socid;
	public $fk_project;
	public $amount;
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
