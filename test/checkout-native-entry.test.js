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
