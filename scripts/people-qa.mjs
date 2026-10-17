import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createRun} from '../src/game/narrative.js';
import {newLifeArcs} from '../src/game/life-arcs.js';
import {encodeSave,setSaveCatalog} from '../src/game/storage.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}setSaveCatalog(catalog);
const dir='reports/v1.44/people',url=process.env.GAME_URL||'http://127.0.0.1:4174';await mkdir(dir,{recursive:true});
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({reducedMotion:'reduce'}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const click=q=>page.locator(q+':visible').first().click();
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cng-v1-slot-0')).state);
function fixture(known=false){const s=createRun({seed:'contacts-ui',familyId:'F01'},catalog);Object.assign(s,{age:25,turn:20,phase:'planning',activeEvent:null,eventQueue:[],dueAnchors:[],cash:2000000,monthlyIncome:0,presentations:[]});s.lifeArcs=newLifeArcs(s);s.behavior.pending=null;s.lifeArcs.seen=['comfort','request','pressure','promise_due','disclosure','response'];s.stats.skill=46;s.childhood.finished=true;
 if(known){s.peopleMet=['N10','N04','N02','N07','N12'];s.relationships.N02=62;s.lifeArcs.memories.N04=[{age:25,day:0,text:'老周说最近厂里缺人，愿意帮你留意。'}];s.lifeArcs.promises=[{id:'N04',day:7,status:'open'}];}return s;}
async function openPeople(){await click('[data-action=load-slot]');if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');await click('.bottom-nav [data-tab=people]');await page.locator('.people-workspace').waitFor();}
async function load(s){await page.goto(url);await page.locator('[data-action=new-game]').waitFor();await page.evaluate(save=>{localStorage.clear();localStorage.setItem('cng-v1-slot-0',JSON.stringify(save));},encodeSave(s));await page.reload();await openPeople();}
async function closeResult(){if(await page.locator('#game-dialog').evaluate(e=>e.open))await click('[data-action=close-dialog]');}
try{
 await page.setViewportSize({width:1440,height:1000});await load(fixture());
 check('only family before encounters',await page.locator('.contact-picker').count()===1&&await page.locator('.contact-picker[data-person-id=N10]').count()===1);
 check('no future contacts or romance buttons',await page.locator('.people-workspace').evaluate(e=>!(/林夏|阿豪|赵姨|吴师傅|小满|确认关系/.test(e.textContent))));
 await page.screenshot({path:`${dir}/first-encounter-1440.png`});
 for(const [width,height] of [[1440,1000],[1024,768],[390,844],[320,740]]){
  await page.setViewportSize({width,height});await load(fixture(true));
  check('known contacts only '+width,await page.locator('.contact-picker').count()===5&&await page.locator('.contact-picker[data-person-id=N09]').count()===0);
  check('appointment first '+width,await page.locator('.contact-picker').first().getAttribute('data-person-id')==='N04');
  check('individual trust condition '+width,await page.locator('.contact-detail[data-person-id=N04] .contact-reason').textContent()==='与老周的熟悉与信任达到 55');
  const bounds=await page.locator('.people-workspace').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,smallButtons:[...el.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height<44).length}));
  check('readable layout and usable buttons '+width,!bounds.overflow&&!bounds.pageOverflow&&!bounds.smallButtons);
  if(await page.locator('#toast.show').count())await page.locator('#toast.show').waitFor({state:'hidden'});await page.screenshot({path:`${dir}/contacts-${width}.png`});
  const before=await state();await click('[data-person-id=N04] .contact-meeting button');await closeResult();const visited=await state();check('inline feedback keeps selection '+width,!(await page.locator('#game-dialog').evaluate(e=>e.open))&&await page.locator('.contact-detail').getAttribute('data-person-id')==='N04'&&await page.locator('.contact-feedback').count()===1);
  check('visit fulfills promise and consumes one action '+width,visited.lifeArcs.promises[0].status==='kept'&&visited.relationships.N04===58&&visited.actionPoints===before.actionPoints-1&&visited.cash===before.cash);
  check('same-day revisit disabled '+width,await page.locator('[data-person-id=N04] .contact-meeting button').isDisabled());
  await click('.contact-detail[data-person-id=N04] .contact-opportunity button');await closeResult();
  check('job now pending '+width,(await state()).lifeArcs.jobs.some(j=>j.id==='referral'&&j.due===2)&&await page.locator('[data-person-id=N04] .contact-job').isVisible());
  await page.reload();await openPeople();check('save retains encounters and pending work '+width,(await state()).peopleMet.length===5&&await page.locator('[data-person-id=N04] .contact-job').count()===1);
 }
 await page.setViewportSize({width:1440,height:1000});await load(fixture(true));
 const prior=await page.locator('.bottom-nav').boundingBox();await click('.contact-picker[data-person-id=N12]');await page.locator('.contact-history, .contact-opportunity').last().scrollIntoViewIfNeeded();const after=await page.locator('.bottom-nav').boundingBox();
 check('inner panel scroll leaves navigation fixed',prior.y===after.y&&await page.evaluate(()=>scrollY===0));
 await click('.contact-picker[data-person-id=N02]');await click('.contact-family button');await closeResult();check('relationship formed',(await state()).household.partner===true&&await page.locator('.contact-detail[data-person-id=N02] .contact-identity').textContent().then(t=>t.includes('伴侣')));
 await load(fixture(true));await click('[data-action=people-filter][data-filter=promises]');
 check('promise filter contains only appointment',await page.locator('.contact-picker').count()===1&&await page.locator('.contact-detail').getAttribute('data-person-id')==='N04');
 await click('[data-action=people-filter][data-filter=work]');check('work filter includes the three known introducers',await page.locator('.contact-picker').count()===3);
 await click('[data-action=people-filter][data-filter=all]');await click('.contact-picker[data-person-id=N02]');
 await page.locator('.contact-picker[data-person-id=N12]').focus();await page.keyboard.press('Enter');check('keyboard changes person',await page.locator('.contact-detail').getAttribute('data-person-id')==='N12');
 await page.locator('.contact-history').count().then(async count=>{if(count)await click('.contact-history summary');});
 await load(fixture());await click('[data-action=people-filter][data-filter=work]');check('empty filter gives an escape route',await page.locator('.contacts-empty [data-action=people-filter]').isVisible());await click('.contacts-empty [data-action=people-filter]');check('empty route returns to family',await page.locator('.contact-detail').getAttribute('data-person-id')==='N10');
 await load(fixture(true));await click('.bottom-nav [data-tab=life]');for(const details of await page.locator('details:has([data-action=life-rebuild])').all()){if(!await details.evaluate(d=>d.open))await details.locator(':scope > summary').click();}await click('[data-action=life-rebuild]');check('work shortcut reaches work filter without modal',await page.locator('[data-action=people-filter][data-filter=work]').getAttribute('aria-pressed')==='true'&&!(await page.locator('#game-dialog').evaluate(e=>e.open)));
 const all=fixture(true);all.peopleMet=catalog.characters.map(p=>p.id);await load(all);
 for(const p of catalog.characters){await click(`.contact-picker[data-person-id=${p.id}]`);check('portrait loads '+p.id,await page.locator('.contact-identity img').evaluate(async img=>{try{await img.decode();return img.naturalWidth>0;}catch{return false;}}));}
 for(const familyId of ['F11','F12']){const family=fixture();family.familyId=familyId;family.familyName=catalog.families.find(f=>f.id===familyId).name;await load(family);check('family portrait '+familyId,await page.locator('.contact-identity img').evaluate(async i=>{await i.decode();return i.naturalWidth>0;}));}
 check('no browser errors',errors.length===0);
 await writeFile(`${dir}/summary.json`,JSON.stringify({checks:checks.length,passed:checks,errors},null,2));
 console.log(`${checks.length} browser checks passed`);
}finally{await browser.close();}
