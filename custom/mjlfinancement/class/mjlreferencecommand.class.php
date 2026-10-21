<?php

class MjlReferenceCommandForbidden extends RuntimeException
{
}

/** Deep command module for MJL reference writes. */
class MjlReferenceCommand
{
	private $db;
	private $actor;
	private $entity;
	private $outcomeCode = 'FAILED';
	public function outcomeCode() { return $this->outcomeCode; }

	public function __construct($db, User $actor, $entity)
	{
		$this->db = $db;
		$this->actor = $actor;
		$this->entity = (int) $entity;
	}

	public function create($kind, $label, $partnerId = 0)
	{
		$this->outcomeCode = 'FAILED';
		$this->requireManage();
		if ($label === '') { $this->outcomeCode='INVALID_INPUT'; return array(-1, 'Le libellé est obligatoire.'); }
		if (!$this->db->begin('RST-003 create')) return array(-1, 'Impossible d’enregistrer la référence.');
		if (!$this->lockCurrentManager()) {
			$this->outcomeCode='FORBIDDEN';
			$this->rollback('RST-003 create refused'); return array(-1, 'Votre rôle ne permet plus cette action.');
		}
		$id = -1;
		if ($kind === 'partner') {
			$object = new Societe($this->db);
			$object->name = $object->nom = $label;
			$object->entity = $this->entity;
			$object->status = 1;
			$object->client = 0;
			$object->fournisseur = 0;
			$id = $object->create($this->actor);
		} elseif ($kind === 'project') {
			$parent = $this->fetchReference('partner', (int) $partnerId, true);
			if (empty($parent) || !$this->isActive('partner', $parent)) {
				$this->outcomeCode='INACTIVE_PARENT';
				$this->rollback('RST-003 create invalid parent');
				return array(-1, 'Le Partenaire sélectionné doit être actif.');
			}
			for ($attempt = 0; $attempt < 3 && $id <= 0; $attempt++) {
				$object = new Project($this->db);
				$generatedRef = $this->projectRef();
				$object->ref = $generatedRef;
				$object->title = $label;
				$object->socid = $object->fk_soc = (int) $parent['rowid'];
				$object->entity = $this->entity;
				$object->public = 0;
				$object->status = Project::STATUS_VALIDATED;
				$id = $object->create($this->actor);
				if ($id <= 0 && !$this->projectRefExists($generatedRef)) break;
			}
		} else {
			$object = new MjlOperationType($this->db);
			$id = $object->create($this->entity, $label, $this->actor);
		}
		if ($id <= 0 || $this->audit($kind, $id, 'Actif', 'created', array('label' => array('before' => '', 'after' => $label))) <= 0) {
			$this->rollback('RST-003 create failed');
			return array(-1, 'Impossible d’enregistrer la référence.');
		}
		if (!$this->db->commit('RST-003 create')) {
			$this->outcomeCode='OUTCOME_UNKNOWN';
			$this->rollback('RST-003 create commit failed');
			return array(-1, 'Impossible d’enregistrer la référence.');
		}
		$this->outcomeCode='OK';
		return array($id, '');
	}

	public function updateLabel($kind, $id, $label, $fingerprint)
	{
		$this->outcomeCode = 'FAILED';
		$this->requireManage();
		if ($label === '') { $this->outcomeCode='INVALID_INPUT'; return 'Le libellé est obligatoire.'; }
		if (!$this->db->begin('RST-003 update')) return 'Impossible d’enregistrer la référence.';
		if (!$this->lockCurrentManager()) {
			$this->outcomeCode='FORBIDDEN';
			$this->rollback('RST-003 update refused'); return 'Votre rôle ne permet plus cette action.';
		}
		if ($kind === 'project') {
			list($parent, $row) = $this->lockProjectParentThenProject($id);
		} else {
			$row = $this->fetchReference($kind, $id, true);
		}
		if (empty($row)) {
			$this->outcomeCode='NOT_FOUND';
			$this->rollback('RST-003 update missing'); throw new MjlReferenceCommandForbidden();
		}
		if (!$this->checkFingerprint($kind, $row, $fingerprint)) {
			$this->outcomeCode='STALE_FINGERPRINT';
			$this->rollback('RST-003 update stale'); return 'Cette référence a été modifiée. Rechargez la page.';
		}
		$before = $row[$this->labelField($kind)];
		if ((string) $before === (string) $label) {
			if (!$this->db->commit('RST-003 update')) {
			$this->outcomeCode='OUTCOME_UNKNOWN';
				$this->rollback('RST-003 update commit failed');
				return 'Impossible d’enregistrer la référence.';
			}
			$this->outcomeCode='OK'; return '';
		}
		if ($kind === 'partner') {
			$object = new Societe($this->db);
			$result = $object->fetch((int) $id);
			if ($result > 0) {
				$object->name = $object->nom = $label;
				$result = $object->update(0, $this->actor);
			}
		} elseif ($kind === 'project') {
			$result = empty($parent) ? -1 : $this->updateProjectLabel($row, $label);
		} else {
			$object = new MjlOperationType($this->db);
			$result = $object->updateLabel($id, $this->entity, $label, $this->actor);
		}
		if ($result < 0 || $this->audit($kind, $id, $this->isActive($kind, $row) ? 'Actif' : 'Inactif', 'field_changed', array('label' => array('before' => $before, 'after' => $label))) <= 0) {
			$this->rollback('RST-003 update failed');
			return 'Impossible d’enregistrer la référence.';
		}
		if (!$this->db->commit('RST-003 update')) {
			$this->outcomeCode='OUTCOME_UNKNOWN';
			$this->rollback('RST-003 update commit failed');
			return 'Impossible d’enregistrer la référence.';
		}
		$this->outcomeCode='OK'; return '';
	}

	public function setActive($kind, $id, $active, $fingerprint)
	{
		$this->outcomeCode = 'FAILED';
		$this->requireManage();
		if (!$this->db->begin('RST-003 lifecycle')) return 'Impossible de modifier le statut.';
		if (!$this->lockCurrentManager()) {
			$this->outcomeCode='FORBIDDEN';
			$this->rollback('RST-003 lifecycle refused'); return 'Votre rôle ne permet plus cette action.';
		}
		if ($kind === 'project') {
			list($parent, $row) = $this->lockProjectParentThenProject($id);
		} else {
			$row = $this->fetchReference($kind, $id, true);
		}
		if (empty($row)) {
			$this->outcomeCode='NOT_FOUND';
			$this->rollback('RST-003 lifecycle missing'); throw new MjlReferenceCommandForbidden();
		}
		if (!$this->checkFingerprint($kind, $row, $fingerprint)) {
			$this->outcomeCode='STALE_FINGERPRINT';
			$this->rollback('RST-003 lifecycle stale'); return 'Cette référence a été modifiée. Rechargez la page.';
		}
		if ($this->isActive($kind, $row) === (bool) $active) {
			if (!$this->db->commit('RST-003 lifecycle')) {
			$this->outcomeCode='OUTCOME_UNKNOWN';
				$this->rollback('RST-003 lifecycle commit failed');
				return 'Impossible de modifier le statut.';
			}
			$this->outcomeCode='OK'; return '';
		}
		$result = -1;
		if ($kind === 'partner') {
			if (!$active) {
				$projectResult = $this->db->query('SELECT rowid FROM '.$this->db->prefix().'projet WHERE entity = '.$this->entity.' AND fk_soc = '.((int) $id).' AND fk_statut = '.Project::STATUS_VALIDATED.' ORDER BY rowid FOR UPDATE');
				if (!$projectResult) {
					$this->rollback('RST-003 lifecycle project lock failed');
					return 'Impossible de verrouiller les Projets.';
				}
				while ($projectRow = $this->db->fetch_object($projectResult)) {
					$project = new Project($this->db);
					if ($project->fetch((int) $projectRow->rowid) <= 0 || $project->setClose($this->actor) <= 0 || $this->audit('project', (int) $projectRow->rowid, 'Inactif', 'deactivated', array('active' => array('before' => 1, 'after' => 0))) <= 0) {
						$this->rollback('RST-003 lifecycle cascade failed');
						return 'Impossible de désactiver les Projets liés.';
					}
				}
			}
			$object = new Societe($this->db);
			$result = $object->fetch((int) $id);
			if ($result > 0) {
				$object->status = $active ? 1 : 0;
				$result = $object->update(0, $this->actor);
			}
		} elseif ($kind === 'project') {
			if (empty($parent) || ($active && !$this->isActive('partner', $parent))) {
				$this->outcomeCode='INACTIVE_PARENT';
				$this->rollback('RST-003 lifecycle inactive parent');
				return 'Le Partenaire du Projet doit être actif.';
			}
			$object = new Project($this->db);
			$result = $object->fetch((int) $id);
			if ($result > 0) {
				$result = $active ? $object->setValid($this->actor) : $object->setClose($this->actor);
				if (!$active && $result > 0 && (int) $object->status !== Project::STATUS_CLOSED) $result = -1;
			}
		} else {
			$object = new MjlOperationType($this->db);
			$result = $object->setActive($id, $this->entity, $active, $this->actor);
		}
		if ($result < 0 || $this->audit($kind, $id, $active ? 'Actif' : 'Inactif', $active ? 'activated' : 'deactivated', array('active' => array('before' => $active ? 0 : 1, 'after' => $active ? 1 : 0))) <= 0) {
			$this->rollback('RST-003 lifecycle failed');
			return 'Impossible de modifier le statut.';
		}
		if (!$this->db->commit('RST-003 lifecycle')) {
			$this->outcomeCode='OUTCOME_UNKNOWN';
			$this->rollback('RST-003 lifecycle commit failed');
			return 'Impossible de modifier le statut.';
		}
		$this->outcomeCode='OK'; return '';
	}

	private function lockCurrentManager()
	{
		$sql = 'SELECT rowid FROM '.$this->db->prefix().'mjlfinancement_user_role WHERE entity = '.$this->entity;
		$sql .= ' AND fk_user = '.((int) $this->actor->id)." AND role_code = 'VALIDATEUR_DEFINITIF' AND is_active = 1";
		$sql .= ' AND date_start <= NOW() AND (date_end IS NULL OR date_end >= NOW()) ORDER BY rowid LIMIT 1 FOR UPDATE';
		$result = $this->db->query($sql);
		return $result && $this->db->fetch_object($result);
	}

	private function requireManage()
	{
		if (!mjl_reference_can_manage($this->actor)) { $this->outcomeCode='FORBIDDEN'; throw new MjlReferenceCommandForbidden(); }
	}

	private function labelField($kind)
	{
		if ($kind === 'partner') return 'nom';
		if ($kind === 'project') return 'title';
		if ($kind === 'operation_type') return 'label';
		throw new MjlReferenceCommandForbidden();
	}

	private function fetchReference($kind, $id, $forUpdate = false)
	{
		$id = (int) $id;
		if ($id <= 0) return array();
		if ($kind === 'partner') {
			$sql = 'SELECT rowid, entity, nom, status, tms FROM '.$this->db->prefix().'societe WHERE rowid = '.$id.' AND entity = '.$this->entity;
		} elseif ($kind === 'project') {
			$sql = 'SELECT p.rowid, p.entity, p.ref, p.title, p.fk_soc, p.fk_statut, p.tms, s.nom AS partner_name, s.status AS partner_status FROM '.$this->db->prefix().'projet p INNER JOIN '.$this->db->prefix().'societe s ON s.rowid = p.fk_soc AND s.entity = p.entity WHERE p.rowid = '.$id.' AND p.entity = '.$this->entity;
		} elseif ($kind === 'operation_type') {
			$sql = 'SELECT rowid, entity, label, is_active, tms FROM '.$this->db->prefix().'mjlfinancement_operation_type WHERE rowid = '.$id.' AND entity = '.$this->entity;
		} else {
			throw new MjlReferenceCommandForbidden();
		}
		if ($forUpdate) $sql .= ' FOR UPDATE';
		$result = $this->db->query($sql);
		if (!$result) { $this->rollback('reference read failed'); throw new RuntimeException('Reference unavailable.'); }
		if (!($row = $this->db->fetch_object($result))) return array();
		return (array) $row;
	}

	private function isActive($kind, array $row)
	{
		if ($kind === 'partner') return (int) ($row['status'] ?? 0) === 1;
		if ($kind === 'project') return (int) ($row['fk_statut'] ?? 0) === Project::STATUS_VALIDATED;
		if ($kind === 'operation_type') return (int) ($row['is_active'] ?? 0) === 1;
		throw new MjlReferenceCommandForbidden();
	}

	private function fingerprint($kind, array $row)
	{
		$fields = $kind === 'partner'
			? array('rowid', 'entity', 'nom', 'status', 'tms')
			: ($kind === 'project' ? array('rowid', 'entity', 'ref', 'title', 'fk_soc', 'fk_statut', 'tms') : array('rowid', 'entity', 'label', 'is_active', 'tms'));
		$values = array();
		foreach ($fields as $field) $values[$field] = (string) ($row[$field] ?? '');
		return hash('sha256', json_encode($values));
	}

	private function checkFingerprint($kind, array $row, $submitted)
	{
		return is_string($submitted) && preg_match('/^[a-f0-9]{64}$/', $submitted) === 1 && hash_equals($this->fingerprint($kind, $row), $submitted);
	}

	private function audit($kind, $id, $status, $action, $changes)
	{
		$types = array('partner' => 'mjlfinancement_partner', 'project' => 'mjlfinancement_project', 'operation_type' => 'mjlfinancement_operation_type');
		return mjl_workflow_audit_insert($types[$kind], (int) $id, $this->entity, $status, $this->actor, 'VALIDATEUR_DEFINITIF', $action, 'Référence métier mise à jour', $changes, 'WFA-RST003');
	}

	private function rollback($label)
	{
		if ($this->db->rollback($label)) return true;
		$this->outcomeCode='OUTCOME_UNKNOWN';
		if (method_exists($this->db, 'close')) $this->db->close();
		return false;
	}

	private function projectRef()
	{
		return 'MJL-PROJET-'.strtoupper(bin2hex(random_bytes(16)));
	}

	private function projectRefExists($ref)
	{
		$result = $this->db->query('SELECT rowid FROM '.$this->db->prefix()."projet WHERE ref = '".$this->db->escape($ref)."' AND entity = ".$this->entity.' LIMIT 1');
		return $result && $this->db->fetch_object($result);
	}

	private function updateProjectLabel($row, $label)
	{
		$project = new Project($this->db);
		if ($project->fetch((int) $row['rowid']) <= 0) return -1;
		$project->title = $label;
		return $project->update($this->actor);
	}

	private function lockProjectParentThenProject($id)
	{
		$observed = $this->fetchReference('project', $id);
		if (empty($observed)) return array(array(), array());
		$parent = $this->fetchReference('partner', (int) $observed['fk_soc'], true);
		if (empty($parent)) return array(array(), array());
		$project = $this->fetchReference('project', $id, true);
		if (empty($project) || (int) $project['fk_soc'] !== (int) $parent['rowid']) return array(array(), array());
		return array($parent, $project);
	}
}
