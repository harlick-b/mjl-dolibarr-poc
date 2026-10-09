<?php

require_once dirname(__DIR__).'/mjl_navigation.lib.php';
require_once dirname(__DIR__).'/mjl_page_header.lib.php';
require_once dirname(__DIR__).'/mjl_ui.lib.php';
require_once dirname(__DIR__).'/mjl_http.lib.php';
require_once dirname(__DIR__).'/mjl_dashboard_ui.lib.php';
require_once dirname(__DIR__).'/mjl_monitoring_access.lib.php';
require_once __DIR__.'/mjl_monitoring_read.lib.php';
require_once __DIR__.'/mjl_monitoring_presentation.lib.php';

function mjl_monitoring_http($db, $user, $entity, $surface, array $source, $method)
{
	if (!in_array($surface, array('home', 'alerts'), true)) throw new InvalidArgumentException('INVALID_MONITORING_SURFACE');
	$role = mjl_scope_effective_role_code($user, $entity);
	if ($surface === 'home') {
		if (!mjl_navigation_policy_allows($user, 'workspace_enter')) mjl_http_error(403, 'Accès non autorisé.');
	} elseif (!mjl_navigation_policy_allows($user, 'planning_read')) {
		mjl_http_error(403, 'Accès non autorisé.');
	}
	if ($method !== 'GET') { header('Allow: GET'); mjl_http_error(405, 'Consultez le suivi avec une requête GET.'); }

	$admin = $surface === 'home' && $role === 'ADMIN_PLATEFORME';
	if ($admin) {
		$title = 'Administration';
		$options = array(
			'breadcrumb' => array(array('label' => 'MJL')),
			'description' => 'Gestion des accès, audit et configuration technique.',
			'context' => array('label' => 'Rôle', 'value' => mjl_scope_role_label($role)),
		);
		header('Cache-Control: private, no-store');
		llxHeader('', $title);
		mjl_navigation_shell_start($user);
		require dirname(__DIR__, 2).'/tpl/monitoring/home.php';
		mjl_navigation_shell_end();
		llxFooter();
		return;
	}
	if (!mjl_navigation_policy_allows($user, 'planning_read')) mjl_http_error(403, 'Accès non autorisé.');

	$readiness = mjl_monitoring_readiness();
	if ($surface === 'alerts' && (int) $readiness === 0) mjl_http_error(403, 'Les alertes cibles ne sont pas encore disponibles.');

	unset($source['result'], $source['mainmenu'], $source['leftmenu']);
	try { $filters = mjl_monitoring_validate_request($source); }
	catch (InvalidArgumentException $exception) { mjl_http_error(400, 'Filtres invalides.'); }

	$data = null;
	$legacyUnavailable = $surface === 'home' && (int) $readiness === 0;
	if ((int) $readiness === 1) {
		try { $data = mjl_monitoring_read_page($db, $user, $entity, $surface, $filters); }
		catch (Throwable $exception) { http_response_code(503); }
	} elseif (!$legacyUnavailable) {
		http_response_code(503);
	}

	$role = $data === null ? $role : $data['role'];
	$date = $data === null ? (new DateTimeImmutable('now', new DateTimeZone('Africa/Porto-Novo')))->format('Y-m-d') : $data['date'];
	$activities = $data === null ? null : $data['activities'];
	$choices = $data === null ? null : $data['choices'];
	$queue = null;
	if ($surface === 'home' && $data !== null && $data['work_activities'] !== null && $data['requests'] !== null) $queue = mjl_monitoring_queue($data['work_activities'], $data['requests'], $role, (int) $user->id, $date);
	$alerts = $activities === null ? null : mjl_monitoring_alerts($activities, $role, (int) $user->id, $date);
	$profile = mjl_dashboard_profile($role);
	$title = $surface === 'home' ? 'Tableau de bord' : 'Alertes';
	$options = array(
		'description' => $surface === 'home' ? $profile['description'] : 'Montants cumulés courants et suivi dans votre périmètre d’accès.',
		'context' => array('label' => 'Rôle', 'value' => mjl_scope_role_label($role)),
	);
	if ($surface === 'home') $options['primary_action'] = array('label' => 'Voir les Activités', 'href' => mjl_monitoring_url('activities'));

	header('Cache-Control: private, no-store');
	llxHeader('', $title);
	mjl_navigation_shell_start($user);
	require dirname(__DIR__, 2).'/tpl/monitoring/'.$surface.'.php';
	mjl_navigation_shell_end();
	llxFooter();
}
