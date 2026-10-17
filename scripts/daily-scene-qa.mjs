import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {jobMonthlyPay} from '../src/game/work-economy.js';
import {dailyScene,DAILY_SCENES} from '../src/ui/daily-scene.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.36/scenes',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1864,height:1230},reducedMotion:'reduce'}),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click();
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(stage=1,wage=320000){const s=createPlayableRun({seed:'daily-scene',familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash:127584,monthlyIncome:wage,occupation:wage?'专业职员':'待业青年'});s.behavior.pending=null;s.lifeArcs.pending=null;s.journey.lastAction='day_next';ensureRoutine(s);resetRoutineDay(s,stage);return s;}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');await page.locator('.daily-world img').evaluate(i=>i.decode());}
const overlap=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
try{
 for(const [width,height] of [[1864,1230],[1920,1080],[1440,1000],[1280,900],[1024,768],[768,1024],[390,844],[320,740]]){
  await page.setViewportSize({width,height});await load(adult());
  check('one visible cash balance '+width,await page.locator('[data-cash-balance]:visible').count()===1&&await page.locator('.cash-budget:visible').count()===0);
  check('no central receipt or old headline card '+width,await page.locator('.main-stage>.inline-receipt,.main-stage>.mainline-status,.main-stage>.life-console').count()===0);
  check('daily choice on stage, no modal '+width,await page.locator('.daily-arrangements [data-choice=slack]').count()===1&&!await page.locator('#game-dialog').evaluate(e=>e.open));
  check('fits viewport '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&await page.locator('.game-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  if(width>=1250){
   const focus=await page.locator('.daily-world img').evaluate(e=>{const r=e.getBoundingClientRect(),scale=Math.max(r.width/e.naturalWidth,r.height/e.naturalHeight),w=e.naturalWidth*scale,h=e.naturalHeight*scale;return {x:(r.width-w)/2+w*.35,y:(r.height-h)/2+h*.26,width:w*.32,height:h*.43};});
   for(const selector of ['.status-rail','.arrangement-panel','.life-clockbar','.bottom-nav'])check('subject clears '+selector+' '+width,!overlap(focus,await page.locator(selector).boundingBox()));
   check('scene fills main area '+width,(await page.locator('.daily-stage').boundingBox()).height>height*.5);
  }else{check('mobile scene is fully shown '+width,await page.locator('.daily-mobile-art img').evaluate(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&Math.abs(r.width/r.height-16/9)<.01&&getComputedStyle(e).objectFit==='contain';}));}
  await page.screenshot({path:dir+'/work-'+width+'.png'});
  const before=await state();await click('.daily-arrangements [data-choice=slack]');const after=await state();
  await page.locator('.daily-world img').evaluate(i=>i.decode());
  check('slack changes scene and records once '+width,await page.locator('.daily-stage').getAttribute('data-scene')==='slack'&&after.dayRoutine.choices[1]==='slack'&&after.cash===before.cash&&after.actionPoints===before.actionPoints);
  check('choice remains inline '+width,!await page.locator('#game-dialog').evaluate(e=>e.open)&&await page.locator('.daily-arrangements [data-choice=slack]').isDisabled());
  check('reduced motion respected '+width,await page.locator('.daily-world').evaluate(e=>getComputedStyle(e,'::before').animationName==='none'&&e.querySelector('img').getAnimations().length===0));
  if([1864,1440,390].includes(width))await page.screenshot({path:dir+'/slack-'+width+'.png'});
  await page.reload();await click('[data-action=load-slot]');await click('.bottom-nav [data-tab=life]');check('scene persists '+width,await page.locator('.daily-stage').getAttribute('data-scene')==='slack');
 }
 if(!process.env.QA_FIRST_BATCH){
  // Each daily illustration is decoded in the live renderer without changing RNG or balances.
  const cases=[['breakfast',0,'breakfast'],['work',1,'focus'],['slack',1,'slack'],['home-trading',0,'phone'],['job-search',1,'job_hunt'],['gig',1,'day_gig'],['study',5,'learn'],['rest',5,'rest'],['meal',5,'friends'],['outside',3,'errands'],['night',7,null],['phone',5,null]];
  await page.setViewportSize({width:1440,height:1000});
  for(const [key,stage,choice] of cases){const s=adult(stage,['job-search','gig','outside'].includes(key)?0:320000);if(choice)s.dayRoutine.choices[stage]=choice;if(key==='phone')s.dayRoutine.pending='family';const before=structuredClone(s);assert.equal(dailyScene(s).key,key);assert.deepEqual(s,before);await load(s);check(key+' image decoded and correct',await page.locator('.daily-stage').getAttribute('data-scene')===key&&await page.locator('.daily-world img').evaluate(i=>i.naturalWidth>1000));await page.screenshot({path:dir+'/'+key+'-scene.png'});}
  await load(adult(1,0));check('jobless activities replace salaried shifts',await page.locator('.daily-arrangements [data-choice=job_hunt]').count()===1&&await page.locator('.daily-arrangements [data-choice=focus]').count()===0);await click('.daily-arrangements [data-choice=day_gig]');check('gig is paid and scene changes',(await state()).cash>127584&&await page.locator('.daily-stage').getAttribute('data-scene')==='gig');
  await click('.life-clockbar [data-info=period]');check('cash and complete bills remain in details',await page.locator('.game-info .cash-budget').count()===1);
  await click('.game-info [data-action=go-work]');check('work route opens collapsed alternatives',await page.locator('.extra-arrangements').getAttribute('open')!==null&&await page.locator('.extra-arrangements .life-action').first().isVisible());
  check('half-day work blocks a second full-day payout',await page.locator('.extra-arrangements [data-type=work]').isDisabled()&&await page.locator('.extra-arrangements [data-type=gig]').isDisabled());
  const phone=adult(5);phone.dayRoutine.pending='family';await load(phone);await click('.daily-arrangements [data-choice=talk]');check('resolved family call keeps phone scene without a popup',await page.locator('.daily-stage').getAttribute('data-scene')==='phone'&&!await page.locator('#game-dialog').evaluate(e=>e.open));
  const legacy=adult(1,840500);delete legacy.economyRevision;await load(legacy);const migrated=await state();check('old save uses lower future wages and preserves cash',migrated.monthlyIncome===jobMonthlyPay(legacy)&&migrated.cash===legacy.cash);await page.reload();await click('[data-action=load-slot]');check('old-save wage conversion runs once',(await state()).monthlyIncome===migrated.monthlyIncome);
  await click('.bottom-nav [data-tab=life]');await click('[data-action=day-rules]');check('rules show costs without duplicate activity buttons',await page.locator('#game-dialog .living-cost-detail').count()===1&&await page.locator('#game-dialog [data-action=day-command]').count()===0);await click('[data-action=close-dialog]');
  await page.setViewportSize({width:390,height:844});await load(adult(1));check('mobile next-step button remains beside activities',await page.locator('.daily-next-button:visible').count()===1);await click('.daily-next-button');check('mobile next-step advances the real clock',(await state()).dayRoutine.stage===2);
 }
 check('no runtime errors',errors.length===0);await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
