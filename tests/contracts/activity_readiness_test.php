<?php

class DoliDB {}

define('DOL_DOCUMENT_ROOT', dirname(__DIR__, 2));
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_monitoring_access.lib.php';

function mjl_activity_readiness_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

class MjlActivityReadinessDb extends DoliDB
{
	public $queries=array();
	private $objects=array();
	public $fail='';
	public function __construct($tableCount=0,$fail='') {$this->objects=array((object)array('statement_time'=>'9.5'),(object)array('n'=>$tableCount));$this->fail=$fail;}
	public function query($sql) {$this->queries[]=$sql;if($this->fail==='probe'&&strpos($sql,'information_schema.TABLES')!==false)return false;if($this->fail==='restore'&&$sql==='SET SESSION max_statement_time=9.5')return false;return 'result';}
	public function fetch_object($result) {return array_shift($this->objects)?:false;}
	public function escape($value) {return addslashes($value);}
	public function prefix() {return 'llx_';}
}

$db=new MjlActivityReadinessDb();
$result=mjl_monitoring_readiness_probe($db,function(){throw new RuntimeException('Target assertion must not run for the predecessor.');});
mjl_activity_readiness_assert($result===0,'An absent target table must select the predecessor read owner.');
mjl_activity_readiness_assert($db->queries===array(
	'SELECT @@session.max_statement_time AS statement_time',
	'SET SESSION max_statement_time=5',
	"SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='llx_mjlfinancement_export_record'",
	'SET SESSION max_statement_time=9.5',
),'The readiness detector must perform only its bounded probe and restore the exact session budget.');

$targetChecked=false;$db=new MjlActivityReadinessDb(1);
$result=mjl_monitoring_readiness_probe($db,function($targetDb)use(&$targetChecked){$targetChecked=true;});
mjl_activity_readiness_assert($result===1&&$targetChecked,'A present, exact target must select the target read owner.');
mjl_activity_readiness_assert(end($db->queries)==='SET SESSION max_statement_time=9.5','Target readiness must restore the exact session budget.');

$db=new MjlActivityReadinessDb(1);
mjl_activity_readiness_assert(mjl_monitoring_readiness_probe($db,function(){throw new RuntimeException('TARGET_INVALID');})===-1,'A failed target assertion must select the unavailable state.');
mjl_activity_readiness_assert(end($db->queries)==='SET SESSION max_statement_time=9.5','A failed target assertion must still restore the exact session budget.');

$db=new MjlActivityReadinessDb(0,'probe');
mjl_activity_readiness_assert(mjl_monitoring_readiness_probe($db)===-1,'A failed table probe must select the unavailable state.');
mjl_activity_readiness_assert(end($db->queries)==='SET SESSION max_statement_time=9.5','A failed probe must still restore the exact session budget.');

$db=new MjlActivityReadinessDb(0,'restore');
mjl_activity_readiness_assert(mjl_monitoring_readiness_probe($db)===-1,'A failed budget restoration must override predecessor readiness with unavailable.');

print "MJL Activity readiness contract passed.\n";
