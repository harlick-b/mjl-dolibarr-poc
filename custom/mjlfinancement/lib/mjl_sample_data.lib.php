<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';

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

function mjl_report_project_summary($projectId)
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$projectId = (int) $projectId;
	$sql = 'SELECT p.ref AS project_ref, p.title AS project_title,';
	$sql .= ' COALESCE(SUM(bl.revised_budget), 0) AS budget_total,';
	$sql .= ' (SELECT COALESCE(SUM(fr.amount), 0) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = '.$entity.' AND fr.fk_project = '.$projectId.' AND fr.status = 1) AS funds_received,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.') AS total_expenses,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.' AND e.status = 2) AS validated_expenses,';
	$sql .= ' (SELECT COALESCE(SUM(e.amount), 0) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = '.$entity.' AND e.fk_project = '.$projectId.' AND e.status = 1) AS pending_expenses';
	$sql .= ' FROM '.$db->prefix().'projet p';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.fk_project = p.rowid AND bl.entity = '.$entity;
	$sql .= ' WHERE p.rowid = '.$projectId.' GROUP BY p.rowid, p.ref, p.title';
	return mjl_fetch_row($sql);
}

function mjl_report_convention_budget($conventionId)
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$conventionId = (int) $conventionId;
	$sql = 'SELECT bl.ref, bl.label, bl.initial_budget, bl.revised_budget, bl.status,';
	$sql .= ' COALESCE(SUM(CASE WHEN e.status = 2 THEN e.amount ELSE 0 END), 0) AS validated_expenses,';
	$sql .= ' COALESCE(SUM(CASE WHEN e.status = 1 THEN e.amount ELSE 0 END), 0) AS submitted_expenses,';
	$sql .= ' bl.revised_budget - COALESCE(SUM(CASE WHEN e.status = 2 THEN e.amount ELSE 0 END), 0) AS remaining_amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.fk_budget_line = bl.rowid AND e.entity = '.$entity;
	$sql .= ' WHERE bl.entity = '.$entity.' AND bl.fk_convention = '.$conventionId;
	$sql .= ' GROUP BY bl.rowid, bl.ref, bl.label, bl.initial_budget, bl.revised_budget, bl.status';
	$sql .= ' ORDER BY bl.ref';
	return mjl_fetch_rows($sql);
}

function mjl_report_expense_documents($filters = array())
{
	global $db, $conf;

	$entity = (int) $conf->entity;
	$sql = 'SELECT e.ref AS expense_ref, e.expense_date, bl.ref AS budget_line, e.amount, e.status,';
	$sql .= ' CASE WHEN e.supporting_document IS NULL OR e.supporting_document = \'\' THEN 0 ELSE 1 END AS document_present,';
	$sql .= ' u.login AS validator, e.correction_reason';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = e.fk_user_valid';
	$sql .= ' WHERE e.entity = '.$entity;
	if (!empty($filters['project_id'])) {
		$sql .= ' AND e.fk_project = '.((int) $filters['project_id']);
	}
	if (!empty($filters['convention_id'])) {
		$sql .= ' AND e.fk_convention = '.((int) $filters['convention_id']);
	}
	if (isset($filters['missing_document'])) {
		$sql .= !empty($filters['missing_document']) ? ' AND (e.supporting_document IS NULL OR e.supporting_document = \'\')' : ' AND e.supporting_document IS NOT NULL AND e.supporting_document <> \'\'';
	}
	$sql .= ' ORDER BY e.ref';
	return mjl_fetch_rows($sql);
}

function mjl_fetch_row($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch report row: '.$db->lasterror());
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_fetch_rows($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		fail('Unable to fetch report rows: '.$db->lasterror());
	}
	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
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
