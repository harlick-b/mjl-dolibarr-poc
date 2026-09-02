<?php

require_once __DIR__.'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once __DIR__.'/activity_schema_installer.lib.php';

function rst002b_fail($message) { fwrite(STDERR, 'ERROR: '.$message.PHP_EOL); exit(1); }
function rst002b_query(DoliDB $db, $sql, $message) { if (!$db->query($sql)) throw new RuntimeException($message.': '.$db->lasterror()); }

function rst002b_arguments(array $argv)
{
	$options = array('mode'=>'','confirm'=>'','failure-point'=>'');
	foreach (array_slice($argv, 1) as $argument) {
		$matched = false;
		foreach ($options as $name => $unused) if (strpos($argument, '--'.$name.'=') === 0) {
			if ($options[$name] !== '') throw new RuntimeException('Duplicate RST-002B argument.');
			$options[$name] = substr($argument, strlen($name) + 3); $matched = true; break;
		}
		if (!$matched) throw new RuntimeException('Unknown RST-002B argument.');
	}
	return $options;
}

function rst002b_require_boundary($mode)
{
	if (getenv('MJL_DISPOSABLE_TEST_TENANT') === '1') {
		if (!preg_match('/^mjl-test-[a-z0-9-]+$/', (string) getenv('MJL_DISPOSABLE_PROJECT_NAME'))) throw new RuntimeException('RST-002B disposable project attestation failed.');
		$sentinel = (string) getenv('MJL_DISPOSABLE_RUN_SENTINEL');
		$path = '/var/www/documents/.mjl-disposable-fixture-sentinel';
		if (!preg_match('/^[a-f0-9]{32}$/', $sentinel) || !is_file($path) || is_link($path) || !hash_equals($sentinel, (string) @file_get_contents($path))) throw new RuntimeException('RST-002B disposable sentinel attestation failed.');
		return;
	}
	if (getenv('MJL_RST002B_SIMPLE_CUTOVER') === '1') {
		if ((string) getenv('MJL_RST002B_SIMPLE_PROJECT') !== 'mjl-dolibarr-poc' || !in_array($mode, array('apply', 'verify'), true)) throw new RuntimeException('RST-002B simple cutover attestation failed.');
		return;
	}
	throw new RuntimeException('RST-002B execution boundary is absent.');
}

function rst002b_sql_statements($path, $prefix)
{
	$source = file_get_contents($path);
	if ($source === false) throw new RuntimeException('Unable to read RST-002B SQL source.');
	$source = preg_replace('/^\s*--.*$/m', '', str_replace('llx_', $prefix, $source));
	$result = array();
	foreach (preg_split('/;\s*(?:\r?\n|$)/', $source) as $statement) if (trim($statement) !== '') $result[] = trim($statement);
	return $result;
}

function rst002b_statement_trigger_name($sql)
{
	if (!preg_match('/^CREATE OR REPLACE TRIGGER ([A-Za-z][A-Za-z0-9_]*) /', $sql, $match)) throw new RuntimeException('Unable to classify an RST-002B trigger statement.');
	return $match[1];
}

function rst002b_trigger_contracts(DoliDB $db, $prefix)
{
	$baseline = mjl_rst002b_expected_trigger_map(mjl_rst002b_role_invariant_trigger_statements($db, false));
	$targetRole = mjl_rst002b_expected_trigger_map(mjl_rst002b_role_invariant_trigger_statements($db, true));
	$targetAssignment = mjl_rst002b_expected_trigger_map(mjl_rst002b_assignment_trigger_statements($db));
	$forward = array_merge(mjl_rst002b_assignment_trigger_statements($db), mjl_rst002b_role_invariant_trigger_statements($db, true));
	$reverse = array(
		mjl_rst002b_role_invariant_trigger_statements($db, false)[2],
		'DROP TRIGGER '.mjl_rst005_ident($prefix.'mjlfinancement_user_role_bd'),
		mjl_rst002b_role_invariant_trigger_statements($db, false)[1],
		mjl_rst002b_role_invariant_trigger_statements($db, false)[0],
		'DROP TRIGGER '.mjl_rst005_ident($prefix.'mjl_activity_assignment_bd'),
		'DROP TRIGGER '.mjl_rst005_ident($prefix.'mjl_activity_assignment_bu'),
		'DROP TRIGGER '.mjl_rst005_ident($prefix.'mjl_activity_assignment_bi'),
	);
	return array('baseline'=>$baseline, 'targetRole'=>$targetRole, 'targetAssignment'=>$targetAssignment, 'forward'=>$forward, 'reverse'=>$reverse);
}

function rst002b_actual_managed_trigger_map(DoliDB $db, $prefix)
{
	return array_merge(
		mjl_rst002b_actual_trigger_map($db, $prefix.'mjlfinancement_activity_assignment'),
		mjl_rst002b_actual_trigger_map($db, $prefix.'mjlfinancement_user_role'),
		mjl_rst002b_actual_trigger_map($db, $prefix.'user')
	);
}

function rst002b_trigger_progress(DoliDB $db, $prefix, $direction = 'forward')
{
	$contracts = rst002b_trigger_contracts($db, $prefix);
	$actual = rst002b_actual_managed_trigger_map($db, $prefix);
	if ($direction === 'reverse') {
		$expected = array_merge($contracts['targetAssignment'], $contracts['targetRole']);
		if (mjl_rst005_map_equal($actual, $expected)) return 'target';
		foreach ($contracts['reverse'] as $index => $sql) {
			if (strpos($sql, 'DROP TRIGGER ') === 0) { preg_match('/`([^`]+)`$/', $sql, $match); unset($expected[$match[1]]); }
			else { $name = rst002b_statement_trigger_name($sql); $expected[$name] = $contracts['baseline'][$name]; }
			if (mjl_rst005_map_equal($actual, $expected)) return $index + 1 === count($contracts['reverse']) ? 'scope-table-removed' : 'rollback-triggers-'.($index + 1);
		}
		return 'unknown';
	}
	$expected = $contracts['baseline'];
	if (mjl_rst005_map_equal($actual, $expected)) return 'scope-table-removed';
	foreach ($contracts['forward'] as $index => $sql) {
		$name = rst002b_statement_trigger_name($sql);
		$source = array_key_exists($name, $contracts['targetAssignment']) ? $contracts['targetAssignment'] : $contracts['targetRole'];
		$expected[$name] = $source[$name];
		if (mjl_rst005_map_equal($actual, $expected)) return $index + 1 === count($contracts['forward']) ? 'target' : 'forward-triggers-'.($index + 1);
	}
	return 'unknown';
}

function rst002b_state(DoliDB $db, $prefix, $direction = 'forward')
{
	$activity = $prefix.'mjlfinancement_activity';
	$assignment = $prefix.'mjlfinancement_activity_assignment';
	$scope = $prefix.'mjlfinancement_user_soc_scope';
	$assignmentExists = mjl_rst002b_table_exists($db, $assignment);
	$scopeExists = mjl_rst002b_table_exists($db, $scope);
	$oldColumn = mjl_rst002b_column_exists($db, $activity, 'fk_user_responsible');
	try {
		if (!$assignmentExists && $scopeExists && $oldColumn) {
			mjl_rst005_require_target_objects($db, $activity);
			return 'RST-005';
		}
		if ($assignmentExists && $scopeExists && $oldColumn) {
			rst002b_require_custom_table_set($db, $prefix, true);
			mjl_rst005_assert_retained_schema_digest($db);
			$oldGuard = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='".$db->escape($prefix)."mjl_activity_rst005_bu'");
			mjl_rst005_schema_contract($db, $activity, RST005_SCHEMA_TARGET, false, $oldGuard === 0 ? 'none' : null);
			mjl_rst002b_require_assignment_contract($db, $assignment, false);
			return $oldGuard === 0 ? 'activity-old-guard-removed' : 'assignment-table-created';
		}
		if ($assignmentExists && $scopeExists && !$oldColumn) {
			rst002b_require_custom_table_set($db, $prefix, true);
			mjl_rst005_assert_retained_schema_digest($db);
			$newGuard = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='".$db->escape($prefix)."mjl_activity_rst002b_bu'");
			mjl_rst005_schema_contract($db, $activity, RST002B_ACTIVITY_SCHEMA, false, $newGuard === 0 ? 'none' : null);
			mjl_rst002b_require_assignment_contract($db, $assignment, false);
			return $newGuard === 0 ? 'activity-column-cutover' : 'activity-guard-cutover';
		}
		if ($assignmentExists && !$scopeExists && !$oldColumn) {
			$progress = rst002b_trigger_progress($db, $prefix, $direction);
			if ($progress === 'target') {
				mjl_rst002b_require_target_objects($db);
				return 'target';
			}
			mjl_rst002b_require_prefix_retained_schema($db);
			mjl_rst005_schema_contract($db, $activity, RST002B_ACTIVITY_SCHEMA);
			mjl_rst002b_require_assignment_contract($db, $assignment, 'ignore');
			return $progress;
		}
	} catch (Throwable $exception) {
		$GLOBALS['rst002b_state_error'] = $exception->getMessage();
		return 'unknown';
	}
	return 'unknown';
}

function rst002b_require_custom_table_set(DoliDB $db, $prefix, $withScope)
{
	$suffixes = array('activity','activity_assignment','audit_event','invitation','operation_type','password_reset','project_note','user_role');
	if ($withScope) $suffixes[] = 'user_soc_scope';
	$expected = array_map(function ($suffix) use ($prefix) { return $prefix.'mjlfinancement_'.$suffix; }, $suffixes);
	sort($expected, SORT_STRING);
	$actual = array();
	$resql = $db->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE '".$db->escape($prefix)."mjlfinancement\\_%' ORDER BY TABLE_NAME");
	if (!$resql) throw new RuntimeException('Unable to inspect the RST-002B partial table set.');
	while ($row = $db->fetch_object($resql)) $actual[] = (string) $row->TABLE_NAME;
	if ($actual !== $expected) throw new RuntimeException('RST-002B partial table set mismatch.');
}

function rst002b_require_empty_cutover(DoliDB $db, $prefix)
{
	foreach (array('mjlfinancement_activity','mjlfinancement_user_soc_scope') as $suffix) {
		$table = $prefix.$suffix;
		if (mjl_rst002b_table_exists($db, $table) && (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($table)) !== 0) throw new RuntimeException('RST-002B preflight requires empty '.$table.'.');
	}
	$assignment = $prefix.'mjlfinancement_activity_assignment';
	if (mjl_rst002b_table_exists($db, $assignment) && (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($assignment)) !== 0) throw new RuntimeException('RST-002B partial state contains assignment rows.');
	$audit = $prefix.'mjlfinancement_audit_event';
	if ((int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($audit)." WHERE object_type='activity_assignment'") !== 0) throw new RuntimeException('RST-002B cutover contains assignment audit rows.');
}

function rst002b_create_assignment_table(DoliDB $db, $prefix)
{
	$root = dirname(__DIR__);
	$statements = rst002b_sql_statements($root.'/sql/llx_mjlfinancement_activity_assignment.sql', $prefix);
	if (count($statements) !== 1) throw new RuntimeException('RST-002B assignment storage must be one atomic DDL statement.');
	rst002b_query($db, $statements[0], 'Unable to create RST-002B assignment storage');
}

function rst002b_fail_after($failurePoint, $expected)
{
	if ($failurePoint === $expected) throw new RuntimeException('R2BI Injected failure after '.$expected.'.');
}

function rst002b_restore_scope(DoliDB $db, $prefix)
{
	$table = $prefix.'mjlfinancement_user_soc_scope';
	rst002b_query($db, 'CREATE TABLE '.mjl_rst005_ident($table).' (rowid INTEGER AUTO_INCREMENT PRIMARY KEY,entity INTEGER DEFAULT 1 NOT NULL,fk_user INTEGER NOT NULL,fk_soc INTEGER NOT NULL,is_active TINYINT DEFAULT 1 NOT NULL,date_start DATETIME DEFAULT NULL,date_end DATETIME DEFAULT NULL,source VARCHAR(64) DEFAULT NULL,note TEXT,date_creation DATETIME NOT NULL,tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,fk_user_creat INTEGER DEFAULT NULL,fk_user_modif INTEGER DEFAULT NULL,import_key VARCHAR(14),INDEX idx_mjlfinancement_user_soc_scope_entity (entity),INDEX idx_mjlfinancement_user_soc_scope_fk_user (fk_user),INDEX idx_mjlfinancement_user_soc_scope_fk_soc (fk_soc),INDEX idx_mjlfinancement_user_soc_scope_active (entity,fk_user,is_active),CONSTRAINT fk_mjlfinancement_user_soc_scope_user FOREIGN KEY (fk_user) REFERENCES '.$prefix.'user(rowid),CONSTRAINT fk_mjlfinancement_user_soc_scope_soc FOREIGN KEY (fk_soc) REFERENCES '.$prefix.'societe(rowid)) ENGINE=innodb', 'Unable to restore RST-005 scope table');
}

function rst002b_rollback(DoliDB $db, $prefix, $failurePoint = '')
{
	$activity = $prefix.'mjlfinancement_activity';
	$state = rst002b_state($db, $prefix, 'reverse');
	if (!in_array($state, array('target','scope-table-removed','activity-guard-cutover','activity-column-cutover','activity-old-guard-removed','assignment-table-created','RST-005'), true) && strpos($state, 'rollback-triggers-') !== 0) throw new RuntimeException('Rollback refused: RST-002B state is not a sealed reverse prefix.');
	rst002b_require_empty_cutover($db, $prefix);
	$downstream = array('operation','activity_revision','review_decision','workflow_action');
	foreach ($downstream as $suffix) if (mjl_rst002b_table_exists($db, $prefix.'mjlfinancement_'.$suffix)) throw new RuntimeException('Rollback refused: an RST-002B dependent table exists.');
	if ($state === 'target' || strpos($state, 'rollback-triggers-') === 0) {
		$completed = $state === 'target' ? 0 : (int) substr($state, strlen('rollback-triggers-'));
		$sequence = rst002b_trigger_contracts($db, $prefix)['reverse'];
		for ($index = $completed; $index < count($sequence); $index++) {
			rst002b_query($db, $sequence[$index], 'Unable to restore the RST-005 trigger prefix');
			rst002b_fail_after($failurePoint, 'rollback-trigger-'.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT));
		}
		$state = 'scope-table-removed';
	}
	if ($failurePoint === 'rollback-scope-table-removed' && $state === 'scope-table-removed') throw new RuntimeException('Injected failure after rollback-scope-table-removed.');
	if ($state === 'scope-table-removed') { rst002b_restore_scope($db, $prefix); rst002b_fail_after($failurePoint, 'rollback-scope-table-restored'); $state = 'activity-guard-cutover'; }
	if ($failurePoint === 'rollback-activity-guard-cutover' && $state === 'activity-guard-cutover') throw new RuntimeException('Injected failure after rollback-activity-guard-cutover.');
	if ($state === 'activity-guard-cutover') {
		rst002b_query($db, 'DROP TRIGGER '.mjl_rst005_ident($prefix.'mjl_activity_rst002b_bu'), 'Unable to remove RST-002B Activity guard');
		rst002b_fail_after($failurePoint, 'rollback-activity-target-guard-dropped');
		$state = 'activity-column-cutover';
	}
	if ($state === 'activity-column-cutover') {
		rst002b_query($db, 'ALTER TABLE '.mjl_rst005_ident($activity).' ADD COLUMN fk_user_responsible INT(11) DEFAULT NULL AFTER fk_user_modif, ADD CONSTRAINT chk_mjl_activity_responsible_dormant CHECK (fk_user_responsible IS NULL)', 'Unable to restore dormant responsible seam');
		rst002b_fail_after($failurePoint, 'rollback-activity-column-restored');
		$state = 'activity-old-guard-removed';
	}
	if ($state === 'activity-old-guard-removed') {
		rst002b_query($db, 'CREATE TRIGGER '.$prefix.'mjl_activity_rst005_bu BEFORE UPDATE ON '.$activity." FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL Activity mutation is dormant in RST-005'", 'Unable to restore RST-005 Activity guard');
		rst002b_fail_after($failurePoint, 'rollback-activity-old-guard-restored');
		$state = 'assignment-table-created';
	}
	if ($failurePoint === 'rollback-assignment-table-created' && $state === 'assignment-table-created') throw new RuntimeException('Injected failure after rollback-assignment-table-created.');
	if ($state === 'assignment-table-created') { rst002b_query($db, 'DROP TABLE '.mjl_rst005_ident($prefix.'mjlfinancement_activity_assignment'), 'Unable to remove empty assignment table'); rst002b_fail_after($failurePoint, 'rollback-assignment-table-dropped'); }
	mjl_rst005_require_target_objects($db, $activity);
}

try {
	$options = rst002b_arguments($argv);
	if (!in_array($options['mode'], array('apply','verify','rollback'), true) || $options['confirm'] !== 'RST-002B') throw new RuntimeException('Use --mode=apply|verify|rollback --confirm=RST-002B.');
	rst002b_require_boundary($options['mode']);
	$prefix = mjl_rst005_prefix($db);
	$lockName = 'mjl:rst002b:'.substr(hash('sha256', (string) mjl_rst005_scalar($db, 'SELECT DATABASE()').':'.$prefix), 0, 46);
	if ((int) mjl_rst005_scalar($db, "SELECT GET_LOCK('".$db->escape($lockName)."',0)") !== 1) throw new RuntimeException('Unable to acquire the RST-002B target lock.');
	try {
		if ($options['mode'] === 'verify') mjl_rst002b_require_target_objects($db);
		elseif ($options['mode'] === 'rollback') rst002b_rollback($db, $prefix, $options['failure-point']);
		else {
			rst002b_require_empty_cutover($db, $prefix);
			$state = rst002b_state($db, $prefix);
			if ($state === 'unknown') throw new RuntimeException('Unknown RST-002B schema state: '.($GLOBALS['rst002b_state_error'] ?? 'unclassified physical boundary').'.');
			if ($state === 'RST-005') { rst002b_create_assignment_table($db, $prefix); rst002b_fail_after($options['failure-point'], 'forward-01-assignment-table-created'); $state = 'assignment-table-created'; }
			if ($options['failure-point'] === 'assignment-table-created') throw new RuntimeException('Injected failure after assignment-table-created.');
			if ($state === 'assignment-table-created') { rst002b_query($db, 'DROP TRIGGER '.mjl_rst005_ident($prefix.'mjl_activity_rst005_bu'), 'Unable to drop RST-005 Activity guard'); rst002b_fail_after($options['failure-point'], 'forward-02-activity-old-guard-dropped'); $state = 'activity-old-guard-removed'; }
			if ($state === 'activity-old-guard-removed') { rst002b_query($db, 'ALTER TABLE '.mjl_rst005_ident($prefix.'mjlfinancement_activity').' DROP CONSTRAINT '.mjl_rst005_ident('chk_mjl_activity_responsible_dormant').', DROP COLUMN '.mjl_rst005_ident('fk_user_responsible'), 'Unable to cut over the dormant responsible seam'); rst002b_fail_after($options['failure-point'], 'forward-03-activity-column-cutover'); $state = 'activity-column-cutover'; }
			if ($state === 'activity-column-cutover') { rst002b_query($db, mjl_rst002b_activity_update_trigger_sql($db), 'Unable to install RST-002B Activity guard'); rst002b_fail_after($options['failure-point'], 'forward-04-activity-target-guard-created'); $state = 'activity-guard-cutover'; }
			if ($options['failure-point'] === 'activity-guard-cutover') throw new RuntimeException('Injected failure after activity-guard-cutover.');
			if ($state === 'activity-guard-cutover') { rst002b_query($db, 'DROP TABLE '.mjl_rst005_ident($prefix.'mjlfinancement_user_soc_scope'), 'Unable to remove empty Partner scope'); rst002b_fail_after($options['failure-point'], 'forward-05-scope-table-removed'); $state = 'scope-table-removed'; }
			if ($options['failure-point'] === 'scope-table-removed') throw new RuntimeException('Injected failure after scope-table-removed.');
			if ($state === 'scope-table-removed' || strpos($state, 'forward-triggers-') === 0) {
				$completed = $state === 'scope-table-removed' ? 0 : (int) substr($state, strlen('forward-triggers-'));
				$sequence = rst002b_trigger_contracts($db, $prefix)['forward'];
				for ($index = $completed; $index < count($sequence); $index++) {
					rst002b_query($db, $sequence[$index], 'Unable to install the RST-002B trigger prefix');
					rst002b_fail_after($options['failure-point'], 'forward-trigger-'.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT));
				}
			}
			mjl_rst002b_require_target_objects($db);
		}
		print 'MJL RST-002B '.$options['mode'].": OK\n";
	} finally {
		$db->query("SELECT RELEASE_LOCK('".$db->escape($lockName)."')");
	}
} catch (Throwable $exception) { rst002b_fail($exception->getMessage()); }
