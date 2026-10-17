import {applyEffects,applyAction} from '../src/game/core.js';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {act} from '../src/game/narrative.js';
import {PRODUCTS,getLoanOffer} from '../src/game/core.js';
import {resetGameCalendar} from '../src/game/game-calendar.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.34/hourly-browser',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1920,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);};
const click=q=>page.locator(q+':visible').first().click(),state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(){const s=createPlayableRun({seed:'life-layout',familyId:'F08',startAt:'adult'},catalog);Object.assign(s,{age:18.5,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:7487116,monthlyIncome:565000,giftReceived:true,presentations:[]});s.turn++;resetGameCalendar(s);s.lifeArcs.pending=null;s.behavior.pending=null;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};delete s.dayRoutine;s.journey.lastAction='desk_sell';s.lastResult={title:'市场操作已记录',text:'巷里百货实际到账 51295.2 元，已扣除退出费用。',changes:[{label:'现金',value:5129520},{label:'净资产',value:-10280}]};return s;}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');}
async function close(){if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');}

page.setDefaultTimeout(10000);
async function lifeEntry(action){
 await close();await click('.bottom-nav [data-tab=life]');
 if(!await page.locator(`[data-action=${action}]:visible`).count())await click('.life-notebook > summary');
 await click(`[data-action=${action}]`);
}
function withDebt(){return applyEffects(adult(),[{op:'loan',principal_yuan:3600,apr_bps:1200,term_months:12,purpose:'approved_use'}],{profile:'bank'}).state;}
async function inspect(name,width){
 await page.locator('#game-dialog[open]').waitFor();
 const rect=await page.locator('#game-dialog').boundingBox();
 check(name+' frame fits '+width,rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=(width<700?844:1000)+1);
 const overflow=await page.locator('.dialog-body').evaluate(e=>({w:e.clientWidth,sw:e.scrollWidth,scroll:e.scrollHeight>e.clientHeight}));
 check(name+' content fits '+width,overflow.sw<=overflow.w+1);
 check(name+' no text-only action '+width,await page.locator('#game-dialog button.text-button').count()===0);
 const top=(await page.locator('.dialog-head').boundingBox()).y;
 await page.locator('.dialog-body').evaluate(e=>e.scrollTop=e.scrollHeight);
 check(name+' header stays '+width,(await page.locator('.dialog-head').boundingBox()).y===top);
 await page.locator('.dialog-body').evaluate(e=>e.scrollTop=0);
 if([1920,390].includes(width))await page.screenshot({path:dir+'/'+name+'-'+width+'.png'});
}

try{
 for(const width of [1920,1440,1024,768,390,320]){
  await page.setViewportSize({width,height:width<700?844:1000});await load(adult());
  check('life clock and separate pacing '+width,await page.locator('.life-pace-actions [data-action=day-routine]').count()===1&&await page.locator('.life-pace-actions [data-action=life-away]').count()===1);
  await click('.daily-arrangements [data-action=day-rules]');await inspect('daily-status',width);await close();await click('.daily-arrangements [data-action=day-command][data-choice=focus]');
  check('work choice applies skill and persists '+width,(await state()).dayRoutine.choices[1]==='focus'&&(await state()).stats.skill===66);await close();
  await click('.bottom-nav [data-tab=market]');
  for(const key of ['stock','fund','bond','option','futures','crypto','ponzi','angel','housing','gambling']){
   await click(`.market-row[data-market=${key}] [data-action=${key==='gambling'?'desk-open':'invest'}]`);
   const head=page.locator('.market-heading');
   check(key+' one shared heading '+width,await head.count()===1&&await head.locator('h1').count()===1&&await page.locator('.desk-title,.terminal-top,.casino-heading').count()===0);
   check(key+' heading and toolbar fit '+width,await head.evaluate(e=>e.scrollWidth<=e.clientWidth+1)&&await page.locator('.desk-quickbar').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   const type=await head.locator('h1').evaluate(e=>({size:parseFloat(getComputedStyle(e).fontSize),weight:getComputedStyle(e).fontWeight}));check(key+' type scale '+width,type.size===(width<=760?18:20)&&type.weight==='700');
   check(key+' switch and info present '+width,await head.locator('.game-select-trigger').count()===1&&await head.locator('.info-button').count()===1);
   if([1920,390].includes(width)&&['stock','fund','crypto','gambling'].includes(key))await page.screenshot({path:dir+'/'+key+'-'+width+'.png'});
   if(key==='crypto'){const tone=await page.locator('.pace-away').evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));check('crypto secondary button uses readable dark-theme colors '+width,tone.fg==='rgb(241, 229, 205)'&&tone.bg==='rgb(52, 59, 66)');}
   if(key==='option'){
    await click('[data-action=option-side][data-product=option_short]');check('option seller shares heading '+width,(await head.locator('h1').innerText()).includes('期权交易室'));
   }
   await click('.trade-toolbar [data-action=desk-back]');
  }
 }
 await page.setViewportSize({width:1440,height:1000});await load(adult());
 // Walk the actual UI through lunch and A-share closure, then trade crypto at night.
 await click('.bottom-nav [data-tab=market]');await click('.market-row[data-market=stock] [data-action=invest]');
 await click('.trade-toolbar [data-action=life-continue]');
 const resolve=async()=>{if((await state()).dayRoutine?.pending){await click('.trade-toolbar [data-action=day-routine]');await page.locator('[data-action=day-command]').last().click();await close();}await close();};await resolve();
 check('lunch blocks A-share buy',await page.locator('#desk-order [type=submit]').isDisabled()&&(await page.locator('.form-error').innerText()).includes('午休'));
 await click('.trade-toolbar [data-action=life-continue]');await resolve();check('13:00 reopens A-share buy',await page.locator('#desk-order [type=submit]').isEnabled());
 await click('.trade-toolbar [data-action=life-continue]');await resolve();check('15:00 blocks A-share buy',await page.locator('#desk-order [type=submit]').isDisabled());
 await click('.trade-toolbar [data-action=desk-back]');await click('.market-row[data-market=crypto] [data-action=invest]');check('crypto remains tradable at 15:00',await page.locator('#desk-order [type=submit]').isEnabled());
 for(let i=0;i<2;i++){await click('.trade-toolbar [data-action=life-continue]');await resolve();}
 await click('.trade-toolbar [data-action=day-routine]');await click('[data-action=day-command][data-choice=stay]');check('night choice moves clock to 02:00',(await state()).dayRoutine.stage===7);await close();
 const before=await state();await click('.trade-toolbar [data-action=life-continue]');await close();const after=await state();check('sleep settles once and carries fatigue into next day',after.debtClock.day===before.debtClock.day+1&&after.dayRoutine.stage===0&&after.dayRoutine.nightStreak===1&&after.behavior.fatigue>before.behavior.fatigue);
 const snapshot=JSON.stringify(await state());await page.reload();await click('[data-action=load-slot]');check('daily clock and fatigue survive reload',JSON.stringify(await state())===snapshot);
 await load(adult());await click('.life-pace-actions [data-action=life-away]');check('fast life still advances and stops for messages',(await state()).debtClock.day>0||Boolean((await state()).behavior.pending||(await state()).lifeArcs.pending));
 check('no runtime errors',errors.length===0);await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors},null,2));console.log('TOTAL',checks.length);
}finally{await browser.close();}
