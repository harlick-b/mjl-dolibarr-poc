ALTER TABLE llx_mjlfinancement_exchange_log ADD UNIQUE INDEX uk_mjlfinancement_exchange_log_ref_entity (ref, entity);
ALTER TABLE llx_mjlfinancement_exchange_log ADD INDEX idx_mjlfinancement_exchange_log_entity (entity);
ALTER TABLE llx_mjlfinancement_exchange_log ADD INDEX idx_mjlfinancement_exchange_log_object (object_type, object_id);
ALTER TABLE llx_mjlfinancement_exchange_log ADD INDEX idx_mjlfinancement_exchange_log_actor (actor);
ALTER TABLE llx_mjlfinancement_exchange_log ADD INDEX idx_mjlfinancement_exchange_log_exchange_date (exchange_date);
ALTER TABLE llx_mjlfinancement_exchange_log ADD CONSTRAINT fk_mjlfinancement_exchange_log_actor FOREIGN KEY (actor) REFERENCES llx_user(rowid);
