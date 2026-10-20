'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../BuyNowPilot');
const fs = require('node:fs');
const path = require('node:path');

const mulch = {pid:'22663',quantity:3,code:'BMG',unit:'bag',name:'Pine Bark Mulch'};
const fish = {pid:'85',quantity:1,code:'0001363',unit:'ea',name:'Fish Chow'};
const drink = {pid:'97',quantity:2,code:'13531',unit:'ea',name:'Powerade'};
function recovery(extra = {}) {
  return Object.assign({version:1,scope:'customer-scope',id:'BN-test-1',phase:'checking_out',original:[mulch,drink],purchase:[fish],remaining:[mulch,drink],current:[fish],extraCount:0}, extra);
}
function memory() {
  const values = new Map();
  return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}

test('postal state abbreviations resolve the numeric options used by native WebTrack',()=>{
  const options=[{value:'0',textContent:'[Select State]'},{value:'56',textContent:'Texas'},{value:'12',textContent:'California'},{value:'99',textContent:'District of Columbia'}];
  for(const address of [{stateValue:'TX',stateText:'TX'},{stateValue:'tx'},{stateValue:'56',stateText:'Texas'},{stateValue:'Texas'}]) {
    assert.equal(core.nativeStateOption(options,address),options[1]);
  }
  assert.equal(core.nativeStateOption(options,{stateValue:'CA'}),options[2]);
  assert.equal(core.nativeStateOption(options,{stateValue:'DC'}),options[3]);
  assert.equal(core.nativeStateOption(options,{stateValue:'ZZ'}),undefined);
  assert.equal(core.nativeStateOption(options,{}),undefined);
  assert.equal(core.nativeStateOption([{value:'TX',textContent:'Texas'}],{stateValue:'TX'}).value,'TX');
});

test('guest delivery and billing fill numeric native states and dispatch normal field events',()=>{
  const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
  const nativeSource=source.slice(source.indexOf('    function setNative('),source.indexOf('    function readNativeReview('));
  const fields=new Map(),events=[];
  for(const prefix of ['DeliveryAddress','InvoiceAddress']) {
    for(const name of ['AddressLine1','AddressLine2','AddressLine3','City','Postcode','CountySelector_CountyList']) {
      const id='ctl00_PageBody_'+prefix+'_'+name;
      fields.set(id,{id,value:name.includes('County')?'0':'',options:[{value:'0',textContent:'[Select State]'},{value:'56',textContent:'Texas'}],dispatchEvent:e=>events.push([id,e.type])});
    }
  }
  const page={getElementById:id=>fields.get(id),querySelector:selector=>fields.get(selector.includes('InvoiceAddress')?'ctl00_PageBody_InvoiceAddress_CountySelector_CountyList':'ctl00_PageBody_DeliveryAddress_CountySelector_CountyList')};
  const context=require('node:vm').createContext({nativeStateOption:core.nativeStateOption});
  require('node:vm').runInContext(nativeSource,context);
  const address={line1:'702 W Buck St',city:'Caldwell',zip:'77836',stateValue:'TX',stateText:'TX'};
  const child={Event:class{constructor(type){this.type=type;}}};
  context.nativeAddress(child,page,'DeliveryAddress',address);context.nativeAddress(child,page,'InvoiceAddress',address);
  for(const prefix of ['DeliveryAddress','InvoiceAddress']) {
    const id='ctl00_PageBody_'+prefix+'_CountySelector_CountyList';
    assert.equal(fields.get(id).value,'56');
    assert.deepEqual(events.filter(e=>e[0]===id).map(e=>e[1]),['input','change']);
  }
});

test('compact checkout accepts all verified signed-in customers', () => assert.equal(core.audience,'signed-in'));
test('delivery summaries show complete selected addresses without contact or billing details',()=>{
  const address={line1:'702 W Buck St',line2:'Suite 2',line3:'Building A',city:'Caldwell',stateValue:'TX',stateText:'Texas',zip:'77836',contactName:'Private contact',phone:'5550100',email:'private@example.invalid'};
  assert.equal(core.deliveryAddressSummary(address),'702 W Buck St, Suite 2, Building A, Caldwell, TX 77836');
  assert.equal(core.deliveryAddressSummary({...address,line2:'',line3:'',stateValue:'56'}),'702 W Buck St, Caldwell, Texas 77836');
  assert.equal(core.deliveryAddressSummary(null),'Choose an address');
  assert.equal(core.deliveryAddressSummary({city:'Caldwell'}),'Choose an address');
});
test('guest, signed-in and edited delivery/shipping summaries show the selected destination',()=>{
  const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
  const updateSource=source.slice(source.indexOf('    function updateFastOptions('),source.indexOf('    function haltFast('));
  const address={line1:'702 W Buck St',city:'Caldwell',stateValue:'TX',zip:'77836'};
  for(const guest of [true,false])for(const method of ['delivery','ship'])for(const changed of [false,true]) {
    const rendered={},selected={...address,line1:changed?'100 Test St':address.line1};
    const context=require('node:vm').createContext({overlay:null,guest,submitting:false,deliveryAddressSummary:core.deliveryAddressSummary,fast:{methods:{},method,address:selected,addressChanged:changed,ready:true},fastText:(selector,value)=>{rendered[selector]=value;}});
    require('node:vm').runInContext(updateSource,context);context.updateFastOptions();
    assert.equal(rendered['[data-bn-address-title]'],'Deliver to');
    assert.equal(rendered['[data-bn-address]'],(changed?'100 Test St':'702 W Buck St')+', Caldwell, TX 77836');
  }
  const rendered={},context=require('node:vm').createContext({overlay:null,guest:true,submitting:false,deliveryAddressSummary:core.deliveryAddressSummary,fast:{methods:{},method:'pickup',address,store:'C',stores:[{value:'C',label:'Caldwell - Store address'}],ready:true},fastText:(selector,value)=>{rendered[selector]=value;}});
  require('node:vm').runInContext(updateSource,context);context.updateFastOptions();
  assert.equal(rendered['[data-bn-address-title]'],'Pickup at');assert.equal(rendered['[data-bn-address]'],'Caldwell');
});
test('identity comes from consistent server headings and requires native sign-out', () => {
  const page = (names,authenticated=true) => ({querySelector:()=>authenticated?{}:null,querySelectorAll:()=>names.map(name=>({textContent:name}))});
  assert.equal(core.loginFromDocument(page(["Change details for user 'ckunkel2'","Change password for user 'ckunkel2'"])),'ckunkel2');
  assert.equal(core.loginFromDocument(page(["Change details for user 'ckunkel3'"])),'ckunkel3');
  assert.equal(core.loginFromDocument(page(["Change details for user 'ckunkel2'"],false)),'');
  assert.equal(core.loginFromDocument(page(["Change details for user 'ckunkel2'","Change password for user 'other'"])), '');
  assert.equal(core.loginFromDocument(page(['ckunkel2','Welcome ckunkel2','Change details for user ckunkel2'])),'');
});
test('a guest with a stale pilot storage value performs no lookup and renders no additions', async () => {
  let lookups=0, renders=0;
  const win={location:{origin:'https://webtrack.woodsonlumber.com'},document:{readyState:'complete',querySelector:()=>null,createElement(){renders++;}},fetch(){lookups++;},localStorage:memory()}; win.top=win;
  win.localStorage.setItem('wl_user_id','b8f6961397f9c6a3b9cff27038c1d3ed309604ffe607b5dd0d365f5d53179ade');
  await core.boot(win); assert.equal(lookups,0); assert.equal(renders,0);
});
test('another signed-in customer boots from fresh native identity without a client allowlist', async () => {
  const lookups=[]; let renders=0;
  const settings={querySelector:()=>({}),querySelectorAll:()=>[{textContent:"Change details for user 'ckunkel3'"}],getElementById:()=>({value:'C'})};
  const account={querySelector:()=>({textContent:'Customer account 300'}),getElementById:()=>null};
  const doc={readyState:'complete',documentElement:{dataset:{}},body:{},head:{appendChild(){}},querySelector:()=>({}),querySelectorAll:()=>[],createElement(){renders++;return {};}};
  const win={location:{origin:'https://webtrack.woodsonlumber.com',href:'https://webtrack.woodsonlumber.com/Products.aspx',pathname:'/Products.aspx'},document:doc,sessionStorage:memory(),localStorage:memory(),navigator:{},crypto:require('node:crypto').webcrypto,TextEncoder,MutationObserver:class{observe(){}},addEventListener(){},AbortController,setTimeout,clearTimeout,DOMParser:class{parseFromString(value){return value==='settings'?settings:account;}},fetch:async(url)=>{lookups.push(url);return {ok:true,url,text:async()=>url.includes('AccountSettings')?'settings':'account',json:async()=>({blockedProductIds:[]})};}};win.top=win;
  // The old pilot hint is deliberately irrelevant to current authorization.
  win.localStorage.setItem('wl_user_id','not-a-pilot');
  await core.boot(win);
  assert.equal(lookups.length,3); assert.ok(renders>0);
  assert.equal(doc.documentElement.dataset.wlCompactCheckoutMode,'signed-in');
  assert.equal(win.WLBuyNowPilot.audience,'signed-in');
});
test('Buy now alone preserves all original cart lines after success', () => {
  const result = core.plan([mulch,drink],fish,[]);
  assert.deepEqual(result.purchase,[fish]); assert.deepEqual(result.remaining,[mulch,drink]);
});
test('cart extras are included once and only unpurchased lines are restored', () => {
  const result = core.plan([mulch,drink],fish,['97','97']);
  assert.deepEqual(result.purchase,[fish,drink]); assert.deepEqual(result.remaining,[mulch]);
  assert.deepEqual(core.recoveryTarget(recovery({...result,orderNumber:'TEST-100'})),[mulch]);
  assert.deepEqual(core.recoveryTarget(recovery({...result})),[mulch,drink]);
});
test('the primary product already in the cart has explicit independent quantity semantics', () => {
  const original = {...fish,quantity:4};
  const alone = core.plan([original,mulch],fish,[]);
  assert.equal(alone.purchase[0].quantity,1); assert.equal(alone.remaining[0].quantity,4);
  const together = core.plan([original,mulch],fish,['85']);
  assert.equal(together.purchase[0].quantity,5); assert.deepEqual(together.remaining,[mulch]);
  assert.equal(original.quantity,4);
});
test('unknown cart selections and incompatible units fail before preparation', () => {
  assert.throws(()=>core.plan([mulch],fish,['999']),/selection changed/);
  assert.throws(()=>core.plan([fish],{...fish,unit:'case'},['85']),/different units/);
});
test('ambiguous, fractional, invalid and configured carts cannot enter the pilot', () => {
  for (const quantity of [0,-1,1.5,10000,NaN,Infinity]) assert.throws(()=>core.lines([{...fish,quantity}]));
  assert.throws(()=>core.lines([fish,fish]));
  assert.throws(()=>core.lines([{...fish,code:'E-PALLET'}]));
  assert.throws(()=>core.lines([{...fish,code:'WDoor'}]));
  assert.throws(()=>core.lines([{...fish,pid:'85&foo=bar'}]));
});
test('every existing pallet-handling product is excluded before a pilot cart is mutated', () => {
  const source=fs.readFileSync(path.join(__dirname,'../ShoppingCartRow.js'),'utf8').split('var WL_EPALLET_RULES = {')[1].split('};')[0];
  const ids=[...source.matchAll(/\b(\d+):\s*\{/g)].map(match=>match[1]);
  for(const pid of ['23297',...ids]) assert.throws(()=>core.lines([{...fish,pid}]),/Pallet/);
});
test('cart identity ignores order but detects quantity, SKU and unit changes', () => {
  assert.equal(core.signature([mulch,fish]),core.signature([fish,mulch]));
  for (const change of [{quantity:2},{code:'OTHER'},{unit:'case'}]) assert.notEqual(core.signature([fish]),core.signature([{...fish,...change}]));
});
test('reconciliation prepares and restores exact baskets with each action verified', () => {
  for (const [from,to] of [[[mulch,drink],[fish]],[[fish],[mulch,drink]],[[mulch],[]],[[],[mulch]],[[{...fish,quantity:5}],[fish]]]) {
    let current = from, steps=0;
    while (true) {
      const action = core.nextMutation(current,to);
      if (!action) break;
      current = core.afterMutation(current,to,action); assert.ok(++steps<10);
    }
    assert.equal(core.signature(current),core.signature(to));
  }
});
test('cart interference stops restoration rather than overwriting a new product', () => {
  const record=recovery();
  assert.doesNotThrow(()=>core.assertExpected([fish],record));
  assert.throws(()=>core.assertExpected([fish,drink],record),/changed elsewhere/);
  assert.throws(()=>core.assertExpected([{...fish,quantity:3}],record),/changed elsewhere/);
});
test('a lost cart-mutation response accepts only the exact before or after states', () => {
  const record=recovery({pending:{before:core.signature([fish]),after:core.signature([])}});
  assert.doesNotThrow(()=>core.assertExpected([fish],record)); assert.doesNotThrow(()=>core.assertExpected([],record));
  assert.throws(()=>core.assertExpected([mulch],record));
});
test('uncertain order responses prohibit both automatic restoration and resubmission', () => {
  for(const phase of ['submitting','uncertain']) assert.throws(()=>core.recoveryTarget(recovery({phase})),/Order status must be checked/);
});
test('native final review must contain exactly the intended product quantities and units', () => {
  const review=[{code:fish.code,quantity:fish.quantity,unit:fish.unit},{code:mulch.code,quantity:mulch.quantity,unit:mulch.unit}];
  assert.doesNotThrow(()=>core.assertReview(review,[mulch,fish]));
  assert.throws(()=>core.assertReview(review,[fish]));
  assert.throws(()=>core.assertReview([],[fish]));
  assert.throws(()=>core.assertReview([{...review[0],quantity:2}],[fish]));
  assert.throws(()=>core.assertReview([{...review[0],unit:'case'}],[fish]));
});
test('durable backup is verified and recoverable after creating a fresh storage reader', () => {
  const storage=memory(), record=recovery(); core.persist(storage,'backup',record);
  assert.deepEqual(core.readRecord(storage,'backup'),record);
  const silentFailure={setItem(){},getItem(){return null;}};
  assert.throws(()=>core.persist(silentFailure,'backup',record),/could not be saved/);
  storage.setItem('backup','{broken'); assert.throws(()=>core.readRecord(storage,'backup'),/could not be read/);
});
test('saved payment resolves against fresh options and falls back to the first valid one', () => {
  const options=[{value:'',label:'Select a card'},{value:'native-1',label:'1111 Test',fingerprint:'hash-1'},{value:'native-2',label:'2222 Test',fingerprint:'hash-2'}];
  assert.equal(core.savedChoice(options,'hash-2').value,'native-2');
  assert.equal(core.savedChoice(options,'deleted-method').value,'native-1');
  assert.equal(core.savedChoice(options,null).value,'native-1');
  assert.equal(core.savedChoice([{value:'',label:'Select'}],null),null);
  assert.equal(core.savedChoice([...options,{value:'native-3',label:'2222 Test',fingerprint:'hash-2'}],'hash-2').value,'native-1');
});
test('native order notes carry a flow reference and extras count', () => {
  assert.equal(core.marker(recovery({extraCount:2})),'Website Buy Now | BN-test-1 | Additional cart items: 2');
});
test('natural cart checkout has its own reference without classifying the order as Buy Now',()=>{
  assert.equal(core.marker({cartCheckout:true,id:'CC-test-1'}),'Website Compact Checkout | CC-test-1');
});
test('compact cart checkout waits for the existing clearance-policy renderer before continuing',()=>{
  const page=(script,ready)=>({querySelector:()=>script?{}:null,getElementById:()=>ready?{}:null});
  assert.equal(core.cartPolicyReady(page(true,false)),false);
  assert.equal(core.cartPolicyReady(page(true,true)),true);
  assert.equal(core.cartPolicyReady(page(false,false)),true);
});
test('cart checkout keeps matching cut orders on the standard path and ignores unrelated old cut selections',()=>{
  assert.equal(core.hasCustomCuts([mulch,drink],{}),false);
  assert.equal(core.hasCustomCuts([mulch,drink],{selected:{productId:'85',productCode:'0001363'}}),false);
  assert.equal(core.hasCustomCuts([mulch,drink],{selected:{productId:22663}}),true);
  assert.equal(core.hasCustomCuts([mulch,drink],{selected:{productCode:' bmg '}}),true);
});
test('cart checkout persists only submission status and never a cart restoration snapshot',()=>{
  for (const phase of ['checking_out','preparing','backed_up','restoring']) assert.equal(core.cartOrderReceipt({phase}),null);
  const source={...recovery(),id:'CC-test-1',cartCheckout:true,phase:'submitting',createdAt:1000,updatedAt:1100,address:{line1:'Example'},payment:'secret'};
  const receipt=core.cartOrderReceipt(source);
  assert.deepEqual(receipt,{version:1,id:'CC-test-1',phase:'submitting',createdAt:1000,updatedAt:1100,orderNumber:''});
  for(const key of ['original','purchase','remaining','current','address','payment']) assert.equal(key in receipt,false);
  assert.equal(core.cartOrderReceipt({...source,phase:'confirmed',orderNumber:'TEST-200'}).orderNumber,'TEST-200');
});
test('an interrupted cart order remains distinguishable from a confirmed order after reload',()=>{
  const storage=memory(),key='cart-order';
  assert.equal(core.readCartOrderReceipt(storage,key),null);
  for(const phase of ['submitting','uncertain','confirmed']) {
    const receipt=core.cartOrderReceipt({id:'CC-test-1',phase,createdAt:1000,updatedAt:1100,orderNumber:phase==='confirmed'?'TEST-200':''});
    core.persist(storage,key,receipt);
    assert.deepEqual(core.readCartOrderReceipt(storage,key),receipt);
  }
  for(const value of ['broken','null',JSON.stringify({version:1,id:'BN-other',phase:'confirmed'}),JSON.stringify({version:1,id:'CC-test-1',phase:'checking_out'})]) {
    storage.setItem(key,value);
    assert.throws(()=>core.readCartOrderReceipt(storage,key),/status needs review/);
  }
});
test('main account address is parsed conservatively without mistaking the account name for a street', () => {
  assert.deepEqual(core.mainAddress(['Fixture Customer','702 W Buck St','Suite 2','Caldwell, Texas 77836']),{line1:'702 W Buck St',line2:'Suite 2',line3:'',city:'Caldwell',stateValue:'TX',stateText:'Texas',zip:'77836',countryValue:'USA',countryText:'United States'});
  assert.equal(core.mainAddress(['Customer Name','TX 77836']),null);
  assert.equal(core.mainAddress(['Missing street','Caldwell TX 77836']),null);
  assert.deepEqual(core.mainAddress(['702 W Buck St','Caldwell Texas','77836','United States']),{line1:'702 W Buck St',line2:'',line3:'',city:'Caldwell',stateValue:'TX',stateText:'Texas',zip:'77836',countryValue:'USA',countryText:'United States'});
});
test('native WebForms action targets are parsed without evaluating JavaScript', () => {
  assert.equal(core.targetOf("javascript:__doPostBack('ctl00$PageBody$Delete','')"),'ctl00$PageBody$Delete');
  assert.equal(core.targetOf('javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions("native$Add", "", true))'),'native$Add');
  assert.equal(core.targetOf('javascript:alert(1)'), '');
});
test('native EmptyCartDetailPanel and currently-empty copy remain recoverable', () => {
  const page=(copy,hasPanel=false)=>({body:{textContent:copy},querySelector:selector=>hasPanel&&selector.includes('#ctl00_PageBody_EmptyCartDetailPanel')?{}:null});
  assert.equal(core.readableCart(page('Your cart is currently empty.'),0),true);
  assert.equal(core.readableCart(page('Translated copy',true),0),true);
  assert.equal(core.readableCart(page('Your cart is empty.'),0),true);
  assert.equal(core.readableCart(page('Unexpected checkout or sign-in content'),0),false);
});
test('pilot date entry accepts the native minimum calendar day without a timestamp comparison', () => {
  assert.equal(core.dateChoice('2026-10-17','2026-10-17','2026-10-29'),true);
  assert.equal(core.dateChoice('2026-10-19','2026-10-17','2026-10-29'),true);
  assert.equal(core.dateChoice('2026-10-16','2026-10-17','2026-10-29'),false);
  assert.equal(core.dateChoice('2026-10-18','2026-10-17','2026-10-29'),false);
  assert.equal(core.dateChoice('2026-10-30','2026-10-17','2026-10-29'),false);
  assert.equal(core.dateChoice('2026-02-31','',''),false);
  assert.equal(core.dateChoice('not-a-date','',''),false);
});

test('fast checkout chooses the earliest valid calendar day and stays within pickup bounds', () => {
  assert.equal(core.firstDate('2026-10-18','2026-10-29'),'2026-10-19');
  assert.equal(core.firstDate('2026-10-17','2026-10-29'),'2026-10-17');
  assert.equal(core.firstDate('2026-10-18','2026-10-18'),'');
  assert.equal(core.firstDate('', ''),'');
});
test('final monetary values require a complete amount and preserve valid zero employee prices', () => {
  assert.equal(core.money('$1,234.50'),123450);
  assert.equal(core.money('$0.00'),0);
  assert.equal(core.money('25.00'),2500);
  for (const value of ['',undefined,'Loading','$25.5','$25.00 $1.00','-$2.00']) assert.equal(core.money(value),null);
});
test('compact confirmation reads native totals and refuses incomplete or estimated totals', () => {
  const page = rows => ({querySelectorAll:()=>rows.map(([label,value])=>({children:[{textContent:label}],querySelector:()=>({textContent:value})}))});
  const rows = [['Subtotal (without Tax)','$0.00'],['Delivery','$25.00'],['Tax','$2.06'],['Total inc Tax','$27.06']];
  assert.deepEqual(core.reviewTotals(page(rows)),{subtotal:'$0.00',shipping:'$25.00',tax:'$2.06',total:'$27.06'});
  assert.throws(()=>core.reviewTotals(page(rows.slice(0,-1))),/still loading/);
  assert.throws(()=>core.reviewTotals(page([...rows.slice(0,-1),['Total inc Tax','Checking…']])));
});

test('background checkout waits until the native async fulfillment selection is applied', () => {
  assert.equal(core.fulfillmentApplied('ship','delivery','true'),false);
  assert.equal(core.fulfillmentApplied('ship','ship','false'),false);
  assert.equal(core.fulfillmentApplied('ship','ship','true'),true);
  assert.equal(core.fulfillmentApplied('pickup','pickup','true'),true);
});
test('the known employee zero review requires the verified employee and complete native zero totals', () => {
  const zero={subtotal:'$0.00',tax:'$0.00',total:'$0.00'};
  assert.equal(core.employeeZeroReview('ckunkel2',zero,false),true);
  for (const user of ['',undefined,'ckunkel3','customer']) assert.equal(core.employeeZeroReview(user,zero,false),false);
  assert.equal(core.employeeZeroReview('ckunkel2',zero,true),false);
  assert.equal(core.employeeZeroReview('ckunkel2',{...zero,shipping:'$0.00'},false),false);
  for (const key of ['subtotal','tax','total']) {
    assert.equal(core.employeeZeroReview('ckunkel2',{...zero,[key]:'$1.00'},false),false);
    assert.equal(core.employeeZeroReview('ckunkel2',{...zero,[key]:''},false),false);
  }
  assert.equal(core.employeeZeroReview('ckunkel2',{subtotal:'$0.00',shipping:'$25.00',tax:'$2.06',total:'$27.06'},true),false);
});
test('UPS confirmation uses authoritative quoted rates rather than a stale native delivery price', () => {
  const ups={rate:'$80.44',rates:[{serviceCode:'03',serviceName:'UPS Ground',amount:80.44},{serviceCode:'01',serviceName:'UPS Next Day',amount:124.50}]};
  assert.equal(core.quotedShipping('ship',ups,{value:'-1',label:'UPS Ground ($25.00)'},true),8044);
  assert.notEqual(core.money('$25.00'),core.quotedShipping('ship',ups,{value:'-1',label:'UPS Ground ($25.00)'},true));
  assert.equal(core.quotedShipping('ship',ups,{value:'01',label:'UPS Next Day ($124.50)'},false),12450);
  assert.throws(()=>core.quotedShipping('ship',ups,{value:'unknown',label:'Unknown service ($25.00)'},false));
  assert.equal(core.quotedShipping('delivery',{rate:'$25.00'}),2500);
  assert.equal(core.quotedShipping('pickup',null),0);
});


test('pickup stays available while paid carrier quotes are pending, without inventing paid availability', () => {
  const waiting=core.fulfillmentOptions(true,null);
  assert.equal(waiting.pickup.available,true);
  assert.equal(waiting.pickup.rate,'Free');
  assert.equal(waiting.delivery.available,false);
  assert.equal(waiting.ship.available,false);
  assert.equal(waiting.ship.pending,true);
  assert.equal(core.fulfillmentOptions(false,null).pickup.available,false);
  const ready=core.fulfillmentOptions(true,{options:{delivery:{available:true,amount:25},ups:{available:false,reason:'Cannot ship'}}});
  assert.equal(ready.delivery.rate,'$25.00');
  assert.equal(ready.delivery.available,true);
  assert.equal(ready.delivery.pending,false);
  assert.equal(ready.ship.available,false);
  assert.equal(ready.ship.reason,'Cannot ship');
});


test('preparation adds its product before removing extras while recovery retains conservative removal order', () => {
  assert.deepEqual(core.nextMutation([mulch],[fish],true),{kind:'add',pid:'85',quantity:1});
  assert.deepEqual(core.nextMutation([mulch],[fish]),{kind:'remove',pid:'22663',quantity:0});
  assert.deepEqual(core.nextMutation([mulch,fish],[fish],true),{kind:'remove',pid:'22663',quantity:0});
  assert.equal(core.nextMutation([mulch,fish],[fish,mulch],true),null);
});
test('Buy now honors pickup selected on the product but still recommends the best paid mode for delivery/ship', () => {
  const page=(pickup,paid)=>({querySelector:selector=>selector.includes('Choose pickup')?pickup:paid});
  assert.equal(core.productMethod(page({},null)),'pickup');
  assert.equal(core.productMethod(page(null,{})),'');
  assert.equal(core.productMethod(page(null,null)),'');
  assert.equal(core.productMethod(page({},{})),'');
});

test('verified account contact defaults replace duplicate hidden-page lookups without WebForms change events',()=>{
  const vals={FirstNameInput:'Fixture',LastNameInput:'Customer',EmailAddressInput:'(Primary) fixture@example.test'};
  const settings={getElementById:id=>({value:vals[id.split('_').pop()]})};
  const account={getElementById:()=>({textContent:'555-0100'})};
  const contact=core.contactDefaults(settings,account);
  assert.deepEqual(contact,{firstName:'Fixture',lastName:'Customer',email:'fixture@example.test',phone:'555-0100'});
  const fields={};
  for(const block of ['DeliveryAddress','InvoiceAddress']) for(const name of ['ContactFirstNameTextBox','ContactLastNameTextBox','EmailAddressTextBox','ContactTelephoneTextBox']) fields['ctl00_PageBody_'+block+'_'+name]={value:'',dispatchEvent(){throw new Error('Must not trigger a postback')}};
  fields.ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox.value='Existing billing phone';
  const page={getElementById:id=>fields[id]};
  core.applyContactDefaults(page,contact,null);
  assert.equal(fields.ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox.value,'Fixture');
  assert.equal(fields.ctl00_PageBody_DeliveryAddress_ContactTelephoneTextBox.value,'555-0100');
  assert.equal(fields.ctl00_PageBody_InvoiceAddress_EmailAddressTextBox.value,'fixture@example.test');
  assert.equal(fields.ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox.value,'Existing billing phone');
  core.applyContactDefaults(page,contact,{contactName:'Other Pickup Person',phone:'555-0200',email:'other@example.test'});
  assert.equal(fields.ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox.value,'Other');
  assert.equal(fields.ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox.value,'Pickup Person');
  assert.equal(fields.ctl00_PageBody_DeliveryAddress_EmailAddressTextBox.value,'other@example.test');
  assert.equal(fields.ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox.value,'Fixture');
  assert.doesNotThrow(()=>core.applyContactDefaults({getElementById:()=>null},contact,null));
});

test('Quick buy accepts a fulfillment quote only for the exact current basket',()=>{
  const quote={cartSignature:'85:0001363:1:'};
  assert.equal(core.quoteForCart(quote,[fish]),quote);
  assert.equal(core.quoteForCart(quote,[drink]),null);
  assert.equal(core.quoteForCart(quote,[{...fish,quantity:2}]),null);
  assert.equal(core.quoteForCart({cartSignature:'85:0001363:1:cut:12:accepted'},[fish]),null);
  assert.equal(core.quoteForCart({},[fish]),null);
  assert.equal(core.quoteForCart(null,[fish]),null);
  assert.equal(core.quoteForCart({cartSignature:'22663:BMG:3:|85:0001363:1:'},[fish,mulch]).cartSignature,'22663:BMG:3:|85:0001363:1:');
});
test('Quick buy chooses the cheaper valid home method independently of a prior selection',()=>{
  const quote=(delivery,ups)=>({recommendation:{mode:'ship'},options:{delivery,ups}});
  const available=amount=>({available:true,amount});
  assert.equal(core.cheapestHomeMethod(quote(available(25),available(80.44))),'delivery');
  assert.equal(core.cheapestHomeMethod(quote(available(25),available(9.95))),'ship');
  assert.equal(core.cheapestHomeMethod(quote(available(25),available(25))),'delivery');
  assert.equal(core.cheapestHomeMethod(quote({available:false},available(80.44))),'ship');
  assert.equal(core.cheapestHomeMethod(quote(available(25),{available:false})),'delivery');
  assert.equal(core.cheapestHomeMethod(quote(available(25),available(NaN))),'delivery');
  assert.equal(core.cheapestHomeMethod(quote(available(0),available(-1))),'pickup');
});

test('a temporarily disabled native fulfillment control is selected only after it becomes usable',()=>{
  let clicks=0;
  const control={disabled:true,dataset:{},getAttribute:()=>null,click(){clicks++;}};
  const page={documentElement:{dataset:{}},getElementById:id=>id==='btnShip'?control:null};
  assert.equal(core.requestNativeMethod(page,'ship',1000),false);
  assert.equal(clicks,0);
  assert.equal(page.documentElement.dataset.bnMethod,undefined);
  control.disabled=false;
  assert.equal(core.requestNativeMethod(page,'ship',2200),true);
  assert.equal(clicks,1);
  assert.equal(page.documentElement.dataset.bnMethod,'ship');
  assert.equal(control.dataset.bnRequestedAt,'2200');
  core.requestNativeMethod(page,'ship',2500);
  assert.equal(clicks,1,'an asynchronous reservation must not receive duplicate clicks');
});

test('missing and aria-disabled controls stay pending, and an UpdatePanel replacement can receive its own request',()=>{
  let clicks=0,control=null;
  const page={documentElement:{dataset:{}},getElementById:()=>control};
  assert.equal(core.requestNativeMethod(page,'delivery',1000),false);
  control={dataset:{},disabled:false,getAttribute:()=> 'true',click(){clicks++;}};
  assert.equal(core.requestNativeMethod(page,'delivery',1100),false);
  control.getAttribute=()=> 'false';
  core.requestNativeMethod(page,'delivery',1200);
  control={...control,dataset:{}};
  core.requestNativeMethod(page,'delivery',1500);
  assert.equal(clicks,2);
  assert.equal(control.dataset.bnRequestedAt,'1500');
});

test('pickup review must confirm the exact selected native store',()=>{
  assert.doesNotThrow(()=>core.assertPickupStore('Caldwell - 702 W Buck St','Caldwell - 702 W Buck St'));
  assert.doesNotThrow(()=>core.assertPickupStore(' Caldwell - 702 W Buck St\n','Caldwell - 702 W Buck St'));
  assert.throws(()=>core.assertPickupStore('Groesbeck - Store address','Caldwell - 702 W Buck St'),/pickup store/);
  assert.throws(()=>core.assertPickupStore('', 'Caldwell - 702 W Buck St'),/pickup store/);
  assert.throws(()=>core.assertPickupStore('Caldwell - 702 W Buck St',undefined),/pickup store/);
});

test('paid defaults wait for a fresh details quote after an already-running cart quote',async()=>{
  let finishOld,calls=0;
  const old=new Promise(resolve=>{finishOld=resolve});
  const early={cartSignature:'85:0001363:1:',options:{ups:{available:true,amount:80.44},delivery:{available:false}}};
  const complete={cartSignature:'85:0001363:1:',options:{ups:{available:true,amount:80.44},delivery:{available:true,amount:25}}};
  const pending=core.refreshDetailsQuote(()=>++calls===1?old:Promise.resolve(complete),()=>true);
  assert.equal(calls,1);
  finishOld(early);
  const actual=await pending;
  assert.equal(calls,2);
  assert.equal(actual,complete);
  assert.equal(core.cheapestHomeMethod(actual),'delivery');
});
test('obsolete checkout details stop before requesting another quote',async()=>{
  let calls=0;
  assert.equal(await core.refreshDetailsQuote(async()=>{calls++;return{}},()=>false),null);
  assert.equal(calls,1);
});
test('a quote that finishes after a customer changes the order is discarded',async()=>{
  let calls=0,current=true;
  const result=await core.refreshDetailsQuote(async()=>{if(++calls===2)current=false;return{}},()=>current);
  assert.equal(result,null);
  assert.equal(calls,2);
});

test('account scopes isolate logins and customer accounts while preserving the old recovery namespace',()=>{
  assert.equal(core.accountScopeInput('ckunkel2','Customer 10'),'ckunkel2|Customer 10');
  assert.notEqual(core.accountScopeInput('ckunkel2','Customer 10'),core.accountScopeInput('ckunkel3','Customer 10'));
  assert.notEqual(core.accountScopeInput('ckunkel2','Customer 10'),core.accountScopeInput('ckunkel2','Customer 20'));
  assert.throws(()=>core.accountScopeInput('','Customer 10'),/could not be verified/);
});
function guestSession(overrides={}) {
  const session=memory();session.setItem('wl_checkout_mode','guest');
  session.setItem('wl_guest_checkout_payload',JSON.stringify({email:'guest@example.invalid',fname:'Guest',lname:'Test',phone:'9795550100',d_addr1:'702 W Buck St',d_city:'Caldwell',d_state:'TX',d_zip:'77836',billSame:false,i_addr1:'100 Test St',i_city:'Bryan',i_state2:'TX',i_zip:'77801',password:'must-not-leak',...overrides}));
  return session;
}
test('guest defaults require an exact fresh login match and retain separate billing without credentials',()=>{
  const session=guestSession(); const guest=core.guestContext(session,'guest@example.invalid');
  assert.equal(guest.address.line1,'702 W Buck St'); assert.equal(guest.billing.line1,'100 Test St');
  assert.equal(guest.contact.firstName,'Guest'); assert.equal(JSON.stringify(guest).includes('must-not-leak'),false);
  assert.equal(core.guestContext(session,'other@example.invalid'),null);
  session.setItem('wl_checkout_mode','signed_in'); assert.equal(core.guestContext(session,'guest@example.invalid'),null);
});
test('invalid or incomplete guest contact and addresses cannot hydrate checkout',()=>{
  for(const bad of [{phone:'123'},{d_zip:'bad'},{d_addr1:''},{i_city:''},{fname:''}]) assert.equal(core.guestContext(guestSession(bad),'guest@example.invalid'),null);
  const session=guestSession();session.setItem('wl_guest_checkout_payload','{bad');assert.equal(core.guestContext(session,'guest@example.invalid'),null);
});
test('guest auto-entry is bounded and its marker contains no customer details',()=>{
  const session=memory(),key='wl_compact_guest_start_v1';
  assert.equal(core.guestStartPending(session,1000),false);
  session.setItem(key,JSON.stringify({version:1,createdAt:1000}));
  assert.equal(core.guestStartPending(session,1001),true);
  assert.equal(core.guestStartPending(session,301000),false);
  assert.equal(core.guestStartPending(session,999),false);
  session.setItem(key,'{bad');assert.equal(core.guestStartPending(session,1001),false);
});
test('guest compact checkout has a staff-visible flow reference without customer details',()=>{
  assert.equal(core.marker({cartCheckout:true,guestCheckout:true,id:'CC-guest-1'}),'Website Guest Compact Checkout | CC-guest-1');
});

test('disabled saved payments and native no-card placeholders do not become defaults',()=>{
  assert.equal(core.savedChoice([{value:'0',label:'No stored cards'},{value:'1',label:'1111 Test',disabled:true},{value:'2',label:'2222 Test'}],null).value,'2');
  assert.equal(core.savedChoice([{value:'none',label:'None'}],null),null);
});
test('guest contact hydration uses the entered phone while account hydration preserves an existing billing phone',()=>{
  const phone={value:'existing'};const page={getElementById:id=>id==='ctl00_PageBody_InvoiceAddress_ContactTelephoneTextBox'?phone:null};
  const contact={firstName:'Guest',lastName:'Test',email:'guest@example.invalid',phone:'9795550100'};
  core.applyContactDefaults(page,contact,null);assert.equal(phone.value,'existing');
  core.applyContactDefaults(page,contact,null,true);assert.equal(phone.value,'9795550100');
});
