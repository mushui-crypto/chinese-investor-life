import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createPlayableRun} from '../src/game/quick-start.js';
import {skipBirth} from '../src/game/childhood.js';
import {isBirthIntro} from '../src/game/birth-story.js';
import {setSaveCatalog,decodeSave} from '../src/game/storage.js';
const out=process.env.QA_REPORT_DIR||'reports/v1.15/compat',archive=resolve('中国式赌狗-v1.14.2.zip'),dir=await mkdtemp(join(tmpdir(),'birth-compat-'));
async function catalog(root){const result={};for(const key of ['events','families','history','endings','characters']){const data=JSON.parse(await readFile(join(root,'data',key+'.json')));result[key]=key==='events'?data.events:data;}return result;}
try{
 execFileSync('python3',['-c',`import sys,zipfile,pathlib
root=pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(sys.argv[1]) as z:
 for name in z.namelist():
  parts=pathlib.PurePosixPath(name).parts
  if not parts: continue
  rel=pathlib.PurePosixPath(*parts[1:]) if parts[0] not in ('src','data','package.json') else pathlib.PurePosixPath(*parts)
  text=str(rel)
  if name.endswith('/') or not (text.startswith('src/game/') or text.startswith('data/') or text=='package.json'): continue
  target=(root/text).resolve()
  if root not in target.parents: raise ValueError('invalid archive path')
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
`,archive,dir]);
 const old=await import(pathToFileURL(join(dir,'src/game/quick-start.js'))),storage=await import(pathToFileURL(join(dir,'src/game/storage.js'))),narrative=await import(pathToFileURL(join(dir,'src/game/narrative.js'))),before=await catalog(dir),after=await catalog(resolve('.'));
 storage.setSaveCatalog(before);setSaveCatalog(after);const checks=[];
 for(const family of after.families)for(const path of ['birth','study','practical','social']){
  const options={seed:'birth-release-'+family.id,familyId:family.id,startAt:path==='birth'?'birth':'adult',childhood:path==='birth'?'study':path},prior=old.createPlayableRun(options,before),next=path==='birth'?skipBirth(createPlayableRun(options,after),after):createPlayableRun(options,after);
  for(const key of ['rng','age','turn','cash','adultGift','giftReceived','familyReserve','stats','ledger','debts','positions','actionPoints','marketProgress','relationships'])assert.deepEqual(next[key],prior[key],family.id+' '+path+' '+key);
  const migrated=decodeSave(JSON.stringify(storage.encodeSave(prior)));assert.equal(migrated.age,prior.age);assert.equal(migrated.cash,prior.cash);assert.equal(migrated.rng,prior.rng);assert.equal(migrated.childhood.birth,undefined);assert.ok(!isBirthIntro(migrated));checks.push(family.id+' '+path+' finances and old save preserved');
 }
 const oldBorn=narrative.createRun({seed:'old-newborn',familyId:'F01'},before),migrated=decodeSave(JSON.stringify(storage.encodeSave(oldBorn)));assert.equal(migrated.activeEvent.eventId,'MAIN01');assert.ok(!isBirthIntro(migrated));checks.push('legacy age-zero save keeps its original event');
 await mkdir(out,{recursive:true});await writeFile(join(out,'results.json'),JSON.stringify({passed:true,archive,checks},null,2));console.log('PASS',checks.length,'release comparisons');
}finally{await rm(dir,{recursive:true,force:true});}
