<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlactivity.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlexpense.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/class/mjlfundreceipt.class.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reporting.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_finance_metrics.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_csv_export.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_xlsx_export.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_document.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workflow_audit.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_timeline.lib.php';

mjl_workspace_require_supervision_access($user);

$langs->load('mjlfinancement@mjlfinancement');

$report = GETPOST('report', 'alpha') ?: 'financial_execution_project';
$def = mjl_reports_def($report);
$report = $def['key'];
$action = GETPOST('action', 'alpha');
$rawFilters = mjl_reports_raw_filters();
$filters = mjl_reports_normalize_filters($def, $rawFilters);
$inaccessibleFilters = mjl_reports_inaccessible_filters($def, $filters);
$missingRequired = mjl_reports_missing_required_filters($def, $filters);
$rows = empty($missingRequired) && empty($inaccessibleFilters) ? mjl_reports_formatted_rows($report, $filters) : array();
$csvFilename = mjl_reports_export_filename($def, $filters, 'csv');
$xlsxFilename = mjl_reports_export_filename($def, $filters, 'xlsx');

if ($action === 'export_csv' || $action === 'export_xlsx') {
	if (empty($_SERVER['REQUEST_METHOD']) || strtoupper((string) $_SERVER['REQUEST_METHOD']) !== 'POST') {
		accessforbidden('Export POST requis');
	}
	if (!function_exists('currentToken') || GETPOST('token', 'alphanohtml') !== currentToken()) {
		accessforbidden('Invalid security token');
	}
	if (empty($user->admin) && !$user->hasRight('mjlfinancement', 'export', 'write')) {
		accessforbidden();
	}
	if (!empty($missingRequired)) {
		accessforbidden('Sélection requise avant export: '.implode(', ', $missingRequired));
	}
	if (!empty($inaccessibleFilters)) {
		accessforbidden('Filtre hors de votre perimetre: '.implode(', ', $inaccessibleFilters));
	}
	mjl_reports_audit_export($def, $filters, $action === 'export_xlsx' ? 'xlsx' : 'csv', count($rows));
	if ($action === 'export_xlsx') {
		mjl_xlsx_export_output($xlsxFilename, $def['headers'], $rows);
	} else {
		mjl_csv_export_output($csvFilename, $def['headers'], $rows);
	}
	exit;
}

llxHeader('', 'Centre d\'exports MJL');

mjl_navigation_shell_start($user, 'reports');
print '<div class="mjl-workspace mjl-reports-workspace">';
mjl_dashboard_render_header(
	'Centre d\'exports MJL',
	'Générer des sorties officielles lisibles, filtrées et compatibles Excel sans exposer les détails techniques Dolibarr.',
	'Périmètre',
	!empty($user->admin) ? 'Administrateur plateforme' : 'Validateur définitif'
);

mjl_reports_render_selector($report);
mjl_reports_render_filter_bar($def, $filters);
mjl_reports_render_context($def, $filters, $csvFilename, $xlsxFilename, $missingRequired, $inaccessibleFilters, $user);
mjl_reports_render_table($def, $rows, array_merge($missingRequired, $inaccessibleFilters));

print '</div>';
mjl_navigation_shell_end();

llxFooter();
$db->close();

function mjl_reports_defs()
{
	return array(
		'funding_received_partner' => array(
			'key' => 'funding_received_partner',
			'label' => 'Financements reçus par Partenaire / Programme',
			'description' => 'Suivre les montants reçus par Partenaire / Programme, projet et période de réception.',
			'scope' => 'Partenaire / Programme',
			'slug' => 'financements_recus_partenaire_programme',
			'filters' => array('fk_soc', 'project_id', 'status', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => 'fundreceipt',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'receipt_count' => 'Réceptions', 'funds_received' => 'Fonds reçus', 'first_reception_date' => 'Première réception', 'last_reception_date' => 'Dernière réception'),
			'money_fields' => array('funds_received'),
			'date_fields' => array('first_reception_date', 'last_reception_date'),
		),
		'budget_allocation_partner' => array(
			'key' => 'budget_allocation_partner',
			'label' => 'Allocation budgétaire par Partenaire / Programme',
			'description' => 'Comparer les budgets initial et révisé par Partenaire / Programme.',
			'scope' => 'Partenaire / Programme',
			'slug' => 'allocation_budgetaire_partenaire_programme',
			'filters' => array('fk_soc', 'project_id'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'initial_budget' => 'Budget initial', 'revised_budget' => 'Budget révisé', 'budget_lines' => 'Lignes budgétaires'),
			'money_fields' => array('initial_budget', 'revised_budget'),
		),
		'budget_allocation_project' => array(
			'key' => 'budget_allocation_project',
			'label' => 'Allocation budgétaire par projet',
			'description' => 'Suivre l’allocation budgétaire et les dépenses rattachées à chaque projet.',
			'scope' => 'Projet',
			'slug' => 'allocation_budgetaire_projet',
			'filters' => array('fk_soc', 'project_id'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'initial_budget' => 'Budget initial', 'revised_budget' => 'Budget révisé', 'validated_expenses' => 'Dépenses validées définitivement', 'disbursed_expenses' => 'Dépenses décaissées', 'remaining_amount' => 'Restant', 'validation_rate' => 'Taux de validation', 'execution_rate' => 'Taux d’exécution financière'),
			'money_fields' => array('initial_budget', 'revised_budget', 'validated_expenses', 'disbursed_expenses', 'remaining_amount'),
		),
		'financial_execution_partner' => array(
			'key' => 'financial_execution_partner',
			'label' => 'Exécution financière par Partenaire / Programme',
			'description' => 'Comparer budget révisé, dépenses validées et décaissements par Partenaire / Programme.',
			'scope' => 'Partenaire / Programme',
			'slug' => 'execution_financiere_partenaire_programme',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'revised_budget' => 'Budget révisé', 'validated_expenses' => 'Dépenses validées définitivement', 'disbursed_expenses' => 'Dépenses décaissées', 'validation_rate' => 'Taux de validation', 'execution_rate' => 'Taux d’exécution financière'),
			'money_fields' => array('revised_budget', 'validated_expenses', 'disbursed_expenses'),
		),
		'financial_execution_project' => array(
			'key' => 'financial_execution_project',
			'label' => 'Exécution financière par projet',
			'description' => 'Comparer budget, fonds reçus, validation et décaissement pour chaque projet.',
			'scope' => 'Projet',
			'slug' => 'execution_financiere_projet',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'project_title' => 'Titre projet', 'budget_total' => 'Budget révisé', 'funds_received' => 'Fonds reçus', 'validated_expenses' => 'Dépenses validées définitivement', 'disbursed_expenses' => 'Dépenses décaissées', 'pending_expenses' => 'Dépenses soumises', 'validation_rate' => 'Taux de validation', 'execution_rate' => 'Taux d’exécution financière'),
			'money_fields' => array('budget_total', 'funds_received', 'validated_expenses', 'disbursed_expenses', 'pending_expenses'),
		),
		'physical_execution_project' => array(
			'key' => 'physical_execution_project',
			'label' => 'Exécution physique par projet',
			'description' => 'Suivre la progression physique moyenne et les activités par projet.',
			'scope' => 'Projet',
			'slug' => 'execution_physique_projet',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'activity_count' => 'Activités', 'average_progress' => 'Progression physique moyenne', 'completed_activities' => 'Activités terminées', 'late_activities' => 'Activités en retard'),
		),
		'expense_documents' => array(
			'key' => 'expense_documents',
			'label' => 'Dépenses avec justificatifs',
			'description' => 'Contrôler la présence des justificatifs et les motifs de correction.',
			'scope' => 'Dépenses',
			'slug' => 'depenses_pieces',
			'filters' => array('fk_soc', 'project_id', 'status', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => 'expense',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'expense_ref' => 'Dépense', 'expense_date' => 'Date dépense', 'budget_line' => 'Ligne budgétaire', 'amount' => 'Montant', 'status' => 'Statut', 'document_present' => 'Pièce disponible', 'supporting_document' => 'Pièce justificative', 'validator' => 'Validateur', 'correction_reason' => 'Motif correction'),
			'money_fields' => array('amount'),
			'date_fields' => array('expense_date'),
		),
		'activities_tracking' => array(
			'key' => 'activities_tracking',
			'label' => 'Suivi des activités',
			'description' => 'Exporter les activités, leur statut, leur risque échéance et leurs indicateurs budgétaires.',
			'scope' => 'Activités',
			'slug' => 'suivi_activites',
			'filters' => array('fk_soc', 'project_id', 'status', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => 'activity',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'activity_ref' => 'Référence activité', 'activity_title' => 'Titre activité', 'date_start' => 'Date de début', 'date_end' => 'Date de fin', 'status_label' => 'Statut', 'physical_progress_percent' => 'Taux d’exécution physique', 'performance_index' => 'Indice de performance', 'current_reviewer' => 'Responsable actuel', 'deadline_alert' => 'Alerte échéance', 'allocated_budget' => 'Budget alloué', 'validated_expenses' => 'Dépenses validées définitivement', 'remaining_budget' => 'Budget restant'),
			'money_fields' => array('allocated_budget', 'validated_expenses', 'remaining_budget'),
			'date_fields' => array('date_start', 'date_end'),
		),
		'expenses_disbursements' => array(
			'key' => 'expenses_disbursements',
			'label' => 'Suivi des dépenses / décaissements',
			'description' => 'Exporter les dépenses, leurs statuts de validation et leurs décaissements.',
			'scope' => 'Dépenses',
			'slug' => 'suivi_depenses_decaissements',
			'filters' => array('fk_soc', 'project_id', 'status', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => 'expense',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'activity' => 'Activité', 'expense_ref' => 'Référence dépense', 'expense_date' => 'Date dépense', 'amount' => 'Montant demandé', 'prevalidated_amount' => 'Montant prévalidé', 'final_validated_amount' => 'Montant validé définitivement', 'disbursed_amount' => 'Montant décaissé', 'expense_status' => 'Statut', 'document_present' => 'Pièce disponible', 'creator' => 'Créée par', 'prevalidator' => 'Prévalidée par', 'validator' => 'Validée définitivement par', 'disburser' => 'Décaissée par', 'validation_date' => 'Date de validation', 'disbursement_date' => 'Date décaissement', 'beneficiary_name' => 'Bénéficiaire', 'correction_reason' => 'Motif de correction'),
			'money_fields' => array('amount', 'prevalidated_amount', 'final_validated_amount', 'disbursed_amount'),
			'date_fields' => array('expense_date', 'validation_date', 'disbursement_date'),
		),
		'validated_not_disbursed' => array(
			'key' => 'validated_not_disbursed',
			'label' => 'Dépenses validées non décaissées',
			'description' => 'Identifier les dépenses validées définitivement qui attendent le décaissement.',
			'scope' => 'Dépenses',
			'slug' => 'depenses_validees_non_decaissees',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'expense_ref' => 'Référence dépense', 'expense_date' => 'Date dépense', 'final_validated_amount' => 'Montant validé définitivement', 'validator' => 'Validée définitivement par', 'validation_date' => 'Date de validation', 'beneficiary_name' => 'Bénéficiaire'),
			'money_fields' => array('final_validated_amount'),
			'date_fields' => array('expense_date', 'validation_date'),
		),
		'pending_prevalidations' => array(
			'key' => 'pending_prevalidations',
			'label' => 'Prévalidations en attente',
			'description' => 'Lister les dépenses soumises en attente de prévalidation.',
			'scope' => 'Workflow dépenses',
			'slug' => 'prevalidations_en_attente',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'expense_ref' => 'Référence dépense', 'expense_date' => 'Date dépense', 'amount' => 'Montant demandé', 'creator' => 'Créée par', 'beneficiary_name' => 'Bénéficiaire'),
			'money_fields' => array('amount'),
			'date_fields' => array('expense_date'),
		),
		'pending_final_validations' => array(
			'key' => 'pending_final_validations',
			'label' => 'Validations définitives en attente',
			'description' => 'Lister les dépenses prévalidées en attente de validation définitive.',
			'scope' => 'Workflow dépenses',
			'slug' => 'validations_definitives_en_attente',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'expense_ref' => 'Référence dépense', 'expense_date' => 'Date dépense', 'prevalidated_amount' => 'Montant prévalidé', 'prevalidator' => 'Prévalidée par', 'prevalidation_date' => 'Date de prévalidation', 'beneficiary_name' => 'Bénéficiaire'),
			'money_fields' => array('prevalidated_amount'),
			'date_fields' => array('expense_date', 'prevalidation_date'),
		),
		'corrections_rejections' => array(
			'key' => 'corrections_rejections',
			'label' => 'Corrections / invalidations / rejets',
			'description' => 'Lister les dépenses et activités en correction, invalidées ou rejetées.',
			'scope' => 'Workflow',
			'slug' => 'corrections_invalidations_rejets',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('partner' => 'Partenaire / Programme', 'project' => 'Projet', 'object_type_label' => 'Type d’objet', 'object_ref' => 'Référence objet', 'status_label' => 'Statut', 'event_date' => 'Date', 'reason' => 'Motif'),
			'date_fields' => array('event_date'),
		),
		'workflow_decisions' => array(
			'key' => 'workflow_decisions',
			'label' => 'Historique des décisions',
			'description' => 'Exporter les décisions et transitions auditées sur activités et dépenses.',
			'scope' => 'Audit',
			'slug' => 'historique_decisions_audit',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('object_type_label' => 'Type d’objet', 'object_ref' => 'Référence objet', 'decision' => 'Action / décision', 'from_status' => 'Ancien statut', 'to_status' => 'Nouveau statut', 'previous_value' => 'Ancienne valeur', 'new_value' => 'Nouvelle valeur', 'actor' => 'Acteur', 'actor_role' => 'Rôle', 'action_date' => 'Date', 'comment' => 'Commentaire / motif'),
			'date_fields' => array('action_date'),
		),
		'contextual_comments' => array(
			'key' => 'contextual_comments',
			'label' => 'Historique des commentaires contextuels',
			'description' => 'Exporter les commentaires contextualisés rattachés aux objets MJL pour la traçabilité.',
			'scope' => 'Commentaires contextuels',
			'slug' => 'commentaires_contextuels',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('ref' => 'Référence commentaire', 'object_type' => 'Type objet', 'object_id' => 'ID objet', 'activity_ref' => 'Objet', 'exchange_date' => 'Date commentaire', 'login' => 'Acteur', 'actor_role' => 'Rôle acteur', 'channel' => 'Canal', 'subject' => 'Sujet', 'message' => 'Message'),
			'date_fields' => array('exchange_date'),
		),
		'general_audit' => array(
			'key' => 'general_audit',
			'label' => 'Audit général',
			'description' => 'Exporter les lignes d’audit résolues; les audits génériques d’export restent visibles aux administrateurs uniquement.',
			'scope' => 'Audit',
			'slug' => 'audit_general',
			'filters' => array('fk_soc', 'project_id', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => '',
			'headers' => array('object_type_label' => 'Type d’objet', 'object_ref' => 'Référence objet', 'decision' => 'Action / décision', 'actor' => 'Acteur', 'actor_role' => 'Rôle', 'action_date' => 'Date', 'comment' => 'Commentaire / motif'),
			'date_fields' => array('action_date'),
		),
	);
}

function mjl_reports_def($report)
{
	$defs = mjl_reports_defs();
	if ($report === 'convention_budget') {
		return array(
			'key' => 'convention_budget',
			'label' => 'Exécution budgétaire par programme',
			'description' => 'Suivre les lignes budgétaires, les dépenses validées et le solde restant.',
			'scope' => 'Programme',
			'slug' => 'budget_programme',
			'filters' => array('fk_soc', 'convention_id', 'date_start', 'date_end'),
			'required_filters' => array('convention_id'),
			'status_domain' => '',
			'headers' => array('ref' => 'Ligne budgétaire', 'label' => 'Libellé', 'initial_budget' => 'Budget initial', 'revised_budget' => 'Budget révisé', 'status' => 'Statut', 'submitted_expenses' => 'Dépenses soumises', 'prevalidated_expenses' => 'Dépenses prévalidées', 'validated_expenses' => 'Dépenses validées définitivement', 'disbursed_expenses' => 'Dépenses décaissées', 'remaining_amount' => 'Restant'),
			'money_fields' => array('initial_budget', 'revised_budget', 'submitted_expenses', 'prevalidated_expenses', 'validated_expenses', 'disbursed_expenses', 'remaining_amount'),
		);
	}
	if ($report === 'fund_receipts') {
		return array(
			'key' => 'fund_receipts',
			'label' => 'Suivi des fonds reçus',
			'description' => 'Exporter les réceptions de fonds, leurs statuts et la disponibilité des preuves documentaires.',
			'scope' => 'Fonds reçus',
			'slug' => 'fonds_recus',
			'filters' => array('fk_soc', 'project_id', 'convention_id', 'status', 'date_start', 'date_end'),
			'required_filters' => array(),
			'status_domain' => 'fundreceipt',
			'headers' => array('receipt_ref' => 'Référence réception', 'ptf' => 'Partenaire / Programme', 'project' => 'Projet', 'programme' => 'Programme', 'reception_date' => 'Date de réception', 'amount' => 'Montant', 'status' => 'Statut', 'document_present' => 'Preuve disponible', 'supporting_document' => 'Preuve documentaire', 'comment' => 'Commentaire'),
			'money_fields' => array('amount'),
			'date_fields' => array('reception_date'),
		);
	}
	$aliases = array(
		'project_summary' => 'financial_execution_project',
		'activities' => 'activities_tracking',
		'workflow_actions' => 'workflow_decisions',
		'expenses_validations' => 'expenses_disbursements',
		'exchanges' => 'contextual_comments',
		'dpaf_summary' => 'financial_execution_partner',
	);
	if (isset($aliases[$report])) {
		$report = $aliases[$report];
	}
	return isset($defs[$report]) ? $defs[$report] : $defs['financial_execution_project'];
}

function mjl_reports_raw_filters()
{
	return array(
		'fk_soc' => GETPOSTINT('fk_soc'),
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
		'fk_soc' => 0,
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
		if ($key === 'fk_soc' || $key === 'project_id' || $key === 'convention_id') {
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
	$options = $domain === 'activity' ? mjl_reports_activity_status_options() : ($domain === 'expense' ? mjl_reports_expense_status_options() : ($domain === 'fundreceipt' ? mjl_reports_fund_receipt_status_options() : array()));
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
		if ($filter === 'fk_soc' && empty($filters['fk_soc'])) {
			$missing[] = 'Partenaire / Programme';
		}
		if ($filter === 'project_id' && empty($filters['project_id'])) {
			$missing[] = 'Projet';
		}
		if ($filter === 'convention_id' && empty($filters['convention_id'])) {
			$missing[] = 'Programme';
		}
	}
	return $missing;
}

function mjl_reports_inaccessible_filters($def, $filters)
{
	global $user;
	$errors = array();
	if (in_array('fk_soc', $def['filters'], true) && !empty($filters['fk_soc']) && !mjl_scope_can_access_fk_soc($user, (int) $filters['fk_soc'])) {
		$errors[] = 'Partenaire / Programme';
	}
	if (in_array('project_id', $def['filters'], true) && !empty($filters['project_id']) && !mjl_scope_can_access_object($user, 'project', (int) $filters['project_id'])) {
		$errors[] = 'Projet';
	}
	if (in_array('convention_id', $def['filters'], true) && !empty($filters['convention_id']) && !mjl_scope_can_access_object($user, 'mjlfinancement_convention', (int) $filters['convention_id'])) {
		$errors[] = 'Programme';
	}
	if (empty($errors) && !empty($filters['fk_soc']) && !empty($filters['project_id']) && !mjl_reports_project_belongs_to_partner((int) $filters['project_id'], (int) $filters['fk_soc'])) {
		$errors[] = 'Projet';
	}
	if (empty($errors) && !empty($filters['fk_soc']) && !empty($filters['convention_id']) && !mjl_reports_convention_belongs_to_partner((int) $filters['convention_id'], (int) $filters['fk_soc'])) {
		$errors[] = 'Programme';
	}
	return $errors;
}

function mjl_reports_rows($report, $filters)
{
	if ($report === 'funding_received_partner') {
		return mjl_reports_funding_received_partner_rows($filters);
	}
	if ($report === 'budget_allocation_partner') {
		return mjl_reports_budget_allocation_partner_rows($filters);
	}
	if ($report === 'budget_allocation_project') {
		return mjl_reports_budget_allocation_project_rows($filters);
	}
	if ($report === 'convention_budget') {
		if (empty($filters['convention_id'])) return array();
		return mjl_report_convention_budget($filters['convention_id'], $filters);
	}
	if ($report === 'financial_execution_partner') {
		return mjl_reports_financial_execution_partner_rows($filters);
	}
	if ($report === 'financial_execution_project') {
		return mjl_reports_financial_execution_project_rows($filters);
	}
	if ($report === 'physical_execution_project') {
		return mjl_reports_physical_execution_project_rows($filters);
	}
	if ($report === 'expense_documents') {
		return mjl_report_expense_documents($filters);
	}
	if ($report === 'activities_tracking') {
		return mjl_reports_activities_rows($filters);
	}
	if ($report === 'expenses_disbursements') {
		return mjl_reports_expenses_validations_rows($filters);
	}
	if ($report === 'fund_receipts') {
		return mjl_reports_fund_receipt_rows($filters);
	}
	if ($report === 'validated_not_disbursed') {
		return mjl_reports_validated_not_disbursed_rows($filters);
	}
	if ($report === 'pending_prevalidations') {
		return mjl_reports_pending_prevalidation_rows($filters);
	}
	if ($report === 'pending_final_validations') {
		return mjl_reports_pending_final_validation_rows($filters);
	}
	if ($report === 'corrections_rejections') {
		return mjl_reports_corrections_rejections_rows($filters);
	}
	if ($report === 'workflow_decisions') {
		return mjl_reports_workflow_rows($filters, false);
	}
	if ($report === 'contextual_comments') {
		return mjl_reports_exchange_rows($filters);
	}
	if ($report === 'general_audit') {
		return mjl_reports_general_audit_rows($filters);
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
	if (($def['key'] === 'budget_allocation_project' || $def['key'] === 'convention_budget') && isset($row['status'])) {
		$row['status'] = mjl_reports_budget_status_label($row['status']);
	}
	if (($def['key'] === 'funding_received_partner' || $def['key'] === 'fund_receipts') && isset($row['status'])) {
		$row['status'] = mjl_reports_fund_receipt_status_label($row['status']);
	}
	if (isset($row['actor_role'])) {
		$row['actor_role'] = mjl_actor_role_label($row['actor_role']);
	}
	if (isset($row['document_present'])) {
		if ($row['document_present'] !== 'Indisponible') {
			$row['document_present'] = ((int) $row['document_present'] === 1 || $row['document_present'] === 'Oui') ? 'Oui' : 'Non';
		}
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
	foreach ($row as $key => $value) {
		if (is_string($value)) {
			$row[$key] = mjl_reports_target_wording($value);
		}
	}
	return $row;
}

function mjl_reports_target_wording($value)
{
	$value = str_replace('PTF', 'Partenaire', (string) $value);
	$value = str_replace('Convention', 'Programme', $value);
	$value = str_replace('Validee legacy', 'Validée définitivement', $value);
	return $value;
}

function mjl_reports_render_selector($selectedReport)
{
	print '<section class="mjl-workspace-section mjl-report-selector">';
	print '<div class="mjl-section-heading"><h2>Rapport officiel</h2><p>Choisir le jeu de données à prévisualiser et exporter.</p></div>';
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
	$partnerOptions = mjl_reports_partner_options();
	$projectOptions = mjl_reports_project_options();
	$conventionOptions = mjl_reports_convention_options();
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Filtres</h2><p>Seuls les filtres utiles au rapport sélectionné sont affichés.</p></div>';
	print '<form class="mjl-report-filter-bar" method="GET" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
	print '<input type="hidden" name="report" value="'.dol_escape_htmltag($def['key']).'">';
	if (in_array('fk_soc', $def['filters'], true)) {
		print '<label>Partenaire / Programme'.mjl_reports_required_marker($def, 'fk_soc').mjl_reports_select('fk_soc', $partnerOptions, $filters['fk_soc'], 'Tous les périmètres').'</label>';
	}
	if (in_array('project_id', $def['filters'], true)) {
		print '<label>Projet'.mjl_reports_required_marker($def, 'project_id').mjl_reports_select('project_id', $projectOptions, $filters['project_id'], 'Tous les projets').'</label>';
	}
	if (in_array('convention_id', $def['filters'], true)) {
		print '<label>Programme'.mjl_reports_required_marker($def, 'convention_id').mjl_reports_select('convention_id', $conventionOptions, $filters['convention_id'], 'Tous les programmes').'</label>';
	}
	if (in_array('status', $def['filters'], true)) {
		$options = $def['status_domain'] === 'activity' ? mjl_reports_activity_status_options() : ($def['status_domain'] === 'fundreceipt' ? mjl_reports_fund_receipt_status_options() : mjl_reports_expense_status_options());
		print '<label>Statut'.mjl_reports_status_select($options, $filters['status']).'</label>';
	}
	if (in_array('date_start', $def['filters'], true)) {
		print '<label>Date de début<input type="date" name="date_start" value="'.dol_escape_htmltag($filters['date_start']).'"></label>';
	}
	if (in_array('date_end', $def['filters'], true)) {
		print '<label>Date de fin<input type="date" name="date_end" value="'.dol_escape_htmltag($filters['date_end']).'"></label>';
	}
	print '<div class="mjl-report-filter-actions">';
	print '<button class="button" type="submit">Afficher</button>';
	print '</div>';
	print '</form>';
	print '</section>';
}

function mjl_reports_render_context($def, $filters, $csvFilename, $xlsxFilename, $missingRequired, $inaccessibleFilters, User $targetUser)
{
	$canExport = !empty($targetUser->admin) || $targetUser->hasRight('mjlfinancement', 'export', 'write');
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Contexte export</h2><p>Les informations ci-dessous seront cohérentes avec les fichiers CSV et XLSX générés.</p></div>';
	print '<div class="mjl-report-context">';
	print '<dl class="mjl-activity-meta">';
	print '<div><dt>Rapport</dt><dd>'.dol_escape_htmltag($def['label']).'</dd></div>';
	print '<div><dt>Périmètre</dt><dd>'.dol_escape_htmltag($def['scope']).'</dd></div>';
	print '<div><dt>Période</dt><dd>'.dol_escape_htmltag(mjl_reports_period_label($filters)).'</dd></div>';
	print '<div><dt>Formats</dt><dd>CSV compatible Excel et XLSX</dd></div>';
	print '<div><dt>Restrictions</dt><dd>'.($canExport ? 'Export autorisé pour ce profil' : 'Prévisualisation uniquement').'</dd></div>';
	print '<div><dt>Nom du fichier CSV</dt><dd data-testid="mjl-report-filename">'.dol_escape_htmltag($csvFilename).'</dd></div>';
	print '<div><dt>Nom du fichier XLSX</dt><dd data-testid="mjl-report-xlsx-filename">'.dol_escape_htmltag($xlsxFilename).'</dd></div>';
	print '</dl>';
	print '<div class="mjl-report-active-filters"><strong>Filtres actifs</strong><span>'.dol_escape_htmltag(mjl_reports_filter_summary($def, $filters)).'</span></div>';
	if (!empty($missingRequired)) {
		print '<div class="mjl-empty-state">Sélection requise avant export: '.dol_escape_htmltag(implode(', ', $missingRequired)).'.</div>';
	}
	if (!empty($inaccessibleFilters)) {
		print '<div class="mjl-empty-state">Filtre hors de votre périmètre: '.dol_escape_htmltag(implode(', ', $inaccessibleFilters)).'.</div>';
	}
	if ($canExport) {
		print '<form class="mjl-report-export-toolbar" method="POST" action="'.dol_escape_htmltag($_SERVER['PHP_SELF']).'">';
		print '<input type="hidden" name="token" value="'.dol_escape_htmltag(function_exists('newToken') ? newToken() : '').'">';
		print '<input type="hidden" name="report" value="'.dol_escape_htmltag($def['key']).'">';
		foreach ($filters as $key => $value) {
			if (($key === 'fk_soc' || $key === 'project_id' || $key === 'convention_id') && (int) $value <= 0) {
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
		print '<button class="button" type="submit" name="action" value="export_xlsx"'.(!empty($missingRequired) ? ' disabled' : '').'>Exporter le fichier XLSX</button>';
		print '</form>';
	}
	print '</div>';
	print '</section>';
}

function mjl_reports_render_table($def, $rows, $missingRequired)
{
	print '<section class="mjl-workspace-section">';
	print '<div class="mjl-section-heading"><h2>Prévisualisation</h2><p>Le tableau reprend les colonnes des fichiers CSV et XLSX.</p></div>';
	if (!empty($missingRequired)) {
		print '<div class="mjl-empty-state">Aucune prévisualisation tant que les filtres requis ne sont pas renseignés.</div>';
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
		print '<tr class="oddeven"><td colspan="'.count($def['headers']).'">Aucune donnée pour ces filtres.</td></tr>';
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
	$partnerOptions = mjl_reports_partner_options();
	$projectOptions = mjl_reports_project_options();
	$conventionOptions = mjl_reports_convention_options();
	if (in_array('fk_soc', $def['filters'], true) && !empty($filters['fk_soc'])) {
		$parts[] = 'Partenaire / Programme: '.(isset($partnerOptions[$filters['fk_soc']]) ? $partnerOptions[$filters['fk_soc']] : '#'.$filters['fk_soc']);
	}
	if (in_array('project_id', $def['filters'], true) && !empty($filters['project_id'])) {
		$parts[] = 'Projet: '.(isset($projectOptions[$filters['project_id']]) ? $projectOptions[$filters['project_id']] : '#'.$filters['project_id']);
	}
	if (in_array('convention_id', $def['filters'], true) && !empty($filters['convention_id'])) {
		$parts[] = 'Programme: '.(isset($conventionOptions[$filters['convention_id']]) ? $conventionOptions[$filters['convention_id']] : '#'.$filters['convention_id']);
	}
	if (in_array('status', $def['filters'], true) && $filters['status'] !== '') {
		$options = $def['status_domain'] === 'activity' ? mjl_reports_activity_status_options() : ($def['status_domain'] === 'fundreceipt' ? mjl_reports_fund_receipt_status_options() : mjl_reports_expense_status_options());
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
		return 'Toutes périodes';
	}
	return ($filters['date_start'] !== '' ? mjl_reports_format_date($filters['date_start']) : 'Début libre').' - '.($filters['date_end'] !== '' ? mjl_reports_format_date($filters['date_end']) : 'Fin libre');
}

function mjl_reports_export_filename($def, $filters, $extension = 'csv')
{
	$parts = array('mjl', $def['slug']);
	if ($filters['date_start'] !== '' || $filters['date_end'] !== '') {
		$parts[] = $filters['date_start'] !== '' ? $filters['date_start'] : 'debut-libre';
		$parts[] = $filters['date_end'] !== '' ? $filters['date_end'] : 'fin-libre';
	}
	if ($filters['project_id'] > 0) {
		$parts[] = 'projet-'.$filters['project_id'];
	}
	if ($filters['fk_soc'] > 0) {
		$parts[] = 'partenaire-programme-'.$filters['fk_soc'];
	}
	if ($filters['convention_id'] > 0) {
		$parts[] = 'programme-'.$filters['convention_id'];
	}
	if ($filters['status'] !== '') {
		$parts[] = 'statut-'.$filters['status'];
	}
	$extension = $extension === 'xlsx' ? 'xlsx' : 'csv';
	return mjl_reports_safe_filename(implode('_', $parts)).'.'.$extension;
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
		(string) MjlActivity::STATUS_VALIDATED => 'Validee definitivement',
		(string) MjlActivity::STATUS_PREVALIDATED => 'Prevalidee',
		(string) MjlActivity::STATUS_REJECTED => 'Rejetee',
		(string) MjlActivity::STATUS_CANCELLED => 'Annulee',
	);
}

function mjl_reports_expense_status_options()
{
	return array(
		(string) MjlExpense::STATUS_DRAFT => 'Brouillon',
		(string) MjlExpense::STATUS_SUBMITTED => 'Soumise',
		(string) MjlExpense::STATUS_VALIDATED => 'Validée définitivement',
		(string) MjlExpense::STATUS_CORRECTED => 'Corrigee',
		(string) MjlExpense::STATUS_PREVALIDATED => 'Prevalidee',
		(string) MjlExpense::STATUS_FINAL_VALIDATED => 'Validée définitivement',
		(string) MjlExpense::STATUS_DISBURSED => 'Decaissee',
		(string) MjlExpense::STATUS_REJECTED => 'Rejetee',
	);
}

function mjl_reports_fund_receipt_status_options()
{
	return array(
		(string) MjlFundReceipt::STATUS_DRAFT => 'Brouillon',
		(string) MjlFundReceipt::STATUS_RECEIVED => 'Reçu',
		(string) MjlFundReceipt::STATUS_NOT_RECEIVED => 'Non reçu',
	);
}

function mjl_reports_project_options()
{
	global $db, $conf, $user;

	$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('fk_soc', $user).' ORDER BY ref';
	$resql = $db->query($sql);
	$options = array();
	if ($resql) while ($obj = $db->fetch_object($resql)) $options[(int) $obj->rowid] = mjl_reports_target_wording($obj->ref.' - '.$obj->title);
	return $options;
}

function mjl_reports_partner_options()
{
	global $db, $conf, $user;

	$sql = 'SELECT rowid, nom FROM '.$db->prefix().'societe WHERE entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('rowid', $user).' ORDER BY nom';
	$resql = $db->query($sql);
	$options = array();
	if ($resql) while ($obj = $db->fetch_object($resql)) $options[(int) $obj->rowid] = mjl_reports_target_wording($obj->nom);
	return $options;
}

function mjl_reports_convention_options()
{
	global $db, $conf, $user;

	$sql = 'SELECT rowid, ref, title FROM '.$db->prefix().'mjlfinancement_convention WHERE entity = '.((int) $conf->entity).mjl_scope_partner_sql_filter('fk_soc', $user).' ORDER BY ref';
	$resql = $db->query($sql);
	$options = array();
	if ($resql) while ($obj = $db->fetch_object($resql)) $options[(int) $obj->rowid] = mjl_reports_target_wording($obj->ref.' - '.$obj->title);
	return $options;
}

function mjl_reports_project_belongs_to_partner($projectId, $fkSoc)
{
	global $db, $conf;
	$projectId = (int) $projectId;
	$fkSoc = (int) $fkSoc;
	if ($projectId <= 0 || $fkSoc <= 0) return false;
	$sql = 'SELECT rowid FROM '.$db->prefix().'projet WHERE entity = '.((int) $conf->entity).' AND rowid = '.$projectId.' AND fk_soc = '.$fkSoc;
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
}

function mjl_reports_convention_belongs_to_partner($conventionId, $fkSoc)
{
	global $db, $conf;
	$conventionId = (int) $conventionId;
	$fkSoc = (int) $fkSoc;
	if ($conventionId <= 0 || $fkSoc <= 0) return false;
	$sql = 'SELECT rowid FROM '.$db->prefix().'mjlfinancement_convention WHERE entity = '.((int) $conf->entity).' AND rowid = '.$conventionId.' AND fk_soc = '.$fkSoc;
	$resql = $db->query($sql);
	return $resql && (bool) $db->fetch_object($resql);
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

function mjl_reports_fund_receipt_status_label($status)
{
	$options = mjl_reports_fund_receipt_status_options();
	$key = (string) ((int) $status);
	return isset($options[$key]) ? $options[$key] : (string) $status;
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
		MjlActivity::STATUS_PREVALIDATED => 80,
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
		return 'Dépense';
	}
	if ($objectType === 'mjlfinancement_convention') {
		return 'Programme';
	}
	if ($objectType === 'mjlfinancement_budget_line') {
		return 'Ligne budgetaire';
	}
	if ($objectType === 'mjlfinancement_fund_receipt') {
		return 'Réception de fonds';
	}
	return (string) $objectType;
}

function mjl_reports_workflow_action_label($action)
{
	$map = array(
		'created' => 'Creation',
		'field_changed' => 'Modification',
		'document_uploaded' => 'Document ajoute',
		'proof_uploaded' => 'Preuve ajoutee',
		'unsafe_edit_rejected' => 'Modification refusee',
		'received' => 'Reception',
		'not_received' => 'Non-reception',
		'submitted' => 'Soumission',
		'prevalidated' => 'Prevalidation',
		'validated' => 'Validation definitive',
		'final_validated' => 'Validation definitive',
		'rejected' => 'Rejet',
		'corrected' => 'Correction',
		'correction_requested' => 'Correction demandee',
		'deleted' => 'Suppression',
		'activated' => 'Activation',
		'closed' => 'Cloture',
	);
	return isset($map[(string) $action]) ? $map[(string) $action] : (string) $action;
}

function mjl_reports_workflow_status_label($status)
{
	$map = array(
		'draft' => 'Brouillon',
		'active' => 'Active',
		'closed' => 'Cloturee',
		'deleted' => 'Supprimee',
		'submitted' => 'Soumise',
		'prevalidated' => 'Prevalidee',
		'validated' => 'Validee definitivement',
		'final_validated' => 'Validee definitivement',
		'rejected' => 'Rejetee',
		'corrected' => 'Corrigee',
		'correction_requested' => 'Correction demandee',
		'completed' => 'Terminee',
		'cancelled' => 'Annulee',
		'received' => 'Recu',
		'not_received' => 'Non recu',
	);
	return isset($map[(string) $status]) ? $map[(string) $status] : (string) $status;
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

function mjl_reports_partner_filter_sql($column, $filters)
{
	$column = mjl_scope_sanitized_sql_identifier($column);
	if ($column === '') {
		return ' AND 1=0';
	}
	if (!empty($filters['fk_soc'])) {
		return ' AND '.$column.' = '.((int) $filters['fk_soc']);
	}
	return mjl_scope_partner_sql_filter($column, $GLOBALS['user']);
}

function mjl_reports_project_filter_sql($column, $filters)
{
	$column = mjl_scope_sanitized_sql_identifier($column);
	if ($column === '') {
		return ' AND 1=0';
	}
	return !empty($filters['project_id']) ? ' AND '.$column.' = '.((int) $filters['project_id']) : '';
}

function mjl_reports_date_filter_sql($column, $filters, $endOfDay = false)
{
	global $db;
	$column = mjl_scope_sanitized_sql_identifier($column);
	if ($column === '') {
		return ' AND 1=0';
	}
	$sql = '';
	if ($filters['date_start'] !== '') {
		$sql .= " AND ".$column." >= '".$db->escape($filters['date_start'].($endOfDay ? ' 00:00:00' : ''))."'";
	}
	if ($filters['date_end'] !== '') {
		$sql .= " AND ".$column." <= '".$db->escape($filters['date_end'].($endOfDay ? ' 23:59:59' : ''))."'";
	}
	return $sql;
}

function mjl_reports_rate($amount, $base)
{
	$base = (float) $base;
	return $base > 0 ? round(((float) $amount / $base) * 100, 2).'%' : '0%';
}

function mjl_reports_funding_received_partner_rows($filters)
{
	global $db, $conf;

	$sql = 'SELECT s.nom AS partner, p.ref AS project, COUNT(fr.rowid) AS receipt_count, COALESCE(SUM(CASE WHEN fr.status = '.MjlFundReceipt::STATUS_RECEIVED.' THEN fr.amount ELSE 0 END), 0) AS funds_received, MIN(fr.reception_date) AS first_reception_date, MAX(fr.reception_date) AS last_reception_date';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_fund_receipt fr';
	$sql .= ' INNER JOIN '.$db->prefix().'societe s ON s.rowid = fr.fk_soc AND s.entity = fr.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = fr.fk_project AND p.entity = fr.entity';
	$sql .= ' WHERE fr.entity = '.((int) $conf->entity);
	$sql .= mjl_reports_partner_filter_sql('fr.fk_soc', $filters).mjl_reports_project_filter_sql('fr.fk_project', $filters).mjl_reports_date_filter_sql('fr.reception_date', $filters);
	if ($filters['status'] !== '') $sql .= ' AND fr.status = '.((int) $filters['status']);
	$sql .= ' GROUP BY s.nom, p.ref ORDER BY s.nom, p.ref';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_budget_allocation_partner_rows($filters)
{
	global $db, $conf;

	$sql = 'SELECT s.nom AS partner, p.ref AS project, COALESCE(SUM(bl.initial_budget), 0) AS initial_budget, COALESCE(SUM(bl.revised_budget), 0) AS revised_budget, COUNT(bl.rowid) AS budget_lines';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_budget_line bl';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = bl.fk_convention AND c.entity = bl.entity';
	$sql .= ' INNER JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = bl.fk_project AND p.entity = bl.entity';
	$sql .= ' WHERE bl.entity = '.((int) $conf->entity);
	$sql .= mjl_reports_partner_filter_sql('c.fk_soc', $filters).mjl_reports_project_filter_sql('bl.fk_project', $filters);
	$sql .= ' GROUP BY s.nom, p.ref ORDER BY s.nom, p.ref';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_budget_allocation_project_rows($filters)
{
	$rows = mjl_reports_financial_execution_project_rows($filters);
	foreach ($rows as &$row) {
		$row['initial_budget'] = isset($row['initial_budget']) ? $row['initial_budget'] : 0;
		$row['revised_budget'] = isset($row['budget_total']) ? $row['budget_total'] : 0;
		$row['remaining_amount'] = (float) $row['revised_budget'] - (float) $row['validated_expenses'];
	}
	unset($row);
	return $rows;
}

function mjl_reports_financial_execution_partner_rows($filters)
{
	global $db, $conf;

	$sql = 'SELECT s.nom AS partner, p.ref AS project, COALESCE(SUM(bl.revised_budget), 0) AS revised_budget,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_final_validated_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention ce ON ce.rowid = e.fk_convention AND ce.entity = e.entity WHERE e.entity = c.entity AND ce.fk_soc = c.fk_soc AND (c.fk_project IS NULL OR e.fk_project = c.fk_project)'.mjl_reports_project_filter_sql('e.fk_project', $filters).mjl_reports_date_filter_sql('e.expense_date', $filters).'), 0) AS validated_expenses,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_disbursed_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e INNER JOIN '.$db->prefix().'mjlfinancement_convention ce ON ce.rowid = e.fk_convention AND ce.entity = e.entity WHERE e.entity = c.entity AND ce.fk_soc = c.fk_soc AND (c.fk_project IS NULL OR e.fk_project = c.fk_project)'.mjl_reports_project_filter_sql('e.fk_project', $filters).mjl_reports_date_filter_sql('e.expense_date', $filters).'), 0) AS disbursed_expenses';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' INNER JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = c.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = c.fk_project AND p.entity = c.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.fk_convention = c.rowid AND bl.entity = c.entity';
	$sql .= ' WHERE c.entity = '.((int) $conf->entity);
	$sql .= mjl_reports_partner_filter_sql('c.fk_soc', $filters).mjl_reports_project_filter_sql('c.fk_project', $filters);
	$sql .= ' GROUP BY c.fk_soc, s.nom, p.ref ORDER BY s.nom, p.ref';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$row['validation_rate'] = mjl_reports_rate($row['validated_expenses'], $row['revised_budget']);
		$row['execution_rate'] = mjl_reports_rate($row['disbursed_expenses'], $row['revised_budget']);
	}
	unset($row);
	return $rows;
}

function mjl_reports_financial_execution_project_rows($filters)
{
	global $db, $conf;

	$sql = 'SELECT s.nom AS partner, p.ref AS project, p.title AS project_title, COALESCE(SUM(bl.initial_budget), 0) AS initial_budget, COALESCE(SUM(bl.revised_budget), 0) AS budget_total,';
	$sql .= ' COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = p.entity AND fr.fk_project = p.rowid AND fr.status = '.MjlFundReceipt::STATUS_RECEIVED.mjl_reports_date_filter_sql('fr.reception_date', $filters).'), 0) AS funds_received,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_final_validated_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = p.entity AND e.fk_project = p.rowid'.mjl_reports_date_filter_sql('e.expense_date', $filters).'), 0) AS validated_expenses,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_disbursed_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = p.entity AND e.fk_project = p.rowid'.mjl_reports_date_filter_sql('e.expense_date', $filters).'), 0) AS disbursed_expenses,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_submitted_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = p.entity AND e.fk_project = p.rowid'.mjl_reports_date_filter_sql('e.expense_date', $filters).'), 0) AS pending_expenses';
	$sql .= ' FROM '.$db->prefix().'projet p';
	$sql .= ' INNER JOIN '.$db->prefix().'societe s ON s.rowid = p.fk_soc AND s.entity = p.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.fk_project = p.rowid AND bl.entity = p.entity';
	$sql .= ' WHERE p.entity = '.((int) $conf->entity);
	$sql .= mjl_reports_partner_filter_sql('p.fk_soc', $filters).mjl_reports_project_filter_sql('p.rowid', $filters);
	$sql .= ' GROUP BY p.rowid, s.nom, p.ref, p.title ORDER BY s.nom, p.ref';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$row['validation_rate'] = mjl_reports_rate($row['validated_expenses'], $row['budget_total']);
		$row['execution_rate'] = mjl_reports_rate($row['disbursed_expenses'], $row['budget_total']);
	}
	unset($row);
	return $rows;
}

function mjl_reports_physical_execution_project_rows($filters)
{
	global $db, $conf;

	$sql = 'SELECT s.nom AS partner, p.ref AS project, COUNT(a.rowid) AS activity_count, ROUND(AVG(COALESCE(a.physical_execution_percent, t.progress, 0)), 2) AS average_progress,';
	$sql .= ' SUM(CASE WHEN a.status = '.MjlActivity::STATUS_COMPLETED.' THEN 1 ELSE 0 END) AS completed_activities,';
	$sql .= ' SUM(CASE WHEN a.date_end IS NOT NULL AND a.date_end < CURDATE() AND a.status NOT IN ('.MjlActivity::STATUS_COMPLETED.', '.MjlActivity::STATUS_CANCELLED.') THEN 1 ELSE 0 END) AS late_activities';
	$sql .= ' FROM '.$db->prefix().'projet p';
	$sql .= ' INNER JOIN '.$db->prefix().'societe s ON s.rowid = p.fk_soc AND s.entity = p.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.fk_project = p.rowid AND a.entity = p.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet_task t ON t.rowid = a.fk_task AND t.entity = a.entity';
	$sql .= ' WHERE p.entity = '.((int) $conf->entity);
	$sql .= mjl_reports_partner_filter_sql('p.fk_soc', $filters).mjl_reports_project_filter_sql('p.rowid', $filters).mjl_reports_date_filter_sql('a.date_start', $filters);
	$sql .= ' GROUP BY p.rowid, s.nom, p.ref ORDER BY s.nom, p.ref';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_activities_rows($filters)
{
	global $db, $conf, $user;

	$where = array('a.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'a.fk_project = '.((int) $filters['project_id']);
	if ($filters['status'] !== '') $where[] = 'a.status = '.((int) $filters['status']);
	if ($filters['date_start'] !== '') $where[] = "a.date_start >= '".$db->escape($filters['date_start'])."'";
	if ($filters['date_end'] !== '') $where[] = "a.date_end <= '".$db->escape($filters['date_end'])."'";

	$sql = 'SELECT s.nom AS partner, p.ref AS project, a.ref AS activity_ref, a.label AS activity_title, a.date_start, a.date_end, a.status, COALESCE(a.physical_execution_percent, t.progress, 0) AS physical_progress_percent,';
	$sql .= ' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = a.entity AND bl.fk_mjl_activity = a.rowid), 0) AS allocated_budget,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_expense_budget_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = a.entity AND e.fk_mjl_activity = a.rowid AND e.status IN ('.mjl_expense_status_sql_list(mjl_expense_budget_consuming_statuses()).')), 0) AS validated_expenses';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet_task t ON t.rowid = a.fk_task AND t.entity = a.entity';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_reports_partner_filter_sql('c.fk_soc', $filters);
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

function mjl_reports_workflow_rows($filters, $includeReportAudits = false)
{
	global $db, $conf, $user;

	$where = array('w.entity = '.((int) $conf->entity));
	if ($filters['date_start'] !== '') $where[] = "w.action_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	if ($filters['date_end'] !== '') $where[] = "w.action_date <= '".$db->escape($filters['date_end'])." 23:59:59'";
	if (!$includeReportAudits) $where[] = "w.object_type <> 'mjlfinancement_report'";

	$sql = 'SELECT w.object_type, w.object_id, CASE WHEN w.object_type = \'mjlfinancement_activity\' THEN a.ref WHEN w.object_type = \'mjlfinancement_expense\' THEN e.ref WHEN w.object_type = \'mjlfinancement_convention\' THEN c.ref WHEN w.object_type = \'mjlfinancement_budget_line\' THEN bl.ref WHEN w.object_type = \'mjlfinancement_fund_receipt\' THEN fr.ref ELSE NULL END AS object_ref, w.action, w.from_status, w.to_status, u.login AS actor, w.actor_role, w.action_date, COALESCE(w.comment, w.reason) AS comment, w.changes_json';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_workflow_action w';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = w.object_id AND w.object_type = \'mjlfinancement_activity\' AND a.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention ca ON ca.rowid = a.fk_convention AND ca.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = w.object_id AND w.object_type = \'mjlfinancement_expense\' AND e.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention ce ON ce.rowid = e.fk_convention AND ce.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = w.object_id AND w.object_type = \'mjlfinancement_convention\' AND c.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = w.object_id AND w.object_type = \'mjlfinancement_budget_line\' AND bl.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention cb ON cb.rowid = bl.fk_convention AND cb.entity = bl.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = w.object_id AND w.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = w.object_id AND w.object_type = \'mjlfinancement_project\' AND p.entity = w.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = w.actor';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_reports_workflow_scope_sql($filters, $includeReportAudits);
	$sql .= ' ORDER BY w.action_date DESC, w.rowid DESC';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$values = mjl_reports_changes_values(isset($row['changes_json']) ? $row['changes_json'] : '');
		$row['object_type_label'] = mjl_reports_object_type_label($row['object_type']);
		$row['decision'] = mjl_reports_workflow_action_label($row['action']);
		$row['from_status'] = mjl_reports_workflow_status_label($row['from_status']);
		$row['to_status'] = mjl_reports_workflow_status_label($row['to_status']);
		$row['previous_value'] = $values['previous'];
		$row['new_value'] = $values['new'];
	}
	unset($row);

	$expenseRows = $includeReportAudits ? array() : mjl_reports_expense_audit_rows($filters);
	return array_merge($rows, $expenseRows);
}

function mjl_reports_fund_receipt_rows($filters)
{
	global $db, $conf, $user;

	$where = array('fr.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'fr.fk_project = '.((int) $filters['project_id']);
	if (!empty($filters['convention_id'])) $where[] = 'fr.fk_convention = '.((int) $filters['convention_id']);
	if ($filters['status'] !== '') $where[] = 'fr.status = '.((int) $filters['status']);
	if ($filters['date_start'] !== '') $where[] = "fr.reception_date >= '".$db->escape($filters['date_start'])."'";
	if ($filters['date_end'] !== '') $where[] = "fr.reception_date <= '".$db->escape($filters['date_end'])."'";

	$sql = 'SELECT fr.rowid, fr.entity AS evidence_entity, fr.supporting_document AS stored_supporting_document, fr.ref AS receipt_ref, s.nom AS ptf, p.ref AS project, c.ref AS programme, fr.reception_date, fr.amount, fr.status,';
	$sql .= ' CASE WHEN '.mjl_fund_receipt_document_present_sql('fr').' THEN 1 ELSE 0 END AS document_present,';
	$sql .= ' '.mjl_fund_receipt_supporting_document_sql('fr').' AS supporting_document, fr.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_fund_receipt fr';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = fr.fk_soc AND s.entity = fr.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = fr.fk_project AND p.entity = fr.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = fr.fk_convention AND c.entity = fr.entity';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_reports_partner_filter_sql('fr.fk_soc', $filters);
	$sql .= ' ORDER BY fr.reception_date DESC, fr.rowid DESC';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$state = mjl_fund_receipt_evidence_state((int) $row['rowid'], (int) $row['evidence_entity'], $row['stored_supporting_document']);
		$row['document_present'] = $state === 'downloadable' ? 'Oui' : ($state === 'unavailable' ? 'Indisponible' : 'Non');
		$row['supporting_document'] = mjl_fund_receipt_public_document_label((int) $row['rowid'], (int) $row['evidence_entity'], $row['stored_supporting_document']);
		unset($row['rowid'], $row['evidence_entity'], $row['stored_supporting_document']);
	}
	unset($row);
	return $rows;
}

function mjl_reports_expenses_validations_rows($filters)
{
	global $db, $conf, $user;

	$where = array('e.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'e.fk_project = '.((int) $filters['project_id']);
	if ($filters['status'] !== '') $where[] = 'e.status = '.((int) $filters['status']);
	if ($filters['date_start'] !== '') $where[] = "e.expense_date >= '".$db->escape($filters['date_start'])."'";
	if ($filters['date_end'] !== '') $where[] = "e.expense_date <= '".$db->escape($filters['date_end'])."'";

	$sql = 'SELECT e.rowid, e.entity AS evidence_entity, e.supporting_document AS stored_supporting_document, s.nom AS partner, p.ref AS project, a.ref AS activity, e.ref AS expense_ref, e.expense_date, e.amount, e.prevalidated_amount, e.final_validated_amount, e.disbursed_amount, e.status AS expense_status,';
	$sql .= ' CASE WHEN '.mjl_expense_document_present_sql('e').' THEN 1 ELSE 0 END AS document_present,';
	$sql .= ' creator.login AS creator, prevalidator.login AS prevalidator, validator.login AS validator, disburser.login AS disburser, COALESCE(e.final_validation_date, e.validation_date) AS validation_date, e.disbursement_date, e.beneficiary_name, e.correction_reason';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = e.fk_mjl_activity AND a.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user creator ON creator.rowid = e.fk_user_creat';
	$sql .= ' LEFT JOIN '.$db->prefix().'user prevalidator ON prevalidator.rowid = e.fk_user_prevalidated';
	$sql .= ' LEFT JOIN '.$db->prefix().'user validator ON validator.rowid = COALESCE(e.fk_user_final_valid, e.fk_user_valid)';
	$sql .= ' LEFT JOIN '.$db->prefix().'user disburser ON disburser.rowid = e.fk_user_disbursed';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_reports_partner_filter_sql('c.fk_soc', $filters);
	$sql .= ' ORDER BY e.expense_date ASC, e.ref';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$state = mjl_expense_evidence_state((int) $row['rowid'], (int) $row['evidence_entity'], $row['stored_supporting_document']);
		$row['expense_status'] = mjl_reports_expense_status_label($row['expense_status']);
		$row['document_present'] = $state === 'downloadable' ? 'Oui' : ($state === 'unavailable' ? 'Indisponible' : 'Non');
		unset($row['rowid'], $row['evidence_entity'], $row['stored_supporting_document']);
	}
	unset($row);
	return $rows;
}

function mjl_reports_exchange_rows($filters)
{
	global $db, $conf, $user;

	$where = array('x.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = '(a.fk_project = '.((int) $filters['project_id']).' OR e.fk_project = '.((int) $filters['project_id']).' OR c.fk_project = '.((int) $filters['project_id']).' OR bl.fk_project = '.((int) $filters['project_id']).' OR fr.fk_project = '.((int) $filters['project_id']).' OR p.rowid = '.((int) $filters['project_id']).')';
	if ($filters['date_start'] !== '') $where[] = "x.exchange_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	if ($filters['date_end'] !== '') $where[] = "x.exchange_date <= '".$db->escape($filters['date_end'])." 23:59:59'";

	$sql = 'SELECT x.ref, x.object_type, x.object_id, COALESCE(a.ref, e.ref, c.ref, bl.ref, fr.ref, p.ref) AS activity_ref, x.exchange_date, u.login, x.actor_role, x.channel, x.subject, x.message';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_exchange_log x';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_activity a ON a.rowid = x.object_id AND x.object_type = \'mjlfinancement_activity\' AND a.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = x.object_id AND x.object_type = \'mjlfinancement_expense\' AND e.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = x.object_id AND x.object_type = \'mjlfinancement_convention\' AND c.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_budget_line bl ON bl.rowid = x.object_id AND x.object_type = \'mjlfinancement_budget_line\' AND bl.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_fund_receipt fr ON fr.rowid = x.object_id AND x.object_type = \'mjlfinancement_fund_receipt\' AND fr.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = x.object_id AND x.object_type = \'mjlfinancement_project\' AND p.entity = x.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = x.actor';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_reports_exchange_scope_sql($filters);
	$sql .= ' ORDER BY x.exchange_date DESC, x.rowid DESC';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_expense_queue_rows($filters, $status)
{
	global $db, $conf;

	$where = array('e.entity = '.((int) $conf->entity), 'e.status = '.((int) $status));
	if (!empty($filters['project_id'])) $where[] = 'e.fk_project = '.((int) $filters['project_id']);
	if ($filters['date_start'] !== '') $where[] = "e.expense_date >= '".$db->escape($filters['date_start'])."'";
	if ($filters['date_end'] !== '') $where[] = "e.expense_date <= '".$db->escape($filters['date_end'])."'";

	$sql = 'SELECT s.nom AS partner, p.ref AS project, e.ref AS expense_ref, e.expense_date, e.amount, e.prevalidated_amount, e.final_validated_amount, creator.login AS creator, prevalidator.login AS prevalidator, validator.login AS validator, e.prevalidation_date, COALESCE(e.final_validation_date, e.validation_date) AS validation_date, e.beneficiary_name';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' INNER JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user creator ON creator.rowid = e.fk_user_creat';
	$sql .= ' LEFT JOIN '.$db->prefix().'user prevalidator ON prevalidator.rowid = e.fk_user_prevalidated';
	$sql .= ' LEFT JOIN '.$db->prefix().'user validator ON validator.rowid = COALESCE(e.fk_user_final_valid, e.fk_user_valid)';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_reports_partner_filter_sql('c.fk_soc', $filters);
	$sql .= ' ORDER BY e.expense_date ASC, e.ref';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_validated_not_disbursed_rows($filters)
{
	return mjl_reports_expense_queue_rows($filters, MjlExpense::STATUS_FINAL_VALIDATED);
}

function mjl_reports_pending_prevalidation_rows($filters)
{
	return mjl_reports_expense_queue_rows($filters, MjlExpense::STATUS_SUBMITTED);
}

function mjl_reports_pending_final_validation_rows($filters)
{
	return mjl_reports_expense_queue_rows($filters, MjlExpense::STATUS_PREVALIDATED);
}

function mjl_reports_corrections_rejections_rows($filters)
{
	global $db, $conf;

	$expenseStatuses = array(MjlExpense::STATUS_CORRECTED, MjlExpense::STATUS_REJECTED);
	$activityStatuses = array(MjlActivity::STATUS_CORRECTION_REQUESTED, MjlActivity::STATUS_CORRECTED, MjlActivity::STATUS_REJECTED);
	$sql = 'SELECT s.nom AS partner, p.ref AS project, \'Dépense\' AS object_type_label, e.ref AS object_ref, e.status AS raw_status, e.expense_date AS event_date, e.correction_reason AS reason';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_expense e';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = e.fk_convention AND c.entity = e.entity';
	$sql .= ' INNER JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = e.fk_project AND p.entity = e.entity';
	$sql .= ' WHERE e.entity = '.((int) $conf->entity).' AND e.status IN ('.implode(',', array_map('intval', $expenseStatuses)).')';
	$sql .= mjl_reports_partner_filter_sql('c.fk_soc', $filters).mjl_reports_project_filter_sql('e.fk_project', $filters).mjl_reports_date_filter_sql('e.expense_date', $filters);
	$sql .= ' UNION ALL SELECT s.nom AS partner, p.ref AS project, \'Activité\' AS object_type_label, a.ref AS object_ref, a.status AS raw_status, COALESCE(a.date_actual_end, a.date_end, a.date_start) AS event_date, a.execution_comment AS reason';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_activity a';
	$sql .= ' INNER JOIN '.$db->prefix().'mjlfinancement_convention c ON c.rowid = a.fk_convention AND c.entity = a.entity';
	$sql .= ' INNER JOIN '.$db->prefix().'societe s ON s.rowid = c.fk_soc AND s.entity = a.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'projet p ON p.rowid = a.fk_project AND p.entity = a.entity';
	$sql .= ' WHERE a.entity = '.((int) $conf->entity).' AND a.status IN ('.implode(',', array_map('intval', $activityStatuses)).')';
	$sql .= mjl_reports_partner_filter_sql('c.fk_soc', $filters).mjl_reports_project_filter_sql('a.fk_project', $filters);
	if ($filters['date_start'] !== '') $sql .= " AND COALESCE(a.date_actual_end, a.date_end, a.date_start) >= '".$db->escape($filters['date_start'])."'";
	if ($filters['date_end'] !== '') $sql .= " AND COALESCE(a.date_actual_end, a.date_end, a.date_start) <= '".$db->escape($filters['date_end'])."'";
	$sql .= ' ORDER BY event_date DESC, object_ref';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$row['status_label'] = $row['object_type_label'] === 'Dépense' ? mjl_reports_expense_status_label($row['raw_status']) : mjl_reports_activity_status_label($row['raw_status']);
	}
	unset($row);
	return $rows;
}

function mjl_reports_general_audit_rows($filters)
{
	global $user;
	$rows = mjl_reports_workflow_rows($filters, !empty($user->admin));
	foreach ($rows as &$row) {
		unset($row['from_status'], $row['to_status'], $row['previous_value'], $row['new_value']);
	}
	unset($row);
	return $rows;
}

function mjl_reports_exchange_scope_sql($filters)
{
	global $user;
	if (!empty($filters['fk_soc'])) {
		$fkSoc = (int) $filters['fk_soc'];
		return ' AND ('
			.' EXISTS (SELECT 1 FROM '.$GLOBALS['db']->prefix().'mjlfinancement_activity sa INNER JOIN '.$GLOBALS['db']->prefix().'mjlfinancement_convention sc ON sc.rowid = sa.fk_convention AND sc.entity = sa.entity WHERE x.object_type = \'mjlfinancement_activity\' AND x.object_id = sa.rowid AND sa.entity = x.entity AND sc.fk_soc = '.$fkSoc.')'
			.' OR EXISTS (SELECT 1 FROM '.$GLOBALS['db']->prefix().'mjlfinancement_expense se INNER JOIN '.$GLOBALS['db']->prefix().'mjlfinancement_convention sc ON sc.rowid = se.fk_convention AND sc.entity = se.entity WHERE x.object_type = \'mjlfinancement_expense\' AND x.object_id = se.rowid AND se.entity = x.entity AND sc.fk_soc = '.$fkSoc.')'
			.' OR EXISTS (SELECT 1 FROM '.$GLOBALS['db']->prefix().'mjlfinancement_convention sc WHERE x.object_type = \'mjlfinancement_convention\' AND x.object_id = sc.rowid AND sc.entity = x.entity AND sc.fk_soc = '.$fkSoc.')'
			.' OR EXISTS (SELECT 1 FROM '.$GLOBALS['db']->prefix().'mjlfinancement_budget_line sb INNER JOIN '.$GLOBALS['db']->prefix().'mjlfinancement_convention sc ON sc.rowid = sb.fk_convention AND sc.entity = sb.entity WHERE x.object_type = \'mjlfinancement_budget_line\' AND x.object_id = sb.rowid AND sb.entity = x.entity AND sc.fk_soc = '.$fkSoc.')'
			.' OR EXISTS (SELECT 1 FROM '.$GLOBALS['db']->prefix().'mjlfinancement_fund_receipt sf WHERE x.object_type = \'mjlfinancement_fund_receipt\' AND x.object_id = sf.rowid AND sf.entity = x.entity AND sf.fk_soc = '.$fkSoc.')'
			.' OR EXISTS (SELECT 1 FROM '.$GLOBALS['db']->prefix().'projet sp WHERE x.object_type = \'mjlfinancement_project\' AND x.object_id = sp.rowid AND sp.entity = x.entity AND sp.fk_soc = '.$fkSoc.')'
			.')';
	}
	return mjl_timeline_exchange_scope_filter_sql('x', $user);
}

function mjl_reports_dpaf_rows($filters)
{
	global $db, $conf, $user;

	$where = array('c.entity = '.((int) $conf->entity));
	if (!empty($filters['project_id'])) $where[] = 'c.fk_project = '.((int) $filters['project_id']);
	if (!empty($filters['convention_id'])) $where[] = 'c.rowid = '.((int) $filters['convention_id']);

	$sql = 'SELECT c.ref AS convention_ref,';
	$sql .= ' COALESCE((SELECT SUM(bl.revised_budget) FROM '.$db->prefix().'mjlfinancement_budget_line bl WHERE bl.entity = c.entity AND bl.fk_convention = c.rowid), 0) AS budget_revise,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_final_validated_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid), 0) AS depenses_validees,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_disbursed_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid), 0) AS depenses_decaissees,';
	$sql .= ' COALESCE((SELECT SUM('.mjl_finance_submitted_amount_sql('e').') FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid), 0) AS depenses_soumises,';
	$sql .= ' COALESCE((SELECT SUM(fr.amount) FROM '.$db->prefix().'mjlfinancement_fund_receipt fr WHERE fr.entity = c.entity AND fr.fk_convention = c.rowid AND fr.status = 1), 0) AS fonds_recus,';
	$sql .= ' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_activity a WHERE a.entity = c.entity AND a.fk_convention = c.rowid AND a.status IN ('.MjlActivity::STATUS_SUBMITTED.', '.MjlActivity::STATUS_PREVALIDATED.')), 0) AS activites_en_revue,';
	$sql .= ' COALESCE((SELECT COUNT(*) FROM '.$db->prefix().'mjlfinancement_expense e WHERE e.entity = c.entity AND e.fk_convention = c.rowid AND e.status = '.MjlExpense::STATUS_SUBMITTED.'), 0) AS depenses_en_revue';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_convention c';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_scope_partner_sql_filter('c.fk_soc', $user);
	$sql .= ' ORDER BY c.ref';
	return mjl_reports_fetch_rows($sql);
}

function mjl_reports_expense_audit_rows($filters)
{
	global $db, $conf, $user;

	$where = array('v.entity = '.((int) $conf->entity));
	if ($filters['date_start'] !== '') $where[] = "v.action_date >= '".$db->escape($filters['date_start'])." 00:00:00'";
	if ($filters['date_end'] !== '') $where[] = "v.action_date <= '".$db->escape($filters['date_end'])." 23:59:59'";

	$sql = 'SELECT \'Dépense\' AS object_type_label, e.ref AS object_ref, v.action AS decision, v.from_status, v.to_status,';
	$sql .= ' v.from_status AS previous_value, v.to_status AS new_value, u.login AS actor, v.actor_role, v.action_date, v.comment';
	$sql .= ' FROM '.$db->prefix().'mjlfinancement_validation v';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_expense e ON e.rowid = v.fk_expense AND e.entity = v.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'mjlfinancement_convention cscope ON cscope.rowid = e.fk_convention AND cscope.entity = e.entity';
	$sql .= ' LEFT JOIN '.$db->prefix().'user u ON u.rowid = v.fk_user_action';
	$sql .= ' WHERE '.implode(' AND ', $where);
	$sql .= mjl_scope_partner_sql_filter('cscope.fk_soc', $user);
	$sql .= ' ORDER BY v.action_date DESC, v.rowid DESC';
	$rows = mjl_reports_fetch_rows($sql);
	foreach ($rows as &$row) {
		$row['decision'] = mjl_reports_workflow_action_label($row['decision']);
		$row['from_status'] = mjl_reports_workflow_status_label($row['from_status']);
		$row['to_status'] = mjl_reports_workflow_status_label($row['to_status']);
		$row['actor_role'] = mjl_actor_role_label($row['actor_role']);
	}
	unset($row);
	return $rows;
}

function mjl_reports_workflow_scope_sql($filters = array(), $includeReportAudits = false)
{
	global $user;
	$projectFilter = '';
	if (!empty($filters['project_id'])) {
		$projectId = (int) $filters['project_id'];
		$projectFilter = ' AND (a.fk_project = '.$projectId.' OR e.fk_project = '.$projectId.' OR c.fk_project = '.$projectId.' OR bl.fk_project = '.$projectId.' OR fr.fk_project = '.$projectId.' OR p.rowid = '.$projectId.')';
	}
	if (!empty($filters['fk_soc'])) {
		$fkSoc = (int) $filters['fk_soc'];
		$scope = ' AND (ca.fk_soc = '.$fkSoc.' OR ce.fk_soc = '.$fkSoc.' OR c.fk_soc = '.$fkSoc.' OR cb.fk_soc = '.$fkSoc.' OR fr.fk_soc = '.$fkSoc.' OR p.fk_soc = '.$fkSoc;
		if ($includeReportAudits && !empty($user->admin)) {
			$scope .= ' OR w.object_type = \'mjlfinancement_report\'';
		}
		return $scope.')'.$projectFilter;
	}
	$scopeIds = mjl_scope_user_soc_ids($user);
	if ($scopeIds === null) {
		return $projectFilter.($includeReportAudits ? '' : ' AND w.object_type <> \'mjlfinancement_report\'');
	}
	if (empty($scopeIds)) {
		return ' AND 1=0';
	}
	$list = implode(',', array_map('intval', $scopeIds));
	return ' AND (ca.fk_soc IN ('.$list.') OR ce.fk_soc IN ('.$list.') OR c.fk_soc IN ('.$list.') OR cb.fk_soc IN ('.$list.') OR fr.fk_soc IN ('.$list.') OR p.fk_soc IN ('.$list.'))'.$projectFilter;
}

function mjl_reports_audit_export($def, $filters, $format, $rowCount)
{
	global $conf, $user;

	$changes = array(
		'report' => $def['key'],
		'format' => $format,
		'rows' => (int) $rowCount,
		'filters' => $filters,
	);
	$reportId = mjl_reports_get_or_create_report_row($def);
	$id = $reportId > 0 ? mjl_workflow_audit_insert('mjlfinancement_report', $reportId, (int) $conf->entity, 'Export '.$format, $user, mjl_reports_actor_role(), 'export_generated', 'Export '.$def['label'].' en '.$format, $changes, 'WFA-EXP') : -1;
	if ($id <= 0 && function_exists('dol_syslog')) {
		dol_syslog('MJL export audit failed for report '.$def['key'], LOG_WARNING);
	}
}

function mjl_reports_get_or_create_report_row($def)
{
	global $db, $conf, $user;

	$ref = 'REPORT-'.strtoupper(preg_replace('/[^A-Za-z0-9]+/', '-', (string) $def['key']));
	$sql = 'SELECT rowid FROM '.$db->prefix().'mjlfinancement_report WHERE entity = '.((int) $conf->entity)." AND ref = '".$db->escape($ref)."' ORDER BY rowid DESC LIMIT 1";
	$resql = $db->query($sql);
	if ($resql && ($obj = $db->fetch_object($resql))) {
		return (int) $obj->rowid;
	}
	$sql = 'INSERT INTO '.$db->prefix().'mjlfinancement_report';
	$sql .= ' (entity, ref, name, scope, expected_format, filters, must_include, date_creation, fk_user_creat, import_key)';
	$sql .= ' VALUES ('.((int) $conf->entity).", '".$db->escape($ref)."', '".$db->escape((string) $def['label'])."', '".$db->escape((string) $def['scope'])."', 'CSV/XLSX', '', '', NOW(), ".((int) $user->id).", 'PRODREPORT')";
	if (!$db->query($sql)) {
		return 0;
	}
	return (int) $db->last_insert_id($db->prefix().'mjlfinancement_report');
}

function mjl_reports_actor_role()
{
	global $user;
	if (mjl_scope_is_platform_admin($user)) return 'ADMIN_PLATEFORME';
	if (mjl_scope_is_final_validator($user)) return 'VALIDATEUR_DEFINITIF';
	if (mjl_scope_is_verifier($user)) return 'AGENT_VERIFICATEUR';
	if (mjl_scope_is_input_agent($user)) return 'AGENT_SAISIE';
	return 'PROFIL_NON_RESOLU';
}
