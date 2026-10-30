'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot');
const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');

test('pickup person resolves explicit choice, native default and account contact in order',()=>{
  assert.equal(core.pickupPersonName({pickupPerson:'  Test  Collector  ',address:{contactName:'Account Contact'}},'Native Person'),'Test Collector');
  assert.equal(core.pickupPersonName({pickupPerson:'  ',address:{contactName:'Account Contact'}},' Native Person '),'Native Person');
  assert.equal(core.pickupPersonName({address:{contactName:' Account Contact '}}),'Account Contact');
  assert.equal(core.pickupPersonName({address:{contactName:'  '}},' '),'');
});

test('Quick Buy and compact pickup person changes preserve the chosen schedule at the same store',()=>{
  for(const cartCheckout of [false,true]) {
    const options={cartCheckout,method:'pickup',store:'C',stores:[{value:'C'},{value:'B'}],pickupPerson:'Original Contact',date:'2026-11-04',pickupTime:'8:00 AM–9:00 AM'};
    core.applyPickupSelection(options,'C','  Alternate   Collector ');
    assert.equal(options.pickupPerson,'Alternate Collector');assert.equal(options.date,'2026-11-04');assert.equal(options.pickupTime,'8:00 AM–9:00 AM');
    core.applyPickupSelection(options,'B','Alternate Collector');
    assert.equal(options.store,'B');assert.equal(options.pickupPerson,'Alternate Collector');assert.equal(options.date,'');assert.equal(options.pickupTime,'');
  }
});

test('blank pickup names and unavailable stores cannot modify the current pickup selection',()=>{
  const options={store:'C',stores:[{value:'C'}],pickupPerson:'Original',date:'2026-11-04',pickupTime:'8:00 AM–9:00 AM'},before=structuredClone(options);
  for(const name of ['', '  ', '\n\t']) {assert.throws(()=>core.applyPickupSelection(options,'C',name),/name of the person/);assert.deepEqual(options,before);}
  assert.throws(()=>core.applyPickupSelection(options,'missing','Other Person'),/available pickup store/);assert.deepEqual(options,before);
});

test('pickup summary shows the person and a direct editor name, while delivery hides the pickup detail',()=>{
  const summary={hidden:true,textContent:''},button={setAttribute(k,v){this[k]=v;}},rendered={};
  const overlay={querySelector(selector){return selector==='[data-bn-pickup-person]'?summary:selector==='[data-bn-edit="address"]'?button:null;},querySelectorAll(){return [];}};
  const fast={method:'pickup',methods:{},store:'C',stores:[{value:'C',label:'Caldwell - Store'}],pickupPerson:'Alternate Collector',address:{line1:'Test Street'},ready:true};
  const context=vm.createContext({overlay,fast,guest:true,submitting:false,pickupPersonName:core.pickupPersonName,deliveryAddressSummary:core.deliveryAddressSummary,loading(){},fastText:(k,v)=>rendered[k]=v});
  vm.runInContext(source.slice(source.indexOf('    function updateFastOptions('),source.indexOf('    function requestPickupPerson(')),context);
  context.updateFastOptions();assert.equal(summary.hidden,false);assert.equal(summary.textContent,'Pickup person: Alternate Collector');assert.equal(button['aria-label'],'Change pickup store or person');
  fast.pickupPerson=' ';context.updateFastOptions();assert.equal(summary.textContent,'Pickup person required');
  fast.method='delivery';context.updateFastOptions();assert.equal(summary.hidden,true);assert.equal(button['aria-label'],'Change delivery address');
});

test('missing pickup name opens the pickup editor and focuses its required field without posting checkout',()=>{
  let opened='',focused=0;const errors=[];const input={focus(){focused++;}},error={textContent:''};
  const context=vm.createContext({fast:{editor:''},overlay:{querySelector:s=>s.includes('input[')?input:error},updateFastOptions(){},status:message=>errors.push(message),editFast:kind=>{opened=kind;context.fast.editor=kind;}});
  vm.runInContext(source.slice(source.indexOf('    function requestPickupPerson('),source.indexOf('    function haltFast(')),context);
  context.requestPickupPerson();assert.equal(opened,'address');assert.equal(focused,1);assert.match(error.textContent,/name of the person/);
  context.requestPickupPerson();assert.equal(focused,1,'repeated frame checks do not steal focus while the shopper edits');
});
