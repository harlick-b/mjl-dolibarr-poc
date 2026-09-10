<?php

require_once __DIR__.'/../scripts/rst012_schema.lib.php';

/** Request-local readiness: absent predecessor, exact target, or unavailable. No DDL. */
function mjl_monitoring_readiness()
{
	global $db;
	static $state = null;
	if ($state !== null) return $state;
	$state=-1; $budget=null;
	try {
		$res=$db->query('SELECT @@session.max_statement_time AS statement_time');
		if (!$res || !($row=$db->fetch_object($res))) return $state;
		$budget=(float)$row->statement_time;
		if (!$db->query('SET SESSION max_statement_time=5')) return $state;
		$res=$db->query("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".$db->escape($db->prefix().'mjlfinancement_export_record')."'");
		if (!$res || !($row=$db->fetch_object($res))) return $state;
		if ((int)$row->n===0) $state=0;
		else { mjl_rst012_require_target($db); $state=1; }
	} catch (Throwable $exception) { $state=-1; }
	finally { if ($budget!==null && !$db->query('SET SESSION max_statement_time='.$budget)) $state=-1; }
	return $state;
}
