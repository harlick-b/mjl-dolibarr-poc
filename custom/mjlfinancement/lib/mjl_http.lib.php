<?php

function mjl_http_error($status, $message)
{
	while (ob_get_level() > 0) { if (!ob_end_clean()) break; }
	http_response_code($status);
	header('Content-Type: text/plain; charset=UTF-8');
	header('Cache-Control: private, no-store');
	header('X-Content-Type-Options: nosniff');
	print $message;
	exit;
}
