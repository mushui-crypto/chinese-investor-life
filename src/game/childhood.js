import {needsStudentChoice} from './student-stories.js';
import {childhoodRoutine} from './growth.js';
import {chooseEvent,continueStory,nextTurn,act,eligibleChoices,leaveUnavailableEvent} from './narrative.js';
import {applyAction} from './core.js';
import {childState} from './childhood-state.js';
import {birthStory,isBirthIntro} from './birth-story.js';
import {nextChildhoodAge} from './childhood-stages.js';
import {needsTeenChoice} from './teen-stories.js';
const profiles={study:['school','self_study','study','observe','rest','family'],practical:['child_trade','self_study','school','observe','rest','family'],social:['network','family','repair','school','observe','rest']};
function resolve(s,catalog){for(let guard=0;['event','result'].includes(s.phase)&&guard<40;guard++){
 if(needsTeenChoice(s)||needsStudentChoice(s))return s;
 if(s.phase==='result'){s=continueStory(s,catalog);continue;}
 const e=catalog.events.find(e=>e.id===s.activeEvent.eventId),rank=profiles[childState(s).focus],cs=eligibleChoices(s,e).filter(c=>!c.disabled).sort((a,b)=>(rank.includes(a.profile)?rank.indexOf(a.profile):99)-(rank.includes(b.profile)?rank.indexOf(b.profile):99));
 if(!cs.length){s=leaveUnavailableEvent(s,catalog);continue;}
 s=chooseEvent(s,e.id,cs[0].id,catalog);if(s.lastResult?.error)throw Error(s.lastResult.error);
 }if(['event','result'].includes(s.phase))throw Error('这一段童年暂时没有处理完');return s;}
function grow(s,target,catalog,{autoArrange=false}={}){for(let guard=0;s.age<target&&guard<120;guard++){
 s=resolve(s,catalog);
 if(needsTeenChoice(s)||needsStudentChoice(s))return s;
 if(target===18&&nextChildhoodAge(s.age)>=18&&s.childhood.inventory){const r=applyAction(s,{type:'child_clear'});if(r.result.error)throw Error(r.result.error);s=r.state;}
 if(autoArrange)while(s.actionPoints>0){const next=act(s,{type:childhoodRoutine(s,childState(s).focus)},catalog);if(next.lastResult?.error)throw Error(next.lastResult.error);s=next;}
 s=nextTurn(s,catalog);if(s.lastResult?.error)throw Error(s.lastResult.error);
 }if(s.age!==target)throw Error('成长没有到达下一节点');return s;}
export function finishChildhood(s){const c=childState(s);if(s.age>=18&&!c.summary){c.step='grown';c.summary={path:c.focus,cash:s.cash,gift:s.adultGift,purchases:c.purchases,receipts:c.receipts,academic:s.stats.academic,discipline:s.stats.discipline,skill:s.stats.skill,insight:s.stats.insight,trust:s.stats.trust,college:s.education?.college,admissionScore:s.education?.admissionScore};s.logs.push({id:'childhood-summary',age:s.age,turn:s.turn,kind:'story',title:'十八岁，带着这些出发',text:`手中现金 ${s.cash/100} 元，成年赠与 ${s.adultGift/100} 元仅发放一次。学业 ${s.stats.academic}，自律 ${s.stats.discipline}；升学结算 ${s.education?.college?'进入大学':'未被大学录取，先进入社会'}。`});}return s;}
export function beginChildhood(s,catalog){
 s=structuredClone(s);const c=childState(s);c.mode='short';c.step='story';c.birth={version:1,page:0,complete:false};
 const opening=s.logs.find(l=>l.title==='人生开局'),story=birthStory(s);
 if(opening){opening.title='出生：'+s.familyName;opening.text=story.pages.map(p=>p.text.join('')).join('\n');}
 return s;
}
export function skipBirth(state,catalog){
 if(!isBirthIntro(state))return state;
 let s=structuredClone(state);s.childhood.birth.complete=true;s=grow(s,3,catalog);s.childhood.step=s.phase==='planning'?'play':'story';return s;
}
export function continueChildhood(state,catalog,{fast=false,focus}={}){
 if(state.age>=18)return state;let s=structuredClone(state);const c=childState(s);if(focus){if(!profiles[focus])throw Error('没有这种成长方向');c.focus=focus;}
 if(!fast&&s.phase==='event')return state;
 if(c.birth)c.birth.complete=true;
 if(fast){s=grow(s,18,catalog,{autoArrange:true});s.childhood.step=s.age>=18?'grown':s.phase==='event'?'story':'play';return finishChildhood(s);}
 if(s.phase==='result'){
  const wasBirth=s.age===0;s=continueStory(s,catalog);
  if(s.phase==='event'){s.childhood.step='story';return s;}
  if(!wasBirth){s.childhood.step='play';return s;}
 }
 const target=nextChildhoodAge(s.age);s=grow(s,target,catalog);s.childhood.step=s.age>=18?'grown':s.phase==='planning'?'play':'story';return finishChildhood(s);
}
