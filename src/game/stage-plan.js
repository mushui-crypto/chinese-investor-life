import {lifeChapter} from './life-chapters.js';
import {dailyEventRole,chooseActivity,dayGigPay,ensureRoutine,dailyEventPool,DAILY_EVENTS} from './day-routine.js';
import {showWorkStory} from './work-stories.js';
import {workLimitReason} from './work-economy.js';

const day=s=>s.debtClock?.day||0;
export function stageOptions(s){
 const role=dailyEventRole(s);
 return [
  {id:'steady',title:role==='student'?'按部就班读书':role==='employed'?'踏实做好工作':role==='retired'?'安稳过日子':'维持日常生活',note:role==='student'?'照常上课、交作业，晚上休息。':role==='employed'?'按时出勤，下班后休息。':role==='self'?'照看生意，按平常节奏过日子。':'料理日常生活，按时吃饭睡觉。',effect:'不额外接活，固定收支照常结算'},
  ...(role==='student'?[{id:'study',title:'多花心思学习',note:'课后复习，逐渐补好学习基础。',effect:'每天复习：学业 +2 · 疲劳 +3'}]:[{id:'study',title:role==='retired'?'培养兴趣':'提升本事',note:'留出时间读书、练习。',effect:'每天练习：本事 +2 · 疲劳 +5'}]),
  ...(role!=='retired'?[{id:'parttime',title:role==='student'?'课余做兼职':role==='employed'?'下班接点活':'接些零工补贴',note:'每周安排两次晚班，白天原有安排不变。',effect:`每次约 ¥${(dayGigPay(s)/100).toFixed(2)} · 疲劳 +12 · 健康 −1`}]:[]),
  {id:'social',title:'多陪身边的人',note:'经常联系家人和朋友，留意彼此近况。',effect:'每天联系亲友：人缘 +2 · 压力 −4'},
  {id:'market',title:'多留意市场',note:'花时间研究行情，买卖由你决定。',effect:'每天复盘：眼力 +1 · 疲劳 +2'},
  {id:'recover',title:'把状态养回来',note:'减少额外安排，吃好饭、早点睡。',effect:'每天休养：健康 +1 · 疲劳 −12 · 压力 −3（吃饱且不熬夜）'},
 ];
}
export function stagePlan(s){
 const c=lifeChapter(s),p=s.stagePlan;
 return c&&p?.start===c.start&&stageOptions(s).some(o=>o.id===p.focus)?p:null;
}
export function stagePlanReason(s,focus){
 if(!lifeChapter(s)||s.phase!=='planning'||s.legal?.prisonMonthsLeft)return '先处理眼前的故事';
 if(s.dayRoutine?.pending||s.lifeArcs?.pending||s.behavior?.pending)return '先处理眼前的事情';
 return stageOptions(s).some(o=>o.id===focus)?'':'当前身份不能这样安排';
}
export function selectStagePlan(s,focus){
 const p=stagePlan(s);
 s.stagePlan={start:lifeChapter(s).start,focus,counts:p?.counts||{},lastDay:p?.lastDay??day(s),eventDay:p?.eventDay??-1};
 return `这段时间：${stageOptions(s).find(o=>o.id===focus).title}。从接下来尚未度过的日子开始生效。`;
}
// An explicit standing instruction, not free cash on selecting/reselecting a card.
// Late shifts share the manual shift quota, wage and fatigue rules.
export function applyStageShift(s,api){
 const p=stagePlan(s),r=ensureRoutine(s);
 if(p?.focus!=='parttime'||![1,4].includes(day(s)%7)||r.stage>5||r.choices[5]||workLimitReason(s,1))return;
 r.stage=5;chooseActivity(s,{choice:'night_gig'},api);
}
export function settleStageFocus(s,api){
 const p=stagePlan(s);if(!p||day(s)<=p.lastDay)return;
 p.lastDay=day(s);p.counts[p.focus]=(p.counts[p.focus]||0)+1;
 // One ordinary activity per day, using the same values as a manual activity.
 // A manually used evening or a late night has already consumed this opportunity.
 if(s.dayRoutine?.choices?.[5]||s.dayRoutine?.choices?.[6]==='stay'||s.survival?.last?.hospital)return;
 const student=dailyEventRole(s)==='student';
 const effects={study:student?{academic:2}:{skill:2},social:{trust:2,stress:-4},market:{insight:1},recover:{health:1,stress:-3}};
 if(effects[p.focus])api.stat(s,effects[p.focus]);
 const tired={study:student?3:5,market:2,recover:-12}[p.focus]||0;
 s.behavior.fatigue=Math.max(0,Math.min(100,s.behavior.fatigue+tired));
}
export function offerStageEvent(s,api){
 const p=stagePlan(s),r=ensureRoutine(s);
 // Three representative scenes per life chapter, including long late-life chapters.
 // Financial emergencies and authored follow-ups keep their actual due dates.
 const c=lifeChapter(s),gap=c?Math.max(30,Math.floor(c.days/3)):30;
 if(!p||(c.elapsed+Math.floor(gap/2))%gap!==0||p.eventDay===day(s)||r.pending||r.checked.includes('event'))return false;
 p.eventDay=day(s);
 const saved=r.stage;r.stage=dailyEventRole(s)==='student'?3:1;
 if(saved>r.stage){r.stage=saved;return false;}
 const pool=dailyEventPool(s).filter(id=>!(r.recent||[]).includes(id));
 if(!pool.length){r.stage=saved;return false;}
 const id=pool[Math.floor(api.draw(s)*pool.length)];r.pending=id;r.checked.push('event');r.recent=[...(r.recent||[]),id].slice(-6);showWorkStory(s,id);
 return Boolean(DAILY_EVENTS[id]);
}
export function validateStagePlan(s){
 const p=s.stagePlan;if(p===undefined)return;
 const bad=()=>{throw Error('存档中的阶段生活安排无效');};
 if(!p||Array.isArray(p)||!Number.isInteger(p.start)||p.start<18||p.start>s.age||!['steady','study','parttime','social','market','recover'].includes(p.focus)||!Number.isSafeInteger(p.lastDay)||p.lastDay<0||p.lastDay>day(s)||!Number.isSafeInteger(p.eventDay)||p.eventDay< -1||p.eventDay>day(s)||!p.counts||Array.isArray(p.counts)||typeof p.counts!=='object')bad();
 for(const [k,n]of Object.entries(p.counts))if(!['steady','study','parttime','social','market','recover'].includes(k)||!Number.isSafeInteger(n)||n<0||n>1800)bad();
}
