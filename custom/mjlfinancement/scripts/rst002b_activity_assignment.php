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

function rst002b_require_boundary()
{
	if (getenv('MJL_DISPOSABLE_TEST_TENANT') === '1') {
		if (!preg_match('/^mjl-test-[a-z0-9-]+$/', (string) getenv('MJL_DISPOSABLE_PROJECT_NAME'))) throw new RuntimeException('RST-002B disposable project attestation failed.');
		$sentinel = (string) getenv('MJL_DISPOSABLE_RUN_SENTINEL');
		$path = '/var/www/documents/.mjl-disposable-fixture-sentinel';
		if (!preg_match('/^[a-f0-9]{32}$/', $sentinel) || !is_file($path) || is_link($path) || !hash_equals($sentinel, (string) @file_get_contents($path))) throw new RuntimeException('RST-002B disposable sentinel attestation failed.');
		return;
	}
	if (getenv('MJL_RST002B_SHARED_LAUNCHER') !== '1') throw new RuntimeException('RST-002B shared launcher authorization is absent.');
	$path = '/run/mjl-rst002b/authorization.json';
	$stat = @lstat($path);
	if ($stat === false || is_link($path) || !is_file($path) || (int) $stat['uid'] !== 0 || (((int) $stat['mode']) & 07777) !== 0400 || (int) $stat['nlink'] !== 1) throw new RuntimeException('RST-002B shared authorization custody is invalid.');
	$record = json_decode((string) @file_get_contents($path), true);
	if (!is_array($record) || ($record['unit'] ?? '') !== 'RST-002B' || !preg_match('/^[a-f0-9]{40}$/', (string) ($record['approved_commit'] ?? '')) || !preg_match('/^[a-f0-9]{64}$/', (string) ($record['complete_tree_sha256'] ?? ''))) throw new RuntimeException('RST-002B shared authorization record is invalid.');
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

function rst002b_state(DoliDB $db, $prefix)
{
	$activity = $prefix.'mjlfinancement_activity';
	$assignment = $prefix.'mjlfinancement_activity_assignment';
	$scope = $prefix.'mjlfinancement_user_soc_scope';
	$assignmentExists = mjl_rst002b_table_exists($db, $assignment);
	$scopeExists = mjl_rst002b_table_exists($db, $scope);
	$oldColumn = mjl_rst002b_column_exists($db, $activity, 'fk_user_responsible');
	if (!$assignmentExists && $scopeExists && $oldColumn && mjl_rst005_detect_schema($db, $activity) === RST005_SCHEMA_TARGET) return 'RST-005';
	if ($assignmentExists && $scopeExists && $oldColumn) return 'assignment-table-created';
	if ($assignmentExists && $scopeExists && !$oldColumn) return 'activity-guard-cutover';
	if ($assignmentExists && !$scopeExists && !$oldColumn) return mjl_rst002b_detect_schema($db) === RST002B_SCHEMA_TARGET ? 'target' : 'scope-table-removed';
	return 'unknown';
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
	foreach (array('sql/llx_mjlfinancement_activity_assignment.sql','sql/llx_mjlfinancement_activity_assignment.key.sql') as $relative) {
		foreach (rst002b_sql_statements($root.'/'.$relative, $prefix) as $sql) rst002b_query($db, $sql, 'Unable to create RST-002B assignment storage');
	}
}

function rst002b_cutover_activity(DoliDB $db, $prefix)
{
	$activity = $prefix.'mjlfinancement_activity';
	rst002b_query($db, 'DROP TRIGGER IF EXISTS '.mjl_rst005_ident($prefix.'mjl_activity_rst005_bu'), 'Unable to drop RST-005 Activity guard');
	rst002b_query($db, 'ALTER TABLE '.mjl_rst005_ident($activity).' DROP CONSTRAINT '.mjl_rst005_ident('chk_mjl_activity_responsible_dormant'), 'Unable to drop dormant responsible constraint');
	rst002b_query($db, 'ALTER TABLE '.mjl_rst005_ident($activity).' DROP COLUMN '.mjl_rst005_ident('fk_user_responsible'), 'Unable to drop dormant responsible column');
	mjl_rst002b_install_activity_update_trigger($db);
}

function rst002b_restore_scope(DoliDB $db, $prefix)
{
	$table = $prefix.'mjlfinancement_user_soc_scope';
	rst002b_query($db, 'CREATE TABLE '.mjl_rst005_ident($table).' (rowid INTEGER AUTO_INCREMENT PRIMARY KEY,entity INTEGER DEFAULT 1 NOT NULL,fk_user INTEGER NOT NULL,fk_soc INTEGER NOT NULL,is_active TINYINT DEFAULT 1 NOT NULL,date_start DATETIME DEFAULT NULL,date_end DATETIME DEFAULT NULL,source VARCHAR(64) DEFAULT NULL,note TEXT,date_creation DATETIME NOT NULL,tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,fk_user_creat INTEGER DEFAULT NULL,fk_user_modif INTEGER DEFAULT NULL,import_key VARCHAR(14)) ENGINE=innodb', 'Unable to restore RST-005 scope table');
	foreach (array(
		'ADD INDEX idx_mjlfinancement_user_soc_scope_entity (entity)', 'ADD INDEX idx_mjlfinancement_user_soc_scope_fk_user (fk_user)',
		'ADD INDEX idx_mjlfinancement_user_soc_scope_fk_soc (fk_soc)', 'ADD INDEX idx_mjlfinancement_user_soc_scope_active (entity,fk_user,is_active)',
		'ADD CONSTRAINT fk_mjlfinancement_user_soc_scope_user FOREIGN KEY (fk_user) REFERENCES '.$prefix.'user(rowid)',
		'ADD CONSTRAINT fk_mjlfinancement_user_soc_scope_soc FOREIGN KEY (fk_soc) REFERENCES '.$prefix.'societe(rowid)',
	) as $clause) rst002b_query($db, 'ALTER TABLE '.mjl_rst005_ident($table).' '.$clause, 'Unable to restore RST-005 scope object');
}

function rst002b_rollback(DoliDB $db, $prefix)
{
	if (rst002b_state($db, $prefix) !== 'target') throw new RuntimeException('Rollback refused: RST-002B target is not exact.');
	rst002b_require_empty_cutover($db, $prefix);
	$downstream = array('operation','activity_revision','review_decision','workflow_action');
	foreach ($downstream as $suffix) if (mjl_rst002b_table_exists($db, $prefix.'mjlfinancement_'.$suffix)) throw new RuntimeException('Rollback refused: an RST-002B dependent table exists.');
	rst002b_query($db, 'DROP TABLE '.mjl_rst005_ident($prefix.'mjlfinancement_activity_assignment'), 'Unable to remove empty assignment table');
	rst002b_query($db, 'DROP TRIGGER IF EXISTS '.mjl_rst005_ident($prefix.'mjl_activity_rst002b_bu'), 'Unable to remove RST-002B Activity guard');
	$activity = $prefix.'mjlfinancement_activity';
	rst002b_query($db, 'ALTER TABLE '.mjl_rst005_ident($activity).' ADD COLUMN fk_user_responsible INT(11) DEFAULT NULL AFTER fk_user_modif, ADD CONSTRAINT chk_mjl_activity_responsible_dormant CHECK (fk_user_responsible IS NULL)', 'Unable to restore dormant responsible seam');
	rst002b_query($db, 'CREATE TRIGGER '.$prefix.'mjl_activity_rst005_bu BEFORE UPDATE ON '.$activity." FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL Activity mutation is dormant in RST-005'", 'Unable to restore RST-005 Activity guard');
	rst002b_restore_scope($db, $prefix);
	mjl_rst002b_install_role_invariant_triggers($db, false);
	mjl_rst005_require_target_objects($db, $activity);
}

try {
	$options = rst002b_arguments($argv);
	if (!in_array($options['mode'], array('apply','verify','rollback'), true) || $options['confirm'] !== 'RST-002B') throw new RuntimeException('Use --mode=apply|verify|rollback --confirm=RST-002B.');
	rst002b_require_boundary();
	$prefix = mjl_rst005_prefix($db);
	$lockName = 'mjl:rst002b:'.substr(hash('sha256', (string) mjl_rst005_scalar($db, 'SELECT DATABASE()').':'.$prefix), 0, 46);
	if ((int) mjl_rst005_scalar($db, "SELECT GET_LOCK('".$db->escape($lockName)."',0)") !== 1) throw new RuntimeException('Unable to acquire the RST-002B target lock.');
	try {
		if ($options['mode'] === 'verify') mjl_rst002b_require_target_objects($db);
		elseif ($options['mode'] === 'rollback') rst002b_rollback($db, $prefix);
		else {
			rst002b_require_empty_cutover($db, $prefix);
			$state = rst002b_state($db, $prefix);
			if ($state === 'unknown') throw new RuntimeException('Unknown RST-002B schema state.');
			if ($state === 'RST-005') { rst002b_create_assignment_table($db, $prefix); $state = 'assignment-table-created'; }
			if ($options['failure-point'] === 'assignment-table-created') throw new RuntimeException('Injected failure after assignment-table-created.');
			if ($state === 'assignment-table-created') { rst002b_cutover_activity($db, $prefix); $state = 'activity-guard-cutover'; }
			if ($options['failure-point'] === 'activity-guard-cutover') throw new RuntimeException('Injected failure after activity-guard-cutover.');
			if ($state === 'activity-guard-cutover') { rst002b_query($db, 'DROP TABLE '.mjl_rst005_ident($prefix.'mjlfinancement_user_soc_scope'), 'Unable to remove empty Partner scope'); $state = 'scope-table-removed'; }
			if ($options['failure-point'] === 'scope-table-removed') throw new RuntimeException('Injected failure after scope-table-removed.');
			if ($state === 'scope-table-removed') { mjl_rst002b_install_assignment_triggers($db); mjl_rst002b_install_role_invariant_triggers($db, true); }
			mjl_rst002b_require_target_objects($db);
		}
		print 'MJL RST-002B '.$options['mode'].": OK\n";
	} finally {
		$db->query("SELECT RELEASE_LOCK('".$db->escape($lockName)."')");
	}
} catch (Throwable $exception) { rst002b_fail($exception->getMessage()); }
