ALTER TABLE llx_mjlfinancement_operation_type ADD INDEX idx_mjlfinancement_operation_type_entity (entity);
ALTER TABLE llx_mjlfinancement_operation_type ADD INDEX idx_mjlfinancement_operation_type_active (entity, is_active);
ALTER TABLE llx_mjlfinancement_operation_type ADD UNIQUE INDEX uk_mjlfinancement_operation_type_label_entity (entity, label);
ALTER TABLE llx_mjlfinancement_operation_type ADD CONSTRAINT fk_mjlfinancement_operation_type_user_creat FOREIGN KEY (fk_user_creat) REFERENCES llx_user(rowid);
ALTER TABLE llx_mjlfinancement_operation_type ADD CONSTRAINT fk_mjlfinancement_operation_type_user_modif FOREIGN KEY (fk_user_modif) REFERENCES llx_user(rowid);
ALTER TABLE llx_mjlfinancement_operation_type ADD CONSTRAINT chk_mjlfinancement_operation_type_active CHECK (is_active IN (0, 1));
