<?php

require_once __DIR__.'/cli_guard.php';
define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';

function exact_fail($message) { fwrite(STDERR, 'ERROR: '.$message.PHP_EOL); exit(1); }
function exact_rows($sql) {
	global $db;
	$resql = $db->query($sql);
	if (!$resql) exact_fail($db->lasterror().' | '.$sql);
	$rows = array();
	while ($row = $db->fetch_array($resql)) $rows[] = $row;
	return $rows;
}
function exact_normalize($value) {
	$value = strtolower((string) $value);
	$value = str_replace(array('`', '\\n', '\\r', '\\t'), '', $value);
	$value = preg_replace('/\s+/', '', $value);
	while (strlen($value) > 1 && $value[0] === '(' && substr($value, -1) === ')') $value = substr($value, 1, -1);
	return $value;
}
function exact_assert_map($label, array $actual, array $expected) {
	ksort($actual); ksort($expected);
	if ($actual !== $expected) exact_fail($label.' mismatch. expected='.json_encode($expected).' actual='.json_encode($actual));
}

$prefix = $db->prefix();
$expectedEngines = array(
	'mjlfinancement_activity' => 'InnoDB',
	'mjlfinancement_audit_event' => 'InnoDB',
	'mjlfinancement_invitation' => 'InnoDB',
	'mjlfinancement_password_reset' => 'InnoDB',
);
$actualEngines = array();
$engineTables = array(); foreach (array_keys($expectedEngines) as $table) $engineTables[] = "'".$db->escape($prefix.$table)."'";
foreach (exact_rows('SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('.implode(',', $engineTables).')') as $row) {
	$actualEngines[substr($row['TABLE_NAME'], strlen($prefix))] = $row['ENGINE'];
}
exact_assert_map('Phase 1 table engines', $actualEngines, $expectedEngines);

$columns = array(
	'mjlfinancement_activity' => array(
		'rowid'=>'int(11)|NO||auto_increment|', 'entity'=>'int(11)|NO|1||', 'ref'=>'varchar(128)|NO|||', 'label'=>'varchar(255)|NO|||',
		'fk_project'=>'int(11)|NO|||', 'fk_task'=>'int(11)|YES|NULL||', 'date_start'=>'date|YES|NULL||', 'date_end'=>'date|YES|NULL||',
		'fk_user_responsible'=>'int(11)|YES|NULL||', 'date_actual_start'=>'date|YES|NULL||', 'date_actual_end'=>'date|YES|NULL||',
		'physical_execution_percent'=>'int(11)|YES|NULL||', 'execution_status'=>'varchar(32)|YES|NULL||', 'execution_comment'=>'text|YES|NULL||',
		'note_public'=>'text|YES|NULL||', 'note_private'=>'text|YES|NULL||', 'date_creation'=>'datetime|NO|||',
		'tms'=>'timestamp|YES|current_timestamp()|on update current_timestamp()|', 'fk_user_creat'=>'int(11)|NO|||', 'fk_user_modif'=>'int(11)|YES|NULL||',
		'import_key'=>'varchar(14)|YES|NULL||', 'status'=>'int(11)|NO|0||',
	),
	'mjlfinancement_audit_event' => array(
		'rowid'=>'bigint(20)|NO||auto_increment|', 'entity'=>'int(11)|NO|1||', 'object_type'=>'varchar(64)|NO|||', 'object_id'=>'bigint(20)|YES|NULL||',
		'object_ref'=>'varchar(128)|YES|NULL||', 'activity_id'=>'bigint(20)|YES|NULL||', 'operation_id'=>'bigint(20)|YES|NULL||', 'revision_id'=>'bigint(20)|YES|NULL||',
		'actor_id'=>'int(11)|YES|NULL||', 'actor_name_snapshot'=>'varchar(255)|NO|||', 'actor_role_snapshot'=>'varchar(64)|NO|||', 'event_date'=>'datetime|NO|||',
		'action'=>'varchar(96)|NO|||', 'previous_values_json'=>'longtext|YES|NULL||', 'new_values_json'=>'longtext|YES|NULL||', 'reason'=>'text|YES|NULL||',
		'state_before'=>'varchar(64)|YES|NULL||', 'state_after'=>'varchar(64)|YES|NULL||', 'target_version'=>'bigint(20)|YES|NULL||', 'result'=>'varchar(16)|NO|||',
		'context_json'=>'longtext|YES|NULL||', 'date_creation'=>'datetime|NO|||',
	),
	'mjlfinancement_invitation' => array(
		'rowid'=>'int(11)|NO||auto_increment|', 'entity'=>'int(11)|NO|1||', 'fk_user'=>'int(11)|NO|||', 'role_code'=>'varchar(64)|NO|||',
		'status'=>'varchar(32)|NO|||', 'token_selector'=>'varchar(64)|NO|||', 'token_hash'=>'char(64)|YES|NULL||',
		'live_user_id'=>'int(11)|YES|NULL|stored generated|casewhenstatusin(\'pending_send\',\'sent\')thenfk_userelsenullend',
		'date_expiry'=>'datetime|NO|||', 'date_sent'=>'datetime|YES|NULL||', 'date_accepted'=>'datetime|YES|NULL||', 'date_revoked'=>'datetime|YES|NULL||',
		'fk_user_sender'=>'int(11)|NO|||', 'fk_user_revoked'=>'int(11)|YES|NULL||', 'date_creation'=>'datetime|NO|||',
		'tms'=>'timestamp|YES|current_timestamp()|on update current_timestamp()|', 'fk_user_creat'=>'int(11)|NO|||', 'fk_user_modif'=>'int(11)|YES|NULL||',
	),
	'mjlfinancement_password_reset' => array(
		'rowid'=>'int(11)|NO||auto_increment|', 'entity'=>'int(11)|NO|1||', 'fk_user'=>'int(11)|NO|||', 'status'=>"varchar(32)|NO|'pending_send'||",
		'token_selector'=>'varchar(64)|NO|||', 'token_hash'=>'char(64)|YES|NULL||',
		'live_user_id'=>'int(11)|YES|NULL|stored generated|casewhenstatusin(\'pending_send\',\'sent\')thenfk_userelsenullend',
		'date_expiry'=>'datetime|NO|||', 'date_consumed'=>'datetime|YES|NULL||', 'date_creation'=>'datetime|NO|||',
		'tms'=>'timestamp|YES|current_timestamp()|on update current_timestamp()|', 'fk_user_creat'=>'int(11)|NO|||', 'fk_user_modif'=>'int(11)|YES|NULL||',
	),
);

foreach ($columns as $table => $expected) {
	$actual = array();
	$sql = "SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($prefix.$table)."' ORDER BY ORDINAL_POSITION";
	foreach (exact_rows($sql) as $row) {
		$default = $row['COLUMN_DEFAULT'];
		if ($default === null) $default = $row['IS_NULLABLE'] === 'YES' ? 'NULL' : '';
		$actual[$row['COLUMN_NAME']] = strtolower($row['COLUMN_TYPE']).'|'.$row['IS_NULLABLE'].'|'.$default.'|'.strtolower($row['EXTRA']).'|'.exact_normalize($row['GENERATION_EXPRESSION']);
	}
	exact_assert_map($table.' columns', $actual, $expected);
}

$characterColumns = array(
	'mjlfinancement_activity' => array('ref','label','execution_status','execution_comment','note_public','note_private','import_key'),
	'mjlfinancement_audit_event' => array('object_type','object_ref','actor_name_snapshot','actor_role_snapshot','action','previous_values_json','new_values_json','reason','state_before','state_after','result','context_json'),
	'mjlfinancement_invitation' => array('role_code','status','token_selector','token_hash'),
	'mjlfinancement_password_reset' => array('status','token_selector','token_hash'),
);
$expectedCharacterDefinitions=array();
foreach ($characterColumns as $table=>$names) foreach ($names as $name) $expectedCharacterDefinitions[$prefix.$table.'.'.$name]='utf8mb4|utf8mb4_uca1400_ai_ci';
$actualCharacterDefinitions=array();
$sql="SELECT TABLE_NAME,COLUMN_NAME,CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('{$prefix}mjlfinancement_activity','{$prefix}mjlfinancement_audit_event','{$prefix}mjlfinancement_invitation','{$prefix}mjlfinancement_password_reset') AND CHARACTER_SET_NAME IS NOT NULL";
foreach (exact_rows($sql) as $row) $actualCharacterDefinitions[$row['TABLE_NAME'].'.'.$row['COLUMN_NAME']]=$row['CHARACTER_SET_NAME'].'|'.$row['COLLATION_NAME'];
exact_assert_map('Phase 1 character sets and collations', $actualCharacterDefinitions, $expectedCharacterDefinitions);

$indexes = array(
	'mjlfinancement_activity' => array('PRIMARY'=>'U:rowid', 'idx_mjlfinancement_activity_entity'=>'N:entity', 'idx_mjlfinancement_activity_fk_project'=>'N:fk_project', 'idx_mjlfinancement_activity_fk_task'=>'N:fk_task', 'idx_mjlfinancement_activity_fk_user_responsible'=>'N:fk_user_responsible', 'uk_mjlfinancement_activity_ref_entity'=>'U:ref,entity'),
	'mjlfinancement_audit_event' => array('PRIMARY'=>'U:rowid', 'idx_mjl_audit_action'=>'N:entity,action', 'idx_mjl_audit_activity'=>'N:entity,activity_id', 'idx_mjl_audit_actor'=>'N:entity,actor_id', 'idx_mjl_audit_entity_date'=>'N:entity,event_date,rowid', 'idx_mjl_audit_object'=>'N:entity,object_type,object_id', 'idx_mjl_audit_operation'=>'N:entity,operation_id'),
	'mjlfinancement_invitation' => array('PRIMARY'=>'U:rowid', 'fk_mjl_invitation_target_user'=>'N:fk_user', 'idx_mjl_invitation_status'=>'N:entity,status', 'idx_mjl_invitation_user'=>'N:entity,fk_user', 'uk_mjl_invitation_hash'=>'U:entity,token_hash', 'uk_mjl_invitation_live_user'=>'U:entity,live_user_id', 'uk_mjl_invitation_selector'=>'U:entity,token_selector'),
	'mjlfinancement_password_reset' => array('PRIMARY'=>'U:rowid', 'fk_mjl_reset_target_user'=>'N:fk_user', 'idx_mjl_reset_status'=>'N:entity,status', 'idx_mjl_reset_user'=>'N:entity,fk_user', 'uk_mjl_reset_hash'=>'U:entity,token_hash', 'uk_mjl_reset_live_user'=>'U:entity,live_user_id', 'uk_mjl_reset_selector'=>'U:entity,token_selector'),
);
foreach ($indexes as $table => $expected) {
	foreach ($expected as $name => $definition) {
		list($unique, $columnList) = explode(':', $definition, 2);
		$parts = array(); foreach (explode(',', $columnList) as $column) $parts[] = 'A:0:'.$column;
		$expected[$name] = $unique.'|BTREE|'.implode(',', $parts);
	}
	$groups = array();
	$sql = "SELECT INDEX_NAME,NON_UNIQUE,INDEX_TYPE,COLUMN_NAME,COLLATION,COALESCE(SUB_PART,0) AS SUB_PART,SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($prefix.$table)."' ORDER BY INDEX_NAME,SEQ_IN_INDEX";
	foreach (exact_rows($sql) as $row) {
		$name=$row['INDEX_NAME'];
		if (!isset($groups[$name])) $groups[$name]=array('unique'=>(int)$row['NON_UNIQUE']===0,'type'=>$row['INDEX_TYPE'],'columns'=>array());
		$groups[$name]['columns'][]=$row['COLLATION'].':'.$row['SUB_PART'].':'.$row['COLUMN_NAME'];
	}
	$actual=array(); foreach ($groups as $name=>$definition) $actual[$name]=($definition['unique']?'U':'N').'|'.$definition['type'].'|'.implode(',', $definition['columns']);
	exact_assert_map($table.' indexes', $actual, $expected);
}

$expectedFks = array(
	'fk_mjlfinancement_activity_project'=>$prefix.'mjlfinancement_activity:fk_project>'.$prefix.'projet:rowid|RESTRICT|RESTRICT',
	'fk_mjlfinancement_activity_responsible'=>$prefix.'mjlfinancement_activity:fk_user_responsible>'.$prefix.'user:rowid|RESTRICT|RESTRICT',
	'fk_mjlfinancement_activity_task'=>$prefix.'mjlfinancement_activity:fk_task>'.$prefix.'projet_task:rowid|RESTRICT|RESTRICT',
	'fk_mjl_invitation_target_user'=>$prefix.'mjlfinancement_invitation:fk_user>'.$prefix.'user:rowid|RESTRICT|RESTRICT',
	'fk_mjl_reset_target_user'=>$prefix.'mjlfinancement_password_reset:fk_user>'.$prefix.'user:rowid|RESTRICT|RESTRICT',
);
$actualFks=array();
$sql="SELECT k.CONSTRAINT_NAME,k.TABLE_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.UPDATE_RULE,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.TABLE_NAME IN ('{$prefix}mjlfinancement_activity','{$prefix}mjlfinancement_invitation','{$prefix}mjlfinancement_password_reset') AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.CONSTRAINT_NAME,k.ORDINAL_POSITION";
foreach (exact_rows($sql) as $row) $actualFks[$row['CONSTRAINT_NAME']]=$row['TABLE_NAME'].':'.$row['COLUMN_NAME'].'>'.$row['REFERENCED_TABLE_NAME'].':'.$row['REFERENCED_COLUMN_NAME'].'|'.$row['UPDATE_RULE'].'|'.$row['DELETE_RULE'];
exact_assert_map('Phase 1 foreign keys', $actualFks, $expectedFks);

$expectedChecks=array(
	'chk_mjl_audit_context_json'=>'context_jsonisnullorjson_valid(context_json)', 'chk_mjl_audit_new_json'=>'new_values_jsonisnullorjson_valid(new_values_json)',
	'chk_mjl_audit_previous_json'=>'previous_values_jsonisnullorjson_valid(previous_values_json)', "chk_mjl_audit_result"=>"resultin('SUCCESS','DENIED','FAILED')",
	'chk_mjl_invitation_credential_state'=>"statusin('pending_send','sent')andtoken_hashisnotnullorstatusin('accepted','revoked','send_failed')andtoken_hashisnull",
	'chk_mjl_invitation_role'=>"role_codein('AGENT_SAISIE','AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF')", "chk_mjl_invitation_status"=>"statusin('pending_send','sent','accepted','revoked','send_failed')",
	'chk_mjl_invitation_terminal_date'=>"statusin('pending_send','sent')anddate_acceptedisnullanddate_revokedisnullorstatus='accepted'anddate_acceptedisnotnullorstatusin('revoked','send_failed')anddate_revokedisnotnull",
	'chk_mjl_reset_credential_state'=>"statusin('pending_send','sent')andtoken_hashisnotnullanddate_consumedisnullorstatusin('consumed','send_failed','revoked')andtoken_hashisnullanddate_consumedisnotnull",
	'chk_mjl_reset_status'=>"statusin('pending_send','sent','consumed','send_failed','revoked')",
);
$actualChecks=array();
$sql="SELECT tc.CONSTRAINT_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc INNER JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME IN ('{$prefix}mjlfinancement_audit_event','{$prefix}mjlfinancement_invitation','{$prefix}mjlfinancement_password_reset') AND tc.CONSTRAINT_TYPE='CHECK'";
foreach (exact_rows($sql) as $row) $actualChecks[$row['CONSTRAINT_NAME']]=exact_normalize($row['CHECK_CLAUSE']);
foreach ($expectedChecks as $name=>$expression) $expectedChecks[$name]=exact_normalize($expression);
exact_assert_map('Phase 1 checks', $actualChecks, $expectedChecks);

$expectedTriggers=array(
	$prefix.'mjlfinancement_audit_event_bd'=>'BEFORE DELETE:'.$prefix.'mjlfinancement_audit_event:signal sqlstate \'45000\' set message_text = \'MJL audit events are append-only\'',
	$prefix.'mjlfinancement_audit_event_bu'=>'BEFORE UPDATE:'.$prefix.'mjlfinancement_audit_event:signal sqlstate \'45000\' set message_text = \'MJL audit events are append-only\'',
	$prefix.'mjlfinancement_user_role_bi'=>'BEFORE INSERT:'.$prefix.'mjlfinancement_user_role:BEGIN DECLARE target_admin INTEGER DEFAULT 0; DECLARE target_entity INTEGER DEFAULT -1; IF NEW.role_code NOT IN (\'AGENT_SAISIE\', \'AGENT_VERIFICATEUR\', \'VALIDATEUR_DEFINITIF\') THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL business role\'; END IF; SELECT admin, entity INTO target_admin, target_entity FROM '.$prefix.'user WHERE rowid = NEW.fk_user; IF target_entity <> NEW.entity OR (NEW.is_active = 1 AND target_admin = 1) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL role target\'; END IF; END',
	$prefix.'mjlfinancement_user_role_bu'=>'BEFORE UPDATE:'.$prefix.'mjlfinancement_user_role:BEGIN DECLARE target_admin INTEGER DEFAULT 0; DECLARE target_entity INTEGER DEFAULT -1; IF NEW.role_code NOT IN (\'AGENT_SAISIE\', \'AGENT_VERIFICATEUR\', \'VALIDATEUR_DEFINITIF\') THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL business role\'; END IF; SELECT admin, entity INTO target_admin, target_entity FROM '.$prefix.'user WHERE rowid = NEW.fk_user; IF target_entity <> NEW.entity OR (NEW.is_active = 1 AND target_admin = 1) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Invalid MJL role target\'; END IF; END',
	$prefix.'mjlfinancement_user_admin_bu'=>'BEFORE UPDATE:'.$prefix.'user:BEGIN IF NEW.admin = 1 AND OLD.admin <> 1 AND EXISTS (SELECT 1 FROM '.$prefix.'mjlfinancement_user_role WHERE fk_user = NEW.rowid AND is_active = 1 AND role_code IN (\'AGENT_SAISIE\', \'AGENT_VERIFICATEUR\', \'VALIDATEUR_DEFINITIF\')) THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'MJL business-role user cannot become native admin\'; END IF; END',
	$prefix.'mjlfinancement_invitation_bi'=>'BEFORE INSERT:'.$prefix.'mjlfinancement_invitation:BEGIN DECLARE target_admin INTEGER DEFAULT 1; DECLARE target_entity INTEGER DEFAULT -1; SELECT admin, entity INTO target_admin, target_entity FROM '.$prefix.'user WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity OR target_admin=1 THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid invitation target\'; END IF; END',
	$prefix.'mjlfinancement_invitation_bu'=>'BEFORE UPDATE:'.$prefix.'mjlfinancement_invitation:BEGIN DECLARE target_admin INTEGER DEFAULT 1; DECLARE target_entity INTEGER DEFAULT -1; SELECT admin, entity INTO target_admin, target_entity FROM '.$prefix.'user WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity OR target_admin=1 OR NEW.entity<>OLD.entity OR NEW.fk_user<>OLD.fk_user OR NEW.token_selector<>OLD.token_selector THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid invitation mutation\'; END IF; END',
	$prefix.'mjlfinancement_reset_bi'=>'BEFORE INSERT:'.$prefix.'mjlfinancement_password_reset:BEGIN DECLARE target_entity INTEGER DEFAULT -1; SELECT entity INTO target_entity FROM '.$prefix.'user WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid reset target\'; END IF; END',
	$prefix.'mjlfinancement_reset_bu'=>'BEFORE UPDATE:'.$prefix.'mjlfinancement_password_reset:BEGIN DECLARE target_entity INTEGER DEFAULT -1; SELECT entity INTO target_entity FROM '.$prefix.'user WHERE rowid=NEW.fk_user; IF target_entity<>NEW.entity OR NEW.entity<>OLD.entity OR NEW.fk_user<>OLD.fk_user OR NEW.token_selector<>OLD.token_selector THEN SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT=\'Invalid reset mutation\'; END IF; END',
);
$actualTriggers=array();
$sql="SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,EVENT_OBJECT_TABLE,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE IN ('{$prefix}mjlfinancement_audit_event','{$prefix}mjlfinancement_user_role','{$prefix}mjlfinancement_invitation','{$prefix}mjlfinancement_password_reset','{$prefix}user')";
foreach (exact_rows($sql) as $row) $actualTriggers[$row['TRIGGER_NAME']]=$row['ACTION_TIMING'].' '.$row['EVENT_MANIPULATION'].':'.$row['EVENT_OBJECT_TABLE'].':'.exact_normalize($row['ACTION_STATEMENT']);
foreach ($expectedTriggers as $name=>$definition) $expectedTriggers[$name]=exact_normalize($definition);
foreach ($actualTriggers as $name=>$definition) $actualTriggers[$name]=exact_normalize($definition);
exact_assert_map('Phase 1 triggers', $actualTriggers, $expectedTriggers);

print "RST Phase 1 exact schema definitions verified.\n";
