<?php

$sentinel=require '/opt/mjl-tests/fixtures/phase1-fixture-preflight.php';
define('NOLOGIN',1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/rst012_schema.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_audit.lib.php';
$res=$db->query("SELECT value FROM ".$db->prefix()."const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");
$row=$res?$db->fetch_object($res):null;
if (!$row || !hash_equals($sentinel,(string)$row->value)) exit(2);
function phase3b_assert($condition,$message) { if (!$condition) throw new RuntimeException($message); }
mjl_rst012_install($db);
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
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexportspool.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_report_render.lib.php';
$document=array('metadata'=>array('Identifiant export'=>'MJL-EXPORT-FORMAT-PROBE'),'sections'=>array(array('title'=>'Suivi des Activités','headers'=>array('Nom','Montant (FCFA)','Montant exact (FCFA)'), 'rows'=>array_fill(0,40,array(array('type'=>'text','value'=>'=1+1'),array('type'=>'integer','value'=>'12345','currency'=>'XOF'),array('type'=>'integer','value'=>'1234567890123456789','currency'=>'XOF'))))));
foreach (array('csv','xlsx','pdf') as $format) {
	$spool=new MjlExportSpool('/tmp/mjl-phase3b-render-probe');
	try {
		$path=$spool->create($format);
		mjl_report_render($path,$format,$document,hrtime(true)+30000000000);
		if ($format==='xlsx') {
			$zip=new ZipArchive(); phase3b_assert($zip->open($path)===true,'Invalid XLSX archive');
			$sheet=$zip->getFromName('xl/worksheets/sheet2.xml'); $strings=$zip->getFromName('xl/sharedStrings.xml');
			phase3b_assert(strpos($sheet,'<f>')===false && strpos($strings,'=1+1')!==false,'Spreadsheet text became a formula');
			phase3b_assert(strpos($strings,'1234567890123456789')!==false && strpos($sheet,'<v>12345</v>')!==false,'Spreadsheet numeric precision policy failed'); $zip->close();
		}
		phase3b_assert((fileperms($path)&0777)===0600,$format.' renderer changed artifact mode');
		$artifact=$spool->detach($path);
		try {
			$bytes=stream_get_contents($artifact['stream']);
			phase3b_assert(hash('sha256',$bytes)===$artifact['sha256'],'Rendered descriptor hash mismatch');
			if ($format==='csv') phase3b_assert(substr($bytes,0,3)==="\xEF\xBB\xBF" && strpos($bytes,"'=1+1")!==false,'CSV encoding or formula neutralization failed');
			if ($format==='pdf') phase3b_assert(substr($bytes,0,5)==='%PDF-' && preg_match_all('/\/Type\s*\/Page\b/',$bytes)>1,'Multi-page PDF generation failed');
		} finally { fclose($artifact['stream']); }
	} finally { $spool->close(); }
}
print "Phase 3B installed CSV/XLSX/PDF renderer probes passed.\n";
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexport.class.php';
$conf->entity=1;
$owner=new MjlExport($db,$actor,1,'/tmp/mjl-phase3b-owner-probe');
$artifact=$owner->generate('audit','csv',array(),function($reader,$filters){
	$events=$reader->audit($filters,true);
	phase3b_assert(count($events)===0,'Empty audit snapshot contains unexpected events');
	return array('activity_ids'=>array(),'document'=>array('metadata'=>array(),'sections'=>array(array('title'=>'Journal d’audit','headers'=>array('Événement'),'rows'=>array()))));
});
try {
	phase3b_assert($db->transaction_opened===0,'Business transaction remained open for delivery');
	$bytes=stream_get_contents($artifact['stream']);
	phase3b_assert(hash('sha256',$bytes)===$artifact['sha256'],'Authorized descriptor changed');
	phase3b_assert((int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$table)===1,'Generated export evidence missing');
	phase3b_assert((int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$db->prefix()."mjlfinancement_audit_event WHERE action='EXPORT_GENERATED' AND result='SUCCESS'")===1,'Generated audit evidence missing');
} finally { fclose($artifact['stream']); }
print "Phase 3B native Admin audit export transaction probe passed.\n";
