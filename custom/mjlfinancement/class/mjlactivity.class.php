<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';

/** Interim RST-002A read model. RST-005 owns its replacement. */
class MjlActivity extends CommonObject
{
	public $module = 'mjlfinancement';
	public $element = 'mjlactivity';
	public $table_element = 'mjlfinancement_activity';
	public $ismultientitymanaged = 1;
	public $isextrafieldmanaged = 0;
	public $fields = array(
		'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'notnull' => 1, 'visible' => 0),
		'entity' => array('type' => 'integer', 'label' => 'Entity', 'notnull' => 1, 'visible' => 0),
		'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'notnull' => 1, 'visible' => 1),
		'label' => array('type' => 'varchar(255)', 'label' => 'Label', 'notnull' => 1, 'visible' => 1),
		'fk_project' => array('type' => 'integer', 'label' => 'Project', 'notnull' => 1, 'visible' => 1),
		'status' => array('type' => 'integer', 'label' => 'Status', 'notnull' => 1, 'visible' => 1),
	);

	public function __construct(DoliDB $db) { $this->db = $db; }
	public function create(User $user, $notrigger = 0) { return -1; }
	public function update(User $user, $notrigger = 0) { return -1; }
	public function delete(User $user, $notrigger = 0) { return -1; }
}
