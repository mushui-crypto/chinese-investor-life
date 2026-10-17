const reportDir=process.env.QA_REPORT_DIR||'reports/v1.4';
import {createRequire} from 'node:module';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun, continueStory, chooseEvent, nextTurn, eligibleChoices} from '../src/game/narrative.js';
import {setSaveCatalog, encodeSave, decodeSave, checksum} from '../src/game/storage.js';

const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(process.env.PLAYWRIGHT_PATH||`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);}
const catalog={};
for(const name of ['events','families','history','endings','characters']){const value=JSON.parse(await readFile(`data/${name}.json`,'utf8'));catalog[name]=name==='events'?value.events:value;}
setSaveCatalog(catalog);
const safe=['observe','uw_quit','self_study','school','rest','prison_study','prison_reflect','prison_letter','legal_cooperate','family','network','repair','job','work'];
const ranked=choices=>choices.sort((a,b)=>(safe.includes(a.profile)?safe.indexOf(a.profile):99)-(safe.includes(b.profile)?safe.indexOf(b.profile):99));
const eventAt=id=>catalog.events.find(e=>e.id===id);
function resolveNode(state){
 for(let guard=0;guard<30;guard++){
  if(state.phase==='result'){state=continueStory(state,catalog);continue;}
  if(state.phase!=='event')return state;
  const event=eventAt(state.activeEvent.eventId),choice=ranked(eligibleChoices(state,event).filter(c=>!c.disabled))[0];
  assert.ok(choice,event.id+' has an enabled choice');
  state=chooseEvent(state,event.id,choice.id,catalog);assert.equal(state.lastResult?.error,undefined,event.id+' resolves');
 }
 throw Error('Fixture story queue did not drain');
}
function adult(){
 let state=createRun({name:'案卷试玩',seed:'v1.1-legal-ui',familyId:'F01'},catalog);
 while(state.age<18){state=resolveNode(state);state=nextTurn(state,catalog);}
 state=resolveNode(state);state.monthlyIncome=180000;return state;
}
function show(state,id){const shown=continueStory({...state,phase:'planning',activeEvent:null,eventQueue:[id]},catalog);assert.equal(shown.activeEvent?.eventId,id);return shown;}
const browser=await playwright.chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const url=process.env.GAME_URL||'http://127.0.0.1:4173';
await mkdir(reportDir+'/legal',{recursive:true});
const readState=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0'))?.state);
const check=(name,pass=true)=>{assert.ok(pass,name);checks.push(name);console.log('PASS',name);};
const click=async selector=>{if(!selector.includes('close-dialog')&&await page.locator('.rescue-menu').isVisible())await page.locator('#game-dialog [data-action=close-dialog]').first().click();await page.locator(selector+':visible').first().click();};
const shot=name=>page.screenshot({path:`${reportDir}/legal/${name}.png`,fullPage:true,animations:'disabled'});
const close=async()=>{if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('#game-dialog [data-action=close-dialog]');};
async function install(state,envelope=encodeSave(state)){
 await page.goto(url);await page.locator('[data-action=new-game]').waitFor();
 // This is an isolated Playwright context, never the user's browser or save slots.
 await page.evaluate(save=>localStorage.setItem('cng-v1-slot-0',JSON.stringify(save)),envelope);
 await page.reload();await click('[data-action=load-slot][data-slot="0"]');
 await page.locator('.story-panel,.period-console').first().waitFor();
}
async function choose(profile){const state=await readState(),choice=eventAt(state.activeEvent.eventId).choices.find(c=>c.profile===profile);assert.ok(choice,profile);await click(`[data-choice="${choice.id}"]`);assert.equal((await readState()).phase,'result');}
async function resolveUI(){
 await close();
 for(let guard=0;guard<30;guard++){
  const state=await readState();
  if(state.phase==='result'){await click('[data-action=continue]');continue;}
  if(state.phase!=='event')return state;
  const choices=await page.locator('.choice:not([disabled])').evaluateAll(bs=>bs.map(b=>b.dataset.choice));
  const choice=ranked(eventAt(state.activeEvent.eventId).choices.filter(c=>choices.includes(c.id)))[0];
  assert.ok(choice,'enabled choice');await click(`[data-choice="${choice.id}"]`);
  assert.equal((await readState()).phase,'result','a safe story choice must resolve');
 }
 throw Error('Browser story queue did not drain');
}
const tab=id=>click(`[data-action=tab][data-tab=${id}]`);
async function advance(){
 await close();await tab('life');await resolveUI();const start=(await readState()).turn;
 for(let i=0;i<80;i++){
  const state=await readState();if(state.turn>start||state.phase==='ended')return state;
  if(await page.locator('#game-dialog').evaluate(e=>e.open)){
   const bs=page.locator('#game-dialog [data-action=life-command]:not([disabled]),#game-dialog [data-action=behavior-do]:not([disabled])');
   if(await bs.count()){const commands=await bs.evaluateAll(xs=>xs.map(x=>JSON.parse(x.dataset.command)));const index=commands.findIndex(c=>['steady','cut','decline','tell','read','leave','honest','truth','sleep','plan','keep','balance'].includes(c.choice));await bs.nth(index<0?0:index).click();}else await close();
  }else await click('[data-action=life-continue]');
 }
 throw Error('Continuation checkpoints did not reach next period');
}
async function fits(label){check(label,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}

try{
 const base=adult();
 const legacy=structuredClone(base);delete legacy.legal;const legacyEnvelope={format:'中国式赌狗',version:1,savedAt:new Date().toISOString(),checksum:checksum(JSON.stringify(legacy)),state:legacy};
 await install(base,legacyEnvelope);
 check('legacy save loads without losing RNG, cash or history',await page.locator('.story-panel,.period-console').first().isVisible()&&decodeSave(legacyEnvelope).rng===base.rng&&decodeSave(legacyEnvelope).cash===base.cash);
 await tab('legal');check('legacy save has an empty legal record',await page.locator('.case-row').count()===0);

 await install(show(adult(),'UG01'));await choose('uw_quit');
 let state=await readState();check('refusing first invitation creates neither offense nor false recovery achievement',state.legal.cases.length===0&&!state.flags.gambling_history&&!state.flags.gambling_quit);

 await install(show(adult(),'UG01'));await choose('uw_gamble');state=await readState();
 check('online gambling story records participation without instant imprisonment',state.legal.cases.length===1&&state.legal.cases[0].type==='gambling'&&state.legal.prisonMonthsLeft===0);
 await resolveUI();await tab('legal');await click('[data-action=legal-case]');
 check('unresolved case does not reveal future sentence or bill',await page.locator('.case-bill').count()===0&&await page.locator('.case-step:not(.done)').count()===3);await close();
 let guard=0;
 while(!(await readState()).legal.cases[0].settled&&guard++<8){await advance();await close();}
 state=await readState();check('gambling participation resolves administratively without prison',state.legal.cases[0].status==='admin_closed'&&state.legal.prisonMonthsLeft===0&&!state.flags.ever_convicted);
 await resolveUI();await tab('legal');await shot('18-gambling-administrative-desktop');

 let criminal=show(adult(),'UG01');const gamble=eventAt('UG01').choices.find(c=>c.profile==='uw_gamble');criminal=resolveNode(chooseEvent(criminal,'UG01',gamble.id,catalog));
 await install(show(criminal,'UG03'));await choose('uw_promote');await resolveUI();state=await readState();
 const caseId=state.legal.cases.find(c=>c.type==='gambling_promotion').id;
 check('knowingly promoting gambling creates a distinct criminal case',state.legal.cases.length===2&&state.legal.cases.find(c=>c.id===caseId).profit===8000000);
 let statuses=[state.legal.cases.find(c=>c.id===caseId).status];guard=0;
 while(!(await readState()).legal.cases.find(c=>c.id===caseId).settled&&guard++<8){
  state=await advance();statuses.push(state.legal.cases.find(c=>c.id===caseId).status);
  if(state.legal.prisonMonthsLeft>0){
   check('judgment opens a bill at the moment of conviction',await page.locator('#game-dialog').evaluate(e=>e.open)&&await page.locator('.case-bill').count()===1);
   await shot('19-criminal-judgment-desktop');
  }
  await close();
 }
 state=await resolveUI();const sentence=state.legal.prisonMonthsLeft,caseSnapshot=structuredClone(state.legal.cases.find(c=>c.id===caseId));
 check('case progresses through clues, investigation and conviction', ['pending','exposed','investigating','convicted'].every(s=>statuses.includes(s)));
 check('conviction starts prison and keeps unpaid financial obligations',sentence>0&&state.flags.in_prison&&state.debts.some(d=>d.kind==='legal'&&d.legalComponent==='restitution'));
 check('prison offers three special activities',await page.locator('[data-action=life-action][data-type^="prison_"]').count()===3);
 check('prison removes outside work from daily arrangements',await page.locator('[data-action=life-action][data-type=seek_job]').count()===0);
 check('prison scene artwork is loaded',await page.locator('img[src*="life-prison"]').evaluate(img=>img.complete&&img.naturalWidth>0));
 await shot('20-prison-desktop');await fits('desktop prison fits viewport');
 await click('[data-action=life-action][data-type=prison_study]');check('prison study consumes one action without reducing sentence',(await readState()).actionPoints===state.actionPoints-1&&(await readState()).stats.skill>=state.stats.skill&&(await readState()).legal.prisonMonthsLeft===sentence);await close();
 await tab('market');await click('[data-action=invest][data-product=stock]');check('new market orders are disabled in prison',await page.locator('#desk-order [type=submit]').isDisabled());
 await tab('people');check('outside relationship actions are disabled in prison',await page.locator('[data-action=relationship]:not([disabled])').count()===0);
 await tab('legal');await page.setViewportSize({width:390,height:844});await shot('21-legal-prison-mobile');await fits('mobile case ledger fits viewport');await click(`[data-action=legal-case][data-id="${caseId}"]`);await fits('mobile judgment fits viewport');await shot('22-judgment-mobile');await close();
 await tab('life');await fits('mobile prison fits viewport');await shot('23-prison-mobile');
 const saved=await readState();await page.reload();await click('[data-action=load-slot]');state=await readState();
 check('prison save reload preserves sentence, debts and random state',JSON.stringify(state.legal)===JSON.stringify(saved.legal)&&JSON.stringify(state.debts)===JSON.stringify(saved.debts)&&state.rng===saved.rng);
 guard=0;
 while((await readState()).legal.prisonMonthsLeft>0&&guard++<20){await advance();await close();}
 state=await readState();
 check('sentence finishes and releases player',state.legal.prisonMonthsLeft===0&&state.flags.ever_released&&!state.flags.in_prison&&state.legal.servedPrisonMonths===sentence);
 check('release does not forgive outstanding restitution',state.debts.some(d=>d.kind==='legal'&&d.legalComponent==='restitution'&&d.principal+d.interest>0));
 check('case is not charged again after release',JSON.stringify(state.legal.cases.find(c=>c.id===caseId))===JSON.stringify(caseSnapshot));
 check('previous job does not silently return',state.monthlyIncome===0&&state.occupation==='出狱后待业');
 await resolveUI();await page.setViewportSize({width:1440,height:950});await shot('24-release-desktop');
 check('ordinary job seeking returns after release',await page.locator('.arrangements [data-action=life-action][data-type=seek_job]').count()===1);
 if((await readState()).actionPoints===0){await advance();await resolveUI();}
 await click('[data-action=life-action][data-type=seek_job]');await close();state=await readState();
 check('released player can find a legitimate job again',state.monthlyIncome>0&&state.flags.reentry_employed);
 await tab('legal');await shot('25-legal-after-release');
 check('no browser runtime errors',errors.length===0);
 await writeFile(reportDir+'/legal-browser.json',JSON.stringify({passed:true,date:new Date().toISOString(),browser:await browser.version(),url,checks,errors,run:{caseId,sentenceMonths:sentence,releaseAge:state.age,caseCount:state.legal.cases.length}},null,2));
 console.log(`Legal browser acceptance passed: ${checks.length} checks.`);
}catch(error){await shot('LEGAL-FAILURE');await writeFile(reportDir+'/legal-browser.json',JSON.stringify({passed:false,checks,errors,error:error.stack},null,2));console.error(error);process.exitCode=1;}finally{await browser.close();}
