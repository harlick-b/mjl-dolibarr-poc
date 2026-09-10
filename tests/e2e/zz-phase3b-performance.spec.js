const {test,expect}=require('@playwright/test');
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const {createPhase1FixtureSet}=require('../helpers/phase1-fixture');
function command(request){return JSON.parse(cp.execFileSync('docker',['compose','exec','-T','--user','www-data','dolibarr','php','/opt/mjl-tests/fixtures/phase3b-performance-fixture.php'],{env:process.env,encoding:'utf8',input:JSON.stringify(request),stdio:['pipe','pipe','pipe'],timeout:request.action==='build'?40*60*1000:60000}));}
function imageId(service){const id=cp.execFileSync('docker',['compose','ps','-q',service],{encoding:'utf8',env:process.env}).trim();return cp.execFileSync('docker',['inspect','--format','{{.Image}}',id],{encoding:'utf8'}).trim();}
async function validateSurface(page,html,route){
 const surface=await page.evaluate(({html,route})=>{
  const document=new DOMParser().parseFromString(html,'text/html');
  const main=document.querySelector('main');
  const text=main?.textContent||'';
  const selectors={'activities.php':'[data-activity]','operations.php':'.mjl-operation-card','alerts.php':'[data-alert]','reports.php?report=audit':'.mjl-activity-panel'};
  return {
   unavailable:/indisponible|ne peuvent pas être chargées/i.test(text),
   populated:route==='index.php'
    ?text.includes('1000 Activité(s) dans la sélection.')&&document.querySelector('[data-metric="validated_amount"] .mjl-card-value')?.textContent.replace(/\D/g,'')==='400000000'
    :document.querySelectorAll(selectors[route]).length===50&&text.includes('BENCH'),
  };
 },{html,route});
 expect(surface,`${route}: populated, available benchmark surface`).toEqual({unavailable:false,populated:true});
}
test('installed scale meets authenticated p95 and full export time/memory budgets',async({page},testInfo)=>{
 // Command-backed fixture setup is excluded from the measured acceptance budgets.
 test.setTimeout(50*60*1000);
 const fixture=createPhase1FixtureSet({namespace:'phase3b.performance',entity:1,users:[{key:'agent',role:'AGENT_SAISIE'},{key:'other',role:'AGENT_SAISIE'},{key:'supervisor',role:'AGENT_VERIFICATEUR'},{key:'validator',role:'VALIDATEUR_DEFINITIF'}],references:{partners:[{key:'partner',label:'Partenaire de mesure'}],projects:[{key:'project',label:'Projet de mesure',partnerKey:'partner'}],operationTypes:[{key:'type',label:'Type de mesure'}]}});
 const workload=command({action:'build',agent:fixture.users.agent.id,other:fixture.users.other.id,supervisor:fixture.users.supervisor.id,validator:fixture.users.validator.id,partner:fixture.partners.partner,project:fixture.projects.project,type:fixture.operationTypes.type});
 expect(workload.activities).toBe(1000);expect(workload.operations).toBe(10000);expect(workload.audit_events).toBeGreaterThanOrEqual(50000);
 const results={environment:{images:{dolibarr:imageId('dolibarr'),mariadb:imageId('mariadb')},host:{platform:os.platform(),architecture:os.arch(),cpu:os.cpus()[0]?.model,logical_cpus:os.cpus().length,memory_bytes:os.totalmem()},php:{version:workload.php_version,memory_limit:workload.memory_limit}},workload:{...workload,distribution:'200 drafts, 200 submitted, 200 prevalidated, 400 validated; 200 additional assignments; among 200 validated Activities, 5 missing, 3 zero and 2 complete spending values, including one cancelled zero-spending Operation each'},latency:[],exports:[]};
 const save=()=>fs.writeFileSync(testInfo.outputPath('performance.json'),JSON.stringify(results,null,2));save();
 for(const role of ['agent','supervisor','validator']){
  await page.context().clearCookies();await page.goto('/index.php');await page.getByLabel('Identifiant').fill(fixture.users[role].login);await page.getByLabel('Mot de passe').fill(process.env.MJL_TEST_USER_PASSWORD);await page.getByRole('button',{name:'Connexion',exact:true}).click();await expect(page.getByLabel('Identifiant')).toHaveCount(0);
  const routes=['index.php','activities.php','operations.php','alerts.php'];if(role==='validator')routes.push('reports.php?report=audit');
  for(const route of routes){const url='/custom/mjlfinancement/'+route+(route.includes('?')?'&':'?')+(route.includes('audit')?'':'q=BENCH');const samples=[];const statuses=[];
   for(let i=-1;i<20;i++){const start=performance.now();const response=await page.request.get(url,{timeout:30000});const body=await response.body();const elapsed=performance.now()-start;if(i>=0){samples.push(elapsed);statuses.push(response.status());}await response.dispose();await validateSurface(page,body.toString('utf8'),route);}
   const sorted=[...samples].sort((a,b)=>a-b);results.latency.push({role,route,samples_ms:samples,p95_ms:sorted[18],statuses});save();
  }
 }
 for(const report of ['activities','operations','activity_detail','portfolio','audit'])for(const format of ['pdf','xlsx','csv']){
  const filters=report==='activity_detail'?{activity_id:String(workload.activity_id)}:report==='audit'?{q:format==='pdf'?'BENCH-AUDIT-000':'BENCH-AUDIT-00'}:{q:report==='operations'?(format==='pdf'?'BENCH 000':'BENCH 00'):(format==='pdf'&&report==='activities'?'BENCH 00':'BENCH ')};
  const expectedRows=report==='portfolio'?1:report==='activity_detail'?12:report==='operations'?(format==='pdf'?100:1000):format==='pdf'?100:1000;
  try{const metrics=command({action:'export',actor:fixture.users.validator.id,report,format,filters});
   await page.goto('/custom/mjlfinancement/reports.php?'+new URLSearchParams({report,...filters}));const token=await page.locator('form[action$="reportexport.php"] input[name="token"]').inputValue();const start=performance.now();const response=await page.request.post('/custom/mjlfinancement/reportexport.php',{form:{token,report,format,...filters},timeout:35000});const body=await response.body();results.exports.push({report,format,filters,expected_rows:expectedRows,...metrics,http_status:response.status(),http_milliseconds:performance.now()-start,http_bytes:body.length,content_type:response.headers()['content-type'],disposition:response.headers()['content-disposition']});await response.dispose();} catch(error){results.exports.push({report,format,filters,error:String(error.stderr||error.message).slice(0,2000)});}save();
 }
 for(const row of results.latency){expect(row.statuses,`${row.role} ${row.route}: HTTP status`).toEqual(Array(20).fill(200));expect(row.p95_ms,`${row.role} ${row.route}: p95 ms`).toBeLessThanOrEqual(2000);}
 for(const row of results.exports){expect(row.error,`${row.report}/${row.format}`).toBeUndefined();expect(row.body_rows,`${row.report}/${row.format}: audited body rows`).toBe(row.expected_rows);expect(row.milliseconds,`${row.report}/${row.format}: generation ms`).toBeLessThanOrEqual(30000);expect(row.http_status).toBe(200);expect(row.http_milliseconds).toBeLessThanOrEqual(30000);expect(row.disposition).toMatch(/^attachment;/);expect(row.disposition).toContain('.'+row.format);expect(row.content_type).toContain({pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv'}[row.format]);expect(row.http_bytes).toBeGreaterThan(0);expect(row.bytes).toBeGreaterThan(0);expect(row.bytes).toBeLessThanOrEqual(20*1024*1024);const match=/^(\d+)([KMG]?)$/i.exec(row.memory_limit);if(match)expect(row.peak_bytes).toBeLessThan(Number(match[1])*({K:1024,M:1048576,G:1073741824}[match[2].toUpperCase()]||1));}
});
