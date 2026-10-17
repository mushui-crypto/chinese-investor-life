import {MARKET_GUIDES} from '../game/market-guide.js';
import {isCollegeStudent} from '../game/education.js';
export const welcomeKey=kind=>kind==='option_short'?'option':kind;
const STORIES={
 stock:['第一次走进股票市场','阿豪把行情软件转向你，一排公司名字旁的价格不停跳动。“买的是公司的一小份权益，卖出时才知道这一笔赚了多少。”你决定先挑一家公司看看。','看看股票行情'],
 fund:['第一次挑选基金','你翻到银行的基金页面：有的把钱分散投向不同资产，有的集中买成长公司。管理人替你选投资，但净值下跌的损失仍由自己承担。','比较三类基金'],
 bond:['第一次了解债券','一份产品说明写着付息日和到期日。你问：“是不是到时候一定拿得回？”对方解释，发行人也可能违约；利息更高的那份，风险也更高。','看看利息和期限'],
 option:['第一次了解期权','朋友拿出一张带到期日的合约：买方先付权利金，猜对方向还要赶上时间。你又看了卖方那一栏——收取权利金的同时，也要承担履约赔付，可能亏过保证金。','比较买方和卖方'],
 futures:['第一次了解期货与外汇','阿豪展示了一笔黄金仓位：保证金不多，实际押着的金额却放大了好几倍。你往下翻，金属、能源、农产品、指数和汇率都能做多做空；方向错了会亏损，保证金不足会被强平。','看看五类交易标的'],
 crypto:['第一次打开币易交易所','朋友发来一张币价截图。你打开币易交易所，才发现这里一天到晚都有行情。直接买币是现货，押涨跌的是杠杆合约；合约会每日结清，新币则可能突然归零。','看看币价和交易方式'],
 ponzi:['熟人递来一个高收益项目','熟人翻着群里的收益截图，催你跟着投一笔。你问钱靠什么赚来，对方绕回“别人都提现了”。页面上的收益数字，还不能当成手里的现金。','查看项目与提现规则'],
 angel:['朋友带来一份创业计划书','朋友想用公司的一部分股权换启动资金。你翻到退出条款：公司估值可以上升，股份却不能随时卖掉。要赚到可用现金，还得等真正分红或退出。','看项目与退出条件'],
 housing:['第一次认真算投资房的账','中介把房源单和租金表放到你面前。你把首付、月供和维修费写在旁边，才发现空着的房子也有开销；买下来以后，还得考虑什么时候能卖出去。','比较房源和付款方式'],
 gambling:['深夜群里发来一个链接','有人晒出刚赢的一局，喊你也试试。你打开页面，看见不同玩法和下注金额。截图没有告诉你前面输过多少；真下注后，输赢会立即从现金里结算。','先看玩法，不下注'],
};
export function marketWelcome(s,kind){
 const key=welcomeKey(kind),story=STORIES[key];if(!story||s.flags?.['market_intro_'+key])return null;
 return {key,title:story[0],text:`${isCollegeStudent(s)?'大学里的一次课余闲聊，让你留意起这个市场。':'你开始留意这个市场，想弄明白它是怎么运作的。'}${story[1]}`,action:story[2],guide:MARKET_GUIDES[key]};
}
export function renderMarketWelcome(s,kind,{esc},rules=false){
 const p=marketWelcome(s,kind);if(!p)return '';
 return `<div class="market-welcome"><p class="result-dialog-text">${esc(p.text)}</p>${rules?`<section class="welcome-rules"><h3>${esc(p.guide.action)}</h3><p>${esc(p.guide.timing)}</p><p>${esc(p.guide.risk)}</p><p>${esc(p.guide.detail)}</p></section>`:''}<div class="market-welcome-choices"><button class="button primary" data-action="market-intro-enter" data-product="${esc(kind)}">${esc(p.action)} →</button>${rules?'':`<button class="button" data-action="market-intro-rules" data-product="${esc(kind)}">先弄懂怎么交易、怎么亏钱</button>`}<button class="text-button" data-action="close-dialog">暂时不看，回到刚才</button></div><p class="field-help">查看市场不会投入资金，下单金额由你决定。</p></div>`;
}
