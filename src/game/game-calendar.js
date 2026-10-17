// Virtual civil dates. UTC arithmetic keeps saves independent of computer timezone.
// Life periods begin in their age's calendar month; billing still uses 30-day months.
const DAY=86400000;
export const addGameDays=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*DAY).toISOString().slice(0,10);
export const validGameDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
export function periodDate(s,age=s.age){
 const months=Math.round(age*12);
 return new Date(Date.UTC(s.birthYear+Math.floor(months/12),months%12,1)).toISOString().slice(0,10);
}
export function gameDate(s){
 const t=s.trading,c=t?.calendar;
 if(c?.turn===s.turn)return addGameDays(c.date,t.day-c.day);
 // Old saves count a closed day's bill already. Closing must not move its date.
 const billed=t?.phase===3&&s.survival?.lastBilledDay===t.day?1:0;
 const elapsed=Math.max(0,(s.debtClock?.periodDays||0)-billed,t?.dayInTurn||0);
 return addGameDays(periodDate(s),elapsed);
}
export function quoteDates(s,bars){
 const anchors=new Map();
 for(const b of bars){
  if(b.date){anchors.set(b.turn,{day:b.day,date:b.date});continue;}
  if(anchors.has(b.turn))continue;
  if(b.turn===s.turn)anchors.set(b.turn,{day:s.trading.day,date:gameDate(s)});
  else{
   // Pre-calendar saves have no exact old month/day. Recover the life period from
   // its saved age, then retain recorded day gaps. Never change historical prices.
   const age=s.netWorthHistory?.find(h=>h.turn===b.turn)?.age??s.logs?.find(h=>h.turn===b.turn)?.age??Math.max(0,s.age-(s.turn-b.turn)*(s.age<36?.5:1));
   const first=bars.find(x=>x.turn===b.turn&&!x.preview)||b;
   anchors.set(b.turn,{day:first.day,date:periodDate(s,age)});
  }
 }
 return bars.map(b=>b.date||addGameDays(anchors.get(b.turn).date,b.day-anchors.get(b.turn).day));
}
export function ensureGameCalendar(s){
 if(s.trading.calendar?.turn===s.turn)return;
 // Upgrade dates only on an actual game action; viewing/loading stays read-only.
 for(const q of [...Object.values(s.trading.quotes),...Object.values(s.trading.stockWorld||{})]){
  if(!q.daily)continue;
  const dates=quoteDates(s,q.daily);q.daily.forEach((b,i)=>{b.date??=dates[i];});
 }
 s.trading.calendar={turn:s.turn,day:s.trading.day,date:gameDate(s)};
}
export function resetGameCalendar(s){
 const t=s.trading,c=t.calendar,scheduled=periodDate(s);
 // A short prison period can bill 30 days across February. Never turn time back.
 const elapsed=c?addGameDays(c.date,t.day-c.day):scheduled;
 t.calendar={turn:s.turn,day:t.day,date:elapsed>scheduled?elapsed:scheduled};
}
