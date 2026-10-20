<?php
define('NOREDIRECTBYMAINTOLOGIN',1);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/spending/mjl_spending_http.lib.php';
mjl_spending_http($db,$user,(int)$conf->entity);
$db->close();
