<?php

require_once __DIR__.'/mjl_ui.lib.php';

function mjl_dashboard_profile($role)
{
	$profiles=array(
		'AGENT_SAISIE'=>array(
			'description'=>'Suivez vos Activités affectées, vos actions et les alertes de votre périmètre.',
			'scope_label'=>'Mes Activités',
			'work_label'=>'Mes actions à traiter',
			'work_metric'=>'Actions disponibles',
			'work_hint'=>'Actions actuellement permises pour votre profil.',
		),
		'AGENT_VERIFICATEUR'=>array(
			'description'=>'Prévalidez les révisions accessibles et suivez le portefeuille de l’entité active.',
			'scope_label'=>'Activités du portefeuille',
			'work_label'=>'Prévalidations à traiter',
			'work_metric'=>'Prévalidations accessibles',
			'work_hint'=>'Décisions actuellement permises selon la révision et ses contributeurs.',
		),
		'VALIDATEUR_DEFINITIF'=>array(
			'description'=>'Pilotez les validations définitives, les exceptions et le portefeuille de l’entité active.',
			'scope_label'=>'Activités du portefeuille',
			'work_label'=>'Décisions à traiter',
			'work_metric'=>'Décisions accessibles',
			'work_hint'=>'Validations, exceptions et restaurations actuellement permises.',
		),
	);
	return $profiles[$role]??$profiles['AGENT_SAISIE'];
}

function mjl_dashboard_count_status(array $activities, $field, $status)
{
	$count=0;
	foreach ($activities as $activity) if (($activity[$field]??'')===$status) $count++;
	return $count;
}

function mjl_dashboard_render_kpis(array $activities, $queue, $role, array $filters)
{
	$profile=mjl_dashboard_profile($role);
	$cards=array(
		array('key'=>'scope','label'=>$profile['scope_label'],'value'=>(string)count($activities),'hint'=>$role==='AGENT_SAISIE'?'Périmètre de vos affectations courantes.':'Périmètre de l’entité active.','href'=>mjl_monitoring_url('activities',$filters,array('page'=>1))),
		array('key'=>'work','label'=>$profile['work_metric'],'value'=>$queue===null?'—':(string)count($queue),'hint'=>$queue===null?'Les autorisations ne peuvent pas être chargées.':$profile['work_hint'],'href'=>'#mjl-dashboard-work'),
		array('key'=>'in-progress','label'=>'En cours','value'=>(string)mjl_dashboard_count_status($activities,'execution_status','IN_PROGRESS'),'hint'=>'Activités dont l’exécution est en cours.','href'=>mjl_monitoring_url('activities',$filters,array('execution_status'=>'IN_PROGRESS','page'=>1))),
		array('key'=>'overdue','label'=>'En retard','value'=>(string)mjl_dashboard_count_status($activities,'execution_status','OVERDUE'),'hint'=>'Activités dont la date de fin est dépassée.','href'=>mjl_monitoring_url('activities',$filters,array('execution_status'=>'OVERDUE','page'=>1))),
	);
	print '<section class="mjl-dashboard-kpis" aria-label="Indicateurs du tableau de bord" aria-describedby="mjl-dashboard-kpi-freshness">';
	foreach ($cards as $card) {
		print '<article class="mjl-dashboard-kpi" data-dashboard-kpi="'.mjl_ui_escape($card['key']).'"><div><h2>'.mjl_ui_escape($card['label']).'</h2><strong class="mjl-dashboard-kpi-value">'.mjl_ui_escape($card['value']).'</strong><p>'.mjl_ui_escape($card['hint']).'</p></div><a class="mjl-card-link" href="'.mjl_ui_escape($card['href']).'">Consulter</a></article>';
	}
	print '</section><p class="mjl-dashboard-freshness" id="mjl-dashboard-kpi-freshness">Indicateurs calculés à l’ouverture de cette page selon la sélection et les accès actifs.</p>';
}

function mjl_dashboard_render_execution(array $activities, array $filters)
{
	$statuses=array('NOT_STARTED','UPCOMING','IN_PROGRESS','OVERDUE','COMPLETED','CANCELLED');
	$total=count($activities);
	print '<section class="mjl-dashboard-panel" aria-labelledby="mjl-dashboard-progress-title"><div class="mjl-section-heading"><div><h2 id="mjl-dashboard-progress-title">Avancement des Activités</h2><p>États d’exécution dérivés dans le périmètre courant.</p></div></div>';
	if ($total===0) {
		print mjl_ui_system_state('filtered-empty','Aucune Activité','Aucun avancement ne correspond à la sélection et à vos accès.').'</section>';
		return;
	}
	print '<div class="mjl-dashboard-progress">';
	foreach ($statuses as $status) {
		$count=mjl_dashboard_count_status($activities,'execution_status',$status);
		$presentation=mjl_ui_execution_status($status);
		$href=mjl_monitoring_url('activities',$filters,array('execution_status'=>$status,'page'=>1));
		$label=$presentation['label'].' : '.$count.' sur '.$total.' '.($total===1?'Activité':'Activités');
		print '<div class="mjl-dashboard-progress-row"><div><a class="mjl-card-link" href="'.mjl_ui_escape($href).'">'.mjl_ui_escape($presentation['label']).'</a><strong>'.$count.'</strong></div><progress max="'.$total.'" value="'.$count.'" aria-label="'.mjl_ui_escape($label).'" aria-valuetext="'.mjl_ui_escape($count.' sur '.$total).'">'.$count.' sur '.$total.'</progress></div>';
	}
	print '</div><p class="mjl-dashboard-panel-footnote">'.$total.' '.($total===1?'Activité':'Activités').' dans la sélection.</p></section>';
}

function mjl_dashboard_admin_cards()
{
	$cards=array(
		array('title'=>'Utilisateurs et accès','description'=>'Inviter les utilisateurs et gérer leurs accès MJL.','label'=>'Gérer les utilisateurs','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php'),
		array('title'=>'Historique','description'=>'Consulter les événements techniques et métier autorisés.','label'=>'Consulter l’historique','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/workflowactions.php'),
		array('title'=>'Rapport d’audit','description'=>'Prévisualiser et télécharger les formats audités disponibles.','label'=>'Ouvrir le rapport d’audit','href'=>DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report=audit'),
		array('title'=>'Configuration Dolibarr','description'=>'Accéder à l’administration technique native.','label'=>'Administration technique','href'=>DOL_URL_ROOT.'/admin/modules.php'),
	);
	$html='<section class="mjl-admin-dashboard" aria-labelledby="mjl-admin-dashboard-title"><div class="mjl-section-heading"><div><h2 id="mjl-admin-dashboard-title">Accès rapides</h2><p>Destinations techniques et de gestion déjà autorisées pour votre compte.</p></div></div><div class="mjl-admin-dashboard-grid">';
	foreach ($cards as $card) {
		$html.='<a class="mjl-nav-card" aria-label="'.mjl_ui_escape($card['label']).'" href="'.mjl_ui_escape($card['href']).'"><h3>'.mjl_ui_escape($card['title']).'</h3><span>'.mjl_ui_escape($card['description']).'</span><strong class="mjl-nav-card-action">'.mjl_ui_escape($card['label']).'</strong></a>';
	}
	return $html.'</div></section>';
}
