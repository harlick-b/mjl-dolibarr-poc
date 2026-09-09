<?php

$sentinel=require '/opt/mjl-tests/fixtures/phase1-fixture-preflight.php';
define('NOLOGIN',1);require '/var/www/html/main.inc.php';require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst006b_schema.lib.php';
$sentinelResult=$db->query("SELECT value FROM ".$db->prefix()."const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");$sentinelRow=$sentinelResult?$db->fetch_object($sentinelResult):null;if(!$sentinelRow||!hash_equals($sentinel,(string)$sentinelRow->value))exit(2);
$action=$argv[1]??'';$p=$db->prefix();
function probe_sql($sql){global $db;if(!$db->query($sql)){fwrite(STDERR,$db->lasterror()."\n");exit(3);}}
function probe_statement($statements,$needle){foreach($statements as$sql)if(strpos($sql,$needle)!==false)return $sql;fwrite(STDERR,"probe statement unavailable\n");exit(4);}
if($action==='swap-operation-to-predecessor'){
	$table=$p.'mjlfinancement_operation';foreach(array('chk_mjl_operation_execution_status','chk_mjl_operation_spent_amount','chk_mjl_operation_observation','chk_mjl_operation_execution_shape')as$name)probe_sql('ALTER TABLE '.$table.' DROP CONSTRAINT '.$name);probe_sql("ALTER TABLE $table ADD CONSTRAINT chk_mjl_operation_phase2 CHECK (status='TODO' AND spent_amount IS NULL AND observation IS NULL)");
}elseif($action==='restore-operation-target'){
	$table=$p.'mjlfinancement_operation';probe_sql('ALTER TABLE '.$table.' DROP CONSTRAINT chk_mjl_operation_phase2');$contracts=mjl_rst006b_table_contracts($db)['operation'];foreach(array('chk_mjl_operation_execution_status','chk_mjl_operation_spent_amount','chk_mjl_operation_observation','chk_mjl_operation_execution_shape')as$name)probe_sql('ALTER TABLE '.$table.' ADD CONSTRAINT '.$name.' CHECK ('.$contracts['checks'][$name].')');
}elseif($action==='install-old-activity-trigger')probe_sql(probe_statement(mjl_rst006a_guard_statements($db),$p.'mjl_activity_rst006a_bu '));
elseif($action==='drop-old-activity-trigger')probe_sql('DROP TRIGGER '.$p.'mjl_activity_rst006a_bu');
elseif($action==='install-out-of-order-trigger')probe_sql(probe_statement(mjl_rst006b_guard_statements($db),$p.'mjl_reopening_rst006b_bd '));
elseif($action==='drop-out-of-order-trigger')probe_sql('DROP TRIGGER '.$p.'mjl_reopening_rst006b_bd');
elseif($action==='drop-required-trigger')probe_sql('DROP TRIGGER '.$p.'mjl_cancellation_rst006b_bd');
elseif($action==='restore-required-trigger')probe_sql(probe_statement(mjl_rst006b_guard_statements($db),$p.'mjl_cancellation_rst006b_bd '));
else exit(5);
print "OK\n";
