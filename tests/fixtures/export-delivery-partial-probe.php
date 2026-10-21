<?php

require_once dirname(__DIR__, 2).'/custom/mjlfinancement/lib/reporting/mjl_export_delivery.lib.php';

class PartialReadFailureDelivery extends MjlExportDelivery
{
	private $reads = 0;

	protected function readChunk($stream, $length)
	{
		$this->reads++;
		return $this->reads === 1 ? 'abc' : false;
	}
}

$stream = fopen('php://temp', 'w+b');
fwrite($stream, 'abcdef');
rewind($stream);
$completed = mjl_export_deliver_checked(
	array('stream' => $stream, 'filename' => 'rapport.csv', 'bytes' => 6),
	'csv',
	new PartialReadFailureDelivery()
);
if ($completed !== false || is_resource($stream)) exit(2);
