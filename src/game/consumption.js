import {isCollegeStudent} from './education.js';
/** Optional purchases after realized gains. This stream never draws market RNG. */
const day=s=>s.debtClock?.day||0;
const hash=text=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);n^=n>>>16;n=Math.imul(n,0x85ebca6b);n^=n>>>13;return n>>>0;};
const friends=s=>s.peopleMet?.some(id=>['N01','N02','N03','N04'].includes(id));
const choice=(id,label,cost,stats={},monthly=0)=>({id,label,cost,stats,monthly});
export const CONSUMPTION_EVENTS={
 meal:{minProfit:20000,title:'这一顿，吃好一点',text:'赚到的钱已经落袋。路过常去的小店，你忽然觉得，今天不必再盯着最便宜的那一栏。',choices:[choice('buy','点一桌一直想吃的',18000,{stress:-6}),choice('small','给自己加个菜',3000,{stress:-2})]},
 dinner:{minProfit:80000,when:friends,title:'这顿我来',text:'聊起最近的盈利，熟人顺口说该庆祝一下。结账时，几个人的目光落到你身上。',choices:[choice('buy','请大家吃顿好的',60000,{trust:3,fame:2,stress:-4}),choice('small','提前说好各付各的',10000,{stress:-2})]},
 clothes:{minProfit:60000,title:'也该换身像样的了',text:'橱窗里的衣服，你之前总说再等等。现在那笔盈利到账了，“犒劳自己”听起来格外顺耳。',choices:[choice('buy','买下看中的一套',50000,{fame:1,stress:-4}),choice('small','只换掉穿旧的一件',12000,{stress:-2})]},
 device:{minProfit:300000,title:'旧的其实还能用',text:'你打开了商品页。旧设备只是有点慢，新款却让你觉得：既然赚到了，就该一步到位。',choices:[choice('buy','换一台新设备',220000,{stress:-5}),choice('small','维修保养，再用一阵',20000,{stress:-2})]},
 outing:{minProfit:600000,title:'周末得出去走走',text:'账户里的盈利让出游计划忽然有了底气。你翻着周末套餐，开始比较住宿和车票。',choices:[choice('buy','订周末出游套餐',350000,{stress:-8}),choice('small','选附近的一日游',30000,{stress:-4})]},
 family:{minProfit:100000,when:s=>s.household.livingParent,title:'给家里带点东西',text:'赚到钱后，你想起家里一直舍不得换的小物件。电话还没拨出去，你已经把礼物放进了购物车。',choices:[choice('buy','挑份像样的礼物',60000,{trust:4,stress:-3}),choice('small','买些家里常用的',15000,{trust:2})]},
 membership:{minProfit:150000,when:s=>!s.lifeArcs?.consumption?.monthly,title:'每月多一点，也不算多吧',text:'外卖、会员和打车都比以前方便。你算了算最近赚的钱，觉得每个月给这些享受留点预算也没关系。',choices:[choice('buy','以后每月多留 ¥300',0,{stress:-3},30000),choice('small','今天花 ¥60，先不增加月开销',6000,{stress:-2})]},
 invitation:{title:'下次还是你请？',text:'上回那顿饭之后，又有人提议聚聚：“你最近手气好，地方你来挑？”赚钱时的一次爽快，慢慢变成了别人的期待。',choices:[choice('buy','再请一次',60000,{fame:2,stress:2}),choice('small','说好各付各的',10000,{stress:-2})]},
 bills:{title:'享受留下了固定账单',text:'你给自己加的外卖、会员和打车预算，每天还在花。重新翻账时才发现，这笔开销不会随着行情一起降下来。',choices:[choice('cut','取消这部分额外开销',0,{stress:-3}),choice('keep','先维持，每月仍多花 ¥300',0,{stress:3})]}
};
Object.assign(CONSUMPTION_EVENTS,{
 campus_meal:{campus:true,minProfit:20000,title:'食堂里给自己加个菜',text:'这笔盈利已经到账。下课走进食堂，你想今天吃得好一点。',choices:[choice('buy','点个喜欢的套餐',3500,{stress:-4}),choice('small','只加一份菜',1000,{stress:-2})]},
 campus_dinner:{campus:true,minProfit:60000,when:friends,title:'室友提议去校门口聚餐',text:'聊起刚赚的一笔钱，室友提议周末去校门口的小馆子吃饭。你们先商量谁来付账。',choices:[choice('buy','这次请室友，控制在 ¥150',15000,{trust:3,stress:-3}),choice('small','大家平摊，我出 ¥40',4000,{trust:1,stress:-2})]},
 campus_book:{campus:true,minProfit:30000,title:'买下那本一直想看的书',text:'路过校门口书店，你又翻到之前舍不得买的那本书。账户里的盈利让你有些心动。',choices:[choice('buy','买一本新书',6000,{stress:-3}),choice('small','找一本二手的',2500,{stress:-2})]},
 campus_gift:{campus:true,minProfit:80000,when:s=>s.household.livingParent,title:'回家时带一份小礼物',text:'这次赚到钱，你想周末回家时给家里带点心意，金额就控制在自己的余钱内。',choices:[choice('buy','带些家里喜欢的吃食',12000,{trust:3,stress:-2}),choice('small','买一袋当季水果',4000,{trust:1})]},
});
export const newConsumption=()=>({rolls:0,lastRollDay:-5,pending:null,followup:null,monthly:0,lastReviewDay:0,history:[]});
// Collect a transaction's exits, then evaluate after its calendar has settled.
// WeakMap entries never enter saves or survive a failed transaction.
const realized=new WeakMap();
export function queueRealizedProfit(s,profit){
 const total=(realized.get(s)||0)+profit;
 if(!Number.isSafeInteger(total))throw Error('已实现盈亏超出范围');
 realized.set(s,total);
}
export function flushRealizedProfit(s){const profit=realized.get(s);realized.delete(s);if(profit!==undefined)noteRealizedProfit(s,profit);}
export function noteRealizedProfit(s,profit){
 if(!Number.isSafeInteger(profit)||profit<20000||s.age<18||s.age>=80||s.legal?.prisonMonthsLeft||s.survival?.failed)return;
 const v=s.lifeArcs.consumption??=newConsumption();
 const college=isCollegeStudent(s);
 if(v.pending||day(s)-v.lastRollDay<(college?30:5))return;
 const pool=Object.entries(CONSUMPTION_EVENTS).filter(([,e])=>Boolean(e.campus)===college&&e.minProfit&&profit>=e.minProfit&&(!e.when||e.when(s)));
 if(!pool.length)return;
 v.lastRollDay=day(s);v.rolls++;
 if(hash(`${s.seed}:consumption:chance:${v.rolls}`)%100>=(college?35:80))return;
 const recent=v.history.slice(-2).map(h=>h.id),fresh=pool.filter(([id])=>!recent.includes(id)),available=fresh.length?fresh:pool;
 const [id]=available[hash(`${s.seed}:consumption:pick:${v.rolls}`)%available.length];
 v.pending={id,profit,day:day(s)};
}
export function refreshConsumption(s){
 const v=s.lifeArcs?.consumption;if(!v)return false;
 // Discard an unopened offer after a week; never interrupt a choice already shown.
 if(v.pending&&s.lifeArcs.pending!=='consumption'&&day(s)-v.pending.day>7)v.pending=null;
 const lastBill=v.history.findLast(h=>h.id==='bills');
 if(!v.pending&&v.monthly&&day(s)>v.lastReviewDay&&(day(s)-v.lastReviewDay>=30||s.cash<v.monthly&&(!lastBill||day(s)-lastBill.day>=7))){
  v.pending={id:'bills',profit:0,day:day(s)};
 }
 if(!v.pending&&v.followup&&v.followup.due<=day(s)){
  if(day(s)-v.followup.due<=7&&friends(s))v.pending={id:'invitation',profit:0,day:day(s)};
  v.followup=null;
 }
 return Boolean(v.pending);
}
export function consumptionScene(s){
 const v=s.lifeArcs?.consumption,p=v?.pending,e=CONSUMPTION_EVENTS[p?.id];if(!e)return null;
 const choices=[...e.choices, ...(p.id==='bills'?[]:[choice('skip','先不花这笔钱',0)])];
 const names={stress:'压力',trust:'人缘',fame:'名气'};
 return {key:'consumption',id:p.id,title:e.title,text:e.text,profit:p.profit,options:choices,choices:choices.map(c=>[c.id,c.label,[c.monthly?'从下次日结起，每天 +¥10':c.cost?`支付 ¥${c.cost/100}`:'不花钱',...Object.entries(c.stats).map(([k,n])=>`${names[k]} ${n>0?'+':'−'}${Math.abs(n)}`)].join(' · ')])};
}
export function consumptionReason(s,id){const c=consumptionScene(s)?.options.find(c=>c.id===id);return !c?'这件事已经处理':s.cash<c.cost?`需要现金 ¥${c.cost/100}，还差 ¥${(Math.max(0,c.cost-s.cash)/100).toFixed(2)}`:null;}
export function executeConsumption(s,id,api){
 const scene=consumptionScene(s),c=scene.options.find(c=>c.id===id),v=s.lifeArcs.consumption;
 if(c.cost)api.cashChange(s,-c.cost,'消费：'+scene.title);
 api.stat(s,c.stats);
 if(c.monthly){v.monthly=c.monthly;v.lastReviewDay=day(s);}
 if(scene.id==='bills'){if(id==='cut')v.monthly=0;v.lastReviewDay=day(s);}
 if(scene.id==='dinner'&&id==='buy')v.followup={id:'invitation',due:day(s)+7};
 const text=id==='skip'?'你关掉了这次消费的念头，钱仍留在账户里。':scene.id==='bills'?(id==='cut'?'额外月开销已取消，从下次日结起少花 ¥10。之前花掉的钱不会退回。':'额外开销继续，每月 ¥300。你决定先维持现在的日子。'):c.monthly?'你给日常享受加了预算，从下次日结起每天多花 ¥10。随时可以在“调整日常开支”中取消。':`${c.label}，花了 ¥${c.cost/100}。${scene.id==='dinner'&&id==='buy'?'饭桌热闹了起来，有人说下次再聚。':'这笔钱已经记进生活账本。'}`;
 v.history.push({id:scene.id,choice:id,day:day(s),cost:c.cost});v.history=v.history.slice(-24);v.pending=null;
 return text;
}
export function validateConsumption(s){
 const v=s.lifeArcs?.consumption;if(v===undefined){if(s.lifeArcs?.pending==='consumption')throw Error('消费事件缺少记录');return;}
 const bad=()=>{throw Error('存档中的消费事件无效');},int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 if(!v||Array.isArray(v)||!int(v.rolls)||!int(v.lastRollDay,-5)||v.lastRollDay>day(s)||![0,30000].includes(v.monthly)||!int(v.lastReviewDay)||v.lastReviewDay>day(s)||!Array.isArray(v.history)||v.history.length>24)bad();
 if(v.pending!==null){const p=v.pending;if(!p||!Object.hasOwn(CONSUMPTION_EVENTS,p.id)||!int(p.profit)||!int(p.day)||p.day>day(s)||(CONSUMPTION_EVENTS[p.id].minProfit||0)>p.profit)bad();}
 if(s.lifeArcs.pending==='consumption'&&!v.pending)bad();
 if(v.followup!==null&&(!v.followup||v.followup.id!=='invitation'||!int(v.followup.due)))bad();
 for(const h of v.history){const e=CONSUMPTION_EVENTS[h.id],c=e?.choices.find(c=>c.id===h.choice);if(!e||(!c&&!(h.choice==='skip'&&h.id!=='bills'))||!int(h.day)||h.day>day(s)||h.cost!==(c?.cost||0))bad();}
}
