'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../NativeCheckout');

test('completed native defaults collapse while missing fields and optional instructions stay available',()=>{
  const plan=core.sectionPlan([{step:1,valid:true},{step:2,valid:true},{step:3,unavailable:true},{step:4,valid:false},{step:5,valid:true}],null);
  assert.equal(plan.next,4);assert.equal(plan.ready,3);assert.equal(plan.total,4);
  assert.deepEqual(plan.rows.map(row=>row.collapsed),[false,true,false,false,false]);
});
test('the active editor remains open even when the last required character makes it valid',()=>{
  const rows=[{step:3,valid:true},{step:4,valid:false}];
  assert.equal(core.sectionPlan(rows,3).rows[0].collapsed,false);
  assert.equal(core.sectionPlan(rows,null).rows[0].collapsed,true);
  assert.equal(core.sectionPlan(rows,3).rows[1].collapsed,false);
});
test('native progress distinguishes shipping, payment and final review and never treats the basket as checkout',()=>{
  const stage=(...ids)=>core.nativeStage({getElementById:id=>ids.includes(id)?{}:null});
  assert.equal(stage('ctl00_PageBody_ShoppingCartDetailPanel'),null);
  assert.equal(stage('ctl00_PageBody_SaleTypeSelector_rbCollectLater'),'details');
  assert.equal(stage('ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'),'shipping');
  assert.equal(stage('ctl00_PageBody_btnContinue_CardOnFileView'),'payment');
  assert.equal(stage('ctl00_PageBody_CompleteCheckoutButton','ctl00_PageBody_ddlCardsOnFile'),'review');
});
test('the native guide never initializes in Quick Buy frames, another site or on product pages',()=>{
  for(const mode of ['frame','origin','page']) {
    const win={location:{origin:mode==='origin'?'https://example.invalid':'https://webtrack.woodsonlumber.com',pathname:mode==='page'?'/Products.aspx':'/ShoppingCart.aspx'}};
    win.top=mode==='frame'?{}:win;core.boot(win);assert.equal(win.WLNativeCheckout,undefined);
  }
});
test('normal compact entry is disabled while Quick Buy and durable recovery remain in the source',()=>{
  const source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
  assert.match(source,/ENABLE_CART_CHECKOUT = false/);assert.match(source,/ENABLE_NEW_STARTS = true/);
  const bind=source.slice(source.indexOf('    function bindCartEntry()'),source.indexOf('    function bindCartEntry()')+180);
  assert.match(bind,/if \(!ENABLE_CART_CHECKOUT/);
  assert.match(source,/if \(pending\) \{\s+await withLock/);
});
test('normal cart skips all compact account reads, but guest and Quick Buy recovery still load their owner verifier',()=>{
  const header=fs.readFileSync(require.resolve('../headermodern.js'),'utf8');
  const source=header.slice(header.indexOf('  function loadBuyNowPilot()'),header.indexOf('  function loadTawkCommerceAssist()'));
  for(const mode of ['normal','quick-recovery','guest-recovery','unreadable','preference']) {
    let loads=0;
    const win={location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx'},sessionStorage:{getItem:()=>mode==='guest-recovery'?'backup':null}};win.top=win;
    const storage=mode==='quick-recovery'?{['wl_buy_now_pilot_v1:'+'a'.repeat(64)]:'backup'}:mode==='preference'?{['wl_buy_now_pilot_v1:payment:'+'a'.repeat(64)]:'card'}:{};
    if(mode==='unreadable')Object.defineProperty(win,'sessionStorage',{get(){throw Error('blocked');}});
    const doc={documentElement:{dataset:{}},querySelector:selector=>selector.includes('SignOut=1')?{}:null};
    const context=vm.createContext({window:win,document:doc,localStorage:storage,WEBTRACK:win.location.origin,loadCartRuntimeScript(){loads++;},deferCartCheckoutUntilPilotReady(){}});
    vm.runInContext(source,context);context.loadBuyNowPilot();
    assert.equal(loads,['normal','preference'].includes(mode)?0:1,mode);
    assert.equal(doc.documentElement.dataset.wlCompactNativeOnly,['normal','preference'].includes(mode)?'1':undefined,mode);
  }
});

test('optional native guidance loads in parallel and never holds the required native decorators',()=>{
  const loader=require('../CartNativeViews');
  const scripts=[],timers=[],events={};
  const win={location:{origin:'https://webtrack.woodsonlumber.com',pathname:'/ShoppingCart.aspx',href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx'},setTimeout(fn,ms){timers.push({fn,ms});},addEventListener(name,fn){events[name]=fn;}};win.top=win;
  win.document={readyState:'complete',scripts,querySelector:()=>({}),createElement:()=>({setAttribute(){},remove(){}}),head:{appendChild:script=>scripts.push(script)}};
  loader.boot(win);assert.equal(scripts.length,4);assert.match(scripts[0].src,/NativeCheckout.js/);assert.match(scripts[1].src,/Checkout2.js/);assert.match(scripts[2].src,/CartPricing.js/);assert.match(scripts[3].src,/CardContainer.js/);
  assert.equal(timers.length,0);
  scripts[0].onerror();assert.equal(scripts.filter(script=>/Checkout2.js/.test(script.src)).length,1);
  events.pagehide();timers[0].fn();assert.equal(scripts.length,4);
});

test('pickup contact uses the native delivery contact when billing has no name controls',()=>{
 const fields={ctl00_PageBody_DeliveryAddress_ContactFirstNameTextBox:{value:'Alex'},ctl00_PageBody_DeliveryAddress_ContactLastNameTextBox:{value:'Example'}};
 const doc={getElementById:id=>fields[id]||null};assert.equal(core.pickupContactName(doc),'Alex Example');
 fields.ctl00_PageBody_InvoiceAddress_ContactFirstNameTextBox={value:'Billing'};
 assert.equal(core.pickupContactName(doc),'Billing');assert.equal(core.pickupContactName({getElementById:()=>null}),'');
});

test('the detail decorator cannot hide native payment or final-review submit controls',()=>{
 const source=fs.readFileSync(require.resolve('../Checkout2.js'),'utf8');
 const start=source.indexOf('  function initCheckout()');
 const block=source.slice(start,source.indexOf('  // GTM can inject',start));
 let hides=0;
 const context=vm.createContext({window:{jQuery(){hides++;throw Error('no detail decoration on later native steps');}},document:{getElementById:()=>null}});
 vm.runInContext(block,context);context.initCheckout();assert.equal(hides,0);
});

test('normal details never bypass WebTrack validation with a raw form submission',()=>{
 const source=fs.readFileSync(require.resolve('../Checkout2.js'),'utf8');
 const start=source.indexOf('      function clickNativeContinue()');
 const block=source.slice(start,source.indexOf('const navDiv =',start));
 for(const mode of ['ready','loading','invalid']) {
  let native=0,raw=0;const form={submit(){raw++;}},button={form,disabled:false,click(){native++;}};
  const context=vm.createContext({isBuyNowFrame:()=>false,steps:[1,2,3,4,5],setReturnStep(){},setExpectedNav(){},window:{Page_IsValid:mode!=='invalid'},document:{querySelector:()=>button}});
  if(mode!=='loading'){context.WebForm_DoPostBackWithOptions=()=>{};context.WebForm_PostBackOptions=()=>{};}
  vm.runInContext(block,context);assert.equal(context.clickNativeContinue(),mode==='ready');
  assert.equal(raw,0);assert.equal(native,mode==='loading'?0:1);
 }
});

function nativeReadinessFixture() {
 const source=fs.readFileSync(require.resolve('../Checkout2.js'),'utf8');
 const block=source.slice(source.indexOf('  function nativeDetailsReady()'),source.indexOf('  function suppressQuoteCheckoutPath()'));
 let busy=true,now=0;const timers=[],events={};const button={disabled:false,getAttribute:()=>null};
 const win={Sys:{WebForms:{PageRequestManager:{getInstance:()=>({get_isInAsyncPostBack:()=>busy})}}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},addEventListener(name,fn){events[name]=fn;},removeEventListener(name){delete events[name];}};
 const context=vm.createContext({window:win,document:{readyState:'complete',getElementById:()=>button},Date:{now:()=>now}});
 vm.runInContext(block,context);return {context,timers,events,button,settle(){busy=false;},expire(){now=8000;}};
}
test('native details cannot post while UpdatePanel is busy and resume only with enabled native controls',async()=>{
 const f=nativeReadinessFixture();assert.equal(f.context.nativeDetailsReady(),false);const pending=f.context.awaitNativeDetails();
 f.settle();f.timers.shift()();assert.equal(await pending,true);assert.equal(f.button.disabled,false);
 f.button.disabled=true;assert.equal(f.context.nativeDetailsReady(),false);
});
test('native details readiness has a bounded failure and page departure cancels waiting',async()=>{
 const timeout=nativeReadinessFixture(),wait=timeout.context.awaitNativeDetails();timeout.expire();timeout.timers.shift()();assert.equal(await wait,false);
 const leaving=nativeReadinessFixture(),pending=leaving.context.awaitNativeDetails();leaving.events.pagehide();assert.equal(await pending,false);
});

test('native server validation prevents a completed-looking section from being collapsed',()=>{
 const error={matches:()=>false,textContent:'Please check this address'};
 const pane={querySelectorAll:()=>[error]};
 assert.equal(core.hasNativeError({getComputedStyle:()=>({display:'inline',visibility:'visible'})},pane),true);
 assert.equal(core.hasNativeError({getComputedStyle:()=>({display:'none',visibility:'visible'})},pane),false);
 assert.equal(core.hasNativeError({getComputedStyle:()=>({display:'inline',visibility:'hidden'})},pane),false);
});
test('an explicit native invalid-field marker remains visible to guidance without depending on ancestor layout',()=>{
 const pane={querySelectorAll:()=>[{matches:()=>true}]};
 assert.equal(core.hasNativeError({},pane),true);
});
