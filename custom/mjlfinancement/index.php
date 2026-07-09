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
$metrics = mjl_workspace_metrics($user);
$dashboardMetrics = array();
if ($capabilities['admin'] || $capabilities['reviewer'] || $capabilities['supervision']) {
	$dashboardMetrics = mjl_dashboard_workspace_metrics();
}
$alertCount = mjl_alerts_user_can_read($user) ? mjl_alerts_count_for_user($user) : 0;

llxHeader('', 'Tableau de bord MJL');

mjl_navigation_shell_start($user, 'dashboard');
print '<div class="mjl-workspace">';
mjl_dashboard_render_header(
	'Tableau de bord MJL',
	'Suivre les activites, les validations, les alertes et les acces sans exposer la complexite Dolibarr.',
	'Utilisateur',
	$user->getFullName($langs) ?: $user->login
);

if ($capabilities['admin']) {
	$cards = array(
		array('label' => 'Invitations en attente', 'value' => $metrics['pending_invitations'], 'context' => 'Acces envoyes non encore actives', 'href' => '/custom/mjlfinancement/admin/access.php', 'action' => 'Gerer les invitations', 'status' => 'Administration', 'tone' => 'neutral'),
		array('label' => 'Rapports disponibles', 'value' => $metrics['reports_available'], 'context' => 'Exports et rapports MJL', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Ouvrir les rapports', 'status' => 'Sorties officielles', 'tone' => 'neutral'),
	);
	if (mjl_alerts_user_can_read($user)) {
		$cards[] = array('label' => 'Risques echeance', 'value' => $dashboardMetrics['deadline_risks'], 'context' => 'Activites ouvertes a traiter avant ou apres echeance', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Ouvrir les alertes', 'status' => 'Supervision', 'tone' => $dashboardMetrics['deadline_risks'] > 0 ? 'warning' : 'neutral');
	}
	$cards[] = array('label' => 'Execution physique', 'value' => $dashboardMetrics['physical_execution_percent'].'%', 'context' => 'Moyenne des activites visibles avec avancement renseigne', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activites', 'status' => 'Execution', 'tone' => 'neutral');
	if (!empty($cards)) {
		mjl_dashboard_render_card_section(
			'Administration',
			'Gerer les invitations et garder un acces rapide aux surfaces de supervision.',
			$cards
		);
	}
}

if (!$capabilities['admin'] && $capabilities['operational']) {
	$cards = array();
	if ($capabilities['activity_read']) {
		$cards[] = array('label' => 'Activites a finaliser', 'value' => $metrics['own_activity_drafts'], 'context' => 'Brouillons ou corrections a reprendre', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Ouvrir les activites', 'status' => 'Action attendue', 'tone' => $metrics['own_activity_drafts'] > 0 ? 'warning' : 'neutral');
	}
	if ($capabilities['expense_read']) {
		$cards[] = array('label' => 'Depenses soumises', 'value' => $metrics['own_expenses_submitted'], 'context' => 'Depenses actuellement en revue', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Suivre les depenses', 'status' => 'En revue', 'tone' => 'neutral');
		$cards[] = array('label' => 'Pieces manquantes', 'value' => $metrics['own_missing_expense_documents'], 'context' => 'Depenses ouvertes sans piece justificative detectee', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Completer les depenses', 'status' => 'Justificatif', 'tone' => $metrics['own_missing_expense_documents'] > 0 ? 'warning' : 'neutral');
	}
	if (mjl_alerts_user_can_read($user)) {
		$cards[] = array('label' => 'Alertes actives', 'value' => $alertCount, 'context' => 'Delais et justificatifs incomplets dans votre perimetre', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Ouvrir les alertes', 'status' => 'Action attendue', 'tone' => $alertCount > 0 ? 'warning' : 'neutral');
	}
	if (!empty($cards)) {
		mjl_dashboard_render_card_section(
			'Mes actions attendues',
			'Creer, corriger et suivre les activites ou depenses sous votre responsabilite.',
			$cards
		);
	}
}

if (!$capabilities['admin'] && $capabilities['reviewer']) {
	$cards = array();
	if ($capabilities['activity_read']) {
		$cards[] = array('label' => 'Activites en revue', 'value' => $metrics['activities_submitted'], 'context' => 'Activites soumises a decision', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Examiner les activites', 'status' => 'Decision attendue', 'tone' => $metrics['activities_submitted'] > 0 ? 'warning' : 'neutral');
	}
	if ($capabilities['expense_read']) {
		$cards[] = array('label' => 'Depenses en revue', 'value' => $metrics['expenses_submitted'], 'context' => 'Depenses soumises a validation', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Examiner les depenses', 'status' => 'Decision attendue', 'tone' => $metrics['expenses_submitted'] > 0 ? 'warning' : 'neutral');
	}
	if (mjl_alerts_user_can_read($user)) {
		$cards[] = array('label' => 'Risques echeance', 'value' => $dashboardMetrics['deadline_risks'], 'context' => 'Activites ouvertes a verifier avant ou apres echeance', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Ouvrir les alertes', 'status' => 'Delai', 'tone' => $dashboardMetrics['deadline_risks'] > 0 ? 'warning' : 'neutral');
		$cards[] = array('label' => 'Alertes actives', 'value' => $alertCount, 'context' => 'Risques et decisions attendues dans la file', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Ouvrir les alertes', 'status' => 'Alertes', 'tone' => $alertCount > 0 ? 'warning' : 'neutral');
	}
	$cards[] = array('label' => 'Execution physique', 'value' => $dashboardMetrics['physical_execution_percent'].'%', 'context' => 'Moyenne des activites visibles avec avancement renseigne', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Ouvrir les activites', 'status' => 'Execution', 'tone' => 'neutral');
	if (!empty($cards)) {
		mjl_dashboard_render_card_section(
			'File de validation',
			'Identifier rapidement les dossiers a examiner et les risques de delai.',
			$cards
		);
	}
}

if (!$capabilities['admin'] && $capabilities['supervision']) {
	$cards = array(
		array('label' => 'Revues en attente', 'value' => $dashboardMetrics['pending_reviews'], 'context' => 'Activites et depenses soumises', 'href' => '/custom/mjlfinancement/dpafdashboard.php', 'action' => 'Ouvrir la supervision finance', 'status' => 'Supervision', 'tone' => $dashboardMetrics['pending_reviews'] > 0 ? 'warning' : 'neutral'),
		array('label' => 'Rapports disponibles', 'value' => $metrics['reports_available'], 'context' => 'Exports et rapports MJL', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Ouvrir les rapports', 'status' => 'Sorties officielles', 'tone' => 'neutral'),
	);
	if (mjl_alerts_user_can_read($user)) {
		$cards[] = array('label' => 'Risques echeance', 'value' => $dashboardMetrics['deadline_risks'], 'context' => 'Activites ouvertes avec delai proche ou depasse', 'href' => '/custom/mjlfinancement/alerts.php', 'action' => 'Analyser les risques', 'status' => 'Delai', 'tone' => $dashboardMetrics['deadline_risks'] > 0 ? 'warning' : 'neutral');
	}
	$cards[] = array('label' => 'Execution physique', 'value' => $dashboardMetrics['physical_execution_percent'].'%', 'context' => 'Moyenne des activites visibles avec avancement renseigne', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activites', 'status' => 'Execution', 'tone' => 'neutral');
	if (!empty($cards)) {
		mjl_dashboard_render_card_section(
			'Supervision finance',
			'Consulter le portefeuille, les alertes et les sorties officielles.',
			$cards
		);
	}
}

mjl_navigation_render_quick_section($user);

print '</div>';
mjl_navigation_shell_end();

llxFooter();
$db->close();
