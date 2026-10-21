<?php
ob_start();require __DIR__.'/api_reference_request_test.php';ob_end_clean();
foreach(array('/admin/users','/admin/invitations') as $path){checkReferenceRequest($path,'page=2');checkReferenceRequest($path,'entity=2',400);}
checkReferenceRequest('/admin/users/12/role','',405);
checkReferenceRequest('/admin/users/12/deactivation','',405);
checkReferenceRequest('/admin/invitations/12/revocation','',405);
$root=dirname(__DIR__,2);$front=file_get_contents($root.'/custom/mjlfinancement/api/index.php');
if(strpos($front,'mjl_api_access.lib.php')===false||strpos($front,'mjl_api_access(')===false)throw new RuntimeException('Access REST adapter is not dispatched.');
$page=file_get_contents($root.'/custom/mjlfinancement/admin/access.php');
if(strpos($page,"REQUEST_METHOD']??'GET')!=='GET'")===false||strpos($page,'mjl_access_ui')!==false)throw new RuntimeException('Access page must be a GET-only REST shell.');
print "MJL access REST request contract passed.\n";
