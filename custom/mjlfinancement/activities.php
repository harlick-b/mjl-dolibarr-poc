<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_integrity.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';

if (!mjl_workspace_can_access_activity($user)) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');
$action = GETPOST('action', 'alpha');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		mjl_activities_forbidden('Invalid security token');
	}
	if (!mjl_workspace_can_apply_activity_write($user) && in_array($action, array('create', 'update', 'submit', 'correct'), true)) {
		mjl_activities_forbidden();
	}
	if (!mjl_workspace_can_apply_activity_validation($user) && in_array($action, array('prevalidate', 'final_validate', 'validate', 'reject', 'request_correction'), true)) {
		mjl_activities_forbidden();
	}
	mjl_activities_handle_post($action);
}

$mjl_activities_page_token = function_exists('newToken') ? newToken() : '';
$activityId = GETPOSTINT('id');

llxHeader('', 'Activites MJL');
mjl_navigation_shell_start($user, 'activities');
print '<div class="mjl-workspace mjl-activity-workspace">';

if ($activityId > 0) {
	mjl_activities_render_detail($activityId);
} else {
	mjl_activities_render_list_page();
}

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_activities_handle_post($action)
{
	global $db, $user, $conf;

	if ($action === 'create') {
		$fkConvention = GETPOSTINT('fk_convention');
		if (!mjl_scope_can_access_object($user, 'mjlfinancement_convention', $fkConvention)) {
			mjl_activities_forbidden('Convention hors de votre perimetre');
		}
		$activity = new MjlActivity($db);
		$activity->entity = (int) $conf->entity;
		$activity->ref = GETPOST('ref', 'alphanohtml');
		$activity->label = GETPOST('label', 'restricthtml');
		$activity->fk_project = GETPOSTINT('fk_project');
		$activity->fk_convention = $fkConvention;
		$activity->fk_task = GETPOSTINT('fk_task');
		$activity->date_start = mjl_activities_post_date('date_start');
		$activity->date_end = mjl_activities_post_date('date_end');
		$activity->fk_user_responsible = GETPOSTINT('fk_user_responsible');
		$activity->date_actual_start = mjl_activities_post_date('date_actual_start');
		$activity->date_actual_end = mjl_activities_post_date('date_actual_end');
		$activity->physical_execution_percent = GETPOST('physical_execution_percent', 'alphanohtml');
		$activity->execution_status = GETPOST('execution_status', 'alpha');
		$activity->execution_comment = GETPOST('execution_comment', 'restricthtml');
		$activity->status = MjlActivity::STATUS_DRAFT;
		$activity->fk_user_creat = $user->id;
		$result = $activity->create($user);
		if ($result <= 0) {
			setEventMessages($activity->error ?: 'Creation activite refusee', null, 'errors');
			mjl_activities_redirect(0);
		}
		setEventMessages('Activite creee en brouillon', null, 'mesgs');
		mjl_activities_redirect((int) $result);
	}

	$id = GETPOSTINT('id');
	$activity = new MjlActivity($db);
	if ($id <= 0 || $activity->fetch($id) <= 0 || (int) $activity->entity !== (int) $conf->entity || !mjl_activities_can_open($activity)) {
		mjl_activities_forbidden('Activite introuvable ou hors de votre perimetre');
	}
	if (!mjl_activities_can_apply_action($activity, $action)) {
		mjl_activities_forbidden();
	}

	if ($action === 'update') $result = mjl_activities_update_for_correction($activity);
	elseif ($action === 'submit') $result = $activity->submit($user, GETPOST('comment', 'restricthtml'), 'AGENT');
	elseif ($action === 'request_correction') $result = $activity->requestCorrection($user, GETPOST('comment', 'restricthtml'), mjl_activities_actor_role_code());
	elseif ($action === 'correct') $result = $activity->correct($user, GETPOST('comment', 'restricthtml'), 'AGENT');
	elseif ($action === 'prevalidate') $result = $activity->prevalidate($user, GETPOST('comment', 'restricthtml'), 'AGENT_VERIFICATEUR');
	elseif ($action === 'final_validate') $result = $activity->finalValidate($user, GETPOST('comment', 'restricthtml'), 'VALIDATEUR_DEFINITIF');
	elseif ($action === 'validate') $result = $activity->validate($user, GETPOST('comment', 'restricthtml'), mjl_activities_actor_role_code());
	elseif ($action === 'reject') $result = $activity->reject($user, GETPOST('comment', 'restricthtml'), mjl_activities_actor_role_code());
	elseif ($action === 'upload') $result = mjl_activities_upload_document($activity);
	else mjl_activities_redirect($id);

	if ($result < 0) setEventMessages($activity->error ?: 'Action refusee', null, 'errors');
	elseif ($result === 0) setEventMessages('Aucun changement applique', null, 'warnings');
	else setEventMessages('Action enregistree', null, 'mesgs');
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
		'date_actual_start' => GETPOST('date_actual_start', 'alphanohtml'),
		'date_actual_end' => GETPOST('date_actual_end', 'alphanohtml'),
		'physical_execution_percent' => GETPOST('physical_execution_percent', 'alphanohtml'),
		'execution_status' => GETPOST('execution_status', 'alpha'),
		'execution_comment' => GETPOST('execution_comment', 'restricthtml'),
	), GETPOST('comment', 'restricthtml'), 'AGENT');
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
	$role = mjl_workspace_can_access_supervision($user) ? (!empty($user->admin) ? 'ADMIN' : 'DPAF') : 'AGENT';
	$statusLabel = mjl_activity_status_label($activity->status);
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
	print '<div class="mjl-workspace-header">';
	print '<div><p class="mjl-kicker">Activites</p><h1>Suivi des activites et decisions</h1>';
	print '<p class="mjl-header-copy">Consultez les activites de votre perimetre, ouvrez le detail et traitez les actions attendues.</p></div>';
	print '<div class="mjl-user-context"><span>Perimetre</span><strong>'.dol_escape_htmltag(mjl_activities_scope_label()).'</strong></div>';
	print '</div>';

	if (mjl_workspace_can_apply_activity_write($GLOBALS['user'])) {
		mjl_activities_create_form();
	}
	mjl_activities_list();
}

function mjl_activities_render_detail($id)
{
	$row = mjl_activities_fetch_detail($id);
	if (empty($row) || !mjl_activities_can_open($row)) {
		accessforbidden();
	}

	print '<p><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php">Retour aux activites</a></p>';
	print '<div class="mjl-workspace-header">';
	print '<div><p class="mjl-kicker">Activite</p><h1>'.dol_escape_htmltag($row['ref']).' - '.dol_escape_htmltag($row['label']).'</h1>';
	print '<p class="mjl-header-copy">'.dol_escape_htmltag(mjl_activities_next_action_label($row)).'</p></div>';
	print '<div class="mjl-user-context"><span>Statut</span><strong>'.dol_escape_htmltag(mjl_activity_status_label($row['status'])).'</strong></div>';
	print '</div>';

	print '<div class="mjl-activity-detail-grid">';
	mjl_activities_render_summary_card($row);
	mjl_activities_render_decision_panel($row);
	print '</div>';
	mjl_activities_render_activity_document_panel($row);
	mjl_activities_render_document_checklist((int) $row['rowid']);
	mjl_activities_render_timeline($row);
}

function mjl_activities_create_form()
{
	$projectOptions = mjl_activities_options('project');
	$conventionOptions = mjl_activities_options('convention');
	$taskOptions = mjl_activities_options('task');
	$responsibleOptions = mjl_activities_options('responsible');

	print '<section class="mjl-workspace-section mjl-activity-panel">';
	print '<div class="mjl-section-heading"><h2>Nouvelle activite</h2><p>Creer un brouillon rattache a un projet et une enveloppe de financement.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<input type="hidden" name="action" value="create">';
	print mjl_activities_token_input();
	print '<label>Reference<input required name="ref"></label>';
	print '<label>Libelle<input required name="label"></label>';
	print '<label>Projet'.mjl_activities_select('fk_project', $projectOptions, 1, 'Choisir').'</label>';
	print '<label>Enveloppe de financement'.mjl_activities_select('fk_convention', $conventionOptions, 1, 'Choisir').'</label>';
	print '<label>Tache projet'.mjl_activities_select('fk_task', $taskOptions, 0, 'Aucune').'</label>';
	print '<label>Responsable'.mjl_activities_select('fk_user_responsible', $responsibleOptions, 0, 'Createur par defaut').'</label>';
	print '<label>Debut<input type="date" name="date_start"></label>';
	print '<label>Fin<input type="date" name="date_end"></label>';
	print '<label>Debut reel<input type="date" name="date_actual_start"></label>';
	print '<label>Fin reelle<input type="date" name="date_actual_end"></label>';
	print '<label>Execution physique (%)<input type="number" min="0" max="100" name="physical_execution_percent"></label>';
	print '<label>Statut execution'.mjl_activities_execution_status_select('execution_status', '').'</label>';
	print '<label>Commentaire execution<textarea name="execution_comment"></textarea></label>';
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Creer l activite"></div>';
	print '</form>';
	print '<script src="'.DOL_URL_ROOT.'/custom/mjlfinancement/js/activities.js"></script>';
	print '</section>';
}

function mjl_activities_list()
{
	global $db, $conf;

	$sql = 'SELECT a.rowid, a.ref, a.label, a.fk_user_creat, a.fk_user_responsible, a.date_start, a.date_end, a.physical_execution_percent, a.execution_status, a.status, p.ref AS project_ref, c.ref AS convention_ref, u.login AS creator_login, ru.login AS responsible_login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = a.fk_user_creat';
	$sql .= ' LEFT JOIN '.$db->prefix().'user ru ON ru.rowid = a.fk_user_responsible';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).mjl_activities_scope_sql('a');
	$sql .= ' ORDER BY a.rowid DESC LIMIT 100';
	$resql = $db->query($sql);
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div>';
		return;
	}

	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Activites du perimetre</h2><p>Ouvrez une activite pour consulter le statut, les pieces liees et les decisions.</p></div>';
	print '<div class="div-table-responsive-no-min mjl-dashboard-table"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Activite</th><th>Projet</th><th>Enveloppe</th><th>Fin</th><th>Execution</th><th>Statut</th><th>Alerte</th><th>Responsable</th><th>Action attendue</th></tr>';
	$count = 0;
	while ($row = $db->fetch_object($resql)) {
		$count++;
		print '<tr class="oddeven">';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row->rowid).'">'.dol_escape_htmltag($row->ref).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($row->label).'</span></td>';
		print '<td>'.dol_escape_htmltag($row->project_ref).'</td>';
		print '<td>'.dol_escape_htmltag($row->convention_ref).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_activities_format_date($row->date_end)).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_activities_execution_summary((array) $row)).'</td>';
		print '<td>'.mjl_activities_status_badge($row->status).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_activity_deadline_alert($row->date_end, $row->status)).'</td>';
		print '<td>'.dol_escape_htmltag($row->responsible_login ?: $row->creator_login).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_activities_next_action_label((array) $row)).'</td>';
		print '</tr>';
	}
	if ($count === 0) {
		print '<tr class="oddeven"><td colspan="9">Aucune activite dans votre perimetre pour le moment.</td></tr>';
	}
	print '</table></div></section>';
}

function mjl_activities_render_summary_card($row)
{
	$budget = mjl_activities_budget_summary((int) $row['rowid']);
	print '<section class="mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Synthese de l activite</h2><p>Statut, rattachement et echeance visibles avant les details.</p></div>';
	print '<dl class="mjl-activity-meta">';
	print '<div><dt>Statut</dt><dd>'.mjl_activities_status_badge($row['status']).'</dd></div>';
	print '<div><dt>Action attendue</dt><dd>'.dol_escape_htmltag(mjl_activities_next_action_label($row)).'</dd></div>';
	print '<div><dt>Projet</dt><dd>'.dol_escape_htmltag($row['project_ref']).' - '.dol_escape_htmltag($row['project_title']).'</dd></div>';
	print '<div><dt>Enveloppe de financement</dt><dd>'.dol_escape_htmltag($row['convention_ref']).' - '.dol_escape_htmltag($row['convention_title']).'</dd></div>';
	print '<div><dt>Tache</dt><dd>'.dol_escape_htmltag($row['task_ref'] ?: 'Aucune').'</dd></div>';
	print '<div><dt>Createur</dt><dd>'.dol_escape_htmltag($row['creator_login']).'</dd></div>';
	print '<div><dt>Responsable</dt><dd>'.dol_escape_htmltag($row['responsible_login'] ?: $row['creator_login']).'</dd></div>';
	print '<div><dt>Debut</dt><dd>'.dol_escape_htmltag(mjl_activities_format_date($row['date_start'])).'</dd></div>';
	print '<div><dt>Fin</dt><dd>'.dol_escape_htmltag(mjl_activities_format_date($row['date_end'])).'</dd></div>';
	print '<div><dt>Debut reel</dt><dd>'.dol_escape_htmltag(mjl_activities_format_date($row['date_actual_start'])).'</dd></div>';
	print '<div><dt>Fin reelle</dt><dd>'.dol_escape_htmltag(mjl_activities_format_date($row['date_actual_end'])).'</dd></div>';
	print '<div><dt>Execution physique</dt><dd>'.dol_escape_htmltag(mjl_activities_execution_summary($row)).'</dd></div>';
	print '<div><dt>Budget rattache</dt><dd>'.dol_escape_htmltag($budget['count'].' ligne(s), '.$budget['amount_label']).'</dd></div>';
	print '<div><dt>Alerte</dt><dd>'.dol_escape_htmltag(mjl_activity_deadline_alert($row['date_end'], $row['status']) ?: 'Aucune alerte').'</dd></div>';
	if ((string) $row['execution_comment'] !== '') {
		print '<div><dt>Commentaire execution</dt><dd>'.dol_escape_htmltag($row['execution_comment']).'</dd></div>';
	}
	print '</dl></section>';
}

function mjl_activities_render_decision_panel($row)
{
	print '<section class="mjl-activity-card mjl-activity-decision">';
	print '<div class="mjl-section-heading"><h2>Decision et correction</h2><p>Actions disponibles selon votre role et l etat actuel.</p></div>';
	$actions = mjl_activities_available_actions($row);
	if (empty($actions)) {
		print '<div class="mjl-empty-state">Aucune action directe n est attendue de votre role pour cette activite.</div>';
		print '</section>';
		return;
	}
	if (!empty($actions['update'])) {
		$responsibleOptions = mjl_activities_options('responsible');
		print '<form class="mjl-activity-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'">';
		print mjl_activities_token_input().'<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
		print '<label>Libelle<input required name="label" value="'.dol_escape_htmltag($row['label']).'"></label>';
		print '<label>Responsable'.mjl_activities_select('fk_user_responsible', $responsibleOptions, 0, 'Createur par defaut', (int) $row['fk_user_responsible']).'</label>';
		print '<label>Debut<input type="date" name="date_start" value="'.dol_escape_htmltag(substr((string) $row['date_start'], 0, 10)).'"></label>';
		print '<label>Fin<input type="date" name="date_end" value="'.dol_escape_htmltag(substr((string) $row['date_end'], 0, 10)).'"></label>';
		print '<label>Debut reel<input type="date" name="date_actual_start" value="'.dol_escape_htmltag(substr((string) $row['date_actual_start'], 0, 10)).'"></label>';
		print '<label>Fin reelle<input type="date" name="date_actual_end" value="'.dol_escape_htmltag(substr((string) $row['date_actual_end'], 0, 10)).'"></label>';
		print '<label>Execution physique (%)<input type="number" min="0" max="100" name="physical_execution_percent" value="'.dol_escape_htmltag((string) $row['physical_execution_percent']).'"></label>';
		print '<label>Statut execution'.mjl_activities_execution_status_select('execution_status', (string) $row['execution_status']).'</label>';
		print '<label>Commentaire execution<textarea name="execution_comment">'.dol_escape_htmltag($row['execution_comment']).'</textarea></label>';
		print '<label>Motif de modification<input required name="comment"></label>';
		print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Enregistrer la correction"></div>';
		print '</form>';
	}
	foreach ($actions as $action => $meta) {
		if ($action === 'update') continue;
		print '<form class="mjl-activity-action-form" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'">';
		print mjl_activities_token_input().'<input type="hidden" name="action" value="'.dol_escape_htmltag($action).'"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
		print '<label>'.dol_escape_htmltag($meta['comment']).'<input'.(!empty($meta['required']) ? ' required' : '').' name="comment"></label>';
		print '<input class="button" type="submit" value="'.dol_escape_htmltag($meta['label']).'">';
		print '</form>';
	}
	print '</section>';
}

function mjl_activities_render_document_checklist($activityId)
{
	$docs = mjl_activities_linked_expense_documents($activityId);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Pieces justificatives des depenses liees</h2><p>Etat des pieces portees par les depenses rattachees a cette activite.</p></div>';
	print '<div class="mjl-document-summary">';
	print '<span>'.((int) $docs['total']).' depense(s) liee(s)</span>';
	print '<span>'.((int) $docs['present']).' avec piece</span>';
	print '<span>'.((int) $docs['missing']).' piece(s) manquante(s)</span>';
	print '</div>';
	if (empty($docs['rows'])) {
		print '<div class="mjl-empty-state">Aucune depense liee a cette activite.</div>';
	} else {
		print '<div class="div-table-responsive-no-min mjl-dashboard-table"><table class="noborder centpercent">';
		print '<tr class="liste_titre"><th>Depense</th><th>Description</th><th>Statut</th><th>Piece</th></tr>';
		foreach ($docs['rows'] as $row) {
			print '<tr class="oddeven"><td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php?id='.((int) $row['rowid']).'">'.dol_escape_htmltag($row['ref']).'</a></td><td>'.dol_escape_htmltag($row['description']).'</td><td>'.dol_escape_htmltag(mjl_expense_status_label_fr($row['status'])).'</td><td>'.((int) $row['document_present'] > 0 ? 'Piece disponible' : 'Piece manquante').'</td></tr>';
		}
		print '</table></div>';
	}
	print '<p><a class="mjl-card-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/expenses.php">Ouvrir les depenses</a></p>';
	print '</section>';
}

function mjl_activities_render_activity_document_panel($row)
{
	$state = mjl_activity_evidence_state((int) $row['rowid'], (int) $row['entity']);
	$documents = mjl_activity_document_download_rows((int) $row['rowid']);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Documents de l activite</h2><p>Pieces operationnelles rattachees directement a cette activite dans ECM.</p></div>';
	print '<div class="mjl-document-summary mjl-document-summary-'.$state.'">';
	print '<span>'.dol_escape_htmltag(mjl_activities_evidence_label($state)).'</span>';
	print '<span>'.dol_escape_htmltag(!empty($documents) ? mjl_activity_document_display_filename($documents[0]) : 'Aucun fichier detecte').'</span>';
	print '</div>';
	if ($state === 'unavailable') {
		print '<div class="mjl-empty-state mjl-empty-state-warning">Reference ECM presente, mais aucun fichier telechargeable n est disponible.</div>';
	} elseif ($state === 'missing') {
		print '<div class="mjl-empty-state">Aucun document direct n est rattache a cette activite.</div>';
	}
	if (!empty($documents)) {
		print '<div class="mjl-document-list">';
		foreach ($documents as $document) {
			$label = mjl_activity_document_display_filename($document);
			print '<div class="mjl-document-row">';
			print '<span>'.dol_escape_htmltag($label).'</span>';
			print '<a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/documentdownload.php?type=activity&id='.((int) $document['rowid']).'">Telecharger le document</a>';
			print '</div>';
		}
		print '</div>';
	}
	if (mjl_activities_can_apply_action($row, 'upload')) {
		print '<form class="mjl-activity-action-form" enctype="multipart/form-data" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'?id='.((int) $row['rowid']).'">';
		print mjl_activities_token_input().'<input type="hidden" name="action" value="upload"><input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
		print '<label>Document activite<input required type="file" name="supporting_document"></label>';
		print '<input class="button" type="submit" value="Ajouter le document">';
		print '</form>';
	}
	print '</section>';
}

function mjl_activities_render_timeline($activity)
{
	$items = mjl_activities_timeline_items($activity);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Historique de decision</h2><p>Creation, corrections et decisions conservees dans la trace workflow.</p></div>';
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

function mjl_activities_options($type)
{
	global $db, $conf;

	if ($type === 'project') {
		$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' ORDER BY ref';
	} elseif ($type === 'convention') {
		$sql = 'SELECT c.rowid, c.ref, c.title, c.fk_project, p.ref AS project_ref FROM '.$db->prefix().'mjlfinancement_convention c';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project';
		$sql .= ' WHERE c.entity = '.((int) $conf->entity).' AND c.status = '.MjlConvention::STATUS_ACTIVE.' ORDER BY c.ref';
	} elseif ($type === 'task') {
		$sql = 'SELECT t.rowid, t.ref, t.label, t.fk_projet, p.ref AS project_ref FROM '.$db->prefix().'projet_task t';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = t.fk_projet';
		$sql .= ' WHERE t.entity = '.((int) $conf->entity).' ORDER BY p.ref, t.ref';
	} elseif ($type === 'responsible') {
		$sql = 'SELECT rowid, login, firstname, lastname FROM '.$db->prefix().'user WHERE entity = '.((int) $conf->entity).' AND statut = 1 ORDER BY lastname, firstname, login';
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
	$options = array(
		'' => 'Non renseigne',
		'not_started' => 'Non demarree',
		'in_progress' => 'En cours',
		'completed' => 'Terminee',
		'blocked' => 'Bloquee',
	);
	$html = '<select name="'.dol_escape_htmltag($name).'">';
	foreach ($options as $value => $label) {
		$html .= '<option value="'.dol_escape_htmltag($value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_activities_execution_status_label($status)
{
	$map = array(
		'' => 'Non renseigne',
		'not_started' => 'Non demarree',
		'in_progress' => 'En cours',
		'completed' => 'Terminee',
		'blocked' => 'Bloquee',
	);
	$status = (string) $status;
	return isset($map[$status]) ? $map[$status] : $status;
}

function mjl_activities_execution_summary($row)
{
	$percent = $row['physical_execution_percent'] === null || $row['physical_execution_percent'] === '' ? 'Non renseigne' : ((int) $row['physical_execution_percent']).'%';
	$status = mjl_activities_execution_status_label($row['execution_status'] ?? '');
	if ($status === 'Non renseigne') {
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
		return array('count' => 0, 'amount' => 0, 'amount_label' => price(0));
	}
	$obj = $db->fetch_object($resql);
	$amount = $obj ? (float) $obj->amount : 0;
	return array(
		'count' => $obj ? (int) $obj->line_count : 0,
		'amount' => $amount,
		'amount_label' => price($amount),
	);
}

function mjl_activities_fetch_detail($id)
{
	global $db, $conf;

	$sql = 'SELECT a.rowid, a.entity, a.ref, a.label, a.fk_user_creat, a.fk_user_responsible, a.date_creation, a.date_start, a.date_end, a.date_actual_start, a.date_actual_end, a.physical_execution_percent, a.execution_status, a.execution_comment, a.status,';
	$sql .= ' p.ref AS project_ref, p.title AS project_title, c.ref AS convention_ref, c.title AS convention_title, t.ref AS task_ref, t.label AS task_label, u.login AS creator_login, ru.login AS responsible_login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet_task t ON t.rowid = a.fk_task';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = a.fk_user_creat';
	$sql .= ' LEFT JOIN '.$db->prefix().'user ru ON ru.rowid = a.fk_user_responsible';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).' AND a.rowid = '.((int) $id);
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_activities_available_actions($row)
{
	$actions = array();
	if (mjl_activities_can_apply_action($row, 'update')) $actions['update'] = array('label' => 'Modifier');
	if (mjl_activities_can_apply_action($row, 'submit')) $actions['submit'] = array('label' => 'Soumettre l activite', 'comment' => 'Commentaire de soumission', 'required' => false);
	if (mjl_activities_can_apply_action($row, 'correct')) $actions['correct'] = array('label' => 'Marquer corrigee', 'comment' => 'Commentaire de correction', 'required' => true);
	if (mjl_activities_can_apply_action($row, 'prevalidate')) $actions['prevalidate'] = array('label' => 'Prevalider l activite', 'comment' => 'Commentaire de prevalidation', 'required' => false);
	if (mjl_activities_can_apply_action($row, 'final_validate')) $actions['final_validate'] = array('label' => 'Validation definitive', 'comment' => 'Commentaire de validation definitive', 'required' => false);
	if (mjl_activities_can_apply_action($row, 'validate')) $actions['validate'] = array('label' => 'Valider l activite', 'comment' => 'Commentaire de validation', 'required' => false);
	if (mjl_activities_can_apply_action($row, 'request_correction')) $actions['request_correction'] = array('label' => 'Retourner pour correction', 'comment' => 'Motif de correction', 'required' => true);
	if (mjl_activities_can_apply_action($row, 'reject')) $actions['reject'] = array('label' => 'Rejeter l activite', 'comment' => 'Motif de rejet', 'required' => true);
	return $actions;
}

function mjl_activities_scope_label()
{
	global $user;
	if (mjl_workspace_can_access_supervision($user)) return 'Portefeuille MJL';
	if (mjl_activities_is_level1_operational()) return 'Mes activites';
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
	$result = array('total' => 0, 'present' => 0, 'missing' => 0, 'rows' => array());
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return $result;
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
	global $db, $conf;

	$items = array(array(
		'label' => 'Creee',
		'title' => 'Activite creee',
		'meta' => mjl_activities_format_datetime($activity['date_creation']).' par '.$activity['creator_login'],
		'comment' => '',
	));
	$sql = 'SELECT w.action, w.from_status, w.to_status, w.actor_role, w.action_date, w.comment, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity).' AND w.object_type = \'mjlfinancement_activity\' AND w.object_id = '.((int) $activity['rowid']);
	$sql .= ' ORDER BY w.action_date ASC, w.rowid ASC';
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return $items;
	}
	while ($row = $db->fetch_object($resql)) {
		$items[] = array(
			'label' => mjl_activity_action_label($row->action),
			'title' => mjl_activities_timeline_title($row->action, $row->from_status, $row->to_status),
			'meta' => mjl_activities_format_datetime($row->action_date).' par '.$row->login.' ('.mjl_activity_actor_role_label($row->actor_role).')',
			'comment' => (string) $row->comment,
		);
	}
	return $items;
}

function mjl_activities_next_action_label($row)
{
	$status = (int) $row['status'];
	if ($status === MjlActivity::STATUS_DRAFT) return 'Finaliser le brouillon puis soumettre l activite.';
	if ($status === MjlActivity::STATUS_SUBMITTED) return 'Prevalidation attendue par un agent verificateur.';
	if ($status === MjlActivity::STATUS_PREVALIDATED) return 'Validation definitive attendue.';
	if ($status === MjlActivity::STATUS_CORRECTION_REQUESTED) return 'Correction attendue par le createur.';
	if ($status === MjlActivity::STATUS_CORRECTED) return 'Activite corrigee a resoumettre.';
	if ($status === MjlActivity::STATUS_VALIDATED) return 'Activite validee definitivement, aucune decision en attente.';
	if ($status === MjlActivity::STATUS_REJECTED) return 'Activite rejetee, consulter l historique.';
	if ($status === MjlActivity::STATUS_COMPLETED) return 'Activite terminee.';
	if ($status === MjlActivity::STATUS_CANCELLED) return 'Activite annulee.';
	return 'Suivre l avancement de l activite.';
}

function mjl_activity_status_label($status)
{
	return mjl_activity_status_text($status);
}

function mjl_activity_status_text($status)
{
	$map = array(
		(string) MjlActivity::STATUS_DRAFT => 'Brouillon',
		(string) MjlActivity::STATUS_ONGOING => 'En cours',
		(string) MjlActivity::STATUS_COMPLETED => 'Terminee',
		(string) MjlActivity::STATUS_SUBMITTED => 'Soumise',
		(string) MjlActivity::STATUS_CORRECTION_REQUESTED => 'Correction demandee',
		(string) MjlActivity::STATUS_CORRECTED => 'Corrigee',
		(string) MjlActivity::STATUS_VALIDATED => 'Validee definitivement',
		(string) MjlActivity::STATUS_PREVALIDATED => 'Prevalidee',
		(string) MjlActivity::STATUS_REJECTED => 'Rejetee',
		(string) MjlActivity::STATUS_CANCELLED => 'Annulee',
		'draft' => 'Brouillon',
		'ongoing' => 'En cours',
		'completed' => 'Terminee',
		'submitted' => 'Soumise',
		'correction_requested' => 'Correction demandee',
		'corrected' => 'Corrigee',
		'validated' => 'Validee definitivement',
		'prevalidated' => 'Prevalidee',
		'final_validated' => 'Validee definitivement',
		'rejected' => 'Rejetee',
		'cancelled' => 'Annulee',
	);
	$key = (string) $status;
	return isset($map[$key]) ? $map[$key] : $key;
}

function mjl_activity_action_label($action)
{
	$map = array(
		'field_changed' => 'Modification',
		'document_uploaded' => 'Document ajoute',
		'submitted' => 'Soumission',
		'correction_requested' => 'Correction demandee',
		'corrected' => 'Correction',
		'prevalidated' => 'Prevalidation',
		'validated' => 'Validation definitive',
		'final_validated' => 'Validation definitive',
		'rejected' => 'Rejet',
	);
	return isset($map[$action]) ? $map[$action] : (string) $action;
}

function mjl_activities_timeline_title($action, $fromStatus, $toStatus)
{
	if ((string) $action === 'document_uploaded') {
		return 'Document ajoute a l activite';
	}
	if ((string) $fromStatus === '' || (string) $toStatus === '' || (string) $fromStatus === (string) $toStatus) {
		return mjl_activity_action_label($action);
	}
	return mjl_activity_status_text($fromStatus).' vers '.mjl_activity_status_text($toStatus);
}

function mjl_activities_evidence_label($state)
{
	if ($state === 'downloadable') return 'Disponible';
	if ($state === 'unavailable') return 'Référence indisponible';
	return 'Manquante';
}

function mjl_activity_actor_role_label($role)
{
	$map = array(
		'AGENT' => 'Agent de saisie',
		'AGENT_SAISIE' => 'Agent de saisie',
		'SUPERVISEUR_N1' => 'Agent verificateur',
		'AGENT_VERIFICATEUR' => 'Agent verificateur',
		'DPAF' => 'Validateur definitif',
		'VALIDATEUR_DEFINITIF' => 'Validateur definitif',
		'ADMIN' => 'Administrateur plateforme',
		'ADMIN_PLATEFORME' => 'Administrateur plateforme',
	);
	return isset($map[$role]) ? $map[$role] : (string) $role;
}

function mjl_expense_status_label_fr($status)
{
	$map = array(0 => 'Brouillon', 1 => 'Soumise', 2 => 'Validee', 3 => 'Corrigee', 8 => 'Rejetee');
	return isset($map[(int) $status]) ? $map[(int) $status] : (string) $status;
}

function mjl_activities_status_badge($status)
{
	$tone = in_array((int) $status, array(MjlActivity::STATUS_SUBMITTED, MjlActivity::STATUS_PREVALIDATED, MjlActivity::STATUS_CORRECTION_REQUESTED, MjlActivity::STATUS_CORRECTED), true) ? 'warning' : 'neutral';
	if ((int) $status === MjlActivity::STATUS_REJECTED) $tone = 'danger';
	if ((int) $status === MjlActivity::STATUS_VALIDATED || (int) $status === MjlActivity::STATUS_COMPLETED) $tone = 'success';
	return '<span class="mjl-status-pill'.($tone !== 'neutral' ? ' mjl-status-'.$tone : '').'">'.dol_escape_htmltag(mjl_activity_status_label($status)).'</span>';
}

function mjl_activity_deadline_alert($dateEnd, $status)
{
	if (in_array((int) $status, MjlActivity::finalStatuses(), true) || empty($dateEnd)) {
		return '';
	}
	$end = strtotime((string) $dateEnd);
	if ($end <= 0) return '';
	$today = strtotime(date('Y-m-d'));
	if ($end < $today) return 'En retard';
	if ($end <= strtotime('+7 days', $today)) return 'Echeance proche';
	return '';
}

function mjl_activities_format_date($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'day') : (string) $value;
}

function mjl_activities_format_datetime($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'dayhour') : (string) $value;
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

function mjl_activities_redirect($id)
{
	$url = DOL_URL_ROOT.'/custom/mjlfinancement/activities.php';
	if ((int) $id > 0) $url .= '?id='.((int) $id);
	header('Location: '.$url);
	exit;
}
