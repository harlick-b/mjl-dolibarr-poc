<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_alerts.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_dashboard.lib.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

if (!mjl_alerts_user_can_read($user)) {
	accessforbidden();
}

$langs->load('mjlfinancement@mjlfinancement');
$alerts = mjl_alerts_for_user($user);

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
if (empty($alerts)) {
	print '<div class="mjl-empty-state">Aucune alerte active dans votre perimetre.</div>';
} else {
	print '<div class="mjl-alert-grid">';
	foreach ($alerts as $alert) {
		mjl_alerts_render_card($alert);
	}
	print '</div>';
}
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

function mjl_alerts_render_card($alert)
{
	$tone = empty($alert['tone']) ? 'warning' : $alert['tone'];
	print '<article class="mjl-alert-card mjl-alert-'.$tone.'">';
	print '<div class="mjl-alert-card-main">';
	print '<span class="mjl-status-pill mjl-status-'.$tone.'">'.dol_escape_htmltag($alert['severity']).'</span>';
	print '<h3>'.dol_escape_htmltag($alert['object_type']).' '.dol_escape_htmltag($alert['ref']).'</h3>';
	print '<p>'.dol_escape_htmltag($alert['label']).'</p>';
	print '</div>';
	print '<dl class="mjl-alert-meta">';
	print '<div><dt>Acteur concerne</dt><dd>'.dol_escape_htmltag($alert['audience']).'</dd></div>';
	print '<div><dt>Action attendue</dt><dd>'.dol_escape_htmltag($alert['expected_action']).'</dd></div>';
	foreach ($alert['meta'] as $label => $value) {
		if ((string) $value === '') {
			continue;
		}
		print '<div><dt>'.dol_escape_htmltag($label).'</dt><dd>'.dol_escape_htmltag($value).'</dd></div>';
	}
	print '</dl>';
	print '<a class="mjl-card-link" href="'.mjl_dashboard_url($alert['href']).'">Ouvrir l objet concerne</a>';
	print '</article>';
}
