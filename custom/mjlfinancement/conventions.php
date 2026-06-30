<?php
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
mjl_workspace_require_reference_data_access($user, 'convention');
llxHeader('', 'Conventions MJL');
mjl_navigation_shell_start($user, 'conventions');
print '<div class="mjl-workspace">';
print load_fiche_titre('Conventions MJL', '', 'contract');
print '<div class="mjl-empty-state">Vue de consultation POC: les conventions servent de mission / enveloppe de financement. Les parcours complets de creation et modification restent hors de ce lot.</div><br>';
mjl_simple_list('mjlfinancement_convention', array('ref', 'title', 'total_amount', 'currency_code', 'status'));
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
