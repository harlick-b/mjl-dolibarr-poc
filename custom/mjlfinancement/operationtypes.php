<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reference_route.lib.php';

mjl_reference_require_read($user);
mjl_reference_route('operation_type');
$db->close();
