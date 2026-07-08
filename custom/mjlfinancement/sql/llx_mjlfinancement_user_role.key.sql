ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_entity (entity);
ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_fk_user (fk_user);
ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_active (entity, fk_user, is_active);
ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_code (role_code);
ALTER TABLE llx_mjlfinancement_user_role ADD CONSTRAINT fk_mjlfinancement_user_role_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid);
