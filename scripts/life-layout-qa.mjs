import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {act} from '../src/game/narrative.js';
import {PRODUCTS,getLoanOffer} from '../src/game/core.js';
import {resetGameCalendar} from '../src/game/game-calendar.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir=process.env.QA_REPORT_DIR||'reports/v1.33/life-layout/layout',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1920,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);};
const click=q=>page.locator(q+':visible').first().click(),state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(){const s=createPlayableRun({seed:'life-layout',familyId:'F08',startAt:'adult'},catalog);Object.assign(s,{age:18.5,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:7487116,monthlyIncome:565000,giftReceived:true,presentations:[]});s.turn++;resetGameCalendar(s);s.lifeArcs.pending=null;s.behavior.pending=null;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};s.journey.lastAction='desk_sell';s.lastResult={title:'市场操作已记录',text:'巷里百货实际到账 51295.2 元，已扣除退出费用。',changes:[{label:'现金',value:5129520},{label:'净资产',value:-10280}]};return s;}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=life]');}
async function close(){if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');}
try{
 for(const width of [1920,1440,1024,768,390,320]){
  await page.setViewportSize({width,height:width<700?844:1000});await load(adult());const before=JSON.stringify(await state());
  check('life has three visible budget amounts '+width,await page.locator('.life-console [data-budget]:visible').count()===3);
  check('settled chapter remains compact and visible '+width,await page.locator('.mainline-status').isVisible()&&(await page.locator('.mainline-status').boundingBox()).height<140);
  check('old market receipt and old accounts leave the main column '+width,await page.locator('#main-content .inline-receipt,#main-content .turn-receipt,#main-content .childhood-summary').count()===0);
  check('notebook closed by default '+width,!await page.locator('.life-notebook').evaluate(e=>e.open));
  check('current employee is offered a job change '+width,(await page.locator('.arrangements [data-type=seek_job]').innerText()).includes('换份工作'));
  check('page fits viewport '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${dir}/life-${width}.png`});
  await click('.life-notebook>summary');check('prior accounts and growth are reachable '+width,await page.locator('.life-notebook .turn-receipt').isVisible()&&await page.locator('.life-notebook .childhood-summary').isVisible());
  await click('.turn-receipt>summary');check('old ledger expands '+width,await page.locator('.turn-receipt p').first().isVisible());
  await click('.life-notebook [data-action=debt-calendar]');check('debt calendar remains reachable '+width,await page.locator('#game-dialog').evaluate(e=>e.open));await close();
  check('layout and records do not change saved game '+width,JSON.stringify(await state())===before);
 }
 await page.setViewportSize({width:1440,height:1000});await load(adult());const cash=(await state()).cash;await click('.arrangements [data-type=gig]');await close();check('life action still pays immediately and shows its own receipt',(await state()).cash>cash&&await page.locator('#main-content .inline-receipt').isVisible());
 await click('.bottom-nav [data-tab=market]');await click('[data-action=invest][data-product=stock]');check('market receipt remains in the visible right rail',await page.locator('.trade-inbox .inline-receipt').isVisible());
 const low=adult();low.cash=10000;low.monthlyIncome=800000;await load(low);check('cash shortage stays visible without expanding help',await page.locator('.life-console .cash-shortage').isVisible());await click('.life-console [data-action=go-work]');check('work link reaches life actions',await page.locator('.arrangements [data-type=work]').isVisible());
 const borrower=adult();let debt=act(borrower,{type:'borrow',kind:'friend',amount:getLoanOffer(borrower,'friend').principal},catalog);assert.ok(!debt.lastResult?.error,debt.lastResult?.error);debt.debts.at(-1).overdue=true;await load(debt);check('overdue debt stays visible outside closed notebook',await page.locator('.life-alerts [data-action=debt-calendar]').isVisible()&&!await page.locator('.life-notebook').evaluate(e=>e.open));
 const pending=adult();pending.lifeArcs.pending='comfort';await load(pending);await click('.life-alerts [data-action=life-scene]');await page.locator('.event-illustration img').evaluate(i=>i.decode());check('life message uses the shared 2:1 frame',await page.locator('.event-illustration').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width/r.height-2/1)<.01&&getComputedStyle(e.querySelector('img')).objectFit==='cover';}));await page.setViewportSize({width:390,height:844});check('phone dialogue preserves the same 2:1 ratio',await page.locator('.event-illustration').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width/r.height-2/1)<.01;}));await close();
 for(const width of [1920,1440,390,320]){
  await page.setViewportSize({width,height:width<700?844:1000});const s=adult(),e=catalog.events.find(e=>e.id==='HAO01');s.phase='event';s.activeEvent={eventId:e.id,outcomes:Object.fromEntries(e.choices.map(c=>[c.id,c.outcomes[0].id]))};s.seenEvents=s.seenEvents.filter(id=>id!==e.id);await load(s);await page.locator('.event-illustration img').evaluate(i=>i.decode());
  const m=await page.locator('.event-illustration img').evaluate(i=>{const r=i.getBoundingClientRect();const f=i.parentElement.getBoundingClientRect();return {width:r.width,height:r.height,frameWidth:f.width,frameHeight:f.height,fit:getComputedStyle(i).objectFit};});check('story art fills its 2:1 frame '+width,Math.abs(m.frameWidth/m.frameHeight-2/1)<.01&&Math.abs(m.width-(m.frameWidth-2))<2&&Math.abs(m.height-(m.frameHeight-2))<2&&m.fit==='cover');check('story and choices are preserved '+width,await page.locator('.story-panel h2').innerText()==='阿豪的第二把椅子'&&await page.locator('.choice').count()===e.choices.length);await page.screenshot({path:`${dir}/event-${width}.png`});
 }
 check('no browser exceptions',errors.length===0);await writeFile(`${dir}/checks.json`,JSON.stringify({passed:true,checks,errors},null,2));
}catch(e){await page.screenshot({path:`${dir}/failure.png`});await writeFile(`${dir}/checks.json`,JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));throw e;}finally{await browser.close();}
