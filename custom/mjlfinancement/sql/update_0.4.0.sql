-- MJL Financement 0.4.0 generic workflow audit and exchange-log foundation.

CREATE TABLE IF NOT EXISTS llx_mjlfinancement_workflow_action (
	rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
	entity INTEGER DEFAULT 1 NOT NULL,
	ref VARCHAR(128) NOT NULL,
	object_type VARCHAR(64) NOT NULL,
	object_id INTEGER NOT NULL,
	action VARCHAR(64) NOT NULL,
	from_status VARCHAR(32) DEFAULT NULL,
	to_status VARCHAR(32) DEFAULT NULL,
	actor INTEGER NOT NULL,
	actor_role VARCHAR(64) NOT NULL,
	action_date DATETIME NOT NULL,
	reason TEXT,
	comment TEXT,
	changes_json TEXT NOT NULL,
	date_creation DATETIME NOT NULL,
	tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	fk_user_creat INTEGER NOT NULL,
	fk_user_modif INTEGER DEFAULT NULL,
	import_key VARCHAR(14)
) ENGINE=innodb;

CREATE TABLE IF NOT EXISTS llx_mjlfinancement_exchange_log (
	rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
	entity INTEGER DEFAULT 1 NOT NULL,
	ref VARCHAR(128) NOT NULL,
	object_type VARCHAR(64) NOT NULL,
	object_id INTEGER NOT NULL,
	exchange_date DATETIME NOT NULL,
	actor INTEGER NOT NULL,
	actor_role VARCHAR(64) NOT NULL,
	channel VARCHAR(64) DEFAULT NULL,
	subject VARCHAR(255) DEFAULT NULL,
	message TEXT NOT NULL,
	date_creation DATETIME NOT NULL,
	tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	fk_user_creat INTEGER NOT NULL,
	fk_user_modif INTEGER DEFAULT NULL,
	import_key VARCHAR(14)
) ENGINE=innodb;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_workflow_action' AND INDEX_NAME = 'uk_mjlfinancement_workflow_action_ref_entity') = 0, 'ALTER TABLE llx_mjlfinancement_workflow_action ADD UNIQUE INDEX uk_mjlfinancement_workflow_action_ref_entity (ref, entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_workflow_action' AND INDEX_NAME = 'idx_mjlfinancement_workflow_action_entity') = 0, 'ALTER TABLE llx_mjlfinancement_workflow_action ADD INDEX idx_mjlfinancement_workflow_action_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_workflow_action' AND INDEX_NAME = 'idx_mjlfinancement_workflow_action_object') = 0, 'ALTER TABLE llx_mjlfinancement_workflow_action ADD INDEX idx_mjlfinancement_workflow_action_object (object_type, object_id)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_workflow_action' AND INDEX_NAME = 'idx_mjlfinancement_workflow_action_actor') = 0, 'ALTER TABLE llx_mjlfinancement_workflow_action ADD INDEX idx_mjlfinancement_workflow_action_actor (actor)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_workflow_action' AND INDEX_NAME = 'idx_mjlfinancement_workflow_action_action_date') = 0, 'ALTER TABLE llx_mjlfinancement_workflow_action ADD INDEX idx_mjlfinancement_workflow_action_action_date (action_date)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_workflow_action' AND CONSTRAINT_NAME = 'fk_mjlfinancement_workflow_action_actor' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_workflow_action ADD CONSTRAINT fk_mjlfinancement_workflow_action_actor FOREIGN KEY (actor) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_exchange_log' AND INDEX_NAME = 'uk_mjlfinancement_exchange_log_ref_entity') = 0, 'ALTER TABLE llx_mjlfinancement_exchange_log ADD UNIQUE INDEX uk_mjlfinancement_exchange_log_ref_entity (ref, entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_exchange_log' AND INDEX_NAME = 'idx_mjlfinancement_exchange_log_entity') = 0, 'ALTER TABLE llx_mjlfinancement_exchange_log ADD INDEX idx_mjlfinancement_exchange_log_entity (entity)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_exchange_log' AND INDEX_NAME = 'idx_mjlfinancement_exchange_log_object') = 0, 'ALTER TABLE llx_mjlfinancement_exchange_log ADD INDEX idx_mjlfinancement_exchange_log_object (object_type, object_id)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_exchange_log' AND INDEX_NAME = 'idx_mjlfinancement_exchange_log_actor') = 0, 'ALTER TABLE llx_mjlfinancement_exchange_log ADD INDEX idx_mjlfinancement_exchange_log_actor (actor)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_exchange_log' AND INDEX_NAME = 'idx_mjlfinancement_exchange_log_exchange_date') = 0, 'ALTER TABLE llx_mjlfinancement_exchange_log ADD INDEX idx_mjlfinancement_exchange_log_exchange_date (exchange_date)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;

SET @mjl_sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llx_mjlfinancement_exchange_log' AND CONSTRAINT_NAME = 'fk_mjlfinancement_exchange_log_actor' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0, 'ALTER TABLE llx_mjlfinancement_exchange_log ADD CONSTRAINT fk_mjlfinancement_exchange_log_actor FOREIGN KEY (actor) REFERENCES llx_user(rowid)', 'DO 0');
PREPARE mjl_stmt FROM @mjl_sql;
EXECUTE mjl_stmt;
DEALLOCATE PREPARE mjl_stmt;
