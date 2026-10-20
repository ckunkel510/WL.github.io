'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),core=require('../BuyNowPilot');
const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8'),start=source.indexOf('    function requestFastUpdate()'),end=source.indexOf('    function editableFast(',start);
function fixture(options={}) {
 let refresh=0,seeds=0;const item={pid:'85',code:'0001363',quantity:1,unit:'ea'};
 const fast={cartCheckout:options.cartCheckout!==false,ready:!!options.ready,stopped:!!options.stopped,securePayment:!!options.securePayment};
 const page={URL:options.page==='blank'?'about:blank':'https://webtrack.woodsonlumber.com/ShoppingCart.aspx',getElementById:()=>options.page==='details'?null:{}};
 const context=vm.createContext({fast,submitting:false,busy:!!options.busy,active:{cartCheckout:fast.cartCheckout,purchase:[item]},frame:{contentDocument:page},signature:core.signature,proposedItems:()=>[{...item,quantity:options.changedBasket?2:1}],updatePickupReadiness(){},updateFastOptions(){},warmPickupStock(){},seedSession(){seeds++;},refreshFast(){refresh++;return Promise.resolve();},showError(){throw Error('Unexpected error');}});
 vm.runInContext(source.slice(start,end),context);context.requestFastUpdate();return {refresh,seeds,fast};
}
test('early option edits keep native blank/cart entry requests running for cart and Quick buy',()=>{
 for(const page of ['blank','cart'])for(const cartCheckout of [true,false]) { const f=fixture({page,cartCheckout});assert.equal(f.refresh,0);assert.equal(f.seeds,1); }
});
test('changed Quick buy baskets and later, stopped or payment stages retain full refresh protection',()=>{
 for(const options of [{changedBasket:true,cartCheckout:false},{page:'details'},{stopped:true},{ready:true},{securePayment:true}]) {
  const f=fixture(options);assert.equal(f.refresh,1);assert.equal(f.seeds,0);
 }
});
test('early edits during preflight remain queued without bypassing the busy guard',()=>{
 const f=fixture({busy:true});assert.equal(f.fast.refreshQueued,true);assert.equal(f.refresh,0);assert.equal(f.seeds,0);
});
test('loading timeout does not abandon an open editor or secure payment, while a stalled ordinary load remains bounded',async()=>{
 const driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 for(const mode of ['editor','payment','stalled']) {
  let halted=false;const page={documentElement:{dataset:{}},getElementById:()=>null,querySelector:()=>null};
  const fast={started:Date.now()-130000,editor:mode==='editor'?'address':'',securePayment:mode==='payment'};
  const context=vm.createContext({fast,busy:false,submitting:false,active:{phase:'checking_out'},nativeFormsReady:()=>true,haltFast(){halted=true;},setStage(){},fastText(){},loading(){},status(){},paymentWorkspace(){}});
  vm.runInContext(driver,context);await context.driveFast({},page);assert.equal(halted,mode==='stalled');
 }
});

test('a native navigation with a temporarily detached document does not stop the active checkout',async()=>{
 const driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 const fast={started:Date.now(),driving:false};
 const context=vm.createContext({fast,busy:false,submitting:false,active:{phase:'checking_out'}});
 vm.runInContext(driver,context);await context.driveFast({}, {documentElement:null});assert.equal(fast.driving,false);assert.equal(fast.stopped,undefined);
});
