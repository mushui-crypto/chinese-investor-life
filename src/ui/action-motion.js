// Flavor is tied to completed actions only: no random draw, prediction or game-state mutation.
export function actionQuip(s){
 const type=s.journey?.lastAction,cash=s.lastResult?.changes?.find(c=>c.label==='现金')?.value||0;
 if(['desk_order','invest'].includes(type)&&s.cash===0)return '仓位满了，钱包空了。下顿饭还得另想办法。';
 if(['desk_order','invest'].includes(type))return '买入前研究公司，买入后研究自己。';
 if(['desk_sell','sell'].includes(type)&&cash>0)return '落袋的是现金，截图里的不算。';
 if(['work','gig'].includes(type)&&s.flags.had_margin_crisis)return 'K 线可以画饼，工钱今天到账。';
 if(type==='child_sell')return '第一次当老板：营业额和利润，原来是两回事。';
 return '';
}
export function playActionMotion(action){
 if(document.documentElement.classList.contains('reduce-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const targets=[document.querySelector('.trade-mail-trigger.is-unread')||document.querySelector('.inline-receipt'),document.querySelector('.child-offer')];
 if(['desk_order','desk_sell','gamble','child_sell'].includes(action.type))targets.push(document.querySelector('.cash-budget [data-budget=cash]'));
 for(const el of targets.filter(Boolean)){el.classList.add('action-arrival');el.addEventListener('animationend',()=>el.classList.remove('action-arrival'),{once:true});}
}
