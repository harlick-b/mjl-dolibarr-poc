<?php

require_once dirname(__DIR__).'/mjl_ui.lib.php';
require_once dirname(__DIR__).'/mjl_report_ui.lib.php';
require_once dirname(__DIR__).'/mjl_report_data.lib.php';
require_once dirname(__DIR__).'/mjl_audit.lib.php';

function mjl_report_operation_preview_row(array $row)
{
	$html='<article class="mjl-activity-panel"><h3>'.dol_escape_htmltag($row['name']).'</h3><p><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$row['activity_id'].'">'.dol_escape_htmltag($row['activity_ref'].' · '.$row['activity_name']).'</a></p><p>'.dol_escape_htmltag($row['partner_name'].' · '.$row['project_name'].' · '.$row['type_label']).'</p><p>'.dol_escape_htmltag($row['status_label'].' · Autorisation : '.$row['authorization_kind']).'</p><dl class="mjl-activity-meta">';
	foreach (array('authorized_amount'=>'Montant autorisé','spent_amount'=>'Montant dépensé','difference'=>'Écart') as $key=>$label) $html.='<div><dt>'.$label.'</dt><dd>'.dol_escape_htmltag(mjl_format_money($row[$key])).'</dd></div>';
	$html.='<div><dt>Variation</dt><dd>'.dol_escape_htmltag($row['variance']['display']??'Non renseigné').'</dd></div></dl><p><strong>Observation</strong><br>'.nl2br(htmlspecialchars($row['observation']??'Non renseignée',ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8')).'</p></article>';
	return $html;
}


function mjl_report_download_form($type,array $filters,$captured,$csrfToken)
{
	print '<p>Aperçu capturé le '.dol_escape_htmltag($captured).' UTC ; un téléchargement utilise une nouvelle capture.</p><p>'.dol_escape_htmltag(mjl_report_format_notice()).'</p><form class="mjl-report-export-actions" method="POST" action="'.DOL_URL_ROOT.'/custom/mjlfinancement/reportexport.php"><input type="hidden" name="report" value="'.$type.'"><input type="hidden" name="token" value="'.dol_escape_htmltag($csrfToken).'">';
	foreach ($filters as $key=>$value) if ($key!=='page') print '<input type="hidden" name="'.$key.'" value="'.dol_escape_htmltag($value).'">';
	foreach (array('pdf'=>'PDF','xlsx'=>'XLSX','csv'=>'CSV') as $format=>$label) print '<button class="mjl-action mjl-action-secondary" name="format" value="'.$format.'" type="submit">Télécharger '.$label.'</button> ';
	print '</form>';
}

function mjl_report_detail_preview(array $document,array $filters,$captured,$csrfToken)
{
	print '<p><a href="'.DOL_URL_ROOT.'/custom/mjlfinancement/activities.php?id='.(int)$filters['activity_id'].'">Retour à l’Activité</a></p>';
	foreach ($document['metadata'] as $text) print '<p>'.dol_escape_htmltag($text).'</p>';
	print '<section class="mjl-workspace-section mjl-report-export-panel"><h2>Téléchargement</h2><p>Une Activité avec toutes ses Opérations courantes.</p>';
	mjl_report_download_form('activity_detail',$filters,$captured,$csrfToken); print '</section>';
	foreach ($document['sections'] as $section) {
		print '<section class="mjl-workspace-section"><h2>'.dol_escape_htmltag($section['title']).'</h2>';
		if (!$section['rows']) print '<p>Aucune Opération courante.</p>';
		foreach ($section['rows'] as $row) {
			print '<article class="mjl-activity-panel"><dl class="mjl-activity-meta">';
			foreach ($row as $i=>$cell) {
				$value=$cell['value'];
				if (isset($cell['currency'])) $text=mjl_format_money($value);
				elseif ($cell['type']==='ratio') $text=$value['display']??'Non renseigné';
				else $text=$value===null || $value===''?'Non renseigné':(string)$value;
				print '<div><dt>'.dol_escape_htmltag($section['headers'][$i]).'</dt><dd>'.nl2br(htmlspecialchars($text,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8')).'</dd></div>';
			}
			print '</dl></article>';
		}
		print '</section>';
	}
}


function mjl_report_portfolio_preview_row(array $row,$grouping)
{
	$html='<article class="mjl-activity-panel"><h3>'.htmlspecialchars($row['group_name'],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8').'</h3><dl class="mjl-activity-meta">';
	foreach (mjl_report_portfolio_columns($grouping) as $key=>$column) {
		if ($key==='group_name') continue;
		$value=isset($column[2])?mjl_format_money($row[$key]):(string)$row[$key];
		$html.='<div><dt>'.dol_escape_htmltag($column[0]).'</dt><dd>'.dol_escape_htmltag($value).'</dd></div>';
	}
	return $html.'</dl></article>';
}

function mjl_audit_report_event(array $event,&$remaining)
{
	$meta=mjl_audit_report_metadata($event);
	$tone=array('SUCCESS'=>'success','DENIED'=>'danger','FAILED'=>'warning')[$event['result']??'']??'neutral';
	print '<li data-audit-event-id="'.(int)$event['rowid'].'"><article class="mjl-activity-panel mjl-audit-event"><header class="mjl-audit-event-header"><div><p class="mjl-eyebrow">Événement '.(int)$event['rowid'].'</p><h3>'.mjl_ui_escape($meta['action_label']).'</h3><p class="mjl-audit-event-actor">'.mjl_ui_escape(($meta['actor_name']?:'Système').' · '.($meta['actor_role']?:'Rôle non renseigné')).'</p></div><div class="mjl-audit-event-state"><time class="mjl-audit-event-date">'.mjl_ui_escape($meta['event_date']).'</time>'.mjl_ui_status_badge(array('label'=>$meta['result'],'tone'=>$tone)).'</div></header><dl class="mjl-audit-event-meta">';
	foreach (mjl_audit_report_metadata_columns() as $key=>$column) print '<div><dt>'.$column[0].'</dt><dd>'.mjl_ui_escape((string)($meta[$key]??'Non renseigné')).'</dd></div>';
	print '</dl>';
	try {
		$changes=mjl_audit_project_event($event,$remaining); $remaining-=count($changes);
		print '<details class="mjl-audit-event-details"><summary>Champs et valeurs enregistrés</summary><p>« Non enregistré » signifie que le journal ne contient pas cette valeur ; cela ne prouve pas un effacement.</p>';
		foreach ($changes as $change) {
			print '<dl class="mjl-audit-change-grid">';
			foreach (mjl_audit_report_change_columns() as $key=>$column) print '<div><dt>'.$column[0].'</dt><dd>'.nl2br(mjl_ui_escape((string)$change[$key])).'</dd></div>';
			print '</dl>';
		}
		print '</details>'; unset($changes);
	} catch (Throwable $e) { print '<p role="status">Détails indisponibles : cet événement ne peut pas être représenté dans cet aperçu. Affinez la sélection ; un export contenant des données non représentables sera refusé.</p>'; }
	print '</article></li>';
}
