<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlbudgetline.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlconvention.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_finance_metrics.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';

mjl_workspace_require_reference_data_access($user, 'budgetline');

$action = GETPOST('action', 'aZ09');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		mjl_budgetlines_forbidden('Jeton de securite invalide');
	}
	if ($action !== 'add_exchange' && !mjl_budgetlines_can_manage()) {
		mjl_budgetlines_forbidden();
	}
	mjl_budgetlines_handle_post($action);
}

$budgetLineId = GETPOSTINT('id');

llxHeader('', 'Lignes budgetaires MJL');
mjl_navigation_shell_start($user, 'budgetlines');
print '<div class="mjl-workspace mjl-budgetline-workspace">';

if ($budgetLineId > 0) {
	mjl_budgetlines_render_detail($budgetLineId);
} else {
	mjl_budgetlines_render_list_page();
}

print '</div>';
mjl_navigation_shell_end();
llxFooter();
$db->close();

function mjl_budgetlines_handle_post($action)
{
	global $db, $user, $conf;

	if ($action === 'create') {
		$budgetLine = new MjlBudgetLine($db);
		$budgetLine->entity = (int) $conf->entity;
		$budgetLine->ref = GETPOST('ref', 'alphanohtml');
		$budgetLine->label = GETPOST('label', 'restricthtml');
		$budgetLine->fk_project = GETPOSTINT('fk_project');
		$budgetLine->fk_convention = GETPOSTINT('fk_convention');
		$budgetLine->fk_mjl_activity = GETPOSTINT('fk_mjl_activity');
		$budgetLine->fk_activity = GETPOSTINT('fk_activity');
		$budgetLine->initial_budget = price2num(GETPOST('initial_budget', 'alpha'));
		$budgetLine->revised_budget = GETPOST('revised_budget', 'alpha') === '' ? $budgetLine->initial_budget : price2num(GETPOST('revised_budget', 'alpha'));
		$budgetLine->category = GETPOST('category', 'alphanohtml');
		$budgetLine->note_public = GETPOST('note_public', 'restricthtml');
		$budgetLine->note_private = GETPOST('note_private', 'restricthtml');
		$budgetLine->fk_user_creat = $user->id;
		if (!mjl_budgetlines_can_use_links((int) $budgetLine->fk_project, (int) $budgetLine->fk_convention, (int) $budgetLine->fk_mjl_activity, (int) $budgetLine->fk_activity)) {
			mjl_budgetlines_forbidden('Rattachement hors de votre perimetre');
		}
		$result = $budgetLine->create($user);
		if ($result <= 0) {
			setEventMessages($budgetLine->error ?: 'Creation ligne budgetaire refusee', null, 'errors');
			mjl_budgetlines_redirect(0);
		}
		setEventMessages('Ligne budgetaire creee en brouillon', null, 'mesgs');
		mjl_budgetlines_redirect((int) $result);
	}

	$id = GETPOSTINT('id');
	$budgetLine = new MjlBudgetLine($db);
	if ($id <= 0 || $budgetLine->fetch($id) <= 0 || (int) $budgetLine->entity !== (int) $conf->entity) {
		mjl_budgetlines_forbidden('Ligne budgetaire introuvable ou hors de votre perimetre');
	}
	if (!mjl_scope_can_access_object($user, 'mjlfinancement_budget_line', $id)) {
		mjl_budgetlines_forbidden('Ligne budgetaire hors de votre perimetre');
	}

	if ($action === 'add_exchange') {
		list($result, $message) = mjl_timeline_create_comment($user, 'mjlfinancement_budget_line', $id, GETPOST('message', 'restricthtml'));
		setEventMessages($message, null, $result > 0 ? 'mesgs' : 'errors');
		mjl_budgetlines_redirect($id);
	}

	if ($action === 'update') {
		if (!mjl_budgetlines_can_use_links(GETPOSTINT('fk_project'), GETPOSTINT('fk_convention'), GETPOSTINT('fk_mjl_activity'), GETPOSTINT('fk_activity'))) {
			mjl_budgetlines_forbidden('Rattachement hors de votre perimetre');
		}
		$result = $budgetLine->updateGovernedFields($user, array(
			'ref' => GETPOST('ref', 'alphanohtml'),
			'label' => GETPOST('label', 'restricthtml'),
			'fk_project' => GETPOSTINT('fk_project'),
			'fk_convention' => GETPOSTINT('fk_convention'),
			'fk_mjl_activity' => GETPOSTINT('fk_mjl_activity'),
			'fk_activity' => GETPOSTINT('fk_activity'),
			'initial_budget' => GETPOST('initial_budget', 'alpha'),
			'revised_budget' => GETPOST('revised_budget', 'alpha'),
			'category' => GETPOST('category', 'alphanohtml'),
			'note_public' => GETPOST('note_public', 'restricthtml'),
			'note_private' => GETPOST('note_private', 'restricthtml'),
		), GETPOST('comment', 'restricthtml'));
	} elseif ($action === 'activate') {
		$result = $budgetLine->activate($user, GETPOST('comment', 'restricthtml'));
	} else {
		mjl_budgetlines_redirect($id);
	}

	if ($result < 0) {
		setEventMessages($budgetLine->error ?: 'Action ligne budgetaire refusee', null, 'errors');
	} elseif ($result === 0) {
		setEventMessages('Aucun changement applique', null, 'warnings');
	} else {
		setEventMessages('Action ligne budgetaire enregistree', null, 'mesgs');
	}
	mjl_budgetlines_redirect($id);
}

function mjl_budgetlines_render_list_page()
{
	$filters = array(
		'project_id' => GETPOSTINT('project_id'),
		'convention_id' => GETPOSTINT('convention_id'),
		'activity_id' => GETPOSTINT('activity_id'),
		'status' => GETPOST('status', 'alphanohtml'),
	);
	print '<div class="mjl-workspace-header">';
	print '<div><p class="mjl-kicker">Lignes budgetaires MJL</p><h1>Gestion des lignes budgetaires</h1>';
	print '<p class="mjl-header-copy">Cadrez les enveloppes actives utilisees par les depenses, rapports et controles de solde.</p></div>';
	print '<div class="mjl-user-context"><span>Perimetre</span><strong>'.(mjl_budgetlines_can_manage() ? 'Validateur definitif / Administrateur plateforme' : 'Consultation').'</strong></div>';
	print '</div>';

	if (mjl_budgetlines_can_manage()) {
		mjl_budgetlines_render_create_form();
	}
	mjl_budgetlines_render_filters($filters);
	mjl_budgetlines_render_list($filters);
}

function mjl_budgetlines_render_detail($id)
{
	$row = mjl_budgetlines_fetch_detail($id);
	if (empty($row)) {
		mjl_budgetlines_forbidden('Ligne budgetaire introuvable ou hors de votre perimetre');
	}
	$canManage = mjl_budgetlines_can_manage();
	$hasExpenses = (int) $row['expenses'] > 0;

	print '<p><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/budgetlines.php">Retour aux budgets</a></p>';
	print '<div class="mjl-workspace-header">';
	print '<div><p class="mjl-kicker">Ligne budgetaire</p><h1>'.dol_escape_htmltag($row['ref']).' - '.dol_escape_htmltag($row['label']).'</h1>';
	print '<p class="mjl-header-copy">'.dol_escape_htmltag(mjl_budgetlines_next_action_label($row, $hasExpenses)).'</p></div>';
	print '<div class="mjl-user-context"><span>Statut</span><strong>'.dol_escape_htmltag(mjl_budgetline_status_label($row['status'])).'</strong></div>';
	print '</div>';

	print '<div class="mjl-activity-detail-grid">';
	mjl_budgetlines_render_summary($row);
	if ($canManage) {
		mjl_budgetlines_render_edit_form($row, $hasExpenses);
	}
	print '</div>';
	mjl_budgetlines_render_actions($row, $canManage);
	mjl_budgetlines_render_timeline($row);
}

function mjl_budgetlines_render_create_form()
{
	print '<section class="mjl-workspace-section mjl-activity-panel">';
	print '<div class="mjl-section-heading"><h2>Nouvelle ligne budgetaire</h2><p>Creer un brouillon rattache a une enveloppe active avant activation.</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/budgetlines.php">';
	print '<input type="hidden" name="action" value="create"><input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'">';
	mjl_budgetlines_render_fields(array(), false);
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Creer la ligne"></div>';
	print '</form></section>';
}

function mjl_budgetlines_render_edit_form($row, $hasExpenses)
{
	print '<section class="mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Parametres budgetaires</h2><p>'.($hasExpenses ? 'Les champs structurants sont verrouilles car des depenses existent.' : 'Modifier les donnees avant rattachement a des depenses.').'</p></div>';
	print '<form class="mjl-activity-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/budgetlines.php?id='.((int) $row['rowid']).'">';
	print '<input type="hidden" name="action" value="update"><input type="hidden" name="id" value="'.((int) $row['rowid']).'"><input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'">';
	mjl_budgetlines_render_fields($row, $hasExpenses);
	print '<label>Motif de modification<input required name="comment" value=""></label>';
	print '<div class="mjl-activity-form-actions"><input class="button" type="submit" value="Enregistrer"></div>';
	print '</form></section>';
}

function mjl_budgetlines_render_fields($row, $locked)
{
	$disabled = $locked ? ' disabled' : '';
	$hiddenLocked = array('ref', 'fk_project', 'fk_convention', 'fk_mjl_activity', 'fk_activity', 'initial_budget', 'category');
	print '<label>Reference<input required name="ref" value="'.dol_escape_htmltag($row['ref'] ?? '').'"'.$disabled.'></label>';
	print '<label>Libelle<input required name="label" value="'.dol_escape_htmltag($row['label'] ?? '').'"></label>';
	print '<label>Projet'.mjl_budgetlines_select('fk_project', mjl_budgetlines_options('project'), (int) ($row['fk_project'] ?? 0), true, $locked).'</label>';
	print '<label>Enveloppe active'.mjl_budgetlines_select('fk_convention', mjl_budgetlines_options('convention'), (int) ($row['fk_convention'] ?? 0), true, $locked).'</label>';
	print '<label>Activite MJL'.mjl_budgetlines_select('fk_mjl_activity', mjl_budgetlines_options('activity'), (int) ($row['fk_mjl_activity'] ?? 0), false, $locked).'</label>';
	print '<label>Tache projet'.mjl_budgetlines_select('fk_activity', mjl_budgetlines_options('task'), (int) ($row['fk_activity'] ?? 0), false, $locked).'</label>';
	print '<label>Budget initial<input name="initial_budget" value="'.dol_escape_htmltag($row['initial_budget'] ?? '').'"'.$disabled.'></label>';
	print '<label>Budget revise<input name="revised_budget" value="'.dol_escape_htmltag($row['revised_budget'] ?? '').'"></label>';
	print '<label>Categorie<input name="category" value="'.dol_escape_htmltag($row['category'] ?? '').'"'.$disabled.'></label>';
	print '<label>Note publique<textarea name="note_public">'.dol_escape_htmltag($row['note_public'] ?? '').'</textarea></label>';
	print '<label>Note privee<textarea name="note_private">'.dol_escape_htmltag($row['note_private'] ?? '').'</textarea></label>';
	print '<input type="hidden" name="committed_amount" value="'.dol_escape_htmltag((string) ($row['committed_amount'] ?? 0)).'">';
	print '<input type="hidden" name="spent_amount" value="'.dol_escape_htmltag((string) ($row['spent_amount'] ?? 0)).'">';
	print '<input type="hidden" name="remaining_amount" value="'.dol_escape_htmltag((string) ($row['remaining_amount'] ?? 0)).'">';
	if ($locked) {
		foreach ($hiddenLocked as $field) {
			print '<input type="hidden" name="'.$field.'" value="'.dol_escape_htmltag((string) ($row[$field] ?? '')).'">';
		}
	}
}

function mjl_budgetlines_render_filters($filters)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Filtres</h2><p>Limiter la vue par projet, enveloppe, activite ou statut.</p></div>';
	print '<form method="GET" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/budgetlines.php">';
	print '<div class="div-table-responsive-no-min"><table class="noborder centpercent"><tr class="liste_titre"><th>Projet</th><th>Enveloppe</th><th>Activite</th><th>Statut</th><th></th></tr>';
	print '<tr class="oddeven">';
	print '<td>'.mjl_budgetlines_select('project_id', mjl_budgetlines_options('project'), $filters['project_id'], false, false, 'Tous').'</td>';
	print '<td>'.mjl_budgetlines_select('convention_id', mjl_budgetlines_options('convention_all'), $filters['convention_id'], false, false, 'Toutes').'</td>';
	print '<td>'.mjl_budgetlines_select('activity_id', mjl_budgetlines_options('activity'), $filters['activity_id'], false, false, 'Toutes').'</td>';
	print '<td>'.mjl_budgetlines_status_select($filters['status']).'</td>';
	print '<td><input class="button" type="submit" value="Afficher"></td>';
	print '</tr></table></div></form></section>';
}

function mjl_budgetlines_render_list($filters)
{
	global $db, $conf;
	$where = array('bl.entity = '.((int) $conf->entity));
	if ($filters['project_id'] > 0) $where[] = 'bl.fk_project = '.((int) $filters['project_id']);
	if ($filters['convention_id'] > 0) $where[] = 'bl.fk_convention = '.((int) $filters['convention_id']);
	if ($filters['activity_id'] > 0) $where[] = 'bl.fk_mjl_activity = '.((int) $filters['activity_id']);
	if ($filters['status'] !== '') $where[] = 'bl.status = '.((int) $filters['status']);
	$sql = 'SELECT bl.rowid, bl.ref, bl.label, bl.revised_budget, bl.status, p.ref AS project_ref, c.ref AS convention_ref, a.ref AS activity_ref,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_submitted_amount_sql('es').') FROM '.$db->prefix().'mjlfinancement_expense es WHERE es.entity = bl.entity AND es.fk_budget_line = bl.rowid), 0) AS submitted_amount,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_prevalidated_amount_sql('ep').') FROM '.$db->prefix().'mjlfinancement_expense ep WHERE ep.entity = bl.entity AND ep.fk_budget_line = bl.rowid), 0) AS prevalidated_amount,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_final_validated_amount_sql('ef').') FROM '.$db->prefix().'mjlfinancement_expense ef WHERE ef.entity = bl.entity AND ef.fk_budget_line = bl.rowid), 0) AS final_validated_amount,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_disbursed_amount_sql('ed').') FROM '.$db->prefix().'mjlfinancement_expense ed WHERE ed.entity = bl.entity AND ed.fk_budget_line = bl.rowid), 0) AS disbursed_amount,';
	$sql .= ' (COALESCE(bl.revised_budget, 0) - COALESCE((SELECT SUM('.mjl_finance_final_validated_amount_sql('er').') FROM '.$db->prefix().'mjlfinancement_expense er WHERE er.entity = bl.entity AND er.fk_budget_line = bl.rowid), 0)) AS remaining_amount,';
	$sql .= ' (SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = bl.entity AND e.fk_budget_line = bl.rowid) AS expenses';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = bl.fk_project AND p.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = bl.fk_mjl_activity AND a.entity = bl.entity';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_scope_partner_sql_filter('c.fk_soc', $GLOBALS['user']);
	$sql .= ' ORDER BY bl.rowid DESC LIMIT 100';
	$resql = $db->query($sql);
	print '<section class="mjl-workspace-section"><div class="mjl-section-heading"><h2>Portefeuille budgetaire</h2><p>Les montants depenses et restants sont recalcules depuis les depenses validees.</p></div>';
	if (!$resql) {
		print '<div class="error">'.$db->lasterror().'</div></section>';
		return;
	}
	print '<div class="div-table-responsive-no-min mjl-dashboard-table"><table class="noborder centpercent">';
	print '<tr class="liste_titre"><th>Ligne</th><th>Projet</th><th>Enveloppe</th><th>Activite</th><th class="right">Budget revise</th><th class="right">Soumis</th><th class="right">Prevalide</th><th class="right">Valide definitif</th><th class="right">Decaisse</th><th class="right">Restant</th><th>Statut</th><th>Liens</th></tr>';
	$count = 0;
	while ($obj = $db->fetch_object($resql)) {
		$count++;
		print '<tr class="oddeven">';
		print '<td><a class="mjl-table-link" href="'.DOL_URL_ROOT.'/custom/mjlfinancement/budgetlines.php?id='.((int) $obj->rowid).'">'.dol_escape_htmltag($obj->ref).'</a><br><span class="opacitymedium">'.dol_escape_htmltag($obj->label).'</span></td>';
		print '<td>'.dol_escape_htmltag($obj->project_ref).'</td>';
		print '<td>'.dol_escape_htmltag($obj->convention_ref).'</td>';
		print '<td>'.dol_escape_htmltag($obj->activity_ref).'</td>';
		print '<td class="right">'.price($obj->revised_budget).'</td>';
		print '<td class="right">'.price($obj->submitted_amount).'</td>';
		print '<td class="right">'.price($obj->prevalidated_amount).'</td>';
		print '<td class="right">'.price($obj->final_validated_amount).'</td>';
		print '<td class="right">'.price($obj->disbursed_amount).'</td>';
		print '<td class="right">'.price($obj->remaining_amount).'</td>';
		print '<td>'.mjl_budgetlines_status_badge($obj->status).'</td>';
		print '<td>'.((int) $obj->expenses).' depense(s)</td>';
		print '</tr>';
	}
	if ($count === 0) {
		print '<tr class="oddeven"><td colspan="12">Aucune ligne budgetaire dans votre perimetre.</td></tr>';
	}
	print '</table></div></section>';
}

function mjl_budgetlines_render_summary($row)
{
	$metrics = mjl_finance_metrics_for_budget_line((int) $row['rowid'], (int) $row['entity']);
	print '<section class="mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Synthese budgetaire</h2><p>Execution et rattachements controles.</p></div>';
	print '<dl class="mjl-activity-meta">';
	print '<div><dt>Statut</dt><dd>'.mjl_budgetlines_status_badge($row['status']).'</dd></div>';
	print '<div><dt>Projet</dt><dd>'.dol_escape_htmltag($row['project_ref']).' - '.dol_escape_htmltag($row['project_title']).'</dd></div>';
	print '<div><dt>Enveloppe</dt><dd>'.dol_escape_htmltag($row['convention_ref']).' - '.dol_escape_htmltag($row['convention_title']).'</dd></div>';
	print '<div><dt>Activite</dt><dd>'.dol_escape_htmltag($row['activity_ref']).' '.dol_escape_htmltag($row['activity_label']).'</dd></div>';
	print '<div><dt>Tache projet</dt><dd>'.dol_escape_htmltag($row['task_label']).'</dd></div>';
	print '<div><dt>Budget initial</dt><dd>'.price($row['initial_budget']).'</dd></div>';
	print '<div><dt>Budget revise</dt><dd>'.price($row['revised_budget']).'</dd></div>';
	print '<div><dt>Soumis</dt><dd>'.price($metrics['submitted_amount']).'</dd></div>';
	print '<div><dt>Prevalide</dt><dd>'.price($metrics['prevalidated_amount']).'</dd></div>';
	print '<div><dt>Valide definitif</dt><dd>'.price($metrics['final_validated_amount']).'</dd></div>';
	print '<div><dt>Decaisse</dt><dd>'.price($metrics['disbursed_amount']).'</dd></div>';
	print '<div><dt>Restant</dt><dd>'.price($metrics['remaining_amount']).'</dd></div>';
	print '<div><dt>Taux validation</dt><dd>'.dol_escape_htmltag($metrics['validation_rate']).'%</dd></div>';
	print '<div><dt>Taux execution</dt><dd>'.dol_escape_htmltag($metrics['execution_rate']).'%</dd></div>';
	print '<div><dt>Depenses rattachees</dt><dd>'.((int) $row['expenses']).'</dd></div>';
	print '</dl></section>';
}

function mjl_budgetlines_render_actions($row, $canManage)
{
	if (!$canManage) return;
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Cycle de vie</h2><p>Activation de la ligne apres verification des rattachements et montants.</p></div>';
	if ((int) $row['status'] === MjlBudgetLine::STATUS_DRAFT) {
		mjl_budgetlines_action_form($row['rowid'], 'activate', 'Activer la ligne', 'Commentaire d activation', false);
	} else {
		print '<div class="mjl-empty-state">Ligne active disponible pour les depenses autorisees.</div>';
	}
	print '</section>';
}

function mjl_budgetlines_action_form($id, $action, $label, $commentLabel, $required)
{
	print '<form class="mjl-activity-action-form" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/budgetlines.php?id='.((int) $id).'">';
	print '<input type="hidden" name="token" value="'.dol_escape_htmltag(newToken()).'"><input type="hidden" name="action" value="'.dol_escape_htmltag($action).'"><input type="hidden" name="id" value="'.((int) $id).'">';
	if ($commentLabel !== '') {
		print '<label>'.dol_escape_htmltag($commentLabel).'<input'.($required ? ' required' : '').' name="comment"></label>';
	}
	print '<input class="button" type="submit" value="'.dol_escape_htmltag($label).'">';
	print '</form>';
}

function mjl_budgetlines_render_timeline($row)
{
	$items = mjl_budgetlines_timeline_items($row);
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>Historique ligne budgetaire</h2><p>Creation, modifications, activation, tentatives refusees et commentaires.</p></div>';
	mjl_timeline_render_comment_form('mjlfinancement_budget_line', (int) $row['rowid'], DOL_URL_ROOT.'/custom/mjlfinancement/budgetlines.php?id='.((int) $row['rowid']));
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
				print '<li>'.dol_escape_htmltag($field).': '.dol_escape_htmltag(mjl_budgetlines_change_text($change)).'</li>';
			}
			print '</ul></details>';
		}
		print '</li>';
	}
	print '</ol></section>';
}

function mjl_budgetlines_fetch_detail($id)
{
	global $db, $conf;
	$sql = 'SELECT bl.rowid, bl.entity, bl.ref, bl.label, bl.fk_project, bl.fk_convention, bl.fk_mjl_activity, bl.fk_activity, bl.initial_budget, bl.revised_budget, bl.committed_amount, bl.spent_amount, bl.remaining_amount, bl.category, bl.note_public, bl.note_private, bl.status, bl.date_creation,';
	$sql .= ' p.ref AS project_ref, p.title AS project_title, c.ref AS convention_ref, c.title AS convention_title, a.ref AS activity_ref, a.label AS activity_label, t.label AS task_label, u.login AS creator_login,';
	$sql .= ' (SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = bl.entity AND e.fk_budget_line = bl.rowid) AS expenses';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = bl.fk_project AND p.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = bl.fk_mjl_activity AND a.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet_task t ON t.rowid = bl.fk_activity AND t.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = bl.fk_user_creat';
	$sql .= ' WHERE bl.entity = '.((int) $conf->entity).' AND bl.rowid = '.((int) $id);
	$sql .= mjl_scope_partner_sql_filter('c.fk_soc', $GLOBALS['user']);
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return array();
	}
	$obj = $db->fetch_object($resql);
	return $obj ? (array) $obj : array();
}

function mjl_budgetlines_timeline_items($row)
{
	global $db, $conf;
	$items = array(array(
		'label' => 'Creee',
		'title' => 'Ligne budgetaire creee',
		'meta' => mjl_budgetlines_format_datetime($row['date_creation']).' par '.$row['creator_login'],
		'comment' => '',
		'changes' => array(),
	));
	$sql = 'SELECT w.action, w.from_status, w.to_status, w.actor_role, w.action_date, w.comment, w.changes_json, u.login';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE w.entity = '.((int) $conf->entity).' AND w.object_type = \'mjlfinancement_budget_line\' AND w.object_id = '.((int) $row['rowid']);
	$sql .= ' ORDER BY w.action_date ASC, w.rowid ASC';
	$resql = $db->query($sql);
	if (!$resql) {
		setEventMessages($db->lasterror(), null, 'errors');
		return $items;
	}
	while ($obj = $db->fetch_object($resql)) {
		$changes = json_decode((string) $obj->changes_json, true);
		$items[] = array(
			'label' => mjl_budgetline_action_label($obj->action),
			'title' => mjl_budgetline_status_label($obj->from_status).' vers '.mjl_budgetline_status_label($obj->to_status),
			'meta' => mjl_budgetlines_format_datetime($obj->action_date).' par '.$obj->login.' ('.mjl_budgetline_actor_role_label($obj->actor_role).')',
			'comment' => (string) $obj->comment,
			'changes' => is_array($changes) ? $changes : array(),
		);
	}
	foreach (mjl_timeline_exchange_items('mjlfinancement_budget_line', (int) $row['rowid'], true) as $item) {
		$items[] = $item;
	}
	return $items;
}

function mjl_budgetlines_options($type)
{
	global $db, $conf;
	if ($type === 'project') {
		$sql = 'SELECT rowid, CONCAT(ref, \' - \', title) AS label FROM '.$db->prefix().'projet p WHERE p.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('p.fk_soc', $GLOBALS['user']).' ORDER BY p.ref';
	} elseif ($type === 'convention') {
		$sql = 'SELECT rowid, CONCAT(ref, \' - \', title) AS label FROM '.$db->prefix().'mjlfinancement_convention c WHERE c.entity = '.((int) $conf->entity).' AND c.status = '.MjlConvention::STATUS_ACTIVE.mjl_scope_partner_sql_filter('c.fk_soc', $GLOBALS['user']).' ORDER BY c.ref';
	} elseif ($type === 'convention_all') {
		$sql = 'SELECT rowid, CONCAT(ref, \' - \', title) AS label FROM '.$db->prefix().'mjlfinancement_convention c WHERE c.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('c.fk_soc', $GLOBALS['user']).' ORDER BY c.ref';
	} elseif ($type === 'activity') {
		$sql = 'SELECT a.rowid, CONCAT(a.ref, \' - \', a.label) AS label FROM '.$db->prefix().'mjlfinancement_activity a INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity WHERE a.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('c.fk_soc', $GLOBALS['user']).' ORDER BY a.ref';
	} elseif ($type === 'task') {
		$sql = 'SELECT t.rowid, CONCAT(t.ref, \' - \', t.label) AS label FROM '.$db->prefix().'projet_task t INNER JOIN '.$db->prefix().'projet p ON p.rowid = t.fk_projet AND p.entity = t.entity WHERE t.entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('p.fk_soc', $GLOBALS['user']).' ORDER BY t.ref';
	} else {
		return array();
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

function mjl_budgetlines_can_use_links($fkProject, $fkConvention, $fkMjlActivity, $fkTask)
{
	global $db, $conf, $user;
	$fkProject = (int) $fkProject;
	$fkConvention = (int) $fkConvention;
	$fkMjlActivity = (int) $fkMjlActivity;
	$fkTask = (int) $fkTask;
	if ($fkProject <= 0 || $fkConvention <= 0) return false;
	$sql = 'SELECT c.rowid, c.fk_soc, c.fk_project FROM '.$db->prefix().'mjlfinancement_convention c WHERE c.entity = '.((int) $conf->entity).' AND c.rowid = '.$fkConvention.' AND c.status = '.MjlConvention::STATUS_ACTIVE;
	$resql = $db->query($sql);
	$convention = $resql ? $db->fetch_object($resql) : null;
	if (!$convention || !mjl_scope_can_access_fk_soc($user, (int) $convention->fk_soc)) return false;
	if ((int) $convention->fk_project > 0 && (int) $convention->fk_project !== $fkProject) return false;
	$sql = 'SELECT rowid FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' AND rowid = '.$fkProject.' AND fk_soc = '.((int) $convention->fk_soc);
	$resql = $db->query($sql);
	if (!$resql || !$db->fetch_object($resql)) return false;
	if ($fkMjlActivity > 0 && !mjl_scope_can_access_object($user, 'mjlfinancement_activity', $fkMjlActivity)) return false;
	if ($fkTask > 0) {
		$sql = 'SELECT t.rowid FROM '.$db->prefix().'projet_task t WHERE t.entity = '.((int) $conf->entity).' AND t.rowid = '.$fkTask.' AND t.fk_projet = '.$fkProject;
		$resql = $db->query($sql);
		if (!$resql || !$db->fetch_object($resql)) return false;
	}
	return true;
}

function mjl_budgetlines_select($name, $options, $selected, $required, $disabled, $emptyLabel = 'Aucun')
{
	$html = '<select name="'.dol_escape_htmltag($name).'"'.($required ? ' required' : '').($disabled ? ' disabled' : '').'>';
	if (!$required || $emptyLabel !== '') {
		$html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	}
	foreach ($options as $value => $label) {
		$html .= '<option value="'.((int) $value).'"'.((int) $selected === (int) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_budgetlines_status_select($selected)
{
	$options = array('' => 'Tous', (string) MjlBudgetLine::STATUS_DRAFT => 'Brouillon', (string) MjlBudgetLine::STATUS_ACTIVE => 'Active');
	$html = '<select name="status">';
	foreach ($options as $value => $label) {
		$html .= '<option value="'.dol_escape_htmltag($value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	return $html.'</select>';
}

function mjl_budgetlines_can_manage()
{
	global $user;
	return mjl_workspace_can_access_supervision($user) && $user->hasRight('mjlfinancement', 'budgetline', 'write');
}

function mjl_budgetline_status_label($status)
{
	$map = array(
		(string) MjlBudgetLine::STATUS_DRAFT => 'Brouillon',
		(string) MjlBudgetLine::STATUS_ACTIVE => 'Active',
		'draft' => 'Brouillon',
		'active' => 'Active',
		'deleted' => 'Supprimee',
	);
	$key = (string) $status;
	return isset($map[$key]) ? $map[$key] : $key;
}

function mjl_budgetline_action_label($action)
{
	$map = array('created' => 'Creation', 'field_changed' => 'Modification', 'unsafe_edit_rejected' => 'Modification refusee', 'activated' => 'Activation', 'deleted' => 'Suppression');
	return isset($map[$action]) ? $map[$action] : (string) $action;
}

function mjl_budgetline_actor_role_label($role)
{
	return mjl_actor_role_label($role);
}

function mjl_budgetlines_status_badge($status)
{
	$tone = (int) $status === MjlBudgetLine::STATUS_DRAFT ? 'warning' : 'neutral';
	return '<span class="mjl-status-pill'.($tone !== 'neutral' ? ' mjl-status-'.$tone : '').'">'.dol_escape_htmltag(mjl_budgetline_status_label($status)).'</span>';
}

function mjl_budgetlines_next_action_label($row, $hasExpenses)
{
	if ((int) $row['status'] === MjlBudgetLine::STATUS_DRAFT) return 'Verifier les rattachements puis activer la ligne budgetaire.';
	if ($hasExpenses) return 'Ligne active: les champs structurants sont verrouilles et les montants sont recalcules.';
	return 'Ligne active disponible pour les depenses autorisees.';
}

function mjl_budgetlines_change_text($change)
{
	if (is_array($change) && array_key_exists('before', $change) && array_key_exists('after', $change)) {
		return (string) $change['before'].' -> '.(string) $change['after'];
	}
	if (is_array($change)) {
		return implode(', ', array_map('strval', $change));
	}
	return (string) $change;
}

function mjl_budgetlines_format_datetime($value)
{
	if (empty($value)) return '';
	$time = strtotime((string) $value);
	return $time > 0 ? dol_print_date($time, 'dayhour') : (string) $value;
}

function mjl_budgetlines_forbidden($message = '')
{
	if (function_exists('http_response_code')) {
		http_response_code(403);
	} else {
		header('HTTP/1.1 403 Forbidden');
	}
	accessforbidden($message);
}

function mjl_budgetlines_redirect($id)
{
	$url = DOL_URL_ROOT.'/custom/mjlfinancement/budgetlines.php';
	if ((int) $id > 0) {
		$url .= '?id='.((int) $id);
	}
	header('Location: '.$url);
	exit;
}
