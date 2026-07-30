<?php
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlfundreceipt.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_table.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_journey.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_finance_feedback.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_finance_recovery.lib.php';

// CLI verification may load the production renderer functions with an
// in-memory database adapter; this constant is not selectable by HTTP input.
if (defined('MJL_FINANCE_RENDERERS_ONLY') && MJL_FINANCE_RENDERERS_ONLY) {
	return;
}

mjl_workspace_require_reference_data_access($user, 'fundreceipt');

$action = GETPOST('action', 'aZ09');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		mjl_fundreceipts_forbidden('Jeton de sécurité invalide');
	}
	if ($action !== 'add_exchange' && !mjl_fundreceipts_can_manage()) {
		mjl_fundreceipts_forbidden();
	}
	mjl_fundreceipts_handle_post($action);
}

$receiptId = GETPOSTINT('id');
$mjl_fundreceipt_recovery = mjl_form_recovery_consume_route(
	GETPOST('mjl_recovery', 'alphanohtml'),
	array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'fundreceipts', 'object_id' => $receiptId),
	mjl_finance_recovery_consume_allowlist('fundreceipts')
);

llxHeader('', 'Réceptions de fonds MJL');
mjl_navigation_shell_start($user, 'fundreceipts');
print '<div class="mjl-workspace mjl-fundreceipt-workspace">';

if ($receiptId > 0) {
	mjl_fundreceipts_render_detail($receiptId);
} else {
	mjl_fundreceipts_render_list_page();
}

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_fundreceipts_handle_post($action)
{
	global $db, $user, $conf;

	if ($action === 'create') {
		$receipt = new MjlFundReceipt($db);
		$receipt->entity = (int) $conf->entity;
		$receipt->ref = GETPOST('ref', 'alphanohtml');
		$receipt->fk_convention = GETPOSTINT('fk_convention');
		if (!mjl_fundreceipts_can_use_convention((int) $receipt->fk_convention)) {
			mjl_fundreceipts_forbidden('Enveloppe hors de votre périmètre');
		}
		$receipt->amount = GETPOST('amount', 'alpha');
		$receipt->reception_date = GETPOST('reception_date', 'alphanohtml');
		$receipt->comment = GETPOST('comment', 'restricthtml');
		$receipt->note_public = GETPOST('note_public', 'restricthtml');
		$receipt->note_private = GETPOST('note_private', 'restricthtml');
		$receipt->fk_user_creat = $user->id;
		$result = $receipt->createDraft($user);
		if ($result <= 0) {
			$feedback = mjl_finance_feedback_domain('fundreceipts', 'create', 0, $receipt->error);
			setEventMessages(mjl_finance_feedback_domain_message('fundreceipts', 'create', $feedback), null, 'errors');
			mjl_fundreceipts_redirect(0, mjl_fundreceipts_store_recovery('create', 0, $feedback));
		}
		setEventMessages('Réception de fonds créée en brouillon', null, 'mesgs');
		mjl_fundreceipts_redirect((int) $result);
	}

	$id = GETPOSTINT('id');
	$receipt = new MjlFundReceipt($db);
	if ($id <= 0 || $receipt->fetch($id) <= 0 || (int) $receipt->entity !== (int) $conf->entity) {
		mjl_fundreceipts_forbidden('Réception de fonds introuvable ou hors de votre périmètre');
	}
	if (!mjl_scope_can_access_object($user, 'mjlfinancement_fund_receipt', $id)) {
		mjl_fundreceipts_forbidden('Réception de fonds hors de votre périmètre');
	}

	if ($action === 'add_exchange') {
		list($result, $message) = mjl_timeline_create_comment($user, 'mjlfinancement_fund_receipt', $id, GETPOST('message', 'restricthtml'));
		setEventMessages($message, null, $result > 0 ? 'mesgs' : 'errors');
		mjl_fundreceipts_redirect($id, $result > 0 ? '' : mjl_fundreceipts_store_recovery('add_exchange', $id, $message));
	}

	if ($action === 'update') {
		$failureAction = 'update';
		if (!mjl_fundreceipts_can_use_convention(GETPOSTINT('fk_convention'))) {
			mjl_fundreceipts_forbidden('Enveloppe hors de votre périmètre');
		}
		$result = $receipt->updateGovernedFields($user, array(
			'ref' => GETPOST('ref', 'alphanohtml'),
			'fk_convention' => GETPOSTINT('fk_convention'),
			'amount' => GETPOST('amount', 'alpha'),
			'reception_date' => GETPOST('reception_date', 'alphanohtml'),
			'comment' => GETPOST('comment', 'restricthtml'),
			'note_public' => GETPOST('note_public', 'restricthtml'),
			'note_private' => GETPOST('note_private', 'restricthtml'),
		), GETPOST('change_comment', 'restricthtml'));
	} elseif ($action === 'upload') {
		$failureAction = 'upload';
		$result = $receipt->uploadProof($user, isset($_FILES['supporting_document']) ? $_FILES['supporting_document'] : array());
	} elseif ($action === 'received') {
		$failureAction = 'received';
		$result = $receipt->markReceived($user, GETPOST('status_comment', 'restricthtml'));
	} elseif ($action === 'not_received') {
		$failureAction = 'not_received';
		$result = $receipt->markNotReceived($user, GETPOST('status_comment', 'restricthtml'));
	} else {
		mjl_fundreceipts_redirect($id);
	}

	if ($result < 0) {
		$feedback = mjl_finance_feedback_domain('fundreceipts', $failureAction, $id, $receipt->error);
		setEventMessages(mjl_finance_feedback_domain_message('fundreceipts', $failureAction, $feedback), null, 'errors');
		$recoveryHandle = $failureAction === 'upload' ? '' : mjl_fundreceipts_store_recovery($failureAction, $id, $feedback);
	} elseif ($result === 0) {
		setEventMessages('Aucun changement appliqué', null, 'warnings');
	} else {
		setEventMessages('Action sur la réception de fonds enregistrée', null, 'mesgs');
	}
	mjl_fundreceipts_redirect($id, $recoveryHandle ?? '');
}

function mjl_fundreceipts_render_list_page()
{
	$options = array(
		'partner' => mjl_fundreceipts_options('partner'),
		'project' => mjl_fundreceipts_options('project'),
		'convention' => mjl_fundreceipts_options('convention_all'),
	);
	$filters = mjl_table_normalize_generic(array(
		'partner_id' => GETPOST('partner_id', 'alphanohtml'),
		'project_id' => GETPOST('project_id', 'alphanohtml'),
		'convention_id' => GETPOST('convention_id', 'alphanohtml'),
		'status' => GETPOST('status', 'alphanohtml'),
		'date_start' => GETPOST('date_start', 'alphanohtml'),
		'date_end' => GETPOST('date_end', 'alphanohtml'),
		'sort' => GETPOST('sort', 'alphanohtml'),
		'page' => GETPOST('page', 'alphanohtml'),
	), array(
		'partner_id' => array('type' => 'id', 'allowed' => array_keys($options['partner']), 'default' => 0),
		'project_id' => array('type' => 'id', 'allowed' => array_keys($options['project']), 'default' => 0),
		'convention_id' => array('type' => 'id', 'allowed' => array_keys($options['convention']), 'default' => 0),
		'status' => array('type' => 'enum', 'allowed' => array('0', '1', '8'), 'default' => ''),
		'date_start' => array('type' => 'text', 'default' => ''),
		'date_end' => array('type' => 'text', 'default' => ''),
		'sort' => array('type' => 'enum', 'allowed' => array('recent', 'amount', 'ref'), 'default' => 'recent'),
		'page' => array('type' => 'page', 'default' => 1),
	), 50);
	foreach (array('date_start', 'date_end') as $dateKey) {
		if ($filters[$dateKey] !== '' && mjl_fundreceipts_valid_date($filters[$dateKey]) === '') $filters['fail_closed'] = true;
	}
	if ($filters['date_start'] !== '' && $filters['date_end'] !== '' && $filters['date_start'] > $filters['date_end']) $filters['fail_closed'] = true;
	if ($filters['fail_closed']) $filters['page'] = 1;
	mjl_dashboard_render_header(
		'Gestion des réceptions de fonds',
		'Enregistrer les tranches reçues, contrôler la preuve documentaire et garder une trace auditable des décisions.',
		'Périmètre',
		mjl_fundreceipts_can_manage() ? 'Validateur définitif / Administrateur plateforme' : 'Consultation',
		'Fonds reçus'
	);

	if (mjl_fundreceipts_can_manage()) {
		mjl_fundreceipts_render_create_form();
	}
	mjl_fundreceipts_render_filters($filters, $options);
	mjl_fundreceipts_render_list($filters);
}

function mjl_fundreceipts_render_detail($id)
{
	$row = mjl_fundreceipts_fetch_detail($id);
	if (empty($row)) {
		mjl_fundreceipts_forbidden('Réception de fonds introuvable ou hors de votre périmètre');
	}
	$canManage = mjl_fundreceipts_can_manage();

	print '<p><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php">Retour aux fonds reçus</a></p>';
	mjl_dashboard_render_header(
		$row['ref'],
		mjl_fundreceipts_next_action_label($row),
		'Statut',
		mjl_fundreceipt_status_label($row['status']),
		'Réception de fonds'
	);

	print '<div class="mjl-activity-detail-grid">';
	mjl_fundreceipts_render_summary($row);
	if ($canManage) {
		mjl_fundreceipts_render_edit_form($row);
	}
	print '</div>';
	mjl_fundreceipts_render_document_panel($row, $canManage);
	mjl_fundreceipts_render_actions($row, $canManage);
	mjl_fundreceipts_render_timeline($row);
}

function mjl_fundreceipts_render_create_form()
{
	$values = mjl_finance_recovery_values($GLOBALS['mjl_fundreceipt_recovery'] ?? null, 'create');
	print '<section class="mjl-workspace-section mjl-activity-panel">';
	print '<div class="mjl-section-heading"><h2>Nouvelle réception de fonds</h2><p>Créer un brouillon rattaché à une enveloppe active. Le partenaire / programme et le projet éventuel sont dérivés de l enveloppe.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php">';
	print '<input type="hidden" name="action" value="create"><input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'">';
	mjl_fundreceipts_render_fields($values, false, 'create');
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Créer la réception"></div>';
	print '</form></section>';
}

function mjl_fundreceipts_render_edit_form($row)
{
	$recovery = $GLOBALS['mjl_fundreceipt_recovery'] ?? null;
	$row = array_merge($row, mjl_finance_recovery_values($recovery, 'edit'));
	$errors = is_array($recovery) && (string) ($recovery['context']['form'] ?? '') === 'edit' ? (array) ($recovery['errors'] ?? array()) : array();
	$finalized = (int) $row['status'] !== MjlFundReceipt::STATUS_DRAFT;
	print '<section class="mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Paramètres de réception</h2><p>'.($finalized ? 'La réception est finalisée : les champs financiers sont verrouillés.' : 'Modifier le brouillon avant marquage comme reçu ou non reçu.').'</p></div>';
	if ($finalized) {
		print '<div class="mjl-empty-state">Aucune modification possible après décision finale.</div></section>';
		return;
	}
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php?id='.((int) $row['rowid']).'">';
	print '<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row['rowid']).'"><input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'">';
	mjl_fundreceipts_render_fields($row, false, 'edit');
	print mjl_form_field('change_comment', 'Motif de modification', '<input required name="change_comment" value="'.dol_escape_htmltag($row['change_comment'] ?? '').'">', true, '', $errors['change_comment'] ?? '', 'mjl-fundreceipt-edit-');
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Enregistrer"></div>';
	print '</form></section>';
}

function mjl_fundreceipts_render_fields($row, $locked, $form)
{
	$disabled = $locked ? ' disabled' : '';
	$recovery = $GLOBALS['mjl_fundreceipt_recovery'] ?? null;
	$errors = is_array($recovery) && (string) ($recovery['context']['form'] ?? '') === $form ? (array) ($recovery['errors'] ?? array()) : array();
	$prefix = 'mjl-fundreceipt-'.$form.'-';
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($errors, 'Corrigez les champs indiqués', $prefix).'</div>';
	print mjl_form_field('ref', 'Référence', '<input required name="ref" value="'.dol_escape_htmltag($row['ref'] ?? '').'"'.$disabled.'>', true, '', $errors['ref'] ?? '', $prefix);
	print mjl_form_field('fk_convention', 'Enveloppe active', mjl_fundreceipts_select('fk_convention', mjl_fundreceipts_options('convention'), (int) ($row['fk_convention'] ?? 0), true, $locked), true, '', $errors['fk_convention'] ?? '', $prefix);
	print mjl_form_field('amount', 'Montant', '<input name="amount" value="'.dol_escape_htmltag($row['amount'] ?? '').'"'.$disabled.'>', false, '', $errors['amount'] ?? '', $prefix);
	print mjl_form_field('reception_date', 'Date de réception', '<input type="date" name="reception_date" value="'.dol_escape_htmltag(mjl_fundreceipts_date_value($row['reception_date'] ?? '')).'"'.$disabled.'>', false, '', $errors['reception_date'] ?? '', $prefix);
	print mjl_form_field('comment', 'Commentaire', '<textarea name="comment"'.$disabled.'>'.dol_escape_htmltag($row['comment'] ?? '').'</textarea>', false, '', $errors['comment'] ?? '', $prefix);
	print mjl_form_field('note_public', 'Note publique', '<textarea name="note_public">'.dol_escape_htmltag($row['note_public'] ?? '').'</textarea>', false, '', $errors['note_public'] ?? '', $prefix);
	print mjl_form_field('note_private', 'Note privée', '<textarea name="note_private">'.dol_escape_htmltag($row['note_private'] ?? '').'</textarea>', false, '', $errors['note_private'] ?? '', $prefix);
}

function mjl_fundreceipts_render_filters($filters, $options)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Filtres</h2><p>Limiter la vue par projet, enveloppe, statut ou date de réception.</p></div>';
	print '<form method="GET" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php">';
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent"><tr class="liste_titre"><th>Partenaire / Programme</th><th>Projet</th><th>Enveloppe</th><th>Statut</th><th>Date de début</th><th>Date de fin</th><th>Tri</th><th></th></tr>';
	print '<tr class="oddeven">';
	print '<td>'.mjl_fundreceipts_select('partner_id', $options['partner'], $filters['partner_id'], false, false, 'Tous').'</td>';
	print '<td>'.mjl_fundreceipts_select('project_id', $options['project'], $filters['project_id'], false, false, 'Tous').'</td>';
	print '<td>'.mjl_fundreceipts_select('convention_id', $options['convention'], $filters['convention_id'], false, false, 'Toutes').'</td>';
	print '<td>'.mjl_fundreceipts_status_select($filters['status']).'</td>';
	print '<td><input type="date" name="date_start" value="'.dol_escape_htmltag($filters['date_start']).'"></td>';
	print '<td><input type="date" name="date_end" value="'.dol_escape_htmltag($filters['date_end']).'"></td>';
	print '<td><select name="sort"><option value="recent"'.($filters['sort'] === 'recent' ? ' selected' : '').'>Plus récentes</option><option value="amount"'.($filters['sort'] === 'amount' ? ' selected' : '').'>Montant décroissant</option><option value="ref"'.($filters['sort'] === 'ref' ? ' selected' : '').'>Référence</option></select></td>';
	print '<td><input class="button" type="submit" value="Afficher"></td>';
	print '</tr></table></div></form></section>';
}

function mjl_fundreceipts_render_list($filters)
{
	global $db, $conf;
	$where = array('fr.entity = '.((int) $conf->entity));
	if (!empty($filters['fail_closed'])) $where[] = '1 = 0';
	if ($filters['partner_id'] > 0) $where[] = 'fr.fk_soc = '.((int) $filters['partner_id']);
	if ($filters['project_id'] > 0) $where[] = 'fr.fk_project = '.((int) $filters['project_id']);
	if ($filters['convention_id'] > 0) $where[] = 'fr.fk_convention = '.((int) $filters['convention_id']);
	if ($filters['status'] !== '') $where[] = 'fr.status = '.((int) $filters['status']);
	if (mjl_fundreceipts_valid_date($filters['date_start']) !== '') $where[] = "fr.reception_date >= '".$db->escape($filters['date_start'])."'";
	if (mjl_fundreceipts_valid_date($filters['date_end']) !== '') $where[] = "fr.reception_date <= '".$db->escape($filters['date_end'])."'";

	$from = ' FROM '.$db->prefix().'mjlfinancement_fund_receipt fr';
	$from .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = fr.fk_project AND p.entity = fr.entity';
	$from .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = fr.fk_convention AND c.entity = fr.entity';
	$from .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = fr.fk_soc AND s.entity = fr.entity';
	$whereSql = ' WHERE '.implode(' AND ', $where).mjl_scope_partner_sql_filter('fr.fk_soc', $GLOBALS['user']);
	$total = mjl_table_count_or_null($db, 'SELECT COUNT(*) AS nb'.$from.$whereSql);
	$sql = 'SELECT fr.rowid, fr.ref, fr.amount, fr.reception_date, fr.supporting_document, fr.status, p.ref AS project_ref, c.ref AS convention_ref, s.nom AS ptf_name,';
	$sql .= ' CASE WHEN '.mjl_fund_receipt_document_present_sql('fr').' THEN 1 ELSE 0 END AS document_present';
	$sql .= $from.$whereSql;
	if ($filters['sort'] === 'amount') $sql .= ' ORDER BY fr.amount DESC, fr.rowid DESC';
	elseif ($filters['sort'] === 'ref') $sql .= ' ORDER BY fr.ref ASC, fr.rowid ASC';
	else $sql .= ' ORDER BY fr.reception_date DESC, fr.rowid DESC';
	$sql .= ' LIMIT '.(((int) $filters['page_size']) + 1).' OFFSET '.(((int) $filters['page'] - 1) * (int) $filters['page_size']);
	$query = mjl_finance_source_query($db, $sql, 'fundreceipts', 'list', 0);
	$resql = $query['result'];
	print '<section class="mjl-workspace-section"><div class="mjl-section-heading"><h2>Portefeuille fonds reçus</h2><p>Seules les réceptions marquées reçues alimentent les totaux financiers.</p></div>';
	if (!$resql) {
		print '<div class="mjl-empty-state mjl-empty-state-warning">'.dol_escape_htmltag(mjl_finance_feedback_source_message('fundreceipts', 'list', $query['feedback'])).'</div></section>';
		return;
	}
	print '<div class="div-table-responsive-no-min mjl-dashboard-table"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Réception</th><th>Partenaire / Programme</th><th>Projet</th><th>Enveloppe</th><th>Date</th><th class="right">Montant</th><th>Preuve</th><th>Statut</th></tr>';
	$rows = array();
	while ($obj = $db->fetch_object($resql)) $rows[] = $obj;
	$hasNext = count($rows) > (int) $filters['page_size'];
	if ($hasNext) array_pop($rows);
	$count = 0;
	foreach ($rows as $obj) {
		$count++;
		$state = mjl_fund_receipt_evidence_state((int) $obj->rowid, (int) $conf->entity, $obj->supporting_document);
		print '<tr class="oddeven">';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php?id='.((int) $obj->rowid).'">'.dol_escape_htmltag($obj->ref).'</a></td>';
		print '<td>'.dol_escape_htmltag($obj->ptf_name).'</td>';
		print '<td>'.dol_escape_htmltag($obj->project_ref).'</td>';
		print '<td>'.dol_escape_htmltag($obj->convention_ref).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_fundreceipts_format_date($obj->reception_date)).'</td>';
		print '<td class="right">'.price($obj->amount).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_fundreceipts_evidence_label($state)).'</td>';
		print '<td>'.mjl_fundreceipts_status_badge($obj->status).'</td>';
		print '</tr>';
	}
	if ($count === 0) {
		print '<tr class="oddeven"><td colspan="8">Aucune réception de fonds dans votre périmètre.</td></tr>';
	}
	print '</table></div>';
	print mjl_table_render_pagination(DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php', $filters, $total, (int) $filters['page'] > 1, $hasNext, 'réceptions de fonds');
	print '</section>';
}

function mjl_fundreceipts_render_summary($row)
{
	$state = mjl_fund_receipt_evidence_state((int) $row['rowid'], (int) $row['entity'], $row['supporting_document']);
	print mjl_journey_render_summary(array(
		'title' => 'Synthèse de la réception',
		'description' => 'Rattachement financier et preuve documentaire.',
		'items' => array(
			array('label' => 'Statut', 'value' => mjl_fundreceipt_status_label($row['status']), 'tone' => (int) $row['status'] === MjlFundReceipt::STATUS_RECEIVED ? 'success' : ((int) $row['status'] === MjlFundReceipt::STATUS_NOT_RECEIVED ? 'danger' : 'warning')),
			array('label' => 'Partenaire / Programme', 'value' => $row['ptf_name']),
			array('label' => 'Projet', 'value' => $row['project_ref'] ? $row['project_ref'].' - '.$row['project_title'] : 'Enveloppe globale'),
			array('label' => 'Enveloppe', 'value' => $row['convention_ref'].' - '.$row['convention_title']),
			array('label' => 'Date de réception', 'value' => mjl_fundreceipts_format_date($row['reception_date'])),
			array('label' => 'Montant', 'value' => price($row['amount'])),
			array('label' => 'Preuve', 'value' => mjl_fundreceipts_evidence_label($state), 'tone' => $state === 'downloadable' ? 'success' : 'warning'),
			array('label' => 'Commentaire', 'value' => $row['comment']),
		),
	));
}

function mjl_fundreceipts_render_document_panel($row, $canManage)
{
	$state = mjl_fund_receipt_evidence_state((int) $row['rowid'], (int) $row['entity'], $row['supporting_document']);
	$documents = mjl_fund_receipt_document_download_rows((int) $row['rowid']);
	$publicDocumentLabel = mjl_fund_receipt_public_document_label((int) $row['rowid'], (int) $row['entity'], $row['supporting_document']);
	$modelDocuments = array();
	foreach ($documents as $document) $modelDocuments[] = array('label' => mjl_fund_receipt_document_display_filename($document), 'url' => '/custom/mjlfinancement/documentdownload.php?type=fundreceipt&id='.((int) $document['rowid']));
	if (empty($modelDocuments) && $state === 'unavailable' && $publicDocumentLabel !== '') $modelDocuments[] = array('label' => $publicDocumentLabel, 'url' => '');
	print mjl_journey_render_document_panel(array(
		'title' => 'Preuve documentaire',
		'description' => 'Document bancaire ou avis de crédit servi par les routes MJL.',
		'state' => $state,
		'state_label' => mjl_fundreceipts_evidence_label($state).($publicDocumentLabel !== '' ? ' — '.$publicDocumentLabel : ''),
		'documents' => $modelDocuments,
		'link_label' => 'Télécharger la preuve',
	));
	if ($canManage && (int) $row['status'] === MjlFundReceipt::STATUS_DRAFT) {
		print '<section class="mjl-workspace-section mjl-activity-card"><div class="mjl-section-heading"><h2>Ajouter une preuve</h2><p>Ajout contextuel à cette réception.</p></div>';
		print '<form class="mjl-activity-form" method="POST" enctype="multipart/form-data" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php?id='.((int) $row['rowid']).'">';
		print '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="action" value="upload"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
		print '<label>Preuve de réception<input required type="file" name="supporting_document"></label>';
		print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Ajouter la preuve"></div>';
		print '</form>';
		print '</section>';
	}
}

function mjl_fundreceipts_render_actions($row, $canManage)
{
	if (!$canManage) return;
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Cycle de vie</h2><p>Décision finale après vérification du montant, de la date et de la preuve.</p></div>';
	if ((int) $row['status'] === MjlFundReceipt::STATUS_DRAFT) {
		mjl_fundreceipts_action_form($row['rowid'], 'received', 'Marquer comme reçu', 'Commentaire de réception', false);
		mjl_fundreceipts_action_form($row['rowid'], 'not_received', 'Marquer non reçu', 'Motif obligatoire', true);
	} else {
		print '<div class="mjl-empty-state">Décision finale enregistrée. Les montants ne sont plus modifiables.</div>';
	}
	print '</section>';
}

function mjl_fundreceipts_action_form($id, $action, $label, $commentLabel, $required)
{
	$recovery = $GLOBALS['mjl_fundreceipt_recovery'] ?? null;
	$matchesRecovery = is_array($recovery) && (string) ($recovery['context']['action'] ?? '') === $action;
	$values = $matchesRecovery ? (array) ($recovery['values'] ?? array()) : array();
	$errors = $matchesRecovery ? (array) ($recovery['errors'] ?? array()) : array();
	$prefix = 'mjl-fundreceipt-decision-'.$action.'-';
	print '<form class="mjl-activity-action-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php?id='.((int) $id).'">';
	print '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="action" value="'.dol_escape_htmltag($action).'"><input type="hidden" name="id" value="'.((int) $id).'">';
	print mjl_form_error_summary($errors, 'Corrigez la décision', $prefix);
	print mjl_form_field('status_comment', $commentLabel, '<input'.($required ? ' required' : '').' name="status_comment" value="'.dol_escape_htmltag($values['status_comment'] ?? '').'">', $required, '', $errors['status_comment'] ?? '', $prefix);
	print '<input class="button" type="submit" value="'.dol_escape_htmltag($label).'">';
	print '</form>';
}

function mjl_fundreceipts_render_timeline($row)
{
	$items = mjl_fundreceipts_timeline_items($row);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Historique réception de fonds</h2><p>Création, modifications, preuves, décisions finales et commentaires.</p></div>';
	mjl_timeline_render_comment_form('mjlfinancement_fund_receipt', (int) $row['rowid'], DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php?id='.((int) $row['rowid']), $GLOBALS['mjl_fundreceipt_recovery'] ?? array());
	print '<ol class="mjl-activity-timeline">';
	foreach ($items as $item) {
		print '<li><span class="mjl-status-pill">'.dol_escape_htmltag($item['label']).'</span>';
		print '<strong>'.dol_escape_htmltag($item['title']).'</strong>';
		print '<p>'.dol_escape_htmltag($item['meta']).'</p>';
		if ($item['comment'] !== '') print '<p class="mjl-timeline-comment">'.dol_escape_htmltag($item['comment']).'</p>';
		if (!empty($item['changes'])) {
			print '<details><summary>Détails</summary><ul>';
			foreach ($item['changes'] as $field => $change) print '<li>'.dol_escape_htmltag($field).': '.dol_escape_htmltag(mjl_fundreceipts_change_text($change)).'</li>';
			print '</ul></details>';
		}
		print '</li>';
	}
	print '</ol></section>';
}

function mjl_fundreceipts_fetch_detail($id)
{
	global $db, $conf;
	$sql = 'SELECT fr.rowid, fr.entity, fr.ref, fr.fk_soc, fr.fk_project, fr.fk_convention, fr.amount, fr.reception_date, fr.supporting_document, fr.comment, fr.status, fr.note_public, fr.note_private, fr.date_creation,';
	$sql .= ' p.ref AS project_ref, p.title AS project_title, c.ref AS convention_ref, c.title AS convention_title, s.nom AS ptf_name, u.login AS creator_login,';
	$sql .= ' '.mjl_fund_receipt_supporting_document_sql('fr').' AS supporting_document_resolved';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_fund_receipt fr';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = fr.fk_project AND p.entity = fr.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = fr.fk_convention AND c.entity = fr.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = fr.fk_soc';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = fr.fk_user_creat';
	$sql .= ' WHERE fr.entity = '.((int) $conf->entity).' AND fr.rowid = '.((int) $id);
	$sql .= mjl_scope_partner_sql_filter('fr.fk_soc', $GLOBALS['user']);
	$query = mjl_finance_source_query($db, $sql, 'fundreceipts', 'fetch_detail', $id);
	$resql = $query['result'];
	if (!$resql) {
		setEventMessages(mjl_finance_feedback_source_message('fundreceipts', 'fetch_detail', $query['feedback']), null, 'errors');
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_fundreceipts_timeline_items($row)
{
	global $db, $conf;
	$items = array();
	$hasCreatedAction = false;
	$sql = 'SELECT w.action, w.from_status, w.to_status, w.actor_role, w.action_date, w.comment, w.changes_json, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity).' AND w.object_type = \'mjlfinancement_fund_receipt\' AND w.object_id = '.((int) $row['rowid']);
	$sql .= ' ORDER BY w.action_date ASC, w.rowid ASC';
	$query = mjl_finance_source_query($db, $sql, 'fundreceipts', 'timeline', (int) $row['rowid']);
	$resql = $query['result'];
	if (!$resql) {
		setEventMessages(mjl_finance_feedback_source_message('fundreceipts', 'timeline', $query['feedback']), null, 'errors');
		return array(mjl_fundreceipts_legacy_creation_timeline_item($row));
	}
	while ($obj = $db->fetch_object($resql)) {
		if ((string) $obj->action === 'created') {
			$hasCreatedAction = true;
		}
		$changes = json_decode((string) $obj->changes_json, true);
		$title = mjl_fundreceipts_timeline_title($obj->action, $obj->from_status, $obj->to_status);
		$comment = trim((string) $obj->comment);
		if ($comment === $title) {
			$comment = '';
		}
		$items[] = array(
			'label' => mjl_fundreceipt_action_label($obj->action),
			'title' => $title,
			'meta' => mjl_fundreceipts_timeline_meta($obj->action, $obj->action_date, $obj->login, $obj->actor_role, $row),
			'comment' => $comment,
			'changes' => is_array($changes) ? $changes : array(),
		);
	}
	if (!$hasCreatedAction) {
		array_unshift($items, mjl_fundreceipts_legacy_creation_timeline_item($row));
	}
	foreach (mjl_timeline_exchange_items('mjlfinancement_fund_receipt', (int) $row['rowid'], true) as $item) {
		$items[] = $item;
	}
	return $items;
}

function mjl_fundreceipts_legacy_creation_timeline_item($row)
{
	return array(
		'label' => 'Création',
		'title' => 'Réception de fonds créée',
		'meta' => mjl_fundreceipts_format_datetime($row['date_creation']).' par '.$row['creator_login'],
		'comment' => '',
		'changes' => array(),
	);
}

function mjl_fundreceipts_timeline_title($action, $fromStatus, $toStatus)
{
	$action = (string) $action;
	$fromStatus = (string) $fromStatus;
	$toStatus = (string) $toStatus;
	if ($action === 'created') {
		return 'Réception de fonds créée';
	}
	if ($fromStatus === '' || $toStatus === '' || $fromStatus === $toStatus) {
		return mjl_fundreceipt_action_label($action);
	}
	return mjl_fundreceipt_status_label($fromStatus).' vers '.mjl_fundreceipt_status_label($toStatus);
}

function mjl_fundreceipts_timeline_meta($action, $actionDate, $login, $actorRole, $fallbackRow)
{
	$date = mjl_fundreceipts_format_datetime($actionDate);
	if ($date === '') {
		$date = mjl_fundreceipts_format_datetime($fallbackRow['date_creation']);
	}
	$actor = trim((string) $login);
	if ($actor === '') {
		$actor = trim((string) $fallbackRow['creator_login']);
	}
	$meta = trim($date.' par '.$actor);
	$roleLabel = mjl_timeline_presentation_actor_role_label('mjlfinancement_fund_receipt', $action, $actorRole);
	if ($roleLabel !== '') {
		$meta .= ' ('.$roleLabel.')';
	}
	return $meta;
}

function mjl_fundreceipts_options($type)
{
	global $db, $conf;
	if ($type === 'partner') {
		$sql = 'SELECT rowid, nom AS label FROM '.$db->prefix().'societe s WHERE s.entity = '.((int) $conf->entity).' AND s.status = 1'.mjl_scope_partner_sql_filter('s.rowid', $GLOBALS['user']).' ORDER BY s.nom, s.rowid';
	} elseif ($type === 'project') {
		$sql = 'SELECT rowid, CONCAT(ref, \' - \', title) AS label FROM '.$db->prefix().'projet p WHERE p.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('p.fk_soc', $GLOBALS['user']).' ORDER BY p.ref';
	} elseif ($type === 'convention') {
		$sql = 'SELECT c.rowid, CONCAT(c.ref, \' - \', c.title, \' (\', COALESCE(p.ref, \'global\'), \' / \', s.nom, \')\') AS label FROM '.$db->prefix().'mjlfinancement_convention c LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity INNER JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc WHERE c.entity = '.((int) $conf->entity).' AND c.status = '.MjlConvention::STATUS_ACTIVE.mjl_scope_partner_sql_filter('c.fk_soc', $GLOBALS['user']).' ORDER BY c.ref';
	} elseif ($type === 'convention_all') {
		$sql = 'SELECT rowid, CONCAT(ref, \' - \', title) AS label FROM '.$db->prefix().'mjlfinancement_convention c WHERE c.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('c.fk_soc', $GLOBALS['user']).' ORDER BY c.ref';
	} else {
		return array();
	}
	$resql = $db->query($sql);
	$options = array();
	if ($resql) while ($obj = $db->fetch_object($resql)) $options[(int) $obj->rowid] = (string) $obj->label;
	return $options;
}

function mjl_fundreceipts_can_use_convention($fkConvention)
{
	global $db, $conf, $user;
	$fkConvention = (int) $fkConvention;
	if ($fkConvention <= 0) return false;
	$sql = 'SELECT c.rowid, c.fk_soc, c.fk_project FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity).' AND c.rowid = '.$fkConvention.' AND c.status = '.MjlConvention::STATUS_ACTIVE;
	$sql .= ' AND (c.fk_project IS NULL OR p.rowid IS NOT NULL)';
	$resql = $db->query($sql);
	$row = $resql ? $db->fetch_object($resql) : null;
	return $row && mjl_scope_can_access_fk_soc($user, (int) $row->fk_soc);
}

function mjl_fundreceipts_select($name, $options, $selected, $required, $disabled, $emptyLabel = 'Aucun')
{
	$html = '<select name="'.dol_escape_htmltag($name).'"'.($required ? ' required' : '').($disabled ? ' disabled' : '').'>';
	if (!$required || $emptyLabel !== '') $html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	foreach ($options as $value => $label) $html .= '<option value="'.((int) $value).'"'.((int) $selected === (int) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	return $html.'</select>';
}

function mjl_fundreceipts_status_select($selected)
{
	$options = array('' => 'Tous', (string) MjlFundReceipt::STATUS_DRAFT => 'Brouillon', (string) MjlFundReceipt::STATUS_RECEIVED => 'Reçu', (string) MjlFundReceipt::STATUS_NOT_RECEIVED => 'Non reçu');
	$html = '<select name="status">';
	foreach ($options as $value => $label) $html .= '<option value="'.dol_escape_htmltag($value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	return $html.'</select>';
}

function mjl_fundreceipts_can_manage()
{
	global $user;
	return mjl_workspace_can_access_supervision($user) && $user->hasRight('mjlfinancement', 'fundreceipt', 'write');
}

function mjl_fundreceipt_status_label($status)
{
	return mjl_timeline_presentation_status_label('mjlfinancement_fund_receipt', $status);
}

function mjl_fundreceipt_action_label($action)
{
	return mjl_timeline_presentation_action_label('mjlfinancement_fund_receipt', $action);
}

function mjl_fundreceipt_actor_role_label($role)
{
	return mjl_timeline_presentation_actor_role_label('mjlfinancement_fund_receipt', '', $role);
}

function mjl_fundreceipts_status_badge($status)
{
	$tone = (int) $status === MjlFundReceipt::STATUS_DRAFT ? 'warning' : ((int) $status === MjlFundReceipt::STATUS_NOT_RECEIVED ? 'danger' : 'neutral');
	return '<span class="mjl-status-pill'.($tone !== 'neutral' ? ' mjl-status-'.$tone : '').'">'.dol_escape_htmltag(mjl_fundreceipt_status_label($status)).'</span>';
}

function mjl_fundreceipts_next_action_label($row)
{
	if ((int) $row['status'] === MjlFundReceipt::STATUS_DRAFT) return 'Ajouter la preuve puis marquer la réception comme reçue ou non reçue.';
	if ((int) $row['status'] === MjlFundReceipt::STATUS_RECEIVED) return 'Fonds reçus et pris en compte dans les totaux financiers.';
	return 'Fonds marqués non reçus et exclus des totaux financiers.';
}

function mjl_fundreceipts_evidence_label($state)
{
	$map = array('downloadable' => 'Disponible', 'unavailable' => 'Référence indisponible', 'missing' => 'Manquante');
	return isset($map[$state]) ? $map[$state] : (string) $state;
}

function mjl_fundreceipts_change_text($change)
{
	if (is_array($change) && array_key_exists('before', $change) && array_key_exists('after', $change)) return (string) $change['before'].' -> '.(string) $change['after'];
	if (is_array($change)) return implode(', ', array_map('strval', $change));
	return (string) $change;
}

function mjl_fundreceipts_date_value($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? date('Y-m-d', $time) : '';
}

function mjl_fundreceipts_format_date($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'day') : (string) $value;
}

function mjl_fundreceipts_format_datetime($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'dayhour') : (string) $value;
}

function mjl_fundreceipts_valid_date($value)
{
	if ($value === '') return '';
	if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $value)) return '';
	$parts = explode('-', (string) $value);
	return checkdate((int) $parts[1], (int) $parts[2], (int) $parts[0]) ? (string) $value : '';
}

function mjl_fundreceipts_forbidden($message = '')
{
	if (function_exists('http_response_code')) http_response_code(403);
	else header('HTTP/1.1 403 Forbidden');
	accessforbidden($message);
}

function mjl_fundreceipts_store_recovery($action, $id, $feedback)
{
	global $conf, $user;
	$config = mjl_finance_recovery_config('fundreceipts', $action);
	if ($config === null) return '';
	$values = array();
	foreach ($config['fields'] as $field) $values[$field] = GETPOST($field, 'restricthtml');
	$errors = mjl_finance_feedback_recovery_errors('fundreceipts', $action, $feedback, $config['fields']);
	$reason = '';
	return mjl_form_recovery_store(array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'fundreceipts', 'form' => $config['form'], 'action' => $action, 'object_id' => (int) $id), $values, $config['fields'], $reason, $errors);
}

function mjl_fundreceipts_redirect($id, $recoveryHandle = '')
{
	$url = DOL_URL_ROOT.'/custom/mjlfinancement/fundreceipts.php';
	$query = array();
	if ((int) $id > 0) $query['id'] = (int) $id;
	if ($recoveryHandle !== '') $query['mjl_recovery'] = $recoveryHandle;
	if (!empty($query)) $url .= '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986);
	header('Location: '.$url);
	exit;
}
