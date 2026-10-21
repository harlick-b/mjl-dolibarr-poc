<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/monitoring/mjl_monitoring_read.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_monitoring_work.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/audit/mjl_audit_timeline_read.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivityassignment.class.php';

/** Finite Activity operations; command owners retain all business and transaction guards. */
function mjl_api_activity_operations()
{
 return array('createActivity','replaceActivityStructure','submitActivity','abandonActivity','restoreActivity','changeAssignment','requestActivityCancellation','reviewActivity');
}
function mjl_api_activity_actions(array $row, User $actor)
{
 $role=mjl_scope_effective_role_code($actor,mjl_auth_entity());
 $flags=mjl_monitoring_activity_actions($row,$role,$actor->id,mjl_monitoring_date());
 $actions=array('getActivity','getActivityTimeline');
 if($flags['edit'])$actions=array_merge($actions,array('replaceActivityStructure','submitActivity'));
 if($flags['abandon'])$actions[]='abandonActivity';
 if($flags['restore'])$actions[]='restoreActivity';
 if($role==='VALIDATEUR_DEFINITIF'&&!in_array($row['validation_status'],array('ABANDONED','CANCELLED'),true))$actions[]='changeAssignment';
 if(in_array($role,array('AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF'),true)&&!empty($row['fk_current_revision']))$actions[]='getActivityReview';
 if($flags['review'])$actions[]='reviewActivity';
 if($role==='AGENT_SAISIE'&&!empty($row['fk_current_revision'])&&empty($row['is_cancelled'])&&$row['validation_status']!=='ABANDONED')$actions[]='requestActivityCancellation';
 return $actions;
}
function mjl_api_activity_project(array $row, User $actor)
{
 $out=array('id'=>(string)$row['rowid'],'version'=>(string)$row['version'],'ref'=>$row['ref'],'partner_id'=>(string)$row['fk_partner'],'partner_label'=>$row['partner_name'],'project_id'=>(string)$row['fk_project'],'project_label'=>$row['project_name']);
 foreach(array('name','description','date_start','date_end','draft_authorized_amount','validation_status','execution_status','completeness') as $key)$out[$key]=(string)$row[$key];
 $out['current_revision_id']=empty($row['fk_current_revision'])?null:(string)$row['fk_current_revision'];
 $out['financial']=mjl_monitoring_totals(array($row));
 $out['assignments']=array_map(function($a){return array('user_id'=>(string)$a['fk_user'],'name'=>trim($a['firstname'].' '.$a['lastname'])?:$a['login'],'primary'=>(bool)$a['is_primary']);},$row['assignments']);
 $flags=mjl_monitoring_activity_actions($row,mjl_scope_effective_role_code($actor,mjl_auth_entity()),$actor->id,mjl_monitoring_date());
 $out['operations']=array_map(function($o) use($out,$flags){return array('id'=>(string)$o['rowid'],'version'=>(string)$o['version'],'activity_id'=>$out['id'],'name'=>$o['name'],'type_id'=>(string)$o['fk_operation_type'],'type_label'=>$o['type_label'],'status'=>$o['status'],'authorized_amount'=>(string)$o['authorized_amount'],'authorization_kind'=>$out['financial']['validated_amount']===null?'PROPOSED':'VALIDATED','spent_amount'=>isset($o['spent_amount'])?(string)$o['spent_amount']:null,'observation'=>$o['observation'],'allowed_actions'=>$flags['execution']&&!in_array($o['status'],array('COMPLETED','CANCELLED'),true)?array('updateExecution'):array());},$row['operations']);
 $out['allowed_actions']=mjl_api_activity_actions($row,$actor);
 return $out;
}
function mjl_api_activity_context(User $actor,$operation,$id='0',$version='0',$revision='0')
{
 return array('user_id'=>(int)$actor->id,'entity'=>mjl_auth_entity(),'route'=>'api_activities','form'=>'activity','action'=>$operation,'object_id'=>$id,'version'=>$version,'revision_id'=>$revision);
}
function mjl_api_activity_row(User $actor,$id)
{
 global $db;
 if(!mjl_activity_access_can_read_activity($actor,$id))mjl_api_fail(404,'not_found');
 return mjl_monitoring_read_activity_context($db,$actor,mjl_auth_entity(),array('rowid'=>$id));
}
function mjl_api_activity_token(stdClass $body,User $actor)
{
 if(!mjl_activity_access_can_enter_list($actor))mjl_api_fail(403,'forbidden');
 $operation=$body->operation_id;
 $create=$operation==='createActivity';$review=$operation==='reviewActivity';
 mjl_api_fields($body,$create?array('operation_id','path_parameters'):array('operation_id','path_parameters','expected_version'),$review?array('revision_id'):array());
 mjl_api_fields($body->path_parameters,$create?array():($review?array('activity_id','revision_id'):array('activity_id')));
 $id=$create?'0':mjl_api_id($body->path_parameters->activity_id);
 $version=$create?'0':mjl_api_id($body->expected_version);
 $revision=$review?mjl_api_id($body->path_parameters->revision_id):'0';
 if(property_exists($body,'revision_id')&&mjl_api_id($body->revision_id)!==$revision)mjl_api_fail(400,'invalid_request');
 if($create){if(!mjl_scope_is_input_agent($actor,mjl_auth_entity()))mjl_api_fail(403,'forbidden');}
 else{
  $row=mjl_api_activity_row($actor,$id);
  if((string)$row['version']!==$version||($review&&(string)$row['fk_current_revision']!==$revision))mjl_api_fail(409,'stale_version');
  if(!in_array($operation,mjl_api_activity_actions($row,$actor),true))mjl_api_fail(403,'forbidden');
 }
 $token=mjl_form_submission_issue(mjl_api_activity_context($actor,$operation,$id,$version,$revision));
 if($token==='')mjl_api_fail(503,'unavailable');
 $expires=min(time()+MJL_FORM_SUBMISSION_TTL,mjl_auth_session_value('mjl_authenticated_at')+86400,mjl_auth_session_value('mjl_last_activity_at')+86400);
 return array(200,array('data'=>array('token'=>$token,'expires_at'=>gmdate('c',$expires))));
}
function mjl_api_activity_structure(stdClass $body,$create)
{
 $keys=array('partner_id','project_id','name','description','date_start','date_end','authorized_amount','operations');
 mjl_api_fields($body,array_merge($keys,array($create?'submit':'expected_version')));
 $out=array();
 foreach($keys as $key){
  if($key==='operations')continue;
  $out[$key]=in_array($key,array('partner_id','project_id','authorized_amount'),true)?mjl_api_id($body->$key):mjl_api_string($body->$key,16000);
 }
 if(!is_array($body->operations)||count($body->operations)>50)mjl_api_fail(422,'invalid_input');
 $out['operations']=array();$seen=array();
 foreach($body->operations as $op){
  mjl_api_fields($op,array('client_key','name','type_id','authorized_amount'),$create?array():array('id','expected_version'));
  if(property_exists($op,'id')!==property_exists($op,'expected_version'))mjl_api_fail(400,'invalid_request');
  $item=array();
  if(property_exists($op,'id')){$item['id']=mjl_api_id($op->id);$item['expected_version']=mjl_api_id($op->expected_version);}
  $key=mjl_api_string($op->client_key,64);
  if(!preg_match('/^[a-zA-Z0-9_-]{1,64}$/D',$key)||isset($seen[$key]))mjl_api_fail(422,'invalid_input');
  $seen[$key]=true;
  $item+=array('client_key'=>$key,'name'=>mjl_api_string($op->name,1020),'type_id'=>mjl_api_id($op->type_id),'authorized_amount'=>mjl_api_id($op->authorized_amount));
  $out['operations'][]=$item;
 }
 if($create&&!is_bool($body->submit))mjl_api_fail(400,'invalid_request');
 return $out;
}
function mjl_api_activities(array $request,User $actor)
{
 global $db;
 if(!mjl_activity_access_can_enter_list($actor))mjl_api_fail(403,'forbidden');
 mjl_rst006b_require_target($db);
 if(mjl_monitoring_readiness()!==1)mjl_api_fail(503,'unavailable');
 $path=$request['path'];$body=$request['body'];$entity=mjl_auth_entity();
 $parts=explode('/',$path);$id=isset($parts[2])?mjl_api_id($parts[2]):null;$suffix=$parts[3]??'';
 if($request['method']==='GET'){
  mjl_api_fields($body,array());
  if($path==='/assignment-agents'){
   if(!mjl_scope_is_final_validator($actor,$entity))mjl_api_fail(403,'forbidden');
   $page=(int)($request['query']['page']??1);
   $agents=mjl_monitoring_read_agent_options($db,$entity,$page);
   $data=array('data'=>array_map(function($a){return array('id'=>(string)$a['rowid'],'name'=>trim($a['firstname'].' '.$a['lastname'])?:$a['login']);},array_slice($agents,0,50)),'pagination'=>array('page'=>$page,'page_size'=>50,'has_next'=>count($agents)>50));
  }elseif($path==='/monitoring-options'){
   $choices=mjl_monitoring_read_snapshot($db,function()use($db,$actor,$entity){return (new MjlMonitoring($db,$actor,$entity))->referenceChoices(true);},'mjl API choices',true);
   foreach($choices as &$rows)foreach($rows as &$choice)$choice['id']=(string)$choice['id'];unset($rows,$choice);
   $data=array('data'=>$choices);
  }elseif($id===null){
   try{$filters=mjl_monitoring_validate_request($request['query']);}catch(InvalidArgumentException $e){mjl_api_fail(400,'invalid_request');}
   $data=mjl_monitoring_read_snapshot($db,function()use($db,$actor,$entity,$filters){
    $reader=new MjlMonitoring($db,$actor,$entity);$all=$reader->activities($filters);$page=(int)$filters['page'];
    $rows=$reader->reviewFacts(array_slice($all,($page-1)*50,50));
    return array('data'=>array_map(function($row)use($actor){return mjl_api_activity_project($row,$actor);},$rows),'pagination'=>array('page'=>$page,'page_size'=>50,'has_next'=>count($all)>$page*50),'totals'=>mjl_monitoring_totals($all));
   },'mjl API activities',true);
  }else{
   $row=mjl_api_activity_row($actor,$id);
   if($suffix==='')$data=array('data'=>mjl_api_activity_project($row,$actor));
   elseif($suffix==='review')$data=array('data'=>mjl_api_activity_review($row,$actor));
   else{
    $events=mjl_audit_timeline_read($db,$actor,$entity,$id,$request['query']['cursor']??'', $failure);
    if($events===false)mjl_api_fail($failure==='invalid_cursor'?400:503,$failure==='invalid_cursor'?'invalid_request':'unavailable');
    $more=count($events)>50;$events=array_slice($events,0,50);
    $data=array('data'=>array_map(function($e){return array('id'=>(string)$e['rowid'],'date'=>mjl_api_activity_timestamp($e['sort_date']),'label'=>$e['title'],'actor_name'=>$e['actor'],'summary'=>$e['title'],'detail_status'=>$e['detail_status'],'details'=>$e['detail']===''?array():array($e['detail']),'actor_role'=>$e['role']);},$events),'pagination'=>array('next_cursor'=>$more?(string)$events[49]['rowid']:null,'has_next'=>$more));
   }
  }
  mjl_auth_session_touch(time());return array(200,$data);
 }
 return mjl_api_activity_write($request,$actor,$id,$suffix);
}
function mjl_api_activity_timestamp($date)
{
 return (new DateTimeImmutable($date,new DateTimeZone(date_default_timezone_get())))->format('c');
}
function mjl_api_activity_review(array $row,User $actor)
{
 global $db;
 if(!in_array('getActivityReview',mjl_api_activity_actions($row,$actor),true))mjl_api_fail(403,'forbidden');
 return mjl_monitoring_read_snapshot($db,function()use($db,$row,$actor){
  $reader=new MjlMonitoring($db,$actor,mjl_auth_entity());
  $rows=$reader->reviewFacts($reader->activities(mjl_monitoring_filters(array('activity_id'=>(string)$row['rowid']))));
  if(count($rows)!==1)mjl_api_fail(404,'not_found');
  $row=$rows[0];
  if(!in_array('getActivityReview',mjl_api_activity_actions($row,$actor),true))mjl_api_fail(403,'forbidden');
  $revision=mjl_monitoring_read_revision($db,mjl_auth_entity(),$row['rowid'],$row['fk_current_revision']);
  if(!$revision)mjl_api_fail(404,'not_found');
  $raw=json_decode($revision['snapshot_json'],true,32,JSON_THROW_ON_ERROR);$snapshot=array();
  foreach(array('partner_id','project_id','name','description','date_start','date_end','authorized_amount','partner_label','project_label','project_reference') as $key)$snapshot[$key]=(string)$raw['activity'][$key];
  $snapshot['operations']=array_map(function($o){return array('id'=>(string)$o['id'],'name'=>$o['name'],'type_id'=>(string)$o['type_id'],'type_label'=>$o['type_label'],'authorized_amount'=>(string)$o['authorized_amount']);},$raw['operations']);
  $history=mjl_monitoring_read_review_history($db,mjl_auth_entity(),$row['fk_current_revision']);
  $decisions=array_map(function($d){return array('decision'=>$d['decision_type'],'actor_name'=>$d['actor_name_snapshot'],'decided_at'=>mjl_api_activity_timestamp($d['date_decision']),'reason'=>$d['reason'],'requested_amount'=>isset($d['requested_amount'])?(string)$d['requested_amount']:null);},$history);
  $role=mjl_scope_effective_role_code($actor,mjl_auth_entity());$flags=mjl_monitoring_activity_actions($row,$role,$actor->id,mjl_monitoring_date());$allowed=array();
  if($flags['review']){$allowed[]=$role==='AGENT_VERIFICATEUR'?'PREVALIDATED':'FINAL_VALIDATED';if($flags['return'])$allowed[]=$role==='AGENT_VERIFICATEUR'?'RETURNED_SUPERVISOR':'RETURNED_VALIDATOR';}
  return array('revision_id'=>(string)$revision['rowid'],'revision_number'=>(string)$revision['revision_number'],'activity_version'=>(string)$row['version'],'submitted_at'=>mjl_api_activity_timestamp($revision['date_submitted']),'snapshot'=>$snapshot,'decisions'=>$decisions,'allowed_actions'=>$flags['review']?array('reviewActivity'):array(),'allowed_decisions'=>$allowed);
 },'mjl API review');
}
function mjl_api_activity_write(array $request,User $actor,$id,$suffix)
{
 global $db;
 $body=$request['body'];$create=$id===null;$revision='0';$structure=null;
 $operations=array('structure'=>'replaceActivityStructure','submissions'=>'submitActivity','abandonment'=>'abandonActivity','restoration'=>'restoreActivity','assignment-changes'=>'changeAssignment','cancellation-requests'=>'requestActivityCancellation','revisions'=>'reviewActivity');
 $operation=$create?'createActivity':$operations[$suffix];
 if($create||$suffix==='structure')$structure=mjl_api_activity_structure($body,$create);
 else{
  $fields=array('expected_version');$optional=array();
  if(in_array($suffix,array('abandonment','restoration','assignment-changes','cancellation-requests'),true))$fields[]='reason';
  if($suffix==='restoration')$fields[]='primary_agent_id';
  if($suffix==='assignment-changes')$fields=array_merge($fields,array('operation','target_agent_id'));
  if($suffix==='revisions'){$fields[]='decision';$optional=array('reason','requested_amount');$revision=mjl_api_id(explode('/',$request['path'])[4]);}
  mjl_api_fields($body,$fields,$optional);
 }
 $version=$create?'0':mjl_api_id($body->expected_version);
 $reason=isset($body->reason)?mjl_api_string($body->reason,8000):'';
 if(mb_strlen($reason)>2000||preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/',$reason))mjl_api_fail(422,'invalid_input');
 if(in_array($suffix,array('abandonment','restoration','assignment-changes','cancellation-requests'),true)&&trim($reason)==='')mjl_api_fail(422,'invalid_input');
 if($suffix==='restoration')mjl_api_id($body->primary_agent_id);
 if($suffix==='assignment-changes'){
  mjl_api_id($body->target_agent_id);
  if(!in_array($body->operation,array('ADD_ADDITIONAL','REMOVE_ADDITIONAL','TRANSFER_PRIMARY'),true))mjl_api_fail(422,'invalid_input');
 }
 $requested=null;
 if($suffix==='revisions'){
  if(!in_array($body->decision,array('PREVALIDATED','RETURNED_SUPERVISOR','FINAL_VALIDATED','RETURNED_VALIDATOR'),true))mjl_api_fail(422,'invalid_input');
  if(strpos($body->decision,'RETURNED_')===0&&trim($reason)==='')mjl_api_fail(422,'invalid_input');
  if(isset($body->requested_amount)){
   if($body->decision!=='RETURNED_VALIDATOR')mjl_api_fail(422,'invalid_input');
   $requested=mjl_api_id($body->requested_amount);
  }
 }
 if($create){if(!mjl_scope_is_input_agent($actor,mjl_auth_entity()))mjl_api_fail(403,'forbidden');}
 else mjl_api_activity_row($actor,$id);
 if(!mjl_form_submission_consume($_SERVER['HTTP_X_MJL_SUBMISSION']??'',mjl_api_activity_context($actor,$operation,$id??'0',$version,$revision)))mjl_api_fail(403,'submission_invalid');
 $command=new MjlActivityCommand($db,null,mjl_auth_entity());
 switch($operation){
  case 'createActivity':$result=$body->submit?$command->createAndSubmit($structure,$actor):$command->createDraft($structure,$actor);break;
  case 'replaceActivityStructure':$result=$command->saveStructure($id,$version,$structure,$actor);break;
  case 'submitActivity':$result=$command->submitRevision($id,$version,$actor);break;
  case 'abandonActivity':$result=$command->abandonDraft($id,$version,$actor,$reason);break;
  case 'restoreActivity':$result=$command->restoreDraft($id,$version,$actor,$body->primary_agent_id,$reason);break;
  case 'changeAssignment':$result=(new MjlActivityAssignment($db))->changeAssignment($id,$version,$actor,$body->operation,$body->target_agent_id,$reason);break;
  case 'requestActivityCancellation':$result=$command->requestCancellation('ACTIVITY',$id,$version,$reason,$actor);break;
  case 'reviewActivity':$result=$command->reviewRevision($id,$revision,$version,$actor,$body->decision,$reason,$requested);break;
 }
 if($result['code']!=='OK'){
  $map=array('INVALID_INPUT'=>array(422,'invalid_input'),'FORBIDDEN'=>array(403,'forbidden'),'NOT_FOUND'=>array(404,'not_found'),'STALE_VERSION'=>array(409,'stale_version'),'CONFLICT'=>array(409,'conflict'),'RETRYABLE_CONFLICT'=>array(409,'retryable_conflict'));
  $error=$map[$result['code']]??array(503,'unavailable');mjl_api_fail($error[0],$error[1]);
 }
 mjl_auth_session_touch(time());
 $data=array('code'=>'OK','id'=>(string)($id??$result['activity_id']));
 if(isset($result['version']))$data['version']=(string)$result['version'];
 if(isset($result['revision_id']))$data['revision_id']=(string)$result['revision_id'];
 foreach(array('request_id','request_version') as $field)if(isset($result[$field]))$data[$field]=(string)$result[$field];
 return array($create?201:200,array('data'=>$data));
}
