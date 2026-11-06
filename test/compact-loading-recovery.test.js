'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function frameFixture() {
  let clock=0,tick,loads=0,installs=0,halts=[],mounted=false,sourceWrites=[];
  const events={},page={URL:'about:blank',readyState:'complete',body:{},querySelector:()=>null};
  const frame={contentDocument:page,setAttribute(){},addEventListener:(name,fn)=>events[name]=fn,
    get src(){return this.url;},set src(value){sourceWrites.push({value,mounted});this.url=value;}};
  const context=vm.createContext({frame:null,frameReadyTimer:null,installedPage:null,fast:{loading:true},active:{phase:'checking_out',cartCheckout:true},busy:false,submitting:false,
    overlay:{dataset:{},querySelector:()=>({classList:{add(){}}})},Date:{now:()=>clock},URL,
    doc:{createElement:()=>frame},win:{crypto:{randomUUID:()=> 'test-run'},setInterval:fn=>{tick=fn;return 1;}},
    haltFast(message,code){halts.push(code);context.fast.stopped=true;},showError(){loads++;},installFrame:async()=>{installs++;}});
  vm.runInContext(section('    function openFrame(','    async function installFrame('),context);
  context.openFrame({appendChild(){mounted=true;}});
  return {context,frame,page,sourceWrites,halts,installs:()=>installs,errors:()=>loads,
    tick(ms){clock=ms;tick();},load(){events.load();}};
}
test('frame mounts before its GET; a pending initial navigation is never cancelled and restarted',()=>{
  const f=frameFixture();assert.equal(f.sourceWrites[0].mounted,true);f.load();assert.equal(f.installs(),0);
  f.tick(4100);f.tick(6000);assert.equal(f.sourceWrites.length,1,'about:blank can represent a legitimate pending GET');
  f.tick(12001);assert.deepEqual(f.halts,['native_entry_unavailable']);
});
test('unavailable documents recover too, and detached-frame loads and timers cannot touch a replacement attempt',()=>{
  const unavailable=frameFixture();unavailable.frame.contentDocument=null;unavailable.tick(13000);assert.deepEqual(unavailable.halts,['native_entry_unavailable']);
  const stale=frameFixture();stale.context.frame={contentDocument:{}};stale.page.URL='https://webtrack.woodsonlumber.com/ShoppingCart.aspx';stale.load();stale.tick(13000);
  assert.equal(stale.installs(),0);assert.equal(stale.errors(),0);assert.equal(stale.sourceWrites.length,1);assert.deepEqual(stale.halts,[]);
});
test('a late install error from an earlier revision cannot stop a newer draft',async()=>{
  const f=frameFixture();let reject;
  f.context.installFrame=()=>new Promise((_,fail)=>{reject=fail;});f.page.URL='https://webtrack.woodsonlumber.com/ShoppingCart.aspx';f.load();
  f.context.fast={loading:true};reject(Error('Old load failed'));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.errors(),0);
});
test('a stalled native step has a bounded timeout, without replaying any entered native form',()=>{
  const f=frameFixture();f.page.URL='https://webtrack.woodsonlumber.com/ShoppingCart.aspx';f.page.querySelector=()=>({});f.context.installedPage=f.page;
  f.tick(1);f.tick(46002);assert.deepEqual(f.halts,['native_step_timeout']);assert.equal(f.sourceWrites.length,1);
});
test('customer editing, review, hosted payment, and final submission never time out into another checkout',()=>{
  for(const field of ['editor','dirty','ready','securePayment','paymentQuote','paymentAuthorizing','paymentApproval','submitting']) {
    const f=frameFixture();if(field==='submitting')f.context.submitting=true;else f.context.fast[field]=true;
    f.tick(13000);f.tick(90000);assert.deepEqual(f.halts,[],field);assert.equal(f.sourceWrites.length,1,field);
  }
});
function recoveryFixture() {
  let handoffs=0;
  const context=vm.createContext({cartEntry:true,active:{cartCheckout:true,phase:'checking_out'},fast:{},submitting:false,cancelPending:false,
    measureCheckout(){},standardCheckout(){handoffs++;}});
  vm.runInContext(section('    function recoverStandard(','    async function purchaseRestrictions('),context);
  return {context,handoffs:()=>handoffs};
}
test('a recoverable natural-cart failure requests standard checkout exactly once',()=>{
  const f=recoveryFixture();assert.equal(f.context.recoverStandard('native_entry_unavailable'),true);assert.equal(f.context.recoverStandard('native_entry_unavailable'),false);assert.equal(f.handoffs(),1);
});
test('automatic recovery cannot leave an isolated cart, customer editor, hosted payment, pending write or uncertain order',()=>{
  for(const mode of ['quick-buy','pending','uncertain','submitting','editor','dirty','securePayment','paymentAuthorizing','paymentApproval','cancel']) {
    const f=recoveryFixture();if(mode==='quick-buy')f.context.active.cartCheckout=false;
    else if(mode==='pending')f.context.active.pending={};else if(mode==='uncertain')f.context.active.phase='uncertain';
    else if(mode==='submitting')f.context.submitting=true;else if(mode==='cancel')f.context.cancelPending=true;else f.context.fast[mode]=true;
    assert.equal(f.context.recoverStandard('test'),false,mode);assert.equal(f.handoffs(),0,mode);
  }
});
test('back-to-cart session draft is basket/account scoped and cannot restore payment or readiness state',()=>{
  const data=new Map(),basket=[{pid:'85',code:'FISH',unit:'ea',quantity:2}],session={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)||null,removeItem:k=>data.delete(k)};
  const context=vm.createContext({draftKey:'draft:account-a',standardKey:'native:account-a',active:{cartCheckout:true,phase:'checking_out',current:basket},fast:{method:'ship',address:{line1:'Test street'},notes:'Keep dry',ready:true,paymentFingerprint:'must-not-persist'},submitting:false,
    nativeCartSignature:core.nativeCartSignature,doc:{documentElement:{dataset:{}}},win:{sessionStorage:session}});
  vm.runInContext(section('    function keepCartDraft(','    function recoverStandard('),context);
  context.keepCartDraft();let draft=context.cartDraft(basket);assert.equal(draft.address.line1,'Test street');assert.equal(draft.notes,'Keep dry');assert.equal(draft.ready,undefined);assert.equal(draft.paymentFingerprint,undefined);
  context.draftKey='draft:account-b';assert.equal(Object.keys(context.cartDraft(basket)).length,0);context.draftKey='draft:account-a';
  assert.equal(Object.keys(context.cartDraft([{...basket[0],quantity:3}])).length,0);context.keepCartDraft();
  const expired=JSON.parse(data.get(context.draftKey));expired.ts=Date.now()-1800001;data.set(context.draftKey,JSON.stringify(expired));assert.equal(Object.keys(context.cartDraft(basket)).length,0);
  data.set(context.standardKey,JSON.stringify({version:1,ts:Date.now()}));assert.equal(context.nativeCheckoutRequested(),true);context.standardKey='native:account-b';assert.equal(context.nativeCheckoutRequested(),false);
});
test('returning from standard checkout reseeds the same-basket draft after native reset listeners',()=>{
  const handlers=[],calls=[],options={address:{line1:'100 Test Yard'},method:'ship'};
  const control={getAttribute:()=>null},doc={documentElement:{dataset:{}},querySelector:()=>({})};
  const context=vm.createContext({ENABLE_CART_CHECKOUT:true,BUILD:'test',bypassCartEntry:false,active:null,doc,
    win:{navigator:{locks:{}},location:{pathname:'/ShoppingCart.aspx'},addEventListener:(name,fn,capture)=>handlers.push({fn,capture})},
    nativeCheckoutRequested:()=>true,cartFromDocument:()=>({items:[]}),cartDraft:()=>options,
    settings:{getElementById:()=>({options:[{value:'C'}]})},seedSession(native,selected){assert.equal(native,true);assert.equal(selected.address.line1,'100 Test Yard');calls.push('draft');}});
  vm.runInContext(section('    function bindCartEntry(','    async function refreshFast('),context);context.bindCartEntry();
  const event={target:{closest:()=>control},preventDefault(){throw Error('must stay native');}};
  handlers.find(x=>x.capture).fn(event);calls.push('native-reset');handlers.find(x=>!x.capture).fn(event);assert.deepEqual(calls,['native-reset','draft']);
});
test('a changed draft, cancellation, detached page, or new uncertain receipt during handoff cannot navigate',async()=>{
  for(const mode of ['draft','cancel','detached','receipt']) {
    let resolve,clicks=0,checks=0;const basket=[{pid:'85',code:'FISH',unit:'ea',quantity:1}];
    const context=vm.createContext({cartEntry:true,submitting:false,busy:false,active:{phase:'checking_out',current:basket},fast:{},overlay:{},cancelPending:false,
      keepCartDraft(){},clearFrame(){},loading(){},status(){},standardKey:'native',win:{sessionStorage:{setItem(){}}},
      assertNoPendingCartOrder(){checks++;if(mode==='receipt'&&checks>1)throw Error('uncertain order');},
      checkIdentity:()=>new Promise(done=>{resolve=done;}),cart:async()=>({items:basket}),nativeCartSignature:core.nativeCartSignature,
      doc:{documentElement:{dataset:{}},getElementById:()=>({click(){clicks++;}})},seedSession(){},dismiss(){},showError(){},presentDraft(){},cancel:async()=>{}});
    vm.runInContext(section('    async function standardCheckout()','    function notice('),context);const handoff=context.standardCheckout();
    if(mode==='draft')context.fast={dirty:true};if(mode==='cancel')context.cancelPending=true;if(mode==='detached'){context.active=null;context.overlay=null;}
    resolve();await handoff;assert.equal(clicks,0,mode);
  }
});
test('Back cancels a queued bootstrap checkout without firing a native click; a late bootstrap stays on native checkout',()=>{
  const header=fs.readFileSync(require.resolve('../headermodern.js'),'utf8'),events={};let timeout,native=0;
  const control={getAttribute:()=>null,setAttribute(){},removeAttribute(){},closest(){return this;},click(){native++;}};
  const window={location:{pathname:'/ShoppingCart.aspx'},navigator:{locks:{}},setTimeout(fn,ms){assert.equal(ms,12000);timeout=fn;return 1;},clearTimeout(){},addEventListener:(n,fn)=>events[n]=fn,removeEventListener:n=>delete events[n]};
  const document={documentElement:{dataset:{}},querySelector:()=>({}),getElementById:id=>id==='wl-buy-now'?null:control};
  const context=vm.createContext({window,document});vm.runInContext(header.slice(header.indexOf('  function deferCartCheckoutUntilPilotReady('),header.indexOf('  function loadCartDesign(')),context);
  context.deferCartCheckoutUntilPilotReady({addEventListener(){}});events.click({target:control,preventDefault(){},stopImmediatePropagation(){}});events.pagehide();timeout();
  assert.equal(native,0);assert.equal(document.documentElement.dataset.wlCompactNativeOnly,'1');
});
test('actual UPS shipping dropdown is used and its native change is allowed to finish before continuing',async()=>{
  let changes=0,continues=0;const dropdown={value:'03',options:[{value:'03',textContent:'UPS Ground $9.95 USD'},{value:'02',textContent:'UPS Second Day Air $49.31 USD'}]};
  const page={documentElement:{dataset:{}},getElementById:id=>id==='ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'?{click(){continues++;}}:id==='ctl00_PageBody_CartSummary2_UPSShippingCalculatorControl_ShippingSelection'?dropdown:null,querySelector:()=>null};
  const context=vm.createContext({fast:{method:'ship',shippingValue:'02',started:Date.now()},active:{phase:'checking_out'},busy:false,submitting:false,nativeFormsReady:()=>true,
    frame:{contentDocument:page},setStage(){},status(){},cachePaymentTotal(){},updateFastOptions(){},text:String,setNative(child,el,value){changes++;el.value=value;},haltFast(message){throw Error(message);}});
  vm.runInContext(section('    async function driveFast(','    async function submitNative('),context);
  await context.driveFast({},page);assert.equal(changes,1);assert.equal(continues,0);assert.equal(context.fast.shippingOptions.length,2);
  await context.driveFast({},page);assert.equal(changes,1);assert.equal(continues,1);
});
