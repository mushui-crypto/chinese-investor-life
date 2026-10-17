import {birthStory} from '../game/birth-story.js';
import {eligibleChoices} from '../game/narrative.js';

// Keep family-specific caregivers in the scene, rather than overlaying a tiny infant sprite.
export function birthScene(s){
 const key=s.familyId==='F11'?'mother':s.familyId==='F12'?'grandmother':birthStory(s).scene;
 const descriptions={hospital:'病床边，父母和护士照看怀里的新生儿',home:'回到家，父母坐在床边照看新生儿',suite:'单人病房里，父母抱着新生儿',mother:'夜里，妈妈在病床上抱着孩子',grandmother:'外婆坐在床边，抱着刚回家的孩子'};
 return {key,src:`./public/assets/birth-${key}-v2.webp`,alt:descriptions[key]};
}
export function renderBirth(s,catalog,{esc,icon,header,renderStatChanges}){
 const scene=birthScene(s),story=birthStory(s),page=s.childhood.birth.page,result=s.phase==='result',event=catalog.events.find(e=>e.id==='MAIN01');
 const title=result?'日子就这样开始了':page<2?story.pages[page].title:'你的小小反应';
 const paragraphs=result?[s.lastResult?.text||'你在家人的照看下，安安稳稳地睡着了。']:page<2?story.pages[page].text:[event.prompt];
 const choices=!result&&page===2?`<div class="choices birth-choices">${eligibleChoices(s,event).map((c,i)=>`<button class="choice" data-action="choose" data-event="${event.id}" data-choice="${c.id}" ${c.disabled?'disabled':''}><span class="choice-number">${i+1}</span><span class="choice-content"><strong>${esc(c.label)}</strong>${c.disabled?`<small>${esc(c.reason)}</small>`:''}</span>${icon('chevron')}</button>`).join('')}</div>`:'';
 return `<div class="game-shell birth-shell">${header}<main class="birth-stage" aria-labelledby="birth-title"><div class="birth-backdrop" data-birth-art="${scene.key}"><img src="${scene.src}" alt="${scene.alt}" fetchpriority="high"></div><section class="birth-paper" data-birth-page="${result?'result':page}" data-birth-scene="${story.scene}"><div class="birth-topline"><span>${icon('sun')} ${esc(story.place)}</span><span>${esc(s.familyName)}</span></div><div class="birth-chapter">人生的第一页 <span aria-label="${result?'出生故事已读完':`第 ${page+1} 页，共 3 页`}">${['出生','家里人','最初的反应'].map((label,i)=>`<i class="${i===page?'current':''}" ${i===page?'aria-current="step"':''}>${label}</i>`).join('<b aria-hidden="true">·</b>')}</span></div><h1 id="birth-title" tabindex="-1">${esc(title)}</h1><div class="birth-prose">${paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div>${choices}${result?renderStatChanges(s.lastResult?.statChanges):''}<footer class="birth-footer">${!result&&page<2?`<button class="text-button birth-skip" data-action="birth-skip">跳过开头，去幼儿园</button><button class="button primary" data-action="birth-next" data-page="${page}">${page===0?'看看家里人':'继续'} ${icon('arrow')}</button>`:result?`<p>吃饭，睡觉，学走路。<br>转眼到了背上小书包的年纪。</p><button class="button primary" data-action="birth-finish">上幼儿园 · 3 岁 ${icon('arrow')}</button>`:''}</footer></section></main></div>`;
}
