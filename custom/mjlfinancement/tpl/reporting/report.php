<?php

	print mjl_page_header_render($title,array('description'=>'Montants cumulés courants, dans votre périmètre d’accès.','breadcrumb'=>array(array('label'=>$plural,'href'=>DOL_URL_ROOT.'/custom/mjlfinancement/'.($isOperations?'operations.php':'activities.php')),array('label'=>'Rapport'))));
	print mjl_report_ui_tabs($type,$showAudit);
	if (!$available) print mjl_ui_system_state('unavailable','Rapport indisponible','Les données ne peuvent pas être chargées. Aucun total ni téléchargement n’est disponible.');
	elseif ($isDetail) mjl_report_detail_preview($detail['document'],$filters,$captured,$csrfToken);
	else {
		print '<section class="mjl-workspace-section mjl-report-filter-panel" aria-labelledby="mjl-report-filter-title">'.mjl_report_ui_section_heading('mjl-report-filter-title','Sélection du rapport','Filtres').'<form class="mjl-report-filter-bar" method="GET"><input type="hidden" name="report" value="'.$type.'"><div class="mjl-report-filter-grid">';
		foreach (array('q'=>($isOperations||$isPortfolio)?'Recherche d’Activité':'Recherche','date_from'=>'Période à partir du','date_to'=>'Période jusqu’au') as $key=>$label) print '<label for="report-'.$key.'"><span>'.$label.'</span><input id="report-'.$key.'" name="'.$key.'" type="'.($key==='q'?'search':'date').'" maxlength="100" value="'.dol_escape_htmltag($filters[$key]).'"></label>';
		foreach (array_merge(array('partner_id'=>'Partenaire','project_id'=>'Projet'),$isOperations?array('type_id'=>'Type d’opération'):array()) as $key=>$label) {
			print '<label for="report-'.$key.'"><span>'.$label.'</span><select id="report-'.$key.'" name="'.$key.'"><option value="">Tous</option>';
			if ($filters[$key]!=='' && !in_array($filters[$key],array_map('strval',array_column($choices[$key],'id')),true)) print '<option selected value="'.dol_escape_htmltag($filters[$key]).'">Référence hors sélection</option>';
			foreach ($choices[$key] as $choice) print '<option value="'.(int)$choice['id'].'"'.((string)$choice['id']===$filters[$key]?' selected':'').'>'.dol_escape_htmltag($choice['label']).'</option>';
			print '</select></label>';
		}
		$labels=mjl_monitoring_status_labels();
		foreach (array_merge(array('validation_status'=>array(($isOperations||$isPortfolio)?'État de validation de l’Activité':'État de validation',array('DRAFT','SUBMITTED','PREVALIDATED','RETURNED_SUPERVISOR','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED','ABANDONED')),'execution_status'=>array(($isOperations||$isPortfolio)?'État d’exécution de l’Activité':'État d’exécution',array('NOT_STARTED','UPCOMING','IN_PROGRESS','OVERDUE','COMPLETED','CANCELLED')),'completeness'=>array(($isOperations||$isPortfolio)?'Complétude des dépenses de l’Activité':'Complétude des dépenses',array('NOT_STARTED','PARTIAL','COMPLETE'))),$isOperations?array('operation_status'=>array('État de l’Opération',array('TODO','IN_PROGRESS','COMPLETED','CANCELLED'))):array()) as $key=>$definition) {
			print '<label for="report-'.$key.'"><span>'.$definition[0].'</span><select id="report-'.$key.'" name="'.$key.'"><option value="">Tous</option>';
			foreach ($definition[1] as $value) print '<option value="'.$value.'"'.($value===$filters[$key]?' selected':'').'>'.dol_escape_htmltag($key==='completeness' && $value==='NOT_STARTED'?'Non renseignée':$labels[$value]).'</option>';
			print '</select></label>';
		}
		if ($isPortfolio) {
			print '<label for="report-grouping"><span>Regrouper par</span><select id="report-grouping" name="grouping">';
			foreach (array('project'=>'Projet','partner'=>'Partenaire') as $key=>$label) print '<option value="'.$key.'"'.($filters['grouping']===$key?' selected':'').'>'.$label.'</option>';
			print '</select></label>';
		}
		print '</div>';
		if ($filters['activity_id']!=='') print '<input type="hidden" name="activity_id" value="'.dol_escape_htmltag($filters['activity_id']).'">';
		print mjl_report_ui_filter_actions($resetUrl).'</form>'.mjl_report_ui_active_filters($type,$filters,$choices).'<p class="mjl-report-description">La période inclut les Activités dont les dates courantes chevauchent l’intervalle choisi. Les références inactives déjà utilisées restent sélectionnables.</p></section>';
		if ($isOperations) print '<p>Les filtres de type et d’état d’Opération réduisent les lignes affichées, sans recalculer la complétude de l’Activité parente. Écart = dépensé − autorisé ; variation = écart / autorisé, non renseignée si le montant dépensé manque ou si le montant autorisé vaut zéro.</p>';
		if ($isPortfolio) print '<p>Chaque Activité sélectionnée contribue une seule fois à son groupe. Les dépenses renseignées sont additionnées ; les compteurs signalent les montants manquants. Une annulation conserve les montants validés antérieurs.</p>';
		print '<section class="mjl-workspace-section mjl-report-export-panel" aria-labelledby="mjl-report-export-title">'.mjl_report_ui_section_heading('mjl-report-export-title','Formats officiels','Téléchargement',count($rows).' '.($isPortfolio?'groupe(s)':$singular.'(s)')).'<p class="mjl-report-description">L’export inclut toutes les pages de la sélection courante.</p>';
		mjl_report_download_form($type,$filters,$captured,$csrfToken);
		print '</section><section class="mjl-workspace-section"><h2>'.($isPortfolio?'Groupes sélectionnés':$plural.' sélectionnées').'</h2>';
		if (!$rows) print mjl_ui_system_state('filtered-empty',$isPortfolio?'Aucun groupe':'Aucune '.$singular,'Aucune Activité ne correspond à vos filtres et à vos accès.');
		$page=(int)$filters['page'];
		foreach (array_slice($rows,($page-1)*50,50) as $row) {
			if ($isPortfolio) { print mjl_report_portfolio_preview_row($row,$filters['grouping']); continue; }
			if ($isOperations) { print mjl_report_operation_preview_row($row); continue; }
			print '<article class="mjl-activity-panel"><h3><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row['rowid'].'">'.dol_escape_htmltag($row['name']).'</a></h3><p>'.dol_escape_htmltag($row['ref'].' · '.$row['partner_name'].' · '.$row['project_name']).'</p><p>'.dol_escape_htmltag($row['validation_label'].' · '.$row['execution_label'].' · Dépenses : '.$row['completeness_label']).'</p><dl class="mjl-activity-meta">';
			foreach (array('initial_amount','pending_amount','validated_amount','total_spent_amount') as $key) print '<div><dt>'.dol_escape_htmltag(mjl_monitoring_labels()[$key]).'</dt><dd>'.dol_escape_htmltag(mjl_format_money($row[$key])).'</dd></div>';
			print '</dl></article>';
		}
		if ($page>1 || count($rows)>$page*50) {
			print '<nav aria-label="Pagination du rapport">';
			foreach (array(-1=>'Précédent',1=>'Suivant') as $offset=>$label) if (($offset<0 && $page>1)||($offset>0 && count($rows)>$page*50)) print '<a href="?'.dol_escape_htmltag(http_build_query(array_merge($filters,array('report'=>$type,'page'=>$page+$offset)))).'">'.$label.'</a> ';
			print '</nav>';
		}
		print '</section>';
	}
