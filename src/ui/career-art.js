import {CAREERS} from '../game/careers.js';
import {hasSalariedJob} from '../game/work-economy.js';
import {artVariant} from './dorm-art.js';

// The saved occupation selects the workplace; rendering never assigns a new job.
export function careerArt(s){
 const route=CAREERS[s?.career?.track];
 if(!s||!route||!hasSalariedJob(s))return null;
 const variant=artVariant(s,s.career.track);
 return {src:`./public/assets/careers/${route.scene}-${variant}-v1.webp`,alt:`${s.occupation}的工作场所 · ${route.name}`,location:'workplace',variant,environmentOnly:true};
}
