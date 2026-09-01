<?php

const RST005_SCHEMA_PHASE1 = 'phase1';
const RST005_SCHEMA_TARGET = 'target';
const RST005_SCHEMA_UNKNOWN = 'unknown';
const RST002B_SCHEMA_TARGET = 'rst002b_target';
const RST002B_ACTIVITY_SCHEMA = 'rst002b_activity';
const RST005_PHASE1_ORACLE_SHA256 = 'db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2';
const RST005_TARGET_ORACLE_SHA256 = '8eb99ee99c6dc748bd368e925e9938ccf086291d264e3812ac6320c8ec06b745';
// Phase 1 acquired active_user_id through an ALTER, while a clean install
// creates that generated column beside is_active.  Column order has no
// behavioural effect, but both complete physical forms are sealed explicitly;
// no other retained-schema variation is accepted.
const RST005_RETAINED_SCHEMA_SHA256_PHASE1 = 'a1bfd62fb82e64da5f554e30caac306eef25549895f5a9674a1785781cb0c008';
const RST005_RETAINED_SCHEMA_SHA256_CLEAN = 'e2409271a246b152af6da1e7d320826436abb663dcc086f866af0339af395ae6';
const RST002B_RETAINED_SCHEMA_SHA256_PHASE1 = 'f41ea1932b79b858fbad0a81ef19704d4f624ab08e5c32424b69c8abf3069c2b';
const RST002B_RETAINED_SCHEMA_SHA256_CLEAN = 'b77cfe444e368d4f0fd1df2edadb81a0d6265311bcf2b86badfe3e79ae6658e5';
const RST002B_RETAINED_SCHEMA_SHA256_CLEAN_ALTERNATE = '40c2111960430cdbf804a26bb3e0da172ca65d93fd829a7873c172c80fd620bc';
const RST002B_PREFIX_RETAINED_SCHEMA_SHA256_PHASE1 = '6eac2f117ec8f99fe6b00b9ba46ddbcc7474ca704d439ae9b7d10d16daaea077';
const RST002B_PREFIX_RETAINED_SCHEMA_SHA256_CLEAN = '93f039485a012e4b429d46b4a07162f99640c3996850ac9a36ff8fde63935453';
const RST002B_RETAINED_TABLE_SHA256_PHASE1 = '61a38d78a2d453207a3197e8a17fce4a90b08837bd9ee2d999bc8e621a936ffd';
const RST002B_RETAINED_TABLE_SHA256_CLEAN = '75eadfa9cf6be10b091cd2cc9239760318cf9ceb20fe97aab6c0b6f070ea32cb';

function mjl_rst005_prefix(DoliDB $db)
{
	$prefix = (string) $db->prefix();
	if (!preg_match('/^[A-Za-z][A-Za-z0-9_]*$/', $prefix)) {
		throw new RuntimeException('Invalid configured database prefix.');
	}
	$derived = array(
		$prefix.'mjlfinancement_activity',
		$prefix.'mjlfinancement_activity_rst005_target',
		$prefix.'mjlfinancement_activity_rst005_phase1_quarantine',
		$prefix.'mjlfinancement_activity_rst005_phase1_restore',
		$prefix.'mjlfinancement_activity_rst005_target_failed',
		$prefix.'mjl_activity_rst005_bi',
		$prefix.'mjl_activity_rst005_bu',
		$prefix.'mjl_activity_rst005_bd',
		$prefix.'mjl_activity_rst005_cutover_guard',
		'uk_mjl_activity_entity_ref','idx_mjl_activity_entity_project','idx_mjl_activity_entity_partner',
		'idx_mjl_activity_entity_validation','idx_mjl_activity_project_fk','idx_mjl_activity_partner_fk',
		'idx_mjl_activity_creator','idx_mjl_activity_modifier','fk_mjl_activity_target_partner',
		'fk_mjl_activity_target_project','fk_mjl_activity_target_creator','fk_mjl_activity_target_modifier',
		'chk_mjl_activity_entity_positive','chk_mjl_activity_ref_nonblank','chk_mjl_activity_name_nonblank',
		'chk_mjl_activity_description_nonblank','chk_mjl_activity_dates','chk_mjl_activity_draft_amount',
		'chk_mjl_activity_first_amount','chk_mjl_activity_validated_amount','chk_mjl_activity_validation_status',
		'chk_mjl_activity_cancelled','chk_mjl_activity_version','chk_mjl_activity_responsible_dormant',
		'chk_mjl_activity_rst005_dormant',
	);
	mjl_rst005_validate_derived_identifiers($derived);
	if (strlen(mjl_rst005_lock_name_from_parts('', $prefix)) > 64) throw new RuntimeException('RST-005 advisory lock name is too long.');
	return $prefix;
}

function mjl_rst005_validate_derived_identifiers(array $derived)
{
	if (count($derived) !== count(array_unique($derived))) throw new RuntimeException('RST-005 derived database identifiers collide.');
	foreach ($derived as $identifier) {
		if (!preg_match('/^[A-Za-z][A-Za-z0-9_]*$/', $identifier) || strlen($identifier) > 64) throw new RuntimeException('RST-005 derived database identifier is unsafe or too long.');
	}
}

function mjl_rst005_ident($identifier)
{
	if (!preg_match('/^[A-Za-z][A-Za-z0-9_]*$/', (string) $identifier) || strlen((string) $identifier) > 64) {
		throw new RuntimeException('Unsafe RST-005 database identifier.');
	}
	return '`'.$identifier.'`';
}

function mjl_rst005_lock_name_from_parts($database, $prefix)
{
	return 'mjl:rst005:'.substr(hash('sha256', (string) $database.':'.(string) $prefix.':RST-005'), 0, 48);
}

function mjl_rst005_lock_name(DoliDB $db)
{
	$prefix = mjl_rst005_prefix($db);
	$database = (string) mjl_rst005_scalar($db, 'SELECT DATABASE()');
	// MariaDB lock names are limited to 64 characters. Keep the unit marker
	// readable while binding the remaining bytes to the exact database/prefix.
	$name = mjl_rst005_lock_name_from_parts($database, $prefix);
	if (strlen($name) > 64) throw new RuntimeException('RST-005 advisory lock name is too long.');
	return $name;
}

function mjl_rst005_require_retained_table_set(DoliDB $db)
{
	$prefix = mjl_rst005_prefix($db);
	$expected = array_map(function ($suffix) use ($prefix) { return $prefix.'mjlfinancement_'.$suffix; }, array(
		'activity','audit_event','invitation','operation_type','password_reset','project_note','user_role','user_soc_scope',
	));
	sort($expected, SORT_STRING);
	$quarantine = $prefix.'mjlfinancement_activity_rst005_phase1_quarantine';
	$actual = array();
	$sql = "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE '".$db->escape($prefix)."mjlfinancement\\_%' ORDER BY TABLE_NAME";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect the retained MJL table set.');
	while ($row = $db->fetch_object($resql)) $actual[] = (string) $row->TABLE_NAME;
	$reversible = $expected;
	$reversible[] = $quarantine;
	sort($reversible, SORT_STRING);
	if ($actual === $reversible) {
		if (mjl_rst005_detect_schema($db, $quarantine) !== RST005_SCHEMA_PHASE1) throw new RuntimeException('The retained RST-005 quarantine does not match sealed Phase 1.');
		mjl_rst005_assert_empty($db, $quarantine);
		return;
	}
	if ($actual !== $expected) throw new RuntimeException('The retained MJL table set is partial or contains an unapproved successor table: actual='.json_encode($actual).' expected='.json_encode($expected));
}

function mjl_rst005_retained_schema_digest(DoliDB $db)
{
	$prefix = mjl_rst005_prefix($db);
	$tables = array_map(function ($suffix) use ($prefix) { return $prefix.'mjlfinancement_'.$suffix; }, array(
		'audit_event','invitation','operation_type','password_reset','project_note','user_role','user_soc_scope',
	));
	sort($tables, SORT_STRING);
	$definitions = array();
	foreach ($tables as $table) {
		$resql = $db->query('SHOW CREATE TABLE '.mjl_rst005_ident($table));
		$row = $resql ? $db->fetch_row($resql) : null;
		if (!$row || !isset($row[1])) throw new RuntimeException('Unable to inspect retained MJL schema: '.$table);
		$create = preg_replace('/\sAUTO_INCREMENT=\d+\b/i', '', (string) $row[1]);
		$create = str_replace(array('`'.$prefix, $prefix), array('`llx_', 'llx_'), $create);
		$definitions[] = 'table|'.str_replace($prefix, 'llx_', $table).'|'.$create;
	}
	$sql = "SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,EVENT_OBJECT_TABLE,ACTION_STATEMENT,ACTION_ORIENTATION FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE IN ('".implode("','", array_map(array($db, 'escape'), $tables))."') ORDER BY TRIGGER_NAME";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect retained MJL triggers.');
	while ($row = $db->fetch_array($resql)) {
		$values = array($row['TRIGGER_NAME'],$row['ACTION_TIMING'],$row['EVENT_MANIPULATION'],$row['EVENT_OBJECT_TABLE'],$row['ACTION_STATEMENT'],$row['ACTION_ORIENTATION']);
		$definitions[] = 'trigger|'.str_replace($prefix, 'llx_', implode('|', $values));
	}
	return hash('sha256', implode("\n", $definitions)."\n");
}

function mjl_rst002b_retained_schema_digest(DoliDB $db, $includeTriggers = true)
{
	$prefix = mjl_rst005_prefix($db);
	$tables = array_map(function ($suffix) use ($prefix) { return $prefix.'mjlfinancement_'.$suffix; }, array(
		'audit_event','invitation','operation_type','password_reset','project_note','user_role',
	));
	sort($tables, SORT_STRING);
	$definitions = array();
	foreach ($tables as $table) {
		$resql = $db->query('SHOW CREATE TABLE '.mjl_rst005_ident($table));
		$row = $resql ? $db->fetch_row($resql) : null;
		if (!$row || !isset($row[1])) throw new RuntimeException('Unable to inspect RST-002B retained schema: '.$table);
		$create = preg_replace('/\sAUTO_INCREMENT=\d+\b/i', '', (string) $row[1]);
		$create = str_replace(array('`'.$prefix, $prefix), array('`llx_', 'llx_'), $create);
		$definitions[] = 'table|'.str_replace($prefix, 'llx_', $table).'|'.$create;
	}
	if ($includeTriggers) {
		$sql = "SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,EVENT_OBJECT_TABLE,ACTION_STATEMENT,ACTION_ORIENTATION FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE IN ('".implode("','", array_map(array($db, 'escape'), $tables))."') ORDER BY TRIGGER_NAME";
		$resql = $db->query($sql);
		if (!$resql) throw new RuntimeException('Unable to inspect RST-002B retained triggers.');
		while ($row = $db->fetch_array($resql)) {
			$values = array($row['TRIGGER_NAME'],$row['ACTION_TIMING'],$row['EVENT_MANIPULATION'],$row['EVENT_OBJECT_TABLE'],$row['ACTION_STATEMENT'],$row['ACTION_ORIENTATION']);
			$definitions[] = 'trigger|'.str_replace($prefix, 'llx_', implode('|', $values));
		}
	}
	return hash('sha256', implode("\n", $definitions)."\n");
}

function mjl_rst002b_require_retained_schema(DoliDB $db)
{
	mjl_rst002b_require_table_set($db);
	$digest = mjl_rst002b_retained_schema_digest($db);
	if (!hash_equals(RST002B_RETAINED_SCHEMA_SHA256_PHASE1, $digest) && !hash_equals(RST002B_RETAINED_SCHEMA_SHA256_CLEAN, $digest) && !hash_equals(RST002B_RETAINED_SCHEMA_SHA256_CLEAN_ALTERNATE, $digest)) throw new RuntimeException('The retained MJL schema does not match a sealed RST-002B physical form: '.$digest);
}

function mjl_rst002b_require_prefix_retained_schema(DoliDB $db)
{
	mjl_rst002b_require_table_set($db);
	$digest = mjl_rst002b_retained_schema_digest($db, false);
	if (!hash_equals(RST002B_RETAINED_TABLE_SHA256_PHASE1, $digest) && !hash_equals(RST002B_RETAINED_TABLE_SHA256_CLEAN, $digest)) throw new RuntimeException('The retained MJL table schema does not match a sealed RST-002B physical form: '.$digest);
}

function mjl_rst002b_require_table_set(DoliDB $db)
{
	$prefix = mjl_rst005_prefix($db);
	$expected = array_map(function ($suffix) use ($prefix) { return $prefix.'mjlfinancement_'.$suffix; }, array('activity','activity_assignment','audit_event','invitation','operation_type','password_reset','project_note','user_role'));
	sort($expected, SORT_STRING);
	$actual = array();
	$resql = $db->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE '".$db->escape($prefix)."mjlfinancement\\_%' ORDER BY TABLE_NAME");
	if (!$resql) throw new RuntimeException('Unable to inspect the RST-002B table set.');
	while ($row = $db->fetch_object($resql)) $actual[] = (string) $row->TABLE_NAME;
	if ($actual !== $expected) throw new RuntimeException('The retained RST-002B table set is partial or contains an unapproved successor table.');
}

function mjl_rst005_require_retained_schema(DoliDB $db)
{
	mjl_rst005_require_retained_table_set($db);
	mjl_rst005_assert_retained_schema_digest($db);
}

function mjl_rst005_assert_retained_schema_digest(DoliDB $db)
{
	$digest = mjl_rst005_retained_schema_digest($db);
	if (!hash_equals(RST005_RETAINED_SCHEMA_SHA256_PHASE1, $digest) && !hash_equals(RST005_RETAINED_SCHEMA_SHA256_CLEAN, $digest)) throw new RuntimeException('The retained MJL schema does not match either sealed RST-005 physical form: '.$digest);
}

function mjl_rst005_expected_columns($flavour)
{
	if ($flavour === RST005_SCHEMA_PHASE1) {
		return array('rowid','entity','ref','label','fk_project','fk_task','date_start','date_end','note_public','note_private','date_creation','tms','fk_user_creat','fk_user_modif','import_key','status','fk_user_responsible','date_actual_start','date_actual_end','physical_execution_percent','execution_status','execution_comment');
	}
	if ($flavour === RST005_SCHEMA_TARGET) {
		return array('rowid','entity','ref','fk_partner','fk_project','name','description','date_start','date_end','draft_authorized_amount','first_submitted_amount','latest_validated_amount','validation_status','is_cancelled','version','date_creation','tms','fk_user_creat','fk_user_modif','fk_user_responsible');
	}
	return array();
}

function mjl_rst005_normalize_definition($value)
{
	$value = (string) $value;
	$result = '';
	$quoted = false;
	for ($index = 0, $length = strlen($value); $index < $length; $index++) {
		$character = $value[$index];
		if ($quoted) {
			$result .= $character;
			if ($character === "'" && ($index + 1 >= $length || $value[$index + 1] !== "'")) $quoted = false;
			elseif ($character === "'" && $index + 1 < $length && $value[$index + 1] === "'") $result .= $value[++$index];
			elseif ($character === '\\' && $index + 1 < $length) $result .= $value[++$index];
			continue;
		}
		if ($character === "'") {
			$quoted = true;
			$result .= $character;
		} elseif ($character !== '`' && !ctype_space($character)) $result .= strtolower($character);
	}
	if ($quoted) throw new RuntimeException('Unterminated quoted literal in RST-005 database definition.');
	while (strlen($result) > 1 && $result[0] === '(' && substr($result, -1) === ')' && mjl_rst005_outer_parentheses_wrap($result)) $result = substr($result, 1, -1);
	return $result;
}

function mjl_rst005_outer_parentheses_wrap($value)
{
	$depth = 0;
	$quoted = false;
	for ($index = 0, $length = strlen($value); $index < $length; $index++) {
		$character = $value[$index];
		if ($character === "'" && ($index === 0 || $value[$index - 1] !== '\\')) $quoted = !$quoted;
		if ($quoted) continue;
		if ($character === '(') $depth++;
		elseif ($character === ')') {
			$depth--;
			if ($depth === 0 && $index !== $length - 1) return false;
			if ($depth < 0) return false;
		}
	}
	return !$quoted && $depth === 0;
}

function mjl_rst005_column_contract($flavour)
{
	if ($flavour === RST005_SCHEMA_PHASE1) return array(
		'rowid'=>'int(11)|NO||auto_increment|', 'entity'=>'int(11)|NO|1||', 'ref'=>'varchar(128)|NO|||', 'label'=>'varchar(255)|NO|||',
		'fk_project'=>'int(11)|NO|||', 'fk_task'=>'int(11)|YES|NULL||', 'date_start'=>'date|YES|NULL||', 'date_end'=>'date|YES|NULL||',
		'note_public'=>'text|YES|NULL||', 'note_private'=>'text|YES|NULL||', 'date_creation'=>'datetime|NO|||',
		'tms'=>'timestamp|YES|current_timestamp()|on update current_timestamp()|', 'fk_user_creat'=>'int(11)|NO|||', 'fk_user_modif'=>'int(11)|YES|NULL||',
		'import_key'=>'varchar(14)|YES|NULL||', 'status'=>'int(11)|NO|0||', 'fk_user_responsible'=>'int(11)|YES|NULL||',
		'date_actual_start'=>'date|YES|NULL||', 'date_actual_end'=>'date|YES|NULL||', 'physical_execution_percent'=>'int(11)|YES|NULL||',
		'execution_status'=>'varchar(32)|YES|NULL||', 'execution_comment'=>'text|YES|NULL||',
	);
	if ($flavour === RST005_SCHEMA_TARGET) return array(
		'rowid'=>'int(11)|NO||auto_increment|', 'entity'=>'int(11)|NO|||', 'ref'=>'varchar(128)|NO|||', 'fk_partner'=>'int(11)|NO|||',
		'fk_project'=>'int(11)|NO|||', 'name'=>'varchar(255)|NO|||', 'description'=>'text|NO|||', 'date_start'=>'date|NO|||', 'date_end'=>'date|NO|||',
		'draft_authorized_amount'=>'bigint(20)|NO|||', 'first_submitted_amount'=>'bigint(20)|YES|NULL||', 'latest_validated_amount'=>'bigint(20)|YES|NULL||',
		'validation_status'=>"varchar(40)|NO|'DRAFT'||", 'is_cancelled'=>'tinyint(1)|NO|0||', 'version'=>'bigint(20)|NO|1||',
		'date_creation'=>'datetime|NO|||', 'tms'=>'timestamp|NO|current_timestamp()|on update current_timestamp()|',
		'fk_user_creat'=>'int(11)|NO|||', 'fk_user_modif'=>'int(11)|YES|NULL||', 'fk_user_responsible'=>'int(11)|YES|NULL||',
	);
	if ($flavour === RST002B_ACTIVITY_SCHEMA) {
		$contract = mjl_rst005_column_contract(RST005_SCHEMA_TARGET);
		unset($contract['fk_user_responsible']);
		return $contract;
	}
	return array();
}

function mjl_rst005_index_contract($flavour)
{
	if ($flavour === RST005_SCHEMA_PHASE1) return array(
		'PRIMARY'=>'U|BTREE|A:0:rowid', 'idx_mjlfinancement_activity_entity'=>'N|BTREE|A:0:entity',
		'idx_mjlfinancement_activity_fk_project'=>'N|BTREE|A:0:fk_project', 'idx_mjlfinancement_activity_fk_task'=>'N|BTREE|A:0:fk_task',
		'idx_mjlfinancement_activity_fk_user_responsible'=>'N|BTREE|A:0:fk_user_responsible',
		'uk_mjlfinancement_activity_ref_entity'=>'U|BTREE|A:0:ref,A:0:entity',
	);
	if ($flavour === RST005_SCHEMA_TARGET) return array(
		'PRIMARY'=>'U|BTREE|A:0:rowid', 'uk_mjl_activity_entity_ref'=>'U|BTREE|A:0:entity,A:0:ref',
		'idx_mjl_activity_entity_project'=>'N|BTREE|A:0:entity,A:0:fk_project', 'idx_mjl_activity_entity_partner'=>'N|BTREE|A:0:entity,A:0:fk_partner',
		'idx_mjl_activity_entity_validation'=>'N|BTREE|A:0:entity,A:0:validation_status', 'idx_mjl_activity_project_fk'=>'N|BTREE|A:0:fk_project',
		'idx_mjl_activity_partner_fk'=>'N|BTREE|A:0:fk_partner', 'idx_mjl_activity_creator'=>'N|BTREE|A:0:fk_user_creat',
		'idx_mjl_activity_modifier'=>'N|BTREE|A:0:fk_user_modif',
	);
	if ($flavour === RST002B_ACTIVITY_SCHEMA) return mjl_rst005_index_contract(RST005_SCHEMA_TARGET);
	return array();
}

function mjl_rst005_fk_contract($flavour, $prefix)
{
	if ($flavour === RST005_SCHEMA_PHASE1) return array(
		'fk_mjlfinancement_activity_project'=>'fk_project>'.$prefix.'projet:rowid|RESTRICT|RESTRICT',
		'fk_mjlfinancement_activity_responsible'=>'fk_user_responsible>'.$prefix.'user:rowid|RESTRICT|RESTRICT',
		'fk_mjlfinancement_activity_task'=>'fk_task>'.$prefix.'projet_task:rowid|RESTRICT|RESTRICT',
	);
	if ($flavour === RST005_SCHEMA_TARGET) return array(
		'fk_mjl_activity_target_partner'=>'fk_partner>'.$prefix.'societe:rowid|RESTRICT|RESTRICT',
		'fk_mjl_activity_target_project'=>'fk_project>'.$prefix.'projet:rowid|RESTRICT|RESTRICT',
		'fk_mjl_activity_target_creator'=>'fk_user_creat>'.$prefix.'user:rowid|RESTRICT|RESTRICT',
		'fk_mjl_activity_target_modifier'=>'fk_user_modif>'.$prefix.'user:rowid|RESTRICT|RESTRICT',
	);
	if ($flavour === RST002B_ACTIVITY_SCHEMA) return mjl_rst005_fk_contract(RST005_SCHEMA_TARGET, $prefix);
	return array();
}

function mjl_rst005_check_contract($flavour)
{
	if ($flavour === RST005_SCHEMA_PHASE1) return array();
	if ($flavour !== RST005_SCHEMA_TARGET && $flavour !== RST002B_ACTIVITY_SCHEMA) return array();
	$contract = array(
		'chk_mjl_activity_entity_positive'=>'entity>0', 'chk_mjl_activity_ref_nonblank'=>"refregexp'[^[:space:]]'",
		'chk_mjl_activity_name_nonblank'=>"nameregexp'[^[:space:]]'", 'chk_mjl_activity_description_nonblank'=>"descriptionregexp'[^[:space:]]'",
		'chk_mjl_activity_dates'=>'date_end>=date_start', 'chk_mjl_activity_draft_amount'=>'draft_authorized_amount>=0',
		'chk_mjl_activity_first_amount'=>'first_submitted_amountisnullorfirst_submitted_amount>=0',
		'chk_mjl_activity_validated_amount'=>'latest_validated_amountisnullorlatest_validated_amount>=0',
		'chk_mjl_activity_validation_status'=>"validation_statusin('DRAFT','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED')",
		'chk_mjl_activity_cancelled'=>"is_cancelledin(0,1)and(is_cancelled=1andvalidation_status='CANCELLED'or is_cancelled=0andvalidation_status<>'CANCELLED')",
		'chk_mjl_activity_version'=>'version>=1', 'chk_mjl_activity_responsible_dormant'=>'fk_user_responsibleisnull',
		'chk_mjl_activity_rst005_dormant'=>"validation_status='DRAFT'andis_cancelled=0andfirst_submitted_amountisnullandlatest_validated_amountisnull",
	);
	if ($flavour === RST002B_ACTIVITY_SCHEMA) unset($contract['chk_mjl_activity_responsible_dormant']);
	return $contract;
}

function mjl_rst005_map_equal(array $actual, array $expected)
{
	ksort($actual);
	ksort($expected);
	return $actual === $expected;
}

function mjl_rst005_map_mismatch(array $actual, array $expected)
{
	ksort($actual);
	ksort($expected);
	foreach (array_unique(array_merge(array_keys($actual), array_keys($expected))) as $name) {
		$a = array_key_exists($name, $actual) ? $actual[$name] : '<missing>';
		$e = array_key_exists($name, $expected) ? $expected[$name] : '<unexpected>';
		if ($a !== $e) return $name.' actual='.json_encode($a).' expected='.json_encode($e);
	}
	return 'unknown mismatch';
}

function mjl_rst002b_assignment_table(DoliDB $db)
{
	return mjl_rst005_prefix($db).'mjlfinancement_activity_assignment';
}

function mjl_rst002b_table_exists(DoliDB $db, $table)
{
	return (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape((string) $table)."' AND TABLE_TYPE='BASE TABLE'") === 1;
}

function mjl_rst002b_column_exists(DoliDB $db, $table, $column)
{
	return (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape((string) $table)."' AND COLUMN_NAME='".$db->escape((string) $column)."'") === 1;
}

function mjl_rst002b_assignment_trigger_statements(DoliDB $db)
{
	$prefix = mjl_rst005_prefix($db);
	$assignment = $prefix.'mjlfinancement_activity_assignment';
	$activity = $prefix.'mjlfinancement_activity';
	$user = $prefix.'user';
	$role = $prefix.'mjlfinancement_user_role';
	$statements = array(
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjl_activity_assignment_bi BEFORE INSERT ON '.$assignment.' FOR EACH ROW BEGIN DECLARE activity_ok INTEGER DEFAULT 0; DECLARE agent_ok INTEGER DEFAULT 0; DECLARE assigner_ok INTEGER DEFAULT 0; IF NEW.fk_user_assign IS NULL OR NEW.date_end IS NOT NULL THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'RST-002B requires a current assignment by a Validator\'; END IF; SET NEW.date_start=CURRENT_TIMESTAMP; SET NEW.date_creation=CURRENT_TIMESTAMP; SET NEW.tms=CURRENT_TIMESTAMP; SELECT COUNT(*) INTO activity_ok FROM '.$activity.' a WHERE a.rowid=NEW.fk_activity AND a.entity=NEW.entity; SELECT COUNT(*) INTO agent_ok FROM '.$user.' u INNER JOIN '.$role.' r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code=\'AGENT_SAISIE\' WHERE u.rowid=NEW.fk_user AND u.entity=NEW.entity AND u.statut=1 AND u.admin=0; SELECT COUNT(*) INTO assigner_ok FROM '.$user.' u INNER JOIN '.$role.' r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code=\'VALIDATEUR_DEFINITIF\' WHERE u.rowid=NEW.fk_user_assign AND u.entity=NEW.entity AND u.statut=1 AND u.admin=0; IF activity_ok<>1 OR agent_ok<>1 OR assigner_ok<>1 THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid RST-002B assignment\'; END IF; END',
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjl_activity_assignment_bu BEFORE UPDATE ON '.$assignment.' FOR EACH ROW BEGIN IF NEW.rowid<>OLD.rowid OR NEW.entity<>OLD.entity OR NEW.fk_activity<>OLD.fk_activity OR NEW.fk_user<>OLD.fk_user OR NEW.is_primary<>OLD.is_primary OR NEW.date_start<>OLD.date_start OR NOT (NEW.fk_user_assign<=>OLD.fk_user_assign) OR NEW.reason<>OLD.reason OR NEW.date_creation<>OLD.date_creation OR OLD.date_end IS NOT NULL OR NEW.date_end IS NULL THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'MJL Activity assignment history is immutable\'; END IF; SET NEW.date_end=CURRENT_TIMESTAMP; SET NEW.tms=CURRENT_TIMESTAMP; END',
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjl_activity_assignment_bd BEFORE DELETE ON '.$assignment.' FOR EACH ROW SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'MJL Activity assignments are append-only\'',
	);
	return $statements;
}

function mjl_rst002b_install_assignment_triggers(DoliDB $db)
{
	foreach (mjl_rst002b_assignment_trigger_statements($db) as $sql) if (!$db->query($sql)) throw new RuntimeException('Unable to install RST-002B assignment trigger: '.$db->lasterror());
}

function mjl_rst002b_activity_update_trigger_sql(DoliDB $db)
{
	$prefix = mjl_rst005_prefix($db);
	$table = $prefix.'mjlfinancement_activity';
	$immutable = array('rowid','entity','ref','fk_partner','fk_project','name','description','date_start','date_end','draft_authorized_amount','first_submitted_amount','latest_validated_amount','validation_status','is_cancelled','date_creation','fk_user_creat');
	$guards = array();
	foreach ($immutable as $column) $guards[] = 'NOT (NEW.'.$column.'<=>OLD.'.$column.')';
	return 'CREATE OR REPLACE TRIGGER '.$prefix.'mjl_activity_rst002b_bu BEFORE UPDATE ON '.$table.' FOR EACH ROW BEGIN IF NEW.version<>OLD.version+1 OR '.implode(' OR ', $guards).' THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Only RST-002B assignment version updates are permitted\'; END IF; END';
}

function mjl_rst002b_install_activity_update_trigger(DoliDB $db)
{
	$prefix = mjl_rst005_prefix($db);
	$db->query('DROP TRIGGER IF EXISTS '.mjl_rst005_ident($prefix.'mjl_activity_rst005_bu'));
	$sql = mjl_rst002b_activity_update_trigger_sql($db);
	if (!$db->query($sql)) throw new RuntimeException('Unable to install RST-002B Activity guard: '.$db->lasterror());
}

function mjl_rst002b_role_invariant_trigger_statements(DoliDB $db, $assignmentGuards = true)
{
	$prefix = mjl_rst005_prefix($db);
	$roleTable = $prefix.'mjlfinancement_user_role';
	$userTable = $prefix.'user';
	$assignmentTable = $prefix.'mjlfinancement_activity_assignment';
	if ($assignmentGuards && !mjl_rst002b_table_exists($db, $assignmentTable)) throw new RuntimeException('RST-002B assignment table is absent.');
	$businessRoles = "'AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'";
	if (!$assignmentGuards) return array(
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjlfinancement_user_role_bi BEFORE INSERT ON '.$roleTable.' FOR EACH ROW BEGIN DECLARE target_admin INTEGER DEFAULT 0; DECLARE target_entity INTEGER DEFAULT -1; IF NEW.role_code NOT IN ('.$businessRoles.') THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL business role\'; END IF; SELECT admin, entity INTO target_admin, target_entity FROM '.$userTable.' WHERE rowid = NEW.fk_user; IF target_entity <> NEW.entity OR (NEW.is_active = 1 AND target_admin = 1) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL role target\'; END IF; END',
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjlfinancement_user_role_bu BEFORE UPDATE ON '.$roleTable.' FOR EACH ROW BEGIN DECLARE target_admin INTEGER DEFAULT 0; DECLARE target_entity INTEGER DEFAULT -1; IF NEW.role_code NOT IN ('.$businessRoles.') THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL business role\'; END IF; SELECT admin, entity INTO target_admin, target_entity FROM '.$userTable.' WHERE rowid = NEW.fk_user; IF target_entity <> NEW.entity OR (NEW.is_active = 1 AND target_admin = 1) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL role target\'; END IF; END',
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjlfinancement_user_admin_bu BEFORE UPDATE ON '.$userTable.' FOR EACH ROW BEGIN IF NEW.admin = 1 AND OLD.admin <> 1 AND EXISTS (SELECT 1 FROM '.$roleTable.' WHERE fk_user = NEW.rowid AND is_active = 1 AND role_code IN ('.$businessRoles.')) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'MJL business-role user cannot become native admin\'; END IF; END',
	);
	$roleGuard = $assignmentGuards ? ' IF OLD.role_code=\'AGENT_SAISIE\' AND OLD.is_active=1 AND (NEW.role_code<>\'AGENT_SAISIE\' OR NEW.is_active<>1 OR NEW.entity<>OLD.entity OR NEW.fk_user<>OLD.fk_user) AND EXISTS (SELECT 1 FROM '.$assignmentTable.' WHERE entity=OLD.entity AND fk_user=OLD.fk_user AND date_end IS NULL) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Assigned Agent role is immutable\'; END IF;' : '';
	$userGuard = $assignmentGuards ? ' IF (NEW.statut<>1 OR NEW.admin=1 OR NEW.entity<>OLD.entity) AND EXISTS (SELECT 1 FROM '.$assignmentTable.' WHERE entity=OLD.entity AND fk_user=OLD.rowid AND date_end IS NULL) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Assigned Agent user is immutable\'; END IF;' : '';
	$deleteGuard = $assignmentGuards ? ' IF OLD.role_code=\'AGENT_SAISIE\' AND OLD.is_active=1 AND EXISTS (SELECT 1 FROM '.$assignmentTable.' WHERE entity=OLD.entity AND fk_user=OLD.fk_user AND date_end IS NULL) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Assigned Agent role cannot be deleted\'; END IF;' : '';
	$statements = array(
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjlfinancement_user_role_bi BEFORE INSERT ON '.$roleTable.' FOR EACH ROW BEGIN DECLARE target_admin INTEGER DEFAULT 0; DECLARE target_entity INTEGER DEFAULT -1; IF NEW.role_code NOT IN ('.$businessRoles.') THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid MJL business role\'; END IF; SELECT admin,entity INTO target_admin,target_entity FROM '.$userTable.' WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity OR (NEW.is_active=1 AND target_admin=1) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid MJL role target\'; END IF; END',
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjlfinancement_user_role_bu BEFORE UPDATE ON '.$roleTable.' FOR EACH ROW BEGIN DECLARE target_admin INTEGER DEFAULT 0; DECLARE target_entity INTEGER DEFAULT -1;'.$roleGuard.' IF NEW.role_code NOT IN ('.$businessRoles.') THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid MJL business role\'; END IF; SELECT admin,entity INTO target_admin,target_entity FROM '.$userTable.' WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity OR (NEW.is_active=1 AND target_admin=1) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid MJL role target\'; END IF; END',
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjlfinancement_user_role_bd BEFORE DELETE ON '.$roleTable.' FOR EACH ROW BEGIN'.$deleteGuard.' END',
		'CREATE OR REPLACE TRIGGER '.$prefix.'mjlfinancement_user_admin_bu BEFORE UPDATE ON '.$userTable.' FOR EACH ROW BEGIN'.$userGuard.' IF NEW.admin=1 AND OLD.admin<>1 AND EXISTS (SELECT 1 FROM '.$roleTable.' WHERE fk_user=NEW.rowid AND is_active=1 AND role_code IN ('.$businessRoles.')) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'MJL business-role user cannot become native admin\'; END IF; END',
	);
	return $statements;
}

function mjl_rst002b_install_role_invariant_triggers(DoliDB $db, $assignmentGuards = true)
{
	if (!$assignmentGuards) $db->query('DROP TRIGGER IF EXISTS '.mjl_rst005_ident(mjl_rst005_prefix($db).'mjlfinancement_user_role_bd'));
	foreach (mjl_rst002b_role_invariant_trigger_statements($db, $assignmentGuards) as $sql) if (!$db->query($sql)) throw new RuntimeException('Unable to install MJL role invariant trigger: '.$db->lasterror());
}

function mjl_rst002b_detect_schema(DoliDB $db)
{
	$prefix = mjl_rst005_prefix($db);
	$activity = $prefix.'mjlfinancement_activity';
	$assignment = $prefix.'mjlfinancement_activity_assignment';
	$scope = $prefix.'mjlfinancement_user_soc_scope';
	if (!mjl_rst002b_table_exists($db, $activity)) return RST005_SCHEMA_UNKNOWN;
	$oldColumn = mjl_rst002b_column_exists($db, $activity, 'fk_user_responsible');
	$assignmentExists = mjl_rst002b_table_exists($db, $assignment);
	$scopeExists = mjl_rst002b_table_exists($db, $scope);
	$guard = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='".$db->escape($prefix)."mjl_activity_rst002b_bu'");
	$assignmentGuards = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($assignment)."' AND TRIGGER_NAME IN ('".$db->escape($prefix)."mjl_activity_assignment_bi','".$db->escape($prefix)."mjl_activity_assignment_bu','".$db->escape($prefix)."mjl_activity_assignment_bd')");
	$roleGuards = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($prefix.'mjlfinancement_user_role')."' AND TRIGGER_NAME IN ('".$db->escape($prefix)."mjlfinancement_user_role_bi','".$db->escape($prefix)."mjlfinancement_user_role_bu','".$db->escape($prefix)."mjlfinancement_user_role_bd')");
	if (!$oldColumn && $assignmentExists && !$scopeExists && $guard === 1 && $assignmentGuards === 3 && $roleGuards === 3) return RST002B_SCHEMA_TARGET;
	return RST005_SCHEMA_UNKNOWN;
}

function mjl_rst002b_expected_trigger_map(array $statements)
{
	$result = array();
	foreach ($statements as $sql) {
		if (!preg_match('/^CREATE OR REPLACE TRIGGER ([A-Za-z][A-Za-z0-9_]*) (BEFORE (?:INSERT|UPDATE|DELETE)) ON [A-Za-z][A-Za-z0-9_]* FOR EACH ROW (.*)$/s', $sql, $match)) throw new RuntimeException('Unable to parse an RST-002B trigger contract.');
		$result[$match[1]] = $match[2].':'.mjl_rst005_normalize_definition($match[3]);
	}
	ksort($result);
	return $result;
}

function mjl_rst002b_actual_trigger_map(DoliDB $db, $table)
{
	$result = array();
	$sql = "SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($table)."' ORDER BY TRIGGER_NAME";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect RST-002B trigger definitions.');
	while ($row = $db->fetch_array($resql)) $result[$row['TRIGGER_NAME']] = $row['ACTION_TIMING'].' '.$row['EVENT_MANIPULATION'].':'.mjl_rst005_normalize_definition($row['ACTION_STATEMENT']);
	ksort($result);
	return $result;
}

function mjl_rst002b_require_assignment_contract(DoliDB $db, $table, $withTriggers = true)
{
	$prefix = mjl_rst005_prefix($db);
	$resql = $db->query("SELECT ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND TABLE_TYPE='BASE TABLE'");
	$engine = $resql ? $db->fetch_object($resql) : null;
	if (!$engine || (string) $engine->ENGINE !== 'InnoDB' || (string) $engine->TABLE_COLLATION !== 'utf8mb4_uca1400_ai_ci') throw new RuntimeException('RST-002B assignment engine or collation mismatch.');

	$expectedColumns = array(
		'rowid'=>'bigint(20)|NO||auto_increment|', 'entity'=>'int(11)|NO|||', 'fk_activity'=>'int(11)|NO|||', 'fk_user'=>'int(11)|NO|||',
		'is_primary'=>'tinyint(1)|NO|0||', 'date_start'=>'datetime|NO|||', 'date_end'=>'datetime|YES|NULL||', 'fk_user_assign'=>'int(11)|YES|NULL||',
		'reason'=>'text|NO|||', 'date_creation'=>'datetime|NO|||', 'tms'=>'timestamp|NO|current_timestamp()|on update current_timestamp()|',
		'current_user_id'=>'bigint(20)|YES|NULL|stored generated|casewhendate_endisnullthenfk_userelsenullend',
		'current_primary_activity_id'=>'bigint(20)|YES|NULL|stored generated|casewhendate_endisnullandis_primary=1thenfk_activityelsenullend',
	);
	$actualColumns = array(); $characters = array();
	$sql = "SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,GENERATION_EXPRESSION,CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY ORDINAL_POSITION";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect RST-002B assignment columns.');
	while ($row = $db->fetch_array($resql)) {
		$default = $row['COLUMN_DEFAULT'];
		if ($default === null) $default = $row['IS_NULLABLE'] === 'YES' ? 'NULL' : '';
		$actualColumns[$row['COLUMN_NAME']] = strtolower($row['COLUMN_TYPE']).'|'.$row['IS_NULLABLE'].'|'.$default.'|'.strtolower($row['EXTRA']).'|'.mjl_rst005_normalize_definition($row['GENERATION_EXPRESSION']);
		if ($row['CHARACTER_SET_NAME'] !== null) $characters[$row['COLUMN_NAME']] = $row['CHARACTER_SET_NAME'].'|'.$row['COLLATION_NAME'];
	}
	if (!mjl_rst005_map_equal($actualColumns, $expectedColumns)) throw new RuntimeException('RST-002B assignment column definitions mismatch: '.mjl_rst005_map_mismatch($actualColumns, $expectedColumns));
	$expectedCharacters = array('reason'=>'utf8mb4|utf8mb4_uca1400_ai_ci');
	if (!mjl_rst005_map_equal($characters, $expectedCharacters)) throw new RuntimeException('RST-002B assignment character definitions mismatch.');

	$groups = array();
	$resql = $db->query("SELECT INDEX_NAME,NON_UNIQUE,INDEX_TYPE,COLUMN_NAME,COLLATION,COALESCE(SUB_PART,0) AS SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY INDEX_NAME,SEQ_IN_INDEX");
	if (!$resql) throw new RuntimeException('Unable to inspect RST-002B assignment indexes.');
	while ($row = $db->fetch_array($resql)) { $name = $row['INDEX_NAME']; if (!isset($groups[$name])) $groups[$name] = array('unique'=>(int) $row['NON_UNIQUE'] === 0,'type'=>$row['INDEX_TYPE'],'columns'=>array()); $groups[$name]['columns'][] = $row['COLLATION'].':'.$row['SUB_PART'].':'.$row['COLUMN_NAME']; }
	$actualIndexes = array(); foreach ($groups as $name => $definition) $actualIndexes[$name] = ($definition['unique'] ? 'U' : 'N').'|'.$definition['type'].'|'.implode(',', $definition['columns']);
	$expectedIndexes = array(
		'PRIMARY'=>'U|BTREE|A:0:rowid', 'uk_mjl_activity_assignment_current_user'=>'U|BTREE|A:0:entity,A:0:fk_activity,A:0:current_user_id',
		'uk_mjl_activity_assignment_current_primary'=>'U|BTREE|A:0:entity,A:0:current_primary_activity_id',
		'idx_mjl_activity_assignment_current_activity'=>'N|BTREE|A:0:entity,A:0:fk_activity,A:0:date_end',
		'idx_mjl_activity_assignment_current_agent'=>'N|BTREE|A:0:entity,A:0:fk_user,A:0:date_end',
		'idx_mjl_activity_assignment_activity_fk'=>'N|BTREE|A:0:fk_activity', 'idx_mjl_activity_assignment_agent_fk'=>'N|BTREE|A:0:fk_user',
		'idx_mjl_activity_assignment_assigner'=>'N|BTREE|A:0:fk_user_assign',
	);
	if (!mjl_rst005_map_equal($actualIndexes, $expectedIndexes)) throw new RuntimeException('RST-002B assignment index definitions mismatch: '.mjl_rst005_map_mismatch($actualIndexes, $expectedIndexes));

	$actualFks = array();
	$sql = "SELECT k.CONSTRAINT_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.UPDATE_RULE,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.TABLE_NAME='".$db->escape($table)."' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.CONSTRAINT_NAME,k.ORDINAL_POSITION";
	$resql = $db->query($sql); if (!$resql) throw new RuntimeException('Unable to inspect RST-002B assignment foreign keys.');
	while ($row = $db->fetch_array($resql)) $actualFks[$row['CONSTRAINT_NAME']] = $row['COLUMN_NAME'].'>'.$row['REFERENCED_TABLE_NAME'].':'.$row['REFERENCED_COLUMN_NAME'].'|'.$row['UPDATE_RULE'].'|'.$row['DELETE_RULE'];
	$expectedFks = array('fk_mjl_activity_assignment_activity'=>'fk_activity>'.$prefix.'mjlfinancement_activity:rowid|RESTRICT|RESTRICT','fk_mjl_activity_assignment_agent'=>'fk_user>'.$prefix.'user:rowid|RESTRICT|RESTRICT','fk_mjl_activity_assignment_assigner'=>'fk_user_assign>'.$prefix.'user:rowid|RESTRICT|RESTRICT');
	if (!mjl_rst005_map_equal($actualFks, $expectedFks)) throw new RuntimeException('RST-002B assignment foreign-key definitions mismatch: '.mjl_rst005_map_mismatch($actualFks, $expectedFks));

	$actualChecks = array();
	$resql = $db->query("SELECT tc.CONSTRAINT_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc INNER JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME='".$db->escape($table)."' AND tc.CONSTRAINT_TYPE='CHECK' ORDER BY tc.CONSTRAINT_NAME");
	if (!$resql) throw new RuntimeException('Unable to inspect RST-002B assignment checks.');
	while ($row = $db->fetch_array($resql)) $actualChecks[$row['CONSTRAINT_NAME']] = mjl_rst005_normalize_definition($row['CHECK_CLAUSE']);
	$expectedChecks = array('chk_mjl_activity_assignment_entity_positive'=>'entity>0','chk_mjl_activity_assignment_primary'=>'is_primaryin(0,1)','chk_mjl_activity_assignment_reason_nonblank'=>"reasonregexp'[^[:space:]]'",'chk_mjl_activity_assignment_dates'=>'date_endisnullordate_end>=date_start');
	foreach ($expectedChecks as $name => $expression) $expectedChecks[$name] = mjl_rst005_normalize_definition($expression);
	if (!mjl_rst005_map_equal($actualChecks, $expectedChecks)) throw new RuntimeException('RST-002B assignment check definitions mismatch: '.mjl_rst005_map_mismatch($actualChecks, $expectedChecks));
	if ($withTriggers !== 'ignore') {
		$expectedTriggers = $withTriggers ? mjl_rst002b_expected_trigger_map(mjl_rst002b_assignment_trigger_statements($db)) : array();
		if (!mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db, $table), $expectedTriggers)) throw new RuntimeException('RST-002B assignment trigger definitions mismatch.');
	}
}

function mjl_rst002b_require_target_objects(DoliDB $db)
{
	$prefix = mjl_rst005_prefix($db);
	$activity = $prefix.'mjlfinancement_activity';
	$assignment = $prefix.'mjlfinancement_activity_assignment';
	if (mjl_rst002b_detect_schema($db) !== RST002B_SCHEMA_TARGET) throw new RuntimeException('RST-002B target boundary is incomplete.');
	mjl_rst002b_require_retained_schema($db);
	$expectedActivity = array('rowid','entity','ref','fk_partner','fk_project','name','description','date_start','date_end','draft_authorized_amount','first_submitted_amount','latest_validated_amount','validation_status','is_cancelled','version','date_creation','tms','fk_user_creat','fk_user_modif');
	if (mjl_rst005_table_columns($db, $activity) !== $expectedActivity) throw new RuntimeException('RST-002B Activity columns do not match the target.');
	$expectedAssignment = array('rowid','entity','fk_activity','fk_user','is_primary','date_start','date_end','fk_user_assign','reason','date_creation','tms','current_user_id','current_primary_activity_id');
	if (mjl_rst005_table_columns($db, $assignment) !== $expectedAssignment) throw new RuntimeException('RST-002B assignment columns do not match the target.');
	mjl_rst005_schema_contract($db, $activity, RST002B_ACTIVITY_SCHEMA);
	mjl_rst002b_require_assignment_contract($db, $assignment);
	$names = function ($sql, $field) use ($db) {
		$resql = $db->query($sql);
		if (!$resql) throw new RuntimeException('Unable to inspect an RST-002B schema set.');
		$result = array();
		while ($row = $db->fetch_array($resql)) $result[] = (string) $row[$field];
		sort($result, SORT_STRING);
		return $result;
	};
	$activityConstraints = array('PRIMARY','uk_mjl_activity_entity_ref','chk_mjl_activity_entity_positive','chk_mjl_activity_ref_nonblank','chk_mjl_activity_name_nonblank','chk_mjl_activity_description_nonblank','chk_mjl_activity_dates','chk_mjl_activity_draft_amount','chk_mjl_activity_first_amount','chk_mjl_activity_validated_amount','chk_mjl_activity_validation_status','chk_mjl_activity_cancelled','chk_mjl_activity_version','chk_mjl_activity_rst005_dormant','fk_mjl_activity_target_partner','fk_mjl_activity_target_project','fk_mjl_activity_target_creator','fk_mjl_activity_target_modifier');
	sort($activityConstraints, SORT_STRING);
	$actual = $names("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' ORDER BY CONSTRAINT_NAME", 'CONSTRAINT_NAME');
	if ($actual !== $activityConstraints) throw new RuntimeException('RST-002B Activity constraint set mismatch.');
	$activityIndexes = array('PRIMARY','uk_mjl_activity_entity_ref','idx_mjl_activity_entity_project','idx_mjl_activity_entity_partner','idx_mjl_activity_entity_validation','idx_mjl_activity_project_fk','idx_mjl_activity_partner_fk','idx_mjl_activity_creator','idx_mjl_activity_modifier');
	sort($activityIndexes, SORT_STRING);
	$actual = $names("SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' ORDER BY INDEX_NAME", 'INDEX_NAME');
	if ($actual !== $activityIndexes) throw new RuntimeException('RST-002B Activity index set mismatch.');
	$assignmentConstraints = array('PRIMARY','uk_mjl_activity_assignment_current_user','uk_mjl_activity_assignment_current_primary','chk_mjl_activity_assignment_entity_positive','chk_mjl_activity_assignment_primary','chk_mjl_activity_assignment_reason_nonblank','chk_mjl_activity_assignment_dates','fk_mjl_activity_assignment_activity','fk_mjl_activity_assignment_agent','fk_mjl_activity_assignment_assigner');
	sort($assignmentConstraints, SORT_STRING);
	$actual = $names("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($assignment)."' ORDER BY CONSTRAINT_NAME", 'CONSTRAINT_NAME');
	if ($actual !== $assignmentConstraints) throw new RuntimeException('RST-002B assignment constraint set mismatch.');
	$assignmentIndexes = array('PRIMARY','uk_mjl_activity_assignment_current_user','uk_mjl_activity_assignment_current_primary','idx_mjl_activity_assignment_current_activity','idx_mjl_activity_assignment_current_agent','idx_mjl_activity_assignment_activity_fk','idx_mjl_activity_assignment_agent_fk','idx_mjl_activity_assignment_assigner');
	sort($assignmentIndexes, SORT_STRING);
	$actual = $names("SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($assignment)."' ORDER BY INDEX_NAME", 'INDEX_NAME');
	if ($actual !== $assignmentIndexes) throw new RuntimeException('RST-002B assignment index set mismatch.');
	$activityTriggers = array($prefix.'mjl_activity_rst002b_bu',$prefix.'mjl_activity_rst005_bd',$prefix.'mjl_activity_rst005_bi');
	sort($activityTriggers, SORT_STRING);
	$actual = $names("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($activity)."' ORDER BY TRIGGER_NAME", 'TRIGGER_NAME');
	if ($actual !== $activityTriggers) throw new RuntimeException('RST-002B Activity trigger set mismatch.');
	$expectedTriggers = array($prefix.'mjl_activity_assignment_bd',$prefix.'mjl_activity_assignment_bi',$prefix.'mjl_activity_assignment_bu');
	$actualTriggers = array();
	$resql = $db->query("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($assignment)."' ORDER BY TRIGGER_NAME");
	if (!$resql) throw new RuntimeException('Unable to inspect RST-002B assignment triggers.');
	while ($row = $db->fetch_object($resql)) $actualTriggers[] = (string) $row->TRIGGER_NAME;
	if ($actualTriggers !== $expectedTriggers) throw new RuntimeException('RST-002B assignment trigger set mismatch.');
	$roleTriggers = array($prefix.'mjlfinancement_user_role_bd',$prefix.'mjlfinancement_user_role_bi',$prefix.'mjlfinancement_user_role_bu');
	sort($roleTriggers, SORT_STRING);
	$actual = $names("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($prefix.'mjlfinancement_user_role')."' ORDER BY TRIGGER_NAME", 'TRIGGER_NAME');
	if ($actual !== $roleTriggers) throw new RuntimeException('RST-002B role trigger set mismatch.');
	$allRoleExpected = mjl_rst002b_expected_trigger_map(mjl_rst002b_role_invariant_trigger_statements($db, true));
	$expectedRoleDefinitions = array(); $expectedUserDefinitions = array();
	foreach ($allRoleExpected as $name => $definition) {
		if ($name === $prefix.'mjlfinancement_user_admin_bu') $expectedUserDefinitions[$name] = $definition;
		else $expectedRoleDefinitions[$name] = $definition;
	}
	if (!mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db, $prefix.'mjlfinancement_user_role'), $expectedRoleDefinitions)) throw new RuntimeException('RST-002B role trigger definitions mismatch.');
	if (!mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db, $prefix.'user'), $expectedUserDefinitions)) throw new RuntimeException('RST-002B user trigger definitions mismatch.');
}

function mjl_rst005_table_columns(DoliDB $db, $table)
{
	$table = (string) $table;
	$sql = "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY ORDINAL_POSITION";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect Activity schema.');
	$columns = array();
	while ($row = $db->fetch_object($resql)) $columns[] = (string) $row->COLUMN_NAME;
	return $columns;
}

function mjl_rst005_schema_contract(DoliDB $db, $table, $flavour, $phase1Guard = false, $updateGuard = null)
{
	$prefix = mjl_rst005_prefix($db);
	$expectedColumns = mjl_rst005_column_contract($flavour);
	if (empty($expectedColumns)) throw new RuntimeException('Unknown RST-005 schema contract.');
	$engineSql = "SELECT ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND TABLE_TYPE='BASE TABLE'";
	$resql = $db->query($engineSql);
	$engine = $resql ? $db->fetch_object($resql) : null;
	if (!$engine || (string) $engine->ENGINE !== 'InnoDB' || (string) $engine->TABLE_COLLATION !== 'utf8mb4_uca1400_ai_ci') throw new RuntimeException('RST-005 Activity engine or collation mismatch.');

	$actualColumns = array();
	$sql = "SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,GENERATION_EXPRESSION,CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY ORDINAL_POSITION";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect RST-005 Activity columns.');
	$characterColumns = array();
	while ($row = $db->fetch_array($resql)) {
		$default = $row['COLUMN_DEFAULT'];
		if ($default === null) $default = $row['IS_NULLABLE'] === 'YES' ? 'NULL' : '';
		$actualColumns[$row['COLUMN_NAME']] = strtolower($row['COLUMN_TYPE']).'|'.$row['IS_NULLABLE'].'|'.$default.'|'.strtolower($row['EXTRA']).'|'.mjl_rst005_normalize_definition($row['GENERATION_EXPRESSION']);
		if ($row['CHARACTER_SET_NAME'] !== null) $characterColumns[$row['COLUMN_NAME']] = $row['CHARACTER_SET_NAME'].'|'.$row['COLLATION_NAME'];
	}
	if (!mjl_rst005_map_equal($actualColumns, $expectedColumns)) throw new RuntimeException('RST-005 Activity column definitions mismatch: '.mjl_rst005_map_mismatch($actualColumns, $expectedColumns));
	$expectedCharacter = array();
	$names = $flavour === RST005_SCHEMA_PHASE1
		? array('ref','label','note_public','note_private','import_key','execution_status','execution_comment')
		: array('ref','name','description','validation_status');
	foreach ($names as $name) $expectedCharacter[$name] = 'utf8mb4|utf8mb4_uca1400_ai_ci';
	if (!mjl_rst005_map_equal($characterColumns, $expectedCharacter)) throw new RuntimeException('RST-005 Activity character definitions mismatch: '.mjl_rst005_map_mismatch($characterColumns, $expectedCharacter));

	$groups = array();
	$sql = "SELECT INDEX_NAME,NON_UNIQUE,INDEX_TYPE,COLUMN_NAME,COLLATION,COALESCE(SUB_PART,0) AS SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY INDEX_NAME,SEQ_IN_INDEX";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect RST-005 Activity indexes.');
	while ($row = $db->fetch_array($resql)) {
		$name = $row['INDEX_NAME'];
		if (!isset($groups[$name])) $groups[$name] = array('unique'=>(int) $row['NON_UNIQUE'] === 0, 'type'=>$row['INDEX_TYPE'], 'columns'=>array());
		$groups[$name]['columns'][] = $row['COLLATION'].':'.$row['SUB_PART'].':'.$row['COLUMN_NAME'];
	}
	$actualIndexes = array();
	foreach ($groups as $name => $definition) $actualIndexes[$name] = ($definition['unique'] ? 'U' : 'N').'|'.$definition['type'].'|'.implode(',', $definition['columns']);
	$expectedIndexes = mjl_rst005_index_contract($flavour);
	if (!mjl_rst005_map_equal($actualIndexes, $expectedIndexes)) throw new RuntimeException('RST-005 Activity index definitions mismatch: '.mjl_rst005_map_mismatch($actualIndexes, $expectedIndexes));

	$actualFks = array();
	$sql = "SELECT k.CONSTRAINT_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.UPDATE_RULE,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.TABLE_NAME='".$db->escape($table)."' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.CONSTRAINT_NAME,k.ORDINAL_POSITION";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect RST-005 Activity foreign keys.');
	while ($row = $db->fetch_array($resql)) $actualFks[$row['CONSTRAINT_NAME']] = $row['COLUMN_NAME'].'>'.$row['REFERENCED_TABLE_NAME'].':'.$row['REFERENCED_COLUMN_NAME'].'|'.$row['UPDATE_RULE'].'|'.$row['DELETE_RULE'];
	$expectedFks = mjl_rst005_fk_contract($flavour, $prefix);
	if (!mjl_rst005_map_equal($actualFks, $expectedFks)) throw new RuntimeException('RST-005 Activity foreign-key definitions mismatch: '.mjl_rst005_map_mismatch($actualFks, $expectedFks));

	$actualChecks = array();
	$sql = "SELECT tc.CONSTRAINT_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc INNER JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME='".$db->escape($table)."' AND tc.CONSTRAINT_TYPE='CHECK' ORDER BY tc.CONSTRAINT_NAME";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect RST-005 Activity checks.');
	while ($row = $db->fetch_array($resql)) $actualChecks[$row['CONSTRAINT_NAME']] = mjl_rst005_normalize_definition($row['CHECK_CLAUSE']);
	$expectedChecks = mjl_rst005_check_contract($flavour);
	foreach ($expectedChecks as $name => $expression) $expectedChecks[$name] = mjl_rst005_normalize_definition($expression);
	if (!mjl_rst005_map_equal($actualChecks, $expectedChecks)) throw new RuntimeException('RST-005 Activity check definitions mismatch: '.mjl_rst005_map_mismatch($actualChecks, $expectedChecks));

	$actualTriggers = array();
	$sql = "SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($table)."' ORDER BY TRIGGER_NAME";
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('Unable to inspect RST-005 Activity triggers.');
	while ($row = $db->fetch_array($resql)) $actualTriggers[$row['TRIGGER_NAME']] = $row['ACTION_TIMING'].' '.$row['EVENT_MANIPULATION'].':'.mjl_rst005_normalize_definition($row['ACTION_STATEMENT']);
	$expectedTriggers = array();
	if ($flavour === RST005_SCHEMA_PHASE1 && $phase1Guard) {
		$expectedTriggers[$prefix.'mjl_activity_rst005_cutover_guard'] = 'BEFORE INSERT:'.mjl_rst005_normalize_definition("SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity cutover containment is active'");
	}
	if ($flavour === RST005_SCHEMA_TARGET) {
		$insertSql = mjl_rst005_insert_trigger_sql($prefix, $table);
		$body = substr($insertSql, strpos($insertSql, ' FOR EACH ROW ') + strlen(' FOR EACH ROW '));
		$expectedTriggers[$prefix.'mjl_activity_rst005_bi'] = 'BEFORE INSERT:'.mjl_rst005_normalize_definition($body);
		$expectedTriggers[$prefix.'mjl_activity_rst005_bu'] = 'BEFORE UPDATE:'.mjl_rst005_normalize_definition("SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity mutation is dormant in RST-005'");
		$expectedTriggers[$prefix.'mjl_activity_rst005_bd'] = 'BEFORE DELETE:'.mjl_rst005_normalize_definition("SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity deletion is dormant in RST-005'");
		if ($updateGuard === 'none') unset($expectedTriggers[$prefix.'mjl_activity_rst005_bu']);
	}
	if ($flavour === RST002B_ACTIVITY_SCHEMA) {
		$insertSql = mjl_rst005_insert_trigger_sql($prefix, $table);
		$insertBody = substr($insertSql, strpos($insertSql, ' FOR EACH ROW ') + strlen(' FOR EACH ROW '));
		$updateSql = mjl_rst002b_activity_update_trigger_sql($db);
		$updateBody = substr($updateSql, strpos($updateSql, ' FOR EACH ROW ') + strlen(' FOR EACH ROW '));
		$expectedTriggers[$prefix.'mjl_activity_rst005_bi'] = 'BEFORE INSERT:'.mjl_rst005_normalize_definition($insertBody);
		$expectedTriggers[$prefix.'mjl_activity_rst002b_bu'] = 'BEFORE UPDATE:'.mjl_rst005_normalize_definition($updateBody);
		$expectedTriggers[$prefix.'mjl_activity_rst005_bd'] = 'BEFORE DELETE:'.mjl_rst005_normalize_definition("SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity deletion is dormant in RST-005'");
		if ($updateGuard === 'none') unset($expectedTriggers[$prefix.'mjl_activity_rst002b_bu']);
	}
	if (!mjl_rst005_map_equal($actualTriggers, $expectedTriggers)) throw new RuntimeException('RST-005 Activity trigger definitions mismatch: '.mjl_rst005_map_mismatch($actualTriggers, $expectedTriggers));
	// Reaching this point means every physical definition represented by the
	// sealed SQL oracle matched. Return that oracle identity, never a second
	// unrelated hash vocabulary.
	if ($flavour === RST005_SCHEMA_PHASE1) return RST005_PHASE1_ORACLE_SHA256;
	if ($flavour === RST005_SCHEMA_TARGET) return RST005_TARGET_ORACLE_SHA256;
	return RST002B_SCHEMA_TARGET;
}

function mjl_rst005_cutover_guard_sql($prefix, $table)
{
	return 'CREATE TRIGGER '.mjl_rst005_ident($prefix.'mjl_activity_rst005_cutover_guard').' BEFORE INSERT ON '.mjl_rst005_ident($table)." FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity cutover containment is active'";
}

function mjl_rst005_require_guarded_phase1(DoliDB $db, $table)
{
	if (mjl_rst005_table_columns($db, $table) !== mjl_rst005_expected_columns(RST005_SCHEMA_PHASE1)) throw new RuntimeException('Guarded Phase 1 Activity columns do not match.');
	mjl_rst005_schema_contract($db, $table, RST005_SCHEMA_PHASE1, true);
	mjl_rst005_assert_empty($db, $table);
}

function mjl_rst005_detect_schema(DoliDB $db, $table = null)
{
	$prefix = mjl_rst005_prefix($db);
	$table = $table === null ? $prefix.'mjlfinancement_activity' : (string) $table;
	$columns = mjl_rst005_table_columns($db, $table);
	if ($columns === mjl_rst005_expected_columns(RST005_SCHEMA_PHASE1)) {
		try { mjl_rst005_schema_contract($db, $table, RST005_SCHEMA_PHASE1); return RST005_SCHEMA_PHASE1; } catch (RuntimeException $exception) { return RST005_SCHEMA_UNKNOWN; }
	}
	if ($columns === mjl_rst005_expected_columns(RST005_SCHEMA_TARGET)) {
		try { mjl_rst005_schema_contract($db, $table, RST005_SCHEMA_TARGET); return RST005_SCHEMA_TARGET; } catch (RuntimeException $exception) { return RST005_SCHEMA_UNKNOWN; }
	}
	return RST005_SCHEMA_UNKNOWN;
}

function mjl_rst005_scalar(DoliDB $db, $sql)
{
	$resql = $db->query($sql);
	if (!$resql) throw new RuntimeException('RST-005 database inspection failed.');
	$row = $db->fetch_row($resql);
	return $row ? $row[0] : null;
}

function mjl_rst005_assert_empty(DoliDB $db, $table)
{
	$count = (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM '.mjl_rst005_ident($table));
	if ($count !== 0) throw new RuntimeException('RST-005 requires an empty Activity table.');
}

function mjl_rst005_insert_trigger_sql($prefix, $table)
{
	$trigger = mjl_rst005_ident($prefix.'mjl_activity_rst005_bi');
	$tableSql = mjl_rst005_ident($table);
	$societe = mjl_rst005_ident($prefix.'societe');
	$projet = mjl_rst005_ident($prefix.'projet');
	$user = mjl_rst005_ident($prefix.'user');
	return "CREATE TRIGGER {$trigger} BEFORE INSERT ON {$tableSql} FOR EACH ROW BEGIN "
		."DECLARE partner_entity int(11) DEFAULT -1; DECLARE project_entity int(11) DEFAULT -1; DECLARE project_partner int(11) DEFAULT -1; "
		."DECLARE creator_entity int(11) DEFAULT -1; DECLARE modifier_entity int(11) DEFAULT -1; DECLARE partner_found int(11) DEFAULT 0; "
		."DECLARE project_found int(11) DEFAULT 0; DECLARE creator_found int(11) DEFAULT 0; DECLARE modifier_found int(11) DEFAULT 0; "
		."SELECT COUNT(*),MAX(entity) INTO partner_found,partner_entity FROM {$societe} WHERE rowid=NEW.fk_partner; "
		."SELECT COUNT(*),MAX(entity),MAX(fk_soc) INTO project_found,project_entity,project_partner FROM {$projet} WHERE rowid=NEW.fk_project; "
		."SELECT COUNT(*),MAX(entity) INTO creator_found,creator_entity FROM {$user} WHERE rowid=NEW.fk_user_creat; "
		."IF NEW.fk_user_modif IS NOT NULL THEN SELECT COUNT(*),MAX(entity) INTO modifier_found,modifier_entity FROM {$user} WHERE rowid=NEW.fk_user_modif; END IF; "
		."IF partner_found<>1 OR project_found<>1 OR creator_found<>1 OR NOT(partner_entity<=>NEW.entity) OR NOT(project_entity<=>NEW.entity) "
		."OR NOT(project_partner<=>NEW.fk_partner) OR NOT(creator_entity<=>NEW.entity) OR (NEW.fk_user_modif IS NOT NULL AND (modifier_found<>1 OR NOT(modifier_entity<=>NEW.entity))) "
		."THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid MJL Activity entity relationship'; END IF; END";
}

function mjl_rst005_install_insert_trigger(DoliDB $db, $table)
{
	$prefix = mjl_rst005_prefix($db);
	$trigger = $prefix.'mjl_activity_rst005_bi';
	if (!$db->query('DROP TRIGGER IF EXISTS '.mjl_rst005_ident($trigger))) throw new RuntimeException('Unable to reset RST-005 insert trigger.');
	if (!$db->query(mjl_rst005_insert_trigger_sql($prefix, $table))) throw new RuntimeException('Unable to install RST-005 insert trigger.');
}

function mjl_rst005_require_target_objects(DoliDB $db, $table = null)
{
	$prefix = mjl_rst005_prefix($db);
	$table = $table === null ? $prefix.'mjlfinancement_activity' : (string) $table;
	if (mjl_rst005_table_columns($db, $table) !== mjl_rst005_expected_columns(RST005_SCHEMA_TARGET)) throw new RuntimeException('RST-005 target columns do not match.');
	mjl_rst005_schema_contract($db, $table, RST005_SCHEMA_TARGET);
	$required = array(
		'PRIMARY','uk_mjl_activity_entity_ref',
		'chk_mjl_activity_entity_positive','chk_mjl_activity_ref_nonblank','chk_mjl_activity_name_nonblank',
		'chk_mjl_activity_description_nonblank','chk_mjl_activity_dates','chk_mjl_activity_draft_amount',
		'chk_mjl_activity_first_amount','chk_mjl_activity_validated_amount','chk_mjl_activity_validation_status',
		'chk_mjl_activity_cancelled','chk_mjl_activity_version','chk_mjl_activity_responsible_dormant','chk_mjl_activity_rst005_dormant',
		'fk_mjl_activity_target_partner','fk_mjl_activity_target_project','fk_mjl_activity_target_creator','fk_mjl_activity_target_modifier',
	);
	foreach ($required as $name) {
		$count = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND CONSTRAINT_NAME='".$db->escape($name)."'");
		if ($count !== 1) throw new RuntimeException('Missing RST-005 constraint: '.$name);
	}
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."'") !== count($required)) throw new RuntimeException('Unexpected RST-005 table constraint.');
	$indexes = array('PRIMARY','uk_mjl_activity_entity_ref','idx_mjl_activity_entity_project','idx_mjl_activity_entity_partner','idx_mjl_activity_entity_validation','idx_mjl_activity_project_fk','idx_mjl_activity_partner_fk','idx_mjl_activity_creator','idx_mjl_activity_modifier');
	foreach ($indexes as $index) {
		$count = (int) mjl_rst005_scalar($db, "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND INDEX_NAME='".$db->escape($index)."'");
		if ($count !== 1) throw new RuntimeException('Missing RST-005 index: '.$index);
	}
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."'") !== count($indexes)) throw new RuntimeException('Unexpected RST-005 index.');
	$triggers = array(
		$prefix.'mjl_activity_rst005_bi' => array('BEFORE','INSERT'),
		$prefix.'mjl_activity_rst005_bu' => array('BEFORE','UPDATE'),
		$prefix.'mjl_activity_rst005_bd' => array('BEFORE','DELETE'),
	);
	foreach ($triggers as $trigger => $definition) {
		$count = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($table)."' AND TRIGGER_NAME='".$db->escape($trigger)."' AND ACTION_TIMING='".$definition[0]."' AND EVENT_MANIPULATION='".$definition[1]."'");
		if ($count !== 1) throw new RuntimeException('Missing RST-005 trigger: '.$trigger);
	}
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='".$db->escape($table)."'") !== count($triggers)) throw new RuntimeException('Unexpected RST-005 trigger.');
	return true;
}
