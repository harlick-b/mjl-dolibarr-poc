CREATE TABLE llx_mjlfinancement_revision_contributor (
	rowid BIGINT(20) AUTO_INCREMENT PRIMARY KEY,
	entity INT(11) NOT NULL,
	fk_activity INT(11) NOT NULL,
	fk_revision BIGINT(20) NOT NULL,
	fk_user INT(11) NOT NULL,
	user_name_snapshot VARCHAR(255) NOT NULL,
	role_snapshot VARCHAR(40) NOT NULL,
	date_creation DATETIME NOT NULL,
	UNIQUE INDEX uk_mjl_revision_contributor (entity,fk_revision,fk_user),
	INDEX idx_mjl_contributor_activity (entity,fk_activity),
	CONSTRAINT chk_mjl_contributor_entity CHECK (entity > 0)
) ENGINE=innodb DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
