<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';

$summaryRows = array(
	array('label' => 'Conventions', 'table' => 'mjlfinancement_convention', 'right' => 'convention'),
	array('label' => 'Activites', 'table' => 'mjlfinancement_activity', 'right' => 'activity'),
	array('label' => 'Lignes budgetaires', 'table' => 'mjlfinancement_budget_line', 'right' => 'budgetline'),
	array('label' => 'Receptions de fonds', 'table' => 'mjlfinancement_fund_receipt', 'right' => 'fundreceipt'),
	array('label' => 'Depenses', 'table' => 'mjlfinancement_expense', 'right' => 'expense'),
	array('label' => 'Validations', 'table' => 'mjlfinancement_validation', 'right' => 'validation'),
	array('label' => 'Actions workflow', 'table' => 'mjlfinancement_workflow_action', 'right' => 'workflowaction'),
	array('label' => 'Echanges', 'table' => 'mjlfinancement_exchange_log', 'right' => 'exchangelog'),
	array('label' => 'Rapports', 'table' => 'mjlfinancement_report', 'right' => 'report'),
);

$canAccess = false;
foreach ($summaryRows as $summaryRow) {
	if ($user->hasRight('mjlfinancement', $summaryRow['right'], 'read')) {
		$canAccess = true;
		break;
	}
}
if (!$canAccess) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');

llxHeader('', $langs->trans('MJLFinancement'));

print load_fiche_titre($langs->trans('MJLFinancement'), '', 'money-bill');

print '<div class="tabsAction">';
if ($user->hasRight('mjlfinancement', 'convention', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php">Conventions</a>';
if ($user->hasRight('mjlfinancement', 'activity', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php">Activites</a>';
if ($user->hasRight('mjlfinancement', 'budgetline', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/budgetlines.php">Lignes budgetaires</a>';
if ($user->hasRight('mjlfinancement', 'fundreceipt', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php">Fonds recus</a>';
if ($user->hasRight('mjlfinancement', 'expense', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php">Depenses</a>';
if ($user->hasRight('mjlfinancement', 'validation', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/validations.php">Validations</a>';
if ($user->hasRight('mjlfinancement', 'workflowaction', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/workflowactions.php">Actions workflow</a>';
if ($user->hasRight('mjlfinancement', 'exchangelog', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/exchangelogs.php">Echanges</a>';
if ($user->hasRight('mjlfinancement', 'report', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/dpafdashboard.php">Tableau DPAF</a>';
if ($user->hasRight('mjlfinancement', 'report', 'read')) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/reports.php">Rapports</a>';
if (!empty($user->admin)) print '<a class="butAction" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/admin/access.php">Invitations</a>';
print '</div>';

print '<div class="div-table-responsive-no-min">';
print '<table class="noborder centpercent">';
print '<tr class="liste_titre"><th>Objet</th><th class="right">Total</th></tr>';
foreach ($summaryRows as $summaryRow) {
	if (!$user->hasRight('mjlfinancement', $summaryRow['right'], 'read')) {
		continue;
	}
	print '<tr class="oddeven"><td>'.dol_escape_htmltag($summaryRow['label']).'</td><td class="right">'.mjl_dashboard_count($summaryRow['table']).'</td></tr>';
}
print '</table>';
print '</div>';

if ($user->hasRight('mjlfinancement', 'report', 'read')) {
	$projectId = mjl_dashboard_fetch_id('projet', "ref = 'PRJ-JE-2026'");
	$conventionId = mjl_dashboard_fetch_id('mjlfinancement_convention', "ref = 'CONV-UNICEF-2026-001'");
	if ($projectId > 0) {
		$summary = mjl_dashboard_project_summary($projectId);
		if (!empty($summary)) {
			print '<br>';
			print load_fiche_titre('RPT-001 - Synthese financiere par projet', '', '');
			print '<table class="noborder centpercent">';
			print '<tr class="liste_titre"><th>Projet</th><th class="right">Budget</th><th class="right">Fonds recus</th><th class="right">Depenses validees</th><th class="right">Depenses soumises</th></tr>';
			print '<tr class="oddeven"><td>'.dol_escape_htmltag($summary['project_ref']).'</td><td class="right">'.price($summary['budget_total']).'</td><td class="right">'.price($summary['funds_received']).'</td><td class="right">'.price($summary['validated_expenses']).'</td><td class="right">'.price($summary['pending_expenses']).'</td></tr>';
			print '</table>';
		}
	}
	if ($conventionId > 0) {
		print '<br>';
		print load_fiche_titre('RPT-002 - Execution budgetaire par convention', '', '');
		print '<table class="noborder centpercent">';
		print '<tr class="liste_titre"><th>Ligne</th><th>Libelle</th><th class="right">Budget revise</th><th class="right">Valide</th><th class="right">Soumis</th><th class="right">Restant</th></tr>';
		foreach (mjl_dashboard_convention_budget($conventionId) as $row) {
			print '<tr class="oddeven"><td>'.dol_escape_htmltag($row['ref']).'</td><td>'.dol_escape_htmltag($row['label']).'</td><td class="right">'.price($row['revised_budget']).'</td><td class="right">'.price($row['validated_expenses']).'</td><td class="right">'.price($row['submitted_expenses']).'</td><td class="right">'.price($row['remaining_amount']).'</td></tr>';
		}
		print '</table>';
	}
}

llxFooter();
$db->close();
