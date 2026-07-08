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

INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT u.entity, u.rowid, 'ADMIN_PLATEFORME', 1, NOW(), 'legacy_poc_group', 'Backfill 0.8.0 from Dolibarr admin flag or MJL POC Administrateur group.', NOW(), NULL, 'MJL080BACK'
FROM llx_user u
LEFT JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity IN (0, u.entity)
LEFT JOIN llx_usergroup ug ON ug.rowid = ugu.fk_usergroup AND ug.entity = u.entity
WHERE (u.admin = 1 OR ug.nom = 'MJL POC - Administrateur')
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_role r WHERE r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1);

INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT u.entity, u.rowid, 'AGENT_SAISIE', 1, NOW(), 'legacy_poc_group', 'Backfill 0.8.0 from MJL POC Agent group.', NOW(), NULL, 'MJL080BACK'
FROM llx_user u
INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity IN (0, u.entity)
INNER JOIN llx_usergroup ug ON ug.rowid = ugu.fk_usergroup AND ug.entity = u.entity
WHERE ug.nom = 'MJL POC - Agent'
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_role r WHERE r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1);

INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT u.entity, u.rowid, 'AGENT_VERIFICATEUR', 1, NOW(), 'legacy_poc_group', 'Backfill 0.8.0 from MJL POC Superviseur group.', NOW(), NULL, 'MJL080BACK'
FROM llx_user u
INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity IN (0, u.entity)
INNER JOIN llx_usergroup ug ON ug.rowid = ugu.fk_usergroup AND ug.entity = u.entity
WHERE ug.nom IN ('MJL POC - Superviseur N1', 'MJL POC - Superviseur N2')
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_role r WHERE r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1);

INSERT INTO llx_mjlfinancement_user_role (entity, fk_user, role_code, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT u.entity, u.rowid, 'VALIDATEUR_DEFINITIF', 1, NOW(), 'legacy_poc_group', 'Backfill 0.8.0 from MJL POC DPAF group.', NOW(), NULL, 'MJL080BACK'
FROM llx_user u
INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity IN (0, u.entity)
INNER JOIN llx_usergroup ug ON ug.rowid = ugu.fk_usergroup AND ug.entity = u.entity
WHERE ug.nom = 'MJL POC - DPAF'
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_role r WHERE r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT a.entity, a.fk_user_creat, c.fk_soc, 1, NOW(), 'created_activity', 'Backfill 0.8.0 from activities created by the user.', NOW(), NULL, 'MJL080BACK'
FROM llx_mjlfinancement_activity a
INNER JOIN llx_mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity
WHERE a.fk_user_creat IS NOT NULL AND c.fk_soc IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = a.entity AND s.fk_user = a.fk_user_creat AND s.fk_soc = c.fk_soc AND s.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT e.entity, e.fk_user_creat, c.fk_soc, 1, NOW(), 'created_expense', 'Backfill 0.8.0 from expenses created by the user.', NOW(), NULL, 'MJL080BACK'
FROM llx_mjlfinancement_expense e
INNER JOIN llx_mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity
WHERE e.fk_user_creat IS NOT NULL AND c.fk_soc IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = e.entity AND s.fk_user = e.fk_user_creat AND s.fk_soc = c.fk_soc AND s.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT v.entity, v.fk_user_action, c.fk_soc, 1, NOW(), 'validation_history', 'Backfill 0.8.0 from validation history.', NOW(), NULL, 'MJL080BACK'
FROM llx_mjlfinancement_validation v
INNER JOIN llx_mjlfinancement_expense e ON e.rowid = v.fk_expense AND e.entity = v.entity
INNER JOIN llx_mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity
WHERE v.fk_user_action IS NOT NULL AND c.fk_soc IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = v.entity AND s.fk_user = v.fk_user_action AND s.fk_soc = c.fk_soc AND s.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT w.entity, w.actor, c.fk_soc, 1, NOW(), 'workflow_history', 'Backfill 0.8.0 from workflow history on convention-backed objects.', NOW(), NULL, 'MJL080BACK'
FROM llx_mjlfinancement_workflow_action w
INNER JOIN llx_mjlfinancement_expense e ON e.rowid = w.object_id AND e.entity = w.entity AND w.object_type = 'mjlfinancement_expense'
INNER JOIN llx_mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity
WHERE w.actor IS NOT NULL AND c.fk_soc IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = w.entity AND s.fk_user = w.actor AND s.fk_soc = c.fk_soc AND s.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT w.entity, w.actor, c.fk_soc, 1, NOW(), 'workflow_history', 'Backfill 0.8.0 from workflow history on activities.', NOW(), NULL, 'MJL080BACK'
FROM llx_mjlfinancement_workflow_action w
INNER JOIN llx_mjlfinancement_activity a ON a.rowid = w.object_id AND a.entity = w.entity AND w.object_type = 'mjlfinancement_activity'
INNER JOIN llx_mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity
WHERE w.actor IS NOT NULL AND c.fk_soc IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = w.entity AND s.fk_user = w.actor AND s.fk_soc = c.fk_soc AND s.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT w.entity, w.actor, c.fk_soc, 1, NOW(), 'workflow_history', 'Backfill 0.8.0 from workflow history on conventions.', NOW(), NULL, 'MJL080BACK'
FROM llx_mjlfinancement_workflow_action w
INNER JOIN llx_mjlfinancement_convention c ON c.rowid = w.object_id AND c.entity = w.entity AND w.object_type = 'mjlfinancement_convention'
WHERE w.actor IS NOT NULL AND c.fk_soc IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = w.entity AND s.fk_user = w.actor AND s.fk_soc = c.fk_soc AND s.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT w.entity, w.actor, c.fk_soc, 1, NOW(), 'workflow_history', 'Backfill 0.8.0 from workflow history on budget lines.', NOW(), NULL, 'MJL080BACK'
FROM llx_mjlfinancement_workflow_action w
INNER JOIN llx_mjlfinancement_budget_line b ON b.rowid = w.object_id AND b.entity = w.entity AND w.object_type = 'mjlfinancement_budget_line'
INNER JOIN llx_mjlfinancement_convention c ON c.rowid = b.fk_convention AND c.entity = b.entity
WHERE w.actor IS NOT NULL AND c.fk_soc IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = w.entity AND s.fk_user = w.actor AND s.fk_soc = c.fk_soc AND s.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT w.entity, w.actor, fr.fk_soc, 1, NOW(), 'workflow_history', 'Backfill 0.8.0 from workflow history on fund receipts.', NOW(), NULL, 'MJL080BACK'
FROM llx_mjlfinancement_workflow_action w
INNER JOIN llx_mjlfinancement_fund_receipt fr ON fr.rowid = w.object_id AND fr.entity = w.entity AND w.object_type = 'mjlfinancement_fund_receipt'
WHERE w.actor IS NOT NULL AND fr.fk_soc IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = w.entity AND s.fk_user = w.actor AND s.fk_soc = fr.fk_soc AND s.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT u.entity, u.rowid, so.rowid, 1, NOW(), 'legacy_poc_portfolio', 'Backfill 0.8.0 explicit all-current-entity scope for known seeded DPAF portfolio user.', NOW(), NULL, 'MJL080BACK'
FROM llx_user u
INNER JOIN llx_usergroup_user ugu ON ugu.fk_user = u.rowid AND ugu.entity IN (0, u.entity)
INNER JOIN llx_usergroup ug ON ug.rowid = ugu.fk_usergroup AND ug.entity = u.entity AND ug.nom = 'MJL POC - DPAF'
INNER JOIN llx_societe so ON so.entity = u.entity
WHERE u.login = 'dpaf.mjl'
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = u.entity AND s.fk_user = u.rowid AND s.fk_soc = so.rowid AND s.is_active = 1);

INSERT INTO llx_mjlfinancement_user_soc_scope (entity, fk_user, fk_soc, is_active, date_start, source, note, date_creation, fk_user_creat, import_key)
SELECT DISTINCT u.entity, u.rowid, so.rowid, 1, NOW(), 'legacy_seed_scope', 'Backfill 0.8.0 explicit scope for known seeded POC users and seeded partners.', NOW(), NULL, 'MJL080BACK'
FROM llx_user u
INNER JOIN llx_mjlfinancement_user_role r ON r.entity = u.entity AND r.fk_user = u.rowid AND r.is_active = 1
INNER JOIN llx_societe so ON so.entity = u.entity AND so.nom IN ('UNICEF', 'Programme Redevabilité')
WHERE u.login IN ('agent.mjl', 'superviseur.n1', 'superviseur.n2')
AND NOT EXISTS (SELECT 1 FROM llx_mjlfinancement_user_soc_scope s WHERE s.entity = u.entity AND s.fk_user = u.rowid AND s.fk_soc = so.rowid AND s.is_active = 1);
