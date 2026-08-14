<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';

global $db;

$failed = false;
$table = $db->prefix().'mjlfinancement_operation_type';

function out($message)
{
	print $message.PHP_EOL;
}

function fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(2);
}

function finding($name, $detail)
{
	out($name.': '.$detail);
}

function rst003_scalar($sql)
{
	global $db;
	$result = $db->query($sql);
	if (!$result) fail('RST-003 schema query failed: '.$db->lasterror());
	$row = $db->fetch_object($result);
	if (!$row) return 0;
	$values = (array) $row;
	return (int) reset($values);
}

function rst003_expect($condition, $message)
{
	global $failed;
	if (!$condition) {
		$failed = true;
		finding('rst003_reference_foundation', $message);
	}
}

$columns = array('rowid', 'entity', 'label', 'is_active', 'date_creation', 'tms', 'fk_user_creat', 'fk_user_modif');
foreach ($columns as $column) {
	rst003_expect(rst003_scalar("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."' AND COLUMN_NAME = '".$db->escape($column)."'") === 1, 'missing column '.$column);
}
rst003_expect(rst003_scalar("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."'") === 8, 'unexpected operation-type column');
$columnDefinitions = array(
	'rowid' => array('int', 'NO', null, 'auto_increment'),
	'entity' => array('int', 'NO', '1', ''),
	'label' => array('varchar', 'NO', null, ''),
	'is_active' => array('tinyint', 'NO', '1', ''),
	'date_creation' => array('datetime', 'NO', null, ''),
	'tms' => array('timestamp', 'YES', 'current_timestamp()', 'on update current_timestamp()'),
	'fk_user_creat' => array('int', 'NO', null, ''),
	'fk_user_modif' => array('int', 'YES', 'null', ''),
);
foreach ($columnDefinitions as $column => $definition) {
	$sql = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."' AND COLUMN_NAME = '".$db->escape($column)."'";
	$sql .= " AND DATA_TYPE = '".$definition[0]."' AND IS_NULLABLE = '".$definition[1]."'";
	$sql .= $definition[2] === null ? ' AND COLUMN_DEFAULT IS NULL' : " AND LOWER(COLUMN_DEFAULT) = '".$definition[2]."'";
	$sql .= $definition[3] === '' ? " AND EXTRA = ''" : " AND LOWER(EXTRA) = '".$definition[3]."'";
	rst003_expect(rst003_scalar($sql) === 1, 'invalid column definition '.$column);
}
rst003_expect(rst003_scalar("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."' AND COLUMN_NAME = 'label' AND CHARACTER_MAXIMUM_LENGTH = 255 AND COLLATION_NAME = @@collation_database") === 1, 'invalid label length or collation');

$indexes = array(
	'PRIMARY' => array(0, 'rowid'),
	'idx_mjlfinancement_operation_type_entity' => array(1, 'entity'),
	'idx_mjlfinancement_operation_type_active' => array(1, 'entity,is_active'),
	'uk_mjlfinancement_operation_type_label_entity' => array(0, 'entity,label'),
	'fk_mjlfinancement_operation_type_user_creat' => array(1, 'fk_user_creat'),
	'fk_mjlfinancement_operation_type_user_modif' => array(1, 'fk_user_modif'),
);
foreach ($indexes as $index => $definition) {
	$sql = "SELECT COUNT(*) FROM (SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."' AND INDEX_NAME = '".$db->escape($index)."' GROUP BY INDEX_NAME HAVING MIN(NON_UNIQUE) = ".((int) $definition[0])." AND MAX(NON_UNIQUE) = ".((int) $definition[0])." AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) = '".$definition[1]."') exact_index";
	rst003_expect(rst003_scalar($sql) === 1, 'invalid index '.$index);
}
rst003_expect(rst003_scalar("SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."'") === 6, 'unexpected operation-type index');
$foreignKeys = array(
	'fk_mjlfinancement_operation_type_user_creat' => 'fk_user_creat',
	'fk_mjlfinancement_operation_type_user_modif' => 'fk_user_modif',
);
foreach ($foreignKeys as $constraint => $column) {
	$sql = "SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."' AND CONSTRAINT_NAME = '".$db->escape($constraint)."' AND COLUMN_NAME = '".$column."' AND REFERENCED_TABLE_NAME = '".$db->prefix()."user' AND REFERENCED_COLUMN_NAME = 'rowid'";
	rst003_expect(rst003_scalar($sql) === 1, 'invalid foreign key '.$constraint);
}
rst003_expect(rst003_scalar("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."' AND CONSTRAINT_TYPE = 'FOREIGN KEY'") === 2, 'unexpected operation-type foreign key');
rst003_expect(rst003_scalar("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."' AND CONSTRAINT_NAME = 'chk_mjlfinancement_operation_type_active' AND CONSTRAINT_TYPE = 'CHECK'") === 1, 'missing active-state check constraint');
rst003_expect(rst003_scalar("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."' AND CONSTRAINT_TYPE = 'CHECK'") === 1, 'unexpected operation-type check constraint');

if (rst003_scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '".$db->escape($table)."'") === 1) {
	rst003_expect(rst003_scalar('SELECT COUNT(*) FROM '.$table.' WHERE is_active NOT IN (0, 1)') === 0, 'invalid operation-type active state');
	rst003_expect(rst003_scalar('SELECT COUNT(*) FROM '.$table) === 0, 'persistent operation-type catalog is not empty');
}
rst003_expect(rst003_scalar('SELECT COUNT(*) FROM '.$db->prefix().'projet p INNER JOIN '.$db->prefix().'societe s ON s.rowid = p.fk_soc WHERE p.entity <> s.entity') === 0, 'cross-entity Project/Partenaire relationship');
rst003_expect(rst003_scalar('SELECT COUNT(*) FROM '.$db->prefix().'projet p INNER JOIN '.$db->prefix().'societe s ON s.rowid = p.fk_soc AND s.entity = p.entity WHERE p.fk_statut = 1 AND s.status <> 1') === 0, 'active Project under inactive Partenaire');

if (!$failed) out('MJL RST-003 reference foundation schema: OK');
exit($failed ? 1 : 0);
