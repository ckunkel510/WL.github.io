'use strict';
process.env.NODE_ENV='test';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/christmas-shop-2026.json');
const promo=require('../api/christmas-promotion');
const sessions=require('../api/fulfillment-sessions');
const {applyShippingMinimumToRates}=require('../api/shipping-policy');
const bridge=require('../api/rate')._test;
const {buildFulfillmentQuote}=require('../api/fulfillment-quote')._test;
const NOW=Date.parse('2026-11-14T12:00:00-06:00');
const item=manifest.products[0];
const cart=[{...item,quantity:2,netLineTotalCents:10000}];
const trusted=[{...item,quantity:2,unitPriceCents:5000}];
const raw=[{serviceCode:'03',serviceName:'UPS Ground',amount:28,currency:'USD'}, {serviceCode:'02',serviceName:'UPS 2nd Day Air',amount:48,currency:'USD'}];
function freeRates(){return promo.apply(raw,promo.evaluate('MERRY100',cart,trusted,NOW),0,NOW);}
const compact=require('../BuyNowPilot');
const realNow=Date.now;
test.beforeEach(()=>{Date.now=()=>NOW;sessions.resetMemoryClaims();});
test.afterEach(()=>{Date.now=realNow;});

test('compact checkout accepts a verified zero Ground quote and rejects an unexplained zero',()=>{
  const rates=freeRates();
  const quote={options:{ups:{available:true,amount:0,rates,promotion:rates[0].promotion},delivery:{available:true,amount:25}}};
  assert.equal(compact.cheapestHomeMethod(quote),'ship');
  const option=compact.fulfillmentOptions(true,quote).ship;
  assert.equal(compact.quotedShipping('ship',option,{value:'03',label:'UPS Ground'},true),0);
  assert.equal(compact.quotedShipping('ship',option,{value:'02',label:'UPS 2nd Day Air'},false),4800);
  assert.equal(compact.quoteShippingChoices(option).length,2);
  assert.throws(()=>compact.quotedShipping('ship',{...option,promotion:null},{value:'03',label:'UPS Ground'},true));
});

test('applying or removing a compact shipping code invalidates ready options before recalculating',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../BuyNowPilot'),'utf8');
  const begin=source.indexOf("      body.querySelector('[data-bn-holiday-apply]').addEventListener('click',function(){");
  const end=source.indexOf("      holidayInput.addEventListener('keydown'",begin);
  for(const code of ['MERRY100','','INVALID']) {
    let handler,refreshes=0;const storage=new Map([['wl_shipping_offer_v1','old quote'],['wl_christmas_shipping_code_2026','MERRY100']]);
    const fast={journey:'options',optionsReady:true,paymentReady:true},message={textContent:''};
    const context=vm.createContext({Date,fast,submitting:false,busy:false,holidayInput:{value:code},text:s=>String(s).trim(),body:{querySelector:s=>s.includes('apply')?{addEventListener:(_,fn)=>handler=fn}:message},win:{sessionStorage:{setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}},refreshFast(){assert.equal(fast.optionsReady,false);assert.equal(fast.paymentReady,false);assert.equal(fast.refreshQuote,true);refreshes++;return Promise.resolve();},showError:e=>{throw e;}});
    vm.runInContext(source.slice(begin,end),context);handler();await Promise.resolve();
    assert.equal(refreshes,code==='INVALID'?0:1);
    if(code!=='INVALID'){assert.equal(storage.has('wl_shipping_offer_v1'),false);assert.equal(storage.get('wl_christmas_shipping_code_2026'),code||undefined);}
  }
});
