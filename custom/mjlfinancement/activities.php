<?php

define('NOREDIRECTBYMAINTOLOGIN', 1);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_route.lib.php';
mjl_activity_route();
$db->close();
