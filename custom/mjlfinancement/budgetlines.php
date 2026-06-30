<?php
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
mjl_workspace_require_reference_data_access($user, 'budgetline');
llxHeader('', 'Lignes budgetaires MJL');
mjl_navigation_shell_start($user, 'budgetlines');
print '<div class="mjl-workspace">';
print load_fiche_titre('Lignes budgetaires MJL', '', 'budget');
print '<div class="mjl-empty-state">Vue de consultation POC: les lignes budgetaires alimentent les controles de depenses et les exports. Les parcours complets de gestion restent hors de ce lot.</div><br>';
mjl_simple_list('mjlfinancement_budget_line', array('ref', 'label', 'fk_convention', 'initial_budget', 'revised_budget', 'spent_amount', 'remaining_amount', 'status'));
print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();
function mjl_simple_list($table, $columns) {
	global $db, $conf;
	$sql = 'SELECT rowid, '.implode(', ', $columns).' FROM '.$db->prefix().$table.' WHERE entity = '.((int) $conf->entity).' ORDER BY rowid DESC LIMIT 100';
	$resql = $db->query($sql);
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent"><tr class="liste_titre">';
	foreach ($columns as $column) print '<th>'.dol_escape_htmltag($column).'</th>';
	print '</tr>';
	if ($resql) while ($obj = $db->fetch_object($resql)) {
		print '<tr class="oddeven">';
		foreach ($columns as $column) print '<td>'.dol_escape_htmltag($obj->{$column}).'</td>';
		print '</tr>';
	}
	print '</table></div>';
	if (!$resql) print '<div class="error">'.$db->lasterror().'</div>';
}
