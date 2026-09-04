<?php

define('NOREDIRECTBYMAINTOLOGIN', 1);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_operation_route.lib.php';
mjl_operation_route();
$db->close();
