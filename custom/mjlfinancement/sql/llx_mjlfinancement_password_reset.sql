CREATE TABLE llx_mjlfinancement_password_reset (
	rowid INTEGER AUTO_INCREMENT PRIMARY KEY,
	entity INTEGER DEFAULT 1 NOT NULL,
	fk_user INTEGER NOT NULL,
	status VARCHAR(32) DEFAULT 'pending_send' NOT NULL,
	token_selector VARCHAR(64) NOT NULL,
	token_hash CHAR(64) DEFAULT NULL,
	live_user_id INTEGER AS (CASE WHEN status IN ('pending_send', 'sent') THEN fk_user ELSE NULL END) PERSISTENT,
	date_expiry DATETIME NOT NULL,
	date_consumed DATETIME DEFAULT NULL,
	date_creation DATETIME NOT NULL,
	tms TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	fk_user_creat INTEGER NOT NULL,
	fk_user_modif INTEGER DEFAULT NULL,
	CONSTRAINT chk_mjl_reset_status CHECK (status IN ('pending_send', 'sent', 'consumed', 'send_failed', 'revoked')),
	CONSTRAINT chk_mjl_reset_credential_state CHECK ((status IN ('pending_send', 'sent') AND token_hash IS NOT NULL AND date_consumed IS NULL) OR (status IN ('consumed', 'send_failed', 'revoked') AND token_hash IS NULL AND date_consumed IS NOT NULL))
) ENGINE=innodb;
