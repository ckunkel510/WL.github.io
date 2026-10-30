'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../BuyNowPilot'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
test('a timed-out native request has a usable message and is never automatically replayed',async()=>{
  let expire,rejectFetch,calls=0,cleared=0;
  class AbortController {constructor(){this.signal={aborted:false};}abort(){this.signal.aborted=true;rejectFetch(Object.assign(new Error('signal is aborted without reason'),{name:'AbortError'}));}}
  const context=vm.createContext({ORIGIN:'https://webtrack.woodsonlumber.com',URL,timings:null,win:{location:{href:'https://webtrack.woodsonlumber.com/ShoppingCart.aspx'},AbortController,setTimeout:fn=>{expire=fn;return 1;},clearTimeout(){cleared++;},fetch(){calls++;return new Promise((resolve,reject)=>{rejectFetch=reject;});}}});
  vm.runInContext(section('    async function fetchDocument(','    var user ='),context);
  for(const options of [undefined,{method:'POST'}]) {
    const request=context.fetchDocument('/ShoppingCart.aspx',options);expire();await assert.rejects(request,/WebTrack took too long.*selections are kept/);
  }
  assert.equal(calls,2);assert.equal(cleared,2);
});
test('an active compact timeout offers retry while uncertain orders and pending writes cannot retry',()=>{
  for(const mode of ['checking_out','uncertain','pending-write','receipt','secure-payment','payment-authorizing']) {
    const actions=[],messages=[];
    const context=vm.createContext({fast:{securePayment:mode==='secure-payment',paymentAuthorizing:mode==='payment-authorizing'},busy:true,cartEntry:true,submitting:mode==='uncertain',active:{cartCheckout:true,phase:mode==='uncertain'?'uncertain':'checking_out',pending:mode==='pending-write'?{}:null},
      overlay:{querySelector:selector=>selector==='[data-bn-body]'?{appendChild:button=>actions.push(button.label)}:null},storage:{},cartOrderKey:'guard',
      measureCheckout(){},status:message=>messages.push(message),loading(){},readCartOrderReceipt:()=>mode==='receipt'?{phase:'confirmed'}:null,
      button:(label,handler)=>({label,handler,dataset:{}})});
    vm.runInContext(section('    function showError(','    function showRestoreButton('),context);
    context.showError(Object.assign(new Error('signal is aborted without reason'),{name:'AbortError'}));
    assert.match(messages[0],/selections are kept/);assert.equal(actions.includes('Try compact checkout again'),mode==='checking_out',mode);
  }
});
const pallet=[{pid:'22444',quantity:30,code:'ASC',unit:'bag'},{pid:'23297',quantity:1,code:'EPALLETS',unit:'ea'}];
test('a draft edit, open editor, changed cart or uncertain receipt during final verification cannot place an order',async()=>{
  for(const mode of ['new-draft','editor','changed-cart','uncertain']) {
    let clicks=0;
    const context=vm.createContext({fast:{ready:true,review:{signature:'approved'}},busy:false,submitting:false,active:{cartCheckout:true,phase:'checking_out',current:pallet},
      loading(){},assertNoPendingCartOrder(){if(mode==='uncertain')throw Error('uncertain order');},
      async checkIdentity(){if(mode==='new-draft')context.fast={dirty:true,ready:false};if(mode==='editor')context.fast.editor='address';},
      cart:async allow=>{assert.equal(allow,true);return {items:mode==='changed-cart'?[pallet[0]]:pallet};},
      nativeCartSignature:core.nativeCartSignature,purchaseRestrictions:async()=>new Set(),frame:{contentDocument:{getElementById:()=>({click(){clicks++;}})}}});
    vm.runInContext(section('    async function submitNative(','    function locateProduct('),context);
    await assert.rejects(context.submitNative({},{}));assert.equal(clicks,0,mode);assert.equal(context.busy,false,mode);
  }
});
test('a draft pauses native progression until explicit Review even if a previous frame is ready',async()=>{
  let initialized=0;
  const context=vm.createContext({fast:{dirty:true,ready:true},submitting:false,busy:false,active:{phase:'checking_out'},nativeFormsReady(){initialized++;return true;}});
  vm.runInContext(section('    async function driveFast(','    async function submitNative('),context);
  await context.driveFast({}, {documentElement:{dataset:{}}});assert.equal(initialized,0);
});
