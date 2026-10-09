<?php

require_once dirname(__DIR__, 2).'/class/mjlexport.class.php';
require_once dirname(__DIR__).'/mjl_navigation.lib.php';
require_once dirname(__DIR__).'/mjl_page_header.lib.php';
require_once dirname(__DIR__).'/mjl_ui.lib.php';
require_once dirname(__DIR__).'/mjl_report_ui.lib.php';
require_once __DIR__.'/mjl_reporting_http_support.lib.php';
require_once __DIR__.'/mjl_reporting_read.lib.php';
require_once __DIR__.'/mjl_reporting_presentation.lib.php';
require_once __DIR__.'/mjl_export_delivery.lib.php';

function mjl_reporting_preview_http($db, $user, $entity, array $get, $method)
{
	try { $probe = $get; $requestedType = mjl_reporting_route_type($probe); }
	catch (InvalidArgumentException $exception) { mjl_http_error(400, 'Filtres invalides.'); }
	mjl_reporting_require_actor($requestedType, $user, $entity);
	if ($requestedType === 'audit') { mjl_reporting_audit_http($db, $user, $entity, $get, $method); return; }
	if ($method !== 'GET') { header('Allow: GET'); mjl_http_error(405, 'Consultez le rapport avec une requête GET.'); }

	try { $source = $get; $type = mjl_reporting_route_type($source); $filters = mjl_report_validate_request($type, 'csv', $source); }
	catch (InvalidArgumentException $exception) { mjl_http_error(400, 'Filtres invalides.'); }
	$isPortfolio = $type === 'portfolio';
	$isDetail = $type === 'activity_detail';
	$isOperations = $type === 'operations';
	$title = mjl_report_titles()[$type];
	$plural = $isOperations ? 'Opérations' : 'Activités';
	$singular = $isOperations ? 'Opération' : 'Activité';
	$resetUrl = DOL_URL_ROOT.'/custom/mjlfinancement/reports.php'.($type !== 'activities' ? '?report='.$type : '');
	$captured = gmdate('Y-m-d H:i:s');
	$available = true;
	$rows = array();
	$choices = array();
	$detail = null;
	try {
		$snapshot = mjl_reporting_read_preview($db, $user, $entity, $type, $filters);
		$rows = $snapshot['rows'];
		$choices = $snapshot['choices'];
		$detail = $snapshot['detail'];
	} catch (Throwable $exception) {
		$available = false;
		http_response_code($exception->getMessage() === 'FORBIDDEN' ? 403 : 503);
	}
	$showAudit = in_array(mjl_scope_effective_role_code($user, $entity), array('VALIDATEUR_DEFINITIF', 'ADMIN_PLATEFORME'), true);
	$csrfToken = newToken();

	llxHeader('', $title);
	mjl_navigation_shell_start($user);
	print '<div class="mjl-workspace">';
	require dirname(__DIR__, 2).'/tpl/reporting/report.php';
	print '</div>';
	mjl_navigation_shell_end();
	llxFooter();
	$db->close();
}

function mjl_reporting_audit_http($db, $user, $entity, array $get, $method)
{
	if ($method !== 'GET') { header('Allow: GET'); mjl_http_error(405, 'Consultez le journal avec une requête GET.'); }
	$source = $get;
	unset($source['report']);
	try { $filters = mjl_report_validate_request('audit', 'csv', $source, true); }
	catch (InvalidArgumentException $exception) { mjl_http_error(400, 'Filtres invalides.'); }
	$available = true;
	$events = array();
	$captured = gmdate('Y-m-d H:i:s');
	try { $events = mjl_reporting_read_audit($db, $user, $entity, $filters); }
	catch (Throwable $exception) { $available = false; http_response_code(503); }
	$showBusiness = mjl_scope_effective_role_code($user, $entity) !== 'ADMIN_PLATEFORME';
	$csrfToken = newToken();

	llxHeader('', 'Journal d’audit');
	mjl_navigation_shell_start($user);
	print '<div class="mjl-workspace">';
	require dirname(__DIR__, 2).'/tpl/reporting/audit.php';
	print '</div>';
	mjl_navigation_shell_end();
	llxFooter();
	$db->close();
}

function mjl_reporting_export_http($db, $user, $entity, array $post, array $files, $method)
{
	try { $probe = $post; $requestedType = mjl_reporting_route_type($probe); }
	catch (InvalidArgumentException $exception) { mjl_http_error(400, 'Format ou filtres invalides.'); }
	mjl_reporting_require_actor($requestedType, $user, $entity);
	if ($method !== 'POST') { header('Allow: POST'); mjl_http_error(405, 'Utilisez le formulaire de téléchargement.'); }
	if (!isset($post['token']) || !is_string($post['token']) || (string) currentToken() === '' || !hash_equals((string) currentToken(), $post['token'])) mjl_http_error(403, 'Formulaire expiré. Revenez au rapport et réessayez.');
	if ($files || !isset($post['format']) || !is_string($post['format'])) mjl_http_error(400, 'Format ou filtres invalides.');
	$format = $post['format'];
	$source = $post;
	unset($source['token'], $source['format']);
	try { $type = mjl_reporting_route_type($source); mjl_report_validate_request($type, $format, $source); }
	catch (InvalidArgumentException $exception) { mjl_http_error(400, 'Format ou filtres invalides.'); }
	if (headers_sent()) mjl_http_error(503, 'Le téléchargement est indisponible.');
	if (session_status() === PHP_SESSION_ACTIVE && !session_write_close()) mjl_http_error(503, 'Le téléchargement est indisponible.');

	try {
		$owner = new MjlExport($db, $user, $entity, '/tmp/mjlfinancement-exports');
		$builder = array('activities' => 'mjl_report_build_activities', 'operations' => 'mjl_report_build_operations', 'activity_detail' => 'mjl_report_build_activity_detail', 'portfolio' => 'mjl_report_build_portfolio', 'audit' => 'mjl_report_build_audit')[$type];
		$artifact = $owner->generate($type, $format, $source, $builder);
	} catch (Throwable $exception) {
		$code = $exception->getMessage();
		if (in_array($code, array('FORBIDDEN', 'SCOPE_CHANGED'), true)) mjl_http_error(403, 'Vos accès ont changé. Actualisez le rapport avant de télécharger.');
		if ($code === 'EXPORT_BUSY') mjl_http_error(409, 'Un rapport est en cours de génération. Réessayez dans quelques instants.');
		if ($code === 'UNSUPPORTED_RECORD') mjl_http_error(422, 'Une donnée de la sélection ne peut pas être représentée dans ce rapport. Contactez un responsable pour la vérifier.');
		if (in_array($code, array('SOURCE_LIMIT', 'REPORT_LIMIT', 'ARTIFACT_LIMIT', 'EXPORT_MEMORY_LIMIT'), true)) mjl_http_error(422, 'La sélection dépasse les limites du format. Réduisez les filtres ou choisissez un autre format.');
		if ($code === 'EXPORT_COMMIT_UNCERTAIN') mjl_http_error(503, 'La génération n’a pas pu être confirmée. Aucun fichier n’est transmis. Contactez un responsable avant de relancer.');
		mjl_http_error(503, 'Le rapport est indisponible. Aucun fichier n’est transmis.');
	}

	try {
		$db->close();
		while (ob_get_level() > 0) { if (!ob_end_clean()) throw new RuntimeException('OUTPUT_BUFFER_FAILED'); }
		if (headers_sent()) throw new RuntimeException('OUTPUT_ALREADY_SENT');
		(new MjlExportDelivery())->deliver($artifact, $format);
	} catch (Throwable $exception) {
		if (is_resource($artifact['stream'])) fclose($artifact['stream']);
		if (!headers_sent()) {
			header_remove('Content-Disposition');
			header_remove('Content-Length');
			mjl_http_error(503, 'Le téléchargement est indisponible. Aucun fichier complet n’est transmis.');
		}
		exit;
	}
	exit;
}
