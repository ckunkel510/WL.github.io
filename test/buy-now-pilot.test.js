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

test('pilot audience is exactly ckunkel2', () => assert.equal(core.audience,'ckunkel2'));
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
test('another signed-in user cannot enable the pilot with stale local identity storage', async () => {
  let lookups=0,renders=0;
  const settings={querySelector:()=>({}),querySelectorAll:()=>[{textContent:"Change details for user 'ckunkel3'"}]};
  const win={location:{origin:'https://webtrack.woodsonlumber.com',href:'https://webtrack.woodsonlumber.com/Products.aspx'},document:{readyState:'complete',querySelector:()=>({}),createElement(){renders++;}},localStorage:memory(),AbortController,setTimeout,clearTimeout,DOMParser:class{parseFromString(){return settings;}},fetch:async()=>{lookups++;return {ok:true,url:'https://webtrack.woodsonlumber.com/AccountSettings.aspx',text:async()=>''};}};win.top=win;
  win.localStorage.setItem('wl_user_id','b8f6961397f9c6a3b9cff27038c1d3ed309604ffe607b5dd0d365f5d53179ade');
  await assert.rejects(core.boot(win),/only for the ckunkel2 pilot/); assert.equal(lookups,1); assert.equal(renders,0);
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
test('UPS confirmation uses authoritative quoted rates rather than a stale native delivery price', () => {
  const ups={rate:'$80.44',rates:[{serviceCode:'03',serviceName:'UPS Ground',amount:80.44},{serviceCode:'01',serviceName:'UPS Next Day',amount:124.50}]};
  assert.equal(core.quotedShipping('ship',ups,{value:'-1',label:'UPS Ground ($25.00)'},true),8044);
  assert.notEqual(core.money('$25.00'),core.quotedShipping('ship',ups,{value:'-1',label:'UPS Ground ($25.00)'},true));
  assert.equal(core.quotedShipping('ship',ups,{value:'01',label:'UPS Next Day ($124.50)'},false),12450);
  assert.throws(()=>core.quotedShipping('ship',ups,{value:'unknown',label:'Unknown service ($25.00)'},false));
  assert.equal(core.quotedShipping('delivery',{rate:'$25.00'}),2500);
  assert.equal(core.quotedShipping('pickup',null),0);
});
