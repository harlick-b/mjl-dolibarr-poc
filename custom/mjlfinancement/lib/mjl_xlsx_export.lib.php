<?php

function mjl_xlsx_export_generate_file($file, $headers, $rows, $moneyFields = array())
{
	global $db, $langs;

	require_once DOL_DOCUMENT_ROOT.'/core/modules/export/export_excel2007.modules.php';

	try {
		$driver = new ExportExcel2007($db);
		$result = $driver->open_file($file, $langs);
	} catch (Throwable $e) {
		@unlink($file);
		return false;
	}
	if ($result < 0) {
		@unlink($file);
		return false;
	}

	$moneyFields = array_fill_keys(array_map('strval', $moneyFields), true);
	$selected = array();
	$labels = array();
	$types = array();
	foreach ($headers as $key => $label) {
		$selected[$key] = $key;
		$labels[$key] = $label;
		$types[$key] = isset($moneyFields[(string) $key]) ? 'Numeric' : 'Text';
	}

	try {
		if ($driver->write_title($labels, $selected, $langs, $types) < 0) {
			@unlink($file);
			return false;
		}
		foreach ($rows as $row) {
			$typedRow = array();
			foreach (array_keys($headers) as $key) {
				$value = isset($row[$key]) ? $row[$key] : '';
				if (isset($moneyFields[(string) $key])) {
					if ($value !== '' && !is_numeric($value)) {
						@unlink($file);
						return false;
					}
					$typedRow[$key] = $value === '' ? '' : (string) $value;
				} else {
					$typedRow[$key] = (string) $value;
				}
			}
			if ($driver->write_record($selected, (object) $typedRow, $langs, $types) < 0) {
				@unlink($file);
				return false;
			}
		}
		if ($driver->close_file() < 0) {
			@unlink($file);
			return false;
		}
	} catch (Throwable $e) {
		@unlink($file);
		return false;
	}

	if (!is_file($file) || !is_readable($file) || filesize($file) <= 0 || !class_exists('ZipArchive')) {
		@unlink($file);
		return false;
	}
	$archive = new ZipArchive();
	if ($archive->open($file) !== true) {
		@unlink($file);
		return false;
	}
	$requiredEntries = array('[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml');
	foreach ($requiredEntries as $entry) {
		if ($archive->locateName($entry) === false) {
			$archive->close();
			@unlink($file);
			return false;
		}
	}
	$archive->close();
	return true;
}

function mjl_xlsx_export_output($filename, $headers, $rows, $moneyFields = array())
{
	$tmp = tempnam(sys_get_temp_dir(), 'mjl_xlsx_');
	if ($tmp === false) {
		return false;
	}
	$file = $tmp.'.xlsx';
	@unlink($tmp);
	if (!mjl_xlsx_export_generate_file($file, $headers, $rows, $moneyFields)) {
		@unlink($file);
		return false;
	}
	header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
	header('Content-Disposition: attachment; filename="'.$filename.'"');
	header('Content-Length: '.filesize($file));
	header('Pragma: no-cache');
	header('Expires: 0');

	readfile($file);
	@unlink($file);
	return true;
}
