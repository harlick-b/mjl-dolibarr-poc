<?php

function mjl_csv_export_neutralize_text($value)
{
	$value = (string) $value;
	$effective = ltrim($value, ' ');
	if ($effective !== '' && preg_match('/^[=+\-@\t\r\n]/', $effective)) {
		return "'".$value;
	}
	return $value;
}

function mjl_csv_export_generate_file($file, $headers, $rows, $moneyFields = array())
{
	$out = @fopen($file, 'wb');
	if ($out === false) {
		return false;
	}
	$moneyFields = array_fill_keys(array_map('strval', $moneyFields), true);
	fwrite($out, "\xEF\xBB\xBF");
	$headerLine = array();
	foreach (array_values($headers) as $label) {
		$headerLine[] = mjl_csv_export_neutralize_text($label);
	}
	if (fputcsv($out, $headerLine, ';') === false) {
		fclose($out);
		return false;
	}
	foreach ($rows as $row) {
		$line = array();
		foreach (array_keys($headers) as $key) {
			$value = isset($row[$key]) ? $row[$key] : '';
			if ((!isset($moneyFields[(string) $key]) || !is_numeric($value)) && !is_int($value) && !is_float($value)) {
				$value = mjl_csv_export_neutralize_text($value);
			}
			$line[] = $value;
		}
		if (fputcsv($out, $line, ';') === false) {
			fclose($out);
			return false;
		}
	}
	return fclose($out);
}

function mjl_csv_export_output($filename, $headers, $rows, $moneyFields = array())
{
	$tmp = tempnam(sys_get_temp_dir(), 'mjl_csv_');
	if ($tmp === false || !mjl_csv_export_generate_file($tmp, $headers, $rows, $moneyFields)) {
		if ($tmp !== false) @unlink($tmp);
		return false;
	}
	header('Content-Type: text/csv; charset=UTF-8');
	header('Content-Disposition: attachment; filename="'.$filename.'"');
	header('Pragma: no-cache');
	header('Expires: 0');
	readfile($tmp);
	@unlink($tmp);
	return true;
}

function mjl_csv_export_filename($slug)
{
	return 'mjl-'.$slug.'.csv';
}
