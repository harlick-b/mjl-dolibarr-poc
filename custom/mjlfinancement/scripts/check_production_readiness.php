<?php

define('NOLOGIN', 1);

require '/var/www/html/main.inc.php';

global $conf, $db;

$failed = false;
$moduleVersion = property_exists($conf->global, 'MAIN_MODULE_MJLFINANCEMENT_VERSION') ? (string) $conf->global->MAIN_MODULE_MJLFINANCEMENT_VERSION : '0.10.0';

check('module_version_below_1_0_0', version_compare($moduleVersion, '1.0.0', '<'), 'Module version is intentionally pre-1.0 until readiness blockers are closed.');
check('no_public_registration', !file_exists(DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/register.php'), 'Public MJL registration is not implemented by this module.');
check('access_role_table_present', tableExists('mjlfinancement_user_role'), 'Production business-role table exists.');
check('access_scope_table_present', tableExists('mjlfinancement_user_soc_scope'), 'Partner/programme scope table exists.');
check('workflow_audit_table_present', tableExists('mjlfinancement_workflow_action'), 'Workflow audit table exists.');
check('report_table_present', tableExists('mjlfinancement_report'), 'Report registry table exists for export audit anchors.');
check('document_route_present', file_exists(DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/documentdownload.php'), 'Guarded document download route exists.');
check('unresolved_scope_script_present', file_exists(DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/audit_unresolved_scope.php'), 'Unresolved scope audit script exists.');
check('csv_export_helper_present', file_exists(DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_csv_export.lib.php'), 'CSV export helper exists.');
check('xlsx_export_helper_present', file_exists(DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_xlsx_export.lib.php'), 'XLSX export helper exists.');

unknown('production_email_transport', 'Requires deployment operator confirmation.');
unknown('public_base_url', 'Requires deployment operator confirmation.');
unknown('production_secrets', 'Requires deployment operator confirmation.');
unknown('backup_restore_procedure', 'Requires deployment operator confirmation.');
unknown('monitoring_and_log_retention', 'Requires deployment operator confirmation.');

exit($failed ? 1 : 0);

function tableExists($table)
{
	global $db;

	$sql = 'SELECT COUNT(*) AS nb FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()';
	$sql .= " AND TABLE_NAME = '".$db->escape($db->prefix().$table)."'";
	$resql = $db->query($sql);
	if (!$resql) {
		return false;
	}
	$obj = $db->fetch_object($resql);
	return $obj && (int) $obj->nb > 0;
}

function check($name, $ok, $detail)
{
	global $failed;

	if ($ok) {
		out('OK '.$name.' - '.$detail);
		return;
	}
	$failed = true;
	out('FAIL '.$name.' - '.$detail);
}

function unknown($name, $detail)
{
	out('UNKNOWN '.$name.' - '.$detail);
}

function out($message)
{
	print $message.PHP_EOL;
}
