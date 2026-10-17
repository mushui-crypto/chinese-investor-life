export const POCKET_MONEY_AGE = 6;
export const CHILD_GOODS=[{id:'book',name:'旧漫画',price:1200},{id:'toy',name:'模型玩具',price:2400},{id:'game',name:'二手卡带',price:4800}];
export const CHILD_ACTIONS=new Set(['child_buy','child_price','child_sell','child_decline','child_clear']);
export function newChildhood(s){return {version:1,mode:s.age<18?'short':'legacy',step:s.age>=18?'grown':s.phase==='planning'?'play':'story',focus:'study',rounds:0,inventory:null,offer:null,purchases:0,receipts:0,history:[],startAge:s.age,startCash:s.cash,startStats:{academic:s.stats.academic,discipline:s.stats.discipline,skill:s.stats.skill,insight:s.stats.insight,trust:s.stats.trust},summary:null};}
export function childState(s){return s.childhood||(s.childhood=newChildhood(s));}
export const childhoodValue=s=>s.childhood?.inventory?.cost||0;
export function childMarketSession(s){
 const c=childState(s),stage=s.age<15?12:15;
 const previous=c.marketStage??(c.history[0]?.age>=15?15:12);
 return {stage,rounds:c.offer||previous===stage?c.rounds:0};
}
export function childAvailability(s,a){const c=childState(s);if(s.phase!=='planning'||s.age<12||s.age>=18)return '12–17 岁，在故事结束后的童年集市操作';
 const {rounds}=childMarketSession(s);
 if(a.type==='child_buy'){const g=CHILD_GOODS.find(x=>x.id===a.good);if(!g||!Number.isSafeInteger(a.quantity)||a.quantity<1||a.quantity>3)return '每批可进 1–3 件';if(rounds>=3)return '本学段的集市已收摊';if(c.inventory)return '先处理手头的货';if(g.price*a.quantity>s.cash)return '零花钱不够支付这批货';return '';}
 if(a.type==='child_clear')return c.inventory?'':'没有待处理的余货';
 if(!c.inventory)return '先挑一批货';
 if(a.type==='child_price'){if(c.offer)return '先回应眼前的买家';if(rounds>=3)return '本学段买家已逛完，可五折清仓或留到下一学段';return [.9,1.25,1.75].includes(a.markup)?'':'请选择有效售价';}
 if(['child_sell','child_decline'].includes(a.type))return c.offer?'':'还没有买家报价';return '未知集市动作';}
function note(s,text){childState(s).history.push({age:s.age,text});}
export function executeChild(s,a,api){const c=childState(s);let text='';
 if(!c.offer){const session=childMarketSession(s);c.rounds=session.rounds;c.marketStage=session.stage;}
 if(a.type==='child_buy'){const g=CHILD_GOODS.find(x=>x.id===a.good),cost=g.price*a.quantity;api.cashChange(s,-cost,'童年集市进货');c.inventory={id:g.id,quantity:a.quantity,cost};c.purchases+=cost;api.record(s,'business',cost,'童年集市存货');text=`进了 ${a.quantity} 件${g.name}，支付 ${cost/100} 元。现在给这批货定个价。`;}
 if(a.type==='child_price'){const i=c.inventory,unit=CHILD_GOODS.find(x=>x.id===i.id).price,asking=Math.round(unit*a.markup),accept=api.draw(s)<(a.markup===.9?.9:a.markup===1.25?.65:.25);const bid=accept?asking:Math.round(unit*(.6+api.draw(s)*.5));c.rounds++;c.offer={asking,bid,total:bid*i.quantity,round:c.rounds};text=`第 ${c.rounds} 位买家${accept?'愿意按标价买':'还了个价'}：每件 ${bid/100} 元，整批 ${c.offer.total/100} 元。成交与否由你决定。`;}
 if(a.type==='child_decline'){text='你谢过这位买家，把货留在摊上。';c.offer=null;}
 if(a.type==='child_sell'||a.type==='child_clear'){const cost=c.inventory.cost,paid=a.type==='child_clear'?Math.floor(cost*.5):c.offer.total;api.cashChange(s,paid,a.type==='child_clear'?'童年余货五折清仓':'童年集市成交');api.record(s,'business',-cost,'童年集市存货离开');c.receipts+=paid;c.inventory=null;c.offer=null;if(a.type==='child_sell')api.stat(s,{skill:2,insight:1,trust:1});if(a.type==='child_sell'){s.relationships.N07=Math.min(100,(s.relationships.N07??s.stats.trust)+3);s.flags.childhood_merchant=true;}text=`${a.type==='child_clear'?'余货按进价五折处理':'这一批成交了'}，实际收款 ${paid/100} 元，本批${paid>=cost?'赚':'亏'} ${Math.abs(paid-cost)/100} 元。`;}
 note(s,text);return text;
}
export function validateChildhood(s){const c=childState(s),bad=()=>{throw Error('童年回忆或集市记录无效');},int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 if(c.marketStage!==undefined&&(![12,15].includes(c.marketStage)||c.marketStage>s.age))bad();
 if(c.allowanceThroughMonth!==undefined&&(!int(c.allowanceThroughMonth,72)||c.allowanceThroughMonth>Math.min(215,Math.floor(s.age*12))))bad();
 if(c.version!==1||!['short','legacy'].includes(c.mode)||!['story','play','grown'].includes(c.step)||!['study','practical','social'].includes(c.focus)||!int(c.rounds)||c.rounds>3||!int(c.purchases)||!int(c.receipts)||!int(c.startCash)||!Number.isFinite(c.startAge)||c.startAge<0||c.startAge>s.age)bad();
 for(const key of ['skill','insight','trust'])if(!Number.isFinite(c.startStats?.[key])||c.startStats[key]<0||c.startStats[key]>100)bad();
 if(c.inventory){const g=CHILD_GOODS.find(x=>x.id===c.inventory.id);if(!g||!int(c.inventory.quantity,1)||c.inventory.quantity>3||c.inventory.cost!==g.price*c.inventory.quantity||s.age>=18)bad();}
 if(c.offer){if(!c.inventory||!int(c.offer.bid,1)||!int(c.offer.asking,1)||!int(c.offer.total)||c.offer.total!==c.offer.bid*c.inventory.quantity||c.offer.round!==c.rounds)bad();}
 if(!Array.isArray(c.history)||c.history.length>30||c.history.some(h=>!Number.isFinite(h.age)||h.age<0||h.age>s.age||typeof h.text!=='string'||h.text.length>1000))bad();
 if(c.workBonusTurn!==undefined&&(!int(c.workBonusTurn)||c.workBonusTurn>s.turn))bad();
 if(c.birth!==undefined){const b=c.birth;if(!b||b.version!==1||!int(b.page)||b.page>2||typeof b.complete!=='boolean')bad();if(!b.complete&&(s.age!==0||!['event','result'].includes(s.phase)||s.activeEvent?.eventId!=='MAIN01'))bad();}
 if(c.summary){if(c.summary.path!==undefined&&!['study','practical','social'].includes(c.summary.path))bad();c.summary.academic??=s.stats.academic;c.summary.discipline??=s.stats.discipline;for(const k of ['cash','gift','purchases','receipts','academic','discipline','skill','insight','trust'])if(!Number.isFinite(c.summary[k]))bad();if(s.age<18)bad();}
}
