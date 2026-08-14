<?php

require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
require_once DOL_DOCUMENT_ROOT.'/projet/class/project.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjloperationtype.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form_submission.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';

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

function mjl_reference_lock_current_manager(User $targetUser)
{
	global $db, $conf;
	$sql = 'SELECT rowid FROM '.$db->prefix().'mjlfinancement_user_role WHERE entity = '.((int) $conf->entity);
	$sql .= ' AND fk_user = '.((int) $targetUser->id)." AND role_code = 'VALIDATEUR_DEFINITIF' AND is_active = 1";
	$sql .= ' AND date_start <= NOW() AND (date_end IS NULL OR date_end >= NOW()) ORDER BY rowid LIMIT 1 FOR UPDATE';
	$result = $db->query($sql);
	return $result && $db->fetch_object($result);
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

function mjl_reference_audit($kind, $id, $status, User $actor, $action, $changes)
{
	$types = array('partner' => 'mjlfinancement_partner', 'project' => 'mjlfinancement_project', 'operation_type' => 'mjlfinancement_operation_type');
	return mjl_workflow_audit_insert($types[$kind], (int) $id, (int) $GLOBALS['conf']->entity, $status, $actor, 'VALIDATEUR_DEFINITIF', $action, 'Référence métier mise à jour', $changes, 'WFA-RST003');
}

function mjl_reference_label_from_request()
{
	return trim((string) GETPOST('label', 'restricthtml'));
}

function mjl_reference_project_ref()
{
	return 'MJL-PROJET-'.strtoupper(bin2hex(random_bytes(16)));
}

function mjl_reference_project_ref_exists($ref, $entity)
{
	global $db;
	$result = $db->query('SELECT rowid FROM '.$db->prefix()."projet WHERE ref = '".$db->escape($ref)."' AND entity = ".((int) $entity).' LIMIT 1');
	return $result && $db->fetch_object($result);
}

function mjl_reference_create($kind, $label, $partnerId = 0)
{
	global $db, $conf, $user;
	mjl_reference_require_manage($user);
	if ($label === '') return array(-1, 'Le libellé est obligatoire.');
	$db->begin('RST-003 create');
	if (!mjl_reference_lock_current_manager($user)) {
		$db->rollback();
		return array(-1, 'Votre rôle ne permet plus cette action.');
	}
	$id = -1;
	if ($kind === 'partner') {
		$object = new Societe($db);
		$object->name = $object->nom = $label;
		$object->entity = (int) $conf->entity;
		$object->status = 1;
		$object->client = 0;
		$object->fournisseur = 0;
		$id = $object->create($user);
	} elseif ($kind === 'project') {
		$parent = mjl_reference_fetch('partner', (int) $partnerId, true);
		if (empty($parent) || !mjl_reference_is_active('partner', $parent)) {
			$db->rollback();
			return array(-1, 'Le Partenaire sélectionné doit être actif.');
		}
		for ($attempt = 0; $attempt < 3 && $id <= 0; $attempt++) {
			$object = new Project($db);
			$generatedRef = mjl_reference_project_ref();
			$object->ref = $generatedRef;
			$object->title = $label;
			$object->socid = $object->fk_soc = (int) $parent['rowid'];
			$object->entity = (int) $conf->entity;
			$object->public = 0;
			$object->status = Project::STATUS_VALIDATED;
			$id = $object->create($user);
			if ($id <= 0 && !mjl_reference_project_ref_exists($generatedRef, (int) $conf->entity)) break;
		}
	} else {
		$object = new MjlOperationType($db);
		$id = $object->create((int) $conf->entity, $label, $user);
	}
	if ($id <= 0 || mjl_reference_audit($kind, $id, 'Actif', $user, 'created', array('label' => array('before' => '', 'after' => $label))) <= 0) {
		$db->rollback();
		return array(-1, 'Impossible d’enregistrer la référence.');
	}
	$db->commit();
	return array($id, '');
}

function mjl_reference_project_update_label($row, $label)
{
	global $db, $user;
	$project = new Project($db);
	if ($project->fetch((int) $row['rowid']) <= 0) return -1;
	$project->title = $label;
	return $project->update($user);
}

function mjl_reference_project_lock_parent_then_project($id)
{
	$observed = mjl_reference_fetch('project', $id);
	if (empty($observed)) return array(array(), array());
	$parent = mjl_reference_fetch('partner', (int) $observed['fk_soc'], true);
	if (empty($parent)) return array(array(), array());
	$project = mjl_reference_fetch('project', $id, true);
	if (empty($project) || (int) $project['fk_soc'] !== (int) $parent['rowid']) return array(array(), array());
	return array($parent, $project);
}

function mjl_reference_update_label($kind, $id, $label, $fingerprint)
{
	global $db, $conf, $user;
	mjl_reference_require_manage($user);
	if ($label === '') return 'Le libellé est obligatoire.';
	$db->begin('RST-003 update');
	if (!mjl_reference_lock_current_manager($user)) {
		$db->rollback();
		return 'Votre rôle ne permet plus cette action.';
	}
	if ($kind === 'project') {
		list($parent, $row) = mjl_reference_project_lock_parent_then_project($id);
	} else {
		$row = mjl_reference_fetch($kind, $id, true);
	}
	if (empty($row)) {
		$db->rollback();
		mjl_reference_forbidden();
	}
	if (!mjl_reference_check_fingerprint($kind, $row, $fingerprint)) {
		$db->rollback();
		return 'Cette référence a été modifiée. Rechargez la page.';
	}
	$before = $row[mjl_reference_config($kind)['field']];
	if ((string) $before === (string) $label) {
		$db->commit();
		return '';
	}
	if ($kind === 'partner') {
		$object = new Societe($db);
		$result = $object->fetch((int) $id);
		if ($result > 0) {
			$object->name = $object->nom = $label;
			$result = $object->update(0, $user);
		}
	} elseif ($kind === 'project') {
		$result = empty($parent) ? -1 : mjl_reference_project_update_label($row, $label);
	} else {
		$object = new MjlOperationType($db);
		$result = $object->updateLabel($id, (int) $conf->entity, $label, $user);
	}
	if ($result < 0 || mjl_reference_audit($kind, $id, mjl_reference_is_active($kind, $row) ? 'Actif' : 'Inactif', $user, 'field_changed', array('label' => array('before' => $before, 'after' => $label))) <= 0) {
		$db->rollback();
		return 'Impossible d’enregistrer la référence.';
	}
	$db->commit();
	return '';
}

function mjl_reference_set_active($kind, $id, $active, $fingerprint)
{
	global $db, $conf, $user;
	mjl_reference_require_manage($user);
	$db->begin('RST-003 lifecycle');
	if (!mjl_reference_lock_current_manager($user)) {
		$db->rollback();
		return 'Votre rôle ne permet plus cette action.';
	}
	if ($kind === 'project') {
		list($parent, $row) = mjl_reference_project_lock_parent_then_project($id);
	} else {
		$row = mjl_reference_fetch($kind, $id, true);
	}
	if (empty($row)) {
		$db->rollback();
		mjl_reference_forbidden();
	}
	if (!mjl_reference_check_fingerprint($kind, $row, $fingerprint)) {
		$db->rollback();
		return 'Cette référence a été modifiée. Rechargez la page.';
	}
	if (mjl_reference_is_active($kind, $row) === (bool) $active) {
		$db->commit();
		return '';
	}
	$result = -1;
	if ($kind === 'partner') {
		if (!$active) {
			$projectResult = $db->query('SELECT rowid FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' AND fk_soc = '.((int) $id).' AND fk_statut = '.Project::STATUS_VALIDATED.' ORDER BY rowid FOR UPDATE');
			if (!$projectResult) {
				$db->rollback();
				return 'Impossible de verrouiller les Projets.';
			}
			while ($projectRow = $db->fetch_object($projectResult)) {
				$project = new Project($db);
				if ($project->fetch((int) $projectRow->rowid) <= 0 || $project->setClose($user) <= 0 || mjl_reference_audit('project', (int) $projectRow->rowid, 'Inactif', $user, 'deactivated', array('active' => array('before' => 1, 'after' => 0))) <= 0) {
					$db->rollback();
					return 'Impossible de désactiver les Projets liés.';
				}
			}
		}
		$object = new Societe($db);
		$result = $object->fetch((int) $id);
		if ($result > 0) {
			$object->status = $active ? 1 : 0;
			$result = $object->update(0, $user);
		}
	} elseif ($kind === 'project') {
		if (empty($parent) || ($active && !mjl_reference_is_active('partner', $parent))) {
			$db->rollback();
			return 'Le Partenaire du Projet doit être actif.';
		}
		$object = new Project($db);
		$result = $object->fetch((int) $id);
		if ($result > 0) {
			$result = $active ? $object->setValid($user) : $object->setClose($user);
			if (!$active && $result > 0 && (int) $object->status !== Project::STATUS_CLOSED) $result = -1;
		}
	} else {
		$object = new MjlOperationType($db);
		$result = $object->setActive($id, (int) $conf->entity, $active, $user);
	}
	if ($result < 0 || mjl_reference_audit($kind, $id, $active ? 'Actif' : 'Inactif', $user, $active ? 'activated' : 'deactivated', array('active' => array('before' => $active ? 0 : 1, 'after' => $active ? 1 : 0))) <= 0) {
		$db->rollback();
		return 'Impossible de modifier le statut.';
	}
	$db->commit();
	return '';
}
