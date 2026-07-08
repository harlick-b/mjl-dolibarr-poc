<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_expense_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';

mjl_workspace_require_partners_access($user);

$partnerId = GETPOSTINT('id');

llxHeader('', 'Partenaires / Programmes MJL');
mjl_navigation_shell_start($user, 'partners');
print '<div class="mjl-workspace">';

if ($partnerId > 0) {
	mjl_partners_render_detail($partnerId);
} else {
	mjl_partners_render_list();
}

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_partners_render_list()
{
	$rows = mjl_partners_rows();
	mjl_dashboard_render_header(
		'Partenaires / Programmes',
		'Consulter les perimetres MJL representes par les tiers Dolibarr actifs.',
		'Consultation',
		count($rows).' partenaire(s)'
	);

	print '<section class="mjl-workspace-section">';
	if (empty($rows)) {
		print '<div class="mjl-empty-state">Aucun partenaire ou programme accessible dans votre perimetre.</div>';
		print '</section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Partenaire / Programme</th><th>Projets</th><th>Enveloppes</th><th>Budgets</th><th>Fonds recus</th><th>Activites</th><th>Depenses</th><th>Documents</th></tr>';
	foreach ($rows as $row) {
		print '<tr class="oddeven">';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/partners.php?id='.((int) $row['rowid']).'">'.dol_escape_htmltag($row['nom']).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($row['email']).'</span></td>';
		print '<td>'.((int) $row['projects_count']).'</td>';
		print '<td>'.((int) $row['envelopes_count']).'</td>';
		print '<td>'.mjl_partners_price($row['budget_total']).'</td>';
		print '<td>'.mjl_partners_price($row['funds_received']).'</td>';
		print '<td>'.((int) $row['activities_count']).'</td>';
		print '<td>'.((int) $row['expenses_count']).'</td>';
		print '<td>'.((int) $row['documents_count']).'</td>';
		print '</tr>';
	}
	print '</table></div></section>';
}

function mjl_partners_render_detail($partnerId)
{
	$row = mjl_partners_fetch($partnerId);
	if (empty($row) || !mjl_scope_can_access_fk_soc($GLOBALS['user'], (int) $row['rowid'])) {
		accessforbidden();
	}

	mjl_dashboard_render_header(
		'Partenaire / Programme '.$row['nom'],
		trim((string) $row['email']) !== '' ? $row['email'] : 'Consultation du perimetre et des objets MJL rattaches.',
		'Perimetre',
		mjl_scope_is_platform_admin($GLOBALS['user']) ? 'Admin' : 'Assigne'
	);
	print '<p><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/partners.php">Retour aux partenaires</a></p>';

	$cards = array(
		array('label' => 'Projets', 'value' => (string) $row['projects_count'], 'context' => 'Projets rattaches', 'href' => '/custom/mjlfinancement/projects.php', 'action' => 'Voir les projets', 'status' => 'Portefeuille', 'tone' => 'neutral'),
		array('label' => 'Enveloppes', 'value' => (string) $row['envelopes_count'], 'context' => 'Enveloppes de financement', 'href' => '/custom/mjlfinancement/conventions.php', 'action' => 'Voir les enveloppes', 'status' => 'Financement', 'tone' => 'neutral'),
		array('label' => 'Budgets', 'value' => mjl_partners_price($row['budget_total']), 'context' => 'Lignes budgetaires', 'href' => '/custom/mjlfinancement/budgetlines.php', 'action' => 'Voir les budgets', 'status' => 'Execution', 'tone' => 'neutral'),
		array('label' => 'Fonds recus', 'value' => mjl_partners_price($row['funds_received']), 'context' => 'Receptions confirmees', 'href' => '/custom/mjlfinancement/fundreceipts.php', 'action' => 'Voir les fonds', 'status' => 'Tresorerie', 'tone' => 'neutral'),
	);
	mjl_dashboard_render_card_section('Synthese', 'Vue consolidee des objets accessibles pour ce partenaire ou programme.', $cards);
	mjl_partners_render_related('Projets lies', mjl_partners_project_rows($partnerId), 'projects.php');
	mjl_partners_render_related('Enveloppes de financement', mjl_partners_convention_rows($partnerId), 'conventions.php');
	mjl_partners_render_related('Activites liees', mjl_partners_activity_rows($partnerId), 'activities.php');
	mjl_partners_render_related('Depenses liees', mjl_partners_expense_rows($partnerId), 'expenses.php');
	mjl_partners_render_related('Fonds recus', mjl_partners_fund_receipt_rows($partnerId), 'fundreceipts.php');
	mjl_partners_render_documents($partnerId);
}

function mjl_partners_render_related($title, $rows, $route)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>'.dol_escape_htmltag($title).'</h2><p>Elements limites au perimetre actif.</p></div>';
	if (empty($rows)) {
		print '<div class="mjl-empty-state">Aucun element accessible.</div></section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Reference</th><th>Libelle</th><th>Statut</th></tr>';
	foreach ($rows as $item) {
		print '<tr class="oddeven"><td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/'.$route.'?id='.((int) $item['rowid']).'">'.dol_escape_htmltag($item['ref']).'</a></td><td>'.dol_escape_htmltag($item['label']).'</td><td>'.dol_escape_htmltag($item['status_label']).'</td></tr>';
	}
	print '</table></div></section>';
}

function mjl_partners_render_documents($partnerId)
{
	$documents = mjl_partners_document_rows($partnerId);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Documents lies</h2><p>Telechargements controles par les routes MJL.</p></div>';
	if (empty($documents)) {
		print '<div class="mjl-empty-state">Aucun document accessible.</div></section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Document</th><th>Type</th><th>Objet lie</th><th>Action</th></tr>';
	foreach ($documents as $document) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($document['name']).'</td><td>'.dol_escape_htmltag($document['type_label']).'</td><td>'.dol_escape_htmltag($document['object_ref']).'</td><td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/documentdownload.php?type='.urlencode($document['download_type']).'&id='.((int) $document['rowid']).'">Telecharger</a></td></tr>';
	}
	print '</table></div></section>';
}

function mjl_partners_rows()
{
	global $db, $conf, $user;
	$sql = mjl_partners_base_sql();
	$sql .= ' WHERE s.entity = '.((int) $conf->entity).' AND s.status = 1';
	$sql .= mjl_scope_partner_sql_filter('s.rowid', $user);
	$sql .= ' ORDER BY s.nom ASC';
	return mjl_partners_fetch_all($sql);
}

function mjl_partners_fetch($partnerId)
{
	global $conf;
	$sql = mjl_partners_base_sql();
	$sql .= ' WHERE s.entity = '.((int) $conf->entity).' AND s.rowid = '.((int) $partnerId);
	$rows = mjl_partners_fetch_all($sql);
	return empty($rows) ? array() : $rows[0];
}

function mjl_partners_base_sql()
{
	global $db;
	return 'SELECT s.rowid, s.nom, s.email, s.phone,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'projet p WHERE p.entity = s.entity AND p.fk_soc = s.rowid), 0) AS projects_count,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_convention c WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) AS envelopes_count,'
		.' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) AS budget_total,'
		.' COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = s.entity AND fr.fk_soc = s.rowid AND fr.status = 1), 0) AS funds_received,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) AS activities_count,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) AS expenses_count,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'ecm_files f WHERE f.entity = s.entity AND ('
		.' EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE f.src_object_type = \'mjlfinancement_activity\' AND f.src_object_id = a.rowid AND c.fk_soc = s.rowid)'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE f.src_object_type = \'mjlfinancement_expense\' AND f.src_object_id = e.rowid AND c.fk_soc = s.rowid)'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_convention c WHERE f.src_object_type = \'mjlfinancement_convention\' AND f.src_object_id = c.rowid AND c.fk_soc = s.rowid)'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE f.src_object_type = \'mjlfinancement_fund_receipt\' AND f.src_object_id = fr.rowid AND fr.fk_soc = s.rowid)'
		.')), 0) AS documents_count'
		.' FROM '.$db->prefix().'societe s';
}

function mjl_partners_project_rows($partnerId)
{
	global $db, $conf;
	return mjl_partners_fetch_all('SELECT rowid, ref, title AS label, fk_statut AS status FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' AND fk_soc = '.((int) $partnerId).' ORDER BY ref ASC');
}

function mjl_partners_convention_rows($partnerId)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'convention', 'read')) return array();
	$rows = mjl_partners_fetch_all('SELECT rowid, ref, title AS label, status FROM '.$db->prefix().'mjlfinancement_convention WHERE entity = '.((int) $conf->entity).' AND fk_soc = '.((int) $partnerId).' ORDER BY ref ASC');
	foreach ($rows as &$row) $row['status_label'] = mjl_partners_status($row['status']);
	return $rows;
}

function mjl_partners_activity_rows($partnerId)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'activity', 'read')) return array();
	$sql = 'SELECT a.rowid, a.ref, a.label, a.status, a.fk_user_creat FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE a.entity = '.((int) $conf->entity).' AND c.fk_soc = '.((int) $partnerId).mjl_activities_scope_sql('a').' ORDER BY a.ref ASC';
	$rows = mjl_partners_fetch_all($sql);
	foreach ($rows as &$row) $row['status_label'] = mjl_partners_status($row['status']);
	return $rows;
}

function mjl_partners_expense_rows($partnerId)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'expense', 'read')) return array();
	$sql = 'SELECT e.rowid, e.ref, e.description AS label, e.status, e.fk_user_creat FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE e.entity = '.((int) $conf->entity).' AND c.fk_soc = '.((int) $partnerId).mjl_expenses_scope_sql('e').' ORDER BY e.ref ASC';
	$rows = mjl_partners_fetch_all($sql);
	foreach ($rows as &$row) $row['status_label'] = mjl_partners_status($row['status']);
	return $rows;
}

function mjl_partners_fund_receipt_rows($partnerId)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'fundreceipt', 'read')) return array();
	$rows = mjl_partners_fetch_all('SELECT rowid, ref, comment AS label, status FROM '.$db->prefix().'mjlfinancement_fund_receipt WHERE entity = '.((int) $conf->entity).' AND fk_soc = '.((int) $partnerId).' ORDER BY ref ASC');
	foreach ($rows as &$row) $row['status_label'] = mjl_partners_status($row['status']);
	return $rows;
}

function mjl_partners_document_rows($partnerId)
{
	$documents = array();
	foreach (mjl_partners_activity_rows($partnerId) as $activity) foreach (mjl_activity_document_download_rows((int) $activity['rowid']) as $row) $documents[] = mjl_partners_document_row($row, 'activity', 'Activite', $activity['ref']);
	foreach (mjl_partners_expense_rows($partnerId) as $expense) foreach (mjl_expense_document_download_rows((int) $expense['rowid']) as $row) $documents[] = mjl_partners_document_row($row, 'expense', 'Depense', $expense['ref']);
	foreach (mjl_partners_convention_rows($partnerId) as $convention) foreach (mjl_convention_document_download_rows((int) $convention['rowid']) as $row) $documents[] = mjl_partners_document_row($row, 'convention', 'Enveloppe', $convention['ref']);
	foreach (mjl_partners_fund_receipt_rows($partnerId) as $receipt) foreach (mjl_fund_receipt_document_download_rows((int) $receipt['rowid']) as $row) $documents[] = mjl_partners_document_row($row, 'fundreceipt', 'Fonds recu', $receipt['ref']);
	return $documents;
}

function mjl_partners_document_row($row, $downloadType, $typeLabel, $objectRef)
{
	return array('rowid' => (int) $row['rowid'], 'name' => mjl_expense_document_display_filename($row), 'download_type' => $downloadType, 'type_label' => $typeLabel, 'object_ref' => $objectRef);
}

function mjl_partners_fetch_all($sql)
{
	global $db;
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return array();
	}
	$rows = array();
	while ($obj = $db->fetch_object($resql)) $rows[] = (array) $obj;
	return $rows;
}

function mjl_partners_status($status)
{
	$map = array(0 => 'Brouillon', 1 => 'Actif', 2 => 'Clos', 3 => 'Soumis', 4 => 'Correction', 5 => 'Corrige', 6 => 'Valide', 8 => 'Rejete', 9 => 'Annule');
	return isset($map[(int) $status]) ? $map[(int) $status] : 'Statut '.$status;
}

function mjl_partners_price($value)
{
	return function_exists('price') ? price((float) $value, 0, '', 1, -1, -1, 'XOF') : number_format((float) $value, 0, ',', ' ').' XOF';
}
