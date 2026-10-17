// Existing outcomes stay locked. Only newly authored choices get a stable outcome
// during the v1.61 -> v1.62 migration; no gameplay RNG, money or history is changed.
const legacyChoices={"REL02":{"REL02_1":["REL02_1_1","REL02_1_2"],"REL02_2":["REL02_2_1"],"REL02_3":["REL02_3_1"],"REL02_CL1":["REL02_CL1_quiet"]},"ENC_JOB03":{"ENC_JOB03_1":["ENC_JOB03_1_1"],"ENC_JOB03_2":["ENC_JOB03_2_1"],"ENC_JOB03_3":["ENC_JOB03_3_1"],"ENC_JOB03_CL1":["ENC_JOB03_CL1_quiet"]},"CL22":{"CL22_1":["CL22_1_quiet"],"CL22_2":["CL22_2_quiet"],"CL22_3":["CL22_3_quiet"],"CL22_4":["CL22_4_quiet"]},"CL23":{"CL23_1":["CL23_1_quiet"],"CL23_2":["CL23_2_quiet"],"CL23_3":["CL23_3_quiet"],"CL23_4":["CL23_4_quiet"]},"CL24":{"CL24_1":["CL24_1_quiet"],"CL24_2":["CL24_2_quiet"],"CL24_3":["CL24_3_quiet"],"CL24_4":["CL24_4_quiet"]},"CL25":{"CL25_1":["CL25_1_quiet"],"CL25_2":["CL25_2_quiet"],"CL25_3":["CL25_3_quiet"],"CL25_4":["CL25_4_quiet"]},"CL26":{"CL26_1":["CL26_1_quiet"],"CL26_2":["CL26_2_quiet"],"CL26_3":["CL26_3_quiet"],"CL26_4":["CL26_4_quiet"]},"CL27":{"CL27_1":["CL27_1_quiet"],"CL27_2":["CL27_2_quiet"],"CL27_3":["CL27_3_quiet"],"CL27_4":["CL27_4_quiet"]},"CL28":{"CL28_1":["CL28_1_quiet"],"CL28_2":["CL28_2_quiet"],"CL28_3":["CL28_3_quiet"],"CL28_4":["CL28_4_quiet"]},"CL29":{"CL29_1":["CL29_1_quiet"],"CL29_2":["CL29_2_quiet"],"CL29_3":["CL29_3_quiet"],"CL29_4":["CL29_4_quiet"]},"CL30":{"CL30_1":["CL30_1_quiet"],"CL30_2":["CL30_2_quiet"],"CL30_3":["CL30_3_quiet"],"CL30_4":["CL30_4_quiet"]},"CL31":{"CL31_1":["CL31_1_quiet"]},"CL42":{"CL42_1":["CL42_1_quiet"],"CL42_2":["CL42_2_quiet"],"CL42_3":["CL42_3_quiet"]}};
export function migrateSchemeStoryChoices(s,event){
 if(s.behavior?.cryptoLife?.schemeLife||!s.activeEvent||!legacyChoices[event?.id])return;
 const outcomes=s.activeEvent.outcomes,legacy=legacyChoices[event.id];
 if(!outcomes||Object.keys(outcomes).length!==Object.keys(legacy).length)return;
 if(Object.entries(legacy).some(([id,allowed])=>!allowed.includes(outcomes[id])))return;
 for(const choice of event.choices){
  if(Object.hasOwn(outcomes,choice.id)||!choice.schemeAction)continue;
  let h=2166136261;for(const c of `${s.seed}:${s.activeEvent.instanceId||event.id}:${choice.id}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  const total=choice.outcomes.reduce((n,o)=>n+o.weight,0);let roll=(h>>>0)/4294967296*total;
  outcomes[choice.id]=choice.outcomes.find(o=>(roll-=o.weight)<0)?.id||choice.outcomes.at(-1).id;
 }
}
