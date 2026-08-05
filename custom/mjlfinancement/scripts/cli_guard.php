<?php

if (PHP_SAPI !== 'cli') {
	http_response_code(403);
	header('Content-Type: text/plain; charset=UTF-8');
	print "Forbidden\n";
	exit;
}
