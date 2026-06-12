ALTER TABLE llx_mjlfinancement_convention ADD UNIQUE INDEX uk_mjlfinancement_convention_ref_entity (ref, entity);
ALTER TABLE llx_mjlfinancement_convention ADD INDEX idx_mjlfinancement_convention_entity (entity);
ALTER TABLE llx_mjlfinancement_convention ADD INDEX idx_mjlfinancement_convention_fk_soc (fk_soc);
ALTER TABLE llx_mjlfinancement_convention ADD INDEX idx_mjlfinancement_convention_fk_project (fk_project);
ALTER TABLE llx_mjlfinancement_convention ADD CONSTRAINT fk_mjlfinancement_convention_soc FOREIGN KEY (fk_soc) REFERENCES llx_societe(rowid);
ALTER TABLE llx_mjlfinancement_convention ADD CONSTRAINT fk_mjlfinancement_convention_project FOREIGN KEY (fk_project) REFERENCES llx_projet(rowid);
