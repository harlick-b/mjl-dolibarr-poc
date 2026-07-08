<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reporting.lib.php';

function mjl_poc_import_key()
{
	return 'MJLPOC2026';
}

function mjl_poc_sample_dir()
{
	$local = DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/sample_data';
	if (is_dir($local.'/seed')) {
		return $local;
	}

	$repo = DOL_DOCUMENT_ROOT.'/../mjl_dolibarr_poc_sample_data';
	if (is_dir($repo.'/seed')) {
		return $repo;
	}

	fail('Unable to find MJL sample data pack.');
}

function mjl_csv_rows($filename)
{
	$path = mjl_poc_sample_dir().'/seed/'.$filename;
	if (!is_readable($path)) {
		fail('Unable to read CSV '.$path);
	}

	$handle = fopen($path, 'r');
	if (!$handle) {
		fail('Unable to open CSV '.$path);
	}

	$headers = fgetcsv($handle);
	$rows = array();
	while (($row = fgetcsv($handle)) !== false) {
		if ($row === array(null) || $row === false) {
			continue;
		}
		$row = array_pad($row, count($headers), '');
		$rows[] = array_combine($headers, array_slice($row, 0, count($headers)));
	}
	fclose($handle);

	return $rows;
}

function mjl_csv_map($filename, $key)
{
	$map = array();
	foreach (mjl_csv_rows($filename) as $row) {
		$map[$row[$key]] = $row;
	}
	return $map;
}

function mjl_ensure_schema()
{
	global $db;

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_activity (
		rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
		entity INTEGER DEFAULT 1 NOT NULL,
		ref VARCHAR(128) NOT NULL,
		label VARCHAR(255) NOT NULL,
		fk_project INTEGER NOT NULL,
		fk_convention INTEGER NOT NULL,
		fk_task INTEGER DEFAULT NULL,
		date_start DATE DEFAULT NULL,
		date_end DATE DEFAULT NULL,
		fk_user_responsible INTEGER DEFAULT NULL,
		date_actual_start DATE DEFAULT NULL,
		date_actual_end DATE DEFAULT NULL,
		physical_execution_percent INTEGER DEFAULT NULL,
		execution_status VARCHAR(32) DEFAULT NULL,
		execution_comment TEXT,
		note_public TEXT,
		note_private TEXT,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER NOT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14),
		status INTEGER DEFAULT 0 NOT NULL
	) ENGINE=innodb', 'create activity table');

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_validation (
		rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
		entity INTEGER DEFAULT 1 NOT NULL,
		ref VARCHAR(128) NOT NULL,
		fk_expense INTEGER NOT NULL,
		action VARCHAR(32) NOT NULL,
		from_status VARCHAR(32) DEFAULT NULL,
		to_status VARCHAR(32) NOT NULL,
		fk_user_action INTEGER NOT NULL,
		action_date DATETIME NOT NULL,
		comment TEXT,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER NOT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14)
	) ENGINE=innodb', 'create validation table');

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_report (
		rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
		entity INTEGER DEFAULT 1 NOT NULL,
		ref VARCHAR(128) NOT NULL,
		name VARCHAR(255) NOT NULL,
		scope VARCHAR(32) NOT NULL,
		expected_format VARCHAR(64) DEFAULT NULL,
		filters TEXT,
		must_include TEXT,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER NOT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14)
	) ENGINE=innodb', 'create report table');

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_fund_receipt (
		rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
		entity INTEGER DEFAULT 1 NOT NULL,
		ref VARCHAR(128) NOT NULL,
		fk_soc INTEGER NOT NULL,
		fk_project INTEGER DEFAULT NULL,
		fk_convention INTEGER NOT NULL,
		amount DOUBLE(24,8) NOT NULL,
		reception_date DATE DEFAULT NULL,
		supporting_document VARCHAR(255) DEFAULT NULL,
		comment TEXT,
		status INTEGER DEFAULT 0 NOT NULL,
		note_public TEXT,
		note_private TEXT,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER NOT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14)
	) ENGINE=innodb', 'create fund receipt table');

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_invitation (
		rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
		entity INTEGER DEFAULT 1 NOT NULL,
		fk_user INTEGER NOT NULL,
		status VARCHAR(32) NOT NULL,
		token_hash VARCHAR(128) DEFAULT NULL,
		date_expiry DATETIME DEFAULT NULL,
		date_sent DATETIME DEFAULT NULL,
		date_accepted DATETIME DEFAULT NULL,
		date_revoked DATETIME DEFAULT NULL,
		fk_user_sender INTEGER DEFAULT NULL,
		fk_user_revoked INTEGER DEFAULT NULL,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER NOT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14)
	) ENGINE=innodb', 'create invitation table');

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_password_reset (
			rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
			entity INTEGER DEFAULT 1 NOT NULL,
			fk_user INTEGER NOT NULL,
			status VARCHAR(32) DEFAULT \'sent\' NOT NULL,
			token_hash VARCHAR(128) DEFAULT NULL,
			date_expiry DATETIME NOT NULL,
		date_consumed DATETIME DEFAULT NULL,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER NOT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14)
	) ENGINE=innodb', 'create password reset table');

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_access_audit (
		rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
		entity INTEGER DEFAULT 1 NOT NULL,
		fk_user INTEGER DEFAULT NULL,
		fk_actor INTEGER DEFAULT NULL,
		event VARCHAR(64) NOT NULL,
		event_date DATETIME NOT NULL,
		context TEXT,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER DEFAULT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14)
	) ENGINE=innodb', 'create access audit table');

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_project_note (
		rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
		entity INTEGER DEFAULT 1 NOT NULL,
		fk_project INTEGER NOT NULL,
		message TEXT NOT NULL,
		date_note DATETIME NOT NULL,
		fk_user_author INTEGER NOT NULL,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER NOT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14)
	) ENGINE=innodb', 'create project note table');

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_user_role (
		rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
		entity INTEGER DEFAULT 1 NOT NULL,
		fk_user INTEGER NOT NULL,
		role_code VARCHAR(64) NOT NULL,
		is_active TINYINT DEFAULT 1 NOT NULL,
		date_start DATETIME DEFAULT NULL,
		date_end DATETIME DEFAULT NULL,
		source VARCHAR(64) DEFAULT NULL,
		note TEXT,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER DEFAULT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14)
	) ENGINE=innodb', 'create user role table');

	mjl_query('CREATE TABLE IF NOT EXISTS '.$db->prefix().'mjlfinancement_user_soc_scope (
		rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
		entity INTEGER DEFAULT 1 NOT NULL,
		fk_user INTEGER NOT NULL,
		fk_soc INTEGER NOT NULL,
		is_active TINYINT DEFAULT 1 NOT NULL,
		date_start DATETIME DEFAULT NULL,
		date_end DATETIME DEFAULT NULL,
		source VARCHAR(64) DEFAULT NULL,
		note TEXT,
		date_creation DATETIME NOT NULL,
		tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		fk_user_creat INTEGER DEFAULT NULL,
		fk_user_modif INTEGER DEFAULT NULL,
		import_key VARCHAR(14)
	) ENGINE=innodb', 'create user scope table');

	mjl_add_column('mjlfinancement_convention', 'title', 'VARCHAR(255) DEFAULT NULL');
	mjl_add_column('mjlfinancement_convention', 'total_amount', 'DOUBLE(24,8) DEFAULT NULL');
	mjl_add_column('mjlfinancement_convention', 'currency_code', "VARCHAR(3) DEFAULT 'XOF'");
	mjl_add_column('mjlfinancement_budget_line', 'fk_convention', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_budget_line', 'fk_project', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_budget_line', 'fk_mjl_activity', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_budget_line', 'fk_activity', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_budget_line', 'initial_budget', 'DOUBLE(24,8) DEFAULT NULL');
	mjl_add_column('mjlfinancement_budget_line', 'revised_budget', 'DOUBLE(24,8) DEFAULT NULL');
	mjl_add_column('mjlfinancement_budget_line', 'committed_amount', 'DOUBLE(24,8) DEFAULT 0');
	mjl_add_column('mjlfinancement_budget_line', 'spent_amount', 'DOUBLE(24,8) DEFAULT 0');
	mjl_add_column('mjlfinancement_budget_line', 'remaining_amount', 'DOUBLE(24,8) DEFAULT 0');
	mjl_add_column('mjlfinancement_budget_line', 'category', 'VARCHAR(64) DEFAULT NULL');
	mjl_add_column('mjlfinancement_budget_line', 'status', 'INTEGER DEFAULT 0 NOT NULL');
	mjl_add_column('mjlfinancement_expense', 'fk_project', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_expense', 'fk_convention', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_expense', 'fk_mjl_activity', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_expense', 'fk_budget_line', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_expense', 'description', 'TEXT');
	mjl_add_column('mjlfinancement_expense', 'supporting_document', 'VARCHAR(255) DEFAULT NULL');
	mjl_add_column('mjlfinancement_expense', 'fk_user_valid', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_expense', 'validation_date', 'DATETIME DEFAULT NULL');
	mjl_add_column('mjlfinancement_expense', 'correction_reason', 'TEXT');
	mjl_add_column('mjlfinancement_expense', 'submitted_at', 'DATETIME DEFAULT NULL');
	mjl_add_column('mjlfinancement_fund_receipt', 'fk_project', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_fund_receipt', 'status', 'INTEGER DEFAULT 0 NOT NULL');
	mjl_add_column('mjlfinancement_password_reset', 'status', "VARCHAR(32) DEFAULT 'sent' NOT NULL");
	mjl_add_column('mjlfinancement_activity', 'fk_user_responsible', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_activity', 'date_actual_start', 'DATE DEFAULT NULL');
	mjl_add_column('mjlfinancement_activity', 'date_actual_end', 'DATE DEFAULT NULL');
	mjl_add_column('mjlfinancement_activity', 'physical_execution_percent', 'INTEGER DEFAULT NULL');
	mjl_add_column('mjlfinancement_activity', 'execution_status', 'VARCHAR(32) DEFAULT NULL');
	mjl_add_column('mjlfinancement_activity', 'execution_comment', 'TEXT');

	mjl_add_unique_index('mjlfinancement_convention', 'uk_mjlfinancement_convention_ref_entity', 'ref, entity');
	mjl_add_unique_index('mjlfinancement_activity', 'uk_mjlfinancement_activity_ref_entity', 'ref, entity');
	mjl_add_unique_index('mjlfinancement_budget_line', 'uk_mjlfinancement_budget_line_ref_entity', 'ref, entity');
	mjl_add_unique_index('mjlfinancement_fund_receipt', 'uk_mjlfinancement_fund_receipt_ref_entity', 'ref, entity');
	mjl_add_unique_index('mjlfinancement_expense', 'uk_mjlfinancement_expense_ref_entity', 'ref, entity');
	mjl_add_unique_index('mjlfinancement_validation', 'uk_mjlfinancement_validation_ref_entity', 'ref, entity');
	mjl_add_unique_index('mjlfinancement_report', 'uk_mjlfinancement_report_ref_entity', 'ref, entity');
	foreach (array(
		array('mjlfinancement_convention', 'idx_mjlfinancement_convention_entity', 'entity'),
		array('mjlfinancement_convention', 'idx_mjlfinancement_convention_fk_soc', 'fk_soc'),
		array('mjlfinancement_convention', 'idx_mjlfinancement_convention_fk_project', 'fk_project'),
		array('mjlfinancement_activity', 'idx_mjlfinancement_activity_entity', 'entity'),
		array('mjlfinancement_activity', 'idx_mjlfinancement_activity_fk_project', 'fk_project'),
		array('mjlfinancement_activity', 'idx_mjlfinancement_activity_fk_convention', 'fk_convention'),
		array('mjlfinancement_activity', 'idx_mjlfinancement_activity_fk_task', 'fk_task'),
		array('mjlfinancement_activity', 'idx_mjlfinancement_activity_fk_user_responsible', 'fk_user_responsible'),
		array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_entity', 'entity'),
		array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_fk_project', 'fk_project'),
		array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_fk_convention', 'fk_convention'),
		array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_fk_mjl_activity', 'fk_mjl_activity'),
		array('mjlfinancement_budget_line', 'idx_mjlfinancement_budget_line_fk_activity', 'fk_activity'),
		array('mjlfinancement_fund_receipt', 'idx_mjlfinancement_fund_receipt_entity', 'entity'),
		array('mjlfinancement_fund_receipt', 'idx_mjlfinancement_fund_receipt_fk_soc', 'fk_soc'),
		array('mjlfinancement_fund_receipt', 'idx_mjlfinancement_fund_receipt_fk_project', 'fk_project'),
		array('mjlfinancement_fund_receipt', 'idx_mjlfinancement_fund_receipt_fk_convention', 'fk_convention'),
		array('mjlfinancement_expense', 'idx_mjlfinancement_expense_entity', 'entity'),
		array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_project', 'fk_project'),
		array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_convention', 'fk_convention'),
		array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_mjl_activity', 'fk_mjl_activity'),
		array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_budget_line', 'fk_budget_line'),
		array('mjlfinancement_expense', 'idx_mjlfinancement_expense_fk_user_valid', 'fk_user_valid'),
		array('mjlfinancement_validation', 'idx_mjlfinancement_validation_entity', 'entity'),
		array('mjlfinancement_validation', 'idx_mjlfinancement_validation_fk_expense', 'fk_expense'),
		array('mjlfinancement_validation', 'idx_mjlfinancement_validation_fk_user_action', 'fk_user_action'),
		array('mjlfinancement_report', 'idx_mjlfinancement_report_entity', 'entity'),
		array('mjlfinancement_invitation', 'idx_mjlfinancement_invitation_entity', 'entity'),
		array('mjlfinancement_invitation', 'idx_mjlfinancement_invitation_fk_user', 'fk_user'),
		array('mjlfinancement_invitation', 'idx_mjlfinancement_invitation_status', 'status'),
		array('mjlfinancement_invitation', 'idx_mjlfinancement_invitation_token_hash', 'token_hash'),
		array('mjlfinancement_password_reset', 'idx_mjlfinancement_password_reset_entity', 'entity'),
		array('mjlfinancement_password_reset', 'idx_mjlfinancement_password_reset_fk_user', 'fk_user'),
		array('mjlfinancement_password_reset', 'idx_mjlfinancement_password_reset_status', 'status'),
		array('mjlfinancement_password_reset', 'idx_mjlfinancement_password_reset_token_hash', 'token_hash'),
		array('mjlfinancement_access_audit', 'idx_mjlfinancement_access_audit_entity', 'entity'),
		array('mjlfinancement_access_audit', 'idx_mjlfinancement_access_audit_fk_user', 'fk_user'),
		array('mjlfinancement_access_audit', 'idx_mjlfinancement_access_audit_event', 'event'),
		array('mjlfinancement_project_note', 'idx_mjlfinancement_project_note_entity', 'entity'),
		array('mjlfinancement_project_note', 'idx_mjlfinancement_project_note_fk_project', 'fk_project'),
		array('mjlfinancement_project_note', 'idx_mjlfinancement_project_note_fk_user_author', 'fk_user_author'),
		array('mjlfinancement_user_role', 'idx_mjlfinancement_user_role_entity', 'entity'),
		array('mjlfinancement_user_role', 'idx_mjlfinancement_user_role_fk_user', 'fk_user'),
		array('mjlfinancement_user_role', 'idx_mjlfinancement_user_role_active', 'entity, fk_user, is_active'),
		array('mjlfinancement_user_role', 'idx_mjlfinancement_user_role_code', 'role_code'),
		array('mjlfinancement_user_soc_scope', 'idx_mjlfinancement_user_soc_scope_entity', 'entity'),
		array('mjlfinancement_user_soc_scope', 'idx_mjlfinancement_user_soc_scope_fk_user', 'fk_user'),
		array('mjlfinancement_user_soc_scope', 'idx_mjlfinancement_user_soc_scope_fk_soc', 'fk_soc'),
		array('mjlfinancement_user_soc_scope', 'idx_mjlfinancement_user_soc_scope_active', 'entity, fk_user, is_active'),
	) as $index) {
		mjl_add_index($index[0], $index[1], $index[2]);
	}
}

function mjl_add_column($table, $column, $definition)
{
	global $db;

	if (mjl_column_exists($table, $column)) {
		return;
	}
	mjl_query('ALTER TABLE '.$db->prefix().$table.' ADD COLUMN '.$column.' '.$definition, 'add '.$table.'.'.$column);
}

function mjl_column_exists($table, $column)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND COLUMN_NAME = '".$db->escape($column)."'";
	return mjl_scalar($sql) > 0;
}

function mjl_add_unique_index($table, $name, $columns)
{
	mjl_add_index($table, $name, $columns, true);
}

function mjl_add_index($table, $name, $columns, $unique = false)
{
	global $db;

	if (mjl_index_exists($table, $name)) {
		return;
	}
	mjl_query('ALTER TABLE '.$db->prefix().$table.' ADD '.($unique ? 'UNIQUE ' : '').'INDEX '.$name.' ('.$columns.')', 'add index '.$name);
}

function mjl_index_exists($table, $name)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$sql .= " AND INDEX_NAME = '".$db->escape($name)."'";
	return mjl_scalar($sql) > 0;
}

function mjl_scalar($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('SQL scalar failed: '.$db->lasterror().' SQL='.$sql);
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (int) $obj->nb : 0;
}

function mjl_fetch_id($table, $where)
{
	global $db;

	$sql = 'SELECT rowid FROM '.$db->prefix().$table.' WHERE '.$where;
	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch id from '.$table.': '.$db->lasterror());
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (int) $obj->rowid : 0;
}

function mjl_sql_string($value)
{
	global $db;

	if ($value === null || $value === '') {
		return 'NULL';
	}
	return "'".$db->escape((string) $value)."'";
}

function mjl_sql_date($value)
{
	return $value === '' || $value === null ? 'NULL' : mjl_sql_string($value);
}

function mjl_sql_datetime($value)
{
	if ($value === '' || $value === null) {
		return 'NULL';
	}
	if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
		$value .= ' 12:00:00';
	}
	return mjl_sql_string($value);
}

function mjl_query($sql, $label = 'query')
{
	global $db;

	if (!$db->query($sql)) {
		fail('Unable to '.$label.': '.$db->lasterror().' SQL='.$sql);
	}
}

function mjl_status_convention($status)
{
	return $status === 'active' ? 1 : 0;
}

function mjl_status_project($status)
{
	return $status === 'active' ? 1 : 0;
}

function mjl_status_activity($status)
{
	if ($status === 'completed') {
		return 2;
	}
	return $status === 'ongoing' ? 1 : 0;
}

function mjl_status_budget_line($status)
{
	return $status === 'active' ? 1 : 0;
}

function mjl_status_expense($status)
{
	$map = array('draft' => 0, 'submitted' => 1, 'validated' => 2, 'corrected' => 3, 'rejected' => 8);
	return isset($map[$status]) ? $map[$status] : 0;
}

function mjl_status_receipt($status)
{
	if ($status === 'recorded') {
		return 1;
	}
	return $status === 'not_received' ? 8 : 0;
}

function mjl_out($message)
{
	print $message.PHP_EOL;
}

if (!function_exists('fail')) {
	function fail($message)
	{
		fwrite(STDERR, 'ERROR: '.$message.PHP_EOL);
		exit(1);
	}
}
