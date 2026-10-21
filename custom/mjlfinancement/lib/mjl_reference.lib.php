<?php

require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
require_once DOL_DOCUMENT_ROOT.'/projet/class/project.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjloperationtype.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form_submission.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';
require_once __DIR__.'/../class/mjlreferencecommand.class.php';

function mjl_reference_forbidden($message = '')
{
	if (function_exists('http_response_code')) http_response_code(403);
	accessforbidden($message);
}

function mjl_reference_require_read(User $targetUser)
{
	if (!mjl_scope_user_has_active_business_role($targetUser)) {
		mjl_reference_forbidden();
	}
}

function mjl_reference_can_manage(User $targetUser)
{
	return mjl_scope_is_final_validator($targetUser);
}

function mjl_reference_config($kind)
{
	$configs = array(
		'partner' => array('route' => 'partners', 'title' => 'Partenaires', 'singular' => 'Partenaire', 'field' => 'nom', 'api' => 'partners', 'operation' => 'Partner'),
		'project' => array('route' => 'projects', 'title' => 'Projets', 'singular' => 'Projet', 'field' => 'title', 'api' => 'projects', 'operation' => 'Project'),
		'operation_type' => array('route' => 'operationtypes', 'title' => 'Types d’Opération', 'singular' => 'Type d’Opération', 'field' => 'label', 'api' => 'operation-types', 'operation' => 'OperationType'),
	);
	if (!isset($configs[$kind])) mjl_reference_forbidden();
	return $configs[$kind];
}

function mjl_reference_is_active($kind, $row)
{
	if ($kind === 'partner') return (int) ($row['status'] ?? 0) === 1;
	if ($kind === 'project') return (int) ($row['fk_statut'] ?? 0) === Project::STATUS_VALIDATED;
	return (int) ($row['is_active'] ?? 0) === 1;
}

function mjl_reference_fingerprint($kind, $row)
{
	$fields = $kind === 'partner'
		? array('rowid', 'entity', 'nom', 'status', 'tms')
		: ($kind === 'project' ? array('rowid', 'entity', 'ref', 'title', 'fk_soc', 'fk_statut', 'tms') : array('rowid', 'entity', 'label', 'is_active', 'tms'));
	$values = array();
	foreach ($fields as $field) $values[$field] = (string) ($row[$field] ?? '');
	return hash('sha256', json_encode($values));
}

/** Bounded reference projection; callers own HTTP and permission decisions. */
function mjl_reference_read_page($db, $entity, $includeInactive, $kind, $id = null, $page = 1, $partnerId = null)
{
	$entity = (int) $entity;
	if ($kind === 'partner') {
		$sql = 'SELECT rowid,entity,nom,status,tms FROM '.$db->prefix().'societe WHERE entity='.$entity.($includeInactive ? '' : ' AND status=1');
		$idColumn = 'rowid';
		$order = 'nom,rowid';
	} elseif ($kind === 'project') {
		$sql = 'SELECT p.rowid,p.entity,p.ref,p.title,p.fk_soc,p.fk_statut,p.tms,s.nom AS partner_name FROM '.$db->prefix().'projet p INNER JOIN '.$db->prefix().'societe s ON s.rowid=p.fk_soc AND s.entity=p.entity WHERE p.entity='.$entity.($includeInactive ? '' : ' AND p.fk_statut='.Project::STATUS_VALIDATED.' AND s.status=1');
		if ($partnerId !== null) $sql .= ' AND p.fk_soc='.(int) $partnerId;
		$idColumn = 'p.rowid';
		$order = 'p.title,p.rowid';
	} elseif ($kind === 'operation_type') {
		$sql = 'SELECT rowid,entity,label,is_active,tms FROM '.$db->prefix().'mjlfinancement_operation_type WHERE entity='.$entity.($includeInactive ? '' : ' AND is_active=1');
		$idColumn = 'rowid';
		$order = 'label,rowid';
	} else throw new InvalidArgumentException('Unknown reference kind.');
	if ($id !== null) $sql .= ' AND '.$idColumn.'='.(int) $id;
	$sql .= ' ORDER BY '.$order.' LIMIT '.($id === null ? '51 OFFSET '.(((int) $page-1)*50) : '1');
	$result = $db->query($sql);
	if (!$result) throw new RuntimeException('Reference read unavailable.');
	$rows = array();
	$field = mjl_reference_config($kind)['field'];
	while ($row = $db->fetch_object($result)) {
		$projection = array(
			'id' => (string) $row->rowid,
			'label' => (string) $row->$field,
			'active' => mjl_reference_is_active($kind, (array) $row),
			'fingerprint' => mjl_reference_fingerprint($kind, (array) $row),
		);
		if ($kind === 'project') {
			$projection['partner_id'] = (string) $row->fk_soc;
			$projection['partner_label'] = (string) $row->partner_name;
			$projection['ref'] = (string) $row->ref;
		}
		$rows[] = $projection;
	}
	return array('data' => array_slice($rows, 0, 50), 'pagination' => array('page' => (int) $page, 'page_size' => 50, 'has_next' => count($rows) > 50));
}
