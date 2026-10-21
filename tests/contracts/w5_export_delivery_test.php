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
fwrite($stream, 'private artifact');
rewind($stream);
$error = '';
try {
	mjl_export_deliver_checked(array('stream' => $stream, 'filename' => 'rapport.csv', 'bytes' => 16), 'csv', new W5FailingExportDelivery());
} catch (Throwable $exception) {
	$error = $exception->getMessage();
}
w5_export_delivery_assert($error === 'EXPORT_DELIVERY_READ_FAILED', 'A checked first-read failure must remain an error response candidate.');
w5_export_delivery_assert(!is_resource($stream), 'Checked delivery must close a stream that fails before output.');

$probe = proc_open(array(PHP_BINARY, __DIR__.'/../fixtures/export-delivery-partial-probe.php'), array(1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes);
w5_export_delivery_assert(is_resource($probe), 'The partial-delivery probe must start.');
$partialBody = stream_get_contents($pipes[1]);
$partialError = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$partialStatus = proc_close($probe);
w5_export_delivery_assert($partialStatus === 0, 'A post-output read failure must terminate without a second response. '.$partialError);
w5_export_delivery_assert($partialBody === 'abc', 'A post-output read failure must emit only the artifact bytes already sent, never JSON.');

$stream = fopen('php://temp', 'w+b');
fwrite($stream, 'ok');
rewind($stream);
ob_start();
(new MjlExportDelivery())->deliver(array('stream' => $stream, 'filename' => 'rapport.csv', 'bytes' => 2), 'csv');
$body = ob_get_clean();
w5_export_delivery_assert($body === 'ok', 'Successful delivery must preserve the complete artifact body.');
w5_export_delivery_assert(!is_resource($stream), 'Successful delivery must close its stream.');

print "W5 export delivery contract passed.\n";
