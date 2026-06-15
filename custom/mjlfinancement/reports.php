<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reporting.lib.php';

if (!$user->hasRight('mjlfinancement', 'report', 'read')) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');

$report = GETPOST('report', 'alpha') ?: 'project_summary';
$action = GETPOST('action', 'alpha');
$filters = array(
	'project_id' => GETPOSTINT('project_id'),
	'convention_id' => GETPOSTINT('convention_id'),
	'status' => GETPOST('status', 'intcomma'),
	'date_start' => GETPOST('date_start', 'alphanohtml'),
	'date_end' => GETPOST('date_end', 'alphanohtml'),
);

if ($action === 'export_csv') {
	if (!$user->hasRight('mjlfinancement', 'export', 'write')) {
		accessforbidden();
	}
	mjl_reports_output_csv($report, $filters);
	exit;
}

llxHeader('', 'Rapports MJL');
print load_fiche_titre('Rapports MJL', '', 'generic');

print '<form method="GET" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
print '<tr class="liste_titre"><th>Rapport</th><th>Projet</th><th>Convention</th><th>Statut</th><th>Date debut</th><th>Date fin</th><th></th></tr>';
print '<tr class="oddeven">';
print '<td><select name="report">';
foreach (mjl_reports_defs() as $key => $def) {
	print '<option value="'.$key.'"'.($report === $key ? ' selected' : '').'>'.dol_escape_htmltag($def['label']).'</option>';
}
print '</select></td>';
print '<td><input type="number" name="project_id" value="'.dol_escape_htmltag($filters['project_id']).'"></td>';
print '<td><input type="number" name="convention_id" value="'.dol_escape_htmltag($filters['convention_id']).'"></td>';
print '<td><input type="number" name="status" value="'.dol_escape_htmltag($filters['status']).'"></td>';
print '<td><input type="date" name="date_start" value="'.dol_escape_htmltag($filters['date_start']).'"></td>';
print '<td><input type="date" name="date_end" value="'.dol_escape_htmltag($filters['date_end']).'"></td>';
print '<td><input class="button" type="submit" value="Afficher"> ';
if ($user->hasRight('mjlfinancement', 'export', 'write')) {
	print '<button class="button" type="submit" name="action" value="export_csv">CSV</button>';
}
print '</td></tr></table></div></form>';

mjl_reports_render($report, $filters);

llxFooter();
$db->close();

function mjl_reports_defs()
{
	return array(
		'project_summary' => array('label' => 'Synthese financiere par projet'),
		'convention_budget' => array('label' => 'Execution budgetaire par convention'),
		'expense_documents' => array('label' => 'Liste des depenses avec pieces justificatives'),
	);
}

function mjl_reports_rows($report, $filters)
{
	if ($report === 'project_summary') {
		if (empty($filters['project_id'])) return array();
		$row = mjl_report_project_summary($filters['project_id'], $filters);
		return empty($row) ? array() : array($row);
	}
	if ($report === 'convention_budget') {
		if (empty($filters['convention_id'])) return array();
		return mjl_report_convention_budget($filters['convention_id'], $filters);
	}
	return mjl_report_expense_documents($filters);
}

function mjl_reports_render($report, $filters)
{
	$rows = mjl_reports_rows($report, $filters);
	print '<br><div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	if (empty($rows)) {
		print '<tr class="oddeven"><td>Aucune donnee</td></tr></table></div>';
		return;
	}
	$headers = array_keys($rows[0]);
	print '<tr class="liste_titre">';
	foreach ($headers as $header) print '<th>'.dol_escape_htmltag($header).'</th>';
	print '</tr>';
	foreach ($rows as $row) {
		print '<tr class="oddeven">';
		foreach ($headers as $header) print '<td>'.dol_escape_htmltag($row[$header]).'</td>';
		print '</tr>';
	}
	print '</table></div>';
}

function mjl_reports_output_csv($report, $filters)
{
	$rows = mjl_reports_rows($report, $filters);
	header('Content-Type: text/csv; charset=UTF-8');
	header('Content-Disposition: attachment; filename="mjl-'.$report.'.csv"');
	$out = fopen('php://output', 'w');
	if (!empty($rows)) {
		fputcsv($out, array_keys($rows[0]));
		foreach ($rows as $row) fputcsv($out, $row);
	}
	fclose($out);
}
