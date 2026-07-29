<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_alerts.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

if (!mjl_alerts_user_can_read($user)) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');
$scope = mjl_alerts_normalize_scope(GETPOST('scope', 'alphanohtml'));
$alertResult = mjl_alerts_result_for_user($user, 100, $scope);

llxHeader('', 'Alertes MJL');

mjl_navigation_shell_start($user, 'alerts');
print '<div class="mjl-workspace mjl-alert-workspace">';
mjl_dashboard_render_header(
	'Alertes MJL',
	'Identifier les risques de delai, les decisions attendues et les pieces manquantes dans votre perimetre.',
	'Perimetre',
	mjl_alerts_context_label($user)
);

print '<section class="mjl-workspace-section">';
print '<div class="mjl-section-heading"><h2>Alertes actives</h2><p>Ces alertes sont calculees depuis les activites, depenses et pieces justificatives existantes.</p></div>';
mjl_alerts_render_scope_filter($scope);
mjl_alerts_render_result($alertResult);
print '</section>';
print '</div>';
mjl_navigation_shell_end();

llxFooter();
$db->close();

function mjl_alerts_context_label(User $targetUser)
{
	if (mjl_workspace_can_access_supervision($targetUser)) {
		return 'Portefeuille MJL';
	}
	if (mjl_alerts_is_level1_operational($targetUser)) {
		return 'Mes actions';
	}
	if ($targetUser->hasRight('mjlfinancement', 'activity', 'validate') || $targetUser->hasRight('mjlfinancement', 'expense', 'validate')) {
		return 'File de validation';
	}
	return 'Consultation';
}

function mjl_alerts_render_scope_filter($activeScope)
{
	$options = array(
		'all' => 'Toutes',
		'activities' => 'Activites',
		'expenses' => 'Depenses',
		'finance' => 'Finance',
	);
	print '<nav class="mjl-tabs" aria-label="Filtrer les alertes">';
	foreach ($options as $scope => $label) {
		$class = $scope === $activeScope ? ' class="mjl-tab-active"' : '';
		print '<a'.$class.' href="'.DOL_URL_ROOT.'/custom/mjlfinancement/alerts.php?scope='.$scope.'">'.dol_escape_htmltag($label).'</a>';
	}
	print '</nav>';
}
