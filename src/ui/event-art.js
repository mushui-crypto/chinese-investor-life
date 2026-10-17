import {storyArtKey,ageSafeArtKey} from './event-art-policy.js';
import {dormArt} from './dorm-art.js';
import {careerArt} from './career-art.js';
import {isCollegeStudent} from '../game/education.js';
/** Artwork reads settled receipts only; it never draws RNG or executes an outcome. */
export const EVENT_ART_ASSETS = {
  'student-shop-young':{src:'./public/assets/events/student-shop-young-v1.png',alt:'六岁小学生第一次在小卖部免费抽到零食奖品'},
  'student-marbles':{src:'./public/assets/events/student-marbles-v1.png',alt:'小学生在操场商量弹珠玩法'},
  'student-cards':{src:'./public/assets/events/student-cards-v1.png',alt:'小学生比较收藏卡片'},
  'student-shop':{src:'./public/assets/events/student-shop-v1.png',alt:'小学高年级同学在小卖部查看收藏卡与零食'},
  'student-arcade':{src:'./public/assets/events/student-arcade-v1.png',alt:'初中同学在游戏厅观察奖品机'},
  'student-card-club':{src:'./public/assets/events/student-card-club-v1.png',alt:'初中同学在课后商量卡牌规则'},
  'student-match':{src:'./public/assets/events/student-match-v1.png',alt:'高中同学在饮料店讨论比赛和小额赌约'},
  'student-game-items':{src:'./public/assets/events/student-game-items-v1.png',alt:'高中同学比较游戏里的虚拟道具'},
  'student-statistics':{src:'./public/assets/events/student-statistics-v1.png',alt:'高中同学核对比赛记录'},
  'student-graduation':{src:'./public/assets/events/student-graduation-v1.png',alt:'高中毕业前，同学翻看旧物谈起这些年的游戏'},

  'family-newborn-hospital':{src:'./public/assets/events/family-newborn-hospital-v1.png',alt:'产后病房里，刚出生的小满安静地躺在婴儿床中'},
  'family-date':{src:'./public/assets/events/family-date-v1.png',alt:'年轻的林夏与主角在校园附近的小店喝茶聊天'},
  'family-talk':{src:'./public/assets/events/family-talk-v1.png',alt:'小店里为两人留出的茶桌，手机收在一边，准备认真交谈'},
  'family-budget':{src:'./public/assets/events/personal-budget-v1.webp',alt:'两杯茶与生活账本，正在安排共同生活预算'},
  'family-wedding':{src:'./public/assets/events/family-wedding-v1.png',alt:'主角与林夏在家人聚餐的婚礼现场，相视微笑'},
  'family-baby-prep':{src:'./public/assets/events/family-baby-prep-v1.png',alt:'孕期计划、日常账本和新生儿用品清单，正在准备孩子的到来'},
  'family-newborn':{src:'./public/assets/events/family-newborn-v1.png',alt:'林夏和主角在产后病房小心托住刚出生的小满'},
  'family-childcare':{src:'./public/assets/events/family-childcare-v1.png',alt:'夜间家中的婴儿床里，小满熟睡，等待父母轮流照护'},
  'family-school':{src:'./public/assets/events/school-panorama-v3.webp',alt:'入学的教室里，书包、笔记本和文具已经准备好'},
  'family-adult':{src:'./public/assets/events/family-adult-v1.webp',alt:'成年主角回家，与中年父母围坐饭桌商量生活安排'},
  'personal-budget':{src:'./public/assets/events/personal-budget-v1.webp',alt:'两杯茶、生活账本和计算器摆在桌上，正在商量日常开支'},
  'fund-bond':{src:'./public/assets/events/fund-bond-v1.webp',alt:'桌上并排摆着基金与债券说明，准备比较产品规则'},
  'contract-intro':{src:'./public/assets/events/contract-intro-v1.webp',alt:'电脑列出期货与外汇的交易类别，笔记说明多空和保证金，尚未交易'},
  'work-desk':{src:'./public/assets/events/work-desk-v1.webp',alt:'普通工位上的工作表格、工牌和文件夹'},
  'account-frozen':{src:'./public/assets/events/account-frozen-v1.webp',alt:'电脑显示提现暂停，账户资金暂时无法取出'},
  'order-work':{src:'./public/assets/daily/gig-v1.webp',alt:'打包间里核对货物和订单，尚未结算利润'},
  'friends-meal':{src:'./public/assets/daily/meal-v1.webp',alt:'两个成年朋友坐在小餐馆吃饭聊天'},
  'family-call':{src:'./public/assets/daily/phone-day-v1.webp',alt:'坐在椅子上接听家人的电话'},
  'campus-arrival':{src:'./public/assets/daily/campus-arrival-v1.webp',alt:'十八岁的新生拉着行李箱走进大学校园'},
  'housing-learning':{src:'./public/assets/events/personal-budget-v1.webp',alt:'先查资料、计算居住预算，没有签购房合同或支付房款'},

  'investment-profit':{src:'./public/assets/events/investment-profit-v1.webp',alt:'账本旁的电脑显示本次投资已结算盈利，没有用市场涨跌代替账户收益'},
  'investment-loss':{src:'./public/assets/events/investment-loss-v1.webp',alt:'账本旁的电脑显示本次投资结算亏损，正在核对记录'},
  'options-study':{src:'./public/assets/events/options-study-v1.webp',alt:'翻开期权基础教材，对照看涨和看跌示意图做学习笔记，未进行交易'},
  'market-review':{src:'./public/assets/events/market-review-v1.webp',alt:'桌上摆着资料和笔记，电脑合着，正在了解与核对信息'},
  'volatility-news':{src:'./public/assets/events/volatility-news-v1.webp',alt:'电脑上的新闻讲述市场波动突然放大，旁边放着期权笔记'},
  'options-intro':{focalY:20,src:'./public/assets/events/options-intro-v2.webp',alt:'大学宿舍里，两位学生对照到期日和示意图了解期权'},
  'graduation':{focalY:0,src:'./public/assets/events/college-graduation-v1.webp',alt:'二十二岁的大学毕业生戴着学士帽，在校园合影留念'},
  'student-profit':{src:'./public/assets/events/student-profit-v1.webp',alt:'大学生在宿舍确认股票卖出获利，神情轻松'},
  'first-order-profit':{src:'./public/assets/events/first-order-profit-v1.webp',alt:'两个年轻人核对首单回款，桌边摆着交付的包裹'},
  'currency-news':{src:'./public/assets/events/currency-news-v1.webp',alt:'大学生在宿舍阅读国际新闻，核对货币之间的汇率变化'},
  "toddler": {
    "src": "./public/assets/events/toddler-play-panorama-v1.webp",
    "alt": "年幼的孩子在家人陪伴下，拉开毛巾找小布球"
  },
  "preschool": {
    "src": "./public/assets/events/preschool-play-panorama-v1.webp",
    "alt": "幼儿园里，老师陪小朋友搭积木、画画"
  },
  "first-coin": {
    "src": "./public/assets/events/first-coin-panorama-v3.webp",
    "alt": "小手握着硬币，面前是摆满糖果的小卖部"
  },
  "school": {
    "src": "./public/assets/events/school-panorama-v3.webp",
    "alt": "教室窗边的书包、课本和储蓄罐"
  },
  "family": {
    "focalY": 45,
    "src": "./public/assets/events/family-wide-v2.webp",
    "alt": "家人围坐饭桌，商量账本上的开支"
  },
  "market": {
    "src": "./public/assets/events/market-panorama-v3.webp",
    "alt": "投资者看着交易大厅里的行情屏幕"
  },
  "derivatives": {
    "src": "./public/assets/events/derivatives-panorama-v3.webp",
    "alt": "深夜的交易电脑、时钟和笔记"
  },
  "crypto": {
    "src": "./public/assets/events/crypto-panorama-v3.webp",
    "alt": "电脑行情旁放着硬件钱包和笔记本"
  },
  "casino": {
    "src": "./public/assets/events/casino-panorama-v3.webp",
    "alt": "夜里有人拿着手机，屏幕上是虚构赌局"
  },
  "fraud": {
    "focalY": 35,
    "src": "./public/assets/events/fraud-wide-v2.webp",
    "alt": "酒店会议室里，一群人听着投资项目的推介"
  },
  "venture": {
    "src": "./public/assets/events/venture-panorama-v3.webp",
    "alt": "创业团队围坐办公桌，讨论项目"
  },
  "property": {
    "src": "./public/assets/events/property-panorama-v3.webp",
    "alt": "楼盘模型、房屋钥匙和待签的合同"
  },
  "work": {
    "focalY": 28,
    "src": "./public/assets/events/work-wide-v2.webp",
    "alt": "工作台前递来的工牌和围裙"
  },
  "debt": {
    "src": "./public/assets/events/debt-panorama-v3.webp",
    "alt": "餐桌上的账单、计算器和来电手机"
  },
  "relationships": {
    "focalY": 40,
    "src": "./public/assets/events/relationships-wide-v2.webp",
    "alt": "两个人在茶桌旁认真交谈"
  },
  "energy": {
    "src": "./public/assets/events/energy-panorama-v3.webp",
    "alt": "加油站外的车队，远处是货运港口"
  },
  "health": {
    "src": "./public/assets/events/health-panorama-v3.webp",
    "alt": "医院候诊区里陪伴长辈的人"
  },
  "legal": {
    "src": "./public/assets/events/legal-panorama-v3.webp",
    "alt": "公共事务窗口的案卷和空椅子"
  },
  "business": {
    "focalY": 48,
    "src": "./public/assets/life-shop-v2.webp",
    "alt": "夜色中仍开着灯的小店"
  },
  "prison": {
    "src": "./public/assets/events/prison-panorama-v3.webp",
    "alt": "铁窗、床铺和空桌组成的服刑生活场景"
  },
  "birth": {
    "focalY": 50,
    "src": "./public/assets/birth-hospital-v1.webp",
    "alt": "安静的医院产后病房"
  }
};
export const EVENT_ART_ASSIGNMENTS = {
  "FAM01": "family",
  "FAM02": "market",
  "FAM03": "family",
  "FAM04": "property",
  "FAM05": "family",
  "FAM06": "market",
  "FAM07": "family",
  "FAM08": "family",
  "YOU01": "first-coin",
  "YOU02": "market",
  "YOU03": "work",
  "YOU04": "school",
  "YOU05": "school",
  "YOU06": "school",
  "YOU07": "market",
  "YOU08": "school",
  "STK01": "market",
  "STK02": "market",
  "STK03": "market",
  "STK04": "market",
  "STK05": "market",
  "STK06": "market",
  "STK07": "market",
  "STK08": "market",
  "FND01": "market",
  "FND02": "market",
  "FND03": "market",
  "FND04": "market",
  "FND05": "market",
  "FND06": "market",
  "FND07": "market",
  "FND08": "market",
  "OPT01": "derivatives",
  "OPT02": "derivatives",
  "OPT03": "derivatives",
  "OPT04": "derivatives",
  "OPT05": "derivatives",
  "OPT06": "derivatives",
  "OPT07": "derivatives",
  "OPT08": "derivatives",
  "FUT01": "derivatives",
  "FUT02": "derivatives",
  "FUT03": "derivatives",
  "FUT04": "derivatives",
  "FUT05": "derivatives",
  "FUT06": "derivatives",
  "FUT07": "derivatives",
  "FUT08": "derivatives",
  "CRY01": "crypto",
  "CRY02": "crypto",
  "CRY03": "crypto",
  "CRY04": "crypto",
  "CRY05": "crypto",
  "CRY06": "crypto",
  "CRY07": "crypto",
  "CRY08": "crypto",
  "PON01": "fraud",
  "PON02": "fraud",
  "PON03": "fraud",
  "PON04": "fraud",
  "PON05": "fraud",
  "PON06": "fraud",
  "PON07": "fraud",
  "PON08": "fraud",
  "ANG01": "venture",
  "ANG02": "venture",
  "ANG03": "venture",
  "ANG04": "venture",
  "ANG05": "venture",
  "ANG06": "venture",
  "ANG07": "venture",
  "ANG08": "venture",
  "HOU01": "property",
  "HOU02": "property",
  "HOU03": "property",
  "HOU04": "property",
  "HOU05": "property",
  "HOU06": "property",
  "HOU07": "property",
  "HOU08": "property",
  "JOB01": "work",
  "JOB02": "work",
  "JOB03": "work",
  "JOB04": "work",
  "JOB05": "work",
  "JOB06": "work",
  "JOB07": "work",
  "JOB08": "work",
  "BUS01": "business",
  "BUS02": "business",
  "BUS03": "business",
  "BUS04": "business",
  "BUS05": "business",
  "BUS06": "business",
  "BUS07": "business",
  "BUS08": "business",
  "DEB01": "debt",
  "DEB02": "debt",
  "DEB03": "debt",
  "DEB04": "debt",
  "DEB05": "debt",
  "DEB06": "debt",
  "DEB07": "debt",
  "DEB08": "debt",
  "REL01": "relationships",
  "REL02": "relationships",
  "REL03": "family",
  "REL04": "family",
  "REL05": "relationships",
  "REL06": "relationships",
  "REL07": "health",
  "REL08": "family",
  "FAMO01": "venture",
  "FAMO02": "fraud",
  "FAMO03": "venture",
  "FAMO04": "venture",
  "FAMO05": "market",
  "FAMO06": "family",
  "FAMO07": "venture",
  "FAMO08": "market",
  "REC01": "debt",
  "REC02": "work",
  "REC03": "work",
  "REC04": "business",
  "REC05": "casino",
  "REC06": "debt",
  "REC07": "family",
  "REC08": "venture",
  "LATE01": "family",
  "LATE02": "market",
  "LATE03": "family",
  "LATE04": "family",
  "LATE05": "health",
  "LATE06": "family",
  "LATE07": "family",
  "LATE08": "market",
  "ODD01": "crypto",
  "ODD02": "relationships",
  "ODD03": "relationships",
  "ODD04": "fraud",
  "ODD05": "business",
  "ODD06": "business",
  "ODD07": "relationships",
  "ODD08": "relationships",
  "MAIN01": "birth",
  "MAIN02": "first-coin",
  "MAIN03": "family",
  "MAIN04": "family",
  "MAIN05": "work",
  "MAIN06": "venture",
  "MAIN07": "family",
  "MAIN08": "work",
  "MAIN09": "venture",
  "MAIN10": "family",
  "MAIN11": "family",
  "MAIN12": "family",
  "HST01": "energy",
  "HST02": "market",
  "HST03": "market",
  "HST04": "market",
  "HST05": "debt",
  "HST06": "market",
  "HST07": "energy",
  "HST08": "market",
  "HST09": "legal",
  "HST10": "derivatives",
  "HST11": "energy",
  "HST12": "debt",
  "HST13": "derivatives",
  "HST14": "market",
  "HST15": "market",
  "HST16": "derivatives",
  "HST17": "health",
  "HST18": "energy",
  "HST19": "market",
  "HST20": "energy",
  "HST21": "crypto",
  "HST22": "debt",
  "HST23": "crypto",
  "HST24": "debt",
  "UG01": "casino",
  "UG02": "casino",
  "UG03": "casino",
  "UG04": "legal",
  "UG05": "fraud",
  "UG06": "fraud",
  "UG07": "legal",
  "UG08": "fraud",
  "UG09": "legal",
  "UG10": "fraud",
  "UG11": "casino",
  "UG12": "casino",
  "LAW01": "legal",
  "LAW02": "legal",
  "LAW03": "legal",
  "LAW04": "legal",
  "JAIL01": "prison",
  "JAIL02": "prison",
  "JAIL03": "prison",
  "JAIL04": "prison",
  "RE01": "work",
  "RE02": "work",
  "RE03": "casino",
  "RE04": "family",
  "HAO01": "market",
  "HAO02": "venture",
  "HAO03": "relationships",
  "HAO04": "relationships",
  "HAO05": "relationships",
  "XIA01": "family",
  "XIA02": "venture",
  "XIA03": "family",
  "XIA04": "venture",
  "XIA05": "relationships",
  "ZHOU01": "work",
  "ZHOU02": "relationships",
  "ZHOU03": "relationships",
  "ZHOU04": "work",
  "ZHOU05": "business",
  "behavior:tilt": "casino",
  "behavior:hot_hand": "casino",
  "behavior:drawdown": "derivatives",
  "behavior:family_call": "family",
  "behavior:family_exposed": "debt",
  "behavior:group_invite": "crypto",
  "behavior:group_tip": "fraud",
  "behavior:platform_invite": "fraud",
  "behavior:platform_withdraw": "debt",
  "behavior:night_watch": "derivatives",
  "behavior:work_warning": "work",
  "behavior:relapse": "casino",
  "behavior:rebuild": "work",
  "life:comfort": "property",
  "life:pressure": "debt",
  "life:request": "relationships",
  "life:promise_due": "relationships",
  "life:disclosure": "family",
  "life:response": "relationships"
};
export function eventArt(id,state,event={id},explicitKey){
 const schoolKey=id?.startsWith('STU_')&&explicitKey?.startsWith('student-')?explicitKey:event.studentStory?`student-${event.studentStory.art}`:state?.studentStories?.history?.find(h=>h.eventId===id)?.art?`student-${state.studentStories.history.find(h=>h.eventId===id).art}`:null;
 if(schoolKey&&EVENT_ART_ASSETS[schoolKey])return {...EVENT_ART_ASSETS[schoolKey],key:schoolKey};
 let key=EVENT_ART_ASSIGNMENTS[id];
 if(!key&&/^AGE0[12]/.test(id))key='toddler';
 if(!key&&/^AGE0[3-5]/.test(id))key='preschool';
 if(!key&&/^AGE(?:0[6-9]|1[0-6])/.test(id))key='school';
 if(!key&&/^AGE18/.test(id))key='crypto';
 if(!key&&/^AGE20/.test(id))key='casino';
 if(!key&&/^AGE24/.test(id))key='fraud';
 key=ageSafeArtKey(state,explicitKey||storyArtKey(state,event,key),id);
 const workplace=['work','work-desk'].includes(key)&&careerArt(state);if(workplace)return {...workplace,key};
 if(state&&isCollegeStudent(state)){
  const kind={family:'call','family-adult':'call','account-frozen':'frozen',crypto:'market-night',casino:'gambling','family-call':'call','student-profit':'profit','investment-profit':'profit','investment-loss':'loss','housing-learning':'study-day','market-review':'study-day','options-study':'study-day','options-intro':'study-day','fund-bond':'study-day','contract-intro':'market-day','derivatives':'market-night','volatility-news':'market-day','currency-news':'market-day','personal-budget':'study-day'}[key];
  const dorm=kind&&dormArt(state,kind,id);if(dorm)return {...dorm,key};
 }
 return {...(EVENT_ART_ASSETS[key]||EVENT_ART_ASSETS['market-review']),key:key||'market-review'};
}
export function renderEventArt(id,{esc,state,event},artKey){
 const art=eventArt(id,state,event||{id},artKey);
 return `<figure class="event-illustration" data-event-art="${esc(id)}" data-art-key="${esc(art.key)}"${art.location?` data-art-location="${art.location}"`:''}><img src="${art.src}" alt="${esc(art.alt)}" width="1774" height="887" style="object-position:50% ${art.focalY??50}%" decoding="async"></figure>`;
}
export function renderEventIntro(event,ctx){const {esc}=ctx,withArt=event.id&&!ctx.compact;return `<div class="event-intro ${withArt?'has-event-art':''}">${withArt?renderEventArt(event.id,{...ctx,event},event.artKey):''}<div class="event-copy"><h2>${esc(event.title)}</h2><p class="story-text">${esc(event.prompt)}</p></div></div>`;}

export function resultArtKey(s,r){
 if(r.artKey?.startsWith('student-'))return r.artKey;
 if(r.eventId?.startsWith('ENC_'))return storyArtKey(s,{id:r.eventId});
 if(r.eventId==='MAIN05'&&s.education?.college)return 'graduation';
 if(r.eventId==='REC07')return 'personal-budget';
 const c=r.context;
 if(c?.activity==='investment'){
  if(c.settlement==='frozen')return 'account-frozen';
  if(c.settlement==='valuation')return c.profile==='housing'?'property':'venture';
  if(!Number.isFinite(c.pnl)||c.pnl===0)return 'market-review';
  if(c.pnl<0)return 'investment-loss';
  if(r.eventId==='HAO01'&&s.age<35)return 'first-order-profit';
  if(isCollegeStudent(s)&&['stock','allin','fund'].includes(c.profile))return 'student-profit';
  return 'investment-profit';
 }
 if(c?.activity==='study')return /^(OPT|HST16)/.test(r.eventId||'')?'options-study':'market-review';
 if(c?.activity==='observe'&&c.marketRelated)return r.eventId==='HST16'?'volatility-news':'market-review';
 if(c?.profile==='family')return 'personal-budget';
 if(['job','work'].includes(c?.profile))return 'work-desk';
 if(r.eventId==='HAO01')return 'order-work';
 if(r.eventId==='HST15'&&isCollegeStudent(s))return 'currency-news';
 if(r.eventId==='OPT06'&&isCollegeStudent(s))return 'options-intro';
 if(r.eventId==='HST16')return 'volatility-news';
 return undefined;
}
