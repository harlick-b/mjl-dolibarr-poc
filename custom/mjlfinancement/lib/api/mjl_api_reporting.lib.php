<?php

require_once dirname(__DIR__).'/monitoring/mjl_monitoring_read.lib.php';
require_once dirname(__DIR__).'/monitoring/mjl_monitoring_presentation.lib.php';
require_once dirname(__DIR__).'/reporting/mjl_reporting_read.lib.php';
require_once dirname(__DIR__).'/reporting/mjl_export_delivery.lib.php';
require_once dirname(__DIR__, 2).'/class/mjlexport.class.php';
require_once dirname(__DIR__).'/mjl_audit_projection.lib.php';

function mjl_api_reporting_role(User $actor, $audit = false)
{
	$role = mjl_scope_effective_role_code($actor, mjl_auth_entity());
	$allowed = $audit ? array('VALIDATEUR_DEFINITIF','ADMIN_PLATEFORME') : array('AGENT_SAISIE','AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF');
	if (!in_array($role, $allowed, true)) mjl_api_fail(403, 'forbidden');
	return $role;
}

function mjl_api_reporting_filters(array $query, $audit = false, $operations = false)
{
	try { return $audit ? mjl_monitoring_filters($query, true) : mjl_monitoring_validate_request($query, $operations); }
	catch (InvalidArgumentException $exception) { mjl_api_fail(400, 'invalid_request'); }
}

function mjl_api_work_item(array $item)
{
	return array(
		'activity_id'=>(string)$item['activity_id'],
		'operation_id'=>$item['operation_id'] === null ? null : (string)$item['operation_id'],
		'request_id'=>$item['request_id'] === null ? null : (string)$item['request_id'],
		'request_type'=>$item['request_type'],
		'label'=>$item['label'], 'allowed_actions'=>$item['allowed_actions'],
		'date'=>$item['date'], 'reference'=>$item['reference'], 'closure'=>(bool)$item['closure'],
	);
}

function mjl_api_alert(array $item)
{
	return array(
		'code'=>$item['code'],
		'activity_id'=>(string)$item['activity_id'],
		'operation_id'=>$item['operation_id']===null?null:(string)$item['operation_id'],
		'label'=>$item['label'],
		'actionable'=>(bool)$item['actionable'],
		'date'=>$item['date'],
		'reference'=>$item['reference'],
		'priority'=>(int)$item['priority'],
	);
}

function mjl_api_dashboard(User $actor, array $query, $alertsOnly)
{
	global $db;
	$role=mjl_api_reporting_role($actor); $filters=mjl_api_reporting_filters($query); $entity=mjl_auth_entity();
	if(mjl_monitoring_readiness()!==1)mjl_api_fail(503,'unavailable');
	$data=mjl_monitoring_read_page($db,$actor,$entity,$alertsOnly?'alerts':'home',$filters);
	$alerts=mjl_monitoring_alerts($data['activities'],$role,(int)$actor->id,$data['date']);
	$page=(int)$filters['page']; $offset=($page-1)*50;
	if($alertsOnly)return array('data'=>array_map('mjl_api_alert',array_slice($alerts,$offset,50)),'pagination'=>array('page'=>$page,'page_size'=>50,'has_next'=>count($alerts)>$page*50),'total_count'=>count($alerts));
	$queue=null;
	if($data['work_activities']!==null&&$data['requests']!==null)$queue=mjl_monitoring_queue($data['work_activities'],$data['requests'],$role,(int)$actor->id,$data['date']);
	$validation=array(); foreach(array('DRAFT','SUBMITTED','PREVALIDATED','RETURNED_SUPERVISOR','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED','ABANDONED') as $status)$validation[$status]=mjl_dashboard_count_status($data['activities'],'validation_status',$status);
	$execution=array(); foreach(array('NOT_STARTED','UPCOMING','IN_PROGRESS','OVERDUE','COMPLETED','CANCELLED') as $status)$execution[$status]=mjl_dashboard_count_status($data['activities'],'execution_status',$status);
	$choices=$data['choices']; if($choices!==null)foreach($choices as &$list)foreach($list as &$choice)$choice['id']=(string)$choice['id'];unset($list,$choice);
	return array('data'=>array(
		'calculated_on'=>$data['date'],
		'financial'=>mjl_monitoring_dashboard_totals($data['activities']),
		'validation_counts'=>$validation,
		'execution_counts'=>$execution,
		'work_items'=>$queue===null?null:array_map('mjl_api_work_item',array_slice($queue,$offset,50)),
		'work_count'=>$queue===null?null:count($queue),
		'pagination'=>$queue===null?null:array('page'=>$page,'page_size'=>50,'has_next'=>count($queue)>$page*50),
		'alerts'=>array_map('mjl_api_alert',array_slice($alerts,0,5)),
		'alert_count'=>count($alerts),
		'filter_options'=>$choices,
	));
}

function mjl_api_audit_event(array $event, &$remaining)
{
	$changes=array(); $status='available'; $meta=mjl_audit_report_metadata($event); $label=$meta['action_label'];
	try {
		$rows=mjl_audit_project_event($event,$remaining); $remaining-=count($rows); $label=$meta['action_label'];
		foreach($rows as $row)$changes[]=array_intersect_key($row,array_flip(array('path','field_label','kind','part','parts','before_type','before','after_type','after')));
	} catch (Throwable $exception) { $status=$exception->getMessage()==='UNSUPPORTED_RECORD'?'unsupported':($exception->getMessage()==='REPORT_LIMIT'?'oversized':'unavailable'); }
	return array(
		'id'=>(string)$event['rowid'],
		'object_type'=>$meta['object_type'],
		'object_id'=>isset($event['object_id'])?(string)$event['object_id']:null,
		'object_ref'=>$meta['object_ref'],
		'action'=>$meta['action'],
		'state_before'=>$meta['state_before'],
		'state_after'=>$meta['state_after'],
		'actor_name'=>$meta['actor_name'],
		'actor_role'=>$meta['actor_role'],
		'event_at'=>(new DateTimeImmutable($event['event_date'],new DateTimeZone(date_default_timezone_get())))->format('c'),
		'reason'=>isset($event['reason'])?mjl_audit_report_redact($event['reason']):null,
		'result'=>$event['result'],
		'changes'=>$changes,
		'activity_id'=>isset($event['activity_id'])?(string)$event['activity_id']:null,
		'operation_id'=>isset($event['operation_id'])?(string)$event['operation_id']:null,
		'revision_id'=>isset($event['revision_id'])?(string)$event['revision_id']:null,
		'target_version'=>isset($event['target_version'])?(string)$event['target_version']:null,
		'actor_id'=>isset($event['actor_id'])?(string)$event['actor_id']:null,
		'entity'=>(string)$event['entity'],
		'action_label'=>$label,
		'detail_status'=>$status,
	);
}

function mjl_api_audit(User $actor, array $query)
{
	global $db; mjl_api_reporting_role($actor,true); $filters=mjl_api_reporting_filters($query,true);
	try{$events=mjl_reporting_read_audit($db,$actor,mjl_auth_entity(),$filters);}catch(InvalidArgumentException $e){mjl_api_fail(400,'invalid_request');}
	$more=count($events)>50; $events=array_slice($events,0,50); $remaining=10000; $data=array();
	foreach($events as $event)$data[]=mjl_api_audit_event($event,$remaining);
	return array('data'=>$data,'pagination'=>array('next_cursor'=>$more?(string)$events[49]['rowid']:null,'has_next'=>$more));
}

function mjl_api_report_type($path)
{
	if(!preg_match('~^/reports/(activities|operations|activity_detail|portfolio|audit)(/exports)?$~D',$path,$match))mjl_api_fail(404,'not_found');
	return array($match[1],!empty($match[2]));
}

function mjl_api_report_error(Throwable $exception)
{
	$code=$exception->getMessage();
	if($code==='NOT_FOUND')mjl_api_fail(404,'not_found');
	if(in_array($code,array('FORBIDDEN','SCOPE_CHANGED'),true))mjl_api_fail(403,'forbidden');
	if($code==='EXPORT_BUSY')mjl_api_fail(409,'export_busy');
	if($code==='UNSUPPORTED_RECORD')mjl_api_fail(422,'unsupported_record');
	if(in_array($code,array('SOURCE_LIMIT','REPORT_LIMIT','ARTIFACT_LIMIT','EXPORT_MEMORY_LIMIT'),true))mjl_api_fail(422,'selection_too_large');
	if($code==='EXPORT_COMMIT_UNCERTAIN')mjl_api_fail(503,'outcome_unknown');
	mjl_api_fail(503,'unavailable');
}

function mjl_api_report(User $actor, array $request)
{
	global $db; list($type,$export)=mjl_api_report_type($request['path']); mjl_api_reporting_role($actor,$type==='audit');
	if($type==='audit'&&!$export)mjl_api_fail(404,'not_found');
	if(!$export){
		try{$filters=mjl_report_validate_request($type,'csv',$request['query'],false);$read=mjl_reporting_read_preview($db,$actor,mjl_auth_entity(),$type,$filters);}
		catch(InvalidArgumentException $e){mjl_api_fail(400,'invalid_request');}catch(Throwable $e){if($e->getMessage()==='FORBIDDEN')mjl_api_fail(404,'not_found');mjl_api_report_error($e);}
		$document=$read['document']??null;
		return array('data'=>$document);
	}
	mjl_api_fields($request['body'],array('format','filters')); $format=mjl_api_string($request['body']->format,8); if(!in_array($format,array('pdf','xlsx','csv'),true))mjl_api_fail(400,'invalid_request');
	if(!($request['body']->filters instanceof stdClass))mjl_api_fail(400,'invalid_request'); $filters=get_object_vars($request['body']->filters);
	foreach($filters as $key=>$value)if(!is_string($value))mjl_api_fail(400,'invalid_request');
	if(array_key_exists('page',$filters)||array_key_exists('cursor',$filters))mjl_api_fail(400,'invalid_request');
	try{mjl_report_validate_request($type,$format,$filters,false);}catch(InvalidArgumentException $e){mjl_api_fail(400,'invalid_request');}
	mjl_auth_session_touch(time());
	if(session_status()===PHP_SESSION_ACTIVE&&!session_write_close())mjl_api_fail(503,'unavailable');
	if(headers_sent())mjl_api_fail(503,'unavailable');
	try{
		$builders=array(
			'activities'=>'mjl_report_build_activities',
			'operations'=>'mjl_report_build_operations',
			'activity_detail'=>'mjl_report_build_activity_detail',
			'portfolio'=>'mjl_report_build_portfolio',
			'audit'=>'mjl_report_build_audit',
		);
		$artifact=(new MjlExport($db,$actor,mjl_auth_entity(),'/tmp/mjlfinancement-exports'))->generate($type,$format,$filters,$builders[$type]);
	}
	catch(Throwable $e){mjl_api_report_error($e);}
	$GLOBALS['mjl_api_completed']=true;
	try{
		$db->close();
		if(!mjl_export_deliver_checked($artifact,$format))exit;
	}catch(Throwable $e){
		if(isset($artifact['stream'])&&is_resource($artifact['stream']))fclose($artifact['stream']);
		$GLOBALS['mjl_api_completed']=false; throw $e;
	}
	exit;
}

function mjl_api_reporting(array $request, User $actor)
{
	try{
		if($request['path']==='/dashboard')$result=mjl_api_dashboard($actor,$request['query'],false);
		elseif($request['path']==='/alerts')$result=mjl_api_dashboard($actor,$request['query'],true);
		elseif($request['path']==='/audit-events')$result=mjl_api_audit($actor,$request['query']);
		else $result=mjl_api_report($actor,$request);
	}catch(MjlApiError $e){throw $e;}catch(Throwable $e){mjl_api_report_error($e);}
	mjl_auth_session_touch(time()); return array(200,$result);
}
