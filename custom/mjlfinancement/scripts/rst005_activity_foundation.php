<?php

require_once __DIR__.'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once __DIR__.'/activity_schema_installer.lib.php';

const RST005_CONFIRMATION = 'RST-005';
const RST005_LOCK_TIMEOUT = 0;
const RST005_ROLLBACK_MODE = 'rollback';
const RST005_DEPENDENT_SOURCE_SHA256 = '838dadbdff94306c112be697c9ede71eeecccf17b1217ef3087db19327f437d6';

function rst005_fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(1);
}

function rst005_query(DoliDB $db, $sql, $message)
{
	if (!$db->query($sql)) throw new RuntimeException($message.': '.$db->lasterror());
}

function rst005_table_exists(DoliDB $db, $table)
{
	return (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND TABLE_TYPE='BASE TABLE'") === 1;
}

function rst005_arguments(array $arguments)
{
	$options = array('mode' => '', 'confirm' => '', 'evidence-manifest' => '', 'evidence-sha256' => '', 'failure-point' => '');
	foreach (array_slice($arguments, 1) as $argument) {
		foreach ($options as $name => $unused) {
			$prefix = '--'.$name.'=';
			if (strpos($argument, $prefix) === 0) $options[$name] = substr($argument, strlen($prefix));
		}
	}
	return $options;
}

function rst005_require_disposable_mutation_boundary()
{
	if (getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1' || !preg_match('/^mjl-test-[a-z0-9-]+$/', (string) getenv('MJL_DISPOSABLE_PROJECT_NAME'))) {
		throw new RuntimeException('RST-005 shared mutation is disabled pending separate approval and an approval-bound execution launcher.');
	}
	$sentinel = (string) getenv('MJL_DISPOSABLE_RUN_SENTINEL');
	$path = '/var/www/documents/.mjl-disposable-fixture-sentinel';
	$stat = @lstat($path);
	if (!preg_match('/^[a-f0-9]{32}$/', $sentinel) || $stat === false || is_link($path) || !is_file($path)
		|| (int) $stat['uid'] !== 0 || (((int) $stat['mode']) & 07777) !== 0444
		|| !hash_equals($sentinel, (string) @file_get_contents($path))) {
		throw new RuntimeException('RST-005 disposable mutation attestation failed.');
	}
}

function rst005_module_tree_sha($root)
{
	$entries = array();
	$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
	foreach ($iterator as $file) {
		if (!$file->isFile() || $file->isLink()) throw new RuntimeException('RST-005 source fingerprint refuses non-file module entries.');
		$relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($root) + 1));
		if ($relative !== 'scripts/rst005_activity_foundation.php') $entries[] = 'file|'.$relative.'|'.hash_file('sha256', $file->getPathname());
	}
	sort($entries, SORT_STRING);
	return hash('sha256', implode("\n", $entries)."\n");
}

function rst005_evidence_field($hash, $type, $value)
{
	if ($value === null) {
		hash_update($hash, $type.":null\n");
		return;
	}
	$bytes = (string) $value;
	hash_update($hash, $type.':'.strlen($bytes).':'.$bytes."\n");
}

function rst005_documents_sha($root)
{
	$hash = hash_init('sha256');
	$stat = @lstat($root);
	if ($stat === false || is_link($root) || !is_dir($root)) throw new RuntimeException('Invalid RST-005 document evidence root.');
	rst005_evidence_field($hash, 'root-path', '.');
	rst005_evidence_field($hash, 'root-type', 'directory');
	rst005_evidence_field($hash, 'root-mode', ((int) $stat['mode']) & 07777);
	$walk = function ($directory, $relative = '') use (&$walk, $hash) {
		$entries = scandir($directory);
		if ($entries === false) throw new RuntimeException('Unable to enumerate RST-005 document evidence.');
		sort($entries, SORT_STRING);
		foreach ($entries as $name) {
			if ($name === '.' || $name === '..') continue;
			$absolute = $directory.'/'.$name;
			$path = $relative === '' ? $name : $relative.'/'.$name;
			$mode = fileperms($absolute);
			if ($mode === false) throw new RuntimeException('Unable to stat RST-005 document evidence.');
			if (is_link($absolute)) {
				rst005_evidence_field($hash, 'link-path', $path);
				rst005_evidence_field($hash, 'link-mode', $mode & 07777);
				rst005_evidence_field($hash, 'link-target', readlink($absolute));
			} elseif (is_dir($absolute)) {
				rst005_evidence_field($hash, 'dir-path', $path);
				rst005_evidence_field($hash, 'dir-mode', $mode & 07777);
				$walk($absolute, $path);
			} elseif (is_file($absolute)) {
				rst005_evidence_field($hash, 'file-path', $path);
				rst005_evidence_field($hash, 'file-mode', $mode & 07777);
				rst005_evidence_field($hash, 'file-size', filesize($absolute));
				$handle = fopen($absolute, 'rb');
				if ($handle === false) throw new RuntimeException('Unable to open RST-005 document evidence.');
				hash_update_stream($hash, $handle);
				fclose($handle);
			} else throw new RuntimeException('Unsupported RST-005 document evidence entry.');
		}
	};
	$walk($root);
	return hash_final($hash);
}

function rst005_ecm_sha(DoliDB $db)
{
	$hash = hash_init('sha256');
	foreach (array(mjl_rst005_prefix($db).'ecm_files', mjl_rst005_prefix($db).'ecm_directories') as $table) {
		$columns = array();
		$resql = $db->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY ORDINAL_POSITION");
		if (!$resql) throw new RuntimeException('Unable to inspect native ECM evidence columns.');
		while ($row = $db->fetch_object($resql)) $columns[] = (string) $row->COLUMN_NAME;
		$query = 'SELECT '.implode(',', array_map('mjl_rst005_ident', $columns)).' FROM '.mjl_rst005_ident($table).' ORDER BY '.mjl_rst005_ident('rowid');
		$resql = $db->query($query);
		if (!$resql) throw new RuntimeException('Unable to read native ECM evidence.');
		while ($row = $db->fetch_row($resql)) foreach ($columns as $index => $name) {
			rst005_evidence_field($hash, $table.'.name', $name);
			rst005_evidence_field($hash, $table.'.value', $row[$index]);
		}
	}
	return hash_final($hash);
}

function rst005_protected_tables_sha(DoliDB $db)
{
	$hash = hash_init('sha256');
	$prefix = mjl_rst005_prefix($db);
	$activityTables = array(
		$prefix.'mjlfinancement_activity', $prefix.'mjlfinancement_activity_rst005_target',
		$prefix.'mjlfinancement_activity_rst005_phase1_quarantine', $prefix.'mjlfinancement_activity_rst005_phase1_restore',
		$prefix.'mjlfinancement_activity_rst005_target_failed',
	);
	$resql = $db->query("SELECT TABLE_NAME,TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE IN ('BASE TABLE','SEQUENCE') ORDER BY TABLE_NAME");
	if (!$resql) throw new RuntimeException('Unable to enumerate RST-005 protected tables.');
	while ($definition = $db->fetch_object($resql)) {
		$table = (string) $definition->TABLE_NAME;
		if (in_array($table, $activityTables, true)) continue;
		$columns = array();
		$columnDefinitions = array();
		$columnSql = "SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,GENERATION_EXPRESSION,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY ORDINAL_POSITION";
		$columnResult = $db->query($columnSql);
		if (!$columnResult) throw new RuntimeException('Unable to inspect protected table columns: '.$table);
		while ($column = $db->fetch_object($columnResult)) {
			$columns[] = (string) $column->COLUMN_NAME;
			$columnDefinitions[] = array($column->COLUMN_NAME,$column->COLUMN_TYPE,$column->IS_NULLABLE,$column->COLUMN_DEFAULT,$column->EXTRA,$column->GENERATION_EXPRESSION,$column->COLLATION_NAME);
		}
		rst005_evidence_field($hash, 'table', $table);
		rst005_evidence_field($hash, 'table-type', $definition->TABLE_TYPE);
		foreach ($columnDefinitions as $column) rst005_evidence_field($hash, 'column', json_encode($column, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
		$createResult = $db->query('SHOW CREATE TABLE '.mjl_rst005_ident($table));
		$create = $createResult ? $db->fetch_row($createResult) : null;
		if (!$create || !isset($create[1])) throw new RuntimeException('Unable to inspect protected table definition: '.$table);
		rst005_evidence_field($hash, 'create', $create[1]);
		$primary = array();
		$primaryResult = $db->query("SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX");
		if (!$primaryResult) throw new RuntimeException('Unable to inspect protected table ordering: '.$table);
		while ($column = $db->fetch_object($primaryResult)) $primary[] = (string) $column->COLUMN_NAME;
		$order = !empty($primary) ? $primary : $columns;
		$rowResult = $db->query('SELECT '.implode(',', array_map('mjl_rst005_ident', $columns)).' FROM '.mjl_rst005_ident($table).(!empty($order) ? ' ORDER BY '.implode(',', array_map('mjl_rst005_ident', $order)) : ''));
		if (!$rowResult) throw new RuntimeException('Unable to read protected table: '.$table);
		while ($row = $db->fetch_row($rowResult)) foreach ($row as $value) rst005_evidence_field($hash, 'value', $value);
	}
	$liveActivity = $activityTables[0];
	if (rst005_table_exists($db, $liveActivity)) {
		$activityColumns = mjl_rst005_table_columns($db, $liveActivity);
		$activityResult = $db->query('SELECT '.implode(',', array_map('mjl_rst005_ident', $activityColumns)).' FROM '.mjl_rst005_ident($liveActivity).' ORDER BY '.mjl_rst005_ident('rowid'));
		if (!$activityResult) throw new RuntimeException('Unable to read protected Activity rows.');
		rst005_evidence_field($hash, 'activity-row-count', $db->num_rows($activityResult));
		while ($row = $db->fetch_row($activityResult)) foreach ($activityColumns as $index => $column) {
			rst005_evidence_field($hash, 'activity-row-column', $column);
			rst005_evidence_field($hash, 'activity-row-value', $row[$index]);
		}
	}
	$activityTableSql = "'".implode("','", array_map(array($db, 'escape'), $activityTables))."'";
	$objectQueries = array(
		'views' => "SELECT * FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME",
		'triggers' => "SELECT * FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE NOT IN (".$activityTableSql.") ORDER BY TRIGGER_NAME",
		'routines' => "SELECT * FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() ORDER BY ROUTINE_TYPE,ROUTINE_NAME",
		'routine_parameters' => "SELECT * FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA=DATABASE() ORDER BY SPECIFIC_NAME,ORDINAL_POSITION",
		'events' => "SELECT * FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE() ORDER BY EVENT_NAME",
	);
	foreach ($objectQueries as $kind => $query) {
		$objectResult = $db->query($query);
		if (!$objectResult || !method_exists($objectResult, 'fetch_fields')) throw new RuntimeException('Unable to inspect protected schema objects: '.$kind);
		$fields = $objectResult->fetch_fields();
		while ($row = $db->fetch_row($objectResult)) {
			rst005_evidence_field($hash, 'schema-object-kind', $kind);
			foreach ($fields as $index => $field) {
				rst005_evidence_field($hash, 'schema-object-field', $field->name);
				rst005_evidence_field($hash, 'schema-object-value', $row[$index]);
			}
		}
	}
	return hash_final($hash);
}

function rst005_require_evidence(DoliDB $db, array $options)
{
	if (getenv('MJL_RST005_TRAFFIC_STOPPED') !== '1') throw new RuntimeException('Set MJL_RST005_TRAFFIC_STOPPED=1 only after application traffic is stopped.');
	$manifest = $options['evidence-manifest'];
	$expected = $options['evidence-sha256'];
	if ($manifest === '' || !is_file($manifest) || !preg_match('/^[a-f0-9]{64}$/', $expected)) throw new RuntimeException('A checksummed RST-005 evidence manifest is required.');
	if (!hash_equals($expected, hash_file('sha256', $manifest))) throw new RuntimeException('RST-005 evidence manifest checksum mismatch.');
	$data = json_decode(file_get_contents($manifest), true);
	foreach (array('source','schema','database','protected_tables','documents','ecm','backup_schema','backup_full','backup_restore') as $key) {
		$entry = is_array($data) && isset($data[$key]) && is_array($data[$key]) ? $data[$key] : array();
		if (empty($entry['sha256']) || !preg_match('/^[a-f0-9]{64}$/', (string) $entry['sha256'])) throw new RuntimeException('RST-005 evidence is missing '.$key.' digest.');
	}
	if (($data['source']['kind'] ?? '') !== 'mjl-dependent-module-tree-v2') throw new RuntimeException('RST-005 source evidence kind is invalid.');
	$currentSource = rst005_module_tree_sha(dirname(__DIR__));
	if (!hash_equals(RST005_DEPENDENT_SOURCE_SHA256, $currentSource)) throw new RuntimeException('RST-005 dependent source differs from the source digest sealed in the migration.');
	if (!hash_equals((string) $data['source']['sha256'], $currentSource)) throw new RuntimeException('RST-005 module source differs from the approved evidence boundary; dependent code may be present.');
	if (($data['schema']['kind'] ?? '') !== 'rst005-phase1-logical-oracle-v1' || !hash_equals(RST005_PHASE1_ORACLE_SHA256, (string) $data['schema']['sha256'])) throw new RuntimeException('RST-005 Phase 1 schema evidence is not the sealed logical oracle.');
	if (!hash_equals((string) $data['documents']['sha256'], rst005_documents_sha('/var/www/documents'))) throw new RuntimeException('RST-005 document evidence changed after the maintenance boundary.');
	if (!hash_equals((string) $data['ecm']['sha256'], rst005_ecm_sha($db))) throw new RuntimeException('RST-005 native ECM evidence changed after the maintenance boundary.');
	if (($data['protected_tables']['kind'] ?? '') !== 'rst005-non-activity-database-v2') throw new RuntimeException('RST-005 protected database evidence kind is invalid.');
	if (!hash_equals((string) $data['protected_tables']['sha256'], rst005_protected_tables_sha($db))) throw new RuntimeException('RST-005 protected non-Activity database evidence changed after the maintenance boundary.');
	foreach (array('backup_schema','backup_full') as $key) {
		$entry = $data[$key];
		$path = isset($entry['path']) ? (string) $entry['path'] : '';
		$allowedRoot = '/tmp/rst005-evidence/';
		$allowedDirectory = realpath(rtrim($allowedRoot, '/'));
		$resolvedPath = realpath($path);
		if ($allowedDirectory === false || $resolvedPath === false || strpos($resolvedPath, $allowedDirectory.DIRECTORY_SEPARATOR) !== 0 || !is_file($resolvedPath) || !is_readable($resolvedPath) || (fileperms($resolvedPath) & 0777) !== 0600) throw new RuntimeException('RST-005 encrypted backup artifact is missing or outside its protected boundary: '.$key);
		if (!hash_equals((string) $entry['sha256'], hash_file('sha256', $resolvedPath))) throw new RuntimeException('RST-005 encrypted backup artifact checksum mismatch: '.$key);
		if (($entry['encryption'] ?? '') !== 'libsodium-secretstream-xchacha20poly1305' || ($entry['mode'] ?? '') !== '0600') throw new RuntimeException('RST-005 encrypted backup metadata mismatch: '.$key);
		if (empty($entry['plaintext_sha256']) || !preg_match('/^[a-f0-9]{64}$/', (string) $entry['plaintext_sha256'])) throw new RuntimeException('RST-005 plaintext backup digest is missing: '.$key);
	}
	if (empty($data['backup_restore']['verified']) || $data['backup_restore']['verified'] !== true) throw new RuntimeException('RST-005 backup restore rehearsal is not verified.');
	if (empty($data['backup_restore']['fresh_process']) || !hash_equals((string) $data['backup_schema']['plaintext_sha256'], (string) ($data['backup_restore']['schema_sha256'] ?? '')) || !hash_equals((string) $data['backup_full']['plaintext_sha256'], (string) ($data['backup_restore']['full_sha256'] ?? ''))) throw new RuntimeException('RST-005 backup restore attestation does not bind both plaintext digests.');
	return $data;
}

function rst005_require_checkpoint(array $evidence, $required = '')
{
	$kind = (string) ($evidence['checkpoint']['kind'] ?? '');
	$allowed = array('preflight-pre-activation','post-activation-pre-finalization');
	if (!in_array($kind, $allowed, true)) throw new RuntimeException('RST-005 evidence checkpoint kind is invalid.');
	if ($required !== '' && $kind !== $required) throw new RuntimeException('RST-005 operation requires the '.$required.' evidence checkpoint.');
	if (!hash_equals(hash('sha256', $kind), (string) ($evidence['checkpoint']['sha256'] ?? ''))) throw new RuntimeException('RST-005 evidence checkpoint digest is invalid.');
}

function rst005_downstream_tables($prefix)
{
	return array(
		$prefix.'mjlfinancement_'.'workflow_action',
		$prefix.'mjlfinancement_activity_assignment',
		$prefix.'mjlfinancement_operation',
		$prefix.'mjlfinancement_activity_revision',
		$prefix.'mjlfinancement_revision_contributor',
		$prefix.'mjlfinancement_review_decision',
		$prefix.'mjlfinancement_cancellation_request',
		$prefix.'mjlfinancement_reopening_request',
	);
}

function rst005_require_no_downstream(DoliDB $db, $prefix)
{
	foreach (rst005_downstream_tables($prefix) as $table) {
		if (rst005_table_exists($db, $table)) throw new RuntimeException('Downstream Phase 2 table blocks RST-005: '.$table);
	}
	$audit = $prefix.'mjlfinancement_audit_event';
	if (rst005_table_exists($db, $audit)) {
		$count = (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($audit)." WHERE object_type='mjlfinancement_activity' OR activity_id IS NOT NULL");
		if ($count !== 0) throw new RuntimeException('Activity-linked audit rows block RST-005.');
	}
}

function rst005_require_pre_rename_table_set(DoliDB $db, $prefix, $target)
{
	$expected = array(
		$prefix.'mjlfinancement_activity', $prefix.'mjlfinancement_audit_event', $prefix.'mjlfinancement_invitation',
		$prefix.'mjlfinancement_operation_type', $prefix.'mjlfinancement_password_reset', $prefix.'mjlfinancement_project_note',
		$prefix.'mjlfinancement_user_role', $prefix.'mjlfinancement_user_soc_scope', $target,
	);
	sort($expected, SORT_STRING);
	$actual = array();
	$resql = $db->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE '".$db->escape($prefix)."mjlfinancement\\_%' ORDER BY TABLE_NAME");
	if (!$resql) throw new RuntimeException('Unable to inspect the pre-rename MJL table set.');
	while ($row = $db->fetch_object($resql)) $actual[] = (string) $row->TABLE_NAME;
	if ($actual !== $expected) throw new RuntimeException('The locked pre-rename MJL table set is not sealed.');
}

function rst005_require_target_namespace_available(DoliDB $db, $prefix)
{
	$foreignKeys = array('fk_mjl_activity_target_partner','fk_mjl_activity_target_project','fk_mjl_activity_target_creator','fk_mjl_activity_target_modifier');
	$quotedForeignKeys = "'".implode("','", array_map(array($db, 'escape'), $foreignKeys))."'";
	$count = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME IN (".$quotedForeignKeys.')');
	if ($count !== 0) throw new RuntimeException('RST-005 target foreign-key namespace is not available.');
	$triggers = array($prefix.'mjl_activity_rst005_bi',$prefix.'mjl_activity_rst005_bu',$prefix.'mjl_activity_rst005_bd',$prefix.'mjl_activity_rst005_cutover_guard');
	$quotedTriggers = "'".implode("','", array_map(array($db, 'escape'), $triggers))."'";
	$count = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN (".$quotedTriggers.')');
	if ($count !== 0) throw new RuntimeException('RST-005 target trigger namespace is not available.');
}

function rst005_require_phase1(DoliDB $db, $table)
{
	if (mjl_rst005_detect_schema($db, $table) !== RST005_SCHEMA_PHASE1) throw new RuntimeException('Live Activity schema is not the sealed Phase 1 shape.');
	mjl_rst005_assert_empty($db, $table);
	$constraints = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."'");
	$indexes = (int) mjl_rst005_scalar($db, "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."'");
	$triggers = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($table)."'");
	if ($constraints !== 5 || $indexes !== 6 || $triggers !== 0) throw new RuntimeException('Phase 1 Activity objects do not match the sealed containment schema.');
}

function rst005_sql_statements($path, $prefix, $fromTable, $toTable)
{
	$source = file_get_contents($path);
	if ($source === false) throw new RuntimeException('Unable to read RST-005 SQL source.');
	$source = str_replace('llx_', $prefix, $source);
	$source = str_replace($fromTable, $toTable, $source);
	$statements = array();
	foreach (preg_split('/;\s*(?:\r?\n|$)/', $source) as $statement) {
		$statement = trim($statement);
		if ($statement !== '') $statements[] = $statement;
	}
	return $statements;
}

function rst005_inject($actual, $requested, $message)
{
	if ($requested === $actual && getenv('MJL_DISPOSABLE_TEST_TENANT') === '1') throw new RuntimeException($message);
}

function rst005_create_target(DoliDB $db, $live, $target, $failurePoint = '')
{
	$root = dirname(__DIR__);
	$prefix = mjl_rst005_prefix($db);
	foreach (rst005_sql_statements($root.'/sql/llx_mjlfinancement_activity.sql', $prefix, $prefix.'mjlfinancement_activity', $target) as $sql) rst005_query($db, $sql, 'Unable to create target Activity table');
	rst005_inject('after-table-checks', $failurePoint, 'Injected RST-005 failure after target table/check group.');
	$index = 0;
	$foreignKey = 0;
	$trigger = 0;
	foreach (rst005_sql_statements($root.'/sql/llx_mjlfinancement_activity.key.sql', $prefix, $prefix.'mjlfinancement_activity', $target) as $sql) {
		rst005_query($db, $sql, 'Unable to create target Activity object');
		if (preg_match('/ADD (?:UNIQUE )?INDEX /i', $sql)) rst005_inject('after-index-'.(++$index), $failurePoint, 'Injected RST-005 failure after target index.');
		elseif (preg_match('/ADD CONSTRAINT .* FOREIGN KEY /i', $sql)) rst005_inject('after-foreign-key-'.(++$foreignKey), $failurePoint, 'Injected RST-005 failure after target foreign key.');
		elseif (preg_match('/CREATE TRIGGER /i', $sql)) rst005_inject('after-trigger-'.(++$trigger), $failurePoint, 'Injected RST-005 failure after target trigger.');
	}
	mjl_rst005_install_insert_trigger($db, $target);
	rst005_inject('after-trigger-'.(++$trigger), $failurePoint, 'Injected RST-005 failure after target trigger.');
	mjl_rst005_require_target_objects($db, $target);
	mjl_rst005_assert_empty($db, $target);
}

function rst005_create_phase1_restore(DoliDB $db, $restore)
{
	$oracle = __DIR__.'/oracles/rst005_phase1_activity.sql';
	$sql = file_get_contents($oracle);
	if ($sql === false || hash_file('sha256', $oracle) !== 'db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2') throw new RuntimeException('Phase 1 schema oracle is unavailable or changed.');
	$sql = str_replace('`llx_', '`'.mjl_rst005_prefix($db), trim($sql));
	$sql = str_replace(mjl_rst005_ident(mjl_rst005_prefix($db).'mjlfinancement_activity'), mjl_rst005_ident($restore), $sql);
	rst005_query($db, $sql, 'Unable to create Phase 1 restore table');
	rst005_require_phase1($db, $restore);
}

function rst005_require_or_normalize_quarantine(DoliDB $db, $quarantine, $prefix)
{
	try {
		rst005_require_phase1($db, $quarantine);
		return;
	} catch (RuntimeException $exception) {
		mjl_rst005_require_guarded_phase1($db, $quarantine);
		rst005_query($db, 'DROP TRIGGER '.mjl_rst005_ident($prefix.'mjl_activity_rst005_cutover_guard'), 'Unable to remove recovered RST-005 cutover guard');
		rst005_require_phase1($db, $quarantine);
	}
}

$options = rst005_arguments($argv);
if (!in_array($options['mode'], array('preflight','apply','verify','finalize','rollback'), true)) rst005_fail('Use --mode=preflight|apply|verify|finalize|rollback.');
if ($options['mode'] !== 'preflight' && $options['mode'] !== 'verify' && $options['confirm'] !== RST005_CONFIRMATION) rst005_fail('Exact RST-005 confirmation is required.');
$evidence = null;
if (in_array($options['mode'], array('apply','finalize','rollback'), true)) {
	try {
		rst005_require_disposable_mutation_boundary();
		$evidence = rst005_require_evidence($db, $options);
	} catch (RuntimeException $exception) { rst005_fail($exception->getMessage()); }
}

$lockName = '';
$tablesLocked = false;
try {
	$prefix = mjl_rst005_prefix($db);
	$live = $prefix.'mjlfinancement_activity';
	$target = $prefix.'mjlfinancement_activity_rst005_target';
	$quarantine = $prefix.'mjlfinancement_activity_rst005_phase1_quarantine';
	$restore = $prefix.'mjlfinancement_activity_rst005_phase1_restore';
	$failed = $prefix.'mjlfinancement_activity_rst005_target_failed';
	$lockName = mjl_rst005_lock_name($db);
	if ((int) mjl_rst005_scalar($db, "SELECT GET_LOCK('".$db->escape($lockName)."',".RST005_LOCK_TIMEOUT.')') !== 1) throw new RuntimeException('RST-005 advisory lock is unavailable.');
	$state = mjl_rst005_detect_schema($db, $live);
	if ($evidence !== null) {
		$requiredCheckpoint = '';
		if ($options['mode'] === 'finalize' || ($options['mode'] === 'rollback' && $state === RST005_SCHEMA_TARGET && !rst005_table_exists($db, $quarantine))) $requiredCheckpoint = 'post-activation-pre-finalization';
		rst005_require_checkpoint($evidence, $requiredCheckpoint);
	}

	if ($options['mode'] === 'preflight') {
		rst005_require_phase1($db, $live);
		mjl_rst005_require_retained_schema($db);
		rst005_require_no_downstream($db, $prefix);
		foreach (array($target,$quarantine,$restore,$failed) as $name) if (rst005_table_exists($db, $name)) throw new RuntimeException('Unexpected RST-005 temporary table: '.$name);
		rst005_require_target_namespace_available($db, $prefix);
		print json_encode(array('mode' => 'preflight', 'schema' => $state, 'rows' => 0, 'protected_tables_sha256' => rst005_protected_tables_sha($db), 'status' => 'ready'), JSON_PRETTY_PRINT).PHP_EOL;
	} elseif ($options['mode'] === 'verify') {
		mjl_rst005_require_target_objects($db, $live);
		mjl_rst005_require_retained_schema($db);
		rst005_require_no_downstream($db, $prefix);
		rst005_inject('during-verification', $options['failure-point'], 'Injected RST-005 failure during verification.');
		print json_encode(array('mode' => 'verify', 'schema' => RST005_SCHEMA_TARGET, 'rows' => (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($live)), 'protected_tables_sha256' => rst005_protected_tables_sha($db), 'status' => 'verified'), JSON_PRETTY_PRINT).PHP_EOL;
	} elseif ($options['mode'] === 'apply') {
		if ($state === RST005_SCHEMA_TARGET) {
			mjl_rst005_require_target_objects($db, $live);
			if (rst005_table_exists($db, $quarantine)) rst005_require_or_normalize_quarantine($db, $quarantine, $prefix);
			foreach (array($target,$restore,$failed) as $name) if (rst005_table_exists($db, $name)) throw new RuntimeException('Unknown RST-005 completed migration state: '.$name);
			print json_encode(array('mode' => 'apply', 'status' => rst005_table_exists($db, $quarantine) ? 'cutover_complete_pending_finalize' : 'already_complete'), JSON_PRETTY_PRINT).PHP_EOL;
		} else {
			$guard = $prefix.'mjl_activity_rst005_cutover_guard';
			$guarded = false;
			if ($state === RST005_SCHEMA_UNKNOWN && rst005_table_exists($db, $live)) {
				try { mjl_rst005_require_guarded_phase1($db, $live); $guarded = true; } catch (RuntimeException $unused) { $guarded = false; }
			}
			if (!$guarded) rst005_require_phase1($db, $live);
			rst005_require_no_downstream($db, $prefix);
			mjl_rst005_assert_retained_schema_digest($db);
			foreach (array($quarantine,$restore,$failed) as $name) if (rst005_table_exists($db, $name)) throw new RuntimeException('Unknown RST-005 migration state: '.$name);
			if (rst005_table_exists($db, $target)) {
				try {
					mjl_rst005_require_target_objects($db, $target);
					mjl_rst005_assert_empty($db, $target);
				} catch (RuntimeException $partial) {
					if (mjl_rst005_table_columns($db, $target) !== mjl_rst005_expected_columns(RST005_SCHEMA_TARGET)) throw $partial;
					mjl_rst005_assert_empty($db, $target);
					rst005_query($db, 'DROP TABLE '.mjl_rst005_ident($target), 'Unable to remove positively identified partial RST-005 target');
					rst005_create_target($db, $live, $target, $options['failure-point']);
				}
			} else {
				rst005_require_target_namespace_available($db, $prefix);
				rst005_create_target($db, $live, $target, $options['failure-point']);
			}
			if ($options['failure-point'] === 'after-target-create' && getenv('MJL_DISPOSABLE_TEST_TENANT') === '1') throw new RuntimeException('Injected RST-005 failure after target creation.');
			if (!$guarded) {
				rst005_query($db, mjl_rst005_cutover_guard_sql($prefix, $live), 'Unable to install RST-005 cutover containment guard');
				$guarded = true;
			}
			mjl_rst005_require_guarded_phase1($db, $live);
			if ($options['failure-point'] === 'after-cutover-guard' && getenv('MJL_DISPOSABLE_TEST_TENANT') === '1') throw new RuntimeException('Injected RST-005 failure after cutover guard.');
			$lockTables = array(mjl_rst005_ident($live).' WRITE', mjl_rst005_ident($target).' WRITE');
			$audit = $prefix.'mjlfinancement_audit_event';
			foreach (array('audit_event','invitation','operation_type','password_reset','project_note','user_role','user_soc_scope') as $suffix) {
				$lockTables[] = mjl_rst005_ident($prefix.'mjlfinancement_'.$suffix).' READ';
			}
			rst005_query($db, 'LOCK TABLES '.implode(', ', $lockTables), 'Unable to acquire RST-005 table locks');
			$tablesLocked = true;
			// Repeat every cutover premise while direct writers are excluded.
			mjl_rst005_require_guarded_phase1($db, $live);
			mjl_rst005_require_target_objects($db, $target);
			mjl_rst005_assert_empty($db, $live);
			mjl_rst005_assert_empty($db, $target);
			rst005_require_no_downstream($db, $prefix);
			rst005_require_pre_rename_table_set($db, $prefix, $target);
			mjl_rst005_assert_retained_schema_digest($db);
			if (rst005_table_exists($db, $audit)) {
				$count = (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($audit)." WHERE object_type='mjlfinancement_activity' OR activity_id IS NOT NULL");
				if ($count !== 0) throw new RuntimeException('Activity-linked audit rows appeared before cutover.');
			}
			if ($options['failure-point'] === 'after-locked-recheck' && getenv('MJL_DISPOSABLE_TEST_TENANT') === '1') throw new RuntimeException('Injected RST-005 failure after locked recheck.');
			rst005_query($db, 'UNLOCK TABLES', 'Unable to release RST-005 table locks after guarded verification');
			$tablesLocked = false;
			rst005_query($db, 'RENAME TABLE '.mjl_rst005_ident($live).' TO '.mjl_rst005_ident($quarantine).', '.mjl_rst005_ident($target).' TO '.mjl_rst005_ident($live), 'Atomic RST-005 cutover failed');
			if ($options['failure-point'] === 'after-atomic-rename' && getenv('MJL_DISPOSABLE_TEST_TENANT') === '1') throw new RuntimeException('Injected RST-005 failure after atomic rename.');
			rst005_query($db, 'DROP TRIGGER '.mjl_rst005_ident($guard), 'Unable to remove quarantined cutover containment guard');
			mjl_rst005_require_target_objects($db, $live);
			print json_encode(array('mode' => 'apply', 'status' => 'cutover_complete_pending_finalize'), JSON_PRETTY_PRINT).PHP_EOL;
		}
	} elseif ($options['mode'] === 'finalize') {
		mjl_rst005_require_target_objects($db, $live);
		mjl_rst005_assert_empty($db, $live);
		rst005_require_no_downstream($db, $prefix);
		if (rst005_table_exists($db, $quarantine)) {
			rst005_require_or_normalize_quarantine($db, $quarantine, $prefix);
			rst005_inject('before-finalize-drop', $options['failure-point'], 'Injected RST-005 failure before finalization drop.');
			rst005_query($db, 'DROP TABLE '.mjl_rst005_ident($quarantine), 'Unable to finalize RST-005 quarantine');
			rst005_inject('after-finalize-drop', $options['failure-point'], 'Injected RST-005 failure after finalization drop.');
		}
		foreach (array($target,$restore,$failed) as $name) if (rst005_table_exists($db, $name)) throw new RuntimeException('Unexpected RST-005 temporary table blocks finalization: '.$name);
		print json_encode(array('mode' => 'finalize', 'status' => 'complete'), JSON_PRETTY_PRINT).PHP_EOL;
	} else {
		if ($state === RST005_SCHEMA_PHASE1) {
			rst005_require_phase1($db, $live);
			rst005_require_no_downstream($db, $prefix);
			foreach (array($target,$quarantine,$restore,$failed) as $name) if (rst005_table_exists($db, $name)) throw new RuntimeException('Unknown RST-005 already-rolled-back state: '.$name);
			print json_encode(array('mode' => 'rollback', 'status' => 'already_phase1_containment'), JSON_PRETTY_PRINT).PHP_EOL;
		} else {
		mjl_rst005_require_target_objects($db, $live);
		mjl_rst005_assert_empty($db, $live);
		rst005_require_no_downstream($db, $prefix);
		if (rst005_table_exists($db, $quarantine)) {
			rst005_require_or_normalize_quarantine($db, $quarantine, $prefix);
			rst005_query($db, 'RENAME TABLE '.mjl_rst005_ident($live).' TO '.mjl_rst005_ident($failed).', '.mjl_rst005_ident($quarantine).' TO '.mjl_rst005_ident($live), 'Atomic RST-005 rollback failed');
		} else {
			if (rst005_table_exists($db, $restore) || rst005_table_exists($db, $failed)) throw new RuntimeException('Unknown RST-005 rollback state.');
			rst005_create_phase1_restore($db, $restore);
			rst005_query($db, 'RENAME TABLE '.mjl_rst005_ident($live).' TO '.mjl_rst005_ident($failed).', '.mjl_rst005_ident($restore).' TO '.mjl_rst005_ident($live), 'Atomic RST-005 reconstruction rollback failed');
		}
		rst005_require_phase1($db, $live);
		mjl_rst005_assert_empty($db, $failed);
		rst005_query($db, 'DROP TABLE '.mjl_rst005_ident($failed), 'Unable to remove verified failed target');
		print json_encode(array('mode' => 'rollback', 'status' => 'phase1_containment_restored'), JSON_PRETTY_PRINT).PHP_EOL;
		}
	}
} catch (Throwable $exception) {
	if ($tablesLocked) $db->query('UNLOCK TABLES');
	if ($lockName !== '') $db->query("SELECT RELEASE_LOCK('".$db->escape($lockName)."')");
	rst005_fail($exception->getMessage());
}

if ($tablesLocked) $db->query('UNLOCK TABLES');
if ($lockName !== '') $db->query("SELECT RELEASE_LOCK('".$db->escape($lockName)."')");
