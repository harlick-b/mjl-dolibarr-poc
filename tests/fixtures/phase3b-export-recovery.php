<?php

// Loaded only after the CLI/file/database sentinel checks in the report fixture.
if (!isset($sentinel,$request,$action) || !in_array($action,array('recovery','abandon'),true)) exit(2);

function mjl_recovery_barrier($marker="READY")
{
 print $marker."\n"; flush();
 $read=array(STDIN);$write=null;$except=null;
 if (stream_select($read,$write,$except,20)!==1 || trim(fgets(STDIN,32))!=='GO') throw new RuntimeException('TEST_BARRIER_TIMEOUT');
}

if ($action==='abandon') {
 require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';
 $res=$db->query('SELECT version FROM '.$db->prefix().'mjlfinancement_activity WHERE entity=1 AND rowid='.(int)$request['activityId']);
 $row=$res?$db->fetch_object($res):null;if (!$row) exit(3);
 print json_encode((new MjlActivityCommand($db,function(){return '2026-09-04';},1))->abandonDraft((string)$request['activityId'],(string)$row->version,$user,'Abandon concurrent par un autre Agent'))."\n";
 return;
}

/** Real MariaDB driver: only the final COMMIT acknowledgement/order is controlled. */
class MjlRecoveryDatabase extends DoliDBMysqli
{
 public $mode='normal';
 public $finalCommits=0;
 public function commit($log='')
 {
  if ($log!=='mjl export authorized and generated') return parent::commit($log);
  $this->finalCommits++;
  if ($this->mode==='before-commit') mjl_recovery_barrier();
  if ($this->mode==='uncertain-uncommitted') return 0;
  $result=parent::commit($log);
  if (!$result) throw new RuntimeException('TEST_REAL_COMMIT_FAILED');
  if ($this->mode==='after-commit') mjl_recovery_barrier();
  if ($this->mode==='before-commit') mjl_recovery_barrier('COMMITTED');
  if ($this->mode==='uncertain-false') return 0;
  if ($this->mode==='uncertain-throw') throw new RuntimeException('TEST_LOST_ACKNOWLEDGEMENT');
  if ($this->mode==='deadline-after-commit') sleep(31);
  return $result;
 }
}

/** A short read must fail hashing even when fstat still describes the complete file. */
class MjlRecoveryShortRead extends php_user_filter
{
 public function filter($in,$out,&$consumed,$closing): int
 {
  while ($bucket=stream_bucket_make_writeable($in)) {
   $consumed+=$bucket->datalen;
   $bucket->data=substr($bucket->data,0,-1);$bucket->datalen=strlen($bucket->data);
   stream_bucket_append($out,$bucket);
  }
  return PSFS_PASS_ON;
 }
}
stream_filter_register('mjl.recovery.short-read',MjlRecoveryShortRead::class);

class MjlRecoverySpool extends MjlExportSpool
{
 public $mode;
 private $restoreDirectory;
 protected function openArtifact($path)
 {
  if ($this->mode==='open') {
   chmod($path,0000);
   try { return @parent::openArtifact($path); } finally { chmod($path,0600); }
  }
  $fd=parent::openArtifact($path);
  if ($this->mode==='artifact') { $writer=fopen($path,'r+b');ftruncate($writer,20971521);fclose($writer); }
  if ($this->mode==='hash') stream_filter_append($fd,'mjl.recovery.short-read',STREAM_FILTER_READ);
  if ($this->mode==='unlink') { $this->restoreDirectory=dirname($path);chmod($this->restoreDirectory,0500); }
  return $fd;
 }
 public function create($format)
 {
  $path=parent::create($format);
  if ($this->mode==='hard-crash') {
   file_put_contents($path,'Private incomplete report');
   posix_kill(getmypid(),9);exit(99);
  }
  return $path;
 }
 public function close()
 {
  if ($this->restoreDirectory!==null) { chmod($this->restoreDirectory,0700);$this->restoreDirectory=null; }
  parent::close();
 }
}

class MjlRecoveryExport extends MjlExport
{
 public $mode;
 protected function createSpool($root)
 {
  $spool=new MjlRecoverySpool($root);$spool->mode=$this->mode;return $spool;
 }
}

$mode=$request['mode']??'normal';
if (!in_array($mode,array('normal','open','hash','artifact','pdf-rows','source','unlink','hard-crash','renderer','rows','bytes','cell','memory','deadline','deadline-after-commit','snapshot','before-commit','after-commit','uncertain-uncommitted','uncertain-false','uncertain-throw'),true)) exit(4);
$db->close();
$db=new MjlRecoveryDatabase('mysqli',$dolibarr_main_db_host,$dolibarr_main_db_user,$dolibarr_main_db_pass,$dolibarr_main_db_name,$dolibarr_main_db_port);
$db->mode=$mode;
if($mode==='source')$conf->entity=2;
$user=new User($db);if($user->fetch((int)$request['actorId'])<=0)exit(5);
function mjl_recovery_budgets($db) {
 $r=$db->query('SELECT @@session.max_statement_time AS s,@@session.innodb_lock_wait_timeout AS r,@@session.lock_wait_timeout AS m');
 return (array)$db->fetch_object($r);
}
if($mode==='source') {
 if(!$db->begin('disposable oversized audit source'))exit(6);
 $id=mjl_audit_append_in_transaction($db,array('entity'=>2,'object_type'=>'activity','object_ref'=>'RECOVERY-SOURCE-LIMIT','activity_id'=>(int)$request['activityId'],'actor'=>$user,'action'=>'ACTIVITY_CREATED','result'=>'SUCCESS','context'=>array('reference'=>str_repeat('x',5242881))));
 if($id<1 || !$db->commit('disposable oversized audit source'))exit(7);
}
$before=mjl_recovery_budgets($db);$memory=ini_get('memory_limit');$artifact=null;
// Suppress only the deliberately denied unlink syscall; unexpected warnings remain visible.
if ($mode==='unlink') set_error_handler(function($severity,$message){return strpos($message,'unlink(')!==false && strpos($message,'Permission denied')!==false;});
try {
 $owner=new MjlRecoveryExport($db,$user,(int)$conf->entity,'/tmp/mjlfinancement-exports');$owner->mode=$mode;
 $artifact=$owner->generate($mode==='source'?'audit':'activities',$mode==='pdf-rows'?'pdf':'csv',$mode==='source'?array('q'=>'RECOVERY-SOURCE-LIMIT'):array('activity_id'=>(string)$request['activityId']),function($reader,$filters)use($mode){
  if($mode==='source')return mjl_report_build_audit($reader,$filters);
  $data=mjl_report_build_activities($reader,$filters);
  if ($mode==='snapshot') mjl_recovery_barrier();
  if ($mode==='deadline') sleep(31);
  if ($mode==='memory' && ini_set('memory_limit',(string)(memory_get_usage(true)+4194304))===false) throw new RuntimeException('TEST_MEMORY_LIMIT_FAILED');
  if (in_array($mode,array('renderer','rows','pdf-rows','bytes','cell'),true)) {
   $cell=array('type'=>$mode==='renderer'?'integer':'text','value'=>$mode==='renderer'?'not-an-amount':str_repeat('x',$mode==='cell'?4001:4000));
   $data['document']['sections']=array(array('title'=>'Recovery','headers'=>array('Valeur'),'rows'=>array_fill(0,$mode==='rows'?10001:($mode==='pdf-rows'?501:($mode==='bytes'?1400:1)),array($cell))));
  }
  return $data;
 });
 $bytes=stream_get_contents($artifact['stream']);
 $result=array('code'=>'SUCCESS','ref'=>$artifact['ref'],'bytes'=>strlen($bytes),'sha256'=>hash('sha256',$bytes));
} catch(Throwable $e) { $result=array('code'=>$e->getMessage(),'delivered'=>0); }
finally {
 if ($artifact!==null && is_resource($artifact['stream'])) fclose($artifact['stream']);
 ini_set('memory_limit',$memory);if($mode==='unlink')restore_error_handler();
}
// Inspect before PHP shutdown can hide a leaked descriptor or release a leaked lock.
$result['spool_descriptors']=0;
foreach(glob('/proc/self/fd/*') as $fd) if(strpos((string)@readlink($fd),'/tmp/mjlfinancement-exports/')===0)$result['spool_descriptors']++;
$lock=fopen('/tmp/mjlfinancement-exports/generation.lock','r+b');
$result['lock_released']=flock($lock,LOCK_EX|LOCK_NB);
if($result['lock_released'])flock($lock,LOCK_UN);
fclose($lock);
$result['transaction_opened']=$db->transaction_opened;
$result['budgets_restored']=mjl_recovery_budgets($db)===$before;
$result['final_commits']=$db->finalCommits;
print json_encode($result)."\n";
