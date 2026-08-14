ALTER TABLE llx_mjlfinancement_password_reset ADD UNIQUE INDEX uk_mjl_reset_selector (entity, token_selector);
ALTER TABLE llx_mjlfinancement_password_reset ADD UNIQUE INDEX uk_mjl_reset_hash (entity, token_hash);
ALTER TABLE llx_mjlfinancement_password_reset ADD UNIQUE INDEX uk_mjl_reset_live_user (entity, live_user_id);
ALTER TABLE llx_mjlfinancement_password_reset ADD INDEX idx_mjl_reset_user (entity, fk_user);
ALTER TABLE llx_mjlfinancement_password_reset ADD INDEX idx_mjl_reset_status (entity, status);
ALTER TABLE llx_mjlfinancement_password_reset ADD CONSTRAINT fk_mjl_reset_target_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid);
