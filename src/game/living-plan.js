import {isCollegeStudent} from './education.js';
/** Player-selected costs. College and independent adult households have different baselines. */
export const HOUSING_PLANS={standard:{name:'独住原处',saving:0,note:'保持原来的住处'},shared:{name:'找室友分摊',saving:25,note:'基本开销 −25%；每天压力 +2'},outskirts:{name:'搬到远郊',saving:40,note:'基本开销 −40%；上班日疲劳 +6；搬家 ¥500'}};
export const FOOD_PLANS={normal:{name:'照常吃饭',saving:0,note:'保持原来的饮食开支'},cook:{name:'买菜做饭',saving:12,note:'基本开销 −12%；每天疲劳 +3'}};
export const livingPlan=s=>s.livingPlan??{housing:'standard',food:'normal',movedDay:null};
export const minimumLivingCost=s=>isCollegeStudent(s)?120000:240000;
export function planSavings(s,base){const p=livingPlan(s);return Math.min(Math.max(0,base-minimumLivingCost(s)),Math.floor(base*(HOUSING_PLANS[p.housing].saving+FOOD_PLANS[p.food].saving)/100));}
export function movingCost(s,housing){const old=livingPlan(s).housing;return old!==housing&&(old==='outskirts'||housing==='outskirts')?50000:0;}
export function livingPlanReason(s,a){
 if(s.phase!=='planning'||s.age<18||s.age>=80||s.legal?.prisonMonthsLeft>0)return '现在不能调整住处和日常开支';
 if(!Object.hasOwn(HOUSING_PLANS,a.housing)||!Object.hasOwn(FOOD_PLANS,a.food)||typeof a.cutExtras!=='boolean')return '请选择住处和饮食安排';
 const p=livingPlan(s),move=p.housing!==a.housing;
 if(!move&&p.food===a.food&&!(a.cutExtras&&(s.lifeArcs?.lifestyle||s.lifeArcs?.consumption?.monthly)))return '已经按这个安排生活';
 if(s.actionPoints<1)return '今天的生活安排已用完，明天再调整';
 if(move&&p.movedDay!==null&&(s.debtClock?.day||0)-p.movedDay<30)return `住处刚调整过，${30-((s.debtClock?.day||0)-p.movedDay)} 天后再换`;
 if(movingCost(s,a.housing)>s.cash)return '搬家需要 ¥500，手头现金不够；也可以先找室友分摊';
 return '';
}
export function changeLivingPlan(s,a,api){
 const before=livingPlan(s),cost=movingCost(s,a.housing),move=before.housing!==a.housing;
 if(cost)api.cashChange(s,-cost,'搬家开销');
 s.livingPlan={housing:a.housing,food:a.food,movedDay:move?(s.debtClock?.day||0):before.movedDay};s.actionPoints--;
 if(a.cutExtras&&s.lifeArcs){s.lifeArcs.lifestyle=0;if(s.lifeArcs.consumption){s.lifeArcs.consumption.monthly=0;if(s.lifeArcs.consumption.pending?.id==='bills'){s.lifeArcs.consumption.pending=null;if(s.lifeArcs.pending==='consumption')s.lifeArcs.pending=null;}}}
 return `${HOUSING_PLANS[a.housing].name}，${FOOD_PLANS[a.food].name}。生活费调整为每月 ¥${(api.metrics(s).monthlyExpense/100).toFixed(2)}，从下次日结起计费。${cost?'搬家花了 ¥500。':''}`;
}
export function livingPlanEffects(s,days,api,{age=s.age,prison=Boolean(s.legal?.prisonMonthsLeft),worked=s.monthlyIncome>0&&s.occupation!=='退休'&&!s.behavior?.leaveDays&&!s.behavior?.jobStartsTomorrow}={}){
 if(!s.livingPlan||age<18||age>=80||prison||days<=0)return;
 const p=livingPlan(s);if(p.housing==='shared')api.stat(s,{stress:2*days});
 const fatigue=(p.food==='cook'?3:0)+(p.housing==='outskirts'&&worked?6:0);
 s.behavior.fatigue=Math.min(100,s.behavior.fatigue+fatigue*days);
}
export function validateLivingPlan(s){
 const p=s.livingPlan;if(p===undefined)return;
 if(!p||Array.isArray(p)||!Object.hasOwn(HOUSING_PLANS,p.housing)||!Object.hasOwn(FOOD_PLANS,p.food)||!(p.movedDay===null||Number.isSafeInteger(p.movedDay)&&p.movedDay>=0&&p.movedDay<=(s.debtClock?.day||0)))throw Error('生活开支安排无效');
}
