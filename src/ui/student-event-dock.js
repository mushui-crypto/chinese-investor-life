import {isTeenStory} from '../game/teen-stories.js';
import {isStudentStory} from '../game/student-stories.js';

// School side stories share the bottom interaction area. Life milestones keep art.
export function usesStudentEventDock(s){
 if(!s||s.age<12||s.age>=18||!['event','result'].includes(s.phase))return false;
 const id=s.phase==='event'?s.activeEvent?.eventId:s.lastResult?.eventId;
 return isTeenStory(id)||isStudentStory(id);
}

export function usesOnlineEventDock(s){
 if(!s||s.age<18||!['event','result'].includes(s.phase))return false;
 const id=s.phase==='event'?s.activeEvent?.eventId:s.lastResult?.eventId;
 return /^OG(?:0[1-9]|1[0-9]|2[0-7])$/.test(id||'');
}

export function usesCryptoEventDock(s){
 if(!s||s.age<18||!['event','result'].includes(s.phase))return false;
 const id=s.phase==='event'?s.activeEvent?.eventId:s.lastResult?.eventId;
 return /^(?:CL(?:0[1-9]|[1-3][0-9]|4[0-2])|SL[0-9]{2})$/.test(id||'');
}
