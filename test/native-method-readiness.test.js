'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../Checkout2'),'utf8');
const helpers=source.slice(source.indexOf('  function nativeShippingContextKey()'),source.indexOf('  function suppressQuoteCheckoutPath()'));
const readiness=source.slice(source.indexOf('          function updateNativeChoiceReadiness('),source.indexOf('          function currentFulfillmentQuote()'));
const clickStart=source.indexOf('          $(document).on("click", ".modern-shipping-selector button"');
const click=source.slice(clickStart,source.indexOf("          if (!isBuyNowFrame()) {\n            document.querySelector('.wl-shipping-retry')",clickStart));
function fixture(){
 const f={ready:true,clock:1000,quote:{ts:Date.now(),options:{ups:{available:true,amount:20},delivery:{available:true,amount:30}}},quoteState:'ready',compact:false,region:'texas',selected:[],errors:[],requests:[],timers:new Map()};
 const fields=Object.fromEntries(Object.entries({AddressLine1:'123 Example St',AddressLine2:'',AddressLine3:'',City:'Example',CountySelector_CountyList:'TX',Postcode:'77836',CountrySelector:'US'}).map(([k,value])=>['ctl00_PageBody_DeliveryAddress_'+k,{value}]));
 fields.ctl00_PageBody_DeliveryAddress_CountySelector_CountyList.selectedOptions=[{textContent:'Texas'}];
 const selector={dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
 const status={textContent:''},retry={hidden:true};
 const buttons=['pickup','delivery','ship'].map(mode=>({dataset:{mode},disabled:false,attrs:{},tag:'',closest:()=>selector}));
 const doc={getElementById:id=>fields[id]||null,documentElement:{getAttribute:()=>f.quoteState},querySelector:s=>s==='.modern-shipping-selector'?selector:s==='.wl-shipping-readiness p'?status:s==='.wl-shipping-retry'?retry:null,dispatchEvent(){}};
 function jq(node){if(node===doc)return {on(type,sel,handler){f.click=handler;}};if(typeof node==='string')return {each(fn){buttons.forEach(b=>fn.call(b));}};return {data:k=>node.dataset[k],prop(k,v){node[k]=v;return this;},attr(k,v){node.attrs[k]=v;return this;},toggleClass(){return this;},find(){return {text(v){node.tag=v;}};}};}
 let timerId=0;
 const events={};
 const win={__doPostBack(){},addEventListener:(name,fn)=>{events[name]=fn;},removeEventListener:name=>{delete events[name];},clearTimeout:id=>f.timers.delete(id),setTimeout(fn){f.timers.set(++timerId,fn);return timerId;},WLShippingOffer:{current:()=>f.quote,select:async mode=>{f.requests.push(mode);return true;},refreshCheckout:async()=>{f.quote={ts:Date.now(),options:{ups:{available:true,amount:20},delivery:{available:false}}};f.quoteState='ready';}}};
 const c=vm.createContext({window:win,document:doc,$:jq,Date:{now:()=>f.clock},Event:class{},nativeDetailsReady:()=>f.ready,awaitNativeDetails:async()=>f.ready,nativeSelectionBusy:false,nativeChoiceTimer:null,nativeChoiceWaitingSince:0,nativeChoiceRetrying:false,nativeChoiceAbandoned:false,nativeChoiceEpoch:0,isBuyNowFrame:()=>f.compact,currentFulfillmentQuote:()=>f.quote,addressRegion:()=>f.region,updateShippingStyles:mode=>f.selected.push(mode),showOutOfStateMessage:message=>f.errors.push(message)});
 vm.runInContext(helpers+readiness,c);
 c.updateAddressAwareOptions=()=>c.updateNativeChoiceReadiness(f.quote);
 vm.runInContext(click,c);
 return Object.assign(f,{c,win,fields,buttons,selector,status,retry,events,render(){c.updateNativeChoiceReadiness(f.quote);},press(mode){return f.click.call(buttons.find(b=>b.dataset.mode===mode),{preventDefault(){},stopImmediatePropagation(){}});}});
}
test('native loading and late WebForms initialization keep choices inert without an address warning',async()=>{
 const f=fixture();f.ready=false;f.render();assert.ok(f.buttons.every(b=>b.disabled));assert.equal(f.selector.dataset.wlReadyState,'loading');
 await f.press('ship');assert.deepEqual(f.requests,[]);assert.deepEqual(f.errors,[]);
 f.ready=true;delete f.win.__doPostBack;assert.equal(f.c.nativeShippingChoiceState(f.quote),'loading');
 f.win.__doPostBack=()=>{};f.render();assert.ok(f.buttons.every(b=>!b.disabled));assert.equal(f.status.textContent,'');
});
test('a pending quote disables paid choices while pickup stays usable, then enables only available quotes',async()=>{
 const f=fixture();f.quote=null;f.quoteState='requesting';f.render();
 assert.deepEqual(f.buttons.map(b=>b.disabled),[false,true,true]);assert.match(f.status.textContent,/Checking delivery options/);
 await f.press('ship');assert.deepEqual(f.requests,[]);assert.deepEqual(f.errors,[]);
 f.quote={options:{ups:{available:true},delivery:{available:false}}};f.render();assert.deepEqual(f.buttons.map(b=>b.disabled),[false,true,false]);assert.equal(f.timers.size,0);
});
test('manual or guest addresses can be entered before a paid rate exists without trying to reserve one',async()=>{
 const f=fixture();f.quote=null;f.fields.ctl00_PageBody_DeliveryAddress_AddressLine1.value='';f.render();
 assert.equal(f.selector.dataset.wlReadyState,'address');assert.ok(f.buttons.every(b=>!b.disabled));assert.equal(f.buttons[2].tag,'Add address for rate');
 await f.press('ship');assert.deepEqual(f.requests,[]);assert.deepEqual(f.errors,[]);assert.deepEqual(f.selected,['ship']);
});
test('missing address controls stay loading while blank or invalid entered routing fields remain editable',()=>{
 for(const field of ['AddressLine1','City','CountySelector_CountyList','Postcode']){
  const f=fixture();delete f.fields['ctl00_PageBody_DeliveryAddress_'+field];assert.equal(f.c.nativeShippingChoiceState(null),'loading');
 }
 const f=fixture();f.fields.ctl00_PageBody_DeliveryAddress_Postcode.value='12';assert.equal(f.c.nativeShippingChoiceState(null),'address');
 f.fields.ctl00_PageBody_DeliveryAddress_Postcode.value='77836-1234';assert.equal(f.c.nativeShippingChoiceState(f.quote),'ready');
});
test('a fast click after an address edit cannot reserve a stale quote before the UI debounce runs',async()=>{
 const f=fixture();f.render();assert.equal(f.buttons[2].disabled,false);f.fields.ctl00_PageBody_DeliveryAddress_City.value='New City';f.quote=null;
 await f.press('ship');assert.equal(f.buttons[2].disabled,true);assert.deepEqual(f.requests,[]);assert.deepEqual(f.errors,[]);assert.deepEqual(f.selected,[]);
});
test('double clicks make one reservation and a context change during it cannot select stale fulfillment',async()=>{
 const f=fixture();let finish;f.win.WLShippingOffer.select=mode=>{f.requests.push(mode);return new Promise(resolve=>{finish=resolve;});};
 const pending=f.press('ship');await f.press('delivery');assert.deepEqual(f.requests,['ship']);assert.ok(f.buttons.every(b=>b.disabled));
 f.fields.ctl00_PageBody_DeliveryAddress_Postcode.value='10001';f.quote=null;finish(true);await pending;
 assert.deepEqual(f.selected,[]);assert.deepEqual(f.errors,[]);assert.equal(f.c.nativeSelectionBusy,false);
});
test('a real reservation failure gives a retry message without claiming the address is wrong',async()=>{
 const f=fixture();f.win.WLShippingOffer.select=async()=>false;await f.press('ship');assert.deepEqual(f.selected,[]);assert.equal(f.errors.length,1);assert.match(f.errors[0],/try again/);assert.doesNotMatch(f.errors[0],/address/i);
});
test('a reservation from an earlier page visit cannot apply after browser Back restores the page',async()=>{
 const f=fixture();let finish;f.win.WLShippingOffer.select=()=>new Promise(resolve=>{finish=resolve;});const pending=f.press('ship');
 f.c.nativeChoiceEpoch++;f.c.nativeSelectionBusy=false;finish(true);await pending;assert.deepEqual(f.selected,[]);assert.deepEqual(f.errors,[]);assert.equal(f.c.nativeSelectionBusy,false);
});
test('a stalled or failed quote exposes bounded manual retry and stops polling until another readiness event',async()=>{
 const f=fixture();f.quote=null;f.quoteState='requesting';f.render();assert.equal(f.timers.size,1);f.clock+=12001;f.render();
 assert.equal(f.selector.dataset.wlReadyState,'retry');assert.equal(f.retry.hidden,false);assert.equal(f.timers.size,0);assert.equal(f.buttons[0].disabled,false);
 await f.c.retryNativeShippingChoices();assert.equal(f.selector.dataset.wlReadyState,'ready');assert.equal(f.retry.hidden,true);assert.equal(f.buttons[2].disabled,false);
});
test('address or branch hydration does not show a premature failure, while a later real network error offers retry',()=>{
 const f=fixture();f.quote=null;f.quoteState='context_missing';f.render();assert.equal(f.selector.dataset.wlReadyState,'quote');assert.equal(f.retry.hidden,true);assert.doesNotMatch(f.status.textContent,/could not|address/i);
 f.quoteState='network_error';f.render();assert.equal(f.selector.dataset.wlReadyState,'retry');assert.equal(f.retry.hidden,false);
});
test('departure cancels retry work and compact checkout retains its existing selection path',async()=>{
 const f=fixture();f.quote=null;f.c.nativeChoiceAbandoned=true;await f.c.retryNativeShippingChoices();assert.equal(f.quote,null);assert.equal(f.timers.size,0);
 const compact=fixture();compact.compact=true;compact.ready=false;compact.quote=null;compact.render();await compact.press('ship');assert.deepEqual(compact.requests,['ship']);assert.deepEqual(compact.selected,['ship']);
});
test('native quote lookup cannot use raw cached cart data before its address-aware runtime loads',()=>{
 const start=source.indexOf('          function currentFulfillmentQuote()');const block=source.slice(start,source.indexOf('          function cleanStateValue(',start));
 for(const compact of [false,true]){
  const c=vm.createContext({window:{},isBuyNowFrame:()=>compact,sessionStorage:{getItem:()=>JSON.stringify({ts:Date.now(),options:{ups:{available:true}}})},Date});vm.runInContext(block,c);assert.equal(!!c.currentFulfillmentQuote(),compact);
 }
});
test('a fast Continue waits for the existing quote without starting another rate lookup or submitting early',async()=>{
 const f=fixture();f.quote=null;f.fields.ctl00_PageBody_SaleTypeSelector_rbUPSDelivery={checked:true};f.c.getFulfillmentIntent=()=> 'ship';f.c.getSaleType=()=> 'ship';f.c.FULFILLMENT_CONFIRMATION_KEY='confirmed';f.c.sessionStorage={setItem(){}};
 const start=source.indexOf('  async function syncFulfillmentForNativeSubmit()');vm.runInContext(source.slice(start,source.indexOf('  function wlEpalletRuleMode(',start)),f.c);
 const pending=f.c.syncFulfillmentForNativeSubmit();assert.deepEqual(f.requests,[]);f.quote={options:{ups:{available:true,amount:20}}};const timer=[...f.timers.values()][0];timer();
 assert.equal(await pending,true);assert.deepEqual(f.requests,['ship']);assert.equal(f.events.pagehide,undefined);
});
test('quote waiting stops on timeout, changed address, or departure without accepting an older route',async()=>{
 for(const mode of ['timeout','address','departure']){
  const f=fixture();f.quote=null;const pending=f.c.awaitNativeShippingQuote();
  if(mode==='timeout'){f.clock+=10001;[...f.timers.values()][0]();}
  if(mode==='address'){f.fields.ctl00_PageBody_DeliveryAddress_City.value='Changed';[...f.timers.values()][0]();}
  if(mode==='departure')f.events.pagehide();
  assert.equal(await pending,null);assert.equal(f.events.pagehide,undefined);
 }
});
