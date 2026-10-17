"""Structural and predicate checks for the writing package, not gameplay balance tests."""
import os
import json
from collections import Counter
from pathlib import Path
from build_underworld import EXTENSION_EVENT_IDS, LEGAL_CASE_TYPES
from build_relationships import RELATIONSHIP_EVENT_IDS
from expand_life_encounters import LIFE_ENCOUNTER_IDS
from build_student_stories import STUDENT_EVENT_IDS
ROOT=Path(__file__).resolve().parents[1]
def read(n): return json.loads((ROOT/'data'/n).read_text())
events=read('events.json')['events']; profiles=read('effect_profiles.json'); endings=read('endings.json')
history=read('history.json'); families=read('families.json'); sources=read('state_sources.json'); manifest=read('content_manifest.json')
errors=[]; checks=[]
def check(test,msg):
    if not test: errors.append(msg)
    checks.append((bool(test),msg))
ONLINE_GAMBLING_IDS=[f'OG{i:02d}' for i in range(1,28)]
CRYPTO_LIFE_IDS=[f'CL{i:02d}' for i in range(1,43)]
SCHEME_LIFE_IDS=[f'SL{i:02d}' for i in range(1,25)]
ids=[e['id'] for e in events]; idx={e['id']:e for e in events}
check(len(events)==233+len(EXTENSION_EVENT_IDS)+len(RELATIONSHIP_EVENT_IDS)+len(LIFE_ENCOUNTER_IDS)+len(STUDENT_EVENT_IDS)+len(ONLINE_GAMBLING_IDS)+len(CRYPTO_LIFE_IDS)+len(SCHEME_LIFE_IDS)==manifest['events'],'Base plus growth, underworld, relationship and life encounters')
check(set(ONLINE_GAMBLING_IDS)<=set(ids),'All 27 online gambling life nodes exist')
check(set(CRYPTO_LIFE_IDS)<=set(ids),'All 42 independent Crypto life nodes exist')
check(set(SCHEME_LIFE_IDS)<=set(ids),'All 24 additional independent scheme nodes exist')
check(set(STUDENT_EVENT_IDS)<=set(ids),'All 40 school stories and two followups exist')
check(set(LIFE_ENCOUNTER_IDS)<=set(ids),'All authored life encounter IDs exist')
check(set(EXTENSION_EVENT_IDS)<=set(ids),'All authored underworld IDs exist')
check(set(RELATIONSHIP_EVENT_IDS)<=set(ids),'All authored recurring NPC nodes exist')
check(len(set(ids))==len(ids),'Unique event IDs')
check(len(history)==24 and len(endings)==34==manifest['endings'] and len(families)==12,'Catalog counts')
check(sum(f['weight'] for f in families)==100,'Family weights total 100')
check(len(read('characters.json'))==12,'12 characters')
for fam in families:
    for key in ('adult_gift_yuan','family_reserve_yuan'):
        check(0<=fam[key][0]<=fam[key][1],f'{fam["id"]} valid {key}')
allowed_ops={'relationship','stat','spend','earn','flag','family_transfer','repay','extend_debt','loan','guarantee','liquidate_asset','recover_claim','venture','freeze_investment','illiquid','legal_case','legal_cooperate','quit_gambling','crypto_life'}
effect_schema=read('event.schema.json')['$defs']['effect']
def effect_matches(value, schema):
    """Validate the limited, closed effect schema without third-party packages."""
    if 'oneOf' in schema: return sum(effect_matches(value,s) for s in schema['oneOf'])==1
    if 'const' in schema and value!=schema['const']: return False
    if 'enum' in schema and value not in schema['enum']: return False
    typ=schema.get('type')
    if typ=='object':
        if not isinstance(value,dict): return False
        props=schema.get('properties',{})
        if not set(schema.get('required',[]))<=set(value): return False
        if schema.get('additionalProperties') is False and not set(value)<=set(props): return False
        if len(value)<schema.get('minProperties',0): return False
        return all(effect_matches(v,props[k]) for k,v in value.items() if k in props)
    if typ=='integer' and (not isinstance(value,int) or isinstance(value,bool)): return False
    if typ=='number' and (not isinstance(value,(int,float)) or isinstance(value,bool)): return False
    if typ=='boolean' and not isinstance(value,bool): return False
    if typ=='string' and (not isinstance(value,str) or len(value)<schema.get('minLength',0)): return False
    if 'minimum' in schema and value<schema['minimum']: return False
    if 'exclusiveMinimum' in schema and value<=schema['exclusiveMinimum']: return False
    if 'maximum' in schema and value>schema['maximum']: return False
    return True
check(all(effect_matches(x,effect_schema) for e in events for c in e['choices'] for o in c['outcomes'] for x in o['effects']),'Every effect satisfies the closed opcode schema')
for invalid in ({'op':'unknown'},{'op':'legal_case','case_type':'fraud'},{'op':'legal_case','case_type':'fraud','profit_yuan':1,'amount_yuan':1},{'op':'legal_case','case_type':'fraud','profit_yuan':True},{'op':'legal_case','case_type':'unknown','profit_yuan':1}):
    check(not effect_matches(invalid,effect_schema),'Closed effect schema rejects '+json.dumps(invalid))
stats={'health','stress','academic','discipline','skill','insight','trust','fame','credit'}
produced=set(sources)
for e in events:
    for c in e['choices']:
        for o in c['outcomes']:
            produced.update(x['key'] for x in o['effects'] if x['op']=='flag')
choice_ids=[]; outcome_ids=[]; edge_count=0
for e in events:
    if not e.get('onlineGambling'): continue
    m=e['onlineGambling']
    check(effect_matches(m,read('event.schema.json')['$defs']['event']['properties']['onlineGambling']),e['id']+' valid online event metadata')
    check(e['age_min']>=18 and m['minDelay']>=60 and m['minOrdinaryEvents']>=2,e['id']+' adult life pacing')
    check(any(c.get('onlineAction') in {'quit','withdraw','refuse','remember'} for c in e['choices']),e['id']+' real no-cost exit')
    check(all(not o['schedule'] for c in e['choices'] for o in c['outcomes']),e['id']+' does not prescribe next event')
for e in events:
    if not e.get('cryptoLife') or e.get('schemeLife'): continue
    m=e['cryptoLife']
    check(effect_matches(m,read('event.schema.json')['$defs']['event']['properties']['cryptoLife']),e['id']+' valid Crypto event metadata')
    check(e['age_min']>=18 and m['minDelay']>=90,e['id']+' adult asynchronous pacing')
    check(any(c.get('cryptoAction') in {'sell','principal','quit','reduce','exit_all','permanent_close','scheme_withdraw','refuse','remember','acknowledge'} for c in e['choices']),e['id']+' genuine exit or acknowledgement')
    check(all(not o['schedule'] for c in e['choices'] for o in c['outcomes']),e['id']+' returns to ordinary life without scheduling another Crypto node')
    check(all(not any(x['op'] in {'earn','spend','venture','loan'} for x in o['effects']) for c in e['choices'] for o in c['outcomes']),e['id']+' financial stories do not manufacture returns')
    check(all(effect_matches(c.get('cryptoAction'),read('event.schema.json')['$defs']['choice']['properties']['cryptoAction']) for c in e['choices']),e['id']+' known Crypto actions')
    if e['id']=='CL31': check(len(e['choices'])==1 and e['choices'][0]['label']=='知道了。','Scheme failure has only the acknowledgement action')
for e in events:
    if not e.get('schemeLife'): continue
    m=e['schemeLife']
    check(effect_matches(m,read('event.schema.json')['$defs']['event']['properties']['schemeLife']),e['id']+' valid scheme metadata')
    check(e['age_min']>=24 and m['minDelay']>=90,e['id']+' adult scheme pacing')
    check(any(c.get('schemeAction') in {'refuse','withdraw','partial','principal','boundary','permanent_refuse','acknowledge','remember','wait','analyze'} for c in e['choices']),e['id']+' scheme free path or exit')
    check(all(not o['schedule'] for c in e['choices'] for o in c['outcomes']),e['id']+' scheme returns to life without fixed scheduling')
    check(all(effect_matches(c.get('schemeAction'),read('event.schema.json')['$defs']['choice']['properties']['schemeAction']) for c in e['choices']),e['id']+' known scheme action')
    check(all(not any(x['op'] in {'earn','spend','venture','loan','family_transfer'} for x in o['effects']) for c in e['choices'] for o in c['outcomes']),e['id']+' scheme receipts are derived from actual positions')
for e in events:
    check(0<=e['age_min']<=e['age_max']<=80,e['id']+' age bounds')
    check(len(e['choices'])>=(1 if e['id'] in {'CL31','CL40'} else 2 if e.get('studentStory',{}).get('followup') else 3),e['id']+' has the required scene choices')
    check(e['max_occurrences']==1,e['id']+' bounded repetition')
    check(bool(e['prompt'].strip()) and bool(e['title'].strip()),e['id']+' authored scene')
    check(set(e['required_flags'])<=produced,e['id']+' prerequisites have sources')
    check(not(set(e['required_flags'])&set(e['excluded_flags'])),e['id']+' no contradictory flags')
    check(any(c['requirements']['min_cash_yuan']==0 and not c['requirements']['all'] for c in e['choices']),e['id']+' unconditional free choice')
    for c in e['choices']:
        choice_ids.append(c['id'])
        check(c['profile'] in profiles,c['id']+' known profile')
        check(c['requirements']['min_cash_yuan']>=0,c['id']+' nonnegative threshold')
        check(set(c['requirements']['all'])<=produced,c['id']+' choice predicates known')
        check(sum(o['weight'] for o in c['outcomes'])==100,c['id']+' outcome weights total 100')
        check(all(o['weight']>0 for o in c['outcomes']),c['id']+' positive weights')
        for o in c['outcomes']:
            outcome_ids.append(o['id']); check(len(o['text'])>=8,o['id']+' nonempty resolution')
            for x in o['effects']:
                check(x['op'] in allowed_ops,o['id']+' valid opcode')
                if x['op']=='stat': check(set(x['delta'])<=stats,o['id']+' known stats')
                if 'stake_fraction' in x: check(0<x['stake_fraction']<=1,o['id']+' bounded stake')
                if 'gross_multiple' in x: check(x['gross_multiple']>=0,o['id']+' nonnegative gross payout')
                if 'amount_yuan' in x: check(x['amount_yuan']>=0,o['id']+' nonnegative amount')
                if x['op']=='legal_case':
                    check(x.get('case_type') in LEGAL_CASE_TYPES,o['id']+' valid legal case type')
                    check(isinstance(x.get('profit_yuan'),int) and x['profit_yuan']>=0,o['id']+' explicit legal profit')
                    check(e['age_min']>=18,o['id']+' adult-only legal participation')
                    check(not any(k['op']=='earn' for k in o['effects']),o['id']+' legal income not paid twice')
                if e.get('scene_scope')=='prison': check(x['op'] in {'stat','flag','legal_cooperate'},o['id']+' prison effects do not trade or clear sentence')
                if x['op']=='loan': check(x['principal_yuan']>0 and x['term_months']>0 and x['apr_bps']>=0,o['id']+' loan terms')
            for q in o['schedule']:
                edge_count+=1
                check(q['event_id'] in idx,o['id']+' target exists')
                check(q['after_turns']<=q['expires_after_turns'],o['id']+' queue expiry')
                check(q['on_ineligible']=='wait_until_expiry_then_log_unresolved',o['id']+' has queue fallback')
check(len(set(choice_ids))==len(choice_ids),'Unique choice IDs')
check(len(set(outcome_ids))==len(outcome_ids),'Unique outcome IDs')
check([e['age_min'] for e in events if e['kind']=='anchor']==[0,6,12,18,22,28,35,42,50,60,70,80],'Life anchors ordered 0–80')
check(len([e for e in events if e['kind']=='world'])==24,'24 world nodes')
for h in history:
    check(h['id'] in idx,h['id']+' history reference exists')
    check(h['source_url'].startswith('https://'),h['id']+' source link')
    check(h['date']==idx[h['id']]['historical_date'],h['id']+' date agreement')
check([h['date'] for h in history]==sorted(h['date'] for h in history),'History chronologically ordered')
# All zero-cash/zero-credit states retain a choice for every eligible node.
for credit in (0,35,60,100):
    for e in events:
        options=[c for c in e['choices'] if c['requirements']['min_cash_yuan']==0 and not c['requirements']['all']]
        check(bool(options),f'{e["id"]} cannot cash-lock at credit={credit}')
metrics={'plain_investor','retirement_cover_months','pending_case_count','net_worth_yuan','liquid_ratio','credit','wipeouts','peak_net_worth_yuan','business_cashflow_yuan','skill','debt_yuan','debt_free_turns','claims_yuan','trust','private_equity_yuan','realized_equity_proceeds_yuan','business_count','reserve_months','fame','health','stress'}
ops={'gte','gt','lte','lt','eq'}
def eval_condition(c,s):
    if 'all' in c: return all(eval_condition(x,s) for x in c['all'])
    if 'any' in c: return any(eval_condition(x,s) for x in c['any'])
    if 'not' in c: return not eval_condition(c['not'],s)
    if 'flag' in c: return bool(s.get(c['flag'],False))==c['is']
    a=s.get(c['metric'],0); b=c['value']
    return {'gte':a>=b,'gt':a>b,'lte':a<=b,'lt':a<b,'eq':a==b}[c['op']]
def validate_pred(c):
    if 'all' in c or 'any' in c:
        return all(validate_pred(x) for x in c.get('all',c.get('any')))
    if 'not' in c: return validate_pred(c['not'])
    if 'flag' in c: return c['flag'] in produced and isinstance(c['is'],bool)
    return c.get('metric') in metrics and c.get('op') in ops
base=dict(net_worth_yuan=50000,liquid_ratio=.5,credit=60,wipeouts=0,peak_net_worth_yuan=50000,business_cashflow_yuan=0,skill=20,debt_yuan=0,debt_free_turns=0,claims_yuan=0,trust=50,private_equity_yuan=0,realized_equity_proceeds_yuan=0,business_count=0,reserve_months=0,fame=0,health=70,stress=20)
witnesses=[
{'net_worth_yuan':100000000},{'option_big_win':True,'net_worth_yuan':2000000},{'wipeouts':1,'net_worth_yuan':2000000,'rebuilding':True},{'net_worth_yuan':20000000,'liquid_ratio':.01},{'peak_net_worth_yuan':20000000,'wipeouts':1},{'business_owner':True,'rebuilding':True,'business_cashflow_yuan':10000},{'career_history':True,'skill':80},{'ever_indebted':True,'debt_free_turns':2},{'debt_yuan':20000,'restructuring':True},{'net_worth_yuan':-20000,'debt_yuan':25000,'employed':True},{'ponzi_loss':True,'claims_yuan':10000},{'recruited':True,'trust':10},{'angel_investor':True,'private_equity_yuan':10000,'liquid_ratio':.1},{'equity_exit':True,'realized_equity_proceeds_yuan':2000000,'net_worth_yuan':2000000},{'business_count':3,'business_cashflow_yuan':10000},{'reserve_months':24,'trust':80},{'net_worth_yuan':20000000,'trust':10},{'relationship_repaired':True,'trust':70},{'fame':80},{'fame':55,'public_truth':True},{'recovering_health':True},{'succession_released':True,'trust':60},{'voluntary_exit':True,'reserve_months':12},{}]
witnesses += [{'in_prison':True},{'legal_debt':True,'debt_yuan':100000},{'ever_released':True,'reentry_employed':True},{'gambling_history':True,'gambling_quit':True}]
witnesses += [{'survival_failed':True}]
witnesses += [{'plain_investor':1,'retirement_cover_months':600,'pending_case_count':0}]
witnesses += [{'gambling_final_loss':True},{'allin_final_loss':True},{'survival_failed':True,'health_failed':True,'health':0}]
witnesses += [{'crypto_final_loss':True}]
check(len(witnesses)==len(endings),'Every ending has a witness')
for e,w in zip(endings,witnesses):
    check(validate_pred(e['condition']),e['id']+' predicate valid')
    s=base|w
    check(eval_condition(e['condition'],s),e['id']+' satisfiable condition witness')
    selected=max((x for x in endings if eval_condition(x['condition'],s)),key=lambda x:x['priority'])
    check(selected['id']==e['id'],e['id']+' not shadowed under witness')
check(any(e['id']=='E24' and e['condition']=={'all':[]} and e['priority']==0 for e in endings),'Fallback ending exists')
check(len(choice_ids)==manifest['choices'] and len(outcome_ids)==manifest['outcomes'] and edge_count==manifest['scheduled_edges'],'Generated manifest agrees with content')
# Supplemental formula fixtures; runtime tests exercise the shipped engine.
from decimal import Decimal
cash=Decimal('10000'); debt=Decimal('0'); before=cash-debt
cash+=Decimal('15000'); debt+=Decimal('15000')
check(cash-debt==before,'Loan does not create net worth')
payment=min(cash*Decimal('.3'),debt); cash-=payment; debt-=payment
check(cash-debt==before,'Principal repayment conserves net worth')
for fraction,multiple in [('1','0'),('.25','25'),('.3','.4')]:
    cash=Decimal('10000'); stake=cash*Decimal(fraction)
    after=cash-stake+stake*Decimal(multiple)
    check(after>=0,'Cash-limited venture never creates implicit debt')
check(Decimal('10000')-Decimal('2500')+Decimal('2500')*0==Decimal('7500'),'Long-option loss bounded by premium in formula fixture')
summary={'status':'PASS' if not errors else 'FAIL','checks':len(checks),'failed':len(errors),'events':len(events),'choices':len(choice_ids),'outcomes':len(outcome_ids),'scheduled_edges':edge_count,'families':len(families),'characters':12,'historical_nodes':len(history),'endings':len(endings),'profiles':len(profiles),'categories':dict(Counter(e['category'] for e in events)),'limitations':['Static narrative/data validation; separate Node tests exercise the playable engine.','Ending witnesses prove predicate satisfiability, not whole-life reachability or balance.','History sources were browsed during authoring; this validator does not re-fetch URLs.','Decimal examples supplement but do not replace core and narrative integration tests.'],'errors':errors}
REPORT_DIR=Path(os.environ.get('QA_REPORT_DIR', ROOT/'reports'))
REPORT_DIR.mkdir(parents=True, exist_ok=True)
(REPORT_DIR/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
lines=['# 内容校验报告','',f"结果：**{summary['status']}**。检查 {len(checks)} 项，失败 {len(errors)} 项。",'',f"{len(events)} 个事件／{len(choice_ids)} 个选项／{len(outcome_ids)} 个结果分支／{edge_count} 条结果预约边／12 种家庭／12 位主要人物／24 个历史节点／{len(endings)} 个开放结局。",'', '已检查：编号唯一、年龄范围、概率归一、家庭权重、免费退路、效果类型、后续引用、条件来源、历史日期对应、结局条件样例和优先级遮蔽。另以 Decimal 校验借款与还本不凭空增加净资产、买方期权损失受权利金限制的规则样例。','', '**范围**：本脚本只做内容结构与条件校验；完整游戏另由 Node 测试覆盖账本、叙事与整局推进。本报告不证明所有剧情组合、现实收益率、长期平衡、演出或时长。每个结局均有可满足的状态样例，不等于全部由自然周目跑到。','', '运行：`npm run check:content`。','']
if errors: lines+=['失败项：']+['- '+x for x in errors]
(REPORT_DIR/'校验报告.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k not in ('categories','limitations')},ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
