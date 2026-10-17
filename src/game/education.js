export const EDUCATION_VERSION = 1;
export const COLLEGE_GRADUATION_AGE = 22;
export const COLLEGE_JOB_REASON = '大学在读，22 岁毕业后可正式求职；现在可以做兼职';

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function newEducation() {
  return {
    version: EDUCATION_VERSION,
    legacy: false,
    college: null,
    admissionScore: null,
    stockAwarenessAge: null,
    cryptoAwarenessAge: null,
    gamblingExposureAge: null,
    ponziExposureAge: null,
    graduated: false,
  };
}

export function ensureLearningStats(state) {
  state.stats ??= {};
  if (!Number.isFinite(state.stats.academic)) state.stats.academic = Math.round(clamp((state.stats.skill ?? 10) * .6 + (state.stats.insight ?? 10) * .4));
  if (!Number.isFinite(state.stats.discipline)) state.stats.discipline = Math.round(clamp(35 + ((state.stats.credit ?? 60) - 50) * .2 - ((state.stats.stress ?? 20) - 20) * .1));
  return state.stats;
}

export const isCollegeStudent=s=>s.age>=18&&s.age<COLLEGE_GRADUATION_AGE&&s.education?.college===true;

export function educationStage(state) {
  const age = state.age;
  if (age < 3) return { id: 'preschool', name: '学龄前', range: '0–2 岁' };
  if (age < 6) return { id: 'kindergarten', name: '幼儿园', range: '3–5 岁' };
  if (age < 12) return { id: 'primary', name: '小学', range: '6–11 岁' };
  if (age < 15) return { id: 'middle', name: '初中', range: '12–14 岁' };
  if (age < 18) return { id: 'high', name: '高中', range: '15–17 岁' };
  if (age < 22) return state.education?.college
    ? { id: 'college', name: '大学', range: '18–21 岁' }
    : { id: 'society', name: '社会起步', range: '18–21 岁' };
  return state.education?.college
    ? { id: 'graduate', name: '大学毕业后', range: '22 岁起' }
    : { id: 'adult', name: '成年生活', range: '22 岁起' };
}

export function collegeAdmissionScore(state) {
  const stats = ensureLearningStats(state);
  return Math.round(clamp(
    stats.academic * .55 + stats.discipline * .2 + stats.skill * .1 + stats.insight * .1 + stats.health * .1 - stats.stress * .15,
    0,
    100,
  ));
}

export function advanceEducation(state, fromAge, toAge) {
  const education = state.education ??= newEducation();
  if (fromAge < 16 && toAge >= 16) {
    state.flags.stock_aware = true;
    education.stockAwarenessAge ??= 16;
  }
  if (fromAge < 18 && toAge >= 18 && education.college === null) {
    education.admissionScore = collegeAdmissionScore(state);
    education.college = education.admissionScore >= 38;
    state.flags.college_student = education.college;
    state.flags.college_not_admitted = !education.college;
    state.occupation = education.college ? '大学生' : '待业青年';
  }
  if (fromAge < COLLEGE_GRADUATION_AGE && toAge >= COLLEGE_GRADUATION_AGE && education.college) {
    education.graduated = true;
    state.flags.college_student = false;
    state.flags.college_graduate = true;
    if (state.occupation === '大学生') state.occupation = '应届毕业生';
  }
  if (toAge < 18) state.occupation = educationStage(state).name;
}

export function recordEducationEvent(state, eventId) {
  const education = state.education ??= newEducation();
  if (eventId.startsWith('AGE16')) {
    state.flags.stock_aware = true;
    education.stockAwarenessAge ??= state.age;
  }
  if (eventId.startsWith('AGE18')) {
    state.flags.crypto_aware = true;
    education.cryptoAwarenessAge ??= state.age;
  }
  if (eventId.startsWith('AGE20')) {
    state.flags.gambling_exposed = true;
    education.gamblingExposureAge ??= state.age;
  }
  if (eventId.startsWith('AGE24')) {
    state.flags.ponzi_exposed = true;
    education.ponziExposureAge ??= state.age;
  }
}

export function validateEducation(state) {
  ensureLearningStats(state);
  if (state.education === undefined) {
    const education = newEducation();
    education.legacy = true;
    if (state.age >= 16) {
      state.flags.stock_aware = true;
      education.stockAwarenessAge = 16;
    }
    if (state.age >= 18) {
      state.flags.crypto_aware = true;
      education.cryptoAwarenessAge = 18;
    }
    if (state.age >= 20) {
      state.flags.gambling_exposed = true;
      education.gamblingExposureAge = 20;
    }
    if (state.age >= 24) {
      state.flags.ponzi_exposed = true;
      education.ponziExposureAge = 24;
    }
    state.education = education;
  }
  const education = state.education;
  const bad = () => { throw Error('教育阶段记录无效'); };
  if (!education || education.version !== EDUCATION_VERSION || typeof education.legacy !== 'boolean' || ![null, true, false].includes(education.college) || typeof education.graduated !== 'boolean') bad();
  if (education.admissionScore !== null && (!Number.isSafeInteger(education.admissionScore) || education.admissionScore < 0 || education.admissionScore > 100)) bad();
  for (const key of ['stockAwarenessAge', 'cryptoAwarenessAge', 'gamblingExposureAge', 'ponziExposureAge']) {
    const age = education[key];
    if (age !== null && (!Number.isFinite(age) || age < 0 || age > state.age)) bad();
  }
  if (education.college === true && state.age >= 18 && !education.legacy && !state.flags.college_student && !state.flags.college_graduate) bad();
  if (education.college === false && state.age >= 18 && !education.legacy && !state.flags.college_not_admitted) bad();
  return education;
}
