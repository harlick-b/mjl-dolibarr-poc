<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';

if (!$user->hasRight('mjlfinancement', 'expense', 'read')) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');
$action = GETPOST('action', 'alpha');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		mjl_expenses_forbidden('Invalid security token');
	}
	if (!$user->hasRight('mjlfinancement', 'expense', 'write') && in_array($action, array('create', 'update', 'submit', 'correct'), true)) {
		mjl_expenses_forbidden();
	}
	if (!$user->hasRight('mjlfinancement', 'expense', 'validate') && in_array($action, array('validate', 'reject'), true)) {
		mjl_expenses_forbidden();
	}
	if ($action === 'upload' && (!$user->hasRight('mjlfinancement', 'expense', 'write') || !$user->hasRight('ecm', 'upload'))) {
		mjl_expenses_forbidden();
	}
	mjl_expenses_handle_post($action);
}

$mjl_expenses_page_token = function_exists('newToken') ? newToken() : '';
$expenseId = GETPOSTINT('id');

llxHeader('', 'Depenses MJL');
mjl_navigation_shell_start($user, 'expenses');
print '<div class="mjl-workspace mjl-expense-workspace">';

if ($expenseId > 0) {
	mjl_expenses_render_detail($expenseId);
} else {
	mjl_expenses_render_list_page();
}

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_expenses_handle_post($action)
{
	global $db, $user, $conf;

	if ($action === 'create') {
		$expense = new MjlExpense($db);
		$expense->entity = (int) $conf->entity;
		$expense->ref = GETPOST('ref', 'alphanohtml');
		$expense->fk_project = GETPOSTINT('fk_project');
		$expense->fk_convention = GETPOSTINT('fk_convention');
		$expense->fk_mjl_activity = GETPOSTINT('fk_mjl_activity');
		$expense->fk_budget_line = GETPOSTINT('fk_budget_line');
		$expense->amount = price2num(GETPOST('amount', 'alpha'));
		$date = GETPOST('expense_date', 'alphanohtml');
		$expense->expense_date = empty($date) ? dol_now() : strtotime($date);
		$expense->description = GETPOST('description', 'restricthtml');
		$expense->status = MjlExpense::STATUS_DRAFT;
		$expense->fk_user_creat = $user->id;
		$result = $expense->create($user);
		if ($result <= 0) {
			setEventMessages($expense->error ?: 'Creation depense refusee', null, 'errors');
			mjl_expenses_redirect(0);
		}
		setEventMessages('Depense creee en brouillon', null, 'mesgs');
		mjl_expenses_redirect((int) $result);
	}

	$id = GETPOSTINT('id');
	$row = mjl_expenses_fetch_detail($id);
	if (empty($row) || !mjl_expenses_can_open($row)) {
		mjl_expenses_forbidden('Depense introuvable ou hors de votre perimetre');
	}
	if (!mjl_expenses_can_apply_action($row, $action)) {
		mjl_expenses_forbidden();
	}

	$expense = new MjlExpense($db);
	if ($expense->fetch($id) <= 0 || (int) $expense->entity !== (int) $conf->entity) {
		mjl_expenses_forbidden('Depense introuvable ou hors de votre perimetre');
	}

	if ($action === 'update') $result = mjl_expenses_update_rejected($expense);
	elseif ($action === 'submit') $result = $expense->submit($user, GETPOST('comment', 'restricthtml'));
	elseif ($action === 'validate') $result = $expense->validate($user);
	elseif ($action === 'reject') $result = $expense->reject($user, GETPOST('comment', 'restricthtml'));
	elseif ($action === 'correct') $result = $expense->correct($user, GETPOST('comment', 'restricthtml'));
	elseif ($action === 'upload') $result = mjl_expenses_upload_document($expense);
	else mjl_expenses_redirect($id);

	if ($result < 0) setEventMessages($expense->error ?: 'Action refusee', null, 'errors');
	elseif ($result === 0) setEventMessages('Aucun changement applique', null, 'warnings');
	else setEventMessages('Action enregistree', null, 'mesgs');
	mjl_expenses_redirect($id);
}

function mjl_expenses_forbidden($message = '')
{
	if (function_exists('http_response_code')) {
		http_response_code(403);
	} else {
		header('HTTP/1.1 403 Forbidden');
	}
	accessforbidden($message);
}

function mjl_expenses_redirect($id)
{
	$url = DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php';
	if ((int) $id > 0) {
		$url .= '?id='.((int) $id);
	}
	header('Location: '.$url);
	exit;
}

function mjl_expenses_update_rejected(MjlExpense $expense)
{
	global $user;

	if (!$user->hasRight('mjlfinancement', 'expense', 'write')) {
		$expense->error = 'Permission denied for expense update';
		return -1;
	}
	if ((int) $expense->status !== MjlExpense::STATUS_REJECTED) {
		$expense->error = 'Only rejected expenses can be edited through this action';
		return -1;
	}

	$amount = GETPOST('amount', 'alpha');
	if ($amount !== '') {
		$expense->amount = price2num($amount);
	}
	$date = GETPOST('expense_date', 'alphanohtml');
	if ($date !== '') {
		$expense->expense_date = strtotime($date);
	}
	$expense->description = GETPOST('description', 'restricthtml');
	return $expense->update($user);
}

function mjl_expenses_upload_document(MjlExpense $expense)
{
	global $db, $user, $conf;

	if (!$user->hasRight('mjlfinancement', 'expense', 'read') || !$user->hasRight('mjlfinancement', 'expense', 'write') || !$user->hasRight('ecm', 'upload')) {
		$expense->error = 'Permission denied for expense document upload';
		return -1;
	}
	if ((int) $expense->entity !== (int) $conf->entity) {
		$expense->error = 'Expense not found in active entity';
		return -1;
	}
	if ((int) $expense->status === MjlExpense::STATUS_VALIDATED) {
		$expense->error = 'Validated expenses cannot receive new supporting documents';
		return -1;
	}
	if (empty($_FILES['supporting_document']['tmp_name']) || !is_uploaded_file($_FILES['supporting_document']['tmp_name'])) {
		$expense->error = 'Fichier manquant';
		return -1;
	}
	if (empty($conf->ecm->dir_output)) {
		$expense->error = 'Repertoire ECM non configure';
		return -1;
	}

	$original = preg_replace('/[^A-Za-z0-9_.-]/', '_', basename($_FILES['supporting_document']['name']));
	$original = trim($original, '._-');
	if ($original === '') {
		$original = 'document';
	}
	$expenseId = (int) ($expense->id ?: $expense->rowid);
	$filename = 'expense-'.$expenseId.'-'.date('YmdHis').'-'.bin2hex(random_bytes(6)).'-'.$original;
	$filepath = 'mjlfinancement_expense';
	$targetDir = rtrim($conf->ecm->dir_output, '/').'/'.$filepath;
	if (!is_dir($targetDir)) {
		$mkdir = function_exists('dol_mkdir') ? dol_mkdir($targetDir) >= 0 : mkdir($targetDir, 0775, true);
		if (!$mkdir) {
			$expense->error = 'Impossible de creer le repertoire ECM';
			return -1;
		}
	}
	if (!is_dir($targetDir)) {
		$expense->error = 'Impossible de creer le repertoire ECM';
		return -1;
	}
	$target = $targetDir.'/'.$filename;
	if (file_exists($target)) {
		$expense->error = 'Un fichier de meme nom existe deja';
		return -1;
	}
	if (!move_uploaded_file($_FILES['supporting_document']['tmp_name'], $target)) {
		$expense->error = 'Impossible de deplacer le fichier upload';
		return -1;
	}

	$db->begin();
	$sql = 'INSERT INTO '.$db->prefix().'ecm_files (ref, label, entity, filename, filepath, fullpath_orig, description, gen_or_uploaded, date_c, fk_user_c, src_object_type, src_object_id)';
	$sql .= ' VALUES (';
	$sql .= "'".$db->escape('MJL-EXP-'.$expenseId.'-'.$filename)."'";
	$sql .= ", '".$db->escape($filename)."'";
	$sql .= ', '.((int) $expense->entity);
	$sql .= ", '".$db->escape($filename)."'";
	$sql .= ", '".$db->escape($filepath)."'";
	$sql .= ", '".$db->escape($original)."'";
	$sql .= ", 'Piece justificative MJL'";
	$sql .= ', 1';
	$sql .= ", '".$db->idate(dol_now())."'";
	$sql .= ', '.((int) $user->id);
	$sql .= ", 'mjlfinancement_expense'";
	$sql .= ', '.$expenseId;
	$sql .= ')';
	if (!$db->query($sql)) {
		$db->rollback();
		@unlink($target);
		$expense->error = $db->lasterror();
		return -1;
	}
	$sql = 'UPDATE '.$db->prefix().'mjlfinancement_expense SET supporting_document = \''.$db->escape($filename).'\', fk_user_modif = '.((int) $user->id).' WHERE rowid = '.$expenseId.' AND entity = '.((int) $expense->entity);
	if (!$db->query($sql)) {
		$db->rollback();
		@unlink($target);
		$expense->error = $db->lasterror();
		return -1;
	}
	$db->commit();
	$expense->supporting_document = $filename;
	return 1;
}

function mjl_expenses_render_list_page()
{
	print '<div class="mjl-workspace-header">';
	print '<div><p class="mjl-kicker">Depenses</p><h1>Depenses et pieces justificatives</h1>';
	print '<p class="mjl-header-copy">Consultez les depenses de votre perimetre, ouvrez le detail et traitez les pieces ou decisions attendues.</p></div>';
	print '<div class="mjl-user-context"><span>Perimetre</span><strong>'.dol_escape_htmltag(mjl_expenses_scope_label()).'</strong></div>';
	print '</div>';

	if ($GLOBALS['user']->hasRight('mjlfinancement', 'expense', 'write')) {
		mjl_expenses_create_form();
	}
	mjl_expenses_list();
}

function mjl_expenses_render_detail($id)
{
	$row = mjl_expenses_fetch_detail($id);
	if (empty($row) || !mjl_expenses_can_open($row)) {
		mjl_expenses_forbidden();
	}

	print '<p><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php">Retour aux depenses</a></p>';
	print '<div class="mjl-workspace-header">';
	print '<div><p class="mjl-kicker">Depense</p><h1>'.dol_escape_htmltag($row['ref']).'</h1>';
	print '<p class="mjl-header-copy">'.dol_escape_htmltag(mjl_expenses_next_action_label($row)).'</p></div>';
	print '<div class="mjl-user-context"><span>Statut</span><strong>'.dol_escape_htmltag(mjl_expenses_status_label($row['status'])).'</strong></div>';
	print '</div>';

	print '<div class="mjl-activity-detail-grid">';
	mjl_expenses_render_summary_card($row);
	mjl_expenses_render_document_panel($row);
	mjl_expenses_render_decision_panel($row);
	print '</div>';
	mjl_expenses_render_timeline($row);
}

function mjl_expenses_create_form()
{
	$projectOptions = mjl_expenses_options('project');
	$conventionOptions = mjl_expenses_options('convention');
	$activityOptions = mjl_expenses_options('activity');
	$budgetLineOptions = mjl_expenses_options('budget_line');

	print '<section class="mjl-workspace-section mjl-activity-panel">';
	print '<div class="mjl-section-heading"><h2>Nouvelle depense</h2><p>Creer un brouillon rattache a un projet, une convention et une ligne budgetaire.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<input type="hidden" name="action" value="create">';
	print mjl_expenses_token_input();
	print '<label>Reference<input required name="ref"></label>';
	print '<label>Projet'.mjl_expenses_select('fk_project', $projectOptions, 1, 'Choisir').'</label>';
	print '<label>Convention'.mjl_expenses_select('fk_convention', $conventionOptions, 1, 'Choisir').'</label>';
	print '<label>Activite'.mjl_expenses_select('fk_mjl_activity', $activityOptions, 0, 'Aucune').'</label>';
	print '<label>Ligne budgetaire'.mjl_expenses_select('fk_budget_line', $budgetLineOptions, 1, 'Choisir').'</label>';
	print '<label>Montant<input required name="amount"></label>';
	print '<label>Date<input type="date" name="expense_date"></label>';
	print '<label>Description<input name="description"></label>';
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Creer la depense"></div>';
	print '</form></section>';
}

function mjl_expenses_list()
{
	global $db, $conf;

	$sql = 'SELECT e.rowid, e.entity, e.ref, e.expense_date, e.amount, e.status, e.description, e.fk_user_creat, e.supporting_document, bl.ref AS budget_line, p.ref AS project_ref, u.login AS creator_login, '.mjl_expense_document_present_sql('e').' AS document_present';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line AND bl.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = e.fk_user_creat';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity).mjl_expenses_scope_sql('e');
	$sql .= ' ORDER BY e.rowid DESC LIMIT 100';
	$resql = $db->query($sql);
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div>';
		return;
	}

	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Depenses du perimetre</h2><p>Ouvrez une depense pour consulter son statut, sa piece justificative et son historique.</p></div>';
	print '<div class="div-table-responsive-no-min mjl-dashboard-table"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Depense</th><th>Projet</th><th>Ligne</th><th>Date</th><th class="right">Montant</th><th>Statut</th><th>Piece</th><th>Createur</th><th>Action attendue</th></tr>';
	$count = 0;
	while ($row = $db->fetch_object($resql)) {
		$count++;
		$evidenceState = mjl_expense_evidence_state((int) $row->rowid, (int) $row->entity, $row->supporting_document);
		print '<tr class="oddeven">';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row->rowid).'">'.dol_escape_htmltag($row->ref).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($row->description).'</span></td>';
		print '<td>'.dol_escape_htmltag($row->project_ref).'</td>';
		print '<td>'.dol_escape_htmltag($row->budget_line).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_expenses_format_date($row->expense_date)).'</td>';
		print '<td class="right">'.price($row->amount).'</td>';
		print '<td>'.mjl_expenses_status_badge($row->status).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_expenses_evidence_label($evidenceState)).'</td>';
		print '<td>'.dol_escape_htmltag($row->creator_login).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_expenses_next_action_label((array) $row)).'</td>';
		print '</tr>';
	}
	if ($count === 0) {
		print '<tr class="oddeven"><td colspan="9">Aucune depense dans votre perimetre pour le moment.</td></tr>';
	}
	print '</table></div></section>';
}

function mjl_expenses_render_summary_card($row)
{
	print '<section class="mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Synthese de la depense</h2><p>Statut, montant, rattachement et responsabilite visibles avant les details.</p></div>';
	print '<dl class="mjl-activity-meta">';
	print '<div><dt>Statut</dt><dd>'.mjl_expenses_status_badge($row['status']).'</dd></div>';
	print '<div><dt>Action attendue</dt><dd>'.dol_escape_htmltag(mjl_expenses_next_action_label($row)).'</dd></div>';
	print '<div><dt>Piece justificative</dt><dd>'.dol_escape_htmltag(mjl_expenses_evidence_label($row['evidence_state'] ?? '')).'</dd></div>';
	print '<div><dt>Projet</dt><dd>'.dol_escape_htmltag($row['project_ref']).' - '.dol_escape_htmltag($row['project_title']).'</dd></div>';
	print '<div><dt>Convention</dt><dd>'.dol_escape_htmltag($row['convention_ref']).' - '.dol_escape_htmltag($row['convention_title']).'</dd></div>';
	print '<div><dt>Activite</dt><dd>'.dol_escape_htmltag($row['activity_ref'] ?: 'Aucune').'</dd></div>';
	print '<div><dt>Ligne budgetaire</dt><dd>'.dol_escape_htmltag($row['budget_line_ref']).' - '.dol_escape_htmltag($row['budget_line_label']).'</dd></div>';
	print '<div><dt>Montant</dt><dd>'.price($row['amount']).'</dd></div>';
	print '<div><dt>Date depense</dt><dd>'.dol_escape_htmltag(mjl_expenses_format_date($row['expense_date'])).'</dd></div>';
	print '<div><dt>Createur</dt><dd>'.dol_escape_htmltag($row['creator_login']).'</dd></div>';
	print '<div><dt>Validateur</dt><dd>'.dol_escape_htmltag($row['validator_login'] ?: 'Non validee').'</dd></div>';
	print '</dl></section>';
}

function mjl_expenses_render_decision_panel($row)
{
	print '<section class="mjl-activity-card mjl-activity-decision">';
	print '<div class="mjl-section-heading"><h2>Decision et correction</h2><p>Actions disponibles selon votre role, la piece justificative et l etat actuel.</p></div>';
	$actions = mjl_expenses_available_actions($row);
	if (empty($actions)) {
		print '<div class="mjl-empty-state">Aucune action directe n est attendue de votre role pour cette depense.</div>';
		print '</section>';
		return;
	}
	if (!empty($actions['update'])) {
		print '<form class="mjl-activity-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'">';
		print mjl_expenses_token_input().'<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
		print '<label>Montant<input required name="amount" value="'.dol_escape_htmltag($row['amount']).'"></label>';
		print '<label>Date<input type="date" name="expense_date" value="'.dol_escape_htmltag(substr((string) $row['expense_date'], 0, 10)).'"></label>';
		print '<label>Description<input name="description" value="'.dol_escape_htmltag($row['description']).'"></label>';
		print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Enregistrer la correction"></div>';
		print '</form>';
	}
	foreach ($actions as $action => $meta) {
		if ($action === 'update') continue;
		print '<form class="mjl-activity-action-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'">';
		print mjl_expenses_token_input().'<input type="hidden" name="action" value="'.dol_escape_htmltag($action).'"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
		if (!empty($meta['comment'])) {
			print '<label>'.dol_escape_htmltag($meta['comment']).'<input'.(!empty($meta['required']) ? ' required' : '').' name="comment"></label>';
		}
		print '<input class="button" type="submit" value="'.dol_escape_htmltag($meta['label']).'">';
		print '</form>';
	}
	print '</section>';
}

function mjl_expenses_render_document_panel($row)
{
	$state = $row['evidence_state'] ?? ((int) $row['document_present'] > 0 ? 'downloadable' : 'missing');
	$downloadable = $state === 'downloadable';
	$documents = mjl_expense_document_download_rows((int) $row['rowid']);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Piece justificative</h2><p>La validation exige une piece telechargeable par le validateur.</p></div>';
	print '<div class="mjl-document-summary mjl-document-summary-'.$state.'">';
	print '<span>'.dol_escape_htmltag(mjl_expenses_evidence_label($state)).'</span>';
	print '<span>'.dol_escape_htmltag($row['supporting_document_resolved'] ?: 'Aucun fichier detecte').'</span>';
	print '</div>';
	if ($state === 'missing') {
		print '<div class="mjl-empty-state">Ajoutez une piece justificative avant la validation de cette depense.</div>';
	}
	if ($state === 'unavailable') {
		print '<div class="mjl-empty-state mjl-empty-state-warning">Piece referencee dans les donnees, mais aucun fichier telechargeable n est disponible. Ajoutez une nouvelle piece avant validation.</div>';
	}
	if (!empty($documents)) {
		print '<div class="mjl-document-list">';
		foreach ($documents as $document) {
			$label = mjl_expense_document_display_filename($document);
			print '<div class="mjl-document-row">';
			print '<span>'.dol_escape_htmltag($label).'</span>';
			print '<a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/documentdownload.php?id='.((int) $document['rowid']).'">T&eacute;l&eacute;charger la pi&egrave;ce</a>';
			print '</div>';
		}
		print '</div>';
	} elseif ($downloadable) {
		print '<div class="mjl-empty-state mjl-empty-state-warning">Piece detectee, mais aucun lien telechargeable n est disponible.</div>';
	}
	if (mjl_expenses_can_apply_action($row, 'upload')) {
		print '<form class="mjl-activity-action-form" enctype="multipart/form-data" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'">';
		print mjl_expenses_token_input().'<input type="hidden" name="action" value="upload"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
		print '<label>Piece justificative<input required type="file" name="supporting_document"></label>';
		print '<input class="button" type="submit" value="Ajouter la piece">';
		print '</form>';
	}
	print '</section>';
}

function mjl_expenses_render_timeline($expense)
{
	$items = mjl_expenses_timeline_items($expense);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Historique de decision</h2><p>Soumissions, corrections et decisions conservees dans la trace de validation.</p></div>';
	print '<ol class="mjl-activity-timeline">';
	foreach ($items as $item) {
		print '<li><span class="mjl-status-pill">'.dol_escape_htmltag($item['label']).'</span>';
		print '<strong>'.dol_escape_htmltag($item['title']).'</strong>';
		print '<p>'.dol_escape_htmltag($item['meta']).'</p>';
		if ($item['comment'] !== '') {
			print '<p class="mjl-timeline-comment">'.dol_escape_htmltag($item['comment']).'</p>';
		}
		print '</li>';
	}
	print '</ol></section>';
}

function mjl_expenses_options($type)
{
	global $db, $conf;

	if ($type === 'project') {
		$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' ORDER BY ref';
	} elseif ($type === 'convention') {
		$sql = 'SELECT c.rowid, c.ref, c.title, p.ref AS project_ref FROM '.$db->prefix().'mjlfinancement_convention c';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project';
		$sql .= ' WHERE c.entity = '.((int) $conf->entity).' AND c.status = '.MjlConvention::STATUS_ACTIVE.' ORDER BY c.ref';
	} elseif ($type === 'activity') {
		$sql = 'SELECT a.rowid, a.ref, a.label, p.ref AS project_ref FROM '.$db->prefix().'mjlfinancement_activity a';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project';
		$sql .= ' WHERE a.entity = '.((int) $conf->entity).' ORDER BY p.ref, a.ref';
	} elseif ($type === 'budget_line') {
		$sql = 'SELECT bl.rowid, bl.ref, bl.label, p.ref AS project_ref, c.ref AS convention_ref FROM '.$db->prefix().'mjlfinancement_budget_line bl';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = bl.fk_project';
		$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention';
		$sql .= ' WHERE bl.entity = '.((int) $conf->entity).' ORDER BY p.ref, c.ref, bl.ref';
	} else {
		return array();
	}

	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}

	$options = array();
	while ($obj = $db->fetch_object($resql)) {
		if ($type === 'project') {
			$label = $obj->ref.' - '.$obj->title;
		} elseif ($type === 'convention') {
			$label = $obj->ref.' - '.$obj->title;
			if (!empty($obj->project_ref)) $label .= ' ('.$obj->project_ref.')';
		} elseif ($type === 'activity') {
			$label = $obj->ref.' - '.$obj->label;
			if (!empty($obj->project_ref)) $label .= ' ('.$obj->project_ref.')';
		} else {
			$label = $obj->ref.' - '.$obj->label;
			$context = array();
			if (!empty($obj->project_ref)) $context[] = $obj->project_ref;
			if (!empty($obj->convention_ref)) $context[] = $obj->convention_ref;
			if (!empty($context)) $label .= ' ('.implode(' / ', $context).')';
		}
		$options[(int) $obj->rowid] = $label;
	}

	return $options;
}

function mjl_expenses_select($name, $options, $required = 0, $emptyLabel = '')
{
	$html = '<select name="'.dol_escape_htmltag($name).'"'.($required ? ' required' : '').'>';
	if ($emptyLabel !== '') {
		$html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	}
	foreach ($options as $value => $label) {
		$html .= '<option value="'.((int) $value).'">'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_expenses_fetch_detail($id)
{
	global $db, $conf;

	if ((int) $id <= 0) {
		return array();
	}
	$sql = 'SELECT e.rowid, e.entity, e.ref, e.fk_user_creat, e.expense_date, e.amount, e.status, e.description, e.supporting_document, e.correction_reason, e.submitted_at, e.validation_date, e.date_creation,';
	$sql .= ' p.ref AS project_ref, p.title AS project_title, c.ref AS convention_ref, c.title AS convention_title, a.ref AS activity_ref, a.label AS activity_label,';
	$sql .= ' bl.ref AS budget_line_ref, bl.label AS budget_line_label, u.login AS creator_login, uv.login AS validator_login,';
	$sql .= ' '.mjl_expense_document_present_sql('e').' AS document_present, '.mjl_expense_supporting_document_sql('e').' AS supporting_document_resolved';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line AND bl.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = e.fk_user_creat';
	$sql .= ' LEFT JOIN '.$db->prefix().'user uv ON uv.rowid = e.fk_user_valid';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity).' AND e.rowid = '.((int) $id);
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return array();
	}
	$obj = $db->fetch_object($resql);
	if (!$obj) {
		return array();
	}
	$row = (array) $obj;
	$row['evidence_state'] = mjl_expense_evidence_state((int) $row['rowid'], (int) $row['entity'], $row['supporting_document']);
	$row['document_present'] = $row['evidence_state'] === 'downloadable' ? 1 : 0;
	return $row;
}

function mjl_expenses_can_apply_action($expense, $action)
{
	global $user;

	$row = is_array($expense) ? $expense : (array) $expense;
	$status = (int) $row['status'];
	if ($action === 'upload') {
		if (!$user->hasRight('mjlfinancement', 'expense', 'write') || !$user->hasRight('ecm', 'upload') || $status === MjlExpense::STATUS_VALIDATED) return false;
		return !mjl_expenses_requires_own_scope($user) || (int) $row['fk_user_creat'] === (int) $user->id;
	}
	if (in_array($action, array('update', 'submit', 'correct'), true)) {
		if (!$user->hasRight('mjlfinancement', 'expense', 'write')) return false;
		if (mjl_expenses_requires_own_scope($user) && (int) $row['fk_user_creat'] !== (int) $user->id) return false;
		if ($action === 'update') return $status === MjlExpense::STATUS_REJECTED;
		if ($action === 'submit') return in_array($status, array(MjlExpense::STATUS_DRAFT, MjlExpense::STATUS_CORRECTED), true);
		return $status === MjlExpense::STATUS_REJECTED;
	}
	if (in_array($action, array('validate', 'reject'), true)) {
		if (!$user->hasRight('mjlfinancement', 'expense', 'validate') || $status !== MjlExpense::STATUS_SUBMITTED) return false;
		if ((int) $row['fk_user_creat'] === (int) $user->id) return false;
		if ($action === 'validate' && array_key_exists('evidence_state', $row) && $row['evidence_state'] !== 'downloadable') return false;
		if ($action === 'validate' && !array_key_exists('evidence_state', $row) && array_key_exists('document_present', $row) && (int) $row['document_present'] <= 0) return false;
		return true;
	}
	return false;
}

function mjl_expenses_available_actions($row)
{
	$actions = array();
	if (mjl_expenses_can_apply_action($row, 'update')) $actions['update'] = array('label' => 'Modifier');
	if (mjl_expenses_can_apply_action($row, 'submit')) $actions['submit'] = array('label' => 'Soumettre la depense', 'comment' => 'Commentaire de soumission', 'required' => false);
	if (mjl_expenses_can_apply_action($row, 'validate')) $actions['validate'] = array('label' => 'Valider la depense', 'comment' => '', 'required' => false);
	if (mjl_expenses_can_apply_action($row, 'reject')) $actions['reject'] = array('label' => 'Rejeter la depense', 'comment' => 'Motif de rejet', 'required' => true);
	if (mjl_expenses_can_apply_action($row, 'correct')) $actions['correct'] = array('label' => 'Marquer corrigee', 'comment' => 'Motif de correction', 'required' => true);
	return $actions;
}

function mjl_expenses_timeline_items($expense)
{
	global $db, $conf;

	$items = array(array(
		'label' => 'Creee',
		'title' => 'Depense creee',
		'meta' => mjl_expenses_format_datetime($expense['date_creation'] ?? '').' par '.$expense['creator_login'],
		'comment' => '',
	));
	$sql = 'SELECT v.action, v.from_status, v.to_status, v.action_date, v.comment, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
	$sql .= ' WHERE v.entity = '.((int) $conf->entity).' AND v.fk_expense = '.((int) $expense['rowid']);
	$sql .= ' ORDER BY v.action_date ASC, v.rowid ASC';
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return $items;
	}
	while ($row = $db->fetch_object($resql)) {
		$items[] = array(
			'label' => mjl_expense_action_label($row->action),
			'title' => mjl_expense_status_text($row->from_status).' vers '.mjl_expense_status_text($row->to_status),
			'meta' => mjl_expenses_format_datetime($row->action_date).' par '.$row->login,
			'comment' => (string) $row->comment,
		);
	}
	return $items;
}

function mjl_expenses_next_action_label($row)
{
	$status = (int) $row['status'];
	$evidenceState = $row['evidence_state'] ?? '';
	$docPresent = ($evidenceState === 'downloadable') || ($evidenceState === '' && (!array_key_exists('document_present', $row) || (int) $row['document_present'] > 0));
	$docUnavailable = $evidenceState === 'unavailable';
	if ($docUnavailable && in_array($status, array(MjlExpense::STATUS_DRAFT, MjlExpense::STATUS_SUBMITTED, MjlExpense::STATUS_CORRECTED), true)) {
		return 'Remplacer la piece indisponible avant validation.';
	}
	if ($status === MjlExpense::STATUS_DRAFT) return $docPresent ? 'Completer puis soumettre la depense.' : 'Ajouter la piece justificative puis soumettre la depense.';
	if ($status === MjlExpense::STATUS_SUBMITTED) return $docPresent ? 'Decision attendue du niveau de validation.' : 'Validation bloquee tant que la piece justificative manque.';
	if ($status === MjlExpense::STATUS_CORRECTED) return 'Depense corrigee a resoumettre.';
	if ($status === MjlExpense::STATUS_VALIDATED) return 'Depense validee, aucune decision en attente.';
	if ($status === MjlExpense::STATUS_REJECTED) return 'Correction attendue avant resoumission.';
	return 'Suivre l avancement de la depense.';
}

function mjl_expenses_evidence_label($state)
{
	if ($state === 'downloadable') return 'Piece disponible';
	if ($state === 'unavailable') return 'Piece referencee indisponible';
	return 'Piece manquante';
}

function mjl_expenses_status_label($status)
{
	return mjl_expense_status_text($status);
}

function mjl_expense_status_text($status)
{
	$map = array(
		(string) MjlExpense::STATUS_DRAFT => 'Brouillon',
		(string) MjlExpense::STATUS_SUBMITTED => 'Soumise',
		(string) MjlExpense::STATUS_VALIDATED => 'Validee',
		(string) MjlExpense::STATUS_CORRECTED => 'Corrigee',
		(string) MjlExpense::STATUS_REJECTED => 'Rejetee',
		'draft' => 'Brouillon',
		'submitted' => 'Soumise',
		'validated' => 'Validee',
		'corrected' => 'Corrigee',
		'rejected' => 'Rejetee',
	);
	$key = (string) $status;
	return isset($map[$key]) ? $map[$key] : $key;
}

function mjl_expense_action_label($action)
{
	$map = array(
		'submitted' => 'Soumission',
		'validated' => 'Validation',
		'rejected' => 'Rejet',
		'corrected' => 'Correction',
	);
	return isset($map[$action]) ? $map[$action] : (string) $action;
}

function mjl_expenses_status_badge($status)
{
	$tone = in_array((int) $status, array(MjlExpense::STATUS_SUBMITTED, MjlExpense::STATUS_CORRECTED), true) ? 'warning' : 'neutral';
	if ((int) $status === MjlExpense::STATUS_REJECTED) $tone = 'danger';
	return '<span class="mjl-status-pill'.($tone !== 'neutral' ? ' mjl-status-'.$tone : '').'">'.dol_escape_htmltag(mjl_expenses_status_label($status)).'</span>';
}

function mjl_expenses_format_date($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'day') : (string) $value;
}

function mjl_expenses_format_datetime($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'dayhour') : (string) $value;
}

function mjl_expenses_token_input()
{
	global $mjl_expenses_page_token;
	return '<input type="hidden" name="token" value="'.dol_escape_htmltag($mjl_expenses_page_token).'">';
}
