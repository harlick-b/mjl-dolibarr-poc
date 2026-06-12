-- MJL Financement 0.2.0 schema upgrade.
-- This file is intentionally idempotent: Dolibarr runs update*.sql during
-- module activation, including on fresh installs after the base table files.

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND COLUMN_NAME = 'title') = 0, 'ALTER TABLE llx_mjlfinancement_convention ADD COLUMN title VARCHAR(255) DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND COLUMN_NAME = 'total_amount') = 0, 'ALTER TABLE llx_mjlfinancement_convention ADD COLUMN total_amount DOUBLE(24,8) DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND COLUMN_NAME = 'currency_code') = 0, 'ALTER TABLE llx_mjlfinancement_convention ADD COLUMN currency_code VARCHAR(3) DEFAULT ''XOF''', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND COLUMN_NAME = 'label') > 0, 'UPDATE llx_mjlfinancement_convention SET title = label WHERE (title IS NULL OR title = '''') AND label IS NOT NULL AND label <> ''''', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_convention SET title = ref WHERE (title IS NULL OR title = '') AND ref IS NOT NULL AND ref <> '';

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND COLUMN_NAME = 'amount') > 0, 'UPDATE llx_mjlfinancement_convention SET total_amount = amount WHERE total_amount IS NULL AND amount IS NOT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_convention SET currency_code = 'XOF' WHERE currency_code IS NULL OR currency_code = '';
ALTER TABLE llx_mjlfinancement_convention MODIFY COLUMN title VARCHAR(255) NOT NULL;
ALTER TABLE llx_mjlfinancement_convention MODIFY COLUMN currency_code VARCHAR(3) DEFAULT 'XOF' NOT NULL;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'fk_convention') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN fk_convention INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'fk_activity') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN fk_activity INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'initial_budget') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN initial_budget DOUBLE(24,8) DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'revised_budget') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN revised_budget DOUBLE(24,8) DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'committed_amount') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN committed_amount DOUBLE(24,8) DEFAULT 0', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'spent_amount') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN spent_amount DOUBLE(24,8) DEFAULT 0', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'remaining_amount') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD COLUMN remaining_amount DOUBLE(24,8) DEFAULT 0', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'amount_planned') > 0, 'UPDATE llx_mjlfinancement_budget_line SET initial_budget = amount_planned WHERE initial_budget IS NULL AND amount_planned IS NOT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'amount_committed') > 0, 'UPDATE llx_mjlfinancement_budget_line SET committed_amount = amount_committed WHERE committed_amount IS NULL AND amount_committed IS NOT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_budget_line SET initial_budget = 0 WHERE initial_budget IS NULL;
UPDATE llx_mjlfinancement_budget_line SET revised_budget = 0 WHERE revised_budget IS NULL;
UPDATE llx_mjlfinancement_budget_line SET committed_amount = 0 WHERE committed_amount IS NULL;
UPDATE llx_mjlfinancement_budget_line SET spent_amount = 0 WHERE spent_amount IS NULL;
UPDATE llx_mjlfinancement_budget_line SET remaining_amount = 0 WHERE remaining_amount IS NULL;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'fk_project') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD COLUMN fk_project INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'fk_convention') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD COLUMN fk_convention INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'fk_budget_line') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD COLUMN fk_budget_line INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'supporting_document') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD COLUMN supporting_document VARCHAR(255) DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'fk_user_valid') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD COLUMN fk_user_valid INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'validation_date') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD COLUMN validation_date DATETIME DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND COLUMN_NAME = 'correction_reason') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD COLUMN correction_reason TEXT', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_expense e
INNER JOIN llx_mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line
SET e.fk_convention = bl.fk_convention
WHERE e.fk_convention IS NULL AND e.fk_budget_line IS NOT NULL AND bl.fk_convention IS NOT NULL;

UPDATE llx_mjlfinancement_expense e
INNER JOIN llx_mjlfinancement_convention c ON c.rowid = e.fk_convention
SET e.fk_project = c.fk_project
WHERE e.fk_project IS NULL AND e.fk_convention IS NOT NULL AND c.fk_project IS NOT NULL;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND COLUMN_NAME = 'fk_project') > 0, 'UPDATE llx_mjlfinancement_expense e INNER JOIN llx_mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line SET e.fk_project = bl.fk_project WHERE e.fk_project IS NULL AND e.fk_budget_line IS NOT NULL AND bl.fk_project IS NOT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF(EXISTS(SELECT 1 FROM llx_mjlfinancement_convention c LEFT JOIN llx_societe s ON s.rowid = c.fk_soc WHERE c.fk_soc IS NOT NULL AND s.rowid IS NULL), 'ALTER TABLE llx_mjlfinancement_convention MODIFY COLUMN fk_soc INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_convention c LEFT JOIN llx_societe s ON s.rowid = c.fk_soc SET c.fk_soc = NULL WHERE c.fk_soc IS NOT NULL AND s.rowid IS NULL;
UPDATE llx_mjlfinancement_convention c LEFT JOIN llx_projet p ON p.rowid = c.fk_project SET c.fk_project = NULL WHERE c.fk_project IS NOT NULL AND p.rowid IS NULL;

SET @mjl_sql = IF(EXISTS(SELECT 1 FROM llx_mjlfinancement_budget_line bl LEFT JOIN llx_mjlfinancement_convention c ON c.rowid = bl.fk_convention WHERE bl.fk_convention IS NOT NULL AND c.rowid IS NULL), 'ALTER TABLE llx_mjlfinancement_budget_line MODIFY COLUMN fk_convention INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_budget_line bl LEFT JOIN llx_mjlfinancement_convention c ON c.rowid = bl.fk_convention SET bl.fk_convention = NULL WHERE bl.fk_convention IS NOT NULL AND c.rowid IS NULL;
UPDATE llx_mjlfinancement_budget_line bl LEFT JOIN llx_projet_task t ON t.rowid = bl.fk_activity SET bl.fk_activity = NULL WHERE bl.fk_activity IS NOT NULL AND t.rowid IS NULL;

SET @mjl_sql = IF(EXISTS(SELECT 1 FROM llx_mjlfinancement_expense e LEFT JOIN llx_projet p ON p.rowid = e.fk_project WHERE e.fk_project IS NOT NULL AND p.rowid IS NULL), 'ALTER TABLE llx_mjlfinancement_expense MODIFY COLUMN fk_project INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_expense e LEFT JOIN llx_projet p ON p.rowid = e.fk_project SET e.fk_project = NULL WHERE e.fk_project IS NOT NULL AND p.rowid IS NULL;

SET @mjl_sql = IF(EXISTS(SELECT 1 FROM llx_mjlfinancement_expense e LEFT JOIN llx_mjlfinancement_convention c ON c.rowid = e.fk_convention WHERE e.fk_convention IS NOT NULL AND c.rowid IS NULL), 'ALTER TABLE llx_mjlfinancement_expense MODIFY COLUMN fk_convention INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_expense e LEFT JOIN llx_mjlfinancement_convention c ON c.rowid = e.fk_convention SET e.fk_convention = NULL WHERE e.fk_convention IS NOT NULL AND c.rowid IS NULL;

SET @mjl_sql = IF(EXISTS(SELECT 1 FROM llx_mjlfinancement_expense e LEFT JOIN llx_mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line WHERE e.fk_budget_line IS NOT NULL AND bl.rowid IS NULL), 'ALTER TABLE llx_mjlfinancement_expense MODIFY COLUMN fk_budget_line INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_expense e LEFT JOIN llx_mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line SET e.fk_budget_line = NULL WHERE e.fk_budget_line IS NOT NULL AND bl.rowid IS NULL;
UPDATE llx_mjlfinancement_expense e LEFT JOIN llx_user u ON u.rowid = e.fk_user_valid SET e.fk_user_valid = NULL WHERE e.fk_user_valid IS NOT NULL AND u.rowid IS NULL;

CREATE TABLE IF NOT EXISTS llx_mjlfinancement_fund_receipt (
	rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
	entity INTEGER DEFAULT 1 NOT NULL,
	ref VARCHAR(128) NOT NULL,
	fk_soc INTEGER NOT NULL,
	fk_convention INTEGER NOT NULL,
	amount DOUBLE(24,8) NOT NULL,
	reception_date DATE DEFAULT NULL,
	supporting_document VARCHAR(255) DEFAULT NULL,
	comment TEXT,
	note_public TEXT,
	note_private TEXT,
	date_creation DATETIME NOT NULL,
	tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	fk_user_creat INTEGER NOT NULL,
	fk_user_modif INTEGER DEFAULT NULL,
	import_key VARCHAR(14)
) ENGINE=innodb;

SET @mjl_sql = IF(EXISTS(SELECT 1 FROM llx_mjlfinancement_fund_receipt fr LEFT JOIN llx_societe s ON s.rowid = fr.fk_soc WHERE fr.fk_soc IS NOT NULL AND s.rowid IS NULL), 'ALTER TABLE llx_mjlfinancement_fund_receipt MODIFY COLUMN fk_soc INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_fund_receipt fr LEFT JOIN llx_societe s ON s.rowid = fr.fk_soc SET fr.fk_soc = NULL WHERE fr.fk_soc IS NOT NULL AND s.rowid IS NULL;

SET @mjl_sql = IF(EXISTS(SELECT 1 FROM llx_mjlfinancement_fund_receipt fr LEFT JOIN llx_mjlfinancement_convention c ON c.rowid = fr.fk_convention WHERE fr.fk_convention IS NOT NULL AND c.rowid IS NULL), 'ALTER TABLE llx_mjlfinancement_fund_receipt MODIFY COLUMN fk_convention INTEGER DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_fund_receipt fr LEFT JOIN llx_mjlfinancement_convention c ON c.rowid = fr.fk_convention SET fr.fk_convention = NULL WHERE fr.fk_convention IS NOT NULL AND c.rowid IS NULL;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND INDEX_NAME = 'uk_mjlfinancement_convention_ref_entity') = 0, 'ALTER TABLE llx_mjlfinancement_convention ADD UNIQUE INDEX uk_mjlfinancement_convention_ref_entity (ref, entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND INDEX_NAME = 'idx_mjlfinancement_convention_entity') = 0, 'ALTER TABLE llx_mjlfinancement_convention ADD INDEX idx_mjlfinancement_convention_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND INDEX_NAME = 'idx_mjlfinancement_convention_fk_soc') = 0, 'ALTER TABLE llx_mjlfinancement_convention ADD INDEX idx_mjlfinancement_convention_fk_soc (fk_soc)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND INDEX_NAME = 'idx_mjlfinancement_convention_fk_project') = 0, 'ALTER TABLE llx_mjlfinancement_convention ADD INDEX idx_mjlfinancement_convention_fk_project (fk_project)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND CONSTRAINT_NAME = 'fk_mjlfinancement_convention_soc' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_convention ADD CONSTRAINT fk_mjlfinancement_convention_soc FOREIGN KEY (fk_soc) REFERENCES llx_societe(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_convention' AND CONSTRAINT_NAME = 'fk_mjlfinancement_convention_project' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_convention ADD CONSTRAINT fk_mjlfinancement_convention_project FOREIGN KEY (fk_project) REFERENCES llx_projet(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND INDEX_NAME = 'uk_mjlfinancement_budget_line_ref_entity') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD UNIQUE INDEX uk_mjlfinancement_budget_line_ref_entity (ref, entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND INDEX_NAME = 'idx_mjlfinancement_budget_line_entity') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD INDEX idx_mjlfinancement_budget_line_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND INDEX_NAME = 'idx_mjlfinancement_budget_line_fk_convention') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD INDEX idx_mjlfinancement_budget_line_fk_convention (fk_convention)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND INDEX_NAME = 'idx_mjlfinancement_budget_line_fk_activity') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD INDEX idx_mjlfinancement_budget_line_fk_activity (fk_activity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND CONSTRAINT_NAME = 'fk_mjlfinancement_budget_line_convention' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD CONSTRAINT fk_mjlfinancement_budget_line_convention FOREIGN KEY (fk_convention) REFERENCES llx_mjlfinancement_convention(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_budget_line' AND CONSTRAINT_NAME = 'fk_mjlfinancement_budget_line_activity' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_budget_line ADD CONSTRAINT fk_mjlfinancement_budget_line_activity FOREIGN KEY (fk_activity) REFERENCES llx_projet_task(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'uk_mjlfinancement_expense_ref_entity') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD UNIQUE INDEX uk_mjlfinancement_expense_ref_entity (ref, entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'idx_mjlfinancement_expense_entity') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD INDEX idx_mjlfinancement_expense_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'idx_mjlfinancement_expense_fk_project') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD INDEX idx_mjlfinancement_expense_fk_project (fk_project)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'idx_mjlfinancement_expense_fk_convention') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD INDEX idx_mjlfinancement_expense_fk_convention (fk_convention)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'idx_mjlfinancement_expense_fk_budget_line') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD INDEX idx_mjlfinancement_expense_fk_budget_line (fk_budget_line)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'idx_mjlfinancement_expense_fk_user_valid') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD INDEX idx_mjlfinancement_expense_fk_user_valid (fk_user_valid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND CONSTRAINT_NAME = 'fk_mjlfinancement_expense_project' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD CONSTRAINT fk_mjlfinancement_expense_project FOREIGN KEY (fk_project) REFERENCES llx_projet(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND CONSTRAINT_NAME = 'fk_mjlfinancement_expense_convention' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD CONSTRAINT fk_mjlfinancement_expense_convention FOREIGN KEY (fk_convention) REFERENCES llx_mjlfinancement_convention(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND CONSTRAINT_NAME = 'fk_mjlfinancement_expense_budget_line' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD CONSTRAINT fk_mjlfinancement_expense_budget_line FOREIGN KEY (fk_budget_line) REFERENCES llx_mjlfinancement_budget_line(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND CONSTRAINT_NAME = 'fk_mjlfinancement_expense_user_valid' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD CONSTRAINT fk_mjlfinancement_expense_user_valid FOREIGN KEY (fk_user_valid) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_fund_receipt' AND INDEX_NAME = 'uk_mjlfinancement_fund_receipt_ref_entity') = 0, 'ALTER TABLE llx_mjlfinancement_fund_receipt ADD UNIQUE INDEX uk_mjlfinancement_fund_receipt_ref_entity (ref, entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_fund_receipt' AND INDEX_NAME = 'idx_mjlfinancement_fund_receipt_entity') = 0, 'ALTER TABLE llx_mjlfinancement_fund_receipt ADD INDEX idx_mjlfinancement_fund_receipt_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_fund_receipt' AND INDEX_NAME = 'idx_mjlfinancement_fund_receipt_fk_soc') = 0, 'ALTER TABLE llx_mjlfinancement_fund_receipt ADD INDEX idx_mjlfinancement_fund_receipt_fk_soc (fk_soc)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_fund_receipt' AND INDEX_NAME = 'idx_mjlfinancement_fund_receipt_fk_convention') = 0, 'ALTER TABLE llx_mjlfinancement_fund_receipt ADD INDEX idx_mjlfinancement_fund_receipt_fk_convention (fk_convention)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_fund_receipt' AND CONSTRAINT_NAME = 'fk_mjlfinancement_fund_receipt_soc' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_fund_receipt ADD CONSTRAINT fk_mjlfinancement_fund_receipt_soc FOREIGN KEY (fk_soc) REFERENCES llx_societe(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_fund_receipt' AND CONSTRAINT_NAME = 'fk_mjlfinancement_fund_receipt_convention' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_fund_receipt ADD CONSTRAINT fk_mjlfinancement_fund_receipt_convention FOREIGN KEY (fk_convention) REFERENCES llx_mjlfinancement_convention(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;
