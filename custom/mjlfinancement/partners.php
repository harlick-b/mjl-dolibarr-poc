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
	print '<tr class="liste_titre"><th>Partenaire / Programme</th><th>Portefeuille</th><th>Financement</th><th>Execution financiere</th><th>Validation</th><th>Alertes</th><th>Documents</th></tr>';
	foreach ($rows as $row) {
		$executionRate = mjl_partners_percent($row['financial_execution_rate']);
		$validationRate = mjl_partners_percent($row['financial_validation_rate']);
		$balanceTone = (float) $row['available_balance'] < 0 ? 'Alerte allocation' : 'Disponible';
		print '<tr class="oddeven">';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/partners.php?id='.((int) $row['rowid']).'">'.dol_escape_htmltag($row['nom']).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($row['email']).'</span></td>';
		print '<td>'.((int) $row['projects_count']).' projet(s)<br><span class="opacitymedium">'.((int) $row['activities_in_progress']).' activite(s) en cours</span></td>';
		print '<td>'.mjl_partners_price($row['funds_received']).'<br><span class="opacitymedium">Budget alloue '.mjl_partners_price($row['allocated_budget']).'</span></td>';
		print '<td>'.mjl_partners_price($row['final_validated_amount']).'<br><span class="opacitymedium">'.$executionRate.' execute, '.$balanceTone.' '.mjl_partners_price($row['available_balance']).'</span></td>';
		print '<td>'.$validationRate.'<br><span class="opacitymedium">'.((int) $row['expenses_to_prevalidate']).' prevalidation, '.((int) $row['expenses_to_final_validate']).' finale</span></td>';
		print '<td>'.((int) $row['overdue_activities']).' retard<br><span class="opacitymedium">'.((int) $row['missing_justificatifs']).' piece(s) manquante(s)</span></td>';
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
		array('label' => 'Financement total recu', 'value' => mjl_partners_price($row['funds_received']), 'context' => 'Receptions marquees recues uniquement', 'href' => '/custom/mjlfinancement/fundreceipts.php', 'action' => 'Voir les fonds', 'status' => 'Tresorerie', 'tone' => 'neutral'),
		array('label' => 'Budget alloue', 'value' => mjl_partners_price($row['allocated_budget']), 'context' => 'Lignes budgetaires rattachees', 'href' => '/custom/mjlfinancement/budgetlines.php', 'action' => 'Voir les budgets', 'status' => 'Allocation', 'tone' => 'neutral'),
		array('label' => 'Budget non alloue', 'value' => mjl_partners_price($row['unallocated_budget']), 'context' => (float) $row['unallocated_budget'] < 0 ? 'Allocation superieure aux fonds recus' : 'Fonds recus non alloues', 'href' => '/custom/mjlfinancement/budgetlines.php', 'action' => 'Voir les budgets', 'status' => (float) $row['unallocated_budget'] < 0 ? 'Surallocation' : 'Disponible', 'tone' => (float) $row['unallocated_budget'] < 0 ? 'warning' : 'neutral'),
		array('label' => 'Depenses validees', 'value' => mjl_partners_price($row['final_validated_amount']), 'context' => 'Montants valides definitivement', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Voir les depenses', 'status' => 'Validation', 'tone' => 'neutral'),
		array('label' => 'Depenses decaissees', 'value' => mjl_partners_price($row['disbursed_amount']), 'context' => 'Paiements effectivement enregistres', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Voir les depenses', 'status' => 'Decaissement', 'tone' => 'neutral'),
		array('label' => 'Solde disponible', 'value' => mjl_partners_price($row['available_balance']), 'context' => 'Fonds recus moins depenses decaissees', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Voir les depenses', 'status' => (float) $row['available_balance'] < 0 ? 'Alerte' : 'Disponible', 'tone' => (float) $row['available_balance'] < 0 ? 'warning' : 'neutral'),
		array('label' => 'Taux execution financiere', 'value' => mjl_partners_percent($row['financial_execution_rate']), 'context' => 'Depenses validees / budget alloue', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Voir les depenses', 'status' => 'Execution', 'tone' => 'neutral'),
		array('label' => 'Taux validation financiere', 'value' => mjl_partners_percent($row['financial_validation_rate']), 'context' => 'Depenses validees / depenses soumises', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Voir les depenses', 'status' => 'Validation', 'tone' => 'neutral'),
		array('label' => 'Execution physique moyenne', 'value' => mjl_partners_percent($row['physical_execution_average']), 'context' => 'Moyenne des activites rattachees', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activites', 'status' => 'Physique', 'tone' => 'neutral'),
		array('label' => 'Validation en attente', 'value' => ((int) $row['expenses_to_prevalidate'] + (int) $row['expenses_to_final_validate']), 'context' => ((int) $row['expenses_to_prevalidate']).' a prevalider, '.((int) $row['expenses_to_final_validate']).' a valider definitivement', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Voir les depenses', 'status' => 'File', 'tone' => ((int) $row['expenses_to_prevalidate'] + (int) $row['expenses_to_final_validate']) > 0 ? 'warning' : 'neutral'),
		array('label' => 'Activites en retard', 'value' => (string) $row['overdue_activities'], 'context' => 'Activites ouvertes apres echeance', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activites', 'status' => 'Alerte', 'tone' => (int) $row['overdue_activities'] > 0 ? 'warning' : 'neutral'),
		array('label' => 'Pieces manquantes', 'value' => (string) $row['missing_justificatifs'], 'context' => 'Depenses sans document ECM telechargeable', 'href' => '/custom/mjlfinancement/documents.php', 'action' => 'Voir les documents', 'status' => 'Justificatifs', 'tone' => (int) $row['missing_justificatifs'] > 0 ? 'warning' : 'neutral'),
	);
	mjl_dashboard_render_card_section('Synthese', 'Vue consolidee des objets accessibles pour ce partenaire ou programme.', $cards);
	mjl_partners_render_identity($row);
	mjl_partners_render_related('Projets lies', mjl_partners_project_rows($partnerId), 'projects.php');
	mjl_partners_render_related('Enveloppes de financement', mjl_partners_convention_rows($partnerId), 'conventions.php');
	mjl_partners_render_related('Lignes budgetaires', mjl_partners_budget_line_rows($partnerId), 'budgetlines.php');
	mjl_partners_render_related('Activites liees', mjl_partners_activity_rows($partnerId), 'activities.php');
	mjl_partners_render_related('Depenses liees', mjl_partners_expense_rows($partnerId), 'expenses.php');
	mjl_partners_render_related('Fonds recus', mjl_partners_fund_receipt_rows($partnerId), 'fundreceipts.php');
	mjl_partners_render_documents($partnerId);
	mjl_partners_render_alerts($row);
	mjl_partners_render_timeline($partnerId);
	mjl_partners_render_assigned_users($partnerId);
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

function mjl_partners_render_identity($row)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Identite partenaire / programme</h2><p>Informations issues du tiers Dolibarr actif.</p></div>';
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="oddeven"><td><strong>Nom</strong></td><td>'.dol_escape_htmltag($row['nom']).'</td></tr>';
	print '<tr class="oddeven"><td><strong>Email</strong></td><td>'.dol_escape_htmltag($row['email'] ?: 'Non renseigne').'</td></tr>';
	print '<tr class="oddeven"><td><strong>Telephone</strong></td><td>'.dol_escape_htmltag($row['phone'] ?: 'Non renseigne').'</td></tr>';
	print '<tr class="oddeven"><td><strong>Derniere activite / decision</strong></td><td>'.dol_escape_htmltag($row['latest_activity_decision'] ?: 'Aucune trace').'</td></tr>';
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

function mjl_partners_render_alerts($row)
{
	$alerts = array();
	if ((float) $row['unallocated_budget'] < 0) $alerts[] = array('label' => 'Budget non alloue negatif', 'detail' => 'Les budgets alloues depassent les fonds recus de '.mjl_partners_price(abs((float) $row['unallocated_budget'])).'.');
	if ((int) $row['overdue_activities'] > 0) $alerts[] = array('label' => 'Activites en retard', 'detail' => ((int) $row['overdue_activities']).' activite(s) ouverte(s) ont depasse leur date de fin.');
	if ((int) $row['expenses_to_prevalidate'] > 0) $alerts[] = array('label' => 'Prevalidation attendue', 'detail' => ((int) $row['expenses_to_prevalidate']).' depense(s) sont soumises.');
	if ((int) $row['expenses_to_final_validate'] > 0) $alerts[] = array('label' => 'Validation definitive attendue', 'detail' => ((int) $row['expenses_to_final_validate']).' depense(s) sont prevalidees.');
	if ((int) $row['final_validated_not_disbursed'] > 0) $alerts[] = array('label' => 'Decaissement attendu', 'detail' => ((int) $row['final_validated_not_disbursed']).' depense(s) validees ne sont pas encore decaissees.');
	if ((int) $row['missing_justificatifs'] > 0) $alerts[] = array('label' => 'Pieces justificatives manquantes', 'detail' => ((int) $row['missing_justificatifs']).' depense(s) n ont pas de document telechargeable.');
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Alertes</h2><p>Points de vigilance calcules depuis les donnees rattachees au partenaire.</p></div>';
	if (empty($alerts)) {
		print '<div class="mjl-empty-state">Aucune alerte portefeuille.</div></section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Alerte</th><th>Detail</th></tr>';
	foreach ($alerts as $alert) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($alert['label']).'</td><td>'.dol_escape_htmltag($alert['detail']).'</td></tr>';
	}
	print '</table></div></section>';
}

function mjl_partners_render_timeline($partnerId)
{
	$items = mjl_partners_timeline_rows($partnerId);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Historique contextuel</h2><p>Dernieres decisions, notes et echanges lisibles dans ce perimetre, sans creation de commentaire.</p></div>';
	if (empty($items)) {
		print '<div class="mjl-empty-state">Aucune activite contextuelle.</div></section>';
		return;
	}
	print '<ol class="mjl-activity-timeline">';
	foreach ($items as $item) {
		print '<li><strong>'.dol_escape_htmltag($item['title']).'</strong> <span class="opacitymedium">'.dol_escape_htmltag($item['meta']).'</span>';
		if ($item['comment'] !== '') print '<p class="mjl-timeline-comment">'.dol_escape_htmltag($item['comment']).'</p>';
		print '</li>';
	}
	print '</ol></section>';
}

function mjl_partners_render_assigned_users($partnerId)
{
	global $user;
	if (!mjl_scope_is_platform_admin($user)) return;
	$rows = mjl_partners_assigned_user_rows($partnerId);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Utilisateurs assignes</h2><p>Visible uniquement par l administrateur plateforme.</p></div>';
	if (empty($rows)) {
		print '<div class="mjl-empty-state">Aucun utilisateur actif assigne.</div></section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Utilisateur</th><th>Role</th><th>Debut</th></tr>';
	foreach ($rows as $row) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($row['login']).'<br><span class="opacitymedium">'.dol_escape_htmltag(trim($row['firstname'].' '.$row['lastname'])).'</span></td><td>'.dol_escape_htmltag(mjl_scope_role_label($row['role_code'])).'</td><td>'.dol_escape_htmltag(mjl_partners_date($row['date_start'])).'</td></tr>';
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
	$budgetAmountSql = mjl_expense_budget_amount_sql('e');
	$disbursedAmountSql = mjl_expense_disbursed_amount_sql('e');
	$budgetStatuses = mjl_expense_status_sql_list(mjl_expense_budget_consuming_statuses());
	$disbursedStatuses = mjl_expense_status_sql_list(mjl_expense_disbursed_statuses());
	return 'SELECT s.rowid, s.nom, s.email, s.phone,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'projet p WHERE p.entity = s.entity AND p.fk_soc = s.rowid), 0) AS projects_count,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_convention c WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) AS envelopes_count,'
		.' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) AS allocated_budget,'
		.' COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = s.entity AND fr.fk_soc = s.rowid AND fr.status = 1), 0) AS funds_received,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) AS activities_count,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND a.status IN (1,3,4,5,7)), 0) AS activities_in_progress,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND a.date_end IS NOT NULL AND a.date_end < CURDATE() AND a.status IN (0,1,3,4,5,7)), 0) AS overdue_activities,'
		.' COALESCE((SELECT AVG(COALESCE(a.physical_execution_percent, 0)) FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) AS physical_execution_average,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) AS expenses_count,'
		.' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status IN (1,3,4,6,7)), 0) AS submitted_expense_amount,'
		.' COALESCE((SELECT SUM('.$budgetAmountSql.') FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status IN ('.$budgetStatuses.')), 0) AS final_validated_amount,'
		.' COALESCE((SELECT SUM('.$disbursedAmountSql.') FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status IN ('.$disbursedStatuses.')), 0) AS disbursed_amount,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status = 1), 0) AS expenses_to_prevalidate,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status = 4), 0) AS expenses_to_final_validate,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status IN (2,6)), 0) AS final_validated_not_disbursed,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND NOT EXISTS (SELECT 1 FROM '.$db->prefix().'ecm_files fd WHERE fd.entity = e.entity AND fd.src_object_type = \'mjlfinancement_expense\' AND fd.src_object_id = e.rowid)), 0) AS missing_justificatifs,'
		.' (COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = s.entity AND fr.fk_soc = s.rowid AND fr.status = 1), 0) - COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0)) AS unallocated_budget,'
		.' (COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = s.entity AND fr.fk_soc = s.rowid AND fr.status = 1), 0) - COALESCE((SELECT SUM('.$disbursedAmountSql.') FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status IN ('.$disbursedStatuses.')), 0)) AS available_balance,'
		.' CASE WHEN COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0) > 0 THEN (COALESCE((SELECT SUM('.$budgetAmountSql.') FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status IN ('.$budgetStatuses.')), 0) / COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid), 0)) * 100 ELSE 0 END AS financial_execution_rate,'
		.' CASE WHEN COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status IN (1,3,4,6,7)), 0) > 0 THEN (COALESCE((SELECT SUM('.$budgetAmountSql.') FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status IN ('.$budgetStatuses.')), 0) / COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE c.entity = s.entity AND c.fk_soc = s.rowid AND e.status IN (1,3,4,6,7)), 0)) * 100 ELSE 0 END AS financial_validation_rate,'
		.' COALESCE((SELECT CONCAT(w.action, \' - \', w.action_date) FROM '.$db->prefix().'mjlfinancement_workflow_action w WHERE w.entity = s.entity AND ('
		.' EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE w.object_type = \'mjlfinancement_activity\' AND w.object_id = a.rowid AND c.fk_soc = s.rowid)'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE w.object_type = \'mjlfinancement_expense\' AND w.object_id = e.rowid AND c.fk_soc = s.rowid)'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_convention c WHERE w.object_type = \'mjlfinancement_convention\' AND w.object_id = c.rowid AND c.fk_soc = s.rowid)'
		.' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE w.object_type = \'mjlfinancement_fund_receipt\' AND w.object_id = fr.rowid AND fr.fk_soc = s.rowid)'
		.') ORDER BY w.action_date DESC, w.rowid DESC LIMIT 1), \'\') AS latest_activity_decision,'
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
	$rows = mjl_partners_fetch_all('SELECT rowid, ref, title AS label, fk_statut AS status FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' AND fk_soc = '.((int) $partnerId).' ORDER BY ref ASC');
	foreach ($rows as &$row) $row['status_label'] = ((int) $row['status'] === 1 ? 'Ouvert' : 'Brouillon / clos');
	return $rows;
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
	$sql = 'SELECT a.rowid, a.ref, a.label, a.status, a.fk_user_creat FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE a.entity = '.((int) $conf->entity).' AND c.fk_soc = '.((int) $partnerId).' ORDER BY a.ref ASC';
	$rows = mjl_partners_fetch_all($sql);
	foreach ($rows as &$row) $row['status_label'] = mjl_partners_activity_status($row['status']);
	return $rows;
}

function mjl_partners_expense_rows($partnerId)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'expense', 'read')) return array();
	$sql = 'SELECT e.rowid, e.ref, e.description AS label, e.status, e.fk_user_creat FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE e.entity = '.((int) $conf->entity).' AND c.fk_soc = '.((int) $partnerId).' ORDER BY e.ref ASC';
	$rows = mjl_partners_fetch_all($sql);
	foreach ($rows as &$row) $row['status_label'] = mjl_partners_expense_status($row['status']);
	return $rows;
}

function mjl_partners_budget_line_rows($partnerId)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'budgetline', 'read')) return array();
	$rows = mjl_partners_fetch_all('SELECT bl.rowid, bl.ref, bl.label, bl.status FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE bl.entity = '.((int) $conf->entity).' AND c.fk_soc = '.((int) $partnerId).' ORDER BY bl.ref ASC');
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

function mjl_partners_timeline_rows($partnerId)
{
	$rows = array_merge(
		mjl_partners_workflow_timeline_rows($partnerId),
		mjl_partners_project_note_timeline_rows($partnerId),
		mjl_partners_exchange_timeline_rows($partnerId)
	);
	usort($rows, function ($a, $b) {
		if ($a['sort_date'] === $b['sort_date']) return (int) $b['rowid'] - (int) $a['rowid'];
		return strcmp($b['sort_date'], $a['sort_date']);
	});
	return array_slice($rows, 0, 12);
}

function mjl_partners_workflow_timeline_rows($partnerId)
{
	global $db, $conf;
	$sql = 'SELECT w.rowid, w.action_date AS sort_date, w.action, w.comment, w.object_type, w.actor_role, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity).' AND (';
	$sql .= ' EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE w.object_type = \'mjlfinancement_activity\' AND w.object_id = a.rowid AND c.fk_soc = '.((int) $partnerId).')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE w.object_type = \'mjlfinancement_expense\' AND w.object_id = e.rowid AND c.fk_soc = '.((int) $partnerId).')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_convention c WHERE w.object_type = \'mjlfinancement_convention\' AND w.object_id = c.rowid AND c.fk_soc = '.((int) $partnerId).')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE w.object_type = \'mjlfinancement_budget_line\' AND w.object_id = bl.rowid AND c.fk_soc = '.((int) $partnerId).')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE w.object_type = \'mjlfinancement_fund_receipt\' AND w.object_id = fr.rowid AND fr.fk_soc = '.((int) $partnerId).')';
	$sql .= ') ORDER BY w.action_date DESC, w.rowid DESC LIMIT 12';
	$items = array();
	foreach (mjl_partners_fetch_all($sql) as $row) {
		$items[] = array('rowid' => (int) $row['rowid'], 'sort_date' => $row['sort_date'], 'title' => mjl_partners_action_label($row['action']), 'meta' => mjl_partners_date($row['sort_date']).' par '.($row['login'] ?: 'systeme').' ('.mjl_partners_actor_role_label($row['actor_role']).')', 'comment' => (string) $row['comment']);
	}
	return $items;
}

function mjl_partners_project_note_timeline_rows($partnerId)
{
	global $db, $conf;
	$sql = 'SELECT n.rowid, n.date_note AS sort_date, n.message, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_project_note n';
	$sql .= ' INNER JOIN '.$db->prefix().'projet p ON p.rowid = n.fk_project AND p.entity = n.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = n.fk_user_author';
	$sql .= ' WHERE n.entity = '.((int) $conf->entity).' AND p.fk_soc = '.((int) $partnerId);
	$sql .= ' ORDER BY n.date_note DESC, n.rowid DESC LIMIT 12';
	$items = array();
	foreach (mjl_partners_fetch_all($sql) as $row) {
		$items[] = array('rowid' => (int) $row['rowid'], 'sort_date' => $row['sort_date'], 'title' => 'Note projet', 'meta' => mjl_partners_date($row['sort_date']).' par '.($row['login'] ?: 'systeme'), 'comment' => (string) $row['message']);
	}
	return $items;
}

function mjl_partners_exchange_timeline_rows($partnerId)
{
	global $db, $conf;
	$sql = 'SELECT x.rowid, x.exchange_date AS sort_date, x.subject, x.message, x.actor_role, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_exchange_log x';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = x.actor';
	$sql .= ' WHERE x.entity = '.((int) $conf->entity).' AND (';
	$sql .= ' EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE x.object_type = \'mjlfinancement_activity\' AND x.object_id = a.rowid AND c.fk_soc = '.((int) $partnerId).')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity WHERE x.object_type = \'mjlfinancement_expense\' AND x.object_id = e.rowid AND c.fk_soc = '.((int) $partnerId).')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_convention c WHERE x.object_type = \'mjlfinancement_convention\' AND x.object_id = c.rowid AND c.fk_soc = '.((int) $partnerId).')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity WHERE x.object_type = \'mjlfinancement_budget_line\' AND x.object_id = bl.rowid AND c.fk_soc = '.((int) $partnerId).')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE x.object_type = \'mjlfinancement_fund_receipt\' AND x.object_id = fr.rowid AND fr.fk_soc = '.((int) $partnerId).')';
	$sql .= ' OR EXISTS (SELECT 1 FROM '.$db->prefix().'projet p WHERE x.object_type = \'mjlfinancement_project\' AND x.object_id = p.rowid AND p.fk_soc = '.((int) $partnerId).')';
	$sql .= ') ORDER BY x.exchange_date DESC, x.rowid DESC LIMIT 12';
	$items = array();
	foreach (mjl_partners_fetch_all($sql) as $row) {
		$items[] = array('rowid' => (int) $row['rowid'], 'sort_date' => $row['sort_date'], 'title' => $row['subject'] ?: 'Echange contextualise', 'meta' => mjl_partners_date($row['sort_date']).' par '.($row['login'] ?: 'systeme').' ('.mjl_partners_actor_role_label($row['actor_role']).')', 'comment' => (string) $row['message']);
	}
	return $items;
}

function mjl_partners_assigned_user_rows($partnerId)
{
	global $db, $conf;
	$sql = 'SELECT u.login, u.firstname, u.lastname, r.role_code, s.date_start';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_user_soc_scope s';
	$sql .= ' INNER JOIN '.$db->prefix().'user u ON u.rowid = s.fk_user AND u.entity = s.entity';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_user_role r ON r.fk_user = u.rowid AND r.entity = s.entity AND r.is_active = 1';
	$sql .= ' WHERE s.entity = '.((int) $conf->entity).' AND s.fk_soc = '.((int) $partnerId).' AND s.is_active = 1 AND u.statut = 1';
	$sql .= ' ORDER BY u.login ASC';
	return mjl_partners_fetch_all($sql);
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

function mjl_partners_activity_status($status)
{
	$map = array(0 => 'Brouillon', 1 => 'En cours', 2 => 'Terminee', 3 => 'Soumise', 4 => 'Correction demandee', 5 => 'Corrigee', 6 => 'Validee definitivement', 7 => 'Prevalidee', 8 => 'Rejetee', 9 => 'Annulee');
	return isset($map[(int) $status]) ? $map[(int) $status] : 'Statut '.$status;
}

function mjl_partners_expense_status($status)
{
	$map = array(0 => 'Brouillon', 1 => 'Soumise', 2 => 'Validee definitivement (compatibilite historique)', 3 => 'Corrigee', 4 => 'Prevalidee', 6 => 'Validee definitivement', 7 => 'Decaissee', 8 => 'Rejetee');
	return isset($map[(int) $status]) ? $map[(int) $status] : 'Statut '.$status;
}

function mjl_partners_action_label($action)
{
	$map = array('created' => 'Creation', 'field_changed' => 'Modification', 'document_uploaded' => 'Document ajoute', 'submitted' => 'Soumission', 'prevalidated' => 'Prevalidation', 'validated' => 'Validation', 'final_validated' => 'Validation definitive', 'disbursed' => 'Decaissement', 'rejected' => 'Rejet', 'corrected' => 'Correction', 'closed' => 'Cloture', 'activated' => 'Activation');
	return isset($map[$action]) ? $map[$action] : (string) $action;
}

function mjl_partners_actor_role_label($role)
{
	return $role !== '' ? mjl_scope_role_label($role) : 'Role non renseigne';
}

function mjl_partners_price($value)
{
	return function_exists('price') ? price((float) $value, 0, '', 1, -1, -1, 'XOF') : number_format((float) $value, 0, ',', ' ').' XOF';
}

function mjl_partners_percent($value)
{
	return number_format((float) $value, 1, ',', ' ').' %';
}

function mjl_partners_date($value)
{
	$value = trim((string) $value);
	if ($value === '') return 'Non renseigne';
	return function_exists('dol_print_date') ? dol_print_date(strtotime($value), 'dayhour') : $value;
}
