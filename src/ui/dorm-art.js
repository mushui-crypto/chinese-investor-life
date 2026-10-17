import {isCollegeStudent} from '../game/education.js';

// Two authored scenes per activity. Choosing art never consumes gameplay RNG.
export const DORM_KINDS=['study-day','study-night','market-day','market-night','rest','call','meal','bedtime','sleep','wake-fresh','wake-alarm','wake-late','gambling','profit','loss','frozen'];
const descriptions={
 'study-day':'白天，大学生在上床下桌的宿舍书桌前读书做笔记',
 'study-night':'夜里，大学生在宿舍高架床下的书桌前开灯复习',
 'market-day':'白天，大学生在宿舍高架床下查看行情，尚未确定盈亏',
 'market-night':'深夜，大学生在上床下桌的宿舍里看行情，其他床位已经拉上帘子',
 rest:'白天，大学生靠在宿舍书桌前的椅子上休息，高架床在上方',
 call:'大学生坐在宿舍高架床下接听电话',meal:'大学生在宿舍高架床下的书桌前吃简单的早餐',
 bedtime:'大学生坐在宿舍高架床护栏内收好手机，准备睡觉',sleep:'大学生在宿舍上铺睡觉，下方是熄灯的书桌',
 'wake-fresh':'早晨，大学生在宿舍上铺精神饱满地醒来',
 'wake-alarm':'早晨，没睡够的大学生在宿舍上铺被闹钟叫醒',
 'wake-late':'接近中午，大学生在宿舍上铺醒来，发现自己睡过头',
 gambling:'深夜，大学生在宿舍书桌前查看室友发来的网赌链接',
 profit:'大学生在宿舍书桌前核对已结算盈利的回单，神情放松',
 loss:'大学生在宿舍书桌前核对已结算亏损的回单，神情担忧',
 frozen:'宿舍高架床下的电脑显示提现暂停，资金暂时无法取出'
};
export function artVariant(s,salt=''){
 const hash=[...salt].reduce((n,c)=>(n+c.charCodeAt(0))%2,0);
 return 1+((Math.trunc(s?.trading?.day??s?.debtClock?.day??0)+Math.trunc(s?.turn??0)+hash)%2);
}
export function dormArt(s,kind,salt=''){
 if(!isCollegeStudent(s)||!DORM_KINDS.includes(kind))return null;
 const variant=artVariant(s,salt||kind);
 const upperBed=['bedtime','sleep','wake-fresh','wake-alarm','wake-late'].includes(kind);
 return {src:`./public/assets/dorm/${kind}-${variant}-v1.webp`,alt:descriptions[kind],location:'dorm',variant,focalY:upperBed?0:45};
}
export function dormDailyArt(s,key,stage=0){
 const kind={breakfast:'meal','home-trading':stage>=5?'market-night':'market-day',night:'market-night',slack:'market-day',
 'study-day':'study-day',study:'study-night','study-night':'study-night','job-search':'study-day',rest:'rest',
 phone:'call','phone-day':'call','phone-night':'call',bedtime:'bedtime',sleep:'sleep'}[key];
 return kind?dormArt(s,kind):null;
}
