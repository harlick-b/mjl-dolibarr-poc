<?php

require_once __DIR__.'/rst006b_schema.lib.php';

/** Additive export evidence schema, deliberately outside the native bulk SQL loader. */
function mjl_rst012_guard_statements(DoliDB $db)
{
	$p = $db->prefix();
	$table = $p.'mjlfinancement_export_record';
	return array(
		'CREATE TRIGGER '.$p."mjl_report_bi BEFORE INSERT ON $table FOR EACH ROW BEGIN IF NOT EXISTS (SELECT 1 FROM {$p}mjlfinancement_audit_event a WHERE a.rowid=NEW.fk_audit_event AND a.entity=NEW.entity AND a.object_type='report' AND BINARY a.object_ref=BINARY NEW.ref AND a.action='EXPORT_GENERATED' AND a.result='SUCCESS' AND a.actor_id=NEW.fk_generator AND BINARY a.actor_role_snapshot=BINARY NEW.generator_role_snapshot) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL export requires matching successful audit evidence'; END IF; END",
		'CREATE TRIGGER '.$p."mjl_report_bu BEFORE UPDATE ON $table FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL export records are immutable'",
		'CREATE TRIGGER '.$p."mjl_report_bd BEFORE DELETE ON $table FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MJL export records are immutable'",
	);
}

function mjl_rst012_report_contract(DoliDB $db)
{
	$columns = array(
		'rowid'=>'bigint(20)|NO||auto_increment|', 'entity'=>'int(11)|NO|||', 'ref'=>'varchar(64)|NO|||',
		'report_type'=>'varchar(24)|NO|||', 'projection_version'=>'int(11)|NO|||', 'format'=>'varchar(8)|NO|||', 'status'=>"varchar(16)|NO|'GENERATED'||",
		'fk_generator'=>'int(11)|NO|||', 'generator_name_snapshot'=>'varchar(255)|NO|||', 'generator_role_snapshot'=>'varchar(32)|NO|||',
		'date_snapshot'=>'datetime|NO|||', 'date_generation'=>'datetime|NO|||', 'filters_json'=>'text|NO|||', 'scope_json'=>'longtext|NO|||',
		'body_row_count'=>'int(11)|NO|||', 'byte_count'=>'int(11)|NO|||', 'content_sha256'=>'char(64)|NO|||', 'fk_audit_event'=>'bigint(20)|NO|||',
	);
	$characters = array();
	foreach ($columns as $name=>$type) if (preg_match('/^(?:varchar|char|text|longtext)/', $type)) $characters[$name]='utf8mb4|utf8mb4_uca1400_ai_ci';
	return array('collation'=>'utf8mb4_uca1400_ai_ci', 'columns'=>$columns, 'characters'=>$characters,
		'indexes'=>array('PRIMARY'=>'U|BTREE|A:0:rowid','uk_mjl_report_ref'=>'U|BTREE|A:0:entity,A:0:ref','uk_mjl_report_audit'=>'U|BTREE|A:0:fk_audit_event','idx_mjl_report_date'=>'N|BTREE|A:0:entity,A:0:date_generation,A:0:rowid'),
		'fks'=>array('fk_mjl_report_audit'=>'fk_audit_event>'.$db->prefix().'mjlfinancement_audit_event:rowid|RESTRICT|RESTRICT'),
		'checks'=>array(
			'chk_mjl_report_entity'=>'entity > 0', 'chk_mjl_report_projection'=>'projection_version=1',
			'chk_mjl_report_type'=>"report_type IN ('activities','operations','activity_detail','portfolio','audit')",
			'chk_mjl_report_format'=>"format IN ('pdf','xlsx','csv')",
			'chk_mjl_report_status'=>"status='GENERATED'",
			'chk_mjl_report_generator'=>"fk_generator > 0 AND generator_role_snapshot IN ('AGENT_SAISIE','AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF','ADMIN_PLATEFORME') AND (generator_role_snapshot <> 'ADMIN_PLATEFORME' OR report_type='audit')",
			'chk_mjl_report_filters'=>'JSON_VALID(filters_json)', 'chk_mjl_report_scope'=>'JSON_VALID(scope_json)',
			'chk_mjl_report_size'=>"body_row_count >= 0 AND body_row_count <= 10000 AND (format <> 'pdf' OR body_row_count <= 500) AND byte_count > 0 AND byte_count <= 20971520",
			'chk_mjl_report_hash'=>"content_sha256 REGEXP '^[0-9a-f]{64}$'",
		),
	);
}

function mjl_rst012_require_target(DoliDB $db)
{
	mjl_rst006b_require_target($db);
	$table=$db->prefix().'mjlfinancement_export_record';
	mjl_rst006a_require_new_table_contract($db,'report',mjl_rst012_report_contract($db),$table);
	$expected=array($table=>array());
	foreach (mjl_rst012_guard_statements($db) as $sql) mjl_rst006b_add_trigger_contract($expected,$sql);
	if (!mjl_rst005_map_equal(mjl_rst002b_actual_trigger_map($db,$table),$expected[$table])) throw new RuntimeException('RST012_TRIGGER_CONTRACT');
}

/** Caller must have proven traffic stopped and backup or disposable-tenant custody. */
function mjl_rst012_install(DoliDB $db)
{
	mjl_rst006b_require_target($db);
	$table=$db->prefix().'mjlfinancement_export_record';
	if (mjl_rst002b_table_exists($db,$table)) {
		mjl_rst012_require_target($db);
		return;
	}
	$sql=file_get_contents(__DIR__.'/schema/rst012_report.sql');
	if ($sql===false || !$db->query(str_replace('llx_',$db->prefix(),$sql))) throw new RuntimeException('RST012_CREATE_FAILED');
	foreach (mjl_rst012_guard_statements($db) as $sql) if (!$db->query($sql)) throw new RuntimeException('RST012_GUARD_FAILED');
	mjl_rst012_require_target($db);
}
