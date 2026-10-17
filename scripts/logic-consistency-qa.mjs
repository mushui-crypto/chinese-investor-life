import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {act} from '../src/game/narrative.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.37/logic-browser',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click();
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(wage=300000,stage=1){const s=createPlayableRun({seed:'logic-ui',familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:1000000,monthlyIncome:wage,occupation:wage?'普通职员':'待业青年'});s.stats.skill=50;s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','disclosure','promise_due','response'];s.behavior.pending=null;ensureRoutine(s);resetRoutineDay(s,stage);s.trading.phase=stage>=4?2:0;return s;}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');}
async function unfold(){await click('.extra-arrangements > summary');}
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await load(adult());await unfold();
  check('fixed job blocks daytime gig '+width,await page.locator('[data-type=work]').isDisabled()&&(await page.locator('[data-type=work]').innerText()).includes('固定工作'));
  await load(adult(300000,5));await click('.daily-arrangements [data-choice=night_gig]');let s=await state();
  check('evening shift pays 50 and ends at 22:30 '+width,s.cash===1005000&&s.dayRoutine.stage===6&&s.workday.units===1&&s.behavior.fatigue===12);
  check('no second evening arrangement '+width,await page.locator('.daily-arrangements [data-choice=friends]').count()===0);
  check('evening scene follows the paid work '+width,await page.locator('.daily-stage').getAttribute('data-scene')==='gig');
  check('one visible balance '+width,await page.locator('[data-cash-balance]:visible').count()===1);
  check('evening layout fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&await page.locator('.daily-arrangements').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:dir+'/evening-'+width+'.png'});
  await page.reload();await click('[data-action=load-slot]');check('night work persists without second payout '+width,(await state()).cash===1005000&&(await state()).dayRoutine.stage===6);
  await load(adult(0));await unfold();await click('[data-type=work]');s=await state();
  check('full-day work advances to evening '+width,s.cash===1010000&&s.dayRoutine.stage===5&&s.trading.phase===2&&s.workday.units===2&&s.survival.days===0);
  check('day job uses actual work scene '+width,await page.locator('.daily-stage').getAttribute('data-scene')==='gig');
  const closed=act(adult(0),{type:'calendar_day'},catalog);closed.cash=0;closed.survival.active=true;closed.behavior.pending=null;await load(closed);await unfold();check('closed day cannot be worked '+width,await page.locator('[data-type=work]').isDisabled());
  await click('.life-pace-actions [data-action=life-continue]');s=await state();check('rescue opens tomorrow without a second bill '+width,s.dayRoutine.stage===0&&s.survival.days===1&&s.cash===0);
  if(await page.locator('.extra-arrangements').getAttribute('open')===null)await unfold();check('new day has a usable work entrance '+width,await page.locator('[data-type=work]').isEnabled());
  await page.screenshot({path:dir+'/rescue-'+width+'.png'});
 }
 check('no runtime errors',errors.length===0);await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
