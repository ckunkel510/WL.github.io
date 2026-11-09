'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../DeliveryOptions.js'),'utf8');
const start=source.indexOf('  const METHOD_KEY = "wl_fulfillment_method";');
const block=source.slice(start,source.indexOf('  function bootPickupAdvance()',start));
function fixture(options={}) {
 let posts=0;const storage=new Map([['wl_fulfillment_method',options.method||'pickup']]),timers=[],events={};
 if(options.back)storage.set('wl_native_shipping_back_v1',String(Date.now()-(options.expired?300001:0)));
 if(!options.noForward)storage.set('wl_native_shipping_forward_v1',String(Date.now()));
 const win={addEventListener(name,fn){events[name]=fn;},setTimeout:fn=>timers.push(fn),performance:{getEntriesByType:()=>[{type:options.history?'back_forward':'navigate'}]}};win.top=options.frame?{}:win;
 const control={click(){posts++;}};
 const doc={documentElement:{dataset:{},contains:()=>true},addEventListener(name,fn){events[name]=fn;},getElementById:id=>id==='wl-pickup-payment-progress'?{}:id==='ctl00_PageBody_btnContinue_DeliveryAndPromotionCodesView'&&!options.missing?control:null,querySelector:()=>options.choices?{options:[{},{}]}:null,querySelectorAll:()=>[]};
 const context=vm.createContext({window:win,document:doc,sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v),removeItem:key=>storage.delete(key)},getComputedStyle:()=>({display:'none'})});
 vm.runInContext(block+'\nwindow.advance=autoAdvancePickupShipping;',context);
 return {win,doc,storage,timers,events,posts:()=>posts,advance:()=>win.advance()};
}
test('fresh pickup skips an empty shipping intermediary once',()=>{
 const f=fixture();f.advance();f.advance();assert.equal(f.timers.length,1);f.timers[0]();assert.equal(f.posts(),1);
});
test('payment Back holds the shipping step across repeated ready and UpdatePanel checks',()=>{
 const f=fixture({back:true});f.advance();f.advance();assert.equal(f.posts(),0);assert.equal(f.timers.length,0);
 assert.equal(f.doc.documentElement.dataset.wlNativeShippingBack,'held');assert.equal(f.storage.has('wl_native_shipping_back_v1'),false);
});
test('browser Back also holds shipping and an expired old Back marker does not delay a new checkout',()=>{
 const history=fixture({history:true});history.advance();assert.equal(history.timers.length,0);
 const fresh=fixture({back:true,expired:true});fresh.advance();fresh.timers[0]();assert.equal(fresh.posts(),1);
});
test('the exact native payment Back action records a short-lived per-tab return without touching compact frames',()=>{
 for(const frame of [false,true]) {
  const f=fixture({frame});f.events.click({target:{closest:selector=>selector==='#ctl00_PageBody_btnBack_CardOnFileView'?{}:null}});
  assert.equal(f.storage.has('wl_native_shipping_back_v1'),!frame);
 }
});
test('navigation away cancels a queued automatic continuation',()=>{
 const f=fixture();f.advance();f.events.pagehide();f.timers[0]();assert.equal(f.posts(),0);
});
test('UPS speed and multiple local-delivery choices require customer input',()=>{
 for(const options of [{method:'ship'},{method:'delivery',choices:true}]) {
  const f=fixture(options);f.advance();assert.equal(f.timers.length,0);assert.equal(f.posts(),0);
 }
});
test('Back state is not consumed on an unrelated page without the native shipping Continue',()=>{
 const f=fixture({back:true,missing:true});f.advance();assert.equal(f.storage.has('wl_native_shipping_back_v1'),true);assert.equal(f.posts(),0);
});
test('Quick Buy retains its existing intermediary progression independent of native Back state',()=>{
 const f=fixture({frame:true,back:true});f.advance();f.timers[0]();assert.equal(f.posts(),1);assert.equal(f.storage.has('wl_native_shipping_back_v1'),true);
});
test('opening or refreshing the shipping form cannot automatically post without a fresh details continuation',()=>{
 const f=fixture({noForward:true});f.advance();assert.equal(f.posts(),0);assert.equal(f.timers.length,0);
});
