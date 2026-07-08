-- MJL Financement 0.10.0 expense final-validation and disbursement workflow.
-- Non-destructive: legacy expense status 2 keeps its existing validated meaning.

ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS prevalidated_amount DOUBLE(24,8) DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS final_validated_amount DOUBLE(24,8) DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS disbursed_amount DOUBLE(24,8) DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS fk_user_prevalidated INTEGER DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS fk_user_final_valid INTEGER DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS fk_user_disbursed INTEGER DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS prevalidation_date DATETIME DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS final_validation_date DATETIME DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS disbursement_date DATE DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_expense ADD COLUMN IF NOT EXISTS beneficiary_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_validation ADD COLUMN IF NOT EXISTS actor_role VARCHAR(64) DEFAULT NULL;

UPDATE llx_mjlfinancement_expense
SET final_validated_amount = COALESCE(final_validated_amount, amount),
	fk_user_final_valid = COALESCE(fk_user_final_valid, fk_user_valid),
	final_validation_date = COALESCE(final_validation_date, validation_date)
WHERE status = 2;

UPDATE llx_mjlfinancement_validation
SET actor_role = 'AGENT_VERIFICATEUR'
WHERE actor_role IS NULL AND action IN ('validated', 'prevalidated');

UPDATE llx_mjlfinancement_validation
SET actor_role = 'VALIDATEUR_DEFINITIF'
WHERE actor_role IS NULL AND action IN ('final_validated', 'disbursed');

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'idx_mjlfinancement_expense_fk_user_prevalidated') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD INDEX idx_mjlfinancement_expense_fk_user_prevalidated (fk_user_prevalidated)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'idx_mjlfinancement_expense_fk_user_final_valid') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD INDEX idx_mjlfinancement_expense_fk_user_final_valid (fk_user_final_valid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND INDEX_NAME = 'idx_mjlfinancement_expense_fk_user_disbursed') = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD INDEX idx_mjlfinancement_expense_fk_user_disbursed (fk_user_disbursed)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_validation' AND INDEX_NAME = 'idx_mjlfinancement_validation_actor_role') = 0, 'ALTER TABLE llx_mjlfinancement_validation ADD INDEX idx_mjlfinancement_validation_actor_role (actor_role)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND CONSTRAINT_NAME = 'fk_mjlfinancement_expense_user_prevalidated' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0 AND (SELECT COUNT(*) FROM llx_mjlfinancement_expense e LEFT JOIN llx_user u ON u.rowid = e.fk_user_prevalidated WHERE e.fk_user_prevalidated IS NOT NULL AND u.rowid IS NULL) = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD CONSTRAINT fk_mjlfinancement_expense_user_prevalidated FOREIGN KEY (fk_user_prevalidated) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND CONSTRAINT_NAME = 'fk_mjlfinancement_expense_user_final_valid' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0 AND (SELECT COUNT(*) FROM llx_mjlfinancement_expense e LEFT JOIN llx_user u ON u.rowid = e.fk_user_final_valid WHERE e.fk_user_final_valid IS NOT NULL AND u.rowid IS NULL) = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD CONSTRAINT fk_mjlfinancement_expense_user_final_valid FOREIGN KEY (fk_user_final_valid) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_expense' AND CONSTRAINT_NAME = 'fk_mjlfinancement_expense_user_disbursed' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0 AND (SELECT COUNT(*) FROM llx_mjlfinancement_expense e LEFT JOIN llx_user u ON u.rowid = e.fk_user_disbursed WHERE e.fk_user_disbursed IS NOT NULL AND u.rowid IS NULL) = 0, 'ALTER TABLE llx_mjlfinancement_expense ADD CONSTRAINT fk_mjlfinancement_expense_user_disbursed FOREIGN KEY (fk_user_disbursed) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;
