import {dormDailyArt} from './dorm-art.js';
import {careerArt} from './career-art.js';
import {isCollegeStudent} from '../game/education.js';
import {LIFE_ENCOUNTERS} from '../game/life-encounters.js';
import {routineState,hasDayJob} from '../game/day-routine.js';

// Scene selection is read-only. It follows saved activities, never draws a new outcome.
export const DAILY_SCENES={
 breakfast:['吃点东西再出门','饭还热着，手机先放一边。','steam'],
 work:['手头的活','先做完这一页，再看一眼时间。','daylight'],
 slack:['工位上的另一块屏幕','手在敲键盘，眼睛却在看涨跌。','screen'],
 'home-trading':['家里的行情屏','一杯茶没喝完，价格又变了。','screen'],
 'job-search':['找个落脚的工作','简历又改了一遍，等一封回信。','daylight'],
 gig:['干活挣点钱','胶带一拉，今天的工钱有着落了。','daylight'],
 college:['大学课堂','先把老师讲的这一段记下来。','daylight'],
 'study-day':['下午自习','翻到下一页，把这道题做完。','daylight'],
 'study-night':['灯下复习','把这一页看完，就收拾睡觉。','lamp'],
 bedtime:['准备睡觉','水杯放好了，今天也该歇了。','lamp'],
 sleep:['夜里睡下了','灯熄了，明早再说。','rest'],
 study:['多学一点本事','又学会了一招。','lamp'],
 rest:['歇一会儿','手机放下，肩膀总算松了。','rest'],
 meal:['饭点到了','面端上桌，先吃两口。','steam'],
 outside:['出去走走','绕着街口走一圈。','daylight'],
 night:['还舍不得关机','又一根 K 线。窗外早就安静了。','screen'],
 phone:['家里的电话','聊的都是小事，听着倒挺踏实。','lamp'],
 'phone-day':['打个电话','先听对方把话说完。','daylight'],
 'phone-night':['夜里的电话','声音放轻一点，听听家里的近况。','lamp'],
 commute:['上班路上','车还没到站，先跟单位说一声。','daylight']
};
const choiceScenes={attend_class:'college',coursework:'study',day_leave:'rest',day_absent:'rest',breakfast:'breakfast',phone:'home-trading',focus:'work',slack:'slack',nap:'rest',walk:'outside',stretch:'outside',friends:'meal',learn:'study',rest:'rest',sleep:'rest',stay:'night',job_hunt:'job-search',day_gig:'gig',night_gig:'gig',errands:'outside',overtime:'work'};
const actionScenes={seek_job:'job-search',work:'gig',gig:'gig',study:'study',rest:'rest',social:'meal',business_start:'gig'};
export function dailyScene(s){
 if(!s||s.age<18||s.age>=80||s.phase!=='planning'||s.legal?.prisonMonthsLeft>0)return null;
 const r=routineState(s),stage=r.stage;
 const eventScenes={overslept_class:'college',overslept_work:'commute',overslept_free:'meal',zhou_cover:'work',zhou_return:'study',zhou_request:'phone',zhou_thanks:'phone',wu_error:'work',wu_review:'work',wu_bonus:'work',wu_rework:'work',wu_audit:'work',computer_crash:'work',client_revision:'work',help_newcomer:'work',task_credit:'work',late_lunch:'meal',sleepy_shift:'work',office_group_tip:'slack',urgent_errand:'outside',meeting_overrun:'work',shift_cover:'work',commute:'commute',neighbour:'outside',coworker:'meal',lunch:'meal',family:'phone',overtime:'work',handover:'work',deadline:'work',work_error:'work',praise:'work',office_rumor:'meal',coworker_request:'meal',resume_reply:'job-search',interview_deposit:'job-search',gig_cancel:'job-search',free_class:'study',study_group:'study',exam_week:'study',dorm_tip:'home-trading',park_walk:'outside',community_phone:'outside',old_colleague:'phone',neighbor_parcel:'outside',broken_elevator:'outside',unread_family:'phone',sleepless:'bedtime',old_friend:'outside',secondhand:'rest',found_wallet:'outside',price_alert:'meal'},pending=eventScenes[r.pending];
 // A receipt from an earlier slot must never choose the current background.
 const context=s.lastResult?.sceneContext;
 const currentContext=context?.day===s.trading.day&&context.stage===stage?context:null;
 const atWork=hasDayJob(s),student=isCollegeStudent(s),offDay=Boolean(s.behavior?.leaveDays||s.behavior?.jobStartsTomorrow);
 const market=atWork&&stage>=1&&stage<=4?'slack':'home-trading';
 const selfEmployed=!atWork&&!student&&!offDay&&s.occupation!=='退休'&&s.businesses.length>0;
 const fallback=['breakfast',atWork?'work':student?'college':offDay?'rest':s.occupation==='退休'?'outside':selfEmployed?'gig':'job-search','meal',atWork?'work':student?'study-day':offDay?'rest':selfEmployed?'gig':'outside',atWork?'work':student?'study-day':offDay?'rest':selfEmployed?'gig':'outside','outside','bedtime','night','sleep'][stage];
 const event=currentContext?.event;
 const eventChoiceScenes={sleepless:{write:'study-night',check:'night'},exam_week:{study:'study',chart:'home-trading'},office_group_tip:{mute:'work',ask:'slack'},old_friend:{meet:'outside',reschedule:'rest'},old_colleague:{reply:'phone',save:'rest'},gig_cancel:{learn:'study',search:'job-search'},overtime:{decline:'outside'},urgent_errand:{metro:'work',walk:'work'},free_class:{attend:'college',schedule:'outside'},price_alert:{mute:'meal',open:'home-trading'},zhou_request:{help:'gig',decline:'phone'},unread_family:{call:'phone',text:'rest'},family:{talk:'phone',later:'rest'}};
 const encounter=LIFE_ENCOUNTERS[r.pending||event];
 const resolved=eventChoiceScenes[event]?.[currentContext?.choice]||eventScenes[event];
 const selected=r.choices[stage];
 const instant=stage<6||currentContext?.action==='study'?actionScenes[currentContext?.action]:null;
 let key=encounter?.scene||pending||resolved||(selected==='review'?market:choiceScenes[selected])||instant||fallback;
 if(key==='study')key=stage<=4?'study-day':stage>=6?'study-night':'study';
 if(stage>=6&&key==='rest')key='bedtime';
 if(stage>=6&&['home-trading','slack'].includes(key))key='night';
 if(key==='phone')key=stage>=6?'phone-night':stage<5?'phone-day':'phone';
 let [title,line,motion]=DAILY_SCENES[key];
 if(encounter){title=encounter.title;line='先把眼前这件事安排好。';}
 if(r.pending?.startsWith('overslept_')){title='睡过头了';line=student?'点名已经结束，先把落下的课补上。':atWork?'一看时间，打卡已经迟了。':'一觉醒来，已经十一点半。';}
 if(key==='study-day'&&!student){title='读书与练习';line='把刚才不会的地方，再练一遍。';}
 if(key==='college'&&!student){title='社区技能课';line='跟着老师，把这一步记下来。';}
 if(key==='gig'&&selfEmployed){title='照看自己的生意';line='货理好了，再核一遍订单。';}
 if(event==='sleepless'&&currentContext.choice==='write'){title='记下明天的事';line='记在纸上，今晚就先放下。';}
 if(stage===0&&key==='home-trading'){title='开盘前的消息';line='还没到九点半，先翻翻消息。';motion='daylight';}
 if(stage>=4&&stage<6&&['home-trading','slack'].includes(key)){title='收盘复盘';line='A 股收盘了，把今天的记录翻一遍。';}
 if(stage===2&&['home-trading','slack'].includes(key)){title='午间查看行情';line='A 股午休了，先看上午的记录。';}
 const dorm=dormDailyArt(s,key,stage);
 // New off-duty encounters use a neutral tabletop beyond young adulthood;
 // a retired protagonist must not turn into the student in the legacy daily art.
 if(encounter&&!student&&!atWork&&(s.age>=40||selfEmployed))return {key,title,line,motion,src:'./public/assets/events/market-review-v1.webp',alt:'桌上的资料、笔记与生活记录',environmentOnly:true,night:stage>=6,stamp:`${s.trading.day}:${stage}:${r.pending||event}`};
 const workplace=['work','slack'].includes(key)?careerArt(s):null;
 if(workplace)return {key,title:`${s.occupation} · ${key==='slack'?'工作间隙':'当班'}`,line,motion,...workplace,night:stage>=6,stamp:`${s.trading.day}:${stage}:${key}:${s.career.track}`};
 const src=dorm?.src||(key==='gig'&&stage>=5?'./public/assets/daily/gig-night-v1.webp':key==='work'&&stage>=5?'./public/assets/events/work-desk-v1.webp':`./public/assets/daily/${key}-${key==='breakfast'?'v2':'v1'}.webp`);
 return {key,title,line,motion,src,...(dorm?{alt:dorm.alt,location:'dorm',variant:dorm.variant,focalY:dorm.focalY}:{}),night:stage>=6||key==='gig'&&stage>=5,stamp:`${s.trading.day}:${stage}:${key}:${selected||r.pending||event||''}`};
}
// Tail positions in the original artwork, just above each character's head.
const speechAnchors={'campus-arrival':[.40,.24],'phone-day':[.47,.28],'phone-night':[.47,.28],commute:[.50,.22],'study-day':[.50,.30],'study-night':[.50,.29],bedtime:[.45,.23],sleep:[.28,.40],college:[.48,.14],breakfast:[.50,.30],work:[.46,.23],slack:[.49,.25],'home-trading':[.49,.20],'job-search':[.51,.23],gig:[.49,.18],study:[.56,.23],rest:[.40,.35],meal:[.41,.22],outside:[.51,.30],night:[.50,.21],phone:[.47,.28]};
export function renderDailyStage(s,{esc},scene=dailyScene(s)){
if(!scene)return '';
 return `<section class="daily-stage" aria-label="日常主场景" data-scene="${scene.key}"${scene.location?` data-location="${scene.location}" data-variant="${scene.variant}"`:''}><div class="daily-mobile-art"><img src="${scene.src}" alt="${esc(scene.alt||scene.title)}" width="1920" height="1080" style="object-position:50% ${scene.focalY??50}%" decoding="async"></div>${scene.environmentOnly?'':`<div class="daily-scene-caption" role="note" aria-label="人物对白"><p>${esc(scene.line)}</p></div>`}</section>`;
}

export function positionDailySpeech(shell){
 const stage=shell?.querySelector('.daily-stage'),bubble=stage?.querySelector('.daily-scene-caption');
 if(!bubble)return;
 if(!matchMedia('(min-width:1250px)').matches){bubble.style.removeProperty('left');bubble.style.removeProperty('top');return;}
 const art=document.querySelector('.daily-world img');if(!art)return;
 const upper=['bedtime','sleep'].includes(stage.dataset.scene);
 const dormAnchor=[stage.dataset.variant==='1'?.30:.68,upper?.10:.36];
 const frame=art.getBoundingClientRect(),bounds=stage.getBoundingClientRect(),[x,y]=stage.dataset.location==='dorm'?dormAnchor:speechAnchors[stage.dataset.scene]||[.5,.25];
 // Match the centered object-fit:cover crop, including tall desktop windows.
 const ratio=(art.naturalWidth||1920)/(art.naturalHeight||1080),width=Math.max(frame.width,frame.height*ratio),height=width/ratio;
 const clamp=(value,min,max)=>Math.max(min,Math.min(value,Math.max(min,max)));
 const left=frame.left+frame.width/2+(x-.5)*width-bounds.left-24;
 const top=frame.top+frame.height/2+(y-.5)*height-bounds.top-bubble.offsetHeight-12;
 bubble.style.left=`${Math.round(clamp(left,12,bounds.width-bubble.offsetWidth-12))}px`;
 bubble.style.top=`${Math.round(clamp(top,12,bounds.height-bubble.offsetHeight-18))}px`;
}

// Only scene transitions animate; data refreshes and reading details do not replay them.
let lastStamp='';
export function animateDailyScene(scene,{reduced=false}={}){
 const image=document.querySelector('.daily-world img');if(!scene||!image){lastStamp='';return;}
 const stamp=scene.stamp;
 if(stamp===lastStamp)return;lastStamp=stamp;
 if(reduced||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 image.animate([{opacity:.55,transform:'scale(1.016)'},{opacity:1,transform:'scale(1)'}],{duration:480,easing:'cubic-bezier(.16,1,.3,1)'});
}
