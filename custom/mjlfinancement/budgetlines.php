<?php
require '../../main.inc.php';
if (!$user->hasRight('mjlfinancement', 'budgetline', 'read')) accessforbidden();
llxHeader('', 'Lignes budgetaires MJL');
print load_fiche_titre('Lignes budgetaires MJL', '', 'budget');
mjl_simple_list('mjlfinancement_budget_line', array('ref', 'label', 'fk_convention', 'initial_budget', 'revised_budget', 'spent_amount', 'remaining_amount', 'status'));
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
