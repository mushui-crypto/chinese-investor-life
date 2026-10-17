import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {ensureRoutine,resetRoutineDay,DAILY_EVENTS} from '../src/game/day-routine.js';
import {act} from '../src/game/narrative.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.40/daily-event-dock',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const click=q=>page.locator(q+':visible').first().click(),check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function fixture(kind,cash=2e7,seed='daily-dock'){
 const s=createPlayableRun({seed,familyId:'F01',startAt:'adult'},catalog);
 const role=DAILY_EVENTS[kind]?.roles[0]||'employed',student=role==='student',retired=role==='retired',unemployed=role==='unemployed';
 Object.assign(s,{age:student?20:retired?67:25,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash,monthlyIncome:student||unemployed?0:300000,occupation:student?'大学生':retired?'退休':unemployed?'待业青年':'普通职员'});s.behavior.pending=null;s.lifeArcs.pending=null;
 s.education.college=student;s.flags.college_student=student;s.flags.college_not_admitted=!student;
 const stage=DAILY_EVENTS[kind]?.stages[0]||1;
 ensureRoutine(s);resetRoutineDay(s,stage);s.trading.phase=stage===1?0:stage===2?1:2;s.dayRoutine.pending=kind||null;
 const story=DAILY_EVENTS[kind];if(story?.chain&&story.storyStage!=='new')s.workStories={[story.chain]:{stage:story.storyStage,due:0}};
 return s;
}
async function enterLife(){await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');await page.locator('.daily-world img').evaluate(i=>i.decode());}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await enterLife();}
async function geometry(tag){
 const g=await page.evaluate(()=>{const box=q=>document.querySelector(q).getBoundingClientRect().toJSON(),dock=document.querySelector('.daily-operation-dock');return {dock:box('.daily-operation-dock'),nav:box('.bottom-nav'),stage:box('.game-scroll'),pageW:document.documentElement.scrollWidth,pageH:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight,y:scrollY,overflow:dock.scrollWidth>dock.clientWidth+1,gap:parseFloat(getComputedStyle(document.querySelector('.game-shell')).getPropertyValue('--panel-gap'))};});
 check('dock above nav and aligned '+tag,Math.abs(g.dock.x-g.nav.x)<1&&Math.abs(g.dock.width-g.nav.width)<1&&Math.abs(g.nav.y-g.dock.bottom-g.gap)<1);
 check('scene retains room '+tag,g.stage.height>0&&g.stage.bottom<=g.dock.y-g.gap+1);
 check('no page or horizontal overflow '+tag,!g.overflow&&g.pageW===g.w&&g.pageH===g.h&&g.y===0&&g.dock.y>=0);
 const first=page.locator('.daily-dock-event [data-kind=day_event_choice]').first();await first.scrollIntoViewIfNeeded();
 check('choice reachable '+tag,await first.evaluate(e=>{const r=e.getBoundingClientRect(),d=e.closest('.life-clockbar').getBoundingClientRect();return r.top>=d.top&&r.bottom<=d.bottom&&r.height>=44;}));
}
try{
 for(const [width,height] of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});
  for(const [kind,event] of Object.entries(DAILY_EVENTS)){
   await load(fixture(kind,kind==='coworker'?0:2e7));const tag=kind+' '+width;
   check('story and choices only in dock '+tag,await page.locator('.daily-operation-dock #daily-event-title').textContent()===event.title&&await page.locator('.daily-dock-event [data-kind=day_event_choice]').count()===event.choices.length&&await page.locator('.arrangement-panel [data-kind=day_event_choice]').count()===0);
   check('redundant continue and fast forward absent '+tag,await page.locator('.daily-operation-dock [data-action=life-continue],.daily-operation-dock [data-action=life-away]').count()===0);
   await geometry(tag);
   if(['deadline','study_group','old_colleague'].includes(kind))await page.screenshot({path:`${dir}/${kind}-${width}.png`});
   if(kind==='coworker'){
    await click('.daily-event-rescue');check('expense operation still opens '+width,await page.locator('#game-dialog .rescue-menu').count()===1);await click('[data-action=close-dialog]');
    check('closing expenses preserves event '+width,(await state()).dayRoutine.pending===kind);await page.locator('#toast.show').waitFor({state:'hidden'});await page.screenshot({path:`${dir}/coworker-${width}.png`});
   }
   const before=await state(),choice=event.choices[width===1440?0:1][0],expected=act(before,{type:'day_event_choice',choice},catalog);
   await click(`.daily-dock-event [data-choice=${choice}]`);const after=await state();
   check('choice outcome and clock unchanged '+tag,JSON.stringify(after.dayRoutine)===JSON.stringify(expected.dayRoutine)&&JSON.stringify(after.stats)===JSON.stringify(expected.stats)&&after.cash===expected.cash);
   check('returns to daily controls '+tag,after.dayRoutine.pending?await page.locator('.daily-dock-event').count()===1:await page.locator('.daily-dock-event').count()===0&&await page.locator('.daily-operation-dock .day-choices').count()===1&&await page.locator('.daily-arrangements .day-choices').count()===0);
   check('focus returns to current choices '+tag,await page.evaluate(()=>document.activeElement?.id==='daily-event-title'||document.activeElement?.dataset.action==='day-command'||document.activeElement?.dataset.action==='day-continue'));
   await page.reload();await enterLife();check('reload keeps resolved event '+tag,(await state()).dayRoutine.pending===after.dayRoutine.pending);
  }
 }
 for(const [width,height] of [[1280,600],[320,740],[844,390]]){await page.setViewportSize({width,height});await load(fixture('overtime',0));await geometry(width+'x'+height);await page.screenshot({path:`${dir}/overtime-${width}.png`});await click('.daily-dock-event [data-choice=accept]');check('long choice works '+width,(await state()).dayRoutine.stage===6);}
 // An event reached through actual time progression focuses the story, not a sidebar shortcut.
 await page.setViewportSize({width:1440,height:900});let start;
 for(let i=0;i<100;i++){const s=fixture(null,2e7,'dock-arrival-'+i);if(act(s,{type:'day_activity',choice:'focus'},catalog).dayRoutine.pending){start=s;break;}}
 assert.ok(start);await load(start);await click('.daily-operation-dock [data-choice=focus]');check('arriving event focuses title',await page.evaluate(()=>document.activeElement.id==='daily-event-title'));check('arriving event visibly highlights choices',await page.locator('.life-clockbar.is-highlighted').count()===1);
 // Other tabs retain their existing event dialog and resolve through the same action.
 await click('.bottom-nav [data-tab=market]');await click('.life-pace-actions [data-action=day-routine]');check('market event still available',await page.locator('#game-dialog [data-kind=day_event_choice]').count()===2);await click('#game-dialog [data-kind=day_event_choice]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');check('market resolution removes dock event',await page.locator('.daily-dock-event').count()===0);
 for(const [width,height] of [[1440,900],[390,844]]){
  await page.setViewportSize({width,height});await load(fixture(null));
  check('routine planning entry is clear '+width,(await page.locator('.daily-operation-dock [data-action=life-away]').textContent())==='按作息过日子');
  const before=await state(),expected=act(before,{type:'routine_days',days:30,evening:'rest',smallEvents:'pause'},catalog);await click('.daily-operation-dock [data-action=life-away]');await page.locator('#routine-days').selectOption('30');await click('#routine-plan-form [type=submit]');const after=await state();
  check('routine progresses through real activities and pauses for choices '+width,after.lastResult.routineRun.steps>0&&after.cash===expected.cash&&after.debtClock.day===expected.debtClock.day);
  check('routine gives actual stopping feedback '+width,(await page.locator('.routine-receipt').textContent()).includes(after.lastResult.routineRun.reason));
  await load(fixture('coworker',0));const pending=await state();await click('.bottom-nav [data-tab=market]');
  check('pending event hides misleading fast forward '+width,await page.locator('[data-action=life-away]').count()===0);
  check('event entry names the action '+width,(await page.locator('.life-pace-actions [data-action=life-continue]').textContent())==='查看当前事件');await click('.life-pace-actions [data-action=life-continue]');
  check('event entry opens choices without advancing '+width,await page.locator('#game-dialog [data-kind=day_event_choice]').count()===2&&(await state()).debtClock.day===pending.debtClock.day&&(await state()).cash===pending.cash);
  check('event entry gives explicit feedback '+width,(await page.locator('#toast').textContent()).includes('先选完当前事件'));
  await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');
  check('life event choices need no extra click '+width,await page.locator('.daily-dock-event [data-kind=day_event_choice]').count()===2);
  check('viewing event never auto selects '+width,(await state()).dayRoutine.pending==='coworker'&&(await state()).cash===pending.cash);
  await load(fixture(null,0));check('survival hides multi day fast forward '+width,await page.locator('[data-action=life-away]').count()===0);
  const slot=(await state()).dayRoutine.stage;await click('.daily-operation-dock [data-choice=focus]');check('survival still advances one time slot '+width,(await state()).dayRoutine.stage===slot+1);
 }
 check('no runtime errors',errors.length===0);await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors},null,2));console.log('TOTAL',checks.length);
}catch(e){await page.screenshot({path:dir+'/FAILURE.png'});await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors,error:e.stack},null,2));throw e;}finally{await browser.close();}
