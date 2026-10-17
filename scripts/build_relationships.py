"""Three authored recurring NPC arcs; deterministic flags, distinct invitations and reunions."""
from copy import deepcopy
RELATIONSHIP_EVENT_IDS = [f'{prefix}{n:02d}' for prefix in ['HAO','XIA','ZHOU'] for n in range(1,6)]

def expand_relationships(events, profiles):
    def make(prefix,n,npc,title,prompt,rows,required=(),age=18):
        eid=f'{prefix}{n:02d}'
        e=dict(id=eid,category='关系与人生',kind='personal',title=title,age_min=age,age_max=79,required_flags=list(required),excluded_flags=[],weight=34 if n==1 else 1,priority=75 if n>1 else 45,cooldown_turns=0,max_occurrences=1,prompt=prompt,character_ids=[npc],choices=[])
        for i,(label,profile,text,change,flags,target) in enumerate(rows,1):
            p=profiles[profile]
            c=dict(id=f'{eid}_{i}',label=label,profile=profile,requirements=dict(min_cash_yuan=p['min_cash_yuan'],all=p['prerequisites']),outcomes=[])
            for j,branch in enumerate(p['outcomes'],1):
                effects=deepcopy(branch['effects'])+[dict(op='relationship',character_id=npc,change=change)]+[dict(op='flag',key=k,value=True) for k in flags]
                # Only invitations create downstream flags; guarded scenes cannot appear ahead of their source.
                if target: effects.append(dict(op='flag',key=f'invited_{target}',value=True))
                result=text if j==1 else text+'事情并没有按最好的方向发展。你们把实际结果重新记了一遍，账上的损失也没有被一句交情抹掉。'
                schedule=[dict(event_id=target,after_turns=3 if n==1 else 6,expires_after_turns=100,reason=f'与{dict(N01="阿豪",N02="林夏",N04="老周")[npc]}的下一次约定',on_ineligible='wait_until_expiry_then_log_unresolved')] if target else []
                c['outcomes'].append(dict(id=f'{eid}_{i}_{j}',weight=branch['weight'],text=result,effects=effects,schedule=schedule))
            e['choices'].append(c)
        events.append(e)
    make('HAO',1,'N01','阿豪的第二把椅子','阿豪租了间只有两把椅子的办公室。他把其中一把转向你：“上市敲钟的时候，咱俩一人敲一下。”桌上的账本，倒是连下个月房租都没填。',[
        ('先写清各自投入，再一起试一单','business','你没有承诺下半辈子，只签下眼前这一单。阿豪嘴上嫌麻烦，还是把两个人的名字写进了账本。',10,['hao_partner'],'HAO02'),
        ('朋友照做，投资先不跟','observe','你把椅子推回桌下，说以后吃饭照旧。阿豪说“行”，隔天还是把公司招牌的照片发给了你。',0,['hao_boundary'],'HAO03'),
        ('免费帮他把现金表算清楚','self_study','算到凌晨，原定的上市酒席先被删掉了。阿豪第一次问你：如果没赚到，我们还有没有话说？',8,['hao_helped'],'HAO03')])
    make('HAO',2,'N01','合伙人群里的红色数字','阿豪把一张漂亮的流水截图置顶，你却在小字里发现退货、欠款和没结清的租金。“咱们都走到这了，再加一把？”他盯着你的回复。',[
        ('继续做，但每笔账都公开','self_study','你们拆开了流水与利润。群里安静了一晚，第二天阿豪把所有欠条拍了照。这次他把你当成会说不的合伙人。',12,['hao_clear'],'HAO04'),
        ('再投一笔，赌他能扳回来','business','你把这一单的有限本金写清，再一次坐上那把椅子。阿豪的豪言还在，账本却开始变厚了。',3,['hao_doubled'],'HAO04'),
        ('停止新投入，保留朋友的号码','observe','你关掉了新增投入，没有把现有店铺或持仓凭空变现。聊天从“老板”变回了名字，接下来还得各自处理手里的账。',-8,['hao_exit'],'HAO05')],['invited_HAO02'])
    make('HAO',3,'N01','这次没发收款码','阿豪发来一句“出来吃面”，后面没有项目书，也没有收款码。他说，终于理解你当年为什么不肯把友情一起押上。',[
        ('赴约，听他把这一段讲完','family','面快坨了，他还在讲。你没补一句“早就说过”，阿豪也没再问你借多少。',12,['hao_clear'],'HAO04'),
        ('问他要不要学一门能谋生的本事','self_study','你们一起看了几份招工说明。阿豪终于把“年入千万”从自我介绍里删掉，先写上自己会做什么。',8,['hao_helped'],'HAO04'),
        ('留个问候，先过自己的日子','observe','你回了一句平安。聊天停在这里，谁也没有替对方的人生签字。',0,['hao_distant'],'HAO05')],['invited_HAO03'])
    make('HAO',4,'N01','又是那两把椅子','阿豪换了新店面，却把旧椅子搬了进来。你们共同经历过的那些选择，让这次重逢少了几句漂亮话。他把账本推到你面前，先说了最难看的数字。',[
        ('一起看账，把朋友留在桌边','family','你们笑起当年一人敲一下钟的计划。今天没有敲钟，至少两个人都敢坐下来。',10,['hao_reconciled'],None),
        ('接一单真实的活，按约定分钱','work','这一次钱来自交付，不来自保证。做完这一单，你们各自回家，账也各自明白。',8,['hao_reconciled'],None),
        ('为他高兴，保持各自的边界','observe','你没有加入下一轮计划。阿豪给你留了张椅子，却不再把友情算成可以追加的本金。',4,['hao_boundary'],None)],['invited_HAO04'])
    make('HAO',5,'N01','通讯录里的旧同学','一个陌生号码发来阿豪的名字：“旧手机坏了，号码留一下。”你还记得那次退出，或是那碗最终没赴约的面。接下来这一句，要不要重新开始？',[
        ('重新聊聊，但不重开共同账户','repair','你先说起自己的日子。过去的问题没有自动解决，但这次没有人用下一个风口当开场白。',10,['hao_reconciled'],None),
        ('只留号码，彼此珍重','observe','你保存了号码。友情不一定要恢复成原样，有时能互道一声平安就够了。',2,['hao_boundary'],None),
        ('今天还没准备好，先休息','rest','你把消息留着，没有勉强自己立刻回应。有些关系也需要等待下一段生活。',0,['hao_distant'],None)],['invited_HAO05'])
    make('XIA',1,'N02','林夏问的是生活费','你兴奋地讲完翻倍计划，林夏只问：“下半年答应生活的那笔钱，你留了吗？”她有自己的工作和项目，今天是来谈边界，不是来替你兜底。',[
        ('把风险和生活安排完整说清','family','你们把能承担与不能承担的事分开写。她没有接管你的账户，只记住了你愿意说实话。',12,['xia_honest'],'XIA02'),
        ('说一切都好，暂时隐去压力','observe','你挑了最好看的部分。林夏没有追问，但没有把这句“都好”当成共同财务承诺。',-10,['xia_hidden'],'XIA03'),
        ('保持普通朋友，各自安排生活','observe','你们说清关系，不借亲密之名要求对方付出。她接受了这个边界，也保留了以后正常往来的可能。',4,['xia_boundary'],'XIA02')])
    make('XIA',2,'N02','她带来了自己的项目','林夏带来的不是你的庆功方案，而是一份她准备许久的作品。因为上次你说清了边界，她愿意邀请你先当一个能认真给意见的人。',[
        ('认真帮她试用，不承诺投资','self_study','你花了时间，给了具体意见。她把你的名字写在感谢里，这段联系有了行情之外的内容。',12,['xia_supported'],'XIA04'),
        ('把话题拉回自己的下一笔机会','network','你讲得很投入，她把项目收回包里。后来你才发现，一起说话和轮流推销，原来差得很远。',-10,['xia_absent'],'XIA05'),
        ('坦白最近没精力，约好以后再聊','rest','你没有假装有空。她把演示发来，允许你在自己的节奏里回应。',3,['xia_boundary'],'XIA04')],['invited_XIA02'])
    make('XIA',3,'N02','没说出口的那一页','林夏发现你一直省略的压力。她没有来替你付钱，只问：既然你说需要相信，为什么只让我看最漂亮的那一页？',[
        ('把账说清，接受她自己的决定','repair','你说出之前没讲的部分，也没有索取立刻的谅解。她愿意再听一次，但今后的信任要靠履约。',10,['xia_honest'],'XIA04'),
        ('仍说下一把一定能解决','observe','林夏停止参与这类讨论。你没有失去账户里的钱，却少了一个愿意认真听的人。',-18,['xia_absent'],'XIA05'),
        ('承认边界，请她先照顾自己','family','你们暂停共同讨论财务，保留普通联系。这个决定不替任何一方清掉旧账，也不强迫对方继续承担。',3,['xia_boundary'],'XIA05')],['invited_XIA03'])
    make('XIA',4,'N02','她终于忙完自己的那场仗','林夏发来项目收尾的照片。她还记得你早些时候认真听过，或者终于愿意把话说清。今天没有账单等你买单，只留了一把吃饭的椅子。',[
        ('去听她讲自己的经历','family','这顿饭第一次没有以你的收益率开场。你们各自有生活，也愿意在其中给对方留一点位置。',12,['xia_reunited'],None),
        ('给她一份力所能及的心意','gift','你付的是当下能承担的礼物，没有拿未来的暴富作保证。她记住的是你真的来了。',10,['xia_reunited'],None),
        ('发去祝福，保留各自的节奏','observe','祝福送到，你继续眼前的日子。友谊或亲密关系都没有被自动替你决定。',4,['xia_boundary'],None)],['invited_XIA04'])
    make('XIA',5,'N02','朋友圈里的一张合影','你在合影里看见林夏。她的人生继续往前，你想起自己之前那次缺席，或那句始终没有兑现的保证。要不要发出这条消息，仍然由你决定。',[
        ('真诚道歉，不要求恢复原样','repair','你没有补上“但是”。她回了一句谢谢，今后的距离由两个人慢慢决定。',8,['xia_reunited'],None),
        ('安静点赞，不再打扰','observe','你承认别人可以过一种与你无关的生活。这个赞不结清过去，也不索取新的回应。',0,['xia_boundary'],None),
        ('把这次缺席记下来','self_study','你给自己留了句话：下次答应之前，先看时间和能力。人情没有一键重置。',0,['xia_reflected'],None)],['invited_XIA05'])
    make('ZHOU',1,'N04','老周留了一个工位','老周听完你的宏图，先给你递了杯水。“要是愿意，先来试一段。工位没景观，但工资按月发。”他没问你账户最高到过多少。',[
        ('认真准备，申请这个岗位','job','老周帮你递了材料，能不能录用仍要看面试。无论结果怎样，你们有了一件具体做过的事。',10,['zhou_tried'],'ZHOU02'),
        ('让他教我一门基础手艺','self_study','第一天练得很慢，老周没有催。你终于能把“我懂趋势”之外的东西写进自己的能力表。',8,['zhou_learned'],'ZHOU02'),
        ('谢谢他，先走自己的路','observe','你没接这个工位。老周把杯子洗了，说哪天累了，吃饭的地方总找得到。',0,['zhou_declined'],'ZHOU03')])
    make('ZHOU',2,'N04','这回换老周来问你','行业调整到了老周身上。因为记得你肯认真做事，他来问你能不能一起接个小项目。没有保证回报，只有一张交付清单。',[
        ('接下真实工作，一项项交付','work','你们改到深夜，报酬按真实完成的活结算。老周说，总算没白带你看那些枯燥表格。',12,['zhou_helped'],'ZHOU04'),
        ('一起研究方案，暂不接活','self_study','你没有把不确定的能力卖出去。两个人把清单拆开，先学会最缺的那一项。',8,['zhou_helped'],'ZHOU04'),
        ('坦白忙不过来，别让他空等','observe','你当天就回了话。老周找了别人，虽然失落，但至少没因为你的承诺错过时间。',0,['zhou_boundary'],'ZHOU05')],['invited_ZHOU02'])
    make('ZHOU',3,'N04','一张没晒过收益的照片','你又看见老周，照片里他拎着工具箱。他还记得你拒绝过那个工位，没有讥讽，只问现在有没有什么能互相帮上的事。',[
        ('从基础重新学起','self_study','你承认有些事情确实不会。老周递来一件工具，开始教第一步，没把旧话再说一遍。',10,['zhou_learned'],'ZHOU04'),
        ('接一份零工，先把今天过好','hustle','这份报酬由实际做成的活决定。你收好钱，发现自己至少不必先编一个传奇。',6,['zhou_tried'],'ZHOU04'),
        ('聊聊近况，仍然各走各的路','family','你们交换了近况，谁也没劝谁证明选择更正确。老周把新号码留给你。',4,['zhou_boundary'],'ZHOU05')],['invited_ZHOU03'])
    make('ZHOU',4,'N04','工位旁边又多了个新人','老周把一个新人领到你面前。曾经那次求职、学艺或并肩接活，让他觉得你可以把一件事讲明白。“这回，你来带第一天。”',[
        ('耐心带他，把本事交下去','self_study','你从最容易出错的地方讲起。很多年前老周说过的那句话，这次从你嘴里说出来了。',12,['zhou_mentor'],None),
        ('一起做完这单，按工作拿报酬','work','你们把清单逐项勾掉。赚到的钱进了账，新人学到的东西留在了身上。',8,['zhou_mentor'],None),
        ('先休息，不把疲惫带给新人','rest','你说明今天的状态，请老周先带一下。留出自己的余地，也是认真对待别人。',3,['zhou_boundary'],None)],['invited_ZHOU04'])
    make('ZHOU',5,'N04','下班路上的那碗面','老周在旧店门口向你招手。他记得你们曾经各忙各的，也没把没有接下的合作算成一笔人情债。“今天总能坐一会儿了吧。”',[
        ('坐下来，好好吃完这碗面','family','你们聊到很普通的小事。账上的高低没有消失，面却终于不必边看手机边吃。',10,['zhou_reunited'],None),
        ('问问他最近在学什么','self_study','老周说自己也还有不会的。你们互留了一份资料，这回没有谁站在讲台上。',6,['zhou_reunited'],None),
        ('说清今天有事，再约时间','observe','你没有随口答应今天一定来。老周点点头，把另一双筷子收了起来。',0,['zhou_boundary'],None)],['invited_ZHOU05'])

    # Life chapters introduce recurring friends reliably; later invitations follow the player's branch.
    for anchor,target in [('MAIN04','HAO01'),('MAIN05','XIA01'),('MAIN06','ZHOU01')]:
        for c in next(e for e in events if e['id']==anchor)['choices']:
            for o in c['outcomes']:
                o['schedule'].append(dict(event_id=target,after_turns=2,expires_after_turns=100,reason='老朋友约你见面',on_ineligible='wait_until_expiry_then_log_unresolved'))
