import {chooseGameOption} from './game-control-helpers.mjs';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,act} from '../src/game/narrative.js';
import {PRODUCTS,getSurvivalStatus,getLoanOffer} from '../src/game/core.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.21/economy',url=process.env.GAME_URL||'http://127.0.0.1:4173';await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[],measurements=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click(),state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(cash=1173877){const s=createRun({seed:'focus-test-21',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:0,giftReceived:true});s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
async function close(){if(await page.locator('#game-dialog').evaluate(d=>d.open))await click('#game-dialog [data-action=close-dialog]');}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');await close();}
async function shot(name){await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${out}/${name}.png`});}
try {
 for(const kind of ['family','friend','bank','net','card','shark']){
  let fixture=adult(10000000);fixture.stats.credit=100;fixture.stats.trust=100;fixture.monthlyIncome=1000000;fixture.familyReserve=10000000;
  const offer=getLoanOffer(fixture,kind,100000);
  for(let seed=1;seed<100;seed++){fixture.rng=seed;const n=act(fixture,{type:'borrow',kind,amount:100000},catalog);if(n.debts.some(d=>d.kind===kind))break;}
  await load(fixture);await click('[data-action=tab][data-tab=life]');await click('[data-action=loans]');await chooseGameOption(page,'#loan-kind',kind);await page.locator('#amount').fill('1000');check(kind+' quote shows net fee principal and payment',await page.locator('#loan-estimate dd').count()===4);await click('#loan-form [type=submit]');await close();const borrowed=await state();
  check(kind+' actual cash matches quoted net and real debt',borrowed.cash===fixture.cash+offer.net&&borrowed.debts.some(d=>d.kind===kind&&d.principal===100000));
  await page.reload();await click('[data-action=load-slot]');check(kind+' debt survives reload',(await state()).debts[0].principal===100000);await click('[data-action=tab][data-tab=assets]');await click('[data-action=repay]');await page.locator('#amount').fill('1000');await click('#repay-form [type=submit]');await close();check(kind+' real repayment clears the borrowed principal',(await state()).debts.reduce((n,d)=>n+d.principal+d.interest,0)===0&&(await state()).cash===borrowed.cash-100000);
 }
 await load(adult(10000000));await click('[data-action=tab][data-tab=life]');await click('[data-action=business]');await page.locator('#shop-name').fill('早点铺');await page.locator('#amount').fill('3000');await click('#business-form [type=submit]');await close();let s=await state();check('business opening funds named shop',s.cash===9700000&&s.businesses[0].name==='早点铺'&&s.businesses[0].value===300000);await click('[data-action=business]');await click('[data-action=life-action][data-type=business_run]');await close();check('business operation consumes actual life action',(await state()).actionPoints===s.actionPoints-1);await click('[data-action=business]');check('spent life actions explain disabled business transfer',await page.locator('.business-existing [data-action=sell]').isDisabled()&&await page.locator('.business-exit-reason').innerText());await close();await click('.life-links [data-action=behavior-hub]');await click('[data-command*=calendar_day]');await close();s=await state();await click('[data-action=business]');await click('.business-existing [data-action=sell]');await click('[data-action=confirmed]');await close();check('business can transfer back into actual cash after advancing a day',(await state()).businesses.length===0&&(await state()).cash===s.cash+Math.round(s.businesses[0].value*.8));
 check('no browser exceptions',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,errors,url},null,2));
}catch(e){await page.screenshot({path:`${out}/FAILURE.png`});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e);process.exitCode=1;}finally{await browser.close();}
