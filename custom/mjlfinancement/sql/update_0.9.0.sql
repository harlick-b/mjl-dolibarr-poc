-- MJL Financement 0.9.0 production activity workflow fields.
-- Non-destructive: existing activity status integers keep their meaning.

ALTER TABLE llx_mjlfinancement_activity ADD COLUMN IF NOT EXISTS fk_user_responsible INTEGER DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_activity ADD COLUMN IF NOT EXISTS date_actual_start DATE DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_activity ADD COLUMN IF NOT EXISTS date_actual_end DATE DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_activity ADD COLUMN IF NOT EXISTS physical_execution_percent INTEGER DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_activity ADD COLUMN IF NOT EXISTS execution_status VARCHAR(32) DEFAULT NULL;
ALTER TABLE llx_mjlfinancement_activity ADD COLUMN IF NOT EXISTS execution_comment TEXT;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_activity' AND INDEX_NAME = 'idx_mjlfinancement_activity_fk_user_responsible') = 0, 'ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjlfinancement_activity_fk_user_responsible (fk_user_responsible)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_activity' AND CONSTRAINT_NAME = 'fk_mjlfinancement_activity_responsible' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0 AND (SELECT COUNT(*) FROM llx_mjlfinancement_activity a LEFT JOIN llx_user u ON u.rowid = a.fk_user_responsible WHERE a.fk_user_responsible IS NOT NULL AND u.rowid IS NULL) = 0, 'ALTER TABLE llx_mjlfinancement_activity ADD CONSTRAINT fk_mjlfinancement_activity_responsible FOREIGN KEY (fk_user_responsible) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;
