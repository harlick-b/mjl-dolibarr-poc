<?php

define('NOCSRFCHECK', 1);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document_audit_persistence.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_table.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_journey.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_finance_feedback.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_finance_recovery.lib.php';

mjl_workspace_require_reference_data_access($user, 'convention');

$action = GETPOST('action', 'aZ09');
$conventionId = GETPOSTINT('id');
$presentationAction = $_SERVER['REQUEST_METHOD'] === 'GET' && in_array($action, array('create', 'edit', 'activate', 'close', 'delete', 'upload'), true) ? $action : '';
$presentationConvention = array();
$presentationLinked = array();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		mjl_conventions_forbidden('Jeton de sécurité invalide');
	}
	if ($action !== 'add_exchange' && !mjl_conventions_can_manage()) {
		mjl_conventions_forbidden();
	}
	mjl_conventions_handle_post($action);
}

$mjl_convention_document_state = GETPOST('mjl_document_state', 'alphanohtml');
if ($presentationAction === 'create') {
	if ($conventionId !== 0 || !mjl_conventions_can_manage()) mjl_conventions_forbidden();
	$mjl_convention_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'conventions', 'object_id' => 0),
		array('create' => array('create'))
	);
} elseif ($presentationAction !== '') {
	$presentationConvention = mjl_conventions_fetch_detail($conventionId);
	if (empty($presentationConvention)) mjl_conventions_forbidden('Enveloppe introuvable ou hors de votre périmètre');
	$presentationLinked = mjl_conventions_link_counts($conventionId);
	$hasLinks = array_sum($presentationLinked) > 0;
	if (!mjl_conventions_can_present_action($presentationConvention, $presentationAction, $hasLinks)) mjl_conventions_forbidden();
	if (in_array($presentationAction, array('delete', 'upload'), true)) {
		$mjl_convention_recovery = array();
	} else {
		$postAction = $presentationAction === 'edit' ? 'update' : $presentationAction;
		$config = mjl_finance_recovery_config('conventions', $postAction);
		$mjl_convention_recovery = mjl_form_recovery_consume_route(
			GETPOST('mjl_recovery', 'alphanohtml'),
			array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'conventions', 'object_id' => $conventionId),
			array((string) $config['form'] => array($postAction))
		);
	}
} else {
	$mjl_convention_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'conventions', 'object_id' => $conventionId),
		array('comment' => array('add_exchange'))
	);
}

llxHeader('', 'Enveloppes de financement MJL');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace mjl-convention-workspace">';

if ($presentationAction === 'create') {
	mjl_conventions_render_create_state();
} elseif ($presentationAction !== '') {
	mjl_conventions_render_presentation_state($presentationConvention, $presentationLinked, $presentationAction);
} elseif ($conventionId > 0) {
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
	mjl_conventions_forbidden('Les modifications d’enveloppes sont temporairement indisponibles.');

	if ($action === 'create') {
		$convention = new MjlConvention($db);
		$convention->entity = (int) $conf->entity;
		$convention->ref = GETPOST('ref', 'alphanohtml');
		$convention->title = GETPOST('title', 'restricthtml');
		$convention->fk_soc = GETPOSTINT('fk_soc');
		$convention->fk_project = GETPOSTINT('fk_project');
		if (!mjl_conventions_can_use_supplied_links((int) $convention->fk_soc, (int) $convention->fk_project)) {
			mjl_conventions_forbidden('Partenaire ou projet hors de votre périmètre');
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
			$feedback = mjl_finance_feedback_domain('conventions', 'create', 0, $convention->error);
			mjl_feedback_add('conventions:create:error', 'generic.validation');
			mjl_conventions_redirect(0, mjl_conventions_store_recovery('create', 0, $feedback), 'create');
		}
		mjl_feedback_add('conventions:create:'.((int) $result), 'convention.created');
		mjl_conventions_redirect((int) $result);
	}

	$id = GETPOSTINT('id');
	$convention = new MjlConvention($db);
	if ($id <= 0 || $convention->fetch($id) <= 0 || (int) $convention->entity !== (int) $conf->entity) {
		mjl_conventions_forbidden('Enveloppe introuvable ou hors de votre périmètre');
	}
	if ($action === 'add_exchange') {
		list($result, $message) = mjl_timeline_create_comment($user, 'mjlfinancement_convention', $id, GETPOST('message', 'restricthtml'));
		mjl_feedback_add('conventions:add_exchange:'.$id.($result > 0 ? '' : ':error'), $result > 0 ? 'generic.saved' : 'generic.validation');
		mjl_conventions_redirect($id, $result > 0 ? '' : mjl_conventions_store_recovery('add_exchange', $id, $message));
	}

	if ($action === 'update') {
		$failureAction = 'update';
		if (!mjl_conventions_can_use_supplied_links(GETPOSTINT('fk_soc'), GETPOSTINT('fk_project'))) {
			mjl_conventions_forbidden('Partenaire ou projet hors de votre périmètre');
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
		$failureAction = 'activate';
		$result = $convention->activate($user, GETPOST('comment', 'restricthtml'));
	} elseif ($action === 'close') {
		$failureAction = 'close';
		$result = $convention->close($user, GETPOST('comment', 'restricthtml'));
	} elseif ($action === 'delete') {
		$failureAction = 'delete';
		$result = $convention->deleteIfUnlinkedDraft($user);
	} elseif ($action === 'upload') {
		$failureAction = 'upload';
		$result = mjl_conventions_upload_document($convention);
	} else {
		mjl_conventions_redirect($id);
	}

	if ($result < 0) {
		$feedback = mjl_finance_feedback_domain('conventions', $failureAction, $id, $convention->error);
		mjl_feedback_add('conventions:'.$failureAction.':'.$id.':error', 'generic.validation');
		if ($failureAction === 'upload') mjl_conventions_redirect($id, '', 'upload', 'upload-failed');
		if ($failureAction === 'delete') mjl_conventions_redirect($id);
		$recoveryHandle = mjl_conventions_store_recovery($failureAction, $id, $feedback);
		$recoveryState = $failureAction === 'update' ? 'edit' : $failureAction;
		mjl_conventions_redirect($id, $recoveryHandle, $recoveryState);
	} elseif ($result === 0) {
		mjl_feedback_add('conventions:'.$failureAction.':'.$id.':unchanged', 'generic.no_change');
	} else {
		mjl_feedback_add('conventions:'.$failureAction.':'.$id, 'convention.saved');
	}
	mjl_conventions_redirect($action === 'delete' && $result > 0 ? 0 : $id);
}

function mjl_conventions_render_list_page()
{
	$partnerOptions = mjl_conventions_options('ptf');
	$projectOptions = mjl_conventions_options('project');
	$filters = mjl_table_normalize_generic(array(
		'partner_id' => GETPOST('partner_id', 'alphanohtml'),
		'project_id' => GETPOST('project_id', 'alphanohtml'),
		'status' => GETPOST('status', 'alphanohtml'),
		'sort' => GETPOST('sort', 'alphanohtml'),
		'page' => GETPOST('page', 'alphanohtml'),
	), array(
		'partner_id' => array('type' => 'id', 'allowed' => array_keys($partnerOptions), 'default' => 0),
		'project_id' => array('type' => 'id', 'allowed' => array_keys($projectOptions), 'default' => 0),
		'status' => array('type' => 'enum', 'allowed' => array('0', '1', '2'), 'default' => ''),
		'sort' => array('type' => 'enum', 'allowed' => array('recent', 'ref', 'amount'), 'default' => 'recent'),
		'page' => array('type' => 'page', 'default' => 1),
	), 50);
	if (!$filters['fail_closed'] && $filters['partner_id'] > 0 && $filters['project_id'] > 0 && !mjl_conventions_can_use_partner_project($filters['partner_id'], $filters['project_id'])) {
		$filters['fail_closed'] = true;
		$filters['page'] = 1;
	}
	$headerOptions = array(
			'description' => 'Pilotez les enveloppes avant les lignes budgétaires, dépenses et rapports.',
			'context' => array('label' => 'Périmètre', 'value' => mjl_conventions_can_manage() ? 'Administration / validation définitive' : 'Consultation'),
		);
	if (mjl_conventions_can_manage()) $headerOptions['primary_action'] = array('label' => 'Créer une enveloppe', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?action=create');
	print mjl_page_header_render('Gestion des enveloppes de financement', $headerOptions);
	mjl_conventions_render_list_filters($filters, $partnerOptions, $projectOptions);
	mjl_conventions_render_list($filters);
}

function mjl_conventions_render_detail($id)
{
	$row = mjl_conventions_fetch_detail($id);
	if (empty($row)) {
		mjl_conventions_forbidden('Enveloppe introuvable ou hors de votre périmètre');
	}
	$linked = mjl_conventions_link_counts($id);
	$hasLinks = array_sum($linked) > 0;
	$canManage = mjl_conventions_can_manage();

	$headerOptions = array(
			'breadcrumb' => array(
				array('label' => 'Enveloppes de financement', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php'),
				array('label' => $row['ref']),
			),
			'description' => mjl_conventions_next_action_label($row, $hasLinks),
			'context' => array('label' => 'Statut', 'value' => mjl_convention_status_label($row['status'])),
		);
	if ($canManage) $headerOptions['primary_action'] = array('label' => 'Modifier l’enveloppe', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'&action=edit');
	print mjl_page_header_render($row['ref'].' - '.$row['title'], $headerOptions);

	mjl_conventions_render_summary($row, $linked);
	mjl_conventions_render_actions($row, $hasLinks, $canManage);
	mjl_conventions_render_document_panel($row, $canManage);
	mjl_conventions_render_timeline($row);
}

function mjl_conventions_render_create_state()
{
	print mjl_page_header_render('Créer une enveloppe', array(
		'breadcrumb' => array(
			array('label' => 'Enveloppes de financement', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php'),
			array('label' => 'Créer'),
		),
		'description' => 'Créez un brouillon avant son activation et son utilisation par les opérations.',
	));
	mjl_conventions_render_create_form();
}

function mjl_conventions_render_presentation_state($row, $linked, $action)
{
	$hasLinks = array_sum($linked) > 0;
	$titles = array(
		'edit' => 'Modifier l’enveloppe '.$row['ref'],
		'activate' => 'Activer l’enveloppe '.$row['ref'],
		'close' => 'Clôturer l’enveloppe '.$row['ref'],
		'delete' => 'Supprimer l’enveloppe '.$row['ref'],
		'upload' => 'Ajouter un document à l’enveloppe '.$row['ref'],
	);
	$title = $titles[$action];
	print mjl_page_header_render($title, array(
		'breadcrumb' => array(
			array('label' => 'Enveloppes de financement', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php'),
			array('label' => $row['ref'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid'])),
			array('label' => $title),
		),
		'description' => $action === 'delete' ? 'Confirmez uniquement si ce brouillon doit être supprimé définitivement.' : 'Vérifiez le contexte et les conséquences avant de poursuivre.',
		'context' => array('label' => 'Statut actuel', 'value' => mjl_convention_status_label($row['status'])),
	));
	mjl_conventions_render_summary($row, $linked);
	if ($action === 'edit') {
		mjl_conventions_render_edit_form($row, $hasLinks);
	} elseif ($action === 'upload') {
		mjl_conventions_render_document_panel($row, false);
		mjl_conventions_render_upload_form($row);
	} elseif ($action === 'delete') {
		mjl_conventions_render_delete_state($row);
	} else {
		mjl_conventions_render_decision_state($row, $action);
	}
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
	$document = mjl_document_upload_to_ecm('mjlfinancement_convention', $conventionId, (int) $convention->entity, 'supporting_document', 'mjlfinancement_convention', 'MJL-CONV', 'Document enveloppe MJL', $error);
	if (empty($document)) {
		$db->rollback();
		$convention->error = $error;
		return -1;
	}
	$statusLabel = mjl_document_audit_status_label('mjlfinancement_convention', $convention->status);
	$comment = 'Document ajoute: '.$document['original'];
	$audit = mjl_workflow_audit_insert('mjlfinancement_convention', $conventionId, (int) $convention->entity, $statusLabel, $user, !empty($user->admin) ? 'ADMIN_PLATEFORME' : 'VALIDATEUR_DEFINITIF', 'document_uploaded', $comment, array(
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
	$values = mjl_finance_recovery_values($GLOBALS['mjl_convention_recovery'] ?? null, 'create');
	$isRecovered = !empty($GLOBALS['mjl_convention_recovery']['recovered']);
	print '<section class="mjl-workspace-section mjl-activity-panel">';
	print '<div class="mjl-section-heading"><h2>Nouvelle enveloppe</h2><p>Créer un brouillon avant activation et utilisation par les operations.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php" data-mjl-validate data-mjl-form="convention-create" data-mjl-substantive'.($isRecovered ? ' data-mjl-recovered="true"' : '').'>';
	print '<input type="hidden" name="action" value="create"><input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'">';
	mjl_conventions_render_fields($values, $ptfs, $projects, false, 'create');
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Créer l’enveloppe"><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php">Annuler</a></div>';
	print '</form></section>';
}

function mjl_conventions_render_edit_form($row, $hasLinks)
{
	$recovery = $GLOBALS['mjl_convention_recovery'] ?? null;
	$row = array_merge($row, mjl_finance_recovery_values($recovery, 'edit'));
	$errors = is_array($recovery) && (string) ($recovery['context']['form'] ?? '') === 'edit' ? (array) ($recovery['errors'] ?? array()) : array();
	$isRecovered = !empty($recovery['recovered']);
	$ptfs = mjl_conventions_options('ptf');
	$projects = mjl_conventions_options('project');
	print '<section class="mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Paramètres de l’enveloppe</h2><p>'.($hasLinks ? 'Les champs financiers structurants sont verrouillés car des objets sont liés.' : 'Modifier les données avant rattachement opérationnel.').'</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'" data-mjl-validate data-mjl-form="convention-edit" data-mjl-substantive'.($isRecovered ? ' data-mjl-recovered="true"' : '').'>';
	print '<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row['rowid']).'"><input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'">';
	mjl_conventions_render_fields($row, $ptfs, $projects, $hasLinks, 'edit');
	print mjl_form_field('comment', 'Motif de modification', '<input required name="comment" value="'.dol_escape_htmltag($row['comment'] ?? '').'">', true, '', $errors['comment'] ?? '', 'mjl-convention-edit-');
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Enregistrer"><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'">Annuler</a></div>';
	print '</form></section>';
}

function mjl_conventions_render_fields($row, $ptfs, $projects, $locked, $form)
{
	$disabled = $locked ? ' disabled' : '';
	$hiddenLocked = array('ref', 'fk_soc', 'fk_project', 'total_amount', 'currency_code');
	$recovery = $GLOBALS['mjl_convention_recovery'] ?? null;
	$errors = is_array($recovery) && (string) ($recovery['context']['form'] ?? '') === $form ? (array) ($recovery['errors'] ?? array()) : array();
	$prefix = 'mjl-convention-'.$form.'-';
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($errors, 'Corrigez les champs indiqués', $prefix).'</div>';
	print mjl_form_field('ref', 'Référence', '<input required name="ref" value="'.dol_escape_htmltag($row['ref'] ?? '').'"'.$disabled.'>', true, '', $errors['ref'] ?? '', $prefix);
	print mjl_form_field('title', 'Intitulé', '<input required name="title" value="'.dol_escape_htmltag($row['title'] ?? '').'">', true, '', $errors['title'] ?? '', $prefix);
	print mjl_form_field('fk_soc', 'Partenaire / Programme', mjl_conventions_select('fk_soc', $ptfs, (int) ($row['fk_soc'] ?? 0), true, $locked), true, '', $errors['fk_soc'] ?? '', $prefix);
	print mjl_form_field('fk_project', 'Projet', mjl_conventions_select('fk_project', $projects, (int) ($row['fk_project'] ?? 0), false, $locked), false, '', $errors['fk_project'] ?? '', $prefix);
	print mjl_form_field('date_start', 'Début', '<input type="date" name="date_start" value="'.dol_escape_htmltag(mjl_conventions_date_value($row['date_start'] ?? '')).'">', false, '', $errors['date_start'] ?? '', $prefix);
	print mjl_form_field('date_end', 'Fin', '<input type="date" name="date_end" value="'.dol_escape_htmltag(mjl_conventions_date_value($row['date_end'] ?? '')).'">', false, '', $errors['date_end'] ?? '', $prefix);
	print mjl_form_field('total_amount', 'Montant total', '<input name="total_amount" value="'.dol_escape_htmltag($row['total_amount'] ?? '').'"'.$disabled.'>', false, '', $errors['total_amount'] ?? '', $prefix);
	print mjl_form_field('currency_code', 'Devise', '<input required maxlength="3" name="currency_code" value="'.dol_escape_htmltag($row['currency_code'] ?? 'XOF').'"'.$disabled.'>', true, '', $errors['currency_code'] ?? '', $prefix);
	print mjl_form_field('note_public', 'Note publique', '<textarea name="note_public">'.dol_escape_htmltag($row['note_public'] ?? '').'</textarea>', false, '', $errors['note_public'] ?? '', $prefix);
	print mjl_form_field('note_private', 'Note privée', '<textarea name="note_private">'.dol_escape_htmltag($row['note_private'] ?? '').'</textarea>', false, '', $errors['note_private'] ?? '', $prefix);
	if ($locked) {
		foreach ($hiddenLocked as $field) {
			print '<input type="hidden" name="'.$field.'" value="'.dol_escape_htmltag((string) ($row[$field] ?? '')).'">';
		}
	}
}

function mjl_conventions_render_list_filters($filters, $partnerOptions, $projectOptions)
{
	print '<section class="mjl-workspace-section"><div class="mjl-section-heading"><h2>Filtres</h2><p>Limiter les enveloppes par partenaire, projet ou statut.</p></div>';
	print '<form class="mjl-table-filters" method="GET" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php">';
	print '<label>Partenaire / Programme'.mjl_conventions_select('partner_id', $partnerOptions, $filters['partner_id'], false, false).'</label>';
	print '<label>Projet'.mjl_conventions_select('project_id', $projectOptions, $filters['project_id'], false, false).'</label>';
	print '<label>Statut<select name="status"><option value="">Tous</option>';
	foreach (array(0, 1, 2) as $status) print '<option value="'.$status.'"'.((string) $filters['status'] === (string) $status ? ' selected' : '').'>'.dol_escape_htmltag(mjl_convention_status_label($status)).'</option>';
	print '</select></label><label>Trier par<select name="sort"><option value="recent"'.($filters['sort'] === 'recent' ? ' selected' : '').'>Plus récentes</option><option value="ref"'.($filters['sort'] === 'ref' ? ' selected' : '').'>Référence</option><option value="amount"'.($filters['sort'] === 'amount' ? ' selected' : '').'>Montant décroissant</option></select></label>';
	print '<button class="button" type="submit">Afficher</button></form></section>';
}

function mjl_conventions_render_list($filters)
{
	global $db, $conf;
	$from = ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$from .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
	$from .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = c.entity';
	$where = ' WHERE c.entity = '.((int) $conf->entity).' AND 1=0';
	if (!empty($filters['fail_closed'])) $where .= ' AND 1 = 0';
	if ((int) $filters['partner_id'] > 0) $where .= ' AND c.fk_soc = '.((int) $filters['partner_id']);
	if ((int) $filters['project_id'] > 0) $where .= ' AND c.fk_project = '.((int) $filters['project_id']);
	if ($filters['status'] !== '') $where .= ' AND c.status = '.((int) $filters['status']);
	$total = mjl_table_count_or_null($db, 'SELECT COUNT(*) AS nb'.$from.$where);
	$sql = 'SELECT c.rowid, c.ref, c.title, c.total_amount, c.currency_code, c.status, p.ref AS project_ref, s.nom AS ptf_name,';
	$sql .= ' (SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = c.entity AND bl.fk_convention = c.rowid) AS budget_lines,';
	$sql .= ' (SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid) AS expenses';
	$sql .= $from.$where;
	if ($filters['sort'] === 'ref') $sql .= ' ORDER BY c.ref ASC, c.rowid ASC';
	elseif ($filters['sort'] === 'amount') $sql .= ' ORDER BY c.total_amount DESC, c.rowid DESC';
	else $sql .= ' ORDER BY c.rowid DESC';
	$sql .= ' LIMIT '.(((int) $filters['page_size']) + 1).' OFFSET '.(((int) $filters['page'] - 1) * (int) $filters['page_size']);
	$query = mjl_finance_source_query($db, $sql, 'conventions', 'list', 0);
	$resql = $query['result'];
	print '<section class="mjl-workspace-section"><div class="mjl-section-heading"><h2>Portefeuille des enveloppes</h2><p>Les enveloppes cloturees restent visibles pour les rapports et l historique.</p></div>';
	if (!$resql) {
		print '<div class="mjl-empty-state mjl-empty-state-warning">'.dol_escape_htmltag(mjl_finance_feedback_source_message('conventions', 'list', $query['feedback'])).'</div></section>';
		return;
	}
	print '<div class="div-table-responsive-no-min mjl-dashboard-table"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Enveloppe</th><th>Partenaire / Programme</th><th>Projet</th><th class="right">Montant</th><th>Statut</th><th>Liens</th><th>Actions</th></tr>';
	$rows = array();
	while ($obj = $db->fetch_object($resql)) $rows[] = $obj;
	$hasNext = count($rows) > (int) $filters['page_size'];
	if ($hasNext) array_pop($rows);
	$count = 0;
	foreach ($rows as $obj) {
		$count++;
		print '<tr class="oddeven">';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $obj->rowid).'">'.dol_escape_htmltag($obj->ref).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($obj->title).'</span></td>';
		print '<td>'.dol_escape_htmltag($obj->ptf_name).'</td>';
		print '<td>'.dol_escape_htmltag($obj->project_ref).'</td>';
		print '<td class="right">'.dol_escape_htmltag(mjl_format_money($obj->total_amount, $obj->currency_code)).'</td>';
		print '<td>'.mjl_conventions_status_badge($obj->status).'</td>';
		print '<td>'.((int) $obj->budget_lines).' ligne(s), '.((int) $obj->expenses).' dépense(s)</td>';
		$actions = array();
		if (mjl_conventions_can_manage()) {
			$actions[] = array('label' => 'Modifier l’enveloppe', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $obj->rowid).'&action=edit');
			if ((int) $obj->status !== MjlConvention::STATUS_CLOSED) $actions[] = array('label' => 'Ajouter un document', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $obj->rowid).'&action=upload');
		}
		print '<td>'.mjl_table_render_action_menu($obj->ref, $actions).'</td>';
		print '</tr>';
	}
	if ($count === 0) {
		print '<tr class="oddeven"><td colspan="7">Aucune enveloppe dans votre périmètre.</td></tr>';
	}
	print '</table></div>';
	print mjl_table_render_pagination(DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php', $filters, $total, (int) $filters['page'] > 1, $hasNext, 'enveloppes');
	print '</section>';
}

function mjl_conventions_render_summary($row, $linked)
{
	$tone = (int) $row['status'] === MjlConvention::STATUS_CLOSED ? 'danger' : ((int) $row['status'] === MjlConvention::STATUS_ACTIVE ? 'success' : 'warning');
	print mjl_journey_render_summary(array(
		'title' => 'Synthèse enveloppe',
		'description' => 'Controle du financement et des rattachements operationnels.',
		'items' => array(
			array('label' => 'Statut', 'value' => mjl_convention_status_label($row['status']), 'tone' => $tone),
			array('label' => 'Partenaire / Programme', 'value' => $row['ptf_name']),
			array('label' => 'Projet', 'value' => trim($row['project_ref'].' - '.$row['project_title'], ' -')),
			array('label' => 'Periode', 'value' => mjl_conventions_format_date($row['date_start']).' - '.mjl_conventions_format_date($row['date_end'])),
			array('label' => 'Montant', 'value' => mjl_format_money($row['total_amount'], $row['currency_code'])),
			array('label' => 'Activités', 'value' => (int) $linked['activities']),
			array('label' => 'Lignes budgétaires', 'value' => (int) $linked['budget_lines']),
			array('label' => 'Fonds recus', 'value' => (int) $linked['fund_receipts']),
			array('label' => 'Dépenses', 'value' => (int) $linked['expenses']),
		),
	));
}

function mjl_conventions_render_actions($row, $hasLinks, $canManage)
{
	if (!$canManage) return;
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Cycle de vie</h2><p>Activation, cloture ou suppression selon les regles de gouvernance.</p></div>';
	$base = DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'&amp;action=';
	if ((int) $row['status'] === MjlConvention::STATUS_DRAFT) {
		print '<a class="mjl-action mjl-action-secondary" href="'.$base.'activate">Activer l’enveloppe</a>';
		if (!$hasLinks) {
			print '<a class="mjl-action mjl-action-secondary" href="'.$base.'delete">Supprimer l’enveloppe</a>';
		}
	} elseif ((int) $row['status'] === MjlConvention::STATUS_ACTIVE) {
		print '<a class="mjl-action mjl-action-secondary" href="'.$base.'close">Clôturer l’enveloppe</a>';
	} else {
		print '<div class="mjl-empty-state">Enveloppe clôturée : aucune nouvelle opération ne peut y être rattachée.</div>';
	}
	print '</section>';
}

function mjl_conventions_render_document_panel($row, $withUploadAction = true)
{
	$state = mjl_convention_evidence_state((int) $row['rowid'], (int) $row['entity']);
	if (($GLOBALS['mjl_convention_document_state'] ?? '') === 'upload-failed' && mjl_conventions_can_upload_document($row)) $state = 'upload-failed';
	$documents = mjl_convention_document_download_rows((int) $row['rowid']);
	$modelDocuments = array();
	foreach ($documents as $document) $modelDocuments[] = array('label' => mjl_convention_document_display_filename($document), 'url' => '/custom/mjlfinancement/documentdownload.php?type=convention&id='.((int) $document['rowid']));
	print mjl_journey_render_document_panel(array(
		'title' => 'Documents enveloppe',
		'description' => 'Pièces contractuelles et annexes conservees par les routes MJL.',
		'state' => $state,
		'state_label' => mjl_conventions_evidence_label($state),
		'documents' => $modelDocuments,
	));
	if ($withUploadAction && mjl_conventions_can_upload_document($row)) {
		print '<p><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'&amp;action=upload">Ajouter un document</a></p>';
	}
}

function mjl_conventions_render_upload_form($row)
{
	print '<section class="mjl-workspace-section mjl-activity-card"><div class="mjl-section-heading"><h2>Document à ajouter</h2><p>Le fichier sera conservé derrière la route de téléchargement MJL gardée.</p></div>';
	print '<form class="mjl-activity-form" method="POST" enctype="multipart/form-data" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'" data-mjl-form="convention-upload" data-mjl-substantive>';
	print '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="action" value="upload"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<label>Document enveloppe<input required type="file" name="supporting_document"></label>';
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Ajouter le document"><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'">Annuler</a></div>';
	print '</form></section>';
}

function mjl_conventions_render_decision_state($row, $action)
{
	$meta = array(
		'activate' => array('label' => 'Activer l’enveloppe', 'comment' => 'Commentaire d’activation', 'required' => false),
		'close' => array('label' => 'Clôturer l’enveloppe', 'comment' => 'Motif de clôture', 'required' => true),
	);
	if (!isset($meta[$action])) mjl_conventions_forbidden();
	print '<section class="mjl-workspace-section mjl-activity-card mjl-activity-decision"><div class="mjl-section-heading"><h2>'.dol_escape_htmltag($meta[$action]['label']).'</h2><p>Cette décision sera inscrite dans l’historique de gouvernance.</p></div>';
	mjl_conventions_action_form($row['rowid'], $action, $meta[$action]['label'], $meta[$action]['comment'], $meta[$action]['required'], true);
	print '</section>';
}

function mjl_conventions_render_delete_state($row)
{
	print '<section class="mjl-workspace-section mjl-activity-card mjl-activity-decision"><div class="mjl-section-heading"><h2>Confirmer la suppression</h2><p>Cette suppression est irréversible. Elle n’est autorisée que pour un brouillon sans objet lié.</p></div>';
	print '<form class="mjl-activity-action-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'" data-mjl-form="convention-delete" data-mjl-substantive>';
	print '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<div class="mjl-decision-consequence"><strong>Conséquence de cette décision</strong><p>Le brouillon sera supprimé définitivement; cette action est irréversible.</p></div>';
	print '<div class="mjl-activity-form-actions"><button class="button" type="submit">Supprimer l’enveloppe</button><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']).'">Annuler</a></div>';
	print '</form></section>';
}

function mjl_conventions_action_form($id, $action, $label, $commentLabel, $required, $withCancel = false)
{
	$recovery = $GLOBALS['mjl_convention_recovery'] ?? null;
	$matchesRecovery = is_array($recovery) && (string) ($recovery['context']['action'] ?? '') === $action;
	$values = $matchesRecovery ? (array) ($recovery['values'] ?? array()) : array();
	$errors = $matchesRecovery ? (array) ($recovery['errors'] ?? array()) : array();
	$isRecovered = !empty($recovery['recovered']) && $matchesRecovery;
	$prefix = 'mjl-convention-decision-'.$action.'-';
	print '<form class="mjl-activity-action-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $id).'" data-mjl-validate data-mjl-form="convention-'.dol_escape_htmltag($action).'"'.($withCancel ? ' data-mjl-substantive' : '').($isRecovered ? ' data-mjl-recovered="true"' : '').'>';
	print '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="action" value="'.dol_escape_htmltag($action).'"><input type="hidden" name="id" value="'.((int) $id).'">';
	if ($commentLabel !== '') {
		print mjl_form_error_summary($errors, 'Corrigez la décision', $prefix);
		print mjl_form_field('comment', $commentLabel, '<input'.($required ? ' required' : '').' name="comment" value="'.dol_escape_htmltag($values['comment'] ?? '').'">', $required, '', $errors['comment'] ?? '', $prefix);
	}
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="'.dol_escape_htmltag($label).'">';
	if ($withCancel) print '<a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $id).'">Annuler</a>';
	print '</div>';
	print '</form>';
}

function mjl_conventions_render_timeline($row)
{
	$items = mjl_conventions_timeline_items($row);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Historique enveloppe</h2><p>Creation, modifications, activation, cloture, tentatives refusees et commentaires.</p></div>';
	mjl_timeline_render_comment_form('mjlfinancement_convention', (int) $row['rowid'], DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php?id='.((int) $row['rowid']), $GLOBALS['mjl_convention_recovery'] ?? array());
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
	$sql .= ' AND 1=0';
	$query = mjl_finance_source_query($db, $sql, 'conventions', 'fetch_detail', $id);
	$resql = $query['result'];
	if (!$resql) {
		mjl_feedback_add('conventions:detail:'.((int) $id).':database', 'generic.database');
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
		'label' => 'Créée',
		'title' => 'Enveloppe créée',
		'meta' => mjl_conventions_format_datetime($row['date_creation']).' par '.$row['creator_login'],
		'comment' => '',
		'changes' => array(),
	));
	$sql = 'SELECT w.action, w.from_status, w.to_status, w.actor_role, w.action_date, w.comment, w.changes_json, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity).' AND w.object_type = \'mjlfinancement_convention\' AND w.object_id = '.((int) $row['rowid']);
	$sql .= ' ORDER BY w.action_date ASC, w.rowid ASC';
	$query = mjl_finance_source_query($db, $sql, 'conventions', 'timeline', (int) $row['rowid']);
	$resql = $query['result'];
	if (!$resql) {
		mjl_feedback_add('conventions:timeline:'.((int) $row['rowid']).':database', 'generic.partial');
		return $items;
	}
	while ($obj = $db->fetch_object($resql)) {
		$changes = json_decode((string) $obj->changes_json, true);
		$items[] = array(
			'label' => mjl_convention_action_label($obj->action),
			'title' => mjl_conventions_timeline_title($obj->action, $obj->from_status, $obj->to_status),
			'meta' => mjl_conventions_format_datetime($obj->action_date).' par '.$obj->login.' ('.mjl_convention_actor_role_label($obj->actor_role, $obj->action).')',
			'comment' => (string) $obj->comment,
			'changes' => is_array($changes) ? $changes : array(),
		);
	}
	foreach (mjl_timeline_exchange_items('mjlfinancement_convention', (int) $row['rowid'], true) as $item) {
		$items[] = $item;
	}
	return $items;
}

function mjl_conventions_options($type)
{
	global $db, $conf;
	if ($type === 'ptf') {
		$sql = 'SELECT rowid, nom AS label FROM '.$db->prefix().'societe s WHERE s.entity = '.((int) $conf->entity).' AND s.status = 1'.' AND 1=0'.' ORDER BY s.nom';
	} else {
		$sql = 'SELECT rowid, CONCAT(ref, \' - \', title) AS label FROM '.$db->prefix().'projet p WHERE p.entity = '.((int) $conf->entity).' AND 1=0'.' ORDER BY p.ref';
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
	return false;
}

function mjl_conventions_can_use_supplied_links($fkSoc, $fkProject)
{
	$fkSoc = (int) $fkSoc;
	$fkProject = (int) $fkProject;
	if ($fkSoc > 0 && !array_key_exists($fkSoc, mjl_conventions_options('ptf'))) return false;
	if ($fkProject > 0 && !array_key_exists($fkProject, mjl_conventions_options('project'))) return false;
	if ($fkSoc > 0 && $fkProject > 0) return mjl_conventions_can_use_partner_project($fkSoc, $fkProject);
	return true;
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

function mjl_conventions_can_present_action($row, $action, $hasLinks)
{
	if ($action === 'edit') return mjl_conventions_can_manage();
	if ($action === 'activate') return mjl_conventions_can_manage() && (int) $row['status'] === MjlConvention::STATUS_DRAFT;
	if ($action === 'close') return mjl_conventions_can_manage() && (int) $row['status'] === MjlConvention::STATUS_ACTIVE;
	if ($action === 'delete') return mjl_conventions_can_manage() && (int) $row['status'] === MjlConvention::STATUS_DRAFT && !$hasLinks;
	if ($action === 'upload') return mjl_conventions_can_upload_document($row);
	return false;
}

function mjl_convention_status_label($status)
{
	return mjl_timeline_presentation_status_label('mjlfinancement_convention', $status);
}

function mjl_convention_action_label($action)
{
	return mjl_timeline_presentation_action_label('mjlfinancement_convention', $action);
}

function mjl_convention_actor_role_label($role, $action = '')
{
	return mjl_timeline_presentation_actor_role_label('mjlfinancement_convention', $action, $role);
}

function mjl_conventions_status_badge($status)
{
	return mjl_ui_status_badge(mjl_status_presentation('convention', $status, 'operational'));
}

function mjl_conventions_next_action_label($row, $hasLinks)
{
	if ((int) $row['status'] === MjlConvention::STATUS_DRAFT) return 'Vérifier les données puis activer l’enveloppe.';
	if ((int) $row['status'] === MjlConvention::STATUS_ACTIVE && $hasLinks) return 'Enveloppe active : les champs structurants sont verrouillés.';
	if ((int) $row['status'] === MjlConvention::STATUS_ACTIVE) return 'Enveloppe active disponible pour les opérations.';
	return 'Enveloppe clôturée : consultation, rapports et historique restent disponibles.';
}

function mjl_conventions_timeline_title($action, $fromStatus, $toStatus)
{
	if ((string) $action === 'document_uploaded') {
		return 'Document ajouté à l’enveloppe';
	}
	if ((string) $fromStatus === '' || (string) $toStatus === '' || (string) $fromStatus === (string) $toStatus) {
		return mjl_convention_action_label($action);
	}
	return mjl_convention_status_label($fromStatus).' vers '.mjl_convention_status_label($toStatus);
}

function mjl_conventions_evidence_label($state)
{
	if ($state === 'upload-failed') return 'Échec de l’ajout';
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
	return mjl_format_date($value, 'date');
}

function mjl_conventions_format_datetime($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return mjl_format_date($value, 'datetime');
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

function mjl_conventions_store_recovery($action, $id, $feedback)
{
	global $conf, $user;
	$config = mjl_finance_recovery_config('conventions', $action);
	if ($config === null) return '';
	$values = array();
	foreach ($config['fields'] as $field) $values[$field] = GETPOST($field, 'restricthtml');
	$errors = mjl_finance_feedback_recovery_errors('conventions', $action, $feedback, $config['fields']);
	$reason = '';
	return mjl_form_recovery_store(array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'conventions', 'form' => $config['form'], 'action' => $action, 'object_id' => (int) $id), $values, $config['fields'], $reason, $errors);
}

function mjl_conventions_redirect($id, $recoveryHandle = '', $presentationAction = '', $documentState = '')
{
	$url = DOL_URL_ROOT.'/custom/mjlfinancement/conventions.php';
	$query = array();
	if ((int) $id > 0) $query['id'] = (int) $id;
	if ((string) $presentationAction !== '') $query['action'] = (string) $presentationAction;
	if ($recoveryHandle !== '') $query['mjl_recovery'] = $recoveryHandle;
	if (in_array((string) $documentState, array('upload-failed'), true)) $query['mjl_document_state'] = (string) $documentState;
	if (!empty($query)) $url .= '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986);
	header('Location: '.$url);
	exit;
}
