<?php

$sentinel=require '/opt/mjl-tests/fixtures/disposable-fixture-preflight.php';
define('NOLOGIN',1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst012_schema.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit.lib.php';
$res=$db->query("SELECT value FROM ".$db->prefix()."const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");
$row=$res?$db->fetch_object($res):null;
if (!$row || !hash_equals($sentinel,(string)$row->value)) exit(2);
function phase3b_assert($condition,$message) { if (!$condition) throw new RuntimeException($message); }
mjl_rst012_install($db);
$actor=new User($db);
phase3b_assert($actor->fetch(1)>0 && $actor->admin,'Missing disposable administrator');
$table=$db->prefix().'mjlfinancement_export_record';
$db->begin();
try {
	$id=mjl_audit_append_in_transaction($db,array('entity'=>1,'object_type'=>'report','object_ref'=>'MJL-EXPORT-PROBE','actor'=>$actor,'actor_role_snapshot'=>'ADMIN_PLATEFORME','action'=>'EXPORT_GENERATED','result'=>'SUCCESS'));
	phase3b_assert($id>0,'Audit probe insertion failed');
	$columns='entity,ref,report_type,projection_version,format,status,fk_generator,generator_name_snapshot,generator_role_snapshot,date_snapshot,date_generation,filters_json,scope_json,body_row_count,byte_count,content_sha256,fk_audit_event';
	$values="1,'MJL-EXPORT-PROBE','audit',1,'csv','GENERATED',1,'Admin','ADMIN_PLATEFORME',NOW(),NOW(),'{}','[]',0,10,'".str_repeat('a',64)."',$id";
	$insert="INSERT INTO $table ($columns) VALUES ($values)";
	phase3b_assert(!$db->query(str_replace("1,'MJL-EXPORT-PROBE'","2,'MJL-EXPORT-PROBE'",$insert)),'Cross-entity audit reference accepted');
	phase3b_assert(!$db->query(str_replace("'MJL-EXPORT-PROBE'","'MJL-EXPORT-OTHER'",$insert)),'Wrong audit export reference accepted');
	phase3b_assert((bool)$db->query($insert),'Matching evidence pair refused');
	phase3b_assert(!$db->query($insert),'Duplicate audit reference accepted');
	phase3b_assert(!$db->query("UPDATE $table SET byte_count=11"),'Export evidence mutation accepted');
	phase3b_assert(!$db->query("DELETE FROM $table"),'Export evidence deletion accepted');
} finally { $db->rollback(); }
phase3b_assert((int)mjl_rst005_scalar($db,"SELECT COUNT(*) FROM $table")===0,'Probe rows survived rollback');
mjl_rst012_require_target($db);
print "Phase 3B export schema probe passed.\n";
