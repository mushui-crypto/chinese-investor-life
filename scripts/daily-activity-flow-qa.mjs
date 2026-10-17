import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {act} from '../src/game/narrative.js';
import {createPlayableRun} from '../src/game/quick-start.js';
import {PRODUCTS} from '../src/game/core.js';
import {ensureRoutine,resetRoutineDay,DAILY_EVENTS} from '../src/game/day-routine.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir='reports/v1.45/daily-activities',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const click=q=>page.locator(q+':visible').first().click();
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function fixture(stage=1,wage=350000,seed='activity-flow'){
 const s=createPlayableRun({seed,familyId:'F01',startAt:'adult'},catalog);
 Object.assign(s,{age:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:2e7,monthlyIncome:wage,occupation:wage?'普通职员':'待业青年'});
 s.behavior.pending=null;s.lifeArcs.pending=null;s.lifeArcs.seen=['comfort','pressure','request','promise_due','disclosure','response'];s.education.college=false;s.flags.college_student=false;s.flags.college_not_admitted=true;
 s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};s.stats.insight=70;s.stats.skill=40;
 ensureRoutine(s);resetRoutineDay(s,stage);s.trading.phase=stage<2?0:stage<4?1:2;
 if(stage>1)s.dayRoutine.choices[1]='focus';if(stage>3)s.dayRoutine.choices[3]='focus';return s;
}
async function enter(){await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await enter();}
async function resolve(){for(let i=0;i<3&&(await state()).dayRoutine.pending;i++){const key=(await state()).dayRoutine.pending,c=DAILY_EVENTS[key].choices.at(-1)[0];await click(`.daily-operation-dock [data-choice=${c}]`);}}
async function geometry(tag){const g=await page.evaluate(()=>{const r=q=>document.querySelector(q).getBoundingClientRect(),d=r('.daily-operation-dock'),n=r('.bottom-nav'),s=r('.game-scroll');return {sameWidth:Math.abs(d.width-n.width)<1,sameX:Math.abs(d.x-n.x)<1,noOverlap:d.bottom<n.top,visible:d.top>=0,scene:s.height>0,overflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,scroll:scrollY};});check('dock alignment and fixed page '+tag,g.sameWidth&&g.sameX&&g.noOverlap&&g.visible&&g.scene&&!g.overflow&&g.scroll===0);for(const el of await page.locator('.daily-operation-dock .day-choices button').all()){await el.scrollIntoViewIfNeeded();check('reachable choice '+tag,await el.evaluate(e=>{const r=e.getBoundingClientRect(),d=e.closest('.life-clockbar').getBoundingClientRect();return r.top>=d.top-1&&r.bottom<=d.bottom+1&&r.height>=44;}));}}
try{
 for(const [width,height] of [[1920,1080],[1440,900],[1024,768],[390,844],[320,740],[844,390]]){
  await page.setViewportSize({width,height});await load(fixture());
  check('choices only at bottom '+width,await page.locator('.daily-operation-dock [data-kind=day_activity]').count()===2&&await page.locator('.arrangement-panel [data-kind=day_activity]').count()===0&&await page.locator('.daily-operation-dock [data-action=day-continue]').count()===0);
  await geometry(width);if(await page.locator('#toast.show').count())await page.locator('#toast.show').waitFor({state:'hidden'});await page.screenshot({path:`${dir}/work-${width}.png`});
  const before=await state();await click('.daily-operation-dock [data-choice=focus]');const after=await state();check('work advances to lunch once '+width,after.dayRoutine.stage===2&&after.stats.skill===before.stats.skill+1&&after.behavior.fatigue===before.behavior.fatigue+3&&after.cash===before.cash&&after.actionPoints===before.actionPoints);
  await resolve();check('lunch choices restored '+width,await page.locator('.daily-operation-dock [data-choice=nap]').isVisible());
  await click('.daily-operation-dock [data-choice=nap]');check('lunch advances to afternoon '+width,(await state()).dayRoutine.stage===3);await resolve();
  await click('.daily-operation-dock [data-choice=slack]');check('slacking opens stock without skipping afternoon '+width,await page.locator('.market-desk').count()===1&&(await state()).dayRoutine.stage===3&&await page.locator('#desk-order [type=submit]').isEnabled());
  await page.locator('#desk-order [name=lots]').fill('1');await click('#desk-order [type=submit]');check('actual afternoon trade stays in session '+width,(await state()).positions.some(p=>p.kind==='stock')&&(await state()).dayRoutine.stage===3);
  if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.desk-quickbar [data-action=life-continue]');check('ending afternoon returns to life at close '+width,(await state()).dayRoutine.stage===4&&await page.locator('.daily-operation-dock').isVisible());
  await page.reload();await enter();check('completed shift persists '+width,(await state()).dayRoutine.stage===4&&(await state()).dayRoutine.choices[3]==='slack');
 }
 await page.setViewportSize({width:1440,height:900});await load(fixture(0));const opening=await state();
 for(const choice of ['breakfast','focus','nap','focus','stretch','rest','sleep']){await resolve();await click(`.daily-operation-dock [data-choice=${choice}]`);}
 let day=await state();check('full day closes wages bills and opens tomorrow once',day.debtClock.day===opening.debtClock.day+1&&day.survival.days===1&&day.dayRoutine.stage===0&&day.survival.livingAccrued===18000&&day.actionPoints===2);
 const saved=day.cash;await page.reload();await enter();check('reload does not rebill day',(await state()).cash===saved&&(await state()).survival.days===1);
 await load(fixture(1,0));await geometry('unemployed');const prior=await state();await click('.daily-operation-dock [data-choice=day_gig]');check('half day gig finishes at lunch and pays once',(await state()).dayRoutine.stage===2&&(await state()).cash>prior.cash&&(await state()).workday.units===1);
 for(const choice of ['accept','decline']){const s=fixture(5);s.dayRoutine.pending='overtime';await load(s);const cash=(await state()).cash;await click(`.daily-operation-dock [data-choice=${choice}]`);check('overtime '+choice,(await state()).dayRoutine.stage===(choice==='accept'?6:5)&&(await state()).cash-cash===(choice==='accept'?Math.min(2500,Math.floor(s.monthlyIncome/150)):0));}
 const late=fixture(6);await load(late);const wage=Math.floor(late.monthlyIncome/30);await click('.daily-operation-dock [data-choice=stay]');check('late night opens crypto at 02:00',(await state()).dayRoutine.stage===7&&await page.locator('.crypto-terminal').count()===1);await click('.desk-quickbar [data-action=life-continue]');day=await state();check('sleep settles once with night penalties',day.dayRoutine.stage===0&&day.dayRoutine.nightStreak===1&&day.survival.days===1&&day.survival.last.salary===wage&&day.stats.health===late.stats.health-1);
 // Events that arrive from activity completion get focus and block time until chosen.
 let eventStart;for(let i=0;i<100&&!eventStart;i++){const s=fixture(1,350000,'event-start-'+i);if(act(s,{type:'day_activity',choice:'focus'},catalog).dayRoutine.pending)eventStart=s;}
 await load(eventStart);await click('.daily-operation-dock [data-choice=focus]');check('new event focused in lower dock',await page.locator('#daily-event-title').isVisible()&&await page.evaluate(()=>document.activeElement.id==='daily-event-title')&&await page.locator('.daily-operation-dock [data-kind=day_activity]').count()===0);await resolve();check('event choice returns focus to current activities',await page.evaluate(()=>document.activeElement.dataset.kind==='day_activity'));
 check('no browser errors',errors.length===0);await writeFile(`${dir}/summary.json`,JSON.stringify({checks:checks.length,passed:checks,errors},null,2));console.log(`${checks.length} browser checks passed`);
}finally{await browser.close();}
