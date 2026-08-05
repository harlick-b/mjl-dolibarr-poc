<?php

define('NOCSRFCHECK', 1); // This route enforces currentToken() on every POST and owns guarded GET action states.
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document_audit_persistence.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_table.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_recovery.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_journey.lib.php';

if (!mjl_workspace_can_access_activity($user)) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');
$action = GETPOST('action', 'alpha');
$activityId = GETPOSTINT('id');
$presentationAction = $_SERVER['REQUEST_METHOD'] === 'GET' && (in_array($action, array('create', 'edit', 'update_execution', 'upload'), true) || in_array($action, mjl_activities_guarded_review_actions(), true)) ? $action : '';
$presentationActivity = array();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		mjl_activities_forbidden('Invalid security token');
	}
	if (!mjl_workspace_can_apply_activity_write($user) && in_array($action, array('create', 'update', 'update_execution', 'submit', 'correct'), true)) {
		mjl_activities_forbidden();
	}
	if (!mjl_workspace_can_apply_activity_validation($user) && in_array($action, array('prevalidate', 'final_validate', 'validate', 'reject', 'request_correction'), true)) {
		mjl_activities_forbidden();
	}
	mjl_activities_handle_post($action);
}

$mjl_activities_page_token = function_exists('newToken') ? newToken() : '';
$mjl_activity_document_state = GETPOST('mjl_document_state', 'alphanohtml');
if ($presentationAction === 'create') {
	if ($activityId !== 0 || !mjl_workspace_can_apply_activity_write($user)) {
		mjl_activities_forbidden();
	}
	$mjl_activity_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'activities', 'object_id' => 0),
		array('create' => array('create'))
	);
} elseif ($presentationAction === 'edit') {
	$presentationActivity = mjl_activities_fetch_detail($activityId);
	if (empty($presentationActivity) || !mjl_activities_can_open($presentationActivity) || !mjl_activities_can_apply_action($presentationActivity, 'update')) {
		mjl_activities_forbidden();
	}
	$mjl_activity_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'activities', 'object_id' => $activityId),
		array('correction' => array('update'))
	);
} elseif ($presentationAction === 'upload') {
	$presentationActivity = mjl_activities_fetch_detail($activityId);
	if (empty($presentationActivity) || !mjl_activities_can_open($presentationActivity) || !mjl_activities_can_apply_action($presentationActivity, 'upload')) {
		mjl_activities_forbidden();
	}
	$mjl_activity_recovery = array();
} elseif ($presentationAction === 'update_execution') {
	$presentationActivity = mjl_activities_fetch_detail($activityId);
	if (empty($presentationActivity) || !mjl_activities_can_open($presentationActivity) || !mjl_activities_can_apply_action($presentationActivity, 'update_execution')) {
		mjl_activities_forbidden();
	}
	$mjl_activity_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'activities', 'object_id' => $activityId),
		array('execution' => array('update_execution'))
	);
} elseif ($presentationAction !== '') {
	$presentationActivity = mjl_activities_fetch_detail($activityId);
	if (empty($presentationActivity) || !mjl_activities_can_open($presentationActivity) || !mjl_activities_can_apply_action($presentationActivity, $presentationAction)) {
		mjl_activities_forbidden();
	}
	$mjl_activity_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'activities', 'object_id' => $activityId),
		array((string) mjl_activity_recovery_config($presentationAction)['form'] => array($presentationAction))
	);
} else {
	$mjl_activity_recovery = mjl_form_recovery_consume_route(
		GETPOST('mjl_recovery', 'alphanohtml'),
		array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'activities', 'object_id' => $activityId),
		array('correction' => array('correct'), 'decision' => array('submit'), 'comment' => array('add_exchange'))
	);
}

llxHeader('', 'Activités MJL');
mjl_navigation_shell_start($user);
print '<div class="mjl-workspace mjl-activity-workspace">';

if ($presentationAction === 'create') {
	mjl_activities_render_create_state();
} elseif ($presentationAction === 'edit') {
	mjl_activities_render_edit_state($presentationActivity);
} elseif ($presentationAction === 'upload') {
	mjl_activities_render_upload_state($presentationActivity);
} elseif ($presentationAction === 'update_execution') {
	mjl_activities_render_execution_state($presentationActivity);
} elseif ($presentationAction !== '') {
	mjl_activities_render_action_state($presentationActivity, $presentationAction);
} elseif ($activityId > 0) {
	mjl_activities_render_detail($activityId);
} else {
	mjl_activities_render_list_page();
}

print '</div>';
print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/activities.js"></script>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_activities_handle_post($action)
{
	global $db, $user, $conf;

	if ($action === 'create') {
		$fkProject = GETPOSTINT('fk_project');
		$fkConvention = GETPOSTINT('fk_convention');
		$fkTask = GETPOSTINT('fk_task');
		$fkResponsible = GETPOSTINT('fk_user_responsible');
		if ($fkProject > 0 && !mjl_scope_can_access_object($user, 'mjlfinancement_project', $fkProject)) {
			mjl_activities_forbidden('Projet hors de votre périmètre');
		}
		if ($fkConvention > 0 && !mjl_scope_can_access_object($user, 'mjlfinancement_convention', $fkConvention)) {
			mjl_activities_forbidden('Enveloppe hors de votre périmètre');
		}
		$errors = array();
		if (trim((string) GETPOST('ref', 'alphanohtml')) === '') $errors['ref'] = 'La référence est obligatoire.';
		if (trim((string) GETPOST('label', 'restricthtml')) === '') $errors['label'] = 'Le libellé est obligatoire.';
		if ($fkProject <= 0) $errors['fk_project'] = 'Le projet est obligatoire.';
		if ($fkConvention <= 0) $errors['fk_convention'] = 'L’enveloppe de financement est obligatoire.';
		$dateStart = GETPOST('date_start', 'alphanohtml');
		$dateEnd = GETPOST('date_end', 'alphanohtml');
		if ($dateStart !== '' && $dateEnd !== '' && strtotime($dateEnd) < strtotime($dateStart)) $errors['date_end'] = 'La date de fin doit être postérieure ou égale à la date de début.';
		$percent = GETPOST('physical_execution_percent', 'alphanohtml');
		if ($percent !== '' && (!is_numeric($percent) || (float) $percent < 0 || (float) $percent > 100)) $errors['physical_execution_percent'] = 'Le taux d’exécution doit être compris entre 0 et 100.';
		if (!empty($errors)) {
			$recoveryAliases = mjl_activities_validated_create_recovery_aliases($fkProject, $fkConvention, $fkTask, $fkResponsible);
			$handle = mjl_activities_store_recovery_config('create', 0, $errors, $recoveryAliases);
			mjl_feedback_add('activities:create:validation', 'generic.validation');
			mjl_activities_redirect(0, $handle, 'create');
		}
		$activity = new MjlActivity($db);
		$activity->entity = (int) $conf->entity;
		$activity->ref = GETPOST('ref', 'alphanohtml');
		$activity->label = GETPOST('label', 'restricthtml');
		$activity->fk_project = $fkProject;
		$activity->fk_convention = $fkConvention;
		$activity->fk_task = $fkTask;
		$activity->date_start = mjl_activities_post_date('date_start');
		$activity->date_end = mjl_activities_post_date('date_end');
		$activity->fk_user_responsible = $fkResponsible;
		$activity->date_actual_start = mjl_activities_post_date('date_actual_start');
		$activity->date_actual_end = mjl_activities_post_date('date_actual_end');
		$activity->physical_execution_percent = GETPOST('physical_execution_percent', 'alphanohtml');
		$activity->execution_status = GETPOST('execution_status', 'alpha');
		$activity->execution_comment = GETPOST('execution_comment', 'restricthtml');
		$activity->status = MjlActivity::STATUS_DRAFT;
		$activity->fk_user_creat = $user->id;
		$result = $activity->create($user);
		if ($result <= 0) {
			$errors = mjl_form_translate_domain_error($activity->error);
			$recoveryAliases = mjl_activities_validated_create_recovery_aliases($fkProject, $fkConvention, $fkTask, $fkResponsible);
			$handle = mjl_activities_store_recovery_config('create', 0, $errors, $recoveryAliases);
			mjl_feedback_add('activities:create:domain', empty($errors) ? 'generic.error' : 'generic.validation');
			mjl_ui_log_error('domain', mjl_activities_error_context('create'), $activity->error);
			mjl_activities_redirect(0, $handle, 'create');
		}
		mjl_feedback_add('activities:create:'.((int) $result), 'activity.created');
		mjl_activities_redirect((int) $result);
	}

	$id = GETPOSTINT('id');
	$activity = new MjlActivity($db);
	if ($id <= 0 || $activity->fetch($id) <= 0 || (int) $activity->entity !== (int) $conf->entity || !mjl_activities_can_open($activity)) {
		mjl_activities_forbidden('Activité introuvable ou hors de votre périmètre');
	}

	if ($action === 'add_exchange') {
		list($result, $message) = mjl_timeline_create_comment($user, 'mjlfinancement_activity', $id, GETPOST('message', 'restricthtml'));
		if ($result <= 0) {
			$handle = mjl_activities_store_recovery_config('add_exchange', $id, array('message' => $message === 'Le commentaire est obligatoire.' ? $message : 'Le commentaire n’a pas pu être ajouté.'));
			mjl_feedback_add('activities:add_exchange:'.$id.':error', $message === 'Le commentaire est obligatoire.' ? 'generic.validation' : 'generic.error');
			mjl_activities_redirect($id, $handle);
		}
		mjl_feedback_add('activities:add_exchange:'.$id, 'activity.comment_added');
		mjl_activities_redirect($id);
	}

	if (!mjl_activities_can_apply_action($activity, $action)) {
		mjl_activities_forbidden();
	}

	if ($action === 'update') $result = mjl_activities_update_for_correction($activity);
	elseif ($action === 'update_execution') $result = mjl_activities_update_execution($activity);
	elseif ($action === 'submit') $result = $activity->submit($user, GETPOST('comment', 'restricthtml'), mjl_activities_actor_role_code());
	elseif ($action === 'request_correction') $result = $activity->requestCorrection($user, GETPOST('comment', 'restricthtml'), mjl_activities_actor_role_code());
	elseif ($action === 'correct') $result = $activity->correct($user, GETPOST('comment', 'restricthtml'), mjl_activities_actor_role_code());
	elseif ($action === 'prevalidate') $result = $activity->prevalidate($user, GETPOST('comment', 'restricthtml'), 'AGENT_VERIFICATEUR');
	elseif ($action === 'final_validate') $result = $activity->finalValidate($user, GETPOST('comment', 'restricthtml'), 'VALIDATEUR_DEFINITIF');
	elseif ($action === 'validate') $result = $activity->validate($user, GETPOST('comment', 'restricthtml'), mjl_activities_actor_role_code());
	elseif ($action === 'reject') $result = $activity->reject($user, GETPOST('comment', 'restricthtml'), mjl_activities_actor_role_code());
	elseif ($action === 'upload') $result = mjl_activities_upload_document($activity);
	else mjl_activities_redirect($id);

	if ($result < 0) {
		$errors = mjl_form_translate_domain_error($activity->error);
		if ($action === 'upload') {
			mjl_feedback_add('activities:upload:'.$id.':error', 'generic.validation');
			mjl_ui_log_error('domain', mjl_activities_error_context($action) + array('object_type' => 'activity', 'object_id' => $id), $activity->error);
			mjl_activities_redirect($id, '', 'upload', 'upload-failed');
		}
		$recoveryAliases = $action === 'update'
			? mjl_activity_recovery_validated_update_aliases(GETPOSTINT('fk_user_responsible'), mjl_activities_options('responsible'))
			: array();
		$handle = mjl_activities_store_recovery_config($action, $id, $errors, $recoveryAliases);
		mjl_feedback_add('activities:'.$action.':'.$id.':error', empty($errors) ? 'generic.error' : 'generic.validation');
		mjl_ui_log_error('domain', mjl_activities_error_context($action) + array('object_type' => 'activity', 'object_id' => $id), $activity->error);
		$recoveryState = $action === 'update' ? 'edit' : ($action === 'update_execution' ? 'update_execution' : (in_array($action, mjl_activities_guarded_review_actions(), true) ? $action : ''));
		mjl_activities_redirect($id, $handle, $recoveryState);
	}
	elseif ($result === 0) mjl_feedback_add('activities:'.$action.':'.$id.':unchanged', 'generic.no_change');
	else mjl_feedback_add('activities:'.$action.':'.$id, 'activity.saved');
	mjl_activities_redirect($id);
}

function mjl_activities_forbidden($message = '')
{
	if (function_exists('http_response_code')) {
		http_response_code(403);
	} else {
		header('HTTP/1.1 403 Forbidden');
	}
	accessforbidden($message);
}

function mjl_activities_actor_role_code()
{
	global $user;
	if (mjl_scope_is_final_validator($user)) return 'VALIDATEUR_DEFINITIF';
	if (mjl_scope_is_verifier($user)) return 'AGENT_VERIFICATEUR';
	if (mjl_scope_is_platform_admin($user)) return 'ADMIN_PLATEFORME';
	return 'AGENT_SAISIE';
}

function mjl_activities_update_for_correction(MjlActivity $activity)
{
	global $user;

	if (!$user->hasRight('mjlfinancement', 'activity', 'write')) {
		$activity->error = 'Permission denied for activity update';
		return -1;
	}
	if (!in_array((int) $activity->status, MjlActivity::editableStatuses(), true)) {
		$activity->error = 'Only draft or correction-requested activities can be edited through this action';
		return -1;
	}

	$label = GETPOST('label', 'restricthtml');
	$dateStart = GETPOST('date_start', 'alphanohtml');
	$dateEnd = GETPOST('date_end', 'alphanohtml');
	return $activity->updateImportantFields($user, array(
		'label' => $label,
		'date_start' => $dateStart,
		'date_end' => $dateEnd,
		'fk_user_responsible' => GETPOSTINT('fk_user_responsible'),
	), GETPOST('comment', 'restricthtml'), mjl_activities_actor_role_code());
}

function mjl_activities_update_execution(MjlActivity $activity)
{
	global $user;

	if (!$user->hasRight('mjlfinancement', 'activity', 'write')) {
		$activity->error = 'Permission denied for activity execution update';
		return -1;
	}
	return $activity->updateExecution($user, array(
		'fk_user_responsible' => GETPOSTINT('fk_user_responsible'),
		'date_actual_start' => GETPOST('date_actual_start', 'alphanohtml'),
		'date_actual_end' => GETPOST('date_actual_end', 'alphanohtml'),
		'physical_execution_percent' => GETPOST('physical_execution_percent', 'alphanohtml'),
		'execution_status' => GETPOST('execution_status', 'alpha'),
		'execution_comment' => GETPOST('execution_comment', 'restricthtml'),
	), mjl_activities_actor_role_code());
}

function mjl_activities_upload_document(MjlActivity $activity)
{
	global $db, $user, $conf;

	$activityId = (int) ($activity->id ?: $activity->rowid);
	$row = array(
		'rowid' => $activityId,
		'entity' => (int) $activity->entity,
		'fk_user_creat' => (int) $activity->fk_user_creat,
		'fk_user_responsible' => (int) $activity->fk_user_responsible,
		'status' => (int) $activity->status,
	);
	if ((int) $activity->entity !== (int) $conf->entity || !mjl_activities_can_apply_action($row, 'upload')) {
		$activity->error = 'Permission denied for activity document upload';
		return -1;
	}

	$db->begin();
	$error = '';
	$document = mjl_document_upload_to_ecm('mjlfinancement_activity', $activityId, (int) $activity->entity, 'supporting_document', 'mjlfinancement_activity', 'MJL-ACT', 'Document activite MJL', $error);
	if (empty($document)) {
		$db->rollback();
		$activity->error = $error;
		return -1;
	}
	$role = mjl_activities_actor_role_code();
	$statusLabel = mjl_document_audit_status_label('mjlfinancement_activity', $activity->status);
	$comment = 'Document ajoute: '.$document['original'];
	$audit = mjl_workflow_audit_insert('mjlfinancement_activity', $activityId, (int) $activity->entity, $statusLabel, $user, $role, 'document_uploaded', $comment, array(
		'document' => array('before' => null, 'after' => $document['original']),
		'ecm_file_id' => array('before' => null, 'after' => $document['rowid']),
	), 'WFA-ACT-DOC', $activity->import_key);
	if ($audit < 0) {
		$db->rollback();
		@unlink(rtrim($conf->ecm->dir_output, '/').'/'.$document['filepath'].'/'.$document['filename']);
		$activity->error = $db->lasterror();
		return -1;
	}
	$db->commit();
	return 1;
}

function mjl_activities_render_list_page()
{
	$headerOptions = array(
		'description' => 'Consultez les activités de votre périmètre, ouvrez le détail et traitez les actions attendues.',
		'context' => array('label' => 'Périmètre', 'value' => mjl_activities_scope_label()),
	);
	if (mjl_workspace_can_apply_activity_write($GLOBALS['user'])) {
		$headerOptions['primary_action'] = array(
			'label' => 'Créer une activité',
			'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?action=create',
		);
	}
	print mjl_page_header_render(
		'Suivi des activités et décisions',
		$headerOptions
	);
	mjl_activities_list();
}

function mjl_activities_render_create_state()
{
	print mjl_page_header_render(
		'Créer une activité',
		array(
			'breadcrumb' => array(
				array('label' => 'Activités', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),
				array('label' => 'Créer'),
			),
			'description' => 'Créez un brouillon rattaché à un projet et une enveloppe de financement de votre périmètre.',
		)
	);
	mjl_activities_create_form();
}

function mjl_activities_render_edit_state($row)
{
	print mjl_page_header_render(
		'Modifier l’activité '.$row['ref'],
		array(
			'breadcrumb' => array(
				array('label' => 'Activités', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),
				array('label' => $row['ref'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid'])),
				array('label' => 'Modifier'),
			),
			'description' => 'Mettez à jour les informations modifiables de cette activité avant sa soumission.',
			'context' => array('label' => 'Statut actuel', 'value' => mjl_activity_status_label($row['status'])),
		)
	);
	mjl_activities_render_update_form($row);
}

function mjl_activities_render_upload_state($row)
{
	$title = 'Ajouter un document à l’activité '.$row['ref'];
	print mjl_page_header_render(
		$title,
		array(
			'breadcrumb' => array(
				array('label' => 'Activités', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),
				array('label' => $row['ref'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid'])),
				array('label' => 'Ajouter un document'),
			),
			'description' => 'Ajoutez un document opérationnel à cette activité. Il restera accessible uniquement par le téléchargement MJL gardé.',
			'context' => array('label' => 'Statut actuel', 'value' => mjl_activity_status_label($row['status'])),
		)
	);
	mjl_activities_render_activity_document_panel($row, false);
	print '<section class="mjl-workspace-section mjl-activity-card"><div class="mjl-section-heading"><h2>Document à ajouter</h2><p>Sélectionnez le fichier justificatif associé à cette activité.</p></div>';
	print '<form class="mjl-activity-action-form" enctype="multipart/form-data" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'" data-mjl-form="activity-upload" data-mjl-substantive>';
	print mjl_activities_token_input().'<input type="hidden" name="action" value="upload"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<label>Document de l’activité<input required type="file" name="supporting_document"></label>';
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Ajouter le document"><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']).'">Annuler</a></div>';
	print '</form></section>';
}

function mjl_activities_render_execution_state($row)
{
	print mjl_page_header_render(
		'Mettre à jour l’exécution de l’activité '.$row['ref'],
		array(
			'breadcrumb' => array(
				array('label' => 'Activités', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),
				array('label' => $row['ref'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid'])),
				array('label' => 'Mettre à jour l’exécution'),
			),
			'description' => 'Renseignez l’avancement opérationnel sans modifier l’état du circuit de validation.',
			'context' => array('label' => 'Statut actuel', 'value' => mjl_activity_status_label($row['status'])),
		)
	);
	mjl_activities_render_summary_card($row);
	mjl_activities_render_execution_form($row);
}

function mjl_activities_render_detail($id)
{
	$row = mjl_activities_fetch_detail($id);
	if (empty($row) || !mjl_activities_can_open($row)) {
		accessforbidden();
	}

	$headerOptions = array(
			'breadcrumb' => array(
				array('label' => 'Activités', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),
				array('label' => $row['ref']),
			),
			'description' => mjl_activities_next_action_label($row),
			'context' => array('label' => 'Statut', 'value' => mjl_activity_status_label($row['status'])),
		);
	if (mjl_activities_can_apply_action($row, 'update')) {
		$headerOptions['primary_action'] = array(
			'label' => 'Modifier l’activité',
			'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']).'&action=edit',
		);
	}
	print mjl_page_header_render($row['ref'].' - '.$row['label'], $headerOptions);

	print '<div class="mjl-activity-detail-grid">';
	mjl_activities_render_summary_card($row);
	mjl_activities_render_decision_panel($row);
	print '</div>';
	mjl_activities_render_execution_panel($row);
	mjl_activities_render_activity_document_panel($row);
	mjl_activities_render_document_checklist((int) $row['rowid']);
	mjl_activities_render_timeline($row);
}

function mjl_activities_render_action_state($row, $action)
{
	$actions = mjl_activities_available_actions($row);
	if (!isset($actions[$action]) || !in_array($action, mjl_activities_guarded_review_actions(), true)) {
		mjl_activities_forbidden();
	}
	$titles = array(
		'prevalidate' => 'Prévalider l’activité',
		'final_validate' => 'Valider définitivement l’activité',
		'validate' => 'Valider l’activité',
		'request_correction' => 'Retourner l’activité pour correction',
		'reject' => 'Rejeter l’activité',
	);
	$title = $titles[$action];
	print mjl_page_header_render(
		$title,
		array(
			'breadcrumb' => array(
				array('label' => 'Activités', 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php'),
				array('label' => $row['ref'], 'href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid'])),
				array('label' => $title),
			),
			'description' => $action === 'request_correction' ? 'Indiquez le motif attendu avant de retourner cette activité à l’agent de saisie.' : 'Vérifiez le contexte et renseignez le commentaire de décision avant de continuer.',
			'context' => array('label' => 'Statut actuel', 'value' => mjl_activity_status_label($row['status'])),
		)
	);
	print '<section class="mjl-workspace-section mjl-activity-card mjl-activity-decision">';
	print '<div class="mjl-section-heading"><h2>'.dol_escape_htmltag($actions[$action]['label']).'</h2><p>Cette décision conserve les contrôles de rôle, de périmètre et d’état de l’activité.</p></div>';
	mjl_activities_render_decision_form($row, $action, $actions[$action], true);
	print '</section>';
}

function mjl_activities_create_form()
{
	$recovery = mjl_activities_recovery_for_action('create');
	$isRecovered = !empty($recovery['recovered']);
	$errors = $recovery['errors'];
	$projectOptions = mjl_activities_options('project');
	$conventionOptions = mjl_activities_options('convention');
	$taskOptions = mjl_activities_options('task');
	$responsibleOptions = mjl_activities_options('responsible');
	$values = mjl_activity_recovery_restore_create_values($recovery['values'], $projectOptions, $conventionOptions, $taskOptions, $responsibleOptions);
	$optionErrors = isset($GLOBALS['mjl_activities_option_errors']) ? $GLOBALS['mjl_activities_option_errors'] : array();
	$optionsUnavailable = !empty($optionErrors['project']) || !empty($optionErrors['convention']);
	$optionsEmpty = !$optionsUnavailable && (empty($projectOptions) || empty($conventionOptions));

	print '<section class="mjl-workspace-section mjl-activity-panel">';
	print '<div class="mjl-section-heading"><h2>Nouvelle activité</h2><p>Créez un brouillon rattaché à un projet et une enveloppe de financement. Les champs obligatoires sont signalés.</p></div>';
	if ($optionsUnavailable) {
		print mjl_ui_system_state('unavailable', 'Création indisponible', mjl_ui_safe_error_message('options'));
	} elseif ($optionsEmpty) {
		print mjl_ui_system_state('initial-empty', 'Aucun rattachement accessible', 'Aucun projet ou aucune enveloppe active n’est disponible dans votre périmètre.');
	}
	print '<form class="mjl-activity-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'" data-mjl-validate data-mjl-form="activity-create" data-mjl-substantive'.($isRecovered ? ' data-mjl-recovered="true"' : '').'>';
	print '<input type="hidden" name="action" value="create">';
	print mjl_activities_token_input();
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($errors, 'Corrigez les champs indiqués', 'mjl-field-', $isRecovered).'</div>';
	print mjl_form_field('ref', 'Référence', '<input required name="ref" aria-label="Référence" value="'.dol_escape_htmltag($values['ref'] ?? '').'" data-mjl-required-message="La référence est obligatoire.">', true, '', $errors['ref'] ?? '');
	print mjl_form_field('label', 'Libellé', '<input required name="label" aria-label="Libellé" value="'.dol_escape_htmltag($values['label'] ?? '').'" data-mjl-required-message="Le libellé est obligatoire.">', true, '', $errors['label'] ?? '');
	print mjl_form_field('fk_project', 'Projet', mjl_activities_select('fk_project', $projectOptions, 1, 'Choisir', (int) ($values['fk_project'] ?? 0)), true, '', $errors['fk_project'] ?? '');
	print mjl_form_field('fk_convention', 'Enveloppe de financement', mjl_activities_select('fk_convention', $conventionOptions, 1, 'Choisir', (int) ($values['fk_convention'] ?? 0)), true, '', $errors['fk_convention'] ?? '');
	print mjl_form_field('fk_task', 'Tâche projet', mjl_activities_select('fk_task', $taskOptions, 0, 'Aucune', (int) ($values['fk_task'] ?? 0)));
	print mjl_form_field('fk_user_responsible', 'Responsable', mjl_activities_select('fk_user_responsible', $responsibleOptions, 0, 'Créateur par défaut', (int) ($values['fk_user_responsible'] ?? 0)));
	print mjl_form_field('date_start', 'Début', '<input type="date" name="date_start" value="'.dol_escape_htmltag($values['date_start'] ?? '').'">');
	print mjl_form_field('date_end', 'Fin', '<input type="date" name="date_end" value="'.dol_escape_htmltag($values['date_end'] ?? '').'">', false, '', $errors['date_end'] ?? '');
	print mjl_form_field('date_actual_start', 'Début réel', '<input type="date" name="date_actual_start" value="'.dol_escape_htmltag($values['date_actual_start'] ?? '').'">');
	print mjl_form_field('date_actual_end', 'Fin réelle', '<input type="date" name="date_actual_end" value="'.dol_escape_htmltag($values['date_actual_end'] ?? '').'">');
	print mjl_form_field('physical_execution_percent', 'Exécution physique (%)', '<input type="number" min="0" max="100" name="physical_execution_percent" aria-label="Exécution physique (%)" value="'.dol_escape_htmltag($values['physical_execution_percent'] ?? '').'">', false, '', $errors['physical_execution_percent'] ?? '');
	print mjl_form_field('execution_status', 'Statut d’exécution', mjl_activities_execution_status_select('execution_status', $values['execution_status'] ?? ''));
	print mjl_form_field('execution_comment', 'Commentaire d’exécution', '<textarea name="execution_comment">'.dol_escape_htmltag($values['execution_comment'] ?? '').'</textarea>');
	print '<div class="mjl-activity-form-actions"><button class="button mjl-action mjl-action-primary" type="submit"'.($optionsUnavailable || $optionsEmpty ? ' disabled' : '').'>Créer l’activité</button><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php">Annuler</a></div>';
	print '</form>';
	print '</section>';
}

function mjl_activities_list()
{
	global $db, $conf;
	$projectOptions = mjl_activities_options('project');
	$partnerOptions = mjl_activities_options('partner');
	$projectIds = array_map('intval', array_keys($projectOptions));
	$partnerIds = array_map('intval', array_keys($partnerOptions));
	$raw = array();
	foreach (array('status', 'partner', 'project', 'risk', 'sort', 'page') as $key) {
		$raw[$key] = isset($_GET[$key]) && is_scalar($_GET[$key]) ? (string) $_GET[$key] : '';
	}
	$allowedStatuses = array_map('strval', range(0, 9));
	$filters = mjl_table_normalize_request($raw, $allowedStatuses, $projectIds, null, 50, $partnerIds);
	$fragments = mjl_activities_list_fragments($filters);
	$total = 0;
	$countAvailable = true;
	if (!$filters['fail_closed']) {
		$countSql = 'SELECT COUNT(DISTINCT a.rowid) AS nb'.$fragments['from'].$fragments['where'];
		$countResult = $db->query($countSql);
		if ($countResult) {
			$countRow = $db->fetch_object($countResult);
			$total = $countRow ? (int) $countRow->nb : 0;
			$filters = mjl_table_normalize_request($raw, $allowedStatuses, $projectIds, $total, 50, $partnerIds);
			$fragments = mjl_activities_list_fragments($filters);
		} else {
			$countAvailable = false;
			$total = null;
			mjl_ui_log_error('database', mjl_activities_error_context('list_count'), $db->lasterror());
		}
	}
	$rows = array();
	$rowAvailable = true;
	$hasExtraRow = false;
	if (!$filters['fail_closed']) {
		$orderBy = mjl_activities_list_order_sql($filters['sort']);
		$offset = max(0, ((int) $filters['page'] - 1) * (int) $filters['page_size']);
		$sql = 'SELECT DISTINCT a.rowid, a.ref, a.label, a.date_start, a.date_end, a.physical_execution_percent, a.execution_status, a.status, p.ref AS project_ref';
		$sql .= $fragments['from'].$fragments['where'].$orderBy;
		$sql .= ' LIMIT '.((int) $filters['page_size'] + 1).' OFFSET '.$offset;
		$resql = $db->query($sql);
		if (!$resql) {
			$rowAvailable = false;
			mjl_ui_log_error('database', mjl_activities_error_context('list_rows'), $db->lasterror());
		} else {
			while ($row = $db->fetch_object($resql)) $rows[] = (array) $row;
			$hasExtraRow = count($rows) > (int) $filters['page_size'];
			if ($hasExtraRow) array_pop($rows);
		}
	}

	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Activités du périmètre</h2><p>Filtrez et priorisez les activités avant d’ouvrir leur détail.</p></div>';
	mjl_activities_render_list_filters($filters, $partnerOptions, $projectOptions);
	if (!$countAvailable && $rowAvailable) {
		print mjl_ui_system_state('partial-error', 'Total indisponible', 'Les activités accessibles restent affichées, mais le total ne peut pas être calculé.');
	}
	if (!$rowAvailable) {
		print mjl_ui_system_state('danger', 'Liste indisponible', mjl_ui_safe_error_message('database'), array('href' => DOL_URL_ROOT.'/custom/mjlfinancement/activities.php', 'action' => 'Réessayer'));
	}
	print '<p class="mjl-scoped-count">Résultats dans votre périmètre : <strong data-mjl-scoped-count>'.($total === null ? 'Indisponible' : (int) $total).'</strong></p>';
	print '<div class="div-table-responsive-no-min mjl-dashboard-table mjl-operational-table"><table class="noborder centpercent" aria-label="Activités du périmètre">';
	print '<thead><tr class="liste_titre"><th>Activité</th><th>Statut</th><th>Projet</th><th>Échéance</th><th>Risque</th><th>Exécution</th><th>Prochaine action</th><th>Ouvrir</th></tr></thead><tbody>';
	foreach ($rows as $row) {
		$href = DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']);
		print '<tr class="oddeven">';
		print '<td data-label="Activité"><strong>'.dol_escape_htmltag($row['ref']).'</strong><br><span class="opacitymedium">'.dol_escape_htmltag($row['label']).'</span></td>';
		print '<td data-label="Statut">'.mjl_activities_status_badge($row['status']).'</td>';
		print '<td data-label="Projet">'.dol_escape_htmltag($row['project_ref']).'</td>';
		print '<td data-label="Échéance">'.dol_escape_htmltag(mjl_activities_format_date($row['date_end'])).'</td>';
		print '<td data-label="Risque">'.dol_escape_htmltag(mjl_activity_deadline_alert($row['date_end'], $row['status']) ?: 'Aucun').'</td>';
		print '<td data-label="Exécution">'.dol_escape_htmltag(mjl_activities_execution_summary($row)).'</td>';
		print '<td data-label="Prochaine action">'.dol_escape_htmltag(mjl_activities_next_action_label($row)).'</td>';
		print '<td data-label="Ouvrir"><a class="mjl-table-link" href="'.dol_escape_htmltag($href).'">Ouvrir</a></td>';
		print '</tr>';
	}
	if (empty($rows)) {
		$filtered = $filters['fail_closed'] || $filters['status'] !== '' || $filters['partner'] > 0 || $filters['project'] > 0 || $filters['risk'] !== 'all';
		$message = $filtered ? 'Aucune activité ne correspond aux filtres appliqués.' : 'Aucune activité dans votre périmètre pour le moment.';
		print '<tr class="oddeven mjl-table-empty-row"><td colspan="8">'.dol_escape_htmltag($message).'</td></tr>';
	}
	print '</tbody></table></div>';
	$hasPrevious = !$filters['fail_closed'] && (int) $filters['page'] > 1;
	$hasNext = !$filters['fail_closed'] && ($total === null ? $hasExtraRow : ((int) $filters['page'] * (int) $filters['page_size'] < (int) $total));
	print mjl_table_render_pagination(DOL_URL_ROOT.'/custom/mjlfinancement/activities.php', $filters, $total, $hasPrevious, $hasNext, 'activités');
	print '</section>';
}

function mjl_activities_list_fragments($filters)
{
	global $db, $conf;
	$from = ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$from .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$from .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$where = ' WHERE a.entity = '.((int) $conf->entity).mjl_activities_scope_sql('a');
	if (!empty($filters['fail_closed'])) return array('from' => $from, 'where' => $where.' AND 1 = 0');
	if ($filters['status'] !== '') $where .= ' AND a.status = '.((int) $filters['status']);
	if ((int) $filters['partner'] > 0) $where .= ' AND c.fk_soc = '.((int) $filters['partner']);
	if ((int) $filters['project'] > 0) $where .= ' AND a.fk_project = '.((int) $filters['project']);
	$today = $db->escape(date('Y-m-d'));
	$soon = $db->escape(date('Y-m-d', strtotime('+7 days')));
	$open = implode(',', array_map('intval', MjlActivity::openStatuses()));
	if ($filters['risk'] === 'overdue') $where .= " AND a.date_end < '".$today."' AND a.status IN (".$open.')';
	elseif ($filters['risk'] === 'soon') $where .= " AND a.date_end >= '".$today."' AND a.date_end <= '".$soon."' AND a.status IN (".$open.')';
	elseif ($filters['risk'] === 'none') $where .= " AND (a.date_end IS NULL OR a.date_end > '".$soon."' OR a.status NOT IN (".$open.'))';
	return array('from' => $from, 'where' => $where);
}

function mjl_activities_list_order_sql($sort)
{
	if ($sort === 'recent') return ' ORDER BY a.rowid DESC';
	if ($sort === 'deadline') return ' ORDER BY CASE WHEN a.date_end IS NULL THEN 1 ELSE 0 END, a.date_end ASC, a.rowid ASC';
	return " ORDER BY CASE WHEN a.date_end IS NOT NULL AND a.date_end < '".date('Y-m-d')."' THEN 0 WHEN a.date_end IS NOT NULL AND a.date_end <= '".date('Y-m-d', strtotime('+7 days'))."' THEN 1 ELSE 2 END, a.date_end ASC, a.rowid ASC";
}

function mjl_activities_render_list_filters($filters, $partnerOptions, $projectOptions)
{
	$partners = array('' => 'Tous les partenaires');
	foreach ($partnerOptions as $id => $option) {
		$label = is_array($option) ? $option['label'] : $option;
		$partners[(string) ((int) $id)] = $label;
	}
	$statuses = array('' => 'Tous les statuts');
	foreach (range(0, 9) as $status) {
		$statuses[(string) $status] = mjl_ui_activity_status($status)['label'];
	}
	$projects = array('' => 'Tous les projets');
	foreach ($projectOptions as $id => $option) {
		$label = is_array($option) ? $option['label'] : $option;
		$projects[(string) ((int) $id)] = $label;
	}
	print mjl_table_render_filter_bar(
		DOL_URL_ROOT.'/custom/mjlfinancement/activities.php',
		'activities',
		'activités',
		array(
			array('name' => 'partner', 'label' => 'Partenaire / Programme', 'value' => (string) $filters['partner'], 'default' => '', 'options' => $partners),
			array('name' => 'status', 'label' => 'Statut', 'value' => (string) $filters['status'], 'default' => '', 'options' => $statuses),
			array('name' => 'project', 'label' => 'Projet', 'value' => (string) $filters['project'], 'default' => '', 'options' => $projects),
			array('name' => 'risk', 'label' => 'Risque échéance', 'value' => (string) $filters['risk'], 'default' => 'all', 'options' => array('all' => 'Tous les risques', 'overdue' => 'Échéance dépassée', 'soon' => 'Échéance proche', 'none' => 'Sans risque d’échéance')),
			array('name' => 'sort', 'label' => 'Trier par', 'value' => (string) $filters['sort'], 'default' => 'priority', 'options' => array('priority' => 'Priorité', 'recent' => 'Plus récentes', 'deadline' => 'Échéance')),
		)
	);
}

function mjl_activities_error_context($action)
{
	global $conf, $user;
	return array('route' => 'activities', 'action' => $action, 'entity' => (int) $conf->entity, 'user_id' => (int) $user->id);
}

function mjl_activities_render_summary_card($row)
{
	$budget = mjl_activities_budget_summary((int) $row['rowid']);
	$status = mjl_ui_activity_status($row['status']);
	$risk = mjl_activity_deadline_alert($row['date_end'], $row['status']) ?: 'Aucune alerte';
	$items = array(
		array('label' => 'Statut', 'value' => $status['label'], 'tone' => $status['tone']),
		array('label' => 'Périmètre', 'value' => $row['project_ref'].' — '.$row['project_title'], 'tone' => 'info'),
		array('label' => 'Prochaine action', 'value' => mjl_activities_next_action_label($row), 'tone' => 'warning'),
		array('label' => 'Risque', 'value' => $risk, 'tone' => $risk === 'Aucune alerte' ? 'neutral' : 'danger'),
		array('label' => 'Preuve', 'value' => mjl_activities_evidence_label(mjl_activity_evidence_state((int) $row['rowid'], (int) $row['entity'])), 'tone' => 'neutral'),
		array('label' => 'Historique', 'value' => 'Décisions et commentaires disponibles ci-dessous', 'tone' => 'neutral'),
		array('label' => 'Enveloppe de financement', 'value' => $row['convention_ref'].' — '.$row['convention_title'], 'tone' => 'neutral'),
		array('label' => 'Responsable', 'value' => $row['responsible_login'] ?: $row['creator_login'], 'tone' => 'neutral'),
		array('label' => 'Échéance', 'value' => mjl_activities_format_date($row['date_end']), 'tone' => 'neutral'),
		array('label' => 'Exécution physique', 'value' => mjl_activities_execution_summary($row), 'tone' => 'neutral'),
		array('label' => 'Budget rattaché', 'value' => $budget['available'] ? $budget['count'].' ligne(s), '.$budget['amount_label'] : 'Indisponible', 'tone' => $budget['available'] ? 'neutral' : 'warning'),
	);
	if ((string) $row['execution_comment'] !== '') $items[] = array('label' => 'Commentaire d’exécution', 'value' => $row['execution_comment'], 'tone' => 'neutral');
	print mjl_journey_render_summary(array('title' => 'Synthèse de l’activité', 'description' => 'Statut, périmètre, prochaine action, risque, preuve et historique.', 'items' => $items));
}

function mjl_activities_render_decision_panel($row)
{
	print '<section class="mjl-activity-card mjl-activity-decision">';
	print '<div class="mjl-section-heading"><h2>Décision et correction</h2><p>Actions disponibles selon votre rôle et l’état actuel.</p></div>';
	$actions = mjl_activities_available_actions($row);
	if (empty($actions)) {
		print '<div class="mjl-empty-state">Aucune action directe n’est attendue de votre rôle pour cette activité.</div>';
		print '</section>';
		return;
	}
	foreach ($actions as $action => $meta) {
		if ($action === 'update') continue;
		if (in_array($action, mjl_activities_guarded_review_actions(), true)) {
			print '<a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']).'&amp;action='.dol_escape_htmltag($action).'">'.dol_escape_htmltag($meta['label']).'</a>';
			continue;
		}
		mjl_activities_render_decision_form($row, $action, $meta);
	}
	print '</section>';
}

function mjl_activities_render_update_form($row)
{
	$recovery = mjl_activities_recovery_for_action('update');
	$responsibleOptions = mjl_activities_options('responsible');
	$values = mjl_activity_recovery_restore_update_values($recovery['values'], $responsibleOptions);
	$prefix = 'mjl-activity-update-';
	$isRecovered = !empty($recovery['recovered']);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Informations de l’activité</h2><p>Les modifications restent soumises aux contrôles de périmètre et d’état.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'" data-mjl-validate data-mjl-form="activity-update" data-mjl-substantive'.($isRecovered ? ' data-mjl-recovered="true"' : '').'>';
	print mjl_activities_token_input().'<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($recovery['errors'], 'Corrigez les champs indiqués', $prefix, $isRecovered).'</div>';
	print mjl_form_field('label', 'Libellé', '<input required name="label" value="'.dol_escape_htmltag($values['label'] ?? $row['label']).'">', true, '', $recovery['errors']['label'] ?? '', $prefix);
	print mjl_form_field('fk_user_responsible', 'Responsable', mjl_activities_select('fk_user_responsible', $responsibleOptions, 0, 'Créateur par défaut', (int) ($values['fk_user_responsible'] ?? $row['fk_user_responsible'])), false, '', $recovery['errors']['fk_user_responsible'] ?? '', $prefix);
	print mjl_form_field('date_start', 'Début', '<input type="date" name="date_start" value="'.dol_escape_htmltag($values['date_start'] ?? substr((string) $row['date_start'], 0, 10)).'">', false, '', $recovery['errors']['date_start'] ?? '', $prefix);
	print mjl_form_field('date_end', 'Fin', '<input type="date" name="date_end" value="'.dol_escape_htmltag($values['date_end'] ?? substr((string) $row['date_end'], 0, 10)).'">', false, '', $recovery['errors']['date_end'] ?? '', $prefix);
	print mjl_form_field('comment', 'Motif de modification', '<textarea required name="comment">'.dol_escape_htmltag($values['comment'] ?? '').'</textarea>', true, '', $recovery['errors']['comment'] ?? '', $prefix);
	print '<div class="mjl-activity-form-actions"><button class="button" type="submit">Enregistrer la correction</button><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']).'">Annuler</a></div>';
	print '</form></section>';
}

function mjl_activities_render_decision_form($row, $action, $meta, $withCancel = false)
{
	$actionRecovery = mjl_activities_recovery_for_action($action);
	$isRecovered = !empty($actionRecovery['recovered']);
	$prefix = 'mjl-decision-'.preg_replace('/[^a-z0-9_-]/i', '', (string) $action).'-';
	print '<form class="mjl-activity-action-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'" data-mjl-validate data-mjl-form="activity-decision"'.($withCancel ? ' data-mjl-substantive' : '').($isRecovered ? ' data-mjl-recovered="true"' : '').'>';
	print mjl_activities_token_input().'<input type="hidden" name="action" value="'.dol_escape_htmltag($action).'"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($actionRecovery['errors'], 'Corrigez les champs indiqués', $prefix, $isRecovered).'</div>';
	print mjl_form_field('comment', $meta['comment'], '<textarea'.(!empty($meta['required']) ? ' required' : '').' name="comment">'.dol_escape_htmltag($actionRecovery['values']['comment'] ?? '').'</textarea>', !empty($meta['required']), '', $actionRecovery['errors']['comment'] ?? '', $prefix);
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="'.dol_escape_htmltag($meta['label']).'">';
	if ($withCancel) print '<a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']).'">Annuler</a>';
	print '</div></form>';
}

function mjl_activities_render_execution_panel($row)
{
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Exécution physique</h2><p>Avancement opérationnel séparé des décisions de validation.</p></div>';
	if (!mjl_activities_can_apply_action($row, 'update_execution')) {
		print '<div class="mjl-empty-state">Aucune mise à jour d’exécution disponible pour votre rôle ou l’état actuel.</div>';
		print '</section>';
		return;
	}
	print '<a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']).'&amp;action=update_execution">Mettre à jour l’exécution</a>';
	print '</section>';
}

function mjl_activities_render_execution_form($row)
{
	$recovery = mjl_activities_recovery_for_action('update_execution');
	$isRecovered = !empty($recovery['recovered']);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Exécution physique</h2><p>Avancement opérationnel séparé des décisions de validation.</p></div>';
	$responsibleOptions = mjl_activities_options('responsible');
	$prefix = 'mjl-execution-';
	print '<form class="mjl-activity-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'" data-mjl-validate data-mjl-form="activity-execution" data-mjl-substantive'.($isRecovered ? ' data-mjl-recovered="true"' : '').'>';
	print mjl_activities_token_input().'<input type="hidden" name="action" value="update_execution"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($recovery['errors'], 'Corrigez les champs indiqués', $prefix, $isRecovered).'</div>';
	print mjl_form_field('fk_user_responsible', 'Responsable', mjl_activities_select('fk_user_responsible', $responsibleOptions, 0, 'Créateur par défaut', (int) ($recovery['values']['fk_user_responsible'] ?? $row['fk_user_responsible'])), false, '', $recovery['errors']['fk_user_responsible'] ?? '', $prefix);
	print mjl_form_field('date_actual_start', 'Début réel', '<input type="date" name="date_actual_start" value="'.dol_escape_htmltag($recovery['values']['date_actual_start'] ?? substr((string) $row['date_actual_start'], 0, 10)).'">', false, '', $recovery['errors']['date_actual_start'] ?? '', $prefix);
	print mjl_form_field('date_actual_end', 'Fin réelle', '<input type="date" name="date_actual_end" value="'.dol_escape_htmltag($recovery['values']['date_actual_end'] ?? substr((string) $row['date_actual_end'], 0, 10)).'">', false, '', $recovery['errors']['date_actual_end'] ?? '', $prefix);
	print mjl_form_field('physical_execution_percent', 'Exécution physique (%)', '<input type="number" min="0" max="100" name="physical_execution_percent" aria-label="Exécution physique (%)" value="'.dol_escape_htmltag($recovery['values']['physical_execution_percent'] ?? (string) $row['physical_execution_percent']).'">', false, '', $recovery['errors']['physical_execution_percent'] ?? '', $prefix);
	print mjl_form_field('execution_status', 'Statut d’exécution', mjl_activities_execution_status_select('execution_status', $recovery['values']['execution_status'] ?? (string) $row['execution_status']), false, '', $recovery['errors']['execution_status'] ?? '', $prefix);
	print mjl_form_field('execution_comment', 'Commentaire d’exécution', '<textarea name="execution_comment" aria-label="Commentaire exécution">'.dol_escape_htmltag($recovery['values']['execution_comment'] ?? $row['execution_comment']).'</textarea>', false, '', $recovery['errors']['execution_comment'] ?? '', $prefix);
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Mettre à jour l’exécution"><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']).'">Annuler</a></div>';
	print '</form>';
	print '</section>';
}

function mjl_activities_render_document_checklist($activityId)
{
	$docs = mjl_activities_linked_expense_documents($activityId);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Pièces justificatives des dépenses liées</h2><p>État des pièces portées par les dépenses rattachées à cette activité.</p></div>';
	if (!$docs['available']) {
		print mjl_ui_system_state('unavailable', 'Documents liés indisponibles', 'Le récapitulatif des pièces justificatives ne peut pas être chargé pour le moment.');
		print '</section>';
		return;
	}
	print '<div class="mjl-document-summary">';
	print '<span>'.((int) $docs['total']).' dépense(s) liée(s)</span>';
	print '<span>'.((int) $docs['present']).' avec pièce</span>';
	print '<span>'.((int) $docs['missing']).' pièce(s) manquante(s)</span>';
	print '</div>';
	if (empty($docs['rows'])) {
		print '<div class="mjl-empty-state">Aucune dépense liée à cette activité.</div>';
	} else {
		print '<div class="div-table-responsive-no-min mjl-dashboard-table"><table class="noborder centpercent">';
		print '<tr class="liste_titre"><th>Dépense</th><th>Description</th><th>Statut</th><th>Pièce</th></tr>';
		foreach ($docs['rows'] as $row) {
			print '<tr class="oddeven"><td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']).'">'.dol_escape_htmltag($row['ref']).'</a></td><td>'.dol_escape_htmltag($row['description']).'</td><td>'.dol_escape_htmltag(mjl_expense_status_label_fr($row['status'])).'</td><td>'.((int) $row['document_present'] > 0 ? 'Pièce disponible' : 'Pièce manquante').'</td></tr>';
		}
		print '</table></div>';
	}
	print '<p><a class="mjl-card-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php">Ouvrir les dépenses</a></p>';
	print '</section>';
}

function mjl_activities_render_activity_document_panel($row, $withUploadAction = true)
{
	$state = mjl_activity_evidence_state((int) $row['rowid'], (int) $row['entity']);
	if (($GLOBALS['mjl_activity_document_state'] ?? '') === 'upload-failed' && mjl_activities_can_apply_action($row, 'upload')) $state = 'upload-failed';
	$documents = mjl_activity_document_download_rows((int) $row['rowid']);
	$modelDocuments = array();
	foreach ($documents as $document) $modelDocuments[] = array('label' => mjl_activity_document_display_filename($document), 'url' => '/custom/mjlfinancement/documentdownload.php?type=activity&id='.((int) $document['rowid']));
	print mjl_journey_render_document_panel(array(
		'title' => 'Documents de l’activité',
		'description' => 'Pièces opérationnelles accessibles uniquement par le téléchargement MJL gardé.',
		'state' => $state === 'present' ? 'downloadable' : $state,
		'state_label' => mjl_activities_evidence_label($state),
		'documents' => $modelDocuments,
	));
	if ($withUploadAction && mjl_activities_can_apply_action($row, 'upload')) {
		print '<p><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']).'&amp;action=upload">Ajouter un document</a></p>';
	}
}

function mjl_activities_render_timeline($activity)
{
	$result = mjl_activities_timeline_result($activity);
	$commentRecovery = mjl_activities_recovery_for_action('add_exchange');
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Historique de décision et commentaires</h2><p>Création, corrections, décisions et échanges contextualisés.</p></div>';
	mjl_timeline_render_comment_form('mjlfinancement_activity', (int) $activity['rowid'], DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $activity['rowid']), $commentRecovery);
	mjl_timeline_render($result, 'Aucun événement enregistré pour cette activité.');
	print '</section>';
}

function mjl_activities_options($type)
{
	global $db, $conf, $user;

	if ($type === 'partner') {
		$sql = 'SELECT rowid, nom FROM '.$db->prefix().'societe s WHERE s.entity = '.((int) $conf->entity).' AND s.status = 1'.mjl_scope_partner_sql_filter('s.rowid', $user).' ORDER BY s.nom, s.rowid';
	} elseif ($type === 'project') {
		$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'projet p WHERE p.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('p.fk_soc', $user).' ORDER BY p.ref';
	} elseif ($type === 'convention') {
		$sql = 'SELECT c.rowid, c.ref, c.title, c.fk_project, p.ref AS project_ref FROM '.$db->prefix().'mjlfinancement_convention c';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
		$sql .= ' WHERE c.entity = '.((int) $conf->entity).' AND c.status = '.MjlConvention::STATUS_ACTIVE.mjl_scope_partner_sql_filter('c.fk_soc', $user).' ORDER BY c.ref';
	} elseif ($type === 'task') {
		$sql = 'SELECT t.rowid, t.ref, t.label, t.fk_projet, p.ref AS project_ref FROM '.$db->prefix().'projet_task t';
		$sql .= ' INNER JOIN '.$db->prefix().'projet p ON p.rowid = t.fk_projet AND p.entity = t.entity';
		$sql .= ' WHERE t.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('p.fk_soc', $user).' ORDER BY p.ref, t.ref';
	} elseif ($type === 'responsible') {
		$sql = 'SELECT DISTINCT u.rowid, u.login, u.firstname, u.lastname FROM '.$db->prefix().'user u';
		$scopeIds = mjl_scope_user_soc_ids($user);
		if ($scopeIds !== null) {
			$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_user_soc_scope uscope ON uscope.entity = u.entity AND uscope.fk_user = u.rowid AND uscope.is_active = 1';
		}
		$sql .= ' WHERE u.entity = '.((int) $conf->entity).' AND u.statut = 1';
		if ($scopeIds !== null) {
			$sql .= ' AND (u.rowid = '.((int) $user->id);
			if (!empty($scopeIds)) {
				$sql .= ' OR uscope.fk_soc IN ('.implode(',', array_map('intval', $scopeIds)).')';
			}
			$sql .= ')';
		}
		$sql .= ' ORDER BY u.lastname, u.firstname, u.login';
	} else {
		return array();
	}

	$resql = $db->query($sql);
	if (!$resql) {
		if (!isset($GLOBALS['mjl_activities_option_errors'])) $GLOBALS['mjl_activities_option_errors'] = array();
		$GLOBALS['mjl_activities_option_errors'][$type] = true;
		mjl_ui_log_error('database', mjl_activities_error_context('options_'.$type), $db->lasterror());
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
		} else {
			if ($type === 'responsible') {
				$name = trim((string) $obj->firstname.' '.(string) $obj->lastname);
				$label = $name !== '' ? $name.' ('.$obj->login.')' : $obj->login;
			} else {
				$label = $obj->ref.' - '.$obj->label;
				if (!empty($obj->project_ref)) $label .= ' ('.$obj->project_ref.')';
			}
		}
		$options[(int) $obj->rowid] = array(
			'label' => $label,
			'project_id' => $type === 'convention' ? (int) $obj->fk_project : ($type === 'task' ? (int) $obj->fk_projet : 0),
		);
	}

	return $options;
}

function mjl_activities_select($name, $options, $required = 0, $emptyLabel = '', $selected = 0)
{
	$html = '<select name="'.dol_escape_htmltag($name).'"'.($required ? ' required' : '').'>';
	if ($emptyLabel !== '') {
		$html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	}
	foreach ($options as $value => $option) {
		$label = is_array($option) ? $option['label'] : $option;
		$projectId = is_array($option) && !empty($option['project_id']) ? (int) $option['project_id'] : 0;
		$html .= '<option value="'.((int) $value).'"';
		if ($projectId > 0) $html .= ' data-project-id="'.$projectId.'"';
		if ((int) $selected > 0 && (int) $value === (int) $selected) $html .= ' selected';
		$html .= '>'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_activities_execution_status_select($name, $selected)
{
	$options = mjl_activities_execution_status_options();
	$html = '<select name="'.dol_escape_htmltag($name).'">';
	foreach ($options as $value => $label) {
		$html .= '<option value="'.dol_escape_htmltag($value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_activities_execution_status_options()
{
	return array(
		'' => 'Non renseigné',
		'not_started' => 'Planifiée',
		'in_progress' => 'En cours',
		'completed' => 'Exécutée',
		'blocked' => 'Bloquée',
	);
}

function mjl_activities_execution_status_label($status)
{
	$status = (string) $status;
	if ($status === '') return 'Non renseigné';
	return mjl_status_presentation('activity_execution', $status, 'operational')['label'];
}

function mjl_activities_execution_summary($row)
{
	if (mjl_activity_deadline_alert($row['date_end'] ?? '', $row['status'] ?? 0) === 'Échéance dépassée') {
		return 'Échéance dépassée';
	}
	$percent = $row['physical_execution_percent'] === null || $row['physical_execution_percent'] === '' ? 'Non renseigné' : ((int) $row['physical_execution_percent']).'%';
	$statusCode = (string) ($row['execution_status'] ?? '');
	$status = mjl_activities_execution_status_label($statusCode);
	if ($statusCode === 'in_progress' && $row['physical_execution_percent'] !== null && $row['physical_execution_percent'] !== '' && (int) $row['physical_execution_percent'] > 0 && (int) $row['physical_execution_percent'] < 100) {
		$status = 'Partiellement exécutée';
	}
	if ($status === 'Non renseigné') {
		return $percent;
	}
	return $percent.' - '.$status;
}

function mjl_activities_budget_summary($activityId)
{
	global $db, $conf;

	$sql = 'SELECT COUNT(*) AS line_count, COALESCE(SUM(revised_budget), 0) AS amount';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line';
	$sql .= ' WHERE entity = '.((int) $conf->entity).' AND fk_mjl_activity = '.((int) $activityId);
	$resql = $db->query($sql);
	if (!$resql) {
		mjl_ui_log_error('database', mjl_activities_error_context('budget_summary') + array('object_type' => 'activity', 'object_id' => (int) $activityId), $db->lasterror());
		return array('available' => false, 'count' => null, 'amount' => null, 'amount_label' => 'Indisponible');
	}
	$obj = $db->fetch_object($resql);
	$amount = $obj ? (float) $obj->amount : 0;
	return array(
		'available' => true,
		'count' => $obj ? (int) $obj->line_count : 0,
		'amount' => $amount,
		'amount_label' => mjl_format_money($amount),
	);
}

function mjl_activities_fetch_detail($id)
{
	global $db, $conf;

	$sql = 'SELECT a.rowid, a.entity, a.ref, a.label, a.fk_user_creat, a.fk_user_responsible, a.date_creation, a.date_start, a.date_end, a.date_actual_start, a.date_actual_end, a.physical_execution_percent, a.execution_status, a.execution_comment, a.status,';
	$sql .= ' p.ref AS project_ref, p.title AS project_title, c.ref AS convention_ref, c.title AS convention_title, t.ref AS task_ref, t.label AS task_label, u.login AS creator_login, ru.login AS responsible_login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet_task t ON t.rowid = a.fk_task AND t.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = a.fk_user_creat AND u.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user ru ON ru.rowid = a.fk_user_responsible AND ru.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).' AND a.rowid = '.((int) $id);
	$resql = $db->query($sql);
	if (!$resql) {
		mjl_ui_log_error('database', mjl_activities_error_context('detail') + array('object_type' => 'activity', 'object_id' => (int) $id), $db->lasterror());
		mjl_feedback_add('activities:detail:'.((int) $id).':database', 'generic.database');
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_activities_available_actions($row)
{
	$actions = array();
	if (mjl_activities_can_apply_action($row, 'update')) $actions['update'] = array('label' => 'Modifier');
	if (mjl_activities_can_apply_action($row, 'submit')) $actions['submit'] = array('label' => 'Soumettre l activité', 'comment' => 'Commentaire de soumission', 'required' => false);
	if (mjl_activities_can_apply_action($row, 'correct')) $actions['correct'] = array('label' => 'Marquer corrigee', 'comment' => 'Commentaire de correction', 'required' => true);
	if (mjl_activities_can_apply_action($row, 'prevalidate')) $actions['prevalidate'] = array('label' => 'Prévalider l’activité', 'comment' => 'Commentaire de prévalidation', 'required' => false);
	if (mjl_activities_can_apply_action($row, 'final_validate')) $actions['final_validate'] = array('label' => 'Valider définitivement l’activité', 'comment' => 'Commentaire de validation définitive', 'required' => false);
	if (mjl_activities_can_apply_action($row, 'validate')) $actions['validate'] = array('label' => 'Valider l’activité', 'comment' => 'Commentaire de validation', 'required' => false);
	if (mjl_activities_can_apply_action($row, 'request_correction')) $actions['request_correction'] = array('label' => 'Retourner pour correction', 'comment' => 'Motif de correction', 'required' => true);
	if (mjl_activities_can_apply_action($row, 'reject')) $actions['reject'] = array('label' => 'Rejeter l’activité', 'comment' => 'Motif de rejet', 'required' => true);
	return $actions;
}

function mjl_activities_guarded_review_actions()
{
	return array('prevalidate', 'final_validate', 'validate', 'request_correction', 'reject');
}

function mjl_activities_scope_label()
{
	global $user;
	if (mjl_workspace_can_access_supervision($user)) return 'Portefeuille MJL';
	if (mjl_activities_is_level1_operational()) return 'Mes activités';
	if ($user->hasRight('mjlfinancement', 'activity', 'validate')) return 'File de validation';
	return 'Consultation';
}

function mjl_activities_linked_expense_documents($activityId)
{
	global $db, $conf;

	$sql = 'SELECT e.rowid, e.entity, e.ref, e.description, e.status, e.supporting_document, '.mjl_expense_document_present_sql('e').' AS document_present';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity).' AND e.fk_mjl_activity = '.((int) $activityId);
	$sql .= ' ORDER BY e.rowid DESC';
	$resql = $db->query($sql);
	$result = array('available' => true, 'total' => 0, 'present' => 0, 'missing' => 0, 'rows' => array());
	if (!$resql) {
		mjl_ui_log_error('database', mjl_activities_error_context('linked_expense_documents') + array('object_type' => 'activity', 'object_id' => (int) $activityId), $db->lasterror());
		return array('available' => false, 'total' => null, 'present' => null, 'missing' => null, 'rows' => array());
	}
	while ($obj = $db->fetch_object($resql)) {
		$row = (array) $obj;
		$row['document_present'] = mjl_expense_evidence_state((int) $row['rowid'], (int) $row['entity'], $row['supporting_document']) === 'downloadable' ? 1 : 0;
		$result['total']++;
		if ((int) $row['document_present'] > 0) $result['present']++;
		else $result['missing']++;
		$result['rows'][] = $row;
	}
	return $result;
}

function mjl_activities_timeline_items($activity)
{
	$result = mjl_activities_timeline_result($activity);
	return $result['items'];
}

function mjl_activities_timeline_result($activity)
{
	global $db, $conf;

	$creation = array(
		'source' => 'creation',
		'order' => 0,
		'errors' => array(),
		'items' => array(array(
			'rowid' => 0,
			'label' => 'Créée',
			'title' => 'Activité créée',
			'meta' => mjl_activities_format_datetime($activity['date_creation']).' par '.$activity['creator_login'],
			'comment' => '',
			'changes' => array(),
			'sort_date' => (string) $activity['date_creation'],
		)),
	);
	$sql = 'SELECT w.rowid, w.action, w.from_status, w.to_status, w.actor_role, w.action_date, w.comment, w.changes_json, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity).' AND w.object_type = \'mjlfinancement_activity\' AND w.object_id = '.((int) $activity['rowid']);
	$sql .= ' ORDER BY w.action_date ASC, w.rowid ASC';
	$resql = $db->query($sql);
	$workflow = array('source' => 'workflow', 'order' => 10, 'items' => array(), 'errors' => array());
	$documents = array('source' => 'documents', 'order' => 20, 'items' => array(), 'errors' => array());
	if (!$resql) {
		$workflow['errors'][] = 'database';
		$documents['errors'][] = 'database';
		mjl_ui_log_error('database', mjl_activities_error_context('timeline_workflow') + array('object_type' => 'activity', 'object_id' => (int) $activity['rowid']), $db->lasterror());
	} else {
		while ($row = $db->fetch_object($resql)) {
			$item = array(
				'rowid' => (int) $row->rowid,
				'label' => mjl_activity_action_label($row->action),
				'title' => mjl_activities_timeline_title($row->action, $row->from_status, $row->to_status),
				'meta' => mjl_activities_format_datetime($row->action_date).' par '.($row->login ?: 'système').' ('.mjl_activity_actor_role_label($row->actor_role, $row->action).')',
				'comment' => (string) $row->comment,
				'changes' => mjl_activities_timeline_changes($row->changes_json),
				'sort_date' => (string) $row->action_date,
			);
			if ((string) $row->action === 'document_uploaded') $documents['items'][] = $item;
			else $workflow['items'][] = $item;
		}
	}
	$comments = mjl_timeline_exchange_result('mjlfinancement_activity', (int) $activity['rowid'], true);
	return mjl_timeline_aggregate_sources(array($creation, $workflow, $documents, $comments), true);
}

function mjl_activities_timeline_changes($changesJson)
{
	$decoded = json_decode((string) $changesJson, true);
	if (!is_array($decoded)) return array();
	$allowed = array(
		'label' => 'Libellé',
		'date_start' => 'Date de début',
		'date_end' => 'Date de fin',
		'fk_user_responsible' => 'Responsable',
		'physical_execution_percent' => 'Exécution physique',
		'execution_status' => 'Statut d’exécution',
	);
	$changes = array();
	foreach ($allowed as $field => $label) {
		if (!isset($decoded[$field]) || !is_array($decoded[$field])) continue;
		$before = is_scalar($decoded[$field]['before'] ?? null) ? (string) $decoded[$field]['before'] : '';
		$after = is_scalar($decoded[$field]['after'] ?? null) ? (string) $decoded[$field]['after'] : '';
		if ($field === 'fk_user_responsible') {
			$before = mjl_activities_timeline_responsible_label($before);
			$after = mjl_activities_timeline_responsible_label($after);
		} elseif ($field === 'execution_status') {
			$before = mjl_activities_execution_status_label($before);
			$after = mjl_activities_execution_status_label($after);
		} elseif ($field === 'physical_execution_percent') {
			$before = $before === '' ? 'Non renseigné' : $before.' %';
			$after = $after === '' ? 'Non renseigné' : $after.' %';
		} elseif (in_array($field, array('date_start', 'date_end'), true)) {
			$before = $before === '' ? 'Non renseignée' : mjl_activities_format_date($before);
			$after = $after === '' ? 'Non renseignée' : mjl_activities_format_date($after);
		} else {
			$before = $before === '' ? 'Non renseigné' : $before;
			$after = $after === '' ? 'Non renseigné' : $after;
		}
		$changes[$label] = $before.' → '.$after;
	}
	return $changes;
}

function mjl_activities_timeline_responsible_label($userId)
{
	global $db, $conf;

	$userId = (int) $userId;
	if ($userId <= 0) return 'Non renseigné';
	$sql = 'SELECT login, firstname, lastname FROM '.$db->prefix().'user WHERE entity = '.((int) $conf->entity).' AND rowid = '.$userId;
	$resql = $db->query($sql);
	if (!$resql || !($row = $db->fetch_object($resql))) {
		if (!$resql) mjl_ui_log_error('database', mjl_activities_error_context('timeline_responsible'), $db->lasterror());
		return 'Utilisateur indisponible';
	}
	$name = trim((string) $row->firstname.' '.(string) $row->lastname);
	return $name !== '' ? $name.' ('.$row->login.')' : (string) $row->login;
}

function mjl_activities_next_action_label($row)
{
	$status = (int) $row['status'];
	if ($status === MjlActivity::STATUS_DRAFT) return 'Finaliser le brouillon puis soumettre l’activité.';
	if ($status === MjlActivity::STATUS_SUBMITTED) return 'Prévalidation attendue par un agent vérificateur.';
	if ($status === MjlActivity::STATUS_PREVALIDATED) return 'Validation définitive attendue.';
	if ($status === MjlActivity::STATUS_CORRECTION_REQUESTED) return 'Correction attendue par le créateur.';
	if ($status === MjlActivity::STATUS_CORRECTED) return 'Activité corrigée à resoumettre.';
	if ($status === MjlActivity::STATUS_VALIDATED) return 'Activité validée définitivement, aucune décision en attente.';
	if ($status === MjlActivity::STATUS_REJECTED) return 'Activité rejetée, consulter l’historique.';
	if ($status === MjlActivity::STATUS_COMPLETED) return 'Activité terminée.';
	if ($status === MjlActivity::STATUS_CANCELLED) return 'Activité annulée.';
	return 'Suivre l’avancement de l’activité.';
}

function mjl_activity_status_label($status)
{
	return mjl_activity_status_text($status);
}

function mjl_activity_status_text($status)
{
	return mjl_ui_activity_status($status)['label'];
}

function mjl_activity_action_label($action)
{
	return mjl_timeline_presentation_action_label('mjlfinancement_activity', $action);
}

function mjl_activities_timeline_title($action, $fromStatus, $toStatus)
{
	if ((string) $action === 'document_uploaded') {
		return 'Document ajouté à l’activité';
	}
	if ((string) $fromStatus === '' || (string) $toStatus === '' || (string) $fromStatus === (string) $toStatus) {
		return mjl_activity_action_label($action);
	}
	return mjl_activity_status_text($fromStatus).' vers '.mjl_activity_status_text($toStatus);
}

function mjl_activities_evidence_label($state)
{
	if ($state === 'downloadable') return 'Disponible';
	if ($state === 'upload-failed') return 'Échec de l’ajout';
	if ($state === 'unavailable') return 'Référence indisponible';
	return 'Manquante';
}

function mjl_activity_actor_role_label($role, $action = '')
{
	return mjl_timeline_presentation_actor_role_label('mjlfinancement_activity', $action, $role);
}

function mjl_expense_status_label_fr($status)
{
	return mjl_ui_expense_status($status)['label'];
}

function mjl_activities_status_badge($status)
{
	return mjl_ui_status_badge(mjl_ui_activity_status($status));
}

function mjl_activity_deadline_alert($dateEnd, $status)
{
	if (in_array((int) $status, MjlActivity::finalStatuses(), true) || empty($dateEnd)) {
		return '';
	}
	$end = strtotime((string) $dateEnd);
	if ($end <= 0) return '';
	$today = strtotime(date('Y-m-d'));
	if ($end < $today) return 'Échéance dépassée';
	if ($end <= strtotime('+7 days', $today)) return 'Échéance proche';
	return '';
}

function mjl_activities_format_date($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return mjl_format_date($value, 'date');
}

function mjl_activities_format_datetime($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return mjl_format_date($value, 'datetime');
}

function mjl_activities_post_date($field)
{
	$value = GETPOST($field, 'alphanohtml');
	return $value === '' ? null : strtotime($value);
}

function mjl_activities_token_input()
{
	global $mjl_activities_page_token;
	return '<input type="hidden" name="token" value="'.dol_escape_htmltag($mjl_activities_page_token).'">';
}

function mjl_activities_recovery_for_action($action)
{
	global $mjl_activity_recovery;
	$config = mjl_activity_recovery_config($action);
	if ($config === null || !is_array($mjl_activity_recovery)
		|| (string) ($mjl_activity_recovery['context']['form'] ?? '') !== (string) $config['form']
		|| (string) ($mjl_activity_recovery['context']['action'] ?? '') !== (string) $action) {
		return array('values' => array(), 'errors' => array(), 'action' => '', 'recovered' => false);
	}
	return array(
		'values' => (array) ($mjl_activity_recovery['values'] ?? array()),
		'errors' => (array) ($mjl_activity_recovery['errors'] ?? array()),
		'action' => (string) ($mjl_activity_recovery['context']['action'] ?? ''),
		'recovered' => true,
	);
}

function mjl_activities_store_recovery_config($action, $objectId, $errors, $safeAliases = array())
{
	$config = mjl_activity_recovery_config($action);
	if ($config === null) return '';
	return mjl_activities_store_recovery($config['form'], $action, $objectId, $config['fields'], $errors, $safeAliases);
}

function mjl_activities_validated_create_recovery_aliases($project, $convention, $task, $responsible)
{
	return mjl_activity_recovery_validated_create_aliases(
		(int) $project,
		(int) $convention,
		(int) $task,
		(int) $responsible,
		mjl_activities_options('project'),
		mjl_activities_options('convention'),
		mjl_activities_options('task'),
		mjl_activities_options('responsible')
	);
}

function mjl_activities_store_recovery($form, $action, $objectId, $allowedFields, $errors, $safeAliases = array())
{
	global $user, $conf;
	$values = array();
	foreach ((array) $allowedFields as $field) {
		if (array_key_exists($field, (array) $safeAliases) && is_scalar($safeAliases[$field])) {
			$values[$field] = (string) $safeAliases[$field];
		} elseif (!in_array($field, mjl_activity_recovery_alias_fields(), true)) {
			$values[$field] = GETPOST($field, in_array($field, array('label', 'execution_comment', 'comment', 'message'), true) ? 'restricthtml' : 'alphanohtml');
		}
	}
	$reason = '';
	$handle = mjl_form_recovery_store(array(
		'user_id' => (int) $user->id,
		'entity' => (int) $conf->entity,
		'route' => 'activities',
		'form' => $form,
		'action' => $action,
		'object_id' => (int) $objectId,
	), $values, $allowedFields, $reason, $errors);
	if ($handle === '' && $reason === 'capacity') {
		mjl_feedback_add('activities:recovery:'.((int) $objectId).':capacity', 'generic.recovery_unavailable');
	}
	return $handle;
}

function mjl_activities_redirect($id, $recoveryHandle = '', $presentationAction = '', $documentState = '')
{
	$url = DOL_URL_ROOT.'/custom/mjlfinancement/activities.php';
	$query = array();
	if ((int) $id > 0) $query['id'] = (int) $id;
	if ((string) $presentationAction !== '') $query['action'] = (string) $presentationAction;
	if ((string) $recoveryHandle !== '') $query['mjl_recovery'] = (string) $recoveryHandle;
	if (in_array((string) $documentState, array('upload-failed'), true)) $query['mjl_document_state'] = (string) $documentState;
	if (!empty($query)) $url .= '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986);
	header('Location: '.$url);
	exit;
}
