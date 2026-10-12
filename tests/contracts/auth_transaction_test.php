<?php

class User
{
	public $id = 0;
	public $admin = 0;
}

class AuthTransactionFakeDb
{
	public $beginResult = true;
	public $commitResult = true;
	public $rollbackResult = true;
	public $beginCount = 0;
	public $commitCount = 0;
	public $rollbackCount = 0;
	public $closeCount = 0;
	public $mutationCount = 0;

	public function prefix() { return 'llx_'; }
	public function begin($label = '') { $this->beginCount++; return $this->beginResult ? 1 : 0; }
	public function commit($label = '') { $this->commitCount++; return $this->commitResult ? 1 : 0; }
	public function rollback($label = '') { $this->rollbackCount++; return $this->rollbackResult ? 1 : 0; }
	public function close() { $this->closeCount++; }
	public function query($sql) { if (preg_match('/^(?:INSERT|UPDATE|DELETE)\b/i', ltrim($sql))) $this->mutationCount++; return (object) array(); }
	public function affected_rows($result) { return 1; }
}

function mjl_scope_is_platform_admin($actor, $entity) { return !empty($actor->admin) && (int) $entity === 1; }
function mjl_auth_now_sql() { return 'NOW()'; }
function mjl_auth_record_event() { return 1; }
function authTransactionCheck($condition, $message) { if (!$condition) throw new RuntimeException($message); }

require dirname(__DIR__, 2).'/custom/mjlfinancement/class/mjlauthcommand.class.php';

$conf = (object) array('global' => (object) array());
$actor = new User();
$actor->id = 1;
$actor->admin = 1;

$db = new AuthTransactionFakeDb();
$db->beginResult = false;
$result = (new MjlAuthCommand($db, $conf, 1, true, false))->revokeInvitation(12, $actor);
authTransactionCheck($result[0] < 0 && $db->mutationCount === 0 && $db->commitCount === 0 && $db->rollbackCount === 0, 'failed auth begin must stop before mutation');

$db = new AuthTransactionFakeDb();
$db->commitResult = false;
$result = (new MjlAuthCommand($db, $conf, 1, true, false))->revokeInvitation(12, $actor);
authTransactionCheck($result[0] < 0 && $db->rollbackCount === 1 && $db->closeCount === 0, 'auth commit failure must request rollback');

$db = new AuthTransactionFakeDb();
$db->commitResult = false;
$db->rollbackResult = false;
$command = new MjlAuthCommand($db, $conf, 1, true, false);
$result = $command->revokeInvitation(12, $actor);
authTransactionCheck($result[0] < 0 && $db->rollbackCount === 1 && $db->closeCount === 1, 'uncertain auth rollback must quarantine the connection');
$beginCount = $db->beginCount;
$mutationCount = $db->mutationCount;
$result = $command->revokeInvitation(12, $actor);
authTransactionCheck($result[0] < 0 && $db->beginCount === $beginCount && $db->mutationCount === $mutationCount, 'quarantined auth connection must not be reused');

print "auth transaction contract passed\n";
