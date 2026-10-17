import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {eligibleChoices} from '../src/game/narrative.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
import {PRODUCTS} from '../src/game/core.js';
import {previewChoice} from '../src/game/experience.js';
import {advanceBirthPage} from '../src/game/birth-story.js';
const catalog={};for(const key of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${key}.json`));catalog[key]=key==='events'?d.events:d;}setSaveCatalog(catalog);
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const out='reports/v1.45/option-copy',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);},click=q=>page.locator(q+':visible').first().click();
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');}
function adult(){const s=createPlayableRun({seed:'option-copy',familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:100000000,monthlyIncome:350000,occupation:'普通职员'});s.stats.insight=90;s.stats.credit=90;s.behavior.pending=null;s.lifeArcs.pending=null;s.marketProgress={firstExperienceAge:18,simulations:0,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
function story(e){const s=adult();s.age=Math.max(18,e.age_min);s.phase='event';s.activeEvent={eventId:e.id,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))};s.seenEvents=s.seenEvents.filter(id=>id!==e.id);return s;}
try{
 const birth=advanceBirthPage(advanceBirthPage(createPlayableRun({seed:'birth-copy',familyId:'F01'},catalog),0),1);await load(birth);
 check('birth choices show actions without generic attribute promises',await page.locator('.birth-choices .choice').count()===3&&await page.locator('.birth-choices small').count()===0);
 const profiles=['self_study','rest','family','work','repair','observe'];
 for(const profile of profiles){
  const e=catalog.events.find(e=>e.age_min>=18&&e.choices.some(c=>c.profile===profile&&!c.requirements?.min_cash_yuan&&c.outcomes.every(o=>o.effects.every(x=>['stat','flag','income'].includes(x.op)))));
  if(!e)continue;const s=story(e),c=eligibleChoices(s,e).find(c=>c.profile===profile&&!c.disabled);if(!c)continue;
  await load(s);const button=page.locator(`[data-choice="${c.id}"]`);
  check(`${profile}: redundant profile explanation removed`,await button.locator('small').count()===0);
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state.rng);await click('[data-action=character]');await click('[data-action=close-dialog]');
  check(`${profile}: reading keeps the outcome draw`,await page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state.rng)===before);
 }
 const paid=catalog.events.find(e=>e.age_min>=18&&e.choices.some(c=>c.outcomes.some(o=>o.effects.some(x=>x.op==='spend'))));const paidState=story(paid);await load(paidState);
 for(const c of eligibleChoices(paidState,paid).filter(c=>!c.disabled&&previewChoice(paidState,c).spending.max>0))check('real spending remains visible: '+c.id,(await page.locator(`[data-choice="${c.id}"] small`).innerText()).includes('支出'));
 const poor=story(paid);poor.cash=0;await load(poor);const blocked=eligibleChoices(poor,paid).filter(c=>c.disabled);check('blocked choices available for checking',blocked.length>0);for(const c of blocked)check('disabled reason retained: '+c.id,(await page.locator(`[data-choice="${c.id}"] small`).innerText())===c.reason);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});const s=adult();s.lifeArcs.pending='request';await load(s);await click('.bottom-nav [data-tab=life]');await click('[data-action=life-scene]');
  const choices=page.locator('#game-dialog .behavior-choice');check(`request ${width}: refusal has no empty note`,await choices.nth(2).locator('span').count()===0);
  check(`request ${width}: gift amount and appointment cost retained`,(await choices.nth(0).innerText()).includes('300')&&(await choices.nth(1).innerText()).includes('1 次生活安排'));
  check(`request ${width}: dialog content fits`,await page.locator('.dialog-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await page.screenshot({path:`${out}/request-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:1000});const group=adult();group.behavior.pending='group_tip';group.behavior.group='joined';await load(group);await click('.bottom-nav [data-tab=life]');await click('.life-notebook>summary');await click('[data-action=behavior-hub]');await click('[data-action=behavior-scene]');
 const pay=page.locator('#game-dialog .behavior-choice').filter({hasText:'交 ¥300'});check('paid behavior choice keeps price once in the button title',await pay.count()===1&&await pay.locator('span').count()===0);
 check('behavior stat and consequence notes retained',(await page.locator('#game-dialog').innerText()).includes('眼力 +4')&&(await page.locator('#game-dialog').innerText()).includes('停止后续群聊邀请'));
 check('no empty option notes',await page.locator('.behavior-choice span:empty,.choice-content small:empty').count()===0);check('no browser errors',errors.length===0);
 await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log(`${checks.length} option copy checks passed`);
}catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));throw e;}finally{await browser.close();}
