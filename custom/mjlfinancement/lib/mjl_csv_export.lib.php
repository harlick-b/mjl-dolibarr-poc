<?php

function mjl_csv_export_output($filename, $headers, $rows)
{
	header('Content-Type: text/csv; charset=UTF-8');
	header('Content-Disposition: attachment; filename="'.$filename.'"');
	header('Pragma: no-cache');
	header('Expires: 0');

	$out = fopen('php://output', 'w');
	fwrite($out, "\xEF\xBB\xBF");
	fputcsv($out, array_values($headers), ';');
	foreach ($rows as $row) {
		$line = array();
		foreach (array_keys($headers) as $key) {
			$line[] = isset($row[$key]) ? $row[$key] : '';
		}
		fputcsv($out, $line, ';');
	}
	fclose($out);
}

function mjl_csv_export_filename($slug)
{
	return 'mjl-'.$slug.'.csv';
}
