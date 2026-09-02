CREATE TABLE llx_mjlfinancement_activity_reference_sequence (
	entity INT(11) NOT NULL PRIMARY KEY,
	next_value BIGINT(20) NOT NULL,
	date_creation DATETIME NOT NULL,
	tms TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT chk_mjl_activity_sequence_entity CHECK (entity > 0),
	CONSTRAINT chk_mjl_activity_sequence_next CHECK (next_value > 0)
) ENGINE=innodb DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
