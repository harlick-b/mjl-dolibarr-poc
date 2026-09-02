<?php

require_once __DIR__.'/activity_schema_installer.lib.php';

if (!defined('RST006A_SCHEMA_TARGET')) define('RST006A_SCHEMA_TARGET', 'rst006a_target');
if (!defined('RST006A_SCHEMA_PREDECESSOR')) define('RST006A_SCHEMA_PREDECESSOR', 'rst002b_target');
if (!defined('RST006A_SCHEMA_PARTIAL')) define('RST006A_SCHEMA_PARTIAL', 'rst006a_partial');
if (!defined('RST006A_SCHEMA_UNKNOWN')) define('RST006A_SCHEMA_UNKNOWN', 'unknown');

function mjl_rst006a_suffixes()
{
	return array('activity_reference_sequence','operation','activity_revision','revision_contributor','review_decision');
}

function mjl_rst006a_table(DoliDB $db, $suffix)
{
	if (!in_array($suffix, mjl_rst006a_suffixes(), true)) throw new InvalidArgumentException('Unknown RST-006A table.');
	return $db->prefix().'mjlfinancement_'.$suffix;
}

function mjl_rst006a_columns(DoliDB $db, $table)
{
	$columns = array();
	$res = $db->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY ORDINAL_POSITION");
	if (!$res) throw new RuntimeException('Unable to inspect RST-006A columns.');
	while ($row = $db->fetch_object($res)) $columns[] = (string) $row->COLUMN_NAME;
	return $columns;
}

function mjl_rst006a_is_known_prefix(DoliDB $db)
{
	$expectedColumns = array(
		'activity_reference_sequence'=>array('entity','next_value','date_creation','tms'),
		'operation'=>array('rowid','entity','fk_activity','fk_operation_type','name','authorized_amount','status','spent_amount','observation','version','date_removed','fk_user_removed','date_creation','tms','fk_user_creat','fk_user_modif'),
		'activity_revision'=>array('rowid','entity','fk_activity','revision_number','activity_version','schema_version','snapshot_json','structural_hash','integrity_hash','proposed_amount','fk_submitter','submitter_name_snapshot','submitter_role_snapshot','date_submitted'),
		'revision_contributor'=>array('rowid','entity','fk_activity','fk_revision','fk_user','user_name_snapshot','role_snapshot','date_creation'),
		'review_decision'=>array('rowid','entity','fk_activity','fk_revision','stage','decision_type','fk_actor','actor_name_snapshot','actor_role_snapshot','reason','requested_amount','fk_prevalidation_decision','state_before','state_after','date_decision'),
	);
	$missingSeen = false;
	foreach (mjl_rst006a_suffixes() as $suffix) {
		$table = mjl_rst006a_table($db, $suffix);
		$exists = mjl_rst002b_table_exists($db, $table);
		if (!$exists) { $missingSeen = true; continue; }
		if ($missingSeen || mjl_rst006a_columns($db, $table) !== $expectedColumns[$suffix]) return false;
	}
	$expectedKeys = array('operation'=>5,'activity_revision'=>2,'revision_contributor'=>2,'review_decision'=>3);
	$keyGap = false;
	foreach ($expectedKeys as $suffix=>$expected) {
		$table = mjl_rst006a_table($db, $suffix);
		if (!mjl_rst002b_table_exists($db, $table)) continue;
		$count = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND CONSTRAINT_TYPE='FOREIGN KEY'");
		if ($count === 0) { $keyGap = true; continue; }
		if ($keyGap || $count !== $expected) return false;
	}
	$pointer = mjl_rst002b_column_exists($db, $db->prefix().'mjlfinancement_activity', 'fk_current_revision');
	if ($pointer) foreach ($expectedKeys as $suffix=>$expected) {
		$table = mjl_rst006a_table($db, $suffix);
		$count = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND CONSTRAINT_TYPE='FOREIGN KEY'");
		if ($count !== $expected) return false;
	}
	return true;
}

function mjl_rst006a_detect_schema(DoliDB $db)
{
	$present = 0;
	foreach (mjl_rst006a_suffixes() as $suffix) if (mjl_rst002b_table_exists($db, mjl_rst006a_table($db, $suffix))) $present++;
	$pointer = mjl_rst002b_column_exists($db, $db->prefix().'mjlfinancement_activity', 'fk_current_revision');
	if ($present === 0 && !$pointer) return mjl_rst002b_detect_schema($db) === RST002B_SCHEMA_TARGET ? RST006A_SCHEMA_PREDECESSOR : RST006A_SCHEMA_UNKNOWN;
	if ($present !== count(mjl_rst006a_suffixes()) || !$pointer) return RST006A_SCHEMA_PARTIAL;
	if (!mjl_rst006a_is_known_prefix($db)) return RST006A_SCHEMA_PARTIAL;
	$requiredTriggers = array(
		$db->prefix().'mjl_activity_rst006a_bi', $db->prefix().'mjl_activity_rst006a_bu',
		$db->prefix().'mjl_activity_assignment_bi',
		$db->prefix().'mjl_operation_rst006a_bi', $db->prefix().'mjl_operation_rst006a_bu', $db->prefix().'mjl_operation_rst006a_bd',
		$db->prefix().'mjl_revision_rst006a_bi', $db->prefix().'mjl_revision_rst006a_bu', $db->prefix().'mjl_revision_rst006a_bd',
		$db->prefix().'mjl_contributor_rst006a_bi', $db->prefix().'mjl_contributor_rst006a_bu', $db->prefix().'mjl_contributor_rst006a_bd',
		$db->prefix().'mjl_decision_rst006a_bi', $db->prefix().'mjl_decision_rst006a_bu', $db->prefix().'mjl_decision_rst006a_bd',
	);
	$quoted = array_map(function ($name) use ($db) { return "'".$db->escape($name)."'"; }, $requiredTriggers);
	$count = (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN ('.implode(',', $quoted).')');
	if ($count !== count($requiredTriggers)) return RST006A_SCHEMA_PARTIAL;
	$expectedBodies = array();
	foreach (mjl_rst006a_guard_statements($db) as $statement) if (preg_match('/^CREATE TRIGGER ([^ ]+) BEFORE (INSERT|UPDATE|DELETE) ON ([^ ]+) FOR EACH ROW (.*)$/s', $statement, $match)) {
		$expectedBodies[$match[1]] = array('timing'=>'BEFORE','event'=>$match[2],'table'=>$match[3],'body'=>preg_replace('/\s+/', ' ', trim(str_replace('`', '', $match[4]))));
	}
	$res = $db->query('SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,EVENT_OBJECT_TABLE,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN ('.implode(',', $quoted).') ORDER BY TRIGGER_NAME');
	if (!$res) return RST006A_SCHEMA_PARTIAL;
	while ($trigger = $db->fetch_object($res)) {
		$name = (string) $trigger->TRIGGER_NAME;
		$body = preg_replace('/\s+/', ' ', trim(str_replace('`', '', (string) $trigger->ACTION_STATEMENT)));
		if (!isset($expectedBodies[$name]) || $expectedBodies[$name]['timing'] !== $trigger->ACTION_TIMING || $expectedBodies[$name]['event'] !== $trigger->EVENT_MANIPULATION || $expectedBodies[$name]['table'] !== $trigger->EVENT_OBJECT_TABLE || $expectedBodies[$name]['body'] !== $body) return RST006A_SCHEMA_PARTIAL;
	}
	$foreignKeys = array('operation'=>5,'activity_revision'=>2,'revision_contributor'=>2,'review_decision'=>3);
	foreach ($foreignKeys as $suffix => $expected) {
		$table = mjl_rst006a_table($db, $suffix);
		$actual = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND CONSTRAINT_TYPE='FOREIGN KEY'");
		if ($actual !== $expected) return RST006A_SCHEMA_PARTIAL;
	}
	$assignment=$db->prefix().'mjlfinancement_activity_assignment';
	$expectedAssignmentIndexes=array('PRIMARY','idx_mjl_activity_assignment_activity_fk','idx_mjl_activity_assignment_agent_fk','idx_mjl_activity_assignment_assigner','idx_mjl_activity_assignment_current_activity','idx_mjl_activity_assignment_current_agent','uk_mjl_activity_assignment_current_primary','uk_mjl_activity_assignment_current_user');sort($expectedAssignmentIndexes,SORT_STRING);
	$actualAssignmentIndexes=array();$res=$db->query("SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($assignment)."' ORDER BY INDEX_NAME");if(!$res)return RST006A_SCHEMA_PARTIAL;while($index=$db->fetch_object($res))$actualAssignmentIndexes[]=(string)$index->INDEX_NAME;sort($actualAssignmentIndexes,SORT_STRING);if($actualAssignmentIndexes!==$expectedAssignmentIndexes){$GLOBALS['rst006a_state_error']='assignment indexes: '.implode(',',$actualAssignmentIndexes);return RST006A_SCHEMA_PARTIAL;}
	$expectedAssignmentIndexDefinitions=array('PRIMARY'=>'0:rowid','idx_mjl_activity_assignment_activity_fk'=>'1:fk_activity','idx_mjl_activity_assignment_agent_fk'=>'1:fk_user','idx_mjl_activity_assignment_assigner'=>'1:fk_user_assign','idx_mjl_activity_assignment_current_activity'=>'1:entity,fk_activity,date_end','idx_mjl_activity_assignment_current_agent'=>'1:entity,fk_user,date_end','uk_mjl_activity_assignment_current_primary'=>'0:entity,current_primary_activity_id','uk_mjl_activity_assignment_current_user'=>'0:entity,fk_activity,current_user_id');
	$actualAssignmentIndexDefinitions=array();$res=$db->query("SELECT INDEX_NAME,NON_UNIQUE,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($assignment)."' ORDER BY INDEX_NAME,SEQ_IN_INDEX");if(!$res)return RST006A_SCHEMA_PARTIAL;while($index=$db->fetch_object($res)){$name=(string)$index->INDEX_NAME;if(!isset($actualAssignmentIndexDefinitions[$name]))$actualAssignmentIndexDefinitions[$name]=(string)$index->NON_UNIQUE.':';else$actualAssignmentIndexDefinitions[$name].=',';$actualAssignmentIndexDefinitions[$name].=(string)$index->COLUMN_NAME;}ksort($actualAssignmentIndexDefinitions,SORT_STRING);ksort($expectedAssignmentIndexDefinitions,SORT_STRING);if($actualAssignmentIndexDefinitions!==$expectedAssignmentIndexDefinitions){$GLOBALS['rst006a_state_error']='assignment index definitions';return RST006A_SCHEMA_PARTIAL;}
	$expectedAssignmentConstraints=array('PRIMARY','chk_mjl_activity_assignment_dates','chk_mjl_activity_assignment_entity_positive','chk_mjl_activity_assignment_primary','chk_mjl_activity_assignment_reason_nonblank','fk_mjl_activity_assignment_activity','fk_mjl_activity_assignment_agent','fk_mjl_activity_assignment_assigner','uk_mjl_activity_assignment_current_primary','uk_mjl_activity_assignment_current_user');sort($expectedAssignmentConstraints,SORT_STRING);
	$actualAssignmentConstraints=array();$res=$db->query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($assignment)."' ORDER BY CONSTRAINT_NAME");if(!$res)return RST006A_SCHEMA_PARTIAL;while($constraint=$db->fetch_object($res))$actualAssignmentConstraints[]=(string)$constraint->CONSTRAINT_NAME;sort($actualAssignmentConstraints,SORT_STRING);if($actualAssignmentConstraints!==$expectedAssignmentConstraints){$GLOBALS['rst006a_state_error']='assignment constraints: '.implode(',',$actualAssignmentConstraints);return RST006A_SCHEMA_PARTIAL;}
	$activity = $db->prefix().'mjlfinancement_activity';
	$activityGuards = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND CONSTRAINT_NAME IN ('chk_mjl_activity_rst006a_phase2','fk_mjl_activity_current_revision')");
	return $activityGuards === 2 ? RST006A_SCHEMA_TARGET : RST006A_SCHEMA_PARTIAL;
}

function mjl_rst006a_load_sql_file(DoliDB $db, $path)
{
	$sql = file_get_contents($path);
	if ($sql === false) throw new RuntimeException('Unable to read schema file.');
	foreach (preg_split('/;\s*(?:\r?\n|$)/', $sql) as $statement) {
		$statement = trim($statement);
		if ($statement !== '' && !$db->query($statement)) throw new RuntimeException('RST-006A DDL failed: '.$db->lasterror());
	}
}

function mjl_rst006a_guard_statements(DoliDB $db)
{
	$p = $db->prefix();
	$a = $p.'mjlfinancement_activity';
	$o = $p.'mjlfinancement_operation';
	$r = $p.'mjlfinancement_activity_revision';
	$c = $p.'mjlfinancement_revision_contributor';
	$d = $p.'mjlfinancement_review_decision';
	$ot = $p.'mjlfinancement_operation_type';
	$project = $p.'projet';
	$partner = $p.'societe';
	return array(
		'DROP TRIGGER IF EXISTS '.$p.'mjl_activity_rst005_bi',
		'DROP TRIGGER IF EXISTS '.$p.'mjl_activity_rst002b_bu',
		'DROP TRIGGER IF EXISTS '.$p.'mjl_activity_assignment_bi',
		'CREATE TRIGGER '.$p."mjl_activity_rst006a_bi BEFORE INSERT ON $a FOR EACH ROW BEGIN IF NEW.entity<1 OR NEW.ref NOT REGEXP '^ACT-[0-9]{6,}$' OR NEW.validation_status NOT IN ('DRAFT','SUBMITTED') OR NEW.is_cancelled<>0 OR NEW.fk_current_revision IS NOT NULL OR NEW.first_submitted_amount IS NOT NULL OR NEW.latest_validated_amount IS NOT NULL OR NEW.version<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006A Activity insert'; END IF; END",
		'CREATE TRIGGER '.$p."mjl_activity_rst006a_bu BEFORE UPDATE ON $a FOR EACH ROW BEGIN DECLARE final_amount BIGINT DEFAULT NULL; IF NEW.entity<>OLD.entity OR NEW.ref<>OLD.ref OR NEW.fk_user_creat<>OLD.fk_user_creat OR NEW.date_creation<>OLD.date_creation OR NEW.version<>OLD.version+1 OR NEW.is_cancelled<>0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006A Activity update'; END IF; IF NEW.validation_status='FINAL_VALIDATED' THEN SELECT proposed_amount INTO final_amount FROM $r WHERE entity=NEW.entity AND rowid=NEW.fk_current_revision AND fk_activity=NEW.rowid; IF final_amount IS NULL OR NEW.latest_validated_amount<>final_amount THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Final amount must equal current revision'; END IF; END IF; END",
		'CREATE TRIGGER '.$p."mjl_activity_assignment_bi BEFORE INSERT ON {$p}mjlfinancement_activity_assignment FOR EACH ROW BEGIN DECLARE activity_ok INTEGER DEFAULT 0; DECLARE agent_ok INTEGER DEFAULT 0; DECLARE assigner_ok INTEGER DEFAULT 0; SELECT COUNT(*) INTO activity_ok FROM $a a WHERE a.rowid=NEW.fk_activity AND a.entity=NEW.entity AND (a.validation_status<>'ABANDONED' OR NOT EXISTS (SELECT 1 FROM {$p}mjlfinancement_activity_assignment aa WHERE aa.entity=a.entity AND aa.fk_activity=a.rowid AND aa.date_end IS NULL)); SELECT COUNT(*) INTO agent_ok FROM {$p}user u INNER JOIN {$p}mjlfinancement_user_role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code='AGENT_SAISIE' WHERE u.rowid=NEW.fk_user AND u.entity=NEW.entity AND u.statut=1 AND u.admin=0; SELECT COUNT(*) INTO assigner_ok FROM {$p}user u LEFT JOIN {$p}mjlfinancement_user_role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 WHERE u.rowid=NEW.fk_user_assign AND u.entity=NEW.entity AND u.statut=1 AND u.admin=0 AND (r.role_code='VALIDATEUR_DEFINITIF' OR (u.rowid=NEW.fk_user AND EXISTS (SELECT 1 FROM $a ca WHERE ca.rowid=NEW.fk_activity AND ca.entity=NEW.entity AND ca.fk_user_creat=u.rowid AND ca.version=1 AND ca.validation_status='DRAFT'))); IF activity_ok<>1 OR agent_ok<>1 OR assigner_ok<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006A assignment'; END IF; SET NEW.date_start=CURRENT_TIMESTAMP; SET NEW.date_creation=CURRENT_TIMESTAMP; SET NEW.tms=CURRENT_TIMESTAMP; END",
		'CREATE TRIGGER '.$p."mjl_operation_rst006a_bi BEFORE INSERT ON $o FOR EACH ROW BEGIN DECLARE parent_ok INTEGER DEFAULT 0; DECLARE type_ok INTEGER DEFAULT 0; SELECT COUNT(*) INTO parent_ok FROM $a WHERE rowid=NEW.fk_activity AND entity=NEW.entity; SELECT COUNT(*) INTO type_ok FROM $ot WHERE rowid=NEW.fk_operation_type AND entity=NEW.entity; IF parent_ok<>1 OR type_ok<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006A Operation relationship'; END IF; END",
		'CREATE TRIGGER '.$p."mjl_operation_rst006a_bu BEFORE UPDATE ON $o FOR EACH ROW BEGIN IF NEW.entity<>OLD.entity OR NEW.fk_activity<>OLD.fk_activity OR NEW.date_creation<>OLD.date_creation OR NEW.fk_user_creat<>OLD.fk_user_creat OR NEW.version<>OLD.version+1 OR OLD.date_removed IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006A Operation update'; END IF; END",
		'CREATE TRIGGER '.$p."mjl_operation_rst006a_bd BEFORE DELETE ON $o FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL Operations are never physically deleted'",
		'CREATE TRIGGER '.$p."mjl_revision_rst006a_bi BEFORE INSERT ON $r FOR EACH ROW BEGIN DECLARE activity_ok INTEGER DEFAULT 0; DECLARE submitter_ok INTEGER DEFAULT 0; SELECT COUNT(*) INTO activity_ok FROM $a WHERE rowid=NEW.fk_activity AND entity=NEW.entity AND version+1=NEW.activity_version AND validation_status IN ('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR') AND draft_authorized_amount=NEW.proposed_amount; SELECT COUNT(*) INTO submitter_ok FROM {$p}user u INNER JOIN {$p}mjlfinancement_user_role ur ON ur.entity=u.entity AND ur.fk_user=u.rowid AND ur.is_active=1 AND ur.role_code='AGENT_SAISIE' WHERE u.rowid=NEW.fk_submitter AND u.entity=NEW.entity AND u.statut=1 AND u.admin=0; IF activity_ok<>1 OR submitter_ok<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006A revision relationship'; END IF; END",
		'CREATE TRIGGER '.$p."mjl_revision_rst006a_bu BEFORE UPDATE ON $r FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL revisions are immutable'",
		'CREATE TRIGGER '.$p."mjl_revision_rst006a_bd BEFORE DELETE ON $r FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL revisions are immutable'",
		'CREATE TRIGGER '.$p."mjl_contributor_rst006a_bi BEFORE INSERT ON $c FOR EACH ROW BEGIN DECLARE revision_ok INTEGER DEFAULT 0; DECLARE user_ok INTEGER DEFAULT 0; SELECT COUNT(*) INTO revision_ok FROM $r WHERE rowid=NEW.fk_revision AND fk_activity=NEW.fk_activity AND entity=NEW.entity; SELECT COUNT(*) INTO user_ok FROM {$p}user u LEFT JOIN {$p}mjlfinancement_user_role ur ON ur.entity=u.entity AND ur.fk_user=u.rowid AND ur.is_active=1 WHERE u.rowid=NEW.fk_user AND u.entity=NEW.entity AND ((ur.rowid IS NOT NULL AND NEW.role_snapshot=ur.role_code) OR (ur.rowid IS NULL AND NEW.role_snapshot='ROLE_HISTORIQUE')); IF revision_ok<>1 OR user_ok<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006A contributor relationship'; END IF; END",
		'CREATE TRIGGER '.$p."mjl_contributor_rst006a_bu BEFORE UPDATE ON $c FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL revision contributors are immutable'",
		'CREATE TRIGGER '.$p."mjl_contributor_rst006a_bd BEFORE DELETE ON $c FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL revision contributors are immutable'",
		'CREATE TRIGGER '.$p."mjl_decision_rst006a_bi BEFORE INSERT ON $d FOR EACH ROW BEGIN DECLARE revision_ok INTEGER DEFAULT 0; DECLARE actor_ok INTEGER DEFAULT 0; DECLARE contributor_count INTEGER DEFAULT 0; DECLARE prevalidation_ok INTEGER DEFAULT 0; SELECT COUNT(*) INTO revision_ok FROM $r rv INNER JOIN $a ac ON ac.entity=rv.entity AND ac.rowid=rv.fk_activity WHERE rv.rowid=NEW.fk_revision AND rv.fk_activity=NEW.fk_activity AND rv.entity=NEW.entity AND ac.fk_current_revision=rv.rowid AND ac.validation_status=NEW.state_before; SELECT COUNT(*) INTO actor_ok FROM {$p}user u INNER JOIN {$p}mjlfinancement_user_role ur ON ur.entity=u.entity AND ur.fk_user=u.rowid AND ur.is_active=1 WHERE u.rowid=NEW.fk_actor AND u.entity=NEW.entity AND u.statut=1 AND u.admin=0 AND ((NEW.stage='SUPERVISOR' AND ur.role_code='AGENT_VERIFICATEUR' AND NEW.actor_role_snapshot='AGENT_VERIFICATEUR' AND NEW.state_before='SUBMITTED') OR (NEW.stage='VALIDATOR' AND ur.role_code='VALIDATEUR_DEFINITIF' AND NEW.actor_role_snapshot='VALIDATEUR_DEFINITIF' AND NEW.state_before='PREVALIDATED')); SELECT COUNT(*) INTO contributor_count FROM $c WHERE entity=NEW.entity AND fk_revision=NEW.fk_revision AND fk_user=NEW.fk_actor; IF NEW.decision_type='FINAL_VALIDATED' THEN SELECT COUNT(*) INTO prevalidation_ok FROM $d pd WHERE pd.entity=NEW.entity AND pd.rowid=NEW.fk_prevalidation_decision AND pd.fk_revision=NEW.fk_revision AND pd.decision_type='PREVALIDATED' AND pd.fk_actor<>NEW.fk_actor; ELSE SET prevalidation_ok=IF(NEW.fk_prevalidation_decision IS NULL,1,0); END IF; IF revision_ok<>1 OR actor_ok<>1 OR contributor_count<>0 OR prevalidation_ok<>1 OR NEW.state_after<>NEW.decision_type THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006A review relationship'; END IF; END",
		'CREATE TRIGGER '.$p."mjl_decision_rst006a_bu BEFORE UPDATE ON $d FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL review decisions are immutable'",
		'CREATE TRIGGER '.$p."mjl_decision_rst006a_bd BEFORE DELETE ON $d FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL review decisions are immutable'",
	);
}

function mjl_rst006a_install_guards(DoliDB $db)
{
	foreach (array(
		'mjl_activity_rst006a_bi','mjl_activity_rst006a_bu','mjl_activity_assignment_bi',
		'mjl_operation_rst006a_bi','mjl_operation_rst006a_bu','mjl_operation_rst006a_bd',
		'mjl_revision_rst006a_bi','mjl_revision_rst006a_bu','mjl_revision_rst006a_bd',
		'mjl_contributor_rst006a_bi','mjl_contributor_rst006a_bu','mjl_contributor_rst006a_bd',
		'mjl_decision_rst006a_bi','mjl_decision_rst006a_bu','mjl_decision_rst006a_bd',
	) as $suffix) if (!$db->query('DROP TRIGGER IF EXISTS '.$db->prefix().$suffix)) throw new RuntimeException('Unable to reset RST-006A guard: '.$db->lasterror());
	foreach (mjl_rst006a_guard_statements($db) as $sql) if (!$db->query($sql)) throw new RuntimeException('Unable to install RST-006A guard: '.$db->lasterror());
}

function mjl_rst006a_install_target(DoliDB $db, $failurePoint = '')
{
	$state = mjl_rst006a_detect_schema($db);
	if ($state === RST006A_SCHEMA_TARGET) return;
	if ($state !== RST006A_SCHEMA_PREDECESSOR && ($state !== RST006A_SCHEMA_PARTIAL || !mjl_rst006a_is_known_prefix($db))) throw new RuntimeException('RST-006A unknown predecessor state.');
	$base = dirname(__DIR__).'/sql/';
	foreach (mjl_rst006a_suffixes() as $suffix) {
		$table = mjl_rst006a_table($db, $suffix);
		if (!mjl_rst002b_table_exists($db, $table)) mjl_rst006a_load_sql_file($db, $base.'llx_mjlfinancement_'.$suffix.'.sql');
		if ($failurePoint === $suffix) throw new RuntimeException('Injected interruption after '.$suffix.'.');
	}
	$keyFiles = array('operation','activity_revision','revision_contributor','review_decision');
	foreach ($keyFiles as $suffix) {
		$table = mjl_rst006a_table($db, $suffix);
		$fkCount = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND CONSTRAINT_TYPE='FOREIGN KEY'");
		$expected = array('operation'=>5,'activity_revision'=>2,'revision_contributor'=>2,'review_decision'=>3);
		if ($fkCount === 0) mjl_rst006a_load_sql_file($db, $base.'llx_mjlfinancement_'.$suffix.'.key.sql');
		elseif ($fkCount !== $expected[$suffix]) throw new RuntimeException('Unknown RST-006A foreign-key prefix for '.$suffix.'.');
		if ($failurePoint === $suffix.'-keys') throw new RuntimeException('Injected interruption after '.$suffix.' keys.');
	}
	$activity = $db->prefix().'mjlfinancement_activity';
	if (!mjl_rst002b_column_exists($db, $activity, 'fk_current_revision')) {
		if (!$db->query('ALTER TABLE '.$activity.' ADD fk_current_revision BIGINT(20) DEFAULT NULL AFTER latest_validated_amount')) throw new RuntimeException('Unable to add current revision pointer.');
	}
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND INDEX_NAME='uk_mjl_activity_entity_rowid'") === 0
		&& !$db->query('ALTER TABLE '.$activity.' ADD UNIQUE INDEX uk_mjl_activity_entity_rowid (entity,rowid)')) throw new RuntimeException('Unable to add Activity composite identity.');
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND INDEX_NAME='idx_mjl_activity_current_revision'") === 0
		&& !$db->query('ALTER TABLE '.$activity.' ADD INDEX idx_mjl_activity_current_revision (entity,fk_current_revision,rowid)')) throw new RuntimeException('Unable to index current revision pointer.');
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND CONSTRAINT_NAME='fk_mjl_activity_current_revision'") === 0
		&& !$db->query('ALTER TABLE '.$activity.' ADD CONSTRAINT fk_mjl_activity_current_revision FOREIGN KEY (entity,fk_current_revision,rowid) REFERENCES '.$db->prefix().'mjlfinancement_activity_revision(entity,rowid,fk_activity) ON UPDATE RESTRICT ON DELETE RESTRICT')) throw new RuntimeException('Unable to bind current revision pointer.');
	if ($failurePoint === 'activity-pointer') throw new RuntimeException('Injected interruption after Activity pointer.');
	$db->query('ALTER TABLE '.$activity.' DROP CONSTRAINT chk_mjl_activity_rst005_dormant');
	$db->query('ALTER TABLE '.$activity.' DROP CONSTRAINT chk_mjl_activity_validation_status');
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND CONSTRAINT_NAME='chk_mjl_activity_validation_status'") === 0
		&& !$db->query("ALTER TABLE $activity ADD CONSTRAINT chk_mjl_activity_validation_status CHECK (validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED'))")) throw new RuntimeException('Unable to replace Activity status constraint.');
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND CONSTRAINT_NAME='chk_mjl_activity_rst006a_phase2'") === 0) {
		$check = "validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED') AND is_cancelled=0 AND ((validation_status IN ('DRAFT','ABANDONED') AND fk_current_revision IS NULL AND first_submitted_amount IS NULL AND latest_validated_amount IS NULL) OR (validation_status IN ('SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR') AND fk_current_revision IS NOT NULL AND first_submitted_amount>0 AND latest_validated_amount IS NULL) OR (validation_status='FINAL_VALIDATED' AND fk_current_revision IS NOT NULL AND first_submitted_amount>0 AND latest_validated_amount>0))";
		if (!$db->query('ALTER TABLE '.$activity.' ADD CONSTRAINT chk_mjl_activity_rst006a_phase2 CHECK ('.$check.')')) throw new RuntimeException('Unable to add RST-006A Activity constraint.');
	}
	mjl_rst006a_install_guards($db);
	if (mjl_rst006a_detect_schema($db) !== RST006A_SCHEMA_TARGET) throw new RuntimeException('RST-006A target verification failed'.(empty($GLOBALS['rst006a_state_error'])?'':': '.$GLOBALS['rst006a_state_error']).'.');
}

function mjl_rst006a_require_target(DoliDB $db)
{
	$state = mjl_rst006a_detect_schema($db);
	if ($state === RST006A_SCHEMA_PREDECESSOR) throw new RuntimeException('MIGRATION_REQUIRED');
	if ($state !== RST006A_SCHEMA_TARGET) throw new RuntimeException('RST-006A schema is incomplete or unknown.');
}
