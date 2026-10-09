<?php

	print mjl_page_header_render('Journal d’audit',array('description'=>'Événements immuables de l’entité active. Les noms et références sont ceux enregistrés dans l’historique.','breadcrumb'=>array(array('label'=>'Contrôle'))));
	print mjl_report_ui_tabs('audit',true,$showBusiness);
	$resetUrl=DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report=audit';
	print '<section class="mjl-workspace-section mjl-report-filter-panel" aria-labelledby="mjl-audit-filter-title">'.mjl_report_ui_section_heading('mjl-audit-filter-title','Historique complet','Filtres').'<form class="mjl-report-filter-bar" method="GET" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php"><input type="hidden" name="report" value="audit"><div class="mjl-report-filter-grid">';
	$fields=array('q'=>'Référence ou nom historique de l’acteur','event_id'=>'Identifiant événement','object_type'=>'Type d’objet','object_id'=>'Identifiant objet','activity_id'=>'Identifiant Activité','operation_id'=>'Identifiant Opération','revision_id'=>'Identifiant révision','target_version'=>'Version cible','actor_id'=>'Identifiant acteur','audit_action'=>'Code action','date_from'=>'Événements à partir du','date_to'=>'Événements jusqu’au');
	foreach ($fields as $key=>$label) print '<label for="audit-'.$key.'"><span>'.$label.'</span><input id="audit-'.$key.'" name="'.$key.'" type="'.(in_array($key,array('date_from','date_to'),true)?'date':'text').'" maxlength="100" value="'.dol_escape_htmltag($filters[$key]).'"></label>';
	foreach (array('result'=>array('Résultat',array(''=>'Tous','SUCCESS'=>'Réussite','DENIED'=>'Refus','FAILED'=>'Échec')),'direction'=>array('Ordre',array('desc'=>'Plus récents en premier','asc'=>'Plus anciens en premier'))) as $key=>$definition) {
		print '<label for="audit-'.$key.'"><span>'.$definition[0].'</span><select id="audit-'.$key.'" name="'.$key.'">';
		foreach ($definition[1] as $value=>$label) print '<option value="'.$value.'"'.($filters[$key]===$value?' selected':'').'>'.$label.'</option>';
		print '</select></label>';
	}
	print '</div>'.mjl_report_ui_filter_actions($resetUrl).'</form>'.mjl_report_ui_active_filters('audit',$filters).'<p class="mjl-report-description">La période porte sur les dates des événements, bornes incluses. Les filtres utilisent les identifiants et valeurs historiques, sans dépendre de références ou de comptes encore actifs.</p></section>';
	if (!$available) print mjl_ui_system_state('unavailable','Journal indisponible','Les événements ne peuvent pas être chargés. Aucun téléchargement n’est disponible.');
	else {
		print '<section class="mjl-workspace-section mjl-report-export-panel" aria-labelledby="mjl-audit-export-title">'.mjl_report_ui_section_heading('mjl-audit-export-title','Preuve auditée','Téléchargement','Sélection complète').'<p class="mjl-report-description">L’export inclut tous les événements correspondant aux filtres, indépendamment de la page. Il exclut son propre événement de génération. Une sélection contenant des détails non représentables est refusée.</p>';
		$downloadFilters=$filters; $downloadFilters['cursor']=''; mjl_report_download_form('audit',$downloadFilters,$captured,$csrfToken); print '</section>';
		if (!$events) print mjl_ui_system_state('filtered-empty','Aucun événement','Aucun événement ne correspond aux filtres.');
		$shown=array_slice($events,0,50); $remaining=10000;
		if ($shown) {
			print '<section class="mjl-workspace-section mjl-audit-history" aria-labelledby="mjl-audit-history-title">'.mjl_report_ui_section_heading('mjl-audit-history-title','Entité active','Chronologie',count($shown).' événement'.(count($shown)>1?'s':'').' affiché'.(count($shown)>1?'s':'')).'<ol class="mjl-review-timeline mjl-audit-timeline">';
			foreach ($shown as $event) mjl_audit_report_event($event,$remaining);
			print '</ol></section>';
		}
		if ($filters['cursor']!=='' || count($events)>50) {
			print '<nav class="mjl-report-pagination" aria-label="Pagination du journal">'; $first=$filters; $first['cursor']='';
			if ($filters['cursor']!=='') print '<a class="mjl-action mjl-action-secondary" href="?'.dol_escape_htmltag(http_build_query(array_merge($first,array('report'=>'audit')))).'">Première page</a> ';
			if (count($events)>50) { $next=$filters; $next['cursor']=(string)$shown[49]['rowid']; print '<a class="mjl-action mjl-action-secondary" href="?'.dol_escape_htmltag(http_build_query(array_merge($next,array('report'=>'audit')))).'">Suivant</a>'; }
			print '</nav>';
		}
	}
