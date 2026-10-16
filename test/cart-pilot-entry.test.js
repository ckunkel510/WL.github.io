'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../BuyNowPilot');
const header = fs.readFileSync(require.resolve('../headermodern.js'), 'utf8');
const guardSource = header.slice(header.indexOf('  function deferCartCheckoutUntilPilotReady('), header.indexOf('  function loadBuyNowPilot('));
function bus() {
  const listeners = new Map();
  return {addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, event = {}) { for (const fn of [...(listeners.get(name) || [])]) fn(event); }};
}
function fixture(options = {}) {
  const win = Object.assign(bus(), {location:{pathname:'/ShoppingCart.aspx'},navigator:{locks:{}},setTimeout:fn=>{win.expire=fn;return 1;},clearTimeout(){}});
  const script = bus(), state = {native:0,pilot:0,prevented:0,overlay:false};
  function control() {
    const attrs = new Map();
    const node = {getAttribute:key=>attrs.get(key)??null,setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),closest:()=>node,
      click() { const event={target:node,preventDefault(){this.prevented=true;state.prevented++;},stopImmediatePropagation(){this.stopped=true;}};
        win.emit('click', event); if (!event.prevented) state.native++; }};
    return node;
  }
  let current = control();
  const document = {documentElement:{dataset:{}},querySelector:()=>({}),getElementById:id=>id==='wl-buy-now'?(state.overlay?{}:null):current};
  if (options.noLocks) delete win.navigator.locks;
  const context = vm.createContext({window:win,document}); vm.runInContext(guardSource, context);
  context.deferCartCheckoutUntilPilotReady(script);
  return {win,script,state,document,control:()=>current,replace(){current=control();},ready(){
    document.documentElement.dataset.wlCompactCartCheckout=core.build;
    win.addEventListener('click',event=>{if(event.stopped)return;event.preventDefault();state.pilot++;});
    win.emit('wl-buy-now-pilot-settled');
  }};
}
test('an early cart click waits for account verification and enters the pilot exactly once',()=>{
  const f=fixture(); f.control().click(); f.control().click();
  assert.equal(f.state.native,0); assert.equal(f.control().getAttribute('aria-busy'),'true');
  f.ready(); assert.equal(f.state.pilot,1); assert.equal(f.state.native,0); assert.equal(f.control().getAttribute('aria-busy'),null);
  f.win.emit('wl-buy-now-pilot-settled'); assert.equal(f.state.pilot,1);
});
test('an ineligible or failed bootstrap resumes only the requested native checkout',()=>{
  const f=fixture(); f.control().setAttribute('aria-busy','false'); f.control().click();
  f.script.emit('error'); f.win.emit('wl-buy-now-pilot-settled'); f.win.expire();
  assert.equal(f.state.native,1); assert.equal(f.state.pilot,0); assert.equal(f.control().getAttribute('aria-busy'),'false');
});
test('readiness without a click never starts checkout, including the bounded timeout',()=>{
  const f=fixture(); f.win.expire(); assert.equal(f.state.native,0); f.control().click(); assert.equal(f.state.native,1);
});
test('early checkout respects an existing recovery panel and a newly disabled native button',()=>{
  for(const block of ['overlay','disabled']) { const f=fixture(); f.control().click();
    if(block==='overlay')f.state.overlay=true;else f.control().setAttribute('aria-disabled','true');
    f.win.emit('wl-buy-now-pilot-settled'); assert.equal(f.state.native,0);
  }
});
test('an UpdatePanel replacement receives the single queued checkout instead of a detached button',()=>{
  const f=fixture(); const old=f.control(); old.click(); f.replace(); f.ready(); assert.equal(f.state.pilot,1); assert.equal(old.getAttribute('aria-busy'),null);
});
test('browsers without cart locking keep the native entry',()=>{
  const f=fixture({noLocks:true}); f.control().click(); assert.equal(f.state.native,1); assert.equal(f.control().getAttribute('aria-busy'),null);
});
const pilot = fs.readFileSync(require.resolve('../BuyNowPilot'), 'utf8');
const driverSource=pilot.slice(pilot.indexOf('    async function driveFast('),pilot.indexOf('    async function submitNative('));
async function quoteTimeout(replace) {
  const page={documentElement:{dataset:{bnFieldsApplied:'1'}},getElementById:id=>['btnDelivered','btnPickup'].includes(id)?{}:null};
  const initial={method:'delivery',started:Date.now(),driving:false}; let timeout;
  const context=vm.createContext({fast:initial,frame:{contentDocument:page},busy:false,submitting:false,active:{phase:'checking_out',purchase:[]},setStage(){},quoteForCart:()=>null,fulfillmentOptions:()=>({}),updateFastOptions(){},status(){},detailsQuotes:new WeakMap(),refreshDetailsQuote:core.refreshDetailsQuote,
    win:{setTimeout:fn=>{timeout=fn;return 1;},clearTimeout(){}}});
  vm.runInContext(driverSource,context);
  const promise=context.driveFast({WLCheckout:{refreshDateUI(){},validateBeforeFinalSubmit(){}},WLShippingOffer:{current:()=>null,refresh:()=>new Promise(()=>{})}},page);
  if(replace) {context.fast={method:'pickup',ready:true};context.frame={contentDocument:{}};}
  timeout(); await promise;
  return context.fast;
}
test('a timed-out carrier request from a replaced frame cannot corrupt a ready pickup revision',async()=>{
  const current=await quoteTimeout(true); assert.equal(current.method,'pickup'); assert.equal(current.ready,true);
});
test('a carrier timeout on the current checkout still reports the actionable error',async()=>{
  await assert.rejects(quoteTimeout(false),/Delivery rates are taking longer/);
});

const loaderSource=header.slice(header.indexOf('  function deferCartCheckoutUntilPilotReady('),header.indexOf('  function loadTawkCommerceAssist('));
function loaderFixture({signedIn=true,pathname='/Products.aspx',storage={}}={}) {
  const scripts=[];
  const win={location:{origin:'https://webtrack.woodsonlumber.com',pathname},navigator:{},setTimeout(){},addEventListener(){}};win.top=win;
  const document={querySelector:selector=>selector.includes('SignOut=1')?(signedIn?{}:null):null,createElement:()=>({setAttribute(){}}),head:{appendChild:node=>scripts.push(node)}};
  const context=vm.createContext({window:win,document,localStorage:storage,WEBTRACK:win.location.origin});vm.runInContext(loaderSource,context);context.loadBuyNowPilot();return scripts;
}
test('the product loader no longer requires the former pilot user hint',()=>{
  assert.equal(loaderFixture().length,1);
  assert.match(loaderFixture()[0].src,/compact-checkout-22/);
});
test('anonymous shopping never loads Quick buy even with stale pilot storage',()=>{
  assert.equal(loaderFixture({signedIn:false,storage:{wl_user_id:'old-pilot'}}).length,0);
});
test('unrelated account pages avoid bootstrap reads unless a recovery journal exists',()=>{
  assert.equal(loaderFixture({pathname:'/AccountInfo_R.aspx'}).length,0);
  assert.equal(loaderFixture({pathname:'/AccountInfo_R.aspx',storage:{['wl_buy_now_pilot_v1:'+'a'.repeat(64)]:'backup'}}).length,1);
  assert.equal(loaderFixture({pathname:'/AccountInfo_R.aspx',storage:{['wl_buy_now_pilot_v1:payment:'+'a'.repeat(64)]:'preference'}}).length,0);
});
