<?php
if(strtoupper($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET');exit;}
define('NOREDIRECTBYMAINTOLOGIN',1);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_execution_http.lib.php';
mjl_execution_http($user,'operations');
$db->close();
