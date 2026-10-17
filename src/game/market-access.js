/** Game adaptations of access concepts, not a replica of any brokerage approval process. */
const OPTION_ACCESS = Object.freeze({group:'进阶交易',minAge:18,capital:50000000,insight:40,note:'期权买方与卖方共用开户条件。'});
export const MARKET_RULES = Object.freeze({
  crypto_perp: { group:'特殊经历', minAge:18, capital:0, insight:0, knowledgeFlag:'crypto_aware', note:'随加密市场一同开放；高杠杆与当日自动平仓为游戏设定。' },
  fund: { group:'基础投资', minAge:18, capital:0, insight:0, note:'成年即可了解；最低投入是游戏份额设定。' },
  bond: { group:'基础投资', minAge:18, capital:0, insight:15, note:'本作以一般债券组合简化债券类型；眼力门槛为游戏设定。' },
  stock: { group:'基础投资', minAge:18, capital:0, insight:0, knowledgeFlag:'stock_aware', note:'16 岁通过家庭故事了解股票，18 岁才可开户交易。' },
  option: OPTION_ACCESS,
  futures: { group:'进阶交易', minAge:18, capital:50000000, insight:40, note:'以金融期货准入难度设计本作合约层级；不代表现实市场都有统一门槛。' },
  option_short: OPTION_ACCESS,
  housing: { group:'长期资产', minAge:18, capital:20000000, insight:0, note:'真实购房与贷款条件因城市、项目和银行而异。' },
  angel: { group:'长期资产', minAge:18, capital:300000000, insight:60, note:'游戏条件不等同现实合格投资者认定。' },
  crypto: { group:'特殊经历', minAge:18, capital:0, insight:0, knowledgeFlag:'crypto_aware', note:'18 岁通过大学室友或社会关系了解后开放；不代表境内可合法开通加密交易服务。' },
  ponzi: { group:'特殊经历', minAge:24, capital:0, insight:0, knowledgeFlag:'ponzi_exposed', note:'24 岁后经熟人故事接触。资金盘不是正规投资。' },
});
export const PROFILE_PRODUCT = Object.freeze({stock:'stock',allin:'stock',fund:'fund',options:'option',option_sell:'option_short',contract:'futures',angel:'angel',housing:'housing'});
export function marketCapital(state) {
  const eligible = new Set(['stock','fund','bond','option','option_short','futures']);
  const assets = state.positions.filter(p=>eligible.has(p.kind)&&!p.frozen).reduce((n,p)=>n+p.value,0);
  const debt = state.debts.reduce((n,d)=>n+d.principal+d.interest,0);
  return Math.max(0,state.cash+assets-debt);
}
export function marketExperience(state) {
  const first = state.marketProgress?.firstExperienceAge;
  return { months:first == null ? 0 : Math.max(0,Math.floor((state.age-first)*12+1e-6)), simulations:state.marketProgress?.simulations ?? 0 };
}
export function getMarketAccess(state, product) {
  const rule = MARKET_RULES[product];
  if (!rule) return {unlocked:false,requirements:[],missing:[{label:'未知市场'}],reason:'未知市场'};
  const capital = marketCapital(state), experience = marketExperience(state);
  const requirement = (key,label,current,target,unit) => ({key,label,current,target,unit,met:current>=target});
  const requirements = [requirement('age',`年满 ${rule.minAge} 岁`,state.age,rule.minAge,'岁')];
  if(rule.capital) requirements.push(requirement('capital','自有金融资产',capital,rule.capital,'money'));
  if(rule.insight) requirements.push(requirement('insight','眼力见',state.stats.insight,rule.insight,'点'));
  if(rule.knowledgeFlag) requirements.push(requirement('knowledge',({stock_aware:'16 岁家庭股票认知',crypto_aware:'18 岁加密认知事件',ponzi_exposed:'24 岁资金盘接触事件'})[rule.knowledgeFlag],Number(Boolean(state.flags?.[rule.knowledgeFlag])),1,'次'));
  if(rule.storyPrefix) requirements.push(requirement('story','遇到一次相关剧情',Number((state.seenEvents??[]).some(id=>id.startsWith(rule.storyPrefix))),1,'次'));
  const opened = state.marketProgress?.unlocked;
  const granted = Boolean(opened?.[product] || (['option','option_short'].includes(product) && (opened?.option || opened?.option_short)) || (['crypto','crypto_perp'].includes(product) && (opened?.crypto || opened?.crypto_perp)));
  // Previously opened products stay open after market losses. Prison/age/actions still gate each order in core.
  const missing = granted ? requirements.filter(r=>r.key==='age'&&!r.met) : requirements.filter(r=>!r.met);
  return {unlocked:!missing.length,granted,requirements,missing,capital,experience,rule,reason:missing.length?'尚未开放：'+missing.map(r=>r.key==='capital'?`自有金融资产需 ¥${(r.target/100).toLocaleString('zh-CN')}`:['story','knowledge'].includes(r.key)?r.label:`${r.label}${r.key==='age'?'':`需 ${r.target} ${r.unit}`}`).join('、'):''};
}
export function getGamblingAccess(state){const age=state.flags?.onlineGamblingExposed?18:20,requirements=[{key:'age',label:`年满 ${age} 岁`,current:state.age,target:age,unit:'岁',met:state.age>=age},{key:'knowledge',label:'在故事中接触群里的链接',current:Number(Boolean(state.flags?.gambling_exposed)),target:1,unit:'次',met:Boolean(state.flags?.gambling_exposed)}],missing=requirements.filter(r=>!r.met);return {unlocked:!missing.length,requirements,missing,reason:missing.length?'尚未开放：'+missing.map(r=>r.label).join('、'):''};}
export function recordMarketExperience(state, product) {
  state.marketProgress ??= {firstExperienceAge:null,simulations:0,unlocked:{}};
  state.marketProgress.firstExperienceAge ??= state.age;
  if(product && MARKET_RULES[product]) state.marketProgress.unlocked[product] = true;
  if(['option','option_short'].includes(product))Object.assign(state.marketProgress.unlocked,{option:true,option_short:true});
  if(['crypto','crypto_perp'].includes(product))Object.assign(state.marketProgress.unlocked,{crypto:true,crypto_perp:true});
}

export function rememberOpenMarkets(state, previous=state) {
 if(state.age<18)return;
 state.marketProgress ??= {firstExperienceAge:null,simulations:0,unlocked:{}};
 state.marketProgress.unlocked ??= {};
 for(const product of Object.keys(MARKET_RULES))if(getMarketAccess(previous,product).unlocked||getMarketAccess(state,product).unlocked)state.marketProgress.unlocked[product]=true;
}
