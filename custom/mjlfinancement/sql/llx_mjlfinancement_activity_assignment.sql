CREATE TABLE llx_mjlfinancement_activity_assignment (
	rowid BIGINT(20) AUTO_INCREMENT PRIMARY KEY,
	entity INT(11) NOT NULL,
	fk_activity INT(11) NOT NULL,
	fk_user INT(11) NOT NULL,
	is_primary TINYINT(1) DEFAULT 0 NOT NULL,
	date_start DATETIME NOT NULL,
	date_end DATETIME DEFAULT NULL,
	fk_user_assign INT(11) DEFAULT NULL,
	reason TEXT NOT NULL,
	date_creation DATETIME NOT NULL,
	tms TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	current_user_id BIGINT(20) AS (CASE WHEN date_end IS NULL THEN fk_user ELSE NULL END) PERSISTENT,
	current_primary_activity_id BIGINT(20) AS (CASE WHEN date_end IS NULL AND is_primary = 1 THEN fk_activity ELSE NULL END) PERSISTENT,
	CONSTRAINT chk_mjl_activity_assignment_entity_positive CHECK (entity > 0),
	CONSTRAINT chk_mjl_activity_assignment_primary CHECK (is_primary IN (0, 1)),
	CONSTRAINT chk_mjl_activity_assignment_reason_nonblank CHECK (reason REGEXP '[^[:space:]]'),
	CONSTRAINT chk_mjl_activity_assignment_dates CHECK (date_end IS NULL OR date_end >= date_start)
) ENGINE=innodb DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
