<?php

define('DOL_URL_ROOT', '');

require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_page_header.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_reference_ui.lib.php';
require_once __DIR__.'/../../custom/mjlfinancement/lib/reference/mjl_reference_list_presentation.lib.php';

function mjl_reference_list_presentation_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, $message."\n");
	exit(1);
}

$partnerHtml = mjl_reference_list_present(array(
	'kind' => 'partner',
	'config' => array('route' => 'partners', 'title' => 'Partenaires', 'singular' => 'Partenaire'),
	'rows' => array(array('rowid' => 7, 'label' => 'Partenaire <MJL>', 'active' => 1)),
	'can_manage' => true,
	'header_options' => array(
		'description' => 'Gérer les références métier de l’espace MJL.',
		'primary_action' => array('label' => 'Créer un Partenaire', 'href' => '/custom/mjlfinancement/partners.php?action=create'),
	),
));
mjl_reference_list_presentation_assert(strpos($partnerHtml, '<h1 id="mjl-page-title">Partenaires</h1>') !== false, 'Partner heading changed.');
mjl_reference_list_presentation_assert(strpos($partnerHtml, 'data-mjl-reference-list="partner"') !== false, 'Partner list hook changed.');
mjl_reference_list_presentation_assert(strpos($partnerHtml, 'class="oddeven mjl-row-interactive"') !== false, 'Interactive reference-row class changed.');
mjl_reference_list_presentation_assert(strpos($partnerHtml, 'Partenaire &lt;MJL&gt;') !== false, 'Partner label is not escaped.');
mjl_reference_list_presentation_assert(strpos($partnerHtml, 'Créer un Partenaire') !== false, 'Validator create action is missing.');
mjl_reference_list_presentation_assert(strpos($partnerHtml, 'Actions pour Partenaire &lt;MJL&gt;') !== false, 'Validator row actions are missing.');

$projectHtml = mjl_reference_list_present(array(
	'kind' => 'project',
	'config' => array('route' => 'projects', 'title' => 'Projets', 'singular' => 'Projet'),
	'rows' => array(array('rowid' => 11, 'label' => 'Projet suivi', 'parent_label' => 'Partenaire parent', 'active' => 0)),
	'can_manage' => false,
	'header_options' => array('description' => 'Gérer les références métier de l’espace MJL.'),
));
mjl_reference_list_presentation_assert(strpos($projectHtml, 'data-mjl-reference-list="project"') !== false, 'Project list hook changed.');
mjl_reference_list_presentation_assert(strpos($projectHtml, '<th>Partenaire</th>') !== false, 'Project parent column is missing.');
mjl_reference_list_presentation_assert(strpos($projectHtml, 'Partenaire parent') !== false, 'Project parent value is missing.');
mjl_reference_list_presentation_assert(strpos($projectHtml, 'Actions pour') === false, 'Read-only Project list exposes management actions.');

$emptyHtml = mjl_reference_list_present(array(
	'kind' => 'partner',
	'config' => array('route' => 'partners', 'title' => 'Partenaires', 'singular' => 'Partenaire'),
	'rows' => array(),
	'can_manage' => false,
	'header_options' => array('description' => 'Gérer les références métier de l’espace MJL.'),
));
mjl_reference_list_presentation_assert(strpos($emptyHtml, 'Aucune référence') !== false, 'Empty-state contract changed.');

print "MJL reference list presentation contract passed.\n";
