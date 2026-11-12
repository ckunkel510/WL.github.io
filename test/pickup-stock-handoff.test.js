'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../Checkout2'),'utf8');
const start=source.indexOf('  function pickupStockInstructionKeeper('),end=source.indexOf('  // WebTrack now receives',start);
const request='PICKUP REQUEST at Caldwell — PARTIAL PICKUPS REQUESTED; first pickup for local quantities only; requested 2026-11-12 3:00 PM–4:00 PM; RANGER qty 12: 2 local, 7 transfer, 3 supplier order; contact customer to arrange remaining pickup(s) – Customer note';
function fixture(value=request,pickup=true) {
 const field={value},radio={checked:pickup},nodes={field},doc={getElementById:id=>id.includes('SpecialInstructions')?nodes.field:radio},c=vm.createContext({});vm.runInContext(source.slice(start,end),c);
 return {field,radio,nodes,keeper:c.pickupStockInstructionKeeper(doc,field)};
}
test('server-returned pickup request survives loading and whole-order UI updates before modal activation',()=>{
 const f=fixture();f.field.value='PICKUP AVAILABILITY NOT YET VERIFIED';f.field.value='PICKUP REQUEST at Caldwell — HOLD FOR ONE COMPLETE PICKUP; requested';
 assert.equal(f.keeper.restore(),true);assert.equal(f.field.value,request);
});
test('a deliberate same-document Continue captures the latest edited request',()=>{
 const f=fixture('');f.field.value=request;f.keeper.capture();f.field.value='PICKUP AVAILABILITY NOT YET VERIFIED';
 assert.equal(f.keeper.restore(),true);assert.equal(f.field.value,request);
 const edited=request.replace('3:00 PM–4:00 PM','4:00 PM–5:00 PM');f.field.value=edited;f.keeper.capture();f.field.value='async replacement';f.keeper.restore();assert.equal(f.field.value,edited);
});
test('ordinary edits remain editable until the explicit restore boundary',()=>{
 const f=fixture();f.field.value='edited';assert.equal(f.field.value,'edited');f.keeper.restore();assert.equal(f.field.value,request);
});
test('a WebForms replacement receives the preserved request rather than the detached textarea',()=>{
 const f=fixture();f.nodes.field={value:'loading'};f.keeper.restore();assert.equal(f.nodes.field.value,request);
});
test('late UI updates cannot replace the request between Yes activation and queued form serialization',()=>{
 const f=fixture();assert.equal(f.keeper.protect(),false);f.keeper.restore();f.field.value='late loading text';assert.equal(f.keeper.protect(),true);assert.equal(f.field.value,request);
 const updateStart=source.indexOf('      function updateSpecial()'),updateEnd=source.indexOf('      function onShip()',updateStart);let saved=0;
 const c=vm.createContext({pickupStockInstructions:f.keeper,saveDateState(){saved++;}});vm.runInContext(source.slice(updateStart,updateEnd),c);c.updateSpecial();assert.equal(f.field.value,request);assert.equal(saved,0);
 f.keeper.capture();assert.equal(f.keeper.protect(),false);
});
test('other methods, legacy and unverified notes are never promoted to submitted pickup requests',()=>{
 for(const value of ['', 'Pickup on 2026-11-12', 'PICKUP AVAILABILITY NOT YET VERIFIED']){const f=fixture(value);f.field.value='current';assert.equal(f.keeper.restore(),false);assert.equal(f.field.value,'current');}
 const f=fixture();f.radio.checked=false;assert.equal(f.keeper.restore(),false);f.keeper.capture();f.radio.checked=true;assert.equal(f.keeper.restore(),false);
});
const yesStart=source.indexOf('      function triggerStockYes('),yesEnd=source.indexOf('      async function fetchCompanyAvailability',yesStart);
test('native stock confirmation restores the exact request immediately before the native Yes click',()=>{
 const f=fixture(),events=[];f.field.value='PICKUP AVAILABILITY NOT YET VERIFIED';
 const yes={setAttribute(){},click(){events.push('click');assert.equal(f.field.value,request);}},modal={querySelector:()=>yes};
 const c=vm.createContext({stockProceeding:false,stockLastTriggerAt:0,persistShortageNotice(){},hideStockModal(){events.push('hide')},isBuyNowFrame:()=>false,window:{WLCheckout:{restorePickupStockInstructions(){events.push('restore');return f.keeper.restore();}}}});
 vm.runInContext(source.slice(yesStart,yesEnd),c);assert.equal(c.triggerStockYes(modal,''),true);assert.deepEqual(events,['hide','restore','click']);
});
test('a missing native confirmation cannot restore or post anything; compact flow retains its original path',()=>{
 let restores=0,clicks=0;const c=vm.createContext({stockProceeding:false,stockLastTriggerAt:0,persistShortageNotice(){},hideStockModal(){},isBuyNowFrame:()=>true,window:{WLCheckout:{restorePickupStockInstructions(){restores++;}}}});
 vm.runInContext(source.slice(yesStart,yesEnd),c);assert.equal(c.triggerStockYes({querySelector:()=>null},''),false);assert.equal(c.triggerStockYes({querySelector:()=>({setAttribute(){},click(){clicks++;}})},''),true);assert.equal(restores,0);assert.equal(clicks,1);
});
