<?php

require_once __DIR__.'/cli_guard.php';
define('NOLOGIN',1);
require '/var/www/html/main.inc.php';
require_once __DIR__.'/rst012_schema.lib.php';
require_once __DIR__.'/preserved_admin.lib.php';

function mjl_rst012_disposable_attested(DoliDB $db)
{
	$sentinel=(string)getenv('MJL_DISPOSABLE_RUN_SENTINEL');
	$project=(string)getenv('MJL_DISPOSABLE_PROJECT_NAME');
	$path='/var/www/documents/.mjl-disposable-fixture-sentinel';$stat=@lstat($path);
	if (getenv('MJL_DISPOSABLE_TEST_TENANT')!=='1'||!preg_match('/^(?:mjl-test|mjl-rst012-wrapper)-[a-z0-9-]+$/',$project)||!preg_match('/^[a-f0-9]{32}$/',$sentinel)||$stat===false||is_link($path)||!is_file($path)||(int)$stat['uid']!==0||(((int)$stat['mode'])&07777)!==0444||!hash_equals($sentinel,(string)@file_get_contents($path))) return false;
	$table=$db->prefix().'const';
	return (int)mjl_rst005_scalar($db,"SELECT COUNT(*) FROM $table WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL' AND BINARY value=BINARY '".$db->escape($sentinel)."'")===1;
}

function mjl_rst012_shared_attested()
{
	$token=(string)getenv('MJL_RST012_CUTOVER_CAPABILITY');$path='/run/mjl-rst012-cutover-capability';$stat=@lstat($path);
	return getenv('MJL_RST012_SHARED_CUTOVER')==='1'&&getenv('MJL_RST012_TRAFFIC_STOPPED')==='1'&&preg_match('/^[a-f0-9]{64}$/',$token)===1&&$stat!==false&&!is_link($path)&&is_file($path)&&(((int)$stat['mode'])&0777)===0400&&hash_equals($token,(string)@file_get_contents($path));
}

function mjl_rst012_require_empty_business_tenant(DoliDB $db,$allowSentinel)
{
	mjl_load_preserved_native_admin($db);
	foreach (array('users'=>'SELECT COUNT(*) FROM '.$db->prefix().'user WHERE rowid<>1','partners'=>'SELECT COUNT(*) FROM '.$db->prefix().'societe','projects'=>'SELECT COUNT(*) FROM '.$db->prefix().'projet','documents'=>'SELECT COUNT(*) FROM '.$db->prefix().'ecm_files') as $name=>$sql) if ((int)mjl_rst005_scalar($db,$sql)!==0) throw new RuntimeException('Empty-tenant verification failed: '.$name.'.');
	$res=$db->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE '".$db->escape($db->prefix())."mjlfinancement\\_%' AND TABLE_NAME<>'".$db->escape($db->prefix().'mjlfinancement_export_record')."' ORDER BY TABLE_NAME");
	if (!$res) throw new RuntimeException('Unable to enumerate MJL tables.');
	while ($row=$db->fetch_object($res)) if ((int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$row->TABLE_NAME)!==0) throw new RuntimeException('Empty-tenant verification failed: '.$row->TABLE_NAME.'.');
}

$mode='';$confirm='';$failurePoint='';
foreach (array_slice($argv,1) as $argument) {
	if (strpos($argument,'--mode=')===0) $mode=substr($argument,7);
	elseif (strpos($argument,'--confirm=')===0) $confirm=substr($argument,10);
	elseif (strpos($argument,'--failure-point=')===0) $failurePoint=substr($argument,16);
	else { fwrite(STDERR,"Unknown argument.\n");exit(2); }
}
try {
	$disposable=mjl_rst012_disposable_attested($db);$shared=mjl_rst012_shared_attested();
	$failurePoints=array('forward-001','forward-002','forward-003','forward-004');
	if ($failurePoint!==''&&(!$disposable||!in_array($failurePoint,$failurePoints,true))) throw new RuntimeException('Invalid RST-012 failure point.');
	if ($failurePoint!=='') { putenv('MJL_RST012_FAILURE_INJECTION_ATTESTED=1');putenv('MJL_RST012_FAIL_AFTER='.$failurePoint); }
	if ($mode==='apply'&&$confirm==='RST-012') { if (!$disposable&&!$shared) throw new RuntimeException('RST-012 apply requires the guarded cutover or an attested disposable tenant.');mjl_rst012_require_empty_business_tenant($db,$disposable);mjl_rst012_install($db); }
	elseif ($mode==='rollback'&&$confirm==='RST-012') { if (!$disposable) throw new RuntimeException('RST-012 rollback is restricted to an attested disposable tenant.');mjl_rst012_rollback_empty($db); }
	elseif ($mode==='verify') mjl_rst012_require_target($db);
	elseif ($mode==='verify-empty') {
		mjl_rst012_require_empty_business_tenant($db,$disposable);
		$table=$db->prefix().'mjlfinancement_export_record';
		if (mjl_rst002b_table_exists($db,$table)) {
			mjl_rst012_require_target($db);
			if ((int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$table)!==0) throw new RuntimeException('RST012_EVIDENCE_PRESENT');
		} else mjl_rst006b_require_target($db);
	}
	elseif ($mode==='verify-predecessor') { mjl_rst006b_require_target($db);if (mjl_rst002b_table_exists($db,$db->prefix().'mjlfinancement_export_record')) throw new RuntimeException('RST-012 predecessor contains export schema.'); }
	elseif ($mode==='prefix') print mjl_rst012_prefix($db).PHP_EOL;
	else throw new RuntimeException('Invalid RST-012 command.');
	if ($mode!=='prefix') print 'MJL RST-012 '.$mode.': OK'.PHP_EOL;
} catch (Throwable $exception) { fwrite(STDERR,'RST-012 failed: '.$exception->getMessage().PHP_EOL);exit(1); }
