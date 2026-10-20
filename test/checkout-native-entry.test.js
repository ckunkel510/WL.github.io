'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../BuyNowPilot');
const href='javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions("ctl00$PageBody$PlaceOrderButton", "", true, "", "", false, true))';
function fixture(){
 const calls=[];let clicks=0,initialized=true;
 const child={Sys:{Application:{get_isInitialized:()=>initialized}},Page_IsValid:true,
  WebForm_PostBackOptions:function(...args){this.args=args;},WebForm_DoPostBackWithOptions(options){calls.push(options.args);}};
 const control={getAttribute:name=>name==='href'?href:null,click(){clicks++;}};
 return {child,control,calls,clicks:()=>clicks,initializing(){initialized=false;}};
}
test('native checkout waits for WebForms initialization instead of consuming its only cart activation',()=>{
 const f=fixture();f.initializing();assert.equal(core.continueNativeCart(f.child,f.control),false);assert.equal(f.calls.length,0);assert.equal(f.clicks(),0);
});
test('native cart entry uses WebTracks exact validated postback options without a JavaScript URL click',()=>{
 const f=fixture();assert.equal(core.continueNativeCart(f.child,f.control),true);
 assert.deepEqual(f.calls,[['ctl00$PageBody$PlaceOrderButton','',true,'','',false,true]]);assert.equal(f.clicks(),0);
});
test('a missing native helper, disabled entry, and unexpected target never force checkout',()=>{
 const f=fixture();delete f.child.WebForm_DoPostBackWithOptions;assert.equal(core.continueNativeCart(f.child,f.control),false);assert.equal(f.clicks(),0);
 const disabled=fixture();disabled.control.disabled=true;assert.equal(core.continueNativeCart(disabled.child,disabled.control),false);assert.equal(disabled.calls.length,0);
 const other=fixture();other.control.getAttribute=name=>name==='href'?href.replace('PlaceOrderButton','CompleteCheckoutButton'):null;
 assert.throws(()=>core.continueNativeCart(other.child,other.control),/could not be verified/);assert.equal(other.calls.length,0);
});
test('native cart validation failure is surfaced rather than bypassed or counted as navigation',()=>{
 const f=fixture();f.child.WebForm_DoPostBackWithOptions=()=>{f.child.Page_IsValid=false;};
 assert.throws(()=>core.continueNativeCart(f.child,f.control),/cart quantity checked/);assert.equal(f.clicks(),0);
});
test('ordinary native controls retain their normal click when no WebForms JavaScript URL is present',()=>{
 const f=fixture();f.control.getAttribute=name=>name==='href'?'javascript:__doPostBack("checkout", "")':null;
 assert.equal(core.continueNativeCart(f.child,f.control),true);assert.equal(f.clicks(),1);assert.equal(f.calls.length,0);
});
test('native-frame presentation suppression requires the exact owned same-origin checkout frame',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../ShoppingCartRow.js'),'utf8');
 for(const mode of ['owned','top','other-name','other-frame','other-origin']) {
  const win={name:mode==='other-name'?'other':'woodson-buy-now-checkout',location:{origin:'https://webtrack.woodsonlumber.com'}};
  win.parent=mode==='top'?win:{location:{origin:mode==='other-origin'?'https://example.test':win.location.origin},document:{querySelector:()=>({contentWindow:mode==='other-frame'?{}:win})}};
  const context=vm.createContext({window:win});vm.runInContext(source.slice(source.indexOf('function wlCartIsOwnedCheckoutFrame('),source.indexOf('$(async function')),context);
  assert.equal(context.wlCartIsOwnedCheckoutFrame(),mode==='owned');
 }
});
test('native-frame cart still blocks clearance shortages and unverified inventory',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../ShoppingCartRow.js'),'utf8'),context=vm.createContext({});
 vm.runInContext(source.slice(source.indexOf('function wlCartClearanceShortage('),source.indexOf('$(async function')),context);
 const item={isClearance:true,inventoryVerified:true,maxQuantity:5};
 assert.equal(context.wlCartClearanceShortage(item,5),false);assert.equal(context.wlCartClearanceShortage(item,6),true);
 assert.equal(context.wlCartClearanceShortage({...item,inventoryVerified:false},1),true);assert.equal(context.wlCartClearanceShortage({...item,maxQuantity:0},1),true);
 assert.equal(context.wlCartClearanceShortage({isClearance:false},10),false);assert.equal(context.wlCartClearanceShortage(null,10),false);
});
test('cart and Quick buy both wait for cart policy and block a shortage before native entry',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
 const driver=source.slice(source.indexOf('    async function driveFast('),source.indexOf('    async function submitNative('));
 for(const cartCheckout of [true,false])for(const ready of [false,true]) {
  let entries=0,halt='';const page={documentElement:{dataset:{}},getElementById:id=>id==='ctl00_PageBody_PlaceOrderButton'?{}:null,querySelector:selector=>selector==='.shopping-cart-item'?{}:{textContent:'Clearance quantity unavailable'}};
  const context=vm.createContext({fast:{started:Date.now()},busy:false,submitting:false,active:{phase:'checking_out',cartCheckout},nativeFormsReady:()=>true,cartPolicyReady:()=>ready,status(){},haltFast:message=>{halt=message;},text:String,continueNativeCart(){entries++;}});
  vm.runInContext(driver,context);await context.driveFast({},page);assert.equal(entries,0);assert.equal(halt,ready?'Clearance quantity unavailable':'');
 }
});

test('native navigation waits for document load as well as WebForms initialization',()=>{
 const f=fixture();f.child.document={readyState:'loading'};assert.equal(core.continueNativeCart(f.child,f.control),false);
 f.child.document.readyState='interactive';assert.equal(core.continueNativeCart(f.child,f.control),false);assert.equal(f.calls.length,0);
 f.child.document.readyState='complete';assert.equal(core.continueNativeCart(f.child,f.control),true);assert.equal(f.calls.length,1);
});

test('native controls wait while an UpdatePanel request is in flight',()=>{
 const f=fixture();f.child.document={readyState:'complete'};
 f.child.Sys.WebForms={PageRequestManager:{getInstance:()=>({get_isInAsyncPostBack:()=>true})}};
 assert.equal(core.continueNativeCart(f.child,f.control),false);assert.equal(f.calls.length,0);
 f.child.Sys.WebForms.PageRequestManager.getInstance=()=>({get_isInAsyncPostBack:()=>false});
 assert.equal(core.continueNativeCart(f.child,f.control),true);assert.equal(f.calls.length,1);
});
