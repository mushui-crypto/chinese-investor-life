// Cents. Household reserves are not the player's spendable gift.
export const ADULT_GIFT_CAP=10_000_000;
export function cappedGiftRange(range=[0,0]){
 if(!Array.isArray(range)||range.length!==2||!range.every(n=>Number.isSafeInteger(n)&&n>=0)||range[0]>range[1])throw Error('家庭金额区间无效');
 return range.map(n=>Math.min(n,ADULT_GIFT_CAP/100));
}
export function migrateFamilyGift(s){
 if(s.adultGift<=ADULT_GIFT_CAP)return false;
 if(!s.giftReceived){s.adultGift=ADULT_GIFT_CAP;return true;}
 // Correct an untouched adult opening. Never unwind later trades or create debt.
 const gift=s.ledger.findLastIndex(e=>e.account==='cash'&&e.label==='成年一次性赠与');
 const excess=s.adultGift-ADULT_GIFT_CAP;
 if(s.age!==18||gift<0||s.ledger[gift].amount!==s.adultGift||s.ledger.slice(gift+1).some(e=>e.account==='cash')||s.cash<excess)return false;
 s.cash-=excess;s.familyReserve+=excess;s.adultGift=ADULT_GIFT_CAP;
 s.ledger.push({id:`entry-${s.turn}-${++s.serial}`,turn:s.turn,age:s.age,account:'cash',amount:-excess,label:'超出成年赠与上限，交回家里'});
 s.logs.push({id:`log-${s.turn}-${++s.serial}`,turn:s.turn,age:s.age,kind:'system',title:'成年赠与调整为十万元',text:`超出的 ${excess/100} 元交回家里。成年赠与保留 100000 元，原有零花钱结余不变。`});
 if(s.childhood?.summary){s.childhood.summary.gift=ADULT_GIFT_CAP;s.childhood.summary.cash-=excess;}
 const latest=s.netWorthHistory.at(-1);if(latest?.age===18)latest.value-=excess;
 s.peakNetWorth=Math.max(0,s.peakNetWorth-excess);
 if(s.lifeArcs?.audit)s.lifeArcs.audit.peak=Math.max(0,s.lifeArcs.audit.peak-excess);
 return true;
}
