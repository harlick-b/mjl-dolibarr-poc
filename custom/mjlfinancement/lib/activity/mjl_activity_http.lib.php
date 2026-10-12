<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form_submission.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_presentation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_execution.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_exception_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_operation_consultation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/activity/mjl_activity_presentation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/activity/mjl_activity_feedback.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/monitoring/mjl_monitoring_read.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/audit/mjl_audit_timeline_read.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivityassignment.class.php';

function mjl_activity_forbidden()
{
	http_response_code(403);
	header('Content-Type: text/plain; charset=UTF-8');
	print 'Forbidden';
	exit;
}

function mjl_activity_decimal($name, $source, $allowZero = false)
{
	if (!array_key_exists($name, $source) || !is_scalar($source[$name])) return '';
	$value = (string) $source[$name];
	$pattern = $allowZero ? '/^(0|[1-9][0-9]*)$/' : '/^[1-9][0-9]*$/';
	return preg_match($pattern, $value) === 1 && strlen($value) <= 19 && (strlen($value) < 19 || strcmp($value, '9223372036854775807') <= 0) ? $value : '';
}

function mjl_activity_structure_from_post(array $post)
{
	$scalarNames = array('partner_id','project_id','name','description','date_start','date_end','authorized_amount');
	foreach ($scalarNames as $name) if (!isset($post[$name]) || !is_scalar($post[$name])) return null;
	$arrayNames = array('operation_key','operation_id','operation_version','operation_name','operation_type_id','operation_amount');
	foreach ($arrayNames as $name) if (!isset($post[$name]) || !is_array($post[$name]) || count($post[$name]) > 50) return null;
	$keys = array_keys($post['operation_key']);
	foreach ($arrayNames as $name) if (array_keys($post[$name]) !== $keys) return null;
	$operations = array();
	$seen = array();
	foreach ($keys as $index) {
		if (!is_int($index) && preg_match('/^(0|[1-9][0-9]*)$/', (string)$index) !== 1) return null;
		foreach ($arrayNames as $name) if (!is_scalar($post[$name][$index])) return null;
		$key = (string) $post['operation_key'][$index];
		if (preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $key) !== 1 || isset($seen[$key])) return null;
		$op = array('client_key'=>$key,'name'=>(string)$post['operation_name'][$index],'type_id'=>(string)$post['operation_type_id'][$index],'authorized_amount'=>(string)$post['operation_amount'][$index]);
		$id = (string) $post['operation_id'][$index];
		$version = (string) $post['operation_version'][$index];
		if (($id === '') !== ($version === '')) return null;
		if ($id !== '') $op = array('id'=>$id,'expected_version'=>$version)+$op;
		$operations[] = $op; $seen[$key] = true;
	}
	return array('partner_id'=>(string)$post['partner_id'],'project_id'=>(string)$post['project_id'],'name'=>(string)$post['name'],'description'=>(string)$post['description'],'date_start'=>(string)$post['date_start'],'date_end'=>(string)$post['date_end'],'authorized_amount'=>(string)$post['authorized_amount'],'operations'=>$operations);
}

function mjl_activity_list_query(array $source)
{
	$filters = array('q'=>'','status'=>'','project_id'=>'','page'=>1);
	foreach (array('q','status','project_id','page') as $name) {
		if (!array_key_exists($name, $source)) continue;
		if (!is_scalar($source[$name])) return null;
		$value = (string) $source[$name];
		if ($name === 'q') {
			if (preg_match('//u', $value) !== 1 || preg_match('/[\x00-\x1F\x7F]/u', $value)) return null;
			$value = trim($value);
			if (mb_strlen($value, 'UTF-8') > 100) return null;
			$filters['q'] = $value;
		} elseif ($name === 'status') {
			$allowed = array('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED');
			if ($value !== '' && !in_array($value, $allowed, true)) return null;
			$filters['status'] = $value;
		} elseif ($name === 'project_id') {
			if ($value !== '' && mjl_activity_decimal('project_id', array('project_id'=>$value)) === '') return null;
			$filters['project_id'] = $value;
		} else {
			if (preg_match('/^[1-9][0-9]*$/', $value) !== 1 || strlen($value) > 18) return null;
			$page = (int) $value;
			if ($page < 1 || $page > intdiv(PHP_INT_MAX, 50)) return null;
			$filters['page'] = $page;
		}
	}
	return $filters;
}

function mjl_activity_list_url(array $filters, $page)
{
	$query = array();
	foreach (array('q','status','project_id') as $name) if ($filters[$name] !== '') $query[$name] = $filters[$name];
	if ((int) $page > 1) $query['page'] = (int) $page;
	return DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'.($query ? '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986) : '');
}

function mjl_activity_bad_request()
{
	http_response_code(400);
	header('Content-Type: text/plain; charset=UTF-8');
	print 'Requête non valide';
	exit;
}

function mjl_activity_filter_bad_request()
{
	http_response_code(400);
	header('Content-Type: text/plain; charset=UTF-8');
	print 'Filtres invalides.';
	exit;
}

function mjl_activity_payload_too_large()
{
	http_response_code(413);
	header('Content-Type: text/plain; charset=UTF-8');
	print 'Requête trop volumineuse';
	exit;
}

function mjl_activity_http_handle($db, $user, $entity, array $request)
{
	require_once dirname(__DIR__).'/mjl_monitoring_access.lib.php';
	if (empty($user->id) || !mjl_activity_access_can_enter_list($user)) mjl_activity_forbidden();
	try { mjl_rst006b_require_target($db); } catch (Throwable $e) {
		http_response_code(503); llxHeader('', 'Activités'); mjl_navigation_shell_start($user); print '<div class="mjl-workspace">'.mjl_ui_system_state('unavailable','Migration requise','Le suivi d’exécution sera disponible après la migration RST-006B.').'</div>'; mjl_navigation_shell_end(); llxFooter(); return;
	}
	$method = $request['method'];
	$get = $request['get'];
	$post = $request['post'];
	if($method==='POST'){
		if($request['content_length'] === null||preg_match('/^(0|[1-9][0-9]*)$/',(string)$request['content_length'])!==1)mjl_activity_bad_request();
		if(strlen((string)$request['content_length'])>5||(int)$request['content_length']>65536)mjl_activity_payload_too_large();
	}
	$requestSource=$method==='POST'?$post:$get;
	if(isset($requestSource['action'])&&!is_scalar($requestSource['action']))mjl_activity_bad_request();
	$action=isset($requestSource['action'])?(string)$requestSource['action']:'';
	$getAllowed=array('','create','edit','review');
	$postAllowed=array('create_draft','create_submit','save_structure','submit_revision','abandon','restore','review_revision','assignment_change','request_cancellation');
	if (($method==='GET'&&!in_array($action,$getAllowed,true))||($method==='POST'&&!in_array($action,$postAllowed,true))||!in_array($method,array('GET','POST'),true))mjl_activity_forbidden();
	$id=mjl_activity_decimal('id',$method==='POST'?$post:$get);
	if(isset($requestSource['id'])&&$id==='')mjl_activity_bad_request();
	$readiness = mjl_monitoring_readiness();
	if($method==='POST')$allowedGetKeys=array('id');
	elseif($action==='create')$allowedGetKeys=array('action','result','recovery');
	elseif($action==='edit')$allowedGetKeys=array('action','id','result','recovery');
	elseif($action==='review')$allowedGetKeys=array('action','id','result','chronology_cursor');
	elseif($id!=='')$allowedGetKeys=array('action','id','result','chronology_cursor');
	elseif($readiness!==0)$allowedGetKeys=array('action','q','partner_id','project_id','activity_id','validation_status','execution_status','completeness','type_id','operation_status','date_from','date_to','grouping','page','status','result');
	else$allowedGetKeys=array('action','q','status','project_id','page','result');
	if (array_key_exists('chronology_cursor',$get) && mjl_activity_decimal('chronology_cursor',$get)==='') mjl_activity_bad_request();
	$allowedGetKeys=array_merge($allowedGetKeys,array('mainmenu','leftmenu'));
	foreach(array_keys($get)as$key)if(!is_string($key)||!in_array($key,$allowedGetKeys,true))mjl_activity_forbidden();
	if($method==='POST'&&isset($get['id'])&&mjl_activity_decimal('id',$get)!==$id)mjl_activity_forbidden();
	if ($action==='create' && $id!=='') mjl_activity_forbidden();
	if ($action!=='' && $action!=='create' && strpos($action,'create_')!==0 && $id==='') mjl_activity_forbidden();
	if ($method==='POST') mjl_activity_post($action,$id,$post,$db,$user,$entity);
	try{$row=$id!==''?mjl_monitoring_read_activity($db,$entity,$id):array();}
	catch(Throwable $exception){http_response_code(503);llxHeader('','Activités');mjl_navigation_shell_start($user);print '<div class="mjl-workspace">'.mjl_ui_system_state('unavailable','Activité indisponible','Les données et autorisations ne peuvent pas être chargées.').'</div>';mjl_navigation_shell_end();llxFooter();return;}
	if ($id!=='' && (!$row || !mjl_activity_access_can_read_activity($user,$id))) mjl_activity_forbidden();
	if ($action==='create'&&!mjl_scope_is_input_agent($user))mjl_activity_forbidden();
	if ($action==='edit'&&(!mjl_scope_is_input_agent($user)||!in_array($row['validation_status'],array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'),true)))mjl_activity_forbidden();
	if ($action==='review'&&!in_array(mjl_scope_effective_role_code($user),array('AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF'),true))mjl_activity_forbidden();
	if ($action==='' && $id==='' && mjl_activity_list_query($get)===null) mjl_activity_filter_bad_request();
	if ($action==='edit' && $readiness!==0) { try { $context=mjl_monitoring_read_activity_context($db,$user,$entity,$row); if (!$context['monitoring_actions']['edit']) mjl_activity_forbidden(); } catch (Throwable $exception) { mjl_activity_forbidden(); } }
	$recovery=array();
	if($action==='create'||$action==='edit'){
		$handle=isset($get['recovery'])&&is_scalar($get['recovery'])?(string)$get['recovery']:'';
		$recovery=mjl_activity_recovery_consume($handle,$action==='create'?0:(int)$row['rowid'],$action);
	}
	$timeline=array('events'=>null,'cursor'=>'','action'=>$action);
	if($row&&in_array($action,array('','review'),true)){
		$cursor=isset($get['chronology_cursor'])?(string)$get['chronology_cursor']:'';
		$timeline['cursor']=$cursor;
		$timeline['events']=mjl_audit_timeline_read($db,$user,$entity,(int)$row['rowid'],$cursor);
	}
	$prepared=array();
	$formSpecs=array();
	$role=mjl_scope_effective_role_code($user);
	try{
	if($action==='create'||$action==='edit'){
		$ops=$action==='create'?array(array('rowid'=>'','version'=>'','name'=>'','fk_operation_type'=>'','authorized_amount'=>'')):mjl_monitoring_read_operations($db,$entity,(int)$row['rowid']);
		if(!empty($recovery['operations'])){$base=$ops;$ops=array();foreach($recovery['operations']as$index=>$saved){$current=$base[$index]??array('rowid'=>'','version'=>'','fk_operation_type'=>'');$ops[]=array('rowid'=>$current['rowid'],'version'=>$current['version'],'fk_operation_type'=>$current['fk_operation_type'],'name'=>$saved['name'],'authorized_amount'=>$saved['authorized_amount']);}}
		$prepared=array(
			'operations'=>$ops,
			'partners'=>mjl_monitoring_read_reference_options($db,$entity,'societe','nom',(int)($row['fk_partner']??0)),
			'projects'=>mjl_monitoring_read_reference_options($db,$entity,'projet','title',(int)($row['fk_project']??0)),
			'types'=>array(),
		);
		foreach($ops as$index=>$operation)$prepared['types'][$index]=mjl_monitoring_read_type_options($db,$entity,(int)($operation['fk_operation_type']??0));
		if($action==='create')$formSpecs=array('primary'=>array('create_draft',0,0,0),'create_submit'=>array('create_submit',0,0,0));
		else$formSpecs=array('primary'=>array('save_structure',(int)$row['rowid'],0,(int)$row['version']));
	}elseif($action==='review'){
		$revision=mjl_monitoring_read_revision($db,$entity,(int)$row['rowid'],(int)$row['fk_current_revision']);
		if(!$revision)mjl_activity_forbidden();
		$prepared=array('revision'=>$revision,'history'=>mjl_monitoring_read_review_history($db,$entity,(int)$revision['rowid']),'eligibility'=>mjl_activity_review_eligibility($db,$row,$user,$entity,$readiness));
		if($prepared['eligibility']['allowed']){
			$formSpecs['approve']=array('review_revision',(int)$row['rowid'],(int)$revision['rowid'],(int)$row['version']);
			if(!isset($prepared['eligibility']['return_allowed'])||$prepared['eligibility']['return_allowed'])$formSpecs['return']=array('review_revision',(int)$row['rowid'],(int)$revision['rowid'],(int)$row['version']);
		}
	}elseif($row){
		$monitoring=$readiness!==0;
		try{
			if($monitoring){$context=mjl_monitoring_read_activity_context($db,$user,$entity,$row);$operations=$context['operations'];$summary=$context;$assignments=$context['assignments'];$row=array_merge($row,$context);}
			else{$operations=mjl_monitoring_read_operations($db,$entity,(int)$row['rowid']);$summary=mjl_execution_summarize($operations);$assignments=array();}
			$canEdit=$monitoring?$row['monitoring_actions']['edit']:(mjl_scope_is_input_agent($user)&&in_array($row['validation_status'],array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'),true));
			$canAssign=mjl_scope_is_final_validator($user)&&!in_array($row['validation_status'],array('ABANDONED','CANCELLED'),true);
			$canAbandon=$monitoring?$row['monitoring_actions']['abandon']:(mjl_scope_is_input_agent($user)&&$row['validation_status']==='DRAFT');
			$canRestore=$monitoring?$row['monitoring_actions']['restore']:(mjl_scope_is_final_validator($user)&&$row['validation_status']==='ABANDONED');
			$canCancel=mjl_scope_is_input_agent($user)&&!empty($row['fk_current_revision'])&&empty($row['is_cancelled'])&&$row['validation_status']!=='ABANDONED';
			$prepared=array('monitoring'=>$monitoring,'row'=>$row,'operations'=>$operations,'summary'=>$summary,'assignments'=>$assignments,'eligibility'=>mjl_activity_review_eligibility($db,$row,$user,$entity,$readiness,$monitoring?$context:null),'report_available'=>mjl_monitoring_read_report_available($db),'agents'=>($canRestore||$canAssign)?mjl_monitoring_read_agent_options($db,$entity):array(),'flags'=>array('edit'=>$canEdit,'assign'=>$canAssign,'abandon'=>$canAbandon,'restore'=>$canRestore,'cancel'=>$canCancel,'reviewer'=>in_array($role,array('AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF'),true)));
			$idValue=(int)$row['rowid'];$versionValue=(int)$row['version'];
			if($canEdit)$formSpecs['submit']=array('submit_revision',$idValue,0,$versionValue);
			if($canAbandon)$formSpecs['abandon']=array('abandon',$idValue,0,$versionValue);
			if($canRestore)$formSpecs['restore']=array('restore',$idValue,0,$versionValue);
			if($canCancel)$formSpecs['cancel']=array('request_cancellation',$idValue,0,$versionValue);
			if($canAssign)$formSpecs['assignment']=array('assignment_change',$idValue,0,$versionValue);
		}catch(Throwable $exception){$prepared=array('detail_error'=>true);}
	}
	}catch(Throwable $exception){http_response_code(503);$prepared=array('read_error'=>true);$formSpecs=array();}
	$feedback=mjl_activity_result_feedback($get);
	$view=array('row'=>$row,'prepared'=>$prepared,'recovery'=>$recovery,'timeline'=>$timeline,'role'=>$role,'effects'=>mjl_activity_prepare_form_effects($formSpecs,$user,$entity),'feedback'=>$feedback);
	if($action===''&&$id===''&&$readiness!==0)header('Cache-Control: private, no-store');
	llxHeader('', 'Activités');
	mjl_navigation_shell_start($user);
	print '<div class="mjl-workspace">';
	print mjl_activity_feedback_html($feedback);
	if($action==='create'||$action==='edit')print mjl_activity_present('form',$view);
	elseif($action==='review')print mjl_activity_present('review',$view);
	elseif($row)print mjl_activity_present('detail',$view);
	else {
		if ($readiness === 0) {
			$filters = mjl_activity_list_query($get);
		} else {
			$source = $get;
			unset($source['action'],$source['result'],$source['mainmenu'],$source['leftmenu']);
			if (isset($source['status'])) {
				if (isset($source['validation_status']) && $source['validation_status'] !== $source['status']) mjl_activity_bad_request();
				$source['validation_status'] = $source['status'];
				unset($source['status']);
			}
			try { $filters = mjl_monitoring_validate_request($source); }
			catch (InvalidArgumentException $exception) { mjl_activity_filter_bad_request(); }
		}
		try { $list = mjl_monitoring_read_activity_list($db,$user,$entity,$filters,$readiness); }
		catch (Throwable $exception) { if($exception->getMessage()==='INVALID_FILTER')mjl_activity_bad_request(); http_response_code(503); print mjl_ui_system_state('unavailable','Suivi indisponible','Les données ne peuvent pas être chargées. Aucun total ni action n’est disponible.'); $list=null; }
		if ($list !== null) {
			$list['filters']=$filters;
			$list['can_create']=mjl_scope_is_input_agent($user);
			$list['actor_id']=(int)$user->id;
			$list['updated_at']=gmdate('d/m/Y H:i');
			$list['report_available']=mjl_monitoring_read_report_available($db);
			if($list['mode']==='target')foreach($list['rows']as&$activity){$actions=mjl_monitoring_activity_actions($activity,$list['role'],$list['actor_id'],$list['date']);$activity['execution_allowed']=$actions['execution'];}unset($activity);
			print mjl_activity_present('list',$list);
		}
	}
	print '</div>';
	if($action==='create'||$action==='edit') print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_financial_preview.js?v=1"></script><script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_form_controls.js?v=1"></script><script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/activities.js?v=010"></script>';
	elseif($action===''&&$id===''&&$readiness!==0)print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_form_controls.js?v=1"></script>';
	mjl_navigation_shell_end(); llxFooter();
}

function mjl_activity_post($action,$id,array $post,$db,$user,$entity)
{
	$base=array('token','mjl_submission','action','id','revision_id','version');
	$structure=array('partner_id','project_id','name','description','date_start','date_end','authorized_amount','operation_key','operation_id','operation_version','operation_name','operation_type_id','operation_amount');
	$extras=array('create_draft'=>array('mjl_submission_create_submit'),'create_submit'=>array('mjl_submission_create_submit'),'abandon'=>array('reason'),'restore'=>array('primary_agent_id','reason'),'review_revision'=>array('decision','reason','requested_amount'),'assignment_change'=>array('assignment_operation','target_agent_id','reason'),'request_cancellation'=>array('reason'));
	$allowed=array_merge($base,in_array($action,array('create_draft','create_submit','save_structure'),true)?$structure:array(),$extras[$action]??array());
	foreach(array_keys($post) as $key)if(!is_string($key)||!in_array($key,$allowed,true))mjl_activity_forbidden();
	if (!function_exists('currentToken') || !isset($post['token']) || !is_scalar($post['token']) || !hash_equals((string)currentToken(),(string)$post['token']))mjl_activity_forbidden();
	$version=mjl_activity_decimal('version',$post,true); $revision=mjl_activity_decimal('revision_id',$post,true);
	$version=$version===''?'0':$version; $revision=$revision===''?'0':$revision;
	$objectId=$id===''?'0':$id;
	$submissionField=$action==='create_submit'?'mjl_submission_create_submit':'mjl_submission';
	if (!isset($post[$submissionField])||!is_scalar($post[$submissionField])||!mjl_form_submission_consume((string)$post[$submissionField],mjl_activity_context($action,$objectId,$revision,$version,$user,$entity)))mjl_activity_forbidden();
	$command=new MjlActivityCommand($db);
	if($action==='create_draft'||$action==='create_submit'){$input=mjl_activity_structure_from_post($post);$result=$input===null?array('code'=>'INVALID_INPUT'):($action==='create_draft'?$command->createDraft($input,$user):$command->createAndSubmit($input,$user));}
	elseif($action==='save_structure'){$input=mjl_activity_structure_from_post($post);$result=$input===null?array('code'=>'INVALID_INPUT'):$command->saveStructure($id,$version,$input,$user);}
	elseif($action==='submit_revision')$result=$command->submitRevision($id,$version,$user);
	elseif($action==='abandon')$result=$command->abandonDraft($id,$version,$user,isset($post['reason'])&&is_scalar($post['reason'])?(string)$post['reason']:'');
	elseif($action==='restore')$result=$command->restoreDraft($id,$version,$user,mjl_activity_decimal('primary_agent_id',$post),isset($post['reason'])&&is_scalar($post['reason'])?(string)$post['reason']:'');
	elseif($action==='review_revision')$result=$command->reviewRevision($id,$revision,$version,$user,isset($post['decision'])&&is_scalar($post['decision'])?(string)$post['decision']:'',isset($post['reason'])&&is_scalar($post['reason'])?(string)$post['reason']:'',isset($post['requested_amount'])&&$post['requested_amount']!==''&&is_scalar($post['requested_amount'])?(string)$post['requested_amount']:null);
	elseif($action==='request_cancellation')$result=$command->requestCancellation('ACTIVITY',$id,$version,isset($post['reason'])&&is_scalar($post['reason'])?(string)$post['reason']:'',$user);
	else {
		$service=new MjlActivityAssignment($db);
		$result=$service->changeAssignment($id,$version,$user,isset($post['assignment_operation'])&&is_scalar($post['assignment_operation'])?(string)$post['assignment_operation']:'',mjl_activity_decimal('target_agent_id',$post),isset($post['reason'])&&is_scalar($post['reason'])?(string)$post['reason']:'');
	}
	$target=isset($result['activity_id'])&&$result['activity_id']?(int)$result['activity_id']:(int)$objectId;
	if($action==='abandon'&&isset($result['code'])&&$result['code']==='OK')$target=0;
	$query=array('result'=>isset($result['code'])?$result['code']:'FAILED'); if($target>0)$query['id']=$target;
	if(isset($input)&&is_array($input)&&in_array($query['result'],array('INVALID_INPUT','CONFLICT','FAILED'),true)){$view=strpos($action,'create_')===0?'create':'edit';$handle=mjl_activity_recovery_store($input,$objectId,$view);if($handle!==''){$query['action']=$view;$query['recovery']=$handle;}}
	header('Location: '.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?'.http_build_query($query),true,303); exit;
}

function mjl_activity_review_eligibility($db,array $row,$user,$entity,$readiness,$monitoringContext=null)
{
	if($readiness!==0){
		try{$context=$monitoringContext===null?mjl_monitoring_read_activity_context($db,$user,$entity,$row):$monitoringContext;$actions=$context['monitoring_actions'];return array('allowed'=>$actions['review'],'return_allowed'=>$actions['return'],'reason'=>$actions['review']?'':'Cette révision n’est pas à votre étape ou votre participation interdit cette décision.');}
		catch(Throwable $exception){return array('allowed'=>false,'return_allowed'=>false,'reason'=>'Les autorisations de décision sont indisponibles.');}
	}
	$revision=(int)($row['fk_current_revision']??0);$role=mjl_scope_effective_role_code($user);
	if($revision<=0||!in_array($role,array('AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF'),true))return array('allowed'=>false,'reason'=>'Aucune révision n’est disponible pour votre profil.');
	$expected=$role==='AGENT_VERIFICATEUR'?'SUBMITTED':'PREVALIDATED';
	if(($row['validation_status']??'')!==$expected)return array('allowed'=>false,'reason'=>'Cette révision n’est pas à votre étape de validation.');
	$facts=mjl_monitoring_read_fallback_review_facts($db,$entity,$revision,(int)$user->id);
	if($facts['is_contributor'])return array('allowed'=>false,'reason'=>'Vous figurez parmi les contributeurs de cette révision.');
	if($role==='VALIDATEUR_DEFINITIF'&&$facts['prevalidator_id']===(int)$user->id)return array('allowed'=>false,'reason'=>'Le prévalidateur ne peut pas valider définitivement la même révision.');
	return array('allowed'=>true,'reason'=>'');
}
