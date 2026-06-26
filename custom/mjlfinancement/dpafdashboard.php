<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

mjl_workspace_require_supervision_access($user);

$langs->load('mjlfinancement@mjlfinancement');

llxHeader('', 'Tableau de bord DPAF');

print '<div class="mjl-workspace">';
mjl_dashboard_render_header(
	'Tableau de bord DPAF',
	'Suivre les risques, les revues en attente, les budgets, les fonds et les dernieres decisions auditees.',
	'Acces',
	!empty($user->admin) ? 'Administration' : 'Supervision DPAF'
);

mjl_dashboard_render_card_section(
	'Synthese de supervision',
	'Indicateurs principaux pour prioriser les controles.',
	mjl_dashboard_dpaf_kpis()
);

mjl_dashboard_render_alert_section(
	'Risques echeance',
	'Activites ouvertes avec une echeance proche ou depassee. Chaque alerte indique l objet, le risque et l action attendue.',
	mjl_dashboard_deadline_risks(),
	'Aucun risque echeance detecte pour le moment.'
);

mjl_dashboard_render_table_section(
	'Revues en attente',
	'Activites et depenses soumises qui attendent une decision.',
	array(
		array('label' => 'Type'),
		array('label' => 'Ref'),
		array('label' => 'Libelle'),
		array('label' => 'Date'),
		array('label' => 'Montant', 'class' => 'right'),
		array('label' => 'Action'),
	),
	mjl_dashboard_pending_reviews(),
	'Aucune revue en attente.',
	'mjl_dpaf_render_pending_review_row'
);

mjl_dashboard_render_table_section(
	'Budgets et depenses',
	'Situation budgetaire par convention, conservee comme lecture de supervision.',
	array(
		array('label' => 'Convention'),
		array('label' => 'Budget revise', 'class' => 'right'),
		array('label' => 'Depenses validees', 'class' => 'right'),
		array('label' => 'Depenses soumises', 'class' => 'right'),
		array('label' => 'Disponible', 'class' => 'right'),
	),
	mjl_dashboard_budget_expense_rows(),
	'Aucune donnee budgetaire.',
	'mjl_dpaf_render_budget_row'
);

mjl_dashboard_render_table_section(
	'Dernieres receptions de fonds',
	'Fonds recemment enregistres dans l entite active.',
	array(
		array('label' => 'Ref'),
		array('label' => 'Date'),
		array('label' => 'Projet'),
		array('label' => 'Convention'),
		array('label' => 'Montant', 'class' => 'right'),
	),
	mjl_dashboard_recent_funds(),
	'Aucune reception de fonds.',
	'mjl_dpaf_render_fund_row'
);

mjl_dashboard_render_table_section(
	'Dernieres actions auditees',
	'Trace recente des decisions sur activites et depenses.',
	array(
		array('label' => 'Source'),
		array('label' => 'Objet'),
		array('label' => 'Action'),
		array('label' => 'De'),
		array('label' => 'Vers'),
		array('label' => 'Acteur'),
		array('label' => 'Date'),
		array('label' => 'Commentaire'),
	),
	mjl_dashboard_recent_audit(),
	'Aucune action auditee.',
	'mjl_dpaf_render_audit_row'
);

print '</div>';

llxFooter();
$db->close();

function mjl_dpaf_render_pending_review_row($row)
{
	print '<tr class="oddeven">';
	print '<td>'.dol_escape_htmltag($row['item_type']).'</td>';
	print '<td>'.dol_escape_htmltag($row['ref']).'</td>';
	print '<td>'.dol_escape_htmltag($row['label']).'</td>';
	print '<td>'.dol_escape_htmltag($row['item_date']).'</td>';
	print '<td class="right">'.(((float) $row['amount'] > 0) ? price($row['amount']) : '').'</td>';
	print '<td><a class="mjl-table-link" href="'.mjl_dashboard_url($row['href']).'">Examiner</a></td>';
	print '</tr>';
}

function mjl_dpaf_render_budget_row($row)
{
	$available = (float) $row['budget_revise'] - (float) $row['depenses_validees'];
	print '<tr class="oddeven">';
	print '<td>'.dol_escape_htmltag($row['convention_ref']).'</td>';
	print '<td class="right">'.price($row['budget_revise']).'</td>';
	print '<td class="right">'.price($row['depenses_validees']).'</td>';
	print '<td class="right">'.price($row['depenses_soumises']).'</td>';
	print '<td class="right">'.price($available).'</td>';
	print '</tr>';
}

function mjl_dpaf_render_fund_row($row)
{
	print '<tr class="oddeven">';
	print '<td>'.dol_escape_htmltag($row['ref']).'</td>';
	print '<td>'.dol_escape_htmltag($row['reception_date']).'</td>';
	print '<td>'.dol_escape_htmltag($row['project_ref']).'</td>';
	print '<td>'.dol_escape_htmltag($row['convention_ref']).'</td>';
	print '<td class="right">'.price($row['amount']).'</td>';
	print '</tr>';
}

function mjl_dpaf_render_audit_row($row)
{
	print '<tr class="oddeven">';
	print '<td>'.dol_escape_htmltag($row['source']).'</td>';
	print '<td>'.dol_escape_htmltag($row['object_ref']).'</td>';
	print '<td>'.dol_escape_htmltag($row['action']).'</td>';
	print '<td>'.dol_escape_htmltag($row['from_status']).'</td>';
	print '<td>'.dol_escape_htmltag($row['to_status']).'</td>';
	print '<td>'.dol_escape_htmltag($row['login']).'</td>';
	print '<td>'.dol_escape_htmltag($row['action_date']).'</td>';
	print '<td>'.dol_escape_htmltag($row['comment']).'</td>';
	print '</tr>';
}
