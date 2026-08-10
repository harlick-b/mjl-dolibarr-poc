ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_entity (entity);
ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_fk_user (fk_user);
ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_active (entity, fk_user, is_active);
ALTER TABLE llx_mjlfinancement_user_role ADD INDEX idx_mjlfinancement_user_role_code (role_code);
ALTER TABLE llx_mjlfinancement_user_role ADD COLUMN IF NOT EXISTS active_user_id INTEGER AS (CASE WHEN is_active = 1 THEN fk_user ELSE NULL END) PERSISTENT;
ALTER TABLE llx_mjlfinancement_user_role DROP INDEX IF EXISTS uk_mjlfinancement_user_role_active_user;
ALTER TABLE llx_mjlfinancement_user_role ADD UNIQUE INDEX uk_mjlfinancement_user_role_active_user (active_user_id);
ALTER TABLE llx_mjlfinancement_user_role ADD CONSTRAINT fk_mjlfinancement_user_role_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid);
