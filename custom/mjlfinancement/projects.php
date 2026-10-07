<?php

require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/reference/mjl_reference_http.lib.php';

$request = array(
	'method' => strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
	'action' => (string) GETPOST('action', 'alphanohtml'),
	'query_has_id' => array_key_exists('id', $_GET),
	'post_has_id' => array_key_exists('id', $_POST),
);
mjl_reference_http_handle('project', $user, $request);
$db->close();
