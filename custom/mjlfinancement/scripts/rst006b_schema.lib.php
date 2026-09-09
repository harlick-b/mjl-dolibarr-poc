<?php

require_once __DIR__.'/rst006a_schema.lib.php';

const RST006B_SCHEMA_PREDECESSOR = 'RST-006A';
const RST006B_SCHEMA_TARGET = 'RST-006B';
const RST006B_SCHEMA_PARTIAL = 'PARTIAL';
const RST006B_SCHEMA_UNKNOWN = 'UNKNOWN';

function mjl_rst006b_failpoint($name)
{
	if(getenv('MJL_RST006B_FAILURE_INJECTION_ATTESTED')==='1'&&getenv('MJL_RST006B_FAIL_AFTER')===$name)throw new RuntimeException('Injected RST-006B interruption after '.$name.'.');
}

function mjl_rst006b_table(DoliDB $db, $suffix)
{
	return $db->prefix().'mjlfinancement_'.$suffix;
}

function mjl_rst006b_constraint_exists(DoliDB $db, $table, $name)
{
	return (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($table)."' AND CONSTRAINT_NAME='".$db->escape($name)."'") === 1;
}

function mjl_rst006b_trigger_exists(DoliDB $db, $name)
{
	return (int) mjl_rst005_scalar($db, "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='".$db->escape($name)."'") === 1;
}

function mjl_rst006b_request_checks(DoliDB $db)
{
	$p=$db->prefix();
	$terminal="status='PENDING' AND fk_reviewer IS NULL AND reviewer_name_snapshot IS NULL AND reviewer_role_snapshot IS NULL AND decision_reason IS NULL AND date_decision IS NULL AND date_withdrawal IS NULL OR status IN ('APPROVED','REJECTED') AND fk_reviewer IS NOT NULL AND reviewer_name_snapshot IS NOT NULL AND reviewer_name_snapshot REGEXP '[^[:space:]]' AND reviewer_role_snapshot='VALIDATEUR_DEFINITIF' AND decision_reason IS NOT NULL AND decision_reason REGEXP '[^[:space:]]' AND date_decision IS NOT NULL AND date_withdrawal IS NULL OR status='WITHDRAWN' AND fk_reviewer IS NULL AND reviewer_name_snapshot IS NULL AND reviewer_role_snapshot IS NULL AND decision_reason IS NULL AND date_decision IS NULL AND date_withdrawal IS NOT NULL";
	return array(
		array($p.'mjlfinancement_cancellation_request','chk_mjl_cancellation_target',"target_type='ACTIVITY' AND target_id=fk_activity AND fk_target_revision IS NOT NULL AND target_operation_set_hash IS NOT NULL AND target_operation_set_hash REGEXP '^[0-9a-f]{64}$' OR target_type='OPERATION' AND fk_target_revision IS NOT NULL AND target_operation_set_hash IS NULL"),
		array($p.'mjlfinancement_cancellation_request','chk_mjl_cancellation_state',$terminal),
		array($p.'mjlfinancement_reopening_request','chk_mjl_reopening_state',$terminal),
	);
}

function mjl_rst006b_table_contracts(DoliDB $db)
{
	$p=$db->prefix();$phase2=mjl_rst006a_new_table_contracts($db);
	$operation=$phase2['operation'];unset($operation['checks']['chk_mjl_operation_phase2']);
	$operation['checks']['chk_mjl_operation_execution_status']="status IN ('TODO','IN_PROGRESS','COMPLETED','CANCELLED')";
	$operation['checks']['chk_mjl_operation_spent_amount']='spent_amount IS NULL OR spent_amount >= 0';
	$operation['checks']['chk_mjl_operation_observation']="observation IS NULL OR observation REGEXP '[^[:space:]]'";
	$operation['checks']['chk_mjl_operation_execution_shape']="(spent_amount IS NULL OR spent_amount=authorized_amount OR observation IS NOT NULL AND observation REGEXP '[^[:space:]]') AND (status<>'COMPLETED' OR spent_amount IS NOT NULL)";
	$activity=mjl_rst006a_activity_contract($db);unset($activity['checks']['chk_mjl_activity_rst006a_phase2']);
	$activity['checks']['chk_mjl_activity_validation_status']="validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED')";
	$activity['checks']['chk_mjl_activity_rst006b_phase3a']=mjl_rst006b_activity_shape_check();
	$terminal=mjl_rst006b_request_checks($db);
	$checks=array();foreach($terminal as$item)$checks[$item[1]]=$item[2];
	$cancellation=array(
		'collation'=>'utf8mb4_uca1400_ai_ci',
		'columns'=>array('rowid'=>'bigint(20)|NO||auto_increment|','entity'=>'int(11)|NO|||','target_type'=>'varchar(16)|NO|||','target_id'=>'bigint(20)|NO|||','fk_activity'=>'int(11)|NO|||','fk_target_revision'=>'bigint(20)|YES|NULL||','target_version'=>'bigint(20)|NO|||','target_operation_set_hash'=>'char(64)|YES|NULL||','fk_requester'=>'int(11)|NO|||','requester_name_snapshot'=>'varchar(255)|NO|||','requester_role_snapshot'=>'varchar(32)|NO|||','reason'=>'text|NO|||','status'=>"varchar(16)|NO|'PENDING'||",'fk_reviewer'=>'int(11)|YES|NULL||','reviewer_name_snapshot'=>'varchar(255)|YES|NULL||','reviewer_role_snapshot'=>'varchar(32)|YES|NULL||','decision_reason'=>'text|YES|NULL||','date_request'=>'datetime|NO|||','date_decision'=>'datetime|YES|NULL||','date_withdrawal'=>'datetime|YES|NULL||','version'=>'bigint(20)|NO|1||','pending_target_key'=>"varchar(48)|YES|NULL|stored generated|casewhenstatus='PENDING'thenconcat(target_type,':',target_id)elsenullend",'tms'=>'timestamp|NO|current_timestamp()|on update current_timestamp()|'),
		'indexes'=>array('PRIMARY'=>'U|BTREE|A:0:rowid','uk_mjl_cancellation_entity_rowid'=>'U|BTREE|A:0:entity,A:0:rowid','uk_mjl_cancellation_pending'=>'U|BTREE|A:0:entity,A:0:pending_target_key','idx_mjl_cancellation_activity'=>'N|BTREE|A:0:entity,A:0:fk_activity,A:0:status,A:0:rowid','idx_mjl_cancellation_requester'=>'N|BTREE|A:0:fk_requester','idx_mjl_cancellation_reviewer'=>'N|BTREE|A:0:fk_reviewer','fk_mjl_cancellation_revision'=>'N|BTREE|A:0:entity,A:0:fk_target_revision,A:0:fk_activity'),
		'fks'=>array('fk_mjl_cancellation_activity'=>'entity,fk_activity>'.$p.'mjlfinancement_activity:entity,rowid|RESTRICT|RESTRICT','fk_mjl_cancellation_revision'=>'entity,fk_target_revision,fk_activity>'.$p.'mjlfinancement_activity_revision:entity,rowid,fk_activity|RESTRICT|RESTRICT','fk_mjl_cancellation_requester'=>'fk_requester>'.$p.'user:rowid|RESTRICT|RESTRICT','fk_mjl_cancellation_reviewer'=>'fk_reviewer>'.$p.'user:rowid|RESTRICT|RESTRICT'),
		'checks'=>array('chk_mjl_cancellation_entity'=>'entity > 0','chk_mjl_cancellation_target'=>$checks['chk_mjl_cancellation_target'],'chk_mjl_cancellation_version'=>'target_version > 0 AND version > 0','chk_mjl_cancellation_reason'=>"reason REGEXP '[^[:space:]]'",'chk_mjl_cancellation_status'=>"status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN')",'chk_mjl_cancellation_state'=>$checks['chk_mjl_cancellation_state']),
		'characters'=>array('target_type'=>'utf8mb4|utf8mb4_uca1400_ai_ci','target_operation_set_hash'=>'utf8mb4|utf8mb4_uca1400_ai_ci','requester_name_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','requester_role_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','reason'=>'utf8mb4|utf8mb4_uca1400_ai_ci','status'=>'utf8mb4|utf8mb4_uca1400_ai_ci','reviewer_name_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','reviewer_role_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','decision_reason'=>'utf8mb4|utf8mb4_uca1400_ai_ci','pending_target_key'=>'utf8mb4|utf8mb4_uca1400_ai_ci'),
	);
	$reopening=array(
		'collation'=>'utf8mb4_uca1400_ai_ci',
		'columns'=>array('rowid'=>'bigint(20)|NO||auto_increment|','entity'=>'int(11)|NO|||','fk_activity'=>'int(11)|NO|||','fk_operation'=>'bigint(20)|NO|||','fk_target_revision'=>'bigint(20)|NO|||','target_version'=>'bigint(20)|NO|||','fk_requester'=>'int(11)|NO|||','requester_name_snapshot'=>'varchar(255)|NO|||','requester_role_snapshot'=>'varchar(32)|NO|||','reason'=>'text|NO|||','status'=>"varchar(16)|NO|'PENDING'||",'fk_reviewer'=>'int(11)|YES|NULL||','reviewer_name_snapshot'=>'varchar(255)|YES|NULL||','reviewer_role_snapshot'=>'varchar(32)|YES|NULL||','decision_reason'=>'text|YES|NULL||','date_request'=>'datetime|NO|||','date_decision'=>'datetime|YES|NULL||','date_withdrawal'=>'datetime|YES|NULL||','version'=>'bigint(20)|NO|1||','pending_operation_id'=>"bigint(20)|YES|NULL|stored generated|casewhenstatus='PENDING'thenfk_operationelsenullend",'tms'=>'timestamp|NO|current_timestamp()|on update current_timestamp()|'),
		'indexes'=>array('PRIMARY'=>'U|BTREE|A:0:rowid','uk_mjl_reopening_entity_rowid'=>'U|BTREE|A:0:entity,A:0:rowid','uk_mjl_reopening_pending'=>'U|BTREE|A:0:entity,A:0:pending_operation_id','idx_mjl_reopening_activity'=>'N|BTREE|A:0:entity,A:0:fk_activity,A:0:status,A:0:rowid','idx_mjl_reopening_operation'=>'N|BTREE|A:0:entity,A:0:fk_operation','idx_mjl_reopening_requester'=>'N|BTREE|A:0:fk_requester','idx_mjl_reopening_reviewer'=>'N|BTREE|A:0:fk_reviewer','fk_mjl_reopening_revision'=>'N|BTREE|A:0:entity,A:0:fk_target_revision,A:0:fk_activity'),
		'fks'=>array('fk_mjl_reopening_activity'=>'entity,fk_activity>'.$p.'mjlfinancement_activity:entity,rowid|RESTRICT|RESTRICT','fk_mjl_reopening_operation'=>'entity,fk_operation>'.$p.'mjlfinancement_operation:entity,rowid|RESTRICT|RESTRICT','fk_mjl_reopening_revision'=>'entity,fk_target_revision,fk_activity>'.$p.'mjlfinancement_activity_revision:entity,rowid,fk_activity|RESTRICT|RESTRICT','fk_mjl_reopening_requester'=>'fk_requester>'.$p.'user:rowid|RESTRICT|RESTRICT','fk_mjl_reopening_reviewer'=>'fk_reviewer>'.$p.'user:rowid|RESTRICT|RESTRICT'),
		'checks'=>array('chk_mjl_reopening_entity'=>'entity > 0','chk_mjl_reopening_version'=>'target_version > 0 AND version > 0','chk_mjl_reopening_reason'=>"reason REGEXP '[^[:space:]]'",'chk_mjl_reopening_status'=>"status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN')",'chk_mjl_reopening_state'=>$checks['chk_mjl_reopening_state']),
		'characters'=>array('requester_name_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','requester_role_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','reason'=>'utf8mb4|utf8mb4_uca1400_ai_ci','status'=>'utf8mb4|utf8mb4_uca1400_ai_ci','reviewer_name_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','reviewer_role_snapshot'=>'utf8mb4|utf8mb4_uca1400_ai_ci','decision_reason'=>'utf8mb4|utf8mb4_uca1400_ai_ci'),
	);
	return array('activity'=>$activity,'operation'=>$operation,'activity_reference_sequence'=>$phase2['activity_reference_sequence'],'activity_revision'=>$phase2['activity_revision'],'revision_contributor'=>$phase2['revision_contributor'],'review_decision'=>$phase2['review_decision'],'cancellation_request'=>$cancellation,'reopening_request'=>$reopening);
}

function mjl_rst006b_trigger_contract_maps(DoliDB $db)
{
	$p=$db->prefix();$tables=array($p.'mjlfinancement_activity',$p.'mjlfinancement_activity_assignment');
	foreach(mjl_rst006a_suffixes()as$suffix)$tables[]=mjl_rst006a_table($db,$suffix);
	$tables[]=mjl_rst006b_table($db,'cancellation_request');$tables[]=mjl_rst006b_table($db,'reopening_request');
	$target=array_fill_keys($tables,array());$predecessor=array_fill_keys($tables,array());
	$old=mjl_rst006a_guard_statements($db);
	$old[]='CREATE TRIGGER '.$p."mjl_activity_rst005_bd BEFORE DELETE ON {$p}mjlfinancement_activity FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity deletion is dormant in RST-005'";
	foreach(mjl_rst002b_assignment_trigger_statements($db)as$sql)if(strpos($sql,' BEFORE INSERT ')===false)$old[]=$sql;
	foreach($old as$sql)mjl_rst006b_add_trigger_contract($predecessor,$sql);
	$replacementNames=array($p.'mjl_activity_rst006a_bu',$p.'mjl_activity_assignment_bi',$p.'mjl_operation_rst006a_bi',$p.'mjl_operation_rst006a_bu');
	foreach($old as$sql){$clean=str_replace('`','',$sql);if(!preg_match('/^CREATE(?: OR REPLACE)? TRIGGER ([A-Za-z][A-Za-z0-9_]*) /',$clean,$match)||!in_array($match[1],$replacementNames,true))mjl_rst006b_add_trigger_contract($target,$sql);}
	foreach(mjl_rst006b_guard_statements($db)as$sql)mjl_rst006b_add_trigger_contract($target,$sql);
	return array('predecessor'=>$predecessor,'target'=>$target);
}

function mjl_rst006b_add_trigger_contract(array &$map,$sql)
{
	$clean=str_replace('`','',$sql);
	if(!preg_match('/^CREATE(?: OR REPLACE)? TRIGGER ([A-Za-z][A-Za-z0-9_]*) (BEFORE (?:INSERT|UPDATE|DELETE)) ON ([A-Za-z][A-Za-z0-9_]*) FOR EACH ROW (.*)$/s',$clean,$match))return;
	if(isset($map[$match[3]]))$map[$match[3]][$match[1]]=$match[2].':'.mjl_rst005_normalize_definition($match[4]);
}

function mjl_rst006b_require_trigger_contract(DoliDB $db)
{
	$target=mjl_rst006b_trigger_contract_maps($db)['target'];
	foreach($target as$table=>$expected)if(!mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db,$table),$expected))throw new RuntimeException('RST-006B trigger contract mismatch for '.$table.'.');
}

function mjl_rst006b_require_prefix_trigger_contract(DoliDB $db)
{
	$p=$db->prefix();$maps=mjl_rst006b_trigger_contract_maps($db);$snapshot=$maps['predecessor'];$snapshots=array($snapshot);
	foreach(array($p.'mjl_activity_rst006a_bu',$p.'mjl_operation_rst006a_bi',$p.'mjl_operation_rst006a_bu',$p.'mjl_activity_assignment_bi')as$name){foreach($snapshot as$table=>$triggers)unset($snapshot[$table][$name]);$snapshots[]=$snapshot;}
	foreach(mjl_rst006b_guard_statements($db)as$sql){mjl_rst006b_add_trigger_contract($snapshot,$sql);$snapshots[]=$snapshot;}
	$actual=array();foreach(array_keys($maps['target'])as$table)$actual[$table]=mjl_rst002b_actual_trigger_map($db,$table);
	foreach($snapshots as$allowed){$match=true;foreach($allowed as$table=>$triggers)if(!mjl_rst005_map_equal($actual[$table],$triggers)){$match=false;break;}if($match)return;}
	throw new RuntimeException('Trigger state is not a contiguous RST-006B installation prefix.');
}

function mjl_rst006b_contract_matches(DoliDB $db,$suffix,array $contract,$table='')
{
	try{mjl_rst006a_require_new_table_contract($db,$suffix,$contract,$table);return true;}catch(Throwable $ignored){return false;}
}

function mjl_rst006b_contract_stage(DoliDB $db,$suffix,array $contracts,$table='')
{
	foreach($contracts as$index=>$contract)if(mjl_rst006b_contract_matches($db,$suffix,$contract,$table))return $index;
	return -1;
}

function mjl_rst006b_request_contract_stages(array $target)
{
	$names=array_keys($target['fks']);$stages=array();
	for($count=0;$count<=count($names);$count++){$contract=$target;$contract['fks']=array_slice($target['fks'],0,$count,true);foreach(array_keys($contract['indexes'])as$indexName)if(strpos($indexName,'fk_mjl_')===0&&!isset($contract['fks'][$indexName]))unset($contract['indexes'][$indexName]);$stages[]=$contract;}
	return $stages;
}

function mjl_rst006b_contract_valid(DoliDB $db, &$error = null)
{
	try {
		mjl_rst002b_require_assignment_contract($db,$db->prefix().'mjlfinancement_activity_assignment','ignore');
		foreach(mjl_rst006b_table_contracts($db) as $suffix=>$contract) {
			$table=$db->prefix().'mjlfinancement_'.$suffix;
			mjl_rst006a_require_new_table_contract($db,$suffix,$contract,$table);
		}
		mjl_rst006b_require_trigger_contract($db);
		return true;
	} catch (Throwable $exception) {
		$error=$exception->getMessage();
		return false;
	}
}

function mjl_rst006b_is_known_prefix(DoliDB $db, &$error = null)
{
	try {
		$p=$db->prefix();$target=mjl_rst006b_table_contracts($db);$phase2=mjl_rst006a_new_table_contracts($db);
		mjl_rst002b_require_assignment_contract($db,$p.'mjlfinancement_activity_assignment','ignore');
		foreach(array('activity_reference_sequence','activity_revision','revision_contributor','review_decision')as$suffix)mjl_rst006a_require_new_table_contract($db,$suffix,$target[$suffix]);
		$operationContracts=array($phase2['operation']);$operationBase=$phase2['operation'];unset($operationBase['checks']['chk_mjl_operation_phase2']);$operationContracts[]=$operationBase;foreach(array('chk_mjl_operation_execution_status','chk_mjl_operation_spent_amount','chk_mjl_operation_observation','chk_mjl_operation_execution_shape')as$name){$operationBase['checks'][$name]=$target['operation']['checks'][$name];$operationContracts[]=$operationBase;}
		$operationStage=mjl_rst006b_contract_stage($db,'operation',$operationContracts,mjl_rst006b_table($db,'operation'));if($operationStage<0)throw new RuntimeException('Operation state is not a contiguous RST-006B prefix.');
		$activityContracts=array();$activityBase=mjl_rst006a_activity_contract($db);$activityContracts[]=$activityBase;unset($activityBase['checks']['chk_mjl_activity_rst006a_phase2']);$activityContracts[]=$activityBase;unset($activityBase['checks']['chk_mjl_activity_validation_status']);$activityContracts[]=$activityBase;$activityBase['checks']['chk_mjl_activity_validation_status']=$target['activity']['checks']['chk_mjl_activity_validation_status'];$activityContracts[]=$activityBase;$activityBase['checks']['chk_mjl_activity_rst006b_phase3a']=$target['activity']['checks']['chk_mjl_activity_rst006b_phase3a'];$activityContracts[]=$activityBase;
		$activityStage=mjl_rst006b_contract_stage($db,'activity',$activityContracts,$p.'mjlfinancement_activity');if($activityStage<0)throw new RuntimeException('Activity state is not a contiguous RST-006B prefix.');
		$hasCancellation=mjl_rst002b_table_exists($db,mjl_rst006b_table($db,'cancellation_request'));
		$hasReopening=mjl_rst002b_table_exists($db,mjl_rst006b_table($db,'reopening_request'));
		if($operationStage<count($operationContracts)-1&&($activityStage!==0||$hasCancellation||$hasReopening))throw new RuntimeException('Activity or request stage precedes the Operation stage.');
		if($operationStage===count($operationContracts)-1&&$activityStage<count($activityContracts)-1&&($hasCancellation||$hasReopening))throw new RuntimeException('Request stage precedes the Activity stage.');
		if($hasReopening&&!$hasCancellation)throw new RuntimeException('reopening_request exists before cancellation_request.');
		$cancellationStage=-1;if($hasCancellation){$stages=mjl_rst006b_request_contract_stages($target['cancellation_request']);$cancellationStage=mjl_rst006b_contract_stage($db,'cancellation_request',$stages,mjl_rst006b_table($db,'cancellation_request'));if($cancellationStage<0)throw new RuntimeException('Cancellation request state is not a contiguous key prefix.');}
		$reopeningStage=-1;if($hasReopening){$stages=mjl_rst006b_request_contract_stages($target['reopening_request']);$reopeningStage=mjl_rst006b_contract_stage($db,'reopening_request',$stages,mjl_rst006b_table($db,'reopening_request'));if($reopeningStage<0)throw new RuntimeException('Reopening request state is not a contiguous key prefix.');}
		if($hasCancellation&&($operationStage!==count($operationContracts)-1||$activityStage!==count($activityContracts)-1))throw new RuntimeException('Request tables precede completed Activity constraints.');
		if($hasReopening&&$cancellationStage!==4)throw new RuntimeException('Reopening request precedes complete cancellation keys.');
		mjl_rst006b_require_prefix_trigger_contract($db);
		$maps=mjl_rst006b_trigger_contract_maps($db);$triggersArePredecessor=true;foreach($maps['predecessor']as$table=>$expected)if(!mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db,$table),$expected)){$triggersArePredecessor=false;break;}
		if(($operationStage<count($operationContracts)-1||$activityStage<count($activityContracts)-1||$cancellationStage<4||$reopeningStage<5)&&!$triggersArePredecessor)throw new RuntimeException('Trigger installation precedes complete tables and constraints.');
		return true;
	}catch(Throwable $exception){$error=$exception->getMessage();return false;}
}

function mjl_rst006b_detect_schema(DoliDB $db)
{
	$cancellation = mjl_rst006b_table($db, 'cancellation_request');
	$reopening = mjl_rst006b_table($db, 'reopening_request');
	$operation = mjl_rst006b_table($db, 'operation');
	$activity = mjl_rst006b_table($db, 'activity');
	$hasCancellation = mjl_rst002b_table_exists($db, $cancellation);
	$hasReopening = mjl_rst002b_table_exists($db, $reopening);
	$target = $hasCancellation && $hasReopening
		&& mjl_rst006b_constraint_exists($db, $operation, 'chk_mjl_operation_execution_shape')
		&& mjl_rst006b_constraint_exists($db, $activity, 'chk_mjl_activity_rst006b_phase3a')
		&& mjl_rst006b_trigger_exists($db, $db->prefix().'mjl_operation_rst006b_bu')
		&& mjl_rst006b_trigger_exists($db, $db->prefix().'mjl_activity_rst006b_bu')
		&& mjl_rst006b_trigger_exists($db, $db->prefix().'mjl_cancellation_rst006b_bi')
		&& mjl_rst006b_trigger_exists($db, $db->prefix().'mjl_reopening_rst006b_bi')
		&& mjl_rst006b_contract_valid($db);
	if ($target) return RST006B_SCHEMA_TARGET;
	try { mjl_rst006a_require_target($db); if (!$hasCancellation && !$hasReopening) return RST006B_SCHEMA_PREDECESSOR; }
	catch (Throwable $ignored) {}
	if ($hasCancellation || $hasReopening || mjl_rst006b_constraint_exists($db, $operation, 'chk_mjl_operation_execution_shape') || mjl_rst006b_constraint_exists($db, $activity, 'chk_mjl_activity_rst006b_phase3a')) return mjl_rst006b_is_known_prefix($db)?RST006B_SCHEMA_PARTIAL:RST006B_SCHEMA_UNKNOWN;
	return RST006B_SCHEMA_UNKNOWN;
}

function mjl_rst006b_activity_shape_check()
{
	return "validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED') AND (validation_status IN ('DRAFT','ABANDONED') AND is_cancelled=0 AND fk_current_revision IS NULL AND first_submitted_amount IS NULL AND latest_validated_amount IS NULL OR validation_status IN ('SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR') AND is_cancelled=0 AND fk_current_revision IS NOT NULL AND first_submitted_amount>0 AND latest_validated_amount IS NULL OR validation_status='FINAL_VALIDATED' AND is_cancelled=0 AND fk_current_revision IS NOT NULL AND first_submitted_amount>0 AND latest_validated_amount>0 OR validation_status='CANCELLED' AND is_cancelled=1 AND fk_current_revision IS NOT NULL AND first_submitted_amount>0 AND (latest_validated_amount IS NULL OR latest_validated_amount>0))";
}

function mjl_rst006b_guard_statements(DoliDB $db)
{
	$p = $db->prefix();
	$a = $p.'mjlfinancement_activity';
	$o = $p.'mjlfinancement_operation';
	$r = $p.'mjlfinancement_activity_revision';
	$c = $p.'mjlfinancement_cancellation_request';
	$reopen = $p.'mjlfinancement_reopening_request';
	$user = $p.'user';
	$role = $p.'mjlfinancement_user_role';
	$assignment = $p.'mjlfinancement_activity_assignment';
	return array(
		'CREATE OR REPLACE TRIGGER '.$p."mjl_activity_rst006b_bu BEFORE UPDATE ON $a FOR EACH ROW BEGIN DECLARE final_amount BIGINT DEFAULT NULL; DECLARE approved_cancel INTEGER DEFAULT 0; IF NEW.is_cancelled=1 AND OLD.is_cancelled=0 THEN SELECT COUNT(*) INTO approved_cancel FROM $c WHERE entity=OLD.entity AND target_type='ACTIVITY' AND target_id=OLD.rowid AND target_version=OLD.version AND status='APPROVED'; END IF; IF NEW.entity<>OLD.entity OR NEW.ref<>OLD.ref OR NEW.fk_user_creat<>OLD.fk_user_creat OR NEW.date_creation<>OLD.date_creation OR NEW.version<>OLD.version+1 OR OLD.is_cancelled=1 OR (NEW.is_cancelled=1 AND (approved_cancel<>1 OR OLD.fk_current_revision IS NULL OR OLD.is_cancelled<>0 OR NEW.validation_status<>'CANCELLED' OR NEW.fk_partner<>OLD.fk_partner OR NEW.fk_project<>OLD.fk_project OR NEW.name<>OLD.name OR NEW.description<>OLD.description OR NEW.date_start<>OLD.date_start OR NEW.date_end<>OLD.date_end OR NEW.draft_authorized_amount<>OLD.draft_authorized_amount OR NOT(NEW.first_submitted_amount<=>OLD.first_submitted_amount) OR NOT(NEW.latest_validated_amount<=>OLD.latest_validated_amount) OR NOT(NEW.fk_current_revision<=>OLD.fk_current_revision))) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006B Activity update'; END IF; IF NEW.validation_status='FINAL_VALIDATED' THEN SELECT proposed_amount INTO final_amount FROM $r WHERE entity=NEW.entity AND rowid=NEW.fk_current_revision AND fk_activity=NEW.rowid; IF final_amount IS NULL OR NEW.latest_validated_amount<>final_amount THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Final amount must equal current revision'; END IF; END IF; END",
		'CREATE OR REPLACE TRIGGER '.$p."mjl_activity_assignment_bi BEFORE INSERT ON $assignment FOR EACH ROW BEGIN DECLARE activity_ok INTEGER DEFAULT 0; DECLARE agent_ok INTEGER DEFAULT 0; DECLARE assigner_ok INTEGER DEFAULT 0; SELECT COUNT(*) INTO activity_ok FROM $a ac WHERE ac.rowid=NEW.fk_activity AND ac.entity=NEW.entity AND ac.validation_status NOT IN ('ABANDONED','CANCELLED'); SELECT COUNT(*) INTO agent_ok FROM $user u INNER JOIN $role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code='AGENT_SAISIE' WHERE u.rowid=NEW.fk_user AND u.entity=NEW.entity AND u.statut=1 AND u.admin=0; SELECT COUNT(*) INTO assigner_ok FROM $user u LEFT JOIN $role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 WHERE u.rowid=NEW.fk_user_assign AND u.entity=NEW.entity AND u.statut=1 AND u.admin=0 AND (r.role_code='VALIDATEUR_DEFINITIF' OR (u.rowid=NEW.fk_user AND EXISTS (SELECT 1 FROM $a ca WHERE ca.rowid=NEW.fk_activity AND ca.entity=NEW.entity AND ca.fk_user_creat=u.rowid AND ca.version=1 AND ca.validation_status='DRAFT'))); IF activity_ok<>1 OR agent_ok<>1 OR assigner_ok<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006B assignment'; END IF; SET NEW.date_start=CURRENT_TIMESTAMP; SET NEW.date_creation=CURRENT_TIMESTAMP; SET NEW.tms=CURRENT_TIMESTAMP; END",
		'CREATE OR REPLACE TRIGGER '.$p."mjl_operation_rst006b_bi BEFORE INSERT ON $o FOR EACH ROW BEGIN DECLARE parent_ok INTEGER DEFAULT 0; DECLARE type_ok INTEGER DEFAULT 0; SELECT COUNT(*) INTO parent_ok FROM $a WHERE rowid=NEW.fk_activity AND entity=NEW.entity AND validation_status IN ('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'); SELECT COUNT(*) INTO type_ok FROM {$p}mjlfinancement_operation_type WHERE rowid=NEW.fk_operation_type AND entity=NEW.entity; IF parent_ok<>1 OR type_ok<>1 OR NEW.status<>'TODO' OR NEW.spent_amount IS NOT NULL OR NEW.observation IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006B Operation insert'; END IF; END",
		'CREATE OR REPLACE TRIGGER '.$p."mjl_operation_rst006b_bu BEFORE UPDATE ON $o FOR EACH ROW BEGIN DECLARE parent_status VARCHAR(32) DEFAULT ''; DECLARE parent_cancelled INTEGER DEFAULT 1; DECLARE parent_revision BIGINT DEFAULT NULL; DECLARE approved_exception INTEGER DEFAULT 0; SELECT validation_status,is_cancelled,fk_current_revision INTO parent_status,parent_cancelled,parent_revision FROM $a WHERE rowid=OLD.fk_activity AND entity=OLD.entity; IF NEW.status='CANCELLED' AND OLD.status<>'CANCELLED' THEN SELECT COUNT(*) INTO approved_exception FROM $c WHERE entity=OLD.entity AND status='APPROVED' AND fk_target_revision=parent_revision AND ((target_type='OPERATION' AND target_id=OLD.rowid AND target_version=OLD.version) OR (target_type='ACTIVITY' AND target_id=OLD.fk_activity)); ELSEIF OLD.status='COMPLETED' AND NEW.status='IN_PROGRESS' THEN SELECT COUNT(*) INTO approved_exception FROM $reopen WHERE entity=OLD.entity AND fk_operation=OLD.rowid AND fk_target_revision=parent_revision AND target_version=OLD.version AND status='APPROVED'; END IF; IF NEW.entity<>OLD.entity OR NEW.fk_activity<>OLD.fk_activity OR NEW.date_creation<>OLD.date_creation OR NEW.fk_user_creat<>OLD.fk_user_creat OR NEW.version<>OLD.version+1 OR OLD.date_removed IS NOT NULL OR OLD.status='CANCELLED' OR (NEW.status='CANCELLED' AND (parent_revision IS NULL OR approved_exception<>1)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid RST-006B Operation update'; END IF; IF OLD.status='COMPLETED' AND (approved_exception<>1 OR NEW.status<>'IN_PROGRESS' OR NEW.fk_operation_type<>OLD.fk_operation_type OR NEW.name<>OLD.name OR NEW.authorized_amount<>OLD.authorized_amount OR NOT(NEW.spent_amount<=>OLD.spent_amount) OR NOT(NEW.observation<=>OLD.observation)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Completed Operation requires reopening'; END IF; IF NEW.fk_operation_type<>OLD.fk_operation_type OR NEW.name<>OLD.name OR NEW.authorized_amount<>OLD.authorized_amount OR NOT(NEW.date_removed<=>OLD.date_removed) OR NOT(NEW.fk_user_removed<=>OLD.fk_user_removed) THEN IF parent_status NOT IN ('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR') OR NEW.status<>'TODO' OR NEW.spent_amount IS NOT NULL OR NEW.observation IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid structural Operation update'; END IF; ELSEIF parent_status IN ('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR') THEN IF OLD.status<>'TODO' OR NEW.status<>'TODO' OR OLD.spent_amount IS NOT NULL OR NEW.spent_amount IS NOT NULL OR OLD.observation IS NOT NULL OR NEW.observation IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid planning Operation update'; END IF; ELSEIF NEW.status<>'CANCELLED' AND (parent_status<>'FINAL_VALIDATED' OR parent_cancelled<>0 OR NOT((OLD.status='TODO' AND NEW.status IN ('TODO','IN_PROGRESS','COMPLETED')) OR (OLD.status='IN_PROGRESS' AND NEW.status IN ('IN_PROGRESS','COMPLETED')) OR (OLD.status='COMPLETED' AND NEW.status='IN_PROGRESS'))) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid execution Operation transition'; END IF; END",
		'CREATE OR REPLACE TRIGGER '.$p."mjl_cancellation_rst006b_bi BEFORE INSERT ON $c FOR EACH ROW BEGIN DECLARE target_ok INTEGER DEFAULT 0; DECLARE requester_ok INTEGER DEFAULT 0; IF NEW.target_type='ACTIVITY' THEN SELECT COUNT(*) INTO target_ok FROM $a WHERE entity=NEW.entity AND rowid=NEW.target_id AND rowid=NEW.fk_activity AND fk_current_revision=NEW.fk_target_revision AND version=NEW.target_version AND is_cancelled=0; ELSE SELECT COUNT(*) INTO target_ok FROM $o op INNER JOIN $a ac ON ac.entity=op.entity AND ac.rowid=op.fk_activity WHERE op.entity=NEW.entity AND op.rowid=NEW.target_id AND op.fk_activity=NEW.fk_activity AND op.version=NEW.target_version AND op.status IN ('TODO','IN_PROGRESS') AND op.date_removed IS NULL AND ac.fk_current_revision=NEW.fk_target_revision AND ac.is_cancelled=0; END IF; SELECT COUNT(*) INTO requester_ok FROM $assignment aa INNER JOIN $user u ON u.rowid=aa.fk_user AND u.entity=aa.entity INNER JOIN $role ur ON ur.entity=u.entity AND ur.fk_user=u.rowid AND ur.is_active=1 AND ur.role_code='AGENT_SAISIE' WHERE aa.entity=NEW.entity AND aa.fk_activity=NEW.fk_activity AND aa.fk_user=NEW.fk_requester AND aa.date_end IS NULL AND u.statut=1 AND u.admin=0; IF target_ok<>1 OR requester_ok<>1 OR NEW.status<>'PENDING' OR NEW.version<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid cancellation request'; END IF; END",
		'CREATE OR REPLACE TRIGGER '.$p."mjl_cancellation_rst006b_bu BEFORE UPDATE ON $c FOR EACH ROW BEGIN IF OLD.status<>'PENDING' OR NEW.status='PENDING' OR NEW.version<>OLD.version+1 OR NEW.rowid<>OLD.rowid OR NEW.entity<>OLD.entity OR NEW.target_type<>OLD.target_type OR NEW.target_id<>OLD.target_id OR NEW.fk_activity<>OLD.fk_activity OR NOT(NEW.fk_target_revision<=>OLD.fk_target_revision) OR NEW.target_version<>OLD.target_version OR NOT(NEW.target_operation_set_hash<=>OLD.target_operation_set_hash) OR NEW.fk_requester<>OLD.fk_requester OR NEW.requester_name_snapshot<>OLD.requester_name_snapshot OR NEW.requester_role_snapshot<>OLD.requester_role_snapshot OR NEW.reason<>OLD.reason OR NEW.date_request<>OLD.date_request THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid cancellation request transition'; END IF; END",
		'CREATE OR REPLACE TRIGGER '.$p."mjl_cancellation_rst006b_bd BEFORE DELETE ON $c FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation requests are immutable'",
		'CREATE OR REPLACE TRIGGER '.$p."mjl_reopening_rst006b_bi BEFORE INSERT ON $reopen FOR EACH ROW BEGIN DECLARE target_ok INTEGER DEFAULT 0; DECLARE requester_ok INTEGER DEFAULT 0; SELECT COUNT(*) INTO target_ok FROM $o op INNER JOIN $a ac ON ac.entity=op.entity AND ac.rowid=op.fk_activity WHERE op.entity=NEW.entity AND op.rowid=NEW.fk_operation AND op.fk_activity=NEW.fk_activity AND op.version=NEW.target_version AND op.status='COMPLETED' AND op.date_removed IS NULL AND ac.fk_current_revision=NEW.fk_target_revision AND ac.is_cancelled=0; SELECT COUNT(*) INTO requester_ok FROM $assignment aa INNER JOIN $user u ON u.rowid=aa.fk_user AND u.entity=aa.entity INNER JOIN $role ur ON ur.entity=u.entity AND ur.fk_user=u.rowid AND ur.is_active=1 AND ur.role_code='AGENT_SAISIE' WHERE aa.entity=NEW.entity AND aa.fk_activity=NEW.fk_activity AND aa.fk_user=NEW.fk_requester AND aa.date_end IS NULL AND u.statut=1 AND u.admin=0; IF target_ok<>1 OR requester_ok<>1 OR NEW.status<>'PENDING' OR NEW.version<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid reopening request'; END IF; END",
		'CREATE OR REPLACE TRIGGER '.$p."mjl_reopening_rst006b_bu BEFORE UPDATE ON $reopen FOR EACH ROW BEGIN IF OLD.status<>'PENDING' OR NEW.status='PENDING' OR NEW.version<>OLD.version+1 OR NEW.rowid<>OLD.rowid OR NEW.entity<>OLD.entity OR NEW.fk_activity<>OLD.fk_activity OR NEW.fk_operation<>OLD.fk_operation OR NEW.fk_target_revision<>OLD.fk_target_revision OR NEW.target_version<>OLD.target_version OR NEW.fk_requester<>OLD.fk_requester OR NEW.requester_name_snapshot<>OLD.requester_name_snapshot OR NEW.requester_role_snapshot<>OLD.requester_role_snapshot OR NEW.reason<>OLD.reason OR NEW.date_request<>OLD.date_request THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid reopening request transition'; END IF; END",
		'CREATE OR REPLACE TRIGGER '.$p."mjl_reopening_rst006b_bd BEFORE DELETE ON $reopen FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Reopening requests are immutable'",
	);
}

function mjl_rst006b_load_table(DoliDB $db, $suffix)
{
	$path = dirname(__DIR__).'/sql/llx_mjlfinancement_'.$suffix.'.sql';
	mjl_rst006a_load_sql_file($db, $path);
	mjl_rst006b_ensure_table_keys($db, $suffix);
}

function mjl_rst006b_ensure_table_keys(DoliDB $db, $suffix)
{
	$keyPath = dirname(__DIR__).'/sql/llx_mjlfinancement_'.$suffix.'.key.sql';
	foreach (mjl_rst006a_sql_statements($db, $keyPath) as $index=>$sql) {
		if (!preg_match('/ ADD CONSTRAINT ([A-Za-z][A-Za-z0-9_]*) FOREIGN KEY /', $sql, $match)) throw new RuntimeException('Unable to parse RST-006B key statement.');
		if (!mjl_rst006b_constraint_exists($db, mjl_rst006b_table($db, $suffix), $match[1]) && !$db->query($sql)) throw new RuntimeException('Unable to install '.$match[1].': '.$db->lasterror());
		mjl_rst006b_failpoint($suffix.'-fk-'.str_pad((string)($index+1),2,'0',STR_PAD_LEFT));
	}
}

function mjl_rst006b_install_target(DoliDB $db)
{
	$state = mjl_rst006b_detect_schema($db);
	if ($state === RST006B_SCHEMA_TARGET) return;
	if ($state === RST006B_SCHEMA_UNKNOWN) {$prefixError='';mjl_rst006b_is_known_prefix($db,$prefixError);throw new RuntimeException('RST-006B unknown predecessor state'.($prefixError!==''?': '.$prefixError:'').'.');}
	if ($state === RST006B_SCHEMA_PREDECESSOR) mjl_rst006a_require_target($db);
	$operation = mjl_rst006b_table($db, 'operation');
	$activity = mjl_rst006b_table($db, 'activity');
	foreach (array('chk_mjl_operation_phase2','chk_mjl_operation_execution_status','chk_mjl_operation_spent_amount','chk_mjl_operation_observation','chk_mjl_operation_execution_shape') as $name) if (mjl_rst006b_constraint_exists($db, $operation, $name) && $name === 'chk_mjl_operation_phase2') {
		if (!$db->query('ALTER TABLE '.$operation.' DROP CONSTRAINT '.$name)) throw new RuntimeException('Unable to replace Phase 2 Operation constraint.');
	}
	$operationChecks = array(
		'chk_mjl_operation_execution_status' => "status IN ('TODO','IN_PROGRESS','COMPLETED','CANCELLED')",
		'chk_mjl_operation_spent_amount' => 'spent_amount IS NULL OR spent_amount >= 0',
		'chk_mjl_operation_observation' => "observation IS NULL OR observation REGEXP '[^[:space:]]'",
		'chk_mjl_operation_execution_shape' => "(spent_amount IS NULL OR spent_amount=authorized_amount OR (observation IS NOT NULL AND observation REGEXP '[^[:space:]]')) AND (status<>'COMPLETED' OR spent_amount IS NOT NULL)",
	);
	foreach ($operationChecks as $name => $expression) if (!mjl_rst006b_constraint_exists($db, $operation, $name) && !$db->query('ALTER TABLE '.$operation.' ADD CONSTRAINT '.$name.' CHECK ('.$expression.')')) throw new RuntimeException('Unable to add '.$name.': '.$db->lasterror());
	mjl_rst006b_failpoint('operation-checks');
	foreach (array('chk_mjl_activity_rst006a_phase2','chk_mjl_activity_validation_status') as $name) if (mjl_rst006b_constraint_exists($db, $activity, $name) && !$db->query('ALTER TABLE '.$activity.' DROP CONSTRAINT '.$name)) throw new RuntimeException('Unable to replace '.$name.'.');
	if (!mjl_rst006b_constraint_exists($db, $activity, 'chk_mjl_activity_validation_status') && !$db->query("ALTER TABLE $activity ADD CONSTRAINT chk_mjl_activity_validation_status CHECK (validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED'))")) throw new RuntimeException('Unable to enable Activity cancellation status.');
	if (!mjl_rst006b_constraint_exists($db, $activity, 'chk_mjl_activity_rst006b_phase3a') && !$db->query('ALTER TABLE '.$activity.' ADD CONSTRAINT chk_mjl_activity_rst006b_phase3a CHECK ('.mjl_rst006b_activity_shape_check().')')) throw new RuntimeException('Unable to add Phase 3A Activity shape.');
	mjl_rst006b_failpoint('activity-checks');
	foreach (array('cancellation_request','reopening_request') as $suffix) {
		if (!mjl_rst002b_table_exists($db, mjl_rst006b_table($db, $suffix))) mjl_rst006b_load_table($db, $suffix);
		else mjl_rst006b_ensure_table_keys($db, $suffix);
		mjl_rst006b_failpoint($suffix);
	}
	foreach (array($db->prefix().'mjl_activity_rst006a_bu',$db->prefix().'mjl_operation_rst006a_bi',$db->prefix().'mjl_operation_rst006a_bu',$db->prefix().'mjl_activity_assignment_bi') as $trigger) $db->query('DROP TRIGGER IF EXISTS '.$trigger);
	foreach (mjl_rst006b_guard_statements($db) as $sql) if (!$db->query($sql)) throw new RuntimeException('Unable to install RST-006B guard: '.$db->lasterror());
	mjl_rst006b_failpoint('guards');
	$error='';if(!mjl_rst006b_contract_valid($db,$error))throw new RuntimeException('RST-006B target verification failed: '.$error.'.');
	if (mjl_rst006b_detect_schema($db) !== RST006B_SCHEMA_TARGET) throw new RuntimeException('RST-006B target state detection failed.');
}

function mjl_rst006b_require_target(DoliDB $db)
{
	$state = mjl_rst006b_detect_schema($db);
	if ($state === RST006B_SCHEMA_PREDECESSOR) throw new RuntimeException('MIGRATION_REQUIRED');
	if ($state !== RST006B_SCHEMA_TARGET) throw new RuntimeException('RST-006B schema is incomplete or unknown.');
}

function mjl_rst006b_rollback_target(DoliDB $db)
{
	mjl_rst006b_require_target($db);
	$p = $db->prefix();
	$required=function($sql)use($db){if(!$db->query($sql))throw new RuntimeException('RST-006B rollback statement failed: '.$db->lasterror());};
	foreach (array('cancellation','reopening') as $kind) foreach (array('bi','bu','bd') as $suffix) $required('DROP TRIGGER IF EXISTS '.$p.'mjl_'.$kind.'_rst006b_'.$suffix);
	$required('DROP TRIGGER IF EXISTS '.$p.'mjl_activity_rst006b_bu');
	$required('DROP TRIGGER IF EXISTS '.$p.'mjl_operation_rst006b_bi');
	$required('DROP TRIGGER IF EXISTS '.$p.'mjl_operation_rst006b_bu');
	$required('DROP TRIGGER IF EXISTS '.$p.'mjl_activity_assignment_bi');
	foreach (array('reopening_request','cancellation_request') as $suffix) if (!$db->query('DROP TABLE '.mjl_rst006b_table($db, $suffix))) throw new RuntimeException('Unable to remove '.$suffix.'.');
	$activity = mjl_rst006b_table($db, 'activity');
	$operation = mjl_rst006b_table($db, 'operation');
	$required('ALTER TABLE '.$activity.' DROP CONSTRAINT chk_mjl_activity_rst006b_phase3a');
	$required('ALTER TABLE '.$activity.' DROP CONSTRAINT chk_mjl_activity_validation_status');
	$required("ALTER TABLE $activity ADD CONSTRAINT chk_mjl_activity_validation_status CHECK (validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED'))");
	$required('ALTER TABLE '.$activity." ADD CONSTRAINT chk_mjl_activity_rst006a_phase2 CHECK (validation_status IN ('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED') AND is_cancelled=0 AND ((validation_status IN ('DRAFT','ABANDONED') AND fk_current_revision IS NULL AND first_submitted_amount IS NULL AND latest_validated_amount IS NULL) OR (validation_status IN ('SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR') AND fk_current_revision IS NOT NULL AND first_submitted_amount>0 AND latest_validated_amount IS NULL) OR (validation_status='FINAL_VALIDATED' AND fk_current_revision IS NOT NULL AND first_submitted_amount>0 AND latest_validated_amount>0)))");
	foreach (array('chk_mjl_operation_execution_status','chk_mjl_operation_spent_amount','chk_mjl_operation_observation','chk_mjl_operation_execution_shape') as $name) $required('ALTER TABLE '.$operation.' DROP CONSTRAINT '.$name);
	$required("ALTER TABLE $operation ADD CONSTRAINT chk_mjl_operation_phase2 CHECK (status='TODO' AND spent_amount IS NULL AND observation IS NULL)");
	foreach (mjl_rst006a_guard_statements($db) as $sql) if (preg_match('/^CREATE TRIGGER ([^ ]+) .* ON ('.preg_quote($p, '/').'mjlfinancement_activity|'.preg_quote($p, '/').'mjlfinancement_operation|'.preg_quote($p, '/').'mjlfinancement_activity_assignment) /', $sql,$match)) { $required('DROP TRIGGER IF EXISTS '.$match[1]); $required($sql); }
	mjl_rst006a_require_target($db);
}
