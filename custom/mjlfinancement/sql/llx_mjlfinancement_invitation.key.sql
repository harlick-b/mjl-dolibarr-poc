ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjlfinancement_invitation_entity (entity);
ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjlfinancement_invitation_fk_user (fk_user);
ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjlfinancement_invitation_status (status);
ALTER TABLE llx_mjlfinancement_invitation ADD INDEX idx_mjlfinancement_invitation_token_hash (token_hash);
ALTER TABLE llx_mjlfinancement_invitation ADD CONSTRAINT fk_mjlfinancement_invitation_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid);
