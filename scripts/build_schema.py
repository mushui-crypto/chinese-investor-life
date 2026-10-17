"""Emit a JSON Schema for the authored events contract."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def obj(properties,required=None):
    return {'type':'object','properties':properties,'required':required or list(properties),'additionalProperties':False}
def arr(items): return {'type':'array','items':items}
def ref(name): return {'$ref':'#/$defs/'+name}
string={'type':'string','minLength':1}; num={'type':'number'}; integer={'type':'integer'}; boolean={'type':'boolean'}
nonneg={'type':'number','minimum':0}; positive={'type':'number','exclusiveMinimum':0}; fraction={'type':'number','exclusiveMinimum':0,'maximum':1}
ops=['stat','spend','earn','flag','family_transfer','repay','extend_debt','loan','guarantee','liquidate_asset','recover_claim','venture','freeze_investment','illiquid','legal_case','legal_cooperate','quit_gambling']
params={
'character_id':{'type':'string','pattern':'^N(0[1-9]|1[0-2])$'},'change':{'type':'integer','minimum':-100,'maximum':100},'op':{'enum':ops},'delta':{'type':'object','properties':{k:integer for k in ['health','stress','academic','discipline','skill','insight','trust','fame','credit']},'additionalProperties':False,'minProperties':1},
'amount_yuan':nonneg,'key':string,'value':boolean,'cap_yuan':positive,'cash_fraction':fraction,'turns':{'type':'integer','minimum':1},'principal_yuan':positive,'apr_bps':nonneg,'term_months':{'type':'integer','minimum':1},'purpose':string,'limit_yuan':positive,'called':boolean,'fraction':fraction,'haircut_bps':{'type':'number','minimum':0,'maximum':10000},'recovery_bps':{'type':'number','minimum':0,'maximum':10000},'stake_fraction':fraction,'gross_multiple':nonneg,'loss_debt_multiple':nonneg,'claim_mark_bps':{'type':'number','minimum':0,'maximum':10000},'lock_turns':{'type':'integer','minimum':1},'case_type':{'enum':['gambling','gambling_promotion','account_rental','fraud','data_resale','illegal_fundraising','misleading_ads']},'profit_yuan':{'type':'integer','minimum':0}}
effect=obj(params,['op'])
required={'relationship':['character_id','change'],'stat':['delta'],'spend':['amount_yuan'],'earn':['amount_yuan'],'flag':['key','value'],'family_transfer':['cap_yuan'],'repay':['cash_fraction'],'extend_debt':['turns'],'loan':['principal_yuan','apr_bps','term_months','purpose'],'guarantee':['limit_yuan','called'],'liquidate_asset':['fraction','haircut_bps'],'recover_claim':['recovery_bps'],'venture':['stake_fraction','gross_multiple'],'freeze_investment':['stake_fraction','claim_mark_bps'],'illiquid':['stake_fraction','gross_multiple','lock_turns'],'legal_case':['case_type','profit_yuan'],'legal_cooperate':[],'quit_gambling':[]}
optional={'venture':['loss_debt_multiple']}
effect={'oneOf':[obj({'op':{'const':op},**{key:params[key] for key in fields+optional.get(op,[])}},['op']+fields) for op,fields in required.items()]}
defs={
'effect':effect,
'schedule':obj({'event_id':string,'after_turns':{'type':'integer','minimum':0},'expires_after_turns':{'type':'integer','minimum':0},'reason':string,'on_ineligible':{'const':'wait_until_expiry_then_log_unresolved'}}),
'outcome':obj({'id':string,'weight':{'type':'integer','minimum':1},'text':string,'effects':arr(ref('effect')),'schedule':arr(ref('schedule'))}),
'requirements':obj({'min_cash_yuan':nonneg,'all':arr(string)}),
'choice':obj({'id':string,'label':string,'profile':string,'requirements':ref('requirements'),'outcomes':{'type':'array','minItems':1,'items':ref('outcome')}})}
eprops={'id':string,'category':string,'kind':{'enum':['personal','anchor','world']},'title':string,'age_min':{'type':'integer','minimum':0,'maximum':80},'age_max':{'type':'integer','minimum':0,'maximum':80},'required_flags':arr(string),'excluded_flags':arr(string),'weight':nonneg,'priority':integer,'cooldown_turns':{'type':'integer','minimum':0},'max_occurrences':{'const':1},'prompt':string,'choices':{'type':'array','minItems':3,'items':ref('choice')}}
required_event=list(eprops)
eprops.update(character_ids=arr(string),scene_scope={'enum':['outside','prison','legal','release']},history_ref=string,historical_date={'type':'string','pattern':r'^\d{4}(-\d{2})?(-\d{2})?$'},world_effects=obj({'archetype':string,'channels':arr(string),'apply':{'const':'before_choices_once'},'scope':{'const':'relevant_exposures_only'},'resolver':{'const':'future_market_adapter'}}))
defs['event']=obj(eprops,required_event)
defs['event']['allOf']=[{'if':{'properties':{'kind':{'const':'world'}}},'then':{'required':['history_ref','historical_date','world_effects']}}]

# School choices resolve token receipts and hidden traits in the game adapter.
defs['outcome']['properties'].update(title=string,studentOutcome={'enum':['quiet','win','loss','big_win','big_loss','tie','renege','interrupted','friend_exit','streak_win','streak_loss']})
defs['choice']['properties'].update(studentAction={'enum':['allin','small','risk','partner','borrow','buy','chase','test','observe','exchange','organize','redeem','leave','drink','purchase']},studentSpecial=obj({'trait':{'enum':['riskTaking','chasing','restraint','analysis','probability','superstition','allIn','impulse']},'min':{'type':'integer','minimum':0,'maximum':100}}))
defs['event']['properties']['studentStory']=obj({'line':{'enum':list('ABCDEFGH')},'slot':{'type':'integer','minimum':1,'maximum':5},'art':{'enum':['marbles','cards','shop','shop-young','arcade','card-club','match','game-items','statistics','graduation']},'resource':{'enum':['marbles','cards','packs','tokens','items','chances','cash']},'followup':boolean})
defs['event']['properties']['choices']['minItems']=2
defs['event']['allOf'].append({'if':{'required':['studentStory'],'properties':{'studentStory':{'required':['followup'],'properties':{'followup':{'const':True}}}}},'then':{'properties':{'choices':{'maxItems':2}}},'else':{'properties':{'choices':{'minItems':3}}}})

schema=obj({'version':string,'language':{'const':'zh-CN'},'mode':{'const':'authored_life_game'},'probabilities':{'const':'fictional_design_weights_not_real_returns'},'events':{'type':'array','minItems':1,'items':ref('event')}})
schema.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'https://example.invalid/chinese-investor-life/event.schema.json','title':'中国式赌狗 narrative event catalog v1','$defs':defs})
(root/'data/event.schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2)+'\n')
print('Wrote data/event.schema.json')
