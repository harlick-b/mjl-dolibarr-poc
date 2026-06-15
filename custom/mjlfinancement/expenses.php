<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';

if (!$user->hasRight('mjlfinancement', 'expense', 'read')) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');
$action = GETPOST('action', 'alpha');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		accessforbidden('Invalid security token');
	}
		if (!$user->hasRight('mjlfinancement', 'expense', 'write') && in_array($action, array('create', 'update', 'submit', 'correct'), true)) {
		accessforbidden();
	}
	if (!$user->hasRight('mjlfinancement', 'expense', 'validate') && in_array($action, array('validate', 'reject'), true)) {
		accessforbidden();
	}
	if ($action === 'upload' && (!$user->hasRight('mjlfinancement', 'expense', 'write') || !$user->hasRight('ecm', 'upload'))) {
		accessforbidden();
	}
	mjl_expenses_handle_post($action);
}

$mjl_expenses_page_token = function_exists('newToken') ? newToken() : '';

llxHeader('', 'Depenses MJL');
print load_fiche_titre('Depenses MJL', '', 'expense');

if ($user->hasRight('mjlfinancement', 'expense', 'write')) {
	mjl_expenses_create_form();
}

mjl_expenses_list();

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
		if ($expense->create($user) <= 0) setEventMessages($expense->error, null, 'errors');
		else setEventMessages('Depense creee en brouillon', null, 'mesgs');
		return;
	}

	$id = GETPOSTINT('id');
	$expense = new MjlExpense($db);
	if ($id <= 0 || $expense->fetch($id) <= 0) {
		setEventMessages('Depense introuvable', null, 'errors');
		return;
	}
	if ((int) $expense->entity !== (int) $conf->entity) {
		setEventMessages('Depense introuvable dans l\'entite active', null, 'errors');
		return;
	}

	if ($action === 'update') $result = mjl_expenses_update_rejected($expense);
	elseif ($action === 'submit') $result = $expense->submit($user, GETPOST('comment', 'restricthtml'));
	elseif ($action === 'validate') $result = $expense->validate($user);
	elseif ($action === 'reject') $result = $expense->reject($user, GETPOST('comment', 'restricthtml'));
	elseif ($action === 'correct') $result = $expense->correct($user, GETPOST('comment', 'restricthtml'));
	elseif ($action === 'upload') $result = mjl_expenses_upload_document($expense);
	else return;

	if ($result < 0) setEventMessages($expense->error ?: 'Action refusee', null, 'errors');
	elseif ($result === 0) setEventMessages('Aucun changement applique', null, 'warnings');
	else setEventMessages('Action enregistree', null, 'mesgs');
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

function mjl_expenses_create_form()
{
	print '<form method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<input type="hidden" name="action" value="create">';
	print mjl_expenses_token_input();
	print '<table class="border centpercent">';
	print '<tr class="liste_titre"><th colspan="6">Nouvelle depense</th></tr>';
	print '<tr><td>Ref</td><td><input required name="ref"></td><td>Projet</td><td><input required type="number" name="fk_project"></td><td>Convention</td><td><input required type="number" name="fk_convention"></td></tr>';
	print '<tr><td>Activite</td><td><input type="number" name="fk_mjl_activity"></td><td>Ligne budgetaire</td><td><input required type="number" name="fk_budget_line"></td><td>Montant</td><td><input required name="amount"></td></tr>';
	print '<tr><td>Date</td><td><input type="date" name="expense_date"></td><td>Description</td><td colspan="3"><input class="flat minwidth500" name="description"></td></tr>';
	print '<tr><td colspan="6" class="right"><input class="button" type="submit" value="Creer"></td></tr>';
	print '</table></form><br>';
}

function mjl_expenses_list()
{
	global $db, $conf, $user;

	$sql = 'SELECT e.rowid, e.ref, e.expense_date, e.amount, e.status, e.description, e.supporting_document, e.correction_reason, bl.ref AS budget_line, '.mjl_expense_document_present_sql('e').' AS document_present';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity);
	$sql .= ' ORDER BY e.rowid DESC LIMIT 100';
	$resql = $db->query($sql);
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div>';
		return;
	}
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Ref</th><th>Date</th><th>Ligne</th><th class="right">Montant</th><th>Statut</th><th>Piece</th><th>Actions</th></tr>';
	while ($row = $db->fetch_object($resql)) {
		$docPresent = (int) $row->document_present > 0;
		print '<tr class="oddeven">';
		print '<td>'.dol_escape_htmltag($row->ref).'</td><td>'.dol_escape_htmltag($row->expense_date).'</td><td>'.dol_escape_htmltag($row->budget_line).'</td>';
		print '<td class="right">'.price($row->amount).'</td><td>'.dol_escape_htmltag(mjl_expense_status_label($row->status)).'</td>';
		print '<td>'.($docPresent ? 'piece presente' : 'piece manquante').'</td><td>';
			mjl_expenses_action_forms($row, $docPresent);
		print '</td></tr>';
	}
	print '</table></div>';
}

function mjl_expenses_action_forms($row, $docPresent)
{
	global $user;

	$id = (int) $row->rowid;
	$status = (int) $row->status;
	if ($user->hasRight('mjlfinancement', 'expense', 'write') && $user->hasRight('ecm', 'upload') && $status !== MjlExpense::STATUS_VALIDATED) {
		print '<form class="inline-block" enctype="multipart/form-data" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">'.mjl_expenses_token_input().'<input type="hidden" name="action" value="upload"><input type="hidden" name="id" value="'.$id.'"><input type="file" name="supporting_document"><input class="button" type="submit" value="Upload"></form> ';
	}
	if ($user->hasRight('mjlfinancement', 'expense', 'write') && $status === MjlExpense::STATUS_REJECTED) {
		print mjl_expenses_edit_form($row);
	}
	if ($user->hasRight('mjlfinancement', 'expense', 'write') && in_array($status, array(MjlExpense::STATUS_DRAFT, MjlExpense::STATUS_CORRECTED), true)) {
		print mjl_expenses_button_form($id, 'submit', 'Soumettre');
	}
	if ($user->hasRight('mjlfinancement', 'expense', 'validate') && $status === MjlExpense::STATUS_SUBMITTED) {
		print mjl_expenses_button_form($id, 'validate', 'Valider');
		print mjl_expenses_comment_form($id, 'reject', 'Rejeter', 'Motif rejet');
	}
	if ($user->hasRight('mjlfinancement', 'expense', 'write') && $status === MjlExpense::STATUS_REJECTED) {
		print mjl_expenses_comment_form($id, 'correct', 'Corriger', 'Motif correction');
	}
}

function mjl_expenses_edit_form($row)
{
	return '<form class="inline-block" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">'.mjl_expenses_token_input().'<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row->rowid).'"><input name="amount" class="maxwidth75" value="'.dol_escape_htmltag($row->amount).'"><input type="date" name="expense_date" value="'.dol_escape_htmltag(substr((string) $row->expense_date, 0, 10)).'"><input name="description" value="'.dol_escape_htmltag($row->description).'"><input class="button" type="submit" value="Enregistrer"></form> ';
}

function mjl_expenses_button_form($id, $action, $label)
{
	return '<form class="inline-block" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">'.mjl_expenses_token_input().'<input type="hidden" name="action" value="'.$action.'"><input type="hidden" name="id" value="'.$id.'"><input class="button" type="submit" value="'.$label.'"></form> ';
}

function mjl_expenses_comment_form($id, $action, $label, $placeholder)
{
	return '<form class="inline-block" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">'.mjl_expenses_token_input().'<input type="hidden" name="action" value="'.$action.'"><input type="hidden" name="id" value="'.$id.'"><input name="comment" placeholder="'.$placeholder.'" required><input class="button" type="submit" value="'.$label.'"></form> ';
}

function mjl_expenses_token_input()
{
	global $mjl_expenses_page_token;

	return '<input type="hidden" name="token" value="'.dol_escape_htmltag($mjl_expenses_page_token).'">';
}
