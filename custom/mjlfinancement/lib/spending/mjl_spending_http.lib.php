<?php
require_once __DIR__.'/mjl_spending_read.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form_submission.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_presentation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_execution.lib.php';

function mjl_spending_deny($status=403){http_response_code($status);header('Content-Type: text/plain; charset=UTF-8');print $status===403?'Forbidden':'Requête non valide';exit;}
function mjl_spending_context($actor,$entity,$action,$operationId,$expenseId,$version){return array('user_id'=>(int)$actor->id,'entity'=>(int)$entity,'route'=>'expenses','form'=>'operation_'.(int)$operationId,'action'=>$action,'object_id'=>(int)$expenseId,'version'=>(int)$version);}
function mjl_spending_id($source,$name,$zero=false){$value=$source[$name]??null;return is_string($value)&&preg_match($zero?'/^(0|[1-9][0-9]*)$/':'/^[1-9][0-9]*$/',$value)&&strlen($value)<=18?$value:null;}

function mjl_spending_http(DoliDB $db,User $actor,$entity)
{
 $method=$_SERVER['REQUEST_METHOD']??'GET';
 if(empty($actor->id)||!mjl_activity_access_can_enter_list($actor)||!in_array($method,array('GET','POST'),true))mjl_spending_deny();
 if($method==='POST'){
  if($_GET||(int)($_SERVER['CONTENT_LENGTH']??0)>16384)mjl_spending_deny(400);
  $action=$_POST['action']??null;
  $extra=$action==='save'?array('label','expense_date','amount','original_id','reason'):($action==='transition'?array('decision','reason'):null);
  if($extra===null||array_diff(array_keys($_POST),array_merge(array('action','operation_id','expense_id','version','token','mjl_submission'),$extra)))mjl_spending_deny(400);
  foreach($_POST as $value)if(!is_string($value))mjl_spending_deny(400);
  $operationId=mjl_spending_id($_POST,'operation_id');$expenseId=mjl_spending_id($_POST,'expense_id',true);$version=mjl_spending_id($_POST,'version');
  if($operationId===null||$expenseId===null||$version===null||!isset($_POST['token'])||!hash_equals((string)currentToken(),$_POST['token']))mjl_spending_deny();
  if(!mjl_form_submission_consume($_POST['mjl_submission']??'',mjl_spending_context($actor,$entity,$action,$operationId,$expenseId,$version)))mjl_spending_deny();
  $command=new MjlActivityCommand($db,null,$entity);
  if($action==='save'){
   $original=$_POST['original_id']??'';
   $input=array('label'=>$_POST['label']??'','expense_date'=>$_POST['expense_date']??'','amount'=>$_POST['amount']??'','original_id'=>$original===''?null:$original,'reason'=>trim($_POST['reason']??'')===''?null:trim($_POST['reason']));
   $result=$command->saveExpense($operationId,$expenseId,$version,$input,$actor);
  }else $result=$command->transitionExpense($operationId,$expenseId,$version,$_POST['decision']??'',$_POST['reason']??'',$actor);
  header('Location: '.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?'.http_build_query(array('operation_id'=>$operationId,'result'=>$result['code'])),true,303);return;
 }
 if(array_diff(array_keys($_GET),array('operation_id','page','result')))mjl_spending_deny();
 $operationId=mjl_spending_id($_GET,'operation_id');$page=isset($_GET['page'])?mjl_spending_id($_GET,'page'):'1';
 if($page===null||(int)$page>1000000)mjl_spending_deny(400);
 if(!isset($_GET['operation_id'])){
  try{$list=mjl_spending_list($db,$actor,$entity,$page);}catch(Throwable $error){http_response_code(503);print 'Le suivi des dépenses est temporairement indisponible.';return;}
  llxHeader('','Dépenses');mjl_navigation_shell_start($actor);
  require DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/tpl/spending/list.php';
  mjl_navigation_shell_end();llxFooter();return;
 }
 if($operationId===null)mjl_spending_deny(400);
 try{$model=mjl_spending_read($db,$actor,$entity,$operationId,$page);}catch(Throwable $error){http_response_code(503);print 'Le suivi des dépenses est temporairement indisponible.';return;}
 if(!$model)mjl_spending_deny();
 // At most five entries: bounded forms stay below the existing session token cap.
 $forms=array();
 $issue=function($action,$id,$version)use($actor,$entity,$operationId){return array('token'=>newToken(),'mjl_submission'=>mjl_form_submission_issue(mjl_spending_context($actor,$entity,$action,$operationId,$id,$version)),'action'=>$action,'operation_id'=>$operationId,'expense_id'=>(string)$id,'version'=>(string)$version);};
 if($model['can_create'])$forms['create']=$issue('save',0,$model['operation']['version']);
 foreach($model['entries'] as $entry){
  $id=$entry['rowid'];$agent=$model['role']==='AGENT_SAISIE'&&(!$model['correction_only']||$entry['fk_original']!==null);
  if($agent&&$entry['status']==='DRAFT')$forms[$id]['save']=$issue('save',$id,$entry['version']);
  if(($agent&&in_array($entry['status'],array('DRAFT','SUBMITTED'),true))||($model['role']==='VALIDATEUR_DEFINITIF'&&$entry['status']==='SUBMITTED'&&!in_array((int)$actor->id,json_decode($entry['contributors'],true),true)))$forms[$id]['transition']=$issue('transition',$id,$entry['version']);
  if($model['role']==='AGENT_SAISIE'&&$entry['status']==='APPROVED'&&$entry['kind']==='EXPENSE'&&!$entry['reversed'])$forms[$id]['correction']=$issue('save',0,$model['operation']['version']);
 }
 $result=isset($_GET['result'])&&is_string($_GET['result'])?$_GET['result']:'';
 llxHeader('','Dépenses');mjl_navigation_shell_start($actor);
 require DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/tpl/spending/operation.php';
 mjl_navigation_shell_end();llxFooter();
}
