<?php
require_once __DIR__.'/mjl_api_activities.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/spending/mjl_spending_read.lib.php';

function mjl_api_execution_operations()
{
 return array('updateExecution','requestOperationCancellation','requestOperationReopening','withdrawCancellation','decideCancellation','withdrawReopening','decideReopening','createExpense','replaceExpenseDraft','submitExpense','withdrawExpense','decideExpense');
}
function mjl_api_execution_guard(User $actor)
{
 global $db;
 if(!mjl_activity_access_can_enter_list($actor))mjl_api_fail(403,'forbidden');
 mjl_rst006b_require_target($db);
 if(mjl_monitoring_readiness()!==1)mjl_api_fail(503,'unavailable');
}
function mjl_api_operation_project(array $row)
{
 $actions=array('getOperation','listExpenses');
 if($row['execution_allowed']&&$row['status']!=='CANCELLED')$actions=array_merge($actions,$row['status']==='COMPLETED'?array('requestOperationReopening'):array('updateExecution','requestOperationCancellation'));
 return array('id'=>(string)$row['rowid'],'version'=>(string)$row['version'],'activity_id'=>(string)$row['activity_id'],'name'=>$row['name'],'type_id'=>(string)$row['fk_operation_type'],'type_label'=>$row['type_label'],'status'=>$row['status'],'authorized_amount'=>(string)$row['authorized_amount'],'authorization_kind'=>$row['authorization_kind']==='Proposée'?'PROPOSED':'VALIDATED','spent_amount'=>$row['spent_amount']===null?null:(string)$row['spent_amount'],'observation'=>$row['observation'],'allowed_actions'=>$actions,'activity_ref'=>$row['activity_ref'],'activity_name'=>$row['activity_name'],'partner_label'=>$row['partner_name'],'project_label'=>$row['project_name']);
}
function mjl_api_operation_row(User $actor,$id)
{
 global $db;
 return mjl_monitoring_read_snapshot($db,function()use($db,$actor,$id){
  $reader=new MjlMonitoring($db,$actor,mjl_auth_entity());
  $premise=$reader->rows('SELECT fk_activity FROM '.$db->prefix().'mjlfinancement_operation WHERE entity='.mjl_auth_entity().' AND rowid='.(int)$id.' AND date_removed IS NULL');
  if(!$premise)mjl_api_fail(404,'not_found');
  $filters=mjl_monitoring_filters(array('activity_id'=>(string)$premise[0]['fk_activity']));
  foreach($reader->operations($reader->activities($filters),$filters) as $row)if((string)$row['rowid']===$id)return mjl_api_operation_project($row);
  mjl_api_fail(404,'not_found');
 },'mjl API operation',true);
}
function mjl_api_exception_project(array $row)
{
 $cancellation=$row['request_type']==='CANCELLATION';$actions=array();$decisions=array();
 if($row['eligibility']['withdraw'])$actions[]=$cancellation?'withdrawCancellation':'withdrawReopening';
 foreach(array('approve'=>'APPROVED','reject'=>'REJECTED') as $flag=>$decision)if($row['eligibility'][$flag])$decisions[]=$decision;
 if($decisions)$actions[]=$cancellation?'decideCancellation':'decideReopening';
 return array('id'=>(string)$row['rowid'],'type'=>$row['request_type'],'version'=>(string)$row['version'],'activity_id'=>(string)$row['fk_activity'],'operation_id'=>$cancellation?($row['target_type']==='OPERATION'?(string)$row['target_id']:null):(string)$row['fk_operation'],'status'=>$row['status'],'reason'=>$row['reason'],'requested_at'=>mjl_api_activity_timestamp($row['date_request']),'requester_id'=>(string)$row['fk_requester'],'target_version'=>(string)$row['target_version'],'target_revision_id'=>$row['fk_target_revision']===null?null:(string)$row['fk_target_revision'],'stale'=>(bool)$row['eligibility']['stale'],'allowed_actions'=>$actions,'requester_name'=>$row['requester_name_snapshot'],'target_label'=>$row['target_label'],'current_target_version'=>$row['current_target_version']?(string)$row['current_target_version']:null,'decision_reason'=>$row['decision_reason'],'allowed_decisions'=>$decisions);
}
function mjl_api_exception_rows(User $actor,array $query)
{
 global $db;
 $type=$query['type']??'';$status=$query['status']??'PENDING';$id=$query['request_id']??'';
 if(!in_array($type,array('','CANCELLATION','REOPENING'),true)||!in_array($status,array('','PENDING','APPROVED','REJECTED','WITHDRAWN'),true)||($id!==''&&$type===''))mjl_api_fail(400,'invalid_request');
 if($id!=='')mjl_api_id($id);
 unset($query['type'],$query['status'],$query['request_id']);
 try{$filters=mjl_monitoring_validate_request($query);}catch(InvalidArgumentException $e){mjl_api_fail(400,'invalid_request');}
 return mjl_monitoring_read_snapshot($db,function()use($db,$actor,$filters,$type,$status,$id){
  $reader=new MjlMonitoring($db,$actor,mjl_auth_entity());
  $rows=$reader->requests($reader->activities($filters),$status);
  return array_values(array_map('mjl_api_exception_project',array_filter($rows,function($r)use($type,$id){return ($type===''||$r['request_type']===$type)&&($id===''||(string)$r['rowid']===$id);})));
 },'mjl API exceptions',true);
}
function mjl_api_expense_project(array $entry,array $model)
{
 $agent=$model['role']==='AGENT_SAISIE'&&(!$model['correction_only']||$entry['fk_original']!==null);
 $actions=array();$decisions=array();
 if($agent&&$entry['status']==='DRAFT')$actions=array('replaceExpenseDraft','submitExpense');
 if($agent&&in_array($entry['status'],array('DRAFT','SUBMITTED'),true))$actions[]='withdrawExpense';
 if($model['role']==='VALIDATEUR_DEFINITIF'&&$entry['status']==='SUBMITTED'&&!in_array((int)$model['actor_id'],json_decode($entry['contributors'],true),true)){$actions[]='decideExpense';$decisions=array('APPROVED','REJECTED');}
 if($model['role']==='AGENT_SAISIE'&&$entry['status']==='APPROVED'&&$entry['kind']==='EXPENSE'&&!$entry['reversed'])$actions[]='createExpense';
 $out=array('id'=>(string)$entry['rowid'],'version'=>(string)$entry['version']);
 foreach(array('kind','status','label','expense_date','amount','reason','decision_reason') as $key)$out[$key]=$entry[$key]===null?null:(string)$entry[$key];
 return $out+array('original_id'=>$entry['fk_original']===null?null:(string)$entry['fk_original'],'reversed'=>(bool)$entry['reversed'],'allowed_actions'=>$actions,'allowed_decisions'=>$decisions);
}
function mjl_api_expense_model(User $actor,$id,$page=1,$expenseId=null)
{
 global $db;
 return mjl_monitoring_read_snapshot($db,function()use($db,$actor,$id,$page,$expenseId){
  $model=mjl_spending_read($db,$actor,mjl_auth_entity(),$id,$page,$expenseId);
  if(!$model)mjl_api_fail(404,'not_found');
  return $model;
 },'mjl API expenses',true);
}
function mjl_api_expense_ledger(array $model)
{
 $o=$model['operation'];
 return array('operation'=>array('id'=>(string)$o['rowid'],'version'=>(string)$o['version'],'name'=>$o['name'],'activity_ref'=>$o['activity_ref'],'status'=>$o['status'],'spent_amount'=>$o['spent_amount']===null?null:(string)$o['spent_amount']), 'correction_only'=>(bool)$model['correction_only'],'entries'=>array_map(function($e)use($model){return mjl_api_expense_project($e,$model);},$model['entries']),'pagination'=>array('page'=>$model['page'],'page_size'=>5,'has_next'=>$model['has_next']),'allowed_actions'=>$model['can_create']?array('createExpense'):array());
}
function mjl_api_execution_context(User $actor,$operation,array $params,$version)
{
 return array('user_id'=>(int)$actor->id,'entity'=>mjl_auth_entity(),'route'=>'api_execution','form'=>isset($params['operation_id'])?'operation_'.$params['operation_id']:'request','action'=>$operation,'object_id'=>$params['expense_id']??$params['request_id']??$params['operation_id'],'version'=>$version);
}
function mjl_api_execution_target(User $actor,$operation,array $params)
{
 if(isset($params['request_id'])){
  $rows=mjl_api_exception_rows($actor,array('type'=>strpos($operation,'Cancellation')!==false?'CANCELLATION':'REOPENING','status'=>'','request_id'=>$params['request_id']));
  if(count($rows)!==1)mjl_api_fail(404,'not_found');return $rows[0];
 }
 if(strpos($operation,'Expense')!==false){
  $model=mjl_api_expense_model($actor,$params['operation_id'],1,$params['expense_id']??null);
  if(isset($params['expense_id'])){if(count($model['entries'])!==1)mjl_api_fail(404,'not_found');return mjl_api_expense_project($model['entries'][0],$model);}
  // Creation includes corrections on terminal Operations. The command checks the supplied original.
  return array('version'=>(string)$model['operation']['version'],'allowed_actions'=>$model['role']==='AGENT_SAISIE'?array('createExpense'):array());
 }
 return mjl_api_operation_row($actor,$params['operation_id']);
}
function mjl_api_execution_token(stdClass $body,User $actor)
{
 mjl_api_execution_guard($actor);
 mjl_api_fields($body,array('operation_id','path_parameters','expected_version'));
 $operation=$body->operation_id;$keys=strpos($operation,'Expense')!==false?($operation==='createExpense'?array('operation_id'):array('operation_id','expense_id')):(in_array($operation,array('updateExecution','requestOperationCancellation','requestOperationReopening'),true)?array('operation_id'):array('request_id'));
 mjl_api_fields($body->path_parameters,$keys);$params=array();foreach($keys as $key)$params[$key]=mjl_api_id($body->path_parameters->$key);
 $version=mjl_api_id($body->expected_version);$target=mjl_api_execution_target($actor,$operation,$params);
 if($target['version']!==$version)mjl_api_fail(409,'stale_version');
 if(!in_array($operation,$target['allowed_actions'],true))mjl_api_fail(403,'forbidden');
 $token=mjl_form_submission_issue(mjl_api_execution_context($actor,$operation,$params,$version));
 if($token==='')mjl_api_fail(503,'unavailable');
 $expires=min(time()+MJL_FORM_SUBMISSION_TTL,mjl_auth_session_value('mjl_authenticated_at')+86400,mjl_auth_session_value('mjl_last_activity_at')+86400);
 return array(200,array('data'=>array('token'=>$token,'expires_at'=>gmdate('c',$expires))));
}
function mjl_api_execution(array $request,User $actor)
{
 global $db;
 mjl_api_execution_guard($actor);$path=$request['path'];$query=$request['query'];
 if($request['method']!=='GET')return mjl_api_execution_write($request,$actor);
 mjl_api_fields($request['body'],array());$page=(int)(($query['page']??'')===''?1:$query['page']);
 if($path==='/operations'){
  try{$filters=mjl_monitoring_validate_request($query,true);}catch(InvalidArgumentException $e){mjl_api_fail(400,'invalid_request');}
  $data=mjl_monitoring_read_snapshot($db,function()use($db,$actor,$filters,$page){
   $reader=new MjlMonitoring($db,$actor,mjl_auth_entity());$rows=$reader->operations($reader->activities($filters),$filters);usort($rows,function($a,$b){return (int)$b['rowid']<=>(int)$a['rowid'];});
   return array('data'=>array_map('mjl_api_operation_project',array_slice($rows,($page-1)*50,50)),'pagination'=>array('page'=>$page,'page_size'=>50,'has_next'=>count($rows)>$page*50));
  },'mjl API operations',true);
 }elseif($path==='/exception-requests'){
  $rows=mjl_api_exception_rows($actor,$query);$data=array('data'=>array_slice($rows,($page-1)*50,50),'pagination'=>array('page'=>$page,'page_size'=>50,'has_next'=>count($rows)>$page*50));
 }elseif($path==='/spending-operations'){
  $list=mjl_monitoring_read_snapshot($db,function()use($db,$actor,$page){return mjl_spending_list($db,$actor,mjl_auth_entity(),$page);},'mjl API spending list',true);
  $data=array('data'=>array_map(function($r){return array('id'=>(string)$r['rowid'],'name'=>$r['name'],'activity_ref'=>$r['ref'],'spent_amount'=>$r['spent_amount']===null?null:(string)$r['spent_amount'],'correction_only'=>(bool)$r['correction_only']);},$list['rows']),'pagination'=>array('page'=>$page,'page_size'=>50,'has_next'=>$list['has_next']));
 }else{
  $parts=explode('/',$path);$id=mjl_api_id($parts[2]);
  $data=array('data'=>isset($parts[3])?mjl_api_expense_ledger(mjl_api_expense_model($actor,$id,$page)):mjl_api_operation_row($actor,$id));
 }
 mjl_auth_session_touch(time());return array(200,$data);
}
function mjl_api_execution_write(array $request,User $actor)
{
 global $db;
 $p=explode('/',$request['path']);$body=$request['body'];$params=array();$fields=array('expected_version');$optional=array();
 if($p[1]!=='operations'){$params['request_id']=mjl_api_id($p[2]);$operation=($p[3]==='withdrawal'?'withdraw':'decide').($p[1]==='cancellation-requests'?'Cancellation':'Reopening');if($p[3]==='decisions')$fields=array_merge($fields,array('decision','reason'));}
 else{
  $params['operation_id']=mjl_api_id($p[2]);
  if($p[3]==='expenses'){
   if(isset($p[4]))$params['expense_id']=mjl_api_id($p[4]);
   $operation=!isset($p[4])?'createExpense':(!isset($p[5])?'replaceExpenseDraft':array('submission'=>'submitExpense','withdrawal'=>'withdrawExpense','decisions'=>'decideExpense')[$p[5]]);
   if(in_array($operation,array('createExpense','replaceExpenseDraft'),true))$fields=array_merge($fields,array('label','expense_date','amount','original_id','reason'));
   elseif($operation==='decideExpense'){$fields[]='decision';$optional[]='reason';}
  }else{$operation=array('execution'=>'updateExecution','cancellation-requests'=>'requestOperationCancellation','reopening-requests'=>'requestOperationReopening')[$p[3]];$fields=array_merge($fields,$operation==='updateExecution'?array('status','observation'):array('reason'));}
 }
 mjl_api_fields($body,$fields,$optional);$version=mjl_api_id($body->expected_version);
 if(property_exists($body,'reason')&&!in_array($operation,array('createExpense','replaceExpenseDraft'),true)){mjl_api_string($body->reason,8000);if(trim($body->reason)==='')mjl_api_fail(422,'invalid_input');}
 $reason=isset($body->reason)?mjl_api_string($body->reason,8000):'';
 if(mb_strlen($reason)>2000)mjl_api_fail(422,'invalid_input');
 $input=null;
 if(in_array($operation,array('createExpense','replaceExpenseDraft'),true)){
  $amount=mjl_api_string($body->amount,19);if(!preg_match('/^(0|[1-9][0-9]*)$/D',$amount)||strlen($amount)>19||(strlen($amount)===19&&strcmp($amount,'9223372036854775807')>0))mjl_api_fail(422,'invalid_input');
  $input=array('label'=>mjl_api_string($body->label,1020),'expense_date'=>mjl_api_string($body->expense_date,10),'amount'=>$amount,'original_id'=>$body->original_id===null?null:mjl_api_id($body->original_id),'reason'=>$body->reason===null?null:$reason);
 }elseif($operation==='updateExecution'){
  if(!in_array($body->status,array('TODO','IN_PROGRESS','COMPLETED'),true))mjl_api_fail(422,'invalid_input');
  $input=array('status'=>$body->status,'observation'=>$body->observation===null?null:mjl_api_string($body->observation,8000));
 }elseif(strpos($operation,'decide')===0&&!in_array($body->decision,array('APPROVED','REJECTED'),true))mjl_api_fail(422,'invalid_input');
 $target=mjl_api_execution_target($actor,$operation,$params);
 // Eligibility is advisory for conflict states; commands own the exact transition checks.
 if(!mjl_form_submission_consume($_SERVER['HTTP_X_MJL_SUBMISSION']??'',mjl_api_execution_context($actor,$operation,$params,$version)))mjl_api_fail(403,'submission_invalid');
 $command=new MjlActivityCommand($db,null,mjl_auth_entity());$id=$params['operation_id']??$params['request_id'];
 switch($operation){
  case 'updateExecution':$result=$command->updateOperationExecution($target['activity_id'],$id,$version,$input,$actor);break;
  case 'requestOperationCancellation':$result=$command->requestCancellation('OPERATION',$id,$version,$reason,$actor);break;
  case 'requestOperationReopening':$result=$command->requestReopening($id,$version,$reason,$actor);break;
  case 'withdrawCancellation':$result=$command->withdrawCancellation($id,$version,$actor);break;
  case 'decideCancellation':$result=$command->decideCancellation($id,$version,$body->decision,$reason,$actor);break;
  case 'withdrawReopening':$result=$command->withdrawReopening($id,$version,$actor);break;
  case 'decideReopening':$result=$command->decideReopening($id,$version,$body->decision,$reason,$actor);break;
  case 'createExpense':case 'replaceExpenseDraft':$result=$command->saveExpense($id,$params['expense_id']??'0',$version,$input,$actor);break;
  default:$decision=$operation==='submitExpense'?'SUBMITTED':($operation==='withdrawExpense'?'WITHDRAWN':$body->decision);$result=$command->transitionExpense($id,$params['expense_id'],$version,$decision,$reason,$actor);
 }
 if($result['code']!=='OK'){
  $map=array('INVALID_INPUT'=>array(422,'invalid_input'),'FORBIDDEN'=>array(403,'forbidden'),'NOT_FOUND'=>array(404,'not_found'),'STALE_VERSION'=>array(409,'stale_version'),'CONFLICT'=>array(409,'conflict'),'RETRYABLE_CONFLICT'=>array(409,'retryable_conflict'));
  $error=$map[$result['code']]??array(503,'unavailable');mjl_api_fail($error[0],$error[1]);
 }
 $data=array('code'=>'OK','id'=>(string)($result['expense_id']??$result['request_id']??$id));
 foreach(array('expense_id','expense_version','reversal_id','request_id','request_version','operation_version') as $key)if(isset($result[$key]))$data[$key]=(string)$result[$key];
 mjl_auth_session_touch(time());return array($operation==='createExpense'?201:200,array('data'=>$data));
}
