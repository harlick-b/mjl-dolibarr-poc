<?php
if(strtoupper($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET');exit;}
define('NOREDIRECTBYMAINTOLOGIN',1);require '../../main.inc.php';
require_once __DIR__.'/lib/mjl_reporting_shell.lib.php';
mjl_reporting_shell($user,'reports',$_GET);$db->close();
