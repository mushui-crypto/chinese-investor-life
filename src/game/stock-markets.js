import {openDailyQuote,recordDailyQuote,validateDailyQuotes} from './daily-quotes.js';
/** Fictional market personalities. Prices use game RMB equivalents, never live quotes. */
export const STOCK_MARKETS = Object.freeze({
  a:{id:'a',name:'A 股',tag:'热点轮动',rule:'100 股一手 · T+1 · 普通主板式 ±10%',sellDelay:1,limit:.10,description:'消息点燃题材，热钱切换板块。急涨、回撤与漫长震荡交替出现。',detail:'100 股一手；今日买入的新仓，下一交易日才能卖出。已有可卖旧仓不受影响。本局公司采用普通主板式每日 ±10% 涨跌幅。'},
  hk:{id:'hk',name:'港股',tag:'估值拉锯',rule:'每手股数因公司而异 · 日内可卖',sellDelay:0,limit:null,description:'低估值可能继续磨人，也可能遇到资金回流，突然迎来重估。',detail:'每手股数显示在下单区，按该公司的整手数量买卖。新仓可以日内卖出，本局不设 A 股式每日涨跌停。'},
  us:{id:'us',name:'美股',tag:'成长与财报',rule:'1 股起买 · 日内可卖',sellDelay:0,limit:null,description:'成长预期推动趋势，利率和财报又会突然改写价格。大盘上涨也不等于每家公司都涨。',detail:'1 股起买，按整数股下单。新仓可以日内卖出，本局不设 A 股式每日涨跌停。买入全额支付现金。'},
});
export const STOCKS = [
  {id:'chip',market:'a',name:'海临芯科',tag:'科技成长',vol:.035,lot:100,note:'研发投入高，题材能引来热钱，订单兑现仍需时间。'},
  {id:'retail',market:'a',name:'巷里百货',tag:'消费复苏',vol:.022,lot:100,note:'客流恢复了，利润仍受租金影响。'},
  {id:'energy',market:'a',name:'远山能源',tag:'资源周期',vol:.029,lot:100,note:'订单随景气走，扩产也会占用现金。'},
  {id:'dividend',market:'a',name:'海港公用',tag:'红利防守',vol:.012,lot:100,note:'收入较平稳，增长空间也有限。'},
  {id:'hk_platform',market:'hk',name:'海湾互联',tag:'平台经济',vol:.029,lot:100,note:'利润改善与资金流向拉扯估值，低价本身不能保证反弹。'},
  {id:'hk_property',market:'hk',name:'九龙置业',tag:'地产收租',vol:.035,lot:500,note:'租金、融资成本和资产折价，决定市场愿意给多少钱。'},
  {id:'hk_health',market:'hk',name:'维港新药',tag:'创新医药',vol:.05,lot:50,note:'临床与授权消息可带来暴涨，也会在失败时急跌。'},
  {id:'hk_income',market:'hk',name:'南湾电讯',tag:'高息经营',vol:.014,lot:1000,note:'分红叙事吸引长线资金，经营下滑时高息也可能失去支撑。'},
  {id:'us_compute',market:'us',name:'星核算力',tag:'AI 算力',vol:.04,lot:1,note:'增长故事越热，市场对下一份财报的要求越高。'},
  {id:'us_cloud',market:'us',name:'远境云端',tag:'云与软件',vol:.022,lot:1,note:'订阅收入支撑成长，资本开支和利率也会压缩估值。'},
  {id:'us_consumer',market:'us',name:'常青消费',tag:'稳定消费',vol:.012,lot:1,note:'经营较稳，涨势往往没有热门科技股耀眼。'},
  {id:'us_meme',market:'us',name:'火箭游戏',tag:'散户热门',vol:.07,lot:1,note:'社群热度能把价格推高，热情退去时也没有保本承诺。'},
];
// Values are deliberate game balance, not calibrated historical return forecasts.
export const STOCK_REGIMES = {
  a:[
    {id:'rotation',title:'题材轮动',drift:0,noise:.008,annual:.01,weight:4,news:'热点换了一桌，昨天领涨的公司今天未必接着涨。',meme:'指数没走多远，我已经换了三轮自选。'},
    {id:'policy',title:'政策暖风',drift:.014,noise:.012,annual:.18,weight:2,news:'政策预期升温，题材股成交活跃，追涨的人涌进大厅。',meme:'这次牛市，能不能顺便把我解套？'},
    {id:'retreat',title:'热钱退潮',drift:-.014,noise:.014,annual:-.17,weight:2,news:'前期热门板块出现获利回吐，接力资金开始犹豫。',meme:'说好回本就走，结果又多站了一班岗。'},
    {id:'repair',title:'盈利修复',drift:.006,noise:.009,annual:.10,weight:2,news:'订单与消费数据回暖，资金重新关注能兑现的利润。',meme:'今天总算不用关灯吃面了。'},
  ],
  hk:[
    {id:'discount',title:'折价拉锯',drift:-.005,noise:.009,annual:-.04,weight:4,news:'公司看起来便宜，场内买盘却仍然谨慎。',meme:'以为捡了便宜，明天可能还有折上折。'},
    {id:'rerate',title:'资金回流',drift:.022,noise:.02,annual:.25,weight:2,news:'回购与资金流入叠加，低估值公司出现集中重估。',meme:'昨天还叫金融废墟，今天群名改成价值洼地。'},
    {id:'outflow',title:'流动性退潮',drift:-.022,noise:.021,annual:-.22,weight:2,news:'买盘变薄，外部风险偏好下降，部分公司跌幅放大。',meme:'我在等价值发现，价值像是换了个地址。'},
    {id:'income',title:'红利回暖',drift:.007,noise:.009,annual:.12,weight:2,news:'盈利和派息预期改善，部分资金回到经营稳定的公司。',meme:'先把分红收了，翻倍的事明天再聊。'},
  ],
  us:[
    {id:'growth',title:'成长趋势',drift:.009,noise:.008,annual:.13,weight:4,news:'盈利预期改善，成长公司持续吸引资金，但行业表现分化。',meme:'又创新高了，群里开始讨论自己是不是股神。'},
    {id:'ai',title:'科技抱团',drift:.016,noise:.014,annual:.22,weight:2,news:'AI 投入预期继续升温，热门科技公司成为行情焦点。',meme:'七姐妹的故事听懂了，就怕买在合影最后一排。'},
    {id:'rates',title:'利率冲击',drift:-.023,noise:.024,annual:-.23,weight:2,news:'利率预期上调，远期利润被重新定价，成长板块承压。',meme:'昨晚还在长期主义，醒来先找计算器。'},
    {id:'earnings',title:'财报分化',drift:0,noise:.015,annual:.02,weight:2,news:'财报季到来，超预期与失望同时发生，个股可能脱离大盘。',meme:'公司赚了钱，没赚够市场想象中的钱。'},
  ],
};
export const stockInstrument = value => STOCKS.find(i=>i.id===(typeof value==='string'?value.replace(/^stock:/,''):value?.instrument||value?.underlying?.replace(/^stock:/,'')));
export const stockMarket = value => STOCK_MARKETS[stockInstrument(value)?.market||'a'];
export const stockLot = value => stockInstrument(value)?.lot||100;
export function newStockWorld(){return Object.fromEntries(Object.keys(STOCK_MARKETS).map(id=>[id,{regime:STOCK_REGIMES[id][0].id,left:0,index:10000,open:10000,history:[10000],news:'交易所刚刚开门，等待第一段行情。',meme:'先看行情，再决定这一笔。'}]));}
export const stockWorld = s=>s.trading?.stockWorld||newStockWorld();
export const stockRegime = (s,id)=>STOCK_REGIMES[id].find(r=>r.id===stockWorld(s)[id].regime)||STOCK_REGIMES[id][0];
export function ensureStockWorld(s){if(s.trading.stockWorld===undefined)s.trading.stockWorld=newStockWorld();return s.trading.stockWorld;}
export function openStockDay(s){for(const w of Object.values(ensureStockWorld(s))){w.open=w.index;openDailyQuote(s,w,w.index);}}
function pickRegime(s,id,draw){const all=STOCK_REGIMES[id];let roll=draw(s)*all.reduce((n,r)=>n+r.weight,0);return all.find(r=>(roll-=r.weight)<0)||all.at(-1);}
function markIndex(w,move,mul){w.index=Math.max(1,mul(w.index,1+move));w.history.push(w.index);w.history=w.history.slice(-24);}
export function stockSegment(s,{draw,mul}){
  const world=ensureStockWorld(s),moves={};
  const global=(draw(s)-.5)*.009;
  for(const [id,w] of Object.entries(world)){
    if(w.left<=0){const r=pickRegime(s,id,draw);w.regime=r.id;w.left=6+Math.floor(draw(s)*7);w.news=r.news;w.meme=r.meme;}
    const r=stockRegime(s,id),common=r.drift/12+(draw(s)-.5)*2*r.noise+global;w.left--;
    const companies=STOCKS.filter(i=>i.market===id);
    const event=companies[Math.floor(draw(s)*companies.length)],surprise=draw(s)>.5;
    const eventMove=s.trading.phase===1?(surprise?1:-1)*(id==='us'?.10:id==='hk'?.07:.035):0;
    if(eventMove){w.news=`${r.news} ${event.name}：${surprise?'盈利或订单好于预期，买盘升温。':'业绩指引低于期待，价格承压。'}`;}
    for(const i of companies){const beta=i.id==='dividend'||i.id==='hk_income'||i.id==='us_consumer'?.5:1;moves[i.id]=common*beta+(draw(s)-.5)*2*i.vol+(i.id===event.id?eventMove:0);}
  }
  return moves;
}
/** Equal-weight fictional index tracks the actual listed quotes, including company news. */
export function markStockSegment(s,returns,mul,{daily=false}={}){for(const [id,w] of Object.entries(ensureStockWorld(s))){const values=STOCKS.filter(i=>i.market===id).map(i=>returns[i.id]||0);const before=w.index;markIndex(w,values.reduce((a,b)=>a+b,0)/values.length,mul);if(daily)recordDailyQuote(s,w,w.index,before);}}
/** Shared longer-period prices prevent holdings in the same company diverging. */
export function stockPeriodMoves(s,years,{draw}){
  ensureStockWorld(s);const moves={},global=(draw(s)-.5)*.14*Math.sqrt(years);
  for(const id of Object.keys(STOCK_MARKETS)){
    const r=pickRegime(s,id,draw),w=s.trading.stockWorld[id];w.regime=r.id;w.left=6+Math.floor(draw(s)*7);w.news=r.news;w.meme=r.meme;
    const common=r.annual*years+(draw(s)-.5)*.30*Math.sqrt(years)+global;
    for(const i of STOCKS.filter(i=>i.market===id))moves['stock:'+i.id]=Math.max(-.85,common+(draw(s)-.5)*i.vol*8*Math.sqrt(years));
  }
  return moves;
}
export function validateStockWorld(s,fail){
  const world=ensureStockWorld(s);
  if(!world||typeof world!=='object'||Array.isArray(world)||Object.keys(world).length!==3)fail('三地股票行情');
  for(const id of Object.keys(STOCK_MARKETS)){
    const w=world[id];if(!w||!STOCK_REGIMES[id].some(r=>r.id===w.regime)||!Number.isInteger(w.left)||w.left<0||w.left>12)fail('股票行情阶段');
    for(const key of ['index','open'])if(!Number.isSafeInteger(w[key])||w[key]<1)fail('股票模拟指数');
    if(!Array.isArray(w.history)||!w.history.length||w.history.length>24||w.history.some(n=>!Number.isSafeInteger(n)||n<1))fail('股票指数历史');
    validateDailyQuotes(s,w,w.index);
    for(const key of ['news','meme'])if(typeof w[key]!=='string'||!w[key].length||w[key].length>2000)fail('股票市场消息');
  }
}
