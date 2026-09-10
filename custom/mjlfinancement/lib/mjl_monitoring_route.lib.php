<?php

require_once __DIR__.'/mjl_report_route.lib.php';
require_once __DIR__.'/mjl_monitoring_access.lib.php';

function mjl_monitoring_url($kind, array $filters=array(), array $extra=array())
{
	$paths=array('home'=>'index.php','alerts'=>'alerts.php','activities'=>'activities.php','operations'=>'operations.php','requests'=>'operationrequests.php','reports'=>'reports.php');
	$query=array_merge($filters,$extra);
	foreach ($query as $key=>$value) if ($value==='' || ($key==='page' && (string)$value==='1') || ($key==='grouping' && $value==='project')) unset($query[$key]);
	return DOL_URL_ROOT.'/custom/mjlfinancement/'.$paths[$kind].($query?'?'.http_build_query($query,'','&',PHP_QUERY_RFC3986):'');
}

function mjl_monitoring_filter_form(array $filters, array $choices, $kind, array $extra=array())
{
	$isOperations=$kind==='operations';
	print '<details class="mjl-workspace-section"><summary>Filtrer la sélection</summary><form class="mjl-activity-form" method="GET"><div class="mjl-form-grid">';
	foreach (array('q'=>'Recherche d’Activité','date_from'=>'Période à partir du','date_to'=>'Période jusqu’au') as $key=>$label) print '<label for="monitor-'.$key.'">'.$label.'</label><input id="monitor-'.$key.'" name="'.$key.'" type="'.($key==='q'?'search':'date').'" maxlength="100" value="'.dol_escape_htmltag($filters[$key]).'">';
	foreach (array_merge(array('partner_id'=>'Partenaire','project_id'=>'Projet'),$isOperations?array('type_id'=>'Type d’opération'):array()) as $key=>$label) {
		print '<label for="monitor-'.$key.'">'.$label.'</label><select id="monitor-'.$key.'" name="'.$key.'"><option value="">Tous</option>';
		if ($filters[$key]!=='' && !in_array($filters[$key],array_map('strval',array_column($choices[$key],'id')),true)) print '<option selected value="'.dol_escape_htmltag($filters[$key]).'">Référence hors sélection</option>';
		foreach ($choices[$key] as $choice) print '<option value="'.(int)$choice['id'].'"'.((string)$choice['id']===$filters[$key]?' selected':'').'>'.dol_escape_htmltag($choice['label']).'</option>';
		print '</select>';
	}
	$enums=array('validation_status'=>array('État de validation',array('DRAFT','SUBMITTED','PREVALIDATED','RETURNED_SUPERVISOR','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED','ABANDONED')),'execution_status'=>array('État d’exécution de l’Activité',array('NOT_STARTED','UPCOMING','IN_PROGRESS','OVERDUE','COMPLETED','CANCELLED')),'completeness'=>array('Complétude des dépenses de l’Activité',array('NOT_STARTED','PARTIAL','COMPLETE')));
	if ($isOperations) $enums['operation_status']=array('État de l’Opération',array('TODO','IN_PROGRESS','COMPLETED','CANCELLED'));
	$labels=mjl_report_status_labels();
	foreach ($enums as $key=>$definition) {
		print '<label for="monitor-'.$key.'">'.$definition[0].'</label><select id="monitor-'.$key.'" name="'.$key.'"><option value="">Tous</option>';
		foreach ($definition[1] as $value) print '<option value="'.$value.'"'.($filters[$key]===$value?' selected':'').'>'.dol_escape_htmltag($key==='completeness' && $value==='NOT_STARTED'?'Non renseignée':$labels[$value]).'</option>';
		print '</select>';
	}
	print '</div>';
	foreach ($extra as $key=>$value) print '<input type="hidden" name="'.$key.'" value="'.dol_escape_htmltag($value).'">';
	if ($filters['activity_id']!=='') print '<input type="hidden" name="activity_id" value="'.dol_escape_htmltag($filters['activity_id']).'">';
	print '<button class="button" type="submit">Appliquer les filtres</button> <a href="'.mjl_monitoring_url($kind).'">Réinitialiser</a></form></details>';
}

function mjl_monitoring_pagination($kind, array $filters, $count, $label, array $extra=array())
{
	$page=(int)$filters['page'];
	if ($page===1 && $count<=50) return;
	print '<nav class="mjl-pagination" aria-label="'.dol_escape_htmltag($label).'">';
	foreach (array(-1=>'Précédent',1=>'Suivant') as $offset=>$text) if (($offset<0 && $page>1)||($offset>0 && $count>$page*50)) print '<a class="mjl-action mjl-action-secondary" rel="'.($offset<0?'prev':'next').'" href="'.dol_escape_htmltag(mjl_monitoring_url($kind,$filters,array_merge($extra,array('page'=>$page+$offset)))).'">'.$text.'</a> ';
	print '</nav>';
}

function mjl_monitoring_financial_cards(array $activities, array $filters)
{
	$totals=mjl_monitoring_dashboard_totals($activities);
	$labels=mjl_monitoring_labels()+array('pending_draft_amount'=>'Propositions en brouillon ou retournées','pending_submitted_amount'=>'Propositions soumises ou prévalidées');
	print '<section class="mjl-workspace-section" aria-labelledby="mjl-financial-title"><h2 id="mjl-financial-title">Situation financière</h2><p>Montants cumulés courants. Une annulation conserve les montants validés. Les dépenses renseignées constituent une somme partielle lorsque des montants manquent.</p><div class="mjl-card-grid">';
	foreach (array('initial_amount','pending_amount','pending_draft_amount','pending_submitted_amount','validated_amount','active_authorized_amount','cancelled_authorized_amount','active_spent_amount','cancelled_spent_amount','total_spent_amount','missing_spent_count','cancelled_incomplete_count') as $key) {
		$value=substr($key,-6)==='_count'?(string)$totals[$key]:mjl_format_money($totals[$key]);
		print '<article class="mjl-dashboard-card" data-metric="'.$key.'"><h3 class="mjl-card-label">'.dol_escape_htmltag($labels[$key]).'</h3><strong class="mjl-card-value">'.dol_escape_htmltag($value).'</strong><a class="mjl-card-link" href="'.dol_escape_htmltag(mjl_monitoring_url('reports',$filters,array('report'=>'portfolio','page'=>1))).'">Consulter le portefeuille</a></article>';
	}
	print '</div></section>';
}

function mjl_monitoring_stage_counts(array $activities, array $filters)
{
	$counts=array_fill_keys(array('DRAFT','SUBMITTED','PREVALIDATED','RETURNED_SUPERVISOR','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED','ABANDONED'),0);
	foreach ($activities as $activity) $counts[$activity['validation_status']]++;
	print '<section class="mjl-workspace-section" aria-labelledby="mjl-workflow-title"><h2 id="mjl-workflow-title">Étapes de validation</h2><p>'.count($activities).' Activité(s) dans la sélection. Les effectifs par étape ne représentent pas vos autorisations de décision.</p><ul class="mjl-link-grid">';
	foreach ($counts as $status=>$count) print '<li><a href="'.dol_escape_htmltag(mjl_monitoring_url('activities',$filters,array('validation_status'=>$status,'page'=>1))).'">'.dol_escape_htmltag(mjl_ui_activity_status($status)['label']).' : '.$count.'</a></li>';
	print '</ul></section>';
}

function mjl_monitoring_queue(array $activities, array $requests, $role, $actorId, $date)
{
	$items=array();
	foreach ($activities as $activity) {
		$actions=mjl_monitoring_activity_actions($activity,$role,$actorId,$date);
		if ($actions['edit']) $actions['abandon']=false;
		foreach (array('edit'=>'Préparer ou corriger','review'=>$role==='AGENT_VERIFICATEUR'?'Prévalider':'Valider définitivement','restore'=>'Restaurer le brouillon','abandon'=>'Abandonner le brouillon') as $key=>$label) if ($actions[$key]) {
			$query=array('id'=>$activity['rowid']); if ($key==='edit') $query['action']='edit'; elseif ($key==='review') $query['action']='review';
			$items[]=array('key'=>'activity-'.$activity['rowid'],'label'=>$label,'reference'=>$activity['ref'].' · '.$activity['name'],'date'=>$activity['date_start'],'href'=>mjl_monitoring_url('activities',$query),'closure'=>false);
		}
		if ($actions['execution']) foreach ($activity['operations'] as $operation) if (in_array($operation['status'],array('TODO','IN_PROGRESS'),true)) {
			$items[]=array('key'=>'operation-'.$operation['rowid'],'label'=>'Saisir l’exécution','reference'=>$activity['ref'].' · '.$operation['name'],'date'=>$activity['date_end'],'href'=>mjl_monitoring_url('operations',array('activity_id'=>$activity['rowid'])).'#operation-'.(int)$operation['rowid'],'closure'=>false);
		}
	}
	foreach ($requests as $request) {
		$eligibility=$request['eligibility'];
		if (!$eligibility['approve'] && !$eligibility['reject'] && !$eligibility['withdraw']) continue;
		$items[]=array('key'=>$request['request_type'].'-'.$request['rowid'],'label'=>$eligibility['stale']?'À clôturer':($eligibility['approve']?'Décider la demande':'Suivre ou retirer la demande'),'reference'=>$request['target_label'],'date'=>substr($request['date_request'],0,10),'href'=>mjl_monitoring_url('requests',array('type'=>$request['request_type'],'request_id'=>$request['rowid'])),'closure'=>$eligibility['stale']);
	}
	usort($items,function($a,$b){return strcmp($a['date'],$b['date']) ?: strcmp($a['key'],$b['key']);});
	return $items;
}

function mjl_monitoring_alerts(array $activities, $role, $actorId, $date)
{
	$items=array();
	$labels=array('VALIDATION_LATE'=>array('Validation attendue : début atteint',3),'VALIDATION_DUE'=>array('Validation attendue dans les sept jours',2),'COMPLETION_OVERDUE'=>array('Activité en retard',3),'COMPLETION_DUE'=>array('Fin d’Activité dans les sept jours',2),'SPENDING_MISSING'=>array('Montant dépensé à renseigner',2),'SPENDING_INFORMATION'=>array('Situation financière non renseignée, Opération verrouillée',1));
	foreach ($activities as $activity) {
		$actions=mjl_monitoring_activity_actions($activity,$role,$actorId,$date);
		$operations=array_column($activity['operations'],null,'rowid');
		foreach (mjl_monitoring_deadline_alerts($activity,$activity['operations'],$date,$actions['execution']) as $alert) {
			$definition=$labels[$alert['code']]; $operation=$operations[$alert['operation_id']] ?? null;
			$alert['label']=$definition[0]; $alert['priority']=$definition[1];
			$alert['reference']=$activity['ref'].' · '.($operation?$operation['name']:$activity['name']);
			$alert['date']=strpos($alert['code'],'VALIDATION_')===0?$activity['date_start']:$activity['date_end'];
			$alert['href']=$operation?mjl_monitoring_url('operations',array('activity_id'=>$activity['rowid'])).'#operation-'.(int)$operation['rowid']:mjl_monitoring_url('activities',array('id'=>$activity['rowid']));
			$items[]=$alert;
		}
	}
	usort($items,function($a,$b){return ($b['priority']<=>$a['priority']) ?: strcmp($a['date'],$b['date']) ?: ((int)$a['activity_id']<=>(int)$b['activity_id']) ?: ((int)$a['operation_id']<=>(int)$b['operation_id']) ?: strcmp($a['code'],$b['code']);});
	return $items;
}

function mjl_monitoring_render_items(array $items, $alerts=false)
{
	if (!$items) { print mjl_ui_system_state('filtered-empty',$alerts?'Aucune alerte':'Aucune action à traiter','Aucun élément ne correspond à la sélection et à vos accès.'); return; }
	print '<ol class="mjl-review-timeline">';
	foreach ($items as $item) print '<li'.($alerts?' data-alert="'.$item['code'].'"':' data-work="'.dol_escape_htmltag($item['key']).'"').'><strong>'.dol_escape_htmltag($item['label']).'</strong><p>'.dol_escape_htmltag($item['reference']).'</p><p>'.($alerts?($item['actionable']?'Action disponible pour votre profil. ':'Information de suivi. '):'').'Date : '.dol_escape_htmltag(mjl_format_date($item['date'])).'</p><a href="'.dol_escape_htmltag($item['href']).'">Ouvrir</a></li>';
	print '</ol>';
}

function mjl_monitoring_page($kind)
{
	global $db,$user,$conf;
	if (!mjl_navigation_policy_allows($user,'planning_read')) mjl_report_http_error(403,'Accès non autorisé.');
	if (($_SERVER['REQUEST_METHOD']??'GET')!=='GET') mjl_report_http_error(405,'Utilisez les formulaires de l’objet concerné.');
	$source=$_GET; unset($source['result'],$source['mainmenu'],$source['leftmenu']);
	if ($kind==='activities') {
		unset($source['action']);
		if (isset($source['status'])) { if (isset($source['validation_status']) && $source['validation_status']!==$source['status']) mjl_report_http_error(400,'Filtres invalides.'); $source['validation_status']=$source['status']; unset($source['status']); }
	}
	$requestFilters=array('type'=>'','status'=>'PENDING','request_id'=>'');
	try {
		if ($kind==='requests') {
			foreach ($requestFilters as $key=>$default) if (array_key_exists($key,$source)) { if (!is_string($source[$key])) throw new InvalidArgumentException('INVALID_FILTER'); $requestFilters[$key]=$source[$key]; unset($source[$key]); }
			if (!in_array($requestFilters['type'],array('','CANCELLATION','REOPENING'),true) || !in_array($requestFilters['status'],array('','PENDING','APPROVED','REJECTED','WITHDRAWN'),true)) throw new InvalidArgumentException('INVALID_FILTER');
			mjl_monitoring_filters(array('activity_id'=>$requestFilters['request_id']));
			if ($requestFilters['request_id']!=='' && $requestFilters['type']==='') throw new InvalidArgumentException('INVALID_FILTER');
		}
		$filters=mjl_report_validate_request($kind==='operations'?'operations':'activities','csv',$source);
	} catch (InvalidArgumentException $exception) { mjl_report_http_error(400,'Filtres invalides.'); }
	$titles=array('home'=>'Accueil','alerts'=>'Alertes','activities'=>'Activités','operations'=>'Opérations','requests'=>'Demandes d’exception');
	$title=$titles[$kind]; $activities=null; $queue=null; $requests=null; $choices=null; $budgets=null;
	$reader=new MjlMonitoring($db,$user,(int)$conf->entity);
	try {
		$budgets=$reader->rows('SELECT @@session.max_statement_time AS statement_time,@@session.innodb_lock_wait_timeout AS row_wait,@@session.lock_wait_timeout AS metadata_wait')[0];
		if (!$db->query('SET SESSION max_statement_time=5,innodb_lock_wait_timeout=2,lock_wait_timeout=2') || mjl_monitoring_readiness()!==1) throw new RuntimeException('READ_FAILED');
		if (!$db->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ') || !$db->begin('mjl monitoring')) throw new RuntimeException('READ_FAILED');
		$activities=$reader->activities($filters);
		try { $choices=mjl_report_reference_choices($reader,$kind==='operations'); } catch (Throwable $exception) { $choices=null; }
		if ($kind==='home' || $kind==='requests') {
			try {
				$workActivities=$reader->reviewFacts($activities);
				$requests=$reader->requests($workActivities,$kind==='requests'?$requestFilters['status']:'PENDING');
				if ($kind==='home') $queue=mjl_monitoring_queue($workActivities,$requests,$reader->role(),$user->id,$reader->date());
			} catch (Throwable $exception) { $queue=null; $requests=null; }
		}
		if (!$db->commit('mjl monitoring')) throw new RuntimeException('READ_FAILED');
	} catch (Throwable $exception) { if ($db->transaction_opened>0) $db->rollback(); $activities=null; http_response_code(503); }
	finally { if ($budgets!==null && !$db->query('SET SESSION max_statement_time='.(float)$budgets['statement_time'].',innodb_lock_wait_timeout='.(int)$budgets['row_wait'].',lock_wait_timeout='.(int)$budgets['metadata_wait'])) { $activities=null; http_response_code(503); } }
	header('Cache-Control: private, no-store');
	llxHeader('',$title); mjl_navigation_shell_start($user);
	$options=array('description'=>'Montants cumulés courants et suivi dans votre périmètre d’accès.','context'=>array('label'=>'Rôle','value'=>mjl_scope_role_label($reader->role())));
	if ($kind==='activities' && $reader->role()==='AGENT_SAISIE') $options['primary_action']=array('label'=>'Créer une Activité','href'=>mjl_monitoring_url('activities',array('action'=>'create')));
	print '<div class="mjl-workspace">'.mjl_page_header_render($title,$options);
	if ($activities===null) print mjl_ui_system_state('unavailable','Suivi indisponible','Les données ne peuvent pas être chargées. Aucun total ni action n’est disponible.');
	else {
		if ($choices===null) print mjl_ui_system_state('unavailable','Filtres indisponibles','Les références ne peuvent pas être chargées.');
		else mjl_monitoring_filter_form($filters,$choices,$kind,$kind==='requests'?$requestFilters:array());
		print '<p>Calcul au '.dol_escape_htmltag(mjl_format_date($reader->date())).' (Africa/Porto-Novo). Actualisé le '.dol_escape_htmltag(gmdate('d/m/Y H:i')).' UTC. Périmètre : '.($reader->role()==='AGENT_SAISIE'?'Activités actuellement affectées':'portefeuille de l’entité active').'. Période : '.($filters['date_from']==='' && $filters['date_to']===''?'toutes les dates':dol_escape_htmltag(($filters['date_from']?:'sans début').' au '.($filters['date_to']?:'sans fin'))).'. La sélection retient les Activités dont les dates chevauchent la période.</p>';
		if ($kind==='home') {
			mjl_monitoring_financial_cards($activities,$filters); mjl_monitoring_stage_counts($activities,$filters);
			print '<section class="mjl-workspace-section" aria-labelledby="mjl-work-title"><h2 id="mjl-work-title">Actions à traiter</h2><p>Actions permises pour votre profil. Les demandes devenues obsolètes restent à clôturer.</p>';
			if ($queue===null) print mjl_ui_system_state('unavailable','Actions indisponibles','Les autorisations de traitement ne peuvent pas être chargées.');
			else { mjl_monitoring_render_items(array_slice($queue,((int)$filters['page']-1)*50,50)); mjl_monitoring_pagination('home',$filters,count($queue),'Pagination des actions'); }
			print '</section><section class="mjl-workspace-section"><h2>Alertes de suivi</h2>';
			$alerts=mjl_monitoring_alerts($activities,$reader->role(),$user->id,$reader->date()); mjl_monitoring_render_items(array_slice($alerts,0,5),true);
			print '<a href="'.dol_escape_htmltag(mjl_monitoring_url('alerts',$filters,array('page'=>1))).'">Voir toutes les alertes ('.count($alerts).')</a></section>';
		} elseif ($kind==='alerts') {
			$alerts=mjl_monitoring_alerts($activities,$reader->role(),$user->id,$reader->date());
			mjl_monitoring_render_items(array_slice($alerts,((int)$filters['page']-1)*50,50),true); mjl_monitoring_pagination('alerts',$filters,count($alerts),'Pagination des alertes');
		} elseif ($kind==='activities') {
			print '<p><a href="'.dol_escape_htmltag(mjl_monitoring_url('reports',$filters,array('page'=>1))).'">Suivi des Activités et téléchargements</a></p>';
			if (!$activities) print mjl_ui_system_state('filtered-empty','Aucune Activité','Aucune Activité ne correspond aux filtres et à vos accès.');
			foreach (array_slice($activities,((int)$filters['page']-1)*50,50) as $activity) {
				print '<article class="mjl-activity-panel" data-activity="'.(int)$activity['rowid'].'"><h2><a href="'.mjl_monitoring_url('activities',array('id'=>$activity['rowid'])).'">'.dol_escape_htmltag($activity['ref'].' · '.$activity['name']).'</a></h2><p>'.dol_escape_htmltag($activity['partner_name'].' · '.$activity['project_name']).'</p><p>'.mjl_ui_status_badge(mjl_ui_activity_status($activity['validation_status'])).' '.dol_escape_htmltag(mjl_report_status_labels()[$activity['execution_status']]).'</p><dl class="mjl-activity-meta">';
				foreach (array('initial_amount','pending_amount','validated_amount','total_spent_amount') as $key) print '<div><dt>'.dol_escape_htmltag(mjl_monitoring_labels()[$key]).'</dt><dd>'.dol_escape_htmltag(mjl_format_money($activity[$key])).'</dd></div>';
				print '<div><dt>Complétude des dépenses</dt><dd>'.dol_escape_htmltag($activity['completeness']==='NOT_STARTED'?'Non renseignée':mjl_report_status_labels()[$activity['completeness']]).'</dd></div></dl></article>';
			}
			mjl_monitoring_pagination('activities',$filters,count($activities),'Pagination des Activités');
		} elseif ($kind==='operations') {
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
	print '</div>'; mjl_navigation_shell_end(); llxFooter();
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
	foreach (array_slice($rows,((int)$filters['page']-1)*50,50) as $row) mjl_request_render((object)$row);
	mjl_monitoring_pagination('requests',$filters,count($rows),'Pagination des demandes',$requestFilters);
}
