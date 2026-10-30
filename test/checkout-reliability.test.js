'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot');
const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const key='wl_guest_cart_handoff_v1';
const basket=[{pid:'85',code:'FISH',unit:'ea',quantity:2,name:'Fish food'},{pid:'97',code:'DRINK',unit:'ea',quantity:1,name:'Drink'}];
function recovery(options={}) {
  const data=new Map(),writes=[],metadata=basket.map(item=>({...item}));
  let server=structuredClone(options.server || []),reloads=0,fail=options.failAfterAdd;
  const backup={version:1,createdAt:Date.now(),email:'guest@example.invalid',items:basket,...options.backup};
  data.set(key,JSON.stringify(backup));
  const session={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  const context=vm.createContext({active:null,user:'guest@example.invalid',scope:'verified-account',branch:'1',busy:false,cartEntry:false,GUEST_CART_KEY:key,lockName:'guest-lock',text:v=>String(v||'').trim(),guestCartHandoff:core.guestCartHandoff,signature:core.signature,assertExpected:core.assertExpected,nextMutation:core.nextMutation,afterMutation:core.afterMutation,
    win:{sessionStorage:session,navigator:{locks:{request:async(name,opts,fn)=>fn({})}},location:{reload(){reloads++;}}},
    shell(){},loading(){},status(){},dismiss(){context.active=null;context.busy=false;},
    assertNoPendingCartOrder(){if(options.pendingOrder)throw Error('An earlier order is uncertain');},record:()=>options.quickBuy?{}:null,
    checkIdentity:async()=>{if(options.identityFailure)throw Error('The customer account changed');},
    cart:async()=>({items:structuredClone(server),rows:[],doc:{}}),
    product:async pid=>{const item=metadata.find(row=>row.pid===pid);return {...item,doc:{pid,querySelector:()=>null},add:{},quantity:{name:'qty'}};},
    nativePost:async(doc,control,path,adjust)=>{const values=new Map();adjust({set:(k,v)=>values.set(k,v)});const item=metadata.find(row=>row.pid===doc.pid);assert.ok(!server.some(row=>row.pid===item.pid),'recovery must not add the same line twice');server.push({...item,quantity:Number(values.get('qty'))});writes.push(item.pid);if(fail===item.pid){fail=null;throw Error('Connection lost after native add');}return {querySelector:()=>null};}
  });
  vm.runInContext(section('    function save()','    function assertNoPendingCartOrder()')+section('    async function preflight(','    function restoreSession()'),context);
  return {context,data,session,writes,server:()=>server,reloads:()=>reloads,run:()=>context.restoreGuestCart()};
}
test('guest signup can restore an empty native account cart with exact quantities and then reload',async()=>{
  const f=recovery();assert.equal(await f.run(),true);assert.equal(core.signature(f.server()),core.signature(basket));assert.deepEqual(f.writes,['85','97']);assert.equal(f.data.has(key),false);assert.equal(f.reloads(),1);
});
test('native-preserved baskets need no cart writes or reload',async()=>{
  const f=recovery({server:basket});assert.equal(await f.run(),false);assert.deepEqual(f.writes,[]);assert.equal(f.data.has(key),false);
});
test('an existing different customer cart and a changed server identity prohibit recovery writes',async()=>{
  for(const options of [{server:[basket[0]]},{identityFailure:true},{pendingOrder:true},{quickBuy:true},{backup:{scope:'another-account',current:[]}}]) {
    const f=recovery(options);await assert.rejects(f.run());assert.deepEqual(f.writes,[]);assert.equal(f.data.has(key),true);
  }
});
test('a lost native add response resumes from its verified after-state without duplicating an item',async()=>{
  const first=recovery({failAfterAdd:'85'});await assert.rejects(first.run(),/Connection lost/);
  const partial=JSON.parse(first.data.get(key));assert.equal(partial.pending.after,core.signature([basket[0]]));
  const next=recovery({server:first.server(),backup:partial});assert.equal(await next.run(),true);assert.deepEqual(next.writes,['97']);assert.equal(core.signature(next.server()),core.signature(basket));
});
test('a partial guest recovery stops if another tab changes quantities',async()=>{
  const first=recovery({failAfterAdd:'85'});await assert.rejects(first.run());
  const next=recovery({server:[{...basket[0],quantity:8}],backup:JSON.parse(first.data.get(key))});await assert.rejects(next.run());assert.deepEqual(next.writes,[]);
});
test('another login never reads a guest basket; expired and malformed matching records cannot be replayed',()=>{
  const f=recovery();assert.equal(core.guestCartHandoff(f.session,'different-login',Date.now()),null);
  for(const backup of [{createdAt:Date.now()-3600001},{items:[{...basket[0],quantity:0}]},{items:[basket[0],basket[0]]}]) assert.throws(()=>core.guestCartHandoff(recovery({backup}).session,'guest@example.invalid',Date.now()));
});
test('an empty embedded document is not a ready WebForms checkout',()=>{
  assert.equal(core.nativeFormsReady({document:{URL:'about:blank',readyState:'complete',querySelector:()=>null}}),false);
  assert.equal(core.nativeFormsReady({document:{URL:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx',readyState:'complete',querySelector:()=>null}}),false);
  assert.equal(core.nativeFormsReady({document:{URL:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx',readyState:'complete',querySelector:()=>({})}}),true);
});
function handoff(options={}) {
  const calls=[],context=vm.createContext({active:{current:basket,phase:options.phase||'checking_out'},fast:{},cartEntry:true,submitting:false,busy:false,bypassCartEntry:false,
    clearFrame(){calls.push('clear-frame');},loading(){},status(){},assertNoPendingCartOrder(){if(options.pending)throw Error('Uncertain order');},
    checkIdentity:async()=>{if(options.identityFailure)throw Error('Customer changed');calls.push('verify-identity');},cart:async()=>({items:options.changedCart?[]:basket}),signature:core.signature,
    doc:{getElementById:()=>({click(){calls.push('native-click-and-draft-reset');}})},seedSession(nativeHandoff){assert.equal(nativeHandoff,true);calls.push('seed-current-options');},dismiss(){calls.push('dismiss');},showError(error){calls.push(error.message);}
  });vm.runInContext(section('    async function standardCheckout()','    function notice('),context);
  return {calls,run:()=>context.standardCheckout()};
}
test('standard recovery checks identity and basket, then reseeds after native draft reset',async()=>{
  const f=handoff();await f.run();assert.deepEqual(f.calls,['clear-frame','verify-identity','native-click-and-draft-reset','seed-current-options','dismiss']);
});
test('standard recovery cannot bypass changed accounts, changed carts or uncertain submissions',async()=>{
  for(const options of [{identityFailure:true},{changedCart:true},{pending:true},{phase:'uncertain'},{phase:'submitting'}]) {const f=handoff(options);await f.run();assert.ok(!f.calls.includes('native-click-and-draft-reset'));}
});
test('a blank entry offers recovery after twelve seconds but never restarts a later payment navigation',()=>{
  for(const entered of [false,true]) {
    let clock=0,tick,forms=entered,halts=0;const fallback={classList:{add(){}},textContent:''};
    const page={URL:'about:blank',readyState:'complete',body:{},querySelector:()=>forms?{}:null};
    const frame={contentDocument:page,setAttribute(){},addEventListener(){}};
    const context=vm.createContext({frame:null,frameReadyTimer:null,installedPage:page,fast:{},active:{phase:'checking_out'},busy:true,submitting:false,overlay:{dataset:{},querySelector:()=>fallback},Date:{now:()=>clock},URL,
      doc:{createElement:()=>frame},win:{crypto:{randomUUID:()=> 'local-test'},setInterval:fn=>{tick=fn;return 1;}},haltFast(){halts++;context.fast.stopped=true;},showError(){throw Error('unexpected');},installFrame:async()=>{}});
    vm.runInContext(section('    function openFrame(','    async function installFrame('),context);context.openFrame({appendChild(){}});
    tick();forms=false;clock=13000;tick();assert.equal(halts,0,'preflight must finish before fallback');context.busy=false;tick();
    assert.equal(halts,entered?0:1);if(!entered)assert.equal(fallback.textContent,'Continue with standard checkout');tick();assert.equal(halts,entered?0:1);
  }
});
test('native handoff preserves job, billing recipients, fulfillment, timing and order notes',()=>{
  const data=new Map(),address={line1:'Job street',city:'Caldwell',stateValue:'TX',zip:'77836',email:'job@example.invalid'},billing={line1:'Invoice street',city:'Brenham',stateValue:'TX',zip:'77833',email:'login@example.invalid'};
  const context=vm.createContext({fast:{method:'pickup',store:'3',stores:[{value:'3',label:'Caldwell'}],address,billing,date:'2026-11-04',pickupTime:'08:00',pickupPerson:'Test contact',reference:'PO-TEST',notes:'Keep dry',salesSelection:{id:'04',code:'04',jobReference:'Reina'}},guest:null,STATE_NAMES:{TX:'Texas'},SESSION_KEYS:[],text:v=>String(v||'').trim(),win:{sessionStorage:{setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}});
  vm.runInContext(section('    function seedSession(','    function revisePurchase('),context);context.seedSession();
  assert.equal(data.get('wl_fulfillment_intent'),'pickup');const date=JSON.parse(data.get('wl_checkout_date_state_v2'));assert.equal(date.pickupDate,'2026-11-04');assert.equal(date.pickupPerson,'Test contact');assert.ok(date.extra.includes('Job ref: Reina'));
  const payload=JSON.parse(data.get('wl_checkout_address_payload'));assert.equal(payload.stateText,'Texas');assert.equal(payload.billing.stateText,'Texas');assert.equal(payload.preserveInvoiceContact,true);
  context.SESSION_KEYS=['wl_fulfillment_intent','wl_fulfillment_method','wl_fulfillment_selection_source_v1'];context.seedSession(true);
  assert.equal(data.has('wl_fulfillment_intent'),false);assert.equal(data.has('wl_fulfillment_method'),false);assert.equal(data.has('wl_fulfillment_selection_source_v1'),false);assert.equal(JSON.parse(data.get('wl_checkout_date_state_v2')).pickupPerson,'Test contact');
  const nativePayload=JSON.parse(data.get('wl_checkout_address_payload'));assert.equal(nativePayload.pickupBranchValue,'3');assert.equal(payload.pickupBranchValue,'');
  const checkout=fs.readFileSync(require.resolve('../Checkout2'),'utf8'),fields={};
  for(const prefix of ['DeliveryAddress','InvoiceAddress'])for(const field of ['AddressLine1','AddressLine2','AddressLine3','City','Postcode','ContactTelephoneTextBox','EmailAddressTextBox','ContactFirstNameTextBox','ContactLastNameTextBox'])fields['ctl00_PageBody_'+prefix+'_'+field]={value:''};
  fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox.value='billing@example.invalid; accounts@example.invalid';fields.ctl00_PageBody_PurchaseOrderNumberTextBox={value:''};
  let branchChanges=0;fields.ctl00_PageBody_BranchDropDownList={value:'5',options:[{value:'3'},{value:'5'}],dispatchEvent(event){assert.equal(event.type,'change');assert.equal(fields.ctl00_PageBody_DeliveryAddress_AddressLine1.value,'Job street');branchChanges++;}};
  const applied=vm.createContext({Event:class{constructor(type){this.type=type;}},document:{getElementById:id=>fields[id]||null},cleanText:v=>String(v||'').trim(),splitDisplayName:()=>({first:'Test',last:'Contact'}),setCheckoutValueIfPresent:(el,value)=>{if(!el||value===undefined)return false;el.value=value;return true;},setCheckoutSelect(){},sessionStorage:{setItem(){}},window:{}});
  vm.runInContext(checkout.slice(checkout.indexOf('  function applyCheckoutAddressPayload('),checkout.indexOf('  function consumeCheckoutReturnPayloads(')),applied);applied.applyCheckoutAddressPayload(nativePayload);
  assert.equal(fields.ctl00_PageBody_DeliveryAddress_AddressLine1.value,'Job street');assert.equal(fields.ctl00_PageBody_InvoiceAddress_AddressLine1.value,'Invoice street');assert.equal(fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox.value,'billing@example.invalid; accounts@example.invalid');assert.equal(fields.ctl00_PageBody_PurchaseOrderNumberTextBox.value,'PO-TEST');
  assert.equal(fields.ctl00_PageBody_BranchDropDownList.value,'3');assert.equal(branchChanges,1);
  applied.applyCheckoutAddressPayload(nativePayload);assert.equal(branchChanges,1,'same branch does not repeat the native postback');
  applied.applyCheckoutAddressPayload({...nativePayload,pickupBranchValue:'99'});assert.equal(fields.ctl00_PageBody_BranchDropDownList.value,'3');assert.equal(branchChanges,1,'unavailable values never enter the native selector');
});

test('standard handoff seeds only a validated pickup branch and clears it for delivery',()=>{
  const data=new Map(),context=vm.createContext({fast:{method:'pickup',store:'3',stores:[{value:'3'}],address:{line1:'Test street'}},guest:null,STATE_NAMES:{},SESSION_KEYS:[],text:v=>String(v||'').trim(),win:{sessionStorage:{setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}});
  vm.runInContext(section('    function seedSession(','    function revisePurchase('),context);
  context.seedSession(true);assert.equal(JSON.parse(data.get('wl_checkout_address_payload')).pickupBranchValue,'3');
  context.fast.method='delivery';context.seedSession(true);assert.equal(JSON.parse(data.get('wl_checkout_address_payload')).pickupBranchValue,'');
  context.fast.method='pickup';context.fast.store='missing';context.seedSession(true);assert.equal(JSON.parse(data.get('wl_checkout_address_payload')).pickupBranchValue,'');
});
