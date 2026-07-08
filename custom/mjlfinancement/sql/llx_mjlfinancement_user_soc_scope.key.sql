ALTER TABLE llx_mjlfinancement_user_soc_scope ADD INDEX idx_mjlfinancement_user_soc_scope_entity (entity);
ALTER TABLE llx_mjlfinancement_user_soc_scope ADD INDEX idx_mjlfinancement_user_soc_scope_fk_user (fk_user);
ALTER TABLE llx_mjlfinancement_user_soc_scope ADD INDEX idx_mjlfinancement_user_soc_scope_fk_soc (fk_soc);
ALTER TABLE llx_mjlfinancement_user_soc_scope ADD INDEX idx_mjlfinancement_user_soc_scope_active (entity, fk_user, is_active);
ALTER TABLE llx_mjlfinancement_user_soc_scope ADD CONSTRAINT fk_mjlfinancement_user_soc_scope_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid);
ALTER TABLE llx_mjlfinancement_user_soc_scope ADD CONSTRAINT fk_mjlfinancement_user_soc_scope_soc FOREIGN KEY (fk_soc) REFERENCES llx_societe(rowid);
