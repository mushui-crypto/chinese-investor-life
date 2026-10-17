"""Authored underworld, legal consequences and re-entry extension.
All amounts, sentences and outcome weights are fictional game parameters.
No real-world criminal instructions, services, contacts or evasion mechanics.
"""
from copy import deepcopy

VERSION = '1.1.0'
EXTENSION_EVENT_IDS = [f'UG{i:02}' for i in range(1, 13)] + [f'LAW{i:02}' for i in range(1, 5)] + [f'JAIL{i:02}' for i in range(1, 5)] + [f'RE{i:02}' for i in range(1, 5)]
LEGAL_CASE_TYPES = ['gambling', 'gambling_promotion', 'account_rental', 'fraud', 'data_resale', 'illegal_fundraising', 'misleading_ads']
LEGAL_SOURCES = [
    {'url': 'https://www.court.gov.cn/zixun/xiangqing/472121.html', 'title': '关于办理帮助信息网络犯罪活动等刑事案件有关问题的意见', 'use': '区分主观明知、具体帮助行为与情节；不因受骗或账户异常一概归罪。'},
    {'url': 'https://www.spp.gov.cn/spp/nbgz/201802/t20180201_363851.shtml', 'title': '关于办理网络赌博犯罪案件适用法律若干问题的意见', 'use': '保留原始规范参考地址；2026-09-22 直接访问返回 403，未据此复述正文。'},
    {'url': 'https://www.spp.gov.cn/spp/llyj/201806/t20180630_383369.shtml', 'title': '线上赌球：法律风险有多大？', 'use': '最高检转载检察日报的历史法律讨论，官方搜索缓存可核读；仅参考参与、组织与经营的责任区分，不采用文中的历史处罚数额。'},
]

def expand_events(events, profiles):
    def stat(**values): return {'op': 'stat', 'delta': values}
    def flag(key, value=True): return {'op': 'flag', 'key': key, 'value': value}
    def outcome(weight, effects): return {'weight': weight, 'effects': effects}
    def profile(name, effects, minimum=0, weight=100, other=None, requires=None):
        profiles[name] = {'min_cash_yuan': minimum, 'prerequisites': requires or [], 'outcomes': [outcome(weight, effects)] + ([outcome(100-weight, other)] if other else [])}
    def case(kind, profit): return {'op': 'legal_case', 'case_type': kind, 'profit_yuan': profit}
    profile('uw_gamble', [{'op':'spend','amount_yuan':1000},case('gambling',5000),stat(stress=12)],1000,18,[{'op':'spend','amount_yuan':1000},case('gambling',0),stat(stress=18)])
    profile('uw_chase', [{'op':'spend','amount_yuan':3000},case('gambling',8000),stat(stress=18)],3000,12,[{'op':'spend','amount_yuan':3000},case('gambling',0),stat(stress=24)])
    profile('uw_promote', [case('gambling_promotion',80000),flag('recruited'),stat(fame=12,trust=-12,stress=12)],requires=['adult'])
    profile('uw_account', [case('account_rental',15000),stat(credit=-12,stress=10)],requires=['adult'])
    profile('uw_fraud', [case('fraud',180000),stat(fame=20,trust=-20,stress=15)],requires=['adult'])
    profile('uw_data', [case('data_resale',35000),stat(trust=-12,stress=12)],requires=['adult'])
    profile('uw_fund', [case('illegal_fundraising',300000),flag('recruited'),stat(fame=25,trust=-20,stress=18)],requires=['adult'])
    profile('uw_ads', [case('misleading_ads',20000),stat(fame=8,trust=-8,stress=6)],requires=['adult'])
    profile('uw_quit', [{'op':'quit_gambling'},stat(stress=-8,insight=3)])
    profile('legal_cooperate', [{'op':'legal_cooperate'},stat(insight=3,stress=-3)])
    profile('prison_study', [stat(skill=4,insight=3,stress=2)])
    profile('prison_reflect', [stat(insight=4,stress=-4)])
    profile('prison_letter', [stat(trust=4,stress=-3)])
    profile('uw_victim', [{'op':'freeze_investment','stake_fraction':.15,'claim_mark_bps':1000},flag('fraud_victim'),stat(stress=15)],3000)

    def add(eid, category, title, prompt, choices, required=(), excluded=(), scope='outside', priority=45):
        cs=[]
        for ci,(label,pname,texts) in enumerate(choices,1):
            p=profiles[pname]
            if isinstance(texts,str): texts=[texts]
            assert len(texts)==len(p['outcomes']), (eid,pname)
            cs.append({'id':f'{eid}_{ci}','label':label,'profile':pname,'requirements':{'min_cash_yuan':p['min_cash_yuan'],'all':list(p['prerequisites'])},'outcomes':[{'id':f'{eid}_{ci}_{oi}','weight':o['weight'],'text':text,'effects':deepcopy(o['effects']),'schedule':[]} for oi,(o,text) in enumerate(zip(p['outcomes'],texts),1)]})
        events.append({'id':eid,'category':category,'kind':'personal','title':title,'age_min':18,'age_max':80,'required_flags':list(required),'excluded_flags':list(excluded),'weight':12 if eid.startswith('UG') else 8,'priority':priority,'cooldown_turns':0,'max_occurrences':1,'scene_scope':scope,'prompt':prompt,'choices':cs})

    add('UG01','灰黑产与网赌','手机里那一把','阿豪转来一张夸张的余额图：“行情太慢，这个今晚见结果。”页面没有公司介绍，只有倒计时。你知道这是网络赌博，拇指还是悬在了屏幕上。',[
        ('明知是网赌，拿一千元试一把','uw_gamble',['五千元真的到账了。你把晚饭加成双人套餐，第二份给自己的天才。违法参与记录也从这一刻开始，到账不等于没有后账。','一千元消失，页面却弹出“差一点”。你盯着那三个字，像盯着一个还愿意收留你的借口。']),
        ('关掉页面，找件正经活','hustle',['你搬完最后一箱货，工钱没有动画，但确实能付房租。','活不多，钱也少。你把手机揣好，今天至少没有再往洞里加土。']),
        ('告诉朋友别再发，退出这场诱惑','uw_quit','你发出去的不是豪言，只是一句“别再给我这个”。夜里没有暴富，闹钟却还在自己的时间上。')])
    add('UG02','灰黑产与网赌','只差最后一次翻本','你在纸上写了“回本就走”。欠款下面又画了一条线，仿佛画得够直，前面的数字就能倒着回来。',[
        ('明知是网赌，再拿三千元追损','uw_chase',['这一把赢了，你把“最后一次”改成了“状态正好”。账面回款变多，参与记录也多了一页。','三千元也没了。你把计算器按到发热，最后算出的答案是：原来归零下面还有借款。']),
        ('向家人承认亏损，停止赌博','uw_quit','家人没有当场替你还钱，但你终于不用同时编造收益和晚归的理由。已经发生的责任仍会继续处理。'),
        ('先接一单零工','hustle',['你赚回一笔实在的钱，数额不够拍传奇短片，够今晚不靠谎话睡觉。','客户挑了几处返工。你骂了一句，还是回去把活补完了。'])],required=['gambling_history'])
    add('UG03','灰黑产与网赌','从赌客到分成名单','对方说你不必再押钱，拉熟人参与就能拿分成。你已经知道项目是网赌，对方还明确要你参与组织和经营利润分配。',[
        ('明知违法，组织熟人参与网赌并分成','uw_promote','八万元到账，你把群名改得像一家公司。后来案卷里写的不是“公司”，是你参与过的每一次组织与获利。'),
        ('拒绝分成，劝熟人一起停下','uw_quit','你没收这笔钱，也不再把别人的亏损当成自己的出路。过去参与的记录不会被这次拒绝抹掉。'),
        ('去了解一份正规工作的要求','self_study','岗位要求写得很长，至少每一项都比“把朋友叫来”更像一门本事。')],required=['gambling_history'])
    add('UG04','灰黑产与网赌','一天租金顶半月工资','一个熟人开出高价，要借用你的账户。他已经说清要拿去帮助违法资金活动，你也看过相关风险提醒。这不是不知情的普通借用。',[
        ('明知用于犯罪，仍出租账户收钱','uw_account','一万五到手时，你觉得自己什么都没做。后来需要解释的，恰恰就是你明知之后仍做的那个决定。'),
        ('拒绝，保管好自己的账户','observe','对方嘀咕你胆子小。你把手机放回口袋，口袋里没有佣金，也没有替别人签下的新麻烦。'),
        ('去接普通零工','hustle',['你忙了一整天才赚到钱，身体很累，账却不用躲着看。','当天没赚多少，师傅让你明早再来。门没有豪华招牌，至少真开着。'])])
    add('UG05','灰黑产与网赌','宣传稿里那个稳赚','商家请你为一款普通产品写推广，要求把限制和风险删掉，明说可以夸大效果。合同的钱很香，你也知道文案会误导消费者。',[
        ('明知夸大效果，仍发布误导营销','uw_ads','两万元结清，后台的赞很快变成退款留言。违法营销记录等待处理，流量不会替你承担罚款与信用损失。'),
        ('改成真实介绍，接受少赚一点','work',['你删掉了那句“稳赚”，留住了一位愿意长期合作的客户。','对方撤掉合作。你把真实版本留作作品，收入有限，至少不用每天解释那句大话。']),
        ('不接这单，先核对要求','observe','你问对方能否证明宣传内容，对方忽然说今天会议很多。')])
    add('UG06','灰黑产与网赌','没有产品的庆功宴','包间里先开香槟，再谈项目。你看完资料，确认所谓产品和收益承诺都是捏造的，对方邀请你作为核心成员参与骗取投资。',[
        ('明知是欺诈，仍参与项目获利','uw_fraud','十八万元打进账户，你在庆功宴上站到了中间。后来受害者翻到合影，终于知道该把哪张脸和哪笔损失放在一起。'),
        ('拒绝，并保留自己已掌握的材料','observe','你离开时，服务员问要不要打包。你说不用，今晚已经看过太多精致包装。'),
        ('去做一个真有客户的小计划','self_study','你先写下客户的问题，而不是给自己写一个身价。那张纸没有融资额，却终于有内容。')])
    add('UG07','灰黑产与网赌','那份不该有价格的名单','对方拿出一份未经授权的个人信息，报价比你的工资更响。你清楚这些是别人的隐私，也知道交易没有取得合法授权。',[
        ('明知未经授权，仍参与倒卖个人信息','uw_data','三万五到账。你只看见一串报价，后来有人拿着受骚扰的记录问你：这是不是我的生活？'),
        ('拒绝交易，不接收传播名单','observe','对方说资源不用也是浪费。你第一次觉得“不用”这两个字，可能比一份资源更值钱。'),
        ('学习正规数据与业务技能','self_study','你开始学怎样让工作更有价值，而不是把陌生人的生活拆成价目表。')])
    add('UG08','灰黑产与网赌','台上终于轮到你讲','有人让你站到路演台上。你已知道项目没有相应资质，仍要用不实承诺向不特定公众募集资金，并从中获利。台下坐着几位认识你的邻居。',[
        ('明知违法，仍参与组织非法集资','uw_fund','三十万元分到你名下，你买了最亮的一套西装。再见那几位邻居时，你才发现衣服只能挡风，挡不住具体的损失。'),
        ('拒绝站台，说清自己发现的问题','observe','主持人立刻换了一个人。你没有因此变成英雄，只是不愿把熟悉的脸算进自己的收入。'),
        ('回去做一份正常工作','work',['工钱按约到账。你低头看了两遍，第一次觉得“按约”比那个大数字更难得。','这份活赚得不多，你没把它包装成改变命运的入口。'])])
    add('UG09','灰黑产与网赌','受害者不是同伙','你买的项目突然停付。你只是基于虚假介绍投入个人积蓄，没有参与组织、拉人、倒卖资料或明知提供犯罪帮助。',[
        ('整理受骗经过，保留追偿记录','observe','你把转账和承诺列清楚。你是这次受骗经历里的受害者，游戏不会因为你亏钱就替你写下一项罪名。'),
        ('向亲友说清损失','family','你没有被要求立刻振作。有人先倒了杯水，等你把经过讲完。'),
        ('先用零工接上生活','hustle',['你做完了一个小活。追偿还没结果，今天终于先有了一笔新的合法收入。','工钱少，返工多。你知道这很难，但不需要为受骗再背上一份虚构的罪名。'])],required=['fraud_victim'])
    add('UG10','灰黑产与网赌','包装得像下一只独角兽','一份精美路演材料声称项目有稳定客户，创始人回答问题时信誓旦旦。你此时没有证据知道它是诈骗，也没有参与运营。',[
        ('轻信宣传，以个人资金参与','uw_victim','客户名单是假的，回款通知也没来。本次新投入进入追偿，你被记录为受害者，不会仅因受骗投资而成为犯罪人。'),
        ('先查清真实客户和公开资料','self_study','对方绕过了几个具体问题。你没有先给自己封投资人，只把没有查清的地方圈了起来。'),
        ('不参加，留住生活预算','observe','他们祝你下次抓住机会。你说谢谢，钱还安静地留在自己的安排里。')])
    add('UG11','灰黑产与网赌','赚过一次，就觉得自己特殊','那笔灰色收入花得很快。熟人又来邀约，这一次连解释都懒得换：“上次不是没事吗？”你已经知道他在说什么。',[
        ('明知违法，再参与组织网赌获利','uw_promote','新钱到了，旧案没有消失。你把“还没轮到我”错认成了“不会轮到我”，直到那些日期被排在同一张纸上。'),
        ('停止参与，不再增加新责任','uw_quit','这次拒绝不会清空过去，但至少从今天开始，案卷后面不必再多一项新的选择。'),
        ('配合已有调查，说明真实情况','legal_cooperate','你不再把说真话理解成一种输赢。配合会被记录，已经发生的事实也仍然在。')],required=['under_investigation'])
    add('UG12','灰黑产与网赌','把“最后一把”划掉','你翻出那张写着回本就走的纸。后面已经挤不下新的日期，有人问你这次准备怎么过，而不是准备赢多少。',[
        ('明确停止网赌，寻求持续支持','uw_quit','你划掉的是下一次下注，不是欠款。睡前你给愿意帮你的人报了平安，明天的计划终于不靠赔率。'),
        ('把精力放回谋生技能','self_study','课程很普通，进度很慢，做完一道题却不用再押另一道题的钱。'),
        ('和家人约定可兑现的生活边界','repair',['你们把收入、开支和求助方式写下来，没有写“相信我下一把”。','对方还不愿相信，你没有再用一次暴富作保证。'])],required=['gambling_history'])

    add('LAW01','调查与法律后果','这次来电没有推销','与案件有关的调查已经开始。对方念出你的名字和几笔具体事实，你才发现曾经觉得不起眼的选择，都有发生的日期。',[
        ('如实配合已有调查','legal_cooperate','你把情况说清楚。配合不是一键免罪，程序也不会因为你愿意承认就忽略受害人的损失。'),
        ('先冷静，把通知内容看明白','observe','你终于从“他们会不会查”转向“已经发生了什么”。案件会按既定阶段继续，不由关闭窗口决定。'),
        ('告诉家人，不再编出差理由','family','家人听完沉默了很久。你第一次觉得沉默比账户跳红更难承受，但这通电话没有挂断。')],required=['under_investigation'],scope='legal',priority=110)
    add('LAW02','调查与法律后果','从某总到被告人','虚构案件已完成裁定。违法所得、罚金、退赔和刑期分别记入记录，没人因为你还叫自己“创业者”就把它们合并成一次普通亏损。',[
        ('认真读完裁定，面对责任','prison_reflect','那张纸没有一根 K 线，却把未来一段时间画得很清楚。你知道要付出的不止是账户里的钱。'),
        ('写一封不找借口的信','prison_letter','你写了三次开头，最后只留下“这次是我明知之后做的选择”。信不会让责任消失，至少不再要求别人替你解释。'),
        ('开始安排能够参加的学习','prison_study','以前你想用捷径跳过时间，现在只能一页一页把时间过完。')],required=['ever_convicted'],scope='legal',priority=120)
    add('LAW03','调查与法律后果','退赔表不是行情表','需要退赔和缴纳的数额已经记账。余额不够的部分仍然是责任，不会因为获刑、出狱或删掉交易软件而消失。',[
        ('把余额与还款安排看清楚','observe','你把不能当天付清的金额留下，没有把它改成零。下一段日子的收入，也要面对这张表。'),
        ('依法配合后续处理','legal_cooperate','你提出的说明被记下，责任仍按现有记录处理。这不是向一个按钮申请无条件免债。'),
        ('向家人说明，停止隐瞒','family','你没有索要一个兜底承诺，只把真实数字念完。对方终于知道接下来要面对什么。')],required=['legal_debt'],scope='legal',priority=110)
    add('LAW04','调查与法律后果','不是一场普通的输赢','这次个人网赌参与或本版误导营销行为已作行政处理，相关没收与罚款进入账本。本条剧情没有组织经营、诈骗帮助等刑事事实，不会直接把你送进监狱。',[
        ('停止再次参与，记住这份处理','uw_quit','你把处理记录留下。没有入狱不等于没有代价，也不意味着下一种更严重的行为会得到同样处理。'),
        ('看清责任和余额','observe','你终于不再把全部支出都写成“运气不好”。有些数字来自行情，有些来自自己的决定。'),
        ('和家人把下一步说清楚','family','这顿饭很安静。你没有承诺多久能赚回来，只说以后账会摊开。')],scope='legal',priority=110)

    add('JAIL01','服刑生活','墙上的日期不会涨停','铁窗外的天色照常变化。今天没有行情提醒，只有一张按部就班的安排表。你第一次不能用“忙项目”解释所有缺席。',[
        ('参加学习，补一门本事','prison_study','笔划过纸的声音很轻，你还是把今天该做的部分做完了。'),
        ('反思已经发生的伤害','prison_reflect','你不再只数自己失去了多少，也开始承认别人被你拿走了什么。'),
        ('写信问问家里的近况','prison_letter','信里没有借款请求。你问饭吃得好不好，天气冷了有没有添衣服。')],required=['in_prison'],scope='prison',priority=100)
    add('JAIL02','服刑生活','探视那天，椅子很硬','来探视的人坐下以后，先问你吃得怎么样。你准备好的传奇、辩解和计划，忽然都显得太长。',[
        ('说一句具体的对不起','prison_letter','对方没有承诺原谅，只说听到了。你知道下一次守约，比这次说得动听更重要。'),
        ('听完对方这些年的生活','prison_reflect','世界没有为你暂停。有人换了工作，有人开始独自承担你留下的日常。'),
        ('继续把学习计划完成','prison_study','你把可以做到的事情写进明天，没有再写一个惊天目标。')],required=['in_prison'],scope='prison',priority=100)
    add('JAIL03','服刑生活','曾经的群聊已经散了','消息传来：当年热闹的群已经解散。那些叫你总的人没有寄来信，倒是一位旧同事托人问你缺不缺书。',[
        ('写信感谢还愿意联系的人','prison_letter','你把对方的名字认真写了一遍。这次没有顺便推荐任何机会。'),
        ('把过去的选择逐件想清楚','prison_reflect','你发现很多次“没办法”，其实都站在一个可以拒绝的路口。'),
        ('读完借来的书','prison_study','页角有旧同事留下的折痕。你跟着读下去，今天没有翻到结尾也没关系。')],required=['in_prison'],scope='prison',priority=100)
    add('JAIL04','服刑生活','先把今天过完','离刑期结束还有一段时间。你已经学会把一天拆成能完成的小事，外面的债务与关系不会自动恢复，仍需要以后一点点处理。',[
        ('继续按安排学习','prison_study','你没有获得神秘赚钱秘诀，只多了一点将来能用上的本事。'),
        ('给出狱后的自己写一页计划','prison_reflect','计划先写住处、工作和责任，再写愿望。顺序终于和以前不同。'),
        ('维护一次诚实的联系','prison_letter','你问对方愿不愿意继续通信，也接受了对方需要时间的回答。')],required=['in_prison'],scope='prison',priority=100)

    add('RE01','出狱与重新开始','门开了，账还在','刑期结束，你重新走到街上。风很大，手机里没有等待你的暴富项目。能转动的第一把钥匙，也许是一份普通工作。',[
        ('接受一份正规岗位的机会','job',['工牌又挂到胸前。收入并不耀眼，但这一次它会照着真实劳动的日期到账。','这轮申请没有通过。你仍能找工作、做零工，失败不会把门重新关上。']),
        ('先做零工，解决今天','hustle',['第一笔合法工钱到手时，你没有截图，只买了需要的东西。','钱少，活累。你还是收好工具，约了下一次。']),
        ('先联系愿意支持自己的人','family','对方说先来吃饭。没有承诺替你付清所有责任，却给你留了一个能坐下说话的位置。')],required=['ever_released'],scope='release',priority=120)
    add('RE02','出狱与重新开始','简历里那段空白','面试官问起履历中断的几年。你没有试图编一段出海创业，也没有把自己永久写成一个标签。',[
        ('如实说明，争取正常岗位','job',['对方说先从具体工作开始。你终于又有了一张写着自己名字的排班表。','对方暂时没有合适岗位。你可以继续尝试，不需要把拒绝理解成另一条灰路的许可证。']),
        ('先接能够完成的零工','hustle',['客户验收后结了款，没有问你当年最风光时赚过多少。','这一单返工了两次，你还是把钱靠实际交付拿到了。']),
        ('把欠缺的技能补起来','self_study','你没有一步走回高处，至少让下一份简历多了一项可以核对的东西。')],required=['ever_released'])
    add('RE03','出狱与重新开始','那条邀请又来了','一个久未联系的号码说：“换个名字，还能东山再起。”你看着屏幕，知道他指的是重新组织网赌，不是重新找一份生活。',[
        ('拒绝，再次明确停止网赌','uw_quit','你删掉的是一条新的邀请，不是过去的记录。当天晚上，你按时睡了。'),
        ('明知违法，再参与组织网赌分成','uw_promote','八万元又来了，新的案号也从这一刻开始。你再次把“重来”走成了“重犯”。'),
        ('把时间用在普通工作上','work',['你完成了一件具体的事，收入不再需要一个虚假的名字。','工作没有神话，只有要求和回款。今天你选择把要求做完。'])],required=['ever_released'])
    add('RE04','出狱与重新开始','晚饭没有庆功词','一顿普通晚饭摆在桌上。退赔还有多少、下周上什么班、谁来照看家里，每个问题都比“什么时候再翻十倍”更具体。',[
        ('履行一件已经说好的事','repair',['你按约完成了它。信任没有暴涨，却开始有了一个愿意再约下次的理由。','对方仍然保持距离。你接受了这件事，没有要求一句道歉兑换全部过去。']),
        ('列清支出与未偿责任','observe','你没有把责任清零，也没有把自己写死在那张表里。'),
        ('休息一下，准备明天的工作','rest','这晚没有庆功，也没有翻盘。你把闹钟设好，终于能为一个普通的明天做准备。')],required=['ever_released'])

    index={e['id']:e for e in events}
    def edge(eid, choice, outcome_index, target, delay, expiry, reason):
        index[eid]['choices'][choice-1]['outcomes'][outcome_index-1]['schedule'].append({'event_id':target,'after_turns':delay,'expires_after_turns':expiry,'reason':reason,'on_ineligible':'wait_until_expiry_then_log_unresolved'})
    for oi in (1,2): edge('UG01',1,oi,'UG02',1,6,'第一把以后，“回本”或“再赢一点”开始改变判断。')
    for oi in (1,2): edge('UG02',1,oi,'UG03',1,6,'追损之后，参与组织和分成的邀约出现。')
    edge('UG10',1,1,'UG09',1,8,'项目停付后，你开始整理自己作为受害者的经历。')
    edge('UG12',1,1,'RE04',3,12,'重新建立生活边界，也需要等待适合的关系时机。')
    edge('RE01',1,1,'RE02',2,8,'重新上班以后，履历和后续职业机会仍需面对。')
    edge('RE01',2,1,'RE02',1,8,'第一笔零工之后，继续争取稳定工作。')
    edge('RE02',1,1,'RE04',2,10,'重新就业之后，关系修复继续落在日常里。')
    assert [e['id'] for e in events[-24:]]==EXTENSION_EVENT_IDS


def expand_endings(endings):
    def flag(key, value=True): return {'flag':key,'is':value}
    def metric(key, op, value): return {'metric':key,'op':op,'value':value}
    rows=[
        ('E25','铁窗里的收盘钟',130,[flag('in_prison')],'外面的市场照常开盘，你的时间有了另一张表。案卷里没有“运气不好”这一栏；还没走完的刑期、需要承担的责任，都留在这段人生里。',['继续面对责任','等待刑期结束','把这段选择记住']),
        ('E26','退赔表还有下一行',115,[flag('legal_debt'),metric('debt_yuan','gt',0)],'曾经到账的钱被你叫作机会，现在需要退赔的数字有了具体的人。那张表不会因为你重新开始就消失，你仍能靠下一份真实收入继续偿还。',['继续履行退赔','寻找正规工作','不再增加新的伤害']),
        ('E27','出狱以后，第一张工牌',100,[flag('ever_released'),flag('reentry_employed'),flag('in_prison',False)],'工牌很普通，你却认真把它挂正。过去没有被洗白，明天也没有被判完。你拿起工具，开始做这一班真正需要完成的工作。',['守住正常工作','继续履行责任','慢慢修复关系']),
        ('E28','这次真的没有下一把',98,[flag('gambling_history'),flag('gambling_quit'),flag('in_prison',False)],'你不再给“最后一把”添加新的日期。欠下的钱仍要处理，失去的信任仍要慢慢修，但今天晚上你没有再按那个按钮。',['持续寻求支持','安排稳定收入','把生活过回自己的节奏']),
    ]
    for eid,title,priority,rules,text,directions in rows:
        endings.append({'id':eid,'title':title,'priority':priority,'condition':{'all':rules},'epilogue':text,'open_directions':directions,'evaluation':'only_at_player_settlement_or_age_80'})

    endings.append({'id': 'E29', 'title': '最后一碗面，没能续上', 'priority': 1000, 'condition': {'all': [{'flag': 'survival_failed', 'is': True}]}, 'epilogue': '第七天晚上，你又数了一遍口袋里的零钱。屏幕上的行情仍在跳，明天的饭钱和住处却已经接不上。这不是一次账户归零，而是连续七天没能维持基本生活。这一局到此结束；旧债、曾经赚过的钱和没有变现的梦，都留在这本档案里。', 'open_directions': ['保留这段人生作为复盘', '换一个出身重新开始'], 'evaluation': 'immediate_survival_failure'})


def expand_flags(flags):
    flags.update({
        'survival_failed':'连续七次日结未付清基本生活费且缺少可用资金；立即结算 E29。',
        'in_prison':'Core按未服刑期推导；服刑期间仅开放规定内行动。',
        'ever_convicted':'虚构刑事案件完成裁定后永久记录，不由受骗或普通投资亏损生成。',
        'under_investigation':'真实存在待调查/调查中的虚构案件；关闭或裁定后重算。',
        'legal_debt':'仍有未清的罚金、退赔或没收责任债务。',
        'ever_released':'实际服完至少一段刑期并释放后记录。',
        'gambling_history':'玩家明确参与本版网赌场景或相关违法活动。',
        'gambling_quit':'玩家使用停止网赌行动/效果记录；再次参与时移除。',
        'reentry_employed':'实际释放后重新取得正规岗位。',
        'fraud_victim':'UG10不知情个人投资受骗，与明知组织或帮助犯罪分别记录。',
    })
