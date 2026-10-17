// Each browser suite uses its own temporary browser storage, never the player's open tab.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const pkg=JSON.parse(await readFile('package.json','utf8'));
const root=resolve(process.env.QA_REPORT_DIR||`reports/v${pkg.version}/full-qa`);
const url=process.env.GAME_URL||'http://127.0.0.1:4173';
const selected=process.env.QA_SUITES?.split(',');
const suites=[['unit',process.execPath,['--test',...await readdir('tests').then(fs=>fs.filter(f=>f.endsWith('.test.js')).map(f=>'tests/'+f))]],['content','python3',['scripts/validate_content.py']],
 ...Object.entries(pkg.scripts).filter(([name])=>name.startsWith('qa:')&&name!=='qa:all').map(([name,cmd])=>[name.slice(3),process.execPath,[cmd.replace(/^node /,'')]]),
 ['flow-simulation',process.execPath,['scripts/flow-simulation.mjs']],['life-routes',process.execPath,['scripts/life-routes-qa.mjs']],['birth-compat',process.execPath,['scripts/birth-compat-qa.mjs']]
].filter(([name])=>!selected||selected.includes(name));
if(selected?.some(name=>!suites.some(s=>s[0]===name)))throw new Error('Unknown QA_SUITE');
await mkdir(root,{recursive:true});
const results=[],startedAt=new Date().toISOString();let index=0;
async function worker(){
 while(index<suites.length){
  const [name,cmd,args]=suites[index++],out=resolve(root,name);await mkdir(out,{recursive:true});
  const log=createWriteStream(resolve(out,'run.log'));const start=Date.now();
  console.log('RUN',name);
  const result=await new Promise(done=>{
   let timedOut=false;const child=spawn(cmd,args,{env:{...process.env,GAME_URL:url,QA_REPORT_DIR:out},stdio:['ignore','pipe','pipe'],detached:true});
   child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
   const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGTERM');}catch{}},name==='browser'?900000:300000);
   child.on('error',error=>{clearTimeout(timer);done({code:null,error:String(error)});});
   child.on('close',(code,signal)=>{clearTimeout(timer);done({code,signal,timedOut});});
  });
  await new Promise(done=>log.end(done));
  results.push({name,...result,passed:result.code===0&&!result.timedOut,seconds:Math.round((Date.now()-start)/100)/10,reportDir:out});
  console.log(result.code===0?'PASS':'FAIL',name,results.at(-1).seconds+'s');
  await writeFile(resolve(root,'progress.json'),JSON.stringify({startedAt,url,total:suites.length,completed:results.length,results},null,2));
 }
}
await Promise.all(Array.from({length:3},()=>worker()));
const report={startedAt,finishedAt:new Date().toISOString(),url,passed:results.every(r=>r.passed),total:suites.length,results};
await writeFile(resolve(root,'summary.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,total:report.total,failed:results.filter(r=>!r.passed).map(r=>r.name)}));
if(!report.passed)process.exitCode=1;
