<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

function mjl_api_actor($required=false)
{
 global $db,$user;
 $login=mjl_auth_session_value('dol_login','');
 if($required&&!mjl_auth_otp_enabled())mjl_api_fail(503,'authentication_unavailable');
 if($login===''){if($required)mjl_api_fail(401,'authentication_required');return null;}
 $actor=new User($db);
 $entity=(int)mjl_auth_session_value('dol_entity',0);
 if($entity<=0||$entity!==mjl_auth_entity()||$actor->fetch(0,$login,'',1,$entity)<=0){mjl_auth_session_invalidate('');mjl_api_fail(401,'session_invalidated');}
 $code=mjl_auth_check_session($actor,false);
 if($code!=='valid')mjl_api_fail($code==='authentication_unavailable'?503:401,$code);
 $user=$actor;
 return $actor;
}
function mjl_api_session($actor=null)
{
 $clock=mjl_auth_session_clock_state();$otp=null;$user=null;$actions=array();
 if($actor){
  $role=mjl_scope_effective_role_code($actor,mjl_auth_entity());
  $user=array('id'=>(string)$actor->id,'login'=>(string)$actor->login,'firstname'=>(string)$actor->firstname,'lastname'=>(string)$actor->lastname,'email'=>(string)$actor->email,'role'=>$role,'active'=>true,'native_admin'=>!empty($actor->admin));
  if(in_array($role,mjl_auth_business_role_codes(),true))$actions=array('listPartners','getPartner','listProjects','getProject','listOperationTypes','getOperationType');
  if($role==='VALIDATEUR_DEFINITIF')$actions=array_merge($actions,array('createPartner','renamePartner','setPartnerActive','createProject','renameProject','setProjectActive','createOperationType','renameOperationType','setOperationTypeActive'));
 }elseif(mjl_auth_otp_enabled()&&mjl_auth_otp_pending()){
  $row=mjl_auth_otp_pending_row();
  if($row){$email=mjl_auth_session_pending_email();$at=strrpos($email,'@');
   $otp=array('masked_email'=>$at===false?'':substr($email,0,1).'••••'.substr($email,$at),'expires_at'=>gmdate('c',strtotime($row->date_expiry)),'resend_available_at'=>gmdate('c',strtotime($row->date_last_send)+60),'resends_remaining'=>max(0,3-(int)$row->resend_count));
  }
 }
 return array('data'=>array('state'=>$actor?'authenticated':($otp?'otp_pending':'anonymous'),'csrf_token'=>mjl_auth_session_api_csrf(),'user'=>$user,'authenticated_at'=>$actor?gmdate('c',$clock['authenticated_at']):null,'idle_expires_at'=>$actor?gmdate('c',$clock['last_activity_at']+86400):null,'absolute_expires_at'=>$actor?gmdate('c',$clock['authenticated_at']+86400):null,'otp'=>$otp,'allowed_actions'=>$actions));
}
function mjl_api_link($kind,$body)
{
 global $db;
 mjl_api_string($body->selector,128);mjl_api_string($body->verifier,512);
 $row=$kind==='invitations'?mjl_auth_fetch_invitation_by_selector($body->selector):mjl_auth_fetch_reset_by_selector($body->selector);
 if(!$row||$row->status!=='sent'||strtotime($row->date_expiry)<dol_now()||empty($row->token_hash)||!hash_equals((string)$row->token_hash,mjl_auth_token_hash($body->verifier)))return null;
 $target=new User($db);
 if($target->fetch((int)$row->fk_user)<=0)return null;
 if($kind==='invitations'&&(!empty($target->admin)||(int)$target->entity!==mjl_auth_entity()||(int)$target->statut!==0))return null;
 if($kind==='password-resets'){
  $inScope=((int)$target->admin===1&&(int)$target->entity===0)||((int)$target->admin===0&&(int)$target->entity===mjl_auth_entity());
  if((int)$target->statut!==1||!$inScope||mjl_scope_effective_role_code($target,mjl_auth_entity())==='')return null;
 }
 return $target;
}
function mjl_api_auth(array $request)
{
 $path=$request['path'];$body=$request['body'];$method=$request['method'];
 if($path==='/auth/session'){
  mjl_api_fields($body,array());
  if($method==='DELETE'){
   // Logout also clears invalid/expired sessions without granting access.
   try{$actor=mjl_api_actor();}catch(MjlApiError $e){$actor=null;}
   if($actor)$actor->call_trigger('USER_LOGOUT',$actor);
   mjl_auth_session_logout();return array(204);
  }
  return array(200,mjl_api_session(mjl_api_actor()));
 }
 $command=mjl_auth_command();
 if(in_array($path,array('/auth/login','/auth/otp/verify','/auth/otp/resend'),true)){
  if(!mjl_auth_otp_enabled()||!mjl_auth_otp_table_ready())mjl_api_fail(503,'authentication_unavailable');
  if($path==='/auth/login'){
   mjl_api_fields($body,array('email','password'));
   $result=$command->startOtp(mjl_api_string($body->email,255),mjl_api_string($body->password));
  }elseif($path==='/auth/otp/verify'){
   mjl_api_fields($body,array('code'));mjl_api_string($body->code,6);
   if(!preg_match('/^[0-9]{6}$/D',$body->code))mjl_api_fail(422,'invalid_input');
   $result=$command->verifyOtp($body->code);
  }else{mjl_api_fields($body,array());$result=$command->resendOtp();}
  if(!$result[0]){
   $code=$result[2]??'unavailable';$statuses=array('invalid_credentials'=>401,'invalid_otp'=>401,'authentication_required'=>401,'otp_expired'=>401,'rate_limited'=>429);
   if($code==='rate_limited'&&!empty($result[3]))header('Retry-After: '.(int)$result[3]);
   mjl_api_fail($statuses[$code]??503,$code);
  }
  return array($path==='/auth/login'?202:200,mjl_api_session($path==='/auth/otp/verify'?mjl_api_actor(true):null));
 }
 if($path==='/auth/password-resets'){
  mjl_api_fields($body,array('email'));mjl_api_string($body->email,255);
  $command->createPasswordReset($body->email);
  return array(202,array('message'=>'Si le compte est éligible, un lien de réinitialisation sera envoyé.'));
 }
 preg_match('~^/auth/(invitations|password-resets)/(inspect|accept|consume)$~',$path,$matches);
 if(!$matches)mjl_api_fail(404,'not_found');
 $inspect=$matches[2]==='inspect';
 mjl_api_fields($body,$inspect?array('selector','verifier'):array('selector','verifier','password','password_confirmation'));
 $target=mjl_api_link($matches[1],$body);
 if($inspect)return array(200,array('data'=>array('valid'=>(bool)$target,'email'=>$target?(string)$target->email:null)));
 if(!$target)mjl_api_fail(422,'invalid_input');
 mjl_api_string($body->password);mjl_api_string($body->password_confirmation);
 if(mjl_auth_password_error($body->password,$body->password_confirmation)!=='')mjl_api_fail(422,'invalid_input');
 $error=$matches[1]==='invitations'?$command->acceptInvitation($body->selector,$body->verifier,$body->password,$body->password_confirmation):$command->consumePasswordReset($body->selector,$body->verifier,$body->password,$body->password_confirmation);
 if($error!=='')mjl_api_fail(503,'unavailable');
 mjl_auth_session_cancel();
 mjl_auth_session_set_login_message('Votre mot de passe a été enregistré. Vous pouvez vous connecter.');
 return array(200,array('message'=>'Votre mot de passe a été enregistré. Vous pouvez vous connecter.'));
}
