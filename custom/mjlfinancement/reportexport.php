<?php
// Keep bootstrap and renderer diagnostics outside the audited artifact.
ini_set('zlib.output_compression','0');
ob_start();
require '../../main.inc.php';
require_once __DIR__.'/lib/reporting/mjl_reporting_http.lib.php';
mjl_reporting_export_http($db, $user, (int) $conf->entity, $_POST, $_FILES, $_SERVER['REQUEST_METHOD'] ?? '');
