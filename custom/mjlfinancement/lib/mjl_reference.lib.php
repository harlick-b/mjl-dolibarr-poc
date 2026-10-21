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

function mjl_reference_require_manage(User $targetUser)
{
	if (!mjl_reference_can_manage($targetUser)) {
		mjl_reference_forbidden();
	}
}

function mjl_reference_config($kind)
{
	$configs = array(
		'partner' => array('route' => 'partners', 'title' => 'Partenaires', 'singular' => 'Partenaire', 'field' => 'nom'),
		'project' => array('route' => 'projects', 'title' => 'Projets', 'singular' => 'Projet', 'field' => 'title'),
		'operation_type' => array('route' => 'operationtypes', 'title' => 'Types d’Opération', 'singular' => 'Type d’Opération', 'field' => 'label'),
	);
	if (!isset($configs[$kind])) mjl_reference_forbidden();
	return $configs[$kind];
}

function mjl_reference_fetch($kind, $id, $forUpdate = false)
{
	global $db, $conf;
	$id = (int) $id;
	if ($id <= 0) return array();
	if ($kind === 'partner') {
		$sql = 'SELECT rowid, entity, nom, status, tms FROM '.$db->prefix().'societe WHERE rowid = '.$id.' AND entity = '.((int) $conf->entity);
	} elseif ($kind === 'project') {
		$sql = 'SELECT p.rowid, p.entity, p.ref, p.title, p.fk_soc, p.fk_statut, p.tms, s.nom AS partner_name, s.status AS partner_status FROM '.$db->prefix().'projet p INNER JOIN '.$db->prefix().'societe s ON s.rowid = p.fk_soc AND s.entity = p.entity WHERE p.rowid = '.$id.' AND p.entity = '.((int) $conf->entity);
	} else {
		$sql = 'SELECT rowid, entity, label, is_active, tms FROM '.$db->prefix().'mjlfinancement_operation_type WHERE rowid = '.$id.' AND entity = '.((int) $conf->entity);
	}
	if ($forUpdate) $sql .= ' FOR UPDATE';
	$result = $db->query($sql);
	if (!$result || !($row = $db->fetch_object($result))) return array();
	return (array) $row;
}

function mjl_reference_is_active($kind, $row)
{
	if ($kind === 'partner') return (int) ($row['status'] ?? 0) === 1;
	if ($kind === 'project') return (int) ($row['fk_statut'] ?? 0) === Project::STATUS_VALIDATED;
	return (int) ($row['is_active'] ?? 0) === 1;
}

function mjl_reference_is_reader_visible($kind, $row)
{
	if (!mjl_reference_is_active($kind, $row)) return false;
	return $kind !== 'project' || (int) ($row['partner_status'] ?? 0) === 1;
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

function mjl_reference_check_fingerprint($kind, $row, $submitted)
{
	return is_string($submitted) && preg_match('/^[a-f0-9]{64}$/', $submitted) === 1 && hash_equals(mjl_reference_fingerprint($kind, $row), $submitted);
}

function mjl_reference_list($kind)
{
	global $db, $conf, $user;
	$includeInactive = mjl_reference_can_manage($user);
	if ($kind === 'partner') {
		$sql = 'SELECT rowid, nom AS label, status AS active FROM '.$db->prefix().'societe WHERE entity = '.((int) $conf->entity).($includeInactive ? '' : ' AND status = 1').' ORDER BY nom, rowid';
	} elseif ($kind === 'project') {
		$sql = 'SELECT p.rowid, p.title AS label, CASE WHEN p.fk_statut = '.Project::STATUS_VALIDATED.' THEN 1 ELSE 0 END AS active, s.nom AS parent_label FROM '.$db->prefix().'projet p INNER JOIN '.$db->prefix().'societe s ON s.rowid = p.fk_soc AND s.entity = p.entity WHERE p.entity = '.((int) $conf->entity).($includeInactive ? '' : ' AND p.fk_statut = '.Project::STATUS_VALIDATED.' AND s.status = 1').' ORDER BY p.title, p.rowid';
	} else {
		$sql = 'SELECT rowid, label, is_active AS active FROM '.$db->prefix().'mjlfinancement_operation_type WHERE entity = '.((int) $conf->entity).($includeInactive ? '' : ' AND is_active = 1').' ORDER BY label, rowid';
	}
	$result = $db->query($sql);
	if (!$result) return array();
	$rows = array();
	while ($row = $db->fetch_object($result)) $rows[] = (array) $row;
	return $rows;
}

function mjl_reference_active_partners()
{
	global $db, $conf;
	$result = $db->query('SELECT rowid, nom FROM '.$db->prefix().'societe WHERE entity = '.((int) $conf->entity).' AND status = 1 ORDER BY nom, rowid');
	$rows = array();
	if ($result) while ($row = $db->fetch_object($result)) $rows[] = (array) $row;
	return $rows;
}

function mjl_reference_label_from_request()
{
	return trim((string) GETPOST('label', 'restricthtml'));
}

/** Bounded reference projection; callers own HTTP and permission decisions. */
function mjl_reference_read_page($db, $entity, $includeInactive, $id = null, $page = 1)
{
	$where = 'entity='.(int) $entity.($includeInactive ? '' : ' AND status=1');
	if ($id !== null) $where .= ' AND rowid='.(int) $id;
	$result = $db->query('SELECT rowid,entity,nom,status,tms FROM '.$db->prefix().'societe WHERE '.$where.' ORDER BY nom,rowid LIMIT '.($id === null ? '51 OFFSET '.(((int) $page-1)*50) : '1'));
	if (!$result) throw new RuntimeException('Reference read unavailable.');
	$rows = array();
	while ($row = $db->fetch_object($result)) {
		$rows[] = array(
			'id' => (string) $row->rowid,
			'label' => (string) $row->nom,
			'active' => (int) $row->status === 1,
			'fingerprint' => mjl_reference_fingerprint('partner', (array) $row),
		);
	}
	return array('data' => array_slice($rows, 0, 50), 'pagination' => array('page' => (int) $page, 'page_size' => 50, 'has_next' => count($rows) > 50));
}
