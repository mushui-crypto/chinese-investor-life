import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {continueChildhood} from '../src/game/childhood.js';
import {chooseEvent,eligibleChoices} from '../src/game/narrative.js';
import {isStudentStory} from '../src/game/student-stories.js';
import {isTeenStory} from '../src/game/teen-stories.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
import {chooseGameOption} from './game-control-helpers.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const url=process.env.GAME_URL||'http://127.0.0.1:4174',out='reports/v1.59/student-stories';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];page.setDefaultTimeout(10000);
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const click=q=>page.locator(q+':visible').first().click(),check=(name,pass)=>{assert.ok(pass,name);checks.push(name);console.log('PASS',name);};
const current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').first().waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));localStorage.setItem('cng-v1-settings',JSON.stringify({reduced:true}));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');}
const scenes=[],teenScenes=[];let s=createPlayableRun({seed:'school-qa',familyId:'F01',startAt:'teen'},catalog);
for(let i=0;s.age<18&&i<100;i++){
 if(s.phase==='event'&&(isStudentStory(s.activeEvent.eventId)||isTeenStory(s.activeEvent.eventId))){const e=catalog.events.find(e=>e.id===s.activeEvent.eventId);if(e.studentStory&&!e.studentStory.followup)scenes.push(structuredClone(s));if(isTeenStory(e.id))teenScenes.push(structuredClone(s));const cs=eligibleChoices(s,e).filter(c=>!c.disabled),c=cs.find(c=>c.studentAction==='observe')||cs[0];s=chooseEvent(s,e.id,c.id,catalog);}
 else s=continueChildhood(s,catalog,{fast:true});
}
try{
 check('five core scenes generated for browser route',scenes.length===5);
 for(const [width,height]of [[1440,1000],[1280,800],[390,844]]){
  await page.setViewportSize({width,height});
  for(const state of scenes){
   await load(state);const id=state.activeEvent.eventId,e=catalog.events.find(e=>e.id===id),tag=`${state.age}-${width}`;
   if(state.age>=12){
    check('teen side story has no illustration '+tag,await page.locator('.student-event-dock .story-panel').count()===1&&await page.locator('.story-panel img').count()===0);
    check('dock stays above navigation '+tag,await page.locator('.student-event-dock').evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top));
   }else{
    await page.locator('.story-panel .event-illustration img').evaluate(i=>i.decode());
    const g=await page.locator('.story-panel .event-illustration').evaluate(el=>{const r=el.getBoundingClientRect(),im=el.querySelector('img');return{ratio:r.width/r.height,native:im.naturalWidth/im.naturalHeight};});
    check('native and displayed 3:1 '+tag,Math.abs(g.ratio-3)<.04&&g.native===3);
    check('age-appropriate art '+tag,await page.locator('.event-illustration').getAttribute('data-art-key')===`student-${e.studentStory.art}`);
   }
   check('no horizontal overflow '+tag,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const layout=await page.locator('.story-panel>.choices').evaluate(el=>{const style=getComputedStyle(el),buttons=[...el.children],rects=buttons.map(b=>b.getBoundingClientRect());return {width:el.clientWidth,columns:style.gridTemplateColumns.split(' ').length,rowAligned:rects.length<2||Math.abs(rects[0].top-rects[1].top)<1,sameWidth:rects.every(r=>Math.abs(r.width-rects[0].width)<1),fits:buttons.every(b=>b.scrollWidth<=b.clientWidth)};});
   check('story choice columns follow available width '+tag,layout.columns===(layout.width>=580?2:1)&&layout.sameWidth&&layout.fits&&(layout.columns===1||layout.rowAligned));
   check('core progress visible '+tag,(await page.locator('.world-scope').textContent()).includes(`学生旧事 ${e.studentStory.slot} / 5`));
   check('hidden traits absent '+tag,!/riskTaking|chasing|allIn|superstition/.test(await page.locator('.story-panel').textContent()));
   const last=page.locator('.story-panel .choice:not([disabled])').last();await last.scrollIntoViewIfNeeded();
   check('choice target at least 44px '+tag,await last.evaluate(el=>el.getBoundingClientRect().height>=44));
   if([6,13,17].includes(state.age))await page.screenshot({path:`${out}/event-${tag}.png`,fullPage:true});
   await last.click();await page.locator('.result-panel').waitFor();const after=await current();
   check('UI choice persisted exactly once '+tag,after.studentStories.history.length===state.studentStories.history.length+1);
   if(state.age>=12)check('result remains text in bottom dock '+tag,await page.locator('.student-event-dock .result-panel').count()===1&&await page.locator('.result-panel img').count()===0);
   check('result uses resolved copy '+tag,!/具体的结果，下次/.test(await page.locator('.result-panel').textContent()));
   await page.reload();await click('[data-action=load-slot]');assert.deepEqual((await current()).studentStories,after.studentStories);checks.push('reload retains history '+tag);
  }
 }
 check('all twelve original teen stories retained',teenScenes.length===12);
 for(const [width,height]of [[1440,1000],[390,844]]){
  await page.setViewportSize({width,height});
  for(const state of teenScenes){
   const id=state.activeEvent.eventId;await load(state);
   check('original teen story in text dock '+id+'-'+width,await page.locator('.student-event-dock .story-panel').count()===1&&await page.locator('.story-panel img').count()===0);
   const last=page.locator('.student-event-dock .choice:not([disabled])').last();await last.scrollIntoViewIfNeeded();
   check('original last choice reachable '+id+'-'+width,await last.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
   await last.click();check('original teen result has no illustration '+id+'-'+width,await page.locator('.student-event-dock .result-panel').count()===1&&await page.locator('.result-panel img').count()===0);
  }
 }
 await page.goto(url);await page.evaluate(()=>localStorage.clear());await page.reload();await click('[data-action=new-game]');await chooseGameOption(page,'#start-at','teen');await page.locator('#player-name').fill('旧事测试');await chooseGameOption(page,'#new-slot','0');await click('#new-game-form [type=submit]');
 const start=await current();check('UI quick start stops at primary school',start.age===6&&isStudentStory(start.activeEvent.eventId));
 check('no page or asset errors',errors.length===0);
 await writeFile(`${out}/report.json`,JSON.stringify({checks,errors,route:scenes.map(s=>({age:s.age,id:s.activeEvent.eventId}))},null,2));
 console.log(`Passed ${checks.length} browser checks`);
}finally{await browser.close();}
