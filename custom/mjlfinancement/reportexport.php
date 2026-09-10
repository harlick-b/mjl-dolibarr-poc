<?php
// Keep bootstrap and renderer diagnostics outside the audited artifact.
ini_set('zlib.output_compression','0');
ob_start();
require '../../main.inc.php';
require_once __DIR__.'/lib/mjl_report_route.lib.php';
mjl_report_export_http();
