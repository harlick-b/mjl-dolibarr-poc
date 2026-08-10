CREATE TABLE IF NOT EXISTS llx_mjlfinancement_user_role (
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
) ENGINE=innodb;

CREATE TABLE IF NOT EXISTS llx_mjlfinancement_user_soc_scope (
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
) ENGINE=innodb;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_role' AND INDEX_NAME = 'idx_mjlfinancement_user_role_entity') = 0, 'ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_role' AND INDEX_NAME = 'idx_mjlfinancement_user_role_fk_user') = 0, 'ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_fk_user (fk_user)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_role' AND INDEX_NAME = 'idx_mjlfinancement_user_role_active') = 0, 'ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_active (entity, fk_user, is_active)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_role' AND INDEX_NAME = 'idx_mjlfinancement_user_role_code') = 0, 'ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_code (role_code)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_soc_scope' AND INDEX_NAME = 'idx_mjlfinancement_user_soc_scope_entity') = 0, 'ALTER TABLE llx_mjlfinancement_user_soc_scope ADD INDEX idx_mjlfinancement_user_soc_scope_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_soc_scope' AND INDEX_NAME = 'idx_mjlfinancement_user_soc_scope_fk_user') = 0, 'ALTER TABLE llx_mjlfinancement_user_soc_scope ADD INDEX idx_mjlfinancement_user_soc_scope_fk_user (fk_user)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_soc_scope' AND INDEX_NAME = 'idx_mjlfinancement_user_soc_scope_fk_soc') = 0, 'ALTER TABLE llx_mjlfinancement_user_soc_scope ADD INDEX idx_mjlfinancement_user_soc_scope_fk_soc (fk_soc)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_soc_scope' AND INDEX_NAME = 'idx_mjlfinancement_user_soc_scope_active') = 0, 'ALTER TABLE llx_mjlfinancement_user_soc_scope ADD INDEX idx_mjlfinancement_user_soc_scope_active (entity, fk_user, is_active)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_role' AND CONSTRAINT_NAME = 'fk_mjlfinancement_user_role_user' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0 AND (SELECT COUNT(*) FROM llx_mjlfinancement_user_role r LEFT JOIN llx_user u ON u.rowid = r.fk_user WHERE u.rowid IS NULL) = 0, 'ALTER TABLE llx_mjlfinancement_user_role ADD CONSTRAINT fk_mjlfinancement_user_role_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_soc_scope' AND CONSTRAINT_NAME = 'fk_mjlfinancement_user_soc_scope_user' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0 AND (SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope s LEFT JOIN llx_user u ON u.rowid = s.fk_user WHERE u.rowid IS NULL) = 0, 'ALTER TABLE llx_mjlfinancement_user_soc_scope ADD CONSTRAINT fk_mjlfinancement_user_soc_scope_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_user_soc_scope' AND CONSTRAINT_NAME = 'fk_mjlfinancement_user_soc_scope_soc' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0 AND (SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope s LEFT JOIN llx_societe so ON so.rowid = s.fk_soc WHERE so.rowid IS NULL) = 0, 'ALTER TABLE llx_mjlfinancement_user_soc_scope ADD CONSTRAINT fk_mjlfinancement_user_soc_scope_soc FOREIGN KEY (fk_soc) REFERENCES llx_societe(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;
