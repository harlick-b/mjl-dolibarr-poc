CREATE TABLE IF NOT EXISTS llx_mjlfinancement_operation_type (
	rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
	entity INTEGER DEFAULT 1 NOT NULL,
	label VARCHAR(255) NOT NULL,
	is_active TINYINT DEFAULT 1 NOT NULL,
	date_creation DATETIME NOT NULL,
	tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	fk_user_creat INTEGER NOT NULL,
	fk_user_modif INTEGER DEFAULT NULL,
	INDEX idx_mjlfinancement_operation_type_entity (entity),
	INDEX idx_mjlfinancement_operation_type_active (entity, is_active),
	UNIQUE INDEX uk_mjlfinancement_operation_type_label_entity (entity, label),
	CONSTRAINT fk_mjlfinancement_operation_type_user_creat FOREIGN KEY (fk_user_creat) REFERENCES llx_user(rowid),
	CONSTRAINT fk_mjlfinancement_operation_type_user_modif FOREIGN KEY (fk_user_modif) REFERENCES llx_user(rowid),
	CONSTRAINT chk_mjlfinancement_operation_type_active CHECK (is_active IN (0, 1))
) ENGINE=innodb;
