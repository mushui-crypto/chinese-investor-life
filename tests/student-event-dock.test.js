import test from 'node:test';
import assert from 'node:assert/strict';
import {usesStudentEventDock} from '../src/ui/student-event-dock.js';
import {renderEventIntro} from '../src/ui/event-art.js';

test('teen everyday stories stay in the dock before and after choosing; milestones keep their scene',()=>{
 for(const id of ['MAIN03','AGE16A','FAM07','STU_A3','STU_H5']){
  assert.equal(usesStudentEventDock({age:16,phase:'event',activeEvent:{eventId:id}}),true);
  assert.equal(usesStudentEventDock({age:16,phase:'result',lastResult:{eventId:id}}),true);
 }
 for(const s of [{age:18,phase:'event',activeEvent:{eventId:'MAIN04'}},{age:10,phase:'event',activeEvent:{eventId:'STU_A2'}},{age:17,phase:'event',activeEvent:{eventId:'MAIN04'}},{age:16,phase:'planning',lastResult:{eventId:'FAM07'}}])assert.equal(usesStudentEventDock(s),false);
 const e={id:'FAM07',title:'妈妈的铁盒',prompt:'里面是留给急事的零钱。'};
 const text=renderEventIntro(e,{esc:String,compact:true});assert.match(text,/妈妈的铁盒/);assert.match(text,/零钱/);assert.doesNotMatch(text,/<img|event-illustration/);
 assert.match(renderEventIntro(e,{esc:String}),/event-illustration/);
});
