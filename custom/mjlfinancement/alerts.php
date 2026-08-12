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
$partnerId = GETPOSTINT('partner');
if ($partnerId > 0 && !mjl_legacy_partner_dependent_access($user, $partnerId)) accessforbidden();
$conditionResult = mjl_alert_conditions_result_for_user($user, 500, $scope, $partnerId);
$conditions = $conditionResult['items'];
$alertItems = array();
foreach (array_slice($conditions, 0, 100) as $condition) $alertItems[] = mjl_alert_present_condition($condition);
$alertResult = array('items' => $alertItems, 'errors' => $conditionResult['errors']);

llxHeader('', 'Alertes MJL');

mjl_navigation_shell_start($user);
print '<div class="mjl-workspace mjl-alert-workspace">';
print mjl_page_header_render(
	'Alertes MJL',
	array(
		'description' => 'Identifier les risques de délai, les décisions attendues et les pièces manquantes dans votre périmètre.',
		'context' => array('label' => 'Périmètre', 'value' => mjl_alerts_context_label($user)),
	)
);

print '<section class="mjl-workspace-section">';
print '<div class="mjl-section-heading"><h2>Alertes actives</h2><p>Ces alertes sont calculées à partir des activités, dépenses et pièces justificatives existantes.</p></div>';
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
		'activities' => 'Activités',
		'expenses' => 'Dépenses',
		'finance' => 'Finance',
	);
	print '<nav class="mjl-tabs" aria-label="Filtrer les alertes">';
	foreach ($options as $scope => $label) {
		$class = $scope === $activeScope ? ' class="mjl-tab-active"' : '';
		print '<a'.$class.' href="'.DOL_URL_ROOT.'/custom/mjlfinancement/alerts.php?scope='.$scope.'">'.dol_escape_htmltag($label).'</a>';
	}
	print '</nav>';
}
