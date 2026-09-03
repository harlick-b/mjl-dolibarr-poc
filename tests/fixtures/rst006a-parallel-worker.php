<?php

define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';

$raw = file_get_contents('php://stdin', false, null, 0, 4097);
try { $request = is_string($raw) ? json_decode($raw, true, 8, JSON_THROW_ON_ERROR) : null; }
catch (Throwable $exception) { $request = null; }
if (!is_array($request) || json_encode($request, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) !== $raw) { fwrite(STDERR, "invalid request\n"); exit(2); }
$operation = $request['operation'] ?? '';
$fields = array(
	'submit'=>array('operation','activity_id','version','actor_id','barrier','lock_wait_timeout'),
	'abandon'=>array('operation','activity_id','version','actor_id','reason','barrier','lock_wait_timeout'),
	'review'=>array('operation','activity_id','revision_id','version','actor_id','decision','reason','barrier','lock_wait_timeout'),
);
if (!isset($fields[$operation]) || array_keys($request) !== $fields[$operation]) { fwrite(STDERR, "invalid request\n"); exit(2); }
foreach (array('activity_id','version','actor_id') as $field) if (!isset($request[$field]) || !is_string($request[$field]) || preg_match('/^[1-9][0-9]*$/',$request[$field]) !== 1) { fwrite(STDERR, "invalid identifier\n"); exit(2); }
if (isset($request['revision_id']) && (!is_string($request['revision_id']) || preg_match('/^[1-9][0-9]*$/',$request['revision_id']) !== 1)) { fwrite(STDERR, "invalid revision\n"); exit(2); }
if (!is_string($request['barrier']) || ($request['barrier'] !== '' && preg_match('/^[a-f0-9]{32}$/',$request['barrier']) !== 1)) { fwrite(STDERR, "invalid barrier\n"); exit(2); }
if (!is_int($request['lock_wait_timeout']) || $request['lock_wait_timeout'] < 1 || $request['lock_wait_timeout'] > 10) { fwrite(STDERR, "invalid timeout\n"); exit(2); }
if (!$db->query('SET SESSION innodb_lock_wait_timeout='.(int)$request['lock_wait_timeout'])) { fwrite(STDERR, "timeout setup failed\n"); exit(2); }

if ($request['barrier'] !== '') {
	$directory=DOL_DATA_ROOT.'/mjlfinancement/rst006a-test-barriers/'.$request['barrier'];
	if (!is_dir($directory) && dol_mkdir($directory)<0 && !is_dir($directory)) { fwrite(STDERR, "barrier unavailable\n"); exit(2); }
	if (file_put_contents($directory.'/participant-'.getmypid(),'ready')===false) { fwrite(STDERR, "barrier unavailable\n"); exit(2); }
	$release=$directory.'/released';$deadline=microtime(true)+10;
	while(!is_file($release)&&microtime(true)<$deadline){$participants=glob($directory.'/participant-*');if(is_array($participants)&&count($participants)>=2)file_put_contents($release,'go');usleep(20000);}
	if(!is_file($release)){fwrite(STDERR,"barrier timeout\n");exit(2);}
}

$conf->entity=1;
$actor=new User($db);
if($actor->fetch((int)$request['actor_id'])<=0){fwrite(STDERR,"actor unavailable\n");exit(2);}
$command=new MjlActivityCommand($db,static function(){return '2026-09-03';},1);
if($operation==='submit')$result=$command->submitRevision($request['activity_id'],$request['version'],$actor);
elseif($operation==='abandon')$result=$command->abandonDraft($request['activity_id'],$request['version'],$actor,$request['reason']);
else$result=$command->reviewRevision($request['activity_id'],$request['revision_id'],$request['version'],$actor,$request['decision'],$request['reason']);
print json_encode($result,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE).PHP_EOL;
