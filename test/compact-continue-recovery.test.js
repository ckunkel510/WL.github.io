'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const checkout=fs.readFileSync(require.resolve('../Checkout2.js'),'utf8');
function proxyFixture() {
 let handler,posts=0,valid=true,confirm=async()=>true;
 const proxy={dataset:{},textContent:'Continue Checkout',addEventListener(type,fn){handler=fn}};
 const context=vm.createContext({proxy,window:{WLCheckout:{validateBeforeFinalSubmit:()=>valid}},wizard:{querySelector:()=>null},clearInlineError(){},showInlineError(){},showStep(){},syncFulfillmentForNativeSubmit:()=>confirm(),syncNativeRequiredDate(){},clickNativeContinue(){posts++;return true;},native:{},document:{querySelector:()=>null}});
 const start=checkout.indexOf('          proxy.addEventListener("click", async function () {');
 vm.runInContext(checkout.slice(start,checkout.indexOf('          navDiv.appendChild(proxy);',start)),context);
 return {proxy,click:()=>handler(),posts:()=>posts,invalid(){valid=false},confirm(fn){confirm=fn}};
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
 assert.equal(checks,1);assert.equal(f.posts(),0);finish(true);await pending;await f.click();assert.equal(f.posts(),1);
});
test('compact checkout surfaces a pre-postback rejection immediately and keeps its native details reusable',async()=>{
 const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
 const driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 for(const state of ['blocked','confirming','posting']) {
  let halted='';const marker={bnDetailsContinued:'1'};
  const page={documentElement:{dataset:marker},getElementById:id=>['btnDelivered','btnPickup'].includes(id)?{}:null,querySelector:()=>({dataset:{wlContinueState:state,wlContinueReason:'fulfillment'}})};
  const context=vm.createContext({fast:{started:Date.now()},busy:false,submitting:false,active:{phase:'checking_out'},nativeFormsReady:()=>true,setStage(){},haltFast(message){halted=message;},status(){}});
  vm.runInContext(driver,context);await context.driveFast({},page);
  assert.equal(!!halted,state==='blocked');assert.equal(marker.bnDetailsContinued,state==='blocked'?undefined:'1');
 }
});

test('recoverable rate failures keep compact Retry while native entry failures retain standard recovery',()=>{
 const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
 let handoffs=0;
 const context=vm.createContext({fast:{},overlay:{querySelector:()=>({})},measureCheckout(){},loading(){},status(){},fastText(){},updateFastOptions(){},recoverStandard(){handoffs++;return true;}});
 vm.runInContext(source.slice(source.indexOf('    function haltFast('),source.indexOf('    async function driveFast(')),context);
 context.haltFast('Retry rates','fulfillment_quote_timeout',true);assert.equal(handoffs,0);assert.equal(context.fast.stopped,true);
 context.fast={};context.haltFast('Native entry failed','native_entry_unavailable');assert.equal(handoffs,1);
});
