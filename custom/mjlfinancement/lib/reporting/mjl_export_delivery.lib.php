<?php

/** Owns only response headers, artifact streaming, and stream closure. */
class MjlExportDelivery
{
	protected function readChunk($stream, $length)
	{
		return fread($stream, $length);
	}

	public function deliver(array $artifact, $format)
	{
		$types = array(
			'csv' => 'text/csv; charset=UTF-8',
			'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'pdf' => 'application/pdf',
		);
		if (!isset($types[$format]) || !isset($artifact['stream'], $artifact['filename'], $artifact['bytes']) || !is_resource($artifact['stream'])) throw new RuntimeException('INVALID_EXPORT_DELIVERY');

		$stream = $artifact['stream'];
		try {
			header('Content-Type: '.$types[$format]);
			header('Content-Disposition: attachment; filename="'.$artifact['filename'].'"');
			header('Content-Length: '.(int) $artifact['bytes']);
			header('Cache-Control: private, no-store');
			header('X-Content-Type-Options: nosniff');
			while (!feof($stream)) {
				$chunk = $this->readChunk($stream, 65536);
				if ($chunk === false) throw new RuntimeException('EXPORT_DELIVERY_READ_FAILED');
				print $chunk;
			}
		} finally {
			if (is_resource($stream)) fclose($stream);
		}
	}
}
