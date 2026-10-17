import {jobSearchWait} from './job-search.js';
import {startCareer} from './careers.js';
import {isCollegeStudent} from './education.js';
import {shouldOfferDayOff,attendanceOptions,recordAbsence,dismissedToday,attendanceStatus} from './attendance.js';
import {WORK_STORY_EVENTS,workStoryReady,dueWorkStory,showWorkStory,chooseWorkStory} from './work-stories.js';
import {preservePension,jobMonthlyPay,halfDayPay,overtimePay,workLimitReason,recordWork,hasSalariedJob,fatigueAffectsIncome,fatigueIncomeReason} from './work-economy.js';
import {EXTRA_DAILY_EVENTS} from './daily-events.js';
/** A shared fictional local clock. Legacy saves infer their current slot without mutation. */
export const DAY_ACTIONS=new Set(['day_next','day_activity','day_event_choice']);
export const DAY_SLOTS=[['07:00','起床'],['09:30','上午'],['11:30','午休'],['13:00','下午'],['15:00','A 股收盘'],['18:30','下班'],['22:30','准备睡觉'],['次日 02:00','还没睡'],['夜间','已结账']];
export function routineState(s){return s.dayRoutine??{day:s.trading.day,stage:[1,2,3,8][s.trading.phase],choices:{},checked:[],pending:null,nightStreak:0,wagePenalty:false,last:''};}
export function ensureRoutine(s){return s.dayRoutine??=structuredClone(routineState(s));}
export const lateWakeChance=streak=>Math.min(75,30+15*Math.max(0,streak-1))/100;
export function resetRoutineDay(s,stage=0){
 if(!s.dayRoutine)return;const previous=s.dayRoutine,{nightStreak,recent,nextWakeLate}=previous;
 const r=s.dayRoutine={day:s.trading.day,stage,choices:{},checked:[],pending:null,nightStreak,wagePenalty:false,last:'',...(recent?{recent:[...recent]}:{})};
 if(s.trading.day>previous.day&&nextWakeLate!==undefined&&s.age>=18&&s.age<80&&!s.legal?.prisonMonthsLeft){
  r.wakeKind=nextWakeLate?'late':nightStreak?'alarm':'fresh';
  if(nextWakeLate){r.stage=2;r.pending=isCollegeStudent(s)?'overslept_class':hasDayJob(s)?'overslept_work':'overslept_free';r.checked.push('event');}
 }
}
export const hasDayJob=s=>hasSalariedJob(s)&&!s.behavior?.leaveDays&&!s.behavior?.jobStartsTomorrow;
export const routineMode=s=>s.behavior?.jobStartsTomorrow?'明天入职':hasSalariedJob(s)&&s.behavior?.leaveDays?(attendanceStatus(s).today?.kind==='absent'?'旷工在家':'请假休息'):hasDayJob(s)?'上班日':s.occupation==='退休'?'退休生活':isCollegeStudent(s)?'大学生活':s.businesses.length?'自己做事':'待业日常';
export function daySlots(s){return DAY_SLOTS.map(([time,label],i)=>[time,({1:hasDayJob(s)?'上午上班':isCollegeStudent(s)?'上午上课':'上午安排',2:'午饭休息',3:hasDayJob(s)?'下午上班':isCollegeStudent(s)?'下午自习':'下午安排',5:hasDayJob(s)?'下班':'傍晚'})[i]||label]);}
export const routineClock=s=>daySlots(s)[routineState(s).stage].join(' · ');
export const marketActivity=choice=>['phone','slack','review','stay'].includes(choice);
export function aShareSession(s){
 const stage=routineState(s).stage;
 if([1,3].includes(stage))return {open:true,label:'交易中',reason:''};
 if(stage===0)return {open:false,label:'未开盘',reason:'A 股未开盘，09:30 开盘；当前仅可查看消息和历史行情'};
 if(stage===2)return {open:false,label:'午间休市',reason:'A 股午休，13:00 开盘'};
 return {open:false,label:'已收盘',reason:'A 股已收盘，次日 09:30 开盘；当前仅可查看行情和持仓'};
}
export const routineNext=s=>{const r=routineState(s),n=r.stage,slots=daySlots(s);return n===8?`起床 · ${r.nextWakeLate?'11:30':'07:00'}`:n>=6?'睡觉 · 结算今天':n===1||n===3?`${r.choices[n]||!hasDayJob(s)?'结束'+(n===1?'上午':'下午'):'正常上班'} · ${slots[n+1][0]}`:`到 ${slots[n+1][0]} · ${slots[n+1][1]}`;};
export const routineWindow=s=>{const r=routineState(s),slots=daySlots(s);return r.stage<6?`${slots[r.stage][0]}–${slots[r.stage+1][0]} · ${slots[r.stage][1]}`:routineClock(s);};
export function activityTiming(s,choice){const stage=routineState(s).stage;if(['day_leave','day_absent'].includes(choice))return '今日不出勤';if(choice==='sleep')return '睡到明早 07:00';if(choice==='stay')return '加密行情 · 至次日 02:00';if(choice==='night_gig')return '做到 22:30';if(choice==='review')return 'A 股已收盘 · 查看收盘行情';if(choice==='phone')return '09:30 开盘 · 消息与历史行情';if(marketActivity(choice))return '进入行情';return `${daySlots(s)[stage+1]?.[0]||'下一时段'} 结束`;}
const clamp=n=>Math.max(0,Math.min(100,n));
const options={
 0:[['breakfast','好好吃早饭','身体 +1 · 压力 −2'],['phone','看看盘前消息','眼力 +1 · 疲劳 +3']],
 1:[['focus','认真上班','本事 +1 · 疲劳 +3'],['slack','摸鱼看盘','疲劳 +4 · 压力 +1 · 可能被发现']],
 2:[['nap','趴一会儿','疲劳 −15 · 压力 −2'],['walk','出去走走','身体 +1 · 压力 −4']],
 3:[['focus','把手头的活做完','本事 +1 · 疲劳 +3'],['slack','边干活边盯盘','疲劳 +4 · 压力 +1 · 可能被发现']],
 4:[['stretch','起来活动一下','疲劳 −5 · 压力 −2'],['review','收盘复盘','眼力 +1 · 疲劳 +2']],
 5:[['friends','和朋友吃个饭','人缘 +2 · 压力 −4'],['learn','学点本事','本事 +2 · 疲劳 +5'],['rest','回家歇着','疲劳 −12 · 压力 −3']],
 6:[['sleep','放下手机睡觉','疲劳 −12 · 结束连续熬夜'],['stay','再盯一会儿','疲劳 +24 · 压力 +5 · 伤健康 · 次日可能睡过头']],
 7:[],8:[]
};
export const dayGigPay=s=>Math.floor(halfDayPay(s)*(fatigueAffectsIncome(s)?.75:1));
export function dayOptions(s){const r=routineState(s);if(shouldOfferDayOff(s))return [...(r.stage===0?[['breakfast','照常起床，去上班',options[0][0][2]]]:options[1]),...attendanceOptions(s)];if(hasSalariedJob(s)&&s.behavior?.leaveDays&&[1,3].includes(r.stage))return [['rest','在家休息','疲劳 −12 · 压力 −3'],['walk','出去走走','身体 +1 · 压力 −4']];if(!hasDayJob(s)&&isCollegeStudent(s)&&[1,3].includes(r.stage))return [[r.stage===1?'attend_class':'coursework',r.stage===1?'去上课':'写作业、复习','学业 +2 · 疲劳 +3'],['day_gig','接半天兼职',`${fatigueIncomeReason(s)}到账 ¥${(dayGigPay(s)/100).toFixed(2)} · 学业 −1 · 健康 −1 · 疲劳 +10`],['rest','在宿舍歇会儿','疲劳 −12 · 压力 −3']];if(!hasDayJob(s)&&[1,3].includes(r.stage))return [...(r.stage===1?[['job_hunt',s.occupation==='退休'?'看看合适的岗位':'投简历，找找机会','可能找到工作 · 压力 +2']]:[['errands','买菜、收拾屋子','压力 −4 · 疲劳 +2']]),['day_gig','接半天零工',`${fatigueIncomeReason(s)}到账 ¥${(dayGigPay(s)/100).toFixed(2)} · 疲劳 +10 · 健康 −1`],['learn','学点本事','本事 +2 · 疲劳 +5'],['rest','歇一会儿','疲劳 −12 · 压力 −3']];if(r.stage===5)return [...options[5],['night_gig','接晚班零工',`${fatigueIncomeReason(s)}到账 ¥${(dayGigPay(s)/100).toFixed(2)} · 到 22:30 · 疲劳 +12`]];return options[r.stage];}
export const DAILY_EVENTS={
 overslept_class:{title:'一睁眼，已经 11:30 了',text:'昨晚盯到两点，闹钟响过也没听见。上午的课已经错过，老师也记下了缺勤。先吃午饭，再补上落下的内容。',stages:[],roles:['student'],choices:[['ack','赶紧补上落下的课','学业 −2 · 自律 −1']]},
 overslept_work:{title:'睡过头，打卡已经迟了',text:'昨晚熬到两点，一觉醒来已经 11:30。上午的班已经错过，迟到记入今天的考勤。你给主管说明情况，下午再去处理工作。',stages:[],roles:['employed'],choices:[['ack','先把今天的工作做好','当天工资扣 10% · 自律 −1 · 人缘 −1']]},
 overslept_free:{title:'这一觉，睡到了 11:30',text:'昨晚睡得太迟，醒来时阳光已经照满房间。没有必须赶到的课或班，今天的安排就从现在开始。',stages:[],roles:[],choices:[['ack','起床，开始今天','上午时段已跳过']]},
 overtime:{title:'临下班，群里又来活了',text:'电脑还没关，主管说今晚要把东西交出去。',choices:[['accept','留下加班','疲劳 +14 · 压力 +4 · 多拿 1/5 日薪，最多 ¥25'],['decline','说明情况，按点走','压力 +2']]},
 coworker:{title:'同事把收益图递过来了',text:'“早知道昨天也买一点。”饭还没吃完，几个人已经聊开了。',choices:[['listen','听听他怎么说','上头 +6 · 眼力 +1'],['eat','先把饭吃完','压力 −3']]},
 commute:{title:'早高峰，地铁又停住了',text:'上班群在催，行情群也在响。你被夹在车门旁边。',choices:[['message','跟同事说一声','压力 +2 · 人缘 +1'],['scroll','继续刷手机','压力 +4 · 疲劳 +4']]},
 family:{title:'家里打来一个电话',text:'没什么大事，就是问你最近有没有按时吃饭。',choices:[['talk','好好聊几句','人缘 +2 · 压力 −3'],['later','晚点再说','人缘 −1']]},
 neighbour:{title:'楼下遇到熟人',text:'他问起你的近况，又说了说最近哪里在招人。',choices:[['chat','停下来聊聊','人缘 +2 · 压力 −2'],['leave','打个招呼，先忙自己的','压力 −1']]},
 lunch:{title:'饭点，手机还在响',text:'饭已经盛好，群里的涨跌截图还在一张接一张地发。',choices:[['listen','边吃边看','上头 +4 · 疲劳 +2'],['eat','放下手机吃饭','压力 −3']]},
 ...EXTRA_DAILY_EVENTS,
 ...WORK_STORY_EVENTS
};
const legacyRules={overtime:{stages:[5],roles:['employed']},commute:{stages:[1],roles:['employed']},coworker:{stages:[2],roles:['employed']},neighbour:{stages:[1],roles:['unemployed','self','retired','student']},lunch:{stages:[2],roles:['unemployed','self','retired','student']},family:{stages:[5],roles:[],when:s=>s.household.livingParent}};
for(const [id,rules] of Object.entries(legacyRules))Object.assign(DAILY_EVENTS[id],rules);
export function dailyEventRole(s){return hasDayJob(s)?'employed':s.occupation==='退休'?'retired':isCollegeStudent(s)?'student':s.businesses.length?'self':'unemployed';}
export function dailyEventPool(s){const r=routineState(s),role=dailyEventRole(s);return Object.entries(DAILY_EVENTS).filter(([id,e])=>id!=='overtime'&&(!e.chain||e.storyStage==='new'&&workStoryReady(s,id))&&e.stages.includes(r.stage)&&(!e.roles.length||e.roles.includes(role))&&(!e.when||e.when(s))).map(([id])=>id);}
export const dailyEventChance=s=>hasDayJob(s)&&[1,3].includes(routineState(s).stage) ? .4 : .12;
export function routineAvailability(s,a,months){
 const r=routineState(s);
 if(a.day!==undefined&&a.day!==s.trading.day||a.stage!==undefined&&a.stage!==r.stage)return '时段已变化，请使用当前的选项';
 if(s.phase!=='planning'||s.age<18||s.age>=80||s.legal?.prisonMonthsLeft>0)return '先处理眼前的故事';
 if(a.type==='day_event_choice'){
  const event=DAILY_EVENTS[r.pending];if(!event?.choices.some(c=>c[0]===a.choice))return '这件日常小事已处理';
  if(event.chain&&!workStoryReady(s,r.pending))return '这段工作往来已经处理';
  const cost=event.effects?.[a.choice]?.cost||0;return cost>s.cash?`现金不够，还差 ¥${((cost-s.cash)/100).toFixed(2)}`:'';
 }
 if((s.debtClock?.periodDays||0)>=months*30)return '本期日账已结清，请进入下一阶段';
 if(r.pending)return '先选完眼前这件日常小事';
 if(a.type==='day_next')return '';
 if(a.type==='day_activity'&&a.choice==='job_hunt'&&dismissedToday(s))return '今天刚被开除，明天再投简历';
 if(a.type==='day_activity'&&['day_gig','night_gig'].includes(a.choice)&&workLimitReason(s,1))return workLimitReason(s,1);
 if(a.type==='day_activity')return r.choices[r.stage]?'这个时段已经安排过了':dayOptions(s).some(c=>c[0]===a.choice)?'':'这项安排不在当前时段';
 return '未知的日常安排';
}
function fatigue(s,n){s.behavior.fatigue=clamp(s.behavior.fatigue+n);}
export function chooseActivity(s,a,api){
 const r=ensureRoutine(s),c=a.choice;r.choices[r.stage]=c;
 if(['day_leave','day_absent'].includes(c))return r.last=recordAbsence(s,c==='day_leave'?'leave':'absent',api);
 if(c==='day_gig'){recordWork(s,1);const reason=fatigueIncomeReason(s),amount=dayGigPay(s);api.cashChange(s,amount,'半天零工收入');api.stat(s,{skill:1,health:-1,stress:2,...(isCollegeStudent(s)?{academic:-1}:{})});fatigue(s,10);s.flags.career_history=true;return r.last=`${reason}半天活干完，到账 ¥${(amount/100).toFixed(2)}。疲劳 +10，健康 −1。`;}
 if(c==='night_gig'){recordWork(s,1);const reason=fatigueIncomeReason(s),amount=dayGigPay(s);api.cashChange(s,amount,'晚班零工收入');api.stat(s,{skill:1,health:-1,stress:2});fatigue(s,12);s.flags.career_history=true;r.stage=6;return r.last=`${reason}晚班干到 22:30，到账 ¥${(amount/100).toFixed(2)}。疲劳 +12，健康 −1。`;}
 if(c==='job_hunt'){api.stat(s,{stress:2});if(jobSearchWait(s))return r.last=jobSearchWait(s)+' 压力 +2。';if(api.draw(s)<.18+s.stats.skill/500){preservePension(s);const offer=startCareer(s);s.flags.employed=true;s.flags.career_history=true;if(s.flags.ever_released)s.flags.reentry_employed=true;return r.last=`${offer.entry}\n找到一份${s.occupation}的工作，月薪 ¥${s.monthlyIncome/100}，每月 10 号发上月工资。`;}return r.last='简历投出去了，今天还没收到合适的回复。压力 +2。';}
 if(c==='sleep')return '今晚早点睡。';
 if(c==='stay'){r.stage=7;return r.last='手机又充上电了。睡下后结算熬夜的影响。';}
 const changes={attend_class:{academic:2},coursework:{academic:2},breakfast:{health:1,stress:-2},phone:{insight:1},focus:{skill:1},slack:{},nap:{stress:-2},walk:{health:1,stress:-4},stretch:{stress:-2},review:{insight:1},friends:{trust:2,stress:-4},learn:{skill:2},rest:{stress:-3},errands:{stress:-4}};
 api.stat(s,changes[c]||{});fatigue(s,{attend_class:3,coursework:3,phone:3,focus:3,nap:-15,stretch:-5,review:2,learn:5,rest:-12,errands:2}[c]||0);
 if(c==='slack'){const caught=workDistraction(s,api);if(caught)return caught;}
 return r.last=options[r.stage]?.find(o=>o[0]===c)?.slice(1).join('：')||dayOptions(s).find(o=>o[0]===c)?.slice(1).join('：')||'安排好了。';
}
export function workDistraction(s,api){
 if(!s.dayRoutine||!hasDayJob(s)||![1,3].includes(s.dayRoutine.stage))return '';
 const r=s.dayRoutine,key='work'+r.stage;
 if(r.checked.includes(key))return '';
 r.checked.push(key);r.choices[r.stage]??='slack';fatigue(s,4);api.stat(s,{stress:1});
 if(api.draw(s)<.25){r.wagePenalty=true;api.stat(s,{stress:4});return r.last='主管发现你一直在看盘。今天工作打了折扣，当日工钱少 25%。';}
 return '';
}
// Completing a shift through another time control still incurs ordinary work.
// Saved choices also cover old saves, so effects never run twice for a shift.
export function completeRoutineWork(s,through=3){
 if(!hasDayJob(s)||!s.dayRoutine)return;
 const r=s.dayRoutine;
 for(const stage of [1,3])if(stage<=through&&!(stage===1&&r.wakeKind==='late')&&!r.choices[stage]){r.choices[stage]='focus';fatigue(s,3);}
}
export function arriveRoutineSlot(s,api){
 const r=s.dayRoutine;
 if(r.pending)return;
 const recent=r.recent||[],due=!r.checked.includes('event')&&dueWorkStory(s,r.stage,dailyEventRole(s));
 if(due){r.pending=due;r.checked.push('event');}
 else if(r.stage===5&&hasDayJob(s)&&!recent.includes('overtime')&&api.draw(s)<.25)r.pending='overtime';
 else if([1,2,3,5,6].includes(r.stage)&&!r.checked.includes('event')&&api.draw(s)<dailyEventChance(s)){
  const pool=dailyEventPool(s),fresh=pool.filter(id=>!recent.includes(id)),choices=fresh.length?fresh:pool.filter(id=>id!==recent.at(-1));
  if(choices.length){r.checked.push('event');r.pending=choices[Math.min(choices.length-1,Math.floor(api.draw(s)*choices.length))];}
 }
 if(r.pending){r.recent=[...recent.filter(id=>id!==r.pending),r.pending].slice(-6);showWorkStory(s,r.pending);}
}
export function chooseDayEvent(s,a,api){
 const r=ensureRoutine(s),key=r.pending,c=a.choice;r.pending=null;
 if(key==='overslept_class'){api.stat(s,{academic:-2,discipline:-1});return r.last='昨晚熬夜后睡过头，上课迟到：学业 −2，自律 −1。';}
 if(key==='overslept_work'){r.lateForWork=true;api.stat(s,{discipline:-1,trust:-1});return r.last='昨晚熬夜后睡过头，上班迟到：当天工资扣 10%，自律 −1，人缘 −1。扣款在今晚工资结算中扣除。';}
 if(key==='overslept_free')return r.last='昨晚熬夜后睡过头，11:30 才开始今天；没有上课或工作，不扣迟到费用。';
 if(WORK_STORY_EVENTS[key])return r.last=chooseWorkStory(s,key,c,api);
 const extra=EXTRA_DAILY_EVENTS[key]?.effects[c];
 if(extra){if(extra.cost)api.cashChange(s,-extra.cost,`日常事件：${DAILY_EVENTS[key].title}`);api.stat(s,extra.stats);fatigue(s,extra.fatigue);s.behavior.heat=clamp(s.behavior.heat+extra.heat);return r.last=extra.text;}
 if(key==='overtime'){
  if(c==='accept'){const amount=overtimePay(s);api.cashChange(s,amount,'当晚加班收入');fatigue(s,14);api.stat(s,{stress:4});r.choices[5]='overtime';r.last=`加班到 22:30，额外到账 ¥${(amount/100).toFixed(2)}。`;r.stage=6;return r.last;}
  api.stat(s,{stress:2});return r.last='今天按点下班。压力 +2。';
 }
 const effects={coworker:c==='listen'?{insight:1}:{stress:-3},commute:c==='message'?{stress:2,trust:1}:{stress:4},family:c==='talk'?{trust:2,stress:-3}:{trust:-1},neighbour:c==='chat'?{trust:2,stress:-2}:{stress:-1},lunch:c==='listen'?{}:{stress:-3}};
 api.stat(s,effects[key]);if(key==='coworker'&&c==='listen')s.behavior.heat=clamp(s.behavior.heat+6);if(key==='commute'&&c==='scroll')fatigue(s,4);
 if(key==='lunch'&&c==='listen'){s.behavior.heat=clamp(s.behavior.heat+4);fatigue(s,2);}
 return r.last=DAILY_EVENTS[key].choices.find(v=>v[0]===c).slice(1).join('：');
}
// Called AFTER wages are settled so tonight's sleep affects tomorrow's work.
export function finishRoutineSleep(s,api){
 if(!s.dayRoutine)return '';const r=s.dayRoutine;if(r.nextWakeLate!==undefined)return '';
 if(r.choices[6]==='stay'||r.stage===7){r.nightStreak++;r.nextWakeLate=api.draw(s)<lateWakeChance(r.nightStreak);fatigue(s,24);const health=r.nightStreak>=2?-3:-1;api.stat(s,{health,stress:5});r.last=`熬到两点：疲劳 +24，压力 +5，健康 ${health}。${r.nightStreak>=2?'已经连续 '+r.nightStreak+' 晚没睡好。':''}`;}
 else{r.nightStreak=0;r.nextWakeLate=false;fatigue(s,-12);r.last='睡了一觉：疲劳 −12，结束连续熬夜。';}
 r.stage=8;return r.last;
}
export function validateRoutine(s){
 const r=s.dayRoutine;if(r===undefined)return;
 const bad=()=>{throw Error('存档中的日常时间记录无效');};
 if(!r||typeof r!=='object'||Array.isArray(r)||!Number.isInteger(r.stage)||r.stage<0||r.stage>8||r.day!==s.trading.day||!Number.isSafeInteger(r.nightStreak)||r.nightStreak<0||r.nightStreak>100000||typeof r.wagePenalty!=='boolean'||typeof r.last!=='string'||r.last.length>500||!Array.isArray(r.checked)||r.checked.length>4||r.checked.some(k=>!['work1','work3','event'].includes(k))||new Set(r.checked).size!==r.checked.length||!r.choices||typeof r.choices!=='object'||Array.isArray(r.choices)||Object.keys(r.choices).length>7)bad();
 if(r.pending!==null&&!Object.hasOwn(DAILY_EVENTS,r.pending))bad();
 for(const key of ['nextWakeLate','lateForWork'])if(r[key]!==undefined&&typeof r[key]!=='boolean')bad();
 if(r.wakeKind!==undefined&&!['fresh','alarm','late'].includes(r.wakeKind))bad();
 if(r.lateForWork&&r.wakeKind!=='late'||r.pending?.startsWith('overslept_')&&(r.wakeKind!=='late'||r.stage!==2)||r.wakeKind==='late'&&r.stage<2)bad();
 if(r.recent!==undefined&&(!Array.isArray(r.recent)||r.recent.length>6||r.recent.some(id=>typeof id!=='string'||!Object.hasOwn(DAILY_EVENTS,id))||new Set(r.recent).size!==r.recent.length))bad();
 for(const [slot,c] of Object.entries(r.choices))if(!/^\d$/.test(slot)||+slot>6||![...options[slot].map(o=>o[0]),'learn','rest',...(['0','1'].includes(slot)?['day_leave','day_absent']:[]),...(['1','3'].includes(slot)?['day_gig','walk','attend_class','coursework']:[]),...(slot==='1'?['job_hunt']:[]),...(slot==='3'?['errands']:[]),...(slot==='5'?['overtime','night_gig']:[])].includes(c))bad();
}
