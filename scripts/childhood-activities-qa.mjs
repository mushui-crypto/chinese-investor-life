import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,chooseEvent,eligibleChoices,continueStory,nextTurn} from '../src/game/narrative.js';
import {childhoodActivities,childhoodActivity} from '../src/game/childhood-activities.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const data=JSON.parse(await readFile(`data/${key}.json`));catalog[key]=key==='events'?data.events:data;}setSaveCatalog(catalog);
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const out='reports/v1.45/age-activities',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);},click=q=>page.locator(q+':visible').first().click(),saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').first().waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');}
async function shot(name){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});}
async function close(){if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('#game-dialog [data-action=close-dialog]');}
function step(s){if(s.phase==='event'){const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),c=eligibleChoices(s,e).find(c=>!c.disabled);return chooseEvent(s,e.id,c.id,catalog);}return s.phase==='result'?continueStory(s,catalog):nextTurn(s,catalog);}
const states={};let s=createRun({familyId:'F01',seed:'age-activities-ui'},catalog);for(let guard=0;s.age<=17&&guard<200;guard++){if(s.phase==='planning')states[s.age]??=structuredClone(s);s=step(s);}
try{
 for(const age of [1,2,3,5,6,11,12,14,15,17]){
  const state=states[age];assert.ok(state);await load(state);
  const labels=await page.locator('.arrangements .life-action strong').allTextContents();
  check(`${age}: buttons match age`,JSON.stringify(labels)===JSON.stringify(childhoodActivities(state).map(a=>a.label)));
  check(`${age}: no generic adult activities`,!labels.some(t=>/学点本事|见见朋友|打工/.test(t)));
  if(age<6)check(`${age}: no personal money`,await page.locator('[data-cash-balance]').count()===0);
  if([1,3,6,12,15].includes(age))await shot(`age-${age}`);
 }
 for(const type of ['study','rest','social']){
  const state=states[1];await load(state);const before=await saved();await click(`.arrangements [data-type=${type}]`);const after=await saved();
  check(`one: ${type} applies the matching result`,after.lastResult.title===childhoodActivity(state,type).title&&after.actionPoints===before.actionPoints-1);
  check(`one: ${type} has no adult skills or cash`,after.stats.skill===before.stats.skill&&after.stats.fame===before.stats.fame&&after.cash===0);
  await close();await page.reload();await click('[data-action=load-slot]');check(`one: ${type} survives reload without replay`,(await saved()).actionPoints===after.actionPoints&&(await saved()).stats.skill===after.stats.skill);
 }
 await page.setViewportSize({width:390,height:844});await load(states[1]);
 check('mobile: no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await click('.arrangements [data-type=study]');await close();await click('.arrangements [data-type=rest]');await close();
 check('mobile: both choices apply and third is disabled',(await saved()).actionPoints===0&&await page.locator('.arrangements [data-type=social]').isDisabled());
 await page.locator('.arrangements').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await shot('one-mobile');
 await load(states[1]);await click('.childhood-path>summary');check('one: growth preferences use child language',!(await page.locator('.child-growth-body').innerText()).match(/打工|交易纪律|亲友往来|读书求知/));
 check('no browser errors',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log(`${checks.length} age activity checks passed`);
}catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
