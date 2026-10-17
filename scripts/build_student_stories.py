"""Authored school stories; rebuild only STU_ records, preserving the rest of the catalog."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
AGES=[6,10,13,16,17]
# title, scene, art, resource, four choices (action labels are deliberately scene-specific)
LINES={
'A':[
('放学后的弹珠局','放学后，同桌阿川在操场画了个圈。玻璃球碰得叮当响，有人提议：剩下的也一起押上，省得一颗颗数。回家吃饭的铃声还没响。','marbles','marbles',['来就来，全部押上！','先押三颗。','我先看看你们怎么玩。','不玩了，回家吃饭。']),
('收藏册就差一个空位','小卖部的零食里夹着随机收藏卡。你的册子只差最后一张，老板晃了晃新箱子：说不定就在这里。旁边同学倒是有一张重复的。','shop','packs',['再买一包。','这次带的零花钱全买了。','找同学换一张。','算了，不集了。']),
('游戏厅里那台“快出了”的机器','阿川拉你看一台推币机：它已经吃了好多币，肯定快出了。玻璃后面的奖品纹丝不动，看起来比你们更有耐心。','arcade','tokens',['吃这么多币了，该出了。','先看别人玩十分钟。','我们一人一半。','游戏币还是拿去正常打游戏。']),
('今晚谁赢，赌什么','课间聊起晚上的比赛，同学提议猜输赢。原本只是争两句，话题却从哪队更强，变成了谁肯掏二十块。','match','cash',['20 就 20。','50，我跟你反着来。','等一下，我先看看最近的比赛。','别赌钱，输了请饮料。']),
('毕业前，再开最后一局？','毕业聚会还没散，阿川把一颗旧玻璃球放在桌上：小东西留了好多年，输赢倒是换过不少说法。有人提议再玩一局，这次由你决定押什么。','graduation','cash',['就押今天带来的 50 元。','20 元，把以前的失利赢回来。','研究清楚再决定。','算了，把玻璃球收起来。'])],
'B':[
('课间第一张战利品','课间，同学把洋画在地上码齐。阿川让你先拍，刚好翻过一张。他把卡推过来，你这才发现：原来赢到手的，可以是别人舍不得的东西。','cards','cards',['把刚赢的卡也押上。','再拍一张就停。','看看哪种卡更容易翻。','把这张收好，先去上课。']),
('三张普通卡换一个念想','同学亮出一张稀有卡，提出用你的三张普通卡来赌一次。直接交换他不肯，赌一把倒说得像送礼。你盯着卡角那道小折痕。','shop','cards',['三张一起押，试一次。','先拿一张试一局。','用重复卡谈个双方肯的交换。','留着自己的卡，没必要凑齐。']),
('牌组研究到最后一张','午休时，你们开始研究卡牌组合。阿川补了一条规矩：输的人留下这张卡。卡面还没变，桌边的笑声先小了一点。','card-club','cards',['用最稀有的那张打一局。','拿普通卡约一场。','先研究卡组，不押卡。','只记比分，打完各自收好。']),
('背包里的装备也有身价','游戏里刷出一件稀有装备，同学说拿它当对战彩头更刺激。屏幕上只是一小块图案，你却记得自己刷了多少个下午。','game-items','items',['拿这件装备打一场。','只押一件普通道具。','查清道具能不能交换。','组队打副本，不押装备。']),
('旧稀有卡又摆在面前','毕业交换会上，一张熟悉的稀有卡摆上桌。持有人开价二十，也愿意换卡；旁边的人却提议，不如一局定归属。','graduation','cash',['花 20 元买下来。','拿 20 元赌一次归属。','用收藏里的重复卡交换。','看看就好，把位置让给别人。'])],
'C':[
('小卖部的幸运奖','放学路过小卖部，店主送你一次抽签机会。你抽到一份大零食，阿川立刻宣布你是今天最幸运的人。奖品还没拆，你已经被安排再试一次。','shop-young','chances',['把奖品换成三次机会。','再用一次游戏机会。','先问一共放了多少张奖签。','拿着奖品回家分着吃。']),
('上次中奖的人又来了','小卖部又摆出抽奖盒。你看了一眼盒口，想起别人讲过的中奖故事；阿川拍拍你的肩，说今天说不定也行。','shop','packs',['把今天带的钱全试了。','买一包看看。','把中奖和没中奖的都记下。','买普通零食，今天吃得到就行。']),
('“我以前运气不错”','游戏厅里有人刚抱走一只奖品。阿川把几枚游戏币递到你面前：你试试？机器灯光一闪一闪，像在替他点头。','arcade','tokens',['今天手气看着不错，多投几个。','只投两枚试试。','看看说明，奖品真能这样拿吗。','游戏币留着玩赛车。']),
('连续猜中的那个下午','同学聊起两场比赛，你随口猜的两个结果居然都中了。有人把二十元往桌上一放：第三场还听你的。前两场可没有人真的付钱。','match','cash',['手气正好，押 50 元。','只押 20 元。','重新看数据，不沿用刚才的把握。','猜中也够开心了，这次不押。']),
('今天顺得有点像预告片','毕业那天，你找到了丢失的笔、赶上最后一班车，还抽中了聚餐免饮料。阿川笑问：前三件都这么顺，最后一局是不是该押大点？','graduation','cash',['把今天的 50 元都押上。','还是只押 20 元。','前三件事和这一局有什么关系？','把好运留在今天，到此为止。'])],
'D':[
('口袋里只剩一半弹珠','放学的小圈赛结束，你原先的二十颗弹珠剩下十颗。阿川准备收书包，对面却说再来一局就有机会拿回去。空了一半的口袋，走路都轻了。','marbles','marbles',['剩下十颗全部押上。','再押三颗，试着赢回一点。','先看清自己刚才怎么输的。','剩下的装好，今天不补了。']),
('抽不中的那一格','连续几包零食拆开，全是重复卡。阿川问你还买吗，你算的却不是下一包多少钱，而是前面已经买了多少。','shop','packs',['今天剩下的额度全买。','再买一包就好。','找人交换重复卡。','收起包装袋，去写作业。']),
('借几枚，赢了就还','游戏币快用完，阿川摊开手，里面还有几枚：借你？他没提利息，却补了一句，下次我想玩的时候你得记得。','arcade','tokens',['借三枚再试，赢了就还。','用自己的最后两枚。','先陪他玩，把规则看明白。','不借了，把剩下的换次普通游戏。']),
('二十块之后的一局','你刚在同学的小额赌约里输了二十元。对方准备去买饮料，有人问要不要再猜一场，一次把刚才的补回来。','match','cash',['再押 50 元，争取一次补回。','只拿 20 元再试。','先把输的记下，不马上下注。','这二十算今天的句号。']),
('赢回来就停，算不算计划','毕业聚会里，有人又说起“最后一次”。阿川问你，是想再玩一局，还是想让以前的结果变成没发生过？','graduation','cash',['50 元，赢回来就停。','20 元，最多只试这一次。','把以前的输赢摊开算清楚。','旧账留在本子里，今天不追。'])],
'E':[
('猜单双，连中两次','阿川把弹珠藏在手心，你连续猜中了两次单双。他换只手，问你第三次。你已经觉得自己看懂了他的表情。','marbles','marbles',['押十颗，表情已经出卖他了。','押三颗，验证一下。','让他换个人藏，再看看。','先不押，猜着玩就行。']),
('小本子上的中奖规律','你把小卖部几天的抽奖结果记在本上，圈出一个像规律的地方。阿川提醒，有天你没来；你看着空白，觉得也许不影响。','shop','packs',['照规律，把今天的额度投进去。','用一包试试规律。','把漏掉的没中奖记录也补上。','先留着记录，今天不买。']),
('推币机前的十分钟','你看了十分钟机器，发现每隔一阵总有币靠近边缘。阿川问你是不是找到诀窍。玻璃上你的倒影，看起来非常像一个专家。','arcade','tokens',['按这个节奏，多投几枚。','只投两枚验证。','换台机器再观察，别急着下结论。','规律先记着，去打普通游戏。']),
('比赛预测有了自己的表格','你把近期比赛列成表，几条数据看起来格外漂亮。阿川指出其中一场没算进去，因为当时你猜错了。表格突然没有刚才那么整齐。','statistics','cash',['照自己的方法押 50 元。','押 20 元做一次检验。','把猜错的也算进去，先做纸上预测。','留着记录，今天不赌钱。']),
('几乎稳赢的那张表','毕业聚会，你拿出自己的预测记录。几个人看得直点头，阿川问：如果这次偏偏是没算到的那一种呢？桌上的五十元还没有离开你的手。','graduation','cash',['50 元全部押上。','正常押 20 元。','拿 5 元小注验证。','放下钱，继续做纸上记录。'])],
'F':[
('同桌说，一起玩嘛','新同桌阿川拉你去操场：他们弹玻璃球，缺一个人。他把圈往你这边挪了挪，像给你留了个座位。','marbles','marbles',['跟着他，把十颗都拿出来。','和他各押三颗。','先陪他看两局。','约他明天踢球，今天先回家。']),
('去小卖部的那条近路','阿川约你绕路去小卖部，说新来的奖品很像你们上次聊过的东西。他说得热闹，你还有一张没写完的作业纸。','shop','packs',['他买多少，我也跟着买。','一人买一包，先说好各归各。','先看看奖品，一起比较。','陪他走一段，自己不抽。']),
('第一次被带进游戏厅','阿川带你进游戏厅，说今天两人的币可以凑着玩。他介绍机器比介绍新同学还认真，你想起之前一起玩时说过的话。','arcade','tokens',['都交给他选，凑一大把试。','各拿两枚，赢了各分一半。','先说清输赢怎么分，再一起看。','陪他玩赛车，币各花各的。']),
('兄弟一场，一起猜？','阿川把比赛名单递来，提议一起出钱猜结果。旁边人已经喊起“兄弟一条心”，仿佛算清楚各出多少就有点生分。','match','cash',['跟他一起押 50 元。','各出 20 元，先说清各算各的。','一起查资料，今天先不出钱。','请他喝饮料，不合伙押钱。']),
('毕业以后，还能一起玩吗','散场前，阿川说：最后一次，毕业以后不知道什么时候还能一起玩。他没有催你，别人却已经替你回答了一半。','graduation','cash',['为了这一次，押 50 元。','一起玩，自己只押 20 元。','把以后见面的日子约好。','不赌了，陪他把这瓶汽水喝完。'])],
'G':[
('这次轮到你藏弹珠','同学轮流猜单双，这回弹珠藏在你手里。你还没出题，已经有两个人问能不能临时改答案。','marbles','marbles',['也拿十颗参与，边藏边猜。','拿三颗玩一轮，轮流藏。','先把能不能改答案说清。','只负责记数，不拿弹珠参与。']),
('课间卡片赛由谁说了算','你把同学叫到一起拍卡。第一场还没开始，就有人说刚才答应的那张不算。组织比赛比自己玩，多出一圈盯着你的眼睛。','cards','cards',['自己也押最好的卡参赛。','拿一张普通卡加入。','把规则写好，让大家都点头。','只记比分，卡片不换主人。']),
('“那规矩谁来定”','午休卡牌赛快结束，有人提出以后由你定规则。阿川问，那你自己还参不参加？你第一次发现，大家信的是同一个规矩，不只是同一个人。','card-club','cards',['规则照旧，自己拿卡参赛。','用普通卡参加，争议请别人判断。','只组织，不参与有彩头的对局。','改成练习赛，所有卡各自带走。']),
('记比分的人也想猜一场','同学请你记录比赛预测，有人说自己昨天就猜对了，只是忘了写。你手里的本子突然比电视里的比分还受关注。','statistics','cash',['自己也押 50 元，把选择先写下。','押 20 元，交给别人核对记录。','只登记预测，事前确认，不收钱。','提议只算积分，输赢不涉及现金。']),
('最后一局，还让你来记吗','毕业聚会有人把本子推给你：以前就你记得清。阿川提醒，最后一局也会有人不认账。你翻开空白页，先决定这回自己站在哪边。','graduation','cash',['自己押 50 元，再请别人记账。','押 20 元，记录交给没参与的人。','只组织一局积分赛。','把本子改成留言册，每人写一句。'])],
'H':[
('赢了三颗以后','刚才那一局你赢了三颗弹珠，阿川准备继续，对面也把球摆好了。你把三颗放进口袋，声音比刚才响了一点。','marbles','marbles',['把手里的十颗都拿出来。','再押三颗，输赢都停。','先看他们怎么玩下一局。','收好三颗，今天就这样。']),
('第一包就中了','今天第一包零食里就是你想要的卡。老板把盒子往前推了推：还有别的稀有款。你忽然又想不起自己刚才到底缺哪张。','shop','packs',['剩下的额度也都买了。','再买一包，看看手气。','拿重复卡和同学交换。','拿着卡走，零食留到放学吃。']),
('游戏币装满了一小杯','阿川指指你的杯子：这回换奖品够了。奖品机还亮着，旁边普通游戏也空出了位置。游戏币能换成什么，突然有了三个答案。','arcade','tokens',['全部继续投，看看能多到哪儿。','留下一半，只玩两枚。','全部换成眼前这份小奖品。','留着币，约好下次玩普通游戏。']),
('第一次赢的钱要不要再押','同学把刚赢的二十元递给你。下一场就要开始，有人说现在退出太可惜。你看着这张钱，它还没有在你口袋里待过一分钟。','match','cash',['加到 50 元再猜一场。','还是只拿 20 元。','把刚才判断的理由写下来。','钱收好，不接下一场。']),
('原则也会遇到好看的借口','毕业聚会的最后一局，条件被说得格外诱人。阿川没有劝你，只问了一句：这次算不算你说过的“到这儿就停”？','graduation','cash',['破例一次，押 50 元。','还是只拿 20 元。','先核对，别因为是最后一局就加码。','今天照旧，停在自己选的地方。'])]
}
# Distinct resolutions per action type; stakes/rare variants are resolved by the runtime.
KINDS={
'A':[['allin','small','observe','leave'],['buy','allin','exchange','leave'],['risk','observe','partner','leave'],['small','allin','observe','drink'],['allin','chase','observe','leave']],
'B':[['allin','small','observe','leave'],['allin','small','exchange','leave'],['allin','small','observe','leave'],['allin','small','observe','leave'],['purchase','small','exchange','leave']],
'C':[['allin','small','observe','leave']]*5,
'D':[['allin','chase','observe','leave'],['allin','buy','exchange','leave'],['borrow','small','observe','leave'],['allin','chase','observe','leave'],['allin','chase','observe','leave']],
'E':[['allin','small','observe','leave']]*4+[['allin','small','test','leave']],
'F':[['allin','partner','observe','leave']]*4+[['allin','partner','observe','leave']],
'G':[['allin','small','organize','leave']]*5,
'H':[['allin','small','observe','leave'],['allin','buy','exchange','leave'],['allin','small','redeem','leave'],['allin','small','observe','leave'],['allin','small','observe','leave']]
}
STUDENT_EVENT_IDS=[f'STU_{line}{slot}' for line in LINES for slot in range(1,6)]+['STU_A2_MORE','STU_D2_MORE']
def build_event(line,slot,row,followup=False):
 title,prompt,art,resource,labels=row
 eid=f'STU_{line}{slot}'+('_MORE' if followup else '')
 kinds=['chase','leave'] if followup else KINDS[line][slot-1]
 if line=='A' and slot==3 and not followup:
  labels=labels+['剩下的全部推进去。']; kinds=kinds+['allin']
 choices=[]
 for i,(label,kind) in enumerate(zip(labels,kinds)):
  cid=f'{eid}_{i+1}'
  active=kind in ['allin','small','risk','partner','borrow','buy','chase','test']
  # Outcome IDs are fixed in catalog; runtime adjusts weights before activation, never on render.
  variants=[('win',32),('loss',38),('big_win',5),('big_loss',5),('tie',5),('renege',4),('interrupted',4),('friend_exit',3),('streak_win',2),('streak_loss',2)] if active else [('quiet',100)]
  outcomes=[]
  for variant,weight in variants:
   outcomes.append(dict(id=f'{cid}_{variant}',weight=weight,title=title+' · 事情有了结果',text={'win':'这一次赢了，刚才的犹豫已经被说成了胸有成竹。','loss':'这一次没成，你把剩下的收好，旁边已经有人在说下一局。','big_win':'这一次意外赢了很多，围观的人突然都说自己早就看好你。','big_loss':'这一次押出的全没了，原本很有把握的话说到一半停住。','tie':'折腾一圈，最后打平，各自拿回自己的那一份。','renege':'对方临时反悔，只退回你原来那一份，刚才的热闹冷了下来。','interrupted':'事情还没开始，大人过来叫人，各自把东西原样收回。','friend_exit':'阿川临时离开，这次没开成，大家各自拿回东西。','streak_win':'接着上次顺利的结果，这次又赢了，大家开始替你总结好运。','streak_loss':'接着上次的失利，这次也没成，下一次三个字又到了嘴边。','quiet':label+'阿川听你说完，把这次的约定记在心里。'}[variant],effects=[],schedule=[],studentOutcome=variant))
  special={'trait':'riskTaking','min':15} if line=='A' and slot==3 and i==4 else None
  choices.append(dict(id=cid,label=label,profile='child_trade' if active else 'observe',requirements={'min_cash_yuan':0,'all':[]},outcomes=outcomes,studentAction=kind,**({'studentSpecial':special} if special else {})))
 return dict(id=eid,category='学生旧事',kind='personal',title=title,age_min=AGES[slot-1],age_max=AGES[slot-1],required_flags=[],excluded_flags=[],weight=10,priority=76,cooldown_turns=0,max_occurrences=1,prompt=prompt,choices=choices,studentStory=dict(line=line,slot=slot,art=art,resource=resource,followup=followup))
def main():
 path=ROOT/'data/events.json'; data=json.loads(path.read_text()); data['events']=[e for e in data['events'] if not e['id'].startswith('STU_')]
 for line,rows in LINES.items():
  for slot,row in enumerate(rows,1):data['events'].append(build_event(line,slot,row))
 for line in ['A','D']:
  data['events'].append(build_event(line,2,('拆完了，还是重复卡','包装袋已经摊了一桌，缺的那张仍然没出现。阿川准备走，你却又看了一眼盒子。接下来要花的是新的一份额度，前面拆掉的不会退回来。','shop','packs',['都买这么多了，再来一包！','到此为止。']),True))
 path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 path=ROOT/'data/content_manifest.json'; manifest=json.loads(path.read_text()); es=data['events']; manifest.update(events=len(es),choices=sum(len(e['choices']) for e in es),outcomes=sum(len(c['outcomes']) for e in es for c in e['choices']),categories=len(set(e['category'] for e in es)))
 path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__': main()
