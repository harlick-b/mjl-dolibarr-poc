<?php

require_once __DIR__.'/../../custom/mjlfinancement/lib/mjl_page_header.lib.php';

function mjl_page_header_test_assert($condition, $message)
{
	if (!$condition) {
		fwrite(STDERR, "FAIL: ".$message."\n");
		exit(1);
	}
}

$html = mjl_page_header_render(
	'Activité <A-2026-014>',
	array(
		'breadcrumb' => array(
			array('label' => 'Activités', 'href' => '/custom/mjlfinancement/activities.php'),
			array('label' => 'A-2026-014'),
		),
		'description' => 'Décision attendue & suivi opérationnel.',
		'primary_action' => array('label' => 'Modifier', 'href' => '/custom/mjlfinancement/activities.php?action=edit&id=14'),
		'secondary_actions' => array(
			array('label' => 'Voir le projet', 'href' => '/custom/mjlfinancement/projects.php?id=7'),
			array('label' => 'Voir les dépenses', 'href' => '/custom/mjlfinancement/expenses.php?activity_id=14'),
		),
		'context' => array('label' => 'Statut', 'value' => 'À prévalider'),
	)
);

mjl_page_header_test_assert(substr_count($html, '<h1') === 1, 'the header renders exactly one h1');
mjl_page_header_test_assert(strpos($html, 'Activité &lt;A-2026-014&gt;') !== false, 'the title is escaped');
mjl_page_header_test_assert(strpos($html, 'Décision attendue &amp; suivi opérationnel.') !== false, 'the useful description is escaped');
mjl_page_header_test_assert(strpos($html, 'aria-label="Fil d’Ariane"') !== false, 'the breadcrumb has a French accessible name');
mjl_page_header_test_assert(strpos($html, 'aria-current="page"') !== false, 'the final breadcrumb identifies the current page');
mjl_page_header_test_assert(strpos($html, 'mjl-page-header-action-primary') !== false, 'the primary action remains explicit');
mjl_page_header_test_assert(
	strpos($html, 'Voir le projet') < strpos($html, 'Voir les dépenses'),
	'authorized secondary actions preserve caller order'
);
mjl_page_header_test_assert(strpos($html, '<dt>Statut</dt><dd>À prévalider</dd>') !== false, 'status or scope context uses semantic terms');
mjl_page_header_test_assert(strpos($html, 'MJL Financement') === false, 'the header does not repeat the global workspace title');

$minimal = mjl_page_header_render('Documents');
mjl_page_header_test_assert(substr_count($minimal, '<h1') === 1, 'the title is the only required content');
mjl_page_header_test_assert(strpos($minimal, 'mjl-page-header-description') === false, 'empty decorative description is omitted');
mjl_page_header_test_assert(strpos($minimal, 'mjl-page-header-actions') === false, 'empty action containers are omitted');

print "Phase 3D page header: OK\n";
