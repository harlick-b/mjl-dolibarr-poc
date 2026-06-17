-- MJL Financement 0.5.0 activity status separation.
-- Keep legacy sample lifecycle statuses:
--   1 = ongoing, 2 = completed
-- Remap only rows with explicit activity workflow evidence from the 0.4.0 demo.

UPDATE llx_mjlfinancement_activity a
SET a.status = 3
WHERE a.status = 1
AND (
	SELECT w.to_status
	FROM llx_mjlfinancement_workflow_action w
	WHERE w.entity = a.entity
	AND w.object_type = 'mjlfinancement_activity'
	AND w.object_id = a.rowid
	ORDER BY w.action_date DESC, w.rowid DESC
	LIMIT 1
) = 'submitted';

UPDATE llx_mjlfinancement_activity a
SET a.status = 6
WHERE a.status = 2
AND (
	SELECT w.to_status
	FROM llx_mjlfinancement_workflow_action w
	WHERE w.entity = a.entity
	AND w.object_type = 'mjlfinancement_activity'
	AND w.object_id = a.rowid
	ORDER BY w.action_date DESC, w.rowid DESC
	LIMIT 1
) = 'validated';
