ALTER TABLE llx_mjlfinancement_operation_type ADD CONSTRAINT IF NOT EXISTS chk_mjlfinancement_operation_type_active CHECK (is_active IN (0, 1));
