<?php

class MjlOperationType
{
	public $db;
	public $error = '';

	public function __construct($db)
	{
		$this->db = $db;
	}

	public function create($entity, $label, User $actor)
	{
		$sql = 'INSERT INTO '.$this->db->prefix().'mjlfinancement_operation_type (entity, label, is_active, date_creation, fk_user_creat) VALUES (';
		$sql .= ((int) $entity).", '".$this->db->escape($label)."', 1, NOW(), ".((int) $actor->id).')';
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			return -1;
		}
		return (int) $this->db->last_insert_id($this->db->prefix().'mjlfinancement_operation_type');
	}

	public function updateLabel($id, $entity, $label, User $actor)
	{
		$sql = 'UPDATE '.$this->db->prefix()."mjlfinancement_operation_type SET label = '".$this->db->escape($label)."', fk_user_modif = ".((int) $actor->id);
		$sql .= ' WHERE rowid = '.((int) $id).' AND entity = '.((int) $entity);
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			return -1;
		}
		return 1;
	}

	public function setActive($id, $entity, $active, User $actor)
	{
		$sql = 'UPDATE '.$this->db->prefix().'mjlfinancement_operation_type SET is_active = '.($active ? 1 : 0).', fk_user_modif = '.((int) $actor->id);
		$sql .= ' WHERE rowid = '.((int) $id).' AND entity = '.((int) $entity);
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			return -1;
		}
		return 1;
	}
}
