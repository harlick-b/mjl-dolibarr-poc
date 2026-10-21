<?php
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/reference/mjl_reference_http.lib.php';
mjl_reference_http_handle('partner', $user);
$db->close();
