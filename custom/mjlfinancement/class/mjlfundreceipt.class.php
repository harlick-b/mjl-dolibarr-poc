<?php

require_once DOL_DOCUMENT_ROOT.'/core/class/commonobject.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

class MjlFundReceipt extends CommonObject
{
	public $module = 'mjlfinancement';
	public $element = 'mjlfundreceipt';
	public $TRIGGER_PREFIX = 'MJLFINANCEMENT_FUNDRECEIPT';
	public $table_element = 'mjlfinancement_fund_receipt';
	public $picto = 'payment';
	public $isextrafieldmanaged = 0;
	public $ismultientitymanaged = 1;

	const STATUS_DRAFT = 0;
	const STATUS_RECEIVED = 1;
	const STATUS_NOT_RECEIVED = 8;

	public $fields = array(
		'rowid' => array('type' => 'integer', 'label' => 'TechnicalID', 'enabled' => 1, 'position' => 1, 'notnull' => 1, 'visible' => 0, 'noteditable' => 1, 'index' => 1),
		'entity' => array('type' => 'integer', 'label' => 'Entity', 'enabled' => 1, 'position' => 5, 'notnull' => 1, 'visible' => 0, 'default' => '1', 'index' => 1),
		'ref' => array('type' => 'varchar(128)', 'label' => 'Ref', 'enabled' => 1, 'position' => 20, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'searchall' => 1, 'showoncombobox' => 1, 'validate' => 1),
		'fk_soc' => array('type' => 'integer:Societe:societe/class/societe.class.php:1:((status:=:1) AND (entity:IN:__SHARED_ENTITIES__))', 'label' => 'MJLPTFBailleur', 'picto' => 'company', 'enabled' => 'isModEnabled("societe")', 'position' => 30, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_project' => array('type' => 'integer:Project:projet/class/project.class.php:1', 'label' => 'Project', 'picto' => 'project', 'enabled' => 'isModEnabled("project")', 'position' => 35, 'notnull' => -1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'fk_convention' => array('type' => 'integer:MjlConvention:mjlfinancement/class/mjlconvention.class.php:1', 'label' => 'MJLConvention', 'enabled' => 1, 'position' => 40, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'validate' => 1),
		'amount' => array('type' => 'price', 'label' => 'Amount', 'enabled' => 1, 'position' => 50, 'notnull' => 1, 'visible' => 1, 'isameasure' => 1, 'validate' => 1),
		'reception_date' => array('type' => 'date', 'label' => 'MJLReceptionDate', 'enabled' => 1, 'position' => 60, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'supporting_document' => array('type' => 'varchar(255)', 'label' => 'MJLSupportingDocument', 'enabled' => 1, 'position' => 70, 'notnull' => -1, 'visible' => 1, 'validate' => 1),
		'comment' => array('type' => 'text', 'label' => 'Comment', 'enabled' => 1, 'position' => 80, 'notnull' => 0, 'visible' => 1, 'validate' => 1),
		'status' => array('type' => 'integer', 'label' => 'Status', 'enabled' => 1, 'position' => 90, 'notnull' => 1, 'visible' => 1, 'index' => 1, 'default' => '0', 'arrayofkeyval' => array(0 => 'Draft', 1 => 'MJLRecorded', 8 => 'MJLNotReceived'), 'validate' => 1),
		'note_public' => array('type' => 'html', 'label' => 'NotePublic', 'enabled' => 1, 'position' => 500, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'note_private' => array('type' => 'html', 'label' => 'NotePrivate', 'enabled' => 1, 'position' => 510, 'notnull' => 0, 'visible' => 0, 'validate' => 1),
		'date_creation' => array('type' => 'datetime', 'label' => 'DateCreation', 'enabled' => 1, 'position' => 600, 'notnull' => 1, 'visible' => -2),
		'tms' => array('type' => 'timestamp', 'label' => 'DateModification', 'enabled' => 1, 'position' => 610, 'notnull' => 0, 'visible' => -2),
		'fk_user_creat' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserAuthor', 'enabled' => 1, 'position' => 620, 'notnull' => 1, 'visible' => -2),
		'fk_user_modif' => array('type' => 'integer:User:user/class/user.class.php', 'label' => 'UserModif', 'enabled' => 1, 'position' => 630, 'notnull' => -1, 'visible' => -2),
		'import_key' => array('type' => 'varchar(14)', 'label' => 'ImportId', 'enabled' => 1, 'position' => 1000, 'notnull' => -1, 'visible' => -2),
	);

	public $rowid;
	public $ref;
	public $fk_soc;
	public $socid;
	public $fk_project;
	public $fk_convention;
	public $amount;
	public $reception_date;
	public $supporting_document;
	public $comment;
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
		return $this->createDraft($user, $notrigger);
	}

	public function createDraft(User $user, $notrigger = 0)
	{
		$activeEntity = mjl_active_entity();
		if (!$this->canManage($user)) {
			$this->error = 'Permission denied for fund receipt creation';
			return -1;
		}
		if (empty($this->entity)) {
			$this->entity = $activeEntity;
		}
		if ((int) $this->entity !== $activeEntity) {
			$this->error = 'Fund receipt entity does not match active entity';
			return -1;
		}

		$this->status = self::STATUS_DRAFT;
		$this->amount = $this->amount === '' || $this->amount === null ? 0 : price2num($this->amount);
		$this->reception_date = $this->normalizeDateValue($this->reception_date);
		if (!$this->deriveLinksFromConvention((int) $this->fk_convention, $activeEntity, true)) {
			return -1;
		}
		if (!$this->validateDraftFields()) {
			return -1;
		}

		$this->db->begin();
		$result = $this->createCommon($user, $notrigger);
		if ($result <= 0) {
			$this->db->rollback();
			return $result;
		}
		$this->id = $result;
		$this->rowid = $result;
		if ($this->insertWorkflowAction(array(
			'rowid' => $result,
			'entity' => (int) $this->entity,
			'status' => self::STATUS_DRAFT,
			'import_key' => $this->import_key,
		), null, $this->statusLabel(self::STATUS_DRAFT), $user, 'created', 'Réception de fonds créée', array(
			'status' => array('before' => null, 'after' => $this->statusLabel(self::STATUS_DRAFT)),
		)) < 0) {
			$this->db->rollback();
			return -1;
		}
		$this->db->commit();
		return $result;
	}

	public function fetch($id, $ref = null, $noextrafields = 0, $nolines = 0)
	{
		return $this->fetchCommon($id, $ref, '', $noextrafields);
	}

	public function update(User $user, $notrigger = 0)
	{
		return $this->updateGovernedFields($user, array(
			'ref' => $this->ref,
			'fk_convention' => $this->fk_convention,
			'amount' => $this->amount,
			'reception_date' => $this->reception_date,
			'comment' => $this->comment,
			'note_public' => $this->note_public,
			'note_private' => $this->note_private,
		), 'Mise à jour réception de fonds', $notrigger);
	}

	public function updateGovernedFields(User $user, $fields, $comment = '', $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Missing fund receipt id';
			return -1;
		}
		if (!$this->canManage($user)) {
			$this->error = 'Permission denied for fund receipt update';
			return -1;
		}

		$this->db->begin();
		$current = $this->fetchCurrentForGovernance($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		$normalized = $this->normalizeGovernedFields($fields, (int) $current['entity']);
		if ($normalized === false) {
			$this->db->rollback();
			return -1;
		}
		if ((int) $current['status'] !== self::STATUS_DRAFT) {
			$blocked = array_keys($normalized);
			if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel($current['status']), $user, 'unsafe_edit_rejected', 'Modification refusée: réception déjà finalisée', array(
				'rejected_fields' => $blocked,
				'reason' => 'final_status',
			)) < 0) {
				$this->db->rollback();
				return -1;
			}
			$this->error = 'Finalized fund receipts cannot be edited';
			$this->db->commit();
			return -1;
		}

		$changes = array();
		$sets = array();
		foreach ($normalized as $field => $value) {
			$currentValue = array_key_exists($field, $current) ? $current[$field] : null;
			if ($this->valuesEqual($field, $currentValue, $value)) {
				continue;
			}
			$sets[] = $field.' = '.$this->sqlValueForField($field, $value);
			$changes[$field] = array(
				'before' => $this->historyValue($field, $currentValue),
				'after' => $this->historyValue($field, $value),
			);
		}

		if (empty($changes)) {
			$this->db->commit();
			return 0;
		}

		$sets[] = 'fk_user_modif = '.((int) $user->id);
		$sql = 'UPDATE '.$this->db->prefix().$this->table_element.' SET '.implode(', ', $sets);
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel($current['status']), $user, 'field_changed', $comment, $changes) < 0) {
			$this->db->rollback();
			return -1;
		}
		if (empty($notrigger)) {
			$result = $this->call_trigger('MJLFINANCEMENT_FUNDRECEIPT_FIELD_CHANGE', $user);
			if ($result < 0) {
				$this->db->rollback();
				return -1;
			}
		}
		$this->db->commit();
		return 1;
	}

	public function uploadProof(User $user, $file, $notrigger = 0)
	{
		global $conf;

		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Réception de fonds introuvable';
			return -1;
		}
		if (!$this->canManage($user) || (empty($user->admin) && !$user->hasRight('ecm', 'upload'))) {
			$this->error = 'Droit insuffisant pour ajouter une preuve de réception de fonds';
			return -1;
		}
		if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
			$this->error = 'Fichier manquant';
			return -1;
		}
		if (empty($conf->ecm->dir_output)) {
			$this->error = 'Repertoire ECM non configure';
			return -1;
		}

		$current = $this->fetchCurrentForGovernance($id, false);
		if (empty($current)) {
			return -1;
		}
		if ((int) $current['status'] !== self::STATUS_DRAFT) {
			$this->error = 'Une réception finalisée ne peut plus recevoir de nouvelle preuve documentaire';
			return -1;
		}

		$original = preg_replace('/[^A-Za-z0-9_.-]/', '_', basename((string) $file['name']));
		$original = trim($original, '._-');
		if ($original === '') {
			$original = 'document';
		}
		$filename = 'fundreceipt-'.$id.'-'.date('YmdHis').'-'.bin2hex(random_bytes(6)).'-'.$original;
		$filepath = 'mjlfinancement_fund_receipt';
		$targetDir = rtrim($conf->ecm->dir_output, '/').'/'.$filepath;
		if (!is_dir($targetDir)) {
			$mkdir = function_exists('dol_mkdir') ? dol_mkdir($targetDir) >= 0 : mkdir($targetDir, 0775, true);
			if (!$mkdir) {
				$this->error = 'Impossible de créer le répertoire ECM';
				return -1;
			}
		}
		if (!is_dir($targetDir)) {
			$this->error = 'Impossible de créer le répertoire ECM';
			return -1;
		}
		$target = $targetDir.'/'.$filename;
		if (file_exists($target)) {
			$this->error = 'Un fichier de même nom existe déjà';
			return -1;
		}
		if (!move_uploaded_file($file['tmp_name'], $target)) {
			$this->error = 'Impossible de deplacer le fichier upload';
			return -1;
		}

		$this->db->begin();
		$sql = 'INSERT INTO '.$this->db->prefix().'ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)';
		$sql .= ' VALUES (';
		$sql .= "'".$this->db->escape('MJL-FR-'.$id.'-'.$filename)."'";
		$sql .= ", '".$this->db->escape($filename)."'";
		$sql .= ', '.((int) $current['entity']);
		$sql .= ", '".$this->db->escape($filename)."'";
		$sql .= ", '".$this->db->escape($filepath)."'";
		$sql .= ", '".$this->db->escape($original)."'";
		$sql .= ", 'Preuve réception de fonds MJL'";
		$sql .= ', 1';
		$sql .= ", '".$this->db->idate(dol_now())."'";
		$sql .= ', '.((int) $user->id);
		$sql .= ", 'mjlfinancement_fund_receipt'";
		$sql .= ', '.$id;
		$sql .= ')';
		if (!$this->db->query($sql)) {
			$this->db->rollback();
			@unlink($target);
			$this->error = $this->db->lasterror();
			return -1;
		}
		$sql = 'UPDATE '.$this->db->prefix().$this->table_element;
		$sql .= " SET supporting_document = '".$this->db->escape($filename)."', fk_user_modif = ".((int) $user->id);
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);
		if (!$this->db->query($sql)) {
			$this->db->rollback();
			@unlink($target);
			$this->error = $this->db->lasterror();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel($current['status']), $user, 'proof_uploaded', 'Preuve documentaire ajoutée', array(
			'supporting_document' => array('before' => $current['supporting_document'], 'after' => $filename),
		)) < 0) {
			$this->db->rollback();
			@unlink($target);
			return -1;
		}
		if (empty($notrigger)) {
			$result = $this->call_trigger('MJLFINANCEMENT_FUNDRECEIPT_PROOF_UPLOAD', $user);
			if ($result < 0) {
				$this->db->rollback();
				@unlink($target);
				return -1;
			}
		}
		$this->db->commit();
		$this->supporting_document = $filename;
		return 1;
	}

	public function markReceived(User $user, $comment = '', $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		if ($id <= 0) {
			$this->error = 'Réception de fonds introuvable';
			return -1;
		}
		if (!$this->canManage($user)) {
			$this->error = 'Droit insuffisant pour changer le statut de la réception de fonds';
			return -1;
		}

		$this->db->begin();
		$current = $this->fetchCurrentForGovernance($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if ((int) $current['status'] !== self::STATUS_DRAFT) {
			$this->error = 'Seules les réceptions en brouillon peuvent être marquées comme reçues';
			$this->db->rollback();
			return -1;
		}
		if (!$this->assertCurrentLinks($current, true)) {
			$this->db->rollback();
			return -1;
		}
		if ((float) $current['amount'] <= 0) {
			$this->error = 'Le montant doit être supérieur à zéro avant de marquer les fonds comme reçus';
			$this->db->rollback();
			return -1;
		}
		if (empty($current['reception_date'])) {
			$this->error = 'La date de réception est obligatoire avant de marquer les fonds comme reçus';
			$this->db->rollback();
			return -1;
		}
		if (mjl_fund_receipt_evidence_state($id, (int) $current['entity'], $current['supporting_document']) !== 'downloadable') {
			$this->error = 'Une preuve documentaire téléchargeable est obligatoire avant de marquer les fonds comme reçus';
			$this->db->rollback();
			return -1;
		}

		$sql = 'UPDATE '.$this->db->prefix().$this->table_element;
		$sql .= ' SET status = '.self::STATUS_RECEIVED.', fk_user_modif = '.((int) $user->id);
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel(self::STATUS_RECEIVED), $user, 'received', $comment, array(
			'status' => array('before' => $this->statusLabel($current['status']), 'after' => $this->statusLabel(self::STATUS_RECEIVED)),
		)) < 0) {
			$this->db->rollback();
			return -1;
		}
		if (empty($notrigger)) {
			$result = $this->call_trigger('MJLFINANCEMENT_FUNDRECEIPT_RECEIVED', $user);
			if ($result < 0) {
				$this->db->rollback();
				return -1;
			}
		}
		$this->status = self::STATUS_RECEIVED;
		$this->db->commit();
		return 1;
	}

	public function markNotReceived(User $user, $comment = '', $notrigger = 0)
	{
		$id = (int) ($this->id ?: $this->rowid);
		$comment = trim((string) $comment);
		if ($id <= 0) {
			$this->error = 'Réception de fonds introuvable';
			return -1;
		}
		if ($comment === '') {
			$this->error = 'Un motif est obligatoire pour marquer les fonds comme non reçus';
			return -1;
		}
		if (!$this->canManage($user)) {
			$this->error = 'Droit insuffisant pour changer le statut de la réception de fonds';
			return -1;
		}

		$this->db->begin();
		$current = $this->fetchCurrentForGovernance($id, true);
		if (empty($current)) {
			$this->db->rollback();
			return -1;
		}
		if ((int) $current['status'] !== self::STATUS_DRAFT) {
			$this->error = 'Seules les réceptions en brouillon peuvent être marquées comme non reçues';
			$this->db->rollback();
			return -1;
		}
		if (!$this->assertCurrentLinks($current, true)) {
			$this->db->rollback();
			return -1;
		}

		$sql = 'UPDATE '.$this->db->prefix().$this->table_element;
		$sql .= ' SET status = '.self::STATUS_NOT_RECEIVED.', amount = 0, comment = \''.$this->db->escape($comment).'\', fk_user_modif = '.((int) $user->id);
		$sql .= ' WHERE rowid = '.$id.' AND entity = '.((int) $current['entity']);
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			$this->db->rollback();
			return -1;
		}
		if ($this->insertWorkflowAction($current, $this->statusLabel($current['status']), $this->statusLabel(self::STATUS_NOT_RECEIVED), $user, 'not_received', $comment, array(
			'status' => array('before' => $this->statusLabel($current['status']), 'after' => $this->statusLabel(self::STATUS_NOT_RECEIVED)),
			'amount' => array('before' => $this->historyValue('amount', $current['amount']), 'after' => '0'),
		)) < 0) {
			$this->db->rollback();
			return -1;
		}
		if (empty($notrigger)) {
			$result = $this->call_trigger('MJLFINANCEMENT_FUNDRECEIPT_NOT_RECEIVED', $user);
			if ($result < 0) {
				$this->db->rollback();
				return -1;
			}
		}
		$this->status = self::STATUS_NOT_RECEIVED;
		$this->amount = 0;
		$this->comment = $comment;
		$this->db->commit();
		return 1;
	}

	public function delete(User $user, $notrigger = 0)
	{
		$this->error = 'La suppression des réceptions de fonds n’est pas prise en charge';
		return -1;
	}

	private function canManage(User $user)
	{
		return mjl_workspace_can_access_supervision($user) && mjl_user_has_right($user, 'mjlfinancement', 'fundreceipt', 'write');
	}

	private function validateDraftFields()
	{
		if (trim((string) $this->ref) === '') {
			$this->error = 'La référence de réception est obligatoire';
			return false;
		}
		if ((int) $this->fk_convention <= 0 || (int) $this->fk_soc <= 0 || (int) $this->fk_project <= 0) {
			$this->error = 'Une convention active avec PTF et projet est obligatoire';
			return false;
		}
		if ((float) $this->amount < 0) {
			$this->error = 'Le montant de réception ne peut pas être négatif';
			return false;
		}
		return true;
	}

	private function fetchCurrentForGovernance($id, $forUpdate = false)
	{
		$sql = 'SELECT rowid, entity, ref, fk_soc, fk_project, fk_convention, amount, reception_date, supporting_document, comment, status, note_public, note_private, fk_user_creat, import_key';
		$sql .= ' FROM '.$this->db->prefix().$this->table_element;
		$sql .= ' WHERE rowid = '.((int) $id).' AND entity = '.mjl_active_entity();
		if ($forUpdate) {
			$sql .= ' FOR UPDATE';
		}
		$resql = $this->db->query($sql);
		if (!$resql) {
			$this->error = $this->db->lasterror();
			return array();
		}
		$obj = $this->db->fetch_object($resql);
		if (!$obj) {
			$this->error = 'Réception de fonds introuvable';
			return array();
		}
		return (array) $obj;
	}

	private function normalizeGovernedFields($fields, $entity)
	{
		$allowed = array('ref', 'fk_convention', 'amount', 'reception_date', 'comment', 'note_public', 'note_private');
		$normalized = array();
		foreach ($allowed as $field) {
			if (!array_key_exists($field, $fields)) {
				continue;
			}
			$value = $fields[$field];
			if ($field === 'ref') {
				$value = trim((string) $value);
			} elseif ($field === 'fk_convention') {
				$value = (int) $value;
			} elseif ($field === 'amount') {
				$value = $value === '' || $value === null ? 0 : price2num($value);
				if ((float) $value < 0) {
					$this->error = 'Le montant de réception ne peut pas être négatif';
					return false;
				}
			} elseif ($field === 'reception_date') {
				$value = $this->normalizeDateValue($value);
			} else {
				$value = (string) $value;
			}
			$normalized[$field] = $value;
		}
		if (isset($normalized['ref']) && $normalized['ref'] === '') {
			$this->error = 'La référence de réception est obligatoire';
			return false;
		}
		if (isset($normalized['fk_convention'])) {
			$links = $this->linksForConvention((int) $normalized['fk_convention'], $entity, true);
			if (empty($links)) {
				return false;
			}
			$normalized['fk_soc'] = (int) $links['fk_soc'];
			$normalized['fk_project'] = (int) $links['fk_project'];
		}
		return $normalized;
	}

	private function deriveLinksFromConvention($conventionId, $entity, $requireActive)
	{
		$links = $this->linksForConvention($conventionId, $entity, $requireActive);
		if (empty($links)) {
			return false;
		}
		$this->fk_convention = (int) $links['rowid'];
		$this->fk_soc = (int) $links['fk_soc'];
		$this->fk_project = (int) $links['fk_project'];
		return true;
	}

	private function linksForConvention($conventionId, $entity, $requireActive)
	{
		$conventionId = (int) $conventionId;
		if ($conventionId <= 0) {
			$this->error = 'Une convention active est obligatoire';
			return array();
		}
		$sql = 'SELECT c.rowid, c.fk_soc, c.fk_project, c.status';
		$sql .= ' FROM '.$this->db->prefix().'mjlfinancement_convention c';
		$sql .= ' INNER JOIN '.$this->db->prefix().'societe s ON s.rowid = c.fk_soc';
		$sql .= ' INNER JOIN '.$this->db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
		$sql .= ' WHERE c.rowid = '.$conventionId.' AND c.entity = '.((int) $entity);
		$row = mjl_integrity_fetch_row($sql);
		if (empty($row)) {
			$this->error = 'Convention introuvable dans l’entité active ou sans PTF/projet';
			return array();
		}
		if ($requireActive && (int) $row['status'] !== MjlConvention::STATUS_ACTIVE) {
			$this->error = 'La convention doit être active pour les réceptions de fonds';
			return array();
		}
		if ((int) $row['fk_soc'] <= 0 || (int) $row['fk_project'] <= 0) {
			$this->error = 'La convention doit avoir un PTF et un projet pour les réceptions de fonds';
			return array();
		}
		return $row;
	}

	private function assertCurrentLinks($current, $requireActive)
	{
		$links = $this->linksForConvention((int) $current['fk_convention'], (int) $current['entity'], $requireActive);
		if (empty($links)) {
			return false;
		}
		if ((int) $current['fk_soc'] !== (int) $links['fk_soc'] || (int) $current['fk_project'] !== (int) $links['fk_project']) {
			$this->error = 'Les rattachements de la réception ne correspondent pas à la convention sélectionnée';
			return false;
		}
		return true;
	}

	private function insertWorkflowAction($current, $fromStatusLabel, $toStatusLabel, User $user, $action, $comment, $changes)
	{
		$id = (int) $current['rowid'];
		$actionDate = dol_now();
		$ref = 'WFA-FR-'.$id.'-'.date('YmdHis', $actionDate).'-'.substr(str_replace('.', '', (string) microtime(true)), -6).'-'.((int) $user->id).'-'.strtoupper(substr(preg_replace('/[^a-z0-9]/i', '', $action), 0, 8));
		$sql = 'INSERT INTO '.$this->db->prefix().'mjlfinancement_workflow_action';
		$sql .= ' (entity, ref, object_type, object_id, action, from_status, to_status, actor, actor_role, action_date, reason, comment, changes_json, date_creation, fk_user_creat, import_key)';
		$sql .= ' VALUES (';
		$sql .= ((int) $current['entity']);
		$sql .= ", '".$this->db->escape($ref)."'";
		$sql .= ", 'mjlfinancement_fund_receipt'";
		$sql .= ', '.$id;
		$sql .= ", '".$this->db->escape($action)."'";
		$sql .= ', '.mjl_integrity_sql_string($fromStatusLabel);
		$sql .= ', '.mjl_integrity_sql_string($toStatusLabel);
		$sql .= ', '.((int) $user->id);
		$sql .= ", '".$this->db->escape($this->actorRole($user))."'";
		$sql .= ", '".$this->db->idate($actionDate)."'";
		$sql .= ', '.mjl_integrity_sql_string($comment);
		$sql .= ', '.mjl_integrity_sql_string($comment);
		$sql .= ", '".$this->db->escape(json_encode($changes))."'";
		$sql .= ", '".$this->db->idate(dol_now())."'";
		$sql .= ', '.((int) $user->id);
		$sql .= ', '.mjl_integrity_sql_string($current['import_key']);
		$sql .= ')';
		if (!$this->db->query($sql)) {
			$this->error = $this->db->lasterror();
			return -1;
		}
		return (int) $this->db->last_insert_id($this->db->prefix().'mjlfinancement_workflow_action');
	}

	private function actorRole(User $user)
	{
		return !empty($user->admin) ? 'ADMIN' : 'DPAF';
	}

	private function statusLabel($status)
	{
		$map = array(self::STATUS_DRAFT => 'draft', self::STATUS_RECEIVED => 'received', self::STATUS_NOT_RECEIVED => 'not_received');
		$status = (int) $status;
		return isset($map[$status]) ? $map[$status] : (string) $status;
	}

	private function normalizeDateValue($value)
	{
		if ($value === null || $value === '') {
			return null;
		}
		if (is_numeric($value)) {
			return date('Y-m-d', (int) $value);
		}
		$timestamp = strtotime((string) $value);
		return $timestamp > 0 ? date('Y-m-d', $timestamp) : null;
	}

	private function valuesEqual($field, $before, $after)
	{
		if ($field === 'reception_date') {
			return $this->normalizeDateValue($before) === $this->normalizeDateValue($after);
		}
		if ($field === 'amount') {
			return abs((float) $before - (float) $after) < 0.001;
		}
		return (string) $before === (string) $after;
	}

	private function sqlValueForField($field, $value)
	{
		if ($value === null || $value === '') {
			if (in_array($field, array('reception_date', 'comment', 'note_public', 'note_private'), true)) {
				return 'NULL';
			}
		}
		if (in_array($field, array('fk_soc', 'fk_project', 'fk_convention'), true)) {
			return (string) ((int) $value);
		}
		if ($field === 'amount') {
			return (string) price2num($value);
		}
		return "'".$this->db->escape((string) $value)."'";
	}

	private function historyValue($field, $value)
	{
		if ($field === 'amount') {
			return $value === null ? null : (string) price2num($value);
		}
		if (in_array($field, array('fk_soc', 'fk_project', 'fk_convention'), true)) {
			return $value === null || $value === '' ? null : (int) $value;
		}
		return $value;
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
