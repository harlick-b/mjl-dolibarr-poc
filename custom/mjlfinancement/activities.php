<?php

define('NOREDIRECTBYMAINTOLOGIN', 1);
require '../../main.inc.php';
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/activity/mjl_activity_http.lib.php';
mjl_activity_http_handle($db, $user, (int) $conf->entity, array(
	'method' => strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
	'content_length' => $_SERVER['CONTENT_LENGTH'] ?? null,
	'get' => $_GET,
	'post' => $_POST,
));
$db->close();
