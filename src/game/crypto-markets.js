/** Fictional game parameters. No exchange connection. */
export const CRYPTO_LEVERAGES=[10,25,50,100,200,500,1000];
// Preserve existing <=100x positions; higher tiers retain 25% of posted margin.
export const cryptoMaintenanceRate=leverage=>leverage>100?.25/leverage:.005;
export const FICTIONAL_CRYPTO_COINS=[
 {id:'CLG',name:'澄光币',tag:'虚构 · 现货',vol:.045,reference:1,cryptoLifeBranch:'spot'},
 {id:'CHI',name:'赤尾币',tag:'虚构 · 山寨',vol:.16,reference:.1,cryptoLifeBranch:'alt'},
];
export const CRYPTO_COINS=[
 {id:'BTCUSDT',name:'BTC / USDT',tag:'主流 · 比特币',vol:.035},
 {id:'ETHUSDT',name:'ETH / USDT',tag:'主流 · 以太坊',vol:.045},
 {id:'BNBUSDT',name:'BNB / USDT',tag:'主流 · 平台币',vol:.05},
 {id:'SOLUSDT',name:'SOL / USDT',tag:'山寨 · 公链',vol:.07},
 {id:'DOGEUSDT',name:'DOGE / USDT',tag:'山寨 · Meme',vol:.09},
 {id:'ADAUSDT',name:'ADA / USDT',tag:'山寨 · 公链',vol:.06},
 {id:'XRPUSDT',name:'XRP / USDT',tag:'山寨 · 支付',vol:.065,reference:.4},
 {id:'AVAXUSDT',name:'AVAX / USDT',tag:'山寨 · 公链',vol:.08,reference:18},
 {id:'LINKUSDT',name:'LINK / USDT',tag:'山寨 · 预言机',vol:.065,reference:8},
 {id:'DOTUSDT',name:'DOT / USDT',tag:'山寨 · 跨链',vol:.07,reference:6},
 ...FICTIONAL_CRYPTO_COINS,
];
export const MEME_COINS=[['PIXIU','招财兽','招财'],['MOONCAT','月亮猫','猫系'],['RICE','暴富米','美食'],['FROG','呱呱乐','青蛙'],['ROCKET','火箭狗','太空'],['DUCK','鸭先知','鸭系'],['BAMBOO','熊猫烧香','熊猫'],['POTATO','土豆王','美食'],['FISH','咸鱼翻身','鱼系'],['LUCK','好运来','好运']].map(([id,name,theme])=>({id,name,tag:theme+' · Meme',meme:true,vol:.3,reference:.001}));
export const cryptoCoin=id=>[...CRYPTO_COINS,...MEME_COINS].find(i=>i.id===id);
function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function memeKind(s,id){
 if(!MEME_COINS.some(i=>i.id===id))return null;
 // PIXIU keeps its legacy contract. The remaining identities vary across lives.
 const ids=['PIXIU',...MEME_COINS.filter(i=>i.id!=='PIXIU').sort((a,b)=>hash(s.seed+':'+a.id)-hash(s.seed+':'+b.id)||a.id.localeCompare(b.id)).map(i=>i.id)];
 const index=ids.indexOf(id);return index<5?'honey':index<8?'rug':'random';
}
export const cryptoClock=s=>s.trading.day*3+s.trading.phase;
export const isRugged=(s,id)=>s.trading?.memeProjects?.[id]?.failed===true;

// Scam dashboards can invent huge balances. Saturate only this non-cash display.
export function growScamBook(balance){const value=(BigInt(balance)*5n+2n)/4n,limit=BigInt(Number.MAX_SAFE_INTEGER);return Number(value>limit?limit:value);}

export const cryptoModeFor=p=>p.kind==='crypto_perp'?'perp':MEME_COINS.some(i=>i.id===(p.instrument||p.underlying))?'meme':'spot';
