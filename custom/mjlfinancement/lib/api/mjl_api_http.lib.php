<?php
/** JSON transport for the implemented REST routes. */
class MjlApiError extends RuntimeException
{
 public $status;
 public $apiCode;
 public function __construct($status,$code) { parent::__construct($code); $this->status=$status; $this->apiCode=$code; }
}
function mjl_api_fail($status,$code) { throw new MjlApiError($status,$code); }
function mjl_api_reply($status,$value=null)
{
 $GLOBALS['mjl_api_completed']=true;
 while(ob_get_level()>($GLOBALS['mjl_api_buffer_level']??0))ob_end_clean();
 header_remove('Location');
 http_response_code($status);
 header('Content-Type: application/json; charset=UTF-8');
 header('Cache-Control: private, no-store');
 header('X-Content-Type-Options: nosniff');
 header('Referrer-Policy: no-referrer');
 if($status!==204)echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
}
function mjl_api_error($status,$code)
{
 $messages=array('invalid_request'=>'Requête non valide.','inactive_parent'=>'Le Partenaire du Projet doit être actif.','invalid_input'=>'Vérifiez les champs saisis.','csrf_invalid'=>'Rechargez la page avant de réessayer.','submission_invalid'=>'Cette action a déjà été envoyée ou a expiré. Rechargez la fiche.','authentication_required'=>'Connectez-vous pour continuer.','invalid_credentials'=>'Adresse email ou mot de passe incorrect.','invalid_otp'=>'Code incorrect.','otp_expired'=>'Ce code a expiré. Renvoyez un code ou recommencez la connexion.','session_expired'=>'Votre session a expiré. Veuillez vous reconnecter.','session_invalidated'=>'Votre session doit être vérifiée de nouveau.','authentication_unavailable'=>'La connexion avec vérification est temporairement indisponible.','forbidden'=>'Action non autorisée.','stale_version'=>'Cette fiche a été modifiée. Rechargez la fiche.','conflict'=>'L’état courant ne permet pas cette action. Rechargez la fiche.','retryable_conflict'=>'Une autre action est en cours. Rechargez avant de réessayer.','not_found'=>'Cet élément est introuvable.','stale_fingerprint'=>'Cette référence a été modifiée. Rechargez la page.','rate_limited'=>'Veuillez patienter avant de réessayer.','outcome_unknown'=>'Le résultat est incertain. Consultez la fiche avant toute nouvelle tentative.','export_busy'=>'Un rapport est déjà en cours de génération.','unsupported_record'=>'Une donnée ne peut pas être représentée dans ce rapport.','selection_too_large'=>'La sélection dépasse les limites du rapport.','unavailable'=>'Le service est temporairement indisponible.','method_not_allowed'=>'Méthode non autorisée.','payload_too_large'=>'Requête trop volumineuse.','unsupported_media_type'=>'Format de requête non pris en charge.');
 mjl_api_reply($status,array('error'=>array('code'=>$code,'message'=>$messages[$code]??'Requête refusée.')));
}
function mjl_api_fields($object,array $required,array $optional=array())
{
 if(!($object instanceof stdClass))mjl_api_fail(400,'invalid_request');
 $keys=array_keys(get_object_vars($object));
 if(array_diff($required,$keys)||array_diff($keys,array_merge($required,$optional)))mjl_api_fail(400,'invalid_request');
}
function mjl_api_string($value,$max=4096)
{
 if(!is_string($value)||!preg_match('//u',$value)||strlen($value)>$max)mjl_api_fail(400,'invalid_request');
 return $value;
}
function mjl_api_id($value)
{
 if(!is_string($value)||!preg_match('/^[1-9][0-9]{0,18}$/D',$value)||(strlen($value)===19&&strcmp($value,'9223372036854775807')>0))mjl_api_fail(400,'invalid_request');
 return $value;
}
function mjl_api_query_fields($path)
{
 $business=array('q','partner_id','project_id','activity_id','validation_status','execution_status','completeness','date_from','date_to');
 if(in_array($path,array('/dashboard','/alerts'),true))return array_merge($business,array('page'));
 if($path==='/audit-events')return array('q','object_type','object_id','activity_id','operation_id','revision_id','actor_id','event_id','target_version','audit_action','result','date_from','date_to','cursor','direction');
 if($path==='/reports/activities')return $business;
 if($path==='/reports/operations')return array_merge($business,array('type_id','operation_status'));
 if($path==='/reports/activity_detail')return $business;
 if($path==='/reports/portfolio')return array_merge($business,array('grouping'));
 return null;
}
function mjl_api_decode($raw)
{
 try{$value=json_decode($raw,false,32,JSON_THROW_ON_ERROR);}catch(Throwable $e){mjl_api_fail(400,'invalid_request');}
 if(!($value instanceof stdClass))mjl_api_fail(400,'invalid_request');
 // json_decode accepts duplicate names. Reject them in each object, including escaped names.
 preg_match_all('/"(?:[^"\\\\]|\\\\.)*"|[{}\\[\\]:,]|-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null/s',$raw,$matched);
 $stack=array();$tokens=$matched[0];
 foreach($tokens as $i=>$token){
  if($token==='{'||$token==='[')$stack[]=array('object'=>$token==='{','keys'=>array());
  elseif($token==='}'||$token===']')array_pop($stack);
  elseif(isset($tokens[$i+1])&&$tokens[$i+1]===':'&&substr($token,0,1)==='"'){
   $key=json_decode($token);$index=count($stack)-1;
   if(isset($stack[$index]['keys'][$key]))mjl_api_fail(400,'invalid_request');
   $stack[$index]['keys'][$key]=true;
  }
 }
 return $value;
}
function mjl_api_request()
{
 $method=strtoupper($_SERVER['REQUEST_METHOD']??'GET');
 $path=$_SERVER['PATH_INFO']??'';
 if(!preg_match('~^/v1/(auth/session|auth/login|auth/otp/(verify|resend)|auth/invitations/(inspect|accept)|auth/password-resets(?:/(inspect|consume))?|dashboard|alerts|audit-events|reports/(?:activities|operations|activity_detail|portfolio|audit)(?:/exports)?|operations(?:/[1-9][0-9]{0,18}(?:/(?:execution|cancellation-requests|reopening-requests|expenses(?:/[1-9][0-9]{0,18}(?:/(?:submission|withdrawal|decisions))?)?))?)?|spending-operations|exception-requests|(?:cancellation-requests|reopening-requests)/[1-9][0-9]{0,18}/(?:withdrawal|decisions)|submission-tokens|assignment-agents|monitoring-options|activities(?:/[1-9][0-9]{0,18}(?:/(?:structure|submissions|abandonment|restoration|assignment-changes|cancellation-requests|review|timeline|revisions/[1-9][0-9]{0,18}/decisions))?)?|(?:partners|projects|operation-types)(?:/[1-9][0-9]{0,18}(?:/activation)?)?)$~D',$path))mjl_api_fail(404,'not_found');
 $path=substr($path,3);
 $query=array();
 foreach(explode('&',$_SERVER['QUERY_STRING']??'') as $pair){
  if($pair==='')continue;
  $pieces=explode('=',$pair,2);$key=urldecode($pieces[0]);$value=urldecode($pieces[1]??'');
  if ($method !== 'GET' || isset($query[$key])) mjl_api_fail(400, 'invalid_request');
  $reportingFields=mjl_api_query_fields($path);
  if ($reportingFields!==null) {
   if(!in_array($key,$reportingFields,true)||strlen($value)>400)mjl_api_fail(400,'invalid_request');
   if(in_array($key,array('partner_id','project_id','activity_id','object_id','operation_id','revision_id','actor_id','event_id','target_version','cursor'),true)&&$value!=='')mjl_api_id($value);
   if($key==='page'&&(!preg_match('/^[1-9][0-9]{0,5}$/D',$value)||(int)$value>200000))mjl_api_fail(400,'invalid_request');
  } elseif ($key === 'page' && in_array($path, array('/partners', '/projects', '/operation-types', '/assignment-agents'), true)) {
   if (!preg_match('/^[1-9][0-9]{0,5}$/D', $value) || (int) $value > 200000) mjl_api_fail(400, 'invalid_request');
  } elseif ($key === 'page' && ($path === '/spending-operations' || preg_match('~^/operations/[1-9][0-9]*/expenses$~D', $path))) {
   if (!preg_match('/^[1-9][0-9]{0,5}$/D', $value) || (int)$value > 200000) mjl_api_fail(400, 'invalid_request');
  } elseif ($key === 'partner_id' && $path === '/projects') mjl_api_id($value);
  elseif (in_array($path,array('/activities','/operations','/exception-requests'),true) && in_array($key, array('q','partner_id','project_id','activity_id','validation_status','execution_status','completeness','date_from','date_to','page'), true)) {
   if (strlen($value) > 400) mjl_api_fail(400, 'invalid_request');
  } elseif ($path === '/operations' && in_array($key,array('type_id','operation_status'),true)) {
   if(strlen($value)>40)mjl_api_fail(400,'invalid_request');
  } elseif ($path === '/exception-requests' && in_array($key,array('type','status','request_id'),true)) {
   if(strlen($value)>40)mjl_api_fail(400,'invalid_request');
  } elseif ($key === 'cursor' && preg_match('~^/activities/[1-9][0-9]*/timeline$~D', $path)) mjl_api_id($value);
  else mjl_api_fail(400, 'invalid_request');
  $query[$key]=$value;
 }
 if($_POST||$_FILES)mjl_api_fail(415,'unsupported_media_type');
 $reference = preg_match('~^/(partners|projects|operation-types)(/|$)~', $path);
 $collection = in_array($path, array('/partners', '/projects', '/operation-types'), true);
 $allowed = $path === '/auth/session' ? array('GET', 'DELETE') : ($reference ? ($collection ? array('GET', 'POST') : (substr($path, -11) === '/activation' ? array('PUT') : array('GET', 'PATCH'))) : array('POST'));
 if ($path === '/activities') $allowed = array('GET','POST');
 elseif (in_array($path,array('/assignment-agents','/monitoring-options'),true) || preg_match('~^/activities/[1-9][0-9]*(?:/(?:review|timeline))?$~D',$path)) $allowed = array('GET');
 elseif (strpos($path,'/activities/') === 0) $allowed = substr($path,-10)==='/structure' ? array('PUT') : array('POST');
 if(in_array($path,array('/operations','/spending-operations','/exception-requests'),true)||preg_match('~^/operations/[1-9][0-9]*$~D',$path))$allowed=array('GET');
 elseif(preg_match('~^/operations/[1-9][0-9]*/expenses$~D',$path))$allowed=array('GET','POST');
 elseif(preg_match('~^/operations/[1-9][0-9]*/(?:execution|expenses/[1-9][0-9]*)$~D',$path))$allowed=array('PUT');
 if(in_array($path,array('/dashboard','/alerts','/audit-events'),true)||preg_match('~^/reports/(?:activities|operations|activity_detail|portfolio|audit)$~D',$path))$allowed=array('GET');
 elseif(preg_match('~^/reports/(?:activities|operations|activity_detail|portfolio|audit)/exports$~D',$path))$allowed=array('POST');
 if(!in_array($method,$allowed,true)){header('Allow: '.implode(', ',$allowed));mjl_api_fail(405,'method_not_allowed');}
 $body=new stdClass();
 $limit = strpos($path,'/activities') === 0 ? 65536 : 16384;
 $raw=file_get_contents('php://input',false,null,0,$limit+1);
 if(strlen($raw)>$limit)mjl_api_fail(413,'payload_too_large');
 if(in_array($method,array('GET','DELETE'),true)&&$raw!=='')mjl_api_fail(400,'invalid_request');
 if(!in_array($method,array('GET','DELETE'),true)){
  if($raw!==''){
   if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')mjl_api_fail(415,'unsupported_media_type');
   $body=mjl_api_decode($raw);
  }
 }
 return array('method'=>$method,'path'=>$path,'query'=>$query,'body'=>$body);
}
function mjl_api_csrf()
{
 $token=$_SERVER['HTTP_X_CSRF_TOKEN']??'';
 if(!is_string($token)||$token===''||!hash_equals(mjl_auth_session_api_csrf(),$token))mjl_api_fail(403,'csrf_invalid');
 if(isset($_SERVER['HTTP_SEC_FETCH_SITE'])&&!in_array($_SERVER['HTTP_SEC_FETCH_SITE'],array('same-origin','none'),true))mjl_api_fail(403,'csrf_invalid');
 if(isset($_SERVER['HTTP_ORIGIN'])){
  $origin=parse_url($_SERVER['HTTP_ORIGIN']);$expected=parse_url(DOL_MAIN_URL_ROOT);
  if(!$origin||!$expected||($origin['scheme']??'')!==($expected['scheme']??'')||strtolower($origin['host']??'')!==strtolower($expected['host']??'')||($origin['port']??(($origin['scheme']??'')==='https'?443:80))!==($expected['port']??(($expected['scheme']??'')==='https'?443:80)))mjl_api_fail(403,'csrf_invalid');
 }
}
