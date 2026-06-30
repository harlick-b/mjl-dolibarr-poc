<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reporting.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_csv_export.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

mjl_workspace_require_supervision_access($user);

$langs->load('mjlfinancement@mjlfinancement');

$report = GETPOST('report', 'alpha') ?: 'project_summary';
$def = mjl_reports_def($report);
$report = $def['key'];
$action = GETPOST('action', 'alpha');
$rawFilters = mjl_reports_raw_filters();
$filters = mjl_reports_normalize_filters($def, $rawFilters);
$missingRequired = mjl_reports_missing_required_filters($def, $filters);
$rows = empty($missingRequired) ? mjl_reports_formatted_rows($report, $filters) : array();
$filename = mjl_reports_export_filename($def, $filters);

if ($action === 'export_csv') {
	if (empty($user->admin) && !$user->hasRight('mjlfinancement', 'export', 'write')) {
		accessforbidden();
	}
	if (!empty($missingRequired)) {
		accessforbidden('Selection requise avant export: '.implode(', ', $missingRequired));
	}
	mjl_csv_export_output($filename, $def['headers'], $rows);
	exit;
}

llxHeader('', 'Centre d\'exports MJL');

mjl_navigation_shell_start($user, 'reports');
print '<div class="mjl-workspace mjl-reports-workspace">';
mjl_dashboard_render_header(
	'Centre d\'exports MJL',
	'Generer des sorties officielles lisibles, filtrees et compatibles Excel sans exposer les details techniques Dolibarr.',
	'Perimetre',
	!empty($user->admin) ? 'Administration' : 'Supervision DPAF'
);

mjl_reports_render_selector($report);
mjl_reports_render_filter_bar($def, $filters);
mjl_reports_render_context($def, $filters, $filename, $missingRequired, $user);
mjl_reports_render_table($def, $rows, $missingRequired);

print '</div>';
mjl_navigation_shell_end();

llxFooter();
$db->close();

function mjl_reports_defs()
{
	return array(
		'project_summary' => array(
			'key' => 'project_summary',
			'label' => 'Synthese financiere par projet',
			'description' => 'Comparer budget, fonds recus et depenses pour un projet selectionne.',
			'scope' => 'Projet',
			'slug' => 'synthese_projet',
			'filters' => array('project_id', 'date_start', 'date_end'),
			'required_filters' => array('project_id'),
			'status_domain' => '',
			'headers' => array('project_ref' => 'Projet', 'project_title' => 'Titre projet', 'budget_total' => 'Budget total', 'funds_received' => 'Fonds recus', 'total_expenses' => 'Depenses totales', 'validated_expenses' => 'Depenses validees', 'pending_expenses' => 'Depenses soumises'),
			'money_fields' => array('budget_total', 'funds_received', 'total_expenses', 'validated_expenses', 'pending_expenses'),
		),
		'convention_budget' => array(
			'key' => 'convention_budget',
			'label' => 'Execution budgetaire par convention',
			'description' => 'Suivre les lignes budgetaires, les depenses validees et le solde restant.',
			'scope' => 'Convention',
			'slug' => 'budget_convention',
			'filters' => array('convention_id', 'date_start', 'date_end'),
			'required_filters' => array('convention_id'),
			'status_domain' => '',
			'headers' => array('ref' => 'Ligne budgetaire', 'label' => 'Libelle', 'initial_budget' => 'Budget initial', 'revised_budget' => 'Budget revise', 'status' => 'Statut', 'validated_expenses' => 'Depenses validees', 'submitted_expenses' => 'Depenses soumises', 'remaining_amount' => 'Restant'),
			'money_fields' => array('initial_budget', 'revised_budget', 'validated_expenses', 'submitted_expenses', 'remaining_amount'),
		),
		'expense_documents' => array(
			'key' => 'expense_documents',
			'label' => 'Liste des depenses avec pieces justificatives',
			'description' => 'Controler la presence des justificatifs et les motifs de correction.',
			'scope' => 'Depenses',
			'slug' => 'depenses_pieces',
			'filters' => array('project_id', 'convention_id', 'status', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => 'expense',
			'headers' => array('expense_ref' => 'Depense', 'expense_date' => 'Date depense', 'budget_line' => 'Ligne budgetaire', 'amount' => 'Montant', 'status' => 'Statut', 'document_present' => 'Piece presente', 'supporting_document' => 'Piece justificative', 'validator' => 'Validateur', 'correction_reason' => 'Motif correction'),
			'money_fields' => array('amount'),
			'date_fields' => array('expense_date'),
		),
		'activities' => array(
			'key' => 'activities',
			'label' => 'Suivi des activites',
			'description' => 'Exporter les activites, leur statut, leur risque echeance et leurs indicateurs budgetaires.',
			'scope' => 'Activites',
			'slug' => 'suivi_activites',
			'filters' => array('project_id', 'convention_id', 'status', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => 'activity',
			'headers' => array('partner' => 'Partenaire', 'project' => 'Projet', 'envelope' => 'Mission / enveloppe de financement', 'activity_ref' => 'Reference activite', 'activity_title' => 'Titre activite', 'date_start' => 'Date de debut', 'date_end' => 'Date de fin', 'status_label' => 'Statut', 'physical_progress_percent' => 'Taux d execution physique', 'performance_index' => 'Indice de performance', 'current_reviewer' => 'Responsable actuel', 'deadline_alert' => 'Alerte echeance', 'allocated_budget' => 'Budget alloue', 'validated_expenses' => 'Depenses validees', 'remaining_budget' => 'Budget restant'),
			'money_fields' => array('allocated_budget', 'validated_expenses', 'remaining_budget'),
			'date_fields' => array('date_start', 'date_end'),
		),
		'workflow_actions' => array(
			'key' => 'workflow_actions',
			'label' => 'Historique decisions / audit',
			'description' => 'Exporter les decisions et transitions auditees sur activites et depenses.',
			'scope' => 'Audit',
			'slug' => 'historique_decisions_audit',
			'filters' => array('date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('object_type_label' => 'Type d objet', 'object_ref' => 'Reference objet', 'decision' => 'Action / decision', 'from_status' => 'Ancien statut', 'to_status' => 'Nouveau statut', 'previous_value' => 'Ancienne valeur', 'new_value' => 'Nouvelle valeur', 'actor' => 'Acteur', 'actor_role' => 'Role', 'action_date' => 'Date', 'comment' => 'Commentaire / motif'),
			'date_fields' => array('action_date'),
		),
		'expenses_validations' => array(
			'key' => 'expenses_validations',
			'label' => 'Suivi des depenses',
			'description' => 'Exporter les depenses, leurs statuts de validation et les justificatifs associes.',
			'scope' => 'Depenses',
			'slug' => 'suivi_depenses',
			'filters' => array('project_id', 'convention_id', 'status', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => 'expense',
			'headers' => array('partner' => 'Partenaire', 'project' => 'Projet', 'envelope' => 'Mission / enveloppe de financement', 'activity' => 'Activite', 'expense_ref' => 'Reference depense', 'expense_date' => 'Date depense', 'amount' => 'Montant', 'expense_status' => 'Statut', 'document_present' => 'Piece justificative presente', 'creator' => 'Creee par', 'validator' => 'Validee par', 'validation_date' => 'Date de validation', 'correction_reason' => 'Motif de correction'),
			'money_fields' => array('amount'),
			'date_fields' => array('expense_date', 'validation_date'),
		),
		'exchanges' => array(
			'key' => 'exchanges',
			'label' => 'Export echanges',
			'description' => 'Exporter les echanges rattaches aux objets MJL pour la tracabilite.',
			'scope' => 'Echanges',
			'slug' => 'echanges',
			'filters' => array('date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('ref' => 'Ref echange', 'object_type' => 'Type objet', 'object_id' => 'ID objet', 'activity_ref' => 'Activite', 'exchange_date' => 'Date echange', 'login' => 'Acteur', 'actor_role' => 'Role acteur', 'channel' => 'Canal', 'subject' => 'Sujet', 'message' => 'Message'),
			'date_fields' => array('exchange_date'),
		),
		'dpaf_summary' => array(
			'key' => 'dpaf_summary',
			'label' => 'Export synthese DPAF',
			'description' => 'Exporter une synthese portefeuille par convention pour la supervision DPAF.',
			'scope' => 'Portefeuille DPAF',
			'slug' => 'synthese_dpaf',
			'filters' => array('project_id', 'convention_id'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('convention_ref' => 'Convention', 'budget_revise' => 'Budget revise', 'depenses_validees' => 'Depenses validees', 'depenses_soumises' => 'Depenses soumises', 'fonds_recus' => 'Fonds recus', 'activites_en_revue' => 'Activites en revue', 'depenses_en_revue' => 'Depenses en revue'),
			'money_fields' => array('budget_revise', 'depenses_validees', 'depenses_soumises', 'fonds_recus'),
		),
	);
}

function mjl_reports_def($report)
{
	$defs = mjl_reports_defs();
	return isset($defs[$report]) ? $defs[$report] : $defs['project_summary'];
}

function mjl_reports_raw_filters()
{
	return array(
		'project_id' => GETPOSTINT('project_id'),
		'convention_id' => GETPOSTINT('convention_id'),
		'status' => GETPOST('status', 'alpha'),
		'date_start' => GETPOST('date_start', 'alphanohtml'),
		'date_end' => GETPOST('date_end', 'alphanohtml'),
	);
}

function mjl_reports_normalize_filters($def, $raw)
{
	$filters = array(
		'project_id' => 0,
		'convention_id' => 0,
		'status' => '',
		'date_start' => '',
		'date_end' => '',
	);
	foreach ($filters as $key => $value) {
		if (!in_array($key, $def['filters'], true)) {
			continue;
		}
		if ($key === 'project_id' || $key === 'convention_id') {
			$filters[$key] = max(0, (int) $raw[$key]);
		} elseif ($key === 'status') {
			$filters[$key] = mjl_reports_valid_status($def['status_domain'], $raw[$key]);
		} elseif ($key === 'date_start' || $key === 'date_end') {
			$filters[$key] = mjl_reports_valid_date($raw[$key]);
		}
	}
	return $filters;
}

function mjl_reports_valid_status($domain, $value)
{
	if ($value === '') {
		return '';
	}
	$options = $domain === 'activity' ? mjl_reports_activity_status_options() : ($domain === 'expense' ? mjl_reports_expense_status_options() : array());
	$value = (string) ((int) $value);
	return array_key_exists($value, $options) ? $value : '';
}

function mjl_reports_valid_date($value)
{
	if ($value === '') {
		return '';
	}
	if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $value)) {
		return '';
	}
	$parts = explode('-', (string) $value);
	return checkdate((int) $parts[1], (int) $parts[2], (int) $parts[0]) ? (string) $value : '';
}

function mjl_reports_missing_required_filters($def, $filters)
{
	$missing = array();
	foreach ($def['required_filters'] as $filter) {
		if ($filter === 'project_id' && empty($filters['project_id'])) {
			$missing[] = 'Projet';
		}
		if ($filter === 'convention_id' && empty($filters['convention_id'])) {
			$missing[] = 'Convention';
		}
	}
	return $missing;
}

function mjl_reports_rows($report, $filters)
{
	if ($report === 'project_summary') {
		if (empty($filters['project_id'])) return array();
		$row = mjl_report_project_summary($filters['project_id'], $filters);
		return empty($row) ? array() : array($row);
	}
	if ($report === 'convention_budget') {
		if (empty($filters['convention_id'])) return array();
		return mjl_report_convention_budget($filters['convention_id'], $filters);
	}
	if ($report === 'expense_documents') {
		return mjl_report_expense_documents($filters);
	}
	if ($report === 'activities') {
		return mjl_reports_activities_rows($filters);
	}
	if ($report === 'workflow_actions') {
		return mjl_reports_workflow_rows($filters);
	}
	if ($report === 'expenses_validations') {
		return mjl_reports_expenses_validations_rows($filters);
	}
	if ($report === 'exchanges') {
		return mjl_reports_exchange_rows($filters);
	}
	if ($report === 'dpaf_summary') {
		return mjl_reports_dpaf_rows($filters);
	}
	return array();
}

function mjl_reports_formatted_rows($report, $filters)
{
	$def = mjl_reports_def($report);
	$rows = mjl_reports_rows($report, $filters);
	foreach ($rows as &$row) {
		$row = mjl_reports_format_row($def, $row);
	}
	unset($row);
	return $rows;
}

function mjl_reports_format_row($def, $row)
{
	if ($def['key'] === 'expense_documents' && isset($row['status'])) {
		$row['status'] = mjl_reports_expense_status_label($row['status']);
	}
	if ($def['key'] === 'convention_budget' && isset($row['status'])) {
		$row['status'] = mjl_reports_budget_status_label($row['status']);
	}
	if (isset($row['document_present'])) {
		$row['document_present'] = ((int) $row['document_present'] === 1 || $row['document_present'] === 'Oui') ? 'Oui' : 'Non';
	}
	foreach (isset($def['money_fields']) ? $def['money_fields'] : array() as $field) {
		if (isset($row[$field]) && $row[$field] !== '') {
			$row[$field] = price($row[$field]);
		}
	}
	foreach (isset($def['date_fields']) ? $def['date_fields'] : array() as $field) {
		if (isset($row[$field]) && $row[$field] !== '') {
			$row[$field] = mjl_reports_format_date($row[$field]);
		}
	}
	return $row;
}

function mjl_reports_render_selector($selectedReport)
{
	print '<section class="mjl-workspace-section mjl-report-selector">';
	print '<div class="mjl-section-heading"><h2>Rapport officiel</h2><p>Choisir le jeu de donnees a previsualiser et exporter.</p></div>';
	print '<form method="GET" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<label for="mjl-report-select">Rapport</label>';
	print '<select id="mjl-report-select" name="report" onchange="this.form.submit()">';
	foreach (mjl_reports_defs() as $key => $def) {
		print '<option value="'.dol_escape_htmltag($key).'"'.($selectedReport === $key ? ' selected' : '').'>'.dol_escape_htmltag($def['label']).'</option>';
	}
	print '</select>';
	$def = mjl_reports_def($selectedReport);
	print '<p class="mjl-report-description">'.dol_escape_htmltag($def['description']).'</p>';
	print '<noscript><button class="button" type="submit">Changer de rapport</button></noscript>';
	print '</form>';
	print '</section>';
}

function mjl_reports_render_filter_bar($def, $filters)
{
	$projectOptions = mjl_reports_project_options();
	$conventionOptions = mjl_reports_convention_options();
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Filtres</h2><p>Seuls les filtres utiles au rapport selectionne sont affiches.</p></div>';
	print '<form class="mjl-report-filter-bar" method="GET" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<input type="hidden" name="report" value="'.dol_escape_htmltag($def['key']).'">';
	if (in_array('project_id', $def['filters'], true)) {
		print '<label>Projet'.mjl_reports_required_marker($def, 'project_id').mjl_reports_select('project_id', $projectOptions, $filters['project_id'], 'Tous les projets').'</label>';
	}
	if (in_array('convention_id', $def['filters'], true)) {
		print '<label>Convention'.mjl_reports_required_marker($def, 'convention_id').mjl_reports_select('convention_id', $conventionOptions, $filters['convention_id'], 'Toutes les conventions').'</label>';
	}
	if (in_array('status', $def['filters'], true)) {
		$options = $def['status_domain'] === 'activity' ? mjl_reports_activity_status_options() : mjl_reports_expense_status_options();
		print '<label>Statut'.mjl_reports_status_select($options, $filters['status']).'</label>';
	}
	if (in_array('date_start', $def['filters'], true)) {
		print '<label>Date debut<input type="date" name="date_start" value="'.dol_escape_htmltag($filters['date_start']).'"></label>';
	}
	if (in_array('date_end', $def['filters'], true)) {
		print '<label>Date fin<input type="date" name="date_end" value="'.dol_escape_htmltag($filters['date_end']).'"></label>';
	}
	print '<div class="mjl-report-filter-actions">';
	print '<button class="button" type="submit">Afficher</button>';
	print '</div>';
	print '</form>';
	print '</section>';
}

function mjl_reports_render_context($def, $filters, $filename, $missingRequired, User $targetUser)
{
	$canExport = !empty($targetUser->admin) || $targetUser->hasRight('mjlfinancement', 'export', 'write');
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Contexte export</h2><p>Les informations ci-dessous seront coherentes avec le fichier CSV genere.</p></div>';
	print '<div class="mjl-report-context">';
	print '<dl class="mjl-activity-meta">';
	print '<div><dt>Rapport</dt><dd>'.dol_escape_htmltag($def['label']).'</dd></div>';
	print '<div><dt>Perimetre</dt><dd>'.dol_escape_htmltag($def['scope']).'</dd></div>';
	print '<div><dt>Periode</dt><dd>'.dol_escape_htmltag(mjl_reports_period_label($filters)).'</dd></div>';
	print '<div><dt>Format</dt><dd>CSV compatible Excel</dd></div>';
	print '<div><dt>Restrictions</dt><dd>'.($canExport ? 'Export autorise pour ce profil' : 'Previsualisation uniquement').'</dd></div>';
	print '<div><dt>Nom du fichier</dt><dd data-testid="mjl-report-filename">'.dol_escape_htmltag($filename).'</dd></div>';
	print '</dl>';
	print '<div class="mjl-report-active-filters"><strong>Filtres actifs</strong><span>'.dol_escape_htmltag(mjl_reports_filter_summary($def, $filters)).'</span></div>';
	if (!empty($missingRequired)) {
		print '<div class="mjl-empty-state">Selection requise avant export: '.dol_escape_htmltag(implode(', ', $missingRequired)).'.</div>';
	}
	if ($canExport) {
		print '<form class="mjl-report-export-toolbar" method="GET" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
		print '<input type="hidden" name="report" value="'.dol_escape_htmltag($def['key']).'">';
		foreach ($filters as $key => $value) {
			if (($key === 'project_id' || $key === 'convention_id') && (int) $value <= 0) {
				continue;
			}
			if (($key === 'status' || $key === 'date_start' || $key === 'date_end') && $value === '') {
				continue;
			}
			if (in_array($key, $def['filters'], true)) {
				print '<input type="hidden" name="'.dol_escape_htmltag($key).'" value="'.dol_escape_htmltag((string) $value).'">';
			}
		}
		print '<button class="button" type="submit" name="action" value="export_csv"'.(!empty($missingRequired) ? ' disabled' : '').'>Exporter le CSV</button>';
		print '</form>';
	}
	print '</div>';
	print '</section>';
}

function mjl_reports_render_table($def, $rows, $missingRequired)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Previsualisation</h2><p>Le tableau reprend les colonnes du fichier CSV.</p></div>';
	if (!empty($missingRequired)) {
		print '<div class="mjl-empty-state">Aucune previsualisation tant que les filtres requis ne sont pas renseignes.</div>';
		print '</section>';
		return;
	}
	print '<div class="div-table-responsive-no-min mjl-dashboard-table mjl-report-table"><table class="noborder centpercent">';
	print '<tr class="liste_titre">';
	foreach ($def['headers'] as $header) {
		print '<th>'.dol_escape_htmltag($header).'</th>';
	}
	print '</tr>';
	if (empty($rows)) {
		print '<tr class="oddeven"><td colspan="'.count($def['headers']).'">Aucune donnee pour ces filtres.</td></tr>';
	} else {
		foreach ($rows as $row) {
			print '<tr class="oddeven">';
			foreach (array_keys($def['headers']) as $key) {
				print '<td>'.dol_escape_htmltag(isset($row[$key]) ? $row[$key] : '').'</td>';
			}
			print '</tr>';
		}
	}
	print '</table></div>';
	print '</section>';
}

function mjl_reports_required_marker($def, $filter)
{
	return in_array($filter, $def['required_filters'], true) ? ' *' : '';
}

function mjl_reports_status_select($options, $selected)
{
	$html = '<select name="status">';
	$html .= '<option value="">Tous les statuts</option>';
	foreach ($options as $value => $label) {
		$html .= '<option value="'.dol_escape_htmltag((string) $value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	$html .= '</select>';
	return $html;
}

function mjl_reports_select($name, $options, $selected, $emptyLabel)
{
	$html = '<select name="'.dol_escape_htmltag($name).'">';
	$html .= '<option value="">'.dol_escape_htmltag($emptyLabel).'</option>';
	foreach ($options as $value => $label) {
		$html .= '<option value="'.((int) $value).'"'.((string) $selected === (string) $value ? ' selected' : '').'>'.dol_escape_htmltag($label).'</option>';
	}
	$html .= '</select>';
	return $html;
}

function mjl_reports_filter_summary($def, $filters)
{
	$parts = array();
	$projectOptions = mjl_reports_project_options();
	$conventionOptions = mjl_reports_convention_options();
	if (in_array('project_id', $def['filters'], true) && !empty($filters['project_id'])) {
		$parts[] = 'Projet: '.(isset($projectOptions[$filters['project_id']]) ? $projectOptions[$filters['project_id']] : '#'.$filters['project_id']);
	}
	if (in_array('convention_id', $def['filters'], true) && !empty($filters['convention_id'])) {
		$parts[] = 'Convention: '.(isset($conventionOptions[$filters['convention_id']]) ? $conventionOptions[$filters['convention_id']] : '#'.$filters['convention_id']);
	}
	if (in_array('status', $def['filters'], true) && $filters['status'] !== '') {
		$options = $def['status_domain'] === 'activity' ? mjl_reports_activity_status_options() : mjl_reports_expense_status_options();
		$parts[] = 'Statut: '.(isset($options[$filters['status']]) ? $options[$filters['status']] : $filters['status']);
	}
	if ($filters['date_start'] !== '') {
		$parts[] = 'Debut: '.mjl_reports_format_date($filters['date_start']);
	}
	if ($filters['date_end'] !== '') {
		$parts[] = 'Fin: '.mjl_reports_format_date($filters['date_end']);
	}
	return empty($parts) ? 'Aucun filtre optionnel actif' : implode(' | ', $parts);
}

function mjl_reports_period_label($filters)
{
	if ($filters['date_start'] === '' && $filters['date_end'] === '') {
		return 'Toutes periodes';
	}
	return ($filters['date_start'] !== '' ? mjl_reports_format_date($filters['date_start']) : 'Debut libre').' - '.($filters['date_end'] !== '' ? mjl_reports_format_date($filters['date_end']) : 'Fin libre');
}

function mjl_reports_export_filename($def, $filters)
{
	$parts = array('mjl', $def['slug']);
	if ($filters['date_start'] !== '' || $filters['date_end'] !== '') {
		$parts[] = $filters['date_start'] !== '' ? $filters['date_start'] : 'debut-libre';
		$parts[] = $filters['date_end'] !== '' ? $filters['date_end'] : 'fin-libre';
	}
	if ($filters['project_id'] > 0) {
		$parts[] = 'projet-'.$filters['project_id'];
	}
	if ($filters['convention_id'] > 0) {
		$parts[] = 'convention-'.$filters['convention_id'];
	}
	if ($filters['status'] !== '') {
		$parts[] = 'statut-'.$filters['status'];
	}
	return mjl_reports_safe_filename(implode('_', $parts)).'.csv';
}

function mjl_reports_safe_filename($filename)
{
	$filename = strtolower((string) $filename);
	$filename = preg_replace('/[^a-z0-9_-]+/', '_', $filename);
	$filename = preg_replace('/_+/', '_', $filename);
	return trim($filename, '_');
}

function mjl_reports_format_date($value)
{
	$value = (string) $value;
	if ($value === '') {
		return '';
	}
	$date = substr($value, 0, 10);
	if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
		return $value;
	}
	$formatted = substr($date, 8, 2).'/'.substr($date, 5, 2).'/'.substr($date, 0, 4);
	if (strlen($value) > 10) {
		$time = substr($value, 11, 5);
		if (preg_match('/^\d{2}:\d{2}$/', $time)) {
			$formatted .= ' '.$time;
		}
	}
	return $formatted;
}

function mjl_reports_activity_status_options()
{
	return array(
		(string) MjlActivity::STATUS_DRAFT => 'Brouillon',
		(string) MjlActivity::STATUS_ONGOING => 'En cours',
		(string) MjlActivity::STATUS_COMPLETED => 'Terminee',
		(string) MjlActivity::STATUS_SUBMITTED => 'Soumise',
		(string) MjlActivity::STATUS_CORRECTION_REQUESTED => 'Correction demandee',
		(string) MjlActivity::STATUS_CORRECTED => 'Corrigee',
		(string) MjlActivity::STATUS_VALIDATED => 'Validee',
		(string) MjlActivity::STATUS_REJECTED => 'Rejetee',
		(string) MjlActivity::STATUS_CANCELLED => 'Annulee',
	);
}

function mjl_reports_expense_status_options()
{
	return array(
		(string) MjlExpense::STATUS_DRAFT => 'Brouillon',
		(string) MjlExpense::STATUS_SUBMITTED => 'Soumise',
		(string) MjlExpense::STATUS_VALIDATED => 'Validee',
		(string) MjlExpense::STATUS_CORRECTED => 'Corrigee',
		(string) MjlExpense::STATUS_REJECTED => 'Rejetee',
	);
}

function mjl_reports_project_options()
{
	global $db, $conf;

	$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' ORDER BY ref';
	$resql = $db->query($sql);
	$options = array();
	if ($resql) while ($obj = $db->fetch_object($resql)) $options[(int) $obj->rowid] = $obj->ref.' - '.$obj->title;
	return $options;
}

function mjl_reports_convention_options()
{
	global $db, $conf;

	$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'mjlfinancement_convention WHERE entity = '.((int) $conf->entity).' ORDER BY ref';
	$resql = $db->query($sql);
	$options = array();
	if ($resql) while ($obj = $db->fetch_object($resql)) $options[(int) $obj->rowid] = $obj->ref.' - '.$obj->title;
	return $options;
}

function mjl_reports_fetch_rows($sql)
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

function mjl_reports_activity_status_label($status)
{
	$options = mjl_reports_activity_status_options();
	return isset($options[(string) ((int) $status)]) ? $options[(string) ((int) $status)] : (string) $status;
}

function mjl_reports_expense_status_label($status)
{
	$options = mjl_reports_expense_status_options();
	return isset($options[(string) ((int) $status)]) ? $options[(string) ((int) $status)] : (string) $status;
}

function mjl_reports_budget_status_label($status)
{
	$map = array('active' => 'Active', 'closed' => 'Cloturee', 'draft' => 'Brouillon');
	return isset($map[(string) $status]) ? $map[(string) $status] : (string) $status;
}

function mjl_reports_deadline_alert($dateEnd, $status)
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
		return 'Echeance proche';
	}
	return '';
}

function mjl_reports_activity_performance_index($dateEnd, $status, $physicalProgress)
{
	$status = (int) $status;
	$physicalProgress = max(0, min(100, (float) $physicalProgress));
	$deadlineScore = mjl_reports_deadline_score($dateEnd, $status);
	$validationScore = mjl_reports_validation_score($status);

	return round((0.4 * $deadlineScore) + (0.4 * $physicalProgress) + (0.2 * $validationScore), 2);
}

function mjl_reports_deadline_score($dateEnd, $status)
{
	if ((int) $status === MjlActivity::STATUS_COMPLETED) {
		return 100;
	}
	$end = strtotime((string) $dateEnd);
	if ($end <= 0) {
		return 70;
	}
	$today = strtotime(date('Y-m-d'));
	if ($end >= $today) {
		return 70;
	}
	$daysLate = floor(($today - $end) / 86400);
	return $daysLate <= 7 ? 40 : 0;
}

function mjl_reports_validation_score($status)
{
	$map = array(
		MjlActivity::STATUS_VALIDATED => 100,
		MjlActivity::STATUS_SUBMITTED => 60,
		MjlActivity::STATUS_ONGOING => 60,
		MjlActivity::STATUS_CORRECTION_REQUESTED => 30,
		MjlActivity::STATUS_REJECTED => 0,
		MjlActivity::STATUS_CANCELLED => 0,
	);
	return isset($map[(int) $status]) ? $map[(int) $status] : 0;
}

function mjl_reports_object_type_label($objectType)
{
	if ($objectType === 'mjlfinancement_activity') {
		return 'Activite';
	}
	if ($objectType === 'mjlfinancement_expense') {
		return 'Depense';
	}
	return (string) $objectType;
}

function mjl_reports_changes_values($changesJson)
{
	$decoded = json_decode((string) $changesJson, true);
	if (!is_array($decoded)) {
		return array('previous' => '', 'new' => '');
	}
	$previous = array();
	$new = array();
	foreach ($decoded as $field => $change) {
		if (is_array($change)) {
			$previous[] = $field.': '.(array_key_exists('before', $change) ? (string) $change['before'] : '');
			$new[] = $field.': '.(array_key_exists('after', $change) ? (string) $change['after'] : '');
		}
	}
	return array('previous' => implode(' | ', $previous), 'new' => implode(' | ', $new));
}

function mjl_reports_activities_rows($filters)
{
	global $db, $conf;

	$where = array('a.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'a.fk_project = '.((int) $filters['project_id']);
	if (!empty($filters['convention_id'])) $where[] = 'a.fk_convention = '.((int) $filters['convention_id']);
	if ($filters['status'] !== '') $where[] = 'a.status = '.((int) $filters['status']);
	if ($filters['date_start'] !== '') $where[] = "a.date_start >= '".$db->escape($filters['date_start'])."'";
	if ($filters['date_end'] !== '') $where[] = "a.date_end <= '".$db->escape($filters['date_end'])."'";

	$sql = 'SELECT s.nom AS partner, p.ref AS project, c.ref AS envelope, a.ref AS activity_ref, a.label AS activity_title, a.date_start, a.date_end, a.status, COALESCE(t.progress, 0) AS physical_progress_percent,';
	$sql .= ' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = a.entity AND bl.fk_mjl_activity = a.rowid), 0) AS allocated_budget,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = a.entity AND e.fk_mjl_activity = a.rowid AND e.status = '.MjlExpense::STATUS_VALIDATED.'), 0) AS validated_expenses';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet_task t ON t.rowid = a.fk_task AND t.entity = a.entity';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY a.date_end ASC, a.ref';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$row['status_label'] = mjl_reports_activity_status_label($row['status']);
		$row['deadline_alert'] = mjl_reports_deadline_alert($row['date_end'], $row['status']);
		$row['performance_index'] = mjl_reports_activity_performance_index($row['date_end'], $row['status'], $row['physical_progress_percent']);
		$row['current_reviewer'] = '';
		$row['remaining_budget'] = (float) $row['allocated_budget'] - (float) $row['validated_expenses'];
	}
	unset($row);
	return $rows;
}

function mjl_reports_workflow_rows($filters)
{
	global $db, $conf;

	$where = array('w.entity = '.((int) $conf->entity));
	if ($filters['date_start'] !== '') $where[] = "w.action_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	if ($filters['date_end'] !== '') $where[] = "w.action_date <= '".$db->escape($filters['date_end'])." 23:59:59'";

	$sql = 'SELECT w.object_type, w.object_id, CASE WHEN w.object_type = \'mjlfinancement_activity\' THEN a.ref ELSE NULL END AS object_ref, w.action, w.from_status, w.to_status, u.login AS actor, w.actor_role, w.action_date, COALESCE(w.comment, w.reason) AS comment, w.changes_json';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY w.action_date DESC, w.rowid DESC';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$values = mjl_reports_changes_values(isset($row['changes_json']) ? $row['changes_json'] : '');
		$row['object_type_label'] = mjl_reports_object_type_label($row['object_type']);
		$row['decision'] = $row['action'];
		$row['previous_value'] = $values['previous'];
		$row['new_value'] = $values['new'];
	}
	unset($row);

	$expenseRows = mjl_reports_expense_audit_rows($filters);
	return array_merge($rows, $expenseRows);
}

function mjl_reports_expenses_validations_rows($filters)
{
	global $db, $conf;

	$where = array('e.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'e.fk_project = '.((int) $filters['project_id']);
	if (!empty($filters['convention_id'])) $where[] = 'e.fk_convention = '.((int) $filters['convention_id']);
	if ($filters['status'] !== '') $where[] = 'e.status = '.((int) $filters['status']);
	if ($filters['date_start'] !== '') $where[] = "e.expense_date >= '".$db->escape($filters['date_start'])."'";
	if ($filters['date_end'] !== '') $where[] = "e.expense_date <= '".$db->escape($filters['date_end'])."'";

	$sql = 'SELECT s.nom AS partner, p.ref AS project, c.ref AS envelope, a.ref AS activity, e.ref AS expense_ref, e.expense_date, e.amount, e.status AS expense_status,';
	$sql .= ' CASE WHEN '.mjl_expense_document_present_sql('e').' THEN 1 ELSE 0 END AS document_present,';
	$sql .= ' creator.login AS creator, validator.login AS validator, e.validation_date, e.correction_reason';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user creator ON creator.rowid = e.fk_user_creat';
	$sql .= ' LEFT JOIN '.$db->prefix().'user validator ON validator.rowid = e.fk_user_valid';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY e.expense_date ASC, e.ref';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$row['expense_status'] = mjl_reports_expense_status_label($row['expense_status']);
		$row['document_present'] = ((int) $row['document_present'] === 1) ? 'Oui' : 'Non';
	}
	unset($row);
	return $rows;
}

function mjl_reports_exchange_rows($filters)
{
	global $db, $conf;

	$where = array('x.entity = '.((int) $conf->entity));
	if ($filters['date_start'] !== '') $where[] = "x.exchange_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	if ($filters['date_end'] !== '') $where[] = "x.exchange_date <= '".$db->escape($filters['date_end'])." 23:59:59'";

	$sql = 'SELECT x.ref, x.object_type, x.object_id, a.ref AS activity_ref, x.exchange_date, u.login, x.actor_role, x.channel, x.subject, x.message';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_exchange_log x';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = x.object_id AND x.object_type = \'mjlfinancement_activity\' AND a.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = x.actor';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY x.exchange_date DESC, x.rowid DESC';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_dpaf_rows($filters)
{
	global $db, $conf;

	$where = array('c.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'c.fk_project = '.((int) $filters['project_id']);
	if (!empty($filters['convention_id'])) $where[] = 'c.rowid = '.((int) $filters['convention_id']);

	$sql = 'SELECT c.ref AS convention_ref,';
	$sql .= ' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = c.entity AND bl.fk_convention = c.rowid), 0) AS budget_revise,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_VALIDATED.'), 0) AS depenses_validees,';
	$sql .= ' COALESCE((SELECT SUM(e.amount) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_SUBMITTED.'), 0) AS depenses_soumises,';
	$sql .= ' COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = c.entity AND fr.fk_convention = c.rowid AND fr.status = 1), 0) AS fonds_recus,';
	$sql .= ' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity a WHERE a.entity = c.entity AND a.fk_convention = c.rowid AND a.status = '.MjlActivity::STATUS_SUBMITTED.'), 0) AS activites_en_revue,';
	$sql .= ' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_SUBMITTED.'), 0) AS depenses_en_revue';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY c.ref';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_expense_audit_rows($filters)
{
	global $db, $conf;

	$where = array('v.entity = '.((int) $conf->entity));
	if ($filters['date_start'] !== '') $where[] = "v.action_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	if ($filters['date_end'] !== '') $where[] = "v.action_date <= '".$db->escape($filters['date_end'])." 23:59:59'";

	$sql = 'SELECT \'Depense\' AS object_type_label, e.ref AS object_ref, v.action AS decision, v.from_status, v.to_status,';
	$sql .= ' v.from_status AS previous_value, v.to_status AS new_value, u.login AS actor, \'\' AS actor_role, v.action_date, v.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = v.fk_expense AND e.entity = v.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= ' ORDER BY v.action_date DESC, v.rowid DESC';
	return mjl_reports_fetch_rows($sql);
}
