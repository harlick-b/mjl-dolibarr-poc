const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const lib=path.resolve(__dirname,'../../custom/mjlfinancement/class/mjlexportspool.class.php');
function run(body) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mjl-spool-test-'));
 try {return JSON.parse(execFileSync('php',['-r',`require '${lib}'; $root='${root}'; ${body}`],{encoding:'utf8',timeout:3000}));}
 finally {fs.rmSync(root,{recursive:true,force:true});}
}
test('one stable lock rejects concurrency and descriptor survives private pathname removal',()=>{
 const result=run(`$s=new MjlExportSpool($root);$ino=fileinode($root.'/generation.lock');try{$other=new MjlExportSpool($root);$busy=false;}catch(RuntimeException $e){$busy=$e->getMessage()==='EXPORT_BUSY';}$p=$s->create('csv');file_put_contents($p,'exact bytes');$r=$s->detach($p);$absent=!file_exists($p);$s->close();$next=new MjlExportSpool($root);$stable=$ino===fileinode($root.'/generation.lock');$next->close();echo json_encode([$busy,$absent,$stable,stream_get_contents($r['stream']),$r['sha256']===hash('sha256','exact bytes')]);fclose($r['stream']);`);
 assert.deepEqual(result,[true,true,true,'exact bytes',true]);
});
test('orphan sweep rejects symlinks without following them',()=>{
 const result=run(`$d=$root.'/attempt-'.str_repeat('a',32);mkdir($d,0700);file_put_contents($root.'/outside','keep');chmod($root.'/outside',0600);symlink($root.'/outside',$d.'/artifact.csv');try{$s=new MjlExportSpool($root);$rejected=false;}catch(RuntimeException $e){$rejected=$e->getMessage()==='INVALID_SPOOL';}echo json_encode([$rejected,file_get_contents($root.'/outside')]);`);
 assert.deepEqual(result,[true,'keep']);
});
test('next owner removes recognized crash leftovers while preserving lock inode',()=>{
 const result=run(`$s=new MjlExportSpool($root);$s->close();$ino=fileinode($root.'/generation.lock');$d=$root.'/attempt-'.str_repeat('b',32);mkdir($d,0700);file_put_contents($d.'/artifact.pdf','orphan');chmod($d.'/artifact.pdf',0600);$next=new MjlExportSpool($root);echo json_encode([!file_exists($d),fileinode($root.'/generation.lock')===$ino]);$next->close();`);
 assert.deepEqual(result,[true,true]);
});
