import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {syncEmployment,advanceEmployment} from '../src/game/employment.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.40/employment',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
function worker(seed='work-ui'){const s=createPlayableRun({seed,familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:1e6,monthlyIncome:300000,occupation:'普通职员'});s.behavior.pending=null;s.lifeArcs.pending=null;s.debtClock.day=60;delete s.employment;syncEmployment(s);s.employment.tenure=60;ensureRoutine(s);resetRoutineDay(s,6);s.trading.phase=2;return s;}
const mock={mul:(n,x)=>Math.round(n*x),cashChange:(s,n)=>{s.cash+=n;},charge:(s,n)=>{s.cash-=n;return 0;},stat:()=>{}};
function fixture(kind){for(let i=0;i<20000;i++){const s=worker('work-event-'+i),date=kind==='bonus'?'2006-12-15':'2006-03-01';s.trading.calendar={turn:s.turn,day:s.trading.day,date};const n=structuredClone(s);advanceEmployment(n,1,mock,{startDate:date});if(n.employment.history.at(-1)?.kind===kind)return s;}throw Error('no fixture');}
const click=q=>page.locator(q+':visible').first().click(),check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');}
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
async function layout(label){check('page and profile fit '+label,await page.evaluate(()=>{const badge=document.querySelector('.player-profile .employment-badge').getBoundingClientRect(),profile=document.querySelector('.player-profile').getBoundingClientRect();return document.documentElement.scrollWidth===innerWidth&&badge.left>=profile.left&&badge.right<=profile.right&&badge.top>=profile.top&&badge.bottom<=profile.bottom;}));}
try{
for(const [width,height] of [[1440,900],[390,844],[320,740]]){
 await page.setViewportSize({width,height});
 for(const kind of ['bonus','penalty','layoff']){
  await load(fixture(kind));check('initial worker badge '+kind+' '+width,(await page.locator('.player-profile .employment-badge').textContent())==='在职');await layout(kind+' '+width);
  await click('.life-pace-actions [data-action=life-continue]');
  check('notice is visible '+kind+' '+width,await page.locator('.employment-update').isVisible());
  check('matching cash record '+kind+' '+width,(await state()).employment.history.at(-1).kind===kind);
  const title=await page.locator('.player-profile .employment-badge').textContent();check('updated job status '+kind+' '+width,title===(kind==='layoff'?'无固定工作':'在职'));
  await click('.daily-rules-button');check('work history opens '+kind+' '+width,await page.locator('#game-dialog .work-history li').count()===1);
  check('dialog content fits '+kind+' '+width,await page.locator('#game-dialog .dialog-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:`${dir}/${kind}-${width}.png`});await click('[data-action=close-dialog]');
  const before=await state();await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');const after=await state();check('reload preserves money and outcome '+kind+' '+width,before.cash===after.cash&&JSON.stringify(before.employment)===JSON.stringify(after.employment));
  if(kind==='layoff'){
   await click('.life-pace-actions [data-action=life-continue]');if(await page.locator('[data-kind=day_event_choice]').count())await click('[data-kind=day_event_choice]');check('job search replaces work '+width,await page.locator('[data-choice=job_hunt]').count()===1&&await page.locator('[data-choice=focus]').count()===0);
  }
 }
}
await page.setViewportSize({width:1440,height:900});
for(const [kind,label] of [['none','无固定工作'],['retired','已退休'],['leave','在职 · 请假'],['tomorrow','待入职']]){const s=worker();if(kind==='none'){s.monthlyIncome=0;s.occupation='待业青年';}if(kind==='retired'){s.age=67;s.occupation='退休';s.monthlyIncome=100000;}if(kind==='leave')s.behavior.leaveDays=1;if(kind==='tomorrow')s.behavior.jobStartsTomorrow=true;syncEmployment(s);await load(s);check('distinct state '+kind,(await page.locator('.player-profile .employment-badge').textContent())===label);await click('.player-profile');check('profile also shows state '+kind,(await page.locator('#game-dialog .employment-badge').textContent())===label);await click('[data-action=close-dialog]');}
const s=worker();s.monthlyIncome=0;s.occupation='待业青年';s.behavior.jobStartsTomorrow=false;syncEmployment(s);resetRoutineDay(s,1);s.trading.phase=0;await load(s);await click('.extra-arrangements > summary');await click('[data-action=life-action][data-type=seek_job]');check('finding work updates the badge',(await page.locator('.player-profile .employment-badge').textContent())==='在职');check('finding work changes daytime choices',await page.locator('[data-choice=focus]').count()===1);if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await page.locator('#toast.show').waitFor({state:'hidden'});await page.screenshot({path:`${dir}/worker-status.png`});
check('no runtime errors',errors.length===0);await writeFile(`${dir}/report.json`,JSON.stringify({checks,errors},null,2));console.log(`${checks.length} browser checks passed`);
}finally{await browser.close();}
