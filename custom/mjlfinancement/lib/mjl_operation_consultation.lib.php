<?php

require_once __DIR__.'/mjl_execution.lib.php';
require_once __DIR__.'/mjl_presentation.lib.php';
require_once __DIR__.'/mjl_ui.lib.php';

/**
 * Read-only Operation presentation. Callers provide already-authorized data
 * and retain ownership of navigation and execution eligibility.
 */
function mjl_operation_consultation_link(array $operation, array $context)
{
	$status=mjl_ui_operation_status($operation['status']??'');
	$href=(string)($context['href']??'');
	$activityHref=(string)($context['activity_href']??'');
	$executionHref=!empty($context['can_execute'])?$href:'';
	$observation=isset($operation['observation'])&&$operation['observation']!==''?(string)$operation['observation']:'Aucune observation';
	$attributes=array(
		'data-operation-name'=>(string)($operation['name']??''),
		'data-operation-activity'=>(string)($context['activity_label']??''),
		'data-operation-type'=>(string)($operation['type_label']??''),
		'data-operation-status'=>$status['label'],
		'data-operation-status-tone'=>$status['tone'],
		'data-operation-authorization-label'=>(string)($context['authorization_label']??'Montant autorisé'),
		'data-operation-authorized'=>mjl_format_money($operation['authorized_amount']??null),
		'data-operation-spent'=>mjl_format_money($operation['spent_amount']??null),
		'data-operation-difference'=>mjl_execution_variance_amount($operation['spent_amount']??null,$operation['authorized_amount']??null),
		'data-operation-variance'=>mjl_execution_variance_percent($operation['spent_amount']??null,$operation['authorized_amount']??null),
		'data-operation-observation'=>$observation,
		'data-operation-activity-href'=>$activityHref,
		'data-operation-execution-href'=>$executionHref,
	);
	$html='<a class="mjl-action mjl-action-secondary" href="'.mjl_ui_escape($href).'" data-mjl-operation-consult';
	foreach($attributes as$name=>$value)$html.=' '.$name.'="'.mjl_ui_escape($value).'"';
	return $html.'>Consulter</a>';
}

function mjl_operation_consultation_drawer()
{
	return '<dialog class="mjl-operation-drawer" aria-labelledby="mjl-operation-drawer-title" data-mjl-operation-drawer><div class="mjl-operation-drawer-panel"><header class="mjl-operation-drawer-header"><div><p class="mjl-eyebrow">Fiche Opération</p><h2 id="mjl-operation-drawer-title" data-operation-drawer-name>Opération</h2><p data-operation-drawer-activity></p></div><button class="mjl-action mjl-action-secondary" type="button" data-operation-drawer-close>Fermer</button></header><div class="mjl-operation-drawer-body"><p><span class="mjl-status-pill mjl-status-neutral" data-operation-drawer-status></span></p><dl class="mjl-operation-drawer-facts"><div><dt>Type d’Opération</dt><dd data-operation-drawer-type></dd></div><div><dt data-operation-drawer-authorization-label>Montant autorisé</dt><dd data-operation-drawer-authorized></dd></div><div><dt>Montant dépensé</dt><dd data-operation-drawer-spent></dd></div><div><dt>Écart</dt><dd data-operation-drawer-difference></dd></div><div><dt>Variance</dt><dd data-operation-drawer-variance></dd></div><div class="mjl-operation-drawer-observation"><dt>Observation</dt><dd data-operation-drawer-observation></dd></div></dl></div><footer class="mjl-operation-drawer-footer"><a class="mjl-action mjl-action-secondary" href="#" data-operation-drawer-activity-link>Ouvrir l’Activité</a><a class="mjl-action" href="#" data-operation-drawer-execution-link>Renseigner l’exécution</a></footer></div></dialog>';
}
