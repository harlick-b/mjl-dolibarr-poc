<?php

require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form_submission.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_scope.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
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
			$allowed = array('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED');
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
	global $db,$user;
	if (empty($user->id) || !mjl_activity_access_can_enter_list($user)) mjl_activity_forbidden();
	try { mjl_rst006a_require_target($db); } catch (Throwable $e) {
		http_response_code(503); llxHeader('', 'Activités'); mjl_navigation_shell_start($user); print '<main class="mjl-workspace">'.mjl_ui_system_state('unavailable','Migration requise','La planification des Activités sera disponible après la migration RST-006A.').'</main>'; mjl_navigation_shell_end(); llxFooter(); return;
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
	$postAllowed=array('create_draft','create_submit','save_structure','submit_revision','abandon','restore','review_revision','assignment_change');
	if (($method==='GET'&&!in_array($action,$getAllowed,true))||($method==='POST'&&!in_array($action,$postAllowed,true))||!in_array($method,array('GET','POST'),true))mjl_activity_forbidden();
	$id=mjl_activity_decimal('id',$method==='POST'?$_POST:$_GET);
	if(isset($requestSource['id'])&&$id==='')mjl_activity_bad_request();
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
	llxHeader('', 'Activités');
	mjl_navigation_shell_start($user);
	print '<main class="mjl-workspace">';
	print mjl_activity_result_feedback();
	if($action==='create'||$action==='edit')mjl_activity_render_form($row);
	elseif($action==='review')mjl_activity_render_review($row);
	elseif($row)mjl_activity_render_detail($row);
	else mjl_activity_render_list();
	print '</main><script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/activities.js?v=006a"></script>';
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
		'MIGRATION_REQUIRED' => array('unavailable', 'Migration requise', 'La planification est indisponible jusqu’à la migration RST-006A.'),
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
	$extras=array('create_draft'=>array('mjl_submission_create_submit'),'create_submit'=>array('mjl_submission_create_submit'),'abandon'=>array('reason'),'restore'=>array('primary_agent_id','reason'),'review_revision'=>array('decision','reason','requested_amount'),'assignment_change'=>array('assignment_operation','target_agent_id','reason'));
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
	foreach(array('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED') as$status){$label=mjl_ui_activity_status($status);print '<option value="'.$status.'"'.($filters['status']===$status?' selected':'').'>'.dol_escape_htmltag($label['label']).'</option>';}
	print '</select><label for="activity-project">Projet</label><input id="activity-project" name="project_id" inputmode="numeric" pattern="[1-9][0-9]*" value="'.dol_escape_htmltag($filters['project_id']).'"><button class="button" type="submit">Filtrer</button></form>';
	if(!$rows)print mjl_ui_system_state('initial-empty','Aucune Activité','Aucune Activité n’est enregistrée dans l’entité active.');
	else{print '<div class="div-table-responsive-no-min"><table class="noborder centpercent mjl-responsive-table"><thead><tr class="liste_titre"><th>Référence</th><th>Activité</th><th>Projet</th><th>Statut</th></tr></thead><tbody>';foreach($rows as$row){$url=DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row->rowid;$status=mjl_ui_activity_status($row->validation_status);print '<tr class="oddeven"><td data-label="Référence"><a href="'.$url.'">'.dol_escape_htmltag($row->ref).'</a></td><td data-label="Activité">'.dol_escape_htmltag($row->name).'</td><td data-label="Projet">'.dol_escape_htmltag(trim($row->project_ref.' - '.$row->project_title)).'</td><td data-label="Statut">'.mjl_ui_status_badge($status).'</td></tr>';}print '</tbody></table></div>';}
	if($filters['page']>1||$hasNext){print '<nav class="mjl-pagination" aria-label="Pagination des Activités">';if($filters['page']>1)print '<a class="mjl-action mjl-action-secondary" rel="prev" href="'.dol_escape_htmltag(mjl_activity_list_url($filters,$filters['page']-1)).'">Précédent</a>';if($hasNext)print '<a class="mjl-action mjl-action-secondary" rel="next" href="'.dol_escape_htmltag(mjl_activity_list_url($filters,$filters['page']+1)).'">Suivant</a>';print '</nav>';}
	print '</section>';
}

function mjl_activity_reference_options($table,$label,$selected)
{
	global $db,$conf;$active=$table==='societe'?'status=1':'fk_statut=1';$res=$db->query('SELECT rowid,'.$label.' AS label FROM '.$db->prefix().$table.' WHERE entity='.(int)$conf->entity.' AND ('.$active.((int)$selected>0?' OR rowid='.(int)$selected:'').') ORDER BY '.$label.',rowid');$html='<option value="">Sélectionner</option>';if($res)while($row=$db->fetch_object($res))$html.='<option value="'.(int)$row->rowid.'"'.((int)$selected===(int)$row->rowid?' selected':'').'>'.dol_escape_htmltag($row->label).'</option>';return $html;
}
function mjl_activity_type_options($selected)
{
	global $db,$conf;$res=$db->query('SELECT rowid,label FROM '.$db->prefix().'mjlfinancement_operation_type WHERE entity='.(int)$conf->entity.' AND (is_active=1'.((int)$selected>0?' OR rowid='.(int)$selected:'').') ORDER BY label,rowid');$html='<option value="">Sélectionner</option>';if($res)while($row=$db->fetch_object($res))$html.='<option value="'.(int)$row->rowid.'"'.((int)$selected===(int)$row->rowid?' selected':'').'>'.dol_escape_htmltag($row->label).'</option>';return $html;
}

function mjl_activity_agent_options()
{
	global $db,$conf;$res=$db->query('SELECT u.rowid,u.login,u.firstname,u.lastname FROM '.$db->prefix()."user u INNER JOIN ".$db->prefix()."mjlfinancement_user_role r ON r.entity=u.entity AND r.fk_user=u.rowid AND r.is_active=1 AND r.role_code='AGENT_SAISIE' WHERE u.entity=".(int)$conf->entity.' AND u.statut=1 AND u.admin=0 ORDER BY u.lastname,u.firstname,u.login,u.rowid');$html='<option value="">Sélectionner</option>';if($res)while($row=$db->fetch_object($res)){$name=trim(trim($row->firstname).' '.trim($row->lastname));if($name==='')$name=$row->login;$html.='<option value="'.(int)$row->rowid.'">'.dol_escape_htmltag($name).'</option>';}return $html;
}

function mjl_activity_review_eligibility(array $row, $user)
{
	global $db,$conf;
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
	print mjl_page_header_render($create?'Créer une Activité':'Modifier '.$row['ref'],array('description'=>'Les montants sont saisis en F CFA, sans séparateur.'));
	print '<section class="mjl-workspace-section mjl-activity-panel"><form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'.($id?'?id='.$id:'').'">';
	print mjl_activity_hidden($create?'create_draft':'save_structure',$id,0,$create?0:(int)$row['version']);
	print '<fieldset><legend>1. Informations générales</legend><div class="mjl-form-grid"><label for="activity-partner">Partenaire (obligatoire)</label><select id="activity-partner" name="partner_id" required>'.mjl_activity_reference_options('societe','nom',$row['fk_partner']??0).'</select><label for="activity-project">Projet (obligatoire)</label><select id="activity-project" name="project_id" required>'.mjl_activity_reference_options('projet','title',$row['fk_project']??0).'</select><label for="activity-name">Nom (obligatoire)</label><input id="activity-name" name="name" maxlength="255" required value="'.dol_escape_htmltag($row['name']??'').'"><label for="activity-description">Description (obligatoire)</label><textarea id="activity-description" name="description" maxlength="4000" required>'.dol_escape_htmltag($row['description']??'').'</textarea></div></fieldset>';
	print '<fieldset><legend>2. Planification</legend><div class="mjl-form-grid"><label for="activity-start">Date de début (obligatoire)</label><input id="activity-start" type="date" name="date_start" required value="'.dol_escape_htmltag($row['date_start']??'').'"><label for="activity-end">Date de fin (obligatoire)</label><input id="activity-end" type="date" name="date_end" required value="'.dol_escape_htmltag($row['date_end']??'').'"><label for="activity-amount">Montant autorisé (obligatoire)</label><input id="activity-amount" inputmode="numeric" pattern="[0-9]+" name="authorized_amount" required value="'.dol_escape_htmltag($row['draft_authorized_amount']??'').'"></div></fieldset>';
	print '<fieldset><legend>3. Opérations</legend><div id="activity-operations" data-operation-list>';foreach($ops as$i=>$op)mjl_activity_render_operation_row($op,$i);print '</div><button class="button button-secondary" type="button" data-add-operation>Ajouter une Opération</button></fieldset>';
	print '<fieldset><legend>4. Vérification</legend><dl class="mjl-activity-totals" aria-live="polite"><div><dt>Montant de l’Activité</dt><dd data-activity-total>0 F CFA</dd></div><div><dt>Total des Opérations</dt><dd data-operation-total>0 F CFA</dd></div><div><dt>Différence à affecter</dt><dd data-difference>0 F CFA</dd></div></dl></fieldset>';
	print '<div class="mjl-activity-form-actions"><button class="button" type="submit">'.($create?'Enregistrer le brouillon':'Enregistrer').'</button>';
	if($create)print '<input type="hidden" name="mjl_submission_create_submit" value="'.dol_escape_htmltag(mjl_form_submission_issue(mjl_activity_context('create_submit',0,0,0))).'"><button class="button button-secondary" type="submit" name="action" value="create_submit">Enregistrer et soumettre</button>';
	print '<a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'.($id?'?id='.$id:'').'">Annuler</a></div></form></section>';
}

function mjl_activity_render_operation_row($op,$index)
{
	print '<div class="mjl-operation-row" data-operation-row><input type="hidden" name="operation_key[]" value="op-'.$index.'"><input type="hidden" name="operation_id[]" value="'.dol_escape_htmltag($op['rowid']).'"><input type="hidden" name="operation_version[]" value="'.dol_escape_htmltag($op['version']).'"><label>Nom de l’Opération <input name="operation_name[]" maxlength="255" required value="'.dol_escape_htmltag($op['name']).'"></label><label>Type <select name="operation_type_id[]" required>'.mjl_activity_type_options($op['fk_operation_type']).'</select></label><label>Montant autorisé <input name="operation_amount[]" inputmode="numeric" pattern="[0-9]+" required value="'.dol_escape_htmltag($op['authorized_amount']).'"></label><button type="button" class="button button-secondary" data-remove-operation>Retirer</button></div>';
}

function mjl_activity_render_detail(array $row)
{
	global $user;$id=(int)$row['rowid'];$status=mjl_ui_activity_status($row['validation_status']);$options=array('breadcrumb'=>array(array('label'=>'Activités','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),array('label'=>$row['ref'])),'description'=>$row['project_ref'].' - '.$row['project_title']);
	if(mjl_scope_is_input_agent($user)&&in_array($row['validation_status'],array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'),true))$options['primary_action']=array('label'=>'Modifier','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.$id.'&action=edit');
	$reviewEligibility=mjl_activity_review_eligibility($row,$user);if($reviewEligibility['allowed'])$options['primary_action']=array('label'=>'Examiner la révision','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.$id.'&action=review');
	print mjl_page_header_render($row['ref'].' - '.$row['name'],$options).'<section class="mjl-workspace-section"><p>'.mjl_ui_status_badge($status).'</p>';
	if(!$reviewEligibility['allowed']&&!empty($row['fk_current_revision'])&&in_array(mjl_scope_effective_role_code($user),array('AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF'),true))print mjl_ui_system_state('permission','Révision verrouillée',$reviewEligibility['reason']);
	print '<dl class="mjl-activity-meta"><div><dt>Partenaire</dt><dd>'.dol_escape_htmltag($row['partner_name']).'</dd></div><div><dt>Période</dt><dd>'.dol_escape_htmltag($row['date_start'].' - '.$row['date_end']).'</dd></div><div><dt>Montant autorisé</dt><dd>'.dol_escape_htmltag($row['draft_authorized_amount']).' F CFA</dd></div><div><dt>Version</dt><dd>'.(int)$row['version'].'</dd></div></dl><h2>Opérations planifiées</h2><ul>';foreach(mjl_activity_operations($id) as$op)print '<li>'.dol_escape_htmltag($op['name'].' - '.$op['type_label'].' - '.$op['authorized_amount'].' F CFA').'</li>';print '</ul>';
	if(mjl_scope_is_input_agent($user)&&in_array($row['validation_status'],array('DRAFT','RETURNED_SUPERVISOR','RETURNED_VALIDATOR'),true)){print '<form method="POST" action="?id='.$id.'">'.mjl_activity_hidden('submit_revision',$id,0,(int)$row['version']).'<button class="button" type="submit">Soumettre la révision</button></form>';if($row['validation_status']==='DRAFT')print '<form method="POST" action="?id='.$id.'">'.mjl_activity_hidden('abandon',$id,0,(int)$row['version']).'<label>Motif d’abandon <textarea name="reason" maxlength="2000" required></textarea></label><button class="button button-secondary" type="submit">Abandonner le brouillon</button></form>';}
	if(mjl_scope_is_final_validator($user)&&$row['validation_status']==='ABANDONED'){print '<form method="POST" action="?id='.$id.'">'.mjl_activity_hidden('restore',$id,0,(int)$row['version']).'<label>Agent principal <select name="primary_agent_id" required>'.mjl_activity_agent_options().'</select></label><label>Motif de restauration <textarea name="reason" maxlength="2000" required></textarea></label><button class="button" type="submit">Restaurer le brouillon</button></form>';}
	if(mjl_scope_is_final_validator($user)&&$row['validation_status']!=='ABANDONED'){print '<h2>Affectations</h2><form method="POST" action="?id='.$id.'">'.mjl_activity_hidden('assignment_change',$id,0,(int)$row['version']).'<label>Opération <select name="assignment_operation"><option value="ADD_ADDITIONAL">Ajouter un Agent</option><option value="REMOVE_ADDITIONAL">Retirer un Agent additionnel</option><option value="TRANSFER_PRIMARY">Transférer le rôle principal</option></select></label><label>Agent <select name="target_agent_id" required>'.mjl_activity_agent_options().'</select></label><label>Motif <textarea name="reason" maxlength="2000" required></textarea></label><button class="button" type="submit">Modifier l’affectation</button></form>';}
	print '</section>';
}

function mjl_activity_render_review(array $row)
{
	global $db,$conf,$user;$revision=mjl_activity_revision($row['rowid'],$row['fk_current_revision']);if(!$revision)mjl_activity_forbidden();$snapshot=json_decode($revision['snapshot_json'],true);if(!is_array($snapshot))$snapshot=array();$activity=$snapshot['activity']??array();$operations=$snapshot['operations']??array();
	print mjl_page_header_render('Examiner '.$row['ref'].' - révision '.(int)$revision['revision_number'],array('description'=>'Données immuables soumises le '.dol_escape_htmltag($revision['date_submitted']).'.')).'<section class="mjl-workspace-section"><p>'.mjl_ui_status_badge(mjl_ui_activity_status($row['validation_status'])).'</p><h2>Structure soumise</h2><dl class="mjl-activity-meta"><div><dt>Activité</dt><dd>'.dol_escape_htmltag($activity['name']??'').'</dd></div><div><dt>Partenaire</dt><dd>'.dol_escape_htmltag($activity['partner_label']??'').'</dd></div><div><dt>Projet</dt><dd>'.dol_escape_htmltag(trim(($activity['project_reference']??'').' - '.($activity['project_label']??''))).'</dd></div><div><dt>Période</dt><dd>'.dol_escape_htmltag(($activity['date_start']??'').' - '.($activity['date_end']??'')).'</dd></div><div><dt>Montant proposé</dt><dd>'.dol_escape_htmltag($activity['authorized_amount']??'').' F CFA</dd></div></dl><h3>Opérations</h3><ul>';
	foreach($operations as$operation)print '<li>'.dol_escape_htmltag(($operation['name']??'').' - '.($operation['type_label']??'').' - '.($operation['authorized_amount']??'').' F CFA').'</li>';
	print '</ul><h2>Historique de validation</h2>';
	$res=$db->query('SELECT stage,decision_type,actor_name_snapshot,reason,requested_amount,date_decision FROM '.$db->prefix().'mjlfinancement_review_decision WHERE entity='.(int)$conf->entity.' AND fk_revision='.(int)$revision['rowid'].' ORDER BY date_decision,rowid');$history=array();if($res)while($decision=$db->fetch_object($res))$history[]=$decision;
	if(!$history)print '<p>Aucune décision enregistrée.</p>';else{print '<ol class="mjl-review-timeline">';foreach($history as$decision)print '<li><strong>'.dol_escape_htmltag(mjl_ui_activity_status($decision->decision_type)['label']).'</strong> - '.dol_escape_htmltag($decision->actor_name_snapshot).' - '.dol_escape_htmltag($decision->date_decision).($decision->reason?'<br>'.dol_escape_htmltag($decision->reason):'').'</li>';print '</ol>';}
	$role=mjl_scope_effective_role_code($user);$eligibility=mjl_activity_review_eligibility($row,$user);
	if(!$eligibility['allowed']){print mjl_ui_system_state('permission','Décision indisponible',$eligibility['reason']).'</section>';return;}
	$decisions=$role==='AGENT_VERIFICATEUR'?array('PREVALIDATED'=>'Prévalider','RETURNED_SUPERVISOR'=>'Retourner en correction'):array('FINAL_VALIDATED'=>'Valider définitivement','RETURNED_VALIDATOR'=>'Retourner en correction');
	foreach($decisions as$decision=>$label){print '<form class="mjl-review-form" method="POST" action="?id='.(int)$row['rowid'].'">'.mjl_activity_hidden('review_revision',(int)$row['rowid'],(int)$revision['rowid'],(int)$row['version']).'<input type="hidden" name="decision" value="'.$decision.'">';if(strpos($decision,'RETURNED_')===0)print '<label>Motif (obligatoire)<textarea name="reason" maxlength="2000" required></textarea></label>'.($decision==='RETURNED_VALIDATOR'?'<label>Montant demandé (facultatif)<input name="requested_amount" inputmode="numeric" pattern="[0-9]+"></label>':'');print '<button class="button'.(strpos($decision,'RETURNED_')===0?' button-secondary':'').'" type="submit">'.$label.'</button></form>';}
	print '</section>';
}
