// Story discovery and unread price movement never grant trading permission.
export const MARKET_KEYS=['stock','fund','bond','option','futures','crypto','ponzi','angel','housing','gambling'];
export const noticeMarket=key=>key==='option_short'?'option':key==='crypto_perp'?'crypto':key;
const categoryMarkets={'股票':['stock'],'基金与债券':['fund','bond'],'期权':['option'],'期货与合约':['futures'],'加密资产':['crypto'],'资金盘与骗局':['ponzi'],'天使投资与创业股权':['angel'],'房产与大额资产':['housing']};
const profileMarket={stock:'stock',allin:'stock',fund:'fund',options:'option',option_sell:'option',contract:'futures',crypto:'crypto',ponzi:'ponzi',angel:'angel',housing:'housing'};
export function storyMarkets(event){
 if(!event)return [];
 const result=new Set(categoryMarkets[event.category]||[]);
 if(event.kind==='world')for(const c of event.choices||[])if(profileMarket[c.profile])result.add(profileMarket[c.profile]);
 if(/^AGE16/.test(event.id))result.add('stock');
 if(/^AGE18[UN]$/.test(event.id))result.add('crypto');
 if(event.schemeLife)result.add('ponzi');
 else if(event.cryptoLife)result.add('crypto');
 if(event.id==='OG01'||/^AGE20[UN]$/.test(event.id))result.add('gambling');
 if(/^AGE24/.test(event.id))result.add('ponzi');
 return [...result];
}
export function discoveredMarkets(s,catalog){
 const found=new Set(Object.keys(s.marketNotices?.introduced||{}));
 for(const [flag,key] of [['stock_aware','stock'],['crypto_aware','crypto'],['gambling_exposed','gambling'],['ponzi_exposed','ponzi']])if(s.flags?.[flag])found.add(key);
 for(const p of s.positions||[])found.add(noticeMarket(p.kind));
 if(catalog){const seen=new Set([...(s.seenEvents||[]),s.activeEvent?.eventId]);for(const e of catalog.events)if(seen.has(e.id))storyMarkets(e).forEach(k=>found.add(k));}
 return [...found].filter(k=>MARKET_KEYS.includes(k));
}
function positionSnapshot(s){return Object.fromEntries((s.positions||[]).filter(p=>MARKET_KEYS.includes(noticeMarket(p.kind))).map(p=>[p.id,{market:noticeMarket(p.kind),price:p.lastPrice??p.entryPrice??0,value:p.value,cost:p.cost??0}]));}
export function syncMarketNotices(s,catalog){
 const before=JSON.stringify(s.marketNotices);
 const n=s.marketNotices??={introduced:{},unread:{},positions:{}};
 for(const key of discoveredMarkets(s,catalog))if(!n.introduced[key]){n.introduced[key]=true;n.unread[key]={...n.unread[key],introduced:true};}
 const positions=positionSnapshot(s);
 for(const [id,p] of Object.entries(positions)){
  const previous=n.positions[id];
  // A quantity change from an order is not a quote update. At unchanged cost, mark-to-market and time decay count too.
  if(previous&&(p.price!==previous.price||p.cost===previous.cost&&p.value!==previous.value))n.unread[p.market]={...n.unread[p.market],price:true};
 }
 for(const [id,p]of Object.entries(n.positions))if(!positions[id]&&(s.ledger||[]).some(e=>e.positionId===id&&e.account==='position'&&/强平|到期|每日结清|保证金耗尽/.test(e.label)))n.unread[p.market]={...n.unread[p.market],price:true};
 n.positions=positions;
 return before!==JSON.stringify(n);
}
export function marketNotice(s,key){const n=s.marketNotices?.unread?.[noticeMarket(key)];return n?.introduced?'新市场':n?.price?'持仓行情有变化':'';}
export function hasMarketNotice(s){return MARKET_KEYS.some(k=>marketNotice(s,k));}
export function readMarketNotice(s,key){const k=noticeMarket(key);if(!s.marketNotices?.unread?.[k])return false;delete s.marketNotices.unread[k];return true;}
export function validateMarketNotices(s,fail){
 const n=s.marketNotices;if(n===undefined)return;
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if(!obj(n)||!obj(n.introduced)||!obj(n.unread)||!obj(n.positions))fail('市场提醒');
 for(const [k,v]of Object.entries(n.introduced))if(!MARKET_KEYS.includes(k)||v!==true)fail('市场介绍');
 for(const [k,v]of Object.entries(n.unread))if(!MARKET_KEYS.includes(k)||!obj(v)||Object.entries(v).some(([a,b])=>!['introduced','price'].includes(a)||b!==true))fail('未读市场提醒');
 if(Object.keys(n.positions).length>20000)fail('持仓提醒数量');
 for(const [id,p]of Object.entries(n.positions))if(id.length>200||!obj(p)||!MARKET_KEYS.includes(p.market)||['price','value','cost'].some(k=>!Number.isFinite(p[k])||p[k]<0))fail('持仓提醒');
}
