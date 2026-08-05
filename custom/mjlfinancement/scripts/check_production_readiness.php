<?php

require_once __DIR__.'/cli_guard.php';

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
check('current_scope_verifier_present', file_exists(DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/scripts/verify_scope_integrity.php'), 'Current scope and unresolved-data verifier exists.');
check('csv_export_helper_present', file_exists(DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_csv_export.lib.php'), 'CSV export helper exists.');
check('xlsx_export_helper_present', file_exists(DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_xlsx_export.lib.php'), 'XLSX export helper exists.');
check('e2e_token_exposure_disabled', empty($conf->global->MJL_AUTH_E2E_EXPOSE_TOKENS), 'E2E invitation and reset token exposure is disabled.');

unknown('final_permission_matrix', 'Requires client approval and deployment operator confirmation.');
unknown('official_output_templates', 'Requires client approval of official CSV/XLSX templates and labels.');
unknown('client_content_approval', 'Requires client approval of unprotected labels, emails, and official outputs.');
unknown('production_email_transport', 'Requires deployment operator confirmation.');
unknown('public_base_url', 'Requires deployment operator confirmation.');
unknown('production_secrets', 'Requires deployment operator confirmation.');
unknown('production_document_storage', 'Requires deployment operator confirmation of private ECM storage and permissions.');
unknown('backup_restore_procedure', 'Requires deployment operator confirmation.');
unknown('monitoring_and_log_retention', 'Requires deployment operator confirmation.');

out('VERDICT BLOCKED_PENDING_CLIENT_AND_OPERATOR_CONFIRMATION');

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
