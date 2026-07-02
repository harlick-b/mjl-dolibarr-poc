<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_expense_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';

mjl_workspace_require_documents_access($user);

$langs->load('mjlfinancement@mjlfinancement');

$filters = array(
	'type' => GETPOST('type', 'alphanohtml'),
	'project_id' => GETPOSTINT('project_id'),
	'date_from' => GETPOST('date_from', 'alphanohtml'),
	'date_to' => GETPOST('date_to', 'alphanohtml'),
);

llxHeader('', 'Documents MJL');
mjl_navigation_shell_start($user, 'documents');
print '<div class="mjl-workspace">';
mjl_dashboard_render_header(
	'Documents',
	'Consulter les documents accessibles sans ouvrir l ECM natif Dolibarr.',
	'Bibliotheque',
	'Lecture seule'
);

mjl_documents_render_filters($filters);
mjl_documents_render_library($filters);

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_documents_render_filters($filters)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Filtres</h2><p>Les resultats restent limites a votre perimetre d acces.</p></div>';
	print '<form method="GET" class="mjl-form-grid">';
	print '<label>Type<select name="type">';
	$options = array('' => 'Tous', 'activity' => 'Activite', 'expense' => 'Depense', 'convention' => 'Convention', 'fundreceipt' => 'Fonds recu');
	foreach ($options as $value => $label) {
		print '<option value="'.dol_escape_htmltag($value).'"'.($filters['type'] === $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	print '</select></label>';
	print '<label>Projet'.mjl_documents_project_select((int) $filters['project_id']).'</label>';
	print '<label>Date debut<input type="date" name="date_from" value="'.dol_escape_htmltag($filters['date_from']).'"></label>';
	print '<label>Date fin<input type="date" name="date_to" value="'.dol_escape_htmltag($filters['date_to']).'"></label>';
	print '<div><button class="button" type="submit">Filtrer</button></div>';
	print '</form>';
	print '</section>';
}

function mjl_documents_render_library($filters)
{
	$documents = mjl_documents_rows($filters);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Bibliotheque</h2><p>Les documents sont ajoutes depuis la fiche activite, depense, convention, fonds recu ou projet concerne.</p></div>';
	print '<div class="mjl-empty-state">Aucun bouton d upload global n est disponible. Ajoutez les documents depuis leur objet metier.</div>';
	if (empty($documents)) {
		print '<div class="mjl-empty-state">Aucun document accessible avec ces filtres.</div>';
		print '</section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Nom du document</th><th>Type</th><th>Objet lie</th><th>Projet</th><th>Convention</th><th>Activite</th><th>Depense</th><th>Ajoute par</th><th>Date ajout</th><th>Statut</th><th>Action telecharger</th></tr>';
	foreach ($documents as $document) {
		print '<tr class="oddeven">';
		print '<td>'.dol_escape_htmltag($document['name']).'</td>';
		print '<td>'.dol_escape_htmltag($document['type_label']).'</td>';
		print '<td>'.dol_escape_htmltag($document['object_ref']).'</td>';
		print '<td>'.dol_escape_htmltag($document['project_ref']).'</td>';
		print '<td>'.dol_escape_htmltag($document['convention_ref']).'</td>';
		print '<td>'.dol_escape_htmltag($document['activity_ref']).'</td>';
		print '<td>'.dol_escape_htmltag($document['expense_ref']).'</td>';
		print '<td>'.dol_escape_htmltag($document['author']).'</td>';
		print '<td>'.dol_escape_htmltag($document['date_c']).'</td>';
		print '<td>Disponible</td>';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/documentdownload.php?type='.urlencode($document['download_type']).'&id='.((int) $document['rowid']).'">Telecharger</a></td>';
		print '</tr>';
	}
	print '</table></div></section>';
}

function mjl_documents_rows($filters)
{
	$rows = array();
	if ($filters['type'] === '' || $filters['type'] === 'activity') {
		$rows = array_merge($rows, mjl_documents_activity_rows($filters));
	}
	if ($filters['type'] === '' || $filters['type'] === 'expense') {
		$rows = array_merge($rows, mjl_documents_expense_rows($filters));
	}
	if ($filters['type'] === '' || $filters['type'] === 'convention') {
		$rows = array_merge($rows, mjl_documents_convention_rows($filters));
	}
	if ($filters['type'] === '' || $filters['type'] === 'fundreceipt') {
		$rows = array_merge($rows, mjl_documents_fund_receipt_rows($filters));
	}
	usort($rows, function ($a, $b) {
		return strcmp((string) $b['date_c'], (string) $a['date_c']);
	});
	return $rows;
}

function mjl_documents_activity_rows($filters)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'activity', 'read')) return array();
	$sql = 'SELECT a.rowid, a.ref, a.label, a.fk_project, c.ref AS convention_ref, p.ref AS project_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	if ((int) $filters['project_id'] > 0) $sql .= ' AND a.fk_project = '.((int) $filters['project_id']);
	$sql .= mjl_activities_scope_sql('a').' ORDER BY a.ref ASC';
	$documents = array();
	foreach (mjl_documents_fetch_all($sql) as $activity) {
		foreach (mjl_activity_document_download_rows((int) $activity['rowid']) as $row) {
			if (!mjl_documents_date_matches($row, $filters)) continue;
			$documents[] = mjl_documents_make_row($row, 'activity', 'Activite', $activity['ref'], $activity['project_ref'], $activity['convention_ref'], $activity['ref'], '', $activity['label']);
		}
	}
	return $documents;
}

function mjl_documents_expense_rows($filters)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'expense', 'read')) return array();
	$sql = 'SELECT e.rowid, e.ref, e.description, e.fk_project, c.ref AS convention_ref, a.ref AS activity_ref, p.ref AS project_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	if ((int) $filters['project_id'] > 0) $sql .= ' AND e.fk_project = '.((int) $filters['project_id']);
	$sql .= mjl_expenses_scope_sql('e').' ORDER BY e.ref ASC';
	$documents = array();
	foreach (mjl_documents_fetch_all($sql) as $expense) {
		foreach (mjl_expense_document_download_rows((int) $expense['rowid']) as $row) {
			if (!mjl_documents_date_matches($row, $filters)) continue;
			$documents[] = mjl_documents_make_row($row, 'expense', 'Depense', $expense['ref'], $expense['project_ref'], $expense['convention_ref'], $expense['activity_ref'], $expense['ref'], $expense['description']);
		}
	}
	return $documents;
}

function mjl_documents_convention_rows($filters)
{
	global $db, $conf, $user;
	if (!mjl_workspace_can_access_reference_data($user, 'convention')) return array();
	$sql = 'SELECT c.rowid, c.ref, c.title, c.fk_project, p.ref AS project_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity);
	if ((int) $filters['project_id'] > 0) $sql .= ' AND c.fk_project = '.((int) $filters['project_id']);
	$sql .= ' ORDER BY c.ref ASC';
	$documents = array();
	foreach (mjl_documents_fetch_all($sql) as $convention) {
		foreach (mjl_convention_document_download_rows((int) $convention['rowid']) as $row) {
			if (!mjl_documents_date_matches($row, $filters)) continue;
			$documents[] = mjl_documents_make_row($row, 'convention', 'Convention', $convention['ref'], $convention['project_ref'], $convention['ref'], '', '', $convention['title']);
		}
	}
	return $documents;
}

function mjl_documents_fund_receipt_rows($filters)
{
	global $db, $conf, $user;
	if (!mjl_workspace_can_access_reference_data($user, 'fundreceipt')) return array();
	$sql = 'SELECT fr.rowid, fr.ref, fr.comment, fr.fk_project, c.ref AS convention_ref, p.ref AS project_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_fund_receipt fr';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = fr.fk_convention AND c.entity = fr.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = fr.fk_project AND p.entity = fr.entity';
	$sql .= ' WHERE fr.entity = '.((int) $conf->entity);
	if ((int) $filters['project_id'] > 0) $sql .= ' AND fr.fk_project = '.((int) $filters['project_id']);
	$sql .= ' ORDER BY fr.ref ASC';
	$documents = array();
	foreach (mjl_documents_fetch_all($sql) as $receipt) {
		foreach (mjl_fund_receipt_document_download_rows((int) $receipt['rowid']) as $row) {
			if (!mjl_documents_date_matches($row, $filters)) continue;
			$documents[] = mjl_documents_make_row($row, 'fundreceipt', 'Fonds recu', $receipt['ref'], $receipt['project_ref'], $receipt['convention_ref'], '', '', $receipt['comment']);
		}
	}
	return $documents;
}

function mjl_documents_make_row($row, $downloadType, $typeLabel, $objectRef, $projectRef, $conventionRef, $activityRef, $expenseRef, $label)
{
	return array(
		'rowid' => (int) $row['rowid'],
		'name' => mjl_expense_document_display_filename($row),
		'download_type' => $downloadType,
		'type_label' => $typeLabel,
		'object_ref' => trim((string) $objectRef) !== '' ? $objectRef : $label,
		'project_ref' => $projectRef ?: 'Non renseigne',
		'convention_ref' => $conventionRef ?: '',
		'activity_ref' => $activityRef ?: '',
		'expense_ref' => $expenseRef ?: '',
		'author' => mjl_documents_author($row),
		'date_c' => (string) ($row['date_c'] ?? ''),
	);
}

function mjl_documents_author($row)
{
	global $db;
	if (empty($row['fk_user_c'])) return '';
	$sql = 'SELECT login FROM '.$db->prefix().'user WHERE rowid = '.((int) $row['fk_user_c']);
	$resql = $db->query($sql);
	if (!$resql) return '';
	$obj = $db->fetch_object($resql);
	return $obj ? (string) $obj->login : '';
}

function mjl_documents_date_matches($row, $filters)
{
	$date = substr((string) ($row['date_c'] ?? ''), 0, 10);
	if ($filters['date_from'] !== '' && $date < $filters['date_from']) return false;
	if ($filters['date_to'] !== '' && $date > $filters['date_to']) return false;
	return true;
}

function mjl_documents_project_select($selected)
{
	global $db, $conf;
	$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'projet p WHERE p.entity = '.((int) $conf->entity).mjl_documents_project_scope_sql('p').' ORDER BY p.ref ASC';
	$out = '<select name="project_id"><option value="0">Tous</option>';
	foreach (mjl_documents_fetch_all($sql) as $row) {
		$out .= '<option value="'.((int) $row['rowid']).'"'.((int) $selected === (int) $row['rowid'] ? ' selected' : '').'>'.dol_escape_htmltag($row['ref'].' - '.$row['title']).'</option>';
	}
	$out .= '</select>';
	return $out;
}

function mjl_documents_project_scope_sql($alias)
{
	global $db, $user;
	$a = preg_replace('/[^A-Za-z0-9_]/', '', $alias);
	if (mjl_workspace_can_access_supervision($user) || (mjl_activities_is_readonly_consultation() && mjl_expenses_is_readonly_consultation())) return '';
	if ($user->hasRight('mjlfinancement', 'activity', 'write') || $user->hasRight('mjlfinancement', 'expense', 'write')) {
		return ' AND (EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_activity ascope WHERE ascope.entity = '.$a.'.entity AND ascope.fk_project = '.$a.'.rowid AND ascope.fk_user_creat = '.((int) $user->id).') OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_expense escope WHERE escope.entity = '.$a.'.entity AND escope.fk_project = '.$a.'.rowid AND escope.fk_user_creat = '.((int) $user->id).'))';
	}
	if ($user->hasRight('mjlfinancement', 'activity', 'validate') || $user->hasRight('mjlfinancement', 'expense', 'validate')) {
		return ' AND (EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_activity ascope WHERE ascope.entity = '.$a.'.entity AND ascope.fk_project = '.$a.'.rowid AND ascope.status = 3) OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_expense escope WHERE escope.entity = '.$a.'.entity AND escope.fk_project = '.$a.'.rowid AND escope.status = 1))';
	}
	return '';
}

function mjl_documents_fetch_all($sql)
{
	global $db;
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return array();
	}
	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}
