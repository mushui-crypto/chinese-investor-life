import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,act} from '../src/game/narrative.js';
import {startCareer} from '../src/game/careers.js';
import {syncSurvival} from '../src/game/survival.js';
import {getMetrics} from '../src/game/core.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const out='reports/v1.59/hospital-cash',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(out,{recursive:true});
function fixture(cash,health){let s=createRun({seed:'cash-care-ui',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:1e6,giftReceived:true});s.flags.college_student=false;s.flags.college_not_admitted=true;s.education.college=false;startCareer(s,'job:reentry');s.behavior.jobStartsTomorrow=false;s=act(s,{type:'stage_plan',focus:'market'},catalog);s.stats.health=health;s.cash=cash;s.actionPoints=0;syncSurvival(s,getMetrics(s));return s;}
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const check=(name,pass)=>{assert.ok(pass,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click();
const current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
async function close(){if(await page.locator('#night-transition[open]').count())await page.locator('.night-transition-skip').click();if(await page.locator('#game-dialog').evaluate(d=>d.open))await click('#game-dialog [data-action=close-dialog]');}
async function load(s){await page.goto(url);await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));localStorage.setItem('cng-v1-settings',JSON.stringify({reduced:true}));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');await close();}
try{
 for(const [width,height]of [[1512,850],[390,844]]){
  await page.setViewportSize({width,height});await load(fixture(0,20));
  await page.locator('.stage-footer').scrollIntoViewIfNeeded();
  check('today primary and fast-forward secondary '+width,await page.locator('.stage-time-buttons [data-action=stage-detail]').evaluate(e=>e.classList.contains('primary'))&&!await page.locator('.stage-time-buttons [data-action=chapter-start]').evaluate(e=>e.classList.contains('primary')));
  check('time buttons share a row '+width,await page.locator('.stage-time-buttons').evaluate(e=>{const [a,b]=[...e.children].map(e=>e.getBoundingClientRect());return Math.abs(a.top-b.top)<5;}));
  check('one footer separator without warning double borders '+width,await page.locator('.chapter-plan').evaluate(e=>{const warning=getComputedStyle(e.querySelector('.chapter-stop')),footer=getComputedStyle(e.querySelector('.stage-footer'));return warning.borderTopWidth==='0px'&&warning.borderBottomWidth==='0px'&&parseFloat(footer.borderTopWidth)>0;}));
  check('no horizontal overflow '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===1512)await page.screenshot({path:`${out}/stage.png`});
  await click('.chapter-stop [data-action=rescue-options]');await click('#game-dialog [data-action=hospital-options]');
  check('insufficient cash disables treatment but offers tomorrow '+width,await page.locator('.hospital-actions [data-type=hospital]').isDisabled()&&await page.locator('.hospital-options [data-type=calendar_day]').isEnabled());
  check('cash gap displayed '+width,(await page.locator('.hospital-costs').innerText()).includes('1,500'));
  await page.screenshot({path:`${out}/hospital-${width}.png`});
  await click('.hospital-options [data-type=calendar_day]');let s=await current();
  check('declining care settles hunger exactly once '+width,s.stats.health===10&&s.survival.days===1&&s.survival.hospitalVisits===0&&!s.debts.some(d=>d.name==='住院医疗欠款'));
  await close();await click('.health-day-settlement [data-type=calendar_day]');s=await current();
  check('next hungry day reaches ending '+width,s.phase==='ended'&&s.stats.health===0&&s.ending.id==='E29');
 }
 await page.setViewportSize({width:1512,height:850});await load(fixture(150000,20));await click('.chapter-stop [data-action=rescue-options]');await click('#game-dialog [data-action=hospital-options]');await click('.hospital-actions [data-type=hospital]');const paid=await current();
 check('fully funded admission paid once without new medical debt',paid.stats.health===60&&paid.survival.hospitalVisits===1&&paid.survival.days===1&&paid.cash===0&&!paid.debts.some(d=>d.name==='住院医疗欠款')&&paid.ledger.filter(e=>e.label==='住院医疗费'&&e.account==='cash').reduce((n,e)=>n+e.amount,0)===-150000);
 await load(fixture(1e6,80));await click('.stage-time-buttons [data-action=stage-detail]');check('today opens daily actions',await page.locator('.day-choices').count()>0);
 check('no runtime errors',errors.length===0);await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));console.log(`Passed ${checks.length} checks`);
}finally{await browser.close();}
