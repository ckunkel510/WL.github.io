'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../BuyNowPilot');
const item={pid:'85',code:'0001363',name:'Fish food',quantity:2};
const stores=['Brenham','Bryan','Caldwell','Lexington','Groesbeck','Mexia','Buffalo'];
const inventory=(local,other)=>({verified:true,branches:Object.fromEntries(stores.map(name=>[name,name==='Caldwell'?local:name==='Groesbeck'?other:0]))});
const tuesday=new Date('2026-10-20T15:00:00Z'); // 10 AM in Texas
function plan(stock,now=tuesday,items=[item],label='Caldwell - 702 W Buck St') { return core.pickupReadiness(items,{'85':stock},label,now); }
test('pickup uses the business date in Texas even when UTC has crossed midnight',()=>{
 assert.deepEqual(core.centralCalendar(new Date('2026-10-21T00:30:00Z')),{date:'2026-10-20',minutes:1170});
 assert.deepEqual(core.centralCalendar(new Date('2026-11-02T00:30:00Z')),{date:'2026-11-01',minutes:1110});
});
test('transfers allow three full business days, including weekend and DST boundaries',()=>{
 assert.equal(core.calendarAfter('2026-10-20',3,true),'2026-10-23');
 assert.equal(core.calendarAfter('2026-10-23',3,true),'2026-10-28');
 assert.equal(core.calendarAfter('2026-10-24',3,true),'2026-10-28');
 assert.equal(core.calendarAfter('2026-10-30',3,true),'2026-11-04');
});
test('pickup stock is specific to the selected store and requested quantity',()=>{
 const partial=plan(inventory(1,5));assert.equal(partial.items[0].state,'transfer');assert.equal(partial.min,'2026-10-23');assert.equal(partial.items[0].local,1);
 const enough=plan(inventory(2,5));assert.equal(enough.items[0].state,'local');assert.equal(enough.min,'2026-10-20');
 const changed=plan(inventory(0,5),tuesday,[item],'Groesbeck - Store address');assert.equal(changed.items[0].state,'local');assert.equal(changed.min,'2026-10-20');
});
test('mixed carts wait for the slowest line rather than promising next morning for all items',()=>{
 const other={pid:'22628',code:'BHG',name:'Humus',quantity:1};
 const result=core.pickupReadiness([item,other],{'85':inventory(0,8),'22628':inventory(12,0)},'Caldwell',tuesday);
 assert.equal(result.items[0].state,'transfer');assert.equal(result.items[1].state,'local');assert.equal(result.min,'2026-10-23');assert.equal(result.confirmation,true);
});
test('stock which is insufficient companywide requires supplier confirmation, not a three-day transfer promise',()=>{
 const result=plan(inventory(0,1));assert.equal(result.items[0].state,'supplier');assert.equal(result.min,'2026-10-29');assert.equal(result.confirmation,true);
});
test('pending, failed, incomplete and unknown-store stock cannot claim local availability',()=>{
 assert.equal(plan(undefined).checking,true);
 for(const stock of [null,{verified:false,branches:{}},inventory(4,0)]) {
  const result=plan(stock,tuesday,[item],stock?.verified?'Unknown store':'Caldwell');
  assert.equal(result.items[0].state,'unconfirmed');assert.equal(result.min,'2026-10-23');assert.equal(result.confirmation,true);
 }
});
test('late-day pickup rolls to an open day; same-day windows keep two-hour preparation time',()=>{
 const times=core.pickupTimeChoices('2026-10-20',tuesday);assert.equal(times[0].value,'12:00 PM–1:00 PM');
 assert.equal(core.pickupTimeChoices('2026-10-25',tuesday).length,0);
 assert.equal(core.pickupTimeChoices('2026-10-19',tuesday).length,0);
 assert.equal(plan(inventory(5,0),new Date('2026-10-24T20:00:00Z')).min,'2026-10-26');
 const saturday=core.pickupTimeChoices('2026-10-24',tuesday);assert.equal(saturday.at(-1).value,'3:00 PM–4:00 PM');
});
function stockPage(values){return {querySelectorAll:()=>values.map(([name,amount])=>({querySelector:selector=>({textContent:selector.includes('Branch')?name:amount})}))};}
test('inventory parser uses labeled branch/available cells and rejects partial, duplicate or malformed quantities',()=>{
 const rows=stores.map(name=>[name,name==='Caldwell'?'1,234':'0']);
 const parsed=core.stockFromDocument(stockPage(rows));assert.equal(parsed.verified,true);assert.equal(parsed.branches.Caldwell,1234);
 assert.equal(core.stockFromDocument(stockPage(rows.slice(1))).verified,false);
 assert.equal(core.stockFromDocument(stockPage(rows.concat([['Caldwell','2']]))).verified,false);
 assert.equal(core.stockFromDocument(stockPage(rows.map(r=>r[0]==='Caldwell'?['Caldwell','NA']:r))).verified,false);
});
test('reusing native details for an in-stock store removes the previous transfer floor while retaining native bounds',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
 const start=source.indexOf('          var dateInput = page.getElementById('),end=source.indexOf('          var chosenDate =',start);
 for(const nativeMin of ['2026-10-20','2026-10-22']) {
  const input={min:nativeMin,max:'2026-11-03',dataset:{}},fast={method:'pickup',pickupReadiness:{min:'2026-10-23'}};
  const context=vm.createContext({page:{getElementById:()=>input},fast,updatePickupReadiness(){},status(){throw Error('Unexpected wait');}});
  vm.runInContext('(function(){'+source.slice(start,end)+'})()',context);
  assert.equal(input.min,'2026-10-23');
  fast.pickupReadiness.min='2026-10-21';
  vm.runInContext('(function(){'+source.slice(start,end)+'})()',context);
  assert.equal(input.min,nativeMin==='2026-10-22'?'2026-10-22':'2026-10-21');assert.equal(fast.dateMin,input.min);
 }
});
