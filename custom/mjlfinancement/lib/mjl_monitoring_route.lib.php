<?php

require_once __DIR__.'/mjl_http.lib.php';
require_once __DIR__.'/mjl_monitoring_access.lib.php';
require_once __DIR__.'/mjl_operation_consultation.lib.php';
require_once __DIR__.'/mjl_dashboard_ui.lib.php';

require_once __DIR__.'/monitoring/mjl_monitoring_presentation.lib.php';
require_once __DIR__.'/monitoring/mjl_monitoring_read.lib.php';


function mjl_monitoring_page($kind)
{
	global $db,$user,$conf;
	if (!in_array($kind,array('operations','requests'),true)) throw new InvalidArgumentException('INVALID_MONITORING_SURFACE');
	if (!mjl_navigation_policy_allows($user,'planning_read')) mjl_http_error(403,'Accès non autorisé.');
	if (($_SERVER['REQUEST_METHOD']??'GET')!=='GET') mjl_http_error(405,'Utilisez les formulaires de l’objet concerné.');
	$source=$_GET; unset($source['result'],$source['mainmenu'],$source['leftmenu']);
	$requestFilters=array('type'=>'','status'=>'PENDING','request_id'=>'');
	try {
		if ($kind==='requests') {
			foreach ($requestFilters as $key=>$default) if (array_key_exists($key,$source)) { if (!is_string($source[$key])) throw new InvalidArgumentException('INVALID_FILTER'); $requestFilters[$key]=$source[$key]; unset($source[$key]); }
			if (!in_array($requestFilters['type'],array('','CANCELLATION','REOPENING'),true) || !in_array($requestFilters['status'],array('','PENDING','APPROVED','REJECTED','WITHDRAWN'),true)) throw new InvalidArgumentException('INVALID_FILTER');
			mjl_monitoring_filters(array('activity_id'=>$requestFilters['request_id']));
			if ($requestFilters['request_id']!=='' && $requestFilters['type']==='') throw new InvalidArgumentException('INVALID_FILTER');
		}
		$filters=mjl_monitoring_validate_request($source,$kind==='operations');
	} catch (InvalidArgumentException $exception) { mjl_http_error(400,'Filtres invalides.'); }
	$titles=array('operations'=>'Opérations','requests'=>'Demandes d’exception');
	$title=$titles[$kind]; $activities=null; $requests=null; $choices=null; $budgets=null;
	$reader=new MjlMonitoring($db,$user,(int)$conf->entity);
	try {
		$budgets=$reader->rows('SELECT @@session.max_statement_time AS statement_time,@@session.innodb_lock_wait_timeout AS row_wait,@@session.lock_wait_timeout AS metadata_wait')[0];
		if (!$db->query('SET SESSION max_statement_time=5,innodb_lock_wait_timeout=2,lock_wait_timeout=2') || mjl_monitoring_readiness()!==1) throw new RuntimeException('READ_FAILED');
		if (!$db->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ') || !$db->begin('mjl monitoring')) throw new RuntimeException('READ_FAILED');
		$activities=$reader->activities($filters);
		try { $choices=$reader->referenceChoices($kind==='operations'); } catch (Throwable $exception) { $choices=null; }
		if ($kind==='requests') {
			try {
				$workActivities=$reader->reviewFacts($activities);
				$requests=$reader->requests($workActivities,$requestFilters['status']);
			} catch (Throwable $exception) { $requests=null; }
		}
		if (!$db->commit('mjl monitoring')) throw new RuntimeException('READ_FAILED');
	} catch (Throwable $exception) { if ($db->transaction_opened>0) $db->rollback(); $activities=null; http_response_code(503); }
	finally { if ($budgets!==null && !$db->query('SET SESSION max_statement_time='.(float)$budgets['statement_time'].',innodb_lock_wait_timeout='.(int)$budgets['row_wait'].',lock_wait_timeout='.(int)$budgets['metadata_wait'])) { $activities=null; http_response_code(503); } }
	header('Cache-Control: private, no-store');
	llxHeader('',$title); mjl_navigation_shell_start($user);
	$options=array('description'=>'Montants cumulés courants et suivi dans votre périmètre d’accès.','context'=>array('label'=>'Rôle','value'=>mjl_scope_role_label($reader->role())));
	print '<div class="mjl-workspace">'.mjl_page_header_render($title,$options);
	if ($activities===null) print mjl_ui_system_state('unavailable','Suivi indisponible','Les données ne peuvent pas être chargées. Aucun total ni action n’est disponible.');
	else {
		if ($choices===null) print mjl_ui_system_state('unavailable','Filtres indisponibles','Les références ne peuvent pas être chargées.');
		else mjl_monitoring_filter_form($filters,$choices,$kind,$kind==='requests'?$requestFilters:array());
		print '<p>Calcul au '.dol_escape_htmltag(mjl_format_date($reader->date())).' (Africa/Porto-Novo). Actualisé le '.dol_escape_htmltag(gmdate('d/m/Y H:i')).' UTC. Périmètre : '.($reader->role()==='AGENT_SAISIE'?'Activités actuellement affectées':'portefeuille de l’entité active').'. Période : '.($filters['date_from']==='' && $filters['date_to']===''?'toutes les dates':dol_escape_htmltag(($filters['date_from']?:'sans début').' au '.($filters['date_to']?:'sans fin'))).'. La sélection retient les Activités dont les dates chevauchent la période.</p>';
		if ($kind==='operations') {
			$rows=$reader->operations($activities,$filters); usort($rows,function($a,$b){return (int)$b['rowid']<=>(int)$a['rowid'];});
			print '<p>Les filtres de type et d’état d’Opération ne changent pas les totaux ni la complétude de l’Activité parente.</p><p><a href="'.dol_escape_htmltag(mjl_monitoring_url('reports',$filters,array('report'=>'operations','page'=>1))).'">Suivi des Opérations et téléchargements</a></p>';
			if (function_exists('mjl_operation_feedback')) print mjl_operation_feedback();
			if (!$rows) print mjl_ui_system_state('filtered-empty','Aucune Opération','Aucune Opération ne correspond aux filtres et à vos accès.');
			else mjl_operation_render_rows(array_map(function($row){return (object)$row;},array_slice($rows,((int)$filters['page']-1)*50,50)));
			mjl_monitoring_pagination('operations',$filters,count($rows),'Pagination des Opérations');
		} elseif ($kind==='requests') {
			mjl_monitoring_requests_view($requests,$filters,$requestFilters);
		}
	}
	print '</div>';
	mjl_navigation_shell_end(); llxFooter();
}

function mjl_monitoring_requests_view($requests, array $filters, array $requestFilters)
{
	print mjl_request_feedback();
	if ($requests===null) { print mjl_ui_system_state('unavailable','Demandes indisponibles','Les demandes ne peuvent pas être chargées.'); return; }
	print '<form method="GET">';
	foreach ($filters as $key=>$value) if ($value!=='' && $key!=='page') print '<input type="hidden" name="'.$key.'" value="'.dol_escape_htmltag($value).'">';
	print '<label>Type <select name="type">';
	foreach (array(''=>'Tous','CANCELLATION'=>'Annulation','REOPENING'=>'Réouverture') as $key=>$label) print '<option value="'.$key.'"'.($key===$requestFilters['type']?' selected':'').'>'.$label.'</option>';
	print '</select></label><label>Statut <select name="status">';
	foreach (array(''=>'Tous','PENDING'=>'En attente','APPROVED'=>'Approuvée','REJECTED'=>'Rejetée','WITHDRAWN'=>'Retirée') as $key=>$label) print '<option value="'.$key.'"'.($key===$requestFilters['status']?' selected':'').'>'.$label.'</option>';
	print '</select></label><button class="button" type="submit">Filtrer les demandes</button></form>';
	$rows=array_values(array_filter($requests,function($row)use($requestFilters){return ($requestFilters['type']==='' || $row['request_type']===$requestFilters['type']) && ($requestFilters['request_id']==='' || (string)$row['rowid']===$requestFilters['request_id']);}));
	if (!$rows) print mjl_ui_system_state('filtered-empty','Aucune demande','Aucune demande ne correspond aux filtres et à vos accès.');
	$hasExceptionAction=false;
	foreach (array_slice($rows,((int)$filters['page']-1)*50,50) as $row) $hasExceptionAction=mjl_request_render((object)$row)||$hasExceptionAction;
	if($hasExceptionAction)print mjl_exception_dialog();
	mjl_monitoring_pagination('requests',$filters,count($rows),'Pagination des demandes',$requestFilters);
}
