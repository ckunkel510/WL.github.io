'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../wl-site.js'),'utf8');
function storage(fail=false) {const data=new Map();return {getItem:k=>fail?null:data.get(k)||null,setItem(k,v){if(fail)throw Error('blocked');data.set(k,String(v));},removeItem(k){if(fail)throw Error('blocked');data.delete(k);}};}
function setup(options={}) {
  const local=options.local||storage(),session=options.session||storage(),events=[];
  const doc={readyState:'loading',body:null,head:{appendChild(){}},addEventListener(){},querySelector(){return null;},getElementById(){return null;},createElement(){return {setAttribute(){}};}};
  const win={dataLayer:events,localStorage:local,sessionStorage:session,location:{pathname:'/ProductDetail.aspx',search:'?pid=85'},setTimeout(){},dispatchEvent(){}};
  if(options.badTransport)win.gtag=()=>{throw Error('unavailable');};
  vm.runInNewContext(source,{window:win,document:doc,CustomEvent:class{constructor(name,init){this.detail=init.detail;}}});
  return {win,doc,local,session,events,api:win.WLAnalytics};
}
function page({success=true,merchant=true,order='W123456',message='Thank you. Order number W123456'}={}) {
  return {defaultView:{location:{search:success?'?success=1':'?success=0'}},getElementById(id){if(id==='ctl00_PageBody_CompleteCheckoutButton')return {};if(id==='CartResponseMessage')return {textContent:message,querySelector:()=>({textContent:order})};if(id==='ctl00_PageBody_SuccessfulPaymentResults_MerchantDetailsPanel')return merchant?{textContent:'Woodson Lumber'}:null;return null;}};
}
const details=(overrides={})=>({id:'CC-local-test',flow:'compact_cart',customerType:'guest',method:'delivery',paymentType:'stored_card',items:[{pid:'85',name:'Fish food',code:'0001363',quantity:3,price:2}],totals:{subtotal:'$6.00',tax:'$0.50',shipping:'$25.00',total:'$31.50'},...overrides});
const purchases=f=>f.events.filter(e=>e.event_name==='purchase');
test('compact and Quick buy each emit one proven purchase with actual quantities and merchandise value',()=>{
 for(const flow of ['quick_buy','compact_cart'])for(const customerType of ['guest','signed_in']){
  const f=setup(),d=details({flow,customerType});
  assert.equal(f.api.checkout('begin',d),true);assert.equal(purchases(f).length,0);
  assert.equal(f.api.checkout('review',d,page()),true);
  f.session.setItem('wl_analytics_pending_cart_v1','unfinished-action');
  const confirmation=page();assert.equal(f.api.checkout('purchase',{...d,orderNumber:'W123456'},confirmation),true);
  assert.equal(f.api.checkout('purchase',{...d,orderNumber:'W123456'},confirmation),false);
  assert.equal(f.session.getItem('wl_analytics_pending_cart_v1'),null);
  const p=purchases(f)[0];assert.equal(p.ecommerce.value,6);assert.equal(p.ecommerce.tax,.5);assert.equal(p.ecommerce.shipping,25);assert.equal(p.ecommerce.items[0].quantity,3);assert.equal(p.ecommerce.transaction_id,'W123456');
  assert.equal(p.checkout_flow,flow);assert.equal(p.customer_type,customerType);assert.equal(p.fulfillment_method,'delivery');assert.equal(p.payment_type,'stored_card');assert.equal(p.page_type,'order_confirmation');
  const ga=f.events.filter(e=>e[0]==='event'&&e[1]==='purchase');assert.equal(ga.length,1);assert.equal(ga[0][2].transaction_id,'W123456');assert.equal(ga[0][2].value,6);
 }
});
test('clicks, review, payment entry, errors and cancellation never create a purchase',()=>{
 const f=setup(),d=details();for(const stage of ['begin','shipping','payment','review','submit','error','cancel'])f.api.checkout(stage,d,page());
 assert.equal(purchases(f).length,0);assert.equal(f.api.track('purchase',{ecommerce:{transaction_id:'fake',value:900}}),false);
 assert.equal(f.api.checkout('purchase',{...d,orderNumber:'W123456'},page()),false); // Cancel removed this review.
});
test('missing native success, declined response, mismatched order and missing merchant fail closed',()=>{
 for(const invalid of [{success:false},{merchant:false},{order:'error',message:'Order failed'},{message:'Payment declined'},{order:'W999999'}]){
  const f=setup(),d=details();f.api.checkout('review',d,page());
  assert.equal(f.api.checkout('purchase',{...d,orderNumber:'W123456'},page(invalid)),false);assert.equal(purchases(f).length,0);
 }
});
test('a different or stale review cannot supply purchase values',()=>{
 for(const mode of ['missing','other','stale','invalid']){
  const f=setup(),d=details();if(mode==='other')f.api.checkout('review',details({id:'different'}),page());
  if(mode==='stale')f.session.setItem('wl_analytics_review_v2',JSON.stringify({at:Date.now()-3*60*60*1000,key:d.id,items:d.items,amounts:{value:999}}));
  if(mode==='invalid')assert.equal(f.api.checkout('review',details({totals:{subtotal:6,tax:.5,shipping:25,total:6}}),page()),false);
  f.local.setItem('wl_analytics_cart_v1',JSON.stringify({updated_at:new Date().toISOString(),items:[{item_id:'97',quantity:99}],value:999}));
  f.session.setItem('purchaseSubtotal','999');
  assert.equal(f.api.checkout('purchase',{...d,orderNumber:'W123456'},page()),false);assert.equal(purchases(f).length,0);
 }
});
test('native confirmation without a verified review never borrows stale cart totals',()=>{
 const f=setup();f.local.setItem('wl_analytics_cart_v1',JSON.stringify({updated_at:new Date().toISOString(),items:[{item_id:'97',quantity:99}],value:999}));f.session.setItem('purchaseSubtotal','999');
 // A confirmed native order is genuine, but unknown amounts must remain unknown.
 Object.assign(f.doc,page());f.win.location.pathname='/ShoppingCart.aspx';f.win.location.search='?success=1';f.api.refresh();
 const p=purchases(f)[0];assert.ok(p);assert.equal(p.ecommerce.value,undefined);assert.equal(p.ecommerce.items.length,0);
});
test('confirmation refresh and a second runtime share transaction deduplication',()=>{
 const f=setup(),d=details();f.api.checkout('review',d,page());f.api.checkout('purchase',{...d,orderNumber:'W123456'},page());
 const again=setup({local:f.local,session:f.session});again.api.checkout('review',d,page());assert.equal(again.api.checkout('purchase',{...d,orderNumber:'W123456'},page()),false);assert.equal(purchases(again).length,0);
});
test('transport and persistent-storage failures do not duplicate confirmed events',()=>{
 const f=setup({local:storage(true),session:storage(true),badTransport:true}),d=details();f.api.checkout('review',d,page());
 assert.equal(f.api.checkout('purchase',{...d,orderNumber:'W123456'},page()),true);assert.equal(f.api.checkout('purchase',{...d,orderNumber:'W123456'},page()),false);assert.equal(purchases(f).length,1);
});
test('checkout metadata excludes account, address, payment details and free-form text',()=>{
 const f=setup(),d=details({email:'test@example.invalid',address:'Secret street',card:'4111111111111111',notes:'secret notes',user_id:'private',paymentFingerprint:'secret fingerprint'});
 f.api.checkout('review',d,page());f.api.checkout('purchase',{...d,orderNumber:'W123456'},page());
 const json=JSON.stringify(f.events);for(const value of ['test@example.invalid','Secret street','4111111111111111','secret notes','private','secret fingerprint','CC-local-test'])assert.ok(!json.includes(value),value);
});
test('legitimate zero-value employee orders keep their confirmed zero instead of an old amount',()=>{
 const f=setup(),d=details({customerType:'signed_in',totals:{subtotal:0,tax:0,shipping:0,total:0},paymentType:'no_payment_due'});f.session.setItem('purchaseSubtotal','123.45');
 assert.equal(f.api.checkout('review',d,page()),true);assert.equal(f.api.checkout('purchase',{...d,orderNumber:'W123456'},page()),true);assert.equal(purchases(f)[0].ecommerce.value,0);
});

test('cart edits cannot reuse an earlier review or its amounts',()=>{
 const f=setup(),d=details();f.api.checkout('review',d,page());
 const changed=details({items:[{pid:'97',name:'Different product',quantity:2}]});
 assert.equal(f.api.checkout('shipping',changed,page()),true);
 const e=f.events.filter(e=>e.event_name==='add_shipping_info')[0];assert.equal(e.ecommerce.items[0].item_id,'97');assert.equal(e.ecommerce.value,undefined);
 assert.equal(f.api.checkout('submit',changed,page()),false);
 assert.equal(f.api.checkout('purchase',{...changed,orderNumber:'W123456'},page()),false);assert.equal(purchases(f).length,0);
});
test('an accepted stage is deduplicated across final-review hydration',()=>{
 const f=setup(),d=details();assert.equal(f.api.checkout('shipping',d,page()),true);
 assert.equal(f.api.checkout('payment',d,page()),true);f.api.checkout('review',d,page());
 assert.equal(f.api.checkout('shipping',d,page()),false);assert.equal(f.api.checkout('payment',d,page()),false);
 assert.equal(f.events.filter(e=>e.event_name==='add_shipping_info').length,1);assert.equal(f.events.filter(e=>e.event_name==='add_payment_info').length,1);
});

test('native final-review unit prices override stale preview prices by product code',()=>{
 const f=setup(),d=details(),review=page();
 const base=review.getElementById;review.getElementById=id=>id.includes('BasketLinesGrid')?{querySelectorAll(selector){if(selector==='thead th')return ['Code','Description','Qty','Unit Price'].map(textContent=>({textContent}));return [{querySelectorAll:()=>['0001363','Fish food','3','$1.50'].map(textContent=>({textContent}))}];}}:base(id);
 f.api.checkout('review',d,review);f.api.checkout('purchase',{...d,orderNumber:'W123456'},page());
 assert.equal(purchases(f)[0].ecommerce.items[0].price,1.5);
});

test('cart uplift does not count as a second checkout start',()=>{
 const f=setup(),d=details();assert.equal(f.api.checkout('begin',d),true);
 const edited=details({items:[...d.items,{pid:'97',name:'Drink',quantity:2}],includedCartItems:1});
 assert.equal(f.api.checkout('begin',edited),false);f.api.checkout('review',edited,page());f.api.checkout('purchase',{...edited,orderNumber:'W123456'},page());
 assert.equal(f.events.filter(e=>e.event_name==='begin_checkout').length,1);assert.equal(purchases(f)[0].included_cart_items,1);assert.equal(purchases(f)[0].ecommerce.items.length,2);
});

test('bridge keeps the accepted payment category through submit and confirmation',()=>{
 const pilot=fs.readFileSync(require.resolve('../BuyNowPilot.js'),'utf8');
 const helper=pilot.slice(pilot.indexOf('    function measureCheckout('),pilot.indexOf('    async function fetchDocument('));
 for(const payment of ['new_card','stored_card','no_payment_due']){
  const calls=[],context=vm.createContext({measuredPayment:null,active:{id:'current',cartCheckout:true,guestCheckout:true,purchase:details().items},fast:{revision:0,securePayment:payment==='new_card',paymentFingerprint:payment==='stored_card'?'never-send-me':''},win:{WLAnalytics:{checkout:(stage,detail)=>calls.push({stage,detail})}}});
  vm.runInContext(helper,context);context.measureCheckout('review',page(),{employeeZero:payment==='no_payment_due'});context.fast.securePayment=false;context.measureCheckout('submit');context.measureCheckout('purchase',page(),null,'W123456');
  assert.deepEqual(calls.map(e=>e.detail.paymentType),[payment,payment,payment]);assert.ok(!JSON.stringify(calls).includes('never-send-me'));
 }
});

test('late native confirmation records measurement without relaxing uncertain-order recovery',async()=>{
 const pilot=fs.readFileSync(require.resolve('../BuyNowPilot.js'),'utf8'),inspect=pilot.slice(pilot.indexOf('    async function inspectFrame('),pilot.indexOf('    function setNative('));
 for(const phase of ['checking_out','uncertain']){
  const native=page(),calls=[],context=vm.createContext({frame:{contentDocument:native},active:{phase},URL,text:v=>v,busy:false,measureCheckout:(...args)=>calls.push(args)});
  vm.runInContext(inspect,context);await assert.rejects(context.inspectFrame({location:{href:'https://example.test/ShoppingCart.aspx?success=1'}},native),/confirmation needs review/);
  assert.equal(calls.length,phase==='uncertain'?1:0);assert.equal(context.active.phase,phase);
 }
});

test('checkout review records bounded loading time without changing purchase amounts',()=>{
 for(const [readyMs,expected] of [[1234.4,1234],[-1,undefined],[NaN,undefined],[1800001,undefined]]){
 const f=setup(),d=details({readyMs});f.api.checkout('review',d,page());const event=f.events.find(e=>e.event_name==='checkout_review');assert.equal(event.checkout_ready_ms,expected);assert.equal(event.ecommerce.value,6);}
});
test('browse event sign-in state comes from native navigation and cannot contain an account identifier',()=>{
 const f=setup();f.api.track('navigation_click',{sign_in_state:'forged',destination_path:'/ShoppingCart.aspx'});assert.equal(f.events.find(e=>e.event_name==='navigation_click').sign_in_state,'signed_out');
 f.doc.querySelector=selector=>selector.includes('SignOut=1')?{}:null;f.api.track('view_cart',{});assert.equal(f.events.find(e=>e.event_name==='view_cart').sign_in_state,'signed_in');
});
