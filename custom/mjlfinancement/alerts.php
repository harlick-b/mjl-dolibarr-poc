<?php
require '../../main.inc.php';
require_once __DIR__.'/lib/monitoring/mjl_monitoring_http.lib.php';
mjl_monitoring_http($db, $user, (int) $conf->entity, 'alerts', $_GET, $_SERVER['REQUEST_METHOD'] ?? 'GET');
$db->close();
