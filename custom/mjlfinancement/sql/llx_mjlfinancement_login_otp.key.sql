ALTER TABLE llx_mjlfinancement_login_otp ADD UNIQUE INDEX uk_mjl_login_otp_live_user (entity, live_user_id);
ALTER TABLE llx_mjlfinancement_login_otp ADD INDEX idx_mjl_login_otp_user (entity, fk_user, status);
ALTER TABLE llx_mjlfinancement_login_otp ADD INDEX idx_mjl_login_otp_lockout (entity, fk_user, date_lockout_until);
ALTER TABLE llx_mjlfinancement_login_otp ADD CONSTRAINT fk_mjl_login_otp_user FOREIGN KEY (fk_user) REFERENCES llx_user(rowid);
