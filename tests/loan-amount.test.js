import test from 'node:test';
import assert from 'node:assert/strict';
import {loanAmountPresets,renderLoanAmount} from '../src/ui/loan-amount.js';

test('loan presets respect caps, including small remaining limits',()=>{
 assert.deepEqual(loanAmountPresets(4925340),[10000,50000,100000,300000,500000]);
 assert.deepEqual(loanAmountPresets(65000),[10000,50000]);
 assert.deepEqual(loanAmountPresets(534),[534]);
 for(const cap of [0,-1,NaN,Infinity,12.5])assert.deepEqual(loanAmountPresets(cap),[]);
});
test('loan amount remains editable without numeric steppers, with a selected preset',()=>{
 const html=renderLoanAmount({cap:100000,principal:50000},{money:n=>`¥${n/100}`});
 assert.match(html,/type="text" inputmode="decimal" value="500"/);assert.doesNotMatch(html,/type="number"|game-step/);
 assert.match(html,/data-amount="50000" aria-pressed="true"/);assert.match(html,/data-amount="10000" aria-pressed="false"/);
 assert.doesNotMatch(html,/data-amount="300000"/);
});
