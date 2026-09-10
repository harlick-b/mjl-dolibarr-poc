<?php
require '../../main.inc.php';
require_once __DIR__.'/lib/mjl_monitoring_route.lib.php';
if (!mjl_navigation_policy_allows($user,'planning_read')) mjl_report_http_error(403,'Accès non autorisé.');
if (mjl_monitoring_readiness()===0) mjl_report_http_error(403,'Les alertes cibles ne sont pas encore disponibles.');
mjl_monitoring_page('alerts');
$db->close();
