<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_alerts.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

if (!mjl_workspace_user_can_enter($user)) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');

$capabilities = mjl_workspace_capabilities($user);
$filters = mjl_dashboard_filters_from_request($user);
$metrics = mjl_workspace_metrics($user, $filters);
$dashboardMetrics = array();
if ($capabilities['admin'] || $capabilities['reviewer'] || $capabilities['supervision']) {
	$dashboardMetrics = mjl_dashboard_workspace_metrics_filtered($filters);
}
$alertMetric = mjl_dashboard_capture(function () use ($user, $filters) {
	return mjl_alerts_user_can_read($user) ? count(mjl_dashboard_filter_alerts(mjl_alert_conditions_for_user($user, 500), $filters)) : 0;
});
$alertCount = $alertMetric['value'];

llxHeader('', 'Tableau de bord MJL');

mjl_navigation_shell_start($user);
print '<div class="mjl-workspace">';
print mjl_page_header_render(
	'Tableau de bord MJL',
	array(
		'description' => 'Suivre les activités, les validations, les alertes et les accès sans exposer la complexité Dolibarr.',
		'context' => array('label' => 'Utilisateur', 'value' => $user->getFullName($langs) ?: $user->login),
	)
);
mjl_dashboard_render_filters($filters, '/custom/mjlfinancement/index.php');

if ($capabilities['admin']) {
	$cards = array(
		array('label' => 'Invitations en attente', 'value' => $metrics['pending_invitations'], 'available' => $metrics['available']['pending_invitations'], 'context' => 'Accès envoyés non encore activés', 'href' => '/custom/mjlfinancement/admin/access.php', 'action' => 'Gérer les invitations', 'status' => 'Administration', 'tone' => 'neutral'),
		array('label' => 'Rapports disponibles', 'value' => $metrics['reports_available'], 'available' => $metrics['available']['reports_available'], 'context' => 'Exports et rapports MJL', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Ouvrir les rapports', 'status' => 'Sorties officielles', 'tone' => 'neutral'),
	);
	$unresolved = mjl_dashboard_capture(function () { return mjl_dashboard_unresolved_scope_count(); });
	$unresolvedCount = $unresolved['value'];
	$cards[] = array('label' => 'Données à qualifier', 'value' => $unresolvedCount, 'available' => $unresolved['available'], 'context' => 'Objets ou traces sans périmètre résolu, visibles uniquement en administration plateforme', 'href' => '/custom/mjlfinancement/workflowactions.php', 'action' => 'Ouvrir l audit', 'status' => 'Diagnostic', 'tone' => $unresolvedCount > 0 ? 'warning' : 'neutral');
	if (mjl_alerts_user_can_read($user)) {
		$cards[] = array('label' => 'Risques échéance', 'value' => $dashboardMetrics['deadline_risks'], 'available' => $dashboardMetrics['available']['deadline_risks'], 'context' => 'Activités ouvertes à traiter avant ou après échéance', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Ouvrir les alertes', 'status' => 'Supervision', 'tone' => $dashboardMetrics['deadline_risks'] > 0 ? 'warning' : 'neutral');
	}
	$cards[] = array('label' => 'Exécution physique', 'value' => $dashboardMetrics['physical_execution_percent'].'%', 'available' => $dashboardMetrics['available']['physical_execution_percent'], 'context' => 'Moyenne des activités visibles avec avancement renseigné', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activités', 'status' => 'Exécution', 'tone' => 'neutral');
	if (!empty($cards)) {
		mjl_dashboard_render_card_section(
			'Administration plateforme',
			'Gérer les invitations et garder un accès rapide aux surfaces de supervision.',
			$cards
		);
	}
}

if (!$capabilities['admin'] && $capabilities['operational']) {
	$cards = array();
	if ($capabilities['activity_read']) {
		$cards[] = array('label' => 'Activités a finaliser', 'value' => $metrics['own_activity_drafts'], 'available' => $metrics['available']['own_activity_drafts'], 'context' => 'Brouillons ou corrections a reprendre', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Ouvrir les activités', 'status' => 'Action attendue', 'tone' => $metrics['own_activity_drafts'] > 0 ? 'warning' : 'neutral');
	}
	if ($capabilities['expense_read']) {
		$cards[] = array('label' => 'Dépenses soumises', 'value' => $metrics['own_expenses_submitted'], 'available' => $metrics['available']['own_expenses_submitted'], 'context' => 'Dépenses actuellement en revue', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Suivre les dépenses', 'status' => 'En revue', 'tone' => 'neutral');
		$cards[] = array('label' => 'Pièces manquantes', 'value' => $metrics['own_missing_expense_documents'], 'available' => $metrics['available']['own_missing_expense_documents'], 'context' => 'Dépenses ouvertes sans pièce justificative detectee', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Completer les dépenses', 'status' => 'Justificatif', 'tone' => $metrics['own_missing_expense_documents'] > 0 ? 'warning' : 'neutral');
	}
	if (mjl_alerts_user_can_read($user)) {
		$cards[] = array('label' => 'Alertes actives', 'value' => $alertCount, 'available' => $alertMetric['available'], 'context' => 'Delais et justificatifs incomplets dans votre périmètre', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Ouvrir les alertes', 'status' => 'Action attendue', 'tone' => $alertCount > 0 ? 'warning' : 'neutral');
	}
	if (!empty($cards)) {
		mjl_dashboard_render_card_section(
			'Mes actions attendues',
			'Créer, corriger et suivre les activités ou dépenses sous votre responsabilite.',
			$cards
		);
	}
}

if (!$capabilities['admin'] && $capabilities['reviewer']) {
	$cards = array();
	if ($capabilities['activity_read']) {
		$cards[] = array('label' => 'Activités en revue', 'value' => $metrics['activities_submitted'], 'available' => $metrics['available']['activities_submitted'], 'context' => 'Activités soumises à décision', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Examiner les activités', 'status' => 'Décision attendue', 'tone' => $metrics['activities_submitted'] > 0 ? 'warning' : 'neutral');
	}
	if ($capabilities['expense_read']) {
		$cards[] = array('label' => 'Dépenses en revue', 'value' => $metrics['expenses_submitted'], 'available' => $metrics['available']['expenses_submitted'], 'context' => 'Dépenses soumises à validation', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Examiner les dépenses', 'status' => 'Décision attendue', 'tone' => $metrics['expenses_submitted'] > 0 ? 'warning' : 'neutral');
	}
	if (mjl_alerts_user_can_read($user)) {
		$cards[] = array('label' => 'Risques échéance', 'value' => $dashboardMetrics['deadline_risks'], 'available' => $dashboardMetrics['available']['deadline_risks'], 'context' => 'Activités ouvertes à vérifier avant ou après échéance', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Ouvrir les alertes', 'status' => 'Délai', 'tone' => $dashboardMetrics['deadline_risks'] > 0 ? 'warning' : 'neutral');
		$cards[] = array('label' => 'Alertes actives', 'value' => $alertCount, 'available' => $alertMetric['available'], 'context' => 'Risques et décisions attendues dans la file', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Ouvrir les alertes', 'status' => 'Alertes', 'tone' => $alertCount > 0 ? 'warning' : 'neutral');
	}
	$cards[] = array('label' => 'Exécution physique', 'value' => $dashboardMetrics['physical_execution_percent'].'%', 'available' => $dashboardMetrics['available']['physical_execution_percent'], 'context' => 'Moyenne des activités visibles avec avancement renseigné', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Ouvrir les activités', 'status' => 'Exécution', 'tone' => 'neutral');
	if (!empty($cards)) {
		mjl_dashboard_render_card_section(
			'File de validation',
			'Identifier rapidement les dossiers à examiner et les risques de délai.',
			$cards
		);
	}
}

if (!$capabilities['admin'] && $capabilities['supervision']) {
	$cards = array(
		array('label' => 'Revues en attente', 'value' => $dashboardMetrics['pending_reviews'], 'available' => $dashboardMetrics['available']['pending_reviews'], 'context' => 'Activités et dépenses soumises', 'href' => '/custom/mjlfinancement/dpafdashboard.php', 'action' => 'Ouvrir la supervision finance', 'status' => 'Supervision', 'tone' => $dashboardMetrics['pending_reviews'] > 0 ? 'warning' : 'neutral'),
		array('label' => 'Rapports disponibles', 'value' => $metrics['reports_available'], 'available' => $metrics['available']['reports_available'], 'context' => 'Exports et rapports MJL', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Ouvrir les rapports', 'status' => 'Sorties officielles', 'tone' => 'neutral'),
	);
	if (mjl_alerts_user_can_read($user)) {
		$cards[] = array('label' => 'Risques échéance', 'value' => $dashboardMetrics['deadline_risks'], 'available' => $dashboardMetrics['available']['deadline_risks'], 'context' => 'Activités ouvertes avec delai proche ou depasse', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Analyser les risques', 'status' => 'Delai', 'tone' => $dashboardMetrics['deadline_risks'] > 0 ? 'warning' : 'neutral');
	}
	$cards[] = array('label' => 'Exécution physique', 'value' => $dashboardMetrics['physical_execution_percent'].'%', 'available' => $dashboardMetrics['available']['physical_execution_percent'], 'context' => 'Moyenne des activités visibles avec avancement renseigné', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activités', 'status' => 'Exécution', 'tone' => 'neutral');
	if (!empty($cards)) {
		mjl_dashboard_render_card_section(
			'Supervision finance',
			'Consulter le portefeuille, les alertes et les sorties officielles.',
			$cards
		);
	}
}

print '</div>';
mjl_navigation_shell_end();

llxFooter();
$db->close();
