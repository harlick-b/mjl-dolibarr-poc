<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form_submission.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_presentation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_execution.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
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

function mjl_activity_context($action, $id, $revision, $version)
{
	global $conf, $user;
	return array('user_id'=>(int)$user->id,'entity'=>(int)$conf->entity,'route'=>'activities','form'=>'activity','action'=>$action,'object_id'=>(int)$id,'revision_id'=>(int)$revision,'version'=>(int)$version);
}

function mjl_activity_structure_from_post()
{
	$scalarNames = array('partner_id','project_id','name','description','date_start','date_end','authorized_amount');
	foreach ($scalarNames as $name) if (!isset($_POST[$name]) || !is_scalar($_POST[$name])) return null;
	$arrayNames = array('operation_key','operation_id','operation_version','operation_name','operation_type_id','operation_amount');
	foreach ($arrayNames as $name) if (!isset($_POST[$name]) || !is_array($_POST[$name]) || count($_POST[$name]) > 50) return null;
	$keys = array_keys($_POST['operation_key']);
	foreach ($arrayNames as $name) if (array_keys($_POST[$name]) !== $keys) return null;
	$operations = array();
	$seen = array();
	foreach ($keys as $index) {
		if (!is_int($index) && preg_match('/^(0|[1-9][0-9]*)$/', (string)$index) !== 1) return null;
		foreach ($arrayNames as $name) if (!is_scalar($_POST[$name][$index])) return null;
		$key = (string) $_POST['operation_key'][$index];
		if (preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $key) !== 1 || isset($seen[$key])) return null;
		$op = array('client_key'=>$key,'name'=>(string)$_POST['operation_name'][$index],'type_id'=>(string)$_POST['operation_type_id'][$index],'authorized_amount'=>(string)$_POST['operation_amount'][$index]);
		$id = (string) $_POST['operation_id'][$index];
		$version = (string) $_POST['operation_version'][$index];
		if (($id === '') !== ($version === '')) return null;
		if ($id !== '') $op = array('id'=>$id,'expected_version'=>$version)+$op;
		$operations[] = $op; $seen[$key] = true;
	}
	return array('partner_id'=>(string)$_POST['partner_id'],'project_id'=>(string)$_POST['project_id'],'name'=>(string)$_POST['name'],'description'=>(string)$_POST['description'],'date_start'=>(string)$_POST['date_start'],'date_end'=>(string)$_POST['date_end'],'authorized_amount'=>(string)$_POST['authorized_amount'],'operations'=>$operations);
}

function mjl_activity_fetch($id)
{
	global $db, $conf;
	$res=$db->query('SELECT a.*,s.nom AS partner_name,p.ref AS project_ref,p.title AS project_title FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'societe s ON s.rowid=a.fk_partner AND s.entity=a.entity INNER JOIN '.$db->prefix().'projet p ON p.rowid=a.fk_project AND p.entity=a.entity WHERE a.entity='.(int)$conf->entity.' AND a.rowid='.(int)$id.' LIMIT 1');
	$row=$res?$db->fetch_object($res):null; return $row?(array)$row:array();
}

function mjl_activity_operations($id, $includeRemoved = false)
{
	global $db, $conf;
	$res=$db->query('SELECT o.*,t.label AS type_label FROM '.$db->prefix().'mjlfinancement_operation o INNER JOIN '.$db->prefix().'mjlfinancement_operation_type t ON t.rowid=o.fk_operation_type AND t.entity=o.entity WHERE o.entity='.(int)$conf->entity.' AND o.fk_activity='.(int)$id.($includeRemoved?'':' AND o.date_removed IS NULL').' ORDER BY o.rowid');
	$rows=array(); if($res)while($row=$db->fetch_object($res))$rows[]=(array)$row; return $rows;
}

function mjl_activity_revision($activityId, $revisionId)
{
	global $db,$conf;
	$res=$db->query('SELECT * FROM '.$db->prefix().'mjlfinancement_activity_revision WHERE entity='.(int)$conf->entity.' AND fk_activity='.(int)$activityId.' AND rowid='.(int)$revisionId.' LIMIT 1');
	$row=$res?$db->fetch_object($res):null; return $row?(array)$row:array();
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

function mjl_activity_payload_too_large()
{
	http_response_code(413);
	header('Content-Type: text/plain; charset=UTF-8');
	print 'Requête trop volumineuse';
	exit;
}

function mjl_activity_route()
{
	require_once __DIR__.'/mjl_monitoring_access.lib.php';
	global $db,$user;
	if (empty($user->id) || !mjl_activity_access_can_enter_list($user)) mjl_activity_forbidden();
	try { mjl_rst006b_require_target($db); } catch (Throwable $e) {
		http_response_code(503); llxHeader('', 'Activités'); mjl_navigation_shell_start($user); print '<div class="mjl-workspace">'.mjl_ui_system_state('unavailable','Migration requise','Le suivi d’exécution sera disponible après la migration RST-006B.').'</div>'; mjl_navigation_shell_end(); llxFooter(); return;
	}
	$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));
	if($method==='POST'){
		if(!isset($_SERVER['CONTENT_LENGTH'])||preg_match('/^(0|[1-9][0-9]*)$/',(string)$_SERVER['CONTENT_LENGTH'])!==1)mjl_activity_bad_request();
		if(strlen((string)$_SERVER['CONTENT_LENGTH'])>5||(int)$_SERVER['CONTENT_LENGTH']>65536)mjl_activity_payload_too_large();
	}
	$requestSource=$method==='POST'?$_POST:$_GET;
	if(isset($requestSource['action'])&&!is_scalar($requestSource['action']))mjl_activity_bad_request();
	$action=isset($requestSource['action'])?(string)$requestSource['action']:'';
	$getAllowed=array('','create','edit','review');
	$postAllowed=array('create_draft','create_submit','save_structure','submit_revision','abandon','restore','review_revision','assignment_change','request_cancellation');
	if (($method==='GET'&&!in_array($action,$getAllowed,true))||($method==='POST'&&!in_array($action,$postAllowed,true))||!in_array($method,array('GET','POST'),true))mjl_activity_forbidden();
	$id=mjl_activity_decimal('id',$method==='POST'?$_POST:$_GET);
	if(isset($requestSource['id'])&&$id==='')mjl_activity_bad_request();
	if ($method==='GET' && $action==='' && $id==='') {
		require_once __DIR__.'/mjl_monitoring_access.lib.php';
		if (mjl_monitoring_readiness()!==0) { require_once __DIR__.'/mjl_monitoring_route.lib.php'; mjl_monitoring_page('activities'); return; }
	}
	if($method==='POST')$allowedGetKeys=array('id');
	elseif($action==='create')$allowedGetKeys=array('action','result','recovery');
	elseif($action==='edit')$allowedGetKeys=array('action','id','result','recovery');
	elseif($action==='review')$allowedGetKeys=array('action','id','result','chronology_cursor');
	elseif($id!=='')$allowedGetKeys=array('action','id','result','chronology_cursor');
	else$allowedGetKeys=array('action','q','status','project_id','page','result');
	if (array_key_exists('chronology_cursor',$_GET) && mjl_activity_decimal('chronology_cursor',$_GET)==='') mjl_activity_bad_request();
	$allowedGetKeys=array_merge($allowedGetKeys,array('mainmenu','leftmenu'));
	foreach(array_keys($_GET)as$key)if(!is_string($key)||!in_array($key,$allowedGetKeys,true))mjl_activity_forbidden();
	if($method==='POST'&&isset($_GET['id'])&&mjl_activity_decimal('id',$_GET)!==$id)mjl_activity_forbidden();
	if ($action==='create' && $id!=='') mjl_activity_forbidden();
	if ($action!=='' && $action!=='create' && strpos($action,'create_')!==0 && $id==='') mjl_activity_forbidden();
	if ($method==='POST') mjl_activity_post($action,$id);
	$row=$id!==''?mjl_activity_fetch($id):array();
	if ($id!=='' && (!$row || !mjl_activity_access_can_read_activity($user,$id))) mjl_activity_forbidden();
	if ($action==='create'&&!mjl_scope_is_input_agent($user))mjl_activity_forbidden();
	if ($action==='edit'&&(!mjl_scope_is_input_agent($user)||!in_array($row['validation_status'],array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'),true)))mjl_activity_forbidden();
	if ($action==='review'&&!in_array(mjl_scope_effective_role_code($user),array('AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF'),true))mjl_activity_forbidden();
	if ($action==='' && $id==='' && mjl_activity_list_query($_GET)===null) mjl_activity_bad_request();
	if ($action==='edit' && mjl_monitoring_readiness()!==0) { try { $context=mjl_activity_monitoring_context($row); if (!$context['monitoring_actions']['edit']) mjl_activity_forbidden(); } catch (Throwable $exception) { mjl_activity_forbidden(); } }
	llxHeader('', 'Activités');
	mjl_navigation_shell_start($user);
	print '<div class="mjl-workspace">';
	print mjl_activity_result_feedback();
	if($action==='create'||$action==='edit')mjl_activity_render_form($row);
	elseif($action==='review')mjl_activity_render_review($row);
	elseif($row)mjl_activity_render_detail($row);
	else mjl_activity_render_list();
	print '</div>';
	if($action==='create'||$action==='edit') print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_financial_preview.js?v=1"></script><script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/mjl_form_controls.js?v=1"></script><script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/activities.js?v=010"></script>';
	mjl_navigation_shell_end(); llxFooter();
}

function mjl_activity_result_feedback()
{
	if (!isset($_GET['result']) || !is_scalar($_GET['result'])) return '';
	$messages = array(
		'OK' => array('success', 'Opération enregistrée', 'La fiche a été mise à jour.'),
		'INVALID_INPUT' => array('danger', 'Saisie non valide', 'Vérifiez les champs obligatoires, les montants et les Opérations, puis réessayez.'),
		'FORBIDDEN' => array('danger', 'Action non autorisée', 'Votre profil, votre affectation ou l’état actuel ne permet pas cette action.'),
		'NOT_FOUND' => array('danger', 'Activité introuvable', 'La fiche demandée n’existe plus dans cette entité.'),
		'STALE_VERSION' => array('warning', 'La fiche a changé', 'Rechargez la page avant de reprendre votre modification.'),
		'CONFLICT' => array('warning', 'Action impossible dans l’état actuel', 'Vérifiez le statut, la date de début et l’équilibre des montants.'),
		'RETRYABLE_CONFLICT' => array('warning', 'Conflit temporaire', 'Aucune modification n’a été enregistrée. Réessayez dans quelques instants.'),
		'MIGRATION_REQUIRED' => array('unavailable', 'Migration requise', 'Le suivi d’exécution est indisponible jusqu’à la migration RST-006B.'),
		'FAILED' => array('danger', 'Échec de l’enregistrement', 'Aucune modification n’a été enregistrée. Contactez l’administrateur si le problème persiste.'),
	);
	$code = (string) $_GET['result'];
	if (!isset($messages[$code])) return '';
	return mjl_ui_system_state($messages[$code][0], $messages[$code][1], $messages[$code][2]);
}

function mjl_activity_post($action,$id)
{
	global $user;
	$base=array('token','mjl_submission','action','id','revision_id','version');
	$structure=array('partner_id','project_id','name','description','date_start','date_end','authorized_amount','operation_key','operation_id','operation_version','operation_name','operation_type_id','operation_amount');
	$extras=array('create_draft'=>array('mjl_submission_create_submit'),'create_submit'=>array('mjl_submission_create_submit'),'abandon'=>array('reason'),'restore'=>array('primary_agent_id','reason'),'review_revision'=>array('decision','reason','requested_amount'),'assignment_change'=>array('assignment_operation','target_agent_id','reason'),'request_cancellation'=>array('reason'));
	$allowed=array_merge($base,in_array($action,array('create_draft','create_submit','save_structure'),true)?$structure:array(),$extras[$action]??array());
	foreach(array_keys($_POST) as $key)if(!is_string($key)||!in_array($key,$allowed,true))mjl_activity_forbidden();
	if (!function_exists('currentToken') || !isset($_POST['token']) || !is_scalar($_POST['token']) || !hash_equals((string)currentToken(),(string)$_POST['token']))mjl_activity_forbidden();
	$version=mjl_activity_decimal('version',$_POST,true); $revision=mjl_activity_decimal('revision_id',$_POST,true);
	$version=$version===''?'0':$version; $revision=$revision===''?'0':$revision;
	$objectId=$id===''?'0':$id;
	$submissionField=$action==='create_submit'?'mjl_submission_create_submit':'mjl_submission';
	if (!isset($_POST[$submissionField])||!is_scalar($_POST[$submissionField])||!mjl_form_submission_consume((string)$_POST[$submissionField],mjl_activity_context($action,$objectId,$revision,$version)))mjl_activity_forbidden();
	$command=new MjlActivityCommand($GLOBALS['db']);
	if($action==='create_draft'||$action==='create_submit'){$input=mjl_activity_structure_from_post();$result=$input===null?array('code'=>'INVALID_INPUT'):($action==='create_draft'?$command->createDraft($input,$user):$command->createAndSubmit($input,$user));}
	elseif($action==='save_structure'){$input=mjl_activity_structure_from_post();$result=$input===null?array('code'=>'INVALID_INPUT'):$command->saveStructure($id,$version,$input,$user);}
	elseif($action==='submit_revision')$result=$command->submitRevision($id,$version,$user);
	elseif($action==='abandon')$result=$command->abandonDraft($id,$version,$user,isset($_POST['reason'])&&is_scalar($_POST['reason'])?(string)$_POST['reason']:'');
	elseif($action==='restore')$result=$command->restoreDraft($id,$version,$user,mjl_activity_decimal('primary_agent_id',$_POST),isset($_POST['reason'])&&is_scalar($_POST['reason'])?(string)$_POST['reason']:'');
	elseif($action==='review_revision')$result=$command->reviewRevision($id,$revision,$version,$user,isset($_POST['decision'])&&is_scalar($_POST['decision'])?(string)$_POST['decision']:'',isset($_POST['reason'])&&is_scalar($_POST['reason'])?(string)$_POST['reason']:'',isset($_POST['requested_amount'])&&$_POST['requested_amount']!==''&&is_scalar($_POST['requested_amount'])?(string)$_POST['requested_amount']:null);
	elseif($action==='request_cancellation')$result=$command->requestCancellation('ACTIVITY',$id,$version,isset($_POST['reason'])&&is_scalar($_POST['reason'])?(string)$_POST['reason']:'',$user);
	else {
		$service=new MjlActivityAssignment($GLOBALS['db']);
		$result=$service->changeAssignment($id,$version,$user,isset($_POST['assignment_operation'])&&is_scalar($_POST['assignment_operation'])?(string)$_POST['assignment_operation']:'',mjl_activity_decimal('target_agent_id',$_POST),isset($_POST['reason'])&&is_scalar($_POST['reason'])?(string)$_POST['reason']:'');
	}
	$target=isset($result['activity_id'])&&$result['activity_id']?(int)$result['activity_id']:(int)$objectId;
	if($action==='abandon'&&isset($result['code'])&&$result['code']==='OK')$target=0;
	$query=array('result'=>isset($result['code'])?$result['code']:'FAILED'); if($target>0)$query['id']=$target;
	if(isset($input)&&is_array($input)&&in_array($query['result'],array('INVALID_INPUT','CONFLICT','FAILED'),true)){$view=strpos($action,'create_')===0?'create':'edit';$handle=mjl_activity_recovery_store($input,$objectId,$view);if($handle!==''){$query['action']=$view;$query['recovery']=$handle;}}
	header('Location: '.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?'.http_build_query($query),true,303); exit;
}

function mjl_activity_hidden($action,$id=0,$revision=0,$version=0)
{
	return '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="mjl_submission" value="'.dol_escape_htmltag(mjl_form_submission_issue(mjl_activity_context($action,$id,$revision,$version))).'"><input type="hidden" name="action" value="'.$action.'">'.($id?'<input type="hidden" name="id" value="'.$id.'">':'').'<input type="hidden" name="revision_id" value="'.$revision.'"><input type="hidden" name="version" value="'.$version.'">';
}

function mjl_activity_render_list()
{
	global $user;
	$filters=mjl_activity_list_query($_GET);if($filters===null)mjl_activity_bad_request();
	$offset=($filters['page']-1)*50;
	$model=new MjlActivity($GLOBALS['db']);$rows=$model->fetchReadProjection($user,$filters,51,$offset);
	if($rows===false)mjl_activity_bad_request();$hasNext=count($rows)>50;$rows=array_slice($rows, 0, 50);
	$options=array('description'=>'Planifier et suivre les Activités de l’entité active.');if(mjl_scope_is_input_agent($user))$options['primary_action']=array('label'=>'Créer une Activité','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?action=create');
	print mjl_page_header_render('Activités',$options).'<section class="mjl-workspace-section"><form class="mjl-table-filters mjl-activity-filters" method="GET" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php"><label for="activity-q">Recherche</label><input id="activity-q" name="q" maxlength="100" value="'.dol_escape_htmltag($filters['q']).'"><label for="activity-status">Statut</label><select id="activity-status" name="status"><option value="">Tous les statuts</option>';
	foreach(array('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED') as$status){$label=mjl_ui_activity_status($status);print '<option value="'.$status.'"'.($filters['status']===$status?' selected':'').'>'.dol_escape_htmltag($label['label']).'</option>';}
	print '</select><label for="activity-project">Projet</label><input id="activity-project" name="project_id" inputmode="numeric" pattern="[1-9][0-9]*" value="'.dol_escape_htmltag($filters['project_id']).'"><button class="button" type="submit">Filtrer</button></form>';
	if (mjl_rst002b_table_exists($GLOBALS['db'],$GLOBALS['db']->prefix().'mjlfinancement_export_record')) {
		$reportFilters=array('q'=>$filters['q'],'validation_status'=>$filters['status'],'project_id'=>$filters['project_id']);
		print '<p><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?'.dol_escape_htmltag(http_build_query($reportFilters)).'">Suivi des Activités et téléchargements</a></p>';
	}
	if(!$rows)print mjl_ui_system_state('initial-empty','Aucune Activité','Aucune Activité n’est enregistrée dans l’entité active.');
	else{print '<div class="div-table-responsive-no-min"><table class="noborder centpercent mjl-responsive-table"><thead><tr class="liste_titre"><th>Référence</th><th>Activité</th><th>Projet</th><th>Statut</th></tr></thead><tbody>';foreach($rows as$row){$url=DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row->rowid;$status=mjl_ui_activity_status($row->validation_status);print '<tr class="oddeven"><td data-label="Référence"><a href="'.$url.'">'.dol_escape_htmltag($row->ref).'</a></td><td data-label="Activité">'.dol_escape_htmltag($row->name).'</td><td data-label="Projet">'.dol_escape_htmltag(trim($row->project_ref.' - '.$row->project_title)).'</td><td data-label="Statut">'.mjl_ui_status_badge($status).'</td></tr>';}print '</tbody></table></div>';}
	if($filters['page']>1||$hasNext){print '<nav class="mjl-pagination" aria-label="Pagination des Activités">';if($filters['page']>1)print '<a class="mjl-action mjl-action-secondary" rel="prev" href="'.dol_escape_htmltag(mjl_activity_list_url($filters,$filters['page']-1)).'">Précédent</a>';if($hasNext)print '<a class="mjl-action mjl-action-secondary" rel="next" href="'.dol_escape_htmltag(mjl_activity_list_url($filters,$filters['page']+1)).'">Suivant</a>';print '</nav>';}
	print '</section>';
}

function mjl_activity_reference_options($table,$label,$selected)
{
	global $db,$conf;$active=$table==='societe'?'status=1':'fk_statut=1';$project=$table==='projet';$res=$db->query('SELECT rowid,'.$label.' AS label'.($project?',fk_soc AS partner_id':'').' FROM '.$db->prefix().$table.' WHERE entity='.(int)$conf->entity.' AND ('.$active.((int)$selected>0?' OR rowid='.(int)$selected:'').') ORDER BY '.$label.',rowid');$html='<option value="">Sélectionner</option>';if($res)while($row=$db->fetch_object($res))$html.='<option value="'.(int)$row->rowid.'"'.($project?' data-partner-id="'.(int)$row->partner_id.'"':'').((int)$selected===(int)$row->rowid?' selected':'').'>'.dol_escape_htmltag($row->label).'</option>';return $html;
}
function mjl_activity_type_options($selected)
{
	global $db,$conf;$res=$db->query('SELECT rowid,label FROM '.$db->prefix().'mjlfinancement_operation_type WHERE entity='.(int)$conf->entity.' AND (is_active=1'.((int)$selected>0?' OR rowid='.(int)$selected:'').') ORDER BY label,rowid');$html='<option value="">Sélectionner</option>';if($res)while($row=$db->fetch_object($res))$html.='<option value="'.(int)$row->rowid.'"'.((int)$selected===(int)$row->rowid?' selected':'').'>'.dol_escape_htmltag($row->label).'</option>';return $html;
}

function mjl_activity_agent_options(array $assignmentFlags=array())
{
	global $db,$conf;$res=$db->query('SELECT u.rowid,u.login,u.firstname,u.lastname FROM '.$db->prefix()."user u INNER JOIN ".$db->prefix()."mjlfinancement_user_role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code='AGENT_SAISIE' WHERE u.entity=".(int)$conf->entity.' AND u.statut=1 AND u.admin=0 ORDER BY u.lastname,u.firstname,u.login,u.rowid');$html='<option value="">Sélectionner</option>';if($res)while($row=$db->fetch_object($res)){$name=trim(trim($row->firstname).' '.trim($row->lastname));if($name==='')$name=$row->login;$flags=$assignmentFlags[(int)$row->rowid]??array();$attributes=$assignmentFlags?' data-is-current="'.(!empty($flags['current'])?'1':'0').'" data-is-primary="'.(!empty($flags['primary'])?'1':'0').'"':'';$html.='<option value="'.(int)$row->rowid.'"'.$attributes.'>'.dol_escape_htmltag($name).'</option>';}return $html;
}

/** Detail and review use the same scoped snapshot and decision facts. */
function mjl_activity_monitoring_context(array $row)
{
	global $db,$user,$conf;
	require_once __DIR__.'/../class/mjlmonitoring.class.php';
	static $contexts=array();
	$id=(int)$row['rowid'];
	if (isset($contexts[$id])) return $contexts[$id];
	if (mjl_monitoring_readiness()!==1) throw new RuntimeException('READ_FAILED');
	$reader=new MjlMonitoring($db,$user,(int)$conf->entity);
	$budget=$reader->rows('SELECT @@session.max_statement_time AS statement_time')[0];
	try {
		if (!$db->query('SET SESSION max_statement_time=5') || !$db->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ') || !$db->begin('mjl detail monitoring')) throw new RuntimeException('READ_FAILED');
		$activities=$reader->activities(mjl_monitoring_filters(array('activity_id'=>(string)$id)));
		if (count($activities)!==1) throw new RuntimeException('FORBIDDEN');
		$activities=$reader->reviewFacts($activities);
		$context=$activities[0];
		$context['monitoring_actions']=mjl_monitoring_activity_actions($context,$reader->role(),$user->id,$reader->date());
		if (!$db->commit('mjl detail monitoring')) throw new RuntimeException('READ_FAILED');
	} catch (Throwable $exception) { if ($db->transaction_opened>0) $db->rollback(); throw $exception; }
	finally { if (!$db->query('SET SESSION max_statement_time='.(float)$budget['statement_time'])) throw new RuntimeException('READ_FAILED'); }
	$contexts[$id]=$context;
	return $context;
}

function mjl_activity_review_eligibility(array $row, $user)
{
	global $db,$conf;
	require_once __DIR__.'/mjl_monitoring_access.lib.php';
	if (mjl_monitoring_readiness()!==0) {
		try {
			$context=mjl_activity_monitoring_context($row);
			$actions=$context['monitoring_actions'];
			return array('allowed'=>$actions['review'],'return_allowed'=>$actions['return'],'reason'=>$actions['review']?'':'Cette révision n’est pas à votre étape ou votre participation interdit cette décision.');
		} catch (Throwable $exception) { return array('allowed'=>false,'return_allowed'=>false,'reason'=>'Les autorisations de décision sont indisponibles.'); }
	}
	$revision=(int)($row['fk_current_revision']??0);$role=mjl_scope_effective_role_code($user);
	if($revision<=0||!in_array($role,array('AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF'),true))return array('allowed'=>false,'reason'=>'Aucune révision n’est disponible pour votre profil.');
	$expected=$role==='AGENT_VERIFICATEUR'?'SUBMITTED':'PREVALIDATED';
	if(($row['validation_status']??'')!==$expected)return array('allowed'=>false,'reason'=>'Cette révision n’est pas à votre étape de validation.');
	$contributor=(int)mjl_rst005_scalar($db,'SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_revision_contributor WHERE entity='.(int)$conf->entity.' AND fk_revision='.$revision.' AND fk_user='.(int)$user->id);
	if($contributor!==0)return array('allowed'=>false,'reason'=>'Vous figurez parmi les contributeurs de cette révision.');
	if($role==='VALIDATEUR_DEFINITIF'){
		$prevalidator=(int)mjl_rst005_scalar($db,"SELECT COALESCE(MAX(fk_actor),0) FROM ".$db->prefix()."mjlfinancement_review_decision WHERE entity=".(int)$conf->entity." AND fk_revision=$revision AND decision_type='PREVALIDATED'");
		if($prevalidator===(int)$user->id)return array('allowed'=>false,'reason'=>'Le prévalidateur ne peut pas valider définitivement la même révision.');
	}
	return array('allowed'=>true,'reason'=>'');
}

function mjl_activity_render_form(array $row)
{
	$create=!$row;$id=$create?0:(int)$row['rowid'];$recovery=mjl_activity_recovery_consume(isset($_GET['recovery'])&&is_scalar($_GET['recovery'])?(string)$_GET['recovery']:'',$id,$create?'create':'edit');foreach(array('name','description','date_start','date_end','authorized_amount') as$field)if(array_key_exists($field,$recovery))$row[$field==='authorized_amount'?'draft_authorized_amount':$field]=$recovery[$field];$ops=$create?array(array('rowid'=>'','version'=>'','name'=>'','fk_operation_type'=>'','authorized_amount'=>'')):mjl_activity_operations($id);if(!empty($recovery['operations'])){$base=$ops;$ops=array();foreach($recovery['operations'] as$i=>$saved){$current=$base[$i]??array('rowid'=>'','version'=>'','fk_operation_type'=>'');$ops[]=array('rowid'=>$current['rowid'],'version'=>$current['version'],'fk_operation_type'=>$current['fk_operation_type'],'name'=>$saved['name'],'authorized_amount'=>$saved['authorized_amount']);}}
	print mjl_page_header_render($create?'Créer une Activité':'Modifier '.$row['ref'],array('breadcrumb'=>array(array('label'=>'Activités','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),array('label'=>$create?'Créer une Activité':'Modifier '.$row['ref'])),'description'=>'Planifiez l’Activité et répartissez son montant autorisé entre les Opérations.'));
	print '<form class="mjl-activity-form mjl-planning-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'.($id?'?id='.$id:'').'">';
	print mjl_activity_hidden($create?'create_draft':'save_structure',$id,0,$create?0:(int)$row['version']);
	if($recovery)print '<p class="mjl-form-recovery-note" role="status">Une partie de votre saisie a été reprise. Vérifiez le Partenaire, le Projet, les types d’Opération et les lignes avant de renvoyer le formulaire.</p>';
	print '<div class="mjl-activity-form-main">';
	print '<fieldset class="mjl-activity-form-section"><legend>1. Informations générales</legend><div class="mjl-activity-fields"><div class="mjl-form-field"><label for="activity-partner">Partenaire <span aria-hidden="true">*</span></label><select id="activity-partner" data-mjl-select name="partner_id" required>'.mjl_activity_reference_options('societe','nom',$row['fk_partner']??0).'</select></div><div class="mjl-form-field"><label for="activity-project">Projet <span aria-hidden="true">*</span></label><select id="activity-project" data-mjl-select name="project_id" required>'.mjl_activity_reference_options('projet','title',$row['fk_project']??0).'</select><p class="mjl-field-description">Choisissez un Projet du Partenaire sélectionné.</p></div><div class="mjl-form-field mjl-activity-field-wide"><label for="activity-name">Nom de l’Activité <span aria-hidden="true">*</span></label><input id="activity-name" name="name" maxlength="255" required value="'.dol_escape_htmltag($row['name']??'').'"></div><div class="mjl-form-field mjl-activity-field-wide"><label for="activity-description">Description <span aria-hidden="true">*</span></label><textarea id="activity-description" name="description" maxlength="4000" required>'.dol_escape_htmltag($row['description']??'').'</textarea></div></div>'.($create?'<p class="mjl-field-description">L’Agent qui crée l’Activité devient l’Agent principal.</p>':'').'</fieldset>';
	print '<fieldset class="mjl-activity-form-section"><legend>2. Planification</legend><div class="mjl-activity-fields"><div class="mjl-form-field"><label for="activity-start">Date de début <span aria-hidden="true">*</span></label><input id="activity-start" data-mjl-date type="date" name="date_start" required value="'.dol_escape_htmltag($row['date_start']??'').'"></div><div class="mjl-form-field"><label for="activity-end">Date de fin incluse <span aria-hidden="true">*</span></label><input id="activity-end" data-mjl-date type="date" name="date_end" required value="'.dol_escape_htmltag($row['date_end']??'').'"></div><div class="mjl-form-field mjl-activity-field-wide"><label for="activity-amount">Montant autorisé proposé (F CFA) <span aria-hidden="true">*</span></label><input id="activity-amount" inputmode="numeric" pattern="[0-9]+" name="authorized_amount" required value="'.dol_escape_htmltag($row['draft_authorized_amount']??'').'"><p class="mjl-field-description">Saisissez un montant entier, sans séparateur.</p></div></div></fieldset>';
	print '<fieldset class="mjl-activity-form-section"><legend>3. Opérations</legend><p class="mjl-field-description">Répartissez le montant proposé entre les Opérations. Aucun montant dépensé n’est saisi ici.</p><div id="activity-operations" data-operation-list>';foreach($ops as$i=>$op)mjl_activity_render_operation_row($op,$i);print '</div><button class="button button-secondary" type="button" data-add-operation>Ajouter une Opération</button><p class="mjl-field-description">50 Opérations au maximum.</p></fieldset></div>';
	print '<aside class="mjl-activity-budget" aria-labelledby="activity-budget-heading"><h2 id="activity-budget-heading">Vérification budgétaire</h2><dl class="mjl-activity-totals" aria-live="polite"><div><dt>Activité</dt><dd data-activity-total>Non renseigné</dd></div><div><dt>Total des Opérations</dt><dd data-operation-total>Non renseigné</dd></div><div><dt>Écart à répartir</dt><dd data-difference>Non renseigné</dd></div></dl><p data-budget-guidance>Complétez les montants pour vérifier leur équilibre.</p></aside>';
	print '<div class="mjl-activity-form-actions"><button class="button button-secondary" type="submit">'.($create?'Enregistrer le brouillon':'Enregistrer').'</button>';
	if($create)print '<input type="hidden" name="mjl_submission_create_submit" value="'.dol_escape_htmltag(mjl_form_submission_issue(mjl_activity_context('create_submit',0,0,0))).'"><button class="button" type="submit" name="action" value="create_submit" data-submit-activity>Soumettre pour prévalidation</button>';
	print '<a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'.($id?'?id='.$id:'').'">Annuler</a></div></form>';
}

function mjl_activity_render_operation_row($op,$index)
{
	print '<div class="mjl-operation-row" data-operation-row><h3 data-operation-number>Opération '.((int)$index+1).'</h3><input type="hidden" name="operation_key[]" value="op-'.$index.'"><input type="hidden" name="operation_id[]" value="'.dol_escape_htmltag($op['rowid']).'"><input type="hidden" name="operation_version[]" value="'.dol_escape_htmltag($op['version']).'"><label>Nom de l’Opération <input name="operation_name[]" maxlength="255" required value="'.dol_escape_htmltag($op['name']).'"></label><label>Type <select data-mjl-select name="operation_type_id[]" required>'.mjl_activity_type_options($op['fk_operation_type']).'</select></label><label>Montant autorisé (F CFA) <input name="operation_amount[]" inputmode="numeric" pattern="[0-9]+" required value="'.dol_escape_htmltag($op['authorized_amount']).'"></label><button type="button" class="button button-secondary" data-remove-operation>Retirer</button></div>';
}

function mjl_activity_render_detail(array $row)
{
	global $user;
	require_once __DIR__.'/mjl_monitoring_access.lib.php';
	$monitoring=mjl_monitoring_readiness()!==0;
	if ($monitoring) {
		try {
			$row=array_merge($row,mjl_activity_monitoring_context($row));
			$operations=$row['operations'];
			$summary=$row;
			$assignments=$row['assignments'];
		} catch (Throwable $exception) {
			print mjl_page_header_render($row['ref']).mjl_ui_system_state('unavailable','Activité indisponible','Les données et autorisations ne peuvent pas être chargées.');
			return;
		}
	} else {
		$operations=mjl_activity_operations($row['rowid']);
		$summary=mjl_execution_summarize($operations);
		$assignments=array();
	}
	$id=(int)$row['rowid'];
	$status=mjl_ui_activity_status($row['validation_status']);
	$executionStatus=$monitoring?$row['execution_status']:mjl_execution_project_status($row,$operations,(new DateTimeImmutable('now',new DateTimeZone('Africa/Porto-Novo')))->format('Y-m-d'));
	$execution=mjl_ui_execution_status($executionStatus);
	$completeness=mjl_ui_completeness_status($summary['completeness']);
	$projectLabel=$row['project_name']??trim(($row['project_ref']??'').' - '.($row['project_title']??''));
	$options=array(
		'breadcrumb'=>array(array('label'=>'Activités','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),array('label'=>$row['ref'])),
		'description'=>$row['partner_name'].' / '.$projectLabel,
	);
	$canEdit=$monitoring?$row['monitoring_actions']['edit']:(mjl_scope_is_input_agent($user)&&in_array($row['validation_status'],array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'),true));
	if($canEdit)$options['primary_action']=array('label'=>'Modifier','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.$id.'&action=edit');
	$reviewEligibility=mjl_activity_review_eligibility($row,$user);
	if($reviewEligibility['allowed'])$options['primary_action']=array('label'=>'Examiner la révision','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.$id.'&action=review');
	if(mjl_rst002b_table_exists($GLOBALS['db'],$GLOBALS['db']->prefix().'mjlfinancement_export_record'))$options['secondary_actions']=array(array('label'=>'Fiche et téléchargements','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report=activity_detail&activity_id='.$id));
	print mjl_page_header_render($row['ref'].' - '.$row['name'],$options);

	$primaryAssignment=null;
	foreach($assignments as$assignment)if(!empty($assignment['is_primary'])){$primaryAssignment=$assignment;break;}
	$assignmentName=function($assignment){$name=trim(($assignment['firstname']??'').' '.($assignment['lastname']??''));return $name!==''?$name:($assignment['login']??'Agent');};
	print '<div class="mjl-activity-statusline">'.mjl_ui_status_badge($status).mjl_ui_status_badge($execution).'<span class="mjl-activity-fact">Révision '.(!empty($row['revision_number'])?(int)$row['revision_number']:'non soumise').'</span><span class="mjl-activity-fact">'.dol_escape_htmltag(mjl_format_date($row['date_start']).' au '.mjl_format_date($row['date_end'])).'</span>';
	if($primaryAssignment)print '<span class="mjl-activity-fact">Agent principal : '.dol_escape_htmltag($assignmentName($primaryAssignment)).'</span>';
	print '</div>';
	$role=mjl_scope_effective_role_code($user);
	if($row['validation_status']==='ABANDONED')print mjl_ui_system_state('warning','Activité abandonnée','La structure et les affectations sont verrouillées. Un Validateur définitif peut restaurer ce brouillon avant sa date de début.');
	elseif($row['validation_status']==='CANCELLED')print mjl_ui_system_state('warning','Activité annulée','La structure et les affectations de cette Activité sont définitivement verrouillées.');
	elseif(!$canEdit){
		if($role==='AGENT_SAISIE')print mjl_ui_system_state('info','Structure verrouillée','Le statut ou la date de cette Activité ne permet plus de modifier sa structure.');
		else print mjl_ui_system_state('info','Modification réservée','Seuls les Agents actuellement affectés peuvent modifier la structure de cette Activité.');
	}

	$hasValidatedAmount=$monitoring&&array_key_exists('validated_amount',$row)&&$row['validated_amount']!==null;
	$authorized=$monitoring?($row['validated_amount']??$row['pending_amount']??$row['draft_authorized_amount']):$row['draft_authorized_amount'];
	$authorizedLabel=$hasValidatedAmount?'Montant autorisé validé':'Montant autorisé proposé';
	$activeAuthorized=$summary['active_authorized_amount']??null;
	$spent=$summary['active_spent_amount']??null;
	$variance=mjl_monitoring_variance($spent,$activeAuthorized);
	print '<dl class="mjl-activity-financial-strip" data-activity-financial-strip>';
	foreach(array(
		array($authorizedLabel,mjl_format_money($authorized),$hasValidatedAmount?'Annulations incluses':'Budget de référence courant'),
		array('Autorisations actives',mjl_format_money($activeAuthorized),'Annulées : '.mjl_format_money($summary['cancelled_authorized_amount']??null)),
		array('Dépenses actives',mjl_format_money($spent),'Annulées : '.mjl_format_money($summary['cancelled_spent_amount']??null).' · '.$summary['missing_spent_count'].' manquante(s)'),
		array('Écart actif',mjl_format_money($variance['difference']),$spent===null?'Dépenses incomplètes':'Dépensé actif − autorisé actif'),
		array('Variance active',$variance['display'],$spent===null?'Dépenses incomplètes':'Écart actif / autorisé actif'),
		array('Complétude financière',$completeness['label'],count($operations).' Opération(s)'),
	)as$fact)print '<div><dt>'.dol_escape_htmltag($fact[0]).'</dt><dd>'.dol_escape_htmltag($fact[1]).'</dd><small>'.dol_escape_htmltag($fact[2]).'</small></div>';
	print '</dl>';

	print '<nav class="mjl-tabs mjl-activity-tabs" aria-label="Sections de l’Activité" data-mjl-tabs>';
	foreach(array(
		'mjl-activity-overview'=>array('Vue d’ensemble',true),
		'mjl-activity-operations'=>array('Opérations ('.count($operations).')',false),
		'mjl-activity-decisions'=>array('Validation et demandes',false),
		'mjl-activity-history'=>array('Historique',false),
	)as$target=>$tab)print '<a id="'.$target.'-tab" href="#'.$target.'" data-mjl-tab data-mjl-selected="'.($tab[1]?'true':'false').'">'.dol_escape_htmltag($tab[0]).'</a>';
	print '</nav>';

	print '<section class="mjl-activity-tab-panel" id="mjl-activity-overview" data-mjl-tab-panel><div class="mjl-activity-detail-grid">';
	print '<article class="mjl-activity-panel"><h2>Informations de l’Activité</h2><p class="mjl-activity-description">'.($row['description']!==''?nl2br(htmlspecialchars($row['description'],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'),false):'Description non renseignée.').'</p><dl class="mjl-activity-meta"><div><dt>Partenaire</dt><dd>'.dol_escape_htmltag($row['partner_name']).'</dd></div><div><dt>Projet</dt><dd>'.dol_escape_htmltag($projectLabel).'</dd></div><div><dt>Date de début</dt><dd>'.dol_escape_htmltag(mjl_format_date($row['date_start'])).'</dd></div><div><dt>Date de fin incluse</dt><dd>'.dol_escape_htmltag(mjl_format_date($row['date_end'])).'</dd></div><div><dt>Version technique</dt><dd>'.(int)$row['version'].'</dd></div><div><dt>Exécution</dt><dd>'.dol_escape_htmltag($execution['label']).'</dd></div></dl></article>';
	print '<article class="mjl-activity-panel"><div class="mjl-section-heading"><h2>Affectations</h2>';
	$canAssign=mjl_scope_is_final_validator($user)&&!in_array($row['validation_status'],array('ABANDONED','CANCELLED'),true);
	if($canAssign)print '<a class="mjl-action mjl-action-secondary" href="#mjl-assignment-dialog" data-mjl-dialog-open="mjl-assignment-dialog">Gérer les affectations</a>';
	print '</div>';
	if(!$assignments)print '<p>Aucune affectation courante.</p>';else{print '<ul class="mjl-assignment-list">';foreach($assignments as$assignment)print '<li><span class="mjl-assignment-avatar" aria-hidden="true">'.dol_escape_htmltag(mb_strtoupper(mb_substr($assignmentName($assignment),0,1))).'</span><span><strong>'.dol_escape_htmltag($assignmentName($assignment)).'</strong><small>'.(!empty($assignment['is_primary'])?'Coordination principale':'Agent additionnel').'</small></span></li>';print '</ul>';}
	print '</article></div></section>';

	$executionAction=$monitoring&&!empty($row['monitoring_actions']['execution'])?'Saisir l’exécution':'Consulter les Opérations';
	print '<section class="mjl-activity-tab-panel" id="mjl-activity-operations" data-mjl-tab-panel><article class="mjl-activity-panel"><div class="mjl-section-heading"><div><h2>Opérations</h2><p>'.count($operations).' Opération(s) · '.dol_escape_htmltag(mjl_format_money($authorized)).'</p></div><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/operations.php'.($monitoring?'?activity_id='.$id:'').'">'.$executionAction.'</a></div><div class="mjl-activity-operations-scroll"><table class="mjl-activity-operations-table"><thead><tr><th>Opération</th><th>Type</th><th>Autorisé</th><th>Dépensé</th><th>Écart</th><th>Statut</th></tr></thead><tbody>';
	foreach($operations as$operation){$operationVariance=mjl_monitoring_variance($operation['spent_amount']??null,$operation['authorized_amount']);print '<tr><td data-label="Opération"><strong>'.dol_escape_htmltag($operation['name']).'</strong></td><td data-label="Type">'.dol_escape_htmltag($operation['type_label']).'</td><td data-label="Autorisé">'.dol_escape_htmltag(mjl_format_money($operation['authorized_amount'])).'</td><td data-label="Dépensé">'.dol_escape_htmltag(mjl_format_money($operation['spent_amount']??null)).'</td><td data-label="Écart">'.dol_escape_htmltag(mjl_format_money($operationVariance['difference'])).'</td><td data-label="Statut">'.mjl_ui_status_badge(mjl_ui_operation_status($operation['status']??'TODO')).'</td></tr>';}
	print '</tbody></table></div></article></section>';

	print '<section class="mjl-activity-tab-panel" id="mjl-activity-decisions" data-mjl-tab-panel><article class="mjl-activity-panel"><h2>Validation et demandes</h2>';
	if(!$reviewEligibility['allowed']&&!empty($row['fk_current_revision'])&&in_array(mjl_scope_effective_role_code($user),array('AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF'),true))print mjl_ui_system_state('permission','Révision verrouillée',$reviewEligibility['reason']);
	print '<p><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/operationrequests.php">Voir les demandes d’exception</a></p>';
	if($canEdit)print '<form class="mjl-activity-action-form" method="POST" action="?id='.$id.'">'.mjl_activity_hidden('submit_revision',$id,0,(int)$row['version']).'<button class="button" type="submit">Soumettre la révision</button></form>';
	if($monitoring?$row['monitoring_actions']['abandon']:(mjl_scope_is_input_agent($user)&&$row['validation_status']==='DRAFT'))print '<form class="mjl-activity-action-form" method="POST" action="?id='.$id.'">'.mjl_activity_hidden('abandon',$id,0,(int)$row['version']).'<label>Motif d’abandon <textarea name="reason" maxlength="2000" required></textarea></label><button class="button button-secondary" type="submit">Abandonner le brouillon</button></form>';
	if($monitoring?$row['monitoring_actions']['restore']:(mjl_scope_is_final_validator($user)&&$row['validation_status']==='ABANDONED'))print '<form class="mjl-activity-action-form" method="POST" action="?id='.$id.'">'.mjl_activity_hidden('restore',$id,0,(int)$row['version']).'<label>Agent principal <select name="primary_agent_id" required>'.mjl_activity_agent_options().'</select></label><label>Motif de restauration <textarea name="reason" maxlength="2000" required></textarea></label><button class="button" type="submit">Restaurer le brouillon</button></form>';
	if(mjl_scope_is_input_agent($user)&&!empty($row['fk_current_revision'])&&empty($row['is_cancelled'])&&$row['validation_status']!=='ABANDONED')print '<form class="mjl-activity-action-form" method="POST" action="?id='.$id.'">'.mjl_activity_hidden('request_cancellation',$id,0,(int)$row['version']).'<label>Motif de la demande d’annulation <textarea name="reason" maxlength="2000" required></textarea></label><button class="button button-secondary" type="submit">Demander l’annulation</button></form>';
	print '</article></section>';

	ob_start();
	mjl_activity_render_timeline($id);
	$timeline=ob_get_clean();
	print '<div class="mjl-activity-tab-panel" id="mjl-activity-history" data-mjl-tab-panel>'.$timeline.'</div>';

	if($canAssign){
		$assignmentFlags=array();foreach($assignments as$assignment)$assignmentFlags[(int)$assignment['fk_user']]=array('current'=>true,'primary'=>!empty($assignment['is_primary']));
		print '<dialog class="mjl-modal-dialog mjl-assignment-dialog" id="mjl-assignment-dialog" open aria-labelledby="mjl-assignment-dialog-title" data-mjl-dialog><div class="mjl-dialog-panel"><div class="mjl-section-heading"><div><h2 id="mjl-assignment-dialog-title">Gérer les affectations</h2><p>'.dol_escape_htmltag($row['name']).'</p></div><button class="mjl-action mjl-action-secondary" type="button" data-mjl-dialog-close>Fermer</button></div><p>Chaque enregistrement applique une seule action. Un Agent retiré perd immédiatement l’accès à cette Activité.</p><form class="mjl-activity-action-form" method="POST" action="?id='.$id.'">'.mjl_activity_hidden('assignment_change',$id,0,(int)$row['version']).'<label>Opération d’affectation <select name="assignment_operation" data-mjl-assignment-operation><option value="ADD_ADDITIONAL">Ajouter un Agent</option><option value="REMOVE_ADDITIONAL">Retirer un Agent additionnel</option><option value="TRANSFER_PRIMARY">Transférer le rôle principal</option></select></label><label>Agent concerné <select name="target_agent_id" required data-mjl-assignment-target>'.mjl_activity_agent_options($assignmentFlags).'</select></label><label>Motif <textarea name="reason" maxlength="2000" required></textarea></label><div class="mjl-dialog-actions"><button class="button" type="submit">Modifier l’affectation</button></div></form></div></dialog>';
	}
}

function mjl_activity_render_review(array $row)
{
	global $db,$conf,$user;
	$revision=mjl_activity_revision($row['rowid'],$row['fk_current_revision']);
	if(!$revision)mjl_activity_forbidden();
	$snapshot=json_decode($revision['snapshot_json'],true);
	if(!is_array($snapshot))$snapshot=array();
	$activity=$snapshot['activity']??array();
	$operations=$snapshot['operations']??array();
	$revisionNumber=(int)$revision['revision_number'];
	$role=mjl_scope_effective_role_code($user);
	$eligibility=mjl_activity_review_eligibility($row,$user);
	$options=array(
		'breadcrumb'=>array(
			array('label'=>'Activités','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),
			array('label'=>$row['ref'],'href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row['rowid']),
			array('label'=>'Révision '.$revisionNumber),
		),
		'description'=>$row['ref'].' - '.$row['name'],
	);
	print mjl_page_header_render('Révision '.$revisionNumber.' à examiner',$options);

	$stages=array(
		array('status'=>'SUBMITTED','label'=>'Soumise','description'=>'Révision transmise'),
		array('status'=>'PREVALIDATED','label'=>'Prévalidée','description'=>'Contrôle structurel terminé'),
		array('status'=>'FINAL_VALIDATED','label'=>'Validée définitivement','description'=>'Décision finale enregistrée'),
	);
	$stageIndex=array('SUBMITTED'=>0,'PREVALIDATED'=>1,'FINAL_VALIDATED'=>2);
	$currentIndex=$stageIndex[$row['validation_status']]??null;
	$returned=in_array($row['validation_status'],array('RETURNED_SUPERVISOR','RETURNED_VALIDATOR'),true);
	$returnedCompleteIndex=$row['validation_status']==='RETURNED_VALIDATOR'?1:0;
	print '<ol class="mjl-review-progress" data-review-progress aria-label="Progression de la validation">';
	foreach($stages as$index=>$stage){$state=$returned?($index<=$returnedCompleteIndex?'complete':'pending'):($currentIndex===null?'pending':($index<$currentIndex?'complete':($index===$currentIndex?'current':'pending')));print '<li class="mjl-review-stage mjl-review-stage-'.$state.'"'.($state==='current'?' aria-current="step"':'').'><span aria-hidden="true">'.($index+1).'</span><div><strong>'.dol_escape_htmltag($stage['label']).'</strong><small>'.dol_escape_htmltag($stage['description']).'</small></div></li>';}
	print '</ol>';

	if($returned){$returnedStatus=mjl_ui_activity_status($row['validation_status']);print mjl_ui_system_state('warning',$returnedStatus['label'],'Cette révision reste consultable en lecture seule. Une nouvelle soumission démarrera un nouveau cycle de revue.');}
	if($revisionNumber>1)print mjl_ui_system_state('info','Nouveau cycle de revue','Cette révision remplace la structure précédemment examinée. Toute prévalidation antérieure doit être recommencée.');
	if($eligibility['allowed']&&isset($eligibility['return_allowed'])&&!$eligibility['return_allowed'])print mjl_ui_system_state('warning','Validation tardive','La révision inchangée peut encore être acceptée. Un retour structurel n’est plus possible après la date de début ; l’Activité doit alors être annulée et recréée.');

	print '<div class="mjl-review-layout"><div class="mjl-review-main">';
	print '<section class="mjl-activity-panel" aria-labelledby="mjl-review-snapshot-title"><div class="mjl-section-heading"><div><h2 id="mjl-review-snapshot-title">Structure soumise</h2><p>Révision '.$revisionNumber.' soumise le '.dol_escape_htmltag(mjl_format_date($revision['date_submitted'],'datetime')).'</p></div>'.mjl_ui_status_badge(mjl_ui_activity_status($row['validation_status'])).'</div>';
	print mjl_ui_system_state('info','Révision immuable','La décision porte exclusivement sur cette version. Les données affichées ne sont pas modifiables par le reviewer.');
	print '<dl class="mjl-activity-meta"><div><dt>Activité</dt><dd>'.dol_escape_htmltag($activity['name']??'').'</dd></div><div><dt>Partenaire</dt><dd>'.dol_escape_htmltag($activity['partner_label']??'').'</dd></div><div><dt>Projet</dt><dd>'.dol_escape_htmltag(trim(($activity['project_reference']??'').' - '.($activity['project_label']??''))).'</dd></div><div><dt>Période</dt><dd>'.dol_escape_htmltag(mjl_format_date($activity['date_start']??null).' au '.mjl_format_date($activity['date_end']??null)).'</dd></div><div><dt>Montant proposé</dt><dd>'.dol_escape_htmltag(mjl_format_money($activity['authorized_amount']??null)).'</dd></div><div><dt>Opérations</dt><dd>'.count($operations).'</dd></div></dl>';
	if(!empty($activity['description']))print '<div class="mjl-review-description"><h3>Description</h3><p>'.nl2br(htmlspecialchars($activity['description'],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'),false).'</p></div>';
	print '</section>';

	print '<section class="mjl-activity-panel" aria-labelledby="mjl-review-operations-title"><div class="mjl-section-heading"><div><h2 id="mjl-review-operations-title">Opérations soumises</h2><p>'.count($operations).' Opération(s) dans la révision '.$revisionNumber.'</p></div></div><div class="mjl-activity-operations-scroll"><table class="mjl-activity-operations-table"><thead><tr><th>Opération</th><th>Type</th><th>Montant proposé</th></tr></thead><tbody>';
	foreach($operations as$operation)print '<tr><td data-label="Opération"><strong>'.dol_escape_htmltag($operation['name']??'').'</strong></td><td data-label="Type">'.dol_escape_htmltag($operation['type_label']??'').'</td><td data-label="Montant proposé">'.dol_escape_htmltag(mjl_format_money($operation['authorized_amount']??null)).'</td></tr>';
	print '</tbody></table></div></section>';

	$res=$db->query('SELECT stage,decision_type,actor_name_snapshot,reason,requested_amount,date_decision FROM '.$db->prefix().'mjlfinancement_review_decision WHERE entity='.(int)$conf->entity.' AND fk_revision='.(int)$revision['rowid'].' ORDER BY date_decision,rowid');
	$history=array();if($res)while($decision=$db->fetch_object($res))$history[]=$decision;
	print '<section class="mjl-activity-panel" aria-labelledby="mjl-review-history-title"><h2 id="mjl-review-history-title">Historique de la révision '.$revisionNumber.'</h2>';
	if(!$history)print '<p>Aucune décision enregistrée pour cette révision.</p>';else{print '<ol class="mjl-review-timeline">';foreach($history as$decision)print '<li><strong>'.dol_escape_htmltag(mjl_ui_activity_status($decision->decision_type)['label']).'</strong><br><span>'.dol_escape_htmltag($decision->actor_name_snapshot.' · '.mjl_format_date($decision->date_decision,'datetime')).'</span>'.($decision->reason?'<br>'.nl2br(htmlspecialchars($decision->reason,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'),false):'').'</li>';print '</ol>';}
	print '</section></div>';

	print '<aside class="mjl-review-decision" aria-labelledby="mjl-review-decision-title"><section class="mjl-activity-panel"><h2 id="mjl-review-decision-title">Décision</h2>';
	if(!$eligibility['allowed']){
		print mjl_ui_system_state('permission','Décision indisponible',$eligibility['reason']);
	}else{
		$approvalDecision=$role==='AGENT_VERIFICATEUR'?'PREVALIDATED':'FINAL_VALIDATED';
		$approvalLabel=$role==='AGENT_VERIFICATEUR'?'Prévalider':'Valider définitivement';
		print '<p class="mjl-review-guidance">'.($role==='AGENT_VERIFICATEUR'?'Confirmez que la structure et le budget soumis peuvent passer à la validation définitive.':'Confirmez la même révision prévalidée pour terminer le cycle de validation.').'</p>';
		print '<form class="mjl-review-form" method="POST" action="?id='.(int)$row['rowid'].'">'.mjl_activity_hidden('review_revision',(int)$row['rowid'],(int)$revision['rowid'],(int)$row['version']).'<input type="hidden" name="decision" value="'.$approvalDecision.'"><button class="button" type="submit">'.$approvalLabel.'</button></form>';
		if(!isset($eligibility['return_allowed'])||$eligibility['return_allowed']){
			$returnDecision=$role==='AGENT_VERIFICATEUR'?'RETURNED_SUPERVISOR':'RETURNED_VALIDATOR';
			print '<a class="mjl-action mjl-action-secondary" href="#mjl-correction-dialog" data-mjl-dialog-open="mjl-correction-dialog">Retourner en correction</a>';
			print '<dialog class="mjl-modal-dialog mjl-review-dialog" id="mjl-correction-dialog" open aria-labelledby="mjl-correction-dialog-title" data-mjl-dialog><div class="mjl-dialog-panel"><div class="mjl-section-heading"><div><h2 id="mjl-correction-dialog-title">Retourner en correction</h2><p>Révision '.$revisionNumber.' - '.dol_escape_htmltag($row['name']).'</p></div><button class="mjl-action mjl-action-secondary" type="button" data-mjl-dialog-close>Fermer</button></div><p>Le retour crée une étape de correction pour les Agents affectés. Une nouvelle soumission produira une nouvelle révision et un nouveau cycle de revue.</p><form class="mjl-review-form" method="POST" action="?id='.(int)$row['rowid'].'">'.mjl_activity_hidden('review_revision',(int)$row['rowid'],(int)$revision['rowid'],(int)$row['version']).'<input type="hidden" name="decision" value="'.$returnDecision.'"><label>Motif de correction <textarea name="reason" maxlength="2000" required></textarea></label>'.($returnDecision==='RETURNED_VALIDATOR'?'<label>Montant demandé (facultatif) <input name="requested_amount" inputmode="numeric" pattern="[0-9]+"></label>':'').'<div class="mjl-dialog-actions"><button class="button button-secondary" type="submit">Confirmer le retour</button></div></form></div></dialog>';
		}
	}
	print '</section></aside></div>';
	mjl_activity_render_timeline((int)$row['rowid']);
}
