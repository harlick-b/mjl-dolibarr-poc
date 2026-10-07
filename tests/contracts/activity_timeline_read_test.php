<?php

class User {}

function mjl_activity_access_can_read_activity($user,$activityId) {return !empty($user->timeline_allowed)&&$activityId===41;}

define('DOL_DOCUMENT_ROOT', dirname(__DIR__, 2));
require_once __DIR__.'/../../custom/mjlfinancement/lib/audit/mjl_audit_timeline_read.lib.php';

function mjl_activity_timeline_assert($condition,$message)
{
	if($condition)return;
	fwrite(STDERR,"FAIL: ".$message."\n");
	exit(1);
}

class MjlActivityTimelineDb
{
	public $queries=array();
	public $fail=false;
	private $rows=array();
	public function __construct(array $rows=array()) {$this->rows=$rows;}
	public function prefix(){return 'llx_';}
	public function escape($value){return addslashes($value);}
	public function query($sql){$this->queries[]=$sql;if(strpos($sql,'FROM llx_user ')!==false)return 'user';return $this->fail?false:'events';}
	public function fetch_object($result){if($result==='user')return(object)array('entity'=>3,'admin'=>1,'statut'=>1);$row=array_shift($this->rows);return $row?(object)$row:false;}
}

$denied=new User();$denied->id=17;$denied->timeline_allowed=false;$denied->admin=1;
$db=new MjlActivityTimelineDb();
mjl_activity_timeline_assert(mjl_audit_timeline_read($db,$denied,3,41,'')===false&&$db->queries===array(),'Denied timeline reads must not reach the database.');

$allowed=new User();$allowed->id=17;$allowed->timeline_allowed=true;$allowed->admin=1;
$conf=(object)array('entity'=>3);
$db=new MjlActivityTimelineDb();
mjl_activity_timeline_assert(mjl_audit_timeline_read($db,$allowed,3,41,'0')===false,'Invalid timeline cursors must fail before querying events.');

$db=new MjlActivityTimelineDb(array(array('rowid'=>7,'event_date'=>'2026-10-07 10:00:00','action'=>'ACTIVITY_CREATED','operation_id'=>null,'actor_name_snapshot'=>'Agent','actor_role_snapshot'=>'AGENT_SAISIE','state_before'=>null,'state_after'=>'DRAFT','details_unavailable'=>0,'reason'=>null,'previous_values_json'=>'{}','new_values_json'=>'{}','context_json'=>'{}')));
$events=mjl_audit_timeline_read($db,$allowed,3,41,'');
mjl_activity_timeline_assert(count($events)===1&&$events[0]['rowid']===7,'Authorized timeline reads must return the bounded prepared event shape.');
$sql=end($db->queries);
mjl_activity_timeline_assert(strpos($sql,'entity=3')!==false&&strpos($sql,'activity_id=41')!==false&&strpos($sql,'LIMIT 51')!==false,'Timeline reads must bind entity and Activity and keep the 51-row bound.');
mjl_activity_timeline_assert(strpos($sql,"action<>'EXPORT_GENERATED'")!==false&&strpos($sql,"'$.activity_ids[0]'")!==false,'Timeline reads must retain the scoped export-event filter.');

$db=new MjlActivityTimelineDb();$db->fail=true;
mjl_activity_timeline_assert(mjl_audit_timeline_read($db,$allowed,3,41,'')===false,'Timeline query failure must expose no partial event list.');

print "MJL Activity timeline read contract passed.\n";
