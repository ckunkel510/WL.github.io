"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../NativeCheckout');
const now=Date.parse('2026-11-09T16:00:00Z');
function quote(){return {ts:now,carrierOrigin:{state:'TX',postalCode:'77836'},cartSignature:'PRIVATE-CART',addressKey:'PRIVATE-ADDRESS',shippingOffer:{token:'PRIVATE-TOKEN'},options:{ups:{available:true,rates:[
 {serviceCode:'03',serviceName:'UPS Ground',amount:30,transit:{pickupDate:'2026-11-09',arrivalDate:'2026-11-13',businessDays:4}},
 {serviceCode:'02',serviceName:'UPS Second Day Air',amount:60,transit:{pickupDate:'2026-11-09',arrivalDate:'2026-11-11',businessDays:2}},
 {serviceCode:'01',serviceName:'UPS Next Day Air',transit:{pickupDate:'2026-11-09',arrivalDate:'2026-11-10',businessDays:1}},
 {serviceCode:'13',serviceName:'UPS Next Day Air Saver',transit:{pickupDate:'2026-11-09',arrivalDate:'2026-11-10',businessDays:1}},
 {serviceCode:'59',serviceName:'UPS Second Day Air AM',transit:{pickupDate:'2026-11-09',arrivalDate:'2026-11-11',businessDays:2}}
]}}};}
function snapshot(){return core.upsQuoteSnapshot(quote(),now);}

test('the native-page transfer contains only carrier date metadata, never address, cart, prices or claims',()=>{
 const result=snapshot();assert.equal(result.rates.length,5);assert.equal(result.originPostalCode,'77836');
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|amount|addressKey|cartSignature|shippingOffer|token/);
});
test('a snapshot requires a fresh carrier quote from a recognized Texas origin',()=>{
 for(const change of [q=>q.ts=now-900001,q=>q.ts=now+1,q=>q.carrierOrigin.state='NY',q=>q.carrierOrigin.postalCode='10001',q=>q.options.ups.available=false]){const q=quote();change(q);assert.equal(core.upsQuoteSnapshot(q,now),null);}
 assert.equal(core.upsQuoteSnapshot(null,now),null);
});
test('changing native UPS speed uses that exact service estimate and adds one business day',()=>{
 const q=snapshot(),ground=core.upsArrival(q,{value:'-1',label:'UPS Ground ($30.00)'},now),air=core.upsArrival(q,{value:'2',label:'UPS 2nd Day Air (+ $30.00)'},now);
 assert.equal(ground.date,'2026-11-16');assert.equal(air.date,'2026-11-12');assert.equal(air.detail,'UPS Second Day Air');assert.doesNotMatch(JSON.stringify(air),/extra|cushion|buffer|padding/i);assert.match(air.basis,/^If dispatched.*Texas/);
});
test('service-name matching cannot borrow another service date through a numeric ID or prefix',()=>{
 const rates=quote().options.ups.rates;
 assert.equal(core.selectedUpsRate(rates,{value:'01',label:'UPS Next Day Air Saver'}).serviceCode,'13');
 assert.equal(core.selectedUpsRate(rates,{value:'03',label:'UPS 2nd Day Air A.M.'}).serviceCode,'59');
 assert.equal(core.selectedUpsRate(rates,{value:'03',label:'An unrecognized special service'}),null);
 assert.equal(core.selectedUpsRate(rates,{value:'02',label:'UPS service 02'}).serviceCode,'02');
});
test('missing, expired, future or wrong-origin transfer data never produces a calendar promise',()=>{
 for(const q of [null,{...snapshot(),quotedAt:now-900001},{...snapshot(),capturedAt:now+1},{...snapshot(),originPostalCode:'10001'}])assert.equal(core.upsArrival(q,{label:'UPS Ground'},now).kind,'unavailable');
 assert.equal(core.upsArrival(snapshot(),{label:'Unrecognized service'},now).kind,'unavailable');
});
test('transit-days-only and past pickup dates show after-dispatch timing rather than invented calendar dates',()=>{
 const q=snapshot();q.rates[0].transit={businessDays:5};let result=core.upsArrival(q,{label:'UPS Ground'},now);assert.equal(result.kind,'transit');assert.match(result.headline,/6 business days/);assert.equal(result.date,undefined);assert.equal(result.detail,'UPS Ground');assert.doesNotMatch(JSON.stringify(result),/extra|cushion|buffer|padding/i);
 q.rates[0].transit={pickupDate:'2026-11-08',arrivalDate:'2026-11-13',businessDays:5};assert.equal(core.upsArrival(q,{label:'UPS Ground'},now).kind,'transit');
 q.rates[0].transit={pickupDate:'2026-11-09',arrivalDate:'2026-02-30'};assert.equal(core.upsArrival(q,{label:'UPS Ground'},now).kind,'unavailable');
});
test('the extra business day skips weekends, UPS closures and the documented Ground year-end closure',()=>{
 assert.equal(core.addUpsBusinessDays('2026-11-13',1,'03'),'2026-11-16');
 assert.equal(core.addUpsBusinessDays('2026-11-25',1,'02'),'2026-11-27');
 assert.equal(core.addUpsBusinessDays('2026-12-24',1,'02'),'2026-12-28');
 assert.equal(core.addUpsBusinessDays('2026-12-30',1,'03'),'2027-01-04');
 assert.equal(core.addUpsBusinessDays('2026-12-30',1,'01'),'2026-12-31');
 assert.equal(core.addUpsBusinessDays('2026-01-16',1,'03'),'2026-01-20');
 assert.equal(core.addUpsBusinessDays('2026-02-30',1,'03'),'');
});
test('arrival uses the Texas calendar even when UTC has crossed midnight',()=>{
 const n=Date.parse('2026-11-10T00:30:00Z'),q=quote();q.ts=n;q.options.ups.rates[0].transit.pickupDate='2026-11-09';
 assert.equal(core.upsArrival(core.upsQuoteSnapshot(q,n),{label:'UPS Ground'},n).kind,'date');
});
function captureFixture(mode='ship',checked=true){const data=new Map([['wl_fulfillment_method',mode],['wl_native_ups_estimates_v1','stale']]);return {data,win:{sessionStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},document:{getElementById:()=>({checked})},WLShippingOffer:{current:()=>{const q=quote();q.ts=Date.now();return q;}}}};}
test('only a confirmed native UPS details transition captures date metadata; other paths clear it',()=>{
 const good=captureFixture();assert.equal(core.captureShippingEstimate(good.win),true);assert.equal(JSON.parse(good.data.get('wl_native_ups_estimates_v1')).rates.length,5);
 for(const [mode,checked] of [['pickup',true],['delivery',true],['ship',false]]){const f=captureFixture(mode,checked);assert.equal(core.captureShippingEstimate(f.win),false);assert.equal(f.data.has('wl_native_ups_estimates_v1'),false);}
 const missing=captureFixture();delete missing.win.WLShippingOffer;assert.equal(core.captureShippingEstimate(missing.win),false);assert.equal(missing.data.has('wl_native_ups_estimates_v1'),false);
 assert.doesNotThrow(()=>core.captureShippingEstimate({sessionStorage:{getItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}}}));
});
const source=fs.readFileSync(require.resolve('../Checkout2'),'utf8');
function nativeSelection(frame,radios={}){const context=vm.createContext({document:{getElementById:id=>({checked:!!radios[id.split('_').pop()]}),querySelector:()=>({})},isBuyNowFrame:()=>frame,getFulfillmentIntent:()=> 'ship'});vm.runInContext(source.slice(source.indexOf('  function getDeliveredSelected()'),source.indexOf('  function getSaleType()')),context);return context;}
test('a highlighted recommendation cannot masquerade as a native radio choice',()=>{
 const native=nativeSelection(false);assert.equal(native.getDeliveredSelected(),false);assert.equal(native.getPickupSelected(),false);
 assert.equal(nativeSelection(false,{rbUPSDelivery:true}).getDeliveredSelected(),true);assert.equal(nativeSelection(false,{rbCollectLater:true}).getPickupSelected(),true);
 const compact=nativeSelection(true);assert.equal(compact.getDeliveredSelected(),true);assert.equal(compact.getPickupSelected(),true);
});
test('native fulfillment validation cannot silently check a radio based on decorative selection classes',()=>{
 const start=source.indexOf('    function validateStep(stepNum)');const block=source.slice(start,source.indexOf('      if (stepNum === 2)',start))+'    }';
 const radios={};let message='';const c=vm.createContext({document:{getElementById:id=>radios[id]||(radios[id]={checked:false}),querySelector:()=>({})},isBuyNowFrame:()=>false,showInlineError:(step,text)=>{message=text;},clearInlineError(){},updatePickupModeUI(){}});vm.runInContext(block,c);
 assert.equal(c.validateStep(1),false);assert.match(message,/Choose a delivery method/);assert.equal(Object.values(radios).some(r=>r.checked),false);
});

test('rapid native method clicks cannot apply a second mode using the first pending reservation',async()=>{
 let handler,finish;const requested=[],chosen=[],attributes=new Map(),events=[];
 const selector={setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)};
 const doc={dispatchEvent:e=>events.push(e.type)};
 const jq=el=>({data:()=>el.mode,on:(type,selector,fn)=>{handler=fn;}});
 const context=vm.createContext({$:jq,document:doc,isBuyNowFrame:()=>false,addressRegion:()=> 'texas',window:{WLShippingOffer:{select:mode=>{requested.push(mode);return new Promise(resolve=>{finish=resolve;});}}},Event:class{constructor(type){this.type=type;}},updateShippingStyles:mode=>chosen.push(mode),showOutOfStateMessage(){},updateAddressAwareOptions(){}});
 const start=source.indexOf('          let nativeSelectionBusy');const block=source.slice(start,source.indexOf('          $(document).on("change"',start));vm.runInContext(block,context);
 const event={preventDefault(){},stopImmediatePropagation(){}};const button=mode=>({mode,disabled:false,closest:()=>selector});
 const first=handler.call(button('ship'),event);assert.equal(attributes.get('aria-busy'),'true');
 await handler.call(button('delivery'),event);assert.deepEqual(requested,['ship']);assert.deepEqual(chosen,[]);
 finish(true);await first;assert.deepEqual(chosen,['ship']);assert.equal(attributes.has('aria-busy'),false);assert.equal(events.length,2);
});
test('the old guessed-date widget yields only for top-level UPS and preserves local and compact paths',()=>{
 const delivery=fs.readFileSync(require.resolve('../DeliveryOptions'),'utf8');const start=delivery.indexOf('  function initDeliveryWidget()');
 const prefix=delivery.slice(start,delivery.indexOf('    var $area',start))+'    probe();\n  }';
 for(const mode of ['native-ups','native-local','compact-ups','blocked']){
  let calls=0;const win={};win.top=mode==='compact-ups'?{}:win;
  const c=vm.createContext({window:win,sessionStorage:{getItem(){if(mode==='blocked')throw Error('blocked');return mode==='native-local'?'delivery':'ship';}},probe(){calls++;}});
  vm.runInContext(prefix,c);c.initDeliveryWidget();assert.equal(calls,mode==='native-ups'?0:1,mode);
 }
});

test('the native UPS control matches exact carrier codes even when its labels contain trademarks or legacy wording',()=>{
 const q=snapshot();
 assert.equal(core.upsArrival(q,{value:'02',label:'UPS Second Day Air® $60.00 USD',nativeUps:true},now).date,'2026-11-12');
 assert.equal(core.selectedUpsRate(q.rates,{value:'13',label:'UPS Next Day Air Saver®',nativeUps:true}).serviceCode,'13');
 assert.equal(core.selectedUpsRate(q.rates,{value:'99',label:'UPS Ground',nativeUps:true}),null);
});

test('malformed cached or missing carrier rows fail softly without breaking native shipping',()=>{
 const q=quote();q.options.ups.rates={};assert.equal(core.upsQuoteSnapshot(q,now),null);
 q.options.ups.rates=[null,0,{}, {serviceCode:'03',transit:'bad'}];assert.equal(core.upsQuoteSnapshot(q,now),null);
 assert.equal(core.upsArrival({...snapshot(),rates:{}},{value:'03',label:'UPS Ground',nativeUps:true},now).kind,'unavailable');
 assert.equal(core.upsArrival({...snapshot(),rates:[null]},{value:'03',label:'UPS Ground',nativeUps:true},now).kind,'unavailable');
});
