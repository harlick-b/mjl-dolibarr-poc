<?php

/** Pure serialization policy. File creation and delivery belong to the export owner. */
function mjl_report_xlsx_cell(array $cell)
{
	$value=$cell['value'];
	if ($value===null) return array('type'=>'null','value'=>null,'format'=>'General');
	if ($cell['type']==='integer') {
		$value=(string)$value;
		if (!preg_match('/^-?(?:0|[1-9][0-9]*)$/',$value)) throw new InvalidArgumentException('INVALID_AMOUNT');
		if (strlen(ltrim($value,'-'))<=15) return array('type'=>'n','value'=>(int)$value,'format'=>'#,##0');
		return array('type'=>'s','value'=>$value,'format'=>'@');
	}
	if ($cell['type']==='ratio') {
		if (!is_array($value) || !isset($value['display']) || !array_key_exists('ratio',$value)) throw new InvalidArgumentException('INVALID_RATIO');
		$ratio=$value['ratio'];
		if ($ratio!==null && is_numeric($ratio) && is_finite((float)$ratio)) {
			$scaled=(float)$ratio*100;
			$display=($scaled>0?'+':($scaled<0?'-':'')).number_format(abs($scaled),2,',','').' %';
			if ((float)$ratio===0.0 && $value['display']==='-') return array('type'=>'n','value'=>0,'format'=>'+0.00" "%;-0.00" "%;"-"');
			if ((float)$ratio===0.0 && $display===$value['display']) return array('type'=>'n','value'=>0,'format'=>'0.00" "%');
			// Rounding to zero loses the economic sign in spreadsheet renderers.
			if (abs($scaled)>=0.005 && $display===$value['display']) return array('type'=>'n','value'=>(float)$ratio,'format'=>'+0.00" "%;-0.00" "%');
		}
		return array('type'=>'s','value'=>$value['display'],'format'=>'@');
	}
	if ($cell['type']!=='text' || !is_scalar($value)) throw new InvalidArgumentException('INVALID_CELL');
	return array('type'=>'s','value'=>(string)$value,'format'=>'@');
}

function mjl_report_csv_cell(array $cell)
{
	if ($cell['value']===null) return '';
	if ($cell['type']==='integer') {
		$value=(string)$cell['value'];
		if (!preg_match('/^-?(?:0|[1-9][0-9]*)$/',$value)) throw new InvalidArgumentException('INVALID_AMOUNT');
		return $value;
	}
	$value=$cell['type']==='ratio'?$cell['value']['display']:(string)$cell['value'];
	if (!preg_match('//u',$value)) throw new InvalidArgumentException('INVALID_TEXT');
	return preg_match('/^[\p{Z}\s\x{FEFF}]*[=+\-@]/u',$value) || preg_match('/^[\t\r\n]/',$value) ? "'".$value : $value;
}

function mjl_report_format_notice()
{
	return 'Cellule financière vide : non renseignée ; zéro : montant explicitement nul. Les montants de plus de 15 chiffres sont conservés comme texte exact dans XLSX. L’ouverture automatique du CSV dans un tableur peut arrondir les grands nombres ; utilisez XLSX pour les préserver. Les dépenses renseignées peuvent constituer un total partiel.';
}

function mjl_report_memory_headroom($required)
{
	$limit=ini_get('memory_limit');
	if ($limit==='-1') return;
	$unit=strtolower(substr($limit,-1)); $bytes=(int)$limit;
	if ($unit==='g') $bytes*=1073741824;
	elseif ($unit==='m') $bytes*=1048576;
	elseif ($unit==='k') $bytes*=1024;
	if (memory_get_usage(true)+$required>$bytes) throw new RuntimeException('EXPORT_MEMORY_LIMIT');
}
