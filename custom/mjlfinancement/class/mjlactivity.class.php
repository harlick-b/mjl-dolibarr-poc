<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/activity_schema_installer.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';

/** RST-005 target read model. Every business mutation remains dormant. */
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

	public function detectSchema()
	{
		return mjl_rst005_detect_schema($this->db);
	}

	/** Return the filtered active-entity read-only projection for one list page. */
	public function fetchReadProjection(User $reader, array $filters, $limit, $offset)
	{
		global $conf;
		$entity = (int) $conf->entity;
		$limit = (int) $limit;
		$offset = (int) $offset;
		if ($limit < 1 || $limit > 51 || $offset < 0) return false;
		if (!mjl_activity_access_can_enter_list($reader)) return false;
		$schema = $this->detectSchema();
		if (mjl_activity_access_assignment_schema_ready() || $schema === RST005_SCHEMA_TARGET) {
			$columns = 'a.rowid,a.ref,a.name,a.validation_status,p.ref AS project_ref,p.title AS project_title';
		} elseif ($schema === RST005_SCHEMA_PHASE1) {
			$columns = 'a.rowid,a.ref,a.label AS name,CAST(a.status AS CHAR) AS validation_status,p.ref AS project_ref,p.title AS project_title';
		} else {
			return false;
		}
		$sql = 'SELECT '.$columns.' FROM '.$this->db->prefix().'mjlfinancement_activity a';
		$sql .= ' INNER JOIN '.$this->db->prefix().'projet p ON p.rowid=a.fk_project AND p.entity=a.entity';
		if (mjl_scope_is_input_agent($reader, $entity)) {
			$sql .= ' INNER JOIN '.$this->db->prefix().'mjlfinancement_activity_assignment aa ON aa.entity=a.entity AND aa.fk_activity=a.rowid';
			$sql .= ' AND aa.fk_user='.((int) $reader->id).' AND aa.date_end IS NULL';
		}
		$sql .= ' WHERE a.entity='.$entity;
		if ($filters['status'] !== '') $sql .= " AND a.validation_status='".$this->db->escape($filters['status'])."'";
		if ($filters['project_id'] !== '') $sql .= ' AND p.rowid='.(int) $filters['project_id'].' AND p.entity='.$entity;
		if ($filters['q'] !== '') {
			$literal = str_replace(array('\\', '%', '_'), array('\\\\', '\\%', '\\_'), $filters['q']);
			$like = "'%".$this->db->escape($literal)."%' ESCAPE '\\\\'";
			$sql .= ' AND (a.ref LIKE '.$like.' OR a.name LIKE '.$like.' OR p.ref LIKE '.$like.' OR p.title LIKE '.$like.')';
		}
		$sql .= ' ORDER BY a.rowid DESC LIMIT '.$limit.' OFFSET '.$offset;
		$resql = $this->db->query($sql);
		if (!$resql) return false;
		$rows = array();
		while ($row = $this->db->fetch_object($resql)) $rows[] = $row;
		return $rows;
	}

	public function create(User $user, $notrigger = 0) { return -1; }
	public function update(User $user, $notrigger = 0) { return -1; }
	public function delete(User $user, $notrigger = 0) { return -1; }
}
