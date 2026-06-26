<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_workspace.lib.php';

if (!mjl_workspace_user_can_read($user)) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');

$capabilities = mjl_workspace_capabilities($user);
$metrics = mjl_workspace_metrics($user);
$dashboardMetrics = array();
if ($capabilities['admin'] || $capabilities['reviewer'] || $capabilities['supervision']) {
	$dashboardMetrics = mjl_dashboard_workspace_metrics();
}

llxHeader('', 'Tableau de bord MJL');

print '<div class="mjl-workspace">';
mjl_dashboard_render_header(
	'Tableau de bord MJL',
	'Suivre les activites, les validations, les alertes et les acces sans exposer la complexite Dolibarr.',
	'Utilisateur',
	$user->getFullName($langs) ?: $user->login
);

if ($capabilities['admin']) {
	mjl_dashboard_render_card_section(
		'Administration',
		'Gerer les invitations et garder un acces rapide aux surfaces de supervision.',
		array(
			array('label' => 'Invitations en attente', 'value' => $metrics['pending_invitations'], 'context' => 'Acces envoyes non encore actives', 'href' => '/custom/mjlfinancement/admin/access.php', 'action' => 'Gerer les invitations', 'status' => 'Administration', 'tone' => 'neutral'),
			array('label' => 'Risques echeance', 'value' => $dashboardMetrics['deadline_risks'], 'context' => 'Activites ouvertes a traiter avant ou apres echeance', 'href' => '/custom/mjlfinancement/dpafdashboard.php', 'action' => 'Ouvrir la supervision', 'status' => 'Supervision', 'tone' => $dashboardMetrics['deadline_risks'] > 0 ? 'warning' : 'neutral'),
			array('label' => 'Rapports disponibles', 'value' => $metrics['reports_available'], 'context' => 'Exports et rapports MJL', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Ouvrir les rapports', 'status' => 'Sorties officielles', 'tone' => 'neutral'),
		)
	);
}

if (!$capabilities['admin'] && $capabilities['operational']) {
	mjl_dashboard_render_card_section(
		'Mes actions attendues',
		'Creer, corriger et suivre les activites ou depenses sous votre responsabilite.',
		array(
			array('label' => 'Activites a finaliser', 'value' => $metrics['own_activity_drafts'], 'context' => 'Brouillons ou corrections a reprendre', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Ouvrir les activites', 'status' => 'Action attendue', 'tone' => $metrics['own_activity_drafts'] > 0 ? 'warning' : 'neutral'),
			array('label' => 'Depenses soumises', 'value' => $metrics['own_expenses_submitted'], 'context' => 'Depenses actuellement en revue', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Suivre les depenses', 'status' => 'En revue', 'tone' => 'neutral'),
			array('label' => 'Pieces manquantes', 'value' => $metrics['own_missing_expense_documents'], 'context' => 'Depenses ouvertes sans piece justificative detectee', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Completer les depenses', 'status' => 'Justificatif', 'tone' => $metrics['own_missing_expense_documents'] > 0 ? 'warning' : 'neutral'),
		)
	);
}

if (!$capabilities['admin'] && $capabilities['reviewer']) {
	mjl_dashboard_render_card_section(
		'File de validation',
		'Identifier rapidement les dossiers a examiner et les risques de delai.',
		array(
			array('label' => 'Activites en revue', 'value' => $metrics['activities_submitted'], 'context' => 'Activites soumises a decision', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Examiner les activites', 'status' => 'Decision attendue', 'tone' => $metrics['activities_submitted'] > 0 ? 'warning' : 'neutral'),
			array('label' => 'Depenses en revue', 'value' => $metrics['expenses_submitted'], 'context' => 'Depenses soumises a validation', 'href' => '/custom/mjlfinancement/expenses.php', 'action' => 'Examiner les depenses', 'status' => 'Decision attendue', 'tone' => $metrics['expenses_submitted'] > 0 ? 'warning' : 'neutral'),
			array('label' => 'Risques echeance', 'value' => $dashboardMetrics['deadline_risks'], 'context' => 'Activites ouvertes a verifier avant ou apres echeance', 'href' => '/custom/mjlfinancement/activities.php', 'action' => 'Voir les activites', 'status' => 'Delai', 'tone' => $dashboardMetrics['deadline_risks'] > 0 ? 'warning' : 'neutral'),
		)
	);
}

if (!$capabilities['admin'] && $capabilities['supervision']) {
	mjl_dashboard_render_card_section(
		'Supervision DPAF',
		'Consulter le portefeuille, les alertes et les sorties officielles.',
		array(
			array('label' => 'Revues en attente', 'value' => $dashboardMetrics['pending_reviews'], 'context' => 'Activites et depenses soumises', 'href' => '/custom/mjlfinancement/dpafdashboard.php', 'action' => 'Ouvrir le tableau DPAF', 'status' => 'Supervision', 'tone' => $dashboardMetrics['pending_reviews'] > 0 ? 'warning' : 'neutral'),
			array('label' => 'Risques echeance', 'value' => $dashboardMetrics['deadline_risks'], 'context' => 'Activites ouvertes avec delai proche ou depasse', 'href' => '/custom/mjlfinancement/dpafdashboard.php', 'action' => 'Analyser les risques', 'status' => 'Delai', 'tone' => $dashboardMetrics['deadline_risks'] > 0 ? 'warning' : 'neutral'),
			array('label' => 'Rapports disponibles', 'value' => $metrics['reports_available'], 'context' => 'Exports et rapports MJL', 'href' => '/custom/mjlfinancement/reports.php', 'action' => 'Ouvrir les rapports', 'status' => 'Sorties officielles', 'tone' => 'neutral'),
		)
	);
}

mjl_workspace_render_navigation($capabilities);

print '</div>';

llxFooter();
$db->close();

function mjl_workspace_render_navigation($capabilities)
{
	$items = array();
	if ($capabilities['activity_read']) {
		$items[] = array('Activites', '/custom/mjlfinancement/activities.php', 'Suivi des activites et decisions');
	}
	if ($capabilities['expense_read']) {
		$items[] = array('Depenses', '/custom/mjlfinancement/expenses.php', 'Depenses et pieces justificatives');
	}
	if ($capabilities['validation_read']) {
		$items[] = array('Historique validations', '/custom/mjlfinancement/validations.php', 'Trace des decisions sur depenses');
	}
	if ($capabilities['supervision']) {
		$items[] = array('Tableau DPAF', '/custom/mjlfinancement/dpafdashboard.php', 'Supervision et alertes globales');
		$items[] = array('Rapports', '/custom/mjlfinancement/reports.php', 'Exports et sorties officielles');
	}
	if ($capabilities['admin']) {
		$items[] = array('Invitations', '/custom/mjlfinancement/admin/access.php', 'Gestion des acces invitation-only');
	}
	if (!$capabilities['operational'] && !$capabilities['reviewer'] && !$capabilities['supervision'] && $capabilities['workflowaction_read']) {
		$items[] = array('Actions workflow', '/custom/mjlfinancement/workflowactions.php', 'Consultation avancee de l audit');
	}
	if (!$capabilities['operational'] && !$capabilities['reviewer'] && !$capabilities['supervision'] && $capabilities['exchangelog_read']) {
		$items[] = array('Echanges', '/custom/mjlfinancement/exchangelogs.php', 'Journal des echanges');
	}

	mjl_dashboard_render_link_section(
		'Acces rapides',
		'Les liens affiches respectent le profil temporaire et les droits actifs.',
		$items
	);
}
