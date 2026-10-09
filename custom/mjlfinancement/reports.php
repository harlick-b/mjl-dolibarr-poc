<?php
require '../../main.inc.php';
require_once __DIR__.'/lib/reporting/mjl_reporting_http.lib.php';
mjl_reporting_preview_http($db, $user, (int) $conf->entity, $_GET, $_SERVER['REQUEST_METHOD'] ?? 'GET');
