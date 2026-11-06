'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),core=require('../BuyNowPilot');
const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8'),start=source.indexOf('    function requestFastUpdate()'),end=source.indexOf('    function editableFast(',start);
function fixture(options={}) {
 let refresh=0,seeds=0,clears=0,presented=0;const item={pid:'85',code:'0001363',quantity:1,unit:'ea'};
 const original={cartCheckout:options.cartCheckout!==false,ready:!!options.ready,stopped:!!options.stopped,securePayment:!!options.securePayment,revision:0,method:'delivery',address:{zip:'77833'},pickupPerson:'Test collector',reference:'Test reference'};
 const context=vm.createContext({fast:original,submitting:false,busy:!!options.busy,active:{cartCheckout:original.cartCheckout,purchase:[item]},frame:{contentDocument:{}},proposedItems:()=>[item],keepCartDraft(){},updatePickupReadiness(){},warmPickupStock(){},clearFrame(){clears++;context.frame=null;},paymentWorkspace(){},presentDraft(){presented++;},seedSession(){seeds++;},refreshFast(){refresh++;return Promise.resolve();}});
 vm.runInContext(source.slice(start,end),context);return {context,original,change(method){context.fast.method=method;context.requestFastUpdate();},counts:()=>({refresh,seeds,clears,presented})};
}
test('rapid method edits preserve the latest draft without restarting native checkout',()=>{
 for(const cartCheckout of [true,false]) {
  const f=fixture({cartCheckout,ready:true});for(const method of ['pickup','delivery','ship','pickup'])f.change(method);
  assert.equal(f.context.fast.method,'pickup');assert.equal(f.context.fast.pickupPerson,'Test collector');assert.equal(f.context.fast.reference,'Test reference');assert.equal(f.context.fast.address.zip,'77833');
  assert.notEqual(f.context.fast,f.original);assert.equal(f.context.fast.revision,4);assert.equal(f.context.fast.dirty,true);assert.equal(f.context.fast.ready,false);assert.equal(f.context.fast.review,null);
  assert.deepEqual(f.counts(),{refresh:0,seeds:0,clears:4,presented:4});
 }
});
test('edits remain drafts during preflight, a stopped checkout or secure-payment navigation',()=>{
 for(const options of [{busy:true},{stopped:true},{securePayment:true}]) {const f=fixture(options);f.change('ship');assert.equal(f.context.fast.dirty,true);assert.equal(f.counts().refresh,0);assert.equal(f.context.fast.securePayment,false);assert.equal(f.context.fast.refreshQueued,options.busy?true:undefined);}
});
test('the explicit draft Review click refreshes once and never submits the old order',()=>{
 let handler,refreshes=0,submits=0;
 const context=vm.createContext({fast:{dirty:true,ready:true},busy:false,frame:{contentDocument:{}},overlay:{querySelector:()=>({addEventListener:(name,fn)=>{handler=fn;}})},refreshFast(){refreshes++;context.busy=true;return Promise.resolve();},submitNative(){submits++;return Promise.resolve();},showError(error){throw error;}});
 const clickStart=source.indexOf("      overlay.querySelector('[data-bn-confirm]').addEventListener('click', function () {");
 vm.runInContext(source.slice(clickStart,source.indexOf('      loading(true);',clickStart)),context);
 handler();handler();assert.equal(refreshes,1);assert.equal(submits,0);
});
test('loading timeout does not abandon an open editor or secure payment, while a stalled ordinary load remains bounded',async()=>{
 const driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 for(const mode of ['editor','payment','total','stalled']) {
  let halted=false;const page={documentElement:{dataset:{}},getElementById:()=>null,querySelector:()=>null};
  const fast={started:Date.now()-130000,editor:mode==='editor'?'address':'',securePayment:mode==='payment',paymentQuote:mode==='total'?{}:null};
  const context=vm.createContext({fast,busy:false,submitting:false,active:{phase:'checking_out'},nativeFormsReady:()=>true,haltFast(){halted=true;},setStage(){},fastText(){},loading(){},status(){},paymentWorkspace(){},paymentTotalGate:()=>true});
  vm.runInContext(driver,context);await context.driveFast({},page);assert.equal(halted,mode==='stalled');
 }
});

test('a native navigation with a temporarily detached document does not stop the active checkout',async()=>{
 const driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 const fast={started:Date.now(),driving:false};
 const context=vm.createContext({fast,busy:false,submitting:false,active:{phase:'checking_out'}});
 vm.runInContext(driver,context);await context.driveFast({}, {documentElement:null});assert.equal(fast.driving,false);assert.equal(fast.stopped,undefined);
});

test('switching back from UPS clears the old shipping-speed caption in the pickup or delivery draft',()=>{
  const rendered={},context=vm.createContext({fast:{methods:{},method:'ship',date:'',ready:false},guest:false,overlay:null,submitting:false,fastText:(key,value)=>{rendered[key]=value;},deliveryAddressSummary:core.deliveryAddressSummary,pickupPersonName:core.pickupPersonName,shippingEstimate:core.shippingEstimate});
  vm.runInContext(source.slice(source.indexOf('    function updateFastOptions('),source.indexOf('    function requestPickupPerson(')),context);
  context.updateFastOptions();assert.equal(rendered['[data-bn-timing]'],'UPS Ground');
  for(const method of ['pickup','delivery']) {context.fast.method=method;context.updateFastOptions();assert.equal(rendered['[data-bn-timing]'],'Earliest available');}
});

test('local delivery hides after an unavailable quote and returns for pending or available quotes',()=>{
  const buttons=Object.fromEntries(['pickup','delivery','ship'].map(method=>[method,{hidden:false,dataset:{},attributes:{},setAttribute(name,value){this.attributes[name]=value;}}]));
  const context=vm.createContext({fast:{methods:{},method:'ship',date:'',ready:false},guest:false,submitting:false,
    overlay:{querySelector(selector){const method=selector.match(/^\[data-bn-method="(pickup|delivery|ship)"\]$/);return method?buttons[method[1]]:null;},querySelectorAll:()=>[]},
    fastText(){},loading(){},deliveryAddressSummary:core.deliveryAddressSummary,pickupPersonName:core.pickupPersonName,shippingEstimate:core.shippingEstimate});
  vm.runInContext(source.slice(source.indexOf('    function updateFastOptions('),source.indexOf('    function requestPickupPerson(')),context);
  for(const quote of [
    {options:{delivery:{available:false,reason:'outside-texas'},ups:{available:true,amount:81.93}}},
    null,
    {options:{delivery:{available:true,amount:25},ups:{available:true,amount:81.93}}}
  ]) {
    context.fast.methods=core.fulfillmentOptions(true,quote);context.updateFastOptions();
    assert.equal(buttons.delivery.hidden,!!quote&&!quote.options.delivery.available);
    assert.equal(buttons.delivery.disabled,!!quote&&!quote.options.delivery.available);
    assert.equal(buttons.pickup.hidden,false);assert.equal(buttons.ship.hidden,false);
    assert.equal(buttons.ship.disabled,false);assert.equal(buttons.ship.attributes['aria-pressed'],'true');
  }
});
