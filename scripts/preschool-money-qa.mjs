import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,chooseEvent,eligibleChoices,continueStory,nextTurn} from '../src/game/narrative.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const catalog={};for(const key of ['events','families','characters','history','endings']){const data=JSON.parse(await readFile(`data/${key}.json`));catalog[key]=key==='events'?data.events:data;}setSaveCatalog(catalog);
const out='reports/v1.45/preschool-money',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
const click=s=>page.locator(s+':visible').first().click();
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').first().waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');}
async function shot(name){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled'});}
function step(s){if(s.phase==='event'){const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),c=eligibleChoices(s,e).find(c=>!c.disabled);return chooseEvent(s,e.id,c.id,catalog);}return s.phase==='result'?continueStory(s,catalog):nextTurn(s,catalog);}
const states={};let s=createRun({familyId:'F05',seed:'preschool-ui'},catalog);for(let guard=0;s.age<=6&&guard<80;guard++){states[s.age]??=structuredClone(s);s=step(s);}
try{
 for(const age of [1,5]){
  await page.setViewportSize({width:1440,height:1000});await load(states[age]);
  check(`${age}: no cash, personal ledger, family balance or asset entry`,await page.locator('[data-cash-balance],.pocket-book,.family-line,[data-tab=assets]').count()===0);
  check(`${age}: actual saved cash remains zero`,(await saved()).cash===0);
  check(`${age}: free childhood choices have no generic footnotes`,await page.locator('.choice-content small').count()===0);
  await shot(`age-${age}-desktop`);await click('[data-action=character]');
  check(`${age}: character dialog has no wallet`,await page.locator('dialog[open] .pocket-book,dialog[open] [data-cash-balance],dialog[open] .family-line').count()===0);
  await click('[data-action=close-dialog]');
  await page.setViewportSize({width:390,height:844});
  check(`${age}: mobile has no allowance balance`,await page.locator('.mobile-summary [data-cash-balance]').count()===0);
  check(`${age}: mobile navigation forms two complete rows`,await page.locator('.bottom-nav').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length===3));
  check(`${age}: mobile remains within viewport`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(`age-${age}-mobile`);
 }
 await page.setViewportSize({width:1440,height:1000});await load(states[6]);
 check('six: first allowance and ledger appear',await page.locator('.status-rail .pocket-book').count()===1&&(await saved()).cash>0);
 check('six: assets navigation restored',await page.locator('.bottom-nav [data-tab=assets]').count()===1);
 await click('.bottom-nav [data-tab=assets]');check('six: assets route opens',await page.locator('.main-stage').innerText().then(t=>t.includes('现金')));
 await click('.bottom-nav [data-tab=life]');await shot('age-6-desktop');
 const before=await saved();await page.reload();await click('[data-action=load-slot]');check('six: reload never pays allowance twice',(await saved()).cash===before.cash&&(await saved()).ledger.length===before.ledger.length);
 const legacy=structuredClone(states[1]);legacy.cash=12395;legacy.ledger.push({id:'legacy-cash',age:1,turn:legacy.turn,account:'cash',amount:12395,label:'成长阶段零花钱'});await load(legacy);
 check('old preschool save is normalized and persisted',(await saved()).cash===0&&(await saved()).familyReserve===legacy.familyReserve+12395);
 await click('.choice');check('cashless story choice still responds',(await saved()).phase==='result');
 check('no browser or asset errors',errors.length===0);
 await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log(`${checks.length} browser checks passed`);
}catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
