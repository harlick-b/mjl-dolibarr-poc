<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_activity_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_expense_access.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_ui.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_table.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_form.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_project_recovery.lib.php';

mjl_workspace_require_projects_access($user);

$langs->load('mjlfinancement@mjlfinancement');

$projectId = GETPOSTINT('id');
$action = GETPOST('action', 'alphanohtml');
$mjl_project_recovery = mjl_form_recovery_consume_route(
	GETPOST('mjl_recovery', 'alphanohtml'),
	array('user_id' => (int) $user->id, 'entity' => (int) $conf->entity, 'route' => 'projects', 'object_id' => (int) $projectId),
	mjl_project_recovery_consume_allowlist()
);
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array($action, array('create', 'update'), true)) {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		accessforbidden('Invalid security token');
	}
	if (!mjl_projects_can_manage_projects()) {
		accessforbidden();
	}
	mjl_projects_handle_project_post($action, $projectId);
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array($action, array('add_note', 'add_exchange'), true)) {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		accessforbidden('Invalid security token');
	}
	mjl_projects_handle_exchange_post($projectId);
}

llxHeader('', 'Projets MJL');
mjl_navigation_shell_start($user, 'projects');
print '<div class="mjl-workspace">';

if ($projectId > 0) {
	mjl_projects_render_detail($projectId);
} else {
	mjl_projects_render_list();
}

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_projects_handle_exchange_post($projectId)
{
	global $user;

	$project = mjl_projects_fetch_project((int) $projectId);
	if (empty($project) || !mjl_projects_can_open($project) || !mjl_timeline_can_comment($user)) {
		accessforbidden();
	}
	$message = trim(GETPOST('message', 'restricthtml'));
	if ($message === '') {
		$handle = mjl_projects_store_recovery_config(GETPOST('action', 'alphanohtml'), (int) $projectId, array('message' => 'Le commentaire est obligatoire.'));
		setEventMessages('Le commentaire est obligatoire.', null, 'errors');
		mjl_projects_redirect($projectId, $handle);
	}
	list($result, $statusMessage) = mjl_timeline_create_comment($user, 'mjlfinancement_project', (int) $projectId, $message);
	if ($result <= 0) {
		$handle = mjl_projects_store_recovery_config(GETPOST('action', 'alphanohtml'), (int) $projectId, array('_form' => mjl_ui_safe_error_message('database')));
		setEventMessages(mjl_ui_safe_error_message('database'), null, 'errors');
		mjl_projects_redirect($projectId, $handle);
	}
	setEventMessages($statusMessage, null, $result > 0 ? 'mesgs' : 'errors');
	mjl_projects_redirect($projectId);
}

function mjl_projects_handle_project_post($action, $projectId)
{
	global $db, $conf, $user;

	$fkSoc = GETPOSTINT('fk_soc');
	if (!mjl_projects_can_use_partner($fkSoc)) {
		accessforbidden('Partenaire hors de votre perimetre');
	}
	$ref = trim(GETPOST('ref', 'alphanohtml'));
	$title = trim(GETPOST('title', 'restricthtml'));
	$status = GETPOSTINT('fk_statut') === 1 ? 1 : 0;
	$dateStart = mjl_projects_post_date_sql('date_start');
	$dateEnd = mjl_projects_post_date_sql('date_end');
	$description = GETPOST('description', 'restricthtml');
	$errors = array();
	if ($ref === '') $errors['ref'] = 'La référence est obligatoire.';
	if ($title === '') $errors['title'] = 'L’intitulé est obligatoire.';
	$startValue = trim((string) GETPOST('date_start', 'alphanohtml'));
	$endValue = trim((string) GETPOST('date_end', 'alphanohtml'));
	if ($startValue !== '' && $endValue !== '' && $endValue < $startValue) $errors['date_end'] = 'La date de fin doit être postérieure ou égale à la date de début.';
	if (!empty($errors)) {
		$handle = mjl_projects_store_recovery_config($action, (int) $projectId, $errors);
		setEventMessages(mjl_ui_safe_error_message('validation'), null, 'errors');
		mjl_projects_redirect($projectId, $handle);
	}

	if ($action === 'create') {
		$db->begin();
		$sql = 'INSERT INTO '.$db->prefix().'projet';
		$sql .= ' (entity, ref, title, description, fk_soc, fk_statut, dateo, datee, public, usage_task, datec, fk_user_creat)';
		$sql .= ' VALUES ('.((int) $conf->entity).", '".$db->escape($ref)."', '".$db->escape($title)."', '".$db->escape($description)."', ".((int) $fkSoc).', '.$status.', '.$dateStart.', '.$dateEnd.', 0, 1, NOW(), '.((int) $user->id).')';
		if (!$db->query($sql)) {
			$db->rollback();
			mjl_ui_log_error('database', mjl_projects_error_context('create'), $db->lasterror());
			$handle = mjl_projects_store_recovery_config('create', 0, array('_form' => mjl_ui_safe_error_message('database')));
			setEventMessages(mjl_ui_safe_error_message('database'), null, 'errors');
			mjl_projects_redirect(0, $handle);
		}
		$newProjectId = (int) $db->last_insert_id($db->prefix().'projet');
		$audit = mjl_workflow_audit_insert('mjlfinancement_project', $newProjectId, (int) $conf->entity, 'Projet cree', $user, mjl_projects_actor_role(), 'created', 'Projet MJL cree', array(
			'ref' => array('before' => '', 'after' => $ref),
			'title' => array('before' => '', 'after' => $title),
			'fk_soc' => array('before' => '', 'after' => $fkSoc),
		), 'WFA-PRJ');
		if ($audit < 0) {
			$db->rollback();
			mjl_ui_log_error('database', mjl_projects_error_context('create_audit'), $db->lasterror());
			$handle = mjl_projects_store_recovery_config('create', 0, array('_form' => mjl_ui_safe_error_message('database')));
			setEventMessages(mjl_ui_safe_error_message('database'), null, 'errors');
			mjl_projects_redirect(0, $handle);
		}
		$db->commit();
		setEventMessages('Projet MJL cree.', null, 'mesgs');
		mjl_projects_redirect($newProjectId);
	}

	$current = mjl_projects_fetch_project((int) $projectId);
	if (empty($current) || !mjl_projects_can_open($current)) {
		accessforbidden();
	}
	$sql = 'UPDATE '.$db->prefix().'projet SET';
	$sql .= " ref = '".$db->escape($ref)."', title = '".$db->escape($title)."', description = '".$db->escape($description)."'";
	$sql .= ', fk_soc = '.((int) $fkSoc).', fk_statut = '.$status.', dateo = '.$dateStart.', datee = '.$dateEnd.', fk_user_modif = '.((int) $user->id);
	$sql .= ' WHERE entity = '.((int) $conf->entity).' AND rowid = '.((int) $projectId);
	$db->begin();
	if (!$db->query($sql)) {
		$db->rollback();
		mjl_ui_log_error('database', mjl_projects_error_context('update'), $db->lasterror());
		$handle = mjl_projects_store_recovery_config('update', (int) $projectId, array('_form' => mjl_ui_safe_error_message('database')));
		setEventMessages(mjl_ui_safe_error_message('database'), null, 'errors');
		mjl_projects_redirect((int) $projectId, $handle);
	} else {
		$changes = mjl_projects_changed_fields($current, array(
			'ref' => $ref,
			'title' => $title,
			'description' => $description,
			'fk_soc' => $fkSoc,
			'fk_statut' => $status,
			'dateo' => trim($dateStart, "'"),
			'datee' => trim($dateEnd, "'"),
		));
		$audit = mjl_workflow_audit_insert('mjlfinancement_project', (int) $projectId, (int) $conf->entity, 'Projet mis a jour', $user, mjl_projects_actor_role(), 'field_changed', 'Projet MJL mis a jour', $changes, 'WFA-PRJ');
		if ($audit < 0) {
			$db->rollback();
			mjl_ui_log_error('database', mjl_projects_error_context('update_audit'), $db->lasterror());
			$handle = mjl_projects_store_recovery_config('update', (int) $projectId, array('_form' => mjl_ui_safe_error_message('database')));
			setEventMessages(mjl_ui_safe_error_message('database'), null, 'errors');
			mjl_projects_redirect((int) $projectId, $handle);
		}
		$db->commit();
		setEventMessages('Projet MJL mis a jour.', null, 'mesgs');
	}
	mjl_projects_redirect((int) $projectId);
}

function mjl_projects_render_list()
{
	$result = mjl_projects_list_result();
	$rows = $result['rows'];
	$filters = $result['filters'];
	mjl_dashboard_render_header(
		'Projets',
		'Consulter les projets suivis dans l espace MJL sans ouvrir l interface native Dolibarr.',
		'Portefeuille',
		$result['total'] === null ? 'Total indisponible' : ((int) $result['total']).' projet(s)'
	);

	if (mjl_projects_can_manage_projects()) {
		mjl_projects_render_project_form(array(), 'create');
	}
	print '<section class="mjl-workspace-section">';
	mjl_projects_render_list_filters($filters, $result['partner_options']);
	if (!$result['count_available'] && $result['rows_available']) print mjl_ui_system_state('partial-error', 'Total indisponible', 'Les projets accessibles restent affichés, mais le total ne peut pas être calculé.');
	if (!$result['rows_available']) print mjl_ui_system_state('danger', 'Liste indisponible', mjl_ui_safe_error_message('database'));
	if (empty($rows)) {
		print '<div class="mjl-empty-state">Aucun projet accessible dans votre perimetre.</div>';
	} else {
		print '<div class="div-table-responsive"><table class="noborder centpercent">';
		print '<tr class="liste_titre"><th>Projet</th><th>Partenaire / Programme</th><th>Enveloppe liee</th><th>Budget total</th><th>Budget consomme</th><th>Budget restant</th><th>Fonds recus</th><th>Activites</th><th>Depenses</th><th>Documents</th><th>Echeance</th><th>Statut</th></tr>';
		foreach ($rows as $row) {
			print '<tr class="oddeven">';
			print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php?id='.((int) $row['rowid']).'">'.dol_escape_htmltag($row['ref']).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($row['title']).'</span></td>';
			print '<td>'.dol_escape_htmltag($row['partner_name'] ?: 'Non renseigné').'</td>';
			print '<td>'.dol_escape_htmltag($row['convention_refs'] ?: 'Non renseignee').'</td>';
			print '<td>'.mjl_projects_price($row['budget_total']).'</td>';
			print '<td>'.mjl_projects_price($row['budget_spent']).'</td>';
			print '<td>'.mjl_projects_price($row['budget_remaining']).'</td>';
			print '<td>'.mjl_projects_price($row['funds_received']).'</td>';
			print '<td>'.((int) $row['activities_count']).'</td>';
			print '<td>'.((int) $row['expenses_count']).'</td>';
			print '<td>'.((int) $row['documents_count']).'</td>';
			print '<td>'.dol_escape_htmltag(mjl_projects_date($row['datee'])).'</td>';
			print '<td>'.dol_escape_htmltag(mjl_projects_status_label($row['fk_statut'])).'</td>';
			print '</tr>';
		}
		print '</table></div>';
	}
	$hasPrevious = !$filters['fail_closed'] && (int) $filters['page'] > 1;
	$hasNext = !$filters['fail_closed'] && ($result['total'] === null ? $result['has_extra'] : ((int) $filters['page'] * 50 < (int) $result['total']));
	print mjl_table_render_pagination(DOL_URL_ROOT.'/custom/mjlfinancement/projects.php', $filters, $result['total'], $hasPrevious, $hasNext, 'projets');
	print '</section>';
}

function mjl_projects_render_list_filters($filters, $partnerOptions)
{
	print '<form class="mjl-table-filters" method="GET" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php">';
	print '<label for="mjl-project-partner">Partenaire / Programme<select id="mjl-project-partner" name="partner"><option value="">Tous les partenaires</option>';
	foreach ($partnerOptions as $id => $label) print '<option value="'.((int) $id).'"'.((int) $filters['partner'] === (int) $id ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	print '</select></label><label for="mjl-project-status">Statut<select id="mjl-project-status" name="status"><option value="">Tous les statuts</option><option value="1"'.((string) $filters['status'] === '1' ? ' selected' : '').'>Ouvert</option><option value="0"'.((string) $filters['status'] === '0' ? ' selected' : '').'>Brouillon / clos</option></select></label>';
	print '<label for="mjl-project-sort">Trier par<select id="mjl-project-sort" name="sort"><option value="ref"'.($filters['sort'] === 'ref' ? ' selected' : '').'>Référence</option><option value="recent"'.($filters['sort'] === 'recent' ? ' selected' : '').'>Plus récents</option></select></label>';
	print '<button class="button mjl-action mjl-action-primary" type="submit">Appliquer</button><a class="mjl-action mjl-action-secondary" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php">Réinitialiser</a></form>';
}

function mjl_projects_render_detail($projectId)
{
	$project = mjl_projects_fetch_project((int) $projectId);
	if (empty($project) || !mjl_projects_can_open($project)) {
		accessforbidden();
	}
	mjl_dashboard_render_header('Projet '.$project['ref'], $project['title'], 'Statut', mjl_projects_status_label($project['fk_statut']));
	print '<p><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php">Retour aux projets</a></p>';
	mjl_projects_render_identity($project);

	$cards = array(
		array('label' => 'Execution physique', 'value' => mjl_projects_physical_execution_percent((int) $project['rowid']).'%', 'context' => 'Moyenne des activites rattachees avec avancement renseigne', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activites', 'status' => 'Execution', 'tone' => 'neutral'),
		array('label' => 'Execution financiere', 'value' => mjl_projects_financial_execution_percent($project).'%', 'context' => 'Depenses validees rapportees au budget revise', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Voir les depenses', 'status' => 'Finances', 'tone' => 'neutral'),
		array('label' => 'Budget total', 'value' => mjl_projects_price($project['budget_total']), 'context' => 'Lignes budgetaires rattachees', 'href' => '/custom/mjlfinancement/budgetlines.php', 'action' => 'Voir les budgets', 'status' => 'Financement', 'tone' => 'neutral'),
		array('label' => 'Budget consomme', 'value' => mjl_projects_price($project['budget_spent']), 'context' => 'Depenses validees', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Voir les depenses', 'status' => 'Execution', 'tone' => 'neutral'),
		array('label' => 'Fonds recus', 'value' => mjl_projects_price($project['funds_received']), 'context' => 'Receptions de fonds confirmees', 'href' => '/custom/mjlfinancement/fundreceipts.php', 'action' => 'Voir les fonds', 'status' => 'Financement', 'tone' => 'neutral'),
		array('label' => 'Activites', 'value' => (int) $project['activities_count'], 'context' => 'Activites operationnelles rattachees', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Ouvrir les activites', 'status' => 'Suivi', 'tone' => 'neutral'),
		array('label' => 'Depenses', 'value' => (int) $project['expenses_count'], 'context' => 'Depenses rattachees au projet', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Ouvrir les depenses', 'status' => 'Suivi', 'tone' => 'neutral'),
		array('label' => 'Documents', 'value' => (int) $project['documents_count'], 'context' => 'Pieces accessibles via routes MJL gardees', 'href' => '/custom/mjlfinancement/documents.php', 'action' => 'Voir les documents', 'status' => 'Pieces', 'tone' => 'neutral'),
	);
	foreach ($cards as &$card) $card['href'] = mjl_projects_context_url($card['href'], (int) $project['fk_soc'], (int) $project['rowid']);
	unset($card);
	mjl_dashboard_render_card_section('Resume', 'Vue consolidee du projet et de ses objets MJL rattaches.', $cards);

	if (mjl_projects_can_manage_projects()) {
		mjl_projects_render_project_form($project, 'update');
	}
	mjl_projects_render_related_table('Activites liees', mjl_projects_activity_rows((int) $project['rowid'], 12), 'activities.php', $project, (int) $project['activities_count']);
	mjl_projects_render_related_table('Depenses liees', mjl_projects_expense_rows((int) $project['rowid'], 12), 'expenses.php', $project, (int) $project['expenses_count']);
	mjl_projects_render_alerts((int) $project['rowid']);
	mjl_projects_render_document_table((int) $project['rowid']);
	mjl_projects_render_timeline((int) $project['rowid']);
	mjl_projects_render_notes($project);
}

function mjl_projects_render_identity($project)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Identite du projet</h2><p>Rattachement Partenaire / Programme et dates de suivi.</p></div>';
	print '<dl class="mjl-activity-meta">';
	print '<div><dt>Partenaire / Programme</dt><dd>'.dol_escape_htmltag($project['partner_name'] ?: 'Non renseigne').'</dd></div>';
	print '<div><dt>Reference</dt><dd>'.dol_escape_htmltag($project['ref']).'</dd></div>';
	print '<div><dt>Intitule</dt><dd>'.dol_escape_htmltag($project['title']).'</dd></div>';
	print '<div><dt>Debut</dt><dd>'.dol_escape_htmltag(mjl_projects_date($project['dateo'])).'</dd></div>';
	print '<div><dt>Fin</dt><dd>'.dol_escape_htmltag(mjl_projects_date($project['datee'])).'</dd></div>';
	print '<div><dt>Enveloppes</dt><dd>'.dol_escape_htmltag($project['convention_refs'] ?: 'Non renseignee').'</dd></div>';
	print '</dl></section>';
}

function mjl_projects_render_project_form($row, $action)
{
	$isUpdate = $action === 'update';
	$recovery = mjl_projects_recovery_for_action($action);
	$values = $recovery['values'];
	$errors = $recovery['errors'];
	$fieldPrefix = $isUpdate ? 'mjl-project-update-' : 'mjl-project-create-';
	$value = function ($key, $fallback = '') use ($values) {
		return array_key_exists($key, $values) ? $values[$key] : $fallback;
	};
	print '<section class="mjl-workspace-section mjl-activity-panel">';
	print '<div class="mjl-section-heading"><h2>'.($isUpdate ? 'Parametres projet' : 'Nouveau projet').'</h2><p>Le partenaire / programme est obligatoire et limite au perimetre actif.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php'.($isUpdate ? '?id='.((int) $row['rowid']) : '').'" data-mjl-form="project-'.($isUpdate ? 'update' : 'create').'">';
	print '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="action" value="'.dol_escape_htmltag($action).'">';
	if ($isUpdate) print '<input type="hidden" name="id" value="'.((int) $row['rowid']).'">';
	print '<div data-mjl-form-errors>'.mjl_form_error_summary($errors, 'Corrigez les champs indiqués', $fieldPrefix).'</div>';
	print mjl_form_field('ref', 'Reference', '<input required name="ref" value="'.dol_escape_htmltag($value('ref', $row['ref'] ?? '')).'">', true, '', $errors['ref'] ?? '', $fieldPrefix);
	print mjl_form_field('title', 'Intitule', '<input required name="title" value="'.dol_escape_htmltag($value('title', $row['title'] ?? '')).'">', true, '', $errors['title'] ?? '', $fieldPrefix);
	print mjl_form_field('fk_soc', 'Partenaire / Programme', mjl_projects_partner_select((int) $value('fk_soc', $row['fk_soc'] ?? 0)), true, '', $errors['fk_soc'] ?? '', $fieldPrefix);
	print mjl_form_field('date_start', 'Début', '<input type="date" name="date_start" value="'.dol_escape_htmltag($value('date_start', mjl_projects_date_value($row['dateo'] ?? ''))).'">', false, '', $errors['date_start'] ?? '', $fieldPrefix);
	print mjl_form_field('date_end', 'Fin', '<input type="date" name="date_end" value="'.dol_escape_htmltag($value('date_end', mjl_projects_date_value($row['datee'] ?? ''))).'">', false, '', $errors['date_end'] ?? '', $fieldPrefix);
	$selectedStatus = (int) $value('fk_statut', $row['fk_statut'] ?? 1);
	print mjl_form_field('fk_statut', 'Statut', '<select name="fk_statut"><option value="1"'.($selectedStatus === 1 ? ' selected' : '').'>Ouvert</option><option value="0"'.($selectedStatus !== 1 ? ' selected' : '').'>Brouillon / clos</option></select>', false, '', $errors['fk_statut'] ?? '', $fieldPrefix);
	print mjl_form_field('description', 'Description', '<textarea name="description">'.dol_escape_htmltag($value('description', $row['description'] ?? '')).'</textarea>', false, '', $errors['description'] ?? '', $fieldPrefix);
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="'.($isUpdate ? 'Enregistrer le projet' : 'Creer le projet').'"></div>';
	print '</form></section>';
}

function mjl_projects_render_related_table($title, $rows, $route, $project, $total)
{
	$drilldown = mjl_projects_context_url('/custom/mjlfinancement/'.$route, (int) $project['fk_soc'], (int) $project['rowid']);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>'.dol_escape_htmltag($title).' ('.((int) $total).')</h2><p>Aperçu limité à 12 éléments. <a class="mjl-table-link" href="'.dol_escape_htmltag(DOL_URL_ROOT.$drilldown).'">Voir la liste complète</a></p></div>';
	if (empty($rows)) {
		print '<div class="mjl-empty-state">Aucun element accessible.</div>';
		print '</section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Reference</th><th>Libelle</th><th>Statut</th></tr>';
	foreach ($rows as $row) {
		print '<tr class="oddeven"><td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/'.$route.'?id='.((int) $row['rowid']).'">'.dol_escape_htmltag($row['ref']).'</a></td><td>'.dol_escape_htmltag($row['label']).'</td><td>'.dol_escape_htmltag($row['status_label']).'</td></tr>';
	}
	print '</table></div></section>';
}

function mjl_projects_context_url($path, $partnerId, $projectId)
{
	$route = basename((string) parse_url((string) $path, PHP_URL_PATH));
	$query = array();
	if (in_array($route, array('activities.php', 'expenses.php', 'documents.php'), true)) {
		$query['partner'] = (int) $partnerId;
		$query['project'] = (int) $projectId;
	} else {
		$query['partner_id'] = (int) $partnerId;
		$query['project_id'] = (int) $projectId;
	}
	return (string) $path.(strpos((string) $path, '?') === false ? '?' : '&').http_build_query($query);
}

function mjl_projects_render_document_table($projectId)
{
	$documents = mjl_projects_document_rows($projectId);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Documents lies</h2><p>Telechargements controles par les regles MJL.</p></div>';
	if (empty($documents)) {
		print '<div class="mjl-empty-state">Aucun document accessible.</div>';
		print '</section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Document</th><th>Type</th><th>Objet lie</th><th>Action</th></tr>';
	foreach ($documents as $document) {
		print '<tr class="oddeven"><td>'.dol_escape_htmltag($document['name']).'</td><td>'.dol_escape_htmltag($document['type_label']).'</td><td>'.dol_escape_htmltag($document['object_ref']).'</td><td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/documentdownload.php?type='.urlencode($document['download_type']).'&id='.((int) $document['rowid']).'">Telecharger</a></td></tr>';
	}
	print '</table></div></section>';
}

function mjl_projects_render_alerts($projectId)
{
	$alerts = mjl_projects_alert_rows($projectId);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Alertes du projet</h2><p>Activites ouvertes avec echeance proche ou depassee.</p></div>';
	if (empty($alerts)) {
		print '<div class="mjl-empty-state">Aucune alerte projet active.</div>';
		print '</section>';
		return;
	}
	print '<div class="div-table-responsive"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Activite</th><th>Echeance</th><th>Alerte</th><th>Statut</th></tr>';
	foreach ($alerts as $row) {
		print '<tr class="oddeven"><td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.((int) $row['rowid']).'">'.dol_escape_htmltag($row['ref']).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($row['label']).'</span></td><td>'.dol_escape_htmltag(mjl_projects_date($row['date_end'])).'</td><td>'.dol_escape_htmltag(mjl_projects_activity_deadline_alert($row['date_end'], $row['status'])).'</td><td>'.dol_escape_htmltag(mjl_projects_activity_status_label($row['status'])).'</td></tr>';
	}
	print '</table></div></section>';
}

function mjl_projects_render_timeline($projectId)
{
	$items = mjl_projects_timeline_rows($projectId);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Historique contextualise</h2><p>Actions recentes rattachees au projet et a ses objets MJL.</p></div>';
	if (empty($items)) {
		print '<div class="mjl-empty-state">Aucune action recente rattachee au projet.</div>';
		print '</section>';
		return;
	}
	print '<ol class="mjl-timeline">';
	foreach ($items as $item) {
		print '<li><strong>'.dol_escape_htmltag($item['object_ref'].' - '.mjl_projects_workflow_action_label($item['action'])).'</strong> <span class="opacitymedium">'.dol_escape_htmltag($item['action_date']).'</span><p class="mjl-timeline-comment">'.dol_escape_htmltag($item['comment']).'</p></li>';
	}
	print '</ol></section>';
}

function mjl_projects_render_notes($project)
{
	$notes = mjl_projects_contextual_comment_rows((int) $project['rowid']);
	$commentAction = is_array($GLOBALS['mjl_project_recovery'] ?? null) && ($GLOBALS['mjl_project_recovery']['context']['action'] ?? '') === 'add_note' ? 'add_note' : 'add_exchange';
	$commentRecovery = mjl_projects_recovery_for_action($commentAction);
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Notes / Commentaires</h2><p>Commentaires humains separes de l audit automatique.</p></div>';
	if (mjl_timeline_can_comment($GLOBALS['user'])) {
		print '<form method="POST" class="mjl-form-grid" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/projects.php?id='.((int) $project['rowid']).'">';
		print '<input type="hidden" name="token" value="'.dol_escape_htmltag(function_exists('newToken') ? newToken() : '').'">';
		print '<input type="hidden" name="action" value="'.dol_escape_htmltag($commentAction).'">';
		print '<div data-mjl-form-errors>'.mjl_form_error_summary($commentRecovery['errors'], 'Corrigez le commentaire', 'mjl-project-comment-').'</div>';
		print mjl_form_field('message', 'Commentaire', '<textarea required name="message">'.dol_escape_htmltag($commentRecovery['values']['message'] ?? '').'</textarea>', true, '', $commentRecovery['errors']['message'] ?? '', 'mjl-project-comment-');
		print '<div><button class="button" type="submit">Ajouter le commentaire</button></div>';
		print '</form>';
	}
	if (empty($notes)) {
		print '<div class="mjl-empty-state">Aucun commentaire projet.</div>';
		print '</section>';
		return;
	}
	print '<ol class="mjl-timeline">';
	foreach ($notes as $note) {
		print '<li><strong>'.dol_escape_htmltag($note['author']).'</strong> <span class="opacitymedium">'.dol_escape_htmltag($note['date_note']).'</span><p class="mjl-timeline-comment">'.dol_escape_htmltag($note['message']).'</p></li>';
	}
	print '</ol></section>';
}

function mjl_projects_fetch_rows()
{
	return mjl_projects_list_result()['rows'];
}

function mjl_projects_list_result()
{
	global $db, $conf, $user;
	$partnerOptions = array();
	$resql = $db->query('SELECT s.rowid, s.nom FROM '.$db->prefix().'societe s WHERE s.entity = '.((int) $conf->entity).' AND s.status = 1'.mjl_scope_partner_sql_filter('s.rowid', $user).' ORDER BY s.nom ASC, s.rowid ASC');
	if ($resql) while ($row = $db->fetch_object($resql)) $partnerOptions[(int) $row->rowid] = (string) $row->nom;
	$raw = array();
	foreach (array('partner', 'status', 'sort', 'page') as $key) $raw[$key] = isset($_GET[$key]) && is_scalar($_GET[$key]) ? (string) $_GET[$key] : '';
	$schema = array(
		'partner' => array('type' => 'id', 'allowed' => array_keys($partnerOptions), 'default' => 0),
		'status' => array('type' => 'enum', 'allowed' => array('0', '1'), 'default' => ''),
		'sort' => array('type' => 'enum', 'allowed' => array('ref', 'recent'), 'default' => 'ref'),
		'page' => array('type' => 'page', 'default' => 1),
	);
	$filters = mjl_table_normalize_generic($raw, $schema, 50);
	$fragments = mjl_projects_list_fragments($filters);
	$total = null;
	$countAvailable = true;
	if (!$filters['fail_closed']) {
		$resql = $db->query('SELECT COUNT(*) AS nb'.$fragments['from'].$fragments['where']);
		if ($resql) {
			$row = $db->fetch_object($resql);
			$total = $row ? (int) $row->nb : 0;
			$filters = mjl_table_normalize_generic($raw, $schema, 50, $total);
			$fragments = mjl_projects_list_fragments($filters);
		} else {
			$countAvailable = false;
			mjl_ui_log_error('database', array('route' => 'projects', 'action' => 'list_count'), $db->lasterror());
		}
	}
	$rows = array();
	$rowsAvailable = true;
	$hasExtra = false;
	if (!$filters['fail_closed']) {
		$order = $filters['sort'] === 'recent' ? ' ORDER BY p.rowid DESC' : ' ORDER BY p.ref ASC, p.rowid ASC';
		$offset = ((int) $filters['page'] - 1) * 50;
		$resql = $db->query(mjl_projects_base_sql().$fragments['where'].$order.' LIMIT 51 OFFSET '.max(0, $offset));
		if (!$resql) {
			$rowsAvailable = false;
			mjl_ui_log_error('database', array('route' => 'projects', 'action' => 'list_rows'), $db->lasterror());
		} else {
			while ($row = $db->fetch_object($resql)) $rows[] = (array) $row;
			$hasExtra = count($rows) > 50;
			if ($hasExtra) array_pop($rows);
		}
	}
	return array('filters' => $filters, 'partner_options' => $partnerOptions, 'rows' => $rows, 'total' => $total, 'count_available' => $countAvailable, 'rows_available' => $rowsAvailable, 'has_extra' => $hasExtra);
}

function mjl_projects_list_fragments($filters)
{
	global $db, $conf;
	$from = ' FROM '.$db->prefix().'projet p LEFT JOIN '.$db->prefix().'societe s ON s.rowid = p.fk_soc AND s.entity = p.entity';
	$where = ' WHERE p.entity = '.((int) $conf->entity).mjl_projects_scope_sql('p');
	if (!empty($filters['fail_closed'])) return array('from' => $from, 'where' => $where.' AND 1 = 0');
	if ((int) $filters['partner'] > 0) $where .= ' AND p.fk_soc = '.((int) $filters['partner']);
	if ($filters['status'] !== '') $where .= ' AND p.fk_statut = '.((int) $filters['status']);
	return array('from' => $from, 'where' => $where);
}

function mjl_projects_fetch_project($projectId)
{
	global $conf;
	if ((int) $projectId <= 0) return array();
	$sql = mjl_projects_base_sql();
	$sql .= ' WHERE p.entity = '.((int) $conf->entity).' AND p.rowid = '.((int) $projectId);
	$rows = mjl_projects_fetch_all($sql);
	return empty($rows) ? array() : $rows[0];
}

function mjl_projects_base_sql()
{
	global $db;
	return 'SELECT p.rowid, p.ref, p.title, p.description, p.fk_soc, p.dateo, p.datee, p.fk_statut,'
		.' s.nom AS partner_name,'
		.' COALESCE((SELECT GROUP_CONCAT(c.ref ORDER BY c.ref SEPARATOR \', \') FROM '.$db->prefix().'mjlfinancement_convention c WHERE c.entity = p.entity AND c.fk_project = p.rowid'.mjl_projects_related_scope_sql('c.fk_soc').'), \'\') AS convention_refs,'
		.' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention cbl ON cbl.rowid = bl.fk_convention AND cbl.entity = bl.entity WHERE bl.entity = p.entity AND bl.fk_project = p.rowid'.mjl_projects_related_scope_sql('cbl.fk_soc').'), 0) AS budget_total,'
		.' COALESCE((SELECT SUM('.mjl_expense_budget_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention ce ON ce.rowid = e.fk_convention AND ce.entity = e.entity WHERE e.entity = p.entity AND e.fk_project = p.rowid AND e.status IN ('.mjl_expense_status_sql_list(mjl_expense_budget_consuming_statuses()).')'.mjl_projects_related_scope_sql('ce.fk_soc').'), 0) AS budget_spent,'
		.' COALESCE((SELECT SUM(bl.remaining_amount) FROM '.$db->prefix().'mjlfinancement_budget_line bl INNER JOIN '.$db->prefix().'mjlfinancement_convention cbr ON cbr.rowid = bl.fk_convention AND cbr.entity = bl.entity WHERE bl.entity = p.entity AND bl.fk_project = p.rowid'.mjl_projects_related_scope_sql('cbr.fk_soc').'), 0) AS budget_remaining,'
		.' COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = p.entity AND fr.fk_project = p.rowid AND fr.status = 1'.mjl_projects_related_scope_sql('fr.fk_soc').'), 0) AS funds_received,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention ca ON ca.rowid = a.fk_convention AND ca.entity = a.entity WHERE a.entity = p.entity AND a.fk_project = p.rowid'.mjl_projects_related_scope_sql('ca.fk_soc').'), 0) AS activities_count,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention ced ON ced.rowid = e.fk_convention AND ced.entity = e.entity WHERE e.entity = p.entity AND e.fk_project = p.rowid'.mjl_projects_related_scope_sql('ced.fk_soc').'), 0) AS expenses_count,'
		.' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'ecm_files f INNER JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = f.src_object_id AND f.src_object_type = \'mjlfinancement_activity\' AND a.entity = f.entity INNER JOIN '.$db->prefix().'mjlfinancement_convention cda ON cda.rowid = a.fk_convention AND cda.entity = a.entity WHERE a.entity = p.entity AND a.fk_project = p.rowid'.mjl_projects_related_scope_sql('cda.fk_soc').'), 0)'
		.' + COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'ecm_files f INNER JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = f.src_object_id AND f.src_object_type = \'mjlfinancement_expense\' AND e.entity = f.entity INNER JOIN '.$db->prefix().'mjlfinancement_convention cde ON cde.rowid = e.fk_convention AND cde.entity = e.entity WHERE e.entity = p.entity AND e.fk_project = p.rowid'.mjl_projects_related_scope_sql('cde.fk_soc').'), 0)'
		.' + COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'ecm_files f INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = f.src_object_id AND f.src_object_type = \'mjlfinancement_convention\' AND c.entity = f.entity WHERE c.entity = p.entity AND c.fk_project = p.rowid'.mjl_projects_related_scope_sql('c.fk_soc').'), 0)'
		.' + COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'ecm_files f INNER JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = f.src_object_id AND f.src_object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = f.entity WHERE fr.entity = p.entity AND fr.fk_project = p.rowid'.mjl_projects_related_scope_sql('fr.fk_soc').'), 0) AS documents_count'
		.' FROM '.$db->prefix().'projet p'
		.' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = p.fk_soc AND s.entity = p.entity';
}

function mjl_projects_activity_rows($projectId, $limit = 0)
{
	global $db, $conf;
	$sql = 'SELECT a.rowid, a.ref, a.label, a.status, a.fk_user_creat FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).' AND a.fk_project = '.((int) $projectId);
	$sql .= mjl_activities_scope_sql('a');
	$sql .= ' ORDER BY a.ref ASC, a.rowid ASC';
	if ((int) $limit > 0) $sql .= ' LIMIT '.((int) $limit);
	$rows = array();
	foreach (mjl_projects_fetch_all($sql) as $row) {
		$row['status_label'] = mjl_projects_activity_status_label($row['status']);
		$rows[] = $row;
	}
	return $rows;
}

function mjl_projects_expense_rows($projectId, $limit = 0)
{
	global $db, $conf;
	$sql = 'SELECT e.rowid, e.ref, e.description AS label, e.status, e.fk_user_creat FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity).' AND e.fk_project = '.((int) $projectId);
	$sql .= mjl_expenses_scope_sql('e');
	$sql .= ' ORDER BY e.ref ASC, e.rowid ASC';
	if ((int) $limit > 0) $sql .= ' LIMIT '.((int) $limit);
	$rows = array();
	foreach (mjl_projects_fetch_all($sql) as $row) {
		$row['status_label'] = mjl_projects_expense_status_label($row['status']);
		$rows[] = $row;
	}
	return $rows;
}

function mjl_projects_document_rows($projectId)
{
	$documents = array();
	foreach (mjl_projects_activity_rows($projectId) as $activity) {
		foreach (mjl_activity_document_download_rows((int) $activity['rowid']) as $row) {
			$documents[] = mjl_projects_document_row($row, 'activity', 'Activite', $activity['ref']);
		}
	}
	foreach (mjl_projects_expense_rows($projectId) as $expense) {
		foreach (mjl_expense_document_download_rows((int) $expense['rowid']) as $row) {
			$documents[] = mjl_projects_document_row($row, 'expense', 'Depense', $expense['ref']);
		}
	}
	foreach (mjl_projects_convention_rows($projectId) as $convention) {
		foreach (mjl_convention_document_download_rows((int) $convention['rowid']) as $row) {
			$documents[] = mjl_projects_document_row($row, 'convention', 'Enveloppe de financement', $convention['ref']);
		}
	}
	foreach (mjl_projects_fund_receipt_rows($projectId) as $receipt) {
		foreach (mjl_fund_receipt_document_download_rows((int) $receipt['rowid']) as $row) {
			$documents[] = mjl_projects_document_row($row, 'fundreceipt', 'Fonds recu', $receipt['ref']);
		}
	}
	return $documents;
}

function mjl_projects_document_row($row, $downloadType, $typeLabel, $objectRef)
{
	return array('rowid' => (int) $row['rowid'], 'name' => mjl_expense_document_display_filename($row), 'download_type' => $downloadType, 'type_label' => $typeLabel, 'object_ref' => $objectRef);
}

function mjl_projects_convention_rows($projectId)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'convention', 'read')) return array();
	return mjl_projects_fetch_all('SELECT rowid, ref, title AS label FROM '.$db->prefix().'mjlfinancement_convention c WHERE entity = '.((int) $conf->entity).' AND fk_project = '.((int) $projectId).mjl_scope_partner_sql_filter('c.fk_soc', $user).' ORDER BY ref ASC');
}

function mjl_projects_fund_receipt_rows($projectId)
{
	global $db, $conf, $user;
	if (!$user->hasRight('mjlfinancement', 'fundreceipt', 'read')) return array();
	return mjl_projects_fetch_all('SELECT rowid, ref, comment AS label FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE entity = '.((int) $conf->entity).' AND fk_project = '.((int) $projectId).mjl_scope_partner_sql_filter('fr.fk_soc', $user).' ORDER BY ref ASC');
}

function mjl_projects_alert_rows($projectId)
{
	global $db, $conf;
	$sql = 'SELECT a.rowid, a.ref, a.label, a.date_end, a.status FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).' AND a.fk_project = '.((int) $projectId);
	$sql .= ' AND a.status IN ('.implode(',', array_map('intval', MjlActivity::openStatuses())).')';
	$sql .= " AND a.date_end IS NOT NULL AND a.date_end <= '".$db->escape(date('Y-m-d', strtotime('+7 days')))."'";
	$sql .= mjl_activities_scope_sql('a');
	$sql .= ' ORDER BY a.date_end ASC, a.ref ASC';
	return mjl_projects_fetch_all($sql);
}

function mjl_projects_timeline_rows($projectId)
{
	global $db, $conf;
	$sql = 'SELECT w.action, w.action_date, w.comment, COALESCE(a.ref, e.ref, c.ref, fr.ref, p.ref) AS object_ref';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity AND a.fk_project = '.((int) $projectId);
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = w.object_id AND w.object_type = \'mjlfinancement_expense\' AND e.entity = w.entity AND e.fk_project = '.((int) $projectId);
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = w.object_id AND w.object_type = \'mjlfinancement_convention\' AND c.entity = w.entity AND c.fk_project = '.((int) $projectId);
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = w.object_id AND w.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = w.entity AND fr.fk_project = '.((int) $projectId);
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = w.object_id AND w.object_type = \'mjlfinancement_project\' AND p.entity = w.entity AND p.rowid = '.((int) $projectId);
	$sql .= ' WHERE w.entity = '.((int) $conf->entity).' AND COALESCE(a.rowid, e.rowid, c.rowid, fr.rowid, p.rowid) IS NOT NULL';
	$sql .= ' ORDER BY w.action_date DESC, w.rowid DESC LIMIT 20';
	return mjl_projects_fetch_all($sql);
}

function mjl_projects_physical_execution_percent($projectId)
{
	global $db, $conf;
	$sql = 'SELECT ROUND(COALESCE(AVG(a.physical_execution_percent), 0)) AS value FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).' AND a.fk_project = '.((int) $projectId).' AND a.physical_execution_percent IS NOT NULL';
	$sql .= mjl_activities_scope_sql('a');
	$row = mjl_projects_fetch_one($sql);
	return empty($row) ? 0 : (int) $row['value'];
}

function mjl_projects_financial_execution_percent($project)
{
	$total = (float) $project['budget_total'];
	if ($total <= 0) return 0;
	return (int) round(((float) $project['budget_spent'] / $total) * 100);
}

function mjl_projects_note_rows($projectId)
{
	global $db, $conf;
	$sql = 'SELECT n.message, n.date_note, u.login AS author FROM '.$db->prefix().'mjlfinancement_project_note n';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = n.fk_user_author';
	$sql .= ' WHERE n.entity = '.((int) $conf->entity).' AND n.fk_project = '.((int) $projectId);
	$sql .= ' ORDER BY n.date_note DESC, n.rowid DESC';
	return mjl_projects_fetch_all($sql);
}

function mjl_projects_contextual_comment_rows($projectId)
{
	$rows = array();
	foreach (mjl_timeline_exchange_items('mjlfinancement_project', (int) $projectId, false) as $item) {
		$rows[] = array('date_note' => $item['meta'], 'author' => $item['title'], 'message' => $item['comment'], 'sort_date' => $item['sort_date'], 'rowid' => (int) $item['rowid']);
	}
	foreach (mjl_projects_note_rows((int) $projectId) as $note) {
		$note['sort_date'] = $note['date_note'];
		$note['rowid'] = -1;
		$rows[] = $note;
	}
	usort($rows, function ($a, $b) {
		if ((string) $a['sort_date'] === (string) $b['sort_date']) return (int) $b['rowid'] - (int) $a['rowid'];
		return strcmp((string) $b['sort_date'], (string) $a['sort_date']);
	});
	return $rows;
}

function mjl_projects_can_open($project)
{
	global $user;
	if (mjl_scope_is_platform_admin($user)) return true;
	if (empty($project['fk_soc']) || (int) $project['fk_soc'] <= 0) return false;
	return mjl_scope_can_access_fk_soc($user, (int) $project['fk_soc']);
}

function mjl_projects_can_add_note($project)
{
	global $user;
	if (mjl_workspace_can_access_supervision($user)) return true;
	if (mjl_activities_is_readonly_consultation() && mjl_expenses_is_readonly_consultation()) return false;
	return mjl_projects_can_open($project) && ($user->hasRight('mjlfinancement', 'activity', 'write') || $user->hasRight('mjlfinancement', 'expense', 'write') || $user->hasRight('mjlfinancement', 'activity', 'validate') || $user->hasRight('mjlfinancement', 'expense', 'validate'));
}

function mjl_projects_scope_sql($alias)
{
	global $user;
	$a = preg_replace('/[^A-Za-z0-9_]/', '', $alias);
	return mjl_scope_partner_sql_filter($a.'.fk_soc', $user);
}

function mjl_projects_related_scope_sql($column)
{
	global $user;
	return mjl_scope_partner_sql_filter($column, $user);
}

function mjl_projects_can_manage_projects()
{
	global $user;
	return mjl_workspace_user_has_production_access($user) && (mjl_scope_is_platform_admin($user) || mjl_scope_is_final_validator($user));
}

function mjl_projects_can_use_partner($fkSoc)
{
	global $db, $conf, $user;
	$fkSoc = (int) $fkSoc;
	if ($fkSoc <= 0 || !mjl_scope_can_access_fk_soc($user, $fkSoc)) return false;
	$sql = 'SELECT rowid FROM '.$db->prefix().'societe WHERE entity = '.((int) $conf->entity).' AND rowid = '.$fkSoc.' AND status = 1';
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_projects_partner_select($selected)
{
	global $db, $conf, $user;
	$sql = 'SELECT rowid, nom FROM '.$db->prefix().'societe s WHERE s.entity = '.((int) $conf->entity).' AND s.status = 1'.mjl_scope_partner_sql_filter('s.rowid', $user).' ORDER BY s.nom ASC';
	$out = '<select required name="fk_soc"><option value="">Selectionner</option>';
	foreach (mjl_projects_fetch_all($sql) as $row) {
		$out .= '<option value="'.((int) $row['rowid']).'"'.((int) $selected === (int) $row['rowid'] ? ' selected' : '').'>'.dol_escape_htmltag($row['nom']).'</option>';
	}
	return $out.'</select>';
}

function mjl_projects_post_date_sql($field)
{
	global $db;
	$value = GETPOST($field, 'alphanohtml');
	if ($value === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return 'NULL';
	return "'".$db->escape($value)."'";
}

function mjl_projects_date_value($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? date('Y-m-d', $time) : '';
}

function mjl_projects_recovery_for_action($action)
{
	global $mjl_project_recovery;
	$config = mjl_project_recovery_config($action);
	if ($config === null || !is_array($mjl_project_recovery)
		|| (string) ($mjl_project_recovery['context']['form'] ?? '') !== (string) $config['form']
		|| (string) ($mjl_project_recovery['context']['action'] ?? '') !== (string) $action) {
		return array('values' => array(), 'errors' => array());
	}
	return array('values' => (array) ($mjl_project_recovery['values'] ?? array()), 'errors' => (array) ($mjl_project_recovery['errors'] ?? array()));
}

function mjl_projects_store_recovery_config($action, $objectId, $errors)
{
	global $conf, $user;
	$config = mjl_project_recovery_config($action);
	if ($config === null) return '';
	$reason = '';
	return mjl_form_recovery_store(array(
		'user_id' => (int) $user->id,
		'entity' => (int) $conf->entity,
		'route' => 'projects',
		'form' => (string) $config['form'],
		'action' => (string) $action,
		'object_id' => (int) $objectId,
	), $_POST, $config['fields'], $reason, (array) $errors);
}

function mjl_projects_error_context($action)
{
	global $conf, $user;
	return array('route' => 'projects', 'action' => $action, 'entity' => (int) $conf->entity, 'user_id' => (int) $user->id);
}

function mjl_projects_redirect($id, $recoveryHandle = '')
{
	$query = array();
	if ((int) $id > 0) $query['id'] = (int) $id;
	if ((string) $recoveryHandle !== '') $query['mjl_recovery'] = (string) $recoveryHandle;
	$url = DOL_URL_ROOT.'/custom/mjlfinancement/projects.php'.(!empty($query) ? '?'.http_build_query($query) : '');
	header('Location: '.$url);
	exit;
}

function mjl_projects_fetch_all($sql)
{
	global $db;
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return array();
	}
	$rows = array();
	while ($obj = $db->fetch_object($resql)) {
		$rows[] = (array) $obj;
	}
	return $rows;
}

function mjl_projects_fetch_one($sql)
{
	$rows = mjl_projects_fetch_all($sql);
	return empty($rows) ? array() : $rows[0];
}

function mjl_projects_status_label($status)
{
	return ((int) $status === 1) ? 'Ouvert' : 'Brouillon / clos';
}

function mjl_projects_activity_status_label($status)
{
	return mjl_ui_activity_status($status)['label'];
}

function mjl_projects_expense_status_label($status)
{
	return mjl_ui_expense_status($status)['label'];
}

function mjl_projects_activity_deadline_alert($dateEnd, $status)
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

function mjl_projects_workflow_action_label($action)
{
	return mjl_timeline_presentation_action_label('mjlfinancement_project', $action);
}

function mjl_projects_price($value)
{
	return function_exists('price') ? price((float) $value, 0, '', 1, -1, -1, 'XOF') : number_format((float) $value, 0, ',', ' ').' XOF';
}

function mjl_projects_changed_fields($before, $after)
{
	$changes = array();
	foreach ($after as $field => $value) {
		$old = isset($before[$field]) ? (string) $before[$field] : '';
		$new = $value === 'NULL' ? '' : (string) $value;
		if ($old !== $new) {
			$changes[$field] = array('before' => $old, 'after' => $new);
		}
	}
	return $changes;
}

function mjl_projects_date($value)
{
	return trim((string) $value) === '' ? 'Non renseignee' : (string) $value;
}

function mjl_projects_actor_role()
{
	global $user;
	if (mjl_scope_is_platform_admin($user)) return 'ADMIN_PLATEFORME';
	if (mjl_scope_is_final_validator($user)) return 'VALIDATEUR_DEFINITIF';
	if (mjl_scope_is_verifier($user)) return 'AGENT_VERIFICATEUR';
	if (mjl_scope_is_input_agent($user)) return 'AGENT_SAISIE';
	return 'PROFIL_NON_RESOLU';
}
