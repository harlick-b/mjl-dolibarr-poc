<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_expense_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';

mjl_workspace_require_projects_access($user);

$langs->load('mjlfinancement@mjlfinancement');

$projectId = GETPOSTINT('id');
$action = GETPOST('action', 'alphanohtml');
if ($action === 'add_note') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		accessforbidden('Invalid security token');
	}
	mjl_projects_handle_note_post($projectId);
}

llxHeader('', 'Projets MJL');
mjl_navigation_shell_start($user, 'projects');
print '<div class="mjl-workspace">';

if ($projectId > 0) {
	mjl_projects_render_detail($projectId);
} else {
	mjl_projects_render_list();
}

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_projects_handle_note_post($projectId)
{
	global $db, $conf, $user;

	$project = mjl_projects_fetch_project((int) $projectId);
	if (empty($project) || !mjl_projects_can_open($project) || !mjl_projects_can_add_note($project)) {
		accessforbidden();
	}
	$message = trim(GETPOST('message', 'restricthtml'));
	if ($message === '') {
		setEventMessages('Le commentaire est obligatoire.', null, 'errors');
		header('Location: '.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php?id='.((int) $projectId));
		exit;
	}

	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_project_note';
	$sql .= ' (entity, fk_project, message, date_note, fk_user_author, date_creation, fk_user_creat)';
	$sql .= ' VALUES ('.((int) $conf->entity).', '.((int) $projectId).", '".$db->escape($message)."', '".$db->idate(dol_now())."', ".((int) $user->id).", '".$db->idate(dol_now())."', ".((int) $user->id).')';
	if (!$db->query($sql)) {
		setEventMessages($db->lasterror(), null, 'errors');
	} else {
		mjl_workflow_audit_insert('mjlfinancement_project', (int) $projectId, (int) $conf->entity, 'Note projet', $user, mjl_projects_actor_role(), 'note_added', $message, array(), 'WFA-PRJ');
		setEventMessages('Commentaire ajoute au projet.', null, 'mesgs');
	}
	header('Location: '.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php?id='.((int) $projectId));
	exit;
}

function mjl_projects_render_list()
{
	$rows = mjl_projects_fetch_rows();
	mjl_dashboard_render_header(
		'Projets',
		'Consulter les projets suivis dans l espace MJL sans ouvrir l interface native Dolibarr.',
		'Portefeuille',
		count($rows).' projet(s)'
	);

	print '<section class="mjl-workspace-section">';
	if (empty($rows)) {
		print '<div class="mjl-empty-state">Aucun projet accessible dans votre perimetre.</div>';
		print '</section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Projet</th><th>Convention liee</th><th>Budget total</th><th>Budget consomme</th><th>Budget restant</th><th>Fonds recus</th><th>Activites</th><th>Depenses</th><th>Documents</th><th>Echeance</th><th>Statut</th></tr>';
	foreach ($rows as $row) {
		print '<tr class="oddeven">';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php?id='.((int) $row['rowid']).'">'.dol_escape_htmltag($row['ref']).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($row['title']).'</span></td>';
		print '<td>'.dol_escape_htmltag($row['convention_refs'] ?: 'Non renseignee').'</td>';
		print '<td>'.mjl_projects_price($row['budget_total']).'</td>';
		print '<td>'.mjl_projects_price($row['budget_spent']).'</td>';
		print '<td>'.mjl_projects_price($row['budget_remaining']).'</td>';
		print '<td>'.mjl_projects_price($row['funds_received']).'</td>';
		print '<td>'.((int) $row['activities_count']).'</td>';
		print '<td>'.((int) $row['expenses_count']).'</td>';
		print '<td>'.((int) $row['documents_count']).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_projects_date($row['datee'])).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_projects_status_label($row['fk_statut'])).'</td>';
		print '</tr>';
	}
	print '</table></div>';
	print '</section>';
}

function mjl_projects_render_detail($projectId)
{
	$project = mjl_projects_fetch_project((int) $projectId);
	if (empty($project) || !mjl_projects_can_open($project)) {
		accessforbidden();
	}
	mjl_dashboard_render_header('Projet '.$project['ref'], $project['title'], 'Statut', mjl_projects_status_label($project['fk_statut']));
	print '<p><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php">Retour aux projets</a></p>';

	$cards = array(
		array('label' => 'Budget total', 'value' => mjl_projects_price($project['budget_total']), 'context' => 'Lignes budgetaires rattachees', 'href' => '/custom/mjlfinancement/budgetlines.php', 'action' => 'Voir les budgets', 'status' => 'Financement', 'tone' => 'neutral'),
		array('label' => 'Budget consomme', 'value' => mjl_projects_price($project['budget_spent']), 'context' => 'Depenses validees', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Voir les depenses', 'status' => 'Execution', 'tone' => 'neutral'),
		array('label' => 'Fonds recus', 'value' => mjl_projects_price($project['funds_received']), 'context' => 'Receptions de fonds confirmees', 'href' => '/custom/mjlfinancement/fundreceipts.php', 'action' => 'Voir les fonds', 'status' => 'Financement', 'tone' => 'neutral'),
	);
	mjl_dashboard_render_card_section('Resume', 'Vue consolidee du projet et de ses objets MJL rattaches.', $cards);

	mjl_projects_render_related_table('Activites liees', mjl_projects_activity_rows((int) $project['rowid']), 'activities.php');
	mjl_projects_render_related_table('Depenses liees', mjl_projects_expense_rows((int) $project['rowid']), 'expenses.php');
	mjl_projects_render_document_table((int) $project['rowid']);
	mjl_projects_render_notes($project);
}

function mjl_projects_render_related_table($title, $rows, $route)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>'.dol_escape_htmltag($title).'</h2><p>Elements accessibles dans votre perimetre.</p></div>';
	if (empty($rows)) {
		print '<div class="mjl-empty-state">Aucun element accessible.</div>';
		print '</section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Reference</th><th>Libelle</th><th>Statut</th></tr>';
	foreach ($rows as $row) {
		print '<tr class="oddeven"><td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/'.$route.'?id='.((int) $row['rowid']).'">'.dol_escape_htmltag($row['ref']).'</a></td><td>'.dol_escape_htmltag($row['label']).'</td><td>'.dol_escape_htmltag($row['status_label']).'</td></tr>';
	}
	print '</table></div></section>';
}

function mjl_projects_render_document_table($projectId)
{
	$documents = mjl_projects_document_rows($projectId);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Documents lies</h2><p>Telechargements controles par les regles MJL.</p></div>';
	if (empty($documents)) {
		print '<div class="mjl-empty-state">Aucun document accessible.</div>';
		print '</section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Document</th><th>Type</th><th>Objet lie</th><th>Action</th></tr>';
	foreach ($documents as $document) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($document['name']).'</td><td>'.dol_escape_htmltag($document['type_label']).'</td><td>'.dol_escape_htmltag($document['object_ref']).'</td><td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/documentdownload.php?type='.urlencode($document['download_type']).'&id='.((int) $document['rowid']).'">Telecharger</a></td></tr>';
	}
	print '</table></div></section>';
}

function mjl_projects_render_notes($project)
{
	$notes = mjl_projects_note_rows((int) $project['rowid']);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Notes / Commentaires</h2><p>Commentaires humains separes de l audit automatique.</p></div>';
	if (mjl_projects_can_add_note($project)) {
		print '<form method="POST" class="mjl-form-grid" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php?id='.((int) $project['rowid']).'">';
		print '<input type="hidden" name="token" value="'.dol_escape_htmltag(function_exists('newToken') ? newToken() : '').'">';
		print '<input type="hidden" name="action" value="add_note">';
		print '<label>Commentaire<textarea required name="message"></textarea></label>';
		print '<div><button class="button" type="submit">Ajouter le commentaire</button></div>';
		print '</form>';
	}
	if (empty($notes)) {
		print '<div class="mjl-empty-state">Aucun commentaire projet.</div>';
		print '</section>';
		return;
	}
	print '<ol class="mjl-timeline">';
	foreach ($notes as $note) {
		print '<li><strong>'.dol_escape_htmltag($note['author']).'</strong> <span class="opacitymedium">'.dol_escape_htmltag($note['date_note']).'</span><p class="mjl-timeline-comment">'.dol_escape_htmltag($note['message']).'</p></li>';
	}
	print '</ol></section>';
}

function mjl_projects_fetch_rows()
{
	global $conf;
	$sql = mjl_projects_base_sql();
	$sql .= ' WHERE p.entity = '.((int) $conf->entity).mjl_projects_scope_sql('p');
	$sql .= ' ORDER BY p.ref ASC';
	return mjl_projects_fetch_all($sql);
}

function mjl_projects_fetch_project($projectId)
{
	global $conf;
	if ((int) $projectId <= 0) return array();
	$sql = mjl_projects_base_sql();
	$sql .= ' WHERE p.entity = '.((int) $conf->entity).' AND p.rowid = '.((int) $projectId);
	$rows = mjl_projects_fetch_all($sql);
	return empty($rows) ? array() : $rows[0];
}

function mjl_projects_base_sql()
{
	global $db;
	return 'SELECT p.rowid, p.ref, p.title, p.description, p.dateo, p.datee, p.fk_statut,'
		.' COALESCE((SELECT GROUP_CONCAT(c.ref ORDER BY c.ref SEPARATOR \', \') FROM '.$db->prefix().'mjlfinancement_convention c WHERE c.entity = p.entity AND c.fk_project = p.rowid), \'\') AS convention_refs,'
		.' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = p.entity AND bl.fk_project = p.rowid), 0) AS budget_total,'
		.' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = p.entity AND e.fk_project = p.rowid AND e.status = 2), 0) AS budget_spent,'
		.' COALESCE((SELECT SUM(bl.remaining_amount) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = p.entity AND bl.fk_project = p.rowid), 0) AS budget_remaining,'
		.' COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = p.entity AND fr.fk_project = p.rowid AND fr.status = 1), 0) AS funds_received,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity a WHERE a.entity = p.entity AND a.fk_project = p.rowid), 0) AS activities_count,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = p.entity AND e.fk_project = p.rowid), 0) AS expenses_count,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'ecm_files f INNER JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = f.src_object_id AND f.src_object_type = \'mjlfinancement_activity\' AND a.entity = f.entity WHERE a.entity = p.entity AND a.fk_project = p.rowid), 0)'
		.' + COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'ecm_files f INNER JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = f.src_object_id AND f.src_object_type = \'mjlfinancement_expense\' AND e.entity = f.entity WHERE e.entity = p.entity AND e.fk_project = p.rowid), 0)'
		.' + COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'ecm_files f INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = f.src_object_id AND f.src_object_type = \'mjlfinancement_convention\' AND c.entity = f.entity WHERE c.entity = p.entity AND c.fk_project = p.rowid), 0)'
		.' + COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'ecm_files f INNER JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = f.src_object_id AND f.src_object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = f.entity WHERE fr.entity = p.entity AND fr.fk_project = p.rowid), 0) AS documents_count'
		.' FROM '.$db->prefix().'projet p';
}

function mjl_projects_activity_rows($projectId)
{
	global $db, $conf;
	$sql = 'SELECT a.rowid, a.ref, a.label, a.status, a.fk_user_creat FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).' AND a.fk_project = '.((int) $projectId);
	$sql .= mjl_activities_scope_sql('a');
	$sql .= ' ORDER BY a.ref ASC';
	$rows = array();
	foreach (mjl_projects_fetch_all($sql) as $row) {
		$row['status_label'] = mjl_projects_activity_status_label($row['status']);
		$rows[] = $row;
	}
	return $rows;
}

function mjl_projects_expense_rows($projectId)
{
	global $db, $conf;
	$sql = 'SELECT e.rowid, e.ref, e.description AS label, e.status, e.fk_user_creat FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity).' AND e.fk_project = '.((int) $projectId);
	$sql .= mjl_expenses_scope_sql('e');
	$sql .= ' ORDER BY e.ref ASC';
	$rows = array();
	foreach (mjl_projects_fetch_all($sql) as $row) {
		$row['status_label'] = mjl_projects_expense_status_label($row['status']);
		$rows[] = $row;
	}
	return $rows;
}

function mjl_projects_document_rows($projectId)
{
	$documents = array();
	foreach (mjl_projects_activity_rows($projectId) as $activity) {
		foreach (mjl_activity_document_download_rows((int) $activity['rowid']) as $row) {
			$documents[] = mjl_projects_document_row($row, 'activity', 'Activite', $activity['ref']);
		}
	}
	foreach (mjl_projects_expense_rows($projectId) as $expense) {
		foreach (mjl_expense_document_download_rows((int) $expense['rowid']) as $row) {
			$documents[] = mjl_projects_document_row($row, 'expense', 'Depense', $expense['ref']);
		}
	}
	foreach (mjl_projects_convention_rows($projectId) as $convention) {
		foreach (mjl_convention_document_download_rows((int) $convention['rowid']) as $row) {
			$documents[] = mjl_projects_document_row($row, 'convention', 'Convention', $convention['ref']);
		}
	}
	foreach (mjl_projects_fund_receipt_rows($projectId) as $receipt) {
		foreach (mjl_fund_receipt_document_download_rows((int) $receipt['rowid']) as $row) {
			$documents[] = mjl_projects_document_row($row, 'fundreceipt', 'Fonds recu', $receipt['ref']);
		}
	}
	return $documents;
}

function mjl_projects_document_row($row, $downloadType, $typeLabel, $objectRef)
{
	return array('rowid' => (int) $row['rowid'], 'name' => mjl_expense_document_display_filename($row), 'download_type' => $downloadType, 'type_label' => $typeLabel, 'object_ref' => $objectRef);
}

function mjl_projects_convention_rows($projectId)
{
	global $db, $conf, $user;
	if (!mjl_workspace_can_access_reference_data($user, 'convention')) return array();
	return mjl_projects_fetch_all('SELECT rowid, ref, title AS label FROM '.$db->prefix().'mjlfinancement_convention WHERE entity = '.((int) $conf->entity).' AND fk_project = '.((int) $projectId).' ORDER BY ref ASC');
}

function mjl_projects_fund_receipt_rows($projectId)
{
	global $db, $conf, $user;
	if (!mjl_workspace_can_access_reference_data($user, 'fundreceipt')) return array();
	return mjl_projects_fetch_all('SELECT rowid, ref, comment AS label FROM '.$db->prefix().'mjlfinancement_fund_receipt WHERE entity = '.((int) $conf->entity).' AND fk_project = '.((int) $projectId).' ORDER BY ref ASC');
}

function mjl_projects_note_rows($projectId)
{
	global $db, $conf;
	$sql = 'SELECT n.message, n.date_note, u.login AS author FROM '.$db->prefix().'mjlfinancement_project_note n';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = n.fk_user_author';
	$sql .= ' WHERE n.entity = '.((int) $conf->entity).' AND n.fk_project = '.((int) $projectId);
	$sql .= ' ORDER BY n.date_note DESC, n.rowid DESC';
	return mjl_projects_fetch_all($sql);
}

function mjl_projects_can_open($project)
{
	global $user;
	return mjl_workspace_can_access_supervision($user)
		|| (mjl_activities_is_readonly_consultation() && mjl_expenses_is_readonly_consultation())
		|| !empty(mjl_projects_activity_rows((int) $project['rowid']))
		|| !empty(mjl_projects_expense_rows((int) $project['rowid']));
}

function mjl_projects_can_add_note($project)
{
	global $user;
	if (mjl_workspace_can_access_supervision($user)) return true;
	if (mjl_activities_is_readonly_consultation() && mjl_expenses_is_readonly_consultation()) return false;
	return mjl_projects_can_open($project) && ($user->hasRight('mjlfinancement', 'activity', 'write') || $user->hasRight('mjlfinancement', 'expense', 'write') || $user->hasRight('mjlfinancement', 'activity', 'validate') || $user->hasRight('mjlfinancement', 'expense', 'validate'));
}

function mjl_projects_scope_sql($alias)
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

function mjl_projects_fetch_all($sql)
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

function mjl_projects_status_label($status)
{
	return ((int) $status === 1) ? 'Ouvert' : 'Brouillon / clos';
}

function mjl_projects_activity_status_label($status)
{
	$labels = array(0 => 'Brouillon', 1 => 'En cours', 2 => 'Terminee', 3 => 'Soumise', 4 => 'Correction demandee', 5 => 'Corrigee', 6 => 'Validee', 8 => 'Rejetee', 9 => 'Annulee');
	return isset($labels[(int) $status]) ? $labels[(int) $status] : 'Statut '.$status;
}

function mjl_projects_expense_status_label($status)
{
	$labels = array(0 => 'Brouillon', 1 => 'Soumise', 2 => 'Validee', 3 => 'Corrigee', 8 => 'Rejetee');
	return isset($labels[(int) $status]) ? $labels[(int) $status] : 'Statut '.$status;
}

function mjl_projects_price($value)
{
	return function_exists('price') ? price((float) $value, 0, '', 1, -1, -1, 'XOF') : number_format((float) $value, 0, ',', ' ').' XOF';
}

function mjl_projects_date($value)
{
	return trim((string) $value) === '' ? 'Non renseignee' : (string) $value;
}

function mjl_projects_actor_role()
{
	global $user;
	if (!empty($user->admin)) return 'ADMIN';
	if (mjl_workspace_can_access_supervision($user)) return 'DPAF';
	if ($user->hasRight('mjlfinancement', 'activity', 'validate') || $user->hasRight('mjlfinancement', 'expense', 'validate')) return 'SUPERVISEUR';
	return 'AGENT';
}
