ALTER TABLE llx_mjlfinancement_operation ADD CONSTRAINT fk_mjl_operation_activity FOREIGN KEY (fk_activity) REFERENCES llx_mjlfinancement_activity(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_operation ADD CONSTRAINT fk_mjl_operation_type FOREIGN KEY (fk_operation_type) REFERENCES llx_mjlfinancement_operation_type(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_operation ADD CONSTRAINT fk_mjl_operation_creator FOREIGN KEY (fk_user_creat) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_operation ADD CONSTRAINT fk_mjl_operation_modifier FOREIGN KEY (fk_user_modif) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_operation ADD CONSTRAINT fk_mjl_operation_remover FOREIGN KEY (fk_user_removed) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
