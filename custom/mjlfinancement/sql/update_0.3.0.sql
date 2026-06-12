-- MJL Financement 0.3.0 schema upgrade for CSV-driven sample data.

CREATE TABLE IF NOT EXISTS llx_mjlfinancement_activity (
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
) ENGINE=innodb;

CREATE TABLE IF NOT EXISTS llx_mjlfinancement_validation (
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
) ENGINE=innodb;

CREATE TABLE IF NOT EXISTS llx_mjlfinancement_report (
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
) ENGINE=innodb;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'fk_project') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN fk_project INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'fk_mjl_activity') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN fk_mjl_activity INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'category') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN category VARCHAR(64) DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'status') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN status INTEGER DEFAULT 0 NOT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'fk_mjl_activity') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD COLUMN fk_mjl_activity INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'submitted_at') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD COLUMN submitted_at DATETIME DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_fund_receipt' AND COLUMN_NAME = 'fk_project') = 0, 'ALTER TABLE llx_mjlfinancement_fund_receipt ADD COLUMN fk_project INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_fund_receipt' AND COLUMN_NAME = 'status') = 0, 'ALTER TABLE llx_mjlfinancement_fund_receipt ADD COLUMN status INTEGER DEFAULT 0 NOT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND COLUMN_NAME = 'label') > 0, 'SET @mjl_legacy_convention_label = (SELECT COUNT(*) FROM llx_mjlfinancement_convention WHERE label IS NOT NULL AND label <> '''')', 'SET @mjl_legacy_convention_label = -1');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF(@mjl_legacy_convention_label = 0, 'ALTER TABLE llx_mjlfinancement_convention DROP COLUMN label', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND COLUMN_NAME = 'amount') > 0, 'SET @mjl_legacy_convention_amount = (SELECT COUNT(*) FROM llx_mjlfinancement_convention WHERE amount IS NOT NULL)', 'SET @mjl_legacy_convention_amount = -1');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF(@mjl_legacy_convention_amount = 0, 'ALTER TABLE llx_mjlfinancement_convention DROP COLUMN amount', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'amount_planned') > 0, 'SET @mjl_legacy_budget_amount_planned = (SELECT COUNT(*) FROM llx_mjlfinancement_budget_line WHERE amount_planned IS NOT NULL)', 'SET @mjl_legacy_budget_amount_planned = -1');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF(@mjl_legacy_budget_amount_planned = 0, 'ALTER TABLE llx_mjlfinancement_budget_line DROP COLUMN amount_planned', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'amount_committed') > 0, 'SET @mjl_legacy_budget_amount_committed = (SELECT COUNT(*) FROM llx_mjlfinancement_budget_line WHERE amount_committed IS NOT NULL)', 'SET @mjl_legacy_budget_amount_committed = -1');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF(@mjl_legacy_budget_amount_committed = 0, 'ALTER TABLE llx_mjlfinancement_budget_line DROP COLUMN amount_committed', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'label') > 0, 'SET @mjl_legacy_expense_label = (SELECT COUNT(*) FROM llx_mjlfinancement_expense WHERE label IS NOT NULL AND label <> '''')', 'SET @mjl_legacy_expense_label = -1');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF(@mjl_legacy_expense_label = 0, 'ALTER TABLE llx_mjlfinancement_expense DROP COLUMN label', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'fk_expensereport') > 0, 'SET @mjl_legacy_expense_expensereport = (SELECT COUNT(*) FROM llx_mjlfinancement_expense WHERE fk_expensereport IS NOT NULL)', 'SET @mjl_legacy_expense_expensereport = -1');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_drop_expensereport = @mjl_legacy_expense_expensereport = 0;

SET @mjl_sql = IF(@mjl_drop_expensereport AND (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND CONSTRAINT_NAME = 'fk_mjlfinancement_expense_expensereport' AND CONSTRAINT_TYPE = 'FOREIGN KEY') > 0, 'ALTER TABLE llx_mjlfinancement_expense DROP FOREIGN KEY fk_mjlfinancement_expense_expensereport', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF(@mjl_drop_expensereport AND (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'idx_mjlfinancement_expense_fk_expensereport') > 0, 'ALTER TABLE llx_mjlfinancement_expense DROP INDEX idx_mjlfinancement_expense_fk_expensereport', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF(@mjl_drop_expensereport, 'ALTER TABLE llx_mjlfinancement_expense DROP COLUMN fk_expensereport', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;
