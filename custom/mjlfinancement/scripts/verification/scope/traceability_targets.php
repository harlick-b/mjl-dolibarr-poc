<?php

define('NOLOGIN', 1);
require '/var/www/html/main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_traceability_scope.lib.php';

global $db, $conf, $user;
$entity = (int) $conf->entity;
$admin = new User($db);
if ($admin->fetch(0, 'admin') <= 0) failTrace('Unable to load Admin.');
$user = $admin;
$marker = 'TRC'.bin2hex(random_bytes(4));
$db->begin();

try {
	queryTrace("INSERT INTO {$db->prefix()}societe (entity,nom,status,client,fournisseur,datec) VALUES (1,'{$marker} PartnerA',1,0,0,NOW()),(2,'{$marker} PartnerB',1,0,0,NOW())");
	$partnerPrimary = idTrace("SELECT rowid FROM {$db->prefix()}societe WHERE nom='{$marker} PartnerA'");
	$partnerCross = idTrace("SELECT rowid FROM {$db->prefix()}societe WHERE nom='{$marker} PartnerB'");
	queryTrace("INSERT INTO {$db->prefix()}projet (entity,ref,title,fk_soc,fk_statut,datec,fk_user_creat) VALUES (1,'{$marker}-PROJECTA','Valid',{$partnerPrimary},1,NOW(),1),(2,'{$marker}-PROJECTB','Cross',{$partnerCross},1,NOW(),1),(1,'{$marker}-PC','Corrupt',{$partnerCross},1,NOW(),1)");
	$projectPrimary=idTrace("SELECT rowid FROM {$db->prefix()}projet WHERE ref='{$marker}-PROJECTA'");
	$projectCross=idTrace("SELECT rowid FROM {$db->prefix()}projet WHERE ref='{$marker}-PROJECTB'");
	$projectCorrupt=idTrace("SELECT rowid FROM {$db->prefix()}projet WHERE ref='{$marker}-PC'");
	queryTrace("INSERT INTO {$db->prefix()}mjlfinancement_convention (entity,ref,title,fk_soc,fk_project,total_amount,currency_code,status,date_creation,fk_user_creat) VALUES (1,'{$marker}-C1','Valid',{$partnerPrimary},{$projectPrimary},1,'XOF',1,NOW(),1),(2,'{$marker}-C2','Cross',{$partnerCross},{$projectCross},1,'XOF',1,NOW(),1),(1,'{$marker}-CC','Corrupt',{$partnerPrimary},{$projectCross},1,'XOF',1,NOW(),1)");
	$c1=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_convention WHERE ref='{$marker}-C1'");
	$c2=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_convention WHERE ref='{$marker}-C2'");
	$cc=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_convention WHERE ref='{$marker}-CC'");
	queryTrace("INSERT INTO {$db->prefix()}mjlfinancement_activity (entity,ref,label,fk_project,fk_convention,status,date_creation,fk_user_creat) VALUES (1,'{$marker}-A1','Valid',{$projectPrimary},{$c1},0,NOW(),1),(2,'{$marker}-A2','Cross',{$projectCross},{$c2},0,NOW(),1),(1,'{$marker}-AC','Corrupt',{$projectPrimary},{$cc},0,NOW(),1)");
	$a1=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_activity WHERE ref='{$marker}-A1'");
	$a2=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_activity WHERE ref='{$marker}-A2'");
	$ac=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_activity WHERE ref='{$marker}-AC'");
	queryTrace("INSERT INTO {$db->prefix()}mjlfinancement_budget_line (entity,ref,label,fk_project,fk_convention,initial_budget,date_creation,fk_user_creat,status) VALUES (1,'{$marker}-B1','Valid',{$projectPrimary},{$c1},1,NOW(),1,1),(2,'{$marker}-B2','Cross',{$projectCross},{$c2},1,NOW(),1,1),(1,'{$marker}-BC','Corrupt',{$projectPrimary},{$cc},1,NOW(),1,1)");
	$b1=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_budget_line WHERE ref='{$marker}-B1'");
	$b2=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_budget_line WHERE ref='{$marker}-B2'");
	$bc=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_budget_line WHERE ref='{$marker}-BC'");
	queryTrace("INSERT INTO {$db->prefix()}mjlfinancement_expense (entity,ref,fk_project,fk_convention,fk_budget_line,amount,date_creation,fk_user_creat,status) VALUES (1,'{$marker}-E1',{$projectPrimary},{$c1},{$b1},1,NOW(),1,0),(2,'{$marker}-E2',{$projectCross},{$c2},{$b2},1,NOW(),1,0),(1,'{$marker}-EC',{$projectPrimary},{$cc},{$bc},1,NOW(),1,0)");
	$e1=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_expense WHERE ref='{$marker}-E1'");
	$e2=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_expense WHERE ref='{$marker}-E2'");
	$ec=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_expense WHERE ref='{$marker}-EC'");
	queryTrace("INSERT INTO {$db->prefix()}mjlfinancement_fund_receipt (entity,ref,fk_soc,fk_project,fk_convention,amount,status,date_creation,fk_user_creat) VALUES (1,'{$marker}-F1',{$partnerPrimary},{$projectPrimary},{$c1},1,0,NOW(),1),(2,'{$marker}-F2',{$partnerCross},{$projectCross},{$c2},1,0,NOW(),1),(1,'{$marker}-FC',{$partnerPrimary},{$projectPrimary},{$cc},1,0,NOW(),1)");
	$f1=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_fund_receipt WHERE ref='{$marker}-F1'");
	$f2=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_fund_receipt WHERE ref='{$marker}-F2'");
	$fc=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_fund_receipt WHERE ref='{$marker}-FC'");
	queryTrace("INSERT INTO {$db->prefix()}mjlfinancement_report (entity,ref,name,scope,date_creation,fk_user_creat) VALUES (1,'{$marker}-R1','Valid','Audit',NOW(),1),(2,'{$marker}-R2','Cross','Audit',NOW(),1)");
	$r1=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_report WHERE ref='{$marker}-R1'");
	$r2=idTrace("SELECT rowid FROM {$db->prefix()}mjlfinancement_report WHERE ref='{$marker}-R2'");

	$targets=array(
		'mjlfinancement_project'=>array($projectPrimary,$projectCross,$projectCorrupt), 'mjlfinancement_activity'=>array($a1,$a2,$ac),
		'mjlfinancement_convention'=>array($c1,$c2,$cc), 'mjlfinancement_budget_line'=>array($b1,$b2,$bc),
		'mjlfinancement_expense'=>array($e1,$e2,$ec), 'mjlfinancement_fund_receipt'=>array($f1,$f2,$fc),
		'mjlfinancement_report'=>array($r1,$r2,$r2),
	);
	$expected=array(); $missing=900000000;
	foreach ($targets as $type=>$ids) {
		foreach (array('VALID'=>$ids[0], 'CROSS'=>$ids[1], 'CORRUPT'=>$ids[2], 'MISSING'=>$missing++) as $kind=>$id) {
			$ref=$marker.'-'.$type.'-'.$kind;
			queryTrace(workflowSql($ref,$type,$id));
			queryTrace(exchangeSql($ref,$type,$id));
			if ($kind==='VALID' || $kind==='MISSING') $expected[]=$ref;
		}
	}
	sort($expected);
	foreach (array('mjlfinancement_workflow_action'=>'w','mjlfinancement_exchange_log'=>'x') as $table=>$alias) {
		$filter=mjl_traceability_scope_sql($alias,$admin,$entity);
		$actual=listTrace("SELECT {$alias}.ref FROM {$db->prefix()}{$table} {$alias} WHERE {$alias}.entity={$entity} AND {$alias}.ref LIKE '{$marker}-%'{$filter} ORDER BY {$alias}.ref");
		if ($actual !== $expected) failTrace($table.' row predicate admitted or hid the wrong hostile fixture.');
		$types=idTrace("SELECT COUNT(DISTINCT {$alias}.object_type) FROM {$db->prefix()}{$table} {$alias} WHERE {$alias}.entity={$entity} AND {$alias}.ref LIKE '{$marker}-%'{$filter}");
		if ($types !== 7) failTrace($table.' filter metadata predicate diverged from row visibility.');
	}
	$db->rollback();
	print 'MJL traceability target and metadata containment: OK'.PHP_EOL;
} catch (Throwable $error) {
	$db->rollback();
	fwrite(STDERR,'ERROR: '.$error->getMessage().PHP_EOL);
	exit(1);
}

function workflowSql($ref,$type,$id) { global $db; return "INSERT INTO {$db->prefix()}mjlfinancement_workflow_action (entity,ref,object_type,object_id,action,actor,actor_role,action_date,changes_json,date_creation,fk_user_creat) VALUES (1,'{$db->escape($ref)}','{$db->escape($type)}',".((int)$id).",'verify',1,'ADMIN_PLATEFORME',NOW(),'{}',NOW(),1)"; }
function exchangeSql($ref,$type,$id) { global $db; return "INSERT INTO {$db->prefix()}mjlfinancement_exchange_log (entity,ref,object_type,object_id,exchange_date,actor,actor_role,channel,subject,message,date_creation,fk_user_creat) VALUES (1,'{$db->escape($ref)}','{$db->escape($type)}',".((int)$id).",NOW(),1,'ADMIN_PLATEFORME','verify','verify','verify',NOW(),1)"; }
function queryTrace($sql) { global $db; if (!$db->query($sql)) failTrace($db->lasterror()); }
function idTrace($sql) { global $db; $r=$db->query($sql); $o=$r?$db->fetch_object($r):null; if (!$o) failTrace($db->lasterror()); foreach ($o as $v) return (int)$v; return 0; }
function listTrace($sql) { global $db; $r=$db->query($sql); if (!$r) failTrace($db->lasterror()); $out=array(); while($o=$db->fetch_object($r)) $out[]=(string)$o->ref; return $out; }
function failTrace($message) { throw new RuntimeException($message); }
