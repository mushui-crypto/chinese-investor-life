import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
import {ensureRoutine,resetRoutineDay} from '../src/game/day-routine.js';
import {skipBirth} from '../src/game/childhood.js';
import {PRODUCTS} from '../src/game/core.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.39/scroll',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click();
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
function adult(cash=0){const s=createPlayableRun({seed:'daily-scroll',familyId:'F01',startAt:'adult'},catalog);Object.assign(s,{phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],presentations:[],cash,monthlyIncome:320000,occupation:'专业职员'});s.behavior.pending=null;s.lifeArcs.pending=null;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};ensureRoutine(s);resetRoutineDay(s,0);return s;}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');await page.locator('.daily-world img').evaluate(i=>i.decode());await settle();}
const geometry=()=>page.evaluate(()=>{const box=q=>{const r=document.querySelector(q).getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom,right:r.right,height:r.height};},region=document.querySelector('.game-scroll');return {width:innerWidth,height:innerHeight,documentHeight:document.documentElement.scrollHeight,documentWidth:document.documentElement.scrollWidth,windowY:scrollY,scroll:region.scrollTop,scrollHeight:region.scrollHeight,clientHeight:region.clientHeight,main:box('.main-stage'),clock:box('.life-clockbar'),caption:box('.daily-scene-caption'),nav:box('.bottom-nav'),profile:box('.player-profile'),rail:box('.arrangement-panel')};});
async function wheel(selector){const r=await page.locator(selector).boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,850);await page.waitForTimeout(150);}
async function checkDock(tag){
 const g=await page.evaluate(()=>{const rect=q=>document.querySelector(q).getBoundingClientRect().toJSON();return {dock:rect('.daily-operation-dock'),nav:rect('.bottom-nav'),region:rect('.game-scroll'),gap:parseFloat(getComputedStyle(document.querySelector('.game-shell')).getPropertyValue('--panel-gap')),count:document.querySelectorAll('.life-clockbar').length,inside:document.querySelector('.game-scroll .life-clockbar')!==null};});
 check('daily controls align above navigation '+tag,Math.abs(g.dock.x-g.nav.x)<1&&Math.abs(g.dock.width-g.nav.width)<1&&Math.abs(g.nav.y-g.dock.bottom-g.gap)<1);
 check('content clears daily dock '+tag,g.region.bottom<=g.dock.y-g.gap+1&&g.region.height>0);
 check('one daily bar outside scrolling content '+tag,g.count===1&&!g.inside);
}
try{
 for(const [width,height] of [[1875,1199],[1440,900],[1366,768],[1280,600]]){
  await page.setViewportSize({width,height});
  for(const cash of [0,2e7]){
   const tag=`${width}x${height} cash ${cash}`;await load(adult(cash));const before=await geometry();await wheel('.game-scroll');await page.locator('.game-scroll').focus();await page.keyboard.press('PageDown');await settle();const after=await geometry();
   check('daily scene has no excess height '+tag,after.scrollHeight<=after.clientHeight+1&&after.scroll===0&&after.windowY===0&&after.documentHeight===height);
   check('clock caption and HUD stay still '+tag,['clock','caption','nav','profile','rail'].every(k=>JSON.stringify(before[k])===JSON.stringify(after[k])));
   await checkDock(tag);check('scene caption clears daily controls '+tag,after.caption.bottom<=after.clock.y);
   check('caption and full nav fit '+tag,after.caption.bottom<after.nav.y&&after.nav.bottom<=height-19&&after.main.bottom<=after.nav.y-10&&after.documentWidth===width);
   check('corrected background loaded '+tag,(await page.locator('.daily-world img').getAttribute('src')).endsWith('breakfast-v2.webp'));
   if(cash===0){
    check('survival remains visible through compact entry '+tag,await page.locator('.daily-survival > summary').isVisible()&&await page.locator('.game-scroll > .survival-panel').count()===0);
    await click('.daily-survival > summary');await click('.extra-arrangements > summary');await wheel('.arrangement-panel');
    check('only right rail scrolls with expanded survival '+tag,await page.locator('.arrangement-panel').evaluate(e=>e.scrollTop>0)&&(await geometry()).scroll===0);
    await click('.daily-survival [data-action=rescue-options]');check('rescue borrowing choices still open '+tag,await page.locator('#game-dialog .rescue-menu').count()===1);await click('[data-action=close-dialog]');
    await click('.daily-survival > summary');await click('.extra-arrangements > summary');await page.locator('.arrangement-panel').evaluate(e=>e.scrollTop=0);
    await page.locator('#toast.show').waitFor({state:'hidden'});await page.screenshot({path:`${dir}/breakfast-${width}.png`});
   }
   await click('.daily-arrangements [data-choice=breakfast]');check('daily activity still works '+tag,await page.locator('.daily-arrangements [data-choice=breakfast]').isDisabled());
  }
 }
 // Long notices get their own reading area without pushing the scene below the nav.
 await page.setViewportSize({width:1280,height:600});const news=adult(2e7);news.behavior.pending='relapse';news.presentations=[{id:'scroll-milestone',kind:'wealth',age:18,turn:news.turn,months:0,amount:100000000}];await load(news);await wheel('.daily-notices');const n=await geometry();check('long notices do not overflow main scene',n.scroll===0&&n.scrollHeight<=n.clientHeight+1&&n.caption.bottom<n.nav.y);await click('[data-action=dismiss-milestone]');check('milestone remains dismissible',await page.locator('.milestone-scene').count()===0);await click('.daily-notices [data-action=behavior-hub]');check('pending message remains reachable',await page.locator('#game-dialog .behavior-pending').count()===1);await click('[data-action=close-dialog]');
 for(const [width,height] of [[1024,650],[390,844]]){
  await page.setViewportSize({width,height});await load(adult());const clockBefore=(await geometry()).clock;await wheel('.game-scroll');let g=await geometry();check('narrow screen scrolls only content '+width,g.scroll>0&&g.windowY===0&&g.documentHeight===height&&g.documentWidth===width);await checkDock(width);check('mobile daily controls stay fixed '+width,JSON.stringify(clockBefore)===JSON.stringify(g.clock));await click('.daily-survival > summary');await click('.daily-survival [data-action=rescue-options]');check('mobile survival actions reachable '+width,await page.locator('#game-dialog .rescue-menu').count()===1);await click('[data-action=close-dialog]');await click('.daily-survival > summary');await click('.daily-arrangements [data-choice=breakfast]');check('mobile daily choice reachable '+width,await page.locator('.daily-arrangements [data-choice=breakfast]').isDisabled());
 }
 // The daily scene lock must not leak into long market screens or active stories.
 await page.setViewportSize({width:1440,height:900});await load(adult(2e7));await click('.bottom-nav [data-tab=market]');await wheel('.game-scroll');check('market directory still scrolls',await page.locator('.game-scroll').evaluate(e=>e.scrollTop>0));await click('.market-row[data-market=stock] [data-action=invest]');await wheel('.game-scroll');check('stock content still scrolls inside frame',await page.locator('.game-scroll').evaluate(e=>e.scrollTop>0)&&await page.evaluate(()=>scrollY===0));
 await click('[data-action=desk-back]');await click('.market-row[data-market=crypto] [data-action=invest]');await wheel('.game-scroll');check('crypto content still scrolls inside frame',await page.locator('.game-scroll').evaluate(e=>e.scrollTop>0)&&await page.evaluate(()=>scrollY===0));
 const story=skipBirth(createPlayableRun({seed:'scroll-story',familyId:'F01',startAt:'birth'},catalog),catalog);await page.goto(url);await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(story));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');await wheel('.game-scroll');check('story reading keeps inner scrolling',await page.locator('.game-scroll').evaluate(e=>e.scrollHeight>e.clientHeight&&e.scrollTop>0)&&await page.locator('.life-scenic').count()===0);
 check('no runtime errors',errors.length===0);await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(e){await page.screenshot({path:dir+'/FAILURE.png'});await writeFile(dir+'/checks.json',JSON.stringify({passed:checks.length,checks,errors,error:e.stack},null,2));throw e;}finally{await browser.close();}
