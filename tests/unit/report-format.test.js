const test = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const lib=path.resolve(__dirname,'../../custom/mjlfinancement/lib/mjl_report_format.lib.php');
function php(expression) { return JSON.parse(execFileSync('php',['-r',`require '${lib}'; echo json_encode(${expression});`],{encoding:'utf8',timeout:2000})); }
test('XLSX preserves oversized amounts as text and ordinary zero as numeric',()=>{
 const r=php("[mjl_report_xlsx_cell(['type'=>'integer','value'=>'1234567890123456']),mjl_report_xlsx_cell(['type'=>'integer','value'=>'0']),mjl_report_xlsx_cell(['type'=>'integer','value'=>null])]");
 assert.deepEqual(r,[{type:'s',value:'1234567890123456',format:'@'},{type:'n',value:0,format:'#,##0'},{type:'null',value:null,format:'General'}]);
});
test('XLSX keeps formula-like user input explicit text',()=>{
 assert.deepEqual(php("mjl_report_xlsx_cell(['type'=>'text','value'=>'=1+1'])"),{type:'s',value:'=1+1',format:'@'});
});
test('CSV neutralizes text after Unicode whitespace and preserves exact integer strings',()=>{
 const r=php("[mjl_report_csv_cell(['type'=>'text','value'=>\"\\u{00a0}=1+1\"]),mjl_report_csv_cell(['type'=>'integer','value'=>'12345678901234567890'])]");
 assert.deepEqual(r,["'\u00a0=1+1",'12345678901234567890']);
});
test('negative tiny percentage retains its signed display through text fallback',()=>{
 const r=php("mjl_report_xlsx_cell(['type'=>'ratio','value'=>['ratio'=>-0.00000001,'display'=>'-0,00 %']])");
 assert.equal(r.type,'s');assert.equal(r.value,'-0,00 %');
});
test('ordinary percentage stores a ratio and uses spreadsheet percentage scaling',()=>{
 const r=php("mjl_report_xlsx_cell(['type'=>'ratio','value'=>['ratio'=>0.125,'display'=>'+12,50 %']])");
 assert.equal(r.type,'n');assert.equal(r.value,0.125);assert.equal(r.format,'+0.00" "%;-0.00" "%');
});
test('oversized selection is rejected before serialization under a small memory limit',()=>{
 const render=lib.replace('mjl_report_format.lib.php','mjl_report_render.lib.php');
 const out=execFileSync('php',['-d','memory_limit=16M','-r',`require '${render}'; $row=[['type'=>'text','value'=>str_repeat('x',4000)]]; $d=['metadata'=>[],'sections'=>[['title'=>'Test','headers'=>['Texte'],'rows'=>array_fill(0,10001,$row)]]]; try {mjl_report_preflight($d,'csv');} catch (RuntimeException $e) {echo $e->getMessage();}`],{encoding:'utf8',timeout:2000});
 assert.equal(out,'REPORT_LIMIT');
});
test('metadata text obeys the same limit as body text',()=>{
 const render=lib.replace('mjl_report_format.lib.php','mjl_report_render.lib.php');
 const out=execFileSync('php',['-r',`require '${render}'; try {mjl_report_preflight(['metadata'=>['Nom'=>str_repeat('x',4001)],'sections'=>[]],'csv');} catch (RuntimeException $e) {echo $e->getMessage();}`],{encoding:'utf8',timeout:2000});
 assert.equal(out,'UNSUPPORTED_RECORD');
});
test('an exact zero percentage remains numeric while a negative tiny value keeps its sign',()=>{
 const r=php("[mjl_report_xlsx_cell(['type'=>'ratio','value'=>['ratio'=>0,'display'=>'0,00 %']]),mjl_report_xlsx_cell(['type'=>'ratio','value'=>['ratio'=>-0.00000001,'display'=>'-0,00 %']])]");
 assert.equal(r[0].type,'n');assert.equal(r[0].value,0);assert.equal(r[1].type,'s');assert.equal(r[1].value,'-0,00 %');
});
test('real equal-amount operation variance stays numeric zero with a dash display in XLSX',()=>{
 const data=lib.replace('mjl_report_format.lib.php','mjl_report_data.lib.php');
 const out=execFileSync('php',['-r',`require '${data}';require_once '${lib}';$rows=mjl_report_operation_records([['activity_id'=>1,'status'=>'COMPLETED','authorized_amount'=>'100','spent_amount'=>'100']]);echo json_encode(mjl_report_xlsx_cell(['type'=>'ratio','value'=>$rows[0]['variance']]));`],{encoding:'utf8'});
 const cell=JSON.parse(out);assert.equal(cell.type,'n');assert.equal(cell.value,0);assert.equal(cell.format.split(';')[2],'"-"');
});
test('CSV renderer rejects a positive partial write of its final row',()=>{
 const render=lib.replace('mjl_report_format.lib.php','mjl_report_render.lib.php');
 const out=execFileSync('php',['-r',`require '${render}';$path=tempnam(sys_get_temp_dir(),'mjl-short-write-');$d=['metadata'=>[],'sections'=>[['title'=>'Test','headers'=>['Texte'],'rows'=>[[['type'=>'text','value'=>str_repeat('x',1000)]]]]]];try{mjl_report_render($path,'csv',$d,hrtime(true)+1000000000);$size=filesize($path);pcntl_signal(SIGXFSZ,SIG_IGN);if(!posix_setrlimit(POSIX_RLIMIT_FSIZE,$size-1,$size-1))throw new RuntimeException('LIMIT_NOT_SET');set_error_handler(function(){return true;});try{mjl_report_render($path,'csv',$d,hrtime(true)+1000000000);echo 'ACCEPTED_TRUNCATION';}catch(RuntimeException $e){echo $e->getMessage();}}finally{unlink($path);}`],{encoding:'utf8',timeout:2000});
 assert.equal(out,'RENDER_FAILED');
});
