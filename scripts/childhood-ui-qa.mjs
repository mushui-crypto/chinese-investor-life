import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {skipBirth} from '../src/game/childhood.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
import {chooseGameOption} from './game-control-helpers.mjs';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.26/childhood-ui',url=process.env.GAME_URL||'http://127.0.0.1:4173';await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[],measurements=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click(),state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
async function close(){if(await page.locator('#game-dialog').evaluate(d=>d.open))await click('#game-dialog [data-action=close-dialog]');}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');await close();}
async function choiceReachable(){const el=page.locator('.choice:last-child');await el.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));return el.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});}
async function shot(name){await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${out}/${name}.png`});}
const six=skipBirth(createPlayableRun({seed:'child-ui-22',name:'阿财',familyId:'F01',startAt:'birth'},catalog),catalog);
try{
 await load(six);
 check('actual birth transition reaches six-year story',(await state()).age===6&&(await state()).phase==='event');
 check('story is first main content',await page.locator('#main-content>*').first().evaluate(e=>e.classList.contains('story-panel')));
 check('story has no duplicate continuation and right sidebar is restored',await page.locator('.life-flow').count()===0&&await page.locator('[data-action=life-continue]').count()===0&&await page.locator('.arrangement-panel .paused-arrangements').isVisible());
 check('growth settings start folded below story',!await page.locator('.childhood-path').evaluate(e=>e.open)&&await page.locator('.story-panel').evaluate(e=>e.nextElementSibling.matches('.childhood-path')));
 check('fixed character rail shows money and seven attributes',await page.locator('.status-rail .pocket-book').isVisible()&&await page.locator('.status-rail .stat:visible').count()===7);
 check('six-year navigation directly shows all seven pages',await page.locator('.bottom-nav>button').count()===7);
 check('generic choice captions are gone',!await page.locator('.choices').innerText().then(t=>/一次新的选择|先看清楚 · 不花钱|认真聊聊 · 关系变化/.test(t)));
 check('birth transition story has its illustrated scene',await page.locator('.story-panel [data-event-art=MAIN02] img').evaluate(e=>e.complete&&e.naturalWidth>0));await shot('age6-desktop');
 check('all stats and family reserve remain accessible',await page.locator('.stat:visible').count()===7&&await page.locator('.family-line').isVisible());await click('[data-info="stat:insight"]');check('attribute explanation opens',await page.locator('#game-info').isVisible());await page.keyboard.press('Escape');
 const before=await state();await click('.childhood-path>summary');check('changing growth shows adulthood lock and all effects',(await page.locator('.child-growth-body').innerText()).includes('18 岁后不能改')&&await page.locator('.child-focus-effects>li').count()===3);
 await chooseGameOption(page,'#child-focus','social');check('selected focus updates collapsed label',(await page.locator('[data-child-focus-label]').innerText())==='亲友往来');check('changing focus keeps cash and RNG',(await state()).cash===before.cash&&(await state()).rng===before.rng);await click('.childhood-path>summary');
 await page.reload();await click('[data-action=load-slot]');check('reload keeps selected focus',(await state()).childhood.focus==='social'&&(await page.locator('[data-child-focus-label]').innerText())==='亲友往来');
 const browseState=await state();
 for(const tab of ['market','assets','people','history','legal']){
  await click(`.bottom-nav [data-tab=${tab}]`);check(tab+' directly reachable',await page.locator('.workspace').isVisible()&&await page.locator('.child-back').isVisible()&&!await page.locator('#game-info').count());await click('.child-back');
 }
 check('menu browsing never changes cash or RNG',(await state()).cash===browseState.cash&&(await state()).rng===browseState.rng);
 await click('.bottom-nav [data-tab=journal]');check('journal remains directly reachable',await page.locator('.journal-entry').count()>0);await click('.child-back');
 await click('.player-profile');check('full character dialog shows all attributes',await page.locator('#game-dialog .stat').count()===7);await click('#game-dialog [data-tab=assets]');check('character ledger link exits modal to asset page',!await page.locator('#game-dialog').evaluate(e=>e.open)&&await page.locator('#wealth-chart').count()===1);await click('.child-back');
 check('More menu has been replaced by direct navigation',await page.locator('[data-action=child-more]').count()===0);
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:width<700?844:1000});await page.evaluate(()=>scrollTo(0,0));check('story '+width+' has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const rect=await page.evaluate(()=>{const b=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom};};return {width:innerWidth,story:b('.story-panel'),nav:b('.bottom-nav'),lastChoice:b('.choice:last-child')};});measurements.push(rect);check('story '+width+' choices are reachable after scrolling',await choiceReachable());await page.evaluate(()=>scrollTo(0,0));await shot('age6-'+width);
  check('all seven navigation entries visible '+width,await page.locator('.bottom-nav>button:visible').count()===7);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.keyboard.press('2');check('number shortcut still selects a real story outcome',(await state()).phase==='result'&&(await state()).storyHistory.some(e=>e.eventId===six.activeEvent.eventId));check('result has only one continue',await page.locator('[data-action=continue]:visible').count()===1&&await page.locator('[data-action=life-continue]').count()===0);check('choice result keeps the scene illustration',await page.locator('.result-panel [data-event-art=MAIN02] img').count()===1);await shot('age6-result');await click('[data-action=continue]');
 check('real result grows to twelve',(await state()).age===12);check('twelve adds direct market to seven pages',await page.locator('.bottom-nav>button').count()===8&&await page.locator('[data-action=child-market]').isVisible());
 if((await state()).phase==='event'){await click('[data-action=child-market]');check('market navigation cannot bypass pending story',(await state()).phase==='event');await click('.choice:not([disabled])');await click('[data-action=continue]');}
 check('planning shows childhood actions once in right sidebar',await page.locator('.arrangement-panel [data-action=life-action]').count()===3&&await page.locator('[data-action=life-action]').count()===3&&await page.locator('.child-market').isVisible());
 await click('[data-action=child-market]');check('market shortcut focuses a real game field',await page.locator('.child-market').evaluate(e=>e.contains(document.activeElement)));
 await page.locator('#child-market-form [name=quantity]').fill('1');const buyBefore=await state();await click('#child-market-form [type=submit]');check('market buys using actual pocket cash',(await state()).cash===buyBefore.cash-1200);
 await click('[data-action=child-command][data-command*="1.25"]');const offer=await state();await click('[data-action=child-command][data-command*=child_sell]');check('market sale pays real quote',(await state()).cash===offer.cash+offer.childhood.offer.total);
 await click('.childhood-path>summary');const ap=(await state()).actionPoints;await click('.arrangement-panel [data-type=rest]');await close();check('sidebar rest consumes exactly one action',(await state()).actionPoints===ap-1);check('growth disclosure persists through action redraw',await page.locator('.childhood-path').evaluate(e=>e.open));await click('.childhood-path>summary');await page.evaluate(()=>scrollTo(0,0));await shot('age12-planning');
 for(const width of [390,320]){await page.setViewportSize({width,height:844});await click('[data-action=child-market]');check('market '+width+' and fields do not overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('age12-'+width);}
 let guard=0;while((await state()).age<18&&guard++<10){const s=await state();if(s.phase==='event')await click('.choice:not([disabled])');else if(s.phase==='result')await click('[data-action=continue]');else await click('[data-action=life-continue]');}
 check('complete childhood reaches adulthood',(await state()).age===18);check('adulthood gift pays once',(await state()).ledger.filter(l=>l.label==='成年一次性赠与').length===1);check('adult restores seven navigation items',await page.locator('.bottom-nav>button').count()===7&&await page.locator('.childhood-playing').count()===0);
 while((await state()).phase!=='planning'&&guard++<16){if((await state()).phase==='event')await click('.choice:not([disabled])');else await click('[data-action=continue]');}
 await click('[data-action=tab][data-tab=life]');check('adult retains all three budget figures',await page.locator('.period-console [data-budget]:visible').count()===3);check('adult keeps work and sidebar controls',await page.locator('.arrangement-panel [data-type=work]').count()===1);await page.setViewportSize({width:1440,height:1000});check('adult seven stats are still unfolded',await page.locator('.character-panel .stat:visible').count()===7);await shot('age18-life');
 const legacy=structuredClone(six);delete legacy.childhood;await load(legacy);await click('.childhood-path>summary');check('legacy save has accessible growth settings',await page.locator('.childhood-path').evaluate(e=>e.open));await click('[data-action=child-fast-forward]');check('legacy fast forward reaches adult once',(await state()).age===18&&(await state()).ledger.filter(l=>l.label==='成年一次性赠与').length===1);
 check('no browser errors',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,measurements,errors,url},null,2));
}catch(e){await page.screenshot({path:`${out}/FAILURE.png`});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,measurements,errors,error:e.stack,url},null,2));console.error(e);process.exitCode=1;}finally{await browser.close();}
