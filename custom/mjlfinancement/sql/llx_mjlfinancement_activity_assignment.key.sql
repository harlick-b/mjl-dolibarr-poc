ALTER TABLE llx_mjlfinancement_activity_assignment ADD UNIQUE INDEX uk_mjl_activity_assignment_current_user (entity, fk_activity, current_user_id);
ALTER TABLE llx_mjlfinancement_activity_assignment ADD UNIQUE INDEX uk_mjl_activity_assignment_current_primary (entity, current_primary_activity_id);
ALTER TABLE llx_mjlfinancement_activity_assignment ADD INDEX idx_mjl_activity_assignment_current_activity (entity, fk_activity, date_end);
ALTER TABLE llx_mjlfinancement_activity_assignment ADD INDEX idx_mjl_activity_assignment_current_agent (entity, fk_user, date_end);
ALTER TABLE llx_mjlfinancement_activity_assignment ADD INDEX idx_mjl_activity_assignment_activity_fk (fk_activity);
ALTER TABLE llx_mjlfinancement_activity_assignment ADD INDEX idx_mjl_activity_assignment_agent_fk (fk_user);
ALTER TABLE llx_mjlfinancement_activity_assignment ADD INDEX idx_mjl_activity_assignment_assigner (fk_user_assign);
ALTER TABLE llx_mjlfinancement_activity_assignment ADD CONSTRAINT fk_mjl_activity_assignment_activity FOREIGN KEY (fk_activity) REFERENCES llx_mjlfinancement_activity(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_activity_assignment ADD CONSTRAINT fk_mjl_activity_assignment_agent FOREIGN KEY (fk_user) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE llx_mjlfinancement_activity_assignment ADD CONSTRAINT fk_mjl_activity_assignment_assigner FOREIGN KEY (fk_user_assign) REFERENCES llx_user(rowid) ON UPDATE RESTRICT ON DELETE RESTRICT;
-- llx_mjl_activity_assignment_bi, llx_mjl_activity_assignment_bu, and llx_mjl_activity_assignment_bd are installed as driver statements by activity_schema_installer.lib.php.
