<?php
require_once dirname(__DIR__).'/lib/api/mjl_api_http.lib.php';
$GLOBALS['mjl_api_buffer_level']=ob_get_level();
ob_start();
// Native maintenance/WAF/bootstrap exits must not leak HTML or redirect an API client.
register_shutdown_function(function(){if(empty($GLOBALS['mjl_api_completed']))mjl_api_error(503,'unavailable');});
try {
 $request=mjl_api_request();
 define('NOLOGIN',1); define('NOCSRFCHECK',1); define('NOTOKENRENEWAL',1);
 define('NOREQUIREMENU',1); define('NOREQUIREHTML',1); define('NOREQUIREAJAX',1);
 require dirname(__DIR__,3).'/main.inc.php';
 // NOLOGIN skips this native guard; preserve configured exact-address restrictions.
 if (!empty($dolibarr_main_restrict_ip) && !in_array($_SERVER['REMOTE_ADDR'] ?? '', array_map('trim', explode(',', $dolibarr_main_restrict_ip)), true)) mjl_api_fail(403, 'forbidden');
 require_once dirname(__DIR__).'/lib/api/mjl_api_auth.lib.php';
 require_once dirname(__DIR__).'/lib/api/mjl_api_references.lib.php';
 require_once dirname(__DIR__).'/lib/api/mjl_api_activities.lib.php';
 if($request['method']!=='GET')mjl_api_csrf();
 if(strpos($request['path'],'/auth/')===0)$response=mjl_api_auth($request);
 else {
  $actor=mjl_api_actor(true);
  if ($request['path']==='/submission-tokens' && isset($request['body']->operation_id) && in_array($request['body']->operation_id,mjl_api_activity_operations(),true)) $response=mjl_api_activity_token($request['body'],$actor);
  elseif (preg_match('~^/(activities|assignment-agents|monitoring-options)(/|$)~',$request['path'])) $response=mjl_api_activities($request,$actor);
  else $response=mjl_api_references($request,$actor);
 }
 mjl_api_reply($response[0],$response[1]??null);
} catch(MjlApiError $error){mjl_api_error($error->status,$error->apiCode);}
catch(Throwable $error){error_log('MJL REST request failed ('.get_class($error).').');mjl_api_error(503,'unavailable');}
