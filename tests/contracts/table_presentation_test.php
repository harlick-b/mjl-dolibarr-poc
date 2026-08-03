<?php

require __DIR__.'/../../custom/mjlfinancement/lib/mjl_table.lib.php';

function mjl_table_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, $message."\n");
	exit(1);
}

mjl_table_assert(function_exists('mjl_table_render_filter_bar'), 'Shared filter-bar renderer is missing.');

$fields = array(
	array(
		'name' => 'partner',
		'label' => 'Partenaire / Programme',
		'value' => '12',
		'default' => '',
		'options' => array('' => 'Tous les partenaires', '12' => 'UNICEF', '13' => 'Programme <Redevabilité>'),
	),
	array(
		'name' => 'status',
		'label' => 'Statut',
		'value' => '',
		'default' => '',
		'options' => array('' => 'Tous les statuts', '1' => 'Ouvert'),
	),
	array(
		'name' => 'sort',
		'label' => 'Trier par',
		'value' => 'recent',
		'default' => 'ref',
		'options' => array('ref' => 'Référence', 'recent' => 'Plus récents'),
	),
);

$html = mjl_table_render_filter_bar('/projects.php', 'projects', 'projets', $fields);
mjl_table_assert(strpos($html, 'data-mjl-table-filters="projects"') !== false, 'Resource filter-bar marker is missing.');
mjl_table_assert(strpos($html, 'aria-label="Filtres des projets"') !== false, 'French resource label is missing.');
mjl_table_assert(strpos($html, 'id="mjl-filter-projects-partner"') !== false, 'Stable field ID is missing.');
mjl_table_assert(strpos($html, 'value="12" selected') !== false, 'Selected option is not retained.');
mjl_table_assert(strpos($html, 'Programme &lt;Redevabilité&gt;') !== false, 'Option labels are not safely escaped.');
mjl_table_assert(strpos($html, 'Filtres actifs :') !== false, 'Applied-filter summary is missing.');
mjl_table_assert(strpos($html, 'Partenaire / Programme : UNICEF') !== false, 'Selected partner is missing from the summary.');
mjl_table_assert(strpos($html, 'Trier par : Plus récents') !== false, 'Non-default sort is missing from the summary.');
mjl_table_assert(strpos($html, 'Statut :') === false, 'Default filters must not appear as active.');

$defaultHtml = mjl_table_render_filter_bar('/projects.php', 'projects', 'projets', array(
	array('name' => 'status', 'label' => 'Statut', 'value' => '', 'default' => '', 'options' => array('' => 'Tous les statuts')),
));
mjl_table_assert(strpos($defaultHtml, 'Aucun filtre actif.') !== false, 'Default filter summary is missing.');

$pagination = mjl_table_render_pagination('/projects.php', array('page' => 2, 'page_size' => 50), 151, true, true, 'projets');
mjl_table_assert(strpos($pagination, '<span aria-current="page">Page 2 sur 4') !== false, 'Pagination current page is not programmatic.');

$retained = mjl_table_retained_query(array('partner' => 0, 'project' => 0, 'status' => '0', 'sort' => 'recent', 'page' => 2));
mjl_table_assert(strpos($retained, 'partner=0') === false && strpos($retained, 'project=0') === false, 'Integer ID defaults must not enter retained queries.');
mjl_table_assert(strpos($retained, 'status=0') !== false, 'Valid string enum zero must remain in retained queries.');

print "MJL table presentation contract passed.\n";
