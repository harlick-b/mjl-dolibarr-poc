<?php

require_once __DIR__.'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once __DIR__.'/preserved_admin.lib.php';

$mode = '';
$confirm = '';
$evidenceManifest = '';
$evidenceSha256 = '';
$failurePoint = '';
foreach (array_slice($argv, 1) as $argument) {
	if (strpos($argument, '--mode=') === 0) $mode = substr($argument, 7);
	if (strpos($argument, '--confirm=') === 0) $confirm = substr($argument, 10);
	if (strpos($argument, '--evidence-manifest=') === 0) $evidenceManifest = substr($argument, 20);
	if (strpos($argument, '--evidence-sha256=') === 0) $evidenceSha256 = substr($argument, 18);
	if (strpos($argument, '--failure-point=') === 0) $failurePoint = substr($argument, 16);
}

$authorization = 'RST-007A,RST-004,RST-008,RST-009A';
$suffix = '_rst_phase1_20260814';
$legacy = array(
	'mjlfinancement_validation',
	'mjlfinancement_workflow_action',
	'mjlfinancement_exchange_log',
	'mjlfinancement_report',
	'mjlfinancement_access_audit',
	'mjlfinancement_password_reset',
	'mjlfinancement_invitation',
	'mjlfinancement_fund_receipt',
	'mjlfinancement_expense',
	'mjlfinancement_budget_line',
	'mjlfinancement_convention',
);

function rst_fail($message) { fwrite(STDERR, 'ERROR: '.$message.PHP_EOL); exit(1); }
function rst_query($sql) { global $db; if (!$db->query($sql)) rst_fail($db->lasterror().' | '.$sql); }
function rst_scalar($sql) { global $db; $resql = $db->query($sql); if (!$resql) rst_fail($db->lasterror()); $row = $db->fetch_row($resql); return (int) $row[0]; }
function rst_table_exists($name) { global $db; return rst_scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($db->prefix().$name)."'") === 1; }
function rst_column_exists($table, $column) { global $db; return rst_scalar("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($db->prefix().$table)."' AND COLUMN_NAME='".$db->escape($column)."'") === 1; }
function rst_require_cutover_evidence($manifest, $expectedHash) {
	if (getenv('MJL_RST_PHASE1_TRAFFIC_STOPPED') !== '1') rst_fail('Set MJL_RST_PHASE1_TRAFFIC_STOPPED=1 only after application traffic is stopped.');
	if ($manifest === '' || !is_file($manifest) || !preg_match('/^[a-f0-9]{64}$/', $expectedHash)) rst_fail('A checksummed cutover evidence manifest is required.');
	if (!hash_equals($expectedHash, hash_file('sha256', $manifest))) rst_fail('Cutover evidence manifest checksum mismatch.');
	$evidence = json_decode(file_get_contents($manifest), true);
	foreach (array('source', 'database', 'schema_metadata', 'documents_manifest', 'documents_archive') as $key) {
		$artifact = is_array($evidence) && isset($evidence[$key]) && is_array($evidence[$key]) ? $evidence[$key] : array();
		$path = isset($artifact['path']) ? (string) $artifact['path'] : '';
		$sha256 = isset($artifact['sha256']) ? (string) $artifact['sha256'] : '';
		if ($path === '' || !is_file($path) || !preg_match('/^[a-f0-9]{64}$/', $sha256)) rst_fail('Cutover evidence is missing readable '.$key.' artifact metadata.');
		if (!hash_equals($sha256, hash_file('sha256', $path))) rst_fail('Cutover artifact checksum mismatch: '.$key.'.');
	}
}

try { mjl_load_preserved_native_admin($db); } catch (RuntimeException $exception) { rst_fail($exception->getMessage()); }
if (!in_array($mode, array('preflight', 'apply', 'finalize', 'rollback'), true)) rst_fail('Use --mode=preflight|apply|finalize|rollback.');
if ($failurePoint !== '' && ($mode !== 'apply' || $failurePoint !== 'after-activity-alter' || getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1' || getDolGlobalString('MJL_RST_PHASE1_FAILURE_INJECTION') !== '1')) rst_fail('Failure injection is restricted to an explicitly armed disposable tenant.');
if ($mode !== 'preflight' && $confirm !== $authorization) rst_fail('Exact phase authorization confirmation is required.');
if ($mode !== 'preflight') rst_require_cutover_evidence($evidenceManifest, $evidenceSha256);

$countChecks = array(
	'other_users' => "SELECT COUNT(*) FROM ".$db->prefix()."user WHERE rowid<>1",
	'roles' => "SELECT COUNT(*) FROM ".$db->prefix()."mjlfinancement_user_role",
	'activities' => "SELECT COUNT(*) FROM ".$db->prefix()."mjlfinancement_activity",
	'user_soc_scope' => "SELECT COUNT(*) FROM ".$db->prefix()."mjlfinancement_user_soc_scope",
);
foreach ($legacy as $table) if (rst_table_exists($table)) $countChecks[$table] = 'SELECT COUNT(*) FROM '.$db->prefix().$table;
$counts = array();
foreach ($countChecks as $label => $sql) { $counts[$label] = rst_scalar($sql); if ($counts[$label] !== 0) rst_fail($label.' must be exactly zero; found '.$counts[$label].'.'); }
if (rst_scalar('SELECT COUNT(*) FROM '.$db->prefix().'user WHERE rowid=1 AND entity=0 AND login=\'admin\' AND admin=1 AND statut=1') !== 1) rst_fail('The exact preserved administrator invariant failed.');

if ($mode === 'preflight') { print json_encode(array('mode' => $mode, 'counts' => $counts, 'status' => 'ready'), JSON_PRETTY_PRINT).PHP_EOL; exit(0); }

if ($mode === 'apply') {
	foreach ($legacy as $table) {
		if (!rst_table_exists($table) || rst_table_exists($table.$GLOBALS['suffix'])) rst_fail('Legacy/quarantine table state is not cutover-ready: '.$table);
	}
	$activity = $db->prefix().'mjlfinancement_activity';
	if (rst_column_exists('mjlfinancement_activity', 'fk_convention')) {
		rst_query('ALTER TABLE '.$activity.' DROP FOREIGN KEY fk_mjlfinancement_activity_convention, DROP INDEX idx_mjlfinancement_activity_fk_convention, DROP COLUMN fk_convention');
	}
	if ($failurePoint === 'after-activity-alter') rst_fail('Injected disposable failure after Activity alteration.');
	$renames = array();
	foreach ($legacy as $table) $renames[] = $db->prefix().$table.' TO '.$db->prefix().$table.$suffix;
	rst_query('RENAME TABLE '.implode(', ', $renames));
} elseif ($mode === 'rollback') {
	$restored = true;
	foreach ($legacy as $table) if (!rst_table_exists($table) || rst_table_exists($table.$suffix)) $restored = false;
	$targetSuffix = '_rst_phase1_target_20260814';
	if (!$restored) {
		$authTargets = array('mjlfinancement_invitation', 'mjlfinancement_password_reset');
		foreach ($legacy as $table) {
			if (!rst_table_exists($table.$suffix)) rst_fail('Rollback quarantine is missing: '.$table);
			if (rst_scalar('SELECT COUNT(*) FROM '.$db->prefix().$table.$suffix) !== 0) rst_fail('Rollback quarantine is not empty: '.$table);
			if (!in_array($table, $authTargets, true) && rst_table_exists($table)) rst_fail('Unexpected live legacy table blocks rollback: '.$table);
		}
		if (rst_table_exists('mjlfinancement_audit_event') && rst_scalar('SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_audit_event') !== 0) rst_fail('Non-empty target audit blocks rollback.');
		$renames = array();
		$renamedTargets = array();
		foreach ($authTargets as $target) {
			if (rst_table_exists($target.$targetSuffix)) rst_fail('Rollback target quarantine already exists: '.$target);
			if (rst_table_exists($target)) {
				if (rst_scalar('SELECT COUNT(*) FROM '.$db->prefix().$target) !== 0) rst_fail('Non-empty target auth table blocks rollback: '.$target);
				$renames[] = $db->prefix().$target.' TO '.$db->prefix().$target.$targetSuffix;
				$renamedTargets[] = $target;
			}
		}
		foreach (array_reverse($legacy) as $table) $renames[] = $db->prefix().$table.$suffix.' TO '.$db->prefix().$table;
		rst_query('RENAME TABLE '.implode(', ', $renames));
		if (rst_table_exists('mjlfinancement_audit_event')) rst_query('DROP TABLE '.$db->prefix().'mjlfinancement_audit_event');
		foreach ($renamedTargets as $target) rst_query('DROP TABLE '.$db->prefix().$target.$targetSuffix);
	} else {
		if (rst_table_exists('mjlfinancement_audit_event')) {
			if (rst_scalar('SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_audit_event') !== 0) rst_fail('Non-empty target audit blocks rollback cleanup.');
			rst_query('DROP TABLE '.$db->prefix().'mjlfinancement_audit_event');
		}
		foreach (array('mjlfinancement_invitation', 'mjlfinancement_password_reset') as $target) if (rst_table_exists($target.$targetSuffix)) {
			if (rst_scalar('SELECT COUNT(*) FROM '.$db->prefix().$target.$targetSuffix) !== 0) rst_fail('Non-empty target auth quarantine blocks rollback cleanup: '.$target);
			rst_query('DROP TABLE '.$db->prefix().$target.$targetSuffix);
		}
	}
	if (!rst_column_exists('mjlfinancement_activity', 'fk_convention')) {
		rst_query('ALTER TABLE '.$db->prefix().'mjlfinancement_activity ADD COLUMN fk_convention INTEGER NOT NULL AFTER fk_project, ADD INDEX idx_mjlfinancement_activity_fk_convention (fk_convention), ADD CONSTRAINT fk_mjlfinancement_activity_convention FOREIGN KEY (fk_convention) REFERENCES '.$db->prefix().'mjlfinancement_convention(rowid)');
	}
} else {
	foreach ($legacy as $table) {
		if (!rst_table_exists($table.$suffix)) rst_fail('Missing quarantine table: '.$table.$suffix);
		if (rst_scalar('SELECT COUNT(*) FROM '.$db->prefix().$table.$suffix) !== 0) rst_fail('Quarantine table is not empty: '.$table.$suffix);
	}
	foreach ($legacy as $table) rst_query('DROP TABLE '.$db->prefix().$table.$suffix);
}

$status = $mode === 'rollback' ? 'schema_rollback_complete_full_backup_restore_required' : 'complete';
print json_encode(array('mode' => $mode, 'authorization' => $authorization, 'counts' => $counts, 'status' => $status), JSON_PRETTY_PRINT).PHP_EOL;
