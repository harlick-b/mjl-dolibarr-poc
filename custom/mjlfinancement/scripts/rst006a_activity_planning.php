<?php

if (PHP_SAPI !== 'cli') { http_response_code(403); exit(1); }
require_once __DIR__.'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once __DIR__.'/rst006a_schema.lib.php';
require_once __DIR__.'/preserved_admin.lib.php';

function mjl_rst006a_empty_tenant_evidence(DoliDB $db)
{
	mjl_load_preserved_native_admin($db);
	$counts = array();
	$queries = array(
		'non_admin_users' => 'SELECT COUNT(*) FROM '.$db->prefix().'user WHERE rowid<>1',
		'partners' => 'SELECT COUNT(*) FROM '.$db->prefix().'societe',
		'projects' => 'SELECT COUNT(*) FROM '.$db->prefix().'projet',
	);
	foreach ($queries as $name => $sql) {
		$counts[$name] = (int) mjl_rst005_scalar($db, $sql);
		if ($counts[$name] !== 0) throw new RuntimeException('Empty-tenant verification failed: '.$name.'.');
	}
	$res = $db->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE '".$db->escape($db->prefix())."mjlfinancement\\_%' ORDER BY TABLE_NAME");
	if (!$res) throw new RuntimeException('Unable to enumerate MJL business tables.');
	while ($row = $db->fetch_object($res)) {
		$table = (string) $row->TABLE_NAME;
		if (!preg_match('/^[A-Za-z0-9_]+$/', $table)) throw new RuntimeException('Unsafe MJL table identifier.');
		$counts[$table] = (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$table);
		if ($counts[$table] !== 0) throw new RuntimeException('Empty-tenant verification failed: '.$table.'.');
	}
	$ecm = $db->prefix().'ecm_files';
	if (mjl_rst002b_table_exists($db, $ecm)) {
		$counts[$ecm] = (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$ecm);
		if ($counts[$ecm] !== 0) throw new RuntimeException('Empty-tenant verification failed: '.$ecm.'.');
	}
	return array(
		'admin'=>array('rowid'=>1,'entity'=>0,'login'=>'admin','active'=>true),
		'zero_row_invariants'=>array('non_admin_users'=>0,'partners'=>0,'projects'=>0,'mjl_business_rows'=>0,'ecm_files'=>0),
	);
}

function mjl_rst006a_disposable_tenant_attested(DoliDB $db)
{
	$sentinel = (string) getenv('MJL_DISPOSABLE_RUN_SENTINEL');
	$path = '/var/www/documents/.mjl-disposable-fixture-sentinel';
	$stat = @lstat($path);
	if (getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1'
		|| !preg_match('/^(?:mjl-test-[a-z0-9-]+|mjl-rst006a-wrapper-[a-z0-9-]+)$/', (string) getenv('MJL_DISPOSABLE_PROJECT_NAME'))
		|| !preg_match('/^[a-f0-9]{32}$/', $sentinel)
		|| $stat === false || is_link($path) || !is_file($path)
		|| (int) $stat['uid'] !== 0 || (((int) $stat['mode']) & 07777) !== 0444
		|| !hash_equals($sentinel, (string) @file_get_contents($path))) return false;
	$table = $db->prefix().'const';
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM $table WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'") !== 1) return false;
	$value = (string) mjl_rst005_scalar($db, "SELECT value FROM $table WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");
	return hash_equals($sentinel, $value);
}

function mjl_rst006a_require_rollback_dependencies(DoliDB $db, $disposable)
{
	$path = __DIR__.'/rst006a-dependent-units.json';
	$bytes = file_get_contents($path);
	$data = $bytes === false ? null : json_decode($bytes, true);
	$expected = array('RST-006B','RST-007B','RST-009B','RST-009C','RST-011','RST-012','RST-013B','RST-013C','RST-013D','RST-013E','RST-014B','RST-014C','RST-014D','RST-015');
	if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE || array_keys($data) !== array('version','unit','dependencies','statuses','executed')
		|| $data['version'] !== 1 || $data['unit'] !== 'RST-006A' || $data['dependencies'] !== $expected || !is_array($data['statuses']) || array_keys($data['statuses']) !== $expected || !is_array($data['executed'])) {
		throw new RuntimeException('Rollback dependency status is missing, malformed, or inconsistent.');
	}
	$derivedExecuted=array();
	foreach($data['statuses']as$unit=>$status){if(!is_string($status)||!in_array($status,array('PENDING_APPROVAL','APPROVED_IMPLEMENTATION','EXECUTED'),true))throw new RuntimeException('Rollback dependency status is malformed.');if($status==='EXECUTED')$derivedExecuted[]=$unit;}
	foreach ($data['executed'] as $unit) if (!is_string($unit) || !in_array($unit, $expected, true)) throw new RuntimeException('Rollback dependency status is malformed.');
	if($derivedExecuted!==$data['executed'])throw new RuntimeException('Rollback dependency execution index is inconsistent.');
	if ($data['executed'] && !$disposable) throw new RuntimeException('Rollback refused: a dependent reset unit is executed.');
	if (!$disposable && getenv('MJL_RST006A_TRAFFIC_STOPPED') !== '1') throw new RuntimeException('Shared rollback requires an explicit stopped-traffic attestation.');
}

$options = getopt('', array('mode:','confirm:','failure-point::'));
$mode = isset($options['mode']) ? (string) $options['mode'] : '';
$disposable = mjl_rst006a_disposable_tenant_attested($db);
if (!in_array($mode, array('apply','rollback','detect','prefix','verify','verify-predecessor','evidence'), true)) throw new RuntimeException('Use an approved RST-006A migration mode.');
if (in_array($mode, array('apply','rollback'), true) && (!isset($options['confirm']) || $options['confirm'] !== 'RST-006A')) throw new RuntimeException('Explicit --confirm=RST-006A is required.');
if (in_array($mode, array('apply','rollback'), true) && getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1' && getenv('MJL_RST006A_TRAFFIC_STOPPED') !== '1') throw new RuntimeException('Shared RST-006A mutation requires an explicit stopped-traffic attestation.');
if (!empty($options['failure-point']) && getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1') throw new RuntimeException('Failure injection is restricted to disposable tenants.');

$state = mjl_rst006a_detect_schema($db);
if ($mode === 'detect') { print $state.PHP_EOL; exit($state === RST006A_SCHEMA_TARGET ? 0 : 2); }
if ($mode === 'prefix') { $prefix=mjl_rst006a_forward_prefix($db);if($prefix===null)throw new RuntimeException('Schema is not an exact RST-006A forward prefix.');print $prefix.PHP_EOL;exit(0); }
if ($mode === 'evidence') { print json_encode(mjl_rst006a_empty_tenant_evidence($db), JSON_UNESCAPED_SLASHES).PHP_EOL; exit(0); }
if ($mode === 'verify' || $mode === 'verify-predecessor') {
	$expected = $mode === 'verify' ? RST006A_SCHEMA_TARGET : RST006A_SCHEMA_PREDECESSOR;
	if ($state !== $expected) throw new RuntimeException('Exact '.$expected.' verification failed.');
	if ($mode === 'verify') mjl_rst006a_require_target($db); else mjl_rst002b_require_target_objects($db);
	mjl_rst006a_empty_tenant_evidence($db);
	print "RST-006A $mode passed.\n";
	exit(0);
}
$lock = 'mjl:rst006a:'.substr(hash('sha256', (string) mjl_rst005_scalar($db, 'SELECT DATABASE()').':'.$db->prefix()), 0, 44);
if ((int) mjl_rst005_scalar($db, "SELECT GET_LOCK('".$db->escape($lock)."',0)") !== 1) throw new RuntimeException('RST-006A migration lock is unavailable.');
try {
	if ($mode === 'apply') {
		if ($state === RST006A_SCHEMA_TARGET) { print "RST-006A target already installed.\n"; exit(0); }
		mjl_rst006a_empty_tenant_evidence($db);
		mjl_rst006a_install_target($db, isset($options['failure-point']) ? (string) $options['failure-point'] : '');
		mjl_rst006a_require_target($db);
		print "RST-006A target installed and verified.\n";
	} else {
		mjl_rst006a_require_rollback_dependencies($db, $disposable);
		if ($state !== RST006A_SCHEMA_TARGET && !mjl_rst006a_is_known_rollback_prefix($db)) throw new RuntimeException('Rollback requires the exact target or a known rollback prefix.');
		foreach (array('activity','activity_assignment') as $suffix) if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_'.$suffix) !== 0) throw new RuntimeException('Rollback refused: Activity or assignment rows exist.');
		foreach (mjl_rst006a_suffixes() as $suffix) {
			$table = mjl_rst006a_table($db, $suffix);
			if (mjl_rst002b_table_exists($db, $table) && (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$table) !== 0) throw new RuntimeException('Rollback refused: RST-006A tables are not empty.');
		}
		$actions = "'ACTIVITY_CREATED','ACTIVITY_STRUCTURE_SAVED','ACTIVITY_REVISION_SUBMITTED','ACTIVITY_ABANDONED','ACTIVITY_RESTORED','ACTIVITY_REVIEW_DECIDED'";
		if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_audit_event WHERE action IN ('.$actions.')') !== 0) throw new RuntimeException('Rollback refused: RST-006A audit evidence exists.');
		mjl_rst006a_rollback_target($db, isset($options['failure-point']) ? (string) $options['failure-point'] : '');
		mjl_rst002b_require_target_objects($db);
		print "RST-006A rollback completed and predecessor verified.\n";
	}
} finally {
	$db->query("SELECT RELEASE_LOCK('".$db->escape($lock)."')");
}
