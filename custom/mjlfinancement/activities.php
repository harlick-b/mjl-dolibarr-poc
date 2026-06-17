<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';

if (!$user->hasRight('mjlfinancement', 'activity', 'read')) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');
$action = GETPOST('action', 'alpha');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		accessforbidden('Invalid security token');
	}
	if (!$user->hasRight('mjlfinancement', 'activity', 'write') && in_array($action, array('create', 'update', 'submit', 'correct'), true)) {
		accessforbidden();
	}
	if (!$user->hasRight('mjlfinancement', 'activity', 'validate') && in_array($action, array('validate', 'reject', 'request_correction'), true)) {
		accessforbidden();
	}
	mjl_activities_handle_post($action);
}

$mjl_activities_page_token = function_exists('newToken') ? newToken() : '';

llxHeader('', 'Activites MJL');
print load_fiche_titre('Activites MJL', '', 'projecttask');

if ($user->hasRight('mjlfinancement', 'activity', 'write')) {
	mjl_activities_create_form();
}

mjl_activities_list();
mjl_activities_workflow_history();

llxFooter();
$db->close();

function mjl_activities_handle_post($action)
{
	global $db, $user, $conf;

	if ($action === 'create') {
		$activity = new MjlActivity($db);
		$activity->entity = (int) $conf->entity;
		$activity->ref = GETPOST('ref', 'alphanohtml');
		$activity->label = GETPOST('label', 'restricthtml');
		$activity->fk_project = GETPOSTINT('fk_project');
		$activity->fk_convention = GETPOSTINT('fk_convention');
		$activity->fk_task = GETPOSTINT('fk_task');
		$activity->date_start = mjl_activities_post_date('date_start');
		$activity->date_end = mjl_activities_post_date('date_end');
		$activity->status = MjlActivity::STATUS_DRAFT;
		$activity->fk_user_creat = $user->id;
		if ($activity->create($user) <= 0) setEventMessages($activity->error ?: 'Creation activite refusee', null, 'errors');
		else setEventMessages('Activite creee en brouillon', null, 'mesgs');
		return;
	}

	$id = GETPOSTINT('id');
	$activity = new MjlActivity($db);
	if ($id <= 0 || $activity->fetch($id) <= 0) {
		setEventMessages('Activite introuvable', null, 'errors');
		return;
	}
	if ((int) $activity->entity !== (int) $conf->entity) {
		setEventMessages('Activite introuvable dans l\'entite active', null, 'errors');
		return;
	}

	if ($action === 'update') $result = mjl_activities_update_for_correction($activity);
	elseif ($action === 'submit') $result = $activity->submit($user, GETPOST('comment', 'restricthtml'), 'AGENT');
	elseif ($action === 'request_correction') $result = $activity->requestCorrection($user, GETPOST('comment', 'restricthtml'), 'SUPERVISEUR_N1');
	elseif ($action === 'correct') $result = $activity->correct($user, GETPOST('comment', 'restricthtml'), 'AGENT');
	elseif ($action === 'validate') $result = $activity->validate($user, GETPOST('comment', 'restricthtml'), 'SUPERVISEUR_N1');
	elseif ($action === 'reject') $result = $activity->reject($user, GETPOST('comment', 'restricthtml'), 'SUPERVISEUR_N1');
	else return;

	if ($result < 0) setEventMessages($activity->error ?: 'Action refusee', null, 'errors');
	elseif ($result === 0) setEventMessages('Aucun changement applique', null, 'warnings');
	else setEventMessages('Action enregistree', null, 'mesgs');
}

function mjl_activities_update_for_correction(MjlActivity $activity)
{
	global $user;

	if (!$user->hasRight('mjlfinancement', 'activity', 'write')) {
		$activity->error = 'Permission denied for activity update';
		return -1;
	}
	if (!in_array((int) $activity->status, array(MjlActivity::STATUS_DRAFT, MjlActivity::STATUS_CORRECTION_REQUESTED), true)) {
		$activity->error = 'Only draft or correction-requested activities can be edited through this action';
		return -1;
	}

	$label = GETPOST('label', 'restricthtml');
	if ($label !== '') {
		$activity->label = $label;
	}
	$dateStart = GETPOST('date_start', 'alphanohtml');
	if ($dateStart !== '') {
		$activity->date_start = strtotime($dateStart);
	}
	$dateEnd = GETPOST('date_end', 'alphanohtml');
	$comment = GETPOST('comment', 'restricthtml');
	return $activity->updateImportantFields($user, array(
		'label' => $label,
		'date_start' => $dateStart,
		'date_end' => $dateEnd,
	), $comment, 'AGENT');
}

function mjl_activities_create_form()
{
	$projectOptions = mjl_activities_options('project');
	$conventionOptions = mjl_activities_options('convention');
	$taskOptions = mjl_activities_options('task');

	print '<form method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<input type="hidden" name="action" value="create">';
	print mjl_activities_token_input();
	print '<table class="border centpercent">';
	print '<tr class="liste_titre"><th colspan="6">Nouvelle activite</th></tr>';
	print '<tr><td>Ref</td><td><input required name="ref"></td><td>Libelle</td><td><input required class="minwidth300" name="label"></td><td>Tache projet</td><td>'.mjl_activities_select('fk_task', $taskOptions, 0, 'Aucune').'</td></tr>';
	print '<tr><td>Projet</td><td>'.mjl_activities_select('fk_project', $projectOptions, 1, 'Choisir').'</td><td>Convention</td><td>'.mjl_activities_select('fk_convention', $conventionOptions, 1, 'Choisir').'</td><td></td><td></td></tr>';
	print '<tr><td>Debut</td><td><input type="date" name="date_start"></td><td>Fin</td><td><input type="date" name="date_end"></td><td colspan="2" class="right"><input class="button" type="submit" value="Creer"></td></tr>';
	print '</table></form><br>';
}

function mjl_activities_options($type)
{
	global $db, $conf;

	if ($type === 'project') {
		$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' ORDER BY ref';
	} elseif ($type === 'convention') {
		$sql = 'SELECT c.rowid, c.ref, c.title, p.ref AS project_ref FROM '.$db->prefix().'mjlfinancement_convention c';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project';
		$sql .= ' WHERE c.entity = '.((int) $conf->entity).' ORDER BY c.ref';
	} elseif ($type === 'task') {
		$sql = 'SELECT t.rowid, t.ref, t.label, p.ref AS project_ref FROM '.$db->prefix().'projet_task t';
		$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = t.fk_projet';
		$sql .= ' WHERE t.entity = '.((int) $conf->entity).' ORDER BY p.ref, t.ref';
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
			if (!empty($obj->project_ref)) {
				$label .= ' ('.$obj->project_ref.')';
			}
		} else {
			$label = $obj->ref.' - '.$obj->label;
			if (!empty($obj->project_ref)) {
				$label .= ' ('.$obj->project_ref.')';
			}
		}
		$options[(int) $obj->rowid] = $label;
	}

	return $options;
}

function mjl_activities_select($name, $options, $required = 0, $emptyLabel = '')
{
	$html = '<select name="'.dol_escape_htmltag($name).'"'.($required ? ' required' : '').'>';
	if ($emptyLabel !== '') {
		$html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	}
	foreach ($options as $value => $label) {
		$html .= '<option value="'.((int) $value).'">'.dol_escape_htmltag($label).'</option>';
	}
	$html .= '</select>';

	return $html;
}

function mjl_activities_list()
{
	global $db, $conf;

	$sql = 'SELECT a.rowid, a.ref, a.label, a.fk_user_creat, a.date_start, a.date_end, a.status, p.ref AS project_ref, c.ref AS convention_ref, u.login AS creator_login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = a.fk_user_creat';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity);
	$sql .= ' ORDER BY a.rowid DESC LIMIT 100';
	$resql = $db->query($sql);
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div>';
		return;
	}

	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Ref</th><th>Libelle</th><th>Projet</th><th>Convention</th><th>Debut</th><th>Fin</th><th>Statut</th><th>Alerte</th><th>Createur</th><th>Actions</th></tr>';
	while ($row = $db->fetch_object($resql)) {
		print '<tr class="oddeven">';
		print '<td>'.dol_escape_htmltag($row->ref).'</td>';
		print '<td>'.dol_escape_htmltag($row->label).'</td>';
		print '<td>'.dol_escape_htmltag($row->project_ref).'</td>';
		print '<td>'.dol_escape_htmltag($row->convention_ref).'</td>';
		print '<td>'.dol_escape_htmltag($row->date_start).'</td>';
		print '<td>'.dol_escape_htmltag($row->date_end).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_activity_status_label($row->status)).'</td>';
		print '<td>'.dol_escape_htmltag(mjl_activity_deadline_alert($row->date_end, $row->status)).'</td>';
		print '<td>'.dol_escape_htmltag($row->creator_login).'</td>';
		print '<td>';
		mjl_activities_action_forms($row);
		print '</td></tr>';
	}
	print '</table></div>';
}

function mjl_activities_action_forms($row)
{
	global $user;

	$id = (int) $row->rowid;
	$status = (int) $row->status;
	if ($user->hasRight('mjlfinancement', 'activity', 'write') && in_array($status, array(MjlActivity::STATUS_DRAFT, MjlActivity::STATUS_CORRECTION_REQUESTED), true)) {
		print mjl_activities_edit_form($row);
	}
	if ($user->hasRight('mjlfinancement', 'activity', 'write') && in_array($status, array(MjlActivity::STATUS_DRAFT, MjlActivity::STATUS_CORRECTED), true)) {
		print mjl_activities_comment_form($id, 'submit', 'Soumettre', 'Commentaire');
	}
	if ($user->hasRight('mjlfinancement', 'activity', 'validate') && $status === MjlActivity::STATUS_SUBMITTED) {
		if ((int) $row->fk_user_creat !== (int) $user->id) {
			print mjl_activities_comment_form($id, 'validate', 'Valider', 'Commentaire');
		}
		print mjl_activities_comment_form($id, 'request_correction', 'Correction', 'Motif correction');
		print mjl_activities_comment_form($id, 'reject', 'Rejeter', 'Motif rejet');
	}
	if ($user->hasRight('mjlfinancement', 'activity', 'write') && $status === MjlActivity::STATUS_CORRECTION_REQUESTED) {
		print mjl_activities_comment_form($id, 'correct', 'Marquer corrigee', 'Commentaire correction');
	}
}

function mjl_activities_edit_form($row)
{
	return '<form class="inline-block" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">'.mjl_activities_token_input().'<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row->rowid).'"><input name="label" value="'.dol_escape_htmltag($row->label).'" class="maxwidth200"><input type="date" name="date_start" value="'.dol_escape_htmltag(substr((string) $row->date_start, 0, 10)).'"><input type="date" name="date_end" value="'.dol_escape_htmltag(substr((string) $row->date_end, 0, 10)).'"><input required name="comment" placeholder="Motif modification"><input class="button" type="submit" value="Enregistrer"></form> ';
}

function mjl_activities_comment_form($id, $action, $label, $placeholder)
{
	return '<form class="inline-block" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">'.mjl_activities_token_input().'<input type="hidden" name="action" value="'.dol_escape_htmltag($action).'"><input type="hidden" name="id" value="'.((int) $id).'"><input name="comment" placeholder="'.dol_escape_htmltag($placeholder).'"><input class="button" type="submit" value="'.dol_escape_htmltag($label).'"></form> ';
}

function mjl_activities_workflow_history()
{
	global $db, $conf, $user;

	if (!$user->hasRight('mjlfinancement', 'workflowaction', 'read')) {
		return;
	}
	$sql = 'SELECT w.ref, a.ref AS activity_ref, w.action, w.from_status, w.to_status, u.login, w.actor_role, w.action_date, w.comment, w.changes_json';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity)." AND w.object_type = 'mjlfinancement_activity'";
	$sql .= ' ORDER BY w.action_date DESC, w.rowid DESC LIMIT 50';
	$resql = $db->query($sql);
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div>';
		return;
	}

	print '<br>';
	print load_fiche_titre('Historique workflow activites', '', 'check');
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Ref</th><th>Activite</th><th>Action</th><th>De</th><th>Vers</th><th>Acteur</th><th>Role</th><th>Date</th><th>Commentaire</th><th>Changements</th></tr>';
	while ($row = $db->fetch_object($resql)) {
		print '<tr class="oddeven">';
		print '<td>'.dol_escape_htmltag($row->ref).'</td>';
		print '<td>'.dol_escape_htmltag($row->activity_ref).'</td>';
		print '<td>'.dol_escape_htmltag($row->action).'</td>';
		print '<td>'.dol_escape_htmltag($row->from_status).'</td>';
		print '<td>'.dol_escape_htmltag($row->to_status).'</td>';
		print '<td>'.dol_escape_htmltag($row->login).'</td>';
		print '<td>'.dol_escape_htmltag($row->actor_role).'</td>';
		print '<td>'.dol_escape_htmltag($row->action_date).'</td>';
		print '<td>'.dol_escape_htmltag($row->comment).'</td>';
		print '<td>'.dol_escape_htmltag($row->changes_json).'</td>';
		print '</tr>';
	}
	print '</table></div>';
}

function mjl_activity_status_label($status)
{
	$map = array(
		MjlActivity::STATUS_DRAFT => 'draft',
		MjlActivity::STATUS_ONGOING => 'ongoing',
		MjlActivity::STATUS_COMPLETED => 'completed',
		MjlActivity::STATUS_SUBMITTED => 'submitted',
		MjlActivity::STATUS_CORRECTION_REQUESTED => 'correction_requested',
		MjlActivity::STATUS_CORRECTED => 'corrected',
		MjlActivity::STATUS_VALIDATED => 'validated',
		MjlActivity::STATUS_REJECTED => 'rejected',
		MjlActivity::STATUS_CANCELLED => 'cancelled',
	);
	$status = (int) $status;
	return isset($map[$status]) ? $map[$status] : (string) $status;
}

function mjl_activity_deadline_alert($dateEnd, $status)
{
	if (in_array((int) $status, array(MjlActivity::STATUS_COMPLETED, MjlActivity::STATUS_CANCELLED), true) || empty($dateEnd)) {
		return '';
	}
	$end = strtotime((string) $dateEnd);
	if ($end <= 0) {
		return '';
	}
	$today = strtotime(date('Y-m-d'));
	if ($end < $today) {
		return 'En retard';
	}
	if ($end <= strtotime('+7 days', $today)) {
		return 'Échéance proche';
	}
	return '';
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
