<?php

require_once __DIR__.'/mjl_table.lib.php';
require_once __DIR__.'/mjl_ui.lib.php';

/**
 * Presentation helpers for Partner and Project reference screens.
 *
 * Data selection, authorization, lifecycle eligibility, request handling, and
 * fingerprints remain owned by mjl_reference_route and mjl_reference.
 */

function mjl_reference_ui_list($kind, $config, $rows, $canManage)
{
	$route = DOL_URL_ROOT.'/custom/mjlfinancement/'.$config['route'].'.php';
	$html = '<section class="mjl-workspace-section mjl-reference-list" data-mjl-reference-list="'.mjl_ui_escape($kind).'">';
	if (empty($rows)) {
		return $html.mjl_ui_system_state('initial-empty', 'Aucune référence', 'Aucun élément n’est encore enregistré.').'</section>';
	}
	$html .= '<div class="div-table-responsive-no-min mjl-operational-table"><table class="noborder centpercent mjl-reference-table" aria-label="'.mjl_ui_escape($config['title']).'"><thead><tr class="liste_titre">';
	$html .= '<th>'.$config['singular'].'</th>';
	if ($kind === 'project') $html .= '<th>Partenaire</th>';
	$html .= '<th>Statut</th>';
	if ($canManage) $html .= '<th class="right">Actions</th>';
	$html .= '</tr></thead><tbody>';
	foreach ($rows as $row) {
		$id = (int) $row['rowid'];
		$label = (string) $row['label'];
		$detailUrl = $route.'?id='.$id;
		$html .= '<tr class="oddeven mjl-row-interactive" data-reference-row>';
		$html .= '<td data-label="'.$config['singular'].'"><a class="mjl-table-link" href="'.mjl_ui_escape($detailUrl).'">'.mjl_ui_escape($label).'</a></td>';
		if ($kind === 'project') $html .= '<td data-label="Partenaire">'.mjl_ui_escape($row['parent_label']).'</td>';
		$html .= '<td data-label="Statut">'.mjl_ui_status_badge(array(
			'label' => (int) $row['active'] === 1 ? 'Actif' : 'Inactif',
			'tone' => (int) $row['active'] === 1 ? 'success' : 'neutral',
		)).'</td>';
		if ($canManage) {
			$actions = array(
				array('label' => 'Consulter', 'href' => $detailUrl),
				array('label' => 'Modifier', 'href' => $detailUrl.'&action=edit'),
			);
			$html .= '<td class="right" data-label="Actions">'.mjl_table_render_action_menu($label, $actions).'</td>';
		}
		$html .= '</tr>';
	}
	return $html.'</tbody></table></div></section>';
}

function mjl_reference_ui_page_dialog($kind, $title, $description, $body, $cancelHref)
{
	$id = 'mjl-reference-'.$kind.'-dialog';
	return '<dialog class="mjl-modal-dialog mjl-reference-dialog" id="'.$id.'" open aria-labelledby="'.$id.'-title" data-mjl-reference-page-dialog data-mjl-reference-cancel-href="'.mjl_ui_escape($cancelHref).'"><div class="mjl-dialog-panel"><header class="mjl-section-heading"><div><p class="mjl-eyebrow">Référence métier</p><h2 id="'.$id.'-title">'.mjl_ui_escape($title).'</h2><p>'.mjl_ui_escape($description).'</p></div><a class="mjl-action mjl-action-secondary" href="'.mjl_ui_escape($cancelHref).'" data-mjl-reference-dialog-close>Fermer</a></header>'.$body.'</div></dialog>';
}

function mjl_reference_ui_lifecycle($kind, $config, $row, $form)
{
	$active = mjl_reference_is_active($kind, $row);
	$actionLabel = $active ? 'Désactiver' : 'Activer';
	$confirmLabel = $active ? 'Confirmer la désactivation' : 'Confirmer l’activation';
	$title = $actionLabel.' le '.$config['singular'];
	$guidance = $active && $kind === 'partner'
		? 'Les Projets actifs liés seront également désactivés. Cette action ne supprime aucun historique.'
		: ($active
			? 'Cette référence ne sera plus proposée pour les nouveaux travaux. Son historique reste disponible.'
			: 'Cette référence redevient disponible pour les nouveaux travaux autorisés.');
	$sourceId = 'mjl-reference-lifecycle-source-'.((int) $row['rowid']);
	$dialogId = 'mjl-reference-lifecycle-dialog';
	$html = '<div class="mjl-reference-lifecycle-source" id="'.$sourceId.'" data-mjl-reference-lifecycle-source>';
	$html .= '<button class="mjl-action '.($active ? 'mjl-action-danger' : 'mjl-action-secondary').' mjl-reference-lifecycle-trigger" type="button" data-mjl-reference-lifecycle-open data-reference-source="'.$sourceId.'" data-reference-title="'.mjl_ui_escape($title).'" data-reference-context="'.mjl_ui_escape($row[$config['field']]).'" data-reference-guidance="'.mjl_ui_escape($guidance).'" data-reference-confirm-label="'.mjl_ui_escape($confirmLabel).'">'.$actionLabel.'</button>';
	$html .= $form.'</div>';
	$html .= '<dialog class="mjl-modal-dialog mjl-reference-dialog" id="'.$dialogId.'" aria-labelledby="'.$dialogId.'-title" data-mjl-reference-lifecycle-dialog><div class="mjl-dialog-panel"><header class="mjl-section-heading"><div><p class="mjl-eyebrow">Changement de statut</p><h2 id="'.$dialogId.'-title" data-reference-dialog-title>Modifier le statut</h2><p data-reference-dialog-context></p></div><button class="mjl-action mjl-action-secondary" type="button" data-mjl-reference-lifecycle-close>Fermer</button></header><div class="mjl-system-state mjl-system-state-warning mjl-reference-lifecycle-guidance" role="status" data-reference-dialog-guidance></div><div data-reference-dialog-form></div></div></dialog>';
	return $html;
}
