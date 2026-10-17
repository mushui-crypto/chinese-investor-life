import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {skipBirth,continueChildhood} from '../src/game/childhood.js';
import {chooseEvent,continueStory,eligibleChoices,nextTurn} from '../src/game/narrative.js';
import {setSaveCatalog,encodeSave} from '../src/game/storage.js';
import {chooseGameOption} from './game-control-helpers.mjs';
const catalog={};for(const key of ['events','families','characters','history','endings']){const data=JSON.parse(await readFile(`data/${key}.json`));catalog[key]=key==='events'?data.events:data;}setSaveCatalog(catalog);
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const url=process.env.GAME_URL||'http://127.0.0.1:4174',out=process.env.QA_REPORT_DIR||'reports/v1.45/childhood-planning';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1872,height:1200},reducedMotion:'reduce'}),checks=[],errors=[],measurements=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);},click=q=>page.locator(q+':visible').first().click(),saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').first().waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');}
async function shot(name){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});}
function resolve(s){for(let n=0;n<30&&s.phase!=='planning';n++){if(s.phase==='result')s=continueStory(s,catalog);else{const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),choice=eligibleChoices(s,e).find(c=>!c.disabled);s=chooseEvent(s,e.id,choice.id,catalog);}}assert.equal(s.phase,'planning');return s;}
const options={seed:'child-planning-qa',familyId:'F01',startAt:'birth'},oneEvent=skipBirth(createPlayableRun(options,catalog),catalog);
try{
 await load(oneEvent);check('story has no stage action dock',await page.locator('.childhood-operation-dock').count()===0);
 for(let n=0;n<30&&(await saved()).phase!=='planning';n++){if((await saved()).phase==='event')await click('.choice:not(:disabled)');else await click('[data-action=continue]');}
 const one=await saved();check('real event -> result -> planning stays at kindergarten',one.age===3&&one.phase==='planning');
 check('empty planning panel and duplicate right-side actions removed',await page.locator('.story-panel.child-planning').count()===0&&await page.locator('.arrangement-panel [data-action=life-action]').count()===0&&await page.locator('[data-action=life-action]').count()===3);
 check('growth settings appear once in right rail',await page.locator('.arrangement-panel .childhood-path').count()===1&&await page.locator('#child-focus').count()===1);
 check('preschool wallet and adult sprite remain absent',await page.locator('[data-cash-balance],.world-scene-child').count()===0);
 check('stage information is above controls',await page.locator('.childhood-operation-heading').evaluate(e=>e.getBoundingClientRect().bottom<=e.parentElement.querySelector('.childhood-operation-actions').getBoundingClientRect().top));
 check('three activities use shared game buttons',await page.locator('.childhood-operation-dock .button[data-action=life-action]').count()===3);
 check('stage-end control names its destination and unused arrangements',/上小学.*6 岁/.test((await page.locator('[data-action=life-continue]').innerText()).replace(/\s+/g,' '))&&await page.locator('#childhood-unused-actions').innerText()==='剩余精力不带入下一阶段');
 check('stage-end control sits below the activity group',await page.locator('.childhood-activity-buttons').evaluate(e=>e.getBoundingClientRect().bottom<e.parentElement.querySelector('.childhood-stage-end').getBoundingClientRect().top));
 await shot('one-planning-desktop');
 await click('[data-type=study]');let next=await saved();check('blocks cost exactly one action and change insight',next.actionPoints===one.actionPoints-1&&next.stats.insight>one.stats.insight&&next.cash===0);
 check('one energy remains without hiding the stage hint',await page.locator('#childhood-unused-actions').innerText()==='剩余精力不带入下一阶段');
 check('activity feedback stays in dock with no modal',await page.locator('.childhood-feedback').innerText()===next.lastResult.text&&!await page.locator('#game-dialog').evaluate(d=>d.open));
 await click('[data-type=rest]');next=await saved();check('outdoor play consumes final energy and preserves age-appropriate scene',next.actionPoints===0&&await page.locator('.childhood-stage').getAttribute('data-scene')==='preschool-home');
 check('exhausted choices disable but growth remains enabled',await page.locator('.childhood-activity:disabled').count()===3&&await page.locator('.childhood-operation-dock [data-action=life-continue]').isEnabled());
 check('no unused-arrangements warning after using both',await page.locator('#childhood-unused-actions').count()===0);
 await shot('one-nap-desktop');await page.reload();await click('[data-action=load-slot]');check('reload preserves actions, stats, RNG and nap',JSON.stringify((await saved()).stats)===JSON.stringify(next.stats)&&(await saved()).rng===next.rng&&(await saved()).actionPoints===0&&await page.locator('.childhood-stage').getAttribute('data-scene')==='preschool-home');
 await click('.childhood-operation-dock [data-action=life-continue]');check('growth stops at next stage story',(await saved()).age===6&&(await saved()).phase==='event'&&await page.locator('.childhood-operation-dock').count()===0);
 for(const remaining of [2,1]){
  await load(one);if(remaining===1)await click('[data-type=study]');
  const before=await saved(),expected=nextTurn(before,catalog);
  await click('[data-action=life-continue]');const after=await saved();
  check(`${remaining} unused: end stage without extra activity, preserve normal settlement`,after.age===6&&after.actionPoints===2&&after.runStats.actions===before.runStats.actions&&JSON.stringify(after.stats)===JSON.stringify(expected.stats)&&after.rng===expected.rng&&after.cash===expected.cash);
  check(`${remaining} unused: next story opens without confirmation dialog`,after.phase==='event'&&!await page.locator('#game-dialog').evaluate(d=>d.open));
 }
 for(const [width,height] of [[1440,1000],[900,1000],[390,844],[390,650],[320,740]]){
  await page.setViewportSize({width,height});await load(one);await page.evaluate(()=>document.fonts.ready);
  const bounds=await page.evaluate(()=>{const dock=document.querySelector('.childhood-operation-dock').getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();return {dock:dock.toJSON(),nav:nav.toJSON(),noOverflow:document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight,reachable:[...document.querySelectorAll('.childhood-operation-dock button')].every(b=>{const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),scrollHeight:document.querySelector('.game-scroll').clientHeight};});measurements.push({width,height,...bounds});
  check(`${width}x${height}: no page overflow and nav below dock`,bounds.noOverflow&&bounds.dock.bottom<bounds.nav.top&&bounds.dock.top>0);
  check(`${width}x${height}: all actions clickable, content remains scrollable`,bounds.reachable&&bounds.scrollHeight>40);await shot(`one-${width}x${height}`);
  check(`${width}x${height}: activity and stage-end rows stay separate`,await page.locator('.childhood-activity-buttons').evaluate(e=>e.getBoundingClientRect().bottom<e.parentElement.querySelector('.childhood-stage-end').getBoundingClientRect().top));
  await click('[data-type=study]');check(`${width}x${height}: action still works`,(await saved()).actionPoints===1);
 }
 await page.setViewportSize({width:1440,height:1000});await load(one);await click('.childhood-path>summary');await chooseGameOption(page,'#child-focus','social');check('growth preference saves without action/cash/RNG mutation',(await saved()).childhood.focus==='social'&&(await saved()).actionPoints===one.actionPoints&&(await saved()).rng===one.rng&&(await saved()).cash===one.cash);
 await click('.childhood-path>summary');await click('.bottom-nav [data-tab=people]');check('leaving life removes dock',await page.locator('.childhood-operation-dock').count()===0);await click('.bottom-nav [data-tab=life]');check('return restores same choices',await page.locator('.childhood-operation-dock').count()===1&&(await saved()).actionPoints===one.actionPoints);
 let older=one;for(const age of [3,6,12]){while(older.age<age)older=resolve(continueChildhood(older,catalog));await load(older);check(`age ${age}: three correct activities and a single growth control`,await page.locator('.childhood-activity').count()===3&&await page.locator('[data-action=life-continue]').count()===1);if(age===3){check('preschool has its older child scene',await page.locator('.childhood-stage').getAttribute('data-scene')==='preschool-home');await shot('three-planning');}if(age===12)check('teen secondhand market remains accessible',await page.locator('#child-market-form').count()===1&&await page.locator('#child-focus').count()===1);}
 await load(createPlayableRun({...options,startAt:'adult'},catalog));if(await page.locator('#game-dialog').evaluate(d=>d.open))await click('#game-dialog [data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');check('adult daily scene and operation dock unaffected',await page.locator('.daily-stage').count()===1&&await page.locator('.daily-operation-dock').count()===1&&await page.locator('.childhood-operation-dock,.childhood-world').count()===0);
 check('no browser errors',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,measurements,errors},null,2));console.log(`${checks.length} childhood planning checks passed`);
}catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,measurements,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
