/** Fictional narrative consequences only. These are game rules, not real sentencing rules. */
export const LEGAL_TYPES = Object.freeze({
  gambling: { name: '参与网络赌博', criminal: false, fineYuan: 1500, restitutionYuan: 0, sentenceMonths: 0 },
  misleading_ads: { name: '误导性营销', criminal: false, fineYuan: 18000, restitutionYuan: 12000, sentenceMonths: 0 },
  gambling_promotion: { name: '主动组织推广网络赌博', criminal: true, fineYuan: 60000, restitutionYuan: 40000, sentenceMonths: 30 },
  account_rental: { name: '明知而出租账户协助犯罪', criminal: true, fineYuan: 30000, restitutionYuan: 60000, sentenceMonths: 18 },
  fraud: { name: '主动参与欺诈项目', criminal: true, fineYuan: 150000, restitutionYuan: 200000, sentenceMonths: 60 },
  data_resale: { name: '明知而转卖个人数据', criminal: true, fineYuan: 50000, restitutionYuan: 30000, sentenceMonths: 24 },
  illegal_fundraising: { name: '主动参与非法集资', criminal: true, fineYuan: 200000, restitutionYuan: 300000, sentenceMonths: 72 },
});
export function createLegalState() { return { cases: [], prisonMonthsLeft: 0, totalPrisonMonths: 0, servedPrisonMonths: 0, releaseCount: 0 }; }
function money(n) { if (!Number.isSafeInteger(n) || n < 0) throw Error('案件金额或期限格式无效'); return n; }
function add(a, b) { return money(a + money(b)); }
export function getLegalStatus(state) {
  const legal = state.legal || createLegalState();
  const debts = (state.debts || []).filter(debt => debt.kind === 'legal');
  const total = component => debts.filter(debt => !component || debt.legalComponent === component).reduce((n, debt) => add(n, add(debt.principal, debt.interest)), 0);
  return {
    ...legal, inPrison: legal.prisonMonthsLeft > 0,
    underInvestigation: legal.cases.some(item => item.status === 'exposed' || item.status === 'investigating'),
    legalDebt: total(), unpaidPenalty: total('fine'), unpaidRestitution: total('restitution'), unpaidConfiscation: total('confiscation'),
  };
}
/** Shared by the transactional core and save-file validation. */
export function validateLegalState(legal, state) {
  if (!legal || typeof legal !== 'object' || Array.isArray(legal) || !Array.isArray(legal.cases) || legal.cases.length > 1000) throw Error('案件记录缺失或无效');
  for (const key of ['prisonMonthsLeft', 'totalPrisonMonths', 'servedPrisonMonths', 'releaseCount']) money(legal[key]);
  if (legal.prisonMonthsLeft + legal.servedPrisonMonths !== legal.totalPrisonMonths) throw Error('服刑期限账目不一致');
  const seen = new Set();
  let sentenced = 0;
  for (const c of legal.cases) {
    if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.id !== 'string' || !c.id || seen.has(c.id) || !LEGAL_TYPES[c.type]) throw Error('案件编号或种类无效');
    seen.add(c.id);
    if (!['pending', 'exposed', 'investigating', 'convicted', 'admin_closed'].includes(c.status)) throw Error('案件阶段无效');
    for (const key of ['profit', 'fine', 'restitution', 'confiscation', 'sentenceMonths', 'openedTurn', 'exposedTurn', 'investigatingTurn', 'resolutionTurn']) money(c[key]);
    if (c.openedTurn > state.turn || c.exposedTurn !== c.openedTurn + 2 || c.investigatingTurn !== c.openedTurn + 3 || c.resolutionTurn !== c.openedTurn + 4) throw Error('案件预约时序无效');
    if (typeof c.cooperated !== 'boolean' || typeof c.settled !== 'boolean' || typeof c.criminal !== 'boolean') throw Error('案件标记无效');
    if (c.sourceEventId !== null && typeof c.sourceEventId !== 'string') throw Error('案件来源无效');
    if (c.resolvedTurn !== null) { money(c.resolvedTurn); if (c.resolvedTurn > state.turn) throw Error('案件裁定日期无效'); }
    if (c.criminal !== LEGAL_TYPES[c.type].criminal || c.sentenceMonths !== LEGAL_TYPES[c.type].sentenceMonths || c.confiscation !== c.profit) throw Error('案件责任条款无效');
    const final = ['convicted', 'admin_closed'].includes(c.status);
    if (final !== c.settled || (final && (c.resolvedTurn === null || c.resolvedTurn < c.resolutionTurn)) || (!final && c.resolvedTurn !== null)) throw Error('案件结算状态无效');
    if ((c.status === 'convicted' && !c.criminal) || (c.status === 'admin_closed' && c.criminal)) throw Error('行政和刑事案件类型不符');
    if (c.status === 'convicted') sentenced = add(sentenced, c.sentenceMonths);
  }
  if (sentenced !== legal.totalPrisonMonths) throw Error('已裁定刑期与服刑记录不一致');
  for (const d of state.debts || []) if (d.kind === 'legal') {
    if (!seen.has(d.legalCaseId) || !['fine', 'restitution', 'confiscation'].includes(d.legalComponent)) throw Error('法律责任债务缺少有效案件来源');
    if (!legal.cases.find(c => c.id === d.legalCaseId)?.settled) throw Error('未裁定案件不能提前扣款');
  }
  getLegalStatus({ ...state, legal });
  return legal;
}
