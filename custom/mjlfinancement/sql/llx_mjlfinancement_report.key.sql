ALTER TABLE llx_mjlfinancement_report ADD UNIQUE INDEX uk_mjlfinancement_report_ref_entity (ref, entity);
ALTER TABLE llx_mjlfinancement_report ADD INDEX idx_mjlfinancement_report_entity (entity);
