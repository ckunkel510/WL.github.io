'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const checkout=fs.readFileSync(require.resolve('../Checkout2.js'),'utf8');
function proxyFixture(compact=false) {
 let handler,posts=0,valid=true,confirm=async()=>true;
 const proxy={dataset:{},textContent:'Continue Checkout',addEventListener(type,fn){handler=fn}};
 const context=vm.createContext({awaitNativeDetails:async()=>true,getSaleType:()=>'pickup',getBranchField:()=>null,isBuyNowFrame:()=>compact,proxy,window:{WLCheckout:{validateBeforeFinalSubmit:()=>valid}},wizard:{querySelector:()=>null},clearInlineError(){},showInlineError(){},showStep(){},syncFulfillmentForNativeSubmit:()=>confirm(),syncNativeRequiredDate(){},clickNativeContinue(){posts++;return true;},native:{},document:{querySelector:()=>null,getElementById:()=>null}});
 const start=checkout.indexOf('          proxy.addEventListener("click", async function () {');
 vm.runInContext(checkout.slice(start,checkout.indexOf('          navDiv.appendChild(proxy);',start)),context);
 return {proxy,click:()=>handler(),posts:()=>posts,invalid(){valid=false},confirm(fn){confirm=fn},nativeReady(fn){context.awaitNativeDetails=fn}};
}
test('native proxy identifies validation and rate rejection before any postback and allows a corrected retry',async()=>{
 for(const reason of ['validation','fulfillment']) {
  const f=proxyFixture();if(reason==='validation')f.invalid();else f.confirm(async()=>false);
  await f.click();assert.equal(f.posts(),0);assert.equal(f.proxy.dataset.wlContinueState,'blocked');assert.equal(f.proxy.dataset.wlContinueReason,reason);
  if(reason==='fulfillment'){f.confirm(async()=>true);await f.click();assert.equal(f.posts(),1);assert.equal(f.proxy.dataset.wlContinueState,'posting');}
 }
});
test('repeated Continue cannot duplicate an in-flight reservation or native postback',async()=>{
 const f=proxyFixture();let finish,checks=0;
 f.confirm(()=>{checks++;return new Promise(resolve=>{finish=resolve})});const pending=f.click();await f.click();
 assert.equal(checks,1);assert.equal(f.posts(),0);finish(true);await pending;f.proxy.disabled=false;await f.click();assert.equal(f.posts(),1);
});
test('compact checkout surfaces a pre-postback rejection immediately and keeps its native details reusable',async()=>{
 const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
 const driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 for(const state of ['blocked','confirming','posting']) {
  let halted='';const marker={bnDetailsContinued:'1'};
  const page={documentElement:{dataset:marker},getElementById:id=>['btnDelivered','btnPickup'].includes(id)?{}:null,querySelector:()=>({dataset:{wlContinueState:state,wlContinueReason:'fulfillment'}}),querySelectorAll:()=>[]};
  const context=vm.createContext({fast:{started:Date.now()},busy:false,submitting:false,active:{phase:'checking_out'},nativeFormsReady:()=>true,setStage(){},haltFast(message){halted=message;},status(){}});
  vm.runInContext(driver,context);await context.driveFast({},page);
  assert.equal(!!halted,state==='blocked');assert.equal(marker.bnDetailsContinued,state==='blocked'?undefined:'1');
 }
});

test('recoverable rate failures keep compact Retry while native entry failures retain standard recovery',()=>{
 const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
 let handoffs=0;
 const context=vm.createContext({fast:{},overlay:{dataset:{},querySelector:()=>({})},measureCheckout(){},loading(){},status(){},fastText(){},updateFastOptions(){},recoverStandard(){handoffs++;return true;}});
 vm.runInContext(source.slice(source.indexOf('    function haltFast('),source.indexOf('    async function driveFast(')),context);
 context.haltFast('Retry rates','fulfillment_quote_timeout',true);assert.equal(handoffs,0);assert.equal(context.fast.stopped,true);
 context.fast={};context.haltFast('Native entry failed','native_entry_unavailable');assert.equal(handoffs,1);
});

test('a same-document WebForms transition cannot turn a completed shipping step into a details quote error',async()=>{
 const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
 const driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 const elements=new Map([['btnDelivered',{}],['btnPickup',{}]]),stages=[];let finish,halts=0;
 const page={documentElement:{dataset:{bnFieldsApplied:'1'}},getElementById:id=>elements.get(id)||null,querySelector:()=>null};
 const child={WLCheckout:{refreshDateUI(){},validateBeforeFinalSubmit(){}},WLShippingOffer:{current:()=>null,refresh:()=>null,refreshCheckout:()=>new Promise(resolve=>{finish=resolve})},__wlPickupShippingAutoAdvance:true};
 const context=vm.createContext({fast:{method:'ship',started:Date.now()},frame:{contentDocument:page},active:{phase:'checking_out',purchase:[]},busy:false,submitting:false,nativeFormsReady:()=>true,setStage:n=>stages.push(n),status(){},haltFast(){halts++},quoteForCart:core.quoteForCart,fulfillmentOptions:()=>({}),updateFastOptions(){},detailsQuotes:new WeakMap(),refreshDetailsQuote:core.refreshDetailsQuote,cachePaymentTotal:()=>true,win:{setTimeout:()=>1,clearTimeout(){}}});
 vm.runInContext(driver,context);const pending=context.driveFast(child,page);await Promise.resolve();
 assert.ok(finish);elements.clear();elements.set('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView',{});
 await context.driveFast(child,page);assert.deepEqual(stages,[1,2],'the next step must not wait for the old quote');
 finish(null);await pending;assert.equal(halts,0,'an obsolete details request must not halt the shipping page');
});

test('a details view replaced during identity verification is never hydrated or submitted',async()=>{
 const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8'),driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 let finish,hydrated=0;const elements=new Map([['btnDelivered',{}],['btnPickup',{}]]);
 const page={documentElement:{dataset:{}},getElementById:id=>elements.get(id)||null,querySelector:()=>null};
 const context=vm.createContext({fast:{method:'ship',started:Date.now()},frame:{contentDocument:page},active:{phase:'checking_out'},busy:false,submitting:false,nativeFormsReady:()=>true,setStage(){},status(){},checkIdentity:()=>new Promise(resolve=>{finish=resolve}),applyContactDefaults(){hydrated++},guest:false,settings:{},account:{},contactDefaults:()=>({}),hydrateMatchingAddressState(){},accountAddress:()=>({}),quoteForCart:()=>null,detailsQuotes:new WeakMap(),fulfillmentOptions:()=>({}),updateFastOptions(){}});
 vm.runInContext(driver,context);const pending=context.driveFast({WLCheckout:{refreshDateUI(){},validateBeforeFinalSubmit(){}}},page);
 elements.clear();finish();await pending;assert.equal(hydrated,0);assert.equal(page.documentElement.dataset.bnFieldsApplied,undefined);
});

test('an outgoing details page cannot report quote failure or repeat its native postback',async()=>{
 const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8'),driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 for(const pendingKind of ['compact','native','proxy','departing']) {
  let finish,halts=0,quotes=0;const elements=new Map([['btnDelivered',{}],['btnPickup',{}]]),proxy={dataset:{}};
  const page={documentElement:{dataset:{bnFieldsApplied:'1'}},getElementById:id=>elements.get(id)||null,querySelector:selector=>selector==='.wl-proxy-continue'?proxy:null,querySelectorAll:()=>[]};
  const child={WLCheckout:{refreshDateUI(){},validateBeforeFinalSubmit(){}},WLShippingOffer:{current:()=>null,refresh:()=>null,refreshCheckout:()=>{quotes++;return new Promise(resolve=>{finish=resolve})}}};
  const context=vm.createContext({fast:{method:'ship',started:Date.now()},frame:{contentDocument:page},active:{phase:'checking_out',purchase:[]},busy:false,submitting:false,nativeFormsReady:()=>true,setStage(){},status(){},haltFast(){halts++},quoteForCart:core.quoteForCart,fulfillmentOptions:()=>({}),updateFastOptions(){},detailsQuotes:new WeakMap(),refreshDetailsQuote:core.refreshDetailsQuote,win:{setTimeout:()=>1,clearTimeout(){}}});
  vm.runInContext(driver,context);const pending=context.driveFast(child,page);await Promise.resolve();assert.ok(finish);
  if(pendingKind==='compact')page.documentElement.dataset.bnDetailsContinued='1';
  else if(pendingKind==='native')page.documentElement.dataset.bnNativePostTarget='ctl00$PageBody$ContinueButton2';
  else if(pendingKind==='departing')page.documentElement.dataset.bnDeparting='1';
  else proxy.dataset.wlContinueState='posting';
  finish(null);await pending;await context.driveFast(child,page);assert.equal(halts,0,pendingKind);assert.equal(quotes,1,pendingKind);
 }
});

test('an old view promise cannot release the replacement view driver',async()=>{
 const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8'),driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 const finishes=[],elements=new Map([['btnDelivered',{}],['btnPickup',{}]]);let halts=0;
 const page={documentElement:{dataset:{bnFieldsApplied:'1'}},getElementById:id=>elements.get(id)||null,querySelector:()=>null};
 const child={WLCheckout:{refreshDateUI(){},validateBeforeFinalSubmit(){}},WLShippingOffer:{current:()=>null,refresh:()=>null,refreshCheckout:()=>new Promise(resolve=>finishes.push(resolve))}};
 const context=vm.createContext({fast:{method:'ship',started:Date.now()},frame:{contentDocument:page},overlay:{dataset:{}},active:{phase:'checking_out',purchase:[]},busy:false,submitting:false,nativeFormsReady:()=>true,setStage(){},status(){},haltFast(){halts++},quoteForCart:core.quoteForCart,fulfillmentOptions:()=>({}),updateFastOptions(){},detailsQuotes:new WeakMap(),refreshDetailsQuote:core.refreshDetailsQuote,win:{setTimeout:()=>1,clearTimeout(){}}});
 vm.runInContext(driver,context);const first=context.driveFast(child,page);await Promise.resolve();
 elements.set('btnPickup',{});elements.set('btnDelivered',{});const second=context.driveFast(child,page);await Promise.resolve();assert.equal(finishes.length,2);
 const owner=context.fast.driving;finishes[0](null);await first;assert.equal(context.fast.driving,owner);assert.equal(halts,0);
 finishes[1](null);await second;assert.equal(halts,1);assert.equal(context.fast.driving,false);
});

test('a replacement WebForms request manager is rechecked after a quote await',async()=>{
 const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8'),driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 const elements=new Map([['btnDelivered',{}],['btnPickup',{}]]);let finish,halts=0,manager={get_isInAsyncPostBack:()=>false};
 const page={URL:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx',readyState:'complete',documentElement:{dataset:{bnFieldsApplied:'1'}},getElementById:id=>elements.get(id)||null,querySelector:selector=>selector==='form'?{}:null};
 const child={document:page,Sys:{Application:{get_isInitialized:()=>true},WebForms:{PageRequestManager:{getInstance:()=>manager}}},WLCheckout:{refreshDateUI(){},validateBeforeFinalSubmit(){}},WLShippingOffer:{current:()=>null,refresh:()=>null,refreshCheckout:()=>new Promise(resolve=>{finish=resolve})}};
 const context=vm.createContext({fast:{method:'ship',started:Date.now()},frame:{contentDocument:page},overlay:{dataset:{}},active:{phase:'checking_out',purchase:[]},busy:false,submitting:false,nativeFormsReady:core.nativeFormsReady,setStage(){},status(){},haltFast(){halts++},quoteForCart:core.quoteForCart,fulfillmentOptions:()=>({}),updateFastOptions(){},detailsQuotes:new WeakMap(),refreshDetailsQuote:core.refreshDetailsQuote,win:{setTimeout:()=>1,clearTimeout(){}}});
 vm.runInContext(driver,context);const pending=context.driveFast(child,page);await Promise.resolve();assert.ok(finish);
 manager={get_isInAsyncPostBack:()=>true};finish(null);await pending;assert.equal(halts,0);assert.equal(context.fast.driving,false);
});

test('Quick Buy retains its compact native Continue path',async()=>{
 const f=proxyFixture(true);await f.click();assert.equal(f.posts(),1);assert.equal(f.proxy.dataset.wlContinueState,'posting');
});

test('native Continue waits for the current form update and never posts after its bounded readiness failure',async()=>{
 const f=proxyFixture();let ready;
 f.nativeReady(()=>new Promise(resolve=>{ready=resolve}));const pending=f.click();await f.click();assert.equal(f.posts(),0);
 assert.equal(f.proxy.dataset.wlContinueState,'waiting');ready(false);await pending;
 assert.equal(f.posts(),0);assert.equal(f.proxy.disabled,false);assert.equal(f.proxy.dataset.wlContinueReason,'native-updating');
});
