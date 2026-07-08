<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';

mjl_workspace_require_reference_data_access($user, 'convention');

$action = GETPOST('action', 'aZ09');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		mjl_conventions_forbidden('Jeton de securite invalide');
	}
	if (!mjl_conventions_can_manage()) {
		mjl_conventions_forbidden();
	}
	mjl_conventions_handle_post($action);
}

$conventionId = GETPOSTINT('id');

llxHeader('', 'Conventions MJL');
mjl_navigation_shell_start($user, 'conventions');
print '<div class="mjl-workspace mjl-convention-workspace">';

if ($conventionId > 0) {
	mjl_conventions_render_detail($conventionId);
} else {
	mjl_conventions_render_list_page();
}

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_conventions_handle_post($action)
{
	global $db, $user, $conf;

	if ($action === 'create') {
		$convention = new MjlConvention($db);
		$convention->entity = (int) $conf->entity;
		$convention->ref = GETPOST('ref', 'alphanohtml');
		$convention->title = GETPOST('title', 'restricthtml');
		$convention->fk_soc = GETPOSTINT('fk_soc');
		$convention->fk_project = GETPOSTINT('fk_project');
		if (!mjl_conventions_can_use_partner_project((int) $convention->fk_soc, (int) $convention->fk_project)) {
			mjl_conventions_forbidden('Partenaire ou projet hors de votre perimetre');
		}
		$convention->date_start = mjl_conventions_post_date('date_start');
		$convention->date_end = mjl_conventions_post_date('date_end');
		$convention->total_amount = price2num(GETPOST('total_amount', 'alpha'));
		$convention->currency_code = strtoupper(GETPOST('currency_code', 'alpha'));
		$convention->note_public = GETPOST('note_public', 'restricthtml');
		$convention->note_private = GETPOST('note_private', 'restricthtml');
		$convention->fk_user_creat = $user->id;
		$result = $convention->create($user);
		if ($result <= 0) {
			setEventMessages($convention->error ?: 'Creation convention refusee', null, 'errors');
			mjl_conventions_redirect(0);
		}
		setEventMessages('Convention creee en brouillon', null, 'mesgs');
		mjl_conventions_redirect((int) $result);
	}

	$id = GETPOSTINT('id');
	$convention = new MjlConvention($db);
	if ($id <= 0 || $convention->fetch($id) <= 0 || (int) $convention->entity !== (int) $conf->entity) {
		mjl_conventions_forbidden('Convention introuvable ou hors de votre perimetre');
	}
	if (!mjl_scope_can_access_object($user, 'mjlfinancement_convention', $id)) {
		mjl_conventions_forbidden('Convention hors de votre perimetre');
	}

	if ($action === 'update') {
		if (!mjl_conventions_can_use_partner_project(GETPOSTINT('fk_soc'), GETPOSTINT('fk_project'))) {
			mjl_conventions_forbidden('Partenaire ou projet hors de votre perimetre');
		}
		$result = $convention->updateGovernedFields($user, array(
			'ref' => GETPOST('ref', 'alphanohtml'),
			'title' => GETPOST('title', 'restricthtml'),
			'fk_soc' => GETPOSTINT('fk_soc'),
			'fk_project' => GETPOSTINT('fk_project'),
			'date_start' => mjl_conventions_post_date('date_start'),
			'date_end' => mjl_conventions_post_date('date_end'),
			'total_amount' => GETPOST('total_amount', 'alpha'),
			'currency_code' => strtoupper(GETPOST('currency_code', 'alpha')),
			'note_public' => GETPOST('note_public', 'restricthtml'),
			'note_private' => GETPOST('note_private', 'restricthtml'),
		), GETPOST('comment', 'restricthtml'));
	} elseif ($action === 'activate') {
		$result = $convention->activate($user, GETPOST('comment', 'restricthtml'));
	} elseif ($action === 'close') {
		$result = $convention->close($user, GETPOST('comment', 'restricthtml'));
	} elseif ($action === 'delete') {
		$result = $convention->deleteIfUnlinkedDraft($user);
	} elseif ($action === 'upload') {
		$result = mjl_conventions_upload_document($convention);
	} else {
		mjl_conventions_redirect($id);
	}

	if ($result < 0) {
		setEventMessages($convention->error ?: 'Action convention refusee', null, 'errors');
	} elseif ($result === 0) {
		setEventMessages('Aucun changement applique', null, 'warnings');
	} else {
		setEventMessages('Action convention enregistree', null, 'mesgs');
	}
	mjl_conventions_redirect($action === 'delete' && $result > 0 ? 0 : $id);
}

function mjl_conventions_render_list_page()
{
	print '<div class="mjl-workspace-header">';
	print '<div><p class="mjl-kicker">Enveloppes de financement</p><h1>Gestion des enveloppes de financement</h1>';
	print '<p class="mjl-header-copy">Pilotez les enveloppes de financement avant les lignes budgetaires, depenses et rapports.</p></div>';
	print '<div class="mjl-user-context"><span>Perimetre</span><strong>'.(mjl_conventions_can_manage() ? 'DPAF / Admin' : 'Consultation').'</strong></div>';
	print '</div>';

	if (mjl_conventions_can_manage()) {
		mjl_conventions_render_create_form();
	}
	mjl_conventions_render_list();
}

function mjl_conventions_render_detail($id)
{
	$row = mjl_conventions_fetch_detail($id);
	if (empty($row)) {
		mjl_conventions_forbidden('Convention introuvable ou hors de votre perimetre');
	}
	$linked = mjl_conventions_link_counts($id);
	$hasLinks = array_sum($linked) > 0;
	$canManage = mjl_conventions_can_manage();

	print '<p><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php">Retour aux conventions</a></p>';
	print '<div class="mjl-workspace-header">';
	print '<div><p class="mjl-kicker">Enveloppe de financement</p><h1>'.dol_escape_htmltag($row['ref']).' - '.dol_escape_htmltag($row['title']).'</h1>';
	print '<p class="mjl-header-copy">'.dol_escape_htmltag(mjl_conventions_next_action_label($row, $hasLinks)).'</p></div>';
	print '<div class="mjl-user-context"><span>Statut</span><strong>'.dol_escape_htmltag(mjl_convention_status_label($row['status'])).'</strong></div>';
	print '</div>';

	print '<div class="mjl-activity-detail-grid">';
	mjl_conventions_render_summary($row, $linked);
	if ($canManage) {
		mjl_conventions_render_edit_form($row, $hasLinks);
	}
	print '</div>';
	mjl_conventions_render_actions($row, $hasLinks, $canManage);
	mjl_conventions_render_document_panel($row, $canManage);
	mjl_conventions_render_timeline($row);
}

function mjl_conventions_upload_document(MjlConvention $convention)
{
	global $db, $user, $conf;

	$conventionId = (int) ($convention->id ?: $convention->rowid);
	if ((int) $convention->entity !== (int) $conf->entity || !mjl_conventions_can_upload_document((array) $convention)) {
		$convention->error = 'Permission denied for convention document upload';
		return -1;
	}
	if ((int) $convention->status === MjlConvention::STATUS_CLOSED) {
		$convention->error = 'Closed conventions cannot receive new documents';
		return -1;
	}

	$db->begin();
	$error = '';
	$document = mjl_document_upload_to_ecm('mjlfinancement_convention', $conventionId, (int) $convention->entity, 'supporting_document', 'mjlfinancement_convention', 'MJL-CONV', 'Document convention MJL', $error);
	if (empty($document)) {
		$db->rollback();
		$convention->error = $error;
		return -1;
	}
	$statusLabel = mjl_convention_status_label($convention->status);
	$comment = 'Document ajoute: '.$document['original'];
	$audit = mjl_workflow_audit_insert('mjlfinancement_convention', $conventionId, (int) $convention->entity, $statusLabel, $user, !empty($user->admin) ? 'ADMIN' : 'DPAF', 'document_uploaded', $comment, array(
		'document' => array('before' => null, 'after' => $document['original']),
		'ecm_file_id' => array('before' => null, 'after' => $document['rowid']),
	), 'WFA-CONV-DOC', $convention->import_key);
	if ($audit < 0) {
		$db->rollback();
		@unlink(rtrim($conf->ecm->dir_output, '/').'/'.$document['filepath'].'/'.$document['filename']);
		$convention->error = $db->lasterror();
		return -1;
	}
	$db->commit();
	return 1;
}

function mjl_conventions_render_create_form()
{
	$ptfs = mjl_conventions_options('ptf');
	$projects = mjl_conventions_options('project');
	print '<section class="mjl-workspace-section mjl-activity-panel">';
	print '<div class="mjl-section-heading"><h2>Nouvelle enveloppe</h2><p>Creer un brouillon avant activation et utilisation par les operations.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php">';
	print '<input type="hidden" name="action" value="create"><input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'">';
	mjl_conventions_render_fields(array(), $ptfs, $projects, false);
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Creer l enveloppe"></div>';
	print '</form></section>';
}

function mjl_conventions_render_edit_form($row, $hasLinks)
{
	$ptfs = mjl_conventions_options('ptf');
	$projects = mjl_conventions_options('project');
	print '<section class="mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Parametres enveloppe</h2><p>'.($hasLinks ? 'Les champs financiers structurants sont verrouilles car des objets sont lies.' : 'Modifier les donnees avant rattachement operationnel.').'</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'">';
	print '<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row['rowid']).'"><input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'">';
	mjl_conventions_render_fields($row, $ptfs, $projects, $hasLinks);
	print '<label>Motif de modification<input required name="comment" value=""></label>';
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Enregistrer"></div>';
	print '</form></section>';
}

function mjl_conventions_render_fields($row, $ptfs, $projects, $locked)
{
	$disabled = $locked ? ' disabled' : '';
	$hiddenLocked = array('ref', 'fk_soc', 'fk_project', 'total_amount', 'currency_code');
	print '<label>Reference<input required name="ref" value="'.dol_escape_htmltag($row['ref'] ?? '').'"'.$disabled.'></label>';
	print '<label>Intitule<input required name="title" value="'.dol_escape_htmltag($row['title'] ?? '').'"></label>';
	print '<label>Partenaire / Programme'.mjl_conventions_select('fk_soc', $ptfs, (int) ($row['fk_soc'] ?? 0), true, $locked).'</label>';
	print '<label>Projet'.mjl_conventions_select('fk_project', $projects, (int) ($row['fk_project'] ?? 0), false, $locked).'</label>';
	print '<label>Debut<input type="date" name="date_start" value="'.dol_escape_htmltag(mjl_conventions_date_value($row['date_start'] ?? '')).'"></label>';
	print '<label>Fin<input type="date" name="date_end" value="'.dol_escape_htmltag(mjl_conventions_date_value($row['date_end'] ?? '')).'"></label>';
	print '<label>Montant total<input name="total_amount" value="'.dol_escape_htmltag($row['total_amount'] ?? '').'"'.$disabled.'></label>';
	print '<label>Devise<input required maxlength="3" name="currency_code" value="'.dol_escape_htmltag($row['currency_code'] ?? 'XOF').'"'.$disabled.'></label>';
	print '<label>Note publique<textarea name="note_public">'.dol_escape_htmltag($row['note_public'] ?? '').'</textarea></label>';
	print '<label>Note privee<textarea name="note_private">'.dol_escape_htmltag($row['note_private'] ?? '').'</textarea></label>';
	if ($locked) {
		foreach ($hiddenLocked as $field) {
			print '<input type="hidden" name="'.$field.'" value="'.dol_escape_htmltag((string) ($row[$field] ?? '')).'">';
		}
	}
}

function mjl_conventions_render_list()
{
	global $db, $conf;
	$sql = 'SELECT c.rowid, c.ref, c.title, c.total_amount, c.currency_code, c.status, p.ref AS project_ref, s.nom AS ptf_name,';
	$sql .= ' (SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = c.entity AND bl.fk_convention = c.rowid) AS budget_lines,';
	$sql .= ' (SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid) AS expenses';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity);
	$sql .= mjl_scope_partner_sql_filter('c.fk_soc', $GLOBALS['user']);
	$sql .= ' ORDER BY c.rowid DESC LIMIT 100';
	$resql = $db->query($sql);
	print '<section class="mjl-workspace-section"><div class="mjl-section-heading"><h2>Portefeuille des enveloppes</h2><p>Les enveloppes cloturees restent visibles pour les rapports et l historique.</p></div>';
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div></section>';
		return;
	}
	print '<div class="div-table-responsive-no-min mjl-dashboard-table"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Convention</th><th>PTF</th><th>Projet</th><th class="right">Montant</th><th>Statut</th><th>Liens</th></tr>';
	$count = 0;
	while ($obj = $db->fetch_object($resql)) {
		$count++;
		print '<tr class="oddeven">';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $obj->rowid).'">'.dol_escape_htmltag($obj->ref).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($obj->title).'</span></td>';
		print '<td>'.dol_escape_htmltag($obj->ptf_name).'</td>';
		print '<td>'.dol_escape_htmltag($obj->project_ref).'</td>';
		print '<td class="right">'.price($obj->total_amount).' '.dol_escape_htmltag($obj->currency_code).'</td>';
		print '<td>'.mjl_conventions_status_badge($obj->status).'</td>';
		print '<td>'.((int) $obj->budget_lines).' ligne(s), '.((int) $obj->expenses).' depense(s)</td>';
		print '</tr>';
	}
	if ($count === 0) {
		print '<tr class="oddeven"><td colspan="6">Aucune convention dans votre perimetre.</td></tr>';
	}
	print '</table></div></section>';
}

function mjl_conventions_render_summary($row, $linked)
{
	print '<section class="mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Synthese convention</h2><p>Controle du financement et des rattachements operationnels.</p></div>';
	print '<dl class="mjl-activity-meta">';
	print '<div><dt>Statut</dt><dd>'.mjl_conventions_status_badge($row['status']).'</dd></div>';
	print '<div><dt>PTF</dt><dd>'.dol_escape_htmltag($row['ptf_name']).'</dd></div>';
	print '<div><dt>Projet</dt><dd>'.dol_escape_htmltag($row['project_ref']).' - '.dol_escape_htmltag($row['project_title']).'</dd></div>';
	print '<div><dt>Periode</dt><dd>'.dol_escape_htmltag(mjl_conventions_format_date($row['date_start'])).' - '.dol_escape_htmltag(mjl_conventions_format_date($row['date_end'])).'</dd></div>';
	print '<div><dt>Montant</dt><dd>'.price($row['total_amount']).' '.dol_escape_htmltag($row['currency_code']).'</dd></div>';
	print '<div><dt>Activites</dt><dd>'.((int) $linked['activities']).'</dd></div>';
	print '<div><dt>Lignes budgetaires</dt><dd>'.((int) $linked['budget_lines']).'</dd></div>';
	print '<div><dt>Fonds recus</dt><dd>'.((int) $linked['fund_receipts']).'</dd></div>';
	print '<div><dt>Depenses</dt><dd>'.((int) $linked['expenses']).'</dd></div>';
	print '</dl></section>';
}

function mjl_conventions_render_actions($row, $hasLinks, $canManage)
{
	if (!$canManage) return;
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Cycle de vie</h2><p>Activation, cloture ou suppression selon les regles de gouvernance.</p></div>';
	if ((int) $row['status'] === MjlConvention::STATUS_DRAFT) {
		mjl_conventions_action_form($row['rowid'], 'activate', 'Activer la convention', 'Commentaire d activation', false);
		if (!$hasLinks) {
			mjl_conventions_action_form($row['rowid'], 'delete', 'Supprimer le brouillon', '', false);
		}
	} elseif ((int) $row['status'] === MjlConvention::STATUS_ACTIVE) {
		mjl_conventions_action_form($row['rowid'], 'close', 'Cloturer la convention', 'Motif de cloture', true);
	} else {
		print '<div class="mjl-empty-state">Convention cloturee: aucune nouvelle operation ne peut y etre rattachee.</div>';
	}
	print '</section>';
}

function mjl_conventions_render_document_panel($row, $canManage)
{
	$state = mjl_convention_evidence_state((int) $row['rowid'], (int) $row['entity']);
	$documents = mjl_convention_document_download_rows((int) $row['rowid']);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Documents convention</h2><p>Pieces contractuelles et annexes conservees dans ECM.</p></div>';
	print '<div class="mjl-document-summary mjl-document-summary-'.$state.'">';
	print '<span>'.dol_escape_htmltag(mjl_conventions_evidence_label($state)).'</span>';
	print '<span>'.dol_escape_htmltag(!empty($documents) ? mjl_convention_document_display_filename($documents[0]) : 'Aucun fichier detecte').'</span>';
	print '</div>';
	if ($state === 'unavailable') {
		print '<div class="mjl-empty-state mjl-empty-state-warning">Reference ECM presente, mais aucun fichier telechargeable n est disponible.</div>';
	} elseif ($state === 'missing') {
		print '<div class="mjl-empty-state">Aucun document n est rattache a cette convention.</div>';
	}
	if (!empty($documents)) {
		print '<div class="mjl-document-list">';
		foreach ($documents as $document) {
			$label = mjl_convention_document_display_filename($document);
			print '<div class="mjl-document-row">';
			print '<span>'.dol_escape_htmltag($label).'</span>';
			print '<a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/documentdownload.php?type=convention&id='.((int) $document['rowid']).'">Telecharger le document</a>';
			print '</div>';
		}
		print '</div>';
	}
	if ($canManage && mjl_conventions_can_upload_document($row)) {
		print '<form class="mjl-activity-form" method="POST" enctype="multipart/form-data" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'">';
		print '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="action" value="upload"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
		print '<label>Document convention<input required type="file" name="supporting_document"></label>';
		print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Ajouter le document"></div>';
		print '</form>';
	}
	print '</section>';
}

function mjl_conventions_action_form($id, $action, $label, $commentLabel, $required)
{
	print '<form class="mjl-activity-action-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $id).'">';
	print '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="action" value="'.dol_escape_htmltag($action).'"><input type="hidden" name="id" value="'.((int) $id).'">';
	if ($commentLabel !== '') {
		print '<label>'.dol_escape_htmltag($commentLabel).'<input'.($required ? ' required' : '').' name="comment"></label>';
	}
	print '<input class="button" type="submit" value="'.dol_escape_htmltag($label).'">';
	print '</form>';
}

function mjl_conventions_render_timeline($row)
{
	$items = mjl_conventions_timeline_items($row);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Historique convention</h2><p>Creation, modifications, activation, cloture et tentatives refusees.</p></div>';
	print '<ol class="mjl-activity-timeline">';
	foreach ($items as $item) {
		print '<li><span class="mjl-status-pill">'.dol_escape_htmltag($item['label']).'</span>';
		print '<strong>'.dol_escape_htmltag($item['title']).'</strong>';
		print '<p>'.dol_escape_htmltag($item['meta']).'</p>';
		if ($item['comment'] !== '') {
			print '<p class="mjl-timeline-comment">'.dol_escape_htmltag($item['comment']).'</p>';
		}
		if (!empty($item['changes'])) {
			print '<details><summary>Details</summary><ul>';
			foreach ($item['changes'] as $field => $change) {
				print '<li>'.dol_escape_htmltag($field).': '.dol_escape_htmltag(mjl_conventions_change_text($change)).'</li>';
			}
			print '</ul></details>';
		}
		print '</li>';
	}
	print '</ol></section>';
}

function mjl_conventions_fetch_detail($id)
{
	global $db, $conf;
	$sql = 'SELECT c.rowid, c.entity, c.ref, c.title, c.fk_soc, c.fk_project, c.date_start, c.date_end, c.total_amount, c.currency_code, c.note_public, c.note_private, c.status, c.date_creation, c.import_key,';
	$sql .= ' p.ref AS project_ref, p.title AS project_title, s.nom AS ptf_name, u.login AS creator_login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = c.fk_user_creat';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity).' AND c.rowid = '.((int) $id);
	$sql .= mjl_scope_partner_sql_filter('c.fk_soc', $GLOBALS['user']);
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_conventions_link_counts($id)
{
	global $db, $conf;
	$map = array('activities' => 'mjlfinancement_activity', 'budget_lines' => 'mjlfinancement_budget_line', 'fund_receipts' => 'mjlfinancement_fund_receipt', 'expenses' => 'mjlfinancement_expense');
	$result = array();
	foreach ($map as $key => $table) {
		$sql = 'SELECT COUNT(*) AS nb FROM '.$db->prefix().$table.' WHERE entity = '.((int) $conf->entity).' AND fk_convention = '.((int) $id);
		$resql = $db->query($sql);
		$obj = $resql ? $db->fetch_object($resql) : null;
		$result[$key] = $obj ? (int) $obj->nb : 0;
	}
	return $result;
}

function mjl_conventions_timeline_items($row)
{
	global $db, $conf;
	$items = array(array(
		'label' => 'Creee',
		'title' => 'Convention creee',
		'meta' => mjl_conventions_format_datetime($row['date_creation']).' par '.$row['creator_login'],
		'comment' => '',
		'changes' => array(),
	));
	$sql = 'SELECT w.action, w.from_status, w.to_status, w.actor_role, w.action_date, w.comment, w.changes_json, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity).' AND w.object_type = \'mjlfinancement_convention\' AND w.object_id = '.((int) $row['rowid']);
	$sql .= ' ORDER BY w.action_date ASC, w.rowid ASC';
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return $items;
	}
	while ($obj = $db->fetch_object($resql)) {
		$changes = json_decode((string) $obj->changes_json, true);
		$items[] = array(
			'label' => mjl_convention_action_label($obj->action),
			'title' => mjl_conventions_timeline_title($obj->action, $obj->from_status, $obj->to_status),
			'meta' => mjl_conventions_format_datetime($obj->action_date).' par '.$obj->login.' ('.mjl_convention_actor_role_label($obj->actor_role).')',
			'comment' => (string) $obj->comment,
			'changes' => is_array($changes) ? $changes : array(),
		);
	}
	return $items;
}

function mjl_conventions_options($type)
{
	global $db, $conf;
	if ($type === 'ptf') {
		$sql = 'SELECT rowid, nom AS label FROM '.$db->prefix().'societe s WHERE s.entity = '.((int) $conf->entity).' AND s.status = 1'.mjl_scope_partner_sql_filter('s.rowid', $GLOBALS['user']).' ORDER BY s.nom';
	} else {
		$sql = 'SELECT rowid, CONCAT(ref, \' - \', title) AS label FROM '.$db->prefix().'projet p WHERE p.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('p.fk_soc', $GLOBALS['user']).' ORDER BY p.ref';
	}
	$resql = $db->query($sql);
	$options = array();
	if ($resql) {
		while ($obj = $db->fetch_object($resql)) {
			$options[(int) $obj->rowid] = (string) $obj->label;
		}
	}
	return $options;
}

function mjl_conventions_can_use_partner_project($fkSoc, $fkProject)
{
	global $db, $conf, $user;
	$fkSoc = (int) $fkSoc;
	$fkProject = (int) $fkProject;
	if ($fkSoc <= 0 || !mjl_scope_can_access_fk_soc($user, $fkSoc)) return false;
	$sql = 'SELECT rowid FROM '.$db->prefix().'societe WHERE entity = '.((int) $conf->entity).' AND rowid = '.$fkSoc.' AND status = 1';
	$resql = $db->query($sql);
	if (!$resql || !$db->fetch_object($resql)) return false;
	if ($fkProject <= 0) return true;
	$sql = 'SELECT rowid FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' AND rowid = '.$fkProject.' AND fk_soc = '.$fkSoc;
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_conventions_select($name, $options, $selected, $required, $disabled)
{
	$html = '<select name="'.dol_escape_htmltag($name).'"'.($required ? ' required' : '').($disabled ? ' disabled' : '').'>';
	if (!$required) {
		$html .= '<option value="">Aucun</option>';
	}
	foreach ($options as $value => $label) {
		$html .= '<option value="'.((int) $value).'"'.((int) $selected === (int) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_conventions_can_manage()
{
	global $user;
	return mjl_workspace_can_access_supervision($user) && $user->hasRight('mjlfinancement', 'convention', 'write');
}

function mjl_conventions_can_upload_document($row)
{
	global $user;
	$data = is_array($row) ? $row : (array) $row;
	return mjl_conventions_can_manage() && (int) ($data['status'] ?? 0) !== MjlConvention::STATUS_CLOSED;
}

function mjl_convention_status_label($status)
{
	$map = array(
		(string) MjlConvention::STATUS_DRAFT => 'Brouillon',
		(string) MjlConvention::STATUS_ACTIVE => 'Active',
		(string) MjlConvention::STATUS_CLOSED => 'Cloturee',
		'draft' => 'Brouillon',
		'active' => 'Active',
		'closed' => 'Cloturee',
		'deleted' => 'Supprimee',
	);
	$key = (string) $status;
	return isset($map[$key]) ? $map[$key] : $key;
}

function mjl_convention_action_label($action)
{
	$map = array('created' => 'Creation', 'field_changed' => 'Modification', 'document_uploaded' => 'Document ajoute', 'unsafe_edit_rejected' => 'Modification refusee', 'activated' => 'Activation', 'closed' => 'Cloture', 'deleted' => 'Suppression');
	return isset($map[$action]) ? $map[$action] : (string) $action;
}

function mjl_convention_actor_role_label($role)
{
	$map = array('ADMIN' => 'Admin', 'DPAF' => 'DPAF');
	return isset($map[$role]) ? $map[$role] : (string) $role;
}

function mjl_conventions_status_badge($status)
{
	$tone = (int) $status === MjlConvention::STATUS_DRAFT ? 'warning' : 'neutral';
	if ((int) $status === MjlConvention::STATUS_CLOSED) $tone = 'danger';
	return '<span class="mjl-status-pill'.($tone !== 'neutral' ? ' mjl-status-'.$tone : '').'">'.dol_escape_htmltag(mjl_convention_status_label($status)).'</span>';
}

function mjl_conventions_next_action_label($row, $hasLinks)
{
	if ((int) $row['status'] === MjlConvention::STATUS_DRAFT) return 'Verifier les donnees puis activer la convention.';
	if ((int) $row['status'] === MjlConvention::STATUS_ACTIVE && $hasLinks) return 'Convention active: les champs structurants sont verrouilles.';
	if ((int) $row['status'] === MjlConvention::STATUS_ACTIVE) return 'Convention active disponible pour les operations.';
	return 'Convention cloturee: consultation, rapports et historique restent disponibles.';
}

function mjl_conventions_timeline_title($action, $fromStatus, $toStatus)
{
	if ((string) $action === 'document_uploaded') {
		return 'Document ajoute a la convention';
	}
	if ((string) $fromStatus === '' || (string) $toStatus === '' || (string) $fromStatus === (string) $toStatus) {
		return mjl_convention_action_label($action);
	}
	return mjl_convention_status_label($fromStatus).' vers '.mjl_convention_status_label($toStatus);
}

function mjl_conventions_evidence_label($state)
{
	if ($state === 'downloadable') return 'Disponible';
	if ($state === 'unavailable') return 'Référence indisponible';
	return 'Manquante';
}

function mjl_conventions_change_text($change)
{
	if (is_array($change) && array_key_exists('before', $change) && array_key_exists('after', $change)) {
		return (string) $change['before'].' -> '.(string) $change['after'];
	}
	if (is_array($change)) {
		return implode(', ', array_map('strval', $change));
	}
	return (string) $change;
}

function mjl_conventions_date_value($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? date('Y-m-d', $time) : '';
}

function mjl_conventions_post_date($field)
{
	$value = GETPOST($field, 'alphanohtml');
	return $value === '' ? null : strtotime($value);
}

function mjl_conventions_format_date($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'day') : (string) $value;
}

function mjl_conventions_format_datetime($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'dayhour') : (string) $value;
}

function mjl_conventions_forbidden($message = '')
{
	if (function_exists('http_response_code')) {
		http_response_code(403);
	} else {
		header('HTTP/1.1 403 Forbidden');
	}
	accessforbidden($message);
}

function mjl_conventions_redirect($id)
{
	$url = DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php';
	if ((int) $id > 0) {
		$url .= '?id='.((int) $id);
	}
	header('Location: '.$url);
	exit;
}
