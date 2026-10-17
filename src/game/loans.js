/** Fictional single-player borrowing terms, not real credit products. Money is cents. */
export const LOAN_TYPES = {
 family: {name:'亲友借款',label:'找家人周转',aprBps:0,months:36,feeBps:0,icon:'home',consequence:'动用家庭储备，人缘 −2；还本金会补回家中储备。'},
 friend: {name:'朋友借款',label:'向朋友开口',aprBps:0,months:12,feeBps:0,icon:'people',consequence:'不动用家庭储备，人缘 −4；逾期会继续损伤人缘。'},
 bank: {name:'银行贷款',label:'银行贷款',aprBps:800,months:24,feeBps:0,icon:'wallet',consequence:'需要收入、信用和还款能力；逾期扣信用、增加压力。'},
 net: {name:'消费网贷',label:'撸网贷',aprBps:1800,months:12,feeBps:0,icon:'coin',consequence:'需要收入与可用授信；借来的本金和利息都要还。'},
 card: {name:'信用卡套现欠款',label:'信用卡套现',aprBps:2400,months:6,feeBps:500,icon:'wallet',risky:true,consequence:'到账先扣 5% 费用，信用 −8；本金按申请额记，逾期继续扣信用。'},
 shark: {name:'高利贷欠款',label:'借高利贷',aprBps:7200,months:3,feeBps:1000,icon:'help',risky:true,consequence:'到账先扣 10% 费用，额外压力 +12、健康 −2；逾期触发催收剧情。'}
};

export function loanTerms(kind,amount) {
 const meta=LOAN_TYPES[kind];
 if(!Object.hasOwn(LOAN_TYPES,kind)||!Number.isSafeInteger(amount)||amount<=0)throw Error('借款类型或金额无效');
 const fee=Math.round(amount*meta.feeBps/10000),net=amount-fee;
 return {...meta,kind,principal:amount,fee,net,firstPayment:Math.ceil(amount/meta.months)+Math.round(amount*meta.aprBps/10000/12)};
}
