<?php

require_once __DIR__.'/../../custom/mjlfinancement/lib/reporting/mjl_export_delivery.lib.php';

function w5_export_delivery_assert($condition, $message)
{
	if ($condition) return;
	fwrite(STDERR, "FAIL: ".$message."\n");
	exit(1);
}

class W5FailingExportDelivery extends MjlExportDelivery
{
	protected function readChunk($stream, $length)
	{
		return false;
	}
}

$stream = fopen('php://temp', 'w+b');
fwrite($stream, 'private artifact');
rewind($stream);
$artifact = array('stream' => $stream, 'filename' => 'rapport.csv', 'bytes' => 16);
$error = '';
ob_start();
try {
	(new W5FailingExportDelivery())->deliver($artifact, 'csv');
} catch (Throwable $exception) {
	$error = $exception->getMessage();
}
$body = ob_get_clean();

w5_export_delivery_assert($error === 'EXPORT_DELIVERY_READ_FAILED', 'A server-side read failure must be explicit.');
w5_export_delivery_assert($body === '', 'A first-read failure must expose no artifact bytes.');
w5_export_delivery_assert(!is_resource($stream), 'The delivery owner must close its stream after failure.');

$stream = fopen('php://temp', 'w+b');
fwrite($stream, 'ok');
rewind($stream);
ob_start();
(new MjlExportDelivery())->deliver(array('stream' => $stream, 'filename' => 'rapport.csv', 'bytes' => 2), 'csv');
$body = ob_get_clean();
w5_export_delivery_assert($body === 'ok', 'Successful delivery must preserve the complete artifact body.');
w5_export_delivery_assert(!is_resource($stream), 'Successful delivery must close its stream.');

print "W5 export delivery contract passed.\n";
