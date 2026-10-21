<?php

class CommonObject {}
class DoliDB {}
class MjlMonitoring {
	const SOURCE_LIMIT = 5242880;
	public static $activities = array();
	public static $facts = array();
	public static $rowsBySql = array();
	public static $role = 'AGENT_SAISIE';
	public static $date = '2026-10-07';
	public function __construct($db,$user,$entity) {}
	public function activities($filters) { return self::$activities; }
	public function reviewFacts($activities) { return self::$facts ?: $activities; }
	public function role() { return self::$role; }
	public function date() { return self::$date; }
	public function activityWhere($filters) { return 'a.entity=3'; }
	public function rows($sql) { foreach(self::$rowsBySql as$needle=>$rows)if(strpos($sql,$needle)!==false)return$rows;throw new RuntimeException('UNEXPECTED_QUERY'); }
	public function referenceChoices($includeTypes=false) { return array('partner_id'=>$this->rows('SELECT DISTINCT a.fk_partner'),'project_id'=>$this->rows('SELECT DISTINCT a.fk_project')); }
}
function mjl_scope_effective_role_code($user) { return 'AGENT_SAISIE'; }
function mjl_monitoring_activity_actions($activity,$role,$actorId,$date) { return array('edit'=>false,'review'=>$role==='AGENT_VERIFICATEUR','abandon'=>false,'return'=>false,'restore'=>false,'execution'=>false); }

define('DOL_DOCUMENT_ROOT', dirname(__DIR__, 2));
require_once __DIR__.'/../../custom/mjlfinancement/lib/monitoring/mjl_monitoring_read.lib.php';

function mjl_activity_read_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

class MjlActivityReadFakeDb extends DoliDB
{
	public $transaction_opened = 0;
	public $queries = array();
	public $fail = '';
	public $rollbackResult = true;
	public $budget = array('statement_time' => '11.5', 'row_wait' => '13', 'metadata_wait' => '17');
	public $objectRows = array();
	public $scalarRows = array();

	public function query($sql)
	{
		$this->queries[] = $sql;
		if (strpos($sql, 'SELECT @@session') === 0) return $this->fail === 'budget' ? false : 'budget';
		if ($this->fail === 'direct' && strpos($sql, 'SELECT ') === 0) return false;
		if (strpos($sql, 'SET SESSION max_statement_time=5') === 0 && $this->fail === 'set') return false;
		if (strpos($sql, 'SET TRANSACTION') === 0 && $this->fail === 'isolation') return false;
		if (strpos($sql, 'SET SESSION max_statement_time=11.5') === 0 && $this->fail === 'restore') return false;
		foreach ($this->objectRows as $needle=>$rows) if (strpos($sql,$needle)!==false) return 'objects:'.$needle;
		foreach ($this->scalarRows as $needle=>$rows) if (strpos($sql,$needle)!==false) return 'scalars:'.$needle;
		return true;
	}

	public function fetch_array($result) { return $result === 'budget' ? $this->budget : false; }
	public function fetch_object($result) {
		if (is_string($result)&&strpos($result,'objects:')===0) {$needle=substr($result,8);$row=array_shift($this->objectRows[$needle]);return $row?(object)$row:false;}
		return false;
	}
	public function fetch_row($result) {
		if (is_string($result)&&strpos($result,'scalars:')===0) {$needle=substr($result,8);$row=array_shift($this->scalarRows[$needle]);return $row===null?false:(array)$row;}
		return false;
	}
	public function prefix() { return 'llx_'; }
	public function escape($value) { return addslashes($value); }
	public function free($result) {}
	public function begin($label) { if ($this->fail === 'begin') return false; $this->transaction_opened++; return true; }
	public function commit($label) { if ($this->fail === 'commit') return false; $this->transaction_opened--; return true; }
	public function rollback() { $this->transaction_opened = 0; return $this->rollbackResult; }
}

function mjl_activity_read_run($failure, $readFailure = false, $rollbackResult = true)
{
	$db = new MjlActivityReadFakeDb();
	$db->fail = $failure;
	$db->rollbackResult = $rollbackResult;
	$error = '';
	$value = null;
	try {
		$value = mjl_monitoring_read_snapshot($db, function () use ($readFailure) {
			if ($readFailure) throw new RuntimeException('QUERY_FAILED');
			return array('complete' => true);
		}, 'activity read', true);
	} catch (Throwable $exception) {
		$error = $exception->getMessage();
	}
	return array($db, $value, $error);
}

list($db, $value, $error) = mjl_activity_read_run('');
mjl_activity_read_assert($error === '' && $value === array('complete' => true), 'A complete snapshot must return only the complete value.');
mjl_activity_read_assert($db->transaction_opened === 0, 'A successful snapshot must close its transaction.');
mjl_activity_read_assert(end($db->queries) === 'SET SESSION max_statement_time=11.5,innodb_lock_wait_timeout=13,lock_wait_timeout=17', 'Every changed session budget must be restored exactly.');

foreach (array('begin', 'commit') as $failure) {
	list($db, $value, $error) = mjl_activity_read_run($failure);
	mjl_activity_read_assert($error === 'READ_FAILED' && $value === null, ucfirst($failure).' failure must expose no partial value.');
	mjl_activity_read_assert($db->transaction_opened === 0, ucfirst($failure).' failure must leave no open transaction.');
	mjl_activity_read_assert(strpos(end($db->queries), 'max_statement_time=11.5') !== false, ucfirst($failure).' failure must restore the session budget.');
}

list($db, $value, $error) = mjl_activity_read_run('', true);
mjl_activity_read_assert($error === 'QUERY_FAILED' && $value === null, 'Read failure must expose no partial value.');
mjl_activity_read_assert($db->transaction_opened === 0, 'Read failure must roll back the open snapshot.');
mjl_activity_read_assert(strpos(end($db->queries), 'max_statement_time=11.5') !== false, 'Read failure must restore the session budget.');

list($db, $value, $error) = mjl_activity_read_run('', true, false);
mjl_activity_read_assert($error === 'READ_ROLLBACK_FAILED', 'Rollback failure must be surfaced.');

list($db, $value, $error) = mjl_activity_read_run('restore');
mjl_activity_read_assert($error === 'READ_RESTORE_FAILED' && $value === null, 'Budget restoration failure must fail the whole read.');

$directReads=array(
 function($db){return mjl_monitoring_read_revision($db,3,41,9);},
 function($db){return mjl_monitoring_read_review_history($db,3,9);},
 function($db){return mjl_monitoring_read_agent_options($db,3);},
);
foreach($directReads as $read){
 $db=new MjlActivityReadFakeDb();$db->fail='direct';$error='';
 try{$read($db);}catch(Throwable $exception){$error=$exception->getMessage();}
 mjl_activity_read_assert($error==='READ_FAILED','A query failure must remain distinct from an empty result.');
}
print "MJL Activity read ownership contract passed.\n";
