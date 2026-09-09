<?php

require_once __DIR__.'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once __DIR__.'/rst006b_schema.lib.php';
require_once __DIR__.'/preserved_admin.lib.php';

function mjl_rst006b_disposable_tenant_attested(DoliDB $db)
{
	$sentinel=(string)getenv('MJL_DISPOSABLE_RUN_SENTINEL');$path='/var/www/documents/.mjl-disposable-fixture-sentinel';$stat=@lstat($path);
	if(getenv('MJL_DISPOSABLE_TEST_TENANT')!=='1'||!preg_match('/^(?:mjl-test-[a-z0-9-]+|mjl-rst006a-wrapper-[a-z0-9-]+)$/',(string)getenv('MJL_DISPOSABLE_PROJECT_NAME'))||!preg_match('/^[a-f0-9]{32}$/',$sentinel)||$stat===false||is_link($path)||!is_file($path)||(int)$stat['uid']!==0||(((int)$stat['mode'])&07777)!==0444||!hash_equals($sentinel,(string)@file_get_contents($path)))return false;
	$table=$db->prefix().'const';
	if((int)mjl_rst005_scalar($db,"SELECT COUNT(*) FROM $table WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'")!==1)return false;
	return hash_equals($sentinel,(string)mjl_rst005_scalar($db,"SELECT value FROM $table WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'"));
}

function mjl_rst006b_shared_cutover_attested()
{
	$token=(string)getenv('MJL_RST006B_CUTOVER_CAPABILITY');$path='/run/mjl-rst006b-cutover-capability';$stat=@lstat($path);
	return getenv('MJL_RST006B_SHARED_CUTOVER')==='1'&&getenv('MJL_RST006A_TRAFFIC_STOPPED')==='1'&&preg_match('/^[a-f0-9]{64}$/',$token)===1&&$stat!==false&&!is_link($path)&&is_file($path)&&(((int)$stat['mode'])&0777)===0400&&hash_equals($token,(string)@file_get_contents($path));
}

function mjl_rst006b_require_empty_tenant(DoliDB $db, $allowDisposableSentinel = false)
{
	mjl_load_preserved_native_admin($db);
	$testConstants=$allowDisposableSentinel?"name IN ('MJL_AUTH_E2E_EXPOSE_TOKENS','MJL_RST_PHASE1_FAILURE_INJECTION','MJL_RST_PHASE1_ACTIVATION_FAILURE_INJECTION') OR name LIKE 'MJL_TEST_FIXTURE_NAMESPACE_%'":"name IN ('MJL_AUTH_E2E_EXPOSE_TOKENS','MJL_DISPOSABLE_FIXTURE_SENTINEL','MJL_RST_PHASE1_FAILURE_INJECTION','MJL_RST_PHASE1_ACTIVATION_FAILURE_INJECTION') OR name LIKE 'MJL_TEST_FIXTURE_NAMESPACE_%'";
	foreach(array('non_admin_users'=>'SELECT COUNT(*) FROM '.$db->prefix().'user WHERE rowid<>1','partners'=>'SELECT COUNT(*) FROM '.$db->prefix().'societe','projects'=>'SELECT COUNT(*) FROM '.$db->prefix().'projet','test_constants'=>'SELECT COUNT(*) FROM '.$db->prefix().'const WHERE '.$testConstants)as$name=>$sql)if((int)mjl_rst005_scalar($db,$sql)!==0)throw new RuntimeException('Empty-tenant verification failed: '.$name.'.');
	$res=$db->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE '".$db->escape($db->prefix())."mjlfinancement\\_%' ORDER BY TABLE_NAME");if(!$res)throw new RuntimeException('Unable to enumerate MJL tables.');
	while($row=$db->fetch_object($res)){$table=(string)$row->TABLE_NAME;if(!preg_match('/^[A-Za-z0-9_]+$/',$table)||(int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$table)!==0)throw new RuntimeException('Empty-tenant verification failed: '.$table.'.');}
	$ecm=$db->prefix().'ecm_files';if(mjl_rst002b_table_exists($db,$ecm)&&(int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$ecm)!==0)throw new RuntimeException('Empty-tenant verification failed: '.$ecm.'.');
}

$mode = '';
$confirm = '';
$failurePoint = '';
foreach (array_slice($argv, 1) as $argument) {
	if (strpos($argument, '--mode=') === 0) $mode = substr($argument, 7);
	elseif (strpos($argument, '--confirm=') === 0) $confirm = substr($argument, 10);
	elseif (strpos($argument, '--failure-point=') === 0) $failurePoint = substr($argument, 16);
	else { fwrite(STDERR, "Unknown argument.\n"); exit(2); }
}
try {
	$disposable=mjl_rst006b_disposable_tenant_attested($db);$shared=mjl_rst006b_shared_cutover_attested();
	$failurePoints=array_merge(
		array('operation-checks','activity-checks'),
		array_map(function($index){return 'cancellation_request-fk-'.str_pad((string)$index,2,'0',STR_PAD_LEFT);},range(1,4)),
		array('cancellation_request'),
		array_map(function($index){return 'reopening_request-fk-'.str_pad((string)$index,2,'0',STR_PAD_LEFT);},range(1,5)),
		array('reopening_request','guards')
	);
	if($failurePoint!==''&&(!in_array($failurePoint,$failurePoints,true)||!$disposable))throw new RuntimeException('Invalid RST-006B failure point.');
	if($failurePoint!==''){putenv('MJL_RST006B_FAILURE_INJECTION_ATTESTED=1');putenv('MJL_RST006B_FAIL_AFTER='.$failurePoint);}
	if ($mode === 'apply' && $confirm === 'RST-006B') {if(!$disposable&&!$shared)throw new RuntimeException('RST-006B apply requires the guarded cutover or an attested disposable tenant.');mjl_rst006b_require_empty_tenant($db,$disposable);mjl_rst006b_install_target($db);mjl_rst006b_require_empty_tenant($db,$disposable);}
	elseif ($mode === 'rollback' && $confirm === 'RST-006B') {if(!$disposable)throw new RuntimeException('RST-006B rollback is restricted to an attested disposable tenant.');mjl_rst006b_require_empty_tenant($db,true);mjl_rst006b_rollback_target($db);mjl_rst006b_require_empty_tenant($db,true);}
	elseif ($mode === 'verify') mjl_rst006b_require_target($db);
	elseif ($mode === 'verify-predecessor') mjl_rst006a_require_target($db);
	else throw new RuntimeException('Invalid RST-006B command.');
	print 'MJL RST-006B '.$mode.': OK'.PHP_EOL;
} catch (Throwable $exception) {
	fwrite(STDERR, 'RST-006B failed: '.$exception->getMessage().PHP_EOL);
	exit(1);
}
