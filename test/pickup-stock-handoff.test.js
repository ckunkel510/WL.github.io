'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../Checkout2'),'utf8');
const start=source.indexOf('  function submittedPickupStockInstructions('),end=source.indexOf('  // WebTrack now receives',start);
function handoff({pickup=true,modal=true,yes=true,rows=[3],active=true,bypassed=false,aria=false}={}) {
 const doc={getElementById:id=>id==='stockModal'?modal?{classList:{contains:name=>name==='show'?active:name==='wl-auto-bypass'&&bypassed},getAttribute:()=>aria?'true':null,querySelector:()=>yes?{}:null,querySelectorAll:()=>rows.map(count=>({querySelectorAll:()=>Array(count).fill({})}))}:null:{checked:pickup}};
 const c=vm.createContext({});vm.runInContext(source.slice(start,end),c);return value=>c.submittedPickupStockInstructions(doc,value);
}
const request='PICKUP REQUEST at Caldwell — PARTIAL PICKUPS REQUESTED; first pickup for local quantities only; requested 2026-11-12 2:00 PM–3:00 PM; RANGER qty 12: 2 local, 7 transfer, 3 supplier order; contact customer to arrange remaining pickup(s) – Customer note';
test('a real native shortage confirmation retains the exact already-submitted pickup request',()=>{
 assert.equal(handoff()(request),request);
 assert.equal(handoff({active:false,bypassed:true})(request),request);
 assert.equal(handoff({active:false,aria:true})(request),request);
});
test('empty modal markup, normal details, other methods and legacy text cannot freeze editable instructions',()=>{
 for(const options of [{modal:false},{yes:false},{rows:[]},{rows:[0,2]},{pickup:false},{active:false}])assert.equal(handoff(options)(request),'');
 for(const value of ['', 'Pickup on 2026-11-12', 'PICKUP AVAILABILITY NOT YET VERIFIED'])assert.equal(handoff()(value),'');
});
const updateStart=source.indexOf('      function updateSpecial()'),updateEnd=source.indexOf('      function onShip()',updateStart);
test('reinitializing the async pickup panel cannot overwrite submitted notes or its saved date state during stock confirmation',()=>{
 let saves=0;
 const specialIns={value:request};const c=vm.createContext({isBuyNowFrame:()=>false,submittedPickupStockInstructions:()=>request,document:{},specialIns,saveDateState(){saves++;}});
 vm.runInContext(source.slice(updateStart,updateEnd),c);
 for(let i=0;i<3;i++)c.updateSpecial();
 assert.equal(specialIns.value,request);assert.equal(saves,0);
});
test('ordinary pickup edits continue to update native instructions and save their date state',()=>{
 let saves=0;const specialIns={value:request};
 const c=vm.createContext({isBuyNowFrame:()=>false,submittedPickupStockInstructions:()=>'',document:{},specialIns,rbPick:{checked:true},pickupInput:{value:'2026-11-13'},pickupTimeSel:{disabled:false,value:'2:00 PM–3:00 PM'},pickupDiv:{querySelector:()=>({value:'Test Person'})},pickupAvailability:{instruction:()=> 'PICKUP REQUEST at Caldwell; requested 2026-11-13'},specialExtra:{value:'New note'},cutToShipOrderInstruction:()=>'',saveDateState(){saves++;}});
 vm.runInContext(source.slice(updateStart,updateEnd),c);c.updateSpecial();
 assert.equal(specialIns.value,'PICKUP REQUEST at Caldwell; requested 2026-11-13; pickup person: Test Person – New note');assert.equal(saves,1);
});
