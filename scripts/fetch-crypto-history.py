"""Download a small reproducible, checksum-verified Binance futures candle snapshot."""
from pathlib import Path
import urllib.request, zipfile, io, csv, json, hashlib, subprocess
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'reports/v1.3/market-data';CACHE.mkdir(parents=True,exist_ok=True)
WINDOWS=[('doge2021','2021 年 1 月山寨狂热','2021-01-28',['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','DOGEUSDT','ADAUSDT']),('rally2021','2021 年 2 月上涨行情','2021-02-08',['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','DOGEUSDT','ADAUSDT']),('march2020','2020 年 3 月剧烈波动','2020-03-12',['BTCUSDT','ETHUSDT','BNBUSDT']),('may2021','2021 年 5 月急跌','2021-05-19',['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','DOGEUSDT','ADAUSDT']),('nov2022','2022 年 11 月平台危机','2022-11-08',['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','DOGEUSDT','ADAUSDT'])]
def fetch(url):
    return subprocess.check_output(["curl","-fsSL","--retry","3","--connect-timeout","10","--max-time","25",url])
def download(job):
    window,symbol,start=job
    month=start[:7];name=f'{symbol}-1h-{month}.zip';url=f'https://data.binance.vision/data/futures/um/monthly/klines/{symbol}/1h/{name}'
    blob=(CACHE/name).read_bytes() if (CACHE/name).exists() else fetch(url);expected=fetch(url+'.CHECKSUM').decode().split()[0]
    digest=hashlib.sha256(blob).hexdigest();assert digest==expected,(symbol,'checksum')
    (CACHE/name).write_bytes(blob)
    with zipfile.ZipFile(io.BytesIO(blob)) as z: rows=list(csv.reader(io.TextIOWrapper(z.open(z.namelist()[0]),encoding='utf-8')))
    begin=int(datetime.fromisoformat(start).replace(tzinfo=timezone.utc).timestamp()*1000);candles=[]
    for row in rows:
        if not row[0].isdigit():continue
        ts=int(row[0]);ts=ts//1000 if ts>10**14 else ts
        if begin-86400000<=ts<begin+3*86400000:
            candle=[ts,*row[1:6]]
            o,h,l,c=map(float,candle[1:5]);assert l<=min(o,c)<=max(o,c)<=h and l>0
            candles.append(candle)
    assert len(candles)==96,(symbol,window,len(candles))
    assert all(b[0]-a[0]==3600000 for a,b in zip(candles,candles[1:]))
    return window,symbol,{'source':url,'sha256':digest,'market':'USD-M futures trade-price klines','interval':'1h','candles':candles}
jobs=[(id,sym,start) for id,title,start,syms in WINDOWS for sym in syms]
with ThreadPoolExecutor(max_workers=5) as pool: results=list(pool.map(download,jobs))
windows={id:{'id':id,'title':title,'start':start,'startMs':int(datetime.fromisoformat(start).replace(tzinfo=timezone.utc).timestamp()*1000),'prelude':24,'hours':72,'symbols':{}} for id,title,start,syms in WINDOWS}
for window,sym,data in results:windows[window]['symbols'][sym]=data
payload={'fetchedAt':datetime.now(timezone.utc).isoformat(),'sourceDocumentation':'https://github.com/binance/binance-public-data','priceCurrency':'USDT','candleFields':['openTimeMs','open','high','low','close','volume'],'windows':windows}
(ROOT/'data/crypto-history.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
(ROOT/'src/game/crypto-history-data.js').write_text('// Verified offline snapshot. Regenerate with scripts/fetch-crypto-history.py.\nexport const CRYPTO_HISTORY = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n')
print(json.dumps({'windows':len(windows),'markets':len(results),'candles':sum(len(x[2]['candles']) for x in results),'checksums':'all matched'},ensure_ascii=False))
