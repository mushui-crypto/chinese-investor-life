import {isCollegeStudent} from '../game/education.js';

// Art direction is separate from economic outcomes. Each override describes the
// scene being read, not the event's old broad category or the player's wealth.
const OVERRIDES={
 XIA01:'relationships',XIA02:'work-desk',XIA03:'relationships',XIA04:'relationships',XIA05:'personal-budget',
 HAO01:'order-work',HAO02:'personal-budget',HAO03:'friends-meal',HAO04:'personal-budget',HAO05:'personal-budget',
 ZHOU01:'work-desk',ZHOU02:'work-desk',ZHOU03:'work-desk',ZHOU04:'work-desk',ZHOU05:'friends-meal',
 REL01:'relationships',REL02:'personal-budget',REL03:'family',REL04:'family-adult',REL05:'friends-meal',REL06:'relationships',REL07:'personal-budget',REL08:'family-adult',
 REC01:'personal-budget',REC02:'order-work',REC03:'work-desk',REC06:'personal-budget',REC07:'personal-budget',
 MAIN03:'personal-budget',MAIN04:'family-adult',MAIN05:'work-desk',MAIN06:'work-desk',MAIN07:'personal-budget',MAIN08:'work-desk',MAIN09:'market-review',MAIN10:'personal-budget',MAIN11:'personal-budget',MAIN12:'personal-budget',
 FAM02:'family',FAM04:'personal-budget',FAM06:'market-review',FAM07:'personal-budget',
 YOU01:'school',YOU02:'school',YOU03:'school',YOU07:'personal-budget',
 HOU03:'family-adult',HOU04:'friends-meal',HOU05:'personal-budget',HOU06:'personal-budget',HOU07:'property',HOU08:'business',
 FAMO03:'friends-meal',FAMO06:'market-review',FAMO08:'personal-budget',
 LATE01:'personal-budget',LATE02:'market-review',LATE03:'personal-budget',LATE04:'market-review',LATE05:'personal-budget',LATE06:'personal-budget',LATE07:'work-desk',LATE08:'market-review',
 ODD01:'market-review',ODD02:'personal-budget',ODD03:'personal-budget',ODD04:'personal-budget',ODD07:'personal-budget',ODD08:'personal-budget',
 HST02:'volatility-news',HST03:'contract-intro',HST04:'contract-intro',HST05:'volatility-news',HST06:'volatility-news',HST08:'volatility-news',HST10:'volatility-news',HST12:'account-frozen',HST13:'contract-intro',HST14:'volatility-news',HST15:'contract-intro',HST16:'volatility-news',HST17:'personal-budget',HST19:'volatility-news',HST21:'volatility-news',HST22:'fund-bond',HST23:'account-frozen',HST24:'account-frozen',
 PON04:'account-frozen',PON05:'personal-budget',PON07:'personal-budget',PON08:'personal-budget',
 CRY04:'market-review',CRY07:'market-review',CRY08:'fraud',
 'behavior:family_call':'family-call','behavior:family_exposed':'personal-budget','behavior:platform_withdraw':'account-frozen','behavior:work_warning':'work-desk','behavior:rebuild':'work-desk',
 'life:comfort':'personal-budget','life:pressure':'personal-budget','life:request':'personal-budget','life:promise_due':'personal-budget','life:disclosure':'family-call','life:response':'personal-budget'
};
export function storyArtKey(s,e,fallback){
 const id=e?.id||'';
 if(s?.legal?.prisonMonthsLeft>0&&(/^MAIN|^JAIL/.test(id)))return 'prison';
 if(e?.housingIntroduction)return 'housing-learning';
 if(e?.artKey)return e.artKey;
 if(/^ENC_JOB/.test(id))return 'work-desk';
 if(/^ENC_BIZ/.test(id))return 'personal-budget';
 if(/^ENC_/.test(id))return 'market-review';
 if(s&&id==='MAIN04'&&isCollegeStudent(s))return 'campus-arrival';
 if(s&&id==='MAIN05'&&s.education?.college&&s.age>=22)return 'graduation';
 if(OVERRIDES[id])return OVERRIDES[id];
 if(/^FND/.test(id))return 'fund-bond';
 if(/^OPT/.test(id))return s&&isCollegeStudent(s)?'options-intro':'options-study';
 if(/^FUT/.test(id))return 'contract-intro';
 if(/^STK/.test(id))return 'market-review';
 if(/^JOB|^RE0[12]/.test(id))return 'work-desk';
 if(/^DEB/.test(id))return 'personal-budget';
 if(id==='RE04')return 'family-adult';
 if(/^AGE(?:0[789]|10)B$/.test(id)||id==='AGE16B')return 'personal-budget';
 if(id==='AGE16A'||id==='AGE16C')return 'market-review';
 return fallback;
}
export function ageSafeArtKey(s,key,id=''){
 if(!s)return key==='family'?'personal-budget':key;
 if(key==='family'){
  if(id==='REL03'&&s.household?.hasChild)return key; // Here the young child is the player's child.
  if(s.age<6||s.age>=12||['F11','F12'].includes(s.familyId))key=s.age>=18&&s.age<40&&!['F11','F12'].includes(s.familyId)?'family-adult':'personal-budget';
 }
 if(key==='family-adult'&&(s.age>=40||s.household?.livingParent===false||['F11','F12'].includes(s.familyId)))return 'personal-budget';
 if(s.age>=40&&['relationships','friends-meal','property','venture','debt','work','crypto','casino','health','order-work','first-order-profit'].includes(key))return ['work','order-work','venture'].includes(key)?'work-desk':['crypto','casino'].includes(key)?'market-review':'personal-budget';
 return key;
}
