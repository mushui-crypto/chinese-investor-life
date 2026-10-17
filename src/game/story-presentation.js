import {contextualChoice} from './story-context.js';
/** Player-facing story copy; these helpers do not execute or preview a transaction. */
export const STORY_PRODUCT_NAMES={stock:'股票',allin:'股票',fund:'基金',options:'买方期权',option_sell:'卖方期权',contract:'期货与外汇',crypto:'加密货币',business:'合伙经营',expand:'扩店经营',antique:'藏品转卖',ponzi:'高息项目',angel:'创业股权',housing:'房产',uw_gamble:'赌局',uw_chase:'赌局'};
const INVESTMENT_OPS=new Set(['venture','illiquid','freeze_investment']);
const MARKET_CATEGORIES=new Set(['股票','基金与债券','期权','期货与合约','加密资产','资金盘与骗局','天使投资与创业股权','房产与大额资产','历史冲击']);
/** Classify the chosen action, not the event category or the direction of a price chart. */
export function storyResultContext(event,choice,outcome,result){
 const effects=outcome?.effects||[],investments=effects.filter(e=>INVESTMENT_OPS.has(e.op));
 const profile=choice?.profile||'',marketRelated=MARKET_CATEGORIES.has(event?.category);
 if(investments.length){
  // New receipts isolate investment P&L from any unrelated income or spending.
  // Old saves contain the actual net-worth change; never rerun effects to reconstruct it.
  const measured=result.investmentChanges;
  const pnl=measured?.length?measured.reduce((n,c)=>n+c.value,0):Array.isArray(result.changes)?(result.changes.find(c=>c.label==='净资产')?.value??0):null;
  const settlement=investments.some(e=>e.op==='freeze_investment')?'frozen':investments.some(e=>e.op==='illiquid')?'valuation':'realized';
  return {activity:'investment',profile,marketRelated,settlement,pnl};
 }
 return {activity:['study','self_study'].includes(profile)?'study':profile==='observe'?'observe':'life',profile,marketRelated};
}
export function storyCashLabel(profile,returning=false){
 const name=STORY_PRODUCT_NAMES[profile]||'剧情投资';
 return `${name}${returning?'结算回款（含本金）':'投入款'}`;
}
export function outcomeTitle(event,choice,outcome){
 if(outcome?.title)return outcome.title;
 const e=outcome?.effects?.find(e=>e.op==='venture');
 if(!e)return event.title;
 const name=STORY_PRODUCT_NAMES[choice.profile]||'这笔投资';
 return `${name}${e.gross_multiple>1?'结算获利':e.gross_multiple===1?'结算收回本金':e.gross_multiple===0?'结算，本次投入全部损失':'结算亏损，收回部分本金'}`;
}
const INTRO={
 股票:['第一次了解股票','阿豪指着行情软件里的公司名字说：“买股票，就是把钱投进这家公司的一小份权益里。”你点开走势图，才知道价格会涨也会跌；赚不赚钱，要看买入和卖出的价格。'],
 基金与债券:['第一次了解基金和债券','你想给存款找个去处，翻开银行的产品介绍。基金把多人的钱交给经理投资，净值也会下跌；债券则约定付息还本，但发行人也可能还不上。你把两页说明并排放好，开始比较。'],
 期权:['第一次了解期权','朋友发来一张低价合约：“先付权利金，就能买一份有期限的权利。”你追问下去才明白，方向和到期时间都重要；买方可能亏光权利金，卖方承担的赔付还可能超过保证金。'],
 期货与合约:['第一次了解杠杆交易','阿豪展示了一笔黄金交易：只拿一部分钱作保证金，却押着更大的仓位。你发现它既能做多也能做空，赚亏都会被放大；行情走反，保证金不够就会被强平。'],
 加密资产:['第一次了解加密货币','朋友拿来一张币价截图。你顺着交易所页面看下去，才发现这里全天都有行情：现货是直接买币，合约是押涨跌并使用杠杆，新币还可能突然归零。'],
 资金盘与骗局:['熟人介绍的高收益项目','一位熟人递来项目链接，说收益每天都在涨。你没听懂钱究竟怎么赚来，对方却催你先入金。页面数字很好看，真正能提现多少，还没有人说清。'],
 天使投资与创业股权:['第一次收到创业投资邀请','一个做项目的朋友把计划书放在你面前，想用公司的一部分股权换启动资金。公司估值不等于现金，买下股权后也未必随时能卖；要等分红、转让或退出，钱才可能回来。'],
 房产与大额资产:['第一次认真算买房的账','你经过中介门店，被一张房源单吸引。中介说可以全款，也可以首付加按揭。你拿笔把房价、月供、租金和维修费一项项写下来：房子可能涨价，也可能空置或卖不出去。'],
};
export function marketStoryIntroduction(state,event,catalog){
 if(event.schemeLife||event.kind==='world'||state.legal?.prisonMonthsLeft||!INTRO[event.category]||state.age<18)return null;
 if(catalog.events.some(e=>state.seenEvents?.includes(e.id)&&e.category===event.category))return null;
 if(event.category==='股票'&&state.flags?.stock_aware||event.category==='加密资产'&&state.flags?.crypto_aware||event.category==='资金盘与骗局'&&state.flags?.ponzi_exposed)return null;
 return INTRO[event.category];
}
export function currentResultCopy(state,catalog){
 const r=state.lastResult||{},e=catalog.events.find(e=>e.id===r.eventId),raw=e?.choices.find(c=>c.id===r.choiceId),c=raw?contextualChoice(state,e,raw):null,o=c?.outcomes.find(o=>o.id===r.outcomeId);
 if(e?.studentStory||e?.onlineGambling||r.onlineGambling||e?.cryptoLife||r.cryptoLife)return r; // Saved school resolution includes contextual tokens and memory; never regenerate it.
 // Historical charges remain historical; do not describe an old paid receipt as free.
 if(e?.id==='HOU07'&&r.changes?.some(x=>x.label==='现金'&&x.value<0))return {...r,title:'此前已支付住房资料费用',text:'这笔费用是旧规则下已经结算的支出，金额仍以原回单为准。现在查阅公开房源和施工信息已改为免费。'};
 // New titles can be applied to an already-open result without replaying its effects.
 return o?{...r,title:outcomeTitle(e,c,o),text:o.text,context:storyResultContext(e,c,o,r)}:r;
}
export function resultMood(state,result=state.lastResult){
 if(state.phase!=='result'||state.lastResult?.error)return null;
 if(result?.onlineGambling||result?.cryptoLife){const value=result.changes?.find(x=>x.label==='净资产')?.value||0;return value>0?'profit':value<0?'loss':null;}
 const context=result?.context;
 if(context&&(context.activity!=='investment'||context.settlement!=='realized'))return null;
 const net=context?context.pnl:result?.changes?.find(x=>x.label==='净资产')?.value;
 return net>0?'profit':net<0?'loss':null;
}
