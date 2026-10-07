<?php

class CommonObject {}
class DoliDB {}
class MjlActivity {
	public static $result = array();
	public function __construct($db) {}
	public function fetchReadProjection($user,$filters,$limit,$offset) { return self::$result; }
}
class MjlActivityAssignment {}
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
	function($db){return mjl_monitoring_read_activity($db,3,41);},
	function($db){return mjl_monitoring_read_operations($db,3,41);},
	function($db){return mjl_monitoring_read_revision($db,3,41,9);},
	function($db){return mjl_monitoring_read_review_history($db,3,9);},
	function($db){return mjl_monitoring_read_reference_options($db,3,'societe','nom',0);},
	function($db){return mjl_monitoring_read_type_options($db,3,0);},
	function($db){return mjl_monitoring_read_agent_options($db,3);},
);
foreach($directReads as$index=>$read){$db=new MjlActivityReadFakeDb();$db->fail='direct';$error='';try{$read($db);}catch(Throwable $exception){$error=$exception->getMessage();}mjl_activity_read_assert($error==='READ_FAILED','Direct read '.($index+1).' must distinguish query failure from an empty result.');}

$user=(object)array('id'=>17);
$filters=array('q'=>'','status'=>'','project_id'=>'','page'=>1);
$db=new MjlActivityReadFakeDb();
$db->objectRows=array(
	'SELECT a.*,s.nom'=>array(array('rowid'=>41,'entity'=>3,'partner_name'=>'Partenaire','project_title'=>'Projet')),
	'SELECT o.*,t.label'=>array(array('rowid'=>8,'fk_activity'=>41,'type_label'=>'Atelier')),
	'SELECT * FROM llx_mjlfinancement_activity_revision'=>array(array('rowid'=>9,'fk_activity'=>41)),
	'SELECT stage,decision_type'=>array(array('stage'=>'SUPERVISOR','decision_type'=>'PREVALIDATED'),array('stage'=>'FINAL','decision_type'=>'FINAL_VALIDATED')),
	'SELECT rowid,title AS label'=>array(array('rowid'=>4,'label'=>'Projet','partner_id'=>2)),
	'SELECT rowid,label FROM llx_mjlfinancement_operation_type'=>array(array('rowid'=>5,'label'=>'Atelier')),
	'SELECT u.rowid,u.login'=>array(array('rowid'=>17,'login'=>'agent','firstname'=>'A','lastname'=>'Gent')),
);
mjl_activity_read_assert(mjl_monitoring_read_activity($db,3,41)['partner_name']==='Partenaire','Activity read must preserve the joined scoped row shape.');
mjl_activity_read_assert(count(mjl_monitoring_read_operations($db,3,41))===1,'Operation read must preserve ordered scoped rows.');
mjl_activity_read_assert(mjl_monitoring_read_revision($db,3,41,9)['rowid']===9,'Revision read must bind the Activity and revision.');
mjl_activity_read_assert(array_column(mjl_monitoring_read_review_history($db,3,9),'stage')===array('SUPERVISOR','FINAL'),'Review history must preserve chronological rows.');
mjl_activity_read_assert(mjl_monitoring_read_reference_options($db,3,'projet','title',4)[0]['partner_id']===2,'Project choices must preserve parent data.');
mjl_activity_read_assert(mjl_monitoring_read_type_options($db,3,5)[0]['label']==='Atelier','Type choices must preserve their selected option shape.');
mjl_activity_read_assert(mjl_monitoring_read_agent_options($db,3)[0]['login']==='agent','Agent choices must preserve eligible Agent identity fields.');

$db=new MjlActivityReadFakeDb();$db->scalarRows=array('revision_contributor'=>array(array(1)),'review_decision'=>array(array(29)));
$facts=mjl_monitoring_read_fallback_review_facts($db,3,9,17);
mjl_activity_read_assert($facts===array('is_contributor'=>true,'prevalidator_id'=>29),'Fallback review facts must preserve scoped contributor and prevalidator values.');
mjl_activity_read_assert(strpos($db->queries[0],'entity=3')!==false&&strpos($db->queries[0],'fk_revision=9')!==false&&strpos($db->queries[0],'fk_user=17')!==false,'Contributor facts must bind entity, revision, and actor.');

MjlMonitoring::$activities=array(array('rowid'=>41,'date_start'=>'2026-10-08','validation_status'=>'FINAL_VALIDATED','fk_current_revision'=>9,'is_cancelled'=>0,'assignments'=>array(array('fk_user'=>17))));
MjlMonitoring::$rowsBySql=array('SELECT COUNT(*)'=>array(array('n'=>1,'bytes'=>64)),'SELECT DISTINCT a.fk_partner'=>array(array('id'=>2,'label'=>'Partenaire')),'SELECT DISTINCT a.fk_project'=>array(array('id'=>4,'label'=>'Projet')));
$target=mjl_monitoring_read_activity_list(new MjlActivityReadFakeDb(),$user,3,$filters,1);
mjl_activity_read_assert($target['mode']==='target'&&$target['rows'][0]['rowid']===41&&$target['choices']['partner_id'][0]['id']===2,'Target list orchestration must return its selected rows and scoped choices.');
MjlMonitoring::$facts=array(array('rowid'=>41,'date_start'=>'2026-10-08','validation_status'=>'SUBMITTED','fk_current_revision'=>9,'is_cancelled'=>0,'assignments'=>array(),'contributors'=>array(18),'prevalidator_id'=>null));
$context=mjl_monitoring_read_activity_context(new MjlActivityReadFakeDb(),$user,3,array('rowid'=>41));
mjl_activity_read_assert($context['contributors']===array(18)&&isset($context['monitoring_actions']['review']),'Detail/review context must include review facts and prepared actions in one scoped snapshot.');

$db=new MjlActivityReadFakeDb();$db->scalarRows=array('mjlfinancement_export_record'=>array(array(1)));
mjl_activity_read_assert(mjl_monitoring_read_report_available($db)===true,'Report links must be enabled only when the retained export-table detector succeeds.');
$db=new MjlActivityReadFakeDb();$db->scalarRows=array('mjlfinancement_export_record'=>array(array(0)));
mjl_activity_read_assert(mjl_monitoring_read_report_available($db)===false,'Report links must remain hidden when the export table is absent.');

MjlActivity::$result=false;$error='';try{mjl_monitoring_read_activity_list(new MjlActivityReadFakeDb(),$user,3,$filters,0);}catch(Throwable $exception){$error=$exception->getMessage();}
mjl_activity_read_assert($error==='INVALID_FILTER','Fallback projection false must retain the stable invalid-filter outcome.');
MjlActivity::$result=array((object)array('rowid'=>41));$fallback=mjl_monitoring_read_activity_list(new MjlActivityReadFakeDb(),$user,3,$filters,0);
mjl_activity_read_assert($fallback['mode']==='fallback'&&count($fallback['rows'])===1,'Fallback readiness must retain its selected projection and row shape.');
$error='';try{mjl_monitoring_read_activity_list(new MjlActivityReadFakeDb(),$user,3,$filters,-1);}catch(Throwable $exception){$error=$exception->getMessage();}
mjl_activity_read_assert($error==='READ_FAILED','Unavailable readiness must fail without selecting a list owner.');

$source = file_get_contents(__DIR__.'/../../custom/mjlfinancement/lib/monitoring/mjl_monitoring_read.lib.php');
foreach (array('a.entity=', 'o.entity=', 'fk_revision=', 'fk_user=', 'ORDER BY date_decision,rowid', 'ORDER BY label,rowid') as $needle) {
	mjl_activity_read_assert(strpos($source, $needle) !== false, 'Scoped/read-order contract missing: '.$needle);
}

print "MJL Activity read ownership contract passed.\n";
