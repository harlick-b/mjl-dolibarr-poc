<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_auth.lib.php';

function mjl_api_access_timestamp($value)
{
 return $value===null||$value===''?null:gmdate('c',strtotime($value));
}

function mjl_api_access_page($kind,$page)
{
 global $db;
 $entity=mjl_auth_entity();$offset=($page-1)*50;$rows=array();
 if($kind==='users'){
  $sql="SELECT u.rowid,u.login,u.firstname,u.lastname,u.email,u.statut,u.admin,CASE WHEN u.admin=1 THEN 'ADMIN_PLATEFORME' ELSE r.role_code END role_code FROM ".$db->prefix().'user u LEFT JOIN '.$db->prefix().'mjlfinancement_user_role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 WHERE u.entity='.$entity.' AND (r.rowid IS NOT NULL OR u.admin=1) ORDER BY u.login ASC,u.rowid ASC LIMIT 51 OFFSET '.$offset;
 }else{
  $sql='SELECT i.rowid,i.status,i.date_sent,i.date_expiry,u.login,u.email FROM '.$db->prefix().'mjlfinancement_invitation i INNER JOIN '.$db->prefix().'user u ON u.rowid=i.fk_user AND u.entity=i.entity WHERE i.entity='.$entity.' ORDER BY i.rowid DESC LIMIT 51 OFFSET '.$offset;
 }
 $resql=$db->query($sql);if(!$resql)mjl_api_fail(503,'unavailable');
 while($row=$db->fetch_object($resql)){
  if($kind==='users')$rows[]=array('id'=>(string)$row->rowid,'login'=>(string)$row->login,'firstname'=>(string)$row->firstname,'lastname'=>(string)$row->lastname,'email'=>(string)$row->email,'role'=>$row->role_code!==null?(string)$row->role_code:null,'active'=>(int)$row->statut===1,'native_admin'=>(bool)$row->admin);
  else $rows[]=array('id'=>(string)$row->rowid,'login'=>(string)$row->login,'email'=>(string)$row->email,'status'=>(string)$row->status,'sent_at'=>mjl_api_access_timestamp($row->date_sent),'expires_at'=>mjl_api_access_timestamp($row->date_expiry));
 }
 $hasNext=count($rows)>50;if($hasNext)array_pop($rows);
 return array('data'=>$rows,'pagination'=>array('page'=>$page,'page_size'=>50,'has_next'=>$hasNext));
}

function mjl_api_access_command_error($message,$invite=false)
{
 if($invite&&in_array($message,array('Échec de l’envoi.','Le résultat de l’envoi n’a pas pu être enregistré.'),true))mjl_api_fail(503,'invitation_delivery_failed');
 if(strpos($message,'invalide')!==false||strpos($message,'obligatoires')!==false)mjl_api_fail(422,'invalid_input');
 if(strpos($message,'introuvable')!==false)mjl_api_fail(404,'not_found');
 if(strpos($message,'interdite')!==false||strpos($message,'propre accès')!==false)mjl_api_fail(403,'forbidden');
 if(strpos($message,'déjà')!==false||strpos($message,'utilisée')!==false||strpos($message,'ne peut pas être invité')!==false||strpos($message,'affectations')!==false||strpos($message,'administrateur')!==false||strpos($message,'concurrente')!==false)mjl_api_fail(409,'conflict');
 mjl_api_fail(503,'unavailable');
}

function mjl_api_access(array $request,User $actor)
{
 if(!mjl_scope_is_platform_admin($actor,mjl_auth_entity()))mjl_api_fail(403,'forbidden');
 $path=$request['path'];$method=$request['method'];$body=$request['body'];
 if($method==='GET'){
  mjl_api_fields($body,array());$page=(int)($request['query']['page']??1);
  $result=mjl_api_access_page($path==='/admin/users'?'users':'invitations',$page);mjl_auth_session_touch(time());return array(200,$result);
 }
 if($path==='/admin/invitations'){
  mjl_api_fields($body,array('login','firstname','lastname','email','role_code'));
  foreach(array('login'=>50,'firstname'=>255,'lastname'=>255,'email'=>255,'role_code'=>40) as $field=>$max)mjl_api_string($body->$field,$max);
  $result=mjl_auth_command()->issueInvitation((array)$body,$actor);
  if($result[1]!=='')mjl_api_access_command_error($result[1],true);
  mjl_auth_session_touch(time());return array(201,array('delivery'=>'sent','message'=>'Invitation envoyée.'));
 }
 if(preg_match('~^/admin/users/([1-9][0-9]*)/role$~D',$path,$match)){
  mjl_api_fields($body,array('role_code'));mjl_api_string($body->role_code,40);
  if(!in_array($body->role_code,mjl_auth_business_role_codes(),true))mjl_api_fail(422,'invalid_input');
  $result=(new MjlAccessCommand($GLOBALS['db'],mjl_auth_entity()))->assignProfile((int)$match[1],$body->role_code,$actor,'admin_access','Modification administrateur');
 }elseif(preg_match('~^/admin/users/([1-9][0-9]*)/deactivation$~D',$path,$match)){
  mjl_api_fields($body,array());$result=(new MjlAccessCommand($GLOBALS['db'],mjl_auth_entity()))->deactivate((int)$match[1],$actor);
 }elseif(preg_match('~^/admin/invitations/([1-9][0-9]*)/revocation$~D',$path,$match)){
  mjl_api_fields($body,array());$result=mjl_auth_command()->revokeInvitation((int)$match[1],$actor);
 }else mjl_api_fail(404,'not_found');
 if($result[0]<0)mjl_api_access_command_error($result[1]);
 mjl_auth_session_touch(time());return array(200,array('data'=>array('code'=>'OK')));
}
