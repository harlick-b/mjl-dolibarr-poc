ALTER TABLE llx_mjlfinancement_activity_revision ADD CONSTRAINT fk_mjl_revision_activity FOREIGN KEY (fk_activity) REFERENCES llx_mjlfinancement_activity(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_activity_revision ADD CONSTRAINT fk_mjl_revision_submitter FOREIGN KEY (fk_submitter) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
