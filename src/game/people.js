/** Only record encounters that have actually been shown or resolved. */
export const PERSON_NAMES = {N01:'阿豪',N02:'林夏',N03:'许舟',N04:'老周',N05:'陈经理',N06:'金老师',N07:'赵姨',N08:'杜衡',N09:'小满',N10:'父母或照护者',N11:'沈岚',N12:'吴师傅'};
export const hasMetPerson = (s,id) => Boolean(s.peopleMet?.includes(id));
export function meetPerson(s,id) {
  if (!Object.hasOwn(PERSON_NAMES,id)) return;
  s.peopleMet ??= ['N10'];
  if (!s.peopleMet.includes(id)) s.peopleMet.push(id);
}
export function storyPeople(event, resolvedText='') {
  const text = [event?.title,event?.prompt,...(event?.choices||[]).map(c=>c.label),resolvedText].join(' ');
  return Object.entries(PERSON_NAMES).filter(([id,name])=>event?.character_ids?.includes(id)||text.includes(name)).map(([id])=>id);
}
export function meetStoryPeople(s,event,resolvedText='') {
  for (const id of storyPeople(event,resolvedText)) meetPerson(s,id);
}
export function personRelation(s,id) {
  const alias={N02:'partner',N09:'child',N10:'family'}[id];
  return s.relationships[id] ?? s.relationships[alias] ?? 50;
}
export function setPersonRelation(s,id,value) {
  s.relationships[id]=Math.max(0,Math.min(100,value));
  const alias=id==='N10'?'family':id==='N02'&&s.household.partner?'partner':id==='N09'&&s.household.hasChild?'child':null;
  if(alias) s.relationships[alias]=s.relationships[id];
}
export function validatePeople(s,events) {
  // Legacy migration reads played history, never queued events or future outcomes.
  if(s.peopleMet===undefined) {
    s.peopleMet=['N10'];
    for(const id of s.seenEvents||[]) meetStoryPeople(s,events.get(id));
    for(const h of s.storyHistory||[]) meetStoryPeople(s,events.get(h.eventId),h.text);
    if(s.activeEvent) meetStoryPeople(s,events.get(s.activeEvent.eventId));
    for(const id of Object.keys(PERSON_NAMES)) if(s.lifeArcs?.memories?.[id]?.length || s.lifeArcs?.visits?.[id]!==undefined || s.relationships[id]!==undefined) meetPerson(s,id);
    for(const p of s.lifeArcs?.promises||[]) meetPerson(s,p.id);
    if(s.household.partner) meetPerson(s,'N02');
    if(s.household.hasChild) meetPerson(s,'N09');
  }
  if(!Array.isArray(s.peopleMet)||s.peopleMet.length>12||new Set(s.peopleMet).size!==s.peopleMet.length||s.peopleMet.some(id=>!Object.hasOwn(PERSON_NAMES,id))) throw Error('存档中的已认识人物记录无效');
}
