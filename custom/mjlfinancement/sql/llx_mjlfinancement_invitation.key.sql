ALTER TABLE llx_mjlfinancement_invitation ADD UNIQUE INDEX uk_mjl_invitation_selector (entity, token_selector);
ALTER TABLE llx_mjlfinancement_invitation ADD UNIQUE INDEX uk_mjl_invitation_hash (entity, token_hash);
ALTER TABLE llx_mjlfinancement_invitation ADD UNIQUE INDEX uk_mjl_invitation_live_user (entity, live_user_id);
ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjl_invitation_user (entity, fk_user);
ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjl_invitation_status (entity, status);
ALTER TABLE llx_mjlfinancement_invitation ADD CONSTRAINT fk_mjl_invitation_target_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid);
