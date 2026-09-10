<?php

/** Complete audit has its own authorization and cursor-based preview. */
function mjl_audit_report_page()
{
	global $db,$user,$conf;
	if (($_SERVER['REQUEST_METHOD']??'GET')!=='GET') { header('Allow: GET'); mjl_report_http_error(405,'Consultez le journal avec une requête GET.'); }
	$source=$_GET; unset($source['report']);
	try { $filters=mjl_report_validate_request('audit','csv',$source,true); }
	catch (InvalidArgumentException $e) { mjl_report_http_error(400,'Filtres invalides.'); }
	$available=true; $events=array(); $budgets=null; $captured=gmdate('Y-m-d H:i:s'); $deadline=hrtime(true)+30000000000;
	try {
		$reader=new MjlMonitoring($db,$user,(int)$conf->entity);
		$budgets=$reader->rows('SELECT @@session.max_statement_time AS statement_time,@@session.innodb_lock_wait_timeout AS row_wait,@@session.lock_wait_timeout AS metadata_wait')[0];
		if (!$db->query('SET SESSION max_statement_time=5,innodb_lock_wait_timeout=2,lock_wait_timeout=2')) throw new RuntimeException('READ_FAILED');
		mjl_rst012_require_target($db);
		if (!$db->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ') || !$db->begin('mjl audit preview')) throw new RuntimeException('READ_FAILED');
		$events=$reader->audit($filters); mjl_report_checkpoint($deadline);
		if (!$db->commit('mjl audit preview')) throw new RuntimeException('READ_FAILED');
	} catch (Throwable $e) { if ($db->transaction_opened>0) $db->rollback(); $available=false; http_response_code(503); }
	finally { if ($budgets!==null && !$db->query('SET SESSION max_statement_time='.(float)$budgets['statement_time'].',innodb_lock_wait_timeout='.(int)$budgets['row_wait'].',lock_wait_timeout='.(int)$budgets['metadata_wait'])) { $available=false; http_response_code(503); } }
	llxHeader('','Journal d’audit'); mjl_navigation_shell_start($user); print '<div class="mjl-workspace">';
	print mjl_page_header_render('Journal d’audit',array('description'=>'Événements immuables de l’entité active. Les noms et références sont ceux enregistrés dans l’historique.','breadcrumb'=>array(array('label'=>'Contrôle'))));
	print '<section class="mjl-workspace-section"><h2>Sélection</h2><form class="mjl-activity-form" method="GET" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php"><input type="hidden" name="report" value="audit"><div class="mjl-form-grid">';
	$fields=array('q'=>'Référence ou nom historique de l’acteur','event_id'=>'Identifiant événement','object_type'=>'Type d’objet','object_id'=>'Identifiant objet','activity_id'=>'Identifiant Activité','operation_id'=>'Identifiant Opération','revision_id'=>'Identifiant révision','target_version'=>'Version cible','actor_id'=>'Identifiant acteur','audit_action'=>'Code action','date_from'=>'Événements à partir du','date_to'=>'Événements jusqu’au');
	foreach ($fields as $key=>$label) print '<label for="audit-'.$key.'">'.$label.'</label><input id="audit-'.$key.'" name="'.$key.'" type="'.(in_array($key,array('date_from','date_to'),true)?'date':'text').'" maxlength="100" value="'.dol_escape_htmltag($filters[$key]).'">';
	foreach (array('result'=>array('Résultat',array(''=>'Tous','SUCCESS'=>'Réussite','DENIED'=>'Refus','FAILED'=>'Échec')),'direction'=>array('Ordre',array('desc'=>'Plus récents en premier','asc'=>'Plus anciens en premier'))) as $key=>$definition) {
		print '<label for="audit-'.$key.'">'.$definition[0].'</label><select id="audit-'.$key.'" name="'.$key.'">';
		foreach ($definition[1] as $value=>$label) print '<option value="'.$value.'"'.($filters[$key]===$value?' selected':'').'>'.$label.'</option>';
		print '</select>';
	}
	print '</div><button class="butAction" type="submit">Appliquer les filtres</button> <a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report=audit">Réinitialiser</a></form><p>La période porte sur les dates des événements, bornes incluses. Les filtres utilisent les identifiants et valeurs historiques, sans dépendre de références ou de comptes encore actifs.</p></section>';
	if (!$available) print mjl_ui_system_state('unavailable','Journal indisponible','Les événements ne peuvent pas être chargés. Aucun téléchargement n’est disponible.');
	else {
		print '<section class="mjl-workspace-section"><h2>Téléchargement</h2><p>L’export inclut tous les événements correspondant aux filtres, indépendamment de la page. Il exclut son propre événement de génération. Une sélection contenant des détails non représentables est refusée.</p>';
		$downloadFilters=$filters; $downloadFilters['cursor']=''; mjl_report_download_form('audit',$downloadFilters,$captured); print '</section>';
		if (!$events) print mjl_ui_system_state('filtered-empty','Aucun événement','Aucun événement ne correspond aux filtres.');
		$shown=array_slice($events,0,50); $remaining=10000;
		foreach ($shown as $event) {
			$meta=mjl_audit_report_metadata($event);
			print '<article class="mjl-activity-panel"><h2>Événement '.(int)$event['rowid'].' · '.htmlspecialchars($meta['action_label'],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').'</h2><dl class="mjl-activity-meta">';
			foreach (mjl_audit_report_metadata_columns() as $key=>$column) print '<div><dt>'.$column[0].'</dt><dd>'.htmlspecialchars((string)($meta[$key]??'Non renseigné'),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').'</dd></div>';
			print '</dl>';
			try {
				$changes=mjl_audit_project_event($event,$remaining); $remaining-=count($changes);
				print '<details><summary>Champs et valeurs enregistrés</summary><p>« Non enregistré » signifie que le journal ne contient pas cette valeur ; cela ne prouve pas un effacement.</p>';
				foreach ($changes as $change) {
					print '<dl class="mjl-activity-meta">';
					foreach (mjl_audit_report_change_columns() as $key=>$column) print '<div><dt>'.$column[0].'</dt><dd>'.nl2br(htmlspecialchars((string)$change[$key],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8')).'</dd></div>';
					print '</dl>';
				}
				print '</details>'; unset($changes);
			} catch (Throwable $e) { print '<p role="status">Détails indisponibles : cet événement ne peut pas être représenté dans cet aperçu. Affinez la sélection ; un export contenant des données non représentables sera refusé.</p>'; }
			print '</article>';
		}
		if ($filters['cursor']!=='' || count($events)>50) {
			print '<nav aria-label="Pagination du journal">'; $first=$filters; $first['cursor']='';
			if ($filters['cursor']!=='') print '<a href="?'.dol_escape_htmltag(http_build_query(array_merge($first,array('report'=>'audit')))).'">Première page</a> ';
			if (count($events)>50) { $next=$filters; $next['cursor']=(string)$shown[49]['rowid']; print '<a href="?'.dol_escape_htmltag(http_build_query(array_merge($next,array('report'=>'audit')))).'">Suivant</a>'; }
			print '</nav>';
		}
	}
	print '</div>'; mjl_navigation_shell_end(); llxFooter(); $db->close();
}
