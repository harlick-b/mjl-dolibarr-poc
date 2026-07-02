<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_navigation.lib.php';

mjl_workspace_require_roadmap_access($user);

$langs->load('mjlfinancement@mjlfinancement');

llxHeader('', 'Preparation production');
mjl_navigation_shell_start($user, 'roadmap');
print '<div class="mjl-workspace mjl-roadmap-workspace">';
mjl_dashboard_render_header(
	'Pr&eacute;paration production',
	'Clarifier les limites actuelles du POC et les sujets a arbitrer avant une version de production.',
	'Acces',
	'Administration'
);

print '<section class="mjl-workspace-section">';
print '<div class="mjl-empty-state">';
print 'Ces elements ne sont pas encore implementes. Ils sont listes uniquement pour pilotage interne, arbitrage et preparation de la future version de production. Ils ne constituent pas des fonctionnalites disponibles dans le POC.';
print '</div>';
print '</section>';

mjl_roadmap_render_section(
	'Niveau 1 - Critique avant production',
	array(
		'Reporting complet de production',
		'Canevas officiels PDF/Word',
		'Pages detaillees pour activites, depenses, conventions et lignes budgetaires',
		'Parcours de creation et modification plus complets pour conventions, lignes budgetaires et receptions de fonds',
		'Colonnes finales des rapports client',
		'Documentation de deploiement production',
		'Procedure de sauvegarde et restauration',
		'Journalisation, diagnostics et nettoyage documentaire',
	)
);

mjl_roadmap_render_section(
	'Niveau 2 - Important apres validation du POC',
	array(
		'Strategie de couverture ou integration comptable OHADA/SYSCOHADA',
		'Rapprochement bancaire',
		'Pont d integration ou export vers le logiciel comptable existant',
		'Workflow achat/marche si requis par le MJL',
		'Matrice de permissions detaillee',
		'Preview et telechargement documentaire avances',
		'Filtres, recherche et selecteurs ameliores',
	)
);

mjl_roadmap_render_section(
	'Niveau 3 - Utile plus tard / optionnel',
	array(
		'Notifications SMS',
		'Connexion API bancaire',
		'OCR / lecture automatique de facture',
		'Portail externe partenaire',
		'Mode hors ligne',
		'Constructeur dynamique de rapports',
		'Analytique avancee',
		'Interface mobile-first compagnon',
		'Resumes de rapports assistes par IA',
	)
);

print '</div>';
mjl_navigation_shell_end();

llxFooter();
$db->close();

function mjl_roadmap_render_section($title, $items)
{
	print '<section class="mjl-workspace-section mjl-activity-card">';
	print '<div class="mjl-section-heading"><h2>'.dol_escape_htmltag($title).'</h2><p>Liste de pilotage interne uniquement, sans bouton d action.</p></div>';
	print '<ul class="mjl-roadmap-list">';
	foreach ($items as $item) {
		print '<li>'.dol_escape_htmltag($item).'</li>';
	}
	print '</ul>';
	print '</section>';
}
