import {dormArt} from './dorm-art.js';
import {gameDate} from '../game/game-calendar.js';

const settlementActions=new Set(['day_next','day_activity','calendar_day','survival_day','market_tick','live_days']);
const asset=name=>`./public/assets/daily/${name}-v2.webp`;
export function wakeTransitionData(before,after){
 const r=after?.dayRoutine;
 if(!before||!after||after.phase==='ended'||after.age<18||after.legal?.prisonMonthsLeft>0||after.trading.day<=before.trading.day||!r?.wakeKind||r.stage>(r.wakeKind==='late'?2:1))return null;
 const late=r.wakeKind==='late',alarm=r.wakeKind==='alarm',tired=after.behavior.fatigue>=40;
 const kind=late?'wake-late':alarm||tired?'wake-alarm':'wake-fresh',dorm=dormArt(after,kind);
 return {kind,artPosition:dorm?`${dorm.variant===1?30:68}% 0%`:null,src:dorm?.src||asset(late?'wake-overslept':alarm||tired?'wake-alarm':'wake-fresh'),title:late?'一睁眼，已经十一点半':alarm?'闹钟把你叫醒':tired?'按时起床，还是有些困':'早睡早起，精神好多了',time:late?'11:30':'07:00',date:gameDate(after),effects:late?'昨晚没听见闹钟，起床和上午时段已跳过。':alarm?'昨晚只睡了几个小时，今天先缓一缓。':tired?'一晚休息还没缓过来，今天少透支一点。':'窗外天亮了，今天从容一点开始。',next:late?(r.pending==='overslept_class'?'上课已经迟到，接下来处理课堂的事。':r.pending==='overslept_work'?'打卡已经迟到，接下来处理考勤。':'没有课或班，今天的安排从现在开始。'):`当前疲劳 ${after.behavior.fatigue} / 100`};
}
// Presentation only: night outcomes and bills are already persisted by the engine.
export function nightTransitionData(before,after,action){
 if(!before||!after||before.age<18||before.phase!=='planning'||before.legal?.prisonMonthsLeft>0||after.phase==='ended')return null;
 const wake=wakeTransitionData(before,after);
 const settled=(after.debtClock?.day||0)-(before.debtClock?.day||0)===1;
 if(!settlementActions.has(action.type)||!settled||action.type==='day_activity'&&action.choice!=='sleep'||action.type==='live_days'&&action.days!==1)return wake;
 const night=(after.dayRoutine?.nightStreak||0)>(before.dayRoutine?.nightStreak||0);
 const changes=[['疲劳',before.behavior.fatigue,after.behavior.fatigue],['健康',before.stats.health,after.stats.health],['压力',before.stats.stress,after.stats.stress]];
 const dorm=dormArt(before,'sleep',night?'sleep-late':'sleep-calm');
 return {kind:night?'night':'sleep',artPosition:dorm?`${dorm.variant===1?30:68}% 0%`:null,src:dorm?.src||asset(night?'sleep-late':before.trading.day%2?'sleep-reading':'sleep-calm'),title:night?'两点了，终于睡下':'把今天放下，睡个好觉',time:night?'次日 02:00':'22:30',date:gameDate(before),effects:changes.filter(([,a,b])=>a!==b).map(([label,a,b])=>`${label} ${b>a?'+':'−'}${Math.abs(b-a)}`).join(' · '),next:wake?`次日 ${wake.time} · 起床`:'今天已结清',...(wake?{wake}:{})};
}
let active=null;
export const isNightTransitionActive=()=>Boolean(active);
export function playNightTransition(scene,{reduced=false,onFinish=()=>{}}={}){
 if(!scene||active)return;
 reduced ||= matchMedia('(prefers-reduced-motion: reduce)').matches;
 const frames=scene.wake?[scene,scene.wake]:[scene];
 const node=document.createElement('dialog');node.id='night-transition';
 node.setAttribute('aria-labelledby','night-transition-title');node.setAttribute('aria-describedby','night-transition-effects');
 node.innerHTML='<div class="night-transition-art"><img alt=""></div><div class="night-transition-shade" aria-hidden="true"></div><button type="button" class="button small night-transition-skip" autofocus>跳过过场</button><div class="night-transition-caption"><p class="night-transition-time"></p><h2 id="night-transition-title"></h2><p id="night-transition-effects"></p><p class="night-transition-next"></p></div>';
 const img=node.querySelector('img');let timer,fallback,transition,index=0,done=false,playing=false;
 const remove=()=>{if(!node.isConnected)return;node.close();node.remove();active=null;onFinish();};
 const finish=()=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(fallback);clearTimeout(transition);if(reduced||!playing){remove();return;}node.classList.add('is-leaving');transition=setTimeout(remove,240);};
 const advance=()=>{if(done)return;if(index+1>=frames.length){finish();return;}clearTimeout(timer);clearTimeout(fallback);node.classList.remove('is-playing');transition=setTimeout(()=>showFrame(++index),reduced?0:240);};
 const showFrame=i=>{
  if(done)return;const frame=frames[i];playing=false;
  node.className=`night-transition is-${frame.kind}${reduced?' is-reduced':''}`;
  node.querySelector('.night-transition-time').textContent=`${frame.date} · ${frame.time}`;
  node.querySelector('h2').textContent=frame.title;
  node.querySelector('#night-transition-effects').textContent=frame.effects||'今天已结清';
  node.querySelector('.night-transition-next').textContent=frame.next;
  const start=()=>{if(done||playing||i!==index)return;playing=true;clearTimeout(fallback);node.classList.add('is-playing');timer=setTimeout(advance,reduced?1200:2400);};
  img.onload=start;img.onerror=advance;
  // Missing artwork never traps the player or changes the already-saved outcome.
  fallback=setTimeout(advance,4000);img.alt=frame.title;img.style.objectPosition=frame.artPosition||'';img.style.transformOrigin=frame.artPosition||'';img.src=frame.src;if(img.complete&&img.naturalWidth)start();
 };
 active={node,finish};
 node.querySelector('button').addEventListener('click',event=>{event.stopPropagation();finish();});
 node.addEventListener('cancel',event=>{event.preventDefault();finish();});
 document.body.append(node);showFrame(0);node.showModal();node.querySelector('button').focus({preventScroll:true});
 if(!reduced)node.animate([{opacity:0},{opacity:1}],{duration:240,easing:'ease-out'});
}
