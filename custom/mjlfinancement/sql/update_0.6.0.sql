CREATE TABLE IF NOT EXISTS llx_mjlfinancement_invitation (
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
) ENGINE=innodb;

CREATE TABLE IF NOT EXISTS llx_mjlfinancement_password_reset (
	rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
	entity INTEGER DEFAULT 1 NOT NULL,
	fk_user INTEGER NOT NULL,
	status VARCHAR(32) DEFAULT 'sent' NOT NULL,
	token_hash VARCHAR(128) DEFAULT NULL,
	date_expiry DATETIME NOT NULL,
	date_consumed DATETIME DEFAULT NULL,
	date_creation DATETIME NOT NULL,
	tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	fk_user_creat INTEGER NOT NULL,
	fk_user_modif INTEGER DEFAULT NULL,
	import_key VARCHAR(14)
) ENGINE=innodb;

CREATE TABLE IF NOT EXISTS llx_mjlfinancement_access_audit (
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
) ENGINE=innodb;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_password_reset' AND COLUMN_NAME = 'status') = 0, 'ALTER TABLE llx_mjlfinancement_password_reset ADD COLUMN status VARCHAR(32) DEFAULT ''sent'' NOT NULL AFTER fk_user', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_password_reset' AND COLUMN_NAME = 'token_hash' AND IS_NULLABLE = 'NO') > 0, 'ALTER TABLE llx_mjlfinancement_password_reset MODIFY token_hash VARCHAR(128) DEFAULT NULL', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

UPDATE llx_mjlfinancement_password_reset SET status = 'consumed' WHERE date_consumed IS NOT NULL AND (status IS NULL OR status = '' OR status = 'sent');
UPDATE llx_mjlfinancement_password_reset SET status = 'sent' WHERE date_consumed IS NULL AND (status IS NULL OR status = '');

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_invitation' AND INDEX_NAME = 'idx_mjlfinancement_invitation_entity') = 0, 'ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjlfinancement_invitation_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_invitation' AND INDEX_NAME = 'idx_mjlfinancement_invitation_fk_user') = 0, 'ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjlfinancement_invitation_fk_user (fk_user)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_invitation' AND INDEX_NAME = 'idx_mjlfinancement_invitation_status') = 0, 'ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjlfinancement_invitation_status (status)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_invitation' AND INDEX_NAME = 'idx_mjlfinancement_invitation_token_hash') = 0, 'ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjlfinancement_invitation_token_hash (token_hash)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_invitation' AND CONSTRAINT_NAME = 'fk_mjlfinancement_invitation_user' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_invitation ADD CONSTRAINT fk_mjlfinancement_invitation_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_password_reset' AND INDEX_NAME = 'idx_mjlfinancement_password_reset_entity') = 0, 'ALTER TABLE llx_mjlfinancement_password_reset ADD INDEX idx_mjlfinancement_password_reset_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_password_reset' AND INDEX_NAME = 'idx_mjlfinancement_password_reset_fk_user') = 0, 'ALTER TABLE llx_mjlfinancement_password_reset ADD INDEX idx_mjlfinancement_password_reset_fk_user (fk_user)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_password_reset' AND INDEX_NAME = 'idx_mjlfinancement_password_reset_status') = 0, 'ALTER TABLE llx_mjlfinancement_password_reset ADD INDEX idx_mjlfinancement_password_reset_status (status)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_password_reset' AND INDEX_NAME = 'idx_mjlfinancement_password_reset_token_hash') = 0, 'ALTER TABLE llx_mjlfinancement_password_reset ADD INDEX idx_mjlfinancement_password_reset_token_hash (token_hash)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_password_reset' AND CONSTRAINT_NAME = 'fk_mjlfinancement_password_reset_user' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_password_reset ADD CONSTRAINT fk_mjlfinancement_password_reset_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_access_audit' AND INDEX_NAME = 'idx_mjlfinancement_access_audit_entity') = 0, 'ALTER TABLE llx_mjlfinancement_access_audit ADD INDEX idx_mjlfinancement_access_audit_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_access_audit' AND INDEX_NAME = 'idx_mjlfinancement_access_audit_fk_user') = 0, 'ALTER TABLE llx_mjlfinancement_access_audit ADD INDEX idx_mjlfinancement_access_audit_fk_user (fk_user)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_access_audit' AND INDEX_NAME = 'idx_mjlfinancement_access_audit_event') = 0, 'ALTER TABLE llx_mjlfinancement_access_audit ADD INDEX idx_mjlfinancement_access_audit_event (event)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;
