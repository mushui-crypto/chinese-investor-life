/** Apply the shared button and form layout to every dialog, including info panels. */
export function prepareDialogContent(root) {
 for (const button of root.querySelectorAll('button.text-button,button.inline-return')) {
  button.classList.remove('text-button','inline-return');
  button.classList.add('button','small');
 }
 for (const section of root.querySelectorAll('.behavior-hub > section')) {
  const heading = section.querySelector(':scope > h3');
  if (!heading || !['跟家人谈欠款','手机里的消息','重新过日子'].includes(heading.textContent)) continue;
  const details = document.createElement('details'), summary = document.createElement('summary');
  summary.textContent = heading.textContent;
  details.className = 'dialog-section';
  heading.remove();
  details.append(summary, ...section.childNodes);
  section.replaceWith(details);
 }
 for (const form of root.querySelectorAll('.dialog-body > form')) {
  const submit = form.querySelector(':scope > button[type="submit"]');
  if (!submit) continue;
  const actions = document.createElement('div');
  actions.className = 'dialog-form-actions';
  submit.before(actions);
  const error = form.querySelector(':scope > .form-error');
  if (error) actions.append(error);
  actions.append(submit);
 }
}
export function renderHelp(endings) {
 const chapters = [
  ['怎么开始', '从出生或 18 岁开始。读完当前故事，即可安排生活或交易。'],
  ['精力与操作', '精力上限 2 点，童年跨阶段、成年日结后恢复。学习、拜访等活动消耗精力；市场操作每天 6 次，单独计算。时段活动不消耗精力。'],
  ['买卖与行情', '选标的、填金额后下单，用顶部按钮推进时间。A 股 100 股一手，次日可卖；港股按手、美股按股，当日可卖。加密全天交易，日内合约每天结清。'],
  ['时间与账单', '首页选择生活重心，再推进到下一阶段。普通上课、上班与日常收支自动进行；遇到重要事件、还款、持仓变化或现金不足时停下。也可展开今天，亲自交易、睡觉或熬夜。'],
  ['现金不够怎么办', '可以打工、卖资产或借钱。生活费可用于梭哈，之后照常付账。阶段推进会在预计缺口前暂停。若主动带着缺口度过一天，基本伙食不足会扣健康；健康 ≤30 需要就医，降至 0 本局结束。'],
  ['成长与结局', `童年依次经历出生、3 岁幼儿园、6 岁小学、12 岁初中、15 岁高中；每阶段有 2 点精力选择成长习惯。18 岁按学业、自律等属性决定升学，四年制本科在 22 岁毕业；在读只能做兼职。成年共 34 个章节，18–36 岁每年、36–60 岁每两年、60–80 岁每五年推进；半年或年度账期在阶段中自动结算。55 岁起能回顾人生，回顾后仍可继续到 80 岁；生存失败会结束本局。共有 ${endings} 种后记。`],
  ['存档与快捷键', '有效操作后自动保存。换浏览器或设备前，在“人生档案”导出备份。数字 1 / 2 / 3 选择故事选项，Esc 关闭弹窗。']
 ];
 return `<div class="dialog-help">${chapters.map(([title,body],i)=>`<details ${i===0?'open':''}><summary>${title}</summary><p>${body}</p></details>`).join('')}</div><div class="dialog-footer"><button class="button" data-action="playtest">试玩反馈</button><button class="button primary" data-action="close-dialog">继续游戏</button></div>`;
}
