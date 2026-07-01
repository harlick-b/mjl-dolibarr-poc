<?php

function mjl_xlsx_export_output($filename, $headers, $rows)
{
	global $db, $langs;

	require_once DOL_DOCUMENT_ROOT.'/core/modules/export/export_excel2007.modules.php';

	$tmp = tempnam(sys_get_temp_dir(), 'mjl_xlsx_');
	if ($tmp === false) {
		accessforbidden('Impossible de préparer le fichier XLSX');
	}
	$file = $tmp.'.xlsx';
	if (!rename($tmp, $file)) {
		@unlink($tmp);
		accessforbidden('Impossible de préparer le fichier XLSX');
	}

	$driver = new ExportExcel2007($db);
	$result = $driver->open_file($file, $langs);
	if ($result < 0) {
		@unlink($file);
		accessforbidden($driver->error ?: 'Impossible de générer le fichier XLSX');
	}

	$selected = array();
	$labels = array();
	$types = array();
	foreach ($headers as $key => $label) {
		$selected[$key] = $key;
		$labels[$key] = $label;
		$types[$key] = 'TextAuto';
	}

	$driver->write_title($labels, $selected, $langs, $types);
	foreach ($rows as $row) {
		$driver->write_record($selected, (object) $row, $langs, $types);
	}
	$driver->close_file();

	header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
	header('Content-Disposition: attachment; filename="'.$filename.'"');
	header('Content-Length: '.filesize($file));
	header('Pragma: no-cache');
	header('Expires: 0');

	readfile($file);
	@unlink($file);
}
