-- Phase 7R guard: fund receipts attached to global partner/programme envelopes
-- must be able to keep fk_project NULL.
ALTER TABLE llx_mjlfinancement_fund_receipt
	MODIFY fk_project INTEGER DEFAULT NULL;
