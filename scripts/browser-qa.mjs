import {chooseGameOption} from './game-control-helpers.mjs';
const reportDir=process.env.QA_REPORT_DIR||'reports/v1.4';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(process.env.PLAYWRIGHT_PATH||`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);}
const browser=await playwright.chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce',acceptDownloads:true});
const page=await context.newPage();const errors=[],checks=[];const out=resolve(reportDir+'/lifetime');await mkdir(out,{recursive:true});
const catalog=JSON.parse(await readFile('data/events.json','utf8')).events;
const endingCount=JSON.parse(await readFile('data/endings.json','utf8')).length;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const url=process.env.GAME_URL||'http://127.0.0.1:4173';
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0'))?.state);
const check=(name,pass=true)=>{assert.ok(pass,name);checks.push(name);console.log('PASS',name);};
async function click(selector){if(!selector.includes('close-dialog')&&await page.locator('.rescue-menu').isVisible())await page.locator('#game-dialog [data-action=close-dialog]').first().click();await page.locator(selector+':visible').first().click();}
async function shot(name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true,animations:'disabled'});}
async function noOverflow(label){check(label,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
async function resolveStories(){if(await page.locator('#game-dialog').evaluate(e=>e.open))await close();for(let n=0;n<20;n++){let s=await state();if(s.phase==='event'){const e=catalog.find(e=>e.id===s.activeEvent.eventId);const enabled=await page.locator('.choice:not([disabled])').evaluateAll(bs=>bs.map(b=>b.dataset.choice));const safe=['observe','uw_quit','prison_study','prison_reflect','prison_letter','legal_cooperate','self_study','school','rest','work','family','network','repair','job'];let c=e.choices.filter(c=>enabled.includes(c.id)).sort((a,b)=>(safe.includes(a.profile)?safe.indexOf(a.profile):99)-(safe.includes(b.profile)?safe.indexOf(b.profile):99))[0];assert.ok(c,'a usable story choice');await click(`[data-choice="${c.id}"]`);const after=await state();assert.equal(after.phase,'result');}else if(s.phase==='result')await click('[data-action=continue]');else {if(s.phase==='planning')await lifeTab();return s;}}throw Error('Story queue did not drain');}
async function advanceStage(){
 const age=(await state()).age;
 for(let guard=0;guard<180;guard++){
  let s=await state();if(s.age>age||s.phase==='ended'){console.log('AGE',s.age,'PHASE',s.phase);return;}
  if(await page.locator('#game-dialog').evaluate(e=>e.open)){
   const decision=page.locator('#game-dialog [data-action=life-command]:not([disabled]),#game-dialog [data-action=behavior-do]:not([disabled]),#game-dialog [data-action=confirmed]').first();
   if(await decision.count())await decision.click();else await close();
  }else if(['event','result'].includes(s.phase))await resolveStories();
  else{await lifeTab();await click('[data-action=life-continue]');}
 }
 throw Error('UI life clock did not advance');
}
async function lifeTab(){await click('[data-action=tab][data-tab=life]');}
async function close(){if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('#game-dialog [data-action=close-dialog]');}
try{
 await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await shot('01-title-desktop');await noOverflow('desktop title fits viewport');
 await click('[data-action=new-game]');await page.locator('#player-name').fill('试玩阿财');await click('summary');await chooseGameOption(page,'#family','F08');await page.locator('#seed').fill('release-browser-life-1');await shot('04-new-game-dialog');await click('#new-game-form [type=submit]');await page.locator('.birth-paper').waitFor();check('new game starts at birth',(await state()).age===0);await click('[data-action=birth-skip]');await page.locator('.story-panel').waitFor();check('new game starts at first childhood milestone',(await state()).age===6);await shot('02-childhood-desktop');
 const first=await state();await page.reload();await click('[data-action=load-slot]');check('refresh and load preserve predetermined outcomes',JSON.stringify((await state()).activeEvent)===JSON.stringify(first.activeEvent));
 await resolveStories();await click('[data-action=life-action][data-type=study]');check('study consumes exactly one action',(await state()).actionPoints===1);await close();
 while((await state()).age<18){await resolveStories();await advanceStage();}
 await resolveStories();let s=await state();check('adulthood gift received once',s.age===18&&s.giftReceived);check('cash available from family',s.cash>1000000);await shot('05-adult-desktop');
 await click('[data-action=life-action][data-type=seek_job]');check('job creates stable income',(await state()).monthlyIncome>0);await close();
 await click('[data-action=tab][data-tab=market]');await click('[data-action=market-practice]');await close();await advanceStage();await resolveStories();check('practice and six months are recorded',(await state()).marketProgress.simulations===1);let fundingWait=0;while((await state()).cash<50000000&&fundingWait++<15){await advanceStage();await resolveStories();}check('derivative capital threshold reached through actual turn income',(await state()).cash>=50000000);await click('[data-action=tab][data-tab=market]');await shot('06-market-desktop');await click('[data-action=invest][data-product=futures]');await click('[data-action=desk-instrument][data-id=GBP]');await page.locator('#desk-order [name=amount]').fill('1000');await chooseGameOption(page,'#desk-order [name=leverage]','10');await chooseGameOption(page,'#desk-order [name=direction]','short');await shot('07-futures-desk');const before=await state();await click('#desk-order [type=submit]');s=await state();check('contract order creates chosen real exposure',s.positions.some(p=>p.kind==='futures'&&p.underlying==='GBP'&&p.leverage===10&&p.direction==='short'));check('investment debits exact cents',s.cash===before.cash-100000);await close();
 await click('[data-action=tab][data-tab=assets]');await shot('08-assets-desktop');check('asset chart visible',await page.locator('#wealth-chart').isVisible());await noOverflow('desktop assets fit viewport');
 await lifeTab();await advanceStage();await resolveStories();await click('[data-action=business]');await page.locator('#shop-name').fill('阿财早点铺');await page.locator('#amount').fill('3000');await click('#business-form [type=submit]');check('named business exists',(await state()).businesses.some(b=>b.name==='阿财早点铺'));await close();
 await click('[data-action=loans]');await page.locator('#amount').fill('1000');await chooseGameOption(page,'#loan-kind','bank');await shot('09-loan-dialog');const preloan=await state();await click('#loan-form [type=submit]');s=await state();check('loan executes approval without granting free wealth',s.cash-preloan.cash===s.debts.reduce((a,d)=>a+d.principal+d.interest,0)-preloan.debts.reduce((a,d)=>a+d.principal+d.interest,0));await close();
 await page.locator('[aria-label="存档与读档"]').click();await shot('10-save-dialog');const downloadPromise=page.waitForEvent('download');await click('[data-action=export-slot][data-slot="0"]');const download=await downloadPromise;const filePath=await download.path();const text=await readFile(filePath,'utf8');check('save export contains exact current state',JSON.parse(text).state.rng===(await state()).rng);await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.locator('#toast').filter({hasText:'没有导入'}).waitFor();check('corrupt import rejected without changing slot',(await state()).rng===JSON.parse(text).state.rng);
 await page.locator('#import-file').setInputFiles({name:'save.json',mimeType:'application/json',buffer:Buffer.from(text)});await click('[data-action=confirmed]');check('exported file imports and continues',(await state()).rng===JSON.parse(text).state.rng);
 await page.setViewportSize({width:390,height:844});await shot('11-adult-mobile');await noOverflow('mobile life fits viewport');for(const tab of ['market','assets','people','journal','legal','history']){await click(`[data-action=tab][data-tab=${tab}]`);await noOverflow(`mobile ${tab} fits viewport`);if(tab==='market'||tab==='assets')await shot(`12-${tab}-mobile`);}
 await click('[data-action=history-detail]');check('historical source is an external factual link',await page.locator('#game-dialog a[target="_blank"]').count()===1);await close();
 await page.locator('[aria-label="游戏设置"]').click();await page.locator('[data-setting=reduced]').check();await page.keyboard.press('Escape');check('escape closes native dialog',!(await page.locator('#game-dialog').evaluate(e=>e.open)));check('reduced motion setting persists',await page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-settings')).reduced));
 await page.setViewportSize({width:1440,height:950});await lifeTab();let guard=0;while((await state()).age<55&&guard++<180){await resolveStories();s=await state();if(s.phase==='ended')break;if(s.phase==='planning')await advanceStage();}await resolveStories();s=await state();check('complete UI progression reaches at least age 55',s.age>=55);
 if(s.phase!=='ended'){await click('[data-action=settle]');await click('[data-action=confirmed]');}check('early ending page renders',await page.locator('.ending-paper h1').count()===1);const early=await state();await shot('13-early-ending-desktop');await click('[data-action=resume]');check('continuation preserves debt and assets',JSON.stringify((await state()).debts)===JSON.stringify(early.debts)&&JSON.stringify((await state()).positions)===JSON.stringify(early.positions));
 guard=0;while((await state()).phase!=='ended'&&guard++<240){s=await resolveStories();if(s.phase==='ended')break;await advanceStage();}
 s=await state();check('one life reaches age 80 through browser controls',s.age===80&&s.phase==='ended');check('all twelve life chapters experienced',s.seenEvents.filter(id=>id.startsWith('MAIN')).length===12);await shot('14-final-ending-desktop');await page.setViewportSize({width:390,height:844});await shot('15-final-ending-mobile');await noOverflow('mobile ending fits viewport');
 await click('[data-action=ending-collection]');check('all '+endingCount+' ending entries rendered',await page.locator('.ending-item').count()===endingCount);await close();
 await page.reload();await click('[data-action=load-slot]');check('completed lifetime survives reload',(await state()).phase==='ended'&&await page.locator('.ending-paper').count()===1);
 check('no browser runtime errors',errors.length===0);
 await writeFile(reportDir+'/lifetime-browser.json',JSON.stringify({passed:true,url,date:new Date().toISOString(),browser:await browser.version(),viewport:[1440,950,390,844],checks,errors,run:{seed:s.seed,age:s.age,turn:s.turn,events:s.seenEvents.length,ending:s.ending.id}},null,2));
 console.log(`Browser acceptance passed: ${checks.length} checks, ${s.turn} turns, ${s.seenEvents.length} events.`);
}catch(error){await shot('FAILURE');await writeFile(reportDir+'/lifetime-browser.json',JSON.stringify({passed:false,checks,errors,error:error.stack},null,2));console.error(error);process.exitCode=1;}finally{await browser.close();}
