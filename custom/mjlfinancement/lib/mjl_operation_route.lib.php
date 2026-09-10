<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form_submission.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_presentation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_execution.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivitycommand.class.php';

function mjl_operation_forbidden() { http_response_code(403); header('Content-Type: text/plain; charset=UTF-8'); print 'Forbidden'; exit; }
function mjl_operation_bad_request() { http_response_code(400); header('Content-Type: text/plain; charset=UTF-8'); print 'Requête non valide'; exit; }

function mjl_operation_decimal($name, array $source, $allowZero = false)
{
	if (!array_key_exists($name, $source) || !is_scalar($source[$name])) return '';
	$value=(string)$source[$name]; $pattern=$allowZero?'/^(0|[1-9][0-9]*)$/':'/^[1-9][0-9]*$/';
	return preg_match($pattern,$value)===1 && strlen($value)<=19 && (strlen($value)<19||strcmp($value,'9223372036854775807')<=0) ? $value : '';
}

function mjl_operation_nullable_amount($name,array $source)
{
	if(!array_key_exists($name,$source)||!is_scalar($source[$name]))return array('valid'=>false,'value'=>null);
	$value=(string)$source[$name];if($value==='')return array('valid'=>true,'value'=>null);
	$canonical=mjl_operation_decimal($name,$source,true);return array('valid'=>$canonical!=='','value'=>$canonical===''?null:$canonical);
}

function mjl_operation_context($action,$activityId,$operationId,$version)
{
	global $conf,$user;
	return array('user_id'=>(int)$user->id,'entity'=>(int)$conf->entity,'route'=>'operations','form'=>'execution','action'=>$action,'object_id'=>(int)$operationId,'activity_id'=>(int)$activityId,'version'=>(int)$version);
}

function mjl_operation_hidden($action,$activityId,$operationId,$version)
{
	return '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="mjl_submission" value="'.dol_escape_htmltag(mjl_form_submission_issue(mjl_operation_context($action,$activityId,$operationId,$version))).'"><input type="hidden" name="action" value="'.$action.'"><input type="hidden" name="activity_id" value="'.(int)$activityId.'"><input type="hidden" name="operation_id" value="'.(int)$operationId.'"><input type="hidden" name="version" value="'.(int)$version.'">';
}

function mjl_operation_status_label($status)
{
	$labels=array('TODO'=>'À faire','IN_PROGRESS'=>'En cours','COMPLETED'=>'Terminée','CANCELLED'=>'Annulée');
	return isset($labels[$status])?$labels[$status]:(string)$status;
}

function mjl_operation_route()
{
	global $db,$conf,$user;
	$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));
	if(empty($user->id)||!mjl_activity_access_can_enter_list($user)||!in_array($method,array('GET','POST'),true))mjl_operation_forbidden();
	try{mjl_rst006b_require_target($db);}catch(Throwable $exception){http_response_code(503);llxHeader('','Opérations');mjl_navigation_shell_start($user);print '<div class="mjl-workspace">'.mjl_ui_system_state('unavailable','Migration requise','Le suivi d’exécution sera disponible après la migration RST-006B.').'</div>';mjl_navigation_shell_end();llxFooter();return;}
	if($method==='POST')mjl_operation_post();
	require_once __DIR__.'/mjl_monitoring_access.lib.php';
	if (mjl_monitoring_readiness()!==0) { require_once __DIR__.'/mjl_monitoring_route.lib.php'; mjl_monitoring_page('operations'); return; }
	foreach(array_keys($_GET)as$key)if(!in_array($key,array('page','result'),true))mjl_operation_forbidden();
	$page=1;if(isset($_GET['page'])){$value=is_scalar($_GET['page'])?(string)$_GET['page']:'';if(preg_match('/^[1-9][0-9]*$/',$value)!==1||strlen($value)>18||(int)$value>intdiv(PHP_INT_MAX,50))mjl_operation_bad_request();$page=(int)$value;}
	$entity=(int)$conf->entity;$offset=($page-1)*50;
	$sql='SELECT o.rowid,o.version,o.name,o.authorized_amount,o.spent_amount,o.observation,o.status,a.rowid AS activity_id,a.ref AS activity_ref,a.name AS activity_name,a.validation_status,a.is_cancelled,t.label AS type_label,p.ref AS project_ref,p.title AS project_title,s.nom AS partner_name';
	$sql.=' FROM '.$db->prefix().'mjlfinancement_operation o INNER JOIN '.$db->prefix().'mjlfinancement_activity a ON a.entity=o.entity AND a.rowid=o.fk_activity INNER JOIN '.$db->prefix().'mjlfinancement_operation_type t ON t.entity=o.entity AND t.rowid=o.fk_operation_type INNER JOIN '.$db->prefix().'projet p ON p.entity=a.entity AND p.rowid=a.fk_project INNER JOIN '.$db->prefix().'societe s ON s.entity=a.entity AND s.rowid=a.fk_partner AND s.rowid=p.fk_soc';
	if(mjl_scope_is_input_agent($user,$entity))$sql.=' INNER JOIN '.$db->prefix().'mjlfinancement_activity_assignment aa ON aa.entity=a.entity AND aa.fk_activity=a.rowid AND aa.fk_user='.(int)$user->id.' AND aa.date_end IS NULL';
	$sql.=' WHERE o.entity='.$entity.' AND o.date_removed IS NULL ORDER BY o.rowid DESC LIMIT 51 OFFSET '.$offset;
	$res=$db->query($sql);$rows=array();if($res)while($row=$db->fetch_object($res))$rows[]=$row;$hasNext=count($rows)>50;$rows=array_slice($rows,0,50);
	llxHeader('','Opérations');mjl_navigation_shell_start($user);print '<div class="mjl-workspace">'.mjl_page_header_render('Opérations',array('description'=>'Saisir et suivre l’exécution des Opérations de l’entité active.')).'<section class="mjl-workspace-section">'.mjl_operation_feedback();
	if (mjl_rst002b_table_exists($db,$db->prefix().'mjlfinancement_export_record')) print '<p><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report=operations">Suivi des Opérations et téléchargements</a></p>';
	if(!$res)print mjl_ui_system_state('unavailable','Opérations indisponibles','Réessayez dans quelques instants.');elseif(!$rows)print mjl_ui_system_state('initial-empty','Aucune Opération','Aucune Opération active n’est enregistrée.');else mjl_operation_render_rows($rows);
	if($page>1||$hasNext){print '<nav class="mjl-pagination" aria-label="Pagination des Opérations">';if($page>1)print '<a class="mjl-action mjl-action-secondary" rel="prev" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/operations.php'.($page>2?'?page='.($page-1):'').'">Précédent</a>';if($hasNext)print '<a class="mjl-action mjl-action-secondary" rel="next" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/operations.php?page='.($page+1).'">Suivant</a>';print '</nav>';}
	print '</section></div>';mjl_navigation_shell_end();llxFooter();
}

function mjl_operation_feedback()
{
	if(!isset($_GET['result'])||!is_scalar($_GET['result']))return '';
	$messages=array('OK'=>array('success','Action enregistrée','La fiche a été mise à jour.'),'INVALID_INPUT'=>array('danger','Saisie non valide','Vérifiez les champs et réessayez.'),'FORBIDDEN'=>array('danger','Action non autorisée','Votre profil ou votre affectation ne permet pas cette action.'),'STALE_VERSION'=>array('warning','La fiche a changé','Rechargez la page avant de réessayer.'),'RETRYABLE_CONFLICT'=>array('warning','Conflit temporaire','Une autre action est en cours. Rechargez la page et réessayez.'),'CONFLICT'=>array('warning','Action impossible','Vérifiez le statut, le montant dépensé, l’observation et les demandes en attente.'),'FAILED'=>array('danger','Échec de l’enregistrement','Aucune modification n’a été enregistrée.'));
	$code=(string)$_GET['result'];return isset($messages[$code])?mjl_ui_system_state($messages[$code][0],$messages[$code][1],$messages[$code][2]):'';
}

function mjl_operation_post()
{
	global $user;
	if($_GET||!isset($_SERVER['CONTENT_LENGTH'])||preg_match('/^(0|[1-9][0-9]*)$/',(string)$_SERVER['CONTENT_LENGTH'])!==1||(int)$_SERVER['CONTENT_LENGTH']>16384)mjl_operation_bad_request();
	if(!isset($_POST['action'])||!is_scalar($_POST['action']))mjl_operation_bad_request();$action=(string)$_POST['action'];
	$extras=array('update_execution'=>array('status','spent_amount','observation'),'request_cancellation'=>array('reason'),'request_reopening'=>array('reason'));
	if(!isset($extras[$action]))mjl_operation_forbidden();$allowed=array_merge(array('token','mjl_submission','action','activity_id','operation_id','version'),$extras[$action]);foreach(array_keys($_POST)as$key)if(!is_string($key)||!in_array($key,$allowed,true))mjl_operation_forbidden();
	if(!function_exists('currentToken')||!isset($_POST['token'])||!is_scalar($_POST['token'])||!hash_equals((string)currentToken(),(string)$_POST['token']))mjl_operation_forbidden();
	$activityId=mjl_operation_decimal('activity_id',$_POST);$operationId=mjl_operation_decimal('operation_id',$_POST);$version=mjl_operation_decimal('version',$_POST);if($activityId===''||$operationId===''||$version===''||!mjl_activity_access_can_read_activity($user,$activityId))mjl_operation_forbidden();
	if(!isset($_POST['mjl_submission'])||!is_scalar($_POST['mjl_submission'])||!mjl_form_submission_consume((string)$_POST['mjl_submission'],mjl_operation_context($action,$activityId,$operationId,$version)))mjl_operation_forbidden();
	$command=new MjlActivityCommand($GLOBALS['db']);
	if($action==='update_execution'){$status=isset($_POST['status'])&&is_scalar($_POST['status'])?(string)$_POST['status']:'';$spent=mjl_operation_nullable_amount('spent_amount',$_POST);$observation=isset($_POST['observation'])&&is_scalar($_POST['observation'])?trim((string)$_POST['observation']):'';if(!$spent['valid'])$result=array('code'=>'INVALID_INPUT');else{$input=array('status'=>$status,'spent_amount'=>$spent['value'],'observation'=>$observation===''?null:$observation);$result=$command->updateOperationExecution($activityId,$operationId,$version,$input,$user);}}
	elseif($action==='request_cancellation'){$reason=isset($_POST['reason'])&&is_scalar($_POST['reason'])?(string)$_POST['reason']:'';$result=$command->requestCancellation('OPERATION',$operationId,$version,$reason,$user);}
	else{$reason=isset($_POST['reason'])&&is_scalar($_POST['reason'])?(string)$_POST['reason']:'';$result=$command->requestReopening($operationId,$version,$reason,$user);}
	header('Location: '.DOL_URL_ROOT.'/custom/mjlfinancement/operations.php?'.http_build_query(array('result'=>$result['code']??'FAILED')),true,303);exit;
}

function mjl_operation_render_rows(array $rows)
{
	global $user;
	foreach($rows as$row){$url=DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row->activity_id;print '<article class="mjl-operation-card" id="operation-'.(int)$row->rowid.'"><h2>'.dol_escape_htmltag($row->name).'</h2><p><a href="'.$url.'">'.dol_escape_htmltag($row->activity_ref.' - '.$row->activity_name).'</a></p><dl class="mjl-activity-meta"><div><dt>Partenaire</dt><dd>'.dol_escape_htmltag($row->partner_name).'</dd></div><div><dt>Projet</dt><dd>'.dol_escape_htmltag($row->project_name ?? trim($row->project_ref.' - '.$row->project_title)).'</dd></div><div><dt>Type d’Opération</dt><dd>'.dol_escape_htmltag($row->type_label).'</dd></div><div><dt>Statut</dt><dd>'.dol_escape_htmltag(mjl_operation_status_label($row->status)).'</dd></div><div><dt>'.(isset($row->authorization_kind)?($row->authorization_kind==='Proposée'?'Montant proposé':'Montant autorisé validé'):'Montant autorisé').'</dt><dd>'.dol_escape_htmltag(mjl_format_money($row->authorized_amount)).'</dd></div><div><dt>Montant dépensé</dt><dd>'.dol_escape_htmltag(mjl_format_money($row->spent_amount)).'</dd></div><div><dt>Écart</dt><dd>'.dol_escape_htmltag(mjl_execution_variance_amount($row->spent_amount,$row->authorized_amount)).'</dd></div><div><dt>Variance %</dt><dd>'.dol_escape_htmltag(mjl_execution_variance_percent($row->spent_amount,$row->authorized_amount)).'</dd></div></dl>';
		if($row->observation!==null&&$row->observation!=='')print '<p><strong>Observation :</strong> '.dol_escape_htmltag($row->observation).'</p>';
		$canAct=isset($row->execution_allowed)?$row->execution_allowed:(mjl_scope_is_input_agent($user)&&(string)$row->validation_status==='FINAL_VALIDATED'&&empty($row->is_cancelled));
		if($canAct&&!in_array($row->status,array('COMPLETED','CANCELLED'),true)){print '<form method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/operations.php">'.mjl_operation_hidden('update_execution',$row->activity_id,$row->rowid,$row->version).'<label>Statut <select name="status"><option value="TODO"'.($row->status==='TODO'?' selected':'').'>À faire</option><option value="IN_PROGRESS"'.($row->status==='IN_PROGRESS'?' selected':'').'>En cours</option><option value="COMPLETED">Terminée</option></select></label><label>Montant dépensé <input name="spent_amount" inputmode="numeric" pattern="[0-9]+" value="'.dol_escape_htmltag($row->spent_amount===null?'':$row->spent_amount).'"></label><label>Observation <textarea name="observation" maxlength="2000">'.dol_escape_htmltag($row->observation??'').'</textarea></label><button class="button" type="submit">Enregistrer l’exécution</button></form>';}
		if($canAct&&$row->status!=='CANCELLED'){print '<form method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/operations.php">'.mjl_operation_hidden($row->status==='COMPLETED'?'request_reopening':'request_cancellation',$row->activity_id,$row->rowid,$row->version).'<label>Motif <textarea name="reason" maxlength="2000" required></textarea></label><button class="button button-secondary" type="submit">'.($row->status==='COMPLETED'?'Demander la réouverture':'Demander l’annulation').'</button></form>';}
		if($row->status==='CANCELLED')print '<p>Cette Opération est annulée et verrouillée.</p>';elseif($row->status==='COMPLETED')print '<p>Cette Opération est terminée et verrouillée. Une demande approuvée est requise pour la rouvrir.</p>';
		print '<p><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/operationrequests.php">Voir les demandes d’exception</a></p></article>';}
}
