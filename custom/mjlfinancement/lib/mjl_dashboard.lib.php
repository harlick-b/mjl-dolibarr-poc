<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reporting.lib.php';

function mjl_dashboard_count($table)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().$table.' WHERE entity = '.((int) $conf->entity);
	return (int) mjl_dashboard_scalar($sql);
}

function mjl_dashboard_fetch_id($table, $where)
{
	global $db, $conf;

	$sql = 'SELECT rowid FROM '.$db->prefix().$table.' WHERE '.$where;
	$sql .= ' AND entity = '.((int) $conf->entity);
	return (int) mjl_dashboard_scalar($sql, 'rowid');
}

function mjl_dashboard_project_summary($projectId)
{
	return mjl_report_project_summary($projectId);
}

function mjl_dashboard_convention_budget($conventionId)
{
	return mjl_report_convention_budget($conventionId);
}

function mjl_dashboard_scalar($sql, $field = 'nb')
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_dashboard_error($db->lasterror());
		return 0;
	}

	$obj = $db->fetch_object($resql);
	return $obj && isset($obj->{$field}) ? $obj->{$field} : 0;
}

function mjl_dashboard_fetch_row($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_dashboard_error($db->lasterror());
		return array();
	}

	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_dashboard_fetch_rows($sql)
{
	global $db;

	$resql = $db->query($sql);
	if (!$resql) {
		mjl_dashboard_error($db->lasterror());
		return array();
	}

	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}

function mjl_dashboard_error($message)
{
	if (function_exists('setEventMessages')) {
		setEventMessages($message, null, 'errors');
	}
}
