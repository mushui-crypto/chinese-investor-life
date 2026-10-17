import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {EVENT_ART_ASSETS,eventArt} from '../src/ui/event-art.js';
import {BEHAVIOR_EVENTS} from '../src/game/behavior-events.js';
import {createRun} from '../src/game/narrative.js';
import {lifeScene} from '../src/game/life-arcs.js';
const catalog={};for(const k of ['events','families','characters','history','endings']){const d=JSON.parse(await readFile(`data/${k}.json`));catalog[k]=k==='events'?d.events:d;}
const out=process.env.QA_REPORT_DIR||'reports/v1.26/event-art',url=process.env.GAME_URL||'http://127.0.0.1:4173';await mkdir(out,{recursive:true});
const s=createRun({seed:'event-art-26',familyId:'F01'},catalog);Object.assign(s,{age:28,phase:'planning',activeEvent:null,cash:12000000});
const lifeKeys=['comfort','pressure','request','promise_due','disclosure','response'];
const ids=[...catalog.events.map(e=>e.id),...Object.keys(BEHAVIOR_EVENTS).map(k=>'behavior:'+k),...lifeKeys.map(k=>'life:'+k)];
const checks=[],check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
check('every catalog and side event resolves to an existing illustration',ids.every(id=>Object.values(EVENT_ART_ASSETS).some(a=>a.src===eventArt(id).src)));
for(const key of lifeKeys){s.lifeArcs.pending=key;assert.equal(lifeScene(s).key,key);}
const assets=await Promise.all(Object.entries(EVENT_ART_ASSETS).map(async([key,a])=>({key,path:a.src,bytes:(await stat(a.src)).size})));
check('all illustrations exist and have descriptive alternative text',assets.length>0&&Object.values(EVENT_ART_ASSETS).every(a=>a.alt.length>8));
const {chromium}=createRequire(import.meta.url)(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(url);await page.locator('[data-action=new-game]').waitFor();
 const rendered=await page.evaluate(async({events,s,lifeKeys})=>{
  const {renderEventIntro}=await import('./src/ui/event-art.js');
  const {renderBehaviorScene}=await import('./src/ui/behavior-panel.js');
  const {renderLifeScene}=await import('./src/ui/life-panel.js');
  const {BEHAVIOR_EVENTS}=await import('./src/game/behavior-events.js');
  const {icon}=await import('./src/ui/icons.js');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ctx={esc,icon,money:n=>'¥'+n/100};
  const before=JSON.stringify(s),root=document.createElement('div');root.id='art-qa';
  root.innerHTML=events.map(e=>renderEventIntro(e,ctx)).join('')+Object.keys(BEHAVIOR_EVENTS).map(key=>{const run=structuredClone(s);run.behavior.pending=key;return renderBehaviorScene(run,ctx);}).join('')+lifeKeys.map(key=>{const run=structuredClone(s);run.lifeArcs.pending=key;return renderLifeScene(run,ctx);}).join('');document.body.append(root);
  const imgs=[...root.querySelectorAll('img')];await Promise.all(imgs.map(img=>img.decode()));
  const result={ids:[...root.querySelectorAll('[data-event-art]')].map(e=>e.dataset.eventArt),loaded:imgs.filter(img=>img.naturalWidth>0&&img.naturalHeight>0).length,sourceStateUnchanged:before===JSON.stringify(s),framingMatches:imgs.every(i=>{const f=i.parentElement.getBoundingClientRect(),r=i.getBoundingClientRect();return Math.abs(f.width/f.height-3)<.01&&Math.abs(r.width-(f.width-2))<2&&Math.abs(r.height-(f.height-2))<2&&getComputedStyle(i).objectFit==='cover';}),wideAssets:[...new Set(imgs.filter(i=>i.src.includes('-panorama-v3.webp')&&i.naturalWidth===i.naturalHeight*3).map(i=>i.src))]};root.remove();return result;
 },{events:catalog.events,s,lifeKeys});
 check('all event and side-story renderers display a decoded image',rendered.loaded===ids.length&&ids.every(id=>rendered.ids.includes(id)));
 check('all event and side-story images fill a shared 3:1 frame',rendered.framingMatches);
 check('all 13 regenerated assets have native 3:1 dimensions',rendered.wideAssets.length===13);
 check('art rendering leaves the supplied game state untouched',rendered.sourceStateUnchanged);
 check('no browser runtime errors while loading every illustration',errors.length===0);
 await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks,catalogEvents:catalog.events.length,sideEvents:ids.length-catalog.events.length,rendered,assets,totalBytes:assets.reduce((n,a)=>n+a.bytes,0),errors,url},null,2));
}catch(e){console.error(e);await writeFile(`${out}/results.json`,JSON.stringify({passed:false,checks,error:e.stack,errors},null,2));process.exitCode=1;}finally{await browser.close();}
