import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const out='reports/v1.45/logic-audit/browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);};
const click=s=>page.locator(s+':visible').first().click();
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function fixture(){const s=createPlayableRun({seed:'audit-student',familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{age:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:1e7,monthlyIncome:0,occupation:'大学生'});s.education.college=true;s.education.graduated=false;s.flags.college_student=true;s.flags.college_not_admitted=false;s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];s.behavior.pending=null;ensureRoutine(s);resetRoutineDay(s,1);s.journey.lastAction='day_next';return s;}
async function load(s){await page.goto('http://127.0.0.1:4174');await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(d=>d.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');}
async function shot(name){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});}
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});const s=fixture();await load(s);
  check(`student actions and scene ${width}`,await page.locator('[data-choice=attend_class]').count()>0&&await page.locator('[data-choice=job_hunt]').count()===0&&await page.locator('.daily-stage').getAttribute('data-scene')==='college');
  check(`student status ${width}`,await page.locator('.player-header .employment-badge').innerText()==='在读');
  check(`no viewport overflow ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
  await shot(`college-${width}`);await click('[data-choice=attend_class]');const n=await saved();check(`class advances once ${width}`,n.dayRoutine.stage===2&&n.stats.academic===s.stats.academic+2&&n.cash===s.cash);
  await page.reload();await click('[data-action=load-slot]');check(`class persists ${width}`,(await saved()).dayRoutine.choices[1]==='attend_class');
 }
 await page.setViewportSize({width:1440,height:1000});const pending=fixture();pending.dayRoutine.pending='lunch';pending.dayRoutine.stage=2;await load(pending);
 check('pending event stays in lower operation area',await page.locator('.daily-operation-dock #daily-event-title').innerText()==='饭点，手机还在响');
 await click('.bottom-nav [data-tab=assets]');await click('[data-action=debt-calendar]');
 check('calendar cannot skip event',await page.locator('#game-dialog [data-action=behavior-do]').isDisabled());
 check('calendar explains the block',(await page.locator('#game-dialog').innerText()).includes('先选完眼前这件日常小事'));await shot('pending-calendar');
 await click('#game-dialog [data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');await click('[data-choice=eat]');
 check('resolving event restores lunch activities',await page.locator('[data-choice=nap]').count()>0&&(await saved()).dayRoutine.pending===null&&(await saved()).dayRoutine.stage===2);
 const retired=fixture();retired.age=67;retired.education.graduated=true;retired.flags.college_student=false;retired.flags.college_graduate=true;retired.monthlyIncome=300000;retired.retirementIncome=105000;retired.occupation='普通职员';retired.lifeArcs=newLifeArcs(retired);await load(retired);await click('[data-action=day-rules]');
 check('job and pension both visible',(await page.locator('#game-dialog').innerText()).includes('每月养老金')&&(await page.locator('#game-dialog').innerText()).includes('¥1,050'));await shot('reemployed-pension');
 check('no runtime errors',errors.length===0);await writeFile(`${out}/checks.json`,JSON.stringify({passed:true,checks,errors},null,2));
}catch(e){await page.screenshot({path:`${out}/failure.png`});await writeFile(`${out}/checks.json`,JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));throw e;}finally{await browser.close();}
