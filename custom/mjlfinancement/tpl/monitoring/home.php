<?php

print '<div class="mjl-workspace">'.mjl_page_header_render($title, $options);
if ($admin) {
	print mjl_dashboard_admin_cards();
} elseif ($activities === null) {
	print $legacyUnavailable
		? mjl_ui_system_state('unavailable', 'Suivi indisponible', 'Les données du tableau de bord ne sont pas disponibles avec cette version du module.')
		: mjl_ui_system_state('unavailable', 'Suivi indisponible', 'Les données ne peuvent pas être chargées. Aucun total ni action n’est disponible.');
} else {
	if ($choices === null) print mjl_ui_system_state('unavailable', 'Filtres indisponibles', 'Les références ne peuvent pas être chargées.');
	else mjl_monitoring_filter_form($filters, $choices, 'home');
	print '<p>Calcul au '.dol_escape_htmltag(mjl_format_date($date)).' (Africa/Porto-Novo). Actualisé le '.dol_escape_htmltag(gmdate('d/m/Y H:i')).' UTC. Périmètre : '.($role === 'AGENT_SAISIE' ? 'Activités actuellement affectées' : 'portefeuille de l’entité active').'. Période : '.($filters['date_from'] === '' && $filters['date_to'] === '' ? 'toutes les dates' : dol_escape_htmltag(($filters['date_from'] ?: 'sans début').' au '.($filters['date_to'] ?: 'sans fin'))).'. La sélection retient les Activités dont les dates chevauchent la période.</p>';
	mjl_dashboard_render_kpis($activities, $queue, $role, $filters);
	print '<div class="mjl-dashboard-main-grid"><section id="mjl-dashboard-work" class="mjl-dashboard-panel" aria-labelledby="mjl-work-title"><div class="mjl-section-heading"><div><h2 id="mjl-work-title">'.dol_escape_htmltag($profile['work_label']).'</h2><p>Actions permises pour votre profil. Les demandes devenues obsolètes restent à clôturer.</p></div></div>';
	if ($queue === null) print mjl_ui_system_state('unavailable', 'Actions indisponibles', 'Les autorisations de traitement ne peuvent pas être chargées.');
	else { mjl_monitoring_render_items(array_slice($queue, ((int) $filters['page'] - 1) * 50, 50)); mjl_monitoring_pagination('home', $filters, count($queue), 'Pagination des actions'); }
	print '</section>';
	mjl_dashboard_render_execution($activities, $filters);
	print '</div>';
	mjl_monitoring_financial_cards($activities, $filters);
	mjl_monitoring_stage_counts($activities, $filters);
	print '<section class="mjl-workspace-section mjl-dashboard-alerts" aria-labelledby="mjl-dashboard-alerts-title"><div class="mjl-section-heading"><div><h2 id="mjl-dashboard-alerts-title">Alertes de suivi</h2><p>Échéances et informations financières calculées dans votre périmètre.</p></div></div>';
	mjl_monitoring_render_items(array_slice($alerts, 0, 5), true);
	print '<a class="mjl-action mjl-action-secondary" href="'.dol_escape_htmltag(mjl_monitoring_url('alerts', $filters, array('page' => 1))).'">Voir toutes les alertes ('.count($alerts).')</a></section>';
}
print '</div>';
