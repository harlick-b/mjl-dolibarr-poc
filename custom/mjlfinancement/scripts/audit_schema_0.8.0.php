<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';

global $db;

$hasFindings = false;

$requiredColumns = array(
	'mjlfinancement_user_role' => array('rowid', 'entity', 'fk_user', 'role_code', 'is_active', 'date_start', 'date_end', 'source', 'date_creation', 'fk_user_creat', 'import_key'),
	'mjlfinancement_user_soc_scope' => array('rowid', 'entity', 'fk_user', 'fk_soc', 'is_active', 'date_start', 'date_end', 'source', 'date_creation', 'fk_user_creat', 'import_key'),
);
foreach ($requiredColumns as $table => $columns) {
	if (!tableExists($table)) {
		finding('missing_table', $table);
		continue;
	}
	foreach ($columns as $column) {
		if (!columnExists($table, $column)) {
			finding('missing_column', $table.'.'.$column);
		}
	}
}

$requiredIndexes = array(
	array('mjlfinancement_user_role', 'idx_mjlfinancement_user_role_entity'),
	array('mjlfinancement_user_role', 'idx_mjlfinancement_user_role_fk_user'),
	array('mjlfinancement_user_role', 'idx_mjlfinancement_user_role_active'),
	array('mjlfinancement_user_role', 'idx_mjlfinancement_user_role_code'),
	array('mjlfinancement_user_soc_scope', 'idx_mjlfinancement_user_soc_scope_entity'),
	array('mjlfinancement_user_soc_scope', 'idx_mjlfinancement_user_soc_scope_fk_user'),
	array('mjlfinancement_user_soc_scope', 'idx_mjlfinancement_user_soc_scope_fk_soc'),
	array('mjlfinancement_user_soc_scope', 'idx_mjlfinancement_user_soc_scope_active'),
);
foreach ($requiredIndexes as $index) {
	if (!indexExists($index[0], $index[1])) {
		finding('missing_index', $index[0].'.'.$index[1]);
	}
}

if (tableExists('mjlfinancement_user_role')) {
	reportRows(
		'user_role_invalid_code',
		'SELECT rowid, entity, fk_user, role_code FROM '.$db->prefix()."mjlfinancement_user_role WHERE role_code NOT IN ('".implode("','", array_map(array($db, 'escape'), mjl_scope_role_codes()))."')"
	);
	reportRows(
		'user_role_duplicate_active',
		'SELECT entity, fk_user, COUNT(*) AS active_rows FROM '.$db->prefix().'mjlfinancement_user_role WHERE is_active = 1 GROUP BY entity, fk_user HAVING COUNT(*) > 1'
	);
	reportRows(
		'user_role_orphan_user',
		'SELECT r.rowid, r.entity, r.fk_user, r.role_code FROM '.$db->prefix().'mjlfinancement_user_role r LEFT JOIN '.$db->prefix().'user u ON u.rowid = r.fk_user WHERE u.rowid IS NULL'
	);
}

if (tableExists('mjlfinancement_user_soc_scope')) {
	reportRows(
		'user_soc_scope_duplicate_active',
		'SELECT entity, fk_user, fk_soc, COUNT(*) AS active_rows FROM '.$db->prefix().'mjlfinancement_user_soc_scope WHERE is_active = 1 GROUP BY entity, fk_user, fk_soc HAVING COUNT(*) > 1'
	);
	reportRows(
		'user_soc_scope_orphan_user',
		'SELECT s.rowid, s.entity, s.fk_user, s.fk_soc FROM '.$db->prefix().'mjlfinancement_user_soc_scope s LEFT JOIN '.$db->prefix().'user u ON u.rowid = s.fk_user WHERE u.rowid IS NULL'
	);
	reportRows(
		'user_soc_scope_orphan_soc',
		'SELECT s.rowid, s.entity, s.fk_user, s.fk_soc FROM '.$db->prefix().'mjlfinancement_user_soc_scope s LEFT JOIN '.$db->prefix().'societe so ON so.rowid = s.fk_soc WHERE so.rowid IS NULL'
	);
}

if (tableExists('mjlfinancement_user_role') && tableExists('mjlfinancement_user_soc_scope')) {
	reportRows(
		'active_non_admin_role_without_scope',
		'SELECT r.entity, r.fk_user, u.login, r.role_code FROM '.$db->prefix().'mjlfinancement_user_role r INNER JOIN '.$db->prefix().'user u ON u.rowid = r.fk_user WHERE r.is_active = 1 AND r.role_code <> \'ADMIN_PLATEFORME\' AND NOT EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_user_soc_scope s WHERE s.entity = r.entity AND s.fk_user = r.fk_user AND s.is_active = 1)'
	);
	reportWarningRows(
		'legacy_lecteur_unresolved',
		'SELECT DISTINCT u.entity, u.rowid AS fk_user, u.login FROM '.$db->prefix().'user u INNER JOIN '.$db->prefix().'usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity IN (0, u.entity) INNER JOIN '.$db->prefix().'usergroup ug ON ug.rowid = ugu.fk_usergroup AND ug.entity = u.entity WHERE ug.nom = \'MJL POC - Lecteur\' AND NOT EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_user_role r WHERE r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1)'
	);
}

if (!$hasFindings) {
	out('MJL 0.8.0 role/scope schema audit: OK');
}

exit($hasFindings ? 1 : 0);

function tableExists($table)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	return scalar($sql) > 0;
}

function columnExists($table, $column)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND COLUMN_NAME = '".$db->escape($column)."'";
	return scalar($sql) > 0;
}

function indexExists($table, $index)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND INDEX_NAME = '".$db->escape($index)."'";
	return scalar($sql) > 0;
}

function reportRows($name, $sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to run '.$name.': '.$db->lasterror());
	}

	$count = 0;
	while ($obj = $db->fetch_object($resql)) {
		if ($count === 0) {
			finding($name, '');
		}
		$count++;
		out('  '.formatObject($obj));
	}
}

function reportWarningRows($name, $sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to run '.$name.': '.$db->lasterror());
	}

	$count = 0;
	while ($obj = $db->fetch_object($resql)) {
		if ($count === 0) {
			out('warning_'.$name.':');
		}
		$count++;
		out('  '.formatObject($obj));
	}
}

function scalar($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch scalar: '.$db->lasterror().' SQL='.$sql);
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (int) $obj->nb : 0;
}

function finding($name, $detail)
{
	global $hasFindings;

	$hasFindings = true;
	out($detail === '' ? $name.':' : $name.': '.$detail);
}

function formatObject($obj)
{
	$parts = array();
	foreach ($obj as $key => $value) {
		$parts[] = $key.'='.($value === null ? 'NULL' : $value);
	}
	return implode(' ', $parts);
}

function out($message)
{
	print $message.PHP_EOL;
}

function fail($message)
{
	fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
	exit(2);
}
