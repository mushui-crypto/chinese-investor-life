import {openLifeEntry} from './life-entry-helpers.mjs';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,act,nextTurn,chooseEvent,continueStory,eligibleChoices,settleRun} from '../src/game/narrative.js';
import {getActionAvailability,PRODUCTS} from '../src/game/core.js';
import {setSaveCatalog,encodeSave} from '../src/game/storage.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const catalog={};for(const n of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${n}.json`));catalog[n]=n==='events'?d.events:d;}setSaveCatalog(catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.11/browser',url=process.env.GAME_URL||'http://127.0.0.1:4173';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[],routes=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
const click=sel=>page.locator(sel+':visible').first().click();
const close=async()=>{if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');};
function adult({cash=10000000,wage=400000,seed='global-browser',released=false}={}){const s=createRun({seed,familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:wage,giftReceived:true});s.stats.insight=90;s.stats.skill=60;s.stats.trust=60;s.flags.ever_released=released;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};s.lifeArcs=newLifeArcs(s);return s;}
async function load(s){await page.goto(url);await page.locator('#app button').first().waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');}
let tally;
async function step(category,selector){const start=performance.now();if(selector==='[data-action=life-rebuild]')await openLifeEntry(page,'life-rebuild');else await click(selector);const ms=performance.now()-start;tally[category]??={actions:0,milliseconds:0};tally[category].actions++;tally[category].milliseconds+=ms;}
async function resolveDialog(){if(!await page.locator('#game-dialog').evaluate(e=>e.open))return false;
 const choices=page.locator('#game-dialog [data-action=life-command]:not([disabled]),#game-dialog [data-action=behavior-do]:not([disabled])');
 if(await choices.count())await step('story','#game-dialog [data-action=life-command]:not([disabled]),#game-dialog [data-action=behavior-do]:not([disabled])');
 else await step('navigation','[data-action=close-dialog]');return true;
}
try{
 let s=adult({cash:30000000});s.lifeArcs.pending='comfort';await load(s);tally={};await step('story','[data-action=life-continue]');check('unified continue opens a pending life decision',await page.locator('#game-dialog').innerText().then(t=>t.includes('好日子')));await click('[data-action=life-command][data-command*="upgrade"]');await close();check('lifestyle choice persists its monthly obligation',(await current()).lifeArcs.lifestyle===120000);
 await click('[data-action=tab][data-tab=people]');await click('[data-action=life-command][data-command*="N04"]');await close();check('NPC visit displays a real shared memory',await page.locator('.person-memory').allTextContents().then(xs=>xs.some(x=>x.includes('宽裕'))));
 await click('[data-action=life-rebuild]');check('six differentiated rebuilding opportunities',await page.locator('.life-offer').count()===6);await close();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await click('[data-action=life-rebuild]');check('rebuild dialog fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#game-dialog').scrollWidth<=document.querySelector('#game-dialog').clientWidth+1));await page.screenshot({path:`${out}/rebuild-${width}.png`});await close();check('people page fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.setViewportSize({width:1440,height:1000});
 for(const route of ['steady','aggressive','rebuild']){
  const initial=route==='rebuild'?adult({cash:0,wage:0,released:true,seed:route}):adult({cash:10000000,seed:route});await load(initial);tally={};const begun=performance.now();
  if(route==='rebuild'){
   await close();await step('navigation','[data-action=life-rebuild]');await step('life','[data-action=life-command][data-command*="shift"]');await close();await step('navigation','[data-action=life-rebuild]');await step('life','[data-action=life-command][data-command*="reentry"]');await close();
  }else{await step('navigation','[data-action=tab][data-tab=market]');await step('navigation','[data-action=invest][data-product=stock]');}
  let trades=0,lastDay=-1,iterations=0;
  for(;iterations<85;iterations++){
   if(await resolveDialog())continue;
   const st=await current();if(st.phase==='ended')break;if(st.age>initial.age)break;
   if(st.phase==='event'){await step('story','[data-action=choose]:not([disabled])');continue;}
   if(st.phase==='result'){await step('story','[data-action=continue]');continue;}
   if(route==='rebuild'&&st.monthlyIncome>0&&st.debtClock.day>=4)break;
   if(route!=='rebuild'&&st.trading.phase<3&&st.trading.energy>0&&st.trading.day!==lastDay){
    // One real buy each featured day; aggression uses larger exposure.
    const form=page.locator('#desk-order');if(await form.count()){
     await page.locator('[name=lots]').fill(route==='aggressive'?'15':'1');await step('market','#desk-order [type=submit]');trades++;lastDay=st.trading.day;continue;
    }
   }
   const category=st.lifeArcs?.pending||st.behavior?.pending?'story':route==='rebuild'?'life':st.trading.phase<3||st.trading.dayInTurn<2?'market':'life';
   await step(category,'[data-action=life-continue]');
  }
  const end=await current();check(route+' route made progress without a blocked continue',route==='rebuild'?end.monthlyIncome>=280000&&!end.survival.failed:end.age>initial.age);if(route!=='rebuild')check(route+' executed actual orders',trades>=1);
  const total=Object.values(tally).reduce((n,x)=>n+x.actions,0),decisions=total-(tally.navigation?.actions||0);routes.push({route,initialAge:initial.age,finalAge:end.age,gameDays:end.debtClock.day,iterations,cash:end.cash,wage:end.monthlyIncome,tally,marketShareOfDecisions:(tally.market?.actions||0)/Math.max(1,decisions),wallMs:performance.now()-begun});await page.screenshot({path:`${out}/${route}.png`});
 }
 s=adult();s.age=56;s.lifeArcs=newLifeArcs(s);await load(s);await click('[data-action=tab][data-tab=life]');await openLifeEntry(page,'goals');await click('[data-goal=legacy]');await click('.goal-panel [data-action=guide-route]');await click('[data-action=life-command][data-command*=life_succession]');await close();check('late-life goal can be completed through the actual UI without marriage',(await current()).lifeArcs.inheritance===true&&(await current()).household.hasChild===false);await click('[data-action=life-hub]');await click('[data-action=life-collection]');check('collection shows encountered entries only',await page.locator('#game-dialog').innerText().then(t=>t.includes('交接')&&!t.includes('终于能过点好日子')));await close();await page.locator('.life-notebook>summary').focus();await page.keyboard.press('Enter');check('secondary notebook can be toggled by keyboard',!await page.locator('.life-notebook').evaluate(e=>e.open));await page.keyboard.press('Enter');check('keyboard can restore goal choices',await page.locator('.life-notebook').evaluate(e=>e.open));s=settleRun(await current(),catalog);await load(s);check('ending renders a personal, factual life statement',await page.locator('.life-audit').innerText().then(t=>t.includes('实际支付利息')&&t.includes('吴师傅')));const download=page.waitForEvent('download');await click('[data-action=export-journal]');const file=await download;await file.saveAs(`${out}/life-journal.md`);check('journal exports life statement',String(await readFile(`${out}/life-journal.md`)).includes('这一生的钱与人'));
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});check('personal ending fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/ending-${width}.png`,fullPage:true});}
 check('no browser runtime errors',errors.length===0);
}catch(e){errors.push(e.stack);console.error(e);await page.screenshot({path:`${out}/failure.png`});process.exitCode=1;}finally{await writeFile(`${out}/report.json`,JSON.stringify({passed:!errors.length,checks,errors,routes,method:'真实浏览器控件点击；时间为自动化点击和渲染等待，不含人的阅读思考，不能证明玩家投入时长达到 70%。三条路线的偏好有意不同，求生不强制参与市场。'},null,2));await browser.close();}
