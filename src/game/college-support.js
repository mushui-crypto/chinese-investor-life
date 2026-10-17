import {isCollegeStudent} from './education.js';
import {gameDate,validGameDate} from './game-calendar.js';

export const COLLEGE_MONTHLY_SUPPORT=200000; // Integer cents: family living allowance.
export const newCollegeSupport=()=>({version:1,lastPaidMonth:null,totalPaid:0});
export function collegeSupportStatus(s,date=gameDate(s),{age=s.age,prison=Boolean(s.legal?.prisonMonthsLeft)}={}){
 const eligible=isCollegeStudent({...s,age})&&!prison,month=date.slice(0,7);
 const due=eligible&&(!s.collegeSupport?.lastPaidMonth||s.collegeSupport.lastPaidMonth<month)?COLLEGE_MONTHLY_SUPPORT:0;
 const [year,m]=month.split('-').map(Number),nextMonth=new Date(Date.UTC(year,m,1)).toISOString().slice(0,10);
 return {monthly:eligible?COLLEGE_MONTHLY_SUPPORT:0,due,nextPayday:eligible?(due?date:nextMonth):null,totalPaid:s.collegeSupport?.totalPaid||0};
}
// First settlement in a new month pays once. Legacy saves start in the current
// month, without replaying past months or debiting the family's emergency savings.
export function settleCollegeSupport(s,api,{date=gameDate(s),age=s.age,prison=Boolean(s.legal?.prisonMonthsLeft)}={}){
 const {due}=collegeSupportStatus(s,date,{age,prison});if(!due)return 0;
 const p=s.collegeSupport??=newCollegeSupport();
 api.cashChange(s,due,`${date.slice(0,7)} 家庭生活费 · ${date} 到账`);
 p.lastPaidMonth=date.slice(0,7);p.totalPaid+=due;return due;
}
export function validateCollegeSupport(s){
 const p=s.collegeSupport;if(p===undefined)return;
 const bad=()=>{throw Error('存档中的大学生活费记录无效');};
 if(!p||p.version!==1||!Number.isSafeInteger(p.totalPaid)||p.totalPaid<0||p.totalPaid%COLLEGE_MONTHLY_SUPPORT)bad();
 if(p.lastPaidMonth===null){if(p.totalPaid!==0)bad();return;}
 if(typeof p.lastPaidMonth!=='string'||!/^\d{4}-\d{2}$/.test(p.lastPaidMonth)||!validGameDate(p.lastPaidMonth+'-01')||p.lastPaidMonth>gameDate(s).slice(0,7)||p.totalPaid===0)bad();
}
