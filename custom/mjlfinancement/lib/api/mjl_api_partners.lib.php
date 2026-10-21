<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reference.lib.php';

/** Map scoped reference reads to the REST response. */
function mjl_api_partner_read($id = null, $page = 1)
{
 global $db, $user;
 $manage = mjl_reference_can_manage($user);
 $result = mjl_reference_read_page($db, mjl_auth_entity(), $manage, $id, $page);
 if ($id !== null && !$result['data']) mjl_api_fail(404, 'not_found');
 foreach ($result['data'] as &$row) {
  $row['allowed_actions'] = $manage ? array('getPartner', 'renamePartner', 'setPartnerActive') : array('getPartner');
 }
 unset($row);
 return $id !== null ? array('data' => $result['data'][0]) : $result;
}
function mjl_api_partner_context($action,$id,$actor)
{
 return array('user_id'=>(int)$actor->id,'entity'=>mjl_auth_entity(),'route'=>'api_partners','form'=>'reference','action'=>$action,'object_id'=>(int)$id);
}
function mjl_api_partners(array $request,User $actor)
{
 global $db;
 if(!mjl_scope_user_has_active_business_role($actor))mjl_api_fail(403,'forbidden');
 $path=$request['path'];$method=$request['method'];$body=$request['body'];
 if($method==='GET'){
  mjl_api_fields($body,array());
  $id=$path==='/partners'?null:mjl_api_id(substr($path,10));
  $data=mjl_api_partner_read($id,(int)($request['query']['page']??1));
  mjl_auth_session_touch(time());return array(200,$data);
 }
 if(!mjl_reference_can_manage($actor))mjl_api_fail(403,'forbidden');
 if($path==='/submission-tokens'){
  mjl_api_fields($body,array('operation_id','path_parameters'));
  $actions=array('createPartner','renamePartner','setPartnerActive');
  if(!is_string($body->operation_id)||!in_array($body->operation_id,$actions,true))mjl_api_fail(400,'invalid_request');
  $creating=$body->operation_id==='createPartner';
  mjl_api_fields($body->path_parameters,$creating?array():array('id'));
  $id=$creating?'0':mjl_api_id($body->path_parameters->id);
  if(!$creating)mjl_api_partner_read($id);
  $token=mjl_form_submission_issue(mjl_api_partner_context($body->operation_id,$id,$actor));
  if($token==='')mjl_api_fail(503,'unavailable');
  return array(200,array('data'=>array('token'=>$token,'expires_at'=>gmdate('c',min(time()+MJL_FORM_SUBMISSION_TTL,mjl_auth_session_value('mjl_authenticated_at')+86400,mjl_auth_session_value('mjl_last_activity_at')+86400)))));
 }
 $creating=$path==='/partners';$active=substr($path,-11)==='/activation';
 $id=$creating?'0':mjl_api_id(explode('/',$path)[2]);
 $operation=$creating?'createPartner':($active?'setPartnerActive':'renamePartner');
 mjl_api_fields($body,$creating?array('label'):($active?array('active','fingerprint'):array('label','fingerprint')));
 if(!$creating){mjl_api_string($body->fingerprint,64);if(!preg_match('/^[a-f0-9]{64}$/D',$body->fingerprint))mjl_api_fail(422,'invalid_input');mjl_api_partner_read($id);}
 if($active){if(!is_bool($body->active))mjl_api_fail(400,'invalid_request');}
 else{
  mjl_api_string($body->label,2048);$label=trim($body->label);
  if($label===''||mb_strlen($label)>255||preg_match('/[\x00-\x1F\x7F]/u',$label))mjl_api_fail(422,'invalid_input');
  if(class_exists('Normalizer'))$label=Normalizer::normalize($label,Normalizer::FORM_C);
 }
 $token=$_SERVER['HTTP_X_MJL_SUBMISSION']??'';
 if(!mjl_form_submission_consume($token,mjl_api_partner_context($operation,$id,$actor)))mjl_api_fail(403,'submission_invalid');
 $command=new MjlReferenceCommand($db,$actor,mjl_auth_entity());
 try{
  if($creating){$result=$command->create('partner',$label);$id=(string)$result[0];}
  elseif($active)$command->setActive('partner',$id,$body->active,$body->fingerprint);
  else $command->updateLabel('partner',$id,$label,$body->fingerprint);
 }catch(MjlReferenceCommandForbidden $e){}
 $code=$command->outcomeCode();
 if($code!=='OK'){
  $codes=array('INVALID_INPUT'=>array(422,'invalid_input'),'FORBIDDEN'=>array(403,'forbidden'),'NOT_FOUND'=>array(404,'not_found'),'STALE_FINGERPRINT'=>array(409,'stale_fingerprint'),'OUTCOME_UNKNOWN'=>array(503,'outcome_unknown'));
  $mapped=$codes[$code]??array(503,'unavailable');mjl_api_fail($mapped[0],$mapped[1]);
 }
 mjl_auth_session_touch(time());
 return array($creating?201:200,array('data'=>array('code'=>'OK','id'=>$id)));
}
