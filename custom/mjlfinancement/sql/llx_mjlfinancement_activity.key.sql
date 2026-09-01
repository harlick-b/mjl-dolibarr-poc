ALTER TABLE llx_mjlfinancement_activity ADD UNIQUE INDEX uk_mjl_activity_entity_ref (entity, ref);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjl_activity_entity_project (entity, fk_project);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjl_activity_entity_partner (entity, fk_partner);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjl_activity_entity_validation (entity, validation_status);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjl_activity_project_fk (fk_project);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjl_activity_partner_fk (fk_partner);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjl_activity_creator (fk_user_creat);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjl_activity_modifier (fk_user_modif);
ALTER TABLE llx_mjlfinancement_activity ADD CONSTRAINT fk_mjl_activity_target_partner FOREIGN KEY (fk_partner) REFERENCES llx_societe(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_activity ADD CONSTRAINT fk_mjl_activity_target_project FOREIGN KEY (fk_project) REFERENCES llx_projet(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_activity ADD CONSTRAINT fk_mjl_activity_target_creator FOREIGN KEY (fk_user_creat) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_activity ADD CONSTRAINT fk_mjl_activity_target_modifier FOREIGN KEY (fk_user_modif) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
-- llx_mjl_activity_rst005_bi and llx_mjl_activity_rst002b_bu are installed as driver statements by activity_schema_installer.lib.php.
CREATE TRIGGER llx_mjl_activity_rst005_bd BEFORE DELETE ON llx_mjlfinancement_activity FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity deletion is dormant in RST-005';
