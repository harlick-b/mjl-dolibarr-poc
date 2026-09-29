<?php

require_once __DIR__.'/mjl_ui.lib.php';

/**
 * Progressive exception action. The supplied form remains the single
 * route-owned form and stays visible when JavaScript is unavailable.
 */
function mjl_exception_action(array $options, $formHtml)
{
	$id=preg_replace('/[^A-Za-z0-9_-]/','-',(string)($options['id']??'mjl-exception-action'));
	$title=(string)($options['title']??'Action exceptionnelle');
	$context=(string)($options['context']??'');
	$guidance=(string)($options['guidance']??'');
	$trigger=(string)($options['trigger']??'Ouvrir');
	$class='mjl-action mjl-action-secondary mjl-exception-trigger';
	if (($options['tone']??'')==='primary') $class='mjl-action mjl-exception-trigger';
	$html='<div class="mjl-exception-action"><a class="'.$class.'" href="#'.mjl_ui_escape($id).'" data-mjl-exception-open data-exception-source="'.mjl_ui_escape($id).'" data-exception-title="'.mjl_ui_escape($title).'" data-exception-context="'.mjl_ui_escape($context).'" data-exception-guidance="'.mjl_ui_escape($guidance).'">'.mjl_ui_escape($trigger).'</a>';
	$html.='<section class="mjl-exception-source" id="'.mjl_ui_escape($id).'" data-mjl-exception-source><div class="mjl-exception-inline-copy"><h3>'.mjl_ui_escape($title).'</h3>';
	if ($context!=='') $html.='<p>'.mjl_ui_escape($context).'</p>';
	if ($guidance!=='') $html.='<p class="mjl-exception-guidance">'.mjl_ui_escape($guidance).'</p>';
	return $html.'</div>'.$formHtml.'</section></div>';
}

function mjl_exception_dialog()
{
	return '<dialog class="mjl-modal-dialog mjl-exception-dialog" id="mjl-exception-dialog" aria-labelledby="mjl-exception-dialog-title" data-mjl-exception-dialog><div class="mjl-dialog-panel"><header class="mjl-section-heading"><div><p class="mjl-eyebrow">Action exceptionnelle</p><h2 id="mjl-exception-dialog-title" data-exception-dialog-title>Action exceptionnelle</h2><p data-exception-dialog-context></p></div><button class="mjl-action mjl-action-secondary" type="button" data-mjl-exception-close>Fermer</button></header><div class="mjl-system-state mjl-system-state-warning mjl-exception-dialog-guidance" role="status" data-exception-dialog-guidance></div><div data-exception-dialog-form></div></div></dialog>';
}
