<?php

require_once __DIR__.'/mjl_report_format.lib.php';
require_once __DIR__.'/mjl_presentation.lib.php';

/** Generation checkpoints enforce a no-publication budget, not a process-wall timeout. */
function mjl_report_checkpoint($deadline)
{
	if (hrtime(true)>$deadline) throw new RuntimeException('EXPORT_DEADLINE');
}

function mjl_report_bounded_text($value)
{
	if (!is_scalar($value) && $value!==null) throw new RuntimeException('UNSUPPORTED_RECORD');
	$value=(string)$value;
	if (!preg_match('//u',$value) || mb_strlen($value)>4000) throw new RuntimeException('UNSUPPORTED_RECORD');
	return strlen($value);
}

function mjl_report_preflight(array $document,$format)
{
	if (!in_array($format,array('pdf','xlsx','csv'),true) || array_keys($document)!==array('metadata','sections') || count($document['metadata'])>100 || count($document['sections'])>10) throw new RuntimeException('REPORT_LIMIT');
	$rows=0; $cells=0; $size=256;
	// Count first: an oversized selection must not allocate its serialized copy.
	foreach ($document['sections'] as $section) {
		$rows+=count($section['rows']);
		if ($rows>($format==='pdf'?500:10000)) throw new RuntimeException('REPORT_LIMIT');
	}
	foreach ($document['metadata'] as $label=>$value) {
		$raw=mjl_report_bounded_text($label)+mjl_report_bounded_text($value);
		mjl_report_memory_headroom($raw*6+65536);
		$size+=strlen(json_encode(array($label=>$value),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)); $cells+=2;
	}
	foreach ($document['sections'] as $section) {
		if (array_keys($section)!==array('title','headers','rows') || count($section['headers'])>64) throw new RuntimeException('REPORT_LIMIT');
		$raw=mjl_report_bounded_text($section['title']);
		if (mb_strlen($section['title'])>120) throw new RuntimeException('UNSUPPORTED_RECORD');
		foreach ($section['headers'] as $header) $raw+=mjl_report_bounded_text($header);
		mjl_report_memory_headroom($raw*6+65536);
		$size+=strlen(json_encode(array('title'=>$section['title'],'headers'=>$section['headers'],'rows'=>array()),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR))+32;
		$cells+=count($section['headers']);
		foreach ($section['rows'] as $row) {
			if (count($row)!==count($section['headers'])) throw new RuntimeException('UNSUPPORTED_RECORD');
			$raw=0; $cells+=count($row);
			foreach ($row as $cell) {
				$value=$cell['type']==='ratio' ? ($cell['value']['display']??'') : ($cell['value']??'');
				$raw+=mjl_report_bounded_text($value)+256;
			}
			mjl_report_memory_headroom($raw*6+65536);
			$size+=strlen(json_encode($row,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR))+1;
			if ($size>5242880) throw new RuntimeException('REPORT_LIMIT');
		}
	}
	if ($size>5242880) throw new RuntimeException('REPORT_LIMIT');
	mjl_report_memory_headroom($size*4+($format==='xlsx'?$cells*600:0)+20971520);
	return $rows;
}

/** Renderer only writes a private precreated pathname. It never sends headers or bytes. */
function mjl_report_render($path,$format,array $document,$deadline)
{
	mjl_report_preflight($document,$format);
	mjl_report_checkpoint($deadline);
	$priorUmask=umask(0077);
	try {
	if ($format==='csv') mjl_report_render_csv($path,$document,$deadline);
	elseif ($format==='xlsx') mjl_report_render_xlsx($path,$document,$deadline);
	elseif ($format==='pdf') mjl_report_render_pdf($path,$document,$deadline);
	else throw new InvalidArgumentException('INVALID_REPORT');
	} finally { umask($priorUmask); }
	mjl_report_checkpoint($deadline);
	clearstatcache(true,$path);
	$size=filesize($path);
	if ($size===false || $size<1 || $size>20971520) throw new RuntimeException('ARTIFACT_LIMIT');
}

function mjl_report_render_csv($path,array $document,$deadline)
{
	$fd=fopen($path,'wb');
	if (!$fd) throw new RuntimeException('RENDER_FAILED');
	try {
		if (fwrite($fd,"\xEF\xBB\xBF")!==3) throw new RuntimeException('RENDER_FAILED');
		$write=function($values)use($fd){
			// fputcsv can report a positive partial write. Compare against encoded bytes.
			$buffer=fopen('php://memory','w+b');
			if (!$buffer) throw new RuntimeException('RENDER_FAILED');
			try {
				$length=fputcsv($buffer,$values,';','"','');
				if ($length===false || !rewind($buffer)) throw new RuntimeException('RENDER_FAILED');
				$line=stream_get_contents($buffer);
				if ($line===false || strlen($line)!==$length || fwrite($fd,$line)!==$length) throw new RuntimeException('RENDER_FAILED');
			} finally { fclose($buffer); }
		};
		foreach($document['metadata'] as $label=>$value) $write(array(mjl_report_csv_cell(array('type'=>'text','value'=>$label)),mjl_report_csv_cell(array('type'=>'text','value'=>$value))));
		$write(array('Lecture des montants',mjl_report_format_notice()));
		foreach($document['sections'] as $section) {
			$write(array()); $write(array(mjl_report_csv_cell(array('type'=>'text','value'=>$section['title']))));
			$write(array_map(function($value){return mjl_report_csv_cell(array('type'=>'text','value'=>$value));},$section['headers']));
			foreach($section['rows'] as $row) { mjl_report_checkpoint($deadline); $write(array_map('mjl_report_csv_cell',$row)); }
		}
		if (!fflush($fd)) throw new RuntimeException('RENDER_FAILED');
	} finally { fclose($fd); }
}

function mjl_report_render_xlsx($path,array $document,$deadline)
{
	require_once DOL_DOCUMENT_ROOT.'/includes/phpoffice/phpspreadsheet/src/autoloader.php';
	require_once DOL_DOCUMENT_ROOT.'/includes/Psr/autoloader.php';
	if (!class_exists('PhpOffice\\PhpSpreadsheet\\Spreadsheet')) throw new RuntimeException('RENDERER_UNAVAILABLE');
	$book=new \PhpOffice\PhpSpreadsheet\Spreadsheet();
	try {
		$metadata=$book->getActiveSheet(); $metadata->setTitle('Informations'); $line=1;
		foreach(array_merge($document['metadata'],array('Lecture des montants'=>mjl_report_format_notice())) as $label=>$value) {
			$metadata->setCellValueExplicit('A'.$line,(string)$label,'s'); $metadata->setCellValueExplicit('B'.$line,(string)$value,'s'); $line++;
		}
		$metadata->getColumnDimension('A')->setWidth(30); $metadata->getColumnDimension('B')->setWidth(95); $metadata->getStyle('A1:B'.$line)->getAlignment()->setWrapText(true);
		foreach($document['sections'] as $index=>$section) {
			$sheet=$book->createSheet(); $sheet->setTitle('Données '.($index+1));
			$column=1;
			foreach($section['headers'] as $label) {
				$letter=\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($column++);
				$sheet->setCellValueExplicit($letter.'1',$label,'s'); $sheet->getColumnDimension($letter)->setWidth(24);
			}
			$sheet->freezePane('A2'); $sheet->getStyle('1:1')->getFont()->setBold(true); $line=2;
			foreach($section['rows'] as $row) {
				mjl_report_checkpoint($deadline); $column=1;
				foreach($row as $cell) {
					$typed=mjl_report_xlsx_cell($cell); $coordinate=\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($column++).$line;
					if ($typed['value']!==null) $sheet->setCellValueExplicit($coordinate,$typed['value'],$typed['type']);
					$sheet->getStyle($coordinate)->getNumberFormat()->setFormatCode($typed['format']);
				}
				$line++;
			}
			if ($line>2) $sheet->setAutoFilter('A1:'.\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($section['headers'])).($line-1));
		}
		$writer=new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($book); $writer->setPreCalculateFormulas(false); $writer->save($path); unset($writer);
	} finally { $book->disconnectWorksheets(); unset($book); }
}

function mjl_report_render_pdf($path,array $document,$deadline)
{
	require_once DOL_DOCUMENT_ROOT.'/includes/tecnickcom/tcpdf/tcpdf.php';
	$pdf=new class('P','mm','A4',true,'UTF-8',false) extends TCPDF {
		public $sectionTitle='Informations';
		public function Header() {
			$this->SetFont('dejavusans','B',9); $this->SetXY(15,7);
			$this->Write(5,'MJL · Rapport opérationnel · '.$this->sectionTitle,'',false,'',true);
		}
		public function Footer() {
			$this->SetY(-12); $this->SetFont('dejavusans','',8);
			$this->Cell(0,5,'Page '.$this->getAliasNumPage().' / '.$this->getAliasNbPages(),0,0,'C');
		}
	};
	$pdf->SetMargins(15,25,15); $pdf->SetAutoPageBreak(true,15); $pdf->SetFont('dejavusans','',9); $pdf->AddPage();
	foreach(array_merge($document['metadata'],array('Lecture des montants'=>mjl_report_format_notice())) as $label=>$value) $pdf->Write(5,$label.' : '.$value."\n",'',false,'',true);
	foreach($document['sections'] as $section) {
		$pdf->sectionTitle=$section['title']; $pdf->AddPage(); $pdf->SetFont('dejavusans','B',12); $pdf->Write(6,$section['title'],'',false,'',true); $pdf->SetFont('dejavusans','',9);
		foreach($section['rows'] as $index=>$row) {
			mjl_report_checkpoint($deadline);
			$pdf->Write(5,'Ligne '.($index+1),'',false,'',true);
			foreach($row as $column=>$cell) {
				$value=$cell['type']==='ratio'?($cell['value']['display']??'Non renseigné'):($cell['value']??'Non renseigné');
				if (($cell['currency']??'')==='XOF' && $cell['value']!==null) $value=mjl_format_money($cell['value']);
				$pdf->Write(5,$section['headers'][$column].' : '.(string)$value,'',false,'',true);
			}
			$pdf->Ln(3);
		}
	}
	$pdf->Output($path,'F'); unset($pdf);
}
