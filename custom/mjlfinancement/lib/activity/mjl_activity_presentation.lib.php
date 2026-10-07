<?php

require_once dirname(__DIR__).'/mjl_page_header.lib.php';
require_once dirname(__DIR__).'/mjl_presentation.lib.php';
require_once dirname(__DIR__).'/mjl_execution.lib.php';
require_once dirname(__DIR__).'/mjl_exception_ui.lib.php';
require_once dirname(__DIR__).'/mjl_operation_consultation.lib.php';
require_once dirname(__DIR__).'/mjl_scope.lib.php';
require_once dirname(__DIR__).'/mjl_ui.lib.php';
require_once dirname(__DIR__).'/mjl_monitoring_work.lib.php';
require_once dirname(__DIR__).'/mjl_report_data.lib.php';

function mjl_activity_monitoring_url($path, array $filters=array(), array $extra=array())
{
	$query=array_merge($filters,$extra);
	foreach($query as$key=>$value)if($value===''||($key==='page'&&(string)$value==='1')||($key==='grouping'&&$value==='project'))unset($query[$key]);
	return DOL_URL_ROOT.'/custom/mjlfinancement/'.$path.($query?'?'.http_build_query($query,'','&',PHP_QUERY_RFC3986):'');
}

function mjl_activity_monitoring_pagination(array $filters,$count)
{
	$page=(int)$filters['page'];if($page===1&&$count<=50)return;
	print '<nav class="mjl-pagination" aria-label="Pagination des Activités">';
	if($page>1)print '<a class="mjl-action mjl-action-secondary" rel="prev" href="'.dol_escape_htmltag(mjl_activity_monitoring_url('activities.php',$filters,array('page'=>$page-1))).'">Précédent</a> ';
	if($count>$page*50)print '<a class="mjl-action mjl-action-secondary" rel="next" href="'.dol_escape_htmltag(mjl_activity_monitoring_url('activities.php',$filters,array('page'=>$page+1))).'">Suivant</a> ';
	print '</nav>';
}

function mjl_activity_monitoring_filter_form(array $filters,array $choices)
{
	$active=0;foreach(array('q','date_from','date_to','partner_id','project_id','validation_status','execution_status','completeness','activity_id')as$key)if($filters[$key]!=='')$active++;
	print '<section class="mjl-activity-filter-panel" aria-label="Recherche et filtres des Activités"><form method="GET"><div class="mjl-activity-filter-toolbar"><label for="monitor-q">Rechercher une Activité</label><input id="monitor-q" name="q" type="search" maxlength="100" value="'.dol_escape_htmltag($filters['q']).'" placeholder="Rechercher une Activité…"><button class="button" type="submit">Rechercher</button></div><details class="mjl-activity-filter-details"'.($active?' open':'').'><summary>Filtres'.($active?' ('.$active.')':'').'</summary><div class="mjl-form-grid">';
	foreach(array('date_from'=>'Période à partir du','date_to'=>'Période jusqu’au')as$key=>$label)print '<label for="monitor-'.$key.'">'.$label.'</label><input id="monitor-'.$key.'" name="'.$key.'" type="date" data-mjl-date value="'.dol_escape_htmltag($filters[$key]).'">';
	foreach(array('partner_id'=>'Partenaire','project_id'=>'Projet')as$key=>$label){print '<label for="monitor-'.$key.'">'.$label.'</label><select id="monitor-'.$key.'" name="'.$key.'" data-mjl-select><option value="">Tous</option>';if($filters[$key]!==''&&!in_array($filters[$key],array_map('strval',array_column($choices[$key],'id')),true))print '<option selected value="'.dol_escape_htmltag($filters[$key]).'">Référence hors sélection</option>';foreach($choices[$key]as$choice)print '<option value="'.(int)$choice['id'].'"'.((string)$choice['id']===$filters[$key]?' selected':'').'>'.dol_escape_htmltag($choice['label']).'</option>';print '</select>';}
	$enums=array('validation_status'=>array('État de validation',array('DRAFT','SUBMITTED','PREVALIDATED','RETURNED_SUPERVISOR','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED','ABANDONED')),'execution_status'=>array('État d’exécution de l’Activité',array('NOT_STARTED','UPCOMING','IN_PROGRESS','OVERDUE','COMPLETED','CANCELLED')),'completeness'=>array('Complétude des dépenses de l’Activité',array('NOT_STARTED','PARTIAL','COMPLETE')));$labels=mjl_report_status_labels();
	foreach($enums as$key=>$definition){print '<label for="monitor-'.$key.'">'.$definition[0].'</label><select id="monitor-'.$key.'" name="'.$key.'"><option value="">Tous</option>';foreach($definition[1]as$value)print '<option value="'.$value.'"'.($filters[$key]===$value?' selected':'').'>'.dol_escape_htmltag($key==='completeness'&&$value==='NOT_STARTED'?'Non renseignée':$labels[$value]).'</option>';print '</select>';}
	if($filters['activity_id']!=='')print '<input type="hidden" name="activity_id" value="'.dol_escape_htmltag($filters['activity_id']).'">';
	print '</div><div class="mjl-activity-filter-actions"><button class="button" type="submit">Appliquer les filtres</button> <a href="'.mjl_activity_monitoring_url('activities.php').'">Réinitialiser</a></div></details></form></section>';
}

function mjl_activity_present($template, array $view)
{
	return require dirname(__DIR__, 2).'/tpl/activity/'.$template.'.php';
}

function mjl_activity_feedback_html(array $feedback)
{
	return $feedback?mjl_ui_system_state($feedback[0],$feedback[1],$feedback[2]):'';
}

function mjl_activity_options_html(array $rows,$selected,$project=false,array $assignmentFlags=array())
{
	$html='<option value="">Sélectionner</option>';
	foreach($rows as$row){
		$label=$row['label']??trim(trim($row['firstname']??'').' '.trim($row['lastname']??''));if($label==='')$label=$row['login']??'';
		$attributes=$project?' data-partner-id="'.(int)$row['partner_id'].'"':'';
		if($assignmentFlags){$flags=$assignmentFlags[(int)$row['rowid']]??array();$attributes.=' data-is-current="'.(!empty($flags['current'])?'1':'0').'" data-is-primary="'.(!empty($flags['primary'])?'1':'0').'"';}
		$html.='<option value="'.(int)$row['rowid'].'"'.$attributes.((int)$selected===(int)$row['rowid']?' selected':'').'>'.dol_escape_htmltag($label).'</option>';
	}
	return $html;
}

function mjl_activity_hidden(array $effects,$key,$action,$id=0,$revision=0,$version=0)
{
	$effect=$effects[$key]??array('csrf'=>'','submission'=>'');
	return '<input type="hidden" name="token" value="'.dol_escape_htmltag($effect['csrf']).'"><input type="hidden" name="mjl_submission" value="'.dol_escape_htmltag($effect['submission']).'"><input type="hidden" name="action" value="'.$action.'">'.($id?'<input type="hidden" name="id" value="'.$id.'">':'').'<input type="hidden" name="revision_id" value="'.$revision.'"><input type="hidden" name="version" value="'.$version.'">';
}

function mjl_monitoring_activity_list(array $activities, array $filters)
{
	$count=count($activities);
	$page=(int)$filters['page'];
	$rows=array_slice($activities,($page-1)*50,50);
	$first=$rows?(($page-1)*50+1):0;
	$last=$rows?($first+count($rows)-1):0;
	print '<section class="mjl-activity-list" aria-label="Résultats des Activités"><div class="mjl-activity-list-heading"><strong>'.($count===1?'1 Activité':$count.' Activités').' dans la sélection</strong><span>Résultats '.$first.'–'.$last.' sur '.$count.'</span></div>';
	if (!$rows) {
		print mjl_ui_system_state('filtered-empty','Aucune Activité',$count?'Aucune Activité sur cette page. Revenez à la page précédente.':'Aucune Activité ne correspond aux filtres et à vos accès.');
		print '</section>';
		mjl_activity_monitoring_pagination($filters,$count);
		return;
	}
	print '<div class="mjl-activity-list-scroll"><table class="mjl-activity-list-table mjl-data-table"><thead><tr><th scope="col">Activité / Partenaire</th><th scope="col">Validation</th><th scope="col">Exécution</th><th scope="col">Période / Projet</th><th scope="col">Montant autorisé</th><th scope="col">Montant dépensé</th><th scope="col">Fiche</th></tr></thead><tbody>';
	foreach ($rows as $activity) {
		$id=(int)$activity['rowid'];
		$url=mjl_activity_monitoring_url('activities.php',array('id'=>$id));
		$validated=$activity['validated_amount']!==null;
		$amount=$validated?$activity['validated_amount']:$activity['pending_amount'];
		$amountKind=$validated?'Validé':($amount!==null?'Proposé':'Non renseigné');
		$operations=$activity['operations'];
		print '<tr class="mjl-activity-list-row" data-activity="'.$id.'"><td data-label="Activité / Partenaire"><a class="mjl-activity-list-name" href="'.dol_escape_htmltag($url).'">'.dol_escape_htmltag($activity['name']).'</a><small>'.dol_escape_htmltag($activity['ref'].' · '.$activity['partner_name']).'</small></td>';
		print '<td data-label="Validation">'.mjl_ui_status_badge(mjl_ui_activity_status($activity['validation_status'])).'</td><td data-label="Exécution">'.mjl_ui_status_badge(mjl_ui_execution_status($activity['execution_status'])).'</td>';
		print '<td data-label="Période / Projet">'.dol_escape_htmltag(mjl_format_date($activity['date_start'])).' au '.dol_escape_htmltag(mjl_format_date($activity['date_end'])).'<small>'.dol_escape_htmltag($activity['project_name']).'</small></td>';
		print '<td class="mjl-activity-list-money" data-label="Montant autorisé">'.dol_escape_htmltag(mjl_format_money($amount)).'<small>'.$amountKind.'</small></td>';
		print '<td class="mjl-activity-list-money" data-label="Montant dépensé">'.dol_escape_htmltag(mjl_format_money($activity['total_spent_amount'])).'<small>'.(int)$activity['explicit_spent_count'].' / '.(int)$activity['operation_count'].' Opérations renseignées</small>'.mjl_ui_status_badge(mjl_ui_completeness_status($activity['completeness'])).'</td>';
		print '<td data-label="Fiche"><a class="mjl-action mjl-action-secondary" href="'.dol_escape_htmltag($url).'">Ouvrir</a></td></tr>';
		print '<tr class="mjl-activity-list-expansion"><td colspan="7"><details><summary>Voir les Opérations ('.count($operations).') de '.dol_escape_htmltag($activity['ref']).'</summary>';
		if (!$operations) print '<p>Aucune Opération enregistrée.</p>';
		else {
			print '<div class="mjl-activity-operations-scroll"><table class="mjl-activity-operations-table mjl-data-table"><thead><tr><th scope="col">Opération / Type</th><th scope="col">Autorisé</th><th scope="col">Dépensé</th><th scope="col">Écart</th><th scope="col">Variance</th><th scope="col">État</th><th scope="col">Observation</th><th scope="col">Fiche</th></tr></thead><tbody>';
			foreach ($operations as $operation) {
				$spent=$operation['spent_amount'] ?? null;
				$operationUrl=mjl_activity_monitoring_url('operations.php',array('activity_id'=>$id)).'#operation-'.(int)$operation['rowid'];
				$consultation=mjl_operation_consultation_link($operation,array('href'=>$operationUrl,'activity_href'=>$url,'activity_label'=>$activity['name'],'authorization_label'=>$validated?'Montant autorisé validé':'Montant proposé','can_execute'=>!empty($activity['execution_allowed'])&&!in_array($operation['status'],array('COMPLETED','CANCELLED'),true)));
				print '<tr><td><strong>'.dol_escape_htmltag($operation['name']).'</strong><small>'.dol_escape_htmltag($operation['type_label']).'</small></td><td>'.dol_escape_htmltag(mjl_format_money($operation['authorized_amount'])).'</td><td>'.dol_escape_htmltag(mjl_format_money($spent)).'</td><td>'.dol_escape_htmltag(mjl_execution_variance_amount($spent,$operation['authorized_amount'])).'</td><td>'.dol_escape_htmltag(mjl_execution_variance_percent($spent,$operation['authorized_amount'])).'</td><td>'.mjl_ui_status_badge(mjl_ui_operation_status($operation['status'])).'</td><td class="mjl-activity-observation">'.htmlspecialchars($operation['observation']===null||$operation['observation']===''?'Aucune':$operation['observation'],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').'</td><td>'.$consultation.'</td></tr>';
			}
			print '</tbody></table></div>';
		}
		print '</details></td></tr>';
	}
	print '</tbody></table></div></section>'.mjl_operation_consultation_drawer();
	mjl_activity_monitoring_pagination($filters,$count);
}

function mjl_activity_render_list(array $view)
{
	$filters=$view['filters'];
	if ($view['mode'] === 'target') {
		$rows = $view['rows'];
		$options = array('description'=>'Montants cumulés courants et suivi dans votre périmètre d’accès.','context'=>array('label'=>'Rôle','value'=>mjl_scope_role_label($view['role'])));
		if ($view['can_create']) $options['primary_action']=array('label'=>'Créer une Activité','href'=>mjl_activity_monitoring_url('activities.php',array('action'=>'create')));
		print mjl_page_header_render('Activités',$options);
		if ($view['choices']===null) print mjl_ui_system_state('unavailable','Filtres indisponibles','Les références ne peuvent pas être chargées.');
		else mjl_activity_monitoring_filter_form($filters,$view['choices']);
		print '<p>Calcul au '.dol_escape_htmltag(mjl_format_date($view['date'])).' (Africa/Porto-Novo). Actualisé le '.dol_escape_htmltag($view['updated_at']).' UTC. Périmètre : '.($view['role']==='AGENT_SAISIE'?'Activités actuellement affectées':'portefeuille de l’entité active').'. Période : '.($filters['date_from']==='' && $filters['date_to']===''?'toutes les dates':dol_escape_htmltag(($filters['date_from']?:'sans début').' au '.($filters['date_to']?:'sans fin'))).'. La sélection retient les Activités dont les dates chevauchent la période.</p>';
		if ($view['report_available']) print '<p><a class="mjl-action mjl-action-secondary" href="'.dol_escape_htmltag(mjl_activity_monitoring_url('reports.php',$filters,array('page'=>1))).'">Suivi des Activités et téléchargements</a></p>';
		mjl_monitoring_activity_list($rows,$filters);
		return;
	}
	$rows=$view['rows'];$hasNext=count($rows)>50;$rows=array_slice($rows, 0, 50);
	$options=array('description'=>'Planifier et suivre les Activités de l’entité active.');if($view['can_create'])$options['primary_action']=array('label'=>'Créer une Activité','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?action=create');
	print mjl_page_header_render('Activités',$options).'<section class="mjl-workspace-section"><form class="mjl-table-filters mjl-activity-filters" method="GET" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php"><label for="activity-q">Recherche</label><input id="activity-q" name="q" maxlength="100" value="'.dol_escape_htmltag($filters['q']).'"><label for="activity-status">Statut</label><select id="activity-status" name="status"><option value="">Tous les statuts</option>';
	foreach(array('DRAFT','ABANDONED','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED') as$status){$label=mjl_ui_activity_status($status);print '<option value="'.$status.'"'.($filters['status']===$status?' selected':'').'>'.dol_escape_htmltag($label['label']).'</option>';}
	print '</select><label for="activity-project">Projet</label><input id="activity-project" name="project_id" inputmode="numeric" pattern="[1-9][0-9]*" value="'.dol_escape_htmltag($filters['project_id']).'"><button class="button" type="submit">Filtrer</button></form>';
	if ($view['report_available']) {
		$reportFilters=array('q'=>$filters['q'],'validation_status'=>$filters['status'],'project_id'=>$filters['project_id']);
		print '<p><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?'.dol_escape_htmltag(http_build_query($reportFilters)).'">Suivi des Activités et téléchargements</a></p>';
	}
	if(!$rows)print mjl_ui_system_state('initial-empty','Aucune Activité','Aucune Activité n’est enregistrée dans l’entité active.');
	else{print '<div class="div-table-responsive-no-min"><table class="noborder centpercent mjl-responsive-table"><thead><tr class="liste_titre"><th>Référence</th><th>Activité</th><th>Projet</th><th>Statut</th></tr></thead><tbody>';foreach($rows as$row){$url=DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row->rowid;$status=mjl_ui_activity_status($row->validation_status);print '<tr class="oddeven"><td data-label="Référence"><a href="'.$url.'">'.dol_escape_htmltag($row->ref).'</a></td><td data-label="Activité">'.dol_escape_htmltag($row->name).'</td><td data-label="Projet">'.dol_escape_htmltag(trim($row->project_ref.' - '.$row->project_title)).'</td><td data-label="Statut">'.mjl_ui_status_badge($status).'</td></tr>';}print '</tbody></table></div>';}
	if($filters['page']>1||$hasNext){print '<nav class="mjl-pagination" aria-label="Pagination des Activités">';if($filters['page']>1)print '<a class="mjl-action mjl-action-secondary" rel="prev" href="'.dol_escape_htmltag(mjl_activity_list_url($filters,$filters['page']-1)).'">Précédent</a>';if($hasNext)print '<a class="mjl-action mjl-action-secondary" rel="next" href="'.dol_escape_htmltag(mjl_activity_list_url($filters,$filters['page']+1)).'">Suivant</a>';print '</nav>';}
	print '</section>';
}

function mjl_activity_render_form(array $view)
{
	$row=$view['row'];$prepared=$view['prepared'];$recovery=$view['recovery'];$effects=$view['effects'];$create=!$row;$id=$create?0:(int)$row['rowid'];
	if(!empty($prepared['read_error'])){print mjl_page_header_render($create?'Créer une Activité':'Modifier '.$row['ref']).mjl_ui_system_state('unavailable','Formulaire indisponible','Les références nécessaires ne peuvent pas être chargées.');return;}
	foreach(array('name','description','date_start','date_end','authorized_amount') as$field)if(array_key_exists($field,$recovery))$row[$field==='authorized_amount'?'draft_authorized_amount':$field]=$recovery[$field];$ops=$prepared['operations'];
	print mjl_page_header_render($create?'Créer une Activité':'Modifier '.$row['ref'],array('breadcrumb'=>array(array('label'=>'Activités','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),array('label'=>$create?'Créer une Activité':'Modifier '.$row['ref'])),'description'=>'Planifiez l’Activité et répartissez son montant autorisé entre les Opérations.'));
	print '<form class="mjl-activity-form mjl-planning-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'.($id?'?id='.$id:'').'">';
	print mjl_activity_hidden($effects,'primary',$create?'create_draft':'save_structure',$id,0,$create?0:(int)$row['version']);
	if($recovery)print '<p class="mjl-form-recovery-note" role="status">Une partie de votre saisie a été reprise. Vérifiez le Partenaire, le Projet, les types d’Opération et les lignes avant de renvoyer le formulaire.</p>';
	print '<div class="mjl-activity-form-main">';
	print '<fieldset class="mjl-activity-form-section"><legend>1. Informations générales</legend><div class="mjl-activity-fields"><div class="mjl-form-field"><label for="activity-partner">Partenaire <span aria-hidden="true">*</span></label><select id="activity-partner" data-mjl-select name="partner_id" required>'.mjl_activity_options_html($prepared['partners'],$row['fk_partner']??0).'</select></div><div class="mjl-form-field"><label for="activity-project">Projet <span aria-hidden="true">*</span></label><select id="activity-project" data-mjl-select name="project_id" required>'.mjl_activity_options_html($prepared['projects'],$row['fk_project']??0,true).'</select><p class="mjl-field-description">Choisissez un Projet du Partenaire sélectionné.</p></div><div class="mjl-form-field mjl-activity-field-wide"><label for="activity-name">Nom de l’Activité <span aria-hidden="true">*</span></label><input id="activity-name" name="name" maxlength="255" required value="'.dol_escape_htmltag($row['name']??'').'"></div><div class="mjl-form-field mjl-activity-field-wide"><label for="activity-description">Description <span aria-hidden="true">*</span></label><textarea id="activity-description" name="description" maxlength="4000" required>'.dol_escape_htmltag($row['description']??'').'</textarea></div></div>'.($create?'<p class="mjl-field-description">L’Agent qui crée l’Activité devient l’Agent principal.</p>':'').'</fieldset>';
	print '<fieldset class="mjl-activity-form-section"><legend>2. Planification</legend><div class="mjl-activity-fields"><div class="mjl-form-field"><label for="activity-start">Date de début <span aria-hidden="true">*</span></label><input id="activity-start" data-mjl-date type="date" name="date_start" required value="'.dol_escape_htmltag($row['date_start']??'').'"></div><div class="mjl-form-field"><label for="activity-end">Date de fin incluse <span aria-hidden="true">*</span></label><input id="activity-end" data-mjl-date type="date" name="date_end" required value="'.dol_escape_htmltag($row['date_end']??'').'"></div><div class="mjl-form-field mjl-activity-field-wide"><label for="activity-amount">Montant autorisé proposé (F CFA) <span aria-hidden="true">*</span></label><input id="activity-amount" inputmode="numeric" pattern="[0-9]+" name="authorized_amount" required value="'.dol_escape_htmltag($row['draft_authorized_amount']??'').'"><p class="mjl-field-description">Saisissez un montant entier, sans séparateur.</p></div></div></fieldset>';
	print '<fieldset class="mjl-activity-form-section"><legend>3. Opérations</legend><p class="mjl-field-description">Répartissez le montant proposé entre les Opérations. Aucun montant dépensé n’est saisi ici.</p><div id="activity-operations" data-operation-list>';foreach($ops as$i=>$op)mjl_activity_render_operation_row($op,$i,$prepared['types'][$i]??array());print '</div><button class="button button-secondary" type="button" data-add-operation>Ajouter une Opération</button><p class="mjl-field-description">50 Opérations au maximum.</p></fieldset></div>';
	print '<aside class="mjl-activity-budget" aria-labelledby="activity-budget-heading"><h2 id="activity-budget-heading">Vérification budgétaire</h2><dl class="mjl-activity-totals" aria-live="polite"><div><dt>Activité</dt><dd data-activity-total>Non renseigné</dd></div><div><dt>Total des Opérations</dt><dd data-operation-total>Non renseigné</dd></div><div><dt>Écart à répartir</dt><dd data-difference>Non renseigné</dd></div></dl><p data-budget-guidance>Complétez les montants pour vérifier leur équilibre.</p></aside>';
	print '<div class="mjl-activity-form-actions"><button class="button button-secondary" type="submit">'.($create?'Enregistrer le brouillon':'Enregistrer').'</button>';
	if($create)print '<input type="hidden" name="mjl_submission_create_submit" value="'.dol_escape_htmltag($effects['create_submit']['submission']).'"><button class="button" type="submit" name="action" value="create_submit" data-submit-activity>Soumettre pour prévalidation</button>';
	print '<a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'.($id?'?id='.$id:'').'">Annuler</a></div></form>';
}

function mjl_activity_render_operation_row($op,$index,array $types)
{
	print '<div class="mjl-operation-row" data-operation-row><h3 data-operation-number>Opération '.((int)$index+1).'</h3><input type="hidden" name="operation_key[]" value="op-'.$index.'"><input type="hidden" name="operation_id[]" value="'.dol_escape_htmltag($op['rowid']).'"><input type="hidden" name="operation_version[]" value="'.dol_escape_htmltag($op['version']).'"><label>Nom de l’Opération <input name="operation_name[]" maxlength="255" required value="'.dol_escape_htmltag($op['name']).'"></label><label>Type <select data-mjl-select name="operation_type_id[]" required>'.mjl_activity_options_html($types,$op['fk_operation_type']).'</select></label><label>Montant autorisé (F CFA) <input name="operation_amount[]" inputmode="numeric" pattern="[0-9]+" required value="'.dol_escape_htmltag($op['authorized_amount']).'"></label><button type="button" class="button button-secondary" data-remove-operation>Retirer</button></div>';
}

function mjl_activity_render_detail(array $view)
{
	$row=$view['row'];$prepared=$view['prepared'];$effects=$view['effects'];$timeline=$view['timeline'];$role=$view['role'];
	if(!empty($prepared['detail_error'])||!empty($prepared['read_error'])){print mjl_page_header_render($row['ref']).mjl_ui_system_state('unavailable','Activité indisponible','Les données et autorisations ne peuvent pas être chargées.');return;}
	$monitoring=$prepared['monitoring'];$row=$prepared['row'];$operations=$prepared['operations'];$summary=$prepared['summary'];$assignments=$prepared['assignments'];
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
	$canEdit=$prepared['flags']['edit'];
	if($canEdit)$options['primary_action']=array('label'=>'Modifier','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.$id.'&action=edit');
	$reviewEligibility=$prepared['eligibility'];
	if($reviewEligibility['allowed'])$options['primary_action']=array('label'=>'Examiner la révision','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.$id.'&action=review');
	if($prepared['report_available'])$options['secondary_actions']=array(array('label'=>'Fiche et téléchargements','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report=activity_detail&activity_id='.$id));
	print mjl_page_header_render($row['ref'].' - '.$row['name'],$options);

	$primaryAssignment=null;
	foreach($assignments as$assignment)if(!empty($assignment['is_primary'])){$primaryAssignment=$assignment;break;}
	$assignmentName=function($assignment){$name=trim(($assignment['firstname']??'').' '.($assignment['lastname']??''));return $name!==''?$name:($assignment['login']??'Agent');};
	print '<div class="mjl-activity-statusline">'.mjl_ui_status_badge($status).mjl_ui_status_badge($execution).'<span class="mjl-activity-fact">Révision '.(!empty($row['revision_number'])?(int)$row['revision_number']:'non soumise').'</span><span class="mjl-activity-fact">'.dol_escape_htmltag(mjl_format_date($row['date_start']).' au '.mjl_format_date($row['date_end'])).'</span>';
	if($primaryAssignment)print '<span class="mjl-activity-fact">Agent principal : '.dol_escape_htmltag($assignmentName($primaryAssignment)).'</span>';
	print '</div>';
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
	$canAssign=$prepared['flags']['assign'];
	if($canAssign)print '<a class="mjl-action mjl-action-secondary" href="#mjl-assignment-dialog" data-mjl-dialog-open="mjl-assignment-dialog">Gérer les affectations</a>';
	print '</div>';
	if(!$assignments)print '<p>Aucune affectation courante.</p>';else{print '<ul class="mjl-assignment-list">';foreach($assignments as$assignment)print '<li><span class="mjl-assignment-avatar" aria-hidden="true">'.dol_escape_htmltag(mb_strtoupper(mb_substr($assignmentName($assignment),0,1))).'</span><span><strong>'.dol_escape_htmltag($assignmentName($assignment)).'</strong><small>'.(!empty($assignment['is_primary'])?'Coordination principale':'Agent additionnel').'</small></span></li>';print '</ul>';}
	print '</article></div></section>';

	$executionAction=$monitoring&&!empty($row['monitoring_actions']['execution'])?'Saisir l’exécution':'Consulter les Opérations';
	print '<section class="mjl-activity-tab-panel" id="mjl-activity-operations" data-mjl-tab-panel><article class="mjl-activity-panel"><div class="mjl-section-heading"><div><h2>Opérations</h2><p>'.count($operations).' Opération(s) · '.dol_escape_htmltag(mjl_format_money($authorized)).'</p></div><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/operations.php'.($monitoring?'?activity_id='.$id:'').'">'.$executionAction.'</a></div><div class="mjl-activity-operations-scroll"><table class="mjl-activity-operations-table"><thead><tr><th>Opération</th><th>Type</th><th>Autorisé</th><th>Dépensé</th><th>Écart</th><th>Statut</th><th>Fiche</th></tr></thead><tbody>';
	foreach($operations as$operation){$operationVariance=mjl_monitoring_variance($operation['spent_amount']??null,$operation['authorized_amount']);$operationHref=DOL_URL_ROOT.'/custom/mjlfinancement/operations.php'.($monitoring?'?activity_id='.$id:'').'#operation-'.(int)$operation['rowid'];$consultation=mjl_operation_consultation_link($operation,array('href'=>$operationHref,'activity_href'=>DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.$id,'activity_label'=>$row['name'],'authorization_label'=>$hasValidatedAmount?'Montant autorisé validé':'Montant proposé','can_execute'=>$monitoring&&!empty($row['monitoring_actions']['execution'])&&!in_array($operation['status']??'',array('COMPLETED','CANCELLED'),true)));print '<tr><td data-label="Opération"><strong>'.dol_escape_htmltag($operation['name']).'</strong></td><td data-label="Type">'.dol_escape_htmltag($operation['type_label']).'</td><td data-label="Autorisé">'.dol_escape_htmltag(mjl_format_money($operation['authorized_amount'])).'</td><td data-label="Dépensé">'.dol_escape_htmltag(mjl_format_money($operation['spent_amount']??null)).'</td><td data-label="Écart">'.dol_escape_htmltag(mjl_format_money($operationVariance['difference'])).'</td><td data-label="Statut">'.mjl_ui_status_badge(mjl_ui_operation_status($operation['status']??'TODO')).'</td><td data-label="Fiche">'.$consultation.'</td></tr>';}
	print '</tbody></table></div></article>'.mjl_operation_consultation_drawer().'</section>';

	print '<section class="mjl-activity-tab-panel" id="mjl-activity-decisions" data-mjl-tab-panel><article class="mjl-activity-panel"><h2>Validation et demandes</h2>';
	if(!$reviewEligibility['allowed']&&!empty($row['fk_current_revision'])&&$prepared['flags']['reviewer'])print mjl_ui_system_state('permission','Révision verrouillée',$reviewEligibility['reason']);
	print '<p><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/operationrequests.php">Voir les demandes d’exception</a></p>';
	if($canEdit)print '<form class="mjl-activity-action-form" method="POST" action="?id='.$id.'">'.mjl_activity_hidden($effects,'submit','submit_revision',$id,0,(int)$row['version']).'<button class="button" type="submit">Soumettre la révision</button></form>';
	if($prepared['flags']['abandon'])print '<form class="mjl-activity-action-form" method="POST" action="?id='.$id.'">'.mjl_activity_hidden($effects,'abandon','abandon',$id,0,(int)$row['version']).'<label>Motif d’abandon <textarea name="reason" maxlength="2000" required></textarea></label><button class="button button-secondary" type="submit">Abandonner le brouillon</button></form>';
	if($prepared['flags']['restore'])print '<form class="mjl-activity-action-form" method="POST" action="?id='.$id.'">'.mjl_activity_hidden($effects,'restore','restore',$id,0,(int)$row['version']).'<label>Agent principal <select name="primary_agent_id" required>'.mjl_activity_options_html($prepared['agents'],0).'</select></label><label>Motif de restauration <textarea name="reason" maxlength="2000" required></textarea></label><button class="button" type="submit">Restaurer le brouillon</button></form>';
	$canRequestCancellation=$prepared['flags']['cancel'];
	if($canRequestCancellation){
		$form='<form class="mjl-activity-action-form mjl-exception-form" data-mjl-substantive method="POST" action="?id='.$id.'">'.mjl_activity_hidden($effects,'cancel','request_cancellation',$id,0,(int)$row['version']).'<label>Motif de la demande d’annulation <textarea name="reason" maxlength="2000" required></textarea></label><div class="mjl-dialog-actions"><button class="button button-secondary" type="submit">Demander l’annulation</button></div></form>';
		print mjl_exception_action(array('id'=>'mjl-activity-cancellation-'.$id,'title'=>'Demander l’annulation de l’Activité','context'=>$row['ref'].' - '.$row['name'],'guidance'=>'Les montants autorisés et dépensés restent conservés. Les Opérations terminées restent terminées.','trigger'=>'Demander l’annulation'),$form);
	}
	print '</article></section>';
	if($canRequestCancellation)print mjl_exception_dialog();

	ob_start();
	mjl_activity_render_prepared_timeline($id,$timeline);
	$timeline=ob_get_clean();
	print '<div class="mjl-activity-tab-panel" id="mjl-activity-history" data-mjl-tab-panel>'.$timeline.'</div>';

	if($canAssign){
		$assignmentFlags=array();foreach($assignments as$assignment)$assignmentFlags[(int)$assignment['fk_user']]=array('current'=>true,'primary'=>!empty($assignment['is_primary']));
		print '<dialog class="mjl-modal-dialog mjl-assignment-dialog" id="mjl-assignment-dialog" open aria-labelledby="mjl-assignment-dialog-title" data-mjl-dialog><div class="mjl-dialog-panel"><div class="mjl-section-heading"><div><h2 id="mjl-assignment-dialog-title">Gérer les affectations</h2><p>'.dol_escape_htmltag($row['name']).'</p></div><button class="mjl-action mjl-action-secondary" type="button" data-mjl-dialog-close>Fermer</button></div><p>Chaque enregistrement applique une seule action. Un Agent retiré perd immédiatement l’accès à cette Activité.</p><form class="mjl-activity-action-form" method="POST" action="?id='.$id.'">'.mjl_activity_hidden($effects,'assignment','assignment_change',$id,0,(int)$row['version']).'<label>Opération d’affectation <select name="assignment_operation" data-mjl-assignment-operation><option value="ADD_ADDITIONAL">Ajouter un Agent</option><option value="REMOVE_ADDITIONAL">Retirer un Agent additionnel</option><option value="TRANSFER_PRIMARY">Transférer le rôle principal</option></select></label><label>Agent concerné <select name="target_agent_id" required data-mjl-assignment-target>'.mjl_activity_options_html($prepared['agents'],0,false,$assignmentFlags).'</select></label><label>Motif <textarea name="reason" maxlength="2000" required></textarea></label><div class="mjl-dialog-actions"><button class="button" type="submit">Modifier l’affectation</button></div></form></div></dialog>';
	}
}

function mjl_activity_render_review(array $view)
{
	$row=$view['row'];$prepared=$view['prepared'];$effects=$view['effects'];$timeline=$view['timeline'];
	if(!empty($prepared['read_error'])){print mjl_page_header_render($row['ref']).mjl_ui_system_state('unavailable','Révision indisponible','La révision et ses autorisations ne peuvent pas être chargées.');return;}
	$revision=$prepared['revision'];
	$snapshot=json_decode($revision['snapshot_json'],true);
	if(!is_array($snapshot))$snapshot=array();
	$activity=$snapshot['activity']??array();
	$operations=$snapshot['operations']??array();
	$revisionNumber=(int)$revision['revision_number'];
	$role=$view['role'];
	$eligibility=$prepared['eligibility'];
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

	$history=$prepared['history'];
	print '<section class="mjl-activity-panel" aria-labelledby="mjl-review-history-title"><h2 id="mjl-review-history-title">Historique de la révision '.$revisionNumber.'</h2>';
	if(!$history)print '<p>Aucune décision enregistrée pour cette révision.</p>';else{print '<ol class="mjl-review-timeline">';foreach($history as$decision)print '<li><strong>'.dol_escape_htmltag(mjl_ui_activity_status($decision['decision_type'])['label']).'</strong><br><span>'.dol_escape_htmltag($decision['actor_name_snapshot'].' · '.mjl_format_date($decision['date_decision'],'datetime')).'</span>'.($decision['reason']?'<br>'.nl2br(htmlspecialchars($decision['reason'],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'),false):'').'</li>';print '</ol>';}
	print '</section></div>';

	print '<aside class="mjl-review-decision" aria-labelledby="mjl-review-decision-title"><section class="mjl-activity-panel"><h2 id="mjl-review-decision-title">Décision</h2>';
	if(!$eligibility['allowed']){
		print mjl_ui_system_state('permission','Décision indisponible',$eligibility['reason']);
	}else{
		$approvalDecision=$role==='AGENT_VERIFICATEUR'?'PREVALIDATED':'FINAL_VALIDATED';
		$approvalLabel=$role==='AGENT_VERIFICATEUR'?'Prévalider':'Valider définitivement';
		print '<p class="mjl-review-guidance">'.($role==='AGENT_VERIFICATEUR'?'Confirmez que la structure et le budget soumis peuvent passer à la validation définitive.':'Confirmez la même révision prévalidée pour terminer le cycle de validation.').'</p>';
		print '<form class="mjl-review-form" method="POST" action="?id='.(int)$row['rowid'].'">'.mjl_activity_hidden($effects,'approve','review_revision',(int)$row['rowid'],(int)$revision['rowid'],(int)$row['version']).'<input type="hidden" name="decision" value="'.$approvalDecision.'"><button class="button" type="submit">'.$approvalLabel.'</button></form>';
		if(!isset($eligibility['return_allowed'])||$eligibility['return_allowed']){
			$returnDecision=$role==='AGENT_VERIFICATEUR'?'RETURNED_SUPERVISOR':'RETURNED_VALIDATOR';
			print '<a class="mjl-action mjl-action-secondary" href="#mjl-correction-dialog" data-mjl-dialog-open="mjl-correction-dialog">Retourner en correction</a>';
			print '<dialog class="mjl-modal-dialog mjl-review-dialog" id="mjl-correction-dialog" open aria-labelledby="mjl-correction-dialog-title" data-mjl-dialog><div class="mjl-dialog-panel"><div class="mjl-section-heading"><div><h2 id="mjl-correction-dialog-title">Retourner en correction</h2><p>Révision '.$revisionNumber.' - '.dol_escape_htmltag($row['name']).'</p></div><button class="mjl-action mjl-action-secondary" type="button" data-mjl-dialog-close>Fermer</button></div><p>Le retour crée une étape de correction pour les Agents affectés. Une nouvelle soumission produira une nouvelle révision et un nouveau cycle de revue.</p><form class="mjl-review-form" method="POST" action="?id='.(int)$row['rowid'].'">'.mjl_activity_hidden($effects,'return','review_revision',(int)$row['rowid'],(int)$revision['rowid'],(int)$row['version']).'<input type="hidden" name="decision" value="'.$returnDecision.'"><label>Motif de correction <textarea name="reason" maxlength="2000" required></textarea></label>'.($returnDecision==='RETURNED_VALIDATOR'?'<label>Montant demandé (facultatif) <input name="requested_amount" inputmode="numeric" pattern="[0-9]+"></label>':'').'<div class="mjl-dialog-actions"><button class="button button-secondary" type="submit">Confirmer le retour</button></div></form></div></dialog>';
		}
	}
	print '</section></aside></div>';
	mjl_activity_render_prepared_timeline((int)$row['rowid'],$timeline);
}

function mjl_activity_render_prepared_timeline($activityId,array $timeline)
{
	$events=$timeline['events'];$cursor=(string)$timeline['cursor'];$action=(string)$timeline['action'];
	$escape=function($text){return htmlspecialchars((string)$text,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');};
	print '<section class="mjl-workspace-section" aria-labelledby="mjl-activity-chronology"><h2 id="mjl-activity-chronology">Chronologie</h2>';
	if($events===false)print '<p>La chronologie est temporairement indisponible.</p>';
	elseif(!$events)print '<p>Aucun événement enregistré.</p>';
	else{print '<ol class="mjl-review-timeline">';foreach(array_slice($events,0,50)as$event)print '<li data-event-id="'.$event['rowid'].'"><strong>'.$escape($event['title']).'</strong><br><span>'.$escape($event['actor'].' · '.$event['role'].' · '.$event['date']).'</span>'.($event['detail']!==''?'<br>'.nl2br($escape($event['detail']),false):'').'</li>';print '</ol>';}
	$query=array('id'=>(int)$activityId);if($action==='review')$query['action']='review';$url=DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?';
	if($cursor!==''||(is_array($events)&&count($events)>50)){print '<nav aria-label="Pagination de la chronologie">';if($cursor!=='')print '<a href="'.$escape($url.http_build_query($query)).'#mjl-activity-chronology">Première page</a> ';if(is_array($events)&&count($events)>50)print '<a href="'.$escape($url.http_build_query($query+array('chronology_cursor'=>$events[49]['rowid']))).'#mjl-activity-chronology">Suivant</a>';print '</nav>';}
	print '</section>';
}
