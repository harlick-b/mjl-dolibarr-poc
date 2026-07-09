<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

mjl_workspace_require_supervision_access($user);

$langs->load('mjlfinancement@mjlfinancement');

llxHeader('', 'Tableau de supervision finance');

mjl_navigation_shell_start($user, 'dpaf');
print '<div class="mjl-workspace">';
mjl_dashboard_render_header(
	'Tableau de supervision finance',
	'Suivre les risques, les revues en attente, les budgets, les fonds et les dernieres decisions auditees.',
	'Acces',
	!empty($user->admin) ? 'Administrateur plateforme' : 'Validateur définitif'
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
	'Aucun risque échéance détecté pour le moment.'
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
	'Budgets et dépenses',
	'Situation budgétaire par convention, conservée comme lecture de supervision.',
	array(
		array('label' => 'Programme'),
		array('label' => 'Budget révisé', 'class' => 'right'),
		array('label' => 'Dépenses validées', 'class' => 'right'),
		array('label' => 'Dépenses soumises', 'class' => 'right'),
		array('label' => 'Disponible', 'class' => 'right'),
	),
	mjl_dashboard_budget_expense_rows(),
	'Aucune donnée budgétaire.',
	'mjl_dpaf_render_budget_row'
);

mjl_dashboard_render_table_section(
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
	mjl_dashboard_recent_funds(),
	'Aucune réception de fonds.',
	'mjl_dpaf_render_fund_row'
);

mjl_dashboard_render_table_section(
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
	mjl_dashboard_recent_audit(),
	'Aucune action auditée.',
	'mjl_dpaf_render_audit_row'
);

print '</div>';
mjl_navigation_shell_end();

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
	print '<td>'.dol_escape_htmltag($row['source']).'</td>';
	print '<td>'.dol_escape_htmltag($row['object_ref']).'</td>';
	print '<td>'.dol_escape_htmltag(mjl_dpaf_audit_action_label($row['action'])).'</td>';
	print '<td>'.dol_escape_htmltag(mjl_dpaf_audit_status_label($row['from_status'])).'</td>';
	print '<td>'.dol_escape_htmltag(mjl_dpaf_audit_status_label($row['to_status'])).'</td>';
	print '<td>'.dol_escape_htmltag($row['login']).'</td>';
	print '<td>'.dol_escape_htmltag($row['action_date']).'</td>';
	print '<td>'.dol_escape_htmltag($row['comment']).'</td>';
	print '</tr>';
}

function mjl_dpaf_audit_action_label($action)
{
	$map = array(
		'created' => 'Création',
		'field_changed' => 'Modification',
		'document_uploaded' => 'Document ajouté',
		'proof_uploaded' => 'Preuve ajoutée',
		'unsafe_edit_rejected' => 'Modification refusée',
		'received' => 'Réception',
		'not_received' => 'Non-réception',
		'submitted' => 'Soumission',
		'prevalidated' => 'Prévalidation',
		'validated' => 'Validation définitive',
		'final_validated' => 'Validation définitive',
		'rejected' => 'Rejet',
		'corrected' => 'Correction',
		'deleted' => 'Suppression',
		'activated' => 'Activation',
		'closed' => 'Clôture',
	);
	return isset($map[(string) $action]) ? $map[(string) $action] : (string) $action;
}

function mjl_dpaf_audit_status_label($status)
{
	$map = array(
		'draft' => 'Brouillon',
		'active' => 'Active',
		'closed' => 'Clôturée',
		'deleted' => 'Supprimée',
		'submitted' => 'Soumise',
		'prevalidated' => 'Prévalidée',
		'validated' => 'Validée définitivement',
		'final_validated' => 'Validée définitivement',
		'rejected' => 'Rejetée',
		'corrected' => 'Corrigée',
		'received' => 'Reçu',
		'not_received' => 'Non reçu',
	);
	return isset($map[(string) $status]) ? $map[(string) $status] : (string) $status;
}
