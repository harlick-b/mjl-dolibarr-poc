<?php

require_once __DIR__.'/mjl_ui.lib.php';

/** Presentation-only navigation shared by business reports and the complete audit. */
function mjl_report_ui_tabs($active,$showAudit,$showBusiness=true)
{
	$html='<nav class="mjl-tabs mjl-report-tabs" aria-label="Type de rapport">';
	if ($showBusiness) foreach (array('activities'=>'Activités','operations'=>'Opérations','portfolio'=>'Portefeuille') as $key=>$label) {
		$html.='<a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report='.$key.'"'.($active===$key?' class="mjl-tab-active" aria-current="page"':'').'>'.$label.'</a>';
	}
	if ($showAudit) $html.='<a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php?report=audit"'.($active==='audit'?' class="mjl-tab-active" aria-current="page"':'').'>Journal d’audit</a>';
	return $html.'</nav>';
}

function mjl_report_ui_choice_label($value,array $choices)
{
	foreach ($choices as $choice) if ((string)($choice['id']??'')===(string)$value) return (string)($choice['label']??$value);
	return 'Référence '.(string)$value;
}

/** Values have already passed the report validator; this function only makes the active selection visible. */
function mjl_report_ui_active_filter_items($type,array $filters,array $choices=array())
{
	$items=array();
	$add=function($key,$label,$value=null) use (&$items,$filters) {
		$current=$filters[$key]??'';
		if ($current==='') return;
		$items[]=array('label'=>$label,'value'=>$value===null?(string)$current:(string)$value);
	};
	$add('q','Recherche');
	foreach (array('date_from'=>'Période à partir du','date_to'=>'Période jusqu’au') as $key=>$label) if (($filters[$key]??'')!=='') $add($key,$label,mjl_format_date($filters[$key]));
	if ($type==='audit') {
		foreach (array('event_id'=>'Événement','object_type'=>'Type d’objet','object_id'=>'Objet','activity_id'=>'Activité','operation_id'=>'Opération','revision_id'=>'Révision','target_version'=>'Version cible','actor_id'=>'Acteur','audit_action'=>'Action') as $key=>$label) $add($key,$label);
		if (($filters['result']??'')!=='') $add('result','Résultat',array('SUCCESS'=>'Réussite','DENIED'=>'Refus','FAILED'=>'Échec')[$filters['result']]??$filters['result']);
		if (($filters['direction']??'desc')!=='desc') $add('direction','Ordre','Plus anciens en premier');
		return $items;
	}
	foreach (array('partner_id'=>'Partenaire','project_id'=>'Projet','type_id'=>'Type d’Opération') as $key=>$label) if (($filters[$key]??'')!=='') $add($key,$label,mjl_report_ui_choice_label($filters[$key],$choices[$key]??array()));
	$labels=mjl_report_status_labels();
	foreach (array('validation_status'=>'État de validation','execution_status'=>'État d’exécution','operation_status'=>'État de l’Opération') as $key=>$label) if (($filters[$key]??'')!=='') $add($key,$label,$labels[$filters[$key]]??$filters[$key]);
	if (($filters['completeness']??'')!=='') $add('completeness','Complétude des dépenses',($filters['completeness']==='NOT_STARTED'?'Non renseignée':($labels[$filters['completeness']]??$filters['completeness'])));
	if (($filters['activity_id']??'')!=='') $add('activity_id','Activité','N° '.$filters['activity_id']);
	if ($type==='portfolio' && ($filters['grouping']??'project')!=='project') $add('grouping','Regroupement','Partenaire');
	return $items;
}

function mjl_report_ui_active_filters($type,array $filters,array $choices=array())
{
	$items=mjl_report_ui_active_filter_items($type,$filters,$choices);
	$count=count($items);
	$html='<aside class="mjl-report-active-filters" data-active-filter-count="'.$count.'" aria-label="Filtres actifs"><strong>'.($count===0?'Aucun filtre actif':$count.' filtre'.($count>1?'s':'').' actif'.($count>1?'s':'')).'</strong>';
	if ($items) {
		$html.='<ul>';
		foreach ($items as $item) $html.='<li><span>'.mjl_ui_escape($item['label']).'</span> : '.mjl_ui_escape($item['value']).'</li>';
		$html.='</ul>';
	} else $html.='<span>La sélection couvre tout votre périmètre autorisé.</span>';
	return $html.'</aside>';
}

function mjl_report_ui_section_heading($id,$eyebrow,$title,$summary='')
{
	$html='<div class="mjl-section-heading mjl-report-section-heading"><div><p class="mjl-eyebrow">'.mjl_ui_escape($eyebrow).'</p><h2 id="'.mjl_ui_escape($id).'">'.mjl_ui_escape($title).'</h2></div>';
	if ($summary!=='') $html.='<strong class="mjl-report-selection-count">'.mjl_ui_escape($summary).'</strong>';
	return $html.'</div>';
}

function mjl_report_ui_filter_actions($resetUrl)
{
	return '<div class="mjl-report-filter-actions"><button class="mjl-action" type="submit">Appliquer les filtres</button><a class="mjl-action mjl-action-secondary" href="'.mjl_ui_escape($resetUrl).'">Réinitialiser</a></div>';
}
