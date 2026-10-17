import {chooseGameOption} from './game-control-helpers.mjs';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,act} from '../src/game/narrative.js';
import {getMetrics,PRODUCTS} from '../src/game/core.js';
import {maximumOrder} from '../src/game/order-budget.js';
import {quoteFor} from '../src/game/market-play.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {newChildhood} from '../src/game/childhood-state.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const out=process.env.QA_REPORT_DIR||'reports/v1.12/browser',url=process.env.GAME_URL||'http://127.0.0.1:4173';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS',name);};
const current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0'))?.state);
const click=sel=>page.locator(sel+':visible').first().click();
const close=async()=>{if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');};
const shot=async(name,selector)=>{if(selector)await page.locator(selector).scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${name}.png`});};
function adult(cash=2378491,wage=0){const s=createRun({seed:'budget-browser',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash,monthlyIncome:wage,giftReceived:true});s.stats.insight=90;s.stats.skill=60;s.stats.trust=60;s.marketProgress={firstExperienceAge:18,simulations:3,unlocked:Object.fromEntries(Object.keys(PRODUCTS).map(k=>[k,true]))};s.lifeArcs=newLifeArcs(s);return s;}
async function load(s){await page.goto(url);await page.locator('#app button').first().waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await click('[data-action=load-slot]');await close();}
async function open(product){await click('[data-action=tab][data-tab=market]');await click(`[data-action=${product==='gambling'?'desk-open':'invest'}][data-product=${product}]`);}
const budget=()=>page.locator('.cash-budget').first();
const budgetLabels=async()=>{const txt=await budget().innerText();return ['当前现金','本期剩余生活费','留足生活费后剩余'].every(l=>txt.includes(l));};
const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
try{
 await page.goto(url);await click('[data-action=new-game]');await page.locator('.advanced-options summary').click();await chooseGameOption(page,'#family','F01');await page.locator('#seed').fill('prologue-ui');await click('#new-game-form [type=submit]');check('full life starts at birth', (await current()).age===0);await click('[data-action=birth-skip]');check('skipping the opening reaches age 6', (await current()).age===6);let decisions=0,continues=0,played=false;
 while((await current()).age<18&&continues<8){const s=await current();if(s.phase==='event'){await click('[data-action=choose]:not([disabled])');decisions++;}else if(s.phase==='planning'&&s.age>=12&&!played){
  const before=await current();await page.locator('#child-market-form [name=quantity]').fill('2');await click('#child-market-form [type=submit]');check('child stock purchase uses actual pocket money',(await current()).cash===before.cash-2400);
  await click('[data-action=child-command][data-command*="1.25"]');const locked=await current();await page.reload();await click('[data-action=load-slot]');check('reload keeps quoted buyer and RNG',JSON.stringify((await current()).childhood.offer)===JSON.stringify(locked.childhood.offer)&&(await current()).rng===locked.rng);
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});check('childhood fits '+width,await overflow());await shot('child-market-'+width,'.child-offer');}
  await click('[data-action=child-command][data-command*=child_sell]');check('child sale pays quoted amount once',(await current()).cash===locked.cash+locked.childhood.offer.total);await click('.inline-receipt>details>summary');check('child sale joke is readable in receipt details',await page.locator('.action-quip').innerText().then(x=>x.includes('营业额')));played=true;
 }else{await click(s.phase==='result'?'[data-action=continue]':'[data-action=life-continue]');continues++;}}
 check('three milestone decisions reach adulthood',decisions<=3&&(await current()).age===18);check('adult summary appears and gift paid once',await page.locator('.childhood-summary').count()===1&&(await current()).ledger.filter(l=>l.label==='成年一次性赠与').length===1);
 // Load a legacy young save; the fast-forward must preserve its existing cash/story identity.
 const young=createRun({seed:'old-prologue',familyId:'F01'},catalog);Object.assign(young,{age:12,turn:6,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[]});delete young.childhood;await load(young);await click('.childhood-path>summary');await click('[data-action=child-fast-forward]');check('old young save fast-forwards to 18 with one gift',(await current()).age===18&&(await current()).ledger.filter(l=>l.label==='成年一次性赠与').length===1);
 // Remaining living includes elapsed days. UI across life and market uses the same exact numbers.
 let s=act(adult(2378491),{type:'calendar_day'},catalog);await load(s);check('life page shows all three budget amounts',await budgetLabels());check('life budget subtracts already settled expenses',await budget().locator('[data-budget=living]').innerText().then(t=>Number(t.replace(/[^\d.]/g,''))*100===getMetrics(s).livingReserve));
 await click('[data-action=tab][data-tab=market]');check('market overview shows same three amounts',await budgetLabels());
 for(const [region,instrument] of [['a','chip'],['hk','hk_property'],['us','us_compute']]){
  s=adult();await load(s);await open('stock');if(region!=='a')await click(`[data-action=stock-market][data-id=${region==='hk'?'hk_platform':'us_compute'}]`);if(instrument!=='chip')await click(`[data-action=desk-instrument][data-id=${instrument}]`);
  const form=page.locator('#desk-order');await form.locator('[data-action=desk-budget][data-fraction="1"]').click();const expected=maximumOrder(s.cash,{product:'stock',instrument,price:quoteFor(s,'stock',instrument).price});
  check(region+' all-in uses maximum whole lots or shares',Number(await form.locator('[name=lots]').inputValue())===expected.lots);check(region+' budget warning allows confirm',await form.locator('.cash-warning.shortfall').count()===1&&!await form.locator('[type=submit]').isDisabled());
  await form.locator('[name=lots]').fill(String(expected.lots+1));check(region+' actual cash shortage disables submit',await form.locator('[type=submit]').isDisabled());await form.locator('[data-action=desk-budget][data-fraction="1"]').click();
  for(const width of region==='a'?[320,390,768,1440]:[390,1440]){await page.setViewportSize({width,height:1100});check(region+' ticket fits '+width,await overflow());await shot(region+'-all-in-'+width,'#desk-order .cash-warning');}
  const before=await current();await form.locator('[type=submit]').click();await close();const after=await current();check(region+' all-in deducts exact cash and preserves holdings',after.cash===before.cash-expected.amount&&after.positions[0].shares===expected.shares&&after.cash>=0);check(region+' order never adds a mandatory checkbox',await page.locator('[name=reckless]').count()===0);
 }
 // Warnings follow input immediately, then lead to the right work buttons.
 s=adult(600000);await load(s);await open('fund');const f=page.locator('#desk-order');await f.locator('[name=amount]').fill('5000.13');check('warning updates down to cents',await f.locator('.cash-warning').innerText().then(t=>t.includes('999.87')));check('live preview leaves RNG and cash unchanged',(await current()).rng===s.rng&&(await current()).cash===s.cash);
 await f.locator('.cash-warning [data-action=go-work]').click();check('go-work focuses an available paid action',await page.evaluate(()=>['work','gig'].includes(document.activeElement.dataset.type)));check('work pay versus salary explained on action buttons',await page.locator('.arrangements [data-type=work]').innerText().then(t=>t.includes('到账')&&t.includes('¥'))&&await page.locator('.arrangements [data-type=seek_job]').innerText().then(t=>t.includes('固定月薪')&&t.includes('随时间到账')));const beforeWork=await current();await click('[data-type=work]');await close();check('work pays cash immediately',(await current()).cash>beforeWork.cash);
 // Spend every cent on a locked asset; next day creates a bill and survival, without liquidation.
 s=adult(600000);await load(s);await open('fund');await click('[data-action=desk-budget][data-fraction="1"]');await click('#desk-order [type=submit]');await close();let zero=await current();check('fund all-in reaches zero while holding remains',zero.cash===0&&zero.positions.length===1);check('existing rescue flow opens after zero cash',zero.survival.active);await click('[data-action=life-continue]');await close();const billed=await current();check('next day bills normally, no free money or forced sale',billed.cash===0&&billed.positions.length===1&&billed.survival.livingAccrued>0&&billed.debts.some(d=>d.kind==='arrears'));
 // Crypto preserves its distinct ticket and high leverage; reduced motion works on new motion.
 s=adult(600000);await load(s);await open('crypto');await click('[data-action=crypto-mode][data-mode=perp]');await chooseGameOption(page,'[name=leverage]','100');await click('[data-action=desk-budget][data-fraction="1"]');check('100x uses full cash as margin',await page.locator('#desk-order [name=amount]').inputValue()==='6000.00'&&!await page.locator('#desk-order [type=submit]').isDisabled());
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});check('crypto cash warning fits '+width,await overflow());await shot('crypto-budget-'+width,'#desk-order .cash-warning');}
 await click('#desk-order [type=submit]');await close();check('crypto all-in retains 100x day contract',(await current()).positions[0].leverage===100&&(await current()).positions[0].sameDay);check('reduced motion suppresses new receipt animation',await page.locator('.inline-receipt').evaluate(e=>getComputedStyle(e).animationName==='none'));
 s=adult();await load(s);await open('stock');await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#desk-order [type=submit]').click();const animations=await page.evaluate(()=>document.getAnimations().map(a=>a.animationName));check('completed order triggers a short motion',animations.includes('action-arrival'));await page.waitForTimeout(250);check('motion finishes without blocking input',!await page.locator('#desk-order [type=submit]').isDisabled());
 check('no browser exceptions',errors.length===0);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors,url,childhood:{decisions,continues}},null,2));
} catch(e){await page.screenshot({path:`${out}/failure.png`});console.error(await page.locator('#toast').innerText());throw e;}finally{await browser.close();}
