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

/**
 * Cross the binary response seam without allowing a JSON error body to corrupt
 * an attachment after delivery has started.
 *
 * @return bool False only when output started and the caller must terminate.
 */
function mjl_export_deliver_checked(array $artifact, $format, $delivery = null)
{
	while (ob_get_level() > 0) {
		if (!ob_end_clean()) throw new RuntimeException('OUTPUT_BUFFER_FAILED');
	}
	if (ob_get_level() !== 0 || headers_sent()) throw new RuntimeException('OUTPUT_ALREADY_SENT');
	if (function_exists('ini_set')) @ini_set('zlib.output_compression', '0');
	try {
		($delivery ?: new MjlExportDelivery())->deliver($artifact, $format);
		return true;
	} catch (Throwable $exception) {
		if (isset($artifact['stream']) && is_resource($artifact['stream'])) fclose($artifact['stream']);
		if (headers_sent()) return false;
		header_remove('Content-Disposition');
		header_remove('Content-Length');
		header_remove('Content-Type');
		throw $exception;
	}
}
