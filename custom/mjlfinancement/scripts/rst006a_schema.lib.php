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

function mjl_rst006a_new_table_contracts(DoliDB $db)
{
	$p = $db->prefix();
	return array(
		'activity_reference_sequence'=>array(
			'collation'=>'utf8mb4_uca1400_ai_ci',
			'columns'=>array('entity'=>'int(11)|NO|||','next_value'=>'bigint(20)|NO|||','date_creation'=>'datetime|NO|||','tms'=>'timestamp|NO|current_timestamp()|on update current_timestamp()|'),
			'indexes'=>array('PRIMARY'=>'U|BTREE|A:0:entity'), 'fks'=>array(),
			'checks'=>array('chk_mjl_activity_sequence_entity'=>'entity>0','chk_mjl_activity_sequence_next'=>'next_value>0'),
			'characters'=>array(),
		),
		'operation'=>array(
			'collation'=>'utf8mb4_uca1400_ai_ci',
			'columns'=>array('rowid'=>'bigint(20)|NO||auto_increment|','entity'=>'int(11)|NO|||','fk_activity'=>'int(11)|NO|||','fk_operation_type'=>'int(11)|NO|||','name'=>'varchar(255)|NO|||','authorized_amount'=>'bigint(20)|NO|||','status'=>"varchar(16)|NO|'TODO'||",'spent_amount'=>'bigint(20)|YES|NULL||','observation'=>'text|YES|NULL||','version'=>'bigint(20)|NO|1||','date_removed'=>'datetime|YES|NULL||','fk_user_removed'=>'int(11)|YES|NULL||','date_creation'=>'datetime|NO|||','tms'=>'timestamp|NO|current_timestamp()|on update current_timestamp()|','fk_user_creat'=>'int(11)|NO|||','fk_user_modif'=>'int(11)|YES|NULL||'),
			'indexes'=>array('PRIMARY'=>'U|BTREE|A:0:rowid','uk_mjl_operation_entity_rowid'=>'U|BTREE|A:0:entity,A:0:rowid','idx_mjl_operation_activity'=>'N|BTREE|A:0:entity,A:0:fk_activity,A:0:date_removed','idx_mjl_operation_type'=>'N|BTREE|A:0:entity,A:0:fk_operation_type','fk_mjl_operation_activity'=>'N|BTREE|A:0:fk_activity','fk_mjl_operation_type'=>'N|BTREE|A:0:fk_operation_type','fk_mjl_operation_creator'=>'N|BTREE|A:0:fk_user_creat','fk_mjl_operation_modifier'=>'N|BTREE|A:0:fk_user_modif','fk_mjl_operation_remover'=>'N|BTREE|A:0:fk_user_removed'),
			'fks'=>array('fk_mjl_operation_activity'=>'fk_activity>'.$p.'mjlfinancement_activity:rowid|RESTRICT|RESTRICT','fk_mjl_operation_type'=>'fk_operation_type>'.$p.'mjlfinancement_operation_type:rowid|RESTRICT|RESTRICT','fk_mjl_operation_creator'=>'fk_user_creat>'.$p.'user:rowid|RESTRICT|RESTRICT','fk_mjl_operation_modifier'=>'fk_user_modif>'.$p.'user:rowid|RESTRICT|RESTRICT','fk_mjl_operation_remover'=>'fk_user_removed>'.$p.'user:rowid|RESTRICT|RESTRICT'),
			'checks'=>array('chk_mjl_operation_entity'=>'entity>0','chk_mjl_operation_name'=>"nameregexp'[^[:space:]]'",'chk_mjl_operation_amount'=>'authorized_amount>0','chk_mjl_operation_version'=>'version>0','chk_mjl_operation_phase2'=>"status='TODO'andspent_amountisnullandobservationisnull",'chk_mjl_operation_removal'=>'date_removedisnullandfk_user_removedisnullordate_removedisnotnullandfk_user_removedisnotnull'),
			'characters'=>array('name'=>'utf8mb4|utf8mb4_uca1400_ai_ci','status'=>'utf8mb4|utf8mb4_uca1400_ai_ci','observation'=>'utf8mb4|utf8mb4_uca1400_ai_ci'),
		),
		'activity_revision'=>array(
			'collation'=>'utf8mb4_bin',
			'columns'=>array('rowid'=>'bigint(20)|NO||auto_increment|','entity'=>'int(11)|NO|||','fk_activity'=>'int(11)|NO|||','revision_number'=>'bigint(20)|NO|||','activity_version'=>'bigint(20)|NO|||','schema_version'=>'int(11)|NO|1||','snapshot_json'=>'longtext|NO|||','structural_hash'=>'char(64)|NO|||','integrity_hash'=>'char(64)|NO|||','proposed_amount'=>'bigint(20)|NO|||','fk_submitter'=>'int(11)|NO|||','submitter_name_snapshot'=>'varchar(255)|NO|||','submitter_role_snapshot'=>'varchar(40)|NO|||','date_submitted'=>'datetime|NO|||'),
			'indexes'=>array('PRIMARY'=>'U|BTREE|A:0:rowid','uk_mjl_revision_entity_rowid_activity'=>'U|BTREE|A:0:entity,A:0:rowid,A:0:fk_activity','uk_mjl_revision_number'=>'U|BTREE|A:0:entity,A:0:fk_activity,A:0:revision_number','fk_mjl_revision_activity'=>'N|BTREE|A:0:fk_activity','fk_mjl_revision_submitter'=>'N|BTREE|A:0:fk_submitter'),
			'fks'=>array('fk_mjl_revision_activity'=>'fk_activity>'.$p.'mjlfinancement_activity:rowid|RESTRICT|RESTRICT','fk_mjl_revision_submitter'=>'fk_submitter>'.$p.'user:rowid|RESTRICT|RESTRICT'),
			'checks'=>array('chk_mjl_revision_entity'=>'entity>0','chk_mjl_revision_numbers'=>'revision_number>0andactivity_version>0andschema_version=1','chk_mjl_revision_hashes'=>"structural_hashregexp'^[0-9a-f]{64}$'andintegrity_hashregexp'^[0-9a-f]{64}$'",'chk_mjl_revision_amount'=>'proposed_amount>0','chk_mjl_revision_snapshot'=>'json_valid(snapshot_json)'),
			'characters'=>array('snapshot_json'=>'utf8mb4|utf8mb4_bin','structural_hash'=>'utf8mb4|utf8mb4_bin','integrity_hash'=>'utf8mb4|utf8mb4_bin','submitter_name_snapshot'=>'utf8mb4|utf8mb4_bin','submitter_role_snapshot'=>'utf8mb4|utf8mb4_bin'),
		),
		'revision_contributor'=>array(
			'collation'=>'utf8mb4_uca1400_ai_ci',
			'columns'=>array('rowid'=>'bigint(20)|NO||auto_increment|','entity'=>'int(11)|NO|||','fk_activity'=>'int(11)|NO|||','fk_revision'=>'bigint(20)|NO|||','fk_user'=>'int(11)|NO|||','user_name_snapshot'=>'varchar(255)|NO|||','role_snapshot'=>'varchar(40)|NO|||','date_creation'=>'datetime|NO|||'),
			'indexes'=>array('PRIMARY'=>'U|BTREE|A:0:rowid','uk_mjl_revision_contributor'=>'U|BTREE|A:0:entity,A:0:fk_revision,A:0:fk_user','idx_mjl_contributor_activity'=>'N|BTREE|A:0:entity,A:0:fk_activity','fk_mjl_contributor_revision'=>'N|BTREE|A:0:entity,A:0:fk_revision,A:0:fk_activity','fk_mjl_contributor_user'=>'N|BTREE|A:0:fk_user'),
			'fks'=>array('fk_mjl_contributor_revision'=>'entity,fk_revision,fk_activity>'.$p.'mjlfinancement_activity_revision:entity,rowid,fk_activity|RESTRICT|RESTRICT','fk_mjl_contributor_user'=>'fk_user>'.$p.'user:rowid|RESTRICT|RESTRICT'),
			'checks'=>array('chk_mjl_contributor_entity'=>'entity>0'),
			'characters'=>array('user_name_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','role_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci'),
		),
		'review_decision'=>array(
			'collation'=>'utf8mb4_uca1400_ai_ci',
			'columns'=>array('rowid'=>'bigint(20)|NO||auto_increment|','entity'=>'int(11)|NO|||','fk_activity'=>'int(11)|NO|||','fk_revision'=>'bigint(20)|NO|||','stage'=>'varchar(16)|NO|||','decision_type'=>'varchar(32)|NO|||','fk_actor'=>'int(11)|NO|||','actor_name_snapshot'=>'varchar(255)|NO|||','actor_role_snapshot'=>'varchar(40)|NO|||','reason'=>'text|YES|NULL||','requested_amount'=>'bigint(20)|YES|NULL||','fk_prevalidation_decision'=>'bigint(20)|YES|NULL||','state_before'=>'varchar(40)|NO|||','state_after'=>'varchar(40)|NO|||','date_decision'=>'datetime|NO|||'),
			'indexes'=>array('PRIMARY'=>'U|BTREE|A:0:rowid','uk_mjl_decision_revision_stage'=>'U|BTREE|A:0:entity,A:0:fk_revision,A:0:stage','idx_mjl_decision_activity'=>'N|BTREE|A:0:entity,A:0:fk_activity','fk_mjl_decision_revision'=>'N|BTREE|A:0:entity,A:0:fk_revision,A:0:fk_activity','fk_mjl_decision_actor'=>'N|BTREE|A:0:fk_actor','fk_mjl_decision_prevalidation'=>'N|BTREE|A:0:fk_prevalidation_decision'),
			'fks'=>array('fk_mjl_decision_revision'=>'entity,fk_revision,fk_activity>'.$p.'mjlfinancement_activity_revision:entity,rowid,fk_activity|RESTRICT|RESTRICT','fk_mjl_decision_actor'=>'fk_actor>'.$p.'user:rowid|RESTRICT|RESTRICT','fk_mjl_decision_prevalidation'=>'fk_prevalidation_decision>'.$p.'mjlfinancement_review_decision:rowid|RESTRICT|RESTRICT'),
			'checks'=>array('chk_mjl_decision_entity'=>'entity>0','chk_mjl_decision_stage'=>"stagein('SUPERVISOR','VALIDATOR')",'chk_mjl_decision_type'=>"decision_typein('PREVALIDATED','RETURNED_SUPERVISOR','FINAL_VALIDATED','RETURNED_VALIDATOR')",'chk_mjl_decision_shape'=>"stage='SUPERVISOR'anddecision_typein('PREVALIDATED','RETURNED_SUPERVISOR')orstage='VALIDATOR'anddecision_typein('FINAL_VALIDATED','RETURNED_VALIDATOR')",'chk_mjl_decision_reason'=>"decision_typein('RETURNED_SUPERVISOR','RETURNED_VALIDATOR')andreasonregexp'[^[:space:]]'ordecision_typein('PREVALIDATED','FINAL_VALIDATED')andreasonisnull",'chk_mjl_decision_requested'=>"decision_type='RETURNED_VALIDATOR'and(requested_amountisnullorrequested_amount>0)ordecision_type<>'RETURNED_VALIDATOR'andrequested_amountisnull"),
			'characters'=>array('stage'=>'utf8mb4|utf8mb4_uca1400_ai_ci','decision_type'=>'utf8mb4|utf8mb4_uca1400_ai_ci','actor_name_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','actor_role_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','reason'=>'utf8mb4|utf8mb4_uca1400_ai_ci','state_before'=>'utf8mb4|utf8mb4_uca1400_ai_ci','state_after'=>'utf8mb4|utf8mb4_uca1400_ai_ci'),
		),
	);
}

function mjl_rst006a_exact_subset(array $actual, array $expected, array $required = array())
{
	foreach ($actual as $name => $definition) if (!array_key_exists($name, $expected) || $expected[$name] !== $definition) return false;
	foreach ($required as $name) if (!array_key_exists($name, $actual)) return false;
	return true;
}

function mjl_rst006a_base_indexes($suffix)
{
	$indexes = array(
		'activity'=>array_keys(mjl_rst005_index_contract(RST002B_ACTIVITY_SCHEMA)),
		'activity_reference_sequence'=>array('PRIMARY'),
		'operation'=>array('PRIMARY','uk_mjl_operation_entity_rowid','idx_mjl_operation_activity','idx_mjl_operation_type'),
		'activity_revision'=>array('PRIMARY','uk_mjl_revision_entity_rowid_activity','uk_mjl_revision_number'),
		'revision_contributor'=>array('PRIMARY','uk_mjl_revision_contributor','idx_mjl_contributor_activity'),
		'review_decision'=>array('PRIMARY','uk_mjl_decision_revision_stage','idx_mjl_decision_activity'),
	);
	return isset($indexes[$suffix]) ? $indexes[$suffix] : array();
}

function mjl_rst006a_activity_prefix_checks_valid(array $actual, array $target)
{
	$predecessor=mjl_rst005_check_contract(RST002B_ACTIVITY_SCHEMA);
	foreach($predecessor as$name=>$expression)$predecessor[$name]=mjl_rst005_normalize_definition($expression);
	$allowed=$target;
	foreach($target as$name=>$expression)$allowed[$name]=array(mjl_rst005_normalize_definition($expression));
	foreach($predecessor as$name=>$expression){if(!isset($allowed[$name]))$allowed[$name]=array();$allowed[$name][]=$expression;}
	foreach($actual as$name=>$expression)if(!isset($allowed[$name])||!in_array($expression,$allowed[$name],true))return false;
	foreach($predecessor as$name=>$expression)if(!in_array($name,array('chk_mjl_activity_validation_status','chk_mjl_activity_rst005_dormant'),true)&&(!isset($actual[$name])||$actual[$name]!==$expression))return false;
	return true;
}

function mjl_rst006a_require_new_table_contract(DoliDB $db, $suffix, array $expected, $tableOverride = '', $allowKeyPrefix = false)
{
	$table = $tableOverride !== '' ? $tableOverride : mjl_rst006a_table($db,$suffix);
	$res = $db->query("SELECT ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND TABLE_TYPE='BASE TABLE'");
	$options = $res ? $db->fetch_object($res) : null;
	if (!$options || $options->ENGINE !== 'InnoDB' || $options->TABLE_COLLATION !== $expected['collation']) throw new RuntimeException($suffix.' table options mismatch.');
	$columns=array();$characters=array();$res=$db->query("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,GENERATION_EXPRESSION,CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY ORDINAL_POSITION");if(!$res)throw new RuntimeException($suffix.' column inspection failed.');while($row=$db->fetch_array($res)){$default=$row['COLUMN_DEFAULT'];if($default===null)$default=$row['IS_NULLABLE']==='YES'?'NULL':'';$columns[$row['COLUMN_NAME']]=strtolower($row['COLUMN_TYPE']).'|'.$row['IS_NULLABLE'].'|'.$default.'|'.strtolower($row['EXTRA']).'|'.mjl_rst005_normalize_definition($row['GENERATION_EXPRESSION']);if($row['CHARACTER_SET_NAME']!==null)$characters[$row['COLUMN_NAME']]=$row['CHARACTER_SET_NAME'].'|'.$row['COLLATION_NAME'];}if(array_keys($columns)!==array_keys($expected['columns'])||!mjl_rst005_map_equal($columns,$expected['columns']))throw new RuntimeException($suffix.' column contract mismatch: '.mjl_rst005_map_mismatch($columns,$expected['columns']));if(!mjl_rst005_map_equal($characters,$expected['characters']))throw new RuntimeException($suffix.' character contract mismatch.');
	$groups=array();$res=$db->query("SELECT INDEX_NAME,NON_UNIQUE,INDEX_TYPE,COLUMN_NAME,COLLATION,COALESCE(SUB_PART,0) SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' ORDER BY INDEX_NAME,SEQ_IN_INDEX");if(!$res)throw new RuntimeException($suffix.' index inspection failed.');while($row=$db->fetch_array($res)){$name=$row['INDEX_NAME'];if(!isset($groups[$name]))$groups[$name]=array('unique'=>(int)$row['NON_UNIQUE']===0,'type'=>$row['INDEX_TYPE'],'columns'=>array());$groups[$name]['columns'][]=$row['COLLATION'].':'.$row['SUB_PART'].':'.$row['COLUMN_NAME'];}$indexes=array();foreach($groups as$name=>$definition)$indexes[$name]=($definition['unique']?'U':'N').'|'.$definition['type'].'|'.implode(',',$definition['columns']);if($allowKeyPrefix?!mjl_rst006a_exact_subset($indexes,$expected['indexes'],mjl_rst006a_base_indexes($suffix)):!mjl_rst005_map_equal($indexes,$expected['indexes']))throw new RuntimeException($suffix.' index contract mismatch: '.mjl_rst005_map_mismatch($indexes,$expected['indexes']));
	$fkGroups=array();$res=$db->query("SELECT k.CONSTRAINT_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.UPDATE_RULE,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.TABLE_NAME='".$db->escape($table)."' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.CONSTRAINT_NAME,k.ORDINAL_POSITION");if(!$res)throw new RuntimeException($suffix.' foreign-key inspection failed.');while($row=$db->fetch_array($res)){$name=$row['CONSTRAINT_NAME'];if(!isset($fkGroups[$name]))$fkGroups[$name]=array('columns'=>array(),'target'=>$row['REFERENCED_TABLE_NAME'],'target_columns'=>array(),'update'=>$row['UPDATE_RULE'],'delete'=>$row['DELETE_RULE']);$fkGroups[$name]['columns'][]=$row['COLUMN_NAME'];$fkGroups[$name]['target_columns'][]=$row['REFERENCED_COLUMN_NAME'];}$fks=array();foreach($fkGroups as$name=>$definition)$fks[$name]=implode(',',$definition['columns']).'>'.$definition['target'].':'.implode(',',$definition['target_columns']).'|'.$definition['update'].'|'.$definition['delete'];$requiredFks=$allowKeyPrefix&&$suffix==='activity'?array_keys(mjl_rst005_fk_contract(RST002B_ACTIVITY_SCHEMA,$db->prefix())):array();if($allowKeyPrefix?!mjl_rst006a_exact_subset($fks,$expected['fks'],$requiredFks):!mjl_rst005_map_equal($fks,$expected['fks']))throw new RuntimeException($suffix.' foreign-key contract mismatch: '.mjl_rst005_map_mismatch($fks,$expected['fks']));
	$checks=array();$res=$db->query("SELECT tc.CONSTRAINT_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc INNER JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME='".$db->escape($table)."' AND tc.CONSTRAINT_TYPE='CHECK' ORDER BY tc.CONSTRAINT_NAME");if(!$res)throw new RuntimeException($suffix.' check inspection failed.');while($row=$db->fetch_array($res))$checks[$row['CONSTRAINT_NAME']]=mjl_rst005_normalize_definition($row['CHECK_CLAUSE']);if($allowKeyPrefix&&$suffix==='activity'){$checksValid=mjl_rst006a_activity_prefix_checks_valid($checks,$expected['checks']);}else{foreach($expected['checks']as$name=>$expression)$expected['checks'][$name]=mjl_rst005_normalize_definition($expression);$checksValid=mjl_rst005_map_equal($checks,$expected['checks']);}if(!$checksValid)throw new RuntimeException($suffix.' check contract mismatch: '.mjl_rst005_map_mismatch($checks,$expected['checks']));
}

function mjl_rst006a_activity_contract(DoliDB $db)
{
	$p=$db->prefix();$columns=array();foreach(mjl_rst005_column_contract(RST002B_ACTIVITY_SCHEMA)as$name=>$definition){$columns[$name]=$definition;if($name==='latest_validated_amount')$columns['fk_current_revision']='bigint(20)|YES|NULL||';}
	$indexes=mjl_rst005_index_contract(RST002B_ACTIVITY_SCHEMA);$indexes['uk_mjl_activity_entity_rowid']='U|BTREE|A:0:entity,A:0:rowid';$indexes['idx_mjl_activity_current_revision']='N|BTREE|A:0:entity,A:0:fk_current_revision,A:0:rowid';
	$fks=mjl_rst005_fk_contract(RST002B_ACTIVITY_SCHEMA,$p);$fks['fk_mjl_activity_current_revision']='entity,fk_current_revision,rowid>'.$p.'mjlfinancement_activity_revision:entity,rowid,fk_activity|RESTRICT|RESTRICT';
	$checks=mjl_rst005_check_contract(RST002B_ACTIVITY_SCHEMA);unset($checks['chk_mjl_activity_rst005_dormant']);$checks['chk_mjl_activity_validation_status']="validation_statusin('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED')";$checks['chk_mjl_activity_rst006a_phase2']="validation_statusin('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED')andis_cancelled=0and(validation_statusin('DRAFT','ABANDONED')andfk_current_revisionisnullandfirst_submitted_amountisnullandlatest_validated_amountisnullorvalidation_statusin('SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR')andfk_current_revisionisnotnullandfirst_submitted_amount>0andlatest_validated_amountisnullorvalidation_status='FINAL_VALIDATED'andfk_current_revisionisnotnullandfirst_submitted_amount>0andlatest_validated_amount>0)";
	return array('collation'=>'utf8mb4_uca1400_ai_ci','columns'=>$columns,'indexes'=>$indexes,'fks'=>$fks,'checks'=>$checks,'characters'=>array('ref'=>'utf8mb4|utf8mb4_uca1400_ai_ci','name'=>'utf8mb4|utf8mb4_uca1400_ai_ci','description'=>'utf8mb4|utf8mb4_uca1400_ai_ci','validation_status'=>'utf8mb4|utf8mb4_uca1400_ai_ci'));
}

function mjl_rst006a_require_activity_contract(DoliDB $db)
{
	mjl_rst006a_require_new_table_contract($db,'activity',mjl_rst006a_activity_contract($db),$db->prefix().'mjlfinancement_activity');
}

function mjl_rst006a_require_trigger_contract(DoliDB $db)
{
	$p=$db->prefix();$tables=array($p.'mjlfinancement_activity',$p.'mjlfinancement_activity_assignment');foreach(mjl_rst006a_suffixes()as$suffix)$tables[]=mjl_rst006a_table($db,$suffix);$expected=array_fill_keys($tables,array());
	$statements=mjl_rst006a_guard_statements($db);
	$statements[]='CREATE TRIGGER '.$p."mjl_activity_rst005_bd BEFORE DELETE ON {$p}mjlfinancement_activity FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity deletion is dormant in RST-005'";
	foreach(mjl_rst002b_assignment_trigger_statements($db)as$sql)if(strpos($sql,' BEFORE INSERT ')===false)$statements[]=$sql;
	foreach($statements as$sql){$clean=str_replace('`','',$sql);if(!preg_match('/^CREATE(?: OR REPLACE)? TRIGGER ([A-Za-z][A-Za-z0-9_]*) (BEFORE (?:INSERT|UPDATE|DELETE)) ON ([A-Za-z][A-Za-z0-9_]*) FOR EACH ROW (.*)$/s',$clean,$match))continue;if(isset($expected[$match[3]]))$expected[$match[3]][$match[1]]=$match[2].':'.mjl_rst005_normalize_definition($match[4]);}
	foreach($expected as$table=>$triggers)if(!mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db,$table),$triggers))throw new RuntimeException('RST-006A trigger contract mismatch for '.$table.'.');
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
		try { mjl_rst006a_require_new_table_contract($db,$suffix,mjl_rst006a_new_table_contracts($db)[$suffix],'',true); }
		catch (Throwable $exception) { return false; }
	}
	$expectedKeys = array('operation'=>5,'activity_revision'=>2,'revision_contributor'=>2,'review_decision'=>3);
	$keyGap = false;
	foreach ($expectedKeys as $suffix=>$expected) {
		$table = mjl_rst006a_table($db, $suffix);
		if (!mjl_rst002b_table_exists($db, $table)) continue;
		$actual=array();$res=$db->query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND CONSTRAINT_TYPE='FOREIGN KEY' ORDER BY CONSTRAINT_NAME");if(!$res)return false;while($row=$db->fetch_object($res))$actual[]=(string)$row->CONSTRAINT_NAME;
		$expectedNames=mjl_rst006a_key_names($db,$suffix);$prefix=array_slice($expectedNames,0,count($actual));sort($actual,SORT_STRING);sort($prefix,SORT_STRING);
		if (count($actual)>$expected || $actual!==$prefix || ($keyGap && count($actual)>0)) return false;
		if (count($actual)<$expected) $keyGap=true;
	}
	try { mjl_rst002b_require_assignment_contract($db,$db->prefix().'mjlfinancement_activity_assignment','ignore'); }
	catch (Throwable $exception) { return false; }
	$pointer = mjl_rst002b_column_exists($db, $db->prefix().'mjlfinancement_activity', 'fk_current_revision');
	if (!$pointer) {
		try {
			mjl_rst005_schema_contract($db,$db->prefix().'mjlfinancement_activity',RST002B_ACTIVITY_SCHEMA);
		}
		catch (Throwable $exception) { return false; }
	}
	if ($pointer) {
		try { mjl_rst006a_require_new_table_contract($db,'activity',mjl_rst006a_activity_contract($db),$db->prefix().'mjlfinancement_activity',true); }
		catch (Throwable $exception) { return false; }
	}
	if ($pointer) foreach ($expectedKeys as $suffix=>$expected) {
		$table = mjl_rst006a_table($db, $suffix);
		$count = (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND CONSTRAINT_TYPE='FOREIGN KEY'");
		if ($count !== $expected) return false;
	}
	return mjl_rst006a_prefix_triggers_valid($db);
}

function mjl_rst006a_prefix_triggers_valid(DoliDB $db)
{
	$p=$db->prefix();
	$sqlStatements=mjl_rst006a_guard_statements($db);
	$sqlStatements[]=mjl_rst005_insert_trigger_sql($p,$p.'mjlfinancement_activity');
	$sqlStatements[]=mjl_rst002b_activity_update_trigger_sql($db);
	$sqlStatements[]='CREATE TRIGGER '.$p."mjl_activity_rst005_bd BEFORE DELETE ON {$p}mjlfinancement_activity FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity deletion is dormant in RST-005'";
	foreach(mjl_rst002b_assignment_trigger_statements($db)as$sql)$sqlStatements[]=$sql;
	$allowed=array();
	foreach($sqlStatements as$sql){
		$clean=str_replace('`','',$sql);
		if(!preg_match('/^CREATE(?: OR REPLACE)? TRIGGER ([A-Za-z][A-Za-z0-9_]*) (BEFORE (?:INSERT|UPDATE|DELETE)) ON ([A-Za-z][A-Za-z0-9_]*) FOR EACH ROW (.*)$/s',$clean,$match))continue;
		$allowed[$match[3]][$match[1]][]=$match[2].':'.mjl_rst005_normalize_definition($match[4]);
	}
	foreach($allowed as$table=>$definitions){
		try{$actual=mjl_rst002b_actual_trigger_map($db,$table);}catch(Throwable$exception){return false;}
		foreach($actual as$name=>$definition)if(!isset($definitions[$name])||!in_array($definition,$definitions[$name],true))return false;
	}
	$retained=array(
		'CREATE TRIGGER '.$p."mjl_activity_rst005_bd BEFORE DELETE ON {$p}mjlfinancement_activity FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity deletion is dormant in RST-005'",
	);
	foreach(mjl_rst002b_assignment_trigger_statements($db)as$sql)if(strpos($sql,' BEFORE INSERT ')===false)$retained[]=$sql;
	foreach($retained as$sql)if(!mjl_rst006a_trigger_equals($db,$sql))return false;
	return true;
}

function mjl_rst006a_sql_statements(DoliDB $db, $path)
{
	$sql=file_get_contents($path);if($sql===false)throw new RuntimeException('Unable to read schema file.');$sql=str_replace('llx_',$db->prefix(),$sql);$statements=array();foreach(preg_split('/;\s*(?:\r?\n|$)/',$sql)as$statement)if(trim($statement)!=='')$statements[]=trim($statement);return $statements;
}

function mjl_rst006a_key_names(DoliDB $db, $suffix)
{
	$path=dirname(__DIR__).'/sql/llx_mjlfinancement_'.$suffix.'.key.sql';$names=array();foreach(mjl_rst006a_sql_statements($db,$path)as$sql){if(!preg_match('/ ADD CONSTRAINT ([A-Za-z][A-Za-z0-9_]*) FOREIGN KEY /',$sql,$match))throw new RuntimeException('Unable to parse RST-006A key statement.');$names[]=$match[1];}return $names;
}

function mjl_rst006a_forward_prefix(DoliDB $db)
{
	$state=mjl_rst006a_detect_schema($db);
	if($state===RST006A_SCHEMA_PREDECESSOR)return 'forward-000';
	if($state===RST006A_SCHEMA_TARGET)return 'forward-043';
	if($state!==RST006A_SCHEMA_PARTIAL||!mjl_rst006a_is_known_prefix($db))return null;
	$steps=array();
	foreach(mjl_rst006a_suffixes()as$suffix)$steps[]=mjl_rst002b_table_exists($db,mjl_rst006a_table($db,$suffix));
	foreach(array('operation','activity_revision','revision_contributor','review_decision')as$suffix){$table=mjl_rst006a_table($db,$suffix);foreach(mjl_rst006a_key_names($db,$suffix)as$name)$steps[]=mjl_rst006a_object_exists($db,'constraint',$table,$name);}
	$newTables=array_fill_keys(array_map(function($suffix)use($db){return mjl_rst006a_table($db,$suffix);},array('operation','activity_revision','revision_contributor','review_decision')),true);
	foreach(mjl_rst006a_guard_statements($db)as$sql)if(preg_match('/^CREATE TRIGGER ([^ ]+) BEFORE (?:INSERT|UPDATE|DELETE) ON ([^ ]+)/',$sql,$match)&&isset($newTables[$match[2]]))$steps[]=mjl_rst006a_trigger_equals($db,$sql);
	$activity=$db->prefix().'mjlfinancement_activity';
	$steps[]=mjl_rst006a_object_exists($db,'column',$activity,'fk_current_revision');
	$steps[]=mjl_rst006a_object_exists($db,'index',$activity,'uk_mjl_activity_entity_rowid');
	$steps[]=mjl_rst006a_object_exists($db,'index',$activity,'idx_mjl_activity_current_revision');
	$steps[]=mjl_rst006a_object_exists($db,'constraint',$activity,'fk_mjl_activity_current_revision');
	$steps[]=!mjl_rst006a_object_exists($db,'constraint',$activity,'chk_mjl_activity_rst005_dormant');
	$targetStatus="validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED')";
	$predecessorStatus="validation_status IN ('DRAFT','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED')";
	$steps[]=!mjl_rst006a_check_equals($db,$activity,'chk_mjl_activity_validation_status',$predecessorStatus);
	$steps[]=mjl_rst006a_check_equals($db,$activity,'chk_mjl_activity_validation_status',$targetStatus);
	$steps[]=mjl_rst006a_object_exists($db,'constraint',$activity,'chk_mjl_activity_rst006a_phase2');
	$predecessors=array(mjl_rst005_insert_trigger_sql($db->prefix(),$activity),mjl_rst002b_activity_update_trigger_sql($db));
	foreach(mjl_rst002b_assignment_trigger_statements($db)as$sql)if(strpos($sql,' BEFORE INSERT ')!==false)$predecessors[]=$sql;
	foreach($predecessors as$sql)$steps[]=!mjl_rst006a_trigger_equals($db,$sql);
	foreach(mjl_rst006a_guard_statements($db)as$sql)if(preg_match('/^CREATE TRIGGER [^ ]+ BEFORE (?:INSERT|UPDATE|DELETE) ON ([^ ]+)/',$sql,$match)&&in_array($match[1],array($activity,$db->prefix().'mjlfinancement_activity_assignment'),true))$steps[]=mjl_rst006a_trigger_equals($db,$sql);
	$completed=0;$gap=false;
	foreach($steps as$done){if($done){if($gap)return null;$completed++;}else$gap=true;}
	return 'forward-'.str_pad((string)$completed,3,'0',STR_PAD_LEFT);
}

function mjl_rst006a_detect_schema(DoliDB $db)
{
	$present = 0;
	foreach (mjl_rst006a_suffixes() as $suffix) if (mjl_rst002b_table_exists($db, mjl_rst006a_table($db, $suffix))) $present++;
	$pointer = mjl_rst002b_column_exists($db, $db->prefix().'mjlfinancement_activity', 'fk_current_revision');
	if ($present === 0 && !$pointer) return mjl_rst002b_detect_schema($db) === RST002B_SCHEMA_TARGET ? RST006A_SCHEMA_PREDECESSOR : RST006A_SCHEMA_UNKNOWN;
	if ($present !== count(mjl_rst006a_suffixes()) || !$pointer) return RST006A_SCHEMA_PARTIAL;
	if (!mjl_rst006a_is_known_prefix($db)) return RST006A_SCHEMA_PARTIAL;
	try {
		foreach (mjl_rst006a_new_table_contracts($db) as $suffix=>$contract) mjl_rst006a_require_new_table_contract($db,$suffix,$contract);
		mjl_rst006a_require_activity_contract($db);
		mjl_rst002b_require_assignment_contract($db,$db->prefix().'mjlfinancement_activity_assignment','ignore');
		mjl_rst006a_require_trigger_contract($db);
	} catch (Throwable $exception) {
		$GLOBALS['rst006a_state_error']=$exception->getMessage();
		return RST006A_SCHEMA_PARTIAL;
	}
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
	foreach (mjl_rst006a_sql_statements($db,$path) as $statement) mjl_rst006a_checked_ddl($db, $statement, 'sql-'.basename($path));
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
	mjl_rst006a_install_new_table_guards($db);
	mjl_rst006a_install_activation_guards($db);
}

function mjl_rst006a_install_new_table_guards(DoliDB $db)
{
	$newTables = array_fill_keys(array_map(function ($suffix) use ($db) { return mjl_rst006a_table($db,$suffix); }, array('operation','activity_revision','revision_contributor','review_decision')), true);
	foreach (mjl_rst006a_guard_statements($db) as $sql) if (preg_match('/^CREATE TRIGGER ([^ ]+) BEFORE (?:INSERT|UPDATE|DELETE) ON ([^ ]+)/', $sql, $match) && isset($newTables[$match[2]])) {
		if (!mjl_rst006a_object_exists($db,'trigger',$match[2],$match[1])) mjl_rst006a_checked_ddl($db, $sql, 'install-'.$match[1]);
	}
}

function mjl_rst006a_install_activation_guards(DoliDB $db)
{
	$p = $db->prefix();
	$activity = $p.'mjlfinancement_activity';
	$assignment = $p.'mjlfinancement_activity_assignment';
	foreach (array($p.'mjl_activity_rst005_bi',$p.'mjl_activity_rst002b_bu',$p.'mjl_activity_assignment_bi') as $name) mjl_rst006a_checked_ddl($db, 'DROP TRIGGER IF EXISTS '.$name, 'replace-'.$name);
	foreach (mjl_rst006a_guard_statements($db) as $sql) {
		if (!preg_match('/^CREATE TRIGGER ([^ ]+) BEFORE (?:INSERT|UPDATE|DELETE) ON ([^ ]+)/', $sql, $match)) continue;
		if (!in_array($match[2], array($activity,$assignment), true)) continue;
		if (!mjl_rst006a_object_exists($db,'trigger',$match[2],$match[1])) mjl_rst006a_checked_ddl($db, $sql, 'install-'.$match[1]);
	}
}

function mjl_rst006a_install_target(DoliDB $db, $failurePoint = '')
{
	mjl_rst006a_begin_ddl_sequence('forward',$failurePoint);
	$state = mjl_rst006a_detect_schema($db);
	if ($state === RST006A_SCHEMA_TARGET) return;
	if ($state !== RST006A_SCHEMA_PREDECESSOR && ($state !== RST006A_SCHEMA_PARTIAL || mjl_rst006a_forward_prefix($db) === null)) throw new RuntimeException('RST-006A unknown predecessor state.');
	$base = dirname(__DIR__).'/sql/';
	foreach (mjl_rst006a_suffixes() as $suffix) {
		$table = mjl_rst006a_table($db, $suffix);
		if (!mjl_rst002b_table_exists($db, $table)) mjl_rst006a_load_sql_file($db, $base.'llx_mjlfinancement_'.$suffix.'.sql');
		if ($failurePoint === $suffix) throw new RuntimeException('Injected interruption after '.$suffix.'.');
	}
	$keyFiles = array('operation','activity_revision','revision_contributor','review_decision');
	foreach ($keyFiles as $suffix) {
		$table = mjl_rst006a_table($db, $suffix);
		foreach(mjl_rst006a_sql_statements($db,$base.'llx_mjlfinancement_'.$suffix.'.key.sql')as$sql){if(!preg_match('/ ADD CONSTRAINT ([A-Za-z][A-Za-z0-9_]*) FOREIGN KEY /',$sql,$match))throw new RuntimeException('Unable to parse RST-006A key statement.');if(!mjl_rst006a_object_exists($db,'constraint',$table,$match[1]))mjl_rst006a_checked_ddl($db,$sql,'add-'.$match[1]);}
		if ($failurePoint === $suffix.'-keys') throw new RuntimeException('Injected interruption after '.$suffix.' keys.');
	}
	mjl_rst006a_install_new_table_guards($db);
	if ($failurePoint === 'new-table-guards') throw new RuntimeException('Injected interruption after new-table guards.');
	$activity = $db->prefix().'mjlfinancement_activity';
	if (!mjl_rst002b_column_exists($db, $activity, 'fk_current_revision')) {
		mjl_rst006a_checked_ddl($db, 'ALTER TABLE '.$activity.' ADD fk_current_revision BIGINT(20) DEFAULT NULL AFTER latest_validated_amount', 'add-current-revision-column');
	}
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND INDEX_NAME='uk_mjl_activity_entity_rowid'") === 0
		) mjl_rst006a_checked_ddl($db, 'ALTER TABLE '.$activity.' ADD UNIQUE INDEX uk_mjl_activity_entity_rowid (entity,rowid)', 'add-activity-composite-index');
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND INDEX_NAME='idx_mjl_activity_current_revision'") === 0
		) mjl_rst006a_checked_ddl($db, 'ALTER TABLE '.$activity.' ADD INDEX idx_mjl_activity_current_revision (entity,fk_current_revision,rowid)', 'add-current-revision-index');
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND CONSTRAINT_NAME='fk_mjl_activity_current_revision'") === 0
		) mjl_rst006a_checked_ddl($db, 'ALTER TABLE '.$activity.' ADD CONSTRAINT fk_mjl_activity_current_revision FOREIGN KEY (entity,fk_current_revision,rowid) REFERENCES '.$db->prefix().'mjlfinancement_activity_revision(entity,rowid,fk_activity) ON UPDATE RESTRICT ON DELETE RESTRICT', 'add-current-revision-fk');
	if ($failurePoint === 'activity-pointer') throw new RuntimeException('Injected interruption after Activity pointer.');
	if (mjl_rst006a_object_exists($db,'constraint',$activity,'chk_mjl_activity_rst005_dormant')) mjl_rst006a_checked_ddl($db, 'ALTER TABLE '.$activity.' DROP CONSTRAINT chk_mjl_activity_rst005_dormant', 'drop-predecessor-dormant-check');
	if (mjl_rst006a_object_exists($db,'constraint',$activity,'chk_mjl_activity_validation_status') && !mjl_rst006a_check_equals($db,$activity,'chk_mjl_activity_validation_status',"validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED')")) mjl_rst006a_checked_ddl($db, 'ALTER TABLE '.$activity.' DROP CONSTRAINT chk_mjl_activity_validation_status', 'drop-predecessor-status-check');
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND CONSTRAINT_NAME='chk_mjl_activity_validation_status'") === 0
		) mjl_rst006a_checked_ddl($db, "ALTER TABLE $activity ADD CONSTRAINT chk_mjl_activity_validation_status CHECK (validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED'))", 'add-phase2-status-check');
	if ((int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($activity)."' AND CONSTRAINT_NAME='chk_mjl_activity_rst006a_phase2'") === 0) {
		$check = "validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED') AND is_cancelled=0 AND ((validation_status IN ('DRAFT','ABANDONED') AND fk_current_revision IS NULL AND first_submitted_amount IS NULL AND latest_validated_amount IS NULL) OR (validation_status IN ('SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR') AND fk_current_revision IS NOT NULL AND first_submitted_amount>0 AND latest_validated_amount IS NULL) OR (validation_status='FINAL_VALIDATED' AND fk_current_revision IS NOT NULL AND first_submitted_amount>0 AND latest_validated_amount>0))";
		mjl_rst006a_checked_ddl($db, 'ALTER TABLE '.$activity.' ADD CONSTRAINT chk_mjl_activity_rst006a_phase2 CHECK ('.$check.')', 'add-phase2-shape-check');
	}
	mjl_rst006a_install_activation_guards($db);
	if ($failurePoint === 'activation-guards') throw new RuntimeException('Injected interruption after activation guards.');
	if (mjl_rst006a_detect_schema($db) !== RST006A_SCHEMA_TARGET) throw new RuntimeException('RST-006A target verification failed'.(empty($GLOBALS['rst006a_state_error'])?'':': '.$GLOBALS['rst006a_state_error']).'.');
}

function mjl_rst006a_object_exists(DoliDB $db, $kind, $table, $name)
{
	if ($kind === 'table') return mjl_rst002b_table_exists($db, $table);
	$sources = array(
		'trigger'=>array('TRIGGERS','TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME'),
		'index'=>array('STATISTICS',"TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND INDEX_NAME"),
		'constraint'=>array('TABLE_CONSTRAINTS',"CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND CONSTRAINT_NAME"),
		'column'=>array('COLUMNS',"TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND COLUMN_NAME"),
	);
	if (!isset($sources[$kind])) throw new InvalidArgumentException('Unknown RST-006A object kind.');
	return (int) mjl_rst005_scalar($db, 'SELECT COUNT(*) FROM information_schema.'.$sources[$kind][0].' WHERE '.$sources[$kind][1]."='".$db->escape($name)."'") > 0;
}

function mjl_rst006a_checked_ddl(DoliDB $db, $sql, $label)
{
	if (!$db->query($sql)) throw new RuntimeException('Unable to execute RST-006A DDL '.$label.': '.$db->lasterror());
	if (!isset($GLOBALS['rst006a_ddl_sequence'])) return;
	$GLOBALS['rst006a_ddl_sequence']['position']++;
	$point=$GLOBALS['rst006a_ddl_sequence']['direction'].'-'.str_pad((string)$GLOBALS['rst006a_ddl_sequence']['position'],3,'0',STR_PAD_LEFT);
	if ($GLOBALS['rst006a_ddl_sequence']['failure']===$point) throw new RuntimeException('Injected interruption after '.$point.'.');
}

function mjl_rst006a_begin_ddl_sequence($direction,$failurePoint)
{
	$GLOBALS['rst006a_ddl_sequence']=array('direction'=>$direction,'failure'=>(string)$failurePoint,'position'=>0);
}

function mjl_rst006a_check_equals(DoliDB $db, $table, $name, $expression)
{
	$sql = "SELECT cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc INNER JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME='".$db->escape($table)."' AND tc.CONSTRAINT_NAME='".$db->escape($name)."' AND tc.CONSTRAINT_TYPE='CHECK'";
	$res = $db->query($sql);
	$row = $res ? $db->fetch_object($res) : null;
	return $row && mjl_rst005_normalize_definition($row->CHECK_CLAUSE) === mjl_rst005_normalize_definition($expression);
}

function mjl_rst006a_trigger_equals(DoliDB $db, $sql)
{
	$normalizedSql = str_replace('`', '', $sql);
	if (!preg_match('/^CREATE(?: OR REPLACE)? TRIGGER ([A-Za-z][A-Za-z0-9_]*) (BEFORE (?:INSERT|UPDATE|DELETE)) ON ([A-Za-z][A-Za-z0-9_]*) FOR EACH ROW (.*)$/s', $normalizedSql, $match)) return false;
	$actual = mjl_rst002b_actual_trigger_map($db, $match[3]);
	return isset($actual[$match[1]]) && $actual[$match[1]] === $match[2].':'.mjl_rst005_normalize_definition($match[4]);
}

function mjl_rst006a_target_trigger_sql(DoliDB $db, $name)
{
	foreach(mjl_rst006a_guard_statements($db)as$sql)if(preg_match('/^CREATE TRIGGER ([^ ]+)/',$sql,$match)&&$match[1]===$name)return $sql;
	throw new RuntimeException('Unknown RST-006A target trigger: '.$name.'.');
}

function mjl_rst006a_rollback_actions(DoliDB $db)
{
	$p = $db->prefix();
	$a = $p.'mjlfinancement_activity';
	$assignment = $p.'mjlfinancement_activity_assignment';
	$actions = array();
	$targetTriggers = array(
		array($a,'mjl_activity_rst006a_bi'), array($a,'mjl_activity_rst006a_bu'), array($assignment,'mjl_activity_assignment_bi'),
		array($p.'mjlfinancement_operation','mjl_operation_rst006a_bi'), array($p.'mjlfinancement_operation','mjl_operation_rst006a_bu'), array($p.'mjlfinancement_operation','mjl_operation_rst006a_bd'),
		array($p.'mjlfinancement_activity_revision','mjl_revision_rst006a_bi'), array($p.'mjlfinancement_activity_revision','mjl_revision_rst006a_bu'), array($p.'mjlfinancement_activity_revision','mjl_revision_rst006a_bd'),
		array($p.'mjlfinancement_revision_contributor','mjl_contributor_rst006a_bi'), array($p.'mjlfinancement_revision_contributor','mjl_contributor_rst006a_bu'), array($p.'mjlfinancement_revision_contributor','mjl_contributor_rst006a_bd'),
		array($p.'mjlfinancement_review_decision','mjl_decision_rst006a_bi'), array($p.'mjlfinancement_review_decision','mjl_decision_rst006a_bu'), array($p.'mjlfinancement_review_decision','mjl_decision_rst006a_bd'),
	);
	foreach ($targetTriggers as $entry) {
		$name = $p.$entry[1];
		$actions[] = array('drop-trigger-'.$entry[1], !mjl_rst006a_trigger_equals($db,mjl_rst006a_target_trigger_sql($db,$name)), 'DROP TRIGGER IF EXISTS '.$name);
	}
	$actions[] = array('drop-current-revision-fk', !mjl_rst006a_object_exists($db,'constraint',$a,'fk_mjl_activity_current_revision'), 'ALTER TABLE '.$a.' DROP FOREIGN KEY fk_mjl_activity_current_revision');
	$actions[] = array('drop-phase2-check', !mjl_rst006a_object_exists($db,'constraint',$a,'chk_mjl_activity_rst006a_phase2'), 'ALTER TABLE '.$a.' DROP CONSTRAINT chk_mjl_activity_rst006a_phase2');
	$actions[] = array('drop-current-revision-index', !mjl_rst006a_object_exists($db,'index',$a,'idx_mjl_activity_current_revision'), 'ALTER TABLE '.$a.' DROP INDEX idx_mjl_activity_current_revision');
	$actions[] = array('drop-activity-composite-index', !mjl_rst006a_object_exists($db,'index',$a,'uk_mjl_activity_entity_rowid'), 'ALTER TABLE '.$a.' DROP INDEX uk_mjl_activity_entity_rowid');
	$actions[] = array('drop-current-revision-column', !mjl_rst006a_object_exists($db,'column',$a,'fk_current_revision'), 'ALTER TABLE '.$a.' DROP COLUMN fk_current_revision');
	$targetStatus = "validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED')";
	$actions[] = array('drop-phase2-status-check', !mjl_rst006a_check_equals($db,$a,'chk_mjl_activity_validation_status',$targetStatus), 'ALTER TABLE '.$a.' DROP CONSTRAINT chk_mjl_activity_validation_status');
	$foreignKeys = array(
		'review_decision'=>array('fk_mjl_decision_prevalidation','fk_mjl_decision_revision','fk_mjl_decision_actor'),
		'revision_contributor'=>array('fk_mjl_contributor_revision','fk_mjl_contributor_user'),
		'activity_revision'=>array('fk_mjl_revision_activity','fk_mjl_revision_submitter'),
		'operation'=>array('fk_mjl_operation_activity','fk_mjl_operation_type','fk_mjl_operation_creator','fk_mjl_operation_modifier','fk_mjl_operation_remover'),
	);
	foreach ($foreignKeys as $suffix=>$names) foreach ($names as $name) {
		$table = mjl_rst006a_table($db,$suffix);
		$done = !mjl_rst002b_table_exists($db,$table) || !mjl_rst006a_object_exists($db,'constraint',$table,$name);
		$actions[] = array('drop-'.$name,$done,'ALTER TABLE '.$table.' DROP FOREIGN KEY '.$name);
	}
	foreach (array('review_decision','revision_contributor','activity_revision','operation','activity_reference_sequence') as $suffix) {
		$table = mjl_rst006a_table($db,$suffix);
		$actions[] = array('drop-table-'.$suffix,!mjl_rst002b_table_exists($db,$table),'DROP TABLE '.$table);
	}
	$predecessorStatus = "validation_status IN ('DRAFT','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED')";
	$actions[] = array('restore-predecessor-status-check', mjl_rst006a_check_equals($db,$a,'chk_mjl_activity_validation_status',$predecessorStatus), "ALTER TABLE $a ADD CONSTRAINT chk_mjl_activity_validation_status CHECK ($predecessorStatus)");
	$actions[] = array('restore-predecessor-dormant-check', mjl_rst006a_object_exists($db,'constraint',$a,'chk_mjl_activity_rst005_dormant'), "ALTER TABLE $a ADD CONSTRAINT chk_mjl_activity_rst005_dormant CHECK (validation_status='DRAFT' AND is_cancelled=0 AND first_submitted_amount IS NULL AND latest_validated_amount IS NULL)");
	$predecessorTriggers = array_merge(
		array(mjl_rst005_insert_trigger_sql($p, $a), mjl_rst002b_activity_update_trigger_sql($db)),
		array_values(array_filter(mjl_rst002b_assignment_trigger_statements($db), function ($sql) { return strpos($sql,' BEFORE INSERT ') !== false; }))
	);
	foreach ($predecessorTriggers as $sql) {
		if (!preg_match('/^CREATE(?: OR REPLACE)? TRIGGER ([A-Za-z][A-Za-z0-9_]*)/', str_replace('`','',$sql), $match)) throw new RuntimeException('Unable to parse predecessor trigger.');
		$actions[] = array('restore-'.$match[1],mjl_rst006a_trigger_equals($db,$sql),$sql);
	}
	return $actions;
}

function mjl_rst006a_is_known_rollback_prefix(DoliDB $db)
{
	try {
		$contracts=mjl_rst006a_new_table_contracts($db);
		foreach(mjl_rst006a_suffixes()as$suffix)if(mjl_rst002b_table_exists($db,mjl_rst006a_table($db,$suffix)))mjl_rst006a_require_new_table_contract($db,$suffix,$contracts[$suffix],'',true);
		mjl_rst002b_require_assignment_contract($db,$db->prefix().'mjlfinancement_activity_assignment','ignore');
		$activity=$db->prefix().'mjlfinancement_activity';$contract=mjl_rst006a_activity_contract($db);
		if(!mjl_rst006a_object_exists($db,'constraint',$activity,'fk_mjl_activity_current_revision'))unset($contract['fks']['fk_mjl_activity_current_revision']);
		if(!mjl_rst006a_object_exists($db,'constraint',$activity,'chk_mjl_activity_rst006a_phase2'))unset($contract['checks']['chk_mjl_activity_rst006a_phase2']);
		if(!mjl_rst006a_object_exists($db,'index',$activity,'idx_mjl_activity_current_revision'))unset($contract['indexes']['idx_mjl_activity_current_revision']);
		if(!mjl_rst006a_object_exists($db,'index',$activity,'uk_mjl_activity_entity_rowid'))unset($contract['indexes']['uk_mjl_activity_entity_rowid']);
		if(!mjl_rst002b_column_exists($db,$activity,'fk_current_revision'))unset($contract['columns']['fk_current_revision']);
		if(!mjl_rst006a_object_exists($db,'constraint',$activity,'chk_mjl_activity_validation_status'))unset($contract['checks']['chk_mjl_activity_validation_status']);
		elseif(mjl_rst006a_check_equals($db,$activity,'chk_mjl_activity_validation_status',"validation_status IN ('DRAFT','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED')"))$contract['checks']['chk_mjl_activity_validation_status']=mjl_rst005_check_contract(RST002B_ACTIVITY_SCHEMA)['chk_mjl_activity_validation_status'];
		if(mjl_rst006a_object_exists($db,'constraint',$activity,'chk_mjl_activity_rst005_dormant'))$contract['checks']['chk_mjl_activity_rst005_dormant']=mjl_rst005_check_contract(RST002B_ACTIVITY_SCHEMA)['chk_mjl_activity_rst005_dormant'];
		mjl_rst006a_require_new_table_contract($db,'activity-rollback',$contract,$activity,false);
	} catch(Throwable$exception){return false;}
	if(!mjl_rst006a_prefix_triggers_valid($db))return false;
	$seenPending = false;
	$completed = 0;
	foreach (mjl_rst006a_rollback_actions($db) as $action) {
		if ($action[1]) { if ($seenPending) return false; $completed++; }
		else $seenPending = true;
	}
	return $completed > 0;
}

function mjl_rst006a_rollback_target(DoliDB $db, $failurePoint = '')
{
	mjl_rst006a_begin_ddl_sequence('rollback',$failurePoint);
	$position = 0;
	foreach (mjl_rst006a_rollback_actions($db) as $action) {
		$position++;
		if ($action[1]) continue;
		if (!mjl_rst006a_is_known_rollback_prefix($db) && $position > 1) throw new RuntimeException('Unknown RST-006A rollback structural state.');
		mjl_rst006a_checked_ddl($db, $action[2], $action[0]);
		if ($failurePoint === $action[0] || $failurePoint === 'rollback-'.$position) throw new RuntimeException('Injected interruption after '.$action[0].'.');
	}
}

function mjl_rst006a_require_target(DoliDB $db)
{
	$state = mjl_rst006a_detect_schema($db);
	if ($state === RST006A_SCHEMA_PREDECESSOR) throw new RuntimeException('MIGRATION_REQUIRED');
	if ($state !== RST006A_SCHEMA_TARGET) throw new RuntimeException('RST-006A schema is incomplete or unknown.');
}
