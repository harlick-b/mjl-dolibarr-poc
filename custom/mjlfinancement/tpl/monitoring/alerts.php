<?php

print '<div class="mjl-workspace">'.mjl_page_header_render($title, $options);
if ($activities === null) {
	print mjl_ui_system_state('unavailable', 'Suivi indisponible', 'Les données ne peuvent pas être chargées. Aucun total ni action n’est disponible.');
} else {
	if ($choices === null) print mjl_ui_system_state('unavailable', 'Filtres indisponibles', 'Les références ne peuvent pas être chargées.');
	else mjl_monitoring_filter_form($filters, $choices, 'alerts');
	print '<p>Calcul au '.dol_escape_htmltag(mjl_format_date($date)).' (Africa/Porto-Novo). Actualisé le '.dol_escape_htmltag(gmdate('d/m/Y H:i')).' UTC. Périmètre : '.($role === 'AGENT_SAISIE' ? 'Activités actuellement affectées' : 'portefeuille de l’entité active').'. Période : '.($filters['date_from'] === '' && $filters['date_to'] === '' ? 'toutes les dates' : dol_escape_htmltag(($filters['date_from'] ?: 'sans début').' au '.($filters['date_to'] ?: 'sans fin'))).'. La sélection retient les Activités dont les dates chevauchent la période.</p>';
	mjl_monitoring_render_items(array_slice($alerts, ((int) $filters['page'] - 1) * 50, 50), true);
	mjl_monitoring_pagination('alerts', $filters, count($alerts), 'Pagination des alertes');
}
print '</div>';
