"""Keep the volatility story explicit about its market, actions and costs."""
def refine_result_story(events):
    event = next(e for e in events if e['id'] == 'HST16')
    event['title'] = '期权市场：波动骤升，权利金变贵'
    event['prompt'] = '你刷到一条市场新闻：原本平静的行情突然大幅震荡，一些押注波动维持低位的产品遭遇重亏。朋友转来一张看跌期权，说行情继续下跌也许能赚钱。你打开说明才知道，期权要先付权利金，而且有到期日；现在买得贵，即使判断对方向，也未必能赚。你还没有下单。'
    choices = event['choices']
    choices[0]['label'] = '买入看跌期权，押注行情继续下跌'
    choices[0]['outcomes'][0]['title'] = '看跌期权获利卖出，回款已到账'
    choices[0]['outcomes'][0]['text'] = '行情继续下跌，你买入的看跌期权价格上升。卖出后，本金和盈利一起回到现金账户；这次赚到的钱已经结算。'
    choices[0]['outcomes'][1]['title'] = '看跌期权到期，权利金全部损失'
    choices[0]['outcomes'][1]['text'] = '你追入时权利金已经很贵，后来行情企稳，波动回落。到期时这张期权没有价值，本次支付的权利金全部损失，没有额外借款。'
    choices[1]['label'] = '报名期权基础课（费用 ¥1,000）'
    choices[1]['outcomes'][0]['title'] = '花 ¥1,000 学习期权，未进行交易'
    choices[1]['outcomes'][0]['text'] = '你支付了 1,000 元课程费，跟着教材练习看涨、看跌与到期结算，弄清权利金为什么会变化。这笔钱是学习支出，没有买入期权，也没有产生投资盈亏。'
    choices[2]['label'] = '只看新闻，暂不买入期权'
    choices[2]['outcomes'][0]['title'] = '了解波动风险后，这次没有下单'
    choices[2]['outcomes'][0]['text'] = '你看完新闻和产品说明，把“价格会变、期权会到期”记了下来。这次没有支付权利金，也没有新增持仓或交易盈亏。'
