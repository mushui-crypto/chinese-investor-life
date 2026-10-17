import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun} from '../src/game/narrative.js';
import {setSaveCatalog,encodeSave} from '../src/game/storage.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const data=JSON.parse(await readFile(`data/${key}.json`));catalog[key]=key==='events'?data.events:data;}setSaveCatalog(catalog);
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const url=process.env.GAME_URL||'http://127.0.0.1:4174',out='reports/v1.45/childhood-detail';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(n,c)=>{assert.ok(c,n);checks.push(n);},click=q=>page.locator(q+':visible').first().click(),saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function stateFor(id){const e=catalog.events.find(e=>e.id===id),s=createRun({seed:'child-detail-qa',familyId:'F01'},catalog);Object.assign(s,{age:e.age_min,phase:'event',eventQueue:[],dueAnchors:[],activeEvent:{eventId:id,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))}});return s;}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').first().waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');}
async function shot(name){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});}
try{
 for(const id of ['AGE01B','AGE02A','AGE03B','AGE04A','AGE05A','AGE07A','AGE08B','AGE10B','AGE12B','AGE14A','YOU08']){
  const s=stateFor(id),e=catalog.events.find(e=>e.id===id);await load(s);
  check(`${id}: updated story and choices visible`,(await page.locator('.story-panel').innerText()).includes(e.title)&&await page.locator('[data-action=choose]:visible').count()===3);
  if(s.age<6){
   check(`${id}: no cash balance`,await page.locator('[data-cash-balance]').count()===0);
   check(`${id}: no academic or adult finance stats in preschool`,!(await page.locator('.status-rail').innerText()).match(/学业|谋生本事|江湖名气|信用/));
   check(`${id}: child artwork fills a 3:1 frame`,await page.locator('.story-panel .event-illustration img').evaluate(i=>{const r=i.parentElement.getBoundingClientRect();return i.complete&&i.naturalWidth/i.naturalHeight===3&&Math.abs(r.width/r.height-3)<.01&&getComputedStyle(i).objectFit==='cover'&&/toddler-play|preschool-play/.test(i.src);}));
  }
  if(s.age<3)check(`${id}: no older standing child`,await page.locator('.world-scene-child').count()===0&&await page.locator('.player-profile .toddler-portrait').count()===1);
  if(['AGE01B','AGE03B','AGE05A','AGE14A'].includes(id))await shot(id);
 }
 for(let i=0;i<3;i++){
  const s=stateFor('AGE01B'),e=catalog.events.find(e=>e.id==='AGE01B');await load(s);const before=await saved();await click(`[data-choice="${e.choices[i].id}"]`);const after=await saved();
  check(`one: choice ${i+1} shows new result and records once`,after.storyHistory.at(-1).text===e.choices[i].outcomes[0].text&&after.seenEvents.filter(id=>id===e.id).length===1);
  check(`one: choice ${i+1} does not train academic or job skills`,after.cash===0&&after.stats.academic===before.stats.academic&&after.stats.skill===before.stats.skill);
  await page.reload();await click('[data-action=load-slot]');check(`one: choice ${i+1} persists without replay`,(await saved()).seenEvents.filter(id=>id===e.id).length===1);
 }
 await page.setViewportSize({width:390,height:844});await load(stateFor('AGE01B'));check('mobile: no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('one-mobile');
 await click('[data-choice="AGE01B_1"]');check('mobile: toddler result can continue',await page.locator('[data-action=continue]:visible').count()===1);await click('[data-action=continue]');check('mobile: returns to age-specific arrangements',await page.locator('.childhood-operation-dock [data-type=study]').innerText().then(t=>t.includes('摆弄积木')));
 const six=stateFor('MAIN02');six.cash=100;await load(six);await click('[data-choice="MAIN02_1"]');check('six: buying deducts one yuan',(await saved()).cash===0);
 check('no browser errors',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log(`${checks.length} childhood detail checks passed`);
}catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
