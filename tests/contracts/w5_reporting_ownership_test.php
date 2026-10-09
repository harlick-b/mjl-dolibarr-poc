<?php

function w5_ownership_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

$root = dirname(__DIR__, 2);
$read = function ($path) use ($root) {
	$value = file_get_contents($root.'/'.$path);
	w5_ownership_assert($value !== false, 'Missing source: '.$path);
	return $value;
};

$roots = array(
	'custom/mjlfinancement/reports.php' => 'mjl_reporting_preview_http(',
	'custom/mjlfinancement/reportexport.php' => 'mjl_reporting_export_http(',
	'custom/mjlfinancement/index.php' => "mjl_monitoring_http(\$db, \$user, (int) \$conf->entity, 'home'",
	'custom/mjlfinancement/alerts.php' => "mjl_monitoring_http(\$db, \$user, (int) \$conf->entity, 'alerts'",
);
foreach ($roots as $path => $handoff) {
	$source = $read($path);
	w5_ownership_assert(substr_count($source, $handoff) === 1, $path.' must hand off exactly once to its selected W5 handler.');
}

$workflow = $read('custom/mjlfinancement/workflowactions.php');
w5_ownership_assert(strpos($workflow, "\$reportRequest['report']='audit';") !== false && strpos($workflow, 'mjl_reporting_preview_http($db,$user,(int)$conf->entity,$reportRequest,') !== false, 'Current-schema workflow audit must delegate explicit context to the selected reporting handler.');
w5_ownership_assert(strpos($workflow, "SELECT rowid, object_type") !== false, 'The predecessor audit branch must remain explicit and retained.');

$reportHandler = $read('custom/mjlfinancement/lib/reporting/mjl_reporting_http.lib.php');
$reportRead = $read('custom/mjlfinancement/lib/reporting/mjl_reporting_read.lib.php');
$delivery = $read('custom/mjlfinancement/lib/reporting/mjl_export_delivery.lib.php');
$monitorHandler = $read('custom/mjlfinancement/lib/monitoring/mjl_monitoring_http.lib.php');
$monitorRead = $read('custom/mjlfinancement/lib/monitoring/mjl_monitoring_read.lib.php');
$legacyMonitor = $read('custom/mjlfinancement/lib/mjl_monitoring_route.lib.php');
$monitorPresentation = $read('custom/mjlfinancement/lib/monitoring/mjl_monitoring_presentation.lib.php');
$monitoringOwner = $read('custom/mjlfinancement/class/mjlmonitoring.class.php');
$reportPresentation = $read('custom/mjlfinancement/lib/reporting/mjl_reporting_presentation.lib.php');
$reportTemplate = $read('custom/mjlfinancement/tpl/reporting/report.php');
$auditTemplate = $read('custom/mjlfinancement/tpl/reporting/audit.php');
$indexRoot = $read('custom/mjlfinancement/index.php');
$alertsRoot = $read('custom/mjlfinancement/alerts.php');

w5_ownership_assert(strpos($reportHandler, 'mjl_reporting_read_preview(') !== false && strpos($reportHandler, 'mjl_reporting_read_audit(') !== false, 'The reporting handler must delegate both preview snapshots to the reporting read owner.');
w5_ownership_assert(strpos($reportHandler, 'new MjlExportDelivery()') !== false && strpos($delivery, 'fread(') !== false, 'The export handler must delegate streaming to the selected delivery owner.');
w5_ownership_assert(strpos($reportRead, 'new MjlMonitoring(') !== false, 'MjlMonitoring must remain the report query owner.');
w5_ownership_assert(strpos($reportRead, '/monitoring/') === false && strpos($reportRead, '->referenceChoices(') !== false, 'Reporting reads must call the retained query owner without importing the monitoring feature.');
w5_ownership_assert(strpos($monitoringOwner, 'function referenceChoices(') !== false && strpos($monitoringOwner, 'SELECT DISTINCT') !== false, 'MjlMonitoring must own scoped reference-choice queries.');
w5_ownership_assert(strpos($monitorHandler, 'mjl_monitoring_read_page(') !== false && strpos($monitorHandler, 'mjl_report_route.lib.php') === false, 'Dashboard and alerts must use the W2 read owner without importing the former report route.');
w5_ownership_assert(strpos($monitorRead, "array('home', 'alerts')") !== false && strpos($monitorRead, "'operations'") === false, 'The W5 W2 read interface must own only dashboard and alerts.');
w5_ownership_assert(strpos($legacyMonitor, "array('operations','requests')") !== false && strpos($legacyMonitor, "\$kind==='home'") === false && strpos($legacyMonitor, "\$kind==='alerts'") === false, 'The legacy monitoring route must retain only excluded Operations/request authority.');
w5_ownership_assert(strpos($legacyMonitor, '/reporting/') === false && strpos($legacyMonitor, 'mjl_reporting_') === false, 'The excluded legacy monitoring route must not depend on the W5 reporting feature.');
w5_ownership_assert(strpos($legacyMonitor, 'mjl_report_data.lib.php') === false && strpos($monitorHandler, 'mjl_report_') === false && strpos($monitorPresentation, 'mjl_report_') === false, 'Monitoring owners must not depend on report feature validation or vocabulary.');
w5_ownership_assert(!preg_match('/global\s+\$(db|user|conf)\b|\$_(GET|POST|FILES|SERVER)/', $reportHandler), 'The reporting handler must receive request and Dolibarr context explicitly.');
w5_ownership_assert(!preg_match('/global\s+\$(db|user|conf)\b|\$_(GET|POST|FILES|SERVER)/', $monitorHandler), 'The monitoring handler must receive request and Dolibarr context explicitly.');
w5_ownership_assert(strpos($indexRoot, 'mjl_dashboard_admin_cards') === false && strpos($indexRoot, 'mjl_monitoring_readiness') === false, 'The dashboard root must contain only bootstrap and one handler handoff.');
w5_ownership_assert(strpos($alertsRoot, 'mjl_monitoring_readiness') === false, 'The alerts root must not probe readiness before its handler authorizes the actor.');
$guardPosition = strpos($monitorHandler, "mjl_navigation_policy_allows(\$user, 'planning_read')");
$readinessPosition = strpos($monitorHandler, 'mjl_monitoring_readiness()');
w5_ownership_assert($guardPosition !== false && $readinessPosition !== false && $guardPosition < $readinessPosition, 'The monitoring handler must authorize the actor before probing readiness.');
w5_ownership_assert(strpos($reportHandler, 'newToken()') !== false && strpos($reportPresentation, 'newToken()') === false && strpos($reportTemplate, 'newToken()') === false && strpos($auditTemplate, 'newToken()') === false, 'The HTTP handler must prepare CSRF tokens before presentation.');
w5_ownership_assert(strpos($reportTemplate, 'mjl_report_status_labels') === false, 'Reporting presentation must use the selected shared monitoring vocabulary owner.');

foreach (array('custom/mjlfinancement/lib/mjl_report_route.lib.php', 'custom/mjlfinancement/lib/mjl_audit_report_route.lib.php') as $removed) w5_ownership_assert(!file_exists($root.'/'.$removed), 'Superseded report route owner must be removed: '.$removed);
foreach (array('reporting/report.php', 'reporting/audit.php', 'monitoring/home.php', 'monitoring/alerts.php') as $template) {
	$source = $read('custom/mjlfinancement/tpl/'.$template);
	w5_ownership_assert(!preg_match('/\$_(GET|POST|SESSION|SERVER)|\$(db|user|conf)\b/', $source), 'Prepared template must not access request/session/DB globals: '.$template);
}

print "W5 reporting ownership contract passed.\n";
