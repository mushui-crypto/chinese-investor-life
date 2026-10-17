import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createRun} from '../src/game/narrative.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir='reports/v1.58/browser',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
assert.notEqual(new URL(url).port,'4173','QA must not use the player origin');
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const click=q=>page.locator(q+':visible').first().click();
async function choose(q,value){const sel=page.locator(q),label=await sel.locator(`option[value="${value}"]`).textContent();await sel.locator('..').locator('.game-select-trigger').click();await page.getByRole('option',{name:label,exact:true}).click();}
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function fixture(stage='engaged'){
 const s=createRun({seed:'family-ui',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:10000000,monthlyIncome:300000,presentations:[]});
 s.lifeArcs=newLifeArcs(s);s.behavior.pending=null;s.lifeArcs.seen=['comfort','request','pressure','promise_due','disclosure','response'];s.childhood.finished=true;
 s.peopleMet=['N10','N02'];s.household.partner=true;s.relationships.N02=70;s.relationships.partner=70;s.education.college=false;s.flags.college_not_admitted=true;
 s.trading.calendar={turn:s.turn,day:s.trading.day,date:'2013-01-01'};
 Object.assign(s.familyLife,{stage,metOn:stage==='married'?'2009-01-01':'2011-01-01',startedOn:stage==='married'?'2010-01-01':'2011-03-01',wallet:500000,visits:4,seen:{lastStory:'2013-01-01'}});
 return s;
}
async function openPeople(){await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=people]');await click('.contact-picker[data-person-id=N02]');}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await openPeople();}
async function closeResult(){if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');}
async function bounds(selector){return page.locator(selector).evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,smallButtons:[...el.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0&&b.getBoundingClientRect().height<44).length}));}
try{
 for(const [width,height] of [[1440,1000],[1024,768],[390,844],[320,740]]){
  await page.setViewportSize({width,height});await load(fixture());
  check('relationship hierarchy '+width,(await page.locator('.family-panel').textContent()).includes('筹备婚礼'));
  let b=await bounds('.family-panel');console.log('panel bounds',b);check('people panel fits '+width,!b.overflow&&!b.pageOverflow&&!b.smallButtons);
  await page.screenshot({path:`${dir}/relationship-${width}.png`});
  const before=await state();await click('[data-action=family-wedding-open]');
  check('opening quote does not spend '+width,(await state()).cash===before.cash);
  b=await bounds('#family-wedding-form');check('wedding form fits '+width,!b.overflow&&!b.pageOverflow&&!b.smallButtons);
  check('amounts are presets '+width,await page.locator('#family-wedding-form input[type=number]').count()===0&&await page.locator('#family-wedding-form select').count()===4);
  await choose('#wedding-home','owned');check('missing home blocks confirm '+width,await page.locator('#family-wedding-form [type=submit]').isDisabled());
  await choose('#wedding-home','rent');
  await choose('#wedding-gift','6880000');await choose('#wedding-feast','8000000');check('unaffordable quote blocks confirm '+width,await page.locator('#family-wedding-form [type=submit]').isDisabled());
  await choose('#wedding-gift','1880000');await choose('#wedding-feast','1000000');
  await page.screenshot({path:`${dir}/wedding-${width}.png`});
  await click('#family-wedding-form [type=submit]');const wed=await state();check('payment and date '+width,wed.cash===before.cash-2440000&&wed.familyLife.wallet===0&&wed.familyLife.marriedOn==='2013-01-01');
  check('correct wedding result image '+width,await page.locator('#game-dialog [data-art-key=family-wedding]').count()===1);
  await closeResult();await click('.family-panel [data-action=life-scene]');await click('#game-dialog [data-action=life-command][data-command*="balanced"]');await closeResult();
  check('shared budget chosen '+width,(await state()).familyLife.householdMonthly===180000&&(await state()).familyLife.pending===null);
  await click('.family-panel [data-action=family-budget-open]');await click('#game-dialog [data-action=family-command][data-command*="60000"]');await closeResult();check('date budget chosen '+width,(await state()).familyLife.romanceBudget===60000);
  await click('.family-panel [data-action=chapter-bills]');check('bill contains marriage '+width,(await page.locator('#game-dialog').textContent()).includes('彩礼'));await closeResult();
  await page.reload();await openPeople();check('reload preserves marriage '+width,(await state()).familyLife.marriedOn==='2013-01-01'&&(await state()).cash===wed.cash);
 }
 await page.setViewportSize({width:1440,height:1000});const baby=fixture('married');baby.familyLife.marriedOn='2010-12-01';baby.household.hasChild=true;baby.household.childBornOn='2013-01-01';baby.peopleMet.push('N09');baby.relationships.N09=60;
 await load(baby);await click('.contact-picker[data-person-id=N09]');check('newborn uses own age',await page.locator('.contact-detail').textContent().then(t=>t.includes('新生儿')&&t.includes('陪伴照护')));check('newborn portrait loads',await page.locator('.contact-detail .contact-identity img').evaluate(async i=>{await i.decode();return i.naturalWidth>0&&i.src.includes('family-newborn-hospital');}));check('no adolescent portrait',await page.locator('.contact-detail img[src$="N09.webp"]').count()===0);await page.screenshot({path:`${dir}/newborn.png`});
 for(const key of ['meet','confession','birthday','return_gift','disagreement','her_work','marriage','family_budget','baby_plan','prenatal','baby_supplies','birth','childcare','school','adulthood','reconnect']){
  const s=fixture('married');s.familyLife.marriedOn='2010-12-01';s.familyLife.pending=key;s.familyLife.pendingOn='2013-01-01';s.lifeArcs.pending='family';await load(s);await click('.family-panel [data-action=life-scene]');
  check('story art loads '+key,await page.locator('#game-dialog .event-illustration img').evaluate(async i=>{await i.decode();return i.naturalWidth>0&&Math.abs(i.getBoundingClientRect().width/i.getBoundingClientRect().height-3)<.03;}));
  if(key==='birth')await page.screenshot({path:`${dir}/birth-story.png`});
  await page.keyboard.press('Escape');check('escape closes story '+key,!(await page.locator('#game-dialog').evaluate(e=>e.open)));
 }
 const late=fixture('married');late.age=40;late.trading.calendar.date='2028-01-01';Object.assign(late.familyLife,{marriedOn:'2013-01-01',pending:'birth',pendingOn:'2028-01-01',pregnancyOn:'2027-04-06',childPlan:'expecting'});late.lifeArcs.pending='family';await load(late);await click('.family-panel [data-action=life-scene]');check('older parents get age-safe hospital art',await page.locator('[data-art-key=family-newborn-hospital] img').evaluate(async i=>{await i.decode();return i.naturalWidth>0;}));
 check('no runtime errors',errors.length===0);await writeFile(`${dir}/summary.json`,JSON.stringify({checks:checks.length,passed:checks,errors},null,2));console.log(`${checks.length} browser checks passed`);
}catch(error){await page.screenshot({path:`${dir}/FAILURE.png`});throw error;}finally{await browser.close();}
