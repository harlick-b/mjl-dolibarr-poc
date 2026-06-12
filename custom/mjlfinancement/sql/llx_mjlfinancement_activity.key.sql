ALTER TABLE llx_mjlfinancement_activity ADD UNIQUE INDEX uk_mjlfinancement_activity_ref_entity (ref, entity);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjlfinancement_activity_entity (entity);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjlfinancement_activity_fk_project (fk_project);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjlfinancement_activity_fk_convention (fk_convention);
ALTER TABLE llx_mjlfinancement_activity ADD INDEX idx_mjlfinancement_activity_fk_task (fk_task);
ALTER TABLE llx_mjlfinancement_activity ADD CONSTRAINT fk_mjlfinancement_activity_project FOREIGN KEY (fk_project) REFERENCES llx_projet(rowid);
ALTER TABLE llx_mjlfinancement_activity ADD CONSTRAINT fk_mjlfinancement_activity_convention FOREIGN KEY (fk_convention) REFERENCES llx_mjlfinancement_convention(rowid);
ALTER TABLE llx_mjlfinancement_activity ADD CONSTRAINT fk_mjlfinancement_activity_task FOREIGN KEY (fk_task) REFERENCES llx_projet_task(rowid);
