import {childhoodRoutine} from './growth.js';
import {beginChildhood,finishChildhood,continueChildhood} from './childhood.js';
import {createRun,chooseEvent,continueStory,nextTurn,act,eligibleChoices} from './narrative.js';
import {newJourney} from './play-guide.js';
const profiles={study:['school','self_study','study','observe','rest','family'],practical:['child_trade','self_study','school','observe','rest','family'],social:['network','family','repair','school','observe','rest']};
export function createPlayableRun(options,catalog){
 let s=createRun(options,catalog);s.journey=newJourney();
 if(options.startAt==='teen')return continueChildhood(beginChildhood(s,catalog),catalog,{fast:true,focus:options.childhood||'study'});
 // The UI starts at birth or at the protected teen stories. Keep the old adult
 // simulation for deterministic fixtures and old integrations, not as a UI skip.
 if(options.startAt!=='adult')return beginChildhood(s,catalog);
 const focus=options.childhood||'study';s.childhood.focus=focus;if(!profiles[focus])throw Error('请选择有效的童年经历');
 for(let guard=0;(s.age<18||(s.age===18&&['event','result'].includes(s.phase)))&&guard<400;guard++){
  if(s.phase==='event'){const e=catalog.events.find(e=>e.id===s.activeEvent.eventId);const cs=eligibleChoices(s,e).filter(c=>!c.disabled).sort((a,b)=>(profiles[focus].indexOf(a.profile)<0?99:profiles[focus].indexOf(a.profile))-(profiles[focus].indexOf(b.profile)<0?99:profiles[focus].indexOf(b.profile)));let resolved;for(const c of cs){const n=chooseEvent(s,e.id,c.id,catalog);if(!n.lastResult?.error){resolved=n;break;}}if(!resolved)throw Error('童年故事暂时无法继续，请使用完整人生开局');s=resolved;}
  else if(s.phase==='result')s=continueStory(s,catalog);
  else{while(s.actionPoints>0){const n=act(s,{type:childhoodRoutine(s,focus)},catalog);if(n.lastResult?.error)throw Error(n.lastResult.error);s=n;}s=nextTurn(s,catalog);}
  if(s.lastResult?.error)throw Error(s.lastResult.error);
 }
 if(s.age!==18)throw Error('成年开局未能生成');s.journey={...newJourney(),start:'adult',childhood:focus};
 s.logs.push({id:'adult-opening',turn:s.turn,age:s.age,kind:'story',title:'十八岁，轮到你自己做主',text:`童年按“${{study:'读书求知',practical:'踏实过日子',social:'亲友往来'}[focus]}”的经历走过，过程已记入人生小记。成年赠与只按原规则发放一次，接下来由你选择。`});
 return finishChildhood(s);
}
