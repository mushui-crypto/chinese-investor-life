import {openLifeEntry} from './life-entry-helpers.mjs';
import {lifeScene,rebuildOffers,newLifeArcs} from '../src/game/life-arcs.js';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,act} from '../src/game/narrative.js';
import {PRODUCTS,getSurvivalStatus} from '../src/game/core.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.21/completion-audit/life-routes',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[],measurements=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=(name,v)=>{assert.ok(v,name);checks.push(name);console.log('PASS',name);},click=q=>page.locator(q+':visible').first().click(),state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function adult(cash=1173877){const s=createRun({seed:'focus-test-21',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:0,giftReceived:true});s.stats.insight=90;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};return s;}
async function close(){if(await page.locator('#game-dialog').evaluate(d=>d.open))await click('#game-dialog [data-action=close-dialog]');}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');await close();}
async function shot(name){await page.locator('#toast.show').waitFor({state:'detached',timeout:5000});await page.screenshot({path:`${out}/${name}.png`});}
async function day(){const before=await state();await openLifeEntry(page,'debt-calendar');await click('[data-command*=calendar_day]');await close();check('day advances once while delayed work waits',(await state()).debtClock.day===before.debtClock.day+1);}
function qualified(){const s=adult(10000000);s.stats.skill=80;s.stats.credit=90;s.stats.trust=90;s.relationships.N04=70;s.flags.ever_released=true;s.lifeArcs=newLifeArcs(s);s.lifeArcs.seen=['comfort','pressure','request','promise_due','disclosure','response'];return s;}
try {
 for(const id of ['shift','repair','referral','apprentice','reentry','preorder']){
  let initial=qualified();if(id==='preorder')initial=act(initial,{type:'business_start',amount:300000,name:'测试小店'},catalog);
  const offer=rebuildOffers(initial).find(o=>o.id===id);assert.ok(offer.allowed,id);await load(initial);await openLifeEntry(page,'life-rebuild');await click(`[data-action=life-command][data-command*='"id":"${id}"']`);await close();let now=await state();check(id+' charges only its material cost and immediate pay',now.cash===initial.cash-offer.cost+(offer.days===0?offer.pay:0));
  if(offer.days){await page.reload();await click('[data-action=load-slot]');check(id+' waiting job survives reload',(await state()).lifeArcs.jobs.some(j=>j.id===id));for(let d=1;d<=offer.days;d++){await day();now=await state();check(id+' pays on its delivery day',d<offer.days?now.lifeArcs.jobs.some(j=>j.id===id):!now.lifeArcs.jobs.some(j=>j.id===id));}check(id+' delivers promised cash and salary',now.ledger.filter(e=>e.account==='cash'&&e.label==='完成'+id+'实际收款').reduce((n,e)=>n+e.amount,0)===offer.pay&&now.monthlyIncome===(offer.wage||0));const count=now.ledger.filter(e=>e.label==='完成'+id+'实际收款').length;await day();check(id+' delivery cannot pay twice',(await state()).ledger.filter(e=>e.label==='完成'+id+'实际收款').length===count);}
  await openLifeEntry(page,'life-rebuild');check(id+' cannot be accepted twice',await page.locator(`[data-action=life-command][data-command*='"id":"${id}"']`).isDisabled());await close();
 }
 for(const key of ['comfort','pressure','request','promise_due','disclosure','response']){
  const base=qualified();base.lifeArcs.pending=key;if(key==='pressure')base.lifeArcs.lifestyle=120000;
  for(const [choice] of lifeScene(base).choices){await load(base);await openLifeEntry(page,'life-hub');await click('[data-action=life-scene]');const before=await state(),expected=act(before,{type:'life_choice',scene:key,choice},catalog);assert.ok(!expected.lastResult.error);await click(`[data-action=life-command][data-command*='"choice":"${choice}"']`);await close();const after=await state();check(key+'/'+choice+' resolves with its actual consequence',after.cash===expected.cash&&JSON.stringify(after.lifeArcs)===JSON.stringify(expected.lifeArcs));}
 }
 for(const kind of ['partner','child','repair','succession']){const initial=qualified();initial.age=56;if(kind==='child'||kind==='succession')initial.household.partner=true;if(kind==='succession')initial.household.hasChild=true;await load(initial);await click('[data-action=tab][data-tab=people]');const before=await state(),expected=act(before,{type:'relationship',kind},catalog);await click(`[data-action=relationship][data-kind=${kind}]`);await close();const after=await state();check('relationship '+kind+' reaches a real result',!after.lastResult.error&&after.actionPoints===before.actionPoints-1&&JSON.stringify(after.household)===JSON.stringify(expected.household)&&JSON.stringify(after.relationships)===JSON.stringify(expected.relationships));}
 check('no browser exceptions',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,errors,url,coverage:{offers:6,lifeScenes:6,lifeChoices:12,relationshipActions:4}},null,2));
}catch(e){await page.screenshot({path:`${out}/FAILURE.png`});await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e);process.exitCode=1;}finally{await browser.close();}
