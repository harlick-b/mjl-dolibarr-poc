<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php';

mjl_workspace_require_supervision_access($user);

$langs->load('mjlfinancement@mjlfinancement');
$filters = mjl_dashboard_filters_from_request($user);

llxHeader('', 'Tableau de supervision finance');

mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render(
	'Tableau de supervision financière',
	array(
		'description' => 'Suivre les risques, les revues en attente, les budgets, les fonds et les dernières décisions auditées.',
		'context' => array('label' => 'Accès', 'value' => !empty($user->admin) ? 'Administrateur plateforme' : 'Validateur définitif'),
	)
);
mjl_dashboard_render_filters($filters, '/custom/mjlfinancement/dpafdashboard.php');

mjl_dashboard_render_card_section(
	'Synthese de supervision',
	'Indicateurs principaux pour prioriser les controles.',
	mjl_dashboard_supervision_kpis($filters)
);

$deadlineRisks = mjl_dashboard_capture(function () use ($filters) { return mjl_dashboard_deadline_risks(20, $filters); });
if ($deadlineRisks['available']) mjl_dashboard_render_alert_section(
	'Risques echeance',
	'Activites ouvertes avec une echeance proche ou depassee. Chaque alerte indique l objet, le risque et l action attendue.',
	$deadlineRisks['value'],
	'Aucun risque échéance détecté pour le moment.'
); else mjl_dpaf_render_unavailable('Risques échéance');

$pendingReviews = mjl_dashboard_capture(function () use ($filters) { return mjl_dashboard_pending_reviews(30, $filters); });
if ($pendingReviews['available']) mjl_dashboard_render_table_section(
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
	$pendingReviews['value'],
	'Aucune revue en attente.',
	'mjl_dpaf_render_pending_review_row'
); else mjl_dpaf_render_unavailable('Revues en attente');

$budgetRows = mjl_dashboard_capture(function () use ($filters) { return mjl_dashboard_budget_expense_rows($filters); });
if ($budgetRows['available']) mjl_dashboard_render_table_section(
	'Budgets et dépenses',
	'Situation budgétaire par convention, conservée comme lecture de supervision.',
	array(
		array('label' => 'Programme'),
		array('label' => 'Budget révisé', 'class' => 'right'),
		array('label' => 'Dépenses validées', 'class' => 'right'),
		array('label' => 'Dépenses soumises', 'class' => 'right'),
		array('label' => 'Disponible', 'class' => 'right'),
	),
	$budgetRows['value'],
	'Aucune donnée budgétaire.',
	'mjl_dpaf_render_budget_row'
); else mjl_dpaf_render_unavailable('Budgets et dépenses');

$recentFunds = mjl_dashboard_capture(function () use ($filters) { return mjl_dashboard_recent_funds(10, $filters); });
if ($recentFunds['available']) mjl_dashboard_render_table_section(
	'Dernières réceptions de fonds',
	'Fonds récemment enregistrés dans l’entité active.',
	array(
		array('label' => 'Ref'),
		array('label' => 'Date'),
		array('label' => 'Projet'),
		array('label' => 'Programme'),
		array('label' => 'Montant', 'class' => 'right'),
		array('label' => 'Preuve'),
	),
	$recentFunds['value'],
	'Aucune réception de fonds.',
	'mjl_dpaf_render_fund_row'
); else mjl_dpaf_render_unavailable('Dernières réceptions de fonds');

$recentAudit = mjl_dashboard_capture(function () use ($filters) { return mjl_dashboard_recent_audit(30, $filters); });
if ($recentAudit['available']) mjl_dashboard_render_table_section(
	'Dernières actions auditées',
	'Trace récente des décisions sur activités et dépenses.',
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
	$recentAudit['value'],
	'Aucune action auditée.',
	'mjl_dpaf_render_audit_row'
); else mjl_dpaf_render_unavailable('Dernières actions auditées');

print '</div>';
mjl_navigation_shell_end();

llxFooter();
$db->close();

function mjl_dpaf_render_unavailable($title)
{
	print '<section class="mjl-workspace-section"><div class="mjl-section-heading"><h2>'.dol_escape_htmltag($title).'</h2></div>';
	print mjl_ui_system_state('unavailable', 'Donnée momentanément indisponible', 'Les autres régions de supervision restent utilisables.');
	print '</section>';
}

function mjl_dpaf_render_pending_review_row($row)
{
	print '<tr class="oddeven">';
	print '<td>'.dol_escape_htmltag($row['item_type']).'</td>';
	print '<td>'.dol_escape_htmltag($row['ref']).'</td>';
	print '<td>'.dol_escape_htmltag($row['label']).'</td>';
	print '<td>'.dol_escape_htmltag($row['item_date']).'</td>';
	print '<td class="right">'.(((float) $row['amount'] > 0) ? price($row['amount']) : '').'</td>';
	$href = $row['href'];
	if ($row['item_type'] === 'Activite' || $row['item_type'] === 'Depense') {
		$href .= '?id='.((int) $row['item_id']);
	}
	print '<td><a class="mjl-table-link" href="'.mjl_dashboard_url($href).'">Examiner</a></td>';
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
	print '<td>'.dol_escape_htmltag($row['project_ref'] ?: 'Enveloppe globale').'</td>';
	print '<td>'.dol_escape_htmltag($row['convention_ref']).'</td>';
	print '<td class="right">'.price($row['amount']).'</td>';
	print '<td>'.dol_escape_htmltag($row['document_state']).'</td>';
	print '</tr>';
}

function mjl_dpaf_render_audit_row($row)
{
	print '<tr class="oddeven">';
	print '<td>'.dol_escape_htmltag(mjl_timeline_presentation_object_label($row['object_type'] ?? '')).'</td>';
	print '<td>'.dol_escape_htmltag($row['object_ref']).'</td>';
	print '<td>'.dol_escape_htmltag(mjl_dpaf_audit_action_label($row['action'])).'</td>';
	print '<td>'.dol_escape_htmltag(mjl_dpaf_audit_status_label($row['from_status'], $row['object_type'] ?? '')).'</td>';
	print '<td>'.dol_escape_htmltag(mjl_dpaf_audit_status_label($row['to_status'], $row['object_type'] ?? '')).'</td>';
	print '<td>'.dol_escape_htmltag($row['login']).'</td>';
	print '<td>'.dol_escape_htmltag($row['action_date']).'</td>';
	print '<td>'.dol_escape_htmltag($row['comment']).'</td>';
	print '</tr>';
}

function mjl_dpaf_audit_action_label($action)
{
	return mjl_timeline_presentation_action_label('', $action);
}

function mjl_dpaf_audit_status_label($status, $objectType = '')
{
	return mjl_timeline_presentation_status_label($objectType, $status);
}
