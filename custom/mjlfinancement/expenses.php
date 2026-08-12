<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlbudgetline.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_table.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_journey.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_expense_recovery.lib.php';

if (!mjl_workspace_can_access_expense($user)) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');
$action = GETPOST('action', 'alpha');
$expenseId = GETPOSTINT('id');
$presentationAction = $_SERVER['REQUEST_METHOD'] === 'GET' && (in_array($action, array('create', 'edit', 'upload'), true) || in_array($action, mjl_expenses_guarded_review_actions(), true)) ? $action : '';
$presentationExpense = array();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		mjl_expenses_forbidden('Invalid security token');
	}
	if (!mjl_workspace_can_apply_expense_write($user) && in_array($action, array('create', 'update', 'submit', 'correct'), true)) {
		mjl_expenses_forbidden();
	}
	if (!mjl_workspace_can_apply_expense_validation($user) && in_array($action, array('validate', 'prevalidate', 'final_validate', 'disburse', 'reject'), true)) {
		mjl_expenses_forbidden();
	}
	if ($action === 'upload' && !mjl_workspace_can_apply_expense_write($user)) {
		mjl_expenses_forbidden();
	}
	mjl_expenses_handle_post($action);
}

$mjl_expenses_page_token = function_exists('newToken') ? newToken() : '';
$mjl_expense_document_state = GETPOST('mjl_document_state', 'alphanohtml');
if ($presentationAction === 'create') {
	if ($expenseId !== 0 || !mjl_workspace_can_apply_expense_write($user)) {
		mjl_expenses_forbidden();
	}
	$mjl_expense_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'expenses', 'object_id' => 0),
		array('create' => array('create'))
	);
} elseif ($presentationAction === 'edit') {
	$presentationExpense = mjl_expenses_fetch_detail($expenseId);
	if (empty($presentationExpense) || !mjl_expenses_can_open($presentationExpense) || !mjl_expenses_can_apply_action($presentationExpense, 'update')) {
		mjl_expenses_forbidden();
	}
	$mjl_expense_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'expenses', 'object_id' => $expenseId),
		array('correction' => array('update'))
	);
} elseif ($presentationAction === 'upload') {
	$presentationExpense = mjl_expenses_fetch_detail($expenseId);
	if (empty($presentationExpense) || !mjl_expenses_can_open($presentationExpense) || !mjl_expenses_can_apply_action($presentationExpense, 'upload')) {
		mjl_expenses_forbidden();
	}
	$mjl_expense_recovery = array();
} elseif ($presentationAction !== '') {
	$presentationExpense = mjl_expenses_fetch_detail($expenseId);
	if (empty($presentationExpense) || !mjl_expenses_can_open($presentationExpense) || !mjl_expenses_can_apply_action($presentationExpense, $presentationAction)) {
		mjl_expenses_forbidden();
	}
	$recoveryConfig = mjl_expense_recovery_config($presentationAction);
	$mjl_expense_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'expenses', 'object_id' => $expenseId),
		array((string) $recoveryConfig['form'] => array($presentationAction))
	);
} else {
	$mjl_expense_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'expenses', 'object_id' => $expenseId),
		array('correction' => array('correct'), 'decision' => array('submit'), 'comment' => array('add_exchange'))
	);
}

llxHeader('', 'Dépenses MJL');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace mjl-expense-workspace">';

if ($presentationAction === 'create') {
	mjl_expenses_render_create_state();
} elseif ($presentationAction === 'edit') {
	mjl_expenses_render_edit_state($presentationExpense);
} elseif ($presentationAction === 'upload') {
	mjl_expenses_render_upload_state($presentationExpense);
} elseif ($presentationAction !== '') {
	mjl_expenses_render_action_state($presentationExpense, $presentationAction);
} elseif ($expenseId > 0) {
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
		$fkProject = GETPOSTINT('fk_project');
		$fkConvention = GETPOSTINT('fk_convention');
		$fkActivity = GETPOSTINT('fk_mjl_activity');
		$fkBudgetLine = GETPOSTINT('fk_budget_line');
		if (!mjl_expenses_can_use_links($fkProject, $fkConvention, $fkActivity, $fkBudgetLine)) {
			mjl_expenses_forbidden('Rattachement financier hors de votre périmètre');
		}
		$createErrors = array();
		$postedRef = trim((string) GETPOST('ref', 'alphanohtml'));
		$postedAmount = price2num(GETPOST('amount', 'alpha'));
		if ($postedRef === '') $createErrors['ref'] = 'La référence est obligatoire.';
		if ((float) $postedAmount <= 0) $createErrors['amount'] = 'Le montant doit être supérieur à zéro.';
		if (!empty($createErrors)) {
			$handle = mjl_expenses_store_recovery_config('create', 0, $createErrors);
			mjl_feedback_add('expenses:create:validation', 'generic.validation');
			mjl_expenses_redirect(0, $handle, '', 'create');
		}
		$expense = new MjlExpense($db);
		$expense->entity = (int) $conf->entity;
		$expense->ref = $postedRef;
		$expense->fk_project = $fkProject;
		$expense->fk_convention = $fkConvention;
		$expense->fk_mjl_activity = $fkActivity;
		$expense->fk_budget_line = $fkBudgetLine;
		$expense->amount = $postedAmount;
		$date = GETPOST('expense_date', 'alphanohtml');
		$expense->expense_date = empty($date) ? dol_now() : strtotime($date);
		$expense->description = GETPOST('description', 'restricthtml');
		$expense->status = MjlExpense::STATUS_DRAFT;
		$expense->fk_user_creat = $user->id;
		$result = $expense->create($user);
		if ($result <= 0) {
			$errors = mjl_form_translate_domain_error($expense->error);
			$isValidationFailure = !empty($errors);
			$recoveryErrors = $isValidationFailure ? $errors : array('_form' => mjl_ui_safe_error_message('unknown'));
			$handle = mjl_expenses_store_recovery_config('create', 0, $recoveryErrors);
			mjl_feedback_add('expenses:create:domain', $isValidationFailure ? 'generic.validation' : 'generic.error');
			mjl_ui_log_error('domain', array('route' => 'expenses', 'action' => 'create', 'entity' => (int) $conf->entity, 'user_id' => (int) $user->id, 'object_type' => 'expense'), $expense->error);
			mjl_expenses_redirect(0, $handle, '', 'create');
		}
		mjl_feedback_add('expenses:create:'.((int) $result), 'expense.created');
		mjl_expenses_redirect((int) $result);
	}

	$id = GETPOSTINT('id');
	$row = mjl_expenses_fetch_detail($id);
	if (empty($row) || !mjl_expenses_can_open($row)) {
		mjl_expenses_forbidden('Dépense introuvable ou hors de votre périmètre');
	}
	if ($action === 'add_exchange') {
		list($result, $message) = mjl_timeline_create_comment($user, 'mjlfinancement_expense', $id, GETPOST('message', 'restricthtml'));
		if ($result <= 0) {
			$handle = mjl_expenses_store_recovery_config('add_exchange', $id, array('message' => $message));
			mjl_feedback_add('expenses:add_exchange:'.$id.':error', 'generic.validation');
			mjl_expenses_redirect($id, $handle);
		}
		mjl_feedback_add('expenses:add_exchange:'.$id, 'expense.comment_added');
		mjl_expenses_redirect($id);
	}
	if (!mjl_expenses_can_apply_action($row, $action)) {
		if (mjl_expenses_is_verified_stale_form($row, $action)) {
			mjl_expenses_forbidden('Cette décision a déjà été traitée ou l’état de la dépense a changé. Rechargez la page avant de continuer.');
		}
		mjl_expenses_forbidden();
	}

	$expense = new MjlExpense($db);
	if ($expense->fetch($id) <= 0 || (int) $expense->entity !== (int) $conf->entity) {
		mjl_expenses_forbidden('Dépense introuvable ou hors de votre périmètre');
	}

	if ($action === 'update') $result = mjl_expenses_update_rejected($expense);
	elseif ($action === 'submit') $result = $expense->submit($user, GETPOST('comment', 'restricthtml'));
	elseif ($action === 'validate') $result = $expense->validate($user);
	elseif ($action === 'prevalidate') $result = $expense->prevalidate($user, GETPOST('prevalidated_amount', 'alpha'), GETPOST('comment', 'restricthtml'));
	elseif ($action === 'final_validate') $result = $expense->finalValidate($user, GETPOST('final_validated_amount', 'alpha'), GETPOST('comment', 'restricthtml'));
	elseif ($action === 'disburse') $result = $expense->disburse($user, GETPOST('beneficiary_name', 'restricthtml'), GETPOST('disbursement_date', 'alphanohtml'));
	elseif ($action === 'reject') $result = $expense->reject($user, GETPOST('comment', 'restricthtml'));
	elseif ($action === 'correct') $result = $expense->correct($user, GETPOST('comment', 'restricthtml'));
	elseif ($action === 'upload') $result = mjl_expenses_upload_document($expense);
	else mjl_expenses_redirect($id);

	if ($result < 0) {
		$errors = mjl_form_translate_domain_error($expense->error);
		$isValidationFailure = !empty($errors);
		$recoveryErrors = $isValidationFailure ? $errors : array('_form' => mjl_ui_safe_error_message('unknown'));
		mjl_feedback_add('expenses:'.$action.':'.$id.':error', $isValidationFailure ? 'generic.validation' : 'generic.error');
		mjl_ui_log_error('domain', array('route' => 'expenses', 'action' => $action, 'entity' => (int) $conf->entity, 'user_id' => (int) $user->id, 'object_type' => 'expense', 'object_id' => $id), $expense->error);
		if ($action === 'upload') mjl_expenses_redirect($id, '', 'upload-failed', 'upload');
		$handle = mjl_expenses_store_recovery_config($action, $id, $recoveryErrors);
		$recoveryState = $action === 'update' ? 'edit' : (in_array($action, mjl_expenses_guarded_review_actions(), true) ? $action : '');
		mjl_expenses_redirect($id, $handle, '', $recoveryState);
	}
	elseif ($result === 0) mjl_feedback_add('expenses:'.$action.':'.$id.':unchanged', 'generic.no_change');
	else mjl_feedback_add('expenses:'.$action.':'.$id, 'expense.saved');
	mjl_expenses_redirect($id);
}

function mjl_expenses_is_verified_stale_form($row, $action)
{
	global $user;
	$posted = GETPOST('expected_status', 'alphanohtml');
	if ($posted === '' || !preg_match('/^[0-9]+$/', (string) $posted)) return false;
	if ((int) $row['fk_user_creat'] === (int) $user->id) return false;
	$current = (int) $row['status'];
	$expected = (int) $posted;
	if ($current === $expected) return false;
	if ($action === 'final_validate' && mjl_scope_is_final_validator($user) && $expected === MjlExpense::STATUS_PREVALIDATED) {
		return in_array($current, array(MjlExpense::STATUS_VALIDATED, MjlExpense::STATUS_FINAL_VALIDATED, MjlExpense::STATUS_DISBURSED, MjlExpense::STATUS_REJECTED), true);
	}
	if ($action === 'prevalidate' && mjl_scope_is_verifier($user) && $expected === MjlExpense::STATUS_SUBMITTED) {
		return in_array($current, array(MjlExpense::STATUS_VALIDATED, MjlExpense::STATUS_PREVALIDATED, MjlExpense::STATUS_FINAL_VALIDATED, MjlExpense::STATUS_DISBURSED, MjlExpense::STATUS_REJECTED), true);
	}
	if ($action === 'disburse' && mjl_scope_is_final_validator($user) && in_array($expected, array(MjlExpense::STATUS_VALIDATED, MjlExpense::STATUS_FINAL_VALIDATED), true)) {
		return $current === MjlExpense::STATUS_DISBURSED;
	}
	if ($action === 'reject' && (mjl_scope_is_verifier($user) || mjl_scope_is_final_validator($user)) && in_array($expected, array(MjlExpense::STATUS_SUBMITTED, MjlExpense::STATUS_PREVALIDATED), true)) {
		return in_array($current, array(MjlExpense::STATUS_CORRECTED, MjlExpense::STATUS_FINAL_VALIDATED, MjlExpense::STATUS_DISBURSED, MjlExpense::STATUS_REJECTED), true);
	}
	return false;
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

function mjl_expenses_redirect($id, $recoveryHandle = '', $documentState = '', $presentationAction = '')
{
	$url = DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php';
	$query = array();
	if ((int) $id > 0) $query['id'] = (int) $id;
	if ((string) $presentationAction !== '') $query['action'] = (string) $presentationAction;
	if ((string) $recoveryHandle !== '') $query['mjl_recovery'] = (string) $recoveryHandle;
	if (in_array((string) $documentState, array('upload-failed'), true)) $query['mjl_document_state'] = (string) $documentState;
	if (!empty($query)) $url .= '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986);
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
		$normalizedAmount = price2num($amount);
		if ((float) $normalizedAmount <= 0) {
			$expense->error = 'Expense amount must be greater than zero';
			return -1;
		}
		$expense->amount = $normalizedAmount;
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

	if (!$user->hasRight('mjlfinancement', 'expense', 'read') || !$user->hasRight('mjlfinancement', 'expense', 'write')) {
		$expense->error = 'Permission denied for expense document upload';
		return -1;
	}
	if ((int) $expense->entity !== (int) $conf->entity) {
		$expense->error = 'Expense not found in active entity';
		return -1;
	}
	if (in_array((int) $expense->status, array(MjlExpense::STATUS_VALIDATED, MjlExpense::STATUS_FINAL_VALIDATED, MjlExpense::STATUS_DISBURSED), true)) {
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
	if (mjl_record_expense_validation_event($expense, $expense->status, $expense->status, $user, dol_now(), 'document_uploaded', 'Piece justificative ajoutee', mjl_actor_role_code($user)) < 0) {
		$db->rollback();
		@unlink($target);
		$expense->error = mjl_integrity_error();
		return -1;
	}
	if (mjl_workflow_audit_insert('mjlfinancement_expense', $expenseId, (int) $expense->entity, mjl_expense_status_label($expense->status), $user, mjl_actor_role_code($user), 'document_uploaded', 'Piece justificative ajoutee: '.$filename, array(
		'supporting_document' => array('before' => '', 'after' => $filename),
	), 'WFA-EXP') < 0) {
		$db->rollback();
		@unlink($target);
		$expense->error = 'Impossible d enregistrer l audit de la piece justificative';
		return -1;
	}
	$db->commit();
	$expense->supporting_document = $filename;
	return 1;
}

function mjl_expenses_render_list_page()
{
	$headerOptions = array(
		'description' => 'Consultez les dépenses de votre périmètre, ouvrez le détail et traitez les pièces ou décisions attendues.',
		'context' => array('label' => 'Périmètre', 'value' => mjl_expenses_scope_label()),
	);
	if (mjl_workspace_can_apply_expense_write($GLOBALS['user'])) {
		$headerOptions['primary_action'] = array('label' => 'Créer une dépense', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?action=create');
	}
	print mjl_page_header_render('Dépenses et pièces justificatives', $headerOptions);
	mjl_expenses_list();
}

function mjl_expenses_render_create_state()
{
	print mjl_page_header_render(
		'Créer une dépense',
		array(
			'breadcrumb' => array(
				array('label' => 'Dépenses', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php'),
				array('label' => 'Créer'),
			),
			'description' => 'Créez un brouillon rattaché aux éléments financiers accessibles dans votre périmètre.',
		)
	);
	mjl_expenses_create_form();
}

function mjl_expenses_render_edit_state($row)
{
	print mjl_page_header_render(
		'Modifier la dépense '.$row['ref'],
		array(
			'breadcrumb' => array(
				array('label' => 'Dépenses', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php'),
				array('label' => $row['ref'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid'])),
				array('label' => 'Modifier'),
			),
			'description' => 'Corrigez les informations modifiables avant de reprendre le circuit de validation.',
			'context' => array('label' => 'Statut actuel', 'value' => mjl_expenses_status_label($row['status'])),
		)
	);
	mjl_expenses_render_summary_card($row);
	mjl_expenses_render_update_form($row);
}

function mjl_expenses_render_detail($id)
{
	$row = mjl_expenses_fetch_detail($id);
	if (empty($row) || !mjl_expenses_can_open($row)) {
		mjl_expenses_forbidden();
	}

	$headerOptions = array(
			'breadcrumb' => array(
				array('label' => 'Dépenses', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php'),
				array('label' => $row['ref']),
			),
			'description' => mjl_expenses_next_action_label($row),
			'context' => array('label' => 'Statut', 'value' => mjl_expenses_status_label($row['status'])),
		);
	if (mjl_expenses_can_apply_action($row, 'update')) {
		$headerOptions['primary_action'] = array('label' => 'Modifier la dépense', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']).'&action=edit');
	}
	print mjl_page_header_render($row['ref'], $headerOptions);

	print '<div class="mjl-activity-detail-grid">';
	mjl_expenses_render_summary_card($row);
	mjl_expenses_render_document_panel($row);
	mjl_expenses_render_decision_panel($row);
	print '</div>';
	mjl_expenses_render_timeline($row);
}

function mjl_expenses_render_action_state($row, $action)
{
	$actions = mjl_expenses_available_actions($row);
	if (!isset($actions[$action]) || !in_array($action, mjl_expenses_guarded_review_actions(), true)) {
		mjl_expenses_forbidden();
	}
	$titles = array(
		'prevalidate' => 'Prévalider la dépense',
		'final_validate' => 'Valider définitivement la dépense',
		'disburse' => 'Enregistrer le décaissement',
		'reject' => 'Rejeter la dépense',
	);
	$title = $titles[$action];
	print mjl_page_header_render(
		$title,
		array(
			'breadcrumb' => array(
				array('label' => 'Dépenses', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php'),
				array('label' => $row['ref'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid'])),
				array('label' => $title),
			),
			'description' => $action === 'reject' ? 'Indiquez le motif avant d’interrompre le traitement de cette dépense.' : ($action === 'disburse' ? 'Renseignez le bénéficiaire et la date uniquement lorsque les fonds ont effectivement été versés.' : 'Vérifiez la pièce justificative et le montant avant de poursuivre.'),
			'context' => array('label' => 'Statut actuel', 'value' => mjl_expenses_status_label($row['status'])),
		)
	);
	print '<section class="mjl-workspace-section mjl-activity-card mjl-activity-decision">';
	print '<div class="mjl-section-heading"><h2>'.dol_escape_htmltag($actions[$action]['label']).'</h2><p>Cette décision conserve les contrôles de rôle, de périmètre, de justificatif et d’état de la dépense.</p></div>';
	mjl_expenses_render_decision_form($row, $action, $actions[$action], true);
	print '</section>';
}

function mjl_expenses_render_upload_state($row)
{
	$title = 'Ajouter une pièce justificative à la dépense '.$row['ref'];
	print mjl_page_header_render(
		$title,
		array(
			'breadcrumb' => array(
				array('label' => 'Dépenses', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php'),
				array('label' => $row['ref'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid'])),
				array('label' => 'Ajouter une pièce justificative'),
			),
			'description' => 'Ajoutez la pièce requise pour documenter cette dépense. Elle restera accessible uniquement par le téléchargement MJL gardé.',
			'context' => array('label' => 'Statut actuel', 'value' => mjl_expenses_status_label($row['status'])),
		)
	);
	mjl_expenses_render_document_panel($row, false);
	print '<section class="mjl-workspace-section mjl-activity-card"><div class="mjl-section-heading"><h2>Pièce à ajouter</h2><p>Sélectionnez le fichier justificatif associé à cette dépense.</p></div>';
	print '<form class="mjl-activity-action-form" enctype="multipart/form-data" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'" data-mjl-form="expense-upload" data-mjl-substantive>';
	print mjl_expenses_token_input().'<input type="hidden" name="action" value="upload"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<label>Pièce justificative<input required type="file" name="supporting_document"></label>';
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Ajouter la pièce"><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']).'">Annuler</a></div>';
	print '</form></section>';
}

function mjl_expenses_create_form()
{
	$recovery = mjl_expenses_recovery_for_action('create');
	$isRecovered = !empty($recovery['recovered']);
	$values = $recovery['values'];
	$errors = $recovery['errors'];
	$projectOptions = mjl_expenses_options('project');
	$conventionOptions = mjl_expenses_options('convention');
	$activityOptions = mjl_expenses_options('activity');
	$budgetLineOptions = mjl_expenses_options('budget_line');

	print '<section class="mjl-workspace-section mjl-activity-panel">';
	print '<div class="mjl-section-heading"><h2>Nouvelle dépense</h2><p>Créez un brouillon rattaché à un projet, une convention et une ligne budgétaire.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'" data-mjl-validate data-mjl-form="expense-create" data-mjl-substantive'.($isRecovered ? ' data-mjl-recovered="true"' : '').'>';
	print '<input type="hidden" name="action" value="create">';
	print mjl_expenses_token_input();
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($errors, 'Corrigez les champs indiqués', 'mjl-expense-create-', $isRecovered).'</div>';
	print mjl_form_field('ref', 'Référence', '<input required name="ref" value="'.dol_escape_htmltag($values['ref'] ?? '').'">', true, '', $errors['ref'] ?? '', 'mjl-expense-create-');
	print mjl_form_field('fk_project', 'Projet', mjl_expenses_select('fk_project', $projectOptions, 1, 'Choisir', (int) ($values['fk_project'] ?? 0)), true, '', $errors['fk_project'] ?? '', 'mjl-expense-create-');
	print mjl_form_field('fk_convention', 'Enveloppe de financement', mjl_expenses_select('fk_convention', $conventionOptions, 1, 'Choisir', (int) ($values['fk_convention'] ?? 0)), true, '', $errors['fk_convention'] ?? '', 'mjl-expense-create-');
	print mjl_form_field('fk_mjl_activity', 'Activité', mjl_expenses_select('fk_mjl_activity', $activityOptions, 0, 'Aucune', (int) ($values['fk_mjl_activity'] ?? 0)), false, '', $errors['fk_mjl_activity'] ?? '', 'mjl-expense-create-');
	print mjl_form_field('fk_budget_line', 'Ligne budgétaire', mjl_expenses_select('fk_budget_line', $budgetLineOptions, 1, 'Choisir', (int) ($values['fk_budget_line'] ?? 0)), true, '', $errors['fk_budget_line'] ?? '', 'mjl-expense-create-');
	print mjl_form_field('amount', 'Montant', '<input required name="amount" value="'.dol_escape_htmltag($values['amount'] ?? '').'">', true, '', $errors['amount'] ?? '', 'mjl-expense-create-');
	print mjl_form_field('expense_date', 'Date', '<input type="date" name="expense_date" value="'.dol_escape_htmltag($values['expense_date'] ?? '').'">', false, '', $errors['expense_date'] ?? '', 'mjl-expense-create-');
	print mjl_form_field('description', 'Description', '<input name="description" value="'.dol_escape_htmltag($values['description'] ?? '').'">', false, '', $errors['description'] ?? '', 'mjl-expense-create-');
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Créer la dépense"><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php">Annuler</a></div>';
	print '</form></section>';
}

function mjl_expenses_list()
{
	global $db, $conf;
	$partnerOptions = mjl_expenses_options('partner');
	$projectOptions = mjl_expenses_options('project');
	$raw = array();
	foreach (array('partner', 'project', 'status', 'sort', 'page') as $key) $raw[$key] = isset($_GET[$key]) && is_scalar($_GET[$key]) ? (string) $_GET[$key] : '';
	$schema = array(
		'partner' => array('type' => 'id', 'allowed' => array_keys($partnerOptions), 'default' => 0),
		'project' => array('type' => 'id', 'allowed' => array_keys($projectOptions), 'default' => 0),
		'status' => array('type' => 'enum', 'allowed' => array('0', '1', '2', '3', '4', '6', '7', '8'), 'default' => ''),
		'sort' => array('type' => 'enum', 'allowed' => array('recent', 'amount'), 'default' => 'recent'),
		'page' => array('type' => 'page', 'default' => 1),
	);
	$filters = mjl_table_normalize_generic($raw, $schema, 50);
	if (!$filters['fail_closed'] && $filters['partner'] > 0 && $filters['project'] > 0 && !mjl_expenses_project_matches_partner($filters['project'], $filters['partner'])) $filters['fail_closed'] = true;
	$fragments = mjl_expenses_list_fragments($filters);
	$total = $filters['fail_closed'] ? 0 : null;
	$countAvailable = true;
	if (!$filters['fail_closed']) {
		$resql = $db->query('SELECT COUNT(DISTINCT e.rowid) AS nb'.$fragments['from'].$fragments['where']);
		if ($resql) {
			$countRow = $db->fetch_object($resql);
			$total = $countRow ? (int) $countRow->nb : 0;
			$filters = mjl_table_normalize_generic($raw, $schema, 50, $total);
			if ($filters['partner'] > 0 && $filters['project'] > 0 && !mjl_expenses_project_matches_partner($filters['project'], $filters['partner'])) $filters['fail_closed'] = true;
			$fragments = mjl_expenses_list_fragments($filters);
		} else {
			$countAvailable = false;
			mjl_ui_log_error('database', mjl_expenses_error_context('list_count'), $db->lasterror());
		}
	}
	$rows = array();
	$rowsAvailable = true;
	$hasExtra = false;
	if (!$filters['fail_closed']) {
		$order = $filters['sort'] === 'amount' ? ' ORDER BY e.amount DESC, e.rowid DESC' : ' ORDER BY e.rowid DESC';
		$offset = ((int) $filters['page'] - 1) * 50;
		$sql = 'SELECT DISTINCT e.rowid, e.entity, e.ref, e.expense_date, e.amount, e.status, e.description, e.fk_user_creat, e.supporting_document, bl.ref AS budget_line, p.ref AS project_ref, s.nom AS partner_name, u.login AS creator_login, '.mjl_expense_document_present_sql('e').' AS document_present';
		$sql .= $fragments['from'].$fragments['where'].$order.' LIMIT 51 OFFSET '.max(0, $offset);
		$resql = $db->query($sql);
		if (!$resql) {
			$rowsAvailable = false;
			mjl_ui_log_error('database', mjl_expenses_error_context('list_rows'), $db->lasterror());
		} else {
			while ($row = $db->fetch_object($resql)) $rows[] = (array) $row;
			$hasExtra = count($rows) > 50;
			if ($hasExtra) array_pop($rows);
		}
	}

	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Dépenses du périmètre</h2><p>Ouvrez une dépense pour consulter son statut, sa pièce justificative et son historique.</p></div>';
	mjl_expenses_render_list_filters($filters, $partnerOptions, $projectOptions);
	if (!$countAvailable && $rowsAvailable) print mjl_ui_system_state('partial-error', 'Total indisponible', 'Les dépenses accessibles restent affichées, mais le total ne peut pas être calculé.');
	print '<p class="mjl-scoped-count">Résultats dans votre périmètre : <strong data-mjl-scoped-count>'.($total === null ? 'Indisponible' : (int) $total).'</strong></p>';
	if (!$rowsAvailable) {
		print mjl_ui_system_state('unavailable', 'Liste indisponible', mjl_ui_safe_error_message('database'), array('href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php', 'action' => 'Réessayer'));
	} elseif (empty($rows)) {
		$filtered = $filters['fail_closed'] || $filters['partner'] > 0 || $filters['project'] > 0 || $filters['status'] !== '';
		print $filtered
			? mjl_ui_system_state('filtered-empty', 'Aucun résultat', 'Aucune dépense ne correspond aux filtres appliqués.', array('href' => DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php', 'action' => 'Réinitialiser'))
			: mjl_ui_system_state('initial-empty', 'Aucune dépense', 'Aucune dépense dans votre périmètre pour le moment.');
	} else {
		print '<div class="div-table-responsive-no-min mjl-dashboard-table mjl-operational-table"><table class="noborder centpercent" aria-label="Dépenses du périmètre">';
		print '<thead><tr class="liste_titre"><th>Dépense</th><th>Statut</th><th>Partenaire / Programme</th><th>Projet</th><th>Ligne</th><th>Date</th><th class="right">Montant</th><th>Pièce</th><th>Créateur</th><th>Action attendue</th><th>Ouvrir</th></tr></thead><tbody>';
		foreach ($rows as $row) {
			$href = DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']);
			$evidenceState = mjl_expense_evidence_state((int) $row['rowid'], (int) $row['entity'], $row['supporting_document']);
			print '<tr class="oddeven">';
			print '<td data-label="Dépense"><a class="mjl-table-link" href="'.dol_escape_htmltag($href).'">'.dol_escape_htmltag($row['ref']).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($row['description']).'</span></td>';
			print '<td data-label="Statut">'.mjl_expenses_status_badge($row['status']).'</td>';
			print '<td data-label="Partenaire / Programme">'.dol_escape_htmltag($row['partner_name']).'</td>';
			print '<td data-label="Projet">'.dol_escape_htmltag($row['project_ref']).'</td>';
			print '<td data-label="Ligne">'.dol_escape_htmltag($row['budget_line']).'</td>';
			print '<td data-label="Date">'.dol_escape_htmltag(mjl_expenses_format_date($row['expense_date'])).'</td>';
			print '<td class="right" data-label="Montant">'.dol_escape_htmltag(mjl_format_money($row['amount'])).'</td>';
			print '<td data-label="Pièce">'.dol_escape_htmltag(mjl_expenses_evidence_label($evidenceState)).'</td>';
			print '<td data-label="Créateur">'.dol_escape_htmltag($row['creator_login']).'</td>';
			print '<td data-label="Action attendue">'.dol_escape_htmltag(mjl_expenses_next_action_label($row)).'</td>';
			print '<td data-label="Ouvrir"><a class="mjl-table-link" href="'.dol_escape_htmltag($href).'">Ouvrir</a></td>';
			print '</tr>';
		}
		print '</tbody></table></div>';
	}
	$hasPrevious = !$filters['fail_closed'] && (int) $filters['page'] > 1;
	$hasNext = !$filters['fail_closed'] && ($total === null ? $hasExtra : ((int) $filters['page'] * 50 < (int) $total));
	print mjl_table_render_pagination(DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php', $filters, $total, $hasPrevious, $hasNext, 'dépenses');
	print '</section>';
}

function mjl_expenses_list_fragments($filters)
{
	global $db, $conf;
	$from = ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$from .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line AND bl.entity = e.entity';
	$from .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$from .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$from .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = c.entity';
	$from .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = e.fk_user_creat';
	$where = ' WHERE e.entity = '.((int) $conf->entity).mjl_expenses_scope_sql('e');
	if (!empty($filters['fail_closed'])) return array('from' => $from, 'where' => $where.' AND 1 = 0');
	if ((int) $filters['partner'] > 0) $where .= ' AND c.fk_soc = '.((int) $filters['partner']);
	if ((int) $filters['project'] > 0) $where .= ' AND e.fk_project = '.((int) $filters['project']);
	if ($filters['status'] !== '') $where .= ' AND e.status = '.((int) $filters['status']);
	return array('from' => $from, 'where' => $where);
}

function mjl_expenses_render_list_filters($filters, $partnerOptions, $projectOptions)
{
	$partners = array('' => 'Tous les partenaires');
	foreach ($partnerOptions as $id => $label) $partners[(string) ((int) $id)] = $label;
	$projects = array('' => 'Tous les projets');
	foreach ($projectOptions as $id => $label) $projects[(string) ((int) $id)] = $label;
	$statuses = array('' => 'Tous les statuts');
	foreach (array(0, 1, 2, 3, 4, 6, 7, 8) as $status) $statuses[(string) $status] = mjl_ui_expense_status($status)['label'];
	print mjl_table_render_filter_bar(
		DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php',
		'expenses',
		'dépenses',
		array(
			array('name' => 'partner', 'label' => 'Partenaire / Programme', 'value' => (string) $filters['partner'], 'default' => '', 'options' => $partners),
			array('name' => 'project', 'label' => 'Projet', 'value' => (string) $filters['project'], 'default' => '', 'options' => $projects),
			array('name' => 'status', 'label' => 'Statut', 'value' => (string) $filters['status'], 'default' => '', 'options' => $statuses),
			array('name' => 'sort', 'label' => 'Trier par', 'value' => (string) $filters['sort'], 'default' => 'recent', 'options' => array('recent' => 'Plus récentes', 'amount' => 'Montant décroissant')),
		)
	);
}

function mjl_expenses_project_matches_partner($projectId, $partnerId)
{
	global $db, $conf;
	$sql = 'SELECT rowid FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' AND rowid = '.((int) $projectId).' AND fk_soc = '.((int) $partnerId);
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_expenses_error_context($action)
{
	global $conf, $user;
	return array('route' => 'expenses', 'action' => (string) $action, 'entity' => (int) $conf->entity, 'user_id' => (int) $user->id);
}

function mjl_expenses_render_summary_card($row)
{
	$statusPresentation = mjl_ui_expense_status($row['status']);
	print mjl_journey_render_summary(array(
		'title' => 'Synthèse de la dépense',
		'description' => 'Statut, montants, rattachement et responsabilites visibles avant les details.',
		'items' => array(
			array('label' => 'Statut', 'value' => $statusPresentation['label'], 'tone' => $statusPresentation['tone']),
			array('label' => 'Action attendue', 'value' => mjl_expenses_next_action_label($row), 'tone' => 'warning'),
			array('label' => 'Pièce justificative', 'value' => mjl_expenses_evidence_label($row['evidence_state'] ?? ''), 'tone' => ($row['evidence_state'] ?? '') === 'downloadable' ? 'success' : 'warning'),
			array('label' => 'Projet', 'value' => $row['project_ref'].' - '.$row['project_title']),
			array('label' => 'Enveloppe', 'value' => $row['convention_ref'].' - '.$row['convention_title']),
			array('label' => 'Activité', 'value' => $row['activity_ref'] ?: 'Aucune'),
			array('label' => 'Ligne budgétaire', 'value' => $row['budget_line_ref'].' - '.$row['budget_line_label']),
			array('label' => 'Montant demande', 'value' => mjl_expenses_money_or_empty($row['amount'])),
			array('label' => 'Montant prévalidé', 'value' => mjl_expenses_money_or_empty($row['prevalidated_amount'])),
			array('label' => 'Montant valide definitivement', 'value' => mjl_expenses_money_or_empty($row['final_validated_amount'])),
			array('label' => 'Montant décaissé', 'value' => mjl_expenses_money_or_empty($row['disbursed_amount'])),
			array('label' => 'Date dépense', 'value' => mjl_expenses_format_date($row['expense_date'])),
			array('label' => 'Date validation definitive', 'value' => mjl_expenses_format_datetime($row['final_validation_date'] ?: $row['validation_date'])),
			array('label' => 'Date décaissement', 'value' => mjl_expenses_format_date($row['disbursement_date'])),
			array('label' => 'Bénéficiaire', 'value' => $row['beneficiary_name'] ?: 'Non renseigné'),
			array('label' => 'Créateur', 'value' => $row['creator_login']),
			array('label' => 'Prévalidateur', 'value' => $row['prevalidator_login'] ?: 'Non prévalidée'),
			array('label' => 'Validateur définitif', 'value' => $row['final_validator_login'] ?: $row['validator_login'] ?: 'Non validée'),
			array('label' => 'Acteur décaissement', 'value' => $row['disburser_login'] ?: 'Non décaissée'),
		),
	));
}

function mjl_expenses_render_decision_panel($row)
{
	print '<section class="mjl-activity-card mjl-activity-decision">';
	print '<div class="mjl-section-heading"><h2>Décision et correction</h2><p>Actions disponibles selon votre rôle, la pièce justificative et l’état actuel.</p></div>';
	$actions = mjl_expenses_available_actions($row);
	if (empty($actions)) {
		print '<div class="mjl-empty-state">Aucune action directe n’est attendue de votre rôle pour cette dépense.</div>';
		print '</section>';
		return;
	}
	foreach ($actions as $action => $meta) {
		if ($action === 'update') continue;
		if (in_array($action, mjl_expenses_guarded_review_actions(), true)) {
			print '<a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']).'&amp;action='.dol_escape_htmltag($action).'">'.dol_escape_htmltag($meta['label']).'</a>';
			continue;
		}
		mjl_expenses_render_decision_form($row, $action, $meta);
	}
	print '</section>';
}

function mjl_expenses_render_update_form($row)
{
	$recovery = mjl_expenses_recovery_for_action('update');
	$values = $recovery['values'];
	$errors = $recovery['errors'];
	$isRecovered = !empty($recovery['recovered']);
	$prefix = 'mjl-expense-update-';
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Informations de la dépense</h2><p>Les corrections restent soumises aux contrôles de périmètre, de propriété et d’état.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'" data-mjl-validate data-mjl-form="expense-update" data-mjl-substantive'.($isRecovered ? ' data-mjl-recovered="true"' : '').'>';
	print mjl_expenses_token_input().'<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($errors, 'Corrigez les champs indiqués', $prefix, $isRecovered).'</div>';
	print mjl_form_field('amount', 'Montant', '<input required name="amount" value="'.dol_escape_htmltag($values['amount'] ?? $row['amount']).'">', true, '', $errors['amount'] ?? '', $prefix);
	print mjl_form_field('expense_date', 'Date', '<input type="date" name="expense_date" value="'.dol_escape_htmltag($values['expense_date'] ?? substr((string) $row['expense_date'], 0, 10)).'">', false, '', $errors['expense_date'] ?? '', $prefix);
	print mjl_form_field('description', 'Description', '<input name="description" value="'.dol_escape_htmltag($values['description'] ?? $row['description']).'">', false, '', $errors['description'] ?? '', $prefix);
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Enregistrer la correction"><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']).'">Annuler</a></div>';
	print '</form></section>';
}

function mjl_expenses_render_decision_form($row, $action, $meta, $withCancel = false)
{
	$recovery = mjl_expenses_recovery_for_action($action);
	$values = $recovery['values'];
	$errors = $recovery['errors'];
	$isRecovered = !empty($recovery['recovered']);
	$prefix = 'mjl-expense-'.$action.'-';
	$consequence = mjl_expenses_decision_consequence($action);
	print '<form class="mjl-activity-action-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'" data-mjl-validate data-mjl-form="expense-decision"'.($withCancel ? ' data-mjl-substantive' : '').($isRecovered ? ' data-mjl-recovered="true"' : '');
	print '>';
	print mjl_expenses_token_input().'<input type="hidden" name="action" value="'.dol_escape_htmltag($action).'"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<input type="hidden" name="expected_status" value="'.((int) $row['status']).'">';
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($errors, 'Corrigez les champs indiqués', $prefix, $isRecovered).'</div>';
	if (!empty($meta['amount_field'])) {
		$field = (string) $meta['amount_field'];
		print mjl_form_field($field, $meta['amount_label'], '<input required name="'.dol_escape_htmltag($field).'" value="'.dol_escape_htmltag($values[$field] ?? (string) $meta['amount_default']).'">', true, '', $errors[$field] ?? '', $prefix);
	}
	if (!empty($meta['beneficiary'])) {
		print mjl_form_field('beneficiary_name', 'Bénéficiaire', '<input required name="beneficiary_name" value="'.dol_escape_htmltag($values['beneficiary_name'] ?? $row['beneficiary_name']).'">', true, '', $errors['beneficiary_name'] ?? '', $prefix);
		print mjl_form_field('disbursement_date', 'Date décaissement', '<input required type="date" name="disbursement_date" value="'.dol_escape_htmltag($values['disbursement_date'] ?? date('Y-m-d')).'">', true, '', $errors['disbursement_date'] ?? '', $prefix);
	}
	if (!empty($meta['comment'])) {
		if (in_array($action, array('reject', 'correct'), true)) {
			$control = '<textarea'.(!empty($meta['required']) ? ' required' : '').' name="comment">'.dol_escape_htmltag($values['comment'] ?? '').'</textarea>';
		} else {
			$control = '<input'.(!empty($meta['required']) ? ' required' : '').' name="comment" value="'.dol_escape_htmltag($values['comment'] ?? '').'">';
		}
		print mjl_form_field('comment', $meta['comment'], $control, !empty($meta['required']), '', $errors['comment'] ?? '', $prefix);
	}
	if ($consequence !== '') {
		print '<div class="mjl-decision-consequence" data-mjl-consequence><strong>Conséquence de cette décision</strong><p>'.dol_escape_htmltag($consequence).'</p></div>';
	}
	print '<div class="mjl-activity-form-actions"><button class="button" type="submit">'.dol_escape_htmltag($meta['label']).'</button>';
	if ($withCancel) print '<a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']).'">Annuler</a>';
	print '</div>';
	print '</form>';
}

function mjl_expenses_decision_consequence($action)
{
	if ($action === 'final_validate') return 'La validation définitive approuve la décision métier. Elle ne signifie pas que les fonds ont été décaissés.';
	if ($action === 'reject') return 'Le rejet interrompt le traitement et exige une correction motivée avant toute nouvelle soumission.';
	if ($action === 'disburse') return 'Le décaissement confirme que les fonds ont effectivement été versés.';
	return '';
}

function mjl_expenses_render_document_panel($row, $withUploadAction = true)
{
	$state = $row['evidence_state'] ?? ((int) $row['document_present'] > 0 ? 'downloadable' : 'missing');
	if (($GLOBALS['mjl_expense_document_state'] ?? '') === 'upload-failed' && mjl_expenses_can_apply_action($row, 'upload')) $state = 'upload-failed';
	$documents = mjl_expense_document_download_rows((int) $row['rowid']);
	$modelDocuments = array();
	foreach ($documents as $document) $modelDocuments[] = array(
		'label' => mjl_expense_document_display_filename($document),
		'url' => '/custom/mjlfinancement/documentdownload.php?id='.((int) $document['rowid']),
	);
	if (empty($modelDocuments) && $state === 'unavailable' && !empty($row['supporting_document_resolved'])) {
		$modelDocuments[] = array('label' => $row['supporting_document_resolved'], 'url' => '');
	}
	$stateLabels = array(
		'missing' => 'Manquante',
		'downloadable' => 'Disponible',
		'unavailable' => 'Indisponible',
		'upload-failed' => 'Échec de l ajout',
	);
	print mjl_journey_render_document_panel(array(
		'title' => 'Pièce justificative',
		'description' => 'La validation exige une pièce téléchargeable par le validateur.',
		'state' => $state,
		'state_label' => $stateLabels[$state] ?? mjl_expenses_evidence_label($state),
		'documents' => $modelDocuments,
		'link_label' => 'Télécharger la pièce',
	));
	if ($withUploadAction && mjl_expenses_can_apply_action($row, 'upload')) {
		print '<p><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']).'&amp;action=upload">Ajouter une pièce justificative</a></p>';
	}
}

function mjl_expenses_render_timeline($expense)
{
	$result = mjl_expenses_timeline_result($expense);
	$commentRecovery = mjl_expenses_recovery_for_action('add_exchange');
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Historique de décision et commentaires</h2><p>Soumissions, corrections, décisions et échanges contextualisés.</p></div>';
	mjl_timeline_render_comment_form('mjlfinancement_expense', (int) $expense['rowid'], DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $expense['rowid']), $commentRecovery);
	mjl_timeline_render($result, 'Aucun événement enregistré pour cette dépense.');
	print '</section>';
}

function mjl_expenses_options($type)
{
	global $db, $conf;

	if ($type === 'partner') {
		$sql = 'SELECT s.rowid, s.nom FROM '.$db->prefix().'societe s WHERE s.entity = '.((int) $conf->entity).' AND s.status = 1'.mjl_legacy_partner_dependent_sql_filter('s.rowid', $GLOBALS['user']).' ORDER BY s.nom, s.rowid';
	} elseif ($type === 'project') {
		$sql = 'SELECT p.rowid, p.ref, p.title FROM '.$db->prefix().'projet p WHERE p.entity = '.((int) $conf->entity).mjl_legacy_partner_dependent_sql_filter('p.fk_soc', $GLOBALS['user']).' ORDER BY p.ref';
	} elseif ($type === 'convention') {
		$sql = 'SELECT c.rowid, c.ref, c.title, p.ref AS project_ref FROM '.$db->prefix().'mjlfinancement_convention c';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
		$sql .= ' WHERE c.entity = '.((int) $conf->entity).' AND c.status = '.MjlConvention::STATUS_ACTIVE.' AND c.fk_project IS NOT NULL'.mjl_legacy_partner_dependent_sql_filter('c.fk_soc', $GLOBALS['user']).' ORDER BY c.ref';
	} elseif ($type === 'activity') {
		$sql = 'SELECT a.rowid, a.ref, a.label, p.ref AS project_ref FROM '.$db->prefix().'mjlfinancement_activity a';
		$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
		$sql .= ' WHERE a.entity = '.((int) $conf->entity).mjl_legacy_partner_dependent_sql_filter('c.fk_soc', $GLOBALS['user']).' ORDER BY p.ref, a.ref';
	} elseif ($type === 'budget_line') {
		$sql = 'SELECT bl.rowid, bl.ref, bl.label, p.ref AS project_ref, c.ref AS convention_ref FROM '.$db->prefix().'mjlfinancement_budget_line bl';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = bl.fk_project AND p.entity = bl.entity';
		$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity AND c.status = '.MjlConvention::STATUS_ACTIVE;
		$sql .= ' WHERE bl.entity = '.((int) $conf->entity).' AND bl.status = '.MjlBudgetLine::STATUS_ACTIVE.mjl_legacy_partner_dependent_sql_filter('c.fk_soc', $GLOBALS['user']).' ORDER BY p.ref, c.ref, bl.ref';
	} else {
		return array();
	}

	$resql = $db->query($sql);
	if (!$resql) {
		return array();
	}

	$options = array();
	while ($obj = $db->fetch_object($resql)) {
		if ($type === 'partner') {
			$label = $obj->nom;
		} elseif ($type === 'project') {
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

function mjl_expenses_can_use_links($fkProject, $fkConvention, $fkMjlActivity, $fkBudgetLine)
{
	global $db, $conf, $user;

	$fkProject = (int) $fkProject;
	$fkConvention = (int) $fkConvention;
	$fkMjlActivity = (int) $fkMjlActivity;
	$fkBudgetLine = (int) $fkBudgetLine;
	if ($fkProject <= 0 || $fkConvention <= 0 || $fkBudgetLine <= 0) {
		return false;
	}
	if (!mjl_legacy_partner_dependent_access($user, 'mjlfinancement_convention', $fkConvention) || !mjl_legacy_partner_dependent_access($user, 'project', $fkProject) || !mjl_legacy_partner_dependent_access($user, 'mjlfinancement_budget_line', $fkBudgetLine)) {
		return false;
	}
	if ($fkMjlActivity > 0 && !mjl_legacy_partner_dependent_access($user, 'mjlfinancement_activity', $fkMjlActivity)) {
		return false;
	}
	$probe = new stdClass();
	$probe->fk_project = $fkProject;
	$probe->fk_convention = $fkConvention;
	$probe->fk_mjl_activity = $fkMjlActivity;
	$probe->fk_budget_line = $fkBudgetLine;
	if (mjl_assert_expense_links($probe, (int) $conf->entity, true) < 0) {
		return false;
	}
	$sql = 'SELECT c.fk_soc FROM '.$db->prefix().'mjlfinancement_convention c WHERE c.rowid = '.$fkConvention.' AND c.entity = '.((int) $conf->entity);
	$resql = $db->query($sql);
	$row = $resql ? $db->fetch_object($resql) : null;
	return $row && mjl_legacy_partner_dependent_access($user, (int) $row->fk_soc);
}

function mjl_expenses_select($name, $options, $required = 0, $emptyLabel = '', $selected = 0)
{
	$html = '<select name="'.dol_escape_htmltag($name).'"'.($required ? ' required' : '').'>';
	if ($emptyLabel !== '') {
		$html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	}
	foreach ($options as $value => $label) {
		$html .= '<option value="'.((int) $value).'"'.((int) $selected === (int) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_expenses_fetch_detail($id)
{
	global $db, $conf;

	if ((int) $id <= 0) {
		return array();
	}
	$sql = 'SELECT e.rowid, e.entity, e.ref, e.fk_user_creat, e.expense_date, e.amount, e.prevalidated_amount, e.final_validated_amount, e.disbursed_amount, e.status, e.description, e.supporting_document, e.correction_reason, e.submitted_at, e.validation_date, e.prevalidation_date, e.final_validation_date, e.disbursement_date, e.beneficiary_name, e.date_creation,';
	$sql .= ' p.ref AS project_ref, p.title AS project_title, c.ref AS convention_ref, c.title AS convention_title, a.ref AS activity_ref, a.label AS activity_label,';
	$sql .= ' bl.ref AS budget_line_ref, bl.label AS budget_line_label, u.login AS creator_login, uv.login AS validator_login, up.login AS prevalidator_login, uf.login AS final_validator_login, ud.login AS disburser_login,';
	$sql .= ' '.mjl_expense_document_present_sql('e').' AS document_present, '.mjl_expense_supporting_document_sql('e').' AS supporting_document_resolved';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = e.fk_budget_line AND bl.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = e.fk_user_creat';
	$sql .= ' LEFT JOIN '.$db->prefix().'user uv ON uv.rowid = e.fk_user_valid';
	$sql .= ' LEFT JOIN '.$db->prefix().'user up ON up.rowid = e.fk_user_prevalidated';
	$sql .= ' LEFT JOIN '.$db->prefix().'user uf ON uf.rowid = e.fk_user_final_valid';
	$sql .= ' LEFT JOIN '.$db->prefix().'user ud ON ud.rowid = e.fk_user_disbursed';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity).' AND e.rowid = '.((int) $id);
	$resql = $db->query($sql);
	if (!$resql) {
		mjl_ui_log_error('database', array('route' => 'expenses', 'action' => 'detail', 'entity' => (int) $conf->entity, 'user_id' => (int) $GLOBALS['user']->id, 'object_type' => 'expense', 'object_id' => (int) $id), $db->lasterror());
		mjl_feedback_add('expenses:detail:'.((int) $id).':database', 'generic.database');
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
	if (!mjl_legacy_partner_dependent_access($user, 'mjlfinancement_expense', (int) $row['rowid'])) {
		return false;
	}
	if ($action === 'upload') {
		if (!mjl_workspace_can_apply_expense_write($user) || in_array($status, array(MjlExpense::STATUS_VALIDATED, MjlExpense::STATUS_FINAL_VALIDATED, MjlExpense::STATUS_DISBURSED), true)) return false;
		return !mjl_expenses_requires_own_scope($user) || (int) $row['fk_user_creat'] === (int) $user->id;
	}
	if (in_array($action, array('update', 'submit', 'correct'), true)) {
		if (!mjl_workspace_can_apply_expense_write($user)) return false;
		if (mjl_expenses_requires_own_scope($user) && (int) $row['fk_user_creat'] !== (int) $user->id) return false;
		if ($action === 'update') return $status === MjlExpense::STATUS_REJECTED;
		if ($action === 'submit') return in_array($status, array(MjlExpense::STATUS_DRAFT, MjlExpense::STATUS_CORRECTED), true);
		return $status === MjlExpense::STATUS_REJECTED;
	}
	if (in_array($action, array('validate', 'prevalidate', 'final_validate', 'disburse', 'reject'), true)) {
		if (!mjl_workspace_can_apply_expense_validation($user)) return false;
		if ((int) $row['fk_user_creat'] === (int) $user->id) return false;
		if (($action === 'validate' || $action === 'prevalidate') && (!mjl_scope_is_verifier($user) || $status !== MjlExpense::STATUS_SUBMITTED)) return false;
		if ($action === 'final_validate' && (!mjl_scope_is_final_validator($user) || $status !== MjlExpense::STATUS_PREVALIDATED)) return false;
		if ($action === 'disburse' && (!mjl_scope_is_final_validator($user) || !in_array($status, array(MjlExpense::STATUS_VALIDATED, MjlExpense::STATUS_FINAL_VALIDATED), true))) return false;
		if ($action === 'reject' && !in_array($status, array(MjlExpense::STATUS_SUBMITTED, MjlExpense::STATUS_PREVALIDATED), true)) return false;
		if (in_array($action, array('validate', 'prevalidate', 'final_validate'), true) && array_key_exists('evidence_state', $row) && $row['evidence_state'] !== 'downloadable') return false;
		if (in_array($action, array('validate', 'prevalidate', 'final_validate'), true) && !array_key_exists('evidence_state', $row) && array_key_exists('document_present', $row) && (int) $row['document_present'] <= 0) return false;
		return true;
	}
	return false;
}

function mjl_expenses_available_actions($row)
{
	$actions = array();
	if (mjl_expenses_can_apply_action($row, 'update')) $actions['update'] = array('label' => 'Modifier');
	if (mjl_expenses_can_apply_action($row, 'submit')) $actions['submit'] = array('label' => 'Soumettre la dépense', 'comment' => 'Commentaire de soumission', 'required' => false);
	if (mjl_expenses_can_apply_action($row, 'prevalidate')) $actions['prevalidate'] = array('label' => 'Prévalider la dépense', 'comment' => 'Commentaire de prévalidation', 'required' => false, 'amount_field' => 'prevalidated_amount', 'amount_label' => 'Montant prévalidé', 'amount_default' => $row['amount']);
	if (mjl_expenses_can_apply_action($row, 'final_validate')) $actions['final_validate'] = array('label' => 'Valider définitivement la dépense', 'comment' => 'Commentaire de validation définitive', 'required' => false, 'amount_field' => 'final_validated_amount', 'amount_label' => 'Montant validé définitivement', 'amount_default' => $row['prevalidated_amount'] ?: $row['amount']);
	if (mjl_expenses_can_apply_action($row, 'disburse')) $actions['disburse'] = array('label' => 'Enregistrer le décaissement', 'beneficiary' => true);
	if (mjl_expenses_can_apply_action($row, 'reject')) $actions['reject'] = array('label' => 'Rejeter la dépense', 'comment' => 'Motif de rejet', 'required' => true);
	if (mjl_expenses_can_apply_action($row, 'correct')) $actions['correct'] = array('label' => 'Marquer corrigee', 'comment' => 'Motif de correction', 'required' => true);
	return $actions;
}

function mjl_expenses_guarded_review_actions()
{
	return array('prevalidate', 'final_validate', 'disburse', 'reject');
}

function mjl_expenses_timeline_items($expense)
{
	$result = mjl_expenses_timeline_result($expense);
	return $result['items'];
}

function mjl_expenses_timeline_result($expense)
{
	global $db, $conf;

	$creation = array('source' => 'creation', 'order' => 0, 'errors' => array(), 'items' => array(array(
		'rowid' => 0,
		'label' => 'Créée',
		'title' => 'Dépense créée',
		'meta' => mjl_expenses_format_datetime($expense['date_creation'] ?? '').' par '.$expense['creator_login'],
		'comment' => '',
		'changes' => array(),
		'sort_date' => (string) ($expense['date_creation'] ?? ''),
	)));
	$sql = 'SELECT v.rowid, v.action, v.from_status, v.to_status, v.action_date, v.comment, v.actor_role, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
	$sql .= ' WHERE v.entity = '.((int) $conf->entity).' AND v.fk_expense = '.((int) $expense['rowid']);
	$sql .= ' ORDER BY v.action_date ASC, v.rowid ASC';
	$resql = $db->query($sql);
	$validations = array('source' => 'validation', 'order' => 10, 'items' => array(), 'errors' => array());
	$documents = array('source' => 'documents', 'order' => 20, 'items' => array(), 'errors' => array());
	if (!$resql) {
		$validations['errors'][] = 'database';
		$documents['errors'][] = 'database';
		mjl_ui_log_error('database', array('route' => 'expenses', 'action' => 'timeline_validation', 'entity' => (int) $conf->entity, 'object_type' => 'expense', 'object_id' => (int) $expense['rowid']), $db->lasterror());
	} else {
		while ($row = $db->fetch_object($resql)) {
			$item = array(
				'rowid' => (int) $row->rowid,
				'label' => mjl_expense_action_label($row->action),
				'title' => mjl_expense_status_text($row->from_status).' vers '.mjl_expense_status_text($row->to_status),
				'meta' => mjl_expenses_format_datetime($row->action_date).' par '.($row->login ?: 'système').' ('.mjl_expense_actor_role_label($row->actor_role, $row->action).')',
				'comment' => (string) $row->comment,
				'changes' => array(),
				'sort_date' => (string) $row->action_date,
			);
			if ((string) $row->action === 'document_uploaded') $documents['items'][] = $item;
			else $validations['items'][] = $item;
		}
	}
	$comments = mjl_timeline_exchange_result('mjlfinancement_expense', (int) $expense['rowid'], true);
	return mjl_timeline_aggregate_sources(array($creation, $validations, $documents, $comments), true);
}

function mjl_expenses_next_action_label($row)
{
	$status = (int) $row['status'];
	$evidenceState = $row['evidence_state'] ?? '';
	$docPresent = ($evidenceState === 'downloadable') || ($evidenceState === '' && (!array_key_exists('document_present', $row) || (int) $row['document_present'] > 0));
	$docUnavailable = $evidenceState === 'unavailable';
	if ($docUnavailable && in_array($status, array(MjlExpense::STATUS_DRAFT, MjlExpense::STATUS_SUBMITTED, MjlExpense::STATUS_CORRECTED), true)) {
		return 'Remplacer la pièce indisponible avant validation.';
	}
	if ($status === MjlExpense::STATUS_DRAFT) return $docPresent ? 'Compléter puis soumettre la dépense.' : 'Ajouter la pièce justificative puis soumettre la dépense.';
	if ($status === MjlExpense::STATUS_SUBMITTED) return $docPresent ? 'Prévalidation attendue.' : 'Validation bloquée tant que la pièce justificative manque.';
	if ($status === MjlExpense::STATUS_CORRECTED) return 'Dépense corrigée à resoumettre.';
	if ($status === MjlExpense::STATUS_PREVALIDATED) return 'Validation définitive attendue.';
	if ($status === MjlExpense::STATUS_VALIDATED || $status === MjlExpense::STATUS_FINAL_VALIDATED) return 'Décaissement à enregistrer lorsque les fonds sont effectivement payés.';
	if ($status === MjlExpense::STATUS_DISBURSED) return 'Dépense décaissée, aucune décision en attente.';
	if ($status === MjlExpense::STATUS_REJECTED) return 'Correction attendue avant resoumission.';
	return 'Suivre l’avancement de la dépense.';
}

function mjl_expenses_evidence_label($state)
{
	if ($state === 'downloadable') return 'Pièce disponible';
	if ($state === 'unavailable') return 'Pièce référencée indisponible';
	return 'Pièce manquante';
}

function mjl_expenses_status_label($status)
{
	return mjl_expense_status_text($status);
}

function mjl_expense_status_text($status)
{
	return mjl_ui_expense_status($status)['label'];
}

function mjl_expense_action_label($action)
{
	return mjl_timeline_presentation_action_label('mjlfinancement_expense', $action);
}

function mjl_expenses_status_badge($status)
{
	return mjl_ui_status_badge(mjl_ui_expense_status($status));
}

function mjl_expenses_money_or_empty($value)
{
	return mjl_format_money($value);
}

function mjl_expense_actor_role_label($role, $action = '')
{
	return mjl_timeline_presentation_actor_role_label('mjlfinancement_expense', $action, $role);
}

function mjl_expenses_format_date($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return mjl_format_date($value, 'date');
}

function mjl_expenses_format_datetime($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return mjl_format_date($value, 'datetime');
}

function mjl_expenses_token_input()
{
	global $mjl_expenses_page_token;
	return '<input type="hidden" name="token" value="'.dol_escape_htmltag($mjl_expenses_page_token).'">';
}

function mjl_expenses_recovery_for_action($action)
{
	global $mjl_expense_recovery;
	$config = mjl_expense_recovery_config($action);
	if ($config === null || !is_array($mjl_expense_recovery)
		|| (string) ($mjl_expense_recovery['context']['form'] ?? '') !== (string) $config['form']
		|| (string) ($mjl_expense_recovery['context']['action'] ?? '') !== (string) $action) {
		return array('values' => array(), 'errors' => array(), 'recovered' => false);
	}
	return array('values' => (array) ($mjl_expense_recovery['values'] ?? array()), 'errors' => (array) ($mjl_expense_recovery['errors'] ?? array()), 'recovered' => true);
}

function mjl_expenses_store_recovery_config($action, $objectId, $errors)
{
	global $conf, $user;
	$config = mjl_expense_recovery_config($action);
	if ($config === null) return '';
	$reason = '';
	$handle = mjl_form_recovery_store(array(
		'user_id' => (int) $user->id,
		'entity' => (int) $conf->entity,
		'route' => 'expenses',
		'form' => (string) $config['form'],
		'action' => (string) $action,
		'object_id' => (int) $objectId,
	), $_POST, $config['fields'], $reason, (array) $errors);
	if ($handle === '' && $reason === 'capacity') mjl_feedback_add('expenses:recovery:'.((int) $objectId).':capacity', 'generic.recovery_unavailable');
	return $handle;
}
