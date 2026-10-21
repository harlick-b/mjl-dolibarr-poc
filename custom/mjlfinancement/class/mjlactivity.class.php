<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';

/** Native object metadata. Business writes belong to MjlActivityCommand. */
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
		'fk_partner' => array('type' => 'integer', 'label' => 'Partner', 'notnull' => 1, 'visible' => 0),
		'fk_project' => array('type' => 'integer', 'label' => 'Project', 'notnull' => 1, 'visible' => 1),
		'name' => array('type' => 'varchar(255)', 'label' => 'Name', 'notnull' => 1, 'visible' => 1),
		'description' => array('type' => 'text', 'label' => 'Description', 'notnull' => 1, 'visible' => 0),
		'date_start' => array('type' => 'date', 'label' => 'DateStart', 'notnull' => 1, 'visible' => 1),
		'date_end' => array('type' => 'date', 'label' => 'DateEnd', 'notnull' => 1, 'visible' => 1),
		'draft_authorized_amount' => array('type' => 'integer', 'label' => 'AuthorizedAmount', 'notnull' => 1, 'visible' => 0),
		'first_submitted_amount' => array('type' => 'integer', 'label' => 'FirstSubmittedAmount', 'notnull' => 0, 'visible' => 0),
		'latest_validated_amount' => array('type' => 'integer', 'label' => 'LatestValidatedAmount', 'notnull' => 0, 'visible' => 0),
		'fk_current_revision' => array('type' => 'integer', 'label' => 'CurrentRevision', 'notnull' => 0, 'visible' => 0),
		'validation_status' => array('type' => 'varchar(40)', 'label' => 'Status', 'notnull' => 1, 'visible' => 1),
		'version' => array('type' => 'integer', 'label' => 'Version', 'notnull' => 1, 'visible' => 0),
	);

	public function __construct(DoliDB $db) { $this->db = $db; }

	public function create(User $user, $notrigger = 0) { return -1; }
	public function update(User $user, $notrigger = 0) { return -1; }
	public function delete(User $user, $notrigger = 0) { return -1; }
}
