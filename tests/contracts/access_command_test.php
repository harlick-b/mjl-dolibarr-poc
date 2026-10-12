<?php

class User
{
	public $id = 0;
	public $entity = 1;
	public $admin = 0;
	public $statut = 1;
	public $status = 1;
	private $db;

	public function __construct($db = null) { $this->db = $db; }
	public function fetch($id)
	{
		$this->id = (int) $id;
		$this->entity = $this->db ? $this->db->targetEntity : 1;
		$this->admin = $this->id === 1 ? 1 : 0;
		$this->statut = 1;
		$this->status = 1;
		return $this->id > 0 ? 1 : -1;
	}
}

class AccessResult
{
	public $rows;
	public $index = 0;
	public function __construct(array $rows) { $this->rows = $rows; }
}

class AccessFakeDb
{
	public $beginResult = true;
	public $commitResult = true;
	public $rollbackResult = true;
	public $failureNeedle = '';
	public $beginCount = 0;
	public $commitCount = 0;
	public $rollbackCount = 0;
	public $closeCount = 0;
	public $mutationCount = 0;
	public $transaction_opened = 0;
	public $targetEntity = 1;
	public $activityTableCount = 0;
	public $activityAssignmentCount = 0;

	public function prefix() { return 'llx_'; }
	public function escape($value) { return addslashes((string) $value); }
	public function lasterror() { return 'injected database failure'; }
	public function begin($label = '') { $this->beginCount++; if ($this->beginResult) $this->transaction_opened++; return $this->beginResult ? 1 : 0; }
	public function commit($label = '') { $this->commitCount++; if ($this->commitResult && $this->transaction_opened > 0) $this->transaction_opened--; return $this->commitResult ? 1 : 0; }
	public function rollback($label = '') { $this->rollbackCount++; if ($this->rollbackResult && $this->transaction_opened > 0) $this->transaction_opened--; return $this->rollbackResult ? 1 : 0; }
	public function close() { $this->closeCount++; $this->transaction_opened = 0; }
	public function query($sql)
	{
		if (preg_match('/^(?:INSERT|UPDATE|DELETE)\b/i', ltrim($sql))) $this->mutationCount++;
		if ($this->failureNeedle !== '' && strpos($sql, $this->failureNeedle) !== false) return false;
		if (preg_match('/SELECT entity, admin, statut FROM llx_user WHERE rowid = ([0-9]+)/', $sql, $match)) {
			$id = (int) $match[1];
			return new AccessResult(array((object) array('entity' => 1, 'admin' => $id === 1 ? 1 : 0, 'statut' => 1)));
		}
		if (strpos($sql, 'SELECT rowid,entity,admin,statut FROM llx_user') !== false) {
			return new AccessResult(array((object) array('rowid' => 2, 'entity' => 1, 'admin' => 0, 'statut' => 1)));
		}
		if (strpos($sql, 'SELECT rowid,role_code FROM llx_mjlfinancement_user_role') !== false) return new AccessResult(array());
		if (strpos($sql, 'information_schema.TABLES') !== false) return new AccessResult(array((object) array('nb' => $this->activityTableCount)));
		if (strpos($sql, 'llx_mjlfinancement_activity_assignment') !== false) return new AccessResult(array((object) array('nb' => $this->activityAssignmentCount)));
		if (strpos($sql, 'SELECT id FROM llx_rights_def') !== false) return new AccessResult(array((object) array('id' => 91)));
		return new AccessResult(array());
	}
	public function fetch_object($result)
	{
		return isset($result->rows[$result->index]) ? $result->rows[$result->index++] : false;
	}
}

$accessAuditResult = 1;
function mjl_audit_append_in_transaction($db) { return $db->transaction_opened > 0 ? $GLOBALS['accessAuditResult'] : -1; }
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }

require dirname(__DIR__, 2).'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require dirname(__DIR__, 2).'/custom/mjlfinancement/class/mjlaccesscommand.class.php';

$conf = (object) array('entity' => 1);
$actor = new User();
$actor->id = 1;
$actor->admin = 1;

function newAccessDb()
{
	$db = new AccessFakeDb();
	$GLOBALS['db'] = $db;
	$GLOBALS['accessAuditResult'] = 1;
	return $db;
}

$db = newAccessDb();
$command = new MjlAccessCommand($db, 1);
$result = $command->assignProfile(2, 'AGENT_SAISIE', $actor, 'test', 'characterization');
check($result === array(1, 'Profil enregistré.'), 'profile assignment success contract changed');
check($db->beginCount === 1 && $db->commitCount === 1 && $db->rollbackCount === 0, 'profile transaction ownership changed');

$db = newAccessDb();
$nonAdmin = new User();
$nonAdmin->id = 2;
$result = (new MjlAccessCommand($db, 1))->assignProfile(2, 'AGENT_SAISIE', $nonAdmin);
check($result === array(-1, 'Action interdite.') && $db->beginCount === 0, 'Admin authorization guard changed');

$db = newAccessDb();
$result = (new MjlAccessCommand($db, 1))->assignProfile(2, 'UNKNOWN', $actor);
check($result === array(-1, 'Profil de production invalide.') && $db->beginCount === 0, 'role validation guard changed');

$db = newAccessDb();
$db->targetEntity = 2;
$result = (new MjlAccessCommand($db, 1))->assignProfile(2, 'AGENT_SAISIE', $actor);
check($result === array(-1, 'Utilisateur introuvable dans cette entite.') && $db->beginCount === 0, 'target entity guard changed');

$db = newAccessDb();
$db->activityTableCount = 1;
$db->activityAssignmentCount = 1;
$result = (new MjlAccessCommand($db, 1))->assignProfile(2, 'AGENT_VERIFICATEUR', $actor);
check($result === array(-1, 'Les affectations d’Activité doivent d’abord être retirées ou transférées.') && $db->rollbackCount === 1, 'Activity assignment guard changed');

$db = newAccessDb();
$db->beginResult = false;
$command = new MjlAccessCommand($db, 1);
$result = $command->assignProfile(2, 'AGENT_SAISIE', $actor, 'test', 'characterization');
check($result[0] < 0 && $db->mutationCount === 0 && $db->commitCount === 0 && $db->rollbackCount === 0, 'failed profile begin must stop before mutation');

$db = newAccessDb();
$db->commitResult = false;
$command = new MjlAccessCommand($db, 1);
$result = $command->assignProfile(2, 'AGENT_SAISIE', $actor, 'test', 'characterization');
check($result[0] < 0 && $db->rollbackCount === 1 && $db->transaction_opened === 0, 'profile commit failure must request rollback');

$db = newAccessDb();
$db->commitResult = false;
$db->rollbackResult = false;
$result = (new MjlAccessCommand($db, 1))->assignProfile(2, 'AGENT_SAISIE', $actor, 'test', 'characterization');
check($result[0] < 0 && $db->rollbackCount === 1 && $db->closeCount === 1, 'uncertain profile rollback must quarantine the connection');

foreach (array('UPDATE llx_mjlfinancement_user_role', 'INSERT INTO llx_mjlfinancement_user_role', 'SELECT id FROM llx_rights_def', 'INSERT INTO llx_user_rights', 'UPDATE llx_mjlfinancement_invitation', 'UPDATE llx_mjlfinancement_password_reset') as $needle) {
	$db = newAccessDb();
	$db->failureNeedle = $needle;
	$command = new MjlAccessCommand($db, 1);
	$result = $command->assignProfile(2, 'AGENT_SAISIE', $actor, 'test', 'characterization');
	check($result[0] < 0 && $db->rollbackCount === 1, 'profile fault must roll back for '.$needle);
}

$db = newAccessDb();
$accessAuditResult = -1;
$command = new MjlAccessCommand($db, 1);
$result = $command->assignProfile(2, 'AGENT_SAISIE', $actor, 'test', 'characterization');
check($result === array(-1, 'La journalisation de la modification des accès a échoué.') && $db->rollbackCount === 1, 'profile audit failure contract changed');

$db = newAccessDb();
$db->rollbackResult = false;
$accessAuditResult = -1;
$result = (new MjlAccessCommand($db, 1))->assignProfile(2, 'AGENT_SAISIE', $actor);
check($result[0] < 0 && $db->rollbackCount === 1 && $db->closeCount === 1 && $db->transaction_opened === 0, 'profile rollback failure must quarantine the connection');

$db = newAccessDb();
$command = new MjlAccessCommand($db, 1);
$result = $command->deactivate(2, $actor);
check($result === array(1, 'Acces desactive.'), 'deactivation success contract changed');
check($db->beginCount === 1 && $db->commitCount === 1 && $db->rollbackCount === 0, 'deactivation transaction ownership changed');

$db = newAccessDb();
$db->beginResult = false;
$result = (new MjlAccessCommand($db, 1))->deactivate(2, $actor);
check($result[0] < 0 && $db->mutationCount === 0 && $db->commitCount === 0 && $db->rollbackCount === 0, 'failed deactivation begin must stop before mutation');

foreach (array('UPDATE llx_user SET statut', 'UPDATE llx_mjlfinancement_user_role', 'UPDATE llx_mjlfinancement_invitation', 'UPDATE llx_mjlfinancement_password_reset', 'DELETE ur FROM llx_user_rights') as $needle) {
	$db = newAccessDb();
	$db->failureNeedle = $needle;
	$result = (new MjlAccessCommand($db, 1))->deactivate(2, $actor);
	check($result[0] < 0 && $db->rollbackCount === 1, 'deactivation fault must roll back for '.$needle);
}

$db = newAccessDb();
$accessAuditResult = -1;
$command = new MjlAccessCommand($db, 1);
$result = $command->deactivate(2, $actor);
check($result === array(-1, 'La journalisation de la désactivation a échoué.') && $db->rollbackCount === 1, 'deactivation audit failure contract changed');

$db = newAccessDb();
$db->transaction_opened = 1;
$command = new MjlAccessCommand($db, 1);
$result = $command->assignProfileInTransaction(2, 'AGENT_SAISIE', $actor, 'invitation', 'Invitation administrateur');
check($result === array(1, 'Profil enregistré.'), 'participant success contract changed');
check($db->beginCount === 0 && $db->commitCount === 0 && $db->rollbackCount === 0, 'participant must not control the caller transaction');
check($db->transaction_opened === 1, 'participant must leave the caller transaction open');

$db = newAccessDb();
$db->transaction_opened = 1;
$accessAuditResult = -1;
$command = new MjlAccessCommand($db, 1);
$result = $command->assignProfileInTransaction(2, 'AGENT_SAISIE', $actor, 'invitation', 'Invitation administrateur');
check($result[0] < 0 && $db->rollbackCount === 0, 'participant must return audit failure without rolling back the caller transaction');
check($db->transaction_opened === 1, 'failed participant must leave the caller transaction open');

print "access command characterization passed\n";
