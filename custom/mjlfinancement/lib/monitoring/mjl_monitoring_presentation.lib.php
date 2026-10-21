<?php

require_once dirname(__DIR__).'/mjl_monitoring.lib.php';
require_once dirname(__DIR__).'/mjl_dashboard_ui.lib.php';
require_once dirname(__DIR__).'/mjl_ui.lib.php';

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
	$active=0;
	foreach (array('q','date_from','date_to','partner_id','project_id','validation_status','execution_status','completeness','activity_id') as $key) if ($filters[$key]!=='') $active++;
	print '<details class="mjl-workspace-section"><summary>Filtrer la sélection</summary><form class="mjl-activity-form" method="GET"><div class="mjl-form-grid">';
	print '<label for="monitor-q">Recherche d’Activité</label><input id="monitor-q" name="q" type="search" maxlength="100" value="'.dol_escape_htmltag($filters['q']).'">';
	foreach (array('date_from'=>'Période à partir du','date_to'=>'Période jusqu’au') as $key=>$label) print '<label for="monitor-'.$key.'">'.$label.'</label><input id="monitor-'.$key.'" name="'.$key.'" type="date" value="'.dol_escape_htmltag($filters[$key]).'">';
	foreach (array_merge(array('partner_id'=>'Partenaire','project_id'=>'Projet'),$isOperations?array('type_id'=>'Type d’opération'):array()) as $key=>$label) {
		print '<label for="monitor-'.$key.'">'.$label.'</label><select id="monitor-'.$key.'" name="'.$key.'"><option value="">Tous</option>';
		if ($filters[$key]!=='' && !in_array($filters[$key],array_map('strval',array_column($choices[$key],'id')),true)) print '<option selected value="'.dol_escape_htmltag($filters[$key]).'">Référence hors sélection</option>';
		foreach ($choices[$key] as $choice) print '<option value="'.(int)$choice['id'].'"'.((string)$choice['id']===$filters[$key]?' selected':'').'>'.dol_escape_htmltag($choice['label']).'</option>';
		print '</select>';
	}
	$enums=array('validation_status'=>array('État de validation',array('DRAFT','SUBMITTED','PREVALIDATED','RETURNED_SUPERVISOR','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED','ABANDONED')),'execution_status'=>array('État d’exécution de l’Activité',array('NOT_STARTED','UPCOMING','IN_PROGRESS','OVERDUE','COMPLETED','CANCELLED')),'completeness'=>array('Complétude des dépenses de l’Activité',array('NOT_STARTED','PARTIAL','COMPLETE')));
	if ($isOperations) $enums['operation_status']=array('État de l’Opération',array('TODO','IN_PROGRESS','COMPLETED','CANCELLED'));
	$labels=mjl_monitoring_status_labels();
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
	$primary=array('validated_amount','active_authorized_amount','total_spent_amount','missing_spent_count');
	$secondary=array('initial_amount','pending_amount','pending_draft_amount','pending_submitted_amount','cancelled_authorized_amount','active_spent_amount','cancelled_spent_amount','cancelled_incomplete_count');
	$reportUrl=mjl_monitoring_url('reports',$filters,array('report'=>'portfolio','page'=>1));
	$render=function($key) use ($totals,$labels,$reportUrl) {
		$value=substr($key,-6)==='_count'?(string)$totals[$key]:mjl_format_money($totals[$key]);
		print '<article class="mjl-dashboard-card" data-metric="'.$key.'"><h3 class="mjl-card-label">'.dol_escape_htmltag($labels[$key]).'</h3><strong class="mjl-card-value">'.dol_escape_htmltag($value).'</strong><a class="mjl-card-link" href="'.dol_escape_htmltag($reportUrl).'">Consulter le portefeuille</a></article>';
	};
	print '<section class="mjl-workspace-section mjl-dashboard-financial" aria-labelledby="mjl-financial-title"><div class="mjl-section-heading"><div><h2 id="mjl-financial-title">Situation financière</h2><p>Montants cumulés courants. Les dépenses renseignées restent une somme partielle lorsque des montants manquent.</p></div></div><div class="mjl-dashboard-financial-strip">';
	foreach ($primary as $key) $render($key);
	print '</div><details class="mjl-dashboard-financial-details"><summary>Voir les indicateurs financiers complémentaires</summary><p>Une annulation conserve les montants validés et les dépenses déjà enregistrées.</p><div class="mjl-card-grid">';
	foreach ($secondary as $key) $render($key);
	print '</div></details></section>';
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
			$items[]=array('key'=>'activity-'.$activity['rowid'],'activity_id'=>$activity['rowid'],'operation_id'=>null,'request_id'=>null,'request_type'=>null,'allowed_actions'=>array($key),'label'=>$label,'reference'=>$activity['ref'].' · '.$activity['name'],'date'=>$activity['date_start'],'href'=>mjl_monitoring_url('activities',$query),'closure'=>false);
		}
		if ($actions['execution']) foreach ($activity['operations'] as $operation) if (in_array($operation['status'],array('TODO','IN_PROGRESS'),true)) {
			$items[]=array('key'=>'operation-'.$operation['rowid'],'activity_id'=>$activity['rowid'],'operation_id'=>$operation['rowid'],'request_id'=>null,'request_type'=>null,'allowed_actions'=>array('updateExecution'),'label'=>'Saisir l’exécution','reference'=>$activity['ref'].' · '.$operation['name'],'date'=>$activity['date_end'],'href'=>mjl_monitoring_url('operations',array('activity_id'=>$activity['rowid'])).'#operation-'.(int)$operation['rowid'],'closure'=>false);
		}
	}
	foreach ($requests as $request) {
		$eligibility=$request['eligibility'];
		if (!$eligibility['approve'] && !$eligibility['reject'] && !$eligibility['withdraw']) continue;
		$allowed=array(); foreach(array('approve','reject','withdraw') as $action) if($eligibility[$action])$allowed[]=$action;
		$items[]=array('key'=>$request['request_type'].'-'.$request['rowid'],'activity_id'=>$request['fk_activity'],'operation_id'=>$request['request_type']==='REOPENING'?$request['fk_operation']:($request['target_type']==='OPERATION'?$request['target_id']:null),'request_id'=>$request['rowid'],'request_type'=>$request['request_type'],'allowed_actions'=>$allowed,'label'=>$eligibility['stale']?'À clôturer':($eligibility['approve']?'Décider la demande':'Suivre ou retirer la demande'),'reference'=>$request['target_label'],'date'=>substr($request['date_request'],0,10),'href'=>mjl_monitoring_url('requests',array('type'=>$request['request_type'],'request_id'=>$request['rowid'])),'closure'=>$eligibility['stale']);
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
